// Esconde a janela de console no Windows (só no build de release)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    telinha_lib::run()
}
