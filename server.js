/**
 * Corphia Demo local server
 * Uses only Node.js built-in modules, no npm packages needed
 */
const http = require('http')
const fs   = require('fs')
const path = require('path')
const net  = require('net')

const START_PORT = 5174
const FILE = path.join(__dirname, 'Corphia-Demo.html')

function isPortFree(port) {
    return new Promise((resolve) => {
        const tester = net.createServer()
        tester.once('error', () => resolve(false))
        tester.once('listening', () => {
            tester.close(() => resolve(true))
        })
        tester.listen(port, '127.0.0.1')
    })
}

async function findFreePort(start) {
    for (let p = start; p < start + 10; p++) {
        if (await isPortFree(p)) return p
    }
    throw new Error('No free port found in range ' + start + '-' + (start + 9))
}

async function main() {
    const PORT = await findFreePort(START_PORT)

    const server = http.createServer((req, res) => {
        try {
            let html = fs.readFileSync(FILE, 'utf8')
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
            })
            res.end(html)
        } catch (e) {
            res.writeHead(500)
            res.end('Error reading Corphia-Demo.html: ' + e.message)
        }
    })

    server.listen(PORT, '127.0.0.1', () => {
        const url = 'http://localhost:' + PORT
        console.log('')
        console.log('  Corphia Demo is running: ' + url)
        console.log('  Keep this window open. Close it to stop.')
        console.log('')
        const { exec } = require('child_process')
        exec('start ' + url)
    })

    server.on('error', (err) => {
        console.error('Server error: ' + err.message)
        process.exit(1)
    })
}

main().catch((err) => {
    console.error('Startup error: ' + err.message)
    process.exit(1)
})
