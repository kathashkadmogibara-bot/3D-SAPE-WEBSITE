/* core.js: the shared engine. State, saving, the 3D drawing, touch input, and the panel that all five buttons plug into.
   Load this first. Every other js file only adds one button. */

var $ = function(s){ return document.querySelector(s); };

var cv = $('#cv'), ctx = cv.getContext('2d'), stage = $('#stage'), panel = $('#body'), readout = $('#readout');

var layer = document.createElement('canvas'), lctx = layer.getContext('2d');

var SH_COLORS = ['#e4572e', '#f2a007', '#3aa655', '#17a2b8', '#3b6fe0', '#8e4fd1', '#d6409f', '#7a8794'];

var KEY = 'shape-builder-v1';


var S = {
  points: [{id:1, name:'A', x:0, y:0, z:0}], lines: [], nextId: 2, nextLine: 1,
  mode: 'idle', draft: null, editing: null, selLine: null,
  conn: {a:'', b:''}, dist: {a:'', b:''}, msg: '', bad: false, confirmNew: false,
  view: {yaw:-0.7, pitch:0.42, zoom:1}, axes: false, fill: true,
  range: 1, areaMode: 'lines', shapeN: 0,
  rounds: [], nextRound: 1, rdraft: null, reditng: null,
  shapes: [], nextShape: 1, shDraft: null, shSum: {}
};


try {
  var raw = localStorage.getItem(KEY);
  if (raw) {
    var d = JSON.parse(raw);
    var ps = (d.points || []).filter(function(p){ return p && p.name && isFinite(p.x) && isFinite(p.y) && isFinite(p.z); });
    if (ps.length) {
      S.points = ps;
      S.lines = (d.lines || []).filter(function(l){ return l && typeof l.id === 'number'; });
      S.nextId = Math.max.apply(null, ps.map(function(p){return p.id;})) + 1;
      S.nextLine = S.lines.length ? Math.max.apply(null, S.lines.map(function(l){return l.id;})) + 1 : 1;
      var rg = parseFloat(d.range);
      if (rg > 0 && isFinite(rg)) { S.range = rg; S.view.zoom = 1 / rg; }
      if (d.areaMode === 'all' || d.areaMode === 'lines') S.areaMode = d.areaMode;
      S.shapeN = d.shapeN | 0;
      S.rounds = (d.rounds || []).filter(function(r){ return r && r.name && (r.type === 'circle' || r.type === 'sphere') && isFinite(r.d) && isFinite(r.cx) && isFinite(r.cy) && isFinite(r.cz); });
      S.nextRound = S.rounds.length ? Math.max.apply(null, S.rounds.map(function(r){ return r.id; })) + 1 : 1;
      S.lines = S.lines.filter(function(l){ return nodeOf(l.ta, l.a) && nodeOf(l.tb, l.b); });
      S.shapes = (d.shapes || []).filter(function(x){ return x && x.name && typeof x.id === 'number' && Array.isArray(x.items); });
      S.nextShape = S.shapes.length ? Math.max.apply(null, S.shapes.map(function(x){ return x.id; })) + 1 : 1;
    }
  }
} catch(e) {}

function save(){
  S.shapes.forEach(function(sh){ sh.items = sh.items.filter(itemExists); });
  try { localStorage.setItem(KEY, JSON.stringify({points:S.points, lines:S.lines, range:S.range, areaMode:S.areaMode, shapeN:S.shapeN, rounds:S.rounds, shapes:S.shapes})); } catch(e) {}
}


function fmt(n, d){
  d = d == null ? 8 : d;
  var s = (+n).toFixed(d);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}

function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

function P(id){ return S.points.filter(function(p){ return p.id === id; })[0]; }

function byName(n){ n = (n||'').trim().toLowerCase(); if(!n) return null; return S.points.filter(function(p){ return p.name.toLowerCase() === n; })[0] || null; }

function cur(){ return S.draft || S.editing; }

function allPts(){ return S.draft ? S.points.concat([S.draft]) : S.points; }

function parseNum(s){
  var t = String(s).trim().replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
  return parseFloat(t);
}

function len(a, b){ return Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z); }

function hexRgb(h){
  var m = /^#([0-9a-f]{6})$/i.exec(h || '');
  if (m) return [parseInt(m[1].slice(0,2),16), parseInt(m[1].slice(2,4),16), parseInt(m[1].slice(4,6),16)];
  m = /^#([0-9a-f]{3})$/i.exec(h || '');
  if (m) return [parseInt(m[1][0]+m[1][0],16), parseInt(m[1][1]+m[1][1],16), parseInt(m[1][2]+m[1][2],16)];
  return [128, 128, 128];
}

function shade(h, f){
  var c = hexRgb(h);
  return 'rgb(' + Math.min(255, Math.round(c[0]*f)) + ',' + Math.min(255, Math.round(c[1]*f)) + ',' + Math.min(255, Math.round(c[2]*f)) + ')';
}

function clR(v){ return Math.max(-S.range, Math.min(S.range, v)); }

