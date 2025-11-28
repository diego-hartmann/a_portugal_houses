import TelegramBot from 'node-telegram-bot-api'
import { LeadPayload, ConsultantProfile } from '../lead-models/lead.js'
import { RuntimeConfig } from '../utils/env.js'
import { logger } from '../utils/logger.js'

export class NotificationService {
  private bot: TelegramBot

  constructor(private readonly config: RuntimeConfig) {
    const token = config.telegram_bot_token || config.local_telegram_bot_token || ''
    if (!token) throw new Error('Telegram bot token missing from .ENV sheet')
    this.bot = new TelegramBot(token, { polling: false })
  }

  async notifyAdminNewLead(lead: LeadPayload, sheetName: string): Promise<void> {
    const chatId = this.config.TELEGRAM_ADMIN_CHAT_ID || this.config.telegram_admin_chat_id
    if (!chatId) return
    const message = `Novo lead capturado\nID: ${lead.id}\nNome: ${lead.name}\nSheet: ${sheetName}`
    await this.bot.sendMessage(chatId, message)
  }

  async notifyAdminClosed(lead: LeadPayload): Promise<void> {
    const chatId = this.config.TELEGRAM_ADMIN_CHAT_ID || this.config.telegram_admin_chat_id
    if (!chatId) return
    await this.bot.sendMessage(chatId, `Lead convertido!!\nID: ${lead.id}\nNome: ${lead.name}`)
  }

  async notifyConsultantClosed(lead: LeadPayload, consultant: ConsultantProfile): Promise<void> {
    if (!consultant.notify_on_close) return
    const message = `Lead fechado! ID: ${lead.id}, Nome: ${lead.name}`
    await this.bot.sendMessage(consultant.id, message)
  }

  async notifyConsultantDeletion(consultant: ConsultantProfile, leadId: string, sheetName: string): Promise<void> {
    const message = `Ops! Parece que você deletou um lead cujo status era "closed".\nID: ${leadId}\nSheet: ${sheetName}`
    await this.bot.sendMessage(consultant.id, message)
  }
}
