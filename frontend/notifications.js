// 🔔 SISTEMA DE NOTIFICACIONES TOAST
// Agregar este código a main.js o crear notifications.js

class ToastManager {
    constructor() {
        this.container = this.createContainer();
        this.toasts = [];
    }

    createContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    show(message, type = 'info', duration = 3000) {
        const toast = this.createToast(message, type);
        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Auto remove
        setTimeout(() => {
            this.remove(toast);
        }, duration);

        // Manual close on click
        toast.addEventListener('click', () => {
            this.remove(toast);
        });

        return toast;
    }

    createToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌', 
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; color:#000;">
                <span style="font-size: 16px;">${icons[type] || icons.info}</span>
                <span style="flex: 1; color:#000;">${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="background: none; border: none; font-size: 18px; cursor: pointer; opacity: 0.7; color:#000;">×</button>
            </div>
        `;

        return toast;
    }

    remove(toast) {
        if (toast && toast.parentNode) {
            toast.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                this.toasts = this.toasts.filter(t => t !== toast);
            }, 300);
        }
    }

    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

// Crear instancia global
window.Toast = new ToastManager();

// CSS para animación de salida
const style = document.createElement('style');
style.textContent = `
@keyframes slideOutRight {
    to {
        transform: translateX(100%) scale(0.8);
        opacity: 0;
    }
}
`;
document.head.appendChild(style);

// Funciones de conveniencia globales
window.showToast = (message, type, duration) => Toast.show(message, type, duration);
window.showSuccess = (message) => Toast.success(message);
window.showError = (message) => Toast.error(message);
window.showWarning = (message) => Toast.warning(message);
window.showInfo = (message) => Toast.info(message);