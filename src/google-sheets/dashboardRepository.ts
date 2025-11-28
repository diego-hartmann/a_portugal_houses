import { sheets_v4, drive_v3 } from 'googleapis'
import { DASHBOARD_TABS, CAPTURED_LEAD_COLUMNS, ORPHAN_LEAD_COLUMNS } from './constants.js'
import { appendRange } from '../utils/sheets.js'
import { CapturedLeadEntry, OrphanLeadEntry, ConsultantProfile } from '../lead-models/lead.js'
import { RuntimeConfig } from '../utils/env.js'
import { logger } from '../utils/logger.js'

export class DashboardRepository {
  constructor(private readonly sheets: sheets_v4.Sheets, private readonly dashboardSheetId: string) {}

  async fetchEnvConfig(): Promise<RuntimeConfig> {
    const range = appendRange(DASHBOARD_TABS.ENV, 'A', 'B')
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.dashboardSheetId,
      range,
    })

    const values = response.data.values || []
    const config: RuntimeConfig = {}
    values.forEach(row => {
      const [key, value] = row
      if (key) config[key] = value || ''
    })
    return config
  }

  async fetchGlobalVariables(): Promise<string[][]> {
    const range = appendRange(DASHBOARD_TABS.GLOBAL_VARIABLES, 'A', 'Z')
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.dashboardSheetId,
      range,
    })
    return response.data.values || []
  }

  async appendCapturedLead(entry: CapturedLeadEntry): Promise<void> {
    const values = CAPTURED_LEAD_COLUMNS.map(key => entry[key])
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.dashboardSheetId,
      range: appendRange(DASHBOARD_TABS.CAPTURED_LEADS, 'A', 'Q'),
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    })
  }

  async appendOrphanLead(entry: OrphanLeadEntry): Promise<void> {
    const values = ORPHAN_LEAD_COLUMNS.map(key => entry[key])
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.dashboardSheetId,
      range: appendRange(DASHBOARD_TABS.ORPHAN_LEADS, 'A', 'M'),
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    })
  }

  async listOrphanLeads(): Promise<OrphanLeadEntry[]> {
    const range = appendRange(DASHBOARD_TABS.ORPHAN_LEADS, 'A', 'M')
    const response = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.dashboardSheetId, range })
    const values = response.data.values || []
    const headers = values[0] || []
    const rows = values.slice(1)
    return rows.map(row => this.toLead(headers, row))
  }

  async removeOrphanLead(leadId: string): Promise<void> {
    const range = appendRange(DASHBOARD_TABS.ORPHAN_LEADS, 'A', 'M')
    const existing = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.dashboardSheetId, range })
    const values = existing.data.values || []
    const headers = values[0] || []
    const idIndex = headers.indexOf('id')
    if (idIndex === -1) return
    const filtered = values.filter((row, idx) => idx === 0 || row[idIndex] !== leadId)
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.dashboardSheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: filtered },
    })
  }

  async registerConsultant(profile: ConsultantProfile): Promise<void> {
    const range = appendRange(DASHBOARD_TABS.CONSULTANTS, 'A', 'N')
    const existing = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.dashboardSheetId, range })
    const values = existing.data.values || []
    const record = [
      profile.id,
      profile.company_name,
      profile.personal_name_for_contact,
      profile.sheet_id,
      profile.total_leads,
      profile.open_leads,
      profile.closed_leads,
      profile.active ? 'TRUE' : 'FALSE',
      profile.services.join(','),
      profile.regions.join(','),
      profile.commission_value,
      profile.notify_on_close ? 'TRUE' : 'FALSE',
      profile.redistribution_enabled ? 'TRUE' : 'FALSE',
      profile.overwrite_allowed ? 'TRUE' : 'FALSE',
    ]
    const filtered = values.filter((row, idx) => idx === 0 || row[0] !== profile.id)
    filtered.push(record)
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.dashboardSheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: filtered },
    })
  }

  async listConsultants(): Promise<ConsultantProfile[]> {
    const range = appendRange(DASHBOARD_TABS.CONSULTANTS, 'A', 'N')
    const response = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.dashboardSheetId, range })
    const values = response.data.values || []
    const headers = values[0] || []
    return values.slice(1).map(row => this.toConsultant(headers, row))
  }

  private toConsultant(headers: string[], row: string[]): ConsultantProfile {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      record[header] = row[index] || ''
    })
    return {
      id: record.id || '',
      company_name: record.company_name || '',
      personal_name_for_contact: record.personal_name_for_contact || '',
      sheet_id: record.sheet_id || '',
      total_leads: Number(record.total_leads || 0),
      open_leads: Number(record.open_leads || 0),
      closed_leads: Number(record.closed_leads || 0),
      active: (record.active || '').toUpperCase() === 'TRUE',
      services: (record.services || '').split(',').filter(Boolean),
      regions: (record.regions || '').split(',').filter(Boolean),
      commission_value: Number(record.commission_value || 0),
      notify_on_close: (record.notify_on_close || '').toUpperCase() === 'TRUE',
      redistribution_enabled: (record.redistribution_enabled || '').toUpperCase() === 'TRUE',
      overwrite_allowed: (record.overwrite_allowed || '').toUpperCase() === 'TRUE',
    }
  }

  private toLead(headers: string[], row: string[]): OrphanLeadEntry {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      record[header] = row[index] || ''
    })
    return {
      id: record.id || '',
      status: (record.status || 'novo') as OrphanLeadEntry['status'],
      name: record.name || '',
      email: record.email || '',
      phone: record.phone || '',
      interest_services: record.interest_services || '',
      interest_regions: record.interest_regions || '',
      annual_income: record.annual_income || '',
      created_at: record.created_at || '',
      created_at_unix: Number(record.created_at_unix || 0),
      notes: record.notes || '',
      close_status_identified_at: record.close_status_identified_at || '',
      source: record.source || '',
    }
  }
}
