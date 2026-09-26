import { useEffect, useState, FormEvent } from "react";
import { AxiosError } from "axios";
import { Button, Input, FieldError } from "./ui";
import { affiliateApi, ReceivingData } from "../api/affiliate";
import { lookupCep } from "../lib/cep";

// O Asaas recusou abrir a conta de recebimento do afiliado (ex.: "O CEP
// informado é inválido."): mostra o motivo e deixa corrigir os dados. Ao
// salvar, se já há indicado pagante, a conta é aberta na hora.
export function AffiliateReceivingFix({
  reason,
  onDone,
}: {
  reason: string;
  onDone: () => void;
}) {
  const [form, setForm] = useState<ReceivingData | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [cepHint, setCepHint] = useState("");

  useEffect(() => {
    affiliateApi
      .receivingData()
      .then(setForm)
      .catch(() => setError("Não foi possível carregar seus dados."));
  }, []);

  const set =
    (k: keyof ReceivingData) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  const onCepBlur = async () => {
    if (!form) return;
    setCepHint("");
    const r = await lookupCep(form.postalCode);
    if (r === null) setCepHint("CEP não encontrado. Confira os números.");
    else if (r)
      setForm((f) =>
        f
          ? {
              ...f,
              address: r.address || f.address,
              province: r.province || f.province,
            }
          : f
      );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError("");
    setSaving(true);
    try {
      const r = await affiliateApi.updateReceivingData(form);
      if (r.accountOpenError) {
        setError(`O Asaas ainda recusou: ${r.accountOpenError}`);
      } else {
        onDone();
      }
    } catch (err) {
      const ax = err as AxiosError<{ message: string }>;
      setError(ax.response?.data?.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-red-300/60 bg-red-50/60 p-5 sm:p-6">
      <span className="inline-block rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-700">
        Ação necessária
      </span>
      <h2 className="mt-2 font-display text-lg font-bold text-ink">
        Corrija seus dados de recebimento
      </h2>
      <p className="mt-1 text-sm text-ink/70">
        Não conseguimos abrir sua conta no Asaas:{" "}
        <strong className="text-red-700">{reason}</strong> Corrija abaixo e
        salve. Suas comissões ficam guardadas — nada se perde.
      </p>

      {!form ? (
        <p className="mt-4 text-sm text-ink/50">Carregando...</p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="fx-cpf" label="CPF ou CNPJ" value={form.cpfCnpj} onChange={set("cpfCnpj")} required />
            <Input id="fx-phone" label="Telefone (com DDD)" value={form.phone} onChange={set("phone")} required />
          </div>
          <Input id="fx-birth" label="Data de nascimento" type="date" value={form.birthDate} onChange={set("birthDate")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Input id="fx-cep" label="CEP" inputMode="numeric" value={form.postalCode} onChange={set("postalCode")} onBlur={onCepBlur} required />
              {cepHint && <p className="mt-1 text-xs text-red-600">{cepHint}</p>}
            </div>
            <Input id="fx-province" label="Bairro" value={form.province} onChange={set("province")} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Input id="fx-address" label="Endereço" value={form.address} onChange={set("address")} required />
            <Input id="fx-number" label="Número" value={form.addressNumber} onChange={set("addressNumber")} required />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" loading={saving}>
            Salvar e abrir minha conta
          </Button>
        </form>
      )}
    </section>
  );
}
