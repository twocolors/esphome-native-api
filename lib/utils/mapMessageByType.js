// https://github.com/miguelmota/is-base64/blob/master/is-base64.js#L17
const base64Regex = /^(?:[A-Za-z0-9+\\/]{4})*(?:[A-Za-z0-9+\\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;
const isBase64 = (payload) => new RegExp(base64Regex, "gi").test(payload);
const base64Decode = (message) =>
    isBase64(message)
        ? Buffer.from(message, "base64").toString("ascii")
        : message;

const uuidRegex = new RegExp(
    /([a-f0-9]{8})([a-f0-9]{4})([a-f0-9]{4})([a-f0-9]{4})([a-f0-9]{12})/
);
const uuidDecode = (segments) =>
    segments
        .map((segment) => BigInt(segment).toString(16).padStart(16, "0"))
        .join("")
        .replace(uuidRegex, "$1-$2-$3-$4-$5");
const hexBytesToNumber = bytes => bytes.reduce((acc, cur) => (acc << 8)+cur, 0);
const uuidFromBytes = (bytes, len = -1) => {
    if(len === -1) len = bytes.length;
    bytes = bytes.slice(0, len).reverse();
    const segments = [];
    while(len>8) {
        segments.push(hexBytesToNumber(bytes.slice(0, 8)).toString(16).padStart(16,'0'));
        bytes = bytes.slice(8);
        len -= 8;
    }
    if(len>0)
        segments.push(hexBytesToNumber(bytes).toString(16).padStart(len*2,'0'));

    return segments.join("");
}
const BT_BASE_UUID_SUFFIX = "0000-1000-8000-00805f9b34fb";
const makeShortUuid = (bytes, len = -1) => {
    return [
        uuidFromBytes(bytes, len).padStart(8, "0"),
        BT_BASE_UUID_SUFFIX
    ]
        .join("-")
        .toLowerCase();
};
const ensureFullUuid = (uuid) => {
    if(!uuid.startsWith("0x")) return uuid.toLowerCase();
    return [
        uuid.substring(2).padStart(8, "0"),
        BT_BASE_UUID_SUFFIX
    ]
        .join("-")
        .toLowerCase();
}
const makeFullUuid = (bytes) => {
    return Array.from(bytes.slice(0, 16).reverse())
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .replace(uuidRegex, "$1-$2-$3-$4-$5")
        .toLowerCase();
};
const ESP_BLE_AD_TYPE_16SRV_PART = 0x02;
const ESP_BLE_AD_TYPE_16SRV_CMPL = 0x03;
const ESP_BLE_AD_TYPE_32SRV_PART = 0x04;
const ESP_BLE_AD_TYPE_32SRV_CMPL = 0x05;
const ESP_BLE_AD_TYPE_128SRV_PART = 0x06;
const ESP_BLE_AD_TYPE_128SRV_CMPL = 0x07;
const ESP_BLE_AD_TYPE_NAME_SHORT = 0x08;
const ESP_BLE_AD_TYPE_NAME_CMPL = 0x09;
const ESP_BLE_AD_TYPE_SERVICE_DATA = 0x16;
const ESP_BLE_AD_TYPE_32SERVICE_DATA = 0x1C;
const ESP_BLE_AD_TYPE_128SERVICE_DATA = 0x1D;
const ESP_BLE_AD_MANUFACTURER_SPECIFIC_TYPE = 0xFF;
const mapRawAdvertisement = ({data, ...advertisement}) => {
    if (!advertisement.serviceUuidsList) advertisement.serviceUuidsList = [];
    if (!advertisement.serviceDataList) advertisement.serviceDataList = [];
    if (!advertisement.manufacturerDataList) advertisement.manufacturerDataList = [];

    const payload = new Uint8Array(Buffer.from(data, 'base64'));
    const len = payload.length;
    let offset = 0;
    while (offset + 2 < len) {
        const field_length = payload[offset++];
        if (field_length == 0) continue;
        const recordType = payload[offset++];
        const recordLength = field_length -1;
        const record = payload.slice(offset, offset+recordLength);
        offset += recordLength;

        switch (recordType) {
            case ESP_BLE_AD_TYPE_NAME_SHORT:
            case ESP_BLE_AD_TYPE_NAME_CMPL: {
                if (!advertisement.name || recordLength > advertisement.name.length)
                    advertisement.name = Buffer.from(record).toString();
                break;
            }
            case ESP_BLE_AD_TYPE_16SRV_CMPL:
            case ESP_BLE_AD_TYPE_16SRV_PART: {
                for (let i = 0; i < recordLength / 2; i++) {
                    advertisement.serviceUuidsList.push(makeShortUuid(record.slice(i*2), 2));
                }
                break;
            }
            case ESP_BLE_AD_TYPE_32SRV_CMPL:
            case ESP_BLE_AD_TYPE_32SRV_PART: {
                for (let i = 0; i < recordLength / 4; i++) {
                    advertisement.serviceUuidsList.push(makeShortUuid(record.slice(i*4), 4));
                }
                break;
            }
            case ESP_BLE_AD_TYPE_128SRV_CMPL:
            case ESP_BLE_AD_TYPE_128SRV_PART: {
                for (let i = 0; i < recordLength / 16; i++) {
                    advertisement.serviceUuidsList.push(makeFullUuid(record.slice(i*16)));
                }
                break;
            }
            case ESP_BLE_AD_MANUFACTURER_SPECIFIC_TYPE: {
                if (recordLength < 2) break;
                const uuid = makeShortUuid(record, 2)
                advertisement.manufacturerDataList.push({uuid, legacyDataList: Array.from(record.slice(2)), data:""});
                break;
            }
            case ESP_BLE_AD_TYPE_SERVICE_DATA: {
                if (recordLength < 2) break;
                const uuid = makeShortUuid(record, 2)
                advertisement.serviceDataList.push({uuid, legacyDataList: Array.from(record.slice(2)), data:""});
                break;
            }
            case ESP_BLE_AD_TYPE_32SERVICE_DATA: {
                if (recordLength < 4) break;
                const uuid = makeShortUuid(record, 4)
                advertisement.serviceDataList.push({uuid, legacyDataList: Array.from(record.slice(4)), data:""});
                break;
            }
            case ESP_BLE_AD_TYPE_128SERVICE_DATA: {
                if (recordLength < 16) break;
                const uuid = makeFullUuid(record)
                advertisement.serviceDataList.push({uuid, legacyDataList: Array.from(record.slice(16)), data:""});
                break;
            }
        }
    }
    return advertisement;
}
const mapMessageByType = (type, obj) => {
    switch (type) {
        case "SubscribeLogsResponse": {
            // decode message to string
            const message = base64Decode(obj.message);
            return { ...obj, message };
        }
        case "BluetoothLEAdvertisementResponse": {
            // decode name to string
            const name = base64Decode(obj.name);
            // tidy up advertised uuid
            const serviceUuidsList = (obj.serviceUuidsList || []).map(uuid => ensureFullUuid(uuid));
            const serviceDataList = (obj.serviceDataList || []).map(sd => sd.uuid = ensureFullUuid(sd.uuid));
            const manufacturerDataList = (obj.manufacturerDataList || []).map(md => md.uuid = ensureFullUuid(md.uuid));
            return { ...obj, name, serviceUuidsList, serviceDataList, manufacturerDataList };
        }
        case "BluetoothLERawAdvertisementsResponse": {
            const { advertisementsList, ...rest } = obj;

            return {
                ...rest,
                advertisementsList: advertisementsList.map(mapRawAdvertisement)
            };
        }
        case "BluetoothGATTGetServicesResponse": {
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

module.exports = {
    mapMessageByType,
    isBase64
}
