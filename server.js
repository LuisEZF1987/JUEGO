// ====================================================================
//  server.js — Servidor del juego: archivos estáticos + multijugador.
//  - Sirve la web (sin caché) en 127.0.0.1:8123.
//  - WebSocket (RFC6455, SIN dependencias): sincroniza posición/estado de
//    los jugadores para que se vean moverse por las Naciones en tiempo real.
//
//  Arráncalo con:   node server.js        (no requiere `npm install`)
//  Luego abre:      http://localhost:8123  (cada navegador = un jugador)
// ====================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT || '8123', 10);

// ---- guardado por cuenta (progreso persistido por nombre) ----
const SAVE_FILE = path.join(ROOT, 'saves.json');
let saves = {}; try { saves = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8')) || {}; } catch (e) { saves = {}; }
let saveTimer = null;
// escritura ATÓMICA: a un temporal y luego rename (atómico en POSIX) → un crash a media
// escritura nunca corrompe saves.json (el archivo viejo queda intacto hasta el rename).
function persistSaves(){ if (saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null;
  const tmp = SAVE_FILE + '.tmp';
  fs.writeFile(tmp, JSON.stringify(saves), err => { if (err) return; fs.rename(tmp, SAVE_FILE, () => {}); });
}, 1500); }
// escritura SÍNCRONA atómica (para mutaciones de mercado: persistir YA, sin debounce)
function writeJsonAtomicSync(file, obj){ const tmp = file + '.tmp'; try { fs.writeFileSync(tmp, JSON.stringify(obj)); fs.renameSync(tmp, file); } catch(e){ console.warn('[write] falló', file, e.message); } }
function persistSavesNow(){ if (saveTimer){ clearTimeout(saveTimer); saveTimer = null; } writeJsonAtomicSync(SAVE_FILE, saves); }

// ---- identidad mínima por personaje (TOFU: secret-por-nombre; guardamos el hash) ----
const AUTH_FILE = path.join(ROOT, 'auth.json');
let auth = {}; try { auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')) || {}; } catch(e){ auth = {}; }
function hashSecret(s){ return crypto.createHash('sha256').update('el:' + s).digest('hex'); }
function authClaim(nameLower, secret){            // true si el secret coincide o es la 1ª vez (TOFU)
  if (!secret) return !auth[nameLower];           // sin secret: solo si el nombre no está reclamado
  const sh = hashSecret(secret);
  if (!auth[nameLower]){ auth[nameLower] = { sh, createdAt: Date.now() }; writeJsonAtomicSync(AUTH_FILE, auth); return true; }
  return auth[nameLower].sh === sh;
}

// ---- mercado / casa de subastas (materiales) — ver market.json ----
const MARKET_FILE = path.join(ROOT, 'market.json');
let market = { nextId:0, listings:{}, receipts:{} };
try { const mm = JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8')); if (mm && mm.listings) market = mm; } catch(e){}
function persistMarket(){ writeJsonAtomicSync(MARKET_FILE, market); }
const MAT_WHITELIST = new Set(['Lingote de Hierro','Madera de Roble','Polvo de Refinamiento','Cristal de Refinamiento','Cristal Divino','Adamantita Estelar','Brasa Eterna','Pluma de Tempestad','Fragmento de Trueno','Corazón Pétreo','Lágrima Abisal','Savia Eterna']);
const MAX_LISTINGS = 12;   // tope de listados activos por cuenta (anti-spam)
function intc(v, lo, hi){ v = Math.floor(+v || 0); return Math.max(lo, Math.min(hi, v)); }
function matCount(sv, name){ return (sv && sv.mats && sv.mats[name]) || 0; }
function activeListingsOf(name){ let n = 0; for (const id in market.listings){ const L = market.listings[id]; if (L.seller === name && L.status === 'active') n++; } return n; }

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.png':  'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml', '.ico': 'image/x-icon', '.wasm': 'application/wasm',
  '.glb':  'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.txt':  'text/plain; charset=utf-8',
};

// ---------------- archivos estáticos ----------------
const httpServer = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404 Not Found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, max-age=0',
    });
    res.end(data);
  });
});

