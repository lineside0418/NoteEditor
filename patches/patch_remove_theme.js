const fs = require('fs');

// 1. index.html
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<select id="themeSelect"[\s\S]*?<\/select>/, ''); // Remove theme select
html = html.replace(/<script src="js\/theme\.js"><\/script>\n\s*/, ''); // Remove theme.js script
fs.writeFileSync('index.html', html);

// 2. js/state.js
let state = fs.readFileSync('js/state.js', 'utf8');
state = state.replace(/'themeSelect',/, ''); // Remove from el array
fs.writeFileSync('js/state.js', state);

console.log('Removed theme functionality');

