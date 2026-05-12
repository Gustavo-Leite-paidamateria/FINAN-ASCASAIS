import { Investment } from '../models/index.js';
import { supabaseService, storageService, notificationService, investmentApiService } from '../services/index.js';
import { formatCurrency } from '../utils/index.js';

class InvestmentsController {
    render(config) {
        const container = document.getElementById('investments-view');
        if (!container || container.classList.contains('hidden')) return;

        this.renderSummary(config);
        this.renderB3List(config);
        this.renderCryptoList(config);
        this.renderCustomList(config);

        // Somente inicia o refresh se não houver um em andamento
        if (!this._isRefreshing) {
            this.refreshPrices(config);
        }
    }

    async refreshPrices(config) {
        if (this._isRefreshing) return;
        this._isRefreshing = true;

        try {
            const investments = config.investments || [];
            if (investments.length === 0) return;

            const needsRefresh = investments.some(inv => {
                if (inv.type === 'custom') return false;
                if (!inv.lastPriceUpdate) return true;
                const hoursSinceUpdate = (Date.now() - new Date(inv.lastPriceUpdate).getTime()) / (1000 * 60 * 60);
                return hoursSinceUpdate >= 1;
            });

            if (needsRefresh) {
                await investmentApiService.refreshPrices(investments);
                storageService.saveConfig(config);
                await supabaseService.saveConfig(config);
                
                // Re-renderiza sem disparar o refresh de novo
                this.renderSummary(config);
                this.renderB3List(config);
                this.renderCryptoList(config);
                this.renderCustomList(config);
            }
        } catch (e) {
            console.error('Error refreshing investment prices:', e);
        } finally {
            this._isRefreshing = false;
        }
    }

    renderSummary(config) {
        const investments = config.investments || [];
        let totalInvested = 0;
        let totalCurrent = 0;

        investments.forEach(inv => {
            totalInvested += inv.totalInvested;
            totalCurrent += inv.getCurrentValue();
        });

        const totalPL = totalCurrent - totalInvested;
        const totalPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

        const investedEl = document.getElementById('inv-summary-invested');
        const currentEl = document.getElementById('inv-summary-current');
        const plEl = document.getElementById('inv-summary-pl');

        if (investedEl) investedEl.textContent = formatCurrency(totalInvested);
        if (currentEl) currentEl.textContent = formatCurrency(totalCurrent);
        if (plEl) {
            plEl.textContent = `${totalPL >= 0 ? '+' : ''}${formatCurrency(totalPL)} (${totalPct >= 0 ? '+' : ''}${totalPct.toFixed(2)}%)`;
            plEl.style.color = totalPL >= 0 ? 'var(--income)' : 'var(--expense)';
        }
    }

    renderB3List(config) {
        const container = document.getElementById('inv-b3-list');
        if (!container) return;

        const items = (config.investments || []).filter(i => i.type === 'b3');
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding:20px;">Nenhum ativo da B3 cadastrado.</div>';
            return;
        }