function findNode(name){
  var n = (name || '').trim().toLowerCase(); if (!n) return null;
  var p = S.points.filter(function(q){ return q.name.toLowerCase() === n; })[0];
  if (p) return {k:'p', o:p};
  var r = S.rounds.filter(function(q){ return q.name.toLowerCase() === n; })[0];
  return r ? {k:'r', o:r} : null;
}

function nodeOf(k, id){
  var isR = k === 'r', o = isR ? S.rounds.filter(function(r){ return r.id === id; })[0] : P(id);
  return o ? {k:isR ? 'r' : 'p', o:o} : null;
}

function sameNode(a, b){ return !!(a && b && a.k === b.k && a.o === b.o); }

function nodePos(n){ return n.k === 'r' ? [n.o.cx, n.o.cy, n.o.cz] : [n.o.x, n.o.y, n.o.z]; }

// Where a line meets a node. A point is itself; a circle/sphere is met at its nearest edge, facing the other end.
function attach(n, to){
  var c = nodePos(n);
  if (n.k === 'p') return c;
  var o = n.o, rad = o.d / 2, dx = to[0] - c[0], dy = to[1] - c[1], dz = to[2] - c[2];
  if (o.type === 'circle') { if (o.plane === 'xz') dy = 0; else if (o.plane === 'yz') dx = 0; else dz = 0; }
  var L = Math.hypot(dx, dy, dz);
  if (L < 1e-12) { dx = o.type === 'circle' && o.plane === 'yz' ? 0 : 1; dy = o.type === 'circle' && o.plane === 'yz' ? 1 : 0; dz = 0; L = 1; }
  return [c[0] + dx / L * rad, c[1] + dy / L * rad, c[2] + dz / L * rad];
}

function lineEnds(l){
  var na = nodeOf(l.ta, l.a), nb = nodeOf(l.tb, l.b);
  if (!na || !nb) return null;
  return {na:na, nb:nb, a:attach(na, nodePos(nb)), b:attach(nb, nodePos(na))};
}

function lineLen(l){ var e = lineEnds(l); return e ? Math.hypot(e.a[0]-e.b[0], e.a[1]-e.b[1], e.a[2]-e.b[2]) : 0; }

function nodeDist(a, b){
  var x = attach(a, nodePos(b)), y = attach(b, nodePos(a));
  return Math.hypot(x[0]-y[0], x[1]-y[1], x[2]-y[2]);
}

function lineBetween(a, b){
  return S.lines.filter(function(l){
    var x = nodeOf(l.ta, l.a), y = nodeOf(l.tb, l.b);
    return (sameNode(x, a) && sameNode(y, b)) || (sameNode(x, b) && sameNode(y, a));
  })[0];
}

function isPickedRound(r){
  if (S.mode === 'shape') return inDraft('r', r.id);
  var names = S.mode === 'connect' ? [S.conn.a, S.conn.b] : S.mode === 'measure' ? [S.dist.a, S.dist.b] : [];
  return names.some(function(nm){ var n = findNode(nm); return !!(n && n.k === 'r' && n.o === r); });
}

function lineOf(a, b){
  return S.lines.filter(function(l){ return (l.a===a && l.b===b) || (l.a===b && l.b===a); })[0];
}


