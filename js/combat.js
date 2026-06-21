// ====================================================================
//  combat.js — Ejecuta las skills: ataques, dashes, buffs/curas y zonas.
//  Resuelve daño con buffs del lanzador, crítico y tipo (físico/mágico).
// ====================================================================

const Combat = {
  execute(skill, caster, game){
    caster._ox = caster.x; caster._oy = caster.y;       // origen antes del dash
    const aim = game.getAimDir(caster);
    caster.facing = aim;
    if (skill.dash)    this.doDash(skill.dash, caster, game, aim);
    if (skill.offense) this.doOffense(skill, caster, game, game.getAimDir(caster));
    if (skill.self)    this.applySelf(skill.self, caster, game);
    if (skill.zone)    this.spawnZone(skill.zone, caster, game, aim);
  },

  // ---------- desplazamientos ----------
  doDash(dash, caster, game, aim){
    let tx, ty;
    if (dash.mode === 'behind'){
      const tgt = game.nearestEnemy(caster);
      if (tgt){
        const dx = tgt.x - caster.x, dy = tgt.y - caster.y, d = Math.hypot(dx,dy) || 1;
        tx = tgt.x + (dx/d) * (tgt.radius + 34);
        ty = tgt.y + (dy/d) * (tgt.radius + 34);
      } else { tx = caster.x + aim.x*dash.distance; ty = caster.y + aim.y*dash.distance; }
    } else { // forward / blink
      tx = caster.x + aim.x*dash.distance; ty = caster.y + aim.y*dash.distance;
    }
    caster.spawnAfterimage();
    caster.x = tx; caster.y = ty; caster.clampToArena(game);
    game.spawnRing(caster.x, caster.y, caster.radius*1.7, '#ffffff', 0.28);
  },

  // ---------- ataques ----------
  doOffense(skill, caster, game, aim){
    const o = skill.offense;
    const bonus = caster.nextHitBonus || 0; caster.nextHitBonus = 0;
    const mult = o.mult * (1 + bonus);
    const dmgType = skill.dmgType || 'fisico';

    if (o.shape === 'projectile' || o.shape === 'line'){
      const speed = o.speed || 540;
      game.projectiles.push({
        x: caster.x + aim.x*caster.radius, y: caster.y + aim.y*caster.radius,
        vx: aim.x*speed, vy: aim.y*speed, speed, range: o.range || 500, traveled: 0,
        element: skill.element, dmgType, mult, effects: o.effects || [], caster,
        pierce: !!o.pierce, width: o.width || 9, consumesEstatica: !!o.consumesEstatica,
        color: ELEMENT_META[skill.element].color, hit: new Set()
      });
      return;
    }
    if (o.shape === 'nuke'){
      const p = game.clampPoint(game.mouse.x, game.mouse.y);
      game.strikes.push({ x:p.x, y:p.y, r:o.radius, element:skill.element, dmgType, mult,
        effects:o.effects || [], caster, delay:o.delay || 0.6, maxDelay:o.delay || 0.6 });
      return;
    }

    // formas de área instantáneas: melee / circle / cone
    let cx = caster.x, cy = caster.y, r = o.radius || o.range || 80;
    if (o.shape === 'melee'){ cx = caster.x + aim.x*(o.range*0.45); cy = caster.y + aim.y*(o.range*0.45); r = o.range*0.62; }
    else if (o.shape === 'cone'){ cx = caster.x + aim.x*(o.radius*0.5); cy = caster.y + aim.y*(o.radius*0.5); r = o.radius*0.72; }

    game.spawnRing(cx, cy, r, ELEMENT_META[skill.element].glow, 0.32);
    for (const e of game.entities){
      if (e.dead || e.faction === caster.faction) continue;
      if (Math.hypot(e.x - cx, e.y - cy) <= r + e.radius){
        this.dealOffense(caster, e, skill.element, mult, o.effects || [], game, {dmgType, consumesEstatica:!!o.consumesEstatica});
      }
    }
  },

  // ---------- cálculo de daño (crítico incluido) ----------
  dealOffense(caster, target, element, mult, effects, game, opts){
    opts = opts || {};
    let dmg = caster.power * mult;
    if (caster.status.buffDamage) dmg *= (1 + caster.status.buffDamage.amt);
    if (caster.passiveId === 'furia_sangre'){
      const r = caster.hp / caster.maxHp;
      if (r < 0.15) dmg *= 1.30; else if (r < 0.30) dmg *= 1.15;
    }
    if (opts.consumesEstatica && target.status.estatica){
      dmg *= (1 + 0.20 * target.status.estatica.stacks);
      delete target.status.estatica; target.estatica = 0;
    }
    let isCrit = false;
    if (Math.random() < (caster.critChance || 0)){ isCrit = true; dmg *= (caster.critMult || 1.5); }

    target.takeDamage(dmg, element, caster, game, {isCrit, dmgType: opts.dmgType || 'fisico'});
    for (const ef of effects) target.applyStatus(ef.kind, ef, game, caster);
  },

  // ---------- efectos sobre uno mismo ----------
  applySelf(list, caster, game){
    for (const s of list){
      switch(s.kind){
        case 'buffDamage': caster.status.buffDamage = {amt:s.amt, t:s.dur}; game.floatText(caster.x, caster.y-52, '⬆ FURIA', '#ff9a3c', 1.1); break;
        case 'shield':     caster.shield += s.amount; caster.shieldT = Math.max(caster.shieldT, s.dur || 6); game.floatText(caster.x, caster.y-52, '🛡 ESCUDO', '#9fd0ff', 1.0); break;
        case 'defense':    caster.status.defense = {amt:s.amt, t:s.dur}; game.floatText(caster.x, caster.y-52, '🛡 DEFENSA', '#cdd5f5', 1.0); break;
        case 'reflect':    caster.status.reflect = {amt:s.amt, t:s.dur}; game.floatText(caster.x, caster.y-66, '✶ REFLEJO', '#cdb4ff', 1.0); break;
        case 'heal':       caster.heal(s.amount, game); break;
        case 'cleanse':    for (const k of s.kinds) delete caster.status[k]; game.floatText(caster.x, caster.y-52, 'LIMPIO', '#7fd0ff', 1.0); break;
        case 'dodgeBuff':  caster.nextHitBonus = 0.25; break;
      }
    }
  },

  // ---------- zonas persistentes ----------
  spawnZone(z, caster, game, aim){
    let x = caster.x, y = caster.y;
    if (z.placement === 'mouse'){ const p = game.clampPoint(game.mouse.x, game.mouse.y); x = p.x; y = p.y; }
    else if (z.placement === 'origin'){ x = caster._ox; y = caster._oy; }
    game.zones.push({
      x, y, radius:z.radius, element:z.element, kind:z.kind, placement:z.placement,
      perTick:z.perTick || 0, interval:z.interval || 0.5, acc:0, t:z.dur, dur:z.dur, caster,
      healPerTick:z.healPerTick || 0, chakraPerTick:z.chakraPerTick || 0, slow:z.slow || 0
    });
  },
};
