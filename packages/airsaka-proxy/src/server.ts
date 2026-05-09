import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { v4 as uuid } from 'uuid'
import { MaiBotClient, MaiBotStreamEvent } from './maibot-client.js'

const PORT = parseInt(process.env.PORT || '8524', 10)
const MAIBOT_WS_URL = process.env.MAIBOT_WS_URL || 'ws://127.0.0.1:8523/ws'

const maiBot = new MaiBotClient(MAIBOT_WS_URL)

interface ChatRequest {
  model: string
  messages: { role: string; content: string }[]
  stream?: boolean
}

function extractUserMessage(messages: ChatRequest['messages']): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content
  }
  return messages.map(m => `${m.role}: ${m.content}`).join('\n')
}

function formatSSE(event: string, data: object): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

async function handleChatCompletions(req: IncomingMessage, res: ServerResponse, body: string): Promise<void> {
  const requestId = uuid()
  let chatReq: ChatRequest

  try {
    chatReq = JSON.parse(body)
  } catch {
    res.writeHead(400).end(JSON.stringify({ error: 'Invalid JSON' }))
    return
  }

  const userText = extractUserMessage(chatReq.messages)
  if (!userText.trim()) {
    res.writeHead(400).end(JSON.stringify({ error: 'No user message found' }))
    return
  }

  const isStreaming = chatReq.stream !== false

  if (!isStreaming) {
    // Non-streaming: collect full response
    try {
      const result = await maiBot.ask(userText)
      const response = {
        id: requestId,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: chatReq.model || 'maibot',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: result.text },
          finish_reason: 'stop',
        }],
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    } catch (err: any) {
      res.writeHead(500).end(JSON.stringify({ error: err.message }))
    }
    return
  }

  // Streaming SSE response
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  const sseId = `chatcmpl-${requestId}`
  const created = Math.floor(Date.now() / 1000)

  let textContent = ''

  const onEvent = (event: MaiBotStreamEvent) => {
    switch (event.type) {
      case 'delta': {
        textContent += event.delta
        res.write(formatSSE('message', {
          id: sseId,
          object: 'chat.completion.chunk',
          created,
          model: chatReq.model || 'maibot',
          choices: [{
            index: 0,
            delta: { content: event.delta },
            finish_reason: null,
          }],
        }))
        break
      }
      case 'done':
        res.write(formatSSE('message', {
          id: sseId,
          object: 'chat.completion.chunk',
          created,
          model: chatReq.model || 'maibot',
          choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop',
          }],
        }))
        res.write('data: [DONE]\n\n')
        res.end()
        break
      case 'error':
        res.write(formatSSE('error', { message: event.error }))
        res.write('data: [DONE]\n\n')
        res.end()
        break
    }
  }

  maiBot.askStream(userText, onEvent, requestId)
}

function handleModels(res: ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    object: 'list',
    data: [
      {
        id: 'maibot',
        object: 'model',
        created: 1700000000,
        owned_by: 'maibot',
        name: 'MaiBot (via Chimera)',
        description: 'MaiBot AI through Chimera proxy'
      },
    ],
  }))
}

const server = createServer((req, res) => {
  console.log(`[req] ${req.method} ${req.url}`)

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end()
    return
  }

  if (req.method === 'GET' && (req.url === '/v1/models' || req.url === '/models')) {
    handleModels(res)
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200).end(JSON.stringify({ status: 'ok', maiBotConnected: maiBot.isConnected }))
    return
  }

  if (req.method === 'POST' && (req.url === '/v1/chat/completions' || req.url === '/chat/completions')) {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => handleChatCompletions(req, res, body))
    return
  }

  res.writeHead(404).end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`[airsaka-proxy] Listening on http://localhost:${PORT}`)
  console.log(`[airsaka-proxy] MaiBot WebSocket: ${MAIBOT_WS_URL}`)
  maiBot.connect()
})
