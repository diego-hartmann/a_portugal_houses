# PH Ecosystem — Business Logic Blueprint

_Versão Final (Reativa, sem Pooling)_

---

# 1. Visão Geral

Sistema inteligente, 100% reativo, de captação e distribuição automática de leads imobiliários:

- Matching por **serviços + regiões**
- **Prioridade por comissão**
- Redistribuição automática (órfãos, lost, deletes)
- Proteção contra deletes indevidos
- Histórico invisível ao consultor (via **snapshots automáticos**)
- Notificações Telegram (admin e consultores)
- Gestão automática das folhas dos consultores
- Dashboard global
- Preenchimento automático de variáveis
- Apps Script para eventos e proteções
- Bot Telegram guiado com listas dinâmicas

**Não existe pooling.**  
Tudo funciona por: **Apps Script → Backend → Ações imediatas**.

---

# 2. Arquitetura Global

## Componentes

- **PH_Dashboard** (folha mestre privada)
- **Leads_Blueprint** (template)
- **Folhas dos consultores** (geradas pelo backend)
- **Backend Node.js + Typescript**
- **Telegram Bot**
- **Google Service Account**
- **Apps Script** (eventos e regras de proteção)

## Segurança

- Dashboard: apenas admin + service account
- Consultor: edita apenas:
  - `Control Panel`
  - colunas autorizadas da aba `Leads`
- Variáveis sensíveis ficam em `.env`
- Apps Script remove automaticamente permissões sobre áreas protegidas

---

# 3. Estrutura das Planilhas

---

## 3.1 PH_Dashboard (Mestre)

### 3.1.1 .env — Variáveis Sensíveis

- lead_blueprint_sheet_id
- app_base_url
- google_private_key
- sheet_service_account
- telegram_bot_token (local/dev/prod)
- port (local/dev/prod)
- TELEGRAM_ADMIN_CHAT_ID
- wa_message_template
- email_message_template
- admin_email

---

### 3.1.2 global_variables

Listas dinâmicas usadas pelo backend e bot:

- provided_services
- regions_of_service
- status
- outras listas necessárias

Copiadas automaticamente para cada consultor.

---

### 3.1.3 captured_leads

Campos adicionais usados pelo sistema de routing:

- source
- matching_sheet_ids
- next_sheet_index
- saved_in_current_sheet_id

---

### 3.1.4 orphan_leads

Leads sem consultor no matching inicial.  
Mesma estrutura de um lead completo + campo `source`.

---

### 3.1.5 consultores_clientes

- id
- company_name
- personal_name_for_contact
- total_leads
- open_leads
- closed_leads
- commission_value
- total_earned
- online_to_receive_new_leads
- notes
- conversion_rate
- pause

---

### 3.1.6 total_earned

Somatório das comissões de todos os consultores.

---

## 3.2 Leads_Blueprint (Template do Consultor)

Abas:

- Start Here
- Control Panel
- **Control Panel History**
- Leads
- Leads History (auditoria)
- global_variables
- Apps Script

---

### 3.2.1 Control Panel — Campos

- company_name
- personal_name_for_contact
- email
- cc_emails
- whatsapp_phone
- receive_email_from_lead
- receive_whatsapp_from_lead
- notification flags
- telegram_chat_ids_for_notifications
- provided_services
- regions_of_service
- **online_to_receive_new_leads**

---

### 3.2.2 Estrutura dos Leads

| Campo             | Descrição                       |
| ----------------- | ------------------------------- |
| id                | UUID                            |
| status            | new / contacted / closed / lost |
| name              | string                          |
| email             | string                          |
| phone             | string                          |
| interest_services | lista                           |
| interest_regions  | lista                           |
| annual_income     | número                          |
| created_at        | timestamp                       |
| created_at_unix   | timestamp                       |
| notes             | texto                           |
| closed_at         | timestamp quando vira closed    |

---

### 3.2.3 Apps Script — Proteções

Protege:

- global_variables!A2:C
- Leads!A, C, D, E, F, G, H, I, J, L
- LeadsHistory!A, C, D, E, F, G, H, I, J, L, M

Consultor só edita:

- Control Panel
- colunas não protegidas de Leads

---

# 4. Folhas dos Consultores (backend)

Quando o backend cria uma nova folha:

1. Duplica a blueprint
2. Renomeia
3. Concede acesso ao consultor
4. Mantém admin + service account + bot
5. Copia global_variables
6. Regista em consultores_clientes
7. Envia notificações (consultor + admin)

