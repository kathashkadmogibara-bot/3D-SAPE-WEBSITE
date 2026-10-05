/* measure.js: the "Measure" button. Line length, area, volume and the distance between two points. */

function updateDist(){
  var a = findNode(S.dist.a), b = findNode(S.dist.b), el = $('#dres');
  if (!el) return;
  el.innerHTML = (a && b) ? fmt(nodeDist(a, b),6) + '<i>m</i>' : '<span class="note">Pick two points.</span>';
}


function measureHTML(){
  var st = stats(), opts = function(sel){
    return '<option value="">—</option>' + S.points.concat(S.rounds).map(function(p){ return '<option value="' + esc(p.name) + '"' + (p.name === sel ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('');
  };
  return noteHTML() + '<div class="tiles">' +
    '<div class="tile"><span class="tl">Line length</span><span class="tv">' + fmt(st.len,4) + '<i>m</i></span><span class="ts">' + S.lines.length + ' lines total</span></div>' +
    '<div class="tile"><span class="tl">Area</span><span class="tv">' + fmt(st.area,4) + '<i>m²</i></span><span class="ts">' + (st.flat ? 'flat shape' : 'outer surface') + '</span></div>' +
    '<div class="tile"><span class="tl">Volume</span><span class="tv">' + fmt(st.vol,4) + '<i>m³</i></span><span class="ts">' + (st.vol > 0 ? 'solid inside' : 'needs a 3D shape') + '</span></div></div>' +
    roundsHTML() +
    '<div class="field"><span class="lbl">Area and volume of</span></div>' +
    '<div class="seg"><button class="chip" type="button" data-act="amode" data-v="lines" aria-pressed="' + (S.areaMode === 'lines') + '">Connected points</button>' +
    '<button class="chip" type="button" data-act="amode" data-v="all" aria-pressed="' + (S.areaMode === 'all') + '">All points</button></div>' +
    '<div class="field"><span class="lbl">Distance between two points or circles</span></div>' +
    '<div class="dist"><select class="sel" id="da" aria-label="First point">' + opts(S.dist.a) + '</select><select class="sel" id="db" aria-label="Second point">' + opts(S.dist.b) + '</select></div>' +
    '<div class="dres" id="dres"></div>' +
    '<p class="note">Area and volume are of the solid wrapped around ' + st.n + ' points (a dented or hollow shape is measured as if filled in). Tap points on the graph to fill the distance boxes.</p>';
}

MODES.measure = {
  modes: ['measure'],
  html: measureHTML,
  after: updateDist,
  click: function(act, t){
    if (act === 'amode') { S.areaMode = t.getAttribute('data-v'); save(); renderPanel(); requestDraw(); return true; }
    return false;
  },
  change: function(t){
    if (t.id === 'da') { S.dist.a = t.value; updateDist(); requestDraw(); return true; }
    if (t.id === 'db') { S.dist.b = t.value; updateDist(); requestDraw(); return true; }
    return false;
  }
};
