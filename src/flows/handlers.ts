import { buildLeadCode, buildWhatsAppLink, regionsKeyboard, servicesKeyboard } from './chat-helpers.js'
import TelegramBot from 'node-telegram-bot-api'
import { Lead, Status } from './models.js'

import { appendLeadRespectingHeaders, updateTelegramChatIdForLead } from '../services/leads.js'

import { getEnvironment } from '../environment.js'

import { notifyAdmin } from '../services/admin.js'

import { PHONE_CC_QUICK_KEYBOARD, WELCOME_KEYBOARD } from '../ui/keyboards.js'

import { titleCase, normalizeInternationalPhone, splitFirstLast } from './utils.js'

import { getBatch, updateCell } from '../infra/sheets.js'

const environment = await getEnvironment()

export enum STEP {
  IDLE = 'idle',
  ASK_NAME_FULL = 'ask_name_full',
  ASK_INTEREST_SERVICES = 'ask_interest_services',
  SELECT_REGIONS = 'select_regions',
  ASK_EMAIL = 'ask_email',
  ASK_PHONE = 'ask_phone',
  ASK_ANNUAL_INCOME = 'ask_annual_income',
  SHOW_SUMMARY = 'show_summary',
  FINALIZING = 'finalizing',
}

export function executeActionBasedOnCurrentStep(
  step: STEP,
  bot: TelegramBot,
  msg: TelegramBot.Message,
) {
  const mapStepToAction: Record<STEP, () => void> = {
    [STEP.IDLE]: (): void => {
      bot.sendMessage(msg.chat.id, 'Gostaria de começar?', WELCOME_KEYBOARD)
    },
    [STEP.ASK_NAME_FULL]: (): void => {
      if (!msg.text) {
        return
      }
      const name = msg.text.trim()
      if (!name.includes(' ')) {
        bot.sendMessage(msg.chat.id, 'Por favor, envie nome e sobrenome')
        return
      }
      const { first, last } = splitFirstLast(name)
      setDraft({ name: `${first} ${last}` }, msg.chat.id)
      setCurrentStep(STEP.ASK_INTEREST_SERVICES, msg.chat.id)
      bot.sendMessage(
        msg.chat.id,
        `É um prazer falar com você, ${titleCase(first)} ${titleCase(last)}.\nSelecione os serviços de interesse:`,
        servicesKeyboard([]),
      )
    },
    [STEP.ASK_INTEREST_SERVICES]: (): void => {
      bot.sendMessage(
        msg.chat.id,
        'Selecione os serviços de interesse (pode escolher vários):',
        servicesKeyboard(getDraft(msg.chat.id).draft.interest_services || []),
      )
    },
    [STEP.SELECT_REGIONS]: (): void => {
      bot.sendMessage(
        msg.chat.id,
        'Selecione as regiões de interesse (pode escolher várias):',
        regionsKeyboard(getDraft(msg.chat.id).draft.interest_regions || []),
      )
    },
    [STEP.ASK_EMAIL]: (): void => {
      const email = (msg.text || '').trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        bot.sendMessage(msg.chat.id, 'Esse email não parece válido. Tente novamente')
        return
      }
      setDraft({ email: email.toLowerCase() }, msg.chat.id)
      setCurrentStep(STEP.ASK_PHONE, msg.chat.id)
      bot.sendMessage(msg.chat.id, 'Qual é o código telefônico do seu país?', PHONE_CC_QUICK_KEYBOARD)
    },
    [STEP.ASK_PHONE]: (): void => {
      const raw = (msg.text || '').trim()
      if (/^\+?\d{6,}$/.test(raw.replace(/\s+/g, ''))) {
        const ccFromDraft = (getDraft(msg.chat.id).draft.phoneCountryCode || '').toString()
        const normalized = normalizeInternationalPhone(ccFromDraft, raw)
        if (!normalized) {
          bot.sendMessage(msg.chat.id, 'Hum... Esse não me parece um número válido, poderia tentar novamente?')
          return
        }
        setDraft({ phone: normalized }, msg.chat.id)
        setCurrentStep(STEP.ASK_ANNUAL_INCOME, msg.chat.id)
        bot.sendMessage(msg.chat.id, 'Qual é a sua renda anual aproximada?')
        return
      }

      if (/portugal/i.test(raw)) {
        setDraft({ phoneCountryCode: 351 }, msg.chat.id)
        bot.sendMessage(msg.chat.id, 'Agora apenas o número (sem o +351)')
        return
      }
      if (/brasil/i.test(raw)) {
        setDraft({ phoneCountryCode: 55 }, msg.chat.id)
        bot.sendMessage(msg.chat.id, 'Agora apenas o número (sem o +55)')
        return
      }
      if (/outro país|outros|outro/i.test(raw)) {
        bot.sendMessage(msg.chat.id, 'Indique apenas os dígitos do indicativo (ex.: 34, 49, 1)')
        return
      }
      const cc = raw.replace(/\D+/g, '')
      if (!cc) {
        bot.sendMessage(msg.chat.id, 'Envie o indicativo apenas com dígitos (ex.: 351, 55)')
        return
      }
      setDraft({ phoneCountryCode: cc }, msg.chat.id)
      bot.sendMessage(msg.chat.id, 'Agora apenas o número (sem o código do país)')
    },
    [STEP.ASK_ANNUAL_INCOME]: (): void => {
      const income = (msg.text || '').trim()
      if (!income) {
        bot.sendMessage(msg.chat.id, 'Informe um valor para continuarmos')
        return
      }
      setDraft({ annual_income: income }, msg.chat.id)
      setCurrentStep(STEP.SHOW_SUMMARY, msg.chat.id)
      showSummary(bot, msg.chat.id)
    },
    [STEP.SHOW_SUMMARY]: (): void => {
      showSummary(bot, msg.chat.id)
    },
    [STEP.FINALIZING]: (): void => {
      bot.sendMessage(msg.chat.id, 'Um momento…')
    },
  }
  return mapStepToAction[step]()
}
// ---------------------------------------------------------------------------
// Helpers locais
// ---------------------------------------------------------------------------
function toCsv(values?: string[] | string): string {
  if (Array.isArray(values)) return values.join(', ')
  return (values || '').toString()
}
function getDraft(chatId: TelegramBot.ChatId) {
  return SESSION.get(chatId) || { step: 'idle', draft: {} }
}

