// 💀 LOADING STATES Y SKELETON SCREENS
// Agregar este código a main.js o crear loading.js

class LoadingManager {
    constructor() {
        this.activeLoaders = new Set();
    }

    // Mostrar loading en un elemento específico
    show(element, type = 'spinner') {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        
        if (!element) return;

        const loaderId = 'loader_' + Date.now();
        this.activeLoaders.add(loaderId);

        element.style.position = 'relative';
        
        const loader = this.createLoader(type, loaderId);
        element.appendChild(loader);

        return loaderId;
    }

    // Ocultar loading específico
    hide(loaderId) {
        const loader = document.getElementById(loaderId);
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                if (loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                }
                this.activeLoaders.delete(loaderId);
            }, 300);
        }
    }

    // Crear diferentes tipos de loaders
    createLoader(type, id) {
        const loader = document.createElement('div');
        loader.id = id;
        loader.className = 'loading-overlay';
        
        const styles = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            transition: opacity 0.3s ease;
            border-radius: inherit;
        `;
        
        loader.style.cssText = styles;

        switch (type) {
            case 'spinner':
                loader.innerHTML = `
                    <div class="spinner" style="
                        width: 32px;
                        height: 32px;
                        border: 3px solid #f3f3f3;
                        border-top: 3px solid #007bff;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    "></div>
                `;
                break;
                
            case 'dots':
                loader.innerHTML = `
                    <div class="dots-loader" style="display: flex; gap: 4px;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: #007bff; animation: dotBounce 1.4s infinite ease-in-out both; animation-delay: -0.32s;"></div>
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: #007bff; animation: dotBounce 1.4s infinite ease-in-out both; animation-delay: -0.16s;"></div>
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: #007bff; animation: dotBounce 1.4s infinite ease-in-out both;"></div>
                    </div>
                `;
                break;
                
            case 'pulse':
                loader.innerHTML = `
                    <div style="
                        width: 40px;
                        height: 40px;
                        background: #007bff;
                        border-radius: 50%;
                        animation: pulse 1.5s infinite;
                    "></div>
                `;
                break;
        }

        return loader;
    }

    // Skeleton para productos
    createProductSkeleton() {
        return `
            <div class="product-skeleton" style="
                background: white;
                border-radius: 12px;
                padding: 16px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            ">
                <div class="skeleton" style="height: 200px; margin-bottom: 12px; border-radius: 8px;"></div>
                <div class="skeleton" style="height: 20px; width: 80%; margin-bottom: 8px; border-radius: 4px;"></div>
                <div class="skeleton" style="height: 16px; width: 60%; margin-bottom: 12px; border-radius: 4px;"></div>
                <div class="skeleton" style="height: 24px; width: 40%; border-radius: 4px;"></div>
            </div>
        `;
    }

    // Mostrar skeleton en grid de productos
    showProductSkeleton(container, count = 6) {
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        
        if (!container) return;

        const skeletons = Array(count).fill().map(() => this.createProductSkeleton()).join('');
        container.innerHTML = skeletons;
        
        return 'skeleton_products';
    }

    // Loading para botones
    buttonLoading(button, text = 'Cargando...') {
        if (typeof button === 'string') {
            button = document.querySelector(button);
        }
        
        if (!button) return;

        const originalText = button.textContent;
        const originalDisabled = button.disabled;
        
        button.disabled = true;
        button.innerHTML = `
            <span style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span style="
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255,255,255,.3);
                    border-top-color: currentColor;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                "></span>
                ${text}
            </span>
        `;

        return {
            restore: () => {
                button.textContent = originalText;
                button.disabled = originalDisabled;
            }
        };
    }
}

// CSS para animaciones de loading
const loadingStyles = document.createElement('style');
loadingStyles.textContent = `
@keyframes dotBounce {
    0%, 80%, 100% {
        transform: scale(0);
    } 40% {
        transform: scale(1);
    }
}

@keyframes pulse {
    0% {
        transform: scale(0);
        opacity: 1;
    }
    100% {
        transform: scale(1);
        opacity: 0;
    }
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.skeleton {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: skeletonLoading 1.5s infinite;
}

@keyframes skeletonLoading {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
`;
document.head.appendChild(loadingStyles);

// Crear instancia global
window.Loading = new LoadingManager();

// Funciones de conveniencia
window.showLoading = (element, type) => Loading.show(element, type);
window.hideLoading = (loaderId) => Loading.hide(loaderId);
window.showProductSkeleton = (container, count) => Loading.showProductSkeleton(container, count);
window.buttonLoading = (button, text) => Loading.buttonLoading(button, text);