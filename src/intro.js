// User-supplied opening film. Media is requested only after a menu action.
export function playIntro(G, onDone = () => {}) {
  if (G.introActive) return;
  const video = document.createElement('video');
  // Keep the story accessible if HTML video is unavailable.
  if (typeof video.play !== 'function') { onDone(); return; }
  const dialog = document.createElement('dialog');
  dialog.id = 'introPlayer';
  dialog.setAttribute('aria-labelledby', 'introTitle');
  dialog.innerHTML = '<header><h1 id="introTitle">CROWN CITY <span>THE OPENING</span></h1><button type="button" id="skipIntro">SKIP INTRO</button></header><div class="intro-stage"></div><footer><p id="introStatus" role="status" aria-live="polite">Loading intro…</p><button type="button" id="playIntro">PLAY INTRO</button></footer>';
  const skip = dialog.querySelector('#skipIntro');
  const play = dialog.querySelector('#playIntro');
  const status = dialog.querySelector('#introStatus');
  video.setAttribute('aria-label', 'Crown City opening film');
  video.controls = true;
  video.playsInline = true;
  video.preload = 'none';
  video.poster = new URL('../assets/video/crown-city-intro-poster.jpg', import.meta.url).href;
  video.src = new URL('../assets/video/crown-city-intro.mp4', import.meta.url).href;
  const master = G.audio.masterVol ?? G.settings.master ?? 0.9;
  video.volume = master;
  video.muted = master === 0;
  dialog.querySelector('.intro-stage').append(video);
  document.body.append(dialog);
  G.introActive = true;
  G.releaseControls?.();
  G.audio.setMaster?.(0);
  const wrap = document.getElementById('wrap'), wasInert = wrap.inert;
  wrap.inert = true;
  let closed = false;

  function finish() {
    if (closed) return;
    closed = true;
    video.pause();
    video.removeAttribute('src');
    video.load(); // Release the decoder and cancel any remaining download.
    document.removeEventListener('visibilitychange', visibility);
    dialog.close();
    dialog.remove();
    wrap.inert = wasInert;
    G.introActive = false;
    G.releaseControls?.();
    G.audio.setMaster?.(master);
    onDone();
    G.canvas.focus({ preventScroll: true });
  }
  async function begin() {
    status.textContent = 'Loading intro…';
    play.hidden = true;
    if (video.error) video.load();
    try { await video.play(); }
    catch (error) {
      if (closed) return;
      play.hidden = false;
      status.textContent = error.name === 'NotAllowedError'
        ? 'Press Play intro to begin. You can skip at any time.'
        : 'The intro could not play. Retry or skip to continue.';
    }
  }
  function visibility() {
    if (document.hidden) video.pause();
  }
  video.addEventListener('playing', () => {
    status.textContent = 'You can skip at any time.';
    play.hidden = true;
  });
  video.addEventListener('pause', () => {
    if (closed || video.ended || video.error) return;
    status.textContent = 'Intro paused.';
    play.textContent = 'RESUME INTRO';
    play.hidden = false;
  });
  video.addEventListener('waiting', () => { status.textContent = 'Buffering… You can still skip.'; });
  video.addEventListener('error', () => {
    if (closed) return;
    status.textContent = 'The intro could not load. Retry or skip to continue.';
    play.textContent = 'RETRY INTRO';
    play.hidden = false;
  });
  video.addEventListener('ended', finish);
  skip.addEventListener('click', finish);
  play.addEventListener('click', begin);
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
  dialog.addEventListener('close', finish);
  document.addEventListener('visibilitychange', visibility);
  dialog.showModal();
  skip.focus();
  begin();
}
