// Capture the authored anime compositor, independent of the game simulation.
const {chromium}=require('playwright'),fs=require('node:fs'),{spawn}=require('node:child_process'),{once}=require('node:events');
const OUT='.qa/anime-opening',preview=process.argv.includes('--preview');fs.mkdirSync(OUT,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.CC_URL||'http://127.0.0.1:8032/')+'tools/anime-opening/');await page.evaluate(()=>window.ready);
  const meta=await page.evaluate(()=>({shots:film.shots,sprites:film.sprites,duration:film.duration,fps:film.FPS}));fs.writeFileSync(OUT+'/edit.json',JSON.stringify(meta,null,2));
  let enc,closed,err='';if(!preview){enc=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate','24','-vcodec','png','-i','pipe:0','-an','-c:v','libx264','-crf','16','-preset','veryfast','-pix_fmt','yuv420p',OUT+'/picture-master.mp4']);enc.stderr.on('data',d=>err+=d);closed=once(enc,'close');}
  for(const shot of meta.shots){const samples=[shot.start+4,Math.floor((shot.start+shot.end)/2),shot.end-4];for(let i=shot.start;i<shot.end;i++){
    if(preview&&!samples.includes(i))continue;
    const png=Buffer.from(await page.evaluate(n=>{film.drawFrame(n);return film.canvas.toDataURL('image/png').split(',')[1];},i),'base64');
    if(samples.includes(i))fs.writeFileSync(`${OUT}/${shot.id}-${i}.png`,png);
    if(enc&&!enc.stdin.write(png))await once(enc.stdin,'drain');
   }console.log(`${shot.id} ${shot.start/24}s–${shot.end/24}s`);}
  if(enc){enc.stdin.end();const [code]=await closed;if(code)throw Error(err);}
  if(errors.length)throw Error(errors.join('\n'));console.log('Anime capture complete. No browser exceptions.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
