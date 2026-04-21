class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        this.currentParams = {};
        this.listeners = [];
    }

    register(route, handler) {
        this.routes[route] = handler;
    }

    navigate(route, params = {}) {
        this.currentRoute = route;
        this.currentParams = params;
        
        if (this.routes[route]) {
            this.routes[route](params);
        }
        
        this.notifyListeners(route, params);
    }

    getCurrentRoute() {
        return this.currentRoute;
    }

    onRouteChange(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    notifyListeners(route, params) {
        this.listeners.forEach(callback => callback(route, params));
    }
}

export const router = new Router();
