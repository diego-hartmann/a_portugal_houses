const {
  buildLeadCode,
  buildWhatsAppLink,
  regionsKeyboard
} = require('./chat-helpers.js')

const {
  getHeadersOrThrow,
  appendLeadRespectingHeaders,
  updateTelegramChatIdForLead,
  markClosedNotified
} = require('../services/leads');

const {
  TELEGRAM_ADMIN_CHAT_ID,
  MILLISECONDS_FOR_1_HOUR
} = require('../config/env');

const {
  INTEREST_KEYBOARD,
  PHONE_CC_QUICK_KEYBOARD,
  WELCOME_KEYBOARD
} = require('../ui/keyboards');

const {
  titleCase,
  normalizeInternationalPhone,
  splitFirstLast
} = require('./utils')

const {
  getBatch
} = require('../infra/sheets')


// ---------------------------------------------------------------------------
/** Sessão simples em memória */
// ---------------------------------------------------------------------------
const SESSION = new Map();
function initSession(chatId) { SESSION.set(chatId, { step: 'idle', draft: {} }); }
function setStep(chatId, step) {
  const s = SESSION.get(chatId) || { step: 'idle', draft: {} };
  s.step = step; SESSION.set(chatId, s);
}
function setDraft(chatId, patch) {
  const s = SESSION.get(chatId) || { step: 'idle', draft: {} };
  s.draft = { ...s.draft, ...patch }; SESSION.set(chatId, s); return s.draft;
}

async function finalizeLead(bot, chatId) {
  const s = SESSION.get(chatId) || {};
  if (s.saving) return;                 // já a gravar
  SESSION.set(chatId, { ...s, saving: true });

  try {
    const draft = s.draft || {};
    // se já gerámos code antes, não crie novo / evita duplicar
    const code = draft.code || buildLeadCode(draft.interest, draft.regionsSelected || []);
    const lead = {
      code,
      name: draft.name || '',
      email: draft.email || '',
      phone: draft.phone || '',
      interest: draft.interest || '',
      regions: draft.regionsSelected || [],
      created_at: new Date().toISOString()
    };

    // se ainda não tínhamos code no draft, guarda para callbacks
    if (!draft.code) setDraft(chatId, { code });

    await appendLeadRespectingHeaders(lead);

    const waLink = buildWhatsAppLink({
      name: lead.name, interest: lead.interest, regions: lead.regions, code: lead.code
    });

    const inlineKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Notifique-me também pelo Telegram', callback_data: 'subscribe_alerts' }],
          ...(waLink ? [[{ text: 'Falar com consultor (WhatsApp)', url: waLink }]] : [])
        ]
      }
    };

    await bot.sendMessage(chatId, 'Obrigado! Avisaremos quando houver casas disponíveis', inlineKeyboard);
    setStep(chatId, 'idle');
  } catch (e) {
    console.error('finalizeLead error:', e);
    setStep(chatId, 'idle');            // não fica preso em finalizing
    await bot.sendMessage(chatId, 'Ocorreu um erro ao guardar. Tente novamente com /start');
  } finally {
    const cur = SESSION.get(chatId) || {};
    delete cur.saving;
    SESSION.set(chatId, cur);
  }
}


