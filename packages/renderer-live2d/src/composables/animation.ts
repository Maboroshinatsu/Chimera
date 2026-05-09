import type { Live2DModel } from 'pixi-live2d-display/cubism4'
import type { Cubism4ModelSettings } from 'pixi-live2d-display/cubism4'

interface AnimState {
  blinkTimer: ReturnType<typeof setTimeout> | null
  nextBlinkAt: number
  breathFrameId: number
}

const state: AnimState = {
  blinkTimer: null,
  nextBlinkAt: 0,
  breathFrameId: 0,
}

let enabled = true

export function startAnim(model: Live2DModel<Cubism4ModelSettings>) {
  scheduleBlink(model)
  startBreath(model)
}

export function stopAnim() {
  if (state.blinkTimer) {
    clearTimeout(state.blinkTimer)
    state.blinkTimer = null
  }
  if (state.breathFrameId) {
    cancelAnimationFrame(state.breathFrameId)
    state.breathFrameId = 0
  }
}

function scheduleBlink(model: Live2DModel<Cubism4ModelSettings>) {
  if (!enabled) return
  const interval = 2000 + Math.random() * 5000
  state.blinkTimer = setTimeout(() => executeBlink(model), interval)
}

function executeBlink(model: Live2DModel<Cubism4ModelSettings>) {
  const core = model.internalModel.coreModel
  core.setParameterValueById('ParamEyeLOpen', 0)
  core.setParameterValueById('ParamEyeROpen', 0)
  setTimeout(() => {
    core.setParameterValueById('ParamEyeLOpen', 1)
    core.setParameterValueById('ParamEyeROpen', 1)
    scheduleBlink(model)
  }, 75)
}

function startBreath(model: Live2DModel<Cubism4ModelSettings>) {
  const core = model.internalModel.coreModel
  const start = performance.now()
  const tick = () => {
    const elapsed = (performance.now() - start) / 1000
    core.setParameterValueById('ParamBreath', Math.sin(elapsed * 1.2) * 0.3)
    state.breathFrameId = requestAnimationFrame(tick)
  }
  state.breathFrameId = requestAnimationFrame(tick)
}
