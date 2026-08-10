import { Response } from "express";
import { Types } from "mongoose";
import { Establishment } from "../models/Establishment";
import { User } from "../models/User";
import {
  Invite,
  generateInviteToken,
  hashInviteToken,
} from "../models/Invite";
import { AuthRequest } from "../middleware/auth";
import { signToken } from "../utils/token";
import { sendEmail, inviteEmailHtml } from "../config/email";
import { env } from "../config/env";

const INVITE_TTL_DAYS = 7;

const appUrl = (): string => env.appUrl.replace(/\/$/, "");

// monta o link de aceite que vai no email e no botao "copiar link"
const buildInviteUrl = (token: string): string =>
  `${appUrl()}/convite/${token}`;

// so o dono do estabelecimento convida
const loadOwned = async (establishmentId: string, userId?: string) => {
  const est = await Establishment.findById(establishmentId);
  if (!est) return { est: null, forbidden: false };
  if (est.owner.toString() !== userId) return { est, forbidden: true };
  return { est, forbidden: false };
};

// POST /api/establishments/:establishmentId/professionals/:professionalId/invite
// (protegido, dono) - body: { email }
// Cria/renova o convite e devolve o link. Envia email se possivel.
export const createInvite = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, professionalId } = req.params;
    const { email } = req.body;

    if (!email || !String(email).trim()) {
      res.status(400).json({ message: "Informe o e-mail do funcionário" });
      return;
    }
    const cleanEmail = String(email).toLowerCase().trim();

    const { est, forbidden } = await loadOwned(establishmentId, req.userId);
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    if (forbidden) {
      res.status(403).json({ message: "Apenas o dono pode convidar" });
      return;
    }

    if (!Types.ObjectId.isValid(professionalId)) {
      res.status(400).json({ message: "Profissional invalido" });
      return;
    }
    const prof = est.professionals.id(professionalId);
    if (!prof) {
      res.status(404).json({ message: "Profissional nao encontrado" });
      return;
    }

    // ja vinculado a um login?
    if (prof.linkedUser) {
      res
        .status(409)
        .json({ message: "Este profissional já possui acesso vinculado" });
      return;
    }

    // invalida convites pendentes antigos deste profissional
    await Invite.updateMany(
      {
        establishment: establishmentId,
        professionalId,
        status: "pendente",
      },
      { $set: { status: "cancelado" } }
    );

    const { token, tokenHash } = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

    await Invite.create({
      establishment: establishmentId,
      professionalId,
      email: cleanEmail,
      tokenHash,
      invitedBy: req.userId,
      expiresAt,
    });

    const inviteUrl = buildInviteUrl(token);

    const { sent } = await sendEmail({
      to: cleanEmail,
      subject: `Convite para acessar sua agenda — ${est.name}`,
      html: inviteEmailHtml({
        establishmentName: est.name,
        professionalName: prof.name,
        inviteUrl,
      }),
    });

    res.status(201).json({
      message: sent
        ? "Convite enviado por e-mail"
        : "Convite criado. Copie o link e envie ao funcionário.",
      emailSent: sent,
      inviteUrl, // sempre devolvido, para o botao "copiar link"
      expiresAt,
    });
  } catch (err) {
    console.error("createInvite:", err);
    res.status(500).json({ message: "Erro ao criar o convite" });
  }
};

// GET /api/invites/:token  (PUBLICO)
// Valida o token e devolve dados para a tela de aceite (sem exigir login).
export const getInvite = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.params;
    const tokenHash = hashInviteToken(token);

    const invite = await Invite.findOne({ tokenHash, status: "pendente" });
    if (!invite) {
      res.status(404).json({ message: "Convite inválido ou já utilizado" });
      return;
    }

    if (invite.expiresAt.getTime() <= Date.now()) {
      invite.status = "expirado";
      await invite.save();
      res.status(410).json({ message: "Este convite expirou" });
      return;
    }

    const est = await Establishment.findById(invite.establishment).select(
      "name professionals"
    );
    const prof = est?.professionals.id(invite.professionalId);

    // o e-mail ja tem conta? (muda o texto da tela: criar senha x so vincular)
    const existingUser = await User.findOne({ email: invite.email }).select(
      "_id name"
    );

    res.json({
      email: invite.email,
      establishmentName: est?.name || "",
      professionalName: prof?.name || "",
      hasAccount: !!existingUser,
      userName: existingUser?.name || "",
    });
  } catch (err) {
    console.error("getInvite:", err);
    res.status(500).json({ message: "Erro ao carregar o convite" });
  }
};

// POST /api/invites/:token/accept  (PUBLICO)
// body: { name?, password? }  - cria a conta (se nova) ou vincula (se existe)
// e ja devolve token de login (funcionario entra direto).
export const acceptInvite = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.params;
    const { name, password } = req.body;
    const tokenHash = hashInviteToken(token);

    const invite = await Invite.findOne({ tokenHash, status: "pendente" });
    if (!invite) {
      res.status(404).json({ message: "Convite inválido ou já utilizado" });
      return;
    }
    if (invite.expiresAt.getTime() <= Date.now()) {
      invite.status = "expirado";
      await invite.save();
      res.status(410).json({ message: "Este convite expirou" });
      return;
    }

    const est = await Establishment.findById(invite.establishment);
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    const prof = est.professionals.id(invite.professionalId);
    if (!prof) {
      res.status(404).json({ message: "Profissional nao encontrado" });
      return;
    }

    // acha ou cria o User do funcionario
    let user = await User.findOne({ email: invite.email });

    if (!user) {
      if (!password || String(password).length < 6) {
        res
          .status(400)
          .json({ message: "Crie uma senha de ao menos 6 caracteres" });
        return;
      }
      user = await User.create({
        name: name?.trim() || prof.name,
        email: invite.email,
        password, // hash automatico no pre-save
      });
    }

    // vincula o profissional a este login
    prof.linkedUser = user._id;

    // adiciona como membro operacional, se ainda nao for
    const alreadyMember = est.members.some(
      (m) => m.professional.toString() === user!._id.toString()
    );
    if (!alreadyMember) {
      est.members.push({
        professional: user._id,
        role: "professional",
        active: true,
      });
    }

    await est.save();

    invite.status = "aceito";
    invite.acceptedBy = user._id;
    await invite.save();

    // ja loga o funcionario
    const authToken = signToken(user._id.toString());

    res.json({
      message: "Convite aceito com sucesso",
      token: authToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        state: user.state,
        city: user.city,
      },
    });
  } catch (err) {
    console.error("acceptInvite:", err);
    res.status(500).json({ message: "Erro ao aceitar o convite" });
  }
};

// GET /api/establishments/:establishmentId/invites  (protegido, dono)
// lista convites pendentes do estabelecimento (para o painel do dono)
export const listInvites = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId } = req.params;
    const { est, forbidden } = await loadOwned(establishmentId, req.userId);
    if (!est) {
      res.status(404).json({ message: "Estabelecimento nao encontrado" });
      return;
    }
    if (forbidden) {
      res.status(403).json({ message: "Apenas o dono pode ver convites" });
      return;
    }

    const invites = await Invite.find({
      establishment: establishmentId,
      status: "pendente",
    }).select("email professionalId expiresAt createdAt");

    res.json(invites);
  } catch (err) {
    console.error("listInvites:", err);
    res.status(500).json({ message: "Erro ao listar convites" });
  }
};