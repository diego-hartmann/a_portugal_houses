import { getEnvironment } from '../environment.js'
import { APP } from './src/App.js'
import {
  Change,
  ChangeData,
  ChangedConsultantSheetEvent,
} from '../../apps-scripts-payloads-models.js'
import { Lead } from '../lead_creation/src/flows/models.js'

// Tipos oficiais do evento (garantem validação leve)

const environment = await getEnvironment()

// ---------------------------------------------------------------------------
// Web Server
// ---------------------------------------------------------------------------
export class WebServer {
  constructor() {
    /**
     * Health Check
     */
    APP.get('/health', (_req, res) => {
      res.send('ok')
    })

    /**
     * =====================================================================
     * 1) ENDPOINT — RECEBE EVENTOS DO APPS SCRIPT
     * =====================================================================
     * Rota chamada pelos App Scripts assim:
     * UrlFetchApp.fetch(BACKEND_URL, { method: "post", payload: event })
     *
     * O formato esperado é:
     *
     * {
     *   id: "consultant-sheet-id",
     *   changes: [
     *     {
     *       tabName: "Leads" | "Control Panel",
     *       changeType: "closed" | "lost" | "deleted" | "contacted" | "control_panel_changed",
     *       timestamp: "...",
     *       data: { old: ..., new: ... }
     *     }
     *   ]
     * }
     */
    APP.post('/consultant-sheet/change', async (req, res) => {
      try {
        const changedConsultantSheetEvent = req.body as ChangedConsultantSheetEvent

        if (
          !changedConsultantSheetEvent ||
          !changedConsultantSheetEvent.id ||
          !Array.isArray(changedConsultantSheetEvent.changes)
        ) {
          return res.status(400).json({ error: 'Invalid payload' })
        }

        // Process each change
        for (const change of changedConsultantSheetEvent.changes) {
          await handleConsultantSheetChange(changedConsultantSheetEvent.id, change)
        }

        res.json({ ok: true })
      } catch (err) {
        console.error('Error in /consultant-sheet/change:', err)
        res.status(500).json({ error: 'Internal server error' })
      }
    })

    /**
     * Inicia o servidor HTTP
     */
    const PORT = environment.secrets.port || 3000
    APP.listen(PORT, () => {
      console.log('HTTP up on', PORT)
    })
  }
}

// ============================================================================
// CORE LOGIC — STUBS (tu vais implementar estes mais tarde)
// ============================================================================

/**
 * Processa cada change vindo da planilha do consultor.
 * Este método será o coração do sistema:
 * - closed → notificar + marcar closed_at
 * - deleted → redistribuir lead
 * - lost → redistribuir
 * - contacted → opcional
 * - control_panel_changed → reprocessar leads do consultor + órfãos
 */
async function handleConsultantSheetChange(sheetId: string, change: Change) {
  console.log('Received consultant sheet change:', sheetId, change)

  switch (change.changeType) {
    case 'closed':
      // TODO: notificar admin/consultor
      await onLeadClosed(sheetId, change.data)
      break

    case 'lost':
      // TODO: redistribuir lead
      await onLeadLost(sheetId, change.data)
      break

    case 'deleted':
      // TODO: deleted trigger → redistribuir ou marcar deleted
      await onLeadDeleted(sheetId, change.data)
      break

    case 'contacted':
      // OPCIONAL: podes ignorar ou logar
      await onLeadContacted(sheetId, change.data)
      break

    case 'control_panel_changed':
      // TODO: reprocessar leads próprios + órfãos
      await onControlPanelChanged(sheetId, change.data)
      break

    default:
      console.warn('Unknown changeType:', change.changeType)
  }
}

// ============================================================================
// HANDLERS — STUBS (para implementares depois)
// ============================================================================

async function onLeadClosed(sheetId: string, data: ChangeData) {
  console.log('CLOSED event:', sheetId, data)
}

async function onLeadLost(sheetId: string, data: ChangeData) {
  console.log('LOST event:', sheetId, data)
}

async function onLeadDeleted(sheetId: string, data: ChangeData) {
  console.log('DELETED event:', sheetId, data)
}

async function onLeadContacted(sheetId: string, data: ChangeData) {
  console.log('CONTACTED event:', sheetId, data)
}

async function onControlPanelChanged(sheetId: string, data: ChangeData) {
  console.log('CONTROL PANEL CHANGED:', sheetId, data)
}
