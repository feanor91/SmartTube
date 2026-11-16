// Injecté dans la page YouTube : confort souris/clavier, recherche au clavier,
// saut des publicités et des segments SponsorBlock.
const { ipcRenderer } = require('electron');

const SB_API = 'https://sponsor.ajay.app/api/skipSegments';
const CATEGORIES = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro'];

const sendKey = (k) => ipcRenderer.send('st-key', k);
const isTv = () => /^\/tv/.test(location.pathname);
const video = () => document.querySelector('video');
const videoPlaying = () => { const v = video(); return !!v && !v.paused; };
const onWatchPage = () => /watch/.test(location.pathname + location.hash) && !!video();
const isTyping = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

// ---------------------------------------------------------------- Recherche au clavier
let searchBox = null;
let searchSuppressed = false;

function closeSearch(suppress) {
  if (searchBox) searchBox.remove();
  searchBox = null;
  if (suppress) searchSuppressed = true;
}

function goSearch(q) {
  q = q.trim();
  closeSearch(false);
  if (!q) return;
  if (isTv()) location.href = 'https://www.youtube.com/tv#/search?q=' + encodeURIComponent(q);
  else location.href = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
}

function openSearch() {
  if (searchBox) { searchBox.querySelector('input').focus(); return; }
  searchBox = document.createElement('div');
  searchBox.style.cssText =
    'position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.7);display:flex;' +
    'align-items:flex-start;justify-content:center;padding-top:12vh;';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Rechercher sur YouTube (Entrée = valider, Échap = fermer)';
  input.style.cssText =
    'width:min(900px,86vw);font-size:28px;padding:16px 24px;border-radius:40px;border:2px solid #00a0aa;' +
    'background:#1c1c1c;color:#fff;outline:none;';
  searchBox.appendChild(input);
  searchBox.addEventListener('mousedown', (e) => { if (e.target === searchBox) closeSearch(true); });
  document.documentElement.appendChild(searchBox);
  input.focus();
}

// ---------------------------------------------------------------- Aide
let helpBox = null;
function toggleHelp() {
  if (helpBox) { helpBox.remove(); helpBox = null; return; }
  helpBox = document.createElement('div');
  helpBox.style.cssText =
    'position:fixed;top:60px;left:12px;z-index:2147483646;background:rgba(0,0,0,.88);color:#fff;' +
    'padding:16px 22px;border-radius:12px;font:15px/1.7 sans-serif;white-space:pre;';
  helpBox.textContent =
    'Raccourcis SmartTube\n' +
    '/  ou  Ctrl+K   Rechercher\n' +
    'F11 / double-clic   Plein écran\n' +
    'F2   Mode TV  <->  site classique\n' +
    'F5   Recharger\n' +
    'Alt+Gauche / bouton souris Précédent   Retour\n' +
    'Ctrl + / Ctrl -  / Ctrl 0   Zoom\n' +
    'Pendant une vidéo : Espace lecture/pause, flèches ou J / L  -10 s / +10 s, M muet\n' +
    'Molette : change de ligne ; Maj+molette : défile la ligne\n' +
    'Glisser à la souris : fait défiler\n' +
    'F1   Cette aide';
  document.documentElement.appendChild(helpBox);
}

// ---------------------------------------------------------------- Clavier
const swallowKeyUp = new Set();
window.addEventListener('keydown', (e) => {
  // La recherche capte tout le clavier tant qu'elle est ouverte.
  if (searchBox) {
    e.stopImmediatePropagation();
    if (e.key === 'Enter') { e.preventDefault(); goSearch(searchBox.querySelector('input').value); }
    else if (e.key === 'Escape') { e.preventDefault(); closeSearch(true); }
    return;
  }
  if (isTyping(e.target)) return;

  if ((e.key === '/' && !e.ctrlKey) || (e.ctrlKey && (e.key === 'k' || e.key === 'f'))) {
    e.preventDefault(); e.stopImmediatePropagation(); openSearch(); return;
  }
  if (e.key === 'F1') { e.preventDefault(); toggleHelp(); return; }
  if (e.ctrlKey || e.altKey || e.metaKey || !onWatchPage()) return;

  const v = video();
  let handled = true;
  if (e.key === ' ') v.paused ? v.play() : v.pause();
  else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !v.paused) {
    // En lecture : saut direct de 10 s, sans passer par le mode « barre de lecture » de l'interface TV (qui met en pause).
    v.currentTime = e.key === 'ArrowLeft' ? Math.max(0, v.currentTime - 10) : Math.min(v.duration || Infinity, v.currentTime + 10);
    swallowKeyUp.add(e.key);
  }
  else if (e.key === 'j' || e.key === 'J') v.currentTime = Math.max(0, v.currentTime - 10);
  else if (e.key === 'l' || e.key === 'L') v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 10);
  else if (e.key === 'm' || e.key === 'M') v.muted = !v.muted;
  else handled = false;
  if (handled) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
