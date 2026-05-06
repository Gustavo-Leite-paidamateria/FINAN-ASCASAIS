import { Transaction, UserConfig } from '../models/index.js';

const SUPABASE_URL = 'https://owxgvzuhunvsxondmifu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93eGd2enVodW52c3hvbmRtaWZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MDYzMzQsImV4cCI6MjA2NTE4MjMzNH0.W52BHGvTGPleNrFQ3SLDlilhPOg6eX_uXP2cDRArou0';

class SupabaseService {
    constructor() {
        this._client = null;
        this._initialized = false;
        this.currentWorkspaceId = null;
        this.currentProfileId = null; // null = Casal (padrão)
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
            .eq('workspace_id', this.currentWorkspaceId)
            .gte('data', startDate.toISOString())
            .lte('data', endDate.toISOString())
            .order('data', { ascending: false });

        if (error) throw error;
        return (data || []).map(t => Transaction.parseFromDb(t));
    }

    async fetchAllTransactions(startDate = null, endDate = null) {
        this.init();
        let query = this.client.from('financeiro').select('*').eq('workspace_id', this.currentWorkspaceId).order('data', { ascending: false });
        
        if (this.currentProfileId) {
            query = query.eq('profile_id', this.currentProfileId);
        }

        if (startDate) query = query.gte('data', startDate.toISOString());
        if (endDate) query = query.lte('data', endDate.toISOString());

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(t => Transaction.parseFromDb(t));
    }

    async insertTransaction(transaction) {
        this.init();
        const items = Array.isArray(transaction) ? transaction : [transaction];
        const records = items.map(item => {
            const record = item instanceof Transaction ? item.toDbRecord() : item;
            record.workspace_id = this.currentWorkspaceId;
            record.profile_id = this.currentProfileId;
            return record;
        });
        
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
            .eq('workspace_id', this.currentWorkspaceId)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data?.dados ? UserConfig.fromJSON(data.dados) : null;
    }

    async updatePassword(newPassword) {
        this.init();
        const { error } = await this.client.auth.updateUser({ password: newPassword });
        if (error) throw error;
    }

    async saveConfig(config) {
        this.init();
        const session = await this.getSession();
        if (!session) return false;

        const data = config instanceof UserConfig ? config.toJSON() : config;
        
        const { error } = await this.client
            .from('configuracoes')
            .upsert({ 
                workspace_id: this.currentWorkspaceId, 
                dados: data,
                id: session.user.id // Keep id for legacy/primary key if needed
            }, { onConflict: 'workspace_id' });
        
        if (error) console.warn("Supabase Sync Error:", error);
        return !error;
    }

    async getWorkspaces() {
        this.init();
        const { data, error } = await this.client
            .from('workspace_members')
            .select('workspace_id, role, workspaces(name, owner_id)');
        if (error) throw error;
        return data;
    }

    async fetchManagedProfiles() {
        this.init();
        const { data, error } = await this.client
            .from('managed_profiles')
            .select('*')
            .eq('workspace_id', this.currentWorkspaceId);
        if (error) throw error;
        return data;
    }

    async createDefaultWorkspace() {
        this.init();
        const { data: { session } } = await this.client.auth.getSession();
        if (!session) throw new Error("Usuário não autenticado");
        const user = session.user;

        console.log("Iniciando criação de workspace padrão para:", user.email);

        // 1. Criar o Workspace
        const { data: ws, error: wsError } = await this.client
            .from('workspaces')
            .insert({ name: 'Meu Espaço', owner_id: user.id })
            .select()
            .single();
        
        if (wsError) {
            console.error("Erro ao criar entrada na tabela workspaces:", wsError);
            throw new Error(`Erro na tabela workspaces: ${wsError.message}`);
        }

        // 2. Adicionar o Membro (Owner)
        const { error: memError } = await this.client
            .from('workspace_members')
            .insert({ 
                workspace_id: ws.id, 
                user_id: user.id, 
                role: 'owner' 
            });
        
        if (memError) {
            console.error("Erro ao criar entrada na tabela workspace_members:", memError);
            throw new Error(`Erro na tabela workspace_members: ${memError.message}`);
        }

        return {
            workspace_id: ws.id,
            role: 'owner',
            workspaces: { name: ws.name, owner_id: ws.owner_id }
        };
    }
}

export const supabaseService = new SupabaseService();
export { Transaction, UserConfig };
