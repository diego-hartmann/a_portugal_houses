// ---------------------------------------------------------------------------
// Configuração de Negócio
// ---------------------------------------------------------------------------

export enum Status {
  NEW = 'new',
  CONTACTED = 'contacted',
  LOST = 'lost',
  CLOSED = 'closed',
}

// TODO mudar e criar outros que extendem Lead
export interface Lead {
  id: string
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
export function getEmptyLead(): Lead {
  return {
    id: '',
    name: '',
    email: '',
    phone: '',
    interest_services: '',
    interest_regions: '',
    annual_income: '',
    created_at: '',
    status: Status.NEW,
  }
}

export interface ConsultantControlPanel {
  id: string
  company_name: string
  personal_name_for_contact: string
  receive_email_from_lead: boolean
  email: string
  cc_emails: string[]
  receive_whatsapp_from_lead: boolean
  whatsapp_phone: string
  receive_notification_on_telegram_when_important_communication: boolean
  receive_notification_on_telegram_when_new_lead: boolean
  receive_notification_on_telegram_when_close_lead: boolean
  telegram_chat_ids_for_notifications: string[]
  provided_services: string[]
  regions_of_service: string[]
  online_to_receive_new_leads: boolean
}

export interface ConsultantInDashboard {
  id: string
  company_name: string
  personal_name_for_contact: string
  total_leads: number
  open_leads: number
  closed_leads: number
  commission_value: number
  total_earned: number

  online_to_receive_new_leads: boolean
  notes: string
  conversion_rate: number
  pause: boolean
}

export function getEmptyConsultantControlPanel(): ConsultantControlPanel {
  return {
    id: '',
    company_name: '',
    personal_name_for_contact: '',
    receive_email_from_lead: false,
    email: '',
    cc_emails: [],
    receive_whatsapp_from_lead: false,
    whatsapp_phone: '',
    receive_notification_on_telegram_when_important_communication: false,
    receive_notification_on_telegram_when_new_lead: false,
    receive_notification_on_telegram_when_close_lead: false,
    telegram_chat_ids_for_notifications: [],
    provided_services: [],
    regions_of_service: [],
    online_to_receive_new_leads: false,
  }
}
