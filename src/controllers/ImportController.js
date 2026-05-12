import { ImportService, supabaseService, notificationService } from '../services/index.js';
import { formatCurrency } from '../utils/index.js';
import { CATEGORIES, INCOME_CATEGORIES } from '../models/index.js';

export default class ImportController {
    constructor() {
        this.pendingTransactions = [];
        this.targetWalletId = null;
    }

    async handleFileUpload(file, config) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target.result;
            let extracted = [];

            if (file.name.toLowerCase().endsWith('.ofx') || file.name.toLowerCase().endsWith('.qfx')) {
                extracted = ImportService.parseOFX(content);
            } else if (file.name.toLowerCase().endsWith('.csv')) {
                extracted = ImportService.parseCSV(content);
            } else {
                notificationService.error('Erro', 'Formato não suportado. Use .ofx, .qfx ou .csv');
                return;
            }

            if (extracted.length === 0) {
                notificationService.warning('Aviso', 'Nenhuma transação encontrada no arquivo.');
                return;
            }

            // Detect duplicates
            const allTransactions = await supabaseService.fetchAllTransactions();
            this.pendingTransactions = ImportService.detectDuplicates(extracted, allTransactions);
            
            // Auto-match categories and payees
            this.pendingTransactions.forEach(t => this.autoMatch(t, config));

            this.renderReviewTable(config);
            document.getElementById('import-review-section').classList.remove('hidden');
            document.getElementById('import-drop-zone').classList.add('hidden');
        };
        reader.readAsText(file);
    }

    autoMatch(transaction, config) {
        const desc = transaction.descricao.toLowerCase();
        
        // Identify Type (Income/Expense)
        transaction.tipo = transaction.valor >= 0 ? 'Receita' : 'Despesa';
        transaction.valor = Math.abs(transaction.valor); // Store as absolute value

        // Match Payee from Memory
        const payee = config.payees.find(p => desc.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(desc));
        if (payee) {
            transaction.payee_id = payee.id;
            transaction.categoria = payee.defaultCategory || 'Outros';
            transaction.savePayee = false; // Already exists
        } else {
            transaction.categoria = 'Outros';
            transaction.savePayee = true; // Suggest saving new ones
        }

        transaction.notas = '';
        transaction.selected = !transaction.possibleDuplicate;
    }

    renderReviewTable(config) {
        const tbody = document.getElementById('import-table-body');
        if (!tbody) return;

        const allCategories = [...new Set([...CATEGORIES, ...INCOME_CATEGORIES])];

        tbody.innerHTML = this.pendingTransactions.map((t, index) => `
            <tr class="${t.possibleDuplicate ? 'duplicate-row' : ''}">
                <td style="text-align:center;">
                    <input type="checkbox" ${t.selected ? 'checked' : ''} 
                        onchange="window.app.importController.toggleSelect(${index})">
                </td>
                <td style="font-size:0.75rem;">${new Date(t.data).toLocaleDateString('pt-BR')}</td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <input type="text" value="${t.descricao}" class="edit-inline" style="font-weight:600;"
                            onchange="window.app.importController.updateField(${index}, 'descricao', this.value)">
                        <input type="text" placeholder="Adicionar nota..." class="edit-inline-sub" value="${t.notas || ''}"
                            onchange="window.app.importController.updateField(${index}, 'notas', this.value)">
                    </div>
                </td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <select onchange="window.app.importController.updateField(${index}, 'categoria', this.value)" class="edit-inline-select">
                            ${allCategories.map(c => `<option value="${c}" ${t.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                        <label style="font-size:0.6rem; display:flex; align-items:center; gap:4px; opacity:0.8; cursor:pointer;">
                            <input type="checkbox" ${t.savePayee ? 'checked' : ''} 
                                onchange="window.app.importController.updateField(${index}, 'savePayee', this.checked)">
                            Salvar Favorecido
                        </label>
                    </div>
                </td>
                <td class="${t.tipo === 'Despesa' ? 'expense' : 'income'}" style="text-align:right; font-weight:600;">
                    ${t.tipo === 'Despesa' ? '-' : '+'}${formatCurrency(t.valor)}
                </td>
                <td>
                    <select onchange="window.app.importController.updateField(${index}, 'tipo', this.value)" class="edit-inline-select-mini">
                        <option value="Despesa" ${t.tipo === 'Despesa' ? 'selected' : ''}>💸 Desp.</option>
                        <option value="Receita" ${t.tipo === 'Receita' ? 'selected' : ''}>💰 Rec.</option>
                    </select>
                </td>
            </tr>
        `).join('');

        document.getElementById('import-count').textContent = `${this.pendingTransactions.filter(t => t.selected).length} selecionadas`;
    }

    toggleSelect(index) {
        this.pendingTransactions[index].selected = !this.pendingTransactions[index].selected;
        this.updateCount();
    }

    updateField(index, field, value) {
        this.pendingTransactions[index][field] = value;
    }

    updateCount() {
        document.getElementById('import-count').textContent = `${this.pendingTransactions.filter(t => t.selected).length} selecionadas`;
    }

    async processImport(config) {
        const toImport = this.pendingTransactions.filter(t => t.selected);
        if (toImport.length === 0) {
            notificationService.warning('Aviso', 'Nenhuma transação selecionada para importação.');
            return;
        }

        const walletId = document.getElementById('import-wallet-select').value;
        if (!walletId) {
            notificationService.error('Erro', 'Selecione a conta de destino.');
            return;
        }

        // 1. Save New Payees marked by user
        for (const t of toImport) {
            if (t.savePayee && !t.payee_id) {
                const newPayee = {
                    id: 'p_' + Date.now() + Math.random().toString(36).substr(2, 5),
                    name: t.descricao,
                    defaultCategory: t.categoria
                };
                config.payees.push(newPayee);
                t.payee_id = newPayee.id;
            }
        }
        
        // Sync config if new payees were added
        if (toImport.some(t => t.savePayee)) {
            storageService.saveConfig(config);
            await supabaseService.saveConfig(config);
        }

        // 2. Prepare Transaction Records
        const records = toImport.map(t => ({
            tipo: t.tipo,
            valor: t.valor,
            descricao: t.descricao,
            categoria: t.categoria,
            data: t.data,
            forma_pagamento: 'pix', // Default for bank import
            status: 'Pago',
            observacoes: JSON.stringify({
                owner: 'ambos',
                conta_id: walletId,
                nota: t.notas || ''
            }),
            payee_id: t.payee_id || null
        }));

        try {
            await supabaseService.insertTransaction(records);
            notificationService.success('Sucesso', `${records.length} transações importadas!`);
            this.closeModal();
            window.app.dashboardController.loadData(config);
        } catch (e) {
            console.error('Error importing:', e);
            notificationService.error('Erro', 'Falha ao importar transações.');
        }
    }

    openModal(config) {
        const modal = document.getElementById('import-modal');
        const walletSelect = document.getElementById('import-wallet-select');
        
        if (walletSelect) {
            walletSelect.innerHTML = '<option value="">Selecione a Conta...</option>' + 
                config.wallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        }

        document.getElementById('import-review-section').classList.add('hidden');
        document.getElementById('import-drop-zone').classList.remove('hidden');
        modal.classList.remove('hidden');
    }

    closeModal() {
        document.getElementById('import-modal').classList.add('hidden');
        this.pendingTransactions = [];
    }
}
