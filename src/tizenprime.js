/* TizenPrime - Prime Video cleanup module for TizenBrew. */
(function () {
  'use strict';

  var MODULE_NAME = 'TizenPrime';
  var STYLE_ID = 'tizenprime-style';
  var MARKER = '__tizenPrimeLoaded';
  var LOG_PREFIX = '[' + MODULE_NAME + ']';

  if (window[MARKER]) {
    return;
  }

  window[MARKER] = true;

  var state = {
    blockedRequests: 0,
    skippedPrompts: 0,
    lastSkipAt: 0
  };

  var blockedHosts = [
    'aax.amazon-adsystem.com',
    'amazon-adsystem.com',
    'c.amazon-adsystem.com',
    'mads.amazon-adsystem.com',
    'pagead2.googlesyndication.com',
    'pubads.g.doubleclick.net',
    'securepubads.g.doubleclick.net',
    'static.doubleclick.net',
    'imasdk.googleapis.com',
    'googleads.g.doubleclick.net'
  ];

  var blockedPathPatterns = [
    /(^|[/?&._-])adserver([/?&._-]|$)/i,
    /(^|[/?&._-])advertising([/?&._-]|$)/i,
    /(^|[/?&._-])ads([/?&._-]|$)/i,
    /(^|[/?&._-])ima([/?&._-]|$)/i,
    /(^|[/?&._-])vmap([/?&._-]|$)/i,
    /(^|[/?&._-])vast([/?&._-]|$)/i,
    /(^|[/?&._-])preroll([/?&._-]|$)/i,
    /(^|[/?&._-])midroll([/?&._-]|$)/i,
    /\/gp\/video\/ads\//i,
    /\/video\/ads\//i,
    /\/adsdk\//i
  ];

  var protectedPathPatterns = [
    /(^|[/?&._-])license([/?&._-]|$)/i,
    /widevine/i,
    /playready/i,
    /drm/i,
    /device-auth/i,
    /token/i
  ];

  function log(message) {
    if (window.TizenPrimeDebug && window.console && console.log) {
      console.log(LOG_PREFIX + ' ' + message);
    }
  }

  function toUrl(input) {
    if (!input) {
      return '';
    }

    if (typeof input === 'string') {
      return input;
    }

    if (input.url) {
      return input.url;
    }

    return String(input);
  }

  function hasHost(url, host) {
    var lowerUrl = url.toLowerCase();
    var lowerHost = host.toLowerCase();

    return lowerUrl.indexOf('//' + lowerHost) !== -1 ||
      lowerUrl.indexOf('.' + lowerHost) !== -1;
  }

  function isProtectedUrl(url) {
    for (var i = 0; i < protectedPathPatterns.length; i += 1) {
      if (protectedPathPatterns[i].test(url)) {
        return true;
      }
    }

    return false;
  }

  function shouldBlockUrl(url) {
    if (!url || isProtectedUrl(url)) {
      return false;
    }

    for (var i = 0; i < blockedHosts.length; i += 1) {
      if (hasHost(url, blockedHosts[i])) {
        return true;
      }
    }

    for (var j = 0; j < blockedPathPatterns.length; j += 1) {
      if (blockedPathPatterns[j].test(url)) {
        return true;
      }
    }

    return false;
  }

  function blockRequest(url) {
    state.blockedRequests += 1;
    log('blocked request: ' + url);
  }

  function emptyResponse() {
    return new Response('', {
      status: 204,
      statusText: 'TizenPrime blocked',
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }

  function patchFetch() {
    if (!window.fetch || window.fetch.__tizenPrimePatched) {
      return;
    }

    var originalFetch = window.fetch;

    window.fetch = function (input, init) {
      var url = toUrl(input);

      if (shouldBlockUrl(url)) {
        blockRequest(url);
        return Promise.resolve(emptyResponse());
      }

      return originalFetch.apply(this, arguments);
    };

    window.fetch.__tizenPrimePatched = true;
  }

  function patchXhr() {
    if (!window.XMLHttpRequest || XMLHttpRequest.prototype.open.__tizenPrimePatched) {
      return;
    }

    var originalOpen = XMLHttpRequest.prototype.open;
    var originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__tizenPrimeUrl = toUrl(url);
      this.__tizenPrimeBlocked = shouldBlockUrl(this.__tizenPrimeUrl);

      if (this.__tizenPrimeBlocked) {
        blockRequest(this.__tizenPrimeUrl);
        return originalOpen.call(this, method, 'data:text/plain,', true);
      }

      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      if (this.__tizenPrimeBlocked) {
        return originalSend.call(this, null);
      }

      return originalSend.apply(this, arguments);
    };

    XMLHttpRequest.prototype.open.__tizenPrimePatched = true;
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '[data-testid*="ad" i],',
      '[aria-label*="advertisement" i],',
      '[class*="ad-banner" i],',
      '[class*="adBanner" i],',
      '[class*="sponsored" i],',
      '[id*="ad-container" i],',
      '.tizenprime-hidden {',
      '  display: none !important;',
      '  visibility: hidden !important;',
      '  opacity: 0 !important;',
      '}'
    ].join('\n');

    (document.head || document.documentElement).appendChild(style);
  }

  function textOf(node) {
    return (node && (node.innerText || node.textContent) || '').replace(/\s+/g, ' ').trim();
  }

  function looksLikeAdNode(node) {
    if (!node || node.nodeType !== 1) {
      return false;
    }

    var text = textOf(node).toLowerCase();
    var label = String(node.getAttribute('aria-label') || '').toLowerCase();
    var testId = String(node.getAttribute('data-testid') || '').toLowerCase();
    var className = String(node.className || '').toLowerCase();

    if (label.indexOf('advertisement') !== -1 || testId.indexOf('advertisement') !== -1) {
      return true;
    }

    if (className.indexOf('ad-banner') !== -1 || className.indexOf('sponsored') !== -1) {
      return true;
    }

    return text === 'ad' ||
      text === 'ads' ||
      text === 'advertisement' ||
      text.indexOf('advertisement') === 0 ||
      text.indexOf('sponsored') === 0;
  }

  function hideAdSurfaces(root) {
    var scope = root || document.body;

    if (!scope || !scope.querySelectorAll) {
      return;
    }

    var nodes = scope.querySelectorAll(
      '[data-testid*="ad" i], [aria-label*="advertisement" i], [class*="ad-banner" i], [class*="sponsored" i]'
    );

    for (var i = 0; i < nodes.length; i += 1) {
      if (looksLikeAdNode(nodes[i])) {
        nodes[i].classList.add('tizenprime-hidden');
      }
    }
  }

  function findClickableSkip(root) {
    var scope = root || document.body;

    if (!scope || !scope.querySelectorAll) {
      return null;
    }

    var nodes = scope.querySelectorAll('button, [role="button"], a');
    var skipPattern = /^(skip|skip ad|skip ads|continue|continue watching|watch now|close)$/i;

    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var text = textOf(node);
      var label = node.getAttribute('aria-label') || '';
      var disabled = node.disabled || node.getAttribute('aria-disabled') === 'true';

      if (!disabled && (skipPattern.test(text) || skipPattern.test(label))) {
        return node;
      }
    }

    return null;
  }

  function clickSkipPrompts(root) {
    var now = Date.now();

    if (now - state.lastSkipAt < 1500) {
      return;
    }

    var button = findClickableSkip(root);

    if (!button) {
      return;
    }

    state.lastSkipAt = now;
    state.skippedPrompts += 1;
    button.click();
    log('clicked skip/continue prompt');
  }

  function maybeAdvanceShortAdVideo() {
    var videos = document.getElementsByTagName('video');

    for (var i = 0; i < videos.length; i += 1) {
      var video = videos[i];
      var duration = Number(video.duration);

      if (!duration || duration > 120 || video.paused || video.ended) {
        continue;
      }

      var pageText = textOf(document.body).toLowerCase();
      var hasAdText = pageText.indexOf('advertisement') !== -1 ||
        pageText.indexOf('ad ') !== -1 ||
        pageText.indexOf('skip ad') !== -1;

      if (hasAdText && video.currentTime < duration - 1) {
        try {
          video.currentTime = Math.max(video.currentTime, duration - 0.5);
          log('advanced short ad video');
        } catch (error) {
          log('could not advance video: ' + error.message);
        }
      }
    }
  }

  function observeDom() {
    if (!window.MutationObserver || !document.body) {
      return;
    }

    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        for (var j = 0; j < mutations[i].addedNodes.length; j += 1) {
          var node = mutations[i].addedNodes[j];

          if (node && node.nodeType === 1) {
            hideAdSurfaces(node);
            clickSkipPrompts(node);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function exposeStatus() {
    window.TizenPrime = {
      version: '0.1.0',
      status: function () {
        return {
          blockedRequests: state.blockedRequests,
          skippedPrompts: state.skippedPrompts
        };
      },
      shouldBlockUrl: shouldBlockUrl
    };
  }

  function start() {
    patchFetch();
    patchXhr();
    exposeStatus();

    if (document.documentElement) {
      installStyles();
    }

    if (document.body) {
      hideAdSurfaces(document.body);
      clickSkipPrompts(document.body);
      observeDom();
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        installStyles();
        hideAdSurfaces(document.body);
        clickSkipPrompts(document.body);
        observeDom();
      });
    }

    window.setInterval(function () {
      hideAdSurfaces(document.body);
      clickSkipPrompts(document.body);
      maybeAdvanceShortAdVideo();
    }, 2000);

    log('loaded');
  }

  start();
}());
