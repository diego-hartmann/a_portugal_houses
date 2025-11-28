import { sheets_v4, drive_v3 } from 'googleapis'
import { CONSULTANT_TABS, LEAD_COLUMNS, LEAD_HISTORY_COLUMNS, CONTROL_PANEL_FLAGS } from './constants.js'
import { appendRange } from '../utils/sheets.js'
import { LeadPayload, LeadHistoryEntry, ControlPanelFlags } from '../lead-models/lead.js'

export class ConsultantSheetRepository {
  constructor(private readonly sheets: sheets_v4.Sheets, private readonly sheetId: string) {}

  async fetchControlPanel(): Promise<ControlPanelFlags> {
    const range = appendRange(CONSULTANT_TABS.CONTROL, 'A', 'Z')
    const response = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.sheetId, range })
    const values = response.data.values || []
    const headers = values[0] || []
    const data = values[1] || []
    const lookup = (flag: string): string => {
      const idx = headers.indexOf(flag)
      return idx >= 0 ? data[idx] || '' : ''
    }
    return {
      active: lookup(CONTROL_PANEL_FLAGS.ACTIVE).toUpperCase() === 'TRUE',
      services: (lookup(CONTROL_PANEL_FLAGS.SERVICES) || '').split(',').filter(Boolean),
      regions: (lookup(CONTROL_PANEL_FLAGS.REGIONS) || '').split(',').filter(Boolean),
      commission_value: Number(lookup(CONTROL_PANEL_FLAGS.COMMISSION_VALUE) || 0),
      notify_on_close: lookup(CONTROL_PANEL_FLAGS.NOTIFY_ON_CLOSE).toUpperCase() === 'TRUE',
      redistribution_enabled: lookup(CONTROL_PANEL_FLAGS.REDISTRIBUTION_ENABLED).toUpperCase() === 'TRUE',
      overwrite_allowed: lookup(CONTROL_PANEL_FLAGS.OVERWRITE_ALLOWED).toUpperCase() === 'TRUE',
    }
  }

  async appendLead(payload: LeadPayload): Promise<void> {
    const values = LEAD_COLUMNS.map(column => payload[column])
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.sheetId,
      range: appendRange(CONSULTANT_TABS.LEADS, 'A', 'L'),
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    })
  }

  async appendLeadHistory(entry: LeadHistoryEntry): Promise<void> {
    const values = LEAD_HISTORY_COLUMNS.map(column => entry[column])
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.sheetId,
      range: appendRange(CONSULTANT_TABS.HISTORY, 'A', 'M'),
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    })
  }

  async listLeads(): Promise<LeadPayload[]> {
    const range = appendRange(CONSULTANT_TABS.LEADS, 'A', 'L')
    const response = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.sheetId, range })
    const values = response.data.values || []
    const headers = values[0] || []
    return values.slice(1).map(row => this.toLead(headers, row))
  }

  async overwriteLead(leadId: string, payload: LeadPayload): Promise<void> {
    const range = appendRange(CONSULTANT_TABS.LEADS, 'A', 'L')
    const existing = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.sheetId, range })
    const values = existing.data.values || []
    const headers = values[0] || []
    const idIndex = headers.indexOf('id')
    if (idIndex === -1) {
      await this.appendLead(payload)
      return
    }
    const updatedRows = values.map((row, index) => {
      if (index === 0) return row
      return row[idIndex] === leadId ? LEAD_COLUMNS.map(key => payload[key]) : row
    })
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: updatedRows },
    })
  }

  private toLead(headers: string[], row: string[]): LeadPayload {
    const result: Record<string, string> = {}
    headers.forEach((header, index) => {
      result[header] = row[index] || ''
    })
    return {
      id: result.id || '',
      status: (result.status || 'novo') as LeadPayload['status'],
      name: result.name || '',
      email: result.email || '',
      phone: result.phone || '',
      interest_services: result.interest_services || '',
      interest_regions: result.interest_regions || '',
      annual_income: result.annual_income || '',
      created_at: result.created_at || '',
      created_at_unix: Number(result.created_at_unix || 0),
      notes: result.notes || '',
      close_status_identified_at: result.close_status_identified_at || '',
    }
  }
}
