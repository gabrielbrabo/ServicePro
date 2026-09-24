// Caixa de aceite dos Termos de Uso + Politica de Privacidade (LGPD).
// Os links abrem em nova aba para nao perder o que ja foi digitado no form.
export function TermsCheckbox({
  checked,
  onChange,
  id = "accept-terms",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 text-sm text-ink/70">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink/30 text-teal-500 focus:ring-teal-500"
      />
      <span>
        Li e aceito os{" "}
        <a
          href="/termos"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-teal-600 hover:underline"
        >
          Termos de Uso
        </a>{" "}
        e a{" "}
        <a
          href="/privacidade"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-teal-600 hover:underline"
        >
          Política de Privacidade
        </a>
        .
      </span>
    </label>
  );
}
