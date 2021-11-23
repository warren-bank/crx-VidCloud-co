// ==UserScript==
// @name         VidCloud.co
// @description  Watch videos in external player.
// @version      1.0.7
// @match        *://vidcloud.co/*
// @match        *://*.vidcloud.co/*
// @match        *://vidcloud.pro/*
// @match        *://*.vidcloud.pro/*
// @match        *://rapid-cloud.ru/*
// @match        *://*.rapid-cloud.ru/*
// @match        *://streamrapid.ru/*
// @match        *://*.streamrapid.ru/*
// @icon         https://vidcloud.co/images/favicon.png
// @run-at       document-end
// @grant        unsafeWindow
// @homepage     https://github.com/warren-bank/crx-VidCloud-co/tree/webmonkey-userscript/es5
// @supportURL   https://github.com/warren-bank/crx-VidCloud-co/issues
// @downloadURL  https://github.com/warren-bank/crx-VidCloud-co/raw/webmonkey-userscript/es5/webmonkey-userscript/VidCloud-co.user.js
// @updateURL    https://github.com/warren-bank/crx-VidCloud-co/raw/webmonkey-userscript/es5/webmonkey-userscript/VidCloud-co.user.js
// @namespace    warren-bank
// @author       Warren Bank
// @copyright    Warren Bank
// ==/UserScript==

// ----------------------------------------------------------------------------- constants

var user_options = {
  "common": {
    "preferred_captions_language":  "english",
    "reinitialize_dom":             false,

    "script_init_delay_ms":         2500,
    "script_init_poll_interval_ms": 500,
    "script_init_poll_timeout_ms":  30000
  },
  "webmonkey": {
    "post_intent_redirect_to_url":  "about:blank"
  },
  "greasemonkey": {
    "redirect_to_webcast_reloaded": true,
    "force_http":                   true,
    "force_https":                  false
  }
}

// ----------------------------------------------------------------------------- state

var state = {
  "remaining_poll_attempts":        Math.ceil(user_options.common.script_init_poll_timeout_ms / user_options.common.script_init_poll_interval_ms),
  "xhr_embed":                      null,
  "xhr_id":                         null,
  "xhr_token":                      null,
  "token": {
    "recaptcha_key":                null
  }
}

// ----------------------------------------------------------------------------- helpers

// make GET request, pass plaintext response to callback
var download_text = function(url, headers, callback) {
  var xhr = new unsafeWindow.XMLHttpRequest()
  xhr.open("GET", url, true, null, null)

  if (headers && (typeof headers === 'object')) {
    var keys = Object.keys(headers)
    var key, val
    for (var i=0; i < keys.length; i++) {
      key = keys[i]
      val = headers[key]
      xhr.setRequestHeader(key, val)
    }
  }

  xhr.onload = function(e) {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        callback(xhr.responseText)
      }
    }
  }

  xhr.send()
}

// -----------------------------------------------------------------------------

var make_element = function(elementName, html) {
  var el = unsafeWindow.document.createElement(elementName)

  if (html)
    el.innerHTML = html

  return el
}

var make_div  = function(html) {return make_element('div',  html)}
var make_span = function(text) {return make_element('span', text)}

// ----------------------------------------------------------------------------- URL links to tools on Webcast Reloaded website

var get_webcast_reloaded_url = function(video_url, vtt_url, referer_url, force_http, force_https) {
  force_http  = (typeof force_http  === 'boolean') ? force_http  : user_options.greasemonkey.force_http
  force_https = (typeof force_https === 'boolean') ? force_https : user_options.greasemonkey.force_https

  var encoded_video_url, encoded_vtt_url, encoded_referer_url, webcast_reloaded_base, webcast_reloaded_url

  encoded_video_url     = encodeURIComponent(encodeURIComponent(btoa(video_url)))
  encoded_vtt_url       = vtt_url ? encodeURIComponent(encodeURIComponent(btoa(vtt_url))) : null
  referer_url           = referer_url ? referer_url : unsafeWindow.location.href
  encoded_referer_url   = encodeURIComponent(encodeURIComponent(btoa(referer_url)))

  webcast_reloaded_base = {
    "https": "https://warren-bank.github.io/crx-webcast-reloaded/external_website/index.html",
    "http":  "http://webcast-reloaded.surge.sh/index.html"
  }

  webcast_reloaded_base = (force_http)
                            ? webcast_reloaded_base.http
                            : (force_https)
                               ? webcast_reloaded_base.https
                               : (video_url.toLowerCase().indexOf('http:') === 0)
                                  ? webcast_reloaded_base.http
                                  : webcast_reloaded_base.https

  webcast_reloaded_url  = webcast_reloaded_base + '#/watch/' + encoded_video_url + (encoded_vtt_url ? ('/subtitle/' + encoded_vtt_url) : '') + '/referer/' + encoded_referer_url
  return webcast_reloaded_url
}

