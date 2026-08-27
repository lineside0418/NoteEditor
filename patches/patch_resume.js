const fs = require('fs');
let c = fs.readFileSync('js/file_audio.js', 'utf8');
const target = `    if(audio.paused) audio.play(); else audio.pause();`;
const insert = `    if(audioCtx.state === 'suspended') audioCtx.resume();
    if(audio.paused) audio.play(); else audio.pause();`;
c = c.replace(target, insert);
fs.writeFileSync('js/file_audio.js', c);

