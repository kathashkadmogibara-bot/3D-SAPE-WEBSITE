/* shape.js: the "Shape" button. Group points, circles and lines; it names the shape and gives area, volume and perimeter. */

function shapeColorFor(sh){ return sh.color || SH_COLORS[(sh.id - 1 + 8) % 8]; }

function newShDraft(){
  var used = S.shapes.map(shapeColorFor), c = SH_COLORS.filter(function(x){ return used.indexOf(x) < 0; })[0] || SH_COLORS[S.shapes.length % 8];
  return {id:-1, custom:'', items:[], color:c};
}

function dotHTML(c){ return '<i class="dot" style="background:' + c + '"></i>'; }

function d3(a, b){ return Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]); }

function triArea(a, b, c){
  var ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2], vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
  return 0.5 * Math.hypot(uy*vz - uz*vy, uz*vx - ux*vz, ux*vy - uy*vx);
}

function planeN(r){ return r.plane === 'xz' ? [0,1,0] : r.plane === 'yz' ? [1,0,0] : [0,0,1]; }

function dotv(a, b){ return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }

function axisSplit(pt, r){
  var v = [pt[0]-r.cx, pt[1]-r.cy, pt[2]-r.cz], n = planeN(r), h = dotv(v, n);
  return {h: Math.abs(h), off: Math.hypot(v[0]-h*n[0], v[1]-h*n[1], v[2]-h*n[2])};
}


function quadKind(v){
  var sd = [d3(v[0],v[1]), d3(v[1],v[2]), d3(v[2],v[3]), d3(v[3],v[0])], g1 = d3(v[0],v[2]), g2 = d3(v[1],v[3]);
  var tol = 1e-7 * Math.max(1, sd[0], sd[1], sd[2], sd[3]);
  function eq(a, b){ return Math.abs(a - b) <= tol; }
  var opp = eq(sd[0], sd[2]) && eq(sd[1], sd[3]), dg = eq(g1, g2), all = eq(sd[0], sd[1]) && eq(sd[1], sd[2]) && eq(sd[2], sd[3]);
  if (all && dg) return 'square';
  if (opp && dg) return 'rectangle';
  if (all) return 'rhombus';
  if (opp) return 'parallelogram';
  function par(a, b, c, d){
    var u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], w = [d[0]-c[0], d[1]-c[1], d[2]-c[2]];
    var cr = [u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0]];
    return Math.hypot(cr[0], cr[1], cr[2]) <= 1e-7 * Math.hypot(u[0], u[1], u[2]) * Math.hypot(w[0], w[1], w[2]);
  }
  if (par(v[0], v[1], v[3], v[2]) || par(v[1], v[2], v[0], v[3])) return 'trapezium';
  return 'quadrilateral';
}

function triKind(v){
  var a = d3(v[1],v[2]), b = d3(v[0],v[2]), c = d3(v[0],v[1]), tol = 1e-7 * Math.max(1, a, b, c);
  var q = [a, b, c].sort(function(x, y){ return x - y; });
  if (Math.abs(a-b) <= tol && Math.abs(b-c) <= tol) return 'Equilateral triangle';
  if (Math.abs(q[0]*q[0] + q[1]*q[1] - q[2]*q[2]) <= 1e-7 * q[2]*q[2]) return 'Right triangle';
  if (Math.abs(a-b) <= tol || Math.abs(b-c) <= tol || Math.abs(a-c) <= tol) return 'Isosceles triangle';
  return 'Triangle';
}

function cap(w){ return w.charAt(0).toUpperCase() + w.slice(1); }

