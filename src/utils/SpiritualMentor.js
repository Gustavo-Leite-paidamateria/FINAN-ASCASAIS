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
        if (balance < 0) return `⚠️ ${this.getPhrase(config, 'GASTO_EXCESSIVO', { categoria: 'Saldo Geral' })}`;
        if (balance < 500) return `🌱 O pé de meia tá pequeno, mas vai crescer!`;
        return `✨ Tudo sob controle no Reino!`;
    }

    static getBudgetSetupInsight(config, budgets) {
        return this.getPhrase(config, 'ORCAMENTO_setup');
    }

    static getDebtInsight(config, debts = []) {
        if (debts.length === 0) return "🕊️ Livre como um pássaro! Nenhuma dívida ativa.";
        return this.getPhrase(config, 'DIVIDAS');
    }

    static getSavingInsight(config, rate) {
        if (rate > 0) return this.getPhrase(config, 'ECONOMIA_POUPANCA');
        return "📉 Vamos começar a poupar?";
    }

    static render(containerId, text, config = null) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const mentor = this.getActiveMentor(config);
        
        // Definir cor baseada no tom (simplificado)
        const type = text.includes('Misericórdia') || text.includes('Vigia') || text.includes('Atenção') ? 'warning' : 
                     text.includes('Erro') || text.includes('perigo') ? 'danger' : '';

        container.innerHTML = `
            <div class="context-insight ${type}">
                <span class="mentor-icon">${mentor.icon}</span>
                <span>${text}</span>
            </div>
        `;
    }
}
