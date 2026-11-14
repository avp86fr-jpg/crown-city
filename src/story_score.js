/* Story scoring: per-mission points + S/A/B/C grade, best results kept in the
   story save (director state), a painted results card with a count-up, and the
   end-of-story final score. Free ride never runs jobs, so it never scores. */
// Par time per job (seconds); faster than par earns the full time bonus.
export const PAR=Object.freeze([240,300,330,420,420,480]);
export const GRADE_CUTS=Object.freeze({S:2600,A:2000,B:1400});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0));
export function gradeFor(points){return points>=GRADE_CUTS.S?'S':points>=GRADE_CUTS.A?'A':points>=GRADE_CUTS.B?'B':'C';}
export function scoreMission(m={},job=0){
 const par=PAR[job]||360,elapsed=clamp(m.elapsed,0,86400),shots=clamp(m.shots,0,1e6),hits=clamp(m.hits,0,shots);
 const parts=[
  ['JOB COMPLETE',1000],
  ['TIME BONUS',Math.round(600*clamp((par*1.6-elapsed)/(par*.6),0,1))],
  ['ACCURACY',shots?Math.round(500*hits/shots):300],
  ['STUNTS / NEAR MISSES / DRIFTS',Math.round(Math.min(600,clamp(m.nearMiss,0,999)*50+clamp(m.drift,0,9999)*20+clamp(m.stunts,0,99)*100))],
  [m.peakHeat?`HEAT x${m.peakHeat}`:'NO HEAT',m.peakHeat?-60*clamp(m.peakHeat,0,5):300],
  ['DAMAGE TAKEN',-Math.round(Math.min(400,clamp(m.damage,0,1e6)*2))],
  ['COLLATERAL',-Math.round(Math.min(800,clamp(m.civilianHarm,0,999)*80+clamp(m.collisions,0,999)*15))],
 ];
 if(m.deaths)parts.push(['WASTED',-300*clamp(m.deaths,0,9)]);
 const points=Math.max(0,parts.reduce((s,p)=>s+p[1],0));
 return {points,grade:gradeFor(points),parts};
}
// Keep only the best result per job; returns true when this run is a new best.
export function recordBest(D,job,score){
 if(!D)return false;D.scores=cleanScores(D.scores);const prev=D.scores[job];
 if(prev&&prev.points>=score.points)return false;D.scores[job]={points:score.points,grade:score.grade};return true;
}
export function cleanScores(s){const out={};if(s&&typeof s==='object')for(const [k,v] of Object.entries(s)){const j=+k;if(Number.isInteger(j)&&j>=0&&j<PAR.length&&v&&Number.isFinite(v.points)){const p=Math.max(0,Math.min(1e6,Math.round(v.points)));out[j]={points:p,grade:gradeFor(p)};}}return out;}
export function storyTotals(D,count=PAR.length){
 const S=cleanScores(D?.scores),rows=[];let total=0;
 for(let j=0;j<count;j++){const r=S[j];rows.push({job:j,points:r?.points||0,grade:r?r.grade:'-'});total+=r?.points||0;}
 const played=rows.filter(r=>r.grade!=='-').length;
 return {total,rows,played,grade:played?gradeFor(total/played):'-',best:Math.max(total,Math.round(+D?.bestTotal||0))};
}
// ---- painted cards ----
const GCOL={S:'#ffd35a',A:'#6fe3a0',B:'#6fc7ff',C:'#d9a0ff','-':'#7b8794'};
function card(c,x,y,w,h,s){
 const g=c.createLinearGradient(x,y,x,y+h);g.addColorStop(0,'#1c1430');g.addColorStop(1,'#0b0912');
 c.fillStyle='rgba(0,0,0,.45)';c.fillRect(x+8*s,y+10*s,w,h);c.fillStyle=g;c.fillRect(x,y,w,h);
 // brush-stroke frame: layered offset strokes in gold
 for(let i=0;i<3;i++){c.strokeStyle=`rgba(242,193,78,${.85-i*.25})`;c.lineWidth=(3-i)*s;c.strokeRect(x+(4+i*3)*s,y+(4+i*3)*s,w-(8+i*6)*s,h-(8+i*6)*s);}
 c.fillStyle='rgba(242,193,78,.08)';for(let i=0;i<9;i++)c.fillRect(x,y+h*(i/9),w,1.5*s);
}
function gradeBadge(c,x,y,r,grade,pop){
 const col=GCOL[grade]||'#fff';c.save();c.translate(x,y);c.scale(pop,pop);c.rotate(-.12);
 c.fillStyle='rgba(0,0,0,.4)';c.beginPath();c.arc(4,6,r,0,Math.PI*2);c.fill();
 c.fillStyle=col;c.beginPath();for(let i=0;i<16;i++){const a=i/16*Math.PI*2,rr=i%2?r*.86:r;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fill();
 c.fillStyle='#120c1c';c.font=`900 ${r*1.15}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText(grade,0,r*.06);c.restore();
}
// Count-up timing shared by both cards (seconds since open).
export function countUp(target,t,start=.35,dur=1.4){return Math.round(target*clamp((t-start)/dur,0,1)**.7);}
export function drawResultsCard(G,R){
 const c=G.ctx,W=G.canvas.width,H=G.canvas.height,s=Math.max(.8,Math.min(2.2,Math.min(W/720,H/520))),t=R.t;
 const w=Math.min(W-20,460*s),h=(150+R.score.parts.length*24)*s,x=(W-w)/2,y=Math.max(8,(H-h)/2-20*s);
 c.save();c.setTransform(1,0,0,1,0,0);c.fillStyle=`rgba(4,3,10,${Math.min(.6,t*1.5)})`;c.fillRect(0,0,W,H);c.globalAlpha=Math.min(1,t*3);
 card(c,x,y,w,h,s);c.textBaseline='middle';
 c.fillStyle='#f2c14e';c.font=`900 ${20*s}px system-ui`;c.textAlign='left';c.fillText('JOB RESULTS',x+22*s,y+30*s);
 c.fillStyle='#e9e4f5';c.font=`700 ${12*s}px system-ui`;c.fillText(String(R.title||'').toUpperCase(),x+22*s,y+52*s,w-150*s);
 R.score.parts.forEach(([k,v],i)=>{const show=t>.2+i*.12,yy=y+(84+i*24)*s;if(!show)return;c.fillStyle='#9fb0bc';c.textAlign='left';c.font=`600 ${12*s}px system-ui`;c.fillText(k,x+22*s,yy);
  c.fillStyle=v<0?'#ff7a7a':'#eef2f5';c.textAlign='right';c.fillText((v>0?'+':'')+v,x+w-150*s,yy);});
 const done=.2+R.score.parts.length*.12,shown=countUp(R.score.points,t,done,1.2),yy=y+h-40*s;
 c.fillStyle='#f2c14e';c.textAlign='left';c.font=`900 ${15*s}px system-ui`;c.fillText('SCORE',x+22*s,yy);c.textAlign='right';c.font=`900 ${26*s}px system-ui`;c.fillText(shown.toLocaleString(),x+w-150*s,yy);
 const gt=t-(done+1.25);if(gt>0)gradeBadge(c,x+w-72*s,y+h*.5,46*s,R.score.grade,gt<.25?1.6-gt*2.4:1);
 if(R.best&&gt>.3){c.fillStyle='#6fe3a0';c.font=`800 ${11*s}px system-ui`;c.textAlign='center';c.fillText('NEW BEST',x+w-72*s,y+h*.5+62*s);}
 if(gt>.5){c.fillStyle='rgba(233,228,245,.75)';c.font=`600 ${11*s}px system-ui`;c.textAlign='center';c.fillText(G.touch?'TAP TO CONTINUE':'PRESS ENTER / CLICK TO CONTINUE',W/2,y+h+18*s);}
 c.restore();
}
export function drawFinalScore(G,totals,t,titles=[]){
 const c=G.ctx,W=G.canvas.width,H=G.canvas.height,s=Math.max(.8,Math.min(2.2,Math.min(W/760,H/560)));
 const w=Math.min(W-20,500*s),h=(170+totals.rows.length*26)*s,x=(W-w)/2,y=Math.max(8,(H-h)/2-30*s);
 c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=Math.min(1,t*2.5);card(c,x,y,w,h,s);c.textBaseline='middle';
 c.fillStyle='#f2c14e';c.font=`900 ${21*s}px system-ui`;c.textAlign='left';c.fillText('FINAL SCORE',x+22*s,y+32*s);
 c.fillStyle='#9fb0bc';c.font=`600 ${11*s}px system-ui`;c.fillText(`BEST TOTAL ${totals.best.toLocaleString()}`,x+22*s,y+54*s);
 totals.rows.forEach((r,i)=>{if(t<.2+i*.15)return;const yy=y+(86+i*26)*s;c.textAlign='left';c.fillStyle='#e9e4f5';c.font=`700 ${12*s}px system-ui`;c.fillText(`${i+1}. ${String(titles[i]||'JOB '+(i+1)).toUpperCase()}`,x+22*s,yy,w-250*s);
  c.textAlign='right';c.fillStyle='#eef2f5';c.fillText(r.points.toLocaleString(),x+w-180*s,yy);c.fillStyle=GCOL[r.grade];c.font=`900 ${14*s}px system-ui`;c.fillText(r.grade,x+w-145*s,yy);});
 const done=.2+totals.rows.length*.15,yy=y+h-42*s;c.fillStyle='#f2c14e';c.textAlign='left';c.font=`900 ${15*s}px system-ui`;c.fillText('STORY TOTAL',x+22*s,yy);
 c.textAlign='right';c.font=`900 ${28*s}px system-ui`;c.fillText(countUp(totals.total,t,done,1.6).toLocaleString(),x+w-145*s,yy);
 const gt=t-(done+1.65);if(gt>0&&totals.grade!=='-')gradeBadge(c,x+w-62*s,y+h*.45,42*s,totals.grade,gt<.25?1.6-gt*2.4:1);
 c.restore();return {x,y,w,h,s};
}
// Live combo popup ("+50 NEAR MISS"), cheap: one text draw while active.
export function drawScorePop(G){const p=G.scorePop;if(!p||!(p.t>0)||G.scene!=='play')return;const c=G.ctx,W=G.canvas.width,s=Math.max(1,Math.min(2,W/900));
 c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=Math.min(1,p.t*2);c.textAlign='center';c.textBaseline='middle';c.font=`900 ${18*s}px system-ui`;c.lineWidth=4*s;c.strokeStyle='rgba(10,6,18,.8)';
 const y=G.canvas.height*.22-(1.2-p.t)*14*s,txt=`+${p.pts} ${p.label}${p.combo>1?'  x'+p.combo:''}`;c.strokeText(txt,W/2,y);c.fillStyle='#ffd35a';c.fillText(txt,W/2,y);c.restore();}
