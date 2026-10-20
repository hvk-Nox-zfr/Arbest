/* Arbest Drive – simulation de conduite 3D, monde ouvert (JS pur)
   Utilisation :  <script src="arbest-drive.js" data-autostart></script>
   ou             ArbestDrive.start(conteneur)  /  ArbestDrive.stop()            */
(function(){
'use strict';
const THREE_URL='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const lerp=(a,b,t)=>a+(b-a)*t,cl=(v,a,b)=>Math.max(a,Math.min(b,v)),sm=t=>{t=cl(t,0,1);return t*t*(3-2*t)};
const hs=(a,b,c)=>{const n=Math.sin(a*127.1+b*311.7+c*74.7)*43758.5453;return n-Math.floor(n)};
function noise(x,z){const xi=Math.floor(x),zi=Math.floor(z),u=sm(x-xi),v=sm(z-zi);
 return lerp(lerp(hs(xi,zi,0),hs(xi+1,zi,0),u),lerp(hs(xi,zi+1,0),hs(xi+1,zi+1,0),u),v)}

// ===== Monde : relief infini + 2 routes (nord-sud et est-ouest) =====
const WATER=-8;
const OX=3370685,OZ=-1771895,nz=(x,z,q)=>noise((x+OX)/q,(z+OZ)/q);
const baseH=(x,z)=>(nz(x,z,260)+nz(x,z,90)*.35+nz(x,z,30)*.08-.7)*38;
const H0=cl(baseH(0,0),2,10),cityW=(x,z)=>1-sm((Math.hypot(x,z)-760)/260);
const roadBase=(x,z)=>lerp(Math.max(-6.5,(nz(x,z,260)+nz(x,z,90)*.35-.7)*38),H0,cityW(x,z));
const cxz=z=>(Math.sin(z*.0035)*110+Math.sin(z*.0091)*35)*sm((Math.abs(z)-760)/300),czx=x=>(Math.sin(x*.0031)*90+Math.sin(x*.008)*30)*sm((Math.abs(x)-760)/300);
function H(x,z){let h=baseH(x,z);
 const wa=1-sm((Math.abs(x-cxz(z))-7)/14),wb=1-sm((Math.abs(z-czx(x))-7)/14);
 if(wa>=wb&&wa>0)h=lerp(h,roadBase(cxz(z),z),wa);else if(wb>0)h=lerp(h,roadBase(x,czx(x)),wb);return lerp(h,H0,cityW(x,z))}
const onRoad=(x,z)=>Math.abs(x-cxz(z))<5.5||Math.abs(z-czx(x))<5.5||(Math.abs(x)<555&&Math.abs(z)<555&&(Math.abs(x-Math.round(x/90)*90)<5.5||Math.abs(z-Math.round(z/90)*90)<5.5));
function surf(x,z){const h=H(x,z);
 if(h<WATER-.1)return{mu:.3,rr:12};if(onRoad(x,z))return{mu:1.15,rr:1};if(cityW(x,z)>.5)return{mu:.9,rr:2};if(h<-6)return{mu:.75,rr:2.5};return{mu:.65,rr:3.5}}

let running=null,ivr=0;
function load(cb){if(window.THREE)return cb();const s=document.createElement('script');s.src=THREE_URL;s.onload=cb;document.head.appendChild(s)}
// repère la zone de jeu de la page : canvas/conteneur donné, sinon le plus grand canvas visible
function findHost(a){if(typeof a==='string')a=document.querySelector(a);if(a&&a.nodeType===1)return a;
 let best=null,ba=0;document.querySelectorAll('canvas').forEach(c=>{if(c.closest('#ad-root'))return;const r=c.getBoundingClientRect();
  if(getComputedStyle(c).position==='fixed'||r.width<250||r.height<150)return;if(r.width*r.height>ba){ba=r.width*r.height;best=c}});return best}
function start(a){load(()=>{const go=()=>{if(running)return true;const h=findHost(a);if(!h)return false;running=boot(h);return true};
 if(go())return;let n=0;ivr=setInterval(()=>{if(go()||++n>60)clearInterval(ivr)},250)})}
function stop(){clearInterval(ivr);if(running){running();running=null}}
window.ArbestDrive={start,stop};
// Branchement sur main.js : initFn du registre + nettoyage appelé par stopAllGames()
window.startBeamDrive=()=>start('#game-canvas');
window._beamCleanup=stop;

function boot(host){
const off=[],on=(t,e,f)=>{t.addEventListener(e,f);off.push(()=>t.removeEventListener(e,f))};
const css=document.createElement('style');css.textContent=`
#ad-root{position:relative;overflow:hidden;background:#000;touch-action:none;font-family:system-ui,sans-serif;-webkit-user-select:none;user-select:none}
#ad-root:fullscreen{width:100%!important;height:100%!important;border:0!important;border-radius:0!important}
#ad-root:-webkit-full-screen{width:100%!important;height:100%!important;border:0!important;border-radius:0!important}
#ad-root canvas{display:block;filter:contrast(1.06) saturate(1.12)}
#ad-menu{position:absolute;left:0;right:0;bottom:0;padding:14px;background:linear-gradient(transparent,#000e 35%);color:#fff;display:flex;justify-content:center}
#ad-menu .mc{width:100%;max-width:520px;text-align:center}
#ad-menu .mh{display:flex;align-items:center;justify-content:space-between;gap:10px}
#ad-menu button{background:#0008;color:#fff;border:2px solid #4cf8;border-radius:8px;padding:8px 14px;font-size:18px;cursor:pointer}
#ad-cn{font-size:20px;font-weight:700}#ad-cy{font-size:12px;opacity:.8}
.r{display:flex;align-items:center;gap:8px;font-size:12px;margin:4px 0}.r span{width:86px;text-align:left}.r i{flex:1;height:6px;background:#fff2;border-radius:3px;overflow:hidden}.r b{display:block;height:100%;background:linear-gradient(90deg,#4cf,#fc3)}.r em{width:84px;text-align:right;font-style:normal}
#ad-co u{display:inline-block;width:22px;height:22px;border-radius:50%;margin:6px 4px;border:2px solid #fff8;cursor:pointer}
#ad-go{width:100%;margin-top:4px;background:#1a8fb5!important;font-weight:700;letter-spacing:2px}
#ad-vg{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.45))}
#ad-hud{position:absolute;left:0;right:0;bottom:14px;display:flex;justify-content:center;align-items:flex-end;gap:22px;color:#fff;pointer-events:none;text-shadow:0 0 6px #000}
#ad-spd{font-size:46px;font-weight:700}#ad-hud small{font-size:13px;margin-left:4px}
#ad-gr{font-size:34px;font-weight:700;color:#ffb020}
#ad-rb{width:150px;height:10px;background:#0008;border-radius:5px;overflow:hidden;margin-bottom:8px}
#ad-rbf{display:block;height:100%;width:0;background:linear-gradient(90deg,#4cf,#fc3,#f33)}
#ad-dm{font-size:14px;margin-bottom:6px}
#ad-help{position:absolute;top:10px;left:12px;color:#fff;font-size:12px;opacity:.85;text-shadow:0 0 4px #000;line-height:1.5}
#ad-root .b{position:absolute;top:10px;font-size:20px;background:#0007;color:#fff;border:0;border-radius:8px;padding:6px 10px}
#ad-tc{display:none;position:absolute;left:0;right:0;bottom:0;padding:0 14px 70px;justify-content:space-between;pointer-events:none}
#ad-tc div{display:flex;gap:10px;pointer-events:auto}
#ad-tc button{width:70px;height:70px;border-radius:50%;border:2px solid #fff6;background:#0006;color:#fff;font-size:22px;touch-action:none}
@media (pointer:coarse){#ad-tc{display:flex}#ad-help{display:none}}`;
document.head.appendChild(css);
const root=document.createElement('div');root.id='ad-root';
root.innerHTML='<div id="ad-vg"></div><div id="ad-hud"><div><b id="ad-spd">0</b><small>km/h</small></div><div id="ad-gr">N</div><div><div id="ad-rb"><i id="ad-rbf"></i></div><div id="ad-dm"></div></div></div><div id="ad-help">Z/↑ accélérer · S/↓ frein/marche arrière · Q D/←→ direction<br>Espace frein à main · C caméra · R reset · F plein écran<br>Monde ouvert : roule où tu veux !</div><button class="b" id="ad-fs" style="right:12px">⛶</button><button class="b" id="ad-gb" style="right:62px">🚗</button><div id="ad-menu"><div class="mc"><div class="mh"><button id="ad-pv">◀</button><div><div id="ad-cn"></div><div id="ad-cy"></div></div><button id="ad-nx">▶</button></div><div id="ad-sp"></div><div id="ad-co"></div><button id="ad-go">CONDUIRE</button></div></div><div id="ad-tc"><div><button data-k="l">◀</button><button data-k="r">▶</button></div><div><button data-k="h">HB</button><button data-k="b">■</button><button data-k="g">▲</button></div></div>';
const isCv=host.tagName==='CANVAS',hr=host.getBoundingClientRect(),hDisp=host.style.display;
if(isCv){const cs=getComputedStyle(host);root.style.cssText+=';box-sizing:border-box;width:'+hr.width+'px;height:'+hr.height+'px;border:'+cs.border+';border-radius:'+cs.borderRadius+';box-shadow:'+cs.boxShadow;host.parentNode.insertBefore(root,host);host.style.display='none'}
else{root.style.width='100%';root.style.height=(host.clientHeight||560)+'px';host.appendChild(root)}
const $=id=>root.querySelector('#ad-'+id);

// ===== Rendu =====
const ren=new THREE.WebGLRenderer({antialias:true});
ren.setPixelRatio(Math.min(devicePixelRatio,2));ren.setSize(innerWidth,innerHeight);
ren.shadowMap.enabled=true;ren.shadowMap.type=THREE.PCFSoftShadowMap;
ren.toneMapping=THREE.ACESFilmicToneMapping;ren.toneMappingExposure=.95;ren.outputEncoding=THREE.sRGBEncoding;
root.insertBefore(ren.domElement,root.firstChild);
const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,900);
const resize=()=>{const w=root.clientWidth||innerWidth,h=root.clientHeight||innerHeight;ren.setSize(w,h);cam.aspect=w/h;cam.updateProjectionMatrix()};
resize();on(window,'resize',resize);on(document,'fullscreenchange',resize);if(window.ResizeObserver){const ro=new ResizeObserver(resize);ro.observe(root);off.push(()=>ro.disconnect())}
function ctex(w,h,fn,rep){const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;if(rep)t.wrapS=t.wrapT=THREE.RepeatWrapping;return t}
// ciel + reflets
const skyT=ctex(1024,512,(g)=>{const gr=g.createLinearGradient(0,0,0,512);gr.addColorStop(0,'#2d5fa8');gr.addColorStop(.45,'#9cc6ee');gr.addColorStop(.5,'#cfd8dc');gr.addColorStop(.52,'#8a9078');gr.addColorStop(1,'#4a5040');
 g.fillStyle=gr;g.fillRect(0,0,1024,512);for(let i=0;i<40;i++){g.fillStyle='rgba(255,255,255,.18)';g.beginPath();g.ellipse(Math.random()*1024,40+Math.random()*150,40+Math.random()*90,8+Math.random()*14,0,0,7);g.fill()}
 const s=g.createRadialGradient(600,113,2,600,113,110);s.addColorStop(0,'#fff');s.addColorStop(.12,'rgba(255,250,230,.95)');s.addColorStop(1,'rgba(255,240,200,0)');g.fillStyle=s;g.fillRect(480,0,240,240)});
skyT.mapping=THREE.EquirectangularReflectionMapping;
scene.environment=new THREE.PMREMGenerator(ren).fromEquirectangular(skyT).texture;scene.background=skyT;
scene.fog=new THREE.Fog(0xc6d3de,90,420);
scene.add(new THREE.HemisphereLight(0xcfe3ff,0x5a6a40,.6));
const sun=new THREE.DirectionalLight(0xfff0d8,2.4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,near:1,far:160});sun.shadow.bias=-.0004;sun.shadow.normalBias=.05;
scene.add(sun,sun.target);

// ===== Terrain infini (recentré sur la voiture) =====
const TS=200,CELL=4,SNAP=8;
const tg=new THREE.PlaneGeometry(TS*CELL,TS*CELL,TS,TS).rotateX(-Math.PI/2);
const NV=tg.attributes.position.count,hA=new Float32Array(NV);
tg.setAttribute('color',new THREE.BufferAttribute(new Float32Array(NV*3),3));
const detail=ctex(256,256,(g,w,h)=>{g.fillStyle='#c4c4c4';g.fillRect(0,0,w,h);for(let i=0;i<9000;i++){const v=120+Math.random()*135|0;g.fillStyle=`rgb(${v},${v},${v})`;g.fillRect(Math.random()*w,Math.random()*h,1+Math.random(),2+Math.random()*7)}},1);
detail.repeat.set(100,100);
const terrain=new THREE.Mesh(tg,new THREE.MeshStandardMaterial({vertexColors:true,map:detail,bumpMap:detail,bumpScale:.5,roughness:.95}));
terrain.receiveShadow=true;terrain.frustumCulled=false;scene.add(terrain);
const wTex=ctex(128,128,(g,w,h)=>{g.fillStyle='#888';g.fillRect(0,0,w,h);for(let i=0;i<900;i++){const v=Math.random()*255|0;g.fillStyle=`rgb(${v},${v},${v})`;g.beginPath();g.arc(Math.random()*w,Math.random()*h,3+Math.random()*8,0,7);g.fill()}},1);wTex.repeat.set(150,150);
const water=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:0x1f6f8f,roughness:.08,metalness:.2,bumpMap:wTex,bumpScale:.5,transparent:true,opacity:.82}));
water.position.y=WATER;scene.add(water);
// routes (rubans qui suivent le relief)
const roadT=ctex(128,256,(g,w,h)=>{g.fillStyle='#2e2e32';g.fillRect(0,0,w,h);for(let i=0;i<5000;i++){const v=30+Math.random()*40|0;g.fillStyle=`rgb(${v},${v},${v+3})`;g.fillRect(Math.random()*w,Math.random()*h,2,2)}
 g.fillStyle='rgba(0,0,0,.28)';g.fillRect(30,0,16,h);g.fillRect(w-46,0,16,h);
 for(let i=0;i<14;i++){g.strokeStyle='rgba(15,15,15,.7)';g.beginPath();let x=Math.random()*w,y=Math.random()*h;g.moveTo(x,y);for(let k=0;k<6;k++){x+=Math.random()*14-7;y+=Math.random()*12;g.lineTo(x,y)}g.stroke()}
 g.fillStyle='#ddd';g.fillRect(8,0,3,h);g.fillRect(w-11,0,3,h);g.fillStyle='#e8c020';g.fillRect(w/2-2,0,4,h/2)},1);
