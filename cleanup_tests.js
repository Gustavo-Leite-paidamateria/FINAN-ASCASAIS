import { supabaseService } from './src/services/supabaseService.js';

async function cleanup() {
    const start = new Date(2026, 3, 1); // Abril é mês 3 (0-indexed)
    const end = new Date(2026, 3, 30, 23, 59, 59);
    
    console.log(`Limpando transações entre ${start.toISOString()} e ${end.toISOString()}...`);
    
    try {
        await supabaseService.deleteTransactionsByRange(start, end);
        console.log('Sucesso! Transações de Abril/2026 removidas.');
    } catch (e) {
        console.error('Erro na limpeza:', e);
    }
}

cleanup();
