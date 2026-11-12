// ===== LABO 7 : jeu d'horreur (raycasting canvas 2D + sons WebAudio procéduraux) =====
// Appel : startHorrorGame()   |   Arrêt : window.stopHorrorGame()
function startHorrorGame(){
if(window.stopHorrorGame)window.stopHorrorGame();
const cv=document.getElementById('game-canvas')||document.querySelector('canvas');if(!cv)return;
const ctx=cv.getContext('2d'),scoreEl=document.getElementById('current-score');
const R=Math.random,TAU=Math.PI*2,clamp=(v,a,c)=>Math.max(a,Math.min(c,v)),fl=Math.floor;
let W=cv.width,H=cv.height;const BW=320;let BH=Math.round(BW*H/W);
const bc=document.createElement('canvas');bc.width=BW;bc.height=BH;const b=bc.getContext('2d');
let fd;const mkfd=()=>{fd=b.createImageData(BW,BH);for(let i=3;i<fd.data.length;i+=4)fd.data[i]=255};mkfd();
const touch='ontouchstart' in window;

// ---------- CARTE ----------
const MAP=[
"###L################L###",
"#.....#......#.........#",
"#.....#......#.........#",
"#.....#..TT..#.TT...TT.#",
"#.....#......#.........#",
"##..#L###..######..#####",
"#......................#",
"#......................#",
"###..######P######..####",
"#......#.......#.......#",
"#......#.......#.......L",
"#..GG..#.T.T.T.#.......#",
"#......#.......#.......#",
"#......#.......#.......#",
"##L..#############..####",
"#......................#",
"#......................#",
"####..#########..#######",
"#........#.............#",
"#.SS..SS.#..TT.....TT..#",
"#........#.............#",
"#........#.............#",
"####M#######L######E####"];
const G=MAP.map(r=>r.split('')),MW=24,MH=23;
const solid=(x,y)=>{x=fl(x);y=fl(y);return x<0||y<0||x>=MW||y>=MH||G[y][x]!=='.'};
const free=(x,y,r=.22)=>!solid(x-r,y-r)&&!solid(x+r,y-r)&&!solid(x-r,y+r)&&!solid(x+r,y+r);
const los=(x1,y1,x2,y2)=>{const d=Math.hypot(x2-x1,y2-y1),n=Math.ceil(d/.15);for(let i=1;i<n;i++)if(solid(x1+(x2-x1)*i/n,y1+(y2-y1)*i/n))return false;return true};
function bfs(sx,sy,tx,ty){sx=fl(sx);sy=fl(sy);tx=fl(tx);ty=fl(ty);const pv=new Int16Array(MW*MH).fill(-1),s=sy*MW+sx,e=ty*MW+tx,q=[s];pv[s]=s;
for(let i=0;i<q.length;i++){const c=q[i];if(c===e)break;const cx=c%MW,cy=c/MW|0;for(const[d,f]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+d,ny=cy+f;if(nx<0||ny<0||nx>=MW||ny>=MH||G[ny][nx]!=='.')continue;const n=ny*MW+nx;if(pv[n]<0){pv[n]=c;q.push(n)}}}
if(pv[e]<0)return[];const p=[];let c=e;while(c!==s){p.push([c%MW+.5,(c/MW|0)+.5]);c=pv[c]}return p.reverse()}

// ---------- TEXTURES PROCÉDURALES ----------
const mk=(w,h,f)=>{const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'));return c};
const nz=(g,n,a)=>{for(let i=0;i<n;i++){g.fillStyle=R()<.5?`rgba(0,0,0,${a})`:`rgba(255,255,255,${a*.5})`;g.fillRect(R()*64|0,R()*64|0,1+(R()*2|0),1)}};
const blob=(g,x,y,r,c,a)=>{const q=g.createRadialGradient(x,y,0,x,y,r);q.addColorStop(0,`rgba(${c},${a})`);q.addColorStop(1,`rgba(${c},0)`);g.fillStyle=q;g.fillRect(x-r,y-r,r*2,r*2)};
const drip=(g,x,y,l,c)=>{g.fillStyle=c;g.fillRect(x,y,2,l);g.beginPath();g.arc(x+1,y+l,2.2,0,TAU);g.fill()};
const T=[];
T[0]=mk(64,64,g=>{g.fillStyle='#4b4e4b';g.fillRect(0,0,64,64);nz(g,1200,.18);g.fillStyle='rgba(0,0,0,.35)';g.fillRect(31,0,2,64);g.fillRect(0,31,64,2);blob(g,20,50,22,'20,18,12',.4);g.strokeStyle='rgba(0,0,0,.5)';g.beginPath();g.moveTo(50,0);g.lineTo(46,20);g.lineTo(52,36);g.lineTo(47,60);g.stroke()});
T[1]=mk(64,64,g=>{g.fillStyle='#454840';g.fillRect(0,0,64,64);nz(g,1200,.2);blob(g,18,12,26,'90,55,20',.5);blob(g,48,40,20,'30,40,20',.5);for(let i=0;i<5;i++)drip(g,8+i*12,0,20+R()*30,'rgba(80,45,20,.5)');g.fillStyle='rgba(0,0,0,.35)';g.fillRect(31,0,2,64)});
T[2]=mk(64,64,g=>{g.fillStyle='#8d9690';g.fillRect(0,0,64,64);g.fillStyle='#3d4440';for(let i=0;i<64;i+=16){g.fillRect(i,0,1,64);g.fillRect(0,i,64,1)}nz(g,900,.15);blob(g,30,20,22,'120,0,0',.9);for(let i=0;i<6;i++)drip(g,14+i*7,10+R()*8,10+R()*40,'#7a0000');blob(g,40,55,14,'70,0,0',.8)});
T[3]=mk(64,64,g=>{g.fillStyle='#364146';g.fillRect(0,0,64,64);g.fillStyle='#2a3236';g.fillRect(2,2,60,38);g.fillStyle='#1c2123';for(let i=0;i<7;i++)g.fillRect(8,6+i*5,48,2);g.fillStyle='#111';g.fillRect(0,48,64,12);g.fillStyle='#b9a21c';for(let i=-8;i<72;i+=16){g.beginPath();g.moveTo(i,60);g.lineTo(i+8,60);g.lineTo(i+16,48);g.lineTo(i+8,48);g.fill()}nz(g,700,.2)});
T[4]=mk(64,64,g=>{g.fillStyle='#2b3034';g.fillRect(0,0,64,64);g.fillStyle='#1b1f22';g.fillRect(31,0,2,64);g.fillRect(6,12,20,48);g.fillRect(38,12,20,48);g.fillStyle='#d11';g.fillRect(28,4,8,5);blob(g,32,6,14,'255,0,0',.5);g.fillStyle='#ccc';g.font='bold 6px monospace';g.fillText('ACCES',7,34);g.fillText('MORGUE',37,34);nz(g,500,.2)});
T[5]=mk(64,64,g=>{g.fillStyle='#262b28';g.fillRect(0,0,64,64);g.fillStyle='#161a18';g.fillRect(31,0,2,64);g.fillRect(4,14,24,46);g.fillRect(36,14,24,46);g.fillStyle='#0c5';g.fillRect(16,3,32,9);blob(g,32,8,26,'0,255,100',.5);g.fillStyle='#021';g.font='bold 7px monospace';g.fillText('SORTIE',18,10);g.fillStyle='#f22';g.fillRect(29,36,6,4);nz(g,500,.2)});
const gen=on=>mk(64,64,g=>{g.fillStyle='#5d521a';g.fillRect(0,0,64,64);g.fillStyle='#222';g.fillRect(0,50,64,14);g.fillStyle='#caa820';for(let i=-8;i<72;i+=16){g.beginPath();g.moveTo(i,64);g.lineTo(i+8,64);g.lineTo(i+16,50);g.lineTo(i+8,50);g.fill()}
g.fillStyle='#111';g.fillRect(8,8,48,28);g.fillStyle='#8a8';[[20,22],[44,22]].forEach(([x,y])=>{g.beginPath();g.arc(x,y,8,0,TAU);g.fill();g.fillStyle='#111';g.fillRect(x-1,y-6,2,6);g.fillStyle='#8a8'});
g.fillStyle='#000';g.fillRect(27,38,10,10);if(on){g.fillStyle='#fc4';g.fillRect(30,39,4,8)}g.fillStyle=on?'#0f4':'#f20';g.fillRect(29,2,6,4);blob(g,32,4,16,on?'0,255,70':'255,30,0',.6);nz(g,600,.2)});
T[6]=gen(false);T[8]=gen(true);
T[7]=mk(64,64,g=>{g.fillStyle='#5f6e72';g.fillRect(0,0,64,64);g.fillStyle='#8fa0a4';g.fillRect(0,0,64,14);g.fillStyle='rgba(150,255,230,.55)';g.fillRect(8,3,6,10);g.fillRect(24,5,8,8);g.fillRect(44,2,6,11);g.fillStyle='#37444a';for(let i=0;i<2;i++){g.fillRect(4,20+i*20,56,16);g.fillStyle='#bbb';g.fillRect(26,26+i*20,12,2);g.fillStyle='#37444a'}nz(g,600,.2);blob(g,40,50,10,'110,0,0',.5)});
T[9]=mk(64,64,g=>{g.fillStyle='#14181b';g.fillRect(0,0,64,64);g.fillStyle='#0a0c0d';for(let i=0;i<8;i++)g.fillRect(3,3+i*7.5,58,5);for(let i=0;i<8;i++)for(let j=0;j<6;j++){g.fillStyle=R()<.5?'#0f4':R()<.3?'#f60':'#133';g.fillRect(8+j*5,5+i*7.5,2,2)}g.fillStyle='#233';g.fillRect(0,0,2,64);g.fillRect(62,0,2,64);nz(g,500,.2)});
const term=on=>mk(64,64,g=>{g.fillStyle='#22282b';g.fillRect(0,0,64,64);g.fillStyle='#050a07';g.fillRect(8,8,48,30);g.fillStyle=on?'#0f6':'#0a3';g.font='6px monospace';['> VERROUILLAGE','> '+(on?'DESACTIVE':'CARTE ?'),'> _'].forEach((t,i)=>g.fillText(t,11,18+i*8));blob(g,32,22,30,on?'0,255,100':'0,160,60',.35);g.fillStyle='#111';g.fillRect(10,44,44,10);g.fillStyle='#3af';g.fillRect(48,46,5,5);nz(g,500,.2)});
T[10]=term(false);T[12]=term(true);
T[11]=mk(64,64,g=>{g.fillStyle='#3f4d4b';g.fillRect(0,0,64,64);g.fillStyle='#2f3b39';g.fillRect(4,3,56,58);g.fillStyle='#1a2220';for(let i=0;i<6;i++)g.fillRect(14,8+i*3.2,36,1.6);g.fillStyle='#aab';g.fillRect(50,32,3,10);g.fillStyle='rgba(110,30,10,.45)';g.fillRect(20,46,10,16);blob(g,12,50,14,'70,40,20',.4);nz(g,700,.22)});
T[13]=mk(64,64,g=>{g.fillStyle='#454a48';g.fillRect(0,0,64,64);g.fillStyle='#0b1215';g.fillRect(6,8,52,40);let q=g.createLinearGradient(6,8,58,48);q.addColorStop(0,'rgba(120,170,170,.25)');q.addColorStop(.5,'rgba(0,0,0,0)');q.addColorStop(1,'rgba(120,170,170,.12)');g.fillStyle=q;g.fillRect(6,8,52,40);
g.strokeStyle='rgba(220,240,240,.8)';g.lineWidth=1;const hx=26,hy=24;for(let i=0;i<14;i++){const a=i/14*TAU+R()*.3,l=10+R()*26;g.beginPath();g.moveTo(hx,hy);let x=hx,y=hy;for(let k=0;k<3;k++){x+=Math.cos(a+R()*.4)*l/3;y+=Math.sin(a+R()*.4)*l/3;g.lineTo(x,y)}g.stroke()}
g.fillStyle='#02060a';g.beginPath();g.moveTo(hx-5,hy-3);g.lineTo(hx+2,hy-6);g.lineTo(hx+6,hy+1);g.lineTo(hx+1,hy+6);g.lineTo(hx-6,hy+3);g.fill();g.beginPath();g.moveTo(40,8);g.lineTo(58,8);g.lineTo(58,30);g.lineTo(50,22);g.lineTo(46,12);g.fill();
g.fillStyle='rgba(200,230,230,.7)';for(let i=0;i<14;i++){g.beginPath();const x=8+R()*48;g.moveTo(x,48);g.lineTo(x+2+R()*3,48-3-R()*5);g.lineTo(x+4+R()*3,48);g.fill()}
g.fillStyle='#2e3331';g.fillRect(4,6,56,3);g.fillRect(4,48,56,5);g.fillRect(4,6,3,47);g.fillRect(57,6,3,47);blob(g,50,20,10,'110,0,0',.6);for(let i=0;i<4;i++)drip(g,44+i*4,18+R()*5,8+R()*20,'#6a0000');
g.fillStyle='rgba(120,0,0,.7)';g.fillRect(14,30,6,8);for(let i=0;i<4;i++)g.fillRect(13+i*2,26,1,5);nz(g,500,.2)});
T[14]=mk(64,64,g=>{g.fillStyle='#3a403d';g.fillRect(0,0,64,64);g.fillStyle='#1c2220';g.fillRect(10,2,44,8);g.fillRect(10,54,44,8);let q=g.createLinearGradient(14,0,50,0);q.addColorStop(0,'#0c2a18');q.addColorStop(.35,'#2f8a4a');q.addColorStop(.6,'#1d6a36');q.addColorStop(1,'#07180e');g.fillStyle=q;g.fillRect(14,10,36,44);g.fillStyle='#0a1210';g.fillRect(14,10,36,16);
g.fillStyle='rgba(180,255,200,.5)';for(let i=0;i<10;i++){g.beginPath();g.arc(18+R()*28,28+R()*24,1+R()*1.6,0,TAU);g.fill()}
g.fillStyle='rgba(5,10,6,.85)';g.beginPath();g.ellipse(32,36,6,12,.2,0,TAU);g.fill();g.fillRect(22,30,3,18);g.fillRect(39,28,3,20);g.beginPath();g.arc(33,22,5,0,TAU);g.fill();g.fillStyle='#b9c4a8';g.fillRect(16,40,5,6);for(let i=0;i<4;i++)g.fillRect(15+i*1.6,36,1,5);
g.strokeStyle='rgba(230,255,240,.8)';g.beginPath();g.moveTo(40,10);g.lineTo(34,30);g.lineTo(42,46);g.moveTo(34,30);g.lineTo(22,26);g.stroke();g.fillStyle='#03080a';g.beginPath();g.moveTo(38,10);g.lineTo(48,10);g.lineTo(44,24);g.lineTo(37,18);g.fill();for(let i=0;i<4;i++)drip(g,38+i*3,24,20+R()*14,'rgba(60,200,100,.7)');blob(g,32,60,16,'40,200,90',.5);nz(g,500,.2);blob(g,32,32,34,'30,180,80',.18)});
T[15]=mk(64,64,g=>{g.fillStyle='#4d504b';g.fillRect(0,0,64,64);nz(g,800,.2);g.fillStyle='#d6b200';g.fillRect(14,6,36,36);g.fillStyle='#111';g.fillRect(16,8,32,32);g.fillStyle='#d6b200';g.fillRect(17,9,30,30);g.strokeStyle='#111';g.lineWidth=3;for(let i=0;i<3;i++){g.beginPath();g.arc(32+Math.cos(i*2.09-1.57)*7,24+Math.sin(i*2.09-1.57)*7,6,0,TAU);g.stroke()}g.beginPath();g.arc(32,24,2,0,TAU);g.stroke();
g.fillStyle='#111';g.font='bold 6px monospace';g.fillText('BIOHAZARD',14,50);g.fillStyle='#8a0';g.fillRect(8,56,48,4);blob(g,44,36,12,'100,0,0',.7);for(let i=0;i<3;i++)drip(g,40+i*5,30,10+R()*20,'#700');g.strokeStyle='rgba(0,0,0,.6)';g.beginPath();g.moveTo(10,0);g.lineTo(18,14);g.lineTo(12,30);g.stroke()});
T[16]=mk(64,64,g=>{g.fillStyle='#3d403c';g.fillRect(0,0,64,64);nz(g,1100,.2);blob(g,32,10,30,'10,10,10',.6);g.strokeStyle='rgba(110,0,0,.85)';g.lineWidth=5;g.lineCap='round';g.beginPath();g.moveTo(14,6);g.bezierCurveTo(22,24,10,40,30,60);g.stroke();g.lineWidth=3;g.beginPath();g.moveTo(46,2);g.bezierCurveTo(40,20,52,36,44,58);g.stroke();
g.fillStyle='rgba(130,0,0,.85)';for(let k=0;k<2;k++){const x=22+k*20,y=20+k*10;g.fillRect(x,y,7,8);for(let i=0;i<4;i++)g.fillRect(x+i*2,y-5,1.4,6);g.fillRect(x-3,y+2,3,2)}for(let i=0;i<5;i++)drip(g,10+i*11,0,12+R()*30,'#600');g.fillStyle='rgba(0,0,0,.5)';g.fillRect(0,56,64,8)});
T[17]=mk(64,64,g=>{g.fillStyle='#8e9a95';g.fillRect(0,0,64,64);g.fillStyle='#4a5450';for(let i=0;i<64;i+=16){g.fillRect(i,0,1,64);g.fillRect(0,i,64,1)}nz(g,1000,.16);blob(g,10,56,20,'40,45,30',.55);blob(g,52,12,14,'60,40,20',.4);g.fillStyle='#2a2e2c';g.fillRect(33,17,14,14);g.strokeStyle='rgba(0,0,0,.6)';g.beginPath();g.moveTo(2,34);g.lineTo(14,44);g.lineTo(10,62);g.stroke();for(let i=0;i<3;i++)drip(g,6+i*20,0,10+R()*22,'rgba(70,50,20,.5)');g.fillStyle='rgba(0,0,0,.25)';g.fillRect(0,48,64,16)});
T[7]=mk(64,64,g=>{g.fillStyle='#55646a';g.fillRect(0,0,64,64);g.fillStyle='#8a9ca1';g.fillRect(0,0,64,16);g.fillStyle='#2b363a';g.fillRect(0,16,64,2);g.fillStyle='rgba(150,255,210,.5)';g.fillRect(6,4,7,11);g.fillRect(20,6,6,9);g.fillStyle='rgba(255,120,60,.5)';g.fillRect(34,5,7,10);g.fillStyle='#02080a';g.beginPath();g.moveTo(34,5);g.lineTo(38,9);g.lineTo(41,5);g.fill();
g.fillStyle='rgba(190,240,240,.7)';for(let i=0;i<10;i++)g.fillRect(44+R()*18,12+R()*3,1+R()*2,1);g.fillStyle='rgba(60,200,100,.55)';g.fillRect(14,15,22,2);for(let i=0;i<3;i++)drip(g,16+i*8,16,8+R()*16,'rgba(60,200,100,.5)');
g.fillStyle='#2f3b3f';for(let i=0;i<2;i++){g.fillRect(4,22+i*20,56,16);g.fillStyle='#9ab';g.fillRect(26,28+i*20,12,2);g.fillStyle='#2f3b3f'}g.fillStyle='#111';g.fillRect(42,24,10,12);g.fillStyle='#f30';g.fillRect(45,26,2,2);blob(g,40,52,12,'100,0,0',.55);nz(g,700,.22)});
const px4=c=>c.getContext('2d').getImageData(0,0,64,64).data;
const FD=px4(mk(64,64,g=>{g.fillStyle='#5b625d';g.fillRect(0,0,64,64);g.fillStyle='#2e3331';g.fillRect(0,0,64,1);g.fillRect(0,0,1,64);g.fillRect(0,32,64,1);g.fillRect(32,0,1,64);nz(g,1500,.2);blob(g,20,40,16,'40,25,10',.5);blob(g,50,14,10,'90,0,0',.5)}));
const CD=px4(mk(64,64,g=>{g.fillStyle='#3a3d3b';g.fillRect(0,0,64,64);g.fillStyle='#222';g.fillRect(0,0,64,2);g.fillRect(0,0,2,64);nz(g,800,.2);g.fillStyle='#d8e6e0';g.fillRect(14,24,36,16)}));
const FV=[FD,
px4(mk(64,64,g=>{g.fillStyle='#4e544f';g.fillRect(0,0,64,64);g.fillStyle='#262b29';g.fillRect(0,0,64,1);g.fillRect(0,0,1,64);g.fillRect(0,32,64,1);g.fillRect(32,0,1,64);nz(g,1500,.22);blob(g,18,24,22,'60,45,20',.6);blob(g,46,46,16,'35,40,25',.6);for(let i=0;i<6;i++){g.fillStyle='rgba(40,25,10,.6)';g.fillRect(8+i*3,36+(i%2)*4,2,4)}})),
px4(mk(64,64,g=>{g.fillStyle='#4a504b';g.fillRect(0,0,64,64);g.fillStyle='#262b29';g.fillRect(0,0,64,1);g.fillRect(0,0,1,64);nz(g,1200,.2);blob(g,32,32,30,'90,0,0',.95);blob(g,30,30,14,'60,0,0',.9);g.strokeStyle='rgba(95,0,0,.9)';g.lineWidth=3;g.beginPath();g.moveTo(32,32);g.lineTo(60,10);g.moveTo(32,32);g.lineTo(2,58);g.stroke()})),
px4(mk(64,64,g=>{g.fillStyle='#4f5651';g.fillRect(0,0,64,64);g.fillStyle='#262b29';g.fillRect(0,0,64,1);g.fillRect(0,0,1,64);nz(g,1200,.2);blob(g,34,30,22,'40,210,100',.55);for(let i=0;i<40;i++){g.fillStyle=R()<.5?'rgba(230,250,250,.85)':'rgba(120,200,210,.7)';g.beginPath();const x=R()*64,y=R()*64;g.moveTo(x,y);g.lineTo(x+1+R()*3,y+R()*2);g.lineTo(x+R()*2,y+1+R()*3);g.fill()}})),
px4(mk(64,64,g=>{g.fillStyle='#464b47';g.fillRect(0,0,64,64);g.fillStyle='#262b29';g.fillRect(0,0,64,1);g.fillRect(0,0,1,64);nz(g,1200,.22);blob(g,40,22,18,'5,5,5',.85);for(let i=0;i<7;i++){g.save();g.translate(R()*60,R()*60);g.rotate(R()*3);g.fillStyle=R()<.3?'#c9c4a8':'#d9d9cf';g.fillRect(0,0,9,12);g.fillStyle='rgba(0,0,0,.35)';g.fillRect(1,2,6,1);g.fillRect(1,5,5,1);g.restore()}}))];
const CV=[CD,
px4(mk(64,64,g=>{g.fillStyle='#34373a';g.fillRect(0,0,64,64);g.fillStyle='#1c1e1f';g.fillRect(0,0,64,2);g.fillRect(0,0,2,64);nz(g,900,.22);blob(g,32,32,28,'50,40,20',.6)})),
px4(mk(64,64,g=>{g.fillStyle='#34373a';g.fillRect(0,0,64,64);g.fillStyle='#010202';g.fillRect(8,8,48,48);g.strokeStyle='#222';g.lineWidth=2;for(let i=0;i<5;i++){g.beginPath();g.moveTo(10+i*10,8);g.lineTo(8+i*12+R()*6,40+R()*14);g.stroke()}g.fillStyle='#b00';g.fillRect(30,34,2,2);g.fillStyle='#223';g.fillRect(0,0,64,2);g.fillRect(0,0,2,64);nz(g,700,.2)}))];
const fv=(x,y)=>[0,0,1,1,3,4,2,0][((x*7+y*13+x*y)%8+8)%8];
const cf=(x,y)=>{const h=((x*5+y*11+x*y)%6+6)%6;return h===1?1:h===4?2:0};
const wallTex=(c,x,y)=>{if(c==='#'){const v=(x*7+y*13+x*y)%11;return T[[13,14,15,16,17,17,0,0,1,2,3][v]]}return c==='T'?T[7]:c==='G'?(power?T[8]:T[6]):c==='P'?T[4]:c==='S'?T[9]:c==='M'?(stage>=4?T[12]:T[10]):c==='L'?T[11]:T[5]};

// ---------- SPRITES ----------
const S={};
S.cr=[0,1,2,3].map(f=>mk(96,192,g=>{
const a=Math.sin(f*Math.PI/2),c=Math.cos(f*Math.PI/2),sw=a*6,hx=48+c*1.5;
const skin=(x0,y0,x1,y1)=>{const q=g.createLinearGradient(x0,y0,x1,y1);q.addColorStop(0,'#a9ad9c');q.addColorStop(.5,'#74786a');q.addColorStop(1,'#3b3e36');return q};
g.lineCap='round';g.lineJoin='round';
const leg=(x,ph)=>{g.strokeStyle=skin(x-8,100,x+8,190);g.lineWidth=7;g.beginPath();g.moveTo(x,104);g.lineTo(x+ph*5-6,146);g.lineTo(x+ph*9,186);g.stroke();g.lineWidth=2;g.strokeStyle='#2a2c27';g.beginPath();g.moveTo(x+ph*9,186);g.lineTo(x+ph*9-6,190);g.moveTo(x+ph*9,186);g.lineTo(x+ph*9+7,190);g.stroke()};
leg(40,-a);leg(58,a);
let q=g.createLinearGradient(30,50,66,110);q.addColorStop(0,'#8c9080');q.addColorStop(1,'#34372f');g.fillStyle=q;g.beginPath();g.moveTo(32,52);g.quadraticCurveTo(48,44,66,54);g.lineTo(62,108);g.quadraticCurveTo(48,114,36,108);g.fill();
g.lineWidth=1.5;for(let i=0;i<7;i++){g.strokeStyle='rgba(20,22,18,.8)';g.beginPath();g.moveTo(36,62+i*6);g.quadraticCurveTo(48,66+i*6,62,62+i*6);g.stroke();g.strokeStyle='rgba(200,205,185,.35)';g.beginPath();g.moveTo(37,61+i*6);g.quadraticCurveTo(48,65+i*6,61,61+i*6);g.stroke()}
g.fillStyle='#5a5d50';for(let i=0;i<6;i++){g.beginPath();g.arc(66,58+i*9,2.2,0,TAU);g.fill()}
const tm=g.createRadialGradient(64,70,1,64,72,12);tm.addColorStop(0,'#a35a52');tm.addColorStop(1,'#4a1f1c');g.fillStyle=tm;g.beginPath();g.ellipse(64,72,9,11,.3,0,TAU);g.fill();
g.fillStyle='#6d1111';g.beginPath();g.ellipse(44,84,6,9,.2,0,TAU);g.fill();g.fillStyle='#2a0505';g.beginPath();g.ellipse(44,85,3,5,.2,0,TAU);g.fill();
g.fillStyle='rgba(190,190,176,.8)';g.beginPath();g.moveTo(30,98);g.lineTo(66,98);g.lineTo(70,126+a*3);g.lineTo(62,118);g.lineTo(58,138);g.lineTo(50,120);g.lineTo(44,142+c*3);g.lineTo(38,118);g.lineTo(28,130);g.fill();g.fillStyle='rgba(110,10,10,.65)';g.fillRect(40,100,10,14);
const arm=(x,y,dx,ph)=>{g.strokeStyle=skin(x,y,x+dx,y+90);g.lineWidth=5;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+dx*1.2,y+36,x+dx+ph*5,y+88);g.lineTo(x+dx+ph*8,y+112);g.stroke();g.lineWidth=1.6;g.strokeStyle='#d8d6c4';for(let i=0;i<4;i++){g.beginPath();g.moveTo(x+dx+ph*8,y+112);g.lineTo(x+dx+ph*8+(i-1.5)*4,y+130+i%2*4);g.stroke()}g.fillStyle='#6a0d0d';g.fillRect(x+dx+ph*8-2,y+108,5,5)};
arm(32,56,-18,a);arm(66,56,20,-a);
g.strokeStyle='rgba(210,220,210,.55)';g.lineWidth=1.5;g.beginPath();g.moveTo(34,60);g.quadraticCurveTo(24,90,28+sw,130);g.stroke();g.beginPath();g.moveTo(62,58);g.quadraticCurveTo(76,96,70-sw,140);g.stroke();g.fillStyle='rgba(150,30,30,.8)';g.fillRect(27+sw,126,3,8);
g.strokeStyle=skin(40,30,50,56);g.lineWidth=9;g.beginPath();g.moveTo(48,56);g.quadraticCurveTo(46,44,hx-2,34);g.stroke();
g.save();g.translate(hx,26);g.rotate(-.28+c*.04);
const hd=g.createRadialGradient(-2,-4,2,0,0,20);hd.addColorStop(0,'#b9bcab');hd.addColorStop(1,'#4a4d42');g.fillStyle=hd;g.beginPath();g.ellipse(0,0,11,17,0,0,TAU);g.fill();
g.strokeStyle='rgba(90,15,15,.8)';g.lineWidth=1;for(let i=0;i<6;i++){g.beginPath();g.moveTo(-8+i*3,-14);g.lineTo(-6+i*3+R()*4,-4+R()*6);g.stroke()}
g.fillStyle='#050505';g.beginPath();g.ellipse(-5,-3,4,6,.2,0,TAU);g.fill();g.beginPath();g.ellipse(5,-3,4,6,-.2,0,TAU);g.fill();g.fillStyle='#e8f0e0';g.beginPath();g.arc(-5,-2,1.6,0,TAU);g.fill();g.beginPath();g.arc(5,-2,1.6,0,TAU);g.fill();
g.fillStyle='#1a0a0a';g.fillRect(-1,3,2,4);g.fillStyle='#120505';g.beginPath();g.moveTo(-8,8);g.quadraticCurveTo(0,34+a*3,8,8);g.fill();
g.fillStyle='#e0dcc0';for(let i=0;i<7;i++){g.beginPath();g.moveTo(-7+i*2.4,9);g.lineTo(-6+i*2.4,15+(i%2)*3);g.lineTo(-5+i*2.4,9);g.fill()}for(let i=0;i<5;i++){g.beginPath();g.moveTo(-5+i*2.6,29+a*2);g.lineTo(-4+i*2.6,23+a*2);g.lineTo(-3+i*2.6,29+a*2);g.fill()}
g.strokeStyle='rgba(180,200,170,.5)';g.lineWidth=1;g.beginPath();g.moveTo(-3,20);g.lineTo(-4,34);g.moveTo(3,20);g.lineTo(4,36);g.stroke();g.restore()}));
const ic=(col,f)=>mk(32,32,g=>{blob(g,16,16,16,col,.55);f(g)});
S.fuse=ic('255,200,60',g=>{g.fillStyle='#ddc';g.fillRect(11,12,10,12);g.fillStyle='#fc4';g.fillRect(13,14,6,8);g.fillStyle='#777';g.fillRect(10,10,12,3);g.fillRect(10,23,12,3)});
S.card=ic('60,160,255',g=>{g.fillStyle='#2a6fd6';g.fillRect(7,10,18,12);g.fillStyle='#ddd';g.fillRect(9,12,5,4);g.fillStyle='#012';g.fillRect(7,19,18,2)});
S.bat=ic('80,255,120',g=>{g.fillStyle='#3c3';g.fillRect(10,8,12,16);g.fillStyle='#ccc';g.fillRect(13,5,6,3);g.fillStyle='#030';g.fillRect(10,14,12,3)});
S.vial=ic('190,90,255',g=>{g.fillStyle='#c8f';g.fillRect(13,10,6,14);g.fillStyle='#5f8';g.fillRect(13,17,6,7);g.fillStyle='#999';g.fillRect(12,8,8,3)});
S.note=ic('255,255,220',g=>{g.fillStyle='#e8e2c8';g.fillRect(9,7,14,18);g.fillStyle='#555';for(let i=0;i<5;i++)g.fillRect(11,10+i*3,10,1)});

S.body=mk(96,32,g=>{blob(g,48,26,40,'80,0,0',.6);g.fillStyle='#cfcfc4';g.beginPath();g.moveTo(20,12);g.lineTo(62,10);g.lineTo(64,24);g.lineTo(22,26);g.fill();g.fillStyle='#a8a89c';g.fillRect(30,12,2,13);g.fillStyle='#7a0000';g.beginPath();g.arc(44,18,8,0,TAU);g.fill();g.fillStyle='#d6b9a0';g.beginPath();g.ellipse(14,17,7,6,0,0,TAU);g.fill();g.fillStyle='#2a1a10';g.beginPath();g.ellipse(11,16,5,5,0,0,TAU);g.fill();g.fillStyle='#223';g.fillRect(64,12,22,5);g.fillRect(66,19,24,5);g.fillStyle='#111';g.fillRect(86,11,6,6);g.fillRect(90,19,6,6);g.strokeStyle='#d6b9a0';g.lineWidth=3;g.beginPath();g.moveTo(40,10);g.lineTo(34,3);g.lineTo(22,4);g.stroke()});
S.gurney=mk(80,40,g=>{g.fillStyle='#8a9096';g.fillRect(6,14,68,5);g.fillStyle='#d8d4c4';g.fillRect(10,8,60,7);g.fillStyle='#7a0000';g.fillRect(30,9,16,5);g.fillStyle='#555';g.fillRect(12,19,3,16);g.fillRect(64,19,3,16);g.fillStyle='#111';[[13,36],[65,36]].forEach(([x,y])=>{g.beginPath();g.arc(x,y,4,0,TAU);g.fill()});g.strokeStyle='#4a3a2a';g.lineWidth=2;g.beginPath();g.moveTo(22,8);g.lineTo(18,22);g.moveTo(52,8);g.quadraticCurveTo(54,26,48,34);g.stroke()});
S.tube=mk(48,96,g=>{blob(g,24,90,26,'40,200,90',.5);g.fillStyle='#1c2220';g.fillRect(4,0,40,6);g.fillRect(4,88,40,8);const q=g.createLinearGradient(8,0,40,0);q.addColorStop(0,'rgba(10,40,25,.9)');q.addColorStop(.4,'rgba(50,150,80,.8)');q.addColorStop(1,'rgba(8,24,14,.9)');g.fillStyle=q;g.fillRect(8,6,32,82);g.fillStyle='rgba(5,10,6,.9)';g.beginPath();g.ellipse(24,56,6,18,0,0,TAU);g.fill();g.beginPath();g.arc(24,34,6,0,TAU);g.fill();g.fillRect(14,44,3,22);g.fillRect(31,44,3,22);
g.fillStyle='#02060a';g.beginPath();g.moveTo(18,6);g.lineTo(34,6);g.lineTo(30,30);g.lineTo(21,20);g.fill();g.strokeStyle='rgba(230,255,240,.8)';g.beginPath();g.moveTo(30,30);g.lineTo(24,60);g.lineTo(34,84);g.stroke();for(let i=0;i<3;i++){g.fillStyle='rgba(60,200,100,.6)';g.fillRect(26+i*4,30,2,50)}g.fillStyle='rgba(200,240,240,.8)';for(let i=0;i<10;i++)g.fillRect(2+R()*44,88+R()*6,2,1)});
S.barrel=mk(40,56,g=>{blob(g,20,52,22,'40,200,90',.4);g.fillStyle='#3d5a33';g.fillRect(6,4,28,48);g.fillStyle='#2b4024';g.fillRect(6,16,28,3);g.fillRect(6,36,28,3);g.fillStyle='#d6b200';g.fillRect(14,22,12,12);g.fillStyle='#111';g.font='bold 9px monospace';g.fillText('!',18,32);g.fillStyle='rgba(60,200,100,.7)';g.fillRect(24,26,2,26);g.fillRect(12,30,2,22)});
S.cable=mk(32,64,g=>{g.strokeStyle='#111';g.lineWidth=2;for(let i=0;i<3;i++){g.beginPath();g.moveTo(8+i*7,0);g.quadraticCurveTo(6+i*9,24,10+i*6,44+i*4);g.stroke()}g.fillStyle='#b80';for(let i=0;i<3;i++)g.fillRect(9+i*6,44+i*4,3,3);blob(g,16,50,14,'255,200,80',.6)});
S.paper=mk(32,14,g=>{for(let i=0;i<5;i++){g.save();g.translate(4+i*5,3+R()*5);g.rotate(R()-.5);g.fillStyle='#d9d9cf';g.fillRect(0,0,9,7);g.fillStyle='rgba(0,0,0,.4)';g.fillRect(1,2,6,1);g.restore()}});
const DS={body:[.22,0,0],gurney:[.38,0,0],tube:[.8,0,.3],barrel:[.35,0,.2],cable:[.45,.55,.5],paper:[.06,0,0]};
const decor=[
{t:'body',x:4.4,y:4.3},{t:'barrel',x:4.6,y:1.6},{t:'paper',x:1.7,y:3.4},
{t:'gurney',x:14.5,y:6.4},{t:'paper',x:8.5,y:7.2},{t:'body',x:10.4,y:6.7},
{t:'barrel',x:8.4,y:1.5},{t:'barrel',x:8.4,y:2.3},{t:'barrel',x:12.0,y:3.6},{t:'paper',x:8.5,y:3.8},
{t:'tube',x:18.5,y:1.6},{t:'tube',x:21.8,y:2.0},{t:'tube',x:17.2,y:4.2},{t:'body',x:19.6,y:4.3},{t:'paper',x:21.3,y:2.4},{t:'cable',x:18.6,y:2.6},
{t:'barrel',x:1.4,y:10.2},{t:'cable',x:5.3,y:10.4},{t:'body',x:2.4,y:12.5},{t:'paper',x:5.4,y:12.6},
{t:'gurney',x:9.4,y:10.2},{t:'gurney',x:12.2,y:12.5},{t:'body',x:13.4,y:10.4},{t:'paper',x:10.5,y:12.8},
{t:'tube',x:18.2,y:10.4},{t:'barrel',x:21.5,y:12.6},{t:'paper',x:17.4,y:12.5},{t:'body',x:20.5,y:9.8},
{t:'body',x:7.4,y:15.6},{t:'gurney',x:14.5,y:16.2},{t:'cable',x:10.5,y:15.6},{t:'paper',x:19.5,y:15.4},
{t:'cable',x:5.5,y:20.0},{t:'body',x:7.5,y:21.2},{t:'paper',x:3.0,y:20.6},
{t:'tube',x:11.4,y:18.6},{t:'tube',x:15.5,y:18.8},{t:'tube',x:17.5,y:20.8},{t:'body',x:13.4,y:20.6},{t:'gurney',x:16.6,y:21.0},{t:'barrel',x:21.6,y:18.6}];
// ---------- ÉTAT ----------
const NOTES=[
"Journal du Dr Vasseur. Le Sujet 7 ne dort plus. Il écoute à travers les murs. Ne courez jamais près de lui : il entend tout.",
"Fusible de secours dans la réserve nord. Le générateur est au sud-ouest. Quand le courant revient, la morgue s'ouvre. Ne la rouvrez pas.",
"La carte d'accès est dans le tiroir 4 de la morgue. Je l'entends marcher dans le couloir. Il sait que je suis là. Il sait.",
"Terminal de verrouillage : salle des serveurs, au sud. Il faut une carte d'accès. Mais l'activer déclenchera l'alarme, et il se réveillera. Tout le labo se réveillera.",
"Échantillon 7-B, l'antidote. Je l'ai caché dans la salle des serveurs, derrière les racks. Si vous lisez ceci : emportez-le dehors. Le monde doit savoir."];
const OBJ=["Trouver un fusible de secours","Remettre le courant (générateur)","Récupérer la carte d'accès (morgue)","Lever le verrouillage (terminal, salle des serveurs, au sud)","S'ÉCHAPPER PAR LA SORTIE !"];
const items=[{x:11.5,y:1.5,t:'fuse'},{x:13.5,y:13.5,t:'card'},{x:15.5,y:1.5,t:'bat'},{x:5.5,y:13.5,t:'bat'},{x:21.5,y:4.5,t:'note',n:0},{x:9.5,y:12.5,t:'note',n:2},{x:1.5,y:13.5,t:'note',n:1},{x:1.5,y:15.5,t:'bat'},{x:21.5,y:20.5,t:'bat'},{x:4.5,y:19.5,t:'note',n:3},{x:21.5,y:21.5,t:'note',n:4},{x:1.5,y:21.5,t:'vial'}];
const P={x:2.5,y:2.5,a:Math.PI/2,st:1,bat:100,fl:false,hid:false,hidT:0,seen:false,run:false,canRun:true,bob:0,stepT:0};
const C={x:16.5,y:19.5,st:'patrol',path:[],lx:0,ly:0,lost:0,sT:0,pt:0,anim:0,stepT:0,sense:0};
let splat=[],crunched=false,scr=false,hasVial=false,introT=0,flash=0,introEv=null,eoV=0,blurPx=0;
let state='title',power=false,hasFuse=false,hasCard=false,stage=0,aggr=0,alarm=false,blackout=0,fkT=0,lightF=1,nextAmb=9,fear=0,pulse=0,hbT=0,time=0,deadT=0,endT=0,bobY=0,moving=false,started=false,over=false;
let AMB=.2,LAMP=0,FLON=true,RNG=10,msgS='',msgT=0,noteS='',noteT=0,tasks=[],alive=true,lastF=performance.now(),raf=0,prev=0,rd=0;
const keys={},zb=new Float32Array(BW);
const say=(s,d=4.5)=>{msgS=s;msgT=d};const after=(s,f)=>tasks.push([s,f]);

// ---------- AUDIO PROCÉDURAL ----------
let AC,mg,nb,fearG,voiceG,voiceP,sirenG;
function aInit(){if(AC)return;try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){return}
mg=AC.createGain();mg.gain.value=.85;mg.connect(AC.destination);
nb=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate);const d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=R()*2-1;
const osc=(t,f,o,v)=>{const s=AC.createOscillator(),g=AC.createGain();s.type=t;s.frequency.value=f;g.gain.value=v;s.connect(g);g.connect(o);s.start();return s};
const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=140;lp.connect(mg);
osc('sawtooth',41,lp,.1);osc('sawtooth',41.8,lp,.08);osc('sine',55,mg,.07);
const vs=AC.createBufferSource();vs.buffer=nb;vs.loop=true;const vf=AC.createBiquadFilter();vf.type='bandpass';vf.frequency.value=260;vf.Q.value=.6;const vg=AC.createGain();vg.gain.value=.05;vs.connect(vf);vf.connect(vg);vg.connect(mg);vs.start();
fearG=AC.createGain();fearG.gain.value=0;fearG.connect(mg);osc('sine',440,fearG,.5);osc('sine',466,fearG,.5);osc('sine',1397,fearG,.2);
voiceG=AC.createGain();voiceG.gain.value=0;voiceP=AC.createStereoPanner?AC.createStereoPanner():null;
const vo=AC.createOscillator();vo.type='sawtooth';vo.frequency.value=64;const lf=AC.createOscillator();lf.frequency.value=7;const lg=AC.createGain();lg.gain.value=18;lf.connect(lg);lg.connect(vo.frequency);lf.start();
const vl=AC.createBiquadFilter();vl.type='lowpass';vl.frequency.value=420;vo.connect(vl);vl.connect(voiceG);if(voiceP){voiceG.connect(voiceP);voiceP.connect(mg)}else voiceG.connect(mg);vo.start();
sirenG=AC.createGain();sirenG.gain.value=0;const so=AC.createOscillator();so.type='square';so.frequency.value=700;const sl=AC.createOscillator();sl.frequency.value=1.1;const sg=AC.createGain();sg.gain.value=180;sl.connect(sg);sg.connect(so.frequency);const sf=AC.createBiquadFilter();sf.type='lowpass';sf.frequency.value=1400;so.connect(sf);sf.connect(sirenG);sirenG.connect(mg);so.start();sl.start()}
const out=p=>{if(p&&AC.createStereoPanner){const n=AC.createStereoPanner();n.pan.value=clamp(p,-1,1);n.connect(mg);return n}return mg};
const burst=(dur,type,f,q,v,pan,dl=0)=>{if(!AC)return;const t=AC.currentTime+dl,s=AC.createBufferSource();s.buffer=nb;const fi=AC.createBiquadFilter();fi.type=type;fi.frequency.value=f;fi.Q.value=q;const g=AC.createGain();g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0008,t+dur);s.connect(fi);fi.connect(g);g.connect(out(pan));s.start(t,R(),dur+.05)};
const tone=(type,f1,f2,dur,v,pan,dl=0)=>{if(!AC)return;const t=AC.currentTime+dl,o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f1,t);o.frequency.exponentialRampToValueAtTime(f2,t+dur);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0008,t+dur);o.connect(g);g.connect(out(pan));o.start(t);o.stop(t+dur+.05)};
const rp=()=>R()*2-1;
const sfx={
step:(r,pan,v=1)=>burst(r?.09:.13,'lowpass',r?700:450,.8,.22*v,pan),
cstep:(v,pan)=>{burst(.35,'bandpass',1800,6,.12*v,pan,.1);burst(.2,'lowpass',250,1,.6*v,pan);tone('sine',90,45,.16,.6*v,pan)},
heart:v=>{tone('sine',70,35,.16,v);tone('sine',140,60,.1,v*.4);tone('sine',60,30,.2,v*.7,0,.19)},
clang:()=>{const p=rp();burst(1.6,'bandpass',700+R()*900,25,.5,p);tone('triangle',380+R()*300,200,.8,.05,p)},
whisper:()=>{const p=rp();for(let i=0;i<4;i++)burst(.25,'bandpass',2000+R()*1500,7,.13,p,i*.28)},
drip:()=>{const p=rp();for(let i=0;i<3;i++)tone('sine',1500,900,.08,.12,p,i*.5)},
slam:()=>{const p=rp();burst(.6,'lowpass',180,1,.9,p);tone('sine',90,35,.4,.6,p)},
scratch:()=>{const p=rp();for(let i=0;i<9;i++)burst(.06,'highpass',3500,1,.1,p,i*.07)},
roar:p=>{tone('sawtooth',160,45,1.3,.4,p);tone('sawtooth',172,50,1.3,.3,p);tone('square',420,90,1,.12,p);burst(1.2,'bandpass',900,2,.5,p);burst(1.4,'lowpass',220,1,.6,p);tone('sawtooth',1100,300,.5,.08,p,.1)},
screech:()=>{tone('sawtooth',500,2600,1.1,.5);tone('square',620,3100,1.1,.25);burst(1.2,'bandpass',3000,.7,.6);tone('sine',60,30,1,.9)},
boom:()=>{burst(1.4,'lowpass',160,1,1);tone('sine',70,25,1.2,.9);tone('sawtooth',900,60,.7,.2)},
pick:()=>tone('triangle',500,900,.15,.15),breath:()=>burst(.55,'bandpass',500,.8,.09),groan:()=>{tone('sawtooth',120,65,.9,.1);burst(.9,'lowpass',300,1,.12)},locker:()=>{burst(.25,'bandpass',1200,10,.2);tone('square',200,120,.12,.06)},click:()=>tone('square',1800,900,.03,.12),glass:()=>burst(.18,'highpass',3500,1,.25),tinkle:()=>{const p=rp();for(let i=0;i<6;i++)tone('sine',2500+R()*2500,1800,.15,.1,p,i*.07)},spark:()=>{const p=rp();for(let i=0;i<5;i++)burst(.05,'highpass',4000,1,.2,p,i*.05);tone('sawtooth',90,60,.3,.1,p)},crunch:()=>{burst(.12,'bandpass',300,3,1);tone('sine',120,30,.4,.9);burst(.5,'lowpass',200,1,.8,0,.05)},
buzz:()=>burst(.25,'bandpass',120,3,.25),
gen:()=>{tone('sawtooth',30,95,2.6,.35);burst(1.2,'lowpass',200,1,.7);tone('sine',60,200,2.5,.3)},
door:()=>{tone('sawtooth',90,70,1.6,.12);burst(1.6,'bandpass',900,12,.1)}};
const ambients=[sfx.clang,sfx.whisper,sfx.drip,sfx.slam,sfx.scratch,sfx.tinkle,sfx.spark];

