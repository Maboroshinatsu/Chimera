<template>
  <div class="deskpet-stage" @dblclick="onDoubleClick" @mousedown.left="onMouseDown" @mouseenter="isHovered = true" @mouseleave="isHovered = false">
    <div ref="stageRef" class="live2d-stage" />
    <div class="nav-bar" @mousedown.stop />

    <Transition name="bubble-fade">
      <div v-if="store.chatBubble.visible" class="chat-bubble">
        <div class="bubble-content">
          <span class="bubble-text">{{ store.chatBubble.text }}</span>
          <span v-if="store.chatBubble.streaming" class="bubble-cursor">|</span>
        </div>
      </div>
    </Transition>

    <Transition name="input-fade">
      <div v-if="showInput" class="quick-input" @mousedown.stop>
        <input ref="inputRef" v-model="inputText" class="input-field" placeholder="说点什么..." @keydown.enter="sendText" @blur="showInput = false" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useCompanionStore } from '@frankenstein/core'
import { MaiBotGateway, translateMessage } from '@frankenstein/bridge-maibot'
import { createPixiApp, loadModel, playMotion, resizeModel, resizeModelFit, startAnim, stopAnim, discoverModel, RESOLUTION, modelRefW, modelRefH } from '@frankenstein/renderer-live2d'
import type { DeskpetMessage } from '@frankenstein/shared'
import type { Application } from '@pixi/app'
import type { Live2DModel } from 'pixi-live2d-display/cubism4'
import type { Cubism4ModelSettings } from 'pixi-live2d-display/cubism4'

const store = useCompanionStore()
const gateway = new MaiBotGateway()

const stageRef = ref<HTMLDivElement>()
const inputRef = ref<HTMLInputElement>()
const inputText = ref('')
const showInput = ref(false)
const isHovered = ref(false)
const modelError = ref('')

let app: Application | null = null
let model: Live2DModel<Cubism4ModelSettings> | null = null
let animFrameId = 0
let lastW = 0
let lastH = 0
let lastZoom = 1.0
let modelZoom = ref(1.0)
let mouseX = 300
let mouseY = 400
let dragOffsetX = 0
let dragOffsetY = 0
let dragActive = false
let dragStartX = 0
let dragStartY = 0
let dragMoved = false
let lastWheelTime = 0

// ── Lifecycle ──

onMounted(async () => {
  const container = stageRef.value
  if (!container) return
  container.innerHTML = ''

  if (typeof (window as any).Live2DCubismCore === 'undefined') {
    modelError.value = '缺少 Cubism 4 运行时'
    return
  }

  const modelUrl = await discoverModel()
  if (!modelUrl) {
    modelError.value = '未找到 Live2D 模型'
    return
  }

  try {
    app = await createPixiApp(container, window.innerWidth, window.innerHeight)
    model = await loadModel(modelUrl, app)
    startAnim(model)
    modelZoom.value = 1.0
    lastW = window.innerWidth
    lastH = window.innerHeight

    const canvas = app.view as HTMLCanvasElement
    canvas.addEventListener('wheel', onWheel as any, { passive: false } as any)

    console.log('[Frankenstein] Live2D model loaded')
  } catch (err) {
    console.error('[Frankenstein] Failed to load model:', err)
    modelError.value = `模型加载失败: ${err}`
  }

  // Bridge ↔ Core wiring
  gateway.setHandlers(
    (msg: DeskpetMessage) => {
      const event = translateMessage(msg)
      switch (event.type) {
        case 'SPEECH_CHUNK':
          store.appendChatText(event.payload.delta, event.payload.request_id || '')
          break
        case 'SPEECH_END':
          if (!event.payload.error) {
            store.finishChatStream(event.payload.request_id || '')
            setTimeout(() => store.hideChatBubble(), 8000)
          }
          store.setTalkingState('idle')
          break
        case 'SPEECH_DIRECT':
          store.showChatMessage(event.payload.text)
          setTimeout(() => store.hideChatBubble(), 8000)
          break
        case 'EMOTION_SET':
          store.setEmotion(event.payload.emotion)
          break
        case 'ANIMATION_PLAY':
          store.setPendingAnimation(event.payload.name, event.payload.loop)
          break
        case 'THINKING_START':
          store.setTalkingState('thinking')
          break
      }
    },
    (connected) => { store.wsConnected = connected }
  )
  gateway.connect()

  startLoop()
  window.addEventListener('mousemove', onMouseMove)
})

onUnmounted(() => {
  stopAnim()
  if (animFrameId) cancelAnimationFrame(animFrameId)
  window.removeEventListener('mousemove', onMouseMove)
  gateway.disconnect()
  if (app) {
    const canvas = app.view as HTMLCanvasElement
    canvas.removeEventListener('wheel', onWheel as any)
    app.destroy(true, { children: true, texture: true })
    app = null
  }
  model = null
})

// ── Emotion → Motion ──

