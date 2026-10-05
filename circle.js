/* circle.js: the "Circle / Sphere" button. A circle or sphere is made from its diameter, so it is always perfectly round. */

function rcur(){ return S.rdraft || S.reditng; }

function allRounds(){ return S.rdraft ? S.rounds.concat([S.rdraft]) : S.rounds; }

function newRound(){
  var k = 1, n;
  do { n = 'O' + k++; } while (findNode(n));
  return {id:-1, type:'circle', name:n, d:1, cx:0, cy:0, cz:0, plane:'xy'};
}

function roundNameErr(name, self){
  name = name.trim();
  if (!name) return 'Name cannot be empty.';
  return (S.rounds.some(function(r){ return r !== self && r.name.toLowerCase() === name.toLowerCase(); }) || S.points.some(function(q){ return q.name.toLowerCase() === name.toLowerCase(); })) ? 'This name is already used.' : '';
}

function roundRead(r){
  var PI = Math.PI, d = r.d, rad = d / 2;
  return r.type === 'circle'
    ? [['Diameter', d, 'm'], ['Radius', rad, 'm'], ['Circumference', PI*d, 'm'], ['Area', PI*rad*rad, 'm²']]
    : [['Diameter', d, 'm'], ['Radius', rad, 'm'], ['Circumference', PI*d, 'm'], ['Surface area', 4*PI*rad*rad, 'm²'], ['Volume', 4/3*PI*rad*rad*rad, 'm³']];
}

function readHTML(r){
  return roundRead(r).map(function(x){ return '<div class="rrow"><span>' + x[0] + '</span><b>' + fmt(x[1],4) + ' <i>' + x[2] + '</i></b></div>'; }).join('');
}

function roundsHTML(){
  return S.rounds.map(function(r){
    return '<div class="rcard"><div class="rhead"><b>' + esc(r.name) + '</b><span>' + (r.type === 'circle' ? 'Circle' : 'Sphere') + '</span></div>' + readHTML(r) + '</div>';
  }).join('');
}

function roundChip(r){
  return '<button class="pt" type="button" data-act="pickr" data-id="' + r.id + '"><b>' + esc(r.name) + '</b><span>' + (r.type === 'circle' ? 'Circle' : 'Sphere') + ' Ø ' + fmt(r.d,3) + '</span></button>';
}

function roundEditorHTML(r, isNew){
  var isC = r.type === 'circle', dmax = 2 * S.range;
  return '<div class="seg"><button class="chip" type="button" data-act="rtype" data-v="circle" aria-pressed="' + isC + '">Circle</button>' +
    '<button class="chip" type="button" data-act="rtype" data-v="sphere" aria-pressed="' + (!isC) + '">Sphere</button></div>' +
    '<div class="field"><label for="r-name">Name</label><input class="txt" id="r-name" type="text" maxlength="16" autocomplete="off" spellcheck="false" value="' + esc(r.name) + '"></div>' +
    '<div class="axis" style="--axc:var(--accent)"><div class="axtop"><span class="axl" style="width:auto;padding:0 9px" title="Diameter">Ø</span>' +
    '<input class="val" id="r-d" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="Diameter in metres" value="' + fmt(r.d) + '"><span class="note">Diameter (m)</span></div>' +
    '<div class="rail"><input type="range" id="r-ds" min="0" max="' + dmax + '" step="any" value="' + Math.max(0, Math.min(dmax, r.d)) + '" aria-label="Diameter slider"></div>' +
    '<div class="scale"><span>0</span><span>' + fmt(S.range,4) + '</span><span>' + fmt(dmax,4) + '</span></div></div>' +
    (isC ? '<div class="field"><span class="lbl">Flat on plane</span></div><div class="seg">' +
      ['xy','xz','yz'].map(function(pl){ return '<button class="chip" type="button" data-act="rplane" data-v="' + pl + '" aria-pressed="' + (r.plane === pl) + '">' + pl.toUpperCase() + '</button>'; }).join('') + '</div>' : '') +
    '<div class="field"><span class="lbl">Centre</span></div><div class="grid3">' +
    ['cx','cy','cz'].map(function(k){ return '<input class="txt" id="r-' + k + '" type="text" inputmode="decimal" autocomplete="off" aria-label="Centre ' + k.slice(1).toUpperCase() + '" value="' + fmt(r[k]) + '">'; }).join('') + '</div>' +
    rangeRow() +
    '<div id="r-read">' + readHTML(r) + '</div>' +
    '<p class="err" id="err" hidden></p>' +
    '<div class="actions"><button class="btn primary" type="button" data-act="rdone">Done</button>' +
    (isNew ? '<button class="btn" type="button" data-act="rcancel">Cancel</button>' : '<button class="btn danger" type="button" data-act="rremove">Remove</button>') + '</div>';
}

