import { Transaction, FIXED_CATEGORIES, CATEGORY_EMOJIS, CATEGORY_ICONS, UserConfig, ScheduledBill, Installment, Card, Wallet, Goal } from '../models/index.js';
import { supabaseService, storageService, notificationService } from '../services/index.js';
import { formatCurrency, getMonthDateRange, formatMonthYear, getDaysInMonth, SpiritualMentor } from '../utils/index.js';

class DashboardController {
    constructor() {
        this.currentDate = new Date();
        this.transactions = [];
        this.charts = {
            category: null,
            daily: null
        };
        this.filter = 'all';
        this.payeeFilter = 'all';
    }

    async loadData(config = null) {
        const { start, end } = getMonthDateRange(this.currentDate);
        
        try {
            this.transactions = await supabaseService.fetchTransactions(start, end);
            const cfg = config || window.app?.config;
            if (cfg) this.render(cfg);
        } catch (error) {
            console.error('Error loading data:', error);
            notificationService.error('Erro', 'Falha ao carregar dados');
        }
    }

    async autoProcessBills(config) {
        const today = new Date();
        const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        
        let processedAny = false;
        const recordsToInsert = [];

        for (const bill of config.scheduledBills) {
            if (bill.paidMonths && bill.paidMonths.includes(yearMonth)) continue;
            
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            if (bill.startDate && new Date(bill.startDate) > monthEnd) continue;
            if (bill.endDate && new Date(bill.endDate) < new Date(today.getFullYear(), today.getMonth(), 1)) continue;

            let targetDay = bill.dueDay;
            const lastDayOfMonth = monthEnd.getDate();
            if (targetDay > lastDayOfMonth) targetDay = lastDayOfMonth;

            if (today.getDate() >= targetDay) {
                const tDate = new Date(today.getFullYear(), today.getMonth(), targetDay);
                tDate.setHours(12);

                recordsToInsert.push({
                    tipo: 'Despesa',
                    valor: bill.amount,
                    descricao: bill.name,
                    categoria: bill.category,
                    data: tDate.toISOString(),
                    forma_pagamento: bill.payMethod || 'pix',
                    status: 'Pago',
                    observacoes: JSON.stringify({
                        owner: bill.owner || 'ambos',
                        cartao_id: bill.cardId || null,
                        conta_id: bill.walletId || null
                    }),
                    referencia: 'conta_programada'
                });

                if (!bill.paidMonths) bill.paidMonths = [];
                bill.paidMonths.push(yearMonth);
                
                // Se for dívida, atualizar o saldo pago
                if (bill.name.startsWith('[Dívida] ')) {
                    const debtName = bill.name.replace('[Dívida] ', '');
                    const debt = config.debts?.find(d => d.name === debtName);
                    if (debt) {
                        debt.paid = (debt.paid || 0) + bill.amount;
                    }
                }

                processedAny = true;
            }
        }

        if (processedAny) {
            try {
                await supabaseService.insertTransaction(recordsToInsert);
                storageService.saveConfig(config);
                await supabaseService.saveConfig(config);
            } catch (e) {
                console.error('Error batch processing bills:', e);
            }
        }

        return processedAny;
    }

    navigateMonth(direction) {
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        this.loadData();
    }

    setFilter(filter) {
        this.filter = filter;
        this.renderTransactions();
    }

    setPayeeFilter(payeeId) {
        this.payeeFilter = payeeId;
        this.renderTransactions();
    }

    calculateMetrics() {
        let income = 0, expense = 0, me = 0, her = 0, fixed = 0, variable = 0;

        this.transactions.forEach(t => {
            if (t.referencia === 'transferencia') return;
            const amt = parseFloat(t.valor);
            if (t.tipo === 'Receita') {
                income += amt;
            } else {
                expense += amt;
                if (FIXED_CATEGORIES.includes(t.categoria)) fixed += amt;
                else variable += amt;
                
                if (t.owner === 'eu') me += amt;
                else if (t.owner === 'esposa') her += amt;
                else { me += amt / 2; her += amt / 2; }
            }
        });

        return { income, expense, me, her, fixed, variable };
    }

