/* connect.js: the "Connect line" button. A point joined to a circle becomes a cone; two circles become a cylinder. */

function doConnect(){
  var a = findNode(S.conn.a), b = findNode(S.conn.b);
  if (!S.conn.a.trim() || !S.conn.b.trim()) { S.msg = 'Enter both names.'; S.bad = true; }
  else if (!a) { S.msg = 'Nothing is named "' + S.conn.a.trim() + '".'; S.bad = true; }
  else if (!b) { S.msg = 'Nothing is named "' + S.conn.b.trim() + '".'; S.bad = true; }
  else if (sameNode(a, b)) { S.msg = 'Pick two different ones.'; S.bad = true; }
  else if (lineBetween(a, b)) { S.msg = a.o.name + ' and ' + b.o.name + ' are already connected.'; S.bad = true; S.conn = {a:'', b:''}; }
  else {
    S.lines.push({id:S.nextLine++, a:a.o.id, b:b.o.id, ta:a.k, tb:b.k});
    var sfc = lineSurface(S.lines[S.lines.length - 1]);
    S.msg = 'Connected ' + a.o.name + ' — ' + b.o.name + (sfc ? (sfc.t === 'cone' ? '  (cone)' : '  (cylinder / frustum)') : '  (' + fmt(nodeDist(a, b),4) + ' m)'); S.bad = false;
    S.conn = {a:'', b:''}; save();
  }
  renderPanel(); requestDraw();
}


function connectHTML(){
  return '<div class="pair">' +
    '<div class="field"><label for="ca">1st point</label><input class="txt" id="ca" list="names" type="text" autocomplete="off" spellcheck="false" placeholder="Name" value="' + esc(S.conn.a) + '"></div>' +
    '<span class="dash">—</span>' +
    '<div class="field"><label for="cb">2nd point</label><input class="txt" id="cb" list="names" type="text" autocomplete="off" spellcheck="false" placeholder="Name" value="' + esc(S.conn.b) + '"></div></div>' +
    '<datalist id="names">' + S.points.concat(S.rounds).map(function(p){ return '<option value="' + esc(p.name) + '">'; }).join('') + '</datalist>' +
    '<button class="btn primary" type="button" data-act="connect">Connect</button>' +
    noteHTML() + '<p class="note">Or tap two points on the graph. A point joined to a circle makes a cone. Two circles joined make a cylinder. Tap a line to remove it.</p>';
}

function lineMoveHTML(l){
  var st = S.moveStep == null ? 0.1 : S.moveStep;
  function b(a, sg){ return '<button class="chip mv-' + a + '" type="button" data-act="lmv" data-a="' + a + '" data-s="' + sg + '">' + a.toUpperCase() + (sg > 0 ? ' +' : ' \u2212') + '</button>'; }
  return '<div class="cutbox"><span class="lbl">Move this line / cone / cylinder</span>' +
    '<div class="field"><label for="mvstep">Step (m)</label><input class="txt" id="mvstep" type="text" inputmode="decimal" autocomplete="off" value="' + st + '"></div>' +
    '<div class="mvgrid">' + b('x',-1) + b('x',1) + b('y',-1) + b('y',1) + b('z',-1) + b('z',1) + '</div></div>';
}

function moveLine(a, sg){
  var l = S.lines.filter(function(x){ return x.id === S.selLine; })[0], le = l && lineEnds(l);
  if (!le) return;
  var d = (S.moveStep == null ? 0.1 : S.moveStep) * sg, rk = {x:'cx', y:'cy', z:'cz'}[a];
  [le.na, le.nb].forEach(function(n){ if (n.k === 'p') n.o[a] = +(n.o[a] + d).toFixed(10); else n.o[rk] = +(n.o[rk] + d).toFixed(10); });
  save(); renderPanel(); requestDraw();
}

