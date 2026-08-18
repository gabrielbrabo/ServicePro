import { useEffect, useState } from "react";

// Tema claro/escuro. A classe "dark" no <html> e aplicada logo no index.html
// (antes do render). Este hook le/atualiza a escolha e persiste no localStorage.

const KEY = "servicepro:theme";
export type Theme = "light" | "dark";

function currentTheme(): Theme {
  if (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  ) {
    return "dark";
  }
  return "light";
}

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignora storage indisponivel */
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme());

  // sincroniza o estado com o que ja esta no <html> ao montar
  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };

  const setThemeValue = (t: Theme) => {
    applyTheme(t);
    setTheme(t);
  };

  return { theme, toggle, setTheme: setThemeValue };
}