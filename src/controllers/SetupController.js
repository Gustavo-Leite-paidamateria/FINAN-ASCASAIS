import { SetupWizard } from '../utils/SetupWizard.js';
import { notificationService, storageService } from '../services/index.js';
import { formatCurrency } from '../utils/index.js';

const STEPS = ['welcome', 'mode', 'income', 'housing', 'bills', 'subscriptions', 'debts', 'goals', 'review'];

class SetupController {
    constructor() {
        this.currentStep = 0;
        this.wizardData = SetupWizard.getInitialData();
        this.subIndex = 0;
        this.debtIndex = 0;
    }

    get needsSetup() {
        return !storageService.getSetupCompleted();
    }

    start(config) {
        this.wizardData = SetupWizard.getInitialData();
        this.currentStep = 0;
        this.subIndex = 0;
        this.debtIndex = 0;
        this.config = config;
        this.showModal();
        this.renderStep();
    }

    showModal() {
        const modal = document.getElementById('setup-modal');
        if (modal) modal.classList.remove('hidden');
    }

    hideModal() {
        const modal = document.getElementById('setup-modal');
        if (modal) modal.classList.add('hidden');
    }

    nextStep() {
        if (this.currentStep < STEPS.length - 1) {
            if (!this.validateStep()) return;
            this.currentStep++;
            this.renderStep();
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.renderStep();
        }
    }

    validateStep() {
        const step = STEPS[this.currentStep];
        if (step === 'income') {
            if (!this.wizardData.yourIncome || this.wizardData.yourIncome <= 0) {
                notificationService.warning('Aviso', 'Informe sua renda mensal.');
                return false;
            }
            if (this.wizardData.mode === 'shared' && (!this.wizardData.partnerName)) {
                notificationService.warning('Aviso', 'Informe o nome da pessoa com quem divide as contas.');
                return false;
            }
        }
        return true;
    }

    addSubscription() {
        const name = document.getElementById('setup-sub-name')?.value?.trim();
        const amount = parseFloat(document.getElementById('setup-sub-amount')?.value);
        if (!name || !amount) {
            notificationService.warning('Aviso', 'Preencha nome e valor da assinatura.');
            return;
        }
        this.wizardData.subscriptions.push({
            name, amount,
            dueDay: parseInt(document.getElementById('setup-sub-due')?.value) || 15,
            owner: this.wizardData.mode === 'solo' ? 'eu' : (document.getElementById('setup-sub-owner')?.value || 'ambos')
        });
        document.getElementById('setup-sub-name').value = '';
        document.getElementById('setup-sub-amount').value = '';
        this.renderSubscriptionsList();
        notificationService.success('', 'Assinatura adicionada!');
    }

    removeSubscription(index) {
        this.wizardData.subscriptions.splice(index, 1);
        this.renderSubscriptionsList();
    }

    addDebt() {
        const name = document.getElementById('setup-debt-name')?.value?.trim();
        const total = parseFloat(document.getElementById('setup-debt-total')?.value);
        if (!name || !total) {
            notificationService.warning('Aviso', 'Preencha nome e total da dívida.');
            return;
        }
        this.wizardData.debts.push({
            name, total,
            paid: parseFloat(document.getElementById('setup-debt-paid')?.value) || 0,
            installments: parseInt(document.getElementById('setup-debt-installments')?.value) || 1,
            dueDay: parseInt(document.getElementById('setup-debt-due')?.value) || 5,
            type: document.getElementById('setup-debt-type')?.value || 'Outros',
            creditor: document.getElementById('setup-debt-creditor')?.value || ''
        });
        document.getElementById('setup-debt-name').value = '';
        document.getElementById('setup-debt-total').value = '';
        document.getElementById('setup-debt-paid').value = '';
        this.renderDebtsList();
        notificationService.success('', 'Dívida adicionada!');
    }

    removeDebt(index) {
        this.wizardData.debts.splice(index, 1);
        this.renderDebtsList();
    }

