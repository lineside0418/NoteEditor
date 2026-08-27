const fs = require('fs');
let renderer = fs.readFileSync('js/renderer.js', 'utf8');

const regex = /for\s*\(\s*let i=0;\s*i<laneCount;\s*i\+\+\s*\)\s*\{\s*if\s*\(\s*i%2===1\s*\)\s*\{\s*ctx\.fillStyle = getVar\('--lane-alt'\);\s*ctx\.fillRect\(laneToX\(i\),\s*0,\s*LANE_W,\s*h\);\s*\}\s*\}/;

const insert = `for(let i=0;i<laneCount;i++){
      if(i === 6) {
        // Space lane highlight (Distinct color)
        ctx.fillStyle = 'rgba(120, 170, 255, 0.08)';
        ctx.fillRect(laneToX(i), 0, LANE_W, h);
      } else if(i%2===1){ 
        ctx.fillStyle = getVar('--lane-alt'); 
        ctx.fillRect(laneToX(i), 0, LANE_W, h); 
      }
    }
    
    // Lane separators (vertical lines)
    ctx.strokeStyle = getVar('--grid-measure');
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=1;i<=laneCount;i++){
      const x = Math.round(laneToX(i)) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    ctx.stroke();`;

if (regex.test(renderer)) {
  renderer = renderer.replace(regex, insert);
  fs.writeFileSync('js/renderer.js', renderer);
  console.log('Patched renderer visuals successfully!');
} else {
  console.log('Regex did not match!');
}

