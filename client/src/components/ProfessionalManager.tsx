import { useEffect, useMemo, useState, useCallback } from "react";
import { professionalApi, Professional } from "../api/professional";
import { catalogApi, Service } from "../api/catalog";
import { inviteApi } from "../api/invite";
import { ImageUpload } from "./ImageUpload";
import { computeProsWithoutService } from "../lib/coverage";

export function ProfessionalManager({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [pros, setPros] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // servicos do estabelecimento — usados so para saber quem esta sem servico
  const [services, setServices] = useState<Service[]>([]);

  // profissionais ativos que nao estao em nenhum servico (aviso)
  const prosNoService = useMemo(
    () => computeProsWithoutService(services, pros),
    [services, pros]
  );

  // formulario de novo profissional
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState("");
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // modal de convite
  const [inviting, setInviting] = useState<Professional | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    // all=true: o dono ve ativos e inativos
    professionalApi
      .list(establishmentId, true)
      .then(setPros)
      .catch(() => setError("Não foi possível carregar os profissionais."))
      .finally(() => setLoading(false));
  }, [establishmentId]);

  useEffect(load, [load]);

  // carrega os servicos (para detectar profissional sem servico)
  useEffect(() => {
    catalogApi
      .byEstablishment(establishmentId)
      .then(setServices)
      .catch(() => setServices([]));
  }, [establishmentId]);

  const addSpecialty = () => {
    const v = specialtyInput.trim();
    if (!v) return;
    if (!specialties.includes(v)) setSpecialties((s) => [...s, v]);
    setSpecialtyInput("");
  };

  const removeSpecialty = (v: string) =>
    setSpecialties((s) => s.filter((x) => x !== v));

  const resetForm = () => {
    setName("");
    setPhoto("");
    setSpecialtyInput("");
    setSpecialties([]);
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("Informe o nome do profissional.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await professionalApi.add(establishmentId, {
        name: name.trim(),
        photo: photo.trim() || undefined,
        specialties,
      });
      setPros((p) => [...p, created]);
      resetForm();
    } catch {
      setError("Não foi possível adicionar o profissional.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (prof: Professional) => {
    // otimista
    const prev = pros;
    setPros((p) =>
      p.map((x) => (x._id === prof._id ? { ...x, active: !x.active } : x))
    );
    try {
      await professionalApi.update(establishmentId, prof._id, {
        active: !prof.active,
      });
    } catch {
      setPros(prev);
      setError("Não foi possível atualizar o profissional.");
    }
  };

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <h2 className="font-display text-lg font-bold text-ink">Profissionais</h2>
      <p className="mt-1 text-sm text-ink/60">
        Cadastre quem atende no seu estabelecimento. Cada profissional terá a
        própria agenda, e o cliente poderá escolher com quem quer agendar.
      </p>

      {/* Formulário */}
      <div className="mt-5 space-y-4 rounded-xl bg-sand/40 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Nome
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Foto (opcional)
            </label>
            <div>
              <ImageUpload
                value={photo}
                onChange={setPhoto}
                folder="profissionais"
                label="Foto (opcional)"
                hint="JPG, PNG ou WEBP, até 5 MB."
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">
            Especialidades
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={specialtyInput}
              onChange={(e) => setSpecialtyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSpecialty();
                }
              }}
              placeholder="Ex: Corte masculino"
              className="flex-1 rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
            <button
              type="button"
              onClick={addSpecialty}
              className="rounded-xl bg-teal-500/10 px-4 text-sm font-semibold text-teal-600 transition hover:bg-teal-500/20"
            >
              Adicionar
            </button>
          </div>
          {specialties.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {specialties.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-700"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSpecialty(s)}
                    className="text-teal-700/60 hover:text-teal-700"
                    aria-label={`Remover ${s}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm font-medium text-red-500">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
        >
          {saving ? "Adicionando..." : "Adicionar profissional"}
        </button>
      </div>

      {/* Lista */}
      <div className="mt-5">
        {loading ? (
          <p className="text-ink/50">Carregando...</p>
        ) : pros.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/50">
            Nenhum profissional cadastrado ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {pros.map((p) => (
              <div
                key={p._id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
                  p.active
                    ? "border-ink/10 bg-white"
                    : "border-ink/10 bg-sand/40 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  {p.photo ? (
                    <img
                      src={p.photo}
                      alt={p.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/10 text-sm font-bold text-teal-600">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-ink">
                      {p.name}
                      {!p.active && (
                        <span className="ml-2 text-xs font-normal text-ink/40">
                          (inativo)
                        </span>
                      )}
                    </p>
                    {p.specialties.length > 0 && (
                      <p className="text-xs text-ink/50">
                        {p.specialties.join(" · ")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* estado de acesso */}
                  {p.linkedUser ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-700">
                      ✓ Com acesso
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setInviting(p)}
                      className="rounded-lg border border-teal-500/40 px-3 py-1.5 text-sm font-medium text-teal-600 transition hover:bg-teal-500/10"
                    >
                      Convidar
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleActive(p)}
                    className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:bg-sand"
                  >
                    {p.active ? "Desativar" : "Reativar"}
                  </button>
                </div>

                {/* aviso: profissional ativo sem nenhum servico */}
                {p.active && prosNoService.has(p._id) && (
                  <div className="flex w-full items-start gap-1.5 rounded-lg bg-amber-400/10 px-2.5 py-1.5 text-xs font-medium text-amber-700">
                    <span aria-hidden="true">⚠️</span>
                    <span>
                      Este profissional não está registrado em nenhum serviço e
                      não receberá agendamentos. Inclua-o em algum serviço (aba
                      Serviços).
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {inviting && (
        <InviteModal
          establishmentId={establishmentId}
          professional={inviting}
          onClose={() => setInviting(null)}
        />
      )}
    </div>
  );
}

// ---- Modal de convite ----
function InviteModal({
  establishmentId,
  professional,
  onClose,
}: {
  establishmentId: string;
  professional: Professional;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    inviteUrl: string;
    emailSent: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const send = async () => {
    if (!email.trim()) {
      setError("Informe o e-mail do funcionário.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await inviteApi.create(
        establishmentId,
        professional._id,
        email.trim()
      );
      setResult({ inviteUrl: res.inviteUrl, emailSent: res.emailSent });
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Não foi possível enviar o convite.";
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const copyLink = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={() => !sending && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-bold text-ink">
          Convidar {professional.name}
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          O funcionário recebe um link para criar a senha e acessar a própria
          agenda.
        </p>

        {!result ? (
          <>
            <label className="mt-4 mb-1.5 block text-sm font-medium text-ink">
              E-mail do funcionário
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="funcionario@email.com"
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
              onKeyDown={(e) => e.key === "Enter" && send()}
            />

            {error && (
              <p className="mt-2 text-sm font-medium text-red-500">{error}</p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={send}
                disabled={sending}
                className="h-11 flex-1 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
              >
                {sending ? "Enviando..." : "Enviar convite"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="h-11 rounded-xl border border-ink/15 px-5 font-medium text-ink/70 transition hover:bg-sand disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 rounded-xl bg-teal-500/10 px-4 py-3 text-sm font-medium text-teal-700">
              {result.emailSent
                ? "Convite enviado por e-mail. Você também pode enviar o link abaixo."
                : "Convite criado. Copie o link e envie ao funcionário (WhatsApp, etc)."}
            </div>

            <label className="mt-4 mb-1.5 block text-sm font-medium text-ink">
              Link do convite
            </label>
            <div className="flex gap-2">
              <input
                readOnly
                value={result.inviteUrl}
                className="flex-1 rounded-xl border border-ink/15 bg-sand/40 px-3 py-2 text-xs text-ink/70 outline-none"
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                onClick={copyLink}
                className="rounded-xl bg-amber-400 px-4 text-sm font-semibold text-ink transition hover:bg-amber-500"
              >
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-5 h-11 w-full rounded-xl border border-ink/15 px-5 font-medium text-ink/70 transition hover:bg-sand"
            >
              Concluir
            </button>
          </>
        )}
      </div>
    </div>
  );
}