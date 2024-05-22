self.onmessage = function (e) {
    if (e.data === 'start') {
        self.keepAlive();
    }
};

self.keepAlive = function () {
    function loop() {
        self.postMessage('keep-alive');
        setTimeout(loop, 1000); // Adjust the interval as needed
    }
    loop();
};