    async calculateGlobalBalance(config) {
        try {
            // Limpeza automática de dados de teste antigos (antes de Abril/2026)
            if (!localStorage.getItem('cleaned_old_data_v2')) {
                try {
                    await supabaseService.deleteTransactionsByRange(new Date('2000-01-01'), new Date('2026-03-31T23:59:59'));
                    localStorage.setItem('cleaned_old_data_v2', 'true');
                    console.log('Dados de teste antigos limpos com sucesso.');
                } catch (e) {
                    console.error('Erro na limpeza automática:', e);
                }
            }

            const allTransactions = await supabaseService.fetchAllTransactions();
            this.allTransactions = allTransactions; // Cache for other calculations
            
            let totalWalletInitial = 0;
            if (config.wallets && config.wallets.length > 0) {
                config.wallets.forEach(w => {
                    totalWalletInitial += parseFloat(w.initialBalance) || 0;
                });
            }

            let netTransactions = 0;
            allTransactions.forEach(t => {
                const amt = parseFloat(t.valor);
                if (t.tipo === 'Receita') netTransactions += amt;
                else netTransactions -= amt;
            });

            return totalWalletInitial + netTransactions;
        } catch (e) {
            console.error('Erro ao calcular saldo global:', e);
            return 0;
        }
    }

    calculateProjections(config, metrics) {
        const { income, expense } = metrics;
        const { start, end } = getMonthDateRange(this.currentDate);
        
        const activeBills = config.scheduledBills.filter(b => {
            if (b.isPaidForDate(this.currentDate)) return false;
            if (b.startDate && new Date(b.startDate) > end) return false;
            if (b.endDate && new Date(b.endDate) < start) return false;
            return true;
        });
        
        let totalCommitments = activeBills.reduce((sum, b) => sum + b.amount, 0);

        config.installments.forEach(inst => {
            totalCommitments += inst.getCurrentMonthImpact(
                this.currentDate.getFullYear(),
                this.currentDate.getMonth()
            );
        });

        const currentBalance = income - expense;
        const realProj = currentBalance - totalCommitments;
        
        const today = new Date();
        const daysInMonth = getDaysInMonth(today);
        const statProjection = expense > 0 && today.getDate() > 0 
            ? (expense / today.getDate()) * daysInMonth 
            : 0;

        return {
            currentBalance,
            realProjection: realProj,
            totalCommitments,
            statProjection
        };
    }

