const fs = require('fs');

let converter = fs.readFileSync('converter.html', 'utf8');

const regex = /function convertToRICF1\(old\) \{[\s\S]*?return newChart;\s*\}/;

const insert = `function convertToRICF1(old) {
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
          file: old.meta.background ? old.meta.background.replace(/\\.[^/.]+$/, "") + ".mp3" : "", // Guessing audio file name from bg or just empty
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

      // Parse time array for BPMs
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

      // Parse notes
      old.note.forEach(n => {
        if (typeof n.column !== 'number') return; // Skip non-lane notes (like BGM)
        
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

    // ノーツをTick昇順にソートし、IDを連番で振り直す
    notes.sort((a, b) => a.tick - b.tick);
    let currentId = 1;
    notes.forEach(n => {
      n.id = currentId++;
    });

    const newChart = {
      formatVersion: "RICF-1",
      metadata: metadata,
      timing: timing,
      notes: notes
    };

    return newChart;
  }`;

if (regex.test(converter)) {
  converter = converter.replace(regex, insert);
  fs.writeFileSync('converter.html', converter);
  console.log('Successfully patched converter!');
} else {
  console.log('Regex failed to match.');
}