---

# 5. Ciclo Completo do Lead

---

## 5.1 Entrada (Bot Telegram)

O bot recolhe:

- name
- email
- phone
- interest_services[]
- interest_regions[]
- annual_income

---

## 5.2 Envio ao Backend

Chamada:
processNewLead(draft)
5.3 Matching (Backend)
Filtros:
online_to_receive_new_leads = true

serviços compatíveis

regiões compatíveis

Ordenação:
commission_value DESC

5.3.1 Routing
Para consultores compatíveis:

matching_sheet_ids → lista ordenada

next_sheet_index → começa em 0

saved_in_current_sheet_id → destino atual

Se houver match:
Backend:

grava em captured_leads

grava na folha do consultor (Leads)

grava snapshot em Leads History

envia notificações

incrementa next_sheet_index

Bot recebe:

json
Copy code
{
"matched": true,
"allow_whatsapp": true,
"allow_email": true,
"consultant_whatsapp": "...",
"consultant_email": "..."
}
Se não houver match:
lead vai para orphan_leads

bot recebe { "matched": false }

6. Fluxo Telegram (Resumo)
   sql
   Copy code
   START
   → ASK_NAME_FULL
   → ASK_INTEREST_SERVICES
   → SELECT_REGIONS
   → ASK_EMAIL
   → ASK_PHONE
   → ASK_ANNUAL_INCOME
   → SHOW_SUMMARY
   → CONFIRM
   → BACKEND
   → RESULT
   Listas dinâmicas:

interest_services = global_variables.provided_services

interest_regions = global_variables.regions_of_service

7. Fluxo de Deletes (Lead CLOSED)
   Quando um lead closed some da aba Leads:

Condições:

existia no Leads History

foi removido

status era closed

Admin recebe:

Redistribuir

Confirmar closed

Notificar consultor

Se consultor for notificado:

Fechei negócio → marca closed

Perdi o lead → redistribui automaticamente

8. Sobrescrita de Leads
   Se o utilizador do bot já existe:

Bot mostra dados atuais

Pergunta se deseja sobrescrever

Backend atualiza Leads e cria novo snapshot no History

9. orphan_leads — Reprocessamento
   Reprocessado quando:

entra novo lead

consultor altera serviços

consultor altera regiões

Quando adotado:

movido para Leads

snapshot criado

atualizado em captured_leads

removido de orphan_leads

10. Modelo Reativo: Apps Script → Backend
    Eliminado pooling.
    Somente Apps Script dispara mudanças relevantes.

Eventos que alteram prioridades:
Novo lead

Alteração em provided_services

Alteração em regions_of_service

Alteração em online_to_receive_new_leads

Deleção de lead

Mudança de status (lost, closed, contacted)

11. Modelo Oficial de Eventos (Apps Script → Backend)
    ts
    Copy code
    export interface ChangedConsultantSheetEvent {
    id: string;
    changes: Change[];
    }

export interface Change {
tabName: "Leads" | "Control Panel";
changeType: "closed" | "lost" | "deleted" | "contacted" | "control_panel_changed";
data: ChangeData;
timestamp?: string;
}

export type ChangeData = ChangedLead | ChangedControlPanel;

export interface ChangedLead {
old: Lead;
new: Lead | null;
}

export interface ChangedControlPanel {
old: ConsultantControlPanel;
new: ConsultantControlPanel;
}

export type ChangePayloadTypeMapper = {
closed: ChangedLead;
lost: ChangedLead;
deleted: ChangedLead;
contacted: ChangedLead;
control_panel_changed: ChangedControlPanel;
}; 12. JSON do Bot (Compacto)
json
Copy code
{
"steps": [
"ASK_NAME_FULL",
"ASK_INTEREST_SERVICES",
"SELECT_REGIONS",
"ASK_EMAIL",
"ASK_PHONE",
"ASK_ANNUAL_INCOME",
"SHOW_SUMMARY",
"FINALIZING"
],
"dynamic_lists": {
"interest_services": "global_variables.provided_services",
"interest_regions": "global_variables.regions_of_service"
},
"final_backend_call": "processNewLead(draft)",
"fields": [
"name",
"email",
"phone",
"interest_services[]",
"interest_regions[]",
"annual_income"
],
"backend_response": {
"matched": "boolean",
"allow_whatsapp": "boolean",
"allow_email": "boolean",
"consultant_whatsapp": "string|null",
"consultant_email": "string|null"
}
}