function showSummary(bot: TelegramBot, chatId: TelegramBot.ChatId) {
  const { draft } = getDraft(chatId)
  const summary =
    `Revise os dados abaixo:\n\n` +
    `Nome: ${draft.name || '-'}\n` +
    `Email: ${draft.email || '-'}\n` +
    `Telefone: ${draft.phone || '-'}\n` +
    `Serviços: ${toCsv(draft.interest_services || [])}\n` +
    `Regiões: ${toCsv(draft.interest_regions || [])}\n` +
    `Rendimento anual: ${draft.annual_income || '-'}`

  const inlineKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Confirmar', callback_data: 'confirm_lead' },
          { text: 'Editar algo', callback_data: 'edit_lead' },
        ],
      ],
    },
  }

  bot.sendMessage(chatId, summary, inlineKeyboard)
}

// ---------------------------------------------------------------------------
/** Sessão simples em memória */
// ---------------------------------------------------------------------------
const SESSION = new Map()
function initSession(chatId?: TelegramBot.ChatId) {
  if (!chatId) return
  SESSION.set(chatId, { step: 'idle', draft: {} })
}
function setCurrentStep(step: STEP, chatId: TelegramBot.ChatId) {
  if (!chatId) return
  const s = SESSION.get(chatId) || { step: 'idle', draft: {} }
  s.step = step
  SESSION.set(chatId, s)
}
function setDraft(patch: any, chatId: TelegramBot.ChatId) {
  if (!chatId) return
  const s = SESSION.get(chatId) || { step: 'idle', draft: {} }
  s.draft = { ...s.draft, ...patch }
  SESSION.set(chatId, s)
  return s.draft
}

