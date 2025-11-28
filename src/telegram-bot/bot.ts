import TelegramBot from 'node-telegram-bot-api'
import { RuntimeConfig } from '../utils/env.js'
import { LeadRoutingEngine } from '../lead-routing/leadRoutingEngine.js'
import { ConsultantProfile, LeadPayload } from '../lead-models/lead.js'
import { ConsultantSheetRepository } from '../google-sheets/consultantSheetRepository.js'

export interface BotContext {
  engine: LeadRoutingEngine
  consultants: ConsultantProfile[]
  sheetRepoFactory: (sheetId: string) => ConsultantSheetRepository
}

export function createBot(config: RuntimeConfig, context: BotContext): TelegramBot {
  const token = config.telegram_bot_token || config.local_telegram_bot_token
  if (!token) throw new Error('Telegram token missing from .ENV')

  const bot = new TelegramBot(token, { polling: true })

  bot.onText(/\/start/, msg => {
    bot.sendMessage(msg.chat.id, 'Bem-vindo ao bot de leads Portugal Houses!')
  })

  bot.on('message', async msg => {
    if (!msg.text || msg.text.startsWith('/')) return
    const lead = parseLeadFromText(msg.text)
    if (!lead) return
    await context.engine.captureLead(lead, 'telegram', context.consultants, context.sheetRepoFactory)
  })

  return bot
}

function parseLeadFromText(text: string): LeadPayload | null {
  const parts = text.split('\n').map(p => p.trim())
  const idLine = parts.find(p => p.startsWith('ID:'))
  const nameLine = parts.find(p => p.startsWith('Nome:'))
  if (!idLine || !nameLine) return null
  const id = idLine.replace('ID:', '').trim()
  const name = nameLine.replace('Nome:', '').trim()
  return {
    id,
    status: 'novo',
    name,
    email: '',
    phone: '',
    interest_services: '',
    interest_regions: '',
    annual_income: '',
    created_at: new Date().toISOString(),
    created_at_unix: Math.floor(Date.now() / 1000),
    notes: '',
    close_status_identified_at: '',
  }
}
