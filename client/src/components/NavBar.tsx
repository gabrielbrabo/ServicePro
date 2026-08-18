import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEstablishments } from "../context/EstablishmentContext";
import { Logo } from "./Logo";
import { EmailVerifyBanner } from "./EmailVerifyBanner";
import { useNotifications } from "../context/NotificationContext";
import { NotificationBell } from "./NotificationBell";
import { Avatar } from "./Avatar";
import { useTheme } from "../lib/theme";

const links = [
  { to: "/buscar", label: "Buscar" },
  { to: "/agendamentos", label: "Agendamentos" },
  { to: "/painel", label: "Painel Pro" },
];

// Botao de troca de tema (sol/lua)
function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
      title={dark ? "Tema claro" : "Tema escuro"}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink/15 text-ink/70 transition hover:bg-sand ${className}`}
    >
      {dark ? (
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

// Dropdown para trocar de estabelecimento + criar novo (desktop, no topo).
function EstablishmentSwitcher() {
  const { establishments, selected, select, startCreating } =
    useEstablishments();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!selected) {
    return (
      <button
        onClick={startCreating}
        className="rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-600"
      >
        + Novo negócio
      </button>
    );
  }

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-w-0 items-center gap-1.5 rounded-lg bg-sand px-2.5 py-1.5 transition hover:bg-ink/5"
      >
        <span className="text-sm">{selected.category?.icon}</span>
        <span className="max-w-[120px] flex-1 truncate text-left text-sm font-medium text-ink/80 sm:max-w-[160px]">
          {selected.name}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-ink/40 transition ${open ? "rotate-180" : ""
            }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 max-h-96 w-64 max-w-[85vw] overflow-y-auto rounded-xl border border-ink/10 bg-white p-1 shadow-lg">
          {establishments.map((e) => {
            const active = selected._id === e._id;
            return (
              <button
                key={e._id}
                onClick={() => {
                  select(e);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${active
                  ? "bg-teal-50 text-teal-700"
                  : "text-ink/70 hover:bg-sand"
                  }`}
              >
                <span>{e.category?.icon}</span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {e.name}
                </span>
                {e.myRole === "professional" && (
                  <span className="shrink-0 rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] font-medium text-ink/50">
                    funcionário
                  </span>
                )}
                {active && (
                  <svg
                    className="h-4 w-4 shrink-0 text-teal-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
            );
          })}

          <div className="my-1 border-t border-ink/10" />
          <button
            onClick={() => {
              startCreating();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-teal-600 transition hover:bg-teal-50"
          >
            <span className="text-base leading-none">+</span>
            Novo negócio
          </button>
        </div>
      )}
    </div>
  );
}

// Versao do seletor para DENTRO do menu mobile: lista expandida, sem dropdown.
function MobileEstablishmentList({ onDone }: { onDone: () => void }) {
  const { establishments, selected, select, startCreating } =
    useEstablishments();

  if (!selected) {
    return (
      <button
        onClick={() => {
          startCreating();
          onDone();
        }}
        className="w-full rounded-lg bg-teal-500 px-3 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-teal-600"
      >
        + Novo negócio
      </button>
    );
  }

  return (
    <div>
      <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-ink/40">
        Seus estabelecimentos
      </p>
      <div className="flex flex-col gap-1">
        {establishments.map((e) => {
          const active = selected._id === e._id;
          return (
            <button
              key={e._id}
              onClick={() => {
                select(e);
                onDone();
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${active
                ? "bg-teal-50 text-teal-700"
                : "text-ink/70 hover:bg-sand"
                }`}
            >
              <span>{e.category?.icon}</span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {e.name}
              </span>
              {e.myRole === "professional" && (
                <span className="shrink-0 rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] font-medium text-ink/50">
                  funcionário
                </span>
              )}
              {active && (
                <svg
                  className="h-4 w-4 shrink-0 text-teal-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </button>
          );
        })}

        <button
          onClick={() => {
            startCreating();
            onDone();
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-teal-600 transition hover:bg-teal-50"
        >
          <span className="text-base leading-none">+</span>
          Novo negócio
        </button>
      </div>
    </div>
  );
}

export function NavBar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const onPanel = pathname.startsWith("/painel");

  const { badges } = useNotifications();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
        <Link to="/buscar" className="shrink-0">
          <Logo />
        </Link>

        {/* switcher no topo — SO no desktop */}
        {onPanel && (
          <div className="hidden min-w-0 sm:block sm:max-w-xs">
            <EstablishmentSwitcher />
          </div>
        )}

        {/* nav desktop */}
        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((l) => {
            const active = pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`relative rounded-lg px-3 py-2 text-sm font-medium transition ${active
                  ? "bg-teal-50 text-teal-600"
                  : "text-ink/70 hover:bg-sand"
                  }`}
              >
                {l.label}
                {l.to === "/agendamentos" && badges.clientPending > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {badges.clientPending > 9 ? "9+" : badges.clientPending}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <ThemeToggle />
          {user ? (
            <>
              <NotificationBell />
              <Link
                to="/perfil"
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-sand"
                title="Meu perfil"
              >
                <Avatar name={user.name} src={user.avatar} size={30} />
                <span className="text-sm font-medium text-ink/70">
                  {user.name?.split(" ")[0]}
                </span>
              </Link>
              <button
                onClick={logout}
                className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/80 transition hover:bg-sand"
              >
                Sair
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="rounded-lg bg-teal-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-600"
            >
              Entrar
            </Link>
          )}
        </div>

        {/* tema + sininho no mobile */}
        <ThemeToggle className="sm:hidden" />
        {user && (
          <div className="sm:hidden">
            <NotificationBell />
          </div>
        )}

        {/* hamburguer (mobile) */}

        {/* hamburguer (mobile) */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink/15 text-ink/70 transition hover:bg-sand sm:hidden"
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>

      {/* menu mobile expansivel */}
      {menuOpen && (
        <div className="border-t border-ink/10 bg-white px-4 py-3 sm:hidden">
          {/* seletor de negocio + novo negocio (so no painel) */}
          {onPanel && (
            <div className="mb-3 border-b border-ink/10 pb-3">
              <MobileEstablishmentList onDone={() => setMenuOpen(false)} />
            </div>
          )}

          <nav className="flex flex-col gap-1">
            {links.map((l) => {
              const active = pathname.startsWith(l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition ${active
                    ? "bg-teal-50 text-teal-600"
                    : "text-ink/70 hover:bg-sand"
                    }`}
                >
                  {l.label}
                  {l.to === "/agendamentos" && badges.clientPending > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                      {badges.clientPending}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 border-t border-ink/10 pt-3">
            {user ? (
              <div className="flex items-center justify-between">
                <Link
                  to="/perfil"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-w-0 items-center gap-2"
                >
                  <Avatar name={user.name} src={user.avatar} size={36} />
                  <span className="min-w-0 truncate text-sm font-medium text-ink/70">
                    {user.name}
                  </span>
                </Link>
                <button
                  onClick={logout}
                  className="shrink-0 rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/80 transition hover:bg-sand"
                >
                  Sair
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg bg-teal-500 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-teal-600"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sand">
      <NavBar />
      <EmailVerifyBanner />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}