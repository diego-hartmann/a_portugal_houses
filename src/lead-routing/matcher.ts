import { ControlPanelFlags, ConsultantProfile, LeadPayload } from '../lead-models/lead.js'

export interface MatchResult {
  consultant: ConsultantProfile
  score: number
}

export function matchConsultants(lead: LeadPayload, consultants: ConsultantProfile[]): MatchResult[] {
  const servicesRequested = lead.interest_services.split(',').map(s => s.trim()).filter(Boolean)
  const regionsRequested = lead.interest_regions.split(',').map(r => r.trim()).filter(Boolean)

  const matches: MatchResult[] = consultants
    .filter(c => c.active)
    .filter(c => matchesServices(servicesRequested, c.services))
    .filter(c => matchesRegions(regionsRequested, c.regions))
    .map(consultant => ({ consultant, score: consultant.commission_value }))

  return matches.sort((a, b) => b.score - a.score)
}

function matchesServices(requested: string[], available: string[]): boolean {
  if (!requested.length) return true
  return requested.some(service => available.includes(service))
}

function matchesRegions(requested: string[], available: string[]): boolean {
  if (!requested.length) return true
  return requested.some(region => available.includes(region))
}
