import { createGoogleClients } from './client.js'
import { DashboardRepository } from './dashboardRepository.js'
import { ConsultantSheetRepository } from './consultantSheetRepository.js'
import { getBaseEnvironment } from '../utils/env.js'

export class SheetService {
  private dashboardRepo: DashboardRepository

  constructor() {
    const { sheets } = createGoogleClients()
    const { dashboardSheetId } = getBaseEnvironment()
    this.dashboardRepo = new DashboardRepository(sheets, dashboardSheetId)
  }

  getDashboardRepository(): DashboardRepository {
    return this.dashboardRepo
  }

  createConsultantRepository(sheetId: string): ConsultantSheetRepository {
    const { sheets } = createGoogleClients()
    return new ConsultantSheetRepository(sheets, sheetId)
  }
}
