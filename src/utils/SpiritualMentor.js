/**
 * SpiritualMentor.js
 * O Mentor Espiritual Financeiro (Crente Baiano)
 * Gera insights e "revelações" baseadas nos dados financeiros.
 */

export class SpiritualMentor {
    static getMainRevelation(metrics, projections) {
        const phrases = [
            "Varão, a sua botija não vai secar, mas vigia esse cartão de crédito que o inimigo tá querendo tocar!",
            "Misericórdia, minha varoa! Esse extrato tá mais vermelho que o Mar Vermelho antes de Moisés!",
            "O Senhor é meu pastor e o saldo não faltará... mas se continuar no Ifood todo dia, vai faltar sim!",
            "Tô vendo aqui uma nuvem de glória nas suas economias! O dízimo da poupança tá em dia!",
            "Tá amarrado esse espírito da Shopee que quer levar todo o seu salário em bugiganga!",
            "Irmão, essa fatura tá parecendo a muralha de Jericó. Vai precisar de muita oração (e pouco gasto) pra cair!",
            "Azeite transbordando! O Senhor abriu as janelas dos céus e derramou essa restituição na sua conta!",
            "Vigia, varão! O inimigo mora nos pequenos gastos de R$ 9,90. É o laço do passarinheiro!"
        ];

        // Lógica para escolher baseado em estado
        if (projections.realProjection < 0) {
            return "O laço foi armado e o saldo caiu! Misericórdia, varão, essa projeção tá mais negativa que a fé de Tomé!";
        }
        
        if (metrics.expense > metrics.income) {
            return "Vigia! Tá saindo mais azeite do que tá entrando na botija. É hora do jejum de compras!";
        }

        return phrases[Math.floor(Math.random() * phrases.length)];
    }

    static getBalanceInsight(balance) {
        if (balance < 0) return "⚠️ Tá amarrado esse saldo negativo! Jesus quer te dar a terra prometida, não o cheque especial!";
        if (balance < 500) return "🌱 O grão de mostarda tá pequeno, mas vai crescer! Cuida desse restinho!";
        return "✨ Glória! O mar se abriu e o caminho tá livre!";
    }

    static getSavingInsight(rate) {
        if (rate <= 0) return "📉 Misericórdia! Nem uma moedinha pro gazofilácio?";
        if (rate < 15) return "🐢 Passo de cágado? Vamos apressar esse milagre da poupança!";
        if (rate >= 30) return "🚀 É o arrebatamento das dívidas! Tá poupando como um levita!";
        return "✅ O azeite tá rendendo, continua firme!";
    }

    static getGoalsInsight(goals) {
        if (!goals || goals.length === 0) return "🎯 Cadê o alvo, varão? Quem não tem direção, qualquer deserto serve!";
        const completed = goals.filter(g => g.getProgress() >= 100).length;
        if (completed > 0) return "🏆 Aleluia! Uma terra já foi conquistada! Qual a próxima?";
        return "🔥 O fogo tá aceso! O objetivo tá longe mas a promessa é certa!";
    }

    static getTopCategoryInsight(categoryTotals) {
        const sorted = Object.entries(categoryTotals)
            .filter(([cat]) => cat !== 'Receita') // focar apenas em despesas
            .sort((a, b) => b[1] - a[1]);
        
        if (sorted.length === 0) return null;
        
        const [topCat, amount] = sorted[0];

        if (topCat === 'Mercado' && amount > 500) {
            return "🛒 Ô varão, vamos jejuar! O Mercado tá levando o azeite da botija, os valores tão passando do limite! Vigia!";
        }
        
        if (topCat === 'Alimentação' && amount > 800) {
            return "🍔 Banquete real todo dia? O maná do céu é de graça, varão! Segura esse Ifood!";
        }

        if (topCat === 'Lazer' && amount > 400) {
            return "🎡 Muita diversão no deserto? Cuidado pra não se distrair e esquecer de guardar pro amanhã!";
        }

        if (amount > 2000) {
            return `💸 Misericórdia! ${topCat} tá consumindo tudo! É hora de orar e fechar a torneira!`;
        }

        return `✅ ${topCat} tá no topo, mas continua vigiando!`;
    }

