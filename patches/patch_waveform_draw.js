const fs = require('fs');
let renderer = fs.readFileSync('js/renderer.js', 'utf8');

const target = `    drawBpmLines(maxTick);`;
const insert = `    // Waveform
    if (waveformData && waveformData.length > 0) {
      const startX = laneToX(laneCount) + 30; // 30px margin
      const waveWidth = 80; // width of waveform lane
      
      // Draw background for waveform lane
      ctx.fillStyle = getVar('--lane-alt') || 'rgba(255,255,255,0.02)';
      ctx.fillRect(startX, 0, waveWidth, h);
      
      ctx.beginPath();
      ctx.strokeStyle = getVar('--primary') || '#00e5ff';
      ctx.lineWidth = 1;
      
      const pxPerSec = (resolution / (chart.timing.bpms[0]?.bpm || 120)) * (120/60) * pxPerTick(); // Rough estimate if multiple BPMs, but better to use audioTimeForTick inverted.
      // Wait, we know 1 data point = 10ms = 0.01s.
      // For each point i, time = i * 0.01 sec.
      // tick = tickForAudioTime(time)
      // y = tickToY(tick)
      
      // Optimization: Only draw visible portion. But for now draw all or visible.
      // We can iterate waveformData.
      const centerY = waveWidth / 2;
      for (let i = 0; i < waveformData.length; i++) {
        const time = i * 0.01;
        const tick = tickForAudioTime(time);
        if (tick > maxTick + 1000) break;
        const y = tickToY(tick);
        
        const minX = startX + waveWidth/2 + (waveformData[i].min * waveWidth/2);
        const maxX = startX + waveWidth/2 + (waveformData[i].max * waveWidth/2);
        
        ctx.moveTo(minX, y);
        ctx.lineTo(maxX, y);
      }
      ctx.stroke();
    }`;

renderer = renderer.replace(target, target + '\\n' + insert);
fs.writeFileSync('js/renderer.js', renderer);
console.log('Added waveform drawing!');