// ---------------- WebSocket (RFC6455, sin dependencias) ----------------
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
let nextId = 1;
const clients = new Map();   // id -> client

function frame(obj, opcode){
  const payload = (opcode === 0x9 || opcode === 0xA) ? Buffer.alloc(0) : Buffer.from(JSON.stringify(obj));
  const len = payload.length, b0 = 0x80 | (opcode || 0x1);
  let header;
  if (len < 126) header = Buffer.from([b0, len]);
  else if (len < 65536) header = Buffer.from([b0, 126, (len>>8)&255, len&255]);
  else { header = Buffer.alloc(10); header[0]=b0; header[1]=127; header.writeUInt32BE(0,2); header.writeUInt32BE(len,6); }
  return Buffer.concat([header, payload]);
}
function send(c, obj){ try { c.socket.write(frame(obj, 0x1)); } catch(e){} }
function broadcast(obj, exceptId){ for (const c of clients.values()){ if (c.id !== exceptId) send(c, obj); } }
function pub(c){ return { id:c.id, name:c.name, hero:c.hero, clan:c.clan||'', x:c.x, y:c.y, z:c.z, ry:c.ry, nation:c.nation, anim:c.anim, pvp:c.pvp||false, hp:c.hp||100, mhp:c.mhp||100 }; }

// ---- grupos (party) ----
let nextParty = 1;
const parties = new Map();   // pid -> Set<clientId>
function partyList(pid){ const set = parties.get(pid); if (!set) return []; const out = []; for (const id of set){ const cc = clients.get(id); if (cc) out.push({ id:cc.id, name:cc.name }); } return out; }
function toParty(pid, obj){ const set = parties.get(pid); if (!set) return; for (const id of set){ const cc = clients.get(id); if (cc) send(cc, obj); } }
function leaveParty(c){
  const pid = c.party; if (!pid) return; c.party = null;
  const set = parties.get(pid); if (!set) return; set.delete(c.id);
  if (set.size < 2){ for (const id of set){ const cc = clients.get(id); if (cc){ cc.party = null; send(cc, { t:'party', a:'members', list:[] }); } } parties.delete(pid); }
  else toParty(pid, { t:'party', a:'members', list:partyList(pid) });
}

// ---- Jefes (Dioses Encadenados): HP autoritativo y compartido por todos ----
const BOSS_DEF = [
  { el:'Fuego',  name:'Pyrothar Encadenado' },  { el:'Viento', name:'Sylvaris Encadenado' },
  { el:'Rayo',   name:'Vortigan Encadenado' },  { el:'Tierra', name:'Terrgoth Encadenado' },
  { el:'Agua',   name:'Nereon Encadenado' },    { el:'Madera', name:'Aethelgard Encadenado' },
];
const BOSS_HP = 900, BOSS_RESPAWN = 60000;
const bosses = {};
for (const b of BOSS_DEF) bosses[b.el] = { el:b.el, name:b.name, maxHp:BOSS_HP, hp:BOSS_HP, dead:false, respawnAt:0 };
function bossSnapshot(){ return Object.keys(bosses).map(el => ({ el, name:bosses[el].name, hp:bosses[el].hp, maxHp:bosses[el].maxHp, dead:bosses[el].dead })); }

