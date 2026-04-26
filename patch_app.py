fpath = r'd:\Antigravity\on-premise_CorphiaAI\frontend\src\App.tsx'
content = open(fpath, 'r', encoding='utf-8', errors='ignore').read()
content = content.replace("import { lazy, Suspense } from 'react'", "import { lazy, Suspense } from 'react'\nimport { ErrorBoundary } from './components/ErrorBoundary'")
content = content.replace("<Suspense fallback={<FallbackLoader />}>", "<ErrorBoundary>\n                <Suspense fallback={<FallbackLoader />}>")
content = content.replace("</Suspense>", "</Suspense>\n            </ErrorBoundary>")
open(fpath, 'w', encoding='utf-8').write(content)
print("Patched App.tsx!")
