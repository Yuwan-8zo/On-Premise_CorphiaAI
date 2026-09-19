/**
 * Corphia Demo 本地伺服器
 * 使用 Node.js 內建模組，不需要任何 npm 套件
 * 執行：node server.js
 */
const http = require('http')
const fs   = require('fs')
const path = require('path')

const PORT = 5174
const FILE = path.join(__dirname, 'Corphia-Demo.html')

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        // 允許 ES Module 在 http:// 下正常執行
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    })
    fs.createReadStream(FILE).pipe(res)
})

server.listen(PORT, '127.0.0.1', () => {
    const url = `http://localhost:${PORT}`
    console.log(`\n  ✅ Corphia 展示已啟動：${url}`)
    console.log('  請保持此視窗開啟，關閉後展示停止\n')

    // 自動開啟瀏覽器
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
