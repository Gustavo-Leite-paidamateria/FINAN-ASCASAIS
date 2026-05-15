import { supabaseService, notificationService, storageService } from '../services/index.js';
import { ManagedProfile } from '../models/index.js';

export default class FamilyController {
    constructor() {
        this.activeTab = 'members';
    }

    async render(config) {
        this.renderMembers();
        this.renderProfiles(config);
        this.renderProfileSwitcher(config);
    }

    async renderMembers() {
        const container = document.getElementById('members-list');
        const shareContainer = document.getElementById('share-workspace-info');
        if (!container) return;

        if (shareContainer) {
            shareContainer.innerHTML = `
                <div class="share-box">
                    <p style="font-size: 0.8rem; color: var(--text-sec);">Link de convite do espaco atual:</p>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <input id="generated-invite-link" type="text" value="${this.buildInviteUrl()}" readonly style="flex: 1; font-family: monospace; font-size: 0.75rem; background: rgba(0,0,0,0.2);">
                        <button onclick="window.app.familyController.copyInviteLink()" class="btn-primary" style="padding: 0 15px;" title="Copiar link">
                            <i class="fa-solid fa-copy"></i>
                        </button>
                    </div>
                    <p style="font-size: 0.72rem; color: var(--text-sec); margin-top: 8px;">Digite o e-mail autorizado abaixo; o app gera um link valido por 7 dias para voce enviar.</p>
                </div>
            `;
        }

        try {
            const members = await supabaseService.getWorkspaceMembers();
            container.innerHTML = members.map(m => `
                <div class="config-item">
                    <div class="config-info">
                        <strong>${m.user_id}</strong>
                        <span class="subtitle">Papel: ${m.role === 'owner' ? 'Dono' : 'Membro'}</span>
                    </div>
                </div>
            `).join('') || '<div class="empty-state">Nenhum membro encontrado.</div>';
        } catch (e) {
            console.error('Error rendering members:', e);
            container.innerHTML = '<div class="empty-state">Nao foi possivel carregar os membros.</div>';
        }
    }

    renderMembersList(config) {
        this.renderProfiles(config);
    }

    async joinExistingWorkspace() {
        const idInput = document.getElementById('join-workspace-id');
        const workspaceId = idInput?.value?.trim();
        if (!workspaceId) return;

        notificationService.info('Aguarde', 'Entrando no espaco...');

        try {
            const { data: { user } } = await supabaseService.client.auth.getUser();

            const { error } = await supabaseService.client
                .from('workspace_members')
                .insert({
                    workspace_id: workspaceId,
                    user_id: user.id,
                    role: 'member'
                });

            if (error) throw error;

            notificationService.success('Sucesso!', 'Voce agora faz parte deste espaco.');
            idInput.value = '';
            setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
            console.error('Error joining workspace:', e);
            notificationService.error('Erro', 'Codigo invalido ou sem permissao.');
        }
    }

    renderProfiles(config) {
        const container = document.getElementById('profiles-list');
        const summaryContainer = document.getElementById('family-members-list');
        if (!container) return;

        const profiles = config.managedProfiles || [];

        const html = profiles.map(p => `
            <div class="config-item">
                <div class="config-info">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background: ${p.color};"></div>
                        <strong>${p.name}</strong>
                    </div>
                </div>
                <button onclick="window.app.familyController.deleteProfile('${p.id}')" class="btn-mini-icon danger">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `).join('');

        container.innerHTML = html || '<div class="empty-state">Nenhum perfil dependente.</div>';
        if (summaryContainer) summaryContainer.innerHTML = html;
    }

    renderProfileSwitcher(config) {
        const select = document.getElementById('profile-selector');
        if (!select) return;

        const profiles = config?.managedProfiles || [];
        if (supabaseService.currentProfileId && !profiles.some(p => p.id === supabaseService.currentProfileId)) {
            supabaseService.currentProfileId = null;
            storageService.saveProfileId(null);
        }

        let options = `<option value="casal" ${!supabaseService.currentProfileId ? 'selected' : ''}>Casal (Todos)</option>`;
        profiles.forEach(p => {
            options += `<option value="${p.id}" ${supabaseService.currentProfileId === p.id ? 'selected' : ''}>${p.name}</option>`;
        });

        select.innerHTML = options;
    }

