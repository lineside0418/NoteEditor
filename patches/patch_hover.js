const fs = require('fs');
let renderer = fs.readFileSync('js/renderer.js', 'utf8');

renderer = renderer.replace('if(hoverPos){', "if(hoverPos && pointerMode === 'place'){");

fs.writeFileSync('js/renderer.js', renderer);
console.log('Fixed ghost hover mode!');