// ---------- ACTIONS ----------
const wake=()=>{C.st='search';C.lx=P.x;C.ly=P.y;C.path=bfs(C.x,C.y,P.x,P.y);C.sT=6};
function target(){if(P.hid)return{k:'locker',txt:"E : sortir du casier"};let best=null,bd=1.3;
for(const i of items){if(i.got)continue;const dx=i.x-P.x,dy=i.y-P.y,d=Math.hypot(dx,dy);if(d<bd&&(dx*Math.cos(P.a)+dy*Math.sin(P.a))/d>.45){best={k:'item',i,txt:i.t==='note'?"E : lire la note":"E : ramasser"};bd=d}}
if(best)return best;
const cx=fl(P.x+Math.cos(P.a)),cy=fl(P.y+Math.sin(P.a)),c=(G[cy]||[])[cx];
if(c==='G')return{k:'gen',txt:power?"Générateur en marche":hasFuse?"E : insérer le fusible":"Il manque un fusible"};
if(c==='P')return{k:'x',txt:"Porte verrouillée : plus de courant"};
if(c==='M')return{k:'term',txt:stage>=4?"Verrouillage désactivé":hasCard?"E : utiliser la carte sur le terminal":"Terminal verrouillé : il faut une carte"};
if(c==='E')return{k:'exit',txt:stage>=4?"E : ouvrir la sortie":"Porte scellée : verrouillage actif"};
if(c==='L')return{k:'locker',cx,cy,txt:"E : se cacher dans le casier"};
return null}
function act(){if(state!=='play')return;if(P.hid){P.hid=false;sfx.locker();return}const t=target();if(!t)return;
if(t.k==='item'){const i=t.i;i.got=true;sfx.pick();
if(i.t==='note'){noteS=NOTES[i.n];noteT=9}
else if(i.t==='bat'){P.bat=Math.min(100,P.bat+50);say("Pile récupérée.",3)}
else if(i.t==='fuse'){hasFuse=true;stage=1;aggr=1;blackout=6;flash=1;sfx.boom();say("Les lumières viennent de s'éteindre... quelque chose a bougé.",6);wake()}
else if(i.t==='vial'){hasVial=true;say("Un échantillon : l'antidote du Dr Vasseur. Il faut l'emporter dehors.",6)}
else{hasCard=true;stage=3;say("Une carte d'accès. Le terminal de verrouillage doit être au sud...",6)}}
else if(t.k==='locker'){P.hid=true;P.hidT=0;P.seen=C.st==='chase'&&rd<8&&los(C.x,C.y,P.x,P.y);P.a=Math.atan2(t.cy+.5-P.y,t.cx+.5-P.x);sfx.locker();say("Ne bougez plus. Retenez votre souffle...",4)}
else if(t.k==='term'&&hasCard&&stage===3){stage=4;aggr=3;alarm=true;flash=1;sfx.boom();say("VERROUILLAGE LEVÉ... L'ALARME ! Il arrive ! COUREZ vers la sortie !",7);C.st='chase';C.lost=0;C.lx=P.x;C.ly=P.y}
else if(t.k==='gen'&&hasFuse&&!power){power=true;stage=2;aggr=2;sfx.gen();say("Le courant revient. Un verrou claque, au loin...",5);wake();after(1.8,()=>{G[8][11]='.';sfx.door();say("La porte de la morgue s'est ouverte.",4)})}
else if(t.k==='exit'&&stage>=4){state='win';endT=0;stage=5;sfx.door()}
if(scoreEl)scoreEl.textContent=stage}
const togFl=()=>{if(state==='play'&&P.bat>0)P.fl=!P.fl};
function die(){if(state!=='play')return;state='dead';deadT=0;P.hid=false;P.fl=true;P.bat=Math.max(P.bat,8);P.dieA=Math.atan2(C.y-P.y,C.x-P.x);fear=1;fkT=1.2;splat=Array.from({length:50},()=>({x:R(),y:R(),r:6+R()*40,t:R()*1.3}));crunched=false;scr=false;sfx.roar(0);sfx.heart(.9);if(document.exitPointerLock)document.exitPointerLock()}

