import type { DeskpetMessage } from '@frankenstein/shared'
import { WS_URL } from '@frankenstein/shared'

export type MessageHandler = (msg: DeskpetMessage) => void
export type ConnectionHandler = (connected: boolean) => void

export class MaiBotGateway {
  private ws: WebSocket | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private maxReconnectDelay = 30000

  private onMessage: MessageHandler | null = null
  private onConnection: ConnectionHandler | null = null

  constructor(private url: string = WS_URL) {}

  setHandlers(onMessage: MessageHandler, onConnection: ConnectionHandler) {
    this.onMessage = onMessage
    this.onConnection = onConnection
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return

    try {
      this.ws = new WebSocket(this.url)
    } catch {
      console.warn('[Bridge] Connect failed, retrying...')
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.onConnection?.(true)
      this.reconnectAttempt = 0
      this.startHeartbeat()
    }

    this.ws.onmessage = (event) => {
      try {
        const msg: DeskpetMessage = JSON.parse(event.data)
        this.onMessage?.(msg)
      } catch { /* ignore malformed */ }
    }

    this.ws.onclose = () => {
      this.onConnection?.(false)
      this.stopHeartbeat()
      this.scheduleReconnect()
    }

    this.ws.onerror = () => this.ws?.close()
  }

  send(type: string, data: Record<string, any> = {}) {
    if (this.ws?.readyState !== WebSocket.OPEN) return false
    this.ws.send(JSON.stringify({ type, data, timestamp: Date.now() }))
    return true
  }

  disconnect() {
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => this.send('heartbeat'), 15000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), this.maxReconnectDelay)
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }
}
