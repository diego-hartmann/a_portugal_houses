import { GoogleAccount } from './GoogleAccount.js'

type EnvMap = Record<string, string>

export const DASHBOARD_ID = process.env.DASHBOARD_SHEET_ID

export class DashboardSheet {
  readonly googleAccount: GoogleAccount
  private envMap: EnvMap = {}

  constructor(googleAccount: GoogleAccount) {
    this.googleAccount = googleAccount
  }

  private async initEnvMap() {
    this.envMap = await this.getEnvMapFromGoogleSheets()
  }

  async getEnvValue(envKey: string): Promise<string> {
    if (!this.envMap) {
      await this.initEnvMap()
    }
    const envValue = this.envMap[envKey.toUpperCase()]
    if (!envValue) {
      throw new Error(`$Missing key in Dashboard .ENV: ${envKey}`)
    }
    return envValue
  }

  private async getEnvMapFromGoogleSheets(): Promise<EnvMap> {
    const res = await this.googleAccount.SHEETS.spreadsheets.values.get({
      spreadsheetId: DASHBOARD_ID!,
      range: '.ENV!A2:B',
    })

    const rows = res.data.values ?? []

    if (!rows.length) {
      throw new Error(`$.ENV tab in Dashboard is empty`)
    }

    const env: EnvMap = {}
    for (const [key, value] of rows) {
      env[key.trim().toUpperCase()] = (value ?? '').trim()
    }
    return env
  }
}
