import { Request, Response } from "express";
import { Types } from "mongoose";
import crypto from "crypto";
import { User } from "../models/User";
import { Affiliate } from "../models/Affiliate";
import { signToken } from "../utils/token";
import { AuthRequest } from "../middleware/auth";
import { env } from "../config/env";
import {
  sendEmail,
  verifyEmailHtml,
  passwordResetHtml,
  passwordResetGoogleHtml,
  passwordChangedHtml,
} from "../config/email";
import { validatePassword } from "../utils/passwordPolicy";
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
      subject: "Confirme seu e-mail — ServiçosPro",
      html: verifyEmailHtml({ name: user.name, verifyUrl }),
    });
  } catch (err) {
    console.error("sendVerificationEmail:", err);
  }
};

// POST /api/auth/register
export const register = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, phone, country, state, city, ref } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ message: "Nome, email e senha sao obrigatorios" });
    return;
  }

  const exists = await User.findOne({ email });
  if (exists) {
    res.status(409).json({ message: "Email ja cadastrado" });
    return;
  }

  // indicacao: se veio um ?ref de afiliado/representante ativo, vincula o
  // usuario ao afiliado (o split de comissao e aplicado quando ele assinar).
  let referredByAffiliate: Types.ObjectId | null = null;
  if (typeof ref === "string" && ref.trim()) {
    const aff = await Affiliate.findOne({
      code: ref.trim(),
      status: "active",
    }).select("_id");
    if (aff) referredByAffiliate = aff._id;
  }

  const user = await User.create({
    name,
    email,
    password,
    phone,
    country: country || "Brasil",
    state,
    city,
    referredByAffiliate,
  });

  // envia a confirmacao (nao bloqueia o cadastro se falhar)
  await sendVerificationEmail({
    _id: user._id,
    name: user.name,
    email: user.email,
  });

  const token = signToken(user._id.toString());

  // recem-registrado ainda nao tem estabelecimento
  res.status(201).json({
    token,
    user: publicUser(user, false),
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
  if (!user) {
    res.status(401).json({ message: "Credenciais invalidas" });
    return;
  }
  // conta criada com Google nao tem senha: orienta a usar o botao do Google
  if (user.authProvider === "google" || !user.password) {
    res.status(409).json({
      message:
        'Esta conta foi criada com o Google. Toque em "Entrar com Google".',
      useGoogle: true,
    });
    return;
  }
  if (!(await user.comparePassword(password))) {
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
    user: publicUser(user, hasEstablishments),
  });
};

// monta o objeto de usuario publico no MESMO shape que login/register/google
// retornam (id, nao _id). Evita divergencia: sem isso, recarregar a pagina
// (que usa /me) traz _id e o front que espera `id` fica com id undefined.
const publicUser = (
  u: {
    _id: unknown;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    country?: string;
    state?: string;
    city?: string;
    councilType?: string;
    councilState?: string;
    councilNumber?: string;
    whatsappOptIn?: boolean;
    emailVerified: boolean;
    authProvider?: string;
  },
  hasEstablishments?: boolean
) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  avatar: u.avatar,
  country: u.country,
  state: u.state,
  city: u.city,
  councilType: u.councilType,
  councilState: u.councilState,
  councilNumber: u.councilNumber,
  whatsappOptIn: u.whatsappOptIn,
  emailVerified: u.emailVerified,
  // "google" = conta sem senha propria (front esconde "alterar senha")
  authProvider: u.authProvider || "local",
  ...(hasEstablishments !== undefined ? { hasEstablishments } : {}),
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

    const {
      name,
      phone,
      avatar,
      country,
      state,
      city,
      councilType,
      councilState,
      councilNumber,
    } = req.body;

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

    // registro profissional (para documentos). Normaliza conselho/UF em maiuscula.
    if (typeof councilType === "string")
      user.councilType = councilType.trim().toUpperCase();
    if (typeof councilState === "string")
      user.councilState = councilState.trim().toUpperCase();
    if (typeof councilNumber === "string")
      user.councilNumber = councilNumber.trim();
    if (typeof req.body.whatsappOptIn === "boolean")
      user.whatsappOptIn = req.body.whatsappOptIn;

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
    const { credential, ref } = req.body;

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
      // indicacao: se veio ?ref de afiliado/representante ativo, vincula.
      let referredByAffiliate: Types.ObjectId | null = null;
      if (typeof ref === "string" && ref.trim()) {
        const aff = await Affiliate.findOne({
          code: ref.trim(),
          status: "active",
        }).select("_id");
        if (aff) referredByAffiliate = aff._id;
      }
      // conta nova via Google: sem senha, ja verificada
      user = await User.create({
        name,
        email,
        authProvider: "google",
        googleId,
        avatar,
        emailVerified: true,
        country: "Brasil",
        referredByAffiliate,
      });
    }

    const token = signToken(user._id.toString());

    // mesmo criterio do login: manda dono/funcionario direto ao painel
    const hasEstablishments = !!(await Establishment.findOne({
      $or: [{ owner: user._id }, { "members.professional": user._id }],
    }).select("_id"));

    res.json({
      token,
      user: publicUser(user, hasEstablishments),
    });
  } catch (err) {
    console.error("googleAuth:", err);
    res.status(401).json({ message: "Falha na autenticacao com o Google" });
  }
};

