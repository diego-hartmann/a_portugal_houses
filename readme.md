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
- Gestão automática de folhas dos consultores
- Preenchimento automático de variáveis pelo backend
- Proteção automática de colunas via Apps Script

---

# 📁 Estrutura Global do Sistema

O sistema funciona com:

1. **PH_Dashboard** (folha mestre, privada)
2. **Leads_Blueprint** (modelo usado para criar folhas dos consultores)
3. **Folhas individuais dos consultores** (criadas pelo backend que duplica a leads_blueprint)
4. **Backend Node.js**
5. **Service Account** para leitura/escrita nas sheets
6. **Telegram Bot**

### 🔐 Segurança:

- A Dashboard é **privada**, com acesso apenas:
  - ao **admin** (tu)
  - à **service account** (como editora)
- Consultores **não** têm acesso à Dashboard
- Variáveis sensíveis são guardadas na Dashboard na aba .env

---

# 🗂 Estrutura das Planilhas

---

# 1 — PH_Dashboard (Mestre)

A Dashboard é o **núcleo** do sistema. Nela ficam:

### **Abas principais**

- **captured_leads**
- **orphan_leads**
- **consultores_clientes**
- **total_earned**
- **global_variables**
- **.env**

---

## 1.1 Aba `.env` (da Dashboard)

Contém **variáveis sensíveis** usadas como _runtime config_:

- google_private_key
- lead_blueprint_sheet_id
- telegram_bot_token
- app_base_url
- local_telegram_bot_token
- local_port
- dev_telegram_bot_token
- dev_port
- prod_telegram_bot_token
- prod_port
- sheet_service_account
- TELEGRAM_ADMIN_CHAT_ID
- wa_message_template
- email_message_template

---

## 1.2 Aba global_variables (Dashboard)

Variáveis e listas usadas pelo sistema para:

- dropdowns
- validações
- configurações

Backend as lê e seta nas folhas de cada consultor

---

## 1.3 captured_leads (Dashboard)

Leads adicionados a sheets de consultores, com as colunas extras:

- `source`
- `matching_sheet_ids`
- `next_sheet_index`
- `saved_in_current_sheet_id`

---

---

## 1.4 orphan_leads (Dashboard)

Leads sem match inicial, com a única coluna extra:

- `source`

---

## 1.5 consultores_clientes

Contém:

- id
- company_name
- personal_name_for_contact
- total_leads
- open_leads
- closed_leads
- commission_value
- total_earned
- active
- notes
- conversion_rate

---

## 1.6 total_earned

- soma de todas as `total_earned` de consultores_clientes

---

# 2 — Leads_Blueprint (Template das folhas dos consultores)

Cada consultor recebe uma cópia idêntica.

### Abas:

- `Start Here`
- `Control Panel`
- `Leads`
- `Leads History`
- `global_variables` (preenchido pelo backend)
- Apps Script que protege colunas automaticamente

---

## 2.1 Control Panel — Campos

- company_name
- personal_name_for_contact
- receive_email_from_lead
- email
- cc_emails
- receive_whatsapp_from_lead
- whatsapp_phone
- receive_notification_on_telegram_when_important_communication (sempre true)
- receive_notification_on_telegram_when_new_lead
- receive_notification_on_telegram_when_close_lead
- telegram_chat_ids_for_notifications
- provided_services
- regions_of_service
- active

---

## 2.2 Estrutura do Lead (Leads / Leads History)

| Campo                      | Descrição                                 |
| -------------------------- | ----------------------------------------- |
| id                         | UUID                                      |
| status                     | new / contacted / closed / lost           |
| name                       | Nome                                      |
| email                      | Email                                     |
| phone                      | Telefone                                  |
| interest_services          | Serviços                                  |
| interest_regions           | Regiões                                   |
| annual_income              | Rendimento                                |
| created_at                 | Timestamp                                 |
| created_at_unix            | Timestamp técnico                         |
| notes                      | Observações                               |
| close_status_identified_at | Marca quando o sistema detecta closed     |
| **processed**              | (somente em Leads History, última coluna) |

---

## 2.3 Apps Script (Blueprint)

Todas as cópias herdam o script:

- Bloqueia automaticamente colunas sensíveis
- Mantém apenas:
  - admin
  - service account  
    com permissão de edição
- Consultores podem editar apenas as colunas autorizadas

