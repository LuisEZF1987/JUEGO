// ====================================================================
//  game.js — Bucle de juego, arena en tiempo real, entrada, IA y HUD.
// ====================================================================

const TOP_BAR = 46, HUD_BOTTOM = 110;
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }

class Game {
  constructor(canvas, def){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width; this.H = canvas.height;
    this.arena = { x:0, y:TOP_BAR, w:this.W, h:this.H - TOP_BAR - HUD_BOTTOM };
    this.arena.cx = this.arena.x + this.arena.w/2;
    this.arena.cy = this.arena.y + this.arena.h/2;

    this.player = new Entity(def, this.arena.cx, this.arena.cy + 130, 'player');
    const edef = JSON.parse(JSON.stringify(DUMMY_DEF));
    this.enemy = new Entity(edef, this.arena.cx, this.arena.cy - 130, 'enemy');
    this.entities = [this.player, this.enemy];
    this.enemyRegen = 22;

    this.projectiles = []; this.zones = []; this.strikes = [];
    this.rings = []; this.particles = []; this.texts = [];

    this.keys = new Set();
    this.mouse = { x:this.arena.cx, y:this.arena.cy };
    this.running = false; this._raf = 0;

    this._onKeyDown = this.onKeyDown.bind(this);
    this._onKeyUp   = this.onKeyUp.bind(this);
    this._onMove    = this.onMouseMove.bind(this);
    this._onDown    = this.onMouseDown.bind(this);
    this.loop = this.loop.bind(this);
    this.onExit = null;
  }

  // ---------------- ciclo ----------------
  start(){
    this.running = true; this.last = performance.now();
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    this.canvas.addEventListener('mousemove', this._onMove);
    this.canvas.addEventListener('mousedown', this._onDown);
    this._raf = requestAnimationFrame(this.loop);
  }
  stop(){
    this.running = false; cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('mousemove', this._onMove);
    this.canvas.removeEventListener('mousedown', this._onDown);
  }
  loop(now){
    if (!this.running) return;
    let dt = (now - this.last)/1000; this.last = now; dt = Math.min(0.05, dt);
    this.update(dt); this.render();
    this._raf = requestAnimationFrame(this.loop);
  }

