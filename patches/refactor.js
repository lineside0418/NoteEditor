const fs = require('fs');

function refactor() {
    const html = fs.readFileSync('index.html', 'utf8');

    // Extract CSS
    const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    if (!fs.existsSync('css')) fs.mkdirSync('css');
    fs.writeFileSync('css/style.css', cssMatch[1].trim());

    // Extract JS
    const jsMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    if (!jsMatch) {
        console.log("No script tag found!");
        return;
    }
    let js = jsMatch[1].trim();

    // Strip IIFE wrappers
    if (js.startsWith('(function(){')) {
        js = js.replace(/^\(function\(\)\{\s*("use strict";|'use strict';)?\s*/, '');
    }
    if (js.endsWith('})();')) {
        js = js.replace(/\}\)\(\);\s*$/, '');
    }

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

    if (!fs.existsSync('js')) fs.mkdirSync('js');

    fs.writeFileSync('js/config.js', getSection('// Constants', '// State'));
    fs.writeFileSync('js/state.js', getSection('// State', '// Theme Manager'));
    fs.writeFileSync('js/theme.js', getSection('// Theme Manager', '// Static UI init'));
    fs.writeFileSync('js/math.js', getSection('// Coordinate helpers', '// Grid / bpm drawing'));
    fs.writeFileSync('js/renderer.js', getSection('// Grid / bpm drawing', '// Selection helpers'));
    fs.writeFileSync('js/editor.js', getSection('// Selection helpers', '// Mouse interaction'));
    fs.writeFileSync('js/input.js', getSection('// Mouse interaction', '// Inspector / side panel rendering'));
    fs.writeFileSync('js/ui.js', getSection('// Inspector / side panel rendering', '// Metadata modal'));

    let fileLoadJS = getSection('// File load / new chart', '// Coordinate helpers');
    let fileAudioJS = getSection('// Metadata modal', '');
    fs.writeFileSync('js/file_audio.js', fileLoadJS + '\n\n' + fileAudioJS);

    fs.writeFileSync('js/main.js', getSection('// Static UI init', '// File load / new chart'));

    // Rebuild index.html
    const newHtml = html.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="css/style.css">')
        .replace(/<script>[\s\S]*?<\/script>/, `<script src="js/config.js"></script>
  <script src="js/state.js"></script>
  <script src="js/theme.js"></script>
  <script src="js/math.js"></script>
  <script src="js/renderer.js"></script>
  <script src="js/editor.js"></script>
  <script src="js/ui.js"></script>
  <script src="js/file_audio.js"></script>
  <script src="js/input.js"></script>
  <script src="js/main.js"></script>`);

    fs.writeFileSync('index.html', newHtml);
    console.log('Modularized perfectly!');
}

refactor();