// ----------------------------------------------------------------------------- URL redirect

var determine_video_type = function(video_url) {
  var video_url_regex_pattern = /^.*\.(mp4|mp4v|mpv|m1v|m4v|mpg|mpg2|mpeg|xvid|webm|3gp|avi|mov|mkv|ogv|ogm|m3u8|mpd|ism(?:[vc]|\/manifest)?)(?:[\?#].*)?$/i
  var matches, file_ext, video_type

  matches = video_url_regex_pattern.exec(video_url)

  if (matches && matches.length)
    file_ext = matches[1]

  if (file_ext) {
    switch (file_ext) {
      case "mp4":
      case "mp4v":
      case "m4v":
        video_type = "video/mp4"
        break
      case "mpv":
        video_type = "video/MPV"
        break
      case "m1v":
      case "mpg":
      case "mpg2":
      case "mpeg":
        video_type = "video/mpeg"
        break
      case "xvid":
        video_type = "video/x-xvid"
        break
      case "webm":
        video_type = "video/webm"
        break
      case "3gp":
        video_type = "video/3gpp"
        break
      case "avi":
        video_type = "video/x-msvideo"
        break
      case "mov":
        video_type = "video/quicktime"
        break
      case "mkv":
        video_type = "video/x-mkv"
        break
      case "ogg":
      case "ogv":
      case "ogm":
        video_type = "video/ogg"
        break
      case "m3u8":
        video_type = "application/x-mpegURL"
        break
      case "mpd":
        video_type = "application/dash+xml"
        break
      case "ism":
      case "ism/manifest":
      case "ismv":
      case "ismc":
        video_type = "application/vnd.ms-sstr+xml"
        break
    }
  }

  return video_type || ""
}

var redirect_to_url = function(url) {
  if (!url) return

  if (typeof GM_loadUrl === 'function') {
    if (typeof GM_resolveUrl === 'function')
      url = GM_resolveUrl(url, unsafeWindow.location.href) || url

    GM_loadUrl(url, 'Referer', unsafeWindow.location.href)
  }
  else {
    try {
      unsafeWindow.top.location = url
    }
    catch(e) {
      unsafeWindow.window.location = url
    }
  }
}

var process_webmonkey_post_intent_redirect_to_url = function() {
  var url = null

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'string')
    url = user_options.webmonkey.post_intent_redirect_to_url

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'function')
    url = user_options.webmonkey.post_intent_redirect_to_url()

  if (typeof url === 'string')
    redirect_to_url(url)
}

var process_video_url = function(video_url, video_type, vtt_url, referer_url) {
  if (!video_url)
    return

  if (!referer_url)
    referer_url = unsafeWindow.location.href

  if (typeof GM_startIntent === 'function') {
    // running in Android-WebMonkey: open Intent chooser

    if (!video_type)
      video_type = determine_video_type(video_url)

    var args = [
      /* action = */ 'android.intent.action.VIEW',
      /* data   = */ video_url,
      /* type   = */ video_type
    ]

    // extras:
    if (vtt_url) {
      args.push('textUrl')
      args.push(vtt_url)
    }
    if (referer_url) {
      args.push('referUrl')
      args.push(referer_url)
    }

    GM_startIntent.apply(this, args)
    process_webmonkey_post_intent_redirect_to_url()
    return true
  }
  else if (user_options.greasemonkey.redirect_to_webcast_reloaded) {
    // running in standard web browser: redirect URL to top-level tool on Webcast Reloaded website

    redirect_to_url(get_webcast_reloaded_url(video_url, vtt_url, referer_url))
    return true
  }
  else {
    return false
  }
}

var process_hls_url = function(hls_url, vtt_url, referer_url) {
  process_video_url(/* video_url= */ hls_url, /* video_type= */ 'application/x-mpegurl', vtt_url, referer_url)
}

var process_dash_url = function(dash_url, vtt_url, referer_url) {
  process_video_url(/* video_url= */ dash_url, /* video_type= */ 'application/dash+xml', vtt_url, referer_url)
}

// ----------------------------------------------------------------------------- determine static XHR parameters

var determine_static_xhr_parameters = function() {
  var pathname, cookies
  var regex, match

  if (!state.xhr_id) {
    try {
      pathname = unsafeWindow.location.pathname
      regex    = new RegExp('^/(embed(?:-\\d+)?)/([^/]+)$')
      match    = regex.exec(pathname)

      if (match && match.length) {
        state.xhr_embed = match[1]
        state.xhr_id    = match[2]
      }
    }
    catch(e) {}
  }

  if (!state.xhr_token) {
    try {
      cookies = unsafeWindow.document.cookie || ''
      regex   = /\b_token=([^;\s]+)/
      match   = regex.exec(cookies)

      if (match && match.length) {
        state.xhr_token = match[1]
      }
    }
    catch(e) {}
  }
}

// ----------------------------------------------------------------------------- reinitialize dom

