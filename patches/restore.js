const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const jsMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!jsMatch) {
  console.log("No script tag found in index.html, skipping extraction");
  process.exit(0);
}
let js = jsMatch[1];

function getSection(startComment, endComment) {
    const startIndex = js.indexOf(startComment);
    if (startIndex === -1) return '';
    if (!endComment) {
        return js.substring(startIndex).trim();
    }
    const endIndex = js.indexOf(endComment, startIndex);
    if (endIndex === -1) return js.substring(startIndex).trim();
    return js.substring(startIndex, endIndex).trim();
}

let fileLoadJS = getSection('// File load / new chart', '// Coordinate helpers');
let fileAudioJS = getSection('// Metadata modal', '');
fs.writeFileSync('js/file_audio.js', fileLoadJS + '\n\n' + fileAudioJS);
console.log('Restored file_audio.js');