// GET /api/auth/saved-card  (protegido) — cartao salvo do cliente (sem o token)
export const getSavedCard = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const user = await User.findById(req.userId).select("savedCard");
  const card = user?.savedCard;
  if (!card?.token) {
    res.json({ savedCard: null });
    return;
  }
  // NUNCA devolve o token; so o final e a bandeira para exibir
  res.json({ savedCard: { last4: card.last4, brand: card.brand } });
};

// DELETE /api/auth/saved-card  (protegido) — remove o cartao salvo
export const deleteSavedCard = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  await User.updateOne({ _id: req.userId }, { $unset: { savedCard: "" } });
  res.json({ removed: true });
};

// ---------------------------------------------------------------------------
// Recuperacao e troca de senha
// ---------------------------------------------------------------------------

const RESET_TTL_MINUTES = 30;

// data/hora em pt-BR (fuso de Brasilia) para os e-mails
const nowLabel = (): string =>
  new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });

// "gabriel@gmail.com" -> "ga*****@gmail.com" (mostra na tela de nova senha)
const maskEmail = (email: string): string => {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const keep = local.slice(0, Math.min(2, local.length));
  return `${keep}${"*".repeat(Math.max(3, local.length - keep.length))}@${domain}`;
};

// aviso de senha alterada (fire-and-forget: nunca bloqueia a resposta)
const notifyPasswordChanged = (user: { name: string; email: string }): void => {
  void sendEmail({
    to: user.email,
    subject: "Sua senha foi alterada — ServiçosPro",
    html: passwordChangedHtml({
      name: user.name,
      whenLabel: nowLabel(),
      forgotUrl: `${appUrl()}/esqueci-senha`,
    }),
  });
};

// gera o token, grava o hash e envia o link. Falha silenciosa.
// area = de onde veio o pedido: o link e o "voltar ao login" levam para a
// tela certa (login do app x login do afiliado/representante)
const sendPasswordResetEmail = async (
  user: {
    _id: unknown;
    name: string;
    email: string;
    password?: string;
  },
  area: "app" | "affiliate" = "app"
): Promise<void> => {
  const loginPath = area === "affiliate" ? "/afiliado/login" : "/login";
  const areaQuery = area === "affiliate" ? "?area=afiliado" : "";
  try {
    // conta so-Google nao tem senha: manda orientacao em vez de link
    if (!user.password) {
      await sendEmail({
        to: user.email,
        subject: "Acesso à sua conta — ServiçosPro",
        html: passwordResetGoogleHtml({
          name: user.name,
          loginUrl: `${appUrl()}${loginPath}`,
        }),
      });
      return;
    }

    // reaproveita o gerador do e-mail de verificacao (32 bytes + sha256).
    // Um pedido novo sobrescreve o anterior: so o ultimo link funciona.
    const { token, tokenHash } = generateEmailToken();
    const expiry = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

    await User.updateOne(
      { _id: user._id },
      { $set: { resetTokenHash: tokenHash, resetTokenExpiry: expiry } }
    );

    await sendEmail({
      to: user.email,
      subject: "Redefinir senha — ServiçosPro",
      html: passwordResetHtml({
        name: user.name,
        resetUrl: `${appUrl()}/redefinir-senha/${token}${areaQuery}`,
        minutes: RESET_TTL_MINUTES,
      }),
    });
  } catch (err) {
    console.error("sendPasswordResetEmail:", err);
  }
};