var reset_dom = function() {
  var $recaptcha_script, recaptcha_src

  state.token.recaptcha_key = unsafeWindow.recaptchaSiteKey
  $recaptcha_script = unsafeWindow.document.querySelector('script[src*="google.com/recaptcha/api.js"]')
  if ($recaptcha_script) {
    recaptcha_src     = $recaptcha_script.getAttribute('src')
    $recaptcha_script = null
  }

  delete unsafeWindow.window.grecaptcha

  unsafeWindow.document.close()
  unsafeWindow.document.write('')
  unsafeWindow.document.close()

  if (recaptcha_src) {
    $recaptcha_script = make_element('script')
    $recaptcha_script.setAttribute('src', recaptcha_src)
    unsafeWindow.document.body.appendChild($recaptcha_script)
  }
}

var reinitialize_dom = function() {
  reset_dom()
}

// ----------------------------------------------------------------------------- determine dynamic XHR parameters

var determine_xhr_token = function(callback) {
  try {
    unsafeWindow.window.grecaptcha.execute((state.token.recaptcha_key || unsafeWindow.recaptchaSiteKey), {action: 'get_sources'}).then(function(token) {
      if (token) {
        state.xhr_token = token
        callback()
      }
    })
  }
  catch(e) {}
}

// ----------------------------------------------------------------------------- trigger XHR request

var trigger_xhr_video_sources = function() {
  var xhr_callback, timer_callback

  xhr_callback = function() {
    var url = unsafeWindow.location.protocol + '//' + unsafeWindow.location.hostname + '/ajax/' + state.xhr_embed + '/getSources?id=' + state.xhr_id + '&_token=' + state.xhr_token + '&_number=1'

    download_text(url, null, process_xhr_video_sources)
  }

  if (state.xhr_token) {
    xhr_callback()
  }
  else {
    timer_callback = function(force_delay) {
      if ((state.remaining_poll_attempts > 0) && (!unsafeWindow.window.grecaptcha || (force_delay === true))) {
        state.remaining_poll_attempts--
        setTimeout(timer_callback, user_options.common.script_init_poll_interval_ms)
      }
      else {
        determine_xhr_token(xhr_callback)
      }
    }

    timer_callback(true)
  }
}

// ----------------------------------------------------------------------------- process XHR response

var process_xhr_video_sources = function(text) {
  try {
    var data, video_sources
    var video_url, vtt_url
    var file_reducer, preferred_tracks

    data = JSON.parse(text)
    if (!data || (typeof data !== 'object')) return

    video_sources = []
    if (Array.isArray(data.sources) && data.sources.length)
      video_sources = video_sources.concat(data.sources)
    if (Array.isArray(data.sourcesBackup) && data.sourcesBackup.length)
      video_sources = video_sources.concat(data.sourcesBackup)
    if (!video_sources.length) return

    file_reducer = function(file, data) {
      if (file) return file

      return (data && (typeof data === 'object') && data.file)
        ? data.file
        : null
    }

    video_url = video_sources.reduce(file_reducer, null)
    if (!video_url) return

    if (Array.isArray(data.tracks) && data.tracks.length) {
      user_options.common.preferred_captions_language = (typeof user_options.common.preferred_captions_language === 'string')
        ? user_options.common.preferred_captions_language.toLowerCase()
        : ''

      if (!vtt_url && user_options.common.preferred_captions_language) {
        preferred_tracks = data.tracks.filter(function(data) {
          return (data && (typeof data === 'object') && data.file && data.label)
            ? (data.label.toLowerCase().indexOf(user_options.common.preferred_captions_language) >= 0)
            : false
        })

        if (preferred_tracks.length) {
          vtt_url = preferred_tracks.reduce(file_reducer, null)
        }
      }

      if (!vtt_url) {
        vtt_url = data.tracks.reduce(file_reducer, null)
      }
    }

    process_video_url(video_url, /* video_type= */ null, vtt_url)
  }
  catch(e) {}
}

// ----------------------------------------------------------------------------- bootstrap

var clear_all_timeouts = function() {
  var maxId = unsafeWindow.setTimeout(function(){}, 1000)

  for (var i=0; i <= maxId; i++) {
    unsafeWindow.clearTimeout(i)
  }
}

var clear_all_intervals = function() {
  var maxId = unsafeWindow.setInterval(function(){}, 1000)

  for (var i=0; i <= maxId; i++) {
    unsafeWindow.clearInterval(i)
  }
}

var init = function() {
  if (unsafeWindow.window.did_userscript_init) return
  unsafeWindow.window.did_userscript_init = true

  clear_all_timeouts()
  clear_all_intervals()

  determine_static_xhr_parameters()
  if (!state.xhr_id) return

  if (user_options.common.reinitialize_dom)
    reinitialize_dom()

  trigger_xhr_video_sources()
}

setTimeout(init, user_options.common.script_init_delay_ms)

// -----------------------------------------------------------------------------
