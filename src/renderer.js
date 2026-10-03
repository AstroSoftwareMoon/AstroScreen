const $ = (s) => document.querySelector(s);
const el = { grid: $('#sources'), video: $('#preview'), vp: $('#viewport'), shot: $('#shot'), copy: $('#copy'), rec: $('#rec'), pause: $('#pause'), clock: $('#clock'), toast: $('#toast'), count: $('#count'), lib: $('#library') };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const S = { q: '8', fps: '30', cd: '3', mic: false, sys: false, ...JSON.parse(localStorage.getItem('as') || '{}') };
let stream = null, recorder = null, chunks = [], tick = null, secs = 0, lastShot = null, current = null, busy = false;

// ---- Ajustes persistentes ----
for (const k of ['q', 'fps', 'cd', 'mic', 'sys']) {
  const f = $('#' + k), box = f.type === 'checkbox';
  box ? (f.checked = S[k]) : (f.value = S[k]);
  f.addEventListener('change', () => {
    S[k] = box ? f.checked : f.value;
    localStorage.setItem('as', JSON.stringify(S));
    if (k === 'fps' && stream) stream.getVideoTracks()[0].applyConstraints({ frameRate: +S.fps }).catch(() => {});
    if (k === 'sys' && current && !recorder) pick(current.id, current.card);
  });
}
if (api.platform !== 'win32') $('#sysbox').hidden = true;

function say(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(say.t);
  say.t = setTimeout(() => el.toast.classList.remove('show'), 3500);
}

// ---- Fuentes ----
async function loadSources() {
  const list = await api.sources();
  el.grid.replaceChildren();
  for (const s of list) {
    const card = document.createElement('button');
    card.className = 'card';
    card.setAttribute('role', 'option');
    card.setAttribute('aria-selected', String(current?.id === s.id));
    const img = Object.assign(document.createElement('img'), { src: s.thumb, alt: '' });
    const name = Object.assign(document.createElement('span'), { textContent: s.name });
    card.append(img, name);
    card.addEventListener('click', () => pick(s.id, card));
    el.grid.append(card);
  }
}

async function pick(id, card) {
  if (recorder) return say('Detén la grabación antes de cambiar de fuente.');
  try {
    await api.select(id, S.sys);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: +S.fps }, audio: S.sys && api.platform === 'win32' });
    el.video.srcObject = stream;
    current = { id, card };
    el.vp.classList.add('live');
    el.shot.disabled = el.rec.disabled = false;
    el.grid.querySelectorAll('.card').forEach((c) => c.setAttribute('aria-selected', String(c === card)));
  } catch {
    say('No se pudo acceder a la pantalla. Revisa los permisos de captura del sistema.');
  }
}

async function countdown() {
  for (let n = +S.cd; n > 0; n--) { el.count.textContent = n; el.count.hidden = false; await wait(1000); }
  el.count.hidden = true;
}

// ---- Captura ----
async function shoot() {
  if (!stream) return say('Elige una fuente primero.');
  if (busy) return;
  busy = true;
  await countdown();
  const c = document.createElement('canvas');
  c.width = el.video.videoWidth; c.height = el.video.videoHeight;
  c.getContext('2d').drawImage(el.video, 0, 0);
  lastShot = await new Promise((r) => c.toBlob(r, 'image/png'));
  await api.save(await lastShot.arrayBuffer(), 'png');
  el.copy.disabled = false;
  busy = false;
  say('Captura guardada en tu carpeta Imágenes/AstroScreen');
  loadLibrary();
}
el.copy.addEventListener('click', async () => {
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': lastShot })]); say('Copiada al portapapeles'); }
  catch { say('No se pudo copiar la captura.'); }
});