// ---------- CRÉATURE ----------
function updC(dt){const dx=P.x-C.x,dy=P.y-C.y,d=Math.hypot(dx,dy),vis=!P.hid&&los(C.x,C.y,P.x,P.y),sight=6+aggr*2.5;rd=d;
const heard=!P.hid&&P.run&&moving&&d<5+aggr*2;
if(aggr>0&&((vis&&d<sight)||heard||(vis&&d<1.8))){if(C.st!=='chase')sfx.roar(clamp(Math.sin(Math.atan2(dy,dx)-P.a),-1,1));C.st='chase';C.lost=0;C.lx=P.x;C.ly=P.y}
else if(C.st==='chase'){C.lost+=dt;if(C.lost>3){C.st='search';C.sT=5;C.path=bfs(C.x,C.y,C.lx,C.ly)}}
C.pt-=dt;
if(C.st==='chase'&&C.pt<=0){C.path=bfs(C.x,C.y,P.x,P.y);C.pt=.25}
if(C.st==='search'&&!C.path.length){C.sT-=dt;if(C.sT<=0){C.st='patrol'}}
if(C.st==='patrol'){C.sense+=dt;if(aggr>=1&&!P.hid&&C.sense>18){C.sense=0;C.lx=P.x;C.ly=P.y;C.st='search';C.sT=5;C.path=bfs(C.x,C.y,P.x,P.y)}
else if(!C.path.length){for(let k=0;k<20;k++){const tx=1+R()*22|0,ty=1+R()*13|0;if(G[ty][tx]==='.'){C.path=bfs(C.x,C.y,tx+.5,ty+.5);break}}}}
const sp=C.st==='chase'?2.2+.35*aggr:C.st==='search'?1.5:.9+.2*aggr;
if(C.path.length){const[tx,ty]=C.path[0],ex=tx-C.x,ey=ty-C.y,dd=Math.hypot(ex,ey);if(dd<.1)C.path.shift();else{C.x+=ex/dd*sp*dt;C.y+=ey/dd*sp*dt;C.anim+=dt*(C.st==='chase'?9:3)}
C.stepT-=dt;if(C.stepT<=0&&d<12){C.stepT=C.st==='chase'?.34:.62;sfx.cstep(clamp(1-d/12,.05,1),clamp(Math.sin(Math.atan2(dy,dx)-P.a),-1,1))}}
if(P.hid){if(d<1.5){P.hidT+=dt;if(P.hidT>(P.seen?1.2:4.5))die()}else P.hidT=Math.max(0,P.hidT-dt)}else if(d<.7)die()}

