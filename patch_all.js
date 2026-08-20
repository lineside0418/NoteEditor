const fs = require('fs');

function patchAll() {
    let code = fs.readFileSync('index.html', 'utf8');

    // 1. CSS variables
    code = code.replace(/(--swap:\s*#[0-9A-Fa-f]+;)/, '$1\n    --shift: #00E5FF;\n    --scramble: #FF9100;');
    code = code.replace(/(--swap:\s*#[0-9A-Fa-f]+;)/, '$1\n    --shift: #0891B2;\n    --scramble: #D97706;'); // for light mode
    code = code.replace(/(--swap:\s*#[0-9A-Fa-f]+;)/, '$1\n    --shift: #00FFFF;\n    --scramble: #FFA500;'); // for high-contrast

    // 2. CSS classes
    code = code.replace(/(\.type-btn\[data-type="swap"\].active\{border-left-color:var\(--swap\);\})/, '$1\n  .type-btn[data-type="shift"].active{border-left-color:var(--shift);}\n  .type-btn[data-type="scramble"].active{border-left-color:var(--scramble);}');

    // 3. HTML Buttons
    code = code.replace(/(<button class="type-btn" data-type="swap">.*<\/button>)/, '$1\n    <button class="type-btn" data-type="shift"><span class="dot" style="background:var(--shift)"></span>SHIFT<kbd>5</kbd></button>\n    <button class="type-btn" data-type="scramble"><span class="dot" style="background:var(--scramble)"></span>SCRAMBLE<kbd>6</kbd></button>');

    // 4. State & default metadata
    code = code.replace(/let laneCount = 6;/, 'let laneCount = 7;');
    code = code.replace(/laneCount: 6,/g, 'laneCount: 7,');

    // 5. TYPE_META
    code = code.replace(/(swap:\s*\{\s*color:\s*getVar\('--swap'\),\s*label:'SWAP',\s*hasEnd:false\s*\},)/, '$1\n    shift:    { color: getVar(\'--shift\'),    label:\'SHIFT\',    hasEnd:true  },\n    scramble: { color: getVar(\'--scramble\'), label:\'SCRAMBLE\', hasEnd:false },');

    // 6. Theme update
    code = code.replace(/(TYPE_META\.swap\.color = getVar\('--swap'\);)/, '$1\n    TYPE_META.shift.color = getVar(\'--shift\');\n    TYPE_META.scramble.color = getVar(\'--scramble\');');

    // 7. Keydown
    code = code.replace(/(else if\(e\.key==='4'\)\{\s*selectType\('swap'\);\s*\})/, '$1\n    else if(e.key===\'5\'){ selectType(\'shift\'); }\n    else if(e.key===\'6\'){ selectType(\'scramble\'); }');

    // 8. placeNote
    code = code.replace(/function placeNote\(type, tick, lane\)\{/, `function placeNote(type, tick, lane){
    if (type === 'swap' && ![0, 5, 6].includes(lane)) return null;
    if (type === 'scramble' && lane !== 6) return null;`);
    code = code.replace(/(if\(type==='hold'\)\{\s*n\.endTick = tick \+ snapTicks\(\)\*MIN_HOLD_LEN_UNITS;\s*\})/, 'if(type===\'hold\' || type===\'shift\'){ n.endTick = tick + snapTicks()*MIN_HOLD_LEN_UNITS; }');

    // 9. hitTest
    code = code.replace(/const cx = laneToX\(n\.lane\)\+LANE_W\/2;\s*if\(Math\.abs\(x-cx\) > LANE_W\/2-4\) continue;\s*if\(n\.type==='hold'\)\{/g, `const isSpecialLane = n.lane === 6;
      const drawWidth = isSpecialLane ? LANE_W * 6 : LANE_W;
      const cx = isSpecialLane ? laneToX(0) + drawWidth/2 : laneToX(n.lane) + drawWidth/2;
      if(Math.abs(x-cx) > drawWidth/2-4) continue;
      if(n.type==='hold' || n.type==='shift'){`);

    // 10. noteBounds
    code = code.replace(/const x0 = laneToX\(n\.lane\)\+6, x1 = laneToX\(n\.lane\)\+LANE_W-6;\s*let y0,y1;\s*if\(n\.type==='hold'\)\{ y0=tickToY\(n\.tick\)-NOTE_H\/2; y1=tickToY\(n\.endTick!=null\?n\.endTick:n\.tick\)\+NOTE_H\/2; \}/, `const isSpecialLane = n.lane === 6;
    const drawWidth = isSpecialLane ? LANE_W * 6 : LANE_W;
    const x = isSpecialLane ? laneToX(0) : laneToX(n.lane);
    const x0 = x+6, x1 = x+drawWidth-6;
    let y0,y1;
    if(n.type==='hold' || n.type==='shift'){ y0=tickToY(n.tick)-NOTE_H/2; y1=tickToY(n.endTick!=null?n.endTick:n.tick)+NOTE_H/2; }`);

    // 11. updateInspector
    // original: ${n.type==='hold' ? `<div class="stat-row"><span class="k">EndTick</span>...
    code = code.replace(/\$\{n\.type==='hold' \? `(.*?)` : ''\}/g, '${(n.type===\'hold\' || n.type===\'shift\') ? `$1` : \'\'}');

    // 12. mouse events handling
    code = code.replace(/if\(hit\.note\.type==='hold' && hit\.zone==='end'\)/g, 'if((hit.note.type===\'hold\' || hit.note.type===\'shift\') && hit.zone===\'end\')');
    code = code.replace(/if\(n\.type==='hold' && orig\.endTick!=null\)/g, 'if((n.type===\'hold\' || n.type===\'shift\') && orig.endTick!=null)');
    code = code.replace(/if\(selectedType==='hold'\)\{/, `if (selectedType === 'swap' && ![0, 5, 6].includes(lane)) return;
      if (selectedType === 'scramble' && lane !== 6) return;
      if(selectedType==='hold' || selectedType==='shift'){`);

    // 13. drawNote
    code = code.replace(/function drawNote\(n\)\{\s*const x = laneToX\(n\.lane\);\s*const y = tickToY\(n\.tick\);\s*const cx = x \+ LANE_W\/2;/, `function drawNote(n){
    const isSpecialLane = n.lane === 6;
    const x = isSpecialLane ? laneToX(0) : laneToX(n.lane);
    const drawWidth = isSpecialLane ? LANE_W * 6 : LANE_W;
    const y = tickToY(n.tick);
    const cx = x + drawWidth/2;`);

    // Replace drawNote's LANE_W usage
    code = code.replace(/ctx\.fillRect\(x\+6, y, LANE_W-12/g, 'ctx.fillRect(x+6, y, drawWidth-12');
    code = code.replace(/ctx\.strokeRect\(x\+6, y, LANE_W-12/g, 'ctx.strokeRect(x+6, y, drawWidth-12');
    code = code.replace(/ctx\.fillRect\(x\+6, y2-3, LANE_W-12/g, 'ctx.fillRect(x+6, y2-3, drawWidth-12');
    code = code.replace(/ctx\.lineTo\(cx\+LANE_W\/2-8/g, 'ctx.lineTo(cx+drawWidth/2-8');
    code = code.replace(/ctx\.lineTo\(cx-LANE_W\/2\+8/g, 'ctx.lineTo(cx-drawWidth/2+8');
    code = code.replace(/const rw = LANE_W-16/g, 'const rw = drawWidth-16');

    code = code.replace(/if\(n\.type==='hold'\)\{([\s\S]*?)const y2 = tickToY\(n\.endTick!=null \? n\.endTick : n\.tick\);/, 'if(n.type===\'hold\' || n.type===\'shift\'){$1const y2 = tickToY(n.endTick!=null ? n.endTick : n.tick);');
    code = code.replace(/ctx\.fillStyle = getVar\('--hold-fill'\);/, 'ctx.fillStyle = n.type===\'shift\' ? color.replace(\')\', \', 0.3)\').replace(\'rgb\', \'rgba\') : getVar(\'--hold-fill\');\n      if(n.type===\'shift\' && color.startsWith(\'#\')) ctx.fillStyle = color + \'4D\';');

    // Scramble rendering
    code = code.replace(/else if\(n\.type==='swap'\)\{/, `else if(n.type==='scramble'){
      ctx.beginPath();
      ctx.moveTo(cx, Math.round(y)-NOTE_H/2);
      ctx.lineTo(cx+NOTE_H, Math.round(y)+NOTE_H/2);
      ctx.lineTo(cx-NOTE_H, Math.round(y)+NOTE_H/2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 145, 0, 0.25)';
      ctx.fill();
      ctx.stroke();
    } else if(n.type==='swap'){`);

    // notes.filter
    code = code.replace(/notes\.filter\(n=>n\.type==='hold'\)\.forEach\(drawNote\);/, 'notes.filter(n=>n.type===\'hold\' || n.type===\'shift\').forEach(drawNote);');
    code = code.replace(/notes\.filter\(n=>n\.type!=='hold'\)\.forEach\(drawNote\);/, 'notes.filter(n=>n.type!==\'hold\' && n.type!==\'shift\').forEach(drawNote);');

    // hover
    code = code.replace(/ctx\.fillRect\(laneToX\(hoverPos\.lane\), y-NOTE_H\/2-2, LANE_W, NOTE_H\+4\);/, `const hWidth = hoverPos.lane === 6 ? LANE_W * 6 : LANE_W;
      const hX = hoverPos.lane === 6 ? laneToX(0) : laneToX(hoverPos.lane);
      ctx.fillRect(hX, y-NOTE_H/2-2, hWidth, NOTE_H+4);`);

    // lane header name
    code = code.replace(/c\.textContent = 'LANE '\+i;/, `c.textContent = i === 6 ? 'SPACE' : ('LANE '+(i+1));`);

    // counts
    code = code.replace(/const counts = \{tap:0,hold:0,trace:0,swap:0\};/, 'const counts = {tap:0,hold:0,trace:0,swap:0,shift:0,scramble:0};');

    fs.writeFileSync('index.html', code);
    console.log("PatchAll successful");
}

patchAll();
