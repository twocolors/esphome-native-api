const EventEmitter = require("events");
const Net = require('net');
const { Entities } = require('./entities');
const { serialize, deserialize, pb } = require('./utils/messages');
const Package = require('../package.json');

const base64Decode = (message) =>
    message ? Buffer.from(message, 'base64').toString('ascii') : message;

const uuidRegex = new RegExp(
    /([a-f0-9]{8})([a-f0-9]{4})([a-f0-9]{4})([a-f0-9]{4})([a-f0-9]{12})/
);
const uuidDecode = (segments) =>
    segments
        .map((segment) => BigInt(segment).toString(16).padStart(16, '0'))
        .join('')
        .replace(uuidRegex, '$1-$2-$3-$4-$5');

const mapMessageByType = (type, obj) => {
    switch (type) {
        case 'SubscribeLogsResponse': {
            // decode message to string
            const message = base64Decode(obj.message);
            return { ...obj, message };
        }
        case 'BluetoothLEAdvertisementResponse': {
            // decode name to string
            const name = base64Decode(obj.name);
            return { ...obj, name };
        }
        case 'BluetoothGATTGetServicesResponse': {
            // decode uuidList to uuid string
            const { servicesList, ...rest } = obj;
            return {
                ...rest,
                servicesList: servicesList.map(
                    ({ uuidList, characteristicsList, ...rest }) => ({
                        uuid: uuidDecode(uuidList),
                        ...rest,
                        characteristicsList: characteristicsList.map(
                            ({ uuidList, descriptorsList, ...rest }) => ({
                                uuid: uuidDecode(uuidList),
                                ...rest,
                                descriptorsList: descriptorsList.map(
                                    ({ uuidList, ...rest }) => ({
                                        uuid: uuidDecode(uuidList),
                                        ...rest,
                                    })
                                ),
                            })
                        ),
                    })
                ),
            };
        }
        default:
            return obj;
    }
};

class EsphomeNativeApiConnection extends EventEmitter {
    constructor({
        port = 6053,
        host,
        clientInfo = Package.name + ' ' + Package.version,
        password = '',
        reconnect = true,
        reconnectInterval = 30 * 1000,
        pingInterval = 15 * 1000,
        pingAttempts = 3
    }) {
        super();
        if (!host) throw new Error(`Host is required`);

        this.socket = new Net.Socket();
        this.buffer = Buffer.from([]);

        // socket data
        this.socket.on('data', data => {
            this.emit('data', data);
            this.buffer = Buffer.concat([this.buffer, data]);
            let message;
            try {
                while (message = deserialize(this.buffer)) {
                    this.buffer = this.buffer.slice(message.length);
                    const type = message.constructor.type;
                    const mapped = mapMessageByType(type, message.toObject());
                    this.emit(`message.${type}`, mapped);
                    this.emit('message', type, mapped);
                }
            } catch (e) {
                this.emit('error', e);
                this.emit('unhandledData', data);
            }
        })

        // socket close
        this.socket.on('close', () => {
            this.connected = false;
            this.authorized = false;
            clearInterval(this.pingTimer);
            this.pingCount = 0;
            // reconnect
            if (this.reconnect) {
                this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectInterval);
                this.emit('reconnect');
            }
        })

        // socket connect
        this.socket.on('connect', async () => {
            clearTimeout(this.reconnectTimer);
            this.connected = true;
            try {
                await this.helloService(this.clientInfo);
                const { invalidPassword } =  await this.connectService(this.password);
                if (invalidPassword === true) throw new Error(`Invalid password`);
                this.authorized = true;
            } catch(e) {
                this.emit('error', e);
                this.socket.end();
            }
            this.pingTimer = setInterval(async () => {
                try {
                    await this.pingService();
                    this.pingCount = 0;
                } catch(e) {
                    if (++this.pingCount >= this.pingAttempts) {
                        this.socket.end();
                    }
                }
            }, this.pingInterval);
        })

        // socket error
        this.socket.on('error', e => {
            this.emit('error', e);
            this.socket.end();
        })

        // DisconnectRequest
        this.on('message.DisconnectRequest', () => {
            try {
                this.sendMessage(new pb.DisconnectResponse());
                this.socket.destroy();
            } catch(e) {
                this.emit('error', new Error(`Failed respond to DisconnectRequest. Reason: ${e.message}`));
            }
        })

        // DisconnectResponse
        this.on('message.DisconnectResponse', () => {
            this.socket.destroy();
        })

        // PingRequest
        this.on('message.PingRequest', () => {
            try {
                this.sendMessage(new pb.PingResponse());
            } catch(e) {
                this.emit('error', new Error(`Failed respond to PingRequest. Reason: ${e.message}`));
            }
        })

