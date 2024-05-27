self.onmessage = function (event) {
  const data = event.data;

  if (data.type === 'init') {
    self.videoCodec = data.videoCodec;
    self.audioCodec = data.audioCodec;

    self.pendingVideoChunks = [];
    self.pendingAudioChunks = [];
  } else if (data.type === 'video') {
    self.pendingVideoChunks.push(data.data);
    self.processVideoBuffer();
  } else if (data.type === 'audio') {
    self.pendingAudioChunks.push(data.data);
    self.processAudioBuffer();
  }
};

self.processVideoBuffer = function () {
  while (self.pendingVideoChunks.length > 0) {
    const chunk = self.pendingVideoChunks.shift();
    // Process video chunk (no actual video element to append to)
    self.postMessage({ type: 'videoUpdateEnd' });
  }
};

self.processAudioBuffer = function () {
  while (self.pendingAudioChunks.length > 0) {
    const chunk = self.pendingAudioChunks.shift();
    // Process audio chunk (no actual video element to append to)
    self.postMessage({ type: 'audioUpdateEnd' });
  }
};
