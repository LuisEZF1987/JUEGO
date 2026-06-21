// ====================================================================
//  puzzles.js — Pilar educativo. Acertijos por CATEGORÍA de inteligencia
//  y por edad (tier). Resolverlos desbloquea recompensas (materiales,
//  equipo y Reliquias = poderes que potencian al héroe en la arena).
//  Pensado para que niños y adultos razonen, calculen y COLABOREN.
// ====================================================================

const CATEGORIES = {
  logica:     { icon:'🧠', name:'Lógica' },
  calculo:    { icon:'➗', name:'Cálculo mental' },
  matematica: { icon:'🔢', name:'Lógica matemática' },
  geometria:  { icon:'📐', name:'Física y geometría' },
  memoria:    { icon:'🎧', name:'Oído y memoria' },
};

const REWARDS = {
  // Materiales de los Dioses
  brasa:     { id:'brasa',     kind:'material', icon:'🔥', name:'Brasa Eterna',        desc:'Material de Pyrothar (Fuego).' },
  lagrima:   { id:'lagrima',   kind:'material', icon:'💧', name:'Lágrima Abisal',       desc:'Material de Nereon (Agua).' },
  pluma:     { id:'pluma',     kind:'material', icon:'🪶', name:'Pluma de Tempestad',   desc:'Material de Sylvaris (Viento).' },
  fragmento: { id:'fragmento', kind:'material', icon:'⚡', name:'Fragmento de Trueno',  desc:'Material de Vortigan (Rayo).' },
  savia:     { id:'savia',     kind:'material', icon:'🌿', name:'Savia Eterna',         desc:'Material de Aethelgard (Madera).' },
  corazon:   { id:'corazon',   kind:'material', icon:'🪨', name:'Corazón Pétreo',       desc:'Material de Terrgoth (Tierra).' },
  cristal:   { id:'cristal',   kind:'material', icon:'🔷', name:'Cristal Divino',       desc:'Catalizador de refinamiento.' },
  adamantita:{ id:'adamantita',kind:'material', icon:'⛏️', name:'Adamantita Estelar',   desc:'Lingote rarísimo de las profundidades.' },
  nucleo:    { id:'nucleo',    kind:'material', icon:'🌟', name:'Núcleo de Deidad',     desc:'Núcleo para forjar equipo de Grado Deidad.' },
  esencia:   { id:'esencia',   kind:'material', icon:'✴️', name:'Esencia del Sello',    desc:'Esencia liberada en la Fase de Oscuridad.' },
  // Equipo
  espada:    { id:'espada',    kind:'arma',     icon:'⚔️', name:'Espada de Acero Rúnico', desc:'Arma base para forjar la Espada de Grado Deidad.' },
  arco:      { id:'arco',      kind:'arma',     icon:'🏹', name:'Arco del Vendaval',      desc:'Arco élfico de viento veloz.' },
  armadura:  { id:'armadura',  kind:'armadura', icon:'🛡️', name:'Armadura de Adamantita', desc:'Protección pesada de las simas.' },
  // Reliquias (PODERES equipables, máx. 2)
  rel_poder:    { id:'rel_poder',    kind:'reliquia', icon:'⚜️', name:'Reliquia del Dios',      desc:'+12% poder de daño.',           apply:(s)=>{ s.power = Math.round(s.power*1.12); } },
  rel_vida:     { id:'rel_vida',     kind:'reliquia', icon:'❤️', name:'Reliquia del Baluarte',  desc:'+15% vida máxima.',             apply:(s)=>{ s.maxHp = Math.round(s.maxHp*1.15); } },
  rel_crit:     { id:'rel_crit',     kind:'reliquia', icon:'💥', name:'Reliquia del Verdugo',   desc:'+10% probabilidad de crítico.', apply:(s)=>{ s.critChance = Math.min(0.85, s.critChance+0.10); } },
  rel_chakra:   { id:'rel_chakra',   kind:'reliquia', icon:'🔵', name:'Reliquia del Sabio',     desc:'+25% Chakra máximo.',           apply:(s)=>{ s.maxChakra = Math.round(s.maxChakra*1.25); } },
  rel_velocidad:{ id:'rel_velocidad',kind:'reliquia', icon:'🌀', name:'Reliquia del Halcón',    desc:'+15% vel. de ataque y +8% de movimiento.', apply:(s)=>{ s.attackSpeed *= 1.15; s.moveSpeed = Math.round(s.moveSpeed*1.08); } },
  rel_sanacion: { id:'rel_sanacion', kind:'reliquia', icon:'💚', name:'Reliquia del Erudito',   desc:'+30% poder de curación.',       apply:(s)=>{ s.healPower *= 1.30; } },
  rel_armadura: { id:'rel_armadura', kind:'reliquia', icon:'🪨', name:'Reliquia de la Roca',    desc:'+8% de armadura.',              apply:(s)=>{ s.armor = Math.min(0.6, s.armor+0.08); } },
};

