// Static preview with byte ranges, matching GitHub Pages video/audio seeking.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),port=Number(process.env.PORT||8000);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.woff':'font/woff','.mp4':'video/mp4','.ogg':'audio/ogg','.mp3':'audio/mpeg','.vtt':'text/vtt; charset=utf-8'};
http.createServer((req,res)=>{
 let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');const stat=fs.statSync(file);if(!stat.isFile())throw Error('not a file');
  const headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache'};
  let start=0,end=stat.size-1,code=200;
  if(req.headers.range){
   const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
   if(!range||!range[1]&&!range[2]){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}
   start=range[1]?Number(range[1]):Math.max(0,stat.size-Number(range[2]));end=range[1]&&range[2]?Math.min(end,Number(range[2])):end;
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}
   code=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
  }
  headers['Content-Length']=Math.max(0,end-start+1);res.writeHead(code,headers);
  if(req.method==='HEAD'||!stat.size){res.end();return;}
  const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
 }catch{res.writeHead(404).end('Not found');}
}).listen(port,'0.0.0.0',()=>console.log(`Crown City preview: http://localhost:${port}/`));