function hullType(H, list){
  var nf = H.faces.length;
  if (!nf) return 'Line';
  function V(f){ return f.idx.map(function(i){ return [list[i].x, list[i].y, list[i].z]; }); }
  if (H.flat) {
    var v = V(H.faces[0]);
    if (v.length === 3) return triKind(v);
    if (v.length === 4) return cap(quadKind(v));
    return 'Polygon (' + v.length + ' sides)';
  }
  var tri = 0, quad = 0, quadV = null, kinds = [], areas = [];
  H.faces.forEach(function(f){
    var fv = V(f);
    if (fv.length === 3) tri++;
    else if (fv.length === 4) { quad++; quadV = fv; kinds.push(quadKind(fv)); areas.push(f.area); }
  });
  if (nf === 4 && tri === 4) {
    var ev = V(H.faces[0]).concat(V(H.faces[1])), e0 = d3(ev[0], ev[1]), reg = H.faces.every(function(f){
      var fv = V(f); return Math.abs(d3(fv[0],fv[1]) - e0) < 1e-7*Math.max(1,e0) && Math.abs(d3(fv[1],fv[2]) - e0) < 1e-7*Math.max(1,e0) && Math.abs(d3(fv[2],fv[0]) - e0) < 1e-7*Math.max(1,e0);
    });
    return reg ? 'Regular tetrahedron' : 'Tetrahedron';
  }
  if (nf === 6 && quad === 6) {
    var allSq = kinds.every(function(k){ return k === 'square'; }), eqA = areas.every(function(a){ return Math.abs(a - areas[0]) < 1e-7*Math.max(1, areas[0]); });
    if (allSq && eqA) return 'Cube';
    if (kinds.every(function(k){ return k === 'square' || k === 'rectangle'; })) return 'Cuboid';
    return 'Hexahedron';
  }
  if (nf === 5 && quad === 1 && tri === 4) return quadKind(quadV) === 'square' ? 'Square pyramid' : 'Pyramid';
  if (nf === 5 && quad === 3 && tri === 2) return 'Triangular prism';
  return 'Polyhedron (' + nf + ' faces)';
}


function itemExists(it){
  return it.k === 'p' ? !!P(it.id) : it.k === 'r' ? S.rounds.some(function(r){ return r.id === it.id; }) : S.lines.some(function(l){ return l.id === it.id; });
}

function inDraft(k, id){
  return !!(S.shDraft && S.shDraft.items.some(function(i){ return i.k === k && i.id === id; }));
}

function toggleItem(k, id){
  if (!S.shDraft) return;
  var its = S.shDraft.items, ix = -1;
  its.forEach(function(i, n){ if (i.k === k && i.id === id) ix = n; });
  if (ix >= 0) its.splice(ix, 1); else its.push({k:k, id:id});
  S.msg = ''; renderPanel(); requestDraw();
}

function expandItems(items){
  var pts = [], rds = [], lns = [];
  function addP(o){ if (o && pts.indexOf(o) < 0) pts.push(o); }
  function addR(o){ if (o && rds.indexOf(o) < 0) rds.push(o); }
  items.forEach(function(it){
    if (it.k === 'p') addP(P(it.id));
    else if (it.k === 'r') addR(S.rounds.filter(function(r){ return r.id === it.id; })[0]);
    else {
      var l = S.lines.filter(function(x){ return x.id === it.id; })[0];
      if (!l) return;
      if (lns.indexOf(l) < 0) lns.push(l);
      var e = lineEnds(l);
      if (e) [e.na, e.nb].forEach(function(n){ if (n.k === 'p') addP(n.o); else addR(n.o); });
    }
  });
  return {pts:pts, rds:rds, lns:lns};
}


