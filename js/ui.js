// Inspector / side panel rendering
  // ---------------------------------------------------------------
  function updateMetaStats(){
    const m = chart.metadata||{};
    const bpms = sortedBpms();
    const bpmRange = bpms.length ? [...new Set(bpms.map(b=>b.bpm))].join(' → ') : '-';
    el.metaStats.innerHTML = `
      <div class="stat-row"><span class="k">タイトル</span><span class="v">${escapeHtml(m.title||'-')}</span></div>
      <div class="stat-row"><span class="k">アーティスト</span><span class="v">${escapeHtml(m.artist||'-')}</span></div>
      <div class="stat-row"><span class="k">難易度</span><span class="v">${escapeHtml((m.difficulty&&m.difficulty.name)||'-')} ${m.difficulty?m.difficulty.level:''}</span></div>
      <div class="stat-row"><span class="k">レーン数</span><span class="v">${laneCount}</span></div>
      <div class="stat-row"><span class="k">解像度</span><span class="v">${resolution}</span></div>
      <div class="stat-row"><span class="k">BPM</span><span class="v">${escapeHtml(bpmRange)}</span></div>
      <div class="stat-row"><span class="k">音声ファイル</span><span class="v">${escapeHtml((m.audio&&m.audio.file)||'-')}</span></div>
    `;
  }

  function updateNoteCounts(){
    const notes = chart.notes||[];
    const counts = {tap:0,hold:0,trace:0,swap:0,shift:0,scramble:0};
    notes.forEach(n=>{ if(counts[n.type]!=null) counts[n.type]++; });
    el.noteCounts.innerHTML = Object.keys(TYPE_META).map(t=>`
      <div class="count-item"><span class="sw" style="background:${TYPE_META[t].color}"></span>${TYPE_META[t].label}<span class="n">${counts[t]}</span></div>
    `).join('');
  }

  function updateFooterCounts(){
    const notes = chart.notes||[];
    el.statCount.textContent = notes.length;
    el.statLength.textContent = maxContentTick()>0 ? Math.max(0, maxContentTick()-resolution*4*2) : 0;
  }

  function updateInspector(){
    if(selectedIds.size===0){
      el.inspector.innerHTML = '<p class="placeholder">ノーツをクリックして選択</p>';
      return;
    }
    if(selectedIds.size>1){
      el.inspector.innerHTML = `
        <div class="note-card">
          <div class="stat-row"><span class="k">選択中</span><span class="v">${selectedIds.size} 件</span></div>
          <button class="del-btn" id="inspDeleteMulti">選択したノーツを削除</button>
<button id="inspMirrorMulti" style="margin-top:8px; width:100%;">左右反転 (M)</button>
        </div>`;
      document.getElementById('inspDeleteMulti').addEventListener('click', deleteSelected);
      document.getElementById('inspMirrorMulti').addEventListener('click', mirrorSelected);
      return;
    }
    const id = [...selectedIds][0];
    const n = (chart.notes||[]).find(n=>n.id===id);
    if(!n){ el.inspector.innerHTML = '<p class="placeholder">ノーツをクリックして選択</p>'; return; }
    const meta = TYPE_META[n.type]||{color:'#888',label:n.type};
    el.inspector.innerHTML = `
      <div class="note-card">
        <span class="type-tag" style="background:${meta.color}22;color:${meta.color};border:1px solid ${meta.color}55;">${meta.label}</span>
        <div class="stat-row"><span class="k">ID</span><span class="v">${n.id}</span></div>
        <div class="stat-row"><span class="k">Tick</span><span class="v">${n.tick}</span></div>
        <div class="stat-row"><span class="k">Beat</span><span class="v">${(n.tick/resolution).toFixed(2)}</span></div>
        <div class="stat-row"><span class="k">Lane</span><span class="v">${n.lane}</span></div>
        ${n.type==='hold' ? `<div class="stat-row"><span class="k">EndTick</span><span class="v">${n.endTick}</span></div>
        <div class="stat-row"><span class="k">長さ</span><span class="v">${n.endTick-n.tick} tick</span></div>` : ''}
        <button class="del-btn" id="inspDelete">このノーツを削除</button>
      </div>
    `;
    document.getElementById('inspDelete').addEventListener('click', ()=>deleteNoteById(n.id));
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ---------------------------------------------------------------