async function finalizeLead(bot: TelegramBot, chatId: TelegramBot.ChatId) {
  const s = getDraft(chatId)

  if (s.saving) return // já a gravar
  SESSION.set(chatId, { ...s, saving: true })

  try {
    const draft: Lead & { interest_services?: string[]; interest_regions?: string[] } = s.draft || {}
    const regionsCsv = toCsv(draft.interest_regions)
    const servicesCsv = toCsv(draft.interest_services)

    const code: string = draft.code || buildLeadCode(regionsCsv)

    if (!draft.code) setDraft({ code }, chatId)

    const lead: Lead = {
      code,
      name: draft.name || '',
      email: draft.email || '',
      phone: draft.phone || '',
      interest_services: servicesCsv,
      interest_regions: regionsCsv,
      annual_income: draft.annual_income || '',
      created_at: new Date().toISOString(),
      created_at_unix: Date.now(),
      status: Status.NOVO,
    }

    await appendLeadRespectingHeaders(lead)

    await notifyAdmin(
      bot,
      `📝 Lead salvo em Google Sheet\n` +
        `Código: ${lead.code}\n` +
        `Nome: ${titleCase(lead.name)}\n` +
        `Serviços: ${lead.interest_services}\n` +
        `Regiões: ${lead.interest_regions}\n` +
        `Email: ${lead.email}\n` +
        `Telefone: ${lead.phone}\n` +
        `Rendimento: ${lead.annual_income}\n` +
        `Criado em: ${lead.created_at}`,
    )

    const waLink = buildWhatsAppLink(lead)

    const inlineKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Notifique-me também pelo Telegram', callback_data: 'subscribe_alerts' }],
          ...(waLink ? [[{ text: 'Falar com consultor (WhatsApp)', url: waLink }]] : []),
        ],
      },
    }

    await bot.sendMessage(
      chatId,
      'Obrigado! Avisaremos quando houver casas disponíveis',
      inlineKeyboard,
    )
    setCurrentStep(STEP.IDLE, chatId)
  } catch (e) {
    console.error('finalizeLead error:', e)
    setCurrentStep(STEP.IDLE, chatId) // não fica preso em finalizing
    await bot.sendMessage(chatId, 'Ocorreu um erro ao guardar. Tente novamente com /start')
  } finally {
    const cur = SESSION.get(chatId) || {}
    delete cur.saving
    SESSION.set(chatId, cur)
  }
}

// ---------------------------------------------------------------------------
// Check dos “fechados” (admin)
// ---------------------------------------------------------------------------
async function checkClosedLeads(bot: TelegramBot): Promise<void> {
  if (!environment.secrets.telegramAdminChatId) return

  // A (code), B (name), C (email), D (phone), E (interest_services), F (regions), G (created_at),
  // I (status), K (closed_notified_at)
  const ranges = [
    'Leads!A2:A', // 0 code
    'Leads!B2:B', // 1 name
    'Leads!C2:C', // 2 email
    'Leads!D2:D', // 3 phone
    'Leads!E2:E', // 4 interest_services
    'Leads!F2:F', // 5 regions
    'Leads!G2:G', // 6 created_at
    'Leads!I2:I', // 7 status
    'Leads!K2:K', // 8 closed_notified_at
  ]

  const [
    colCode,
    colName,
    colEmail,
    colPhone,
    colInterest,
    colRegions,
    colCreatedAt,
    colStatus,
    colNotifiedAt,
  ] = await getBatch(ranges)

  const totalRows = Math.max(
    colCode?.length ?? 0,
    colName?.length ?? 0,
    colEmail?.length ?? 0,
    colPhone?.length ?? 0,
    colInterest?.length ?? 0,
    colRegions?.length ?? 0,
    colCreatedAt?.length ?? 0,
    colStatus?.length ?? 0,
    colNotifiedAt?.length ?? 0,
  )

  for (let i = 0; i < totalRows; i++) {
    const code = (colCode?.[i]?.[0] || '').trim()
    const name = (colName?.[i]?.[0] || '').trim()
    const email = (colEmail?.[i]?.[0] || '').trim()
    const phone = (colPhone?.[i]?.[0] || '').trim()
    const regions = (colRegions?.[i]?.[0] || '').trim()
    const created = (colCreatedAt?.[i]?.[0] || '').trim()
    const status = (colStatus?.[i]?.[0] || '').toLowerCase().trim()
    const notified = (colNotifiedAt?.[i]?.[0] || '').trim()

    if (!code) continue

    if (status === 'fechado' && !notified) {
      await notifyAdmin(
        bot,
        `🏁 Lead FECHADO\n` +
          `Código: ${code}\n` +
          `Nome: ${titleCase(name)}\n` +
          `Regiões: ${regions}\n` +
          `Email: ${email}\n` +
          `Telefone: ${phone}\n` +
          `Criado em: ${created}`,
        async () => {
          const rowNumber = i + 2 // A2 => i=0
          const when = new Date().toISOString()
          await updateCell(`Leads!K${rowNumber}`, when)
        },
      )
    }
  }
}

