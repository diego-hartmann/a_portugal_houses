import { DashboardSheet } from './src/DashboardSheet.js'
import { GoogleAccount } from './src/GoogleAccount.js'
import { GoogleUser } from './src/GoogleUser.js'
import { ConsultantSheet } from './src/ConsultantSheet.js'
import { ConsultantSheetUploader } from './src/ConsultantSheetUploader.js'

const googleServiceUser = new GoogleUser(
  process.env.GOOGLE_PRIVATE_KEY!,
  process.env.SHEET_SERVICE_ACCOUNT!,
)
const googleAccount = new GoogleAccount(googleServiceUser)
const dashboardSheet = new DashboardSheet(googleAccount)
const consultantSheet = new ConsultantSheet('Sheet_Name', 'EmailTo_Share_sheet')
const consultantSheetUploader = new ConsultantSheetUploader(consultantSheet, dashboardSheet)

// This creates the new sheet and shares it with the consultant
await consultantSheetUploader.saveConsultantSheetInGoogleDrive(consultantSheet)

// -----------------------------------------------------------------------------
// Main function
// -----------------------------------------------------------------------------
