import 'dotenv/config'

import { DashboardSheet } from './consultant_sheet_creation/src/DashboardSheet.js'
import { GoogleAccount } from './consultant_sheet_creation/src/GoogleAccount.js'
import { GoogleUser } from './consultant_sheet_creation/src/GoogleUser.js'

type DashboardSecrets = {
  telegramBotToken: string
  telegramAdminChatId: string
  port: number
  appBaseUrl: string
  leadBlueprintSheetId: string
  waMessageTemplate: string
  emailMessageTemplate: string
  adminEmail: string
}

type GlobalVariableMap = {
  providedServices: string[]
  regionsOfService: string[]
  statuses: string[]
  raw: string[][]
}

export type EnvironmentConfig = {
  secrets: DashboardSecrets
  globalVariables: string[][]
  globalVariablesMap: GlobalVariableMap
  dashboardSheet: DashboardSheet
}

let cachedEnvironment: EnvironmentConfig | null = null

function requireRuntime(name: string): string {
  const raw = process.env[name]
  if (!raw || raw.trim() === '') {
    throw new Error(`Missing runtime environment variable: ${name}`)
  }
  return raw.trim()
}

const SUPPORTED_ENVS = ['LOCAL', 'DEV', 'PROD'] as const

async function loadDashboardSecrets(dashboardSheet: DashboardSheet, env: string): Promise<DashboardSecrets> {
  const required = async (key: string): Promise<string> => dashboardSheet.getEnvValue(key)

  const normalizedEnv = env.trim().toUpperCase()
  if (!SUPPORTED_ENVS.includes(normalizedEnv as (typeof SUPPORTED_ENVS)[number])) {
    throw new Error(`Invalid ENV value: ${env}. Expected one of ${SUPPORTED_ENVS.join(', ')}`)
  }

  const tokenKey = `${normalizedEnv}_TELEGRAM_BOT_TOKEN`
  const portKey = `${normalizedEnv}_PORT`

  const [telegramBotToken, telegramAdminChatId, appBaseUrl, leadBlueprintSheetId, waMessageTemplate, emailMessageTemplate, portRaw, adminEmail] = await Promise.all([
    required(tokenKey),
    required('TELEGRAM_ADMIN_CHAT_ID'),
    required('APP_BASE_URL'),
    required('LEAD_BLUEPRINT_SHEET_ID'),
    required('WA_MESSAGE_TEMPLATE'),
    required('EMAIL_MESSAGE_TEMPLATE'),
    required(portKey),
    required('ADMIN_EMAIL'),
  ])

  const port = Number(portRaw)
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value in Dashboard .ENV for key ${portKey}: ${portRaw}`)
  }

  return {
    telegramBotToken,
    telegramAdminChatId,
    appBaseUrl,
    leadBlueprintSheetId,
    waMessageTemplate,
    emailMessageTemplate,
    port,
    adminEmail,
  }
}

async function loadGlobalVariables(dashboardSheet: DashboardSheet): Promise<string[][]> {
  const res = await dashboardSheet.botServiceAccount.SHEETS.spreadsheets.values.get({
    spreadsheetId: dashboardSheet.id,
    range: 'global_variables!A1:C',
  })

  const values = res.data.values ?? []
  if (!values.length) {
    throw new Error('Dashboard.global_variables is empty')
  }
  return values
}

function mapGlobalVariables(values: string[][]): GlobalVariableMap {
  const providedServices: string[] = []
  const regionsOfService: string[] = []
  const statuses: string[] = []

  for (const row of values) {
    const [service, region, status] = row
    if (service && service.trim()) providedServices.push(service.trim())
    if (region && region.trim()) regionsOfService.push(region.trim())
    if (status && status.trim()) statuses.push(status.trim())
  }

  return { providedServices, regionsOfService, statuses, raw: values }
}

export async function getEnvironment(): Promise<EnvironmentConfig> {
  if (cachedEnvironment) return cachedEnvironment

  const botUser = new GoogleUser(process.env.SHEET_SERVICE_ACCOUNT!, process.env.GOOGLE_PRIVATE_KEY!)

  const botServiceAccount = new GoogleAccount(botUser)
  const dashboardSheet = new DashboardSheet(botServiceAccount, process.env.DASHBOARD_SHEET_ID!)

  const secrets = await loadDashboardSecrets(dashboardSheet, process.env.ENV!)
  const globalVariables = await loadGlobalVariables(dashboardSheet)
  const globalVariablesMap = mapGlobalVariables(globalVariables)

  cachedEnvironment = {
    secrets,
    globalVariables,
    globalVariablesMap,
    dashboardSheet,
  }

  return cachedEnvironment
}

export async function refreshEnvironment(): Promise<EnvironmentConfig> {
  cachedEnvironment = null
  return getEnvironment()
}
