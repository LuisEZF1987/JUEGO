// ====================================================================
//  world3d.js — Mundo 3D explorable MULTIJUGADOR.
//  - 6 Naciones dispuestas alrededor de una plaza central.
//  - Bestias y Jefes (Dioses Encadenados) que cazar en cada Nación (clic para atacar).
//  - Otros jugadores conectados se ven moverse en tiempo real (vía net.js).
// ====================================================================

const World3D = (function(){
  let THREE, renderer, scene, camera, composer, raf = 0, active = false, last = 0;
  let canvasEl, ground, sky, embers, dn = null, weather = null;   // dn = ciclo día-noche; weather = clima por nación
  let player = null;                 // jugador local
  const remote = new Map();          // id -> jugador remoto
  let nations = [];
  const keys = new Set();
  let dragging = false, lastX = 0, lastY = 0, moved = 0;
  let camYaw = Math.PI, camPitch = 0.42, camDist = 9;
  let pointerLocked = false;   // mouse-look: mover el mouse gira la cámara (como girar la cabeza/mirada)
  let stateTimer = 0, myName = '', curNation = 'Centro';
  let hud = null, statusTxt = 'Conectando…', playerCount = 1, toastT = 0;
  // combate del Mundo
  let raycaster = null, ndc = null, lockedMob = null, lockRing = null, atkTimer = 0;
  let projectiles = [], strikes = [], rings = [], zones = [], worldTexts = [];
  // forja / inventario
  let forge = { weapon:0, armor:0, amulet:0 }, panelEl = null, panelOpen = false;
  let marketEl = null, marketOpen = false, marketCatalog = [], marketReceipts = [], marketTab = 'buy';   // mercado
  let clan = '', chatEl = null, chatInput = null, chatLines = [];   // clan + caja de chat
  let pvpOn = false;   // PvP activable: solo atacas/recibes daño de jugadores si está ON (Tab los fija)
  let soulshots = false;   // Esquirlas de Combate: gastan oro por golpe a cambio de +daño (sumidero estilo L2)
  let myParty = [], pendingInvite = null;                          // grupo (party)
  let serverBosses = {}, contributedBosses = new Set();            // Jefes compartidos (autoritativos)
  // carga de modelos glTF (KayKit). Si falla, se usa el constructor de cajas.
  let modelsReady = false, modelsTried = false, gltfOK = false, pendingChar = null;
  let level = 1, xp = 0;             // progreso del jugador (compartido entre héroes, persistido)

  function init(canvas, char){
    THREE = window.THREE;
    loadProgress(); loadForge(); clan = (localStorage.getItem('el_clan')||'').slice(0,8);
    if (!renderer) create(canvas);
    pendingChar = char;
    if (modelsReady){ finishInit(); return; }
    if (modelsTried) return;                 // ya cargando
    modelsTried = true;
    if (hud) hud.innerHTML = '<div class="h3-loading">Cargando mundo 3D…</div>';
    if (!window.HeroGLTF){ gltfOK = false; modelsReady = true; finishInit(); return; }
    window.HeroGLTF.preloadHeroModels(THREE, ()=>{})
      .then(()=>{ gltfOK = true; }).catch(err => { console.warn('[world3d] glTF preload falló; cajas:', err); gltfOK = false; })
      .then(()=>{ modelsReady = true; finishInit(); });
  }
  function finishInit(){
    if (!pendingChar) return;
    syncAccount();
    if (window.Mobs && Mobs.setPlayerLevel) Mobs.setPlayerLevel(level);   // con-color de mobs respecto a tu nivel
    buildHUD();
    setLocalHero(pendingChar);
    connectNet(pendingChar);
    start();
  }
  // ---- persistencia por personaje (Account) ----
  function syncAccount(){
    if (!(window.Account && Account.active)) return;
    const c = Account.active(); if (!c) return;
    level = c.level || 1; xp = c.xp || 0;
    forge = c.forge || (c.forge = { weapon:0, armor:0, amulet:0 });
    if (typeof c.clan === 'string') clan = c.clan;
    if (window.Mobs && Mobs.bindLoot) Mobs.bindLoot(c);   // oro/bajas/materiales por personaje
  }
  function saveAccount(){
    if (window.Account && Account.active){
      const c = Account.active(); if (c){ c.level = level; c.xp = xp; if (typeof clan === 'string') c.clan = clan; c.updated = Date.now(); }
      if (Account.save) Account.save();
    } else { saveProgress(); saveForge(); }
  }
  function setHero(char){ if (!modelsReady){ pendingChar = char; return; } setLocalHero(char); reconnect(char); }

  // ---------------- progreso (XP / niveles) ----------------
  const PROGRESS_KEY = 'el_progress_v1';
  function loadProgress(){ try{ const r = JSON.parse(localStorage.getItem(PROGRESS_KEY)); if (r){ level = r.level||1; xp = r.xp||0; } }catch(e){} }
  function saveProgress(){ try{ localStorage.setItem(PROGRESS_KEY, JSON.stringify({ level, xp })); }catch(e){} }
  function xpNeeded(lv){ return Math.round(50 * Math.pow(lv, 1.6)); }   // XP para subir del nivel `lv` al siguiente
  function gainXP(amount){
    xp += amount; let up = false;
    while (xp >= xpNeeded(level)){ xp -= xpNeeded(level); level++; up = true; }
    if (up) toast('⭐ ¡Subiste a Nivel ' + level + '!  (+12% daño por nivel)');
    if (up && window.Mobs && Mobs.setPlayerLevel) Mobs.setPlayerLevel(level);   // recolorea con-color al subir
    saveAccount(); pushSave();
  }

  function create(canvas){
    canvasEl = canvas;
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
    renderer.setPixelRatio(1); renderer.setSize(canvas.width, canvas.height, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(52, canvas.width/canvas.height, 0.3, 1300);
    camera.position.set(0, 7, -10);

    const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x202830, 0.65); scene.add(hemi);
    const ambient = new THREE.AmbientLight(0xffffff, 0.3); scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(14, 22, 10); scene.add(sun);

    const skyMat = new THREE.ShaderMaterial({ side:THREE.BackSide, depthWrite:false,
      uniforms:{ top:{ value:new THREE.Color(0x2a3a6a) }, bot:{ value:new THREE.Color(0x0c0e16) } },
      vertexShader:'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:'varying vec3 vP; uniform vec3 top; uniform vec3 bot; void main(){ float h=clamp(normalize(vP).y*0.5+0.5,0.0,1.0); gl_FragColor=vec4(mix(bot,top,h),1.0); }' });
    sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 16), skyMat); scene.add(sky);
    scene.fog = new THREE.Fog(0x0c0e16, 80, 340);
    dn = { t: 0.34, sun, hemi, ambient, skyMat, ca:new THREE.Color(), cb:new THREE.Color() };   // arranca en mañana
    updateDayNight(0);   // aplica el estado inicial

    buildWorld();   // construye el terreno con relieve + naciones + zonas

    const N = 120, pos = new Float32Array(N*3);
    for (let i=0;i<N;i++){ pos[i*3]=(Math.random()-0.5)*600; pos[i*3+1]=Math.random()*16; pos[i*3+2]=(Math.random()-0.5)*600; }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(pos,3));
    embers = new THREE.Points(eg, new THREE.PointsMaterial({ color:0x9fb0ff, size:0.16, transparent:true, opacity:0.7, blending:THREE.AdditiveBlending, depthWrite:false }));
    scene.add(embers);
    weather = buildWeather();

    composer = new THREE.EffectComposer(renderer);
    composer.setSize(canvas.width, canvas.height);
    composer.addPass(new THREE.RenderPass(scene, camera));
    composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(canvas.width, canvas.height), 0.5, 0.5, 0.85));

    hud = document.getElementById('worldhud');
    buildHUD();
    // poblado: aldeas KayKit + ambiente (town.js); si no, fallback a cajas (mobs.js)
    if (window.Town) Town.build(THREE, scene, nations);
    else if (window.Mobs) Mobs.buildEnvironment(THREE, scene, nations);
    // criaturas/jefes a cazar
    if (window.Mobs) Mobs.preload(THREE).then(() => { Mobs.populate(THREE, scene, nations); if (Mobs.setPlayerLevel) Mobs.setPlayerLevel(level); });
    // apuntado (raycaster) + anillo del objetivo fijado
    raycaster = new THREE.Raycaster();
    ndc = new THREE.Vector2();
    lockRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 30), new THREE.MeshBasicMaterial({ color:0xff5a5a, transparent:true, opacity:0.85, side:THREE.DoubleSide }));
    lockRing.rotation.x = -Math.PI/2; lockRing.visible = false; lockRing.renderOrder = 2; scene.add(lockRing);
    canvasEl.addEventListener('contextmenu', e => e.preventDefault());
    panelEl = document.getElementById('world-panel');
    marketEl = document.getElementById('world-market');
    bindInput();
  }

  // ---- terreno procedural con relieve (DETERMINISTA: mismo para todos los clientes) ----
  function thash(ix, iz){ let h = (ix|0)*374761393 + (iz|0)*668265263; h = (h ^ (h>>>13)) >>> 0; h = (h * 1274126177) >>> 0; return ((h ^ (h>>>16)) >>> 0) / 4294967296; }
  function tnoise(x, z){ const xi=Math.floor(x), zi=Math.floor(z), xf=x-xi, zf=z-zi;
    const a=thash(xi,zi), b=thash(xi+1,zi), c=thash(xi,zi+1), d=thash(xi+1,zi+1);
    const u=xf*xf*(3-2*xf), v=zf*zf*(3-2*zf);
    return a*(1-u)*(1-v) + b*u*(1-v) + c*(1-u)*v + d*u*v; }
  function tfbm(x, z){ let s=0, amp=1, f=1; for (let o=0;o<4;o++){ s+=tnoise(x*f, z*f)*amp; f*=2; amp*=0.5; } return s/1.875; }
  const sstep = (a,b,x) => { const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };
  function terrainHeight(x, z){
    const r = Math.hypot(x, z);
    let flat = sstep(0, 30, r);                                          // aplana la plaza central
    for (const n of nations){ flat = Math.min(flat, sstep(0, 30, Math.hypot(x - n.x, z - n.z))); }   // y cada Nación (pueblos planos)
    const hills = (tfbm(x*0.015 + 9, z*0.015 + 9) - 0.5) * 13 * flat;    // colinas entre zonas
    const mtn = Math.pow(tfbm(x*0.0055, z*0.0055), 1.4) * 95 * sstep(148, 330, r);   // cordillera en el horizonte
    return hills + mtn;
  }
  function buildTerrain(){
    const SIZE = 1000, SEG = 168;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    const p = geo.attributes.position, cols = new Float32Array(p.count*3);
    const cLow=new THREE.Color(0x232a20), cMid=new THREE.Color(0x3a3c30), cRock=new THREE.Color(0x57545f), cSnow=new THREE.Color(0xccd5e2), tmp=new THREE.Color();
    for (let i=0;i<p.count;i++){
      const h = terrainHeight(p.getX(i), -p.getY(i)); p.setZ(i, h);      // plano XY → world (x, h, -y)
      const t = Math.max(0, Math.min(1, h/60));
      if (t < 0.5) tmp.copy(cLow).lerp(cMid, t/0.5);
      else if (t < 0.8) tmp.copy(cMid).lerp(cRock, (t-0.5)/0.3);
      else tmp.copy(cRock).lerp(cSnow, (t-0.8)/0.2);
      cols[i*3]=tmp.r; cols[i*3+1]=tmp.g; cols[i*3+2]=tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors:true, roughness:1, metalness:0 }));
    m.rotation.x = -Math.PI/2; scene.add(m);
    return m;
  }

  function buildWorld(){
    nations = CHARACTERS.map((c, i) => { const ang = (i/CHARACTERS.length)*Math.PI*2; const R = 110; return { name:c.nation, element:c.element, heroId:c.id, x:Math.cos(ang)*R, z:Math.sin(ang)*R }; });
    ground = buildTerrain();
    window.__terrainH = terrainHeight;   // los mobs (mobs.js) la usan para seguir el relieve
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(18, 48), new THREE.MeshStandardMaterial({ color:0x2a2f3e, roughness:1 }));
    plaza.rotation.x = -Math.PI/2; plaza.position.y = 0.04; scene.add(plaza);

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
    });
  }

  // construye un combatiente (jugador o remoto) con modelo glTF si está
  // disponible, o el constructor de cajas como fallback.
  function buildFighter(char){
    let model = null, g;
    if (gltfOK && window.HeroGLTF){
      try { model = window.HeroGLTF.buildHeroGLTF(THREE, char); g = model.group; }
      catch(e){ console.warn('[world3d] buildHeroGLTF falló; cajas para', char.id, e); model = null; }
    }
    if (!g) g = buildHero3D(THREE, char);
    g.traverse(o => { if (o.isMesh || o.isSkinnedMesh){ o.castShadow = true; o.receiveShadow = true; } });
    const f = { group:g, model };
    if (!model){ f.parts = g.userData.parts; f.headBaseY = g.userData.parts.head.userData.baseY; f.walkPhase = 0; }
    return f;
  }
  function setLocalHero(char){
    if (player){ if (player.model) player.model.dispose(); scene.remove(player.group); }
    const f = buildFighter(char);
    const fb = forgeBonus();
    const maxHp = Math.round(char.stats.maxHp * (1 + (level-1)*0.08)) + fb.hp;   // sube con el nivel y la armadura
    const maxChakra = (char.stats.maxChakra||100) + fb.chakra;
    player = Object.assign({
      hero:char.id, targetFacing:Math.PI,
      maxHp, hp:maxHp, maxChakra, chakra:maxChakra,
      cooldowns:{}, cdTotal:{}, buff:null, buffDef:null, shield:0, dead:false, respawn:0, hitFlash:0,
    }, f);
    lockedMob = null;
    const sp = spawnPoint(); player.targetFacing = sp.ry;
    f.group.position.set(sp.x, 0, sp.z); f.group.rotation.y = sp.ry; scene.add(f.group);
    buildSkillBar(); updateGearVisual();
  }

  // ---------------- red ----------------
  function connectNet(char){
    myName = (window.Account && Account.name && Account.active && Account.active()) ? Account.name() : (localStorage.getItem('mp_name') || '').trim();
    if (!myName){ myName = char.name + '-' + Math.floor(Math.random()*9000+1000); try{ localStorage.setItem('mp_name', myName); }catch(e){} }
    statusTxt = 'Conectando…'; playerCount = 1;
    Net.connect(myName, char.id, clan, {
      welcome:(m)=>{ statusTxt='Conectado'; playerCount = 1 + (m.players?m.players.length:0); (m.players||[]).forEach(addRemote); pushSave(); if (window.Mobs && Mobs.setBossReporter) Mobs.setBossReporter(bossReport); },
      join:(p)=>{ addRemote(p); playerCount++; chatLog('➕ ' + plabel(p) + ' entró al mundo'); },
      state:(m)=>{ const r=remote.get(m.id); if (r){ r.tx=m.x; r.tz=m.z; r.try=m.ry; r.moving=(m.anim==='walk'); if (m.pvp!=null) r.pvp=!!m.pvp; if (m.hp!=null) r.hp=m.hp; if (m.mhp!=null) r.maxHp=m.mhp; } },
      leave:(id)=>{ const r=remote.get(id); if (r){ if (lockedMob===r) lockedMob=null; if (r.model) r.model.dispose(); scene.remove(r.group); scene.remove(r.nameSprite); remote.delete(id); playerCount=Math.max(1,playerCount-1); } },
      chat:(m)=>{ chatLog('💬 ' + plabel(m) + ': ' + m.text); },   // [clan] nombre: texto
      party:(m)=>{ onParty(m); },
      clan:(m)=>{ const r = remote.get(m.id); if (r){ r.clan = m.clan; refreshNameplate(r); } },
      save:(m)=>{ applyServerSave(m.save); },   // Fase 6: sync de cuenta desde el servidor (gana el más reciente)
      boss:(m)=>{ serverBosses[m.el] = { hp:m.hp, maxHp:m.maxHp, dead:m.dead }; },
      bosses:(m)=>{ (m.list||[]).forEach(b => serverBosses[b.el] = { hp:b.hp, maxHp:b.maxHp, dead:b.dead }); },
      bossdead:(m)=>{ onBossDead(m); },
      pvphit:(m)=>{ if (pvpOn && player && !player.dead) damagePlayer(m.dmg||0); },
      authfail:(m)=>{ statusTxt='Nombre en uso'; toast('⚠ Ese nombre ya está en uso por otro jugador. Tu progreso no se cargó (identidad).'); },
      marketCatalog:(m)=>{ marketCatalog = m.listings || []; renderMarket(); },
      marketCreated:(m)=>{ applyMarketEconomy(null, m.mats, m.forge); toast('✦ Publicado en el mercado'); Net.send({ t:'market:list' }); },
      marketBought:(m)=>{ applyMarketEconomy(m.gold, m.mats, m.forge); toast('🛒 Compraste ' + (m.kind==='gear' ? m.name : (m.qty + '× ' + m.name)) + ' por ' + m.total + ' oro'); Net.send({ t:'market:list' }); },
      marketSold:(m)=>{ if (m.gold != null) applyMarketEconomy(m.gold, null); toast('💰 Vendiste ' + m.qty + '× ' + m.name + ' por ' + m.total + ' oro'); },
      marketCancelled:(m)=>{ applyMarketEconomy(null, m.mats, m.forge); toast('Listado cancelado'); Net.send({ t:'market:list' }); },
      marketReceipts:(m)=>{ const s = m.sales || []; if (s.length){ const tot = s.reduce((a,r)=>a+r.total,0); marketReceipts = s; toast('🧾 ' + s.length + ' venta(s) mientras no estabas: +' + tot + ' oro'); } },
      marketErr:(m)=>{ toast('✗ Mercado: ' + (m.msg || m.code || 'error')); },
      close:()=>{ statusTxt='Desconectado'; if (window.Mobs && Mobs.setBossReporter) Mobs.setBossReporter(null); },
      error:()=>{ statusTxt='Sin conexión'; if (window.Mobs && Mobs.setBossReporter) Mobs.setBossReporter(null); },
    }, (window.Account && Account.secret) ? Account.secret() : '');
  }
  // aplica oro/materiales/equipo autoritativos del mercado (directo, sin el guard de timestamp)
  function applyMarketEconomy(gold, mats, forgeObj){
    const c = (window.Account && Account.active) ? Account.active() : null;
    if (forgeObj){ forge.weapon = forgeObj.weapon||0; forge.armor = forgeObj.armor||0; forge.amulet = forgeObj.amulet||0; }
    if (c){
      if (gold != null) c.gold = gold;
      if (mats) c.mats = mats;
      if (forgeObj) c.forge = { weapon:forge.weapon, armor:forge.armor, amulet:forge.amulet };
      c.updated = Date.now();
      if (window.Mobs && Mobs.bindLoot) Mobs.bindLoot(c);
      if (Account.save) Account.save();
    } else if (window.Mobs && Mobs.setLoot){
      const L = Mobs.getLoot();
      Mobs.setLoot({ gold: gold != null ? gold : L.gold, kills:L.kills, mats: mats || L.mats });
    }
    if (forgeObj){ saveForge(); recomputeVitals(); updateGearVisual(); }   // refleja el cambio de equipo (stats + visual)
  }
  function reconnect(char){ Net.disconnect(); remote.forEach(r=>{ if (r.model) r.model.dispose(); scene.remove(r.group); scene.remove(r.nameSprite); }); remote.clear(); connectNet(char); }
  function addRemote(p){
    if (remote.has(p.id)) return;
    const ch = CHARACTERS.find(c => c.id === p.hero) || CHARACTERS[0];
    const f = buildFighter(ch);
    f.group.position.set(p.x||0, 0, p.z||0); f.group.rotation.y = p.ry||0; scene.add(f.group);
    const nameSprite = makeTextSprite(plabel(p), p.clan?'#ffe08a':'#cde3ff', null); nameSprite.scale.set(3.6, 0.9, 1); nameSprite.position.set(f.group.position.x, 3.4, f.group.position.z); scene.add(nameSprite);
    remote.set(p.id, Object.assign({ id:p.id, name:p.name, clan:p.clan, hero:p.hero, tx:p.x||0, tz:p.z||0, try:p.ry||0, nameSprite, moving:false }, f, { isPlayer:true, pvp:!!p.pvp, hp:p.hp||100, maxHp:p.mhp||100 }));
  }
  // re-genera la placa de nombre de un jugador remoto (al cambiar de clan, sin reconectar)
  function refreshNameplate(r){
    if (!r || !r.group) return;
    if (r.nameSprite){ scene.remove(r.nameSprite); const mt = r.nameSprite.material; if (mt){ if (mt.map) mt.map.dispose(); mt.dispose(); } }
    const s = makeTextSprite(plabel(r), r.clan ? '#ffe08a' : '#cde3ff', null);
    s.scale.set(3.6, 0.9, 1); s.position.set(r.group.position.x, 3.4, r.group.position.z); scene.add(s); r.nameSprite = s;
  }

  // ---------------- grupo (party) ----------------
  function onParty(m){
    if (m.a === 'invite'){ pendingInvite = { from:m.from, name:m.name }; toast('🎉 ' + (m.name||'Alguien') + ' te invitó a un grupo · pulsa P para aceptar'); }
    else if (m.a === 'members'){ myParty = m.list || []; pendingInvite = null; updatePartyHUD(); chatLog(myParty.length > 1 ? ('👥 Grupo: ' + myParty.map(p=>p.name).join(', ')) : '👥 Grupo deshecho'); }
    else if (m.a === 'xp'){ if (typeof m.amount === 'number') gainXP(m.amount); }
  }
  function nearestRemote(){
    if (!player) return null; let best = null, bd = Infinity;
    remote.forEach((r, id) => { const dx = r.group.position.x - player.group.position.x, dz = r.group.position.z - player.group.position.z, d = dx*dx + dz*dz; if (d < bd){ bd = d; best = { id, name:r.name }; } });
    return best;
  }
  function partyKey(){
    const online = window.Net && Net.connected && Net.connected();
    if (!online){ toast('El grupo necesita estar conectado al servidor'); return; }
    if (pendingInvite){ Net.send({ t:'party', a:'accept', to:pendingInvite.from }); toast('✅ Te uniste al grupo'); pendingInvite = null; }
    else { const r = nearestRemote(); if (r){ Net.send({ t:'party', a:'invite', to:r.id }); toast('📨 Invitación de grupo enviada a ' + (r.name||'jugador')); } else toast('No hay otro jugador cerca para invitar'); }
  }
  function updatePartyHUD(){
    if (!hud || !hud._party) return;
    if (myParty && myParty.length > 1){
      hud._party.innerHTML = '👥 ' + myParty.map(p=>esc(p.name)).join(' · ') + ' <button class="w-party-x" id="w-party-x" title="Salir del grupo">✕ salir</button>';
      const x = document.getElementById('w-party-x'); if (x) x.onclick = leavePartyNow;
    } else hud._party.innerHTML = '';
  }
  function leavePartyNow(){
    if (!(myParty && myParty.length > 1)) return;
    if (window.Net && Net.connected && Net.connected()) Net.send({ t:'party', a:'leave' });
    myParty = []; updatePartyHUD(); toast('👋 Saliste del grupo');
  }

  // ---------------- Jefes compartidos (autoritativos en el servidor) ----------------
  function bossReport(mob, dmg){ if (window.Net && Net.connected && Net.connected()) Net.send({ t:'bosshit', el:mob.el, dmg:dmg }); contributedBosses.add(mob.el); }
  function onBossDead(m){
    const mx = serverBosses[m.el] ? serverBosses[m.el].maxHp : 900;
    serverBosses[m.el] = { hp:0, maxHp:mx, dead:true };
    chatLog('☠ ' + (m.by || 'Alguien') + ' selló al Dios de ' + m.el + '!');   // anuncio global en el chat
    if (contributedBosses.has(m.el)){
      const r = (window.Mobs && Mobs.grantBossLoot) ? Mobs.grantBossLoot(m.el) : null;
      gainXP(250); contributedBosses.delete(m.el);
      toast('🏆 ¡Sellaste al Dios de ' + m.el + '!  +250 XP' + (r && r.mat ? '  ·  🎁 ' + r.mat : '') + '  ·  +120 oro');
    } else {
      toast('☠ ' + (m.by || 'Alguien') + ' selló al Dios de ' + m.el);
    }
  }

  // ---------------- cuenta (guardado en servidor) + chat + clan ----------------
  function plabel(p){ return (p && p.clan ? '['+p.clan+'] ' : '') + ((p && p.name) || 'Jugador'); }
  function esc(s){ return ('' + s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function gatherSave(){
    const L = (window.Mobs && Mobs.getLoot) ? Mobs.getLoot() : { gold:0, kills:0, mats:{} };
    const c = (window.Account && Account.active) ? Account.active() : null;
    return { level, xp, forge:{ weapon:forge.weapon, armor:forge.armor, amulet:forge.amulet }, clan, gold:L.gold, kills:L.kills, mats:L.mats, ts:(c && c.updated) || 0 };
  }
  function pushSave(){ if (window.Net && Net.connected && Net.connected()) Net.send({ t:'save', save:gatherSave() }); }
  // Fase 6: el servidor es la copia de la cuenta entre dispositivos. Aplica su save
  // SOLO si es más reciente (timestamp) que el local; si no, el local manda.
  function applyServerSave(s){
    if (!s || typeof s !== 'object') return;
    const c = (window.Account && Account.active) ? Account.active() : null;
    if (c && typeof s.ts === 'number' && typeof c.updated === 'number' && s.ts <= c.updated) return;  // local más nuevo: no pisar
    if (typeof s.level === 'number') level = Math.max(1, s.level);
    if (typeof s.xp === 'number') xp = Math.max(0, s.xp);
    if (s.forge){ forge.weapon = s.forge.weapon||0; forge.armor = s.forge.armor||0; forge.amulet = s.forge.amulet||0; }
    if (s.clan != null){ clan = ('' + s.clan).slice(0,8); try{ localStorage.setItem('el_clan', clan); }catch(e){} }
    if (c){
      c.level = level; c.xp = xp; c.clan = clan; c.forge = forge;
      if (s.gold != null) c.gold = s.gold;
      if (s.kills != null) c.kills = s.kills;
      if (s.mats) c.mats = s.mats;
      c.updated = s.ts || Date.now();
      if (window.Mobs && Mobs.bindLoot) Mobs.bindLoot(c);
      if (Account.save) Account.save();
    } else {
      if (window.Mobs && Mobs.setLoot && (s.gold != null || s.mats)) Mobs.setLoot({ gold:s.gold||0, kills:s.kills||0, mats:s.mats||{} });
      saveProgress(); saveForge();
    }
    recomputeVitals(); updateGearVisual();
    if (panelOpen) buildPanel();
    toast('☁ Cuenta sincronizada desde el servidor · Nv ' + level);
  }
  function setClan(v){
    clan = ('' + (v||'')).replace(/[^\w]/g,'').slice(0,8);
    try{ localStorage.setItem('el_clan', clan); }catch(e){}
    pushSave();
    if (window.Net && Net.connected && Net.connected()) Net.send({ t:'clan', clan:clan });   // re-anuncia sin reconectar (no spamea "entró")
    toast(clan ? ('🛡 Clan: [' + clan + ']') : 'Clan quitado');
  }
  function chatLog(line){
    chatLines.push(line); if (chatLines.length > 7) chatLines.shift();
    if (chatEl) chatEl.innerHTML = chatLines.map(l => '<div>' + esc(l) + '</div>').join('');
  }
  function sendChat(text){
    text = ('' + text).trim().slice(0, 120); if (!text) return;
    if (window.Net && Net.connected && Net.connected()) Net.send({ t:'chat', text:text });   // el servidor me lo reenvía → eco único
    else chatLog('💬 ' + (clan ? '['+clan+'] ' : '') + myName + ': ' + text);                  // sin servidor: eco local
  }
  function chatting(){ return chatInput && document.activeElement === chatInput; }
  // aura visible que crece con la Forja (dorada al alcanzar equipo divino)
  function updateGearVisual(){
    if (!player || !player.model || !player.model.aura || !THREE) return;
    const total = forge.weapon + forge.armor + forge.amulet;
    const ch = heroDef();
    if (forge.weapon >= 15){
      // +15 Amaterasu: el aura que te rodea al caminar se vuelve OSCURA (luz negativa = resta luz)
      player.model.aura.color = new THREE.Color(0xffffff);
      player.model.aura.intensity = -1.5;
    } else {
      player.model.aura.intensity = 0.5 + total * 0.16;
      const divine = forge.weapon > 10 || forge.armor > 10 || forge.amulet > 10;
      const col = divine ? 0xffd86b : (ch && ELEMENT_META[ch.element] ? new THREE.Color(ELEMENT_META[ch.element].color).getHex() : 0xffffff);
      player.model.aura.color = new THREE.Color(col);
    }
    if (player.model.setWeaponLevel) player.model.setWeaponLevel(forge.weapon);   // arma + flamas por tier (negras en +15)
    if (player.model.setArmorLevel) player.model.setArmorLevel(forge.armor);      // armadura negra en +15
  }

  // ---------------- ayudante de consola (dev) ----------------
  // En el navegador: EL.setWeapon(15) para ver el brillo del arma a cualquier nivel.
  window.EL = window.EL || {};
  window.EL.setWeapon = function(n){
    n = Math.max(0, Math.min(15, n|0));
    forge.weapon = n;
    if (window.Account && Account.active && Account.active()){ Account.active().forge.weapon = n; Account.save(); }
    updateGearVisual();
    return (player && player.model) ? ('Arma en +' + n + ' — guardado en tu personaje') : 'Entra al Mundo primero, luego EL.setWeapon(' + n + ')';
  };
  window.EL.tp = function(x, z){   // teleport (útil para recorrer el mundo grande / probar zonas)
    if (!player) return 'entra al Mundo'; player.group.position.set(+x||0, 0, +z||0);
    return 'tp a ' + Math.round(+x||0) + ',' + Math.round(+z||0);
  };
  window.EL.setTime = function(t){   // 0=medianoche, 0.3=amanecer, 0.5=mediodía, 0.7=atardecer, 0.8=anochecer
    if (!dn) return 'sin ciclo'; dn.t = ((+t)||0) % 1; if (dn.t < 0) dn.t += 1; updateDayNight(0);
    return 'hora del día = ' + dn.t.toFixed(2);
  };
  window.EL.weaponDump = function(){
    if (!player || !player.model || !player.model.root) return 'sin modelo glTF (¿cajas de respaldo?)';
    const info = { hasSetWeapon: !!player.model.setWeaponLevel, weaponCount: player.model.weaponCount, forgeWeapon: forge.weapon, weapons: [] };
    player.model.root.traverse(o => { if ((o.isMesh || o.isSkinnedMesh) && /sword|axe|staff|dagger|knife|wand|mace|hammer|spear|blade|bow/i.test(o.name||'') && !/shield|book|mug|throw|quiver/i.test(o.name||'')){
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      info.weapons.push({ name:o.name, visible:o.visible, cloned:!!o.userData._wmat, type:m && m.type, hasEmissive:m && ('emissive' in m), emissive:m && m.emissive && m.emissive.getHexString(), ei:m && m.emissiveIntensity, emissiveMap:!!(m && m.emissiveMap) });
    }});
    return info;
  };
  window.EL.forge = function(weapon, armor, amulet){
    if (weapon!=null) forge.weapon = Math.max(0,Math.min(15,weapon|0));
    if (armor!=null)  forge.armor  = Math.max(0,Math.min(15,armor|0));
    if (amulet!=null) forge.amulet = Math.max(0,Math.min(15,amulet|0));
    if (window.Account && Account.active && Account.active()){ Account.active().forge = { weapon:forge.weapon, armor:forge.armor, amulet:forge.amulet }; Account.save(); }
    recomputeVitals(); updateGearVisual();
    return 'Forja: arma +'+forge.weapon+' · armadura +'+forge.armor+' · amuleto +'+forge.amulet;
  };

  // ---------------- entrada ----------------
  function bindInput(){
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
    canvasEl.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
    canvasEl.addEventListener('wheel', onWheel, { passive:false });
    document.addEventListener('pointerlockchange', onPLChange);
  }
  function onPLChange(){
    pointerLocked = (document.pointerLockElement === canvasEl);
    if (hud) hud.classList.toggle('lookcam', pointerLocked);   // muestra el punto de mira al centro
    if (ndc){ ndc.x = 0; ndc.y = 0; }                          // al fijar el mouse, el "cursor" pasa a ser el centro
  }
  function onKey(e){
    if (!active) return;
    const k = e.key.toLowerCase(); keys.add(k);
    if (k === 'enter'){ if (document.exitPointerLock) document.exitPointerLock(); if (chatInput){ chatInput.focus(); e.preventDefault(); } return; }   // abrir chat (suelta la cámara)
    if (k === 'i'){ togglePanel(); }
    else if (k === 'm'){ toggleMarket(); }
    else if (k === 'escape'){ if (pointerLocked && document.exitPointerLock) document.exitPointerLock(); else if (panelOpen) togglePanel(); else if (marketOpen) toggleMarket(); else lockedMob = null; }
    else if (player && !player.dead && !panelOpen){
      if (k === '1') castSkill(0); else if (k === '2') castSkill(1);
      else if (k === '3') castSkill(2); else if (k === '4') castSkill(3);
      else if (k === 'tab'){ cycleLock(); }
      else if (k === 'p'){ partyKey(); }
      else if (k === 'k'){ togglePvp(); }
      else if (k === 'g'){ toggleSoulshots(); }
    }
    if (['arrowup','arrowdown','arrowleft','arrowright',' ','tab'].includes(k)) e.preventDefault();
  }
  function onKeyUp(e){ keys.delete(e.key.toLowerCase()); }
  function onDown(e){
    if (!active) return;
    const usable = player && !player.dead && !panelOpen && !chatting();
    if (!pointerLocked && !panelOpen && !chatting() && canvasEl.requestPointerLock){ try { canvasEl.requestPointerLock(); } catch(_){} }   // cualquier clic "toma" la cámara (mouse-look)
    if (e.button === 2){ if (usable) cycleLock(); return; }   // clic DERECHO → fijar objetivo (como Tab)
    if (e.button === 0){ if (usable) castSkill(0); }          // clic IZQUIERDO → golpe (skill 1, como el botón 1)
  }
  function onMove(e){
    if (pointerLocked){   // mouse-look: el movimiento del mouse gira la cámara (como girar la cabeza)
      camYaw -= (e.movementX||0) * 0.0026;
      camPitch = Math.max(0.06, Math.min(1.3, camPitch + (e.movementY||0) * 0.0022));
      return;
    }
    if (ndc && canvasEl){ const r = canvasEl.getBoundingClientRect(); ndc.x = ((e.clientX-r.left)/r.width)*2-1; ndc.y = -((e.clientY-r.top)/r.height)*2+1; }
  }
  function onUp(){ dragging=false; }
  function pickMobAtCursor(){
    if (!raycaster || !ndc || !window.Mobs || !Mobs.pick) return null;
    raycaster.setFromCamera(ndc, camera); return Mobs.pick(raycaster);
  }

  // ---------------- combate del Mundo ----------------
  const WU = 0.03;   // factor: rangos de las skills (px) -> unidades del mundo
  function heroDef(){ return CHARACTERS.find(c => c.id === player.hero); }
  // fija/cicla el objetivo más cercano dentro de un buen rango (estilo L2)
  function cycleLock(){
    const px=player.group.position.x, pz=player.group.position.z;
    const d2 = o => (o.group.position.x-px)**2 + (o.group.position.z-pz)**2;
    let players = [];
    if (pvpOn){ remote.forEach(r => { if (r.pvp && r.group && d2(r) <= 35*35) players.push(r); }); players.sort((a,b)=>d2(a)-d2(b)); }
    let beasts = (window.Mobs && Mobs.targetsNear) ? Mobs.targetsNear(player.group.position, 35).slice() : [];
    beasts.sort((a,b)=>d2(a)-d2(b));
    const list = players.concat(beasts);   // jugadores (PvP) primero, luego bestias → Tab prioriza al enemigo
    if (!list.length) return;
    if (!lockedMob || lockedMob.dead || list.indexOf(lockedMob) < 0){ lockedMob = list[0]; return; }
    lockedMob = list[(list.indexOf(lockedMob) + 1) % list.length];   // cicla al siguiente
  }
  // PvP activable: alterna tu bandera y la anuncia al instante
  function togglePvp(){
    pvpOn = !pvpOn;
    if (!pvpOn && lockedMob && lockedMob.isPlayer) lockedMob = null;   // suelta el objetivo-jugador al desactivar
    if (hud && hud._pvp) hud._pvp.hidden = !pvpOn;
    if (window.Net && Net.connected && Net.connected()) Net.send({ t:'state', x:player.group.position.x, y:0, z:player.group.position.z, ry:player.group.rotation.y, nation:curNation, anim:'idle', pvp:pvpOn, hp:Math.round(player.hp), mhp:Math.round(player.maxHp) });
    toast(pvpOn ? '⚔ PvP ACTIVADO — Tab fija a otros jugadores con PvP; cuídate, también te pueden atacar' : '🛡 PvP desactivado — a salvo de otros jugadores');
  }
  // aparición inicial: al borde de la 1ª Nación (para tener combate cerca)
  function spawnPoint(){
    const n = (nations && nations.length) ? nations[0] : { x:0, z:0 };
    const x = n.x - 9, z = n.z;
    return { x, z, ry: Math.atan2(n.x - x, n.z - z) };
  }
  function aimDir(){
    if (lockedMob && !lockedMob.dead){ const dx=lockedMob.group.position.x-player.group.position.x, dz=lockedMob.group.position.z-player.group.position.z, d=Math.hypot(dx,dz)||1; return { x:dx/d, z:dz/d }; }
    return { x:Math.sin(player.group.rotation.y), z:Math.cos(player.group.rotation.y) };
  }
  // ataque básico automático contra el objetivo fijado (estilo L2)
  function updateAutoAttack(dt){
    if (player.dead || !lockedMob || lockedMob.dead) return;
    const dx = lockedMob.group.position.x - player.group.position.x, dz = lockedMob.group.position.z - player.group.position.z, d = Math.hypot(dx,dz);
    if (d <= (lockedMob.isBoss ? 4.6 : 3.2)){
      player.targetFacing = Math.atan2(dx, dz);
      atkTimer -= dt;
      if (atkTimer <= 0){ const ch = heroDef(); atkTimer = 1 / ((ch && ch.stats.attackSpeed) || 1); basicHit(lockedMob); }
    }
  }
  // Esquirlas de Combate (soulshots): gastan oro por golpe a cambio de +daño
  const SS_MULT = 1.6, SS_COST_HIT = 4, SS_COST_SKILL = 8;
  function consumeSoulshot(cost){
    if (!soulshots) return 1;
    const L = (window.Mobs && Mobs.getLoot) ? Mobs.getLoot() : null;
    if (!L || L.gold < cost){ soulshots = false; toast('✦ Sin oro — Esquirlas agotadas, daño base'); return 1; }
    if (window.Mobs && Mobs.spend) Mobs.spend({}, cost);
    return SS_MULT;
  }
  function toggleSoulshots(){
    const L = (window.Mobs && Mobs.getLoot) ? Mobs.getLoot() : null;
    if (!soulshots && (!L || L.gold < SS_COST_HIT)){ toast('✦ Necesitas oro para usar Esquirlas de Combate'); return; }
    soulshots = !soulshots;
    toast(soulshots ? '✦ Esquirlas de Combate ACTIVADAS (+60% daño, gasta oro/golpe)' : '✦ Esquirlas desactivadas');
  }
  function basicHit(m){
    const ch = heroDef();
    let dmg = ((ch ? ch.stats.power : 15) + forgeBonus().power) * 0.7 * (1 + (level-1)*0.12);
    if (player.buff) dmg *= (1 + player.buff.amt);
    dmg *= consumeSoulshot(SS_COST_HIT);   // soulshots: +daño gastando oro
    dmg *= passiveDmgMult();               // Furia de Sangre (poca vida → +daño)
    if (player.model) player.model.playOnce('attack');
    if (m.isPlayer){   // PvP: el objetivo aplica el daño (el server valida que ambos tengan PvP)
      if (window.Net && Net.connected && Net.connected()) Net.send({ t:'pvphit', to:m.id, dmg:Math.round(dmg) });
      floatWorldText(m.group.position, '-'+Math.round(dmg), '#ff9a3c');
    } else {
      const wet = !!(ch && ch.passive && ch.passive.id === 'aliento_leviatan');   // Humedad: el objetivo recibe +12% un tiempo
      Mobs.damageMob(m, dmg, { element: ch ? ch.element : null, wet });
    }
  }
  function castSkill(i){
    const ch = heroDef(); if (!ch) return;
    const sk = ch.skills[i]; if (!sk) return;
    if ((player.cooldowns[sk.key]||0) > 0) return;
    if (player.chakra < (sk.cost||0)){ toast('Sin Chakra'); return; }
    player.chakra -= (sk.cost||0);
    let cd = sk.cooldown; if (i === 0) cd /= (ch.stats.attackSpeed||1);
    player.cooldowns[sk.key] = cd; player.cdTotal[sk.key] = cd;
    if ((sk.cost||0) === 0) player.chakra = Math.min(player.maxChakra, player.chakra + 5);
    executeWorldSkill(sk, ch);
  }
  function executeWorldSkill(sk, ch){
    const el = sk.element || ch.element;
    const aim = aimDir();
    player.targetFacing = Math.atan2(aim.x, aim.z);
    if (player.model) player.model.playOnce('attack');
    const power = (ch.stats.power + forgeBonus().power) * (player.buff ? (1 + player.buff.amt) : 1) * passiveDmgMult();
    if (sk.dash){ const dd = sk.dash.distance * WU; player.group.position.x += aim.x*dd; player.group.position.z += aim.z*dd; spawnRing(player.group.position, 1.4, '#ffffff'); }
    if (sk.offense){
      const o = sk.offense, dmg = power * (o.mult||1) * consumeSoulshot(SS_COST_SKILL);   // soulshots también potencian skills
      if (o.shape === 'projectile' || o.shape === 'line'){
        spawnProjectile(aim, el, dmg, o);
      } else if (o.shape === 'nuke'){
        const tp = (lockedMob && !lockedMob.dead) ? lockedMob.group.position.clone() : new THREE.Vector3(player.group.position.x+aim.x*8, 0, player.group.position.z+aim.z*8);
        spawnStrike(tp, (o.radius||150)*WU, el, dmg, o, o.delay||0.6);
      } else {
        const r = ((o.shape === 'melee' ? (o.range||80) : (o.radius||100)) * WU) + 1.0;
        const cx = (o.shape === 'circle') ? player.group.position.x : player.group.position.x + aim.x*r*0.5;
        const cz = (o.shape === 'circle') ? player.group.position.z : player.group.position.z + aim.z*r*0.5;
        spawnRing({ x:cx, z:cz }, r, ELEMENT_META[el].glow);
        for (const m of Mobs.mobsInRadius({ x:cx, z:cz }, r)){
          if (o.shape === 'cone'){ const dx=m.group.position.x-player.group.position.x, dz=m.group.position.z-player.group.position.z, dd=Math.hypot(dx,dz)||1; if ((dx/dd*aim.x + dz/dd*aim.z) < 0.2) continue; }
          Mobs.damageMob(m, dmg, { element:el, effects:o.effects||[], from:player.group.position });
        }
      }
    }
    if (sk.self) applySelfWorld(sk.self, ch);
    if (sk.zone) spawnZoneWorld(sk.zone, ch, aim);
  }
  function applySelfWorld(list, ch){
    for (const s of list){
      if (s.kind === 'heal'){ const a = s.amount * (ch.stats.healPower||1); player.hp = Math.min(player.maxHp, player.hp + a); floatWorldText(player.group.position, '+'+Math.round(a), '#7CFF6B'); if (ch.passive && ch.passive.id === 'savia_sello') player.shield = (player.shield||0) + a*0.3; }
      else if (s.kind === 'shield'){ player.shield = (player.shield||0) + s.amount; floatWorldText(player.group.position, '🛡 escudo', '#9fd0ff'); }
      else if (s.kind === 'buffDamage'){ player.buff = { amt:s.amt, t:s.dur }; floatWorldText(player.group.position, '⬆ furia', '#ff9a3c'); }
      else if (s.kind === 'defense'){ player.buffDef = { amt:s.amt, t:s.dur }; }
    }
  }
  function spawnProjectile(aim, el, dmg, o){
    const m = new THREE.Mesh(new THREE.SphereGeometry(o.width ? o.width*WU*1.2 : 0.3, 10, 10), new THREE.MeshStandardMaterial({ color:ELEMENT_META[el].color, emissive:ELEMENT_META[el].glow, emissiveIntensity:1.2 }));
    m.position.set(player.group.position.x + aim.x*0.8, 1.2, player.group.position.z + aim.z*0.8); scene.add(m);
    projectiles.push({ mesh:m, dx:aim.x, dz:aim.z, speed:(o.speed||540)*WU*1.1, range:(o.range||500)*WU, traveled:0, el, dmg, effects:o.effects||[], pierce:!!o.pierce, hit:new Set() });
  }
  function spawnStrike(pos, r, el, dmg, o, delay){
    const m = new THREE.Mesh(new THREE.RingGeometry(r*0.85, r, 28), new THREE.MeshBasicMaterial({ color:ELEMENT_META[el].glow, transparent:true, opacity:0.5, side:THREE.DoubleSide }));
    m.position.set(pos.x, 0.06, pos.z); m.rotation.x = -Math.PI/2; scene.add(m);
    strikes.push({ mesh:m, t:delay, r, el, dmg, effects:o.effects||[], pos:new THREE.Vector3(pos.x, 0, pos.z) });
  }
  function spawnRing(p, r, color){
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 8, 24), new THREE.MeshBasicMaterial({ color, transparent:true }));
    m.position.set(p.x, 0.3, p.z); m.rotation.x = -Math.PI/2; scene.add(m);
    rings.push({ mesh:m, t:0.35, maxT:0.35 });
  }
  function spawnZoneWorld(z, ch, aim){
    let px = player.group.position.x, pz = player.group.position.z;
    if (z.placement === 'mouse'){ if (lockedMob && !lockedMob.dead){ px = lockedMob.group.position.x; pz = lockedMob.group.position.z; } else { px += aim.x*6; pz += aim.z*6; } }
    const r = (z.radius||100)*WU + 0.6;
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color:ELEMENT_META[z.element].color, transparent:true, opacity:0.22, side:THREE.DoubleSide }));
    m.rotation.x = -Math.PI/2; m.position.set(px, 0.05, pz); scene.add(m);
    zones.push({ mesh:m, t:z.dur, interval:z.interval||0.5, acc:0, el:z.element, perTick:z.perTick||0, healPerTick:z.healPerTick||0, chakraPerTick:z.chakraPerTick||0, radius:r, follow:z.placement==='follow' });
  }
  function floatWorldText(pos, text, color){
    const sp = makeTextSprite(text, color, null); sp.scale.set(2.4, 0.6, 1); sp.position.set(pos.x, (pos.y||0)+2.8, pos.z); scene.add(sp); worldTexts.push({ sp, t:1, vy:1.4 });
  }
  // recibir daño / muerte / respawn
  function damagePlayer(amount){
    if (player.dead) return;
    const ch = heroDef();
    const heroArmor = (ch && ch.stats && ch.stats.armor) ? ch.stats.armor : 0;   // armadura de CLASE (estaba declarada pero sin aplicar)
    let d = amount * (1 - forgeBonus().reduce) * (1 - heroArmor);
    if (player.buffDef) d *= (1 - player.buffDef.amt);
    if (player.shield > 0){ const ab = Math.min(player.shield, d); player.shield -= ab; d -= ab; }
    player.hp -= d; player.hitFlash = 0.15;
    // pasivas que ganan Chakra al recibir daño (Piel de Roca, Furia de Sangre)
    if (ch && ch.passive && (ch.passive.id === 'piel_roca' || ch.passive.id === 'furia_sangre')) player.chakra = Math.min(player.maxChakra, player.chakra + d * 0.4);
    floatWorldText(player.group.position, '-'+Math.round(d), '#ff7b7b');   // daño REAL (tras armadura)
    if (player.hp <= 0){ player.hp = 0; killPlayer(); }
  }
  // multiplicador de daño por pasiva (Furia de Sangre: +daño con poca vida)
  function passiveDmgMult(){
    const ch = heroDef(); if (!ch || !ch.passive || !player) return 1;
    if (ch.passive.id === 'furia_sangre'){ const f = player.hp / player.maxHp; if (f < 0.15) return 1.30; if (f < 0.30) return 1.15; }
    return 1;
  }
  function killPlayer(){
    player.dead = true; player.respawn = 3.2; lockedMob = null; if (panelOpen) togglePanel();
    const lost = Math.min(xp, Math.round(xpNeeded(level) * 0.08));   // pierdes ~8% del nivel actual; NUNCA bajas de nivel
    if (lost > 0){ xp -= lost; saveAccount(); pushSave(); toast('💀 Has caído · −' + lost + ' XP · reapareces en la plaza…'); }
    else toast('💀 Has caído. Reapareces en la plaza…');
  }
  function respawnPlayer(){
    player.dead = false; player.hp = player.maxHp; player.chakra = player.maxChakra; player.shield = 0; player.buff = null; player.buffDef = null;
    player.group.position.set(0,0,6); player.group.scale.setScalar(1); player.targetFacing = Math.PI;
    if (player.model) player.model.revive();
  }
  // actualizaciones de combate por frame
  function updateProjectiles(dt){
    for (const p of projectiles){
      p.mesh.position.x += p.dx*p.speed*dt; p.mesh.position.z += p.dz*p.speed*dt; p.traveled += p.speed*dt;
      for (const m of Mobs.mobsInRadius(p.mesh.position, 1.3)){ if (!p.hit.has(m)){ p.hit.add(m); Mobs.damageMob(m, p.dmg, { element:p.el, effects:p.effects, from:p.mesh.position }); if (!p.pierce){ p.done = true; break; } } }
      if (p.traveled >= p.range) p.done = true;
    }
    projectiles = projectiles.filter(p => { if (p.done){ scene.remove(p.mesh); return false; } return true; });
  }
  function updateStrikes(dt){
    for (const s of strikes){ s.t -= dt; s.mesh.material.opacity = 0.3 + 0.4*Math.abs(Math.sin(s.t*12));
      if (s.t <= 0){ for (const m of Mobs.mobsInRadius(s.pos, s.r)) Mobs.damageMob(m, s.dmg, { element:s.el, effects:s.effects, from:s.pos }); spawnRing(s.pos, s.r, ELEMENT_META[s.el].glow); s.done = true; } }
    strikes = strikes.filter(s => { if (s.done){ scene.remove(s.mesh); return false; } return true; });
  }
  function updateRings(dt){
    for (const r of rings){ r.t -= dt; const k = 1 + (1 - r.t/r.maxT)*0.6; r.mesh.scale.set(k,k,k); r.mesh.material.opacity = Math.max(0, r.t/r.maxT); }
    rings = rings.filter(r => { if (r.t<=0){ scene.remove(r.mesh); return false; } return true; });
  }
  function updateZonesWorld(dt){
    for (const z of zones){
      if (z.follow){ z.mesh.position.x = player.group.position.x; z.mesh.position.z = player.group.position.z; }
      z.t -= dt; z.acc += dt; z.mesh.material.opacity = 0.1 + 0.12*Math.max(0, z.t/3);
      while (z.acc >= z.interval){ z.acc -= z.interval;
        if (z.perTick > 0){ for (const m of Mobs.mobsInRadius(z.mesh.position, z.radius)) Mobs.damageMob(m, z.perTick, { element:z.el }); }
        if (z.healPerTick > 0 && !player.dead) player.hp = Math.min(player.maxHp, player.hp + z.healPerTick);
        if (z.chakraPerTick > 0 && !player.dead) player.chakra = Math.min(player.maxChakra, player.chakra + z.chakraPerTick);
      }
    }
    zones = zones.filter(z => { if (z.t<=0){ scene.remove(z.mesh); return false; } return true; });
  }
  function updateWorldTexts(dt){
    for (const t of worldTexts){ t.t -= dt; t.sp.position.y += t.vy*dt; t.sp.material.opacity = Math.max(0, t.t); }
    worldTexts = worldTexts.filter(t => { if (t.t<=0){ scene.remove(t.sp); return false; } return true; });
  }
  function updateLock(){
    if (lockedMob && lockedMob.dead) lockedMob = null;
    if (lockedMob && lockRing){ lockRing.visible = true; const s = lockedMob.isBoss ? 2.4 : 1.0; lockRing.scale.set(s,s,s); lockRing.position.set(lockedMob.group.position.x, lockedMob.group.position.y + 0.12, lockedMob.group.position.z); }
    else if (lockRing) lockRing.visible = false;
  }
  // recompensa de XP por cada presa abatida (de cualquier fuente: básico, skill, quemadura)
  // XP estilo L2: mob de tu nivel da completo; muy por debajo (gris) da migajas; por encima, bonus
  function xpReward(mobLvl, plvl, xpBase){
    const d = (mobLvl||1) - (plvl||1); let f;
    if (d>=5) f=1.5; else if (d>=3) f=1.25; else if (d>=-2) f=1.0; else if (d>=-5) f=0.4; else if (d>=-9) f=0.1; else f=0.05;
    return Math.max(1, Math.round((xpBase||7)*f));
  }
  function drainKills(){
    if (!window.Mobs || !Mobs.takeKills) return;
    for (const k of Mobs.takeKills()){
      const got = k.isBoss ? 250 : xpReward(k.lvl, level, k.xpBase);
      toast('☠ ' + k.name + '  ·  +' + k.gold + ' oro  ·  +' + got + ' XP' + (k.mat ? '  ·  🎁 ' + k.mat : ''));
      gainXP(got);
      // XP compartida: los miembros del grupo reciben la mitad
      if (myParty && myParty.length > 1 && window.Net && Net.connected && Net.connected()) Net.send({ t:'party', a:'xp', amount: Math.round(got*0.5) });
      if (k.isBoss && Net.connected()) Net.send({ t:'chat', text:'¡abatió al Dios ' + k.name + '!' });
    }
  }

  // ---------------- Forja & inventario ----------------
  const FORGE_KEY = 'el_forge_v1';
  const FORGE_MAX = 15;
  const FORGE = {
    weapon: { name:'Arma',     icon:'⚔️', mat:'Lingote de Hierro',      stat:'+4 daño/nivel (+9 divino)' },
    armor:  { name:'Armadura', icon:'🛡️', mat:'Madera de Roble',        stat:'+25 vida/nivel +2% def (más divino)' },
    amulet: { name:'Amuleto',  icon:'📿', mat:'Cristal de Refinamiento', stat:'+10 chakra/nivel (+22 divino)' },
  };
  function loadForge(){ try{ const r = JSON.parse(localStorage.getItem(FORGE_KEY)); if (r){ forge.weapon=r.weapon||0; forge.armor=r.armor||0; forge.amulet=r.amulet||0; } }catch(e){} }
  function saveForge(){ try{ localStorage.setItem(FORGE_KEY, JSON.stringify(forge)); }catch(e){} }
  function forgeBonus(){
    const norm = lv => Math.min(10, lv), div = lv => Math.max(0, lv-10);
    return {
      power:  norm(forge.weapon)*4  + div(forge.weapon)*9,
      hp:     norm(forge.armor)*25  + div(forge.armor)*55,
      reduce: Math.min(0.55, norm(forge.armor)*0.02 + div(forge.armor)*0.03),
      chakra: norm(forge.amulet)*10 + div(forge.amulet)*22,
    };
  }
  // costo de la próxima mejora; niveles 11-15 son "divinos" y usan materiales de Jefe (cualquiera de los 6).
  function upgradeCost(slot){
    const lv = forge[slot];
    if (lv < 10) return { divine:false, gold:(lv+1)*30, mat:FORGE[slot].mat, need:lv+1 };
    return { divine:true, gold:(lv+1)*120, mat:'Material de Jefe', need:lv-9 };
  }
  function canAfford(cost){
    if (!cost) return false;
    const L = (window.Mobs && Mobs.getLoot) ? Mobs.getLoot() : { gold:0, mats:{} };
    if (L.gold < cost.gold) return false;
    if (cost.divine) return (window.Mobs && Mobs.bossMatCount ? Mobs.bossMatCount() : 0) >= cost.need;
    return (L.mats[cost.mat]||0) >= cost.need;
  }
  function recomputeVitals(){
    if (!player) return; const ch = heroDef(); if (!ch) return; const fb = forgeBonus();
    player.maxHp = Math.round(ch.stats.maxHp*(1+(level-1)*0.08)) + fb.hp;
    player.maxChakra = (ch.stats.maxChakra||100) + fb.chakra;
    player.hp = Math.min(player.hp, player.maxHp); player.chakra = Math.min(player.chakra, player.maxChakra);
  }
  // ---------------- Mercado / Casa de Subastas ----------------
  function toggleMarket(){
    if (!marketEl) return;
    marketOpen = marketEl.hidden; marketEl.hidden = !marketOpen;
    if (marketOpen){ if (document.exitPointerLock) document.exitPointerLock(); if (window.Net && Net.connected && Net.connected()) Net.send({ t:'market:list' }); renderMarket(); }
  }
  function mkMeta(k){ return window.ITEMS ? ITEMS.meta(k) : { icon:'📦', color:'#9aa3b2', tier:'Material' }; }
  function listingLabel(it){   // etiqueta de un item del mercado (material o equipo)
    if (it.kind === 'gear'){ const n = { weapon:'Arma', armor:'Armadura', amulet:'Amuleto' }[it.slot] || 'Equipo'; const ic = { weapon:'⚔️', armor:'🛡️', amulet:'📿' }[it.slot] || '📦'; return { icon:ic, name:n + ' +' + it.level, color:'#ffce54' }; }
    const m = mkMeta(it.name); return { icon:m.icon, name:it.name, color:m.color };
  }
  function renderMarket(){
    if (!marketEl || marketEl.hidden) return;
    const L = (window.Mobs && Mobs.getLoot) ? Mobs.getLoot() : { gold:0, mats:{} };
    const tabBtn = (id,label) => '<button class="mk-tab'+(marketTab===id?' on':'')+'" data-tab="'+id+'">'+label+'</button>';
    let body = '';
    if (marketTab === 'buy'){
      const others = marketCatalog.filter(x => x.seller !== myName);
      body = others.length ? others.map(x => { const lab = listingLabel(x.item), gear = x.item.kind === 'gear'; return '<div class="mk-row" style="--mc:'+lab.color+'">'
        + '<span class="mk-ic">'+lab.icon+'</span><div class="mk-info"><b>'+esc(lab.name)+'</b>'+(gear?'':' ×'+x.qty)+'<br><small>'+x.price+' oro'+(gear?'':' c/u')+' · 👤 '+esc(x.seller)+(gear?' · tu actual +'+(forge[x.item.slot]||0):'')+'</small></div>'
        + (gear ? '' : '<input class="mk-qty" type="number" min="1" max="'+x.qty+'" value="1">')
        + '<button class="mk-buy" data-id="'+esc(x.id)+'">Comprar</button></div>'; }).join('')
        : '<div class="mk-empty">— no hay nada a la venta —</div>';
    } else if (marketTab === 'sell'){
      const keys = Object.keys(L.mats||{}).filter(k => (L.mats[k]||0) > 0);
      const matRows = keys.map(k => { const it = mkMeta(k); return '<div class="mk-row" style="--mc:'+it.color+'">'
        + '<span class="mk-ic">'+it.icon+'</span><div class="mk-info"><b>'+esc(k)+'</b><br><small>tienes '+L.mats[k]+'</small></div>'
        + '<input class="mk-sq" type="number" min="1" max="'+L.mats[k]+'" value="1" title="cantidad"><input class="mk-sp" type="number" min="1" value="50" title="precio c/u">'
        + '<button class="mk-sell" data-name="'+esc(k)+'">Publicar</button></div>'; }).join('');
      const gearRows = ['weapon','armor','amulet'].filter(s => (forge[s]||0) > 0).map(s => { const ic = { weapon:'⚔️', armor:'🛡️', amulet:'📿' }[s], nm = FORGE[s].name; return '<div class="mk-row" style="--mc:#ffce54">'
        + '<span class="mk-ic">'+ic+'</span><div class="mk-info"><b>'+nm+' +'+forge[s]+'</b><br><small>equipo forjado · al venderlo tu slot vuelve a +0</small></div>'
        + '<input class="mk-gp" type="number" min="1" value="500" title="precio"><button class="mk-sellgear" data-slot="'+s+'">Vender +'+forge[s]+'</button></div>'; }).join('');
      const sec = (gearRows ? '<div class="mk-sec">⚒️ Equipo forjado</div>'+gearRows : '') + (matRows ? '<div class="mk-sec">📦 Materiales</div>'+matRows : '');
      body = sec || '<div class="mk-empty">— no tienes nada para vender · caza y forja —</div>';
    } else {
      const mine = marketCatalog.filter(x => x.seller === myName);
      const lst = mine.length ? mine.map(x => { const lab = listingLabel(x.item), gear = x.item.kind === 'gear'; return '<div class="mk-row" style="--mc:'+lab.color+'">'
        + '<span class="mk-ic">'+lab.icon+'</span><div class="mk-info"><b>'+esc(lab.name)+'</b>'+(gear?'':' ×'+x.qty)+'<br><small>'+x.price+' oro</small></div>'
        + '<button class="mk-cancel" data-id="'+esc(x.id)+'">Cancelar</button></div>'; }).join('') : '<div class="mk-empty">— sin listados activos —</div>';
      const rec = marketReceipts.length ? '<div class="mk-rec"><b>🧾 Ventas mientras no estabas:</b>'+marketReceipts.map(r => '<div>'+r.qty+'× '+esc(r.item)+' → +'+r.total+' oro (a '+esc(r.buyer)+')</div>').join('')+'</div>' : '';
      body = lst + rec;
    }
    marketEl.innerHTML = '<div class="wp-card mk-card">'
      + '<div class="wp-head"><h3>🏪 Mercado</h3><button class="wp-x" id="mk-close">✕</button></div>'
      + '<div class="wp-gold">💰 '+L.gold+' oro · 👤 '+esc(myName||'')+'</div>'
      + '<div class="mk-tabs">'+tabBtn('buy','🛒 Comprar')+tabBtn('sell','🏷️ Vender')+tabBtn('mine','📦 Mis ventas')+'</div>'
      + '<div class="mk-list">'+body+'</div>'
      + '<div class="mk-hint">Lo que listas (materiales o equipo) sale de ti en el acto (escrow). Vender un equipo +N pone tu slot en +0; quien lo compra lo equipa. Si te compran estando offline, recibes el oro al reconectar.</div></div>';
    marketEl.querySelector('#mk-close').onclick = toggleMarket;
    marketEl.querySelectorAll('.mk-tab').forEach(b => b.onclick = () => { marketTab = b.dataset.tab; renderMarket(); });
    marketEl.querySelectorAll('.mk-buy').forEach(b => b.onclick = () => { const r=b.closest('.mk-row'), qi=r.querySelector('.mk-qty'); Net.send({ t:'market:buy', id:b.dataset.id, qty: qi ? Math.max(1, +qi.value||1) : 1 }); });
    marketEl.querySelectorAll('.mk-sell').forEach(b => b.onclick = () => { const r=b.closest('.mk-row'); Net.send({ t:'market:create', name:b.dataset.name, qty:Math.max(1,+r.querySelector('.mk-sq').value||1), price:Math.max(1,+r.querySelector('.mk-sp').value||1) }); });
    marketEl.querySelectorAll('.mk-sellgear').forEach(b => b.onclick = () => { const r=b.closest('.mk-row'); if (confirm('Vender '+FORGE[b.dataset.slot].name+' +'+forge[b.dataset.slot]+'? Tu slot volverá a +0.')) Net.send({ t:'market:create', kind:'gear', slot:b.dataset.slot, price:Math.max(1,+r.querySelector('.mk-gp').value||1) }); });
    marketEl.querySelectorAll('.mk-cancel').forEach(b => b.onclick = () => Net.send({ t:'market:cancel', id:b.dataset.id }));
  }
  function togglePanel(){ if (!panelEl) return; panelOpen = panelEl.hidden; panelEl.hidden = !panelOpen; if (panelOpen){ buildPanel(); if (document.exitPointerLock) document.exitPointerLock(); } }
  function buildPanel(){
    if (!panelEl) return;
    const L = (window.Mobs && Mobs.getLoot) ? Mobs.getLoot() : { gold:0, mats:{}, kills:0 };
    const matKeys = Object.keys(L.mats||{});
    const matHtml = matKeys.length ? matKeys.map(k => { const it = window.ITEMS ? ITEMS.meta(k) : { icon:'📦', color:'#9aa3b2', tier:'Material' }; return '<div class="wp-tile" style="--mc:'+it.color+'" title="'+esc(k)+' · '+it.tier+'"><span class="wp-tic">'+it.icon+'</span><span class="wp-tq">'+L.mats[k]+'</span><span class="wp-tn">'+esc(k)+'</span><span class="wp-tt">'+it.tier+'</span></div>'; }).join('') : '<span class="wp-empty">— aún no tienes materiales · caza bestias y Jefes —</span>';
    const rows = ['weapon','armor','amulet'].map(slot => {
      const cfg = FORGE[slot], lv = forge[slot], maxed = lv >= FORGE_MAX, cost = maxed ? null : upgradeCost(slot);
      const can = !maxed && canAfford(cost);
      const tag = lv > 10 ? ' <span class="wp-div">✦ divino</span>' : '';
      return '<div class="wp-row">'
        + '<div class="wp-slot"><span class="wp-ic">'+cfg.icon+'</span><div><b>'+cfg.name+' +'+lv+'</b>'+tag+'<br><small>'+cfg.stat+'</small></div></div>'
        + (maxed ? '<div class="wp-max">MÁX</div>'
                 : '<button class="wp-up'+(can?'':' off')+(cost.divine?' div':'')+'" data-slot="'+slot+'">⬆ +'+(lv+1)+'<br><small>'+cost.need+'× '+esc(cost.mat)+' · 💰'+cost.gold+'</small></button>')
        + '</div>';
    }).join('');
    const clanRow = '<div class="wp-clan"><label>🛡 Clan</label><input id="wp-clan" maxlength="8" value="'+esc(clan)+'" placeholder="(sin clan)"><button id="wp-clan-save">Fijar</button></div>';
    panelEl.innerHTML = '<div class="wp-card">'
      + '<div class="wp-head"><h3>🔨 Forja &amp; Inventario</h3><button class="wp-x" id="wp-close">✕</button></div>'
      + '<div class="wp-gold">💰 '+ L.gold +' oro · ☠ '+ (L.kills||0) +' bajas · 👤 '+esc(myName||'')+'</div>'
      + '<div class="wp-section">Materiales</div><div class="wp-mats">'+matHtml+'</div>'
      + '<div class="wp-section">Equipo</div><div class="wp-rows">'+rows+'</div>'
      + '<div class="wp-section">Clan</div>'+clanRow
      + '<div class="wp-foot">Niveles 11-15 son <b>divinos</b> (materiales de Jefe). Pulsa <b>I</b> para cerrar.</div></div>';
    const close = panelEl.querySelector('#wp-close'); if (close) close.onclick = togglePanel;
    panelEl.querySelectorAll('.wp-up').forEach(b => b.onclick = () => upgrade(b.dataset.slot));
    const cs = panelEl.querySelector('#wp-clan-save'); if (cs) cs.onclick = () => setClan(panelEl.querySelector('#wp-clan').value);
  }
  function upgrade(slot){
    const cfg = FORGE[slot]; if (forge[slot] >= FORGE_MAX) return;
    const cost = upgradeCost(slot);
    if (!window.Mobs || !canAfford(cost)){ toast('No te alcanza para mejorar tu '+cfg.name); buildPanel(); return; }
    if (cost.divine){ Mobs.spend({}, cost.gold); Mobs.spendBoss(cost.need); }
    else { Mobs.spend({ [cost.mat]: cost.need }, cost.gold); }
    forge[slot]++; saveAccount(); recomputeVitals(); updateGearVisual(); pushSave();
    toast('🔨 '+cfg.name+' mejorada a +'+forge[slot] + (forge[slot] > 10 ? ' ✦ divino' : ''));
    buildPanel();
  }
  function onWheel(e){ if (!active) return; e.preventDefault(); camDist=Math.max(6,Math.min(22,camDist+(e.deltaY>0?0.8:-0.8))); }
  function modalOpen(){ return false; }   // ya no hay modales que bloqueen el mundo

  // ---------------- bucle ----------------
  function start(){ if (active) return; active=true; last=performance.now(); raf=requestAnimationFrame(loop); }
  function stop(){ active=false; cancelAnimationFrame(raf); keys.clear(); dragging=false; if (panelEl){ panelEl.hidden = true; panelOpen = false; } Net.disconnect(); remote.forEach(r=>{ if (r.model) r.model.dispose(); scene.remove(r.group); scene.remove(r.nameSprite); }); remote.clear(); }
  function loop(now){ if (!active) return; let dt=(now-last)/1000; last=now; dt=Math.min(0.05,dt); update(dt); composer.render(); raf=requestAnimationFrame(loop); }

  // ---- ciclo día-noche (lerps de color/escalares; sin sombras → barato) ----
  const DN_KEYS = [
    { t:0.00, top:0x070b1c, bot:0x03040a, sun:0x24306a, si:0.05, hi:0.18, ai:0.10, fog:0x05060e, ex:0.82 },  // medianoche
    { t:0.22, top:0x1a2348, bot:0x080a14, sun:0x3a4a8a, si:0.22, hi:0.30, ai:0.14, fog:0x0a0c16, ex:0.88 },  // antes del alba
    { t:0.30, top:0x46538f, bot:0xd9824e, sun:0xffae66, si:0.95, hi:0.50, ai:0.22, fog:0xb98058, ex:1.00 },  // amanecer
    { t:0.50, top:0x2f63c8, bot:0x9fc2ec, sun:0xfff3df, si:1.30, hi:0.72, ai:0.30, fog:0xaec6e2, ex:1.00 },  // mediodía
    { t:0.70, top:0x3a3f86, bot:0xe0744a, sun:0xff7a44, si:0.90, hi:0.50, ai:0.22, fog:0xb56848, ex:0.98 },  // atardecer
    { t:0.80, top:0x141a3c, bot:0x0a0c18, sun:0x2c3a72, si:0.20, hi:0.28, ai:0.14, fog:0x0a0c16, ex:0.90 },  // anochecer
    { t:1.00, top:0x070b1c, bot:0x03040a, sun:0x24306a, si:0.05, hi:0.18, ai:0.10, fog:0x05060e, ex:0.82 },  // medianoche (wrap)
  ];
  const DAY_SECONDS = 300;   // un día completo = 5 min
  function updateDayNight(dt){
    if (!dn) return;
    dn.t = (dn.t + dt / DAY_SECONDS) % 1; if (dn.t < 0) dn.t += 1;
    const t = dn.t;
    let i = 0; while (i < DN_KEYS.length - 1 && DN_KEYS[i+1].t <= t) i++;
    const a = DN_KEYS[i], b = DN_KEYS[Math.min(i+1, DN_KEYS.length-1)];
    const span = (b.t - a.t) || 1, f = Math.max(0, Math.min(1, (t - a.t) / span));
    const lerpHex = (u, ha, hb) => u.copy(dn.ca.setHex(ha)).lerp(dn.cb.setHex(hb), f);   // in-place (no rompe uniforms)
    lerpHex(dn.skyMat.uniforms.top.value, a.top, b.top);
    lerpHex(dn.skyMat.uniforms.bot.value, a.bot, b.bot);
    lerpHex(dn.sun.color, a.sun, b.sun);
    dn.sun.intensity = a.si + (b.si - a.si) * f;
    dn.hemi.intensity = a.hi + (b.hi - a.hi) * f;
    dn.ambient.intensity = a.ai + (b.ai - a.ai) * f;
    if (scene.fog) lerpHex(scene.fog.color, a.fog, b.fog);
    if (renderer) renderer.toneMappingExposure = a.ex + (b.ex - a.ex) * f;
    const ang = (t - 0.25) * Math.PI * 2;   // sale por el este, cenit, se pone por el oeste
    dn.sun.position.set(Math.cos(ang) * 80, Math.max(6, Math.sin(ang) * 90), 35);
    // factor de noche → enciende faroles ("islas de luz cálida" en la oscuridad)
    dn.night = Math.max(0, Math.min(1, 1 - (dn.sun.intensity - 0.2) / 0.9));
    if (window.Town && Town.setNight) Town.setNight(dn.night);
  }

  // ---- clima por nación/elemento (UN Points reciclado que sigue al jugador) ----
  const WX = 46, WYH = 26, WZ = 46;   // caja alrededor del jugador
  const WEATHER = {
    Fuego:  { color:0xff8a3c, size:0.55, vy: 3.6, sway:0.5, add:true,  fall:false, op:0.8 },  // brasas que suben
    Agua:   { color:0x74b6ff, size:0.30, vy:-24,  sway:0.1, add:false, fall:true,  op:0.55 }, // lluvia
    Viento: { color:0xffffff, size:0.55, vy:-3.2, sway:1.6, add:false, fall:true,  op:0.8 },  // nieve
    Tierra: { color:0xc9a86a, size:0.42, vy:-1.6, sway:0.9, add:false, fall:true,  op:0.5 },  // polvo
    Rayo:   { color:0xfff36a, size:0.5,  vy:-11,  sway:2.2, add:true,  fall:true,  op:0.85 }, // chispas
    Madera: { color:0x8fcf6a, size:0.6,  vy:-2.6, sway:1.3, add:false, fall:true,  op:0.75 }, // hojas
  };
  function buildWeather(){
    const N = 240, pos = new Float32Array(N*3);
    for (let i=0;i<N;i++){ pos[i*3]=(Math.random()-0.5)*WX; pos[i*3+1]=Math.random()*WYH; pos[i*3+2]=(Math.random()-0.5)*WZ; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos,3));
    const m = new THREE.PointsMaterial({ color:0xffffff, size:0.4, transparent:true, opacity:0.7, depthWrite:false, sizeAttenuation:true });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.visible = false; scene.add(pts);
    return { pts, geo:g, N, mode:null };
  }
  function updateWeather(dt){
    if (!weather || !player) return;
    const px = player.group.position.x, pz = player.group.position.z;
    let el = null, bd = 44;
    for (const n of nations){ const d = Math.hypot(n.x-px, n.z-pz); if (d < bd){ bd = d; el = n.element; } }   // clima de la Nación cercana
    const W = el && WEATHER[el] ? WEATHER[el] : null;
    weather.pts.visible = !!W; if (!W) return;
    if (weather.mode !== el){ weather.mode = el; const m = weather.pts.material;
      m.color.setHex(W.color); m.size = W.size; m.opacity = W.op; m.blending = W.add ? THREE.AdditiveBlending : THREE.NormalBlending; m.needsUpdate = true; }
    const arr = weather.geo.attributes.position.array, tn = performance.now()*0.001;
    for (let i=0;i<weather.N;i++){ const k=i*3;
      arr[k+1] += W.vy*dt; arr[k] += Math.sin(tn+i)*W.sway*dt;
      let lx = arr[k]-px, ly = arr[k+1], lz = arr[k+2]-pz;
      if (W.fall){ if (ly < 0) ly += WYH; } else { if (ly > WYH) ly -= WYH; }
      if (lx < -WX/2) lx += WX; else if (lx > WX/2) lx -= WX;
      if (lz < -WZ/2) lz += WZ; else if (lz > WZ/2) lz -= WZ;
      arr[k]=px+lx; arr[k+1]=ly; arr[k+2]=pz+lz;
    }
    weather.geo.attributes.position.needsUpdate = true;
  }

  function update(dt){
    updateDayNight(dt);   // ciclo día-noche
    updateWeather(dt);    // clima por nación
    // cooldowns, chakra, buffs temporales, flash
    for (const k in player.cooldowns) player.cooldowns[k] = Math.max(0, player.cooldowns[k] - dt);
    if (!player.dead) player.chakra = Math.min(player.maxChakra, player.chakra + 12*dt);
    if (player.buff){ player.buff.t -= dt; if (player.buff.t <= 0) player.buff = null; }
    if (player.buffDef){ player.buffDef.t -= dt; if (player.buffDef.t <= 0) player.buffDef = null; }
    if (player.hitFlash > 0) player.hitFlash -= dt;

    // muerte / respawn del jugador
    if (player.dead){
      if (player.model) player.model.update(dt, { dead:true });   // animación de caída
      player.respawn -= dt;
      player.group.scale.setScalar(Math.max(0.001, Math.min(1, player.respawn / 1.1)));   // se desvanece (encoge) antes de reaparecer
      if (player.respawn <= 0) respawnPlayer();
    }

    let moving = false;
    if (!player.dead){
      if (!panelOpen){
        let mx=0,mz=0; const fwd={x:-Math.sin(camYaw),z:-Math.cos(camYaw)}, right={x:Math.cos(camYaw),z:-Math.sin(camYaw)};
        if (keys.has('w')||keys.has('arrowup')){ mx+=fwd.x; mz+=fwd.z; }
        if (keys.has('s')||keys.has('arrowdown')){ mx-=fwd.x; mz-=fwd.z; }
        if (keys.has('d')||keys.has('arrowright')){ mx+=right.x; mz+=right.z; }
        if (keys.has('a')||keys.has('arrowleft')){ mx-=right.x; mz-=right.z; }
        if (mx||mz){ const d=Math.hypot(mx,mz); mx/=d; mz/=d; const sp=keys.has('shift')?13:7.5; player.group.position.x+=mx*sp*dt; player.group.position.z+=mz*sp*dt; player.targetFacing=Math.atan2(mx,mz); moving=true; }
        const R=140; player.group.position.x=Math.max(-R,Math.min(R,player.group.position.x)); player.group.position.z=Math.max(-R,Math.min(R,player.group.position.z));
        player.group.position.y = terrainHeight(player.group.position.x, player.group.position.z);   // sigue el relieve del terreno
        updateAutoAttack(dt);
      }
      player.group.rotation.y = lerpAngle(player.group.rotation.y, player.targetFacing, 0.2);
      animateFighter(player, dt, moving);
    }

    // jugadores remotos
    remote.forEach(r => {
      const dx=r.tx-r.group.position.x, dz=r.tz-r.group.position.z, k=Math.min(1,10*dt);
      r.group.position.x+=dx*k; r.group.position.z+=dz*k;
      r.group.rotation.y = lerpAngle(r.group.rotation.y, r.try, 0.2);
      r.nameSprite.position.set(r.group.position.x, 3.4, r.group.position.z);
      animateFighter(r, dt, r.moving || (Math.hypot(dx,dz) > 0.03));
    });

    // enviar mi estado ~10/s
    stateTimer -= dt;
    if (stateTimer <= 0 && Net.connected()){ stateTimer = 0.1; Net.send({ t:'state', x:player.group.position.x, y:0, z:player.group.position.z, ry:player.group.rotation.y, nation:curNation, anim:moving?'walk':'idle', pvp:pvpOn, hp:Math.round(player.hp), mhp:Math.round(player.maxHp) }); }

    // Nación actual
    curNation = 'Centro'; let bestN = 15*15;
    for (const n of nations){ const d=(n.x-player.group.position.x)**2+(n.z-player.group.position.z)**2; if (d<bestN){ bestN=d; curNation=n.name; } }

    // combate: efectos + bestias (que contraatacan) + XP por presas
    updateProjectiles(dt); updateStrikes(dt); updateRings(dt); updateZonesWorld(dt); updateWorldTexts(dt); updateLock();
    if (window.Mobs){ const taken = Mobs.update(dt, player.group.position) || 0; if (taken > 0 && !player.dead) damagePlayer(taken); if (Mobs.syncBosses) Mobs.syncBosses(serverBosses); }
    drainKills();

    updateCamera(dt);
    const arr = embers.geometry.attributes.position.array;
    for (let i=0;i<arr.length;i+=3){ arr[i+1]+=dt*0.5; if (arr[i+1]>14){ arr[i+1]=0; } }
    embers.geometry.attributes.position.needsUpdate = true;

    if (toastT>0) toastT-=dt;
    updateHUD();
  }
  function updateCamera(dt){
    if (!player.dead && !pointerLocked) camYaw = lerpAngle(camYaw, player.targetFacing + Math.PI, Math.min(1, 3.5*dt));   // sin mouse-look: la cámara sigue detrás del personaje
    const tx=player.group.position.x, ty=player.group.position.y+1.4, tz=player.group.position.z, cp=Math.cos(camPitch);
    const cx=tx+Math.sin(camYaw)*camDist*cp, cy=ty+Math.sin(camPitch)*camDist, cz=tz+Math.cos(camYaw)*camDist*cp, k=Math.min(1,9*dt);
    camera.position.x+=(cx-camera.position.x)*k; camera.position.y+=(cy-camera.position.y)*k; camera.position.z+=(cz-camera.position.z)*k;
    camera.lookAt(tx,ty,tz);
  }

  // anima un combatiente: mixer glTF (idle/caminar/correr) o, si es de cajas, el procedural.
  function animateFighter(f, dt, movingHint){
    if (f.model){
      const sp = (f._px !== undefined) ? Math.hypot(f.group.position.x - f._px, f.group.position.z - f._pz) / Math.max(dt, 1e-4) : 0;
      f._px = f.group.position.x; f._pz = f.group.position.z;
      f.model.update(dt, { moving: sp > 0.4 || movingHint, running: sp > 8.5, airborne:false, dead:false });
    } else {
      animateFigure(f, dt, movingHint);
    }
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
      + '<div class="w-level"><span id="w-lvl">Nv 1</span><div class="w-xpbar"><i id="w-xp"></i></div></div>'
      + '<div class="w-bossbar" id="w-bossbar" hidden><div class="w-bb-name" id="w-bb-name"></div><div class="w-bb-track"><i id="w-bb-fill"></i></div><div class="w-bb-hp" id="w-bb-hptxt"></div></div>'
      + '<div class="w-party" id="w-party"></div>'
      + '<div class="w-pvpflag" id="w-pvp" hidden>⚔ PvP activado</div>'
      + '<div class="w-loot" id="w-loot"></div>'
      + '<div class="w-target" id="w-target"></div>'
      + '<div class="w-boss" id="w-boss"></div>'
      + '<div class="w-toast" id="w-toast"></div>'
      + '<div class="w-prompt" id="w-prompt"></div>'
      + '<div class="w-vitals"><div class="w-name" id="w-pname"></div>'
      + '<div class="w-hpbar"><i id="w-hp"></i><span class="w-hptxt" id="w-hptxt"></span></div>'
      + '<div class="w-ckbar"><i id="w-ck"></i></div></div>'
      + '<div class="w-skills" id="w-skills"></div>'
      + '<div class="w-chat" id="w-chat"></div>'
      + '<input id="w-chatin" class="w-chatin" maxlength="120" placeholder="Enter para chatear…" autocomplete="off">'
      + '<div class="w-hint"><b>mouse</b> mira · <b>clic izq</b> golpe · <b>clic der</b>/<b>Tab</b> fijar · <b>1-4</b> skills · <b>WASD</b> · <b>I</b> forja · <b>M</b> mercado · <b>G</b> esquirlas · <b>Enter</b> chat · <b>K</b> PvP · <b>Esc</b> soltar</div>';
    hud._status=document.getElementById('w-status'); hud._count=document.getElementById('w-count'); hud._nation=document.getElementById('w-nation');
    hud._party=document.getElementById('w-party'); hud._pvp=document.getElementById('w-pvp');
    hud._toast=document.getElementById('w-toast'); hud._prompt=document.getElementById('w-prompt'); hud._dot=document.getElementById('w-dot');
    hud._loot=document.getElementById('w-loot'); hud._target=document.getElementById('w-target'); hud._boss=document.getElementById('w-boss');
    hud._bossbar=document.getElementById('w-bossbar'); hud._bbName=document.getElementById('w-bb-name'); hud._bbFill=document.getElementById('w-bb-fill'); hud._bbHp=document.getElementById('w-bb-hptxt');
    hud._lvl=document.getElementById('w-lvl'); hud._xp=document.getElementById('w-xp');
    hud._pname=document.getElementById('w-pname'); hud._hp=document.getElementById('w-hp'); hud._hptxt=document.getElementById('w-hptxt');
    hud._ck=document.getElementById('w-ck'); hud._skills=document.getElementById('w-skills'); hud._slots=[];
    chatEl=document.getElementById('w-chat'); chatInput=document.getElementById('w-chatin');
    if (chatEl) chatEl.innerHTML = chatLines.map(l => '<div>' + esc(l) + '</div>').join('');
    if (chatInput) chatInput.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter'){ sendChat(chatInput.value); chatInput.value=''; chatInput.blur(); }
      else if (e.key === 'Escape'){ chatInput.value=''; chatInput.blur(); }
    });
    buildSkillBar();
  }
  function buildSkillBar(){
    if (!hud || !hud._skills || !player) return;
    const ch = heroDef(); if (!ch) return;
    hud._skills.innerHTML = ch.skills.map(s => '<div class="w-slot"><span class="k">'+s.key+'</span><span class="nm">'+s.name+'</span><span class="cd"></span></div>').join('');
    hud._slots = Array.prototype.slice.call(hud._skills.querySelectorAll('.w-slot'));
    if (hud._pname) hud._pname.textContent = ch.name + ' · ' + ch.archetype.name;
  }
  function updateHUD(){
    if (!hud || !hud._status) return;
    hud._status.textContent = myName + ' · ' + statusTxt;
    hud._count.textContent = playerCount;
    hud._nation.textContent = curNation;
    hud._dot.style.background = Net.connected() ? '#5ad469' : '#ff7b7b';
    hud._prompt.textContent = '';
    hud._toast.style.opacity = toastT > 0 ? '1' : '0';
    if (hud._lvl){ hud._lvl.textContent = 'Nv ' + level; }
    if (hud._xp){ hud._xp.style.width = Math.min(100, Math.round(xp / xpNeeded(level) * 100)) + '%'; }
    if (hud._loot && window.Mobs){ const L = Mobs.getLoot(); hud._loot.textContent = '💰 ' + L.gold + ' oro  ·  ☠ ' + L.kills + ' bajas' + (soulshots ? '  ·  ✦ Esquirlas' : ''); }
    // vida / chakra del jugador
    if (hud._hp && player){ hud._hp.style.width = (Math.max(0, player.hp/player.maxHp)*100) + '%'; if (hud._hptxt) hud._hptxt.textContent = Math.ceil(Math.max(0,player.hp)) + ' / ' + player.maxHp; }
    if (hud._ck && player){ hud._ck.style.width = (player.maxChakra ? player.chakra/player.maxChakra*100 : 0) + '%'; }
    // skills (cooldown / chakra)
    if (hud._slots && hud._slots.length && player){ const ch = heroDef(); if (ch) ch.skills.forEach((s, i) => {
      const slot = hud._slots[i]; if (!slot) return;
      const cd = player.cooldowns[s.key]||0, tot = player.cdTotal[s.key]||s.cooldown;
      slot.classList.toggle('ready', cd<=0 && player.chakra>=(s.cost||0));
      slot.classList.toggle('low', player.chakra<(s.cost||0));
      const cdel = slot.querySelector('.cd'); cdel.textContent = cd>0?cd.toFixed(1):''; cdel.style.height = cd>0?(cd/tot*100)+'%':'0%';
    }); }
    // objetivo (fijado o más cercano)
    if (hud._target && window.Mobs){ const m = (lockedMob && !lockedMob.dead) ? lockedMob : Mobs.getNearest();
      if (m && !m.dead){ hud._target.style.display = 'block'; hud._target.innerHTML = ((lockedMob===m)?'🎯 ':'') + (m.isPlayer?'⚔ ':m.isBoss?'☠ ':'🐾 ') + esc(m.name) + ' — ' + Math.max(0,Math.ceil(m.hp)) + ' / ' + m.maxHp; }
      else hud._target.style.display = 'none';
      const bb = (lockedMob && lockedMob.isBoss && !lockedMob.dead) ? lockedMob : null;   // barra de Jefe estilo raid (HP compartido)
      if (hud._bossbar){
        if (bb){ const frac = Math.max(0, Math.min(1, bb.hp / (bb.maxHp||1)));
          hud._bossbar.hidden = false; hud._bbName.textContent = '☠ ' + bb.name;
          hud._bbFill.style.width = (frac*100).toFixed(1) + '%'; hud._bbHp.textContent = Math.max(0, Math.ceil(bb.hp)) + ' / ' + bb.maxHp;
        } else hud._bossbar.hidden = true;
      } }
    // brújula: apunta al Dios vivo más cercano
    if (hud._boss){
      let best = null, bd = Infinity;
      if (player && nations) for (const n of nations){
        const sb = serverBosses[n.element];
        if (sb && sb.dead) continue;                       // muerto → no apuntar
        const dx = n.x - player.group.position.x, dz = n.z - player.group.position.z, d = Math.hypot(dx, dz);
        if (d < bd){ bd = d; best = { el:n.element, dx, dz, d }; }
      }
      if (best && best.d > 6){                              // ocúltalo solo cuando ya estás encima
        const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
        const sy = (best.dx/best.d)*fx + (best.dz/best.d)*fz, sx = (best.dx/best.d)*rx + (best.dz/best.d)*rz;
        const ai = ((Math.round(Math.atan2(sx, sy)/(Math.PI/4)) % 8) + 8) % 8;
        const arrow = ['↑','↗','→','↘','↓','↙','←','↖'][ai];
        const em = (typeof ELEMENT_META!=='undefined' && ELEMENT_META[best.el]) ? ELEMENT_META[best.el].emoji : '☠';
        const col = (typeof NATION_THEME!=='undefined' && NATION_THEME[best.el]) ? NATION_THEME[best.el].accent : '#ffce54';
        hud._boss.style.display = 'block'; hud._boss.style.color = col;
        hud._boss.classList.toggle('near', best.d < 18);
        hud._boss.innerHTML = em + ' Dios de ' + best.el + ' <span class="ar">' + arrow + '</span> ' + Math.round(best.d) + 'm';
      } else hud._boss.style.display = 'none';
    }
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
