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

        case 'sourceopen':
            setupSourceBuffers();
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
            const videoBuffer = (vbuf && vbuf.buffered.length > 0) ? vbuf.buffered.end(0) - mediaSource.duration : 0;
            postMessage({ type: 'videoBuffer', buffer: videoBuffer });
            break;

        case 'getAudioBuffer':
            const audioBuffer = (abuf && abuf.buffered.length > 0) ? abuf.buffered.end(0) - mediaSource.duration : 0;
            postMessage({ type: 'audioBuffer', buffer: audioBuffer });
            break;

        case 'isRebuffering':
            const tolerance = 0.1; // seconds
            const minBuffer = Math.min(vbuf.buffered.end(0), abuf.buffered.end(0));
            const isRebuffering = minBuffer - mediaSource.duration < tolerance;
            postMessage({ type: 'rebufferingStatus', status: isRebuffering });
            break;

        default:
            console.log('Unknown message type:', message.type);
    }
};

function initializeMediaSource() {
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
