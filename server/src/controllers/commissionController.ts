import { Response } from "express";
import { Types } from "mongoose";
import { CommissionSetting } from "../models/CommissionSetting";
import { Establishment } from "../models/Establishment";
import { Service } from "../models/Service";
import { Booking } from "../models/Booking";
import { AuthRequest } from "../middleware/auth";

// Config de taxas: SO O DONO (dados do negocio).
const ownerEst = async (establishmentId: string, userId?: string) => {
  if (!userId) return null;
  return Establishment.findOne({ _id: establishmentId, owner: userId });
};

// Relatorio: dono ve tudo; funcionario ve SO a propria comissao.
// Retorna o papel + o id do profissional vinculado ao funcionario (se houver).
const getAccess = async (establishmentId: string, userId?: string) => {
  if (!userId) return null;
  const est = await Establishment.findOne({
    _id: establishmentId,
    $or: [{ owner: userId }, { "members.professional": userId }],
  });
  if (!est) return null;
  const isOwner = String(est.owner) === String(userId);
  let myProfessionalId: string | null = null;
  if (!isOwner) {
    const p = (est.professionals || []).find(
      (pp) => pp.linkedUser && String(pp.linkedUser) === String(userId)
    );
    myProfessionalId = p ? String(p._id) : null;
  }
  return { est, isOwner, myProfessionalId };
};

// GET /api/commissions/:establishmentId/config
// lista os servicos ativos do estabelecimento com a % de comissao atual (0 se nao definida)
export const getConfig = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await ownerEst(establishmentId, req.userId))) {
      res.status(403).json({ message: "Apenas o dono acessa as comissoes" });
      return;
    }

    const [services, cfg] = await Promise.all([
      Service.find({ establishment: establishmentId, active: true })
        .select("title price")
        .sort({ title: 1 }),
      CommissionSetting.findOne({ establishment: establishmentId }).select(
        "rates"
      ),
    ]);

    const map = new Map<string, number>();
    (cfg?.rates || []).forEach((r) => map.set(String(r.service), r.percent));

    res.json({
      services: services.map((s) => ({
        _id: String(s._id),
        title: (s as { title?: string }).title || "",
        price: (s as { price?: number }).price || 0,
        percent: map.get(String(s._id)) || 0,
      })),
    });
  } catch (err) {
    console.error("getConfig (commissions):", err);
    res.status(500).json({ message: "Erro ao buscar as comissoes" });
  }
};

// PUT /api/commissions/:establishmentId/config
// body: { rates: [{ service, percent }] }
export const setConfig = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!(await ownerEst(establishmentId, req.userId))) {
      res.status(403).json({ message: "Apenas o dono acessa as comissoes" });
      return;
    }

    const input = Array.isArray(req.body.rates) ? req.body.rates : [];
    const rates: { service: Types.ObjectId; percent: number }[] = [];
    for (const r of input) {
      if (!r || !Types.ObjectId.isValid(r.service)) continue;
      let p = Number(r.percent);
      if (!Number.isFinite(p)) p = 0;
      p = Math.min(100, Math.max(0, p));
      if (p > 0) rates.push({ service: new Types.ObjectId(r.service), percent: p });
    }

    await CommissionSetting.findOneAndUpdate(
      { establishment: establishmentId },
      { rates, updatedBy: req.userId },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("setConfig (commissions):", err);
    res.status(500).json({ message: "Erro ao salvar as comissoes" });
  }
};