    async finish() {
        try {
            const finishBtn = document.getElementById('setup-finish-btn');
            if (finishBtn) { finishBtn.disabled = true; finishBtn.textContent = 'Salvando...'; }

            const created = await SetupWizard.execute(this.wizardData, this.config);
            storageService.setSetupCompleted(true);

            this.hideModal();

            const msg = [
                `${created.transactions} receita(s)`,
                `${created.bills} conta(s) fixa(s)`,
                `${created.debts} dívida(s)`,
                `${created.goals} meta(s)`
            ].filter(s => !s.startsWith('0')).join(', ');

            notificationService.success('Setup Concluído!', `${msg} criadas com sucesso.`);

            if (window.app?.dashboardController) {
                window.app.dashboardController.loadData(this.config);
            }
        } catch (e) {
            console.error('Setup error:', e);
            notificationService.error('Erro', 'Falha ao salvar dados: ' + e.message);
            const finishBtn = document.getElementById('setup-finish-btn');
            if (finishBtn) { finishBtn.disabled = false; finishBtn.textContent = 'Finalizar'; }
        }
    }

    renderStep() {
        const container = document.getElementById('setup-step-content');
        const step = STEPS[this.currentStep];
        if (!container) return;

        this.updateProgress();
        this.updateButtons();

        const renderers = {
            welcome: () => this.renderWelcome(),
            mode: () => this.renderMode(),
            income: () => this.renderIncome(),
            housing: () => this.renderHousing(),
            bills: () => this.renderBills(),
            subscriptions: () => this.renderSubscriptions(),
            debts: () => this.renderDebts(),
            goals: () => this.renderGoals(),
            review: () => this.renderReview()
        };

        container.innerHTML = (renderers[step] || (() => ''))();
    }

    renderWelcome() {
        return `
            <div class="setup-hero">
                <div class="setup-icon">🚀</div>
                <h2>Bem-vindo ao FinançaCasal!</h2>
                <p>Vamos configurar suas finanças em menos de 5 minutos.<br>
                Responda algumas perguntas e o app já vai criar:</p>
                <div class="setup-checklist">
                    <div class="setup-check-item"><i class="fa-solid fa-check-circle"></i> Suas receitas</div>
                    <div class="setup-check-item"><i class="fa-solid fa-check-circle"></i> Contas fixas (aluguel, água, luz)</div>
                    <div class="setup-check-item"><i class="fa-solid fa-check-circle"></i> Assinaturas e dívidas</div>
                    <div class="setup-check-item"><i class="fa-solid fa-check-circle"></i> Orçamentos sugeridos</div>
                    <div class="setup-check-item"><i class="fa-solid fa-check-circle"></i> Meta de economia</div>
                </div>
            </div>
        `;
    }

    renderMode() {
        const solo = this.wizardData.mode === 'solo';
        return `
            <div class="setup-form">
                <h3>Como você usa o app?</h3>
                <p class="setup-subtitle">Isso ajuda a personalizar a divisão dos gastos.</p>
                <div class="setup-mode-selector">
                    <div class="setup-mode-card ${solo ? 'active' : ''}" onclick="window.app.setupController.selectMode('solo')">
                        <div class="setup-mode-icon">👤</div>
                        <strong>Sozinho(a)</strong>
                        <span>Uso individual, sem divisão</span>
                    </div>
                    <div class="setup-mode-card ${!solo ? 'active' : ''}" onclick="window.app.setupController.selectMode('shared')">
                        <div class="setup-mode-icon">👥</div>
                        <strong>Compartilhado</strong>
                        <span>Divido contas com outra pessoa</span>
                    </div>
                </div>
                <div id="setup-partner-field" class="input-group ${solo ? 'hidden' : ''}" style="margin-top: 16px;">
                    <label>Nome da pessoa (como aparece nos gastos)</label>
                    <input type="text" id="setup-partner-name" value="${this.wizardData.partnerName}" placeholder="Ex: Maria, João..." onchange="window.app.setupController.wizardData.partnerName = this.value">
                </div>
            </div>
        `;
    }

    selectMode(mode) {
        this.wizardData.mode = mode;
        if (mode === 'solo') {
            this.wizardData.partnerName = '';
            this.wizardData.partnerIncome = 0;
        }
        this.renderStep();
    }