const PUZZLES = [
  // ===================== 🧠 LÓGICA =====================
  { id:'lo1', category:'logica', tier:'Aprendiz', type:'choice', reward:'brasa',
    title:'El anillo elemental',
    question:'En el ciclo Fuego ▸ Viento ▸ Rayo ▸ Tierra ▸ Agua ▸ Madera ▸ (Fuego), cada elemento vence al SIGUIENTE. ¿Qué elemento VENCE al Fuego?',
    options:['Agua','Madera','Rayo','Tierra'], answer:1,
    hint:'Mira quién está justo ANTES del Fuego: …Agua ▸ Madera ▸ Fuego.',
    explain:'La Madera (savia viva) sofoca al Fuego.' },

  { id:'lo2', category:'logica', tier:'Intermedio', type:'choice', reward:'savia',
    title:'Razonamiento del dragón',
    question:'TODOS los Dracónidos respiran bajo el agua. Drako es un Dracónido. Entonces… ¿Drako respira bajo el agua?',
    options:['Sí, seguro','No','No se puede saber'], answer:0,
    hint:'Si la regla vale para TODOS, vale para cada uno.',
    explain:'Silogismo: la regla general se aplica a Drako.' },

  { id:'lo3', category:'logica', tier:'Maestro', type:'choice', reward:'armadura',
    title:'El río de los Primordiales',
    question:'Cruza un río con un Lobo, una Oveja y una Col; el bote lleva solo uno contigo. Solos: el Lobo se come a la Oveja y la Oveja se come la Col. ¿Qué cruzas PRIMERO?',
    options:['La Oveja','El Lobo','La Col','Da igual'], answer:0,
    hint:'¿Qué pareja es peligrosa si la dejas sola en la orilla de salida?',
    explain:'Cruza la Oveja: así Lobo y Col quedan a salvo juntos.' },

  { id:'lo4', category:'logica', tier:'Maestro', type:'input', reward:'rel_poder',
    title:'Deducción de héroes',
    question:'Kael, Gorr y Lyra usan Fuego, Rayo y Madera (no en ese orden). Pistas: (1) Kael NO usa Rayo ni Madera. (2) Lyra cura con savia. ¿Qué elemento usa GORR?',
    answer:['rayo','el rayo','rayos'],
    hint:'Por la pista 1, Kael solo puede ser Fuego; Lyra (savia) es Madera. Queda…',
    explain:'Kael=Fuego, Lyra=Madera ⇒ Gorr=Rayo.' },

  // ===================== ➗ CÁLCULO MENTAL =====================
  { id:'ca1', category:'calculo', tier:'Aprendiz', type:'input', reward:'pluma',
    title:'Las 6 Naciones',
    question:'El mapa tiene 6 Naciones. Si visitas 2 cada día, ¿en cuántos días las visitas TODAS?',
    answer:['3','tres','3 dias'],
    hint:'6 ÷ 2 = ?',
    explain:'6 ÷ 2 = 3 días.' },

  { id:'ca2', category:'calculo', tier:'Aprendiz', type:'input', reward:'lagrima',
    title:'Suma rápida',
    question:'Calcula de cabeza:  7 + 8 + 5 = ?',
    answer:['20','veinte'],
    hint:'7 + 8 = 15, y 15 + 5 = …',
    explain:'7+8+5 = 20.' },

  { id:'ca3', category:'calculo', tier:'Intermedio', type:'input', reward:'fragmento',
    title:'Golpes al Centinela',
    question:'Un Centinela tiene 50 de vida y cada golpe le quita 5. ¿Cuántos golpes necesitas para derrotarlo?',
    answer:['10','diez'],
    hint:'50 ÷ 5 = ?',
    explain:'50 ÷ 5 = 10 golpes.' },

  { id:'ca4', category:'calculo', tier:'Maestro', type:'input', reward:'adamantita',
    title:'Cálculo encadenado',
    question:'Resuelve en orden:  12 × 12 − 44 = ?',
    answer:['100','cien'],
    hint:'12 × 12 = 144; luego 144 − 44.',
    explain:'144 − 44 = 100.' },

  // ===================== 🔢 LÓGICA MATEMÁTICA =====================
  { id:'ma1', category:'matematica', tier:'Aprendiz', type:'choice', reward:'corazon',
    title:'Sigue el patrón',
    question:'¿Qué símbolo continúa la serie?   🔥  💧  🔥  💧  🔥  ❓',
    options:['🔥','💧','🌿','⚡'], answer:1,
    hint:'Se turnan dos símbolos: uno sí, otro no.',
    explain:'Patrón alterno: tras 🔥 va 💧.' },

  { id:'ma2', category:'matematica', tier:'Intermedio', type:'input', reward:'cristal',
    title:'La chispa que se duplica',
    question:'Serie: 2, 4, 8, 16, … ¿Qué número viene después del 16?',
    answer:['32'],
    hint:'Cada número es el anterior × 2.',
    explain:'16 × 2 = 32.' },

  { id:'ma3', category:'matematica', tier:'Maestro', type:'input', reward:'rel_chakra',
    title:'La espiral sagrada',
    question:'Cada número es la suma de los DOS anteriores: 1, 1, 2, 3, 5, 8, … ¿Qué sigue?',
    answer:['13','trece'],
    hint:'Suma los dos últimos: 5 + 8.',
    explain:'5 + 8 = 13 (sucesión de Fibonacci).' },

  { id:'ma4', category:'matematica', tier:'Maestro', type:'input', reward:'espada',
    title:'El código del Sello',
    question:'El Sello se abre con el ÚNICO número entre 10 y 20 que es igual al DOBLE de la suma de sus cifras. ¿Cuál es?',
    answer:['18'],
    hint:'Para 18 → (1+8)=9 y 9×2=18. ¿Coincide?',
    explain:'18: (1+8)×2 = 18. Es el único entre 10 y 20.' },

  // ===================== 📐 FÍSICA Y GEOMETRÍA =====================
  { id:'ge1', category:'geometria', tier:'Aprendiz', type:'input', reward:'nucleo',
    title:'El panal de abejas',
    question:'Un hexágono, como la celda de un panal, ¿cuántos lados tiene?',
    answer:['6','seis'],
    hint:'Hexa- significa seis.',
    explain:'El hexágono tiene 6 lados.' },

  { id:'ge2', category:'geometria', tier:'Intermedio', type:'input', reward:'esencia',
    title:'Los ángulos del triángulo',
    question:'Los tres ángulos interiores de CUALQUIER triángulo suman… ¿cuántos grados?',
    answer:['180','180 grados','ciento ochenta'],
    hint:'Es la mitad de una vuelta completa (360°).',
    explain:'Siempre suman 180°.' },

  { id:'ge3', category:'geometria', tier:'Maestro', type:'choice', reward:'arco',
    title:'Caída en la Luna',
    question:'En la Luna NO hay aire. Sueltas a la vez una pluma y una roca desde la misma altura. ¿Cuál toca el suelo primero?',
    options:['La roca','La pluma','Llegan a la vez'], answer:2,
    hint:'Sin aire que frene, la gravedad acelera todo IGUAL.',
    explain:'¡Llegan a la vez! Sin resistencia del aire, todo cae igual (lo demostró el Apolo 15).' },

  { id:'ge4', category:'geometria', tier:'Maestro', type:'input', reward:'rel_armadura', figure:'square_diagonals',
    title:'Cuenta los triángulos',
    question:'Observa el cuadrado con sus dos diagonales. ¿Cuántos triángulos hay en total en la figura?',
    answer:['8','ocho'],
    hint:'Cuenta los 4 pequeños… y luego los grandes formados por dos pequeños.',
    explain:'4 pequeños + 4 grandes = 8 triángulos.' },

  // ===================== 🎧 OÍDO Y MEMORIA =====================
  { id:'me1', category:'memoria', tier:'Aprendiz', type:'memory', reward:'rel_velocidad', seqLen:4,
    title:'Memoria de los elementos',
    question:'Observa el ORDEN en que se iluminan los elementos y repítelo pulsándolos en la misma secuencia.',
    hint:'Repite mentalmente la secuencia mientras la ves.',
    explain:'¡Buena memoria visual!' },

  { id:'me2', category:'memoria', tier:'Intermedio', type:'audio', reward:'rel_sanacion', seqLen:4,
    title:'El eco de las campanas',
    question:'Escucha la secuencia de tonos (GRAVE / AGUDO) y repítela con los botones, en el mismo orden.',
    hint:'Cierra los ojos y escucha si cada tono sube o baja.',
    explain:'¡Gran oído y memoria auditiva!' },

  { id:'me3', category:'memoria', tier:'Maestro', type:'memory', reward:'rel_crit', seqLen:6,
    title:'La gran secuencia',
    question:'Una secuencia más larga: observa los 6 destellos y repítelos exactamente.',
    hint:'Agrupa la secuencia en parejas para recordarla mejor.',
    explain:'¡Memoria de maestro!' },

  // ===================== 👥 EN EQUIPO =====================
  { id:'eq1', category:'logica', tier:'Intermedio', team:true, type:'choice', reward:'rel_vida',
    title:'Pistas que se combinan',
    question:'JUNTEN sus pistas → 🧒 «el material NO es rojo, ni amarillo, ni azul».  🧑 «brilla como una hoja en primavera y restaura la vida». ¿Qué material es?',
    options:['🔥 Brasa Eterna','⚡ Fragmento de Trueno','🌿 Savia Eterna','💧 Lágrima Abisal'], answer:2,
    hint:'Verde + curación + naturaleza apuntan a un único elemento.',
    explain:'Verde (Madera) y curativo: la Savia Eterna. ¡Solo se resuelve uniendo ambas pistas!' },
];
