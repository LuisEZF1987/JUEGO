// ====================================================================
//  mobs.js — Vida del mundo: poblado (casas/árboles), criaturas animadas
//  que se cazan por recompensa, y un "Dios Encadenado" (Primordial) por
//  Nación como jefe. Es client-side (cada jugador caza sus propias bestias).
//  Expone window.Mobs.
// ====================================================================

(function(){
  let THREE = null, scene = null;
  const CACHE = {};            // url -> { scene, animations }
  let mobs = [], texts = [], nearest = null, pendingKills = [];

  // criaturas comunes (modelos animados CC de three.js)
  const ANIMALS = [
    { url:'assets/models/Horse.glb',    h:1.7, fly:0,   hp:36, name:'Corcel Salvaje', gold:[6,12] },
    { url:'assets/models/Stork.glb',    h:1.6, fly:2.2, hp:22, name:'Cigüeña',        gold:[5,10] },
    { url:'assets/models/Flamingo.glb', h:1.6, fly:2.4, hp:20, name:'Flamenco',       gold:[5,10] },
    { url:'assets/models/Parrot.glb',   h:1.0, fly:2.7, hp:15, name:'Loro Salvaje',   gold:[4,8]  },
  ];
  // Dios Encadenado por elemento (lore) + material divino que suelta
  const GOD = {
    Fuego:  { n:'Pyrothar',   m:'Brasa Eterna' },
    Viento: { n:'Sylvaris',   m:'Pluma de Tempestad' },
    Rayo:   { n:'Vortigan',   m:'Fragmento de Trueno' },
    Tierra: { n:'Terrgoth',   m:'Corazón Pétreo' },
    Agua:   { n:'Nereon',     m:'Lágrima Abisal' },
    Madera: { n:'Aethelgard', m:'Savia Eterna' },
  };

  // ---- botín persistente ----
  let loot = (function(){ try { return JSON.parse(localStorage.getItem('el_loot')) || { gold:0, kills:0, mats:{} }; } catch(e){ return { gold:0, kills:0, mats:{} }; } })();
  let lootBound = false;
  // enlaza el botín al personaje activo (Account) — así oro/bajas/materiales son por personaje
  function bindLoot(o){ if (o){ if (!o.mats) o.mats = {}; if (o.gold == null) o.gold = 0; if (o.kills == null) o.kills = 0; loot = o; lootBound = true; } }
  function saveLoot(){ if (lootBound && window.Account && Account.save){ Account.save(); return; } try { localStorage.setItem('el_loot', JSON.stringify(loot)); } catch(e){} }
  function getLoot(){ return loot; }

  // ---- carga de modelos ----
  function preload(_THREE){
    THREE = _THREE;
    const loader = new THREE.GLTFLoader();
    return Promise.all(ANIMALS.map(a => new Promise(res => {
      if (CACHE[a.url]) return res();
      loader.load(a.url, g => { CACHE[a.url] = { scene:g.scene, animations:g.animations||[] }; res(); },
        undefined, err => { console.warn('[mobs] no cargó', a.url, err); res(); });
    })));
  }

  // ---- utilidades ----
  function autoScale(root, targetH){
    root.updateMatrixWorld(true);
    const s = new THREE.Vector3(); new THREE.Box3().setFromObject(root).getSize(s);
    root.scale.setScalar(targetH / (s.y || 1)); root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(root);
    root.position.y -= b.min.y; root.position.x -= (b.min.x+b.max.x)/2; root.position.z -= (b.min.z+b.max.z)/2;
  }
  function textSprite(text, color, big){
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d');
    c.font = 'bold ' + (big?40:34) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.strokeText(text, 128, 32); c.fillStyle = color; c.fillText(text, 128, 32);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cv), transparent:true, depthTest:false }));
  }
  function makeBar(){
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 18; const c = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthTest:false })); sp.scale.set(2.2, 0.31, 1);
    function set(frac){ frac = Math.max(0, Math.min(1, frac)); c.clearRect(0,0,128,18); c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0,0,128,18); c.fillStyle = frac>0.5?'#5ad469':(frac>0.25?'#ffd23c':'#ff5a3c'); c.fillRect(2,2,124*frac,14); tex.needsUpdate = true; }
    set(1); return { sprite:sp, set };
  }
  function floatDmg(pos, text, color, big){
    const sp = textSprite(text, color, big); const s = big?1.7:1.1; sp.scale.set(s, s*0.5, 1);
    sp.position.set(pos.x, pos.y + 2.2, pos.z); scene.add(sp); texts.push({ sp, t:1 });
  }
  // RNG determinista (mulberry32): misma semilla → MISMO mundo (mobs/casas/árboles) en todos los clientes.
  const WORLD_SEED = 0x5eed;
  function makeRng(seed){ let a = seed >>> 0; return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function pickTarget(m){ const a = Math.random()*Math.PI*2, r = Math.random()*11; m.tx = m.cx + Math.cos(a)*r; m.tz = m.cz + Math.sin(a)*r; }

  // ---- construir una criatura ----
  function buildMob(cfg, nation, isBoss, sx, sz){
    const src = CACHE[cfg.url]; if (!src) return null;
    const root = src.scene.clone(true);
    root.traverse(o => { if (o.isMesh){ o.castShadow = true; o.frustumCulled = false;
      if (isBoss){ o.material = (Array.isArray(o.material)?o.material[0]:o.material).clone(); o.material.color = new THREE.Color(ELEMENT_META[nation.element].color); o.material.emissive = new THREE.Color(ELEMENT_META[nation.element].glow); o.material.emissiveIntensity = 0.5; }
    }});
    const group = new THREE.Group(); group.add(root);
    autoScale(root, isBoss ? 4.6 : cfg.h);

    const mixer = new THREE.AnimationMixer(root);
    if (src.animations[0]){ const act = mixer.clipAction(src.animations[0]); act.play(); act.setEffectiveTimeScale(isBoss ? 0.8 : 1.1); }

    const el = nation.element;
    const m = {
      group, mixer, el, isBoss,
      maxHp: isBoss ? 600 : cfg.hp, hp: isBoss ? 600 : cfg.hp,
      name: isBoss ? (GOD[el].n + ' Encadenado') : cfg.name,
      gold: cfg.gold || [5,10], flyY: isBoss ? 0 : cfg.fly,
      cx: nation.x, cz: nation.z, tx:0, tz:0, speed: isBoss ? 1.4 : (2 + Math.random()*1.2),
      status:{ stun:0, slow:0, burn:0, burnDps:0, burnAcc:0 }, atkCd:0,
      dead:false, respawn:0, hitFlash:0,
    };
    if (isBoss){ const aura = new THREE.PointLight(new THREE.Color(ELEMENT_META[el].color).getHex(), 2, 12); aura.position.y = 2.5; group.add(aura); }
    const label = textSprite((isBoss?'☠ ':'') + m.name, isBoss?'#ffce54':'#dfe7ff', isBoss);
    label.scale.set(isBoss?6:3, isBoss?1.5:0.75, 1); label.position.y = isBoss?6.2:2.2; group.add(label);
    m.bar = makeBar(); m.bar.sprite.position.y = isBoss?5.6:1.9; group.add(m.bar.sprite);
    pickTarget(m);
    const ox = (sx != null) ? sx : nation.x + (Math.random()-0.5)*16, oz = (sz != null) ? sz : nation.z + (Math.random()-0.5)*16;
    m.spawnX = ox; m.spawnZ = oz;
    group.position.set(ox, m.flyY, oz);
    scene.add(group);
    return m;
  }

  // ---- poblar el mundo ----
  function populate(_THREE, _scene, nations){
    THREE = _THREE; scene = _scene;
    nations.forEach((n, ni) => {
      const rng = makeRng(WORLD_SEED + ni*101 + 7);   // misma semilla por nación → mismos mobs/posiciones para todos
      for (let i=0;i<4;i++){
        const cfg = ANIMALS[Math.floor(rng()*ANIMALS.length)];
        const sx = n.x + (rng()-0.5)*16, sz = n.z + (rng()-0.5)*16;
        const m = buildMob(cfg, n, false, sx, sz); if (m) mobs.push(m);
      }
      const boss = buildMob(ANIMALS[0], n, true, n.x, n.z); if (boss) mobs.push(boss);   // Jefe (Dios Encadenado) al centro de la nación
    });
  }

  // ---- poblado: casas y árboles ----
  function buildEnvironment(_THREE, _scene, nations){
    THREE = _THREE; const sc = _scene;
    const trunkMat = new THREE.MeshStandardMaterial({ color:0x6b4a2a, roughness:1 });
    const leafMat  = new THREE.MeshStandardMaterial({ color:0x2e7d32, roughness:0.9 });
    const wallMat  = new THREE.MeshStandardMaterial({ color:0xb8a079, roughness:0.95 });
    const roofMat  = new THREE.MeshStandardMaterial({ color:0x8a3b2a, roughness:0.9 });
    const doorMat  = new THREE.MeshStandardMaterial({ color:0x4a2f1a, roughness:1 });
    function tree(x, z, s, rot){
      const g = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16*s, 0.24*s, 1.4*s, 6), trunkMat); tr.position.y = 0.7*s; tr.castShadow = true; g.add(tr);
      for (let i=0;i<3;i++){ const f = new THREE.Mesh(new THREE.ConeGeometry((1.0-i*0.22)*s, 1.1*s, 7), leafMat); f.position.y = (1.3 + i*0.55)*s; f.castShadow = true; g.add(f); }
      g.position.set(x, 0, z); g.rotation.y = (rot != null) ? rot : Math.random()*Math.PI; sc.add(g);
    }
    function house(x, z, rot){
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2.6), wallMat); base.position.y = 1; base.castShadow = true; base.receiveShadow = true; g.add(base);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.6, 4), roofMat); roof.position.y = 2.8; roof.rotation.y = Math.PI/4; roof.castShadow = true; g.add(roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.12), doorMat); door.position.set(0, 0.6, 1.32); g.add(door);
      g.position.set(x, 0, z); g.rotation.y = rot || 0; sc.add(g);
    }
    nations.forEach((n, ni) => {
      const rng = makeRng(WORLD_SEED + ni*211 + 31);   // mismo bosque/casas para todos los clientes
      for (let i=0;i<3;i++){ const a = rng()*Math.PI*2, r = 9 + rng()*3.5; house(n.x + Math.cos(a)*r, n.z + Math.sin(a)*r, a + Math.PI); }
      const count = n.element === 'Madera' ? 16 : 8;
      for (let i=0;i<count;i++){ const a = rng()*Math.PI*2, r = 5 + rng()*9; tree(n.x + Math.cos(a)*r, n.z + Math.sin(a)*r, 0.8 + rng()*0.7, rng()*Math.PI); }
    });
  }

  // ---- estados aplicados por skills (aturdir / ralentizar / quemar) ----
  function tickStatus(m, dt){
    const s = m.status;
    if (s.stun > 0) s.stun -= dt;
    if (s.slow > 0) s.slow -= dt;
    if (s.burn > 0){ s.burn -= dt; s.burnAcc += dt; while (s.burnAcc >= 0.5){ s.burnAcc -= 0.5; hurt(m, s.burnDps*0.5, '#ff8a3c', false); if (m.dead) break; } }
  }

  // ---- bucle ----
  // Devuelve el daño total infligido al jugador este frame (las bestias contraatacan).
  function update(dt, playerPos){
    let playerDmg = 0;
    nearest = null; let bestD = 5*5;
    for (const m of mobs){
      m.mixer.update(dt);
      if (m.dead){ m.respawn -= dt; if (m.respawn <= 0) revive(m); continue; }
      if (m.hitFlash > 0) m.hitFlash -= dt;
      tickStatus(m, dt);
      const stunned = m.status.stun > 0, slowF = m.status.slow > 0 ? 0.5 : 1;
      const toP = playerPos ? Math.hypot(m.group.position.x-playerPos.x, m.group.position.z-playerPos.z) : 1e9;
      const aggroR = m.isBoss ? 20 : 13, reach = m.isBoss ? 3.4 : 1.9;
      if (!stunned && playerPos && toP < aggroR){
        // perseguir y atacar al jugador
        const dx = playerPos.x-m.group.position.x, dz = playerPos.z-m.group.position.z, d = Math.hypot(dx,dz)||1;
        m.group.rotation.y = Math.atan2(dx, dz);
        if (d > reach){ m.group.position.x += dx/d*m.speed*1.35*slowF*dt; m.group.position.z += dz/d*m.speed*1.35*slowF*dt; }
        else { m.atkCd -= dt; if (m.atkCd <= 0){ m.atkCd = m.isBoss ? 2.0 : 1.4; playerDmg += m.isBoss ? 16 : 6; } }
      } else if (!stunned){
        // vagar
        const dx = m.tx-m.group.position.x, dz = m.tz-m.group.position.z, d = Math.hypot(dx, dz);
        if (d < 0.7) pickTarget(m);
        else { m.group.position.x += dx/d*m.speed*slowF*dt; m.group.position.z += dz/d*m.speed*slowF*dt; m.group.rotation.y = Math.atan2(dx, dz); }
      }
      if (m.flyY > 0) m.group.position.y = m.flyY + Math.sin(performance.now()*0.003 + m.cx)*0.3;
      if (playerPos){ const pd = (m.group.position.x-playerPos.x)**2 + (m.group.position.z-playerPos.z)**2; if (pd < bestD){ bestD = pd; nearest = m; } }
    }
    for (const t of texts){ t.t -= dt; t.sp.position.y += dt*1.5; t.sp.material.opacity = Math.max(0, t.t); }
    texts = texts.filter(t => { if (t.t <= 0){ scene.remove(t.sp); return false; } return true; });
    return playerDmg;
  }
  function revive(m){ m.dead = false; m.hp = m.maxHp; m.bar.set(1); m.group.visible = true; m.status.stun=0; m.status.slow=0; m.status.burn=0; m.atkCd=0; m.group.position.set(m.cx + (Math.random()-0.5)*16, m.flyY, m.cz + (Math.random()-0.5)*16); pickTarget(m); }

  // ---- daño a una criatura (núcleo: barra, número flotante, muerte+botín) ----
  function hurt(m, d, color, crit){
    if (!m || m.dead) return null;
    d = Math.max(1, Math.round(d));
    m.hp -= d; m.hitFlash = 0.15; m.bar.set(m.hp / m.maxHp);
    floatDmg(m.group.position, (crit?'¡'+d+'!':''+d), color || '#ffffff', m.isBoss);
    if (m.hp > 0) return { hit:true, name:m.name };
    return kill(m);
  }
  function kill(m){
    m.dead = true; m.group.visible = false; m.respawn = m.isBoss ? 30 : 8;
    loot.kills++;
    const g = m.isBoss ? 120 : (m.gold[0] + Math.floor(Math.random()*(m.gold[1]-m.gold[0]+1)));
    loot.gold += g;
    let mat = null;
    if (m.isBoss){ mat = GOD[m.el].m; }
    else if (Math.random() < 0.18){ mat = ['Polvo de Refinamiento','Cristal de Refinamiento','Madera de Roble','Lingote de Hierro'][Math.floor(Math.random()*4)]; }
    if (mat){ loot.mats[mat] = (loot.mats[mat]||0) + 1; }
    saveLoot();
    floatDmg(m.group.position, '+' + g + ' oro', '#ffd23c', m.isBoss);
    const res = { killed:true, name:m.name, gold:g, mat, isBoss:m.isBoss, el:m.el };
    pendingKills.push(res);
    return res;
  }

  // ---- combate: ataque básico a la más cercana (compat) ----
  function attack(playerPos, dmg){
    if (!nearest || nearest.dead) return null;
    const crit = Math.random() < 0.2;
    return hurt(nearest, dmg * (crit?1.8:1), crit?'#ffd23c':'#ffffff', crit);
  }
  // ---- daño dirigido (objetivo fijado / skills): ventaja elemental + efectos ----
  function damageMob(m, dmg, opts){
    if (!m || m.dead) return null;
    opts = opts || {};
    const adv = (opts.element && typeof elementAdvantage === 'function') ? elementAdvantage(opts.element, m.el) : 1;
    const crit = (opts.crit != null) ? opts.crit : (Math.random() < 0.15);
    const d = dmg * adv * (crit ? 1.7 : 1);
    const color = crit ? '#ffd23c' : (adv > 1 ? '#7CFF6B' : (adv < 1 ? '#ff7b7b' : '#ffffff'));
    const res = hurt(m, d, color, crit);
    for (const e of (opts.effects || [])){
      if (e.kind === 'burn'){ m.status.burn = Math.max(m.status.burn, e.dur); m.status.burnDps = e.dps; }
      else if (e.kind === 'stun' || e.kind === 'root'){ m.status.stun = Math.max(m.status.stun, e.dur); }
      else if (e.kind === 'slow'){ m.status.slow = Math.max(m.status.slow, e.dur); }
      else if (e.kind === 'knockback' && opts.from){ const dx=m.group.position.x-opts.from.x, dz=m.group.position.z-opts.from.z, dd=Math.hypot(dx,dz)||1, f=(e.force||200)*0.012; m.group.position.x += dx/dd*f; m.group.position.z += dz/dd*f; }
    }
    return res;
  }
  function mobsInRadius(pos, r){
    const r2 = r*r, out = [];
    for (const m of mobs){ if (m.dead) continue; const dx=m.group.position.x-pos.x, dz=m.group.position.z-pos.z; if (dx*dx+dz*dz <= r2) out.push(m); }
    return out;
  }
  function pick(raycaster){
    let best=null, bestT=Infinity;
    for (const m of mobs){ if (m.dead) continue; const hits = raycaster.intersectObject(m.group, true); if (hits.length && hits[0].distance < bestT){ bestT = hits[0].distance; best = m; } }
    return best;
  }
  function takeKills(){ const k = pendingKills; pendingKills = []; return k; }
  // gasta oro + materiales del botín si alcanza (para la Forja); devuelve true si se realizó.
  function spend(reqMats, reqGold){
    reqGold = reqGold || 0;
    if (loot.gold < reqGold) return false;
    for (const k in (reqMats || {})){ if ((loot.mats[k]||0) < reqMats[k]) return false; }
    loot.gold -= reqGold;
    for (const k in (reqMats || {})){ loot.mats[k] -= reqMats[k]; if (loot.mats[k] <= 0) delete loot.mats[k]; }
    saveLoot();
    return true;
  }
  // reemplaza el botín completo (al restaurar el save de la cuenta desde el servidor)
  function setLoot(l){ if (!l || typeof l !== 'object') return; loot.gold = l.gold||0; loot.kills = l.kills||0; loot.mats = l.mats||{}; saveLoot(); }
  // materiales de Jefe (para la Forja divina): cualquiera de los 6 sirve
  const BOSS_MATS = Object.keys(GOD).map(k => GOD[k].m);
  function bossMatCount(){ let n = 0; for (const k of BOSS_MATS) n += (loot.mats[k]||0); return n; }
  function spendBoss(n){
    n = n || 1; if (bossMatCount() < n) return false;
    let need = n;
    for (const k of BOSS_MATS){ if (need <= 0) break; const take = Math.min(need, loot.mats[k]||0); if (take > 0){ loot.mats[k] -= take; if (loot.mats[k] <= 0) delete loot.mats[k]; need -= take; } }
    saveLoot(); return true;
  }
  function getNearest(){ return nearest; }
  function targetsNear(pos, range){
    const r2 = range*range, out = [];
    for (const m of mobs){ if (m.dead) continue; const dx=m.group.position.x-pos.x, dz=m.group.position.z-pos.z, d2=dx*dx+dz*dz; if (d2 <= r2) out.push({ m, d2 }); }
    out.sort((a,b) => a.d2 - b.d2);
    return out.map(o => o.m);
  }
  function reset(){ mobs.forEach(m => { scene && scene.remove(m.group); }); mobs = []; texts.forEach(t => scene && scene.remove(t.sp)); texts = []; nearest = null; pendingKills = []; }

  // huella del layout (pruebas / futuro minimapa): nombre@spawnX,spawnZ — determinista, igual en todos los clientes
  function snapshot(){ return mobs.map(m => m.name + (m.isBoss?'*':'') + '@' + Math.round(m.spawnX) + ',' + Math.round(m.spawnZ)); }
  window.Mobs = { preload, populate, buildEnvironment, update, attack, damageMob, mobsInRadius, pick, getNearest, targetsNear, takeKills, spend, spendBoss, bossMatCount, setLoot, bindLoot, getLoot, reset, snapshot };
})();
