import { ConsultantSheet } from './src/ConsultantSheet.js'
import { ConsultantSheetUploader } from './src/ConsultantSheetUploader.js'
import { getEnvironment } from '../environment.js'
import { isEmailValid } from '../utils.js'

export async function createConsultantSheetInGoogleDrive(consultantEmail: string) {
  if (!isEmailValid(consultantEmail)) throw new Error(`Invalid email: ${consultantEmail}`)

  const env = await getEnvironment()
  const consultantSheet = new ConsultantSheet(`Leads_${consultantEmail.split('@')[0]}`, consultantEmail)
  const consultantSheetUploader = new ConsultantSheetUploader(consultantSheet, env.dashboardSheet)
  // This creates the new sheet and shares it with the consultant
  await consultantSheetUploader.saveConsultantSheetInGoogleDrive(consultantSheet)
}
