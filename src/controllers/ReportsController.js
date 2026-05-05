import { Transaction, CATEGORIES, CATEGORY_ICONS, FIXED_CATEGORIES } from '../models/index.js';
import { supabaseService, notificationService } from '../services/index.js';
import { formatCurrency, getMonthDateRange, formatMonthYear, SpiritualMentor } from '../utils/index.js';

class ReportsController {
    constructor() {
        this.charts = {
            compare: null,
            category: null,
            evolution: null
        };
        this.currentPeriod = { start: null, end: null };
    }

    init() {
        try {
            const startObj = document.getElementById('report-start-date');
            const endObj = document.getElementById('report-end-date');
            
            if (!startObj.value && startObj) {
                const d = new Date();
                startObj.value = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
                if (endObj) endObj.value = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
            }
            
            this.renderProfileSelectors();
            this.setupListeners();
            this.generateReport();
        } catch (e) {
            console.error('Reports init error:', e);
        }
    }

    setupListeners() {
        try {
            const generateBtn = document.getElementById('generate-report-btn');
            if (generateBtn) {
                generateBtn.addEventListener('click', () => this.generateReport());
            }

            const startObj = document.getElementById('report-start-date');
            const endObj = document.getElementById('report-end-date');
            const profileObj = document.getElementById('report-profile-filter');
            
            if (startObj) startObj.addEventListener('change', () => this.generateReport());
            if (endObj) endObj.addEventListener('change', () => this.generateReport());
            if (profileObj) profileObj.addEventListener('change', () => this.generateReport());
        } catch (e) {
            console.error('Setup listeners error:', e);
        }
    }

