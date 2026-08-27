const fs = require('fs');
let main = fs.readFileSync('js/main.js', 'utf8');

const target = `    else if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z'){`;
const insert = `    else if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='c'){
      if(selectedIds.size > 0){
        e.preventDefault();
        const sel = Array.from(selectedIds).map(id => chart.notes.find(n=>n.id===id)).filter(Boolean);
        if(sel.length > 0) {
          sel.sort((a,b)=>a.tick-b.tick);
          const anchorTick = sel[0].tick;
          const anchorLane = sel[0].lane;
          clipboard = sel.map(n => Object.assign({}, n, {
            dTick: n.tick - anchorTick,
            dEndTick: n.endTick != null ? n.endTick - anchorTick : null,
            dLane: n.lane - anchorLane
          }));
          console.log('Copied', clipboard.length, 'notes');
        }
      }
    }
    else if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='v'){
      if(clipboard && clipboard.length > 0){
        e.preventDefault();
        drag = { mode: 'paste', items: clipboard, snapTick: 0, lane: 0 };
        draw();
      }
    }
    else if(e.key==='Enter'){
      if(drag && drag.mode==='paste'){
        e.preventDefault();
        commitPaste();
      }
    }
    else if(e.key.toLowerCase()==='m' || e.key.toLowerCase()==='h'){
      if(selectedIds.size > 0){
        e.preventDefault();
        mirrorSelected();
      }
    }
    else if(e.key==='Escape' && drag && drag.mode==='paste'){
      e.preventDefault();
      drag = null;
      draw();
    }`;

main = main.replace(target, insert + '\\n' + target);
fs.writeFileSync('js/main.js', main);
console.log('Added keybinds!');

