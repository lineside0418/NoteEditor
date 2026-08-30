const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(
  /<div class="scroll-wrap" id="scrollWrap" style="display:none;">\s*<canvas id="gridCanvas"><\/canvas>\s*<\/div>/,
  `<div class="editor-main-container" id="editorMainContainer" style="display:none; flex:1; position:relative; overflow:hidden; display:flex;">
      <div class="scroll-wrap" id="scrollWrap" style="flex:1; overflow-y:auto; overflow-x:hidden;">
        <canvas id="gridCanvas"></canvas>
      </div>
      <div class="minimap-wrap" id="minimapWrap" style="width: 60px; min-width: 60px; background: var(--bg); border-left: 1px solid var(--panel-border); position:relative; cursor: pointer;">
        <canvas id="minimapCanvas" style="position:absolute; top:0; left:0; width:100%; height:100%;"></canvas>
      </div>
    </div>`
);
html = html.replace(/<div class="scroll-wrap" id="scrollWrap" style="display:none;">\s*<canvas id="gridCanvas"><\/canvas>\s*<\/div>/, `<div class="editor-main-container" id="editorMainContainer" style="display:none; flex:1; position:relative; overflow:hidden; flex-direction:row;"><div class="scroll-wrap" id="scrollWrap" style="flex:1;"><canvas id="gridCanvas"></canvas></div><div class="minimap-wrap" id="minimapWrap" style="width:60px; background:var(--bg); border-left:1px solid var(--panel-border); position:relative;"><canvas id="minimapCanvas" style="width:100%; height:100%; position:absolute; top:0; left:0;"></canvas></div></div>`);

fs.writeFileSync('index.html', html);

let ui = fs.readFileSync('js/ui.js', 'utf8');
ui = ui.replace(/'scrollWrap','gridCanvas',/, "'scrollWrap','gridCanvas','editorMainContainer','minimapWrap','minimapCanvas',");
fs.writeFileSync('js/ui.js', ui);

let audio = fs.readFileSync('js/file_audio.js', 'utf8');
audio = audio.replace(/el\.scrollWrap\.style\.display = 'block';/, "el.editorMainContainer.style.display = 'flex';");
fs.writeFileSync('js/file_audio.js', audio);

