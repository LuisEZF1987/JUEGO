// ====================================================================
//  server.js — Servidor del juego: archivos estáticos + multijugador.
//  - Sirve la web (sin caché) en 127.0.0.1:8123.
//  - WebSocket: sincroniza la posición/estado de los jugadores conectados
//    para que se vean moverse por las Naciones en tiempo real.
// ====================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const ROOT = __dirname;
const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT || '8123', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.png':  'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml', '.ico': 'image/x-icon', '.wasm': 'application/wasm',
  '.glb':  'model/gltf-binary', '.gltf': 'model/gltf+json',
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

// ---------------- multijugador (WebSocket) ----------------
const wss = new WebSocket.Server({ server: httpServer });
const players = new Map();  // id -> { id, name, hero, x, y, z, ry, nation, anim }
let nextId = 1;

function broadcast(obj, exceptId) {
  const s = JSON.stringify(obj);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN && c._pid !== exceptId) c.send(s); });
}

wss.on('connection', (ws) => {
  const id = nextId++;
  ws._pid = id;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'join') {
      const p = { id, name: ('' + (m.name || 'Héroe')).slice(0, 16), hero: m.hero || 'kael', x: 0, y: 0, z: 0, ry: 0, nation: 'centro', anim: 'idle' };
      players.set(id, p);
      // al recién llegado: su id + los demás ya presentes
      ws.send(JSON.stringify({ t: 'welcome', id, players: Array.from(players.values()).filter(q => q.id !== id) }));
      // a los demás: nuevo jugador
      broadcast({ t: 'joined', player: p }, id);
      console.log(`[+] jugador ${id} (${p.name}/${p.hero}) — total ${players.size}`);
    } else if (m.t === 'state') {
      const p = players.get(id);
      if (p) { p.x = m.x; p.y = m.y; p.z = m.z; p.ry = m.ry; p.nation = m.nation; p.anim = m.anim; }
      broadcast({ t: 'state', id, x: m.x, y: m.y, z: m.z, ry: m.ry, anim: m.anim }, id);
    } else if (m.t === 'solve') {
      const p = players.get(id);
      broadcast({ t: 'solve', id, name: p ? p.name : '?', puzzle: m.puzzle, reward: m.reward }, id);
    } else if (m.t === 'chat') {
      const p = players.get(id);
      broadcast({ t: 'chat', id, name: p ? p.name : '?', text: ('' + m.text).slice(0, 120) });
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ t: 'left', id });
    console.log(`[-] jugador ${id} salió — total ${players.size}`);
  });
  ws.on('error', () => {});
});

// ping de mantenimiento: descarta conexiones muertas
const heartbeat = setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false; ws.ping();
  });
}, 30000);
wss.on('close', () => clearInterval(heartbeat));

httpServer.listen(PORT, HOST, () => {
  console.log(`Elemental Legacy sirviendo en http://${HOST}:${PORT} (web + multijugador WS)`);
});