    async renderMetrics(config) {
        const metrics = this.calculateMetrics();
        const projections = this.calculateProjections(config, metrics);
        const globalBalance = await this.calculateGlobalBalance(config);
        
        this.updateElement('balance', formatCurrency(metrics.income - metrics.expense));
        this.updateElement('total-balance', formatCurrency(globalBalance));
        
        // Render wallet breakdown
        this.renderWalletBreakdown(config);

        this.updateElement('total-income', formatCurrency(metrics.income));
        this.updateElement('total-expense', formatCurrency(metrics.expense));
        this.updateElement('stat-projection', formatCurrency(projections.statProjection));
        this.updateElement('real-projection', formatCurrency(projections.realProjection));
        this.updateElement('projection-diff', formatCurrency(projections.totalCommitments));

        const savingRate = metrics.income > 0 
            ? Math.max(0, ((metrics.income - metrics.expense) / metrics.income) * 100) 
            : 0;
        const savingStatus = savingRate >= 30 ? '🚀' : savingRate >= 15 ? '✅' : '📉';
        this.updateElement('saving-rate', `${savingRate.toFixed(1)}% ${savingStatus}`);
        this.updateElement('saving-bar', null, { width: Math.min(savingRate, 100) + '%' });

        const fixedRatio = metrics.income > 0 ? (metrics.fixed / metrics.income) * 100 : 0;
        this.updateElement('fixed-commitment', fixedRatio.toFixed(1) + '%');
        this.updateElement('fixed-commitment-bar', null, { 
            width: Math.min(fixedRatio, 100) + '%',
            className: `fill ${fixedRatio > 50 ? 'danger' : fixedRatio > 35 ? 'warning' : ''}`
        });

        this.updateElement('fixed-val', formatCurrency(metrics.fixed));
        this.updateElement('var-val', formatCurrency(metrics.variable));
        
        const totalFV = metrics.fixed + metrics.variable;
        if (totalFV > 0) {
            this.updateElement('fixed-bar', null, { width: (metrics.fixed / totalFV * 100) + '%' });
            this.updateElement('var-bar', null, { width: (metrics.variable / totalFV * 100) + '%' });
        }

        this.updateElement('spent-me', formatCurrency(metrics.me));
        this.updateElement('spent-her', formatCurrency(metrics.her));
        const totalSpent = metrics.me + metrics.her;
        if (totalSpent > 0) {
            this.updateElement('pct-me', null, { width: (metrics.me / totalSpent * 100) + '%' });
            this.updateElement('pct-her', null, { width: (metrics.her / totalSpent * 100) + '%' });
        }

        this.renderInsights(config, metrics, projections);
    }

    async renderWalletBreakdown(config) {
        const container = document.getElementById('wallet-type-breakdown');
        if (!container) return;

        const totals = {};
        for (const wallet of config.wallets) {
            const type = wallet.type || 'conta_corrente';
            if (!totals[type]) totals[type] = 0;
            const balance = await this.calculateWalletBalance(wallet.id, wallet.initialBalance);
            totals[type] += balance;
        }

        const types = {
            'conta_corrente': { label: '💳 Contas', color: '#3b82f6' },
            'poupanca': { label: '💰 Poupança', color: '#10b981' },
            'investimento': { label: '📈 Investimentos', color: '#a855f7' },
            'dinheiro': { label: '💵 Dinheiro', color: '#f59e0b' },
            'outro': { label: '🗂️ Outros', color: '#94a3b8' }
        };

        container.innerHTML = Object.entries(totals)
            .filter(([_, val]) => Math.abs(val) > 0.01)
            .map(([type, total]) => `
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; padding: 4px 0;">
                    <span style="color: var(--text-sec);">${types[type]?.label || type}</span>
                    <span style="font-weight: 600; color: ${total >= 0 ? 'white' : 'var(--expense)'};">${formatCurrency(total)}</span>
                </div>
            `).join('');
    }

    async calculateWalletBalance(walletId, initialBalance) {
        const transactions = (this.allTransactions || []).filter(t => {
            const meta = this.parseMeta(t.observacoes);
            return meta.conta_id === walletId;
        });
        const net = transactions.reduce((sum, t) => t.tipo === 'Receita' ? sum + parseFloat(t.valor) : sum - parseFloat(t.valor), 0);
        return initialBalance + net;
    }

    renderInsights(config, metrics, projections) {
        // Main Revelation Card
        const mainText = SpiritualMentor.getMainRevelation(metrics, projections);
        const mainCard = document.getElementById('main-revelation');
        const mainTextEl = document.getElementById('prophetic-insight-text');
        
        if (mainCard && mainTextEl) {
            mainTextEl.textContent = mainText;
            mainCard.classList.remove('hidden');
        }

        // Distributed Insights
        this.renderContextInsight('balance-insight-container', SpiritualMentor.getBalanceInsight(projections.realProjection));
        this.renderContextInsight('saving-insight-container', SpiritualMentor.getSavingInsight(
             metrics.income > 0 ? ((metrics.income - metrics.expense) / metrics.income) * 100 : 0
        ));
        this.renderContextInsight('goals-insight-container', SpiritualMentor.getGoalsInsight(config.goals));
    }