const roadM=new THREE.MeshStandardMaterial({map:roadT,roughness:.8,bumpMap:roadT,bumpScale:.3,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
const RN=200;
function ribbon(ns){const g=new THREE.BufferGeometry(),uv=new Float32Array((RN+1)*4),nr=new Float32Array((RN+1)*6),ix=[];
 for(let i=0;i<=RN;i++){nr[i*6+1]=nr[i*6+4]=1;uv[i*4]=0;uv[i*4+2]=1}
 for(let i=0;i<RN;i++){const a=i*2;ns?ix.push(a,a+2,a+1,a+1,a+2,a+3):ix.push(a,a+1,a+2,a+1,a+3,a+2)}
 g.setAttribute('position',new THREE.BufferAttribute(new Float32Array((RN+1)*6),3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setAttribute('normal',new THREE.BufferAttribute(nr,3));g.setIndex(ix);
 const m=new THREE.Mesh(g,roadM);m.frustumCulled=false;m.receiveShadow=true;scene.add(m);return m}
const roadNS=ribbon(1),roadEW=ribbon(0);
function fillRoad(m,ns,c0){const p=m.geometry.attributes.position.array,uv=m.geometry.attributes.uv.array,s0=Math.round(c0/CELL)*CELL-RN/2*CELL;
 for(let i=0;i<=RN;i++){const t=s0+i*CELL,k=i*6;
  if(ns){const c=cxz(t),y=roadBase(c,t)+.06;p[k]=c-5.5;p[k+1]=y;p[k+2]=t;p[k+3]=c+5.5;p[k+4]=y;p[k+5]=t}
  else{const c=czx(t),y=roadBase(t,c)+.08;p[k]=t;p[k+1]=y;p[k+2]=c-5.5;p[k+3]=t;p[k+4]=y;p[k+5]=c+5.5}
  uv[i*4+1]=uv[i*4+3]=t/16}
 m.geometry.attributes.position.needsUpdate=true;m.geometry.attributes.uv.needsUpdate=true}
// arbres + rochers (instanciés, générés par cellule de 24 m)
const CS=24,cellMap=new Map();
function cellObjs(i,j){const key=(i+5e4)*1e5+j+5e4;let o=cellMap.get(key);if(o)return o;o=[];
 for(let n=0;n<3;n++){const x=i*CS+hs(i,j,n+1)*CS,z=j*CS+hs(i,j,n+9)*CS;
  if(Math.abs(x-cxz(z))<13||Math.abs(z-czx(x))<13||cityW(x,z)>.02)continue;const y=H(x,z);if(y<-6.2||y>24)continue;
  const f=hs(i,j,n+20),d=cl((noise(x/150,z/150)-.35)*3.5,0,1);
  if(f<d*.9)o.push({x,z,y,t:0,r:.5,s:.8+hs(i,j,n+30)*.9,v:hs(i,j,n+60)});
  else if(f>.93){const r=1+hs(i,j,n+40)*2;o.push({x,z,y,t:1,r,s:r,rot:hs(i,j,n+50)*6})}}
 if(cellMap.size>6000)cellMap.clear();cellMap.set(key,o);return o}
const MT=2600,MR=500;
const blob=(r,sy)=>{const g=new THREE.SphereGeometry(r,16,12),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=1+.2*Math.sin(x*3.1+z*2.3)*Math.cos(y*2.7+x)+.1*Math.sin(z*5.3+y*4.1);p.setXYZ(i,x*n,y*n*sy,z*n)}g.computeVertexNormals();return g};
const inst=(g,col,n,sh)=>{const m=new THREE.InstancedMesh(g,new THREE.MeshStandardMaterial({color:col,roughness:.9,flatShading:g.type=='DodecahedronGeometry'}),n);m.castShadow=!!sh;m.receiveShadow=true;m.frustumCulled=false;m.count=0;scene.add(m);return m};
const iTrunk=inst(new THREE.CylinderGeometry(.22,.34,3,6),0x5a3d24,MT,0),iC1=inst(blob(2.1,.85),0xffffff,MT,1),iC2=inst(blob(1.4,.9),0xffffff,MT,1),iRock=inst(new THREE.DodecahedronGeometry(1,0),0x84827c,MR,1);
const D=new THREE.Object3D(),cc=new THREE.Color();
let tcx=1e9,tcz=1e9;
function refresh(px,pz){
 if(Math.hypot(px-tcx,pz-tcz)<40)return;
 const ox=Math.round(px/SNAP)*SNAP,oz=Math.round(pz/SNAP)*SNAP;tcx=ox;tcz=oz;
 terrain.position.set(ox,0,oz);
 const p=tg.attributes.position,col=tg.attributes.color,W=TS+1;
 for(let i=0;i<NV;i++){const h=H(p.getX(i)+ox,p.getZ(i)+oz);hA[i]=h;p.setY(i,h)}
 for(let i=0;i<NV;i++){const x=p.getX(i)+ox,z=p.getZ(i)+oz,h=hA[i],ix=i%W,iz=(i/W)|0;
  const dx=(hA[iz*W+Math.min(W-1,ix+1)]-hA[iz*W+Math.max(0,ix-1)])/(2*CELL),dz=(hA[Math.min(W-1,iz+1)*W+ix]-hA[Math.max(0,iz-1)*W+ix])/(2*CELL),sl=Math.hypot(dx,dz);
  const n=noise(x/18,z/18),n2=noise(x/5,z/5);let r=.2+.1*n+.03*n2,g=.36+.13*n+.04*n2,b=.12+.04*n;
  if(h<-5){const k=sm((h+5.4)/-1.2);r=lerp(r,.74,k);g=lerp(g,.68,k);b=lerp(b,.48,k)}
  if(h>16){const k=sm((h-16)/6);r=lerp(r,.9,k);g=lerp(g,.92,k);b=lerp(b,.95,k)}
  const rk=sm((sl-.5)/.35);r=lerp(r,.42,rk);g=lerp(g,.4,rk);b=lerp(b,.37,rk);
  col.setXYZ(i,r,g,b)}
 p.needsUpdate=true;col.needsUpdate=true;tg.computeVertexNormals();
 fillRoad(roadNS,1,pz);fillRoad(roadEW,0,px);
 let nt=0,nr=0;const i0=Math.floor((ox-340)/CS),i1=Math.ceil((ox+340)/CS),j0=Math.floor((oz-340)/CS),j1=Math.ceil((oz+340)/CS);
 for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++)for(const o of cellObjs(i,j)){
  if(o.t==0&&nt<MT){D.rotation.set(0,0,0);D.scale.set(o.s,o.s,o.s);
   D.position.set(o.x,o.y+1.5*o.s,o.z);D.updateMatrix();iTrunk.setMatrixAt(nt,D.matrix);
   D.position.y=o.y+4*o.s;D.updateMatrix();iC1.setMatrixAt(nt,D.matrix);D.position.y=o.y+5.3*o.s;D.updateMatrix();iC2.setMatrixAt(nt,D.matrix);
   cc.setHSL(.22+o.v*.1,.45,.17+o.v*.12);iC1.setColorAt(nt,cc);iC2.setColorAt(nt,cc);nt++}
  else if(o.t==1&&nr<MR){D.position.set(o.x,o.y+o.s*.3,o.z);D.rotation.set(o.rot,o.rot*2,0);D.scale.set(o.s*1.2,o.s*.8,o.s);D.updateMatrix();iRock.setMatrixAt(nr++,D.matrix)}}
 iTrunk.count=iC1.count=iC2.count=nt;iRock.count=nr;
 for(const m of [iTrunk,iC1,iC2,iRock]){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}
}

// ===== Ville : grille de rues, tours, immeubles, quartier pavillonnaire =====
const bxMap=new Map();
function boxesNear(x,z){const i=Math.floor(x/90),j=Math.floor(z/90),o=[];for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const l=bxMap.get((i+a)*100+j+b);if(l)for(const q of l)o.push(q)}return o}
(function city(){
 const M=(map,ro,me)=>new THREE.MeshStandardMaterial({map,vertexColors:true,roughness:ro,metalness:me||0});
 const plain=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85});
 // ---------- textures détaillées ----------
 const haus=aw=>ctex(128,512,(g,w,h)=>{
  g.fillStyle='#e0d4ba';g.fillRect(0,0,w,h);g.fillStyle='#eee5d0';g.fillRect(0,0,w,17);g.fillStyle='#b5a88c';g.fillRect(0,17,w,3);
  for(const y of [99,179,259,339]){g.fillStyle='#c8bca2';g.fillRect(0,y,w,3)}
  const win=(y,hh,ww)=>{const x=(w-ww)/2;g.fillStyle='#f3efe4';g.fillRect(x-4,y-5,ww+8,hh+8);const gr=g.createLinearGradient(0,y,0,y+hh);gr.addColorStop(0,'#6d8294');gr.addColorStop(1,'#1c2833');g.fillStyle=gr;g.fillRect(x,y,ww,hh);g.fillStyle='#f3efe4';g.fillRect(x+ww/2-1.5,y,3,hh);g.fillRect(x,y+hh*.33,ww,3)};
  const bal=y=>{g.fillStyle='#cfc3a8';g.fillRect(0,y,w,5);g.fillStyle='#202226';g.fillRect(0,y+5,w,2.5);for(let x=3;x<w;x+=7)g.fillRect(x,y+7,1.5,13);g.fillRect(0,y+20,w,2.5)};
  win(32,54,50);bal(88);win(112,54,46);win(192,54,46);win(270,58,50);bal(330);win(350,32,40);
  g.fillStyle='#d0c4a8';g.fillRect(0,390,w,122);for(let y=392;y<512;y+=14){g.fillStyle='#b3a78c';g.fillRect(0,y,w,1.5)}
  g.fillStyle='#d8ceb4';g.fillRect(0,390,7,122);g.fillRect(w-7,390,7,122);
  g.fillStyle='#1b2530';g.fillRect(12,424,w-24,74);g.fillStyle='#8aa0b0';g.fillRect(12,424,w-24,10);g.fillStyle='#2b3744';g.fillRect(w/2-1.5,424,3,74);
  for(let x=10;x<w-10;x+=12){g.fillStyle=((x/12)|0)%2?'#f2f2f2':aw;g.fillRect(x,398,12,24)}
  g.fillStyle='#9b8f76';g.fillRect(0,500,w,12)},1);
 const zinc=ctex(128,128,(g,w,h)=>{g.fillStyle='#6f7a86';g.fillRect(0,0,w,h);g.fillStyle='#5f6a76';for(let x=0;x<w;x+=16)g.fillRect(x,0,2,h);
  g.fillStyle='#f0ece2';g.fillRect(40,34,48,62);g.fillStyle='#202a34';g.fillRect(46,44,36,48);g.fillStyle='#f0ece2';g.fillRect(63,44,2.5,48);
  g.beginPath();g.moveTo(34,36);g.lineTo(64,14);g.lineTo(94,36);g.closePath();g.fillStyle='#8b96a2';g.fill();g.strokeStyle='#f0ece2';g.lineWidth=3;g.stroke()},1);
 const brick=ctex(64,64,(g,w,h)=>{g.fillStyle='#9a5b47';g.fillRect(0,0,w,h);g.fillStyle='#cdbba8';for(let y=0;y<h;y+=4)g.fillRect(0,y,w,1);for(let y=0,k=0;y<h;y+=4,k++)for(let x=(k%2)*5;x<w;x+=10)g.fillRect(x,y,1,4);
  g.fillStyle='#f0ece2';g.fillRect(17,13,30,38);g.fillStyle='#1f2b36';g.fillRect(20,16,24,32);g.fillStyle='#f0ece2';g.fillRect(31,16,2,32);g.fillRect(14,51,36,3)},1);
 const house=ctex(128,128,(g,w,h)=>{g.fillStyle='#efe8d6';g.fillRect(0,0,w,h);
  for(const y of [8,72]){g.fillStyle='#5f7f6a';g.fillRect(28,y,14,46);g.fillRect(86,y,14,46);g.fillStyle='#f6f2e8';g.fillRect(44,y,40,46);g.fillStyle='#1f2b36';g.fillRect(47,y+3,34,40);g.fillStyle='#f6f2e8';g.fillRect(63,y+3,2,40);g.fillRect(44,y+46,40,3)}
  g.fillStyle='#bdb39c';g.fillRect(0,120,w,8)},1);
 const tile=ctex(64,64,(g,w,h)=>{g.fillStyle='#cfcfcf';g.fillRect(0,0,w,h);for(let y=0,k=0;y<h;y+=8,k++){g.fillStyle='#8f8f8f';g.fillRect(0,y,w,2);for(let x=(k%2)*8;x<w;x+=16){g.fillStyle='#b4b4b4';g.fillRect(x,y,1.5,8)}}},1);
 const glassT=ctex(64,64,(g,w,h)=>{g.fillStyle='#6f8aa0';g.fillRect(0,0,w,h);g.fillStyle='#16202c';g.fillRect(12,13,40,38);g.fillStyle='rgba(255,255,255,.2)';g.fillRect(12,13,40,8);g.fillStyle='#4d6377';g.fillRect(0,h-4,w,4)},1);
 const mats={p0:M(haus('#b02a2a'),.8),p1:M(haus('#2c6a3c'),.8),p2:M(haus('#23407a'),.8),z:M(zinc,.45,.35),k:M(tile,.8),b:M(brick,.85),h:M(house,.85),t:M(glassT,.22,.55),r:plain,g:plain,S:roadM};
 const B={};for(const k in mats)B[k]={p:[],u:[],c:[]};
 const Q=(k,P,U,c)=>{const b=B[k];for(const i of [0,1,2,0,2,3]){b.p.push(...P[i]);b.u.push(...(U?U[i]:[0,0]));b.c.push(...c)}};
 const wall=(k,x0,x1,z0,z1,y0,y1,bw,fh,c)=>{const V=(y1-y0)/fh,X=(x1-x0)/bw,Z=(z1-z0)/bw;
  Q(k,[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],[[0,0],[X,0],[X,V],[0,V]],c);
  Q(k,[[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]],[[0,0],[X,0],[X,V],[0,V]],c);
  Q(k,[[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]],[[0,0],[Z,0],[Z,V],[0,V]],c);
  Q(k,[[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]],[[0,0],[Z,0],[Z,V],[0,V]],c)};
 const flat=(x0,x1,z0,z1,y,c)=>Q('r',[[x0,y,z1],[x1,y,z1],[x1,y,z0],[x0,y,z0]],null,c);
 const box=(x0,x1,z0,z1,y0,y1,c)=>{wall('g',x0,x1,z0,z1,y0,y1,1e9,1e9,c);flat(x0,x1,z0,z1,y1,c)};
 // tronc de pyramide (mansardes, pylônes) ; dx,dz = décalage du sommet
 const frus=(k,cx,cz,a0,d0,a1,d1,ya,yb,c,bw,bh,dx,dz)=>{dx=dx||0;dz=dz||0;const tx=cx+dx,tz=cz+dz,V=(yb-ya)/bh,X=2*a0/bw,Z=2*d0/bw;
  Q(k,[[cx-a0,ya,cz+d0],[cx+a0,ya,cz+d0],[tx+a1,yb,tz+d1],[tx-a1,yb,tz+d1]],[[0,0],[X,0],[X,V],[0,V]],c);
  Q(k,[[cx+a0,ya,cz-d0],[cx-a0,ya,cz-d0],[tx-a1,yb,tz-d1],[tx+a1,yb,tz-d1]],[[0,0],[X,0],[X,V],[0,V]],c);
  Q(k,[[cx+a0,ya,cz+d0],[cx+a0,ya,cz-d0],[tx+a1,yb,tz-d1],[tx+a1,yb,tz+d1]],[[0,0],[Z,0],[Z,V],[0,V]],c);
  Q(k,[[cx-a0,ya,cz-d0],[cx-a0,ya,cz+d0],[tx-a1,yb,tz+d1],[tx-a1,yb,tz-d1]],[[0,0],[Z,0],[Z,V],[0,V]],c);
  Q(k=='g'?'g':'r',[[tx-a1,yb,tz+d1],[tx+a1,yb,tz+d1],[tx+a1,yb,tz-d1],[tx-a1,yb,tz-d1]],null,c)};
 const gable=(x0,x1,z0,z1,y,hr,c,c2)=>{const zm=(z0+z1)/2,yr=y+hr,U=(x1-x0)/1.5,V=Math.hypot(hr,(z1-z0)/2)/1.2,uv=[[0,0],[U,0],[U,V],[0,V]];
  Q('k',[[x0,y,z1],[x1,y,z1],[x1,yr,zm],[x0,yr,zm]],uv,c);Q('k',[[x1,y,z0],[x0,y,z0],[x0,yr,zm],[x1,yr,zm]],uv,c);
  Q('r',[[x1,y,z1],[x1,y,z0],[x1,yr,zm],[x1,yr,zm]],null,c2);Q('r',[[x0,y,z0],[x0,y,z1],[x0,yr,zm],[x0,yr,zm]],null,c2)};
 const TT=[],LL=[],extra=[];
 for(let i=-6;i<6;i++)for(let j=-6;j<6;j++)bxMap.set(i*100+j,[]);
 const tree=(x,z,s)=>{TT.push([x,z,s]);const l=bxMap.get(Math.floor(x/90)*100+Math.floor(z/90));if(l)l.push([x-.35,x+.35,z-.35,z+.35])};
 const y0=H0+.1,HEDGE=[.17,.36,.13],GRAY=[.55,.55,.57];
 // ---------- immeuble haussmannien : calcaire, balcons filants, mansarde zinc, lucarnes, cheminées ----------
 const hauss=(i,j,x0,x1,z0,z1,bl)=>{const k='p'+((hs(i,j,x0)*3)|0),Hw=20.2,cx=(x1+x0)/2,cz=(z1+z0)/2,a=(x1-x0)/2,d=(z1-z0)/2,ins=2.4,t=.96+.04*hs(i,j,z0);
  wall(k,x0,x1,z0,z1,y0,y0+Hw,4,Hw,[t,t,t]);
  frus('z',cx,cz,a,d,a-ins,d-ins,y0+Hw,y0+Hw+3.4,[1,1,1],4,3.4);
  const n=Math.max(2,Math.round(Math.max(a,d)/9));
  for(let q=0;q<n;q++){const u=(q+.5)/n,px=a>d?x0+ins+(x1-x0-2*ins)*u:cx,pz=a>d?cz:z0+ins+(z1-z0-2*ins)*u;box(px-.55,px+.55,pz-.45,pz+.45,y0+Hw+3.4,y0+Hw+6.2,[.55,.3,.22]);box(px-.65,px+.65,pz-.55,pz+.55,y0+Hw+6.2,y0+Hw+6.5,[.3,.3,.3])}
  bl.push([x0,x1,z0,z1])};
 // ---------- parc / jardin public ----------
 const park=(x0,z0,fount)=>{const m=x0+36,n=z0+36,beige=[.78,.72,.58];
  flat(x0,x0+72,n-2,n+2,y0+.02,beige);flat(m-2,m+2,z0,z0+72,y0+.02,beige);
  for(const [a,b,c] of [[8,8,[.8,.15,.2]],[56,8,[.95,.8,.2]],[8,56,[.6,.3,.7]],[56,56,[.95,.5,.7]],[24,24,[.9,.4,.6]],[40,40,[.95,.85,.3]]])flat(x0+a,x0+a+8,z0+b,z0+b+8,y0+.03,c);
  box(x0,x0+72,z0,z0+1,y0,y0+.9,HEDGE);box(x0,x0+72,z0+71,z0+72,y0,y0+.9,HEDGE);box(x0,x0+1,z0,z0+72,y0,y0+.9,HEDGE);box(x0+71,x0+72,z0,z0+72,y0,y0+.9,HEDGE);
  for(let q=0;q<5;q++)for(const s of [-1,1]){const p=x0+10+q*13;if(Math.hypot(p-m,n+s*6-n)>9)tree(p,n+s*6,.9+hs(q,s,5)*.4);if(Math.hypot(m+s*6-m,z0+10+q*13-n)>9)tree(m+s*6,z0+10+q*13,.9+hs(q,s,6)*.4)}
  for(const [bx,bz] of [[x0+20,n+3.5],[x0+52,n-3.5],[m+3.5,z0+20],[m-3.5,z0+52]])box(bx-.9,bx+.9,bz-.25,bz+.25,y0,y0+.5,[.4,.28,.15]);
  if(fount){const mt=new THREE.MeshStandardMaterial({color:0x9a9a96,roughness:.8}),wt=new THREE.MeshStandardMaterial({color:0x2d7fa6,roughness:.05,metalness:.3,transparent:true,opacity:.85});
   const add=(g,mm,y)=>{const o=new THREE.Mesh(g,mm);o.position.set(m,y,n);scene.add(o)};
   add(new THREE.CylinderGeometry(6.2,6.6,.7,24),mt,y0+.35);add(new THREE.CylinderGeometry(5.7,5.7,.6,24),wt,y0+.5);add(new THREE.CylinderGeometry(.5,.9,2.4,10),mt,y0+1.3);add(new THREE.CylinderGeometry(.12,.3,3.6,8),new THREE.MeshStandardMaterial({color:0xbfe6f5,transparent:true,opacity:.6}),y0+3)}};
 // ---------- tour Eiffel (version stylisée) ----------
 const eiffel=(cx,cz,bl)=>{const c=[.3,.23,.18];
  for(const sx of [-1,1])for(const sz of [-1,1]){
   frus('g',cx+sx*24,cz+sz*24,4.5,4.5,3,3,y0,y0+57,c,1e9,1e9,-sx*9,-sz*9);
   frus('g',cx+sx*14,cz+sz*14,2.6,2.6,1.8,1.8,y0+60,y0+115,c,1e9,1e9,-sx*9,-sz*9);
   bl.push([cx+sx*24-4.5,cx+sx*24+4.5,cz+sz*24-4.5,cz+sz*24+4.5])}
  for(const s of [-1,1]){box(cx-24,cx+24,cz+s*24-1,cz+s*24+1,y0+17,y0+21,c);box(cx+s*24-1,cx+s*24+1,cz-24,cz+24,y0+17,y0+21,c)}
  box(cx-18,cx+18,cz-18,cz+18,y0+57,y0+61,c);box(cx-8,cx+8,cz-8,cz+8,y0+115,y0+119,c);
  frus('g',cx,cz,4,4,1.6,1.6,y0+119,y0+165,c,1e9,1e9);box(cx-3,cx+3,cz-3,cz+3,y0+165,y0+167,c);frus('g',cx,cz,.6,.6,.1,.1,y0+167,y0+190,c,1e9,1e9)};
 // ---------- pavillon de banlieue : volets, toit de tuiles, cheminée, jardin, haie, allée, arbre ----------
 const pav=(i,j,k,lx,lz,bl)=>{const w=9+hs(i,j,k+1)*4,d=8+hs(i,j,k+2)*3,hx=lx+2+hs(i,j,k+3)*(20-w),hz=lz+4+hs(i,j,k+4)*(18-d),rn=hs(i,j,k+5),
   wc=[.94+.06*rn,.92+.04*rn,.86+.1*rn],rc=rn<.5?[.62,.3,.2]:[.3,.32,.36];
  wall('h',hx,hx+w,hz,hz+d,y0,y0+5.6,4,5.6,wc);gable(hx-.4,hx+w+.4,hz-.4,hz+d+.4,y0+5.6,2.6,rc,wc);
  box(hx+w*.7-.4,hx+w*.7+.4,hz+d/2-.4,hz+d/2+.4,y0+6.8,y0+8.6,[.55,.3,.22]);
  box(lx+.5,lx+23.5,lz+.3,lz+.9,y0,y0+1,HEDGE);box(lx+.5,lx+23.5,lz+23.1,lz+23.7,y0,y0+1,HEDGE);box(lx+.3,lx+.9,lz+.5,lz+23.5,y0,y0+1,HEDGE);box(lx+23.1,lx+23.7,lz+.5,lz+23.5,y0,y0+1,HEDGE);
  flat(hx+w/2-.7,hx+w/2+.7,hz+d,lz+23,y0+.03,[.8,.74,.6]);
  if(hs(i,j,k+6)<.7)tree(lx+4+hs(i,j,k+7)*16,(hz+d+lz+23)/2,.8+hs(i,j,k+8)*.5);
  bl.push([hx,hx+w,hz,hz+d])};
 // ---------- plan de la ville ----------
 for(let i=-6;i<6;i++)for(let j=-6;j<6;j++){
  const x0=i*90+9,z0=j*90+9,rr=Math.hypot(i*90+45,j*90+45),bl=bxMap.get(i*100+j);
  const eif=i==0&&j==0,biz=!eif&&i>=3&&rr<420,prk=!eif&&!biz&&rr<330&&hs(i,j,7)<.2,hau=!eif&&!biz&&!prk&&rr<330,brk=!eif&&!biz&&!prk&&!hau&&rr<430;
  const lawn=eif||prk||!(hau||brk||biz);
  Q('g',[[x0,y0,z0+72],[x0+72,y0,z0+72],[x0+72,y0,z0],[x0,y0,z0]],null,lawn?[.3,.5,.22]:GRAY);
  if(eif){park(x0,z0,0);eiffel(x0+36,z0+36,bl)}
  else if(prk)park(x0,z0,1);
  else if(hau){const D=13;hauss(i,j,x0,x0+72,z0,z0+D,bl);hauss(i,j,x0,x0+72,z0+72-D,z0+72,bl);hauss(i,j,x0,x0+D,z0+D,z0+72-D,bl);hauss(i,j,x0+72-D,x0+72,z0+D,z0+72-D,bl);
   flat(x0+D,x0+72-D,z0+D,z0+72-D,y0+.02,[.5,.5,.45]);for(const [a,b] of [[22,22],[50,22],[22,50],[50,50]])tree(x0+a,z0+b,1+hs(i,j,a+b)*.3)}
  else if(brk){const D=12,fl=5+((hs(i,j,3)*4)|0),h=fl*3.2,tn=[.95,.9+.1*hs(i,j,4),.85+.15*hs(i,j,5)];
   for(const [a,b,c,d] of [[0,0,72,D],[0,72-D,72,72],[0,D,D,72-D],[72-D,D,72,72-D]]){wall('b',x0+a,x0+c,z0+b,z0+d,y0,y0+h,3.6,3.2,tn);flat(x0+a,x0+c,z0+b,z0+d,y0+h,[.4,.4,.42]);bl.push([x0+a,x0+c,z0+b,z0+d])}
   flat(x0+D,x0+72-D,z0+D,z0+72-D,y0+.02,[.5,.5,.45]);tree(x0+36,z0+36,1.2)}
  else if(biz){for(let a=0;a<2;a++)for(let b=0;b<2;b++){const rn=hs(i,j,a*2+b+10),bx=x0+2+a*36,bz=z0+2+b*36,h=50+rn*(120-rr*.1);
    wall('t',bx,bx+32,bz,bz+32,y0,y0+h,3,3.8,[.75+.2*rn,.85+.15*rn,1]);flat(bx,bx+32,bz,bz+32,y0+h,[.38,.38,.4]);bl.push([bx,bx+32,bz,bz+32])}}
  else for(let a=0;a<3;a++)for(let b=0;b<3;b++){if(hs(i,j,a*3+b+20)<.12)continue;pav(i,j,a*3+b+20,x0+a*24,z0+b*24,bl)}}
 // rues : passages piétons, arbres d'alignement, lampadaires
 const WH=[.9,.9,.9];
 for(let a=-6;a<=6;a++)for(let b=-6;b<=6;b++){const X=a*90,Z=b*90;
  for(const d of [-1,1])for(let s=0;s<6;s++){const o=-4.5+s*1.8;flat(X+o-.4,X+o+.4,Z+d*9-1.5,Z+d*9+1.5,H0+.09,WH);flat(X+d*9-1.5,X+d*9+1.5,Z+o-.4,Z+o+.4,H0+.09,WH)}}
 for(let k=-6;k<=6;k++){const c=k*90;
  Q('S',[[c-5.5,H0+.07,545],[c+5.5,H0+.07,545],[c+5.5,H0+.07,-545],[c-5.5,H0+.07,-545]],[[0,68],[1,68],[1,0],[0,0]],[1,1,1]);
  Q('S',[[-545,H0+.075,c+5.5],[545,H0+.075,c+5.5],[545,H0+.075,c-5.5],[-545,H0+.075,c-5.5]],[[0,0],[0,68],[1,68],[1,0]],[1,1,1]);
  for(let t=-530;t<=530;t+=24){if(Math.abs(t-Math.round(t/90)*90)<13)continue;
   for(const s of [-1,1]){tree(c+s*7.3,t,.9+hs(k,t,s)*.35);tree(t,c+s*7.3,.9+hs(t,k,s)*.35)}
   if(Math.abs(t+12-Math.round((t+12)/90)*90)>=13)for(const s of [-1,1]){LL.push([c+s*8.3,t+12]);LL.push([t+12,c+s*8.3])}}}
 for(const k in B){const b=B[k];if(!b.p.length)continue;const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(b.u,2));g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));g.computeVertexNormals();
  const m=new THREE.Mesh(g,mats[k]);m.castShadow=k!='S'&&k!='g';m.receiveShadow=true;m.frustumCulled=false;scene.add(m)}
 // arbres et lampadaires instanciés
 const nT=TT.length,iT=new THREE.InstancedMesh(new THREE.SphereGeometry(2,8,6),new THREE.MeshStandardMaterial({roughness:.9}),nT),iK=new THREE.InstancedMesh(new THREE.CylinderGeometry(.18,.28,3,6),new THREE.MeshStandardMaterial({color:0x5a4030,roughness:.9}),nT);
 TT.forEach((t,n)=>{const s=t[2];D.rotation.set(0,n,0);D.scale.set(s,s*.9,s);D.position.set(t[0],y0+3+1.6*s,t[1]);D.updateMatrix();iT.setMatrixAt(n,D.matrix);
  cc.setHSL(.22+hs(n,1,2)*.08,.45,.2+hs(n,3,4)*.1);iT.setColorAt(n,cc);D.rotation.set(0,0,0);D.scale.set(1,1,1);D.position.set(t[0],y0+1.5,t[1]);D.updateMatrix();iK.setMatrixAt(n,D.matrix)});
 const nL=LL.length,iP=new THREE.InstancedMesh(new THREE.CylinderGeometry(.07,.1,5.5,6),new THREE.MeshStandardMaterial({color:0x2a2c30,metalness:.5,roughness:.5}),nL),iH=new THREE.InstancedMesh(new THREE.SphereGeometry(.3,8,6),new THREE.MeshStandardMaterial({color:0xfff2c8,emissive:0x665a30}),nL);
 D.rotation.set(0,0,0);D.scale.set(1,1,1);LL.forEach((l,n)=>{D.position.set(l[0],y0+2.75,l[1]);D.updateMatrix();iP.setMatrixAt(n,D.matrix);D.position.y=y0+5.7;D.updateMatrix();iH.setMatrixAt(n,D.matrix)});
 for(const m of [iT,iK,iP,iH]){m.frustumCulled=false;scene.add(m)}
})();

