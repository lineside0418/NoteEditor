
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
        types: [{
          description: 'Chart / MCZ Files',
          accept: { 'application/json': ['.json'], 'application/zip': ['.mcz'] }
        }],
      });
      const file = await fileHandle.getFile();
      if(file.name.toLowerCase().endsWith('.mcz')) {
        await loadMczChartFile(file);
      } else {
        const text = await file.text();
        loadChart(JSON.parse(text), file.name);
      }
    } catch(err) {
      if (err.name !== 'AbortError') alert('ファイルの読み込みに失敗しました: ' + err.message);
    }
  }

  function onFileChosen(e){
    const file = e.target.files[0];
    if(!file) return;
    if(file.name.toLowerCase().endsWith('.mcz')){
      el.fileInput.value = '';
      loadMczChartFile(file).catch(err => alert('MCZファイルの読み込みに失敗しました: ' + err.message));
      return;
    }
    const reader = new FileReader();
    reader.onload = ()=>{
      try{ loadChart(JSON.parse(reader.result), file.name); }
      catch(err){ alert('JSONの読み込みに失敗しました: '+err.message); }
    };
    reader.readAsText(file);
    el.fileInput.value = '';
  }

  // 新しいJSON構造に合わせたデフォルトデータを生成するよ
  // Converter と同じ選択規則で MCZ を開き、変換結果をダウンロードせずエディタへ渡す。
  async function loadMczChartFile(file){
    if(typeof JSZip === 'undefined'){
      throw new Error('MCZ展開ライブラリを読み込めませんでした。ネットワーク接続を確認して再読み込みしてください。');
    }
    const zip = await JSZip.loadAsync(file);
    const paths = Object.keys(zip.files);
    let maxFolderDigit = -1;
    let folderPrefix = '';
    paths.forEach(path => {
      const match = path.match(/^(\d)\//);
      if(!match) return;
      const digit = Number.parseInt(match[1], 10);
      if(digit > maxFolderDigit){
        maxFolderDigit = digit;
        folderPrefix = match[1] + '/';
      }
    });
    if(maxFolderDigit < 0) throw new Error('数字フォルダが見つかりませんでした。');

    let highestChartNumber = -1;
    let chartPath = null;
    paths.forEach(path => {
      if(!path.startsWith(folderPrefix)) return;
      const filename = path.slice(folderPrefix.length);
      const match = filename.match(/^(\d+)\.mc$/i);
      if(!match) return;
      const chartNumber = Number.parseInt(match[1], 10);
      if(chartNumber > highestChartNumber){
        highestChartNumber = chartNumber;
        chartPath = path;
      }
    });
    if(!chartPath) throw new Error('対象の .mc ファイルが見つかりませんでした。');

    let source;
    try {
      source = JSON.parse(await zip.files[chartPath].async('string'));
    } catch(err) {
      throw new Error(`MCZ内の ${chartPath} をJSONとして読み込めませんでした: ${err.message}`);
    }
    await loadChart(convertLegacyChartToRicf1(source), file.name.replace(/\.mcz$/i, '_ricf1.json'));
  }

  function convertLegacyChartToRicf1(source){
    const converterResolution = 960;
    let metadata;
    let timing;
    const notes = [];

    if(source.meta && Array.isArray(source.note)){
      metadata = {
        id: source.meta.version || '001',
        title: source.meta.song && source.meta.song.title || 'Unknown Title',
        artist: source.meta.song && source.meta.song.artist || '',
        charter: source.meta.creator || '',
        difficulty: { name: source.meta.version || 'Low', level: 1 },
        audio: { offset: 0 }, laneCount: 7, resolution: converterResolution
      };
      timing = {
        bpms: [], scrolls: [{tick:0, speed:1}],
        timeSignatures: [{tick:0, numerator:4, denominator:4}], stops: []
      };
      if(Array.isArray(source.time)){
        source.time.forEach(entry => {
          if(!Array.isArray(entry.beat) || !Number.isFinite(entry.bpm)) return;
          const beat = entry.beat[0] + (entry.beat[2] > 0 ? entry.beat[1] / entry.beat[2] : 0);
          timing.bpms.push({tick:Math.round(beat * converterResolution), bpm:entry.bpm});
        });
      }
      if(timing.bpms.length === 0) timing.bpms.push({tick:0, bpm:120});
      source.note.forEach(entry => {
        if(!Number.isFinite(entry.column) || !Array.isArray(entry.beat)) return;
        const beat = entry.beat[0] + (entry.beat[2] > 0 ? entry.beat[1] / entry.beat[2] : 0);
        let lane = entry.column;
        if(lane === 3) lane = 6;
        else if(lane === 4) lane = 3;
        else if(lane === 5) lane = 4;
        else if(lane === 6) lane = 5;
        const note = {id:0, tick:Math.round(beat * converterResolution), lane, type:'tap', size:1};
        if(Array.isArray(entry.endbeat)){
          const endBeat = entry.endbeat[0] + (entry.endbeat[2] > 0 ? entry.endbeat[1] / entry.endbeat[2] : 0);
          note.type = 'hold';
          note.endTick = Math.round(endBeat * converterResolution);
        }
        notes.push(note);
      });
    } else {
      metadata = {
        id: source.name || '001', title: source.name || 'Unknown Title', artist:'', charter:'',
        difficulty:{name:'Low', level:1}, audio:{offset:Number.isFinite(source.offset) ? source.offset : 0},
        laneCount:7, resolution:converterResolution
      };
      timing = {
        bpms:[{tick:0, bpm:Number.isFinite(source.BPM) ? source.BPM : 120}],
        scrolls:[{tick:0, speed:1}], timeSignatures:[{tick:0, numerator:4, denominator:4}], stops:[]
      };
      if(Array.isArray(source.notes)){
        source.notes.forEach(entry => {
          if(!Number.isFinite(entry.num) || !Number.isFinite(entry.LPB) || !Number.isFinite(entry.block)) return;
          const tick = Math.round(entry.num / entry.LPB * converterResolution);
          const note = {id:0, tick, lane:entry.block, type:entry.type === 2 ? 'hold' : 'tap', size:1};
          if(note.type === 'hold'){
            const end = Array.isArray(entry.notes) && entry.notes[0];
            note.endTick = end && Number.isFinite(end.num) && Number.isFinite(end.LPB)
              ? Math.round(end.num / end.LPB * converterResolution)
              : tick + converterResolution;
          }
          notes.push(note);
        });
      }
    }
    notes.sort((a,b) => a.tick - b.tick || a.lane - b.lane);
    notes.forEach((note, index) => { note.id = index + 1; });
    return {version:1, metadata, timing, notes, events:[]};
  }

  function createNewChart(){
    const data = {
      version: 1,
      metadata: {
        id: "001", title: "無題の譜面", artist: "", charter: "",
        difficulty: { name: "Low", level: 1 },
        audio: { offset: 0 },
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

  
  async function loadChart(data, name){
    if(!data || typeof data !== 'object'){ alert('不正なJSONです'); return; }
    if(!Array.isArray(data.notes)) data.notes = [];
    if(!data.metadata) data.metadata = {};
    if(!data.timing) data.timing = {};
    normalizeChartTiming(data.timing);
    if(!Array.isArray(data.events)) data.events = [];
    if(!Number.isInteger(data.version)) data.version = 1;
    data.metadata.audio = { offset: Number.isFinite(Number(data.metadata.audio && data.metadata.audio.offset)) ? Number(data.metadata.audio.offset) : 0 };
    delete data.metadata.jacket;
    if(!data.metadata.difficulty) data.metadata.difficulty = {name:'Low', level:1};

    data.metadata.laneCount = 7;

    chart = data;
    filename = name || 'chart.json';
    laneCount = 7;
    if(!Number.isInteger(chart.metadata.resolution) || chart.metadata.resolution < 1) chart.metadata.resolution = 960;
    resolution = chart.metadata.resolution;

    const crossingHold = findHoldCrossingScramble();
    if(crossingHold) alert(`ID ${crossingHold.id} の${crossingHold.type.toUpperCase()}がSCRAMBLEをまたいでいます。修正するまで書き出しできません。`);
    const invalidPlacement = findInvalidNotePlacement();
    if(invalidPlacement) alert(`ID ${invalidPlacement.id} の${invalidPlacement.type.toUpperCase()}は、このレーンへ配置できません。修正するまで書き出しできません。`);

    if (audioObjectUrl) {
      URL.revokeObjectURL(audioObjectUrl);
      audioObjectUrl = null;
    }
    audio.removeAttribute('src');
    audio.load();
    audioLoadGeneration++;
    audioBuffer = null;
    waveformData = null;
    currentAudioTime = 0;
    nextHitSoundIndex = 0;
    lastHitSoundTime = -1;
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
    el.btnSettings.disabled = false;
    el.emptyState.style.display = 'none';
    el.laneHeader.style.display = 'flex';
    el.editorMainContainer.style.display = 'flex';

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
    const difficultyLevel = Number(m.difficulty && m.difficulty.level);
    el.m_diffLevel.value = Number.isFinite(difficultyLevel) ? difficultyLevel.toFixed(2) : '0.00';
    el.m_audioOffset.value = (m.audio&&m.audio.offset!=null)?m.audio.offset:0;
    const bpm0 = (chart.timing.bpms||[]).find(b=>b.tick===0) || {bpm:120};
    const timeSignature0 = (chart.timing.timeSignatures||[]).find(t=>t.tick===0) || {numerator:4,denominator:4};
    el.m_bpm.value = bpm0.bpm;
    el.m_timeSigNumerator.value = timeSignature0.numerator;
    el.m_timeSigDenominator.value = timeSignature0.denominator;
    el.m_resolution.value = m.resolution||960;
    el.metaModalOverlay.classList.add('open');
  }
  function closeMetaModal(){ el.metaModalOverlay.classList.remove('open'); }
  el.metaCancel.addEventListener('click', closeMetaModal);
  el.metaModalOverlay.addEventListener('click', (e)=>{ if(e.target===el.metaModalOverlay) closeMetaModal(); });

  el.metaSave.addEventListener('click', ()=>{
    const newResolution = parseInt(el.m_resolution.value,10);
    const bpm = parseFloat(el.m_bpm.value);
    const numerator = parseInt(el.m_timeSigNumerator.value,10);
    const denominator = parseInt(el.m_timeSigDenominator.value,10);
    const difficultyLevel = parseFloat(el.m_diffLevel.value);
    if(!Number.isInteger(newResolution) || newResolution<1 || !Number.isFinite(bpm) || bpm<=0 || !Number.isInteger(numerator) || numerator<1 || !Number.isInteger(denominator) || denominator<1 || !Number.isFinite(difficultyLevel) || difficultyLevel<0){
      alert('resolution、BPM、拍子には正の数を入力してください。');
      return;
    }

    chart.metadata.id = el.m_id.value;
    chart.metadata.title = el.m_title.value;
    chart.metadata.artist = el.m_artist.value;
    chart.metadata.charter = el.m_charter.value;
    chart.metadata.difficulty = { name: el.m_diffName.value, level: Math.round(difficultyLevel * 100) / 100 };
    chart.metadata.audio = { offset: parseFloat(el.m_audioOffset.value)||0 };
    delete chart.metadata.jacket;
    chart.metadata.laneCount = 7;
    chart.metadata.resolution = newResolution;

    const bpmIndex = chart.timing.bpms.findIndex(b=>b.tick===0);
    if(bpmIndex >= 0) chart.timing.bpms[bpmIndex].bpm = bpm;
    else chart.timing.bpms.push({tick:0,bpm});
    const timeSignatureIndex = chart.timing.timeSignatures.findIndex(t=>t.tick===0);
    if(timeSignatureIndex >= 0) Object.assign(chart.timing.timeSignatures[timeSignatureIndex], {numerator, denominator});
    else chart.timing.timeSignatures.push({tick:0,numerator,denominator});

    laneCount = 7;
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
    const loadGeneration = ++audioLoadGeneration;
    audioBuffer = null;
    waveformData = null;
    nextHitSoundIndex = 0;
    lastHitSoundTime = -1;
    audio.src = audioObjectUrl;
    if(chart) updateMetaStats();
    el.audioFileLabel.textContent = file.name + " (Loading waveform...)";
    el.transport.classList.remove('disabled');
    el.btnPlayPause.disabled = false;
    el.seekBar.disabled = false;
    el.playbackRateSelect.disabled = false;
    e.target.value = '';
    if(chart) draw();

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        const decodedBuffer = await audioCtx.decodeAudioData(ev.target.result);
        if(loadGeneration !== audioLoadGeneration) return;
        audioBuffer = decodedBuffer;
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
  let audioContextOffset = 0;
  
  function syncAudioContext() {
    if (!audio.paused) {
      audioContextOffset = audioCtx.currentTime - (audio.currentTime / (audio.playbackRate || 1));
    }
  }

  audio.addEventListener('play', ()=>{ 
    syncAudioContext();
    el.btnPlayPause.innerHTML='<span class="material-symbols-outlined">pause</span>'; 
    startRaf(); 
  });
  audio.addEventListener('seeked', syncAudioContext);
  audio.addEventListener('ratechange', syncAudioContext);

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
    currentAudioTime = audio.currentTime;
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
        let preciseTime = audio.currentTime || 0;
        if (!audio.paused) {
          preciseTime = (audioCtx.currentTime - audioContextOffset) * (audio.playbackRate || 1);
        }
        currentAudioTime = preciseTime;
        draw();
        const curTick = tickForAudioTime(preciseTime);
        const py = tickToY(curTick);
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
    const validationErrors = validateChartForExport();
    if(validationErrors.length){
      alert(`書き出しできません。\n\n${validationErrors.slice(0, 10).join('\n')}${validationErrors.length > 10 ? `\nほか ${validationErrors.length - 10} 件` : ''}`);
      return;
    }
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
    normalizeChartTiming(chart.timing);
    const sorted = sortedNotes();
    const out = Object.assign({}, chart, { notes: sorted, events: (chart.events||[]).slice().sort((a,b)=>(a.tick||0)-(b.tick||0)) });
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
      const saveHandle = await window.showSaveFilePicker({
        suggestedName: filename.endsWith('.json') ? filename : filename + '.json',
        types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
      });
      const writable = await saveHandle.createWritable();
      await writable.write(jsonStr);
      await writable.close();
      
      const file = await saveHandle.getFile();
      filename = file.name;
      el.filenameLabel.textContent = filename;
    } catch(err) {
      if (err.name !== 'AbortError') alert('保存に失敗しました: ' + err.message);
    }
  }