        // GetTimeRequest
        this.on('message.GetTimeRequest', () => {
            try {
                const message = new pb.GetTimeResponse();
                message.setEpochSeconds(Math.floor(Date.now() / 1000));
                this.sendMessage(message);
            } catch(e) {
                this.emit('error', new Error(`Failed respond to GetTimeRequest. Reason: ${e.message}`));
            }
        })

        this._connected = false;
        this._authorized = false;

        this.port = port;
        this.host = host;
        this.clientInfo = clientInfo;
        this.password = password;
        this.reconnect = reconnect;
        this.reconnectTimer = null;
        this.reconnectInterval = reconnectInterval;
        this.pingTimer = null;
        this.pingInterval = pingInterval;
        this.pingAttempts = pingAttempts;
        this.pingCount = 0;
    }
    set connected(value) {
        if (this._connected === value) return;
        this._connected = value;
        this.emit(this._connected ? 'connected' : 'disconnected');
    }
    get connected() {
        return this._connected;
    }
    set authorized(value) {
        if (this._authorized === value) return;
        this._authorized = value;
        this.emit(this._authorized ? 'authorized' : 'unauthorized');
    }
    get authorized() {
        return this._authorized;
    }
    connect() {
        if (this.connected) throw new Error(`Already connected. Can't connect.`);
        this.socket.connect(this.port, this.host);
    }
    disconnect() {
        clearInterval(this.pingTimer);
        clearTimeout(this.reconnectTimer);
        this.reconnect = false;
        this.sendMessage(new pb.DisconnectRequest());
        this.socket.removeAllListeners();
        this.removeAllListeners();
        this.socket.destroy();
    }
    sendMessage(message) {
        if (!this.connected) throw new Error(`Socket is not connected`);
        this.socket.write(serialize(message));
    }
    sendCommandMessage(message) {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        this.sendMessage(message);
    }
    // async
    async sendMessageAwaitResponse(message, responseMessageTypeName, timeoutSeconds = 5) {
        return new Promise((resolve, reject) => {
          const clear = () => {
            this.off(`message.${responseMessageTypeName}`, handler);
            clearTimeout(timeout);
          }
          const handler = (message) => {
            clear();
            resolve(message);
          }
          this.sendMessage(message);
          this.once(`message.${responseMessageTypeName}`, handler);
          const timeout = setTimeout(() => {
            clear();
            reject(new Error(`sendMessage timeout`));
          }, timeoutSeconds * 1000);
        })
    }
    async helloService(clientInfo) {
        const message = new pb.HelloRequest();

        if (clientInfo !== undefined) message.setClientInfo(clientInfo);

        return await this.sendMessageAwaitResponse(message, 'HelloResponse');
    }
    async connectService(password) {
        const message = new pb.ConnectRequest();

        if (password !== undefined) message.setPassword(password);

        return await this.sendMessageAwaitResponse(message, 'ConnectResponse');
    }
    async disconnectService() {
        return await this.sendMessageAwaitResponse(new pb.DisconnectRequest(), 'DisconnectResponse');
    }
    async pingService() {
        return await this.sendMessageAwaitResponse(new pb.PingRequest(), 'PingResponse');
    }
    async deviceInfoService() {
        if (!this.connected) throw new Error(`Not connected`);
        return await this.sendMessageAwaitResponse(new pb.DeviceInfoRequest(), 'DeviceInfoResponse');
    }
    async getTimeService() {
        if (!this.connected) throw new Error(`Not connected`);
        return await this.sendMessageAwaitResponse(new pb.GetTimeRequest(), 'GetTimeResponse');
    }
    async listEntitiesService() {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        const message = new pb.ListEntitiesRequest();

        const allowedEvents = [
            'ListEntitiesBinarySensorResponse',
            'ListEntitiesCoverResponse',
            'ListEntitiesFanResponse',
            'ListEntitiesLightResponse',
            'ListEntitiesSensorResponse',
            'ListEntitiesSwitchResponse',
            'ListEntitiesTextSensorResponse',
            'ListEntitiesCameraResponse',
            'ListEntitiesClimateResponse',
            'ListEntitiesNumberResponse',
            'ListEntitiesSelectResponse',
            'ListEntitiesSirenResponse',
            'ListEntitiesLockResponse',
            'ListEntitiesButtonResponse'
        ]
        const entitiesList = [];
        const onMessage = (type, message) => {
            if (!allowedEvents.includes(type)) return;
            entitiesList.push({
                component : type.slice(12, -8),
                entity    : message
            });
        };
        this.on('message', onMessage);
        await this.sendMessageAwaitResponse(message, 'ListEntitiesDoneResponse').then(() => {
            this.off('message', onMessage);
        }, e => {
            this.off('message', onMessage);
            throw e;
        });
        return entitiesList;
    }
    subscribeStatesService() {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        this.sendMessage(new pb.SubscribeStatesRequest());
    }
    subscribeLogsService(level = pb.LogLevel.LOG_LEVEL_INFO, dumpConfig = false) {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        const message = new pb.SubscribeLogsRequest();
        message.setLevel(level);
        message.setDumpConfig(dumpConfig);
        this.sendMessage(message);
    }
    cameraImageService(single = true, stream = false) {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        const message = new pb.CameraImageRequest();
        message.setSingle(single);
        message.setStream(stream);
        this.sendMessage(message);
    }

    // Entity command services
    buttonCommandService(data) {
        Entities.Button.commandService(this, data);
    }
    climateCommandService(data) {
        Entities.Climate.commandService(this, data);
    }
    coverCommandService(data) {
        Entities.Cover.commandService(this, data);
    }
    fanCommandService(data) {
        Entities.Fan.commandService(this, data);
    }
    lightCommandService(data) {
        Entities.Light.commandService(this, data);
    }
    lockCommandService(data) {
        Entities.Lock.commandService(this, data);
    }
    numberCommandService(data) {
        Entities.Number.commandService(this, data);
    }
    selectCommandService(data) {
        Entities.Select.commandService(this, data);
    }
    sirenCommandService(data) {
        Entities.Siren.commandService(this, data);
    }
    switchCommandService(data) {
        Entities.Switch.commandService(this, data);
    }
    subscribeBluetoothAdvertisementService() {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        this.sendMessage(new pb.SubscribeBluetoothLEAdvertisementsRequest());
    }
    async connectBluetoothDeviceService(address) {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        return await this.sendMessageAwaitResponse(
            new pb.BluetoothDeviceRequest([address]),
            'BluetoothDeviceConnectionResponse',
            10
        );
    }
    async disconnectBluetoothDeviceService(address) {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        return await this.sendMessageAwaitResponse(
            new pb.BluetoothDeviceRequest([
                address,
                pb.BluetoothDeviceRequestType
                    .BLUETOOTH_DEVICE_REQUEST_TYPE_DISCONNECT,
            ]),
            'BluetoothDeviceConnectionResponse'
        );
    }
    async listBluetoothGattServicesService(address) {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        const message = new pb.BluetoothGATTGetServicesRequest([address]);

        const servicesList = [];
        const onMessage = (message) => {
            if (message.address === address)
                servicesList.push(...message.servicesList);
        };
        this.on('message.BluetoothGATTGetServicesResponse', onMessage);
        await this.sendMessageAwaitResponse(
            message,
            'BluetoothGATTGetServicesDoneResponse'
        ).then(
            () => {
                this.off('message.BluetoothGATTGetServicesResponse', onMessage);
            },
            (e) => {
                this.off('message.BluetoothGATTGetServicesResponse', onMessage);
                throw e;
            }
        );
        return { address, servicesList };
    }

    async readBluetoothGATTCharacteristicService(address, handle) {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        return await this.sendMessageAwaitResponse(
            new pb.BluetoothGATTReadRequest([address, handle]),
            'BluetoothGATTReadResponse'
        );
    }

    async writeBluetoothGATTCharacteristicService(
        address,
        handle,
        value,
        response = false
    ) {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);

        const message = new pb.BluetoothGATTWriteRequest([
            address,
            handle,
            response,
            value,
        ]);
        if (!response) return this.sendMessage(message);

        return await this.sendMessageAwaitResponse(
            message,
            'BluetoothGATTWriteResponse'
        );
    }

    async notifyBluetoothGATTCharacteristicService(address, handle) {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        return await this.sendMessageAwaitResponse(
            new pb.BluetoothGATTNotifyRequest([address, handle, true]),
            'BluetoothGATTNotifyResponse'
        );
    }

    async readBluetoothGATTDescriptorService(address, handle) {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        return await this.sendMessageAwaitResponse(
            new pb.BluetoothGATTReadDescriptorRequest([address, handle]),
            'BluetoothGATTReadResponse'
        );
    }

    async writeBluetoothGATTDescriptorService(
        address,
        handle,
        value,
        waitForResponse = false
    ) {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        const message = new pb.BluetoothGATTWriteDescriptorRequest([
            address,
            handle,
            value,
        ]);
        if (!waitForResponse) return this.sendMessage(message);

        return await this.sendMessageAwaitResponse(
            message,
            'BluetoothGATTWriteResponse'
        );
    }
}

module.exports = EsphomeNativeApiConnection;
