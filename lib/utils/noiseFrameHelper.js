const FrameHelper = require("./frameHelper");
const createNoise = require("@richardhopton/noise-c.wasm");

const HANDSHAKE_HELLO = 1;
const HANDSHAKE_HANDSHAKE = 2;
const HANDSHAKE_READY = 3;
const HANDSHAKE_CLOSED = 4;

class NoiseFrameHelper extends FrameHelper {
    constructor(host, port, encryptionKey, expectedServerName) {
        super(host, port);
        this.encryptionKey = encryptionKey;
        this.expectedServerName = expectedServerName;

        this.socket.on("data", (data) => this.onData(data));
        this.socket.on("connect", async () => await this.onConnect());
        this.socket.on("close", () => this.handshakeState = HANDSHAKE_CLOSED);
    }

    async onConnect() {
        const psk = Buffer.from(this.encryptionKey, "base64");
        const noise = await new Promise((res) => createNoise(res));
        this.client = noise.HandshakeState(
            "Noise_NNpsk0_25519_ChaChaPoly_SHA256",
            noise.constants.NOISE_ROLE_INITIATOR
        );
        this.client.Initialize(
            new Uint8Array(Buffer.from("NoiseAPIInit\x00\x00")),
            null,
            null,
            new Uint8Array(psk)
        );
        this.handshakeState = HANDSHAKE_HELLO;
        this.write([]);
    }

    extractFrameBytes() {
        if (this.buffer.length < 3) return null;
        const indicator = this.buffer[0];
        if (indicator != 1)
            throw new Error("Bad format. Expected 1 at the begin");

        const frameEnd = 3 + ((this.buffer[1] << 8) | this.buffer[2]);
        if (this.buffer.length < frameEnd) return null;
        const frame = this.buffer.subarray(3, frameEnd);
        this.buffer = this.buffer.subarray(frameEnd);
        return frame;
    }

    onData(data) {
        this.emit("data", data);
        this.buffer = Buffer.concat([this.buffer, data]);
        let frame;
        while ((frame = this.extractFrameBytes())) {
            switch (this.handshakeState) {
                case HANDSHAKE_HELLO:
                    return this.handleHello(frame);
                case HANDSHAKE_HANDSHAKE:
                    return this.handleHandshake(frame);
                case HANDSHAKE_READY:
                    const message = this.deserialize(this.decryptor.DecryptWithAd([], frame));
                    this.emit("message", message);
            }
        }
    }

    handleHello(serverHello) {
        const chosenProto = serverHello[0];
        if (chosenProto != 1)
            throw new Error(
                `Unknown protocol selected by server ${chosenProto}`
            );
        if (!!this.expectedServerName) {
            const serverNameEnd = serverHello.indexOf("\0", 1);
            if (serverNameEnd > 1) {
                const serverName = serverHello
                    .subarray(1, serverNameEnd)
                    .toString();
                if (this.expectedServerName != serverName)
                    throw new Error(`Server name mismatch, expected ${this.expectedServerName}, got ${serverName}`);
            }
        }

        this.handshakeState = HANDSHAKE_HANDSHAKE;
        this.write([0, ...this.client.WriteMessage()]);
    }

    handleHandshake(serverHandshake) {
        const header = serverHandshake[0];
        const message = serverHandshake.subarray(1);
        if (header != 0) {
            throw new Error(`Handshake failure: ${message.toString()}`);
        }
        this.client.ReadMessage(message, true);
        [this.encryptor, this.decryptor] = this.client.Split();
        this.handshakeState = HANDSHAKE_READY;
        this.emit("connect");
    }

    serialize(message) {
        const encoded = message.serializeBinary();
        const messageId = message.constructor.id;
        const messageLength = encoded.length;
        const buffer = Buffer.from([
            (messageId >> 8) & 255,
            messageId & 255,
            (messageLength >> 8) & 255,
            messageLength & 255,
            ...encoded,
        ]);
        return buffer;
    }

    deserialize(buffer) {
        if (buffer.length < 4) return null;
        const messageId = (buffer[0] << 8) | buffer[1];
        const messageLength = (buffer[2] << 8) | buffer[3];
        const message = this.buildMessage(messageId, buffer.subarray(4, messageLength + 4));
        message.length = messageLength + 4;
        return message;
    }

    write(frame) {
        const frameLength = frame.length;
        const header = [1, (frameLength >> 8) & 255, frameLength & 255];
        const payload = Buffer.from([...header, ...frame]);
        this.socket.write(payload);
    }

    sendMessage(message) {
        this.write(this.encryptor.EncryptWithAd([], this.serialize(message)));
    }
}

module.exports = NoiseFrameHelper;
