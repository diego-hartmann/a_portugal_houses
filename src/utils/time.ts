export function nowIso(): string {
  return new Date().toISOString()
}

export function nowUnixSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

export function parseDate(value: string): Date | null {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
