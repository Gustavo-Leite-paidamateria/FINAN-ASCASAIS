# Documento de Testes Funcionais (QA)

Este documento centraliza o mapeamento de interface (UI) e os casos de teste críticos para a aplicação **Finanças em Casal**. Deve ser atualizado a cada nova rodada de testes.

## 1. Mapeamento de Interface (Botões)

| Tela | Botão (ID/Texto) | Função chamada | Testado? | Status | Observação |
|---|---|---|---|---|---|
| Geral (App) | `theme-dark` / `theme-light` | `toggleTheme()` | [ ] | - | Alterna visual |
| Geral (App) | `header-family-btn` | `openFamilyManager()` | [ ] | - | Abre modal família |
| Geral (App) | `help-btn` | `setupHelp()` | [ ] | - | Abre drawer de ajuda |
| Geral (App) | `logout-btn` | `logout()` | [ ] | - | Desloga usuário |
| Dashboard | `prev-month` / `next-month` | `navigateMonth()` | [ ] | - | Navega meses |
| Dashboard | `view-all-btn` | `renderTransactions()` | [ ] | - | Lista completas |
| Planejamento | `add-wallet-btn` | `addWallet()` | [ ] | - | Abre modal conta |
| Planejamento | `add-card-btn` | `addCard()` | [ ] | - | Abre modal cartão |
| Planejamento | `save-budgets-btn` | `saveBudgets()` | [ ] | - | Salva orçamentos |
| Planejamento | `add-scheduled-btn` | `addScheduledBill()` | [ ] | - | Abre modal conta fixa |
| Dívidas | `add-debt-btn` | `addDebt()` | [ ] | - | Abre modal dívida |
| Relatórios | `generate-report-btn` | `generateReport()` | [ ] | - | Gera gráficos |
| Relatórios | `export-btn` / `export-excel-btn` | `exportCsv() / exportExcel()`| [ ] | - | Exporta dados |
| Calendário | `calendar-prev` / `next` | `navigate()` | [ ] | - | Muda mês no calendário |
| Modal Transação | `toggle-split-btn` | `toggleSplitMode()` | [ ] | - | Ativa divisão de categorias |
| Modal Transação | `save-trans-btn` | `save()` | [ ] | - | Salva a transação |

*(Nota: Alguns botões menores de fechar modais `close-*` foram omitidos para focar nos fluxos de dados)*

## 2. Mapeamento de Interface (Formulários)

| Tela | Formulário (ID) | Campos | Validação Presente? | Testado? |
|---|---|---|---|---|
| Login | `login-form` | email, password | HTML5 (`required`) | [ ] |
| Transação | `transaction-form` | amount, pix/card/transfer, date, wallet, etc. | Parcial (App.js) | [ ] |
| Contas Fixas | `scheduled-bill-form` | name, amount, day, category, etc. | HTML5 (`required`) | [ ] |
| Objetivos | `goal-form` | name, target, current, deadline | HTML5 (`required`) | [ ] |
| Cartões | `card-form` | name, closing, due, limit | HTML5 (`required`) | [ ] |
| Contas/Wallets | `wallet-form` | name, type, balance | HTML5 (`required`) | [ ] |
| Dívidas | `debt-form` | name, type, total, paid, installments, etc. | HTML5 (`required`) | [ ] |
| Perfil | `profile-form` | display-name, email, new-password | Personalizada (Auth) | [ ] |

## 3. Casos de Teste (Fluxos Críticos)

### CT-01: Autenticação e Login
- **Ação:** Inserir credenciais válidas e clicar em "Entrar".
- **Resultado Esperado:** Redirecionamento para o Dashboard, carregamento de saldo e exibição do avatar.

### CT-02: Criação de Nova Transação
- **Ação:** Clicar no FAB (`+`), preencher valor, categoria, data e clicar em "Adicionar".
- **Resultado Esperado:** Modal fecha, notificação de sucesso, saldo no Dashboard atualiza imediatamente, transação aparece na lista.

### CT-03: Criação de Novo Cartão
- **Ação:** Planejamento > "+ Novo Cartão", preencher dados e salvar.
- **Resultado Esperado:** Cartão aparece na lista de configurações, e fica disponível no `<select>` do modal de transação.

### CT-04: Exportação de Relatórios (CSV/Excel)
- **Ação:** Relatórios > Selecionar mês atual > Clicar em "Exportar CSV".
- **Resultado Esperado:** Download imediato do arquivo contendo as transações corretamente separadas e categorizadas.

## 4. Log de Bugs Encontrados (Bug Tracker)

Utilize a tabela abaixo para documentar problemas encontrados durante os testes manuais.

| ID | Data | Descrição do Bug | Tela | Severidade | Status |
|---|---|---|---|---|---|
| BUG-001 | | | | | Aberto |
| BUG-002 | | | | | Aberto |
| BUG-003 | | | | | Aberto |
| BUG-004 | | | | | Aberto |
