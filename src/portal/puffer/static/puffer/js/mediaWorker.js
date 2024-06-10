let video_codec, audio_codec, timescale, video_duration, audio_duration, init_seek_ts;
let next_video_timestamp, next_audio_timestamp;
let pending_video_chunks = [];
let pending_audio_chunks = [];
let vbuf, abuf;
let curr_video_format, curr_ssim, curr_video_bitrate;
let curr_audio_format;
let vbuf_couple = [];
let abuf_couple = [];

onmessage = function (event) {
    switch (event.data.type) {
        case 'init':
            init(event.data);
            break;
        case 'handleVideo':
            handleVideo(event.data.metadata, event.data.data);
            break;
        case 'handleAudio':
            handleAudio(event.data.metadata, event.data.data);
            break;
        case 'getVideoFormat':
            postMessage({ type: 'setVideoFormat', value: curr_video_format });
            break;
        case 'getSSIMdB':
            postMessage({ type: 'setSSIMdB', value: curr_ssim });
            break;
        case 'getVideoBitrate':
            postMessage({ type: 'setVideoBitrate', value: curr_video_bitrate });
            break;
        case 'getAudioFormat':
            postMessage({ type: 'setAudioFormat', value: curr_audio_format });
            break;
        case 'getVideoBuffer':
            postMessage({ type: 'setVideoBuffer', value: getVideoBuffer() });
            break;
        case 'getAudioBuffer':
            postMessage({ type: 'setAudioBuffer', value: getAudioBuffer() });
            break;
        case 'isRebuffering':
            postMessage({ type: 'setRebuffering', value: isRebuffering() });
            break;
        case 'getNextVideoTimestamp':
            postMessage({ type: 'setNextVideoTimestamp', value: next_video_timestamp });
            break;
        case 'getNextAudioTimestamp':
            postMessage({ type: 'setNextAudioTimestamp', value: next_audio_timestamp });
            break;
    }
};

function init(data) {
    video_codec = data.video_codec;
    audio_codec = data.audio_codec;
    timescale = data.timescale;
    video_duration = data.video_duration;
    audio_duration = data.audio_duration;
    init_seek_ts = data.init_seek_ts;
    next_video_timestamp = data.server_init.initVideoTimestamp;
    next_audio_timestamp = data.server_init.initAudioTimestamp;

    let ms = new MediaSource();
    ms.addEventListener('sourceopen', () => {
        vbuf = ms.addSourceBuffer(video_codec);
        abuf = ms.addSourceBuffer(audio_codec);

        vbuf.addEventListener('updateend', vbuf_update);
        abuf.addEventListener('updateend', abuf_update);
    });
    ms.addEventListener('sourceended', close);
    ms.addEventListener('sourceclose', close);
    ms.addEventListener('error', close);

    video.srcObject = ms;
}

function handleVideo(metadata, data) {
    if (curr_video_format !== metadata.format) {
        curr_video_format = metadata.format;
    }
    pending_video_chunks.push({
        metadata: metadata,
        data: data
    });

    curr_ssim = metadata.ssim;
    next_video_timestamp = metadata.timestamp + video_duration;
    curr_video_bitrate = 0.001 * 8 * metadata.totalByteLength / (video_duration / timescale);

    vbuf_update();
}

function handleAudio(metadata, data) {
    if (curr_audio_format !== metadata.format) {
        curr_audio_format = metadata.format;
    }
    pending_audio_chunks.push({
        metadata: metadata,
        data: data
    });

    next_audio_timestamp = metadata.timestamp + audio_duration;
    abuf_update();
}

function vbuf_update() {
    if (vbuf && !vbuf.updating && pending_video_chunks.length > 0) {
        var next_video = pending_video_chunks.shift();
        vbuf.appendBuffer(next_video.data);
        vbuf_couple.push(next_video.metadata);
    }
    if (vbuf_couple.length > 0) {
        postMessage({
            type: 'clientAck',
            ackType: 'client-vidack',
            metadata: vbuf_couple.shift()
        });
    }
}

function abuf_update() {
    if (abuf && !abuf.updating && pending_audio_chunks.length > 0) {
        var next_audio = pending_audio_chunks.shift();
        abuf.appendBuffer(next_audio.data);
        abuf_couple.push(next_audio.metadata);
    }
    if (abuf_couple.length > 0) {
        postMessage({
            type: 'clientAck',
            ackType: 'client-audack',
            metadata: abuf_couple.shift()
        });
    }
}

function getVideoBuffer() {
    if (vbuf && vbuf.buffered.length === 1 && vbuf.buffered.end(0) >= video.currentTime) {
        return vbuf.buffered.end(0) - video.currentTime;
    }
    return 0;
}

function getAudioBuffer() {
    if (abuf && abuf.buffered.length === 1 && abuf.buffered.end(0) >= video.currentTime) {
        return abuf.buffered.end(0) - video.currentTime;
    }
    return 0;
}

function isRebuffering() {
    const tolerance = 0.1; // seconds
    if (vbuf && vbuf.buffered.length === 1 && abuf && abuf.buffered.length === 1) {
        const min_buf = Math.min(vbuf.buffered.end(0), abuf.buffered.end(0));
        return (min_buf - video.currentTime < tolerance);
    }
    return true;
}

function close() {
    vbuf = null;
    abuf = null;
    pending_video_chunks = [];
    pending_audio_chunks = [];
}
