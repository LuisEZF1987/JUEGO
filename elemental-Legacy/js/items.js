// ====================================================================
//  items.js — Catálogo de materiales (icono / color / rareza) y el
//  render del inventario (Forja). Autocontenido: window.ITEMS.
//  Así el panel rico vive aquí y world3d solo le pasa los datos.
// ====================================================================

const ITEMS = (function(){
  // icono (emoji = imagen vectorial nativa), color de rareza y tier
  const CAT = {
    'Lingote de Hierro':       { icon:'🔩', color:'#9aa3b2', tier:'Común' },
    'Madera de Roble':         { icon:'🪵', color:'#a9754a', tier:'Común' },
    'Polvo de Refinamiento':   { icon:'✨', color:'#cbb46a', tier:'Común' },
    'Cristal de Refinamiento': { icon:'🔷', color:'#5fa8ff', tier:'Raro' },
    'Cristal Divino':          { icon:'💠', color:'#a06bff', tier:'Épico' },
    'Adamantita Estelar':      { icon:'⛏️', color:'#7fe0ff', tier:'Épico' },
    // materiales de Dios (jefes) — Grado Deidad
    'Brasa Eterna':            { icon:'🔥', color:'#ff5a3c', tier:'Divino' },
    'Pluma de Tempestad':      { icon:'🪶', color:'#7fe3a0', tier:'Divino' },
    'Fragmento de Trueno':     { icon:'⚡', color:'#ffd23c', tier:'Divino' },
    'Corazón Pétreo':          { icon:'🪨', color:'#c08a4a', tier:'Divino' },
    'Lágrima Abisal':          { icon:'💧', color:'#3ca6ff', tier:'Divino' },
    'Savia Eterna':            { icon:'🌿', color:'#5fbf4f', tier:'Divino' },
  };
  function meta(name){ return CAT[name] || { icon:'📦', color:'#9aa3b2', tier:'Material' }; }

  // d = { gold, kills, mats:{name:count}, slots:[{key,name,icon,level,stat,maxed,can,matName,matCount,gold}], onUpgrade(key), onClose() }
  function renderInventory(panelEl, d){
    if (!panelEl) return;
    const names = Object.keys(d.mats || {}).filter(n => d.mats[n] > 0);
    const tiles = names.length
      ? names.map(n => { const it = meta(n);
          return '<div class="wp-tile" style="--mc:'+it.color+'" title="'+n+' · '+it.tier+'">'
            + '<span class="wp-tic">'+it.icon+'</span>'
            + '<span class="wp-tq">'+d.mats[n]+'</span>'
            + '<span class="wp-tn">'+n+'</span>'
            + '<span class="wp-tt">'+it.tier+'</span></div>'; }).join('')
      : '<div class="wp-empty">— aún no tienes materiales · caza bestias y Jefes para conseguirlos —</div>';

    const rows = d.slots.map(s => { const im = meta(s.matName);
      return '<div class="wp-row">'
        + '<div class="wp-slot"><span class="wp-ic">'+s.icon+'</span><div><b>'+s.name+' <span class="wp-plus">+'+s.level+'</span></b><br><small>'+s.stat+'</small></div></div>'
        + (s.maxed
            ? '<div class="wp-max">MÁX</div>'
            : '<button class="wp-up'+(s.can?'':' off')+'" data-slot="'+s.key+'">⬆ Mejorar a +'+(s.level+1)
              + '<br><small><span class="wp-cost" style="color:'+im.color+'">'+im.icon+' '+s.matCount+'× '+s.matName+'</span> · 💰 '+s.gold+'</small></button>')
        + '</div>';
    }).join('');

    panelEl.innerHTML = '<div class="wp-card">'
      + '<div class="wp-head"><h3>🔨 Forja &amp; Inventario</h3><button class="wp-x" id="wp-close" title="Cerrar (I)">✕</button></div>'
      + '<div class="wp-gold">💰 <b>'+d.gold+'</b> oro · ☠ <b>'+(d.kills||0)+'</b> bajas</div>'
      + '<div class="wp-section">Materiales</div><div class="wp-mats">'+tiles+'</div>'
      + '<div class="wp-section">Equipo</div><div class="wp-rows">'+rows+'</div>'
      + '<div class="wp-foot">Caza bestias y <b>Dioses Encadenados</b> para materiales. Pulsa <b>I</b> para cerrar.</div></div>';

    const cl = panelEl.querySelector('#wp-close'); if (cl) cl.onclick = d.onClose;
    panelEl.querySelectorAll('.wp-up').forEach(b => b.onclick = () => d.onUpgrade(b.dataset.slot));
  }

  return { meta, renderInventory, CAT };
})();
window.ITEMS = ITEMS;   // expuesto en window (como Mobs/HeroGLTF) para los chequeos `window.ITEMS`
