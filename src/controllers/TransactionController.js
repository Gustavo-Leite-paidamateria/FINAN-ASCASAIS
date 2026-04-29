import { Transaction, Installment, ScheduledBill, Card } from '../models/index.js';
import { supabaseService, storageService, notificationService } from '../services/index.js';
import { formatCurrency } from '../utils/index.js';

class TransactionController {
    constructor() {
        this.isSplitMode = false;
        this.splitItems = [];
        this.editingId = null;
    }

    openModal(config) {
        const modal = document.getElementById('add-modal');
        const form = document.getElementById('transaction-form');
        
        if (!modal || !form) return;
        
        form.reset();
        this.isSplitMode = false;
        this.splitItems = [];
        this.editingId = null;
        
        const splitContainer = document.getElementById('split-items-container');
        if (splitContainer) splitContainer.classList.add('hidden');
        
        const categoryGrid = document.querySelector('.category-grid');
        if (categoryGrid) {
            categoryGrid.style.opacity = '1';
            categoryGrid.style.pointerEvents = 'auto';
        }
        
        const saveBtn = document.getElementById('save-trans-btn');
        if (saveBtn) saveBtn.textContent = "Adicionar";
        
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        const localDate = new Date(today - offset).toISOString().split('T')[0];
        const dateInput = document.getElementById('trans-date');
        if (dateInput) dateInput.value = localDate;

        const linkSelect = document.getElementById('trans-link-bill');
        if (linkSelect && config) {
            linkSelect.innerHTML = '<option value="">Avulso / Nenhuma</option>';
            
            const currentDate = window.app?.dashboardController?.currentDate || new Date();
            const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

            config.scheduledBills.forEach(b => {
                if (b.isPaidForDate(currentDate)) return;
                if (b.startDate && new Date(b.startDate) > monthEnd) return;
                if (b.endDate && new Date(b.endDate) < monthStart) return;
                linkSelect.innerHTML += `<option value="${b.id}">Vincular a: ${b.name} (${formatCurrency(b.amount)})</option>`;
            });
        }

        const debtSelect = document.getElementById('trans-debt');
        if (debtSelect && config) {
            debtSelect.innerHTML = '<option value="">Selecione uma dívida (opcional)</option>';
            config.debts?.forEach(d => {
                const remaining = d.total - (d.paid || 0);
                if (remaining > 0) {
                    debtSelect.innerHTML += `<option value="${d.id}">${d.name} - Restante: ${formatCurrency(remaining)}</option>`;
                }
            });
        }

        const cardInvoiceInfo = document.getElementById('card-invoice-info');
        if (cardInvoiceInfo) cardInvoiceInfo.innerHTML = '';
        
        setTimeout(() => {
            const cardSelect = document.getElementById('trans-card');
            if (cardSelect && cardSelect.value) {
                this.onCardChange(config);
            }
        }, 100);
        
        modal.classList.remove('hidden');
    }

    closeModal() {
        document.getElementById('add-modal')?.classList.add('hidden');
    }

