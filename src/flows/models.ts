// ---------------------------------------------------------------------------
// Configuração de Negócio
// ---------------------------------------------------------------------------

export enum Status {
  NOVO = 'novo',
  CONTACTADO = 'contactado',
  PERDIDO = 'perdido',
  FECHADO = 'fechado',
}

export enum Region {
  LISBOA = 'lisboa',
  VISEU = 'viseu',
}

export interface Lead {
  code: string
  name: string
  email: string
  phone: string
  regions: string
  created_at: string
  status: Status
}

export const REGION_CODE: Record<Region, string> = {
  lisboa: 'L',
  viseu: 'V',
}
