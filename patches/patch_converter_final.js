const fs = require('fs');

let converter = fs.readFileSync('converter.html', 'utf8');

const regex = /function convertToRICF1\\(old\\) \\{[\\s\\S]*?return \\{\\s*version:\\s*1,\\s*metadata:\\s*metadata,\\s*timing:\\s*timing,\\s*notes:\\s*notes\\s*\\};\\s*\\}/;

const match = regex.exec(converter);

if (match) {
  const originalFunction = match[0];
  const newFunction = 
  "function convertToRICF1(old) {\\n" +
  "  if (old.meta && Array.isArray(old.note)) {\\n" +
  "    let notes = [];\\n" +
  "    let metadata = {\\n" +
  "      id: old.meta.version || '001',\\n" +
  "      title: (old.meta.song && old.meta.song.title) ? old.meta.song.title : 'Unknown Title',\\n" +
  "      artist: (old.meta.song && old.meta.song.artist) ? old.meta.song.artist : '',\\n" +
  "      charter: old.meta.creator || '',\\n" +
  "      difficulty: { name: old.meta.version || 'Low', level: 1 },\\n" +
  "      audio: { file: old.meta.background ? old.meta.background.replace(/\\\\.[^/.]+$/, '') + '.mp3' : '', offset: 0 },\\n" +
  "      jacket: { file: old.meta.background || '' },\\n" +
  "      laneCount: (old.meta.mode_ext && old.meta.mode_ext.column) ? old.meta.mode_ext.column : 7,\\n" +
  "      resolution: RESOLUTION\\n" +
  "    };\\n\\n" +
  "    let timing = {\\n" +
  "      bpms: [],\\n" +
  "      scrolls: [{ tick: 0, speed: 1.0 }],\\n" +
  "      timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],\\n" +
  "      stops: []\\n" +
  "    };\\n\\n" +
  "    if (Array.isArray(old.time)) {\\n" +
  "      old.time.forEach(t => {\\n" +
  "        if (t.beat && typeof t.bpm === 'number') {\\n" +
  "          const beatVal = t.beat[0] + (t.beat[2] > 0 ? t.beat[1] / t.beat[2] : 0);\\n" +
  "          const tick = Math.round(beatVal * RESOLUTION);\\n" +
  "          timing.bpms.push({ tick: tick, bpm: t.bpm });\\n" +
  "        }\\n" +
  "      });\\n" +
  "    }\\n" +
  "    if (timing.bpms.length === 0) {\\n" +
  "      timing.bpms.push({ tick: 0, bpm: 120.0 });\\n" +
  "    }\\n\\n" +
  "    old.note.forEach(n => {\\n" +
  "      if (typeof n.column !== 'number') return;\\n" +
  "      const beatVal = n.beat[0] + (n.beat[2] > 0 ? n.beat[1] / n.beat[2] : 0);\\n" +
  "      const tick = Math.round(beatVal * RESOLUTION);\\n" +
  "      const lane = n.column;\\n" +
  "      let type = 'tap';\\n" +
  "      let newNote = { id: 0, tick: tick, lane: lane, type: type, size: 1 };\\n\\n" +
  "      if (n.endbeat) {\\n" +
  "        type = 'hold';\\n" +
  "        newNote.type = 'hold';\\n" +
  "        const endBeatVal = n.endbeat[0] + (n.endbeat[2] > 0 ? n.endbeat[1] / n.endbeat[2] : 0);\\n" +
  "        newNote.endTick = Math.round(endBeatVal * RESOLUTION);\\n" +
  "      }\\n" +
  "      notes.push(newNote);\\n" +
  "    });\\n\\n" +
  "    notes.sort((a, b) => {\\n" +
  "      if (a.tick !== b.tick) return a.tick - b.tick;\\n" +
  "      return a.lane - b.lane;\\n" +
  "    });\\n\\n" +
  "    let idCounter = 1;\\n" +
  "    notes.forEach(n => { n.id = idCounter++; });\\n\\n" +
  "    return {\\n" +
  "      version: 1,\\n" +
  "      metadata: metadata,\\n" +
  "      timing: timing,\\n" +
  "      notes: notes\\n" +
  "    };\\n" +
  "  }\\n\\n" +
  originalFunction.replace(/^function convertToRICF1\(old\) \{/, '');

  converter = converter.replace(regex, newFunction);
  fs.writeFileSync('converter.html', converter);
  console.log('Patched converter successfully');
} else {
  console.log('Regex did not match');
}

