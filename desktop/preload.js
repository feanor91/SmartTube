// Intégré à la page YouTube : saute les publicités et les segments SponsorBlock.
const SB_API = 'https://sponsor.ajay.app/api/skipSegments';
const CATEGORIES = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro'];

let currentId = null;
let segments = [];

function videoId() {
  // L'interface TV expose l'id dans le hash/la query ("v=" ou "/watch").
  const m = location.href.match(/[?&#]v=([\w-]{11})/);
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

function tick() {
  const video = document.querySelector('video');
  if (!video) return;

  // Publicités : on avance à la fin et on clique sur « Passer » si présent.
  const adShowing = document.querySelector('.ad-showing, .ytlr-ad-player-overlay-renderer, [class*="ad-interrupting"]');
  if (adShowing && isFinite(video.duration) && video.duration > 0) {
    video.muted = true;
    video.currentTime = video.duration;
    const skip = document.querySelector('.ytp-ad-skip-button, [class*="skip-button"]');
    if (skip) skip.click();
    return;
  }

  const id = videoId();
  if (id && id !== currentId) {
    currentId = id;
    loadSegments(id);
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