// GET /api/commissions/:establishmentId/report?from=YYYY-MM-DD&to=YYYY-MM-DD
// soma a comissao por profissional dos agendamentos concluidos E pagos no periodo.
export const getReport = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const access = await getAccess(establishmentId, req.userId);
    if (!access) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }
    const { est, isOwner, myProfessionalId } = access;

    // periodo: padrao = mes atual ate agora.
    // "YYYY-MM-DD" precisa ser interpretado como dia LOCAL. new Date("YYYY-MM-DD")
    // parseia como meia-noite UTC, o que no fuso do servidor (UTC-3) cai no dia
    // ANTERIOR — e fazia o "ate" terminar ontem, excluindo os atendimentos
    // concluidos hoje. Aqui montamos a data pelos componentes, em hora local.
    const parseLocalDay = (s: string, endOfDay: boolean): Date | null => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      if (!m) return null;
      return new Date(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        endOfDay ? 23 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 999 : 0
      );
    };

    const toParsed = req.query.to
      ? parseLocalDay(String(req.query.to), true)
      : null;
    const to = toParsed || new Date();
    if (!toParsed) to.setHours(23, 59, 59, 999);

    const fromParsed = req.query.from
      ? parseLocalDay(String(req.query.from), false)
      : null;
    const from = fromParsed || new Date(to.getFullYear(), to.getMonth(), 1);
    if (!fromParsed) from.setHours(0, 0, 0, 0);

    const cfg = await CommissionSetting.findOne({
      establishment: establishmentId,
    }).select("rates");
    const rateOf = new Map<string, number>();
    (cfg?.rates || []).forEach((r) => rateOf.set(String(r.service), r.percent));

    // funcionario so ve a propria comissao; sem profissional vinculado = vazio
    if (!isOwner && !myProfessionalId) {
      res.json({
        from: from.toISOString(),
        to: to.toISOString(),
        professionals: [],
        totals: { count: 0, base: 0, commission: 0 },
      });
      return;
    }

    // concluidos e pagos, no periodo (usa completedAt; cai para scheduledAt se nulo)
    const query: Record<string, unknown> = {
      establishment: establishmentId,
      status: "concluido",
      "payment.status": "pago",
      $or: [
        { completedAt: { $gte: from, $lte: to } },
        {
          completedAt: { $in: [null, undefined] },
          scheduledAt: { $gte: from, $lte: to },
        },
      ],
    };
    if (!isOwner && myProfessionalId) {
      query.professional = new Types.ObjectId(myProfessionalId);
    }

    const bookings = await Booking.find(query).select(
      "professional service items payment.amount"
    );

    // nome de cada profissional (subdoc do estabelecimento)
    const nameOf = new Map<string, string>();
    (est.professionals || []).forEach((p) =>
      nameOf.set(String(p._id), p.name)
    );

    type Row = {
      professionalId: string | null;
      name: string;
      count: number;
      base: number;
      commission: number;
    };
    const rows = new Map<string, Row>();
    let totalBase = 0;
    let totalCommission = 0;

    for (const b of bookings) {
      const amount = b.payment?.amount || 0;

      // combo: soma a comissao item a item (cada servico com sua taxa);
      // servico unico (items vazio): taxa do servico sobre o valor total.
      let commission = 0;
      if (b.items && b.items.length > 0) {
        for (const it of b.items) {
          const pct = rateOf.get(String(it.service)) || 0;
          commission += (it.price * pct) / 100;
        }
      } else {
        const pct = rateOf.get(String(b.service)) || 0;
        commission = (amount * pct) / 100;
      }

      const pid = b.professional ? String(b.professional) : null;
      const keyId = pid || "__none__";
      const row =
        rows.get(keyId) ||
        ({
          professionalId: pid,
          name: pid ? nameOf.get(pid) || "Profissional removido" : "Sem profissional",
          count: 0,
          base: 0,
          commission: 0,
        } as Row);
      row.count += 1;
      row.base += amount;
      row.commission += commission;
      rows.set(keyId, row);

      totalBase += amount;
      totalCommission += commission;
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const list = Array.from(rows.values())
      .map((r) => ({
        ...r,
        base: round2(r.base),
        commission: round2(r.commission),
      }))
      .sort((a, b) => b.commission - a.commission);

    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      professionals: list,
      totals: {
        count: bookings.length,
        base: round2(totalBase),
        commission: round2(totalCommission),
      },
    });
  } catch (err) {
    console.error("getReport (commissions):", err);
    res.status(500).json({ message: "Erro ao gerar o relatorio de comissoes" });
  }
};