/*
 * COLLÈGE TYCOON 3D — refonte complète
 * Three.js r128 est chargé par le chargeur principal (gameConfig.needs3D = true).
 * Aucun modèle ou service externe n'est nécessaire : tout le décor est généré en 3D.
 */
(() => {
  'use strict';

  const THREE = window.THREE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  const STUDENTS = [
    { name: 'Léa', type: 'sage', skin: 0xf1c8a7, hair: 0x4b2e25, clothes: 0xf18b9b, style: 'studieuse' },
    { name: 'Tom', type: 'clown', skin: 0xf0c49e, hair: 0x9a5b2d, clothes: 0xf2bd42, style: 'blagueur' },
    { name: 'Inès', type: 'reporter', skin: 0xd9a27f, hair: 0x241c1a, clothes: 0x8e7bd8, style: 'observatrice' },
    { name: 'Noah', type: 'rebel', skin: 0xe5b18f, hair: 0x302a27, clothes: 0x4c8fca, style: 'rebelle' },
    { name: 'Jade', type: 'sage', skin: 0xf3d0ad, hair: 0x5c392c, clothes: 0x6abf9a, style: 'studieuse' },
    { name: 'Lucas', type: 'athlete', skin: 0xc98c67, hair: 0x30221e, clothes: 0xe46c50, style: 'sportif' },
    { name: 'Emma', type: 'social', skin: 0xf1c8a7, hair: 0x8a4f2d, clothes: 0xe77fae, style: 'sociable' },
    { name: 'Hugo', type: 'curious', skin: 0xe0ae8b, hair: 0x5a4537, clothes: 0x62a6d7, style: 'curieux' },
    { name: 'Manon', type: 'shy', skin: 0xeec3a1, hair: 0x3b2924, clothes: 0x9eaf69, style: 'timide' },
    { name: 'Enzo', type: 'rebel', skin: 0xc98d6c, hair: 0x211f25, clothes: 0x777bdb, style: 'rebelle' },
    { name: 'Camille', type: 'social', skin: 0xe8bfa0, hair: 0x3d2b26, clothes: 0x65a6c9, style: 'sociable' },
    { name: 'Sacha', type: 'curious', skin: 0xdba884, hair: 0x362a24, clothes: 0xd28b52, style: 'curieux' },
    { name: 'Chloé', type: 'sage', skin: 0xf1cba9, hair: 0x9b6740, clothes: 0x9f8bd3, style: 'studieuse' },
    { name: 'Yanis', type: 'athlete', skin: 0xb98262, hair: 0x231f1d, clothes: 0x4eaa8a, style: 'sportif' },
    { name: 'Zoé', type: 'shy', skin: 0xf0c9ab, hair: 0x4e3027, clothes: 0xd88c93, style: 'timide' },
    { name: 'Mathis', type: 'clown', skin: 0xe7bb98, hair: 0x81552e, clothes: 0xe2b946, style: 'blagueur' },
    { name: 'Sarah', type: 'reporter', skin: 0xc99575, hair: 0x201c1a, clothes: 0x6688ce, style: 'observatrice' }
  ];

  const ITEMS = {
    ballon: { icon: '⚽', name: 'Ballon', color: 0xf3f1e8 },
    craie: { icon: '🖍️', name: 'Craie magique', color: 0xf5a6bf },
    slime: { icon: '🟢', name: 'Slime rigolo', color: 0x7be58c },
    enceinte: { icon: '🔊', name: 'Mini enceinte', color: 0x777f9f },
    confetti: { icon: '🎉', name: 'Confettis', color: 0xf7bd42 },
    pomme: { icon: '🍎', name: 'Pomme', color: 0xe84f53 },
    sandwich: { icon: '🥪', name: 'Sandwich', color: 0xd7a35a },
    stickers: { icon: '⭐', name: 'Autocollants', color: 0xffd45c },
    carnet: { icon: '📓', name: 'Carnet', color: 0x6c8fca },
    waterballoon: { icon: '💧', name: 'Bombe à eau', color: 0x69c9ed },
    excuse: { icon: '📄', name: 'Mot d’excuse', color: 0xf3ecd0 },
    badge: { icon: '🏅', name: 'Badge du club', color: 0xf3c65b },
    avion: { icon: '✈️', name: 'Avion en papier', color: 0xffffff },
    banane: { icon: '🍌', name: 'Peau de banane', color: 0xffe14d },
    coussin: { icon: '💨', name: 'Coussin rigolo', color: 0xff8fb6 },
    megaphone: { icon: '📣', name: 'Mégaphone', color: 0xff6b4a },
    lunettes: { icon: '🥸', name: 'Lunettes moustache', color: 0x8a5a3c },
    bulles: { icon: '🫧', name: 'Bulles de savon', color: 0x9fe3ff }
  };

  const PHASES = [
    { id: 'class', name: 'Cours de maths', icon: '📚', duration: 78 },
    { id: 'recess', name: 'Grande récréation', icon: '⚽', duration: 95 },
    { id: 'class2', name: 'Cours de français', icon: '✏️', duration: 78 }
  ];

  const UPGRADES = [
    { id: 'shoes', name: 'Baskets turbo', icon: '👟', cost: 35, desc: 'Tu te déplaces plus vite.' },
    { id: 'bag', name: 'Sac à dos XXL', icon: '🎒', cost: 45, desc: 'Tu peux porter 6 objets.' },
    { id: 'charm', name: 'Badge populaire', icon: '⭐', cost: 55, desc: 'Les élèves te font plus facilement confiance.' },
    { id: 'sneak', name: 'Sweat discret', icon: '🧢', cost: 65, desc: 'La prof repère moins facilement tes petites bêtises.' }
  ];

  let gameInstance = null;

  function installStyles() {
    if (document.getElementById('ecole-tycoon-3d-style')) return;
    const style = document.createElement('style');
    style.id = 'ecole-tycoon-3d-style';
    style.textContent = `
      #game-view.et3d-host{display:block!important;width:100%!important;max-width:none!important;min-width:0!important;overflow:visible!important}#game-view.et3d-host #game-canvas,#game-view.et3d-host #memory-board{display:none!important}
      .et3d{position:relative;display:block;isolation:isolate;width:100%;max-width:none;min-width:0;height:clamp(560px,82vh,900px);min-height:560px;margin:0 auto;overflow:hidden;border-radius:18px;background:#0b1423;color:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 22px 70px rgba(0,0,0,.38);contain:layout paint style;touch-action:none}
      .et3d *{box-sizing:border-box}.et3d-scene{position:absolute;inset:0;width:100%;height:100%;overflow:hidden;background:linear-gradient(#86c8f2,#a5d9f7)}.et3d-scene canvas{display:block!important;width:100%!important;height:100%!important;outline:none;touch-action:none}
      .et3d-hud{position:absolute;inset:0;pointer-events:none;display:flex;flex-direction:column;justify-content:space-between;padding:14px;z-index:2}
      .et3d-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}.et3d-brand,.et3d-stats,.et3d-task,.et3d-controls,.et3d-hotbar,.et3d-toolbar{background:rgba(9,18,34,.82);border:1px solid rgba(255,255,255,.15);box-shadow:0 8px 30px rgba(0,0,0,.2);backdrop-filter:blur(12px);border-radius:14px}
      .et3d-brand{padding:10px 14px;min-width:170px}.et3d-brand strong{display:block;font-size:15px;letter-spacing:.09em}.et3d-brand small{color:#a9bdd7;font-size:10px;letter-spacing:.12em}.et3d-stats{display:flex;gap:14px;align-items:center;padding:10px 13px;font-size:12px;font-weight:750;flex-wrap:wrap}.et3d-stat{white-space:nowrap}.et3d-stat b{color:#ffd66e;font-variant-numeric:tabular-nums}
      .et3d-toolbar{display:flex;gap:6px;padding:5px;pointer-events:auto}.et3d-tool{border:1px solid #ffffff22;border-radius:9px;background:#ffffff12;color:#fff;padding:8px 11px;font-size:11px;font-weight:800;cursor:pointer}.et3d-tool:hover{background:#ffffff25}
      .et3d-bottom{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}.et3d-task{max-width:360px;padding:10px 13px;font-size:12px}.et3d-task strong{display:block;color:#ffdf88;font-size:11px;margin-bottom:4px;letter-spacing:.08em}.et3d-controls{padding:9px 12px;color:#d9e5f6;font-size:11px;line-height:1.7;text-align:right}.et3d-hotbar{display:flex;gap:6px;padding:7px;pointer-events:auto}.et3d-slot{width:46px;height:46px;border:1px solid rgba(255,255,255,.13);border-radius:10px;background:rgba(255,255,255,.08);color:white;display:grid;place-items:center;position:relative;cursor:pointer;font-size:21px}.et3d-slot.active{border-color:#ffd76e;background:rgba(255,205,75,.22);box-shadow:0 0 0 2px rgba(255,215,110,.16)}.et3d-slot small{position:absolute;left:5px;top:3px;font-size:9px;color:#b6c6da}.et3d-slot em{position:absolute;right:5px;bottom:2px;font-size:9px;font-style:normal;color:#fff}
      .et3d-prompt{position:absolute;left:50%;bottom:105px;transform:translateX(-50%);padding:10px 15px;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(8,17,32,.9);font-size:12px;font-weight:750;white-space:nowrap;box-shadow:0 8px 30px #0004;opacity:0;transition:opacity .15s}.et3d-prompt.show{opacity:1}.et3d-toast{position:absolute;left:50%;top:88px;transform:translateX(-50%) translateY(-8px);background:rgba(10,18,32,.94);padding:11px 16px;border:1px solid rgba(255,255,255,.16);border-radius:12px;font-size:13px;font-weight:750;opacity:0;transition:all .2s;max-width:90%;text-align:center}.et3d-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      .et3d-overlay{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(3,8,18,.72);backdrop-filter:blur(9px)}.et3d-overlay.hidden{display:none}.et3d-panel{width:min(600px,96%);max-height:90%;overflow:auto;border:1px solid rgba(255,255,255,.17);border-radius:22px;padding:25px;background:linear-gradient(145deg,rgba(25,43,69,.98),rgba(10,19,34,.98));box-shadow:0 24px 90px #0008;text-align:center}.et3d-panel .eyebrow{font-size:10px;letter-spacing:.22em;color:#8fbef6;font-weight:900}.et3d-panel h1{font-size:clamp(28px,5vw,43px);margin:8px 0 10px;line-height:1.05}.et3d-panel p{color:#c7d5e8;line-height:1.55;font-size:13px}.et3d-panel .sub{color:#f4d37c;font-weight:750}.et3d-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:9px;margin-top:18px}.et3d-btn{border:0;border-radius:11px;padding:11px 16px;background:#ffd166;color:#192234;font-size:13px;font-weight:850;cursor:pointer;transition:transform .12s,filter .12s}.et3d-btn:hover{transform:translateY(-2px);filter:brightness(1.06)}.et3d-btn.secondary{background:#273c59;color:#eaf2ff;border:1px solid #ffffff1c}.et3d-btn:disabled{opacity:.4;cursor:not-allowed;transform:none}.et3d-shop{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;text-align:left}.et3d-shop-item{padding:10px;border:1px solid #ffffff1c;border-radius:12px;background:#ffffff09}.et3d-shop-item b{font-size:12px}.et3d-shop-item small{display:block;color:#aabbd0;margin:4px 0 9px;font-size:10px}.et3d-shop-item button{width:100%;padding:8px}.et3d-mobile{display:none;position:absolute;bottom:82px;left:14px;right:14px;justify-content:space-between;pointer-events:none}.et3d-mobile button{pointer-events:auto;border:1px solid #ffffff55;background:#09182dbb;color:white;border-radius:50%;width:52px;height:52px;font-size:17px;touch-action:none}.et3d-mobile .move{width:64px;height:64px}.et3d-footer{font-size:10px;color:#92a8c2;margin-top:13px}
      .et3d:fullscreen{width:100vw;height:100vh;max-width:none;min-height:0;border-radius:0}.et3d:fullscreen .et3d-scene{height:100%}.et3d:fullscreen .et3d-hud{padding:20px}
      @media(max-width:760px){.et3d{height:78vh;min-height:540px;border-radius:12px}.et3d-hud{padding:8px}.et3d-brand{min-width:0;padding:8px 10px}.et3d-brand strong{font-size:12px}.et3d-brand small{font-size:8px}.et3d-stats{gap:7px;padding:8px;font-size:10px;max-width:100%;justify-content:flex-end}.et3d-bottom{align-items:flex-end}.et3d-task{max-width:70%;font-size:10px;padding:8px}.et3d-controls{display:none}.et3d-slot{width:39px;height:39px}.et3d-prompt{bottom:150px;font-size:10px}.et3d-mobile{display:flex}.et3d-hotbar{gap:4px}.et3d-shop{grid-template-columns:1fr}.et3d-toolbar{margin-left:auto}.et3d-tool{padding:7px 8px}}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function createGame(host) {
    if (!THREE) {
      const error = document.createElement('div');
      error.style.cssText = 'padding:24px;background:#182236;color:white;border-radius:12px;font:15px system-ui';
      error.textContent = 'Impossible de charger le moteur 3D. Vérifie que THREE.js est bien chargé dans main.js.';
      host.appendChild(error);
      return { stop: () => error.remove() };
    }

    const root = document.createElement('div');
    root.className = 'et3d';
    installStyles();
    root.innerHTML = `
      <div class="et3d-scene"></div>
      <div class="et3d-hud">
        <div class="et3d-top">
          <div class="et3d-brand"><strong>🏫 COLLÈGE TYCOON</strong><small>MIDDLE SCHOOL · CAMPUS 3D</small></div>
          <div class="et3d-stats">
            <span class="et3d-stat">📅 Jour <b data-ui="day">1</b></span>
            <span class="et3d-stat">⏱️ <b data-ui="phase">Cours</b> <b data-ui="timer">78</b>s</span>
            <span class="et3d-stat">🪙 <b data-ui="coins">0</b></span>
            <span class="et3d-stat">💛 <b data-ui="adm">50</b>%</span>
            <span class="et3d-stat">⚠️ <b data-ui="strikes">0</b>/3</span><span class="et3d-stat">📍 <b data-ui="zone">Couloir</b></span>
          </div>
          <div class="et3d-toolbar"><button class="et3d-tool" data-action="fullscreen" type="button">⛶ Plein écran</button><button class="et3d-tool" data-action="pause" type="button">Ⅱ Pause</button></div>
        </div>
        <div class="et3d-toast" data-ui="toast"></div>
        <div class="et3d-prompt" data-ui="prompt"></div>
        <div class="et3d-bottom">
          <div style="display:flex;flex-direction:column;gap:7px;align-items:flex-start">
            <div class="et3d-task"><strong>🎯 OBJECTIF DU JOUR</strong><span data-ui="mission">Fais-toi un nouvel ami !</span></div>
            <div class="et3d-hotbar" data-ui="hotbar"></div>
          </div>
          <div class="et3d-controls">ZQSD / WASD : bouger · Clic droit maintenu : tourner<br>Maj : courir · E : interagir · Espace : utiliser / sauter<br>Molette : zoomer · Échap : pause</div>
        </div>
      </div>
      <div class="et3d-mobile"><button class="move" data-mobile="up">↑</button><div style="display:flex;gap:8px"><button data-mobile="talk">E</button><button data-mobile="use">✦</button></div></div>
      <div class="et3d-overlay" data-ui="overlay"></div>
    `;
    if (host && host.id === 'game-view') host.classList.add('et3d-host');
    host.querySelectorAll?.('.et3d').forEach(old => old.remove());
    const oldCanvas = document.getElementById('game-canvas');
    if (oldCanvas) oldCanvas.classList.add('hidden');
    host.appendChild(root);

    const $ = s => root.querySelector(s);
    const sceneHost = $('.et3d-scene');
    const overlay = $('[data-ui="overlay"]');
    const promptEl = $('[data-ui="prompt"]');
    const toastEl = $('[data-ui="toast"]');
    const hotbarEl = $('[data-ui="hotbar"]');

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setSize(sceneHost.clientWidth || 960, sceneHost.clientHeight || 620);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.setAttribute('aria-label', 'Jeu École Tycoon en 3D');
    renderer.domElement.tabIndex = 0;
    sceneHost.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x91d1f5);
    scene.fog = new THREE.Fog(0xb4dcf2, 90, 195);
    const camera = new THREE.PerspectiveCamera(57, (sceneHost.clientWidth || 960) / (sceneHost.clientHeight || 620), 0.3, 200);
    let cameraYaw = 0;
    let cameraPitch = 0.34;
    let cameraDistance = 10.5;

    const hemi = new THREE.HemisphereLight(0xe8f5ff, 0x5a784a, 1.18);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1d1, 1.55);
    sun.position.set(-24, 38, -18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -48;
    sun.shadow.camera.right = 48;
    sun.shadow.camera.top = 48;
    sun.shadow.camera.bottom = -48;
    sun.shadow.bias = -0.00035;
    scene.add(sun);

    const mat = (color, roughness = 0.82, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    // Textures procédurales haute résolution : briques, enduit, carrelage, béton, pelouse et tuiles.
    function makeSurfaceTexture(kind, size = 512) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      const c = canvas.getContext('2d');
      const palettes = {
        brick: ['#a96e55','#bd8062','#c18a6c','#9e654e'], plaster: ['#d7d3c8','#e3dfd4','#c9c6bd'],
        tile: ['#bfc9c9','#d5d9d5','#c8d0cf'], warmTile: ['#bcae96','#d2c4aa','#c6b99f'],
        concrete: ['#969d9b','#a6aaa5','#888f8f'], grass: ['#4f854d','#5e9654','#6ba15a','#477d49'],
        asphalt: ['#535b5d','#62696a','#485153'], roof: ['#46596c','#53677a','#3c5064'], wood: ['#805b3c','#9a704b','#b08358']
      };
      const p = palettes[kind] || palettes.plaster;
      c.fillStyle = p[0]; c.fillRect(0,0,size,size);
      if (kind === 'brick') {
        const bw=128,bh=58;
        for(let y=0,row=0;y<size+bh;y+=bh,row++){
          const offset=row%2?bw/2:0;
          for(let x=-bw;x<size+bw;x+=bw){
            c.fillStyle=p[(row+Math.floor(x/bw)+1)%p.length]; c.fillRect(x+offset+3,y+3,bw-6,bh-6);
            c.fillStyle='rgba(58,43,36,.16)'; c.fillRect(x+offset+4,y+bh-7,bw-8,3);
          }
        }
      } else if (kind === 'tile' || kind === 'warmTile') {
        const step=64;
        for(let y=0;y<size;y+=step) for(let x=0;x<size;x+=step){
          c.fillStyle=p[(x/step+y/step)%p.length|0]; c.fillRect(x+2,y+2,step-4,step-4);
          c.strokeStyle='rgba(80,85,83,.17)'; c.lineWidth=2; c.strokeRect(x+2,y+2,step-4,step-4);
        }
      } else if (kind === 'roof') {
        for(let y=0,row=0;y<size+42;y+=42,row++) for(let x=-72;x<size+72;x+=72){
          const ox=row%2?36:0; c.fillStyle=p[(row+Math.floor(x/72))%p.length]; c.fillRect(x+ox+2,y+2,68,38);
          c.strokeStyle='rgba(15,27,41,.25)'; c.lineWidth=3; c.strokeRect(x+ox+2,y+2,68,38);
          c.strokeStyle='rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(x+ox+9,y+8); c.lineTo(x+ox+55,y+8); c.stroke();
        }
      } else if (kind === 'wood') {
        for(let y=0;y<size;y+=48){ c.fillStyle=p[(y/48|0)%p.length]; c.fillRect(0,y,size,46); c.strokeStyle='rgba(47,34,23,.3)'; c.beginPath(); c.moveTo(0,y+46); c.lineTo(size,y+46); c.stroke();
          for(let k=0;k<7;k++){const yy=y+rand(5,40);c.strokeStyle='rgba(55,34,20,.12)';c.beginPath();c.moveTo(0,yy);c.bezierCurveTo(130,yy-6,310,yy+7,size,yy-2);c.stroke();}
        }
      }
      // Grain fin pour éviter les grandes aplats artificiels.
      const count=kind==='grass'?6500:2500;
      for(let i=0;i<count;i++){const x=Math.random()*size,y=Math.random()*size;c.fillStyle=Math.random()>.5?'rgba(255,255,255,.055)':'rgba(15,20,20,.045)';c.fillRect(x,y,kind==='grass'?2:1,kind==='grass'?2:1);}
      const tex=new THREE.CanvasTexture(canvas); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.anisotropy=4; tex.encoding=THREE.sRGBEncoding;
      return tex;
    }
    const surfaceTextures = {
      brick: makeSurfaceTexture('brick'), plaster: makeSurfaceTexture('plaster'), tile: makeSurfaceTexture('tile'),
      warmTile: makeSurfaceTexture('warmTile'), concrete: makeSurfaceTexture('concrete'), grass: makeSurfaceTexture('grass'),
      asphalt: makeSurfaceTexture('asphalt'), roof: makeSurfaceTexture('roof'), wood: makeSurfaceTexture('wood')
    };
    const textured = (texture, color = 0xffffff, roughness = .9, bump = .025) => new THREE.MeshStandardMaterial({ color, map: texture, bumpMap: texture, bumpScale: bump, roughness });
    const mats = {
      grass: textured(surfaceTextures.grass, 0xffffff, 1, .08), darkGrass: mat(0x579d5e),
      path: textured(surfaceTextures.concrete, 0xffffff, .95, .035), concrete: textured(surfaceTextures.asphalt, 0xffffff, .98, .05),
      wall: textured(surfaceTextures.brick, 0xffffff, .93, .045), wall2: textured(surfaceTextures.plaster, 0xffffff, .96, .025),
      roof: textured(surfaceTextures.roof, 0xffffff, .9, .035), wood: textured(surfaceTextures.wood, 0xffffff, .9, .04), woodLight: mat(0xc38b59),
      metal: mat(0x667b8e, .45, .55), floorBlue: textured(surfaceTextures.tile, 0xffffff, .7, .012),
      floorGreen: textured(surfaceTextures.tile, 0xe5f0e4, .72, .012), floorWarm: textured(surfaceTextures.warmTile, 0xffffff, .78, .012),
      locker: mat(0x6e93a5), glass: new THREE.MeshStandardMaterial({ color: 0x89cce8, roughness: .18, metalness: .12, transparent: true, opacity: .72 }),
      blackboard: mat(0x244c45), white: mat(0xf5f1e8), red: mat(0xed6a64), yellow: mat(0xffd16c), blue: mat(0x4f91ce), green: mat(0x69b77b)
    };

    const world = { solids: [], walls: [], interactables: [], pickups: [], spots: [], fx: [], scenery: [] };
    const addBox = (x, y, z, w, h, d, material, cast = true, receive = true) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y + h / 2, z);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      scene.add(mesh);
      return mesh;
    };
    const addSphere = (x, y, z, r, material, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), material);
      m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
    };
    const addSolid = (x, z, radius) => world.solids.push({ x, z, radius });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 270), mats.grass);
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.12, 28); ground.receiveShadow = true; scene.add(ground);
    mats.grass.polygonOffset = true; mats.grass.polygonOffsetFactor = 2; mats.grass.polygonOffsetUnits = 2;

    // Campus étendu : clôture périphérique, trottoirs et allées qui relient les différents bâtiments.
    function makeFenceLine(x1,z1,x2,z2,steps=24) {
      for(let i=0;i<=steps;i++){
        const t=i/steps,x=x1+(x2-x1)*t,z=z1+(z2-z1)*t;
        addBox(x,0,z,.18,1.65,.18,mats.metal,false);
      }
      const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz),ang=Math.atan2(dz,dx);
      for(const y of [.55,1.45]){const rail=addBox((x1+x2)/2,y,(z1+z2)/2,len,.08,.08,mats.metal,false);rail.rotation.y=-ang;}
    }
    makeFenceLine(-82,-60,82,-60,48); makeFenceLine(-82,138,82,138,48);
    makeFenceLine(-82,-60,-82,138,56); makeFenceLine(82,-60,82,138,56);
    // Allée centrale et ramifications vers les ailes.
    addBox(0,-.015,15,14,.08,82,mats.path,false);
    addBox(-39,-.012,-18,34,.07,5,mats.path,false); addBox(39,-.012,-18,34,.07,5,mats.path,false);
    addBox(0,-.01,43,48,.07,5,mats.path,false);
    // Bande de trottoir avec bordures en béton autour des bâtiments annexes.

    // Bâtiment fermé : murs extérieurs, portes et toiture à deux pans.
    // La toiture reste opaque et visible : la caméra d'intérieur reste sous les pans du toit.
    addBox(0, -.12, -26.5, 35, .12, 25, mats.path, false);
    addBox(0, 0, -39, 35, 4.2, .65, mats.wall, true);
    addBox(-17.2, 0, -26.5, .65, 4.2, 25, mats.wall, true);
    addBox(17.2, 0, -26.5, .65, 4.2, 25, mats.wall, true);
    // Trois accès distincts évitent le bouchon à la sonnerie : porte centrale et deux portes latérales.
    addBox(-13.5, 0, -14.2, 8.0, 4.2, .65, mats.wall, true);
    addBox(-4.2, 0, -14.2, 4.5, 4.2, .65, mats.wall, true);
    addBox(4.2, 0, -14.2, 4.5, 4.2, .65, mats.wall, true);
    addBox(13.5, 0, -14.2, 8.0, 4.2, .65, mats.wall, true);
    // Encadrements des portes latérales.
    for(const dx of [-8,8]){
      addBox(dx-1.55,0,-14.12,.14,2.85,.2,mats.wood,false);
      addBox(dx+1.55,0,-14.12,.14,2.85,.2,mats.wood,false);
      addBox(dx,2.85,-14.12,3.2,.14,.2,mats.wood,false);
      addBox(dx,0,-13.85,2.8,2.55,.055,mats.glass,false,false);
    }
    world.walls.push(
      { minX: -17.55, maxX: 17.55, minZ: -39.48, maxZ: -38.52 },
      { minX: -17.58, maxX: -16.82, minZ: -39.0, maxZ: -13.8 },
      { minX: 16.82, maxX: 17.58, minZ: -39.0, maxZ: -13.8 },
      { minX: -17.48, maxX: -9.5, minZ: -14.58, maxZ: -13.82 },
      { minX: -6.45, maxX: -1.95, minZ: -14.58, maxZ: -13.82 },
      { minX: 1.95, maxX: 6.45, minZ: -14.58, maxZ: -13.82 },
      { minX: 9.5, maxX: 17.48, minZ: -14.58, maxZ: -13.82 }
    );
    const roofGroup = new THREE.Group();
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: surfaceTextures.roof, bumpMap: surfaceTextures.roof, bumpScale: .035, roughness: .9, side: THREE.DoubleSide });
    const roofEdgeMat = new THREE.MeshStandardMaterial({ color: 0x26394e, roughness: .9 });
    function roofQuad(points, material) {
      const geo = new THREE.BufferGeometry();
      const verts = new Float32Array([...points[0], ...points[1], ...points[2], ...points[0], ...points[2], ...points[3]]);
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3)); geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, material); mesh.castShadow = true; mesh.receiveShadow = true; roofGroup.add(mesh); return mesh;
    }
    function roofTriangle(points, material) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3)); geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, material); mesh.castShadow = true; mesh.receiveShadow = true; roofGroup.add(mesh); return mesh;
    }
    roofQuad([[-18,4.28,-13.65],[18,4.28,-13.65],[18,6.05,-26.5],[-18,6.05,-26.5]], roofMat);
    roofQuad([[-18,6.05,-26.5],[18,6.05,-26.5],[18,4.28,-39.35],[-18,4.28,-39.35]], roofMat);
    roofTriangle([[-18,4.22,-13.68],[-18,4.22,-39.32],[-18,6.06,-26.5]], roofEdgeMat);
    roofTriangle([[18,4.22,-39.32],[18,4.22,-13.68],[18,6.06,-26.5]], roofEdgeMat);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(36.3,.32,.34), roofEdgeMat); ridge.position.set(0,6.12,-26.5); ridge.castShadow = true; roofGroup.add(ridge);
    for (const z of [-13.7,-39.3]) {
      const fascia = new THREE.Mesh(new THREE.BoxGeometry(36.2,.28,.32), roofEdgeMat); fascia.position.set(0,4.2,z); roofGroup.add(fascia);
    }
    // Lignes de tuiles stylisées pour donner une vraie lecture de toiture.
    for (let i=1;i<7;i++) {
      const t=i/7, z1=-13.68-(13.0*t), y1=4.28+1.77*t;
      const z2=-39.32+(12.8*t), y2=4.28+1.77*t;
      const tile1=new THREE.Mesh(new THREE.BoxGeometry(36.05,.035,.07), roofEdgeMat); tile1.position.set(0,y1,z1); tile1.rotation.x=Math.atan2(1.77,12.85); roofGroup.add(tile1);
      const tile2=new THREE.Mesh(new THREE.BoxGeometry(36.05,.035,.07), roofEdgeMat); tile2.position.set(0,y2,z2); tile2.rotation.x=-Math.atan2(1.77,12.85); roofGroup.add(tile2);
    }
    scene.add(roofGroup);

    // Quatre sols de salles : deux classes au fond, bibliothèque/arts et cantine à l'avant.
    addBox(-9.5, .005, -32.4, 14.8, .035, 12.8, mats.floorBlue, false);
    addBox(9.5, .005, -32.4, 14.8, .035, 12.8, mats.floorGreen, false);
    addBox(-9.5, .005, -20.2, 14.8, .035, 11.8, mats.floorWarm, false);
    addBox(9.5, .005, -20.2, 14.8, .035, 11.8, mats.floorWarm, false);
    // Couloir central : murs segmentés pour laisser de vraies portes.
    const addPartitionWall = (x, z, w, d, h = 3.55, material = mats.wall2) => {
      addBox(x, 0, z, w, h, d, material, true);
      world.walls.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    };
    for (const x of [-2.25, 2.25]) {
      addPartitionWall(x, -37.1, .24, 3.0);
      addPartitionWall(x, -28.0, .24, 8.0);
      addPartitionWall(x, -17.0, .24, 5.4);
      // Door frames au niveau des ouvertures.
      addBox(x, 0, -34.55, .18, 2.5, .18, mats.wood, false);
      addBox(x, 0, -22.2, .18, 2.5, .18, mats.wood, false);
    }
    // Cloisons entre les salles avant et arrière, avec une porte dans chaque aile.
    addPartitionWall(-13.7, -25.45, 5.8, .22, 3.35);
    addPartitionWall(-4.7, -25.45, 5.3, .22, 3.35);
    addPartitionWall(4.7, -25.45, 5.3, .22, 3.35);
    addPartitionWall(13.7, -25.45, 5.8, .22, 3.35);
    // Encadrements des portes et fenêtres arrière.
    for (let i = 0; i < 5; i++) {
      const x = -13.5 + i * 6.7;
      addBox(x, 2.0, -39.32, 3.2, 1.55, .06, mats.glass, false, false);
      addBox(x, 1.95, -39.38, .08, 1.7, .07, mats.white, false, false);
    }
    // Tableaux des deux salles de classe.
    for (const x of [-9.5, 9.5]) {
      addBox(x, 1.12, -38.55, 9.5, 2.0, .18, mats.blackboard, false);
      addBox(x, 2.15, -38.4, 10.0, .14, .3, mats.woodLight, false);
      addBox(x, .12, -38.35, 3.2, .12, .36, mats.wood, false);
    }
    // Pupitre de la professeure dans la classe 102.
    addBox(9.5, 0, -35.7, 2.4, .95, 1.2, mats.woodLight, true);
    addBox(9.5, .95, -35.7, 2.6, .12, 1.35, mats.wood, true);

    // Bureaux élèves : dix places réparties dans les deux salles de classe.
    const seats = [];
    const seatPoints = [
      [-14.0,-35],[-9.5,-35],[-5.0,-35],[-14.0,-31.5],[-9.5,-31.5],[-5.0,-31.5],[-14.0,-28],[-9.5,-28],[-5.0,-28],
      [5.0,-35],[9.5,-35],[14.0,-35],[5.0,-31.5],[9.5,-31.5],[14.0,-31.5],[5.0,-28],[9.5,-28],[14.0,-28]
    ];
    let seatIndex = 0;
    for (const [x, z] of seatPoints) {
      const desk = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.25, .16, 1.25), mats.woodLight); top.position.y = .86; top.castShadow = true; desk.add(top);
      for (const dx of [-1, 1]) for (const dz of [-.45, .45]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.12, .85, .12), mats.wood); leg.position.set(dx * .94, .42, dz); desk.add(leg); }
      desk.position.set(x, 0, z); scene.add(desk);
      world.solids.push({ x, z, radius: .58 });
      const chair = new THREE.Group();
      const cs = new THREE.Mesh(new THREE.BoxGeometry(.85, .15, .78), mats.blue); cs.position.y = .48; chair.add(cs);
      const back = new THREE.Mesh(new THREE.BoxGeometry(.85, .9, .12), mats.blue); back.position.set(0, .95, .32); chair.add(back);
      chair.position.set(x, 0, z + 1.15); scene.add(chair);
      seats.push({ x, z: z + 1.15, desk, chair, index: seatIndex++ });
    }
    // Étiquettes de salle et lumières suspendues.
    const roomLamp = mat(0xfff3c4, .3);
    for (const [x, z] of [[-9.5, -32], [9.5, -32], [-9.5, -20], [9.5, -20]]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.4, .08, .55), roomLamp); lamp.position.set(x, 3.65, z); scene.add(lamp);
      const glow = new THREE.PointLight(0xffedc2, .78, 12); glow.position.set(x, 3.2, z); scene.add(glow);
    }
    // Couloir : carrelage, casiers, panneaux et portes visibles.
    addBox(0, .025, -26.5, 4.1, .035, 24.5, mat(0xb7c8ce), false);
    /* ===== v3 : casiers, classes, escalier, étage ===== */
    const EL = 4.4;
    world.walls2 = []; world.solids2 = [];
    function makeLocker(x, z, face, col, n) {
      const cols = [0x2f7fb5, 0xe0733a, 0x3f9e72, 0x7b5bb8], c = cols[col % 4], g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(.62, 2.0, .7), mat(c, .5, .25)); body.position.y = 1.05; g.add(body);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(.64, .08, .72), mat(0x20303d)); cap.position.y = 2.08; g.add(cap);
      const door = new THREE.Group(); door.position.set(-.27, 0, -.37);
      const dm = new THREE.Mesh(new THREE.BoxGeometry(.54, 1.82, .04), mat(c, .4, .3)); dm.position.set(.27, 1.05, 0); door.add(dm);
      for (let i = 0; i < 4; i++) { const v = new THREE.Mesh(new THREE.BoxGeometry(.3, .02, .02), mat(0x14202a)); v.position.set(.27, 1.78 - i * .07, -.03); door.add(v); }
      const h = new THREE.Mesh(new THREE.BoxGeometry(.04, .2, .05), mats.metal); h.position.set(.47, 1.0, -.05); door.add(h);
      const pl = new THREE.Mesh(new THREE.BoxGeometry(.16, .08, .02), mats.white); pl.position.set(.27, 1.55, -.03); door.add(pl);
      if (n % 5 === 0) { const st = new THREE.Mesh(new THREE.PlaneGeometry(.22, .22), mat([0xffd447, 0xff6b8b, 0x8be0ff][n % 3], .6)); st.position.set(.27, .6, -.03); st.rotation.y = Math.PI; door.add(st); }
      door.rotation.y = n % 7 === 3 ? .85 : 0; g.add(door);
      g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.rotation.y = face > 0 ? -Math.PI / 2 : Math.PI / 2; g.position.set(x, 0, z); return g;
    }
    for (let z = -37, n = 0; z <= -17; z += 3.4, n++) for (const side of [-1, 1]) { scene.add(makeLocker(side * 1.68, z, -side, n, n * 2 + (side > 0 ? 1 : 0))); world.solids.push({ x: side * 1.68, z, radius: .45 }); }
    addBox(0, .05, -26.5, .5, .01, 24, mat(0xffd447, .7), false);
    for (const z of [-34, -28, -22, -17]) addBox(0, 3.45, z, 3.2, .05, .5, mat(0xfff3c4, .3), false);
    function decorateClassrooms() {
      const sprites = [];
      for (const R of [{ cx: -9.5, wall: 0x3d9bb8, l: -16.8, r: -2.38, n: 'CLASSE 101', dx: -1.9 }, { cx: 9.5, wall: 0xe2874a, l: 2.38, r: 16.8, n: 'CLASSE 102', dx: 1.9 }]) {
        const pm = mat(R.wall, .8);
        for (const x of [R.l, R.r]) addBox(x, 0, -32.1, .06, 1.15, 13, pm, false);
        const sx = R.cx < 0 ? 1 : -1, wx = R.cx < 0 ? R.l + .3 : R.r - .3, cx2 = R.cx < 0 ? R.r - .3 : R.l + .3;
        addBox(wx, 0, -29.6, .5, 1.8, 3.4, mats.wood, true); world.solids.push({ x: wx, z: -29.6, radius: 1.1 });
        for (let i = 0; i < 9; i++) addBox(wx + sx * .27, 1.0 + (i % 3) * .5, -31 + i * .35, .06, .38, .26, mat([0xd9534f, 0x4a90d9, 0xf0ad4e, 0x5cb85c, 0x9b59b6][i % 5], .7), false);
        for (const [px, pz] of [[wx, -38.1], [cx2, -38.1], [wx, -26.2]]) { addBox(px, 0, pz, .5, .5, .5, mat(0xb5654a, .8)); addSphere(px, 1.0, pz, .5, mat(0x3f8f4a, .9), 1, 1.2, 1); addSphere(px + .15, 1.5, pz, .32, mat(0x4aa65a, .9)); }
        for (let i = 0; i < 3; i++) addBox(R.cx < 0 ? R.l + .05 : R.r - .05, 1.7 + (i % 2) * .5, -35.5 + i * 3.4, .05, 1.1, 1.5, mat([0xffcf75, 0x9fd6c2, 0xf4a9b4][i], .8), false);
        addBox(R.cx, .03, -36.4, 6, .02, 2.2, mat(0x9a3b4a, .9), false);
        addBox(R.cx, 3.35, -31.5, .6, .25, .8, mat(0x2b2f36), false);
        if (R.cx < 0) { addBox(-9.5, 0, -35.7, 2.4, .95, 1.2, mats.woodLight, true); addBox(-9.5, .95, -35.7, 2.6, .12, 1.35, mats.wood, true); world.solids.push({ x: -9.5, z: -35.7, radius: 1.2 }); }
        addBox(R.cx, 1.07, -35.55, .6, .04, .4, mat(0x2b2f36), false); addBox(R.cx, 1.1, -35.78, .6, .35, .03, mat(0x2b2f36), false);
        sprites.push([R.dx, -33.8, R.n]);
      }
      for (const [x, z, t] of sprites) { const s = makeTextSprite(t, { fontSize: 32, height: 58, scale: .0062, bg: 'rgba(20,60,90,.95)' }); s.position.set(x, 3.0, z); scene.add(s); }
    }
    decorateClassrooms();
    // Escalier du rez-de-chaussée (au fond du couloir)
    for (let i = 0; i < 6; i++) addBox(0, 0, -36.3 - i * .4, 3.4, .22 + i * .2, .4, mat(0xc9c0b0, .8), true);
    world.walls.push({ minX: -1.7, maxX: 1.7, minZ: -38.7, maxZ: -35.95 });
    addBox(-1.75, 0, -37.4, .08, 1.0, 2.7, mats.metal, false); addBox(1.75, 0, -37.4, .08, 1.0, 2.7, mats.metal, false);
    { const s = makeTextSprite('⬆ ÉTAGE', { fontSize: 34, height: 60, scale: .0066, bg: 'rgba(200,90,30,.95)' }); s.position.set(0, 3.0, -36.2); scene.add(s); }
    addInteractable({ kind: 'stairs', name: 'Escalier', x: 0, z: -35.1, radius: 2.8, prompt: '⬆️ Monter à l’étage', lv: 0, to: 1 });
    // ----- Étage -----
    const U = (x, y, z, w, h, d, m, cast = true) => addBox(x, y + EL, z, w, h, d, m, cast, true);
    const upSolid = (x, z, r) => world.solids2.push({ x, z, radius: r });
    function upWall(x0, x1, z0, z1, h = 3.5, m = mats.wall2) { U((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, h, z1 - z0, m); world.walls2.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 }); }
    function upSprite(t, x, y, z, bg = 'rgba(20,50,80,.92)') { const s = makeTextSprite(t, { fontSize: 30, height: 56, scale: .0062, bg }); s.position.set(x, y + EL, z); scene.add(s); }
    function upAct(act, x, z, r, prompt) { addInteractable({ kind: 'up', act, name: prompt, x, z, radius: r, prompt, lv: 1 }); }
    function buildUpstairs() {
      roofGroup.position.y = EL;
      addBox(0, EL - .2, -26.5, 35.2, .2, 25.6, mat(0xd8d2c4, .9), true);
      U(0, 0, -39, 35.4, 4.2, .65, mats.wall); U(0, 0, -14.2, 35.4, 4.2, .65, mats.wall);
      U(-17.2, 0, -26.6, .65, 4.2, 25, mats.wall); U(17.2, 0, -26.6, .65, 4.2, 25, mats.wall);
      for (let i = 0; i < 5; i++) { campusWindow(-13.5 + i * 6.7, EL + 1.1, -39.4, 3.2, 1.7, .08); campusWindow(-13.5 + i * 6.7, EL + 1.1, -13.84, 3.2, 1.7, .08); }
      for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) sideWindow(sd * 17.62, EL + 1.1, -35 + i * 6.6, 4.2, 1.7, sd);
      const rooms = [[-38.6, -30.5], [-30.5, -22.4], [-22.4, -18.35], [-18.35, -14.3]], FL = [[0x9fc7d8, 0xd9b3e6, 0xa6d6b0, 0xf1b3b3], [0xf2c27e, 0xd7c19a, 0xb8c7d3, 0x8a9fb5]];
      U(0, 0, -26.5, 4.5, .04, 24.4, mat(0xc4d2d8, .5), false);
      rooms.forEach(([a, b], i) => { U(-9.6, 0, (a + b) / 2, 14.6, .04, b - a, mat(FL[0][i], .7), false); U(9.6, 0, (a + b) / 2, 14.6, .04, b - a, mat(FL[1][i], .7), false); });
      const DZ = [-34.55, -26.45, -20.4, -16.3];
      for (const sx of [-1, 1]) {
        let st = -38.6; for (const d of DZ) { if (d - 1.2 > st) upWall(sx * 2.25 - .12, sx * 2.25 + .12, st, d - 1.2); st = d + 1.2; } upWall(sx * 2.25 - .12, sx * 2.25 + .12, st, -14.3);
        for (const z of [-30.5, -22.4, -18.35]) upWall(sx > 0 ? 2.37 : -16.9, sx > 0 ? 16.9 : -2.37, z - .1, z + .1);
      }
      const NM = [['🧪 LABO', '🎨 ARTS'], ['🎵 MUSIQUE', '📚 CDI'], ['💻 INFO', '🚽 WC'], ['🩺 INFIRMERIE', '🔐 DIRECTION']];
      DZ.forEach((d, i) => { upSprite(NM[i][0], -1.9, 3.0, d); upSprite(NM[i][1], 1.9, 3.0, d); });
      // casiers de l'étage
      for (let z = -37, n = 0; z <= -15; z += 3.4, n++) { if (DZ.some(d => Math.abs(z - d) < 2.0)) continue; for (const sd of [-1, 1]) { const l = makeLocker(sd * 1.68, z, -sd, n + 2, n * 3 + (sd > 0 ? 1 : 2)); l.position.y = EL; scene.add(l); upSolid(sd * 1.68, z, .45); } }
      // Labo
      for (const x of [-13.5, -9.5, -5.5]) { U(x, 0, -34.2, 3.0, .9, 1.1, mat(0xe8eef2, .6)); U(x, .9, -34.2, 3.1, .06, 1.2, mat(0x2b3a44, .4)); upSolid(x - .8, -34.2, .8); upSolid(x + .8, -34.2, .8);
        for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.1, .12, .3, 10), mat([0xe84a4a, 0x4ac96b, 0x4a8fe8][i], .2)); b.position.set(x - .8 + i * .8, EL + 1.1, -34.2); scene.add(b); } }
      U(-9.5, 1.4, -38.3, 3.8, 1.6, .05, mat(0xf2e9c9, .9), false); upSprite('⚗ TABLEAU PÉRIODIQUE', -9.5, 2.2, -38.2, 'rgba(60,40,20,.9)');
      // Musique
      for (const [dx, r, h] of [[0, .45, .5], [-.7, .25, .3], [.7, .25, .3]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), mat(0xc0392b, .4)); c.position.set(-12.5 + dx, EL + .6 + (dx ? .3 : 0), -26.2); scene.add(c); }
      upSolid(-12.5, -26.2, 1.1);
      U(-5, 0, -23.4, 2.4, 1.0, .8, mat(0x15171c, .3)); U(-5, 1.0, -23.55, 2.3, .06, .5, mats.white); upSolid(-5, -23.4, 1.2);
      for (const x of [-15.8, -1.9 - 0.4]) U(x, 0, -29.8, .6, 1.1, .5, mat(0x22252b, .6));
      // Info
      for (const x of [-15, -12, -9, -6]) { U(x, 0, -22.0, 2.0, .75, .8, mats.woodLight); U(x, 1.0, -22.2, .75, .45, .05, mat(0x10131a, .3)); U(x, 1.05, -22.17, .65, .35, .02, new THREE.MeshStandardMaterial({ color: 0x3a8fd9, emissive: 0x1d5a9a, emissiveIntensity: .8 }), false); upSolid(x, -22.0, .8); }
      // Infirmerie
      U(-14, 0, -15.4, 2.1, .5, .9, mats.white); U(-14, .5, -15.4, 2.0, .12, .85, mat(0x6bb3e0, .8)); U(-14.8, .6, -15.4, .5, .12, .6, mats.white); upSolid(-14, -15.4, 1.0);
      U(-4.5, 0, -14.8, 1.4, 1.7, .5, mats.white); U(-4.5, 1.0, -14.53, .5, .08, .02, mat(0xd62d2d)); U(-4.5, .8, -14.53, .08, .5, .02, mat(0xd62d2d)); upSolid(-4.5, -14.8, .8);
      // Arts
      for (const x of [6, 10, 14]) { U(x, .1, -36, .1, 1.9, .1, mats.wood); U(x - .5, .1, -35.8, .08, 1.8, .08, mats.wood); U(x + .5, .1, -35.8, .08, 1.8, .08, mats.wood); U(x, 1.0, -36.05, 1.3, 1.0, .06, mat([0xf4c95d, 0x7ec8e3, 0xe78fb3][(x / 4) | 0 % 3] || 0xffffff, .8)); upSolid(x, -35.9, .7); }
      U(9.5, 0, -32.2, 3.0, .85, 1.0, mats.woodLight); upSolid(8.7, -32.2, .8); upSolid(10.3, -32.2, .8);
      for (let i = 0; i < 4; i++) U(8.4 + i * .65, .85, -32.2, .2, .2, .2, mat([0xe84a4a, 0xf4c95d, 0x4a8fe8, 0x4ac96b][i], .5), false);
      // CDI
      U(16.4, 0, -26.5, .5, 2.2, 6, mats.wood); upSolid(16.4, -28, .8); upSolid(16.4, -25, .8);
      for (let i = 0; i < 12; i++) U(16.1, .3 + (i % 4) * .5, -29 + i * .5, .08, .4, .3, mat([0xd9534f, 0x4a90d9, 0xf0ad4e, 0x5cb85c, 0x9b59b6][i % 5], .7), false);
      U(9, 0, -26.5, 3.0, .8, 1.4, mats.woodLight); upSolid(8.2, -26.5, .9); upSolid(9.8, -26.5, .9);
      for (const [x, z] of [[5, -24], [12.5, -24]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(.6, 12, 8), mat(0xd9738a, .9)); b.scale.y = .55; b.position.set(x, EL + .35, z); scene.add(b); }
      // WC
      for (const x of [6, 9, 12]) { U(x, 0, -21.8, 1.4, 2.0, .06, mat(0x7fb5c9, .6)); U(x - .7, 0, -22.1, .06, 2.0, .6, mat(0x7fb5c9, .6)); U(x, 0, -22.2, .45, .45, .6, mats.white); upSolid(x, -22.0, .5); }
      U(15.2, 0, -20.4, .5, .9, 2.2, mats.white); upSolid(15.2, -20.4, 1.0);
      // Direction
      U(8, 0, -16.4, 2.6, .9, 1.2, mats.woodLight); U(8, .9, -16.4, 2.7, .1, 1.3, mats.wood); upSolid(8, -16.4, 1.3);
      U(15.8, 0, -15.4, 1.1, 1.2, .8, mat(0x4a5058, .4, .6)); { const w = new THREE.Mesh(new THREE.TorusGeometry(.22, .04, 8, 16), mats.metal); w.position.set(15.8, EL + .75, -15.0); scene.add(w); } upSolid(15.8, -15.4, .8);
      U(4.2, 0, -14.8, .5, 2.0, 2.2, mats.wood); upSolid(4.2, -14.8, .9);
      // escalier (retour) + garde-corps
      U(0, 0, -37.9, 3.4, 1.0, .1, mats.metal, false); U(-1.75, 0, -36.9, .08, 1.0, 2.1, mats.metal, false); U(1.75, 0, -36.9, .08, 1.0, 2.1, mats.metal, false);
      upSprite('⬇ REZ-DE-CHAUSSÉE', 0, 3.0, -36.4, 'rgba(200,90,30,.95)');
      upAct('stairs', 0, -35.3, 2.6, '⬇️ Descendre au rez-de-chaussée');
      upAct('labo', -9.5, -32.9, 3.4, '🧪 Faire une expérience'); upAct('clue0', -9.5, -37.5, 2.4, '🔎 Observer l’affiche');
      upAct('drums', -12.5, -27.6, 2.6, '🥁 Jouer de la batterie'); upAct('piano', -5, -25.0, 2.4, '🎹 Jouer du piano');
      upAct('info', -10.5, -20.6, 3.2, '💻 Utiliser un ordinateur'); upAct('clue1', -6, -20.6, 1.7, '🔎 Lire l’écran');
      upAct('nurse', -11, -16.6, 3.2, '🩺 Voir l’infirmière');
      upAct('art', 9.5, -33.4, 3.4, '🎨 Peindre'); upAct('clue3', 14.5, -37.4, 2.2, '🔎 Observer le tableau');
      upAct('cdi', 9, -28.1, 3.0, '📚 Bibliothèque'); upAct('clue2', 15.2, -23.6, 2.2, '🔎 Feuilleter un livre');
      upAct('wc', 9, -19.8, 3.2, '🚽 Toilettes'); upAct('safe', 14.6, -16.8, 2.4, '🔐 Coffre-fort du directeur');
      for (const [x, z] of [[0, -30], [0, -20], [-9, -34], [9, -34], [-9, -26], [9, -26]]) { const l = new THREE.PointLight(0xffedc2, .55, 13); l.position.set(x, EL + 3.1, z); scene.add(l); }
    }
    buildUpstairs();
    // Corridor : bloc de sécurité pour le garde-corps du haut
    world.walls2.push({ minX: -1.8, maxX: 1.8, minZ: -38.7, maxZ: -37.7 });


    // Cour et aménagements.
    addBox(0, -.04, 6, 55, .08, 22, mats.path, false);
    addBox(0, -.035, 22, 38, .06, 13, mats.concrete, false);
    // Terrain de sport
    const court = new THREE.Mesh(new THREE.PlaneGeometry(29, 17), mat(0x76b7d2));
    court.rotation.x = -Math.PI / 2; court.position.set(0, .015, 22); court.receiveShadow = true; scene.add(court);
    for (const x of [-14.4, 14.4]) addBox(x, .03, 22, .12, .02, 17, mats.white, false);
    addBox(0, .03, 13.5, 29, .02, .12, mats.white, false);
    addBox(0, .03, 30.5, 29, .02, .12, mats.white, false);
    const circle = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.55, 48), mats.white); circle.rotation.x = -Math.PI / 2; circle.position.set(0, .05, 22); scene.add(circle);

    function makeTree(x, z, scale = 1) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.22 * scale, .35 * scale, 2.4 * scale, 8), mats.wood); trunk.position.y = 1.2 * scale; trunk.castShadow = true; g.add(trunk);
      for (const [ox, oy, oz, r] of [[0, 3.0, 0, 1.45], [-.7, 2.6, .1, 1.0], [.7, 2.7, -.25, 1.1], [0, 3.6, -.2, .95]]) {
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r * scale, 1), mat(pick([0x3f9957, 0x55a966, 0x6ab875])));
        crown.position.set(ox * scale, oy * scale, oz * scale); crown.castShadow = true; g.add(crown);
      }
      g.position.set(x, 0, z); scene.add(g); addSolid(x, z, 1.15 * scale); return g;
    }
    function makeBench(x, z, rot = 0) {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.8, .18, .75), mats.woodLight); seat.position.y = .65; seat.castShadow = true; g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, .9, .14), mats.wood); back.position.set(0, 1.12, .32); g.add(back);
      for (const dx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.14, .65, .14), mats.metal); leg.position.set(dx * 1.05, .32, 0); g.add(leg); }
      g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); addSolid(x, z, 1.25);
      addInteractable({ kind: 'bench', name: 'Banc', x, z, radius: 2.4, mesh: g, prompt: 'S’asseoir sur le banc' });
    }
    function makeBush(x, z) {
      const g = new THREE.Group();
      for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.7, 12, 10), mat(pick([0x388d4b, 0x4fa95b, 0x62b36a]))); b.position.set((i - 2) * .48, .55 + rand(0, .25), rand(-.25, .25)); b.scale.set(1.1, .9, .9); b.castShadow = true; g.add(b); }
      g.position.set(x, 0, z); scene.add(g); addSolid(x, z, 1.0);
      addInteractable({ kind: 'bush', name: 'Buisson', x, z, radius: 2.2, mesh: g, prompt: 'Se cacher dans le buisson' });
    }
    function makeBin(x, z) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.5, .42, 1.1, 12), mat(0x5d8791)); body.position.y = .58; body.castShadow = true; g.add(body);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(.54, .54, .12, 12), mats.metal); lid.position.y = 1.16; g.add(lid);
      g.position.set(x, 0, z); scene.add(g); addSolid(x, z, .62);
      addInteractable({ kind: 'bin', name: 'Poubelle', x, z, radius: 2.3, mesh: g, prompt: 'Fouiller la poubelle' });
    }
    function makeHoop(x, z) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.12, .16, 3.6, 10), mats.metal); pole.position.y = 1.8; pole.castShadow = true; g.add(pole);
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.35, .12), mats.white); board.position.set(0, 3.05, -.45); g.add(board);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(.58, .065, 8, 24), mat(0xe87951, .5)); rim.position.set(0, 2.55, -.95); rim.rotation.x = Math.PI / 2; g.add(rim);
      const net = new THREE.Mesh(new THREE.CylinderGeometry(.52, .38, .75, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true })); net.position.set(0, 2.13, -.95); g.add(net);
      g.position.set(x, 0, z); scene.add(g); addSolid(x, z, .55);
      addInteractable({ kind: 'hoop', name: 'Panier de basket', x, z: z + 1.4, radius: 3.1, mesh: g, prompt: 'Tenter un panier' });
    }
    function makeVending(x, z) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, .8), mat(0x497ba7)); body.position.y = 1.3; body.castShadow = true; g.add(body);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.15, .04), mats.glass); glass.position.set(0, 1.65, -.42); g.add(glass);
      for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 10), mat([0xf15d5d, 0xf1c64a, 0x6bd18a][i])); s.position.set(-.32 + i * .32, 1.72, -.5); g.add(s); }
      g.position.set(x, 0, z); scene.add(g); addSolid(x, z, .8);
      addInteractable({ kind: 'vending', name: 'Distributeur', x, z: z + 1, radius: 2.7, mesh: g, prompt: 'Acheter une pomme · 5 🪙' });
    }
    function makeFountain(x, z) {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.55, .55, 20), mats.concrete); base.position.set(x, .28, z); base.castShadow = true; scene.add(base);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, .12, 20), mat(0x58c6ed, .18, .25)); water.position.set(x, .58, z); scene.add(water);
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(.15, .27, 1.1, 12), mats.glass); jet.position.set(x, 1.1, z); scene.add(jet);
      addSolid(x, z, 1.5);
      addInteractable({ kind: 'fountain', name: 'Fontaine', x, z: z + 1.8, radius: 3.1, mesh: base, prompt: 'Se rafraîchir' });
    }

    // Bordures du bâtiment / couloir extérieur
    for (const z of [-10, -4, 2]) {
      addBox(-22, 0, z, 2.3, 2.2, 1.5, mats.wall2, false);
      addBox(-22, 2.2, z, 2.5, .18, 1.7, mats.wood, false);
      addBox(-24, 0, z + 2.2, .18, 2.4, 1.2, mats.metal, false);
    }
    // Cabanon de sport (décor), bancs et espaces verts
    addBox(27, 0, -17, 10, 5.5, 12, mat(0xf0d6a7), true);
    addBox(27, 5.5, -17, 10.5, .35, 12.5, mats.red, false);
    addBox(27, 1.8, -10.9, 2.2, 2.7, .12, mats.glass, false, false);
    makeTree(-28, 7, 1.35); makeTree(-27, 27, 1.1); makeTree(29, 7, 1.25); makeTree(29, 32, 1.1);
    makeTree(-17, 34, .8); makeTree(17, 35, .85);
    makeBush(-15, 8); makeBush(15, 7); makeBush(-23, 20); makeBush(23, 25);
    makeBench(-12, 4, Math.PI / 2); makeBench(12, 4, -Math.PI / 2); makeBench(-20, 29, 0); makeBench(19, 30, 0);
    makeBin(-7, 10); makeBin(8, 9); makeBin(23, 2);
    makeHoop(-8, 28); makeHoop(8, 28);
    makeVending(17, -4); makeFountain(0, -1);

    // Petit jardin et fleurs décoratives
    for (let i = 0; i < 28; i++) {
      const x = rand(-32, 32), z = rand(4, 41);
      if (Math.abs(x) < 16 && z > 13 && z < 31) continue;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(.025, .035, .34, 5), mats.green); stem.position.set(x, .17, z); scene.add(stem);
      const flower = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), mat(pick([0xffd66d, 0xf28ca4, 0xb9a2f3, 0xffffff]))); flower.position.set(x, .38, z); scene.add(flower);
    }

    // Interactables helper (appelé après les objets de décor).
    function addInteractable(item) { world.interactables.push(item); }

    // Points de fouille et objets à collectionner.
    const pickupSpots = [
      { x: -18, z: 13, item: 'ballon', label: 'Ballon perdu' },
      { x: 18, z: 17, item: 'craie', label: 'Craies colorées' },
      { x: -4, z: 34, item: 'confetti', label: 'Sachet de confettis' },
      { x: 7, z: 3, item: 'pomme', label: 'Pomme oubliée' },
      { x: 24, z: -2, item: 'enceinte', label: 'Mini enceinte' },
      { x: -22, z: -1, item: 'slime', label: 'Pot de slime' },
      { x: -14, z: -18, item: 'carnet', label: 'Carnet oublié' },
      { x: 12, z: -18, item: 'sandwich', label: 'Sandwich emballé' },
      { x: -6, z: -20, item: 'stickers', label: 'Planche d’autocollants' },
      { x: 17, z: 16, item: 'waterballoon', label: 'Ballon d’eau' },
      { x: 0, z: 37, item: 'badge', label: 'Badge du club' },
      { x: -12, z: 24, item: 'avion', label: 'Feuille à plier' }, { x: 14, z: 31, item: 'banane', label: 'Banane abandonnée' },
      { x: -27, z: 41, item: 'coussin', label: 'Coussin suspect' }, { x: 28, z: 46, item: 'megaphone', label: 'Mégaphone du sport' },
      { x: -8, z: 53, item: 'lunettes', label: 'Lunettes de fête' }, { x: 11, z: 58, item: 'bulles', label: 'Flacon de bulles' }
    ];
    function makePickup(p, idx) {
      const group = new THREE.Group();
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(.35, 1), mat(ITEMS[p.item].color, .28, .12)); orb.position.y = .62; orb.castShadow = true; group.add(orb);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.52, .035, 8, 24), mat(0xffe28b, .3, .1)); ring.rotation.x = Math.PI / 2; ring.position.y = .1; group.add(ring);
      group.position.set(p.x, 0, p.z); scene.add(group);
      const spot = { ...p, group, done: false, phase: idx * .8 };
      world.pickups.push(spot);
      addInteractable({ kind: 'pickup', name: p.label, x: p.x, z: p.z, radius: 2.5, ref: spot, prompt: `Ramasser : ${p.label}` });
    }
    pickupSpots.forEach(makePickup);

    // Décor de classe en plus : affiches et horloge.
    const clockFace = new THREE.Mesh(new THREE.CircleGeometry(.72, 32), mats.white); clockFace.position.set(14.8, 3.1, -39.25); scene.add(clockFace);
    const clockRim = new THREE.Mesh(new THREE.TorusGeometry(.74, .07, 8, 32), mats.wood); clockRim.position.set(14.8, 3.1, -39.2); scene.add(clockRim);
    for (const x of [-13, -7, 7, 13]) {
      const poster = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, .08), mat(pick([0xffcf75, 0x9fd6c2, 0xc4b4ee, 0xf4a9b4])));
      poster.position.set(x, 2.5, -14.55); scene.add(poster);
    }
    addInteractable({ kind: 'board', name: 'Tableau de la classe 101', x: -9.5, z: -37.5, radius: 3.5, prompt: 'Participer au cours' });
    addInteractable({ kind: 'board', name: 'Tableau de la classe 102', x: 9.5, z: -37.5, radius: 3.5, prompt: 'Participer au cours' });
    addInteractable({ kind: 'library', name: 'Coin lecture', x: -14, z: -18, radius: 2.8, prompt: 'Réviser tranquillement' });

    // Salles spécialisées : bibliothèque, salle informatique, atelier créatif et cantine.
    function makeShelf(x, z) {
      const g = new THREE.Group();
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.35, .22), mats.wood); back.position.y = 1.18; g.add(back);
      for (const y of [.45, 1.12, 1.8]) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(2.35, .12, .68), mats.woodLight); plank.position.set(0, y, -.2); g.add(plank);
        for (let i = 0; i < 6; i++) { const book = new THREE.Mesh(new THREE.BoxGeometry(.22, rand(.32, .48), .34), mat(pick([0xd97770,0x6f9fc9,0xe3bd62,0x78a98a,0x987fc2]))); book.position.set(-.92 + i * .36, y + .12 + .1, -.18); g.add(book); }
      }
      g.position.set(x, 0, z); scene.add(g); world.solids.push({ x, z, radius: .8 });
    }
    function makeComputerDesk(x, z) {
      addBox(x, 0, z, 2.2, .82, 1.0, mats.woodLight);
      world.solids.push({ x, z, radius: .92 });
      addBox(x, .88, z - .18, 1.15, .78, .12, mats.metal);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(.95, .58), mat(0x5fc3d8, .25, .1)); screen.position.set(x, 1.3, z - .255); scene.add(screen);
      addInteractable({ kind: 'computer', name: 'Ordinateur', x, z: z + .85, radius: 2.3, prompt: 'Lancer un mini-défi informatique' });
    }
    function makeCafeteriaTable(x, z) {
      world.solids.push({ x, z, radius: 1.0 });
      addBox(x, .72, z, 2.6, .16, 1.2, mats.woodLight);
      for (const dx of [-1,1]) for (const dz of [-.42,.42]) addBox(x + dx * 1.05, 0, z + dz, .12, .72, .12, mats.metal);
      addInteractable({ kind: 'cafeteria', name: 'Table de la cantine', x, z: z + 1.2, radius: 2.6, prompt: 'Manger et récupérer de l’énergie' });
    }
    function makeEasel(x, z) {
      const frame = new THREE.Group();
      const canvas = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.55, .12), mat(0xf5e7ce)); canvas.position.y = 1.55; frame.add(canvas);
      for (const dx of [-.52,.52]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,2.2,6), mats.wood); leg.position.set(dx,1.05,.22); frame.add(leg); }
      const paint = new THREE.Mesh(new THREE.PlaneGeometry(.95,1.22), mat(pick([0xf2a2a2,0x8bb9e8,0x9bd2a5,0xf4d17b]))); paint.position.set(0,1.55,-.071); frame.add(paint);
      frame.position.set(x,0,z); scene.add(frame);
      world.solids.push({ x, z, radius: .62 });
      addInteractable({ kind: 'art', name: 'Chevalet de peinture', x, z: z + 1.0, radius: 2.6, prompt: 'Créer une œuvre' });
    }
    function makePiano(x,z) {
      world.solids.push({ x, z, radius: .92 });
      addBox(x,0,z,2.2,.95,1.0,mat(0x292e38));
      addBox(x,.96,z-.22,2.1,.08,.5,mats.white,false);
      for(let i=0;i<12;i++) addBox(x-.92+i*.168,1.01,z-.34,.12,.08,.32, i%3===1?mat(0x232832):mats.white,false);
      addInteractable({kind:'piano',name:'Piano de la salle musique',x,z:z+1.15,radius:2.8,prompt:'Jouer un petit morceau'});
    }
    for (const z of [-21.5, -18.0]) makeShelf(-14.2, z);
    makeComputerDesk(-5.0, -18.7); makeComputerDesk(-10.0, -18.7);
    makeEasel(-13.2, -20.8); makeEasel(-6.3, -20.8);
    makeCafeteriaTable(7.0, -19.2); makeCafeteriaTable(12.5, -19.2);
    addBox(12, 0, -14.8, 5.8, 1.2, .85, mats.woodLight);
    addInteractable({kind:'cafeteria',name:'Comptoir de la cantine',x:12,z:-13.6,radius:3.1,prompt:'Acheter un repas · 8 🪙'});
    makePiano(13.2,-23.0);
    for (const z of [-23.6, -20.4, -17.2]) {
      addBox(-.85,0,z,.34,1.15,.3,mat(0x54798d),false);
      addInteractable({kind:'locker',name:'Casier personnel',x:-.45,z,radius:1.7,prompt:'Ouvrir ton casier'});
    }
    addInteractable({kind:'notice',name:'Panneau des clubs',x:0,z:-15.4,radius:2.7,prompt:'Consulter les clubs de l’école'});



    // -------------------------------------------------------------------------
    // NOUVEAU CAMPUS DE COLLÈGE : deux ailes pédagogiques + gymnase + stade.
    // Les toits sont opaques, les façades détaillées et les portes restent libres.
    // -------------------------------------------------------------------------
    function campusWall(x,z,w,d,h=6.2,material=mats.wall) {
      const mesh=addBox(x,0,z,w,h,d,material,true,true);
      world.walls.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
      return mesh;
    }
    function campusWindow(x,y,z,w,h,d) {
      const t=.14,fd=d+.1;
      addBox(x,y,z,w,h,d,mats.glass,false,false);
      addBox(x,y+h,z,w+t*2,t,fd,mats.white,false,false); addBox(x,y-t,z,w+t*2,t,fd,mats.white,false,false);
      addBox(x-w/2-t/2,y-t,z,t,h+t*2,fd,mats.white,false,false); addBox(x+w/2+t/2,y-t,z,t,h+t*2,fd,mats.white,false,false);
      addBox(x,y,z+.02,.07,h,fd,mats.white,false,false); addBox(x,y+h/2-.035,z+.02,w,.07,fd,mats.white,false,false);
      addBox(x,y-t-.07,z+.14,w+.5,.07,.36,mats.concrete,false,true);
    }
    function sideWindow(x,y,z,len,h,side) {
      const t=.14,fd=.18;
      addBox(x,y,z,.08,h,len,mats.glass,false,false);
      addBox(x,y+h,z,fd,t,len+t*2,mats.white,false,false); addBox(x,y-t,z,fd,t,len+t*2,mats.white,false,false);
      addBox(x,y-t,z-len/2-t/2,fd,h+t*2,t,mats.white,false,false); addBox(x,y-t,z+len/2+t/2,fd,h+t*2,t,mats.white,false,false);
      addBox(x,y,z,fd,h,.07,mats.white,false,false); addBox(x,y+h/2-.035,z,fd,.07,len,mats.white,false,false);
      addBox(x+side*.14,y-t-.07,z,.36,.07,len+.5,mats.concrete,false,true);
    }
    function buildCampusWing(cx,cz,label,accent,kind) {
      const w=42,d=44,front=cz+d/2,back=cz-d/2,left=cx-w/2,right=cx+w/2;
      const floorMat=kind==='science'?mats.floorBlue:kind==='arts'?mats.floorWarm:mats.floorGreen;
      addBox(cx,-.12,cz,w,.16,d,floorMat,false,true);
      // Façade avant avec entrée centrale de 10 unités.
      campusWall(cx-14,front,14,.72,6.1); campusWall(cx+14,front,14,.72,6.1);
      campusWall(left,cz,.72,d,6.1); campusWall(right,cz,.72,d,6.1); campusWall(cx,back,w,.72,6.1);
      // Toit plat épais et opaque, typique d'un collège récent.
      addBox(cx,6.05,cz,w+1.6,.58,d+1.6,mats.roof,true,true);
      addBox(cx,6.65,front+.1,w+1.7,.22,.5,mat(0x263b4e),false);
      // Corniche et bandeaux de façade.
      addBox(cx,4.95,front+.39,w,.18,.16,mat(accent),false);
      addBox(left-.1,4.95,cz,.18,.18,d,mat(accent),false); addBox(right+.1,4.95,cz,.18,.18,d,mat(accent),false);
      // Grandes fenêtres séparées par des montants verticaux.
      for(let i=0;i<5;i++){
        const x=left+4.8+i*8.1;
        campusWindow(x,2.25,front+.39,3.5,1.75,.08);
      }
      for(let side of [-1,1]) for(let i=0;i<4;i++){
        const z=back+5+i*10;
        sideWindow(cx+side*(w/2+.4),2.3,z,4.5,1.75,side);
      }
      // Porte double vitrée, encadrement et marches d'entrée.
      addBox(cx-2.45,0,front+.12,.16,2.85,.18,mats.metal,false);
      addBox(cx+2.45,0,front+.12,.16,2.85,.18,mats.metal,false);
      addBox(cx,2.85,front+.12,5.05,.16,.18,mats.metal,false);
      addBox(cx-1.12,0,front-.05,2.12,2.55,.08,mats.glass,false,false);
      addBox(cx+1.12,0,front-.05,2.12,2.55,.08,mats.glass,false,false);
      addBox(cx,0,front+1.3,8.8,.28,2.3,mats.concrete,false);
      addBox(cx,0,front+2.45,10.2,.18,1.2,mats.path,false);
      // Hall intérieur et couloir clair ; les salles sont ouvertes par des portes latérales.
      addBox(cx,0,cz,7.4,.055,d-2,mats.floorBlue,false);
      for(const side of [-1,1]){
        const x=cx+side*4.15;
        // Cloisons en segments : deux grandes ouvertures de porte restent accessibles.
        campusWall(x,cz-15,.2,10,3.25,mats.wall2);
        campusWall(x,cz+3,.2,13,3.25,mats.wall2);
        addBox(x-side*.01,0,cz-9.5,.12,2.4,.16,mats.wood,false);
        addBox(x-side*.01,0,cz+9.7,.12,2.4,.16,mats.wood,false);
      }
      // Mobilier et postes d'activité, dispersés dans les pièces.
      if(kind==='science'){
        makeComputerDesk(cx-12,cz-13); makeComputerDesk(cx+12,cz-13);
        makeComputerDesk(cx-12,cz+9); makeComputerDesk(cx+12,cz+9);
        for(let i=0;i<4;i++){
          addBox(cx-12+i*8,0,cz-1,2.3,.82,1.1,mats.metal,true);
          addBox(cx-12+i*8,.84,cz-1,1.1,.08,.6,mats.woodLight,false);
        }
        addInteractable({kind:'computer',name:'Atelier de sciences',x:cx-12,z:cz-10,radius:2.6,prompt:'Faire une expérience scientifique'});
        addInteractable({kind:'computer',name:'Laboratoire informatique',x:cx+12,z:cz+12,radius:2.6,prompt:'Lancer un défi informatique'});
      } else {
        makeShelf(cx-14,cz-13); makeShelf(cx+14,cz-13);
        makeEasel(cx-12,cz+8); makeEasel(cx+12,cz+8);
        makePiano(cx+12,cz-2);
        addInteractable({kind:'library',name:'Espace CDI',x:cx-13,z:cz-8,radius:3.1,prompt:'Lire ou réviser au CDI'});
        addInteractable({kind:'art',name:'Atelier arts plastiques',x:cx+12,z:cz+11,radius:3.0,prompt:'Créer une œuvre'});
      }
      // Bancs et casiers dans le hall.
      for(let i=0;i<5;i++){
        const x=cx-2.6+i*1.3;
        addBox(x,0,cz+17,.72,1.6,.48,mats.locker,false);
      }
      const sign=makeTextSprite(label,{fontSize:31,height:60,scale:.0068,bg:'rgba(27,51,70,.96)'});
      sign.position.set(cx,5.3,front+.7); scene.add(sign);
      const light=new THREE.PointLight(0xffeac9,.7,26); light.position.set(cx,4.7,cz); scene.add(light);
      // Unité de ventilation et petits détails de toit.
      for(let i=0;i<3;i++){
        const hvac=addBox(cx-12+i*12,6.45,cz-10,3.1,.65,2.1,mats.metal,false);
        addBox(cx-12+i*12,6.8,cz-10,2.2,.08,1.3,mats.white,false);
      }
      return {cx,cz,front,back,left,right};
    }

    const westWing=buildCampusWing(-54,-22,'BÂTIMENT A · SCIENCES',0x4c9eb5,'science');
    const eastWing=buildCampusWing(54,-22,'BÂTIMENT B · ARTS & CDI',0x9a6fae,'arts');

    // Gymnase indépendant : terrain multisport intérieur, tribunes et vestiaires.
    function buildGym() {
      const cx=0,cz=72,w=66,d=42,front=cz+d/2,back=cz-d/2,left=-33,right=33;
      addBox(cx,-.12,cz,w,.18,d,mat(0x9b8061),false);
      // Sol de parquet avec bandes sportives.
      const courtFloor=new THREE.Mesh(new THREE.PlaneGeometry(58,35),textured(surfaceTextures.wood,0xffffff,.72,.035));
      courtFloor.rotation.x=-Math.PI/2;courtFloor.position.set(0,.025,cz);courtFloor.receiveShadow=true;scene.add(courtFloor);
      campusWall(cx,back,w,.7,8.2,mats.wall2); campusWall(left,cz,.7,d,8.2,mats.wall2); campusWall(right,cz,.7,d,8.2,mats.wall2);
      campusWall(-24,front,18,.7,8.2,mats.wall2); campusWall(24,front,18,.7,8.2,mats.wall2);
      addBox(0,8.1,cz,68,.55,44,mats.roof,true,true);
      // Poutres, panneaux lumineux et baies hautes.
      for(let x=-25;x<=25;x+=10){addBox(x,7.45,cz, .28,.28,40,mats.metal,false);}
      for(let x=-25;x<=25;x+=12){addBox(x,5.8,back+.4,6.8,1.65,.08,mats.glass,false,false);}
      for(let z=back+5;z<front-3;z+=8){const lamp=new THREE.Mesh(new THREE.BoxGeometry(5,.12,.6),mats.white);lamp.position.set(0,7.6,z);scene.add(lamp);}
      // Marquages de terrain.
      const lineMat=mat(0xf6f0dc,.6);
      for(const x of [-28,28]) addBox(x,.045,cz,.12,.025,34,lineMat,false);
      for(const z of [cz-17,cz+17]) addBox(0,.045,z,56,.025,.12,lineMat,false);
      const centerCircle=new THREE.Mesh(new THREE.RingGeometry(3.2,3.38,48),lineMat);centerCircle.rotation.x=-Math.PI/2;centerCircle.position.set(0,.06,cz);scene.add(centerCircle);
      makeHoop(-24,cz-3);makeHoop(24,cz-3);
      // Gradins le long du mur nord.
      for(let i=0;i<3;i++){
        addBox(-10, i*.42, back+3+i*.82, 16,.42,1.1, mats.woodLight,false);
        addBox(10, i*.42, back+3+i*.82, 16,.42,1.1, mats.woodLight,false);
      }
      // Vestiaires en alcôve visuelle avec casiers.
      for(let i=0;i<7;i++) addBox(-29+i*1.1,.0,front-6,.72,1.8,.55,mats.locker,false);
      addInteractable({kind:'gym',name:'Terrain du gymnase',x:0,z:cz,radius:8,prompt:'Lancer un match de basket'});
      const sign=makeTextSprite('GYMNASE · SPORTS',{fontSize:35,height:66,scale:.007,bg:'rgba(29,48,64,.96)'});sign.position.set(0,7.1,front+.8);scene.add(sign);
      const light=new THREE.PointLight(0xffe8c5,1.0,42);light.position.set(0,6.5,cz);scene.add(light);
    }
    buildGym();
    // Objets bonus répartis dans les nouvelles ailes et le gymnase.
    [
      {x:-66,z:-8,item:'stickers',label:'Autocollants du club sciences'},
      {x:66,z:-8,item:'carnet',label:'Carnet du CDI'},
      {x:-54,z:-35,item:'badge',label:'Badge du club robotique'},
      {x:54,z:-35,item:'sandwich',label:'Goûter oublié'},
      {x:-18,z:72,item:'ballon',label:'Ballon de basket'},
      {x:18,z:72,item:'waterballoon',label:'Ballon d’eau oublié'}
    ].forEach((p,i)=>makePickup(p,20+i));

    // Stade extérieur et piste d'athlétisme.
    const field=new THREE.Mesh(new THREE.PlaneGeometry(82,31),textured(surfaceTextures.grass,0xffffff,1,.06));
    field.rotation.x=-Math.PI/2;field.position.set(0,.01,112);field.receiveShadow=true;scene.add(field);
    for(const x of [-41,41]) addBox(x,.05,112,.12,.025,31,mats.white,false);
    for(const z of [96.5,127.5]) addBox(0,.05,z,82,.025,.12,mats.white,false);
    addBox(0,.05,112,.12,.025,31,mats.white,false);
    const fieldCircle=new THREE.Mesh(new THREE.RingGeometry(4.2,4.35,48),mats.white);fieldCircle.rotation.x=-Math.PI/2;fieldCircle.position.set(0,.065,112);scene.add(fieldCircle);
    for(const x of [-38,38]){
      addBox(x,.6,112,.3,1.2,.3,mats.white,false);addBox(x,1.2,112,6,.12,.18,mats.white,false);
      addBox(x,1.2,109, .12,2.4,.12,mats.white,false);addBox(x,1.2,115,.12,2.4,.12,mats.white,false);
    }
    addInteractable({kind:'field',name:'Terrain de football',x:0,z:112,radius:8,prompt:'Lancer un match de football'});

    // Espaces de vie, assises, arbres et lampadaires répartis sur tout le campus.
    const campusTrees=[[-76,20],[-76,48],[-68,90],[-38,48],[38,48],[68,18],[76,55],[72,95],[-70,-52],[70,-52]];
    campusTrees.forEach(([x,z],i)=>makeTree(x,z,i%3===0?1.3:1.05));
    [[-34,11],[34,11],[-52,24],[52,24],[-31,51],[31,51],[-50,48],[50,48]].forEach(([x,z],i)=>makeBench(x,z,(i%2)*Math.PI/2));
    for(const [x,z] of [[-30,8],[30,8],[-64,8],[64,8],[0,48],[-42,62],[42,62]]){
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(.09,.13,5.2,8),mats.metal);pole.position.set(x,2.6,z);scene.add(pole);
      const glow=new THREE.PointLight(0xffe5b2,.38,17);glow.position.set(x,4.9,z);scene.add(glow);
      addBox(x,5.1,z,.9,.18,.45,mats.white,false);
    }

    // Navigation A* : la carte est précalculée à partir des cloisons, murs et meubles.
    // Les personnages contournent les murs et passent par les vraies ouvertures des portes.
    const NAV = { cell: .85, minX: -82, minZ: -62, cols: 194, rows: 236, blocked: null };
    NAV.blocked = new Uint8Array(NAV.cols * NAV.rows);
    function navIndex(ix, iz) { return iz * NAV.cols + ix; }
    function navWorld(ix, iz) { return { x: NAV.minX + (ix + .5) * NAV.cell, z: NAV.minZ + (iz + .5) * NAV.cell }; }
    function navCell(x, z) { return { ix: Math.floor((x - NAV.minX) / NAV.cell), iz: Math.floor((z - NAV.minZ) / NAV.cell) }; }
    function navOpen(x, z) {
      const c = navCell(x, z);
      if (c.ix < 0 || c.iz < 0 || c.ix >= NAV.cols || c.iz >= NAV.rows) return false;
      return NAV.blocked[navIndex(c.ix, c.iz)] === 0;
    }
    for (let iz=0; iz<NAV.rows; iz++) for (let ix=0; ix<NAV.cols; ix++) {
      const pt=navWorld(ix,iz); let blocked=false;
      if (Math.abs(pt.x)>81.2 || pt.z < -59.2 || pt.z > 136.8) blocked=true;
      if (!blocked && world.walls.some(w => pt.x > w.minX-.36 && pt.x < w.maxX+.36 && pt.z > w.minZ-.36 && pt.z < w.maxZ+.36)) blocked=true;
      if (!blocked && world.solids.some(o => Math.hypot(pt.x-o.x,pt.z-o.z) < (o.radius||.4)+.32)) blocked=true;
      NAV.blocked[navIndex(ix,iz)] = blocked ? 1 : 0;
    }
    function nearestNavCell(x,z,maxRadius=12) {
      const base=navCell(x,z);
      if (base.ix>=0 && base.iz>=0 && base.ix<NAV.cols && base.iz<NAV.rows && !NAV.blocked[navIndex(base.ix,base.iz)]) return base;
      for (let r=1;r<=maxRadius;r++) {
        let best=null, bestD=Infinity;
        for (let dz=-r;dz<=r;dz++) for (let dx=-r;dx<=r;dx++) {
          if (Math.max(Math.abs(dx),Math.abs(dz))!==r) continue;
          const ix=base.ix+dx, iz=base.iz+dz;
          if (ix<0||iz<0||ix>=NAV.cols||iz>=NAV.rows||NAV.blocked[navIndex(ix,iz)]) continue;
          const pt=navWorld(ix,iz), d=(pt.x-x)**2+(pt.z-z)**2;
          if (d<bestD) { bestD=d; best={ix,iz}; }
        }
        if (best) return best;
      }
      return null;
    }
    function navLineClear(a,b) {
      const d=Math.hypot(b.x-a.x,b.z-a.z), steps=Math.ceil(d/.24);
      for(let i=1;i<=steps;i++){const t=i/steps;if(!navOpen(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false;}
      return true;
    }
    function navHeuristic(a,b) { const dx=Math.abs(a.ix-b.ix), dz=Math.abs(a.iz-b.iz); return Math.max(dx,dz)+(Math.SQRT2-1)*Math.min(dx,dz); }
    function findNavPath(from,to) {
      const start=nearestNavCell(from.x,from.z), goal=nearestNavCell(to.x,to.z);
      if(!start||!goal)return [];
      const startId=navIndex(start.ix,start.iz), goalId=navIndex(goal.ix,goal.iz);
      if(startId===goalId)return [{x:to.x,z:to.z}];
      const size=NAV.cols*NAV.rows, gScore=new Float32Array(size); gScore.fill(Infinity);
      const parent=new Int32Array(size); parent.fill(-1);
      const closed=new Uint8Array(size), heap=[];
      const push=(node)=>{let i=heap.length;heap.push(node);while(i>0){const p=(i-1)>>1;if(heap[p].f<=node.f)break;heap[i]=heap[p];i=p;heap[i]=node;}};
      const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;heap[0]=last;while(true){let l=i*2+1,r=l+1,b=i;if(l<heap.length&&heap[l].f<heap[b].f)b=l;if(r<heap.length&&heap[r].f<heap[b].f)b=r;if(b===i)break;[heap[i],heap[b]]=[heap[b],heap[i]];i=b;}}return top;};
      gScore[startId]=0;push({id:startId,ix:start.ix,iz:start.iz,f:navHeuristic(start,goal)});
      const dirs=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
      let visited=0, found=false;
      while(heap.length&&visited<22000){
        const cur=pop(); if(closed[cur.id])continue;closed[cur.id]=1;visited++;
        if(cur.id===goalId){found=true;break;}
        for(const [dx,dz,cost] of dirs){const ix=cur.ix+dx,iz=cur.iz+dz;if(ix<0||iz<0||ix>=NAV.cols||iz>=NAV.rows)continue;const id=navIndex(ix,iz);if(closed[id]||NAV.blocked[id])continue;
          if(dx&&dz&&(NAV.blocked[navIndex(cur.ix+dx,cur.iz)]||NAV.blocked[navIndex(cur.ix,cur.iz+dz)]))continue;
          const ng=gScore[cur.id]+cost;if(ng<gScore[id]){gScore[id]=ng;parent[id]=cur.id;push({id,ix,iz,f:ng+navHeuristic({ix,iz},goal)});}
        }
      }
      if(!found)return [];
      const raw=[];let id=goalId;while(id!==startId&&id!==-1){const iz=Math.floor(id/NAV.cols),ix=id-iz*NAV.cols;raw.push(navWorld(ix,iz));id=parent[id];}
      raw.reverse(); if(!raw.length)return [{x:to.x,z:to.z}];
      // Lissage : on garde le point le plus éloigné visible sans traverser un mur.
      const smooth=[];let at={x:from.x,z:from.z},i=0;
      while(i<raw.length){let far=i;for(let j=raw.length-1;j>=i;j--){if(navLineClear(at,raw[j])){far=j;break;}}smooth.push(raw[far]);at=raw[far];i=far+1;}
      const end={x:to.x,z:to.z};if(navOpen(end.x,end.z)&&navLineClear(at,end))smooth.push(end);
      return smooth;
    }
    function setEntityPath(entity) {
      entity.navPath=findNavPath(entity,entity.target);entity.navIndex=0;
      entity.navGoal={x:entity.target.x,z:entity.target.z};entity.navBlocked=0;entity.navRetry=state.totalTime+.6;
    }

    function makeTextSprite(text, opts = {}) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const fontSize = opts.fontSize || 42;
      ctx.font = `700 ${fontSize}px Arial`;
      const width = Math.max(150, Math.ceil(ctx.measureText(text).width + 36));
      canvas.width = width; canvas.height = opts.height || 76;
      const c = canvas.getContext('2d');
      c.fillStyle = opts.bg || 'rgba(12,22,38,.88)';
      c.strokeStyle = opts.stroke || 'rgba(255,255,255,.35)'; c.lineWidth = 4;
      const r = 16; c.beginPath(); c.moveTo(r, 3); c.arcTo(width - 3, 3, width - 3, canvas.height - 3, r); c.arcTo(width - 3, canvas.height - 3, 3, canvas.height - 3, r); c.arcTo(3, canvas.height - 3, 3, 3, r); c.arcTo(3, 3, width - 3, 3, r); c.closePath(); c.fill(); c.stroke();
      c.font = `700 ${fontSize}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = opts.color || '#fff'; c.fillText(text, width / 2, canvas.height / 2 + 1);
      const texture = new THREE.CanvasTexture(canvas); texture.minFilter = THREE.LinearFilter;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
      const scale = opts.scale || .009;
      sprite.scale.set(width * scale, canvas.height * scale, 1);
      return sprite;
    }

    // Panneaux lisibles pour aider à s'orienter dans les différents espaces.
    [
      ['CLASSE 101 · MATHS', -9.5, -37.85],
      ['CLASSE 102 · FRANÇAIS', 9.5, -37.85],
      ['BIBLIOTHÈQUE & ARTS', -9.5, -14.85],
      ['CANTINE & MUSIQUE', 9.5, -14.85]
    ].forEach(([label, x, z]) => {
      const sign = makeTextSprite(label, { fontSize: 26, height: 54, scale: .0068, bg: 'rgba(38,64,86,.94)' });
      sign.position.set(x, 3.45, z); scene.add(sign);
    });

    function makeAvatar(data, role = 'student') {
      const group = new THREE.Group();
      const skinMat = mat(data.skin || 0xf0c6a3);
      const clothesMat = mat(data.clothes || 0x4e91c8);
      const hairMat = mat(data.hair || 0x35251d);
      const shoeMat = mat(role === 'teacher' ? 0x343b4e : 0x263346);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.34, .42, .82, 10), clothesMat);
      body.position.y = 1.13; body.castShadow = true; group.add(body);
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(.14, .2, .15, 10), mats.white); collar.position.y = 1.52; group.add(collar);
      const head = new THREE.Mesh(new THREE.SphereGeometry(.34, 16, 12), skinMat); head.position.y = 1.82; head.castShadow = true; group.add(head);
      const hair = new THREE.Mesh(new THREE.SphereGeometry(.355, 14, 10, 0, Math.PI * 2, 0, Math.PI * .58), hairMat); hair.position.set(0, 1.98, .015); hair.castShadow = true; group.add(hair);
      if (role !== 'teacher') {
        const backpack = new THREE.Mesh(new THREE.BoxGeometry(.48, .54, .2), mat(0x334b68));
        backpack.position.set(0, 1.22, .39); backpack.castShadow = true; group.add(backpack);
        const packPocket = new THREE.Mesh(new THREE.BoxGeometry(.32, .2, .035), mat(0x587493));
        packPocket.position.set(0, 1.1, .5); group.add(packPocket);
      }
      if (role === 'teacher') {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(.19, 12, 10), hairMat); bun.position.set(0, 2.1, .3); group.add(bun);
        const glasses = new THREE.Mesh(new THREE.TorusGeometry(.105, .018, 6, 16), mats.metal); glasses.position.set(-.12, 1.83, -.32); group.add(glasses);
      }
      for (const ex of [-.12, .12]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), mat(0x252c36)); eye.position.set(ex, 1.85, -.306); group.add(eye);
      }
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(.12, .025, .02), mat(0x9b5550)); mouth.position.set(0, 1.68, -.329); group.add(mouth);
      const arms = [];
      for (const side of [-1, 1]) {
        const arm = new THREE.Group(); arm.position.set(side * .38, 1.42, 0);
        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(.12, .14, .56, 8), clothesMat); sleeve.position.y = -.27; sleeve.castShadow = true; arm.add(sleeve);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), skinMat); hand.position.y = -.57; arm.add(hand);
        group.add(arm); arms.push(arm);
      }
      const legs = [];
      for (const side of [-1, 1]) {
        const leg = new THREE.Group(); leg.position.set(side * .17, .77, 0);
        const pants = new THREE.Mesh(new THREE.CylinderGeometry(.13, .115, .55, 8), mat(role === 'teacher' ? 0x46536d : 0x405274)); pants.position.y = -.27; pants.castShadow = true; leg.add(pants);
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(.22, .13, .38), shoeMat); shoe.position.set(0, -.55, -.08); leg.add(shoe);
        group.add(leg); legs.push(leg);
      }
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(.55, 20), new THREE.MeshBasicMaterial({ color: 0x15251e, transparent: true, opacity: .22, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .015; group.add(shadow);
      const name = makeTextSprite(data.name || 'Élève', { fontSize: 30, height: 58, scale: .006, bg: role === 'teacher' ? 'rgba(130,43,51,.9)' : 'rgba(14,28,48,.82)' }); name.position.y = 2.55; group.add(name);
      group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const headG = new THREE.Group(); headG.position.set(0, 1.75, 0); group.add(headG);
      group.children.slice().forEach(o => { if (o.isMesh && o.position.y > 1.6 && o.position.y < 2.4) { o.position.y -= 1.75; headG.add(o); } });
      const brows = [-1, 1].map(sx => { const b = new THREE.Mesh(new THREE.BoxGeometry(.13, .03, .03), hairMat); b.position.set(sx * .12, .2, -.31); headG.add(b); return b; });
      for (const arm of arms) { const f = new THREE.Mesh(new THREE.CylinderGeometry(.028, .034, .2, 6), skinMat); f.position.y = -.7; arm.add(f); }
      scene.add(group);
      return { group, arms, legs, body, head: headG, mouth, brows, skinMat, skin0: skinMat.color.clone(), red: 0, name, speech: null, speechText: '', speechT: 0, walkPhase: 0 };
    }

    // Personnage joueur et élèves.
    const playerAvatar = makeAvatar({ name: 'TOI', skin: 0xe8b894, hair: 0x33261f, clothes: 0x347ed0 }, 'player');
    const P = { x: 0, z: -8.2, vx: 0, vz: 0, speed: 5.0, coins: 0, inventory: [], selected: 0, hidden: false, jumpY: 0, jumpV: 0, lastAction: null, lastMischief: -99, energy: 100, moving: false, yaw: 0, avatar: playerAvatar, seatWarn: 0 };
    const S = STUDENTS.map((d, i) => {
      const avatar = makeAvatar({ ...d, name: d.name });
      return { ...d, i, avatar, x: seats[i].x, z: seats[i].z, vx: 0, vz: 0, target: { x: seats[i].x, z: seats[i].z }, home: { x: seats[i].x, z: seats[i].z }, affinity: 45 + Math.floor(Math.random() * 16), mood: 65 + Math.floor(Math.random() * 25), state: 'class', think: rand(.2, 1.5), talk: rand(2, 8), dance: 0, report: 0, memory: [], trust: 45, alert: 0, lastReact: -10, avatar, speed: rand(1.8, 2.35), visited: false, needs: { social: rand(25, 80), fun: rand(30, 85), hunger: rand(15, 55), energy: rand(65, 100), curiosity: rand(25, 80) }, relationships: Object.create(null), chatCooldown: 0, activityCooldown: rand(2,5), lastActivity: 'class', groupId: Math.floor(i/3), navPath: [], navIndex: 0, navBlocked: 0, navRetry: 0, idleTimer: 0 };
    });
    const teacherAvatar = makeAvatar({ name: 'MADAME MARTIN', skin: 0xeac09e, hair: 0x6c4133, clothes: 0x8c5a9e }, 'teacher');
    const T = { x: 11.5, z: -36.2, vx: 0, vz: 0, avatar: teacherAvatar, state: 'teach', suspicion: 0, patience: 100, target: { x: 11.5, z: -36.2 }, think: 0, alert: 0, heard: null, seenTimer: 0, cooldown: 0, strikes: 0, yaw: Math.PI, lastPunish: -99, wasPlayerInClassroom: false, exitCount: 0, calloutTimer: 0, calloutCooldown: 0, navPath: [], navIndex: 0, navBlocked: 0, navRetry: 0 };

    // Mise en place initiale des personnages.
    playerAvatar.group.position.set(P.x, 0, P.z);
    S.forEach(s => s.avatar.group.position.set(s.x, 0, s.z));
    teacherAvatar.group.position.set(T.x, 0, T.z); teacherAvatar.group.rotation.y = Math.PI;

    const state = {
      mode: 'menu', day: 1, phaseIndex: 0, phaseTime: PHASES[0].duration, totalTime: 0,
      adm: 50, chaos: 0, strikes: 0, dayCoins: 0, upgrades: {}, mission: null,
      toastTime: 0, toastText: '', hudTime: 0, noiseEvents: [], speechTime: 0, currentInteract: null,
      effects: [], score: 0, hoopShots: 0, lastNoise: -99, closing: false
    };

    const missionPool = [
      { id: 'friend', title: 'Fais-toi un nouvel ami', target: 1, progress: 0, reward: 25, unit: 'ami' },
      { id: 'collect', title: 'Trouve 3 objets dans la cour', target: 3, progress: 0, reward: 20, unit: 'objet' },
      { id: 'sport', title: 'Réussis 2 paniers au basket', target: 2, progress: 0, reward: 30, unit: 'panier' },
      { id: 'study', title: 'Participe à un cours', target: 1, progress: 0, reward: 22, unit: 'cours' },
      { id: 'social', title: 'Discute avec 3 élèves', target: 3, progress: 0, reward: 24, unit: 'discussion' },
      { id: 'computer', title: 'Réussis un défi informatique', target: 1, progress: 0, reward: 28, unit: 'défi' },
      { id: 'art', title: 'Crée une œuvre dans l’atelier', target: 1, progress: 0, reward: 22, unit: 'œuvre' },
      { id: 'club', title: 'Découvre un club de l’école', target: 1, progress: 0, reward: 20, unit: 'club' },
      { id: 'cafe', title: 'Prends un repas à la cantine', target: 1, progress: 0, reward: 18, unit: 'repas' }
    ];

    function toast(message) {
      state.toastText = message;
      state.toastTime = 2.7;
      toastEl.textContent = message;
      toastEl.classList.add('show');
    }
    function speak(person, message, duration = 3) {
      const av = person.avatar;
      if (av.speech) { av.group.remove(av.speech); av.speech.material.map.dispose(); av.speech.material.dispose(); }
      av.speechText = message;
      av.speechT = duration;
      av.speech = makeTextSprite(message.length > 54 ? message.slice(0, 52) + '…' : message, { fontSize: 29, height: 58, scale: .0064, bg: 'rgba(255,255,255,.96)', color: '#203149', stroke: 'rgba(27,45,70,.25)' });
      av.speech.position.y = 3.15;
      av.group.add(av.speech);
    }
    function updateSpeech(person, dt) {
      const av = person.avatar;
      if (av.speechT > 0) {
        av.speechT -= dt;
        if (av.speech) av.speech.position.y = 3.15 + Math.sin(state.totalTime * 5) * .04;
        if (av.speechT <= 0 && av.speech) {
          av.group.remove(av.speech); av.speech.material.map.dispose(); av.speech.material.dispose(); av.speech = null;
        }
      }
    }
    function setMission() {
      const m = pick(missionPool);
      state.mission = { ...m };
      $('[data-ui="mission"]').textContent = m.title;
    }
    function progressMission(id, n = 1) {
      const m = state.mission;
      if (!m || m.id !== id || m.progress >= m.target) return;
      m.progress = Math.min(m.target, m.progress + n);
      $('[data-ui="mission"]').textContent = `${m.title} (${m.progress}/${m.target})`;
      if (m.progress >= m.target) {
        P.coins += m.reward; state.dayCoins += m.reward;
        toast(`🎯 Objectif terminé : +${m.reward} 🪙`);
        m.claimed = true;
      }
    }

    function nearestStudent(x, z, max = 5) {
      if (P.lv) return null;
      let best = null, d = max;
      for (const s of S) { const ds = dist2({ x, z }, s); if (ds < d) { d = ds; best = s; } }
      return best ? { person: best, distance: d } : null;
    }
    function nearestWorldObject(x, z, max = 4) {
      let best = null, d = max;
      for (const o of world.interactables) {
        if (o.ref && o.ref.done) continue; if ((o.lv || 0) !== (P.lv || 0)) continue;
        const ds = dist2({ x, z }, o);
        const reach = o.radius || 2.5;
        if (ds < Math.min(d, reach)) { d = ds; best = o; }
      }
      return best ? { object: best, distance: d } : null;
    }
    function currentNearest() {
      const student = nearestStudent(P.x, P.z, 3.7);
      const obj = nearestWorldObject(P.x, P.z, 3.7);
      const teacherD = dist2(P, T);
      const opts = [];
      if (student) opts.push({ type: 'student', value: student.person, distance: student.distance });
      if (obj) opts.push({ type: 'object', value: obj.object, distance: obj.distance });
      if (teacherD < 3.2 && !P.lv) opts.push({ type: 'teacher', value: T, distance: teacherD });
      opts.sort((a, b) => a.distance - b.distance);
      return opts[0] || null;
    }

    function isClass() { return state.phaseIndex !== 1; }
    function phaseName() { return PHASES[state.phaseIndex].name; }
    function playerSpeed() { return state.upgrades.shoes ? 7.1 : 5.2; }
    function inventoryCapacity() { return state.upgrades.bag ? 6 : 3; }

    function recordEventBase(kind, x, z, volume = 8, mischief = false) {
      const ev = { kind, x, z, volume, time: state.totalTime, mischief, owner: 'player' };
      state.noiseEvents.push(ev);
      state.lastNoise = state.totalTime;
      if (mischief) { P.lastMischief = state.totalTime; P.lastAction = ev; state.chaos += volume * .45; }
      for (const s of S) {
        const d = dist2(s, ev);
        if (d < volume * .42 + 4) {
          s.memory.unshift({ kind, x, z, time: state.totalTime, mischief, player: true });
          s.memory.length = Math.min(s.memory.length, 6);
          s.alert = Math.max(s.alert, volume / 12);
          reactStudent(s, ev, d);
        }
      }
      const dT = dist2(T, ev);
      if (dT < volume * 1.0 + 5) {
        T.heard = { x, z, kind, time: state.totalTime, mischief, volume };
        T.alert = Math.max(T.alert, volume / 10);
        if (T.state !== 'chase' && T.state !== 'warn' && T.state !== 'cooldown') {
          T.state = 'investigate'; T.target = { x, z }; T.think = 0;
        }
      }
    }

    function studentCanNotice(s, radius = 10) {
      const dx = P.x - s.x, dz = P.z - s.z, d = Math.hypot(dx, dz);
      if (d > radius || P.hidden || P.lv) return false;
      const samples = Math.max(8, Math.ceil(d / .28));
      for (let i = 1; i < samples; i++) {
        const t = i / samples, x = s.x + dx * t, z = s.z + dz * t;
        if (world.walls.some(w => x > w.minX && x < w.maxX && z > w.minZ && z < w.maxZ)) return false;
      }
      const multiplier = s.type === 'reporter' || s.type === 'curious' ? 1.25 : 1;
      return d < radius * multiplier;
    }
    function reactStudent(s, ev, d) {
      if (funReact(s, ev, d)) return;
      if (state.totalTime - s.lastReact < 1.1) return;
      s.lastReact = state.totalTime;
      if (s.type === 'clown') {
        speak(s, pick(['😂 Incroyable !', 'Je suis mort de rire !', 'Refais ça !'])); s.mood = clamp(s.mood + 6, 0, 100); s.dance = 2.6;
      } else if (s.type === 'rebel') {
        speak(s, pick(['Bien joué !', 'On met de l’ambiance !', 'Trop fort !'])); s.affinity = clamp(s.affinity + 3, 0, 100); s.dance = 2.3;
      } else if (s.type === 'athlete') {
        speak(s, pick(['Ça, c’est du spectacle !', 'Allez, on bouge !'])); s.dance = 1.5;
      } else if (s.type === 'sage') {
        speak(s, pick(['Oh là là…', 'On va se faire remarquer.', 'Chut, le cours !'])); s.mood = clamp(s.mood - 3, 0, 100);
      } else if (s.type === 'reporter' && s.affinity < 62 && ev.mischief && d < 8) {
        speak(s, pick(['Je crois que madame doit savoir…', 'J’ai tout vu !', 'Je vais lui en parler.'])); s.report = rand(2.0, 4.2); s.reportPending = true;
      } else if (s.type === 'reporter' && !ev.mischief) {
        speak(s, 'Je note ça dans mon carnet !'); s.mood = clamp(s.mood + 2, 0, 100);
      } else if (s.type === 'shy') {
        speak(s, 'Euh… c’était voulu ?'); s.target = { x: s.home.x + rand(-3, 3), z: s.home.z + rand(-3, 3) };
      } else if (s.type === 'social') {
        speak(s, 'Tout le monde en parle !'); s.mood = clamp(s.mood + 4, 0, 100);
      }
    }

    function teacherCanSeePlayer() {
      if (P.hidden || P.lv) return false;
      const dx = P.x - T.x, dz = P.z - T.z, d = Math.hypot(dx, dz);
      const range = (state.upgrades.sneak ? 12 : 18) * (P.disguise > 0 ? .4 : 1);
      if (d > range || d < .1) return false;
      const fwdX = -Math.sin(T.yaw), fwdZ = -Math.cos(T.yaw);
      const dot = (fwdX * dx + fwdZ * dz) / d;
      const cone = isClass() ? .18 : .05;
      if (dot <= cone) return false;
      // Les cloisons opaques bloquent la vue : la prof ne peut plus voir à travers les salles.
      const samples = Math.max(12, Math.ceil(d / .22));
      for (let i = 1; i < samples; i++) {
        const t = i / samples, x = T.x + dx * t, z = T.z + dz * t;
        if (world.walls.some(w => x > w.minX && x < w.maxX && z > w.minZ && z < w.maxZ)) return false;
      }
      return true;
    }

    function warnPlayer(reason = 'Je t’ai vu !') {
      if (state.mode !== 'play' || T.state === 'cooldown') return;
      T.state = 'warn'; T.target = { x: P.x, z: P.z }; T.think = 0;
      speak({ avatar: T.avatar }, pick(['Hé ! On se calme !', 'Je t’ai à l’œil !', 'Ça suffit maintenant !']));
      toast(`👩‍🏫 Madame Martin : ${reason}`);
    }

    function punishPlayer() {
      if (state.totalTime - T.lastPunish < 6) return;
      T.lastPunish = state.totalTime;
      state.strikes += 1; T.strikes = state.strikes;
      state.adm = clamp(state.adm - (state.adm > 70 ? 8 : 15), 0, 100);
      T.patience = clamp(T.patience - 22, 0, 100);
      T.suspicion = 15; T.state = 'cooldown'; T.cooldown = 5; P.vx = P.vz = 0;
      speak({ avatar: T.avatar }, pick(['Un avertissement dans le carnet !', 'Au prochain écart, direction le bureau !', 'On se concentre, maintenant !']), 3.5);
      toast(`⚠️ Avertissement ${state.strikes}/3`);
      if (state.strikes >= 3) endDay('director');
    }

    function coverOrReport(reporter) {
      const helpers = S.filter(s => s !== reporter && s.affinity > 58 && dist2(s, P) < 8 && (s.type === 'rebel' || s.type === 'clown' || s.type === 'social'));
      if (helpers.length && Math.random() < .58) {
        const helper = pick(helpers);
        speak(helper, 'Madame, ce n’est pas lui !');
        speak({ avatar: T.avatar }, 'Hmm… je vais vérifier.');
        T.suspicion = Math.max(0, T.suspicion - 24);
        T.state = 'investigate'; T.target = { x: P.x + rand(-4, 4), z: P.z + rand(-4, 4) };
        toast(`${helper.name} t’a couvert ! 🛡️`);
      } else {
        speak(reporter, 'Madame ! J’ai quelque chose à dire !');
        T.heard = { x: reporter.x, z: reporter.z, kind: 'report', time: state.totalTime, mischief: true, volume: 16 };
        T.alert = 1.5; T.state = 'investigate'; T.target = { x: reporter.x, z: reporter.z };
        toast(`${reporter.name} a rapporté ce qu’il a vu…`);
      }
    }

    function showPanel(title, subtitle, bodyHtml, buttons, eyebrow = 'COLLÈGE TYCOON') {
      overlay.innerHTML = `<div class="et3d-panel"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="sub">${subtitle || ''}</p>${bodyHtml || ''}<div class="et3d-actions"></div><div class="et3d3d-footer">Collège Tycoon · Une journée pleine de surprises</div></div>`;
      overlay.classList.remove('hidden');
      const actions = overlay.querySelector('.et3d-actions');
      for (const item of buttons || []) {
        const button = document.createElement('button');
        button.className = `et3d-btn${item.secondary ? ' secondary' : ''}`;
        button.textContent = item.label;
        button.disabled = !!item.disabled;
        button.addEventListener('click', item.action);
        actions.appendChild(button);
      }
    }
    function hidePanel() { overlay.classList.add('hidden'); }

    function updateHotbar() {
      hotbarEl.innerHTML = '';
      const slots = inventoryCapacity();
      for (let i = 0; i < slots; i++) {
        const itemId = P.inventory[i];
        const slot = document.createElement('button');
        slot.className = `et3d-slot${i === P.selected ? ' active' : ''}`;
        slot.innerHTML = `<small>${i + 1}</small>${itemId ? ITEMS[itemId].icon : ''}${itemId ? '<em>1</em>' : ''}`;
        slot.title = itemId ? ITEMS[itemId].name : 'Emplacement vide';
        slot.addEventListener('click', () => { P.selected = i; updateHotbar(); });
        hotbarEl.appendChild(slot);
      }
    }

    function updateHud(force = false) {
      if (!force && state.hudTime > 0) return;
      state.hudTime = .18;
      $('[data-ui="day"]').textContent = state.day;
      $('[data-ui="phase"]').textContent = phaseName();
      $('[data-ui="timer"]').textContent = Math.ceil(state.phaseTime);
      $('[data-ui="coins"]').textContent = P.coins;
      $('[data-ui="adm"]').textContent = Math.round(state.adm);
      $('[data-ui="strikes"]').textContent = state.strikes;
      let zone='Cour centrale';
      if(P.z>91) zone='Stade';
      else if(P.z>51&&P.z<94&&Math.abs(P.x)<34) zone='Gymnase';
      else if(P.x<-33&&P.z>-45&&P.z<1) zone='Bâtiment A · Sciences';
      else if(P.x>33&&P.z>-45&&P.z<1) zone='Bâtiment B · Arts / CDI';
      else if(P.z<=2&&P.z>-13.8) zone='Parvis';
      else if(P.z<=-13.8) zone=Math.abs(P.x)<2.4?'Couloir':(P.z<-25.5?(P.x<0?'Classe 101':'Classe 102'):(P.x<0?'Bibliothèque / Arts':'Cantine'));
      $('[data-ui="zone"]').textContent = zone;
      const nearest = currentNearest();
      state.currentInteract = nearest;
      let prompt = '';
      if (P.hidden) prompt = 'E : sortir du buisson';
      else if (nearest) {
        if (nearest.type === 'student') prompt = `E : parler avec ${nearest.value.name}`;
        else if (nearest.type === 'teacher') prompt = 'E : parler à Madame Martin';
        else prompt = `E : ${nearest.value.prompt || nearest.value.name}`;
      }
      promptEl.textContent = prompt;
      promptEl.classList.toggle('show', !!prompt && state.mode === 'play');
    }

    function spawnFx(kind, x, z, color = 0xffd166) {
      const group = new THREE.Group();
      if (kind === 'confetti' || kind === 'spark') {
        for (let i = 0; i < 18; i++) {
          const piece = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, .12), mat(pick([0xf06c87, 0xffd166, 0x70d6b3, 0x7bb8f4, 0xc5a2ed])));
          piece.position.set(rand(-.45, .45), rand(.2, 2.2), rand(-.45, .45)); piece.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6)); group.add(piece);
        }
      } else {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.3, .06, 8, 24), mat(color, .25)); ring.rotation.x = Math.PI / 2; group.add(ring);
      }
      group.position.set(x, .45, z); scene.add(group);
      world.fx.push({ group, kind, t: 1.5, baseY: .45 });
    }

    function addCoins(n, reason) {
      P.coins += n; state.dayCoins += n;
      if (reason) toast(`${reason} · +${n} 🪙`);
    }

    function addItem(id) {
      if (P.inventory.length >= inventoryCapacity()) { toast('🎒 Ton sac est plein !'); return false; }
      P.inventory.push(id); P.selected = P.inventory.length - 1;
      updateHotbar(); toast(`${ITEMS[id].icon} ${ITEMS[id].name} ajouté au sac`);
      return true;
    }

    function takePickup(spot) {
      if (!spot || spot.done) return;
      if (addItem(spot.item)) {
        spot.done = true; spot.group.visible = false;
        progressMission('collect');
        recordEvent('pickup', P.x, P.z, 2, false);
      }
    }

    function interactStudent(s) {
      const boost = state.upgrades.charm ? 1.7 : 1;
      s.affinity = clamp(s.affinity + 8 * boost, 0, 100);
      s.trust = clamp(s.trust + 5, 0, 100);
      s.mood = clamp(s.mood + 4, 0, 100);
      s.needs.social = Math.max(5, s.needs.social - 18);
      s.relationships.player = clamp((s.relationships.player || 0) + 7, -100, 100);
      s.memory.unshift({ kind: 'friendly-talk', time: state.totalTime, detail: 'Le joueur est venu discuter.' });
      s.memory.length = Math.min(s.memory.length, 8);
      s.visited = true;
      const lines = {
        sage: ['Tu as fini les exercices ?', 'On révise ensemble ?', 'J’ai compris le dernier problème !'],
        clown: ['Tu connais une bonne blague ?', 'Après le cours, on fait un concours ?', 'Tu vas voir mon nouveau dessin !'],
        reporter: ['Alors, quoi de neuf ?', 'J’ai entendu une super info…', 'Promis, je ne répète pas tout.'],
        rebel: ['Tu viens avec nous ?', 'La récré est trop courte !', 'On explore le fond de la cour ?'],
        athlete: ['Tu veux faire un match ?', 'Je peux t’apprendre un tir !', 'Bien joué, champion !'],
        social: ['Tu devrais venir avec nous !', 'On prépare un club ?', 'Tu connais tout le monde ici ?'],
        curious: ['Tu as trouvé quelque chose ?', 'Tu as vu le vieux cabanon ?', 'J’adore découvrir des endroits !'],
        shy: ['Salut… ça va ?', 'Tu peux rester un peu ?', 'Merci de venir me parler.']
      };
      speak(s, pick(lines[s.type] || lines.social));
      if (s.affinity > 70 && Math.random() < .35) { speak(s, 'On est amis maintenant !'); addCoins(3, 'Amitié'); progressMission('friend'); }
      progressMission('social');
      if (state.upgrades.charm) s.affinity = clamp(s.affinity + 2, 0, 100);
      toast(`${s.name} · Amitié ${Math.round(s.affinity)}%`);
    }

    function useObject(o) {
      if (upObject(o)) return;
      switch (o.kind) {
        case 'pickup': takePickup(o.ref); break;
        case 'bush':
          P.hidden = !P.hidden; P.vx = P.vz = 0;
          toast(P.hidden ? '🌿 Tu te caches. La prof ne te voit plus !' : 'Tu sors du buisson.');
          break;
        case 'bench':
          P.energy = clamp(P.energy + 28, 0, 100); state.adm = clamp(state.adm + 1, 0, 100);
          speak({ avatar: P.avatar }, 'Petite pause bien méritée !'); toast('☀️ Pause détente : énergie récupérée.'); break;
        case 'bin': {
          const found = pick(['pomme', 'craie', 'confetti', 'slime']);
          if (addItem(found)) recordEvent('fouille', P.x, P.z, 4, false);
          else toast('Tu n’as plus de place dans ton sac.');
          break;
        }
        case 'vending':
          if (P.coins < 5) toast('Il te faut 5 pièces pour acheter une pomme.');
          else if (P.inventory.length >= inventoryCapacity()) toast('Ton sac est plein !');
          else { P.coins -= 5; addItem('pomme'); toast('🍎 Une pomme toute fraîche !'); }
          break;
        case 'fountain':
          P.energy = clamp(P.energy + 18, 0, 100); spawnFx('spark', P.x, P.z, 0x6ed5f1); recordEvent('fontaine', P.x, P.z, 7, false); toast('💦 Un peu d’eau fraîche !'); break;
        case 'hoop': {
          const success = Math.random() < .73;
          state.hoopShots++;
          if (success) { addCoins(8, 'PANIER !'); state.score += 10; spawnFx('confetti', o.x, o.z, 0xffd166); speak({ avatar: P.avatar }, 'SWISH !'); progressMission('sport'); S.filter(s => s.type === 'athlete' || s.type === 'clown').forEach(s => { if (dist2(s, P) < 13) { speak(s, 'Bien joué !'); s.dance = 1.4; } }); }
          else { toast('Presque ! Retente ta chance.'); spawnFx('spark', o.x, o.z, 0x8bc6e8); }
          recordEvent('basket', P.x, P.z, 5, false);
          break;
        }
        case 'board':
          if (isClass()) {
            state.adm = clamp(state.adm + 4, 0, 100); addCoins(4, 'Participation'); progressMission('study');
            speak({ avatar: T.avatar }, 'Bonne réponse ! Continue comme ça.'); toast('✏️ Tu as participé au cours.');
          } else { toast('Le tableau attendra le prochain cours.'); }
          break;
        case 'library':
          state.adm = clamp(state.adm + 5, 0, 100); P.energy = clamp(P.energy + 10, 0, 100); addCoins(4, 'Révisions');
          speak({ avatar: P.avatar }, 'Un peu de lecture !'); toast('📖 Tu as révisé tranquillement.'); progressMission('study');
          break;
        case 'locker': {
          const found = pick(['stickers','carnet','craie','badge']);
          if (addItem(found)) { recordEvent('casier', P.x, P.z, 3, false); toast(`Ton casier contenait : ${ITEMS[found].name} !`); }
          break;
        }
        case 'cafeteria':
          if (P.coins < 8) { toast('Il te faut 8 pièces pour acheter un repas.'); break; }
          P.coins -= 8; P.energy = clamp(P.energy + 28, 0, 100); addItem('sandwich');
          S.filter(s => dist2(s, P) < 9).forEach(s => { s.needs.hunger = Math.max(5, s.needs.hunger - 18); });
          progressMission('cafe'); toast('🥪 Pause déjeuner : énergie récupérée !'); recordEvent('repas', P.x, P.z, 2, false); break;
        case 'computer': {
          const questions = [
            { q: 'Quel raccourci permet de copier un texte ?', a: ['Ctrl + C','Ctrl + V','Ctrl + Z'], correct: 0 },
            { q: 'Combien font 8 × 7 ?', a: ['54','56','64'], correct: 1 },
            { q: 'Quel composant affiche les images ?', a: ['Écran','Clavier','Souris'], correct: 0 }
          ];
          const q = pick(questions); state.mode = 'panel';
          showPanel('Défi informatique', q.q, '<p>Choisis la bonne réponse pour gagner des pièces et améliorer ta réputation.</p>', q.a.map((label,i)=>({ label, secondary:i!==q.correct, action:()=>{ state.mode='play'; hidePanel(); if(i===q.correct){ addCoins(12,'Défi réussi'); state.adm=clamp(state.adm+3,0,100); progressMission('computer'); toast('💻 Bonne réponse !'); } else { state.adm=clamp(state.adm-2,0,100); toast('Pas tout à fait… retente plus tard !'); } } })).concat([{label:'Quitter',secondary:true,action:()=>{state.mode='play';hidePanel();}}]), 'SALLE INFORMATIQUE');
          break;
        }
        case 'art':
          spawnFx('confetti', P.x, P.z, 0xf4a9b4); addCoins(7,'Atelier créatif'); progressMission('art');
          state.adm=clamp(state.adm+2,0,100); recordEvent('dessin',P.x,P.z,3,false); speak({avatar:P.avatar},'Voilà mon chef-d’œuvre !'); break;
        case 'piano':
          recordEvent('musique',P.x,P.z,10,false); S.filter(s=>dist2(s,P)<13).forEach(s=>{s.dance=2.5;s.mood=clamp(s.mood+5,0,100);s.needs.fun=Math.max(5,s.needs.fun-18);if(s.type!=='sage')speak(s,pick(['C’est joli !','Encore un morceau !','On danse ?']));});
          addCoins(3,'Mini concert'); toast('🎹 Tu as joué un morceau !'); break;
        case 'gym': {
          state.mode='panel';
          showPanel('Match au gymnase','Choisis ton défi sportif.','<p>🏀 Tournoi de basket : tente plusieurs paniers.<br>🏃 Parcours sportif : fais un tour du terrain et gagne des pièces.</p>',[
            {label:'🏀 Concours de tirs',action:()=>{state.mode='play';hidePanel();for(let i=0;i<3;i++){const success=Math.random()<.72;if(success){state.hoopShots++;addCoins(6,'Panier marqué');progressMission('sport');}}toast('Fin du concours ! Consulte tes pièces.');}},
            {label:'Continuer',secondary:true,action:()=>{state.mode='play';hidePanel();}}
          ],'ASSOCIATION SPORTIVE');
          break;
        }
        case 'field': {
          const reward=10+Math.floor(Math.random()*9);addCoins(reward,'Match de football');state.adm=clamp(state.adm+1,0,100);progressMission('sport');
          S.filter(s=>dist2(s,P)<20).forEach(s=>{s.dance=1.4;if(Math.random()<.35)speak(s,pick(['Belle passe !','Bien joué !','On remet ça ?']));});
          toast('⚽ Match terminé : beau jeu !');recordEvent('football',P.x,P.z,4,false);break;
        }
        case 'notice':
          progressMission('club'); state.adm=clamp(state.adm+2,0,100);
          state.mode='panel'; showPanel('Les clubs de l’école','Choisis une activité après les cours.','<p>⚽ Club de sport · 🎨 Club artistique · 💻 Club informatique · 📚 Club lecture</p><p>Chaque club propose des défis différents et te permet de rencontrer des élèves.</p>',[{label:'Rejoindre le club de sport',action:()=>{state.mode='play';hidePanel();addCoins(5,'Inscription au club');progressMission('club');}},{label:'Continuer',secondary:true,action:()=>{state.mode='play';hidePanel();}}],'VIE SCOLAIRE');
          break;
        default: toast('Rien à faire ici pour le moment.');
      }
    }

    function interact() {
      if (state.mode !== 'play') return;
      if (lessonInteract()) return;
      if (P.hidden) { P.hidden = false; toast('Tu sors de ta cachette.'); return; }
      const n = currentNearest();
      if (!n) { toast('Approche-toi d’un élève ou d’un objet pour interagir.'); return; }
      if (n.type === 'student') interactStudent(n.value);
      else if (n.type === 'teacher') {
        if (isClass()) { state.adm = clamp(state.adm + 3, 0, 100); addCoins(3, 'Bon comportement'); speak({ avatar: T.avatar }, pick(['Bonjour ! Tu as une question ?', 'C’est bien de participer.', 'Continue tes efforts !'])); progressMission('study'); }
        else { speak({ avatar: T.avatar }, 'Profite de la récré, mais reste raisonnable !'); state.adm = clamp(state.adm + 1, 0, 100); }
      } else useObject(n.value);
    }

    function useItem() {
      if (state.mode !== 'play') return;
      const id = P.inventory[P.selected];
      if (!id) { jump(); return; }
      const target = nearestStudent(P.x, P.z, 8);
      if (useFunItem(id, target)) { P.inventory.splice(P.selected, 1); P.selected = Math.max(0, Math.min(P.selected, P.inventory.length - 1)); updateHotbar(); return; }
      if (id === 'pomme') {
        if (target && target.distance < 4.5) {
          target.person.affinity = clamp(target.person.affinity + 14, 0, 100);
          speak(target.person, 'Oh merci ! 🍎');
          addCoins(2, 'Générosité'); progressMission('friend');
        } else if (dist2(P, T) < 4.5) { state.adm = clamp(state.adm + 13, 0, 100); speak({ avatar: T.avatar }, 'Merci, c’est adorable !'); toast('+13 respect'); }
        else { toast('Approche-toi de quelqu’un pour offrir la pomme.'); return; }
      } else if (id === 'ballon') {
        const direction = target ? { x: target.person.x, z: target.person.z } : { x: P.x + Math.sin(P.yaw) * 7, z: P.z - Math.cos(P.yaw) * 7 };
        const ball = new THREE.Mesh(new THREE.SphereGeometry(.42, 16, 12), mat(0xf4f2e8, .35)); ball.position.set(P.x, 1.3, P.z); ball.castShadow = true; scene.add(ball);
        const end = V3(direction.x, .55, direction.z); const start = ball.position.clone();
        const fx = { group: ball, kind: 'thrownBall', t: .7, start, end, age: 0 }; world.fx.push(fx);
        if (target) { target.person.affinity = clamp(target.person.affinity + 3, 0, 100); target.person.dance = 1.5; speak(target.person, pick(['Passe !', 'Bien reçu !', 'À moi !'])); }
        recordEvent('ballon', P.x, P.z, 8, false); toast('⚽ Belle passe !');
      } else if (id === 'craie') {
        const nearBoard = dist2(P, { x: 0, z: -37.5 }) < 7;
        if (!nearBoard) { toast('La craie s’utilise près du tableau.'); return; }
        spawnFx('confetti', 0, -37.2, 0xf3a4bb); recordEvent('dessin', P.x, P.z, 9, true); toast('🖍️ Tu as dessiné un petit smiley au tableau !');
      } else if (id === 'slime') {
        spawnFx('spark', P.x + rand(-.8, .8), P.z + rand(-.8, .8), 0x72e58e); recordEvent('slime', P.x, P.z, 11, true);
        S.filter(s => dist2(s, P) < 9 && s.type !== 'sage').forEach(s => { s.dance = 2.4; speak(s, 'Beuuurk… mais drôle !'); });
        toast('🟢 Plop ! Le slime fait rire tout le monde.');
      } else if (id === 'enceinte') {
        recordEvent('musique', P.x, P.z, 16, true);
        S.filter(s => dist2(s, P) < 16).forEach(s => { s.dance = 4; if (s.type !== 'sage') speak(s, pick(['💃 On danse !', 'C’est notre chanson !', 'YEAH !'])); });
        toast('🔊 Mini soirée improvisée !');
      } else if (id === 'confetti') {
        spawnFx('confetti', P.x, P.z); recordEvent('confettis', P.x, P.z, 13, true);
        S.filter(s => dist2(s, P) < 13).forEach(s => { s.dance = 1.6; speak(s, 'SURPRISE ! 🎉'); });
        toast('🎉 Pluie de confettis !');
      } else if (id === 'sandwich') {
        P.energy=clamp(P.energy+30,0,100); toast('🥪 Tu as repris des forces.');
      } else if (id === 'stickers') {
        const target=nearestStudent(P.x,P.z,5); if(target){target.person.affinity=clamp(target.person.affinity+12,0,100);speak(target.person,'Oh, je peux en avoir un ?');progressMission('friend');addCoins(3,'Échange sympa');} else toast('Approche-toi d’un élève pour partager les autocollants.');
      } else if (id === 'carnet') {
        state.adm=clamp(state.adm+4,0,100); addCoins(4,'Notes retrouvées'); toast('📓 Tu as retrouvé tes notes de cours.');
      } else if (id === 'waterballoon') {
        const target=nearestStudent(P.x,P.z,9); if(target){const s=target.person;s.mood=clamp(s.mood-5,0,100);s.dance=1.1;speak(s,pick(['Hé ! Il est froid !','Bien joué, je ne m’y attendais pas !','La revanche arrive !']));recordEvent('eau',P.x,P.z,8,true);toast('💦 Plouf ! Attention à la réaction…');} else toast('Il n’y a personne à proximité.');
      } else if (id === 'badge') {
        state.adm=clamp(state.adm+8,0,100); S.forEach(s=>{s.affinity=clamp(s.affinity+2,0,100)}); addCoins(5,'Badge du club'); toast('🏅 Tu as rejoint un club !');
      }
      P.inventory.splice(P.selected, 1);
      P.selected = Math.max(0, Math.min(P.selected, P.inventory.length - 1));
      updateHotbar();
    }

    function jump() {
      if (P.jumpY <= 0.02) P.jumpV = 6.2;
    }

    function handleStudentReport(s, dt) {
      if (s.report > 0) s.report -= dt;
      if (s.report <= 0 && s.reportPending) {
        s.reportPending = false;
        s.reportCooldown = state.totalTime + 11;
        if (s.type === 'reporter' && s.memory.some(m => m.mischief && state.totalTime - m.time < 8)) coverOrReport(s);
      }
    }

    function chooseStudentGoal(s) {
      if (isClass()) {
        s.state = 'study'; s.target = { ...s.home }; s.lastActivity = 'class'; return;
      }
      // Les élèves sortent par les portes du couloir plutôt que de traverser les cloisons.
      if (s.z < -13.8 && Math.abs(s.x) > 2.6) {
        // Les élèves utilisent la sortie latérale la plus proche de leur salle.
        // Cela évite que toute la classe se bloque dans la porte centrale.
        const doorX=s.x<0?-8:8;
        const lane=(s.i%3-1)*.38;
        s.target={x:doorX+lane,z:-11.5+(s.i%3)*.28};
        s.state='exit';s.lastActivity='exit';return;
      }
      if (s.z < -13.8 && Math.abs(s.x) <= 2.6) {
        s.target={x:(s.i%2===0?-.65:.65),z:-10.8-(s.i%4)*.42};
        s.state='exit';s.lastActivity='exit';return;
      }
      // À la récré, chaque élève choisit une activité en fonction de ses besoins et de son tempérament.
      const socialZones = [
        {x:-54,z:-12},{x:54,z:-12},{x:-34,z:25},{x:34,z:26},{x:-18,z:45},{x:18,z:47}
      ];
      const groupSpot = socialZones[s.groupId % socialZones.length];
      const groupOffset = (s.i % 3) - 1;
      const socialTarget = { x: groupSpot.x + groupOffset * 2.6 + rand(-.5,.5), z: groupSpot.z + (groupOffset % 2) * 2.2 + rand(-.6,.6) };
      const activities = [
        { id: 'social', score: s.needs.social * (s.type === 'social' || s.type === 'shy' ? 1.35 : 1), target: socialTarget },
        { id: 'sport', score: s.needs.fun * (s.type === 'athlete' || s.type === 'clown' ? 1.45 : .72), target: { x: rand(-19,19), z: rand(62,79) } },
        { id: 'cafe', score: s.needs.hunger * (s.type === 'social' ? 1.1 : 1), target: pick([{x:10,z:-18},{x:49,z:-8},{x:-49,z:-8},{x:13,z:-19}]) },
        { id: 'rest', score: (100-s.needs.energy) * 1.2, target: (()=>{const q=pick([{x:-34,z:11},{x:34,z:11},{x:-52,z:24},{x:52,z:24},{x:0,z:42}]);return{x:q.x+rand(-2.2,2.2),z:q.z+rand(-1.8,1.8)};})() },
        { id: 'explore', score: s.needs.curiosity * (s.type === 'curious' || s.type === 'reporter' ? 1.45 : .7), target: pick([{x:-54,z:-34},{x:54,z:-34},{x:-44,z:-6},{x:44,z:-6},{x:-18,z:43},{x:18,z:45}]) }
      ];
      if (s.type === 'sage') activities.find(a => a.id === 'rest').score += 8;
      if (s.type === 'rebel') activities.find(a => a.id === 'sport').score += 12;
      if (s.type === 'shy') activities.find(a => a.id === 'social').score -= 12;
      activities.sort((a,b)=>b.score-a.score);
      // Un peu d'aléatoire évite des routines identiques sans transformer le déplacement en hasard pur.
      const chosen = activities[0];
      s.state = chosen.id; s.target = chosen.target; s.lastActivity = chosen.id;
    }

    function moveCharacter(entity, dt, speed, obstacles = true) {
      const remaining=Math.hypot(entity.target.x-entity.x,entity.target.z-entity.z);
      if(remaining<.48){entity.vx*=Math.pow(.02,dt);entity.vz*=Math.pow(.02,dt);entity.navPath=[];entity.navIndex=0;return false;}
      const goalChanged=!entity.navGoal||Math.hypot(entity.target.x-entity.navGoal.x,entity.target.z-entity.navGoal.z)>1.0;
      const retryReady=state.totalTime>=(entity.navRetry||0);
      if(goalChanged||((!entity.navPath||entity.navPath.length===0||entity.navIndex>=entity.navPath.length)&&retryReady)||(entity.navBlocked>.65&&retryReady))setEntityPath(entity);
      let waypoint=entity.navPath&&entity.navPath[entity.navIndex];
      if(!waypoint){entity.vx*=Math.pow(.03,dt);entity.vz*=Math.pow(.03,dt);return false;}
      while(entity.navIndex<entity.navPath.length&&Math.hypot(waypoint.x-entity.x,waypoint.z-entity.z)<.48){entity.navIndex++;waypoint=entity.navPath[entity.navIndex];}
      if(!waypoint){entity.vx*=Math.pow(.03,dt);entity.vz*=Math.pow(.03,dt);return false;}
      let dx=waypoint.x-entity.x,dz=waypoint.z-entity.z,d=Math.hypot(dx,dz)||.001,ix=dx/d,iz=dz/d;
      if(obstacles){for(const other of S){if(other===entity)continue;const ox=entity.x-other.x,oz=entity.z-other.z,od=Math.hypot(ox,oz);if(od>.01&&od<.95){const push=(.95-od)*.8;ix+=ox/od*push;iz+=oz/od*push;}}}
      const il=Math.hypot(ix,iz)||1;ix/=il;iz/=il;
      entity.vx+=(ix*speed-entity.vx)*Math.min(1,dt*7);
      entity.vz+=(iz*speed-entity.vz)*Math.min(1,dt*7);
      const nx=entity.x+entity.vx*dt,nz=entity.z+entity.vz*dt;
      if(navOpen(nx,nz)){entity.x=nx;entity.z=nz;entity.navBlocked=0;}
      else{
        let slid=false;
        if(navOpen(nx,entity.z)){entity.x=nx;slid=true;}else entity.vx=0;
        if(navOpen(entity.x,nz)){entity.z=nz;slid=true;}else entity.vz=0;
        entity.navBlocked=(entity.navBlocked||0)+dt;
        if(slid)entity.navBlocked=Math.max(0,entity.navBlocked-dt*.45);
      }
      if(entity.navBlocked>.65){entity.navPath=[];entity.navIndex=0;entity.navRetry=state.totalTime+.25;entity.vx*=.2;entity.vz*=.2;}
      const moving=Math.hypot(entity.vx,entity.vz)>.2;
      if(moving){entity.yaw=Math.atan2(-entity.vx,-entity.vz);entity.avatar.group.rotation.y=entity.yaw;}
      return moving;
    }

    function animateAvatarBase(person, moving, dt, speed = 1) {
      const av = person.avatar;
      av.walkPhase += dt * (moving ? 9 * speed : 2.2);
      const swing = moving ? Math.sin(av.walkPhase) * .58 : Math.sin(av.walkPhase) * .035;
      av.legs[0].rotation.x = swing; av.legs[1].rotation.x = -swing;
      av.arms[0].rotation.x = -swing * .72; av.arms[1].rotation.x = swing * .72;
      av.body.position.y = 1.13 + (moving ? Math.abs(Math.sin(av.walkPhase * 2)) * .045 : 0);
      if (person.dance > 0) {
        av.arms[0].rotation.z = Math.sin(state.totalTime * 9) * .75 - .35;
        av.arms[1].rotation.z = -Math.sin(state.totalTime * 9) * .75 + .35;
        av.group.rotation.y += Math.sin(state.totalTime * 5) * dt * .45;
      } else { av.arms[0].rotation.z *= .8; av.arms[1].rotation.z *= .8; }
      av.group.position.set(person.x, person.jumpY || 0, person.z);
    }

    function updateStudents(dt) {
      for (const s of S) {
        s.think -= dt; s.talk -= dt; s.alert = Math.max(0, s.alert - dt * .16); s.dance = Math.max(0, s.dance - dt);
        s.chatCooldown = Math.max(0, s.chatCooldown - dt);
        s.needs.social = clamp(s.needs.social + dt * (s.state === 'social' ? -.55 : .22), 0, 100);
        s.needs.fun = clamp(s.needs.fun + dt * (s.state === 'sport' ? -.8 : .25), 0, 100);
        s.needs.hunger = clamp(s.needs.hunger + dt * .10, 0, 100);
        s.needs.energy = clamp(s.needs.energy + dt * (s.state === 'rest' ? .7 : -.035), 0, 100);
        s.needs.curiosity = clamp(s.needs.curiosity + dt * .12, 0, 100);
        updateSpeech(s, dt); handleStudentReport(s, dt);
        if(s.state==='exit'&&s.z>-12.3){chooseStudentGoal(s);s.think=rand(3.0,5.0);}
        else if (s.think <= 0) { chooseStudentGoal(s); s.think = rand(2.8,5.2); }
        if (isClass()) {
          s.target={x:s.home.x,z:s.home.z};
          const returning=dist2(s,s.home)>.58?moveCharacter(s,dt,s.speed*1.12,true):false;
          if(!returning){s.x=s.home.x;s.z=s.home.z;s.vx=0;s.vz=0;s.navPath=[];s.navGoal=null;s.avatar.group.rotation.y=0;}
          animateAvatar(s,returning,dt,1);
          if (s.talk <= 0 && Math.random() < dt * .12 && s.type !== 'sage') {
            speak(s, pick(['Psst… tu as compris ?', 'Tu me passes une feuille ?', 'C’est bientôt la récré ?'])); s.talk = rand(5, 10);
          }
          if (s.type === 'sage' && s.talk <= 0 && Math.random() < dt * .03) { s.avatar.group.rotation.y = rand(-.5, .5); s.talk = rand(6, 10); }
        } else {
          if (s.state === 'follow' && dist2(s, P) > 13) { s.state = 'wander'; s.target = { x: rand(-65,65), z: rand(5,120) }; }
          const moving = moveCharacter(s, dt, s.state === 'follow' ? 2.6 : s.speed, true);
          animateAvatar(s, moving, dt, s.speed / 2);
          if (s.talk <= 0 && dist2(s, P) < 4.5 && Math.random() < .16) {
            speak(s, pick(['Salut !', 'Tu viens jouer ?', 'T’as trouvé des trucs ?', 'On fait équipe ?'])); s.talk = rand(5, 10);
          }
        }
        if (!isClass()) {
          s.activityCooldown = Math.max(0, s.activityCooldown - dt);
          if (s.state === 'cafe' && dist2(s, {x:10,z:-18}) < 4 && s.activityCooldown <= 0) {
            s.needs.hunger = Math.max(5, s.needs.hunger - 42); s.needs.energy = clamp(s.needs.energy + 12,0,100);
            s.activityCooldown = rand(12,18); speak(s, pick(['J’avais faim !','La cantine est bonne aujourd’hui.','Tu veux t’asseoir avec nous ?']));
          } else if (s.state === 'rest' && dist2(s, s.target) < 2.3 && s.activityCooldown <= 0) {
            s.needs.energy = clamp(s.needs.energy + 28,0,100); s.mood = clamp(s.mood + 5,0,100); s.activityCooldown = rand(10,16);
            speak(s, pick(['Petite pause.','Je reprends mon souffle.','Ça fait du bien de se poser.']));
          } else if (s.state === 'sport' && dist2(s, {x:0,z:72}) < 16 && s.activityCooldown <= 0) {
            s.needs.fun = Math.max(5,s.needs.fun-26); s.mood=clamp(s.mood+4,0,100); s.activityCooldown=rand(8,13);
            if (s.type==='athlete' || s.type==='clown') { s.dance=1.1; speak(s,pick(['Bien joué !','À toi la prochaine !','Encore un match !'])); }
          } else if (s.state === 'explore' && dist2(s,s.target) < 2 && s.activityCooldown <= 0) {
            s.needs.curiosity=Math.max(5,s.needs.curiosity-24); s.activityCooldown=rand(9,15);
            if (s.type==='curious' || s.type==='reporter') speak(s,pick(['Je ne connaissais pas cet endroit.','Tiens, c’est intéressant !','Je vais raconter ça aux autres.']));
          }
        }
        if (!isClass() && s.state === 'social' && s.chatCooldown <= 0) {
          const partner = S.filter(o => o !== s && dist2(s, o) < 2.4).sort((a,b)=>(s.relationships[b.i]||0)-(s.relationships[a.i]||0))[0];
          if (partner) {
            s.chatCooldown = partner.chatCooldown = rand(7, 12);
            s.needs.social = Math.max(8, s.needs.social - 32); partner.needs.social = Math.max(8, partner.needs.social - 24);
            s.relationships[partner.i] = clamp((s.relationships[partner.i] || 0) + 5, -100, 100);
            partner.relationships[s.i] = clamp((partner.relationships[s.i] || 0) + 4, -100, 100);
            speak(s, pick(['Tu as vu le match hier ?', 'On mange ensemble ?', 'Tu viens au club après ?']));
            speak(partner, pick(['Oui, carrément !', 'Bonne idée !', 'Attends-moi !']));
          }
        }
        if (s.type === 'reporter' && s.report <= 0 && !s.reportPending && state.totalTime > (s.reportCooldown || 0) && P.lastMischief > state.totalTime - 4 && studentCanNotice(s, 9) && s.affinity < 55 && Math.random() < dt * .15) { s.report = rand(1.8, 3.3); s.reportPending = true; }
        if (s.type === 'clown' && s.dance <= 0 && !isClass() && s.state === 'sport' && Math.random() < dt * .07) s.dance = 1.2;
      }
    }

    function playerIsInClassroom() {
      return !P.lv && P.z < -25.65 && P.z > -38.65 && P.x > 2.65 && P.x < 16.45;
    }
    function teacherLine(text) { speak({ avatar: T.avatar }, text, 3.8); }

    function updateTeacher(dt) {
      updateSpeech({avatar:T.avatar},dt);
      T.suspicion=Math.max(0,T.suspicion-dt*(T.state==='cooldown'?5:1.25));
      T.alert=Math.max(0,T.alert-dt*.2);
      T.cooldown=Math.max(0,T.cooldown-dt);
      T.calloutCooldown=Math.max(0,(T.calloutCooldown||0)-dt);
      const visible=teacherCanSeePlayer();
      const recentMischief=P.lastMischief>state.totalTime-5;
      const insideClass=playerIsInClassroom();

      // La professeure réagit réellement au passage de la porte, sans télépathie.
      if(isClass() && T.wasPlayerInClassroom && !insideClass && T.calloutCooldown<=0 && T.state!=='chase' && T.state!=='warn' && T.state!=='cooldown'){
        T.exitCount=(T.exitCount||0)+1;T.calloutTimer=8.5;T.calloutCooldown=10;
        T.state='callOut';T.target={x:8,z:-11.5};T.navPath=[];T.navGoal=null;
        const running=Math.hypot(P.vx,P.vz)>3.2;
        const lines=running?[
          'Hé ! On ne court pas dans les couloirs ! Tu reviens, s’il te plaît.',
          'Tu vas battre le record du 100 mètres entre deux cours ? Marche !',
          'Doucement ! Ce n’est pas une piste d’athlétisme ici !',
          'Et on marche dans l’établissement, merci !'
        ]:[
          'Eh ! Tu vas où comme ça ? Le cours n’est pas terminé !',
          'La porte n’est pas une invitation à sortir. Tu reviens, merci !',
          'Tu as une autorisation de sortie ? Non ? Alors retour en classe.',
          'Toi, dans le couloir ! Tu as demandé la permission ?',
          'Tu cherches quelque chose ou tu fais une visite guidée ?',
          'On sort de classe avec une autorisation, pas sur un coup de tête !'
        ];
        teacherLine(pick(lines));toast('👩‍🏫 Madame Martin t’a vu sortir de la classe.');
      }
      T.wasPlayerInClassroom=insideClass;

      if(visible && recentMischief){T.suspicion=clamp(T.suspicion+dt*(state.upgrades.sneak?6:10),0,100);T.seenTimer=2.5;}
      else if(visible && isClass() && !insideClass && Math.hypot(P.vx,P.vz)>2.6)T.suspicion=clamp(T.suspicion+dt*2.5,0,100);
      if(T.seenTimer>0)T.seenTimer-=dt;

      if(T.heard&&state.totalTime-T.heard.time<5&&T.state!=='chase'&&T.state!=='warn'&&T.state!=='cooldown'&&T.state!=='callOut'){
        if(dist2(T,T.heard)>1.8){T.state='investigate';T.target={x:T.heard.x,z:T.heard.z};T.navPath=[];T.navGoal=null;}
      }
      if(T.suspicion>65&&visible&&recentMischief&&T.state!=='chase'&&T.state!=='cooldown'&&T.state!=='callOut'){
        T.state='warn';T.target={x:P.x,z:P.z};T.navPath=[];T.navGoal=null;
        teacherLine(pick(['Je t’ai vu ! On va en parler calmement.','Ce n’est pas une bonne idée. Reviens ici, s’il te plaît.','Stop ! On se calme et on explique ce qui se passe.']));
      }

      let moving=false;
      if(T.state==='teach'){
        T.target={x:11.5,z:-36.2};
        moving=moveCharacter(T,dt,1.65,false);
        if(dist2(T,T.target)<.65){T.vx=0;T.vz=0;T.yaw=Math.PI;T.avatar.group.rotation.y=Math.PI;}
      } else if(T.state==='callOut'){
        T.calloutTimer-=dt;
        // Elle se déplace vers la porte de la salle, puis attend au lieu de traverser les murs.
        T.target={x:8,z:-11.5};
        moving=moveCharacter(T,dt,2.15,false);
        if(dist2(T,T.target)<.85){T.vx*=.1;T.vz*=.1;T.avatar.group.rotation.y=Math.atan2(-(P.x-T.x),-(P.z-T.z));}
        if(insideClass){
          T.state='teach';T.target={x:11.5,z:-36.2};T.navPath=[];T.navGoal=null;
          teacherLine(pick(['Merci d’être revenu. On reprend le cours.','Ah, te voilà ! Installe-toi, s’il te plaît.','Voilà qui est mieux. Ouvre ton cahier à la bonne page.']));
          state.adm=clamp(state.adm+1,0,100);
        } else if(T.calloutTimer<=0){
          if(T.exitCount>=3){T.state='warn';T.target={x:P.x,z:P.z};T.navPath=[];T.navGoal=null;teacherLine('C’est la troisième sortie ! Cette fois, on va discuter avec la vie scolaire.');}
          else {T.state='teach';T.target={x:11.5,z:-36.2};T.navPath=[];T.navGoal=null;teacherLine(pick(['Je t’attends à l’intérieur. Ne traîne pas.','Dernier rappel : retourne en classe, merci.','Je garde un œil sur le couloir. À toi de faire le bon choix.']));}
        }
      } else if(T.state==='patrol'){
        if(T.z<-25.5&&Math.abs(T.x)>2.6)T.waypoint={x:T.x<0?-9:9,z:-24.1};
        else if(T.z<-13.8&&Math.abs(T.x)>2.6)T.waypoint={x:0,z:-22};
        else if(T.z<-13.8)T.waypoint={x:0,z:-10.2};
        else if(!T.waypoint||dist2(T,T.waypoint)<1.1||T.waypoint.z<-13.8)T.waypoint=pick([{x:-54,z:-8},{x:54,z:-8},{x:-32,z:26},{x:32,z:28},{x:0,z:48},{x:-24,z:72},{x:24,z:72},{x:0,z:108}]);
        T.target=T.waypoint;moving=moveCharacter(T,dt,1.95,true);
      } else if(T.state==='investigate'){
        moving=moveCharacter(T,dt,2.5,false);
        if(dist2(T,T.target)<1.35){T.state='look';T.lookTime=2.2;if(visible&&recentMischief){T.suspicion=Math.max(T.suspicion,58);teacherLine('Je crois que je viens de comprendre ce qui s’est passé…');}}
      } else if(T.state==='look'){
        T.lookTime-=dt;T.avatar.group.rotation.y+=Math.sin(state.totalTime*1.7)*dt*.45;
        if(visible&&recentMischief){T.suspicion+=dt*15;if(T.suspicion>75){T.state='warn';T.target={x:P.x,z:P.z};T.navPath=[];T.navGoal=null;teacherLine('Je t’ai reconnu. On va en parler.');}}
        if(T.lookTime<=0){T.state=isClass()?'teach':'patrol';T.heard=null;}
      } else if(T.state==='warn'){
        T.target={x:P.x,z:P.z};moving=moveCharacter(T,dt,2.7,false);
        if(dist2(T,P)<2.1)punishPlayer();
        else if(!visible&&!recentMischief&&dist2(T,P)>8){T.state=isClass()?'teach':'investigate';T.navPath=[];T.navGoal=null;}
      } else if(T.state==='chase'){
        if(P.hidden){T.state='investigate';T.target={x:P.x,z:P.z};T.suspicion=42;T.navPath=[];T.navGoal=null;}
        else{T.target={x:P.x,z:P.z};moving=moveCharacter(T,dt,3.5,false);if(dist2(T,P)<2.0)punishPlayer();else if(!visible&&dist2(T,P)>12){T.state='investigate';T.target={x:T.x,z:T.z};T.navPath=[];T.navGoal=null;}}
      } else if(T.state==='cooldown'){
        if(T.cooldown<=0){T.state=isClass()?'teach':'patrol';T.suspicion=0;T.heard=null;T.navPath=[];T.navGoal=null;}
      }
      animateAvatar(T,moving,dt,1);T.avatar.group.position.set(T.x,0,T.z);
    }

    function updatePlayerBase(dt) {
      const forward = (keys.w || keys.z || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
      const side = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.q || keys.arrowleft ? 1 : 0);
      const len = Math.hypot(forward, side);
      let ix = 0, iz = 0;
      if (len > .05) {
        const fX = Math.sin(cameraYaw), fZ = -Math.cos(cameraYaw);
        const rX = Math.cos(cameraYaw), rZ = Math.sin(cameraYaw);
        ix = (fX * forward + rX * side) / Math.max(1, len);
        iz = (fZ * forward + rZ * side) / Math.max(1, len);
      }
      const sprint = keys.shift && P.energy > 1;
      const speed = playerSpeed() * (sprint ? 1.45 : 1);
      P.vx += (ix * speed - P.vx) * Math.min(1, dt * (len ? 9 : 10));
      P.vz += (iz * speed - P.vz) * Math.min(1, dt * (len ? 9 : 10));
      if (len < .05) { P.vx *= Math.pow(.05, dt); P.vz *= Math.pow(.05, dt); }
      if (sprint && len) P.energy = Math.max(0, P.energy - dt * 13); else P.energy = Math.min(100, P.energy + dt * 5);
      let nx=P.x+P.vx*dt,nz=P.z+P.vz*dt;
      if(navOpen(nx,nz)){P.x=nx;P.z=nz;}
      else{
        if(navOpen(nx,P.z))P.x=nx;else P.vx=0;
        if(navOpen(P.x,nz))P.z=nz;else P.vz=0;
      }
      P.x=clamp(P.x,-79,79);P.z=clamp(P.z,-57,136);
      P.moving = Math.hypot(P.vx, P.vz) > .22;
      if (P.moving) {
        P.yaw = Math.atan2(-P.vx, -P.vz);
        playerAvatar.group.rotation.y = P.yaw;
        if (P.hidden) { P.hidden = false; toast('Tu quittes ta cachette.'); }
      }
      if (P.jumpY > 0 || P.jumpV > 0) {
        P.jumpY += P.jumpV * dt; P.jumpV -= 15 * dt;
        if (P.jumpY < 0) { P.jumpY = 0; P.jumpV = 0; }
      }
      playerAvatar.group.position.set(P.x, P.jumpY, P.z);
      animateAvatar(P, P.moving, dt, sprint ? 1.4 : 1);
      /* hauteur gérée par animateAvatar */
      if (isClass() && !P.hidden) {
        const distSeat = dist2(P, { x: 1, z: -16.75 });
        if (distSeat > 10 && teacherCanSeePlayer() && Math.hypot(P.vx, P.vz) > 1.5 && state.totalTime - P.seatWarn > 11) {
          P.seatWarn = state.totalTime; state.adm = clamp(state.adm - 1, 0, 100);
        }
      }
    }

    function updatePhase(dt) {
      state.phaseTime -= dt;
      if (state.phaseTime > 0) return;
      if (state.phaseIndex < PHASES.length - 1) {
        state.phaseIndex++;
        state.phaseTime = PHASES[state.phaseIndex].duration;
        applyPhase();
      } else endDay('normal');
    }

    function applyPhase() {
      const phase = PHASES[state.phaseIndex];
      if (phase.id === 'recess') {
        T.state='patrol';T.target={x:-14,z:8};T.waypoint={x:-14,z:8};T.navPath=[];T.navGoal=null;T.wasPlayerInClassroom=false;
        S.forEach((s,i) => { const side=s.x<0?-8:8; const lane=(i%3-1)*.38; s.state='exit'; s.target={x:side+lane,z:-11.5+(i%3)*.28}; s.think=1.0+(i%6)*.22+rand(0,.22); s.navPath=[];s.navGoal=null;s.navBlocked=0;s.navRetry=0; });
        toast('🔔 DRIIING ! C’est la récré !');
      } else {
        T.state='teach';T.target={x:11.5,z:-36.2};T.x=clamp(T.x,8,14);T.z=clamp(T.z,-38,-33);T.navPath=[];T.navGoal=null;T.wasPlayerInClassroom=playerIsInClassroom();
        S.forEach((s, i) => { s.home = { x: seats[i].x, z: seats[i].z }; s.target = { ...s.home }; s.state = 'study'; s.think = rand(0, .8); });
        toast('🔔 La cloche sonne : retour en classe !');
      }
      updateHud(true); onPhase();
    }

    function endDay(reason) {
      if (state.mode !== 'play') return;
      state.mode = 'shop'; P.hidden = false;
      const fans = state.upgrades.charm ? S.filter(s => s.affinity > 65).length * 2 : 0;
      let bonus = Math.round(state.chaos / 8) + Math.round(state.adm / 18) + fans;
      let title = 'Journée bien remplie !';
      if (reason === 'director') { title = 'Direction : petit entretien 😅'; P.coins = Math.floor(P.coins * .85); bonus = 0; }
      else if (state.adm >= 82) { title = 'Chouchou de Madame Martin 🌟'; bonus += 18; }
      else if (state.chaos >= 55 && state.strikes < 2) { title = 'Légende de la cour 😎'; bonus += 20; }
      else if (state.chaos < 12) { title = 'Élève modèle 😇'; bonus += 12; }
      P.coins += bonus;
      showShop(title, bonus, reason);
      updateHud(true);
    }

    function showShop(title, bonus, reason) {
      const results = `<p>💛 Respect : <b>${Math.round(state.adm)}%</b> · 🎉 Ambiance : <b>${Math.round(state.chaos)}</b><br>⚠️ Avertissements : <b>${state.strikes}/3</b> · 🪙 Bonus : <b>+${bonus}</b><br>Amis rencontrés : <b>${S.filter(s => s.visited).length}</b> · Paniers : <b>${state.hoopShots}</b></p><div class="et3d-shop" data-shop="items"></div>`;
      showPanel(title, reason === 'director' ? 'La prochaine journée sera une nouvelle chance !' : 'Ta journée est terminée. Améliore ton équipement avant la suite.', results, [
        { label: `➡️ Jour ${state.day + 1}`, action: () => { state.day++; startDay(); } },
        { label: '↺ Recommencer', secondary: true, action: () => { state.day = 1; P.coins = 0; P.inventory = []; state.upgrades = {}; state.adm = 50; startDay(); } }
      ], 'BILAN DE LA JOURNÉE');
      const shop = overlay.querySelector('[data-shop="items"]');
      for (const item of UPGRADES) {
        const owned = !!state.upgrades[item.id];
        const card = document.createElement('div'); card.className = 'et3d-shop-item';
        const label = document.createElement('b'); label.textContent = `${item.icon} ${item.name}`;
        const desc = document.createElement('small'); desc.textContent = item.desc;
        const btn = document.createElement('button'); btn.className = 'et3d-btn'; btn.textContent = owned ? '✅ Acheté' : `Acheter · ${item.cost} 🪙`; btn.disabled = owned || P.coins < item.cost;
        btn.addEventListener('click', () => { if (!owned && P.coins >= item.cost) { P.coins -= item.cost; state.upgrades[item.id] = true; toast(`${item.name} acheté !`); showShop(title, bonus, reason); } });
        card.append(label, desc, btn); shop.appendChild(card);
      }
    }

    function startDay() {
      P.lv = 0; P.elev = 0; P.hidden = false;
      state.mode = 'play'; state.phaseIndex = 0; state.phaseTime = PHASES[0].duration;
      state.adm = clamp(state.adm, 25, 100); state.chaos = 0; state.strikes = 0; state.dayCoins = 0; state.hoopShots = 0; state.noiseEvents = []; state.effects = [];
      P.inventory = []; P.selected = 0; P.energy = 100; P.hidden = false; P.lastMischief = -99;
      S.forEach((s,i) => { s.visited=false;s.report=0;s.reportPending=false;s.reportCooldown=0;s.memory=[];s.affinity=clamp(s.affinity,25,100);s.mood=rand(55,95);s.navPath=[];s.navGoal=null;s.navIndex=0;s.navBlocked=0;s.groupId=Math.floor(i/3);s.home={x:seats[i].x,z:seats[i].z};s.x=s.home.x;s.z=s.home.z;s.avatar.group.position.set(s.x,0,s.z);s.vx=s.vz=0; });
      T.state='teach';T.suspicion=0;T.patience=100;T.strikes=0;T.heard=null;T.cooldown=0;T.x=11.5;T.z=-36.2;T.target={x:11.5,z:-36.2};T.yaw=Math.PI;T.wasPlayerInClassroom=true;T.exitCount=0;T.calloutTimer=0;T.calloutCooldown=0;T.navPath=[];T.navGoal=null;
      P.x=11.0;P.z=-30.4;P.vx=P.vz=0;P.navPath=[];P.hidden=false;playerAvatar.group.position.set(P.x,0,P.z);
      world.pickups.forEach(p => { p.done = false; p.group.visible = true; });
      setMission(); updateHotbar(); hidePanel(); applyPhase(); updateHud(true); toast(`Bienvenue au jour ${state.day} !`);
    }

    function showTutorial() {
      const body = `<p><b>Déplacements</b><br>ZQSD / WASD ou flèches. Maintiens Maj pour courir et garde un peu d'énergie pour les moments importants.</p><p><b>Caméra</b><br>Maintiens le clic droit et déplace la souris pour tourner autour du personnage. Utilise la molette pour zoomer.</p><p><b>Interactions</b><br>Approche-toi d'une personne ou d'un objet puis appuie sur E. Les objets ramassés se sélectionnent avec 1–6 et s'utilisent avec Espace.</p><p><b>Vie scolaire</b><br>Explore les salles, discute, participe aux activités, gagne des pièces et surveille les réactions de Madame Martin. Les élèves ont des besoins, des amitiés et des souvenirs qui influencent leurs décisions.</p>`;
      showPanel('Comment jouer ?', 'Quelques repères avant de commencer.', body + '<p><b>En cours</b><br>Suis les <b>objectifs</b> en haut à droite : reste sur <b>ta place</b> (cercle jaune), lève la main avec <b>E</b> quand la prof pose une question, réussis le <b>contrôle surprise</b> (touche <b>C</b> pour copier… risqué !). Quand la prof écrit au tableau ✍️, elle ne te voit pas.</p><p><b>Étage</b><br>Monte par l’escalier au fond du couloir : 8 salles, mini-jeux, 4 indices pour ouvrir le coffre du directeur. Attention à la surveillante !</p>', [
        { label: '▶️ C’est parti !', action: startDay },
        { label: 'Retour', secondary: true, action: openMenu }
      ], 'TUTORIEL');
    }
    function openMenu() {
      state.mode = 'menu';
      const body = `<p>Un établissement entier à explorer : un grand collège avec deux bâtiments pédagogiques, un CDI, des laboratoires, un atelier artistique, un gymnase, un stade extérieur, une cantine et plusieurs cours et espaces de détente.</p><p>Les élèves ont chacun leur caractère, leurs besoins et leurs relations. Ils se déplacent pour de vraies raisons, discutent entre eux et réagissent différemment aux événements.</p><p class="sub">Veux-tu voir le tutoriel avant de commencer ?</p>`;
      showPanel('Bienvenue au collège !', 'Un grand campus à explorer. Tes choix, tes histoires.', body, [
        { label: 'Oui, voir le tutoriel', action: showTutorial },
        { label: 'Non, jouer directement', secondary: true, action: startDay }
      ], 'MIDDLE SCHOOL · CAMPUS 3D');
    }


    // Boucle d'animation et caméra.
    const keys = Object.create(null);
    let lastFrame = performance.now();
    let raf = 0;
    let drag = null;
    let toastWasVisible = false;
    function getInteriorBounds() {
      if(P.x>-16.4&&P.x<16.4&&P.z>-38.5&&P.z<-14.5) return {minX:-16.0,maxX:16.0,minZ:-38.1,maxZ:-14.8,ceiling:3.7};
      if(P.x>-75&&P.x<-33&&P.z>-44&&P.z<0) return {minX:-74.5,maxX:-33.5,minZ:-43.5,maxZ:-.5,ceiling:5.55};
      if(P.x>33&&P.x<75&&P.z>-44&&P.z<0) return {minX:33.5,maxX:74.5,minZ:-43.5,maxZ:-.5,ceiling:5.55};
      if(P.x>-31&&P.x<31&&P.z>51&&P.z<93) return {minX:-31.5,maxX:31.5,minZ:51.5,maxZ:92.5,ceiling:7.45};
      return null;
    }
    function updateCameraBase(dt) {
      const target=V3(P.x,1.2+P.jumpY+(P.elev||0),P.z);
      const interior=getInteriorBounds();
      if(interior){cameraPitch=clamp(cameraPitch,.08,.40);cameraDistance=clamp(cameraDistance,5.5,9.5);}
      const horizontal=Math.cos(cameraPitch)*cameraDistance;
      const desired=V3(P.x-Math.sin(cameraYaw)*horizontal,1.2+P.jumpY+(P.elev||0)+Math.sin(cameraPitch)*cameraDistance,P.z+Math.cos(cameraYaw)*horizontal);
      if(interior){
        desired.x=clamp(desired.x,interior.minX,interior.maxX);
        desired.z=clamp(desired.z,interior.minZ,interior.maxZ);
        desired.y=Math.min(desired.y,interior.ceiling+(P.elev||0));
      }
      // La caméra ne traverse pas les cloisons : on raccourcit le bras orbital si une paroi coupe la vue.
      const cam2={x:desired.x,z:desired.z};
      if(!navLineClear({x:P.x,z:P.z},cam2)){
        for(let k=10;k>=2;k--){
          const t=k/12,probe={x:P.x+(cam2.x-P.x)*t,z:P.z+(cam2.z-P.z)*t};
          if(navLineClear({x:P.x,z:P.z},probe)){desired.x=probe.x;desired.z=probe.z;break;}
        }
      }
      camera.position.lerp(desired,1-Math.pow(.001,dt));
      camera.lookAt(target);
      roofGroup.visible=true;
    }

    function updateWorld(dt) {
      for (const p of world.pickups) {
        if (!p.done) { p.group.rotation.y += dt * 1.1; p.group.position.y = .06 + Math.sin(state.totalTime * 2.4 + p.phase) * .12; }
      }
      for (let i = world.fx.length - 1; i >= 0; i--) {
        const f = world.fx[i]; f.t -= dt;
        if (f.kind === 'thrownBall') {
          f.age += dt; const t = clamp(f.age / .7, 0, 1);
          f.group.position.set(THREE.MathUtils.lerp(f.start.x, f.end.x, t), .55 + Math.sin(t * Math.PI) * 2.1, THREE.MathUtils.lerp(f.start.z, f.end.z, t));
          f.group.rotation.x += dt * 8; f.group.rotation.z += dt * 5;
        } else {
          f.group.children.forEach((p, j) => { p.position.y += dt * (j % 3 + 1) * 1.3; p.rotation.x += dt * 4; p.rotation.z += dt * 3; });
          f.group.scale.setScalar(1 + (1 - f.t / 1.5) * .7);
        }
        if (f.t <= 0) { scene.remove(f.group); f.group.traverse(o => { if (o.isMesh && o.material && o.material !== mats.white && o.material.dispose) o.material.dispose(); }); world.fx.splice(i, 1); }
      }
    }

    /* ===== v2 : ciel, décor, IA vivante, objets et événements ===== */
    const fun = { timers: [], scenes: [], planes: [], traps: [], clouds: [], ev: null, evT: 22, quiz: 16, tLife: 14, sceneT: 6, lastPhase: -1, prevT: 'teach', lastHeard: null, heardSeen: -1, insp: 0, pigeon: null, truck: null };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(170, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x3d8fe0) }, mid: { value: new THREE.Color(0xa6dcf8) }, bot: { value: new THREE.Color(0xf6efd6) } },
      vertexShader: 'varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform vec3 top,mid,bot;varying vec3 p;void main(){float h=p.y;vec3 c=h>0.?mix(mid,top,pow(h,.6)):mix(mid,bot,min(1.,-h*3.));gl_FragColor=vec4(c,1.);}' }));
    sky.renderOrder = -10; scene.add(sky);
    for (let i = 0; i < 16; i++) {
      const c = new THREE.Group(), cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, fog: false });
      for (let j = 0; j < 5; j++) { const b = new THREE.Mesh(new THREE.SphereGeometry(rand(3, 6), 10, 8), cm); b.position.set(j * 4 - 8 + rand(-1, 1), rand(-.6, 1.2), rand(-2, 2)); b.scale.y = .55; c.add(b); }
      c.position.set(rand(-160, 160), rand(52, 78), rand(-140, 160)); c.userData.v = rand(.6, 1.8); scene.add(c); fun.clouds.push(c);
    }
    const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(.13, 6, 5), new THREE.MeshStandardMaterial({ roughness: .6 }), 480);
    { const cols = [0xff6b8b, 0xffd447, 0xffffff, 0xb28cff, 0xff9a3c], m4 = new THREE.Matrix4();
      for (let i = 0; i < 480; i++) { let x, z; do { x = rand(-78, 78); z = rand(-6, 132); } while (Math.abs(x) < 9 && z < 60); m4.makeTranslation(x, .1, z); flowers.setMatrixAt(i, m4); flowers.setColorAt(i, new THREE.Color(pick(cols))); }
      flowers.instanceColor.needsUpdate = true; scene.add(flowers); }
    function ambient(dt) { sky.position.copy(camera.position); fun.clouds.forEach(c => { c.position.x += dt * c.userData.v; if (c.position.x > 170) c.position.x = -170; }); }

    const say = (p, m, d = 2.8) => { if (p && p.avatar) speak(p, m, d); };
    const later = (t, fn) => fun.timers.push({ t, fn });
    function fresh(s, arr) { s.said = s.said || []; const o = arr.filter(l => !s.said.includes(l)); const l = pick(o.length ? o : arr); s.said.push(l); if (s.said.length > 8) s.said.shift(); return l; }
    const OPEN = { clown: ['MDR', 'Haha', 'Trop drôle', 'Mort de rire'], rebel: ['Yesss', 'Ouais', 'Stylé', 'Respect'], sage: ['Euh', 'Oh non', 'Hum', 'Franchement'], reporter: ['Intéressant', 'Noté', 'Hmm', 'Aha'], athlete: ['Allez', 'Boom', 'Waouh', 'Énorme'], social: ['Oh mon dieu', 'Trop bien', 'Attends', 'Non mais'], curious: ['Oh', 'Tiens', 'Waouh', 'Wow'], shy: ['Oh…', 'Euh…', 'Ah…', 'Hein ?'] };
    const KIND = {
      musique: ['c’est quoi cette zik ?', 'on danse ?', 'le DJ est là !', 'monte le son'], slime: ['ça colle !', 'c’est dégoûtant', 'ça gicle partout', 'je veux toucher'],
      confettis: ['il y en a partout', 'c’est la fête', 'ça brille !', 'on fête quoi ?'], dessin: ['quel artiste', 'la prof va hurler', 'il a du talent', 'au tableau en plus'],
      ballon: ['belle passe', 'attention aux vitres', 'à moi !', 'bien visé'], waterballoon: ['ça mouille !', 'revanche !', 'il est glacé', 'splash'],
      avion: ['ça plane', 'direction la prof ?', 'beau vol', 'atterrissage parfait'], banane: ['la glissade', 'quelle chute', 'classique mais efficace', 'ça glisse'],
      pet: ['quel bruit', 'c’était qui ?', 'ça sent le drame', 'incroyable'], megaphone: ['mes oreilles', 'c’est la sonnerie ?', 'un peu fort', 'quelle voix'], bulles: ['c’est joli', 'ça flotte', 'on dirait de la magie', 'trop mignon'] };
    const TAIL = ['', '', '', ' !', ' …', ' 😄'];
    const mk = (s, k) => `${pick(OPEN[s.type] || OPEN.curious)}, ${pick(KIND[k] || ['c’est quoi ça ?'])}${pick(TAIL)}`;
    const genLine = (s, k) => fresh(s, [mk(s, k), mk(s, k), mk(s, k), mk(s, k)]);
    function initStudent(s) { s.tr = { mischief: (s.type === 'rebel' || s.type === 'clown' ? .5 : 0) + Math.random() * .5, bravery: Math.random(), gossip: Math.random() }; s.seen = {}; s.said = []; s.microT = rand(3, 12); s.sleep = 0; s.inScene = false; }
    function gossip(s, ev) {
      const fr = S.filter(o => o !== s && (s.relationships[o.i] || 0) > 8 && dist2(o, s) < 40).slice(0, 2);
      later(rand(3, 6), () => fr.forEach(f => { say(s, `Tu sais ce qui s’est passé ?`); later(1.3, () => { say(f, fresh(f, ['Sérieux ?!', 'Pas possible !', 'Raconte tout !', 'Je le savais !'])); f.mood = clamp(f.mood + 3, 0, 100); }); }));
    }
    function funReact(s, ev, d) {
      if (!s.tr) return false;
      const k = ev.kind, t = s.type, n = (s.seen[k] = (s.seen[k] || 0) + 1), tNear = dist2(T, s) < 11 && ['teach', 'patrol', 'look'].includes(T.state);
      if (n > 3 && Math.random() < .65) { say(s, fresh(s, ['Encore ?!', 'On a compris…', 'Change de blague', 'Wow, original…', 'Tu radotes un peu'])); return true; }
      if (tNear && ev.mischief && t !== 'rebel' && s.tr.bravery < .7) { say(s, fresh(s, ['Chut ! Elle regarde !', 'Madame arrive !', 'Cachez-vous !', 'Oups…', 'On fait genre de rien'])); return true; }
      if (t === 'reporter' && ev.mischief && s.affinity < 62 && d < 8) return false;
      if (s.affinity < 30 && Math.random() < .5) { say(s, fresh(s, ['Tu m’énerves, toi.', 'Arrête un peu…', 'Franchement, non.'])); s.mood = clamp(s.mood - 3, 0, 100); return true; }
      say(s, genLine(s, k));
      if (t === 'clown' || t === 'rebel' || t === 'athlete') s.dance = 2.4;
      if (t === 'rebel' && s.tr.mischief > .55 && !tNear) later(rand(2, 5), () => { const v = pick(S.filter(o => o !== s && dist2(o, s) < 10).concat([null])); if (v) { say(s, 'À mon tour ! 😈'); throwPlane(s, v); } });
      if (t === 'clown') later(rand(3, 6), () => { const f = S.find(o => o !== s && dist2(o, s) < 14); if (f) { say(s, 'Hé ' + f.name + ', t’as vu ça ?!'); say(f, fresh(f, ['Haha oui !', 'Trop fort', 'J’y étais !'])); } });
      if (t === 'social' || (s.tr.gossip > .7 && t !== 'shy')) gossip(s, ev);
      if (t === 'curious' && !isClass()) s.target = { x: ev.x + rand(-2, 2), z: ev.z + rand(-2, 2) };
      s.mood = clamp(s.mood + (ev.mischief ? 3 : 5), 0, 100);
      if (ev.mischief && t !== 'sage') s.affinity = clamp(s.affinity + 2, 0, 100);
      return true;
    }
    /* --- avions, pièges, objets --- */
    function throwPlane(from, to) {
      const g = new THREE.Group(), m = new THREE.Mesh(new THREE.ConeGeometry(.14, .55, 3), mat(0xffffff, .6)); m.rotation.x = Math.PI / 2; g.add(m);
      const a = { x: from.x, z: from.z }, b = to ? { x: to.x, z: to.z } : { x: from.x + Math.sin(from.yaw || 0) * 8, z: from.z - Math.cos(from.yaw || 0) * 8 };
      g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); scene.add(g);
      fun.planes.push({ g, a, b, to, from, t: 0, dur: clamp(dist2(a, b) / 6, .8, 2.2) });
    }
    function planeHit(p) {
      const to = p.to; if (!to) return;
      if (to === T) {
        const kind = T.patience > 55;
        teacherLine(kind ? pick(['Joli avion ! Mais on plie ça après le cours.', 'Très aérodynamique… Qui est l’ingénieur ?']) : pick(['QUI a lancé ça ?!', 'Un avion en papier ?! En plein cours ?!']));
        if (!kind) { T.state = 'investigate'; T.target = { x: p.from.x, z: p.from.z }; T.navPath = []; T.navGoal = null; }
        T.patience = clamp(T.patience - (kind ? 1 : 5), 0, 100);
        S.filter(s => dist2(s, T) < 12 && s !== p.from).forEach(s => { s.dance = 1; if (s.type !== 'sage') say(s, '😂'); });
      } else { say(to, fresh(to, ['Aïe, mon front !', 'Hé ! Qui a lancé ça ?', 'Atterrissage réussi 😅', 'Je le garde !'])); to.mood = clamp(to.mood - 2, 0, 100); }
    }
    function addTrap(kind, x, z) {
      const g = new THREE.Group();
      if (kind === 'banane') { const b = new THREE.Mesh(new THREE.TorusGeometry(.3, .08, 6, 12, Math.PI), mat(0xffe14d, .5)); b.rotation.x = -Math.PI / 2; b.position.y = .09; g.add(b); }
      else { const c = new THREE.Mesh(new THREE.SphereGeometry(.4, 12, 8), mat(0xff8fb6, .6)); c.scale.y = .3; c.position.y = .12; g.add(c); }
      g.position.set(x, 0, z); scene.add(g); fun.traps.push({ kind, x, z, g, arm: 1.3 });
    }
    function slip(v) {
      v.slipT = 1.5;
      if (v === T) { T.state = 'cooldown'; T.cooldown = 3.5; T.patience = clamp(T.patience - 8, 0, 100); teacherLine(pick(['Aïe ! Qui a laissé ça là ?!', 'Ma cheville !', 'Quelqu’un va m’expliquer ça…'])); S.forEach(s => { if (dist2(s, T) < 14) { s.dance = 1.2; say(s, s.type === 'sage' ? '😳' : '🤣'); } }); }
      else if (v === P) { P.vx = P.vz = 0; say(P, 'Aïe, mon propre piège ! 🤦'); }
      else { say(v, fresh(v, ['Aaaah !', 'Qui a mis ça là ?!', 'Ouille mon dos !'])); S.filter(o => o !== v && dist2(o, v) < 10).forEach(o => say(o, '🤣')); }
    }
    function useFunItem(id, target) {
      const near = target && target.distance < 9 ? target.person : null;
      if (id === 'avion') { const tp = near || (dist2(P, T) < 13 ? T : null); throwPlane(P, tp); recordEvent('avion', P.x, P.z, 7, true); toast('✈️ Décollage !'); return true; }
      if (id === 'banane') { addTrap('banane', P.x + Math.sin(P.yaw) * 1.4, P.z - Math.cos(P.yaw) * 1.4); toast('🍌 Piège posé… attention de ne pas marcher dessus !'); P.lastMischief = state.totalTime; return true; }
      if (id === 'coussin') { addTrap('coussin', P.x, P.z + 1.2); toast('💨 Coussin posé. Patience…'); return true; }
      if (id === 'megaphone') {
        say(P, '📣 DRIIIING !! Récré !', 2.5); recordEvent('megaphone', P.x, P.z, 24, true); toast('📣 Fausse sonnerie !');
        S.forEach(s => { if (!s.tr) return; if (s.type === 'sage') say(s, 'Ce n’est pas la sonnerie…'); else if (s.type === 'rebel' || s.type === 'clown') { s.dance = 2; say(s, 'Récré !! 🎉'); } });
        later(1.5, () => { if (dist2(T, P) < 40) teacherLine(pick(['Déjà la sonnerie ?… Non, il reste du temps.', 'Qui crie comme ça ?!'])); }); return true; }
      if (id === 'lunettes') { P.disguise = 25; say(P, '🥸 Mode espion activé !', 3); toast('🥸 Déguisement : la prof te reconnaît moins bien (25 s)'); S.filter(s => dist2(s, P) < 9).forEach(s => { s.dance = 1; say(s, fresh(s, ['C’est qui lui ?', 'Cette moustache !', 'Agent secret ?'])); }); return true; }
      if (id === 'excuse') { if (state.strikes > 0) { state.strikes--; T.strikes = state.strikes; toast('📄 Un avertissement annulé !'); } else { T.suspicion = 0; P.disguise = Math.max(P.disguise || 0, 12); toast('📄 La prof te fait confiance un moment.'); } state.adm = clamp(state.adm + 2, 0, 100); updateHud(true); return true; }
      if (id === 'bulles') {
        spawnFx('confetti', P.x, P.z, 0x9fe3ff); recordEvent('bulles', P.x, P.z, 9, false); state.adm = clamp(state.adm + 2, 0, 100);
        S.filter(s => dist2(s, P) < 12).forEach(s => { s.dance = 2; s.mood = clamp(s.mood + 8, 0, 100); });
        if (dist2(T, P) < 14) { T.patience = clamp(T.patience + 10, 0, 100); T.suspicion = Math.max(0, T.suspicion - 20); teacherLine('Oh, des bulles ! Quelle idée charmante…'); }
        toast('🫧 Bulles ! Tout le monde est de bonne humeur.'); return true; }
      return false;
    }
    /* --- vie en classe --- */
    const JOKES = ['Pourquoi les maths sont tristes ? Trop de problèmes !', 'Que dit un crayon à un autre ? On se taille ?', 'Un tableau, ça se range ? Non, ça s’efface !', 'La cloche ? Elle fait toujours DRING.'];
    function microAct(s) {
      const pool = { sage: ['hand', 'doodle', 'read'], clown: ['joke', 'plane', 'whisper', 'yawn'], rebel: ['plane', 'whisper', 'sleep', 'yawn'], reporter: ['note', 'whisper'], athlete: ['stretch', 'yawn', 'sleep'], social: ['whisper', 'note', 'joke'], curious: ['hand', 'doodle', 'look'], shy: ['doodle', 'look', 'read'] }[s.type] || ['yawn'];
      const a = pick(pool), nb = S.filter(o => o !== s && dist2(o, s) < 4.5)[0], seen = dist2(T, s) < 12 && T.state === 'teach';
      if (a === 'doodle') say(s, fresh(s, ['✏️ *dessine un chat*', '✏️ *gribouille*', '✏️ Un petit dragon…']));
      else if (a === 'read') say(s, '📖 …');
      else if (a === 'yawn') say(s, '🥱');
      else if (a === 'stretch') say(s, '🙆 Aaah…');
      else if (a === 'look') say(s, '👀 *regarde par la fenêtre*');
      else if (a === 'sleep') { s.sleep = 7; say(s, '😴 Zzz…', 3); }
      else if (a === 'whisper' && nb) { say(s, 'Psst ' + nb.name + '…'); later(1.2, () => say(nb, fresh(nb, ['Chut, elle regarde !', 'Haha ok', 'Plus tard !']))); if (seen && Math.random() < .35) later(2, () => teacherLine(`${s.name}, un souci avec ton voisin ?`)); }
      else if (a === 'note' && nb) { say(s, '📝 Un mot pour ' + nb.name); later(1.6, () => say(nb, '😂')); }
      else if (a === 'plane') throwPlane(s, pick(S.filter(o => o !== s && dist2(o, s) < 9).concat(Math.random() < .12 ? [T] : [])));
      else if (a === 'joke') { say(s, pick(JOKES), 3.4); S.filter(o => o !== s && dist2(o, s) < 7 && o.type !== 'sage').forEach(o => later(rand(1, 2), () => say(o, '😂'))); }
      else if (a === 'hand') { say(s, '✋ Madame, madame !'); if (T.state === 'teach') later(1.4, () => { teacherLine(`Oui ${s.name} ?`); later(1.2, () => say(s, fresh(s, ['C’est quelle page ?', 'Je peux aller à la bibliothèque ?', 'J’ai une idée !']))); }); }
    }
    const QS = [['Qui sait combien font 7 × 8 ?', '56', '70 ?'], ['Quelle est la capitale de l’Italie ?', 'Rome', 'Pizza ?'], ['Quel est le pluriel de « cheval » ?', 'Chevaux', 'Chevals ?'], ['Combien de côtés a un hexagone ?', 'Six', 'Huit ?'], ['Qui a découvert l’Amérique ?', 'Colomb', 'Mon grand-père ?']];
    function askQuizOld() {
      const q = pick(QS); teacherLine(q[0]);
      const hands = S.filter(s => s.type === 'sage' || s.type === 'curious' || (s.type === 'clown' && Math.random() < .6) || Math.random() < .1);
      later(1.4, () => hands.forEach(s => say(s, '✋ Moi madame !', 2.2)));
      later(3.4, () => { const a = pick(hands.length ? hands : S), silly = a.type === 'clown' && Math.random() < .7; teacherLine('Oui ' + a.name + ' ?');
        later(1.4, () => { say(a, silly ? q[2] : q[1]); later(1.4, () => { if (silly) { teacherLine(pick([a.name + '… sérieusement ?', 'Hum. Non. Quelqu’un d’autre ?'])); S.filter(o => o !== a && dist2(o, a) < 9 && o.type !== 'sage').forEach(o => say(o, '😂')); T.patience = clamp(T.patience - 1, 0, 100); } else teacherLine(pick(['Exactement !', 'Bravo ' + a.name + ' !', 'Très bien, c’est ça.'])); }); }); });
    }
    const HEAR = { musique: ['D’où vient cette musique ?', 'On n’est pas en boîte de nuit !'], avion: ['Qui lance des avions en papier ?'], megaphone: ['Qui crie comme ça ?!', 'Mes tympans…'], pet: ['Pardon ?! Un peu de tenue !', 'Qui a fait ce bruit ?'], slime: ['Ça sent le slime ici…'], dessin: ['Qui gribouille au tableau ?!'], confettis: ['Des confettis ?! Qui va nettoyer ?'], banane: ['Qui a laissé traîner ça ?!'] };
    function teacherLife() {
      if (T.patience < 45 || state.chaos > 70) { teacherLine(pick(['Quelle journée…', 'Il me faut un café, vite.', 'Je vais prendre de l’aspirine.'])); return; }
      const near = S.filter(s => dist2(s, T) < 10 && s.affinity > 45)[0], r = Math.random();
      if (!isClass() && near && r < .5) { teacherLine(`Alors ${near.name}, ça va ?`); later(1.6, () => say(near, fresh(near, ['Oui madame, merci !', 'On joue au foot !', 'Un peu fatigué…', 'Y a un contrôle ?']))); }
      else if (r < .75) { teacherLine('🤧 Atchoum !'); S.filter(s => dist2(s, T) < 9).forEach(s => later(rand(.6, 1.4), () => say(s, 'À vos souhaits !'))); }
      else teacherLine(isClass() ? pick(['Ouvrez vos cahiers.', 'Quelqu’un a un stylo en plus ?', 'Silence, on avance.']) : pick(['☕ Une petite pause…', '🎵 Hmm hmm hmm…', 'Ah, le beau temps !']));
    }
    function interrogate() {
      const w = S.filter(s => dist2(s, T) < 9).sort((a, b) => dist2(a, T) - dist2(b, T))[0]; if (!w) return;
      teacherLine(`Dis-moi ${w.name}, tu as vu quelque chose ?`);
      later(1.5, () => { const saw = w.memory.some(m => m.mischief && m.player && state.totalTime - m.time < 12);
        if (!saw) say(w, fresh(w, ['Non madame, rien du tout.', 'Je regardais ailleurs…', 'Je n’ai rien vu.']));
        else if (w.affinity > 58 || w.type === 'rebel' || w.type === 'clown') { say(w, fresh(w, ['Euh… personne, madame !', 'Un courant d’air, sûrement !', 'Je crois que c’était un fantôme !'])); T.suspicion = Math.max(0, T.suspicion - 12); toast(`${w.name} te couvre 🛡️`); }
        else coverOrReport(w); });
    }
    /* --- scènes sociales en récré --- */
    function startScene() {
      if (fun.scenes.length >= 3) return;
      const free = S.filter(s => !s.inScene && s.state !== 'exit' && s.z > -12); if (free.length < 2) return;
      const a = pick(free), b = free.filter(o => o !== a).sort((x, y) => dist2(x, a) - dist2(y, a))[0], kind = pick(['rps', 'selfie', 'cards', 'argue', 'tag', 'rps', 'cards']);
      a.inScene = b.inScene = true; fun.scenes.push({ kind, a, b, t: 0, ph: 0, life: 0 });
    }
    function endScene(sc) { sc.a.inScene = sc.b.inScene = false; sc.a.think = sc.b.think = .2; fun.scenes.splice(fun.scenes.indexOf(sc), 1); }
    function updScenes(dt) {
      for (const sc of fun.scenes.slice()) {
        const { a, b, kind } = sc; sc.t += dt; sc.life += dt; a.think = b.think = 5;
        if (sc.life > 16 || isClass()) { endScene(sc); continue; }
        if (kind === 'tag' && sc.ph === 1) { a.target = { x: b.x, z: b.z }; const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; b.target = { x: clamp(b.x + dx / l * 6, -70, 70), z: clamp(b.z + dz / l * 6, 6, 120) };
          if (dist2(a, b) < 1.3) { say(a, 'Chat ! 🐱'); say(b, 'Pas juste !'); sc.t += 5; } if (sc.t > 7) endScene(sc); continue; }
        if (sc.ph === 0) { a.target = { x: b.x + 1.2, z: b.z }; b.target = { x: b.x, z: b.z };
          if (dist2(a, b) < 2.2) { sc.ph = 1; sc.t = 0;
            if (kind === 'rps') { say(a, '✊✋✌️ Shifumi !'); say(b, 'Prêt·e !'); }
            else if (kind === 'selfie') { say(a, '📸 Selfie !'); say(b, 'Attends, ma bonne tête !'); }
            else if (kind === 'cards') { say(a, '🃏 Je t’échange ma carte rare ?'); say(b, fresh(b, ['Laquelle ?', 'Hmm, montre !', 'Pas question !'])); }
            else if (kind === 'argue') { say(a, 'T’as triché !'); say(b, 'N’importe quoi !'); }
            else sc.ph = 1; } continue; }
        if (kind === 'rps' && sc.t > 2.2) { const w = Math.random() < .5 ? a : b, l = w === a ? b : a; say(w, 'J’ai gagné ! 🏆'); say(l, fresh(l, ['Revanche !', 'Tu as triché !', 'Pff…'])); w.mood = clamp(w.mood + 5, 0, 100); endScene(sc); }
        else if (kind === 'selfie' && sc.t > 2.2) { [a, b].forEach(o => { o.mood = clamp(o.mood + 6, 0, 100); o.dance = 1; }); a.relationships[b.i] = (a.relationships[b.i] || 0) + 6; b.relationships[a.i] = (b.relationships[a.i] || 0) + 6; endScene(sc); }
        else if (kind === 'cards' && sc.t > 3) { say(a, fresh(a, ['Marché conclu !', 'Trop nul, laisse tomber.'])); a.relationships[b.i] = (a.relationships[b.i] || 0) + 3; endScene(sc); }
        else if (kind === 'argue' && sc.t > 2.5) { if (dist2(T, a) < 22 && T.state === 'patrol') { T.state = 'investigate'; T.target = { x: a.x, z: a.z }; T.navPath = []; T.navGoal = null; teacherLine('Que se passe-t-il ici, vous deux ?'); later(3.5, () => { say(a, 'Pardon…'); say(b, 'Pardon aussi.'); }); } else { say(b, fresh(b, ['Bon, ça va, désolé.', 'On fait la paix ?'])); } a.relationships[b.i] = (a.relationships[b.i] || 0) - 4; endScene(sc); }
      }
    }
    /* --- événements aléatoires --- */
    function pigeonMesh(x, z) { const g = new THREE.Group(), b = new THREE.Mesh(new THREE.SphereGeometry(.28, 10, 8), mat(0x9aa0aa)); b.scale.set(1, .8, 1.3); b.position.y = .35; const h = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), mat(0x6f7480)); h.position.set(0, .6, .3); const k = new THREE.Mesh(new THREE.ConeGeometry(.05, .14, 6), mat(0xf2b134)); k.rotation.x = Math.PI / 2; k.position.set(0, .58, .48); g.add(b, h, k); g.position.set(x, 0, z); scene.add(g); return g; }
    function truckMesh(x, z) { const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 3.4), mat(0xffffff)); body.position.y = 1.1; const st = new THREE.Mesh(new THREE.BoxGeometry(2.05, .4, 3.45), mat(0xff7aa8)); st.position.y = 1.3; const rf = new THREE.Mesh(new THREE.ConeGeometry(.9, .7, 16), mat(0xffd36a)); rf.position.y = 2.25; g.add(body, st, rf); for (const sx of [-1, 1]) for (const sz of [-1.1, 1.1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .3, 12), mat(0x222222)); w.rotation.z = Math.PI / 2; w.position.set(sx, .35, sz); g.add(w); } g.traverse(o => { o.castShadow = true; }); g.position.set(x, 0, z); scene.add(g); return g; }
    function startEvent() {
      const e = isClass() ? pick(['birthday', 'inspector']) : pick(['pigeon', 'icecream', 'photo']); fun.ev = { k: e, t: 0 };
      if (e === 'pigeon') { fun.pigeon = { g: pigeonMesh(rand(-20, 20), rand(25, 45)), t: 14, tz: 0 }; toast('🐦 Un pigeon est entré dans la cour !'); S.forEach(s => { if (s.type !== 'sage' && s.type !== 'shy') say(s, '🐦 Attrape-le !'); }); }
      else if (e === 'icecream') { fun.truck = truckMesh(-66, 24); toast('🍦 Le camion de glaces est arrivé près de la clôture !'); S.forEach(s => { if (Math.random() < .6) { s.state = 'explore'; s.target = { x: -62 + rand(-1.5, 1.5), z: 24 + rand(-2, 2) }; s.think = 10; say(s, '🍦 Moi je veux vanille !'); } }); }
      else if (e === 'photo') { toast('📸 Photo de groupe devant la fontaine !'); S.forEach(s => { s.state = 'social'; s.target = { x: (s.i % 6 - 2.5) * 1.7, z: 42 + (s.i / 6 | 0) * 1.6 }; s.think = 9; }); }
      else if (e === 'birthday') { const b = pick(S); toast(`🎂 C’est l’anniversaire de ${b.name} !`); b.dance = 4; S.forEach(s => later(rand(.5, 2), () => say(s, fresh(s, ['🎵 Joyeux anniversaire…', '🎵 Happy birthday !', '🎂 Bon anniv !'])))); later(3, () => teacherLine(`Joyeux anniversaire ${b.name} ! On reprend le cours.`)); S.forEach(s => { s.mood = clamp(s.mood + 6, 0, 100); }); }
      else { fun.insp = 22; fun.inspStart = state.totalTime; toast('🕴️ Un inspecteur entre dans la classe : silence !'); teacherLine('Silence, Monsieur l’inspecteur nous rend visite.'); S.forEach(s => { if (Math.random() < .5) say(s, '…', 2); }); }
    }
    function endInspector() { if (P.lastMischief > fun.inspStart) { state.adm = clamp(state.adm - 10, 0, 100); toast('🕴️ L’inspecteur a vu du désordre…'); teacherLine('Je suis très déçue de cette classe.'); } else { state.adm = clamp(state.adm + 6, 0, 100); addCoins(8, 'Classe exemplaire'); teacherLine('Bravo, vous avez été parfaits !'); } fun.ev = null; }
    function resetFun() { fun.scenes.forEach(sc => sc.a.inScene = sc.b.inScene = false); fun.scenes.length = 0; if (fun.pigeon) { scene.remove(fun.pigeon.g); fun.pigeon = null; } if (fun.truck) { scene.remove(fun.truck); fun.truck = null; } fun.ev = null; fun.insp = 0; fun.evT = rand(16, 28); fun.sceneT = 5; }
    function updEvent(dt) {
      const e = fun.ev; if (!e) return; e.t += dt;
      if (e.k === 'pigeon') { const p = fun.pigeon; p.t -= dt; p.tz -= dt;
        if (p.tz <= 0) { p.tz = rand(.8, 1.6); p.tx = clamp(p.g.position.x + rand(-5, 5), -50, 50); p.tzz = clamp(p.g.position.z + rand(-5, 5), 8, 100); }
        const away = dist2(p.g.position, P) < 4 ? Math.atan2(p.g.position.x - P.x, p.g.position.z - P.z) : null; if (away !== null) { p.tx = p.g.position.x + Math.sin(away) * 6; p.tzz = p.g.position.z + Math.cos(away) * 6; }
        const dx = p.tx - p.g.position.x, dz = p.tzz - p.g.position.z, l = Math.hypot(dx, dz); if (l > .1) { const sp = (away !== null ? 6 : 2) * dt; p.g.position.x += dx / l * sp; p.g.position.z += dz / l * sp; p.g.rotation.y = Math.atan2(dx, dz); p.g.position.y = Math.abs(Math.sin(state.totalTime * 12)) * .12; }
        S.forEach(s => { if (!s.inScene && s.type !== 'sage' && s.type !== 'shy' && dist2(s, p.g.position) < 16) { s.state = 'explore'; s.target = { x: p.g.position.x, z: p.g.position.z }; s.think = 1; } });
        if (dist2(P, p.g.position) < 1.1) { addCoins(4, 'Chasseur de pigeons'); toast('🐦 Pigeon attrapé… il s’envole !'); p.t = 0; }
        if (p.t <= 0) { scene.remove(p.g); fun.pigeon = null; fun.ev = null; } }
      else if (e.k === 'icecream') { if (fun.truck && dist2(P, { x: -64, z: 24 }) < 5 && !e.bought && P.coins >= 2) { e.bought = true; P.coins -= 2; state.adm = clamp(state.adm + 3, 0, 100); P.energy = clamp(P.energy + 25, 0, 100); toast('🍦 Glace ! +énergie, +3 ❤'); } if (e.t > 18) { scene.remove(fun.truck); fun.truck = null; fun.ev = null; S.forEach(s => { s.think = .3; }); } }
      else if (e.k === 'photo' && e.t > 8 && !e.flash) { e.flash = 1; spawnFx('confetti', 0, 42, 0xffffff); S.forEach(s => say(s, s.type === 'rebel' ? '🐰 Cheese !' : '📸 Cheese !', 2.2)); if (dist2(P, { x: 0, z: 42 }) < 9) { state.adm = clamp(state.adm + 3, 0, 100); addCoins(3, 'Photo souvenir'); toast('📸 Tu es sur la photo ! +3 ❤'); } }
      else if (e.t > e.t0 || (e.k === 'photo' && e.t > 10) || (e.k === 'birthday' && e.t > 6)) fun.ev = null;
    }
    function updateFun(dt) {
      if (P.disguise > 0) P.disguise -= dt;
      for (let i = fun.timers.length - 1; i >= 0; i--) { const t = fun.timers[i]; t.t -= dt; if (t.t <= 0) { fun.timers.splice(i, 1); try { t.fn(); } catch (e) { } } }
      for (const s of S) if (!s.tr) initStudent(s);
      if (fun.lastPhase !== state.phaseIndex) { fun.lastPhase = state.phaseIndex; resetFun(); }
      for (let i = fun.planes.length - 1; i >= 0; i--) { const p = fun.planes[i]; p.t += dt / p.dur; const k = clamp(p.t, 0, 1); p.g.position.set(p.a.x + (p.b.x - p.a.x) * k, 1.6 + Math.sin(k * Math.PI) * .6 - k * .9, p.a.z + (p.b.z - p.a.z) * k); if (p.t >= 1) { planeHit(p); scene.remove(p.g); fun.planes.splice(i, 1); } }
      for (let i = fun.traps.length - 1; i >= 0; i--) { const tr = fun.traps[i]; tr.arm -= dt; if (tr.arm > 0) continue;
        const v = [...S, T, P].find(o => dist2(o, tr) < .95 && Math.hypot(o.vx || 0, o.vz || 0) > .3 && !(o.slipT > 0));
        if (v) { if (tr.kind === 'banane') { slip(v); if (v !== P) addCoins(3, 'Glissade légendaire'); recordEvent('banane', tr.x, tr.z, 14, true); } else { recordEvent('pet', tr.x, tr.z, 12, true); say(v, v === T ? 'Pardon ?! 😳' : 'C’est pas moi !! 😳'); S.filter(o => dist2(o, tr) < 12 && o !== v).forEach(o => say(o, '🤣')); } scene.remove(tr.g); fun.traps.splice(i, 1); } }
      for (const o of [...S, T, P]) if (o.slipT > 0) { o.slipT -= dt; o.avatar.group.rotation.x = -Math.sin(Math.min(1, (1.5 - o.slipT) * 3) * Math.PI / 2) * 1.2 * (o.slipT > .4 ? 1 : o.slipT / .4); if (o.slipT <= 0) o.avatar.group.rotation.x = 0; }
      if (T.heard && T.heard.time > fun.heardSeen && !(T.avatar.speechT > 0)) { fun.heardSeen = T.heard.time; const l = HEAR[T.heard.kind]; if (l) teacherLine(pick(l)); }
      if (T.state === 'investigate' || T.state === 'look') fun.lastHeard = T.heard || fun.lastHeard;
      if (fun.prevT === 'look' && T.state !== 'look' && T.state !== 'warn' && fun.lastHeard) { fun.lastHeard = null; interrogate(); }
      fun.prevT = T.state;
      fun.tLife -= dt; if (fun.tLife <= 0 && (T.state === 'patrol' || T.state === 'teach')) { fun.tLife = rand(14, 26); teacherLife(); }
      fun.evT -= dt; if (fun.evT <= 0 && !fun.ev && !(fun.insp > 0)) { fun.evT = rand(38, 65); startEvent(); }
      if (fun.ev && fun.ev.k !== 'inspector') { fun.ev.t0 = fun.ev.t0 || 99; updEvent(dt); }
      if (isClass()) {
        if (fun.insp > 0) { fun.insp -= dt; if (fun.insp <= 0) endInspector(); }
        else for (const s of S) { s.microT -= dt; if (s.microT <= 0 && dist2(s, s.home) < .8) { s.microT = rand(6, 15); microAct(s); } }
        for (const s of S) if (s.sleep > 0) { s.sleep -= dt; s.avatar.group.rotation.x = .3; if (dist2(T, s) < 4 || s.sleep <= 0) { if (s.sleep > 0) { teacherLine(`${s.name}, tu dors ?`); say(s, 'Non madame, je réfléchissais !'); } s.sleep = 0; s.avatar.group.rotation.x = 0; } }
        fun.quiz -= dt; if (fun.quiz <= 0 && T.state === 'teach' && !(fun.insp > 0)) { fun.quiz = rand(24, 40); askQuiz(); }
      } else { fun.sceneT -= dt; if (fun.sceneT <= 0) { fun.sceneT = rand(5, 9); startScene(); } updScenes(dt); }
    }

    /* ===== v3 : gestes, cours interactifs, étage ===== */
    const MYSEAT = { x: seats[17].x, z: seats[17].z };
    P.lv = 0; P.elev = 0;
    { const ring = new THREE.Mesh(new THREE.RingGeometry(.55, .78, 32), new THREE.MeshBasicMaterial({ color: 0xffd447, side: THREE.DoubleSide, transparent: true, opacity: .85, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(MYSEAT.x, .05, MYSEAT.z); scene.add(ring); fun.ring = ring;
      const lab = makeTextSprite('TA PLACE', { fontSize: 30, height: 56, scale: .0062, bg: 'rgba(240,170,20,.95)' }); lab.position.set(MYSEAT.x, 2.6, MYSEAT.z); scene.add(lab); fun.ringLab = lab; }
    const les = { on: false, notes: 0, notesOk: false, answered: 0, testOk: false, test: null, laughs: 0, perfect: false, q: null, writing: false, hint: 0 };
    const up = { sv: null, code: '', day: -1, found: [false, false, false, false], excuse: false, cd: 0, st: 'patrol', wp: 0, wait: 0, say: 0 };
    { const av = makeAvatar({ name: 'MME GIRARD · SURVEILLANTE', skin: 0xe2b190, hair: 0x2d2a33, clothes: 0x3f7d6a }, 'teacher'); up.sv = { x: 0, z: -30, vx: 0, vz: 0, avatar: av, elev: EL, i: 40 }; av.group.position.set(0, EL, -30); }
    const NAV0 = NAV.blocked, NAV1 = new Uint8Array(NAV0.length);
    for (let iz = 0; iz < NAV.rows; iz++) for (let ix = 0; ix < NAV.cols; ix++) { const pt = navWorld(ix, iz); let b = !(pt.x > -16.9 && pt.x < 16.9 && pt.z > -38.6 && pt.z < -14.3);
      if (!b && world.walls2.some(w => pt.x > w.minX - .36 && pt.x < w.maxX + .36 && pt.z > w.minZ - .36 && pt.z < w.maxZ + .36)) b = true;
      if (!b && world.solids2.some(o => Math.hypot(pt.x - o.x, pt.z - o.z) < (o.radius || .4) + .32)) b = true; NAV1[navIndex(ix, iz)] = b ? 1 : 0; }
    function updatePlayer(dt) { NAV.blocked = P.lv ? NAV1 : NAV0; try { updatePlayerBase(dt); } finally { NAV.blocked = NAV0; } }
    function updateCamera(dt) { NAV.blocked = P.lv ? NAV1 : NAV0; try { updateCameraBase(dt); } finally { NAV.blocked = NAV0; } }
    function recordEvent(kind, x, z, volume = 8, mischief = false) {
      if (!P.lv) return recordEventBase(kind, x, z, volume, mischief);
      const ev = { kind, x, z, volume, time: state.totalTime, mischief, owner: 'player', lv: 1 }; state.noiseEvents.push(ev); state.lastNoise = state.totalTime;
      if (mischief) { P.lastMischief = state.totalTime; P.lastAction = ev; state.chaos += volume * .45; }
    }
    /* --- niveaux --- */
    const fadeEl = document.createElement('div'); fadeEl.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .3s;z-index:6'; root.appendChild(fadeEl);
    function goLevel(lv) {
      fadeEl.style.opacity = 1; P.vx = P.vz = 0; P.hidden = false;
      setTimeout(() => { P.lv = lv; P.elev = lv ? EL : 0; P.x = 0; P.z = lv ? -34.3 : -34.3; playerAvatar.group.position.set(P.x, P.elev, P.z); camera.position.y = 1.5 + P.elev; fadeEl.style.opacity = 0; toast(lv ? '⬆️ Étage : 8 salles à explorer !' : '⬇️ Rez-de-chaussée'); }, 320);
    }
    /* --- gestes --- */
    const RED = new THREE.Color(0xe8503f);
    function faceTo(p, tx, tz, k = .2) { const a = Math.atan2(-(tx - p.x), -(tz - p.z)); let d = a - p.avatar.group.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); p.avatar.group.rotation.y += d * k; }
    function animateAvatar(person, moving, dt, speed = 1) { animateAvatarBase(person, moving, dt, speed); try { gestures(person, moving, dt); } catch (e) { } if (person.elev) person.avatar.group.position.y += person.elev; }
    function gestures(p, moving, dt) {
      const av = p.avatar; if (!av.head || p.slipT > 0) return;
      const now = state.totalTime, txt = av.speechT > 0 ? (av.speechText || '') : '', talk = /[a-zA-Zà-ÿ]{3}/.test(txt), id = p.i || 0;
      const S1 = Math.sin(now * 11 + id), S2 = Math.sin(now * 5 + id * 2), isT = p === T || p === up.sv;
      let hx = 0, hy = 0, hz = 0, mo = 1, mw = 1, brow = 0, red = 0, a0 = null, a1 = null, sit = false, bodyY = 0;
      if (!isT && !moving && ((p === P && !P.lv && isClass() && dist2(P, MYSEAT) < .9) || (p !== P && isClass() && p.home && dist2(p, p.home) < .8))) { sit = true; a0 = { x: 1.05, z: .1 }; a1 = { x: 1.05, z: -.1 }; }
      if (p.sleep > 0 || /😴|Zzz/.test(txt)) { hx = -.6; sit = sit; }
      else if (/✋/.test(txt)) { a1 = { x: 3.0, z: -.1 + S2 * .1 }; hx = .1; }
      else if (/😂|🤣|Haha|MDR|Mort de rire|Trop drôle/i.test(txt)) { hx = .35; mo = 5; mw = 1.8; bodyY = Math.abs(S1) * .04; a0 = { x: .9, z: .25 }; a1 = { x: .9, z: -.25 }; }
      else if (/🥱/.test(txt)) { hx = .4; mo = 7; mw = 1.5; a1 = { x: 2.5, z: -.35 }; }
      else if (/😳|😅|🙈|🤦/.test(txt)) { hx = -.5; a0 = { x: 2.2, z: .1 }; a1 = { x: 2.2, z: -.1 }; }
      else if (/✏️|📖|📝|🎨/.test(txt)) { hx = -.5; a1 = { x: 1.15 + S1 * .1, z: 0 }; }
      else if (/📣/.test(txt)) { a1 = { x: 1.6, z: -.1 }; mo = 6; }
      else if (/😱|🙉/.test(txt)) { hx = .25; mo = 6; a0 = { x: 2.4, z: .3 }; a1 = { x: 2.4, z: -.3 }; }
      if (p === T) {
        const st = T.state;
        if (st === 'warn' || st === 'chase') { brow = 1; red = .65; a0 = { x: 1.25, z: .3 + S1 * .1 }; a1 = { x: 1.25, z: -.3 - S1 * .1 }; hy = S1 * .15; mo = 3 + Math.abs(S1) * 2; }
        else if (st === 'cooldown' && T.cooldown > 1.4) { brow = 1; red = .5; a1 = { x: 1.5, z: -.12 + S2 * .04 }; a0 = { x: .2, z: .3 }; mo = 3; faceTo(T, P.x, P.z, .25); }
        else if (st === 'callOut') { a1 = { x: 1.5, z: -.1 + S2 * .06 }; brow = .5; faceTo(T, P.x, P.z, .12); }
        else if (st === 'investigate' || st === 'look') { hy = Math.sin(now * 2.2) * .7; a0 = { x: .5, z: .6 }; }
        if (st === 'teach' && dist2(T, T.target) < 1.2) {
          av.fy = av.fy === undefined ? Math.PI : av.fy; const tgt = les.writing ? 0 : Math.PI; let d = tgt - av.fy; d = Math.atan2(Math.sin(d), Math.cos(d)); av.fy += d * Math.min(1, dt * 4); av.group.rotation.y = av.fy; T.yaw = les.writing ? 0 : Math.PI;
          if (les.writing) { a1 = { x: 2.7 + Math.sin(now * 7) * .22, z: 0 }; hx = .15; } else if (talk) a1 = { x: 1.1 + S2 * .5, z: -.25 };
        } else av.fy = undefined;
      }
      if (p === up.sv) { if (up.st === 'warn') { brow = 1; red = .6; a1 = { x: 1.5, z: -.2 }; a0 = { x: .2, z: .3 }; mo = 3; } }
      if (talk && !a1) { a1 = { x: .35 + S2 * .55, z: -.2 }; hx += S2 * .08; hy += S1 * .07; }
      if (talk) mo = Math.max(mo, 1 + Math.abs(Math.sin(now * 14 + id)) * 4.2);
      const k = Math.min(1, dt * 12), R = (o, key, v) => { o[key] += (v - o[key]) * k; };
      R(av.head.rotation, 'x', hx); R(av.head.rotation, 'y', hy); R(av.head.rotation, 'z', hz);
      R(av.mouth.scale, 'y', mo); R(av.mouth.scale, 'x', mw);
      av.brows[0].rotation.z += (-brow * .55 - av.brows[0].rotation.z) * k; av.brows[1].rotation.z += (brow * .55 - av.brows[1].rotation.z) * k;
      av.red += (red - av.red) * k; av.skinMat.color.copy(av.skin0).lerp(RED, av.red);
      av.tg = av.tg || [{ x: 0, z: 0 }, { x: 0, z: 0 }]; av.w = av.w || [0, 0];
      [a0, a1].forEach((a, i) => { if (a) av.tg[i] = a; av.w[i] += ((a ? 1 : 0) - av.w[i]) * k; const arm = av.arms[i]; arm.rotation.x = arm.rotation.x * (1 - av.w[i]) + av.tg[i].x * av.w[i]; arm.rotation.z = arm.rotation.z * (1 - av.w[i]) + av.tg[i].z * av.w[i]; });
      av.sw = (av.sw || 0) + ((sit ? 1 : 0) - (av.sw || 0)) * k;
      av.legs.forEach(l => { l.rotation.x = l.rotation.x * (1 - av.sw) + 1.45 * av.sw; });
      av.group.position.y += -.3 * av.sw + bodyY;
    }
    /* --- cours interactifs --- */
    const QB = [
      { s: 'm', q: 'Combien font 7 × 8 ?', a: '56', w: ['54', '63'] }, { s: 'm', q: 'Quel est le double de 35 ?', a: '70', w: ['65', '75'] }, { s: 'm', q: 'Combien de côtés a un hexagone ?', a: '6', w: ['5', '8'] },
      { s: 'm', q: 'La moitié de 150 ?', a: '75', w: ['70', '80'] }, { s: 'm', q: '12 + 29 = ?', a: '41', w: ['39', '43'] }, { s: 'm', q: 'Combien font 9 × 6 ?', a: '54', w: ['56', '63'] },
      { s: 'f', q: 'Le pluriel de « cheval » ?', a: 'chevaux', w: ['chevals', 'chevales'] }, { s: 'f', q: 'Quel est le contraire de « grand » ?', a: 'petit', w: ['gros', 'long'] },
      { s: 'f', q: '« Nous mangeons » : quel verbe ?', a: 'manger', w: ['mangé', 'mangeur'] }, { s: 'f', q: 'La capitale de l’Italie ?', a: 'Rome', w: ['Milan', 'Venise'] },
      { s: 'f', q: 'Qui a écrit « Le Petit Prince » ?', a: 'Saint-Exupéry', w: ['Victor Hugo', 'Molière'] }, { s: 'f', q: 'Un synonyme de « joyeux » ?', a: 'content', w: ['triste', 'fâché'] }
    ];
    const lessonEl = document.createElement('div'); lessonEl.style.cssText = 'position:absolute;right:14px;top:96px;width:268px;z-index:3;pointer-events:none;background:rgba(9,18,34,.86);color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:10px 12px;font:600 12px/1.5 system-ui;backdrop-filter:blur(10px)'; root.appendChild(lessonEl);
    const qEl = document.createElement('div'); qEl.style.cssText = 'position:absolute;left:50%;bottom:130px;transform:translateX(-50%);width:min(560px,92%);z-index:4;display:none;background:rgba(9,18,34,.95);color:#fff;border:1px solid rgba(255,255,255,.22);border-radius:16px;padding:14px;font:600 15px system-ui;text-align:center'; root.appendChild(qEl);
    const mEl = document.createElement('div'); mEl.style.cssText = qEl.style.cssText.replace('bottom:130px', 'top:50%').replace('translateX(-50%)', 'translate(-50%,-50%)'); mEl.style.display = 'none'; root.appendChild(mEl);
    const BTN = 'margin:4px;padding:9px 14px;border:0;border-radius:10px;font:700 14px system-ui;background:#ffcc33;color:#222;cursor:pointer';
    let qcm = null, mOpen = false;
    function askQcm(q, secs, cb, cheat) {
      const opts = [q.a, ...q.w.slice(0, 2)].map((t, i) => ({ t, ok: i === 0 })).sort(() => Math.random() - .5);
      qcm = { q, opts, t: secs, cb, done: false, cheat: !!cheat };
      qEl.innerHTML = `<div style="font-size:12px;opacity:.7">❓ Question · <span id="qt">${secs}</span>s · touches 1 2 3</div><div style="margin:6px 0 10px">${q.q}</div>` + opts.map((o, i) => `<button data-i="${i}" style="${BTN}">${i + 1}) ${o.t}</button>`).join('') + (cheat ? `<div><button data-c="1" style="${BTN};background:#e8503f;color:#fff">👀 Copier sur le voisin (risqué !)</button></div>` : '');
      qEl.style.display = 'block';
    }
    function qcmEnd(ok, i) { if (!qcm || qcm.done) return; qcm.done = true; const c = qcm; qEl.querySelectorAll('button').forEach((b, j) => { b.disabled = true; if (c.opts[j] && c.opts[j].ok) b.style.background = '#4ac96b'; else if (j === i) b.style.background = '#e8503f'; }); setTimeout(() => { qEl.style.display = 'none'; if (qcm === c) qcm = null; c.cb(ok); }, 900); }
    qEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !qcm) return; if (b.dataset.i !== undefined) qcmEnd(qcm.opts[+b.dataset.i].ok, +b.dataset.i); else if (b.dataset.c) cheat(); });
    function cheat() {
      if (!qcm || qcm.done) return; const nb = S.slice().sort((a, b) => dist2(a, MYSEAT) - dist2(b, MYSEAT))[0], rep = S.some(s => s.type === 'reporter' && dist2(s, MYSEAT) < 7 && s.affinity < 60 && Math.random() < .5);
      const seen = !les.writing && (teacherCanSeePlayer() || dist2(T, P) < 5);
      if (seen || rep) { punishPlayer(); toast(rep ? `${nb.name} t’a vu copier ! 😬` : '👩‍🏫 Elle t’a vu copier !'); qcmEnd(false, -1); }
      else { toast('😈 Copie réussie… ' + nb.name + ' sait tout !'); qcm.opts.forEach((o, j) => { if (!o.ok) qEl.querySelectorAll('button')[j].style.opacity = .25; }); const j = qcm.opts.findIndex(o => o.ok); qcmEnd(true, j); }
    }
    function qcmKey(e) { if (!qcm || qcm.done) return false; const k = e.key; if (k >= '1' && k <= '3') { e.preventDefault(); const i = +k - 1; if (qcm.opts[i]) qcmEnd(qcm.opts[i].ok, i); return true; } if (k.toLowerCase() === 'c' && qcm.cheat) { e.preventDefault(); cheat(); return true; } return false; }
    function mini(html, btns) { mEl.innerHTML = html + '<div id="mb"></div>'; const box = mEl.querySelector('#mb'); (btns || []).forEach(([l, f]) => { const b = document.createElement('button'); b.style.cssText = BTN; b.textContent = l; b.onclick = () => f(b); box.appendChild(b); }); mEl.style.display = 'block'; mOpen = true; }
    function miniClose() { mEl.style.display = 'none'; mOpen = false; }
    function reward(c, a, why) { addCoins(c, why); state.adm = clamp(state.adm + a, 0, 100); updateHud(true); }
    function askQuiz() {
      if (!les.on || les.test || qcm || les.q) return;
      const q = pick(QB.filter(x => x.s === (state.phaseIndex === 0 ? 'm' : 'f'))); teacherLine('❓ ' + q.q); les.q = { ...q, t: 10, mine: false };
      const hands = S.filter(s => s.type === 'sage' || s.type === 'curious' || Math.random() < .12); later(1.2, () => hands.forEach(s => say(s, '✋ Moi madame !', 2.4))); les.q.hands = hands;
      toast('❓ Question de la prof : appuie sur E pour lever la main !');
    }
    function resolveQuestion() {
      const q = les.q; les.q = null; if (!q) return;
      if (q.mine && Math.random() < .85) { teacherLine('Oui, toi, à ta place ?'); later(1.2, () => askQcm(q, 9, ok => { if (ok) { les.answered++; reward(les.answered === 1 ? 8 : 4, 4, '✅ Bonne réponse !'); say(T, 'Excellent !', 2.5); S.filter(s => dist2(s, P) < 14).forEach(s => { s.dance = 1; if (s.type !== 'sage') say(s, '👏', 1.8); }); progressMission('study'); } else { teacherLine(`Pas tout à fait. C’était « ${q.a} ».`); S.filter(s => dist2(s, P) < 10 && s.type !== 'sage').forEach(s => say(s, '😂', 2)); state.adm = clamp(state.adm - 1, 0, 100); } })); return; }
      const a = pick(q.hands && q.hands.length ? q.hands : S); teacherLine(q.mine ? `Pas toi cette fois… ${a.name} ?` : `Oui ${a.name} ?`); if (q.mine) toast('Dommage, elle a choisi quelqu’un d’autre.');
      later(1.4, () => { const silly = a.type === 'clown' && Math.random() < .6; say(a, silly ? pick(q.w) : q.a); later(1.3, () => { if (silly) { teacherLine(pick([a.name + '… sérieusement ?', 'Non. Quelqu’un d’autre ?'])); S.filter(o => dist2(o, a) < 9 && o.type !== 'sage').forEach(o => say(o, '😂', 2)); } else teacherLine(pick(['Exactement !', 'Très bien ' + a.name + '.', 'C’est ça.'])); }); });
    }
    function startTest() {
      les.test = { n: 0, score: 0 }; teacherLine('Rangez vos affaires : contrôle surprise !'); toast('📋 CONTRÔLE SURPRISE ! 3 questions · touche C pour copier (risqué)'); S.forEach(s => say(s, pick(['😱', 'Noooon !', 'Déjà ?!']), 2.5)); later(2.5, nextTestQ);
    }
    function nextTestQ() {
      const t = les.test; if (!t) return;
      if (t.n >= 3) { const sc = t.score; les.test = null; les.testOk = sc >= 2; reward(sc * 5 + (sc === 3 ? 10 : 0), sc * 2, `📋 Contrôle : ${sc}/3`); teacherLine(sc === 3 ? 'Un sans-faute, bravo !' : sc >= 2 ? 'C’est correct, bien joué.' : 'Il faudra réviser…'); return; }
      const pool = QB.filter(x => x.s === (state.phaseIndex === 0 ? 'm' : 'f')); askQcm(pick(pool), 12, ok => { t.n++; if (ok) t.score++; later(.6, nextTestQ); }, true);
    }
    function lessonInteract() {
      if (qcm || mOpen) return true;
      if (les.on && les.q && !les.q.mine && !P.lv && isClass()) { les.q.mine = true; speak(P, '✋ Moi madame !', 3); toast('✋ Tu as levé la main… patience !'); return true; }
      return false;
    }
    function onPhase() {
      les.on = isClass(); les.notes = 0; les.notesOk = false; les.answered = 0; les.testOk = false; les.test = null; les.laughs = 0; les.perfect = false; les.testDone = false; les.q = null; qcm = null; qEl.style.display = 'none';
      if (les.on) { if (P.lv) goLevel(0); toast(`📚 ${phaseName()} · objectifs en haut à droite !`); fun.quiz = 14; }
      fun.ring.visible = fun.ringLab.visible = les.on;
    }
    function upCode() { if (up.day !== state.day) { up.day = state.day; up.code = String(1000 + (Math.random() * 9000 | 0)); up.found = [false, false, false, false]; up.excuse = false; } }
    function upObject(o) {
      if (o.kind === 'stairs') { if (o.to === 1 && isClass()) toast('🚫 Escalier fermé pendant les cours : attends la récré !'); else goLevel(o.to); return true; }
      if (o.kind !== 'up') return false; upCode(); const a = o.act;
      if (a === 'stairs') goLevel(0);
      else if (a.startsWith('clue')) { const i = +a[4]; up.found[i] = true; toast(`🔎 Indice : le chiffre n°${i + 1} du coffre est ${up.code[i]} !`); }
      else if (a === 'labo') { const cs = ['🔴', '🟢', '🔵', '🟡'], seq = [pick(cs), pick(cs), pick(cs)]; let st = 0; mini(`<b>🧪 Mémorise l’ordre !</b><div style="font-size:34px;margin:10px">${seq.join(' ')}</div>`, []);
        later(2.6, () => { if (!mOpen) return; mini('<b>🧪 Reproduis l’ordre</b>', cs.map(c => [c, () => { if (c === seq[st]) { st++; if (st === 3) { miniClose(); spawnFx('confetti', P.x, P.z, 0x7be58c); reward(12, 2, '🧪 Expérience réussie !'); progressMission('study'); } } else { miniClose(); spawnFx('spark', P.x, P.z, 0xff7a3c); recordEvent('explosion', P.x, P.z, 16, true); toast('💥 Ça a explosé !'); } }])); }); }
      else if (a === 'drums') { let n = 0; mini('<b>🥁 FRAPPE le plus vite possible (6 s) !</b><div id="dn" style="font-size:28px">0</div>', [['🥁 FRAPPE !', () => { n++; mEl.querySelector('#dn').textContent = n; if (n % 8 === 0) recordEvent('batterie', P.x, P.z, 14, n > 24); }]]); later(6, () => { if (!mOpen) return; miniClose(); reward(Math.floor(n / 6), 0, `🥁 ${n} coups !`); }); }
      else if (a === 'piano') { recordEvent('piano', P.x, P.z, 7, false); reward(2, 1, '🎹 Jolie mélodie'); }
      else if (a === 'info') mini('<b>💻 Salle informatique</b>', [['Défi code', () => { miniClose(); askQcm({ q: 'En JavaScript : let x = 2; x *= 3; x + 1 = ?', a: '7', w: ['6', '8'] }, 12, ok => { if (ok) { reward(10, 1, '💻 Code correct !'); progressMission('computer'); } else toast('❌ Bug dans ton code…'); }); }], ['🕵️ Pirater les notes (risqué)', () => { miniClose(); if (Math.random() < .45) reward(25, 0, '🕵️ Piratage réussi !'); else { recordEvent('alarme', P.x, P.z, 28, true); toast('🚨 ALERTE ! Intrusion détectée !'); } }], ['Fermer', miniClose]]);
      else if (a === 'nurse') mini('<b>🩺 Infirmerie</b>', [['🤒 Je me sens mal…', () => { miniClose(); if (!up.excuse && Math.random() < .6) { up.excuse = true; addItem('excuse'); toast('📄 L’infirmière te donne un mot d’excuse !'); } else { state.adm = clamp(state.adm - 1, 0, 100); toast('« Tu as bonne mine, retourne en cours. »'); } }], ['💤 Me reposer', () => { miniClose(); P.energy = 100; toast('😌 Énergie au maximum'); }], ['Fermer', miniClose]]);
      else if (a === 'art') mini('<b>🎨 Atelier d’arts plastiques</b>', [['🖼️ Portrait', () => { miniClose(); reward(8, 2, '🖼️ Beau portrait'); progressMission('art'); }], ['🏞️ Paysage', () => { miniClose(); reward(8, 2, '🏞️ Joli paysage'); progressMission('art'); }], ['🖌️ Graffiti sur le mur', () => { miniClose(); recordEvent('dessin', P.x, P.z, 10, true); reward(15, -2, '🖌️ Œuvre sauvage !'); }], ['Fermer', miniClose]]);
      else if (a === 'cdi') mini('<b>📚 CDI</b>', [['📖 Lire tranquillement', () => { miniClose(); P.energy = clamp(P.energy + 30, 0, 100); reward(3, 2, '📖 Bonne lecture'); }], ['🔍 Chercher un livre secret', () => { miniClose(); if (Math.random() < .45) { addItem(pick(['confetti', 'slime', 'avion', 'bulles', 'coussin'])); toast('📕 Un objet est caché dans le livre !'); } else toast('🤧 Juste de la poussière…'); }], ['Fermer', miniClose]]);
      else if (a === 'wc') mini('<b>🚽 Toilettes</b>', [['🚪 Se cacher dans une cabine', () => { miniClose(); P.hidden = true; toast('🤫 Caché ! Bouge pour sortir.'); }], ['💦 Tirer la chasse', () => { miniClose(); recordEvent('chasse', P.x, P.z, 9, false); toast('💦 SPLOUTCH'); }], ['Fermer', miniClose]]);
      else if (a === 'safe') { let cur = ''; const hint = () => up.code.split('').map((c, i) => up.found[i] ? c : '_').join(' '), draw = () => { mini(`<b>🔐 Coffre-fort</b><div style="font-size:12px;opacity:.8">Indices trouvés : ${hint()}</div><div style="font-size:30px;letter-spacing:8px;margin:8px">${(cur + '····').slice(0, 4)}</div>`, [...'1234567890'].map(d => [d, () => { if (cur.length < 4) cur += d; draw(); }]).concat([['✔ OK', () => { if (cur === up.code) { miniClose(); up.code += ''; reward(60, 4, '🔐 COFFRE OUVERT !'); addItem('badge'); up.day = -1; } else { miniClose(); recordEvent('alarme', P.x, P.z, 26, true); toast('🚨 Mauvais code ! L’alarme sonne !'); } }], ['✖', () => { cur = ''; draw(); }], ['Fermer', miniClose]])); }; draw(); }
      return true;
    }
    function updUp(dt) {
      const sv = up.sv; if (!P.lv) return; up.cd -= dt;
      const seeP = !P.hidden && Math.abs(P.x) < 2.6 && Math.abs(P.z - sv.z) < 14 || (!P.hidden && dist2(P, sv) < 3.5);
      const bad = P.lastMischief > state.totalTime - 3 && dist2(P, sv) < 16;
      if (up.st === 'patrol') { const wps = [-37, -28, -19, -28]; const tz = wps[up.wp % 4]; sv.vz = Math.sign(tz - sv.z) * 1.7; if (Math.abs(tz - sv.z) < .4) { up.wp++; sv.vz = 0; up.wait = 2 + Math.random() * 3; } sv.x += (0 - sv.x) * dt * 2; if (up.wait > 0) { up.wait -= dt; sv.vz = 0; } sv.z += sv.vz * dt; faceTo(sv, sv.x, sv.z + (sv.vz || 1), .2);
        if (bad && seeP) { up.st = 'warn'; speak(sv, pick(['Hé ! On ne fait pas ça ici !', 'Je t’ai vu !', 'Stop ! Qu’est-ce que c’est que ça ?']), 3); toast('🧑‍🏫 La surveillante t’a repéré !'); } }
      else if (up.st === 'warn') { const tx = Math.abs(P.x) > 2.4 ? 0 : P.x, tzz = P.z, dx = tx - sv.x, dz = tzz - sv.z, l = Math.hypot(dx, dz) || 1; let nx = sv.x + dx / l * 3.0 * dt, nz = sv.z + dz / l * 3.0 * dt;
        if (!world.walls2.some(w => nx > w.minX && nx < w.maxX && nz > w.minZ && nz < w.maxZ)) { sv.x = nx; sv.z = nz; } sv.vx = dx / l; sv.vz = dz / l; faceTo(sv, P.x, P.z, .3);
        if (dist2(sv, P) < 2.2 && up.cd <= 0) { up.cd = 8; up.st = 'cool'; up.wait = 3; state.strikes++; T.strikes = state.strikes; state.adm = clamp(state.adm - 12, 0, 100); toast(`⚠️ Avertissement ${state.strikes}/3 (surveillante)`); speak(sv, 'Un avertissement ! Redescends !', 3); updateHud(true); if (state.strikes >= 3) endDay('director'); }
        if (P.hidden || dist2(sv, P) > 22) up.st = 'patrol'; }
      else if (up.st === 'cool') { up.wait -= dt; faceTo(sv, P.x, P.z, .25); if (up.wait <= 0) up.st = 'patrol'; }
      sv.avatar.group.visible = true; animateAvatar(sv, Math.hypot(sv.vx || 0, sv.vz || 0) > .3, dt, 1); sv.avatar.group.position.set(sv.x, EL, sv.z); sv.avatar.group.position.y = EL; updateSpeech(sv, dt);
      if (up.st === 'patrol' && dist2(sv, P) < 5 && P.lastMischief > state.totalTime - 2) up.st = 'warn';
    }
    function renderLesson() {
      if (!les.on) { lessonEl.innerHTML = P.lv ? '<b>🏫 Étage</b><br>🧪 Labo · 🎵 Musique · 💻 Info · 🩺 Infirmerie<br>🎨 Arts · 📚 CDI · 🚽 WC · 🔐 Direction<br><span style="opacity:.8">🔎 Trouve les 4 indices pour ouvrir le coffre ! La surveillante rôde dans le couloir.</span>' : `<b>🎮 Récré !</b><br>Cherche des objets dans la cour, fais des bêtises… ou monte à l’étage (escalier au fond du couloir).`; return; }
      const row = (ok, t, extra = '') => `<div>${ok ? '✅' : '⬜'} ${t} ${extra}</div>`, tp = T.state === 'teach' ? (les.writing ? '✍️ <b style="color:#7be58c">dos tourné au tableau</b> (profites-en !)' : '👀 <b style="color:#ffb86b">elle surveille la classe</b>') : T.state === 'investigate' || T.state === 'look' ? '🔍 <b>elle enquête…</b>' : '😡 <b style="color:#ff7b7b">elle est sur toi !</b>';
      lessonEl.innerHTML = `<b>📚 ${phaseName()}</b> <span style="opacity:.7">· ${Math.max(0, state.phaseTime | 0)}s</span><br>👩‍🏫 ${tp}<hr style="border:0;border-top:1px solid rgba(255,255,255,.15);margin:5px 0">` +
        row(les.notesOk, 'Prendre des notes', les.notesOk ? '' : `<span style="opacity:.8">(reste sur le cercle jaune : ${Math.round(les.notes)}%)</span>`) +
        row(les.answered > 0, 'Répondre à une question', les.q ? `<b style="color:#ffd447">← E : lève la main ! (${Math.ceil(les.q.t)}s)</b>` : '<span style="opacity:.8">(E quand elle pose une question)</span>') +
        row(les.testOk, 'Réussir le contrôle surprise', les.test ? '<b>en cours !</b>' : '<span style="opacity:.8">(fin du cours)</span>') +
        row(les.laughs > 0, '😈 Bonus : fais rire 4 élèves d’un coup');
    }
    let rT = 0;
    function updateLife(dt) {
      if (state.mode !== 'play') return;
      upCode(); updUp(dt); rT -= dt; if (rT <= 0) { rT = .25; renderLesson(); }
      if (qcm && !qcm.done) { qcm.t -= dt; const e = qEl.querySelector('#qt'); if (e) e.textContent = Math.max(0, Math.ceil(qcm.t)); if (qcm.t <= 0) qcmEnd(false, -1); }
      fun.ring.rotation.z += dt; fun.ring.material.opacity = .55 + Math.sin(state.totalTime * 4) * .25;
      if (!les.on) return;
      les.writing = T.state === 'teach' && (state.totalTime % 16) < 5 && !les.test;
      if (!P.lv && dist2(P, MYSEAT) < 1.6 && !P.moving && !les.notesOk) { les.notes += dt * 100 / 22; if (les.notes >= 100) { les.notesOk = true; reward(6, 4, '📝 Notes terminées !'); say(T, 'Très bonne application.', 2.5); } }
      if (les.q) { les.q.t -= dt; if (les.q.t <= 0) resolveQuestion(); }
      if (!les.test && !les.testOk && state.phaseTime < 30 && state.phaseIndex !== 1 && !les.testDone) { les.testDone = true; startTest(); }
      if (P.lastMischief > state.totalTime - 2.5 && S.filter(s => s.dance > 0 && dist2(s, P) < 14).length >= 4 && les.laughs === 0) { les.laughs = 1; reward(8, 0, '😈 Toute la classe rigole !'); }
      if (!les.perfect && les.notesOk && les.answered > 0 && les.testOk) { les.perfect = true; reward(10, 5, '⭐ Cours parfait !'); }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.04, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
      if (state.mode === 'play') {
        state.totalTime += dt; state.hudTime -= dt; state.toastTime -= dt;
        updatePlayer(dt); updateStudents(dt); updateTeacher(dt); updatePhase(dt); updateFun(dt); updateLife(dt);
        if (state.noiseEvents.length) state.noiseEvents = state.noiseEvents.filter(e => state.totalTime - e.time < 8);
        updateHud();
      }
      if (state.toastTime <= 0 && toastWasVisible) { toastEl.classList.remove('show'); toastWasVisible = false; }
      else if (state.toastTime > 0) toastWasVisible = true;
      updateWorld(dt); updateCamera(dt); ambient(dt);
      renderer.render(scene, camera);
    }

    function openPause() {
      if (state.mode !== 'play') return;
      state.mode = 'paused'; drag = null;
      Object.keys(keys).forEach(k => { keys[k] = false; });
      // Aucun verrouillage de pointeur n'est utilisé : en pause, le curseur est immédiatement libre.
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
      showPanel('Pause', 'Prends ton temps.', '<p>La simulation est arrêtée. La souris est libre et tu peux reprendre quand tu veux.</p>', [
        { label: '▶️ Reprendre la partie', action: () => { state.mode = 'play'; hidePanel(); renderer.domElement.focus(); } },
        { label: 'Revoir le tutoriel', secondary: true, action: showTutorial },
        { label: 'Recommencer la journée', secondary: true, action: startDay }
      ], 'JEU EN PAUSE');
    }

    async function toggleFullscreen() {
      try {
        if (document.fullscreenElement === root) await document.exitFullscreen();
        else if (root.requestFullscreen) await root.requestFullscreen();
        else toast('Le plein écran n’est pas disponible dans ce navigateur.');
      } catch (err) { toast('Impossible d’activer le plein écran dans ce navigateur.'); }
    }
    function onKeyDown(e) {
      if (qcmKey(e)) return;
      const key = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(key)) e.preventDefault();
      keys[key] = true;
      if (e.repeat) return;
      if (key === 'escape') {
        if (state.mode === 'play') openPause();
        else if (state.mode === 'paused') { state.mode = 'play'; hidePanel(); renderer.domElement.focus(); }
        else if (state.mode === 'panel') { state.mode = 'play'; hidePanel(); }
        return;
      }
      if (state.mode !== 'play') return;
      if (key === 'e' || key === 'f') interact();
      else if (key === ' ') useItem();
      else if (key === 'tab' || key === 'r') { P.selected = (P.selected + 1) % inventoryCapacity(); updateHotbar(); }
      else if (/^[1-6]$/.test(key)) { const idx = Number(key) - 1; if (idx < inventoryCapacity()) { P.selected = idx; updateHotbar(); } }
      else if (key === 'j') jump();
    }
    function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }
    function onPointerDown(e) {
      if (e.button === 2) { drag = { x: e.clientX, y: e.clientY }; renderer.domElement.setPointerCapture?.(e.pointerId); }
      else if (e.button === 0 && state.mode === 'play') {
        renderer.domElement.focus();
        // Un clic gauche déclenche aussi l'interaction la plus proche pour rendre le jeu plus intuitif.
        if (e.detail === 1) interact();
      }
    }
    function onPointerMove(e) {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      cameraYaw -= dx * .006;
      const inBuilding=!!getInteriorBounds();
      cameraPitch=clamp(cameraPitch+dy*.004,.08,inBuilding?.40:.95);
    }
    function onPointerUp() { drag = null; }
    function onContextMenu(e) { e.preventDefault(); }
    function onWheel(e) { e.preventDefault(); cameraDistance = clamp(cameraDistance + Math.sign(e.deltaY) * .9, 6.5, 25); }
    function onResize() {
      const w = sceneHost.clientWidth || 960, h = sceneHost.clientHeight || 620;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    }
    function onVisibility() { if (document.hidden && state.mode === 'play') openPause(); }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    // Contrôles tactiles minimalistes.
    const mobileButtons = root.querySelectorAll('[data-mobile]');
    root.querySelector('[data-action="fullscreen"]').addEventListener('click', toggleFullscreen);
    root.querySelector('[data-action="pause"]').addEventListener('click', () => { if (state.mode === 'play') openPause(); else if (state.mode === 'paused') { state.mode='play'; hidePanel(); } });
    function updateFullscreenButton() {
      const btn = root.querySelector('[data-action="fullscreen"]');
      if (btn) btn.textContent = document.fullscreenElement === root ? '⤢ Quitter plein écran' : '⛶ Plein écran';
      setTimeout(onResize, 60);
    }
    document.addEventListener('fullscreenchange', updateFullscreenButton);

    // Empêche le scroll de la page tant que le curseur est au-dessus du jeu.
    root.addEventListener('wheel', onWheel, { passive: false });
    const savedPageStyles = {
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      bodyOverscroll: document.body.style.overscrollBehavior,
      bodyTouch: document.body.style.touchAction
    };
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'none';

    mobileButtons.forEach(btn => {
      const action = btn.dataset.mobile;
      const start = e => {
        e.preventDefault();
        if (action === 'talk') interact();
        else if (action === 'use') useItem();
        else keys.w = true;
      };
      const end = e => { e.preventDefault(); if (action === 'up') keys.w = false; };
      btn.addEventListener('pointerdown', start); btn.addEventListener('pointerup', end); btn.addEventListener('pointercancel', end); btn.addEventListener('pointerleave', end);
    });

    updateHotbar(); updateHud(true); openMenu();
    raf = requestAnimationFrame(frame);

    return {
      stop() {
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisibility);
        document.removeEventListener('fullscreenchange', updateFullscreenButton);
        root.removeEventListener('wheel', onWheel);
        document.documentElement.style.overflow = savedPageStyles.htmlOverflow;
        document.body.style.overflow = savedPageStyles.bodyOverflow;
        document.body.style.overscrollBehavior = savedPageStyles.bodyOverscroll;
        document.body.style.touchAction = savedPageStyles.bodyTouch;
        if (host && host.id === 'game-view') host.classList.remove('et3d-host');
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointercancel', onPointerUp);
        renderer.domElement.removeEventListener('contextmenu', onContextMenu);
        mobileButtons.forEach(btn => { btn.replaceWith(btn.cloneNode(true)); });
        scene.traverse(obj => {
          if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
          if (obj.material) {
            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
            materials.forEach(m => { if (m.map && m.map.dispose) m.map.dispose(); if (m.dispose) m.dispose(); });
          }
        });
        renderer.dispose();
        renderer.forceContextLoss?.();
        root.remove();
      }
    };
  }

  window.Ecole = {
    start(host) {
      this.stop();
      const target = host || document.getElementById('game-view') || document.body;
      gameInstance = createGame(target);
    },
    stop() {
      if (gameInstance) { try { gameInstance.stop(); } catch (e) { console.warn('Nettoyage École Tycoon :', e); } }
      gameInstance = null;
    }
  };

  window.startEcoleTycoonGame = () => {
    const defaultCanvas = document.getElementById('game-canvas');
    if (defaultCanvas) defaultCanvas.classList.add('hidden');
    const host = document.getElementById('game-view') || document.body;
    window.Ecole.start(host);
  };

  window._ecoletycoonCleanup = () => {
    window.Ecole.stop();
    const defaultCanvas = document.getElementById('game-canvas');
    if (defaultCanvas) defaultCanvas.classList.remove('hidden');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
})();