import { Goal } from '../models/index.js';
import { supabaseService, storageService, notificationService } from '../services/index.js';

class GoalController {
    async add(config) {
        const name = document.getElementById('goal-name')?.value?.trim();
        const target = parseFloat(document.getElementById('goal-target')?.value);
        const current = parseFloat(document.getElementById('goal-current')?.value) || 0;
        const deadlineVal = document.getElementById('goal-deadline')?.value;

        if (name && target > 0) {
            const goal = new Goal({
                name,
                target,
                current,
                deadline: deadlineVal ? new Date(deadlineVal).toISOString() : null
            });
            
            config.goals.push(goal);
            storageService.saveConfig(config);
            await supabaseService.saveConfig(config);
            
            document.getElementById('goal-modal')?.classList.add('hidden');
            document.getElementById('goal-form')?.reset();
            
            window.app?.dashboardController?.renderGoals(config);
            notificationService.success('Sucesso', 'Objetivo adicionado!');
        }
    }

    async updateProgress(config, id, newCurrent) {
        const goal = config.goals.find(g => g.id === id);
        if (goal) {
            goal.current = newCurrent;
            storageService.saveConfig(config);
            await supabaseService.saveConfig(config);
            window.app?.dashboardController?.renderGoals(config);
        }
    }

    async delete(config, id) {
        if (confirm('Deseja remover este objetivo?')) {
            config.goals = config.goals.filter(g => g.id !== id);
            storageService.saveConfig(config);
            await supabaseService.saveConfig(config);
            window.app?.dashboardController?.renderGoals(config);
        }
    }
}

export default GoalController;
