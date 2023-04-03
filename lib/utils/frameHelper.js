const EventEmitter = require("events");
const Net = require("net");
const { pb, id_to_type } = require("./messages");

class FrameHelper extends EventEmitter {
    constructor(host, port) {
        super();
        this.host = host;
        this.port = port;
        this.buffer = Buffer.from([]);
        this.socket = new Net.Socket();
        this.socket.on("close", () => this.emit("close"));
        this.socket.on("error", (e) => {
            this.emit("error", e);
            this.socket.end();
        });
    }

    connect() {
        this.socket.connect(this.port, this.host);
    }

    end() {
        this.socket.end();
    }

    destroy() {
        this.socket.destroy();
    }

    removeAllListeners() {
        this.socket.removeAllListeners();
        super.removeAllListeners();
    }

    buildMessage(messageId, bytes) {
        return pb[id_to_type[messageId]].deserializeBinary(bytes);
    }
}

module.exports = FrameHelper;
