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
const roadBase=(x,z)=>Math.max(-6.5,(noise(x/260,z/260)+noise(x/90,z/90)*.35-.7)*38);
const baseH=(x,z)=>(noise(x/260,z/260)+noise(x/90,z/90)*.35+noise(x/30,z/30)*.08-.7)*38;
const cxz=z=>Math.sin(z*.0035)*110+Math.sin(z*.0091)*35,czx=x=>Math.sin(x*.0031)*90+Math.sin(x*.008)*30;
function H(x,z){let h=baseH(x,z);
 const wa=1-sm((Math.abs(x-cxz(z))-7)/14),wb=1-sm((Math.abs(z-czx(x))-7)/14);
 if(wa>=wb&&wa>0)h=lerp(h,roadBase(cxz(z),z),wa);else if(wb>0)h=lerp(h,roadBase(x,czx(x)),wb);return h}
const onRoad=(x,z)=>Math.abs(x-cxz(z))<5.5||Math.abs(z-czx(x))<5.5;
function surf(x,z){const h=H(x,z);
 if(h<WATER-.1)return{mu:.3,rr:12};if(onRoad(x,z))return{mu:1.15,rr:1};if(h<-6)return{mu:.75,rr:2.5};return{mu:.65,rr:3.5}}

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
root.innerHTML='<div id="ad-vg"></div><div id="ad-hud"><div><b id="ad-spd">0</b><small>km/h</small></div><div id="ad-gr">N</div><div><div id="ad-rb"><i id="ad-rbf"></i></div><div id="ad-dm"></div></div></div><div id="ad-help">Z/↑ accélérer · S/↓ frein/marche arrière · Q D/←→ direction<br>Espace frein à main · C caméra · R reset · F plein écran<br>Monde ouvert : roule où tu veux !</div><button class="b" id="ad-fs" style="right:12px">⛶</button><div id="ad-tc"><div><button data-k="l">◀</button><button data-k="r">▶</button></div><div><button data-k="h">HB</button><button data-k="b">■</button><button data-k="g">▲</button></div></div>';
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
const terrain=new THREE.Mesh(tg,new THREE.MeshStandardMaterial({vertexColors:true,map:detail,bumpMap:detail,bumpScale:1.5,roughness:.95}));
terrain.receiveShadow=true;terrain.frustumCulled=false;scene.add(terrain);
const wTex=ctex(128,128,(g,w,h)=>{g.fillStyle='#888';g.fillRect(0,0,w,h);for(let i=0;i<900;i++){const v=Math.random()*255|0;g.fillStyle=`rgb(${v},${v},${v})`;g.beginPath();g.arc(Math.random()*w,Math.random()*h,3+Math.random()*8,0,7);g.fill()}},1);wTex.repeat.set(150,150);
const water=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:0x1f6f8f,roughness:.08,metalness:.2,bumpMap:wTex,bumpScale:.5,transparent:true,opacity:.82}));
water.position.y=WATER;scene.add(water);
// routes (rubans qui suivent le relief)
const roadT=ctex(128,256,(g,w,h)=>{g.fillStyle='#2e2e32';g.fillRect(0,0,w,h);for(let i=0;i<5000;i++){const v=30+Math.random()*40|0;g.fillStyle=`rgb(${v},${v},${v+3})`;g.fillRect(Math.random()*w,Math.random()*h,2,2)}
 g.fillStyle='rgba(0,0,0,.28)';g.fillRect(30,0,16,h);g.fillRect(w-46,0,16,h);
 for(let i=0;i<14;i++){g.strokeStyle='rgba(15,15,15,.7)';g.beginPath();let x=Math.random()*w,y=Math.random()*h;g.moveTo(x,y);for(let k=0;k<6;k++){x+=Math.random()*14-7;y+=Math.random()*12;g.lineTo(x,y)}g.stroke()}
 g.fillStyle='#ddd';g.fillRect(8,0,3,h);g.fillRect(w-11,0,3,h);g.fillStyle='#e8c020';g.fillRect(w/2-2,0,4,h/2)},1);
