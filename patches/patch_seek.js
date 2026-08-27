const fs = require('fs');
let audio = fs.readFileSync('js/file_audio.js', 'utf8');

const target = `  let nextHitSoundIndex = 0;`;
const insert = `  let nextHitSoundIndex = 0;
  let lastHitSoundTime = -1;`;
audio = audio.replace(target, insert);

const target2 = `    const endAudioTime = curTime + lookaheadSec;`;
const insert2 = `    const endAudioTime = curTime + lookaheadSec;
    
    // Detect seek (jump in time)
    if (Math.abs(curTime - lastHitSoundTime) > 0.5 && lastHitSoundTime !== -1) {
      const curTick = tickForAudioTime(curTime);
      nextHitSoundIndex = sorted.findIndex(n => n.tick >= curTick);
      if (nextHitSoundIndex === -1) nextHitSoundIndex = sorted.length;
    }
    lastHitSoundTime = curTime;`;
audio = audio.replace(target2, insert2);

fs.writeFileSync('js/file_audio.js', audio);
console.log('Patched seek detection');

