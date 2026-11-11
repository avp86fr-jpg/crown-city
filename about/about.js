'use strict';
const video = document.querySelector('#trailer-video');
const status = document.querySelector('#video-status');
const chapters=[...document.querySelectorAll('[data-time]')];
let pendingSeek=null;
chapters.forEach(button=>button.addEventListener('click',()=>{
  const time=Number(button.dataset.time);status.textContent='';
  if(video.readyState>=1)video.currentTime=time;else pendingSeek=time;
  video.play().catch(()=>{status.textContent='Press play to watch this scene.';});
}));
video.addEventListener('loadedmetadata',()=>{if(pendingSeek!==null){video.currentTime=Math.min(pendingSeek,video.duration);pendingSeek=null;}});
video.addEventListener('timeupdate',()=>{
  const active=chapters.findLast(b=>Number(b.dataset.time)<=video.currentTime);
  for(const b of chapters)if(b===active)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();});
document.querySelectorAll('[data-watch]').forEach(link => {
  link.addEventListener('click', () => {
    status.textContent = '';
    video.play().catch(() => { status.textContent = 'Press play on the trailer to start the film.'; });
  });
});
video.addEventListener('error', () => { status.textContent = 'The trailer could not load. Use the download link below to watch it.'; });
const gallery = [...document.querySelectorAll('[data-shot]')];
const dialog = document.querySelector('#lightbox');
const image = document.querySelector('#lightbox-image');
const caption = document.querySelector('#lightbox-caption');
let current = 0;
let opener = null;
function showShot(index) {
  current = (index + gallery.length) % gallery.length;
  const source = gallery[current].querySelector('img');
  image.src = source.src;
  image.alt = source.alt;
  caption.textContent = gallery[current].closest('figure').querySelector('figcaption span').textContent;
  document.querySelector('#shot-count').textContent = `${current + 1} / ${gallery.length}`;
}
gallery.forEach((button, index) => button.addEventListener('click', () => {
  video.pause();
  opener = button;
  showShot(index);
  dialog.showModal();
  document.body.classList.add('gallery-open');
  document.querySelector('#close-gallery').focus();
}));
document.querySelector('#close-gallery').addEventListener('click', () => dialog.close());
document.querySelector('#previous-shot').addEventListener('click', () => showShot(current - 1));
document.querySelector('#next-shot').addEventListener('click', () => showShot(current + 1));
dialog.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    showShot(current + (event.key === 'ArrowLeft' ? -1 : 1));
  }
});
dialog.addEventListener('click', event => {
  const r = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
});
dialog.addEventListener('close', () => {
  document.body.classList.remove('gallery-open');
  opener?.focus();
});
