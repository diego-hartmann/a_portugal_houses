// ---------------------------------------------------------------------------
// Configuração de Negócio
// ---------------------------------------------------------------------------

export enum Status {
  NOVO = 'novo',
  CONTACTADO = 'contactado',
  PERDIDO = 'perdido',
  FECHADO = 'fechado',
}

export interface Lead {
  code: string
  name: string
  email: string
  phone: string
  interest_services: string
  interest_regions: string
  annual_income: string
  regions?: string
  created_at: string
  created_at_unix?: number | string
  status: Status
  notes?: string
  close_status_identified_at?: string
  processed?: string
}
