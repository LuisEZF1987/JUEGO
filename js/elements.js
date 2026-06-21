// ====================================================================
//  elements.js — Anillo elemental de 6 y cálculo de ventaja.
//  Fuego ▸ Viento ▸ Rayo ▸ Tierra ▸ Agua ▸ Madera ▸ (Fuego)
//  Cada elemento VENCE al siguiente (+25%) y pierde con el anterior (−25%).
// ====================================================================

const ELEMENT_RING = ['Fuego', 'Viento', 'Rayo', 'Tierra', 'Agua', 'Madera'];

const ELEMENT_META = {
  Fuego:  { color:'#ff5a3c', glow:'#ff8a5a', emoji:'🔥' },
  Viento: { color:'#7fe3a0', glow:'#b6ffcf', emoji:'🌪️' },
  Rayo:   { color:'#ffd23c', glow:'#fff07a', emoji:'⚡' },
  Tierra: { color:'#c08a4a', glow:'#e0b070', emoji:'🪨' },
  Agua:   { color:'#3ca6ff', glow:'#7fd0ff', emoji:'💧' },
  Madera: { color:'#5fbf4f', glow:'#9be88a', emoji:'🌿' },
};

// 1.25 = ventaja, 0.75 = desventaja, 1.0 = neutral
function elementAdvantage(attacker, defender){
  if (attacker === defender) return 1.0;
  const ai = ELEMENT_RING.indexOf(attacker);
  const di = ELEMENT_RING.indexOf(defender);
  if (ai < 0 || di < 0) return 1.0;
  if (ELEMENT_RING[(ai + 1) % ELEMENT_RING.length] === defender) return 1.25; // atacante vence
  if (ELEMENT_RING[(di + 1) % ELEMENT_RING.length] === attacker) return 0.75; // atacante pierde
  return 1.0;
}
