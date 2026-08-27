const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const target = '<button class="playbtn" id="btnPlayPause" disabled><span class="material-symbols-outlined">play_arrow</span></button>';
const insert = `<select id="playbackRateSelect" title="再生速度" disabled style="background:var(--bg);color:var(--text);border:1px solid var(--panel-border);padding:2px 4px;border-radius:4px;font-size:12px;">
    <option value="0.25">0.25x</option>
    <option value="0.5">0.5x</option>
    <option value="0.75">0.75x</option>
    <option value="1.0" selected>1.0x</option>
    <option value="1.25">1.25x</option>
    <option value="1.5">1.5x</option>
  </select>`;

html = html.replace(target, target + '\\n  ' + insert);
fs.writeFileSync('index.html', html);

