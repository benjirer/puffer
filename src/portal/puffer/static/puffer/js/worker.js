// Importing necessary script
importScripts('/static/puffer/js/puffer.js');

// Listener for messages from the main thread
onmessage = function (event) {
    const { type, data } = event.data;

    switch (type) {
        case 'init':
            this.ws_client = new WebSocketClient(
                data.sessionKey, data.username, data.settingsDebug,
                data.port, data.csrfToken, data.sysinfo
            );
            break;
        case 'set_channel':
            if (this.ws_client) {
                this.ws_client.set_channel(data.channel);
            }
            break;
        case 'connect':
            if (this.ws_client) {
                this.ws_client.connect(data.channel);
            }
            break;
        default:
            console.error('Unknown message type');
    }
};
