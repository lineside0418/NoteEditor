// Static UI init
  // ---------------------------------------------------------------
  SNAP_OPTIONS.forEach(o=>{
    const opt = document.createElement('option');
    opt.value = o.n; opt.textContent = o.label;
    if(o.n===snapN) opt.selected = true;
    el.snapSelect.appendChild(opt);
  });

  el.btnLoad.addEventListener('click', openChartFile);
  el.btnLoad2.addEventListener('click', openChartFile);
  el.fileInput.addEventListener('change', onFileChosen);
  el.btnNew.addEventListener('click', createNewChart);
  el.btnExport.addEventListener('click', exportChart);
  el.btnMeta.addEventListener('click', openMetaModal);
  el.btnAudio.addEventListener('click', ()=>el.audioInput.click());
  el.audioInput.addEventListener('change', onAudioChosen);
  el.btnUndo.addEventListener('click', undo);
  el.btnRedo.addEventListener('click', redo);
  el.snapSelect.addEventListener('change', ()=>{ snapN = parseInt(el.snapSelect.value,10); });
  el.playbackRateSelect.addEventListener('change', ()=>{
    if (audio) audio.playbackRate = parseFloat(el.playbackRateSelect.value);
  });
  el.swapVisualizeToggle.addEventListener('change', (e) => {
    isSwapVisualizeMode = e.target.checked;
    draw();
  });

  el.centerSpaceToggle.addEventListener('change', (e) => {
    isCenterSpaceMode = e.target.checked;
    if (typeof buildLaneHeader === 'function') buildLaneHeader();
    draw();
  });

  el.zoomIn.addEventListener('click', ()=>setZoom(zoom*1.25));
  el.zoomOut.addEventListener('click', ()=>setZoom(zoom/1.25));

  el.typeButtons.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      selectedType = btn.dataset.type;
      el.typeButtons.forEach(b=>b.classList.toggle('active', b===btn));
    });
  });
  el.modeButtons.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      pointerMode = btn.dataset.mode;
      el.modeButtons.forEach(b=>b.classList.toggle('active', b===btn));
      renderHints();
      drag = null;
      draw();
    });
  });

  function renderHints(){
    el.hintTitle.textContent = '操作（'+(pointerMode==='place'?'配置モード':'選択モード')+'）';
    el.hintBody.innerHTML = HINTS[pointerMode].map(([k,v])=>
      `<div class="hint-row"><span>${k}</span><span>${v}</span></div>`
    ).join('');
  }
  renderHints();

  document.addEventListener('keydown', (e)=>{
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    const inField = tag==='INPUT' || tag==='TEXTAREA' || tag==='SELECT';
    if(!chart){ return; }
    if(inField){
      if(e.key==='Escape') closeMetaModal();
      return;
    }
    if(e.key==='1'){ selectType('tap'); }
    else if(e.key==='2'){ selectType('hold'); }
    else if(e.key==='3'){ selectType('trace'); }
    else if(e.key==='4'){ selectType('swap'); }
    else if(e.key==='5'){ selectType('shift'); }
    else if(e.key==='6'){ selectType('scramble'); }
    else if(e.key==='Escape'){ clearSelection(); draw(); updateInspector(); }
    else if(e.key==='Delete' || e.key==='Backspace'){
      if(selectedIds.size>0){ e.preventDefault(); deleteSelected(); }
    }
    else if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='c'){
      if(selectedIds.size > 0){
        e.preventDefault();
        const sel = Array.from(selectedIds).map(id => chart.notes.find(n=>n.id===id)).filter(Boolean);
        if(sel.length > 0) {
          sel.sort((a,b)=>a.tick-b.tick);
          const anchorTick = sel[0].tick;
          const anchorLane = sel[0].lane;
          clipboard = sel.map(n => Object.assign({}, n, {
            dTick: n.tick - anchorTick,
            dEndTick: n.endTick != null ? n.endTick - anchorTick : null,
            dLane: n.lane - anchorLane
          }));
          console.log('Copied', clipboard.length, 'notes');
        }
      }
    }
    else if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='v'){
      if(clipboard && clipboard.length > 0){
        e.preventDefault();
        drag = { mode: 'paste', items: clipboard, snapTick: 0, lane: 0 };
        draw();
      }
    }
    else if(e.key==='Enter'){
      if(drag && drag.mode==='paste'){
        e.preventDefault();
        commitPaste();
      }
    }
    else if(e.key.toLowerCase()==='m' || e.key.toLowerCase()==='h'){
      if(selectedIds.size > 0){
        e.preventDefault();
        mirrorSelected();
      }
    }
    else if(e.key==='Escape' && drag && drag.mode==='paste'){
      e.preventDefault();
      drag = null;
      draw();
    }
    else if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z'){
      e.preventDefault(); if(e.shiftKey) redo(); else undo();
    }
    else if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='y'){
      e.preventDefault(); redo();
    }
    else if(e.code==='Space'){
      if(audio.src){ e.preventDefault(); togglePlay(); }
    }
  });

  function selectType(t){
    selectedType = t;
    el.typeButtons.forEach(b=>b.classList.toggle('active', b.dataset.type===t));
  }

  function setZoom(z, opts){
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
    if(opts && opts.anchorTick!=null && opts.anchorScreenY!=null){
      zoom = newZoom;
      el.zoomLabel.textContent = Math.round(zoom*100)+'%';
      if(chart){ resizeCanvas(); draw(); el.scrollWrap.scrollTop = tickToY(opts.anchorTick) - opts.anchorScreenY; }
      return;
    }
    zoom = newZoom;
    el.zoomLabel.textContent = Math.round(zoom*100)+'%';
    if(chart){ resizeCanvas(); draw(); }
  }

  el.scrollWrap.addEventListener('wheel', (e)=>{
    if(!chart) return;
    if(e.ctrlKey || e.metaKey){
      e.preventDefault();
      const rect = el.scrollWrap.getBoundingClientRect();
      const screenY = e.clientY - rect.top;
      const scrollY = screenY + el.scrollWrap.scrollTop;
      const tickUnderCursor = yToTick(scrollY);
      const factor = e.deltaY < 0 ? 1.12 : 1/1.12;
      setZoom(zoom*factor, {anchorTick:tickUnderCursor, anchorScreenY:screenY});
    }
  }, {passive:false});

  // ---------------------------------------------------------------