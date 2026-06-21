// ====================================================================
//  entity.js — Entidad de combate (héroe o centinela).
//  Maneja stats, estados (quemadura, aturdir, raíz, escudo, etc.),
//  daño con ventaja elemental + crítico + armadura (física/mágica) y curación.
// ====================================================================

const CHAKRA_REGEN = 12; // Chakra por segundo

class Entity {
  constructor(def, x, y, faction){
    this.def = def;
    this.name = def.name;
    this.faction = faction;          // 'player' | 'enemy'
    this.element = def.element;
    this.archetype = def.archetype || null;
    this.color = ELEMENT_META[def.element].color;

    this.x = x; this.y = y;
    this.radius = def.radius || 23;

    const s = def.stats;
    this.maxHp = s.maxHp;            this.hp = s.maxHp;
    this.maxChakra = s.maxChakra;    this.chakra = s.maxChakra;
    this.power = s.power;
    this.armor = s.armor || 0;
    this.critChance = s.critChance || 0;
    this.critMult = s.critMult || 1.5;
    this.attackSpeed = s.attackSpeed || 1.0;
    this.baseSpeed = s.moveSpeed;
    this.healPower = s.healPower || 1.0;

    this.passiveId = def.passive ? def.passive.id : null;
    this.skills = def.skills || [];

    this.cooldowns = {};   // key -> restante (s)
    this.cdTotal = {};     // key -> duración total usada (s)
    this.status = {};      // efectos activos
    this.shield = 0; this.shieldT = 0;
    this.estatica = 0;
    this.nextHitBonus = 0;
    this.facing = {x:1, y:0};
    this.pushX = 0; this.pushY = 0;
    this.afterimages = [];
    this.dead = false; this.respawnTimer = 0;
    this.basicCd = 0;      // IA del centinela
    this.hitFlash = 0;     // feedback visual al recibir daño
  }

  get speed(){
    let s = this.baseSpeed;
    if (this.status.slow) s *= (1 - this.status.slow.amt);
    return s;
  }
  canAct(){ return !this.status.stun; }
  canMove(){ return !this.status.stun && !this.status.root; }

  // ---------------- ciclo ----------------
  update(dt, game){
    if (this.dead){ this.respawnTimer -= dt; if (this.respawnTimer <= 0) this.respawn(game); return; }

    for (const k in this.cooldowns) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    if (this.basicCd > 0) this.basicCd -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    if (this.maxChakra > 0) this.chakra = Math.min(this.maxChakra, this.chakra + CHAKRA_REGEN * dt);

    this.tickStatus(dt, game);

    if (this.shieldT > 0){ this.shieldT -= dt; if (this.shieldT <= 0) this.shield = 0; }

    // empuje (knockback) con amortiguación
    this.x += this.pushX * dt; this.y += this.pushY * dt;
    const damp = Math.min(1, 9 * dt);
    this.pushX -= this.pushX * damp; this.pushY -= this.pushY * damp;

    this.clampToArena(game);

    for (const a of this.afterimages) a.t -= dt;
    this.afterimages = this.afterimages.filter(a => a.t > 0);
  }

  tickStatus(dt, game){
    const s = this.status;
    if (s.burn){
      s.burn.t -= dt; s.burn.acc = (s.burn.acc || 0) + dt;
      while (s.burn.acc >= 0.5){ s.burn.acc -= 0.5; this.takeDamage(s.burn.dps * 0.5, 'Fuego', s.burn.src, game, {isDot:true, dmgType:'magico'}); if (this.dead) break; }
      if (s.burn && s.burn.t <= 0) delete s.burn;
    }
    ['stun','root','slow','humedad','buffDamage','defense','reflect'].forEach(k=>{
      if (s[k]){ s[k].t -= dt; if (s[k].t <= 0) delete s[k]; }
    });
    if (s.estatica){ s.estatica.t -= dt; if (s.estatica.t <= 0){ delete s.estatica; this.estatica = 0; } }
  }

  // ---------------- estados ----------------
  applyStatus(kind, p, game, src){
    const s = this.status;
    switch(kind){
      case 'burn':    s.burn = {dps:p.dps, t:p.dur, acc:0, src}; break;
      case 'stun':    s.stun = {t: Math.max(s.stun?s.stun.t:0, p.dur)}; break;
      case 'root':    s.root = {t: Math.max(s.root?s.root.t:0, p.dur)}; break;
      case 'slow':    s.slow = {amt:p.amt, t:p.dur}; break;
      case 'humedad': s.humedad = {amt:p.amt, t:p.dur}; break;
      case 'estatica':{
        const cur = s.estatica || {stacks:0, t:0};
        cur.stacks = Math.min(3, cur.stacks + 1); cur.t = 5;
        s.estatica = cur; this.estatica = cur.stacks; break;
      }
      case 'knockback':{
        if (this.passiveId === 'piel_roca' || !src) break; // inmune a empujes
        const dx = this.x - src.x, dy = this.y - src.y, d = Math.hypot(dx,dy) || 1;
        this.pushX += dx/d * p.force; this.pushY += dy/d * p.force; break;
      }
    }
  }

