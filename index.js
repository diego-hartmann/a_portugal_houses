// --- Web service “mínimo” para o Render te ver como web ---
const express = require('express');
const app = express();
app.get('/health', (_, res) => res.send('ok'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('HTTP up on', PORT));

// --- KeepAlive (se estiveres a auto-pingar tua URL pública) ---
const { startKeepAlive } = require('./src/infra/keepAlive');
const keep = startKeepAlive();

// --- Bot + handlers ---
const { bot, ensurePollingOnce } = require('./src/infra/bot');
const { attachHandlers, startClosedWatcher, stopClosedWatcher } = require('./src/flows/handlers');

(async () => {
  await ensurePollingOnce();      // <- limpa webhook e inicia UM polling
  attachHandlers(bot);
  startClosedWatcher(bot);
})();

// Polling errors: silencia 409 do handover e loga o resto
bot.on('polling_error', (err) => {
  if (err?.error_code === 409) {
    console.warn('Outro getUpdates ativo por instantes; a reconectar…');
    return;
  }
  console.error('Polling error:', err?.message || err);
});

// --- Encerramento limpo (SIGINT/SIGTERM/erros não tratados) ---
let shuttingDown = false;

async function stop(reason = 'desconhecido') {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('Encerrando… (' + reason + ')');

  try { await stopClosedWatcher(); } catch (_) {}
  try { keep?.stop?.(); } catch (_) {}
  try { await bot.stopPolling(); } catch (_) {}

  process.exit(0);
}

process.once('SIGINT',  () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err);
  stop('unhandledRejection');
});
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
  stop('uncaughtException');
});
