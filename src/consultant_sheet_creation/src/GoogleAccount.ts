import { drive_v3, google, sheets_v4 } from 'googleapis'
import Drive = drive_v3.Drive
import Sheets = sheets_v4.Sheets
import { GoogleUser } from './GoogleUser.js'

export class GoogleAccount {
  public readonly DRIVE: Drive
  public readonly SHEETS: Sheets
  public readonly user: GoogleUser

  constructor(user: GoogleUser) {
    this.user = user
    const auth = this.getAuth(this.user.privateKey, this.user.email)
    this.DRIVE = google.drive({ version: 'v3', auth })
    this.SHEETS = google.sheets({ version: 'v4', auth })
  }

  private getAuth(privateKey: string, serviceAccountEmail: string) {
    return new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    })
  }
}
