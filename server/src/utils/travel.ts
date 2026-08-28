// Estimativa de deslocamento para atendimento a domicilio.
//
// Sem API de rotas paga: usamos a distancia em LINHA RETA (haversine) entre o
// estabelecimento e o endereco do cliente, multiplicada por um fator de via
// (ruas nao sao retas) e dividida por uma velocidade media configuravel.
// Aproximacao suficiente para reservar a agenda; o upgrade para tempo real de
// rota (Google/Mapbox) pode ser feito depois trocando so esta funcao.

export interface Coords {
  lat: number;
  lon: number;
}

// fator que aproxima "distancia de rua" a partir da linha reta (~1.3 em cidade)
const ROAD_FACTOR = 1.3;

// distancia em km entre dois pontos (haversine)
export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371; // raio da Terra em km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface TravelEstimate {
  km: number; // distancia estimada de UM trecho (ida), em km
  oneWayMinutes: number; // tempo estimado de UM trecho, em minutos
}

// estima distancia e tempo de UM trecho (ida). volta = mesmo valor.
export function estimateTravel(
  from: Coords,
  to: Coords,
  avgSpeedKmh: number
): TravelEstimate {
  const straight = haversineKm(from, to);
  const km = Math.round(straight * ROAD_FACTOR * 100) / 100;
  const speed = avgSpeedKmh > 0 ? avgSpeedKmh : 25;
  const oneWayMinutes = Math.ceil((km / speed) * 60);
  return { km, oneWayMinutes };
}

// taxa de deslocamento: taxa fixa + (taxa por km * distancia ida e volta).
// baseFee/feePerKm ja resolvidos (override do servico OU padrao do estab.).
export function travelFee(
  oneWayKm: number,
  baseFee: number,
  feePerKm: number
): number {
  const roundTripKm = oneWayKm * 2;
  const fee = (baseFee || 0) + (feePerKm || 0) * roundTripKm;
  return Math.round(Math.max(0, fee) * 100) / 100;
}
