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
    if (saves[c.name]) send(c, { t:'save', save:saves[c.name] });   // restaura el progreso de la cuenta
    const others = []; for (const o of clients.values()){ if (o.id !== c.id) others.push(pub(o)); }
    send(c, { t:'welcome', id:c.id, players:others });
    send(c, { t:'bosses', list:bossSnapshot() });   // estado actual de los Jefes compartidos
    broadcast({ t:'joined', player:pub(c) }, c.id);
    console.log('[+] jugador ' + c.id + ' (' + c.name + '/' + c.hero + ') — total ' + clients.size);
  } else if (m.t === 'save'){
    if (c.name && m.save && typeof m.save === 'object'){ saves[c.name] = m.save; if (m.save.clan != null) c.clan = ('' + m.save.clan).slice(0, 8); persistSaves(); }
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