// ---------- JOUEUR ----------
const tc={stick:null,look:null,run:null};
function updP(dt){if(P.hid){moving=false;P.run=false;bobY=0;P.st=Math.min(1,P.st+dt/5);return}let f=0,s=0,rot=0;
if(keys.KeyW||keys.ArrowUp)f++;if(keys.KeyS||keys.ArrowDown)f--;if(keys.KeyA)s--;if(keys.KeyD)s++;if(keys.ArrowLeft)rot--;if(keys.ArrowRight)rot++;
if(tc.stick){f-=tc.stick.dy;s+=tc.stick.dx}
f=clamp(f,-1,1);s=clamp(s,-1,1);P.a+=rot*2*dt;
const mv=Math.hypot(f,s);moving=mv>.1;
const wantRun=(keys.ShiftLeft||keys.ShiftRight||tc.run!==null||(tc.stick&&Math.hypot(tc.stick.dx,tc.stick.dy)>.95))&&moving&&P.canRun&&P.st>.02;
P.run=wantRun;const sp=P.run?3.9:2.3;
if(moving){const dx=Math.cos(P.a),dy=Math.sin(P.a),nx=P.x+(dx*f-dy*s)/mv*sp*dt*Math.min(1,mv),ny=P.y+(dy*f+dx*s)/mv*sp*dt*Math.min(1,mv);if(free(nx,P.y))P.x=nx;if(free(P.x,ny))P.y=ny;
P.bob+=dt*(P.run?12:7);P.stepT-=dt;if(P.stepT<=0){P.stepT=P.run?.3:.5;sfx.step(P.run,0);if(fv(fl(P.x),fl(P.y))===3)sfx.glass()}}
else P.bob*=.9;
bobY=Math.round(Math.sin(P.bob)*(P.run?2.5:1.3)*(moving?1:0));
if(P.run){P.st-=dt/4;if(P.st<=0)P.canRun=false}else{P.st=Math.min(1,P.st+dt/5);if(P.st>.35)P.canRun=true}
if(P.fl){P.bat-=dt*.55;if(P.bat<=0){P.bat=0;P.fl=false;say("La lampe est morte...",4)}}}

