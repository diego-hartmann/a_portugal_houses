import { getEnvironment } from '../environment.js'
import { randomBase36 } from './src/flows/utils.js'
import { ConsultantControlPanel, Lead } from './src/flows/models.js'
import TelegramBot from 'node-telegram-bot-api'
import { sheets_v4 } from 'googleapis'
import Sheets = sheets_v4.Sheets

const env = await getEnvironment()

class LeadCreation {
  // cria e devolve um client do Google Sheets autenticado (service account)
  async getSheetsClient(): Promise<Sheets> {
    return env.dashboardSheet.googleAccount.SHEETS // TODO isso ta errado, preciso pegar a tabela lead do consultor eu acho
  }
  buildLeadCode(regionsCsv: string): string {
    const firstRegion = regionsCsv.split(',')[0]?.trim().toUpperCase() || 'X'
    const sanitized = firstRegion.replace(/[^A-Z0-9]/g, '') || 'X'
    const prefix = sanitized.slice(0, 3).padEnd(3, 'X')

    return `PH-${prefix}-${randomBase36(4)}`
  }

  buildWhatsAppLink(_lead: Lead, consultantControlPanel: ConsultantControlPanel): string {
    // TODO (Dashboard -> wa_message_template) ler wa_message_template para gerar a mensagem com dados do lead e consultor
    return ''
  }

  buildEmailLink(_lead: Lead, consultantControlPanel: ConsultantControlPanel): string {
    // TODO (Dashboard -> email_message_template) ler wa_message_template para gerar a mensagem com dados do lead e consultor
    return ''
  }

  async getRange(rangeA1: string): Promise<string[][]> {
    const sheets = await this.getSheetsClient()
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: env.dashboardSheet.id,
      range: rangeA1,
    })
    return res.data.values || []
  }

  async getBatch(rangesA1: string[] = []): Promise<string[][][]> {
    const sheets = await this.getSheetsClient()
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: env.dashboardSheet.id,
      ranges: rangesA1,
    })
    // devolve array paralelo às ranges, cada item já com .values || []
    return (res.data.valueRanges || []).map(v => v.values || [])
  }

  async appendRow(rangeA1: string, rowValues: string[], sheetId: string): Promise<void> {
    const sheets = await this.getSheetsClient()
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: rangeA1,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [rowValues] },
    })
  }

  async updateCell(rangeA1: string, value: string) {
    const env = await getEnvironment()
    const sheets = await this.getSheetsClient()
    await sheets.spreadsheets.values.update({
      spreadsheetId: env.dashboardSheet.id,
      range: rangeA1,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[value]] },
    })
  }

  // util: 0->A, 1->B, ...
  columnLetter(idx: number) {
    let s = ''
    idx += 1
    while (idx > 0) {
      const m = (idx - 1) % 26
      s = String.fromCharCode(65 + m) + s
      idx = Math.floor((idx - m) / 26)
    }
    return s
  }

  /**
   * Ordem fixa das colunas na aba "Leads".
   * Mantém isto alinhado com a tua Sheet.
   */
  EXPECTED_HEADERS: string[] = [
    'code', // A
    'name', // B
    'email', // C
    'phone', // D
    'interest_services', // E
    'regions', // F
    'created_at', // G
    'telegram_chat_id_for_bot_notifications', // H
    'status', // I
    'notes', // J
    'closed_at', // K // TODO change to right headers
  ]

  async createRowForGivenLead(lead: Lead): Promise<string[]> {
    return this.EXPECTED_HEADERS.map(header => {
      if (header === 'interest_services')
        return (lead as any).interest_services || (lead as any).interest || ''
      if (header === 'interest_regions') return (lead as any).interest_regions || lead.regions || ''
      if (header === 'created_at' && (lead as any).created_at_unix)
        return `${lead.created_at} (${(lead as any).created_at_unix})`
      // @ts-ignore
      return lead[header] ?? ''
    })
  }

  /**
   * Atualiza o chat_id do Telegram para um lead específico pelo código.
   * Lemos apenas a coluna A (lead_code) para descobrir a linha.
   * Escrevemos diretamente na coluna H.
   */
  async updateTelegramChatIdForLead(code: number, chatId: TelegramBot.ChatId) {
    if (!code) return false

    // lê só a coluna A a partir da linha 2 (menos custos de quota)
    const codesCol: string[][] = await this.getRange('Leads!A2:A') // matriz [ [code], [code], ... ]
    let foundRow = -1

    for (let i = 0; i < codesCol.length; i++) {
      const cellCode: string = (codesCol[i]?.[0] ?? '').trim()
      if (cellCode === `${code}`) {
        foundRow = i // índice relativo a A2
        break
      }
    }
    if (foundRow === -1) return false

    const rowNumber = foundRow + 2 // A2 corresponde a i=0
    const H_COL_INDEX = 7 // 0-based → H é índice 7
    const range = `Leads!${this.columnLetter(H_COL_INDEX)}${rowNumber}` // ex.: H15

    await this.updateCell(range, String(chatId))
    return true
  }

  /**
   * Marca em K (closed_at) a data/hora ISO quando notificamos “fechado”.
   */
  async markClosedNotified(rowNumber: number) {
    const when = new Date().toISOString()
    await this.updateCell(`Leads!K${rowNumber}`, when)
  }
}

export type LeadCreator = LeadCreation
export const leadCreator: LeadCreator = new LeadCreation()
