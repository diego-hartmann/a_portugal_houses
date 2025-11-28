import { google } from "googleapis";

const LOG = "[createConsultantSheet]";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets"
];

// -----------------------------------------------------------------------------
// ENV LOCAIS (mínimo necessário para sequer falar com o Google)
// -----------------------------------------------------------------------------

const DASHBOARD_ID = process.env.DASHBOARD_SHEET_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.SHEET_SERVICE_ACCOUNT;
const RAW_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;

if (!DASHBOARD_ID) {
  throw new Error(`${LOG} Missing process.env.DASHBOARD_SHEET_ID`);
}
if (!SERVICE_ACCOUNT_EMAIL) {
  throw new Error(`${LOG} Missing process.env.SHEET_SERVICE_ACCOUNT`);
}
if (!RAW_PRIVATE_KEY) {
  throw new Error(`${LOG} Missing process.env.GOOGLE_PRIVATE_KEY`);
}

const PRIVATE_KEY = RAW_PRIVATE_KEY.replace(/\\n/g, "\n");

// -----------------------------------------------------------------------------
// Google clients
// -----------------------------------------------------------------------------

const auth = new google.auth.JWT({
  email: SERVICE_ACCOUNT_EMAIL,
  key: PRIVATE_KEY,
  scopes: SCOPES
});

const drive = google.drive({ version: "v3", auth });
const sheets = google.sheets({ version: "v4", auth });

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

type EnvMap = Record<string, string>;

function validateEmail(email: string) {
  const r = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!r.test(email)) {
    throw new Error(`${LOG} Invalid email: ${email}`);
  }
}

async function loadDashboardEnv(): Promise<EnvMap> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: DASHBOARD_ID!,
    range: ".ENV!A2:B"
  });

  const rows = res.data.values ?? [];

  if (!rows.length) {
    throw new Error(`${LOG} .ENV sheet in Dashboard is empty`);
  }

  const env: EnvMap = {};
  for (const [key, value] of rows) {
    env[key.trim().toUpperCase()] = (value ?? "").trim();
  }

  return env;
}


function envOrFail(env: EnvMap, key: string): string {
  const v = env[key.toUpperCase()];
  if (!v) {
    throw new Error(`${LOG} Missing key in Dashboard .ENV: ${key}`);
  }
  return v;
}

// -----------------------------------------------------------------------------
// Main function
// -----------------------------------------------------------------------------

export interface CreateConsultantParams {
  consultantName: string;
  consultantEmail: string;
  companyName?: string;
}

export interface CreateConsultantResult {
  sheetId: string;
  sheetUrl: string;
  consultantName: string;
  consultantEmail: string;
}

export async function createConsultantSheet(
  params: CreateConsultantParams
): Promise<CreateConsultantResult> {
  const { consultantName, consultantEmail, companyName } = params;

  console.log(
    `${LOG} Creating sheet for ${consultantName} <${consultantEmail}>`
  );

  validateEmail(consultantEmail);

  // 1) Lê .ENV da Dashboard (tudo em UPPERCASE)
  const env = await loadDashboardEnv();
  const blueprintId = envOrFail(env, "LEAD_BLUEPRINT_SHEET_ID");
  const adminEmail = envOrFail(env, "ADMIN_EMAIL");
  const botEmail = envOrFail(env, "SHEET_SERVICE_ACCOUNT"); // o próprio bot

  // 2) Duplicar Blueprint
  const copy = await drive.files.copy({
    fileId: blueprintId,
    requestBody: { name: `Leads – ${consultantName}` }
  });

  const newSheetId = copy.data.id;
  if (!newSheetId) {
    throw new Error(`${LOG} drive.files.copy returned no id`);
  }

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${newSheetId}`;
  console.log(`${LOG} Sheet created: ${newSheetId}`);

  // 3) Permissões (admin, bot, consultor)
  const addPerm = (email: string, notify: boolean) =>
    drive.permissions.create({
      fileId: newSheetId,
      requestBody: {
        type: "user",
        role: "writer",
        emailAddress: email
      },
      sendNotificationEmail: notify
    });

  await addPerm(adminEmail, false);
  await addPerm(botEmail, false);
  await addPerm(consultantEmail, true);

  console.log(`${LOG} Permissions applied.`);

  // 4) Copiar global_variables da Dashboard
  const gv = await sheets.spreadsheets.values.get({
    spreadsheetId: DASHBOARD_ID!,
    range: "global_variables!A1:C" // sem header, listas diretas
  });

  const gvValues = gv.data.values ?? [];
  if (!gvValues.length) {
    throw new Error(`${LOG} Dashboard.global_variables is empty`);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: newSheetId!,
    range: "global_variables!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: gvValues }
  });

  console.log(`${LOG} global_variables populated.`);

  // 5) Registar consultor na Dashboard
  sheets.spreadsheets.values.append({
    spreadsheetId: DASHBOARD_ID!,
    range: "consultores_clientes!A2:K",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          newSheetId,          // sheet_id
          companyName ?? "",   // company_name
          consultantName,      // personal_name_for_contact
          0,                   // total_leads
          0,                   // open_leads
          0,                   // closed_leads
          "",                  // commission_value
          0,                   // total_earned
          true,                // active
          "",                  // notes
          ""                   // conversion_rate
        ]
      ]
    }
  });

  console.log(`${LOG} Consultant registered in consultores_clientes.`);

  return {
    sheetId: newSheetId,
    sheetUrl,
    consultantName,
    consultantEmail
  };
}