function cutGeom(l){
  var le = l && lineEnds(l);
  if (!le || le.na.o.type === 'sphere' || le.nb.o.type === 'sphere') return null;
  var ca = nodePos(le.na), cb = nodePos(le.nb), len = Math.hypot(cb[0] - ca[0], cb[1] - ca[1], cb[2] - ca[2]);
  if (!(len > 0)) return null;
  return {le:le, ca:ca, cb:cb, len:len};
}
function cutAt(g, t){ return [g.ca[0] + (g.cb[0] - g.ca[0]) * t, g.ca[1] + (g.cb[1] - g.ca[1]) * t, g.ca[2] + (g.cb[2] - g.ca[2]) * t]; }

function cutHTML(l){
  var g = cutGeom(l);
  if (!g) return '<p class="note">This line cannot be cut (sphere, or both ends at the same place).</p>';
  if (S.cutFor !== l.id) { S.cutFor = l.id; S.cutPos = 50; S.cutGap = 0; }
  var rnd = (l.ta === 'r' || l.tb === 'r'), c = cutAt(g, S.cutPos / 100);
  function f(i, a, v, extent){ return '<div class="field"><label for="cut' + a + '">' + a.toUpperCase() + '</label><input class="txt" id="cut' + a + '" type="text" inputmode="decimal" autocomplete="off" value="' + fmt(v, 6) + '"' + (Math.abs(extent) < 1e-9 ? ' readonly' : '') + '></div>'; }
  return '<div class="cutbox"><span class="lbl">' + (rnd ? 'Cut this cone / cylinder (a circle appears)' : 'Cut this line into 2') + '</span>' +
    '<p class="note">The dashed mark on the graph shows where it will be cut. Slide it, or type the X / Y / Z of the cut place.</p>' +
    '<input type="range" id="cutrange" min="1" max="99" step="any" value="' + S.cutPos + '" aria-label="Cut position along the line">' +
    '<div class="pair"><div class="field"><label for="cutpos">Cut at (%)</label><input class="txt" id="cutpos" type="text" inputmode="decimal" autocomplete="off" value="' + fmt(S.cutPos, 4) + '"></div>' +
    '<span class="dash">+</span>' +
    '<div class="field"><label for="cutgap">Gap (m)</label><input class="txt" id="cutgap" type="text" inputmode="decimal" autocomplete="off" value="' + S.cutGap + '"></div></div>' +
    '<span class="lbl">Cut place (X, Y, Z)</span>' +
    '<div class="mvxyz">' + f(0, 'x', c[0], g.cb[0] - g.ca[0]) + f(1, 'y', c[1], g.cb[1] - g.ca[1]) + f(2, 'z', c[2], g.cb[2] - g.ca[2]) + '</div>' +
    '<button class="btn primary" type="button" data-act="cutline">Cut line</button></div>';
}

// move the cut place from a typed value or the slider, and keep every box and the preview in step
function setCut(src, id){
  var l = S.lines.filter(function(x){ return x.id === S.selLine; })[0], g = cutGeom(l);
  if (!g) return;
  var v = num(src.value, NaN), t;
  if (id === 'cutpos' || id === 'cutrange') t = v / 100;
  else { var k = {cutx:0, cuty:1, cutz:2}[id], ext = g.cb[k] - g.ca[k]; if (Math.abs(ext) < 1e-9) return; t = (v - g.ca[k]) / ext; }
  if (!isFinite(t)) return;
  S.cutPos = Math.min(99, Math.max(1, +(t * 100).toFixed(8)));
  var c = cutAt(g, S.cutPos / 100), upd = {cutpos:fmt(S.cutPos, 4), cutrange:S.cutPos, cutx:fmt(c[0], 6), cuty:fmt(c[1], 6), cutz:fmt(c[2], 6)};
  for (var k2 in upd) { var el = $('#' + k2); if (el && k2 !== id) el.value = upd[k2]; }
  requestDraw();
}

