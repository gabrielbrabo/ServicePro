import { Response } from "express";
import { Types } from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { Establishment } from "../models/Establishment";

// Favoritos do usuario (coracao no card/pagina do estabelecimento).
// A LISTA de favoritos e exibida no Explorar via
// GET /api/establishments/search?favorites=1 (reaproveita filtros/paginacao).

const MAX_FAVORITES = 300;

// GET /api/favorites/ids — ids dos favoritos (para pintar os coracoes)
export const listFavoriteIds = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const me = await User.findById(req.userId).select("+favorites");
    res.json((me?.favorites || []).map(String));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao carregar favoritos" });
  }
};

// POST /api/favorites/:establishmentId — adiciona (idempotente)
export const addFavorite = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!Types.ObjectId.isValid(establishmentId)) {
      res.status(400).json({ message: "Estabelecimento invalido" });
      return;
    }
    const exists = await Establishment.exists({ _id: establishmentId });
    if (!exists) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    const me = await User.findById(req.userId).select("+favorites");
    if (!me) {
      res.status(401).json({ message: "Usuario nao encontrado" });
      return;
    }
    const already = (me.favorites || []).some(
      (id) => String(id) === establishmentId
    );
    if (!already && (me.favorites || []).length >= MAX_FAVORITES) {
      res
        .status(400)
        .json({ message: `Limite de ${MAX_FAVORITES} favoritos atingido` });
      return;
    }
    await User.updateOne(
      { _id: req.userId },
      { $addToSet: { favorites: new Types.ObjectId(establishmentId) } }
    );
    res.json({ favorite: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao salvar favorito" });
  }
};

// DELETE /api/favorites/:establishmentId — remove (idempotente)
export const removeFavorite = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    if (!Types.ObjectId.isValid(establishmentId)) {
      res.status(400).json({ message: "Estabelecimento invalido" });
      return;
    }
    await User.updateOne(
      { _id: req.userId },
      { $pull: { favorites: new Types.ObjectId(establishmentId) } }
    );
    res.json({ favorite: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao remover favorito" });
  }
};
