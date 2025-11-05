import { APP_BASE_URL } from '../config/env.js'

export function startKeepAlive(intervalMs = 12 * 60 * 1000) {
  // ~12 min
  if (!APP_BASE_URL) {
    console.warn('KeepAlive: APP_BASE_URL ausente, keepalive inativo.')
    return { stop() {} }
  }

  let timer = setInterval(async () => {
    try {
      const url = `${APP_BASE_URL.replace(/\/+$/, '')}/health`
      await fetch(url, { cache: 'no-store' })
      // console.log('KeepAlive ping ->', url);
    } catch (_) {
      // silencioso: não queremos crashar o processo por causa de ping
    }
  }, intervalMs)

  console.log('KeepAlive ativo, a pingar:', APP_BASE_URL)
  return {
    stop() {
      clearInterval(timer)
    },
  }
}
