'use strict';
const video = document.querySelector('#trailer-video');
const status = document.querySelector('#video-status');
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
