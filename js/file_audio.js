
  let nextHitSoundIndex = 0;
  let lastHitSoundTime = -1;

  function scheduleHitSounds(curTime) {
    if (!chart || !chart.notes) return;
    const sorted = sortedNotes(); // Maybe cache this? It's fine for now.
    const lookaheadSec = 0.1;
    const endAudioTime = curTime + lookaheadSec;
    
    // Detect seek (jump in time)
    if (Math.abs(curTime - lastHitSoundTime) > 0.5 && lastHitSoundTime !== -1) {
      const curTick = tickForAudioTime(curTime);
      nextHitSoundIndex = sorted.findIndex(n => n.tick >= curTick);
      if (nextHitSoundIndex === -1) nextHitSoundIndex = sorted.length;
    }
    lastHitSoundTime = curTime;
    
    while(nextHitSoundIndex < sorted.length) {
      const n = sorted[nextHitSoundIndex];
      const noteTime = audioTimeForTick(n.tick);
      if (noteTime > endAudioTime) break;
      
      if (noteTime >= curTime) {
        // Schedule beep
        const scheduleTime = audioCtx.currentTime + (noteTime - curTime) / audio.playbackRate;
        playTickSound(scheduleTime);
      }
      nextHitSoundIndex++;
    }
  }

  function playTickSound(time) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.05);
    
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(time);
    osc.stop(time + 0.05);
  }