// dashed preview of the cut on the graph
function drawCutPreview(ctx, col){
  if (S.mode !== 'line') return;
  var l = S.lines.filter(function(x){ return x.id === S.selLine; })[0], g = cutGeom(l);
  if (!g || S.cutFor !== l.id) return;
  var rnd = (l.ta === 'r' || l.tb === 'r'), gap = S.cutGap || 0;
  var ts = gap > 0 ? [S.cutPos / 100 - gap / 2 / g.len, S.cutPos / 100 + gap / 2 / g.len] : [S.cutPos / 100];
  var da = g.le.na.k === 'r' ? g.le.na.o.d : 0, db = g.le.nb.k === 'r' ? g.le.nb.o.d : 0;
  var plane = g.le.na.k === 'r' ? g.le.na.o.plane : g.le.nb.o.plane;
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]); ctx.globalAlpha = 1;
  ts.forEach(function(t){
    var c = cutAt(g, t), q = proj(c[0], c[1], c[2]), i, a;
    if (rnd) {
      var rad = (da + (db - da) * t) / 2, pts = [];
      for (i = 0; i <= 72; i++) { a = 2 * Math.PI * i / 72; pts.push(plane === 'xz' ? proj(c[0] + rad * Math.cos(a), c[1], c[2] + rad * Math.sin(a)) : plane === 'yz' ? proj(c[0], c[1] + rad * Math.cos(a), c[2] + rad * Math.sin(a)) : proj(c[0] + rad * Math.cos(a), c[1] + rad * Math.sin(a), c[2])); }
      ctx.beginPath(); pts.forEach(function(p, j){ if (j) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.stroke();
    } else {
      var q2 = proj(c[0] + (g.cb[1] - g.ca[1]) / g.len * 0.15, c[1] - (g.cb[0] - g.ca[0]) / g.len * 0.15, c[2]), q3 = proj(c[0] - (g.cb[1] - g.ca[1]) / g.len * 0.15, c[1] + (g.cb[0] - g.ca[0]) / g.len * 0.15, c[2]);
      ctx.beginPath(); ctx.moveTo(q2.x, q2.y); ctx.lineTo(q3.x, q3.y); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, 6.283); ctx.fill(); ctx.setLineDash([6, 4]);
  });
  var m = proj.apply(null, cutAt(g, S.cutPos / 100));
  ctx.setLineDash([]); ctx.font = '700 13px sans-serif'; ctx.fillText('\u2702 cut', m.x + 10, m.y - 10);
  ctx.restore();
}

function num(v, d){ var x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : d; }

function cutLine(){
  var l = S.lines.filter(function(x){ return x.id === S.selLine; })[0];
  var le = l && lineEnds(l);
  if (!le || le.na.o.type === 'sphere' || le.nb.o.type === 'sphere') return;
  var pos = S.cutFor === l.id ? S.cutPos : 50, gap = Math.max(0, S.cutGap || 0);
  S.cutPos = pos; S.cutGap = gap;
  if (!(pos > 0 && pos < 100)) { S.msg = 'Cut position must be between 0 and 100 %.'; S.bad = true; renderPanel(); return; }
  var ca = nodePos(le.na), cb = nodePos(le.nb), len = Math.hypot(cb[0] - ca[0], cb[1] - ca[1], cb[2] - ca[2]);
  if (!(len > 0)) { S.msg = 'These two are at the same place, nothing to cut.'; S.bad = true; renderPanel(); return; }
  if (gap >= len * Math.min(pos, 100 - pos) / 50) { S.msg = 'Gap is too big for this line.'; S.bad = true; renderPanel(); return; }
  var round = (l.ta === 'r' || l.tb === 'r');
  var t1 = pos / 100 - gap / 2 / len, t2 = pos / 100 + gap / 2 / len;
  function lerp(t){ return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]; }
  function rr(v){ return +v.toFixed(10); }
  var n1, n2, k = round ? 'r' : 'p';
  if (round) {
    var da = le.na.k === 'r' ? le.na.o.d : 0, db = le.nb.k === 'r' ? le.nb.o.d : 0;
    var plane = le.na.k === 'r' ? le.na.o.plane : le.nb.o.plane;
    var mkR = function(t){
      var c = lerp(t), r = newRound();
      r.id = S.nextRound++; r.cx = rr(c[0]); r.cy = rr(c[1]); r.cz = rr(c[2]); r.d = rr(da + (db - da) * t); r.plane = plane;
      S.rounds.push(r); return r;
    };
    n1 = mkR(t1); n2 = mkR(t2);
  } else {
    var mkP = function(t){
      var c = lerp(t), p = {id:S.nextId++, name:nextName(), x:rr(c[0]), y:rr(c[1]), z:rr(c[2])};
      S.points.push(p); return p;
    };
    n1 = mkP(t1); n2 = mkP(t2);
  }
  var l1 = {id:S.nextLine++, a:l.a, b:n1.id, ta:l.ta || 'p', tb:k}, l2 = {id:S.nextLine++, a:n2.id, b:l.b, ta:k, tb:l.tb || 'p'};
  S.lines = S.lines.filter(function(x){ return x.id !== l.id; }); S.lines.push(l1, l2);
  S.shapes.forEach(function(sh){
    if (sh.items.some(function(i){ return i.k === 'l' && i.id === l.id; })) {
      sh.items = sh.items.filter(function(i){ return !(i.k === 'l' && i.id === l.id); });
      sh.items.push({k:'l', id:l1.id}, {k:'l', id:l2.id}, {k:k, id:n1.id}, {k:k, id:n2.id});
    }
  });
  S.selLine = null; S.mode = 'idle'; S.bad = false;
  S.msg = 'Cut done: ' + le.na.o.name + '—' + n1.name + '   ' + n2.name + '—' + le.nb.o.name + (round ? '  (new circles ' + n1.name + ', ' + n2.name + ')' : '') + '.';
  save(); renderPanel(); requestDraw();
}

