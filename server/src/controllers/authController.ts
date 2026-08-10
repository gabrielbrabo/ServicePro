import { Request, Response } from "express";
import crypto from "crypto";
import { User } from "../models/User";
import { signToken } from "../utils/token";
import { AuthRequest } from "../middleware/auth";
import { env } from "../config/env";
import { sendEmail, verifyEmailHtml } from "../config/email";
import { OAuth2Client } from "google-auth-library";
import { Establishment } from "../models/Establishment";
import { deleteS3ByUrl } from "../config/s3";

const TOKEN_TTL_HOURS = 24;

const appUrl = (): string => env.appUrl.replace(/\/$/, "");

// gera token cru (vai no link) + hash (vai no banco)
const generateEmailToken = (): { token: string; tokenHash: string } => {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
};

const hashEmailToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

// dispara o e-mail de confirmacao. Falha silenciosa: nao derruba o cadastro.
const sendVerificationEmail = async (user: {
  _id: unknown;
  name: string;
  email: string;
}): Promise<void> => {
  try {
    const { token, tokenHash } = generateEmailToken();
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + TOKEN_TTL_HOURS);

    await User.findByIdAndUpdate(user._id, {
      emailTokenHash: tokenHash,
      emailTokenExpiry: expiry,
    });

    const verifyUrl = `${appUrl()}/verificar-email/${token}`;

    await sendEmail({
      to: user.email,
      subject: "Confirme seu e-mail — ServicePro",
      html: verifyEmailHtml({ name: user.name, verifyUrl }),
    });
  } catch (err) {
    console.error("sendVerificationEmail:", err);
  }
};

// POST /api/auth/register
export const register = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, phone, country, state, city } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ message: "Nome, email e senha sao obrigatorios" });
    return;
  }

  const exists = await User.findOne({ email });
  if (exists) {
    res.status(409).json({ message: "Email ja cadastrado" });
    return;
  }

  const user = await User.create({
    name,
    email,
    password,
    phone,
    country: country || "Brasil",
    state,
    city,
  });

  // envia a confirmacao (nao bloqueia o cadastro se falhar)
  await sendVerificationEmail({
    _id: user._id,
    name: user.name,
    email: user.email,
  });

  const token = signToken(user._id.toString());

  res.status(201).json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      state: user.state,
      city: user.city,
      emailVerified: user.emailVerified,
    },
  });
};

// POST /api/auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: "Email e senha sao obrigatorios" });
    return;
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    res.status(401).json({ message: "Credenciais invalidas" });
    return;
  }

  const token = signToken(user._id.toString());

  // o front usa isso para mandar dono/funcionario direto ao painel
  const hasEstablishments = !!(await Establishment.findOne({
    $or: [{ owner: user._id }, { "members.professional": user._id }],
  }).select("_id"));

  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      state: user.state,
      city: user.city,
      emailVerified: user.emailVerified,
      hasEstablishments,
    },
  });
};

// monta o objeto de usuario publico no MESMO shape que login/register/google
// retornam (id, nao _id). Evita divergencia: sem isso, recarregar a pagina
// (que usa /me) traz _id e o front que espera `id` fica com id undefined.
const publicUser = (u: {
  _id: unknown;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  country?: string;
  state?: string;
  city?: string;
  emailVerified: boolean;
}) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  avatar: u.avatar,
  country: u.country,
  state: u.state,
  city: u.city,
  emailVerified: u.emailVerified,
});

// GET /api/auth/me
export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404).json({ message: "Usuario nao encontrado" });
    return;
  }
  res.json({ user: publicUser(user) });
};

// PATCH /api/auth/me  (protegido)
// atualiza o proprio perfil. So campos permitidos — e-mail e senha ficam de
// fora de proposito (mudar e-mail exige reverificacao; senha e fluxo a parte).
export const updateMe = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: "Usuario nao encontrado" });
      return;
    }

    const { name, phone, avatar, country, state, city } = req.body;

    let nameChanged = false;
    if (typeof name === "string") {
      if (!name.trim()) {
        res.status(400).json({ message: "O nome nao pode ficar vazio" });
        return;
      }
      if (name.trim() !== user.name) nameChanged = true;
      user.name = name.trim();
    }
    if (typeof phone === "string") user.phone = phone.trim();
    if (typeof country === "string") user.country = country.trim();
    if (typeof state === "string") user.state = state.trim();
    if (typeof city === "string") user.city = city.trim();

    // foto: troca (ou remocao). Se trocou, apaga a antiga do S3 no fim.
    let oldAvatar = "";
    let avatarChanged = false;
    if (typeof avatar === "string" && avatar !== (user.avatar || "")) {
      oldAvatar = user.avatar || "";
      user.avatar = avatar;
      avatarChanged = true;
    }

    await user.save();

    // O perfil e a fonte da verdade para profissionais COM login: propaga nome
    // e foto para o professionals[] de todo estabelecimento onde este user e
    // vinculado. Assim a agenda (escolha do cliente) e a aba Equipe ficam
    // sempre iguais ao perfil. Falha silenciosa: nao derruba a atualizacao.
    if (nameChanged || avatarChanged) {
      try {
        const set: Record<string, unknown> = {};
        if (nameChanged) set["professionals.$[p].name"] = user.name;
        if (avatarChanged) set["professionals.$[p].photo"] = user.avatar || "";
        await Establishment.updateMany(
          { "professionals.linkedUser": user._id },
          { $set: set },
          { arrayFilters: [{ "p.linkedUser": user._id }] }
        );
      } catch (propErr) {
        console.error("updateMe (propagar perfil):", propErr);
      }
    }

    // apaga a foto antiga do S3 so depois de salvar (falha silenciosa).
    // Contas Google trazem avatar hospedado no proprio Google — nunca no nosso
    // bucket; o deleteS3ByUrl ignora URLs que nao sao do bucket, entao e seguro.
    if (avatarChanged && oldAvatar) {
      await deleteS3ByUrl(oldAvatar);
    }

    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error("updateMe:", err);
    res.status(500).json({ message: "Erro ao atualizar o perfil" });
  }
};