    applyQuickFilter(filter) {
        try {
            const startObj = document.getElementById('report-start-date');
            const endObj = document.getElementById('report-end-date');
            const d = new Date();

            if (!startObj || !endObj) return;

            switch(filter) {
                case 'month':
                    startObj.value = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
                    endObj.value = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
                    break;
                case 'lastMonth':
                    startObj.value = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0];
                    endObj.value = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0];
                    break;
                case 'year':
                    startObj.value = new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0];
                    endObj.value = new Date(d.getFullYear(), 11, 31).toISOString().split('T')[0];
                    break;
                case 'quarter':
                    const quarterStart = Math.floor(d.getMonth() / 3) * 3;
                    startObj.value = new Date(d.getFullYear(), quarterStart, 1).toISOString().split('T')[0];
                    endObj.value = new Date(d.getFullYear(), quarterStart + 3, 0).toISOString().split('T')[0];
                    break;
            }
            
            document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));
            document.querySelector(`.quick-filter-btn[data-filter="${filter}"]`)?.classList.add('active');
            
            this.generateReport();
        } catch (e) {
            console.error('Error applying filter:', e);
        }
    }

    async generateReport() {
        try {
            const sDate = document.getElementById('report-start-date')?.value;
            const eDate = document.getElementById('report-end-date')?.value;
            
            console.log('Generating report:', sDate, eDate);
            
            if (!sDate || !eDate) {
                console.log('No dates selected');
                return;
            }

            const start = new Date(sDate);
            const end = new Date(eDate + "T23:59:59");
            const profile = document.getElementById('report-profile-filter')?.value || 'all';
            
            this.currentPeriod = { start, end, profile };

            const transactions = await supabaseService.fetchAllTransactions(start, end);
            console.log('Transactions found:', transactions?.length || 0);
            
            this.renderAll(transactions || [], profile);
        } catch (err) {
            console.error('Error generating report:', err);
            notificationService.error('Erro', 'Falha ao buscar dados');
        }
    }

    async renderAll(transactions, profile = 'all') {
        const summary = this.calculateSummary(transactions, profile);
        
        this.renderSummary(summary);
        this.renderCompareChart(summary);
        this.renderCategoryChart(transactions);
        await this.renderEvolutionChart();
        this.renderPayeeReport(summary.byPayee);
        this.renderTransactionsList(transactions);
    }

    calculateSummary(transactions, profile = 'all') {
        let income = 0, expense = 0;
        let me = 0, her = 0;
        let fixed = 0, variable = 0;
        const byCategory = {};
        const byMonth = {};
        const byPayee = {};

        transactions.forEach(t => {
            if (t.referencia === 'transferencia') return; // Pular transferências internas no relatório

            const meta = this.parseMeta(t.observacoes);
            const owner = meta.owner || t.owner || 'ambos';

            // Filtragem por perfil
            if (profile !== 'all' && owner !== 'ambos' && owner !== profile) {
                return;
            }

            const v = parseFloat(t.valor);
            
            if (t.tipo === 'Receita') {
                income += v;
            } else {
                expense += v;
                
                if (FIXED_CATEGORIES.includes(t.categoria)) fixed += v;
                else variable += v;
                
                if (owner === 'eu') me += v;
                else if (owner === 'esposa') her += v;
                else { me += v / 2; her += v / 2; }
            }

            if (!byCategory[t.categoria]) byCategory[t.categoria] = { income: 0, expense: 0 };
            if (t.tipo === 'Receita') byCategory[t.categoria].income += v;
            else byCategory[t.categoria].expense += v;

            const monthKey = t.data ? t.data.substring(0, 7) : 'unknown';
            if (!byMonth[monthKey]) byMonth[monthKey] = { income: 0, expense: 0 };
            if (t.tipo === 'Receita') byMonth[monthKey].income += v;
            else byMonth[monthKey].expense += v;

            if (t.payee_id) {
                if (!byPayee[t.payee_id]) byPayee[t.payee_id] = 0;
                if (t.tipo === 'Despesa') byPayee[t.payee_id] += v;
            }
        });

        return { income, expense, fixed, variable, me, her, byCategory, byMonth, byPayee };
    }

    parseMeta(observacoes) {
        if (!observacoes) return {};
        if (typeof observacoes === 'string' && observacoes.startsWith('{')) {
            try { return JSON.parse(observacoes); } catch(e) {}
        }
        return typeof observacoes === 'object' ? observacoes : {};
    }

    renderSummary(summary) {
        try {
            const { income, expense, fixed, variable, me, her } = summary;
            const balance = income - expense;
            
            console.log('Summary:', { income, expense, fixed, balance });

            this.updateElement('report-total-in', formatCurrency(income));
            this.updateElement('report-total-out', formatCurrency(expense));
            
            const balanceEl = document.getElementById('report-balance-period');
            if (balanceEl) {
                balanceEl.textContent = formatCurrency(balance);
                balanceEl.style.color = balance >= 0 ? 'var(--income)' : 'var(--expense)';
            }

            this.updateElement('report-fixed', formatCurrency(fixed));
            this.updateElement('report-variable', formatCurrency(variable));
            this.updateElement('report-spent-me', formatCurrency(me));
            this.updateElement('report-spent-her', formatCurrency(her));
            
            const savingRate = income > 0 ? ((income - expense) / income * 100) : 0;
            this.updateElement('report-saving-rate', savingRate.toFixed(1) + '%');
            
            const fixedPct = income > 0 ? (fixed / income * 100) : 0;
            this.updateElement('report-fixed-pct', fixedPct.toFixed(1) + '%');

            SpiritualMentor.render('reports-insight-container', SpiritualMentor.getReportInsight(summary));
        } catch (e) {
            console.error('renderSummary error:', e);
        }
    }

    renderCompareChart(summary) {
        try {
            const ctx = document.getElementById('report-compare-chart');
            console.log('Chart canvas:', ctx);
            
            if (!ctx) return;
            
            if (this.charts.compare) this.charts.compare.destroy();

            this.charts.compare = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Receitas', 'Despesas', 'Fixo', 'Variável'],
                    datasets: [{ 
                        data: [summary.income, summary.expense, summary.fixed, summary.variable], 
                        backgroundColor: [
                            'rgba(16, 185, 129, 0.8)',
                            'rgba(244, 63, 94, 0.8)',
                            'rgba(251, 191, 36, 0.8)',
                            'rgba(59, 130, 246, 0.8)'
                        ], 
                        borderRadius: 6
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { 
                        y: { beginAtZero: true, ticks: { color: '#94a3b8' } }, 
                        x: { ticks: { color: '#94a3b8' } } 
                    }
                }
            });
            console.log('Chart created');
        } catch (e) {
            console.error('renderCompareChart error:', e);
        }
    }

    renderCategoryChart(transactions) {
        const ctx = document.getElementById('report-category-chart');
        if (!ctx) return;
        
        if (this.charts.category) this.charts.category.destroy();

        const categoryData = {};
        transactions.forEach(t => {
            if (t.tipo === 'Despesa') {
                const v = parseFloat(t.valor);
                if (!categoryData[t.categoria]) categoryData[t.categoria] = 0;
                categoryData[t.categoria] += v;
            }
        });

        const sorted = Object.entries(categoryData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        const colors = [
            '#f43f5e', '#3b82f6', '#10b981', '#f59e0b', 
            '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
        ];

        this.charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sorted.map(s => s[0]),
                datasets: [{
                    data: sorted.map(s => s[1]),
                    backgroundColor: colors.slice(0, sorted.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#94a3b8', padding: 12, font: { size: 11 } }
                    }
                }
            }
        });

        const listContainer = document.getElementById('category-breakdown-list');
        if (listContainer) {
            const total = sorted.reduce((sum, s) => sum + s[1], 0);
            listContainer.innerHTML = sorted.map((cat, i) => {
                const val = cat[1];
                const pct = total > 0 ? (val / total * 100) : 0;
                const icon = CATEGORY_ICONS[cat[0]] || 'fa-wallet';
                return `
                    <div class="cat-row">
                        <div class="cat-icon"><i class="fa-solid ${icon}"></i></div>
                        <div class="cat-name">${cat[0]}</div>
                        <div class="cat-val">${formatCurrency(val)}</div>
                        <div class="cat-pct">${pct.toFixed(1)}%</div>
                    </div>
                `;
            }).join('');

            // Render Mentor Insight for Categories
            const insightText = SpiritualMentor.getTopCategoryInsight(categoryData);
            if (insightText) {
                SpiritualMentor.render('category-insight-container', insightText);
            }
        }
    }

    renderPayeeReport(byPayee) {
        const container = document.getElementById('payee-report-list');
        if (!container) return;

        const config = window.app.config;
        const sorted = Object.entries(byPayee || {})
            .sort((a, b) => b[1] - a[1]);

        if (sorted.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhuma transação com favorecido no período.</div>';
            return;
        }

        const max = sorted[0][1];

        container.innerHTML = sorted.map(([payeeId, total]) => {
            const payee = config.payees.find(p => p.id === payeeId);
            const name = payee ? payee.name : 'Desconhecido';
            const pct = (total / max) * 100;

            return `
                <div class="config-item" style="flex-direction: column; align-items: stretch; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div class="config-info">
                            <strong>${name}</strong>
                            <span class="subtitle">${payee?.defaultCategory || ''}</span>
                        </div>
                        <strong style="color: var(--expense);">${formatCurrency(total)}</strong>
                    </div>
                    <div class="mini-bar" style="height: 4px; background: rgba(255,255,255,0.05);">
                        <div class="fill" style="width: ${pct}%; background: var(--expense); height: 100%;"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async renderEvolutionChart() {
        const ctx = document.getElementById('report-evolution-chart');
        if (!ctx) return;
        
        if (this.charts.evolution) this.charts.evolution.destroy();

        try {
            const start = new Date(this.currentPeriod.start.getFullYear(), 0, 1);
            const end = new Date(this.currentPeriod.end.getFullYear(), 11, 31);
            const transactions = await supabaseService.fetchAllTransactions(start, end);

            const monthlyData = {};
            transactions.forEach(t => {
                const monthKey = t.data ? t.data.substring(0, 7) : 'unknown';
                if (!monthlyData[monthKey]) monthlyData[monthKey] = { income: 0, expense: 0 };
                if (t.tipo === 'Receita') monthlyData[monthKey].income += parseFloat(t.valor);
                else monthlyData[monthKey].expense += parseFloat(t.valor);
            });

            const sortedMonths = Object.keys(monthlyData).sort();
            const incomeData = sortedMonths.map(m => monthlyData[m].income);
            const expenseData = sortedMonths.map(m => monthlyData[m].expense);

            this.charts.evolution = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: sortedMonths,
                    datasets: [
                        {
                            label: 'Receitas',
                            data: incomeData,
                            borderColor: 'rgba(16, 185, 129, 1)',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Despesas',
                            data: expenseData,
                            borderColor: 'rgba(244, 63, 94, 1)',
                            backgroundColor: 'rgba(244, 63, 94, 0.1)',
                            fill: true,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#94a3b8' } }
                    },
                    scales: {
                        y: { beginAtZero: true, ticks: { color: '#94a3b8' } },
                        x: { ticks: { color: '#94a3b8' } }
                    }
                }
            });

            // Render Mentor Insight for Evolution
            const insightText = SpiritualMentor.getEvolutionInsight(sortedMonths, incomeData, expenseData);
            if (insightText) {
                SpiritualMentor.render('evolution-insight-container', insightText);
            }
        } catch (e) {
            console.error('Evolution chart error:', e);
        }
    }

    renderTransactionsList(transactions) {
        const profile = this.currentPeriod.profile || 'all';
        const filtered = transactions.filter(t => {
            if (t.referencia === 'transferencia') return false;
            if (profile === 'all') return true;
            const meta = this.parseMeta(t.observacoes);
            const owner = meta.owner || t.owner || 'ambos';
            return owner === 'ambos' || owner === profile;
        });

        const container = document.getElementById('report-transactions-list');
        if (!container) return;

        const sorted = [...filtered].sort((a, b) => new Date(b.data) - new Date(a.data));
        
        if (sorted.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhuma transação no período.</div>';
            return;
        }

        container.innerHTML = sorted.slice(0, 50).map(t => {
            const meta = this.parseMeta(t.observacoes);
            const owner = meta.owner || t.owner || 'ambos';
            const ownerLabel = owner === 'eu' ? '👨' : owner === 'esposa' ? '👩' : '👫';
            const isExpense = t.tipo === 'Despesa';
            
            return `
                <div class="trans-row" style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom:1px solid var(--glass-border);">
                    <div style="display:flex; align-items:center; gap: 10px;">
                        <span style="font-size: 0.75rem; color: var(--text-sec);">${t.data ? new Date(t.data).toLocaleDateString('pt-BR') : ''}</span>
                        <span>${t.descricao || t.categoria}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap: 10px;">
                        <span style="font-size: 0.75rem;">${ownerLabel}</span>
                        <span style="color: ${isExpense ? 'var(--expense)' : 'var(--income)'};">
                            ${isExpense ? '-' : '+'}${formatCurrency(t.valor)}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }

    async exportCsv() {
        const sDate = document.getElementById('report-start-date')?.value;
        const eDate = document.getElementById('report-end-date')?.value;
        
        try {
            let start = null, end = null;
            if (sDate && eDate) {
                start = new Date(sDate).toISOString();
                end = new Date(eDate + "T23:59:59").toISOString();
            }
            
            const data = await supabaseService.fetchTransactionsRaw(start, end);
            
            if (!data || data.length === 0) {
                alert("Nenhum dado para exportar nesse período.");
                return;
            }
            
            const header = ["Data", "Descrição", "Categoria", "Valor", "Tipo", "Dono", "Forma"];
            const csvRows = [header.join(",")];
            
            data.forEach(t => {
                let meta = { owner: t.observacoes };
                if (t.observacoes && t.observacoes.startsWith('{')) {
                    try { meta = JSON.parse(t.observacoes); } catch(e) {}
                }
                
                csvRows.push([
                    t.data ? t.data.split('T')[0] : '',
                    `"${(t.descricao || '').replace(/"/g, '""')}"`,
                    t.categoria || '',
                    (t.valor || 0).toString().replace('.', ','),
                    t.tipo || '',
                    meta.owner || 'ambos',
                    t.forma_pagamento || ''
                ].join(","));
            });
            
            const blob = new Blob([csvRows.join('\n')], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Financas_${sDate}_${eDate}.csv`;
            a.click();
            
            notificationService.success('Sucesso', 'Exportação concluída!');
        } catch (e) {
            console.error("Export error", e);
            notificationService.error('Erro', 'Falha ao exportar');
        }
    }

    async exportExcel() {
        if (typeof XLSX === 'undefined') {
            notificationService.error('Erro', 'Biblioteca Excel não carregada. Recarregue a página.');
            return;
        }

        const sDate = document.getElementById('report-start-date')?.value;
        const eDate = document.getElementById('report-end-date')?.value;

        try {
            let start = null, end = null;
            if (sDate && eDate) {
                start = new Date(sDate).toISOString();
                end = new Date(eDate + 'T23:59:59').toISOString();
            }

            const data = await supabaseService.fetchTransactionsRaw(start, end);
            if (!data || data.length === 0) {
                notificationService.warning('Aviso', 'Nenhum dado para exportar nesse período.');
                return;
            }

            const rows = data.map(t => {
                let meta = { owner: t.observacoes };
                if (t.observacoes && t.observacoes.startsWith('{')) {
                    try { meta = JSON.parse(t.observacoes); } catch (e) {}
                }
                return {
                    Data: t.data ? t.data.split('T')[0] : '',
                    Descrição: t.descricao || '',
                    Categoria: t.categoria || '',
                    Valor: parseFloat(t.valor) || 0,
                    Tipo: t.tipo || '',
                    Dono: meta.owner || 'ambos',
                    Forma: t.forma_pagamento || ''
                };
            });

            const wb = XLSX.utils.book_new();

            // Aba 1: Transações
            const wsT = XLSX.utils.json_to_sheet(rows);
            const rangeT = XLSX.utils.decode_range(wsT['!ref']);
            for (let R = 1; R <= rangeT.e.r; R++) {
                const valCell = wsT[XLSX.utils.encode_cell({ r: R, c: 3 })];
                if (valCell) valCell.z = '#,##0.00';
            }
            wsT['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
            XLSX.utils.book_append_sheet(wb, wsT, 'Transações');

            // Aba 2: Por Categoria
            const catMap = {};
            rows.forEach(r => {
                if (!catMap[r.Categoria]) catMap[r.Categoria] = { Receitas: 0, Despesas: 0 };
                if (r.Tipo === 'Receita') catMap[r.Categoria].Receitas += r.Valor;
                else catMap[r.Categoria].Despesas += r.Valor;
            });
            const catRows = Object.entries(catMap)
                .map(([cat, v]) => ({ Categoria: cat, Receitas: v.Receitas, Despesas: v.Despesas, Saldo: v.Receitas - v.Despesas }))
                .sort((a, b) => b.Despesas - a.Despesas);
            const wsCat = XLSX.utils.json_to_sheet(catRows);
            wsCat['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
            XLSX.utils.book_append_sheet(wb, wsCat, 'Por Categoria');

            // Aba 3: Resumo
            const totalReceita = rows.filter(r => r.Tipo === 'Receita').reduce((a, r) => a + r.Valor, 0);
            const totalDespesa = rows.filter(r => r.Tipo === 'Despesa').reduce((a, r) => a + r.Valor, 0);
            const wsRes = XLSX.utils.json_to_sheet([
                { Item: 'Período', Valor: `${sDate || 'início'} a ${eDate || 'hoje'}` },
                { Item: 'Total de Lançamentos', Valor: rows.length },
                { Item: 'Total de Receitas', Valor: totalReceita },
                { Item: 'Total de Despesas', Valor: totalDespesa },
                { Item: 'Saldo do Período', Valor: totalReceita - totalDespesa }
            ]);
            wsRes['!cols'] = [{ wch: 22 }, { wch: 20 }];
            XLSX.utils.book_append_sheet(wb, wsRes, 'Resumo');

            XLSX.writeFile(wb, `Financas_${sDate || 'completo'}_${eDate || 'hoje'}.xlsx`);
            notificationService.success('Sucesso', 'Excel exportado com sucesso!');
        } catch (e) {
            console.error('Export Excel error', e);
            notificationService.error('Erro', 'Falha ao exportar Excel');
        }
    }

    updateElement(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    renderProfileSelectors() {
        const select = document.getElementById('report-profile-filter');
        if (!select) return;

        const config = window.app.config;
        const currentVal = select.value;

        let options = `
            <option value="all" ${currentVal === 'all' ? 'selected' : ''}>👫 Casal</option>
            <option value="eu" ${currentVal === 'eu' ? 'selected' : ''}>👤 Eu</option>
            <option value="esposa" ${currentVal === 'esposa' ? 'selected' : ''}>👩 Ela</option>
        `;

        (config.managedProfiles || []).forEach(p => {
            options += `<option value="${p.id}" ${currentVal === p.id ? 'selected' : ''}>👤 ${p.name}</option>`;
        });

        select.innerHTML = options;
    }
}

export default ReportsController;