# Business Logic Blueprint — Sistema Inteligente de Lead Routing (PH Ecosystem)

## 🎯 Visão Geral
Sistema automático de captação, distribuição e controlo de leads imobiliários com:
- Matching por serviços + regiões  
- Prioridade por comissão  
- Redistribuição automática  
- Protecção contra deletações indevidas  
- Histórico invisível ao consultor  
- Notificações Telegram (admin e consultor)  
- Dashboard global

---

# 📁 Estrutura de Planilhas

---

# 1 — Leads_Blueprint (template para todas as planilhas de consultores)

Cada consultor possui uma cópia com as abas:

| Aba | Função |
|------|--------|
| Start Here | Tutorial do consultor |
| Control Panel | Definições pessoais + flags de notificações + serviços + regiões |
| Leads | Leads activos (escritos pelo backend) |
| Leads History | Snapshot bloqueado + escondido com proteção |
| global_variables | Variáveis para validações e dropdowns |

---

## 1.1 Control Panel — Campos

company_name
personal_name_for_contact
receive_email_from_lead
email
cc_emails
receive_whatsapp_from_lead
whatsapp_phone
receive_notification_on_telegram_when_important_communication (SEMPRE true, bloqueado)
receive_notification_on_telegram_when_new_lead
receive_notification_on_telegram_when_close_lead
telegram_chat_ids_for_notifications
provided_services
regions_of_service
active

yaml
Copy code

---

## 1.2 Estrutura do Lead (Leads / Leads History)

| Campo | Descrição |
|--------|-----------|
| id | UUID |
| status | new / contacted / closed / lost |
| name | Nome |
| email | Email |
| phone | Telefone |
| interest_services | Serviços de interesse |
| interest_regions | Regiões desejadas |
| annual_income | Rendimento anual |
| created_at | Timestamp legível |
| created_at_unix | Timestamp técnico |
| notes | Observações |
| close_status_identified_at | Momento em que o sistema detectou um closed |
| processed | (somente em Leads History, última coluna) |

---

# 2 — PH_Dashboard

Abas principais:

## 2.1 captured_leads
Todos os leads captados, com colunas extra:

| Campo extra | Função |
|-------------|--------|
| source | Origem (bot / form / outro) |
| matching_sheet_ids | Lista ordenada por prioridade (string “A, B, C”) |
| next_sheet_index | Índice da próxima sheet |
| saved_in_current_sheet_id | Planilha onde o lead está actualmente |

---

## 2.2 orphan_leads
Leads sem match no momento da entrada.

| Campo extra | Função |
|-------------|--------|
| source | Origem |

---

## 2.3 consultores_clientes

| Campo | Função |
|--------|--------|
| sheet_id | ID da sheet |
| company_name | Nome comercial |
| personal_name_for_contact | Nome pessoal |
| total_leads | Leads já recebidos |
| open_leads | Leads activos |
| closed_leads | Leads fechados |
| commission_value | Valor da comissão |
| total_earned | Soma teórica das comissões |
| active | Disponível p/ receber leads |
| notes | Notas |
| conversion_rate | % |

---

## 2.4 total_earned
Soma total das células `total_earned` da aba consultores_clientes.

---

# 🔔 Notificações Telegram

## Quando um lead entra numa folha:
- Consultor recebe notificação se `receive_notification_on_telegram_when_new_lead === true`  
- Admin sempre recebe notificação  
- Os textos são diferentes (mensagem para admin ≠ mensagem para consultor)

---

# 🔄 Ciclo Completo do Lead

## 1. Entrada
Quando o lead é captado:
- Guardado em `captured_leads`
- Enviado para `<consultant_sheet>.Leads`
- Inserido em `<consultant_sheet>.Leads History`
- Notificações enviadas conforme flags

---

## 2. Matching inicial

Filtros:
1. active = true  
2. provided_services compatível  
3. regions_of_service compatível  

Ordenação:
- Por `commission_value` (desc)

Resultado gerado:

matching_sheet_ids = "sheetX, sheetY, sheetZ"
next_sheet_index = 0

yaml
Copy code

