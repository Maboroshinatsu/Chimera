let lastEmotionTime = 0
const EMOTION_DEBOUNCE = 500

let lastActionTime = 0
const ACTION_COOLDOWN = 3000

export function shouldUpdateEmotion(emotion: string, current: string): boolean {
  if (emotion === current) return false
  const now = Date.now()
  if (now - lastEmotionTime < EMOTION_DEBOUNCE) return false
  lastEmotionTime = now
  return true
}

export function shouldTriggerAction(): boolean {
  const now = Date.now()
  if (now - lastActionTime < ACTION_COOLDOWN) return false
  lastActionTime = now
  return true
}

export function resetActionCooldown() {
  lastActionTime = 0
}
