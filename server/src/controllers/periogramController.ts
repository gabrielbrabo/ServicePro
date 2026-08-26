import { Response } from "express";
import { Periogram } from "../models/Periogram";
import { Establishment } from "../models/Establishment";
import { AuthRequest } from "../middleware/auth";

// dono OU membro do estabelecimento
const canManage = async (
  establishmentId: string,
  userId?: string
): Promise<boolean> => {
  if (!userId) return false;
  const est = await Establishment.findOne({
    _id: establishmentId,
    $or: [{ owner: userId }, { "members.professional": userId }],
  }).select("_id");
  return !!est;
};

// numeros FDI validos (dentes permanentes)
const VALID_FDI = new Set<number>();
[1, 2, 3, 4].forEach((q) => {
  for (let i = 1; i <= 8; i++) VALID_FDI.add(q * 10 + i);
});

// normaliza um array de 6 numeros (mm), clampando 0..20
const num6 = (v: unknown): number[] => {
  const arr = Array.isArray(v) ? v : [];
  return Array.from({ length: 6 }, (_, i) => {
    const n = Math.round(Number(arr[i]));
    return isNaN(n) ? 0 : Math.min(20, Math.max(0, n));
  });
};

const bool6 = (v: unknown): boolean[] => {
  const arr = Array.isArray(v) ? v : [];
  return Array.from({ length: 6 }, (_, i) => !!arr[i]);
};

const clampGrade = (v: unknown): number => {
  const n = Math.round(Number(v));
  if (isNaN(n)) return 0;
  return Math.min(3, Math.max(0, n));
};

const toothIsEmpty = (t: {
  pd: number[];
  rec: number[];
  bop: boolean[];
  mobility: number;
  furcation: number;
  note?: string;
}): boolean =>
  t.pd.every((n) => n === 0) &&
  t.rec.every((n) => n === 0) &&
  t.bop.every((b) => !b) &&
  t.mobility === 0 &&
  t.furcation === 0 &&
  !(t.note && t.note.trim());

// GET /api/periogram/:establishmentId/:clientId
export const getPeriogram = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const perio = await Periogram.findOne({
      establishment: establishmentId,
      client: clientId,
    });
    if (!perio) {
      res.json({
        establishment: establishmentId,
        client: clientId,
        teeth: [],
        _isNew: true,
      });
      return;
    }
    res.json(perio);
  } catch (err) {
    console.error("getPeriogram:", err);
    res.status(500).json({ message: "Erro ao buscar periograma" });
  }
};

// PUT /api/periogram/:establishmentId/:clientId/tooth
// body: { number, pd[], rec[], bop[], mobility, furcation, note? }
// upsert de um dente; se o dente ficar "vazio", e removido do periograma.
export const setPerioTooth = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const number = Math.round(Number(req.body.number));
    if (!VALID_FDI.has(number)) {
      res.status(400).json({ message: "Numero de dente invalido" });
      return;
    }

    const tooth = {
      number,
      pd: num6(req.body.pd),
      rec: num6(req.body.rec),
      bop: bool6(req.body.bop),
      mobility: clampGrade(req.body.mobility),
      furcation: clampGrade(req.body.furcation),
      note:
        typeof req.body.note === "string" && req.body.note.trim()
          ? req.body.note.trim()
          : undefined,
    };

    const perio =
      (await Periogram.findOne({
        establishment: establishmentId,
        client: clientId,
      })) ||
      new Periogram({
        establishment: establishmentId,
        client: clientId,
        teeth: [],
      });

    const idx = perio.teeth.findIndex((t) => t.number === number);
    if (toothIsEmpty(tooth)) {
      // limpou o dente: remove do periograma
      if (idx >= 0) perio.teeth.splice(idx, 1);
    } else if (idx >= 0) {
      perio.teeth[idx] = tooth as never;
    } else {
      perio.teeth.push(tooth as never);
    }

    await perio.save();
    res.json(perio);
  } catch (err) {
    console.error("setPerioTooth:", err);
    res.status(500).json({ message: "Erro ao salvar o dente" });
  }
};
