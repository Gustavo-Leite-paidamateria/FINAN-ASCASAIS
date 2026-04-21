import { Debt, ScheduledBill, DEBT_TYPES } from '../models/index.js';
import { supabaseService, storageService, notificationService } from '../services/index.js';
import { formatCurrency, SpiritualMentor } from '../utils/index.js';

class DebtController {
    render(config) {
        this.renderSummary(config);
        this.renderList(config);
    }

    renderSummary(config) {
        const totalRemainingEl = document.getElementById('total-debt-remaining');
        const totalMonthlyEl = document.getElementById('total-debt-monthly');
        const pctLabel = document.getElementById('debt-pct-label');
        const progressFill = document.getElementById('debt-progress-fill');

        if (!config.debts || config.debts.length === 0) {
            if (totalRemainingEl) totalRemainingEl.textContent = formatCurrency(0);
            if (totalMonthlyEl) totalMonthlyEl.textContent = formatCurrency(0);
            if (pctLabel) pctLabel.textContent = '0%';
            if (progressFill) progressFill.style.width = '0%';
            return;
        }

        let totalPaid = 0, totalDebt = 0, totalMonthly = 0;
        config.debts.forEach(d => {
            totalDebt += d.total;
            totalPaid += d.paid || 0;
            totalMonthly += d.getMonthlyPayment();
        });

        const totalRemaining = Math.max(0, totalDebt - totalPaid);
        if (totalRemainingEl) totalRemainingEl.textContent = formatCurrency(totalRemaining);
        if (totalMonthlyEl) totalMonthlyEl.textContent = formatCurrency(totalMonthly);
        
        const overallPct = totalDebt > 0 ? Math.min((totalPaid / totalDebt) * 100, 100) : 0;
        if (pctLabel) pctLabel.textContent = overallPct.toFixed(1) + '%';
        if (progressFill) progressFill.style.width = overallPct + '%';

        SpiritualMentor.render('debts-insight-container', SpiritualMentor.getDebtInsight(config));
    }

    renderList(config) {
        const list = document.getElementById('debts-list');
        if (!list) return;

        if (!config.debts || config.debts.length === 0) {
            list.innerHTML = '<div class="empty-state" style="padding:40px;">Nenhuma dívida cadastrada.<br>Toque em <b>+</b> para adicionar.</div>';
            return;
        }

        list.innerHTML = config.debts.map(d => {
            const remaining = d.getRemaining();
            const pct = d.getProgress();
            const monthly = d.getMonthlyPayment();
            const paidInst = d.getPaidInstallments();
            
            let style = DEBT_TYPES[d.type] || DEBT_TYPES['Outros'];
            const barColor = pct >= 100 ? 'linear-gradient(90deg,#10b981,#34d399)' 
                : pct > 50 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' 
                : 'linear-gradient(90deg,#f43f5e,#fb7185)';
            
            const dueHtml = d.dueDay ? `<p style="font-size:0.72rem;color:var(--text-sec);margin-top:10px;">📅 Vence todo dia <b style="color:var(--text-prime);">${d.dueDay}</b></p>` : '';

            return `
                <div class="debt-card glass-card">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <div class="icon-circle" style="background:${style.bg};color:${style.color};width:44px;height:44px;min-width:44px;">
                                <i class="fa-solid ${style.icon}"></i>
                            </div>
                            <div>
                                <h4 style="font-size:1rem;font-weight:600;">${d.name}</h4>
                                <p style="font-size:0.75rem;color:var(--text-sec);">${d.type}${d.creditor ? ' • ' + d.creditor : ''}</p>
                            </div>
                        </div>
                        <div style="display:flex;gap:6px;">
                            <button class="btn-mini-icon" onclick="window.app.openPayDebtModal('${d.id}')" title="Registrar pagamento">
                                <i class="fa-solid fa-circle-plus"></i>
                            </button>
                            <button class="btn-mini-icon danger" onclick="window.app.deleteDebt('${d.id}')">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:10px;gap:8px;">
                        <div>
                            <p style="font-size:0.7rem;color:var(--text-sec);">Restante</p>
                            <h3 style="color:#f43f5e;font-size:1.1rem;">${formatCurrency(remaining)}</h3>
                        </div>
                        <div style="text-align:center;">
                            <p style="font-size:0.7rem;color:var(--text-sec);">Parcela/mês</p>
                            <h3 style="color:#f59e0b;font-size:1.1rem;">${formatCurrency(monthly)}</h3>
                        </div>
                        <div style="text-align:right;">
                            <p style="font-size:0.7rem;color:var(--text-sec);">Parcelas</p>
                            <h3 style="font-size:1.1rem;">${paidInst}/${d.installments}</h3>
                        </div>
                    </div>
                    <div>
                        <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-sec);margin-bottom:5px;">
                            <span>${formatCurrency(d.paid || 0)} pago</span>
                            <span>${pct.toFixed(1)}%</span>
                        </div>
                        <div style="height:7px;background:rgba(0,0,0,0.4);border-radius:4px;overflow:hidden;">
                            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width 1s ease;"></div>
                        </div>
                    </div>
                    ${dueHtml}
                </div>
            `;
        }).join('');
    }

