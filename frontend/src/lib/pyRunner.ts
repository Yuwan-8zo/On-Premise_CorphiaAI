/**
 * 執行 AI 寫的 Python（在使用者自己瀏覽器的沙盒裡，不在主機上）
 *
 * 程式是模型寫的，當成不可信的東西處理：
 *   1. 跑在一個看不見的沙盒框裡（sandbox="allow-scripts"，沒有同源權限）：
 *      讀不到這個系統的登入資料、對話內容，不能開視窗、不能把頁面帶走
 *   2. 框裡的內容安全政策只允許向主機拿「Python 本體和套件」那一個資料夾的檔案（/pyodide/），
 *      其他任何網址（外面的網站、這個系統的 API）都連不到——資料送不出去
 *   3. 有時間上限：跑太久就把整個框拿掉（WebAssembly 沒有辦法從外面叫停，只能整個丟掉重來）
 * 使用者給它的資料檔只放在這個框自己的記憶體裡，不會上傳到任何地方。
 *
 * Python 本體是 Pyodide（scripts/fetch_pyodide.py 下載到 frontend/public/pyodide/，由主機自己提供）。
 */

/** 一次執行最多跑多久（毫秒）；超過就中止 */
export const PY_RUN_TIMEOUT_MS = 60_000
/** 第一次載入 Python 本體最多等多久（毫秒）：之後同一頁再執行就不用重載 */
export const PY_LOAD_TIMEOUT_MS = 120_000
/** 輸出的文字最多留多少字、圖最多幾張（防止一個迴圈把頁面塞爆） */
export const PY_MAX_OUTPUT_CHARS = 20_000
export const PY_MAX_IMAGES = 6
/** 讀寫 Excel 的套件（Pyodide 沒有內建；檔名和 scripts/fetch_pyodide.py 的 PYPI_WHEELS 一致） */
const EXTRA_WHEELS = ['et_xmlfile-2.0.0-py3-none-any.whl', 'openpyxl-3.1.5-py2.py3-none-any.whl']

export interface PyRunFile {
    name: string
    data: ArrayBuffer
}

export interface PyRunResult {
    ok: boolean
    /** print 出來的文字（含錯誤訊息以外的標準錯誤輸出） */
    stdout: string
    /** 最後一行運算式的值（像互動模式那樣顯示；表格會排成文字） */
    value: string
    /** 畫出來的圖（PNG 的資料網址） */
    images: string[]
    /** 程式出錯時的錯誤訊息（最後幾行） */
    error: string
    seconds: number
    /** 跑太久被中止 */
    timedOut: boolean
}

/** 沙盒框的內容安全政策：只能向主機的 /pyodide/ 拿檔案，其他一律禁止 */
export function runnerCsp(origin: string): string {
    const assets = `${origin}/pyodide/`
    return [
        "default-src 'none'",
        // 'unsafe-eval'／'wasm-unsafe-eval'：Python 本體是 WebAssembly，要允許編譯才能跑
        `script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' ${assets}`,
        `connect-src ${assets}`,
        // Python 跑在背景執行緒裡（見 runnerDocument），執行緒的程式是框自己在記憶體裡組的
        'worker-src blob:',
        'img-src data: blob:',
    ].join('; ')
}

/**
 * 背景執行緒裡跑的程式：載入 Python、執行、把結果傳回去。
 * 為什麼要另外開執行緒：沙盒框和外面的頁面用同一條執行緒，程式一旦卡住（例如無窮迴圈），
 * 整個頁面會跟著凍結，連「逾時中止」的計時器都不會響。放到背景執行緒，頁面照常可以操作，
 * 逾時就把框拿掉，執行緒跟著結束。背景執行緒裡也沒有頁面、沒有儲存空間，能碰到的東西更少。
 */
