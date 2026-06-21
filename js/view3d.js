// ====================================================================
//  view3d.js — BATALLA 3D en tercera persona (Three.js).
//  Controlas a tu héroe (WASD), apuntas con el ratón (cámara orbital),
//  y combates contra un Centinela usando las skills 1-4. Reutiliza los
//  datos de characters.js y el ciclo elemental de elements.js.
// ====================================================================

const NATION_THEME = {
  Fuego:  { sky:0x2a0e08, fog:0x1a0a06, ground:0x2e1712, light:0xffb070, accent:0xff5a3c, biome:'Caldera Volcánica',        desc:'Ríos de lava, ceniza y brasas flotantes.' },
  Viento: { sky:0x8fb8d8, fog:0xbfe0ec, ground:0x6f9f7a, light:0xffffff, accent:0x7fe3a0, biome:'Templos Flotantes',         desc:'Islas suspendidas entre fuertes corrientes.' },
  Rayo:   { sky:0x201c2e, fog:0x16121f, ground:0x2b2738, light:0xfff07a, accent:0xffd23c, biome:'Picos de la Cima Cargada',  desc:'Tormenta perpetua y pararrayos.' },
  Tierra: { sky:0x4a3320, fog:0x33241a, ground:0x6b4a2a, light:0xe6c79a, accent:0xc08a4a, biome:'Cañón de Adamantita',       desc:'Mesetas de roca viva y desfiladeros.' },
  Agua:   { sky:0x0e2436, fog:0x0a1b2a, ground:0x14384f, light:0x9fd0ff, accent:0x3ca6ff, biome:'Fosa Abisal',              desc:'Profundidades sumergidas y bioluminiscencia.' },
  Madera: { sky:0x1d3a22, fog:0x16301a, ground:0x274d26, light:0xc6f0a6, accent:0x5fbf4f, biome:'Bosque Eterno',            desc:'Hogar del Sello Viviente y la Princesa.' },
};

