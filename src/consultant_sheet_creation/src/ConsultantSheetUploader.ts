import { DASHBOARD_ID, DashboardSheet } from './DashboardSheet.js'
import { ConsultantSheet } from './ConsultantSheet.js'

export class ConsultantSheetUploader {
  consultantSheet: ConsultantSheet
  dashboardSheet: DashboardSheet

  constructor(consultantSheet: ConsultantSheet, dashboardSheet: DashboardSheet) {
    this.consultantSheet = consultantSheet
    this.dashboardSheet = dashboardSheet
  }

  async saveConsultantSheetInGoogleDrive(consultantSheet: ConsultantSheet): Promise<void> {
    const { emailToShareSheet, sheetName } = consultantSheet
    console.log(`Creating sheet ${sheetName} for <${emailToShareSheet}>`)

    const blueprintId = await this.dashboardSheet.getEnvValue('LEAD_BLUEPRINT_SHEET_ID')

    const newConsultantSheetFromBlueprint =
      await this.dashboardSheet.googleAccount.DRIVE.files.copy({
        fileId: blueprintId,
        requestBody: { name: `${sheetName}` },
      })

    const newSheetId = newConsultantSheetFromBlueprint.data.id
    if (!newSheetId) {
      throw new Error(`drive.files.copy returned no id`)
    }

    const newSheetUrl = `https://docs.google.com/spreadsheets/d/${newSheetId}`
    console.log(`Sheet created: ${newSheetUrl}`)

    // 3) Permissões (admin, bot, consultor)

    await this.writeGlobalVariablesToConsultantSheet(newSheetId)
    await this.registerConsultantInDashboard(newSheetId)
  }

  private async addPermissionToUsers(consultantSheetId: string) {
    const adminEmail = await this.dashboardSheet.getEnvValue('ADMIN_EMAIL')
    const botEmail = this.dashboardSheet.googleAccount.user.email

    const addPermissionToGoogleUser = async (email: string, notify: boolean) =>
      await this.dashboardSheet.googleAccount.DRIVE.permissions.create({
        fileId: consultantSheetId,
        requestBody: {
          type: 'user',
          role: 'writer',
          emailAddress: email,
        },
        sendNotificationEmail: notify,
      })

    await addPermissionToGoogleUser(adminEmail, false)
    await addPermissionToGoogleUser(botEmail, false)
    await addPermissionToGoogleUser(this.consultantSheet.emailToShareSheet, true)
    console.log(`Permissions applied.`)
  }
  private async writeGlobalVariablesToConsultantSheet(consultantSheetId: string) {
    const gv = await this.dashboardSheet.googleAccount.SHEETS.spreadsheets.values.get({
      spreadsheetId: DASHBOARD_ID!,
      range: 'global_variables!A1:C', // sem header, listas diretas
    })

    const gvValues = gv.data.values ?? []
    if (!gvValues.length) {
      throw new Error(`Dashboard.global_variables is empty`)
    }

    await this.dashboardSheet.googleAccount.SHEETS.spreadsheets.values.update({
      spreadsheetId: consultantSheetId,
      range: 'global_variables!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: gvValues },
    })

    console.log(`global_variables populated.`)
  }

  private async registerConsultantInDashboard(consultantSheetId: string) {
    await this.dashboardSheet.googleAccount.SHEETS.spreadsheets.values.append({
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
