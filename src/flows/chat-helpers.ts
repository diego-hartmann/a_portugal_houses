import { Lead } from './models.js'
import { getEnvironment } from '../environment.js'
import { titleCase, randomBase36 } from './utils.js'

const environment = await getEnvironment()

// ____________________________________________________________________

export function buildLeadCode(regionsCsv: string): string {
  const firstRegion = regionsCsv.split(',')[0]?.trim().toUpperCase() || 'X'
  const sanitized = firstRegion.replace(/[^A-Z0-9]/g, '') || 'X'
  const prefix = sanitized.slice(0, 3).padEnd(3, 'X')

  return `PH-${prefix}-${randomBase36(4)}`
}

export function buildWhatsAppLink(_lead: Lead) {
  // Não há número de WhatsApp do consultor nas .ENV atuais
  return null
}

function multiSelectKeyboard(
  options: string[],
  selected: string[] = [],
  prefix: string,
  doneAction: string,
  cancelAction: string,
) {
  const rows = options.map(option => {
    const isOn = selected.includes(option)
    const label = `${isOn ? '✅' : '⬜️'} ${titleCase(option)}`
    return [{ text: label, callback_data: `${prefix}:${option}` }]
  })

  rows.push([
    { text: 'Cancelar', callback_data: cancelAction },
    { text: 'Confirmar', callback_data: doneAction },
  ])

  return { reply_markup: { inline_keyboard: rows } }
}

export function servicesKeyboard(selectedServices: string[] = []) {
  return multiSelectKeyboard(
    environment.globalVariablesMap.providedServices,
    selectedServices,
    'service_toggle',
    'service_done',
    'service_cancel',
  )
}

export function regionsKeyboard(selectedRegions: string[] = []) {
  return multiSelectKeyboard(
    environment.globalVariablesMap.regionsOfService,
    selectedRegions,
    'region_toggle',
    'region_done',
    'region_cancel',
  )
}
