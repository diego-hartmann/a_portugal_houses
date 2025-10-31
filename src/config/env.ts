import 'dotenv/config'

function requireEnv(name: string): string {
  const raw = process.env[name]
  if (!raw || raw.trim() === '') {
    throw new Error(`Falta variável de ambiente: ${name}`)
  }
  return raw
}

// Strings obrigatórias
export const TELEGRAM_BOT_TOKEN: string = requireEnv('TELEGRAM_BOT_TOKEN')
export const GOOGLE_SHEET_ID: string = requireEnv('GOOGLE_SHEET_ID')
export const GOOGLE_CLIENT_EMAIL: string = requireEnv('GOOGLE_CLIENT_EMAIL')
export const GOOGLE_PRIVATE_KEY: string = requireEnv('GOOGLE_PRIVATE_KEY')

// Strings opcionais com default vazio
export const TELEGRAM_ADMIN_CHAT_ID: string = requireEnv('TELEGRAM_ADMIN_CHAT_ID')
export const WA_CONSULTANT_PHONE: string = requireEnv('WA_CONSULTANT_PHONE')

// Texto com default
export const WA_MESSAGE_TEMPLATE: string = requireEnv('WA_MESSAGE_TEMPLATE')

// Ambiente com default
export const NODE_ENV: string = requireEnv('NODE_ENV')

export const APP_BASE_URL: string = requireEnv('APP_BASE_URL')

// Números (milissegundos) — convertemos e validamos
function requireNumberEnv(name: string): number {
  const val = process.env[name]
  if (val == null || Number.isNaN(val)) {
    throw new Error(`Falta variável numérica de ambiente: ${name}`)
  }
  return Number(val)
}

export const MILLISECONDS_FOR_1_MINUTE: number = requireNumberEnv('MILLISECONDS_FOR_1_MINUTE')
export const MILLISECONDS_FOR_1_HOUR: number = requireNumberEnv('MILLISECONDS_FOR_1_HOUR')
export const MILLISECONDS_FOR_1_DAY: number = requireNumberEnv('MILLISECONDS_FOR_1_DAY')
export const MILLISECONDS_FOR_1_WEEK: number = requireNumberEnv('MILLISECONDS_FOR_1_WEEK')
