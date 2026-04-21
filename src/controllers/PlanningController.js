import { ScheduledBill, Card, Wallet, Budget, Installment } from '../models/index.js';
import { supabaseService, storageService, notificationService } from '../services/index.js';
import { formatCurrency, getMonthDateRange, SpiritualMentor } from '../utils/index.js';

class PlanningController {
    constructor() {
        this.editingBillId = null;
    }

    renderBudgets(config) {
        const container = document.getElementById('budget-config-list');
        if (!container) return;

        container.innerHTML = '';
        Object.keys(config.budgets).forEach(cat => {
            const div = document.createElement('div');
            div.className = 'config-item';
            div.innerHTML = `
                <label>${cat}</label>
                <input type="number" data-cat="${cat}" value="${config.budgets[cat]}" step="50">
            `;
            const inp = div.querySelector('input');
            inp.addEventListener('input', (e) => {
                config.budgets[cat] = parseFloat(e.target.value) || 0;
                const text = SpiritualMentor.getBudgetSetupInsight(config.budgets);
                SpiritualMentor.render('budget-setup-insight', text);
            });
            container.appendChild(div);
        });

        // Render Mentor Insight for Budget Setup
        const insightText = SpiritualMentor.getBudgetSetupInsight(config.budgets);
        if (insightText) {
            SpiritualMentor.render('budget-setup-insight', insightText);
        }
    }

    async saveBudgets(config) {
        const inputs = document.querySelectorAll('#budget-config-list input');
        inputs.forEach(inp => {
            config.budgets[inp.dataset.cat] = parseFloat(inp.value) || 0;
        });
        
        storageService.saveConfig(config);
        await supabaseService.saveConfig(config);
        
        notificationService.success('Sucesso', 'Orçamentos salvos com sucesso!');
    }

    renderScheduledBills(config) {
        const container = document.getElementById('scheduled-bills-list');
        if (!container) return;
        
        container.innerHTML = '';

        config.scheduledBills.forEach(bill => {
            const isPaid = bill.isPaidForDate(window.app?.dashboardController?.currentDate || new Date());
            const div = document.createElement('div');
            div.className = `scheduled-item ${isPaid ? 'paid' : ''}`;
            
            let metaTxt = `${formatCurrency(bill.amount)} • ${bill.category}`;
            if (bill.dueDay) metaTxt += ` • Dia ${bill.dueDay}`;
            if (bill.isMonthly) {
                metaTxt += ` • <span style="color: #3b82f6; font-weight: 600;">🔄 Mensal</span>`;
            } else {
                if (bill.count) metaTxt += ` • (${bill.count}x)`;
                if (bill.startDate) metaTxt += ` • Início: ${new Date(bill.startDate).toLocaleDateString('pt-BR')}`;
                if (bill.endDate) metaTxt += ` • Término: ${new Date(bill.endDate).toLocaleDateString('pt-BR')}`;
            }
            
            div.innerHTML = `
                <div class="s-info-group">
                    <div class="s-status-toggle ${isPaid ? 'checked' : ''}" onclick="window.app.toggleBill('${bill.id}')">
                        ${isPaid ? '<i class="fa-solid fa-check"></i>' : ''}
                    </div>
                    <div class="s-details">
                        <h5 class="s-name">${bill.name}</h5>
                        <p>${metaTxt}</p>
                    </div>
                </div>
                <button class="btn-icon" onclick="window.app.deleteBill('${bill.id}')">
                    <i class="fa-solid fa-trash-can" style="font-size: 0.8rem; opacity: 0.5;"></i>
                </button>
            `;
            container.appendChild(div);
        });

        const currentDate = window.app?.dashboardController?.currentDate || new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        config.installments.forEach(inst => {
            if (inst.type === 'crediario') {
                const start = new Date(inst.startDate);
                const monthsPassed = (year - start.getFullYear()) * 12 + (month - start.getMonth());
                
                if (monthsPassed >= 0 && monthsPassed < inst.count) {
                    const div = document.createElement('div');
                    div.className = 'scheduled-item crediario-bill';
                    div.innerHTML = `
                        <div class="s-info-group">
                            <div class="icon-circle" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; width: 32px; height: 32px; font-size: 1rem;">
                                <i class="fa-solid fa-file-invoice-dollar"></i>
                            </div>
                            <div class="s-details">
                                <h5 class="s-name">${inst.desc} <span class="tag-crediario">Parcela ${monthsPassed + 1}/${inst.count}</span></h5>
                                <p>${formatCurrency(inst.totalVal / inst.count)} • ${inst.category}</p>
                            </div>
                        </div>
                    `;
                    container.appendChild(div);
                }
            }
        });
    }

