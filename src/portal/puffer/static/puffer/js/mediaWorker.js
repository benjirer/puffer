let mediaSource = null;
let vbuf = null;
let abuf = null;
let videoCodec = null;
let audioCodec = null;
let initSeekTs = null;

self.onmessage = function (e) {
    const message = e.data;

    switch (message.type) {
        case 'initialize':
            videoCodec = message.videoCodec;
            audioCodec = message.audioCodec;
            initSeekTs = message.initSeekTs;
            initializeMediaSource();
            break;

        case 'vbuf_update':
            if (vbuf && !vbuf.updating) {
                const chunk = message.chunk;
                vbuf.appendBuffer(chunk.data);
                postMessage({ type: 'vbuf_update' });
            }
            break;

        case 'abuf_update':
            if (abuf && !abuf.updating) {
                const chunk = message.chunk;
                abuf.appendBuffer(chunk.data);
                postMessage({ type: 'abuf_update' });
            }
            break;

        case 'getVideoBuffer':
            if (vbuf && vbuf.buffered.length === 1 && vbuf.buffered.end(0) >= message.currentTime) {
                postMessage({ type: 'videoBuffer', buffer: vbuf.buffered.end(0) - message.currentTime });
            } else {
                postMessage({ type: 'videoBuffer', buffer: 0 });
            }
            break;

        case 'getAudioBuffer':
            if (abuf && abuf.buffered.length === 1 && abuf.buffered.end(0) >= message.currentTime) {
                postMessage({ type: 'audioBuffer', buffer: abuf.buffered.end(0) - message.currentTime });
            } else {
                postMessage({ type: 'audioBuffer', buffer: 0 });
            }
            break;

        case 'isRebuffering':
            const tolerance = 0.1; // seconds

            if (vbuf && vbuf.buffered.length === 1 && abuf && abuf.buffered.length === 1) {
                const min_buf = Math.min(vbuf.buffered.end(0), abuf.buffered.end(0));
                if (min_buf - message.currentTime >= tolerance) {
                    postMessage({ type: 'rebuffering', rebuffering: false });
                } else {
                    postMessage({ type: 'rebuffering', rebuffering: true });
                }
            }
            break;

        default:
            console.log('Unknown message type:', message.type);
    }
};

function initializeMediaSource() {
    mediaSource = new MediaSource();

    mediaSource.addEventListener('sourceopen', function () {
        setupSourceBuffers();
    });

    mediaSource.addEventListener('error', function (e) {
        postMessage({ type: 'error', error: e.message });
    });

    mediaSource.addEventListener('sourceclose', function () {
        postMessage({ type: 'error', error: 'MediaSource closed' });
    });

    const handle = mediaSource.handle;
    postMessage({ type: 'initialized', arg: handle }, [handle]);
}

function setupSourceBuffers() {
    vbuf = mediaSource.addSourceBuffer(videoCodec);
    abuf = mediaSource.addSourceBuffer(audioCodec);

    // vbuf.timestampOffset = initSeekTs;
    // abuf.timestampOffset = initSeekTs;

    postMessage({ type: 'sourceopen' });

    vbuf.addEventListener('updateend', function () {
        postMessage({ type: 'vbuf_update' });
    });

    vbuf.addEventListener('error', function (e) {
        postMessage({ type: 'error', error: 'Video buffer error: ' + e.message });
    });

    abuf.addEventListener('updateend', function () {
        postMessage({ type: 'abuf_update' });
    });

    abuf.addEventListener('error', function (e) {
        postMessage({ type: 'error', error: 'Audio buffer error: ' + e.message });
    });
}
