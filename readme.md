# Business Logic Blueprint — Sistema Inteligente de Lead Routing com Priority, Tracking e Histórico

## 🎯 Visão Geral

Sistema de distribuição inteligente de leads entre consultores, com:
- Matching por região + tipo de serviço
- Prioridade baseada em comissão (commission_value)
- Roteamento automático com fallback e redistribuição controlada
- Proteção contra leads apagados, falsos CLOSED e “sumidos”
- Histórico interno invisível aos consultores, com confirmação de fechamento
- Monitorização e controle total pelo administrador (dashboard)

---

## 🗃 Estrutura de Dados — Fontes

| Planilha | Função |
|----------|--------|
| Leads_Prod.xlsx | Lead principal do consultor (página Leads) |
| Leads_History (oculta) | Snapshot de Leads, protege contra exclusões |
| Dashboard.xlsx | Monitorização geral, métricas, matching e orphans |
| Consultores_clientes | Dados oficiais de consultores, regiões, serviços, comissões, chat_id |
| orphan_leads | Leads sem atendimento disponível ou sem match atual |

---

## 🧬 Estrutura do Lead (igual em Leads e Leads_History)

Campos originais (base):

| Campo | Descrição |
|--------|-----------|
| id | Identificador único (UUID ou timestamp+hash) |
| name, phone, email | Identificação do contato |
| interest_services | Tipos de serviço procurados |
| interest_regions | Regiões desejadas |
| anual_income | Rendimento anual aproximado |
| created_at | Timestamp original visível |
| created_at_unix | Timestamp técnico |
| status | new / contacted / closed / lost |
| notes | Observações |

Campos técnicos adicionais (somente em Leads_History):

| Campo extra | Função |
|-------------|--------|
| processed | true = já redistribuído ou órfão (não deve ser tocado novamente) |
| confirmed_closed_by_consultor | true = consultor confirmou fechamento via Telegram |

---

## 🔄 Ciclo de Vida do Lead

| Status | Significado |
|--------|-------------|
| new | Lead nunca direcionado ou recém-redistribuído |
| contacted | Consultor recebeu e iniciou contacto |
| closed | Fechado com sucesso (aguarda confirmação) |
| lost | Contato perdido ou rejeitado (vai para próximo consultor) |

---

## ✉ Fluxo de Distribuição e Notificações

1️⃣ **Lead entra no sistema (via form, bot, ou admin)**
- Criado simultaneamente em:
  - Leads_Prod.Leads (sheet do consultor atribuído)
  - Leads_Prod.Leads_History (snapshot)
  - Dashboard.total_leads

2️⃣ **Matching automático:**
- Filtra consultores por:
provided_services + regions_of_service

diff
Copy code
- Ordena por:
commission_value (maior primeiro)

diff
Copy code
- Gera lista:
matching_sheet_ids = "sheetA,sheetC,sheetB"

yaml
Copy code
- O primeiro consultor recebe o lead.

---

### ▶ Regras de Redistribuição (quando consultor APAGA o lead)

| Caso | Ação do sistema |
|------|-----------------|
| Lead desapareceu de Leads e o registro em Leads_History tem `status != closed` | Redistribui automaticamente ao próximo consultor da lista |
| Lead desapareceu de Leads mas registro tem `status = closed` | **NÃO redistribui automaticamente** → notifica admin |
| ADMIN escolhe “redistribuir” via bot | Lead renasce como `status = new` no próximo consultor |
| ADMIN escolhe “manter” | Nada se move, aparece de novo no próximo pooling |

---

### 📌 Notificação ao administrador ao detectar lead CLOSED apagado:

> Um lead marcado como CLOSED foi removido manualmente da Sheet **X**  
> Lead ID: L-00233  
> Ação necessária: **Redistribuir** ou **Manter**  
> (Este lead não será redistribuído automaticamente sem tua decisão)

---

### 🔐 Proteção contra falsos “closed”

1️⃣ Quando consultor marca **closed**, o sistema dispara mensagem ao LEAD:

> Olá! Confirmas que o consultor fechou contigo esse negócio?  
> [Fechei negócio – podem me remover]  
> [Não fechei – mantenham-me ativo na lista]

2️⃣ Se lead confirmar — `confirmed_closed_by_consultor = true`  
 → o lead **nunca mais será redistribuído**

3️⃣ Se lead negar — sistema mantém “contacted” ou “lost”

> Nota: consultor nunca vê esta confirmação, nem histórico.

---

## 🧠 Campo `processed` — como funciona

| Situação | processed |
|----------|-----------|
| Lead acabou de entrar na sheet | false |
| Lead foi movido para próximo consultor | true na versão anterior |
| Lead foi enviado para orphan_leads | true |
| ADMIN redistribuiu manualmente | true |
| Lead fechado e confirmado | true (futuro semi-congelado) |

> Um registro com `processed=true` **nunca entra em novo matching ou redistribuição**.

---

## 🌱 orphan_leads (Dashboard)

| Campo | Função |
|--------|--------|
| id | Identificador |
| interest_services / regions | Dados para matching |
| matching_sheet_ids | Lista potencial gerada |
| next_sheet_index | Próxima tentativa |
| processed | false até ser recolocado |
| notes | tracking interno |

- Quando surgir novo consultor ou atualizar configurações, backend reprocessa esta aba.
- Quando lead for redistribuído, processed=true e ele sai desta aba.

---

## ⚙ Backend - Triggers

| Trigger | Ação |
|---------|------|
| Novo lead | Matching + notificação |
| Consultor apagou lead `lost` ou `contacted` | Redistribuir automaticamente |
| Consultor apagou lead `closed` | Notificar admin (decision required) |
| Consultor marca closed | Notificar lead (confirmação) |
| Lead confirma fechamento | Congela lead (não redistribuir) |
| Lead nega fechamento | Pode ser redistribuído |
| ADMIN redistribui manualmente | Renascido como `new` na próxima sheet |

---

## 🚫 O que os consultores **NUNCA** podem ver

| Item oculto | Motivo |
|-------------|--------|
| matching_sheet_ids | Evita competição / desconforto |
| previous_sheet_id / origem | Confidencial |
| processed flag | Lógica backend |
| confirmed_closed_by_consultor | Proteção de privacidade |
| total_earned (comissões do admin) | Financeiro privado |
| histórico completo do lead | Proteção estratégica |

---

## 📌 Confirmado pelo administrador

✔ Leads CLOSED permanecem no Dashboard com status `closed`  
✔ Admin recebe notificação se consultor apagar um lead fechado  
✔ Admin pode decidir manualmente redistribuir ou não  
✔ Lead renasce como `new` quando redistribuído manualmente  
✔ Consultor nunca vê histórico, prioridade ou sheet anteriores  
✔ Confirmed_closed_by_consultor bloqueia redistribuição futura  
✔ Não há override manual de prioridade entre consultores  

---

## 💻 Pronto para implementação

Pode ser implementado com:
- Node.js backend (cron + webhooks + Telegram Bot API)
- Google Apps Script ou Sheets API
- Firebase / MongoDB para tracking real
- Telegram bot para consultores, admin e lead

---

> Este documento descreve TODA a lógica de negócio.  
> Uma IA (ex: Claude, Codeium, Cursor, GPT-Code) pode transformar isto em:  
> 📊 Modelos de BD → 🛠 APIs → 🤖 Bot → 📈 Dashboard → 🔗 Automação.