    onLinkBillChange(config) {
        const linkSelect = document.getElementById('trans-link-bill');
        if (!linkSelect) return;

        const billId = linkSelect.value;
        if (!billId) return;

        const bill = config.scheduledBills.find(b => b.id === billId);
        if (!bill) return;

        // Auto-fill valor
        const amountInput = document.getElementById('trans-amount');
        if (amountInput) amountInput.value = bill.amount;

        // Auto-fill descrição
        const descInput = document.getElementById('trans-desc');
        if (descInput) descInput.value = bill.name;

        // Auto-fill categoria
        const catRadio = document.querySelector(`input[name="trans-category"][value="${bill.category}"]`);
        if (catRadio) catRadio.checked = true;

        // Tipo = Despesa
        const expenseRadio = document.getElementById('type-expense');
        if (expenseRadio) expenseRadio.checked = true;

        // Auto-fill owner
        const ownerMap = { 'eu': 'owner-me', 'esposa': 'owner-her', 'ambos': 'owner-both' };
        const ownerRadio = document.getElementById(ownerMap[bill.owner] || 'owner-both');
        if (ownerRadio) ownerRadio.checked = true;

        // Auto-fill meio de pagamento
        if (bill.payMethod === 'card') {
            const cardRadio = document.getElementById('pay-card');
            if (cardRadio) {
                cardRadio.checked = true;
                cardRadio.dispatchEvent(new Event('change'));
            }
            setTimeout(() => {
                const cardSelect = document.getElementById('trans-card');
                if (cardSelect && bill.cardId) cardSelect.value = bill.cardId;
            }, 50);
        } else {
            const pixRadio = document.getElementById('pay-pix');
            if (pixRadio) {
                pixRadio.checked = true;
                pixRadio.dispatchEvent(new Event('change'));
            }
            setTimeout(() => {
                const walletSelect = document.getElementById('trans-wallet');
                if (walletSelect && bill.walletId) walletSelect.value = bill.walletId;
            }, 50);
        }

        // Auto-fill data usando o dia de vencimento do mês atual
        const dateInput = document.getElementById('trans-date');
        if (dateInput && bill.dueDay) {
            const now = new Date();
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const day = Math.min(bill.dueDay, lastDay);
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            dateInput.value = dateStr;
        }

        this.updateInstallmentCalc();
    }

    onCardChange(config) {
        const cardSelect = document.getElementById('trans-card');
        if (!cardSelect) return;

        const cardId = cardSelect.value;
        const invoiceInfo = document.getElementById('card-invoice-info');
        if (!invoiceInfo) return;

        if (!cardId) {
            invoiceInfo.innerHTML = '';
            return;
        }

        const card = config.cards.find(c => c.id === cardId);
        if (!card) return;

        const transactions = window.app?.dashboardController?.transactions || [];
        const invoiceTotal = card.getInvoiceTotal(transactions);

        const { start, end } = card.getInvoiceRange();
        const minPayment = invoiceTotal * 0.15;

        invoiceInfo.innerHTML = `
            <div style="color: #60a5fa; font-weight: 600;">
                💳 Fatura atual: <span style="color: #fff;">${formatCurrency(invoiceTotal)}</span>
            </div>
            <div style="color: #9ca3af; font-size: 0.75rem; margin-top: 4px;">
                Período: ${start.toLocaleDateString('pt-BR')} - ${end.toLocaleDateString('pt-BR')}
            </div>
            <div style="color: #fbbf24; font-size: 0.75rem; margin-top: 4px;">
                Mínimo recomendado: ${formatCurrency(minPayment)}
            </div>
        `;

        const amountInput = document.getElementById('trans-amount');
        if (amountInput && !amountInput.value) {
            amountInput.value = invoiceTotal.toFixed(2);
        }
    }

