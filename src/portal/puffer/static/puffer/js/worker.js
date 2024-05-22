self.keepAlive = function () {
    function loop() {
        self.postMessage('keep-alive');
        setTimeout(loop, 100); // Frequent interval to prevent throttling
    }
    loop();
};

self.keepAlive();