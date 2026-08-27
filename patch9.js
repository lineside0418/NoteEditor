const fs = require('fs');

function patch9() {
    let code = fs.readFileSync('index.html', 'utf8');
    code = code.replace(/\r\n/g, '\n');

    const maxContentTickRegex = /function maxContentTick\(\)\{[\s\S]*?return m;\s*\}/;
    const maxContentTickReplacement = `function maxContentTick(){
    let m = 0;
    
    // 既存のノーツやタイミングイベントから最大Tickを取得
    (chart.notes||[]).forEach(n=>{ m = Math.max(m, n.tick||0, n.endTick||0); });
    (chart.timing.bpms||[]).forEach(b=>m=Math.max(m,b.tick||0));
    (chart.timing.timeSignatures||[]).forEach(t=>m=Math.max(m,t.tick||0));

    // 音声が読み込まれている場合は、曲の総尺そのものから最大Tickを算出してキャンバスを伸ばす
    const durationSec = audioDurationSec();
    if (durationSec > 0) {
      const audioMaxTick = secondsToTick(durationSec);
      m = Math.max(m, audioMaxTick);
    }
    
    // 音声がなくても常に最後尾からさらに20小節分の余白（キャンバス領域）を確保する
    // これにより、音声未読み込み状態でもスクロールして無限にノーツを配置し続けられる
    return m + (resolution * 4 * 20);
  }`;

    code = code.replace(maxContentTickRegex, maxContentTickReplacement);

    // Revert newlines
    code = code.replace(/\n/g, '\r\n');
    fs.writeFileSync('index.html', code);
    console.log("Patch9 applied");
}

patch9();

