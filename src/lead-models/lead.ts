import { LEAD_COLUMNS, LEAD_HISTORY_COLUMNS, CAPTURED_LEAD_COLUMNS, ORPHAN_LEAD_COLUMNS } from '../google-sheets/constants.js'

export type LeadColumn = (typeof LEAD_COLUMNS)[number]
export type LeadHistoryColumn = (typeof LEAD_HISTORY_COLUMNS)[number]
export type CapturedLeadColumn = (typeof CAPTURED_LEAD_COLUMNS)[number]
export type OrphanLeadColumn = (typeof ORPHAN_LEAD_COLUMNS)[number]

export type LeadStatus = 'novo' | 'contactado' | 'perdido' | 'fechado'

export interface LeadPayload {
  id: string
  status: LeadStatus
  name: string
  email: string
  phone: string
  interest_services: string
  interest_regions: string
  annual_income: string
  created_at: string
  created_at_unix: number
  notes: string
  close_status_identified_at: string
}

export interface LeadHistoryEntry extends LeadPayload {
  processed: string
}

export interface CapturedLeadEntry extends LeadPayload {
  source: string
  matching_sheet_ids: string
  next_sheet_index: string
  saved_in_current_sheet_id: string
}

export interface OrphanLeadEntry extends LeadPayload {
  source: string
}

export interface ControlPanelFlags {
  active: boolean
  services: string[]
  regions: string[]
  commission_value: number
  notify_on_close: boolean
  redistribution_enabled: boolean
  overwrite_allowed: boolean
}

export interface ConsultantProfile extends ControlPanelFlags {
  id: string
  company_name: string
  personal_name_for_contact: string
  sheet_id: string
  total_leads: number
  open_leads: number
  closed_leads: number
}