// ===== Voiture =====
const P={m:1400,Iz:2300,a:1.25,b:1.35,h:.5,R:.33,g:9.81,L:2.6,fs:0,CdA:.66,G:1,df:1};
let GR=[0,1],NG=1,TQ=()=>0,RL=7000,SHIFT=6000;
const z0=-20,car={x:cxz(z0),z:z0,h:Math.atan((cxz(z0+1)-cxz(z0-1))/2),vx:0,vz:0,w:0,steer:0,gear:1,rpm:900,ax:0,ay:0,dmg:0,vr:0,spin:0};
const START={...car};
const body=new THREE.Group(),chassis=new THREE.Group();body.rotation.order='YXZ';body.add(chassis);scene.add(body);
const paint=new THREE.MeshPhysicalMaterial({color:0xb01818,metalness:.5,roughness:.28,clearcoat:1,clearcoatRoughness:.05});
const glass=new THREE.MeshPhysicalMaterial({color:0x0c1116,metalness:.3,roughness:.04,clearcoat:1,transparent:true,opacity:.62}),dark=new THREE.MeshStandardMaterial({color:0x111214,roughness:.6});
// ---- carrosserie par sections (loft), générée pour chaque modèle réel ----
let parts=[],wheels=[];
function loft(z0,z1,N,fw,fy0,fy1,n,M){
 const pos=[],idx=[],q=2/n,sg=v=>v<0?-1:1;
 for(let i=0;i<=N;i++){const z=z0+(z1-z0)*i/N,w=fw(z),a0=fy0(z),a1=fy1(z),ym=(a0+a1)/2,hh=Math.max(.01,(a1-a0)/2);
  for(let j=0;j<M;j++){const a=Math.PI*2*j/M,c=Math.cos(a),s=Math.sin(a);pos.push(w*sg(c)*Math.pow(Math.abs(c),q),ym+hh*sg(s)*Math.pow(Math.abs(s),q),z)}}
 const cF=pos.length/3;pos.push(0,(fy0(z0)+fy1(z0))/2,z0);const cR=cF+1;pos.push(0,(fy0(z1)+fy1(z1))/2,z1);
 for(let i=0;i<N;i++)for(let j=0;j<M;j++){const A=i*M+j,B=i*M+(j+1)%M,C=A+M,D=B+M;idx.push(A,C,B,B,C,D)}
 for(let j=0;j<M;j++){idx.push(cF,j,(j+1)%M);const b=N*M;idx.push(cR,b+(j+1)%M,b+j)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g}
const mk=(g,m)=>{const o=new THREE.Mesh(g,m);o.castShadow=true;chassis.add(o);return o};
const bl=(g,m,x,y,z)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);chassis.add(o);return o};
const tailM=new THREE.MeshBasicMaterial({color:0x550000}),headM=new THREE.MeshBasicMaterial({color:0xfff6d0}),plate=new THREE.MeshStandardMaterial({color:0xeeeeee,roughness:.5});
const tyreM=new THREE.MeshStandardMaterial({color:0x151515,roughness:.85}),rimM=new THREE.MeshStandardMaterial({color:0xcfd2d6,metalness:1,roughness:.18}),spM=new THREE.MeshStandardMaterial({color:0x2a2a2e,metalness:.6,roughness:.4});
const tyreG=new THREE.TorusGeometry(.265,.075,14,32).rotateY(Math.PI/2).scale(1.7,1,1),rimG=new THREE.CylinderGeometry(.25,.25,.2,28).rotateZ(Math.PI/2),spG=new THREE.BoxGeometry(.02,.2,.05),hubG=new THREE.CylinderGeometry(.06,.06,.03,12).rotateZ(Math.PI/2);
const COLS=[0xb01818,0x1b3a8a,0xe8e8ea,0x16181c,0x7a7f87,0xe0b000,0x1f6b3a,0xe86a10];
// profils de carrosserie (fractions de la longueur, de l'avant vers l'arrière)
const ST={hatch:{nf:.78,tf:.30,r1:.42,r2:.78,tb:.86,df:.93,bt:.63,n:3},sedan:{nf:.78,tf:.33,r1:.46,r2:.66,tb:.76,df:.9,bt:.64,n:3},muscle:{nf:.74,tf:.38,r1:.5,r2:.68,tb:.78,df:.95,bt:.62,n:3},
 coupe:{nf:.74,tf:.30,r1:.42,r2:.62,tb:.9,df:.7,bt:.62,n:3},super:{nf:.55,tf:.38,r1:.48,r2:.62,tb:.72,df:.86,bt:.66,n:3.4},suv:{nf:.92,tf:.3,r1:.34,r2:.86,tb:.93,df:.98,bt:.6,n:4.5}};