function hull(pts){
  var n = pts.length, out = {faces:[], area:0, volume:0, flat:false};
  if (n < 3) return out;
  var mx = 1;
  pts.forEach(function(p){ mx = Math.max(mx, Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2])); });
  var eps = 1e-9 * mx;
  var seen = {}, faces = [];
  function sub(a,b){ return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
  function cross(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function poly(on, nrm){
    var ref = Math.abs(nrm[0]) < .9 ? [1,0,0] : [0,1,0];
    var u = cross(nrm, ref), ul = Math.hypot(u[0],u[1],u[2]); u = [u[0]/ul, u[1]/ul, u[2]/ul];
    var v = cross(nrm, u);
    var q = on.map(function(i){ return {i:i, x:dot(pts[i],u), y:dot(pts[i],v)}; });
    q.sort(function(a,b){ return a.x-b.x || a.y-b.y; });
    function cr(o,a,b){ return (a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x); }
    var lo = [], up = [], k;
    for (k = 0; k < q.length; k++) { while (lo.length >= 2 && cr(lo[lo.length-2], lo[lo.length-1], q[k]) <= eps) lo.pop(); lo.push(q[k]); }
    for (k = q.length-1; k >= 0; k--) { while (up.length >= 2 && cr(up[up.length-2], up[up.length-1], q[k]) <= eps) up.pop(); up.push(q[k]); }
    lo.pop(); up.pop();
    var h = lo.concat(up), a = 0;
    for (k = 0; k < h.length; k++) { var j = (k+1) % h.length; a += h[k].x*h[j].y - h[j].x*h[k].y; }
    return {idx: h.map(function(o){ return o.i; }), area: Math.abs(a)/2};
  }
  for (var i = 0; i < n; i++) for (var j = i+1; j < n; j++) for (var k = j+1; k < n; k++) {
    var nr = cross(sub(pts[j],pts[i]), sub(pts[k],pts[i]));
    var nl = Math.hypot(nr[0],nr[1],nr[2]);
    if (nl < eps) continue;
    nr = [nr[0]/nl, nr[1]/nl, nr[2]/nl];
    var dd = dot(nr, pts[i]), pos = 0, neg = 0, on = [];
    for (var m = 0; m < n; m++) {
      var s = dot(nr, pts[m]) - dd;
      if (s > eps) pos++; else if (s < -eps) neg++; else on.push(m);
      if (pos && neg) break;
    }
    if (pos && neg) continue;
    if (!pos && !neg) {
      var pl = poly(on, nr);
      if (pl.idx.length < 3) continue;
      return {faces:[{idx:pl.idx, n:nr}], area:pl.area, volume:0, flat:true};
    }
    var key = on.join(',');
    if (seen[key]) continue;
    seen[key] = 1;
    var outn = pos ? [-nr[0],-nr[1],-nr[2]] : nr;
    var pg = poly(on, nr);
    if (pg.idx.length < 3) continue;
    faces.push({idx:pg.idx, n:outn, area:pg.area, d:dd, nr:nr});
  }
  if (!faces.length) return out;
  var c = [0,0,0];
  pts.forEach(function(p){ c[0]+=p[0]/n; c[1]+=p[1]/n; c[2]+=p[2]/n; });
  faces.forEach(function(f){
    out.area += f.area;
    out.volume += f.area * Math.abs(f.d - dot(f.nr, c)) / 3;
  });
  out.faces = faces;
  return out;
}


var hcMap = {}, hcCount = 0;

function getHull(list){
  var k = list.map(function(p){ return p.x + ',' + p.y + ',' + p.z; }).join('|');
  if (!hcMap[k]) {
    if (hcCount > 60) { hcMap = {}; hcCount = 0; }
    hcMap[k] = hull(list.map(function(p){ return [p.x,p.y,p.z]; })); hcCount++;
  }
  return hcMap[k];
}

// Points that form the shape: connected points when any lines exist, otherwise all points.
function shapePts(withDraft){
  var base = withDraft ? allPts() : S.points;
  if (S.areaMode === 'lines' && S.lines.length) {
    var used = {};
    S.lines.forEach(function(l){ if ((l.ta || 'p') === 'p') used[l.a] = 1; if ((l.tb || 'p') === 'p') used[l.b] = 1; });
    var f = base.filter(function(p){ return used[p.id]; });
    if (f.length >= 3) return f;
  }
  return base;
}


function stats(){
  var sp = shapePts(false);
  var h = getHull(sp);
  var total = 0;
  S.lines.forEach(function(l){ total += lineLen(l); });
  return {len: total, area: h.area, vol: h.volume, flat: h.flat, n: sp.length};
}


var W = 0, H = 0, dpr = 1, raf = 0, hits = [], DIST = 6;


function rot(x, y, z){
  var v = S.view, cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
  var x1 = x*cy + z*sy, z1 = -x*sy + z*cy;
  return [x1, y*cp - z1*sp, y*sp + z1*cp];
}

function proj(x, y, z){
  var r = rot(x, y, z), D = DIST, f = D / Math.max(D*0.07, D - r[2]);
  var s = Math.min(W, H) * 0.30 * S.view.zoom;
  return {x: W/2 + r[0]*f*s, y: H/2 - r[1]*f*s, z: r[2], f: f};
}

function requestDraw(){ if (!raf) raf = requestAnimationFrame(draw); }


function resize(){
  var r = stage.getBoundingClientRect();
  W = Math.max(1, r.width); H = Math.max(1, r.height);
  dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
  layer.width = cv.width; layer.height = cv.height;
  requestDraw();
}


function draw(){
  raf = 0;
  if (!W) return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  var cs = getComputedStyle(document.documentElement);
  function c(n){ return cs.getPropertyValue(n).trim(); }
  var ink = c('--ink'), acc = c('--accent'), bg = c('--canvas'), muted = c('--muted');
  var AX = {x:c('--ax-x'), y:c('--ax-y'), z:c('--ax-z')};
  var cmap = {p:{}, r:{}, l:{}, sh:[]};
  function colourShape(items, color){
    var X = expandItems(items);
    X.pts.forEach(function(q){ cmap.p[q.id] = color; });
    X.rds.forEach(function(r){ cmap.r[r.id] = color; });
    X.lns.forEach(function(l){ cmap.l[l.id] = color; });
    cmap.sh.push({X:X, color:color});
  }
  S.shapes.forEach(function(sh){ if (!(S.shDraft && S.shDraft.id === sh.id)) colourShape(sh.items, shapeColorFor(sh)); });
  if (S.shDraft && S.shDraft.items.length) colourShape(S.shDraft.items, S.shDraft.color);
  var pts = allPts(), pr = new Map(), ext = S.range;
  pts.forEach(function(p){ ext = Math.max(ext, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)); });
  allRounds().forEach(function(r){ ext = Math.max(ext, Math.abs(r.cx) + r.d/2, Math.abs(r.cy) + r.d/2, Math.abs(r.cz) + r.d/2); });
  DIST = 6 * Math.max(1, ext);
  pts.forEach(function(p){ pr.set(p, proj(p.x,p.y,p.z)); });

  // optional axes
  if (S.axes) {
    ctx.font = '500 10px "JetBrains Mono",monospace';
    [['x',[1,0,0]],['y',[0,1,0]],['z',[0,0,1]]].forEach(function(a){
      var k = a[0], v = a[1];
      var E = S.range, p0 = proj(-v[0]*1.25*E,-v[1]*1.25*E,-v[2]*1.25*E), p1 = proj(v[0]*1.25*E,v[1]*1.25*E,v[2]*1.25*E);
      ctx.strokeStyle = AX[k]; ctx.globalAlpha = .6; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p0.x,p0.y); ctx.lineTo(p1.x,p1.y); ctx.stroke();
      [-1,1].forEach(function(t){
        var q = proj(v[0]*t*E,v[1]*t*E,v[2]*t*E);
        ctx.beginPath(); ctx.arc(q.x,q.y,2.5,0,6.283); ctx.fillStyle = AX[k]; ctx.fill();
        ctx.globalAlpha = .9; ctx.fillStyle = muted; ctx.fillText(fmt(t*E,4), q.x+5, q.y+12); ctx.globalAlpha = .6;
      });
      ctx.globalAlpha = 1; ctx.fillStyle = AX[k]; ctx.font = '700 12px "JetBrains Mono",monospace';
      ctx.fillText(k.toUpperCase(), p1.x+6, p1.y-4);
      ctx.font = '500 10px "JetBrains Mono",monospace';
    });
    ctx.globalAlpha = 1;
  }

  // hull faces
  function fillHull(list, col){
    if (!S.fill || list.length < 3 || list.length > 150) return;
    var hi = getHull(list);
    var fs = hi.faces.map(function(f){
      var vs = f.idx.map(function(i){ return pr.get(list[i]) || proj(list[i].x, list[i].y, list[i].z); });
      var dz = vs.reduce(function(t, v){ return t + v.z; }, 0) / vs.length;
      return {vs:vs, dz:dz, nz:Math.abs(rot(f.n[0], f.n[1], f.n[2])[2])};
    });
    fs.sort(function(a, b){ return a.dz - b.dz; });
    fs.forEach(function(f){
      ctx.beginPath();
      f.vs.forEach(function(v, i){ if (i) ctx.lineTo(v.x, v.y); else ctx.moveTo(v.x, v.y); });
      ctx.closePath();
      ctx.globalAlpha = .1 + .2 * f.nz; ctx.fillStyle = col; ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  fillHull(shapePts(true).filter(function(q){ return !cmap.p[q.id]; }), acc);
  cmap.sh.forEach(function(it){
    var apx = [];
    it.X.lns.forEach(function(l){ var sf0 = lineSurface(l); if (sf0 && sf0.t === 'cone') apx.push(sf0.apex); });
    fillHull(it.X.pts.filter(function(q){ return apx.indexOf(q) < 0; }), it.color);
  });

  // lines. A point joined to a circle, or two circles, is drawn as a solid surface with no line at all.
  var segs = [], surfs = [];
  function drawSurface(sf, strong, col, sel, id){
    var NG = 96, polys = [], rims = [], tris = [], k, j, apS = null;
    function scr(w){ return proj(w[0], w[1], w[2]); }
    if (sf.t === 'cone') {
      var apW = [sf.apex.x, sf.apex.y, sf.apex.z], rW = rimWorld(sf.base, NG), rS = rW.map(scr);
      apS = scr(apW); rims.push(rS);
      for (k = 0; k < NG; k++) { j = (k + 1) % NG; polys.push({s:[apS, rS[k], rS[j]], w:[apW, rW[k], rW[j]]}); }
    } else {
      var r1W = rimWorld(sf.r1, NG), r2W = rimWorld(sf.r2, NG), r1S = r1W.map(scr), r2S = r2W.map(scr);
      rims.push(r1S, r2S);
      for (k = 0; k < NG; k++) { j = (k + 1) % NG; polys.push({s:[r1S[k], r1S[j], r2S[j], r2S[k]], w:[r1W[k], r1W[j], r2W[j], r2W[k]]}); }
    }
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0); lctx.clearRect(0, 0, W, H);
    polys.forEach(function(pg){
      var a = pg.w[0], b = pg.w[1], cc3 = pg.w[2];
      var ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2], vx = cc3[0]-a[0], vy = cc3[1]-a[1], vz = cc3[2]-a[2];
      var nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx, nl = Math.hypot(nx, ny, nz) || 1;
      var f = .6 + .5 * Math.abs(rot(nx / nl, ny / nl, nz / nl)[2]), cs = shade(col, f);
      lctx.beginPath();
      pg.s.forEach(function(q, i){ if (i) lctx.lineTo(q.x, q.y); else lctx.moveTo(q.x, q.y); });
      lctx.closePath(); lctx.fillStyle = cs; lctx.strokeStyle = cs; lctx.lineWidth = 1; lctx.fill(); lctx.stroke();
      var t0 = pg.s[0], t1 = pg.s[1], t2 = pg.s[2], t3 = pg.s[3];
      tris.push([t0.x, t0.y, t1.x, t1.y, t2.x, t2.y]);
      if (t3) tris.push([t0.x, t0.y, t2.x, t2.y, t3.x, t3.y]);
    });
    ctx.globalAlpha = strong ? .85 : .62; ctx.drawImage(layer, 0, 0, W, H); ctx.globalAlpha = 1;
    if (sel) {
      ctx.strokeStyle = acc; ctx.lineWidth = 3;
      rims.forEach(function(rs){ ctx.beginPath(); rs.forEach(function(q, i){ if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); ctx.closePath(); ctx.stroke(); });
      if (apS) { ctx.beginPath(); ctx.arc(apS.x, apS.y, 7, 0, 6.283); ctx.stroke(); }
    }
    surfs.push({id:id, tris:tris});
  }
  S.lines.forEach(function(l){
    var e = lineEnds(l); if (!e) return;
    var pa = proj(e.a[0], e.a[1], e.a[2]), pb = proj(e.b[0], e.b[1], e.b[2]);
    var sel = S.selLine === l.id, dsel = S.mode === 'shape' && inDraft('l', l.id);
    var lcol = sel ? acc : (cmap.l[l.id] || ink);
    var sf = lineSurface(l);
    if (sf) { drawSurface(sf, sel || dsel, cmap.l[l.id] || acc, sel, l.id); return; }
    ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y);
    ctx.strokeStyle = lcol; ctx.lineWidth = (sel || dsel) ? 3.5 : 2; ctx.globalAlpha = (sel || dsel) ? 1 : .85; ctx.stroke();
    [[e.na, pa], [e.nb, pb]].forEach(function(x){
      if (x[0].k === 'r') { ctx.beginPath(); ctx.arc(x[1].x, x[1].y, 3.5, 0, 6.283); ctx.fillStyle = lcol; ctx.fill(); }
    });
    segs.push({id:l.id, ax:pa.x, ay:pa.y, bx:pb.x, by:pb.y});
  });
  ctx.globalAlpha = 1;
  if (typeof drawCutPreview === 'function') drawCutPreview(ctx, acc);

  // round shapes: true circles and spheres, drawn smooth from their diameter
  var rhits = [], ract = rcur();
  allRounds().forEach(function(r){
    var isA = r === ract || isPickedRound(r), rad = r.d / 2, rc = cmap.r[r.id], col = rc || (isA ? acc : ink), fillc = rc || acc, cpr = proj(r.cx, r.cy, r.cz);
    function ring(pl, n){
      var out = [], i, t, cc, ss;
      for (i = 0; i <= n; i++) {
        t = 2 * Math.PI * i / n; cc = rad * Math.cos(t); ss = rad * Math.sin(t);
        out.push(pl === 'xz' ? proj(r.cx + cc, r.cy, r.cz + ss) : pl === 'yz' ? proj(r.cx, r.cy + cc, r.cz + ss) : proj(r.cx + cc, r.cy + ss, r.cz));
      }
      return out;
    }
    if (r.type === 'circle') {
      var poly = ring(r.plane, 120);
      ctx.beginPath();
      poly.forEach(function(q, i){ if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
      ctx.closePath();
      ctx.globalAlpha = rc ? .3 : .12; ctx.fillStyle = fillc; ctx.fill();
      ctx.globalAlpha = 1; ctx.lineWidth = isA ? 3 : 2; ctx.strokeStyle = col; ctx.stroke();
      rhits.push({id:r.id, kind:'c', poly:poly});
    } else {
      var Rs = rad * Math.min(W, H) * 0.30 * S.view.zoom * cpr.f;
      var g = ctx.createRadialGradient(cpr.x - Rs * .35, cpr.y - Rs * .35, Rs * .1, cpr.x, cpr.y, Rs);
      g.addColorStop(0, shade(fillc, 1.4)); g.addColorStop(1, shade(fillc, .62));
      ctx.beginPath(); ctx.arc(cpr.x, cpr.y, Rs, 0, 6.283);
      ctx.globalAlpha = rc ? .78 : .35; ctx.fillStyle = g; ctx.fill();
      ctx.globalAlpha = 1; ctx.lineWidth = isA ? 3 : 1.5; ctx.strokeStyle = col; ctx.stroke();
      rhits.push({id:r.id, kind:'s', x:cpr.x, y:cpr.y, R:Rs});
    }
    ctx.beginPath(); ctx.arc(cpr.x, cpr.y, 2.5, 0, 6.283); ctx.fillStyle = col; ctx.fill();
    ctx.font = '600 12px "JetBrains Mono",monospace';
    ctx.lineWidth = 3; ctx.strokeStyle = bg; ctx.strokeText(r.name, cpr.x + 7, cpr.y - 7);
    ctx.fillStyle = col; ctx.fillText(r.name, cpr.x + 7, cpr.y - 7);
  });


  // guides for the point being edited
  var act = cur();
  if (act) {
    var stops = [[0,0,0],[act.x,0,0],[act.x,act.y,0],[act.x,act.y,act.z]], cols = [AX.x, AX.y, AX.z];
    ctx.setLineDash([4,4]); ctx.lineWidth = 1.5; ctx.globalAlpha = .85;
    for (var i = 0; i < 3; i++) {
      var s0 = proj(stops[i][0],stops[i][1],stops[i][2]), s1 = proj(stops[i+1][0],stops[i+1][1],stops[i+1][2]);
      ctx.strokeStyle = cols[i]; ctx.beginPath(); ctx.moveTo(s0.x,s0.y); ctx.lineTo(s1.x,s1.y); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  // points
  var cA = byName(S.conn.a), cB = byName(S.conn.b), dA = byName(S.dist.a), dB = byName(S.dist.b);
  var order = pts.slice().sort(function(a,b){ return pr.get(a).z - pr.get(b).z; });
  hits = [];
  ctx.font = '600 12px "JetBrains Mono",monospace';
  order.forEach(function(p){
    var q = pr.get(p), r = Math.max(4, Math.min(9, 5.5*q.f));
    var isAct = p === act;
    var picked = (S.mode === 'connect' && (p === cA || p === cB)) || (S.mode === 'measure' && (p === dA || p === dB)) || (S.mode === 'shape' && inDraft('p', p.id));
    if (picked) { ctx.beginPath(); ctx.arc(q.x,q.y,r+5,0,6.283); ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(q.x,q.y,r+(isAct?2:0),0,6.283);
    ctx.fillStyle = isAct ? acc : (cmap.p[p.id] || ink); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = bg; ctx.stroke();
    if (pts.length <= 30 || isAct || picked) {
      ctx.lineWidth = 3; ctx.strokeStyle = bg; ctx.strokeText(p.name, q.x+r+5, q.y-r-3);
      ctx.fillStyle = isAct ? acc : ink; ctx.fillText(p.name, q.x+r+5, q.y-r-3);
    }
    if (p !== S.draft) hits.push({p:p, x:q.x, y:q.y, r:r, z:q.z});
  });

  // orientation gizmo
  var gx = 34, gy = H - 34;
  ctx.font = '700 10px "JetBrains Mono",monospace';
  [['x',[1,0,0]],['y',[0,1,0]],['z',[0,0,1]]].map(function(a){
    var r = rot(a[1][0],a[1][1],a[1][2]); return {k:a[0], x:r[0], y:r[1], z:r[2]};
  }).sort(function(a,b){ return a.z-b.z; }).forEach(function(a){
    ctx.strokeStyle = AX[a.k]; ctx.lineWidth = 2; ctx.globalAlpha = .9;
    ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+a.x*22, gy-a.y*22); ctx.stroke();
    ctx.fillStyle = AX[a.k]; ctx.fillText(a.k.toUpperCase(), gx+a.x*22+(a.x>=0?3:-9), gy-a.y*22+(a.y>=0?-2:10));
  });
  ctx.globalAlpha = 1;

  hits.segs = segs; hits.rounds = rhits; hits.surfs = surfs;
  var t = S.points.length + (S.points.length === 1 ? ' point · ' : ' points · ') + S.lines.length + (S.lines.length === 1 ? ' line' : ' lines') + (S.rounds.length ? ' · ' + S.rounds.length + (S.rounds.length === 1 ? ' round' : ' rounds') : '');
  if (readout.textContent !== t) readout.textContent = t;
}


var ptrs = new Map(), down = null, moved = false, lastPinch = 0;

cv.addEventListener('pointerdown', function(e){
  cv.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, {x:e.offsetX, y:e.offsetY});
  if (ptrs.size === 1) { down = {x:e.offsetX, y:e.offsetY}; moved = false; }
  if (ptrs.size === 2) {
    var a = Array.from(ptrs.values());
    lastPinch = Math.hypot(a[0].x-a[1].x, a[0].y-a[1].y); moved = true;
  }
});

cv.addEventListener('pointermove', function(e){
  var p = ptrs.get(e.pointerId); if (!p) return;
  var dx = e.offsetX - p.x, dy = e.offsetY - p.y;
  p.x = e.offsetX; p.y = e.offsetY;
  if (ptrs.size === 1) {
    if (!moved && Math.hypot(e.offsetX-down.x, e.offsetY-down.y) > 6) moved = true;
    if (moved) {
      S.view.yaw += dx*0.01;
      S.view.pitch = Math.max(-1.45, Math.min(1.45, S.view.pitch + dy*0.01));
      requestDraw();
    }
  } else if (ptrs.size === 2) {
    var a = Array.from(ptrs.values()), d = Math.hypot(a[0].x-a[1].x, a[0].y-a[1].y);
    if (lastPinch > 0) S.view.zoom = Math.max(0.0005, Math.min(1000, S.view.zoom * d / lastPinch));
    lastPinch = d; requestDraw();
  }
});

function endPtr(e){
  var was = ptrs.size;
  ptrs.delete(e.pointerId);
  if (was === 1 && !moved && e.type === 'pointerup') tap(e.offsetX, e.offsetY);
  if (ptrs.size < 2) lastPinch = 0;
}

cv.addEventListener('pointerup', endPtr);

cv.addEventListener('pointercancel', endPtr);

cv.addEventListener('wheel', function(e){
  e.preventDefault();
  S.view.zoom = Math.max(0.0005, Math.min(1000, S.view.zoom * Math.exp(-e.deltaY*0.0015)));
  requestDraw();
}, {passive:false});


function sgn(px, py, ax, ay, bx, by){ return (px - bx) * (ay - by) - (ax - bx) * (py - by); }

function inTri(px, py, t){
  var d1 = sgn(px, py, t[0], t[1], t[2], t[3]), d2 = sgn(px, py, t[2], t[3], t[4], t[5]), d3 = sgn(px, py, t[4], t[5], t[0], t[1]);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function segDist(px, py, s){
  var vx = s.bx-s.ax, vy = s.by-s.ay, wx = px-s.ax, wy = py-s.ay;
  var l2 = vx*vx + vy*vy, t = l2 ? Math.max(0, Math.min(1, (wx*vx+wy*vy)/l2)) : 0;
  return Math.hypot(px-(s.ax+t*vx), py-(s.ay+t*vy));
}


function tap(x, y){
  if (S.draft || S.rdraft) return;
  var best = null, bd = 1e9;
  hits.forEach(function(h){
    var d = Math.hypot(x-h.x, y-h.y);
    if (d <= Math.max(h.r+10, 18) && (d < bd || (Math.abs(d-bd) < 2 && best && h.z > best.z))) { best = h; bd = d; }
  });
  if (best) { pickPoint(best.p); return; }
  var sb = null, sd = 11;
  (hits.segs || []).forEach(function(s){ var d = segDist(x,y,s); if (d < sd) { sd = d; sb = s; } });
  if (sb && S.mode === 'shape') { toggleItem('l', sb.id); return; }
  if (sb) { S.mode = 'line'; S.selLine = sb.id; S.editing = null; S.reditng = null; S.msg = ''; renderPanel(); requestDraw(); return; }
  var rb = null, rbd = 11;
  (hits.rounds || []).forEach(function(h){
    var d = 1e9, i;
    if (h.kind === 'c') {
      for (i = 0; i < h.poly.length - 1; i++) d = Math.min(d, segDist(x, y, {ax:h.poly[i].x, ay:h.poly[i].y, bx:h.poly[i+1].x, by:h.poly[i+1].y}));
    } else {
      var dc = Math.hypot(x - h.x, y - h.y); d = Math.min(Math.abs(dc - h.R), dc);
    }
    if (d < rbd) { rbd = d; rb = h; }
  });
  if (rb) { var ro = S.rounds.filter(function(r){ return r.id === rb.id; })[0]; if (ro) { pickRoundTap(ro); return; } }
  if (S.mode !== 'connect' && S.mode !== 'measure') {
    var sfh = null;
    (hits.surfs || []).forEach(function(sf){
      if (sfh) return;
      for (var ti = 0; ti < sf.tris.length; ti++) { if (inTri(x, y, sf.tris[ti])) { sfh = sf; break; } }
    });
    if (sfh) {
      if (S.mode === 'shape') { toggleItem('l', sfh.id); return; }
      S.mode = 'line'; S.selLine = sfh.id; S.editing = null; S.reditng = null; S.msg = ''; renderPanel(); requestDraw(); return;
    }
  }
  if (S.mode === 'edit' || S.mode === 'line' || S.mode === 'round') { S.mode = 'idle'; S.editing = null; S.reditng = null; S.selLine = null; S.msg = ''; renderPanel(); requestDraw(); }
}


function pickNodeName(name){
  if (S.mode === 'connect') {
    if (!S.conn.a || (S.conn.a && S.conn.b)) { S.conn.a = name; S.conn.b = ''; S.msg = ''; renderPanel(); requestDraw(); }
    else { S.conn.b = name; doConnect(); }
    return true;
  }
  if (S.mode === 'measure') {
    if (!S.dist.a || (S.dist.a && S.dist.b)) { S.dist.a = name; S.dist.b = ''; }
    else S.dist.b = name;
    renderPanel(); requestDraw(); return true;
  }
  return false;
}

function pickRoundTap(r){
  if (S.mode === 'shape') { toggleItem('r', r.id); return; }
  if (!pickNodeName(r.name)) pickRound(r);
}


function pickPoint(p){
  if (S.mode === 'shape') { toggleItem('p', p.id); return; }
  if (pickNodeName(p.name)) return;
  S.mode = 'edit'; S.editing = p; S.reditng = null; S.selLine = null; S.msg = ''; S.confirmNew = false;
  renderPanel(); requestDraw();
}


function setMode(m){
  if ((m === 'add' || m === 'shapes' || m === 'shape') && S.mode === m) return;
  S.draft = null; S.editing = null; S.selLine = null; S.rdraft = null; S.reditng = null; S.shDraft = null; S.conn = {a:'', b:''}; S.msg = ''; S.bad = false; S.confirmNew = false;
  if (m === 'measure') {
    S.dist = {a: S.points[0] ? S.points[0].name : '', b: S.points[1] ? S.points[1].name : ''};
  }
  S.mode = m;
  if (m === 'add') S.draft = {id:-1, name:nextName(), x:0, y:0, z:0};
  if (m === 'shapes') S.rdraft = newRound();
  if (m === 'shape') S.shDraft = newShDraft();
  renderPanel(); requestDraw();
}


function showErr(t){ var e = $('#err'); if (e) { e.textContent = t; e.hidden = !t; } }


function updateModes(){
  document.querySelectorAll('.modes .btn').forEach(function(b){
    b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === S.mode));
  });
}


function noteHTML(){
  return S.msg ? '<p class="note ' + (S.bad ? 'bad' : 'ok') + '">' + esc(S.msg) + '</p>' : '';
}


panel.addEventListener('pointerup', function(e){ if (e.target.type === 'range') save(); });


document.querySelectorAll('.modes .btn').forEach(function(b){
  b.addEventListener('click', function(){ setMode(b.getAttribute('data-mode')); });
});


$('#tAxes').addEventListener('click', function(e){ S.axes = !S.axes; e.currentTarget.setAttribute('aria-pressed', String(S.axes)); requestDraw(); });

$('#tFill').addEventListener('click', function(e){ S.fill = !S.fill; e.currentTarget.setAttribute('aria-pressed', String(S.fill)); requestDraw(); });

$('#tFit').addEventListener('click', function(){
  var m = 1;
  allPts().forEach(function(p){ m = Math.max(m, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)); });
  allRounds().forEach(function(r){ m = Math.max(m, Math.abs(r.cx) + r.d/2, Math.abs(r.cy) + r.d/2, Math.abs(r.cz) + r.d/2); });
  S.view.zoom = 1 / m; S.view.yaw = -0.7; S.view.pitch = 0.42; requestDraw();
});


/* ---------- the panel: every button registers itself in MODES (see the other js files) ---------- */
var MODES = {};
function modeFor(m){
  for (var k in MODES) if (MODES[k].modes && MODES[k].modes.indexOf(m) >= 0) return MODES[k];
  return MODES.idle;
}
// asks every mode, in order, until one says "handled"
function dispatch(kind, a, b){
  for (var k in MODES) { var fn = MODES[k][kind]; if (fn && fn(a, b) === true) return true; }
  return false;
}
function renderPanel(){
  updateModes();
  var m = modeFor(S.mode), h = m.html();
  if (h === null) return renderPanel();      // that mode had nothing to show, so it went back to idle
  panel.innerHTML = h;
  if (m.after) m.after();
}

function idleHTML(){
  return noteHTML() +
    '<div class="field"><span class="lbl">Points</span></div>' +
    '<div class="chips">' + S.rounds.map(roundChip).join('') + S.points.slice(0, 40).map(function(p){
      return '<button class="pt" type="button" data-act="pick" data-id="' + p.id + '"><b>' + esc(p.name) + '</b><span>' + fmt(p.x,3) + ', ' + fmt(p.y,3) + ', ' + fmt(p.z,3) + '</span></button>';
    }).join('') + '</div>' +
    (S.points.length > 40 ? '<p class="note">+ ' + (S.points.length - 40) + ' more points. Tap them on the graph.</p>' : '') +
    '<p class="note">Tap a point to edit or remove it. Drag the graph to rotate, pinch to zoom.</p>' +
    '<div class="foot">' + (S.confirmNew
      ? '<span class="note">Delete everything and start again?</span><span><button class="btn danger" type="button" data-act="newyes">Yes, clear</button> <button class="btn" type="button" data-act="newno">Keep</button></span>'
      : '<button class="linkbtn" type="button" data-act="newask">Start a new shape</button>') + '</div>';
}
MODES.idle = {
  modes: ['idle'],
  html: idleHTML,
  click: function(act, t){
    if (act === 'pick') { var p = P(+t.getAttribute('data-id')); if (p) pickPoint(p); }
    else if (act === 'newask') { S.confirmNew = true; renderPanel(); }
    else if (act === 'newno') { S.confirmNew = false; renderPanel(); }
    else if (act === 'newyes') {
      S.points = [{id:1, name:'A', x:0, y:0, z:0}]; S.lines = []; S.nextId = 2; S.nextLine = 1; S.rounds = []; S.nextRound = 1; S.shapes = []; S.shSum = {}; S.shDraft = null;
      S.confirmNew = false; S.msg = 'New shape started.'; S.bad = false; save(); renderPanel(); requestDraw();
    }
    else return false;
    return true;
  }
};

panel.addEventListener('click', function(e){
  var t = e.target.closest('[data-act]'); if (!t) return;
  dispatch('click', t.getAttribute('data-act'), t);
});
panel.addEventListener('input', function(e){ dispatch('input', e.target, e); });
panel.addEventListener('change', function(e){ if (!dispatch('change', e.target, e) && e.target.type === 'range') save(); });
panel.addEventListener('keydown', function(e){ dispatch('key', e); });
panel.addEventListener('focusin', function(e){ dispatch('focusin', e.target, e); });

/* ---------- start-up: runs after every js file has loaded ---------- */
function boot(){
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', requestDraw); } catch(e) {}
  new MutationObserver(requestDraw).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestDraw);
  renderPanel();
  resize();
  renderPanel();
  resize();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
