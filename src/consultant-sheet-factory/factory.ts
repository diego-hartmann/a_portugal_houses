import { drive_v3, sheets_v4 } from 'googleapis'
import { DashboardRepository } from '../google-sheets/dashboardRepository.js'
import { CONSULTANT_TABS } from '../google-sheets/constants.js'
import { ConsultantProfile, ControlPanelFlags } from '../lead-models/lead.js'
import { appendRange } from '../utils/sheets.js'
import { logger } from '../utils/logger.js'

export interface SheetFactoryOptions {
  consultantEmail: string
  consultantName: string
  consultantId: string
  companyName: string
  adminEmail: string
  botEmail: string
  blueprintSheetId: string
}

export class ConsultantSheetFactory {
  constructor(
    private readonly drive: drive_v3.Drive,
    private readonly sheets: sheets_v4.Sheets,
    private readonly dashboard: DashboardRepository,
  ) {}

  async createSheet(options: SheetFactoryOptions): Promise<ConsultantProfile> {
    const copy = await this.drive.files.copy({
      fileId: options.blueprintSheetId,
      requestBody: { name: `Leads – ${options.consultantName}` },
    })
    const newSheetId = copy.data.id
    if (!newSheetId) {
      throw new Error('Failed to create consultant sheet copy')
    }

    await this.addEditors(newSheetId, options.adminEmail, options.botEmail, options.consultantEmail)
    await this.populateGlobalVariables(newSheetId)
    await this.registerConsultantRecord(newSheetId, options)
    await this.applyProtections(newSheetId, options.adminEmail, options.botEmail)

    const profile: ConsultantProfile = {
      id: options.consultantId,
      company_name: options.companyName,
      personal_name_for_contact: options.consultantName,
      sheet_id: newSheetId,
      total_leads: 0,
      open_leads: 0,
      closed_leads: 0,
      active: true,
      services: [],
      regions: [],
      commission_value: 0,
      notify_on_close: true,
      redistribution_enabled: true,
      overwrite_allowed: true,
    }
    return profile
  }

  private async addEditors(sheetId: string, adminEmail: string, botEmail: string, consultantEmail: string): Promise<void> {
    const addPermission = (emailAddress: string) =>
      this.drive.permissions.create({
        fileId: sheetId,
        requestBody: { type: 'user', role: 'writer', emailAddress },
        fields: 'id',
      })

    await Promise.all([addPermission(adminEmail), addPermission(botEmail), addPermission(consultantEmail)])
  }

  private async populateGlobalVariables(sheetId: string): Promise<void> {
    const dashboardGlobals = await this.dashboard.fetchGlobalVariables()
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: appendRange(CONSULTANT_TABS.GLOBAL_VARIABLES, 'A', 'Z'),
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: dashboardGlobals },
    })
  }

  private async registerConsultantRecord(sheetId: string, options: SheetFactoryOptions): Promise<void> {
    const profile: ConsultantProfile = {
      id: options.consultantId,
      sheet_id: sheetId,
      company_name: options.companyName,
      personal_name_for_contact: options.consultantName,
      total_leads: 0,
      open_leads: 0,
      closed_leads: 0,
      active: true,
      services: [],
      regions: [],
      commission_value: 0,
      notify_on_close: true,
      redistribution_enabled: true,
      overwrite_allowed: true,
    }
    await this.dashboard.registerConsultant(profile)
  }

  private async applyProtections(sheetId: string, adminEmail: string, botEmail: string): Promise<void> {
    const editors = [adminEmail, botEmail]
    const requests: sheets_v4.Schema$Request[] = [
      {
        addProtectedRange: {
          protectedRange: {
            range: { sheetId: 0 },
            editors: { users: editors },
            warningOnly: false,
          },
        },
      },
    ]

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests },
    })
  }
}
