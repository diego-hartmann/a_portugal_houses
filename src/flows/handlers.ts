import { buildLeadCode, buildWhatsAppLink, regionsKeyboard } from './chat-helpers.js'
import TelegramBot from 'node-telegram-bot-api'
import { Interest, Lead, Status } from './models.js'

import { appendLeadRespectingHeaders, updateTelegramChatIdForLead } from '../services/leads.js'

import { TELEGRAM_ADMIN_CHAT_ID, MILLISECONDS_FOR_1_HOUR } from '../config/env.js'

import { notifyAdmin } from '../services/admin.js'

import { INTEREST_KEYBOARD, PHONE_CC_QUICK_KEYBOARD, WELCOME_KEYBOARD } from '../ui/keyboards.js'

import { titleCase, normalizeInternationalPhone, splitFirstLast } from './utils.js'

import { getBatch, updateCell } from '../infra/sheets.js'

// ---------------------------------------------------------------------------
// Helpers locais
// ---------------------------------------------------------------------------
function toRegionsCsv(regs?: string[] | string): string {
  if (Array.isArray(regs)) return regs.join(', ')
  return (regs || '').toString()
}
function getDraft(chatId: TelegramBot.ChatId) {
  return SESSION.get(chatId) || { step: 'idle', draft: {} }
}

// TODO extract
const stepsInOrder: ((bot: TelegramBot, text: TelegramBot.Message) => void)[] = [
  function askFullName(bot: TelegramBot, msg: TelegramBot.Message): void {
    if (!msg.text) return

    const name = msg.text.trim()
    if (!name.includes(' ')) {
      bot.sendMessage(msg.chat.id, 'Por favor, envie nome e sobrenome')
      return
    }
    const { first, last } = splitFirstLast(name)
    setDraft({ name: `${first} ${last}` }, msg.chat.id)
    setStep('ask_interest', msg.chat.id)
    bot.sendMessage(
      msg.chat.id,
      `É um prazer falar com você, ${titleCase(first)} ${titleCase(last)}.\nNo que tem interesse: arrendar, comprar ou ambos?`,
      INTEREST_KEYBOARD,
    )
  },

  function askInterest(bot: TelegramBot, msg: TelegramBot.Message): void {
    if (!msg.text) return

    const interestRaw = msg.text.trim().toLowerCase() as Interest

    const allowed = {
      arrendar: 'arrendar',
      comprar: 'comprar',
      ambos: 'ambos',
    }

    if (!(allowed as any)[interestRaw]) {
      bot.sendMessage(
        msg.chat.id,
        'Escolha uma opção: Arrendar, Comprar ou Ambos',
        INTEREST_KEYBOARD,
      )
      return
    }
    setDraft({ interest: (allowed as any)[interestRaw], regions: [] }, msg.chat.id)
    setStep('select_regions', msg.chat.id)
    bot.sendMessage(
      msg.chat.id,
      'Selecione as regiões de interesse (pode escolher várias)',
      regionsKeyboard((allowed as any)[interestRaw] as Interest, []),
    )
  },

  function askEmail(bot: TelegramBot, msg: TelegramBot.Message): void {
    const email = (msg.text || '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      bot.sendMessage(msg.chat.id, 'Esse email não parece válido. Tente novamente')
      return
    }
    setDraft({ email: email.toLowerCase() }, msg.chat.id)
    setStep('ask_phone_country', msg.chat.id)
    bot.sendMessage(msg.chat.id, 'Qual é o código telefônico do seu país?', PHONE_CC_QUICK_KEYBOARD)
  },

  function askPhoneCountryCode(bot: TelegramBot, msg: TelegramBot.Message): void {
    const raw = (msg.text || '').trim()

    // atalhos por botão
    if (/portugal/i.test(raw)) {
      setDraft({ phoneCountryCode: 351 }, msg.chat.id)
      setStep('ask_phone_national', msg.chat.id)
      bot.sendMessage(msg.chat.id, 'Agora apenas o número (sem o +351)')
      return
    }
    if (/brasil/i.test(raw)) {
      setDraft({ phoneCountryCode: 55 }, msg.chat.id)
      setStep('ask_phone_national', msg.chat.id)
      bot.sendMessage(msg.chat.id, 'Agora apenas o número (sem o +55)')
      return
    }
    if (/outro país|outros|outro/i.test(raw)) {
      // pergunta aberta para dígitos do indicativo
      bot.sendMessage(msg.chat.id, 'Indique apenas os dígitos do indicativo (ex.: 34, 49, 1)')
      return
    }

    // também permitir que o utilizador já escreva só os dígitos
    const cc = raw.replace(/\D+/g, '')
    if (!cc) {
      bot.sendMessage(msg.chat.id, 'Envie o indicativo apenas com dígitos (ex.: 351, 55)')
      return
    }

    setDraft({ phoneCountryCode: cc }, msg.chat.id)
    setStep('ask_phone_national', msg.chat.id)
    bot.sendMessage(msg.chat.id, 'Agora apenas o número (sem o código do país)')
  },

  function askPhoneNational(bot: TelegramBot, msg: TelegramBot.Message): void {
    if (!msg.text) return

    bot.sendMessage(msg.chat.id, 'Validando número...')
    const s = SESSION.get(msg.chat.id)
    const cc = s?.draft?.phoneCountryCode || ''
    const normalized = normalizeInternationalPhone(cc, msg.text)
    if (!normalized) {
      bot.sendMessage(
        msg.chat.id,
        'Hum... Esse não me parece um número válido, poderia tentar novamente?',
      )
      return
    }

    setDraft({ phone: normalized }, msg.chat.id)
    setStep('finalizing', msg.chat.id)
    finalizeLead(bot, msg.chat.id) // agora consistente com regions CSV
    return
  },
  function finalizing(bot: TelegramBot, msg: TelegramBot.Message): void {
    bot.sendMessage(msg.chat.id, 'Um momento…')
  },
]