// ---------- BOUCLE DE MISE À JOUR ----------
const sm=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
function intro(dt){introT+=dt;const t=introT;
if(!introEv)introEv=[[0,()=>tone('sine',3200,3000,5,.02)],[.4,sfx.breath],[1.8,sfx.breath],[3.1,sfx.groan],[3.9,sfx.breath],[5.6,()=>sfx.step(false,-.2)],[6.3,()=>sfx.step(false,.2)],[7,()=>sfx.step(false,-.2)]].map(e=>({t:e[0],f:e[1]}));
for(const e of introEv)if(!e.d&&t>=e.t){e.d=1;e.f()}
hbT-=dt;if(hbT<=0&&t<6){sfx.heart(.3);pulse=1;hbT=1.1}
eoV=t<1.5?0:t<3?.55*sm((t-1.5)/1.5):t<3.3?.55*(1-sm((t-3)/.3)):t<3.6?0:t<4.6?.9*sm(t-3.6):t<5?.9:t<5.2?.9*(1-sm((t-5)/.2)):t<5.4?0:t<5.8?sm((t-5.4)/.4):1;
blurPx=clamp(8*(1-t/7.5),0,8);
const hg=t<3.6?.42:t<5.4?.42-.22*sm((t-3.6)/1.8):.2*(1-sm((t-5.4)/2.1));
bobY=Math.round(hg*BH+Math.sin(t*2.2)*(t<7?2:0));
P.a=Math.PI/2+.9*(1-sm((t-3.5)/3.5))*Math.cos(t*.8);
if(t>=7.5){state='play';P.fl=true;bobY=0;sfx.click();say("Où suis-je ?... Il faut sortir d'ici.",6);hbT=0}}
function update(dt){time+=dt;if(state==='intro')intro(dt);
if(state==='play'){updP(dt);updC(dt);
for(let i=tasks.length-1;i>=0;i--){tasks[i][0]-=dt;if(tasks[i][0]<=0){const f=tasks[i][1];tasks.splice(i,1);f()}}
if(blackout>0)blackout-=dt;
nextAmb-=dt;if(nextAmb<=0){ambients[R()*ambients.length|0]();nextAmb=(7+R()*12)/(1+aggr*.4)}
const d=rd,chase=C.st==='chase';const tf=Math.max(chase?.65:0,clamp(1-d/10,0,1));fear+=(tf-fear)*Math.min(1,dt*2);
if(P.hid&&R()<dt*.4)sfx.breath();
hbT-=dt;if(hbT<=0&&fear>.12){sfx.heart(.15+fear*.7);pulse=1;hbT=1.05-fear*.7}
if(AC){const t=AC.currentTime;fearG.gain.setTargetAtTime(fear*.05,t,.2);const vv=Math.pow(clamp(1-d/14,0,1),1.5)*(chase?.5:.12);voiceG.gain.setTargetAtTime(vv,t,.1);if(voiceP)voiceP.pan.value=clamp(Math.sin(Math.atan2(C.y-P.y,C.x-P.x)-P.a),-1,1);sirenG.gain.setTargetAtTime(alarm?.07:0,t,.2)}}
pulse=Math.max(0,pulse-dt*3);flash=Math.max(0,flash-dt*1.5);
if(msgT>0)msgT-=dt;if(noteT>0)noteT-=dt;
// lumières
if(fkT>0){fkT-=dt;lightF=R()<.5?.15:1}else{lightF=1;if((state==='play'||state==='intro')&&R()<dt*(power?.35:.15)){fkT=.15+R()*.5;sfx.buzz()}}
AMB=(blackout>0?.02:power?.34:.2)*lightF;LAMP=(power&&blackout<=0)?lightF:(R()<.02?.7:0);
FLON=P.fl&&!P.hid&&P.bat>0&&!(P.bat<20&&R()<.06)&&!(fear>.7&&R()<.04);RNG=4+8*(.35+.65*P.bat/100);
if(state==='dead'){deadT+=dt;if(deadT<1.1){const da=Math.atan2(Math.sin(P.dieA-P.a),Math.cos(P.dieA-P.a));P.a+=da*Math.min(1,dt*14);const k=Math.min(1,dt*9);C.x+=(P.x+Math.cos(P.a)*.45-C.x)*k;C.y+=(P.y+Math.sin(P.a)*.45-C.y)*k;C.anim+=dt*12;bobY=Math.round((R()-.5)*10*deadT)}else if(!scr){scr=true;sfx.screech()}if(deadT>5.2&&!over)finish(0)}
if(state==='win'){endT+=dt;if(endT>5&&!over)finish(1)}}
function finish(win){over=true;try{if(typeof triggerGameOver==='function')triggerGameOver(win?(hasVial?1500:1000):stage*100)}catch(e){}setTimeout(cleanup,300)}

