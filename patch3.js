const fs = require('fs');

function patch3() {
    let code = fs.readFileSync('index.html', 'utf8');

    // 1. group-move 制限の追加
    const target = 'n.lane = clampLane(orig.lane+deltaLane);';
    const replacement = `let targetLane = clampLane(orig.lane+deltaLane);
          if (n.type === 'scramble') {
            targetLane = 6;
          } else if (n.type === 'swap') {
            if (![0, 5, 6].includes(targetLane)) {
              // 0, 5, 6 のうち一番近いものにする
              targetLane = [0, 5, 6].reduce((prev, curr) => Math.abs(curr - targetLane) < Math.abs(prev - targetLane) ? curr : prev);
            }
          }
          n.lane = targetLane;`;
    
    code = code.replace(target, replacement);

    fs.writeFileSync('index.html', code);
    console.log("Patch3 successful");
}

patch3();