    renderIncome() {
        const shared = this.wizardData.mode === 'shared';
        return `
            <div class="setup-form">
                <h3>Quanto entra por mês?</h3>
                <p class="setup-subtitle">Some todas as fontes de renda.</p>
                <div class="input-group">
                    <label>${shared ? 'Sua renda mensal' : 'Sua renda mensal'}</label>
                    <div class="amount-input-group">
                        <span>R$</span>
                        <input type="number" id="setup-your-income" step="0.01" value="${this.wizardData.yourIncome || ''}" placeholder="0,00" onchange="window.app.setupController.wizardData.yourIncome = parseFloat(this.value) || 0">
                    </div>
                </div>
                ${shared ? `
                <div class="input-group">
                    <label>Renda de ${this.wizardData.partnerName || 'outra pessoa'}</label>
                    <div class="amount-input-group">
                        <span>R$</span>
                        <input type="number" id="setup-partner-income" step="0.01" value="${this.wizardData.partnerIncome || ''}" placeholder="0,00" onchange="window.app.setupController.wizardData.partnerIncome = parseFloat(this.value) || 0">
                    </div>
                </div>
                ` : ''}
                <div class="setup-tip">
                    <i class="fa-solid fa-lightbulb"></i>
                    <span>Coloque valores aproximados. Você pode ajustar depois.</span>
                </div>
            </div>
        `;
    }

    renderHousing() {
        return `
            <div class="setup-form">
                <h3>Gastos com Moradia</h3>
                <p class="setup-subtitle">Os principais custos fixos do mês.</p>
                <div class="input-group">
                    <label>Aluguel ou Prestação (R$)</label>
                    <div class="amount-input-group">
                        <span>R$</span>
                        <input type="number" step="0.01" value="${this.wizardData.rent || ''}" placeholder="0,00" onchange="window.app.setupController.wizardData.rent = parseFloat(this.value) || 0">
                    </div>
                </div>
                <div class="input-group">
                    <label>Condomínio (R$)</label>
                    <div class="amount-input-group">
                        <span>R$</span>
                        <input type="number" step="0.01" value="${this.wizardData.condoFee || ''}" placeholder="0,00" onchange="window.app.setupController.wizardData.condoFee = parseFloat(this.value) || 0">
                    </div>
                </div>
            </div>
        `;
    }

    renderBills() {
        return `
            <div class="setup-form">
                <h3>Contas do Dia a Dia</h3>
                <p class="setup-subtitle">Valores médios mensais.</p>
                <div class="setup-bills-grid">
                    <div class="input-group">
                        <label>💧 Água (R$)</label>
                        <input type="number" step="0.01" value="${this.wizardData.water || ''}" placeholder="0,00" onchange="window.app.setupController.wizardData.water = parseFloat(this.value) || 0">
                    </div>
                    <div class="input-group">
                        <label>⚡ Luz (R$)</label>
                        <input type="number" step="0.01" value="${this.wizardData.electricity || ''}" placeholder="0,00" onchange="window.app.setupController.wizardData.electricity = parseFloat(this.value) || 0">
                    </div>
                    <div class="input-group">
                        <label>🌐 Internet (R$)</label>
                        <input type="number" step="0.01" value="${this.wizardData.internet || ''}" placeholder="0,00" onchange="window.app.setupController.wizardData.internet = parseFloat(this.value) || 0">
                    </div>
                </div>
                <div class="setup-tip">
                    <i class="fa-solid fa-lightbulb"></i>
                    <span>Não sabe o valor exato? Coloque uma média.</span>
                </div>
            </div>
        `;
    }

