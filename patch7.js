const fs = require('fs');

function patch7() {
    let code = fs.readFileSync('index.html', 'utf8');
    
    // Normalize newlines to \n for easier replacement
    code = code.replace(/\r\n/g, '\n');

    // 1 & 5. Remove isSpecialLane logic
    
    // drawNote
    code = code.replace(
`    const isSpecialLane = n.lane === 6;
    const x = isSpecialLane ? laneToX(0) : laneToX(n.lane);
    const drawWidth = isSpecialLane ? LANE_W * 6 : LANE_W;`,
`    const x = laneToX(n.lane);
    const drawWidth = LANE_W;`
    );

    // hitTest
    code = code.replace(
`      const isSpecialLane = n.lane === 6;
      const drawWidth = isSpecialLane ? LANE_W * 6 : LANE_W;
      const cx = isSpecialLane ? laneToX(0) + drawWidth/2 : laneToX(n.lane) + drawWidth/2;`,
`      const drawWidth = LANE_W;
      const cx = laneToX(n.lane) + drawWidth/2;`
    );

    // noteBounds
    code = code.replace(
`    const isSpecialLane = n.lane === 6;
    const drawWidth = isSpecialLane ? LANE_W * 6 : LANE_W;
    const x = isSpecialLane ? laneToX(0) : laneToX(n.lane);`,
`    const drawWidth = LANE_W;
    const x = laneToX(n.lane);`
    );

    // hoverPos in draw()
    code = code.replace(
`      const hWidth = hoverPos.lane === 6 ? LANE_W * 6 : LANE_W;
      const hX = hoverPos.lane === 6 ? laneToX(0) : laneToX(hoverPos.lane);`,
`      const hWidth = LANE_W;
      const hX = laneToX(hoverPos.lane);`
    );

    // 2 & 4. Audio Reset on Load and Convert Modal
    const askConvertModalLogic = `
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

  async function loadChart(data, name){`;

    code = code.replace(/function loadChart\(data, name\)\{/, askConvertModalLogic);

    code = code.replace(
`    chart = data;
    filename = name || 'chart.json';
    laneCount = chart.metadata.laneCount || 6;
    resolution = chart.metadata.resolution || 960;`,
`    let incomingLaneCount = data.metadata.laneCount || 6;
    if (incomingLaneCount < 7) {
      const doConvert = await askConvertFormat();
      if (doConvert) {
        data.metadata.laneCount = 7;
        incomingLaneCount = 7;
      }
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
    el.btnPlayPause.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
    stopRaf();
    el.timeLabel.textContent = '00:00 / 00:00';
    el.seekBar.value = 0;`
    );

    // 3. Undo/Redo drag cancel
    code = code.replace(
`    chart.notes = JSON.parse(history.pop());
    clearSelection();
    resizeCanvas(); draw(); updateNoteCounts(); updateInspector(); updateFooterCounts();`,
`    chart.notes = JSON.parse(history.pop());
    clearSelection();
    drag = null;
    resizeCanvas(); draw(); updateNoteCounts(); updateInspector(); updateFooterCounts();`
    );

    code = code.replace(
`    chart.notes = JSON.parse(redoStack.pop());
    clearSelection();
    resizeCanvas(); draw(); updateNoteCounts(); updateInspector(); updateFooterCounts();`,
`    chart.notes = JSON.parse(redoStack.pop());
    clearSelection();
    drag = null;
    resizeCanvas(); draw(); updateNoteCounts(); updateInspector(); updateFooterCounts();`
    );

    // Modal HTML insertion
    const modalHtml = `
<div class="modal-overlay" id="convertModalOverlay">
  <div class="modal">
    <h2>フォーマット変換</h2>
    <p>読み込まれた譜面は古いフォーマット（6レーン以下）です。<br>新しいフォーマット（7レーン：SPACEレーン追加）に変換しますか？</p>
    <div class="actions">
      <button id="convertCancel">キャンセル（そのまま開く）</button>
      <button id="convertAccept" class="primary">変換する</button>
    </div>
  </div>
</div>

<audio id="audioEl"></audio>`;

    code = code.replace(/<audio id="audioEl"><\/audio>/, modalHtml);

    // Convert back to CRLF just to be nice to Windows
    code = code.replace(/\n/g, '\r\n');
    
    fs.writeFileSync('index.html', code);
    console.log("Patch7 applied");
}

patch7();

