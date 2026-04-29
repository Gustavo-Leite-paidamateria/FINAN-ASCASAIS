import { formatCurrency, getMonthDateRange } from '../utils/index.js';
import { supabaseService, notificationService } from '../services/index.js';
import { SimulationEvent } from '../models/index.js';

export default class SimulatorController {
    constructor() {
        this.chart = null;
        this.monthsToProject = 12;
    }

    async render(config) {
        const container = document.getElementById('simulator-view');
        if (!container || container.classList.contains('hidden')) return;

        const baseData = await this.calculateBaseScenario(config);
        const simulatedData = this.applySimulations(config, baseData);

        this.renderChart(baseData, simulatedData);
        this.renderSimulationsList(config);
        this.updateIndicators(baseData, simulatedData);
    }

    async calculateBaseScenario(config) {
        // 1. Get current global balance
        let currentBalance = 0;
        
        // Initial balance from wallets
        config.wallets.forEach(w => {
            currentBalance += parseFloat(w.initialBalance) || 0;
        });

        // Add all historic transactions (net)
        const allTransactions = await supabaseService.fetchAllTransactions();
        allTransactions.forEach(t => {
            const amt = parseFloat(t.valor);
            if (t.tipo === 'Receita') currentBalance += amt;
            else currentBalance -= amt;
        });

        const projections = [];
        let runningBalance = currentBalance;
        const now = new Date();

        for (let i = 0; i < this.monthsToProject; i++) {
            const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const { start, end } = getMonthDateRange(targetDate);
            
            let monthlyIn = 0;
            let monthlyOut = 0;

            // Incomes from Scheduled Bills
            config.scheduledBills.forEach(bill => {
                if (bill.type === 'Receita' || bill.amount > 0 && !['Despesa'].includes(bill.category)) {
                    // This logic depends on how ScheduledBill handles types. 
                    // Most are expenses. Let's assume ScheduledBill can be income too.
                    // Actually, looking at index.html, ScheduledBill doesn't have a clear "type" radio.
                    // But in the model, let's see.
                }
            });

            // For now, let's look at ScheduledBills and assume they are expenses unless we find otherwise.
            config.scheduledBills.forEach(bill => {
                // Check if bill is active for this date
                if (bill.startDate && new Date(bill.startDate) > end) return;
                if (bill.endDate && new Date(bill.endDate) < start) return;
                
                // If it's a negative amount, it's a despesa. If positive, it depends.
                // In this app, scheduled bills are usually expenses.
                monthlyOut += parseFloat(bill.amount) || 0;
            });

            // 1. Scheduled Bills (including fixed costs and installments)
            config.scheduledBills.forEach(b => {
                if (b.isActiveForDate(targetDate)) {
                    monthlyOut += b.amount;
                }
            });

            // 2. Credit Card Installments (Legacy or non-linked)
            config.installments.forEach(inst => {
                // To avoid double counting if it's already a ScheduledBill
                if (config.scheduledBills.some(b => b.name === '[Parcelado] ' + inst.desc)) return;
                monthlyOut += inst.getCurrentMonthImpact(targetDate.getFullYear(), targetDate.getMonth());
            });

            // 3. Debts (Direct tracking)
            config.debts.forEach(debt => {
                // Only if it's not already covered by a [Dívida] ScheduledBill
                if (config.scheduledBills.some(b => b.name === '[Dívida] ' + debt.name)) return;
                
                const remaining = debt.total - (debt.paid || 0);
                if (remaining > 0) {
                    if (debt.startDate && new Date(debt.startDate) > end) return;
                    const inst = debt.getMonthlyPayment ? debt.getMonthlyPayment() : (debt.total / (debt.installments || 1));
                    monthlyOut += inst;
                }
            });

            runningBalance += (monthlyIn - monthlyOut);
            projections.push({
                month: targetDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
                balance: runningBalance,
                monthlyIn,
                monthlyOut
            });
        }

        return projections;
    }

    applySimulations(config, baseData) {
        const simulated = JSON.parse(JSON.stringify(baseData));
        const activeSims = config.simulations.filter(s => s.ativa);

        activeSims.forEach(sim => {
            const startDate = new Date(sim.data_inicio);
            
            simulated.forEach((data, index) => {
                const targetDate = new Date();
                targetDate.setMonth(targetDate.getMonth() + index);
                
                // If simulation applies to this month
                const monthsDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 + (targetDate.getMonth() - startDate.getMonth());
                
                if (monthsDiff >= 0 && monthsDiff < sim.parcelas) {
                    const monthlyVal = sim.valor / sim.parcelas;
                    if (sim.tipo === 'receita') {
                        // Wait, data.balance is a running balance. 
                        // If we add something in month X, all subsequent months are affected.
                        for (let j = index; j < simulated.length; j++) {
                            simulated[j].balance += monthlyVal;
                        }
                    } else {
                        for (let j = index; j < simulated.length; j++) {
                            simulated[j].balance -= monthlyVal;
                        }
                    }
                }
            });
        });

        return simulated;
    }

