const fs = require('fs');
let input = fs.readFileSync('js/input.js', 'utf8');

const target = `      el.statLane.textContent = isSwapVisualizeMode ? \`\${internalLane} (Vis: \${rawLane})\` : rawLane;`;
const insert = `
      if(drag && drag.mode === 'paste'){
        drag.snapTick = snapped;
        drag.lane = rawLane;
      }`;

input = input.replace(target, target + insert);
fs.writeFileSync('js/input.js', input);
console.log('Added mousemove paste update!');