    async save(config) {
        const dateInput = document.getElementById('trans-date')?.value;
        const payMethod = document.querySelector('input[name="pay-method"]:checked')?.value || 'pix';
        const installments = parseInt(document.getElementById('trans-installments')?.value) || 1;
        const isRecurringPix = payMethod === 'pix' && 
            document.getElementById('recurrence-group') && 
            !document.getElementById('recurrence-group').classList.contains('hidden');
        const recurringMonths = isRecurringPix ? (parseInt(document.getElementById('trans-recurrence-months')?.value) || 1) : 1;
        
        const cardId = document.getElementById('trans-card')?.value;
        const walletId = document.getElementById('trans-wallet')?.value;
        const debtId = document.getElementById('trans-debt')?.value;
        const baseAmount = parseFloat(document.getElementById('trans-amount')?.value);
        const payeeName = document.getElementById('trans-payee')?.value?.trim();
        let payeeId = null;

        if (payeeName) {
            const payee = await window.app.payeeController.ensurePayee(config, payeeName);
            payeeId = payee?.id;
        }
        
        if (this.isSplitMode) {
            const totalSplit = this.splitItems.reduce((acc, curr) => acc + curr.amount, 0);
            if (Math.abs(baseAmount - totalSplit) > 0.01) {
                alert('Erro: O valor distribuído nos itens não bate com o valor total!');
                return;
            }
        }

        const transType = document.querySelector('input[name="trans-type"]:checked')?.value === 'income' ? 'Receita' : 'Despesa';

        // Validações Obrigatórias e Checagem de Saldo
        if (payMethod === 'card') {
            if (!cardId) {
                notificationService.error('Atenção', 'Selecione um cartão de crédito.');
                return;
            }
        } else if (payMethod === 'pix') {
            if (!walletId) {
                notificationService.error('Atenção', 'Selecione uma Conta/Carteira de saída.');
                return;
            }
            
            // Bloqueio de Saldo Insuficiente para Despesas
            if (transType === 'Despesa') {
                const wallet = config.wallets.find(w => w.id === walletId);
                if (wallet) {
                    const allTransactions = await supabaseService.fetchAllTransactions();
                    const currentBalance = wallet.getBalance(allTransactions);
                    if (baseAmount > currentBalance) {
                        notificationService.error(
                            'Saldo Insuficiente', 
                            `A conta tem apenas ${formatCurrency(currentBalance)}. Você não pode gastar ${formatCurrency(baseAmount)}.`
                        );
                        return;
                    }
                }
            }
        }

        const recordsToInsert = [];
        const baseDate = dateInput ? new Date(dateInput) : new Date();
        
        const owner = document.querySelector('input[name="trans-owner"]:checked')?.value || 'ambos';
        const isSub = document.getElementById('trans-is-sub')?.checked;
        const category = document.querySelector('input[name="trans-category"]:checked')?.value || 'Outros';
        const description = document.getElementById('trans-desc')?.value?.trim() || '';
        
        for (let m = 0; m < recurringMonths; m++) {
            let recurrenceDate = new Date(baseDate);
            recurrenceDate.setMonth(recurrenceDate.getMonth() + m);

            const pushRecord = (amt, specificDesc, ctg) => {
                const meta = {
                    owner: owner,
                    cartao_id: payMethod === 'card' ? cardId : null,
                    conta_id: walletId || null
                };
                recordsToInsert.push({
                    tipo: transType,
                    valor: installments > 1 ? amt / installments : amt,
                    descricao: specificDesc,
                    categoria: ctg,
                    data: recurrenceDate.toISOString(),
                    forma_pagamento: payMethod,
                    status: 'Pago',
                    observacoes: JSON.stringify(meta),
                    referencia: isSub ? 'assinatura' : null,
                    payee_id: payeeId
                });
            };

            if (this.isSplitMode) {
                this.splitItems.forEach((si) => {
                    let d = description + ` [${si.desc || 'Diversos'}]`;
                    if (installments > 1) d += ` (1/${installments})`;
                    else if (recurringMonths > 1) d += ` (Ciclo ${m+1}/${recurringMonths})`;
                    pushRecord(si.amount, d, si.cat);
                });
            } else {
                let d = description;
                if (installments > 1) d += ` (1/${installments})`;
                else if (recurringMonths > 1) d += ` (Ciclo ${m+1}/${recurringMonths})`;
                pushRecord(baseAmount, d, category);
            }
        }

        const newTrans = recordsToInsert[0];

        if (installments > 1) {
            const installmentMaster = new Installment({
                desc: description,
                totalVal: baseAmount,
                count: installments,
                startDate: newTrans.data,
                cardId: payMethod === 'card' ? cardId : null,
                type: payMethod,
                owner: newTrans.owner,
                category: newTrans.categoria
            });
            config.installments.push(installmentMaster);

            // TAMBÉM criar como Conta Programada se for Crediário para controle de baixa
            if (payMethod === 'crediario') {
                const endDate = new Date(newTrans.data);
                endDate.setMonth(endDate.getMonth() + installments);
                
                const schedBill = new ScheduledBill({
                    name: '[Parcelado] ' + description,
                    amount: baseAmount / installments,
                    category: category,
                    dueDay: new Date(newTrans.data).getDate(),
                    isMonthly: false,
                    count: installments,
                    startDate: newTrans.data,
                    endDate: endDate.toISOString().split('T')[0],
                    payMethod: 'pix',
                    walletId: walletId || null,
                    owner: owner
                });
                config.scheduledBills.push(schedBill);
            }
            
            await supabaseService.saveConfig(config);
        }

        // PRIMEIRO: Salvar a transação no banco
        try {
            if (this.editingId) {
                await supabaseService.updateTransaction(this.editingId, recordsToInsert[0]);
                notificationService.success('Sucesso', 'Transação atualizada');
            } else {
                await supabaseService.insertTransaction(recordsToInsert);
                notificationService.success('Sucesso', 'Transação adicionada');

                if (isSub) {
                    await this.handleSubscriptionLink(config, recordsToInsert[0]);
                }

                if (payMethod === 'card' && cardId && category === 'card_pay') {
                    await this.handleCardPayment(config, cardId, recordsToInsert[0]);
                }
            }
        } catch (e) {
            console.error('Erro ao salvar transação:', e);
            notificationService.error('Erro', 'Falha ao salvar a transação');
            return;
        }

        // DEPOIS: Vincular conta programada (só após salvar com sucesso)
        const linkedBillId = document.getElementById('trans-link-bill')?.value;

        if (linkedBillId) {
            const bill = config.scheduledBills.find(b => b.id === linkedBillId);
            if (bill) {
                if (!bill.paidMonths) bill.paidMonths = [];
                const transDate = new Date(newTrans.data);
                const ym = `${transDate.getFullYear()}-${String(transDate.getMonth() + 1).padStart(2, '0')}`;
                if (!bill.paidMonths.includes(ym)) {
                    bill.paidMonths.push(ym);

                    // Sincronizar com Dívida se for o caso
                    if (bill.name.startsWith('[Dívida] ')) {
                        const debtName = bill.name.replace('[Dívida] ', '');
                        const debt = config.debts?.find(d => d.name === debtName);
                        if (debt) {
                            debt.paid = (debt.paid || 0) + parseFloat(newTrans.valor);
                        }
                    }

                    storageService.saveConfig(config);
                    await supabaseService.saveConfig(config);
                    notificationService.success('🔗 Vinculado', `Conta "${bill.name}" marcada como paga!`);
                }
            }
        }

        if (debtId) {
            const debt = config.debts?.find(d => d.id === debtId);
            if (debt) {
                const totalAmount = recordsToInsert.reduce((sum, r) => sum + parseFloat(r.valor), 0);
                debt.paid = (debt.paid || 0) + totalAmount;
                storageService.saveConfig(config);
                await supabaseService.saveConfig(config);
                notificationService.success('🔗 Dívida', `Pagamento registrado em "${debt.name}"!`);
            }
        } else if (!this.editingId) {
            await this.smartMatch(config, newTrans);
        }

        this.closeModal();
        window.app?.dashboardController?.loadData();
        
        if (window.app?.planningController) {
            window.app.planningController.render(window.app.config, window.app.dashboardController.transactions);
        }
    }

