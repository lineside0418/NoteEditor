
(function() {
  "use strict";

  const RESOLUTION = 960; // RICF-1のデフォルト解像度（1拍あたりのTick数）

  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const statusMessage = document.getElementById('statusMessage');
  const statusIcon = document.getElementById('statusIcon');

  // イベントリスナーの登録
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
    fileInput.value = ''; // リセット
  });

  function showMessage(msg, isError = false) {
    statusMessage.textContent = msg;
    statusMessage.className = 'status-message show ' + (isError ? 'error' : 'success');
    statusIcon.textContent = isError ? 'error' : 'check_circle';
    statusIcon.style.color = isError ? '#FF3B30' : 'var(--success)';
    
    setTimeout(() => {
      statusMessage.classList.remove('show');
      setTimeout(() => {
        statusIcon.textContent = 'upload_file';
        statusIcon.style.color = 'var(--accent)';
      }, 400);
    }, 4000);
  }

  function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.json') && !file.name.toLowerCase().endsWith('.txt')) {
      showMessage('JSONまたはTXTファイルを選択してください', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const oldData = JSON.parse(e.target.result);
        const newData = convertToRICF1(oldData);
        downloadJson(newData, file.name.replace(/\.(json|txt)$/i, '_ricf1.json'));
        showMessage('変換が完了しました！');
      } catch (err) {
        showMessage('変換エラー: ' + err.message, true);
        console.error(err);
      }
    };
    reader.readAsText(file);
  }

  // 古いJSONからRICF-1形式に変換するメイン関数
  function convertToRICF1(old) {
    let metadata, timing, notes = [];

    // Check if it's the new chartdata.txt format
    if (old.meta && Array.isArray(old.note)) {
      metadata = {
        id: old.meta.version || "001",
        title: (old.meta.song && old.meta.song.title) ? old.meta.song.title : "Unknown Title",
        artist: (old.meta.song && old.meta.song.artist) ? old.meta.song.artist : "",
        charter: old.meta.creator || "",
        difficulty: {
          name: old.meta.version || "Low",
          level: 1
        },
        audio: {
          file: old.meta.background ? old.meta.background.replace(/\.[^/.]+$/, "") + ".mp3" : "",
          offset: 0
        },
        jacket: {
          file: old.meta.background || ""
        },
        laneCount: (old.meta.mode_ext && old.meta.mode_ext.column) ? old.meta.mode_ext.column : 7,
        resolution: RESOLUTION
      };

      timing = {
        bpms: [],
        scrolls: [{ tick: 0, speed: 1.0 }],
        timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
        stops: []
      };

      if (Array.isArray(old.time)) {
        old.time.forEach(t => {
          if (t.beat && typeof t.bpm === 'number') {
            const beatVal = t.beat[0] + (t.beat[2] > 0 ? t.beat[1] / t.beat[2] : 0);
            const tick = Math.round(beatVal * RESOLUTION);
            timing.bpms.push({ tick: tick, bpm: t.bpm });
          }
        });
      }
      if (timing.bpms.length === 0) {
        timing.bpms.push({ tick: 0, bpm: 120.0 });
      }

      old.note.forEach(n => {
        if (typeof n.column !== 'number') return;
        
        const beatVal = n.beat[0] + (n.beat[2] > 0 ? n.beat[1] / n.beat[2] : 0);
        const tick = Math.round(beatVal * RESOLUTION);
        const lane = n.column;
        let type = "tap";
        
        let newNote = {
          id: 0,
          tick: tick,
          lane: lane,
          type: type,
          size: 1
        };

        if (n.endbeat) {
          type = "hold";
          newNote.type = "hold";
          const endBeatVal = n.endbeat[0] + (n.endbeat[2] > 0 ? n.endbeat[1] / n.endbeat[2] : 0);
          newNote.endTick = Math.round(endBeatVal * RESOLUTION);
        }

        notes.push(newNote);
      });

    } else {
      // Legacy format handling (LPB / maxBlock)
      metadata = {
        id: old.name || "001",
        title: old.name || "Unknown Title",
        artist: "",
        charter: "",
        difficulty: {
          name: "Low",
          level: 1
        },
        audio: {
          file: "",
          offset: typeof old.offset === 'number' ? old.offset : 0
        },
        jacket: {
          file: ""
        },
        laneCount: typeof old.maxBlock === 'number' ? old.maxBlock : 6,
        resolution: RESOLUTION
      };

      timing = {
        bpms: [
          {
            tick: 0,
            bpm: typeof old.BPM === 'number' ? old.BPM : 120.0
          }
        ],
        scrolls: [
          { tick: 0, speed: 1.0 }
        ],
        timeSignatures: [
          { tick: 0, numerator: 4, denominator: 4 }
        ],
        stops: []
      };

      if (Array.isArray(old.notes)) {
        old.notes.forEach(n => {
          const tick = Math.round((n.num / n.LPB) * RESOLUTION);
          const lane = n.block;
          const type = n.type === 2 ? "hold" : "tap";
          
          let newNote = {
            id: 0,
            tick: tick,
            lane: lane,
            type: type,
            size: 1
          };

          if (type === "hold") {
            if (Array.isArray(n.notes) && n.notes.length > 0) {
              const endNote = n.notes[0];
              const endTick = Math.round((endNote.num / endNote.LPB) * RESOLUTION);
              newNote.endTick = endTick;
            } else {
              newNote.endTick = tick + RESOLUTION;
            }
          }
          notes.push(newNote);
        });
      }
    }

    notes.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      return a.lane - b.lane;
    });

    let idCounter = 1;
    notes.forEach(n => {
      n.id = idCounter++;
    });

    return {
      version: 1,
      metadata: metadata,
      timing: timing,
      notes: notes,
      events: []
    };
  }

  // JSONをダウンロードさせる処理
  function downloadJson(data, filename) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

})();
