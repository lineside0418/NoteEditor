const fs = require('fs');

let fa = fs.readFileSync('js/file_audio.js', 'utf8');

const regex = /function buildLaneHeader\(\)\{\r?\n\s*el\.laneHeader\.innerHTML = '';\r?\n\s*const rulerCell = document\.createElement\('div'\);\r?\n\s*rulerCell\.className = 'ruler-cell';\r?\n\s*rulerCell\.style\.width = RULER_W\+'px';\r?\n\s*el\.laneHeader\.appendChild\(rulerCell\);\r?\n\s*for\(let i=0;i<laneCount;i\+\+\)\{\r?\n\s*const c = document\.createElement\('div'\);\r?\n\s*c\.className = 'lane-cell';\r?\n\s*c\.style\.width = LANE_W\+'px';\r?\n\s*c\.textContent = i === 6 \? 'SPACE' : \('LANE '\+\(i\+1\)\);\r?\n\s*el\.laneHeader\.appendChild\(c\);\r?\n\s*\}\r?\n\s*\}/;

const insert = `function buildLaneHeader(){
    el.laneHeader.innerHTML = '';
    const rulerCell = document.createElement('div');
    rulerCell.className = 'ruler-cell';
    rulerCell.style.width = RULER_W+'px';
    el.laneHeader.appendChild(rulerCell);
    
    const visualOrder = [];
    if (isCenterSpaceMode) {
      visualOrder.push(0, 1, 2, 6, 3, 4, 5);
    } else {
      for(let i=0;i<laneCount;i++) visualOrder.push(i);
    }
    
    visualOrder.forEach(i => {
      const c = document.createElement('div');
      c.className = 'lane-cell';
      c.style.width = LANE_W+'px';
      c.textContent = i === 6 ? 'SPACE' : ('LANE '+(i+1));
      el.laneHeader.appendChild(c);
    });
  }`;

if (regex.test(fa)) {
  fa = fa.replace(regex, insert);
  fs.writeFileSync('js/file_audio.js', fa);
  console.log('Patched file_audio.js');
} else {
  console.log('Regex failed for file_audio.js');
}

// Now patch main.js
let main = fs.readFileSync('js/main.js', 'utf8');
const mainRegex = /el\.centerSpaceToggle\.addEventListener\('change', \(e\) => \{\r?\n\s*isCenterSpaceMode = e\.target\.checked;\r?\n\s*draw\(\);\r?\n\s*\}\);/;
const mainInsert = `el.centerSpaceToggle.addEventListener('change', (e) => {
    isCenterSpaceMode = e.target.checked;
    if (typeof buildLaneHeader === 'function') buildLaneHeader();
    draw();
  });`;

if (mainRegex.test(main)) {
  main = main.replace(mainRegex, mainInsert);
  fs.writeFileSync('js/main.js', main);
  console.log('Patched main.js');
} else {
  console.log('Regex failed for main.js');
}

