const { pb } = require('../utils/messages');
const Base = require('./Base')

// string icon = 5;
// bool disabled_by_default = 6;
// EntityCategory entity_category = 7;
// uint32 min_length = 8;
// uint32 max_length = 9;
// string pattern = 10;
// TextMode mode = 11;
class Text extends Base {
    constructor(data) {
        super(data);
    }
    // fixed32 key = 1;
    // string state = 2;
    static commandService(connection, {
        key,
        state
    }) {
        if (!connection) throw new Error('connection is not attached');
        const message = new pb.TextCommandRequest();
        message.setKey(key);
        message.setState(state);
        connection.sendCommandMessage(message);
    }
    command(data) {
        this.constructor.commandService(this.connection, { ...data, key: this.config.key });
    }
    setState(state) {
        if (state < this.config.minLength) throw new Error(`state(${state}) is less than the minimum(${this.config.minLength})`);
        if (state > this.config.maxLength) throw new Error(`state(${state}) is greater than the maximum(${this.config.maxLength})`);
        this.command({ state });
    }
}

module.exports = Text;