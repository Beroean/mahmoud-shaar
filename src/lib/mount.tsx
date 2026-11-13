import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/base.css";

/** Mounts a page component into #root. Every HTML entry calls this once. */
export function mount(page: ReactNode) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>{page}</StrictMode>,
  );
}
