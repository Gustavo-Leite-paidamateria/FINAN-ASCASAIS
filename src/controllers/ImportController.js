import { ImportService, supabaseService, notificationService } from '../services/index.js';
import { formatCurrency } from '../utils/index.js';

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
            } else {
                notificationService.error('Erro', 'Formato de arquivo não suportado. Use .ofx ou .qfx');
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
        
        // Match Payee
        const payee = config.payees.find(p => desc.includes(p.name.toLowerCase()));
        if (payee) {
            transaction.payee_id = payee.id;
            transaction.categoria = payee.defaultCategory || 'Outros';
        } else {
            transaction.categoria = 'Outros';
        }

        // Selected by default if not a duplicate
        transaction.selected = !transaction.possibleDuplicate;
    }

    renderReviewTable(config) {
        const tbody = document.getElementById('import-table-body');
        if (!tbody) return;

        const categories = ["Mercado", "Alimentação", "Transporte", "Casa", "Lazer", "Saúde", "Pets", "Compras", "Educação", "Viagem", "Presentes", "Investimentos", "Assinaturas", "Outros"];

        tbody.innerHTML = this.pendingTransactions.map((t, index) => `
            <tr class="${t.possibleDuplicate ? 'duplicate-row' : ''}">
                <td>
                    <input type="checkbox" ${t.selected ? 'checked' : ''} 
                        onchange="window.app.importController.toggleSelect(${index})">
                </td>
                <td>${new Date(t.data).toLocaleDateString('pt-BR')}</td>
                <td>
                    <input type="text" value="${t.descricao}" class="edit-inline"
                        onchange="window.app.importController.updateField(${index}, 'descricao', this.value)">
                </td>
                <td>
                    <select onchange="window.app.importController.updateField(${index}, 'categoria', this.value)" class="edit-inline">
                        ${categories.map(c => `<option value="${c}" ${t.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </td>
                <td class="${t.tipo === 'Despesa' ? 'expense' : 'income'}">
                    ${formatCurrency(t.valor)}
                </td>
                <td>
                    ${t.possibleDuplicate ? '<span class="badge warning">⚠️ Duplicata?</span>' : ''}
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
                conta_id: walletId
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
