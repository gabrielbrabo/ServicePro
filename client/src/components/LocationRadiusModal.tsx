import { useState } from "react";

export interface GeoCoords {
  lat: number;
  lng: number;
}

// raios pre-definidos (km)
const RADIUS_OPTIONS = [1, 2, 5, 10, 25, 50];

type GeoStatus = "idle" | "loading" | "ready" | "error";

export function LocationRadiusModal({
  initialRadiusKm,
  initialCoords,
  onClose,
  onApply,
}: {
  initialRadiusKm?: number | null;
  initialCoords?: GeoCoords | null;
  onClose: () => void;
  onApply: (coords: GeoCoords, radiusKm: number) => void;
}) {
  const [radiusKm, setRadiusKm] = useState<number>(initialRadiusKm ?? 10);
  const [coords, setCoords] = useState<GeoCoords | null>(
    initialCoords ?? null
  );
  const [status, setStatus] = useState<GeoStatus>(
    initialCoords ? "ready" : "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // pede a posicao atual ao navegador (funciona em celular e PC; exige HTTPS)
  const requestLocation = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("error");
      setErrorMsg("Seu dispositivo nao suporta geolocalizacao.");
      return;
    }

    setStatus("loading");
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("ready");
      },
      (err) => {
        setStatus("error");
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMsg(
            "Permissao de localizacao negada. Libere o acesso a localizacao nas configuracoes do navegador e tente de novo."
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setErrorMsg(
            "Nao foi possivel determinar sua localizacao agora. Tente novamente."
          );
        } else {
          setErrorMsg("Tempo esgotado ao buscar sua localizacao. Tente de novo.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const canApply = status === "ready" && coords !== null;

  const apply = () => {
    if (coords) onApply(coords, radiusKm);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecalho */}
        <div className="flex items-center justify-between border-b border-ink/10 p-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">📍</span>
            <h2 className="text-lg font-semibold text-ink">Buscar por perto</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink/50 transition hover:bg-sand"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Passo 1: localizacao */}
          <div>
            <p className="text-sm font-medium text-ink">Sua localizacao</p>
            <p className="mt-0.5 text-xs text-ink/50">
              Usamos a posicao do seu aparelho so para achar estabelecimentos
              proximos. Nada e salvo.
            </p>

            <button
              type="button"
              onClick={requestLocation}
              disabled={status === "loading"}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-teal-500 px-4 font-semibold text-teal-600 transition hover:bg-teal-500 hover:text-white disabled:opacity-60"
            >
              {status === "loading" ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500/40 border-t-teal-500" />
                  Localizando...
                </>
              ) : status === "ready" ? (
                "Atualizar minha localizacao"
              ) : (
                "Usar minha localizacao"
              )}
            </button>

            {status === "ready" && coords && (
              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-teal-700">
                ✓ Localizacao obtida
              </p>
            )}
            {status === "error" && errorMsg && (
              <p className="mt-2 text-xs font-medium text-red-500">{errorMsg}</p>
            )}
          </div>

          {/* Passo 2: raio */}
          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">Raio de busca</p>
              <span className="text-sm font-semibold text-teal-600">
                {radiusKm} km
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {RADIUS_OPTIONS.map((r) => {
                const active = r === radiusKm;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadiusKm(r)}
                    className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                      active
                        ? "border-teal-500 bg-teal-500 text-white"
                        : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                    }`}
                  >
                    {r} km
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rodape */}
        <div className="border-t border-ink/10 p-5">
          <button
            type="button"
            onClick={apply}
            disabled={!canApply}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
          >
            {canApply
              ? `Buscar num raio de ${radiusKm} km`
              : "Ative sua localizacao para buscar"}
          </button>
        </div>
      </div>
    </div>
  );
}