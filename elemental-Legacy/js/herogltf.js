// ====================================================================
//  herogltf.js — Pipeline de modelos 3D riggeados (glTF/GLB).
//  Reemplaza la construcción por cajas (hero3d.js) con modelos reales
//  que traen esqueleto y animaciones (idle/caminar/correr/atacar/...).
//
//  CÓMO PONER TUS PROPIOS PERSONAJES:
//   1. Exporta tu modelo riggeado como .glb (Mixamo / KayKit / Quaternius
//      / Synty / Blender). Inclúyele clips de animación con nombre.
//   2. Cópialo en assets/models/  (p.ej. assets/models/kael.glb)
//   3. Añade una entrada en HERO_MODELS abajo, mapeando el id del héroe
//      (ver characters.js: brunn, kael, gorr, sylth, drako, lyra) al archivo
//      y a los NOMBRES de sus clips de animación. Eso es todo.
//
//  El sistema auto-escala cualquier modelo a una altura objetivo y le
//  pone los pies en el suelo, así que no tienes que calibrar la escala.
// ====================================================================

(function(){
  // -------- configuración de modelos --------
  // Personajes KayKit "Adventurers" (CC0, gratis, sin atribución). Todos
  // comparten el mismo esqueleto y 76 animaciones; con armadura, capa y armas
  // ya incluidas. Cada modelo trae VARIAS armas a la vez, así que ocultamos
  // las que no se usan (lista `hide`) y elegimos la animación de ataque acorde.
  const K = 'assets/models/kaykit/Knight.glb';
  const B = 'assets/models/kaykit/Barbarian.glb';
  const M = 'assets/models/kaykit/Mage.glb';
  const R = 'assets/models/kaykit/Rogue.glb';

  const HIDE = {
    knight:    ['1H_Sword_Offhand','Badge_Shield','Rectangle_Shield','Spike_Shield','2H_Sword'], // deja: espada 1m + escudo redondo
    barbarian: ['1H_Axe','1H_Axe_Offhand','Barbarian_Round_Shield','Mug'],                        // deja: hacha a 2 manos
    mage:      ['Spellbook','Spellbook_open','1H_Wand'],                                          // deja: bastón a 2 manos
    rogue:     ['1H_Crossbow','2H_Crossbow','Throwable'],                                         // deja: dagas dobles
  };

  const DEFAULT_HERO_MODEL = {
    url: K,
    scaleHeight: 2.4,    // altura objetivo en unidades del mundo
    faceOffset: 0,       // si el personaje camina de espaldas, pon Math.PI
    tint: false,         // texturas KayKit intactas; el color del elemento va en la luz de aura
    hide: HIDE.knight,
    clips: { idle:'Idle', walk:'Walking_A', run:'Running_A', attack:'1H_Melee_Attack_Slice_Diagonal', jump:'Jump_Idle', die:'Death_A' },
  };

  // Héroe -> modelo + arma + animación de ataque acorde al arquetipo (ver characters.js).
  const HERO_MODELS = {
    brunn: { url:K, hide:HIDE.knight,    clips:{ attack:'1H_Melee_Attack_Slice_Diagonal' } }, // tanque: espada + escudo
    kael:  { url:B, hide:HIDE.barbarian, clips:{ attack:'2H_Melee_Attack_Chop' } },           // berserker: hacha 2 manos
    drako: { url:B, hide:HIDE.barbarian, clips:{ attack:'2H_Melee_Attack_Chop' } },           // verdugo crítico: hacha
    gorr:  { url:M, hide:HIDE.mage,      clips:{ attack:'Spellcast_Shoot' } },                 // mago: bastón
    lyra:  { url:M, hide:HIDE.mage,      clips:{ attack:'Spellcast_Shoot' } },                 // sanadora: bastón
    sylth: { url:R, hide:HIDE.rogue,     clips:{ attack:'Dualwield_Melee_Attack_Slice' } },    // asesina: dagas dobles
    // ── GUERREROS REALISTAS (IA 3D) ── para reemplazar un héroe, descomenta y ajusta:
    //   1) valida tu .glb:  node tools/inspect-glb.js assets/models/warriors/knight.glb
    //   2) usa el "mapeo sugerido" que imprime el validador como clips
    //   3) hide:[] (los modelos IA no traen armas alternas); scaleHeight ~2.2-2.6; faceOffset 0 ó Math.PI
    // brunn: { url:'assets/models/warriors/knight.glb', hide:[], scaleHeight:2.4, faceOffset:0,
    //          clips:{ idle:'Idle', walk:'Walking', run:'Running', attack:'Slash', die:'Death' } },
  };

  const HERO_MODELS_CACHE = {};  // url -> { scene, animations }

  function modelFor(char){
    const o = (char && HERO_MODELS[char.id]) || {};
    return Object.assign({}, DEFAULT_HERO_MODEL, o, {
      clips: Object.assign({}, DEFAULT_HERO_MODEL.clips, o.clips || {})
    });
  }

  // -------- precarga (asíncrona) --------
  function preloadHeroModels(THREE, onProgress){
    const urls = new Set([DEFAULT_HERO_MODEL.url]);
    for (const id in HERO_MODELS){ if (HERO_MODELS[id].url) urls.add(HERO_MODELS[id].url); }
    const list = Array.from(urls);
    const loader = new THREE.GLTFLoader();
    let done = 0;
    return Promise.all(list.map(url => {
      if (HERO_MODELS_CACHE[url]){ done++; if (onProgress) onProgress(Math.round(done / list.length * 100)); return Promise.resolve(); }
      return new Promise((resolve) => {
        loader.load(url, gltf => {
          HERO_MODELS_CACHE[url] = { scene: gltf.scene, animations: gltf.animations || [] };
          done++; if (onProgress) onProgress(Math.round(done / list.length * 100));
          resolve();
        }, undefined, err => { console.warn('[hero] no cargó', url, err && err.message); done++; resolve(); });   // resiliente: un modelo malo NO rompe el juego (ese héroe usa cajas)
      });
    }));
  }

  // -------- utilidades --------
  function findClip(anims, name){
    if (!name || !anims || !anims.length) return null;
    let c = anims.find(a => a.name === name);
    if (c) return c;
    const n = name.toLowerCase();
    return anims.find(a => a.name.toLowerCase() === n)
        || anims.find(a => a.name.toLowerCase().includes(n))
        || anims.find(a => n.includes(a.name.toLowerCase()))
        || null;
  }
  function tintMaterial(THREE, m, glow, doTint){
    const c = m.clone();
    if (doTint && 'emissive' in c && c.emissive){
      c.emissive = glow.clone();
      c.emissiveIntensity = Math.max(c.emissiveIntensity || 0, 0.12);
    }
    return c;
  }

  // -------- brillo del arma según nivel de forja (estilo enchant de L2) --------
  // Identifica mallas de arma por nombre (excluye escudos/libros) y les da color
  // + intensidad emissiva crecientes; el bloom (umbral ~0.85) las hace resplandecer.
  const WEAPON_RX    = /(sword|axe|staff|dagger|knife|wand|mace|hammer|spear|scythe|blade|katana|glaive|polearm|bow)/i;
  const NOTWEAPON_RX = /(shield|book|mug|throwable|quiver)/i;
  function isWeaponName(name){ return !!name && WEAPON_RX.test(name) && !NOTWEAPON_RX.test(name); }
  // nivel 0-15 -> { color (hex|null), intensity }. <=3 sin brillo; sube de tier en color e intensidad.
  function weaponGlowFor(level){
    level = level | 0;
    if (level <= 3) return { color: null, intensity: 0 };
    // Colores SATURADOS (un canal domina) para que el tono sobreviva al ACES
    // tone mapping + bloom del juego (si no, todo se quema a blanco).
    const stops = [
      { lv: 4,  c: 0x0a66ff },  // +4-6  azul puro
      { lv: 7,  c: 0x00e048 },  // +7-9  verde puro
      { lv: 10, c: 0x9b13ff },  // +10-12 violeta puro
      { lv: 13, c: 0xff8a00 },  // +13-14 ámbar
      { lv: 15, c: 0xff1400 },  // +15   rojo
    ];
    let c = stops[0].c;
    for (const s of stops) if (level >= s.lv) c = s.c;
    // emissive moderado: si es muy alto, el ACES lo quema a blanco (el color lo da el tinte de la hoja)
    // +15 = flamas NEGRAS (tier abismal): el color del arma es la base, las flamas se pintan en negro
    return { color: c, intensity: Math.min(1.6, 0.6 + (level - 3) * 0.1), black: level >= 15 };
  }
  // textura de flama (gradiente radial suave) para el aura del arma
  function makeFlameTex(THREE){
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(32, 32, 32, 0, Math.PI * 2); c.fill();
    return new THREE.CanvasTexture(cv);
  }

  // -------- construye un héroe a partir del modelo cacheado --------
  // Devuelve un controlador { group, mixer, update, playOnce, revive, ... }
  // compatible con view3d.js (view3d mueve `group`; nosotros animamos).
  function buildHeroGLTF(THREE, char){
    const cfg = modelFor(char);
    const src = HERO_MODELS_CACHE[cfg.url];
    if (!src) throw new Error('Modelo no precargado: ' + cfg.url);

    const root = THREE.SkeletonUtils.clone(src.scene);
    const glow = new THREE.Color(ELEMENT_META[char.element].glow);
    const hideSet = new Set(cfg.hide || []);

    const weaponMeshes = [], bodyMeshes = [];
    root.traverse(o => {
      const hidden = o.name && hideSet.has(o.name);
      if (hidden) o.visible = false;   // oculta armas/escudos alternos
      if (o.isMesh || o.isSkinnedMesh){
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        if (cfg.tint){   // por defecto NO: deja la textura del modelo intacta
          if (Array.isArray(o.material)) o.material = o.material.map(m => tintMaterial(THREE, m, glow, true));
          else if (o.material) o.material = tintMaterial(THREE, o.material, glow, true);
        }
        if (!hidden){ if (isWeaponName(o.name)) weaponMeshes.push(o); else bodyMeshes.push(o); }   // arma vs cuerpo/armadura
      }
    });

    // auto-escala a la altura objetivo y pies en y=0, centrado en x/z
    root.updateMatrixWorld(true);
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(root).getSize(size);
    const s = (cfg.scaleHeight || 2.6) / (size.y || 1);
    root.scale.setScalar(s);
    root.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(root);
    root.position.y -= box2.min.y;
    root.position.x -= (box2.min.x + box2.max.x) / 2;
    root.position.z -= (box2.min.z + box2.max.z) / 2;
    if (cfg.faceOffset) root.rotation.y = cfg.faceOffset;

    const group = new THREE.Group();
    group.add(root);

    // luz de aura del color del elemento (da identidad elemental, sutil)
    const aura = new THREE.PointLight(new THREE.Color(ELEMENT_META[char.element].color).getHex(), 0.5, 6);
    aura.position.set(0, (cfg.scaleHeight || 2.4) * 0.6, 0.3);
    group.add(aura);

    // mixer + acciones
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    for (const key in cfg.clips){
      const clip = findClip(src.animations, cfg.clips[key]);
      if (clip) actions[key] = mixer.clipAction(clip);
    }

    // estado de animación
    let curKey = null, curAction = null, locked = null, lockT = 0, isDead = false;

    function playLoop(key){
      let a = actions[key], k = key;
      if (!a){ a = actions.idle; k = 'idle'; }
      if (!a || curKey === k) return;
      if (curAction) curAction.fadeOut(0.18);
      a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false;
      a.enabled = true; a.setEffectiveTimeScale(1); a.setEffectiveWeight(1);
      a.fadeIn(0.18).play();
      curAction = a; curKey = k;
    }
    function playOnce(key){
      const a = actions[key]; if (!a) return;
      if (curAction) curAction.fadeOut(0.08);
      a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
      a.enabled = true; a.setEffectiveTimeScale(1); a.setEffectiveWeight(1);
      a.fadeIn(0.05).play();
      curAction = null; curKey = null;
      locked = key; lockT = a.getClip().duration / (a.timeScale || 1);
    }
    function update(dt, st){
      mixer.update(dt);
      updateFlames(dt);
      if (st && st.dead){ if (!isDead){ isDead = true; playOnce('die'); } return; }
      if (locked){ lockT -= dt; if (lockT > 0) return; locked = null; }
      const key = st && st.airborne ? 'jump' : st && st.running ? 'run' : st && st.moving ? 'walk' : 'idle';
      playLoop(key);
    }
    function revive(){
      isDead = false; locked = null; lockT = 0;
      // crossfade desde la pose de muerte (quedaba "clamped" tendida) hacia idle de pie —
      // si no se cruza, el héroe revivía ACOSTADO. Mantener die como curAction lo funde sin T-pose.
      curAction = actions.die || null; curKey = actions.die ? 'die' : null;
      playLoop('idle');
    }
    function dispose(){ try { mixer.stopAllAction(); mixer.uncacheRoot(root); } catch(e){} }

    // brillo del arma por nivel de forja (clona el material del arma una vez para
    // no afectar al cuerpo, que comparte la misma textura/atlas)
    // --- flamas del arma (aura encendida en la PUNTA, escala con el nivel) ---
    let flameGroup = null, flameParts = [], flameColor = null, flameStrength = 0, flameBlack = false, weaponTipLocal = null;
    const _fv = new THREE.Vector3(), _fc = new THREE.Color(), _tmpWhite = new THREE.Color(0xffffff);
    // punta de la hoja en espacio local de la malla (la empuñadura está en el origen → la punta es el extremo más lejano del eje más largo)
    function weaponTip(w){
      if (!w.geometry) return new THREE.Vector3(0, 0.5, 0);
      if (!w.geometry.boundingBox) w.geometry.computeBoundingBox();
      const bb = w.geometry.boundingBox, size = new THREE.Vector3(); bb.getSize(size);
      const c = new THREE.Vector3(); bb.getCenter(c);
      const pick = (mn, mx) => Math.abs(mx) >= Math.abs(mn) ? mx : mn;   // extremo más lejos del origen
      if (size.y >= size.x && size.y >= size.z) c.y = pick(bb.min.y, bb.max.y);
      else if (size.x >= size.z) c.x = pick(bb.min.x, bb.max.x);
      else c.z = pick(bb.min.z, bb.max.z);
      return c;
    }
    function ensureFlames(){
      if (flameGroup || !weaponMeshes.length) return;
      flameGroup = new THREE.Group(); group.add(flameGroup);
      const tex = makeFlameTex(THREE);
      for (let i = 0; i < 14; i++){
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
        sp.userData = { t: i / 14, sx: (Math.random() - 0.5) * 0.16, sz: (Math.random() - 0.5) * 0.16, sp: 0.8 + Math.random() * 0.9 };
        flameGroup.add(sp); flameParts.push(sp);
      }
    }
    let _flameT = 0;
    function updateFlames(dt){
      if (!flameGroup || flameColor == null || !weaponMeshes.length){ if (flameGroup) flameGroup.visible = false; return; }
      flameGroup.visible = true; _flameT += dt;
      const w = weaponMeshes[0]; w.updateWorldMatrix(true, false);
      if (!weaponTipLocal) weaponTipLocal = weaponTip(w);
      _fv.copy(weaponTipLocal).applyMatrix4(w.matrixWorld);   // PUNTA del arma en mundo
      group.worldToLocal(_fv); flameGroup.position.copy(_fv);
      const col = _fc.set(flameColor);
      const flick = 0.78 + 0.22 * Math.sin(_flameT * 24) * Math.cos(_flameT * 9.3);   // titileo de fuego
      const H = (flameBlack ? 0.75 : 0.55) + flameStrength * (flameBlack ? 1.25 : 0.9);
      const base = (flameBlack ? 0.34 : 0.24) + flameStrength * (flameBlack ? 0.5 : 0.36);
      for (const sp of flameParts){
        const u = sp.userData;
        u.t += dt * u.sp * (0.9 + flameStrength * 0.7);
        if (u.t >= 1){ u.t -= 1; u.sx = (Math.random() - 0.5) * 0.18; u.sz = (Math.random() - 0.5) * 0.18; }
        const life = u.t;
        sp.position.set(u.sx * (1 - life), life * H, u.sz * (1 - life));   // converge al subir, como llama
        const s = base * (1.05 - life * 0.7) * flick;
        sp.scale.set(s, s * 1.6, s);
        if (flameBlack){   // +15 Amaterasu: fuego negro (normal blending) con leve tinte carmesí
          sp.material.color.setRGB(0.05, 0.0, 0.015);
          sp.material.opacity = (1 - life) * 0.95 * flick;
        } else {           // color puro aditivo → resplandece
          sp.material.color.copy(col);
          sp.material.opacity = (1 - life) * (0.5 + flameStrength * 0.5) * flick;
        }
      }
    }

    let weaponLevel = -1;
    function setWeaponLevel(level){
      level = level | 0;
      if (level === weaponLevel) return; weaponLevel = level;
      const g = weaponGlowFor(level);
      for (const o of weaponMeshes){
        if (!o.userData._wmat){   // aísla el material del arma
          o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
          o.userData._wmat = true;
        }
        const apply = m => { if (!m || !('emissive' in m)) return;
          if (!m.userData._origColor && m.color) m.userData._origColor = m.color.clone();
          if (g.color == null){
            m.emissive = new THREE.Color(0x000000); m.emissiveIntensity = 0;
            if (m.userData._origColor && m.color) m.color.copy(m.userData._origColor);   // hoja normal
          } else if (g.black){   // +15 Amaterasu: hoja negra intensa con brasa carmesí tenue
            if (m.userData._origColor && m.color) m.color.copy(m.userData._origColor).multiplyScalar(0.07);
            m.emissive = new THREE.Color(0x1c0000); m.emissiveIntensity = 0.45;
          } else {
            const col = new THREE.Color(g.color);
            m.emissive = col.clone(); m.emissiveIntensity = g.intensity;
            if (m.userData._origColor && m.color) m.color.copy(m.userData._origColor).lerp(col, 0.9);   // tiñe la hoja muy fuerte hacia el color
          }
          m.needsUpdate = true; };
        if (Array.isArray(o.material)) o.material.forEach(apply); else apply(o.material);
      }
      // configura las flamas
      flameColor = g.color;
      flameBlack = !!g.black;
      flameStrength = g.color == null ? 0 : Math.min(1, (level - 3) / 12 + 0.3);
      if (g.color != null) ensureFlames();
      if (flameGroup){
        flameGroup.visible = g.color != null;
        // negro = blending NORMAL (oscurece); color = ADITIVO (resplandece)
        const bl = flameBlack ? THREE.NormalBlending : THREE.AdditiveBlending;
        for (const sp of flameParts){ if (sp.material.blending !== bl){ sp.material.blending = bl; sp.material.needsUpdate = true; } }
      }
    }

    // armadura/cuerpo: a +15 se vuelve NEGRO intenso (Amaterasu); por debajo, normal
    let armorLevel = -1;
    function setArmorLevel(level){
      level = level | 0;
      if (level === armorLevel) return; armorLevel = level;
      const black = level >= 15;
      for (const o of bodyMeshes){
        if (!o.userData._amat){   // aísla el material del cuerpo (compartido con otros héroes del modelo cacheado)
          o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
          o.userData._amat = true;
        }
        const apply = m => { if (!m || !m.color) return;
          if (!m.userData._origColorA) m.userData._origColorA = m.color.clone();
          if (black){
            m.color.copy(m.userData._origColorA).multiplyScalar(0.07);   // negro intenso
            if ('emissive' in m){ m.emissive = new THREE.Color(0x140000); m.emissiveIntensity = 0.25; }   // brasa carmesí tenue
          } else {
            m.color.copy(m.userData._origColorA);
            if ('emissive' in m){ m.emissive = new THREE.Color(0x000000); m.emissiveIntensity = 0; }
          }
          m.needsUpdate = true; };
        if (Array.isArray(o.material)) o.material.forEach(apply); else apply(o.material);
      }
    }

    // arranca en idle para evitar T-pose en el primer frame
    if (actions.idle){ actions.idle.reset().play(); curAction = actions.idle; curKey = 'idle'; }

    return { group, root, mixer, aura, actions, update, playOnce, playLoop, revive, dispose, setWeaponLevel, setArmorLevel,
             weaponCount: weaponMeshes.length, clipNames: (src.animations || []).map(a => a.name) };
  }

  // -------- export global --------
  window.HeroGLTF = {
    DEFAULT_HERO_MODEL, HERO_MODELS, HERO_MODELS_CACHE,
    preloadHeroModels, buildHeroGLTF, modelFor,
  };
})();
