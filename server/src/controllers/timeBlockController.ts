import { Response } from "express";
import { TimeBlock } from "../models/TimeBlock";
import { Establishment } from "../models/Establishment";
import { AuthRequest } from "../middleware/auth";

// so o dono ou um profissional membro pode gerenciar bloqueios
const canManage = async (
  establishmentId: string,
  userId?: string
): Promise<boolean> => {
  if (!userId) return false;
  const est = await Establishment.findOne({
    _id: establishmentId,
    $or: [{ owner: userId }, { "members.professional": userId }],
  });
  return !!est;
};

// GET /api/timeblocks/:establishmentId  (protegido)
// ?from=YYYY-MM-DD&to=YYYY-MM-DD  (opcional, filtra por janela)
export const listTimeBlocks = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const filter: Record<string, unknown> = { establishment: establishmentId };

    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    if (from || to) {
      // pega blocks que terminam depois de "from" e comecam antes de "to"
      const range: Record<string, Date> = {};
      const overlap: Record<string, unknown> = {};
      if (from) {
        const f = new Date(`${from}T00:00:00`);
        if (!isNaN(f.getTime())) overlap.endAt = { $gte: f };
      }
      if (to) {
        const t = new Date(`${to}T23:59:59`);
        if (!isNaN(t.getTime())) overlap.startAt = { $lte: t };
      }
      Object.assign(filter, overlap);
      void range;
    }

    const blocks = await TimeBlock.find(filter).sort({ startAt: 1 });
    res.json(blocks);
  } catch (err) {
    console.error("listTimeBlocks:", err);
    res.status(500).json({ message: "Erro ao listar bloqueios" });
  }
};

// POST /api/timeblocks/:establishmentId  (protegido)
// body: { type?, startAt, endAt, allDay?, label? }
// - allDay=true: startAt/endAt podem vir como "YYYY-MM-DD"; normalizamos para
//   00:00 do primeiro dia -> 00:00 do dia seguinte ao ultimo.
// - allDay=false: startAt/endAt devem ser data/hora (ISO).
export const createTimeBlock = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const { type = "bloqueio", startAt, endAt, allDay = false, label } =
      req.body;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    if (!["bloqueio", "feriado", "ferias"].includes(type)) {
      res.status(400).json({ message: "Tipo de bloqueio invalido" });
      return;
    }

    let start: Date;
    let end: Date;

    if (allDay) {
      // aceita "YYYY-MM-DD" ou ISO; usa so a parte da data (local)
      const s = new Date(startAt);
      const e = new Date(endAt ?? startAt);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) {
        res.status(400).json({ message: "Datas invalidas" });
        return;
      }
      // 00:00 do primeiro dia (local)
      start = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0);
      // 00:00 do dia SEGUINTE ao ultimo dia (local) -> cobre o ultimo dia inteiro
      end = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1, 0, 0, 0, 0);
    } else {
      start = new Date(startAt);
      end = new Date(endAt);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({ message: "Datas invalidas" });
        return;
      }
    }

    if (end <= start) {
      res.status(400).json({ message: "Fim deve ser depois do inicio" });
      return;
    }

    const block = await TimeBlock.create({
      establishment: establishmentId,
      createdBy: req.userId,
      type,
      startAt: start,
      endAt: end,
      allDay,
      label: label || "",
    });

    res.status(201).json(block);
  } catch (err) {
    console.error("createTimeBlock:", err);
    res.status(500).json({ message: "Erro ao criar bloqueio" });
  }
};

// DELETE /api/timeblocks/:establishmentId/:blockId  (protegido)
export const deleteTimeBlock = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, blockId } = req.params;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const block = await TimeBlock.findOne({
      _id: blockId,
      establishment: establishmentId,
    });
    if (!block) {
      res.status(404).json({ message: "Bloqueio nao encontrado" });
      return;
    }

    await block.deleteOne();
    res.json({ message: "Bloqueio removido", _id: blockId });
  } catch (err) {
    console.error("deleteTimeBlock:", err);
    res.status(500).json({ message: "Erro ao remover bloqueio" });
  }
};