### Script (resumo)

Protege:

- `global_variables!A2:C`
- `Leads!A, C, D, E, F, G, H, I, J, L`

Mantendo a linha 1 livre para fórmulas (ex.: URL de permissões).

---

# 3 — Folhas dos Consultores (criadas pelo backend)

O backend:

1. Duplica a Blueprint
2. Renomeia
3. Adiciona o consultor como editor
4. Adiciona admin + bot como editores
5. Preenche a aba `global_variables` com valores da Dashboard
6. Regista no PH_Dashboard.consultores_clientes
7. Notifica consultor e admin via Telegram

---

# 🔄 Ciclo Completo do Lead

## 1. Entrada

Quando o lead é captado:

- Guardado em `captured_leads`
- Enviado para `<consultant_sheet>.Leads`
- Inserido em `<consultant_sheet>.Leads History`
- Apps Script protege colunas
- Notificações enviadas conforme flags

---

## 2. Matching inicial

Filtros:

- active = true
- provided_services compatibles
- regions_of_service compatibles

Ordenação:

- `commission_value` desc

Backend grava:

- matching_sheet_ids
- next_sheet_index
- saved_in_current_sheet_id

---

# ⚠ Fluxo especial — CONSULTOR APAGA LEAD CLOSED

Se o backend detecta:

- lead existe em Leads History
- lead desapareceu de Leads
- status = closed

O admin recebe:

> “Há um lead apagado com status 'closed'.  
> ID: X  
> Sheet: Y  
> O que deseja fazer?”

Botões:

1. **Redistribuir** → envia para próxima folha
2. **Confirmar closed** → processed=true
3. **Notificar consultor**

Quando o consultor então é notificado:

> “Ops! Parece que você deletou um lead cujo status era "closed".  
> ID: X  
> Sheet: Y”

Botões:

1. **Deletei porque fechei negócio :)** → processed=true
2. **Deletei porque perdi o lead :(** → redistribuir e processed=true

Após resposta:

> “Evite deletar leads directamente…”

---

# 🚫 O Lead NÃO recebe notificação de mudança de status para "closed"

Apenas:

- Admin recebe: “Lead convertido!!”
- Consultor recebe (se flag=true): “Lead fechado! ID: X, Nome: Y”

---

# ♻ Sobrescrita de Leads Existentes

Quando um utilizador inicia o bot:

- Backend procura lead pelo id
- Se existir, mostra os dados actuais
- Pergunta:
  > “Deseja sobrescrever?”
- Atualiza todas as sheets relacionadas
- Leads History guarda uma nova versão

---

# 🌱 orphan_leads — Lógica

- Entrada para leads sem match
- Backend tenta recolocar sempre que:
  - novo lead entra
  - consultor muda flags
  - consultor fica active
- Quando adoptado:
  - enviado para Leads do consultor
  - enviado para Leads History do consultor
  - enviado para captured_leads do Dashboard
  - removido de orphan_leads do Dashboard

---

# ⚙ Backend (Node.js + Typescript)

### Responsável por:

- Criar cópias da Blueprint
- Preencher as global_variables das folhas dos consultores
- Fazer matching dos leads com os consultores
- Notificar admin/consultor
- Detectar deletes
- Re-distribuir leads
- Escrever no Dashboard
- Reprocessar orphan_leads
- Garantir integridade das sheets

### Exemplos de chamadas API:

- `drive.files.copy`
- `drive.permissions.create`
- `sheets.values.update`
- `sheets.values.get`

---

# 🔐 Permissões (modelo final)

### Dashboard:

- **Admin** → Editor
- **Service Account** → Editor
- **Ninguém mais**

### Folhas dos Consultores:

- **Consultor** → Editor
- **Admin** → Editor
- **Service Account** → Editor

### Proteções internas:

- Apps Script remove o consultor dos intervalos protegidos
- Consultor edita apenas o Control Panel
- Consultor nunca vê Dashboard

---

# ✔ Conclusão

Este documento descreve:

- Toda a lógica de negócio
- Estrutura de sheets
- Estrutura de abas
- Apps Script
- Processo de duplicação
- Preenchimento de global_variables
- Segurança e permissões
- Fluxo completo do lead
- Tratamento de deletes
- Sobrescrita
- Orphan leads
- Matching
- Lógica de notificação

Perfeito para implementação, manutenção e onboarding técnico.