function shapeMetrics(items){
  var X = expandItems(items), PI = Math.PI, N = 1440, i, j;
  var faces = [], vol = 0, volKnown = true, notes = [], types = [];
  var cones = [], frusta = [], usage = {}, apexes = [];
  X.lns.forEach(function(l){
    var sf = lineSurface(l); if (!sf) return;
    if (sf.t === 'cone') { cones.push(sf); apexes.push(sf.apex); usage[sf.base.id] = (usage[sf.base.id] || 0) + 1; }
    else { frusta.push(sf); usage[sf.r1.id] = (usage[sf.r1.id] || 0) + 1; usage[sf.r2.id] = (usage[sf.r2.id] || 0) + 1; }
  });

  cones.forEach(function(c){
    var b = c.base, ap = c.apex, A = [ap.x, ap.y, ap.z], R = b.d / 2, sp = axisSplit(A, b), lat;
    if (sp.off < 1e-9 * Math.max(1, R, sp.h)) lat = PI * R * Math.hypot(sp.h, R);
    else { var rim = rimWorld(b, N); lat = 0; for (i = 0; i < N; i++) lat += triArea(A, rim[i], rim[(i + 1) % N]); }
    faces.push({name:'Curved side (' + ap.name + ' → ' + b.name + ')', area:lat});
    vol += PI * R * R * sp.h / 3;
  });
  frusta.forEach(function(f){
    var r1 = f.r1, r2 = f.r2, R1 = r1.d / 2, R2 = r2.d / 2, lat, label = Math.abs(R1 - R2) < 1e-9 * Math.max(1, R1) ? 'cylinder' : 'frustum';
    if (r1.plane === r2.plane) {
      var sp = axisSplit([r2.cx, r2.cy, r2.cz], r1);
      if (sp.off < 1e-9 * Math.max(1, R1, R2, sp.h)) lat = PI * (R1 + R2) * Math.hypot(sp.h, R1 - R2);
      else {
        var a1 = rimWorld(r1, N), a2 = rimWorld(r2, N); lat = 0;
        for (i = 0; i < N; i++) { j = (i + 1) % N; lat += triArea(a1[i], a1[j], a2[i]) + triArea(a1[j], a2[j], a2[i]); }
      }
      vol += PI * sp.h * (R1 * R1 + R1 * R2 + R2 * R2) / 3;
    } else {
      var b1 = rimWorld(r1, N), b2 = rimWorld(r2, N); lat = 0;
      for (i = 0; i < N; i++) { j = (i + 1) % N; lat += triArea(b1[i], b1[j], b2[i]) + triArea(b1[j], b2[j], b2[i]); }
      volKnown = false; notes.push('Volume needs both circles in the same plane.');
    }
    faces.push({name:'Curved side (' + r1.name + ' ↔ ' + r2.name + ')', area:lat});
    f.label = label;
  });
  // circles / spheres: faces
  X.rds.forEach(function(r){
    var rad = r.d / 2;
    if (r.type === 'sphere') { faces.push({name:'Surface (' + r.name + ')', area:4 * PI * rad * rad}); vol += 4 / 3 * PI * rad * rad * rad; }
    else if ((usage[r.id] || 0) <= 1) faces.push({name:'Circle face (' + r.name + ')', area:PI * rad * rad});
  });
  // loose points -> polygon / polyhedron
  var loose = X.pts.filter(function(q){ return apexes.indexOf(q) < 0; }), H = null, hullName = '';
  var perim = 0, edgeSet = {};
  if (loose.length >= 3) {
    H = hull(loose.map(function(q){ return [q.x, q.y, q.z]; }));
    if (H.faces.length) {
      hullName = hullType(H, loose);
      if (H.flat) faces.push({name:'Flat face', area:H.area});
      else H.faces.forEach(function(f, n){ faces.push({name:'Side ' + (n + 1) + ' (' + f.idx.length + ' corners)', area:f.area}); });
      vol += H.volume;
      H.faces.forEach(function(f){
        for (i = 0; i < f.idx.length; i++) {
          var a = f.idx[i], b2 = f.idx[(i + 1) % f.idx.length], key = Math.min(a, b2) + '_' + Math.max(a, b2);
          if (!edgeSet[key]) { edgeSet[key] = 1; perim += len(loose[a], loose[b2]); }
        }
      });
    }
  }
  if (!H || !H.faces.length) {
    X.lns.forEach(function(l){ if (!lineSurface(l)) { var e = lineEnds(l); if (e && e.na.k === 'p' && e.nb.k === 'p') perim += lineLen(l); } });
  }
  X.rds.forEach(function(r){ perim += PI * r.d; });

  // name
  if (cones.length) {
    var bases = {}; cones.forEach(function(c){ bases[c.base.id] = 1; });
    types.push(cones.length === 1 ? 'Cone' : (Object.keys(bases).length === 1 ? 'Double cone' : cones.length + ' cones'));
  }
  if (frusta.length) types.push(frusta.length === 1 ? cap(frusta[0].label) : frusta.length + ' cylinders / frustums');
  var free = X.rds.filter(function(r){ return !usage[r.id]; });
  free.forEach(function(r){ types.push(r.type === 'sphere' ? 'Sphere' : 'Circle'); });
  if (hullName) types.push(hullName);
  else if (loose.length === 2 || (X.pts.length === 2 && !cones.length)) types.push('Line');
  else if (loose.length === 1 && !cones.length && !X.rds.length) types.push('Point');
  var type = types.length ? types.join(' + ') : 'Empty';

  // longest span
  var samples = [], diam = 0;
  X.pts.forEach(function(q){ samples.push([q.x, q.y, q.z]); });
  X.rds.forEach(function(r){
    if (r.type === 'circle') rimWorld(r, 72).forEach(function(w){ samples.push(w); });
    else {
      var rr = r.d / 2, k = 0.57735 * rr, dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
      dirs.forEach(function(v){ samples.push([r.cx + v[0] * rr, r.cy + v[1] * rr, r.cz + v[2] * rr]); });
      [-1, 1].forEach(function(a){ [-1, 1].forEach(function(b){ [-1, 1].forEach(function(c){ samples.push([r.cx + a * k, r.cy + b * k, r.cz + c * k]); }); }); });
    }
  });
  if (X.pts.length === 0 && X.rds.length === 1) diam = X.rds[0].d;
  else for (i = 0; i < samples.length; i++) for (j = i + 1; j < samples.length; j++) diam = Math.max(diam, d3(samples[i], samples[j]));

  var area = faces.reduce(function(t, f){ return t + f.area; }, 0);
  return {type:type, faces:faces, area:area, vol:volKnown ? vol : null, perim:perim, diam:diam, notes:notes, empty:!X.pts.length && !X.rds.length};
}


