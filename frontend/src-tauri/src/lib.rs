// Corphia AI — Tauri 主程序入口
// ============================================
//
// 主要負責：
//   1. 啟動 corphia-server.exe（FastAPI 後端）作為 sidecar
//   2. 視窗關閉時把 sidecar 一起殺掉，不留 zombie process
//   3. 提供 log 整合，讓 sidecar 的 stdout/stderr 跟 Tauri log 一起看
//
// Sidecar 啟動策略：
//   - 先嘗試 spawn `corphia-server`（透過 externalBin 機制）
//   - 失敗（通常是 dev 還沒 build sidecar）→ 印警告繼續跑，
//     使用者可以自己 `uvicorn app.main:app` 拉 backend
//   - bundle 模式下 sidecar binary 一定會在，spawn 失敗就是 fatal

use std::sync::Mutex;

use tauri::{Manager, WindowEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// 把 sidecar child handle 存進 Tauri state，
/// 視窗關閉時抓出來呼叫 `kill()`。
struct SidecarHandle(Mutex<Option<CommandChild>>);

/// 啟動 corphia-server sidecar。
/// 失敗（binary 不存在 / 權限問題）只 log 不 panic — 讓 dev 流程能繼續。
fn spawn_backend_sidecar(app: &tauri::AppHandle) {
    log::info!("[sidecar] 嘗試啟動 corphia-server backend...");

    let sidecar_command = match app
        .shell()
        .sidecar("corphia-server")
    {
        Ok(cmd) => cmd.args(["--host", "127.0.0.1", "--port", "8168"]),
        Err(e) => {
            log::warn!(
                "[sidecar] 找不到 corphia-server binary（dev 模式？）: {}\n\
                 → 你需要自己跑 `uvicorn app.main:app --port 8168`，\n\
                 或先到 backend/ 跑 `build_backend.ps1` 產生 sidecar exe。",
                e
            );
            return;
        }
    };

    let (mut rx, child) = match sidecar_command.spawn() {
        Ok(pair) => pair,
        Err(e) => {
            log::error!("[sidecar] spawn 失敗: {}", e);
            return;
        }
    };

    log::info!("[sidecar] backend 已啟動，pid={}", child.pid());

    // 把 child handle 存到全域 state，視窗關閉時抓出來 kill
    let state = app.state::<SidecarHandle>();
    *state.0.lock().unwrap() = Some(child);

    // 啟動一個 async task 持續讀 sidecar stdout/stderr → 轉成 Tauri log
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    log::info!("[backend] {}", line.trim_end());
                }
                CommandEvent::Stderr(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    log::warn!("[backend] {}", line.trim_end());
                }
                CommandEvent::Error(err) => {
                    log::error!("[backend] event error: {}", err);
                }
                CommandEvent::Terminated(payload) => {
                    log::warn!(
                        "[backend] sidecar terminated, code={:?}, signal={:?}",
                        payload.code,
                        payload.signal
                    );
                    break;
                }
                _ => {}
            }
        }
    });
}

/// 視窗關閉時殺掉 sidecar，避免 user 把 Tauri 關了但 backend 還在 8168 port 占著。
fn kill_backend_sidecar(app: &tauri::AppHandle) {
    let state = app.state::<SidecarHandle>();
    // 兩段式：先把 child take 出來，讓 MutexGuard 立即 drop，
    // 之後再呼叫 kill。這樣才能通過 borrow checker
    // （原本 `if let Some(child) = state.0.lock().unwrap().take()`
    //   會讓 MutexGuard 的生命週期延續到整個 if block 結束，
    //   超過 `state` 自己的生命週期，編譯不過）。
    let child_opt = state.0.lock().unwrap().take();
    if let Some(child) = child_opt {
        log::info!("[sidecar] 收到關閉信號，正在停止 backend...");
        if let Err(e) = child.kill() {
            log::error!("[sidecar] kill 失敗: {}", e);
        } else {
            log::info!("[sidecar] backend 已停止");
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // shell plugin 提供 sidecar / Command API
        .plugin(tauri_plugin_shell::init())
        // 全域狀態：sidecar child handle
        .manage(SidecarHandle(Mutex::new(None)))
        .setup(|app| {
            // dev 模式才掛 log plugin（release 用 println! 走 Windows event log）
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 啟動 backend sidecar
            spawn_backend_sidecar(app.handle());

            Ok(())
        })
        // 視窗事件：CloseRequested 時殺 sidecar
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                kill_backend_sidecar(window.app_handle());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
