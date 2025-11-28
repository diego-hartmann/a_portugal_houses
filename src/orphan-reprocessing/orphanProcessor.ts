import { DashboardRepository } from '../google-sheets/dashboardRepository.js'
import { ConsultantSheetRepository } from '../google-sheets/consultantSheetRepository.js'
import { LeadRoutingEngine } from '../lead-routing/leadRoutingEngine.js'
import { ConsultantProfile, OrphanLeadEntry } from '../lead-models/lead.js'
import { matchConsultants } from '../lead-routing/matcher.js'

export class OrphanProcessor {
  constructor(private readonly dashboard: DashboardRepository, private readonly engine: LeadRoutingEngine) {}

  async reprocessOrphans(
    consultants: ConsultantProfile[],
    sheetRepoFactory: (sheetId: string) => ConsultantSheetRepository,
  ): Promise<void> {
    const orphans = await this.dashboard.listOrphanLeads()
    for (const orphan of orphans) {
      const matches = matchConsultants(orphan, consultants)
      if (!matches.length) continue
      const match = matches[0]!.consultant
      await this.engine.captureLead(orphan, orphan.source || 'orphan_reprocessing', consultants, sheetRepoFactory)
      await this.dashboard.removeOrphanLead(orphan.id)
    }
  }
}
