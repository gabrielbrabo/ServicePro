import { useState } from "react";
import { passwordChecks } from "../lib/password";

// Campo de senha com botao mostrar/ocultar e (opcional) checklist das regras.
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = "new-password",
  showRules = false,
  required = true,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  showRules?: boolean;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const checks = passwordChecks(value);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink/70">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          maxLength={72}
          className="h-12 w-full rounded-xl border border-ink/15 bg-white px-4 pr-20 text-ink outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-2 my-auto h-8 rounded-lg px-2 text-xs font-semibold text-ink/50 transition hover:bg-sand hover:text-ink/80"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>

      {showRules && value && (
        <ul className="mt-2 space-y-1">
          {checks.map((c) => (
            <li
              key={c.label}
              className={`flex items-center gap-1.5 text-xs ${
                c.ok ? "text-teal-600" : "text-ink/45"
              }`}
            >
              <span aria-hidden="true">{c.ok ? "✓" : "•"}</span>
              {c.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
