import { DASHBOARD_ID, DashboardSheet } from './DashboardSheet.js'
import { ConsultantSheet } from './ConsultantSheet.js'
import { getEnvironment } from '../../environment.js'

const env = await getEnvironment()

export class ConsultantSheetUploader {
  consultantSheet: ConsultantSheet

  constructor(consultantSheet: ConsultantSheet, dashboardSheet: DashboardSheet) {
    this.consultantSheet = consultantSheet
  }

  async saveConsultantSheetInGoogleDrive(consultantSheet: ConsultantSheet): Promise<void> {
    const { emailToShareSheet, sheetName } = consultantSheet
    console.log(`Creating sheet ${sheetName} for <${emailToShareSheet}>`)

    const blueprintId = env.secrets.leadBlueprintSheetId

    const newConsultantSheetFromBlueprint = await env.dashboardSheet.botServiceAccount.DRIVE.files.copy({
      fileId: blueprintId,
      requestBody: { name: `${sheetName}` },
    })

    const newSheetId = newConsultantSheetFromBlueprint.data.id
    if (!newSheetId) {
      throw new Error(`drive.files.copy returned no id`)
    }

    const newSheetUrl = `https://docs.google.com/spreadsheets/d/${newSheetId}`
    console.log(`Sheet created: ${newSheetUrl}`)

    try {
      await this.addPermissionToSheet(newSheetId, env.dashboardSheet.botServiceAccount.user.email, false)
      await this.addPermissionToSheet(newSheetId, this.consultantSheet.emailToShareSheet, true)

      await this.writeGlobalVariablesToConsultantSheet(newSheetId)
      await this.registerConsultantInDashboard(newSheetId)
      console.log(`Permissions applied.`)
    } catch (error) {
      throw new Error(`Could not set permissions to new consultant sheet: ${error}`)
    }
  }

  async addPermissionToSheet(sheetId: string, email: string, notify: boolean) {
    await env.dashboardSheet.botServiceAccount.DRIVE.permissions.create({
      fileId: sheetId,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: email,
      },
      sendNotificationEmail: notify,
    })
  }

  private async writeGlobalVariablesToConsultantSheet(consultantSheetId: string) {
    const gv = await env.dashboardSheet.botServiceAccount.SHEETS.spreadsheets.values.get({
      spreadsheetId: DASHBOARD_ID!,
      range: 'global_variables!A1:C', // sem header, listas diretas
    })

    const gvValues = gv.data.values ?? []
    if (!gvValues.length) {
      throw new Error(`Dashboard.global_variables is empty`)
    }

    await env.dashboardSheet.botServiceAccount.SHEETS.spreadsheets.values.update({
      spreadsheetId: consultantSheetId,
      range: 'global_variables!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: gvValues },
    })

    console.log(`global_variables populated.`)
  }

  private async registerConsultantInDashboard(consultantSheetId: string) {
    await env.dashboardSheet.botServiceAccount.SHEETS.spreadsheets.values.append({
      spreadsheetId: DASHBOARD_ID!,
      range: 'consultores_clientes!A2:K',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [
          [
            consultantSheetId, // sheet_id
            '', // company_name
            '', // personal_name_for_contact
            0, // total_leads
            0, // open_leads
            0, // closed_leads
            '', // commission_value
            0, // total_earned
            true, // online_to_receive_new_leads
            '', // notes
            '', // conversion_rate
            false, // pause
          ],
        ],
      },
    })

    console.log(`Consultant registered in consultores_clientes.`)
  }
}
