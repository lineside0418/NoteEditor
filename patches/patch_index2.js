const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

c = c.replace(
  /<input type="checkbox" id="swapVisualizeToggle"> SWAP VISUALIZE\r?\n\s*<\/label>/,
  '<input type="checkbox" id="swapVisualizeToggle"> SWAP VISUALIZE\\n      </label>\\n      <label style="color:var(--text-dim);font-family:var(--mono);font-size:11.5px;display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:10px;">\\n        <input type="checkbox" id="centerSpaceToggle"> CENTER SPACE\\n      </label>'
);

fs.writeFileSync('index.html', c);
console.log('index.html patched via regex');

