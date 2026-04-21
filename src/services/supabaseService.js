import { Transaction, UserConfig } from '../models/index.js';

const SUPABASE_URL = 'https://owxgvzuhunvsxondmifu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93eGd2enVodW52c3hvbmRtaWZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MDYzMzQsImV4cCI6MjA2NTE4MjMzNH0.W52BHGvTGPleNrFQ3SLDlilhPOg6eX_uXP2cDRArou0';

class SupabaseService {
    constructor() {
        this._client = null;
        this._initialized = false;
    }

    get client() {
        this.init();
        return this._client;
    }

    init() {
        if (this._initialized) return;
        this._client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        this._initialized = true;
    }

    async loginUser(email, password) {
        this.init();
        const { data, error } = await this.client.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (error) throw error;
        return data;
    }

    async registerUser(email, password) {
        this.init();
        const { data, error } = await this.client.auth.signUp({
            email: email,
            password: password
        });
        if (error) throw error;
        return data;
    }

    async logoutUser() {
        this.init();
        const { error } = await this.client.auth.signOut();
        if (error) throw error;
    }

    async getSession() {
        this.init();
        const { data, error } = await this.client.auth.getSession();
        if (error) throw error;
        return data.session;
    }

    async fetchTransactions(startDate, endDate) {
        this.init();
        const { data, error } = await this.client
            .from('financeiro')
            .select('*')
            .gte('data', startDate.toISOString())
            .lte('data', endDate.toISOString())
            .order('data', { ascending: false });

        if (error) throw error;
        return (data || []).map(t => Transaction.parseFromDb(t));
    }

    async fetchAllTransactions(startDate = null, endDate = null) {
        this.init();
        let query = this.client.from('financeiro').select('*').order('data', { ascending: false });
        
        if (startDate) query = query.gte('data', startDate.toISOString());
        if (endDate) query = query.lte('data', endDate.toISOString());

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(t => Transaction.parseFromDb(t));
    }

    async insertTransaction(transaction) {
        this.init();
        const items = Array.isArray(transaction) ? transaction : [transaction];
        const records = items.map(item =>
            item instanceof Transaction ? item.toDbRecord() : item
        );
        
        const { error } = await this.client.from('financeiro').insert(records);
        if (error) throw error;
    }

    async updateTransaction(id, transaction) {
        this.init();
        const record = transaction instanceof Transaction 
            ? transaction.toDbRecord() 
            : transaction;
        
        const { error } = await this.client.from('financeiro').update(record).eq('id', id);
        if (error) throw error;
    }

    async deleteTransaction(id) {
        this.init();
        const { error } = await this.client.from('financeiro').delete().eq('id', id);
        if (error) throw error;
    }

    async deleteTransactionsByRange(startDate, endDate) {
        this.init();
        const { error } = await this.client
            .from('financeiro')
            .delete()
            .gte('data', startDate.toISOString())
            .lte('data', endDate.toISOString());
        if (error) throw error;
    }

    async fetchTransactionsRaw(startDate = null, endDate = null) {
        this.init();
        let query = this.client.from('financeiro').select('*').order('data', { ascending: false });
        
        if (startDate) query = query.gte('data', startDate instanceof Date ? startDate.toISOString() : startDate);
        if (endDate) query = query.lte('data', endDate instanceof Date ? endDate.toISOString() : endDate);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    async loadConfig() {
        this.init();
        const session = await this.getSession();
        if (!session) return null;

        const { data, error } = await this.client
            .from('configuracoes')
            .select('dados')
            .eq('id', session.user.id)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data?.dados ? UserConfig.fromJSON(data.dados) : null;
    }

    async saveConfig(config) {
        this.init();
        const session = await this.getSession();
        if (!session) return false;

        const data = config instanceof UserConfig ? config.toJSON() : config;
        
        const { error } = await this.client
            .from('configuracoes')
            .upsert({ id: session.user.id, dados: data }, { onConflict: 'id' });
        
        if (error) console.warn("Supabase Sync Error:", error);
        return !error;
    }
}

export const supabaseService = new SupabaseService();
export { Transaction, UserConfig };