// ---------------------------------------------------------------------------
// Check dos “fechados” (admin)
// ---------------------------------------------------------------------------
async function checkClosedLeads(bot) {
  if (!TELEGRAM_ADMIN_CHAT_ID) return;

  // A (code), B (name), C (email), D (phone), E (interest), F (regions), G (created_at),
  // I (status), K (closed_notified_at)
  const ranges = [
    'Leads!A2:A', // 0 code
    'Leads!B2:B', // 1 name
    'Leads!C2:C', // 2 email
    'Leads!D2:D', // 3 phone
    'Leads!E2:E', // 4 interest
    'Leads!F2:F', // 5 regions
    'Leads!G2:G', // 6 created_at
    'Leads!I2:I', // 7 status
    'Leads!K2:K'  // 8 closed_notified_at
  ];

  const [
    colCode, colName, colEmail, colPhone, colInterest,
    colRegions, colCreatedAt, colStatus, colNotifiedAt
  ] = await getBatch(ranges);

  // usa o maior comprimento entre as colunas
  const totalRows = Math.max(
    colCode.length, colName.length, colEmail.length, colPhone.length,
    colInterest.length, colRegions.length, colCreatedAt.length,
    colStatus.length, colNotifiedAt.length
  );

  for (let i = 0; i < totalRows; i++) {
    const code     = (colCode[i]?.[0] || '').trim();
    const name     = (colName[i]?.[0] || '').trim();
    const email    = (colEmail[i]?.[0] || '').trim();
    const phone    = (colPhone[i]?.[0] || '').trim();
    const interest = (colInterest[i]?.[0] || '').trim();
    const regions  = (colRegions[i]?.[0] || '').trim();
    const created  = (colCreatedAt[i]?.[0] || '').trim();
    const status   = (colStatus[i]?.[0] || '').toLowerCase().trim();
    const notified = (colNotifiedAt[i]?.[0] || '').trim();

    if (!code) continue; // linha vazia

    if (status === 'fechado' && !notified) {
      const text =
        `🏁 Lead FECHADO\n` +
        `Código: ${code}\n` +
        `Nome: ${titleCase(name)}\n` +
        `Interesse: ${interest}\n` +
        `Regiões: ${regions}\n` +
        `Email: ${email}\n` +
        `Telefone: ${phone}\n` +
        `Criado em: ${created}`;

      await bot.sendMessage(Number(TELEGRAM_ADMIN_CHAT_ID), text);

      // marca K (closed_notified_at) da linha i+2
      const rowNumber = i + 2; // A2 => i=0
      const when = new Date().toISOString();
      await updateCell(`Leads!K${rowNumber}`, when);
    }
  }
}

// arranque/paragem do watcher
let _closedWatcher = null;
function startClosedWatcher(bot) {
  if (_closedWatcher) clearInterval(_closedWatcher);
  _closedWatcher = setInterval(() => {
    checkClosedLeads(bot).catch(err => console.error('Erro no verificador de fechados:', err?.message || err));
  }, Number(MILLISECONDS_FOR_1_HOUR) * 5);
  return _closedWatcher;
}
function stopClosedWatcher() {
  if (_closedWatcher) clearInterval(_closedWatcher);
  _closedWatcher = null;
}

async function initInitialMessage(bot, chatId) {

  initSession(chatId);

  await bot.sendMessage(
    chatId,
    'Bem-vindo(a) à Portugal Houses!\n\nPara avisarmos sobre casas disponíveis, precisaremos do seu contacto.'
  );
  // Deep-link → avança imediatamente para o primeiro passo útil
  setStep(chatId, 'ask_name_full');
  return bot.sendMessage(chatId, 'Para começarmos, como se chama? Escreva nome e sobrenome.');
}


