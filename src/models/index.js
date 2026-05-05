export const CATEGORIES = [
    "Mercado", "Alimentação", "Transporte", "Casa", "Lazer",
    "Saúde", "Pets", "Compras", "Educação", "Viagem",
    "Presentes", "Investimentos", "Assinaturas", "Outros"
];

const DEFAULT_BUDGETS = {
    "Mercado": 800,
    "Alimentação": 800,
    "Transporte": 300,
    "Casa": 1500,
    "Lazer": 200,
    "Saúde": 200,
    "Pets": 150,
    "Compras": 300,
    "Educação": 200,
    "Viagem": 500,
    "Presentes": 100,
    "Investimentos": 500,
    "Assinaturas": 100,
    "Outros": 200
};

export const FIXED_CATEGORIES = ["Casa", "Transporte", "Saúde", "Pets", "Assinaturas", "Educação"];

export const CATEGORY_ICONS = {
    "Mercado": "fa-cart-shopping",
    "Alimentação": "fa-utensils",
    "Transporte": "fa-car",
    "Casa": "fa-house",
    "Lazer": "fa-gamepad",
    "Saúde": "fa-house-medical",
    "Pets": "fa-paw",
    "Compras": "fa-bag-shopping",
    "Educação": "fa-book",
    "Viagem": "fa-plane",
    "Presentes": "fa-gift",
    "Investimentos": "fa-chart-line",
    "Assinaturas": "fa-tv",
    "Outros": "fa-ellipsis"
};

export const CATEGORY_EMOJIS = {
    "Mercado": "🛒",
    "Alimentação": "🍔",
    "Transporte": "🚗",
    "Casa": "🏠",
    "Lazer": "🎮",
    "Saúde": "🏥",
    "Pets": "🐾",
    "Compras": "🛍️",
    "Educação": "📚",
    "Viagem": "✈️",
    "Presentes": "🎁",
    "Investimentos": "📈",
    "Assinaturas": "📺",
    "Família": "👨‍👩‍👧‍👦",
    "Outros": "📦"
};

export class Transaction {
    constructor(data = {}) {
        this.id = data.id || null;
        this.tipo = data.tipo || 'Despesa';
        this.valor = parseFloat(data.valor) || 0;
        this.descricao = data.descricao || '';
        this.categoria = data.categoria || 'Outros';
        this.data = data.data || new Date().toISOString();
        this.forma_pagamento = data.forma_pagamento || 'pix';
        this.status = data.status || 'Pago';
        this.observacoes = data.observacoes || {};
        this.referencia = data.referencia || null;
        this.owner = data.owner || 'ambos';
        this.pay_method = data.pay_method || data.forma_pagamento || 'pix';
        this.card_id = data.card_id || null;
        this.wallet_id = data.wallet_id || null;
        this.is_subscription = data.is_subscription || false;
        this.payee_id = data.payee_id || null;
        this.workspace_id = data.workspace_id || null;
        this.profile_id = data.profile_id || null;
    }

    static parseFromDb(raw) {
        let meta = { owner: raw.observacoes };
        if (raw.observacoes && raw.observacoes.startsWith('{')) {
            try { meta = JSON.parse(raw.observacoes); } catch(e) {}
        }
        return new Transaction({
            ...raw,
            owner: meta.owner || raw.owner || 'ambos',
            pay_method: raw.forma_pagamento || raw.pay_method,
            card_id: meta.cartao_id || raw.cartao_id || raw.card_id,
            wallet_id: meta.conta_id || raw.conta_id || raw.wallet_id,
            payee_id: raw.payee_id || meta.payee_id || null
        });
    }

    toDbRecord() {
        const meta = {
            owner: this.owner,
            cartao_id: this.card_id,
            conta_id: this.wallet_id,
            payee_id: this.payee_id
        };
        return {
            tipo: this.tipo,
            valor: this.valor,
            descricao: this.descricao,
            categoria: this.categoria,
            data: this.data,
            forma_pagamento: this.forma_pagamento,
            status: this.status,
            observacoes: JSON.stringify(meta),
            referencia: this.referencia,
            payee_id: this.payee_id,
            workspace_id: this.workspace_id,
            profile_id: this.profile_id
        };
    }
}

