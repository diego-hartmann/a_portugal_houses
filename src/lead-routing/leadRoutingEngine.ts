import { DashboardRepository } from '../google-sheets/dashboardRepository.js'
import { ConsultantSheetRepository } from '../google-sheets/consultantSheetRepository.js'
import { matchConsultants } from './matcher.js'
import { LeadHistoryEntry, LeadPayload, ConsultantProfile } from '../lead-models/lead.js'
import { NotificationService } from '../notifications/notificationService.js'
import { nowIso, nowUnixSeconds } from '../utils/time.js'
import { logger } from '../utils/logger.js'

export class LeadRoutingEngine {
  constructor(private readonly dashboard: DashboardRepository, private readonly notifier: NotificationService) {}

  async captureLead(lead: LeadPayload, source: string, consultants: ConsultantProfile[], sheetRepoFactory: (sheetId: string) => ConsultantSheetRepository): Promise<void> {
    const matches = matchConsultants(lead, consultants)
    if (!matches.length) {
      await this.dashboard.appendOrphanLead({ ...lead, source })
      return
    }

    const target = matches[0]!.consultant
    const repo = sheetRepoFactory(target.sheet_id)
    await repo.appendLead(lead)
    await repo.appendLeadHistory({ ...lead, processed: '' })

    await this.dashboard.appendCapturedLead({
      ...lead,
      source,
      matching_sheet_ids: matches.map(m => m.consultant.sheet_id).join(','),
      next_sheet_index: '0',
      saved_in_current_sheet_id: target.sheet_id,
    })

    await this.notifier.notifyAdminNewLead(lead, `Leads – ${target.personal_name_for_contact}`)
  }

  async redistributeLead(
    captured: { matching_sheet_ids: string; next_sheet_index: string; id: string },
    lead: LeadPayload,
    consultants: ConsultantProfile[],
    sheetRepoFactory: (sheetId: string) => ConsultantSheetRepository,
  ): Promise<void> {
    const matches = captured.matching_sheet_ids.split(',').filter(Boolean)
    const currentIndex = Number(captured.next_sheet_index || 0)
    const nextIndex = (currentIndex + 1) % Math.max(matches.length, 1)
    const nextSheetId = matches[nextIndex]
    if (!nextSheetId) {
      await this.dashboard.appendOrphanLead({ ...lead, source: 'redistribution' })
      return
    }
    const consultant = consultants.find(c => c.sheet_id === nextSheetId)
    if (!consultant) {
      await this.dashboard.appendOrphanLead({ ...lead, source: 'redistribution' })
      return
    }
    const repo = sheetRepoFactory(nextSheetId)
    await repo.appendLead(lead)
    await repo.appendLeadHistory({ ...lead, processed: '' })
    await this.dashboard.appendCapturedLead({
      ...lead,
      source: 'redistribution',
      matching_sheet_ids: captured.matching_sheet_ids,
      next_sheet_index: String(nextIndex),
      saved_in_current_sheet_id: nextSheetId,
    })
  }

  async handleOverwrite(
    lead: LeadPayload,
    targetSheetId: string,
    sheetRepoFactory: (sheetId: string) => ConsultantSheetRepository,
    allowOverwrite: boolean,
  ): Promise<void> {
    const repo = sheetRepoFactory(targetSheetId)
    if (allowOverwrite) {
      await repo.overwriteLead(lead.id, lead)
    } else {
      await repo.appendLead(lead)
    }
    await repo.appendLeadHistory({ ...lead, processed: '' })
  }

  async markClosed(
    lead: LeadPayload,
    consultant: ConsultantProfile,
    sheetRepoFactory: (sheetId: string) => ConsultantSheetRepository,
  ): Promise<void> {
    const repo = sheetRepoFactory(consultant.sheet_id)
    const historyEntry: LeadHistoryEntry = {
      ...lead,
      close_status_identified_at: lead.close_status_identified_at || nowIso(),
      processed: 'FALSE',
    }
    await repo.appendLeadHistory(historyEntry)
    await this.notifier.notifyAdminClosed(lead)
    await this.notifier.notifyConsultantClosed(lead, consultant)
  }
}
