/* Gesture-owned browser controls and a second touch stick for aiming. */
export function aimDirection(input, fallback, camera = 0) {
  const aim = input.touchAim;
  return aim?.active && aim.aiming ? Math.atan2(aim.x, aim.y) + camera : fallback;
}

export function bindTouchAim(G, button) {
  let pointer = null, originX = 0, originY = 0;
  const release = e => {
    if (pointer === null || e && e.pointerId !== pointer) return;
    pointer = null;
    G.input.tFire = false;
    G.input.touchAim = { active: false, aiming: false, x: 0, y: 0 };
    button.classList.remove('down');
    button.style.setProperty('--aim-x', '0px');
    button.style.setProperty('--aim-y', '0px');
  };
  button.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    if (pointer !== null) return;
    pointer = e.pointerId; originX = e.clientX; originY = e.clientY;
    G.touch = true; G.audio.unlock(); button.setPointerCapture(pointer);
    G.input.tFire = true; G.input.fireP = true;
    G.input.touchAim = { active: true, aiming: false, x: 0, y: 0 };
    button.classList.add('down');
  });
  button.addEventListener('pointermove', e => {
    if (e.pointerId !== pointer) return;
    e.preventDefault();
    const x = e.clientX - originX, y = e.clientY - originY, length = Math.hypot(x, y);
    if (length > 10) G.input.touchAim = { active: true, aiming: true, x: x / length, y: -y / length };
    const scale = length ? Math.min(24, length) / length : 0;
    button.style.setProperty('--aim-x', x * scale + 'px');
    button.style.setProperty('--aim-y', y * scale + 'px');
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, release);
  window.addEventListener('blur', () => release());
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
  G.releaseAim = () => release();
}

export function installFullscreen(G, { fit, toast }) {
  const root = document.documentElement, button = document.getElementById('tFS');
  G.isFS = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  G.fsSupported = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  G.standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  G.isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let busy = false;
  const sync = () => {
    const active = G.isFS();
    document.body.classList.toggle('isfs', active);
    if (button) {
      button.hidden = !G.fsSupported || G.standalone;
      button.setAttribute?.('aria-label', active ? 'Exit full screen' : 'Enter full screen');
      button.setAttribute?.('aria-pressed', String(active));
      button.title = active ? 'Exit full screen (F)' : 'Full screen (F)';
      const label = document.getElementById('fsLabel');
      if (label) label.textContent = active ? 'EXIT FULLSCREEN' : 'FULLSCREEN';
    }
    fit(G);
  };
  // Must run directly inside a click/key gesture; a later simulation tick can lose activation.
  G.toggleFS = async () => {
    if (busy) return;
    if (!G.fsSupported) { toast(G, G.isIOS ? 'Use Share → Add to Home Screen for an immersive view.' : 'Fullscreen is unavailable in this browser window.'); return; }
    busy = true;
    try {
      if (G.isFS()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else await document.webkitExitFullscreen?.();
      } else {
        if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
        else await root.webkitRequestFullscreen();
      }
    } catch {
      toast(G, 'Fullscreen was blocked. Open the game directly in Chrome and try again.');
      const status = document.getElementById('gameStatus');
      if (status) status.textContent = G.toast;
    } finally { busy = false; sync(); }
  };
  // An explicit control avoids changing orientation or display mode on an ordinary game tap.
  G.firstTap = () => {};
  button?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); G.audio.unlock(); G.toggleFS(); });
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  window.addEventListener('resize', sync);
  window.visualViewport?.addEventListener('resize', sync);
  window.addEventListener('orientationchange', () => setTimeout(sync, 100));
  sync();
}

export function syncControlStyle(G) {
  document.body.dataset.scene=G.scene;
  document.body.classList.toggle('touch-input', !!G.touch);
  document.body.classList.toggle('left-handed', !!G.settings.leftHanded);
  document.body.classList.toggle('game-menu', G.scene !== 'play');
  document.body.style.setProperty('--control-scale', String(G.settings.controlSize || 1));
  document.body.style.setProperty('--control-opacity', String(G.settings.controlOpacity || .8));
}