// File load / new chart
  // ---------------------------------------------------------------
  
  async function openChartFile(){
    if (!window.showOpenFilePicker) {
      el.fileInput.click();
      return;
    }
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
      });
      const file = await fileHandle.getFile();
      const text = await file.text();
      currentFileHandle = fileHandle;
      loadChart(JSON.parse(text), file.name);
    } catch(err) {
      if (err.name !== 'AbortError') alert('ファイルの読み込みに失敗しました: ' + err.message);
    }
  }

  function onFileChosen(e){
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{ loadChart(JSON.parse(reader.result), file.name); }
      catch(err){ alert('JSONの読み込みに失敗しました: '+err.message); }
    };
    reader.readAsText(file);
    el.fileInput.value = '';
  }

  // 新しいJSON構造に合わせたデフォルトデータを生成するよ
  function createNewChart(){
    currentFileHandle = null;
    const data = {
      version: 1,
      metadata: {
        id: "001", title: "無題の譜面", artist: "", charter: "",
        difficulty: { name: "Low", level: 1 },
        audio: { file: "", offset: 0 },
        jacket: { file: "" },
        laneCount: 7, resolution: 960
      },
      timing: {
        bpms: [{ tick: 0, bpm: 120.0 }],
        scrolls: [{ tick: 0, speed: 1.0 }],
        timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
        stops: []
      },
      notes: [], events: []
    };
    loadChart(data, 'new_chart.json');
  }

  
  function askConvertFormat() {
    return new Promise(resolve => {
      const overlay = document.getElementById('convertModalOverlay');
      const acceptBtn = document.getElementById('convertAccept');
      const cancelBtn = document.getElementById('convertCancel');
      
      overlay.classList.add('open');
      
      function cleanup() {
        acceptBtn.removeEventListener('click', onAccept);
        cancelBtn.removeEventListener('click', onCancel);
        overlay.classList.remove('open');
      }
      function onAccept() { cleanup(); resolve(true); }
      function onCancel() { cleanup(); resolve(false); }
      
      acceptBtn.addEventListener('click', onAccept);
      cancelBtn.addEventListener('click', onCancel);
    });
  }

  async function loadChart(data, name){
    if(!data || typeof data !== 'object'){ alert('不正なJSONです'); return; }
    if(!Array.isArray(data.notes)) data.notes = [];
    if(!data.metadata) data.metadata = {};
    if(!data.timing) data.timing = {bpms:[{tick:0,bpm:120}], scrolls:[], timeSignatures:[{tick:0,numerator:4,denominator:4}], stops:[]};
    if(!data.metadata.audio) data.metadata.audio = {file:'', offset:0};
    if(!data.metadata.jacket) data.metadata.jacket = {file:''};
    if(!data.metadata.difficulty) data.metadata.difficulty = {name:'Low', level:1};

    let incomingLaneCount = data.metadata.laneCount || 6;
    if (incomingLaneCount < 7) {
      const doConvert = await askConvertFormat();
      if (doConvert) {
        data.metadata.laneCount = 7;
        incomingLaneCount = 7;
      }
      data.metadata.laneCount = 7;
      incomingLaneCount = 7;
    }

    chart = data;
    filename = name || 'chart.json';
    laneCount = incomingLaneCount;
    resolution = chart.metadata.resolution || 960;

    if (audioObjectUrl) {
      URL.revokeObjectURL(audioObjectUrl);
      audioObjectUrl = null;
    }
    audio.removeAttribute('src');
    audio.load();
    el.audioFileLabel.textContent = '音声未読み込み';
    el.transport.classList.add('disabled');
    el.btnPlayPause.disabled = true;
    el.seekBar.disabled = true;
    el.playbackRateSelect.disabled = true;
    el.btnPlayPause.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
    stopRaf();
    el.timeLabel.textContent = '00:00 / 00:00';
    el.seekBar.value = 0;
    
    // エディタ情報はJSONから消えたから、今のUIの値を維持するね
    el.snapSelect.value = String(snapN);

    clearSelection();
    history = []; redoStack = [];
    updateHistoryButtons();

    el.filenameLabel.textContent = filename;
    el.btnExport.disabled = false;
    el.btnMeta.disabled = false;
    el.btnAudio.disabled = false;
    el.emptyState.style.display = 'none';
    el.laneHeader.style.display = 'flex';
    el.editorMainContainer.style.display = 'flex';
    el.scrollWrap.style.display = 'block';

    buildLaneHeader();
    resizeCanvas();
    draw();
    updateMetaStats();
    updateNoteCounts();
    updateInspector();
    updateFooterCounts();
  }

  function buildLaneHeader(){
    el.laneHeader.innerHTML = '';
    const rulerCell = document.createElement('div');
    rulerCell.className = 'ruler-cell';
    rulerCell.style.width = RULER_W+'px';
    el.laneHeader.appendChild(rulerCell);
    
    const visualOrder = [];
    if (isCenterSpaceMode) {
      visualOrder.push(0, 1, 2, 6, 3, 4, 5);
    } else {
      for(let i=0;i<laneCount;i++) visualOrder.push(i);
    }
    
    visualOrder.forEach(i => {
      const c = document.createElement('div');
      c.className = 'lane-cell';
      c.style.width = LANE_W+'px';
      c.textContent = i === 6 ? 'SPACE' : ('LANE '+(i+1));
      el.laneHeader.appendChild(c);
    });
  }

  // ---------------------------------------------------------------