// Données publiques constructeur (approximatives) : dimensions m, masse kg, kW, Nm, tr/min, vitesse max km/h, 0-100 km/h s
const CARS=[
{n:'Renault Clio V TCe 90',yr:2020,L:4.05,W:1.80,H:1.44,wb:2.58,fo:.82,m:1110,wf:.62,hc:.52,R:.31,drv:'Traction',fs:1,kW:67,Nm:160,rp:5000,tl:2000,rl:6200,ng:5,top:182,v1:45,CdA:.67,G:.95,E:0.67,z:12.2,st:'hatch',sp:0},
{n:'Volkswagen Golf GTI',yr:2021,L:4.29,W:1.79,H:1.46,wb:2.63,fo:.85,m:1430,wf:.62,hc:.5,R:.33,drv:'Traction',fs:1,kW:180,Nm:370,rp:5800,tl:1600,rl:6500,ng:7,top:250,v1:55,CdA:.66,G:1.02,E:0.65,z:6.3,st:'hatch',sp:1},
{n:'Toyota GR Yaris',yr:2021,L:3.99,W:1.81,H:1.46,wb:2.56,fo:.78,m:1280,wf:.6,hc:.5,R:.32,drv:'4x4',fs:.4,kW:198,Nm:370,rp:6500,tl:3000,rl:7000,ng:6,top:230,v1:50,CdA:.66,G:1.08,E:0.55,z:5.5,st:'hatch',sp:1},
{n:'BMW M3 Competition',yr:2021,L:4.80,W:1.90,H:1.43,wb:2.86,fo:.9,m:1730,wf:.52,hc:.52,R:.35,drv:'Propulsion',fs:0,kW:375,Nm:650,rp:6250,tl:2750,rl:7200,ng:8,top:250,v1:62,CdA:.72,G:1.12,E:0.77,z:3.9,st:'sedan',sp:1},
{n:'Ford Mustang GT',yr:2024,L:4.81,W:1.92,H:1.40,wb:2.72,fo:.92,m:1750,wf:.54,hc:.52,R:.34,drv:'Propulsion',fs:0,kW:358,Nm:567,rp:7150,tl:4500,rl:7500,ng:10,top:250,v1:60,CdA:.76,G:1.05,E:0.65,z:4.5,st:'muscle',sp:0},
{n:'Porsche 911 Carrera S',yr:2020,L:4.52,W:1.85,H:1.30,wb:2.45,fo:.88,m:1515,wf:.38,hc:.45,R:.34,drv:'Propulsion',fs:0,kW:331,Nm:530,rp:6500,tl:2300,rl:7500,ng:8,top:308,v1:58,CdA:.62,G:1.15,E:0.67,z:3.5,st:'coupe',sp:1},
{n:'Tesla Model 3 Performance',yr:2021,L:4.72,W:1.85,H:1.44,wb:2.88,fo:.88,m:1850,wf:.48,hc:.45,R:.34,drv:'4x4 électrique',fs:.35,kW:393,Nm:660,rp:16000,tl:0,rl:16000,ng:1,top:261,v1:60,CdA:.53,G:1.05,E:1.17,z:3.1,st:'sedan',sp:0},
{n:'Nissan GT-R Premium',yr:2020,L:4.71,W:1.89,H:1.37,wb:2.78,fo:.88,m:1750,wf:.54,hc:.5,R:.34,drv:'4x4',fs:.3,kW:419,Nm:637,rp:6800,tl:3300,rl:7100,ng:6,top:315,v1:60,CdA:.70,G:1.15,E:0.8,z:2.9,st:'coupe',sp:2},
{n:'Lamborghini Huracán Evo',yr:2019,L:4.52,W:1.93,H:1.17,wb:2.62,fo:.9,m:1422,wf:.43,hc:.42,R:.35,drv:'4x4',fs:.3,kW:470,Nm:600,rp:8000,tl:6500,rl:8500,ng:7,top:325,v1:66,CdA:.62,G:1.25,df:2,E:0.66,z:2.9,st:'super',sp:2},
{n:'Mercedes-AMG G 63',yr:2022,L:4.82,W:1.93,H:1.97,wb:2.89,fo:.85,m:2560,wf:.55,hc:.78,R:.40,drv:'4x4',fs:.5,kW:430,Nm:850,rp:6000,tl:2500,rl:6500,ng:9,top:220,v1:55,CdA:1.2,G:.95,E:0.66,z:4.5,st:'suv',sp:0}];
function buildCar(c){
 chassis.traverse(o=>{if(o.geometry)o.geometry.dispose()});while(chassis.children.length)chassis.remove(chassis.children[0]);
 const S=ST[c.st],L=c.L,W2=c.W/2,H=c.H,bH=S.bt*H,R=c.R,a=c.wb*(1-c.wf),b=c.wb-a,zf=a+c.fo,zr=zf-L,Ra=R+.05;
 const tt=z=>(zf-z)/L,ip=(A,t)=>{for(let i=1;i<A.length;i++)if(t<=A[i][0])return A[i-1][1]+(A[i][1]-A[i-1][1])*(t-A[i-1][0])/(A[i][0]-A[i-1][0]);return A[A.length-1][1]};
 const e=t=>t<=S.tf||t>=S.tb?0:t<S.r1?Math.pow(sm((t-S.tf)/(S.r1-S.tf)),.8):t<S.r2?1:1-sm((t-S.r2)/(S.tb-S.r2));
 const hW=z=>W2*ip([[0,.58],[.03,.74],[.1,.9],[.22,.99],[.78,.99],[.9,.93],[.97,.8],[1,.62]],tt(z));
 const hY1=z=>{const t=tt(z);return t<S.tf?bH*(S.nf+(1-S.nf)*sm(t/S.tf)):t<S.tb?bH:bH*(1-(1-S.df)*sm((t-S.tb)/(1-S.tb)))};
 const ar=(zc,z)=>R+Math.sqrt(Math.max(0,Ra*Ra-(z-zc)*(z-zc)));
 const hY0=z=>Math.min(Math.max(R*.95+.1*sm((Math.abs(tt(z)-.5)-.43)/.07),ar(a,z),ar(-b,z)),hY1(z)-.1);
 const gW=z=>W2*(.9-.28*e(tt(z))),gY1=z=>bH+(H-bH)*e(tt(z));
 const hull=mk(loft(zf,zr,48,hW,hY0,hY1,S.n,28),paint),cab=mk(loft(zf-S.tf*L,zf-S.tb*L,22,gW,()=>bH-.05,gY1,2.6,22),glass);
 mk(loft(zf-(S.tf+.7*(S.r1-S.tf))*L,zf-(S.r2+.3*(S.tb-S.r2))*L,12,z=>gW(z)*.9,z=>gY1(z)-.06,z=>gY1(z)+.012,3,22),paint);
 parts=[hull,cab].map(m=>({m,orig:m.geometry.attributes.position.array.slice()}));
 const hz=zf-.16,zw=zf-S.tf*L;
 for(const s of [-1,1]){
  bl(new THREE.SphereGeometry(.12,12,8),headM,s*W2*.66,hY1(hz)-.12,hz).scale.set(1.5,.7,.9);
  bl(new THREE.BoxGeometry(W2*.45,.08,.05),tailM,s*W2*.64,hY1(zr+.1)-.08,zr+.08);
  bl(new THREE.BoxGeometry(.13,.09,.12),paint,s*(W2+.04),bH+.04,zw-.15);
  bl(new THREE.BoxGeometry(.05,.07,c.wb*.5),dark,s*(W2-.02),R*.95,(a-b)/2);
  bl(new THREE.BoxGeometry(.38,.5,.14),dark,s*W2*.38,bH+.1,zf-(S.tb-.14)*L)}
 bl(new THREE.BoxGeometry(W2*1.5,.16,.3),dark,0,bH+.02,zw-.15);bl(new THREE.BoxGeometry(W2*1.7,.05,.3),dark,0,R*.95-.03,zf-.2);
 bl(new THREE.BoxGeometry(.5,.12,.02),plate,0,.48,zf+.02);bl(new THREE.BoxGeometry(.5,.12,.02),plate,0,.62,zr-.02);
 if(c.sp==2){bl(new THREE.BoxGeometry(W2*1.5,.04,.3),paint,0,hY1(zr+.3)+.16,zr+.3);for(const s of [-1,1])bl(new THREE.BoxGeometry(.04,.16,.06),dark,s*W2*.5,hY1(zr+.3)+.08,zr+.3)}
 else if(c.sp==1)bl(new THREE.BoxGeometry(W2*1.2,.03,.16),paint,0,hY1(zr+.15)+.02,zr+.15);
 wheels=[];const sc=R/.33;
 for(const [sx,z,f] of [[-1,a,1],[1,a,1],[-1,-b,0],[1,-b,0]]){
  const piv=new THREE.Group();piv.position.set(sx*(W2-.1),R,z);piv.scale.setScalar(sc);const sp=new THREE.Group();
  const t=new THREE.Mesh(tyreG,tyreM);t.castShadow=true;sp.add(t,new THREE.Mesh(rimG,rimM));
  for(let k=0;k<5;k++){const g=new THREE.Group(),o=new THREE.Mesh(spG,spM);o.position.set(sx*.105,.13,0);g.add(o);g.rotation.x=k*Math.PI*2/5;sp.add(g)}
  const h=new THREE.Mesh(hubG,spM);h.position.x=sx*.105;sp.add(h);piv.add(sp);chassis.add(piv);wheels.push({piv,sp,f})}
 // physique réelle du modèle
 Object.assign(P,{m:c.m,a,b,h:c.hc,R,L:c.wb,Iz:c.m*Math.pow(.3*L,2),fs:c.fs,CdA:c.CdA,G:c.G,df:c.df||1,E:c.E||.9});
 TQ=r=>{if(r>c.rl)return 0;const w=r*Math.PI/30,ramp=c.tl?.5+.5*sm((r-900)/Math.max(1,c.tl-900)):1;let T=Math.min(c.Nm*ramp,c.kW*1000/Math.max(w,1));if(r>c.rp)T*=1-.3*Math.pow((r-c.rp)/(c.rl-c.rp),2);return Math.max(T,.12*c.Nm)};
 const k=c.rl*.95*Math.PI/30*R,o1=k/(c.v1/3.6),on=k/(c.top/3.6);GR=[0];for(let i=0;i<c.ng;i++)GR.push(c.ng>1?o1*Math.pow(on/o1,i/(c.ng-1)):on);
 NG=c.ng;RL=c.rl;SHIFT=Math.min(c.rl*.97,c.rp*1.12);
 car.cr=Math.max(.8,W2);const d=Math.max(0,L/2-car.cr),zc=(zf+zr)/2;car.circ=[zc-d,zc,zc+d];car.gear=1;
}
function dent(lx,lz,dx,dz,amt){
 for(const q of parts){const p=q.m.geometry.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),wx=x+q.m.position.x,wz=z+q.m.position.z,d=Math.hypot(wx-lx,wz-lz);if(d>1.7)continue;
   const f=Math.pow(1-d/1.7,2)*amt,n=((Math.sin(wx*12.9898+wz*78.233+y*37.719)*43758.5453)%1)*.25;
   p.setXYZ(i,x+(dx+n)*f,y-Math.abs(n)*f*.4,z+(dz+n)*f)}
  p.needsUpdate=true;q.m.geometry.computeVertexNormals()}
 car.dmg+=amt}
