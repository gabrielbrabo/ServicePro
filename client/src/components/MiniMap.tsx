// Mini-mapa estatico via iframe do OpenStreetMap (sem chave de API, gratis).
//
// ATENCAO a ordem das coordenadas: no banco, location.coordinates segue o
// padrao GeoJSON [longitude, latitude]. O OSM (e a maioria das APIs de mapa)
// usa latitude, longitude. Este componente recebe lat/lon ja separados para
// nao haver confusao — quem chama e responsavel por passar na ordem certa.

export function MiniMap({
    lat,
    lon,
    label,
    heightClass = "h-56",
    zoom = 0.006, // tamanho da bbox; menor = mais zoom
  }: {
    lat: number;
    lon: number;
    label?: string;
    heightClass?: string;
    zoom?: number;
  }) {
    // bbox (bounding box) em volta do ponto: minLon,minLat,maxLon,maxLat
    const bbox = [lon - zoom, lat - zoom, lon + zoom, lat + zoom].join("%2C");
    const marker = `${lat}%2C${lon}`;
    const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
  
    // link para abrir no OSM/app de mapas com rota
    const openUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
  
    return (
      <div className="overflow-hidden rounded-xl border border-ink/10">
        <iframe
          title={label || "Mapa da localização"}
          src={src}
          className={`w-full ${heightClass}`}
          loading="lazy"
          style={{ border: 0 }}
        />
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-white px-3 py-2 text-center text-xs font-medium text-teal-600 transition hover:bg-sand"
        >
          Abrir no mapa / traçar rota
        </a>
      </div>
    );
  }