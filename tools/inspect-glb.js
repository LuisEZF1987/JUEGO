#!/usr/bin/env node
// ====================================================================
//  inspect-glb.js — Valida un modelo .glb/.gltf para usarlo como personaje.
//  Uso:  node tools/inspect-glb.js  ruta/al/modelo.glb
//  Te dice si está RIGGED (esqueleto) y ANIMADO, qué animaciones trae,
//  y te sugiere el mapeo de clips para meterlo en herogltf.js (HERO_MODELS).
// ====================================================================
const fs = require('fs');

const path = process.argv[2];
if (!path){ console.log('Uso: node tools/inspect-glb.js <archivo.glb>'); process.exit(1); }
if (!fs.existsSync(path)){ console.log('✗ No existe:', path); process.exit(1); }

let json, total = 0;
try {
  const buf = fs.readFileSync(path); total = buf.length;
  if (path.toLowerCase().endsWith('.gltf')){ json = JSON.parse(buf.toString('utf8')); }
  else { // .glb: header(12) + chunks
    let off = 12;
    while (off < buf.length){ const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off+4);
      if (type === 0x4E4F534A) json = JSON.parse(buf.slice(off+8, off+8+len).toString('utf8'));
      off += 8 + len; }
  }
} catch(e){ console.log('✗ No pude leer el modelo:', e.message); process.exit(1); }
if (!json){ console.log('✗ No es un glTF/GLB válido'); process.exit(1); }

const anims = (json.animations || []).map(a => a.name || '(sin nombre)');
const skins = (json.skins || []);
const joints = skins.reduce((a, s) => a + (s.joints ? s.joints.length : 0), 0);
const meshes = (json.meshes || []).length;
const mats = (json.materials || []);
const hasNormalMap = mats.some(m => m.normalTexture);
const hasPBR = mats.some(m => m.pbrMetallicRoughness && (m.pbrMetallicRoughness.metallicRoughnessTexture || m.pbrMetallicRoughness.baseColorTexture));
const tex = (json.images || []).length;

// roles del juego que se pueden cubrir con las animaciones presentes (fuzzy)
const ROLES = { idle:/idle|stand|breath/i, walk:/walk/i, run:/run|sprint|jog/i, attack:/attack|slash|swing|chop|stab|punch|melee|cast|shoot/i, die:/death|die|dead|fall/i, jump:/jump/i };
const matchRole = rx => anims.find(n => rx.test(n));

const rigged = skins.length > 0 && joints > 0;
const animated = anims.length > 0;

console.log('\n=== ' + path + ' ===');
console.log('Tamaño:        ' + (total/1024/1024).toFixed(2) + ' MB ' + (total > 8*1024*1024 ? '⚠ pesado (ideal <8 MB)' : '✓'));
console.log('Mallas:        ' + meshes + '   Materiales: ' + mats.length + '   Texturas: ' + tex + (tex ? ' ✓' : ' ⚠ sin textura embebida'));
console.log('PBR/normal:    ' + (hasPBR ? 'PBR ✓' : 'simple') + (hasNormalMap ? ' · normal map ✓ (se ve realista)' : ' · sin normal map'));
console.log('RIGGED:        ' + (rigged ? '✓ sí (' + joints + ' huesos)' : '✗ NO — sin esqueleto, no podrá animarse'));
console.log('ANIMADO:       ' + (animated ? '✓ sí (' + anims.length + ' clips)' : '✗ NO — sin animaciones (¡usa el paso de "Animate/Rig" de tu herramienta!)'));
if (animated){
  console.log('Clips:         ' + anims.join(', '));
  console.log('\nRoles cubiertos (para el juego):');
  const map = {};
  for (const r in ROLES){ const hit = matchRole(ROLES[r]); console.log('  ' + r.padEnd(7) + ' ' + (hit ? '✓ ' + hit : '✗ falta')); if (hit) map[r] = hit; }
  console.log('\nMapeo sugerido para HERO_MODELS (herogltf.js):');
  console.log('  clips: ' + JSON.stringify(map));
}
console.log('\nVEREDICTO:     ' + (rigged && matchRole(ROLES.idle) && matchRole(ROLES.walk)
  ? '✅ LISTO para integrar (tiene esqueleto, idle y caminar). Pásamelo y lo enchufo.'
  : rigged && !animated ? '⚠ tiene esqueleto pero SIN animaciones → anímalo (Mixamo/Meshy Animate) antes.'
  : !rigged ? '✗ NO sirve aún: falta el rig. Pásalo por auto-rig (Meshy/Tripo Animate o Mixamo).'
  : '⚠ revisa los roles que faltan arriba.') + '\n');
