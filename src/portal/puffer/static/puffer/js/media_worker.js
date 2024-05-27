// media_worker.js
let mediaSource = new MediaSource();
let videoSourceBuffer, audioSourceBuffer;
let handle = mediaSource.handle;

// Transfer the handle to the main thread
self.postMessage({ handle }, [handle]);

mediaSource.addEventListener("sourceopen", () => {
  console.log("MediaSource opened");
});

self.onmessage = (event) => {
  const { action, data } = event.data;

  switch (action) {
    case 'initSourceBuffers':
      const { videoCodec, audioCodec } = data;
      videoSourceBuffer = mediaSource.addSourceBuffer(videoCodec);
      audioSourceBuffer = mediaSource.addSourceBuffer(audioCodec);

      videoSourceBuffer.addEventListener("updateend", () => {
        self.postMessage({ action: 'videoUpdateEnd' });
      });

      audioSourceBuffer.addEventListener("updateend", () => {
        self.postMessage({ action: 'audioUpdateEnd' });
      });
      break;

    case 'appendVideoBuffer':
      videoSourceBuffer.appendBuffer(data.buffer);
      break;

    case 'appendAudioBuffer':
      audioSourceBuffer.appendBuffer(data.buffer);
      break;
  }
};
