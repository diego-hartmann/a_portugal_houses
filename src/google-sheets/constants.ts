export const DASHBOARD_TABS = {
  ENV: '.ENV',
  GLOBAL_VARIABLES: 'global_variables',
  CAPTURED_LEADS: 'captured_leads',
  ORPHAN_LEADS: 'orphan_leads',
  CONSULTANTS: 'consultores_clientes',
  TOTAL_EARNED: 'total_earned',
} as const

export const CONSULTANT_TABS = {
  START: 'Start Here',
  CONTROL: 'Control Panel',
  LEADS: 'Leads',
  HISTORY: 'Leads History',
  GLOBAL_VARIABLES: 'global_variables',
} as const

export const LEAD_COLUMNS = [
  'id',
  'status',
  'name',
  'email',
  'phone',
  'interest_services',
  'interest_regions',
  'annual_income',
  'created_at',
  'created_at_unix',
  'notes',
  'close_status_identified_at',
] as const

export const LEAD_HISTORY_COLUMNS = [...LEAD_COLUMNS, 'processed'] as const

export const CAPTURED_LEAD_COLUMNS = [
  ...LEAD_COLUMNS,
  'source',
  'matching_sheet_ids',
  'next_sheet_index',
  'saved_in_current_sheet_id',
] as const

export const ORPHAN_LEAD_COLUMNS = [...LEAD_COLUMNS, 'source'] as const

export const CONTROL_PANEL_FLAGS = {
  ACTIVE: 'active',
  SERVICES: 'services',
  REGIONS: 'regions',
  COMMISSION_VALUE: 'commission_value',
  NOTIFY_ON_CLOSE: 'notify_on_close',
  REDISTRIBUTION_ENABLED: 'redistribution_enabled',
  OVERWRITE_ALLOWED: 'overwrite_allowed',
} as const

export type ControlPanelFlagKey = (typeof CONTROL_PANEL_FLAGS)[keyof typeof CONTROL_PANEL_FLAGS]