httpServer.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');

  const id = nextId++;
  const c = { socket, id, name:'Héroe', hero:'kael', x:0, y:0, z:0, ry:0, nation:'centro', anim:'idle', alive:true, party:null, pvp:false, hp:100, mhp:100 };
  clients.set(id, c);
  let buf = Buffer.alloc(0), closed = false;

  function closeClient(){ if (closed) return; closed = true; leaveParty(c); clients.delete(id); broadcast({ t:'left', id }, id); try { socket.destroy(); } catch(e){} console.log('[-] jugador ' + id + ' salió — total ' + clients.size); }

  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2){
      const masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126){ if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127){ if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const need = off + (masked ? 4 : 0) + len;
      if (buf.length < need) break;
      const opcode = buf[0] & 0x0f;
      let payload;
      if (masked){ const mask = buf.slice(off, off+4); payload = Buffer.alloc(len); for (let i=0;i<len;i++) payload[i] = buf[off+4+i] ^ mask[i&3]; }
      else payload = buf.slice(off, off+len);
      buf = buf.slice(need);
      if (opcode === 0x8){ closeClient(); return; }                          // close
      else if (opcode === 0x9){ try { socket.write(frame(null, 0xA)); } catch(e){} }   // ping -> pong
      else if (opcode === 0xA){ c.alive = true; }                            // pong
      else if (opcode === 0x1) handleMsg(c, payload.toString('utf8'));
    }
  });
  socket.on('close', closeClient);
  socket.on('error', closeClient);
});