// Les touches de la recherche, et les flèches déjà traitées, ne doivent pas atteindre l'interface YouTube.
for (const type of ['keyup', 'keypress']) {
  window.addEventListener(type, (e) => {
    if (searchBox) e.stopImmediatePropagation();
    else if (type === 'keyup' && swallowKeyUp.delete(e.key)) e.stopImmediatePropagation();
  }, true);
}

// ---------------------------------------------------------------- Souris
function initMouse() {
  // Molette : une seule touche par geste. Maj+molette (ou molette latérale) = horizontal.
  let last = 0;
  const onWheel = (e) => {
    if (!isTv() || videoPlaying() || searchBox) return;
    // On bloque le défilement natif de l'interface TV : seule notre touche fléchée doit agir.
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type !== 'wheel') return;
    const now = Date.now();
    if (now - last < 250) return;
    const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
    const d = horizontal ? (e.deltaX || e.deltaY) : e.deltaY;
    if (!d) return;
    sendKey(horizontal ? (d > 0 ? 'Right' : 'Left') : (d > 0 ? 'Down' : 'Up'));
    last = now;
  };
  window.addEventListener('wheel', onWheel, { passive: false, capture: true });
  window.addEventListener('mousewheel', onWheel, { passive: false, capture: true });
  window.addEventListener('DOMMouseScroll', onWheel, { passive: false, capture: true });

  // Glisser : tirer vers la gauche avance dans la rangée.
  const STEP = 130;
  let down = null, dragged = false;
  window.addEventListener('mousedown', (e) => {
    if (!isTv() || e.button !== 0) return;
    down = { x: e.clientX, y: e.clientY };
    dragged = false;
  }, true);
  window.addEventListener('mousemove', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.abs(dx) >= STEP && Math.abs(dx) >= Math.abs(dy)) {
      sendKey(dx < 0 ? 'Right' : 'Left'); down = { x: e.clientX, y: e.clientY }; dragged = true;
    } else if (Math.abs(dy) >= STEP) {
      sendKey(dy < 0 ? 'Down' : 'Up'); down = { x: e.clientX, y: e.clientY }; dragged = true;
    }
  }, true);
  // Après un glisser, le relâchement du bouton ne doit pas valider la vignette sous le curseur.
  const swallowIfDragged = (e) => {
    if (!dragged) return;
    e.stopImmediatePropagation();
    e.preventDefault();
  };
  window.addEventListener('mouseup', (e) => {
    down = null;
    if (e.button === 3) { e.preventDefault(); history.back(); return; }
    if (e.button === 4) { e.preventDefault(); history.forward(); return; }
    swallowIfDragged(e);
    setTimeout(() => { dragged = false; }, 80);
  }, true);
  for (const type of ['pointerup', 'click', 'auxclick']) window.addEventListener(type, swallowIfDragged, true);

  // Double-clic : plein écran quand une vidéo est en cours.
  window.addEventListener('dblclick', () => { if (onWatchPage()) ipcRenderer.send('st-fullscreen'); }, true);
}