    renderCards(config) {
        const container = document.getElementById('cards-config-list');
        const cardSelect = document.getElementById('trans-card');
        const schedCardSel = document.getElementById('sched-card');
        
        if (!container) return;
        
        if (config.cards.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhum cartão cadastrado.</div>';
        } else {
            container.innerHTML = config.cards.map(card => `
                <div class="card-item-config">
                    <div>
                        <span class="cat-name">💳 ${card.name}</span>
                        <span class="card-meta">Fecha dia ${card.closingDay} | Vence dia ${card.dueDay} | Limite: ${formatCurrency(card.limit || 0)}</span>
                    </div>
                    <button onclick="window.app.deleteCard('${card.id}')" class="btn-mini-icon danger">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `).join('');
        }

        if (cardSelect) {
            cardSelect.innerHTML = '<option value="">Selecione um Cartão</option>';
            config.cards.forEach(card => {
                cardSelect.innerHTML += `<option value="${card.id}">${card.name}</option>`;
            });
        }
        
        if (schedCardSel) {
            schedCardSel.innerHTML = '<option value="">Selecione um Cartão</option>';
            config.cards.forEach(card => {
                schedCardSel.innerHTML += `<option value="${card.id}">${card.name}</option>`;
            });
        }
    }

    async addCard(config) {
        const name = document.getElementById('card-name')?.value?.trim();
        const closing = parseInt(document.getElementById('card-closing')?.value);
        const due = parseInt(document.getElementById('card-due')?.value);
        const limit = parseFloat(document.getElementById('card-limit')?.value) || 0;

        if (name && closing && due) {
            config.cards.push(new Card({ name, closingDay: closing, dueDay: due, limit }));
            storageService.saveConfig(config);
            await supabaseService.saveConfig(config);
            this.renderCards(config);
            document.getElementById('card-modal')?.classList.add('hidden');
            notificationService.success('Sucesso', 'Cartão adicionado!');
        }
    }

    async deleteCard(config, id) {
        if (confirm('Deseja remover este cartão?')) {
            config.cards = config.cards.filter(c => c.id !== id);
            storageService.saveConfig(config);
            await supabaseService.saveConfig(config);
            this.renderCards(config);
        }
    }

