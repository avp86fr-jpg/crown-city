export const CASINO_EVIDENCE=[{x:8060,y:3100,name:'DEALER LEDGER / A'},{x:8470,y:3280,name:'DEALER LEDGER / B'},{x:7760,y:3010,name:'CAGE RECEIPT'}];
export function drawCasinoEvidence(G,r){
 const job=G.action?.contract;if(job?.id!=='casino'||job.stage>=3)return;const p=CASINO_EVIDENCE[job.stage];
 if(p.x<r.x0-70||p.x>r.x1+70||p.y<r.y0-70||p.y>r.y1+70)return;
 const c=G.ctx;c.save();c.fillStyle='#263e42';c.fillRect(p.x-15,p.y-12,30,24);c.fillStyle='#e0d4ae';c.fillRect(p.x-10,p.y-9,20,18);c.strokeStyle='#6c8075';c.lineWidth=1;for(let y=-5;y<=5;y+=4){c.beginPath();c.moveTo(p.x-6,p.y+y);c.lineTo(p.x+7,p.y+y);c.stroke();}
 c.strokeStyle='#e6c681';c.lineWidth=3;c.beginPath();c.arc(p.x,p.y,34,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,(job.progress||0)/(job.stage===2?3:2)));c.stroke();
 c.fillStyle='#e8d4a6';c.textAlign='center';c.font='bold 10px system-ui';c.fillText(p.name,p.x,p.y-44);if(Math.hypot(G.player.x-p.x,G.player.y-p.y)<100)c.fillText(G.wanted?'LOSE THE HEAT':G.player.type!=='foot'?'APPROACH ON FOOT':'HOLD STILL / READ',p.x,p.y+52);c.restore();
}
