const { pb } = require('../utils/messages');
const Base = require('./Base')

// string icon = 5;
// bool disabled_by_default = 6;
// EntityCategory entity_category = 7;
// bool supports_pause = 8;
class MediaPlayer extends Base {
    constructor(data) {
        super(data);
    }
    // fixed32 key = 1;
    // bool has_command = 2;
    // MediaPlayerCommand command = 3;
    // bool has_volume = 4;
    // float volume = 5;
    // bool has_media_url = 6;
    // string media_url = 7;
    static commandService(connection, {
        key,
        command,
        volume,
        mediaUrl
    }) {
        if (!connection) throw new Error('connection is not attached');
        const message = new pb.MediaPlayerCommandRequest();
        message.setKey(key);
        if (command !== undefined) {
            message.setHasCommand(true);
            message.setCommand(command);
        }
        if (volume !== undefined) {
            message.setHasVolume(true);
            message.setVolume(volume);
        }
        if (mediaUrl !== undefined) {
            message.setHasMediaUrl(true);
            message.setMediaUrl(mediaUrl);
        }
        connection.sendCommandMessage(message);
    }
    command(data) {
        this.constructor.commandService(this.connection, { ...data, key: this.config.key });
    }
    setCommand(command) {
        if (command == pb.MediaPlayerCommand.MEDIA_PLAYER_COMMAND_PAUSE && !this.config.supportsPause) throw new Error("pause is not supported")
        this.command({ command });
    }
    setVolume(volume) {
        this.command({ volume });
    }
    setMediaUrl(mediaUrl) {
        this.command({ mediaUrl });
    }
}

module.exports = MediaPlayer;