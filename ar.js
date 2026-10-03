/* ar.js – gemeinsame Technik für alle Blätter
   iPhone/iPad -> AR Quick Look (USDZ)
   Android     -> Scene Viewer (GLB)
   Welche Dateien ein Blatt zeigt, steht in dessen index.html (data-usdz, data-glb). */
(function () {
  var blatt   = document.getElementById('blatt');
  var knopf   = document.getElementById('ar-knopf');
  var hinweis = document.getElementById('hinweis');
  var usdz    = blatt.getAttribute('data-usdz');
  var glb     = blatt.getAttribute('data-glb');
  var h1      = document.querySelector('h1');
  var titel   = h1 ? h1.textContent.trim() : '';
  var KEINE_AR = '#keine-ar';

  // Gerät erkennen (gleiche Logik wie Googles model-viewer)
  var ua         = navigator.userAgent;
  var istIOS     = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var istAndroid = /Android/i.test(ua) && !/Firefox/i.test(ua);
  var googleApp  = istIOS && /GSA\//.test(ua);
  var andereApp  = istIOS && /CriOS\/|EdgiOS\/|FxiOS\/|DuckDuckGo\//.test(ua);
  var quickLook  = istIOS && !googleApp && (andereApp || (function () {
    var a = document.createElement('a');
    return !!(a.relList && a.relList.supports && a.relList.supports('ar'));
  })());

  function zeige(text) { hinweis.textContent = text; }
  function absolut(pfad) { return new URL(pfad, location.href).href; }

  // Prüft, ob eine Datei auf dem Server liegt
  function gibtEs(pfad) {
    if (!pfad) return Promise.resolve(false);
    return fetch(pfad, { method: 'HEAD', cache: 'no-store' })
      .then(function (antwort) { return antwort.ok; })
      .catch(function () { return false; });
  }

  // iPhone: unsichtbarer Link mit rel="ar" öffnet AR Quick Look
  var arLink = null;
  function oeffneQuickLook() {
    if (!arLink) {
      arLink = document.createElement('a');
      arLink.setAttribute('rel', 'ar');
      arLink.style.display = 'none';
      arLink.appendChild(document.createElement('img'));
      document.body.appendChild(arLink);
    }
    arLink.setAttribute('href', absolut(usdz) + '#allowsContentScaling=0'); // 1:1, kein Skalieren
    arLink.click();
  }

  // Android: Scene Viewer über einen Intent-Link
  function oeffneSceneViewer() {
    var parameter = {
      file: absolut(glb),
      mode: 'ar_preferred',
      resizable: 'false',          // 1:1, kein Skalieren
      disable_occlusion: 'true'
    };
    if (titel) parameter.title = titel;
    var abfrage = Object.keys(parameter).map(function (name) {
      return name + '=' + encodeURIComponent(parameter[name]);
    }).join('&');
    var zurueck = location.href.split('#')[0] + KEINE_AR;
    location.href = 'intent://arvr.google.com/scene-viewer/1.2?' + abfrage +
      '#Intent;scheme=https;package=com.google.android.googlequicksearchbox;' +
      'action=android.intent.action.VIEW;S.browser_fallback_url=' +
      encodeURIComponent(zurueck) + ';end;';
  }

  // Android springt auf diese Adresse zurück, wenn Scene Viewer fehlt
  function pruefeKeineAR() {
    if (location.hash === KEINE_AR) {
      knopf.hidden = true;
      zeige('Dieses Handy kann die AR-Ansicht leider nicht öffnen.');
    }
  }
  window.addEventListener('hashchange', pruefeKeineAR);

  function bereit(pfad, oeffnen, fehlt) {
    gibtEs(pfad).then(function (da) {
      if (!da) { zeige(fehlt); return; }
      knopf.hidden = false;
      knopf.addEventListener('click', oeffnen);
      pruefeKeineAR();
    });
  }

  if (quickLook) {
    bereit(usdz, oeffneQuickLook, 'Diese Szene ist noch in Arbeit.');
  } else if (istIOS) {
    zeige('Bitte in Safari öffnen.');
  } else if (istAndroid) {
    bereit(glb, oeffneSceneViewer, 'Für Android ist diese Szene noch in Arbeit.');
  } else {
    zeige('Bitte mit dem Smartphone öffnen.');
  }
})();
