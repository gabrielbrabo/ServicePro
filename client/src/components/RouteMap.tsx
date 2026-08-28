import { useEffect, useRef, useState } from "react";

// Mapa com DUAS marcacoes (saida x local do servico) + linha entre elas.
// Usa Leaflet carregado da CDN (sem adicionar dependencia ao projeto) e tiles
// gratuitos do OpenStreetMap. Ordem: lat, lon (o banco guarda [lon, lat]).

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

// carrega o Leaflet uma unica vez (compartilhado entre instancias)
let leafletPromise: Promise<unknown> | null = null;
function loadLeaflet(): Promise<unknown> {
  const w = window as unknown as { L?: unknown };
  if (w.L) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve(w.L);
    script.onerror = () => reject(new Error("Falha ao carregar o mapa"));
    document.body.appendChild(script);
  });
  return leafletPromise;
}

interface Point {
  lat: number;
  lon: number;
  label?: string;
}

export function RouteMap({
  from,
  to,
  heightClass = "h-64",
}: {
  from: Point;
  to: Point;
  heightClass?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((L: any) => {
        if (cancelled || !ref.current) return;
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
        // corrige os icones de marcador (bundler-safe): aponta p/ a CDN
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        const map = L.map(ref.current, { scrollWheelZoom: false });
        mapRef.current = map;
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);

        const mFrom = L.marker([from.lat, from.lon]).addTo(map);
        if (from.label) mFrom.bindPopup(from.label);
        const mTo = L.marker([to.lat, to.lon]).addTo(map);
        if (to.label) mTo.bindPopup(to.label);

        L.polyline(
          [
            [from.lat, from.lon],
            [to.lat, to.lon],
          ],
          { color: "#14b8a6", weight: 3, dashArray: "6 6" }
        ).addTo(map);

        const bounds = L.latLngBounds([
          [from.lat, from.lon],
          [to.lat, to.lon],
        ]);
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
        // dentro de modal o container pode iniciar sem tamanho: re-mede
        setTimeout(() => map.invalidateSize(), 120);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [from.lat, from.lon, to.lat, to.lon, from.label, to.label]);

  if (failed) {
    return (
      <p className="rounded-xl border border-dashed border-ink/20 px-4 py-3 text-center text-sm text-ink/50">
        Não foi possível carregar o mapa. Use o botão de rota abaixo.
      </p>
    );
  }

  return (
    <div
      ref={ref}
      className={`w-full ${heightClass} overflow-hidden rounded-xl border border-ink/10`}
      style={{ zIndex: 0 }}
    />
  );
}
