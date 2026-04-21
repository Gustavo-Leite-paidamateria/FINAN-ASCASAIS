import { DashboardController, PlanningController, DebtController, ReportsController, TransactionController, GoalController, AuthController } from './controllers/index.js';
import { storageService, notificationService } from './services/index.js';
import { router } from './routes/router.js';
import { UserConfig } from './models/index.js';

class App {
    constructor() {
        this.config = new UserConfig();
        this.dashboardController = new DashboardController();
        this.planningController = new PlanningController();
        this.debtController = new DebtController();
        this.reportsController = new ReportsController();
        this.transactionController = new TransactionController();
        this.goalController = new GoalController();
        this.authController = new AuthController();
        this.currentView = 'dashboard';
    }

    async init() {
        this.initTheme();
        this.setupEventListeners();
        this.setupNavigation();
        this.setupReconcilation();
        
        notificationService.init();
        
        window.app = this;
        
        await this.authController.checkAuth();
    }

    initTheme() {
        const theme = storageService.getTheme();
        this.setTheme(theme);
    }

    setTheme(theme) {
        const isDark = theme === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        document.body.className = isDark ? 'dark-theme' : 'light-theme';
        
        const darkBtn = document.getElementById('theme-dark');
        const lightBtn = document.getElementById('theme-light');
        
        if (darkBtn) darkBtn.classList.toggle('active', isDark);
        if (lightBtn) lightBtn.classList.toggle('active', !isDark);
        
        storageService.setTheme(theme);
    }

    toggleTheme() {
        const current = storageService.getTheme();
        this.setTheme(current === 'dark' ? 'light' : 'dark');
    }

