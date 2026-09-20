/**
 * Corphia Demo 本地伺服器（含錯誤顯示注入）
 * 使用 Node.js 內建模組，不需要任何 npm 套件
 */
const http = require('http')
const fs   = require('fs')
const path = require('path')

const PORT = 5174
const FILE = path.join(__dirname, 'Corphia-Demo.html')

// 注入在 <head> 最前面的 error handler script
// 任何 JS 錯誤都會直接顯示在頁面上（白底紅字）
const ERROR_SCRIPT = `<script>
(function(){
  function show(msg, stack) {
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:#fff;color:#c00;padding:20px;font-family:monospace;font-size:13px;line-height:1.5;white-space:pre-wrap;max-height:60vh;overflow:auto;border-bottom:3px solid #c00';
    el.innerHTML = '<b>❌ JavaScript Error</b>\\n' + msg + (stack ? '\\n\\n' + stack : '');
    document.body ? document.body.prepend(el) : document.documentElement.prepend(el);
  }
  window.onerror = function(msg, src, line, col, err) {
    show('Line ' + line + ':' + col + '\\n' + msg, err && err.stack);
    return false;
  };
  window.addEventListener('unhandledrejection', function(e) {
    var err = e.reason;
    show('Unhandled Promise\\n' + (err && err.message || String(err)), err && err.stack);
  });
})();
</script>`

const server = http.createServer((req, res) => {
    let html = fs.readFileSync(FILE, 'utf8')

    // 把 error script 注入到 <head> 最前面（在任何其他 script 之前）
    html = html.replace('<head>', '<head>' + ERROR_SCRIPT)

    res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
    })
    res.end(html)
})

server.listen(PORT, '127.0.0.1', () => {
    const url = `http://localhost:${PORT}`
    console.log(`\n  ✅ Corphia 展示已啟動：${url}`)
    console.log('  如果頁面顯示紅色錯誤訊息，截圖給 AI 看')
    console.log('  請保持此視窗開啟，關閉後展示停止\n')

    const { exec } = require('child_process')
    exec(`start ${url}`)
})

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n  ⚠️  Port ${PORT} 被占用，請先關閉其他展示視窗\n`)
    } else {
        console.error(err)
    }
    process.exit(1)
})
