// ====================================================================
//  hero3d.js — Construye un modelo 3D estilizado (low-poly) de un héroe
//  a partir de sus datos (raza, elemento, arquetipo). Devuelve un grupo
//  de Three.js con userData.parts para animarlo (brazos, piernas, etc.).
// ====================================================================

const SKIN_BY_RACE = {
  'Orco':'#6f9b5a', 'Elfo':'#e8d2b0', 'Cíclope':'#cbb089',
  'Enano':'#d8b48c', 'Dracónido':'#4f8f7d', 'Humano':'#e8c4a0'
};

function buildHero3D(THREE, char){
  const el = char.element;
  const elColor = new THREE.Color(ELEMENT_META[el].color);
  const glow    = new THREE.Color(ELEMENT_META[el].glow);
  const skin    = new THREE.Color(SKIN_BY_RACE[char.race] || '#e0c0a0');

  const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color:c, roughness:0.75, metalness:0.08 }, o||{}));
  const skinMat  = mat(skin);
  const clothMat = mat(elColor.clone().multiplyScalar(0.7));
  const armorMat = mat(elColor, { metalness:0.45, roughness:0.5 });
  const glowMat  = new THREE.MeshStandardMaterial({ color:glow, emissive:glow, emissiveIntensity:0.9, roughness:0.4 });
  const darkMat  = mat('#2a2a32');

  const box  = (w,h,d,m) => new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m);
  const cyl  = (rt,rb,h,m) => new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,10), m);
  const cone = (r,h,m) => new THREE.Mesh(new THREE.ConeGeometry(r,h,8), m);
  const sph  = (r,m) => new THREE.Mesh(new THREE.SphereGeometry(r,16,16), m);
  // miembro con pivote en la parte superior (hombro/cadera)
  const limb = (w,h,d,m) => { const g = new THREE.Group(); const me = box(w,h,d,m); me.position.y = -h/2; g.add(me); g.userData.h = h; return g; };

  const group = new THREE.Group();
  const parts = {};

  // proporciones
  const legH = 0.95, torsoH = 1.15, headH = 0.72, armH = 0.92;
  const hipY = legH;

  // piernas
  const lLeg = limb(0.34, legH, 0.36, clothMat); lLeg.position.set(-0.22, hipY, 0);
  const rLeg = limb(0.34, legH, 0.36, clothMat); rLeg.position.set( 0.22, hipY, 0);
  // botas
  const lBoot = box(0.38,0.2,0.5, darkMat); lBoot.position.set(0, -legH+0.08, 0.07); lLeg.add(lBoot);
  const rBoot = box(0.38,0.2,0.5, darkMat); rBoot.position.set(0, -legH+0.08, 0.07); rLeg.add(rBoot);
  group.add(lLeg, rLeg); parts.lLeg = lLeg; parts.rLeg = rLeg;

  // torso
  const torso = box(0.95, torsoH, 0.55, armorMat); torso.position.y = hipY + torsoH/2; group.add(torso);
  const chest = box(0.42, 0.34, 0.18, glowMat); chest.position.set(0, hipY + torsoH*0.6, 0.3); group.add(chest);
  // hombreras
  [-0.55,0.55].forEach(x => { const s = box(0.34,0.3,0.5, armorMat); s.position.set(x, hipY + torsoH*0.92, 0); group.add(s); });

  // brazos (ligeramente adelantados en reposo)
  const shoulderY = hipY + torsoH*0.9;
  const lArm = limb(0.26, armH, 0.28, skinMat); lArm.position.set(-0.62, shoulderY, 0); lArm.rotation.x = -0.15;
  const rArm = limb(0.26, armH, 0.28, skinMat); rArm.position.set( 0.62, shoulderY, 0); rArm.rotation.x = -0.3;
  group.add(lArm, rArm); parts.lArm = lArm; parts.rArm = rArm;

  // cabeza
  const head = new THREE.Group(); head.position.y = hipY + torsoH + headH/2; head.userData.baseY = head.position.y;
  head.add(box(0.62, headH, 0.6, skinMat));
  group.add(head); parts.head = head;

  // ojos (cíclope = uno grande)
  if (char.race === 'Cíclope'){
    const eye = sph(0.15, new THREE.MeshStandardMaterial({ color:'#ffffff', emissive:glow, emissiveIntensity:0.7 }));
    eye.position.set(0, 0.04, 0.31); head.add(eye);
    const pup = sph(0.06, darkMat); pup.position.set(0, 0.04, 0.44); head.add(pup);
  } else {
    [-0.15, 0.15].forEach(x => { const e = box(0.1,0.12,0.06, new THREE.MeshStandardMaterial({ color:'#101014', emissive:glow, emissiveIntensity:0.5 })); e.position.set(x, 0.05, 0.31); head.add(e); });
  }

  // rasgos por raza
  if (char.race === 'Orco'){
    [-0.12, 0.12].forEach(x => { const t = cone(0.05, 0.2, mat('#f0ead0')); t.position.set(x, -0.26, 0.3); t.rotation.x = Math.PI; head.add(t); });
  } else if (char.race === 'Elfo'){
    [-1, 1].forEach(s => { const ear = cone(0.08, 0.3, skinMat); ear.position.set(s*0.33, 0.06, 0); ear.rotation.z = s * -Math.PI/3; head.add(ear); });
  } else if (char.race === 'Enano'){
    const beard = box(0.5, 0.42, 0.18, mat('#b86a3a')); beard.position.set(0, -0.3, 0.26); head.add(beard);
  } else if (char.race === 'Dracónido'){
    [-0.17, 0.17].forEach(x => { const h = cone(0.08, 0.34, darkMat); h.position.set(x, 0.42, -0.05); h.rotation.x = -0.35; head.add(h); });
    // cola
    const tail = cyl(0.05, 0.16, 1.1, armorMat); tail.position.set(0, hipY*0.6, -0.5); tail.rotation.x = 0.9; group.add(tail);
  } else if (char.race === 'Humano'){
    const hood = cone(0.5, 0.55, clothMat); hood.position.set(0, 0.4, -0.05); head.add(hood);
  }

  // arma según arquetipo (en la mano derecha)
  const arch = (char.archetype && char.archetype.name) || '';
  const weapon = new THREE.Group();
  const handle = (len) => cyl(0.04, 0.04, len, mat('#5a3a22'));
  if (arch === 'Berserker'){                  // hacha
    weapon.add(handle(1.25));
    const blade = box(0.5, 0.42, 0.06, armorMat); blade.position.set(0.2, 0.5, 0); weapon.add(blade);
    const edge = box(0.06, 0.42, 0.06, glowMat); edge.position.set(0.45, 0.5, 0); weapon.add(edge);
  } else if (arch === 'Verdugo'){             // espada
    weapon.add(handle(0.4));
    const blade = box(0.1, 1.15, 0.04, armorMat); blade.position.y = 0.72; weapon.add(blade);
    const tip = box(0.1, 0.14, 0.05, glowMat); tip.position.y = 1.32; weapon.add(tip);
  } else if (arch === 'Mago' || arch === 'Sanadora'){  // bastón
    weapon.add(handle(1.55));
    const orb = sph(0.17, glowMat); orb.position.y = 0.88; weapon.add(orb);
  } else if (arch === 'Tanque'){              // martillo
    weapon.add(handle(1.05));
    const hd = box(0.42, 0.34, 0.42, armorMat); hd.position.y = 0.52; weapon.add(hd);
    const rune = box(0.44, 0.1, 0.44, glowMat); rune.position.y = 0.52; weapon.add(rune);
  } else if (arch === 'Asesina'){             // arco
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 16, Math.PI*1.25), armorMat);
    bow.rotation.z = Math.PI/2; weapon.add(bow);
  }
  weapon.position.set(0, -armH + 0.02, 0.06);
  rArm.add(weapon); parts.weapon = weapon;

  // luz de aura del color del elemento
  const aura = new THREE.PointLight(elColor.getHex(), 1.2, 7); aura.position.set(0, hipY + torsoH*0.6, 0.5);
  group.add(aura); parts.aura = aura;

  group.userData.parts = parts;
  group.userData.height = hipY + torsoH + headH; // altura total aprox.
  return group;
}
