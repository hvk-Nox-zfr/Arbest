// Tower Stack+ — intégration hub de jeux (desktop + mobile)
// Le jeu utilise le canvas #game-canvas et la zone #game-view du site.
(() => {
  const host = document.getElementById('game-view');
  const cv = document.getElementById('game-canvas');
  if (!host || !cv) {
    console.error('[Tower Stack] #game-view ou #game-canvas introuvable.');
    return;
  }

  // UI isolée : ne remplace jamais le contenu global du site.
  let ui = document.getElementById('tower-stack-ui');
  if (ui) ui.remove();
  ui = document.createElement('div');
  ui.id = 'tower-stack-ui';
  ui.innerHTML = `
    <div class="ts-ov" id="ts-hud"><div id="ts-sc">0</div><span id="ts-wl"></span></div>
    <div class="ts-ov" id="ts-mg"></div>
    <div class="ts-ov" id="ts-bn"></div>
    <div class="ts-ov" id="ts-title"><h1>Tower Stack+</h1><p>Pose chaque bloc pile sur le précédent.</p></div>
    <div id="ts-panel"><h2 id="ts-pt"></h2><p id="ts-ps"></p><div id="ts-chips"></div><button id="ts-go" type="button">Jouer</button></div>
    <button id="ts-tap" type="button" aria-label="Poser le bloc">POSER</button>
  `;
  host.appendChild(ui);

  const style = document.createElement('style');
  style.id = 'tower-stack-style';
  style.textContent = `
    #game-view{position:relative;overflow:hidden;isolation:isolate}
    #game-canvas{display:block;width:100%!important;height:100%!important;touch-action: manipulation}
    #tower-stack-ui{position:absolute;inset:0;z-index:20;overflow:hidden;pointer-events:none;color:#fff;font-family:"Arial Rounded MT Bold","Nunito","Trebuchet MS",system-ui,sans-serif;user-select:none;-webkit-user-select:none}
    #tower-stack-ui *{box-sizing:border-box}
    #tower-stack-ui .ts-ov{position:absolute;left:0;right:0;text-align:center;pointer-events:none;text-shadow:0 3px 0 rgba(0,0,0,.28)}
    #tower-stack-ui #ts-hud{top:calc(env(safe-area-inset-top,0px) + 10px);display:none}
    #tower-stack-ui #ts-sc{font-size:clamp(38px,9vw,76px);line-height:1}
    #tower-stack-ui #ts-wl{display:inline-block;margin-top:6px;padding:5px 14px;border-radius:99px;background:rgba(0,0,0,.35);font-size:14px;text-shadow:none}
    #tower-stack-ui #ts-mg{top:30%;font-size:clamp(22px,6vw,34px);opacity:0}
    #tower-stack-ui #ts-mg.on{animation:ts-pop .9s ease-out}
    @keyframes ts-pop{0%{opacity:0;transform:scale(.6)}18%{opacity:1;transform:scale(1.12)}70%{opacity:1}100%{opacity:0;transform:translateY(-24px)}}
    #tower-stack-ui #ts-bn{top:18%;opacity:0}
    #tower-stack-ui #ts-bn.on{animation:ts-ban 2.4s ease-out}
    #tower-stack-ui #ts-bn b{display:block;font-size:clamp(30px,9vw,58px)}
    #tower-stack-ui #ts-bn span{font-size:15px}
    @keyframes ts-ban{0%{opacity:0;transform:translateY(14px)}12%,75%{opacity:1;transform:none}100%{opacity:0}}
    #tower-stack-ui #ts-title{top:8%;padding:0 12px}
    #tower-stack-ui #ts-title h1{margin:0;font-size:clamp(36px,10vw,72px);line-height:1}
    #tower-stack-ui #ts-title p{margin:8px 0 0;font-size:clamp(13px,3.5vw,16px)}
    #tower-stack-ui #ts-panel{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);transform:translateX(-50%);width:min(92%,420px);max-height:72%;overflow:auto;padding:16px;border-radius:22px;background:rgba(14,18,28,.82);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);text-align:center;display:none;pointer-events:auto}
    #tower-stack-ui #ts-pt{margin:0 0 6px;font-size:clamp(21px,5vw,26px)}
    #tower-stack-ui #ts-ps{margin:0 0 12px;font-size:14px;line-height:1.35;opacity:.9}
    #tower-stack-ui #ts-chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:14px}
    #tower-stack-ui .ts-ch{display:flex;align-items:center;gap:6px;padding:4px 9px;border-radius:99px;background:rgba(255,255,255,.1);font-size:12px}
    #tower-stack-ui .ts-ch i{width:9px;height:9px;transform:rotate(45deg);display:block}
    #tower-stack-ui #ts-go{font:inherit;font-size:20px;color:#fff;border:0;padding:12px 34px;border-radius:16px;background:#ff6b3d;box-shadow:0 5px 0 #b8421f;cursor:pointer;touch-action:manipulation}
    #tower-stack-ui #ts-go:active{transform:translateY(3px);box-shadow:0 2px 0 #b8421f}
    #tower-stack-ui #ts-tap{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);transform:translateX(-50%);display:none;pointer-events:auto;border:0;border-radius:999px;padding:13px 34px;background:rgba(255,107,61,.94);color:#fff;font:700 16px system-ui,sans-serif;letter-spacing:1px;box-shadow:0 4px 0 #b8421f;touch-action:manipulation}
    #tower-stack-ui #ts-tap:active{transform:translate(-50%,3px);box-shadow:0 1px 0 #b8421f}
    @media (hover:none),(max-width:700px){#tower-stack-ui #ts-tap{display:none}#tower-stack-ui #ts-title{top:6%}#tower-stack-ui #ts-panel{bottom:calc(env(safe-area-inset-bottom,0px) + 10px);padding:13px}#tower-stack-ui #ts-chips{gap:5px}}
  `;
  document.head.appendChild(style);

  const $ = id => document.getElementById(id);
  const ctx = cv.getContext('2d');

const rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hsl=(h,s,l)=>`hsl(${h%360},${s}%,${clamp(l,0,100)}%)`;
const WD=[
{n:'Prairie',p:34,r:'Commun',rc:'#c5ced6',sky:['#63b8ff','#e9f9ff'],h0:200,st:10,s:55,l:56,g:'#5bb34f',cl:'#fff',fx:'none',
 L:[{k:.12,c:['#a6d3c4','#8cc0b0'],hh:[110,170],ww:[220,340]},{k:.28,c:['#74c566','#5cae52'],hh:[55,95],ww:[200,320]}]},
{n:'Désert',p:22,r:'Peu commun',rc:'#8be28b',sky:['#ff9a5c','#ffe8b4'],h0:175,st:8,s:60,l:52,g:'#dfa257',cl:'#fff0d4',fx:'sun',
 L:[{k:.12,c:['#f1b66c','#d99a4f'],hh:[40,80],ww:[320,480]},{k:.28,c:['#e8a95c','#cb8a40'],hh:[30,60],ww:[280,440]}]},
{n:'Banquise',p:16,r:'Peu commun',rc:'#8be28b',sky:['#8fa8ff','#eef5ff'],h0:335,st:8,s:62,l:62,g:'#f2f8ff',cl:'#fff',fx:'snow',
 L:[{k:.12,c:['#c4d6fb','#a1b8ea'],hh:[130,210],ww:[220,330],cap:['#fff','#dfe9fa']},{k:.28,c:['#e4eefc','#c3d3ee'],hh:[60,110],ww:[200,300]}]},
{n:'Abysses',p:12,r:'Rare',rc:'#6cb8ff',sky:['#0f86ad','#031d33'],h0:10,st:8,s:78,l:60,g:'#a58d57',fx:'bubble',
 L:[{k:.12,c:['#0a5878','#07435f'],hh:[110,180],ww:[220,340]},{k:.28,c:['#0d7a8a','#0a6574'],hh:[50,90],ww:[200,300]}]},
{n:'Volcan',p:10,r:'Très rare',rc:'#ff9a3d',sky:['#220808','#c2410f'],h0:45,st:7,s:85,l:56,g:'#2b1613',lava:'#ff7a1f',fx:'ember',
 L:[{k:.12,c:['#4d2a22','#34191a'],hh:[170,270],ww:[260,380],cap:['#ff9a3d','#e25517']},{k:.28,c:['#3b1f1c','#281312'],hh:[70,120],ww:[220,320]}]},
{n:'Espace',p:6,r:'Légendaire',rc:'#ffd84a',sky:['#03041a','#241a63'],h0:160,st:11,s:75,l:62,g:['#6d5bd0','#5846b6'],fx:'stars',L:[]}
];
const HH=18,BW=100,RANGE=135;
let Wd,Hd,k,pr,wd=WD[0],st='menu',blocks=[],cur=null,axis=0,dir=1,cam=0,camT=0,Z=1,ZT=1,score=0,combo=0,best=0,debris=[],rings=[],P=[],pk=[],clouds=[],shake=0,lt=0,sc=1,tapOk=0;
try{best=+localStorage.getItem('tsp_best')||0}catch(e){}
function rs(){const r=host.getBoundingClientRect();const d=Math.min(devicePixelRatio||1,2);Wd=Math.max(1,r.width);Hd=Math.max(1,r.height);cv.width=Math.round(Wd*d);cv.height=Math.round(Hd*d);cv.style.width='100%';cv.style.height='100%';ctx.setTransform(d,0,0,d,0,0);k=Math.min(Wd*.0033,Hd*.0021);sc=clamp(Wd/700,.55,1.3)}
window.addEventListener('resize',rs,{passive:true});rs();
let ac;function beep(f,d=.1,ty='triangle',v=.14){try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator(),g=ac.createGain();o.type=ty;o.frequency.value=f;g.gain.setValueAtTime(v,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+d);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+d)}catch(e){}}
const note=c=>330*2**(([0,2,4,7,9][c%5]+12*Math.floor(c/5))/12);
function roll(){let r=Math.random()*100;for(const w of WD){if((r-=w.p)<0)return w}return WD[0]}
function setWorld(w){wd=w;P=[];const n=w.fx=='stars'?80:['snow','ember','bubble'].includes(w.fx)?30:0;
 for(let i=0;i<n;i++)P.push({x:Math.random(),y:Math.random(),s:rnd(.6,1.6),v:rnd(.02,.07),a:Math.random()*6});
 clouds=[];if(w.cl)for(let i=0;i<4;i++)clouds.push({x:Math.random(),y:rnd(.08,.45),s:rnd(.7,1.4),v:rnd(.004,.012)});
 pk=w.L.map(l=>{const a=[];let x=0;while(x<1700){const ww=rnd(...l.ww);a.push({x,w:ww,h:rnd(...l.hh)});x+=ww*rnd(.45,.7)}return a})}
