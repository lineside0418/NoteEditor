// Manual integration check: node tests/browser-smoke.js
// Requires Chrome. Exercises the real page, event editor, inversion, and wave seek.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function freePort(){
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

function silentWav(){
  const sampleRate = 8000, samples = sampleRate * 2;
  const data = Buffer.alloc(44 + samples * 2);
  data.write('RIFF',0); data.writeUInt32LE(data.length-8,4);
  data.write('WAVEfmt ',8); data.writeUInt32LE(16,16);
  data.writeUInt16LE(1,20); data.writeUInt16LE(1,22);
  data.writeUInt32LE(sampleRate,24); data.writeUInt32LE(sampleRate*2,28);
  data.writeUInt16LE(2,32); data.writeUInt16LE(16,34);
  data.write('data',36); data.writeUInt32LE(samples*2,40);
  return 'data:audio/wav;base64,' + data.toString('base64');
}

async function main(){
  const port = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(),'noteeditor-browser-'));
  const pageUrl = pathToFileURL(path.join(__dirname,'../index.html')).href;
  const browser = spawn(chromePath,[
    '--headless=new','--disable-gpu','--no-first-run','--disable-extensions',
    '--no-sandbox',`--remote-debugging-port=${port}`,'--remote-allow-origins=*',
    `--user-data-dir=${profile}`,pageUrl,
  ],{windowsHide:true,stdio:'ignore'});
  let socket;
  try {
    let page;
    for(let attempt=0;attempt<60;attempt++){
      try {
        const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        page = pages.find(entry => entry.type === 'page' && entry.url === pageUrl);
        if(page) break;
      } catch {}
      await pause(100);
    }
    assert.ok(page,'Chrome page target did not open');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve,reject) => {socket.onopen=resolve;socket.onerror=reject;});
    let nextId = 0;
    const pending = new Map();
    socket.onmessage = event => {
      const response = JSON.parse(event.data);
      if(pending.has(response.id)){
        pending.get(response.id)(response);
        pending.delete(response.id);
      }
    };
    const call = (method,params={}) => new Promise(resolve => {
      const id = ++nextId;
      pending.set(id,resolve);
      socket.send(JSON.stringify({id,method,params}));
    });
    async function evaluate(expression){
      const response = await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
      if(response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text);
      return response.result?.result?.value;
    }
    let ready = false;
    for(let attempt=0;attempt<50;attempt++){
      ready = await evaluate('document.readyState === "complete" && typeof openTimingEditor === "function" && el.snapSelect.options.length > 0');
      if(ready) break;
      await pause(100);
    }
    assert.ok(ready,'Editor scripts did not initialize');
    const result = await evaluate(`(async()=>{
      createNewChart();
      openTimingEditor();
      appendTimingRow('bpms',1920,240);
      appendTimingRow('scrolls',960,0.5);
      saveTimingEditor();
      setTimelineInverted(true);
      const inverted = tickToY(960) < tickToY(0);
      audio.src = ${JSON.stringify(silentWav())};
      audio.load();
      await new Promise((resolve,reject)=>{
        if(audio.readyState >= 1) return resolve();
        audio.addEventListener('loadedmetadata',resolve,{once:true});
        audio.addEventListener('error',reject,{once:true});
      });
      const clickY = tickToY(960);
      el.scrollWrap.scrollTop = clickY - el.scrollWrap.clientHeight/2;
      const rect = el.gridCanvas.getBoundingClientRect();
      el.gridCanvas.dispatchEvent(new MouseEvent('mousedown',{
        bubbles:true,button:0,
        clientX:rect.left+laneToX(laneCount)+50,
        clientY:rect.top+clickY-el.scrollWrap.scrollTop,
      }));
      el.btnPreview.click();
      const previewOpen = el.previewModalOverlay.classList.contains('open');
      closeScrollPreview();
      undo();
      const undoRemoved = !chart.timing.bpms.some(e=>e.tick===1920);
      redo();
      const redoRestored = chart.timing.bpms.some(e=>e.tick===1920 && e.bpm===240);
      const noteY = tickToY(960);
      const noteRect = el.gridCanvas.getBoundingClientRect();
      el.gridCanvas.dispatchEvent(new MouseEvent('mousedown',{
        bubbles:true,button:0,
        clientX:noteRect.left+RULER_W+LANE_W/2,
        clientY:noteRect.top+noteY-el.scrollWrap.scrollTop,
      }));
      const reversedPlacement = chart.notes.some(n=>n.tick===960 && n.lane===0);
      return {
        bpm:chart.timing.bpms.find(e=>e.tick===1920)?.bpm,
        scroll:chart.timing.scrolls.find(e=>e.tick===960)?.speed,
        inverted,
        waveSeek:audio.currentTime,
        previewOpen,undoRemoved,redoRestored,reversedPlacement,
      };
    })()`);
    assert.equal(result.bpm,240);
    assert.equal(result.scroll,0.5);
    assert.equal(result.inverted,true);
    assert.ok(Math.abs(result.waveSeek-0.5)<0.02,`Wave seek landed at ${result.waveSeek}`);
    assert.equal(result.previewOpen,true);
    assert.equal(result.undoRemoved,true);
    assert.equal(result.redoRestored,true);
    assert.equal(result.reversedPlacement,true);
    console.log('Browser smoke passed:',result);
    await call('Browser.close');
  } finally {
    if(socket && socket.readyState === WebSocket.OPEN) socket.close();
    browser.kill();
    if(browser.exitCode == null) await Promise.race([
      new Promise(resolve => browser.once('exit',resolve)),
      pause(2000),
    ]);
    const tempRoot = fs.realpathSync(os.tmpdir());
    const resolvedProfile = path.resolve(profile);
    if(path.relative(tempRoot,resolvedProfile).startsWith('..')) throw new Error('Temporary profile escaped temp root');
    fs.rmSync(resolvedProfile,{recursive:true,force:true,maxRetries:10,retryDelay:300});
  }
}

main().catch(error => {console.error(error);process.exitCode=1;});
