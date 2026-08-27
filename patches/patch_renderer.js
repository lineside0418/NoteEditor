const fs = require('fs');
let renderer = fs.readFileSync('js/renderer.js', 'utf8');

const target = `    if(drag && drag.mode==='rect-select'){`;
const insert = `    if(drag && drag.mode==='paste' && drag.items){
      ctx.globalAlpha = 0.5;
      drag.items.forEach(item => {
        const t = drag.snapTick + item.dTick;
        const l = drag.lane + item.dLane;
        if(t >= 0 && l >= 0 && l <= laneCount) {
          const fakeNote = { type: item.type, lane: l, tick: t, size: item.size || 1 };
          if (item.dEndTick != null) {
            fakeNote.endTick = drag.snapTick + item.dEndTick;
          }
          drawNote(fakeNote);
        }
      });
      ctx.globalAlpha = 1.0;
    }
`;

renderer = renderer.replace(target, insert + '\\n' + target);
fs.writeFileSync('js/renderer.js', renderer);
console.log('Added paste rendering!');