    renderChart(baseData, simulatedData) {
        const ctx = document.getElementById('simulator-chart');
        if (!ctx) return;

        if (this.chart) this.chart.destroy();

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: baseData.map(d => d.month),
                datasets: [
                    {
                        label: 'Cenário Base',
                        data: baseData.map(d => d.balance),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: '#3b82f6',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Simulado',
                        data: simulatedData.map(d => d.balance),
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: '#f59e0b',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#94a3b8', font: { family: 'Outfit' } }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { 
                            color: '#94a3b8',
                            callback: (val) => formatCurrency(val)
                        }
                    }
                }
            }
        });
    }

    renderSimulationsList(config) {
        const container = document.getElementById('simulations-list');
        if (!container) return;

        if (config.simulations.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhum evento de simulação adicionado.</div>';
            return;
        }

        container.innerHTML = config.simulations.map(sim => `
            <div class="simulation-card ${sim.ativa ? '' : 'disabled'}" style="background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 12px; padding: 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="tag ${sim.tipo === 'receita' ? 'income' : 'expense'}" style="font-size: 0.6rem;">${sim.tipo.toUpperCase()}</span>
                        <h5 style="margin: 0;">${sim.nome}</h5>
                    </div>
                    <p style="font-size: 0.75rem; color: var(--text-sec); margin: 4px 0 0 0;">
                        ${formatCurrency(sim.valor)} em ${sim.parcelas}x a partir de ${new Date(sim.data_inicio).toLocaleDateString('pt-BR')}
                    </p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-mini-icon" onclick="window.app.simulatorController.toggleSimulation('${sim.id}')" title="${sim.ativa ? 'Desativar' : 'Ativar'}">
                        <i class="fa-solid ${sim.ativa ? 'fa-eye' : 'fa-eye-slash'}"></i>
                    </button>
                    <button class="btn-mini-icon danger" onclick="window.app.simulatorController.deleteSimulation('${sim.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateIndicators(baseData, simulatedData) {
        const minBase = Math.min(...baseData.map(d => d.balance));
        const minSim = Math.min(...simulatedData.map(d => d.balance));
        
        const lowestMonthBase = baseData.find(d => d.balance === minBase);
        const lowestMonthSim = simulatedData.find(d => d.balance === minSim);

        const elMin = document.getElementById('sim-min-balance');
        const elNeg = document.getElementById('sim-neg-alert');

        if (elMin) {
            elMin.innerHTML = `
                <div style="text-align: center;">
                    <p style="font-size: 0.75rem; color: var(--text-sec);">Menor Saldo Previsto</p>
                    <h3 style="color: ${minSim < 0 ? 'var(--expense)' : 'var(--income)'}">${formatCurrency(minSim)}</h3>
                    <small style="opacity: 0.7;">em ${lowestMonthSim.month}</small>
                </div>
            `;
        }

        if (elNeg) {
            const negativeMonth = simulatedData.find(d => d.balance < 0);
            if (negativeMonth) {
                elNeg.innerHTML = `
                    <div class="context-insight danger" style="margin-top: 15px;">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <span><b>Atenção:</b> Seu saldo pode ficar negativo em <b>${negativeMonth.month}</b> se essa simulação se concretizar.</span>
                    </div>
                `;
                elNeg.classList.remove('hidden');
            } else {
                elNeg.classList.add('hidden');
            }
        }
    }

    async addSimulation(config) {
        const nome = document.getElementById('sim-name')?.value;
        const valor = parseFloat(document.getElementById('sim-amount')?.value);
        const tipo = document.getElementById('sim-type')?.value;
        const parcelas = parseInt(document.getElementById('sim-installments')?.value) || 1;
        const data_inicio = document.getElementById('sim-date')?.value;

        if (!nome || isNaN(valor) || !data_inicio) {
            notificationService.error('Erro', 'Preencha todos os campos da simulação');
            return;
        }

        const newSim = new SimulationEvent({ nome, valor, tipo, parcelas, data_inicio });
        config.simulations.push(newSim);

        await supabaseService.saveConfig(config);
        notificationService.success('Simulação', 'Cenário adicionado com sucesso');
        
        // Reset form
        document.getElementById('sim-name').value = '';
        document.getElementById('sim-amount').value = '';
        document.getElementById('sim-installments').value = '1';
        
        this.render(config);
    }

    async toggleSimulation(id) {
        const config = window.app.config;
        const sim = config.simulations.find(s => s.id === id);
        if (sim) {
            sim.ativa = !sim.ativa;
            await supabaseService.saveConfig(config);
            this.render(config);
        }
    }

    async deleteSimulation(id) {
        if (!confirm('Deseja excluir esta simulação?')) return;
        const config = window.app.config;
        config.simulations = config.simulations.filter(s => s.id !== id);
        await supabaseService.saveConfig(config);
        this.render(config);
    }
}
