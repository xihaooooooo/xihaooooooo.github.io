const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const root = path.resolve(__dirname, '..');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const mime = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  assert.ok(fs.existsSync(chrome), 'Chrome is required for this browser test');
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-quit-'));
  const browser = spawn(chrome, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: 'ignore' });
  let socket;
  try {
    let port;
    for (let i = 0; i < 100; i++) {
      const activePort = path.join(profile, 'DevToolsActivePort');
      if (fs.existsSync(activePort)) {
        port = Number(fs.readFileSync(activePort, 'utf8').split('\n')[0]);
        break;
      }
      await delay(100);
    }
    assert.ok(port, 'Chrome debugging port did not start');
    const page = await fetch(`http://127.0.0.1:${port}/json/new?http://127.0.0.1:${server.address().port}/index.html`, { method: 'PUT' }).then(r => r.json());
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let nextId = 0;
    const pending = new Map();
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (!message.id) return;
      const promise = pending.get(message.id);
      if (!promise) return;
      pending.delete(message.id);
      if (message.error) promise.reject(new Error(message.error.message));
      else promise.resolve(message.result);
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
    for (let i = 0; i < 100; i++) {
      if (await evaluate("document.readyState === 'complete' && !!document.getElementById('command-input')")) break;
      await delay(50);
    }
    const open = async () => {
      await evaluate("document.getElementById('command-input').value = 'open book_exam/教材PDF入库'; document.getElementById('command-form').requestSubmit()");
      for (let i = 0; i < 100; i++) {
        if (await evaluate("!document.getElementById('article-reader').hidden")) break;
        await delay(50);
      }
      assert.equal(await evaluate("document.getElementById('article-reader').hidden"), false, 'document should open');
    };
    const click = async selector => {
      const point = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.left + 10, y: r.top + 10 }; })()`);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x: point.x, y: point.y });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: point.x, y: point.y });
    };
    const pressQ = async context => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'q', code: 'KeyQ', text: 'q', windowsVirtualKeyCode: 81 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'q', code: 'KeyQ', windowsVirtualKeyCode: 81 });
      assert.equal(await evaluate("document.getElementById('article-reader').hidden"), true, `q should close document ${context}; focus is ${await evaluate('document.activeElement.id')}`);
      assert.equal(await evaluate('document.activeElement.id'), 'command-input', 'command input should regain focus');
    };
    await open();
    await click('.reader-line');
    await pressQ('after clicking text');
    await open();
    await click('.reader-file');
    await pressQ('after clicking the status bar');
    await open();
    await evaluate("document.getElementById('reader-quit').focus()");
    await pressQ('with the quit button focused');
    console.log('PASS: q closes the reader from text, status bar, and quit button focus');
  } finally {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ id: 999999, method: 'Browser.close' }));
      await delay(500);
    }
    socket?.close();
    browser.kill();
    await new Promise(resolve => server.close(resolve));
    for (let i = 0; i < 10; i++) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; }
      catch (error) { if (i === 9) console.warn(`Chrome profile cleanup: ${error.message}`); else await delay(200); }
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
