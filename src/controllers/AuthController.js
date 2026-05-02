import { storageService, supabaseService, notificationService } from '../services/index.js';
import { UserConfig } from '../models/index.js';

class AuthController {
    async login(email, password) {
        try {
            const authData = await supabaseService.loginUser(email, password);
            storageService.saveUser(email);
            this.showApp();
            await this.initializeApp();
            return true;
        } catch (error) {
            console.error("Login failed:", error);
            const errDiv = document.getElementById('login-error');
            if (errDiv) {
                errDiv.textContent = "Verifique o e-mail ou a senha.";
            }
            notificationService.error('Erro', 'Credenciais inválidas.');
            return false;
        }
    }

    async register(email, password) {
        try {
            const authData = await supabaseService.registerUser(email, password);
            if(authData.user && authData.user.identities && authData.user.identities.length === 0) {
                 notificationService.error('Erro', 'Este e-mail já está em uso.');
                 return false;
            }
            // Supabase auto-logs in on signup by default if email confirmation is disabled
            storageService.saveUser(email);
            this.showApp();
            await this.initializeApp();
            return true;
        } catch (error) {
            console.error("Register failed:", error);
            const errDiv = document.getElementById('login-error');
            if (errDiv) {
                errDiv.textContent = error.message || "Erro ao criar conta. Verifique os dados.";
            }
            notificationService.error('Erro', 'Erro ao criar conta.');
            return false;
        }
    }

    async logout() {
        try {
            await supabaseService.logoutUser();
        } catch (e) {
            console.error("Logout error", e);
        }
        storageService.clearUser();
        this.showLogin();
    }

    async checkAuth() {
        try {
            const session = await supabaseService.getSession();
            if (!session) {
                storageService.clearUser();
                this.showLogin();
                return false;
            }
            const user = session.user.email;
            storageService.saveUser(user);

            this.showApp();
            await this.initializeApp();
            this.refreshHeader(window.app?.config);
            return true;
        } catch (e) {
            console.error("Check Auth Error:", e);
            this.showLogin();
            return false;
        }
    }

    refreshHeader(config) {
        const userData = config?.userData || {};
        const displayName = userData.display_name;
        const avatarUrl = userData.avatar_url;
        const email = storageService.getUser() || 'Usuário';

        const userDisplay = document.getElementById('display-user-email');
        if (userDisplay) userDisplay.textContent = displayName || email;

        const avatarIcon = document.getElementById('avatar-icon');
        const avatarImg = document.getElementById('avatar-img');
        if (avatarImg && avatarIcon) {
            if (avatarUrl) {
                avatarImg.src = avatarUrl;
                avatarImg.style.display = 'block';
                avatarIcon.style.display = 'none';
            } else {
                avatarImg.style.display = 'none';
                avatarIcon.style.display = '';
            }
        }

        // Refresh profile switcher
        window.app?.familyController?.renderProfileSwitcher(config);
    }

    async saveProfile(config, displayName, avatarBase64, newPassword, confirmPassword) {
        let changed = false;

        if (newPassword) {
            if (newPassword.length < 6) {
                notificationService.error('Erro', 'A senha precisa ter pelo menos 6 caracteres.');
                return false;
            }
            if (newPassword !== confirmPassword) {
                notificationService.error('Erro', 'As senhas não conferem.');
                return false;
            }
            try {
                await supabaseService.updatePassword(newPassword);
            } catch (e) {
                notificationService.error('Erro', 'Falha ao atualizar senha: ' + e.message);
                return false;
            }
        }

        if (!config.userData) config.userData = {};
        if (displayName !== undefined) { config.userData.display_name = displayName; changed = true; }
        if (avatarBase64 !== null) { config.userData.avatar_url = avatarBase64; changed = true; }

        if (changed) {
            storageService.saveConfig(config);
            await supabaseService.saveConfig(config);
        }

        this.refreshHeader(config);
        notificationService.success('Sucesso', 'Perfil atualizado!');
        document.getElementById('profile-modal')?.classList.add('hidden');
        return true;
    }

