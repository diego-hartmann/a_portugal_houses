import { DashboardRepository } from '../google-sheets/dashboardRepository.js'
import { RuntimeConfig } from './env.js'

export class ConfigService {
  constructor(private readonly dashboard: DashboardRepository) {}

  async loadRuntimeConfig(): Promise<RuntimeConfig> {
    return await this.dashboard.fetchEnvConfig()
  }
}
