// Publish one immutable game module, so Chrome cannot mix old and new imports.
const {build}=require('esbuild'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
(async()=>{
 const root=path.resolve(__dirname,'..');process.chdir(root);
 const result=await build({entryPoints:['src/main.js'],bundle:true,format:'esm',target:['chrome100','safari16'],minify:true,write:false,legalComments:'inline'});
 const code=result.outputFiles[0].contents,hash=crypto.createHash('sha256').update(code).digest('hex').slice(0,12),name=`crown-city.${hash}.js`;
 fs.mkdirSync('dist',{recursive:true});
 for(const file of fs.readdirSync('dist'))if(/^crown-city\.[a-f0-9]{12}\.js$/.test(file)&&file!==name)fs.unlinkSync(path.join('dist',file));
 fs.writeFileSync(path.join('dist',name),code);
 const css=crypto.createHash('sha256').update(fs.readFileSync('css/game.css')).digest('hex').slice(0,12);
 const html=fs.readFileSync('index.html','utf8').replace(/src="(?:src\/main\.js|dist\/crown-city\.[a-f0-9]{12}\.js)"/,`src="dist/${name}"`).replace(/href="css\/game\.css(?:\?v=[^"]+)?"/,`href="css/game.css?v=${css}"`);
 fs.writeFileSync('index.html',html);console.log(`${name}: ${Math.round(code.length/1024)} KiB, one versioned module`);
})().catch(error=>{console.error(error);process.exitCode=1;});
