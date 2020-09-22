class wsLib {
    constructor(address, name, password, sendPing) {
        this.address = address;
        this.name = name;
        this.password = password;

        this.callbacks = {};
        this.sends = {};
        this.currentScene = "";
        this.sceneList = [];
        var that = this;
        if (sendPing)
            this.connect().then(() => {
                that.pingInterval = setInterval(() => that.send("ping"), 5000);
            });
        else
            this.connect()
    }
    connect() {
        this.ws = new WebSocket(this.address);
        var that = this;

        return new Promise(function (resolve, reject) {
            that.ws.onopen = function () {
                that.send("login", { name: that.name, password: that.password }).then(function (msg) {
                    if (msg.success) {
                        if (that.callbacks["ConnectionOpened"])
                            for (var callback of that.callbacks["ConnectionOpened"]) {
                                callback();
                            }
                        return true;
                    }
                    else {
                        console.log("error: " + message.message);
                        return false;
                    }
                })
            }

            that.ws.onclose = function (e) {
                if (e.reason !== "") {
                    console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason);
                    return setTimeout(function () {
                        that.connect();
                    }, 1000);
                }
                console.log("ws closed");
            };

            that.ws.onerror = function (err) {
                console.error('Socket encountered error: ', err.message, 'Closing socket');
                ws.close();
            };

            that.ws.onmessage = function (message) {
                var msg = JSON.parse(message.data);
                console.log("New message: " , msg);
                if (that.callbacks[msg["type"]])
                    for (var callback of that.callbacks[msg["type"]]) {
                        callback(msg);
                    }
                else if (that.sends[msg["message-id"]]) {
                    that.sends[msg["message-id"]](msg);
                }
            };
            try {
                if (!that.callbacks["ConnectionOpened"])
                    that.callbacks["ConnectionOpened"] = [];
                that.callbacks["ConnectionOpened"].push(resolve);
                that.resolve = resolve;
            } catch (e) {
                reject(e);
            }
        })
    }
    on(type, callback) {
        if (this.callbacks[type] == null)
            this.callbacks[type] = [];
        this.callbacks[type].push(callback);
    }
    send(type, options) {
        var that = this;
        if (this.ws.readyState === WebSocket.OPEN)
            return new Promise(function (resolve, reject) {
                try {
                    var mid = Math.random().toString(36).substring(7);
                    if (type != "ping")
                        console.log("sending", Object.assign({ "type": type, "message-id": mid }, options));
                    that.ws.send(JSON.stringify(Object.assign({ "type": type, "message-id": mid }, options)));
                    that.sends[mid] = resolve;
                } catch (e) {
                    reject(e);
                }
            })
        else
            return new Promise(function (resolve, reject) {
                that.connect().then(function () {
                    var mid = Math.random().toString(36).substring(7);
                    if (type != "ping")
                        console.log("sending", Object.assign({ "type": type, "message-id": mid }, options));
                    that.ws.send(JSON.stringify(Object.assign({ "type": type, "message-id": mid }, options)));
                    that.sends[mid] = resolve;
                });
            })
    }
}