// src/infra/sheets.ts
import { getEnvironment } from '../environment.js'

// cria e devolve um client do Google Sheets autenticado (service account)
async function getSheetsClient() {
  const env = await getEnvironment()
  return env.googleAccount.SHEETS
}

export async function getRange(rangeA1: string): Promise<string[][]> {
  const env = await getEnvironment()
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: env.runtime.dashboardSheetId,
    range: rangeA1,
  })
  return res.data.values || []
}

export async function getBatch(rangesA1: string[] = []): Promise<string[][][]> {
  const env = await getEnvironment()
  const sheets = await getSheetsClient()
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: env.runtime.dashboardSheetId,
    ranges: rangesA1,
  })
  // devolve array paralelo às ranges, cada item já com .values || []
  return (res.data.valueRanges || []).map(v => v.values || [])
}

export async function appendRow(rangeA1: string, rowValues: string[]) {
  const env = await getEnvironment()
  const sheets = await getSheetsClient()
  await sheets.spreadsheets.values.append({
    spreadsheetId: env.runtime.dashboardSheetId,
    range: rangeA1,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [rowValues] },
  })
}

export async function updateCell(rangeA1: string, value: string) {
  const env = await getEnvironment()
  const sheets = await getSheetsClient()
  await sheets.spreadsheets.values.update({
    spreadsheetId: env.runtime.dashboardSheetId,
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
