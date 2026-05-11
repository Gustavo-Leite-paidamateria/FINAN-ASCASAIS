/**
 * SpiritualMentor.js
 * O Mentor Financeiro (Dinâmico)
 * Gera insights baseados na persona escolhida pelo usuário.
 */
import { MENTOR_CONFIGS } from './mentorsConfig.js';

export class SpiritualMentor {
    static getActiveMentor(config) {
        const mentorId = config?.selectedMentor || 'PASTOR_TRADICIONAL';
        return MENTOR_CONFIGS[mentorId] || MENTOR_CONFIGS.PASTOR_TRADICIONAL;
    }

    static getMainRevelation(config, metrics, projections) {
        if (!config) return "Vigia, varão! Carregando dados...";
        
        // Se houver projeção negativa, priorizar aviso de perigo
        if (projections?.realProjection < 0) {
            return this.getPhrase(config, 'GASTO_EXCESSIVO', { categoria: 'Saldo Geral' });
        }

        // Caso contrário, pegar uma frase aleatória de orçamentos ou economia
        const type = metrics?.income > metrics?.expense ? 'ECONOMIA_POUPANCA' : 'ORCAMENTO_setup';
        return this.getPhrase(config, type);
    }

    static getPhrase(config, type, data = {}) {
        const mentor = this.getActiveMentor(config);
        const categoryPhrases = mentor.insights[type] || [];
        
        if (categoryPhrases.length === 0) return "";

        let phrase = categoryPhrases[Math.floor(Math.random() * categoryPhrases.length)];
        
        // Substituir variáveis como {categoria}
        Object.keys(data).forEach(key => {
            phrase = phrase.replace(`{${key}}`, data[key]);
        });

        return phrase;
    }

    static getBalanceInsight(config, balance) {
        if (balance < 0) return this.getPhrase(config, 'GASTO_EXCESSIVO', { categoria: 'Saldo Geral' });
        return this.getPhrase(config, 'ECONOMIA_POUPANCA');
    }

    static getBudgetSetupInsight(config, budgets) {
        return this.getPhrase(config, 'ORCAMENTO_setup');
    }

    static getPlanningInsight(config) {
        return this.getPhrase(config, 'ORCAMENTO_setup');
    }

    static getDebtInsight(config, debts = []) {
        if (debts.length === 0) return "🕊️ Nenhuma dívida ativa. Você é livre!";
        return this.getPhrase(config, 'DIVIDAS');
    }

    static getSavingInsight(config, rate) {
        if (rate > 0) return this.getPhrase(config, 'ECONOMIA_POUPANCA');
        return "📉 Vamos começar a poupar?";
    }

    static getGoalsInsight(config, goals) {
        return this.getPhrase(config, 'ECONOMIA_POUPANCA');
    }

    static getReportInsight(config, summary) {
        if (summary?.balance < 0) return this.getPhrase(config, 'GASTO_EXCESSIVO', { categoria: 'Balanço Geral' });
        return this.getPhrase(config, 'ECONOMIA_POUPANCA');
    }

    static getTopCategoryInsight(config, categoryTotals) {
        const sorted = Object.entries(categoryTotals || {})
            .filter(([cat]) => cat !== 'Receita')
            .sort((a, b) => b[1] - a[1]);
        
        if (sorted.length === 0) return "";
        const [topCat] = sorted[0];
        return this.getPhrase(config, 'GASTO_EXCESSIVO', { categoria: topCat });
    }

    static getEvolutionInsight(config, labels, income, expense) {
        return this.getPhrase(config, 'ORCAMENTO_setup');
    }

    static getCardUsageInsight(config, used, limit) {
        if (used > limit * 0.8) return this.getPhrase(config, 'GASTO_EXCESSIVO', { categoria: 'Cartão' });
        return "💳 Uso controlado do cartão.";
    }

    static render(containerId, text, config = null) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const mentor = this.getActiveMentor(config);
        
        const type = text.includes('⚠️') || text.includes('Vigia') || text.includes('Atenção') ? 'warning' : '';

        container.innerHTML = `
            <div class="context-insight ${type}">
                <span class="mentor-icon">${mentor.icon}</span>
                <span>${text}</span>
            </div>
        `;
    }
}