function rowHTML(label, val, unit, strong){
  return '<div class="rrow' + (strong ? ' strong' : '') + '"><span>' + esc(label) + '</span><b>' + val + ' <i>' + unit + '</i></b></div>';
}

function metricsHTML(m, compact){
  if (m.empty) return '<p class="note">Pick at least one point, circle or line.</p>';
  var h = '', faceRows = m.faces.slice(0, 12).map(function(f){ return rowHTML(f.name, fmt(f.area,4), 'm²'); }).join('') +
    (m.faces.length > 12 ? '<p class="note">+ ' + (m.faces.length - 12) + ' more sides</p>' : '');
  if (m.faces.length) {
    if (m.faces.length === 1) h += rowHTML('Area (one side)', fmt(m.area,4), 'm²', true);
    else {
      h += rowHTML('Area (all sides)', fmt(m.area,4), 'm²', true);
      h += compact ? '<details><summary>Area of each side</summary>' + faceRows + '</details>' : '<div class="lbl" style="padding-top:8px">Area of each side</div>' + faceRows;
    }
  } else h += rowHTML('Area', '0', 'm²', true);
  h += rowHTML('Volume', m.vol == null ? '—' : fmt(m.vol,4), 'm³', true);
  h += rowHTML('Perimeter', fmt(m.perim,4), 'm');
  h += rowHTML('Diameter (longest span)', fmt(m.diam,4), 'm');
  return h + m.notes.map(function(n){ return '<p class="note bad">' + esc(n) + '</p>'; }).join('');
}

function draftName(d, m){ return d.custom.trim() || (m.empty ? 'Shape name' : m.type); }

function shapeResHTML(){
  var d = S.shDraft, m = shapeMetrics(d.items);
  return '<div class="rcard"><div class="rhead"><b>' + dotHTML(d.color) + esc(draftName(d, m)) + '</b><span>' + (m.empty ? '' : esc(m.type)) + '</span></div>' + metricsHTML(m, false) + '</div>';
}

function refreshShapeRes(){
  var el = $('#shres'), d = S.shDraft; if (!el || !d) return;
  el.innerHTML = shapeResHTML();
  var inp = $('#shn'); if (inp) inp.placeholder = draftName({custom:''}, shapeMetrics(d.items));
}

