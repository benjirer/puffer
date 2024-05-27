self.onmessage = function (e) {
  const { action, videoCodec, audioCodec, data, buffer } = e.data;

  if (action === 'initialize') {
    self.mediaSource = new MediaSource();
    self.mediaSourceHandle = self.mediaSource.handle;

    self.mediaSource.addEventListener('sourceopen', () => {
      self.postMessage({ action: 'sourceopen' });
    });

    self.mediaSource.addEventListener('sourceclose', () => {
      self.postMessage({ action: 'sourceclose' });
    });

    self.mediaSource.addEventListener('error', (e) => {
      self.postMessage({ action: 'error', error: e });
    });

    self.mediaSource.addEventListener('sourceended', () => {
      self.postMessage({ action: 'sourceended' });
    });
  }

  if (action === 'initSourceBuffers') {
    try {
      self.videoSourceBuffer = self.mediaSource.addSourceBuffer(videoCodec);
      self.audioSourceBuffer = self.mediaSource.addSourceBuffer(audioCodec);

      self.videoSourceBuffer.addEventListener('updateend', () => {
        self.postMessage({ action: 'updateend', buffer: 'video' });
      });

      self.audioSourceBuffer.addEventListener('updateend', () => {
        self.postMessage({ action: 'updateend', buffer: 'audio' });
      });

      self.postMessage({ action: 'sourceBufferAdded', buffer: 'video' });
      self.postMessage({ action: 'sourceBufferAdded', buffer: 'audio' });
    } catch (e) {
      self.postMessage({ action: 'error', error: e.message });
    }
  }

  if (action === 'appendBuffer') {
    if (buffer === 'video' && self.videoSourceBuffer) {
      self.videoSourceBuffer.appendBuffer(data);
    } else if (buffer === 'audio' && self.audioSourceBuffer) {
      self.audioSourceBuffer.appendBuffer(data);
    }
  }
};
