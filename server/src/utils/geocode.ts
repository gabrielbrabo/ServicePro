// Converte um endereço em latitude/longitude usando o Nominatim (OpenStreetMap).
// Gratuito, sem chave. Regras de uso: max 1 req/seg e User-Agent identificando o app.

interface GeoResult {
    lat: number;
    lon: number;
  }
  
  export async function geocodeAddress(parts: {
    country: string;
    state: string;
    city: string;
    neighborhood: string;
    street: string;
    number: string;
  }): Promise<GeoResult | null> {
    const query = [
      `${parts.street}, ${parts.number}`,
      parts.neighborhood,
      parts.city,
      parts.state,
      parts.country,
    ]
      .filter(Boolean)
      .join(", ");
  
    const url =
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
      encodeURIComponent(query);
  
    try {
      const resp = await fetch(url, {
        headers: {
          // o Nominatim exige identificar a aplicacao
          "User-Agent": "ServicePro/1.0 (contato@servicepro.app)",
          "Accept-Language": "pt-BR",
        },
      });
  
      if (!resp.ok) return null;
  
      const data = (await resp.json()) as Array<{ lat: string; lon: string }>;
      if (!data || data.length === 0) return null;
  
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      };
    } catch {
      return null;
    }
  }