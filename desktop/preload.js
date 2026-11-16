// Injecté dans la page YouTube : masque/saute les publicités et saute les segments SponsorBlock.
const SB_API = 'https://sponsor.ajay.app/api/skipSegments';
const CATEGORIES = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro'];

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

// Souris -> flèches du clavier, pour faire défiler l'interface TV à la molette ou en glissant.
const { ipcRenderer } = require('electron');
const sendKey = (k) => ipcRenderer.send('st-key', k);
const isTv = () => /^\/tv/.test(location.pathname);
const videoPlaying = () => { const v = document.querySelector('video'); return v && !v.paused; };

function initMouseNavigation() {
  // Molette : une touche par cran, en limitant la cadence.
  let accX = 0, accY = 0, last = 0;
  window.addEventListener('wheel', (e) => {
    if (!isTv() || videoPlaying()) return;
    e.preventDefault();
    accX += e.deltaX + (e.shiftKey ? e.deltaY : 0);
    accY += e.shiftKey ? 0 : e.deltaY;
    const now = Date.now();
    if (now - last < 90) return;
    if (Math.abs(accY) >= 40) { sendKey(accY > 0 ? 'Down' : 'Up'); accY = 0; last = now; }
    else if (Math.abs(accX) >= 40) { sendKey(accX > 0 ? 'Right' : 'Left'); accX = 0; last = now; }
  }, { passive: false });

  // Glisser : faire glisser vers la gauche avance dans la liste (comme sur un écran tactile).
  const STEP = 110;
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
      sendKey(dx < 0 ? 'Right' : 'Left'); down.x = e.clientX; down.y = e.clientY; dragged = true;
    } else if (Math.abs(dy) >= STEP) {
      sendKey(dy < 0 ? 'Down' : 'Up'); down.x = e.clientX; down.y = e.clientY; dragged = true;
    }
  }, true);
  window.addEventListener('mouseup', () => { down = null; }, true);
  // Un glisser ne doit pas être pris pour un clic sur une vignette.
  window.addEventListener('click', (e) => {
    if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; }
  }, true);
}

// Boutons Retour / Accueil, visibles quand la souris bouge.
function addNavButtons() {
  if (document.getElementById('st-nav')) return;
  const box = document.createElement('div');
  box.id = 'st-nav';
  box.style.cssText =
    'position:fixed;top:12px;left:12px;z-index:2147483647;display:flex;gap:8px;opacity:0;' +
    'transition:opacity .25s;pointer-events:none;';
  const mk = (label, title, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.title = title;
    b.style.cssText =
      'width:44px;height:44px;border:0;border-radius:50%;background:rgba(0,0,0,.65);color:#fff;' +
      'font-size:24px;cursor:pointer;pointer-events:auto;';
    b.onmouseenter = () => (b.style.background = 'rgba(0,150,160,.9)');
    b.onmouseleave = () => (b.style.background = 'rgba(0,0,0,.65)');
    b.onclick = fn;
    return b;
  };
  box.append(
    mk('\u2190', 'Retour', () => history.back()),
    mk('\u2302', 'Accueil', () => {
      location.href = /\/tv/.test(location.pathname) ? 'https://www.youtube.com/tv' : 'https://www.youtube.com/';
    })
  );
  document.documentElement.appendChild(box);
  let timer;
  window.addEventListener('mousemove', () => {
    box.style.opacity = '1';
    clearTimeout(timer);
    timer = setTimeout(() => (box.style.opacity = '0'), 3000);
  });
}

// Masque les emplacements publicitaires du site classique.
window.addEventListener('DOMContentLoaded', () => {
  addNavButtons();
  initMouseNavigation();
  const style = document.createElement('style');
  style.textContent = `
    ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-banner-promo-renderer,
    ytd-statement-banner-renderer, ytd-promoted-sparkles-web-renderer, ytd-display-ad-renderer,
    ytd-companion-slot-renderer, #masthead-ad, #player-ads, .ytp-ad-overlay-container,
    .ytp-ad-module { display: none !important; }`;
  document.documentElement.appendChild(style);
});

// Enquêtes publicitaires et autres écrans à ignorer : clic automatique sur « Ignorer / Skip ».
const SKIP_TEXT = /^(ignorer l.enqu[eê]te|ignorer|passer l.enqu[eê]te|skip survey|skip)$/i;
function dismissSurvey() {
  const page = document.body && document.body.innerText;
  if (!page || !/(enqu[eê]te sur un annonceur|advertiser survey|survey)/i.test(page)) return;
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

function tick() {
  dismissSurvey();
  const video = document.querySelector('video');
  if (!video) return;

  const adShowing = document.querySelector(
    '.ad-showing, .ytp-ad-player-overlay, .ytlr-ad-player-overlay-renderer, [class*="ad-interrupting"]'
  );
  if (adShowing && isFinite(video.duration) && video.duration > 0) {
    video.muted = true;
    video.currentTime = video.duration;
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
  const t = video.currentTime;
  for (const [start, end] of segments) {
    if (t >= start && t < end - 0.3) {
      video.currentTime = end;
      break;
    }
  }
}

setInterval(tick, 500);
