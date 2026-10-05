/* add.js: the "Add point" button (also used when you tap an existing point to edit or remove it). */

function nameError(name, self){
  name = name.trim();
  if (!name) return 'Name cannot be empty.';
  var clash = allPts().some(function(p){ return p !== self && p.name.toLowerCase() === name.toLowerCase(); }) || S.rounds.some(function(r){ return r.name.toLowerCase() === name.toLowerCase(); });
  return clash ? 'This name is already used.' : '';
}

function nextName(){
  for (var i = 0; i < 2000; i++) {
    var n = String.fromCharCode(65 + i % 26) + (i >= 26 ? Math.floor(i / 26) : '');
    if (!findNode(n)) return n;
  }
  return 'P' + S.nextId;
}

function finishEdit(){
  var p = cur(), err = nameError(p.name, p);
  if (err) { showErr(err); return; }
  p.name = p.name.trim();
  if (S.draft) { p.id = S.nextId++; S.points.push(p); S.msg = 'Point ' + p.name + ' added.'; S.draft = null; }
  else S.msg = 'Point ' + p.name + ' saved.';
  S.bad = false; S.editing = null; S.mode = 'idle'; save();
  renderPanel(); requestDraw();
}

function removePoint(){
  var p = S.editing; if (!p) return;
  S.lines = S.lines.filter(function(l){ return !((l.ta || 'p') === 'p' && l.a === p.id) && !((l.tb || 'p') === 'p' && l.b === p.id); });
  S.points = S.points.filter(function(q){ return q !== p; });
  S.msg = 'Point ' + p.name + ' removed.'; S.bad = false; S.editing = null; S.mode = 'idle'; save();
  renderPanel(); requestDraw();
}


function axisRow(a, v){
  var cl = clR(v);
  return '<div class="axis" data-a="' + a + '">' +
    '<div class="axtop"><span class="axl">' + a.toUpperCase() + '</span>' +
    '<input class="val" id="v-' + a + '" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="' + fmt(v) + '" aria-label="' + a.toUpperCase() + ' value">' +
    '<button class="sign" type="button" data-act="sign" data-a="' + a + '" aria-label="Flip sign of ' + a.toUpperCase() + '">±</button></div>' +
    '<div class="rail"><input type="range" id="s-' + a + '" min="' + (-S.range) + '" max="' + S.range + '" step="any" value="' + cl + '" aria-label="' + a.toUpperCase() + ' slider"></div>' +
    '<div class="scale"><span>' + fmt(-S.range,4) + '</span><span>0</span><span>' + fmt(S.range,4) + '</span></div></div>';
}


function rangeRow(){
  var presets = [1, 5, 10, 100];
  return '<div class="field"><span class="lbl">Slider range ±</span><div class="seg">' +
    presets.map(function(v){ return '<button class="chip" type="button" data-act="range" data-v="' + v + '" aria-pressed="' + (S.range === v) + '">' + v + '</button>'; }).join('') +
    '<input class="rg" id="rg" type="text" inputmode="decimal" autocomplete="off" aria-label="Custom range" placeholder="Custom" value="' + (presets.indexOf(S.range) < 0 ? fmt(S.range,4) : '') + '"></div></div>';
}


function setRange(v){
  if (!(v > 0) || !isFinite(v)) return;
  S.range = v; S.view.zoom = 1 / v; save(); renderPanel(); requestDraw();
}


function addHTML(){
  var p = cur(), isNew = !!S.draft;
  return '<div class="field"><label for="nm">Name</label><input class="txt" id="nm" type="text" maxlength="16" autocomplete="off" spellcheck="false" value="' + esc(p.name) + '"></div>' +
    axisRow('x', p.x) + axisRow('y', p.y) + axisRow('z', p.z) + rangeRow() +
    '<p class="err" id="err" hidden></p>' +
    '<div class="actions"><button class="btn primary" type="button" data-act="done">Done</button>' +
    (isNew ? '<button class="btn" type="button" data-act="cancel">Cancel</button>' : '<button class="btn danger" type="button" data-act="remove">Remove</button>') + '</div>';
}

MODES.add = {
  modes: ['add', 'edit'],
  html: addHTML,
  click: function(act, t){
    if (act === 'done') finishEdit();
    else if (act === 'cancel') { S.mode = 'idle'; S.draft = null; S.msg = ''; renderPanel(); requestDraw(); }
    else if (act === 'remove') removePoint();
    else if (act === 'sign') {
      var a = t.getAttribute('data-a'), q = cur(); if (!q) return true;
      q[a] = q[a] === 0 ? 0 : -q[a];
      $('#v-' + a).value = fmt(q[a]); $('#s-' + a).value = clR(q[a]);
      save(); requestDraw();
    }
    else if (act === 'range') setRange(parseFloat(t.getAttribute('data-v')));
    else return false;
    return true;
  },
  input: function(t){
    var q = cur(); if (!q) return false;
    if (t.type === 'range') {
      var a = t.id.slice(2), v = parseFloat(t.value);
      q[a] = v; $('#v-' + a).value = fmt(v); requestDraw(); return true;
    }
    if (t.classList.contains('val')) {
      var a2 = t.id.slice(2), n = parseNum(t.value);
      if (!isNaN(n)) { q[a2] = n; $('#s-' + a2).value = clR(n); requestDraw(); }
      return true;
    }
    if (t.id === 'nm') {
      var err = nameError(t.value, q);
      showErr(err);
      if (!err) { q.name = t.value.trim(); requestDraw(); } else q.name = t.value;
      return true;
    }
    return false;
  },
  change: function(t){
    var q = cur();
    if (q && t.classList.contains('val')) {
      var a = t.id.slice(2), n = parseNum(t.value);
      if (isNaN(n)) n = q[a];
      q[a] = n; t.value = fmt(n); $('#s-' + a).value = clR(n); save(); requestDraw();
      return true;
    }
    if (t.id === 'rg') { var rv = parseNum(t.value); if (!isNaN(rv) && rv > 0) setRange(rv); return true; }
    return false;
  },
  key: function(e){
    var t = e.target;
    if (e.key === 'Enter' && (t.classList.contains('val') || t.id === 'nm' || t.id === 'rg')) { e.preventDefault(); t.blur(); return true; }
    return false;
  },
  focusin: function(t){
    if (t.classList.contains('val')) { setTimeout(function(){ try { t.select(); } catch (x) {} }, 0); return true; }
    return false;
  }
};
