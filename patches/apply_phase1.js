const fs = require('fs');

// 1. config.js
let config = fs.readFileSync('js/config.js', 'utf8');
config = config.replace(
  `{n:4,  label:'4分'}, {n:8,  label:'8分'}, {n:12, label:'12分(3連)'}, {n:16, label:'16分'},
    {n:24, label:'24分(3連)'}, {n:32, label:'32分'}, {n:48, label:'48分(3連)'}, {n:64, label:'64分'}`,
  `{n:3,  label:'1/3 (2拍3連)'}, {n:4,  label:'1/4'}, {n:6,  label:'1/6 (1拍3連)'}, {n:8,  label:'1/8'}, 
    {n:12, label:'1/12 (8分3連)'}, {n:16, label:'1/16'}, {n:24, label:'1/24 (16分3連)'}, {n:32, label:'1/32'}, 
    {n:48, label:'1/48 (32分3連)'}, {n:64, label:'1/64'}`
);
fs.writeFileSync('js/config.js', config);

// 2. index.html
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(
  '<button class="playbtn" id="btnPlayPause" disabled><span class="material-symbols-outlined">play_arrow</span></button>',
  `<button class="playbtn" id="btnPlayPause" disabled><span class="material-symbols-outlined">play_arrow</span></button>
  <select id="playbackRateSelect" title="再生速度" disabled style="background:var(--bg);color:var(--text);border:1px solid var(--panel-border);padding:2px 4px;border-radius:4px;font-size:12px;">
    <option value="0.25">0.25x</option>
    <option value="0.5">0.5x</option>
    <option value="0.75">0.75x</option>
    <option value="1.0" selected>1.0x</option>
    <option value="1.25">1.25x</option>
    <option value="1.5">1.5x</option>
  </select>`
);
fs.writeFileSync('index.html', html);

// 3. state.js
let state = fs.readFileSync('js/state.js', 'utf8');
state = state.replace(
  `'transport','btnPlayPause','timeLabel','seekBar','audioFileLabel','audioEl',`,
  `'transport','btnPlayPause','playbackRateSelect','timeLabel','seekBar','audioFileLabel','audioEl',`
);
fs.writeFileSync('js/state.js', state);

// 4. main.js
let main = fs.readFileSync('js/main.js', 'utf8');
main = main.replace(
  `el.snapSelect.addEventListener('change', ()=>{ snapN = parseInt(el.snapSelect.value,10); });`,
  `el.snapSelect.addEventListener('change', ()=>{ snapN = parseInt(el.snapSelect.value,10); });
  el.playbackRateSelect.addEventListener('change', ()=>{
    if (audio) audio.playbackRate = parseFloat(el.playbackRateSelect.value);
  });`
);
fs.writeFileSync('js/main.js', main);

// 5. file_audio.js
let audio = fs.readFileSync('js/file_audio.js', 'utf8');
audio = audio.replace(
  `el.seekBar.disabled = true;`,
  `el.seekBar.disabled = true;
    el.playbackRateSelect.disabled = true;`
);
audio = audio.replace(
  `el.seekBar.disabled = false;`,
  `el.seekBar.disabled = false;
    el.playbackRateSelect.disabled = false;`
);
fs.writeFileSync('js/file_audio.js', audio);

console.log('Phase 1 applied successfully!');

