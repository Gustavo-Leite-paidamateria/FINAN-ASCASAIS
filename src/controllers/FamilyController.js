import { supabaseService, notificationService } from '../services/index.js';
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
        if (!container) return;

        try {
            const members = await supabaseService.getWorkspaces(); // This returns memberships
            container.innerHTML = members.map(m => `
                <div class="config-item">
                    <div class="config-info">
                        <strong>${m.workspaces.name}</strong>
                        <span class="subtitle">Papel: ${m.role === 'owner' ? 'Dono' : 'Membro'}</span>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            console.error('Error rendering members:', e);
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

        const currentProfileId = supabaseService.currentProfileId;
        
        let options = `<option value="casal" ${!currentProfileId ? 'selected' : ''}>👫 Casal (Todos)</option>`;
        
        (config.managedProfiles || []).forEach(p => {
            options += `<option value="${p.id}" ${currentProfileId === p.id ? 'selected' : ''}>👤 ${p.name}</option>`;
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
            // Also insert into database table for better isolation if needed later
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
        if (!confirm('Excluir este perfil? As transações vinculadas a ele continuarão no workspace geral.')) return;

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
        notificationService.info('Contexto Alterado', `Agora você está vendo os dados de: ${profileId === 'casal' ? 'Casal' : 'Perfil Selecionado'}`);
        
        // Reload all data for the new context
        await window.app.dashboardController.loadData(window.app.config);
        if (window.app.currentView === 'calendar-view') window.app.renderCalendar();
    }

    async sendInvite() {
        const email = document.getElementById('invite-email')?.value?.trim();
        if (!email) return;

        notificationService.info('Aguarde', 'Enviando convite...');
        
        // Simulating invite for now as we don't have Edge Functions yet
        // In a real app, this would call a Supabase function
        setTimeout(() => {
            notificationService.success('Convite Enviado', `Um convite foi enviado para ${email}.`);
            document.getElementById('invite-email').value = '';
        }, 1500);
    }

    setTab(tab) {
        this.activeTab = tab;
        document.getElementById('family-tab-members').classList.toggle('active', tab === 'members');
        document.getElementById('family-tab-profiles').classList.toggle('active', tab === 'profiles');
        document.getElementById('family-content-members').classList.toggle('hidden', tab !== 'members');
        document.getElementById('family-content-profiles').classList.toggle('hidden', tab !== 'profiles');
    }
}
