function keepAlive() {
    function loop() {
        postMessage('keep-alive');
        requestAnimationFrame(loop); // Use requestAnimationFrame for smooth and frequent updates
    }
    loop();
}

keepAlive();
