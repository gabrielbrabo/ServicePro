import { useEffect, useRef, useState } from "react";
import { Booking, scheduleApi, PayPayload } from "../api/schedule";
import { formatPrice } from "../lib/time";

// Modal de pagamento do cliente pelo app. Serve para o SINAL (mode="deposit")
// e para o SERVIÇO concluido (mode="service"). Suporta PIX (link/QR + poll) e
// cartao (cobra na hora). O valor vai direto para o estabelecimento (split).
export function PayDepositModal({
  booking,
  mode = "deposit",
  onClose,
  onPaid,
}: {
  booking: Booking;
  mode?: "deposit" | "service";
  onClose: () => void;
  onPaid: (updated: Booking) => void;
}) {
  const isService = mode === "service";

  // valor a pagar: sinal, ou saldo do serviço (total - sinal ja pago)
  const depositValue = booking.payment?.depositRequired ?? 0;
  const paidDeposit = booking.payment?.depositPaid ? depositValue : 0;
  const amount = isService
    ? (booking.payment?.amount ?? 0) - paidDeposit
    : depositValue;

  const [method, setMethod] = useState<"pix" | "cartao">("pix");
  const [cpf, setCpf] = useState("");
  // cartao
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
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pixImage, setPixImage] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

  const markPaid = () => {
    setWaiting(false);
    setPaid(true);
    onPaid(
      isService
        ? { ...booking, payment: { ...booking.payment, status: "pago" } }
        : { ...booking, payment: { ...booking.payment, depositPaid: true } }
    );
    // fecha sozinho apos mostrar a confirmacao rapidamente
    setTimeout(() => onClose(), 1600);
  };

  // consulta imediata (botao "Ja paguei"): confirma direto no gateway
  const checkNow = async () => {
    setChecking(true);
    try {
      const st = isService
        ? await scheduleApi.serviceStatus(booking._id)
        : await scheduleApi.depositStatus(booking._id);
      const ok = isService
        ? (st as { paid: boolean }).paid
        : (st as { depositPaid: boolean }).depositPaid;
      if (ok) {
        stopPoll();
        markPaid();
      }
    } catch {
      // ignora; o poll continua tentando
    } finally {
      setChecking(false);
    }
  };

  const startPoll = () => {
    pollRef.current = setInterval(async () => {
      try {
        const st = isService
          ? await scheduleApi.serviceStatus(booking._id)
          : await scheduleApi.depositStatus(booking._id);
        const ok = isService
          ? (st as { paid: boolean }).paid
          : (st as { depositPaid: boolean }).depositPaid;
        if (ok) {
          stopPoll();
          markPaid();
        }
      } catch {
        // ignora falha pontual; continua tentando
      }
    }, 4000);
  };

  const gerar = async () => {
    setError(null);
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) {
      setError("Informe um CPF válido.");
      return;
    }

    const payload: PayPayload = { cpf: cpfDigits, method };
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
      payload.holder = {
        postalCode: cep.replace(/\D/g, ""),
        addressNumber: addrNumber.trim(),
        phone: phone.replace(/\D/g, ""),
      };
    }

    setLoading(true);
    try {
      const res = isService
        ? await scheduleApi.payService(booking._id, payload)
        : await scheduleApi.payDeposit(booking._id, payload);

      if (res.paid || res.alreadyPaid) {
        markPaid();
        return;
      }
      setCheckoutUrl(res.checkoutUrl || null);
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

  const title = isService ? "Pagar serviço" : "Pagar sinal";
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
            <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
            <p className="mt-0.5 text-sm text-ink/60">{booking.service?.title}</p>
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
              {isService ? "Valor a pagar" : "Valor do sinal"}
            </p>
            <p className="mt-0.5 font-display text-2xl font-bold text-teal-600">
              {formatPrice(amount)}
            </p>
            {isService && paidDeposit > 0 && (
              <p className="mt-0.5 text-xs text-ink/50">
                Sinal de {formatPrice(paidDeposit)} já pago descontado.
              </p>
            )}
          </div>

          {paid ? (
            <div className="rounded-xl bg-teal-50 px-4 py-4 text-center">
              <p className="font-display text-base font-bold text-teal-700">
                Pagamento confirmado!
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

              {/* QR Code do PIX (escaneie no app do banco) */}
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

              {/* PIX copia e cola */}
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

              {/* fallback: sem QR, abre a fatura do Asaas */}
              {!pixImage && !pixCode && checkoutUrl && (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg bg-teal-500 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-teal-600"
                >
                  Abrir a cobrança
                </a>
              )}
              <button
                onClick={checkNow}
                disabled={checking}
                className="w-full rounded-lg border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink/70 transition hover:bg-sand disabled:opacity-60"
              >
                {checking ? "Verificando…" : "Já paguei"}
              </button>
              <p className="text-center text-xs text-ink/50">
                Assim que o pagamento cair, é confirmado automaticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* forma de pagamento */}
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
                          setCcMonth(e.target.value.replace(/\D/g, "").slice(0, 2))
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
                          setCcYear(e.target.value.replace(/\D/g, "").slice(0, 4))
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
                onClick={gerar}
                disabled={loading}
                className="w-full rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
              >
                {loading
                  ? "Processando…"
                  : method === "cartao"
                    ? `Pagar ${formatPrice(amount)} no cartão`
                    : "Gerar PIX"}
              </button>
              <p className="text-center text-xs text-ink/50">
                O valor vai direto para o estabelecimento.
              </p>
              <button
                onClick={onClose}
                disabled={loading}
                className="w-full rounded-lg border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink/70 transition hover:bg-sand disabled:opacity-60"
              >
                Vou pagar fora do app
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
