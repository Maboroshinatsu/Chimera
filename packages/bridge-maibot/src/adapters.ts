import type { DeskpetMessage } from '@frankenstein/shared'

export interface MaiBotEvent {
  type: string
  payload: Record<string, any>
}

export function translateMessage(msg: DeskpetMessage): MaiBotEvent {
  switch (msg.type) {
    case 'output:text:delta':
      return {
        type: 'SPEECH_CHUNK',
        payload: { delta: msg.data.delta, request_id: msg.data.request_id || msg.request_id },
      }
    case 'output:text:done':
      return {
        type: 'SPEECH_END',
        payload: { request_id: msg.data.request_id || msg.request_id, error: msg.data.error },
      }
    case 'output:text':
      return {
        type: 'SPEECH_DIRECT',
        payload: { text: msg.data.text },
      }
    case 'state:emotion':
      return {
        type: 'EMOTION_SET',
        payload: { emotion: msg.data.emotion },
      }
    case 'state:animation':
      return {
        type: 'ANIMATION_PLAY',
        payload: { name: msg.data.name, loop: !!msg.data.loop },
      }
    case 'state:thinking':
      return { type: 'THINKING_START', payload: {} }
    default:
      return { type: 'UNKNOWN', payload: msg.data }
  }
}
