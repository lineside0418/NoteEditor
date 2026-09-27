// State
  // ---------------------------------------------------------------
  let chart = null;

  // MusicPackage is the owner of song-wide metadata and of the chart path.
  let packageContext = null;
  let selectedChartDifficulty = "high";

  let isSwapVisualizeMode = false;
  let isCenterSpaceMode = false;
  let laneStateHistory = [];
  const SUPPORTED_NOTE_TYPES = new Set(['tap','hold','trace','swap','shift','scramble']);

  let lastMutatorHash = "";
  function createLaneMapping(){
    return { normal: [0,1,2,3,4,5,6], noSwap: [0,1,2,3,4,5,6] };
  }
  function cloneLaneMapping(mapping){
    return { normal: [...mapping.normal], noSwap: [...mapping.noSwap] };
  }
  function swapVisualPositions(mapping, first, second, target){
    const lanes = target === 'both' ? [mapping.normal, mapping.noSwap] : [mapping.normal];
    lanes.forEach(lanesAtVisualPosition => {
      [lanesAtVisualPosition[first], lanesAtVisualPosition[second]] = [lanesAtVisualPosition[second], lanesAtVisualPosition[first]];
    });
  }
  function applySwapMapping(mapping, logicalLane){
    const triggerVisualLane = mapping.normal.indexOf(logicalLane);
    if(triggerVisualLane === 0) swapVisualPositions(mapping, 1, 2, 'normal');
    else if(triggerVisualLane === 5) swapVisualPositions(mapping, 3, 4, 'normal');
    else if(triggerVisualLane === 6) swapVisualPositions(mapping, 2, 3, 'normal');
  }
  function applyScrambleMapping(mapping){
    swapVisualPositions(mapping, 0, 5, 'both');
    swapVisualPositions(mapping, 1, 4, 'both');
    swapVisualPositions(mapping, 2, 3, 'both');
  }
  function compareGameOrder(a,b){
    return a.tick - b.tick || a.lane - b.lane || a.id - b.id;
  }
  function rebuildLaneStates() {
    if (!chart || !chart.notes) return;
    
    const mutators = chart.notes.filter(n => n.type === 'swap' || n.type === 'scramble');
    let hash = "";
    for (let i = 0; i < mutators.length; i++) {
      hash += mutators[i].id + ":" + mutators[i].type + ":" + mutators[i].tick + ":" + mutators[i].lane + ",";
    }
    if (hash === lastMutatorHash && laneStateHistory.length > 0) return;
    lastMutatorHash = hash;
    
    laneStateHistory = [];
    let current = createLaneMapping();
    laneStateHistory.push({ tick: -1, mapping: cloneLaneMapping(current) });
    
    mutators.sort(compareGameOrder);
    
    for (const m of mutators) {
      if (m.type === 'scramble') applyScrambleMapping(current);
      else applySwapMapping(current, m.lane);
      laneStateHistory.push({ tick: m.tick, mapping: cloneLaneMapping(current) });
    }
  }

  function getLaneMappingAt(tick, includeCurrentTick) {
    let low = 0;
    let high = laneStateHistory.length - 1;
    let res = laneStateHistory[0];
    
    while (low <= high) {
      let mid = (low + high) >> 1;
      if (laneStateHistory[mid].tick < tick || (includeCurrentTick && laneStateHistory[mid].tick === tick)) {
        res = laneStateHistory[mid];
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return res.mapping;
  }
  // Gimmicks affect only later ticks in the editor specification.
  function getLaneMappingBeforeTick(tick){ return getLaneMappingAt(tick, false); }
  function getLaneMappingAfterTick(tick){ return getLaneMappingAt(tick, true); }
  function getLaneMapping(tick){ return getLaneMappingAfterTick(tick); }

  function laneMappingForNote(n){
    return getLaneMappingBeforeTick(n.tick);
  }
  function mappingNameForType(type){ return type === 'hold' || type === 'shift' ? 'noSwap' : 'normal'; }
  // Always resolves the game-time physical lane, even when visualization is off.
  function getRuntimeVisualLane(n) {
    const mapping = laneMappingForNote(n)[mappingNameForType(n.type)];
    const visualLane = mapping.indexOf(n.lane);
    return visualLane >= 0 ? visualLane : n.lane;
  }
  function getVisualLane(n) {
    if (!isSwapVisualizeMode) return n.lane;
    return getRuntimeVisualLane(n);
  }

  function isValidPlacement(type, lane) {
    if (lane < 0 || lane >= laneCount) return false;
    if (type === 'swap' && ![0, 5, 6].includes(lane)) return false;
    if (lane === 6 && !['swap', 'hold', 'scramble'].includes(type)) return false;
    if (type === 'scramble' && lane !== 6) return false;
    return true;
  }

  function getInternalLaneForNewNote(visualLane, type, targetTick, noteId = Number.MAX_SAFE_INTEGER) {
    if (!isSwapVisualizeMode) return visualLane;
    rebuildLaneStates();
    const mapping = getLaneMappingBeforeTick(targetTick)[mappingNameForType(type)];
    return mapping[visualLane];
  }

  function doesHoldCrossScramble(type, startTick, endTick){
    if(type !== 'hold' && type !== 'shift') return false;
    return (chart.notes||[]).some(n => n.type === 'scramble' && n.tick > startTick && n.tick < endTick);
  }
  function findHoldCrossingScramble(){
    return (chart && chart.notes || []).find(n => doesHoldCrossScramble(n.type, n.tick, n.endTick)) || null;
  }
  function findInvalidNotePlacement(){
    return (chart && chart.notes || []).find(n => !isValidPlacement(n.type, n.lane)) || null;
  }
  function ensureTickZero(entries, defaults){
    if(!entries.some(entry => entry.tick === 0)) entries.unshift({tick:0, ...defaults});
  }
  function normalizeChartTiming(timing){
    const normalized = ReInverseChartFormat.normalizeTiming(timing);
    Object.assign(timing, normalized);
  }

  function validatePackageContext(){
    const errors = [];
    if(!packageContext){
      errors.push("MusicPackageが選択されていません。");
      return errors;
    }
    if(!ReInverseChartFormat.isPackageKey(packageContext.packageKey)) errors.push("package_key は小文字kebab-caseである必要があります。");
    if(!packageContext.songdata || packageContext.songdata.format_version !== 3) errors.push("metadata/songdata.json は format_version 3 である必要があります。");
    if(!ReInverseChartFormat.difficultyInfo(selectedChartDifficulty)) errors.push("出力難易度が不正です。");
    return errors;
  }

  function validateChartSyntax(){
    const errors = [];
    if(!chart || !chart.metadata || !chart.timing) return ['譜面データが不完全です。'];
    if(chart.metadata.laneCount !== 7) errors.push('laneCount は 7 である必要があります。');
    if(typeof chart.metadata.charter !== 'string' || chart.metadata.charter.trim() === '') errors.push('metadata.charter は空にできません。');
    const difficultyLevel = Number(chart.metadata.difficulty && chart.metadata.difficulty.level);
    if(!Number.isFinite(difficultyLevel) || difficultyLevel <= 0) errors.push('metadata.difficulty.level は0より大きい必要があります。');
    ReInverseChartFormat.legacyMetadataFields(chart.metadata).forEach(field => errors.push(`${field} は旧フィールドです。保存時に削除されます。`));
    if(Object.prototype.hasOwnProperty.call(chart.metadata, 'grid_offset') && !ReInverseChartFormat.isFiniteInteger(chart.metadata.grid_offset)) errors.push('metadata.grid_offset は有限の整数である必要があります。');
    if(!Number.isInteger(chart.metadata.resolution) || chart.metadata.resolution < 1) errors.push('resolution は1以上の整数である必要があります。');
    const timing = chart.timing;
    const bpm0 = (timing.bpms||[]).find(b => b.tick === 0);
    if(!bpm0 || !Number.isFinite(bpm0.bpm) || bpm0.bpm <= 0) errors.push('Tick 0の有効なBPMが必要です。');
    // scrolls and timeSignatures are valid when empty in MusicPackages v3.
    errors.push(...validatePackageContext());
    ['bpms','scrolls','timeSignatures','stops'].forEach(key => {
      (timing[key]||[]).forEach(entry => { if(!Number.isInteger(entry.tick) || entry.tick < 0) errors.push(`${key} に無効なTickがあります。`); });
    });
    (timing.timeSignatures||[]).forEach(entry => {
      if(!Number.isInteger(entry.numerator) || entry.numerator < 1 || !Number.isInteger(entry.denominator) || entry.denominator < 1) errors.push('timeSignatures の分子・分母は正の整数である必要があります。');
    });
    const ids = new Set();
    const positions = new Set();
    rebuildLaneStates();
    (chart.notes||[]).forEach(note => {
      if(!Number.isInteger(note.id) || ids.has(note.id)) errors.push(`ノーツID ${note.id} が重複または不正です。`);
      ids.add(note.id);
      if(!SUPPORTED_NOTE_TYPES.has(note.type)) errors.push(`ID ${note.id} のtype ${note.type} は未対応です。`);
      if(!Number.isInteger(note.tick) || note.tick < 0) errors.push(`ID ${note.id} のTickが不正です。`);
      if(!Number.isInteger(note.lane) || note.lane < 0 || note.lane > 6 || !isValidPlacement(note.type, note.lane)) errors.push(`ID ${note.id} のレーンが不正です。`);
      const visualLane = getRuntimeVisualLane(note);
      const position = `${note.tick}:${visualLane}`;
      if(positions.has(position)) errors.push(`Tick ${note.tick} / 実行レーン ${visualLane+1} に重複ノーツがあります。`);
      positions.add(position);
      if((note.type === 'hold' || note.type === 'shift') && (!Number.isInteger(note.endTick) || note.endTick <= note.tick)) errors.push(`ID ${note.id} の終端Tickが不正です。`);
    });
    const longNotes = (chart.notes||[]).filter(note =>
      (note.type === 'hold' || note.type === 'shift') &&
      Number.isInteger(note.endTick) && note.endTick > note.tick
    );
    longNotes.forEach(longNote => {
      const longVisualLane = getRuntimeVisualLane(longNote);
      (chart.notes||[]).forEach(note => {
        if(note.id === longNote.id || note.tick < longNote.tick || note.tick > longNote.endTick) return;
        if(getRuntimeVisualLane(note) === longVisualLane){
          errors.push(`ID ${longNote.id} のロングノーツ区間が ID ${note.id} と実行レーン ${longVisualLane+1} で重なっています。`);
        }
      });
    });
    if(findHoldCrossingScramble()) errors.push('SCRAMBLEをまたぐHOLDまたはSHIFTがあります。');
    return [...new Set(errors)];
  }
  function showChartSyntaxCheck(){
    if(!chart){
      alert('譜面を読み込んでから構文チェックを実行してください。');
      return;
    }
    const errors = validateChartSyntax();
    if(errors.length === 0){
      alert('構文チェック: 問題は見つかりませんでした。');
      return;
    }
    alert(`構文チェック: ${errors.length} 件の問題があります。\n\n${errors.slice(0, 20).join('\n')}${errors.length > 20 ? `\nほか ${errors.length - 20} 件` : ''}\n\nこの結果は書き出しを妨げません。`);
  }
  let filename = 'chart.json';
  let laneCount = 7;
  let resolution = 960;
  let zoom = 1.0;
  let snapN = 16;
  let selectedType = 'tap';
  let pointerMode = 'place'; // 'place' | 'select'
  let selectedIds = new Set();
  let lastClickedId = null;
  let history = [];
  let redoStack = [];
  let drag = null;
  let clipboard = null;

  // audio
  let audioObjectUrl = null;
  let currentAudioTime = 0;
  let rafHandle = null;
  let audioBuffer = null;
  let waveformData = null;
  let audioLoadGeneration = 0;
  let suppressNextScrollDraw = false;
  let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let seekBarDragging = false;

  // 削除されたフィールド (m_subtitle, m_genre, m_previewStart, m_previewDuration) をリストから除外
  const el = {};
  ['fileInput','btnLoad','btnLoad2','btnNew','btnPackage','btnExport','btnDownload','btnMeta','btnAudio','audioInput',
   'btnUndo','btnRedo','snapSelect','btnSettings','swapVisualizeToggle','centerSpaceToggle','zoomIn','zoomOut','zoomLabel','filenameLabel','packageDifficulty',
   'gridArea','emptyState','laneHeader','scrollWrap','gridCanvas','metaStats','noteCounts','packageLabel',
   'inspector','statTick','statBeat','statLane','statCount','statLength','hintBody','hintTitle',
   'transport','btnPlayPause','playbackRateSelect','timeLabel','seekBar','audioFileLabel','audioEl',
   'metaModalOverlay','metaCancel','metaSave','settingsModalOverlay','settingsClose','btnSwapSimulator','btnSyntaxCheck',
   'm_charter','m_diffLevel',
   'm_bpm','m_timeSigNumerator','m_timeSigDenominator','m_audioOffset','m_gridOffset','m_resolution',
   'editorMainContainer','minimapWrap','minimapCanvas'
  ].forEach(id=>{ el[id] = document.getElementById(id); });
  
  el.typeButtons = Array.from(document.querySelectorAll('.type-btn'));
  el.modeButtons = Array.from(document.querySelectorAll('.mode-btn'));
  const ctx = el.gridCanvas.getContext('2d');
  const audio = el.audioEl;

  // ---------------------------------------------------------------
