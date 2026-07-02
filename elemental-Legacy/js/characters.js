// ====================================================================
//  characters.js — Los 6 héroes (uno por Nación) con arquetipos de rol.
//  Bloque de stats RPG:
//    maxHp, armor(0..1), power(escala de daño), critChance(0..1), critMult,
//    attackSpeed(1=normal; afecta al básico), maxChakra, moveSpeed(px/s),
//    healPower(multiplica curaciones).
//  Cada skill: dmgType 'fisico'|'magico' (la magia ignora la mitad de armadura).
// ====================================================================

const CHARACTERS = [
  // ---------------- TANQUE ----------------
  {
    id:'brunn', name:'Brunn', race:'Enano', nation:'Nación de la Tierra', element:'Tierra',
    role:'Baluarte (Tanque)',
    archetype:{ icon:'🛡️', name:'Tanque', tagline:'Aguanta muchísimo, pero pega flojo y es lento.' },
    special:'✚ Absorbe daño por el equipo: escudos y reflejo.',
    bio:'Muralla viviente; cuanto más lo golpean, más Chakra acumula.',
    stats:{ maxHp:480, armor:0.30, power:12, critChance:0.03, critMult:1.5, attackSpeed:0.82, maxChakra:110, moveSpeed:128, healPower:1.0 },
    passive:{ id:'piel_roca', name:'Piel de Roca', desc:'+30% armadura. Inmune a empujes. Gana Chakra al recibir daño.' },
    skills:[
      { key:'1', name:'Martillazo', element:'Tierra', dmgType:'fisico', cost:0, cooldown:0.6, desc:'Mazazo cuerpo a cuerpo.', offense:{shape:'melee', mult:1.15, range:82, effects:[]} },
      { key:'2', name:'Provocación Sísmica', element:'Tierra', dmgType:'fisico', cost:25, cooldown:9, desc:'AoE que ralentiza. Fuerte vs Agua.', offense:{shape:'circle', mult:1.4, radius:135, effects:[{kind:'slow', amt:0.4, dur:2.5}]} },
      { key:'3', name:'Muro de Piedra', element:'Tierra', dmgType:'fisico', cost:30, cooldown:12, desc:'Escudo de roca de 160 durante 6s.', self:[{kind:'shield', amount:160, dur:6}] },
      { key:'4', name:'Fortaleza Inquebrantable', element:'Tierra', dmgType:'fisico', cost:100, cooldown:55, desc:'+50% defensa y refleja 25% del daño 8s.', self:[{kind:'defense', amt:0.5, dur:8},{kind:'reflect', amt:0.25, dur:8}] },
    ]
  },

  // ---------------- BERSERKER (DPS fuerte / frágil) ----------------
  {
    id:'kael', name:'Kael', race:'Orco', nation:'Nación del Magma', element:'Fuego',
    role:'Verdugo (Berserker)',
    archetype:{ icon:'🔥', name:'Berserker', tagline:'Pega durísimo cuerpo a cuerpo, pero cae rápido.' },
    special:'✦ Más letal cuanto más cerca está de morir.',
    bio:'Guerrero orco que arde con más furia cuanto más cerca está de la muerte.',
    stats:{ maxHp:300, armor:0.05, power:30, critChance:0.12, critMult:1.7, attackSpeed:1.05, maxChakra:100, moveSpeed:150, healPower:1.0 },
    passive:{ id:'furia_sangre', name:'Furia de Sangre', desc:'+15% daño con HP<30% (+30% con HP<15%). Gana Chakra al ser golpeado.' },
    skills:[
      { key:'1', name:'Tajo Ardiente', element:'Fuego', dmgType:'fisico', cost:0, cooldown:0.55, desc:'Corte que aplica Quemadura.', offense:{shape:'melee', mult:1.05, range:80, effects:[{kind:'burn', dps:9, dur:3}]} },
      { key:'2', name:'Erupción', element:'Fuego', dmgType:'fisico', cost:30, cooldown:7, desc:'Estalla el suelo. Fuerte vs Viento. Empuja.', offense:{shape:'circle', mult:1.8, radius:115, effects:[{kind:'knockback', force:260}]} },
      { key:'3', name:'Carga Salvaje', element:'Fuego', dmgType:'fisico', cost:20, cooldown:9, desc:'Embiste en línea y aturde.', dash:{mode:'forward', distance:215}, offense:{shape:'melee', mult:1.2, range:92, effects:[{kind:'stun', dur:1.0}]} },
      { key:'4', name:'Inmolación', element:'Fuego', dmgType:'fisico', cost:100, cooldown:55, desc:'+30% daño y aura de fuego 8s.', self:[{kind:'buffDamage', amt:0.30, dur:8}], zone:{kind:'aura', placement:'follow', element:'Fuego', radius:120, perTick:11, interval:0.5, dur:8} },
    ]
  },

  // ---------------- MAGO ----------------
  {
    id:'gorr', name:'Gorr', race:'Cíclope', nation:'Nación del Trueno', element:'Rayo',
    role:'Místico (Mago)',
    archetype:{ icon:'🔮', name:'Mago', tagline:'Gran poder mágico a distancia; frágil. Su magia ignora ½ armadura.' },
    special:'✦ Daño mágico: penetra la mitad de la armadura enemiga.',
    bio:'Su ojo único canaliza tormentas que saltan entre los enemigos.',
    stats:{ maxHp:210, armor:0.0, power:30, critChance:0.06, critMult:1.6, attackSpeed:0.95, maxChakra:160, moveSpeed:144, healPower:1.0 },
    passive:{ id:'ojo_atronador', name:'Ojo Atronador', desc:'Los básicos aplican Estática (máx 3). Cadena de Relámpagos la consume para +daño.' },
    skills:[
      { key:'1', name:'Descarga', element:'Rayo', dmgType:'magico', cost:0, cooldown:0.5, desc:'Rayo a distancia; aplica Estática.', offense:{shape:'projectile', mult:1.0, speed:650, range:560, effects:[{kind:'estatica'}]} },
      { key:'2', name:'Cadena de Relámpagos', element:'Rayo', dmgType:'magico', cost:35, cooldown:8, desc:'Descarga en área. Fuerte vs Tierra. +daño por Estática.', offense:{shape:'circle', mult:1.7, radius:125, consumesEstatica:true, effects:[]} },
      { key:'3', name:'Teletransporte Estático', element:'Rayo', dmgType:'magico', cost:25, cooldown:10, desc:'Parpadea; deja una zona eléctrica donde estabas.', dash:{mode:'blink', distance:265}, zone:{kind:'static', placement:'origin', element:'Rayo', radius:95, perTick:9, interval:0.5, dur:3} },
      { key:'4', name:'Juicio del Trueno', element:'Rayo', dmgType:'magico', cost:100, cooldown:60, desc:'Rayo del cielo en la mira: gran daño + aturde.', offense:{shape:'nuke', mult:3.6, radius:150, delay:0.6, effects:[{kind:'stun', dur:1.2}]} },
    ]
  },

  // ---------------- ASESINA (velocidad + crítico) ----------------
  {
    id:'sylth', name:'Sylth', race:'Elfo', nation:'Nación del Viento', element:'Viento',
    role:'Verdugo (Asesina ágil)',
    archetype:{ icon:'🏹', name:'Asesina', tagline:'Crítico altísimo y máxima velocidad, a distancia. Papel mojado.' },
    special:'✦ Velocidad de ataque y probabilidad de crítico extremas.',
    bio:'Arquera élfica imposible de fijar; cada esquiva la vuelve más letal.',
    stats:{ maxHp:190, armor:0.0, power:21, critChance:0.45, critMult:2.0, attackSpeed:1.6, maxChakra:100, moveSpeed:196, healPower:1.0 },
    passive:{ id:'paso_ligero', name:'Paso Ligero', desc:'+20% velocidad (incluida). Tras un dash, tu siguiente golpe hace +25%.' },
    skills:[
      { key:'1', name:'Flecha de Viento', element:'Viento', dmgType:'fisico', cost:0, cooldown:0.42, desc:'Disparo muy rápido a distancia.', offense:{shape:'projectile', mult:1.0, speed:600, range:540, effects:[]} },
      { key:'2', name:'Ráfaga Cortante', element:'Viento', dmgType:'fisico', cost:30, cooldown:7, desc:'Cono de viento. Fuerte vs Rayo. Empuja.', offense:{shape:'cone', mult:1.7, radius:138, effects:[{kind:'knockback', force:320}]} },
      { key:'3', name:'Salto del Halcón', element:'Viento', dmgType:'fisico', cost:15, cooldown:6, desc:'Dash aéreo evasivo (activa la pasiva).', dash:{mode:'forward', distance:250}, self:[{kind:'dodgeBuff'}] },
      { key:'4', name:'Tempestad', element:'Viento', dmgType:'fisico', cost:100, cooldown:50, desc:'Invoca un tornado en la mira 5s.', zone:{kind:'tornado', placement:'mouse', element:'Viento', radius:130, perTick:12, interval:0.4, dur:5, slow:0.4} },
    ]
  },

  // ---------------- VERDUGO (crítico cuerpo a cuerpo) ----------------
  {
    id:'drako', name:'Drako', race:'Dracónido', nation:'Nación del Abismo', element:'Agua',
    role:'Verdugo (DPS crítico)',
    archetype:{ icon:'💥', name:'Verdugo', tagline:'DPS crítico cuerpo a cuerpo: rápido y letal, poco aguante.' },
    special:'✦ Sus golpes empapan al rival y lo dejan vulnerable.',
    bio:'Dragón de las simas; sus garras dejan a las presas empapadas y vulnerables.',
    stats:{ maxHp:250, armor:0.04, power:25, critChance:0.35, critMult:1.85, attackSpeed:1.45, maxChakra:100, moveSpeed:168, healPower:1.0 },
    passive:{ id:'aliento_leviatan', name:'Aliento del Leviatán', desc:'Tus golpes aplican Humedad: el objetivo recibe +12% daño un tiempo.' },
    skills:[
      { key:'1', name:'Garra Abisal', element:'Agua', dmgType:'fisico', cost:0, cooldown:0.46, desc:'Zarpazo veloz que aplica Humedad.', offense:{shape:'melee', mult:1.05, range:78, effects:[{kind:'humedad', amt:0.12, dur:4}]} },
      { key:'2', name:'Maremoto', element:'Agua', dmgType:'fisico', cost:35, cooldown:8, desc:'Ola en línea que atraviesa. Fuerte vs Madera. Empuja.', offense:{shape:'line', mult:1.7, range:330, speed:520, width:34, pierce:true, effects:[{kind:'knockback', force:280},{kind:'humedad', amt:0.12, dur:4}]} },
      { key:'3', name:'Inmersión', element:'Agua', dmgType:'fisico', cost:20, cooldown:10, desc:'Reaparece tras el objetivo; limpia Quemadura.', dash:{mode:'behind', distance:260}, self:[{kind:'cleanse', kinds:['burn']}] },
      { key:'4', name:'Furia del Leviatán', element:'Agua', dmgType:'fisico', cost:100, cooldown:55, desc:'Torrente que te cura y daña a tu alrededor 6s.', self:[{kind:'heal', amount:150}], zone:{kind:'torrente', placement:'follow', element:'Agua', radius:130, perTick:12, interval:0.5, dur:6} },
    ]
  },

  // ---------------- SANADORA ----------------
  {
    id:'lyra', name:'Lyra', race:'Humana', nation:'Nación del Bosque Eterno', element:'Madera',
    role:'Erudito (Sanadora)',
    archetype:{ icon:'✨', name:'Sanadora', tagline:'Cura y escuda al equipo; su daño es muy bajo.' },
    special:'✚ Curación potente (+70%); sus curas otorgan escudo.',
    bio:'Heredera del Sello Viviente; teje savia que cura y aprisiona.',
    stats:{ maxHp:285, armor:0.05, power:11, critChance:0.05, critMult:1.5, attackSpeed:1.0, maxChakra:145, moveSpeed:150, healPower:1.7 },
    passive:{ id:'savia_sello', name:'Savia del Sello', desc:'+70% curación. Tus curaciones otorgan un escudo del 30% de lo curado.' },
    skills:[
      { key:'1', name:'Zarpazo de Espinas', element:'Madera', dmgType:'magico', cost:0, cooldown:0.5, desc:'Látigo de enredadera de medio alcance.', offense:{shape:'melee', mult:1.0, range:118, effects:[]} },
      { key:'2', name:'Enredadera', element:'Madera', dmgType:'magico', cost:30, cooldown:9, desc:'Raíces que inmovilizan. Fuerte vs Fuego.', offense:{shape:'circle', mult:1.3, radius:120, effects:[{kind:'root', dur:2.0}]} },
      { key:'3', name:'Bendición de Savia', element:'Madera', dmgType:'magico', cost:35, cooldown:7, desc:'Gran curación (la pasiva añade escudo).', self:[{kind:'heal', amount:120}] },
      { key:'4', name:'Floración del Árbol Madre', element:'Madera', dmgType:'magico', cost:100, cooldown:55, desc:'Zona que cura y regenera Chakra 8s.', zone:{kind:'floracion', placement:'follow', element:'Madera', radius:150, perTick:0, interval:0.5, dur:8, healPerTick:14, chakraPerTick:5} },
    ]
  },
];

// Centinela de prueba: blanco con vida alta y regeneración, elemento configurable.
const DUMMY_DEF = {
  id:'dummy', name:'Centinela de Prueba', race:'Autómata', nation:'—', element:'Tierra',
  role:'Blanco de pruebas', radius:27,
  stats:{ maxHp:700, armor:0.0, power:15, critChance:0.0, critMult:1.5, attackSpeed:1.0, maxChakra:0, moveSpeed:118, healPower:1.0 },
  passive:null,
  skills:[ { key:'x', name:'Golpe', element:'Tierra', dmgType:'fisico', cost:0, cooldown:0, desc:'Golpe de prueba.', offense:{shape:'melee', mult:1.0, range:82, effects:[]} } ],
};