        container.innerHTML = items.map(inv => {
            const current = inv.getCurrentValue();
            const pl = inv.getProfitLoss();
            const pct = inv.getProfitLossPercent();
            const lastUpdate = inv.lastPriceUpdate
                ? this.formatLastUpdate(inv.lastPriceUpdate)
                : '—';

            return `
                <div class="config-item">
                    <div class="config-info">
                        <strong><i class="fa-solid fa-chart-simple"></i> ${inv.ticker || inv.name}</strong>
                        <span class="subtitle">${inv.category} • ${inv.quantity} cotas • Preço: R$ ${(inv.currentPrice || inv.buyPrice).toFixed(2)}</span>
                        <span class="subtitle">Compra: R$ ${inv.buyPrice.toFixed(2)} • Atualizado: ${lastUpdate}</span>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:600;">${formatCurrency(current)}</div>
                        <div style="font-size:0.8rem;color:${pl >= 0 ? 'var(--income)' : 'var(--expense)'};">
                            ${pl >= 0 ? '+' : ''}${formatCurrency(pl)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)
                        </div>
                        <div style="font-size:0.65rem;color:var(--text-sec);">Investido: ${formatCurrency(inv.totalInvested)}</div>
                    </div>
                    <button class="btn-icon small" onclick="window.app.investmentsController.delete('${inv.id}')" style="margin-left:8px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    renderCryptoList(config) {
        const container = document.getElementById('inv-crypto-list');
        if (!container) return;

        const items = (config.investments || []).filter(i => i.type === 'crypto');
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding:20px;">Nenhuma criptomoeda cadastrada.</div>';
            return;
        }

        container.innerHTML = items.map(inv => {
            const current = inv.getCurrentValue();
            const pl = inv.getProfitLoss();
            const pct = inv.getProfitLossPercent();
            const lastUpdate = inv.lastPriceUpdate
                ? this.formatLastUpdate(inv.lastPriceUpdate)
                : '—';

            return `
                <div class="config-item">
                    <div class="config-info">
                        <strong><i class="fa-brands fa-bitcoin"></i> ${inv.name} (${(inv.ticker || '').toUpperCase()})</strong>
                        <span class="subtitle">Preço: R$ ${(inv.currentPrice || inv.buyPrice).toFixed(2)} • ${inv.quantity} unidades</span>
                        <span class="subtitle">Atualizado: ${lastUpdate}</span>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:600;">${formatCurrency(current)}</div>
                        <div style="font-size:0.8rem;color:${pl >= 0 ? 'var(--income)' : 'var(--expense)'};">
                            ${pl >= 0 ? '+' : ''}${formatCurrency(pl)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)
                        </div>
                        <div style="font-size:0.65rem;color:var(--text-sec);">Investido: ${formatCurrency(inv.totalInvested)}</div>
                    </div>
                    <button class="btn-icon small" onclick="window.app.investmentsController.delete('${inv.id}')" style="margin-left:8px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    renderCustomList(config) {
        const container = document.getElementById('inv-custom-list');
        if (!container) return;

        const items = (config.investments || []).filter(i => i.type === 'custom');
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding:20px;">Nenhum investimento personalizado cadastrado.</div>';
            return;
        }

        container.innerHTML = items.map(inv => {
            const current = inv.getCurrentValue();
            const pl = inv.getProfitLoss();
            const pct = inv.getProfitLossPercent();

            let progressInfo = '';
            if (inv.startDate && inv.durationMonths > 0) {
                const start = new Date(inv.startDate);
                const now = new Date();
                const elapsed = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
                const remaining = Math.max(0, inv.durationMonths - elapsed);
                const progress = Math.min(100, (elapsed / inv.durationMonths) * 100);
                progressInfo = `
                    <div style="margin-top:6px;">
                        <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-sec);">
                            <span>${elapsed}m de ${inv.durationMonths}m</span>
                            <span>${remaining}m restantes</span>
                        </div>
                        <div class="goal-track" style="margin-top:4px;">
                            <div class="goal-fill" style="width:${progress}%;background:var(--accent);"></div>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="config-item">
                    <div class="config-info">
                        <strong><i class="fa-solid fa-sack-dollar"></i> ${inv.name}</strong>
                        <span class="subtitle">${inv.category} • ${inv.monthlyReturn}% ao mês</span>
                        ${progressInfo ? `<div>${progressInfo}</div>` : ''}
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:600;">${formatCurrency(current)}</div>
                        <div style="font-size:0.8rem;color:${pl >= 0 ? 'var(--income)' : 'var(--expense)'};">
                            ${pl >= 0 ? '+' : ''}${formatCurrency(pl)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)
                        </div>
                        <div style="font-size:0.65rem;color:var(--text-sec);">Investido: ${formatCurrency(inv.totalInvested)}</div>
                    </div>
                    <button class="btn-icon small" onclick="window.app.investmentsController.delete('${inv.id}')" style="margin-left:8px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    formatLastUpdate(isoString) {
        if (!isoString) return '—';
        const diff = Date.now() - new Date(isoString).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'agora';
        if (mins < 60) return `${mins}min atrás`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h atrás`;
        return `${Math.floor(hours / 24)}d atrás`;
    }

    openAddModal() {
        document.getElementById('inv-form')?.reset();
        this.setTypeFields('b3');
        document.getElementById('inv-modal')?.classList.remove('hidden');
        this.initSearchHandlers();
    }

    initSearchHandlers() {
        const b3Input = document.getElementById('inv-b3-ticker');
        const cryptoInput = document.getElementById('inv-crypto-id');

        if (b3Input) {
            b3Input.removeEventListener('input', this.handleB3Search);
            b3Input.addEventListener('input', (e) => this.handleB3Search(e.target.value));
        }
        if (cryptoInput) {
            cryptoInput.removeEventListener('input', this.handleCryptoSearch);
            cryptoInput.addEventListener('input', (e) => this.handleCryptoSearch(e.target.value));
        }
    }

    async handleB3Search(query) {
        if (!query || query.length < 2) return;
        const suggestions = await investmentApiService.searchB3(query);
        const datalist = document.getElementById('b3-suggestions');
        if (datalist) {
            datalist.innerHTML = suggestions.map(s => `<option value="${s.ticker}">${s.name}</option>`).join('');
        }
    }

    async handleCryptoSearch(query) {
        if (!query || query.length < 2) return;
        const suggestions = await investmentApiService.searchCrypto(query);
        const datalist = document.getElementById('crypto-suggestions');
        if (datalist) {
            datalist.innerHTML = suggestions.map(s => `<option value="${s.id}">${s.name} (${s.symbol.toUpperCase()})</option>`).join('');
        }
    }

    setTypeFields(type) {
        const b3Fields = document.getElementById('inv-b3-fields');
        const cryptoFields = document.getElementById('inv-crypto-fields');
        const customFields = document.getElementById('inv-custom-fields');

        [b3Fields, cryptoFields, customFields].forEach(el => {
            if (el) el.classList.add('hidden');
        });

        if (type === 'b3' && b3Fields) b3Fields.classList.remove('hidden');
        else if (type === 'crypto' && cryptoFields) cryptoFields.classList.remove('hidden');
        else if (type === 'custom' && customFields) customFields.classList.remove('hidden');
    }

    async add(config) {
        try {
            const type = document.getElementById('inv-type-select')?.value;
            const name = document.getElementById('inv-name')?.value?.trim();
            const category = document.getElementById('inv-category')?.value || 'Outro';

            if (!name) {
                notificationService.error('Erro', 'Nome do investimento é obrigatório.');
                return;
            }

            let ticker = '';
            let buyPrice = 0;
            let quantity = 0;
            let totalInvested = 0;
            let monthlyReturn = 0;
            let startDate = null;
            let durationMonths = 0;
            let purchaseDate = new Date().toISOString().split('T')[0];

            if (type === 'b3' || type === 'crypto') {
                ticker = type === 'b3'
                    ? document.getElementById('inv-b3-ticker')?.value?.trim().toUpperCase()
                    : document.getElementById('inv-crypto-id')?.value?.trim().toLowerCase();
                const parseMoney = (val) => {
                    if (!val) return 0;
                    // Remove currency symbols, spaces and thousands separators (dots)
                    // Then replace comma with dot for decimals
                    const cleaned = val.toString()
                        .replace(/[R$\s]/g, '')
                        .replace(/\./g, '')
                        .replace(',', '.');
                    return parseFloat(cleaned) || 0;
                };

                buyPrice = parseMoney(document.getElementById('inv-buy-price')?.value);
                totalInvested = parseMoney(document.getElementById('inv-total-invested')?.value);
                purchaseDate = document.getElementById('inv-date')?.value || purchaseDate;

                if (!ticker) {
                    notificationService.error('Erro', type === 'b3' ? 'Informe o ticker do ativo.' : 'Informe o ID da criptomoeda.');
                    return;
                }
                if (buyPrice <= 0 || totalInvested <= 0) {
                    notificationService.error('Erro', 'Preço de compra e valor total são obrigatórios.');
                    return;
                }
                quantity = totalInvested / buyPrice;
            } else {
                const parseMoney = (val) => {
                    if (!val) return 0;
                    const cleaned = val.toString().replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
                    return parseFloat(cleaned) || 0;
                };

                totalInvested = parseMoney(document.getElementById('inv-custom-amount')?.value);
                monthlyReturn = parseMoney(document.getElementById('inv-monthly-return')?.value);
                startDate = document.getElementById('inv-start-date')?.value || new Date().toISOString().split('T')[0];
                durationMonths = parseInt(document.getElementById('inv-duration')?.value) || 0;

                if (totalInvested <= 0) {
                    notificationService.error('Erro', 'Valor investido é obrigatório.');
                    return;
                }
            }

            const inv = new Investment({
                name, ticker, type, category, buyPrice, totalInvested,
                quantity, purchaseDate, monthlyReturn, startDate, durationMonths
            });

            config.investments.push(inv);
            storageService.saveConfig(config);
            await supabaseService.saveConfig(config);

            document.getElementById('inv-modal')?.classList.add('hidden');
            this.render(config);
            notificationService.success('Sucesso', 'Investimento adicionado!');

            // Fetch price immediately for B3/crypto
            if (type !== 'custom') {
                this.refreshPrices(config);
            }
        } catch (e) {
            console.error('Erro ao adicionar investimento:', e);
            notificationService.error('Erro', 'Falha ao adicionar investimento.');
        }
    }

    async delete(id) {
        if (!confirm('Deseja excluir este investimento?')) return;
        try {
            const config = window.app.config;
            config.investments = config.investments.filter(inv => inv.id !== id);
            storageService.saveConfig(config);
            await supabaseService.saveConfig(config);
            this.render(config);
            notificationService.success('Sucesso', 'Investimento removido.');
        } catch (e) {
            console.error('Erro ao excluir investimento:', e);
            notificationService.error('Erro', 'Falha ao excluir investimento.');
        }
    }
}

export default InvestmentsController;