    async handleCardPayment(config, cardId, transaction) {
        const card = config.cards.find(c => c.id === cardId);
        if (!card) return;

        const transactions = window.app?.dashboardController?.transactions || [];
        const invoiceTotal = card.getInvoiceTotal(transactions);
        const paidAmount = parseFloat(transaction.valor);

        window.app._reconcileCardId = cardId;
        window.app._reconcileEstimated = invoiceTotal;
        window.app._reconcileOriginalTrans = transaction;
        window.app._reconcileConfig = config;

        document.getElementById('trans-amount').value = paidAmount.toFixed(2);
        document.getElementById('reconcile-estimated').textContent = formatCurrency(invoiceTotal);
        document.getElementById('reconcile-label').textContent = `Valor que você pagou (R$)`;
        document.getElementById('reconcile-amount').value = paidAmount.toFixed(2);
        
        document.getElementById('reconcile-body')?.classList.remove('hidden');
        document.getElementById('reconcile-result')?.classList.add('hidden');
        
        document.getElementById('add-modal')?.classList.add('hidden');
        document.getElementById('reconcile-modal')?.classList.remove('hidden');
    }

    async smartMatch(config, transaction) {
        if (transaction.tipo === 'Receita') return;

        const currentDate = window.app?.dashboardController?.currentDate || new Date();
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        const activeBills = config.scheduledBills.filter(b => {
            if (b.isPaidForDate(currentDate)) return false;
            if (b.startDate && new Date(b.startDate) > monthEnd) return false;
            if (b.endDate && new Date(b.endDate) < monthStart) return false;
            return true;
        });

        const descLower = transaction.descricao.toLowerCase();

        for (const bill of activeBills) {
            const billLower = bill.name.toLowerCase();

            if (descLower.includes(billLower) || billLower.includes(descLower)) {
                if (!bill.paidMonths) bill.paidMonths = [];
                const ym = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                if (!bill.paidMonths.includes(ym)) {
                    bill.paidMonths.push(ym);
                    storageService.saveConfig(config);
                    await supabaseService.saveConfig(config);
                    notificationService.success('🔗 Vínculo Automático',
                        `"${transaction.descricao}" vinculada à conta "${bill.name}"`);
                }
                break;
            }
        }
    }

