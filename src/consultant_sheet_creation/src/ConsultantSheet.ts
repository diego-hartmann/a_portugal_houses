export class ConsultantSheet {
  sheetName: string = ''
  emailToShareSheet: string = ''
  constructor(sheetName: string, emailToShareSheet: string) {
    this.sheetName = sheetName
    this.emailToShareSheet = emailToShareSheet
  }
}
