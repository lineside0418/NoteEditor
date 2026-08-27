const fs = require('fs');
let input = fs.readFileSync('js/input.js', 'utf8');

const target = `    if(e.button!==0) return;`;
const insert = `    if(drag && drag.mode === 'paste') {
      commitPaste();
      return;
    }`;

input = input.replace(target, target + '\\n' + insert);
fs.writeFileSync('js/input.js', input);
console.log('Added mousedown paste commit!');

