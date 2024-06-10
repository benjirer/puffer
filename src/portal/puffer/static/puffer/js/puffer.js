'use strict';

const WS_OPEN = 1;
const BASE_RECONNECT_BACKOFF = 250;
const MAX_RECONNECT_BACKOFF = 10000;
const CONN_TIMEOUT = 30000; /* close the connection after 30-second timeout */

var debug = false;
var nonsecure = false;
var username = '';
var port = null;
var csrf_token = '';
var video = document.getElementById('tv-video');

var fatal_error = false;
function set_fatal_error(error_message) {
  if (fatal_error) {
    return;
  }

  fatal_error = true;
  clear_player_errors();
  add_player_error(error_message, 'fatal');
  stop_spinner();
  hide_play_button();
}

function report_error(init_id, error_description) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/error_reporting/');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('X-CSRFToken', csrf_token);
  xhr.send(JSON.stringify({
    'username': username,
    'init_id': init_id,
    'error': error_description
  }));
}

/* Server messages are of the form: "short_metadata_len|metadata_json|data" */
function parse_server_msg(data) {
  var metadata_len = new DataView(data, 0, 2).getUint16(0);

  var byte_array = new Uint8Array(data);
  var raw_metadata = byte_array.subarray(2, 2 + metadata_len);
  var media_data = byte_array.subarray(2 + metadata_len);

  /* parse metadata with JSON */
  var metadata = null;
  if (window.TextDecoder) {
    metadata = JSON.parse(new TextDecoder().decode(raw_metadata));
  } else {
    /* fallback if TextDecoder is not supported on some browsers */
    metadata = JSON.parse(String.fromCharCode.apply(null, raw_metadata));
  }

  return {
    metadata: metadata,
    data: media_data
  };
}

/* Client messages are json_data */
function format_client_msg(msg_type, data) {
  data.type = msg_type;
  return JSON.stringify(data);
}

/* Concatenates an array of arraybuffers */
function concat_arraybuffers(arr, len) {
  var tmp = new Uint8Array(len);
  arr.reduce(function (i, x) {
    tmp.set(new Uint8Array(x), i);
    return i + x.byteLength;
  }, 0);
  return tmp.buffer;
}

function AVSource(ws_client, server_init) {
  var that = this;

  var channel = server_init.channel;
  const video_codec = server_init.videoCodec;
  const audio_codec = server_init.audioCodec;
  const timescale = server_init.timescale;
  const video_duration = server_init.videoDuration;
  const audio_duration = server_init.audioDuration;
  const init_seek_ts = Math.max(server_init.initAudioTimestamp, server_init.initVideoTimestamp);

  var next_video_timestamp = server_init.initVideoTimestamp;
  var next_audio_timestamp = server_init.initAudioTimestamp;

  var worker = new Worker('mediaWorker.js');

  // Initialize worker
  worker.postMessage({
    type: 'init',
    server_init: server_init,
    video_codec: video_codec,
    audio_codec: audio_codec,
    timescale: timescale,
    video_duration: video_duration,
    audio_duration: audio_duration,
    init_seek_ts: init_seek_ts
  });

  video.srcObject = new MediaSourceHandle(worker);
  video.load();

  this.isOpen = function () {
    return worker !== null;
  };

  this.close = function () {
    if (worker) {
      worker.terminate();
      worker = null;
    }
  };

  this.handleVideo = function (metadata, data, msg_ts) {
    if (channel !== metadata.channel) {
      console.log('error: should have ignored data from incorrect channel');
      return;
    }
    worker.postMessage({
      type: 'handleVideo',
      metadata: metadata,
      data: data
    });
  };

  this.handleAudio = function (metadata, data, msg_ts) {
    if (channel !== metadata.channel) {
      console.log('error: should have ignored data from incorrect channel');
      return;
    }
    worker.postMessage({
      type: 'handleAudio',
      metadata: metadata,
      data: data
    });
  };

  this.getChannel = function () {
    return channel;
  };

  this.getVideoFormat = function () {
    worker.postMessage({ type: 'getVideoFormat' });
  };

  this.getSSIMdB = function () {
    worker.postMessage({ type: 'getSSIMdB' });
  };

  this.getVideoBitrate = function () {
    worker.postMessage({ type: 'getVideoBitrate' });
  };

  this.getAudioFormat = function () {
    worker.postMessage({ type: 'getAudioFormat' });
  };

  this.getVideoBuffer = function () {
    worker.postMessage({ type: 'getVideoBuffer' });
  };

  this.getAudioBuffer = function () {
    worker.postMessage({ type: 'getAudioBuffer' });
  };

  this.isRebuffering = function () {
    worker.postMessage({ type: 'isRebuffering' });
  };

  this.getNextVideoTimestamp = function () {
    worker.postMessage({ type: 'getNextVideoTimestamp' });
  };

  this.getNextAudioTimestamp = function () {
    worker.postMessage({ type: 'getNextAudioTimestamp' });
  };

  // Listen for messages from the worker
  worker.onmessage = function (event) {
    switch (event.data.type) {
      case 'setVideoFormat':
        that.curr_video_format = event.data.value;
        break;
      case 'setSSIMdB':
        that.curr_ssim = event.data.value;
        break;
      case 'setVideoBitrate':
        that.curr_video_bitrate = event.data.value;
        break;
      case 'setAudioFormat':
        that.curr_audio_format = event.data.value;
        break;
      case 'setVideoBuffer':
        that.videoBuffer = event.data.value;
        break;
      case 'setAudioBuffer':
        that.audioBuffer = event.data.value;
        break;
      case 'setRebuffering':
        that.rebuffering = event.data.value;
        break;
      case 'setNextVideoTimestamp':
        next_video_timestamp = event.data.value;
        break;
      case 'setNextAudioTimestamp':
        next_audio_timestamp = event.data.value;
        break;
      case 'clientAck':
        ws_client.send_client_ack(event.data.ackType, event.data.metadata);
        break;
    }
  };
}

