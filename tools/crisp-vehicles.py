"""Crispen the painted vehicle atlases: unsharp detail, a touch of local contrast,
and a soft top-left specular sheen on body pixels. Alpha edges are kept tight."""
import sys
from PIL import Image, ImageFilter, ImageEnhance, ImageChops
import numpy as np
def crisp(src,dst,scale=1.0):
 im=Image.open(src).convert('RGBA');a=im.getchannel('A')
 rgb=im.convert('RGB').filter(ImageFilter.UnsharpMask(radius=1.6*scale,percent=120,threshold=2))
 rgb=ImageEnhance.Contrast(rgb).enhance(1.08);rgb=ImageEnhance.Color(rgb).enhance(1.08)
 arr=np.asarray(rgb).astype(np.float32)
 # Clean alpha: harden the soft halo so edges read crisp at game zoom.
 al=np.asarray(a).astype(np.float32)/255;al=np.clip((al-.12)/.76,0,1)
 # darken a 1px rim just inside the silhouette (painted outline)
 inner=np.asarray(Image.fromarray((al*255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))).astype(np.float32)/255
 rim=np.clip(al-inner,0,1)[...,None];arr=arr*(1-.35*rim)
 out=np.dstack([np.clip(arr,0,255),al*255]).astype(np.uint8)
 Image.fromarray(out,'RGBA').save(dst,quality=90,method=6)
for n in ['vehicles','city-fleet']:
 crisp(f'/workspace/cc_work/vorig/{n}.webp',f'assets/premium/{n}.webp')
 crisp(f'/workspace/cc_work/vorig/{n}-mobile.webp',f'assets/premium/{n}-mobile.webp',.5)
