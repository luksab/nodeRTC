"use strict";
const fs = require('fs'),
    path = require('path'),
    sanitizeHtml = require('sanitize-html');
const mime = require('mime-types');

let currID = 2;

let users = {
    /*
      "name1":{
        "id":3212,
        "ws":WebSocket,
        "friends":["name2","name3"],
        "messages": ["name"],
        "password": "SuperSecurePassword123",
        "rank": "user",
        "achievements": {"achievement1":false,"achievement2":true,},
        "watching": {name:"user", messages:[{message:"msg", id:123}]}
      }
      ,"name2":{}*/
}

fs.readFile('./static/index.html', function (err, data) {
    if (err) {
        global["index"] = `Error getting the file: ${err}.`;
    } else {
        //res.writeHeader('Content-type', 'text/html');
        global["index"] = data;
    }
});

setInterval(() => {
    fs.readFile('./static/index.html', function (err, data) {
        if (err) {
            global["index"] = `Error getting the file: ${err}.`;
        } else {
            //res.writeHeader('Content-type', 'text/html');
            global["index"] = data;
        }
    });
}, 1000);

let bufToStr = (message) => Buffer.from(message).toString();

require('uWebSockets.js').App({})
    .ws('/*', {
        /* Options */
        compression: 1,
        maxPayloadLength: 16 * 1024 * 1024,
        idleTimeout: 3600000,
        /* Handlers */
        open: (ws, req) => {
            console.log('A WebSocket connected !');
        },
        message: async (ws, message, isBinary) => {
            if (bufToStr(message) === "ping")
                return;
            /* Ok is false if backpressure was built up, wait for drain */

            /*console.log(isBinary);
            console.log(bufToStr(message));
            console.log(new Uint8Array(message));*/
            if (isBinary) {
                message = new Uint8Array(message);
                let header = message[0];
                let recipient = message.slice(1, 5);
                let msg = message.slice(5);
                if (header == 0) {
                    console.log("connection from", Buffer.from(recipient).readUInt32BE(0));
                }
            } else {
                message = bufToStr(message);
                let json = false;
                try {
                    message = JSON.parse(message);
                    json = true;
                } catch (e) {
                    json = false;
                }
                if (json)
                    switch (message["type"]) {
                        case "ping":
                            return;
                        case "login": //{name, password}
                            {
                                console.log("new login:", message);

                                if (message["name"] === "" || message["name"] === null || !(/^[a-z0-9]+$/i.test(message["name"]))) {
                                    return ws.send(JSON.stringify({ "message-id": message["message-id"], "success": false, "message": "name not alphanumeric" }));
                                }
                                if (users[message["name"]] != null) {
                                    if (users[message["name"]]["password"] === message["password"].toString()) {
                                        if (users[message["name"]]["ws"] != null) {
                                            return ws.send(JSON.stringify({ "message-id": message["message-id"], "success": false, "message": "You're already logged in somewhere." }));
                                        }
                                        users[message["name"]]["ws"] = ws;
                                        ws["name"] = message["name"];
                                        return ws.send(JSON.stringify({ "message-id": message["message-id"], "success": true, "message": "login" }));
                                    } else {
                                        return ws.send(JSON.stringify({ "message-id": message["message-id"], "success": false, "message": "wrong password" }));
                                    }
                                } else {
                                    console.log("name:", message["name"], "passord:", message["password"].toString());
                                    ws["name"] = message["name"];
                                    users[message["name"]] = {
                                        "ws": ws,
                                        "friends": [],
                                        "password": message["password"].toString(),
                                        "messages": [],
                                        "id": message["name"].startsWith("admin") ? -1 : currID++,
                                    }
                                    return ws.send(JSON.stringify({ "message-id": message["message-id"], "success": true, "message": "register" }));
                                }
                            }
                        case "deleteMe":
                            {
                                console.log("delete User:", message);
                                ws.close();
                                delete users[ws["name"]];
                                break;
                            }
                        case "myFriends":
                            {
                                console.log("list friends:", message);
                                ws.send(JSON.stringify({ "type": "friends", "friends": users[ws["name"]]["friends"] }))
                                break;
                            }
                        case "addFriend":
                            {
                                console.log("new friend added:", message);
                                console.log(users[ws["name"]]["friends"]);
                                message["name"] = message["name"].toString();
                                if (message["name"] != null) {
                                    users[ws["name"]]["friends"].push(message["name"]);
                                    const friendsSet = new Set(users[ws["name"]]["friends"]);
                                    users[ws["name"]]["friends"] = [...friendsSet];
                                    console.log(users[ws["name"]]["friends"]);
                                    ws.send(JSON.stringify({ "type": "friends", "friends": users[ws["name"]]["friends"] }))
                                }
                                break;
                            }
                        case "message":
                            {
                                console.log(ws["name"] + " sent " + message.message + " to " + message.to);
                                if (users[message["name"]] == null) {
                                    console.log("user " + message["name"] + " does not exsist.")
                                    return ws.send(JSON.stringify({ "message-id": message["message-id"], error: "user does not exsist!" }))
                                }
                                if (users[message["name"]]["ws"] == null) {
                                    console.log("user " + message["name"] + " is not online.")
                                    return ws.send(JSON.stringify({ "message-id": message["message-id"], error: "user is not online!" }))
                                }
                                users[message["name"]]["ws"].send(JSON.stringify({ type: "message", from: ws.name, message: message.message }))
                                return ws.send(JSON.stringify({ "message-id": message["message-id"], success: true }))
                            }
                        case "call":
                            {
                                console.log(ws["name"] + " called " + message.name);
                                if (users[message["name"]] == null) {
                                    console.log("user " + message["name"] + " does not exsist.")
                                    return ws.send(JSON.stringify({ "message-id": message["message-id"], error: "user does not exsist!" }))
                                }
                                if (users[message["name"]]["ws"] == null) {
                                    console.log("user " + message["name"] + " is not online.")
                                    return ws.send(JSON.stringify({ "message-id": message["message-id"], error: "user is not online!" }))
                                }
                                users[message["name"]]["ws"].send(JSON.stringify({ type: "call", from: ws.name, offer: message.offer }))
                                return ws.send(JSON.stringify({ "message-id": message["message-id"], success: true }))
                            }
                        case "response":
                            {
                                console.log(ws["name"] + " called " + message.name);
                                if (users[message["name"]] == null) {
                                    console.log("user " + message["name"] + " does not exsist.")
                                    return ws.send(JSON.stringify({ "message-id": message["message-id"], error: "user does not exsist!" }))
                                }
                                if (users[message["name"]]["ws"] == null) {
                                    console.log("user " + message["name"] + " is not online.")
                                    return ws.send(JSON.stringify({ "message-id": message["message-id"], error: "user is not online!" }))
                                }
                                users[message["name"]]["ws"].send(JSON.stringify({ type: "response", from: ws.name, answer: message.answer }))
                                return ws.send(JSON.stringify({ "message-id": message["message-id"], success: true }))
                            }
                        case "new-ice-candidate":
                            {
                                console.log(ws["name"] + " sent a new ice candidate to " + message.name);
                                if (users[message["name"]] == null) {
                                    console.log("user " + message["name"] + " does not exsist.")
                                    return ws.send(JSON.stringify({ "message-id": message["message-id"], error: "user does not exsist!" }))
                                }
                                if (users[message["name"]]["ws"] == null) {
                                    console.log("user " + message["name"] + " is not online.")
                                    return ws.send(JSON.stringify({ "message-id": message["message-id"], error: "user is not online!" }))
                                }
                                users[message["name"]]["ws"].send(JSON.stringify({ type: "ice-candidate", from: ws.name, candidate: message.candidate }))
                                return ws.send(JSON.stringify({ "message-id": message["message-id"], success: true }))
                            }
                        default:
                            console.log(message);
                    }
            }
        },
        drain: (ws) => {
            console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
        },
        close: (ws, code, message) => {
            if (users[ws["name"]]) {
                users[ws["name"]]["ws"] = null;
            }
            console.log('WebSocket', ws["name"], 'closed');
        }
    }).any('/*', (res, req) => {
        let data;
        if (req.getUrl() == "/")
            data = fs.readFileSync('./static/index.html');
        else
            try {
                data = fs.readFileSync('./static' + req.getUrl());
                const mimeType = mime.lookup('./static' + req.getUrl()) || 'application/octet-stream';
                res.writeHeader('Content-Type', mimeType);
            } catch (error) {
                data = error.message;
            }
        if (data == null) {
            res.end("nö");
        }
        res.end(data);
        //res.end(global["index"]);
    }).listen(5000, (token) => {
        if (token) {
            console.log('Listening to port ' + 5000);
        } else {
            console.log('Failed to listen to port ' + 5000);
        }
    });


//disable crashing :)
process.on('uncaughtException', function (err) {
    console.log('Caught exception: ', err);
});