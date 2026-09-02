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
    const sourceLane = item.lane;
    if (!flipped) {
      return targetAnchorLane + item.dLane;
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
      const l = getInternalLaneForNewNote(rawLane, item.type, t);
      if (!isValidPlacement(item.type, l)) return;
      const positionKey = notePositionKey(t, l);
      if (occupied.has(positionKey)) return;
      
      const n = { id: nextId(), tick: t, lane: l, type: item.type, size: item.size || 1 };
      if(item.dEndTick != null) {
        n.endTick = drag.snapTick + item.dEndTick;
      }
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
    rebuildLaneStates();
    const targets = chart.notes.filter(isSwapSimulationTarget);
    if (targets.length === 0) {
      alert('変換できる通常ノーツがありません。');
      return;
    }
    const message = `${targets.length} 件の通常ノーツを、SWAP / SCRAMBLE適用後も現在と同じ見た目になる元レーン配置へ変換します。\n\nこの操作はUndoで元に戻せます。実行しますか？`;
    if (!confirm(message)) return;

    pushHistory();
    let changed = 0;
    targets.forEach(n => {
      const originalLane = n.lane;
      const mappedLane = getLaneMapping(n.tick).R[originalLane];
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
