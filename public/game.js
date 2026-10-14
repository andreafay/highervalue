const $ = (s) => document.querySelector(s);
const views = { home: $('#home'), game: $('#game') };
const cards = [$('#card-0'), $('#card-1')];

let score = 0, best = 0, seen = [], pair = null, locked = true;
try { best = Number(localStorage.getItem('hv-best')) || 0; } catch {}

// Simple synthesized sounds (no audio files needed).
let audioCtx = null, muted = false;
try { muted = localStorage.getItem('hv-muted') === '1'; } catch {}
// Monochrome line icons (inherit the button's text colour).
const SVG = (inner) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const SPEAKER = '<path d="M11 5 6 9H3v6h3l5 4z"/>';
const ICON_ON = SVG(SPEAKER + '<path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>');
const ICON_OFF = SVG(SPEAKER + '<path d="m16 9 5 6"/><path d="m21 9-5 6"/>');
function renderMute() {
  const btn = $('#mute');
  btn.innerHTML = muted ? ICON_OFF : ICON_ON;
  btn.classList.toggle('off', muted);
  btn.title = btn.ariaLabel = muted ? 'Unmute sounds' : 'Mute sounds';
}
function tone(freq, start, dur, { type = 'sine', vol = 0.15, to = freq } = {}) {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime + start;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  } catch {}
}
const sounds = {
  click: () => tone(420, 0, 0.05, { vol: 0.05, to: 260 }),
  correct: () => { tone(587, 0, 0.18, { vol: 0.06 }); tone(784, 0.09, 0.28, { vol: 0.06 }); },
  wrong: () => tone(220, 0, 0.35, { vol: 0.07, to: 150 }),
};
// Click sound on every button; guess results get their own sound after the reveal.
document.addEventListener('click', (e) => { if (e.target.closest('button')) sounds.click(); });

function show(name) {
  Object.entries(views).forEach(([k, el]) => el.classList.toggle('active', k === name));
  $('#lost').hidden = true;
  renderBest();
}
function renderBest() {
  $('#best').textContent = best;
  $('#best-home').textContent = best;
}

function formatValue(v) {
  if (v >= 1e6) return '€' + (v / 1e6).toFixed(v >= 1e8 ? 0 : 1).replace(/\.0$/, '') + 'm';
  return '€' + Math.round(v / 1e3) + 'k';
}

function countUp(el, target) {
  const start = performance.now(), dur = 700;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    el.textContent = formatValue(target * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(tick); else el.textContent = formatValue(target);
  };
  requestAnimationFrame(tick);
}

function initials(name) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function renderCard(card, p) {
  card.className = 'card enter';
  card.disabled = false;
  card.setAttribute('aria-label', `Pick ${p.name}`);
  const photo = card.querySelector('.photo');
  const img = photo.querySelector('img');
  photo.classList.remove('fallback');
  photo.dataset.initials = initials(p.name);
  img.onerror = () => { img.removeAttribute('src'); photo.classList.add('fallback'); };
  img.src = p.image;
  img.alt = p.name;
  card.querySelector('.name').textContent = p.name;
  card.querySelector('.club').textContent = p.club || '';
  card.querySelector('.value').textContent = '';
}

async function nextPair() {
  locked = true;
  $('#status').textContent = 'Loading players…';
  const res = await fetch('/api/pair?exclude=' + seen.slice(-200).join(','));
  pair = await res.json();
  seen.push(pair[0].id, pair[1].id);
  pair.forEach((p, i) => renderCard(cards[i], p));
  $('#status').textContent = '';
  locked = false;
}

async function choose(i) {
  if (locked) return;
  locked = true;
  const [a, b] = pair;
  const res = await fetch('/api/guess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ a: a.id, b: b.id, pick: pair[i].id }),
  });
  const { correct, values } = await res.json();
  const higher = values[a.id] > values[b.id] ? 0 : 1;
  cards.forEach((card, idx) => {
    card.disabled = true;
    card.classList.remove('enter');
    card.classList.add('revealed', idx === higher ? 'winner' : 'loser');
    if (idx === i) card.classList.add('chosen');
    countUp(card.querySelector('.value'), values[pair[idx].id]);
  });
  setTimeout(correct ? sounds.correct : sounds.wrong, 150);
  if (correct) {
    score++;
    $('#score').textContent = score;
    if (score > best) {
      best = score;
      try { localStorage.setItem('hv-best', best); } catch {}
      renderBest();
    }
    $('#status').textContent = 'Correct!';
    setTimeout(nextPair, 2000);
  } else {
    $('#status').textContent = '';
    setTimeout(() => {
      $('#final').textContent = score;
      $('#final-best').textContent = best;
      $('#lost').hidden = false;
      $('#again').focus();
    }, 1500);
  }
}

function startGame() {
  score = 0; seen = [];
  $('#score').textContent = 0;
  show('game');
  nextPair().catch(() => { $('#status').textContent = 'Could not load players. Is the server running?'; });
}

$('#mute').addEventListener('click', () => {
  muted = !muted;
  try { localStorage.setItem('hv-muted', muted ? '1' : '0'); } catch {}
  renderMute(); // the global button-click handler gives the audible confirmation when unmuting
});
renderMute();
$('#play').addEventListener('click', startGame);
$('#again').addEventListener('click', startGame);
$('#home-btn').addEventListener('click', () => show('home'));
$('#to-home').addEventListener('click', () => show('home'));
cards.forEach((c, i) => c.addEventListener('click', () => choose(i)));
renderBest();