function saveShape(){
  var d = S.shDraft; if (!d) return;
  if (!d.items.length) { showErr('Pick at least one point, circle or line.'); return; }
  var m = shapeMetrics(d.items), custom = d.custom.trim(), base = custom || m.type, name = base, k = 1;
  function taken(n){ return S.shapes.some(function(x){ return x.id !== d.id && x.name.toLowerCase() === n.toLowerCase(); }); }
  if (custom && taken(custom)) { showErr('This shape name is already used.'); return; }
  while (!custom && taken(name)) { k++; name = base + ' ' + k; }
  var ex = d.id > 0 ? S.shapes.filter(function(x){ return x.id === d.id; })[0] : null;
  if (ex) { ex.name = name; ex.auto = !custom; ex.items = d.items.slice(); ex.color = d.color; }
  else S.shapes.push({id:S.nextShape++, name:name, auto:!custom, items:d.items.slice(), color:d.color});
  S.shDraft = newShDraft();
  S.msg = 'Saved "' + name + '".'; S.bad = false; save(); renderPanel(); requestDraw();
}

function itemChips(){
  function chip(k, id, label){
    return '<button class="chip" type="button" data-act="titem" data-k="' + k + '" data-id="' + id + '" aria-pressed="' + inDraft(k, id) + '">' + esc(label) + '</button>';
  }
  var h = '';
  if (S.points.length) h += '<div class="field"><span class="lbl">Points</span></div><div class="seg">' + S.points.slice(0, 60).map(function(q){ return chip('p', q.id, q.name); }).join('') + '</div>';
  if (S.rounds.length) h += '<div class="field"><span class="lbl">Circles / spheres</span></div><div class="seg">' + S.rounds.map(function(r){ return chip('r', r.id, r.name); }).join('') + '</div>';
  if (S.lines.length) h += '<div class="field"><span class="lbl">Lines</span></div><div class="seg">' + S.lines.slice(0, 80).map(function(l){
    var e = lineEnds(l); return e ? chip('l', l.id, e.na.o.name + '—' + e.nb.o.name) : '';
  }).join('') + '</div>';
  return h;
}

function shapeById(id){ return S.shapes.filter(function(x){ return x.id === id; })[0]; }

function shiftItems(items, dx, dy, dz){
  var ex = expandItems(items), d = {x:dx, y:dy, z:dz};
  ex.pts.forEach(function(p){ ['x','y','z'].forEach(function(a){ p[a] = +(p[a] + d[a]).toFixed(10); }); });
  ex.rds.forEach(function(r){ r.cx = +(r.cx + dx).toFixed(10); r.cy = +(r.cy + dy).toFixed(10); r.cz = +(r.cz + dz).toFixed(10); });
  save(); renderPanel(); requestDraw();
}

function draftMoveHTML(){
  var st = S.moveStep == null ? 0.1 : S.moveStep;
  function b(a, sg){ return '<button class="chip mv-' + a + '" type="button" data-act="shmv" data-a="' + a + '" data-s="' + sg + '">' + a.toUpperCase() + (sg > 0 ? ' +' : ' \u2212') + '</button>'; }
  function f(a){ return '<div class="field"><label for="md' + a + '">' + a.toUpperCase() + '</label><input class="txt" id="md' + a + '" type="text" inputmode="decimal" autocomplete="off" value="0"></div>'; }
  return '<div class="mvbox"><span class="lbl">Move this shape</span>' +
    '<div class="note">Type how far to move in X, Y, Z (m) and press Move. Or use the step buttons.</div>' +
    '<div class="mvxyz">' + f('x') + f('y') + f('z') + '</div>' +
    '<button class="btn primary" type="button" data-act="shmvc">Move</button>' +
    '<label class="lbl" for="mvstep">Step for buttons (m)</label>' +
    '<input class="val" id="mvstep" type="text" inputmode="decimal" autocomplete="off" value="' + st + '" aria-label="Move step">' +
    '<div class="mvgrid">' + b('x',-1) + b('x',1) + b('y',-1) + b('y',1) + b('z',-1) + b('z',1) + '</div></div>';
}

