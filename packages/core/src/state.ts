import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TalkingState } from '@frankenstein/shared'

export interface ChatBubbleState {
  text: string
  visible: boolean
  streaming: boolean
  requestId: string | null
}

export const useCompanionStore = defineStore('companion', () => {
  // emotion
  const emotion = ref('neutral')
  const talkingState = ref<TalkingState>('idle')
  const energy = ref(0.8)
  const lastInteraction = ref(Date.now())

  // chat bubble
  const chatBubble = ref<ChatBubbleState>({
    text: '',
    visible: false,
    streaming: false,
    requestId: null,
  })

  // pending animation (consumed by renderer)
  const pendingAnimation = ref<string | null>(null)
  const pendingAnimationLoop = ref(false)

  // WebSocket status
  const wsConnected = ref(false)

  function setEmotion(em: string) {
    emotion.value = em
  }

  function setTalkingState(s: TalkingState) {
    talkingState.value = s
    lastInteraction.value = Date.now()
  }

  function appendChatText(delta: string, requestId: string) {
    if (!chatBubble.value.visible || chatBubble.value.requestId !== requestId) {
      chatBubble.value = { text: delta, visible: true, streaming: true, requestId }
    } else {
      chatBubble.value.text += delta
    }
  }

  function finishChatStream(requestId: string) {
    if (chatBubble.value.requestId === requestId) {
      chatBubble.value.streaming = false
    }
  }

  function showChatMessage(text: string) {
    chatBubble.value = { text, visible: true, streaming: false, requestId: null }
  }

  function hideChatBubble() {
    chatBubble.value.visible = false
  }

  function setPendingAnimation(name: string, loop: boolean) {
    pendingAnimation.value = name
    pendingAnimationLoop.value = loop
  }

  function consumePendingAnimation(): { name: string; loop: boolean } | null {
    if (!pendingAnimation.value) return null
    const result = { name: pendingAnimation.value, loop: pendingAnimationLoop.value }
    pendingAnimation.value = null
    pendingAnimationLoop.value = false
    return result
  }

  function touch() {
    lastInteraction.value = Date.now()
  }

  return {
    emotion,
    talkingState,
    energy,
    lastInteraction,
    chatBubble,
    pendingAnimation,
    pendingAnimationLoop,
    wsConnected,
    setEmotion,
    setTalkingState,
    appendChatText,
    finishChatStream,
    showChatMessage,
    hideChatBubble,
    setPendingAnimation,
    consumePendingAnimation,
    touch,
  }
})
