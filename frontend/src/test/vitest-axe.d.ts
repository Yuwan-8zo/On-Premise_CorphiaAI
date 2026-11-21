/** vitest-axe 的型別是寫給舊版 Vitest（Vi 命名空間）的：在新版的 'vitest' 模組補上同一個比對方法 */
import 'vitest'

declare module 'vitest' {
    interface Assertion<T = unknown> {
        /** axe 無障礙檢查沒有違規 */
        toHaveNoViolations(): T
    }
    interface AsymmetricMatchersContaining {
        toHaveNoViolations(): void
    }
}