    renderWallets(config, transactions = []) {
        const container = document.getElementById('wallets-config-list');
        const walletSelect = document.getElementById('trans-wallet');
        const schedWalletSel = document.getElementById('sched-wallet');
        
        if (!config.wallets || config.wallets.length === 0) {
            config.wallets = [new Wallet({ id: 'w_default', name: 'Conta Principal', initialBalance: 0 })];
            storageService.saveConfig(config);
        }
        
        if (!container) return;
        
        if (config.wallets.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhuma conta cadastrada.</div>';
        } else {
            container.innerHTML = config.wallets.map(w => {
                const currentBalance = transactions.length > 0 ? w.getBalance(transactions) : w.initialBalance;
                return `
                <div class="card-item-config">
                    <div>
                        <span class="cat-name">🏦 ${w.name}</span>
                        <span class="card-meta">Saldo: ${formatCurrency(currentBalance)}</span>
                    </div>
                    ${w.id !== 'w_default' ? `
                        <button onclick="window.app.deleteWallet('${w.id}')" class="btn-mini-icon danger">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            `}).join('');
        }

        if (walletSelect) {
            walletSelect.innerHTML = '';
            config.wallets.forEach(w => {
                walletSelect.innerHTML += `<option value="${w.id}">${w.name}</option>`;
            });
        }
        
        if (schedWalletSel) {
            schedWalletSel.innerHTML = '';
            config.wallets.forEach(w => {
                schedWalletSel.innerHTML += `<option value="${w.id}">${w.name}</option>`;
            });
        }
    }

    async addWallet(config) {
        const name = document.getElementById('wallet-name')?.value?.trim();
        const bal = parseFloat(document.getElementById('wallet-balance')?.value) || 0;

        if (name) {
            config.wallets.push(new Wallet({ name, initialBalance: bal }));
            storageService.saveConfig(config);
            await supabaseService.saveConfig(config);
            this.renderWallets(config, []);
            document.getElementById('wallet-modal')?.classList.add('hidden');
            notificationService.success('Sucesso', 'Conta adicionada!');
        }
    }

    async deleteWallet(config, id) {
        if (confirm('Deseja remover esta conta? As transações antigas não serão afetadas.')) {
            config.wallets = config.wallets.filter(w => w.id !== id);
            storageService.saveConfig(config);
            await supabaseService.saveConfig(config);
            this.renderWallets(config, []);
        }
    }

    async addScheduledBill(config) {
        const name = document.getElementById('sched-name')?.value?.trim();
        const amount = parseFloat(document.getElementById('sched-amount')?.value);
        const day = parseInt(document.getElementById('sched-day')?.value);
        const category = document.getElementById('sched-category')?.value || 'Outros';
        const payMethodEle = document.querySelector('input[name="sched-pay-method"]:checked');
        const payMethod = payMethodEle ? payMethodEle.value : 'pix';
        const ownerEle = document.querySelector('input[name="sched-owner"]:checked');
        const owner = ownerEle ? ownerEle.value : 'ambos';
        const walletId = document.getElementById('sched-wallet')?.value;
        const cardId = document.getElementById('sched-card')?.value;

        const recurrenceType = document.querySelector('input[name="sched-recurrence"]:checked');
        const isMonthly = !recurrenceType || recurrenceType.value === 'monthly';
        const count = isMonthly ? null : (parseInt(document.getElementById('sched-count')?.value) || null);
        const startDate = isMonthly ? null : (document.getElementById('sched-start-date')?.value || null);
        const endDate = isMonthly ? null : (document.getElementById('sched-end-date')?.value || null);

        if (name && amount && day) {
            const bill = new ScheduledBill({
                name, amount, category, dueDay: day, isMonthly, count, startDate, endDate,
                payMethod, walletId: payMethod === 'pix' ? walletId : null,
                cardId: payMethod === 'card' ? cardId : null, owner
            });
            
            config.scheduledBills.push(bill);
            storageService.saveConfig(config);
            await supabaseService.saveConfig(config);
            
            this.renderScheduledBills(config);
            this.renderBreakEven(config);
            document.getElementById('scheduled-bill-modal')?.classList.add('hidden');
            notificationService.success('Sucesso', 'Conta programada adicionada!');
        }
    }

    async toggleBill(config, id) {
        const bill = config.scheduledBills.find(b => b.id === id);
        if (!bill) return;

        if (!bill.paidMonths) bill.paidMonths = [];
        const currentDate = window.app?.dashboardController?.currentDate || new Date();
        const yearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (bill.paidMonths.includes(yearMonth)) {
            alert("Esta conta já está marcada como paga neste mês.");
            return;
        }

        if (confirm(`Deseja registrar o pagamento de "${bill.name}" agora?`)) {
            try {
                await supabaseService.insertTransaction(bill.toTransactionRecord());
                bill.paidMonths.push(yearMonth);
                
                if (bill.name.startsWith('[Dívida] ')) {
                    const debtName = bill.name.replace('[Dívida] ', '');
                    const debt = config.debts?.find(d => d.name === debtName);
                    if (debt) {
                        debt.paid = (debt.paid || 0) + bill.amount;
                    }
                }
                
                storageService.saveConfig(config);
                await supabaseService.saveConfig(config);
                notificationService.success('Sucesso', 'Conta debitada com sucesso!');
                window.app?.dashboardController?.loadData();
            } catch (e) {
                notificationService.error('Erro', 'Falha ao registrar a conta');
            }
        }
    }

    async deleteBill(config, id) {
        config.scheduledBills = config.scheduledBills.filter(b => b.id !== id);
        storageService.saveConfig(config);
        await supabaseService.saveConfig(config);
        this.renderScheduledBills(config);
        this.renderBreakEven(config);
    }

    renderBreakEven(config) {
        const breakevenAmount = document.getElementById('breakeven-amount');
        const breakevenText = document.getElementById('breakeven-text');
        if (!breakevenAmount || !breakevenText) return;

        const currentDate = window.app?.dashboardController?.currentDate || new Date();
        const { start, end } = getMonthDateRange(currentDate);

        const activeBills = config.scheduledBills.filter(b => {
            if (b.startDate && new Date(b.startDate) > end) return false;
            if (b.endDate && new Date(b.endDate) < start) return false;
            return true;
        });

        const total = activeBills.reduce((acc, curr) => acc + curr.amount, 0);
        breakevenAmount.textContent = formatCurrency(total);
        breakevenText.textContent = `Seu custo fixo programado custa ${formatCurrency(total)}. Para o mês fechar no positivo, a sua meta mínima de ganhos tem que ser acima desse valor.`;
    }

    render(config, transactions = []) {
        this.renderBudgets(config);
        this.renderScheduledBills(config);
        this.renderCards(config);
        this.renderWallets(config, transactions);
        this.renderBreakEven(config);

        SpiritualMentor.render('planning-insight-container', SpiritualMentor.getPlanningInsight(config));
    }
}

export default PlanningController;
