self.onmessage = function (e) {
  const { type, data } = e.data;

  if (type === 'init') {
    // Initialize MediaSource and create handles
    self.mediaSource = new MediaSource();
    const handle = self.mediaSource.handle;

    // Send handle back to main thread
    postMessage({ type: 'init', handle });

    self.mediaSource.addEventListener('sourceopen', () => {
      console.log('MediaSource opened');
      postMessage({ type: 'sourceopen' });
    });

    self.mediaSource.addEventListener('sourceended', () => {
      console.log('MediaSource ended');
    });

    self.mediaSource.addEventListener('sourceclose', () => {
      console.log('MediaSource closed');
    });
  } else if (type === 'addSourceBuffer') {
    if (data.mediaType === 'video') {
      self.videoSourceBuffer = self.mediaSource.addSourceBuffer(data.mimeType);
      self.videoSourceBuffer.addEventListener('updateend', () => {
        postMessage({ type: 'updateend', mediaType: 'video' });
      });
    } else if (data.mediaType === 'audio') {
      self.audioSourceBuffer = self.mediaSource.addSourceBuffer(data.mimeType);
      self.audioSourceBuffer.addEventListener('updateend', () => {
        postMessage({ type: 'updateend', mediaType: 'audio' });
      });
    }
  } else if (type === 'appendBuffer') {
    if (data.mediaType === 'video') {
      self.videoSourceBuffer.appendBuffer(data.buffer);
    } else if (data.mediaType === 'audio') {
      self.audioSourceBuffer.appendBuffer(data.buffer);
    }
  }
};
