const fs = require('fs');

function patch5() {
    let code = fs.readFileSync('index.html', 'utf8');

    // 1. placeNote restriction
    const targetPlaceNote = "if (type === 'swap' && ![0, 5, 6].includes(lane)) return null;";
    const replacePlaceNote = targetPlaceNote + "\n    if (lane === 6 && type !== 'swap' && type !== 'scramble') return null;";
    code = code.replace(targetPlaceNote, replacePlaceNote);

    // 2. mousedown restriction
    const targetMousedown = "if (selectedType === 'swap' && ![0, 5, 6].includes(lane)) return;";
    const replaceMousedown = targetMousedown + "\n      if (lane === 6 && selectedType !== 'swap' && selectedType !== 'scramble') return;";
    code = code.replace(targetMousedown, replaceMousedown);

    // 3. group-move restriction
    const targetGroupMove = `          }
          n.lane = targetLane;`;
    const replaceGroupMove = `          } else {
            if (targetLane === 6) targetLane = 5;
          }
          n.lane = targetLane;`;
    code = code.replace(targetGroupMove, replaceGroupMove);

    // 4. Color changes in :root
    code = code.replace(/--tap:\s*#[0-9a-fA-F]+;/g, "--tap: #FFFFFF;");
    code = code.replace(/--hold:\s*#[0-9a-fA-F]+;/g, "--hold: #00BFFF;");
    code = code.replace(/--trace:\s*#[0-9a-fA-F]+;/g, "--trace: #808080;");
    code = code.replace(/--swap:\s*#[0-9a-fA-F]+;/g, "--swap: #A020F0;");
    code = code.replace(/--shift:\s*#[0-9a-fA-F]+;/g, "--shift: #FFFF00;");
    code = code.replace(/--scramble:\s*#[0-9a-fA-F]+;/g, "--scramble: #FF0000;");

    // Also update colors in hex code references like hold-fill
    // Originally --hold-fill was rgba(139,127,255,0.30) for #8B7FFF. Now #00BFFF -> rgba(0, 191, 255, 0.3)
    code = code.replace(/--hold-fill: rgba\([0-9\s,.]+\);/g, "--hold-fill: rgba(0, 191, 255, 0.3);");
    
    // In light mode / high-contrast mode, some colors were different. The regex above with /g replaced all of them so they are uniform now.

    fs.writeFileSync('index.html', code);
    console.log("Patch5 successful");
}

patch5();