// ---------- RENDU ----------
function flat(){const dx=Math.cos(P.a),dy=Math.sin(P.a),px=-dy*.66,py=dx*.66,hz=BH/2+bobY,o=fd.data;
const al=alarm?.5+.5*Math.sin(time*6):0,rm=1+al*.9,gm=1-al*.5;
for(let y=0;y<BH;y++){const yy=y-hz,F=yy>0,p=Math.abs(yy)||.5,rdist=.5*BH/p,row=y*BW*4;
if(rdist>13){for(let i=row;i<row+BW*4;i+=4)o[i]=o[i+1]=o[i+2]=0;continue}
let fx=P.x+rdist*(dx-px),fy=P.y+rdist*(dy-py);const sx=2*rdist*px/BW,sy=2*rdist*py/BW,am=AMB/(1+rdist*.5),fall=Math.max(0,1-rdist/RNG),cy=(y/BH-.58)*1.7;
for(let x=0;x<BW;x++,fx+=sx,fy+=sy){const gx=fl(fx),gy=fl(fy),tex=F?FV[fv(gx,gy)]:CV[cf(gx,gy)],tx=(fx*64)&63,ty=(fy*64)&63,ti=(ty*64+tx)*4,cx=(x/BW-.5)*1.7;
const L=am+(FLON?Math.exp(-(cx*cx+cy*cy)*8)*fall*1.15:0);let r=tex[ti]*L,g=tex[ti+1]*L,bl=tex[ti+2]*L;
if(!F&&tx>13&&tx<50&&ty>23&&ty<40&&tex===CD&&((gx+gy)&1)){const e=230*LAMP;r=Math.max(r,e);g=Math.max(g,e);bl=Math.max(bl,e*.95)}
const i=row+x*4;o[i]=Math.min(255,r*rm);o[i+1]=g*gm;o[i+2]=bl*gm}}
b.putImageData(fd,0,0)}
function walls(){const dx=Math.cos(P.a),dy=Math.sin(P.a),px=-dy*.66,py=dx*.66,hz=BH/2+bobY;
for(let x=0;x<BW;x++){const cm=2*x/BW-1,rx=dx+px*cm,ry=dy+py*cm;let mx=fl(P.x),my=fl(P.y);const ddx=Math.abs(1/rx),ddy=Math.abs(1/ry);let sx,sy,sdx,sdy;
if(rx<0){sx=-1;sdx=(P.x-mx)*ddx}else{sx=1;sdx=(mx+1-P.x)*ddx}if(ry<0){sy=-1;sdy=(P.y-my)*ddy}else{sy=1;sdy=(my+1-P.y)*ddy}
let side=0,hit=0,c='#';
for(let n=0;n<40;n++){if(sdx<sdy){sdx+=ddx;mx+=sx;side=0}else{sdy+=ddy;my+=sy;side=1}if(mx<0||my<0||mx>=MW||my>=MH){hit=1;c='#';break}c=G[my][mx];if(c!=='.'){hit=1;break}}
if(!hit){zb[x]=99;continue}
const dist=Math.max(.05,side?sdy-ddy:sdx-ddx);zb[x]=dist;
let wx=side?P.x+dist*rx:P.y+dist*ry;wx-=fl(wx);let tx=(wx*64)|0;if((side===0&&rx>0)||(side===1&&ry<0))tx=63-tx;
const lh=BH/dist,top=hz-lh/2;b.drawImage(wallTex(c,mx,my),tx,0,1,64,x,top,1,lh);
const cx=(x/BW-.5)*1.7;let L=AMB/(1+dist*.5)+(FLON?Math.exp(-cx*cx*5.6)*Math.max(0,1-dist/RNG)*1.15:0);L=Math.min(1,L)*(side?.8:1);
b.fillStyle=`rgba(0,0,0,${(1-L).toFixed(2)})`;b.fillRect(x,top,1,lh)}}
function spr(){const dx=Math.cos(P.a),dy=Math.sin(P.a),px=-dy*.66,py=dx*.66,inv=1/(px*dy-dx*py),hz=BH/2+bobY,L=[];
for(const i of items)if(!i.got)L.push({x:i.x,y:i.y,im:S[i.t],sz:.3,lf:.04,e:.5});for(const d of decor){const q=DS[d.t];L.push({x:d.x,y:d.y,im:S[d.t],sz:q[0],lf:q[1],e:q[2]})}
L.push({x:C.x,y:C.y,im:S.cr[(C.anim|0)&3],sz:.92,lf:0,e:0,c:1});
for(const s of L){const ex=s.x-P.x,ey=s.y-P.y;s.tx=inv*(dy*ex-dx*ey);s.ty=inv*(-py*ex+px*ey)}
L.filter(s=>s.ty>.2&&s.ty<14).sort((a,c)=>c.ty-a.ty).forEach(s=>{
let sx=BW/2*(1+s.tx/s.ty);if(s.c&&C.st==='chase')sx+=(R()-.5)*2;
const h=BH/s.ty*s.sz,w=h*s.im.width/s.im.height,bot=hz+BH/(2*s.ty)-s.lf*BH/s.ty,top=bot-h,x0=fl(sx-w/2);
let Lm=AMB/(1+s.ty*.5)+(FLON?Math.exp(-Math.pow((sx/BW-.5)*1.7,2)*8)*Math.max(0,1-s.ty/RNG)*1.15:0);Lm=Math.max(Lm,s.e||0);b.globalAlpha=clamp(Lm,0,1);
for(let x=Math.max(0,x0);x<Math.min(BW,x0+w);x++){if(s.ty>=zb[x])continue;b.drawImage(s.im,((x-x0)/w*s.im.width)|0,0,1,s.im.height,x,top,1,h)}
b.globalAlpha=1;
if(s.c){const ex=fl(sx);if(ex>=0&&ex<BW&&s.ty<zb[ex]){b.globalCompositeOperation='lighter';[-.055,.055].forEach(k=>{const gx=sx+k*w,gy=top+h*.12,r=Math.max(2,h*.06),qq=b.createRadialGradient(gx,gy,0,gx,gy,r);qq.addColorStop(0,'rgba(255,240,230,.9)');qq.addColorStop(1,'rgba(255,40,20,0)');b.fillStyle=qq;b.fillRect(gx-r,gy-r,r*2,r*2)});b.globalCompositeOperation='source-over'}}})}

