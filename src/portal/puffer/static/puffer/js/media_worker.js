self.onmessage = function (event) {
  const { videoCodec, audioCodec, initSeekTs, timescale } = event.data;

  if (!self.mediaSource) {
    self.mediaSource = new MediaSource();
  }

  self.mediaSource.addEventListener('sourceopen', () => {
    self.videoSourceBuffer = self.mediaSource.addSourceBuffer(videoCodec);
    self.audioSourceBuffer = self.mediaSource.addSourceBuffer(audioCodec);

    self.postMessage({ mediaSourceHandle: self.mediaSource.handle });
  });

  self.appendBuffer = function (sourceBuffer, data) {
    sourceBuffer.appendBuffer(data);
  };

  self.mediaSource.addEventListener('sourceopen', () => {
    self.mediaSource.duration = Infinity;
    self.mediaSource.readyState === 'open' && self.postMessage({ mediaSourceOpen: true });
  });
};

self.onerror = function (error) {
  self.postMessage({ error: error.message });
};
