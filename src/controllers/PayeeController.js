import { Payee } from '../models/index.js';
import { supabaseService } from '../services/supabaseService.js';
import { notificationService } from '../services/notificationService.js';

export default class PayeeController {
    constructor() {
        this.payees = [];
    }

    renderManager(config) {
        const container = document.getElementById('payee-manager-list');
        if (!container) return;

        this.payees = config.payees || [];

        if (this.payees.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhum favorecido cadastrado.</div>';
            return;
        }

        container.innerHTML = this.payees.map(p => `
            <div class="config-item">
                <div class="config-info">
                    <strong>${p.name}</strong>
                    <span class="subtitle">${p.defaultCategory} ${p.document ? '• ' + p.document : ''}</span>
                </div>
                <div class="config-actions">
                    <button class="btn-icon small" onclick="window.app.payeeController.delete('${p.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    async add(config) {
        const name = document.getElementById('payee-new-name')?.value?.trim();
        const doc = document.getElementById('payee-new-doc')?.value?.trim();
        const cat = document.getElementById('payee-new-cat')?.value;

        if (!name) {
            notificationService.warning('Aviso', 'O nome do favorecido é obrigatório.');
            return;
        }

        const newPayee = new Payee({
            name,
            document: doc,
            defaultCategory: cat
        });

        config.payees.push(newPayee);
        
        const success = await supabaseService.saveConfig(config);
        if (success) {
            notificationService.success('Sucesso', 'Favorecido cadastrado.');
            document.getElementById('payee-form')?.reset();
            this.renderManager(config);
            this.updateAutocomplete(config);
        } else {
            notificationService.error('Erro', 'Não foi possível salvar.');
        }
    }

    async delete(id) {
        if (!confirm('Deseja excluir este favorecido?')) return;

        const config = window.app.config;
        config.payees = config.payees.filter(p => p.id !== id);

        const success = await supabaseService.saveConfig(config);
        if (success) {
            notificationService.success('Sucesso', 'Favorecido removido.');
            this.renderManager(config);
            this.updateAutocomplete(config);
        }
    }

    updateAutocomplete(config) {
        const datalist = document.getElementById('payees-datalist');
        if (!datalist) return;

        datalist.innerHTML = config.payees.map(p => `
            <option value="${p.name}" data-id="${p.id}" data-category="${p.defaultCategory}">
        `).join('');
    }

    getPayeeByName(config, name) {
        return config.payees.find(p => p.name.toLowerCase() === name.toLowerCase());
    }

    async ensurePayee(config, name) {
        let payee = this.getPayeeByName(config, name);
        if (!payee && name.trim() !== '') {
            payee = new Payee({ name: name.trim() });
            config.payees.push(payee);
            await supabaseService.saveConfig(config);
            this.updateAutocomplete(config);
        }
        return payee;
    }
}
