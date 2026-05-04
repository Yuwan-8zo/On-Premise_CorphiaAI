import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import './i18n'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        {/*
          v7 future flags — 提早 opt-in 到 v7 行為，順便消掉 console 那兩條警告。
          startTransition  : 路由切換用 React.startTransition 包，避免阻塞渲染
          relativeSplatPath: splat 路由內 relative 路徑解析改為新行為
        */}
        <BrowserRouter
            future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
            }}
        >
            <App />
        </BrowserRouter>
    </StrictMode>,
)