function handleMsg(c, data){
  let m; try { m = JSON.parse(data); } catch(e){ return; }
  if (m.t === 'join'){
    c.name = ('' + (m.name || 'Héroe')).slice(0, 16);
    c.hero = m.hero || 'kael';
    c.clan = ('' + (m.clan || '')).slice(0, 8);
    c.authed = authClaim(c.name.toLowerCase(), m.secret);   // identidad TOFU (secret-por-personaje)
    if (!c.authed){ send(c, { t:'authfail', reason:'name_taken' }); }   // nombre reclamado por otro secret
    else {
      if (saves[c.name]) send(c, { t:'save', save:saves[c.name] });   // restaura el progreso de la cuenta
      const rc = market.receipts[c.name];   // ventas ocurridas mientras estaba OFFLINE
      if (rc && rc.length){ send(c, { t:'market:receipts', sales: rc }); market.receipts[c.name] = []; persistMarket(); }
    }
    const others = []; for (const o of clients.values()){ if (o.id !== c.id) others.push(pub(o)); }
    send(c, { t:'welcome', id:c.id, players:others });
    send(c, { t:'bosses', list:bossSnapshot() });   // estado actual de los Jefes compartidos
    broadcast({ t:'joined', player:pub(c) }, c.id);
    console.log('[+] jugador ' + c.id + ' (' + c.name + '/' + c.hero + ') — total ' + clients.size);
  } else if (m.t === 'save'){
    if (c.authed && c.name && m.save && typeof m.save === 'object'){ saves[c.name] = m.save; if (m.save.clan != null) c.clan = ('' + m.save.clan).slice(0, 8); persistSaves(); }
  } else if (m.t === 'state'){
    c.x = m.x; c.y = m.y; c.z = m.z; c.ry = m.ry; c.nation = m.nation; c.anim = m.anim;
    if (m.pvp != null) c.pvp = !!m.pvp; if (m.hp != null) c.hp = m.hp; if (m.mhp != null) c.mhp = m.mhp;
    broadcast({ t:'state', id:c.id, x:m.x, y:m.y, z:m.z, ry:m.ry, anim:m.anim, pvp:c.pvp, hp:c.hp, mhp:c.mhp }, c.id);
  } else if (m.t === 'chat'){
    broadcast({ t:'chat', id:c.id, name:c.name, clan:c.clan||'', text:('' + (m.text || '')).slice(0, 120) });
  } else if (m.t === 'party'){
    if (m.a === 'invite'){ const t = clients.get(m.to); if (t) send(t, { t:'party', a:'invite', from:c.id, name:c.name }); }
    else if (m.a === 'accept'){
      const inv = clients.get(m.to); if (!inv) return;
      let pid = inv.party; if (!pid){ pid = nextParty++; parties.set(pid, new Set([inv.id])); inv.party = pid; }
      parties.get(pid).add(c.id); c.party = pid;
      toParty(pid, { t:'party', a:'members', list:partyList(pid) });
    }
    else if (m.a === 'leave'){ leaveParty(c); }
    else if (m.a === 'xp'){ const set = c.party && parties.get(c.party); if (set) for (const id of set){ if (id !== c.id){ const cc = clients.get(id); if (cc) send(cc, { t:'party', a:'xp', amount:m.amount }); } } }
  } else if (m.t === 'clan'){
    c.clan = ('' + (m.clan || '')).slice(0, 8);
    broadcast({ t:'clan', id:c.id, clan:c.clan }, c.id);   // anuncia el clan sin reconectar (evita el spam de "entró")
  } else if (m.t === 'pvphit'){
    const t = clients.get(m.to);
    if (t && c.pvp && t.pvp && t.id !== c.id){   // PvP solo si AMBOS lo tienen activado
      const dmg = Math.max(0, Math.min(9999, (+m.dmg) || 0));
      send(t, { t:'pvphit', from:c.id, name:c.name, dmg:dmg });
    }
  } else if (m.t === 'bosshit'){
    const b = bosses[m.el]; if (!b || b.dead) return;
    const dmg = Math.max(0, Math.min(100000, (+m.dmg) || 0));
    b.hp = Math.max(0, b.hp - dmg);
    if (b.hp <= 0){
      b.dead = true; b.respawnAt = Date.now() + BOSS_RESPAWN;
      broadcast({ t:'boss', el:b.el, hp:0, maxHp:b.maxHp, dead:true });
      broadcast({ t:'bossdead', el:b.el, by:c.name });
      console.log('[☠] ' + c.name + ' selló a ' + b.name);
    } else {
      broadcast({ t:'boss', el:b.el, hp:b.hp, maxHp:b.maxHp, dead:false });
    }

  // ---- MERCADO (materiales) — handlers SÍNCRONOS (sección crítica natural single-thread) ----
  } else if (m.t === 'market:list'){
    const f = m.filter || {}; const out = [];
    for (const id in market.listings){ const L = market.listings[id]; if (L.status !== 'active') continue;
      if (f.name && L.item.name !== f.name) continue;
      if (f.maxPrice && L.price > (+f.maxPrice)) continue;
      out.push({ id:L.id, seller:L.seller, item:L.item, qty:L.qty, qty0:L.qty0, price:L.price, ts:L.ts });
      if (out.length >= 200) break;
    }
    out.sort((a,b) => (a.price/Math.max(1,a.qty0)) - (b.price/Math.max(1,b.qty0)));
    send(c, { t:'market:catalog', listings: out });

  } else if (m.t === 'market:create'){
    if (!c.authed) return send(c, { t:'market:err', code:'auth', msg:'Identidad no verificada' });
    const name = '' + (m.name || ''), qty = intc(m.qty, 1, 9999), price = intc(m.price, 1, 1e9);
    const sv = saves[c.name];
    if (!MAT_WHITELIST.has(name)) return send(c, { t:'market:err', code:'bad_args', msg:'Material inválido' });
    if (matCount(sv, name) < qty) return send(c, { t:'market:err', code:'no_stock', msg:'No tienes esa cantidad' });
    if (activeListingsOf(c.name) >= MAX_LISTINGS) return send(c, { t:'market:err', code:'too_many', msg:'Demasiados listados activos (máx ' + MAX_LISTINGS + ')' });
    sv.mats[name] -= qty; if (sv.mats[name] <= 0) delete sv.mats[name];   // ESCROW: el stock sale del inventario
    sv.ts = Date.now();
    const id = 'L' + (++market.nextId);
    market.listings[id] = { id, seller:c.name, item:{ kind:'mat', name }, qty, qty0:qty, price, ts:Date.now(), status:'active' };
    persistSavesNow(); persistMarket();
    send(c, { t:'save', save:sv });
    send(c, { t:'market:created', listing: market.listings[id], mats: sv.mats });

  } else if (m.t === 'market:buy'){
    if (!c.authed) return send(c, { t:'market:err', code:'auth' });
    const L = market.listings['' + (m.id || '')], qty = intc(m.qty, 1, 9999);
    if (!L || L.status !== 'active') return send(c, { t:'market:err', code:'gone', msg:'Listado no disponible' });
    if (qty > L.qty) return send(c, { t:'market:err', code:'no_stock', msg:'Cantidad no disponible' });
    if (L.seller === c.name) return send(c, { t:'market:err', code:'own', msg:'Es tu propio listado' });
    const buyer = saves[c.name]; if (!buyer) return send(c, { t:'market:err', code:'no_acc' });
    const cost = L.price * qty;
    if ((buyer.gold || 0) < cost) return send(c, { t:'market:err', code:'no_gold', msg:'Oro insuficiente' });
    // sección crítica síncrona: validar → mutar → persistir (sin await/callback en medio)
    buyer.gold -= cost; buyer.mats = buyer.mats || {}; buyer.mats[L.item.name] = (buyer.mats[L.item.name] || 0) + qty; buyer.ts = Date.now();
    L.qty -= qty; if (L.qty <= 0) L.status = 'sold';
    const seller = saves[L.seller];
    if (seller){ seller.gold = (seller.gold || 0) + cost; seller.ts = Date.now(); }   // crédito al vendedor (aunque esté OFFLINE)
    (market.receipts[L.seller] = market.receipts[L.seller] || []).push({ listingId:L.id, item:L.item.name, qty, unit:L.price, total:cost, buyer:c.name, ts:Date.now() });
    persistSavesNow(); persistMarket();
    send(c, { t:'save', save:buyer });
    send(c, { t:'market:bought', id:L.id, name:L.item.name, qty, total:cost, gold:buyer.gold, mats:buyer.mats });
    for (const o of clients.values()){ if (o.name === L.seller && seller){ send(o, { t:'market:sold', id:L.id, name:L.item.name, qty, total:cost, buyer:c.name, gold:seller.gold }); send(o, { t:'save', save:seller }); break; } }

  } else if (m.t === 'market:cancel'){
    if (!c.authed) return;
    const L = market.listings['' + (m.id || '')];
    if (!L || L.seller !== c.name || L.status !== 'active') return send(c, { t:'market:err', code:'not_owner', msg:'No es tu listado' });
    const sv = saves[c.name];
    if (sv){ sv.mats = sv.mats || {}; sv.mats[L.item.name] = (sv.mats[L.item.name] || 0) + L.qty; sv.ts = Date.now(); }   // devuelve el escrow
    L.status = 'cancelled';
    persistSavesNow(); persistMarket();
    if (sv){ send(c, { t:'save', save:sv }); send(c, { t:'market:cancelled', id:L.id, mats: sv.mats }); }
  }
}

