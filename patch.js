const fs = require('fs');

function patch() {
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
    code = code.replace(/(if\(type==='hold'\)\{\s*n\.endTick = tick \+ snapTicks\(\)\*MIN_HOLD_LEN_UNITS;\s*\})/, 'if(type===\'hold\' || type===\'shift\'){ n.endTick = tick + snapTicks()*MIN_HOLD_LEN_UNITS; }');

    // 9. Generic n.type==='hold' to (n.type==='hold' || n.type==='shift')
    // We only want to replace specific occurrences where it matters, like drawing and hit testing.
    // Instead of regex replace all, let's target specific functions.

    // hitTest
    code = code.replace(/if\(n\.type==='hold'\)\{([\s\S]*?)const y1 = tickToY\(n\.tick\),/, 'if(n.type===\'hold\' || n.type===\'shift\'){$1const y1 = tickToY(n.tick),');

    // noteBounds
    code = code.replace(/if\(n\.type==='hold'\)\{ y0=tickToY\(n\.tick\)-NOTE_H\/2; y1=tickToY\(n\.endTick!=null\?n\.endTick:n\.tick\)\+NOTE_H\/2; \}/, 'if(n.type===\'hold\' || n.type===\'shift\'){ y0=tickToY(n.tick)-NOTE_H/2; y1=tickToY(n.endTick!=null?n.endTick:n.tick)+NOTE_H/2; }');

    // updateInspector
    code = code.replace(/\$\{n\.type==='hold' \? `(.*?)` : ''\}/, '${(n.type===\'hold\' || n.type===\'shift\') ? `$1` : \'\'}');

    // mouse events handling in beginGroupDrag, mousemove (drag), mouseup
    code = code.replace(/if\(hit\.note\.type==='hold' && hit\.zone==='end'\)/g, 'if((hit.note.type===\'hold\' || hit.note.type===\'shift\') && hit.zone===\'end\')');
    code = code.replace(/if\(n\.type==='hold' && orig\.endTick!=null\)/g, 'if((n.type===\'hold\' || n.type===\'shift\') && orig.endTick!=null)');

    // drawNote
    // inside drawNote: if(n.type==='hold'){ ... }
    // Let's change it to if(n.type==='hold' || n.type==='shift'){
    code = code.replace(/if\(n\.type==='hold'\)\{([\s\S]*?)const y2 = tickToY\(n\.endTick!=null \? n\.endTick : n\.tick\);/, 'if(n.type===\'hold\' || n.type===\'shift\'){$1const y2 = tickToY(n.endTick!=null ? n.endTick : n.tick);');
    // For shift, we probably don't want the exact same fill color as hold (var(--hold-fill)), but we can just use the note color with opacity.
    code = code.replace(/ctx\.fillStyle = getVar\('--hold-fill'\);/, 'ctx.fillStyle = n.type===\'shift\' ? color.replace(\')\', \', 0.3)\').replace(\'rgb\', \'rgba\') : getVar(\'--hold-fill\');\n      if(n.type===\'shift\' && color.startsWith(\'#\')) ctx.fillStyle = color + \'4D\';'); // Add alpha to hex

    // For drawNote else if (n.type === 'trace') ...
    // We add scramble rendering
    code = code.replace(/else if\(n\.type==='swap'\)\{/, 'else if(n.type===\'scramble\'){\n      ctx.beginPath();\n      ctx.moveTo(cx, Math.round(y)-NOTE_H/2);\n      ctx.lineTo(cx+NOTE_H, Math.round(y)+NOTE_H/2);\n      ctx.lineTo(cx-NOTE_H, Math.round(y)+NOTE_H/2);\n      ctx.closePath();\n      ctx.fillStyle = \'rgba(255, 145, 0, 0.25)\';\n      ctx.fill();\n      ctx.stroke();\n    } else if(n.type===\'swap\'){');

    // notes.filter(n=>n.type==='hold').forEach(drawNote);
    code = code.replace(/notes\.filter\(n=>n\.type==='hold'\)\.forEach\(drawNote\);/, 'notes.filter(n=>n.type===\'hold\' || n.type===\'shift\').forEach(drawNote);');
    code = code.replace(/notes\.filter\(n=>n\.type!=='hold'\)\.forEach\(drawNote\);/, 'notes.filter(n=>n.type!==\'hold\' && n.type!==\'shift\').forEach(drawNote);');

    // count-grid in HTML: ensure updateNoteCounts works for all types
    // counts initialization: const counts = {tap:0,hold:0,trace:0,swap:0};
    code = code.replace(/const counts = \{tap:0,hold:0,trace:0,swap:0\};/, 'const counts = {tap:0,hold:0,trace:0,swap:0,shift:0,scramble:0};');

    fs.writeFileSync('index.html', code);
    console.log("Patch successful");
}

patch();
