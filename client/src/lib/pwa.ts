import { useEffect, useState } from "react";

// Instalacao do app (PWA).
// O navegador dispara "beforeinstallprompt" UMA vez, logo no carregamento da
// pagina (muitas vezes antes da tela /app existir). Por isso o evento e
// capturado aqui no nivel do modulo (importado no main.tsx) e guardado, para
// o botao "Instalar app" poder usar a qualquer momento.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // impede o mini-aviso automatico de "sumir" o evento: guardamos para o botao
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    notify();
  });
}

// ja esta rodando como app instalado (aberto pelo icone da tela inicial)?
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari do iPhone
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// iPhone/iPad: nao existe instalacao por codigo, so pelo menu Compartilhar
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS se identifica como Mac
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return isIOS() || /Android|Mobile/i.test(navigator.userAgent);
}

export type InstallResult = "accepted" | "dismissed" | "unavailable";

export function usePwaInstall() {
  const [, force] = useState(0);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const install = async (): Promise<InstallResult> => {
    if (!deferred) return "unavailable";
    const ev = deferred;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    // o evento so pode ser usado uma vez
    deferred = null;
    notify();
    return outcome;
  };

  return {
    canInstall: !!deferred, // botao nativo disponivel (Android/Chrome/Edge)
    installed: installedNow || isStandalone(),
    ios: isIOS(),
    mobile: isMobile(),
    install,
  };
}
