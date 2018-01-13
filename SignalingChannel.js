import { EventEmitter } from './EventEmitter.js';
export class SignalingChannel extends EventEmitter {
    constructor(myId) {
        super();
        this._myId = myId;
        this._bc = new BroadcastChannel('signalingChannel');
        this._bc.onmessage = evt => {
            const msg = evt.data;
            if (msg.server || (msg.dst !== 'all' && msg.dst !== this._myId))
                return;
            this.emit('message', msg);
        };
        this.send({ type: 'connect' });
    }
    send(msg, dst) {
        msg.src = this._myId;
        msg.dst = dst || 'all';
        msg.server = true;
        this._bc.postMessage(msg);
    }
}
//# sourceMappingURL=SignalingChannel.js.map