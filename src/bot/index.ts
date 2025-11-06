import { getEnvironment } from '../environment.js'
import { PHONE_CC_QUICK_KEYBOARD, WELCOME_KEYBOARD } from '../lead_creation/src/ui/keyboards.js'
import {
  normalizeInternationalPhone,
  splitFirstLast,
  titleCase,
} from '../lead_creation/src/flows/utils.js'
import {
  ConsultantControlPanel,
  ConsultantInDashboard,
  getEmptyConsultantControlPanel,
  getEmptyLead,
  Lead,
  Status,
} from '../lead_creation/src/flows/models.js'
import TelegramBot from 'node-telegram-bot-api'
import { LeadCreator } from '../lead_creation/index.js'
import { Notificator } from '../notificator/index.js'

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

// ____________________________________________________________________

function multiSelectKeyboard(
  options: string[],
  selected: string[] = [],
  prefix: string,
  doneAction: string,
  cancelAction: string,
) {
  const rows = options.map(option => {
    const isOn = selected.includes(option)
    const label = `${isOn ? '✅' : '⬜️'} ${titleCase(option)}`
    return [{ text: label, callback_data: `${prefix}:${option}` }]
  })

  rows.push([
    { text: 'Cancelar', callback_data: cancelAction },
    { text: 'Confirmar', callback_data: doneAction },
  ])

  return { reply_markup: { inline_keyboard: rows } }
}

export function servicesKeyboard(selectedServices: string[] = []) {
  return multiSelectKeyboard(
    environment.globalVariablesMap.providedServices,
    selectedServices,
    'service_toggle',
    'service_done',
    'service_cancel',
  )
}

export function regionsKeyboard(selectedRegions: string[] = []) {
  return multiSelectKeyboard(
    environment.globalVariablesMap.regionsOfService,
    selectedRegions,
    'region_toggle',
    'region_done',
    'region_cancel',
  )
}

export class Bot {
  readonly telegramBot: TelegramBot
  private readonly SESSION = new Map()
  private readonly _leadCreator: LeadCreator
  constructor(leadCreator: LeadCreator) {
    this.telegramBot = new TelegramBot(environment.secrets.telegramBotToken, {
      polling: false,
    })
    this._leadCreator = leadCreator
  }

