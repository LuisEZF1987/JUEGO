// ====================================================================
//  main.js — Arranque y navegación. Enfocado en la experiencia tipo
//  Lineage II: 3 pantallas — Héroes · Arena · Mundo.
//    · Héroes: galería para elegir personaje (clase/elemento).
//    · Arena : duelo 3D 1v1 con skills (view3d.js).
//    · Mundo : mundo abierto multijugador (world3d.js).
// ====================================================================

(function(){
  const $ = (id) => document.getElementById(id);
  const clampf = (v) => v < 0 ? 0 : (v > 1 ? 1 : v);
  let hero3dId = 'kael';   // héroe seleccionado, compartido por Arena y Mundo

  // ---------------- navegación ----------------
  const SCREENS = ['select-screen','view3d-screen','world-screen'];
  function showScreen(id){
    if (id !== 'view3d-screen') View3D.stop();
    if (id !== 'world-screen' && typeof World3D !== 'undefined') World3D.stop();
    SCREENS.forEach(s => { const el = $(s); if (el) el.hidden = (s !== id); });
    document.querySelectorAll('#mainnav .tab').forEach(t => t.classList.toggle('active', t.dataset.screen === id));
    if (id === 'select-screen') buildSelect();
    if (id === 'view3d-screen') enter3D();
    if (id === 'world-screen') enterWorld();
  }

  // ---------------- selección de héroes ----------------
  function statBars(c){
    const s = c.stats;
    const bar = (label,frac,col) => '<div class="statline"><span>'+label+'</span><div class="bar"><i style="width:'+Math.round(clampf(frac)*100)+'%;background:'+col+'"></i></div></div>';
    return '<div class="stats">'
      + bar('Vida', s.maxHp/500, '#5ad469')
      + bar('Armadura', s.armor/0.32, '#cda15a')
      + bar('Daño', s.power/32, '#ff6b5a')
      + bar('Crítico', s.critChance/0.5, '#ffd23c')
      + bar('Velocidad', s.moveSpeed/200, '#6bd0ff')
      + '</div>';
  }
  function cardHTML(c){
    const m = ELEMENT_META[c.element], a = c.archetype;
    const skills = c.skills.map(s => '<li><b>['+s.key+'] '+s.name+'</b> — '+s.desc+'</li>').join('');
    return '<article class="card" style="--el:'+m.color+';--glow:'+m.glow+'">'
      + '<header><span class="emoji">'+m.emoji+'</span><div><h3>'+c.name+'</h3><span class="sub">'+c.race+' · '+c.element+'</span></div>'
      + '<span class="arch">'+a.icon+' '+a.name+'</span></header>'
      + '<p class="tagline">'+a.tagline+'</p>'
      + statBars(c)
      + '<div class="passive"><span class="tag">Pasivo</span> <b>'+c.passive.name+'</b><br><small>'+c.passive.desc+'</small></div>'
      + (c.special ? '<div class="special">'+c.special+'</div>' : '')
      + '<details class="skilldrop"><summary>Ver las 4 skills</summary><ul class="skills">'+skills+'</ul></details>'
      + '<button class="play">▶ Jugar con '+c.name+'</button>'
      + '</article>';
  }
  function buildSelect(){
    const grid = $('char-grid');
    if (window.Account && Account.render){
      // roster de cuenta: elegir/crear personaje (estilo L2)
      Account.render(grid, (c) => { if (c) hero3dId = c.hero; showScreen('world-screen'); });
    } else {
      // fallback: galería de héroes
      grid.innerHTML = CHARACTERS.map(cardHTML).join('');
      Array.from(grid.querySelectorAll('.card')).forEach((el,i) => {
        el.querySelector('.play').addEventListener('click', () => { hero3dId = CHARACTERS[i].id; showScreen('world-screen'); });
      });
    }
  }

  // ---------------- Arena (duelo 3D) ----------------
  function enter3D(){
    buildHero3DBar();
    const char = CHARACTERS.find(c => c.id === hero3dId) || CHARACTERS[0];
    View3D.init($('scene3d'), char);
    updateNation3DInfo(char);
  }
  function buildHero3DBar(){
    const bar = $('hero3d-bar');
    bar.innerHTML = CHARACTERS.map(c => {
      const m = ELEMENT_META[c.element], on = c.id === hero3dId;
      return '<button class="h3chip '+(on?'on':'')+'" data-id="'+c.id+'" style="--el:'+m.color+'">'+m.emoji+' '+c.name+' <small>'+c.archetype.name+'</small></button>';
    }).join('');
    bar.querySelectorAll('.h3chip').forEach(b => b.addEventListener('click', () => {
      hero3dId = b.dataset.id;
      const ch = CHARACTERS.find(c => c.id === hero3dId);
      View3D.setHero(ch); updateNation3DInfo(ch); buildHero3DBar();
    }));
  }
  function updateNation3DInfo(char){
    const info = $('nation3d-info'); if (!info) return;
    const t = NATION_THEME[char.element], m = ELEMENT_META[char.element];
    info.innerHTML = '<b>'+m.emoji+' '+char.nation+'</b> · '+char.element+' — <i>'+(t?t.biome:'')+'</i>'
      + '<br><small>'+(t?t.desc:'')+' · Héroe: '+char.name+' ('+char.race+', '+char.archetype.name+')</small>';
  }

  // ---------------- Mundo multijugador ----------------
  function enterWorld(){
    let acc = null;
    if (window.Account && Account.active){
      acc = Account.active();
      if (!acc){ showScreen('select-screen'); return; }   // sin personaje → a la selección
      hero3dId = acc.hero;
    }
    const char = CHARACTERS.find(c => c.id === hero3dId) || CHARACTERS[0];
    const bar = $('world-hero-bar');
    if (bar){ const m = ELEMENT_META[char.element];
      bar.innerHTML = acc
        ? '<div class="acc-active" style="--el:'+m.color+'">'+m.emoji+' <b>'+acc.name+'</b> · '+char.archetype.name+' · Nivel '+(acc.level||1)+'</div>'
        : ''; }
    World3D.init($('worldcanvas'), char);
  }

  // ---------------- init ----------------
  document.querySelectorAll('#mainnav .tab').forEach(t => t.addEventListener('click', () => showScreen(t.dataset.screen)));
  showScreen('select-screen');
})();