function workerSource(assets: string): string {
    return `
const ASSETS = ${JSON.stringify(assets)};
const EXTRA = ${JSON.stringify(EXTRA_WHEELS)};
const MAX_CHARS = ${PY_MAX_OUTPUT_CHARS}, MAX_IMAGES = ${PY_MAX_IMAGES};
const WORK = '/home/pyodide';
// 換行字元用代碼產生：這整段是放在字串裡的程式，直接寫跳脫字元會在組字串時先被換成真的換行，變成語法錯誤
const NL = String.fromCharCode(10);
const HELPERS = \`
import ast, os, sys, warnings
os.environ['MPLBACKEND'] = 'Agg'
# 圖裡的字型缺字時，每個字都會印一行警告，把真正的輸出淹掉：不顯示
warnings.filterwarnings('ignore', message='Glyph .* missing from')

def __corphia_run(source):
    ns = {'__name__': '__main__'}
    tree = ast.parse(source, '<程式>', 'exec')
    last = None
    if tree.body and isinstance(tree.body[-1], ast.Expr):
        last = ast.Expression(tree.body.pop().value)
    exec(compile(tree, '<程式>', 'exec'), ns)
    if last is None:
        return ''
    value = eval(compile(last, '<程式>', 'eval'), ns)
    if value is None:
        return ''
    if hasattr(value, 'to_string'):
        try:
            return value.to_string(max_rows=60, max_cols=20)
        except TypeError:
            return value.to_string()
    return repr(value)

def __corphia_figures(limit):
    if 'matplotlib.pyplot' not in sys.modules:
        return []
    import base64, io
    import matplotlib.pyplot as plt
    out = []
    for number in plt.get_fignums()[:limit]:
        buffer = io.BytesIO()
        plt.figure(number).savefig(buffer, format='png', dpi=110, bbox_inches='tight')
        out.append(base64.b64encode(buffer.getvalue()).decode('ascii'))
    plt.close('all')
    return out
\`;
let py = null;
const quiet = () => {};
async function boot() {
  const { loadPyodide } = await import(ASSETS + 'pyodide.mjs');
  py = await loadPyodide({ indexURL: ASSETS, stdout: quiet, stderr: quiet });
  for (const wheel of EXTRA) {
    const response = await fetch(ASSETS + wheel);
    if (!response.ok) throw new Error('缺少套件檔 ' + wheel);
    py.unpackArchive(await response.arrayBuffer(), 'wheel');
  }
  py.runPython(HELPERS);
}
function clearWorkDir() {
  for (const name of py.FS.readdir(WORK)) {
    if (name === '.' || name === '..') continue;
    try { py.FS.unlink(WORK + '/' + name); } catch (e) { /* 資料夾留著 */ }
  }
}
async function run(code, files) {
  let text = '';
  const push = (line) => { if (text.length < MAX_CHARS) text += line + NL; };
  clearWorkDir();
  for (const file of files) py.FS.writeFile(WORK + '/' + file.name, new Uint8Array(file.data));
  py.FS.chdir(WORK);
  let value = '', error = '', images = [];
  try {
    // 載入套件時的進度訊息不算程式的輸出：先載完，再開始收集印出來的字
    await py.loadPackagesFromImports(code, { messageCallback: quiet, errorCallback: quiet });
    py.setStdout({ batched: push });
    py.setStderr({ batched: push });
    value = String(py.globals.get('__corphia_run')(code) || '');
  } catch (e) {
    // 只留最後幾行：前面是執行環境自己的呼叫過程，對使用者沒有用
    error = String(e && e.message || e).trim().split(NL).slice(-6).join(NL);
  }
  try {
    const figures = py.globals.get('__corphia_figures')(MAX_IMAGES);
    images = figures.toJs().map((b64) => 'data:image/png;base64,' + b64);
    figures.destroy();
  } catch (e) { /* 圖畫不出來不影響文字結果 */ }
  py.setStdout({ batched: quiet });
  py.setStderr({ batched: quiet });
  return { stdout: text.slice(0, MAX_CHARS), value: value.slice(0, MAX_CHARS), images, error };
}
self.addEventListener('message', async (event) => {
  const message = event.data || {};
  if (message.type !== 'run') return;
  try {
    self.postMessage({ type: 'result', id: message.id, ...(await run(message.code, message.files || [])) });
  } catch (e) {
    self.postMessage({ type: 'result', id: message.id, stdout: '', value: '', images: [], error: String(e && e.message || e) });
  }
});
boot().then(
  () => self.postMessage({ type: 'ready' }),
  (e) => self.postMessage({ type: 'boot-error', error: String(e && e.message || e) }),
);
`
}

