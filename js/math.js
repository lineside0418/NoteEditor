// Coordinate helpers
  // ---------------------------------------------------------------
  let verticalExtentTick = 0;
  function pxPerTick(){ return BASE_PX_PER_TICK * zoom; }
  function tickToY(tick){ return (isTimelineInverted ? verticalExtentTick - tick : tick) * pxPerTick(); }
  function yToTick(y){ return isTimelineInverted ? verticalExtentTick - y / pxPerTick() : y / pxPerTick(); }
  function laneToX(lane){
    if (lane === laneCount) return RULER_W + laneCount * LANE_W;
    if (isCenterSpaceMode) {
      if (lane < 3) return RULER_W + lane*LANE_W;
      if (lane === 6) return RULER_W + 3*LANE_W;
      return RULER_W + (lane + 1)*LANE_W;
    }
    return RULER_W + lane*LANE_W;
  }
  function xToLane(x){
    let raw = Math.floor((x - RULER_W) / LANE_W);
    if(raw < 0) raw = 0;
    if(raw >= laneCount) raw = laneCount - 1;
    if (isCenterSpaceMode) {
      if (raw < 3) return raw;
      if (raw === 3) return 6;
      return raw - 1;
    }
    return Math.max(0, Math.min(laneCount-1, raw));
  }
  function snapTicks(){ return resolution*4/snapN; }
  function snapTick(tick){ const s = snapTicks(); return Math.max(0, Math.round(tick/s)*s); }
  function clampLane(l){ return Math.max(0, Math.min(laneCount-1, l)); }

  // オーディオ要素自体の長さを参照するように変更したよ
  function audioDurationSec(){
    if(audio && isFinite(audio.duration) && audio.duration>0){
      return audio.duration;
    }
    return 0;
  }

  function maxContentTick(){
    let m = 0;
    
    // 既存のノーツやタイミングイベントから最大Tickを取得
    (chart.notes||[]).forEach(n=>{ m = Math.max(m, n.tick||0, n.endTick||0); });
    (chart.timing.bpms||[]).forEach(b=>m=Math.max(m,b.tick||0));
    (chart.timing.scrolls||[]).forEach(s=>m=Math.max(m,s.tick||0));
    (chart.timing.timeSignatures||[]).forEach(t=>m=Math.max(m,t.tick||0));

    // 音声が読み込まれている場合は、曲の総尺そのものから最大Tickを算出してキャンバスを伸ばす
    const durationSec = audioDurationSec();
    if (durationSec > 0) {
      const audioMaxTick = tickForAudioTime(durationSec);
      m = Math.max(m, audioMaxTick);
    }

    // 音声がなくても常に最後尾からさらに20小節分の余白（キャンバス領域）を確保する
    // これにより、音声未読み込み状態でもスクロールして無限にノーツを配置し続けられる
    return m + (resolution * 4 * 20);
  }
  function contentHeight(){ return verticalExtentTick * pxPerTick(); }
  function contentWidth(){ return RULER_W + laneCount*LANE_W + 150; } // +150 for waveform space

  let dummy = null;
  function resizeCanvas(){
    if(!chart) return;
    
    if(!dummy) {
      dummy = document.createElement('div');
      dummy.id = 'scrollDummy';
      dummy.style.position = 'absolute';
      dummy.style.width = '1px';
      dummy.style.top = '0';
      dummy.style.left = '0';
      dummy.style.zIndex = '-1';
      el.scrollWrap.style.position = 'relative';
      el.scrollWrap.appendChild(dummy);
      el.gridCanvas.style.position = 'sticky';
      el.gridCanvas.style.top = '0';
      el.gridCanvas.style.left = '0';
      el.gridCanvas.style.zIndex = '1';
    }
    
    const w = contentWidth();
    const previousHeight = contentHeight();
    verticalExtentTick = maxContentTick();
    const h = Math.max(400, contentHeight());
    const viewH = el.scrollWrap.clientHeight || 800;
    dummy.style.height = h + 'px';
    if(isTimelineInverted && previousHeight > 0) el.scrollWrap.scrollTop += h - Math.max(400, previousHeight);
    
    const dpr = window.devicePixelRatio || 1;
    el.gridCanvas.style.width = w+'px';
    el.gridCanvas.style.height = viewH+'px';
    el.gridCanvas.width = Math.round(w*dpr);
    el.gridCanvas.height = Math.round(viewH*dpr);
    // transform is set in draw()
  }

  // ---------------------------------------------------------------
  // Tick <-> time (seconds) conversion, using BPM segments
  // ---------------------------------------------------------------
  function sortedBpms(){
    const entries = (chart.timing.bpms||[]).filter(e => e && Number.isInteger(e.tick) && e.tick >= 0 && Number.isFinite(e.bpm) && e.bpm > 0)
      .slice().sort((a,b)=>a.tick-b.tick);
    if(!entries.some(e=>e.tick===0)) entries.unshift({tick:0,bpm:120});
    return entries;
  }

  function tickToSeconds(targetTick){
    const bpms = sortedBpms();
    if(bpms.length===0 || bpms[0].tick!==0) bpms.unshift({tick:0,bpm:120});
    let t = 0, prevTick = 0, prevBpm = bpms[0].bpm;
    for(let i=1;i<bpms.length;i++){
      const segEnd = bpms[i].tick;
      if(targetTick <= segEnd){
        t += (targetTick-prevTick) * (60/(prevBpm*resolution));
        return t;
      }
      t += (segEnd-prevTick) * (60/(prevBpm*resolution));
      prevTick = segEnd; prevBpm = bpms[i].bpm;
    }
    t += (targetTick-prevTick) * (60/(prevBpm*resolution));
    return t;
  }

  function secondsToTick(targetSec){
    const bpms = sortedBpms();
    if(bpms.length===0 || bpms[0].tick!==0) bpms.unshift({tick:0,bpm:120});
    let t = 0, prevTick = 0, prevBpm = bpms[0].bpm;
    for(let i=1;i<bpms.length;i++){
      const segEnd = bpms[i].tick;
      const segDur = (segEnd-prevTick) * (60/(prevBpm*resolution));
      if(t+segDur >= targetSec){
        return prevTick + (targetSec-t) * (prevBpm*resolution/60);
      }
      t += segDur; prevTick = segEnd; prevBpm = bpms[i].bpm;
    }
    return prevTick + (targetSec-t) * (prevBpm*resolution/60);
  }

  function audioOffsetSec(){ return ((chart.metadata.audio && chart.metadata.audio.offset) || 0)/1000; }
  function audioTimeForTick(tick){ return tickToSeconds(tick) + audioOffsetSec(); }
  function tickForAudioTime(sec){ return secondsToTick(sec - audioOffsetSec()); }

  // The integral is measured in chart seconds. BPM changes affect the event
  // times, while Scroll changes only the distance travelled in the preview.
  function visualTimeAtTick(tick){
    const targetSec = tickToSeconds(tick);
    const events = (chart.timing.scrolls || []).filter(e => Number.isInteger(e.tick) && e.tick >= 0 && Number.isFinite(e.speed) && e.speed > 0)
      .slice().sort((a,b)=>a.tick-b.tick);
    let previousSec = 0, speed = 1, visual = 0;
    for(const event of events){
      const eventSec = tickToSeconds(event.tick);
      if(eventSec > targetSec) break;
      visual += (eventSec - previousSec) * speed;
      previousSec = eventSec;
      speed = event.speed;
    }
    return visual + (targetSec - previousSec) * speed;
  }

  // ---------------------------------------------------------------
