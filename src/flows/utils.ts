import { parsePhoneNumberFromString } from 'libphonenumber-js'

export function titleCase(str = '') {
  return str
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function splitFirstLast(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { first: '', last: '' }
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

export function randomBase36(n: number) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 36).toString(36))
    .join('')
    .toUpperCase()
}

// Pedimos primeiro o indicativo do país, depois o número nacional — e validamos.
export function normalizeInternationalPhone(countryCodeDigits: number, nationalNumberRaw: string) {
  let cc = String(countryCodeDigits || '').replace(/\D+/g, '')
  let national = String(nationalNumberRaw || '').replace(/\D+/g, '')

  if (!cc) return null
  // monta em formato "E.164" com '+'
  const candidate = `+${cc}${national}`
  const parsed = parsePhoneNumberFromString(candidate)
  if (!parsed || !parsed.isValid()) return null

  // guardamos em dígitos (sem '+') para WA e sheet
  return parsed.number.replace(/^\+/, '')
}
