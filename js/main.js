// ====================================================================
//  main.js — Arranque, navegación entre pantallas, selección de héroe,
//  Cámara de Acertijos (lógica/cálculo/geometría/memoria/oído) y Bóveda.
//  Guarda el progreso en localStorage.
// ====================================================================

(function(){
  const SAVE_KEY = 'elemental_legacy_save_v1';
  const $ = (id) => document.getElementById(id);
  let game = null;
  let currentFilter = 'todos';
  let save = loadSave();
  let modalTimers = [];
  let audioCtx = null;
  let modalState = null;

  // ---------------- persistencia ----------------
  function loadSave(){ try{ const r = localStorage.getItem(SAVE_KEY); if (r) return JSON.parse(r); }catch(e){} return { solved:[], equipped:[] }; }
  function persist(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){} }
  function isSolved(id){ return save.solved.indexOf(id) >= 0; }
  function isUnlocked(rewardId){ return PUZZLES.some(p => p.reward === rewardId && isSolved(p.id)); }
  function unlockedRewards(){ return Object.keys(REWARDS).map(k=>REWARDS[k]).filter(r => isUnlocked(r.id)); }
  function clampf(v){ return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function norm(s){ return s.toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[.,;:!¡¿?]/g,'').replace(/\s+/g,' '); }

  // ---------------- navegación ----------------
  const SCREENS = ['select-screen','puzzle-screen','vault-screen','game-screen'];
  function showScreen(id){
    if (id !== 'game-screen' && game){ game.stop(); game = null; }
    SCREENS.forEach(s => { $(s).hidden = (s !== id); });
    document.querySelectorAll('#mainnav .tab').forEach(t => t.classList.toggle('active', t.dataset.screen === id));
    if (id === 'select-screen') buildSelect();
    if (id === 'puzzle-screen') buildPuzzles();
    if (id === 'vault-screen') buildVault();
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
    buildReliquiaBar();
    const grid = $('char-grid');
    grid.innerHTML = CHARACTERS.map(cardHTML).join('');
    Array.from(grid.querySelectorAll('.card')).forEach((el,i) => {
      el.querySelector('.play').addEventListener('click', () => startGame(CHARACTERS[i]));
    });
  }
  function buildReliquiaBar(){
    const bar = $('reliquia-bar');
    const rel = unlockedRewards().filter(r => r.kind === 'reliquia');
    if (!rel.length){
      bar.innerHTML = '<div class="relhint">🔒 Resuelve acertijos en la <b>Cámara de Acertijos</b> para desbloquear <b>Reliquias</b> (poderes) y equiparlas aquí (máx. 2).</div>';
      return;
    }
    bar.innerHTML = '<div class="relpanel"><span class="rellabel">⚜️ Reliquias equipadas (máx 2):</span>'
      + rel.map(r => {
        const on = save.equipped.indexOf(r.id) >= 0;
        return '<button class="chip '+(on?'on':'')+'" data-rel="'+r.id+'">'+r.icon+' '+r.name+' <small>'+r.desc+'</small></button>';
      }).join('') + '</div>';
    bar.querySelectorAll('.chip').forEach(ch => ch.addEventListener('click', () => {
      const id = ch.dataset.rel, i = save.equipped.indexOf(id);
      if (i >= 0) save.equipped.splice(i,1);
      else { if (save.equipped.length >= 2){ flash(ch,'Solo 2 Reliquias'); return; } save.equipped.push(id); }
      persist(); buildReliquiaBar();
    }));
  }
  function flash(el,msg){ const old = el.getAttribute('title'); el.setAttribute('title',msg); setTimeout(()=>el.setAttribute('title',old||''),900); }

  function startGame(def){
    const d = JSON.parse(JSON.stringify(def));   // clon para no mutar el original
    save.equipped.forEach(id => { const r = REWARDS[id]; if (r && r.apply) r.apply(d.stats); });
    showScreen('game-screen');
    if (game) game.stop();
    game = new Game($('game'), d);
    game.onExit = () => showScreen('select-screen');
    game.start();
  }

  // ---------------- Cámara de Acertijos ----------------
  function buildPuzzles(){
    // filtros por categoría
    const filt = $('puzzle-filters');
    const cats = ['todos'].concat(Object.keys(CATEGORIES));
    filt.innerHTML = cats.map(k => {
      const label = k === 'todos' ? '◆ Todos' : (CATEGORIES[k].icon + ' ' + CATEGORIES[k].name);
      return '<button class="fchip '+(currentFilter===k?'on':'')+'" data-cat="'+k+'">'+label+'</button>';
    }).join('');
    filt.querySelectorAll('.fchip').forEach(b => b.addEventListener('click', () => { currentFilter = b.dataset.cat; buildPuzzles(); }));

    const list = $('puzzle-list');
    const items = PUZZLES.filter(p => currentFilter === 'todos' || p.category === currentFilter);
    list.innerHTML = items.map(p => {
      const solved = isSolved(p.id), rw = REWARDS[p.reward], cat = CATEGORIES[p.category];
      return '<article class="puzzle '+(solved?'solved':'')+'">'
        + '<div class="pbadges"><span class="pcat">'+cat.icon+' '+cat.name+'</span>'
        + '<span class="ptier '+(p.team?'team':'')+'">'+(p.team?'👥 En equipo':p.tier)+'</span></div>'
        + '<h3>'+(solved?'✓ ':'')+p.title+'</h3>'
        + '<div class="preward">Recompensa: '+rw.icon+' '+rw.name+'</div>'
        + '<button class="popen" data-id="'+p.id+'">'+(solved?'Repetir':'Resolver ▶')+'</button>'
        + '</article>';
    }).join('');
    list.querySelectorAll('.popen').forEach(b => b.addEventListener('click', () => openPuzzle(b.dataset.id)));
  }

  function clearModalTimers(){ modalTimers.forEach(t => clearTimeout(t)); modalTimers = []; }
  function closeModal(){ clearModalTimers(); modalState = null; $('puzzle-modal').hidden = true; }

  function openPuzzle(id){
    clearModalTimers();
    const p = PUZZLES.find(x => x.id === id);
    const rw = REWARDS[p.reward], cat = CATEGORIES[p.category];
    modalState = { p:p, seq:[], input:[], awaiting:false };

    let body = '';
    if (p.type === 'choice'){
      body = '<div class="opts">' + p.options.map((o,i) => '<button class="opt" data-i="'+i+'">'+o+'</button>').join('') + '</div>';
    } else if (p.type === 'input'){
      body = (p.figure ? '<canvas id="figure-canvas" width="190" height="190"></canvas>' : '')
        + '<div class="inputrow"><input id="p-input" type="text" placeholder="Escribe tu respuesta…" autocomplete="off"><button id="p-submit">Comprobar</button></div>';
    } else if (p.type === 'memory'){
      body = '<div class="pads" id="pads">' + ['Fuego','Rayo','Agua','Madera'].map((el,i) =>
        '<button class="pad" data-i="'+i+'" style="--c:'+ELEMENT_META[el].color+';--g:'+ELEMENT_META[el].glow+'">'+ELEMENT_META[el].emoji+'</button>').join('') + '</div>'
        + '<div class="ctrlrow"><button id="p-play" class="ghost">▶ Mostrar secuencia</button><span id="p-progress" class="progress"></span></div>';
    } else if (p.type === 'audio'){
      body = '<div class="tones"><button class="tone" data-i="0">🔊 GRAVE</button><button class="tone" data-i="1">🔊 AGUDO</button></div>'
        + '<div class="ctrlrow"><button id="p-play" class="ghost">▶ Escuchar secuencia</button><span id="p-progress" class="progress"></span></div>';
    }

    $('modal-card').innerHTML =
        '<button class="modal-close" id="m-close">✕</button>'
      + '<div class="pbadges"><span class="pcat">'+cat.icon+' '+cat.name+'</span>'
      + '<span class="ptier '+(p.team?'team':'')+'">'+(p.team?'👥 En equipo':p.tier)+'</span></div>'
      + '<h2>'+p.title+'</h2>'
      + '<p class="pquestion">'+p.question+'</p>'
      + body
      + '<div class="pfeedback" id="p-feedback"></div>'
      + '<div class="prow"><button id="p-hint" class="ghost">💡 Pista</button>'
      + '<span class="preward2">Recompensa: '+rw.icon+' '+rw.name+'</span></div>';

    $('puzzle-modal').hidden = false;
    $('m-close').onclick = closeModal;
    $('p-hint').onclick = () => { $('p-feedback').innerHTML = '<span class="hint">💡 '+p.hint+'</span>'; };

    if (p.type === 'choice'){
      $('modal-card').querySelectorAll('.opt').forEach(b => b.onclick = () => grade(p, parseInt(b.dataset.i,10) === p.answer));
    } else if (p.type === 'input'){
      if (p.figure) drawFigure(p.figure);
      const submit = () => grade(p, p.answer.map(norm).indexOf(norm($('p-input').value)) >= 0);
      $('p-submit').onclick = submit;
      $('p-input').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      $('p-input').focus();
    } else if (p.type === 'memory'){
      setupMemory(p);
    } else if (p.type === 'audio'){
      setupAudio(p);
    }
  }

  function grade(p, correct){
    const fb = $('p-feedback');
    if (correct){
      const first = !isSolved(p.id);
      if (first){ save.solved.push(p.id); persist(); }
      const rw = REWARDS[p.reward];
      fb.innerHTML = '<span class="ok">✅ ¡Correcto! '+(p.explain||'')
        + (first ? '<br>🎁 Desbloqueado: <b>'+rw.icon+' '+rw.name+'</b>' : '<br><i>(ya lo tenías desbloqueado)</i>')+'</span>';
      buildPuzzles();
    } else {
      fb.innerHTML = '<span class="bad">❌ No es correcto. Analiza otra vez… pulsa 💡 Pista si lo necesitas.</span>';
    }
    return correct;
  }

  // ----- memoria visual (estilo Simón) -----
  function setupMemory(p){
    const pads = Array.prototype.slice.call($('pads').querySelectorAll('.pad'));
    const prog = $('p-progress');
    modalState.seq = []; modalState.input = []; modalState.awaiting = false;
    for (let i=0;i<p.seqLen;i++) modalState.seq.push(Math.floor(Math.random()*pads.length));

    pads.forEach(pad => pad.onclick = () => {
      if (!modalState.awaiting) return;
      const i = parseInt(pad.dataset.i,10);
      blink(pad);
      modalState.input.push(i);
      const k = modalState.input.length - 1;
      if (modalState.input[k] !== modalState.seq[k]){
        modalState.awaiting = false; prog.textContent = '';
        $('p-feedback').innerHTML = '<span class="bad">❌ Esa no era. Pulsa ▶ Mostrar para volver a verla.</span>';
        return;
      }
      prog.textContent = modalState.input.length + ' / ' + modalState.seq.length;
      if (modalState.input.length === modalState.seq.length) grade(p, true);
    });

    $('p-play').onclick = () => {
      clearModalTimers(); modalState.input = []; modalState.awaiting = false; prog.textContent = 'Observa…';
      let i = 0;
      const step = () => {
        if (i >= modalState.seq.length){ modalState.awaiting = true; prog.textContent = 'Tu turno: 0 / ' + modalState.seq.length; return; }
        const pad = pads[modalState.seq[i]];
        pad.classList.add('active');
        modalTimers.push(setTimeout(() => { pad.classList.remove('active'); i++; modalTimers.push(setTimeout(step, 200)); }, 520));
      };
      modalTimers.push(setTimeout(step, 350));
    };
  }

  // ----- oído y memoria (tonos grave/agudo) -----
  function beep(freq, dur){
    try{
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      o.connect(g); g.connect(audioCtx.destination);
      const t = audioCtx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.03);
    }catch(e){}
  }
  function setupAudio(p){
    const tones = Array.prototype.slice.call($('modal-card').querySelectorAll('.tone'));
    const prog = $('p-progress');
    const FREQ = [330, 660]; // grave, agudo
    modalState.seq = []; modalState.input = []; modalState.awaiting = false;
    for (let i=0;i<p.seqLen;i++) modalState.seq.push(Math.floor(Math.random()*2));

    tones.forEach(btn => btn.onclick = () => {
      const i = parseInt(btn.dataset.i,10);
      beep(FREQ[i], 0.32); blink(btn);
      if (!modalState.awaiting) return;
      modalState.input.push(i);
      const k = modalState.input.length - 1;
      if (modalState.input[k] !== modalState.seq[k]){
        modalState.awaiting = false; prog.textContent = '';
        $('p-feedback').innerHTML = '<span class="bad">❌ Secuencia incorrecta. Pulsa ▶ Escuchar para repetirla.</span>';
        return;
      }
      prog.textContent = modalState.input.length + ' / ' + modalState.seq.length;
      if (modalState.input.length === modalState.seq.length) grade(p, true);
    });

    $('p-play').onclick = () => {
      clearModalTimers(); modalState.input = []; modalState.awaiting = false; prog.textContent = 'Escucha…';
      let i = 0;
      const step = () => {
        if (i >= modalState.seq.length){ modalState.awaiting = true; prog.textContent = 'Tu turno: 0 / ' + modalState.seq.length; return; }
        beep(FREQ[modalState.seq[i]], 0.32);
        const btn = tones[modalState.seq[i]]; blink(btn);
        i++; modalTimers.push(setTimeout(step, 480));
      };
      modalTimers.push(setTimeout(step, 350));
    };
  }
  function blink(el){ el.classList.add('active'); setTimeout(() => el.classList.remove('active'), 200); }

  // ----- figura de geometría -----
  function drawFigure(name){
    const cv = $('figure-canvas'); if (!cv) return;
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, p = 26;
    c.clearRect(0,0,W,H);
    c.strokeStyle = '#9be88a'; c.lineWidth = 3;
    if (name === 'square_diagonals'){
      c.strokeRect(p, p, W-2*p, H-2*p);
      c.beginPath(); c.moveTo(p,p); c.lineTo(W-p,H-p); c.moveTo(W-p,p); c.lineTo(p,H-p); c.stroke();
    }
  }

  // ---------------- Bóveda ----------------
  function buildVault(){
    const grid = $('vault-grid');
    const groups = [['material','Materiales de los Dioses'],['arma','Armas'],['armadura','Armaduras'],['reliquia','Reliquias (Poderes)']];
    const total = Object.keys(REWARDS).length, got = unlockedRewards().length;
    let html = '<div class="vprogress">Progreso: <b>'+got+' / '+total+'</b> recompensas · Acertijos resueltos: <b>'+save.solved.length+' / '+PUZZLES.length+'</b></div>';
    html += groups.map(g => {
      const kind = g[0], label = g[1];
      const items = Object.keys(REWARDS).map(k=>REWARDS[k]).filter(r => r.kind === kind);
      return '<div class="vgroup"><h3>'+label+'</h3><div class="vitems">'
        + items.map(r => {
          const ok = isUnlocked(r.id);
          return '<div class="vitem '+(ok?'got':'locked')+'"><span class="vicon">'+(ok?r.icon:'🔒')+'</span>'
            + '<div><b>'+(ok?r.name:'? ? ?')+'</b><br><small>'+(ok?r.desc:'Resuelve un acertijo para revelarlo.')+'</small></div></div>';
        }).join('') + '</div></div>';
    }).join('');
    grid.innerHTML = html;
  }

  // ---------------- init ----------------
  document.querySelectorAll('#mainnav .tab').forEach(t => t.addEventListener('click', () => showScreen(t.dataset.screen)));
  $('back-btn').addEventListener('click', () => showScreen('select-screen'));
  $('puzzle-modal').addEventListener('click', e => { if (e.target.id === 'puzzle-modal') closeModal(); });
  showScreen('select-screen');
})();
