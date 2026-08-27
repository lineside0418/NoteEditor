const fs = require('fs');
let audio = fs.readFileSync('js/file_audio.js', 'utf8');

const target = `  function onAudioChosen(e){
    const file = e.target.files[0];
    if(!file) return;
    if(audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
    audioObjectUrl = URL.createObjectURL(file);
    audio.src = audioObjectUrl;`;

const insert = `  async function onAudioChosen(e){
    const file = e.target.files[0];
    if(!file) return;
    if(audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
    audioObjectUrl = URL.createObjectURL(file);
    audio.src = audioObjectUrl;
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      generateWaveformData();
      draw();
    } catch(err) {
      console.error("Failed to decode audio", err);
    }`;

audio = audio.replace(target, insert);

const genTarget = `  function onAudioChosen(e){`;
const genInsert = `  function generateWaveformData() {
    if (!audioBuffer) return;
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const step = Math.floor(sampleRate / 100); // 100 samples per second (10ms resolution)
    waveformData = [];
    for (let i = 0; i < channelData.length; i += step) {
      let min = 0;
      let max = 0;
      for (let j = 0; j < step && i + j < channelData.length; j++) {
        const val = channelData[i + j];
        if (val < min) min = val;
        if (val > max) max = val;
      }
      waveformData.push({ min, max });
    }
  }

`;

audio = audio.replace(genTarget, genInsert + genTarget);

fs.writeFileSync('js/file_audio.js', audio);
console.log('Added waveform generation!');