  async initChatFlow() {
    this.telegramBot.onText(/^\/start(?:\s+(.+))?$/, async msg => {
      return this.initInitialMessage(msg.chat.id)
    })

    this.telegramBot.on('message', async msg => {
      if (!msg.text || msg.text.startsWith('/')) return
      const chatId = msg.chat.id
      if (!this.SESSION.has(chatId)) this.initSession(chatId)
      const { step } = this.SESSION.get(chatId)

      if (/^começar$/i.test(msg.text)) {
        return this.initInitialMessage(msg.chat.id)
      }

      if (/^comecar$/i.test(msg.text)) {
        return this.initInitialMessage(msg.chat.id)
      }

      if (/^cancelar$/i.test(msg.text)) {
        this.initSession(chatId)
        return this.telegramBot.sendMessage(
          chatId,
          'Entendido! Quando quiser, basta escrever "Começar" ou /start',
        )
      }

      if (/^reiniciar$/i.test(msg.text)) {
        return this.initInitialMessage(msg.chat.id)
      }

      if (/^continuar$/i.test(msg.text)) {
        const s = this.SESSION.get(chatId)
        if (!s?.draft?.name) {
          this.setCurrentStep(STEP.ASK_NAME_FULL, chatId)
          return this.telegramBot.sendMessage(
            chatId,
            'Para começarmos, como se chama? Escreva nome e sobrenome',
          )
        }

        if (!s?.draft?.interest_services?.length) {
          this.setCurrentStep(STEP.ASK_INTEREST_SERVICES, chatId)
          return this.telegramBot.sendMessage(
            chatId,
            'Selecione os serviços de interesse (pode escolher vários):',
            servicesKeyboard([]),
          )
        }

        if (!s?.draft?.interest_regions?.length) {
          this.setCurrentStep(STEP.SELECT_REGIONS, chatId)
          return this.telegramBot.sendMessage(
            chatId,
            'Selecione as regiões de interesse (pode escolher várias):',
            regionsKeyboard([]),
          )
        }
        if (!s?.draft?.email) {
          this.setCurrentStep(STEP.ASK_EMAIL, chatId)
          return this.telegramBot.sendMessage(chatId, 'Para qual email enviaremos o aviso?')
        }
        if (!s?.draft?.phone) {
          this.setCurrentStep(STEP.ASK_PHONE, chatId)
          return this.telegramBot.sendMessage(
            chatId,
            'Qual é o indicativo do seu país?',
            PHONE_CC_QUICK_KEYBOARD,
          )
        }
        if (!s?.draft?.annual_income) {
          this.setCurrentStep(STEP.ASK_ANNUAL_INCOME, chatId)
          return this.telegramBot.sendMessage(chatId, 'Qual é a sua renda anual aproximada?')
        }

        this.setCurrentStep(STEP.SHOW_SUMMARY, chatId)
        return this.showSummary(chatId)
      }

      try {
        await this.executeActionBasedOnCurrentStep(step, msg)
      } catch (err) {
        console.error('Erro no handler:', err)
        await this.telegramBot.sendMessage(chatId, 'Ocorreu um erro. Tente novamente com /start')
        this.initSession(chatId)
      }
    })

    this.telegramBot.on('callback_query', async query => {
      const chatId = query.message?.chat.id as TelegramBot.ChatId
      const s = this.SESSION.get(chatId) || this.initSession(chatId)
      const data = query.data || ''
      const [action, payload] = data.split(':')

      try {
        if (data === 'confirm_lead') {
          this.setCurrentStep(STEP.FINALIZING, chatId)
          await this.telegramBot.answerCallbackQuery(query.id)
          return this.finalizeLead(chatId)
        }

        if (data === 'edit_lead') {
          await this.telegramBot.answerCallbackQuery(query.id, { text: 'Vamos editar os dados' })
          this.setCurrentStep(STEP.ASK_NAME_FULL, chatId)
          return this.telegramBot.sendMessage(chatId, 'Certo, vamos recomeçar. Como se chama?')
        }

        if (action === 'service_toggle') {
          const opt = payload
          const current = (this.SESSION.get(chatId)?.draft?.interest_services || []).slice()
          const idx = current.indexOf(opt)
          if (idx >= 0) current.splice(idx, 1)
          else current.push(opt)
          this.setDraft({ interest_services: current }, chatId)
          await this.telegramBot.answerCallbackQuery(query.id, {
            text: `${titleCase(opt || '')} ${idx >= 0 ? 'removido' : 'adicionado'}`,
          })
          return this.telegramBot.editMessageReplyMarkup(servicesKeyboard(current).reply_markup, {
            chat_id: chatId,
            message_id: query.message?.message_id,
          })
        }

        if (action === 'service_cancel') {
          await this.telegramBot.answerCallbackQuery(query.id, { text: 'Seleção cancelada' })
          const current = this.SESSION.get(chatId)?.draft?.interest_services || []
          return this.telegramBot.sendMessage(
            chatId,
            'Ok. Pode selecionar novamente:',
            servicesKeyboard(current),
          )
        }

        if (action === 'service_done') {
          await this.telegramBot.answerCallbackQuery(query.id)
          const selected = (s as any)?.draft?.interest_services || []
          if (!selected.length) {
            return this.telegramBot.sendMessage(
              chatId,
              'Selecione pelo menos um serviço',
              servicesKeyboard(selected),
            )
          }
          this.setCurrentStep(STEP.SELECT_REGIONS, chatId)
          return this.telegramBot.sendMessage(
            chatId,
            'Agora selecione as regiões de interesse:',
            regionsKeyboard([]),
          )
        }

        if (action === 'region_toggle') {
          const opt = payload
          const current = (this.SESSION.get(chatId)?.draft?.interest_regions || []).slice()
          const idx = current.indexOf(opt)
          if (idx >= 0) current.splice(idx, 1)
          else current.push(opt)
          this.setDraft({ interest_regions: current }, chatId)
          await this.telegramBot.answerCallbackQuery(query.id, {
            text: `${titleCase(opt?.replace('-', ' ') || '')} ${idx >= 0 ? 'removida' : 'adicionada'}`,
          })
          return this.telegramBot.editMessageReplyMarkup(regionsKeyboard(current).reply_markup, {
            chat_id: chatId,
            message_id: query.message?.message_id,
          })
        }

        if (action === 'region_cancel') {
          await this.telegramBot.answerCallbackQuery(query.id, { text: 'Seleção cancelada' })
          const current = this.SESSION.get(chatId)?.draft?.interest_regions || []
          return this.telegramBot.sendMessage(
            chatId,
            'Ok. Pode selecionar novamente:',
            regionsKeyboard(current),
          )
        }

        if (action === 'region_done') {
          await this.telegramBot.answerCallbackQuery(query.id)
          const selected = (s as any)?.draft?.interest_regions || []
          if (!selected.length) {
            return this.telegramBot.sendMessage(
              chatId,
              'Selecione pelo menos uma região',
              regionsKeyboard(selected),
            )
          }
          this.setCurrentStep(STEP.ASK_EMAIL, chatId)
          return this.telegramBot.sendMessage(chatId, 'Para qual email enviaremos o aviso?')
        }
      } catch (err) {
        console.error('Erro no callback_query:', err)
        await this.telegramBot.answerCallbackQuery(query.id, { text: 'Erro. Tente de novo' })
      }
    })

    this.telegramBot.onText(/^\/whoami$/, msg => {
      this.telegramBot.sendMessage(msg.chat.id, `O seu chat id é: ${msg.chat.id}`)
    })

    this.telegramBot.on('polling_error', err => {
      console.error('Polling error:', err?.message || err)
    })
  }
  private initSession(chatId?: TelegramBot.ChatId) {
    if (!chatId) return
    this.SESSION.set(chatId, { step: 'idle', draft: {} })
  }
  private async initInitialMessage(chatId: TelegramBot.ChatId) {
    this.initSession(chatId)

    await this.telegramBot.sendMessage(
      chatId,
      'Bem-vindo(a) à Portugal Houses Arrendamentos!\n\nPara avisarmos sobre casas disponíveis, precisaremos do seu contacto',
    )
    this.setCurrentStep(STEP.ASK_NAME_FULL, chatId)

    return this.telegramBot.sendMessage(
      chatId,
      'Para começarmos, como se chama? Escreva nome e sobrenome',
    )
  }

