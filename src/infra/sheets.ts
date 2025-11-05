// src/infra/sheets.js
import { google } from 'googleapis'
import { GOOGLE_SHEET_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY } from '../config/env.js'

// normaliza a private key com \n escapado
export function normalizePrivateKey(k: string) {
  if (!k) return k
  k = k.trim()
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1)
  }
  if (k.includes('\\n')) k = k.replace(/\\n/g, '\n')
  return k
}

// cria e devolve um client do Google Sheets autenticado (service account)
export function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: normalizePrivateKey(GOOGLE_PRIVATE_KEY),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

export async function getRange(rangeA1: string): Promise<string[][]> {
  const sheets = getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: rangeA1,
  })
  return res.data.values || []
}

export async function getBatch(rangesA1: string[] = []): Promise<string[][][]> {
  const sheets = getSheetsClient()
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: GOOGLE_SHEET_ID,
    ranges: rangesA1,
  })
  // devolve array paralelo às ranges, cada item já com .values || []
  return (res.data.valueRanges || []).map(v => v.values || [])
}

export async function appendRow(rangeA1: string, rowValues: string[]) {
  const sheets = getSheetsClient()
  await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: rangeA1,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [rowValues] },
  })
}

export async function updateCell(rangeA1: string, value: string) {
  const sheets = getSheetsClient()
  await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: rangeA1,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  })
}

// util: 0->A, 1->B, ...
export function columnLetter(idx: number) {
  let s = ''
  idx += 1
  while (idx > 0) {
    const m = (idx - 1) % 26
    s = String.fromCharCode(65 + m) + s
    idx = Math.floor((idx - m) / 26)
  }
  return s
}
