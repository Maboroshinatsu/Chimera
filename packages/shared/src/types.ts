export interface DeskpetMessage {
  type: string
  data: Record<string, any>
  timestamp?: number
  request_id?: string
}

export interface EmotionDef {
  name: string
  motion: string
}

export type TalkingState = 'idle' | 'thinking' | 'speaking'

export interface CharacterState {
  emotion: string
  talkingState: TalkingState
  energy: number
  lastInteraction: number
}

export const EMOTION_LIST = [
  'happy', 'sad', 'angry', 'surprise',
  'thinking', 'shy', 'curious', 'neutral', 'idle',
] as const

export const EMOTION_TO_MOTION: Record<string, string> = {
  happy: 'Happy',
  sad: 'Sad',
  angry: 'Angry',
  surprise: 'Surprise',
  thinking: 'Think',
  shy: 'Awkward',
  curious: 'Curious',
  neutral: 'Idle',
  idle: 'Idle',
}

export const WS_URL = 'ws://127.0.0.1:8523/ws'
