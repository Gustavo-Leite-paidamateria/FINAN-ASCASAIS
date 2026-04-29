import { formatCurrency } from '../utils/index.js';

export default class CalendarController {
    constructor() {
        this.currentDate = new Date();
        this.viewMode = 'grid'; // 'grid' or 'list'
    }

    setView(mode) {
        this.viewMode = mode;
        const gridBtn = document.getElementById('cal-view-grid');
        const listBtn = document.getElementById('cal-view-list');
        
        if (gridBtn) gridBtn.classList.toggle('active', mode === 'grid');
        if (listBtn) listBtn.classList.toggle('active', mode === 'list');
        
        window.app.renderCalendar();
    }

    render(config, transactions) {
        const container = document.getElementById('calendar-grid-container');
        if (!container) return;

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        // Update display
        const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(this.currentDate);
        const display = document.getElementById('calendar-month-display');
        if (display) display.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;

        if (this.viewMode === 'grid') {
            this.renderGrid(config, transactions, container, year, month);
        } else {
            this.renderList(config, transactions, container, year, month);
        }
    }

    renderGrid(config, transactions, container, year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const prevLastDay = new Date(year, month, 0);
        
        const firstDayIndex = firstDay.getDay(); 
        const lastDate = lastDay.getDate();
        const prevLastDate = prevLastDay.getDate();

        let daysHtml = '';

        // Previous month days
        for (let x = firstDayIndex; x > 0; x--) {
            daysHtml += `<div class="calendar-day prev-date">${prevLastDate - x + 1}</div>`;
        }

        // Current month days
        const today = new Date();
        for (let i = 1; i <= lastDate; i++) {
            const date = new Date(year, month, i);
            const isToday = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const dateStr = date.toISOString().split('T')[0];
            
            const events = this.getEventsForDate(date, config, transactions);
            const eventsHtml = events.slice(0, 3).map(e => `
                <div class="calendar-event ${e.type}" title="${e.title}">
                    ${e.title.substring(0, 10)}
                </div>
            `).join('');

            if (events.length > 3) {
                daysHtml += `
                    <div class="calendar-day ${isToday ? 'today' : ''}" onclick="window.app.calendarController.showDayDetails('${dateStr}')">
                        <span class="day-number">${i}</span>
                        <div class="day-events">${eventsHtml}</div>
                        <div style="font-size: 0.6rem; color: var(--text-sec); text-align: center;">+ ${events.length - 3} mais</div>
                    </div>
                `;
            } else {
                daysHtml += `
                    <div class="calendar-day ${isToday ? 'today' : ''}" onclick="window.app.calendarController.showDayDetails('${dateStr}')">
                        <span class="day-number">${i}</span>
                        <div class="day-events">${eventsHtml}</div>
                    </div>
                `;
            }
        }

        // Next month days
        const totalSlots = 42;
        const currentSlots = firstDayIndex + lastDate;
        const nextDays = totalSlots - currentSlots;
        for (let j = 1; j <= nextDays; j++) {
            daysHtml += `<div class="calendar-day next-date">${j}</div>`;
        }

        container.innerHTML = `
            <div class="calendar-weekdays">
                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
            </div>
            <div class="calendar-days-grid">
                ${daysHtml}
            </div>
        `;
    }

    renderList(config, transactions, container, year, month) {
        const lastDate = new Date(year, month + 1, 0).getDate();
        let listHtml = '';

        for (let i = 1; i <= lastDate; i++) {
            const date = new Date(year, month, i);
            const events = this.getEventsForDate(date, config, transactions);
            
            if (events.length > 0) {
                const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
                const fullDateStr = date.toISOString().split('T')[0];
                
                listHtml += `
                    <div class="day-list-item" onclick="window.app.calendarController.showDayDetails('${fullDateStr}')" style="padding: 12px; border-bottom: 1px solid var(--glass-border); display: flex; gap: 16px; align-items: start; cursor: pointer;">
                        <div style="min-width: 60px; text-align: center;">
                            <div style="font-size: 0.7rem; color: var(--text-sec); text-transform: uppercase;">${dateStr.split(' ')[0]}</div>
                            <div style="font-size: 1.2rem; font-weight: bold; color: var(--accent);">${i}</div>
                        </div>
                        <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
                            ${events.map(e => `
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <div class="calendar-event ${e.type}" style="width: 8px; height: 8px; border-radius: 50%; padding: 0;"></div>
                                        <span style="font-size: 0.85rem;">${e.title}</span>
                                    </div>
                                    <span style="font-size: 0.85rem; font-weight: 500; color: ${e.type.includes('receita') ? 'var(--income)' : 'var(--expense)'};">
                                        ${formatCurrency(e.amount)}
                                    </span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }

        if (!listHtml) {
            listHtml = '<div class="empty-state">Nenhum evento financeiro este mês.</div>';
        }

        container.innerHTML = `<div class="calendar-list-view">${listHtml}</div>`;
    }

    getEventsForDate(date, config, transactions) {
        const events = [];
        const dateStr = date.toISOString().split('T')[0];

        // 1. Transactions
        transactions.forEach(t => {
            if (t.data.split('T')[0] === dateStr) {
                events.push({
                    type: t.tipo.toLowerCase(), 
                    title: t.descricao,
                    amount: parseFloat(t.valor)
                });
            }
        });

        // 2. Scheduled Bills
        config.scheduledBills.forEach(b => {
            if (b.isActiveForDate(date) && b.dueDay === date.getDate()) {
                const isPaid = b.isPaidForDate(date);
                events.push({
                    type: isPaid ? 'scheduled-paid' : 'scheduled-pending',
                    title: `📌 ${b.name}`,
                    amount: b.amount
                });
            }
        });

        // 3. Card Bills
        config.cards.forEach(c => {
            if (c.dueDay === date.getDate()) {
                events.push({
                    type: 'card-bill',
                    title: `💳 Fatura ${c.name}`,
                    amount: c.getInvoiceTotal(transactions)
                });
            }
        });

        return events;
    }

    showDayDetails(dateStr) {
        const date = new Date(dateStr + 'T12:00:00');
        const config = window.app.config;
        const transactions = window.app.dashboardController.transactions;
        const events = this.getEventsForDate(date, config, transactions);

        const title = document.getElementById('day-details-title');
        const content = document.getElementById('day-details-content');
        const modal = document.getElementById('day-details-modal');
        const closeBtn = document.getElementById('close-day-details');
        const addBtn = document.getElementById('day-add-trans-btn');

        if (title) title.textContent = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

        if (content) {
            if (events.length === 0) {
                content.innerHTML = '<div class="empty-state">Nada registrado para este dia.</div>';
            } else {
                content.innerHTML = events.map(e => `
                    <div class="trans-row" style="padding: 12px 0; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between;">
                        <div>
                            <div style="font-weight: 500;">${e.title}</div>
                            <div class="subtitle" style="text-transform: capitalize;">${e.type.replace('-', ' ')}</div>
                        </div>
                        <div style="font-weight: bold; color: ${e.type.includes('receita') ? 'var(--income)' : 'var(--expense)'};">
                            ${formatCurrency(e.amount)}
                        </div>
                    </div>
                `).join('');
            }
        }

        if (modal) modal.classList.remove('hidden');

        if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');
        if (addBtn) addBtn.onclick = () => {
            modal.classList.add('hidden');
            window.app.transactionController.openModal(config);
            document.getElementById('trans-date').value = dateStr;
        };
    }

    navigate(months) {
        this.currentDate.setMonth(this.currentDate.getMonth() + months);
        window.app.renderCalendar();
    }
}