// the card that shows after you tap a line (or a cone / cylinder surface)
function lineHTML(){
  var l = S.lines.filter(function(x){ return x.id === S.selLine; })[0], le = l && lineEnds(l);
  if (l && le) {
    return '<div class="lineinfo"><span class="lbl">Selected line</span><span class="big">' + esc(le.na.o.name) + ' — ' + esc(le.nb.o.name) + '</span><span class="note">Length ' + fmt(lineLen(l),6) + ' m</span></div>' +
      cutHTML(l) + lineMoveHTML(l) +
      '<div class="actions"><button class="btn danger" type="button" data-act="removeline">Remove line</button><button class="btn" type="button" data-act="closeline">Close</button></div>';
  }
  S.mode = 'idle';
  return null;
}

MODES.connect = {
  modes: ['connect', 'line'],
  html: function(){ return S.mode === 'line' ? lineHTML() : connectHTML(); },
  click: function(act, t){
    if (act === 'connect') { S.conn.a = $('#ca').value; S.conn.b = $('#cb').value; doConnect(); }
    else if (act === 'removeline') {
      S.lines = S.lines.filter(function(l){ return l.id !== S.selLine; });
      S.selLine = null; S.mode = 'idle'; S.msg = 'Line removed.'; S.bad = false; save(); renderPanel(); requestDraw();
    }
    else if (act === 'cutline') cutLine();
    else if (act === 'lmv') moveLine(t.getAttribute('data-a'), +t.getAttribute('data-s'));
    else if (act === 'closeline') { S.selLine = null; S.mode = 'idle'; renderPanel(); requestDraw(); }
    else return false;
    return true;
  },
  input: function(t){
    if (t.id === 'ca') { S.conn.a = t.value; requestDraw(); return true; }
    if (S.mode === 'line') {
      if (t.id === 'cutgap') { S.cutGap = Math.max(0, num(t.value, 0)); requestDraw(); return true; }
      if (t.id === 'cutpos' || t.id === 'cutrange' || t.id === 'cutx' || t.id === 'cuty' || t.id === 'cutz') { setCut(t, t.id); return true; }
      if (t.id === 'mvstep') return true;
    }
    if (t.id === 'cb') { S.conn.b = t.value; requestDraw(); return true; }
    return false;
  },
  change: function(t){
    if (S.mode === 'line' && t.id === 'mvstep') { var v = parseFloat(String(t.value).replace(',', '.')); S.moveStep = isFinite(v) && v > 0 ? v : 0.1; return true; }
    return false;
  },
  key: function(e){
    var t = e.target;
    if (e.key === 'Enter' && (t.id === 'ca' || t.id === 'cb')) { e.preventDefault(); S.conn.a = $('#ca').value; S.conn.b = $('#cb').value; doConnect(); return true; }
    return false;
  }
};
