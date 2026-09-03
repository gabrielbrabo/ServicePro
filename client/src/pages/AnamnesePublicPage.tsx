import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { anamneseApi, AnamneseForm } from "../api/anamnese";
import { Logo } from "../components/Logo";

// Pagina PUBLICA: o paciente abre por link e preenche a anamnese antes da
// consulta. Sem login.
export function AnamnesePublicPage() {
  const { establishmentId } = useParams();
  const [form, setForm] = useState<AnamneseForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!establishmentId) return;
    anamneseApi
      .publicForm(establishmentId)
      .then((f) => {
        setForm(f);
        setAnswers(f.questions.map(() => ""));
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [establishmentId]);

  const submit = async () => {
    if (!name.trim()) {
      setError("Informe seu nome.");
      return;
    }
    if (!establishmentId || !form) return;
    setSending(true);
    setError("");
    try {
      await anamneseApi.submit(establishmentId, {
        patientName: name.trim(),
        patientPhone: phone.trim(),
        answers: form.questions.map((q, i) => ({
          question: q,
          answer: (answers[i] || "").trim(),
        })),
      });
      setDone(true);
    } catch {
      setError("Não foi possível enviar. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-sand text-ink/50">
        Carregando...
      </div>
    );
  if (notFound || !form)
    return (
      <div className="grid min-h-screen place-items-center bg-sand p-6 text-center text-ink/60">
        Link inválido ou estabelecimento não encontrado.
      </div>
    );

  return (
    <div className="min-h-screen bg-sand py-10">
      <div className="mx-auto w-full max-w-lg px-4">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        {done ? (
          <div className="rounded-2xl border border-ink/10 bg-white p-8 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-teal-500 text-2xl text-white">
              ✓
            </div>
            <h1 className="font-display text-xl font-bold text-ink">
              Anamnese enviada!
            </h1>
            <p className="mt-2 text-ink/60">
              Obrigado, {name}. {form.establishmentName} recebeu suas respostas.
            </p>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-ink/10 bg-white p-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-ink">
                Anamnese — {form.establishmentName}
              </h1>
              <p className="mt-1 text-sm text-ink/60">
                Preencha antes da sua consulta. Leva poucos minutos.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Seu nome
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 outline-none focus:border-teal-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Telefone (opcional)
                </span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(38) 99999-0000"
                  className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 outline-none focus:border-teal-500"
                />
              </label>
            </div>
            {form.questions.map((q, i) => (
              <label key={i} className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  {q}
                </span>
                <textarea
                  value={answers[i] || ""}
                  onChange={(e) =>
                    setAnswers((a) =>
                      a.map((x, idx) => (idx === i ? e.target.value : x))
                    )
                  }
                  rows={2}
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 outline-none focus:border-teal-500"
                />
              </label>
            ))}
            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
            <button
              onClick={submit}
              disabled={sending}
              className="h-11 w-full rounded-xl bg-teal-500 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {sending ? "Enviando..." : "Enviar anamnese"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
