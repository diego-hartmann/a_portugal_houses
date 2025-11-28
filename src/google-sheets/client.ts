import { google, sheets_v4, drive_v3 } from 'googleapis'
import { BaseEnvironment, getBaseEnvironment } from '../utils/env.js'

export interface GoogleClients {
  sheets: sheets_v4.Sheets
  drive: drive_v3.Drive
  auth: any
}

function createJwtClient(baseEnv: BaseEnvironment) {
  return new google.auth.JWT({
    email: baseEnv.serviceAccountEmail,
    key: baseEnv.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  })
}

export function createGoogleClients(): GoogleClients {
  const baseEnv = getBaseEnvironment()
  const auth = createJwtClient(baseEnv)
  const sheets = google.sheets({ version: 'v4', auth })
  const drive = google.drive({ version: 'v3', auth })
  return { sheets, drive, auth }
}
