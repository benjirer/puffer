let socket;
function keepAlive() {
    function loop() {
        postMessage('keep-alive');
        setTimeout(loop, 100); // Frequent interval to prevent throttling
    }
    loop();
}

function connectWebSocket() {
    socket = new WebSocket('wss://echo.websocket.org');
    socket.onopen = function () {
        socket.send('keep-alive');
    };
    socket.onmessage = function (event) {
        // Echo the message back to keep the connection alive
        socket.send(event.data);
    };
    socket.onclose = function () {
        // Reconnect if the connection is closed
        setTimeout(connectWebSocket, 1000);
    };
}

keepAlive();
connectWebSocket();
