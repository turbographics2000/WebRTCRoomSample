import { EventEmitter } from './EventEmitter.js';

export class SignalingChannel extends EventEmitter {
    private _myId: string;
    private _bc: BroadcastChannel;

    constructor(myId: string) {
        super();
        this._myId = myId;
        this._bc = new BroadcastChannel('signalingChannel');
        this._bc.onmessage = evt => {
            const msg: { type: string, dst: string, src: string, server?: boolean } = evt.data;
            if (msg.server || (msg.dst !== 'all' && msg.dst !== this._myId)) return;
            this.emit('message', msg);
        }
    }

    send(msg: any, dst?: string) {
        msg.src = this._myId;
        msg.dst = dst || 'all';
        msg.server = true;
        this._bc.postMessage(msg);
    }
}
