const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
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

