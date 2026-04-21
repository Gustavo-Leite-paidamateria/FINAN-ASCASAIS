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
            
            const userDisplay = document.getElementById('display-user-email');
            if (userDisplay) {
                userDisplay.innerHTML = `${user} <span id="user-badge" style="font-size: 0.65rem; padding: 3px 6px; border-radius: 8px; margin-left: 8px; font-weight:600; vertical-align: middle;"></span>`;
            }
            
            this.showApp();
            await this.initializeApp();
            return true;
        } catch (e) {
            console.error("Check Auth Error:", e);
            this.showLogin();
            return false;
        }
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
        const config = await this.loadConfig();
        window.app.config = config;
        
        const processed = await window.app.dashboardController.autoProcessBills(config);
        if (processed) {
            notificationService.success('Sucesso', 'Contas automáticas processadas!');
        }
        
        await window.app.dashboardController.loadData(config);
        
        setTimeout(() => this.checkAlerts(config), 1000);
    }

    async loadConfig() {
        let config = storageService.loadConfig();
        
        if (!config) {
            config = new UserConfig();
        }

        try {
            const cloudConfig = await supabaseService.loadConfig();
            if (cloudConfig) {
                config = cloudConfig;
                storageService.saveConfig(config);
            }
        } catch (e) {
            console.warn('Error loading cloud config:', e);
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
