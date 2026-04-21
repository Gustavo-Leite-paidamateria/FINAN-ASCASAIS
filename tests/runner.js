import {
    Transaction,
    Budget,
    CATEGORIES,
    ScheduledBill,
    UserConfig
} from '../src/models/index.js';
import { storageService, supabaseService } from '../src/services/index.js';
import DashboardController from '../src/controllers/DashboardController.js';
import { formatCurrency, getMonthDateRange, getDaysInMonth } from '../src/utils/index.js';

const TestRunner = {
    results: [],

    log(name, passed, message = '') {
        this.results.push({ name, passed, message });
        const icon = passed ? 'PASS' : 'FAIL';
        console.log(`[${icon}] ${name}${message ? ': ' + message : ''}`);
    },

    assert(condition, name, message = '') {
        this.log(name, !!condition, message);
        return !!condition;
    },

    async run() {
        console.log('Starting Finance App tests...');
        this.results = [];

        await this.testModuleExports();
        await this.testStorageService();
        await this.testBudgetNormalization();
        await this.testTransactionModel();
        await this.testUtils();
        await this.testSupabaseInsertNormalization();
        await this.testDashboardAutoProcessBills();
        await this.testDOM();
        await this.testNavigation();
        await this.testTheme();

        const passed = this.results.filter(r => r.passed).length;
        const total = this.results.length;
        console.log(`Results: ${passed}/${total} passed`);

        if (passed < total) {
            console.log('Failed tests:');
            this.results
                .filter(r => !r.passed)
                .forEach(r => console.log(` - ${r.name}${r.message ? ': ' + r.message : ''}`));
        }

        return passed === total;
    },

    async testModuleExports() {
        console.log('Testing module exports...');
        this.assert(typeof storageService.saveConfig === 'function', 'Storage service export');
        this.assert(typeof supabaseService.insertTransaction === 'function', 'Supabase service export');
        this.assert(Array.isArray(CATEGORIES) && CATEGORIES.length > 0, 'Categories export');
    },

    async testStorageService() {
        console.log('Testing storage service...');

        const originalTheme = storageService.getTheme();
        storageService.setTheme('light');
        this.assert(storageService.getTheme() === 'light', 'Theme persistence');
        storageService.setTheme(originalTheme);

        const config = new UserConfig();
        config.budgets.Casa = 1900;
        storageService.saveConfig(config);

        const restored = storageService.loadConfig();
        this.assert(restored instanceof UserConfig, 'Config loads as UserConfig');
        this.assert(restored?.budgets?.Casa === 1900, 'Config value persisted');
    },

    async testBudgetNormalization() {
        console.log('Testing budgets and categories...');

        const defaults = Budget.getDefaultBudgets();
        const defaultKeys = Object.keys(defaults);
        this.assert(
            CATEGORIES.every(category => Object.prototype.hasOwnProperty.call(defaults, category)),
            'Default budgets cover all app categories'
        );
        this.assert(
            defaultKeys.length === CATEGORIES.length,
            'Default budgets do not contain orphan categories',
            `found=${defaultKeys.length}, expected=${CATEGORIES.length}`
        );

        const legacyConfig = UserConfig.fromJSON({
            budgets: { Moradia: 2200, ServiÃ§os: 300, Mercado: 900 }
        });

        this.assert(legacyConfig.budgets.Casa === 2200, 'Legacy Moradia budget migrates to Casa');
        this.assert(
            !Object.prototype.hasOwnProperty.call(legacyConfig.budgets, 'ServiÃ§os'),
            'Legacy ServiÃ§os budget is removed'
        );
        this.assert(legacyConfig.budgets.Mercado === 900, 'Existing recognized budget is preserved');
    },

    async testTransactionModel() {
        console.log('Testing transaction model...');

        const parsed = Transaction.parseFromDb({
            id: 1,
            tipo: 'Despesa',
            valor: '123.45',
            descricao: 'Teste',
            categoria: 'Casa',
            data: '2026-04-01T10:00:00.000Z',
            forma_pagamento: 'card',
            observacoes: JSON.stringify({
                owner: 'eu',
                cartao_id: 'card_1',
                conta_id: 'wallet_1'
            }),
            referencia: 'conta_programada'
        });

        this.assert(parsed.owner === 'eu', 'Transaction parses owner metadata');
        this.assert(parsed.card_id === 'card_1', 'Transaction parses card metadata');
        this.assert(parsed.wallet_id === 'wallet_1', 'Transaction parses wallet metadata');
        this.assert(parsed.pay_method === 'card', 'Transaction parses payment method');
    },

    async testUtils() {
        console.log('Testing utils...');

        const range = getMonthDateRange(new Date('2026-04-15T12:00:00.000Z'));
        this.assert(range.start.getDate() === 1, 'Month range starts on day 1');
        this.assert(range.end.getDate() === 30, 'Month range ends on last day');
        this.assert(getDaysInMonth(new Date('2026-02-10')) === 28, 'Days in month helper');
        this.assert(formatCurrency(1234.56).includes('1.234,56'), 'Currency formatter');
    },

    async testSupabaseInsertNormalization() {
        console.log('Testing Supabase insert normalization...');

        const originalInit = supabaseService.init;
        const originalClient = supabaseService._client;
        const originalInitialized = supabaseService._initialized;

        const insertedPayloads = [];
        supabaseService._client = {
            from() {
                return {
                    insert(records) {
                        insertedPayloads.push(records);
                        return Promise.resolve({ error: null });
                    }
                };
            }
        };
        supabaseService._initialized = true;
        supabaseService.init = () => {};

        const transaction = new Transaction({ descricao: 'Compra', valor: 10 });
        await supabaseService.insertTransaction(transaction);
        await supabaseService.insertTransaction([
            { descricao: 'A', valor: 1 },
            { descricao: 'B', valor: 2 }
        ]);

        this.assert(Array.isArray(insertedPayloads[0]) && insertedPayloads[0].length === 1, 'Single insert normalized to array');
        this.assert(Array.isArray(insertedPayloads[1]) && insertedPayloads[1].length === 2, 'Batch insert keeps flat array');
        this.assert(!Array.isArray(insertedPayloads[1][0]), 'Batch insert avoids nested arrays');

        supabaseService.init = originalInit;
        supabaseService._client = originalClient;
        supabaseService._initialized = originalInitialized;
    },

    async testDashboardAutoProcessBills() {
        console.log('Testing auto process bills...');

        const originalInsert = supabaseService.insertTransaction;
        const originalSaveConfig = supabaseService.saveConfig;
        const originalStorageSave = storageService.saveConfig;

        let inserted = 0;
        let remoteSaved = 0;
        let localSaved = 0;

        supabaseService.insertTransaction = async () => { inserted += 1; };
        supabaseService.saveConfig = async () => { remoteSaved += 1; return true; };
        storageService.saveConfig = () => { localSaved += 1; };

        const controller = new DashboardController();
        const today = new Date();
        const activeBill = new ScheduledBill({
            name: 'Internet',
            amount: 120,
            category: 'Casa',
            dueDay: Math.max(1, today.getDate() - 1),
            paidMonths: []
        });
        const config = UserConfig.fromJSON({
            scheduledBills: [activeBill],
            wallets: [{ id: 'w_default', name: 'Conta Principal', initialBalance: 0 }]
        });

        const processed = await controller.autoProcessBills(config);
        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

        this.assert(processed, 'Auto process returns true when a bill is processed');
        this.assert(inserted === 1, 'Auto process inserts scheduled bill transaction');
        this.assert(config.scheduledBills[0].paidMonths.includes(currentMonth), 'Processed bill is marked as paid');
        this.assert(localSaved === 1, 'Processed bill persists in local storage');
        this.assert(remoteSaved === 1, 'Processed bill persists in Supabase config');

        supabaseService.insertTransaction = originalInsert;
        supabaseService.saveConfig = originalSaveConfig;
        storageService.saveConfig = originalStorageSave;
    },

    async testDOM() {
        console.log('Testing DOM...');

        const requiredElements = [
            'login-screen', 'app-screen', 'dashboard-view', 'planning-view',
            'debts-view', 'reports-view', 'fab-add', 'logout-btn',
            'theme-dark', 'theme-light', 'transaction-form', 'add-modal',
            'goals-list', 'budgets-list', 'transactions-list',
            'category-chart', 'daily-chart'
        ];

        const found = requiredElements.filter(id => document.getElementById(id)).length;
        this.assert(found === requiredElements.length, 'Required DOM elements', `${found}/${requiredElements.length} found`);
    },

    async testNavigation() {
        console.log('Testing navigation...');

        const navItems = document.querySelectorAll('.nav-item');
        this.assert(navItems.length === 4, 'Navigation items', `found=${navItems.length}`);

        if (window.app?.navigateTo) {
            window.app.navigateTo('planning-view');
            const planningVisible = !document.getElementById('planning-view')?.classList.contains('hidden');
            this.assert(planningVisible, 'Navigation to planning');

            window.app.navigateTo('dashboard-view');
            const dashboardVisible = !document.getElementById('dashboard-view')?.classList.contains('hidden');
            this.assert(dashboardVisible, 'Navigation to dashboard');
        } else {
            this.assert(false, 'App navigation exposed');
        }
    },

    async testTheme() {
        console.log('Testing theme...');

        if (!window.app?.setTheme) {
            this.assert(false, 'Theme controller exposed');
            return;
        }

        window.app.setTheme('dark');
        this.assert(document.documentElement.getAttribute('data-theme') === 'dark', 'Set dark theme');

        window.app.setTheme('light');
        this.assert(document.documentElement.getAttribute('data-theme') === 'light', 'Set light theme');
    }
};

window.TestRunner = TestRunner;

if (new URLSearchParams(window.location.search).get('test') === 'true') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => TestRunner.run(), 1000);
    });
}

console.log('To run tests: TestRunner.run()');