function repair(){for(const q of parts){q.m.geometry.attributes.position.array.set(q.orig);q.m.geometry.attributes.position.needsUpdate=true;q.m.geometry.computeVertexNormals()}car.dmg=0}

// cônes dynamiques sur la route de départ
const cones=[],coneM=new THREE.MeshStandardMaterial({color:0xff6a00,roughness:.6}),coneG=new THREE.ConeGeometry(.22,.7,14);
for(let i=0;i<24;i++){const z=30+i*14,x=cxz(z)+(i%2?2.8:-2.8),m=new THREE.Mesh(coneG,coneM);m.castShadow=true;scene.add(m);cones.push({x,z,vx:0,vz:0,m,down:0})}

// ===== Garage : choix de la voiture =====
let ci=1,menuOpen=true,orbit=0;
function renderMenu(){const c=CARS[ci],hp=Math.round(c.kW*1.36);
 $('cn').textContent=c.n;$('cy').textContent=c.yr+' · '+c.drv+' · '+(c.st=='suv'?'SUV':c.st=='hatch'?'compacte':c.st=='super'?'supercar':c.st=='muscle'?'muscle car':c.st=='coupe'?'coupé':'berline');
 const rows=[['Puissance',hp+' ch ('+c.kW+' kW)',hp/640],['Couple',c.Nm+' Nm',c.Nm/850],['0-100 km/h',c.z.toFixed(1)+' s',(13-c.z)/10.5],['Vitesse max',c.top+' km/h',c.top/325],['Poids',c.m+' kg',c.m/2600]];
 $('sp').innerHTML=rows.map(r=>`<div class="r"><span>${r[0]}</span><i><b style="width:${Math.round(cl(r[2],.04,1)*100)}%"></b></i><em>${r[1]}</em></div>`).join('');
 $('co').innerHTML=COLS.map(h=>`<u style="background:#${h.toString(16).padStart(6,'0')}" data-c="${h}"></u>`).join('')}
