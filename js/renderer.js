// Grid / bpm drawing
  // ---------------------------------------------------------------
  function ticksPerBeatAt(numerator, denominator){ return resolution * (4/denominator); }

  function drawGridLines(maxTick, viewTop, viewBottom){
    const ts = (chart.timing.timeSignatures||[{tick:0,numerator:4,denominator:4}]).slice().sort((a,b)=>a.tick-b.tick);
    if(ts.length===0) ts.push({tick:0,numerator:4,denominator:4});
    const w = contentWidth();

    for(let i=0;i<ts.length;i++){
      const segStart = ts[i].tick;
      const segEnd = (i+1<ts.length) ? ts[i+1].tick : maxTick;
      const beatTicks = ticksPerBeatAt(ts[i].numerator, ts[i].denominator);
      const measureTicks = beatTicks * ts[i].numerator;
      if(measureTicks<=0) continue;

      ctx.strokeStyle = getVar('--grid-beat');
      ctx.lineWidth = 1;
      for(let t=segStart; t<segEnd; t+=beatTicks){
        const y = Math.round(tickToY(t))+0.5;
        if (y < viewTop) continue;
        if (y > viewBottom) break;
        ctx.beginPath(); ctx.moveTo(RULER_W,y); ctx.lineTo(w,y); ctx.stroke();
      }
      ctx.strokeStyle = getVar('--grid-measure');
      ctx.fillStyle = getVar('--text-faint');
      ctx.font = '10px '+getVar('--mono');
      let measureNo = 1;
      for(let t=segStart; t<segEnd; t+=measureTicks){
        const y = Math.round(tickToY(t))+0.5;
        if (y < viewTop) { measureNo++; continue; }
        if (y > viewBottom) break;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(RULER_W,y); ctx.lineTo(w,y); ctx.stroke();
        ctx.fillText(String(measureNo), 8, y+3);
        measureNo++;
      }
    }

    ctx.strokeStyle = getVar('--panel-border');
    ctx.lineWidth = 1;
    for(let i=0;i<=laneCount;i++){
      const x = Math.round(laneToX(i))+0.5;
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x, tickToY(maxTick)); ctx.stroke();
    }
    const rx = Math.round(RULER_W)+0.5;
    ctx.beginPath(); ctx.moveTo(rx,0); ctx.lineTo(rx, tickToY(maxTick)); ctx.stroke();
  }

  function drawBpmLines(maxTick, viewTop, viewBottom){
    const w = contentWidth();
    const bpms = sortedBpms();
    ctx.font = '10px '+getVar('--mono');
    bpms.forEach(b=>{
      const y = tickToY(b.tick);
      if (y < viewTop || y > viewBottom) return;
      ctx.strokeStyle = getVar('--bpm-line');
      ctx.setLineDash([4,3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(RULER_W,Math.round(y)+0.5); ctx.lineTo(w,Math.round(y)+0.5); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = getVar('--bpm-line');
      ctx.fillText('♩='+b.bpm, RULER_W+4, y>10? y-4 : y+12);
    });
  }

  // ---------------------------------------------------------------
  // Note drawing
  // ---------------------------------------------------------------
  function noteColor(type){ return (TYPE_META[type]||{}).color || '#888'; }

  function drawNote(n){
    const visualLane = getVisualLane(n, n.tick);
    const x = laneToX(visualLane);
    const drawWidth = LANE_W;
    const y = tickToY(n.tick);
    const cx = x + drawWidth/2;
    const isSelected = selectedIds.has(n.id);
    const color = noteColor(n.type);

    if(n.type==='hold' || n.type==='shift'){
      const y2 = tickToY(n.endTick!=null ? n.endTick : n.tick);
      ctx.fillStyle = n.type==='shift' ? color.replace(')', ', 0.3)').replace('rgb', 'rgba') : getVar('--hold-fill');
      if(n.type==='shift' && color.startsWith('#')) ctx.fillStyle = color + '4D';
      ctx.fillRect(x+6, y, drawWidth-12, Math.max(2,y2-y));
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected? 3:2;
      ctx.strokeRect(x+6, y, drawWidth-12, Math.max(2,y2-y));
      ctx.fillStyle = color;
      ctx.fillRect(x+6, y2-3, drawWidth-12, 3);
    }

    ctx.fillStyle = (n.type==='trace') ? 'rgba(0,0,0,0)' : color;
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 3 : 2;

    if(n.type==='trace'){
      ctx.beginPath();
      ctx.moveTo(cx, y-NOTE_H/2);
      ctx.lineTo(cx+drawWidth/2-8, y);
      ctx.lineTo(cx, y+NOTE_H/2);
      ctx.lineTo(cx-drawWidth/2+8, y);
      ctx.closePath();
      ctx.stroke();
    } else if(n.type==='scramble'){
      ctx.beginPath();
      ctx.moveTo(cx, Math.round(y)-NOTE_H/2);
      ctx.lineTo(cx+NOTE_H, Math.round(y)+NOTE_H/2);
      ctx.lineTo(cx-NOTE_H, Math.round(y)+NOTE_H/2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 145, 0, 0.25)';
      ctx.fill();
      ctx.stroke();
    } else if(n.type==='swap'){
      ctx.beginPath();
      ctx.arc(cx, y, NOTE_H/2, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,92,138,0.25)'; // 透明度が必要なため固定値だが、CSS変数を使ってもOK
      ctx.fill();
      ctx.stroke();
    } else {
      const rw = drawWidth-16, rh = NOTE_H;
      roundRect(ctx, cx-rw/2, y-rh/2, rw, rh, 3);
      ctx.fillStyle = color;
      ctx.fill();
    }

    if(isSelected){
      ctx.strokeStyle = getVar('--text'); // 白あるいはテキスト色
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, y, NOTE_H/2+5, 0, Math.PI*2);
      ctx.stroke();
    }
  }

  function roundRect(c,x,y,w,h,r){
    c.beginPath();
    c.moveTo(x+r,y);
    c.arcTo(x+w,y,x+w,y+h,r);
    c.arcTo(x+w,y+h,x,y+h,r);
    c.arcTo(x,y+h,x,y,r);
    c.arcTo(x,y,x+w,y,r);
    c.closePath();
  }

  // ---------------------------------------------------------------
  // Main draw
  // ---------------------------------------------------------------
  let hoverPos = null;

  function drawMinimap(maxTick, viewTop, viewBottom, clientH) {
    if (!el.minimapCanvas) return;
    const mCtx = el.minimapCanvas.getContext('2d');
    const w = el.minimapWrap.clientWidth;
    const h = el.minimapWrap.clientHeight;
    
    // Resize canvas if needed
    const dpr = window.devicePixelRatio || 1;
    if (el.minimapCanvas.width !== Math.round(w * dpr) || el.minimapCanvas.height !== Math.round(h * dpr)) {
      el.minimapCanvas.width = Math.round(w * dpr);
      el.minimapCanvas.height = Math.round(h * dpr);
    }
    
    mCtx.setTransform(1, 0, 0, 1, 0, 0);
    mCtx.clearRect(0, 0, el.minimapCanvas.width, el.minimapCanvas.height);
    mCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    const totalH = tickToY(maxTick);
    if (totalH <= 0) return;
    const scaleY = h / totalH;
    const laneW = w / laneCount;
    
    mCtx.fillStyle = getVar('--text-faint') || 'rgba(255,255,255,0.2)';
    const notes = chart.notes || [];
    for (let i=0; i<notes.length; i++) {
      const n = notes[i];
      const visLane = getVisualLane(n, n.tick);
      if (visLane < 0 || visLane >= laneCount) continue;
      const nx = visLane * laneW;
      const ny = tickToY(n.tick) * scaleY;
      let nh = 2;
      if (n.type === 'hold' || n.type === 'shift') {
        const endY = tickToY(n.endTick != null ? n.endTick : n.tick) * scaleY;
        nh = Math.max(2, endY - ny);
      }
      mCtx.fillRect(nx, ny, laneW - 1, nh);
    }
    
    // Draw viewport rect
    mCtx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    mCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    mCtx.lineWidth = 1;
    const vy = Math.max(0, viewTop) * scaleY;
    const vh = clientH * scaleY;
    mCtx.fillRect(0, vy, w, vh);
    mCtx.strokeRect(0, vy, w, vh);
  }

  // Handle minimap click
  if (el.minimapWrap && !el.minimapWrap.dataset.eventsBound) {
    el.minimapWrap.dataset.eventsBound = "true";
    let isDragging = false;
    const jumpToY = (e) => {
      const rect = el.minimapWrap.getBoundingClientRect();
      const my = e.clientY - rect.top;
      const maxTick = maxContentTick();
      const scaleY = el.minimapWrap.clientHeight / tickToY(maxTick);
      const targetScroll = (my / scaleY) - (el.scrollWrap.clientHeight / 2);
      el.scrollWrap.scrollTop = Math.max(0, targetScroll);
      draw();
    };
    el.minimapWrap.addEventListener('mousedown', (e) => { isDragging = true; jumpToY(e); });
    window.addEventListener('mousemove', (e) => { if(isDragging) jumpToY(e); });
    window.addEventListener('mouseup', () => { isDragging = false; });
  }

  function draw(){
    rebuildLaneStates();
    if(!chart) return;
    const w = contentWidth();
    const maxTick = maxContentTick();
    const h = tickToY(maxTick);
    
    // Viewport Culling logic
    const wrap = el.scrollWrap;
    const scrollTop = wrap ? wrap.scrollTop : 0;
    const clientH = (wrap && wrap.clientHeight > 0) ? wrap.clientHeight : 800;
    const viewTop = scrollTop - 200;
    const viewBottom = scrollTop + clientH + 200;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, el.gridCanvas.width, el.gridCanvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, -scrollTop * dpr);
    for(let i=0;i<laneCount;i++){
      if(i === 6) {
        // Space lane highlight (Distinct color)
        ctx.fillStyle = 'rgba(120, 170, 255, 0.08)';
        ctx.fillRect(laneToX(i), 0, LANE_W, h);
      } else if(i%2===1){ 
        ctx.fillStyle = getVar('--lane-alt'); 
        ctx.fillRect(laneToX(i), 0, LANE_W, h); 
      }
    }
    
    // Lane separators (vertical lines)
    ctx.strokeStyle = getVar('--grid-measure');
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=1;i<=laneCount;i++){
      const x = Math.round(laneToX(i)) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    ctx.stroke();

    drawGridLines(maxTick, viewTop, viewBottom);
    drawBpmLines(maxTick, viewTop, viewBottom);
    // Waveform
    if (waveformData && waveformData.length > 0) {
      const startX = laneToX(laneCount) + 30; // 30px margin
      const waveWidth = 80; // width of waveform lane
      
      // Draw background for waveform lane
      ctx.fillStyle = getVar('--lane-alt') || 'rgba(255,255,255,0.02)';
      ctx.fillRect(startX, 0, waveWidth, h);
      
      ctx.beginPath();
      ctx.strokeStyle = getVar('--primary') || '#00e5ff';
      ctx.lineWidth = 1;
      
      const topTick = Math.max(0, yToTick(viewTop));
      const bottomTick = Math.max(0, yToTick(viewBottom));
      const topTime = audioTimeForTick(topTick);
      const bottomTime = audioTimeForTick(bottomTick);
      
      let startIndex = Math.max(0, Math.floor(topTime / 0.01));
      let endIndex = Math.min(waveformData.length, Math.ceil(bottomTime / 0.01) + 1);
      
      for (let i = startIndex; i < endIndex; i++) {
        const time = i * 0.01;
        const tick = tickForAudioTime(time);
        if (tick > maxTick + 1000) break;
        const y = tickToY(tick);
        
        const minX = startX + waveWidth/2 + (waveformData[i].min * waveWidth/2);
        const maxX = startX + waveWidth/2 + (waveformData[i].max * waveWidth/2);
        
        ctx.moveTo(minX, y);
        ctx.lineTo(maxX, y);
      }
      ctx.stroke();
    }

    const notes = chart.notes||[];
    const visibleNotes = notes.filter(n => {
       const y = tickToY(n.tick);
       const endY = n.endTick != null ? tickToY(n.endTick) : y + NOTE_H;
       return (endY >= viewTop && y <= viewBottom);
    });
    visibleNotes.filter(n=>n.type==='hold' || n.type==='shift').forEach(drawNote);
    visibleNotes.filter(n=>n.type!=='hold' && n.type!=='shift').forEach(drawNote);

    if(drag && drag.mode==='create-hold'){
      ctx.globalAlpha = 0.6;
      drawNote({type:drag.type || 'hold', lane:drag.lane, tick:drag.startTick, endTick:drag.currentTick, id:-999});
      ctx.globalAlpha = 1;
    }

    if(drag && drag.mode==='paste' && drag.items){
      ctx.globalAlpha = 0.5;
      drag.items.forEach(item => {
        const t = drag.snapTick + item.dTick;
        const l = drag.lane + item.dLane;
        if(t >= 0 && isValidPlacement(item.type, l)) {
          const fakeNote = { type: item.type, lane: l, tick: t, size: item.size || 1 };
          if (item.dEndTick != null) {
            fakeNote.endTick = drag.snapTick + item.dEndTick;
          }
          drawNote(fakeNote);
        }
      });
      ctx.globalAlpha = 1.0;
    }

    if(drag && drag.mode==='rect-select'){
      const x0=Math.min(drag.x0,drag.x1), x1=Math.max(drag.x0,drag.x1);
      const y0=Math.min(drag.y0,drag.y1), y1=Math.max(drag.y0,drag.y1);
      ctx.fillStyle = getVar('--select-box');
      ctx.strokeStyle = getVar('--select-box-border');
      ctx.lineWidth = 1;
      ctx.fillRect(x0,y0,x1-x0,y1-y0);
      ctx.strokeRect(x0,y0,x1-x0,y1-y0);
    }

    if(hoverPos && pointerMode === 'place'){
      const y = tickToY(hoverPos.snappedTick);
      ctx.strokeStyle = getVar('--text-dim');
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(RULER_W, Math.round(y)+0.5); ctx.lineTo(w,Math.round(y)+0.5); ctx.stroke();
      ctx.fillStyle = getVar('--select-box');
      const hWidth = LANE_W;
      const hX = laneToX(hoverPos.lane);
      if(isValidPlacement(selectedType, hoverPos.lane)) {
        ctx.fillRect(hX, y-NOTE_H/2-2, hWidth, NOTE_H+4);
      }
    }

    if(audio.src){
      const curTick = tickForAudioTime(typeof currentAudioTime !== 'undefined' ? currentAudioTime : (audio.currentTime||0));
      const py = Math.round(tickToY(curTick));
      ctx.strokeStyle = getVar('--playhead');
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, py + 0.5); ctx.lineTo(w, py + 0.5); ctx.stroke();
      ctx.fillStyle = getVar('--playhead');
      ctx.beginPath();
      ctx.moveTo(0, py - 6); ctx.lineTo(10, py); ctx.lineTo(0, py + 6); ctx.closePath(); ctx.fill();
    }
    drawMinimap(maxTick, viewTop, viewBottom, clientH);
  }

  // ---------------------------------------------------------------
  // Hit testing / sorted order
  // ---------------------------------------------------------------
  function sortedNotes(){
    return (chart.notes||[]).slice().sort((a,b)=>{
      if(a.tick!==b.tick) return a.tick-b.tick;
      if(a.lane!==b.lane) return a.lane-b.lane;
      return a.id-b.id;
    });
  }

  function hitTest(x,y){
    const hitTick = yToTick(y);
    const notes = chart.notes||[];
    for(let i=notes.length-1;i>=0;i--){
      const n = notes[i];
      if(n.type==='hold' || n.type==='shift'){
        const y1 = tickToY(n.tick), y2 = tickToY(n.endTick!=null?n.endTick:n.tick);
        if(y>=y1-NOTE_H/2 && y<=y2+NOTE_H/2){
          const visLane = getVisualLane(n, hitTick);
          const cx = laneToX(visLane) + LANE_W/2;
          if(Math.abs(x-cx) <= LANE_W/2-4){
            const nearEnd = Math.abs(y-y2) <= 7;
            return {note:n, zone: nearEnd?'end':'body'};
          }
        }
      } else {
        const ny = tickToY(n.tick);
        if(Math.abs(y-ny) <= NOTE_H/2+3){
          const visLane = getVisualLane(n, n.tick);
          const cx = laneToX(visLane) + LANE_W/2;
          if(Math.abs(x-cx) <= LANE_W/2-4){
            return {note:n, zone:'body'};
          }
        }
      }
    }
    return null;
  }

  function noteBounds(n){
    const visLane = getVisualLane(n, n.tick);
    const drawWidth = LANE_W;
    const x = laneToX(visLane);
    const x0 = x+6, x1 = x+drawWidth-6;
    let y0,y1;
    if(n.type==='hold' || n.type==='shift'){ y0=tickToY(n.tick)-NOTE_H/2; y1=tickToY(n.endTick!=null?n.endTick:n.tick)+NOTE_H/2; }
    else { y0=tickToY(n.tick)-NOTE_H/2; y1=tickToY(n.tick)+NOTE_H/2; }
    return {x0,x1,y0,y1};
  }
  function rectsIntersect(a,b){ return a.x0<=b.x1 && a.x1>=b.x0 && a.y0<=b.y1 && a.y1>=b.y0; }

  // ---------------------------------------------------------------