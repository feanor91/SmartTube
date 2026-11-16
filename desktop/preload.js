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

// Masque les emplacements publicitaires du site classique.
window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-banner-promo-renderer,
    ytd-statement-banner-renderer, ytd-promoted-sparkles-web-renderer, ytd-display-ad-renderer,
    ytd-companion-slot-renderer, #masthead-ad, #player-ads, .ytp-ad-overlay-container,
    .ytp-ad-module { display: none !important; }`;
  document.documentElement.appendChild(style);
});

function tick() {
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
