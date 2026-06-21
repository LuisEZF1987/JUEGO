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
      return new Promise((resolve, reject) => {
        loader.load(url, gltf => {
          HERO_MODELS_CACHE[url] = { scene: gltf.scene, animations: gltf.animations || [] };
          done++; if (onProgress) onProgress(Math.round(done / list.length * 100));
          resolve();
        }, undefined, err => reject(err));
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

    root.traverse(o => {
      if (o.name && hideSet.has(o.name)) o.visible = false;   // oculta armas/escudos alternos
      if (o.isMesh || o.isSkinnedMesh){
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        if (cfg.tint){   // por defecto NO: deja la textura del modelo intacta
          if (Array.isArray(o.material)) o.material = o.material.map(m => tintMaterial(THREE, m, glow, true));
          else if (o.material) o.material = tintMaterial(THREE, o.material, glow, true);
        }
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
      if (st && st.dead){ if (!isDead){ isDead = true; playOnce('die'); } return; }
      if (locked){ lockT -= dt; if (lockT > 0) return; locked = null; }
      const key = st && st.airborne ? 'jump' : st && st.running ? 'run' : st && st.moving ? 'walk' : 'idle';
      playLoop(key);
    }
    function revive(){
      isDead = false; locked = null; lockT = 0; curKey = null; curAction = null;
      playLoop('idle');
    }
    function dispose(){ try { mixer.stopAllAction(); mixer.uncacheRoot(root); } catch(e){} }

    // arranca en idle para evitar T-pose en el primer frame
    if (actions.idle){ actions.idle.reset().play(); curAction = actions.idle; curKey = 'idle'; }

    return { group, root, mixer, aura, actions, update, playOnce, playLoop, revive, dispose,
             clipNames: (src.animations || []).map(a => a.name) };
  }

  // -------- export global --------
  window.HeroGLTF = {
    DEFAULT_HERO_MODEL, HERO_MODELS, HERO_MODELS_CACHE,
    preloadHeroModels, buildHeroGLTF, modelFor,
  };
})();