// POST /api/auth/forgot-password  (PUBLICO)  body: { email, area? }
// area: "affiliate" quando o pedido vem da area do afiliado/representante
// Resposta SEMPRE generica: nao revela se o e-mail tem conta (evita que
// alguem descubra quem e cliente do app testando e-mails).
export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  const generic = {
    message:
      "Se houver uma conta com este e-mail, enviaremos um link para redefinir a senha.",
  };
  try {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ message: "Informe um e-mail valido" });
      return;
    }

    const area = req.body?.area === "affiliate" ? "affiliate" : "app";

    const user = await User.findOne({ email }).select("+password");
    // fire-and-forget: o tempo de resposta nao depende do envio do e-mail
    if (user) {
      void sendPasswordResetEmail(
        {
          _id: user._id,
          name: user.name,
          email: user.email,
          password: user.password,
        },
        area
      );
    }
    res.json(generic);
  } catch (err) {
    console.error("forgotPassword:", err);
    res.json(generic);
  }
};

// GET /api/auth/reset-password/:token  (PUBLICO)
// valida o link antes de mostrar o formulario (evita digitar a senha a toa)
export const validateResetToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const tokenHash = hashEmailToken(String(req.params.token || ""));
    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpiry: { $gt: new Date() },
    }).select("email");

    if (!user) {
      res
        .status(410)
        .json({ message: "Este link expirou ou ja foi usado. Peca um novo." });
      return;
    }
    res.json({ valid: true, email: maskEmail(user.email) });
  } catch (err) {
    console.error("validateResetToken:", err);
    res.status(500).json({ message: "Erro ao validar o link" });
  }
};

// POST /api/auth/reset-password  (PUBLICO)  body: { token, password }
export const resetPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token, password } = req.body || {};
    if (typeof token !== "string" || !token) {
      res.status(400).json({ message: "Link invalido" });
      return;
    }
    const policyError = validatePassword(password);
    if (policyError) {
      res.status(400).json({ message: policyError });
      return;
    }

    // consome o token de forma ATOMICA: dois envios simultaneos do mesmo link
    // nao conseguem usa-lo duas vezes
    const tokenHash = hashEmailToken(token);
    const user = await User.findOneAndUpdate(
      { resetTokenHash: tokenHash, resetTokenExpiry: { $gt: new Date() } },
      { $unset: { resetTokenHash: 1, resetTokenExpiry: 1 } },
      { new: true }
    ).select("+password");

    if (!user) {
      res
        .status(410)
        .json({ message: "Este link expirou ou ja foi usado. Peca um novo." });
      return;
    }

    user.password = password; // o pre("save") faz o hash
    user.passwordChangedAt = new Date(); // derruba sessoes antigas
    // quem abriu o link do e-mail provou ser dono dele
    if (!user.emailVerified) {
      user.emailVerified = true;
      user.emailTokenHash = undefined;
      user.emailTokenExpiry = undefined;
    }
    await user.save();

    notifyPasswordChanged(user);
    res.json({ message: "Senha redefinida. Entre com a nova senha." });
  } catch (err) {
    console.error("resetPassword:", err);
    res.status(500).json({ message: "Erro ao redefinir a senha" });
  }
};

// POST /api/auth/change-password  (protegido)
// body: { currentPassword, newPassword }
// Devolve um token NOVO: o atual deixa de valer (assim como os de outros
// dispositivos), entao o front precisa trocar o que esta guardado.
// Erros usam 400 (nunca 401) — o front limpa a sessao ao receber 401.
export const changePassword = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    const user = await User.findById(req.userId).select("+password");
    if (!user) {
      res.status(404).json({ message: "Usuario nao encontrado" });
      return;
    }
    if (!user.password) {
      res.status(400).json({
        message: "Sua conta usa login com Google e nao tem senha propria.",
      });
      return;
    }
    if (typeof currentPassword !== "string" || !currentPassword) {
      res.status(400).json({ message: "Informe a senha atual" });
      return;
    }
    if (!(await user.comparePassword(currentPassword))) {
      res.status(400).json({ message: "Senha atual incorreta" });
      return;
    }

    const policyError = validatePassword(newPassword);
    if (policyError) {
      res.status(400).json({ message: policyError });
      return;
    }
    if (await user.comparePassword(newPassword)) {
      res
        .status(400)
        .json({ message: "A nova senha precisa ser diferente da atual" });
      return;
    }

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    // um link de "esqueci a senha" pendente deixa de valer
    user.resetTokenHash = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    notifyPasswordChanged(user);

    res.json({
      message: "Senha alterada com sucesso",
      token: signToken(user._id.toString()),
    });
  } catch (err) {
    console.error("changePassword:", err);
    res.status(500).json({ message: "Erro ao alterar a senha" });
  }
};
