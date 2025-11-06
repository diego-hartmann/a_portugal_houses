import TelegramBot from 'node-telegram-bot-api'
import { Bot } from '../bot/index.js'

export class Notificator {
  private readonly _bot: Bot

  constructor(bot: Bot) {
    this._bot = bot
  }

  async notify(chatId: TelegramBot.ChatId, message: string, onFinally?: () => void) {
    try {
      await this._bot.telegramBot.sendMessage(Number(chatId), message)
      return { success: true }
    } catch (err) {
      console.log('Erro ao notificar:', err)
      return { success: false, error: err }
    } finally {
      if (onFinally) await onFinally()
    }
  }
}
