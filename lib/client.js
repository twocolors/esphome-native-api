const EventEmitter = require("events");
const Connection = require('./connection');
const { create: createEntity, Entities } = require('./entities');
class EsphomeNativeApiClient extends EventEmitter {
    constructor({
            clearSession = true,
            initializeDeviceInfo = true,
            initializeListEntities = true,
            initializeSubscribeStates = true,
            initializeSubscribeLogs = false,
            initializeSubscribeBLEAdvertisements = false,
            ...config
        }) {
        super();
        this.propagateError = this.propagateError.bind(this);

        this.connection = new Connection(config);

        this.connection.on('authorized', async () => {
            this.connected = true;
            try {
                this.initialized = false;
                if (clearSession) {
                    for (const id of Object.keys(this.entities)) this.removeEntity(id);
                }
                if (initializeDeviceInfo) await this.connection.deviceInfoService();
                if (initializeListEntities) await this.connection.listEntitiesService();
                if (initializeSubscribeStates) await this.connection.subscribeStatesService();
                if (initializeSubscribeLogs) {
                    await this.connection.subscribeLogsService(...((initializeSubscribeLogs === true) ? [] : [ initializeSubscribeLogs.level, initializeSubscribeLogs.dumpConfig ]));
                }
                if (initializeSubscribeBLEAdvertisements) await this.connection.subscribeBluetoothAdvertisementService();
                this.initialized = true;
                this.emit('initialized');
            } catch(e) {
                this.emit('error', e);
                if (this.connection.connected) this.connection.frameHelper.end();
            }
        });
        this.connection.on('unauthorized', async () => {
            this.connected = false;
            this.initialized = false;
        });
        this.connection.on('message.DeviceInfoResponse', async deviceInfo => {
            this.deviceInfo = deviceInfo;
            this.emit('deviceInfo', deviceInfo);
        });
        for (const EntityClass of Object.values(Entities)) {
            this.connection.on(`message.${EntityClass.getListEntitiesResponseName()}`, async config => {
                if (!this.entities[config.key]) this.addEntity(EntityClass.name, config);
            });
        }
        this.connection.on('message.SubscribeLogsResponse', async data => {
            this.emit('logs', data);
        });
        this.connection.on('message.BluetoothLEAdvertisementResponse', async data => {
            this.emit('ble', data);
        });
        this.connection.on('error', async e => {
            this.emit('error', e);
        });

        this.deviceInfo = null;
        this.entities = {};
        this.initialized = false;
        this._connected = false;
        this._subscribeBLEAdvertisements = initializeSubscribeBLEAdvertisements;
    }
    set connected(value) {
        if (this._connected === value) return;
        this._connected = value;
        this.emit(this._connected ? 'connected' : 'disconnected');
    }
    get connected() {
        return this._connected;
    }
    connect() {
        this.connection.connect();
    }
    disconnect() {
        if (this.connection.connected && this._subscribeBLEAdvertisements) {
            this.connection.unsubscribeBluetoothAdvertisementService();
        }
        this.connection.disconnect();
    }
    addEntity(entityClassName, config) {
        if (this.entities[config.key]) throw new Error(`Entity with id(i.e key) ${config.key} is already added`);
        this.entities[config.key] = createEntity(entityClassName, { connection: this.connection, config });
        this.entities[config.key].on('error', this.propagateError);
        this.emit('newEntity', this.entities[config.key]);
    }
    removeEntity(id) {
        if (!this.entities[id]) throw new Error(`Cannot find entity with is(i.e. key) ${id}`);
        this.entities[id].destroy();
        this.entities[id].off('error', this.propagateError);
        delete this.entities[id];
    }
    // async
    // handlers
    async propagateError(e) {
        this.emit('error', e);
    }
}

module.exports = EsphomeNativeApiClient;
