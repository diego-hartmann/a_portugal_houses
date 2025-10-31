import TelegramBot from 'node-telegram-bot-api'

import { TELEGRAM_ADMIN_CHAT_ID } from '../config/env.js'

export async function notifyAdmin(bot: TelegramBot, message: string, onFinally?: () => void) {
  try {
    await bot.sendMessage(Number(TELEGRAM_ADMIN_CHAT_ID), message)
    return { success: true }
  } catch (err) {
    console.log('Erro ao notificar admin:', err)
    return { success: false, error: err }
  } finally {
    if (onFinally) await onFinally()
  }
}
