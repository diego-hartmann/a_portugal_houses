const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_BOT_TOKEN, NODE_ENV } = require('../config/env');

// Cria o bot SEM polling automático
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

let _started = false;

async function ensurePollingOnce() {
  if (_started) return;
  // Garante que não há webhook (evita 409 se houver um antigo pendurado)
  try {
    await bot.deleteWebHook({ drop_pending_updates: true });
  } catch (_) {
    // silencioso: se não houver webhook, está tudo bem
  }

  await bot.startPolling({
    params: { timeout: 30 }
    // podes ajustar interval se quiseres: interval: 300
  });

  _started = true;
  console.log(`Bot iniciado em ${NODE_ENV} (long polling)…`);
}

module.exports = { bot, ensurePollingOnce };
