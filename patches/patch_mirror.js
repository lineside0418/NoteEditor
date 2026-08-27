const fs = require('fs');
let ui = fs.readFileSync('js/ui.js', 'utf8');

const target1 = `<button class="del-btn" id="inspDeleteMulti">選択したノーツを削除</button>`;
const insert1 = `<button id="inspMirrorMulti" style="margin-top:8px; width:100%;">左右反転 (M)</button>`;

const target2 = `document.getElementById('inspDeleteMulti').addEventListener('click', deleteSelected);`;
const insert2 = `document.getElementById('inspMirrorMulti').addEventListener('click', mirrorSelected);`;

ui = ui.replace(target1, target1 + '\\n' + insert1);
ui = ui.replace(target2, target2 + '\\n      ' + insert2);
fs.writeFileSync('js/ui.js', ui);
console.log('Added mirror UI!');