    async switchWorkspace(workspaceId) {
        if (workspaceId === supabaseService.currentWorkspaceId) return;

        storageService.saveWorkspaceId(workspaceId);
        notificationService.info('Trocando Espaço', 'Carregando dados do novo ambiente...');
        
        // Reload app
        window.location.reload();
    }

    showLogin() {
        document.getElementById('login-screen')?.classList.remove('hidden');
        document.getElementById('login-screen')?.classList.add('active');
        document.getElementById('app-screen')?.classList.add('hidden');
        document.getElementById('app-screen')?.classList.remove('active');
    }

    showApp() {
        document.getElementById('login-screen')?.classList.add('hidden');
        document.getElementById('login-screen')?.classList.remove('active');
        document.getElementById('app-screen')?.classList.remove('hidden');
        document.getElementById('app-screen')?.classList.add('active');
    }

    async initializeApp() {
        try {
            // 1. Get Workspace
            const workspaces = await supabaseService.getWorkspaces();
            if (!workspaces || workspaces.length === 0) {
                notificationService.error('Erro', 'Workspace não encontrado. Contate o suporte.');
                return;
            }

            // Seleção inteligente de Workspace (Persistência)
            const savedWsId = storageService.getWorkspaceId();
            const preferredWs = workspaces.find(w => w.workspace_id === savedWsId) || workspaces[0];
            
            supabaseService.currentWorkspaceId = preferredWs.workspace_id;
            storageService.saveWorkspaceId(preferredWs.workspace_id);

            // Guardar a lista para o seletor na UI
            this.availableWorkspaces = workspaces;
            
            // 2. Load Config within Workspace
            const config = await this.loadConfig();
            window.app.config = config;

            // 3. Process data
            const processed = await window.app.dashboardController.autoProcessBills(config);
            if (processed) {
                notificationService.success('Sucesso', 'Contas automáticas processadas!');
            }

            await window.app.dashboardController.loadData(config);
            
            // Render profile switcher
            window.app?.familyController?.renderProfileSwitcher(config);

            setTimeout(() => this.checkAlerts(config), 1000);

            if (!storageService.getTourCompleted()) {
                setTimeout(() => window.app?.startTour(), 1500);
            }
        } catch (e) {
            console.error('Initialization error:', e);
            notificationService.error('Erro', 'Falha ao carregar workspace.');
        }
    }

    async loadConfig() {
        let config = new UserConfig();

        try {
            const cloudConfig = await supabaseService.loadConfig();
            if (cloudConfig) {
                config = cloudConfig;
                // Add workspace ID from context
                config.workspace_id = supabaseService.currentWorkspaceId;
                storageService.saveConfig(config);
            }
        } catch (e) {
            console.warn('Error loading cloud config:', e);
            // Fallback to storage if offline
            const local = storageService.loadConfig();
            if (local) config = local;
        }

        if (!config.wallets || config.wallets.length === 0) {
            config.wallets = [{ id: 'w_default', name: 'Conta Principal', initialBalance: 0 }];
        }

        return config;
    }

    checkAlerts(config) {
        if (storageService.getAlertsChecked()) return;

        const today = new Date();
        config.cards.forEach(card => {
            if (card.dueDay) {
                const dueThisMonth = new Date(today.getFullYear(), today.getMonth(), card.dueDay);
                const diffDays = Math.ceil((dueThisMonth - today) / (1000 * 60 * 60 * 24));
                if (diffDays >= 0 && diffDays <= 3) {
                    notificationService.warning('Fatura Vencendo', 
                        `O cartão ${card.name} vence em ${diffDays === 0 ? 'hoje' : diffDays + ' dias'}.`);
                }
            }
        });

        storageService.setAlertsChecked(true);
    }
}

export default AuthController;