function spawn(){const t=blocks[blocks.length-1];axis=blocks.length%2;dir=Math.random()<.5?1:-1;
 cur={x:t.x,z:t.z,w:t.w,d:t.d,y:t.y+HH,i:blocks.length,f:0};cur[axis?'z':'x']-=dir*RANGE;camT=cur.y}
function newRun(){blocks=[{x:0,z:0,w:BW,d:BW,y:0,i:0,f:0}];debris=[];rings=[];score=0;combo=0;Z=ZT=1;spawn();cam=camT;$('ts-sc').textContent=0}
function demo(){blocks=[{x:0,z:0,w:BW,d:BW,y:0,i:0,f:0}];for(let i=1;i<9;i++){const t=blocks[i-1];blocks.push({x:t.x+rnd(-12,12),z:t.z+rnd(-12,12),w:clamp(t.w-rnd(0,8),70,100),d:clamp(t.d-rnd(0,8),70,100),y:i*HH,i,f:0})}
 cur=null;debris=[];rings=[];Z=ZT=1;cam=camT=4.5*HH-.22*Hd/k}
function msg(t){const m=$('ts-mg');m.textContent=t;m.classList.remove('on');void m.offsetWidth;m.classList.add('on')}
function panel(mode){const p=$('ts-panel');p.style.display='block';const m=mode=='menu';
 $('ts-pt').textContent=m?'Prêt à grimper ?':(score>0&&score>=best?'Nouveau record !':'Tour effondrée');
 $('ts-ps').textContent=m?'Un monde est tiré au sort à chaque partie. Les plus rares sont les plus beaux.':`Score ${score} · Record ${best} · ${wd.n}`;
 $('ts-chips').style.display=m?'flex':'none';$('ts-go').textContent=m?'Jouer':'Rejouer'}