function pick(d){ci=(ci+CARS.length+d)%CARS.length;buildCar(CARS[ci]);Object.assign(car,START);renderMenu()}
buildCar(CARS[ci]);renderMenu();

// ===== Entrées =====
const K={},T={};let camMode=0;
on(window,'keydown',e=>{K[e.code]=1;if(menuOpen){if(e.code=='ArrowLeft')pick(-1);if(e.code=='ArrowRight')pick(1);if(e.code=='Enter')$('go').click()}if(e.code=='KeyC')camMode=(camMode+1)%3;if(e.code=='KeyR'){Object.assign(car,START);repair()}if(e.code=='KeyF')fs();audioInit();if(e.code.startsWith('Arrow')||e.code=='Space')e.preventDefault()});
on(window,'keyup',e=>K[e.code]=0);
root.querySelectorAll('#ad-tc button').forEach(b=>{const k=b.dataset.k;
 b.addEventListener('pointerdown',e=>{T[k]=1;audioInit();e.preventDefault()});
 for(const ev of ['pointerup','pointercancel','pointerleave'])b.addEventListener(ev,()=>T[k]=0)});
function fs(){const d=root;document.fullscreenElement?document.exitFullscreen():(d.requestFullscreen||d.webkitRequestFullscreen||(()=>{})).call(d)}
$('fs').onclick=fs;$('pv').onclick=()=>pick(-1);$('nx').onclick=()=>pick(1);$('co').onclick=e=>{if(e.target.dataset.c)paint.color.setHex(+e.target.dataset.c)};
$('go').onclick=()=>{menuOpen=false;$('menu').style.display='none'};$('gb').onclick=()=>{menuOpen=true;Object.assign(car,START);$('menu').style.display='flex'};
const ctl={thr:0,brk:0,str:0,hb:0};
function readInput(){ctl.thr=(K.ArrowUp||K.KeyW||T.g)?1:0;ctl.brk=(K.ArrowDown||K.KeyS||T.b)?1:0;
 // CORRIGÉ : vue depuis l'arrière (axe +z), la droite de l'écran est -x → on inverse le signe
 ctl.str=((K.ArrowLeft||K.KeyA||T.l)?1:0)-((K.ArrowRight||K.KeyD||T.r)?1:0);ctl.hb=(K.Space||T.h)?1:0}