  private setCurrentStep(step: STEP, chatId: TelegramBot.ChatId) {
    if (!chatId) return
    const s = this.SESSION.get(chatId) || { step: 'idle', draft: {} }
    s.step = step
    this.SESSION.set(chatId, s)
  }
  private setDraft(patch: any, chatId: TelegramBot.ChatId) {
    if (!chatId) return
    const s = this.SESSION.get(chatId) || { step: 'idle', draft: {} }
    s.draft = { ...s.draft, ...patch }
    this.SESSION.set(chatId, s)
    return s.draft
  }
  private async executeActionBasedOnCurrentStep(step: STEP, msg: TelegramBot.Message) {
    const mapStepToAction: Record<STEP, () => void> = {
      [STEP.IDLE]: (): void => {
        this.telegramBot.sendMessage(msg.chat.id, 'Gostaria de começar?', WELCOME_KEYBOARD)
      },
      [STEP.ASK_NAME_FULL]: (): void => {
        if (!msg.text) {
          return
        }
        const name = msg.text.trim()
        if (!name.includes(' ')) {
          this.telegramBot.sendMessage(msg.chat.id, 'Por favor, envie nome e sobrenome')
          return
        }
        const { first, last } = splitFirstLast(name)
        this.setDraft({ name: `${first} ${last}` }, msg.chat.id)
        this.setCurrentStep(STEP.ASK_INTEREST_SERVICES, msg.chat.id)
        this.telegramBot.sendMessage(
          msg.chat.id,
          `É um prazer falar com você, ${titleCase(first)} ${titleCase(last)}.\nSelecione os serviços de interesse:`,
          servicesKeyboard([]),
        )
      },
      [STEP.ASK_INTEREST_SERVICES]: (): void => {
        this.telegramBot.sendMessage(
          msg.chat.id,
          'Selecione os serviços de interesse (pode escolher vários):',
          servicesKeyboard(this.getDraft(msg.chat.id).draft.interest_services || []),
        )
      },
      [STEP.SELECT_REGIONS]: (): void => {
        this.telegramBot.sendMessage(
          msg.chat.id,
          'Selecione as regiões de interesse (pode escolher várias):',
          regionsKeyboard(this.getDraft(msg.chat.id).draft.interest_regions || []),
        )
      },
      [STEP.ASK_EMAIL]: (): void => {
        const email = (msg.text || '').trim()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          this.telegramBot.sendMessage(msg.chat.id, 'Esse email não parece válido. Tente novamente')
          return
        }
        this.setDraft({ email: email.toLowerCase() }, msg.chat.id)
        this.setCurrentStep(STEP.ASK_PHONE, msg.chat.id)
        this.telegramBot.sendMessage(
          msg.chat.id,
          'Qual é o código telefônico do seu país?',
          PHONE_CC_QUICK_KEYBOARD,
        )
      },
      [STEP.ASK_PHONE]: (): void => {
        const raw = (msg.text || '').trim()
        if (/^\+?\d{6,}$/.test(raw.replace(/\s+/g, ''))) {
          const ccFromDraft = (this.getDraft(msg.chat.id).draft.phoneCountryCode || '').toString()
          const normalized = normalizeInternationalPhone(ccFromDraft, raw)
          if (!normalized) {
            this.telegramBot.sendMessage(
              msg.chat.id,
              'Hum... Esse não me parece um número válido, poderia tentar novamente?',
            )
            return
          }
          this.setDraft({ phone: normalized }, msg.chat.id)
          this.setCurrentStep(STEP.ASK_ANNUAL_INCOME, msg.chat.id)
          this.telegramBot.sendMessage(msg.chat.id, 'Qual é a sua renda anual aproximada?')
          return
        }

        if (/portugal/i.test(raw)) {
          this.setDraft({ phoneCountryCode: 351 }, msg.chat.id)
          this.telegramBot.sendMessage(msg.chat.id, 'Agora apenas o número (sem o +351)')
          return
        }
        if (/brasil/i.test(raw)) {
          this.setDraft({ phoneCountryCode: 55 }, msg.chat.id)
          this.telegramBot.sendMessage(msg.chat.id, 'Agora apenas o número (sem o +55)')
          return
        }
        if (/outro país|outros|outro/i.test(raw)) {
          this.telegramBot.sendMessage(
            msg.chat.id,
            'Indique apenas os dígitos do indicativo (ex.: 34, 49, 1)',
          )
          return
        }
        const cc = raw.replace(/\D+/g, '')
        if (!cc) {
          this.telegramBot.sendMessage(
            msg.chat.id,
            'Envie o indicativo apenas com dígitos (ex.: 351, 55)',
          )
          return
        }
        this.setDraft({ phoneCountryCode: cc }, msg.chat.id)
        this.telegramBot.sendMessage(msg.chat.id, 'Agora apenas o número (sem o código do país)')
      },
      [STEP.ASK_ANNUAL_INCOME]: (): void => {
        const income = (msg.text || '').trim()
        if (!income) {
          this.telegramBot.sendMessage(msg.chat.id, 'Informe um valor para continuarmos')
          return
        }
        this.setDraft({ annual_income: income }, msg.chat.id)
        this.setCurrentStep(STEP.SHOW_SUMMARY, msg.chat.id)
        this.showSummary(msg.chat.id)
      },
      [STEP.SHOW_SUMMARY]: (): void => {
        this.showSummary(msg.chat.id)
      },
      [STEP.FINALIZING]: (): void => {
        this.telegramBot.sendMessage(msg.chat.id, 'Um momento…')
      },
    }
    return mapStepToAction[step]()
  }

  private getDraft(chatId: TelegramBot.ChatId) {
    return this.SESSION.get(chatId) || { step: 'idle', draft: {} }
  }

  private showSummary(chatId: TelegramBot.ChatId) {
    const { draft } = this.getDraft(chatId)
    const summary =
      `Revise os dados abaixo:\n\n` +
      `Nome: ${draft.name || '-'}\n` +
      `Email: ${draft.email || '-'}\n` +
      `Telefone: ${draft.phone || '-'}\n` +
      `Serviços: ${this.toCsv(draft.interest_services || [])}\n` +
      `Regiões: ${this.toCsv(draft.interest_regions || [])}\n` +
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

    this.telegramBot.sendMessage(chatId, summary, inlineKeyboard)
  }

  private toCsv(values?: string[] | string): string {
    if (Array.isArray(values)) return values.join(', ')
    return (values || '').toString()
  }

  private async finalizeLead(chatId: TelegramBot.ChatId) {
    const s = this.getDraft(chatId)

    if (s.saving) return // já a gravar
    this.SESSION.set(chatId, { ...s, saving: true })

    try {
      const draft: Lead & { interest_services?: string[]; interest_regions?: string[] } =
        s.draft || {}
      const regionsCsv = this.toCsv(draft.interest_regions)
      const servicesCsv = this.toCsv(draft.interest_services)

      const id: string = draft.id || this._leadCreator.buildLeadCode(regionsCsv)

      if (!draft.id) this.setDraft({ id }, chatId)

      const lead: Lead = {
        id,
        name: draft.name || '',
        email: draft.email || '',
        phone: draft.phone || '',
        interest_services: servicesCsv,
        interest_regions: regionsCsv,
        annual_income: draft.annual_income || '',
        created_at: new Date().toISOString(),
        created_at_unix: Date.now(),
        status: Status.NEW,
      }

      const notificator = new Notificator(this)

      const getFilteredConsultantControlPanelsByMatchingServiceAndRegionWithLead = (
        lead: Lead,
        allConsultantControlPanelsInDashboard: ConsultantControlPanel[],
      ): ConsultantControlPanel[] => {
        // TODO search for all these sheets in google sheets by their ids and save them in consultants local variable
        // TODO then foreach consultant in consultants check if at least one item of lead.interest_services is included in consultant.provided_services AND if at least one item of lead.interest_regions is included in consultant.regions_of_service.
        return [] // TODO return list
      }

      const getSortedConsultantControlPanelsByCommissionValue = (
        consultantControlPanels: ConsultantControlPanel[],
        desc: boolean,
      ): ConsultantControlPanel[] => {
        // TODO sort the matched consultants by their commission_value desc
        return [] // TODO return sorted list
      }

      const getRealConsultantSheetsByConsultantsInDashboard = (
        consultantInDashboards: ConsultantInDashboard[],
      ) => {
        return [] // TODO return list found in google sheet itself, the real sheets
      }

      const getAllConsultantsInDashboard = (): ConsultantInDashboard[] => {
        return [] // TODO Go do Dashboard > consultores_clientes and get all the consultants listed there mapped to ConsultantInDashboard
      }

      const mapRealConsultantSheetsToConsultantControlPanels = (
        realConsultantSheets: ConsultantInDashboard[],
      ): ConsultantControlPanel[] => {
        return [] // TODO
      }

      const updateConsultantsInDashboardByConsultantControlPanels = (
        consultantControlPanels: ConsultantControlPanel[],
      ): void => {
        // TODO update 'Dashboard -> consultores_clientes' with the data from the list of the whole consultants found in google_sleets so that it keeps updated for next lead creation. Use getConsultantSheetsByIds for it.
      }

      const allConsultantsFoundInDashboard: ConsultantInDashboard[] = getAllConsultantsInDashboard()
      const allRealConsultantSheetsFoundInGoogleSheets =
        getRealConsultantSheetsByConsultantsInDashboard(allConsultantsFoundInDashboard)
      const allConsultantControlPanelsFoundInGoogleSheets: ConsultantControlPanel[] =
        mapRealConsultantSheetsToConsultantControlPanels(allRealConsultantSheetsFoundInGoogleSheets)
      const matchedConsultantControlPanels: ConsultantControlPanel[] =
        getFilteredConsultantControlPanelsByMatchingServiceAndRegionWithLead(
          getEmptyLead(),
          allConsultantControlPanelsFoundInGoogleSheets,
        )
      const sortedConsultantsByCommission: ConsultantControlPanel[] =
        getSortedConsultantControlPanelsByCommissionValue(matchedConsultantControlPanels, true)
      const matchedConsultantControlPanel: ConsultantControlPanel =
        sortedConsultantsByCommission[0]!
      updateConsultantsInDashboardByConsultantControlPanels(
        allConsultantControlPanelsFoundInGoogleSheets,
      )

      if (matchedConsultantControlPanel) {
        const leadRowToBeAddedToLeads: string[] =
          await this._leadCreator.createRowForGivenLead(lead)

        await this._leadCreator.appendRow(
          'captured_leads!A1:K1',
          leadRowToBeAddedToLeads,
          environment.dashboardSheet.id,
        ) // TODO add 'source, matching_sheet_ids, next_sheet_index, saved_in_current_sheet_id' columns

        await this._leadCreator.appendRow(
          'Leads!A1:K1',
          leadRowToBeAddedToLeads,
          matchedConsultantControlPanel.id,
        )

        await this._leadCreator.appendRow(
          'Leads History!A1:K1',
          leadRowToBeAddedToLeads,
          matchedConsultantControlPanel.id,
        ) // TODO add 'processed' column

        await notificator.notify(
          environment.secrets.telegramAdminChatId,
          `🔥 Novo Lead!!! 🔥\n` +
            `Id: ${lead.id}\n` +
            `Nome: ${titleCase(lead.name)}\n` +
            `Serviços: ${lead.interest_services}\n` +
            `Regiões: ${lead.interest_regions}\n` +
            `Email: ${lead.email}\n` +
            `Telefone: ${lead.phone}\n` +
            `Rendimento: ${lead.annual_income}\n` +
            `Criado em: ${lead.created_at}\n\n\n` +
            `Salvo em: ${matchedConsultantControlPanel.company_name} (${matchedConsultantControlPanel.personal_name_for_contact})\n` +
            `Sheet ID: ${matchedConsultantControlPanel.id}`,
        )
        if (
          matchedConsultantControlPanel.receive_notification_on_telegram_when_new_lead &&
          matchedConsultantControlPanel.telegram_chat_ids_for_notifications.length > 0
        ) {
          await notificator.notify(
            matchedConsultantControlPanel.telegram_chat_ids_for_notifications[0]!,
            `🔥 Novo Lead!!! 🔥\n` +
              `Id: ${lead.id}\n` +
              `Nome: ${titleCase(lead.name)}\n` +
              `Serviços: ${lead.interest_services}\n` +
              `Regiões: ${lead.interest_regions}\n` +
              `Email: ${lead.email}\n` +
              `Telefone: ${lead.phone}\n` +
              `Rendimento anual: ${lead.annual_income}\n` +
              `Criado em: ${lead.created_at}`,
          )
        }

        const waLink = this._leadCreator.buildWhatsAppLink(lead, getEmptyConsultantControlPanel())
        const emailLink = this._leadCreator.buildEmailLink(lead, getEmptyConsultantControlPanel())

        // TODO esse teclado precisa ser dinâmico, se acharmos um match com um consultor(prioridade) colocamos botão para falar com ele (email e/ou whatsapp) respeitando as flags em sua folha no Control Panel (receive_email_from_lead	email	cc_emails	receive_whatsapp_from_lead	whatsapp_phone)
        const inlineKeyboard = {} // TODO usar os dois links acima nos botões

        await this.telegramBot.sendMessage(
          chatId,
          'Boa notícia:\n' +
            '✅ Encontramos um consultor que oferece o serviço que você procura, nas regiões que escolheu!\n\n' +
            'Você pode chamá-lo agora ou esperar até que ele entre em contato. Desejamos sucesso na sua busca! 🎉',
          inlineKeyboard,
        )
      } else {
        // ORPHAN
        const leadRowToBeAddedToOrphans = await this._leadCreator.createRowForGivenLead(lead)
        await this._leadCreator.appendRow(
          'orphan_leads!A1:K1',
          leadRowToBeAddedToOrphans,
          environment.dashboardSheet.id,
        ) // TODO add 'source'

        await notificator.notify(
          environment.secrets.telegramAdminChatId,
          `👶🏻 Novo Orphan\n` +
            `Id: ${lead.id}\n` +
            `Nome: ${titleCase(lead.name)}\n` +
            `Serviços: ${lead.interest_services}\n` +
            `Regiões: ${lead.interest_regions}\n` +
            `Email: ${lead.email}\n` +
            `Telefone: ${lead.phone}\n` +
            `Rendimento: ${lead.annual_income}\n` +
            `Criado em: ${lead.created_at}`,
        )
        await this.telegramBot.sendMessage(
          chatId,
          'Obrigado! Avisaremos quando houver casas disponíveis',
        )
      }
    } catch (e) {
      console.error('finalizeLead error:', e)
      this.setCurrentStep(STEP.IDLE, chatId) // não fica preso em finalizing
      await this.telegramBot.sendMessage(
        chatId,
        'Ocorreu um erro ao guardar. Tente novamente com /start',
      )
    } finally {
      this.setCurrentStep(STEP.IDLE, chatId)
      const cur = this.SESSION.get(chatId) || {}
      delete cur.saving
      this.SESSION.set(chatId, cur)
    }
  }
}