$('ts-chips').innerHTML=WD.map(w=>`<span class="ch"><i style="background:${hsl(w.h0,w.s,w.l)}"></i>${w.n} ${w.p} %</span>`).join('');
function startGame(){beep(520,.08);setWorld(roll());newRun();st='play';$('ts-panel').style.display='none';$('ts-title').style.display='none';
  $('ts-tap').style.display=(window.matchMedia&&window.matchMedia('(hover: none), (max-width:700px)').matches)?'block':'none';
 $('ts-hud').style.display='block';$('ts-wl').textContent=wd.n;
 const b=$('ts-bn');b.innerHTML=`<b>${wd.n}</b><span style="color:${wd.rc}">${wd.r} · ${wd.p} % de chance</span>`;b.classList.remove('on');void b.offsetWidth;b.classList.add('on')}
function over(){st='over';$('ts-tap').style.display='none';const n=blocks.length,nr=score>best;if(nr){best=score;try{localStorage.setItem('tsp_best',best)}catch(e){}}
 ZT=clamp(Hd*.5/((n*HH+170)*k),.3,1);camT=n*HH/2-.24*Hd/(k*ZT);tapOk=performance.now()+800;
 setTimeout(()=>{if(st=='over')panel('over')},650)}
function place(){if(!cur)return;
 const top=blocks[blocks.length-1],a=axis?'z':'x',s=axis?'d':'w',dl=cur[a]-top[a],ad=Math.abs(dl);
 if(ad>=top[s]-.5){debris.push({...cur,vy:0,vx:dl>0?40:-40,ax:a});cur=null;combo=0;shake=9;beep(110,.45,'sawtooth');return over()}
 if(ad<=4.5){cur[a]=top[a];combo++;let g=0;if(combo>=3&&cur[s]<BW){cur[s]=Math.min(BW,cur[s]+6);g=1}
  cur.f=1;rings.push({...cur,t:0});score+=2;msg('Parfait ×'+combo+(g?' · bloc élargi':''));beep(note(combo),.22)}
 else{combo=0;const oc=(cur[a]+top[a])/2,sg=Math.sign(dl),db={...cur,vy:0,vx:sg*30,ax:a};
  db[s]=ad;db[a]=oc+sg*top[s]/2;debris.push(db);cur[a]=oc;cur[s]=top[s]-ad;shake=6;score++;beep(200,.12)}
 blocks.push(cur);cur=null;$('ts-sc').textContent=score;spawn()}
