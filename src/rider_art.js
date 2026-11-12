/* Two small cached rider paintings: no filters or per-frame gradients. */
const riders=[];
function rider(hero){
 const key=hero?1:0;if(riders[key])return riders[key];
 const canvas=document.createElement('canvas');canvas.width=96;canvas.height=136;const c=canvas.getContext('2d');c.scale(2,2);c.translate(24,38);
 const shape=(x,y,rx,ry,col)=>{c.fillStyle=col;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();};
 // Boots and bent knees sit outside the tank, arms reach the actual handlebars.
 for(const side of [-1,1]){shape(side*9,13,4,8,'#171e25');shape(side*9,3,4.3,10,'#323d48');
  c.strokeStyle='#19202a';c.lineWidth=6;c.lineCap='round';c.beginPath();c.moveTo(side*6,-7);c.lineTo(side*9,-11);c.lineTo(side*13,-15);c.stroke();
  c.strokeStyle=hero?'#5b3c70':'#526775';c.lineWidth=4;c.stroke();shape(side*13,-15,2.4,2.8,'#1c2930');}
 const coat=c.createLinearGradient(-8,0,8,0);coat.addColorStop(0,hero?'#392849':'#263643');coat.addColorStop(.45,hero?'#866095':'#71838b');coat.addColorStop(1,hero?'#3e294e':'#31424d');shape(0,-1,8.5,13,coat);
 c.strokeStyle=hero?'#b6a16b':'#99b2b6';c.lineWidth=.7;c.beginPath();c.moveTo(-6,-7);c.lineTo(0,-4);c.lineTo(6,-7);c.moveTo(0,-3);c.lineTo(0,9);c.stroke();
 shape(0,-16,6.4,7.8,'#151e23');shape(-.6,-17,5.5,6.5,hero?'#4c5f51':'#65818c');
 c.fillStyle='#0e252e';c.beginPath();c.roundRect(-5.2,-21,10.4,4,2);c.fill();c.fillStyle='#aad5c8';c.fillRect(-3.5,-20.5,5,.8);
 shape(-2,-17,1.1,2,'rgba(230,241,222,.35)');return riders[key]=canvas;
}
export function drawBikeRider(c,v,hero){c.save();c.rotate((v.turnSign||0)*.08);c.drawImage(rider(hero),-24,-38,48,68);c.restore();}