function onRoundInput(t){
  var r = rcur(); if (!r) return;
  var id = t.id;
  if (id === 'r-ds') { r.d = parseFloat(t.value); $('#r-d').value = fmt(r.d); }
  else if (id === 'r-name') { var e = roundNameErr(t.value, r); showErr(e); r.name = e ? t.value : t.value.trim(); }
  else {
    var k = id.slice(2), n = parseNum(t.value);
    if (isNaN(n)) return;
    if (k === 'd') { r.d = Math.max(0, n); $('#r-ds').value = Math.min(2 * S.range, r.d); } else r[k] = n;
  }
  $('#r-read').innerHTML = readHTML(r); requestDraw();
}

function onRoundChange(t){
  var r = rcur(); if (!r) return;
  var k = t.id.slice(2);
  if (!/^(d|cx|cy|cz)$/.test(k)) return;
  var n = parseNum(t.value);
  if (isNaN(n)) n = r[k];
  if (k === 'd') { n = Math.max(0, n); $('#r-ds').value = Math.min(2 * S.range, n); }
  r[k] = n; t.value = fmt(n);
  $('#r-read').innerHTML = readHTML(r); save(); requestDraw();
}

function finishRound(){
  var r = rcur(), e = roundNameErr(r.name, r);
  if (!e && !(r.d > 0)) e = 'Diameter must be above 0.';
  if (e) { showErr(e); return; }
  r.name = r.name.trim();
  var wasNew = !!S.rdraft;
  if (wasNew) { r.id = S.nextRound++; S.rounds.push(r); S.rdraft = null; }
  S.reditng = null; save();
  if (wasNew) { setMode('measure'); S.msg = r.name + ' added.'; S.bad = false; }
  else { S.mode = 'idle'; S.msg = r.name + ' saved.'; S.bad = false; }
  renderPanel(); requestDraw();
}

function removeRound(){
  var r = S.reditng; if (!r) return;
  S.lines = S.lines.filter(function(l){ return !(l.ta === 'r' && l.a === r.id) && !(l.tb === 'r' && l.b === r.id); });
  S.rounds = S.rounds.filter(function(x){ return x !== r; });
  S.reditng = null; S.mode = 'idle'; S.msg = r.name + ' removed.'; S.bad = false; save();
  renderPanel(); requestDraw();
}

function pickRound(r){
  S.mode = 'round'; S.reditng = r; S.editing = null; S.selLine = null; S.msg = ''; S.confirmNew = false;
  renderPanel(); requestDraw();
}


function lineSurface(l){
  var na = nodeOf(l.ta, l.a), nb = nodeOf(l.tb, l.b);
  if (!na || !nb) return null;
  var ca = na.k === 'r' && na.o.type === 'circle', cb = nb.k === 'r' && nb.o.type === 'circle';
  if (ca && nb.k === 'p') return {t:'cone', apex:nb.o, base:na.o};
  if (cb && na.k === 'p') return {t:'cone', apex:na.o, base:nb.o};
  if (ca && cb) return {t:'frus', r1:na.o, r2:nb.o};
  return null;
}

function rimWorld(r, N){
  var out = [], rad = r.d / 2, i, t, c, s;
  for (i = 0; i < N; i++) {
    t = 2 * Math.PI * i / N; c = rad * Math.cos(t); s = rad * Math.sin(t);
    out.push(r.plane === 'xz' ? [r.cx + c, r.cy, r.cz + s] : r.plane === 'yz' ? [r.cx, r.cy + c, r.cz + s] : [r.cx + c, r.cy + s, r.cz]);
  }
  return out;
}


MODES.circle = {
  modes: ['shapes', 'round'],
  html: function(){
    if (!rcur()) { S.mode = 'idle'; return null; }
    return roundEditorHTML(rcur(), !!S.rdraft);
  },
  click: function(act, t){
    if (act === 'rtype') { var rr = rcur(); if (rr) { rr.type = t.getAttribute('data-v'); renderPanel(); requestDraw(); } }
    else if (act === 'rplane') { var rp = rcur(); if (rp) { rp.plane = t.getAttribute('data-v'); renderPanel(); requestDraw(); } }
    else if (act === 'rdone') finishRound();
    else if (act === 'rcancel') { S.rdraft = null; S.mode = 'idle'; S.msg = ''; renderPanel(); requestDraw(); }
    else if (act === 'rremove') removeRound();
    else if (act === 'pickr') { var ro = S.rounds.filter(function(x){ return x.id === +t.getAttribute('data-id'); })[0]; if (ro) pickRoundTap(ro); }
    else return false;
    return true;
  },
  input: function(t){ if (t.id.indexOf('r-') === 0) { onRoundInput(t); return true; } return false; },
  change: function(t){ if (t.id.indexOf('r-') === 0) { onRoundChange(t); return true; } return false; },
  key: function(e){
    if (e.key === 'Enter' && e.target.id.indexOf('r-') === 0) { e.preventDefault(); e.target.blur(); return true; }
    return false;
  },
  focusin: function(t){
    if (/^r-(cx|cy|cz)$/.test(t.id)) { setTimeout(function(){ try { t.select(); } catch (x) {} }, 0); return true; }
    return false;
  }
};
