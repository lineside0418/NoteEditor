const fs = require('fs');

function patch4() {
    let code = fs.readFileSync('index.html', 'utf8');

    // 1. drag object generation (mousedown)
    const target1 = "drag = { mode:'create-hold', lane, startTick:tick, currentTick:tick+snapTicks() };";
    const replace1 = "drag = { mode:'create-hold', type: selectedType, lane, startTick:tick, currentTick:tick+snapTicks() };";
    code = code.replace(target1, replace1);

    // 2. drawNote during drag
    const target2 = "drawNote({type:'hold', lane:drag.lane, tick:drag.startTick, endTick:drag.currentTick, id:-999});";
    const replace2 = "drawNote({type:drag.type || 'hold', lane:drag.lane, tick:drag.startTick, endTick:drag.currentTick, id:-999});";
    code = code.replace(target2, replace2);

    // 3. create note on mouseup
    const target3 = "const n = { id: nextId(), tick:drag.startTick, endTick:drag.startTick+len, lane:drag.lane, type:'hold', size:1 };";
    const replace3 = "const n = { id: nextId(), tick:drag.startTick, endTick:drag.startTick+len, lane:drag.lane, type:drag.type || 'hold', size:1 };";
    code = code.replace(target3, replace3);

    fs.writeFileSync('index.html', code);
    console.log("Patch4 successful");
}

patch4();