const roadM=new THREE.MeshStandardMaterial({map:roadT,roughness:.8,bumpMap:roadT,bumpScale:1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
const RN=200;
function ribbon(){const g=new THREE.BufferGeometry(),uv=new Float32Array((RN+1)*4),nr=new Float32Array((RN+1)*6),ix=[];
 for(let i=0;i<=RN;i++){nr[i*6+1]=nr[i*6+4]=1;uv[i*4]=0;uv[i*4+2]=1}
 for(let i=0;i<RN;i++){const a=i*2;ix.push(a,a+2,a+1,a+1,a+2,a+3)}
 g.setAttribute('position',new THREE.BufferAttribute(new Float32Array((RN+1)*6),3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setAttribute('normal',new THREE.BufferAttribute(nr,3));g.setIndex(ix);
 const m=new THREE.Mesh(g,roadM);m.frustumCulled=false;m.receiveShadow=true;scene.add(m);return m}
const roadNS=ribbon(),roadEW=ribbon();
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
  if(Math.abs(x-cxz(z))<13||Math.abs(z-czx(x))<13)continue;const y=H(x,z);if(y<-6.2||y>24)continue;
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

// ===== Voiture =====
const P={m:1400,Iz:2300,a:1.25,b:1.35,h:.5,R:.33,g:9.81,L:2.6};
const z0=-20,car={x:cxz(z0),z:z0,h:Math.atan((cxz(z0+1)-cxz(z0-1))/2),vx:0,vz:0,w:0,steer:0,gear:1,rpm:900,ax:0,ay:0,dmg:0,vr:0,spin:0};
const START={...car};
const body=new THREE.Group(),chassis=new THREE.Group();body.rotation.order='YXZ';body.add(chassis);scene.add(body);
const paint=new THREE.MeshPhysicalMaterial({color:0xb01818,metalness:.5,roughness:.28,clearcoat:1,clearcoatRoughness:.05});
const glass=new THREE.MeshPhysicalMaterial({color:0x0c1116,metalness:.3,roughness:.04,clearcoat:1,transparent:true,opacity:.62}),dark=new THREE.MeshStandardMaterial({color:0x111214,roughness:.6});
// ---- carrosserie par sections (loft) : coque lisse, pas un bloc ----
const itp=(A,z)=>{if(z>=A[0][0])return A[0][1];for(let i=1;i<A.length;i++)if(z>=A[i][0]){const t=(z-A[i][0])/(A[i-1][0]-A[i][0]);return A[i][1]+(A[i-1][1]-A[i][1])*t}return A[A.length-1][1]};
function loft(z0,z1,N,fw,fy0,fy1,n,M){
 const pos=[],idx=[],q=2/n,sg=v=>v<0?-1:1;
 for(let i=0;i<=N;i++){const z=z0+(z1-z0)*i/N,w=fw(z),a0=fy0(z),a1=fy1(z),ym=(a0+a1)/2,hh=Math.max(.01,(a1-a0)/2);
  for(let j=0;j<M;j++){const a=Math.PI*2*j/M,c=Math.cos(a),s=Math.sin(a);pos.push(w*sg(c)*Math.pow(Math.abs(c),q),ym+hh*sg(s)*Math.pow(Math.abs(s),q),z)}}
 const cF=pos.length/3;pos.push(0,(fy0(z0)+fy1(z0))/2,z0);const cR=cF+1;pos.push(0,(fy0(z1)+fy1(z1))/2,z1);
 for(let i=0;i<N;i++)for(let j=0;j<M;j++){const A=i*M+j,B=i*M+(j+1)%M,C=A+M,D=B+M;idx.push(A,C,B,B,C,D)}
 for(let j=0;j<M;j++){idx.push(cF,j,(j+1)%M);const b=N*M;idx.push(cR,b+(j+1)%M,b+j)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g}
const hW=z=>itp([[2.15,.5],[2.0,.72],[1.7,.88],[1.3,.95],[.6,.96],[-.6,.96],[-1.3,.95],[-1.8,.88],[-2.05,.74],[-2.15,.55]],z);
const hY1=z=>itp([[2.15,.55],[2.0,.64],[1.6,.74],[1.0,.82],[.7,.88],[-.3,.9],[-1.3,.92],[-1.85,.95],[-2.1,.88],[-2.15,.72]],z);
const hY0=z=>{const ar=(zc)=>.33+Math.sqrt(Math.max(0,.38*.38-(z-zc)*(z-zc)));return Math.max(.32+Math.max(0,(Math.abs(z)-1.95)/.2)*.1,ar(1.25),ar(-1.35))};
const gW=z=>itp([[.78,.76],[.6,.7],[.3,.64],[-.05,.6],[-.6,.6],[-1,.6],[-1.3,.64],[-1.5,.72]],z);
const gY1=z=>itp([[.78,.88],[.6,1.08],[.3,1.28],[-.05,1.38],[-.6,1.4],[-1,1.36],[-1.3,1.18],[-1.5,.93]],z);
const mk=(g,m)=>{const o=new THREE.Mesh(g,m);o.castShadow=true;chassis.add(o);return o};
const hull=mk(loft(2.15,-2.15,54,hW,hY0,hY1,3.2,28),paint),cab=mk(loft(.78,-1.5,24,gW,()=>.86,gY1,2.6,22),glass);
mk(loft(.25,-1.1,14,z=>gW(z)*.9,z=>gY1(z)-.056,z=>gY1(z)+.014,3,22),paint);
const parts=[hull,cab].map(m=>({m,orig:m.geometry.attributes.position.array.slice()}));
const tailM=new THREE.MeshBasicMaterial({color:0x550000}),headM=new THREE.MeshBasicMaterial({color:0xfff6d0}),plate=new THREE.MeshStandardMaterial({color:0xeeeeee,roughness:.5});
const bl=(g,m,x,y,z)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);chassis.add(o);return o};
for(const s of [-1,1]){
 bl(new THREE.SphereGeometry(.13,12,8),headM,s*.6,.54,1.98).scale.set(1.5,.7,.9);
 bl(new THREE.BoxGeometry(.44,.09,.05),tailM,s*.62,.78,-2.1);
 bl(new THREE.BoxGeometry(.14,.09,.12),paint,s*1.02,1.0,.5);
 bl(new THREE.BoxGeometry(.05,.07,1.0),dark,s*.96,.34,0);
 bl(new THREE.BoxGeometry(.04,.12,.06),dark,s*.4,.94,-2.02);
 bl(new THREE.BoxGeometry(.38,.5,.14),dark,s*.35,1.02,-.45)}
bl(new THREE.BoxGeometry(1.4,.04,.28),paint,0,1.0,-2.03);bl(new THREE.BoxGeometry(1.5,.05,.3),dark,0,.32,1.95);
bl(new THREE.BoxGeometry(.5,.12,.02),plate,0,.5,2.16);bl(new THREE.BoxGeometry(.5,.12,.02),plate,0,.66,-2.16);
bl(new THREE.BoxGeometry(1.3,.18,.35),dark,0,.98,.5);bl(new THREE.TorusGeometry(.17,.02,6,16),dark,-.35,1.1,.3).rotation.x=-.5;
// roues : pneu arrondi + jante à 5 branches
const tyreM=new THREE.MeshStandardMaterial({color:0x151515,roughness:.85}),rimM=new THREE.MeshStandardMaterial({color:0xcfd2d6,metalness:1,roughness:.18}),spM=new THREE.MeshStandardMaterial({color:0x2a2a2e,metalness:.6,roughness:.4});
const tyreG=new THREE.TorusGeometry(.265,.075,14,32).rotateY(Math.PI/2).scale(1.7,1,1),rimG=new THREE.CylinderGeometry(.25,.25,.2,28).rotateZ(Math.PI/2),spG=new THREE.BoxGeometry(.02,.2,.05),hubG=new THREE.CylinderGeometry(.06,.06,.03,12).rotateZ(Math.PI/2);
const wheels=[];
for(const [sx,z,f] of [[-1,1.25,1],[1,1.25,1],[-1,-1.35,0],[1,-1.35,0]]){
 const piv=new THREE.Group();piv.position.set(sx*.86,.33,z);const sp=new THREE.Group();
 const t=new THREE.Mesh(tyreG,tyreM);t.castShadow=true;sp.add(t,new THREE.Mesh(rimG,rimM));
 for(let k=0;k<5;k++){const g=new THREE.Group(),o=new THREE.Mesh(spG,spM);o.position.set(sx*.105,.13,0);g.add(o);g.rotation.x=k*Math.PI*2/5;sp.add(g)}
 const h=new THREE.Mesh(hubG,spM);h.position.x=sx*.105;sp.add(h);piv.add(sp);chassis.add(piv);wheels.push({piv,sp,f})}
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

// ===== Entrées =====
const K={},T={};let camMode=0;
on(window,'keydown',e=>{K[e.code]=1;if(e.code=='KeyC')camMode=(camMode+1)%3;if(e.code=='KeyR'){Object.assign(car,START);repair()}if(e.code=='KeyF')fs();audioInit();if(e.code.startsWith('Arrow')||e.code=='Space')e.preventDefault()});
on(window,'keyup',e=>K[e.code]=0);
root.querySelectorAll('#ad-tc button').forEach(b=>{const k=b.dataset.k;
 b.addEventListener('pointerdown',e=>{T[k]=1;audioInit();e.preventDefault()});
 for(const ev of ['pointerup','pointercancel','pointerleave'])b.addEventListener(ev,()=>T[k]=0)});
function fs(){const d=root;document.fullscreenElement?document.exitFullscreen():(d.requestFullscreen||d.webkitRequestFullscreen||(()=>{})).call(d)}
$('fs').onclick=fs;
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
const GR=[0,3.6,2.2,1.5,1.1,.9,.75],FINAL=3.7;let shake=0;
const torque=r=>r>7000?0:Math.max(80,340*(1-Math.pow((r-4800)/5000,2)));
function hit(nx,nz,pen,cx,cz){
 car.x+=nx*pen;car.z+=nz*pen;const rx=cx-car.x,rz=cz-car.z;
 const vn=(car.vx+car.w*rz)*nx+(car.vz-car.w*rx)*nz;if(vn>=0)return;
 const k=rz*nx-rx*nz,j=-1.25*vn/(1/P.m+k*k/P.Iz);
 car.vx+=j*nx/P.m;car.vz+=j*nz/P.m;car.w+=j*k/P.Iz;
 if(-vn>1.5){const s=Math.sin(car.h),c=Math.cos(car.h),px=rx-nx,pz=rz-nz;
  dent(px*c-pz*s,px*s+pz*c,nx*c-nz*s,nx*s+nz*c,Math.min(.5,(-vn-1.5)*.045));shake=Math.min(1,-vn*.05);crash(-vn)}}
function step(dt){
 const s=Math.sin(car.h),c=Math.cos(car.h),fx=s,fz=c,rx=c,rz=-s;
 const vf=car.vx*fx+car.vz*fz,vr=car.vx*rx+car.vz*rz,sp=Math.hypot(car.vx,car.vz);
 const sf=surf(car.x,car.z),mu=sf.mu;
 const tgt=ctl.str*.55/(1+sp*.045);car.steer+=(tgt-car.steer)*Math.min(1,dt*(ctl.str?6:9));
 let drive=0,brake=0;
 if(ctl.thr){vf<-1?brake=1:drive=1}
 if(ctl.brk){vf>1?brake=1:drive=-1}
 let ratio=drive<0?3.4:GR[car.gear];const rpmW=Math.abs(vf)/P.R*ratio*FINAL*9.549;
 if(drive>=0){if(rpmW>6200&&car.gear<6)car.gear++;else if(rpmW<2300&&car.gear>1)car.gear--}
 ratio=drive<0?3.4:GR[car.gear];
 const wr=Math.abs(vf)/P.R*ratio*FINAL*9.549,rt=Math.max(wr,900+Math.abs(drive)*(sp<10?2800:0));
 car.rpm+=(rt-car.rpm)*Math.min(1,dt*12);
 const Fdrive=drive*torque(car.rpm)*ratio*FINAL*.88/P.R;
 const dn=.15*sp*sp,W=P.m*P.g;
 const Nf=Math.max(.1*W,W*P.b/P.L-P.m*car.ax*P.h/P.L+dn*.4),Nr=Math.max(.1*W,W*P.a/P.L+P.m*car.ax*P.h/P.L+dn*.6);
 const sg=cl(vf/.5,-1,1),BK=14000,lim=(v,m)=>cl(v,-m,m);
 const Fxf=lim(-sg*brake*BK*.62,mu*Nf*.98),Fxr=lim(Fdrive-sg*(brake*BK*.38+ctl.hb*9000),mu*Nr*.98);
 car.spin=Math.abs(Fdrive)>mu*Nr?1:0;
 const vl=Math.max(Math.abs(vf),1.5),dir=vf<0?-1:1;
 const af=Math.atan((vr+P.a*car.w)/vl)-car.steer*dir,ar=Math.atan((vr-P.b*car.w)/vl),Bt=9,Ct=1.45;
 let avf=Math.max(Math.sqrt(Math.max(0,Math.pow(mu*Nf,2)-Fxf*Fxf)),.3*mu*Nf),avr=Math.max(.3*mu*Nr,Math.sqrt(Math.max(0,Math.pow(mu*Nr,2)-Fxr*Fxr)))*(1-.65*ctl.hb);
 const Fyf=-avf*Math.sin(Ct*Math.atan(Bt*af)),Fyr=-avr*Math.sin(Ct*Math.atan(Bt*ar));
 const cd=Math.cos(car.steer),sd=Math.sin(car.steer);
 const rr=P.m*P.g*.015*sf.rr*cl(vf,-1,1);
 const Fx=Fxr+Fxf*cd-Fyf*sd-.4*vf*sp-rr,Fy=Fyr+Fyf*cd+Fxf*sd;
 const Mz=P.a*(Fyf*cd+Fxf*sd)-P.b*Fyr-900*car.w;
 // pente : la gravité tire la voiture vers le bas du relief
 const gx=(H(car.x+1,car.z)-H(car.x-1,car.z))/2,gz=(H(car.x,car.z+1)-H(car.x,car.z-1))/2;
 car.vx+=((Fx*fx+Fy*rx)/P.m-P.g*gx)*dt;car.vz+=((Fx*fz+Fy*rz)/P.m-P.g*gz)*dt;car.w+=Mz/P.Iz*dt;
 if(sp<.6&&!ctl.thr&&!ctl.brk&&Math.hypot(gx,gz)<.08){const d=1-Math.min(1,dt*6);car.vx*=d;car.vz*=d;car.w*=d}
 car.x+=car.vx*dt;car.z+=car.vz*dt;car.h+=car.w*dt;
 const k=Math.min(1,dt*8);car.ax+=(Fx/P.m-car.ax)*k;car.ay+=(Fy/P.m-car.ay)*k;car.vr=vr;
 // collisions : arbres, rochers, cônes
 const near=[],ci=Math.floor(car.x/CS),cj=Math.floor(car.z/CS);
 for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const o of cellObjs(ci+a,cj+b))near.push(o);
 for(const oz of [-1.4,0,1.4]){
  const cx=car.x+s*oz,cz=car.z+c*oz;
  for(const o of near){const dx=cx-o.x,dz=cz-o.z,d=Math.hypot(dx,dz),mn=1+(o.t?o.r*.85:.5);if(d<mn&&d>1e-4)hit(dx/d,dz/d,mn-d,cx,cz)}
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
 while(acc>=1/120){step(1/120);acc-=1/120}
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
 if(camMode==0){const cs=Math.sin(camH),cc2=Math.cos(camH);cp.set(car.x-cs*7.5,cy+3.1,car.z-cc2*7.5);cp.y=Math.max(cp.y,H(cp.x,cp.z)+1);cam.position.lerp(cp,Math.min(1,dt*9));cam.lookAt(car.x+s*4,cy+1.1,car.z+c*4)}
 else if(camMode==1){cam.position.set(car.x+s*.35,cy+1.5,car.z+c*.35);cam.lookAt(car.x+s*20,cy+1.4,car.z+c*20)}
 else{cam.position.set(car.x-s*3.8,cy+.9,car.z-c*3.8);cam.lookAt(car.x+s*3,cy+.6,car.z+c*3)}
 shake*=.9;if(shake>.01){cam.position.x+=(Math.random()-.5)*shake*.5;cam.position.y+=(Math.random()-.5)*shake*.5}
 cam.fov=62+Math.min(18,sp*.5);cam.updateProjectionMatrix();
 sun.position.set(car.x+50,cy+70,car.z+30);sun.target.position.set(car.x,cy,car.z);
 dist+=sp*dt;if(scoreEl)scoreEl.textContent=Math.floor(dist/10)+cones.filter(k=>k.down).length*50;$('spd').textContent=Math.round(sp*3.6);$('gr').textContent=vf<-.5?'R':sp<.5?'N':car.gear;
 $('rbf').style.width=Math.min(100,car.rpm/70)+'%';$('dm').textContent='Dégâts '+Math.min(100,Math.round(car.dmg*18))+'%';
 ren.render(scene,cam)}
raf=requestAnimationFrame(frame);

return function destroy(){cancelAnimationFrame(raf);off.forEach(f=>f());if(AC)try{AC.close()}catch(e){}
 const sc=Math.floor(dist/10)+cones.filter(k=>k.down).length*50;if(sc>0&&window.updateHighScore)try{updateHighScore('beamdrive',sc)}catch(e){}
 ren.dispose();ren.forceContextLoss();root.remove();css.remove();if(isCv)host.style.display=hDisp};
}
})();