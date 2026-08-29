const fs = require('fs');

let mainJs = fs.readFileSync('js/main.js', 'utf8');

const regex = /el\.swapVisualizeToggle\.addEventListener\('change', \(e\) => \{\r?\n\s*isSwapVisualizeMode = e\.target\.checked;\r?\n\s*draw\(\);\r?\n\s*\}\);/;

const insert = `el.swapVisualizeToggle.addEventListener('change', (e) => {
    isSwapVisualizeMode = e.target.checked;
    draw();
  });

  el.centerSpaceToggle.addEventListener('change', (e) => {
    isCenterSpaceMode = e.target.checked;
    draw();
  });`;

mainJs = mainJs.replace(regex, insert);
fs.writeFileSync('js/main.js', mainJs);
console.log('Patched main.js');

let mathJs = fs.readFileSync('js/math.js', 'utf8');
mathJs = mathJs.replace(/function laneToX\(lane\)\{ return RULER_W \+ lane\*LANE_W; \}/, 
`function laneToX(lane){
    if (lane === laneCount) return RULER_W + laneCount * LANE_W;
    if (isCenterSpaceMode) {
      if (lane < 3) return RULER_W + lane*LANE_W;
      if (lane === 6) return RULER_W + 3*LANE_W;
      return RULER_W + (lane + 1)*LANE_W;
    }
    return RULER_W + lane*LANE_W;
  }`);

mathJs = mathJs.replace(/function xToLane\(x\)\{ const raw = Math\.floor\(\(x - RULER_W\) \/ LANE_W\); return Math\.max\(0, Math\.min\(laneCount-1, raw\)\); \}/,
`function xToLane(x){
    let raw = Math.floor((x - RULER_W) / LANE_W);
    if(raw < 0) raw = 0;
    if(raw >= laneCount) raw = laneCount - 1;
    if (isCenterSpaceMode) {
      if (raw < 3) return raw;
      if (raw === 3) return 6;
      return raw - 1;
    }
    return Math.max(0, Math.min(laneCount-1, raw));
  }`);

fs.writeFileSync('js/math.js', mathJs);
console.log('Patched math.js');