    static getPlanningInsight(config) {
        const billsCount = config.scheduledBills.length;
        if (billsCount === 0) return "📝 Varão, o planejamento é o rascunho da benção. Cadê as contas programadas?";
        if (billsCount > 10) return "📅 A agenda tá cheia, hein? Organização é o segredo pra não ser pego de surpresa pelo deserto!";
        return "🛡️ Edificando a casa sobre a rocha! O planejamento tá no caminho certo.";
    }

    static getBudgetSetupInsight(budgets) {
        const categories = Object.keys(budgets).filter(c => budgets[c] > 0);
        const total = Object.values(budgets).reduce((a, b) => a + b, 0);

        if (categories.length === 0) {
            return "✍️ Começa a escrever a visão, varão! Um orçamento sem limites é como uma vinha sem cercas.";
        }
        if (categories.length < 5) {
            return "🧐 Tá faltando detalhe nessa planta! Lembra das pequenas raposas que assolam a vinha (gastos menores).";
        }
        if (total > 15000) {
            return "💰 Esse orçamento tá digno de Salomão! Vigia se a sua renda acompanha essa carruagem real.";
        }
        return "💪 Isso! Tá organizando o gazofilácio com sabedoria. Cada centavo no seu lugar é uma brecha fechada!";
    }

    static getDebtInsight(config) {
        const debts = config.debts || [];
        if (debts.length === 0) return "🕊️ Glória! Nenhuma algema de dívida nesse bolso. Você é livre, varão!";
        
        let totalDebt = 0;
        debts.forEach(d => totalDebt += d.total - (d.paid || 0));
        
        if (totalDebt > 5000) return "🏹 O exército das dívidas é grande, mas a sua coragem tem que ser maior! Persevera no pagamento!";
        return "🧱 Uma pedra por dia e a muralha cai! Continua firme nessa jornada de libertação!";
    }

    static getReportInsight(summary) {
        const { income, expense } = summary;
        if (income > expense) return "📊 Os números tão cantando o hino da vitória! O balanço tá no positivo pela glória!";
        if (income < expense) return "📉 A nuvem tá carregada e o balanço tá no negativo. Vigia essa tempestade financeira!";
        return "⚖️ Na balança do templo, tá tudo equilibrado. Nem sobra, nem falta!";
    }

    static getEvolutionInsight(historyLabels, historyIncome, historyExpense) {
        if (historyLabels.length < 2) return "🌱 O histórico ainda é pequeno, mas a semente foi plantada! Vamos ver os frutos no próximo mês.";
        
        const lastMonthExpense = historyExpense[historyExpense.length - 2];
        const currentMonthExpense = historyExpense[historyExpense.length - 1];

        if (currentMonthExpense < lastMonthExpense * 0.9) {
            return "📈 Aleluia! A queda nos gastos é real! Você tá subindo o monte da liberdade financeira!";
        } else if (currentMonthExpense > lastMonthExpense * 1.1) {
            return "⚠️ Cuidado, varão! Os gastos tão crescendo como mato no deserto. É hora da poda espiritual (e financeira)!";
        }
        return "⚖️ Constância é uma virtude! Os gastos tão mantendo o equilíbrio, continua firme.";
    }

    static getCardUsageInsight(usedAmount, cardLimit) {
        if (!cardLimit || cardLimit === 0) return null;
        const pct = (usedAmount / cardLimit) * 100;

        if (pct > 80) {
            return "🔥 Misericórdia! Esse cartão tá pegando fogo, varão! Tá quase no limite, vigia pra não ficar no deserto!";
        } else if (pct > 50) {
            return "⚠️ O sinal tá amarelo! O cartão tá sendo muito usado, controla esse ímpeto de compra!";
        }
        return "🕊️ Uso moderado. A paz do Senhor reina sobre esse limite!";
    }

    static render(containerId, text) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const type = text.includes('Misericórdia') || text.includes('amarrado') || text.includes('tempestade') ? 'danger' : 
                     text.includes('Vigia') || text.includes('Vê') || text.includes('Azeite') ? 'warning' : '';

        container.innerHTML = `
            <div class="context-insight ${type}">
                <i class="fa-solid fa-fire-burner"></i>
                <span>${text}</span>
            </div>
        `;
    }
}
