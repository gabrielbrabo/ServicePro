import { useEffect, useRef, useState } from "react";

// Resultado estruturado devolvido ao escolher um endereco: campos separados
// (para preencher o form) + coordenadas (para o mapa e a busca por localizacao).
export interface ResolvedAddress {
  country: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  number: string;
  lat: number;
  lon: number;
  formatted: string;
}

// Uma sugestao de endereco vinda do Photon (OpenStreetMap).
interface PhotonFeature {
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string; // bairro
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    postcode?: string;
    osm_key?: string;
    osm_value?: string;
  };
  geometry: {
    coordinates: [number, number]; // [lon, lat]
  };
}

// sigla do estado a partir do nome (Photon devolve o nome por extenso)
const UF: Record<string, string> = {
  Acre: "AC",
  Alagoas: "AL",
  Amapá: "AP",
  Amazonas: "AM",
  Bahia: "BA",
  Ceará: "CE",
  "Distrito Federal": "DF",
  "Espírito Santo": "ES",
  Goiás: "GO",
  Maranhão: "MA",
  "Mato Grosso": "MT",
  "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG",
  Pará: "PA",
  Paraíba: "PB",
  Paraná: "PR",
  Pernambuco: "PE",
  Piauí: "PI",
  "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN",
  "Rio Grande do Sul": "RS",
  Rondônia: "RO",
  Roraima: "RR",
  "Santa Catarina": "SC",
  "São Paulo": "SP",
  Sergipe: "SE",
  Tocantins: "TO",
};

// monta um rotulo legivel para a lista de sugestoes
function labelOf(f: PhotonFeature): string {
  const p = f.properties;
  const partes = [
    [p.street || p.name, p.housenumber].filter(Boolean).join(", "),
    p.district,
    p.city || p.county,
    p.state,
  ].filter(Boolean);
  return partes.join(" · ");
}

export function AddressAutocomplete({
  onResolved,
  label = "Buscar endereço",
  hint = "Digite o endereço e escolha na lista para preencher automaticamente.",
  initialValue = "",
}: {
  onResolved: (addr: ResolvedAddress) => void;
  label?: string;
  hint?: string;
  initialValue?: string;
}) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // fecha o dropdown ao clicar fora
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // busca sugestoes (com debounce) conforme o usuario digita
  const onChange = (value: string) => {
    setQuery(value);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        // cancela busca anterior ainda pendente
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        // Photon (OpenStreetMap): autocomplete gratis, sem chave.
        // lang=pt e limitado ao Brasil via bbox aproximada do pais.
        const url =
          "https://photon.komoot.io/api/?q=" +
          encodeURIComponent(value) +
          "&lang=default&limit=6" +
          // bbox do Brasil (minLon,minLat,maxLon,maxLat) para priorizar resultados locais
          "&bbox=-74.0,-34.0,-34.0,5.5";

        const resp = await fetch(url, { signal: abortRef.current.signal });
        if (!resp.ok) throw new Error("falha");
        const data = await resp.json();

        const feats: PhotonFeature[] = (data.features || []).filter(
          (f: PhotonFeature) => {
            // so lugares no Brasil e que tenham ao menos cidade ou rua
            const p = f.properties;
            const brasil =
              !p.country ||
              p.country === "Brasil" ||
              p.country === "Brazil";
            return brasil && (p.city || p.county || p.street || p.name);
          }
        );

        setSuggestions(feats);
        setOpen(feats.length > 0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Erro ao buscar endereços. Tente novamente.");
        }
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  // ao escolher uma sugestao: monta o endereco estruturado + coordenadas
  const choose = (f: PhotonFeature) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;

    const stateName = p.state || "";
    const resolved: ResolvedAddress = {
      country: p.country === "Brazil" ? "Brasil" : p.country || "Brasil",
      state: UF[stateName] || stateName,
      city: p.city || p.county || "",
      neighborhood: p.district || "",
      street: p.street || p.name || "",
      number: p.housenumber || "",
      lat,
      lon,
      formatted: labelOf(f),
    };

    setQuery(resolved.formatted);
    setOpen(false);
    onResolved(resolved);
  };

  return (
    <div className="relative" ref={boxRef}>
      <span className="mb-1.5 block text-sm font-medium text-ink/70">
        {label}
      </span>
      <input
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Ex: Rua dos Oliveiras, 1373, São Romão"
        className="h-12 w-full rounded-xl border border-ink/15 bg-white px-4 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
      />

      {loading && (
        <span className="absolute right-3 top-[42px] h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
      )}

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-ink/10 bg-white p-1 shadow-lg">
          {suggestions.map((f, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => choose(f)}
                className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink/80 transition hover:bg-sand"
              >
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-ink/40"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="min-w-0">{labelOf(f)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {hint && !error && <p className="mt-1.5 text-xs text-ink/40">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>
      )}
    </div>
  );
}