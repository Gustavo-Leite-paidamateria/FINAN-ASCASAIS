import { formatCurrency } from './index.js';

export class FinancialAnalyzer {
    static analyze(transactions, config) {
        const subs = this.detectSubscriptions(transactions);
        const patterns = this.analyzePatterns(transactions);
        const profile = this.analyzeProfile(transactions, config);
        const recommendations = this.generateRecommendations(transactions, subs, patterns, profile, config);
        return { subscriptions: subs, patterns, profile, recommendations };
    }

    static detectSubscriptions(transactions) {
        const expenses = transactions.filter(t => t.tipo === 'Despesa' && t.referencia !== 'transferencia');
        const grouped = {};
        expenses.forEach(t => {
            const key = `${t.descricao}|${t.valor}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(t);
        });

        const subscriptions = [];
        Object.values(grouped).forEach(group => {
            if (group.length < 2) return;
            const months = new Set(group.map(t => t.data ? t.data.substring(0, 7) : ''));
            if (months.size >= 2) {
                const sorted = group.sort((a, b) => new Date(b.data) - new Date(a.data));
                subscriptions.push({
                    description: group[0].descricao,
                    amount: group[0].valor,
                    category: group[0].categoria,
                    occurrences: group.length,
                    distinctMonths: months.size,
                    lastDate: sorted[0].data,
                    payee: group[0].payee_id,
                    estimatedYearly: group[0].valor * 12
                });
            }
        });

        return subscriptions.sort((a, b) => b.amount - a.amount);
    }

    static analyzePatterns(transactions) {
        const expenses = transactions.filter(t => t.tipo === 'Despesa' && t.referencia !== 'transferencia');
        const total = expenses.length;
        if (total === 0) return null;

        const byCategory = {};
        const byDayOfWeek = Array(7).fill(0);
        const byHour = Array(24).fill(0);
        const byWeek = Array(5).fill(0);
        let totalAmount = 0;
        let weekendAmount = 0;
        let weekendCount = 0;
        let weekdayAmount = 0;
        let weekdayCount = 0;
        let smallest = Infinity;
        let largest = 0;
        let smallestT = null;
        let largestT = null;

        expenses.forEach(t => {
            const v = parseFloat(t.valor);
            totalAmount += v;
            if (v < smallest) { smallest = v; smallestT = t; }
            if (v > largest) { largest = v; largestT = t; }
            const cat = t.categoria || 'Outros';
            if (!byCategory[cat]) byCategory[cat] = { count: 0, total: 0 };
            byCategory[cat].count++;
            byCategory[cat].total += v;

            if (t.data) {
                const d = new Date(t.data);
                const day = d.getDay();
                byDayOfWeek[day]++;
                byWeek[Math.floor(d.getDate() / 7)]++;
                const hour = d.getHours();
                byHour[hour]++;
                if (day === 0 || day === 6) {
                    weekendCount++;
                    weekendAmount += v;
                } else {
                    weekdayCount++;
                    weekdayAmount += v;
                }
            }
        });

        const avgTicket = totalAmount / total;
        const categorySorted = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);
        const topCategory = categorySorted[0];
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const peakDay = byDayOfWeek.indexOf(Math.max(...byDayOfWeek));

        return {
            totalTransactions: total,
            totalAmount,
            avgTicket,
            smallest: { value: smallest, description: smallestT?.descricao, date: smallestT?.data },
            largest: { value: largest, description: largestT?.descricao, date: largestT?.data },
            categoryDistribution: categorySorted,
            topCategory: topCategory ? { name: topCategory[0], total: topCategory[1].total, count: topCategory[1].count, pct: (topCategory[1].total / totalAmount * 100) } : null,
            peakDayIndex: peakDay,
            peakDayName: dayNames[peakDay],
            weekendPct: totalAmount > 0 ? (weekendAmount / totalAmount * 100) : 0,
            weekdayPct: totalAmount > 0 ? (weekdayAmount / totalAmount * 100) : 0,
            weekendCount,
            weekdayCount,
            byDayOfWeek,
            byWeek,
            freqPerDay: total > 0 && weekdayCount > 0 ? (total / expenses.reduce((acc, t) => {
                if (t.data) {
                    const d = new Date(t.data);
                    if (d.getDay() !== 0 && d.getDay() !== 6) acc++;
                }
                return acc;
            }, 1)) : 0
        };
    }

    static analyzeProfile(transactions, config) {
        const expenses = transactions.filter(t => t.tipo === 'Despesa' && t.referencia !== 'transferencia');
        const incomes = transactions.filter(t => t.tipo === 'Receita');
        const totalExpense = expenses.reduce((s, t) => s + parseFloat(t.valor), 0);
        const totalIncome = incomes.reduce((s, t) => s + parseFloat(t.valor), 0);

        if (expenses.length === 0) return { type: 'sem_dados', label: 'Sem dados' };

        const byCategory = {};
        expenses.forEach(t => {
            const cat = t.categoria || 'Outros';
            if (!byCategory[cat]) byCategory[cat] = 0;
            byCategory[cat] += parseFloat(t.valor);
        });

        const fixedCategories = ['Casa', 'Transporte', 'Saúde', 'Pets', 'Assinaturas', 'Educação'];
        let fixedTotal = 0;
        let variableTotal = 0;
        expenses.forEach(t => {
            if (fixedCategories.includes(t.categoria)) fixedTotal += parseFloat(t.valor);
            else variableTotal += parseFloat(t.valor);
        });

        const fixedRatio = totalExpense > 0 ? fixedTotal / totalExpense : 0;
        const avgTicket = totalExpense / expenses.length;
        const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
        const hasDebts = (config.debts || []).length > 0;

        let type, label, score;
        if (savingsRate >= 15) {
            type = 'poupador';
            label = 'Poupador';
            score = 85;
        } else if (savingsRate >= 5) {
            type = 'equilibrado';
            label = 'Equilibrado';
            score = 65;
        } else if (savingsRate > -10) {
            type = 'gastador_consciente';
            label = 'Gastador Consciente';
            score = 45;
        } else if (hasDebts && savingsRate < -10) {
            type = 'endividado';
            label = 'Endividado';
            score = 25;
        } else {
            type = 'gastador';
            label = 'Gastador';
            score = 30;
        }

        if (hasDebts && score > 40) score -= 10;
        if (fixedRatio > 0.6) score -= 10;
        if (savingsRate >= 20) score += 10;

        const topCat = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

        return {
            type,
            label,
            score: Math.max(0, Math.min(100, score)),
            fixedRatio,
            variableRatio: 1 - fixedRatio,
            avgTicket,
            totalExpense,
            totalIncome,
            savingsRate,
            transactionCount: expenses.length,
            topCategory: topCat ? topCat[0] : null,
            hasDebts
        };
    }

    static generateRecommendations(transactions, subscriptions, patterns, profile, config) {
        const recommendations = [];

        if (!profile || profile.type === 'sem_dados') return [];

        if (subscriptions.length > 0) {
            const yearlySubCost = subscriptions.reduce((s, sub) => s + sub.estimatedYearly, 0);
            recommendations.push({
                type: 'subscriptions',
                icon: '📺',
                title: 'Assinaturas Detectadas',
                description: `${subscriptions.length} assinatura(s) encontrada(s). Gasto anual estimado: ${formatCurrency(yearlySubCost)}. Reveja se todas são necessárias.`,
                severity: yearlySubCost > 2000 ? 'high' : 'medium'
            });
        }

        if (profile.fixedRatio > 0.6) {
            recommendations.push({
                type: 'fixed_cost',
                icon: '🏠',
                title: 'Custos Fixos Elevados',
                description: `${(profile.fixedRatio * 100).toFixed(0)}% dos gastos são fixos. O ideal é abaixo de 50%. Considere reduzir assinaturas, renegociar contratos ou buscar alternativas.`,
                severity: 'high'
            });
        }

        if (profile.savingsRate < 5) {
            const target = Math.max(10, Math.min(30, profile.savingsRate + 15));
            recommendations.push({
                type: 'savings',
                icon: '💰',
                title: 'Meta de Poupança',
                description: `Sua taxa de poupança é de ${profile.savingsRate.toFixed(1)}%. Tente poupar ${target}% da renda. Considere a regra 50/30/20: 50% necessidades, 30% desejos, 20% poupança.`,
                severity: 'high'
            });
        }

        if (patterns && patterns.avgTicket > 0) {
            if (patterns.avgTicket > 200) {
                recommendations.push({
                    type: 'avg_ticket',
                    icon: '🎫',
                    title: 'Ticket Médio Alto',
                    description: `Seu ticket médio é de ${formatCurrency(patterns.avgTicket)}. Pequenas compras no dia a dia podem somar muito no fim do mês.`,
                    severity: 'medium'
                });
            } else if (patterns.avgTicket < 30 && profile.totalExpense > 1000) {
                recommendations.push({
                    type: 'micro_spending',
                    icon: '🔬',
                    title: 'Micro Gastos Frequentes',
                    description: `Ticket médio de ${formatCurrency(patterns.avgTicket)} indica muitos micro gastos. Eles passam despercebidos mas somam ${formatCurrency(profile.totalExpense)} no período.`,
                    severity: 'medium'
                });
            }
        }

        if (profile.hasDebts && profile.savingsRate < 0) {
            recommendations.push({
                type: 'debt_urgent',
                icon: '🚨',
                title: 'Prioridade: Quitar Dívidas',
                description: 'Com dívidas ativas e gastos acima da renda, priorize a quitação das dívidas antes de poupar. Considere renegociação ou consolidação.',
                severity: 'critical'
            });
        }

        if (patterns && patterns.weekendPct > 25) {
            recommendations.push({
                type: 'weekend',
                icon: '🎉',
                title: 'Gastos de Final de Semana',
                description: `${patterns.weekendPct.toFixed(0)}% dos gastos ocorrem em fins de semana. Planeje atividades de lazer mais econômicas.`,
                severity: 'low'
            });
        }

        if (profile.topCategory && profile.fixedRatio > 0.5) {
            const cat = profile.topCategory;
            if (['Mercado', 'Alimentação'].includes(cat)) {
                recommendations.push({
                    type: 'food',
                    icon: '🍔',
                    title: 'Gastos com Alimentação',
                    description: `${cat} é sua maior categoria. Planeje refeições em casa, leve marmita e evite delivery durante a semana.`,
                    severity: 'medium'
                });
            }
        }

        recommendations.push({
            type: 'general',
            icon: '📊',
            title: 'Acompanhamento Mensal',
            description: 'Faça uma revisão financeira todo mês. Use os relatórios para comparar sua evolução e ajustar metas.',
            severity: 'low'
        });

        return recommendations;
    }
}
