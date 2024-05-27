self.onmessage = function (event) {
  const data = event.data;

  if (data.type === 'init') {
    self.mediaSource = new MediaSource();
    self.mediaSourceHandle = self.mediaSource.handle;
    self.postMessage({ type: 'mediaSourceHandle', handle: self.mediaSourceHandle }, [self.mediaSourceHandle]);

    self.mediaSource.addEventListener('sourceopen', () => {
      self.videoSourceBuffer = self.mediaSource.addSourceBuffer(data.videoCodec);
      self.audioSourceBuffer = self.mediaSource.addSourceBuffer(data.audioCodec);

      self.videoSourceBuffer.addEventListener('updateend', () => {
        self.postMessage({ type: 'videoUpdateEnd' });
      });

      self.audioSourceBuffer.addEventListener('updateend', () => {
        self.postMessage({ type: 'audioUpdateEnd' });
      });
    });
  } else if (data.type === 'video') {
    self.videoSourceBuffer.appendBuffer(data.data);
  } else if (data.type === 'audio') {
    self.audioSourceBuffer.appendBuffer(data.data);
  }
};
