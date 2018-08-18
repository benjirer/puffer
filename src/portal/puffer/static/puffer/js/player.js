function load_script(script_path) {
  /* Create and append a new script */
  var new_script = document.createElement('script');
  new_script.type = 'text/javascript';
  new_script.src = script_path;
  document.getElementsByTagName('head')[0].appendChild(new_script);
  return new_script;
}

function start_dashjs(aid, session_key, username) {
  const channel_select = document.getElementById('channel-select');
  var manifest_url = '/static/puffer/media/' + channel_select.value + '/ready/live.mpd';

  var player = dashjs.MediaPlayer().create();
  player.initialize(document.getElementById('tv-video'), manifest_url, true);
  player.clearDefaultUTCTimingSources();

  channel_select.onchange = function() {
    console.log('set channel:', channel_select.value);
    player.attachSource('/static/puffer/media/' + channel_select.value + '/ready/live.mpd');
  };

  if (aid === 2) {  // default dash.js
  } else if (aid === 3) {  // BOLA dash.js
    player.setABRStrategy('abrBola');
  } else {
    /* Uncomment this block if you want to change the buffer size
       that dash.js tries to maintain */
    /*
    player.setBufferTimeAtTopQuality(60);
    player.setStableBufferTime(60);
    player.setBufferToKeep(60);
    player.setBufferPruningInterval(60);
    */

    /* algorithm IDs in pensieve:
      1: 'Fixed Rate'
      2: 'Buffer Based'
      3: 'Rate Based'
      4: 'Pensieve'
      5: 'Festive'
      6: (occupied)
      7: 'FastMPC
      8: 'RobustMPC' */
    pensieve_abr_id = aid - 3;

    if (pensieve_abr_id > 1) {
      player.enablerlABR(true);
    }

    player.setAbrAlgorithm(pensieve_abr_id);
  }
}

