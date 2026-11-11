// HashRouter: as rotas ficam depois do "#", então o GitHub Pages
// sempre entrega o index.html e não dá 404 ao recarregar a sala.

import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";

// A sala (com o LiveKit, a parte mais pesada) só carrega quando alguém entra numa
const Room = lazy(() => import("./pages/Room"));

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<div className="page" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sala/:code" element={<Room />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