// POST /api/auth/verify-email/:token  (PUBLICO)
// confirma o e-mail a partir do token enviado no cadastro
export const verifyEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.params;
    const tokenHash = hashEmailToken(token);

    const user = await User.findOne({ emailTokenHash: tokenHash }).select(
      "+emailTokenHash +emailTokenExpiry"
    );

    if (!user) {
      res.status(404).json({ message: "Link invalido ou ja utilizado" });
      return;
    }

    if (user.emailVerified) {
      res.json({ message: "Seu e-mail ja estava confirmado", alreadyDone: true });
      return;
    }

    if (
      user.emailTokenExpiry &&
      user.emailTokenExpiry.getTime() <= Date.now()
    ) {
      res.status(410).json({ message: "Este link expirou. Peca um novo." });
      return;
    }

    user.emailVerified = true;
    user.emailTokenHash = undefined;
    user.emailTokenExpiry = undefined;
    await user.save();

    res.json({ message: "E-mail confirmado com sucesso" });
  } catch (err) {
    console.error("verifyEmail:", err);
    res.status(500).json({ message: "Erro ao confirmar o e-mail" });
  }
};

// POST /api/auth/resend-verification  (protegido)
// reenvia o e-mail de confirmacao para o usuario logado
export const resendVerification = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: "Usuario nao encontrado" });
      return;
    }

    if (user.emailVerified) {
      res.json({ message: "Seu e-mail ja esta confirmado" });
      return;
    }

    await sendVerificationEmail({
      _id: user._id,
      name: user.name,
      email: user.email,
    });

    res.json({ message: `Enviamos um novo link para ${user.email}` });
  } catch (err) {
    console.error("resendVerification:", err);
    res.status(500).json({ message: "Erro ao reenviar o e-mail" });
  }
};

// cliente do Google para validar o token do front
const googleClient = new OAuth2Client(env.googleClientId);

// POST /api/auth/google  (PUBLICO)
// body: { credential }  - o ID token que o Google devolve no front
//
// Valida o token com o Google, cria a conta se nao existir, ou vincula a uma
// conta local ja existente com o mesmo e-mail. Conta Google ja vem com o
// e-mail verificado (o Google garante), entao pula a confirmacao.
export const googleAuth = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { credential } = req.body;

    if (!credential) {
      res.status(400).json({ message: "Credencial ausente" });
      return;
    }
    if (!env.googleClientId) {
      res.status(500).json({ message: "Login com Google nao configurado" });
      return;
    }

    // valida a assinatura do token direto com o Google
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(401).json({ message: "Nao foi possivel validar a conta Google" });
      return;
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || email.split("@")[0];
    const googleId = payload.sub;
    const avatar = payload.picture;

    let user = await User.findOne({ email });

    if (user) {
      // conta ja existe: vincula ao Google se ainda nao estava
      let changed = false;
      if (!user.googleId) {
        user.googleId = googleId;
        changed = true;
      }
      // o Google garante o e-mail: aproveita para confirmar
      if (!user.emailVerified) {
        user.emailVerified = true;
        user.emailTokenHash = undefined;
        user.emailTokenExpiry = undefined;
        changed = true;
      }
      if (!user.avatar && avatar) {
        user.avatar = avatar;
        changed = true;
      }
      if (changed) await user.save();
    } else {
      // conta nova via Google: sem senha, ja verificada
      user = await User.create({
        name,
        email,
        authProvider: "google",
        googleId,
        avatar,
        emailVerified: true,
        country: "Brasil",
      });
    }

    const token = signToken(user._id.toString());

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        state: user.state,
        city: user.city,
        emailVerified: user.emailVerified,
      },
    });
  } catch (err) {
    console.error("googleAuth:", err);
    res.status(401).json({ message: "Falha na autenticacao com o Google" });
  }
};