/** 沙盒框裡的頁面（純文字，放進 srcdoc）：開一條背景執行緒跑 Python，自己只負責在外面和執行緒之間轉送訊息 */
export function runnerDocument(origin: string): string {
    const worker = workerSource(`${origin}/pyodide/`)
    return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${runnerCsp(origin)}"><meta charset="utf-8">
<script>
const source = ${JSON.stringify(worker)};
let worker;
try {
  // 一般型的背景執行緒（不是模組型）：沒有來源身分的沙盒框裡，模組型的開不起來（實測）；一般型可以，
  // 而且照樣能用 import() 載入 Python 本體
  worker = new Worker(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));
  worker.onmessage = (event) => parent.postMessage(event.data, '*');
  worker.onerror = (event) => parent.postMessage({ type: 'boot-error', error: String(event.message || 'worker') }, '*');
  addEventListener('message', (event) => { if (event.source === parent) worker.postMessage(event.data); });
} catch (e) {
  parent.postMessage({ type: 'boot-error', error: String(e && e.message || e) }, '*');
}
</script>`
}

interface Runner {
    frame: HTMLIFrameElement
    ready: Promise<void>
}

let runner: Runner | null = null
let nextId = 1

function destroyRunner(): void {
    runner?.frame.remove()
    runner = null
}

function ensureRunner(): Runner {
    if (runner) return runner
    const frame = document.createElement('iframe')
    frame.setAttribute('sandbox', 'allow-scripts')
    frame.setAttribute('aria-hidden', 'true')
    frame.tabIndex = -1
    frame.style.display = 'none'
    frame.srcdoc = runnerDocument(window.location.origin)
    const ready = new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => { cleanup(); reject(new Error('timeout')) }, PY_LOAD_TIMEOUT_MS)
        const onMessage = (event: MessageEvent) => {
            if (event.source !== frame.contentWindow) return
            if (event.data?.type === 'ready') { cleanup(); resolve() }
            if (event.data?.type === 'boot-error') { cleanup(); reject(new Error(String(event.data.error || 'boot'))) }
        }
        const cleanup = () => { window.clearTimeout(timer); window.removeEventListener('message', onMessage) }
        window.addEventListener('message', onMessage)
    })
    document.body.appendChild(frame)
    runner = { frame, ready }
    // 載入失敗：把框拿掉，下次再按會重新載入
    ready.catch(() => { if (runner?.frame === frame) destroyRunner() })
    return runner
}

/** 檔名只留最後一段、去掉路徑符號（程式用這個名字讀檔） */
export function safeFileName(name: string): string {
    return (name.split(/[\\/]/).pop() || 'file').replace(/[^\w.\-一-鿿 ()]/g, '_').slice(0, 120) || 'file'
}

/**
 * 執行一段 Python。第一次會載入 Python 本體（幾秒到十幾秒），之後同一頁再執行就很快。
 * 載入失敗會丟出錯誤（訊息 'timeout' 或失敗原因）；程式自己出錯不丟錯，回傳的 error 有錯誤訊息。
 */
export async function runPython(code: string, files: PyRunFile[] = []): Promise<PyRunResult> {
    const current = ensureRunner()
    await current.ready
    const id = nextId++
    const started = performance.now()
    const seconds = () => Math.round((performance.now() - started) / 100) / 10
    return new Promise<PyRunResult>((resolve) => {
        const finish = (result: Omit<PyRunResult, 'seconds' | 'ok'>) => {
            window.clearTimeout(timer)
            window.removeEventListener('message', onMessage)
            resolve({ ...result, ok: !result.error && !result.timedOut, seconds: seconds() })
        }
        const timer = window.setTimeout(() => {
            destroyRunner() // 沒有辦法從外面叫停，只能整個丟掉；下次執行會重新載入
            finish({ stdout: '', value: '', images: [], error: '', timedOut: true })
        }, PY_RUN_TIMEOUT_MS)
        const onMessage = (event: MessageEvent) => {
            if (event.source !== current.frame.contentWindow || event.data?.type !== 'result' || event.data.id !== id) return
            const data = event.data
            finish({
                stdout: String(data.stdout ?? ''), value: String(data.value ?? ''), error: String(data.error ?? ''),
                images: Array.isArray(data.images) ? data.images.filter((u: unknown): u is string => typeof u === 'string' && u.startsWith('data:image/png;base64,')).slice(0, PY_MAX_IMAGES) : [],
                timedOut: false,
            })
        }
        window.addEventListener('message', onMessage)
        current.frame.contentWindow?.postMessage(
            { type: 'run', id, code, files: files.map((f) => ({ name: safeFileName(f.name), data: f.data })) }, '*',
        )
    })
}

/** 這段程式碼可不可以執行（只支援 Python） */
export function isRunnable(language: string): boolean {
    return ['python', 'py', 'python3'].includes(language.trim().toLowerCase())
}
