// src/services/leads.js
const { getRange, appendRow, updateCell, columnLetter } = require('../infra/sheets');

/**
 * Ordem fixa das colunas na aba "Leads".
 * Mantém isto alinhado com a tua Sheet.
 */
const EXPECTED_HEADERS = [
  'lead_code',                                     // A
  'name',                                          // B
  'email',                                         // C
  'phone',                                         // D
  'interest',                                      // E
  'regions',                                       // F
  'created_at',                                    // G
  'telegram_chat_id_for_bot_notifications',        // H
  'status',                                        // I
  'notes',                                         // J
  'closed_notified_at'                             // K
];

/**
 * Adiciona um lead respeitando a ordem das colunas sem fazer leitura dos headers.
 * Reduz 1 chamada READ por lead.
 */
async function appendLeadRespectingHeaders(lead) {
  const rowDict = {
    lead_code: lead.code,
    name: (lead.name || '').toLowerCase(),
    email: (lead.email || '').toLowerCase(),
    phone: (lead.phone || ''), // já normalizado
    interest: (lead.interest || '').toLowerCase(),
    regions: Array.isArray(lead.regions)
      ? lead.regions.map(r => (r || '').toLowerCase()).join(', ')
      : String(lead.regions || '').toLowerCase(),
    created_at: lead.created_at,
    telegram_chat_id_for_bot_notifications: '',
    status: '',
    notes: '',
    closed_notified_at: ''
  };

  // monta a linha exatamente na ordem definida
  const row = EXPECTED_HEADERS.map(h => (rowDict[h] !== undefined ? rowDict[h] : ''));

  // A1:K1 → “append abaixo” usando a mesma largura de colunas
  await appendRow('Leads!A1:K1', row);
}

/**
 * Atualiza o chat_id do Telegram para um lead específico pelo código.
 * Lemos apenas a coluna A (lead_code) para descobrir a linha.
 * Escrevemos diretamente na coluna H.
 */
async function updateTelegramChatIdForLead(code, chatId) {
  if (!code) return false;

  // lê só a coluna A a partir da linha 2 (menos custos de quota)
  const codesCol = await getRange('Leads!A2:A'); // matriz [ [code], [code], ... ]
  let foundRow = -1;

  for (let i = 0; i < codesCol.length; i++) {
    const cell = (codesCol[i][0] || '').trim();
    if (cell === code) {
      foundRow = i; // índice relativo a A2
      break;
    }
  }
  if (foundRow === -1) return false;

  const rowNumber = foundRow + 2;      // A2 corresponde a i=0
  const H_COL_INDEX = 7;               // 0-based → H é índice 7
  const range = `Leads!${columnLetter(H_COL_INDEX)}${rowNumber}`; // ex.: H15

  await updateCell(range, String(chatId));
  return true;
}

/**
 * Marca em K (closed_notified_at) a data/hora ISO quando notificamos “fechado”.
 */
async function markClosedNotified(rowNumber) {
  const when = new Date().toISOString();
  await updateCell(`Leads!K${rowNumber}`, when);
}

module.exports = {
  EXPECTED_HEADERS,
  appendLeadRespectingHeaders,
  updateTelegramChatIdForLead,
  markClosedNotified
};