watch(() => store.emotion, (emotion) => {
  if (!model || emotion === 'neutral' || emotion === 'idle') return
  const EMOTION_TO_MOTION: Record<string, string> = {
    happy: 'Happy', sad: 'Sad', angry: 'Angry', surprise: 'Surprise',
    thinking: 'Think', shy: 'Awkward', curious: 'Curious',
  }
  const motion = EMOTION_TO_MOTION[emotion]
  if (motion) playMotion(model, motion)
})

// ── Loop ──

function startLoop() {
  const tick = () => {
    if (model) {
      const cw = window.innerWidth
      const ch = window.innerHeight
      if (cw !== lastW || ch !== lastH) {
        app!.renderer.resize(cw * RESOLUTION, ch * RESOLUTION)
        app!.stage.scale.set(RESOLUTION)
        lastW = cw; lastH = ch
        resizeModelFit(model, cw, ch, modelZoom.value)
      }
      if (modelZoom.value !== lastZoom) {
        lastZoom = modelZoom.value
        resizeModel(model, cw, ch, modelZoom.value)
      }
      if (dragOffsetX !== 0 || dragOffsetY !== 0) {
        model.position.x += dragOffsetX
        model.position.y += dragOffsetY
        dragOffsetX = 0; dragOffsetY = 0
        const vw = modelRefW * model.scale.x
        const vh = modelRefH * model.scale.y
        model.position.x = Math.max(-vw * 0.8, Math.min(cw + vw * 0.8, model.position.x))
        model.position.y = Math.max(-vh * 0.8, Math.min(ch + vh * 0.8, model.position.y))
      }
      try { model.focus(mouseX, mouseY) } catch { /* no focus support */ }
    }
    // pending animation
    const pending = store.consumePendingAnimation()
    if (pending && model) playMotion(model, pending.name)
    animFrameId = requestAnimationFrame(tick)
  }
  animFrameId = requestAnimationFrame(tick)
}

// ── Input ──

function onDoubleClick() {
  showInput.value = true
  setTimeout(() => inputRef.value?.focus(), 50)
}

function sendText() {
  const text = inputText.value.trim()
  if (!text) return
  store.setTalkingState('thinking')
  store.touch()
  gateway.send('input:text', { text })
  inputText.value = ''
  showInput.value = false
}

function onMouseMove(e: MouseEvent) { mouseX = e.clientX; mouseY = e.clientY }

function onMouseDown(e: MouseEvent) {
  dragStartX = e.clientX; dragStartY = e.clientY
  dragMoved = false; dragActive = true
  const onMove = (ev: MouseEvent) => {
    if (!dragActive) return
    const dx = ev.clientX - dragStartX, dy = ev.clientY - dragStartY
    if (!dragMoved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return
    dragMoved = true
    dragOffsetX += dx; dragOffsetY += dy
    dragStartX = ev.clientX; dragStartY = ev.clientY
  }
  const onUp = () => {
    dragActive = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  if (!model) return
  const now = performance.now()
  if (now - lastWheelTime < 50) return
  lastWheelTime = now
  const factor = e.deltaY > 0 ? 0.92 : 1.08
  const newZoom = Math.max(0.15, Math.min(20.0, modelZoom.value * factor))
  resizeModel(model, window.innerWidth, window.innerHeight, newZoom, mouseX, mouseY)
  modelZoom.value = newZoom
  lastZoom = newZoom
}
</script>

<style scoped>
.deskpet-stage {
  width: 100vw; height: 100vh;
  position: relative;
  -webkit-app-region: no-drag;
  user-select: none;
}
.live2d-stage { width: 100%; height: 100%; display: block; }

.chat-bubble {
  position: absolute; top: 10%; left: 50%; transform: translateX(-50%);
  max-width: 80%;
  background: rgba(255,255,255,0.92); backdrop-filter: blur(8px);
  border-radius: 16px; padding: 12px 18px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
  z-index: 10; pointer-events: none;
  -webkit-app-region: no-drag;
}
.bubble-content { font-size: 14px; line-height: 1.5; color: #333; word-break: break-word; }
.bubble-cursor { animation: blink 0.8s infinite; color: #666; }
@keyframes blink { 0%,50%{opacity:1} 51%,100%{opacity:0} }

.quick-input {
  position: absolute; bottom: 15%; left: 50%; transform: translateX(-50%);
  z-index: 20; min-width: 200px;
  -webkit-app-region: no-drag;
}
.input-field {
  width: 100%; padding: 10px 16px;
  border: 1px solid rgba(255,255,255,0.5); border-radius: 20px;
  background: rgba(255,255,255,0.9); backdrop-filter: blur(8px);
  font-size: 14px; outline: none; color: #333;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
  -webkit-app-region: no-drag;
}
.input-field::placeholder { color: #aaa; }

.nav-bar {
  position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%);
  width: 160px; height: 30px;
  -webkit-app-region: drag;
  border-radius: 15px; background: rgba(255,255,255,0.7);
  z-index: 50; cursor: move;
}

.bubble-fade-enter-active, .bubble-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.bubble-fade-enter-from, .bubble-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }
.input-fade-enter-active, .input-fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.input-fade-enter-from, .input-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(20px); }
</style>
