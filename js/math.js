// Coordinate helpers
  // ---------------------------------------------------------------
  function pxPerTick(){ return BASE_PX_PER_TICK * zoom; }
  function tickToY(tick){ return tick * pxPerTick(); }
  function yToTick(y){ return y / pxPerTick(); }
  function laneToX(lane){ return RULER_W + lane*LANE_W; }
  function xToLane(x){ const raw = Math.floor((x - RULER_W) / LANE_W); return Math.max(0, Math.min(laneCount-1, raw)); }
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
    (chart.timing.timeSignatures||[]).forEach(t=>m=Math.max(m,t.tick||0));

    // 音声が読み込まれている場合は、曲の総尺そのものから最大Tickを算出してキャンバスを伸ばす
    const durationSec = audioDurationSec();
    if (durationSec > 0) {
      const audioMaxTick = secondsToTick(durationSec);
      m = Math.max(m, audioMaxTick);
    }

    // 音声がなくても常に最後尾からさらに20小節分の余白（キャンバス領域）を確保する
    // これにより、音声未読み込み状態でもスクロールして無限にノーツを配置し続けられる
    return m + (resolution * 4 * 20);
  }
  function contentHeight(){ return tickToY(maxContentTick()); }
  function contentWidth(){ return RULER_W + laneCount*LANE_W + 150; } // +150 for waveform space

  function resizeCanvas(){
    const w = contentWidth();
    const h = Math.max(400, contentHeight());
    const dpr = window.devicePixelRatio || 1;
    el.gridCanvas.style.width = w+'px';
    el.gridCanvas.style.height = h+'px';
    el.gridCanvas.width = Math.round(w*dpr);
    el.gridCanvas.height = Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  // ---------------------------------------------------------------
  // Tick <-> time (seconds) conversion, using BPM segments
  // ---------------------------------------------------------------
  function sortedBpms(){ return (chart.timing.bpms||[{tick:0,bpm:120}]).slice().sort((a,b)=>a.tick-b.tick); }

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

  // ---------------------------------------------------------------