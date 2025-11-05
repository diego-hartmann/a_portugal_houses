// ---------------------------------------------------------------------------
// Configuração de Negócio
// ---------------------------------------------------------------------------
export enum Interest {
  ARRENDAR = 'arrendar',
  COMPRAR = 'comprar',
  AMBOS = 'ambos',
}

export enum Status {
  NOVO = 'novo',
  CONTACTADO = 'contactado',
  PERDIDO = 'perdido',
  FECHADO = 'fechado',
}

export enum Region {
  LISBOA = 'lisboa',
  VISEU = 'viseu',
  PORTO = 'porto',
  BRAGA = 'braga',
  OUTRAS_REGIOES = 'outras-regioes',
}

export interface Lead {
  code: string
  name: string
  email: string
  phone: string
  interest: Interest
  regions: string
  created_at: string
  status: Status
}

export const REGION_SETS: Record<Interest, Region[]> = {
  arrendar: [Region.LISBOA, Region.VISEU],
  comprar: [Region.LISBOA, Region.VISEU, Region.PORTO, Region.BRAGA, Region.OUTRAS_REGIOES],
  ambos: [Region.LISBOA, Region.VISEU, Region.PORTO, Region.BRAGA, Region.OUTRAS_REGIOES],
}

export const INTEREST_CODE = { arrendar: 'A', comprar: 'C', ambos: 'AC' }

export const REGION_CODE: Record<Region, string> = {
  lisboa: 'L',
  viseu: 'V',
  porto: 'P',
  braga: 'B',
  'outras-regioes': 'O',
}
