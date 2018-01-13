
export class EventEmitter {

    private eventListeners: {[index: string]: { (arg: any): void; }[] } = {};

    constructor() {

    }

    on(eventName: string, callback: (arg: any) => void) {
        if (typeof callback !== 'function') {
            throw new Error('callback is not a function.');
        }
        if(!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(callback);
    }

    off(eventName: string, callback: (arg: any) => void) {
        if (typeof callback !== 'function') {
            throw new Error('callback is not a function.');
        }
        let listeners = this.eventListeners[eventName];
        if (!listeners) return;
        if (callback) {
            listeners.splice(listeners.indexOf(callback), 1);
        }
    }

    emit(eventName:string, ...args:any[]) {
        if (!this.eventListeners[eventName]) return;
        this.eventListeners[eventName].forEach(callback => {
            callback.call(this, ...args);
        });
    }
}