function cutShape(id){
  var sh = shapeById(id); if (!sh) return;
  var ex = expandItems(sh.items), n = ex.lns.length + ex.pts.length + ex.rds.length;
  var lset = ex.lns.map(function(l){ return l.id; });
  S.lines = S.lines.filter(function(l){ return lset.indexOf(l.id) < 0; });
  var pset = ex.pts.map(function(p){ return p.id; }).filter(function(i){ return i !== 1; });
  var rset = ex.rds.map(function(r){ return r.id; });
  // also drop anything still attached to a removed node
  S.lines = S.lines.filter(function(l){
    return !(((l.ta || 'p') === 'p' && pset.indexOf(l.a) >= 0) || ((l.tb || 'p') === 'p' && pset.indexOf(l.b) >= 0) || (l.ta === 'r' && rset.indexOf(l.a) >= 0) || (l.tb === 'r' && rset.indexOf(l.b) >= 0));
  });
  S.points = S.points.filter(function(p){ return pset.indexOf(p.id) < 0; });
  S.rounds = S.rounds.filter(function(r){ return rset.indexOf(r.id) < 0; });
  S.shapes = S.shapes.filter(function(x){ return x.id !== id; }); delete S.shSum[id];
  if (S.moveId === id) S.moveId = null;
  if (S.shDraft && S.shDraft.id === id) S.shDraft = newShDraft();
  S.msg = 'Shape cut (' + n + ' parts removed).';
  save(); renderPanel(); requestDraw();
}

function savedHTML(){
  if (!S.shapes.length) return '';
  var tot = {area:0, vol:0, per:0, n:0};
  var cards = S.shapes.map(function(sh){
    var m = shapeMetrics(sh.items), on = !!S.shSum[sh.id];
    if (on) { tot.n++; tot.area += m.area; tot.vol += m.vol || 0; tot.per += m.perim; }
    return '<div class="rcard"><div class="rhead"><b>' + dotHTML(shapeColorFor(sh)) + esc(sh.name) + '</b><span>' + esc(m.type) + '</span></div>' + metricsHTML(m, true) +
      '<div class="actions3"><button class="chip" type="button" data-act="shsum" data-id="' + sh.id + '" aria-pressed="' + on + '">Add to total</button>' +
      '<button class="chip" type="button" data-act="shcyc" data-id="' + sh.id + '">Colour</button>' +
      '<button class="chip" type="button" data-act="shedit" data-id="' + sh.id + '">Edit</button>' +
      '<button class="chip" type="button" data-act="shedit" data-id="' + sh.id + '">Move</button>' +
      '<button class="chip" type="button" data-act="shcut" data-id="' + sh.id + '">Remove all</button>' +
      '<button class="chip" type="button" data-act="shdel" data-id="' + sh.id + '">Delete</button></div>' + '</div>';
  }).join('');
  var total = tot.n ? '<div class="rcard"><div class="rhead"><b>Total</b><span>' + tot.n + (tot.n === 1 ? ' shape' : ' shapes') + ' added</span></div>' +
    rowHTML('Area (all sides)', fmt(tot.area,4), 'm²', true) + rowHTML('Volume', fmt(tot.vol,4), 'm³', true) + rowHTML('Perimeter', fmt(tot.per,4), 'm') + '</div>' : '';
  return '<div class="field"><span class="lbl">Saved shapes</span></div>' + cards + total;
}


function shapeHTML(){
  var sd = S.shDraft || (S.shDraft = newShDraft());
  return noteHTML() +
    '<div class="field"><label for="shn">Shape name</label><input class="txt" id="shn" type="text" maxlength="24" autocomplete="off" spellcheck="false" placeholder="' + esc(draftName({custom:''}, shapeMetrics(sd.items))) + '" value="' + esc(sd.custom) + '"></div>' +
    '<div class="field"><span class="lbl">Colour</span></div><div class="seg">' + SH_COLORS.map(function(c, i){
      return '<button class="sw" type="button" data-act="shcolor" data-v="' + i + '" aria-pressed="' + (sd.color === c) + '" aria-label="Colour ' + (i + 1) + '" style="background:' + c + '"></button>';
    }).join('') + '</div>' +
    '<p class="note">Tap points, circles or lines on the graph, or pick them here. The shape name comes by itself.</p>' +
    itemChips() +
    (sd.items.length ? draftMoveHTML() : '') +
    '<div id="shres">' + shapeResHTML() + '</div>' +
    '<p class="err" id="err" hidden></p>' +
    '<div class="actions"><button class="btn primary" type="button" data-act="shsave">' + (sd.id > 0 ? 'Save changes' : 'Save shape') + '</button><button class="btn" type="button" data-act="shclear">Clear</button></div>' +
    savedHTML();
}

