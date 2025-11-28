import { ConsultantSheetRepository } from '../google-sheets/consultantSheetRepository.js'
import { ConsultantProfile, LeadPayload } from '../lead-models/lead.js'
import { NotificationService } from '../notifications/notificationService.js'

export class DeleteWatcher {
  constructor(private readonly notifier: NotificationService) {}

  async checkForDeletedClosedLeads(
    consultant: ConsultantProfile,
    repository: ConsultantSheetRepository,
    previousSnapshot: LeadPayload[],
  ): Promise<void> {
    const currentLeads = await repository.listLeads()
    const previousClosed = previousSnapshot.filter(lead => lead.status === 'fechado')
    for (const closedLead of previousClosed) {
      const stillExists = currentLeads.some(lead => lead.id === closedLead.id)
      if (!stillExists) {
        await this.notifier.notifyConsultantDeletion(consultant, closedLead.id, `Leads – ${consultant.personal_name_for_contact}`)
      }
    }
  }
}
