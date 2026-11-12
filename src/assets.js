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

// Immutable, pre-decoded scenery at its actual sampling size. This avoids the
// first tiny fixture forcing a full atlas upload/readback inside a play frame.
export async function loadScenery(src,maxWidth=1024){
 const im=await loadImage(src);
 if(typeof createImageBitmap!=='function')return im;
 const scale=Math.min(1,maxWidth/im.width);
 try{return await createImageBitmap(im,{resizeWidth:Math.round(im.width*scale),resizeHeight:Math.round(im.height*scale),resizeQuality:'high'});}catch{return im;}
}
