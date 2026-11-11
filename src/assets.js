/* One bounded image request. Callers own caching so streamed tiles can be evicted. */
export function loadImage(src, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.decoding = 'async';
    const timer = setTimeout(() => finish(new Error('Image request timed out: ' + src)), timeout);
    function finish(error) {
      clearTimeout(timer); im.onload = im.onerror = null;
      if (error) reject(error); else resolve(im);
    }
    im.onerror = () => finish(new Error('Image unavailable: ' + src));
    im.onload = async () => {
      if (im.decode) { try { await im.decode(); } catch (e) { if (!im.naturalWidth) return finish(e); } }
      finish();
    };
    im.src = src;
  });
}
