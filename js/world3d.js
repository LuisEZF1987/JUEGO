// ====================================================================
//  world3d.js — Mundo 3D explorable MULTIJUGADOR.
//  - 6 Naciones dispuestas alrededor de una plaza central.
//  - Acertijos como cristales colocados en cada Nación (pulsa E para resolver).
//  - Otros jugadores conectados se ven moverse en tiempo real (vía net.js).
// ====================================================================

const World3D = (function(){
  let THREE, renderer, scene, camera, composer, raf = 0, active = false, last = 0;
  let canvasEl, ground, sky, embers;
  let player = null;                 // jugador local
  const remote = new Map();          // id -> jugador remoto
  let nations = [], crystals = [];
  const keys = new Set();
  let dragging = false, lastX = 0, lastY = 0;
  let camYaw = Math.PI, camPitch = 0.42, camDist = 9;
  let stateTimer = 0, nearCrystal = null, myName = '', curNation = 'Centro';
  let hud = null, statusTxt = 'Conectando…', playerCount = 1, toastT = 0;

  function init(canvas, char){
    THREE = window.THREE;
    if (!renderer) create(canvas);
    setLocalHero(char);
    connectNet(char);
    start();
  }
  function setHero(char){ setLocalHero(char); reconnect(char); }

  function create(canvas){
    canvasEl = canvas;
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
    renderer.setPixelRatio(1); renderer.setSize(canvas.width, canvas.height, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(52, canvas.width/canvas.height, 0.1, 600);
    camera.position.set(0, 7, -10);

    scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x202830, 0.65));
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(14, 22, 10); scene.add(sun);

    const skyMat = new THREE.ShaderMaterial({ side:THREE.BackSide, depthWrite:false,
      uniforms:{ top:{ value:new THREE.Color(0x2a3a6a) }, bot:{ value:new THREE.Color(0x0c0e16) } },
      vertexShader:'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:'varying vec3 vP; uniform vec3 top; uniform vec3 bot; void main(){ float h=clamp(normalize(vP).y*0.5+0.5,0.0,1.0); gl_FragColor=vec4(mix(bot,top,h),1.0); }' });
    sky = new THREE.Mesh(new THREE.SphereGeometry(260, 24, 16), skyMat); scene.add(sky);
    scene.fog = new THREE.Fog(0x0c0e16, 40, 130);

    ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color:0x1a1e2a, roughness:1 }));
    ground.rotation.x = -Math.PI/2; scene.add(ground);

    buildWorld();

    const N = 120, pos = new Float32Array(N*3);
    for (let i=0;i<N;i++){ pos[i*3]=(Math.random()-0.5)*120; pos[i*3+1]=Math.random()*14; pos[i*3+2]=(Math.random()-0.5)*120; }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(pos,3));
    embers = new THREE.Points(eg, new THREE.PointsMaterial({ color:0x9fb0ff, size:0.16, transparent:true, opacity:0.7, blending:THREE.AdditiveBlending, depthWrite:false }));
    scene.add(embers);

    composer = new THREE.EffectComposer(renderer);
    composer.setSize(canvas.width, canvas.height);
    composer.addPass(new THREE.RenderPass(scene, camera));
    composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(canvas.width, canvas.height), 0.7, 0.5, 0.55));

    hud = document.getElementById('worldhud');
    buildHUD();
    bindInput();
  }

  function buildWorld(){
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshStandardMaterial({ color:0x2a2f3e, roughness:1 }));
    plaza.rotation.x = -Math.PI/2; plaza.position.y = 0.02; scene.add(plaza);

    nations = CHARACTERS.map((c, i) => { const ang = (i/CHARACTERS.length)*Math.PI*2; const R = 30; return { name:c.nation, element:c.element, heroId:c.id, x:Math.cos(ang)*R, z:Math.sin(ang)*R }; });
    const byNation = nations.map(() => []);
    PUZZLES.forEach((p, i) => byNation[i % nations.length].push(p));

    nations.forEach((n, idx) => {
      const t = NATION_THEME[n.element], acc = new THREE.Color(t.accent);
      const zone = new THREE.Mesh(new THREE.CircleGeometry(15, 44), new THREE.MeshStandardMaterial({ color:new THREE.Color(t.ground), roughness:1 }));
      zone.rotation.x = -Math.PI/2; zone.position.set(n.x, 0.03, n.z); scene.add(zone);
      const ring = new THREE.Mesh(new THREE.RingGeometry(14.3, 15, 48), new THREE.MeshBasicMaterial({ color:acc, transparent:true, opacity:0.5, side:THREE.DoubleSide }));
      ring.rotation.x = -Math.PI/2; ring.position.set(n.x, 0.06, n.z); scene.add(ring);
      const sign = makeTextSprite(ELEMENT_META[n.element].emoji + ' ' + n.name, '#ffffff', t.accent);
      sign.scale.set(8, 2, 1); sign.position.set(n.x, 4.4, n.z); scene.add(sign);
      for (let k=0;k<6;k++){ const a=Math.random()*Math.PI*2, r=6+Math.random()*7, h=1+Math.random()*3.5;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.6+Math.random()*0.7, h, 6), new THREE.MeshStandardMaterial({ color:new THREE.Color(t.ground).multiplyScalar(1.4), roughness:0.92 }));
        cone.position.set(n.x+Math.cos(a)*r, h/2, n.z+Math.sin(a)*r); cone.rotation.y=Math.random()*Math.PI; scene.add(cone); }
      const ps = byNation[idx];
      ps.forEach((p, j) => {
        const a = (j/Math.max(1,ps.length))*Math.PI*2, r = 7.5, cx = n.x+Math.cos(a)*r, cz = n.z+Math.sin(a)*r;
        const mat = new THREE.MeshStandardMaterial({ color:acc.clone(), emissive:acc.clone(), emissiveIntensity:1.4, roughness:0.3 });
        const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), mat); mesh.position.set(cx, 1.4, cz);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 0.4, 8), new THREE.MeshStandardMaterial({ color:0x20242f, roughness:0.85 }));
        base.position.set(cx, 0.2, cz);
        scene.add(mesh); scene.add(base);
        crystals.push({ mesh, mat, puzzleId:p.id, title:p.title, nation:n.name, x:cx, z:cz, solved:false, acc:acc.clone() });
      });
    });
  }

  function setLocalHero(char){
    if (player) scene.remove(player.group);
    const g = buildHero3D(THREE, char);
    player = { group:g, parts:g.userData.parts, headBaseY:g.userData.parts.head.userData.baseY, hero:char.id, targetFacing:Math.PI, walkPhase:0 };
    g.position.set(0, 0, 6); g.rotation.y = Math.PI; scene.add(g);
  }

  // ---------------- red ----------------
  function connectNet(char){
    myName = (localStorage.getItem('mp_name') || '').trim() || (char.name + '-' + Math.floor(Math.random()*900+100));
    statusTxt = 'Conectando…'; playerCount = 1;
    Net.connect(myName, char.id, {
      welcome:(m)=>{ statusTxt='Conectado'; playerCount = 1 + (m.players?m.players.length:0); (m.players||[]).forEach(addRemote); },
      join:(p)=>{ addRemote(p); playerCount++; toast(p.name + ' entró al mundo'); },
      state:(m)=>{ const r=remote.get(m.id); if (r){ r.tx=m.x; r.tz=m.z; r.try=m.ry; r.moving=(m.anim==='walk'); } },
      leave:(id)=>{ const r=remote.get(id); if (r){ scene.remove(r.group); scene.remove(r.nameSprite); remote.delete(id); playerCount=Math.max(1,playerCount-1); } },
      solve:(m)=>{ toast((m.name||'Alguien') + ' resolvió un acertijo'); },
      close:()=>{ statusTxt='Desconectado'; },
      error:()=>{ statusTxt='Sin conexión'; },
    });
  }
  function reconnect(char){ Net.disconnect(); remote.forEach(r=>{ scene.remove(r.group); scene.remove(r.nameSprite); }); remote.clear(); connectNet(char); }
  function addRemote(p){
    if (remote.has(p.id)) return;
    const ch = CHARACTERS.find(c => c.id === p.hero) || CHARACTERS[0];
    const g = buildHero3D(THREE, ch); g.position.set(p.x||0, 0, p.z||0); g.rotation.y = p.ry||0; scene.add(g);
    const nameSprite = makeTextSprite(p.name || ('J'+p.id), '#cde3ff', null); nameSprite.scale.set(3.2, 0.8, 1); nameSprite.position.set(g.position.x, 3.4, g.position.z); scene.add(nameSprite);
    remote.set(p.id, { group:g, parts:g.userData.parts, headBaseY:g.userData.parts.head.userData.baseY, hero:p.hero, tx:p.x||0, tz:p.z||0, try:p.ry||0, walkPhase:0, nameSprite, moving:false });
  }

  // ---------------- entrada ----------------
  function bindInput(){
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
    canvasEl.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
    canvasEl.addEventListener('wheel', onWheel, { passive:false });
  }
  function onKey(e){
    if (!active) return;
    const k = e.key.toLowerCase(); keys.add(k);
    if (k === 'e' && nearCrystal && !modalOpen() && window.GameUI){ window.GameUI.openPuzzle(nearCrystal.puzzleId); }
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  }
  function onKeyUp(e){ keys.delete(e.key.toLowerCase()); }
  function onDown(e){ if (!active || e.button!==0) return; dragging=true; lastX=e.clientX; lastY=e.clientY; }
  function onMove(e){ if (!dragging || !active) return; camYaw -= (e.clientX-lastX)*0.006; camPitch=Math.max(0.1,Math.min(1.1,camPitch+(e.clientY-lastY)*0.005)); lastX=e.clientX; lastY=e.clientY; }
  function onUp(){ dragging=false; }
  function onWheel(e){ if (!active) return; e.preventDefault(); camDist=Math.max(5,Math.min(16,camDist+(e.deltaY>0?0.8:-0.8))); }
  function modalOpen(){ const el=document.getElementById('puzzle-modal'); return el && !el.hidden; }

  // ---------------- bucle ----------------
  function start(){ if (active) return; active=true; last=performance.now(); raf=requestAnimationFrame(loop); }
  function stop(){ active=false; cancelAnimationFrame(raf); keys.clear(); dragging=false; Net.disconnect(); remote.forEach(r=>{ scene.remove(r.group); scene.remove(r.nameSprite); }); remote.clear(); }
  function loop(now){ if (!active) return; let dt=(now-last)/1000; last=now; dt=Math.min(0.05,dt); update(dt); composer.render(); raf=requestAnimationFrame(loop); }

  function update(dt){
    const blocked = modalOpen();
    let moving = false;
    if (!blocked){
      let mx=0,mz=0; const fwd={x:-Math.sin(camYaw),z:-Math.cos(camYaw)}, right={x:Math.cos(camYaw),z:-Math.sin(camYaw)};
      if (keys.has('w')||keys.has('arrowup')){ mx+=fwd.x; mz+=fwd.z; }
      if (keys.has('s')||keys.has('arrowdown')){ mx-=fwd.x; mz-=fwd.z; }
      if (keys.has('d')||keys.has('arrowright')){ mx+=right.x; mz+=right.z; }
      if (keys.has('a')||keys.has('arrowleft')){ mx-=right.x; mz-=right.z; }
      if (mx||mz){ const d=Math.hypot(mx,mz); mx/=d; mz/=d; const sp=keys.has('shift')?9:4.6; player.group.position.x+=mx*sp*dt; player.group.position.z+=mz*sp*dt; player.targetFacing=Math.atan2(mx,mz); moving=true; }
    }
    const R=60; player.group.position.x=Math.max(-R,Math.min(R,player.group.position.x)); player.group.position.z=Math.max(-R,Math.min(R,player.group.position.z));
    player.group.rotation.y = lerpAngle(player.group.rotation.y, player.targetFacing, 0.2);
    animateFigure(player, dt, moving);

    // jugadores remotos
    remote.forEach(r => {
      const dx=r.tx-r.group.position.x, dz=r.tz-r.group.position.z, k=Math.min(1,10*dt);
      r.group.position.x+=dx*k; r.group.position.z+=dz*k;
      r.group.rotation.y = lerpAngle(r.group.rotation.y, r.try, 0.2);
      r.nameSprite.position.set(r.group.position.x, 3.4, r.group.position.z);
      animateFigure(r, dt, r.moving || (Math.hypot(dx,dz) > 0.03));
    });

    // enviar mi estado ~10/s
    stateTimer -= dt;
    if (stateTimer <= 0 && Net.connected()){ stateTimer = 0.1; Net.send({ t:'state', x:player.group.position.x, y:0, z:player.group.position.z, ry:player.group.rotation.y, nation:curNation, anim:moving?'walk':'idle' }); }

    // Nación actual + cristales
    curNation = 'Centro'; let bestN = 15*15;
    for (const n of nations){ const d=(n.x-player.group.position.x)**2+(n.z-player.group.position.z)**2; if (d<bestN){ bestN=d; curNation=n.name; } }
    nearCrystal = null; let best = 3*3;
    for (const cr of crystals){
      cr.mesh.rotation.y += dt*1.3; cr.mesh.position.y = 1.4 + Math.sin(performance.now()*0.002 + cr.x)*0.18;
      const solved = !!(window.GameUI && window.GameUI.isSolved && window.GameUI.isSolved(cr.puzzleId));
      if (solved !== cr.solved){ cr.solved = solved; const col = solved ? new THREE.Color(0x4ad06a) : cr.acc; cr.mat.color.copy(col); cr.mat.emissive.copy(col); if (solved && Net.connected()) Net.send({ t:'solve', puzzle:cr.puzzleId }); }
      const d=(cr.x-player.group.position.x)**2+(cr.z-player.group.position.z)**2; if (d<best){ best=d; nearCrystal=cr; }
    }

    updateCamera(dt);
    const arr = embers.geometry.attributes.position.array;
    for (let i=0;i<arr.length;i+=3){ arr[i+1]+=dt*0.5; if (arr[i+1]>14){ arr[i+1]=0; } }
    embers.geometry.attributes.position.needsUpdate = true;

    if (toastT>0) toastT-=dt;
    updateHUD();
  }
  function updateCamera(dt){
    const tx=player.group.position.x, ty=player.group.position.y+1.4, tz=player.group.position.z, cp=Math.cos(camPitch);
    const cx=tx+Math.sin(camYaw)*camDist*cp, cy=ty+Math.sin(camPitch)*camDist, cz=tz+Math.cos(camYaw)*camDist*cp, k=Math.min(1,9*dt);
    camera.position.x+=(cx-camera.position.x)*k; camera.position.y+=(cy-camera.position.y)*k; camera.position.z+=(cz-camera.position.z)*k;
    camera.lookAt(tx,ty,tz);
  }

  function animateFigure(f, dt, moving){
    if (moving) f.walkPhase += dt*9;
    const sw = moving ? Math.sin(f.walkPhase)*0.6 : Math.sin(performance.now()*0.002)*0.05;
    f.parts.lLeg.rotation.x=sw; f.parts.rLeg.rotation.x=-sw;
    f.parts.lArm.rotation.x=-sw*0.8-0.1; f.parts.rArm.rotation.x=sw*0.8-0.1;
    f.parts.head.position.y = f.headBaseY + (moving?Math.abs(Math.sin(f.walkPhase))*0.04:0);
  }

  // ---------------- HUD + utilidades ----------------
  function buildHUD(){
    if (!hud) return;
    hud.innerHTML = '<div class="w-top"><span class="dot" id="w-dot"></span> <span id="w-status"></span> · <span id="w-count"></span> 👥 · 📍 <span id="w-nation"></span></div>'
      + '<div class="w-toast" id="w-toast"></div>'
      + '<div class="w-prompt" id="w-prompt"></div>'
      + '<div class="w-hint"><b>WASD</b> moverte · arrastrar ratón = cámara · <b>E</b> = resolver acertijo cercano</div>';
    hud._status=document.getElementById('w-status'); hud._count=document.getElementById('w-count'); hud._nation=document.getElementById('w-nation');
    hud._toast=document.getElementById('w-toast'); hud._prompt=document.getElementById('w-prompt'); hud._dot=document.getElementById('w-dot');
  }
  function updateHUD(){
    if (!hud || !hud._status) return;
    hud._status.textContent = myName + ' · ' + statusTxt;
    hud._count.textContent = playerCount;
    hud._nation.textContent = curNation;
    hud._dot.style.background = Net.connected() ? '#5ad469' : '#ff7b7b';
    hud._prompt.textContent = (nearCrystal && !modalOpen()) ? ('🧩 Pulsa E para resolver: ' + nearCrystal.title + (nearCrystal.solved ? ' (resuelto)' : '')) : '';
    hud._toast.style.opacity = toastT > 0 ? '1' : '0';
  }
  function toast(msg){ if (hud && hud._toast){ hud._toast.textContent = msg; toastT = 3.2; } }

  function makeTextSprite(text, color, bg){
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c = cv.getContext('2d');
    if (bg){ c.fillStyle = 'rgba(0,0,0,0.55)'; rr(c, 8, 28, 496, 72, 18); c.fill(); c.strokeStyle = bg; c.lineWidth = 4; rr(c, 8, 28, 496, 72, 18); c.stroke(); }
    c.font = 'bold 44px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.strokeText(text, 256, 64); c.fillStyle = color; c.fillText(text, 256, 64);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cv), transparent:true, depthTest:false }));
  }
  function rr(c, x, y, w, h, r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
  function lerpAngle(a, b, t){ let d=((b-a+Math.PI)%(Math.PI*2))-Math.PI; if (d<-Math.PI) d+=Math.PI*2; return a+d*t; }

  return { init, stop, setHero };
})();
