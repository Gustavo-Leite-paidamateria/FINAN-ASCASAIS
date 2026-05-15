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
            
            let msg = "Verifique o e-mail ou a senha.";
            if (error.message?.includes('rate limit') || error.status === 429) {
                msg = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
            } else if (error.message?.includes('Invalid login credentials')) {
                msg = "Credenciais inválidas. Verifique o e-mail e a senha.";
            }

            if (errDiv) {
                errDiv.textContent = msg;
            }
            notificationService.error('Erro', msg);
            return false;
        }
    }

    async register(email, password) {
        try {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                const msg = 'E-mail inválido. Use um formato válido (ex: nome@provedor.com).';
                const errDiv = document.getElementById('login-error');
                if (errDiv) errDiv.textContent = msg;
                notificationService.error('Erro', msg);
                return false;
            }

            if (password.length < 6) {
                const msg = 'Senha deve ter no mínimo 6 caracteres.';
                const errDiv = document.getElementById('login-error');
                if (errDiv) errDiv.textContent = msg;
                notificationService.error('Erro', msg);
                return false;
            }

            const authData = await supabaseService.registerUser(email, password);

            if(authData.user && authData.user.identities && authData.user.identities.length === 0) {
                 const msg = 'Este e-mail já está em uso.';
                 const errDiv = document.getElementById('login-error');
                 if (errDiv) errDiv.textContent = msg;
                 notificationService.error('Erro', msg);
                 return false;
            }
            // Supabase auto-logs in on signup by default if email confirmation is disabled
            storageService.saveUser(email);
            this.showApp();
            await this.initializeApp();
            return true;
        } catch (error) {
            console.error("Register failed:", error);

            let msg = error.message || "Erro ao criar conta.";
            if (error.message?.includes('rate limit')) {
                msg = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
            } else if (error.message?.includes('invalid')) {
                msg = "E-mail inválido. Verifique o formato.";
            } else if (error.message?.includes('already')) {
                msg = "Este e-mail já está cadastrado.";
            }

            const errDiv = document.getElementById('login-error');
            if (errDiv) errDiv.textContent = msg;
            notificationService.error('Erro', msg);
            return false;
        }
    }

    async resetPassword(email) {
        try {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                notificationService.error('Erro', 'Preencha um e-mail válido para recuperar a senha.');
                return false;
            }

            await supabaseService.resetPassword(email);
            notificationService.success('Sucesso', 'Um link de recuperação foi enviado para o seu e-mail.');
            const errDiv = document.getElementById('login-error');
            if (errDiv) {
                errDiv.style.color = '#10b981';
                errDiv.textContent = "Link de recuperação enviado! Verifique seu e-mail.";
                setTimeout(() => { errDiv.style.color = ''; errDiv.textContent = ''; }, 5000);
            }
            return true;
        } catch (error) {
            console.error("Reset password failed:", error);
            let msg = "Erro ao enviar link de recuperação.";
            if (error.message?.includes('rate limit')) {
                msg = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
            }
            const errDiv = document.getElementById('login-error');
            if (errDiv) {
                errDiv.style.color = '#f43f5e';
                errDiv.textContent = msg;
            }
            notificationService.error('Erro', msg);
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
        const userData = this.getUserProfileData(config);
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

    async saveProfile(config, displayName, avatarBase64, newPassword, confirmPassword, selectedMentor) {
        let changed = false;

        const currentProfile = this.getUserProfileData(config);
        const nextProfile = {
            display_name: displayName ?? currentProfile.display_name ?? '',
            avatar_url: avatarBase64 !== null ? avatarBase64 : currentProfile.avatar_url || null,
            selected_mentor: selectedMentor || currentProfile.selected_mentor || 'PASTOR_TRADICIONAL'
        };

        if (selectedMentor && selectedMentor !== config.selectedMentor) {
            config.selectedMentor = selectedMentor;
            changed = true;
        }

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

        try {
            await supabaseService.updateUserMetadata(nextProfile);
        } catch (e) {
            notificationService.error('Erro', 'Falha ao atualizar perfil: ' + e.message);
            return false;
        }

        config.userData = {
            display_name: nextProfile.display_name,
            avatar_url: nextProfile.avatar_url
        };
        config.selectedMentor = nextProfile.selected_mentor;
        changed = true;

        if (changed) {
            storageService.saveConfig(config);
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
            const inviteToken = this.getInviteToken();
            if (inviteToken) {
                try {
                    const invite = await supabaseService.acceptWorkspaceInvite(inviteToken);
                    storageService.saveWorkspaceId(invite.workspace_id);
                    this.clearInviteTokenFromUrl();
                    notificationService.success('Convite aceito', 'Voce entrou no espaco compartilhado.');
                } catch (inviteError) {
                    console.error('Invite accept error:', inviteError);
                    notificationService.error('Convite invalido', 'Nao foi possivel aceitar este convite. Verifique se ele expirou ou se foi enviado para este e-mail.');
                }
            }

            // 1. Get Workspace
            let workspaces = await supabaseService.getWorkspaces();
            if (!workspaces || workspaces.length === 0) {
                console.log("Nenhum workspace encontrado, criando padrão...");
                const newWs = await supabaseService.createDefaultWorkspace();
                workspaces = [newWs];
            }

            // Seleção inteligente de Workspace (Persistência)
            const savedWsId = storageService.getWorkspaceId();
            const preferredWs = workspaces.find(w => w.workspace_id === savedWsId) || workspaces[0];
            
            supabaseService.currentWorkspaceId = preferredWs.workspace_id;
            storageService.saveWorkspaceId(preferredWs.workspace_id);

            const savedProfileId = storageService.getProfileId();
            supabaseService.currentProfileId = savedProfileId || null;

            // Guardar a lista para o seletor na UI
            this.availableWorkspaces = workspaces;
            window.app?.renderWorkspaceSwitcher();
            
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

            // Iniciar Sincronização em Tempo Real
            supabaseService.subscribeToChanges(() => {
                window.app.dashboardController.loadData(window.app.config);
                if (window.app.currentView === 'planning-view') window.app.planningController.render(window.app.config, window.app.dashboardController.transactions);
                if (window.app.currentView === 'debts-view') window.app.debtController.render(window.app.config);
            });

            if (!storageService.getTourCompleted()) {
                setTimeout(() => window.app?.startTour(), 1500);
            }

            this.checkSetupNeeded(config);
        } catch (e) {
            console.error('Initialization error:', e);
            const errorMsg = e.message || 'Erro desconhecido';
            notificationService.error('Erro', `Falha ao carregar workspace: ${errorMsg}`);
        }
    }

    getInviteToken() {
        const params = new URLSearchParams(window.location.search);
        return params.get('invite');
    }

    clearInviteTokenFromUrl() {
        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        window.history.replaceState({}, document.title, url.toString());
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

        await this.applyCurrentUserProfile(config);

        return config;
    }

    getUserProfileData(config = null) {
        const user = this.currentUser;
        const metadata = user?.user_metadata || {};
        return {
            display_name: metadata.display_name || '',
            avatar_url: metadata.avatar_url || '',
            selected_mentor: metadata.selected_mentor || 'PASTOR_TRADICIONAL'
        };
    }

    async applyCurrentUserProfile(config) {
        try {
            this.currentUser = await supabaseService.getCurrentUser();
        } catch (e) {
            console.warn('Error loading user profile metadata:', e);
        }

        const profile = this.getUserProfileData(config);
        config.userData = {
            display_name: profile.display_name,
            avatar_url: profile.avatar_url
        };
        config.selectedMentor = profile.selected_mentor;
        storageService.saveConfig(config);
    }

    checkSetupNeeded(config) {
        if (storageService.getSetupCompleted()) return;

        const hasData = config.scheduledBills.length > 0 ||
            config.debts.length > 0 ||
            config.goals.length > 0 ||
            config.cards.length > 1 ||
            config.wallets.length > 1;

        if (hasData) {
            storageService.setSetupCompleted(true);
            return;
        }

        const count = config.scheduledBills.length;
        setTimeout(() => {
            if (window.app?.setupController) {
                window.app.setupController.start(config);
            }
        }, 800);
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
