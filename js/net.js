// ====================================================================
//  net.js — Cliente de red (WebSocket) para el mundo multijugador.
//  Se conecta al mismo host que sirve la página (server.js).
// ====================================================================

const Net = (function(){
  let ws = null, myId = null, cbs = {};

  function connect(name, hero, clan, callbacks){
    cbs = callbacks || {};
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    try { ws = new WebSocket(proto + '://' + location.host); }
    catch (e) { if (cbs.error) cbs.error(e); return; }

    ws.onopen = () => { ws.send(JSON.stringify({ t:'join', name:name, hero:hero, clan:clan||'' })); if (cbs.open) cbs.open(); };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch (_) { return; }
      if (m.t === 'welcome'){ myId = m.id; cbs.welcome && cbs.welcome(m); }
      else if (m.t === 'joined') cbs.join && cbs.join(m.player);
      else if (m.t === 'state')  cbs.state && cbs.state(m);
      else if (m.t === 'left')   cbs.leave && cbs.leave(m.id);
      else if (m.t === 'solve')  cbs.solve && cbs.solve(m);
      else if (m.t === 'chat')   cbs.chat && cbs.chat(m);
      else if (m.t === 'save')   cbs.save && cbs.save(m);
      else if (m.t === 'party')  cbs.party && cbs.party(m);
      else if (m.t === 'clan')   cbs.clan && cbs.clan(m);
    };
    ws.onclose = () => { if (cbs.close) cbs.close(); };
    ws.onerror = (e) => { if (cbs.error) cbs.error(e); };
  }
  function send(o){ if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
  function disconnect(){ if (ws){ try { ws.close(); } catch (_) {} ws = null; } }
  function connected(){ return !!ws && ws.readyState === 1; }

  return { connect, send, disconnect, connected, get id(){ return myId; } };
})();
window.Net = Net;   // expuesto en window (sendChat/connectNet chequean `window.Net`)
