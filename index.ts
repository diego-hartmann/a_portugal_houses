import { createGoogleClients } from './src/google-sheets/client.js'
import { getBaseEnvironment } from './src/utils/env.js'
import { DashboardRepository } from './src/google-sheets/dashboardRepository.js'
import { ConfigService } from './src/utils/config.js'
import { NotificationService } from './src/notifications/notificationService.js'
import { LeadRoutingEngine } from './src/lead-routing/leadRoutingEngine.js'
import { ConsultantSheetFactory } from './src/consultant-sheet-factory/factory.js'
import { OrphanProcessor } from './src/orphan-reprocessing/orphanProcessor.js'
import { SheetService } from './src/google-sheets/sheetService.js'
import { createBot } from './src/telegram-bot/bot.js'
import { DeleteWatcher } from './src/admin-alerts/deleteWatcher.js'
import { logger } from './src/utils/logger.js'

async function bootstrap() {
  const baseEnv = getBaseEnvironment()
  const googleClients = createGoogleClients()
  const dashboardRepo = new DashboardRepository(googleClients.sheets, baseEnv.dashboardSheetId)
  const configService = new ConfigService(dashboardRepo)
  const runtimeConfig = await configService.loadRuntimeConfig()

  const notifier = new NotificationService(runtimeConfig)
  const routingEngine = new LeadRoutingEngine(dashboardRepo, notifier)
  const sheetService = new SheetService()
  const orphanProcessor = new OrphanProcessor(dashboardRepo, routingEngine)
  const deleteWatcher = new DeleteWatcher(notifier)

  const consultants = await dashboardRepo.listConsultants()
  const sheetRepoFactory = (sheetId: string) => sheetService.createConsultantRepository(sheetId)

  createBot(runtimeConfig, { engine: routingEngine, consultants, sheetRepoFactory })

  await orphanProcessor.reprocessOrphans(consultants, sheetRepoFactory)

  logger.info('Lead routing ecosystem initialized')
}

bootstrap().catch(err => {
  logger.error('Failed to bootstrap backend', err)
  process.exit(1)
})
