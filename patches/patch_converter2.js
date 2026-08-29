const fs = require('fs');

let converter = fs.readFileSync('converter.html', 'utf8');

const target = `  function convertToRICF1(old) {`;
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
          file: old.meta.background ? old.meta.background.replace(/\\.[^/.]+$/, "") + ".mp3" : "",
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
        notes: notes
      };

    } // ... End of new logic
    
    // Original Logic Below:`;

converter = converter.replace(target, insert + '\\n\\n' + target);
fs.writeFileSync('converter.html', converter);
console.log('Successfully patched converter!');