// ---- Grabación ----
async function startRecording() {
  if (busy) return;
  busy = true;
  await countdown();
  const tracks = [...stream.getTracks()];
  if (S.mic) {
    try { tracks.push(...(await navigator.mediaDevices.getUserMedia({ audio: true })).getAudioTracks()); }
    catch { say('No se pudo usar el micrófono. Se grabará sin él.'); }
  }
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  chunks = [];
  recorder = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: +S.q * 1e6 });
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = async () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    await api.save(await blob.arrayBuffer(), 'webm');
    say('Grabación guardada en tu carpeta Vídeos/AstroScreen');
    recorder = null; busy = false;
    loadLibrary();
  };
  recorder.start(1000);
  secs = 0; el.clock.textContent = '00:00'; el.clock.hidden = false;
  tick = setInterval(() => {
    if (recorder?.state !== 'recording') return;
    secs++;
    el.clock.textContent = `${String((secs / 60) | 0).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  }, 1000);
  el.vp.classList.add('recording');
  el.rec.classList.add('on');
  el.rec.setAttribute('aria-label', 'Detener grabación');
  el.pause.disabled = false; el.shot.disabled = true;
  busy = false;
}
function stopRecording() {
  recorder.stop();
  clearInterval(tick);
  el.clock.hidden = true;
  el.vp.classList.remove('recording', 'paused');
  el.rec.classList.remove('on');
  el.rec.setAttribute('aria-label', 'Empezar a grabar');
  el.pause.textContent = 'Pausa';
  el.pause.disabled = true; el.shot.disabled = false;
}
el.rec.addEventListener('click', () => (recorder ? stopRecording() : startRecording()));
el.shot.addEventListener('click', shoot);
el.pause.addEventListener('click', () => {
  if (!recorder) return;
  const pausing = recorder.state === 'recording';
  pausing ? recorder.pause() : recorder.resume();
  el.vp.classList.toggle('paused', pausing);
  el.pause.textContent = pausing ? 'Reanudar' : 'Pausa';
});
api.onHotkey((a) => { if (!stream) return say('Elige una fuente primero.'); a === 'rec' ? el.rec.click() : shoot(); });

// ---- Biblioteca ----
async function loadLibrary() {
  const items = await api.library();
  el.lib.replaceChildren();
  if (!items.length) {
    el.lib.append(Object.assign(document.createElement('p'), { className: 'empty static', textContent: 'Aún no hay nada. Tus capturas y vídeos aparecerán aquí.' }));
    return;
  }
  for (const it of items) {
    const card = document.createElement('article');
    card.className = 'card';
    let thumb;
    if (it.thumb) thumb = Object.assign(document.createElement('img'), { src: it.thumb, alt: '' });
    else thumb = Object.assign(document.createElement('div'), { className: 'ph', textContent: 'WEBM' });
    const name = Object.assign(document.createElement('span'), { textContent: new Date(it.time).toLocaleString() });
    const row = document.createElement('div');
    row.className = 'row';
    const open = Object.assign(document.createElement('button'), { className: 'ghost', textContent: 'Abrir' });
    const show = Object.assign(document.createElement('button'), { className: 'ghost', textContent: 'Mostrar' });
    open.onclick = () => api.open(it.path);
    show.onclick = () => api.reveal(it.path);
    row.append(open, show);
    card.append(thumb, name, row);
    el.lib.append(card);
  }
}

// ---- Navegación y enlaces ----
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
  $('#v-capture').hidden = t.dataset.tab !== 'capture';
  $('#v-library').hidden = t.dataset.tab !== 'library';
  if (t.dataset.tab === 'library') loadLibrary();
}));
$('#refresh').addEventListener('click', loadSources);
$('#folder').addEventListener('click', () => api.folder());
$('#support').addEventListener('click', () => api.link('support'));
$('#github').addEventListener('click', () => api.link('github'));

// ---- Fondo de estrellas ----
(() => {
  const c = $('#stars'), x = c.getContext('2d'), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w, h, st = [];
  const resize = () => {
    w = c.width = innerWidth; h = c.height = innerHeight;
    st = Array.from({ length: Math.min(180, (w * h) / 9000) | 0 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + 0.2, v: Math.random() * 0.15 + 0.03, p: Math.random() * 6 }));
  };
  addEventListener('resize', resize); resize();
  (function frame(t) {
    x.clearRect(0, 0, w, h);
    for (const s of st) {
      if (!reduce) { s.y += s.v; if (s.y > h) s.y = 0; }
      x.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t / 1300 + s.p));
      x.fillStyle = '#ecebff';
      x.beginPath(); x.arc(s.x, s.y, s.r, 0, 6.3); x.fill();
    }
    requestAnimationFrame(frame);
  })(0);
})();

loadSources();

// ---- Comprobador de actualizaciones ----
async function checkUpdates() {
  try {
    const update = await api.checkUpdates();
    if (update && update.hasUpdate) {
      const banner = $('#update-banner');
      const versionEl = $('#update-version');
      const btn = $('#update-btn');
      const close = $('#update-close');

      if (versionEl) versionEl.textContent = update.version;
      if (btn) btn.onclick = () => api.openUrl(update.url);
      if (close) close.onclick = () => { banner.hidden = true; };
      if (banner) banner.hidden = false;
    }
  } catch {
    // Si no hay internet o falla la API, no mostramos nada
  }
}

setTimeout(checkUpdates, 1500);
