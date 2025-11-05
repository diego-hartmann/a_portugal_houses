// src/services/leads.js
import TelegramBot from 'node-telegram-bot-api'
import { Lead } from '../flows/models.js'
import { getRange, appendRow, updateCell, columnLetter } from '../infra/sheets.js'

/**
 * Ordem fixa das colunas na aba "Leads".
 * Mantém isto alinhado com a tua Sheet.
 */
// TODO pegar diniamicamente pela table
export const EXPECTED_HEADERS = [
  'code', // A
  'name', // B
  'email', // C
  'phone', // D
  'interest', // E
  'regions', // F
  'created_at', // G
  'telegram_chat_id_for_bot_notifications', // H
  'status', // I
  'notes', // J
  'closed_notified_at', // K
]

/**
 * Adiciona um lead respeitando a ordem das colunas sem fazer leitura dos headers.
 * Reduz 1 chamada READ por lead.
 */
export async function appendLeadRespectingHeaders(lead: Lead) {
  // monta a linha exatamente na ordem definida
  // @ts-ignore
  const row: string[] = EXPECTED_HEADERS.map(header => lead[header] ?? '')

  // A1:K1 → “append abaixo” usando a mesma largura de colunas
  await appendRow('Leads!A1:K1', row)
}

/**
 * Atualiza o chat_id do Telegram para um lead específico pelo código.
 * Lemos apenas a coluna A (lead_code) para descobrir a linha.
 * Escrevemos diretamente na coluna H.
 */
export async function updateTelegramChatIdForLead(code: number, chatId: TelegramBot.ChatId) {
  if (!code) return false

  // lê só a coluna A a partir da linha 2 (menos custos de quota)
  const codesCol: string[][] = await getRange('Leads!A2:A') // matriz [ [code], [code], ... ]
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
  const range = `Leads!${columnLetter(H_COL_INDEX)}${rowNumber}` // ex.: H15

  await updateCell(range, String(chatId))
  return true
}

/**
 * Marca em K (closed_notified_at) a data/hora ISO quando notificamos “fechado”.
 */
export async function markClosedNotified(rowNumber: number) {
  const when = new Date().toISOString()
  await updateCell(`Leads!K${rowNumber}`, when)
}