  // ---------------- daño ----------------
  // opts: { isDot, isReflected, isCrit, dmgType }
  takeDamage(amount, element, src, game, opts){
    opts = opts || {};
    if (this.dead) return;

    const mult = elementAdvantage(element, this.element);
    let dmg = amount * mult;

    if (this.status.humedad) dmg *= (1 + this.status.humedad.amt);
    if (this.status.defense) dmg *= (1 - this.status.defense.amt);

    // la magia penetra la mitad de la armadura
    const armorFactor = (opts.dmgType === 'magico') ? this.armor * 0.5 : this.armor;
    dmg *= (1 - armorFactor);
    dmg = Math.max(1, dmg);

    // escudo absorbe primero
    if (this.shield > 0){
      const ab = Math.min(this.shield, dmg); this.shield -= ab; dmg -= ab;
      if (ab >= 1) game.floatText(this.x - 16, this.y - 30, '🛡'+Math.round(ab), '#9fd0ff', 0.8);
      if (this.shield <= 0) this.shieldT = 0;
    }

    if (dmg > 0.5){
      this.hp -= dmg; this.hitFlash = 0.12;
      let col = mult > 1 ? '#7CFF6B' : (mult < 1 ? '#FF7B7B' : '#FFFFFF');
      let txt = Math.round(dmg) + (mult > 1 ? ' ▲' : (mult < 1 ? ' ▼' : ''));
      let scale = opts.isDot ? 0.72 : 1.05;
      if (opts.isCrit){ col = '#ffd23c'; txt = Math.round(dmg) + ' ¡CRÍT!'; scale = 1.5; }
      game.floatText(this.x + (Math.random()*26 - 13), this.y - 38, txt, col, scale);
    }

    // reflejo (solo daño directo)
    if (!opts.isReflected && !opts.isDot && this.status.reflect && src && src !== this){
      src.takeDamage(dmg * this.status.reflect.amt, this.element, this, game, {isReflected:true, dmgType:'magico'});
    }
    // pasivas que ganan Chakra al recibir daño
    if (!opts.isDot && (this.passiveId === 'piel_roca' || this.passiveId === 'furia_sangre')){
      this.chakra = Math.min(this.maxChakra, this.chakra + 6);
    }
    if (this.hp <= 0) this.die(game);
  }

  heal(amount, game){
    if (this.dead) return;
    amount *= this.healPower;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const gained = this.hp - before;
    if (this.passiveId === 'savia_sello'){
      this.shield += amount * 0.30; this.shieldT = Math.max(this.shieldT, 5);
    }
    const show = gained > 0.5 ? gained : (this.passiveId === 'savia_sello' ? amount * 0.30 : 0);
    if (show > 0.5) game.floatText(this.x + (Math.random()*20 - 10), this.y - 46, '+'+Math.round(show), '#7CFF6B', 1.0);
  }

  die(game){
    this.dead = true; this.hp = 0;
    this.status = {}; this.shield = 0; this.pushX = this.pushY = 0;
    game.floatText(this.x, this.y - 44, this.faction === 'player' ? '¡Derrotado!' : '¡Sellado!', '#ffce54', 1.3);
    this.respawnTimer = this.faction === 'player' ? 2.5 : 1.4;
  }
  respawn(game){
    this.dead = false; this.hp = this.maxHp; this.chakra = this.maxChakra;
    this.status = {}; this.shield = 0; this.estatica = 0; this.pushX = this.pushY = 0;
    const a = game.arena;
    if (this.faction === 'player'){ this.x = a.cx; this.y = a.cy + 130; }
    else { this.x = a.cx; this.y = a.cy - 130; }
  }

  // ---------------- util ----------------
  spawnAfterimage(){ this.afterimages.push({x:this.x, y:this.y, t:0.3}); }
  clampToArena(game){
    const a = game.arena, r = this.radius;
    this.x = Math.max(a.x + r, Math.min(a.x + a.w - r, this.x));
    this.y = Math.max(a.y + r, Math.min(a.y + a.h - r, this.y));
  }
}
