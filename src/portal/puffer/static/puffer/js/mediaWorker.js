let mediaSource = null;
let vbuf = null;
let abuf = null;

self.onmessage = function (e) {
    const message = e.data;

    switch (message.type) {
        case 'initialize':
            initializeMediaSource(message.videoCodec, message.audioCodec, message.initSeekTs);
            break;

        case 'sourceopen':
            setupSourceBuffers();
            break;

        case 'vbuf_update':
            if (vbuf && !vbuf.updating) {
                vbuf.appendBuffer(message.chunk.data);
                postMessage({ type: 'vbuf_update' });
            }
            break;

        case 'abuf_update':
            if (abuf && !abuf.updating) {
                abuf.appendBuffer(message.chunk.data);
                postMessage({ type: 'abuf_update' });
            }
            break;

        default:
            console.log('Unknown message type:', message.type);
    }
};

function initializeMediaSource(videoCodec, audioCodec, initSeekTs) {
    mediaSource = new MediaSource();

    mediaSource.addEventListener('sourceopen', function () {
        postMessage({ type: 'sourceopen' });
    });

    mediaSource.addEventListener('error', function (e) {
        postMessage({ type: 'error', error: e.message });
    });

    mediaSource.addEventListener('sourceclose', function () {
        postMessage({ type: 'error', error: 'MediaSource closed' });
    });

    const handle = mediaSource.handle;
    postMessage({ type: 'initialized', handle: handle });
}

function setupSourceBuffers() {
    vbuf = mediaSource.addSourceBuffer(videoCodec);
    abuf = mediaSource.addSourceBuffer(audioCodec);

    vbuf.timestampOffset = initSeekTs;
    abuf.timestampOffset = initSeekTs;

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
