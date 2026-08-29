const fs = require('fs');

let converter = fs.readFileSync('converter.html', 'utf8');

// Allow .txt in accept attribute
converter = converter.replace('accept="application/json,.json"', 'accept="application/json,.json,text/plain,.txt"');

// Change file validation
converter = converter.replace(
  /if \(\!file\.name\.endsWith\('\.json'\)\) \{\r?\n\s*showMessage\('JSONファイルを選択してください', true\);\r?\n\s*return;\r?\n\s*\}/,
  "if (!file.name.endsWith('.json') && !file.name.endsWith('.txt')) {\\n      showMessage('JSONまたはTXTファイルを選択してください', true);\\n      return;\\n    }"
);

// Change download filename logic
converter = converter.replace(
  /downloadJson\(newData, file\.name\.replace\('\\.json', '_ricf1\\.json'\)\);/,
  "downloadJson(newData, file.name.replace(/\\\\.(json|txt)$/i, '_ricf1.json'));"
);

fs.writeFileSync('converter.html', converter);
console.log('Fixed file acceptance!');

