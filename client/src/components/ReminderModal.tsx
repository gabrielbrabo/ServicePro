// Modal de escolha da antecedencia do lembrete, aberto ao confirmar o
// agendamento (antes de criar). O cliente escolhe quando quer ser avisado;
// a escolha e repassada ao createBooking / createRecurring.

const OPTIONS: { value: number; label: string }[] = [
    { value: 15, label: "15 minutos antes" },
    { value: 30, label: "30 minutos antes" },
    { value: 45, label: "45 minutos antes" },
    { value: 60, label: "1 hora antes" },
    { value: 120, label: "2 horas antes" },
    { value: 180, label: "3 horas antes" },
  ];
  
  export function ReminderModal({
    value,
    onChange,
    onConfirm,
    onCancel,
    saving,
    confirmLabel = "Confirmar agendamento",
  }: {
    value: number;
    onChange: (v: number) => void;
    onConfirm: () => void;
    onCancel: () => void;
    saving: boolean;
    confirmLabel?: string;
  }) {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
        onClick={onCancel}
      >
        <div
          className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecalho */}
          <div className="flex items-center justify-between border-b border-ink/10 p-5">
            <div>
              <h2 className="text-lg font-semibold text-ink">
                Quer receber um lembrete?
              </h2>
              <p className="text-sm text-ink/50">
                Avisaremos por e-mail e no app antes do horário.
              </p>
            </div>
            <button
              onClick={onCancel}
              className="rounded-lg p-2 text-ink/50 transition hover:bg-sand"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
  
          {/* Opcoes */}
          <div className="space-y-2 p-5">
            {OPTIONS.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => onChange(opt.value)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                    active
                      ? "border-teal-500 bg-teal-500/10 text-teal-700"
                      : "border-ink/15 bg-white text-ink/80 hover:border-teal-500"
                  }`}
                >
                  {opt.label}
                  <span
                    className={`h-4 w-4 rounded-full border-2 transition ${
                      active ? "border-teal-500 bg-teal-500" : "border-ink/25"
                    }`}
                  />
                </button>
              );
            })}
          </div>
  
          {/* Rodape */}
          <div className="border-t border-ink/10 p-5">
            <button
              onClick={onConfirm}
              disabled={saving}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
            >
              {saving ? "Agendando..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }