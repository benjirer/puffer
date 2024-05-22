function keepAlive() {
    function loop() {
        postMessage('keep-alive');
        setTimeout(loop, 100); // Frequent interval to prevent throttling
    }
    loop();
}

keepAlive();
