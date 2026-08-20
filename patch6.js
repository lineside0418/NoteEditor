const fs = require('fs');

function patch6() {
    let code = fs.readFileSync('index.html', 'utf8');

    // Add currentFileHandle variable
    code = code.replace(/let chart = null;/, "let chart = null;\n  let currentFileHandle = null;");

    // Add openChartFile function before onFileChosen
    const openChartFileLogic = `
  async function openChartFile(){
    if (!window.showOpenFilePicker) {
      el.fileInput.click();
      return;
    }
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
      });
      const file = await fileHandle.getFile();
      const text = await file.text();
      currentFileHandle = fileHandle;
      loadChart(JSON.parse(text), file.name);
    } catch(err) {
      if (err.name !== 'AbortError') alert('ファイルの読み込みに失敗しました: ' + err.message);
    }
  }
`;
    code = code.replace(/function onFileChosen\(e\)\{/, openChartFileLogic + "\n  function onFileChosen(e){");

    // Change event listeners for btnLoad and btnLoad2
    code = code.replace(/el\.btnLoad\.addEventListener\('click', \(\)=>el\.fileInput\.click\(\)\);/, "el.btnLoad.addEventListener('click', openChartFile);");
    code = code.replace(/el\.btnLoad2\.addEventListener\('click', \(\)=>el\.fileInput\.click\(\)\);/, "el.btnLoad2.addEventListener('click', openChartFile);");

    // Clear currentFileHandle in createNewChart
    code = code.replace(/function createNewChart\(\)\{/, "function createNewChart(){\n    currentFileHandle = null;");

    // Update exportChart function
    const exportChartNew = `
  async function exportChart(){
    if(!chart) return;
    const sorted = sortedNotes();
    const out = Object.assign({}, chart, { notes: sorted });
    const jsonStr = JSON.stringify(out, null, 2);

    if (!window.showSaveFilePicker) {
      const blob = new Blob([jsonStr], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.json') ? filename : filename+'.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    try {
      if (!currentFileHandle) {
        currentFileHandle = await window.showSaveFilePicker({
          suggestedName: filename.endsWith('.json') ? filename : filename + '.json',
          types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
        });
      }
      const writable = await currentFileHandle.createWritable();
      await writable.write(jsonStr);
      await writable.close();
      
      const file = await currentFileHandle.getFile();
      filename = file.name;
      el.filenameLabel.textContent = filename;
    } catch(err) {
      if (err.name !== 'AbortError') alert('保存に失敗しました: ' + err.message);
    }
  }
`;
    
    // Replace the old exportChart
    code = code.replace(/function exportChart\(\)\{[\s\S]*?URL\.revokeObjectURL\(url\);\s*\}/, exportChartNew.trim());

    fs.writeFileSync('index.html', code);
    console.log("Patch6 successful");
}

patch6();
