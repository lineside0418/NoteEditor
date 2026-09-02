const fs = require('fs');

let js = fs.readFileSync('js/file_audio.js', 'utf8');

// 1. Fix onAudioChosen to decode audioData
const onAudioChosenOld = `function onAudioChosen(e){
    const file = e.target.files[0];
    if(!file) return;
    if(audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
    audioObjectUrl = URL.createObjectURL(file);
    audio.src = audioObjectUrl;
    if(chart) updateMetaStats();
    el.audioFileLabel.textContent = file.name;
    el.transport.classList.remove('disabled');
    el.btnPlayPause.disabled = false;
    el.seekBar.disabled = false;
    el.playbackRateSelect.disabled = false;
    e.target.value = '';
  }`;

const onAudioChosenNew = `function onAudioChosen(e){
    const file = e.target.files[0];
    if(!file) return;
    if(audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
    audioObjectUrl = URL.createObjectURL(file);
    audio.src = audioObjectUrl;
    if(chart) updateMetaStats();
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
  }`;
js = js.replace(onAudioChosenOld, onAudioChosenNew);

// 2. Fix Smooth Scroll logic
const rafOld = `function startRaf(){
    stopRaf();
    function loop(){
      if(chart){
        draw();
        const curTick = tickForAudioTime(audio.currentTime||0);
        const py = tickToY(curTick);
        scheduleHitSounds(audio.currentTime || 0);
        const wantTop = py - el.scrollWrap.clientHeight*0.3;
        el.scrollWrap.scrollTop = Math.max(0, wantTop);
      }
      rafHandle = requestAnimationFrame(loop);
    }
    rafHandle = requestAnimationFrame(loop);
  }`;

const rafNew = `
  let audioContextOffset = 0;
  audio.addEventListener('play', () => { audioContextOffset = audioCtx.currentTime - audio.currentTime; });
  audio.addEventListener('seeked', () => { if(!audio.paused) audioContextOffset = audioCtx.currentTime - audio.currentTime; });

  function startRaf(){
    stopRaf();
    function loop(){
      if(chart){
        draw();
        const preciseTime = (!audio.paused) ? (audioCtx.currentTime - audioContextOffset) : audio.currentTime;
        const curTick = tickForAudioTime(preciseTime || 0);
        const py = tickToY(curTick);
        scheduleHitSounds(preciseTime || 0);
        const wantTop = py - el.scrollWrap.clientHeight*0.3;
        el.scrollWrap.scrollTop = Math.max(0, wantTop);
      }
      rafHandle = requestAnimationFrame(loop);
    }
    rafHandle = requestAnimationFrame(loop);
  }`;
js = js.replace(rafOld, rafNew);

fs.writeFileSync('js/file_audio.js', js);
console.log('file_audio.js patched');

// 3. Add minimap logic to renderer.js
let renderer = fs.readFileSync('js/renderer.js', 'utf8');

const drawOld = `  function draw(){
    rebuildLaneStates();
    if(!chart) return;
    const w = contentWidth();`;

const drawNew = `  function drawMinimap(maxTick, viewTop, viewBottom, clientH) {
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
      const scaleY = el.minimapWrap.clientHeight / tickToY(maxContentTick());
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
    const w = contentWidth();`;

renderer = renderer.replace(drawOld, drawNew);

// Insert drawMinimap call at the end of draw()
const drawEndOld = `      ctx.beginPath();
      ctx.moveTo(0,py-6); ctx.lineTo(10,py); ctx.lineTo(0,py+6); ctx.closePath(); ctx.fill();
    }
  }`;

const drawEndNew = `      ctx.beginPath();
      ctx.moveTo(0,py-6); ctx.lineTo(10,py); ctx.lineTo(0,py+6); ctx.closePath(); ctx.fill();
    }
    drawMinimap(maxTick, viewTop, viewBottom, clientH);
  }`;
renderer = renderer.replace(drawEndOld, drawEndNew);

fs.writeFileSync('js/renderer.js', renderer);
console.log('renderer.js patched');

