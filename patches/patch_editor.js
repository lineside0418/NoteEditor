const fs = require('fs');
let editor = fs.readFileSync('js/editor.js', 'utf8');

const insert = `
  function commitPaste() {
    if(!drag || drag.mode!=='paste' || !drag.items) return;
    pushHistory();
    const newIds = [];
    drag.items.forEach(item => {
      const t = drag.snapTick + item.dTick;
      const l = clampLane(drag.lane + item.dLane);
      if(t < 0) return;
      
      const n = { id: nextId(), tick: t, lane: l, type: item.type, size: item.size || 1 };
      if(item.dEndTick != null) {
        n.endTick = drag.snapTick + item.dEndTick;
      }
      if(item.mutatorData) n.mutatorData = JSON.parse(JSON.stringify(item.mutatorData));
      
      chart.notes.push(n);
      newIds.push(n.id);
    });
    drag = null;
    clearSelection();
    newIds.forEach(id => selectedIds.add(id));
    if(isSwapVisualizeMode) rebuildLaneStates();
    updateNoteCounts();
    updateInspector();
    draw();
  }

  function mirrorSelected() {
    if(selectedIds.size === 0) return;
    pushHistory();
    chart.notes.forEach(n => {
      if(selectedIds.has(n.id)) {
        // Mirror lanes 0-5. Lane 6 (SPACE) remains unaffected.
        if(n.lane >= 0 && n.lane <= 5) {
          n.lane = 5 - n.lane;
        }
      }
    });
    if(isSwapVisualizeMode) rebuildLaneStates();
    updateInspector();
    draw();
  }
`;

editor = editor + insert;
fs.writeFileSync('js/editor.js', editor);
console.log('Added editor functions!');

