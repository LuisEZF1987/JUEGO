// ====================================================================
//  account.js — Cuenta y personajes (estilo Lineage II).
//  · Varios personajes por cuenta; cada uno con su propio nivel/XP/oro/forja.
//  · Eliges/creas tu personaje al entrar (pantalla de selección).
//  · Persistencia local ahora (localStorage); en Fase 6 pasa al servidor
//    reutilizando este mismo modelo de datos.
//  Expone window.Account.
// ====================================================================

const Account = (function(){
  const KEY = 'el_account_v1';
  let data = (function(){ try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && Array.isArray(r.chars)) return r; } catch(e){} return { chars:[], activeId:null }; })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch(e){} };
  const uid  = () => 'c' + Date.now().toString(36) + Math.floor(Math.random()*46656).toString(36);

  const list      = () => data.chars;
  const active    = () => data.chars.find(c => c.id === data.activeId) || null;
  const setActive = (id) => { data.activeId = id; save(); };
  function create(name, hero){
    const c = { id:uid(), name:(String(name||'').trim().slice(0,16) || 'Héroe'), hero, level:1, xp:0, gold:0, kills:0, mats:{}, forge:{ weapon:0, armor:0, amulet:0 }, created:Date.now() };
    data.chars.push(c); data.activeId = c.id; save(); return c;
  }
  function remove(id){ data.chars = data.chars.filter(c => c.id !== id); if (data.activeId === id) data.activeId = data.chars[0] ? data.chars[0].id : null; save(); }

  // progreso del personaje ACTIVO (lo usa world3d)
  function progress(){ const c = active(); return c ? { level:c.level||1, xp:c.xp||0 } : { level:1, xp:0 }; }
  function setProgress(level, xp){ const c = active(); if (c){ c.level = level; c.xp = xp; save(); } }
  const charName = () => { const c = active(); return c ? c.name : 'Héroe'; };
  const charHero = () => { const c = active(); return c ? c.hero : 'kael'; };

  // ---------------- pantalla de selección / creación ----------------
  function render(el, onPlay){
    if (!el) return;
    const chars = list();
    let html = '';
    if (chars.length){
      html += '<div class="acc-roster">' + chars.map(c => {
        const ch = CHARACTERS.find(h => h.id === c.hero) || CHARACTERS[0], m = ELEMENT_META[ch.element];
        return '<article class="acc-char" style="--el:'+m.color+';--glow:'+m.glow+'">'
          + '<div class="acc-emoji">'+m.emoji+'</div>'
          + '<h3>'+c.name+'</h3>'
          + '<div class="acc-sub">'+ch.archetype.icon+' '+ch.archetype.name+' · '+ch.element+'</div>'
          + '<div class="acc-lvl">Nivel '+(c.level||1)+'</div>'
          + '<div class="acc-actions"><button class="play acc-play" data-id="'+c.id+'">▶ Jugar</button>'
          + '<button class="acc-del" data-id="'+c.id+'" title="Borrar personaje">🗑</button></div>'
          + '</article>';
      }).join('') + '<button class="acc-new" id="acc-new">＋ Crear personaje</button></div>';
    }
    const showForm = !chars.length;
    html += '<div class="acc-create" id="acc-create"'+(showForm?'':' hidden')+'>'
      + '<h2>'+(chars.length?'Nuevo personaje':'Crea tu personaje')+'</h2>'
      + '<input id="acc-name" class="acc-name" maxlength="16" placeholder="Nombre del personaje" autocomplete="off">'
      + '<div class="acc-pick">' + CHARACTERS.map(c => { const m = ELEMENT_META[c.element];
          return '<button class="acc-hero" data-id="'+c.id+'" style="--el:'+m.color+';--glow:'+m.glow+'">'
            + '<span class="e">'+m.emoji+'</span><b>'+c.name+'</b><small>'+c.archetype.name+' · '+c.element+'</small></button>'; }).join('') + '</div>'
      + '<div class="acc-create-actions"><button class="play acc-confirm" id="acc-confirm" disabled>Crear y jugar</button>'
      + (chars.length ? '<button class="acc-cancel" id="acc-cancel">Cancelar</button>' : '') + '</div>'
      + '</div>';
    el.innerHTML = html;

    let pickHero = null;
    el.querySelectorAll('.acc-play').forEach(b => b.onclick = () => { setActive(b.dataset.id); onPlay(active()); });
    el.querySelectorAll('.acc-del').forEach(b => b.onclick = () => { if (confirm('¿Borrar este personaje? Se pierde su progreso.')){ remove(b.dataset.id); render(el, onPlay); } });
    const nb = el.querySelector('#acc-new'); if (nb) nb.onclick = () => { el.querySelector('#acc-create').hidden = false; nb.hidden = true; };
    const cc = el.querySelector('#acc-cancel'); if (cc) cc.onclick = () => render(el, onPlay);
    el.querySelectorAll('.acc-hero').forEach(b => b.onclick = () => { pickHero = b.dataset.id; el.querySelectorAll('.acc-hero').forEach(x => x.classList.toggle('on', x === b)); el.querySelector('#acc-confirm').disabled = false; });
    const cf = el.querySelector('#acc-confirm'); if (cf) cf.onclick = () => { if (!pickHero) return; const c = create(el.querySelector('#acc-name').value, pickHero); onPlay(c); };
  }

  // sincroniza el progreso runtime (world3d/mobs) con el personaje activo
  function pull(){ const c = active(); return c ? { level:c.level||1, xp:c.xp||0, gold:c.gold||0, kills:c.kills||0, mats:c.mats||(c.mats={}), forge:c.forge||(c.forge={weapon:0,armor:0,amulet:0}) } : null; }
  return { list, active, setActive, create, remove, progress, setProgress, pull, name:charName, hero:charHero, render, save };
})();
window.Account = Account;   // expuesto en window para los chequeos `window.Account` (main.js / world3d.js)