    setupEventListeners() {
        const themeDarkBtn = document.getElementById('theme-dark');
        const themeLightBtn = document.getElementById('theme-light');
        if (themeDarkBtn) themeDarkBtn.addEventListener('click', () => this.setTheme('dark'));
        if (themeLightBtn) themeLightBtn.addEventListener('click', () => this.setTheme('light'));

        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('email')?.value;
                const password = document.getElementById('password')?.value;
                if (email && password) this.authController.login(email, password);
            });
        }

        const registerBtn = document.getElementById('register-btn');
        if (registerBtn) {
            registerBtn.addEventListener('click', () => {
                const email = document.getElementById('email')?.value;
                const password = document.getElementById('password')?.value;
                if (!email || !password) {
                    notificationService.warning('Aviso', 'Preencha o e-mail e a senha para criar a conta.');
                    return;
                }
                this.authController.register(email, password);
            });
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.authController.logout());
        }

        const fab = document.getElementById('fab-add');
        if (fab) {
            fab.addEventListener('click', () => this.transactionController.openModal(this.config));
        }

        const closeModal = document.getElementById('close-modal');
        if (closeModal) {
            closeModal.addEventListener('click', () => this.transactionController.closeModal());
        }

        const linkBillSelect = document.getElementById('trans-link-bill');
        if (linkBillSelect) {
            linkBillSelect.addEventListener('change', () => this.transactionController.onLinkBillChange(this.config));
        }

        const debtSelect = document.getElementById('trans-debt');
        if (debtSelect) {
            debtSelect.addEventListener('change', () => this.transactionController.onDebtChange(this.config));
        }

        const cardSelect = document.getElementById('trans-card');
        if (cardSelect) {
            cardSelect.addEventListener('change', () => this.transactionController.onCardChange(this.config));
        }

        const transForm = document.getElementById('transaction-form');
        if (transForm) {
            transForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.transactionController.save(this.config);
            });
        }

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.dashboardController.setFilter(btn.dataset.filter);
            });
        });

        const prevMonth = document.getElementById('prev-month');
        const nextMonth = document.getElementById('next-month');
        if (prevMonth) prevMonth.addEventListener('click', () => this.dashboardController.navigateMonth(-1));
        if (nextMonth) nextMonth.addEventListener('click', () => this.dashboardController.navigateMonth(1));

        const saveBudgetsBtn = document.getElementById('save-budgets-btn');
        if (saveBudgetsBtn) {
            saveBudgetsBtn.addEventListener('click', () => this.planningController.saveBudgets(this.config));
        }

        const addScheduledBtn = document.getElementById('add-scheduled-btn');
        if (addScheduledBtn) {
            addScheduledBtn.addEventListener('click', () => {
                document.getElementById('scheduled-bill-form')?.reset();
                const monthlyRadio = document.getElementById('sched-rec-monthly');
                if (monthlyRadio) monthlyRadio.checked = true;
                const limitedFields = document.getElementById('sched-limited-fields');
                if (limitedFields) limitedFields.classList.add('hidden');
                this.planningController.renderWallets(this.config);
                this.planningController.renderCards(this.config);
                document.getElementById('scheduled-bill-modal')?.classList.remove('hidden');
            });
        }

        const closeScheduledModal = document.getElementById('close-scheduled-modal');
        if (closeScheduledModal) {
            closeScheduledModal.addEventListener('click', () => 
                document.getElementById('scheduled-bill-modal')?.classList.add('hidden'));
        }

        const scheduledBillForm = document.getElementById('scheduled-bill-form');
        if (scheduledBillForm) {
            scheduledBillForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.planningController.addScheduledBill(this.config);
            });
        }

        const addCardBtn = document.getElementById('add-card-btn');
        if (addCardBtn) {
            addCardBtn.addEventListener('click', () => {
                document.getElementById('card-form')?.reset();
                document.getElementById('card-modal')?.classList.remove('hidden');
            });
        }

        const closeCardModal = document.getElementById('close-card-modal');
        if (closeCardModal) {
            closeCardModal.addEventListener('click', () => 
                document.getElementById('card-modal')?.classList.add('hidden'));
        }

        const cardForm = document.getElementById('card-form');
        if (cardForm) {
            cardForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.planningController.addCard(this.config);
            });
        }

        const addWalletBtn = document.getElementById('add-wallet-btn');
        if (addWalletBtn) {
            addWalletBtn.addEventListener('click', () => {
                document.getElementById('wallet-form')?.reset();
                document.getElementById('wallet-modal')?.classList.remove('hidden');
            });
        }

        const closeWalletModal = document.getElementById('close-wallet-modal');
        if (closeWalletModal) {
            closeWalletModal.addEventListener('click', () => 
                document.getElementById('wallet-modal')?.classList.add('hidden'));
        }

        const walletForm = document.getElementById('wallet-form');
        if (walletForm) {
            walletForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.planningController.addWallet(this.config);
            });
        }

        const addGoalBtn = document.getElementById('add-goal-btn');
        if (addGoalBtn) {
            addGoalBtn.addEventListener('click', () => 
                document.getElementById('goal-modal')?.classList.remove('hidden'));
        }

        const closeGoalModal = document.getElementById('close-goal-modal');
        if (closeGoalModal) {
            closeGoalModal.addEventListener('click', () => 
                document.getElementById('goal-modal')?.classList.add('hidden'));
        }

        const goalForm = document.getElementById('goal-form');
        if (goalForm) {
            goalForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.goalController.add(this.config);
            });
        }

        document.querySelectorAll('input[name="pay-method"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const val = radio.value;
                const cardGroup = document.getElementById('card-selection-group');
                const installmentGroup = document.getElementById('installment-group');
                const recurrenceGrp = document.getElementById('recurrence-group');
                
                if (cardGroup) cardGroup.classList.toggle('hidden', val !== 'card');
                if (installmentGroup) installmentGroup.classList.toggle('hidden', val === 'pix');
                if (recurrenceGrp) recurrenceGrp.classList.toggle('hidden', val !== 'pix');
            });
        });

        const toggleSplitBtn = document.getElementById('toggle-split-btn');
        if (toggleSplitBtn) {
            toggleSplitBtn.addEventListener('click', () => 
                this.transactionController.toggleSplitMode());
        }

        const addSplitItemBtn = document.getElementById('add-split-item');
        if (addSplitItemBtn) {
            addSplitItemBtn.addEventListener('click', () => 
                this.transactionController.addSplitRow());
        }

        const amountInput = document.getElementById('trans-amount');
        if (amountInput) {
            amountInput.addEventListener('input', () => 
                this.transactionController.updateInstallmentCalc());
        }

        const installmentsInput = document.getElementById('trans-installments');
        if (installmentsInput) {
            installmentsInput.addEventListener('input', () => 
                this.transactionController.updateInstallmentCalc());
        }

        const addDebtBtn = document.getElementById('add-debt-btn');
        if (addDebtBtn) {
            addDebtBtn.addEventListener('click', () => {
                document.getElementById('debt-form')?.reset();
                const today = new Date();
                const offset = today.getTimezoneOffset() * 60000;
                const localDate = new Date(today - offset).toISOString().split('T')[0];
                document.getElementById('debt-start-date').value = localDate;
                document.getElementById('debt-modal')?.classList.remove('hidden');
            });
        }

        const closeDebtModal = document.getElementById('close-debt-modal');
        if (closeDebtModal) {
            closeDebtModal.addEventListener('click', () => 
                document.getElementById('debt-modal')?.classList.add('hidden'));
        }

        const debtForm = document.getElementById('debt-form');
        if (debtForm) {
            debtForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.debtController.addDebt(this.config);
            });
        }

        const viewAllBtn = document.getElementById('view-all-btn');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => 
                document.getElementById('view-all-modal')?.classList.remove('hidden'));
        }

        const closeViewAll = document.getElementById('close-view-all');
        if (closeViewAll) {
            closeViewAll.addEventListener('click', () => 
                document.getElementById('view-all-modal')?.classList.add('hidden'));
        }

        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => 
                this.reportsController.exportCsv());
        }

        const schedRecRadios = document.getElementsByName('sched-recurrence');
        schedRecRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const limitedFields = document.getElementById('sched-limited-fields');
                if (limitedFields) {
                    const isLimited = radio.value === 'limited' && radio.checked;
                    limitedFields.classList.toggle('hidden', !isLimited);
                    if (isLimited) limitedFields.style.display = 'flex';
                    else limitedFields.style.display = 'none';
                }
            });
        });

        const schedPayRadios = document.getElementsByName('sched-pay-method');
        schedPayRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const val = radio.value;
                const cardGrp = document.getElementById('sched-card-group');
                const walletGrp = document.getElementById('sched-wallet-group');
                if (cardGrp) cardGrp.classList.toggle('hidden', val !== 'card');
                if (walletGrp) walletGrp.classList.toggle('hidden', val === 'card');
            });
        });
    }

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                this.navigateTo(tabId);
            });
        });
    }

    navigateTo(tabId) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
        document.getElementById(tabId)?.classList.remove('hidden');
        
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.tab === tabId) item.classList.add('active');
            else item.classList.remove('active');
        });

        this.currentView = tabId;

        if (tabId === 'planning-view') {
            if (this.dashboardController.transactions.length === 0) {
                this.dashboardController.loadData(this.config).then(() => {
                    this.planningController.render(this.config, this.dashboardController.transactions);
                });
            } else {
                this.planningController.render(this.config, this.dashboardController.transactions);
            }
        }
        if (tabId === 'dashboard-view') {
            this.dashboardController.loadData(this.config);
        }
        if (tabId === 'debts-view') {
            this.debtController.render(this.config);
        }
        if (tabId === 'reports-view') {
            this.reportsController.init();
        }

        router.navigate(tabId);
    }

    setupReconcilation() {
        const closeReconcileModal = document.getElementById('close-reconcile-modal');
        if (closeReconcileModal) {
            closeReconcileModal.addEventListener('click', () => 
                document.getElementById('reconcile-modal')?.classList.add('hidden'));
        }

        const reconcileCloseResult = document.getElementById('reconcile-close-result');
        if (reconcileCloseResult) {
            reconcileCloseResult.addEventListener('click', () => 
                document.getElementById('reconcile-modal')?.classList.add('hidden'));
        }

        const reconcileConfirmBtn = document.getElementById('reconcile-confirm-btn');
        if (reconcileConfirmBtn) {
            reconcileConfirmBtn.addEventListener('click', () => this.confirmReconcile());
        }
    }

    async reconcileCard(cardId, estimated) {
        const card = this.config.cards.find(c => c.id === cardId);
        if (!card) return;

        this._reconcileCardId = cardId;
        this._reconcileEstimated = estimated;

        const body = document.getElementById('reconcile-body');
        const result = document.getElementById('reconcile-result');
        const label = document.getElementById('reconcile-label');
        const estimatedEl = document.getElementById('reconcile-estimated');
        const amountInput = document.getElementById('reconcile-amount');

        if (body) body.classList.remove('hidden');
        if (result) result.classList.add('hidden');
        if (label) label.textContent = `Valor real pago na fatura do ${card.name}`;
        if (estimatedEl) estimatedEl.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(estimated);
        if (amountInput) amountInput.value = estimated.toFixed(2);

        document.getElementById('reconcile-modal')?.classList.remove('hidden');
        setTimeout(() => amountInput?.focus(), 100);
    }

    async confirmReconcile() {
        const paid = parseFloat(document.getElementById('reconcile-amount')?.value);
        if (isNaN(paid)) return;

        const diff = paid - this._reconcileEstimated;
        const card = this.config.cards.find(c => c.id === this._reconcileCardId);

        const body = document.getElementById('reconcile-body');
        const result = document.getElementById('reconcile-result');
        const icon = document.getElementById('reconcile-result-icon');
        const title = document.getElementById('reconcile-result-title');
        const msg = document.getElementById('reconcile-result-msg');
        const closeResult = document.getElementById('reconcile-close-result');

        if (body) body.classList.add('hidden');
        if (result) result.classList.remove('hidden');

        const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

        if (Math.abs(diff) < 0.01) {
            if (icon) icon.textContent = '✅';
            if (title) title.textContent = 'Perfeito!';
            if (msg) msg.textContent = `Fatura do ${card.name} conciliada. Valor batendo.`;
            
            const newCloseResult = closeResult.cloneNode(true);
            closeResult.parentNode.replaceChild(newCloseResult, closeResult);
            newCloseResult.addEventListener('click', () => {
                document.getElementById('reconcile-modal')?.classList.add('hidden');
            });
        } else if (diff > 0) {
            if (icon) icon.textContent = '💳';
            if (title) title.textContent = 'Valor maior que a fatura';
            if (msg) msg.textContent = `Você pagou ${fmt(paid)}, mas a fatura era ${fmt(this._reconcileEstimated)}. Sobra de ${fmt(diff)} para registrar?`;
            
            const newCloseResult = closeResult.cloneNode(true);
            closeResult.parentNode.replaceChild(newCloseResult, closeResult);
            newCloseResult.textContent = 'Registrar Diferença';
            newCloseResult.addEventListener('click', () => {
                document.getElementById('reconcile-modal')?.classList.add('hidden');
                document.getElementById('add-modal')?.classList.remove('hidden');
                document.getElementById('trans-amount').value = Math.abs(diff).toFixed(2);
                document.getElementById('trans-desc').value = `Despesa não fatura - ${card.name}`;
                document.getElementById('type-expense').checked = true;
                document.getElementById('pay-card').checked = true;
                document.getElementById('card-selection-group')?.classList.remove('hidden');
                document.getElementById('trans-card').value = this._reconcileCardId;
            }, { once: true });
        } else {
            const absDiff = Math.abs(diff);
            const minPayment = this._reconcileEstimated * 0.15;
            
            if (absDiff <= minPayment) {
                if (icon) icon.textContent = '💰';
                if (title) title.textContent = 'Pagamento mínimo';
                if (msg) msg.textContent = `Você pagou ${fmt(paid)}. Diferença ${fmt(absDiff)} pode ficar para próxima fatura.`;
            } else {
                if (icon) icon.textContent = '⚠️';
                if (title) title.textContent = 'Valor menor';
                if (msg) msg.textContent = `Você pagou ${fmt(paid)}, mas a fatura era ${fmt(this._reconcileEstimated)}. Diferença: ${fmt(absDiff)}`;
            }
            
            const newCloseResult = closeResult.cloneNode(true);
            closeResult.parentNode.replaceChild(newCloseResult, closeResult);
            newCloseResult.textContent = 'Registrar Diferença';
            newCloseResult.addEventListener('click', () => {
                document.getElementById('reconcile-modal')?.classList.add('hidden');
                document.getElementById('trans-amount').value = Math.abs(diff).toFixed(2);
                document.getElementById('trans-desc').value = `Ajuste Fatura ${card.name}`;
                
                if (absDiff <= minPayment) {
                    notificationService.info('Info', 'Diferença ficou pra próxima fatura');
                } else {
                    document.getElementById('add-modal')?.classList.remove('hidden');
                    document.getElementById('type-expense').checked = true;
                    document.getElementById('pay-card').checked = true;
                    document.getElementById('card-selection-group')?.classList.remove('hidden');
                    document.getElementById('trans-card').value = this._reconcileCardId;
                }
            }, { once: true });
        }
    }

    async toggleBill(id) {
        await this.planningController.toggleBill(this.config, id);
    }

    async deleteBill(id) {
        await this.planningController.deleteBill(this.config, id);
    }

    async deleteCard(id) {
        await this.planningController.deleteCard(this.config, id);
    }

    async deleteWallet(id) {
        await this.planningController.deleteWallet(this.config, id);
    }

    async deleteDebt(id) {
        await this.debtController.deleteDebt(this.config, id);
    }

    async openPayDebtModal(id) {
        await this.debtController.openPayDebtModal(this.config, id);
    }

    async editTransaction(id) {
        await this.transactionController.edit(id);
    }

    async deleteTransaction(id) {
        await this.transactionController.delete(id);
    }
}

const app = new App();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

export default app;
