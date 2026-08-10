import { Response } from "express";
import { Product } from "../models/Product";
import { Establishment } from "../models/Establishment";
import { AuthRequest } from "../middleware/auth";
import { deleteS3ByUrl } from "../config/s3";

// dono OU membro do estabelecimento gerencia produtos
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

// GET /api/products/:establishmentId  (protegido, dono/equipe)
// ?all=1 inclui inativos | ?q=texto busca por nome ou codigo de barras
export const listProducts = async (
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
    if (req.query.all !== "1") filter.active = true;

    const q = req.query.q as string | undefined;
    if (q && q.trim()) {
      filter.$or = [
        { name: { $regex: q.trim(), $options: "i" } },
        { barcode: { $regex: q.trim(), $options: "i" } },
      ];
    }

    const products = await Product.find(filter).sort({ name: 1 });
    res.json(products);
  } catch (err) {
    console.error("listProducts:", err);
    res.status(500).json({ message: "Erro ao listar produtos" });
  }
};

// POST /api/products/:establishmentId  (protegido, dono/equipe)
export const createProduct = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const {
      name,
      description,
      photo,
      price,
      cost,
      stock,
      minStock,
      supplier,
      barcode,
    } = req.body;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    if (!name || !String(name).trim()) {
      res.status(400).json({ message: "Nome do produto e obrigatorio" });
      return;
    }
    if (typeof price !== "number" || price < 0) {
      res.status(400).json({ message: "Preco invalido" });
      return;
    }

    // codigo de barras duplicado no mesmo estabelecimento?
    if (barcode && String(barcode).trim()) {
      const dup = await Product.findOne({
        establishment: establishmentId,
        barcode: String(barcode).trim(),
      });
      if (dup) {
        res
          .status(409)
          .json({ message: "Ja existe um produto com este codigo de barras" });
        return;
      }
    }

    const product = await Product.create({
      establishment: establishmentId,
      name: String(name).trim(),
      description: description || "",
      photo: photo || "",
      price,
      cost: typeof cost === "number" && cost >= 0 ? cost : 0,
      stock: typeof stock === "number" ? stock : 0,
      minStock: typeof minStock === "number" && minStock >= 0 ? minStock : 0,
      supplier: supplier || "",
      barcode: barcode ? String(barcode).trim() : "",
      active: true,
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("createProduct:", err);
    res.status(500).json({ message: "Erro ao criar produto" });
  }
};

// PUT /api/products/:establishmentId/:productId  (protegido, dono/equipe)
export const updateProduct = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, productId } = req.params;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const product = await Product.findOne({
      _id: productId,
      establishment: establishmentId,
    });
    if (!product) {
      res.status(404).json({ message: "Produto nao encontrado" });
      return;
    }

    const {
      name,
      description,
      photo,
      price,
      cost,
      minStock,
      supplier,
      barcode,
      active,
    } = req.body;

    // guarda a foto antiga: se for trocada ou removida, apaga do S3 no fim
    const oldPhoto = product.photo;
    let photoReplaced = false;

    if (typeof name === "string" && name.trim()) product.name = name.trim();
    if (typeof description === "string") product.description = description;
    if (typeof photo === "string" && photo !== oldPhoto) {
      product.photo = photo;
      photoReplaced = true;
    }
    if (typeof price === "number" && price >= 0) product.price = price;
    if (typeof cost === "number" && cost >= 0) product.cost = cost;
    if (typeof minStock === "number" && minStock >= 0)
      product.minStock = minStock;
    if (typeof supplier === "string") product.supplier = supplier;
    if (typeof active === "boolean") product.active = active;

    // codigo de barras: valida duplicata em outro produto
    if (typeof barcode === "string") {
      const clean = barcode.trim();
      if (clean) {
        const dup = await Product.findOne({
          _id: { $ne: product._id },
          establishment: establishmentId,
          barcode: clean,
        });
        if (dup) {
          res
            .status(409)
            .json({ message: "Ja existe um produto com este codigo de barras" });
          return;
        }
      }
      product.barcode = clean;
    }

    // stock NAO e editado aqui: muda apenas por movimentacao de estoque

    await product.save();

    // so apaga a imagem antiga depois que o Mongo confirmou a troca
    if (photoReplaced && oldPhoto) {
      await deleteS3ByUrl(oldPhoto);
    }

    res.json(product);
  } catch (err) {
    console.error("updateProduct:", err);
    res.status(500).json({ message: "Erro ao atualizar produto" });
  }
};

// DELETE /api/products/:establishmentId/:productId  (protegido)
// remocao SOFT: desativa, preservando historico de movimentacoes/vendas.
// A foto NAO e apagada do S3 de proposito: o produto pode ser reativado.
export const deleteProduct = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, productId } = req.params;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const product = await Product.findOne({
      _id: productId,
      establishment: establishmentId,
    });
    if (!product) {
      res.status(404).json({ message: "Produto nao encontrado" });
      return;
    }

    product.active = false;
    await product.save();
    res.json({ message: "Produto desativado", _id: productId });
  } catch (err) {
    console.error("deleteProduct:", err);
    res.status(500).json({ message: "Erro ao remover produto" });
  }
};