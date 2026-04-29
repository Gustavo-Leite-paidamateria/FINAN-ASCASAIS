import { UserConfig } from '../models/index.js';

const STORAGE_KEYS = {
    CONFIG: 'finance_app_config',
    USER: 'finance_user',
    ALERTS_CHECKED: 'alerts_checked',
    THEME: 'finance_app_theme',
    TOUR_COMPLETED: 'tour_completed'
};

class StorageService {
    saveConfig(config) {
        const data = config instanceof UserConfig ? config.toJSON() : config;
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(data));
    }

    loadConfig() {
        const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
        if (!saved) return null;
        try {
            return UserConfig.fromJSON(JSON.parse(saved));
        } catch (e) {
            console.error('Error parsing stored config:', e);
            return null;
        }
    }

    saveUser(email) {
        localStorage.setItem(STORAGE_KEYS.USER, email);
    }

    getUser() {
        return localStorage.getItem(STORAGE_KEYS.USER);
    }

    clearUser() {
        localStorage.removeItem(STORAGE_KEYS.USER);
    }

    isAuthenticated() {
        return !!this.getUser();
    }

    setAlertsChecked(checked = true) {
        localStorage.setItem(STORAGE_KEYS.ALERTS_CHECKED, checked.toString());
    }

    getAlertsChecked() {
        return localStorage.getItem(STORAGE_KEYS.ALERTS_CHECKED) === 'true';
    }

    setTheme(theme) {
        localStorage.setItem(STORAGE_KEYS.THEME, theme);
    }

    getTheme() {
        return localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
    }

    setTourCompleted(value = true) {
        localStorage.setItem(STORAGE_KEYS.TOUR_COMPLETED, value.toString());
    }

    getTourCompleted() {
        return localStorage.getItem(STORAGE_KEYS.TOUR_COMPLETED) === 'true';
    }

    clearAll() {
        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    }
}

export const storageService = new StorageService();
