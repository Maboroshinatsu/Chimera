const MODEL_PATH = './models/hiyori_pro_zh/hiyori_pro_zh/runtime/hiyori_pro_t11.model3.json'

let cached: string | null = null

async function fileExists(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url, { method: 'HEAD' })
    return resp.ok
  } catch {
    return false
  }
}

export async function discoverModel(): Promise<string> {
  if (cached) return cached

  if (await fileExists(MODEL_PATH)) {
    cached = MODEL_PATH
    return cached
  }

  const names = ['hiyori_free', 'hiyori_pro', 'haru', 'mao', 'default', 'model', 'character', 'live2d']
  for (const name of names) {
    for (const ext of ['model3.json', 'moc3']) {
      const url = `../models/${name}/${name}.${ext}`
      if (await fileExists(url)) { cached = url; return cached }
    }
  }

  console.warn('[Discovery] No model found')
  return ''
}

export function clearModelCache() { cached = null }
