// Núcleo do app em Rust.
//
// A voz e a tela usam o WebRTC do WebView2 (o mesmo motor do Chrome/Edge),
// que já faz codificação por hardware (NVENC/QuickSync/AMF). O Rust cuida
// da janela e do sistema, mantendo o app leve (sem levar um Chrome junto).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Telinha");
}
