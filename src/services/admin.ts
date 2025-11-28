import TelegramBot from 'node-telegram-bot-api'
import { getEnvironment } from '../environment.js'

const environment = await getEnvironment()

export async function notifyAdmin(bot: TelegramBot, message: string, onFinally?: () => void) {
  try {
    await bot.sendMessage(Number(environment.secrets.telegramAdminChatId), message)
    return { success: true }
  } catch (err) {
    console.log('Erro ao notificar admin:', err)
    return { success: false, error: err }
  } finally {
    if (onFinally) await onFinally()
  }
}