export class Payee {
    constructor(data = {}) {
        this.id = data.id || 'p_' + Date.now() + Math.random().toString(36).substr(2, 5);
        this.name = data.name || '';
        this.document = data.document || '';
        this.defaultCategory = data.defaultCategory || 'Outros';
        this.observations = data.observations || '';
    }
}

export class Budget {
    constructor(data = {}) {
        this.category = data.category || 'Outros';
        this.limit = parseFloat(data.limit) || 0;
    }

    static getDefaultBudgets() {
        return { ...DEFAULT_BUDGETS };
    }

    static normalizeBudgets(rawBudgets = {}) {
        const normalized = Budget.getDefaultBudgets();

        CATEGORIES.forEach(category => {
            const rawValue = rawBudgets[category];
            if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
                normalized[category] = parseFloat(rawValue) || 0;
            }
        });

        if (
            (rawBudgets.Casa === undefined || rawBudgets.Casa === null || rawBudgets.Casa === '') &&
            rawBudgets.Moradia !== undefined &&
            rawBudgets.Moradia !== null &&
            rawBudgets.Moradia !== ''
        ) {
            normalized.Casa = parseFloat(rawBudgets.Moradia) || normalized.Casa;
        }

        return normalized;
    }
}

export class ScheduledBill {
    constructor(data = {}) {
        this.id = data.id || 's' + Date.now();
        this.name = data.name || '';
        this.amount = parseFloat(data.amount) || 0;
        this.category = data.category || 'Outros';
        this.dueDay = parseInt(data.dueDay) || 1;
        this.isMonthly = data.isMonthly !== false;
        this.count = data.count || null;
        this.startDate = data.startDate || null;
        this.endDate = data.endDate || null;
        this.payMethod = data.payMethod || 'pix';
        this.walletId = data.walletId || null;
        this.cardId = data.cardId || null;
        this.owner = data.owner || 'ambos';
        this.paidMonths = data.paidMonths || [];
    }

    isPaidForDate(date) {
        if (!this.paidMonths || this.paidMonths.length === 0) return false;
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return this.paidMonths.includes(yearMonth);
    }

    isActiveForDate(date) {
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        if (this.startDate && new Date(this.startDate) > monthEnd) return false;
        if (this.endDate && new Date(this.endDate) < monthStart) return false;
        return true;
    }

    toTransactionRecord() {
        const now = new Date();
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const targetDay = Math.min(this.dueDay, lastDayOfMonth);
        const transDate = new Date(now.getFullYear(), now.getMonth(), targetDay, 12);

        return {
            tipo: 'Despesa',
            valor: this.amount,
            descricao: this.name,
            categoria: this.category,
            data: transDate.toISOString(),
            forma_pagamento: this.payMethod,
            status: 'Pago',
            observacoes: JSON.stringify({
                owner: this.owner,
                cartao_id: this.cardId,
                conta_id: this.walletId
            }),
            referencia: 'conta_programada'
        };
    }
}

export class Goal {
    constructor(data = {}) {
        this.id = data.id || 'g' + Date.now();
        this.name = data.name || '';
        this.target = parseFloat(data.target) || 0;
        this.current = parseFloat(data.current) || 0;
        this.deadline = data.deadline || null;
    }

    getProgress() {
        return this.target > 0 ? Math.min((this.current / this.target) * 100, 100) : 0;
    }

    getDaysRemaining() {
        if (!this.deadline) return null;
        const today = new Date();
        const target = new Date(this.deadline);
        return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    }
}

export const WALLET_TYPES = {
    'conta_corrente': { label: 'Conta Corrente', icon: '🏦' },
    'poupanca': { label: 'Poupança', icon: '💰' },
    'investimento': { label: 'Investimento', icon: '📈' },
    'dinheiro': { label: 'Dinheiro', icon: '💵' },
    'outro': { label: 'Outro', icon: '🗂️' }
};

export class Wallet {
    constructor(data = {}) {
        this.id = data.id || 'w_' + Date.now();
        this.name = data.name || 'Conta Principal';
        this.initialBalance = parseFloat(data.initialBalance) || 0;
        this.type = data.type || 'conta_corrente';
    }

