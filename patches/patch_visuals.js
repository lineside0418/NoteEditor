const fs = require('fs');
let renderer = fs.readFileSync('js/renderer.js', 'utf8');

const target = `    for(let i=0;i<laneCount;i++){
      if(i%2===1){ ctx.fillStyle = getVar('--lane-alt'); ctx.fillRect(laneToX(i),0,LANE_W,h); }
    }`;

const insert = `    // Backgrounds
    for(let i=0;i<laneCount;i++){
      if(i === 6) {
        // Space lane highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(laneToX(i), 0, LANE_W, h);
      } else if(i%2===1){ 
        ctx.fillStyle = getVar('--lane-alt') || 'rgba(255,255,255,0.02)'; 
        ctx.fillRect(laneToX(i), 0, LANE_W, h); 
      }
    }
    
    // Lane separators (vertical lines)
    ctx.strokeStyle = getVar('--grid-measure') || '#2A323F';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=1;i<=laneCount;i++){
      const x = Math.round(laneToX(i)) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    ctx.stroke();`;

renderer = renderer.replace(target, insert);
fs.writeFileSync('js/renderer.js', renderer);
console.log('Patched renderer visuals');

