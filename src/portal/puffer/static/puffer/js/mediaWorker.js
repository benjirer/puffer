self.onmessage = function (e) {
    const { type, data } = e.data;

    switch (type) {
        case 'init':
            self.initWorker(data);
            break;
        case 'video':
            self.handleVideo(data.metadata, data.data, data.msg_ts);
            break;
        case 'audio':
            self.handleAudio(data.metadata, data.data, data.msg_ts);
            break;
        case 'close':
            self.closeWorker();
            break;
        case 'isRebuffering':
            self.postMessage({ type: 'isRebuffering', rebuffering: self.isRebuffering() });
            break;
        case 'getVideoBuffer':
            self.postMessage({ type: 'getVideoBuffer', buffer: self.getVideoBuffer() });
            break;
        case 'getAudioBuffer':
            self.postMessage({ type: 'getAudioBuffer', buffer: self.getAudioBuffer() });
            break;
    }
};

self.initWorker = function (data) {
    self.channel = data.channel;
    self.video_codec = data.videoCodec;
    self.audio_codec = data.audioCodec;
    self.timescale = data.timescale;
    self.video_duration = data.videoDuration;
    self.audio_duration = data.audioDuration;
    self.init_seek_ts = Math.max(data.initAudioTimestamp, data.initVideoTimestamp);

    self.next_video_timestamp = data.initVideoTimestamp;
    self.next_audio_timestamp = data.initAudioTimestamp;

    self.pending_video_chunks = [];
    self.pending_audio_chunks = [];

    self.vbuf_couple = [];
    self.abuf_couple = [];

    self.ms = new MediaSource();

    self.ms.addEventListener('sourceopen', self.initSourceBuffers);
    self.ms.addEventListener('sourceended', () => console.log('sourceended'));
    self.ms.addEventListener('sourceclose', self.closeWorker);
    self.ms.addEventListener('error', self.closeWorker);

    self.postMessage({ type: 'ms_url', url: URL.createObjectURL(self.ms) });
};

self.initSourceBuffers = function () {
    console.log('Initializing new media source buffer');

    self.vbuf = self.ms.addSourceBuffer(self.video_codec);
    try {
        self.abuf = self.ms.addSourceBuffer(self.audio_codec);
    } catch (err) {
        self.postMessage({ type: 'fatal_error', error_message: 'audio not supported' });
        return;
    }

    self.vbuf.addEventListener('updateend', () => {
        if (self.vbuf_couple.length > 0) {
            var data_to_ack = self.vbuf_couple.shift();
            self.postMessage({ type: 'video_ack', data_to_ack });
        }
        self.vbuf_update();
    });

    self.abuf.addEventListener('updateend', () => {
        if (self.abuf_couple.length > 0) {
            var data_to_ack = self.abuf_couple.shift();
            self.postMessage({ type: 'audio_ack', data_to_ack });
        }
        self.abuf_update();
    });
};

self.handleVideo = function (metadata, data, msg_ts) {
    if (self.channel !== metadata.channel) {
        console.log('error: should have ignored data from incorrect channel');
        return;
    }

    if (self.curr_video_format !== metadata.format) {
        self.curr_video_format = metadata.format;
        self.partial_video_chunks = [];
    }
    self.partial_video_chunks.push(data);

    self.curr_ssim = metadata.ssim;

    if (data.byteLength + metadata.byteOffset === metadata.totalByteLength) {
        self.pending_video_chunks.push({
            metadata: metadata,
            data: self.concat_arraybuffers(self.partial_video_chunks, metadata.totalByteLength)
        });
        self.partial_video_chunks = [];

        self.next_video_timestamp = metadata.timestamp + self.video_duration;
        self.curr_video_bitrate = 0.001 * 8 * metadata.totalByteLength / (self.video_duration / self.timescale);

        self.vbuf_update();
    } else {
        self.postMessage({ type: 'video_ack', data_to_ack: metadata });
    }
};

self.handleAudio = function (metadata, data, msg_ts) {
    if (self.channel !== metadata.channel) {
        console.log('error: should have ignored data from incorrect channel');
        return;
    }

    if (self.curr_audio_format !== metadata.format) {
        self.curr_audio_format = metadata.format;
        self.partial_audio_chunks = [];
    }
    self.partial_audio_chunks.push(data);

    if (data.byteLength + metadata.byteOffset === metadata.totalByteLength) {
        self.pending_audio_chunks.push({
            metadata: metadata,
            data: self.concat_arraybuffers(self.partial_audio_chunks, metadata.totalByteLength)
        });
        self.partial_audio_chunks = [];

        self.next_audio_timestamp = metadata.timestamp + self.audio_duration;

        self.abuf_update();
    } else {
        self.postMessage({ type: 'audio_ack', data_to_ack: metadata });
    }
};

self.vbuf_update = function () {
    if (self.vbuf && !self.vbuf.updating && self.pending_video_chunks.length > 0) {
        var next_video = self.pending_video_chunks.shift();
        self.vbuf.appendBuffer(next_video.data);
        self.vbuf_couple.push(next_video.metadata);
    }
};

self.abuf_update = function () {
    if (self.abuf && !self.abuf.updating && self.pending_audio_chunks.length > 0) {
        var next_audio = self.pending_audio_chunks.shift();
        self.abuf.appendBuffer(next_audio.data);
        self.abuf_couple.push(next_audio.metadata);
    }
};

self.concat_arraybuffers = function (arr, len) {
    var tmp = new Uint8Array(len);
    arr.reduce(function (i, x) {
        tmp.set(new Uint8Array(x), i);
        return i + x.byteLength;
    }, 0);
    return tmp.buffer;
};

self.isRebuffering = function () {
    const tolerance = 0.1; // seconds

    if (self.vbuf && self.vbuf.buffered.length === 1 &&
        self.abuf && self.abuf.buffered.length === 1) {
        const min_buf = Math.min(self.vbuf.buffered.end(0), self.abuf.buffered.end(0));
        if (min_buf - video.currentTime >= tolerance) {
            return false;
        }
    }

    return true;
};

self.getVideoBuffer = function () {
    if (self.vbuf && self.vbuf.buffered.length === 1 &&
        self.vbuf.buffered.end(0) >= video.currentTime) {
        return self.vbuf.buffered.end(0) - video.currentTime;
    }

    return 0;
};

self.getAudioBuffer = function () {
    if (self.abuf && self.abuf.buffered.length === 1 &&
        self.abuf.buffered.end(0) >= video.currentTime) {
        return self.abuf.buffered.end(0) - video.currentTime;
    }

    return 0;
};

self.closeWorker = function () {
    if (self.ms) {
        console.log('Closing media source buffer');
    }

    self.ms = null;
    self.vbuf = null;
    self.abuf = null;

    self.vbuf_couple = [];
    self.abuf_couple = [];

    self.pending_video_chunks = [];
    self.pending_audio_chunks = [];
};
