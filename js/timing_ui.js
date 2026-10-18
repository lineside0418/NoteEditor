// Timing event editor and a separate scroll-speed playback preview.
function appendTimingRow(kind, tick, value){
  const row = document.createElement('div');
  row.className = 'timing-row';
  row.dataset.kind = kind;
  row.innerHTML = '<span class="timing-kind"></span><label>Tick<input class="timing-tick" type="number" min="0" step="1"></label><label class="timing-value-label"><input class="timing-value" type="number" min="0" step="any"></label><button type="button" class="timing-delete">削除</button>';
  row.querySelector('.timing-kind').textContent = kind === 'bpms' ? 'BPM' : 'Scroll';
  row.querySelector('.timing-value-label').prepend(document.createTextNode(kind === 'bpms' ? 'BPM' : '倍率'));
  row.querySelector('.timing-tick').value = String(tick);
  row.querySelector('.timing-value').value = String(value);
  const remove = row.querySelector('.timing-delete');
  if(kind === 'bpms' && tick === 0) remove.disabled = true;
  remove.addEventListener('click', () => row.remove());
  el.timingRows.appendChild(row);
}

function openTimingEditor(){
  if(!chart) return;
  el.timingRows.replaceChildren();
  for(const kind of ['bpms','scrolls']){
    for(const entry of chart.timing[kind] || []) appendTimingRow(kind, entry.tick, entry[kind === 'bpms' ? 'bpm' : 'speed']);
  }
  el.timingModalOverlay.classList.add('open');
}
function closeTimingEditor(){ el.timingModalOverlay.classList.remove('open'); }
function saveTimingEditor(){
  const next = {bpms:[], scrolls:[]};
  const seen = {bpms:new Set(), scrolls:new Set()};
  for(const row of el.timingRows.querySelectorAll('.timing-row')){
    const kind = row.dataset.kind;
    const tickText = row.querySelector('.timing-tick').value.trim();
    const valueText = row.querySelector('.timing-value').value.trim();
    const tick = Number(tickText), value = Number(valueText);
    if(tickText === '' || !Number.isInteger(tick) || tick < 0 || valueText === '' || !Number.isFinite(value) || value <= 0){
      alert('BPM / Scroll の Tick は0以上の整数、値は0より大きい有限数で入力してください。'); return;
    }
    if(seen[kind].has(tick)){ alert(`${kind} の Tick ${tick} が重複しています。`); return; }
    seen[kind].add(tick);
    next[kind].push(kind === 'bpms' ? {tick,bpm:value} : {tick,speed:value});
  }
  if(!seen.bpms.has(0)){ alert('Tick 0 の BPM が必要です。'); return; }
  for(const kind of ['bpms','scrolls']) next[kind].sort((a,b)=>a.tick-b.tick);
  pushHistory();
  chart.timing.bpms = next.bpms;
  chart.timing.scrolls = next.scrolls;
  resizeCanvas(); draw(); updateMetaStats(); updateFooterCounts();
  closeTimingEditor();
}

el.btnTiming.addEventListener('click', openTimingEditor);
function suggestedEventTick(kind){
  let tick = Math.max(0,Math.round(tickForAudioTime(audio.currentTime || 0)));
  const used = new Set([...el.timingRows.querySelectorAll(`.timing-row[data-kind="${kind}"] .timing-tick`)].map(input => Number(input.value)));
  while(used.has(tick)) tick += resolution;
  return tick;
}
el.timingAddBpm.addEventListener('click', () => appendTimingRow('bpms', suggestedEventTick('bpms'), 120));
el.timingAddScroll.addEventListener('click', () => appendTimingRow('scrolls', suggestedEventTick('scrolls'), 1));
el.timingCancel.addEventListener('click', closeTimingEditor);
el.timingSave.addEventListener('click', saveTimingEditor);
el.timingModalOverlay.addEventListener('click', e => { if(e.target === el.timingModalOverlay) closeTimingEditor(); });

function drawScrollPreview(){
  if(!chart || !el.previewModalOverlay.classList.contains('open')) return;
  const canvas = el.previewCanvas, context = canvas.getContext('2d');
  const width = canvas.width, height = canvas.height, laneWidth = width / laneCount;
  const hitY = height * (isTimelineInverted ? 0.7 : 0.3);
  const direction = isTimelineInverted ? -1 : 1;
  const currentTick = tickForAudioTime(audio.currentTime || 0);
  const currentVisual = visualTimeAtTick(currentTick);
  const yAtTick = tick => hitY + direction * (visualTimeAtTick(tick) - currentVisual) * 200;
  context.fillStyle = getVar('--bg'); context.fillRect(0,0,width,height);
  context.strokeStyle = getVar('--panel-border'); context.lineWidth = 1;
  for(let lane=1;lane<laneCount;lane++){
    const x = lane*laneWidth;
    context.beginPath(); context.moveTo(x,0); context.lineTo(x,height); context.stroke();
  }
  const extent = maxContentTick();
  for(const segment of timeSignatureSegments(extent)){
    const beat = ReInverseChartFormat.ticksPerDenominatorNote(resolution, segment.denominator);
    if(beat <= 0) continue;
    for(let tick=segment.startTick;tick<segment.endTick;tick+=beat){
      const y = yAtTick(tick);
      const distance = direction * (y-hitY);
      if(distance < -height) continue;
      if(distance > height) break;
      context.strokeStyle = getVar('--grid-beat');
      context.beginPath(); context.moveTo(0,y); context.lineTo(width,y); context.stroke();
    }
    const measure = beat * segment.numerator;
    const first = ReInverseChartFormat.firstBarTick(segment.startTick, segment.numerator, segment.denominator, resolution, chart.metadata.grid_offset);
    for(let tick=first;tick<segment.endTick;tick+=measure){
      const y = yAtTick(tick);
      const distance = direction * (y-hitY);
      if(distance < -height) continue;
      if(distance > height) break;
      context.strokeStyle = getVar('--grid-measure'); context.lineWidth = 2;
      context.beginPath(); context.moveTo(0,y); context.lineTo(width,y); context.stroke();
      context.lineWidth = 1;
    }
  }
  for(const note of chart.notes || []){
    const y = yAtTick(note.tick);
    const endY = note.endTick == null ? y : yAtTick(note.endTick);
    if(Math.max(y,endY)<-16 || Math.min(y,endY)>height+16) continue;
    const lane = getVisualLane(note), x = lane*laneWidth + 6;
    context.fillStyle = noteColor(note.type);
    if(note.endTick != null){
      context.globalAlpha = 0.3;
      context.fillRect(x,Math.min(y,endY),laneWidth-12,Math.max(2,Math.abs(endY-y)));
      context.globalAlpha = 1;
      context.fillRect(x,endY-2,laneWidth-12,4);
    }
    context.fillRect(x,y-5,laneWidth-12,10);
  }
  context.strokeStyle = getVar('--playhead'); context.lineWidth = 2;
  context.beginPath(); context.moveTo(0,hitY); context.lineTo(width,hitY); context.stroke();
  previewRafHandle = requestAnimationFrame(drawScrollPreview);
}
function closeScrollPreview(){
  el.previewModalOverlay.classList.remove('open');
  if(previewRafHandle != null) cancelAnimationFrame(previewRafHandle);
  previewRafHandle = null;
}
el.btnPreview.addEventListener('click', () => {
  if(!chart) return;
  el.previewModalOverlay.classList.add('open');
  drawScrollPreview();
});
el.previewClose.addEventListener('click', closeScrollPreview);
el.previewModalOverlay.addEventListener('click', e => { if(e.target === el.previewModalOverlay) closeScrollPreview(); });
