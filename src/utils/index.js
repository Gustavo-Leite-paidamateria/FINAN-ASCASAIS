export const formatCurrency = (value) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const formatDate = (date, format = 'short') => {
    if (!(date instanceof Date)) date = new Date(date);
    
    if (format === 'long') {
        return date.toLocaleDateString('pt-BR', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
    }
    
    return date.toLocaleDateString('pt-BR');
};

export const formatMonthYear = (date) => {
    if (!(date instanceof Date)) date = new Date(date);
    return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
};

export const getMonthDateRange = (date) => {
    if (!(date instanceof Date)) date = new Date(date);
    
    const year = date.getFullYear();
    const month = date.getMonth();
    
    return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0, 23, 59, 59)
    };
};

export const getDaysInMonth = (date) => {
    if (!(date instanceof Date)) date = new Date(date);
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};

export const generateId = (prefix = '') => {
    return `${prefix}${Date.now()}`;
};

export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

export const cloneObject = (obj) => JSON.parse(JSON.stringify(obj));

export { SpiritualMentor } from './SpiritualMentor.js';
