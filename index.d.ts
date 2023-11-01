declare module "@2colors/esphome-native-api" {
    export type HelloResponse = {
        apiVersionMajor: number;
        apiVersionMinor: number;
        serverInfo: string;
        name: string;
    };

    export type ConnectResponse = {
        invalidPassword: boolean;
    };

    export type DeviceInfoResponse = {
        usesPassword: boolean;
        name: string;
        macAddress: string;
        esphomeVersion: string;
        compilationTime: string;
        model: string;
        hasDeepSleep: boolean;
        projectName: string;
        projectVersion: string;
        webserverPort: number;
        bluetoothProxyVersion: number;
        manufacturer: string;
        friendlyName: string;
    };

    export type GetTimeResponse = { epochSeconds: number };

    export enum EntityCategory {
        None = 0,
        Config = 1,
        Diagnostic = 2,
    }

    export type ListEntitiesEntityResponse = {
        objectId: string;
        key: number;
        name: string;
        uniqueId: string;

        disabledByDefault: boolean;
        icon: string;
        entityCategory: EntityCategory;
    };

    export type ListEntitiesBinarySensorResponse =
        ListEntitiesEntityResponse & {
            deviceClass: string;
            isStatusBinarySensor: boolean;
        };

    export type ListEntitiesCoverResponse = ListEntitiesEntityResponse & {
        assumedState: boolean;
        supportsPosition: boolean;
        supportsTilt: boolean;
    };

    export type ListEntitiesFanResponse = ListEntitiesEntityResponse & {
        supportsOscillation: boolean;
        supportsSpeed: boolean;
        supportsDirection: boolean;
        supportedSpeedLevels: number;
    };

    export enum ColorMode {
        Unknown = 0,
        OnOff = 1,
        Brightness = 2,
        White = 3,
        ColorTemperature = 4,
        ColdWarmWhite = 5,
        RGB = 6,
        RGBWhite = 7,
        RGBColorTemperature = 8,
        RGBColdWarmWhite = 9,
    }

    export type ListEntitiesLightResponse = ListEntitiesEntityResponse & {
        supportedColorModesList: ColorMode[];
        minMireds: number;
        maxMireds: number;
        effectsList: string[];
    };

    export enum SensorLastResetType {
        None = 0,
        Never = 1,
        Auto = 2,
    }

    export enum SensorStateClass {
        None = 0,
        Measurement = 1,
        TotalIncreasing = 2,
        Total = 3,
    }

    export type ListEntitiesSensorResponse = ListEntitiesEntityResponse & {
        deviceClass: string;
        unitOfMeasurement: string;
        accuracyDecimals: number;
        forceUpdate: boolean;
        stateClass: SensorStateClass;
        lastResetType: SensorLastResetType;
    };

    export type ListEntitiesSwitchResponse = ListEntitiesEntityResponse & {
        deviceClass: string;
        assumedState: boolean;
    };

    export enum ClimateMode {
        Off = 0,
        HeatCool = 1,
        Cool = 2,
        Heat = 3,
        FanOnly = 4,
        Dry = 5,
        Auto = 6,
    }

    export enum ClimateFanMode {
        On = 0,
        Off = 1,
        Auto = 2,
        Low = 3,
        Medium = 4,
        High = 5,
        Middle = 6,
        Focus = 7,
        Diffuse = 8,
        Quiet = 9,
    }

    export enum ClimateSwingMode {
        Off = 0,
        Both = 1,
        Vertical = 2,
        Horizontal = 3,
    }

    export enum ClimatePreset {
        None = 0,
        Home = 1,
        Away = 2,
        Boost = 3,
        Comfort = 4,
        Eco = 5,
        Sleep = 6,
        Activity = 7,
    }

    export type ListEntitiesClimateResponse = ListEntitiesEntityResponse & {
        supportsCurrentTemperature: boolean;
        supportsTwoPointTargetTemperature: boolean;
        supportedModesList: ClimateMode[];
        visualMinTemperature: number;
        visualMaxTemperature: number;
        visualTemperatureStep: number;
        supportsAction: boolean;
        supportedFanModesList: ClimateFanMode[];
        supportedSwingModesList: ClimateSwingMode[];
        supportedCustomFanModesList: string[];
        supportedPresetsList: ClimatePreset[];
        supportedCustomPresetsList: string[];
    };

    export enum NumberMode {
        Auto = 0,
        Box = 1,
        Slider = 2,
    }

    export type ListEntitiesNumberResponse = ListEntitiesEntityResponse & {
        minValue: number;
        maxValue: number;
        step: number;
        unitOfMeasurement: string;
        mode: NumberMode;
        deviceClass: string;
    };

    export type ListEntitiesSelectResponse = ListEntitiesEntityResponse & {
        optionsList: string[];
    };

    export type ListEntitiesSirenResponse = ListEntitiesEntityResponse & {
        tonesList: string[];
        supportsDuration: boolean;
        supportsVolume: boolean;
    };

    export type ListEntitiesLockResponse = ListEntitiesEntityResponse & {
        assumedState: boolean;
        supportsOpen: boolean;
        requiresCode: boolean;
        codeFormat: string;
    };

    export type ListEntitiesButtonResponse = ListEntitiesEntityResponse & {
        deviceClass: string;
    };

    export type ListEntitiesMediaPlayerResponse = ListEntitiesEntityResponse & {
        supportsPause: boolean;
    };

    type Components =
        | "BinarySensor"
        | "Cover"
        | "Fan"
        | "Light"
        | "Sensor"
        | "Switch"
        | "TextSensor"
        | "Camera"
        | "Climate"
        | "Number"
        | "Select"
        | "Siren"
        | "Lock"
        | "Button"
        | "MediaPlayer";

    type Entities =
        | ListEntitiesEntityResponse
        | ListEntitiesBinarySensorResponse
        | ListEntitiesCoverResponse
        | ListEntitiesFanResponse
        | ListEntitiesLightResponse
        | ListEntitiesSensorResponse
        | ListEntitiesSwitchResponse
        | ListEntitiesClimateResponse
        | ListEntitiesNumberResponse
        | ListEntitiesSelectResponse
        | ListEntitiesSirenResponse
        | ListEntitiesLockResponse
        | ListEntitiesButtonResponse
        | ListEntitiesMediaPlayerResponse;

    export type EntityList = {
        component: Components;
        entity: Entities;
    }[];

    export enum LogLevel {
        None = 0,
        Error = 1,
        Warn = 2,
        Info = 3,
        Config = 4,
        Debug = 5,
        Verbose = 6,
        VeryVerbose = 7,
    }

    export type SubscribeLogsResponse = {
        level: number;
        message: string;
        sendFailed: boolean;
    };

    export type BluetoothLEAdvertisementResponse = {
        address: number;
        name: string;
        rssi: number;
        serviceDataList: {
            uuid: string;
            legacyDataList: Uint8Array;
            data: string;
        }[];
        addressType: number;
    };

    export type BluetoothLERawAdvertisementsResponse = {
        address: number;
        rssi: number;
        data: string;
        addressType: number;
    };

    export type BluetoothDeviceConnectionResponse = {
        address: number;
        connected: boolean;
        mtu: number;
        error: number;
    };

    export type BluetoothGATTCharacteristicDescriptor = {
        uuid: string;
        handle: number;
    };
    export type BluetoothGATTCharacteristic = {
        uuid: string;
        handle: number;
        properties: number;
        descriptorsList: BluetoothGATTCharacteristicDescriptor[];
    };
    export type BluetoothGATTService = {
        uuid: string;
        handle: number;
        characteristicsList: BluetoothGATTCharacteristic[];
    };
    export type BluetoothGATTGetServicesResponse = {
        address: number;
        servicesList: BluetoothGATTService[];
    };

    export type BluetoothGATTReadResponse = {
        address: number;
        handle: number;
        data: string;
    };
    export type BluetoothGATTWriteResponse = {
        address: number;
        handle: number;
    };

    export type BluetoothGATTNotifyResponse = {
        address: number;
        handle: number;
    }

    export type BluetoothGATTNotifyDataResponse = BluetoothGATTNotifyResponse & {
        data: string;
    };

    export type CommandData = {
        key: number;
    };
    export type ClimateCommandData = CommandData & {
        mode?: ClimateMode;
        targetTemperature?: number;
        targetTemperatureLow?: number;
        targetTemperatureHigh?: number;
        legacyAway?: boolean;
        fanMode?: ClimateFanMode;
        swingMode?: ClimateSwingMode;
        customFanMode?: string;
        preset?: ClimatePreset;
        customPreset?: string;
    };
    export enum LegacyCoverCommand {
        LEGACY_COVER_COMMAND_OPEN = 0,
        LEGACY_COVER_COMMAND_CLOSE = 1,
        LEGACY_COVER_COMMAND_STOP = 2
    }
    export type CoverCommandData = CommandData & {
        legacyCommand?: LegacyCoverCommand;
        position?: number;
        tilt?: number;
        stop?: boolean;
    };
    export enum FanDirection {
        Forward = 0,
        Reverse = 1,
    }
    export type FanCommandData = CommandData & {
        state?: boolean;
        oscillating?: boolean;
        direction?: FanDirection;
        speedLevel?: number;
    };
    export type LightCommandData = CommandData & {
        state?: boolean;
        brightness?: number;
        colorMode?: number;
        colorBrightness?: number;
        red?: number;
        green?: number;
        blue?: number;
        white?: number;
        colorTemperature?: number;
        coldWhite?: number;
        warmWhite?: number;
        transitionLength?: number;
        flashLength?: number;
        effect?: string;
    };
    export enum LockCommand {
        Unlock = 0,
        Lock = 1,
        Open = 2,
    }
    export type LockCommandData = CommandData & {
        command: LockCommand;
        code?: string;
    };
    export type NumberCommandData = CommandData & {
        state: number;
    };
    export type SelectCommandData = CommandData & {
        state: string;
    };
    export type SirenCommandData = CommandData & {
        state?: boolean;
        tone?: string;
        duration?: number;
        volume?: number;
    };
    export type SwitchCommandData = CommandData & {
        state: boolean;
    };
    export enum MediaPlayerCommand {
        Play = 0,
        Pause = 1,
        Stop = 2,
        Mute = 3,
        Unmute = 4,
    }
    export type MediaPlayerCommandData = CommandData & {
        command: MediaPlayerCommand;
        volume: number;
        mediaUrl: string;
    };

    export type ConnectionConfig = {
        host: string;
        port?: number;
        password?: string;
        encryptionKey?: string;
        expectedServerName?: string;
        clientInfo?: string;
        reconnect?: boolean;
        reconnectInterval?: number;
        pingInterval?: number;
        pingAttempts?: number;
    }

    export type ClientConfig = ConnectionConfig & {
        clearSession?: boolean;
        initializeDeviceInfo?: boolean;
        initializeListEntities?: boolean;
        initializeSubscribeStates?: boolean;
        initializeSubscribeLogs?: boolean;
        initializeSubscribeBLEAdvertisements?: boolean;
    }

    export class Client {
        constructor(config: ClientConfig);

        connection: Connection;
    }

    export class Connection {
        constructor(config: ConnectionConfig);

        host: string;
        port: number;
        clientInfo: string;
        password: string;
        reconnect: boolean;
        reconnectInterval: number;
        pingInterval: number;
        pingAttempts: number;
        pingCount: number;

        set connected(value: boolean);
        get connected(): boolean;

        set authorized(value: boolean);
        get authorized(): boolean;

        connect(): void;
        disconnect(): void;

        helloService(clientInfo: string): Promise<HelloResponse>;
        connectService(password: string): Promise<ConnectResponse>;
        disconnectService(): Promise<void>;
        pingService(): Promise<void>;
        deviceInfoService(): Promise<DeviceInfoResponse>;
        getTimeService(): Promise<GetTimeResponse>;
        listEntitiesService(): Promise<EntityList>;
        subscribeLogsService(level?: LogLevel, dumpConfig?: boolean): void;

        buttonCommandService(data: CommandData): void;
        climateCommandService(data: ClimateCommandData): void;
        coverCommandService(data: CoverCommandData): void;
        fanCommandService(data: FanCommandData): void;
        lightCommandService(data: LightCommandData): void;
        lockCommandService(data: LockCommandData): void;
        numberCommandService(data: NumberCommandData): void;
        selectCommandService(data: SelectCommandData): void;
        sirenCommandService(data: SirenCommandData): void;
        switchCommandService(data: SwitchCommandData): void;
        mediaPlayerCommandService(data: MediaPlayerCommandData): void;

        subscribeBluetoothAdvertisementService(): void;
        unsubscribeBluetoothAdvertisementService(): void;
        connectBluetoothDeviceService(
            address: number
        ): Promise<BluetoothDeviceConnectionResponse>;
        disconnectBluetoothDeviceService(
            address: number
        ): Promise<BluetoothDeviceConnectionResponse>;
        pairBluetoothDeviceService(
            address: number
        ): Promise<BluetoothDeviceConnectionResponse>;
        unpairBluetoothDeviceService(
            address: number
        ): Promise<BluetoothDeviceConnectionResponse>;
        listBluetoothGATTServicesService(
            address: number
        ): Promise<BluetoothGATTGetServicesResponse>;

        readBluetoothGATTCharacteristicService(
            address: number,
            handle: number
        ): Promise<BluetoothGATTReadResponse>;
        writeBluetoothGATTCharacteristicService(
            address: number,
            handle: number,
            value: Uint8Array,
            response?: boolean
        ): Promise<BluetoothGATTWriteResponse>;
        notifyBluetoothGATTCharacteristicService(
            address: number,
            handle: number
        ): Promise<BluetoothGATTNotifyResponse>;

        readBluetoothGATTDescriptorService(
            address: number,
            handle: number
        ): Promise<BluetoothGATTReadResponse>;
        writeBluetoothGATTDescriptorService(
            address: number,
            handle: number,
            value: Uint8Array
        ): Promise<void>;

        once(event: "error", listener: (error: any) => void): this;
        once(event: "authorized", listener: () => void): this;

        // listEntitiesService Events
        on(
            event: "message.ListEntitiesBinarySensorResponse",
            listener: (message: ListEntitiesBinarySensorResponse) => void
        ): this;
        off(
            event: "message.ListEntitiesBinarySensorResponse",
            listener: (message: ListEntitiesBinarySensorResponse) => void
        ): this;

        on(
            event: "message.ListEntitiesCoverResponse",
            listener: (message: ListEntitiesCoverResponse) => void
        ): this;
        off(
            event: "message.ListEntitiesCoverResponse",
            listener: (message: ListEntitiesCoverResponse) => void
        ): this;

        on(
            event: "message.ListEntitiesFanResponse",
            listener: (message: ListEntitiesFanResponse) => void
        ): this;
        off(
            event: "message.ListEntitiesFanResponse",
            listener: (message: ListEntitiesFanResponse) => void
        ): this;

        on(
            event: "message.ListEntitiesLightResponse",
            listener: (message: ListEntitiesLightResponse) => void
        ): this;
        off(
            event: "message.ListEntitiesLightResponse",
            listener: (message: ListEntitiesLightResponse) => void
        ): this;

        on(
            event: "message.ListEntitiesSensorResponse",
            listener: (message: ListEntitiesSensorResponse) => void
        ): this;
        off(
            event: "message.ListEntitiesSensorResponse",
            listener: (message: ListEntitiesSensorResponse) => void
        ): this;

        on(
            event: "message.ListEntitiesSwitchResponse",
            listener: (message: ListEntitiesSwitchResponse) => void
        ): this;
        off(
            event: "message.ListEntitiesSwitchResponse",
            listener: (message: ListEntitiesSwitchResponse) => void
        ): this;

        on(
            event: "message.ListEntitiesTextSensorResponse",
            listener: (message: ListEntitiesEntityResponse) => void
        ): this;
        off(
            event: "message.ListEntitiesTextSensorResponse",
            listener: (message: ListEntitiesEntityResponse) => void
        ): this;

        on(
            event: "message.ListEntitiesCameraResponse",
            listener: (message: ListEntitiesEntityResponse) => void
        ): this;
        off(
            event: "message.ListEntitiesCameraResponse",
            listener: (message: ListEntitiesEntityResponse) => void
        ): this;

        on(
            event: "message.ListEntitiesClimateResponse",
            listener: (message: ListEntitiesClimateResponse) => void
        ): this;
        off(
            event: "message.ListEntitiesClimateResponse",
            listener: (message: ListEntitiesClimateResponse) => void
        ): this;

        on(
            event: "message.ListEntitiesNumberResponse",
            listener: (message: ListEntitiesNumberResponse) => void
        ): this;
        off(
            event: "message.ListEntitiesNumberResponse",
            listener: (message: ListEntitiesNumberResponse) => void
        ): this;

        on(
            event: "message.ListEntitiesSelectResponse",
            listener: (message: ListEntitiesSelectResponse) => void
        ): this;
        off(
            event: "message.ListEntitiesSelectResponse",
            listener: (message: ListEntitiesSelectResponse) => void
        ): this;

        on(
            event: "message.ListEntitiesSirenResponse",
            listener: (message: ListEntitiesSirenResponse) => void
        ): this;
        off(
            event: "message.ListEntitiesSirenResponse",
            listener: (message: ListEntitiesSirenResponse) => void
        ): this;

        on(
            event: "message.ListEntitiesLockResponse",
            listener: (message: ListEntitiesLockResponse) => void
        ): this;
        off(
            event: "message.ListEntitiesLockResponse",
            listener: (message: ListEntitiesLockResponse) => void
        ): this;

        on(
            event: "message.ListEntitiesButtonResponse",
            listener: (message: ListEntitiesButtonResponse) => void
        ): this;
        off(
            event: "message.ListEntitiesButtonResponse",
            listener: (message: ListEntitiesButtonResponse) => void
        ): this;

        on(
            event: "message.ListEntitiesMediaPlayerResponse",
            listener: (message: ListEntitiesMediaPlayerResponse) => void
        ): this;
        off(
            event: "message.ListEntitiesMediaPlayerResponse",
            listener: (message: ListEntitiesMediaPlayerResponse) => void
        ): this;

        // subscribeLogsService events
        on(
            event: "message.SubscribeLogsResponse",
            listener: (message: SubscribeLogsResponse) => void
        ): this;
        off(
            event: "message.SubscribeLogsResponse",
            listener: (message: SubscribeLogsResponse) => void
        ): this;

        // subscribeBluetoothAdvertisementService events
        on(
            event: "message.BluetoothLEAdvertisementResponse",
            listener: (message: BluetoothLEAdvertisementResponse) => void
        ): this;
        off(
            event: "message.BluetoothLEAdvertisementResponse",
            listener: (message: BluetoothLEAdvertisementResponse) => void
        ): this;
        on(
            event: "message.BluetoothLERawAdvertisementsResponse",
            listener: (message: BluetoothLERawAdvertisementsResponse) => void
        ): this;
        off(
            event: "message.BluetoothLERawAdvertisementsResponse",
            listener: (message: BluetoothLERawAdvertisementsResponse) => void
        ): this;

        // notifyBluetoothGATTCharacteristicService events
        on(
            event: "message.BluetoothGATTNotifyDataResponse",
            listener: (message: BluetoothGATTNotifyDataResponse) => void
        ): this;
        off(
            event: "message.BluetoothGATTNotifyDataResponse",
            listener: (message: BluetoothGATTNotifyDataResponse) => void
        ): this;

        on(event: string, listener: (...args: any[]) => void): this;
        off(event: string, listener: (...args: any[]) => void): this;
    }

    export type DiscoveryInfo = {
        host: string;
        port: number;
        address: string;
        family: string;

        // other values that might be returned
        [key: string]: any;
    };

    export class Discovery {
        run(): void;
        destroy(): void;
        on(event: "info", listener: (info: DiscoveryInfo) => void): this;
    }
}
