export class GoogleUser {
  public readonly email: string
  public readonly privateKey: string
  constructor(email: string, privateKey: string) {
    this.email = email
    this.privateKey = privateKey
  }
}
