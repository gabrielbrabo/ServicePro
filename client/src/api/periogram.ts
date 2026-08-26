import { api } from "../lib/api";

// Um dente do periograma: 6 sitios (0..5):
//  0 Mesio-Vestibular 1 Vestibular 2 Disto-Vestibular
//  3 Mesio-Lingual    4 Lingual    5 Disto-Lingual
export interface PerioTooth {
  number: number;
  pd: number[]; // profundidade de sondagem (mm) x6
  rec: number[]; // recessao gengival (mm) x6
  bop: boolean[]; // sangramento a sondagem x6
  mobility: number; // 0-3
  furcation: number; // 0-3
  note?: string;
}

export interface Periogram {
  _id?: string;
  establishment: string;
  client: string;
  teeth: PerioTooth[];
  _isNew?: boolean;
}

const base = "/periogram";

export const periogramApi = {
  get: (establishmentId: string, clientId: string) =>
    api
      .get<Periogram>(`${base}/${establishmentId}/${clientId}`)
      .then((r) => r.data),

  setTooth: (
    establishmentId: string,
    clientId: string,
    data: {
      number: number;
      pd: number[];
      rec: number[];
      bop: boolean[];
      mobility: number;
      furcation: number;
      note?: string;
    }
  ) =>
    api
      .put<Periogram>(`${base}/${establishmentId}/${clientId}/tooth`, data)
      .then((r) => r.data),
};
