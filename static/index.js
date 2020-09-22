var WSLib;
const configuration = {
    'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' },
    {
        url: 'turn:relay.backups.cz',
        credential: 'webrtc',
        username: 'webrtc'
    }]
};


var connections = {};

window.onload = function () {
    WSLib = new wsLib("wss://luksab.de/node/", window.prompt("Username", "test"), "123", true)
    WSLib.on('ConnectionOpened', function () {
        console.log("connected");
    });
    WSLib.on("message", (msg) => {
        console.log(msg)
    })

    WSLib.on("call", async message => {
        console.log("call from", message.from);
        let peerConnection = new RTCPeerConnection(configuration);
        navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        }).then(async stream => {
            const localVideo = document.getElementById("local-video");
            localVideo.srcObject = stream
            localStream = stream

            for (let track of localStream.getTracks()) {
                peerConnection.addTrack(track, localStream)
            }
        })
        connections[message.from] = peerConnection;
        if (message.offer) {
            peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
            const answer = await peerConnection.createAnswer();
            console.log(answer);
            await peerConnection.setLocalDescription(answer);
            WSLib.send("response", { 'name': message.from, 'answer': answer });
        }
    })

    WSLib.on('response', async message => {
        if (!message.from in connections)
            return console.error(message.from, "tried to answer, but we didn't call!");
        if (!message.answer)
            return console.error(message.from, "answered without an offer!");
        console.log(message.answer)
        const remoteDesc = new RTCSessionDescription(message.answer);
        console.log(remoteDesc);
        let peerConnection = connections[message.from];
        await peerConnection.setRemoteDescription(remoteDesc);
        console.log("waiting for ice candidates for", message.from)
        // Listen for local ICE candidates on the local RTCPeerConnection
        peerConnection.addEventListener('icecandidate', event => {
            console.log("new ice candidate from", message.from)
            if (event.candidate) {
                WSLib.send("new-ice-candidate", { 'name': message.from, 'candidate': event.candidate });
            }
        });
        // Listen for connectionstatechange on the local RTCPeerConnection
        peerConnection.addEventListener('connectionstatechange', event => {
            console.log(event)
            if (peerConnection.connectionState === 'connected') {
                console.log("everything worked :)")
                // Peers connected!
            }
        });
    });

    // Listen for remote ICE candidates and add them to the local RTCPeerConnection
    WSLib.on('ice-candidate', async message => {
        if (message.candidate) {
            try {
                await connections[message.from].addIceCandidate(message.candidate);
            } catch (e) {
                console.error('Error adding received ice candidate', e);
            }
        } else {
            console.error('No ice candidate', e);
        }
    });
    // WSLib.send("GetStudioModeStatus").then(function (data) {
    //     studioMode = data["studio-mode"];
    // })
}


async function makeCall(name) {
    const peerConnection = new RTCPeerConnection(configuration);
    connections[name] = peerConnection;
    navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
    }).then(async stream => {
        const localVideo = document.getElementById("local-video");
        localVideo.srcObject = stream
        localStream = stream

        for (let track of localStream.getTracks()) {
            peerConnection.addTrack(track, localStream)
        }
        const offer = await peerConnection.createOffer();
        console.log(offer);
        await peerConnection.setLocalDescription(offer);
        WSLib.send("call", { "name": name, 'offer': offer });
    })
}


// function unselectUsersFromList() {
//   const alreadySelectedUser = document.querySelectorAll(
//     ".active-user.active-user--selected"
//   );

//   alreadySelectedUser.forEach(el => {
//     el.setAttribute("class", "active-user");
//   });
// }

// function createUserItemContainer(socketId) {
//   const userContainerEl = document.createElement("div");

//   const usernameEl = document.createElement("p");

//   userContainerEl.setAttribute("class", "active-user");
//   userContainerEl.setAttribute("id", socketId);
//   usernameEl.setAttribute("class", "username");
//   usernameEl.innerHTML = `Socket: ${socketId}`;

//   userContainerEl.appendChild(usernameEl);

//   userContainerEl.addEventListener("click", () => {
//     unselectUsersFromList();
//     userContainerEl.setAttribute("class", "active-user active-user--selected");
//     const talkingWithInfo = document.getElementById("talking-with-info");
//     talkingWithInfo.innerHTML = `Talking with: "Socket: ${socketId}"`;
//     callUser(socketId);
//   });

//   return userContainerEl;
// }

// async function callUser(socketId) {
//   const offer = await peerConnection.createOffer();
//   await peerConnection.setLocalDescription(new RTCSessionDescription(offer));

//   socket.emit("call-user", {
//     offer,
//     to: socketId
//   });
// }

// function updateUserList(socketIds) {
//   const activeUserContainer = document.getElementById("active-user-container");

//   socketIds.forEach(socketId => {
//     const alreadyExistingUser = document.getElementById(socketId);
//     if (!alreadyExistingUser) {
//       const userContainerEl = createUserItemContainer(socketId);

//       activeUserContainer.appendChild(userContainerEl);
//     }
//   });
// }

// const socket = io.connect("localhost:5000");

// socket.on("update-user-list", ({ users }) => {
//   updateUserList(users);
// });

// socket.on("remove-user", ({ socketId }) => {
//   const elToRemove = document.getElementById(socketId);

//   if (elToRemove) {
//     elToRemove.remove();
//   }
// });

// socket.on("call-made", async data => {
//   if (getCalled) {
//     const confirmed = confirm(
//       `User "Socket: ${data.socket}" wants to call you. Do accept this call?`
//     );

//     if (!confirmed) {
//       socket.emit("reject-call", {
//         from: data.socket
//       });

//       return;
//     }
//   }

//   await peerConnection.setRemoteDescription(
//     new RTCSessionDescription(data.offer)
//   );
//   const answer = await peerConnection.createAnswer();
//   await peerConnection.setLocalDescription(new RTCSessionDescription(answer));

//   socket.emit("make-answer", {
//     answer,
//     to: data.socket
//   });
//   getCalled = true;
// });

// socket.on("answer-made", async data => {
//   await peerConnection.setRemoteDescription(
//     new RTCSessionDescription(data.answer)
//   );

//   if (!isAlreadyCalling) {
//     callUser(data.socket);
//     isAlreadyCalling = true;
//   }
// });

// socket.on("call-rejected", data => {
//   alert(`User: "Socket: ${data.socket}" rejected your call.`);
//   unselectUsersFromList();
// });

// peerConnection.ontrack = function({ streams: [stream] }) {
//   const remoteVideo = document.getElementById("remote-video");
//   if (remoteVideo) {
//     remoteVideo.srcObject = stream;
//   }
// };

// navigator.getUserMedia(
//   { video: true, audio: true },
//   stream => {
//     const localVideo = document.getElementById("local-video");
//     if (localVideo) {
//       localVideo.srcObject = stream;
//     }

//     stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
//   },
//   error => {
//     console.warn(error.message);
//   }
// );

//navigator.mediaDevices.getDisplayMedia()