const sp=()=>Math.min(110+blocks.length*2.4,260);
function update(dt){
 if(st=='play'&&cur){const a=axis?'z':'x',c=blocks[blocks.length-1][a];cur[a]+=dir*sp()*dt;
  if(cur[a]-c>RANGE){cur[a]=c+RANGE;dir=-1}else if(cur[a]-c<-RANGE){cur[a]=c-RANGE;dir=1}}
 cam+=(camT-cam)*Math.min(1,dt*4);Z+=(ZT-Z)*Math.min(1,dt*3);
 for(const b of blocks.slice(-3))if(b.f>0)b.f=Math.max(0,b.f-dt*3);
 for(const d of debris){d.vy-=900*dt;d.y+=d.vy*dt;d[d.ax]+=d.vx*dt}
 debris=debris.filter(d=>d.y>cam-900);
 for(const r of rings)r.t+=dt*2.2;rings=rings.filter(r=>r.t<1);
 shake*=.88;
 for(const c of clouds){c.x+=c.v*dt;if(c.x>1.2)c.x=-.2}
 for(const p of P){if(wd.fx=='snow')p.y+=p.v*dt;else if(wd.fx!='stars')p.y-=p.v*dt;p.y=(p.y+1)%1}}
function disc(x,y,R,n,c1,c2,rot=0){for(let i=0;i<n;i++){const a=rot+i/n*6.283,b=rot+(i+1)/n*6.283;ctx.fillStyle=ctx.strokeStyle=i%2?c1:c2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*R,y+Math.sin(a)*R);ctx.lineTo(x+Math.cos(b)*R,y+Math.sin(b)*R);ctx.closePath();ctx.fill();ctx.stroke()}}
function tri(a,b,c,col){ctx.fillStyle=ctx.strokeStyle=col;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.lineTo(...c);ctx.closePath();ctx.fill();ctx.stroke()}
function bg(){
 const g=ctx.createLinearGradient(0,0,0,Hd);g.addColorStop(0,wd.sky[0]);g.addColorStop(1,wd.sky[1]);ctx.fillStyle=g;ctx.fillRect(0,0,Wd,Hd);
 const kk=k*Z,cy=Hd*.62,r=cam*kk,t=performance.now()/1000;ctx.lineWidth=1;
 if(wd.fx=='stars'){ctx.fillStyle='#fff';for(const p of P){ctx.globalAlpha=.4+.6*Math.abs(Math.sin(t*p.s+p.a));ctx.fillRect(p.x*Wd,(p.y*Hd+r*.05*p.s)%Hd,p.s*1.7,p.s*1.7)}ctx.globalAlpha=1;
  const py=Hd*.2+r*.03;disc(Wd*.78,py,46*sc,8,'#ff8fb1','#d96a95',t*.05);ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(Wd*.78,py,74*sc,16*sc,-.4,0,6.283);ctx.stroke()}
 if(wd.fx=='sun')disc(Wd*.78,Hd*.22+r*.05,48*sc,10,'#fff4c2','#ffe28a',t*.1);
 if(wd.fx=='bubble'){ctx.fillStyle='rgba(255,255,255,.05)';for(let i=0;i<4;i++){const x=Wd*(.1+.25*i);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+70,0);ctx.lineTo(x+180,Hd);ctx.lineTo(x-60,Hd);ctx.fill()}}
 for(const c of clouds){const x=c.x*(Wd+300)-150,y=c.y*Hd+r*.08,q=c.s*sc;ctx.fillStyle=wd.cl;ctx.globalAlpha=.9;ctx.beginPath();
  [[0,0],[14,-14],[38,-24],[62,-12],[80,-20],[102,0]].forEach(([a,b],i)=>i?ctx.lineTo(x+a*q,y+b*q):ctx.moveTo(x+a*q,y+b*q));ctx.fill();
  ctx.globalAlpha=.35;ctx.fillStyle='#8aa5c7';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+102*q,y);ctx.lineTo(x+86*q,y+8*q);ctx.lineTo(x+16*q,y+8*q);ctx.fill();ctx.globalAlpha=1}
 wd.L.forEach((l,j)=>{const b=cy-(70-j*26)*kk+r*l.k;
  for(const p of pk[j]){const ax=p.x*sc+Wd/2-850*sc,ww=p.w*sc,hh=p.h*sc;if(ax+ww/2<0||ax-ww/2>Wd)continue;
   tri([ax-ww/2,b],[ax,b-hh],[ax,b],l.c[0]);tri([ax,b-hh],[ax+ww/2,b],[ax,b],l.c[1]);
   if(l.cap){const q=.36;tri([ax-ww*q/2,b-hh*(1-q)],[ax,b-hh],[ax,b-hh*(1-q)+hh*.05],l.cap[0]);tri([ax,b-hh],[ax+ww*q/2,b-hh*(1-q)],[ax,b-hh*(1-q)+hh*.05],l.cap[1])}}
  ctx.fillStyle=l.c[1];ctx.fillRect(0,b,Wd,Hd-b+2)});
 const fl=cy-34*kk+r*.6;
 if(wd.fx=='stars')disc(Wd/2,fl+Wd*1.1,Wd*1.1,44,wd.g[0],wd.g[1],.02);
 else{ctx.fillStyle=wd.g;ctx.fillRect(0,fl,Wd,Hd-fl+2);ctx.fillStyle='rgba(255,255,255,.14)';ctx.fillRect(0,fl,Wd,6*kk);if(wd.lava){ctx.fillStyle=wd.lava;ctx.fillRect(0,fl,Wd,7*kk)}}}
