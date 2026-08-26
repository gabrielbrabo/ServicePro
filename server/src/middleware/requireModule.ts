import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import { Establishment } from "../models/Establishment";
import { hasModule, ModuleKey } from "../config/segments";

// Protege uma rota conforme o MODULO estar habilitado no segmento (area) do
// estabelecimento. Descobre o id do estabelecimento em params (:establishmentId
// ou :id) ou no body.establishment.
//
// Uso na rota:
//   router.post("/:establishmentId/prontuario", protect,
//     requireModule("prontuario"), criarProntuario);
export function requireModule(mod: ModuleKey) {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const estId =
        (req.params.establishmentId as string | undefined) ||
        (req.params.id as string | undefined) ||
        (req.body?.establishment as string | undefined);

      if (!estId) {
        res.status(400).json({ message: "Estabelecimento nao informado" });
        return;
      }

      const est = await Establishment.findById(estId)
        .select("segment category")
        .populate("category", "slug");
      if (!est) {
        res.status(404).json({ message: "Estabelecimento nao encontrado" });
        return;
      }

      // slug da categoria (para modulos extras por categoria, ex.: odontograma)
      const categorySlug = (
        est.category as unknown as { slug?: string } | null
      )?.slug;

      if (!hasModule(est.segment, mod, categorySlug)) {
        res.status(403).json({
          message:
            "Este recurso nao esta disponivel para a area deste estabelecimento",
        });
        return;
      }

      next();
    } catch {
      res.status(500).json({ message: "Erro ao validar o modulo" });
    }
  };
}