    renderContextInsight(containerId, text) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const type = text.includes('Misericórdia') || text.includes('amarrado') ? 'danger' : 
                     text.includes('Vigia') || text.includes('Azeite') ? 'warning' : '';

        container.innerHTML = `
            <div class="context-insight ${type}">
                <i class="fa-solid fa-cloud-bolt-lightning"></i>
                <span>${text}</span>
            </div>
        `;
    }

    renderBudgets(config) {
        // Obter o perfil ativo no cabeçalho global
        const activeProfile = window.app?.currentProfileId || 'casal';
        
        // Selecionar o conjunto de orçamentos correto
        const budgetSet = activeProfile === 'casal' 
            ? config.budgets 
            : (config.profileBudgets[activeProfile] || config.budgets); // Fallback para casal se não tiver individual

        const totals = {};
        const breakdown = {}; // { categoria: { eu: val, esposa: val, outros: val } }

        this.transactions
            .filter(t => t.tipo === 'Despesa')
            .forEach(t => { 
                const amt = parseFloat(t.valor);
                totals[t.categoria] = (totals[t.categoria] || 0) + amt; 
                
                if (!breakdown[t.categoria]) breakdown[t.categoria] = { eu: 0, esposa: 0, outros: 0 };
                if (t.owner === 'eu') breakdown[t.categoria].eu += amt;
                else if (t.owner === 'esposa') breakdown[t.categoria].esposa += amt;
                else {
                    // Se for 'ambos', dividimos para efeito visual no breakdown ou marcamos como outros
                    breakdown[t.categoria].eu += amt / 2;
                    breakdown[t.categoria].esposa += amt / 2;
                }
            });

        const container = document.getElementById('budgets-list');
        if (!container) return;

        container.innerHTML = '';

        let totalBudget = 0;
        let totalSpent = 0;
        
        Object.keys(budgetSet).forEach(cat => {
            const limit = budgetSet[cat];
            totalBudget += limit;
            const spent = totals[cat] || 0;
            totalSpent += spent;

            if (cat === "Casa" && activeProfile === 'casal') return; // Skip if it's the big one in couple view
            
            const pct = Math.min((spent / limit) * 100, 100);
            const color = pct >= 100 ? 'danger' : pct > 75 ? 'warning' : 'safe';
            
            if (pct >= 90 && !storageService.getAlertsChecked()) {
                notificationService.warning('Orçamento em Risco', 
                    `O gasto em ${cat} está em ${pct.toFixed(0)}% do limite!`);
            }

            // Cálculo das larguras das sub-barras
            const catBreakdown = breakdown[cat] || { eu: 0, esposa: 0 };
            const mePct = spent > 0 ? (catBreakdown.eu / spent) * 100 : 0;
            const herPct = spent > 0 ? (catBreakdown.esposa / spent) * 100 : 0;

            container.innerHTML += `
                <div class="budget-item">
                    <div class="budget-info">
                        <span class="cat-name">${cat}</span>
                        <span class="val-left">${formatCurrency(spent)} / ${formatCurrency(limit)}</span>
                    </div>
                    <div class="budget-track">
                        <div class="budget-fill ${color}" style="width: ${pct}%; display: flex;">
                            <div style="height: 100%; width: ${mePct}%; background: rgba(255,255,255,0.2); border-right: 1px solid rgba(255,255,255,0.1);" title="Eu: ${formatCurrency(catBreakdown.eu)}"></div>
                            <div style="height: 100%; width: ${herPct}%; background: rgba(0,0,0,0.1);" title="Ela: ${formatCurrency(catBreakdown.esposa)}"></div>
                        </div>
                    </div>
                </div>
            `;
        });

        // Update total budget display
        const totalEl = document.getElementById('budget-total-value');
        if (totalEl) {
            totalEl.textContent = formatCurrency(totalBudget);
        }
        
        // Se estiver na visão de casal, atualizar o título para ser mais claro
        const budgetTitle = document.querySelector('.budget-section h3');
        if (budgetTitle) {
            budgetTitle.textContent = activeProfile === 'casal' ? 'Orçamento do Casal' : `Orçamento Individual (${activeProfile === 'eu' ? 'Meu' : 'Dela'})`;
        }
    }

    renderCharts() {
        this.renderCategoryChart();
        this.renderDailyChart();
    }

    renderCategoryChart() {
        const ctx = document.getElementById('category-chart');
        if (!ctx) return;

        const totals = {};
        this.transactions
            .filter(t => t.tipo === 'Despesa')
            .forEach(t => { 
                totals[t.categoria] = (totals[t.categoria] || 0) + parseFloat(t.valor); 
            });

        if (this.charts.category) this.charts.category.destroy();

        this.charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(totals),
                datasets: [{ 
                    data: Object.values(totals), 
                    backgroundColor: [
                        '#a855f7', '#3b82f6', '#10b981', '#f43f5e', '#f59e0b', 
                        '#6366f1', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4',
                        '#ec4899', '#84cc16', '#64748b', '#ef4444'
                    ], 
                    borderWidth: 0,
                    hoverOffset: 20
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { 
                    legend: { 
                        position: 'bottom', 
                        labels: { color: '#94a3b8', usePointStyle: true, padding: 20 } 
                    } 
                }, 
                cutout: '75%'
            }
        });

        // Render Mentor Insight for Categories (Dashboard)
        const insightText = SpiritualMentor.getTopCategoryInsight(totals);
        if (insightText) {
            SpiritualMentor.render('dash-category-insight', insightText);
        }
    }

    renderDailyChart() {
        const ctx = document.getElementById('daily-chart');
        if (!ctx) return;

        const daily = {};
        const daysInMonth = getDaysInMonth(this.currentDate);
        for (let i = 1; i <= daysInMonth; i++) daily[i] = 0;
        
        this.transactions
            .filter(t => t.tipo === 'Despesa')
            .forEach(t => { 
                daily[new Date(t.data).getDate()] += parseFloat(t.valor); 
            });

        if (this.charts.daily) this.charts.daily.destroy();

        this.charts.daily = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(daily),
                datasets: [{ 
                    data: Object.values(daily), 
                    borderColor: '#8b5cf6', 
                    backgroundColor: 'rgba(139, 92, 246, 0.1)', 
                    fill: true, 
                    tension: 0.4, 
                    pointRadius: 0 
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                scales: { 
                    x: { ticks: { color: '#94a3b8' } }, 
                    y: { beginAtZero: true, ticks: { color: '#94a3b8' } } 
                } 
            }
        });
    }

    renderTransactions() {
        let filtered = this.filter === 'all' 
            ? this.transactions 
            : this.transactions.filter(t => t.owner === this.filter);

        if (this.payeeFilter !== 'all') {
            filtered = filtered.filter(t => t.payee_id === this.payeeFilter);
        }

        const container = document.getElementById('transactions-list');
        const allContainer = document.getElementById('all-transactions-list');
        
        const renderList = (el) => {
            if (!el) return;
            
            if (filtered.length === 0) {
                el.innerHTML = '<div class="empty-state">Nenhuma transação encontrada para este filtro.</div>';
                return;
            }

            el.innerHTML = filtered.map(t => {
                const sign = t.tipo === 'Despesa' ? '-' : '+';
                const subTag = t.is_subscription ? '<span class="tag-sub">📺 Assinatura</span>' : '';
                const emoji = CATEGORY_EMOJIS[t.categoria] || '💰';
                const icon = CATEGORY_ICONS[t.categoria] || 'fa-wallet';
                const ownerText = t.owner === 'esposa' ? 'Ela' : t.owner === 'ambos' ? 'Ambos' : 'Eu';
                
                return `
                    <div class="transaction-item">
                        <div class="t-info">
                            <div class="t-icon"><i class="fa-solid ${icon}"></i></div>
                            <div class="t-details">
                                <h5>${emoji} ${t.categoria} ${subTag}</h5>
                                <p>${t.descricao}</p>
                            </div>
                        </div>
                        <div class="t-amount ${t.tipo === 'Despesa' ? 'expense' : 'income'}">
                            <h5>${sign} ${formatCurrency(t.valor)}</h5>
                            <div class="t-actions">
                                <button class="btn-mini-icon" onclick="window.app.editTransaction('${t.id}')">
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                                <button class="btn-mini-icon danger" onclick="window.app.deleteTransaction('${t.id}')">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                            <span>👤 ${ownerText}</span>
                        </div>
                    </div>
                `;
            }).join('');
        };

        renderList(container);
        renderList(allContainer);
    }

    renderGoals(config) {
        const container = document.getElementById('goals-list');
        if (!container) return;

        if (config.goals.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhum objetivo cadastrado.</div>';
            return;
        }

        container.innerHTML = config.goals.map(goal => {
            const pct = goal.getProgress();
            let deadlineInfo = '';
            
            if (goal.deadline) {
                const daysLeft = goal.getDaysRemaining();
                if (daysLeft > 0) {
                    deadlineInfo = `<div style="font-size:0.7rem; color:var(--text-sec); margin-top:6px;">⏳ Alvo em ${daysLeft} dias</div>`;
                } else {
                    deadlineInfo = `<div style="font-size:0.7rem; color:${pct >= 100 ? 'var(--income)' : 'var(--expense)'}; margin-top:6px;">⏱️ Prazo estourado (${Math.abs(daysLeft)} dias atrás)</div>`;
                }
            }

            return `
                <div class="goal-item">
                    <div class="goal-info">
                        <h5>${goal.name}</h5>
                        <span>${formatCurrency(goal.current)} / ${formatCurrency(goal.target)}</span>
                    </div>
                    <div class="goal-track"><div class="goal-fill" style="width: ${pct}%"></div></div>
                    ${deadlineInfo}
                </div>
            `;
        }).join('');
    }

    renderScheduledBills(config) {
        const container = document.getElementById('scheduled-bills-dashboard');
        const detailList = document.getElementById('scheduled-bills-detail-list');
        const totalEl = document.getElementById('scheduled-total');
        const paidEl = document.getElementById('scheduled-paid');

        if (!container || !detailList) return;

        const { start, end } = getMonthDateRange(this.currentDate);
        
        const bills = config.scheduledBills.filter(b => {
            if (b.isPaidForDate(this.currentDate)) return false;
            if (b.startDate && new Date(b.startDate) > end) return false;
            if (b.endDate && new Date(b.endDate) < start) return false;
            return true;
        });

        if (bills.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';

        let totalPending = 0;
        bills.forEach(b => { totalPending += b.amount; });

        totalEl.textContent = formatCurrency(totalPending);
        paidEl.textContent = formatCurrency(0);

        detailList.innerHTML = bills.map(bill => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: #f59e0b;"></div>
                    <span>${bill.name}</span>
                    <span style="font-size: 0.7rem; opacity: 0.5;">${bill.category}</span>
                </div>
                <span style="font-weight: 600; color: #f59e0b;">${formatCurrency(bill.amount)}</span>
            </div>
        `).join('');
    }

    renderCardBills(config) {
        const container = document.getElementById('card-bills-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (config.cards.length === 0) return;

        config.cards.forEach(card => {
            const spentThisMonth = this.transactions
                .filter(t => t.pay_method === 'card' && t.card_id === card.id)
                .reduce((sum, t) => sum + parseFloat(t.valor), 0);
            
            let installmentImpact = 0;
            config.installments.forEach(inst => {
                if (inst.cardId === card.id) {
                    installmentImpact += inst.getCurrentMonthImpact(
                        this.currentDate.getFullYear(),
                        this.currentDate.getMonth()
                    );
                }
            });

            const totalEstimated = spentThisMonth + installmentImpact;
            const insightId = `card-insight-${card.id}`;

            container.innerHTML += `
                <div class="stat-card glass-card" style="flex-direction: column; align-items: flex-start; min-width: 200px;">
                    <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                        <div class="icon-circle" style="background: rgba(168, 85, 247, 0.1); color: var(--accent);">
                            <i class="fa-solid fa-credit-card"></i>
                        </div>
                        <div style="flex: 1;">
                            <p style="font-size: 0.75rem; color: var(--text-sec);">${card.name}</p>
                            <h4 style="font-size: 1.1rem;">${formatCurrency(totalEstimated)}</h4>
                        </div>
                    </div>
                    <div id="${insightId}" style="margin-top: 10px; width: 100%;"></div>
                    <button onclick="window.app.reconcileCard('${card.id}', ${totalEstimated})" class="btn-text" style="font-size: 0.65rem; margin-top: 8px; align-self: flex-end;">Pagar & Conciliar</button>
                </div>
            `;

            // Render Mentor Insight for this Card
            setTimeout(() => {
                const insightText = SpiritualMentor.getCardUsageInsight(totalEstimated, card.limit);
                if (insightText) {
                    SpiritualMentor.render(insightId, insightText);
                }
            }, 0);
        });
    }

    renderGamificationBadge(config) {
        const badgeEl = document.getElementById('user-badge');
        if (!badgeEl) return;
        
        const completedGoals = config.goals.filter(g => g.getProgress() >= 100).length;
        const savingText = document.getElementById('saving-rate')?.textContent || '0%';
        const savingRateVal = parseFloat(savingText) || 0;
        
        let text = "Iniciante 🌱";
        let color = "rgba(148, 163, 184, 0.2)"; 
        let textColor = "#94a3b8"; 
        
        if (completedGoals >= 3 || savingRateVal >= 40) {
            text = "Mestre Supremo 👑"; 
            color = "rgba(234, 179, 8, 0.2)"; 
            textColor = "#eab308";
        } else if (completedGoals >= 1 || savingRateVal >= 20) {
            text = "Estrategista 🎯";
            color = "rgba(168, 85, 247, 0.2)"; 
            textColor = "#a855f7"; 
        } else if (savingRateVal >= 5) {
            text = "Poupador 📈";
            color = "rgba(59, 130, 246, 0.2)"; 
            textColor = "#3b82f6";
        }
        
        badgeEl.textContent = text;
        badgeEl.style.backgroundColor = color;
        badgeEl.style.color = textColor;
        badgeEl.style.border = `1px solid ${textColor}`;
    }

    render(config) {
        if (!config) {
            console.warn('DashboardController.render() called without config');
            return;
        }

        this.updateElement('current-month-display', formatMonthYear(this.currentDate));
        this.renderMetrics(config);
        this.renderBudgets(config);
        this.renderCharts();
        this.renderTransactions();
        this.renderGoals(config);
        this.renderScheduledBills(config);
        this.renderCardBills(config);
        this.renderGamificationBadge(config);
        this.renderPayeeFilter(config);
    }

    renderPayeeFilter(config) {
        const select = document.getElementById('dash-payee-filter');
        if (!select) return;

        const currentVal = select.value;
        select.innerHTML = '<option value="all">Filtrar por Favorecido...</option>';
        
        config.payees.forEach(p => {
            select.innerHTML += `<option value="${p.id}" ${currentVal === p.id ? 'selected' : ''}>${p.name}</option>`;
        });
    }

    updateElement(id, value = null, attrs = {}) {
        const el = document.getElementById(id);
        if (!el) return;
        
        if (value !== null) el.textContent = value;
        
        Object.keys(attrs).forEach(key => {
            if (key === 'className') {
                el.className = attrs[key];
            } else {
                el.style[key] = attrs[key];
            }
        });
    }
}

export default DashboardController;
