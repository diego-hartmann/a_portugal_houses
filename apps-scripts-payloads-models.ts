import { ConsultantControlPanel, Lead } from './src/lead_creation/src/flows/models.js'

export interface ChangedConsultantSheetEvent {
  id: string
  changes: Change[]
}

export interface Change {
  tabName: SheetTabName
  changeType: ChangeType
  data: ChangeData
  timestamp?: string
}

export type SheetTabName = 'Leads' | 'Control Panel'

export type ChangeType = 'closed' | 'lost' | 'deleted' | 'contacted' | 'control_panel_changed'

export type ChangeData = ChangedLead | ChangedControlPanel

export interface ChangedLead {
  old: Lead
  new: Lead | null
}

export interface ChangedControlPanel {
  old: ConsultantControlPanel
  new: ConsultantControlPanel
}

export type ChangePayloadTypeMapper = {
  closed: ChangedLead
  lost: ChangedLead
  deleted: ChangedLead
  contacted: ChangedLead
  control_panel_changed: ChangedControlPanel
}
