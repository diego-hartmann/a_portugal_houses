import { Interest, Lead, Region } from './models.js'

import { REGION_CODE, REGION_SETS, INTEREST_CODE } from './models.js'

import { WA_CONSULTANT_PHONE, WA_MESSAGE_TEMPLATE } from '../config/env.js'

import { titleCase, randomBase36, splitFirstLast } from './utils.js'

// ____________________________________________________________________

export function buildLeadCode(interest: Interest, regions: string): string {
  const iCode = INTEREST_CODE[interest] || 'X'

  const firstRegion: Region = regions.split(',')[0] as Region

  const rCode = REGION_CODE[firstRegion ?? 'outras-regioes'] || 'X'

  return `PH-${iCode}-${rCode}-${randomBase36(4)}`
}

export function buildWhatsAppLink(lead: Lead) {
  if (!WA_CONSULTANT_PHONE) return null

  const { first, last } = splitFirstLast(lead.name || '')

  const message = (WA_MESSAGE_TEMPLATE || '')
    .replace(/{name}/g, titleCase(lead.name || ''))
    .replace(/{first_name}/g, titleCase(first))
    .replace(/{last_name}/g, titleCase(last))
    .replace(/{interest}/g, titleCase(lead.interest || ''))
    .replace(
      /{regions}/g,
      lead.regions
        .split(',')
        .map(region => titleCase(region))
        .join(', '),
    )
    .replace(/{code}/g, lead.code || '')
    .replace(/\\n/g, '\n')
  return `https://wa.me/${WA_CONSULTANT_PHONE}?text=${encodeURIComponent(message)}`
}

export function regionsKeyboard(interest: Interest, selectedRegions: Region[] = []) {
  const regionsBasedOnInterest = REGION_SETS[interest] || []

  const rows = regionsBasedOnInterest.map(region => {
    const isOn = selectedRegions.includes(region)
    const label = `${isOn ? '✅' : '⬜️'} ${titleCase(region)}`

    return [{ text: label, callback_data: `region_toggle:${region}` }]
  })

  // ultima linha: Cancelar (esq) | Confirmar (dir)
  rows.push([
    { text: 'Cancelar', callback_data: 'region_cancel' },
    { text: 'Confirmar', callback_data: 'region_done' },
  ])

  return { reply_markup: { inline_keyboard: rows } }
}