  // ---------------- entrada ----------------
  onKeyDown(e){
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (k==='1') this.tryCast(0);
    else if (k==='2') this.tryCast(1);
    else if (k==='3') this.tryCast(2);
    else if (k==='4') this.tryCast(3);
    else if (k==='q') this.cycleEnemyElement(-1);
    else if (k==='e') this.cycleEnemyElement(1);
    else if (k==='escape'){ if (this.onExit) this.onExit(); }
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  }
  onKeyUp(e){ this.keys.delete(e.key.toLowerCase()); }
  onMouseMove(e){
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) * (this.W / r.width);
    this.mouse.y = (e.clientY - r.top) * (this.H / r.height);
  }
  onMouseDown(e){ if (e.button === 0) this.tryCast(0); }

  tryCast(index){
    const p = this.player; if (p.dead) return;
    const sk = p.skills[index]; if (!sk) return;
    if (!p.canAct()){ this.floatText(p.x, p.y-54, 'Aturdido', '#ffce54'); return; }
    if ((p.cooldowns[sk.key]||0) > 0) return;
    if (p.chakra < sk.cost){ this.floatText(p.x, p.y-54, 'Sin Chakra', '#7fd0ff', 0.9); return; }
    p.chakra -= sk.cost;
    let cd = sk.cooldown; if (index === 0) cd = cd / (p.attackSpeed || 1); // velocidad de ataque
    p.cooldowns[sk.key] = cd; p.cdTotal[sk.key] = cd;
    if (sk.cost === 0) p.chakra = Math.min(p.maxChakra, p.chakra + 5);
    Combat.execute(sk, p, this);
  }

  cycleEnemyElement(dir){
    const e = this.enemy;
    let i = ELEMENT_RING.indexOf(e.element);
    i = (i + dir + ELEMENT_RING.length) % ELEMENT_RING.length;
    const el = ELEMENT_RING[i];
    e.element = el; e.color = ELEMENT_META[el].color; e.skills[0].element = el;
    this.floatText(e.x, e.y - 50, 'Rival: ' + el, ELEMENT_META[el].glow, 1.1);
  }

  // ---------------- helpers de combate ----------------
  getAimDir(caster){
    let tx, ty;
    if (caster.faction === 'player'){ tx = this.mouse.x; ty = this.mouse.y; }
    else { tx = this.player.x; ty = this.player.y; }
    const dx = tx - caster.x, dy = ty - caster.y, d = Math.hypot(dx,dy) || 1;
    return { x:dx/d, y:dy/d };
  }
  nearestEnemy(caster){
    let best=null, bd=1e9;
    for (const e of this.entities){
      if (e.dead || e.faction === caster.faction) continue;
      const d = Math.hypot(e.x-caster.x, e.y-caster.y);
      if (d < bd){ bd = d; best = e; }
    }
    return best;
  }
  clampPoint(x,y){ const a=this.arena; return { x:clamp(x,a.x,a.x+a.w), y:clamp(y,a.y,a.y+a.h) }; }
  floatText(x,y,text,color,scale){ this.texts.push({x,y,text,color,scale:scale||1,t:0.95,vy:-42}); }
  spawnRing(x,y,r,color,life){ this.rings.push({x,y,r,color,t:life,maxT:life}); }

  // ---------------- update ----------------
  update(dt){
    const p = this.player;
    if (!p.dead && p.canMove()){
      let mx=0,my=0;
      if (this.keys.has('w')||this.keys.has('arrowup')) my-=1;
      if (this.keys.has('s')||this.keys.has('arrowdown')) my+=1;
      if (this.keys.has('a')||this.keys.has('arrowleft')) mx-=1;
      if (this.keys.has('d')||this.keys.has('arrowright')) mx+=1;
      if (mx||my){ const d=Math.hypot(mx,my); p.x += mx/d*p.speed*dt; p.y += my/d*p.speed*dt; }
    }
    if (!p.dead) p.facing = this.getAimDir(p);
    p.update(dt, this);

    this.updateEnemy(dt);
    this.enemy.update(dt, this);

    this.updateProjectiles(dt);
    this.updateStrikes(dt);
    this.updateZones(dt);
    this.updateFX(dt);
  }

  updateEnemy(dt){
    const e = this.enemy, p = this.player;
    if (e.dead) return;
    e.hp = Math.min(e.maxHp, e.hp + this.enemyRegen * dt); // regenera para practicar
    const dx = p.x-e.x, dy = p.y-e.y, d = Math.hypot(dx,dy) || 1;
    e.facing = { x:dx/d, y:dy/d };
    if (e.canMove() && d > 78){ e.x += dx/d*e.speed*0.55*dt; e.y += dy/d*e.speed*0.55*dt; }
    if (e.canAct() && d <= 94 && e.basicCd <= 0 && !p.dead){ Combat.execute(e.skills[0], e, this); e.basicCd = 1.5; }
  }

  updateProjectiles(dt){
    const a = this.arena;
    for (const p of this.projectiles){
      p.x += p.vx*dt; p.y += p.vy*dt; p.traveled += p.speed*dt;
      this.particles.push({x:p.x, y:p.y, r:p.width*0.7, color:p.color, t:0.22, maxT:0.22});
      if (p.traveled >= p.range){ p.done = true; continue; }
      if (p.x < a.x-20 || p.x > a.x+a.w+20 || p.y < a.y-20 || p.y > a.y+a.h+20){ p.done = true; continue; }
      for (const e of this.entities){
        if (e.dead || e.faction === p.caster.faction || p.hit.has(e)) continue;
        if (Math.hypot(e.x-p.x, e.y-p.y) <= e.radius + p.width){
          Combat.dealOffense(p.caster, e, p.element, p.mult, p.effects, this, {dmgType:p.dmgType, consumesEstatica:p.consumesEstatica});
          p.hit.add(e);
          if (!p.pierce){ p.done = true; break; }
        }
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.done);
  }

  updateStrikes(dt){
    for (const s of this.strikes){
      s.delay -= dt;
      if (s.delay <= 0){
        this.spawnRing(s.x, s.y, s.r, ELEMENT_META[s.element].glow, 0.4);
        for (const e of this.entities){
          if (e.dead || e.faction === s.caster.faction) continue;
          if (Math.hypot(e.x-s.x, e.y-s.y) <= s.r + e.radius){
            Combat.dealOffense(s.caster, e, s.element, s.mult, s.effects, this, {dmgType:s.dmgType});
          }
        }
        s.done = true;
      }
    }
    this.strikes = this.strikes.filter(s => !s.done);
  }

  updateZones(dt){
    for (const z of this.zones){
      if (z.placement === 'follow'){ z.x = z.caster.x; z.y = z.caster.y; }
      z.t -= dt; z.acc += dt;
      while (z.acc >= z.interval){
        z.acc -= z.interval;
        if (z.perTick > 0){
          for (const e of this.entities){
            if (e.dead || e.faction === z.caster.faction) continue;
            if (Math.hypot(e.x-z.x, e.y-z.y) <= z.radius + e.radius){
              e.takeDamage(z.perTick, z.element, z.caster, this, {isDot:true, dmgType:'magico'});
              if (z.slow) e.applyStatus('slow', {amt:z.slow, dur:0.6}, this, z.caster);
            }
          }
        }
        if (z.healPerTick > 0 && !z.caster.dead) z.caster.heal(z.healPerTick, this);
        if (z.chakraPerTick > 0 && !z.caster.dead) z.caster.chakra = Math.min(z.caster.maxChakra, z.caster.chakra + z.chakraPerTick);
      }
    }
    this.zones = this.zones.filter(z => z.t > 0);
  }

  updateFX(dt){
    for (const r of this.rings) r.t -= dt;
    this.rings = this.rings.filter(r => r.t > 0);
    for (const p of this.particles) p.t -= dt;
    this.particles = this.particles.filter(p => p.t > 0);
    for (const t of this.texts){ t.t -= dt; t.y += t.vy*dt; }
    this.texts = this.texts.filter(t => t.t > 0);
  }

  // ---------------- render ----------------
  arc(x,y,r){ const c=this.ctx; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); }
  roundRect(x,y,w,h,r){ const c=this.ctx; c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
  drawBar(x,y,w,h,frac,color){ const c=this.ctx; c.fillStyle='rgba(0,0,0,0.5)'; c.fillRect(x,y,w,h); c.fillStyle=color; c.fillRect(x,y,w*clamp(frac,0,1),h); c.strokeStyle='rgba(255,255,255,0.12)'; c.lineWidth=1; c.strokeRect(x+0.5,y+0.5,w-1,h-1); }

  render(){
    const c = this.ctx, a = this.arena;
    c.clearRect(0,0,this.W,this.H);

    // suelo + rejilla
    c.fillStyle = '#0a0c14'; c.fillRect(a.x, a.y, a.w, a.h);
    c.strokeStyle = 'rgba(120,140,200,0.06)'; c.lineWidth = 1;
    for (let gx=a.x; gx<=a.x+a.w; gx+=40){ c.beginPath(); c.moveTo(gx,a.y); c.lineTo(gx,a.y+a.h); c.stroke(); }
    for (let gy=a.y; gy<=a.y+a.h; gy+=40){ c.beginPath(); c.moveTo(a.x,gy); c.lineTo(a.x+a.w,gy); c.stroke(); }

    // zonas
    for (const z of this.zones){
      const al = Math.min(0.22, (z.t/z.dur)*0.18 + 0.06);
      c.globalAlpha = al; c.fillStyle = ELEMENT_META[z.element].color; this.arc(z.x,z.y,z.radius); c.fill();
      c.globalAlpha = Math.min(0.55, al*2.4); c.strokeStyle = ELEMENT_META[z.element].glow; c.lineWidth = 2; this.arc(z.x,z.y,z.radius); c.stroke();
      c.globalAlpha = 1;
    }
    // telegrafía de golpes (nuke)
    for (const s of this.strikes){
      const f = 1 - s.delay/s.maxDelay;
      c.globalAlpha = 0.5; c.strokeStyle = ELEMENT_META[s.element].glow; c.lineWidth = 3; this.arc(s.x,s.y,s.r); c.stroke();
      c.globalAlpha = 0.18; c.fillStyle = ELEMENT_META[s.element].color; this.arc(s.x,s.y,s.r*f); c.fill();
      c.globalAlpha = 1;
    }
    // estelas de proyectiles
    for (const p of this.particles){ c.globalAlpha = (p.t/p.maxT)*0.8; c.fillStyle = p.color; this.arc(p.x,p.y,p.r); c.fill(); }
    c.globalAlpha = 1;
    // proyectiles
    for (const p of this.projectiles){ c.fillStyle = p.color; this.arc(p.x,p.y,Math.max(5,p.width)); c.fill(); c.strokeStyle='rgba(255,255,255,0.6)'; c.lineWidth=1.5; c.stroke(); }
    // anillos de impacto
    for (const r of this.rings){ const rr = r.r*(1 - 0.45*(r.t/r.maxT)); c.globalAlpha = r.t/r.maxT; c.strokeStyle = r.color; c.lineWidth = 3; this.arc(r.x,r.y,rr); c.stroke(); }
    c.globalAlpha = 1;

    // entidades
    this.drawEntity(this.enemy);
    this.drawEntity(this.player);

    // textos flotantes
    for (const t of this.texts){
      c.globalAlpha = clamp(t.t/0.95,0,1); c.fillStyle = t.color;
      c.font = 'bold ' + Math.round(13*t.scale) + 'px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(t.text, t.x, t.y);
    }
    c.globalAlpha = 1;

    this.drawTopBar();
    this.drawHUD();
  }

  drawEntity(e){
    const c = this.ctx;
    for (const a of e.afterimages){ c.globalAlpha = (a.t/0.3)*0.35; c.fillStyle = e.color; this.arc(a.x,a.y,e.radius); c.fill(); }
    c.globalAlpha = 1;

    if (e.dead){
      c.globalAlpha = 0.25; c.fillStyle = e.color; this.arc(e.x,e.y,e.radius); c.fill(); c.globalAlpha = 1;
      c.fillStyle = '#ffce54'; c.font = '11px sans-serif'; c.textAlign = 'center';
      c.fillText('reaparece ' + e.respawnTimer.toFixed(1) + 's', e.x, e.y - e.radius - 6);
      return;
    }
    // sombra
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(e.x, e.y+e.radius*0.85, e.radius*0.9, e.radius*0.4, 0, 0, Math.PI*2); c.fill();
    // escudo
    if (e.shield > 0){ c.strokeStyle = 'rgba(159,208,255,0.9)'; c.lineWidth = 3; this.arc(e.x,e.y,e.radius+5); c.stroke(); }
    // cuerpo
    c.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color;
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2; this.arc(e.x,e.y,e.radius); c.fill(); c.stroke();
    c.globalAlpha = 0.7; c.strokeStyle = ELEMENT_META[e.element].glow; c.lineWidth = 2; this.arc(e.x,e.y,e.radius-3); c.stroke(); c.globalAlpha = 1;
    // dirección
    c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 3; c.beginPath(); c.moveTo(e.x,e.y); c.lineTo(e.x+e.facing.x*e.radius, e.y+e.facing.y*e.radius); c.stroke();
    // emoji elemento
    c.font = '18px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ELEMENT_META[e.element].emoji, e.x, e.y);

    // barras
    const bw = 58, bx = e.x - bw/2, by = e.y - e.radius - 24;
    this.drawBar(bx, by, bw, 6, e.hp/e.maxHp, '#5ad469');
    if (e.maxChakra > 0) this.drawBar(bx, by+8, bw, 4, e.chakra/e.maxChakra, '#4aa3ff');
    // nombre
    c.font = '11px sans-serif'; c.fillStyle = '#dfe5ff'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillText(e.name + (e.faction==='enemy' ? '' : ''), e.x, by - 4);
    // iconos de estado
    const s = e.status, ic = [];
    if (s.burn) ic.push('🔥'); if (s.stun) ic.push('💫'); if (s.root) ic.push('🌿'); if (s.slow) ic.push('🐌');
    if (s.humedad) ic.push('💧'); if (s.buffDamage) ic.push('⬆'); if (s.defense) ic.push('🛡'); if (s.reflect) ic.push('✶');
    if (e.estatica) ic.push('⚡'+e.estatica);
    if (ic.length){ c.font = '12px serif'; c.fillStyle = '#fff'; c.textBaseline = 'top'; c.fillText(ic.join(' '), e.x, by + (e.maxChakra>0?12:8)); }
  }

  drawTopBar(){
    const c = this.ctx, p = this.player, e = this.enemy;
    c.fillStyle = '#0d1020'; c.fillRect(0,0,this.W,TOP_BAR);
    c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(0,TOP_BAR-1,this.W,1);
    // jugador
    const arch = p.archetype || {icon:'', name:p.def.role};
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.font = 'bold 16px sans-serif'; c.fillStyle = p.color;
    c.fillText(arch.icon + ' ' + p.name, 12, 16);
    c.font = '12px sans-serif'; c.fillStyle = '#aab2d4';
    c.fillText(arch.name + '  ·  ' + p.element, 12, 33);
    c.fillStyle = '#cdd5f5'; c.textAlign = 'center';
    c.fillText('Crítico ' + Math.round(p.critChance*100) + '%   ·   Vel. ataque x' + p.attackSpeed.toFixed(2) + '   ·   Armadura ' + Math.round(p.armor*100) + '%', this.W/2, 16);
    c.fillStyle = '#8a93b8';
    c.fillText('Cambia el elemento del rival con Q / E para ver ▲ ventaja  ▼ desventaja', this.W/2, 33);
    // rival
    c.textAlign = 'right'; c.font = 'bold 14px sans-serif'; c.fillStyle = ELEMENT_META[e.element].glow;
    c.fillText('Rival: ' + ELEMENT_META[e.element].emoji + ' ' + e.element, this.W-12, 16);
    c.font = '12px sans-serif'; c.fillStyle = '#8a93b8';
    c.fillText('[Q] ◀  cambiar  ▶ [E]', this.W-12, 33);
  }

  drawHUD(){
    const c = this.ctx, p = this.player;
    const y0 = this.H - HUD_BOTTOM;
    c.fillStyle = '#0d1020'; c.fillRect(0, y0, this.W, HUD_BOTTOM);
    c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(0, y0, this.W, 1);

    // vitales del jugador (izquierda)
    const vx = 16, vy = y0 + 16;
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.font = 'bold 13px sans-serif'; c.fillStyle = '#eef'; c.fillText(p.name, vx, vy);
    c.font = '11px sans-serif'; c.fillStyle = '#aab2d4'; c.fillText('Vida', vx, vy+22);
    this.drawBar(vx+44, vy+12, 170, 12, p.hp/p.maxHp, '#5ad469');
    c.fillStyle = '#dfe5ff'; c.fillText(Math.ceil(p.hp)+' / '+p.maxHp, vx+48, vy+22);
    c.fillStyle = '#aab2d4'; c.fillText('Chakra', vx, vy+44);
    this.drawBar(vx+44, vy+34, 170, 10, p.maxChakra? p.chakra/p.maxChakra : 0, '#4aa3ff');
    c.fillStyle = '#dfe5ff'; c.fillText(Math.floor(p.chakra)+' / '+p.maxChakra, vx+48, vy+43);

    // ranura de skills (centro)
    const n = 4, sw = 118, gap = 14, totalW = n*sw + (n-1)*gap;
    const sx = (this.W - totalW)/2, sy = y0 + 14, sh = HUD_BOTTOM - 28;
    for (let i=0;i<n;i++){ this.drawSkillSlot(p.skills[i], p, sx + i*(sw+gap), sy, sw, sh); }
  }

  drawSkillSlot(sk, p, x, y, w, h){
    const c = this.ctx;
    const cd = p.cooldowns[sk.key]||0, cdTot = p.cdTotal[sk.key]||sk.cooldown;
    const enough = p.chakra >= sk.cost, ready = cd<=0 && enough;
    this.roundRect(x,y,w,h,8); c.fillStyle = ready? 'rgba(38,46,78,0.96)':'rgba(22,26,42,0.96)'; c.fill();
    c.lineWidth = 2; c.strokeStyle = ready? ELEMENT_META[sk.element].glow : 'rgba(90,100,140,0.6)'; this.roundRect(x,y,w,h,8); c.stroke();
    // badge de tecla
    c.fillStyle = ELEMENT_META[sk.element].color; this.roundRect(x+7,y+7,22,22,5); c.fill();
    c.fillStyle = '#0c0e16'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(sk.key, x+18, y+19);
    // nombre (hasta 2 líneas)
    c.fillStyle = '#eef'; c.textAlign = 'left'; c.textBaseline = 'top';
    this.drawWrapped(sk.name, x+35, y+8, w-42, 13, 'bold 11px sans-serif', 2);
    // coste + tipo
    c.textBaseline = 'bottom';
    c.font = '11px sans-serif'; c.textAlign = 'left'; c.fillStyle = enough? '#7fd0ff' : '#ff7b7b';
    c.fillText(sk.cost>0? ('Chakra '+sk.cost) : 'Sin coste', x+10, y+h-8);
    c.textAlign = 'right'; c.fillStyle = sk.dmgType==='magico'? '#cdb4ff' : '#cdd5f5';
    c.fillText(sk.dmgType==='magico'? '✦ mág' : '⚔ fís', x+w-9, y+h-8);
    // overlay de recarga
    if (cd > 0){
      c.save(); this.roundRect(x,y,w,h,8); c.clip();
      c.fillStyle = 'rgba(0,0,0,0.62)'; c.fillRect(x, y, w, h*(cd/cdTot)); c.restore();
      c.fillStyle = '#fff'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(cd.toFixed(1), x+w/2, y+h/2);
    }
  }

  drawWrapped(text, x, y, maxW, lineH, font, maxLines){
    const c = this.ctx; c.font = font;
    const words = text.split(' '); let line = '', lines = [];
    for (const w of words){
      const test = line ? line+' '+w : w;
      if (c.measureText(test).width > maxW && line){ lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    if (lines.length > maxLines){ lines = lines.slice(0, maxLines); lines[maxLines-1] += '…'; }
    lines.forEach((ln,i)=> c.fillText(ln, x, y + i*lineH));
  }
}
