const {
  REGION_CODE,
  REGION_SETS,
  INTEREST_CODE
} = require('./models')

const {
  WA_CONSULTANT_PHONE,
  WA_MESSAGE_TEMPLATE
} = require('../config/env');


const {
    titleCase,
    listToCSV,
    randomBase36,
    splitFirstLast
} = require('./utils')

// ____________________________________________________________________

function buildLeadCode(interest, regions) {
  const iCode = INTEREST_CODE[interest] || 'X';
  const mainRegion = Array.isArray(regions) ? regions[0] : String(regions || '').split(',')[0].trim();
  const rCode = REGION_CODE[mainRegion] || 'X';
  return `PH-${iCode}-${rCode}-${randomBase36(4)}`;
}

function buildWhatsAppLink({ name, interest, regions, code }) {
  if (!WA_CONSULTANT_PHONE) return null;
  const { first, last } = splitFirstLast(name || '');
  const message = (WA_MESSAGE_TEMPLATE || '')
    .replace(/{name}/g, titleCase(name || ''))
    .replace(/{first_name}/g, titleCase(first))
    .replace(/{last_name}/g, titleCase(last))
    .replace(/{interest}/g, titleCase(interest || ''))
    .replace(/{regions}/g, listToCSV(regions || []))
    .replace(/{code}/g, code || '')
    .replace(/\\n/g, '\n');
  return `https://wa.me/${WA_CONSULTANT_PHONE}?text=${encodeURIComponent(message)}`;
}

function regionsKeyboard(interest, selected = []) {
  const set = REGION_SETS[interest] || [];
  const rows = set.map(opt => {
    const isOn = selected.includes(opt.value);
    const label = `${isOn ? '✅' : '⬜️'} ${opt.label}`;
    return [{ text: label, callback_data: `region_toggle:${opt.value}` }];
  });
  // ultima linha: Cancelar (esq) | Confirmar (dir)
  rows.push([
    { text: 'Cancelar',  callback_data: 'region_cancel'  },
    { text: 'Confirmar', callback_data: 'region_done'    }
  ]);
  return { reply_markup: { inline_keyboard: rows } };
}


module.exports = {
    buildLeadCode,
    buildWhatsAppLink,
    regionsKeyboard
}