    async addDebt(config) {
        const name = document.getElementById('debt-name')?.value?.trim();
        const type = document.querySelector('input[name="debt-type"]:checked')?.value || 'Outros';
        const total = parseFloat(document.getElementById('debt-total')?.value) || 0;
        const paid = parseFloat(document.getElementById('debt-paid')?.value) || 0;
        const installments = parseInt(document.getElementById('debt-installments')?.value) || 1;
        const dueDay = parseInt(document.getElementById('debt-due-day')?.value) || null;
        const startDate = document.getElementById('debt-start-date')?.value || null;
        const creditor = document.getElementById('debt-creditor')?.value?.trim() || '';

        if (name && total > 0) {
            const debt = new Debt({ name, type, total, paid, installments, dueDay, startDate, creditor });
            config.debts.push(debt);
            
            const bill = debt.toScheduledBill();
            config.scheduledBills.push(bill);
            
            storageService.saveConfig(config);
            await supabaseService.saveConfig(config);
            
            document.getElementById('debt-modal')?.classList.add('hidden');
            this.render(config);
            notificationService.success('Sucesso', 'Dívida adicionada! Conta programada criada.');
        }
    }

    async openPayDebtModal(config, id) {
        const debt = config.debts.find(d => d.id === id);
        if (!debt) return;

        const monthly = debt.getMonthlyPayment();
        const val = prompt(
            `Registrar pagamento em "${debt.name}"\n` +
            `Parcela estimada: ${formatCurrency(monthly)}\n\n` +
            `Valor pago agora (R$):`
        );
        
        if (val === null) return;
        
        const amount = parseFloat(val.replace(',', '.'));
        if (isNaN(amount) || amount <= 0) {
            alert('Valor inválido.');
            return;
        }

        debt.paid = (debt.paid || 0) + amount;
        
        const bill = config.scheduledBills.find(b => b.name === '[Dívida] ' + debt.name);
        if (bill) {
            if (!bill.paidMonths) bill.paidMonths = [];
            const now = new Date();
            const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            if (!bill.paidMonths.includes(ym)) {
                bill.paidMonths.push(ym);
            }
        }
        
        storageService.saveConfig(config);
        await supabaseService.saveConfig(config);

        try {
            const walletId = config.wallets[0]?.id || 'w_default';
            await supabaseService.insertTransaction({
                tipo: 'Despesa',
                valor: amount,
                descricao: 'Pagamento de Dívida - ' + debt.name,
                categoria: 'Outros',
                data: new Date().toISOString(),
                forma_pagamento: 'pix',
                status: 'Pago',
                observacoes: JSON.stringify({
                    owner: 'ambos',
                    conta_id: walletId
                })
            });
        } catch (e) {
            console.warn('Failed to insert debt payment in financeiro', e);
        }

        this.render(config);
        
        if (document.getElementById('dashboard-view')?.classList.contains('active')) {
            window.app?.dashboardController?.loadData();
        }
    }

    async deleteDebt(config, id) {
        const debt = config.debts.find(d => d.id === id);
        if (confirm('Deseja remover esta dívida?')) {
            config.debts = config.debts.filter(d => d.id !== id);
            if (debt) {
                config.scheduledBills = config.scheduledBills.filter(b => b.name !== '[Dívida] ' + debt.name);
            }
            storageService.saveConfig(config);
            await supabaseService.saveConfig(config);
            this.render(config);
        }
    }
}

export default DebtController;
