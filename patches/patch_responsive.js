const fs = require('fs');

let converter = fs.readFileSync('converter.html', 'utf8');

// Replace body styles
converter = converter.replace(
  /body \{\r?\n\s*background-color: var\(--bg-color\);\r?\n\s*color: var\(--text-main\);\r?\n\s*font-family: var\(--sans\);\r?\n\s*margin: 0;\r?\n\s*height: 100vh;\r?\n\s*display: flex;\r?\n\s*justify-content: center;\r?\n\s*align-items: center;\r?\n\s*overflow: hidden;\r?\n\s*\}/,
  `body {
    background-color: var(--bg-color);
    color: var(--text-main);
    font-family: var(--sans);
    margin: 0;
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
    box-sizing: border-box;
  }`
);

// Replace converter-card styles
converter = converter.replace(
  /\.converter-card \{\r?\n\s*background: var\(--card-bg\);\r?\n\s*backdrop-filter: saturate\(180\%\) blur\(20px\);\r?\n\s*-webkit-backdrop-filter: saturate\(180\%\) blur\(20px\);\r?\n\s*border: 1px solid var\(--card-border\);\r?\n\s*border-radius: 24px;\r?\n\s*box-shadow: 0 10px 40px rgba\(0, 0, 0, 0\.08\);\r?\n\s*width: 400px;\r?\n\s*padding: 40px 30px;\r?\n\s*text-align: center;\r?\n\s*transition: transform 0\.3s ease, box-shadow 0\.3s ease;\r?\n\s*\}/,
  `.converter-card {
    background: var(--card-bg);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    border: 1px solid var(--card-border);
    border-radius: 24px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
    width: 100%;
    max-width: 420px;
    padding: 40px 24px;
    box-sizing: border-box;
    text-align: center;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }`
);

// Dark mode support
const darkModeVars = `
  @media (prefers-color-scheme: dark) {
    :root {
      --bg-color: #1c1c1e;
      --card-bg: rgba(44, 44, 46, 0.75);
      --card-border: rgba(255, 255, 255, 0.1);
      --text-main: #f5f5f7;
      --text-sub: #8e8e93;
    }
  }
</style>`;

converter = converter.replace('</style>', darkModeVars);

fs.writeFileSync('converter.html', converter);
console.log('Patched responsive styles');