function WebSocketClient(session_key, username_in, settings_debug, port_in,
  csrf_token_in, sysinfo) {
  /* if DEBUG = True in settings.py, connect to non-secure WebSocket server */
  debug = settings_debug;
  nonsecure = settings_debug;

  username = username_in;
  port = port_in;
  csrf_token = csrf_token_in;

  var that = this;

  var ws = null;
  var av_source = null;

  /* init as a random uint32 and increment every time a client-init is sent */
  var init_id = Math.floor(Math.random() * 4294967296);

  /* record the screen sizes reported to the server as they might change */
  var screen_width = null;
  var screen_height = null;

  /* exponential backoff to reconnect */
  var reconnect_backoff = BASE_RECONNECT_BACKOFF;

  var set_channel_ts = null;  /* timestamp (in ms) of setting a channel */
  var startup_delay_ms = null;

  var rebuffer_start_ts = null;  /* timestamp (in ms) of starting to rebuffer */
  var last_rebuffer_ts = null;  /* timestamp (in ms) of last rebuffer */
  var cum_rebuffer_ms = 0;

  /* last timestamp when received a message from server */
  var last_msg_recv_ts = null;

  var channel_error = false;

  this.send_client_init = function (channel) {
    if (fatal_error) {
      return;
    }

    if (!(ws && ws.readyState === WS_OPEN)) {
      return;
    }

    init_id += 1;

    const screen_size = get_screen_size();
    screen_width = screen_size[0];
    screen_height = screen_size[1];

    var msg = {
      initId: init_id,
      sessionKey: session_key,
      userName: username,
      channel: channel,
      os: sysinfo.os,
      browser: sysinfo.browser,
      screenWidth: screen_width,
      screenHeight: screen_height
    };

    /* try resuming if the client is already watching the same channel */
    if (av_source && av_source.isOpen() && av_source.getChannel() === channel) {
      msg.nextVts = av_source.getNextVideoTimestamp();
      msg.nextAts = av_source.getNextAudioTimestamp();
    }

    ws.send(format_client_msg('client-init', msg));

    if (debug) {
      console.log('sent client-init', msg);
    }
  };

  this.send_client_info = function (info_event) {
    if (fatal_error || channel_error) {
      return;
    }

    if (!(ws && ws.readyState === WS_OPEN)) {
      return;
    }

    /* note that it is fine if av_source.isOpen() is false */
    if (!av_source) {
      return;
    }

    /* skip sending client-info because vbuf.buffered.end(0) can sometimes
     * return a huge number erroneously */
    if (av_source.getVideoBuffer() > 30 ||
      av_source.getAudioBuffer() > 30) {
      return;
    }

    var msg = {
      initId: init_id,
      event: info_event,
      videoBuffer: parseFloat(av_source.getVideoBuffer().toFixed(3)),
      audioBuffer: parseFloat(av_source.getAudioBuffer().toFixed(3)),
      cumRebuffer: cum_rebuffer_ms / 1000.0,
    };

    /* include screen sizes if they have changed */
    const screen_size = get_screen_size();
    if (screen_size[0] !== screen_width || screen_size[1] !== screen_height) {
      screen_width = screen_size[0];
      screen_height = screen_size[1];
      msg.screenWidth = screen_width;
      msg.screenHeight = screen_height;
    }

    ws.send(format_client_msg('client-info', msg));

    if (debug) {
      console.log('sent client-info', msg);
    }
  };

  /* ack_type: 'client-vidack' or 'client-audack' */
  this.send_client_ack = function (ack_type, data_to_ack) {
    if (fatal_error || channel_error) {
      return;
    }

    if (!(ws && ws.readyState === WS_OPEN)) {
      return;
    }

    /* note that it is fine if av_source.isOpen() is false */
    if (!av_source) {
      return;
    }

    var msg = {
      initId: init_id,
      videoBuffer: parseFloat(av_source.getVideoBuffer().toFixed(3)),
      audioBuffer: parseFloat(av_source.getAudioBuffer().toFixed(3)),
      cumRebuffer: cum_rebuffer_ms / 1000.0,
    };

    msg.channel = data_to_ack.channel;
    msg.format = data_to_ack.format;
    msg.timestamp = data_to_ack.timestamp;

    msg.byteOffset = data_to_ack.byteOffset;
    msg.totalByteLength = data_to_ack.totalByteLength;
    /* byteLength is a new field we added to metadata */
    msg.byteLength = data_to_ack.byteLength;

    if (ack_type === 'client-vidack') {
      msg.ssim = data_to_ack.ssim;

      ws.send(format_client_msg(ack_type, msg));
    } else if (ack_type === 'client-audack') {
      ws.send(format_client_msg(ack_type, msg));
    } else {
      console.log('invalid ack type:', ack_type);
      return;
    }

    if (debug) {
      console.log('sent', ack_type, msg);
    }
  };

  /* handle a WebSocket message from the server */
  function handle_ws_msg(e) {
    if (fatal_error) {
      return;
    }

    last_msg_recv_ts = Date.now();

    const msg_ts = e.timeStamp;
    const server_msg = parse_server_msg(e.data);
    var metadata = server_msg.metadata;

    if (debug) {
      console.log('received', metadata.type, metadata);
    }

    /* check fatal errors regardless of init_id */
    if (metadata.type === 'server-error') {
      /* report received server-error */
      report_error(init_id, 'server-error: ' + metadata.errorType);

      if (metadata.errorType === 'maintenance') {
        set_fatal_error(metadata.errorMessage);
        ws.close();
        return;
      }

      if (metadata.errorType === 'limit') {
        set_fatal_error(metadata.errorMessage);
        ws.close();
        return;
      }
    }

    /* ignore outdated messages from the server */
    if (metadata.initId !== init_id) {
      return;
    }

    const data = server_msg.data;
    /* always add one more field to metadata: total length of data */
    metadata.byteLength = data.byteLength;

    if (metadata.type === 'server-error') {
      if (metadata.errorType === 'reinit') {
        add_player_error(metadata.errorMessage, 'channel');
        channel_error = true;

        /* send a client-init requesting the same channel (without resuming) */
        if (av_source) {
          that.set_channel(av_source.getChannel());
        }
      } else if (metadata.errorType === 'unavailable') {
        /* this channel is not currently available */
        add_player_error(metadata.errorMessage, 'channel');
        channel_error = true;
      }
    } else if (metadata.type === 'server-init') {
      /* return if client is able to resume */
      if (av_source && av_source.isOpen() && metadata.canResume) {
        console.log('Resuming playback');
        return;
      }

      /* create a new AVSource if it does not exist or unable to resume */
      av_source = new AVSource(that, metadata);
    } else if (metadata.type === 'server-video') {
      if (!av_source) {
        console.log('Error: AVSource is not initialized yet');
        return;
      }

      /* reset reconnect_backoff once a new media chunk is received */
      reconnect_backoff = BASE_RECONNECT_BACKOFF;

      /* note: handleVideo can buffer chunks even if !av_source.isOpen() */
      av_source.handleVideo(metadata, data, msg_ts);
    } else if (metadata.type === 'server-audio') {
      if (!av_source) {
        console.log('Error: AVSource is not initialized yet');
        return;
      }

      /* reset reconnect_backoff once a new media chunk is received */
      reconnect_backoff = BASE_RECONNECT_BACKOFF;

      /* note: handleAudio can buffer chunks even if !av_source.isOpen() */
      av_source.handleAudio(metadata, data, msg_ts);
    } else {
      console.log('received unknown message', metadata);
    }
  }

  this.connect = function (channel) {
    if (fatal_error) {
      return;
    }

    const ws_host_port = location.hostname + ':' + port;
    const ws_addr = nonsecure ? 'ws://' + ws_host_port
      : 'wss://' + ws_host_port;
    ws = new WebSocket(ws_addr);

    ws.binaryType = 'arraybuffer';
    ws.onmessage = handle_ws_msg;

    ws.onopen = function (e) {
      console.log('Connected to', ws_addr);
      remove_player_error('connect');

      last_msg_recv_ts = Date.now();

      /* try to resume if possible, so shouldn't call set_channel */
      soft_set_channel(channel);
    };

    ws.onclose = function (e) {
      console.log('Closed connection to', ws_addr);
      ws = null;

      if (fatal_error) {
        return;
      }

      if (reconnect_backoff < MAX_RECONNECT_BACKOFF) {
        /* Try to reconnect */
        console.log('Reconnecting in ' + reconnect_backoff + 'ms');

        setTimeout(function () {
          add_player_error(
            'Error: failed to connect to server. Reconnecting...', 'connect'
          );
          report_error(init_id, 'reconnect');

          if (av_source) {
            /* Try to resume the connection */
            that.connect(av_source.getChannel());
          } else {
            that.connect(channel);
          }
        }, reconnect_backoff);

        reconnect_backoff = reconnect_backoff * 2;
      } else {
        set_fatal_error(
          'Error: failed to connect to server. Please try again later.'
        );
        report_error(init_id, 'abort reconnect');
      }
    };

    ws.onerror = function (e) {
      console.log('WebSocket error:', e);
      ws = null;
    };
  };

  /* set to a channel without closing av_source; resume if possible */
  function soft_set_channel(channel) {
    /* render UI */
    start_spinner();
    remove_player_error('channel');
    channel_error = false;

    /* send client-init */
    that.send_client_init(channel);

    /* reset stats */
    set_channel_ts = Date.now();
    startup_delay_ms = null;

    rebuffer_start_ts = null;
    last_rebuffer_ts = null;
    cum_rebuffer_ms = 0;
  }

  /* set to a channel and reset av_source */
  this.set_channel = function (channel) {
    if (fatal_error) {
      return;
    }

    /* call 'close' to allocate a new MediaSource more quickly later */
    if (av_source) {
      av_source.close();
    }

    soft_set_channel(channel);
  };

  video.oncanplay = function () {
    var play_promise = video.play();

    if (play_promise !== undefined) {
      play_promise.then(function () {
        // playback started; only render UI here
        stop_spinner();
        hide_play_button();
      }).catch(function (error) {
        // playback failed
        show_play_button();
        add_player_error(
          'Error: your browser prevented muted autoplay. Please click ' +
          'the play button to start playback.', 'channel');
        channel_error = true;
        report_error(init_id, error);
      });
    }
  };

  video.onwaiting = function () {
    // playback stalled; only render UI here
    start_spinner();
  };

  /* check if *video or audio* is rebuffering every 50 ms */
  function check_rebuffering() {
    if (fatal_error || !av_source || !av_source.isOpen()) {
      return;
    }

    const rebuffering = av_source.isRebuffering();
    const curr_ts = Date.now();

    if (startup_delay_ms === null) {
      if (!rebuffering) {
        /* this is the first time that the channel has started playing */
        stop_spinner();
        console.log('Channel starts playing');

        /* calculate startup delay */
        startup_delay_ms = curr_ts - set_channel_ts;
        cum_rebuffer_ms += startup_delay_ms;

        /* inform server of startup delay (via cum_rebuffer_ms) */
        that.send_client_info('startup');
      }

      /* always return when startup_delay_ms is null */
      return;
    }

    if (rebuffering) {
      if (rebuffer_start_ts === null) {
        /* channel stops playing and starts rebuffering */
        start_spinner();
        console.log('Channel starts rebuffering');

        /* inform server */
        that.send_client_info('rebuffer');

        /* record the starting point of rebuffering */
        rebuffer_start_ts = curr_ts;
      }

      /* update cumulative rebuffering */
      if (last_rebuffer_ts !== null) {
        cum_rebuffer_ms += curr_ts - last_rebuffer_ts;
      }

      /* record this rebuffering */
      last_rebuffer_ts = curr_ts;
    } else {
      if (rebuffer_start_ts !== null) {
        /* the channel resumes playing from rebuffering */
        stop_spinner();
        console.log('Channel resumes playing');

        /* inform server */
        that.send_client_info('play');

        /* record that video resumes playing */
        rebuffer_start_ts = null;
      }

      /* record that video is playing */
      last_rebuffer_ts = null;
    }
  }
  setInterval(check_rebuffering, 50);

  /* send client-info timer every 250 ms */
  function send_client_info_timer() {
    if (fatal_error) {
      return;
    }

    /* send timer after channel starts playing */
    if (startup_delay_ms !== null) {
      that.send_client_info('timer');
    }

    /* periodically update vbuf and abuf in case 'updateend' is not fired */
    if (av_source) {
      av_source.vbuf_update();
      av_source.abuf_update();
    }
  }
  setInterval(send_client_info_timer, 250);

  /* check if the connection is timed out every second */
  function check_conn_timeout() {
    if (fatal_error || last_msg_recv_ts === null) {
      return;
    }

    if (Date.now() - last_msg_recv_ts > CONN_TIMEOUT) {
      set_fatal_error('Your connection has been closed after a timeout. ' +
        'Please reload the page.');
      report_error(init_id, 'connection timed out');
      ws.close();
    }
  }
  setInterval(check_conn_timeout, 1000);

  /* update debug info every 500 ms */
  function update_debug_info() {
    if (fatal_error) {
      return;
    }

    const na = 'N/A';
    var video_buf = document.getElementById('video-buf');
    var video_res = document.getElementById('video-res');
    var video_crf = document.getElementById('video-crf');
    var video_ssim = document.getElementById('video-ssim');
    var video_bitrate = document.getElementById('video-bitrate');

    if (av_source && av_source.isOpen()) {
      video_buf.innerHTML = av_source.getVideoBuffer().toFixed(1);

      var vformat_val = av_source.getVideoFormat();
      if (vformat_val) {
        const [vres_val, vcrf_val] = vformat_val.split('-');
        video_res.innerHTML = vres_val;
        video_crf.innerHTML = vcrf_val;
      } else {
        video_res.innerHTML = na;
        video_crf.innerHTML = na;
      }

      const vssim_val = av_source.getSSIMdB();
      video_ssim.innerHTML = vssim_val ? vssim_val.toFixed(2) : na;

      const vbitrate_val = av_source.getVideoBitrate();
      video_bitrate.innerHTML = vbitrate_val ? vbitrate_val.toFixed(2) : na;
    } else {
      video_buf.innerHTML = na;
      video_res.innerHTML = na;
      video_crf.innerHTML = na;
      video_ssim.innerHTML = na;
      video_bitrate.innerHTML = na;
    }
  }
  setInterval(update_debug_info, 500);
}