function attachHandlers(bot) {
  // aceitar /start e /start <payload> num único fluxo
  bot.onText(/^\/start(?:\s+(.+))?$/, async (msg) => {
    return initInitialMessage(bot, msg.chat.id)
  });

  // mensagens livres
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;
    if (!SESSION.has(chatId)) initSession(chatId);
    const { step } = SESSION.get(chatId);


    // --- atalhos de welcome ---
    if (/^começar$/i.test(msg.text)) {
      return initInitialMessage(bot, msg.chat.id)
    }

    if (/^comecar$/i.test(msg.text)) {
      return initInitialMessage(bot, msg.chat.id)
    }

    if (/^cancelar$/i.test(msg.text)) {
      initSession(chatId);
      return bot.sendMessage(
        chatId,
        'Entendido! Quando quiser, basta escrever "Começar" ou /start.'
      );
    }

    // atalhos out of flow
    if (/^reiniciar$/i.test(msg.text)) {
      return initInitialMessage(bot, msg.chat.id)
    }

    if (/^continuar$/i.test(msg.text)) {
      const s = SESSION.get(chatId);
      // se não houver draft/step útil, cai para reinício
      if (!s?.draft?.name) {
        setStep(chatId, 'ask_name_full');
        return bot.sendMessage(chatId, 'Para começarmos, como se chama? Escreva nome e sobrenome');
      }
      // caso já tenha nome mas esteja parado, avança para o próximo passo lógico
      if (!s?.draft?.interest) {
        setStep(chatId, 'ask_interest');
        return bot.sendMessage(chatId, 'No que teria interesse: arrendar, comprar ou ambos?', INTEREST_KEYBOARD);
      }
      if (!(s?.draft?.regionsSelected?.length)) {
        setStep(chatId, 'select_regions');
        return bot.sendMessage(chatId, 'Selecione as regiões de interesse (pode escolher várias)', regionsKeyboard(s.draft.interest, []));
      }
      if (!s?.draft?.email) {
        setStep(chatId, 'ask_email');
        return bot.sendMessage(chatId, 'Para qual email enviaremos o aviso?');
      }
      if (!s?.draft?.phoneCountryCode) {
        setStep(chatId, 'ask_phone_country');
        return bot.sendMessage(chatId, 'Qual é o indicativo do seu país?', PHONE_CC_QUICK_KEYBOARD);
      }
      if (!s?.draft?.phoneNational) {
        setStep(chatId, 'ask_phone_national');
        return bot.sendMessage(chatId, 'Agora o seu número (apenas dígitos).');
      }

      // se tudo preenchido mas não finalizado
      setStep(chatId, 'finalizing');
      return finalizeLead(bot, chatId);
    }

    try {
      if (step === 'ask_name_full') {
        const name = msg.text.trim();
        if (!name.includes(' ')) return bot.sendMessage(chatId, 'Por favor, envie nome e sobrenome');
        const { first, last } = splitFirstLast(name);
        setDraft(chatId, { name: `${first} ${last}` });
        setStep(chatId, 'ask_interest');
        return bot.sendMessage(chatId, `É um prazer falar com você, ${titleCase(first)} ${titleCase(last)}.\nNo que tem interesse: arrendar, comprar ou ambos?`, INTEREST_KEYBOARD);
      }

      if (step === 'ask_interest') {
        const interestRaw = msg.text.trim().toLowerCase();
        const allowed = { 'arrendar': 'arrendar', 'comprar': 'comprar', 'ambos': 'ambos' };
        if (!allowed[interestRaw]) {
          return bot.sendMessage(chatId, 'Escolha uma opção: Arrendar, Comprar ou Ambos', INTEREST_KEYBOARD);
        }
        setDraft(chatId, { interest: allowed[interestRaw], regionsSelected: [] });
        setStep(chatId, 'select_regions');
        return bot.sendMessage(chatId, 'Selecione as regiões de interesse (pode escolher várias)', regionsKeyboard(allowed[interestRaw], []));
      }

      if (step === 'ask_email') {
        const email = (msg.text || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          return bot.sendMessage(chatId, 'Esse email não parece válido. Tente novamente');
        }
        setDraft(chatId, { email: email.toLowerCase() });
        setStep(chatId, 'ask_phone_country');
        return bot.sendMessage( chatId, 'Qual é o código telefônico do seu país?', PHONE_CC_QUICK_KEYBOARD);
      }

      if (step === 'ask_phone_country') {
        const raw = (msg.text || '').trim();

        // atalhos por botão
        if (/portugal/i.test(raw)) {
          setDraft(chatId, { phoneCountryCode: '351' });
          setStep(chatId, 'ask_phone_national');
          return bot.sendMessage(chatId, 'Agora apenas o número (sem o +351)');
        }
        if (/brasil/i.test(raw)) {
          setDraft(chatId, { phoneCountryCode: '55' });
          setStep(chatId, 'ask_phone_national');
          return bot.sendMessage(chatId, 'Agora apenas o número (sem o +55)');
        }
        if (/outro país|outros|outro/i.test(raw)) {
          // pergunta aberta para dígitos do indicativo
          return bot.sendMessage(chatId, 'Indique apenas os dígitos do indicativo (ex.: 34, 49, 1)');
        }

        // também permitir que o utilizador já escreva só os dígitos
        const cc = raw.replace(/\D+/g, '');
        if (!cc) {
          return bot.sendMessage(chatId, 'Envie o indicativo apenas com dígitos (ex.: 351, 55)');
        }

        setDraft(chatId, { phoneCountryCode: cc });
        setStep(chatId, 'ask_phone_national');
        return bot.sendMessage(chatId, 'Agora apenas o número (sem o código do país)');
      }

      if (step === 'ask_phone_national') {
        bot.sendMessage(chatId, 'Validando número...')
        const s = SESSION.get(chatId);
        const cc = s?.draft?.phoneCountryCode || '';
        const normalized = normalizeInternationalPhone(cc, msg.text || '');
        if (!normalized) {
          return bot.sendMessage(chatId, 'Hum... Esse não me parece um número válido, poderia tentar novamente?');
        }
        setDraft(chatId, { phone: normalized });
        setStep(chatId, 'finalizing');
        return finalizeLead(bot, chatId);
      }

      if (step === 'finalizing') {
        return bot.sendMessage(chatId, 'Um momento…');
      }

      if (step === 'idle') {
        return bot.sendMessage(chatId, 'Gostaria de começar?', WELCOME_KEYBOARD);
      }

    } catch (err) {
      console.error('Erro no handler:', err);
      await bot.sendMessage(chatId, 'Ocorreu um erro. Tente novamente com /start');
      initSession(chatId);
    }
  });

  // callbacks (regiões + subscrição)
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const s = SESSION.get(chatId) || initSession(chatId);
    const data = query.data || '';
    const [action, payload] = data.split(':');

    try {
      if (data === 'subscribe_alerts') {
        await bot.answerCallbackQuery(query.id, { text: 'Subscrição registada!' });
        const updated = await updateTelegramChatIdForLead(s?.draft?.code, chatId);
        if (updated) return bot.sendMessage(chatId, 'Irá receber avisos por este chat assim que surgirem novas casas');
        return bot.sendMessage(chatId, 'Não encontrei o seu registo para associar a subscrição. Tente novamente com /start');
      }

      if (action === 'region_toggle') {
        const opt = payload;
        const current = (SESSION.get(chatId)?.draft?.regionsSelected || []).slice();
        const idx = current.indexOf(opt);
        if (idx >= 0) current.splice(idx, 1); else current.push(opt);
        setDraft(chatId, { regionsSelected: current });
        await bot.answerCallbackQuery(query.id, { text: `${titleCase(opt.replace('-', ' '))} ${idx >= 0 ? 'removida' : 'adicionada'}` });
        return bot.editMessageReplyMarkup(
          regionsKeyboard(s.draft.interest, current).reply_markup,
          { chat_id: chatId, message_id: query.message.message_id }
        );
      }

      if (action === 'region_cancel') {
        await bot.answerCallbackQuery(query.id, { text: 'Seleção cancelada' });
        const current = SESSION.get(chatId)?.draft?.regionsSelected || [];
        return bot.sendMessage(chatId, 'Ok. Pode selecionar novamente:', regionsKeyboard(s.draft.interest, current));
      }

      if (action === 'region_done') {
        await bot.answerCallbackQuery(query.id);
        const selected = s?.draft?.regionsSelected || [];
        if (!selected.length) {
          return bot.sendMessage(chatId, 'Selecione pelo menos uma região', regionsKeyboard(s.draft.interest, selected));
        }
        setStep(chatId, 'ask_email');
        return bot.sendMessage(chatId, 'Para qual email enviaremos o aviso?');
      }
    } catch (err) {
      console.error('Erro no callback_query:', err);
      await bot.answerCallbackQuery(query.id, { text: 'Erro. Tente de novo' });
    }
  });

  bot.onText(/^\/check_sheet$/, async (msg) => {
    try {
      const headers = await getHeadersOrThrow();
      await bot.sendMessage(msg.chat.id, `✅ Conexão OK.\nAba "Leads" encontrada.\nCabeçalhos: \n• ${headers.join('\n• ')}`);
    } catch (err) {
      console.error('Erro /check_sheet:', err);
      await bot.sendMessage(
        msg.chat.id,
        '❌ Falha ao aceder à Sheet. Verifique:\n' +
        '1) GOOGLE_SHEET_ID no .env\n' +
        '2) Partilha com o client_email da service account (Editor)\n' +
        '3) GOOGLE_PRIVATE_KEY com \\n'
      );
    }
  });

  // util: /whoami
  bot.onText(/^\/whoami$/, (msg) => {
    bot.sendMessage(msg.chat.id, `O seu chat id é: ${msg.chat.id}`);
  });

  // erros
  bot.on('polling_error', (err) => {
    console.error('Polling error:', err?.message || err);
  });
}

module.exports = {
  attachHandlers,
  startClosedWatcher,
  stopClosedWatcher
};