    getBalance(transactions) {
        let balance = this.initialBalance;
        transactions.forEach(t => {
            const walletId = t.wallet_id || this.extractWalletId(t);
            if (walletId === this.id) {
                if (t.tipo === 'Receita') {
                    balance += parseFloat(t.valor);
                } else {
                    balance -= parseFloat(t.valor);
                }
            }
        });
        return balance;
    }

    extractWalletId(t) {
        if (!t.observacoes) return null;
        try {
            if (typeof t.observacoes === 'string' && t.observacoes.startsWith('{')) {
                const meta = JSON.parse(t.observacoes);
                return meta.conta_id;
            }
            if (typeof t.observacoes === 'object') {
                return t.observacoes.conta_id;
            }
        } catch(e) {}
        return null;
    }
}

export class Installment {
    constructor(data = {}) {
        this.id = data.id || 'inst_' + Date.now();
        this.desc = data.desc || '';
        this.totalVal = parseFloat(data.totalVal) || 0;
        this.count = parseInt(data.count) || 1;
        this.startDate = data.startDate || new Date().toISOString();
        this.cardId = data.cardId || null;
        this.type = data.type || 'pix';
        this.owner = data.owner || 'ambos';
        this.category = data.category || 'Outros';
    }

    getMonthlyAmount() {
        return this.totalVal / this.count;
    }

    getCurrentMonthImpact(year, month) {
        const start = new Date(this.startDate);
        const monthsPassed = (year - start.getFullYear()) * 12 + (month - start.getMonth());
        if (monthsPassed >= 0 && monthsPassed < this.count) {
            return this.getMonthlyAmount();
        }
        return 0;
    }
}

export class Card {
    constructor(data = {}) {
        this.id = data.id || Date.now().toString();
        this.name = data.name || '';
        this.closingDay = parseInt(data.closingDay) || 15;
        this.dueDay = parseInt(data.dueDay) || 22;
        this.limit = parseFloat(data.limit) || 0;
    }

    getInvoiceRange() {
        const today = new Date();
        const currentDay = today.getDate();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        let startDate, endDate;
        
        if (currentDay >= this.closingDay) {
            startDate = new Date(currentYear, currentMonth, this.closingDay);
            endDate = new Date(currentYear, currentMonth + 1, this.dueDay);
        } else {
            startDate = new Date(currentYear, currentMonth - 1, this.closingDay);
            endDate = new Date(currentYear, currentMonth, this.dueDay);
        }
        
        return { start: startDate, end: endDate };
    }

    getInvoiceTotal(transactions) {
        const { start, end } = this.getInvoiceRange();
        let total = 0;
        
        transactions.forEach(t => {
            if (t.forma_pagamento !== 'card' && t.forma_pagamento !== 'credit') return;
            
            const cardId = this.extractCardId(t);
            if (cardId !== this.id) return;
            
            const transDate = new Date(t.data);
            if (transDate >= start && transDate <= end) {
                total += parseFloat(t.valor);
            }
        });
        
        return total;
    }

    extractCardId(t) {
        if (!t.observacoes) return null;
        try {
            if (typeof t.observacoes === 'string' && t.observacoes.startsWith('{')) {
                const meta = JSON.parse(t.observacoes);
                return meta.cartao_id;
            }
            if (typeof t.observacoes === 'object') {
                return t.observacoes.cartao_id;
            }
        } catch(e) {}
        return null;
    }
}

export class Debt {
    constructor(data = {}) {
        this.id = data.id || 'debt_' + Date.now();
        this.name = data.name || '';
        this.type = data.type || 'Outros';
        this.total = parseFloat(data.total) || 0;
        this.paid = parseFloat(data.paid) || 0;
        this.installments = parseInt(data.installments) || 1;
        this.dueDay = parseInt(data.dueDay) || null;
        this.startDate = data.startDate || null;
        this.creditor = data.creditor || '';
    }

    getRemaining() {
        return Math.max(0, this.total - this.paid);
    }

    getProgress() {
        return this.total > 0 ? Math.min((this.paid / this.total) * 100, 100) : 0;
    }

    getMonthlyPayment() {
        return this.installments > 0 ? this.total / this.installments : 0;
    }

    getPaidInstallments() {
        return this.installments > 0 ? Math.round((this.paid / this.total) * this.installments) : 0;
    }

