const fs = require('fs');
let audioFile = fs.readFileSync('js/file_audio.js', 'utf8');

const target1 = `  let nextNoteIndex = 0;`; // Let's just insert it globally.

const insert1 = `
  let nextHitSoundIndex = 0;

  function scheduleHitSounds(curTime) {
    if (!chart || !chart.notes) return;
    const sorted = sortedNotes(); // Maybe cache this? It's fine for now.
    const lookaheadSec = 0.1;
    const endAudioTime = curTime + lookaheadSec;
    
    while(nextHitSoundIndex < sorted.length) {
      const n = sorted[nextHitSoundIndex];
      const noteTime = audioTimeForTick(n.tick);
      if (noteTime > endAudioTime) break;
      
      if (noteTime >= curTime) {
        // Schedule beep
        const scheduleTime = audioCtx.currentTime + (noteTime - curTime) / audio.playbackRate;
        playTickSound(scheduleTime);
      }
      nextHitSoundIndex++;
    }
  }

  function playTickSound(time) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.05);
    
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(time);
    osc.stop(time + 0.05);
  }
`;

audioFile = insert1 + '\\n' + audioFile;

const targetLoop = `        const wantTop = py - el.scrollWrap.clientHeight*0.3;`;
const insertLoop = `        scheduleHitSounds(audio.currentTime || 0);`;

audioFile = audioFile.replace(targetLoop, insertLoop + '\\n' + targetLoop);

const targetPlay = `  function togglePlay(){`;
const insertPlay = `  function togglePlay(){
    if(!audio.src) return;
    if(audio.paused){
      // Reset hit sound index
      const curTick = tickForAudioTime(audio.currentTime||0);
      const sorted = sortedNotes();
      nextHitSoundIndex = sorted.findIndex(n => n.tick >= curTick);
      if (nextHitSoundIndex === -1) nextHitSoundIndex = sorted.length;
    }`;

audioFile = audioFile.replace(`  function togglePlay(){`, insertPlay);

fs.writeFileSync('js/file_audio.js', audioFile);
console.log('Patched hit sounds');