// ===== Son =====
let AC,o1,o2,og,sq,sg;
function audioInit(){if(AC)return;try{AC=new(window.AudioContext||window.webkitAudioContext)();
 const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=1100;og=AC.createGain();og.gain.value=0;
 o1=AC.createOscillator();o1.type='sawtooth';o2=AC.createOscillator();o2.type='square';o1.connect(f);o2.connect(f);f.connect(og);og.connect(AC.destination);o1.start();o2.start();
 sq=AC.createOscillator();sq.type='triangle';sg=AC.createGain();sg.gain.value=0;sq.connect(sg);sg.connect(AC.destination);sq.start()}catch(e){}}
function crash(v){if(!AC)return;const n=AC.createBufferSource(),b=AC.createBuffer(1,AC.sampleRate*.4,AC.sampleRate),d=b.getChannelData(0);
 for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);n.buffer=b;const g=AC.createGain();g.gain.value=Math.min(1,v*.08);n.connect(g);g.connect(AC.destination);n.start()}

// ===== Physique =====
let shake=0;

function hit(nx,nz,pen,cx,cz){
 car.x+=nx*pen;car.z+=nz*pen;const rx=cx-car.x,rz=cz-car.z;
 const vn=(car.vx+car.w*rz)*nx+(car.vz-car.w*rx)*nz;if(vn>=0)return;
 const k=rz*nx-rx*nz,j=-1.25*vn/(1/P.m+k*k/P.Iz);
 car.vx+=j*nx/P.m;car.vz+=j*nz/P.m;car.w+=j*k/P.Iz;
 if(-vn>1.5){const s=Math.sin(car.h),c=Math.cos(car.h),px=rx-nx*car.cr,pz=rz-nz*car.cr;
  dent(px*c-pz*s,px*s+pz*c,nx*c-nz*s,nx*s+nz*c,Math.min(.5,(-vn-1.5)*.045));shake=Math.min(1,-vn*.05);crash(-vn)}}
function step(dt){
 const s=Math.sin(car.h),c=Math.cos(car.h),fx=s,fz=c,rx=c,rz=-s;
 const vf=car.vx*fx+car.vz*fz,vr=car.vx*rx+car.vz*rz,sp=Math.hypot(car.vx,car.vz);
 const sf=surf(car.x,car.z),mu=sf.mu*P.G;
 const tgt=ctl.str*.55/(1+sp*.045);car.steer+=(tgt-car.steer)*Math.min(1,dt*(ctl.str?6:9));
 let drive=0,brake=0;
 if(ctl.thr){vf<-1?brake=1:drive=1}
 if(ctl.brk){vf>1?brake=1:drive=-1}
 let ratio=drive<0?GR[1]*1.1:GR[car.gear];const rpmW=Math.abs(vf)/P.R*ratio*9.549;
 if(drive>=0&&NG>1){if(rpmW>SHIFT&&car.gear<NG)car.gear++;else if(car.gear>1&&rpmW*GR[car.gear-1]/GR[car.gear]<RL*.62)car.gear--}
 ratio=drive<0?GR[1]*1.1:GR[car.gear];
 const wr=Math.abs(vf)/P.R*ratio*9.549,rt=Math.max(wr,RL>9000?0:900+Math.abs(drive)*(sp<10?2800:0));
 car.rpm+=(rt-car.rpm)*Math.min(1,dt*12);
 const Fdrive=drive*TQ(car.rpm)*ratio*(P.E+(.95-P.E)*sm((sp-22)/30))/P.R;
 const dn=.1*P.df*sp*sp,W=P.m*P.g;
 const Nf=Math.max(.1*W,W*P.b/P.L-P.m*car.ax*P.h/P.L+dn*.4),Nr=Math.max(.1*W,W*P.a/P.L+P.m*car.ax*P.h/P.L+dn*.6);
 const sg=cl(vf/.5,-1,1),BK=P.m*P.g*1.15,lim=(v,m)=>cl(v,-m,m);
 const Fxf=lim(Fdrive*P.fs-sg*brake*BK*.62,mu*Nf*.98),Fxr=lim(Fdrive*(1-P.fs)-sg*(brake*BK*.38+ctl.hb*P.m*6),mu*Nr*.98);
 car.spin=(Math.abs(Fdrive*(1-P.fs))>mu*Nr||Math.abs(Fdrive*P.fs)>mu*Nf)?1:0;
 const vl=Math.max(Math.abs(vf),1.5),dir=vf<0?-1:1;
 const af=Math.atan((vr+P.a*car.w)/vl)-car.steer*dir,ar=Math.atan((vr-P.b*car.w)/vl),Bt=9,Ct=1.45;
 let avf=Math.max(Math.sqrt(Math.max(0,Math.pow(mu*Nf,2)-Fxf*Fxf)),.3*mu*Nf),avr=Math.max(.3*mu*Nr,Math.sqrt(Math.max(0,Math.pow(mu*Nr,2)-Fxr*Fxr)))*(1-.65*ctl.hb);
 const Fyf=-avf*Math.sin(Ct*Math.atan(Bt*af)),Fyr=-avr*Math.sin(Ct*Math.atan(Bt*ar));
 const cd=Math.cos(car.steer),sd=Math.sin(car.steer);
 const rr=P.m*P.g*.015*sf.rr*cl(vf,-1,1);
 const Fx=Fxr+Fxf*cd-Fyf*sd-.6*P.CdA*vf*sp-rr,Fy=Fyr+Fyf*cd+Fxf*sd;
 const Mz=P.a*(Fyf*cd+Fxf*sd)-P.b*Fyr-.6*P.m*car.w;
 // pente : la gravité tire la voiture vers le bas du relief
 const gx=(H(car.x+1,car.z)-H(car.x-1,car.z))/2,gz=(H(car.x,car.z+1)-H(car.x,car.z-1))/2;
 car.vx+=((Fx*fx+Fy*rx)/P.m-P.g*gx)*dt;car.vz+=((Fx*fz+Fy*rz)/P.m-P.g*gz)*dt;car.w+=Mz/P.Iz*dt;
 if(sp<.6&&!ctl.thr&&!ctl.brk&&Math.hypot(gx,gz)<.08){const d=1-Math.min(1,dt*6);car.vx*=d;car.vz*=d;car.w*=d}
 car.x+=car.vx*dt;car.z+=car.vz*dt;car.h+=car.w*dt;
 const k=Math.min(1,dt*8);car.ax+=(Fx/P.m-car.ax)*k;car.ay+=(Fy/P.m-car.ay)*k;car.vr=vr;
 // collisions : arbres, rochers, cônes
 const near=[],ci=Math.floor(car.x/CS),cj=Math.floor(car.z/CS);
 for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const o of cellObjs(ci+a,cj+b))near.push(o);
 const bxs=boxesNear(car.x,car.z);
 for(const oz of car.circ){
  const cx=car.x+s*oz,cz=car.z+c*oz;
  for(const o of near){const dx=cx-o.x,dz=cz-o.z,d=Math.hypot(dx,dz),mn=car.cr+(o.t?o.r*.85:.5);if(d<mn&&d>1e-4)hit(dx/d,dz/d,mn-d,cx,cz)}
  for(const q of bxs){const qx=cl(cx,q[0],q[1]),qz=cl(cz,q[2],q[3]),dx=cx-qx,dz=cz-qz,d=Math.hypot(dx,dz);if(d<car.cr&&d>1e-4)hit(dx/d,dz/d,car.cr-d,cx,cz)}
  for(const k of cones){const dx=k.x-cx,dz=k.z-cz,d=Math.hypot(dx,dz);if(d<1.22&&d>1e-4){const nx=dx/d,nz=dz/d,rel=Math.max(0,(car.vx-k.vx)*nx+(car.vz-k.vz)*nz);
   k.vx=car.vx+nx*(2+rel*.3);k.vz=car.vz+nz*(2+rel*.3);k.x=cx+nx*1.23;k.z=cz+nz*1.23;
   if(rel>1.5&&!k.down){k.down=Math.random()<.5?1:-1;car.vx*=.99;car.vz*=.99}}}}
 for(const k of cones){k.x+=k.vx*dt;k.z+=k.vz*dt;const f=Math.exp(-3*dt);k.vx*=f;k.vz*=f}
}

