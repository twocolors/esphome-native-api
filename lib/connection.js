const EventEmitter = require("events");
const { Entities } = require('./entities');
const { mapMessageByType, isBase64 } = require("./utils/mapMessageByType");
const { pb } = require('./utils/messages');
const Package = require('../package.json');
const PlaintextFrameHelper = require('./utils/plaintextFrameHelper');
const NoiseFrameHelper = require('./utils/noiseFrameHelper');

class EsphomeNativeApiConnection extends EventEmitter {
    constructor({
        port = 6053,
        host,
        clientInfo = Package.name + ' ' + Package.version,
        password = '',
        encryptionKey = '',
        expectedServerName = '',
        reconnect = true,
        reconnectInterval = 30 * 1000,
        pingInterval = 15 * 1000,
        pingAttempts = 3
    }) {
        super();
        if (!host) throw new Error(`Host is required`);

        if (encryptionKey && (!isBase64(encryptionKey) || Buffer.from(encryptionKey, "base64").length !== 32)) {
            throw new Error(`Encryption key must be base64 and 32 bytes long`);
        }

        this.frameHelper = !encryptionKey ? new PlaintextFrameHelper(host, port) : new NoiseFrameHelper(host, port, encryptionKey, expectedServerName);

        this.frameHelper.on('message', (message) => {
            const type = message.constructor.type;
            const mapped = mapMessageByType(type, message.toObject());

            this.emit(`message.${type}`, mapped);
            this.emit('message', type, mapped);
        });

        // frame helper close
        this.frameHelper.on('close', () => {
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

        // frame helper connect
        this.frameHelper.on('connect', async () => {
            clearTimeout(this.reconnectTimer);
            this.connected = true;
            try {
                const helloResponse = await this.helloService(this.clientInfo);
                this.supportsRawBLEAdvertisements = helloResponse.apiVersionMajor > 1 ||
                    (helloResponse.apiVersionMajor === 1 && helloResponse.apiVersionMinor >= 9);

                // pre 2025.8 versions always **require** AuthenticationRequest() to be sent (even for encryption key connection) but newer versions **must not** send it for encryption key connections.
                const shouldUseLegacyAuthentication = helloResponse.apiVersionMajor === 1 && helloResponse.apiVersionMinor < 12;
                if (typeof this.password !== undefined && this.password || shouldUseLegacyAuthentication) {
                    const { invalidPassword } =  await this.connectService(this.password);
                    if (invalidPassword === true) throw new Error(`Invalid password`);
                }

                this.authorized = true;
            } catch(e) {
                this.emit('error', e);
                this.frameHelper.end();
            }
            this.pingTimer = setInterval(async () => {
                try {
                    await this.pingService();
                    this.pingCount = 0;
                } catch(e) {
                    if (++this.pingCount >= this.pingAttempts) {
                        this.frameHelper.end();
                    }
                }
            }, this.pingInterval);
        })

        // frame helper error
        this.frameHelper.on('error', (e) => {
            this.emit('error', e);
        })

        this.frameHelper.on('data', (data)=> {
            this.emit('data', data);
        })

        // DisconnectRequest
        this.on('message.DisconnectRequest', () => {
            try {
                this.sendMessage(new pb.DisconnectResponse());
                this.frameHelper.destroy();
            } catch(e) {
                this.emit('error', new Error(`Failed respond to DisconnectRequest. Reason: ${e.message}`));
            }
        })

        // DisconnectResponse
        this.on('message.DisconnectResponse', () => {
            this.frameHelper.destroy();
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

        this.on('message.BluetoothLERawAdvertisementsResponse', msg => {
            for(const advertisement of msg.advertisementsList)
                this.emit("message.BluetoothLEAdvertisementResponse", advertisement);
        })

        this._connected = false;
        this._authorized = false;

        this.port = port;
        this.host = host;
        this.clientInfo = clientInfo;
        this.password = password;
        this.encryptionKey = encryptionKey;
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
        this.frameHelper.connect();
    }
    disconnect() {
        clearInterval(this.pingTimer);
        clearTimeout(this.reconnectTimer);
        if (this.connected) {
            try {
                this.sendMessage(new pb.DisconnectRequest());
            } catch(e) {}
        }
        this.authorized = false;
        this.connected = false;
        this.reconnect = false;
        this.frameHelper.removeAllListeners();
        this.removeAllListeners();
        this.frameHelper.destroy();
    }
    sendMessage(message) {
        if (!this.connected) throw new Error(`Socket is not connected`);
        this.frameHelper.sendMessage(message);
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
            reject(new Error(`sendMessage timeout waiting for ${responseMessageTypeName}`));
          }, timeoutSeconds * 1000);
        })
    }
    async helloService(clientInfo) {
        const message = new pb.HelloRequest();

        if (clientInfo !== undefined) message.setClientInfo(clientInfo);

        return await this.sendMessageAwaitResponse(message, 'HelloResponse');
    }
    async connectService(password) {
        const message = new pb.AuthenticationRequest();

        if (typeof password !== undefined) message.setPassword(password);

        return await this.sendMessageAwaitResponse(message, 'AuthenticationResponse');
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
            'ListEntitiesButtonResponse',
            'ListEntitiesMediaPlayerResponse',
            'ListEntitiesTextResponse',
            'ListEntitiesServicesResponse'
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
    subscribeLogsService(level = pb.LogLevel.LOG_LEVEL_DEBUG, dumpConfig = false) {
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
    mediaPlayerCommandService(data) {
        Entities.MediaPlayer.commandService(this, data);
    }
    subscribeBluetoothAdvertisementService() {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        this.sendMessage(new pb.SubscribeBluetoothLEAdvertisementsRequest([this.supportsRawBLEAdvertisements ? 1: 0]))
    }
    unsubscribeBluetoothAdvertisementService() {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        this.sendMessage(new pb.UnsubscribeBluetoothLEAdvertisementsRequest());
    }
    async connectBluetoothDeviceService(address, addressType, useCache = false) {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        const message = new pb.BluetoothDeviceRequest([
            address,
            useCache ? pb.BluetoothDeviceRequestType.BLUETOOTH_DEVICE_REQUEST_TYPE_CONNECT_V3_WITH_CACHE : pb.BluetoothDeviceRequestType.BLUETOOTH_DEVICE_REQUEST_TYPE_CONNECT_V3_WITHOUT_CACHE
        ]);
        if(addressType != undefined) {
            message.setHasAddressType(true);
            message.setAddressType(addressType);
        }
        return await this.sendMessageAwaitResponse(
            message,
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
    async pairBluetoothDeviceService(address) {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        return await this.sendMessageAwaitResponse(
            new pb.BluetoothDeviceRequest([
                address,
                pb.BluetoothDeviceRequestType
                .BLUETOOTH_DEVICE_REQUEST_TYPE_PAIR,
            ]),
            'BluetoothDevicePairingResponse',
            10
        );
    }
    async unpairBluetoothDeviceService(address) {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        return await this.sendMessageAwaitResponse(
            new pb.BluetoothDeviceRequest([
                address,
                pb.BluetoothDeviceRequestType
                .BLUETOOTH_DEVICE_REQUEST_TYPE_UNPAIR,
            ]),
            'BluetoothDeviceUnpairingResponse',
            10
        );
    }
    async listBluetoothGATTServicesService(address) {
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
        return await this.sendMessageAwaitResponse(
            new pb.BluetoothGATTWriteRequest([
                address,
                handle,
                response,
                value,
            ]),
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
        value
    ) {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        await this.sendMessageAwaitResponse(
            new pb.BluetoothGATTWriteDescriptorRequest([
                address,
                handle,
                value,
            ]),
            'BluetoothGATTWriteResponse'
        );
    }

    textCommandService(data) {
        Entities.Text.commandService(this, data);
    }
    executeServiceService({ key, args = [] }) {
        if (!this.connected) throw new Error(`Not connected`);
        if (!this.authorized) throw new Error(`Not authorized`);
        const message = new pb.ExecuteServiceRequest();
        message.setKey(key);
        for (const { type, value } of args) {
            const arg = new pb.ExecuteServiceArgument();
            switch (type) {
                case pb.ServiceArgType.SERVICE_ARG_TYPE_BOOL:
                    arg.setBool(value);
                    break;
                case pb.ServiceArgType.SERVICE_ARG_TYPE_INT:
                    arg.setInt(value);
                    arg.setLegacyInt(value);
                    break;
                case pb.ServiceArgType.SERVICE_ARG_TYPE_FLOAT:
                    arg.setFloat(value);
                    break;
                case pb.ServiceArgType.SERVICE_ARG_TYPE_STRING:
                    arg.setString(value);
                    break;
                case pb.ServiceArgType.SERVICE_ARG_TYPE_BOOL_ARRAY:
                    arg.setBoolArrayList(value);
                    break;
                case pb.ServiceArgType.SERVICE_ARG_TYPE_INT_ARRAY:
                    arg.setIntArrayList(value);
                    break;
                case pb.ServiceArgType.SERVICE_ARG_TYPE_FLOAT_ARRAY:
                    arg.setFloatArrayList(value);
                    break;
                case pb.ServiceArgType.SERVICE_ARG_TYPE_STRING_ARRAY:
                    arg.setStringArrayList(value);
                    break;
                default:
                    throw new Error(`Unknown service arg type: ${type}`);
            }
            message.addArgs(arg);
        }
        this.sendCommandMessage(message);
    }
}

module.exports = EsphomeNativeApiConnection;