function setup_control_bar() {
  const video = document.getElementById('tv-video');
  const mute_button = document.getElementById('mute-button');
  const volume_bar = document.getElementById('volume-bar');
  const full_screen_button = document.getElementById('full-screen-button');
  const tv_container = document.getElementById('tv-container');
  const tv_controls = document.getElementById('tv-controls');
  const unmute_here = document.getElementById('unmute-here');

  const volume_on_img = 'url(/static/puffer/dist/images/volume-on.svg)';
  const volume_off_img = 'url(/static/puffer/dist/images/volume-off.svg)';

  video.volume = 0;
  mute_button.muted = true;
  volume_bar.value = video.volume;
  var last_volume_before_mute = 1;

  mute_button.onclick = function() {
    video.muted = false;

    if (mute_button.muted) {
      mute_button.muted = false;
      video.volume = last_volume_before_mute;
      volume_bar.value = video.volume;
      mute_button.style.backgroundImage = volume_on_img;
    } else {
      last_volume_before_mute = video.volume;

      mute_button.muted = true;
      video.volume = 0;
      volume_bar.value = 0;
      mute_button.style.backgroundImage = volume_off_img;
    }
  };

  volume_bar.oninput = function() {
    video.muted = false;

    video.volume = volume_bar.value;
    if (video.volume > 0) {
      mute_button.muted = false;
      mute_button.style.backgroundImage = volume_on_img;
    } else {
      mute_button.muted = true;
      mute_button.style.backgroundImage = volume_off_img;
    }
  };

  function toggle_full() {
    var isInFullScreen = (document.fullscreenElement && document.fullscreenElement !== null) ||
        (document.webkitFullscreenElement && document.webkitFullscreenElement !== null) ||
        (document.mozFullScreenElement && document.mozFullScreenElement !== null) ||
        (document.msFullscreenElement && document.msFullscreenElement !== null);

    if (!isInFullScreen) {
      if (tv_container.requestFullscreen) {
        tv_container.requestFullscreen();
      } else if (tv_container.mozRequestFullScreen) {
        tv_container.mozRequestFullScreen();
      } else if (tv_container.webkitRequestFullScreen) {
        tv_container.webkitRequestFullScreen();
      } else if (tv_container.msRequestFullscreen) {
        tv_container.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  /* Full Screen toggling, and key based volume/channel selection */

  const LOWERCASE_F = 70;
  const UPPERCASE_F = 102;
  const LEFT_ARROW = 37
  const RIGHT_ARROW = 39
  const UP_ARROW = 38
  const DOWN_ARROW = 40
  const channel_list = document.querySelectorAll('#channel-list .list-group-item');

  video.ondblclick = toggle_full;
  document.onkeydown = function(e) {
    e = e || window.event;
    if (e.keyCode === LOWERCASE_F || e.keyCode === UPPERCASE_F) {
      /* Fullscreen */
      toggle_full();
    } else if (e.keyCode === LEFT_ARROW) {
      /* Volume down */
      clearTimeout(control_bar_timeout);
      tv_controls.style.opacity = '0.8';
      control_bar_timeout = setTimeout(function() {
        tv_controls.style.opacity = '0';
        tv_container.style.cursor = 'none';
      }, 3000);
      control_bar_timeout;
      if (video.volume >= 0.1) {
          video.volume -= 0.1;
      } else {
        video.volume = 0;
        mute_button.muted = true;
        mute_button.style.backgroundImage = volume_off_img;
      }
      volume_bar.value = video.volume;
    } else if (e.keyCode === RIGHT_ARROW) {
      /* Volume up */
      clearTimeout(control_bar_timeout);
      tv_controls.style.opacity = '0.8';
      control_bar_timeout = setTimeout(function() {
        tv_controls.style.opacity = '0';
        tv_container.style.cursor = 'none';
      }, 3000);
      video.muted = false;
      mute_button.muted = false;
      mute_button.style.backgroundImage = volume_on_img;
      if (video.volume <= 0.9) {
          video.volume += 0.1;
      } else {
        video.volume = 1;
      }
      volume_bar.value = video.volume;
    } else if (e.keyCode === DOWN_ARROW) {
      /* Change Channel up */
      var active_channel = document.querySelectorAll('#channel-list .active')[0];
      var active_channel_name = active_channel.getAttribute('name');
      for (var i = 0; i < channel_list.length; i++) {
        this_value = channel_list[i]
        if (this_value === active_channel) {
          /* Match */
          if (i < channel_list.length - 1) {
            new_channel = channel_list[i+1];
            active_channel.className = active_channel.className.replace(' active', '');
            new_channel.className += ' active';
            console.log('Set channel:', new_channel.innerText);
            console.log(channel_list);
            ws_client.set_channel(new_channel.getAttribute('name'));
          }
        }
      }
    } else if (e.keyCode === UP_ARROW) {
      /* Change Channel down */
      var active_channel = document.querySelectorAll('#channel-list .active')[0];
      var active_channel_name = active_channel.getAttribute('name');
      for (var i = 0; i < channel_list.length; i++) {
        this_value = channel_list[i]
        if (this_value === active_channel) {
          /* Match */
          if (i > 0) {
            new_channel = channel_list[i-1];
            active_channel.className = active_channel.className.replace(' active', '');
            new_channel.className += ' active';
            console.log('Set channel:', new_channel.innerText);
            ws_client.set_channel(new_channel.getAttribute('name'));
          }
        }
      }
    }
  };

  full_screen_button.onclick = toggle_full;

  control_bar_timeout = setTimeout(function() {
    tv_controls.style.opacity = '0';
  }, 3000);

  tv_container.onmousemove = function() {
    clearTimeout(control_bar_timeout);
    tv_controls.style.opacity = '0.8';
    tv_container.style.cursor = 'default';
    control_bar_timeout = setTimeout(function() {
      tv_controls.style.opacity = '0';
      tv_container.style.cursor = 'none';
    }, 3000);
  };

  tv_container.onmouseleave = function() {
    tv_controls.style.opacity = '0';
  };

  unmute_here.onclick = function() {
    video.muted = false;
    video.volume = 1;
    volume_bar.value = 1;
    mute_button.muted = false;
    mute_button.style.backgroundImage = volume_on_img;
  };
}

function setup_channel_bar(client) {
  /* validate checked channel count and find default channel */
  const init_active_channel = document.querySelectorAll('#channel-list .active');
  if (init_active_channel.length !== 1) {
    console.log('Error: only one channel can be selected');
    return;
  }
  const default_channel = init_active_channel[0].getAttribute('name');
  console.log('Default channel:', init_active_channel[0].innerText);

  /* set up onclick callbacks for channels */
  const channel_list = document.querySelectorAll('#channel-list .list-group-item');
  for (var i = 0; i < channel_list.length; i++) {
    channel_list[i].onclick = function() {
      const active_channel = document.querySelectorAll('#channel-list .active')[0];
      const this_value = this.getAttribute('name');

      if (this_value === active_channel.getAttribute('name')) {
        /* same channel */
        return;
      }

      active_channel.className = active_channel.className.replace(' active', '');
      this.className += ' active';

      console.log('Set channel:', this.innerText);
      client.set_channel(this_value);
    }
  }

  return default_channel;
}

function init_player(params_json) {
  var params = JSON.parse(params_json);

  var aid = Number(params.aid);
  var session_key = params.session_key;
  var username = params.username;
  const settings_debug = params.debug;

  /* assert that session_key and username exist */
  if (!session_key || !username) {
    console.log('Error: no session key or username')
    return;
  }

  /* Set up the player control bar*/
  setup_control_bar();

  if (aid === 1) {  // puffer
    load_script('/static/puffer/js/puffer.js').onload = function() {
      // start_puffer is defined in puffer.js
      ws_client = start_puffer(session_key, username, settings_debug);
      const default_channel = setup_channel_bar(ws_client);
      ws_client.connect(default_channel);
    }
  } else {
    /* All the other algorithms are based on dash.js */
    var new_script = null;

    if (aid === 2 || aid === 3) {  // algorithms available in dash.js
      new_script = load_script('/static/puffer/dist/js/dash.all.min.js');
    } else if (aid >= 4 && aid <= 11) {  // algorithms available in pensieve
      new_script = load_script('/static/puffer/dist/js/pensieve.dash.all.js');
    }

    new_script.onload = function() {
      start_dashjs(aid, session_key, username);
    }
  }
}
