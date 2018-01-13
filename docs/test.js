import { SignalingChannel } from './SignalingChannel.js';
let myId = (new MediaStream()).id;
let myRoom = '';
let myStream = null;
let users = [];
let rooms = [];
let camEnabled = true;
let micEnabled = true;
const audioContext = new AudioContext();
const webcamDevices = {};
const connections = {};
const signalingChannel = new SignalingChannel(myId);
const audioMeters = {};
const header = document.querySelector('#header');
const webcamSelect = document.querySelector('#webcamSelect');
const roomNameDialog = document.querySelector('#roomNameDialog');
const roomName = document.querySelector('#roomName');
const roomNameDialogClose = document.querySelector('#roomNameDialogClose');
const roomList = document.querySelector('#roomList');
const roomPanel = document.querySelector('#roomPanel');
const roomTitle = document.querySelector('#roomTitle');
const roomContainer = document.querySelector('#roomContainer');
const myStreamView = document.querySelector('#myStreamView');
const camSwitchButton = document.querySelector('#camSwitchButton');
const micSwitchButton = document.querySelector('#micSwitchButton');
const leaveButton = document.querySelector('#leaveButton');
const myIdElm = newElm({
    textContent: myId,
    classes: ['my-id']
});
const createRoom = newElm({
    tagName: 'button',
    classes: ['create-room-button'],
    textContent: 'ルーム作成',
    attributes: {
        onclick: () => {
            roomNameDialog.showModal();
        }
    }
});
header.appendChild(myIdElm);
header.appendChild(createRoom);
window.addEventListener('beforeunload', () => {
    signalingChannel.send({ type: 'disconnect', room: myRoom });
});
roomNameDialogClose.addEventListener('click', () => {
    if (roomName.value) {
        roomNameDialog.close(roomName.value);
    }
});
roomNameDialog.addEventListener('close', () => {
    signalingChannel.send({ type: 'create room', room: roomNameDialog.returnValue });
});
micSwitchButton.addEventListener('click', () => {
    micEnabled = !micEnabled;
    micSwitchButton.textContent = micEnabled ? 'mic' : 'mic_off';
    if (myStream) {
        const audioTracks = myStream.getAudioTracks();
        audioTracks.forEach(track => track.enabled = micEnabled);
    }
});
camSwitchButton.addEventListener('click', () => {
    camEnabled = !camEnabled;
    camSwitchButton.textContent = camEnabled ? 'videocam' : 'videocam_off';
    if (myStream) {
        const videoTracks = myStream.getVideoTracks();
        videoTracks.forEach(track => track.enabled = camEnabled);
    }
});
leaveButton.addEventListener('click', () => {
    if (!myRoom)
        return;
    const members = Object.keys(audioMeters);
    members.forEach(member => deleteRoomMember(member));
    roomPanel.style.display = 'none';
    roomList.style.display = '';
    signalingChannel.send({ type: 'leave', room: myRoom });
});
navigator.mediaDevices.enumerateDevices().then(devices => {
    devices.filter(device => device.kind === 'videoinput').forEach((device, i) => {
        const opt = newElm({
            tagName: 'option',
            textContent: device.label || `webcam ${i}`,
            value: device.deviceId,
        });
        webcamDevices[device.deviceId] = device;
        webcamSelect.appendChild(opt);
    });
    signalingChannel.send({ type: 'connect' });
});
signalingChannel.on('message', async (msg) => {
    switch (msg.type) {
        case 'users': {
            if (msg.users) {
                users = msg.users;
                if (!myStream) {
                    const index = users.indexOf(myId);
                    if (index !== -1) {
                        const webcamIds = Object.keys(webcamDevices);
                        const wcIdx = index % webcamIds.length;
                        getStream(webcamDevices[webcamIds[wcIdx]]);
                    }
                }
                updateUserList();
            }
            if (msg.rooms) {
                rooms = msg.rooms;
                rooms.sort();
                updateRoomList();
            }
            break;
        }
        case 'resolve roomName': {
            if (msg.room) {
                myRoom = msg.room;
                rooms.push(myRoom);
                updateRoomList();
                roomTitle.textContent = `ルーム：${myRoom}`;
                roomPanel.style.display = '';
                roomList.style.display = 'none';
                createAudioMeter(myId, myStreamView, myStreamView.parentElement);
            }
            break;
        }
        case 'create room': {
            if (msg.room) {
                if (!rooms.includes(msg.room)) {
                    rooms.push(msg.room);
                }
                rooms.sort();
                updateRoomList();
            }
            break;
        }
        case 'delete room': {
            if (msg.room) {
                const index = rooms.indexOf(msg.room);
                if (index !== -1) {
                    rooms.splice(index, 1);
                    updateRoomList();
                }
            }
            break;
        }
        case 'join': {
            peerConnect(msg.src);
            break;
        }
        case 'candidate': {
            const pc = connections[msg.src] || peerConnect(msg.src);
            pc.addIceCandidate(JSON.parse(msg.candidate));
            break;
        }
        case 'offer': {
            roomPanel.style.display = '';
            roomList.style.display = 'none';
            const pc = connections[msg.src] || peerConnect(msg.src);
            await pc.setRemoteDescription(JSON.parse(msg.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            signalingChannel.send({ type: 'answer', answer: JSON.stringify(answer) }, msg.src);
            break;
        }
        case 'answer': {
            const pc = connections[msg.src] || peerConnect(msg.src);
            await pc.setRemoteDescription(JSON.parse(msg.answer));
            break;
        }
        case 'leave': {
            if (!connections[msg.src])
                return;
            audioMeters[msg.src].memberElm.remove();
            deleteRoomMember(msg.src);
            connections[msg.src].close();
            setTimeout(() => {
                delete connections[msg.src];
            });
            break;
        }
        case 'disconnect': {
            const index = users.indexOf(msg.src);
            if (index !== -1) {
                users.splice(index, 1);
                updateUserList();
            }
            break;
        }
    }
});
function getStream(device) {
    navigator.mediaDevices.getUserMedia({
        video: { deviceId: device.deviceId },
        audio: true
    }).then(stream => {
        myStream = stream;
        myStreamView.srcObject = myStream;
        myStreamView.play();
    });
}
function peerConnect(remoteId) {
    const pc = connections[remoteId] = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.onicecandidate = evt => {
        if (evt.candidate) {
            signalingChannel.send({ type: 'candidate', candidate: JSON.stringify(evt.candidate) }, remoteId);
        }
    };
    pc.onnegotiationneeded = async (evt) => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signalingChannel.send({ type: 'offer', offer: JSON.stringify(offer) }, remoteId);
    };
    if ('onaddstream' in pc) {
        pc.onaddstream = evt => {
            addRoomMember(remoteId, evt.stream);
        };
    }
    else {
        pc.ontrack = evt => {
            if (evt.track.kind === 'video') {
                addRoomMember(remoteId, evt.streams[0]);
            }
        };
    }
    pc.onicegatheringstatechange = evt => {
        console.log(pc.iceGatheringState);
    };
    if (myStream) {
        if ('addStream' in pc) {
            pc.addStream(myStream);
        }
        else {
            myStream.getTracks().forEach(track => pc.addTrack(track, myStream));
        }
    }
    return pc;
}
;
function updateUserList() {
    const list = document.querySelector('#userList');
    list.innerHTML = '';
    users.forEach(user => {
        const userElm = newElm({ textContent: user, classes: ['user'] });
        list.appendChild(userElm);
    });
}
;
function updateRoomList() {
    roomList.innerHTML = '';
    rooms.forEach(room => {
        const roomElm = newElm({
            textContent: room,
            classes: ['room'],
            attributes: {
                onclick: function () {
                    myRoom = this.textContent;
                    signalingChannel.send({ type: 'join', room: this.textContent });
                }
            }
        });
        roomList.appendChild(roomElm);
    });
}
function addRoomMember(user, stream) {
    const video = newElm({
        tagName: 'video',
        classes: ['room-member'],
        attributes: {
            autoplay: true,
            srcObject: stream
        }
    });
    const label = newElm({
        textContent: user,
        classes: ['member-name']
    });
    const roomMember = newElm({
        classes: ['room-member'],
        children: [video, label]
    });
    roomContainer.appendChild(roomMember);
    createAudioMeter(user, video, roomMember);
}
function createAudioMeter(user, video, memberElm) {
    const source = audioContext.createMediaStreamSource(video.srcObject);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    let data = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
    audioMeters[user] = {
        video,
        source,
        memberElm,
        analyser,
        bufferLength,
        data
    };
}
function deleteRoomMember(user) {
    const audioMeter = audioMeters[user];
    if (audioMeter) {
        const memberElm = audioMeter.memberElm;
        const video = audioMeter.video;
        const source = audioMeter.source;
        const analyser = audioMeter.analyser;
        if (user !== myId) {
            memberElm.remove();
        }
        delete audioMeters[user];
        analyser.disconnect();
        source.disconnect();
    }
}
let meterRenderId = 0;
function audioMeterRender() {
    meterRenderId = requestAnimationFrame(audioMeterRender);
    const roomMembers = Object.keys(audioMeters);
    roomMembers.forEach(member => {
        const memberElm = audioMeters[member].memberElm;
        const analyser = audioMeters[member].analyser;
        const bufferLength = audioMeters[member].bufferLength;
        let data = audioMeters[member].data;
        analyser.getByteFrequencyData(data);
        for (let i = 0; i < bufferLength; i++) {
            memberElm.style.borderColor = `rgba(${0x00}, ${0x00}, ${0xFF},${data[0] / 256})`;
        }
    });
}
audioMeterRender();
function newElm({ tagName = 'div', type, classes, attributes, styles, dataset, textContent, value, selected, children }) {
    const elm = document.createElement(tagName);
    if (type)
        elm.type = type;
    if (classes) {
        if (!Array.isArray(classes))
            classes = [classes];
        classes.forEach(c => c && elm.classList.add(c));
    }
    Object.keys(attributes || {}).forEach(atrName => {
        elm[atrName] = attributes[atrName];
    });
    Object.keys(styles || {}).forEach(styleName => {
        elm.style[styleName] = styles[styleName];
    });
    Object.keys(dataset || {}).forEach(dsName => {
        elm.dataset[dsName] = dataset[dsName];
    });
    if (textContent)
        elm.textContent = textContent;
    if (selected)
        elm.selected = true;
    if (value)
        elm.value = value;
    if (children) {
        if (!Array.isArray(children))
            children = [children];
        children.forEach(child => {
            elm.appendChild(child);
        });
    }
    return elm;
}
//# sourceMappingURL=test.js.map