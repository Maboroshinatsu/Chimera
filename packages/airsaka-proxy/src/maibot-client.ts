import WebSocket from 'ws'
import { randomUUID } from 'node:crypto'

export interface MaiBotStreamEvent {
  type: 'delta' | 'done' | 'error'
  delta?: string
  error?: string
  requestId?: string
}

interface PendingStream {
  onEvent: (event: MaiBotStreamEvent) => void
  requestId: string
}

export class MaiBotClient {
  private ws: WebSocket | null = null
  private pending: Map<string, PendingStream> = new Map()
  private url: string
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(url: string) {
    this.url = url
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return
    try {
      this.ws = new WebSocket(this.url)
    } catch {
      setTimeout(() => this.connect(), 3000)
      return
    }

    this.ws.onopen = () => {
      console.log('[maibot-client] Connected')
      this.startHeartbeat()
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data.toString())
        this.handleMessage(msg)
      } catch { /* ignore */ }
    }

    this.ws.onclose = () => {
      this.stopHeartbeat()
      this.scheduleReconnect()
    }

    this.ws.onerror = () => this.ws?.close()
  }

  ask(userText: string): Promise<{ text: string }> {
    return new Promise((resolve, reject) => {
      const requestId = this.sendMessage(userText)
      if (!requestId) {
        reject(new Error('MaiBot not connected'))
        return
      }

      let text = ''
      const onEvent = (event: MaiBotStreamEvent) => {
        if (event.requestId !== requestId) return
        switch (event.type) {
          case 'delta': text += event.delta!; break
          case 'done': this.pending.delete(requestId); resolve({ text }); break
          case 'error': this.pending.delete(requestId); reject(new Error(event.error)); break
        }
      }
      this.pending.set(requestId, { onEvent, requestId })
    })
  }

  askStream(userText: string, onEvent: (event: MaiBotStreamEvent) => void, requestId?: string): string | null {
    const reqId = this.sendMessage(userText, requestId)
    if (!reqId) {
      onEvent({ type: 'error', error: 'MaiBot not connected' })
      return null
    }
    this.pending.set(reqId, { onEvent, requestId: reqId })

    // Timeout: finish with empty response if MaiBot doesn't reply (e.g., no_reply decision)
    setTimeout(() => {
      const stream = this.pending.get(reqId)
      if (stream) {
        this.pending.delete(reqId)
        stream.onEvent({ type: 'done', requestId: reqId })
      }
    }, 30000)

    return reqId
  }

  disconnect(): void {
    this.stopHeartbeat()
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    this.ws?.close()
    this.ws = null
  }

  private sendMessage(text: string, requestId?: string): string | null {
    if (this.ws?.readyState !== WebSocket.OPEN) return null
    const reqId = requestId || randomUUID().replace(/-/g, '').slice(0, 12)
    this.lastRequestId = reqId
    this.ws.send(JSON.stringify({
      type: 'input:text',
      data: { text },
      timestamp: Date.now(),
      request_id: reqId,
    }))
    return reqId
  }

  private lastRequestId = ''

  private handleMessage(msg: any): void {
    const { type, data, request_id } = msg

    // Resolve ANY pending stream (single-user, so any response is for the current request)
    if (this.pending.size === 0) return
    const stream = [...this.pending.values()][0]
    const reqId = data?.request_id || request_id || ''

    switch (type) {
      case 'output:text:delta':
        stream.onEvent({ type: 'delta', delta: data?.delta || '', requestId: reqId })
        break
      case 'output:text':
        stream.onEvent({ type: 'delta', delta: data?.text || '', requestId: reqId })
        stream.onEvent({ type: 'done', requestId: reqId })
        this.pending.delete(stream.requestId)
        break
      case 'output:text:done':
        this.pending.delete(stream.requestId)
        if (data?.error) {
          stream.onEvent({ type: 'error', error: data.error, requestId: reqId })
        } else {
          stream.onEvent({ type: 'done', requestId: reqId })
        }
        break
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat', data: {}, timestamp: Date.now() }))
      }
    }, 15000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 3000)
  }
}
