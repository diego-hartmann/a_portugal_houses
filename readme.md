PH Ecosystem — Business Logic Blueprint (Versão Refatorada)

1. Visão Geral

Sistema inteligente de captação e distribuição automática de leads imobiliários, com:

Matching por serviços + regiões

Prioridade por comissão

Redistribuição automática (orphan recovery)

Proteção contra deletes indevidos

Histórico invisível ao consultor

Notificações Telegram (admin e consultores)

Gestão automática de folhas de consultores

Dashboard global

Preenchimento automático de variáveis

Proteções via Apps Script

Bot Telegram com fluxo guiado

2. Arquitetura Global
   Componentes

PH_Dashboard (folha mestre privada)

Leads_Blueprint (template)

Folhas dos consultores (geradas pelo backend)

Backend Node.js + TS

Telegram Bot

Service Account

Apps Script (proteções nas folhas duplicadas)

Segurança

Dashboard: somente admin + service account

Consultor: edita apenas a sua folha

Variáveis sensíveis: guardadas na aba .env

Apps Script remove o consultor dos ranges protegidos

3. Estrutura das Planilhas
   3.1 PH_Dashboard (Mestre)
   3.1.1 .env — Variáveis Sensíveis

lead_blueprint_sheet_id

app_base_url

Tokens (local/dev/prod): telegram_bot_token, port

google_private_key

sheet_service_account

TELEGRAM_ADMIN_CHAT_ID

wa_message_template, email_message_template

3.1.2 global_variables

Listas dinâmicas usadas pelo backend e bot:

serviços

regiões

status

outras necessárias

Copiadas para cada folha de consultor.

3.1.3 captured_leads

Campos adicionais de routing:

source

matching_sheet_ids

next_sheet_index

saved_in_current_sheet_id

(O fluxo é explicado em 5.3))\*

3.1.4 orphan_leads

Leads sem destinatário na entrada.
Campos idênticos ao lead normal + source.

3.1.5 consultores_clientes

id

company_name

personal_name_for_contact

total_leads

open_leads

closed_leads

commission_value

total_earned

active

notes

conversion_rate

3.1.6 total_earned

Soma das comissões de todos os consultores.

3.2 Leads_Blueprint (Template do Consultor)
Abas

Start Here

Control Panel

Control Panel History

Leads

Leads History

global_variables

Apps Script

3.2.1 Control Panel — Campos

company_name

personal_name_for_contact

email / cc_emails

whatsapp_phone

receive_email_from_lead

receive_whatsapp_from_lead

notification flags (close/new/important)

telegram_chat_ids_for_notifications

provided_services

regions_of_service

active

3.2.2 Estrutura dos Leads
Campo Descrição
id UUID
status new / contacted / closed / lost
name, email, phone Dados
interest_services Lista
interest_regions Lista
annual_income Número
created_at Timestamp
created_at_unix Timestamp técnico
notes Observações
close_status_identified_at Marca quando vira closed
processed Só no History
3.2.3 Apps Script (Proteções)

Protege:

global_variables!A2:C

Leads!A, C, D, E, F, G, H, I, J, L

LeadsHistory!A, C, D, E, F, G, H, I, J, L, M

Consultores só podem editar:

Control Panel

Colunas autorizadas em Leads

4. Folhas dos Consultores (backend)

Backend faz:

Duplicar blueprint

Renomear

Dar acesso ao consultor

Garantir admin + bot + service account

Preencher global_variables

Registar em consultores_clientes

Notificar consultor + admin

5. Ciclo Completo do Lead
   5.1 Entrada (Bot Telegram)

Bot coleta:

name

email

phone

interest_services[]

interest_regions[]

annual_income

5.2 Envio ao Backend
processNewLead(draft)

5.3 Matching (Backend)
Filtros

active = true

serviços compatíveis

regiões compatíveis

Ordenação

commission_value DESC

5.3.1 Routing

Para a lista de consultores compatíveis:

matching_sheet_ids → lista ordenada

next_sheet_index → inicia em 0

saved_in_current_sheet_id → consultor do assign inicial

Se houver MATCH

Backend:

salva em captured_leads

salva na folha do consultor

salva no Leads History

envia notificações

incrementa next_sheet_index

Retorno ao bot:

{
"matched": true,
"allow_whatsapp": true,
"allow_email": true,
"consultant_whatsapp": "...",
"consultant_email": "..."
}

Se NÃO houver MATCH

Backend:
salva em orphan_leads apenas
{ "matched": false }

6. Fluxo Telegram (resumo visual)
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

Listas dinâmicas

serviços = global_variables.provided_services

regiões = global_variables.regions_of_service

Ecrã final

Nome

Email

Telefone

Serviços

Regiões

Rendimento

Botões:

Confirmar

Editar algo

7. Fluxo de Deletes (Lead CLOSED)
   Quando detetado:

lead existia no History

foi removido do Leads

status era closed

Admin recebe:

Botões:

Redistribuir

Confirmar closed (processed = true)

Notificar consultor

Consultor recebe:

Botões:

Fechei negócio → processed=true

Perdi o lead → redistribuir + processed

8. Sobrescrita de Leads

Se o utilizador do bot já existe:

Bot mostra dados

Pergunta se quer sobrescrever

Backend atualiza Leads + cria nova versão no History

9. orphan_leads — Reprocessamento

Recalcula quando:

entra novo lead

consultor muda serviços

consultor muda regiões

consultor passa a active

Quando adotado:

movido para Leads do consultor

Leads History

captured_leads

removido do orphan_leads

10. Pooling Inteligente

Backend periodicamente:

deteta deletes indevidos

deteta closed sem notificação

processa órfãos

redistribui conforme routing

reage a mudanças no Control Panel

mantém coerência entre Dashboard e folhas

10.1 Monitoriza

Control Panel + History

Leads + History

captured_leads

orphan_leads

consultores_clientes

11. JSON do Bot (compacto)
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