// ---------- EFFETS + HUD ----------
const dust=Array.from({length:45},()=>({x:R(),y:R(),vx:(R()-.5)*.0006,vy:(R()-.5)*.0005,r:R()*1.6+.5}));
const grain=mk(128,128,g=>{const d=g.createImageData(128,128);for(let i=0;i<d.data.length;i+=4){const v=R()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255}g.putImageData(d,0,0)});
function wrap(t,x,y,mw,lh){let l='';for(const s of t.split(' ')){const tt=l+s+' ';if(ctx.measureText(tt).width>mw&&l){ctx.fillText(l,x,y);y+=lh;l=s+' '}else l=tt}ctx.fillText(l,x,y)}
const btns=()=>[{k:'e',x:W*.9,y:H*.58,r:H*.075,l:'E'},{k:'f',x:W*.9,y:H*.78,r:H*.06,l:'F'},{k:'run',x:W*.76,y:H*.8,r:H*.07,l:'»'}];
function post(){const fs=Math.round(H/32);
const shk=fear*fear*H*.012,ox=(R()-.5)*shk,oy=(R()-.5)*shk;
ctx.imageSmoothingEnabled=false;ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);if(state==='intro'&&blurPx>.3&&'filter' in ctx)ctx.filter='blur('+blurPx.toFixed(1)+'px)';ctx.drawImage(bc,ox,oy,W,H);ctx.filter='none';
const vg=ctx.createRadialGradient(W/2,H/2,H*(.3-pulse*.05*fear),W/2,H/2,H*.9);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.92)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
if(fear>.35){ctx.fillStyle=`rgba(120,0,0,${(fear-.35)*.3+pulse*.06})`;ctx.fillRect(0,0,W,H)}
if(alarm){ctx.fillStyle=`rgba(255,0,0,${.05+.07*Math.sin(time*6)**2})`;ctx.fillRect(0,0,W,H)}
ctx.globalAlpha=.07;ctx.fillStyle=ctx.createPattern(grain,'repeat');ctx.save();ctx.translate(R()*128|0,R()*128|0);ctx.fillRect(-128,-128,W+256,H+256);ctx.restore();ctx.globalAlpha=1;
ctx.fillStyle='rgba(0,0,0,.12)';for(let y=0;y<H;y+=3)ctx.fillRect(0,y,W,1);
ctx.fillStyle='rgba(20,45,40,.12)';ctx.fillRect(0,0,W,H);
if(FLON&&state!=='dead'){ctx.globalCompositeOperation='lighter';const bg=ctx.createRadialGradient(W/2,H*.58,0,W/2,H*.58,H*.75);bg.addColorStop(0,'rgba(255,240,200,.07)');bg.addColorStop(1,'rgba(255,240,200,0)');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);for(const d of dust){d.x+=d.vx;d.y+=d.vy;if(d.x<0)d.x=1;if(d.x>1)d.x=0;if(d.y<0)d.y=1;if(d.y>1)d.y=0;const a=Math.max(0,1-Math.hypot(d.x-.5,(d.y-.58)*1.2)*2.2)*.55;if(a>.02){ctx.fillStyle=`rgba(255,250,230,${a})`;ctx.beginPath();ctx.arc(d.x*W,d.y*H,d.r*H/420,0,TAU);ctx.fill()}}ctx.globalCompositeOperation='source-over'}
if(flash>0){ctx.fillStyle=`rgba(255,255,255,${flash*.8})`;ctx.fillRect(0,0,W,H)}
if(P.hid){ctx.fillStyle='#030303';const sh=H*.03;let y0=0;[.3,.5,.7].forEach(c=>{ctx.fillRect(0,y0,W,H*c-sh/2-y0);y0=H*c+sh/2});ctx.fillRect(0,y0,W,H-y0)}
if(state==='intro'||state==='dead')return;
// HUD
ctx.font=`${fs}px "Courier New",monospace`;ctx.textBaseline='top';ctx.textAlign='left';
ctx.fillStyle=`rgba(190,215,190,${.7+.2*lightF})`;ctx.fillText("OBJECTIF : "+OBJ[Math.min(stage,4)],fs,fs);
const bw=H*.22,by=H-fs*2.2;ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(fs,by,bw,fs*.6);ctx.fillRect(fs,by-fs,bw,fs*.6);
ctx.fillStyle=P.bat<20?'#d33':'#cc9';ctx.fillRect(fs,by-fs,bw*P.bat/100,fs*.6);ctx.fillStyle=P.canRun?'#6b9':'#a55';ctx.fillRect(fs,by,bw*P.st,fs*.6);
ctx.fillStyle='rgba(190,215,190,.7)';ctx.font=`${fs*.7}px "Courier New",monospace`;ctx.fillText("LAMPE",fs*1.2+bw,by-fs);ctx.fillText("ENDURANCE",fs*1.2+bw,by);
ctx.font=`${fs}px "Courier New",monospace`;ctx.textAlign='center';
const t=state==='play'?target():null;if(t&&t.txt){ctx.fillStyle='rgba(230,230,200,.9)';ctx.fillText(t.txt,W/2,H*.62)}
if(msgT>0){ctx.fillStyle=`rgba(210,200,190,${Math.min(1,msgT)})`;ctx.fillText(msgS,W/2,H*.86)}
if(noteT>0){ctx.fillStyle='rgba(0,0,0,.75)';ctx.fillRect(W*.15,H*.2,W*.7,H*.4);ctx.fillStyle='#e8e2c8';ctx.textAlign='left';wrap(noteS,W*.18,H*.24,W*.64,fs*1.4)}
if(touch&&state==='play'){ctx.textAlign='center';ctx.textBaseline='middle';for(const k of btns()){ctx.fillStyle='rgba(255,255,255,.12)';ctx.beginPath();ctx.arc(k.x,k.y,k.r,0,TAU);ctx.fill();ctx.fillStyle='rgba(255,255,255,.5)';ctx.fillText(k.l,k.x,k.y)}
if(tc.stick){ctx.strokeStyle='rgba(255,255,255,.3)';ctx.beginPath();ctx.arc(tc.stick.x,tc.stick.y,H*.1,0,TAU);ctx.stroke();ctx.beginPath();ctx.arc(tc.stick.x+tc.stick.dx*H*.1,tc.stick.y+tc.stick.dy*H*.1,H*.04,0,TAU);ctx.stroke()}}
ctx.textBaseline='top'}
function face(cx,cy,s,t){
ctx.strokeStyle='rgba(200,210,200,.5)';ctx.lineWidth=s*.02;[-1,1].forEach(k=>{ctx.beginPath();ctx.moveTo(cx+k*s*.3,cy+s*.5);ctx.quadraticCurveTo(cx+k*s*.45,cy+s*.2,cx+k*s*.36,cy-s*.2);ctx.stroke()});
let g=ctx.createRadialGradient(cx-s*.1,cy-s*.2,s*.05,cx,cy,s*.7);g.addColorStop(0,'#c4c7b4');g.addColorStop(.6,'#7d8170');g.addColorStop(1,'#26281f');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(cx,cy-s*.05,s*.4,s*.62,0,0,TAU);ctx.fill();
ctx.fillStyle='#6a1010';ctx.beginPath();ctx.ellipse(cx+s*.2,cy-s*.35,s*.1,s*.16,.5,0,TAU);ctx.fill();ctx.fillStyle='#2a0505';ctx.beginPath();ctx.ellipse(cx+s*.2,cy-s*.34,s*.05,s*.09,.5,0,TAU);ctx.fill();
ctx.strokeStyle='rgba(110,10,10,.8)';ctx.lineWidth=Math.max(1,s*.006);for(let i=0;i<14;i++){const x=cx+(R()-.5)*s*.6,y=cy-s*.55+R()*s*.3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(R()-.5)*s*.15,y+s*.1+R()*s*.15);ctx.stroke()}
[-1,1].forEach(k=>{const ex=cx+k*s*.16,ey=cy-s*.14;ctx.fillStyle='#020202';ctx.beginPath();ctx.ellipse(ex,ey,s*.11,s*.15,k*.2,0,TAU);ctx.fill();const r=ctx.createRadialGradient(ex,ey,0,ex,ey,s*.07);r.addColorStop(0,'#fff');r.addColorStop(.5,'#e8dcc8');r.addColorStop(1,'rgba(200,30,20,0)');ctx.fillStyle=r;ctx.beginPath();ctx.arc(ex,ey,s*.07,0,TAU);ctx.fill();ctx.fillStyle='#000';ctx.beginPath();ctx.arc(ex,ey,s*.012,0,TAU);ctx.fill()});
ctx.fillStyle='#120505';ctx.beginPath();ctx.moveTo(cx,cy+s*.02);ctx.lineTo(cx-s*.03,cy+s*.12);ctx.lineTo(cx+s*.03,cy+s*.12);ctx.fill();
const o=s*(.3+.1*Math.sin(t*28)**2),my=cy+s*.17;ctx.fillStyle='#0c0202';ctx.beginPath();ctx.moveTo(cx-s*.24,my);ctx.quadraticCurveTo(cx,my+o*1.9,cx+s*.24,my);ctx.fill();
ctx.fillStyle='#ded9b8';for(let i=0;i<11;i++){const x=cx-s*.23+i*s*.046;ctx.beginPath();ctx.moveTo(x,my);ctx.lineTo(x+s*.023,my+s*(.07+.05*(i%3)));ctx.lineTo(x+s*.046,my);ctx.fill();ctx.beginPath();ctx.moveTo(x+s*.01,my+o*1.5);ctx.lineTo(x+s*.03,my+o*1.5-s*(.06+.04*(i%2)));ctx.lineTo(x+s*.05,my+o*1.5);ctx.fill()}
ctx.strokeStyle='rgba(190,210,180,.55)';ctx.lineWidth=Math.max(1,s*.008);for(let i=0;i<5;i++){const x=cx-s*.15+i*s*.075;ctx.beginPath();ctx.moveTo(x,my+s*.05);ctx.quadraticCurveTo(x+s*.01,my+o,x,my+o*1.5+s*(.05+(i%2)*.1));ctx.stroke()}}
function claws(t){const p=clamp(t/.9,0,1),e=p*p*(3-2*p);ctx.fillStyle=`rgba(150,0,0,${.12+.25*Math.sin(t*40)**2})`;ctx.fillRect(0,0,W,H);
for(const sd of[-1,1])for(let i=0;i<5;i++){const y=H*(.25+i*.12)+Math.sin(t*30+i)*H*.01,bx=sd<0?-W*.05:W*1.05,tx=sd<0?W*(.05+.42*e):W*(.95-.42*e),ty=y+(i-2)*H*.045*e,w=H*.035;
const g=ctx.createLinearGradient(bx,0,tx,0);g.addColorStop(0,'#2a2c25');g.addColorStop(1,'#8d9181');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(bx,y-w*1.6);ctx.lineTo(tx,ty-w*.25);ctx.lineTo(tx,ty+w*.25);ctx.lineTo(bx,y+w*1.6);ctx.fill();
ctx.fillStyle='#ddd8bc';ctx.beginPath();ctx.moveTo(tx,ty-w*.3);ctx.lineTo(tx-sd*H*.09,ty+w*.2);ctx.lineTo(tx,ty+w*.3);ctx.fill()}
const v=ctx.createRadialGradient(W/2,H/2,H*(.5-.35*e),W/2,H/2,H*.8);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(40,0,0,.9)');ctx.fillStyle=v;ctx.fillRect(0,0,W,H)}
function jump(t){const sh=(R()-.5)*H*.06*(1+t),dy=Math.min(t,1.6)*H*.12;
ctx.fillStyle=((t<.12&&R()<.6)||R()<.025)?'#fff':'#000';ctx.fillRect(0,0,W,H);
if(t<1.7){ctx.save();ctx.translate(W/2+sh,H*.5+dy+sh);ctx.rotate(Math.sin(t*9)*.05*t+Math.min(t,1.6)*.12);ctx.translate(-W/2,-H*.5);const s=H*(.55+Math.min(t,1.2)*.55);face(W/2,H*.5,s,t);
ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.35;ctx.translate(H*.012,0);face(W/2,H*.5,s,t+.05);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.restore();
ctx.fillStyle=`rgba(160,0,0,${.15+.2*Math.sin(t*50)**2})`;ctx.fillRect(0,0,W,H);
for(const d of splat){if(t<d.t)continue;ctx.fillStyle='rgba(110,0,0,.8)';ctx.beginPath();ctx.arc(d.x*W,d.y*H,d.r*(.4+Math.min(1,(t-d.t)*2)*.6),0,TAU);ctx.fill()}}
else{if(!crunched){crunched=true;sfx.crunch()}ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);if(t>2.6){ctx.fillStyle=`rgba(170,20,20,${Math.min(1,(t-2.6)*1.5)})`;ctx.font=`${H/12}px "Courier New",monospace`;ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText("VOUS ÊTES MORT",W/2,H*.44)}}}
function eyelid(){if(introT>3&&introT<7){ctx.fillStyle='rgba(210,200,190,.85)';ctx.font=`${H/32}px "Courier New",monospace`;ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(introT<5?"Ma tête... Où... où suis-je ?":"Il faut que je me lève.",W/2,H*.86)}
const h=H/2*(1-eoV);if(h<=0)return;ctx.fillStyle='#080202';ctx.fillRect(0,0,W,h);ctx.fillRect(0,H-h,W,h);
let g=ctx.createLinearGradient(0,h,0,h+H*.06);g.addColorStop(0,'rgba(8,2,2,.9)');g.addColorStop(1,'rgba(8,2,2,0)');ctx.fillStyle=g;ctx.fillRect(0,h,W,H*.06);
g=ctx.createLinearGradient(0,H-h,0,H-h-H*.06);g.addColorStop(0,'rgba(8,2,2,.9)');g.addColorStop(1,'rgba(8,2,2,0)');ctx.fillStyle=g;ctx.fillRect(0,H-h-H*.06,W,H*.06)}
function title(){ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);const fs=H/28,j=R()<.06?(R()-.5)*8:0;
ctx.textAlign='center';ctx.textBaseline='top';ctx.font=`bold ${H/7}px "Courier New",monospace`;ctx.fillStyle='#600';ctx.fillText("LABO 7",W/2+j+3,H*.14+2);ctx.fillStyle=R()<.04?'#400':'#c11';ctx.fillText("LABO 7",W/2+j,H*.14);
ctx.font=`${fs}px "Courier New",monospace`;ctx.fillStyle='#9a9';ctx.fillText("Installation abandonnée. Vous vous réveillez enfermé. Quelque chose rôde.",W/2,H*.4);
ctx.fillStyle='#788';['ZQSD / WASD ou flèches : se déplacer     Souris : regarder','Maj : courir (endurance limitée)     E : interagir     F : lampe','Ne courez pas près de lui. Il entend tout. Cachez-vous dans les casiers (E).'].forEach((l,i)=>ctx.fillText(l,W/2,H*.52+i*fs*1.5));
ctx.fillStyle=Math.sin(time*3)>0?'#ddd':'#666';ctx.fillText(touch?"Touchez l'écran pour entrer":"Cliquez pour entrer (casque conseillé)",W/2,H*.82)}
function pauseScr(){ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#ccc';ctx.font=`${H/20}px "Courier New",monospace`;ctx.textAlign='center';ctx.fillText("PAUSE : cliquez pour reprendre",W/2,H*.45)}
function winScr(){const a=Math.min(1,endT/2.5);ctx.fillStyle=`rgba(255,255,255,${a})`;ctx.fillRect(0,0,W,H);if(endT>2.5){ctx.fillStyle='#222';ctx.font=`${H/14}px "Courier New",monospace`;ctx.textAlign='center';ctx.fillText(hasVial?"FIN : LA VÉRITÉ":"VOUS ÊTES SORTI.",W/2,H*.4);ctx.font=`${H/28}px "Courier New",monospace`;ctx.fillText(hasVial?"Vous emportez l'antidote. Le monde saura ce qui s'est passé ici.":"Mais derrière la porte, quelque chose frappe encore...",W/2,H*.52)}}

function frame(ts){if(!alive)return;lastF=performance.now();const dt=Math.min(.05,(ts-prev)/1000||.016);prev=ts;
if(cv.width!==W||cv.height!==H){W=cv.width;H=cv.height;BH=Math.round(BW*H/W);bc.height=BH;mkfd()}
update(dt);
if(state==='title'){title()}
else if(state==='dead'&&deadT>=1.1)jump(deadT-1.1);
else{flat();walls();spr();post();if(state==='dead')claws(deadT);if(state==='intro')eyelid();if(state==='pause')pauseScr();if(state==='win')winScr()}
raf=requestAnimationFrame(frame);try{currentGameLoop=raf}catch(e){}}

// ---------- ENTRÉES ----------
function begin(){aInit();if(AC&&AC.state==='suspended')AC.resume();if(!touch&&cv.requestPointerLock)try{cv.requestPointerLock()}catch(e){}
if(!started){started=true;state='intro';introT=0;P.fl=false}else state='play'}
const onKD=e=>{if(!alive)return;keys[e.code]=true;if(state==='play'){if(e.code==='KeyE')act();if(e.code==='KeyF')togFl();if(/Arrow|Space/.test(e.code))e.preventDefault()}else if((e.code==='Enter'||e.code==='Space')&&(state==='title'||state==='pause'))begin()};
const onKU=e=>{keys[e.code]=false};
const onMM=e=>{if(state==='play'&&document.pointerLockElement===cv)P.a+=e.movementX*.0025};
const onPL=()=>{if(state==='play'&&!touch&&document.pointerLockElement!==cv)state='pause'};
const onClick=()=>{if(state==='title'||state==='pause')begin()};
const onVis=()=>{if(document.hidden&&state==='play')state='pause'};
const tpos=t=>{const r=cv.getBoundingClientRect();return[(t.clientX-r.left)*W/r.width,(t.clientY-r.top)*H/r.height]};
const onTS=e=>{e.preventDefault();if(state!=='play'){begin();return}
for(const t of e.changedTouches){const[x,y]=tpos(t);let hit=false;for(const k of btns())if(Math.hypot(x-k.x,y-k.y)<k.r*1.3){hit=true;if(k.k==='e')act();else if(k.k==='f')togFl();else tc.run=t.identifier}
if(hit)continue;if(x<W/2&&!tc.stick)tc.stick={id:t.identifier,x,y,dx:0,dy:0};else if(!tc.look)tc.look={id:t.identifier,x}}};
const onTM=e=>{e.preventDefault();for(const t of e.changedTouches){const[x,y]=tpos(t);if(tc.stick&&tc.stick.id===t.identifier){tc.stick.dx=clamp((x-tc.stick.x)/(H*.1),-1,1);tc.stick.dy=clamp((y-tc.stick.y)/(H*.1),-1,1)}else if(tc.look&&tc.look.id===t.identifier){P.a+=(x-tc.look.x)*.006;tc.look.x=x}}};
const onTE=e=>{for(const t of e.changedTouches){if(tc.stick&&tc.stick.id===t.identifier)tc.stick=null;if(tc.look&&tc.look.id===t.identifier)tc.look=null;if(tc.run===t.identifier)tc.run=null}};
document.addEventListener('keydown',onKD);document.addEventListener('keyup',onKU);document.addEventListener('mousemove',onMM);document.addEventListener('pointerlockchange',onPL);document.addEventListener('visibilitychange',onVis);
cv.addEventListener('click',onClick);cv.addEventListener('touchstart',onTS,{passive:false});cv.addEventListener('touchmove',onTM,{passive:false});cv.addEventListener('touchend',onTE);cv.addEventListener('touchcancel',onTE);

function cleanup(){if(!alive)return;alive=false;cancelAnimationFrame(raf);clearInterval(wd);
document.removeEventListener('keydown',onKD);document.removeEventListener('keyup',onKU);document.removeEventListener('mousemove',onMM);document.removeEventListener('pointerlockchange',onPL);document.removeEventListener('visibilitychange',onVis);
cv.removeEventListener('click',onClick);cv.removeEventListener('touchstart',onTS);cv.removeEventListener('touchmove',onTM);cv.removeEventListener('touchend',onTE);cv.removeEventListener('touchcancel',onTE);
if(document.exitPointerLock&&document.pointerLockElement===cv)document.exitPointerLock();
if(AC){try{AC.close()}catch(e){}}if(window.stopHorrorGame===cleanup)window.stopHorrorGame=null}
window.stopHorrorGame=cleanup;
// garde-fou : si le site masque/retire le canvas ou stoppe la boucle, on coupe sons et écouteurs
const wd=setInterval(()=>{if(!alive)return;if(!document.body.contains(cv)||cv.offsetParent===null||(!document.hidden&&performance.now()-lastF>1500))cleanup()},700);
if(scoreEl)scoreEl.textContent=0;
raf=requestAnimationFrame(frame);try{currentGameLoop=raf}catch(e){}
}