// Metadata modal
  // ---------------------------------------------------------------
  // 不要になった入力フィールドのデータバインディングを消してるよ
  function openMetaModal(){
    if(!chart) return;
    const m = chart.metadata;
    el.m_id.value = m.id||'';
    el.m_title.value = m.title||'';
    el.m_artist.value = m.artist||'';
    el.m_charter.value = m.charter||'';
    el.m_diffName.value = (m.difficulty&&m.difficulty.name)||'';
    el.m_diffLevel.value = (m.difficulty&&m.difficulty.level!=null)?m.difficulty.level:0;
    el.m_audioFile.value = (m.audio&&m.audio.file)||'';
    el.m_audioOffset.value = (m.audio&&m.audio.offset!=null)?m.audio.offset:0;
    el.m_jacketFile.value = (m.jacket&&m.jacket.file)||'';
    el.m_laneCount.value = m.laneCount||6;
    el.m_resolution.value = m.resolution||960;
    el.metaModalOverlay.classList.add('open');
  }
  function closeMetaModal(){ el.metaModalOverlay.classList.remove('open'); }
  el.metaCancel.addEventListener('click', closeMetaModal);
  el.metaModalOverlay.addEventListener('click', (e)=>{ if(e.target===el.metaModalOverlay) closeMetaModal(); });

  el.metaSave.addEventListener('click', ()=>{
    const newLaneCount = parseInt(el.m_laneCount.value,10) || 6;
    const newResolution = parseInt(el.m_resolution.value,10) || 960;

    if(newLaneCount < laneCount){
      const orphaned = (chart.notes||[]).filter(n=>n.lane >= newLaneCount).length;
      if(orphaned>0){
        const ok = confirm(orphaned+' 件のノーツがレーン範囲外になります。続行しますか？');
        if(!ok) return;
      }
    }

    chart.metadata.id = el.m_id.value;
    chart.metadata.title = el.m_title.value;
    chart.metadata.artist = el.m_artist.value;
    chart.metadata.charter = el.m_charter.value;
    chart.metadata.difficulty = { name: el.m_diffName.value, level: parseFloat(el.m_diffLevel.value)||0 };
    chart.metadata.audio = {
      file: el.m_audioFile.value,
      offset: parseFloat(el.m_audioOffset.value)||0
    };
    chart.metadata.jacket = { file: el.m_jacketFile.value };
    chart.metadata.laneCount = newLaneCount;
    chart.metadata.resolution = newResolution;

    laneCount = newLaneCount;
    resolution = newResolution;

    buildLaneHeader();
    resizeCanvas();
    draw();
    updateMetaStats();
    updateFooterCounts();
    closeMetaModal();
  });

  // ---------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------
  function generateWaveformData() {
    if (!audioBuffer) return;
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const step = Math.floor(sampleRate / 100); // 100 samples per second (10ms resolution)
    waveformData = [];
    for (let i = 0; i < channelData.length; i += step) {
      let min = 0;
      let max = 0;
      for (let j = 0; j < step && i + j < channelData.length; j++) {
        const val = channelData[i + j];
        if (val < min) min = val;
        if (val > max) max = val;
      }
      waveformData.push({ min, max });
    }
  }

  function onAudioChosen(e){
    const file = e.target.files[0];
    if(!file) return;
    if(audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
    audioObjectUrl = URL.createObjectURL(file);
    audio.src = audioObjectUrl;
    if(chart){
      chart.metadata.audio = chart.metadata.audio || {};
      chart.metadata.audio.file = file.name;
      updateMetaStats();
    }
    el.audioFileLabel.textContent = file.name;
    el.audioFileLabel.textContent = file.name + " (Loading waveform...)";
    el.transport.classList.remove('disabled');
    el.btnPlayPause.disabled = false;
    el.seekBar.disabled = false;
    el.playbackRateSelect.disabled = false;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        audioBuffer = await audioCtx.decodeAudioData(ev.target.result);
        generateWaveformData();
        el.audioFileLabel.textContent = file.name;
        if(chart) draw();
      } catch (err) {
        console.error('Error decoding audio:', err);
        el.audioFileLabel.textContent = file.name + " (Waveform failed)";
      }
    };
    reader.readAsArrayBuffer(file);
  }

  audio.addEventListener('loadedmetadata', ()=>{
    el.seekBar.max = String(Math.floor(audio.duration*100));
    // ここでJSONにメタデータとして長さを保存するのをやめたよ
    updateTimeLabel();

    if(chart){
      resizeCanvas();
      draw();
      updateMetaStats();
      updateFooterCounts();
    }
  });
  audio.addEventListener('timeupdate', ()=>{
    if(!seekBarDragging){ el.seekBar.value = String(Math.floor(audio.currentTime*100)); }
    updateTimeLabel();
  });
  audio.addEventListener('play', ()=>{ el.btnPlayPause.innerHTML='<span class="material-symbols-outlined">pause</span>'; startRaf(); });
  let audioContextOffset = 0;
  audio.addEventListener('play', ()=>{ 
    audioContextOffset = audioCtx.currentTime - audio.currentTime;
    el.btnPlayPause.innerHTML='<span class="material-symbols-outlined">pause</span>'; 
    startRaf(); 
  });
  audio.addEventListener('seeked', () => {
    if (!audio.paused) {
      audioContextOffset = audioCtx.currentTime - audio.currentTime;
    }
  });
  audio.addEventListener('pause', ()=>{ el.btnPlayPause.innerHTML='<span class="material-symbols-outlined">play_arrow</span>'; stopRaf(); draw(); });
  audio.addEventListener('ended', ()=>{ el.btnPlayPause.innerHTML='<span class="material-symbols-outlined">play_arrow</span>'; stopRaf(); draw(); });

  el.btnPlayPause.addEventListener('click', togglePlay);
  function togglePlay(){
    if(!audio.src) return;
    if(audio.paused){
      // Reset hit sound index
      const curTick = tickForAudioTime(audio.currentTime||0);
      const sorted = sortedNotes();
      nextHitSoundIndex = sorted.findIndex(n => n.tick >= curTick);
      if (nextHitSoundIndex === -1) nextHitSoundIndex = sorted.length;
    }
    if(!audio.src) return;
    if(audioCtx.state === 'suspended') audioCtx.resume();
    if(audio.paused) audio.play(); else audio.pause();
  }

  el.seekBar.addEventListener('mousedown', ()=>{ seekBarDragging = true; });
  el.seekBar.addEventListener('input', ()=>{
    if(!audio.src) return;
    audio.currentTime = parseFloat(el.seekBar.value)/100;
    updateTimeLabel();
    draw();
  });
  el.seekBar.addEventListener('change', ()=>{ seekBarDragging = false; });

  function fmtTime(sec){
    if(!isFinite(sec) || sec<0) sec = 0;
    const m = Math.floor(sec/60), s = Math.floor(sec%60);
    return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }
  function updateTimeLabel(){
    el.timeLabel.textContent = fmtTime(audio.currentTime)+' / '+fmtTime(audio.duration||0);
  }

  function startRaf(){
    stopRaf();
    function loop(){
      if(chart){
        draw();
        const curTick = tickForAudioTime(audio.currentTime||0);
        const preciseTime = (!audio.paused) ? (audioCtx.currentTime - audioContextOffset) : (audio.currentTime || 0);
        const curTick = tickForAudioTime(preciseTime);
        const py = tickToY(curTick);
        scheduleHitSounds(audio.currentTime || 0);
        scheduleHitSounds(preciseTime);
        const wantTop = py - el.scrollWrap.clientHeight*0.3;
        el.scrollWrap.scrollTop = Math.max(0, wantTop);
      }
      rafHandle = requestAnimationFrame(loop);
    }
    rafHandle = requestAnimationFrame(loop);
  }
  function stopRaf(){ if(rafHandle){ cancelAnimationFrame(rafHandle); rafHandle=null; } }

  // ---------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------
  async function exportChart(){
    if(!chart) return;
    const sorted = sortedNotes();
    const out = Object.assign({}, chart, { notes: sorted });
    const jsonStr = JSON.stringify(out, null, 2);

    if (!window.showSaveFilePicker) {
      const blob = new Blob([jsonStr], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.json') ? filename : filename+'.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    try {
      if (!currentFileHandle) {
        currentFileHandle = await window.showSaveFilePicker({
          suggestedName: filename.endsWith('.json') ? filename : filename + '.json',
          types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
        });
      }
      const writable = await currentFileHandle.createWritable();
      await writable.write(jsonStr);
      await writable.close();
      
      const file = await currentFileHandle.getFile();
      filename = file.name;
      el.filenameLabel.textContent = filename;
    } catch(err) {
      if (err.name !== 'AbortError') alert('保存に失敗しました: ' + err.message);
    }
  }