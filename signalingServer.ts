const bc = new BroadcastChannel('signalingChannel');

let users: string[] = [];
let rooms: { [index: string]: string[] } = {};

bc.onmessage = evt => {
    const msg = evt.data;
    if (!msg.server) return;

    switch (msg.type) {
        case 'connect': {
            if (!users.includes(msg.src)) {
                users.push(msg.src);
            }
            send({ type: 'users', dst: 'all', users, rooms: Object.keys(rooms) });
            break;
        }
        case 'disconnect': {
            if (msg.room) {
                leaveRoom(msg.room, msg.src);
            }
            const index = users.indexOf(msg.src);
            if (index !== -1) {
                users.splice(index, 1);
            }
            users.forEach(user => {
                send({ type: 'disconnect', dst: user, src: msg.src });
            })
            break;
        }
        case 'create room': {
            const room = generateUnusedValue(msg.room, rooms);
            rooms[room] = [msg.src];
            send({
                type: 'resolve roomName',
                room,
                dst: msg.src
            });
            users.forEach(user => {
                send({
                    type: 'create room',
                    room,
                    dst: user,
                    src: msg.src
                });
            });
            break;
        }
        case 'join': {
            if (!msg.room) return;
            if(!rooms[msg.room].includes(msg.src)) rooms[msg.room].push(msg.src);
            rooms[msg.room].forEach(user => {
                send({
                    type: 'join',
                    dst: user,
                    src: msg.src
                });
            });
            break;
        }
        case 'leave': {
            if (msg.room) {
                leaveRoom(msg.room, msg.src);
            }
            break;
        }
        default: {
            msg.server = false;
            send(msg);
            break;
        }
    }
}

function leaveRoom(room: string, roomMember: string) {
    if (!rooms[room]) return;
    const index = rooms[room].indexOf(roomMember);
    if (index !== -1) {
        rooms[room].filter(user => user !== roomMember).forEach(user => {
            send({ type: 'leave', dst: user, src: roomMember });
        });
        rooms[room].splice(index, 1);
        if (rooms[room].length === 0) {
            delete rooms[room];
            users.forEach(user => {
                send({ type: 'delete room', room, dst: user });
            });
        }
    }
}

function send(msg: any) {
    msg.src = msg.src || 'server';
    bc.postMessage(msg);
}

function generateUUID() {
    return (new MediaStream()).id;
}

function generateUnusedValue(prefix: string, target: { [index: string]: string[] }): string {
    const roomNameList = Object.keys(target);
    for (let n = 1; n <= 10000; n++) {
        const value = `${prefix}${n === 1 ? '' : '-' + n}`;
        if (!roomNameList.filter(item => item === value).length) {
            return value;
        }
    }
    return '';
}