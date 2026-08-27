const fs = require('fs');
let math = fs.readFileSync('js/math.js', 'utf8');

const target = `  function contentWidth(){ return RULER_W + laneCount*LANE_W; }`;
const insert = `  function contentWidth(){ return RULER_W + laneCount*LANE_W + 150; } // +150 for waveform space`;

math = math.replace(target, insert);
fs.writeFileSync('js/math.js', math);
console.log('Patched contentWidth');

