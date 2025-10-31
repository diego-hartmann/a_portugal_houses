require('dotenv').config();

function requireEnv(name) {
  const v = process.env[name];
  if (!v || String(v).trim() === '') {
    throw new Error(`Falta variável de ambiente: ${name}`);
  }
  return v;
}

const TELEGRAM_BOT_TOKEN = requireEnv('TELEGRAM_BOT_TOKEN');
const TELEGRAM_ADMIN_CHAT_ID = requireEnv('TELEGRAM_ADMIN_CHAT_ID', '');
const GOOGLE_SHEET_ID = requireEnv('GOOGLE_SHEET_ID');
const GOOGLE_CLIENT_EMAIL = requireEnv('GOOGLE_CLIENT_EMAIL');
const GOOGLE_PRIVATE_KEY = requireEnv('GOOGLE_PRIVATE_KEY');
const WA_CONSULTANT_PHONE = requireEnv('WA_CONSULTANT_PHONE', '');
const WA_MESSAGE_TEMPLATE = requireEnv('WA_MESSAGE_TEMPLATE', 'Olá, me chamo {first_name} {last_name}.\nInteresse: {interest}.\nRegiões: {regions}.\nCódigo: {code}.');
const NODE_ENV = requireEnv('NODE_ENV', 'development');

const MILLISECONDS_FOR_1_MINUTE = requireEnv('MILLISECONDS_FOR_1_MINUTE')
const MILLISECONDS_FOR_1_HOUR = requireEnv('MILLISECONDS_FOR_1_HOUR')
const MILLISECONDS_FOR_1_DAY = requireEnv('MILLISECONDS_FOR_1_DAY')
const MILLISECONDS_FOR_1_WEEK = requireEnv('MILLISECONDS_FOR_1_WEEK')

module.exports = {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_ADMIN_CHAT_ID,
  GOOGLE_SHEET_ID,
  GOOGLE_CLIENT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  WA_CONSULTANT_PHONE,
  WA_MESSAGE_TEMPLATE,
  NODE_ENV,
  MILLISECONDS_FOR_1_MINUTE,
  MILLISECONDS_FOR_1_HOUR,
  MILLISECONDS_FOR_1_DAY,
  MILLISECONDS_FOR_1_WEEK,
};
