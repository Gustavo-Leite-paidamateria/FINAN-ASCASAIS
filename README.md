# FinançaCasal

Aplicativo PWA para gerenciamento de finanças em casal, construido com arquitetura MVC em JavaScript vanilla.

## Arquitetura

O projeto segue o padrão **MVC (Model-View-Controller)** para garantir escalabilidade e manutenibilidade.

```
src/
├── models/           # Estruturas de dados e entidades
│   └── index.js      # Transaction, Budget, Card, Wallet, Goal, Debt, etc.
├── views/            # Templates HTML e componentes reutilizáveis
├── controllers/      # Lógica de negócio e orquestração
│   ├── DashboardController.js
│   ├── PlanningController.js
│   ├── DebtController.js
│   ├── ReportsController.js
│   ├── TransactionController.js
│   ├── GoalController.js
│   └── AuthController.js
├── services/        # Comunicação externa e utilitários
│   ├── supabaseService.js    # Integração com Supabase
│   ├── storageService.js     # LocalStorage
│   └── notificationService.js # Toasts
├── routes/          # Sistema de roteamento
│   └── router.js
└── App.js           # Ponto de entrada principal
```

### Estrutura MVC

| Camada | Responsabilidade |
|--------|------------------|
| **Models** | Representam entidades de dados com validação e métodos de parsing. Encapsulam a lógica de transformação de dados. |
| **Views** | Templates HTML renderizados pelos controllers. Mantidos no `index.html` como seções modulares. |
| **Controllers** | Contém toda lógica de negócio, intermedia Models e Views, e gerencia eventos de UI. |
| **Services** | Abstraem comunicação com APIs externas (Supabase) e armazenamento local. |

## Temas

O aplicativo suporta **tema claro e escuro** com persistência em localStorage.

### Alternar Tema
- Botões no header: ☀️ (claro) / 🌙 (escuro)
- Preferência salva automaticamente em `localStorage`

### Variáveis CSS
```css
[data-theme="light"] {
    --bg-prime: #f1f5f9;
    --text-prime: #0f172a;
    /* ... */
}
```

## Responsividade

O layout é **mobile-first** com otimizações para desktop:

| Breakpoint | Largura Máxima | Layout |
|------------|----------------|--------|
| Mobile | 480px | Coluna única |
| Tablet | 768px | 4 colunas stats |
| Desktop | 1024px+ | Grid 2 colunas |

### Desktop Features
- Gráficos lado a lado
- Budget e Owner breakdown lado a lado
- Cards de stats em 4 colunas
- Modais mais largos

## Modelos

### Transaction
```javascript
{
    id, tipo, valor, descricao, categoria, data,
    forma_pagamento, status, owner, card_id, wallet_id
}
```

### UserConfig
Agrega todos os dados de configuração do usuário:
- `budgets` - Limites por categoria
- `scheduledBills` - Contas fixas recorrentes
- `goals` - Objetivos de economia
- `debts` - Dívidas e financiamentos
- `cards` - Cartões de crédito
- `wallets` - Contas/carteiras
- `installments` - Parcelamentos

## Controllers

### DashboardController
- Renderiza métricas financeiras (receitas, despesas, projeção)
- Renderiza gráficos (categoria, diária)
- Renderiza lista de transações com filtros
- Renderiza orçamentos e metas
- Processamento automático de contas

### PlanningController
- Gerenciamento de orçamentos
- CRUD de contas programadas
- CRUD de cartões
- CRUD de carteiras
- Cálculo de break-even

### DebtController
- Renderização de lista de dívidas
- Registro de pagamentos
- Cálculo de progresso

### ReportsController
- Geração de relatórios por período
- Renderização de gráficos comparativos
- Exportação CSV

### TransactionController
- CRUD de transações
- Suporte a divisão multi-categoria
- Smart matching com contas programadas
- Gerenciamento de parcelamentos

## Serviços

### SupabaseService
```javascript
// Métodos principais
fetchTransactions(startDate, endDate)
fetchAllTransactions(startDate, endDate)
insertTransaction(transaction)
updateTransaction(id, transaction)
deleteTransaction(id)
loadConfig()
saveConfig(config)
```

### StorageService
Gerencia persistência em localStorage:
- `saveConfig()` / `loadConfig()`
- `saveUser()` / `getUser()`
- `setTheme()` / `getTheme()`
- `clearUser()`

### NotificationService
Sistema de toasts com tipos: `success`, `error`, `warning`, `info`

## Rotas

O sistema suporta navegação entre views:

- `dashboard-view` - Painel principal
- `planning-view` - Central de planejamento
- `debts-view` - Gerenciamento de dívidas
- `reports-view` - Relatórios

## Tech Stack

| Tecnologia | Uso |
|------------|-----|
| Vanilla JavaScript | Lógica da aplicação |
| Supabase | Backend/Database |
| Chart.js | Gráficos |
| CSS Glassmorphism | UI Design |
| PWA | Service Worker + Manifest |

## Desenvolvimento

### Adicionando novas funcionalidades

1. **Criar Model** em `src/models/index.js`:
```javascript
export class NewEntity {
    constructor(data = {}) { ... }
}
```

2. **Criar/editar Controller** em `src/controllers/`:
```javascript
export class NewController {
    render(config) { ... }
}
```

3. **Registrar no App.js**:
```javascript
this.newController = new NewController();
```

4. **Adicionar eventos** em `setupEventListeners()`

5. **Criar método global** se necessário para eventos inline:
```javascript
window.app.newMethod = () => this.newController.method();
```

## Variáveis de Ambiente

O projeto usa conexão direta com Supabase. Para configurar:

```javascript
// src/services/supabaseService.js
const SUPABASE_URL = 'your-url';
const SUPABASE_KEY = 'your-key';
```

## PWA

O aplicativo suporte modo offline via Service Worker:
- Cache de assets estáticos
- Sincronização com Supabase quando online

## Funcionalidades Principais

- Dashboard financeiro com métricas
- Orçamentos por categoria
- Contas programadas automáticas
- Gestão de múltiplos cartões
- Conciliação de faturas
- Metas de economia
- Gestão de dívidas
- Relatórios customizados
- Exportação CSV
- Sistema de gamificação
- Alertas smart (vencimento de faturas, orçamento)
- **Tema claro/escuro**
- **Design responsivo para desktop**