// ---------------------------------------------------------------------------
/** Sessão simples em memória */
// ---------------------------------------------------------------------------
const SESSION = new Map()
function initSession(chatId?: TelegramBot.ChatId) {
  if (!chatId) return
  SESSION.set(chatId, { step: 'idle', draft: {} })
}
function setStep(step: string, chatId?: TelegramBot.ChatId) {
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
    const draft: Lead = s.draft || {}
    const regionsCsv = toRegionsCsv(draft.regions)

    // se já gerámos code antes, não crie novo / evita duplicar
    const code: string = draft.code || buildLeadCode(draft.interest as Interest, regionsCsv)

    if (!draft.code) setDraft({ code }, chatId)

    const lead: Lead = {
      code,
      name: draft.name || '',
      email: draft.email || '',
      phone: draft.phone || '',
      interest: (draft.interest || '') as Interest,
      regions: regionsCsv, // <-- salva como string (CSV) para a Sheet
      created_at: new Date().toISOString(),
      status: Status.NOVO,
    }

    await appendLeadRespectingHeaders(lead)

    await notifyAdmin(
      bot,
      `📝 Lead salvo em Google Sheet\n` +
        `Código: ${lead.code}\n` +
        `Nome: ${titleCase(lead.name)}\n` +
        `Interesse: ${lead.interest}\n` +
        `Regiões: ${lead.regions}\n` +
        `Email: ${lead.email}\n` +
        `Telefone: ${lead.phone}\n` +
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
    setStep('idle', chatId)
  } catch (e) {
    console.error('finalizeLead error:', e)
    setStep('idle', chatId) // não fica preso em finalizing
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
  if (!TELEGRAM_ADMIN_CHAT_ID) return

  // A (code), B (name), C (email), D (phone), E (interest), F (regions), G (created_at),
  // I (status), K (closed_notified_at)
  const ranges = [
    'Leads!A2:A', // 0 code
    'Leads!B2:B', // 1 name
    'Leads!C2:C', // 2 email
    'Leads!D2:D', // 3 phone
    'Leads!E2:E', // 4 interest
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

  // usa o maior comprimento entre as colunas
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
    const interest = (colInterest?.[i]?.[0] || '').trim()
    const regions = (colRegions?.[i]?.[0] || '').trim()
    const created = (colCreatedAt?.[i]?.[0] || '').trim()
    const status = (colStatus?.[i]?.[0] || '').toLowerCase().trim()
    const notified = (colNotifiedAt?.[i]?.[0] || '').trim()

    if (!code) continue // linha vazia

    if (status === 'fechado' && !notified) {
      await notifyAdmin(
        bot,
        `🏁 Lead FECHADO\n` +
          `Código: ${code}\n` +
          `Nome: ${titleCase(name)}\n` +
          `Interesse: ${interest}\n` +
          `Regiões: ${regions}\n` +
          `Email: ${email}\n` +
          `Telefone: ${phone}\n` +
          `Criado em: ${created}`,
        async () => {
          // marca K (closed_notified_at) da linha i+2
          const rowNumber = i + 2 // A2 => i=0
          const when = new Date().toISOString()
          await updateCell(`Leads!K${rowNumber}`, when)
        },
      )
    }
  }
}

// arranque/paragem do watcher
let _closedWatcher: NodeJS.Timeout | null = null
export function startClosedWatcher(bot: TelegramBot): NodeJS.Timeout {
  if (_closedWatcher) clearInterval(_closedWatcher)
  _closedWatcher = setInterval(
    () => {
      checkClosedLeads(bot).catch(err =>
        console.error('Erro no verificador de fechados:', err?.message || err),
      )
    },
    Number(MILLISECONDS_FOR_1_HOUR) * 5,
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
    'Bem-vindo(a) à Portugal Houses!\n\nPara avisarmos sobre casas disponíveis, precisaremos do seu contacto.',
  )
  // Deep-link → avança imediatamente para o primeiro passo útil
  setStep('ask_name_full', chatId)
  return bot.sendMessage(chatId, 'Para começarmos, como se chama? Escreva nome e sobrenome.')
}

export function attachHandlers(bot: TelegramBot) {
  // aceitar /start e /start <payload> num único fluxo
  bot.onText(/^\/start(?:\s+(.+))?$/, async msg => {
    return initInitialMessage(bot, msg.chat.id)
  })

  // mensagens livres
  bot.on('message', async msg => {
    if (!msg.text || msg.text.startsWith('/')) return
    const chatId = msg.chat.id
    if (!SESSION.has(chatId)) initSession(chatId)
    const { step } = SESSION.get(chatId)

    // --- atalhos de welcome ---
    if (/^começar$/i.test(msg.text)) {
      return initInitialMessage(bot, msg.chat.id)
    }

    if (/^comecar$/i.test(msg.text)) {
      return initInitialMessage(bot, msg.chat.id)
    }

    if (/^cancelar$/i.test(msg.text)) {
      initSession(chatId)
      return bot.sendMessage(
        chatId,
        'Entendido! Quando quiser, basta escrever "Começar" ou /start.',
      )
    }

    // atalhos out of flow
    if (/^reiniciar$/i.test(msg.text)) {
      return initInitialMessage(bot, msg.chat.id)
    }

    if (/^continuar$/i.test(msg.text)) {
      const s = SESSION.get(chatId)
      // se não houver draft/step útil, cai para reinício
      if (!s?.draft?.name) {
        setStep('ask_name_full', chatId)
        return bot.sendMessage(chatId, 'Para começarmos, como se chama? Escreva nome e sobrenome')
      }
      // caso já tenha nome mas esteja parado, avança para o próximo passo lógico
      if (!s?.draft?.interest) {
        setStep('ask_interest', chatId)
        return bot.sendMessage(
          chatId,
          'No que teria interesse: arrendar, comprar ou ambos?',
          INTEREST_KEYBOARD,
        )
      }
      if (!s?.draft?.regions?.length) {
        setStep('select_regions', chatId)
        return bot.sendMessage(
          chatId,
          'Selecione as regiões de interesse (pode escolher várias)',
          regionsKeyboard(s.draft.interest, []),
        )
      }
      if (!s?.draft?.email) {
        setStep('ask_email', chatId)
        return bot.sendMessage(chatId, 'Para qual email enviaremos o aviso?')
      }
      if (!s?.draft?.phoneCountryCode) {
        setStep('ask_phone_country', chatId)
        return bot.sendMessage(chatId, 'Qual é o indicativo do seu país?', PHONE_CC_QUICK_KEYBOARD)
      }
      if (!s?.draft?.phoneNational) {
        setStep('ask_phone_national', chatId)
        return bot.sendMessage(chatId, 'Agora o seu número (apenas dígitos).')
      }

      // se tudo preenchido mas não finalizado
      setStep('finalizing', chatId)
      return finalizeLead(bot, chatId)
    }

    try {
      if (step === 'ask_name_full') {
        stepsInOrder[0]?.(bot, msg)
      }

      if (step === 'ask_interest') {
        stepsInOrder[1]?.(bot, msg)
      }

      if (step === 'ask_email') {
        stepsInOrder[2]?.(bot, msg)
      }

      if (step === 'ask_phone_country') {
        stepsInOrder[3]?.(bot, msg)
      }

      if (step === 'ask_phone_national') {
        stepsInOrder[4]?.(bot, msg)
      }

      if (step === 'finalizing') {
        stepsInOrder[5]?.(bot, msg)
      }

      if (step === 'idle') {
        return bot.sendMessage(chatId, 'Gostaria de começar?', WELCOME_KEYBOARD)
      }
    } catch (err) {
      console.error('Erro no handler:', err)
      await bot.sendMessage(chatId, 'Ocorreu um erro. Tente novamente com /start')
      initSession(chatId)
    }
  })

  // callbacks (regiões + subscrição)
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

      if (action === 'region_toggle') {
        const opt = payload
        const current = (SESSION.get(chatId)?.draft?.regions || []).slice()
        const idx = current.indexOf(opt)
        if (idx >= 0) current.splice(idx, 1)
        else current.push(opt)
        setDraft({ regions: current }, chatId)
        await bot.answerCallbackQuery(query.id, {
          text: `${titleCase(opt?.replace('-', ' '))} ${idx >= 0 ? 'removida' : 'adicionada'}`,
        })
        return bot.editMessageReplyMarkup(
          regionsKeyboard((s as any).draft.interest, current).reply_markup,
          {
            chat_id: chatId,
            message_id: query.message?.message_id,
          },
        )
      }

      if (action === 'region_cancel') {
        await bot.answerCallbackQuery(query.id, { text: 'Seleção cancelada' })
        const current = SESSION.get(chatId)?.draft?.regions || []
        return bot.sendMessage(
          chatId,
          'Ok. Pode selecionar novamente:',
          regionsKeyboard((s as any).draft.interest, current),
        )
      }

      if (action === 'region_done') {
        await bot.answerCallbackQuery(query.id)
        const selected = (s as any)?.draft?.regions || []
        if (!selected.length) {
          return bot.sendMessage(
            chatId,
            'Selecione pelo menos uma região',
            regionsKeyboard((s as any).draft.interest, selected),
          )
        }
        setStep('ask_email', chatId)
        return bot.sendMessage(chatId, 'Para qual email enviaremos o aviso?')
      }
    } catch (err) {
      console.error('Erro no callback_query:', err)
      await bot.answerCallbackQuery(query.id, { text: 'Erro. Tente de novo' })
    }
  })

  // util: /whoami
  bot.onText(/^\/whoami$/, msg => {
    bot.sendMessage(msg.chat.id, `O seu chat id é: ${msg.chat.id}`)
  })

  // erros
  bot.on('polling_error', err => {
    console.error('Polling error:', err?.message || err)
  })
}
