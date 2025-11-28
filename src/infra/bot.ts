// src/infra/bot.ts

import TelegramBot, { StartPollingOptions } from 'node-telegram-bot-api'
import { getEnvironment } from '../environment.js'

const environment = await getEnvironment()

// Cria o bot SEM polling automático
export const BOT: TelegramBot = new TelegramBot(environment.secrets.telegramBotToken, {
  polling: false,
})

let _started = false

export async function ensurePollingOnce(): Promise<void> {
  if (_started) return
  // Garante que não há webhook (evita 409 se houver um antigo pendurado)
  try {
    // typings antigos usam DeleteWebhookOptions; novas versões aceitam objeto com drop_pending_updates
    await BOT.deleteWebHook()
  } catch {
    // silencioso: se não houver webhook, está tudo bem
  }

  const pollingOpts: StartPollingOptions = {
    polling: { interval: 30 },
  }

  await BOT.startPolling(pollingOpts as any)

  _started = true
  console.log(`Bot iniciado em ${environment.runtime.env} (long polling)…`)
}