// ===== Traces + fumée/poussière =====
const SK=500,skid=new THREE.InstancedMesh(new THREE.PlaneGeometry(.26,.7).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x050505,transparent:true,opacity:.55,depthWrite:false}),SK);
skid.frustumCulled=false;scene.add(skid);const dm=new THREE.Object3D();let sk=0,skT=0;
dm.scale.set(0,0,0);dm.updateMatrix();for(let i=0;i<SK;i++)skid.setMatrixAt(i,dm.matrix);
function mark(x,z,h){dm.position.set(x,H(x,z)+.1,z);dm.rotation.set(0,h,0);dm.scale.set(1,1,1);dm.updateMatrix();skid.setMatrixAt(sk=(sk+1)%SK,dm.matrix);skid.instanceMatrix.needsUpdate=true}
const sprT=ctex(64,64,g=>{const r=g.createRadialGradient(32,32,2,32,32,30);r.addColorStop(0,'rgba(255,255,255,.9)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64)});
const puffs=[];for(let i=0;i<60;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:sprT,transparent:true,depthWrite:false,opacity:0}));s.visible=false;scene.add(s);puffs.push({s,l:0})}
let pi=0;function puff(x,y,z,c){const p=puffs[pi=(pi+1)%60];p.l=1;p.s.position.set(x,y,z);p.s.material.color.setHex(c);p.s.visible=true}

// ===== Boucle =====
let last=performance.now(),acc=0,camH=car.h,cy=H(car.x,car.z),tpS=0,trS=0,raf=0;
const cp=new THREE.Vector3();let dist=0;const scoreEl=document.getElementById('current-score');
function frame(t){raf=requestAnimationFrame(frame);
 const dt=Math.min(.05,(t-last)/1000);last=t;acc+=dt;readInput();
 while(acc>=1/120){if(!menuOpen)step(1/120);acc-=1/120}
 refresh(car.x,car.z);water.position.x=car.x;water.position.z=car.z;wTex.offset.set(car.x/12+t*2e-5,car.z/12+t*1e-5);
 const sp=Math.hypot(car.vx,car.vz),s=Math.sin(car.h),c=Math.cos(car.h),vf=car.vx*s+car.vz*c;
 // pose sur le relief (4 roues)
 const hw=(xx,zz)=>H(car.x+xx*c+zz*s,car.z-xx*s+zz*c),fl=hw(-.9,1.25),fr=hw(.9,1.25),rl=hw(-.9,-1.35),rrw=hw(.9,-1.35);
 const k=Math.min(1,dt*14);cy+=((fl+fr+rl+rrw)/4-cy)*k;
 tpS+=(Math.atan(((rl+rrw)-(fl+fr))/2/2.6)-tpS)*k;trS+=(Math.atan(((fr+rrw)-(fl+rl))/2/1.8)-trS)*k;
 body.position.set(car.x,cy,car.z);body.rotation.set(tpS,car.h,trS);
 chassis.rotation.x=cl(-car.ax*.006,-.06,.06);chassis.rotation.z=cl(car.ay*.007,-.07,.07);
 for(const w of wheels){w.sp.rotation.x+=vf/P.R*dt;if(w.f)w.piv.rotation.y=car.steer}
 const br=(ctl.brk&&vf>1)||(ctl.thr&&vf<-1);tailM.color.setHex(br||ctl.hb?0xff1010:0x550000);
 // traces + fumée
 skT-=dt;const road=onRoad(car.x,car.z),slide=Math.abs(car.vr)>2.4&&sp>3,lock=br&&sp>9,spin=car.spin&&ctl.thr&&sp<25;
 if(skT<=0&&(slide||lock||spin)){skT=.03;const wet=H(car.x,car.z)<WATER;
  for(const sx of [-.9,.9]){const x=car.x-s*1.35+c*sx,z=car.z-c*1.35-s*sx;if(road)mark(x,z,car.h);puff(x,H(x,z)+.3,z,wet?0xcfe8f5:road?0xdddddd:0x8a7a55)}}
 for(const p of puffs){if(p.l<=0)continue;p.l-=dt*.9;if(p.l<=0){p.s.visible=false;continue}p.s.scale.setScalar(1+(1-p.l)*3.5);p.s.material.opacity=.5*p.l;p.s.position.y+=dt*.8}
 if(AC){const f=car.rpm/60*2;o1.frequency.value=f;o2.frequency.value=f*.5;og.gain.value=.05+.06*ctl.thr+car.rpm/7000*.03;
  sq.frequency.value=700+Math.abs(car.vr)*40;sg.gain.value=(slide||lock)&&road?Math.min(.05,(Math.abs(car.vr)-1.5)*.01+.01):0}
 for(const k of cones){k.m.position.set(k.x,H(k.x,k.z)+(k.down?.12:.35),k.z);k.m.rotation.set(0,0,k.down*1.45)}
 // caméra
 camH+=Math.atan2(Math.sin(car.h-camH),Math.cos(car.h-camH))*Math.min(1,dt*(sp>5?4:8));
 if(menuOpen){orbit+=dt*.4;const OR=Math.max(P.L*2.2,6.5);cam.position.set(car.x+Math.sin(orbit)*OR,cy+1.7,car.z+Math.cos(orbit)*OR);cam.lookAt(car.x,cy+.6,car.z)}else if(camMode==0){const cs=Math.sin(camH),cc2=Math.cos(camH);cp.set(car.x-cs*7.5,cy+3.1,car.z-cc2*7.5);cp.y=Math.max(cp.y,H(cp.x,cp.z)+1);cam.position.lerp(cp,Math.min(1,dt*9));cam.lookAt(car.x+s*4,cy+1.1,car.z+c*4)}
 else if(camMode==1){cam.position.set(car.x+s*.35,cy+1.5,car.z+c*.35);cam.lookAt(car.x+s*20,cy+1.4,car.z+c*20)}
 else{cam.position.set(car.x-s*3.8,cy+.9,car.z-c*3.8);cam.lookAt(car.x+s*3,cy+.6,car.z+c*3)}
 shake*=.9;if(shake>.01){cam.position.x+=(Math.random()-.5)*shake*.5;cam.position.y+=(Math.random()-.5)*shake*.5}
 cam.fov=62+Math.min(18,sp*.5);cam.updateProjectionMatrix();
 sun.position.set(car.x+50,cy+70,car.z+30);sun.target.position.set(car.x,cy,car.z);
 dist+=sp*dt;if(scoreEl)scoreEl.textContent=Math.floor(dist/10)+cones.filter(k=>k.down).length*50;$('spd').textContent=Math.round(sp*3.6);$('gr').textContent=vf<-.5?'R':sp<.5?'N':NG==1?'D':car.gear;
 $('rbf').style.width=Math.min(100,car.rpm/RL*100)+'%';$('dm').textContent='Dégâts '+Math.min(100,Math.round(car.dmg*18))+'%';
 ren.render(scene,cam)}
raf=requestAnimationFrame(frame);

return function destroy(){cancelAnimationFrame(raf);off.forEach(f=>f());if(AC)try{AC.close()}catch(e){}
 const sc=Math.floor(dist/10)+cones.filter(k=>k.down).length*50;if(sc>0&&window.updateHighScore)try{updateHighScore('beamdrive',sc)}catch(e){}
 ren.dispose();ren.forceContextLoss();root.remove();css.remove();if(isCv)host.style.display=hDisp};
}
})();