function box(b){const x0=b.x-b.w/2,x1=b.x+b.w/2,z0=b.z-b.d/2,z1=b.z+b.d/2,y0=b.y,y1=b.y+HH,h=wd.h0+b.i*wd.st,s=wd.s,l=wd.l+(b.f||0)*22;
 const A=pr(x0,z0,y1),B=pr(x1,z0,y1),C=pr(x1,z1,y1),D=pr(x0,z1,y1),E=pr(x0,z1,y0),F=pr(x1,z1,y0),G=pr(x1,z0,y0);
 tri(D,C,E,hsl(h,s,l-4));tri(C,F,E,hsl(h,s,l-9));tri(B,C,G,hsl(h,s,l-13));tri(C,F,G,hsl(h,s,l-18));
 tri(A,B,D,hsl(h,s,l+11));tri(B,C,D,hsl(h,s,l+6));
 ctx.strokeStyle='rgba(255,255,255,.3)';ctx.beginPath();ctx.moveTo(...D);ctx.lineTo(...C);ctx.lineTo(...B);ctx.stroke()}
function fxf(){const t=performance.now()/1000;for(const p of P){
 if(wd.fx=='snow'){ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillRect(p.x*Wd+Math.sin(t+p.a)*12,p.y*Hd,p.s*2.6,p.s*2.6)}
 else if(wd.fx=='ember'){ctx.fillStyle=`rgba(255,${120+p.s*50|0},40,${.4+.4*Math.sin(t*3+p.a)})`;ctx.fillRect(p.x*Wd+Math.sin(t+p.a)*14,p.y*Hd,p.s*3,p.s*3)}
 else if(wd.fx=='bubble'){ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x*Wd+Math.sin(t+p.a)*10,p.y*Hd,p.s*4,0,6.283);ctx.stroke()}}}
