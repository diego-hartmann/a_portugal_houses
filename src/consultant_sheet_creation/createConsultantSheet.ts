import { google } from 'googleapis'

const LOG = '[createConsultantSheet]'
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
]

// A ÚNICA env real
const DASHBOARD_ID = process.env.DASHBOARD_SHEET_ID

// Lê a .ENV do Dashboard
async function loadDashboardEnv(sheets: any) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: DASHBOARD_ID,
    range: '.ENV!A2:B',
  })

  const rows = res.data.values ?? []
  const env: Record<string, string> = {}

  for (const [k, v] of rows) {
    env[k.trim().toUpperCase()] = (v ?? '').trim()
  }

  return env
}

// Função principal
export async function createConsultantSheet({
  consultantName,
  consultantEmail,
  companyName,
}: {
  consultantName: string
  consultantEmail: string
  companyName?: string
}) {
  if (!DASHBOARD_ID) throw new Error('Missing DASHBOARD_SHEET_ID')

  // 1) Cliente temporário só para ler a .ENV
  const tempAuth = new google.auth.JWT()
  const tempSheets = google.sheets({ version: 'v4', auth: tempAuth })

  const env = await loadDashboardEnv(tempSheets)

  // 2) Criar cliente real com a private key & service account
  const serviceAccount = env['SHEET_SERVICE_ACCOUNT']
  const privateKey = env['GOOGLE_PRIVATE_KEY'].replace(/\\n/g, '\n')

  const auth = new google.auth.JWT(serviceAccount, undefined, privateKey, SCOPES)
  const drive = google.drive({ version: 'v3', auth })
  const sheets = google.sheets({ version: 'v4', auth })

  const blueprintId = env['LEAD_BLUEPRINT_SHEET_ID']
  const adminEmail = env['ADMIN_EMAIL']

  // 3) Duplicar Blueprint
  const copy = await drive.files.copy({
    fileId: blueprintId,
    requestBody: { name: `Leads – ${consultantName}` },
  })

  const newSheetId = copy.data.id
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${newSheetId}`

  console.log(LOG, '➜ created:', newSheetId)

  // 4) Permissões
  const addPerm = async (email: string, notify = false) =>
    drive.permissions.create({
      fileId: newSheetId!,
      requestBody: { type: 'user', role: 'writer', emailAddress: email },
      sendNotificationEmail: notify,
    })

  await addPerm(adminEmail, false) // admin
  await addPerm(serviceAccount, false) // bot
  await addPerm(consultantEmail, true) // consultor

  // 5) Copiar global_variables
  const gv = await sheets.spreadsheets.values.get({
    spreadsheetId: DASHBOARD_ID,
    range: 'global_variables!A1:C',
  })

  await sheets.spreadsheets.values.update({
    spreadsheetId: newSheetId!,
    range: 'global_variables!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: gv.data.values ?? [] },
  })

  // 6) Registrar consultor no dashboard
  await sheets.spreadsheets.values.append({
    spreadsheetId: DASHBOARD_ID,
    range: 'consultores_clientes!A2:K',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [
        [
          newSheetId,
          companyName ?? '',
          consultantName,
          0,
          0,
          0,
          '', // commission_value
          0, // total_earned
          true, // active
          '',
          '',
        ],
      ],
    },
  })

  // 7) Retorno final
  return {
    sheetId: newSheetId!,
    sheetUrl,
    consultantName,
    consultantEmail,
  }
}
