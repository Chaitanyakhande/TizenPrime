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
    softAllowedRequests: 0,
    lastSkipAt: 0,
    focusedElement: null,
    lastNavigationAt: 0
  };

  var config = {
    blockNetworkAds: false
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
    /\/adsdk\//i
  ];

  var protectedPathPatterns = [
    /primevideo\.com/i,
    /amazon\.com\/.*\/video/i,
    /amazonvideo\.com/i,
    /cloudfront\.net/i,
    /media-amazon\.com/i,
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
    if (!url || !config.blockNetworkAds || isProtectedUrl(url)) {
      if (url) {
        state.softAllowedRequests += 1;
      }
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
      '[data-tizenprime-hidden="true"],',
      '.tizenprime-hidden {',
      '  display: none !important;',
      '  visibility: hidden !important;',
      '  opacity: 0 !important;',
      '}',
      '.tizenprime-focus {',
      '  outline: 4px solid #00a8e1 !important;',
      '  outline-offset: 4px !important;',
      '  box-shadow: 0 0 0 7px rgba(0, 168, 225, 0.35) !important;',
      '  border-radius: 6px !important;',
      '}',
      '.tizenprime-focus::after {',
      '  pointer-events: none !important;',
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

    var nodes = scope.querySelectorAll('[data-testid], [aria-label], [class], [id]');

    for (var i = 0; i < nodes.length; i += 1) {
      if (looksLikeAdNode(nodes[i])) {
        nodes[i].classList.add('tizenprime-hidden');
        nodes[i].setAttribute('data-tizenprime-hidden', 'true');
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
    pressElement(button);
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

  function isVisible(element) {
    if (!element || element.nodeType !== 1 || element.classList.contains('tizenprime-hidden')) {
      return false;
    }

    var rect = element.getBoundingClientRect();
    var style = window.getComputedStyle ? window.getComputedStyle(element) : element.style;

    return rect.width > 12 &&
      rect.height > 12 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      Number(style.opacity || 1) !== 0;
  }

  function isFocusableCandidate(element) {
    if (!isVisible(element)) {
      return false;
    }

    var tagName = element.tagName ? element.tagName.toLowerCase() : '';
    var role = element.getAttribute('role') || '';
    var tabIndex = element.getAttribute('tabindex');

    return tagName === 'a' ||
      tagName === 'button' ||
      tagName === 'input' ||
      tagName === 'select' ||
      tagName === 'textarea' ||
      role === 'button' ||
      role === 'link' ||
      role === 'tab' ||
      role === 'menuitem' ||
      role === 'option' ||
      role === 'checkbox' ||
      tabIndex === '0' ||
      element.onclick ||
      element.getAttribute('aria-label') ||
      element.getAttribute('data-testid');
  }

  function getFocusableElements() {
    var selector = [
      'a[href]',
      'button',
      'input',
      'select',
      'textarea',
      '[role]',
      '[tabindex]',
      '[aria-label]',
      '[data-testid]',
      '[onclick]'
    ].join(',');
    var nodes = document.querySelectorAll(selector);
    var elements = [];

    for (var i = 0; i < nodes.length; i += 1) {
      if (isFocusableCandidate(nodes[i])) {
        elements.push(nodes[i]);
      }
    }

    return elements;
  }

  function clearRemoteFocus() {
    if (state.focusedElement && state.focusedElement.classList) {
      state.focusedElement.classList.remove('tizenprime-focus');
    }
  }

  function setRemoteFocus(element) {
    if (!element) {
      return;
    }

    clearRemoteFocus();
    state.focusedElement = element;
    element.classList.add('tizenprime-focus');

    if (!element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '-1');
    }

    try {
      element.focus({ preventScroll: true });
    } catch (error) {
      element.focus();
    }

    try {
      element.scrollIntoView({
        block: 'center',
        inline: 'center'
      });
    } catch (error) {
      element.scrollIntoView();
    }
  }

  function distanceForDirection(fromRect, toRect, direction) {
    var fromX = fromRect.left + fromRect.width / 2;
    var fromY = fromRect.top + fromRect.height / 2;
    var toX = toRect.left + toRect.width / 2;
    var toY = toRect.top + toRect.height / 2;
    var dx = toX - fromX;
    var dy = toY - fromY;
    var primary;
    var secondary;

    if (direction === 'left' && dx >= -4) {
      return Infinity;
    }
    if (direction === 'right' && dx <= 4) {
      return Infinity;
    }
    if (direction === 'up' && dy >= -4) {
      return Infinity;
    }
    if (direction === 'down' && dy <= 4) {
      return Infinity;
    }

    if (direction === 'left' || direction === 'right') {
      primary = Math.abs(dx);
      secondary = Math.abs(dy);
    } else {
      primary = Math.abs(dy);
      secondary = Math.abs(dx);
    }

    return primary * 4 + secondary;
  }

  function moveRemoteFocus(direction) {
    var elements = getFocusableElements();
    var current = state.focusedElement;

    if (!elements.length) {
      return;
    }

    if (!current || !isVisible(current)) {
      setRemoteFocus(elements[0]);
      return;
    }

    var fromRect = current.getBoundingClientRect();
    var best = null;
    var bestDistance = Infinity;

    for (var i = 0; i < elements.length; i += 1) {
      if (elements[i] === current) {
        continue;
      }

      var distance = distanceForDirection(fromRect, elements[i].getBoundingClientRect(), direction);

      if (distance < bestDistance) {
        best = elements[i];
        bestDistance = distance;
      }
    }

    if (best) {
      setRemoteFocus(best);
    }
  }

  function clickFocusedElement() {
    if (!state.focusedElement || !isVisible(state.focusedElement)) {
      var elements = getFocusableElements();
      setRemoteFocus(elements[0]);
      return;
    }

    pressElement(state.focusedElement);
  }

  function dispatchMouseEvent(element, type) {
    var rect = element.getBoundingClientRect();
    var eventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    };

    try {
      element.dispatchEvent(new MouseEvent(type, eventInit));
    } catch (error) {
      var event = document.createEvent('MouseEvents');
      event.initMouseEvent(
        type,
        true,
        true,
        window,
        1,
        0,
        0,
        eventInit.clientX,
        eventInit.clientY,
        false,
        false,
        false,
        false,
        0,
        null
      );
      element.dispatchEvent(event);
    }
  }

  function dispatchKeyboardEvent(element, type, keyCode) {
    try {
      element.dispatchEvent(new KeyboardEvent(type, {
        bubbles: true,
        cancelable: true,
        keyCode: keyCode,
        which: keyCode,
        key: keyCode === 13 ? 'Enter' : ''
      }));
    } catch (error) {
      var event = document.createEvent('Events');
      event.initEvent(type, true, true);
      event.keyCode = keyCode;
      event.which = keyCode;
      element.dispatchEvent(event);
    }
  }

  function pressElement(element) {
    if (!element) {
      return;
    }

    dispatchMouseEvent(element, 'mouseover');
    dispatchMouseEvent(element, 'mousemove');
    dispatchMouseEvent(element, 'mousedown');
    dispatchKeyboardEvent(element, 'keydown', 13);
    element.click();
    dispatchKeyboardEvent(element, 'keyup', 13);
    dispatchMouseEvent(element, 'mouseup');
    dispatchMouseEvent(element, 'click');
  }

  function installRemoteNavigation() {
    document.addEventListener('keydown', function (event) {
      var direction = null;
      var now = Date.now();

      if (now - state.lastNavigationAt < 120) {
        return;
      }

      if (event.keyCode === 37) {
        direction = 'left';
      } else if (event.keyCode === 38) {
        direction = 'up';
      } else if (event.keyCode === 39) {
        direction = 'right';
      } else if (event.keyCode === 40) {
        direction = 'down';
      } else if (event.keyCode === 13) {
        clickFocusedElement();
        event.preventDefault();
        event.stopPropagation();
        return;
      } else if (event.keyCode === 10009) {
        if (window.history.length > 1) {
          window.history.back();
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if (direction) {
        state.lastNavigationAt = now;
        moveRemoteFocus(direction);
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);

    document.addEventListener('focusin', function (event) {
      if (event.target && event.target !== state.focusedElement && isFocusableCandidate(event.target)) {
        setRemoteFocus(event.target);
      }
    });
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
          softAllowedRequests: state.softAllowedRequests,
          skippedPrompts: state.skippedPrompts,
          remoteFocus: !!state.focusedElement,
          blockNetworkAds: config.blockNetworkAds
        };
      },
      shouldBlockUrl: shouldBlockUrl,
      setNetworkAdBlocking: function (enabled) {
        config.blockNetworkAds = !!enabled;
        return config.blockNetworkAds;
      }
    };
  }

  function start() {
    patchFetch();
    patchXhr();
    exposeStatus();
    installRemoteNavigation();

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