MODES.shape = {
  modes: ['shape'],
  html: shapeHTML,
  click: function(act, t){
    if (act === 'titem') toggleItem(t.getAttribute('data-k'), +t.getAttribute('data-id'));
    else if (act === 'shcolor') { if (S.shDraft) { S.shDraft.color = SH_COLORS[+t.getAttribute('data-v')] || S.shDraft.color; renderPanel(); requestDraw(); } }
    else if (act === 'shcyc') {
      var sc = S.shapes.filter(function(x){ return x.id === +t.getAttribute('data-id'); })[0];
      if (sc) { sc.color = SH_COLORS[(SH_COLORS.indexOf(shapeColorFor(sc)) + 1) % SH_COLORS.length]; save(); renderPanel(); requestDraw(); }
    }
    else if (act === 'shsave') saveShape();
    else if (act === 'shclear') { if (S.shDraft) { S.shDraft = newShDraft(); S.msg = ''; renderPanel(); requestDraw(); } }
    else if (act === 'shsum') { var sid = +t.getAttribute('data-id'); S.shSum[sid] = !S.shSum[sid]; renderPanel(); }
    else if (act === 'shedit') {
      var se = S.shapes.filter(function(x){ return x.id === +t.getAttribute('data-id'); })[0];
      if (se) { S.shDraft = {id:se.id, custom:se.auto ? '' : se.name, items:se.items.map(function(i){ return {k:i.k, id:i.id}; }), color:shapeColorFor(se)}; S.msg = ''; renderPanel(); requestDraw(); }
    }
    else if (act === 'shmv') { if (S.shDraft) { var ax = t.getAttribute('data-a'), dd = (S.moveStep == null ? 0.1 : S.moveStep) * +t.getAttribute('data-s'); shiftItems(S.shDraft.items, ax === 'x' ? dd : 0, ax === 'y' ? dd : 0, ax === 'z' ? dd : 0); } }
    else if (act === 'shmvc') { if (S.shDraft) { var g = function(i){ var v = parseFloat(String($(i).value).replace(',', '.')); return isFinite(v) ? v : 0; }; shiftItems(S.shDraft.items, g('#mdx'), g('#mdy'), g('#mdz')); } }
    else if (act === 'shcut') cutShape(+t.getAttribute('data-id'));
    else if (act === 'shdel') {
      var did = +t.getAttribute('data-id');
      S.shapes = S.shapes.filter(function(x){ return x.id !== did; }); delete S.shSum[did];
      if (S.shDraft && S.shDraft.id === did) S.shDraft = newShDraft();
      save(); renderPanel(); requestDraw();
    }
    else return false;
    return true;
  },
  input: function(t){
    if (t.id === 'mdx' || t.id === 'mdy' || t.id === 'mdz') return true;
    if (t.id === 'shn' && S.shDraft) { S.shDraft.custom = t.value; refreshShapeRes(); return true; }
    return false;
  },
  change: function(t){
    if (t.id === 'mvstep') { var v = parseFloat(String(t.value).replace(',', '.')); S.moveStep = isFinite(v) && v > 0 ? v : 0.1; renderPanel(); return true; }
    return false;
  },
  key: function(e){
    if (e.key === 'Enter' && e.target.id === 'mvstep') { e.preventDefault(); e.target.blur(); return true; }
    if (e.key === 'Enter' && e.target.id === 'shn') { e.preventDefault(); e.target.blur(); return true; }
    return false;
  }
};