// ---------------------------------------------------------------- Boutons Retour / Accueil / Recherche
function addNavButtons() {
  if (document.getElementById('st-nav')) return;
  const box = document.createElement('div');
  box.id = 'st-nav';
  box.style.cssText =
    'position:fixed;top:12px;left:12px;z-index:2147483645;display:flex;gap:8px;opacity:0;' +
    'transition:opacity .25s;pointer-events:none;';
  const mk = (label, title, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.title = title;
    b.style.cssText =
      'width:44px;height:44px;border:0;border-radius:50%;background:rgba(0,0,0,.65);color:#fff;' +
      'font-size:22px;cursor:pointer;pointer-events:auto;';
    b.onmouseenter = () => (b.style.background = 'rgba(0,150,160,.9)');
    b.onmouseleave = () => (b.style.background = 'rgba(0,0,0,.65)');
    b.onclick = fn;
    return b;
  };
  box.append(
    mk('←', 'Retour', () => history.back()),
    mk('⌂', 'Accueil', () => {
      location.href = isTv() ? 'https://www.youtube.com/tv' : 'https://www.youtube.com/';
    }),
    mk('⌕', 'Rechercher (/)', () => openSearch()),
    mk('?', 'Aide (F1)', () => toggleHelp())
  );
  document.documentElement.appendChild(box);
  let timer;
  window.addEventListener('mousemove', () => {
    box.style.opacity = '1';
    clearTimeout(timer);
    timer = setTimeout(() => (box.style.opacity = '0'), 3000);
  });
}

// ---------------------------------------------------------------- Publicités
window.addEventListener('DOMContentLoaded', () => {
  addNavButtons();
  initMouse();
  const style = document.createElement('style');
  style.textContent = `
    ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-banner-promo-renderer,
    ytd-statement-banner-renderer, ytd-promoted-sparkles-web-renderer, ytd-display-ad-renderer,
    ytd-companion-slot-renderer, #masthead-ad, #player-ads, .ytp-ad-overlay-container,
    .ytp-ad-module { display: none !important; }`;
  document.documentElement.appendChild(style);
});

// ---------------------------------------------------------------- SponsorBlock
let currentId = null;
let segments = [];

function videoId() {
  const m = location.href.match(/[?&#]v=([\w-]{11})/) || location.pathname.match(/\/(?:shorts|embed)\/([\w-]{11})/);
  return m ? m[1] : null;
}

async function loadSegments(id) {
  segments = [];
  try {
    const url = `${SB_API}?videoID=${id}&categories=${encodeURIComponent(JSON.stringify(CATEGORIES))}`;
    const res = await fetch(url);
    if (res.ok) segments = (await res.json()).map((s) => s.segment);
  } catch (_) { /* hors ligne ou aucune donnée */ }
}

// Analyse de la page (1 fois par seconde) : enquêtes publicitaires et clavier virtuel TV.
const SKIP_TEXT = /^(ignorer l.enqu[eê]te|ignorer|passer l.enqu[eê]te|skip survey|skip)$/i;
function scanPage() {
  const text = document.body && document.body.innerText;
  if (!text) return;

  // Clavier virtuel de la recherche TV -> on ouvre la saisie au clavier à la place.
  const keyboard = /(ESPACE|SPACE)[\s\S]*(EFFACER|CLEAR)[\s\S]*(RECHERCHER|SEARCH)/.test(text) && /\bA\b[\s\S]*\bB\b[\s\S]*\bC\b/.test(text);
  if (keyboard) { if (!searchBox && !searchSuppressed) openSearch(); }
  else searchSuppressed = false;

  // Enquête publicitaire.
  if (/(enqu[eê]te sur un annonceur|advertiser survey)/i.test(text)) {
    const nodes = document.querySelectorAll('ytlr-button, ytlr-button-renderer, ytlr-skip-button-renderer, button, [role="button"]');
    for (const n of nodes) {
      if (SKIP_TEXT.test((n.innerText || n.textContent || '').trim())) {
        n.focus && n.focus();
        n.click();
        n.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        n.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        return;
      }
    }
  }
}

function tick() {
  const v = video();
  if (!v) return;

  const adShowing = document.querySelector(
    '.ad-showing, .ytp-ad-player-overlay, .ytlr-ad-player-overlay-renderer, [class*="ad-interrupting"]'
  );
  if (adShowing && isFinite(v.duration) && v.duration > 0) {
    v.muted = true;
    v.currentTime = v.duration;
    const skip = document.querySelector(
      '.ytp-skip-ad-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button, [class*="skip-button"]'
    );
    if (skip) skip.click();
    return;
  }

  const id = videoId();
  if (id !== currentId) {
    currentId = id;
    segments = [];
    if (id) loadSegments(id);
  }
  const t = v.currentTime;
  for (const [start, end] of segments) {
    if (t >= start && t < end - 0.3) {
      v.currentTime = end;
      break;
    }
  }
}

setInterval(tick, 500);
setInterval(scanPage, 1000);