const View3D = (function(){
  let THREE, renderer, scene, camera, raf = 0, active = false, last = 0;
  let canvasEl = null, hudEl = null, ground, embers, sun, grid, props = [], sky, composer, bloom;
  let player = null, enemy = null;
  let projectiles = [], rings = [], zones = [], strikes = [], texts = [];
  const keys = new Set();
  let dragging = false, lastX = 0, lastY = 0, moved = 0;
  let camYaw = Math.PI, camPitch = 0.4, camDist = 8;
  let raycaster, ndc, groundPlane, aimPoint, reticle;
  let hud = null;

  const ENEMY_REGEN = 16;
  const U = 0.03;  // factor px(2D) -> unidades(3D)

  // ---------------- arranque ----------------
  function init(canvas, char){
    THREE = window.THREE;
    if (!renderer) create(canvas);
    setHero(char);
    if (!enemy) spawnEnemy('Tierra');
    start();
  }

  function create(canvas){
    canvasEl = canvas;
    hudEl = document.getElementById('hud3d');
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
    renderer.setPixelRatio(1);
    renderer.setSize(canvas.width, canvas.height, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(52, canvas.width / canvas.height, 0.1, 500);
    camera.position.set(0, 6, -9);

    // iluminación cinemática
    scene.add(new THREE.HemisphereLight(0xbfd0ff, 0x202028, 0.5));
    scene.add(new THREE.AmbientLight(0xffffff, 0.22));
    sun = new THREE.DirectionalLight(0xffffff, 1.25); sun.position.set(12, 20, 8);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -26; sun.shadow.camera.right = 26; sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -26;
    sun.shadow.bias = -0.0006; scene.add(sun);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.55); rim.position.set(-10, 8, -12); scene.add(rim);

    // cúpula de cielo en degradado vertical
    const skyMat = new THREE.ShaderMaterial({ side:THREE.BackSide, depthWrite:false,
      uniforms:{ top:{ value:new THREE.Color(0x335577) }, bot:{ value:new THREE.Color(0x111122) } },
      vertexShader:'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:'varying vec3 vP; uniform vec3 top; uniform vec3 bot; void main(){ float h = clamp(normalize(vP).y*0.5+0.5, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, h), 1.0); }' });
    sky = new THREE.Mesh(new THREE.SphereGeometry(220, 24, 16), skyMat); scene.add(sky);

    ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), new THREE.MeshStandardMaterial({ color:0x333333, roughness:1, metalness:0 }));
    ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);
    grid = new THREE.GridHelper(110, 55, 0x000000, 0x000000); grid.material.opacity = 0.08; grid.material.transparent = true; scene.add(grid);

    const N = 120, pos = new Float32Array(N*3);
    for (let i=0;i<N;i++){ pos[i*3] = (Math.random()-0.5)*70; pos[i*3+1] = Math.random()*10; pos[i*3+2] = (Math.random()-0.5)*70; }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(pos,3));
    embers = new THREE.Points(eg, new THREE.PointsMaterial({ color:0xffffff, size:0.18, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false }));
    scene.add(embers);

    // post-proceso: bloom (resplandor mágico estilo FF) en auras y hechizos
    composer = new THREE.EffectComposer(renderer);
    composer.setSize(canvas.width, canvas.height);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(canvas.width, canvas.height), 0.75, 0.55, 0.62);
    composer.addPass(bloom);

    // apuntado con el ratón: raycaster sobre el suelo + retículo
    raycaster = new THREE.Raycaster();
    ndc = new THREE.Vector2();
    groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
    aimPoint = new THREE.Vector3(0, 0, 9);
    reticle = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.5, 28), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.8, side:THREE.DoubleSide }));
    reticle.rotation.x = -Math.PI/2; reticle.renderOrder = 2; scene.add(reticle);
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    bindInput();
  }

  // ---------------- combatientes ----------------
  function makeFighter(char, faction){
    const f = {
      char, faction,
      group: buildHero3D(THREE, char),
      maxHp: char.stats.maxHp, hp: char.stats.maxHp,
      maxChakra: char.stats.maxChakra, chakra: char.stats.maxChakra,
      element: char.element,
      cooldowns: {}, cdTotal: {}, status: {},
      facing: 0, targetFacing: 0, vy: 0, walkPhase: 0, basicCd: 0,
      dead: false, respawn: 0, hitFlash: 0,
    };
    f.parts = f.group.userData.parts;
    f.headBaseY = f.parts.head.userData.baseY;
    f.group.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
    return f;
  }
  function setHero(char){
    if (player){ scene.remove(player.group); }
    player = makeFighter(char, 'player');
    player.group.position.set(0, 0, 0); player.group.rotation.y = 0;
    scene.add(player.group);
    applyTheme(char.element);
    if (reticle) reticle.material.color = new THREE.Color(ELEMENT_META[char.element].glow);
    buildHUD();
  }
  function spawnEnemy(element){
    const def = JSON.parse(JSON.stringify(DUMMY_DEF)); def.element = element; def.skills[0].element = element;
    enemy = makeFighter(def, 'enemy');
    enemy.group.position.set(0, 0, 9); enemy.group.rotation.y = Math.PI;
    enemy.group.scale.set(1.15,1.15,1.15);
    scene.add(enemy.group);
  }
  function cycleEnemy(dir){
    if (!enemy) return;
    let i = ELEMENT_RING.indexOf(enemy.element);
    i = (i + dir + ELEMENT_RING.length) % ELEMENT_RING.length;
    const el = ELEMENT_RING[i];
    const p = enemy.group.position.clone();
    scene.remove(enemy.group);
    const def = JSON.parse(JSON.stringify(DUMMY_DEF)); def.element = el; def.skills[0].element = el;
    const keep = { hp:enemy.hp, dead:enemy.dead };
    enemy = makeFighter(def, 'enemy');
    enemy.hp = keep.hp; enemy.group.position.copy(p); enemy.group.scale.set(1.15,1.15,1.15);
    scene.add(enemy.group);
  }

  function applyTheme(el){
    const t = NATION_THEME[el] || NATION_THEME.Fuego;
    scene.background = new THREE.Color(t.fog);
    scene.fog = new THREE.Fog(t.fog, 20, 80);
    if (sky){ sky.material.uniforms.top.value = new THREE.Color(t.sky).multiplyScalar(1.25); sky.material.uniforms.bot.value = new THREE.Color(t.fog); }
    ground.material.color = new THREE.Color(t.ground);
    sun.color = new THREE.Color(t.light);
    embers.material.color = new THREE.Color(t.accent);
    props.forEach(p => scene.remove(p)); props = [];
    const propMat = new THREE.MeshStandardMaterial({ color:new THREE.Color(t.ground).multiplyScalar(1.35), roughness:0.95 });
    const accMat  = new THREE.MeshStandardMaterial({ color:t.accent, emissive:t.accent, emissiveIntensity:0.35, roughness:0.6 });
    for (let i=0;i<16;i++){
      const a = Math.random()*Math.PI*2, r = 14 + Math.random()*26, h = 1 + Math.random()*4;
      const rock = new THREE.Mesh(new THREE.ConeGeometry(0.6 + Math.random()*0.9, h, 6), i%4===0 ? accMat : propMat);
      rock.position.set(Math.cos(a)*r, h/2, Math.sin(a)*r); rock.rotation.y = Math.random()*Math.PI;
      scene.add(rock); props.push(rock);
    }
  }

  // ---------------- entrada ----------------
  function bindInput(){
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    canvasEl.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvasEl.addEventListener('wheel', onWheel, { passive:false });
  }
  function onKey(e){
    if (!active) return;
    const k = e.key.toLowerCase(); keys.add(k);
    if (k === '1') castSkill(0); else if (k === '2') castSkill(1);
    else if (k === '3') castSkill(2); else if (k === '4') castSkill(3);
    else if (k === 'q') cycleEnemy(-1); else if (k === 'e') cycleEnemy(1);
    else if (k === ' ' && player && player.group.position.y <= 0.001) player.vy = 6.2;
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  }
  function onKeyUp(e){ keys.delete(e.key.toLowerCase()); }
  function onDown(e){ if (!active || e.button !== 0) return; dragging = true; lastX = e.clientX; lastY = e.clientY; moved = 0; }
  function onMove(e){
    if (ndc && canvasEl){ const r = canvasEl.getBoundingClientRect(); ndc.x = ((e.clientX - r.left)/r.width)*2 - 1; ndc.y = -((e.clientY - r.top)/r.height)*2 + 1; }
    if (dragging && active){
      const dx = e.clientX - lastX, dy = e.clientY - lastY; moved += Math.abs(dx) + Math.abs(dy);
      camYaw -= dx*0.006; camPitch = Math.max(0.08, Math.min(1.2, camPitch + dy*0.005));
      lastX = e.clientX; lastY = e.clientY;
    }
  }
  function onUp(e){ if (!active) return; if (dragging && moved < 7) castSkill(0); dragging = false; }
  function onWheel(e){ if (!active) return; e.preventDefault(); camDist = Math.max(4, Math.min(13, camDist + (e.deltaY>0 ? 0.7 : -0.7))); }

  // ---------------- skills ----------------
  function castSkill(i){
    if (!player || player.dead) return;
    const sk = player.char.skills[i]; if (!sk) return;
    if (player.status.stun) { flash('Aturdido'); return; }
    if ((player.cooldowns[sk.key]||0) > 0) return;
    if (player.chakra < sk.cost) { flash('Sin Chakra'); return; }
    player.chakra -= sk.cost;
    let cd = sk.cooldown; if (i === 0) cd /= (player.char.stats.attackSpeed || 1);
    player.cooldowns[sk.key] = cd; player.cdTotal[sk.key] = cd;
    if (sk.cost === 0) player.chakra = Math.min(player.maxChakra, player.chakra + 5);
    executeSkill(sk, player, enemy);
  }

  function dirTo(a, b){ const dx = b.group.position.x - a.group.position.x, dz = b.group.position.z - a.group.position.z; const d = Math.hypot(dx,dz)||1; return { x:dx/d, z:dz/d, dist:d }; }

  function executeSkill(sk, caster, target){
    const o = sk.offense, el = sk.element, dmgType = sk.dmgType || 'fisico';
    // dirección de apuntado: el jugador apunta al cursor (suelo); el rival apunta al jugador
    let aim;
    if (caster.faction === 'player'){ const dx = aimPoint.x - caster.group.position.x, dz = aimPoint.z - caster.group.position.z; const d = Math.hypot(dx,dz)||1; aim = { x:dx/d, z:dz/d }; }
    else { const d = dirTo(caster, player); aim = { x:d.x, z:d.z }; }
    caster.targetFacing = Math.atan2(aim.x, aim.z);
    caster.swing = 0.35;

    if (sk.dash){
      const dd = sk.dash.distance * U;
      caster.group.position.x += aim.x * dd; caster.group.position.z += aim.z * dd;
      spawnRing(caster.group.position, 1.4, '#ffffff', 0.3);
    }
    if (o){
      const tdir = target ? dirTo(caster, target) : { x:0, z:0, dist:1e9 };
      if (o.shape === 'projectile' || o.shape === 'line'){
        const m = new THREE.Mesh(new THREE.SphereGeometry(o.width? o.width*U*1.2 : 0.28, 12, 12),
          new THREE.MeshStandardMaterial({ color:ELEMENT_META[el].color, emissive:ELEMENT_META[el].glow, emissiveIntensity:1.2 }));
        m.position.set(caster.group.position.x + aim.x*0.6, 1.2, caster.group.position.z + aim.z*0.6);
        scene.add(m);
        projectiles.push({ mesh:m, dx:aim.x, dz:aim.z, speed:(o.speed||540)*U*1.1, range:(o.range||500)*U, traveled:0, el, dmgType, mult:o.mult, effects:o.effects||[], caster, pierce:!!o.pierce, hit:new Set() });
      } else if (o.shape === 'nuke'){
        const tp = (caster.faction === 'player') ? aimPoint.clone() : (target ? target.group.position.clone() : caster.group.position.clone());
        const rr = (o.radius||150)*U;
        spawnTelegraph(tp, rr, el, () => { const tg = caster.faction==='player' ? enemy : player; if (tg && !tg.dead && dist2(tp, tg.group.position) <= rr*rr) hit(caster, tg, el, o.mult, dmgType, o.effects||[]); }, o.delay || 0.6);
      } else {
        // melee / cone (hacia el apuntado) · circle (AoE alrededor del lanzador)
        const r = (o.shape === 'melee' ? (o.range||80) : (o.radius||100)) * U + 0.8;
        const cx = (o.shape === 'circle') ? caster.group.position.x : caster.group.position.x + aim.x*r*0.4;
        const cz = (o.shape === 'circle') ? caster.group.position.z : caster.group.position.z + aim.z*r*0.4;
        spawnRing({ x:cx, z:cz }, r, ELEMENT_META[el].glow, 0.32);
        if (target && !target.dead){
          const within = tdir.dist <= r + 1.2;
          const aligned = (o.shape === 'circle') ? true : (tdir.x*aim.x + tdir.z*aim.z) > 0.1;
          if (within && aligned) hit(caster, target, el, o.mult, dmgType, o.effects||[]);
        }
      }
    }
    if (sk.self) applySelf(sk.self, caster);
    if (sk.zone) spawnZone(sk.zone, caster, aim);
  }

  // ---------------- daño ----------------
  function hit(attacker, target, element, baseMult, dmgType, effects){
    if (!target || target.dead) return;
    let dmg = attacker.char.stats.power * baseMult;
    if (attacker.status.buff) dmg *= (1 + attacker.status.buff.amt);
    const pas = attacker.char.passive;
    if (pas && pas.id === 'furia_sangre'){ const r = attacker.hp/attacker.maxHp; if (r<0.15) dmg*=1.30; else if (r<0.30) dmg*=1.15; }
    let crit = false;
    if (Math.random() < (attacker.char.stats.critChance || 0)){ crit = true; dmg *= (attacker.char.stats.critMult || 1.5); }
    const adv = elementAdvantage(element, target.element);
    dmg *= adv;
    if (target.status.humedad) dmg *= (1 + target.status.humedad.amt);
    const armor = (dmgType === 'magico') ? (target.char.stats.armor||0)*0.5 : (target.char.stats.armor||0);
    dmg *= (1 - armor);
    if (target.status.defense) dmg *= (1 - target.status.defense.amt);
    dmg = Math.max(1, Math.round(dmg));
    if (target.status.shield && target.status.shield.amount > 0){ const ab = Math.min(target.status.shield.amount, dmg); target.status.shield.amount -= ab; dmg -= ab; }
    target.hp -= dmg; target.hitFlash = 0.12;
    const col = crit ? '#ffd23c' : (adv>1 ? '#7CFF6B' : (adv<1 ? '#ff7b7b' : '#ffffff'));
    spawnText(target.group.position, (crit?'¡'+dmg+'!':''+dmg) + (adv>1?' ▲':adv<1?' ▼':''), col, crit?1.4:1);
    for (const ef of effects) applyEffect(target, attacker, ef);
    if (attacker.char.stats.power && (pas && (pas.id==='piel_roca'||pas.id==='furia_sangre'))) {}
    if (target.hp <= 0) die(target);
  }

  function applyEffect(t, src, ef){
    switch(ef.kind){
      case 'burn':    t.status.burn = { dps:ef.dps, t:ef.dur, acc:0 }; break;
      case 'stun':    t.status.stun = { t:Math.max(t.status.stun?t.status.stun.t:0, ef.dur) }; break;
      case 'root':    t.status.root = { t:ef.dur }; break;
      case 'slow':    t.status.slow = { amt:ef.amt, t:ef.dur }; break;
      case 'humedad': t.status.humedad = { amt:ef.amt, t:ef.dur }; break;
      case 'knockback': { const d = dirTo(src, t); t.kbx = d.x * ef.force * U; t.kbz = d.z * ef.force * U; break; }
    }
  }
  function applySelf(list, caster){
    for (const s of list){
      if (s.kind === 'heal'){ let a = s.amount * (caster.char.stats.healPower||1); caster.hp = Math.min(caster.maxHp, caster.hp + a); spawnText(caster.group.position, '+'+Math.round(a), '#7CFF6B', 1); if (caster.char.passive && caster.char.passive.id==='savia_sello'){ caster.status.shield = { amount:(caster.status.shield?caster.status.shield.amount:0)+a*0.3, t:5 }; } }
      else if (s.kind === 'shield'){ caster.status.shield = { amount:(caster.status.shield?caster.status.shield.amount:0)+s.amount, t:s.dur||6 }; spawnText(caster.group.position, '🛡 escudo', '#9fd0ff', 1); }
      else if (s.kind === 'buffDamage'){ caster.status.buff = { amt:s.amt, t:s.dur }; spawnText(caster.group.position, '⬆ furia', '#ff9a3c', 1); }
      else if (s.kind === 'defense'){ caster.status.defense = { amt:s.amt, t:s.dur }; }
      else if (s.kind === 'cleanse'){ for (const k of s.kinds) delete caster.status[k]; }
    }
  }

  // ---------------- efectos visuales ----------------
  function spawnRing(p, r, color, life){
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 8, 24), new THREE.MeshBasicMaterial({ color, transparent:true }));
    m.position.set(p.x, 0.3, p.z); m.rotation.x = -Math.PI/2; scene.add(m);
    rings.push({ mesh:m, t:life, maxT:life });
  }
  function spawnTelegraph(p, r, el, onHit, delay){
    const m = new THREE.Mesh(new THREE.RingGeometry(r*0.85, r, 28), new THREE.MeshBasicMaterial({ color:ELEMENT_META[el].glow, transparent:true, opacity:0.5, side:THREE.DoubleSide }));
    m.position.set(p.x, 0.05, p.z); m.rotation.x = -Math.PI/2; scene.add(m);
    strikes.push({ mesh:m, t:delay, max:delay, onHit, el, r, p:p.clone() });
  }
  function spawnZone(z, caster, aim){
    let px = caster.group.position.x, pz = caster.group.position.z;
    if (z.placement === 'mouse' && caster.faction === 'player'){ px = aimPoint.x; pz = aimPoint.z; }
    const m = new THREE.Mesh(new THREE.CircleGeometry(z.radius*U + 0.6, 28), new THREE.MeshBasicMaterial({ color:ELEMENT_META[z.element].color, transparent:true, opacity:0.22, side:THREE.DoubleSide }));
    m.rotation.x = -Math.PI/2; m.position.set(px, 0.06, pz); scene.add(m);
    zones.push({ mesh:m, t:z.dur, interval:z.interval||0.5, acc:0, el:z.element, perTick:z.perTick||0, healPerTick:z.healPerTick||0, chakraPerTick:z.chakraPerTick||0, radius:z.radius*U+0.6, caster, follow:z.placement==='follow' });
  }
  function makeTextSprite(text, color){
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const c = cv.getContext('2d');
    c.font = 'bold 60px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 9; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.strokeText(text, 128, 64);
    c.fillStyle = color; c.fillText(text, 128, 64);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cv), transparent:true, depthTest:false }));
    return sp;
  }
  function spawnText(p, text, color, scale){
    const sp = makeTextSprite(text, color); const s = 1.5*(scale||1);
    sp.scale.set(s, s*0.5, 1); sp.position.set(p.x + (Math.random()-0.5)*0.6, 2.6, p.z);
    scene.add(sp); texts.push({ sp, t:1.0, vy:1.4 });
  }

  // ---------------- muerte / respawn ----------------
  function die(f){
    f.dead = true; f.hp = 0; f.status = {};
    spawnText(f.group.position, f.faction==='player' ? '¡Derrotado!' : '¡Sellado!', '#ffce54', 1.4);
    f.group.visible = false; f.respawn = f.faction==='player' ? 3 : 2;
  }
  function respawnFighter(f){
    f.dead = false; f.hp = f.maxHp; f.chakra = f.maxChakra; f.status = {}; f.group.visible = true;
    f.group.position.set(0, 0, f.faction==='player' ? 0 : 9);
  }

  // ---------------- bucle ----------------
  function start(){ if (active) return; active = true; last = performance.now(); raf = requestAnimationFrame(loop); }
  function stop(){ active = false; cancelAnimationFrame(raf); keys.clear(); dragging = false; }
  function loop(now){ if (!active) return; let dt = (now-last)/1000; last = now; dt = Math.min(0.05, dt); update(dt); composer.render(); updateHUD(); raf = requestAnimationFrame(loop); }

  function update(dt){
    updateAim();
    updateFighter(player, dt, true);
    if (enemy) updateEnemyAI(dt);
    if (enemy) updateFighter(enemy, dt, false);
    updateProjectiles(dt); updateRings(dt); updateZones(dt); updateStrikes(dt); updateTexts(dt);
    updateCamera(dt);
    // partículas
    const arr = embers.geometry.attributes.position.array;
    for (let i=0;i<arr.length;i+=3){ arr[i+1] += dt*0.8; if (arr[i+1] > 9){ arr[i+1] = 0; arr[i] = player.group.position.x + (Math.random()-0.5)*60; arr[i+2] = player.group.position.z + (Math.random()-0.5)*60; } }
    embers.geometry.attributes.position.needsUpdate = true;
  }

  function updateFighter(f, dt, isPlayer){
    if (f.dead){ f.respawn -= dt; if (f.respawn <= 0) respawnFighter(f); return; }
    for (const k in f.cooldowns) f.cooldowns[k] = Math.max(0, f.cooldowns[k] - dt);
    if (f.maxChakra > 0) f.chakra = Math.min(f.maxChakra, f.chakra + 12*dt);
    if (f.hitFlash > 0) f.hitFlash -= dt;
    tickStatus(f, dt);

    let moving = false;
    if (isPlayer && !f.status.stun && !f.status.root){
      let mx = 0, mz = 0;
      const fwd = { x:-Math.sin(camYaw), z:-Math.cos(camYaw) }, right = { x:Math.cos(camYaw), z:-Math.sin(camYaw) };
      if (keys.has('w')||keys.has('arrowup')){ mx+=fwd.x; mz+=fwd.z; }
      if (keys.has('s')||keys.has('arrowdown')){ mx-=fwd.x; mz-=fwd.z; }
      if (keys.has('d')||keys.has('arrowright')){ mx+=right.x; mz+=right.z; }
      if (keys.has('a')||keys.has('arrowleft')){ mx-=right.x; mz-=right.z; }
      if (mx||mz){ const d=Math.hypot(mx,mz); mx/=d; mz/=d; const sp=keys.has('shift')?7:4.2; f.group.position.x+=mx*sp*dt; f.group.position.z+=mz*sp*dt; f.targetFacing=Math.atan2(mx,mz); moving=true; }
    }
    // el jugador siempre mira hacia el cursor (apuntado con el ratón)
    if (isPlayer && aimPoint){ const adx = aimPoint.x - f.group.position.x, adz = aimPoint.z - f.group.position.z; if (Math.hypot(adx,adz) > 0.4) f.targetFacing = Math.atan2(adx, adz); }
    // knockback
    if (f.kbx || f.kbz){ f.group.position.x += f.kbx*dt*6; f.group.position.z += f.kbz*dt*6; f.kbx*=0.85; f.kbz*=0.85; if (Math.abs(f.kbx)<0.01) f.kbx=0; if (Math.abs(f.kbz)<0.01) f.kbz=0; }
    // límites
    f.group.position.x = Math.max(-40, Math.min(40, f.group.position.x));
    f.group.position.z = Math.max(-40, Math.min(40, f.group.position.z));
    f.group.rotation.y = lerpAngle(f.group.rotation.y, f.targetFacing, 0.2);
    // salto
    f.vy -= 16*dt; f.group.position.y += f.vy*dt; if (f.group.position.y < 0){ f.group.position.y = 0; f.vy = 0; }
    // animación
    if (f.swing > 0){ f.swing -= dt*2; f.parts.rArm.rotation.x = -1.2 + (0.35-f.swing)*3; }
    else { if (moving) f.walkPhase += dt*9; const sw = moving ? Math.sin(f.walkPhase)*0.6 : Math.sin(performance.now()*0.002)*0.05;
      f.parts.lLeg.rotation.x=sw; f.parts.rLeg.rotation.x=-sw; f.parts.lArm.rotation.x=-sw*0.8-0.15; f.parts.rArm.rotation.x=sw*0.8-0.3;
      f.parts.head.position.y = f.headBaseY + (moving?Math.abs(Math.sin(f.walkPhase))*0.04:0); }
  }

  function tickStatus(f, dt){
    const s = f.status;
    if (s.burn){ s.burn.t -= dt; s.burn.acc += dt; while (s.burn.acc >= 0.5){ s.burn.acc -= 0.5; f.hp -= s.burn.dps*0.5; spawnText(f.group.position, Math.round(s.burn.dps*0.5)+'', '#ff8a3c', 0.7); if (f.hp<=0){ die(f); break; } } if (s.burn && s.burn.t<=0) delete s.burn; }
    ['stun','root','slow','humedad','buff','defense','shield'].forEach(k => { if (s[k]){ s[k].t -= dt; if (s[k].t <= 0) delete s[k]; } });
  }

  function updateEnemyAI(dt){
    const e = enemy, p = player;
    if (e.dead) return;
    e.hp = Math.min(e.maxHp, e.hp + ENEMY_REGEN*dt);
    e.basicCd -= dt;
    const d = dirTo(e, p);
    e.targetFacing = Math.atan2(d.x, d.z);
    if (!e.status.stun && !e.status.root && d.dist > 2.6){ const sp = 2.6 * (e.status.slow?(1-e.status.slow.amt):1); e.group.position.x += d.x*sp*dt; e.group.position.z += d.z*sp*dt; }
    if (!e.status.stun && d.dist <= 3 && e.basicCd <= 0 && !p.dead){ e.swing = 0.35; hit(e, p, e.element, e.char.skills[0].offense.mult, 'fisico', e.char.skills[0].offense.effects||[]); e.basicCd = 1.6; }
  }

  function updateProjectiles(dt){
    for (const pr of projectiles){
      pr.mesh.position.x += pr.dx*pr.speed*dt; pr.mesh.position.z += pr.dz*pr.speed*dt; pr.traveled += pr.speed*dt;
      const tg = pr.caster.faction==='player' ? enemy : player;
      if (tg && !tg.dead && !pr.hit.has(tg) && dist2(pr.mesh.position, tg.group.position) < 1.6){ hit(pr.caster, tg, pr.el, pr.mult, pr.dmgType, pr.effects); pr.hit.add(tg); if (!pr.pierce) pr.done = true; }
      if (pr.traveled >= pr.range) pr.done = true;
    }
    projectiles = projectiles.filter(p => { if (p.done){ scene.remove(p.mesh); return false; } return true; });
  }
  function updateRings(dt){
    for (const r of rings){ r.t -= dt; const k = 1 + (1 - r.t/r.maxT)*0.6; r.mesh.scale.set(k,k,k); r.mesh.material.opacity = Math.max(0, r.t/r.maxT); }
    rings = rings.filter(r => { if (r.t<=0){ scene.remove(r.mesh); return false; } return true; });
  }
  function updateStrikes(dt){
    for (const s of strikes){ s.t -= dt; s.mesh.material.opacity = 0.3 + 0.4*Math.abs(Math.sin(s.t*12)); if (s.t <= 0){ s.onHit(); spawnRing(s.p, s.r, ELEMENT_META[s.el].glow, 0.4); s.done = true; } }
    strikes = strikes.filter(s => { if (s.done){ scene.remove(s.mesh); return false; } return true; });
  }
  function updateZones(dt){
    for (const z of zones){
      if (z.follow){ z.mesh.position.x = z.caster.group.position.x; z.mesh.position.z = z.caster.group.position.z; }
      z.t -= dt; z.acc += dt; z.mesh.material.opacity = 0.1 + 0.12*Math.max(0, z.t/3);
      while (z.acc >= z.interval){ z.acc -= z.interval;
        const tg = z.caster.faction==='player' ? enemy : player;
        if (z.perTick>0 && tg && !tg.dead && dist2(z.mesh.position, tg.group.position) <= z.radius*z.radius){ const adv = elementAdvantage(z.el, tg.element); const d = Math.max(1, Math.round(z.perTick*adv)); tg.hp -= d; tg.hitFlash = 0.1; spawnText(tg.group.position, d+'', adv>1?'#7CFF6B':(adv<1?'#ff7b7b':'#bfe6ff'), 0.7); if (tg.hp<=0) die(tg); }
        if (z.healPerTick>0 && !z.caster.dead){ z.caster.hp = Math.min(z.caster.maxHp, z.caster.hp + z.healPerTick); }
        if (z.chakraPerTick>0 && !z.caster.dead){ z.caster.chakra = Math.min(z.caster.maxChakra, z.caster.chakra + z.chakraPerTick); }
      }
    }
    zones = zones.filter(z => { if (z.t<=0){ scene.remove(z.mesh); return false; } return true; });
  }
  function updateTexts(dt){
    for (const t of texts){ t.t -= dt; t.sp.position.y += t.vy*dt; t.sp.material.opacity = Math.max(0, t.t); }
    texts = texts.filter(t => { if (t.t<=0){ scene.remove(t.sp); return false; } return true; });
  }
  function updateCamera(dt){
    const tx = player.group.position.x, ty = player.group.position.y + 1.4, tz = player.group.position.z;
    const cp = Math.cos(camPitch);
    const cx = tx + Math.sin(camYaw)*camDist*cp, cy = ty + Math.sin(camPitch)*camDist, cz = tz + Math.cos(camYaw)*camDist*cp;
    const k = Math.min(1, 10*dt);
    camera.position.x += (cx-camera.position.x)*k; camera.position.y += (cy-camera.position.y)*k; camera.position.z += (cz-camera.position.z)*k;
    camera.lookAt(tx, ty, tz);
  }
  function updateAim(){
    if (!raycaster) return;
    raycaster.setFromCamera(ndc, camera);
    const hp = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(groundPlane, hp)) aimPoint.copy(hp);
    if (reticle){ reticle.position.set(aimPoint.x, 0.06, aimPoint.z); const rt = 1 + Math.sin(performance.now()*0.005)*0.08; reticle.scale.set(rt, rt, rt); }
  }

  // ---------------- HUD (DOM superpuesto) ----------------
  function buildHUD(){
    if (!hudEl) return;
    const sk = player.char.skills.map(s => '<div class="h3-slot" data-key="'+s.key+'"><span class="k">'+s.key+'</span><span class="nm">'+s.name+'</span><span class="cd"></span></div>').join('');
    hudEl.innerHTML =
        '<div class="h3-top"><span id="h3-ename">Centinela</span><div class="h3-bar"><i id="h3-ehp"></i></div></div>'
      + '<div class="h3-hint">Apunta con el <b>ratón</b> · <b>clic izq.</b>/<b>1</b> atacar · <b>2 3 4</b> skills · <b>WASD</b> mover · <b>Espacio</b> saltar · arrastrar gira cámara · <b>Q/E</b> rival</div>'
      + '<div class="h3-bottom"><div class="h3-vitals"><div class="h3-name" id="h3-pname"></div>'
      + '<div class="h3-bar hp"><i id="h3-php"></i></div><div class="h3-bar ck"><i id="h3-pck"></i></div></div>'
      + '<div class="h3-skills">'+sk+'</div></div>';
    hud = {
      ename: document.getElementById('h3-ename'), ehp: document.getElementById('h3-ehp'),
      pname: document.getElementById('h3-pname'), php: document.getElementById('h3-php'), pck: document.getElementById('h3-pck'),
      slots: Array.prototype.slice.call(hudEl.querySelectorAll('.h3-slot')),
    };
    hud.pname.textContent = player.char.name + ' · ' + player.char.archetype.name;
  }
  function updateHUD(){
    if (!hud || !player) return;
    hud.php.style.width = Math.max(0, player.hp/player.maxHp*100) + '%';
    hud.pck.style.width = (player.maxChakra? player.chakra/player.maxChakra*100 : 0) + '%';
    hud.php.parentNode.dataset.txt = Math.ceil(Math.max(0,player.hp)) + ' / ' + player.maxHp;
    if (enemy){ hud.ename.textContent = 'Centinela · ' + ELEMENT_META[enemy.element].emoji + ' ' + enemy.element; hud.ehp.style.width = Math.max(0, enemy.hp/enemy.maxHp*100) + '%'; }
    player.char.skills.forEach((s, idx) => {
      const slot = hud.slots[idx]; if (!slot) return;
      const cd = player.cooldowns[s.key]||0, tot = player.cdTotal[s.key]||s.cooldown;
      const ready = cd<=0 && player.chakra>=s.cost;
      slot.classList.toggle('ready', ready); slot.classList.toggle('low', player.chakra<s.cost);
      slot.querySelector('.cd').textContent = cd>0 ? cd.toFixed(1) : '';
      slot.querySelector('.cd').style.height = cd>0 ? (cd/tot*100)+'%' : '0%';
    });
  }
  function flash(msg){ if (hud && hud.ename) spawnText(player.group.position, msg, '#ffce54', 1); }

  // ---------------- util ----------------
  function dist2(a, b){ const dx=a.x-b.x, dz=a.z-b.z; return dx*dx+dz*dz; }
  function lerpAngle(a, b, t){ let d = ((b-a+Math.PI)%(Math.PI*2))-Math.PI; if (d<-Math.PI) d+=Math.PI*2; return a + d*t; }

  return { init, setHero, start, stop };
})();
