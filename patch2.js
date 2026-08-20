const fs = require('fs');

function patch2() {
    let code = fs.readFileSync('index.html', 'utf8');

    // 1. placeNote制限と、ドラッグ作成での制限
    // placeNoteの内部にバリデーションを追加
    code = code.replace(/function placeNote\(type, tick, lane\)\{/, `function placeNote(type, tick, lane){
    if (type === 'swap' && ![0, 5, 6].includes(lane)) return null;
    if (type === 'scramble' && lane !== 6) return null;`);

    // mousedown で create-hold するときのバリデーション
    code = code.replace(/if\(selectedType==='hold'\)\{/, `if (selectedType === 'swap' && ![0, 5, 6].includes(lane)) return;
      if (selectedType === 'scramble' && lane !== 6) return;
      if(selectedType==='hold' || selectedType==='shift'){`);

    // 2. drawNote で lane===6 のとき、幅を 6 レーン分にする
    // laneToX(n.lane) でX座標を取っている。
    // lane=6 のときは、Xを laneToX(0) とし、LANE_W を LANE_W*6 として描画するように cx や幅の計算を書き換える。
    // まず drawNote の先頭部分を修正
    code = code.replace(/function drawNote\(n\)\{\s*const x = laneToX\(n\.lane\);\s*const y = tickToY\(n\.tick\);\s*const cx = x \+ LANE_W\/2;/, `function drawNote(n){
    const isSpecialLane = n.lane === 6;
    const x = isSpecialLane ? laneToX(0) : laneToX(n.lane);
    const drawWidth = isSpecialLane ? LANE_W * 6 : LANE_W;
    const y = tickToY(n.tick);
    const cx = x + drawWidth/2;`);

    // drawNote 内で LANE_W を参照している箇所を drawWidth に置き換える
    // ただし、スコープ内の置換になるので慎重に。
    // ctx.fillRect(x+6, y, LANE_W-12, Math.max(2,y2-y)); -> drawWidth-12
    // ctx.strokeRect(x+6, y, LANE_W-12, Math.max(2,y2-y)); -> drawWidth-12
    // ctx.fillRect(x+6, y2-3, LANE_W-12, 3); -> drawWidth-12
    code = code.replace(/ctx\.fillRect\(x\+6, y, LANE_W-12/g, 'ctx.fillRect(x+6, y, drawWidth-12');
    code = code.replace(/ctx\.strokeRect\(x\+6, y, LANE_W-12/g, 'ctx.strokeRect(x+6, y, drawWidth-12');
    code = code.replace(/ctx\.fillRect\(x\+6, y2-3, LANE_W-12/g, 'ctx.fillRect(x+6, y2-3, drawWidth-12');

    // ctx.lineTo(cx+LANE_W/2-8, y); -> drawWidth/2-8
    // ctx.lineTo(cx-LANE_W/2+8, y); -> drawWidth/2+8
    code = code.replace(/ctx\.lineTo\(cx\+LANE_W\/2-8/g, 'ctx.lineTo(cx+drawWidth/2-8');
    code = code.replace(/ctx\.lineTo\(cx-LANE_W\/2\+8/g, 'ctx.lineTo(cx-drawWidth/2+8');

    // const rw = LANE_W-16, rh = NOTE_H; -> const rw = drawWidth-16, rh = NOTE_H;
    code = code.replace(/const rw = LANE_W-16/g, 'const rw = drawWidth-16');

    // hitTest の hitTest 内の LANE_W も修正
    // const cx = laneToX(n.lane)+LANE_W/2;
    // if(Math.abs(x-cx) > LANE_W/2-4) continue;
    code = code.replace(/const cx = laneToX\(n\.lane\)\+LANE_W\/2;\s*if\(Math\.abs\(x-cx\) > LANE_W\/2-4\) continue;/, `const isSpecialLane = n.lane === 6;
      const drawWidth = isSpecialLane ? LANE_W * 6 : LANE_W;
      const cx = isSpecialLane ? laneToX(0) + drawWidth/2 : laneToX(n.lane) + drawWidth/2;
      if(Math.abs(x-cx) > drawWidth/2-4) continue;`);

    // noteBounds の LANE_W も修正
    // const x0 = laneToX(n.lane)+6, x1 = laneToX(n.lane)+LANE_W-6;
    code = code.replace(/const x0 = laneToX\(n\.lane\)\+6, x1 = laneToX\(n\.lane\)\+LANE_W-6;/, `const isSpecialLane = n.lane === 6;
    const drawWidth = isSpecialLane ? LANE_W * 6 : LANE_W;
    const x = isSpecialLane ? laneToX(0) : laneToX(n.lane);
    const x0 = x+6, x1 = x+drawWidth-6;`);

    // hover時の描画も LANE_W ではなく特別な幅にする
    code = code.replace(/ctx\.fillRect\(laneToX\(hoverPos\.lane\), y-NOTE_H\/2-2, LANE_W, NOTE_H\+4\);/, `const hWidth = hoverPos.lane === 6 ? LANE_W * 6 : LANE_W;
      const hX = hoverPos.lane === 6 ? laneToX(0) : laneToX(hoverPos.lane);
      ctx.fillRect(hX, y-NOTE_H/2-2, hWidth, NOTE_H+4);`);

    // lane header で 6のレーン（7番目）は名前を変えるなど
    code = code.replace(/c\.textContent = 'LANE '\+i;/, `c.textContent = i === 6 ? 'SPACE' : ('LANE '+(i+1));`);

    fs.writeFileSync('index.html', code);
    console.log("Patch 2 successful");
}

patch2();