// ping de mantenimiento: descarta conexiones muertas
const heartbeat = setInterval(() => {
  for (const c of clients.values()){
    if (c.alive === false){ try { c.socket.destroy(); } catch(e){} continue; }
    c.alive = false; try { c.socket.write(frame(null, 0x9)); } catch(e){}
  }
}, 30000);
httpServer.on('close', () => clearInterval(heartbeat));

// reaparición de Jefes
const bossTick = setInterval(() => {
  const now = Date.now();
  for (const el in bosses){ const b = bosses[el]; if (b.dead && now >= b.respawnAt){ b.dead = false; b.hp = b.maxHp; broadcast({ t:'boss', el, hp:b.maxHp, maxHp:b.maxHp, dead:false }); console.log('[↻] ' + b.name + ' reapareció'); } }
}, 3000);
httpServer.on('close', () => clearInterval(bossTick));

httpServer.on('error', (e) => {
  if (e && e.code === 'EADDRINUSE'){
    console.error('\n⚠  El puerto ' + PORT + ' ya está en uso (¿tienes otro "node server.js" abierto?).');
    console.error('   Cierra el otro, o arranca en otro puerto:   PORT=8124 node server.js\n');
  } else {
    console.error('Error del servidor:', e);
  }
  process.exit(1);
});

httpServer.listen(PORT, HOST, () => {
  console.log('Elemental Legacy sirviendo en http://' + HOST + ':' + PORT + ' (web + multijugador WS, sin dependencias)');
});
