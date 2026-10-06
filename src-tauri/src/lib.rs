use std::path::PathBuf;

use tauri::Manager;
use tauri_plugin_fs::FsExt;

/// Grants the frontend file-system and asset-protocol access to the chosen data folder.
/// The folder is picked at runtime, so it cannot be listed statically in the capability files.
#[tauri::command]
fn allow_data_folder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let dir = PathBuf::from(&path);
    app.fs_scope()
        .allow_directory(&dir, true)
        .map_err(|e| e.to_string())?;
    app.asset_protocol_scope()
        .allow_directory(&dir, true)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![allow_data_folder])
        .setup(|app| {
            // Ensure the config dir (where the store lives) exists.
            if let Ok(dir) = app.path().app_config_dir() {
                let _ = std::fs::create_dir_all(dir);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
