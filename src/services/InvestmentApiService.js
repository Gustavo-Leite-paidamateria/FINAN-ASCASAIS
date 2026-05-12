class InvestmentApiService {
    constructor() {
        this.cache = {};
        this.CACHE_TTL = 60 * 60 * 1000;
    }

    isCacheValid(key) {
        const entry = this.cache[key];
        if (!entry) return false;
        return Date.now() - entry.timestamp < this.CACHE_TTL;
    }

    getFromCache(key) {
        return this.isCacheValid(key) ? this.cache[key].data : null;
    }

    setCache(key, data) {
        this.cache[key] = { data, timestamp: Date.now() };
    }

    async fetchB3Price(ticker) {
        const cacheKey = 'b3_' + ticker;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            // Uses BRAPI with user provided token
            const response = await fetch(`https://brapi.dev/api/quote/${ticker}?token=dE88iQgZ3mcLyGr6hxXwmo`); 
            if (!response.ok) return null;
            const json = await response.json();
            const quote = json.results?.[0];
            if (!quote) return null;

            const result = {
                price: quote.regularMarketPrice || quote.longName || 0,
                name: quote.longName || ticker,
                change: quote.regularMarketChangePercent || 0,
                currency: 'BRL'
            };
            this.setCache(cacheKey, result);
            return result;
        } catch (e) {
            console.warn('BRAPI fetch failed for', ticker, e);
            return null;
        }
    }

    async fetchCryptoPrice(coinId) {
        const cacheKey = 'crypto_' + coinId;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=brl&include_24hr_change=true`);
            if (!response.ok) return null;
            const json = await response.json();
            const data = json[coinId];
            if (!data) return null;

            const result = {
                price: data.brl || 0,
                name: coinId,
                change: data.brl_24h_change || 0,
                currency: 'BRL'
            };
            this.setCache(cacheKey, result);
            return result;
        } catch (e) {
            console.warn('CoinGecko fetch failed for', coinId, e);
            return null;
        }
    }

    async refreshPrices(investments) {
        if (!investments || investments.length === 0) return investments;

        const results = await Promise.allSettled(investments.map(async (inv) => {
            if (inv.type === 'b3' && inv.ticker) {
                const data = await this.fetchB3Price(inv.ticker);
                if (data) {
                    inv.currentPrice = data.price;
                    inv.lastPriceUpdate = new Date().toISOString();
                }
            } else if (inv.type === 'crypto' && inv.ticker) {
                const data = await this.fetchCryptoPrice(inv.ticker);
                if (data) {
                    inv.currentPrice = data.price;
                    inv.lastPriceUpdate = new Date().toISOString();
                }
            }
            return inv;
        }));

        return investments;
    }

    async refreshIfNeeded(investments) {
        const needsRefresh = investments.some(inv => {
            if (inv.type === 'custom') return false;
            if (!inv.lastPriceUpdate) return true;
            const hoursSinceUpdate = (Date.now() - new Date(inv.lastPriceUpdate).getTime()) / (1000 * 60 * 60);
            return hoursSinceUpdate >= 1;
        });

        if (needsRefresh) {
            return await this.refreshPrices(investments);
        }
        return investments;
    }

    async searchB3(query) {
        if (!query || query.length < 2) return [];
        try {
            const response = await fetch(`https://brapi.dev/api/available?search=${query}&token=dE88iQgZ3mcLyGr6hxXwmo`);
            if (!response.ok) return [];
            const json = await response.json();
            return (json.stocks || []).slice(0, 10).map(s => ({
                ticker: s,
                name: s
            }));
        } catch (e) {
            console.warn('BRAPI search failed', e);
            return [];
        }
    }

    getCryptoSearchUrl(query) {
        return `https://api.coingecko.com/api/v3/search?query=${query}`;
    }

    async searchCrypto(query) {
        try {
            const response = await fetch(this.getCryptoSearchUrl(query));
            if (!response.ok) return [];
            const json = await response.json();
            return (json.coins || []).slice(0, 10).map(c => ({
                id: c.id,
                name: c.name,
                symbol: c.symbol,
                thumb: c.thumb
            }));
        } catch (e) {
            console.warn('CoinGecko search failed', e);
            return [];
        }
    }
}

export const investmentApiService = new InvestmentApiService();
