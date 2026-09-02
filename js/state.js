// State
  // ---------------------------------------------------------------
  let chart = null;

  let isSwapVisualizeMode = false;
  let isCenterSpaceMode = false;
  let laneStateHistory = [];

  let lastMutatorHash = "";
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
    let currentV = [0, 1, 2, 3, 4, 5, 6]; 
    let currentR = [0, 1, 2, 3, 4, 5, 6];
    laneStateHistory.push({ tick: -1, V: [...currentV], R: [...currentR] });
    
    mutators.sort((a,b) => a.tick - b.tick || a.id - b.id);
    
    for (const m of mutators) {
      let V = [...currentV];
      let R = [...currentR];
      
      if (m.type === 'scramble') {
        const swap = (i, j) => {
          const temp = V[i]; V[i] = V[j]; V[j] = temp;
          R[V[i]] = i; R[V[j]] = j;
        };
        swap(0, 5); swap(1, 4); swap(2, 3);
      } else if (m.type === 'swap') {
        const swap = (i, j) => {
          const temp = V[i]; V[i] = V[j]; V[j] = temp;
          R[V[i]] = i; R[V[j]] = j;
        };
        if (m.lane === 0) swap(1, 2);
        else if (m.lane === 5) swap(3, 4);
        else if (m.lane === 6) swap(2, 3);
      }
      
      currentV = V; currentR = R;
      laneStateHistory.push({ tick: m.tick, V, R });
    }
  }

  function getLaneMapping(tick) {
    let low = 0;
    let high = laneStateHistory.length - 1;
    let res = laneStateHistory[0];
    
    while (low <= high) {
      let mid = (low + high) >> 1;
      if (laneStateHistory[mid].tick < tick) {
        res = laneStateHistory[mid];
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return res;
  }

  function getVisualLane(n, targetTick) {
    if (!isSwapVisualizeMode) return n.lane;
    if (!isSwapVisualizedNote(n)) return n.lane;
    return getLaneMapping(targetTick).V[n.lane];
  }

  function isValidPlacement(type, lane) {
    if (lane < 0 || lane >= laneCount) return false;
    if (type === 'swap' && ![0, 5, 6].includes(lane)) return false;
    if (lane === 6 && !['swap', 'hold', 'scramble'].includes(type)) return false;
    if (type === 'scramble' && lane !== 6) return false;
    return true;
  }

  function getInternalLaneForNewNote(visualLane, type, targetTick) {
    if (!isSwapVisualizeMode) return visualLane;
    if (!isSwapVisualizedNote({ type, lane: visualLane })) return visualLane;
    return getLaneMapping(targetTick).R[visualLane];
  }

  // Hold / Shift notes are fixed in the existing visualization model. Mutator
  // notes remain visible through swaps, but must never be rewritten by the
  // simulator because their lanes define the mapping itself.
  function isSwapVisualizedNote(n) {
    return n.lane >= 0 && n.lane <= 5 && n.type !== 'hold' && n.type !== 'shift';
  }
  function isSwapSimulationTarget(n) {
    return isSwapVisualizedNote(n) && n.type !== 'swap' && n.type !== 'scramble';
  }
  let currentFileHandle = null;
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
  let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let seekBarDragging = false;

  // 削除されたフィールド (m_subtitle, m_genre, m_previewStart, m_previewDuration) をリストから除外
  const el = {};
  ['fileInput','btnLoad','btnLoad2','btnNew','btnExport','btnMeta','btnAudio','audioInput',
   'btnUndo','btnRedo','snapSelect','btnSettings','swapVisualizeToggle','centerSpaceToggle','zoomIn','zoomOut','zoomLabel','filenameLabel',
   'gridArea','emptyState','laneHeader','scrollWrap','gridCanvas','metaStats','noteCounts',
   'inspector','statTick','statBeat','statLane','statCount','statLength','hintBody','hintTitle',
   'transport','btnPlayPause','playbackRateSelect','timeLabel','seekBar','audioFileLabel','audioEl',
   'metaModalOverlay','metaCancel','metaSave','settingsModalOverlay','settingsClose','btnSwapSimulator',
   'm_id','m_title','m_artist','m_charter','m_diffName','m_diffLevel',
   'm_bpm','m_timeSigNumerator','m_timeSigDenominator','m_audioOffset','m_resolution',
   'editorMainContainer','minimapWrap','minimapCanvas'
  ].forEach(id=>{ el[id] = document.getElementById(id); });
  
  el.typeButtons = Array.from(document.querySelectorAll('.type-btn'));
  el.modeButtons = Array.from(document.querySelectorAll('.mode-btn'));
  const ctx = el.gridCanvas.getContext('2d');
  const audio = el.audioEl;

  // ---------------------------------------------------------------