    async addProfile(config) {
        const nameInput = document.getElementById('new-profile-name');
        const name = nameInput?.value?.trim();
        if (!name) return;

        const newProfile = new ManagedProfile({
            name,
            workspace_id: supabaseService.currentWorkspaceId
        });

        if (!config.managedProfiles) config.managedProfiles = [];
        config.managedProfiles.push(newProfile);

        try {
            const { error } = await supabaseService.client
                .from('managed_profiles')
                .insert({
                    id: newProfile.id,
                    workspace_id: newProfile.workspace_id,
                    name: newProfile.name,
                    color: newProfile.color
                });

            if (error) throw error;

            await supabaseService.saveConfig(config);
            notificationService.success('Sucesso', 'Perfil criado!');
            nameInput.value = '';
            this.render(config);
        } catch (e) {
            console.error('Error adding profile:', e);
            notificationService.error('Erro', 'Falha ao criar perfil.');
        }
    }

    async deleteProfile(id) {
        if (!confirm('Excluir este perfil? As transacoes vinculadas a ele continuarao no workspace geral.')) return;

        const config = window.app.config;
        config.managedProfiles = config.managedProfiles.filter(p => p.id !== id);

        try {
            await supabaseService.client.from('managed_profiles').delete().eq('id', id);
            await supabaseService.saveConfig(config);
            this.render(config);
        } catch (e) {
            console.error('Error deleting profile:', e);
        }
    }

    async switchProfile(profileId) {
        supabaseService.currentProfileId = profileId === 'casal' ? null : profileId;
        storageService.saveProfileId(supabaseService.currentProfileId);
        notificationService.info('Contexto alterado', `Agora voce esta vendo os dados de: ${this.getProfileName(profileId)}`);

        await window.app.dashboardController.loadData(window.app.config);
        if (window.app.currentView === 'calendar-view') window.app.renderCalendar();
    }

    async sendInvite() {
        const email = document.getElementById('invite-email')?.value?.trim();
        if (!email) return;

        notificationService.info('Aguarde', 'Criando convite...');

        try {
            const invite = await supabaseService.createWorkspaceInvitation(email);
            const link = this.buildInviteUrl(invite.token);
            const linkInput = document.getElementById('generated-invite-link');
            if (linkInput) linkInput.value = link;
            await this.copyText(link);
            notificationService.success('Convite criado', `Link de convite para ${email} copiado.`);
            document.getElementById('invite-email').value = '';
        } catch (e) {
            console.error('Error sending invite:', e);
            notificationService.error('Erro', 'Falha ao criar convite. Confira se a migration de convites foi aplicada.');
        }
    }

    buildInviteUrl(token = '') {
        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        if (token) url.searchParams.set('invite', token);
        url.hash = '';
        return url.toString();
    }

    async copyInviteLink() {
        const link = document.getElementById('generated-invite-link')?.value;
        if (!link) return;
        await this.copyText(link);
        notificationService.success('Copiado', 'Link copiado para a area de transferencia.');
    }

    async copyText(text) {
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
            } catch (e) {
                console.warn('Clipboard unavailable:', e);
            }
        }
    }

    getProfileName(profileId) {
        if (profileId === 'casal') return 'Casal';
        const profile = (window.app?.config?.managedProfiles || []).find(p => p.id === profileId);
        return profile?.name || 'Perfil selecionado';
    }

    setTab(tab) {
        this.activeTab = tab;
        document.getElementById('family-tab-members')?.classList.toggle('active', tab === 'members');
        document.getElementById('family-tab-profiles')?.classList.toggle('active', tab === 'profiles');
        document.getElementById('family-content-members')?.classList.toggle('hidden', tab !== 'members');
        document.getElementById('family-content-profiles')?.classList.toggle('hidden', tab !== 'profiles');
    }
}