function draw(){
 ctx.save();if(shake>.4)ctx.translate(rnd(-shake,shake),rnd(-shake,shake));
 bg();const kk=k*Z,cx=Wd/2,cy=Hd*.62;pr=(x,z,y)=>[cx+(x-z)*.866*kk,cy+(x+z)*.5*kk-(y-cam)*kk];
 for(const b of blocks){const y=cy-(b.y-cam)*kk;if(y>-60*kk&&y<Hd+120*kk)box(b)}
 for(const d of debris)box(d);if(cur)box(cur);
 ctx.lineWidth=3;for(const r of rings){const e=1+r.t*.55,x0=r.x-r.w/2*e,x1=r.x+r.w/2*e,z0=r.z-r.d/2*e,z1=r.z+r.d/2*e,y=r.y+HH;
  ctx.strokeStyle=`rgba(255,255,255,${1-r.t})`;ctx.beginPath();[pr(x0,z0,y),pr(x1,z0,y),pr(x1,z1,y),pr(x0,z1,y)].forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.stroke()}
 fxf();ctx.restore()}
function loop(ts){const dt=Math.min(.033,(ts-lt)/1000||0);lt=ts;update(dt);draw();requestAnimationFrame(loop)}
cv.addEventListener('pointerdown',e=>{if(st==='play'){e.preventDefault();place()}},{passive:false});
$('ts-tap').addEventListener('pointerdown',e=>{e.preventDefault();if(st==='play')place()},{passive:false});
window.addEventListener('keydown',e=>{if(e.repeat)return;if(e.code=='Space'||e.code=='Enter'){e.preventDefault();if(st=='play')place();else if(performance.now()>tapOk&&$('ts-panel').style.display=='block')startGame()}});
$('ts-go').addEventListener('click',startGame);
function startTowerStackGame(){
  ui.style.display = 'block';
  rs();
  setWorld(WD[0]);demo();panel('menu');
  $('ts-title').style.display='block';
  $('ts-hud').style.display='none';
  $('ts-tap').style.display='none';
  requestAnimationFrame(loop);
}
window.startTowerStackGame = startTowerStackGame;

window._towerStackCleanup = function(){
  try { ui.style.display = 'none'; } catch(e) {}
};

})();