    renderSubscriptions() {
        const items = this.wizardData.subscriptions.map((sub, i) => `
            <div class="setup-list-item">
                <div>
                    <strong>${sub.name}</strong>
                    <span>${formatCurrency(sub.amount)}/mês</span>
                </div>
                <button class="btn-mini-icon danger" onclick="window.app.setupController.removeSubscription(${i})"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('') || '<div class="empty-state" style="padding:12px;">Nenhuma assinatura adicionada.</div>';

        const showOwner = this.wizardData.mode === 'shared';

        return `
            <div class="setup-form">
                <h3>Assinaturas</h3>
                <p class="setup-subtitle">Streaming, academia, seguro, etc.</p>
                <div id="setup-sub-list" class="setup-dynamic-list">${items}</div>
                <div class="setup-add-row">
                    <input type="text" id="setup-sub-name" placeholder="Nome (ex: Netflix)" style="flex:1;">
                    <input type="number" id="setup-sub-amount" step="0.01" placeholder="Valor" style="width:100px;">
                    <input type="number" id="setup-sub-due" min="1" max="31" placeholder="Dia" style="width:60px;" value="15">
                    ${showOwner ? `
                    <select id="setup-sub-owner" style="width:80px;padding:8px;">
                        <option value="ambos">👫</option>
                        <option value="eu">👤</option>
                        <option value="esposa">👩</option>
                    </select>
                    ` : ''}
                    <button class="btn-icon" onclick="window.app.setupController.addSubscription()"><i class="fa-solid fa-plus"></i></button>
                </div>
            </div>
        `;
    }

    renderSubscriptionsList() {
        const container = document.getElementById('setup-sub-list');
        if (!container) return;
        const items = this.wizardData.subscriptions.map((sub, i) => `
            <div class="setup-list-item">
                <div>
                    <strong>${sub.name}</strong>
                    <span>${formatCurrency(sub.amount)}/mês</span>
                </div>
                <button class="btn-mini-icon danger" onclick="window.app.setupController.removeSubscription(${i})"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('') || '<div class="empty-state" style="padding:12px;">Nenhuma assinatura adicionada.</div>';
        container.innerHTML = items;
    }

    renderDebts() {
        const items = this.wizardData.debts.map((d, i) => `
            <div class="setup-list-item">
                <div>
                    <strong>${d.name}</strong>
                    <span>${formatCurrency(d.total)} em ${d.installments}x</span>
                </div>
                <button class="btn-mini-icon danger" onclick="window.app.setupController.removeDebt(${i})"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('') || '<div class="empty-state" style="padding:12px;">Nenhuma dívida adicionada.</div>';

        return `
            <div class="setup-form">
                <h3>Dívidas e Parcelamentos</h3>
                <p class="setup-subtitle">Se tiver alguma dívida ou compra parcelada, cadastre aqui.</p>
                <div id="setup-debt-list" class="setup-dynamic-list">${items}</div>
                <div class="setup-add-card">
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <input type="text" id="setup-debt-name" placeholder="Nome (ex: Curso, Geladeira)" style="flex:1;min-width:120px;">
                        <input type="number" id="setup-debt-total" step="0.01" placeholder="Total R$" style="width:100px;">
                        <input type="number" id="setup-debt-paid" step="0.01" placeholder="Pago R$" style="width:90px;">
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
                        <input type="number" id="setup-debt-installments" min="1" placeholder="Parcelas" style="width:90px;" value="12">
                        <input type="number" id="setup-debt-due" min="1" max="31" placeholder="Dia venc." style="width:90px;" value="5">
                        <select id="setup-debt-type" style="width:110px;padding:8px;">
                            <option value="Empréstimo">Empréstimo</option>
                            <option value="Financiamento">Financiamento</option>
                            <option value="Cartão">Cartão</option>
                            <option value="Outros">Outros</option>
                        </select>
                        <input type="text" id="setup-debt-creditor" placeholder="Credor" style="flex:1;min-width:100px;">
                        <button class="btn-icon" onclick="window.app.setupController.addDebt()"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </div>
            </div>
        `;
    }

    renderDebtsList() {
        const container = document.getElementById('setup-debt-list');
        if (!container) return;
        const items = this.wizardData.debts.map((d, i) => `
            <div class="setup-list-item">
                <div>
                    <strong>${d.name}</strong>
                    <span>${formatCurrency(d.total)} em ${d.installments}x</span>
                </div>
                <button class="btn-mini-icon danger" onclick="window.app.setupController.removeDebt(${i})"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('') || '<div class="empty-state" style="padding:12px;">Nenhuma dívida adicionada.</div>';
        container.innerHTML = items;
    }

    renderGoals() {
        return `
            <div class="setup-form">
                <h3>Meta de Economia</h3>
                <p class="setup-subtitle">Opcional — defina um objetivo financeiro.</p>
                <div class="input-group">
                    <label>Nome do objetivo</label>
                    <input type="text" id="setup-goal-name" value="${this.wizardData.goalName}" placeholder="Ex: Viagem, Fundo de emergência..." onchange="window.app.setupController.wizardData.goalName = this.value">
                </div>
                <div style="display:flex; gap:12px;">
                    <div class="input-group" style="flex:1;">
                        <label>Valor meta (R$)</label>
                        <input type="number" step="0.01" id="setup-goal-target" value="${this.wizardData.goalTarget || ''}" placeholder="0,00" onchange="window.app.setupController.wizardData.goalTarget = parseFloat(this.value) || 0">
                    </div>
                    <div class="input-group" style="flex:1;">
                        <label>Já guardado (R$)</label>
                        <input type="number" step="0.01" id="setup-goal-current" value="${this.wizardData.goalCurrent || ''}" placeholder="0,00" onchange="window.app.setupController.wizardData.goalCurrent = parseFloat(this.value) || 0">
                    </div>
                </div>
                <div class="input-group">
                    <label>Data alvo (opcional)</label>
                    <input type="date" id="setup-goal-deadline" value="${this.wizardData.goalDeadline}" onchange="window.app.setupController.wizardData.goalDeadline = this.value">
                </div>
            </div>
        `;
    }

    renderReview() {
        const d = this.wizardData;
        const totalIncome = d.yourIncome + d.partnerIncome;
        const totalBills = d.rent + d.condoFee + d.water + d.electricity + d.internet;
        const subTotal = d.subscriptions.reduce((s, sub) => s + sub.amount, 0);
        const debtTotal = d.debts.reduce((s, debt) => s + debt.total, 0);

        return `
            <div class="setup-form">
                <h3>Revisão Final</h3>
                <p class="setup-subtitle">Confira os dados antes de finalizar.</p>
                <div class="setup-review-list">
                    <div class="setup-review-item">
                        <span>Modo</span>
                        <strong>${d.mode === 'solo' ? '👤 Individual' : `👥 Compartilhado (${d.partnerName})`}</strong>
                    </div>
                    <div class="setup-review-item">
                        <span>Renda total</span>
                        <strong>${formatCurrency(totalIncome)}/mês</strong>
                    </div>
                    ${totalBills > 0 ? `
                    <div class="setup-review-item">
                        <span>Contas fixas</span>
                        <strong>${formatCurrency(totalBills)}/mês</strong>
                    </div>
                    ` : ''}
                    ${subTotal > 0 ? `
                    <div class="setup-review-item">
                        <span>Assinaturas</span>
                        <strong>${d.subscriptions.length} itens — ${formatCurrency(subTotal)}/mês</strong>
                    </div>
                    ` : ''}
                    ${debtTotal > 0 ? `
                    <div class="setup-review-item">
                        <span>Dívidas</span>
                        <strong>${d.debts.length} item(ns) — ${formatCurrency(debtTotal)}</strong>
                    </div>
                    ` : ''}
                    ${d.goalName ? `
                    <div class="setup-review-item">
                        <span>Meta</span>
                        <strong>${d.goalName} — ${formatCurrency(d.goalTarget)}</strong>
                    </div>
                    ` : ''}
                </div>
                <div class="setup-tip" style="margin-top:16px;">
                    <i class="fa-solid fa-check-circle" style="color:var(--income);"></i>
                    <span>Orçamentos serão sugeridos com base nos seus dados.</span>
                </div>
            </div>
        `;
    }

    updateProgress() {
        const bar = document.getElementById('setup-progress-bar');
        const label = document.getElementById('setup-progress-label');
        if (bar) bar.style.width = `${((this.currentStep + 1) / STEPS.length) * 100}%`;
        if (label) label.textContent = `Passo ${this.currentStep + 1} de ${STEPS.length}`;
    }

    updateButtons() {
        const prevBtn = document.getElementById('setup-prev-btn');
        const nextBtn = document.getElementById('setup-next-btn');
        const finishBtn = document.getElementById('setup-finish-btn');

        if (prevBtn) prevBtn.classList.toggle('hidden', this.currentStep === 0);
        if (nextBtn) nextBtn.classList.toggle('hidden', this.currentStep >= STEPS.length - 1);
        if (finishBtn) finishBtn.classList.toggle('hidden', this.currentStep < STEPS.length - 1);
    }

    skip() {
        storageService.setSetupCompleted(true);
        this.hideModal();
    }
}

export default SetupController;
