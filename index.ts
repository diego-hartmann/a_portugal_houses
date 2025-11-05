import { runWebserver } from './src/services/webserver.js'
runWebserver()

// --- KeepAlive (se estiveres a auto-pingar tua URL pública) ---
import { startKeepAlive } from './src/infra/keepAlive.js'
const keep = startKeepAlive()

// --- Bot + handlers ---
import { BOT, ensurePollingOnce } from './src/infra/bot.js'

import { attachHandlers, startClosedWatcher, stopClosedWatcher } from './src/flows/handlers.js'
;(async () => {
  await ensurePollingOnce() // <- limpa webhook e inicia UM polling
  attachHandlers(BOT)
  startClosedWatcher(BOT)
})()

// Polling errors: silencia 409 do handover e loga o resto
BOT.on('polling_error', err => {
  console.error('Polling error:', err?.message || err)
})

// --- Encerramento limpo (SIGINT/SIGTERM/erros não tratados) ---
let shuttingDown = false

async function stop(reason = 'desconhecido') {
  if (shuttingDown) return
  shuttingDown = true
  console.log('Encerrando… (' + reason + ')')

  try {
    await stopClosedWatcher()
  } catch (_) {}
  try {
    keep?.stop?.()
  } catch (_) {}
  try {
    await BOT.stopPolling()
  } catch (_) {}

  process.exit(0)
}

process.once('SIGINT', () => stop('SIGINT'))
process.once('SIGTERM', () => stop('SIGTERM'))

process.on('unhandledRejection', err => {
  console.error('unhandledRejection:', err)
  stop('unhandledRejection')
})
process.on('uncaughtException', err => {
  console.error('uncaughtException:', err)
  stop('uncaughtException')
})