---

## 3. Redistribuição Automática

### Redistribui automaticamente quando:
| Acção do consultor | Resultado |
|--------------------|-----------|
| Apaga lead com status = new/contacted/lost | Vai para próximo da lista (next_sheet_index + 1) |
| Marca lost | Vai para próximo |

---

### Não redistribui automaticamente quando:
| Caso | Tratamento |
|------|------------|
| Lead CLOSED apagado | Admin é notificado e deve decidir a ação |

---

# ⚠ Fluxo especial — CONSULTOR APAGA LEAD CLOSED

Quando o backend detecta:

- Lead existe em Leads History  
- Lead NÃO existe mais em Leads  
- status = closed  

Então dispara:

## Mensagem no Telegram ao ADMIN:

> “Há um lead apagado com status 'closed'.  
> ID: X  
> Sheet: Y  
> O que deseja fazer?”

### BOTÕES:

1. **Redistribuir**  
   - Envia para a próxima folha por ordem de prioridade  
   - processed = true

2. **Confirmar 'closed'**  
   - processed = true (lead congelado)

3. **Notificar <personal_name_for_contact>**  
   - Envia mensagem ao consultor:  
     “Você apagou um lead marcado como CLOSED. User: X, ID: Y. Isto gera notificação automática.”

4. **Deletei porque fechei negócio**  
   - processed = true  
   - Lead permanece closed e congelado

5. **Deletei porque o user foi perdido**  
   - Lead é redirecionado para a próxima folha  
   - processed = true

Após qualquer selecção:

> “Evite deletar leads directamente. Deletar um lead CLOSED gera notificações automáticas para garantir que nada seja perdido.”

---

# 🚫 O Lead NÃO recebe notificação de closed

Quando status = closed:
- Admin recebe **“Lead convertido!!”**
- Consultor recebe **“Lead fechado! ID: X, Nome: Y”** apenas se:  
  `receive_notification_on_telegram_when_close_lead === true`

---

# ♻ Sobrescrita de Leads Existentes

Quando o utilizador volta ao bot:

1. O backend procura o lead pelo `id`.
2. Se existir, mostra ao utilizador:

> “Já há um user associado a esta conta com os seguintes dados:  
> [nome, email, regiões, serviços, etc.]  
> Deseja sobrescrever?”

3. Se aceitar:
   - Dados actualizados em todas as sheets necessárias  
   - Mantém-se o mesmo ID  
   - Leads History regista a nova versão

---

# 🌱 orphan_leads — Lógica completa

- Leads sem match inicial são colocados em `orphan_leads`.  
- Sempre que:
  - entra um novo lead,  
  - um consultor altera flags,  
  - um consultor activa a sheet,  
  → backend tenta dar match novamente.

- Quando adoptado:
  - Enviado para a folha  
  - Guardado em Leads History  
  - processed = true

---

# ⚙ Triggers (Node.js + SheetsAPI + Telegram Bot API)

| Trigger | Ação |
|---------|------|
| Novo lead | Matching + salvar + notificações |
| Consultor apaga lead (não closed) | Redistribuir |
| Consultor apaga lead closed | Notificação para admin (escolha obrigatória) |
| Lead volta ao bot | Proposta de sobrescrita |
| Admin escolhe “Redistribuir” | Lead renasce como new na próxima sheet |
| Alterações em consultores_clientes | Reprocessar orphan_leads |
| Flags alteradas no Control Panel | Reprocessar orphan_leads |
| Pós-selecção no apagado de closed | Mensagem educativa para consultor |

---

# 🚫 O que consultores NÃO podem ver

- matching_sheet_ids  
- next_sheet_index  
- origem anterior  
- histórico completo (Leads History)  
- processed  
- total_earned global  
- lógica interna do dashboard  

---

# 🛠 Stack Tecnológica

- Node.js + Typescript  
- SheetsAPI  
- Telegram Bot API  
- Render (Worker 24/7)  
*(Sem base de dados por agora)*

---

# ✔ Concluído
Este documento representa toda a lógica real do sistema Portugal Houses — Roteamento Automático de Leads.
