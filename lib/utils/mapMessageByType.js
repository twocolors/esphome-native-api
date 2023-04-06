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
            return { ...obj, name };
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
