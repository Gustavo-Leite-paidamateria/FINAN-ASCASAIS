import { Transaction, ScheduledBill, Debt, Goal } from '../models/index.js';
import { supabaseService, storageService } from '../services/index.js';
import { formatCurrency } from './index.js';

export class SetupWizard {
    static async execute(data, config) {
        const created = { transactions: 0, bills: 0, debts: 0, goals: 0 };
        const today = new Date();
        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0);

        if (data.partnerName) {
            config.userData.partner_name = data.partnerName;
        }

        const owner = data.mode === 'solo' ? 'eu' : null;

        if (data.yourIncome > 0) {
            const t = new Transaction({
                tipo: 'Receita', valor: data.yourIncome,
                descricao: 'Salário', categoria: 'Outros',
                data: firstOfMonth.toISOString(),
                forma_pagamento: 'pix', owner: 'eu'
            });
            await supabaseService.insertTransaction(t);
            created.transactions++;
        }

        if (data.partnerIncome > 0 && data.mode === 'shared') {
            const t = new Transaction({
                tipo: 'Receita', valor: data.partnerIncome,
                descricao: 'Salário', categoria: 'Outros',
                data: firstOfMonth.toISOString(),
                forma_pagamento: 'pix', owner: 'esposa'
            });
            await supabaseService.insertTransaction(t);
            created.transactions++;
        }

        const bills = [];
        if (data.rent > 0) {
            bills.push({ name: 'Aluguel', amount: data.rent, category: 'Casa', dueDay: 5, owner: owner || 'ambos' });
        }
        if (data.condoFee > 0) {
            bills.push({ name: 'Condomínio', amount: data.condoFee, category: 'Casa', dueDay: 10, owner: owner || 'ambos' });
        }
        if (data.water > 0) {
            bills.push({ name: 'Água', amount: data.water, category: 'Casa', dueDay: 15, owner: owner || 'ambos' });
        }
        if (data.electricity > 0) {
            bills.push({ name: 'Luz', amount: data.electricity, category: 'Casa', dueDay: 20, owner: owner || 'ambos' });
        }
        if (data.internet > 0) {
            bills.push({ name: 'Internet', amount: data.internet, category: 'Casa', dueDay: 10, owner: owner || 'ambos' });
        }

        (data.subscriptions || []).forEach(sub => {
            if (sub.name && sub.amount > 0) {
                bills.push({
                    name: sub.name, amount: sub.amount,
                    category: 'Assinaturas', dueDay: sub.dueDay || 15,
                    owner: sub.owner || owner || 'ambos'
                });
            }
        });

        bills.forEach(b => {
            const bill = new ScheduledBill({
                name: b.name, amount: b.amount, category: b.category,
                dueDay: b.dueDay, isMonthly: true, owner: b.owner || 'ambos'
            });
            config.scheduledBills.push(bill);
            created.bills++;
        });

        (data.debts || []).forEach(d => {
            if (d.name && d.total > 0) {
                const debt = new Debt({
                    name: d.name, type: d.type || 'Outros',
                    total: d.total, paid: d.paid || 0,
                    installments: d.installments || 1,
                    dueDay: d.dueDay || 5,
                    startDate: firstOfMonth.toISOString(),
                    creditor: d.creditor || ''
                });
                config.debts.push(debt);
                created.debts++;
            }
        });

        if (data.goalName && data.goalTarget > 0) {
            const goal = new Goal({
                name: data.goalName, target: data.goalTarget,
                current: data.goalCurrent || 0,
                deadline: data.goalDeadline || null
            });
            config.goals.push(goal);
            created.goals++;
        }

        const suggestedBudgets = this.suggestBudgets(data);
        Object.assign(config.budgets, suggestedBudgets);

        storageService.saveConfig(config);
        await supabaseService.saveConfig(config);

        return created;
    }

    static suggestBudgets(data) {
        const totalIncome = (data.yourIncome || 0) + (data.partnerIncome || 0);
        const budgets = {
            'Mercado': Math.round(totalIncome * 0.12),
            'Alimentação': Math.round(totalIncome * 0.08),
            'Transporte': Math.round(totalIncome * 0.06),
            'Casa': 0,
            'Lazer': Math.round(totalIncome * 0.05),
            'Saúde': Math.round(totalIncome * 0.05),
            'Pets': Math.round(totalIncome * 0.02),
            'Compras': Math.round(totalIncome * 0.05),
            'Educação': Math.round(totalIncome * 0.03),
            'Viagem': Math.round(totalIncome * 0.05),
            'Presentes': Math.round(totalIncome * 0.02),
            'Investimentos': Math.round(totalIncome * 0.1),
            'Assinaturas': 0,
            'Outros': Math.round(totalIncome * 0.05)
        };

        const fixedTotal = (data.rent || 0) + (data.condoFee || 0) + (data.water || 0) + (data.electricity || 0) + (data.internet || 0);
        budgets.Casa = Math.round(fixedTotal * 1.1);

        const subTotal = (data.subscriptions || []).reduce((s, sub) => s + (parseFloat(sub.amount) || 0), 0);
        budgets.Assinaturas = Math.round(subTotal * 1.2);

        return budgets;
    }

    static getInitialData() {
        return {
            mode: 'solo',
            partnerName: '',
            yourIncome: 0,
            partnerIncome: 0,
            rent: 0,
            condoFee: 0,
            water: 0,
            electricity: 0,
            internet: 0,
            subscriptions: [],
            debts: [],
            goalName: '',
            goalTarget: 0,
            goalCurrent: 0,
            goalDeadline: ''
        };
    }
}
