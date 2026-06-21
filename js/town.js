// ====================================================================
//  town.js — Pueblos y ciudad central. Coloca edificios KayKit Medieval
//  (CC0) como aldeas en cada Nación + ambiente procedural (banderas del
//  elemento, faroles, fuente central, árboles). Determinista (misma
//  semilla → mismo pueblo para todos los jugadores). Expone window.Town.
// ====================================================================

window.Town = (function(){
  const BLUE = 'assets/models/town/blue/', NEU = 'assets/models/town/neutral/';
  const BUILDINGS = {
    home_A:    { url:BLUE+'building_home_A_blue.gltf',   size:3.6 },
    home_B:    { url:BLUE+'building_home_B_blue.gltf',   size:3.8 },
    tavern:    { url:BLUE+'building_tavern_blue.gltf',   size:4.6 },
    market:    { url:BLUE+'building_market_blue.gltf',   size:4.2 },
    well:      { url:BLUE+'building_well_blue.gltf',     size:2.6 },
    blacksmith:{ url:BLUE+'building_blacksmith_blue.gltf', size:4.2 },
    church:    { url:BLUE+'building_church_blue.gltf',   size:5.4 },
    windmill:  { url:BLUE+'building_windmill_blue.gltf', size:6.0 },
    tower:     { url:BLUE+'building_tower_A_blue.gltf',  size:6.0 },
    fence_wood:{ url:NEU+'fence_wood_straight.gltf',     size:2.2 },
    fence_stone:{url:NEU+'fence_stone_straight.gltf',    size:2.2 },
  };
  const cache = {};
  let THREE = null;

  // RNG determinista (igual que mobs.js → mismo mundo para todos)
  function makeRng(seed){ let a = seed>>>0; return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

  function preload(_THREE){
    THREE = _THREE; const loader = new THREE.GLTFLoader();
    return Promise.all(Object.keys(BUILDINGS).map(k => new Promise(res => {
      loader.load(BUILDINGS[k].url, g => { cache[k] = g.scene; res(); },
        undefined, e => { console.warn('[town] no cargó', k, e); res(); });
    })));
  }

  // coloca un edificio: auto-escala su huella y apoya la base en el suelo
  function place(scene, key, x, z, rot){
    const src = cache[key]; if (!src) return null;
    const root = src.clone(true);
    root.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    root.updateMatrixWorld(true);
    const size = new THREE.Vector3(); new THREE.Box3().setFromObject(root).getSize(size);
    const s = (BUILDINGS[key].size || 3) / (Math.max(size.x, size.z) || 1);
    root.scale.setScalar(s); root.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(root);
    root.position.y -= b2.min.y;
    root.position.x -= (b2.min.x + b2.max.x) / 2;   // centra la huella en el punto de colocación
    root.position.z -= (b2.min.z + b2.max.z) / 2;
    const g = new THREE.Group(); g.add(root);
    g.position.set(x, 0, z); g.rotation.y = rot || 0;
    scene.add(g); return g;
  }

  // ---- props procedurales ----
  function tree(scene, x, z, s, rng){
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13*s, 0.2*s, 1.3*s, 6), MAT.trunk); trunk.position.y = 0.65*s; trunk.castShadow = true; g.add(trunk);
    for (let i=0;i<2;i++){ const r = (0.85-i*0.25)*s; const f = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), MAT.leaf); f.position.y = (1.25 + i*0.6)*s; f.rotation.y = rng()*Math.PI; f.castShadow = true; g.add(f); }
    g.position.set(x, 0, z); g.rotation.y = rng()*Math.PI; scene.add(g);
  }
  function banner(scene, x, z, rot, color){
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), MAT.wood); pole.position.y = 1.6; pole.castShadow = true; g.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.4), new THREE.MeshStandardMaterial({ color, emissive:color, emissiveIntensity:0.25, roughness:0.7, side:THREE.DoubleSide }));
    cloth.position.set(0.5, 2.3, 0); g.add(cloth);
    g.position.set(x, 0, z); g.rotation.y = rot || 0; scene.add(g);
  }
  function lamp(scene, x, z, color){
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.4, 6), MAT.iron); post.position.y = 1.2; post.castShadow = true; g.add(post);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), new THREE.MeshStandardMaterial({ color:0xffd98a, emissive:color||0xffb050, emissiveIntensity:2.2, roughness:0.4 }));
    glow.position.y = 2.5; g.add(glow);
    g.position.set(x, 0, z); scene.add(g);
  }
  function fountain(scene, x, z){
    const g = new THREE.Group();
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.6, 20), MAT.stone); basin.position.y = 0.3; basin.castShadow = true; basin.receiveShadow = true; g.add(basin);
    const water1 = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), MAT.water); water1.rotation.x = -Math.PI/2; water1.position.y = 0.5; g.add(water1);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.3, 12), MAT.stone); pillar.position.y = 1.1; g.add(pillar);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.5, 0.35, 16), MAT.stone); bowl.position.y = 1.8; bowl.castShadow = true; g.add(bowl);
    const water2 = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), MAT.water); water2.rotation.x = -Math.PI/2; water2.position.y = 1.98; g.add(water2);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), new THREE.MeshStandardMaterial({ color:0x9fe0ff, emissive:0x4ac8ff, emissiveIntensity:1.6, roughness:0.3 })); top.position.y = 2.2; g.add(top);
    g.position.set(x, 0, z); scene.add(g);
  }
  function fenceRing(scene, cx, cz, r, n, rng){
    for (let i=0;i<n;i++){ const a = (i/n)*Math.PI*2; const x = cx+Math.cos(a)*r, z = cz+Math.sin(a)*r; place(scene, rng()<0.5?'fence_wood':'fence_stone', x, z, a + Math.PI/2); }
  }

  // ---- una aldea alrededor de una Nación ----
  const HOUSE_SET = ['home_A','home_B','home_A','home_B','tavern','market','blacksmith'];
  const LANDMARK = ['windmill','church','tower'];
  function village(scene, n, ni){
    const r2 = makeRng(0x7000 + ni*97 + 13);
    const el = n.element, acc = (typeof ELEMENT_META!=='undefined' && ELEMENT_META[el]) ? ELEMENT_META[el].glow : 0xffcc66;
    const out = Math.atan2(n.z, n.x);            // dirección hacia AFUERA (lejos de la plaza central)
    const inn = out + Math.PI;                   // dirección de entrada (por donde llega el jugador)
    const RIN = 11;                              // radio del arena despejada del Jefe (centro libre)
    // casas en un ARCO del lado lejano → no tapan al Jefe ni la entrada
    const count = 7;
    for (let i=0;i<count;i++){
      const a = out + (-1.55 + (i/(count-1))*3.1) + (r2()-0.5)*0.25;   // arco ~178° detrás del Jefe
      const r = RIN + 0.5 + r2()*4;
      const x = n.x + Math.cos(a)*r, z = n.z + Math.sin(a)*r;
      const key = HOUSE_SET[Math.floor(r2()*HOUSE_SET.length)];
      place(scene, key, x, z, Math.atan2(n.x - x, n.z - z));   // mira hacia el centro (al Jefe)
    }
    // punto de referencia (molino/iglesia/torre) atrás, detrás del Jefe
    { const r = RIN + 5; const x = n.x+Math.cos(out)*r, z = n.z+Math.sin(out)*r;
      place(scene, LANDMARK[ni % LANDMARK.length], x, z, Math.atan2(n.x-x, n.z-z)); }
    // pozo a un costado (fuera del arena, sin tapar)
    { const a = out + 1.9, r = RIN + 1; place(scene, 'well', n.x+Math.cos(a)*r, n.z+Math.sin(a)*r, 0); }
    // banderas del elemento FLANQUEANDO la entrada (lado de la plaza) → marcan el camino al Jefe
    for (const s of [-0.45, 0.45]){ const a = inn + s, r = RIN - 0.5; banner(scene, n.x+Math.cos(a)*r, n.z+Math.sin(a)*r, a, acc); }
    banner(scene, n.x+Math.cos(out)*(RIN+2), n.z+Math.sin(out)*(RIN+2), out, acc);
    // faroles iluminando el borde del arena del Jefe
    for (let i=0;i<5;i++){ const a = (i/5)*Math.PI*2, r = RIN - 1; lamp(scene, n.x+Math.cos(a)*r, n.z+Math.sin(a)*r, acc); }
    // árboles solo en el lado lejano (no en la entrada ni el arena)
    const tn = el === 'Madera' ? 12 : 7;
    for (let i=0;i<tn;i++){ const a = out + (r2()-0.5)*2.4, r = RIN + 2 + r2()*7; tree(scene, n.x+Math.cos(a)*r, n.z+Math.sin(a)*r, 0.85 + r2()*0.7, r2); }
  }

  // ---- ciudad central (plaza) ----
  function centralCity(scene){
    const rng = makeRng(0xC1747);
    fountain(scene, 0, 0);
    // edificios alrededor de la plaza (la "capital")
    const ring = ['tavern','market','home_A','home_B','blacksmith','home_A'];
    for (let i=0;i<6;i++){ const a = (i/6)*Math.PI*2, r = 7.2; const x = Math.cos(a)*r, z = Math.sin(a)*r; place(scene, ring[i], x, z, Math.atan2(0-x, 0-z)); }
    // faroles alrededor de la fuente
    for (let i=0;i<6;i++){ const a = (i/6)*Math.PI*2 + 0.5; lamp(scene, Math.cos(a)*4, Math.sin(a)*4, 0xffd070); }
    fenceRing(scene, 0, 0, 8.6, 18, rng);
  }

  let MAT = null;
  function build(_THREE, scene, nations){
    THREE = _THREE;
    MAT = {
      trunk: new THREE.MeshStandardMaterial({ color:0x6b4a2a, roughness:1 }),
      leaf:  new THREE.MeshStandardMaterial({ color:0x3f8f43, roughness:0.9, flatShading:true }),
      wood:  new THREE.MeshStandardMaterial({ color:0x7a5a36, roughness:0.9 }),
      iron:  new THREE.MeshStandardMaterial({ color:0x32363f, roughness:0.6, metalness:0.3 }),
      stone: new THREE.MeshStandardMaterial({ color:0x9b9690, roughness:0.95 }),
      water: new THREE.MeshStandardMaterial({ color:0x4ac8ff, emissive:0x1a6fb0, emissiveIntensity:0.5, roughness:0.2, transparent:true, opacity:0.85 }),
    };
    return preload(_THREE).then(() => {
      centralCity(scene);
      nations.forEach((n, ni) => village(scene, n, ni));
    }).catch(e => console.warn('[town] build falló', e));
  }

  return { build, preload };
})();
