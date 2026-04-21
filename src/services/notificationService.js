class NotificationService {
    constructor() {
        this.container = null;
    }

    init() {
        this.container = document.getElementById('toast-container');
    }

    show(title, message, type = 'info') {
        if (!this.container) this.init();
        if (!this.container) {
            console.warn('Toast container not found');
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            warning: '⚠️',
            danger: '❌',
            success: '✅',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                <h4>${title}</h4>
                <p>${message}</p>
            </div>
            <button class="toast-close"><i class="fa-solid fa-xmark"></i></button>
        `;

        this.container.appendChild(toast);

        const closeBtn = toast.querySelector('.toast-close');
        const dismiss = () => {
            toast.style.animation = 'toastFadeOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        };

        closeBtn.addEventListener('click', dismiss);
        setTimeout(dismiss, 5000);
    }

    success(title, message) {
        this.show(title, message, 'success');
    }

    error(title, message) {
        this.show(title, message, 'danger');
    }

    warning(title, message) {
        this.show(title, message, 'warning');
    }

    info(title, message) {
        this.show(title, message, 'info');
    }
}

export const notificationService = new NotificationService();
