// Selection helpers
  // ---------------------------------------------------------------
  function clearSelection(){ selectedIds.clear(); lastClickedId=null; }
  function selectOnly(id){ selectedIds.clear(); selectedIds.add(id); lastClickedId=id; }
  function toggleSelect(id){
    if(selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
    lastClickedId = id;
  }
  function selectRange(id){
    const order = sortedNotes().map(n=>n.id);
    const anchor = lastClickedId!=null ? order.indexOf(lastClickedId) : order.indexOf(id);
    const target = order.indexOf(id);
    const lo = Math.min(anchor,target), hi = Math.max(anchor,target);
    selectedIds.clear();
    for(let i=lo;i<=hi;i++) selectedIds.add(order[i]);
    lastClickedId = id;
  }
  function selectSameType(type){
    selectedIds.clear();
    (chart.notes||[]).forEach(n=>{ if(n.type===type) selectedIds.add(n.id); });
  }

  // ---------------------------------------------------------------
  // History (undo/redo)
  // ---------------------------------------------------------------
  function pushHistory(){
    history.push(JSON.stringify(chart.notes));
    if(history.length>HISTORY_LIMIT) history.shift();
    redoStack = [];
    updateHistoryButtons();
  }
  function undo(){
    if(history.length===0) return;
    redoStack.push(JSON.stringify(chart.notes));
    chart.notes = JSON.parse(history.pop());
    clearSelection();
    drag = null;
    resizeCanvas(); draw(); updateNoteCounts(); updateInspector(); updateFooterCounts();
    updateHistoryButtons();
  }
  function redo(){
    if(redoStack.length===0) return;
    history.push(JSON.stringify(chart.notes));
    chart.notes = JSON.parse(redoStack.pop());
    clearSelection();
    drag = null;
    resizeCanvas(); draw(); updateNoteCounts(); updateInspector(); updateFooterCounts();
    updateHistoryButtons();
  }
  function updateHistoryButtons(){
    el.btnUndo.disabled = history.length===0;
    el.btnRedo.disabled = redoStack.length===0;
  }

  // ---------------------------------------------------------------
  // Note mutation
  // ---------------------------------------------------------------
  function nextId(){ let m=0; (chart.notes||[]).forEach(n=>{ if(n.id>m) m=n.id; }); return m+1; }
  function notePositionKey(tick, lane){ return `${tick}:${lane}`; }
  function isNoteOccupied(tick, lane, ignoredIds){
    return (chart.notes||[]).some(n => n.tick === tick && n.lane === lane && !(ignoredIds && ignoredIds.has(n.id)));
  }

  // flagsは使わなくなったから削除しておいたよ
  function placeNote(type, tick, lane){
    if (!isValidPlacement(type, lane)) return null;
    if (isNoteOccupied(tick, lane)) return null;
    pushHistory();
    const n = { id: nextId(), tick, lane, type, size:1 };
    if(type==='hold' || type==='shift'){ n.endTick = tick + snapTicks()*MIN_HOLD_LEN_UNITS; }
    chart.notes.push(n);
    selectOnly(n.id);
    resizeCanvas(); draw(); updateNoteCounts(); updateInspector(); updateFooterCounts();
    return n;
  }

  function deleteNoteById(id){
    pushHistory();
    chart.notes = chart.notes.filter(n=>n.id!==id);
    selectedIds.delete(id);
    resizeCanvas(); draw(); updateNoteCounts(); updateInspector(); updateFooterCounts();
  }

  function deleteSelected(){
    if(selectedIds.size===0) return;
    pushHistory();
    chart.notes = chart.notes.filter(n=>!selectedIds.has(n.id));
    clearSelection();
    resizeCanvas(); draw(); updateNoteCounts(); updateInspector(); updateFooterCounts();
  }

  // ---------------------------------------------------------------
  function getPasteDestinationLane(item, targetAnchorLane, sourceAnchorLane, flipped) {
    const sourceLane = item.visualLane != null ? item.visualLane : item.lane;
    const laneOffset = item.dVisualLane != null ? item.dVisualLane : item.dLane;
    if (!flipped) {
      return targetAnchorLane + laneOffset;
    }
    const mirroredLane = sourceLane === 6 ? 6 : 5 - sourceLane;
    const mirroredAnchorLane = sourceAnchorLane === 6 ? 6 : 5 - sourceAnchorLane;
    return targetAnchorLane + (mirroredLane - mirroredAnchorLane);
  }

  function commitPaste() {
    if(!drag || drag.mode!=='paste' || !drag.items) return;
    pushHistory();
    const newIds = [];
    const occupied = new Set((chart.notes||[]).map(n => notePositionKey(n.tick, n.lane)));
    drag.items.forEach(item => {
      const t = drag.snapTick + item.dTick;
      const rawLane = getPasteDestinationLane(item, drag.lane, drag.sourceAnchorLane, drag.flipped);
      if(t < 0) return;
      if (!isValidPlacement(item.type, rawLane)) return;
      const newId = nextId();
      const l = getInternalLaneForNewNote(rawLane, item.type, t, newId);
      if (!isValidPlacement(item.type, l)) return;
      const positionKey = notePositionKey(t, l);
      if (occupied.has(positionKey)) return;
      
      const n = { id: newId, tick: t, lane: l, type: item.type, size: item.size || 1 };
      if(item.dEndTick != null) {
        n.endTick = drag.snapTick + item.dEndTick;
      }
      if(doesHoldCrossScramble(n.type, n.tick, n.endTick)) return;
      if(item.mutatorData) n.mutatorData = JSON.parse(JSON.stringify(item.mutatorData));
      
      chart.notes.push(n);
      newIds.push(n.id);
      occupied.add(positionKey);
    });
    drag = null;
    clearSelection();
    newIds.forEach(id => selectedIds.add(id));
    if(isSwapVisualizeMode) rebuildLaneStates();
    updateNoteCounts();
    updateInspector();
    draw();
  }

  function runSwapSimulator() {
    if (!chart || !Array.isArray(chart.notes)) return;
    const crossingHold = findHoldCrossingScramble();
    if(crossingHold){
      alert(`ID ${crossingHold.id} の${crossingHold.type.toUpperCase()}がSCRAMBLEをまたいでいます。先に譜面を修正してください。`);
      return;
    }
    const invalidPlacement = findInvalidNotePlacement();
    if(invalidPlacement){
      alert(`ID ${invalidPlacement.id} の${invalidPlacement.type.toUpperCase()}は、このレーンへ配置できません。先に譜面を修正してください。`);
      return;
    }
    const message = `この譜面を「Swap Visualize ONの見た目で作成された譜面」として、ゲームで同じ見た目になる内部レーンへ変換します。\n\nこの操作はUndoで元に戻せます。実行しますか？`;
    if (!confirm(message)) return;

    const nextLanes = new Map();
    let mapping = createLaneMapping();
    const notesByTick = new Map();
    chart.notes.forEach(n => {
      if(!notesByTick.has(n.tick)) notesByTick.set(n.tick, []);
      notesByTick.get(n.tick).push(n);
    });
    const ticks = [...notesByTick.keys()].sort((a,b)=>a-b);
    for(const tick of ticks){
      const notesAtTick = notesByTick.get(tick).slice().sort(compareGameOrder);
      const gimmicks = notesAtTick.filter(n => n.type === 'swap' || n.type === 'scramble');
      const normalNotes = notesAtTick.filter(n => n.type !== 'swap' && n.type !== 'scramble');

      // Same-tick notes intentionally use the mapping before any gimmick at
      // this tick. The gimmicks below only change later ticks.
      normalNotes.forEach(n => {
        nextLanes.set(n.id, mapping[mappingNameForType(n.type)][n.lane]);
      });

      for(const gimmick of gimmicks){
        if(gimmick.type === 'scramble' && gimmick.lane !== 6){
          alert(`ID ${gimmick.id} のSCRAMBLEは7レーンに配置してください。変換を中止しました。`);
          return;
        }
        nextLanes.set(gimmick.id, mapping.normal[gimmick.lane]);
      }

      const outputGimmicks = gimmicks.slice().sort((a,b) => {
        const laneDiff = nextLanes.get(a.id) - nextLanes.get(b.id);
        return laneDiff || a.id - b.id;
      });
      outputGimmicks.forEach(gimmick => {
        if(gimmick.type === 'scramble') applyScrambleMapping(mapping);
        else applySwapMapping(mapping, nextLanes.get(gimmick.id));
      });

    }

    pushHistory();
    let changed = 0;
    chart.notes.forEach(n => {
      const originalLane = n.lane;
      const mappedLane = nextLanes.get(n.id);
      if (mappedLane !== originalLane) {
        n.lane = mappedLane;
        changed++;
      }
    });

    rebuildLaneStates();
    updateNoteCounts();
    updateInspector();
    resizeCanvas();
    draw();
    alert(`${changed} 件のノーツを変換しました。`);
  }

  function mirrorSelected() {
    if(selectedIds.size === 0) return;
    pushHistory();
    const occupied = new Set();
    chart.notes.forEach(n => {
      if(selectedIds.has(n.id)) {
        const visualLane = getVisualLane(n);
        const mirroredVisualLane = visualLane === 6 ? 6 : 5 - visualLane;
        const mirroredLane = getInternalLaneForNewNote(mirroredVisualLane, n.type, n.tick, n.id);
        const position = notePositionKey(n.tick, mirroredLane);
        if(isValidPlacement(n.type, mirroredLane) && !isNoteOccupied(n.tick, mirroredLane, selectedIds) && !occupied.has(position)) {
          n.lane = mirroredLane;
          occupied.add(position);
        }
      }
    });
    if(isSwapVisualizeMode) rebuildLaneStates();
    updateInspector();
    draw();
  }
