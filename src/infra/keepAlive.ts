import { getEnvironment } from '../environment.js'

const environment = await getEnvironment()

export function startKeepAlive(intervalMs = 12 * 60 * 1000) {
  // ~12 min
  if (!environment.secrets.appBaseUrl) {
    console.warn('KeepAlive: APP_BASE_URL ausente, keepalive inativo.')
    return { stop() {} }
  }

  let timer = setInterval(async () => {
    try {
      const url = `${environment.secrets.appBaseUrl.replace(/\/+$/, '')}/health`
      await fetch(url, { cache: 'no-store' })
      // console.log('KeepAlive ping ->', url);
    } catch (_) {
      // silencioso: não queremos crashar o processo por causa de ping
    }
  }, intervalMs)

  console.log('KeepAlive ativo, a pingar')
  return {
    stop() {
      clearInterval(timer)
    },
  }
}