    toScheduledBill() {
        return new ScheduledBill({
            name: '[Dívida] ' + this.name,
            amount: this.getMonthlyPayment(),
            category: 'Outros',
            dueDay: this.dueDay || 1,
            isMonthly: true,
            count: this.installments,
            startDate: this.startDate,
            endDate: this.startDate ? this.calculateEndDate() : null,
            payMethod: 'pix',
            walletId: null,
            cardId: null,
            owner: 'ambos',
            paidMonths: []
        });
    }

    calculateEndDate() {
        if (!this.startDate || !this.installments) return null;
        const start = new Date(this.startDate);
        start.setMonth(start.getMonth() + this.installments);
        return start.toISOString().split('T')[0];
    }

    markPaid(paidAmount) {
        this.paid = (this.paid || 0) + paidAmount;
    }
}

export const DEBT_TYPES = {
    'Empréstimo': { icon: 'fa-hand-holding-dollar', color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' },
    'Financiamento': { icon: 'fa-house', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    'Cartão': { icon: 'fa-credit-card', color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
    'Outros': { icon: 'fa-file-invoice-dollar', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
};

export class UserConfig {
    constructor() {
        this.budgets = Budget.getDefaultBudgets();
        this.scheduledBills = [];
        this.goals = [];
        this.debts = [];
        this.cards = [];
        this.installments = [];
        this.wallets = [];
        this.payees = [];
        this.managedProfiles = [];
        this.userData = {};
        this.workspace_id = null;
        this.simulations = [];
        this.profileBudgets = {}; // { profileId: { Category: Amount } }
    }

    static fromJSON(json) {
        const config = new UserConfig();
        if (!json) return config;

        config.budgets = Budget.normalizeBudgets(json.budgets);
        config.scheduledBills = (json.scheduledBills || []).map(b => new ScheduledBill(b));
        config.goals = (json.goals || []).map(g => new Goal(g));
        config.debts = (json.debts || []).map(d => new Debt(d));
        config.cards = (json.cards || []).map(c => new Card(c));
        config.installments = (json.installments || []).map(i => new Installment(i));
        config.wallets = (json.wallets || []).map(w => new Wallet(w));
        config.payees = (json.payees || []).map(p => new Payee(p));
        config.managedProfiles = (json.managedProfiles || []).map(p => new ManagedProfile(p));
        config.userData = json.userData || {};
        config.workspace_id = json.workspace_id || null;
        config.simulations = (json.simulations || []).map(s => new SimulationEvent(s));
        
        config.profileBudgets = {};
        if (json.profileBudgets) {
            Object.keys(json.profileBudgets).forEach(pid => {
                config.profileBudgets[pid] = Budget.normalizeBudgets(json.profileBudgets[pid]);
            });
        }

        return config;
    }

    toJSON() {
        return {
            budgets: this.budgets,
            scheduledBills: this.scheduledBills,
            goals: this.goals,
            debts: this.debts,
            cards: this.cards,
            installments: this.installments,
            wallets: this.wallets,
            payees: this.payees,
            managedProfiles: this.managedProfiles,
            userData: this.userData,
            workspace_id: this.workspace_id,
            simulations: this.simulations,
            profileBudgets: this.profileBudgets
        };
    }
}

export class SimulationEvent {
    constructor(data = {}) {
        this.id = data.id || 'sim_' + Math.random().toString(36).substr(2, 9);
        this.nome = data.nome || '';
        this.tipo = data.tipo || 'despesa'; // 'despesa', 'receita', 'financiamento'
        this.valor = parseFloat(data.valor) || 0;
        this.data_inicio = data.data_inicio || new Date().toISOString().split('T')[0];
        this.parcelas = parseInt(data.parcelas) || 1;
        this.ativa = data.ativa !== undefined ? data.ativa : true;
    }
}

export class ManagedProfile {
    constructor(data = {}) {
        this.id = data.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'p_' + Date.now());
        this.workspace_id = data.workspace_id || null;
        this.name = data.name || '';
        this.avatar_url = data.avatar_url || null;
        this.color = data.color || '#3b82f6';
        this.created_at = data.created_at || new Date().toISOString();
    }
}
