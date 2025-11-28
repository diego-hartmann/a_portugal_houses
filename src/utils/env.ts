export interface BaseEnvironment {
  dashboardSheetId: string
  serviceAccountEmail: string
  privateKey: string
}

const REQUIRED_ENV_KEYS = ['DASHBOARD_SHEET_ID', 'SHEET_SERVICE_ACCOUNT', 'GOOGLE_PRIVATE_KEY'] as const

type AllowedEnvKey = (typeof REQUIRED_ENV_KEYS)[number]

function readEnv(key: AllowedEnvKey): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export function getBaseEnvironment(): BaseEnvironment {
  // Only expose the three allowed environment variables.
  const dashboardSheetId = readEnv('DASHBOARD_SHEET_ID')
  const serviceAccountEmail = readEnv('SHEET_SERVICE_ACCOUNT')
  const privateKeyRaw = readEnv('GOOGLE_PRIVATE_KEY')
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n')
  return { dashboardSheetId, serviceAccountEmail, privateKey }
}

export type EnvSheetEntry = { key: string; value: string }

export type RuntimeConfig = Record<string, string>