    async handleSubscriptionLink(config, transaction) {
        const exists = config.scheduledBills.find(b => 
            b.name.toLowerCase() === transaction.descricao.toLowerCase()
        );

        if (!exists) {
            if (confirm(`Deseja adicionar "${transaction.descricao}" como Conta Programada?`)) {
                config.scheduledBills.push(new ScheduledBill({
                    name: transaction.descricao,
                    amount: parseFloat(transaction.valor),
                    category: transaction.categoria,
                    dueDay: new Date(transaction.data).getDate(),
                    startDate: transaction.data
                }));
                await supabaseService.saveConfig(config);
                notificationService.success('Sucesso', 'Assinatura adicionada ao planejamento');
            }
        }
    }

    onPayeeChange(config) {
        const payeeName = document.getElementById('trans-payee')?.value;
        if (!payeeName) return;

        const payee = config.payees.find(p => p.name === payeeName);
        if (payee && payee.defaultCategory) {
            const catRadio = document.querySelector(`input[name="trans-category"][value="${payee.defaultCategory}"]`);
            if (catRadio) catRadio.checked = true;
        }
    }

    async edit(id) {
        try {
            const transactions = await supabaseService.fetchAllTransactions();
            const trans = transactions.find(t => t.id === id);
            if (!trans) return;

            document.getElementById('trans-amount').value = trans.valor;
            document.getElementById('trans-desc').value = trans.descricao;
            document.getElementById('trans-date').value = new Date(trans.data).toISOString().split('T')[0];
            
            document.querySelector(`input[name="trans-type"][value="${trans.tipo === 'Receita' ? 'income' : 'expense'}"]`).checked = true;
            document.querySelector(`input[name="trans-category"][value="${trans.categoria}"]`).checked = true;
            document.querySelector(`input[name="trans-owner"][value="${trans.owner}"]`).checked = true;

            this.editingId = id;
            document.getElementById('save-trans-btn').textContent = "Atualizar";
            document.getElementById('add-modal')?.classList.remove('hidden');
        } catch (e) {
            console.error('Error loading transaction:', e);
            notificationService.error('Erro', 'Falha ao carregar transação');
        }
    }

