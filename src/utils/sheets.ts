export function range(tab: string, startColumn: string, endColumn: string): string {
  return `${tab}!${startColumn}:${endColumn}`
}

export function rangeRow(tab: string, startColumn: string, endColumn: string, row: number): string {
  return `${tab}!${startColumn}${row}:${endColumn}${row}`
}

export function appendRange(tab: string, startColumn: string, endColumn: string): string {
  return `${tab}!${startColumn}:${endColumn}`
}
