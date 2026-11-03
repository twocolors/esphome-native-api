const EventEmitter = require("events");
const Net = require("net");
const { pb, id_to_type } = require("./messages");

// how long end() waits for the peer to close its side before the socket is destroyed
const END_TIMEOUT = 5000;

class FrameHelper extends EventEmitter {
    constructor(host, port) {
        super();
        this.host = host;
        this.port = port;
        this.buffer = Buffer.from([]);
        this.socket = new Net.Socket();
        this.socket.on("close", () => {
            clearTimeout(this.endTimer);
            this.clearBuffer();
            this.emit("close");
        });
        this.socket.on("error", (e) => {
            this.emit("error", e);
            this.end();
        });
        this.socket.on("end", () => {
            this.clearBuffer();
        });
    }

    connect() {
        clearTimeout(this.endTimer);
        this.clearBuffer();
        this.socket.connect(this.port, this.host);
    }

    end() {
        this.socket.end();
        this.clearBuffer();
        // end() only half-closes the socket and waits for the peer's FIN. A device that has
        // dropped off the network never sends it: the socket stays in FIN_WAIT_2, "close"
        // never fires and no reconnect is ever scheduled.
        clearTimeout(this.endTimer);
        this.endTimer = setTimeout(() => this.socket.destroy(), END_TIMEOUT);
    }

    destroy() {
        clearTimeout(this.endTimer);
        this.socket.destroy();
    }

    removeAllListeners() {
        this.socket.removeAllListeners();
        super.removeAllListeners();
    }

    buildMessage(messageId, bytes) {
        try {
            return pb[id_to_type[messageId]].deserializeBinary(bytes);
        } catch(e) {
            this.emit('error', new Error(`Failed find or parsed message type for Id: ${messageId}`));
            if (typeof id_to_type[messageId] !== undefined) {
                // we know this type and close connect mb error or freeze connect
                this.end();
            }
        }
    }

    clearBuffer() {
        this.buffer = Buffer.from([]); // clear buffer. ensure clean state for connection
    }
}

module.exports = FrameHelper;