    async delete(id) {
        if (!confirm("Deseja realmente excluir esta transação?")) return;
        
        try {
            await supabaseService.deleteTransaction(id);
            notificationService.success('Sucesso', 'Transação excluída');
            window.app?.dashboardController?.loadData();
        } catch (e) {
            notificationService.error('Erro', 'Falha ao excluir transação');
        }
    }

    toggleSplitMode() {
        this.isSplitMode = !this.isSplitMode;
        const container = document.getElementById('split-items-container');
        const categoryGrid = document.querySelector('.category-grid');
        
        if (container) container.classList.toggle('hidden', !this.isSplitMode);
        if (categoryGrid) {
            categoryGrid.style.opacity = this.isSplitMode ? '0.3' : '1';
            categoryGrid.style.pointerEvents = this.isSplitMode ? 'none' : 'auto';
        }
        
        if (this.isSplitMode && this.splitItems.length === 0) {
            this.addSplitRow();
        }
        this.updateSplitSum();
    }

    addSplitRow() {
        this.splitItems.push({ id: Date.now() + Math.random(), desc: '', amount: 0, cat: 'Outros' });
        this.renderSplitItems();
    }

    removeSplitRow(id) {
        this.splitItems = this.splitItems.filter(i => i.id !== id);
        this.renderSplitItems();
    }

    updateSplitRow(id, field, value) {
        const item = this.splitItems.find(i => i.id === id);
        if (item) {
            if (field === 'amount') item.amount = parseFloat(value) || 0;
            else item[field] = value;
            this.updateSplitSum();
        }
    }

    renderSplitItems() {
        const list = document.getElementById('split-items-list');
        if (!list) return;
        
        const categories = ["Mercado", "Alimentação", "Transporte", "Casa", "Lazer", "Saúde", "Pets", "Compras", "Educação", "Viagem", "Presentes", "Investimentos", "Assinaturas", "Outros"];
        
        list.innerHTML = this.splitItems.map(item => `
            <div style="display:flex; gap:6px; align-items:center; background:rgba(255,255,255,0.05); padding:8px; border-radius:8px;">
                <input type="text" placeholder="Item..." value="${item.desc}" 
                    oninput="window.app.transactionController.updateSplitRow(${item.id}, 'desc', this.value)" 
                    style="flex:2; padding:8px;">
                <select onchange="window.app.transactionController.updateSplitRow(${item.id}, 'cat', this.value)" 
                    style="flex:2; padding:8px; background:var(--bg-prime); border:1px solid var(--glass-border); color:white; border-radius:8px;">
                    ${categories.map(c => `<option value="${c}" ${item.cat === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
                <input type="number" step="0.01" placeholder="R$" value="${item.amount || ''}" 
                    oninput="window.app.transactionController.updateSplitRow(${item.id}, 'amount', this.value)" 
                    style="flex:1.5; padding:8px; text-align:right;">
                <button type="button" class="btn-mini-icon danger" 
                    onclick="window.app.transactionController.removeSplitRow(${item.id})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `).join('');
    }

    updateSplitSum() {
        const totalSplit = this.splitItems.reduce((acc, curr) => acc + curr.amount, 0);
        const mainTotal = parseFloat(document.getElementById('trans-amount')?.value) || 0;
        const diff = mainTotal - totalSplit;
        
        const display = document.getElementById('split-sum-display');
        if (display) {
            display.textContent = formatCurrency(diff);
            display.style.color = Math.abs(diff) < 0.01 ? 'var(--income)' : 'var(--accent)';
        }
    }

    updateInstallmentCalc() {
        const val = parseFloat(document.getElementById('trans-amount')?.value) || 0;
        const inst = parseInt(document.getElementById('trans-installments')?.value) || 1;
        const calc = document.getElementById('installment-calc');
        if (calc) calc.textContent = formatCurrency(val / inst);
        
        if (this.isSplitMode) this.updateSplitSum();
    }
}

export default TransactionController;
