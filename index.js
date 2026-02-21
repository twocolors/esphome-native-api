const Connection = require('./lib/connection');
const Client = require('./lib/client');
const Discovery = require('./lib/discovery');
const { pb } = require('./lib/utils/messages');

const ServiceArgType = {
    Bool: pb.ServiceArgType.SERVICE_ARG_TYPE_BOOL,
    Int: pb.ServiceArgType.SERVICE_ARG_TYPE_INT,
    Float: pb.ServiceArgType.SERVICE_ARG_TYPE_FLOAT,
    String: pb.ServiceArgType.SERVICE_ARG_TYPE_STRING,
    BoolArray: pb.ServiceArgType.SERVICE_ARG_TYPE_BOOL_ARRAY,
    IntArray: pb.ServiceArgType.SERVICE_ARG_TYPE_INT_ARRAY,
    FloatArray: pb.ServiceArgType.SERVICE_ARG_TYPE_FLOAT_ARRAY,
    StringArray: pb.ServiceArgType.SERVICE_ARG_TYPE_STRING_ARRAY,
};

module.exports = {
    Connection,
    Client,
    Discovery,
    discovery: Discovery,
    ServiceArgType
}