let _closedWatcher: NodeJS.Timeout | null = null
export function startClosedWatcher(bot: TelegramBot): NodeJS.Timeout {
  if (_closedWatcher) clearInterval(_closedWatcher)
  _closedWatcher = setInterval(
    () => {
      checkClosedLeads(bot).catch(err =>
        console.error('Erro no verificador de fechados:', err?.message || err),
      )
    },
    60 * 60 * 1000 * 5,
  )
  return _closedWatcher
}
export function stopClosedWatcher(): void {
  if (_closedWatcher) clearInterval(_closedWatcher)
  _closedWatcher = null
}

async function initInitialMessage(bot: TelegramBot, chatId: TelegramBot.ChatId) {
  initSession(chatId)

  await bot.sendMessage(
    chatId,
    'Bem-vindo(a) à Portugal Houses Arrendamentos!\n\nPara avisarmos sobre casas disponíveis, precisaremos do seu contacto',
  )
  setCurrentStep(STEP.ASK_NAME_FULL, chatId)

  return bot.sendMessage(chatId, 'Para começarmos, como se chama? Escreva nome e sobrenome')
}

export function attachHandlers(bot: TelegramBot) {
  bot.onText(/^\/start(?:\s+(.+))?$/, async msg => {
    return initInitialMessage(bot, msg.chat.id)
  })

  bot.on('message', async msg => {
    if (!msg.text || msg.text.startsWith('/')) return
    const chatId = msg.chat.id
    if (!SESSION.has(chatId)) initSession(chatId)
    const { step } = SESSION.get(chatId)

    if (/^começar$/i.test(msg.text)) {
      return initInitialMessage(bot, msg.chat.id)
    }

    if (/^comecar$/i.test(msg.text)) {
      return initInitialMessage(bot, msg.chat.id)
    }

    if (/^cancelar$/i.test(msg.text)) {
      initSession(chatId)
      return bot.sendMessage(chatId, 'Entendido! Quando quiser, basta escrever "Começar" ou /start')
    }

    if (/^reiniciar$/i.test(msg.text)) {
      return initInitialMessage(bot, msg.chat.id)
    }

    if (/^continuar$/i.test(msg.text)) {
      const s = SESSION.get(chatId)
      if (!s?.draft?.name) {
        setCurrentStep(STEP.ASK_NAME_FULL, chatId)
        return bot.sendMessage(chatId, 'Para começarmos, como se chama? Escreva nome e sobrenome')
      }

      if (!s?.draft?.interest_services?.length) {
        setCurrentStep(STEP.ASK_INTEREST_SERVICES, chatId)
        return bot.sendMessage(
          chatId,
          'Selecione os serviços de interesse (pode escolher vários):',
          servicesKeyboard([]),
        )
      }

      if (!s?.draft?.interest_regions?.length) {
        setCurrentStep(STEP.SELECT_REGIONS, chatId)
        return bot.sendMessage(
          chatId,
          'Selecione as regiões de interesse (pode escolher várias):',
          regionsKeyboard([]),
        )
      }
      if (!s?.draft?.email) {
        setCurrentStep(STEP.ASK_EMAIL, chatId)
        return bot.sendMessage(chatId, 'Para qual email enviaremos o aviso?')
      }
      if (!s?.draft?.phone) {
        setCurrentStep(STEP.ASK_PHONE, chatId)
        return bot.sendMessage(chatId, 'Qual é o indicativo do seu país?', PHONE_CC_QUICK_KEYBOARD)
      }
      if (!s?.draft?.annual_income) {
        setCurrentStep(STEP.ASK_ANNUAL_INCOME, chatId)
        return bot.sendMessage(chatId, 'Qual é a sua renda anual aproximada?')
      }

      setCurrentStep(STEP.SHOW_SUMMARY, chatId)
      return showSummary(bot, chatId)
    }

    try {
      executeActionBasedOnCurrentStep(step, bot, msg)
    } catch (err) {
      console.error('Erro no handler:', err)
      await bot.sendMessage(chatId, 'Ocorreu um erro. Tente novamente com /start')
      initSession(chatId)
    }
  })

  bot.on('callback_query', async query => {
    const chatId = query.message?.chat.id as TelegramBot.ChatId
    const s = SESSION.get(chatId) || initSession(chatId)
    const data = query.data || ''
    const [action, payload] = data.split(':')

    try {
      if (data === 'subscribe_alerts') {
        await bot.answerCallbackQuery(query.id, { text: 'Subscrição registada!' })
        const updated = await updateTelegramChatIdForLead((s as any)?.draft?.code, chatId)
        if (updated)
          return bot.sendMessage(
            chatId,
            'Irá receber avisos por este chat assim que surgirem novas casas',
          )
        return bot.sendMessage(
          chatId,
          'Não encontrei o seu registo para associar a subscrição. Tente novamente com /start',
        )
      }

      if (data === 'confirm_lead') {
        setCurrentStep(STEP.FINALIZING, chatId)
        await bot.answerCallbackQuery(query.id)
        return finalizeLead(bot, chatId)
      }

      if (data === 'edit_lead') {
        await bot.answerCallbackQuery(query.id, { text: 'Vamos editar os dados' })
        setCurrentStep(STEP.ASK_NAME_FULL, chatId)
        return bot.sendMessage(chatId, 'Certo, vamos recomeçar. Como se chama?')
      }

      if (action === 'service_toggle') {
        const opt = payload
        const current = (SESSION.get(chatId)?.draft?.interest_services || []).slice()
        const idx = current.indexOf(opt)
        if (idx >= 0) current.splice(idx, 1)
        else current.push(opt)
        setDraft({ interest_services: current }, chatId)
        await bot.answerCallbackQuery(query.id, {
          text: `${titleCase(opt || '')} ${idx >= 0 ? 'removido' : 'adicionado'}`,
        })
        return bot.editMessageReplyMarkup(servicesKeyboard(current).reply_markup, {
          chat_id: chatId,
          message_id: query.message?.message_id,
        })
      }

      if (action === 'service_cancel') {
        await bot.answerCallbackQuery(query.id, { text: 'Seleção cancelada' })
        const current = SESSION.get(chatId)?.draft?.interest_services || []
        return bot.sendMessage(chatId, 'Ok. Pode selecionar novamente:', servicesKeyboard(current))
      }

      if (action === 'service_done') {
        await bot.answerCallbackQuery(query.id)
        const selected = (s as any)?.draft?.interest_services || []
        if (!selected.length) {
          return bot.sendMessage(
            chatId,
            'Selecione pelo menos um serviço',
            servicesKeyboard(selected),
          )
        }
        setCurrentStep(STEP.SELECT_REGIONS, chatId)
        return bot.sendMessage(chatId, 'Agora selecione as regiões de interesse:', regionsKeyboard([]))
      }

      if (action === 'region_toggle') {
        const opt = payload
        const current = (SESSION.get(chatId)?.draft?.interest_regions || []).slice()
        const idx = current.indexOf(opt)
        if (idx >= 0) current.splice(idx, 1)
        else current.push(opt)
        setDraft({ interest_regions: current }, chatId)
        await bot.answerCallbackQuery(query.id, {
          text: `${titleCase(opt?.replace('-', ' ') || '')} ${idx >= 0 ? 'removida' : 'adicionada'}`,
        })
        return bot.editMessageReplyMarkup(regionsKeyboard(current).reply_markup, {
          chat_id: chatId,
          message_id: query.message?.message_id,
        })
      }

      if (action === 'region_cancel') {
        await bot.answerCallbackQuery(query.id, { text: 'Seleção cancelada' })
        const current = SESSION.get(chatId)?.draft?.interest_regions || []
        return bot.sendMessage(chatId, 'Ok. Pode selecionar novamente:', regionsKeyboard(current))
      }

      if (action === 'region_done') {
        await bot.answerCallbackQuery(query.id)
        const selected = (s as any)?.draft?.interest_regions || []
        if (!selected.length) {
          return bot.sendMessage(
            chatId,
            'Selecione pelo menos uma região',
            regionsKeyboard(selected),
          )
        }
        setCurrentStep(STEP.ASK_EMAIL, chatId)
        return bot.sendMessage(chatId, 'Para qual email enviaremos o aviso?')
      }
    } catch (err) {
      console.error('Erro no callback_query:', err)
      await bot.answerCallbackQuery(query.id, { text: 'Erro. Tente de novo' })
    }
  })

  bot.onText(/^\/whoami$/, msg => {
    bot.sendMessage(msg.chat.id, `O seu chat id é: ${msg.chat.id}`)
  })

  bot.on('polling_error', err => {
    console.error('Polling error:', err?.message || err)
  })
}
