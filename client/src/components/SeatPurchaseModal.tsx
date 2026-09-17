import { useEffect, useRef, useState } from "react";
import {
  subscriptionApi,
  SeatStatus,
  BuySeatPayload,
} from "../api/subscription";
import { formatPrice } from "../lib/time";

// Modal de compra de ASSENTO de funcionario (o dono paga para poder cadastrar
// alem dos 5 incluidos). Cobra na conta da plataforma (receita da empresa),
// sem split. Suporta PIX (QR + poll) e cartao (cobra na hora).
export function SeatPurchaseModal({
  establishmentId,
  seat,
  onClose,
  onPurchased,
}: {
  establishmentId: string;
  seat: SeatStatus;
  onClose: () => void;
  onPurchased: () => void;
}) {
  const cycleLabel = seat.billingCycle === "anual" ? "ano" : "mês";
  const chargeNow = seat.nextSeatChargeNowCents;
  // valores vem em CENTAVOS; formatPrice espera REAIS -> divide por 100
  const brl = (cents: number) => formatPrice(cents / 100);

  const [method, setMethod] = useState<"pix" | "cartao">("pix");
  const [cpf, setCpf] = useState("");
  const [ccName, setCcName] = useState("");
  const [ccNumber, setCcNumber] = useState("");
  const [ccMonth, setCcMonth] = useState("");
  const [ccYear, setCcYear] = useState("");
  const [ccv, setCcv] = useState("");
  const [cep, setCep] = useState("");
  const [addrNumber, setAddrNumber] = useState("");
  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [granted, setGranted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pixImage, setPixImage] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const startExtra = useRef(seat.extraSeats);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maskCpf = (v: string) =>
    v
      .replace(/\D/g, "")
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  useEffect(() => stopPoll, []);

  const markGranted = () => {
    setWaiting(false);
    setGranted(true);
    onPurchased();
    setTimeout(() => onClose(), 1600);
  };

  // consulta a situacao dos assentos; concede quando o extra aumentar
  const checkNow = async () => {
    setChecking(true);
    try {
      const st = await subscriptionApi.seats(establishmentId);
      if (st.extraSeats > startExtra.current) {
        stopPoll();
        markGranted();
      }
    } catch {
      // ignora; o poll continua
    } finally {
      setChecking(false);
    }
  };

  const startPoll = () => {
    pollRef.current = setInterval(async () => {
      try {
        const st = await subscriptionApi.seats(establishmentId);
        if (st.extraSeats > startExtra.current) {
          stopPoll();
          markGranted();
        }
      } catch {
        // ignora falha pontual
      }
    }, 4000);
  };

  const comprar = async () => {
    setError(null);
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) {
      setError("Informe um CPF válido.");
      return;
    }

    const payload: BuySeatPayload = { method, cpfCnpj: cpfDigits };
    if (method === "cartao") {
      if (ccNumber.replace(/\D/g, "").length < 13) {
        setError("Número do cartão inválido.");
        return;
      }
      if (!ccMonth || !ccYear || !ccv) {
        setError("Preencha validade e CVV do cartão.");
        return;
      }
      if (!ccName.trim()) {
        setError("Informe o nome impresso no cartão.");
        return;
      }
      if (cep.replace(/\D/g, "").length < 8 || !addrNumber.trim()) {
        setError("Informe CEP e número do endereço do titular.");
        return;
      }
      if (phone.replace(/\D/g, "").length < 10) {
        setError("Informe o telefone do titular.");
        return;
      }
      payload.card = {
        holderName: ccName.trim(),
        number: ccNumber.replace(/\D/g, ""),
        expiryMonth: ccMonth.trim(),
        expiryYear: ccYear.trim(),
        ccv: ccv.trim(),
      };
      payload.holderInfo = {
        postalCode: cep.replace(/\D/g, ""),
        addressNumber: addrNumber.trim(),
        phone: phone.replace(/\D/g, ""),
      };
    }

    setLoading(true);
    try {
      const res = await subscriptionApi.buySeat(establishmentId, payload);
      if (res.granted) {
        markGranted();
        return;
      }
      setPixImage(res.pixQrImage || null);
      setPixCode(res.pixCopiaECola || null);
      setWaiting(true);
      startPoll();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      setError(msg || "Não foi possível gerar o pagamento.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm outline-none focus:border-teal-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 p-5">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">
              Adicionar assento de funcionário
            </h2>
            <p className="mt-0.5 text-sm text-ink/60">
              Seu plano inclui {seat.includedSeats} funcionários. Cada assento
              extra amplia o limite da equipe.
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-ink/50 transition hover:bg-sand"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="rounded-xl bg-sand/50 px-4 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
              Cobrado agora
            </p>
            <p className="mt-0.5 font-display text-2xl font-bold text-teal-600">
              {brl(chargeNow)}
            </p>
            <p className="mt-0.5 text-xs text-ink/50">
              Depois, {brl(seat.nextSeatPriceCents)}/{cycleLabel} junto da sua
              assinatura.
            </p>
          </div>

          {granted ? (
            <div className="rounded-xl bg-teal-50 px-4 py-4 text-center">
              <p className="font-display text-base font-bold text-teal-700">
                Assento liberado!
              </p>
              <p className="mt-1 text-sm text-teal-700/80">
                Agora você já pode cadastrar o funcionário.
              </p>
              <button
                onClick={onClose}
                className="mt-3 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
              >
                Fechar
              </button>
            </div>
          ) : waiting ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                Aguardando a confirmação do PIX…
              </div>

              {pixImage && (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={pixImage}
                    alt="QR Code PIX"
                    className="h-56 w-56 rounded-lg border border-ink/10 bg-white p-2"
                  />
                  <p className="text-xs text-ink/50">
                    Escaneie o QR no app do seu banco
                  </p>
                </div>
              )}

              {pixCode && (
                <div className="space-y-2">
                  <p className="break-all rounded-lg bg-sand/60 px-3 py-2 text-xs text-ink/70">
                    {pixCode}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(pixCode)
                        .then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        })
                        .catch(() => {});
                    }}
                    className="w-full rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600"
                  >
                    {copied ? "Código copiado!" : "Copiar código PIX"}
                  </button>
                </div>
              )}

              <button
                onClick={checkNow}
                disabled={checking}
                className="w-full rounded-lg border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink/70 transition hover:bg-sand disabled:opacity-60"
              >
                {checking ? "Verificando…" : "Já paguei"}
              </button>
              <p className="text-center text-xs text-ink/50">
                Assim que o pagamento cair, o assento é liberado
                automaticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(["pix", "cartao"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                      method === m
                        ? "border-teal-500 bg-teal-500 text-white"
                        : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                    }`}
                  >
                    {m === "pix" ? "PIX" : "Cartão"}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-sm font-medium text-ink/70">
                  Seu CPF
                </label>
                <input
                  value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  className={`mt-1 ${inputCls}`}
                />
              </div>

              {method === "cartao" && (
                <div className="space-y-3 rounded-xl bg-sand/40 p-3">
                  <div>
                    <label className="text-xs font-medium text-ink/60">
                      Nome no cartão
                    </label>
                    <input
                      value={ccName}
                      onChange={(e) => setCcName(e.target.value)}
                      className={`mt-1 ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink/60">
                      Número do cartão
                    </label>
                    <input
                      value={ccNumber}
                      onChange={(e) =>
                        setCcNumber(
                          e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 16)
                            .replace(/(\d{4})(?=\d)/g, "$1 ")
                        )
                      }
                      inputMode="numeric"
                      placeholder="0000 0000 0000 0000"
                      className={`mt-1 ${inputCls}`}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-medium text-ink/60">
                        Mês
                      </label>
                      <input
                        value={ccMonth}
                        onChange={(e) =>
                          setCcMonth(
                            e.target.value.replace(/\D/g, "").slice(0, 2)
                          )
                        }
                        inputMode="numeric"
                        placeholder="MM"
                        className={`mt-1 ${inputCls}`}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-ink/60">
                        Ano
                      </label>
                      <input
                        value={ccYear}
                        onChange={(e) =>
                          setCcYear(
                            e.target.value.replace(/\D/g, "").slice(0, 4)
                          )
                        }
                        inputMode="numeric"
                        placeholder="AAAA"
                        className={`mt-1 ${inputCls}`}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-ink/60">
                        CVV
                      </label>
                      <input
                        value={ccv}
                        onChange={(e) =>
                          setCcv(e.target.value.replace(/\D/g, "").slice(0, 4))
                        }
                        inputMode="numeric"
                        placeholder="123"
                        className={`mt-1 ${inputCls}`}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-ink/60">
                        CEP
                      </label>
                      <input
                        value={cep}
                        onChange={(e) =>
                          setCep(e.target.value.replace(/\D/g, "").slice(0, 8))
                        }
                        inputMode="numeric"
                        placeholder="00000000"
                        className={`mt-1 ${inputCls}`}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-ink/60">
                        Nº endereço
                      </label>
                      <input
                        value={addrNumber}
                        onChange={(e) => setAddrNumber(e.target.value)}
                        className={`mt-1 ${inputCls}`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink/60">
                      Telefone do titular
                    </label>
                    <input
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))
                      }
                      inputMode="numeric"
                      placeholder="DDD + número"
                      className={`mt-1 ${inputCls}`}
                    />
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}

              <button
                onClick={comprar}
                disabled={loading}
                className="w-full rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
              >
                {loading
                  ? "Processando…"
                  : method === "cartao"
                    ? `Pagar ${brl(chargeNow)} no cartão`
                    : "Gerar PIX"}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="w-full rounded-lg border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink/70 transition hover:bg-sand disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
