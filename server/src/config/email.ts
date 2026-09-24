import { env } from "./env";

interface SendArgs {
  to: string;
  subject: string;
  html: string;
}

// envio via API HTTP da Brevo (sem SDK, funciona em qualquer versao).
// Nunca lanca: falha de email nao pode derrubar a operacao.
export const sendEmail = async ({
  to,
  subject,
  html,
}: SendArgs): Promise<{ sent: boolean }> => {
  if (!env.brevoApiKey) {
    console.log(
      `[email] BREVO_API_KEY ausente — email para ${to} NAO enviado (use o link copiavel).`
    );
    return { sent: false };
  }
  if (!env.emailFromAddress) {
    console.log(
      "[email] EMAIL_FROM_ADDRESS ausente — email nao enviado (configure o remetente)."
    );
    return { sent: false };
  }

  try {
    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.brevoApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: env.emailFromName, email: env.emailFromAddress },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      console.error(`[email] Brevo respondeu ${resp.status}: ${detail}`);
      return { sent: false };
    }

    return { sent: true };
  } catch (err) {
    console.error("[email] falha ao enviar:", err);
    return { sent: false };
  }
};

// Cabecalho da marca (icone "S" + nome) no topo de todos os e-mails.
// PNG hospedado no front (Gmail/Outlook nao exibem SVG). O CLIENT_URL precisa
// apontar para o dominio publico (servicospro.com) para a imagem carregar.
export const emailBrandHeader = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
      <tr>
        <td style="vertical-align: middle;">
          <img src="${env.clientUrl.replace(/\/$/, "")}/icon-192.png" width="36" height="36"
               alt="ServiçosPro" style="display: block; border-radius: 10px;" />
        </td>
        <td style="vertical-align: middle; padding-left: 10px; font-family: system-ui, sans-serif;
                   font-size: 20px; font-weight: 800; color: #0F1B1A;">
          Serviços<span style="color: #0E7C72;">Pro</span>
        </td>
      </tr>
    </table>`;

// template do convite de funcionario
export const inviteEmailHtml = (args: {
  establishmentName: string;
  professionalName: string;
  inviteUrl: string;
}): string => {
  const { establishmentName, professionalName, inviteUrl } = args;
  return `
  <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    ${emailBrandHeader}
    <h2 style="color: #0f766e; margin-bottom: 8px;">Você foi convidado</h2>
    <p style="color: #334155; line-height: 1.6;">
      Olá, ${professionalName}! O estabelecimento
      <strong>${establishmentName}</strong> convidou você para acessar a
      própria agenda no ServiçosPro.
    </p>
    <p style="color: #334155; line-height: 1.6;">
      Clique no botão abaixo para criar sua senha e começar:
    </p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${inviteUrl}"
         style="background: #14b8a6; color: #fff; text-decoration: none;
                padding: 12px 28px; border-radius: 12px; font-weight: 600;
                display: inline-block;">
        Aceitar convite
      </a>
    </div>
    <p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">
      Se o botão não funcionar, copie e cole este link no navegador:<br>
      <span style="color: #0f766e; word-break: break-all;">${inviteUrl}</span>
    </p>
    <p style="color: #94a3b8; font-size: 13px;">
      Este convite expira em 7 dias. Se você não esperava este e-mail, ignore-o.
    </p>
  </div>`;
};

// template de confirmacao de e-mail no cadastro
export const verifyEmailHtml = (args: {
  name: string;
  verifyUrl: string;
}): string => {
  const { name, verifyUrl } = args;
  return `
  <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    ${emailBrandHeader}
    <h2 style="color: #0f766e; margin-bottom: 8px;">Confirme seu e-mail</h2>
    <p style="color: #334155; line-height: 1.6;">
      Olá, ${name}! Falta pouco para concluir seu cadastro no ServiçosPro.
    </p>
    <p style="color: #334155; line-height: 1.6;">
      Confirme seu e-mail para receber lembretes de agendamento e avisos
      importantes:
    </p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${verifyUrl}"
         style="background: #14b8a6; color: #fff; text-decoration: none;
                padding: 12px 28px; border-radius: 12px; font-weight: 600;
                display: inline-block;">
        Confirmar meu e-mail
      </a>
    </div>
    <p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">
      Se o botão não funcionar, copie e cole este link no navegador:<br>
      <span style="color: #0f766e; word-break: break-all;">${verifyUrl}</span>
    </p>
    <p style="color: #94a3b8; font-size: 13px;">
      Este link expira em 24 horas. Se você não criou esta conta, ignore este e-mail.
    </p>
  </div>`;
};

// ---------------------------------------------------------------------------
// Templates de agendamento (Etapa B)
//
// Contexto comum passado pelo helper utils/bookingEmails.ts. A data/hora ja
// chega formatada em pt-BR (whenLabel) — a formatacao mora no helper para
// manter os templates burros (so montam HTML).
// ---------------------------------------------------------------------------

interface BookingEmailArgs {
  serviceTitle: string;
  establishmentName: string;
  whenLabel: string;
  professionalName?: string | null;
}

// links do app (reaproveita clientUrl do env)
const clientBookingsUrl = `${env.clientUrl}/agendamentos`;
const panelUrl = `${env.clientUrl}/painel`;

// bloco de botao reutilizavel (mantem o visual identico aos e-mails existentes)
const ctaButton = (href: string, label: string): string => `
    <div style="text-align: center; margin: 28px 0;">
      <a href="${href}"
         style="background: #14b8a6; color: #fff; text-decoration: none;
                padding: 12px 28px; border-radius: 12px; font-weight: 600;
                display: inline-block;">
        ${label}
      </a>
    </div>`;

// linha de detalhe (profissional so aparece se houver)
const detailBlock = (args: BookingEmailArgs): string => {
  const prof = args.professionalName
    ? `<p style="color: #334155; line-height: 1.6; margin: 4px 0;">
         <strong>Profissional:</strong> ${args.professionalName}
       </p>`
    : "";
  return `
    <div style="background: #f8fafc; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
      <p style="color: #334155; line-height: 1.6; margin: 4px 0;">
        <strong>Serviço:</strong> ${args.serviceTitle}
      </p>
      <p style="color: #334155; line-height: 1.6; margin: 4px 0;">
        <strong>Estabelecimento:</strong> ${args.establishmentName}
      </p>
      <p style="color: #334155; line-height: 1.6; margin: 4px 0;">
        <strong>Quando:</strong> ${args.whenLabel}
      </p>
      ${prof}
    </div>`;
};

const shell = (heading: string, inner: string): string => `
  <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    ${emailBrandHeader}
    <h2 style="color: #0f766e; margin-bottom: 8px;">${heading}</h2>
    ${inner}
    <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
      Você recebeu este e-mail porque tem uma conta no ServiçosPro.
    </p>
  </div>`;

// estabelecimento (dono + funcionario): novo agendamento
export const bookingCreatedEstablishmentHtml = (
  args: BookingEmailArgs
): string =>
  shell(
    "Novo agendamento",
    `
    <p style="color: #334155; line-height: 1.6;">
      Um cliente acabou de agendar. Confirme pelo painel quando puder.
    </p>
    ${detailBlock(args)}
    ${ctaButton(panelUrl, "Abrir painel")}
    `
  );

// cliente: estabelecimento confirmou
export const bookingConfirmedClientHtml = (args: BookingEmailArgs): string =>
  shell(
    "Agendamento confirmado",
    `
    <p style="color: #334155; line-height: 1.6;">
      Boa notícia! O estabelecimento confirmou seu agendamento.
    </p>
    ${detailBlock(args)}
    ${ctaButton(clientBookingsUrl, "Ver meus agendamentos")}
    `
  );

// cliente: estabelecimento cancelou
export const bookingCancelledClientHtml = (args: BookingEmailArgs): string =>
  shell(
    "Agendamento cancelado",
    `
    <p style="color: #334155; line-height: 1.6;">
      Seu agendamento foi cancelado pelo estabelecimento. Se precisar, você
      pode escolher um novo horário pelo app.
    </p>
    ${detailBlock(args)}
    ${ctaButton(clientBookingsUrl, "Ver meus agendamentos")}
    `
  );

// cliente: estabelecimento reagendou (whenLabel = novo horario)
export const bookingRescheduledClientHtml = (args: BookingEmailArgs): string =>
  shell(
    "Agendamento remarcado",
    `
    <p style="color: #334155; line-height: 1.6;">
      O estabelecimento remarcou seu agendamento. Confira o novo horário:
    </p>
    ${detailBlock(args)}
    ${ctaButton(clientBookingsUrl, "Ver meus agendamentos")}
    `
  );

// estabelecimento (dono + funcionario): cliente remarcou (whenLabel = novo horario)
export const bookingRescheduledEstablishmentHtml = (
  args: BookingEmailArgs
): string =>
  shell(
    "Agendamento remarcado pelo cliente",
    `
    <p style="color: #334155; line-height: 1.6;">
      Um cliente remarcou o próprio agendamento. Veja o novo horário:
    </p>
    ${detailBlock(args)}
    ${ctaButton(panelUrl, "Abrir painel")}
    `
  );

// cliente: lembrete de agendamento proximo
export const bookingReminderClientHtml = (args: BookingEmailArgs): string =>
  shell(
    "Lembrete do seu agendamento",
    `
    <p style="color: #334155; line-height: 1.6;">
      Passando para lembrar do seu horário. Aqui estão os detalhes:
    </p>
    ${detailBlock(args)}
    ${ctaButton(clientBookingsUrl, "Ver meus agendamentos")}
    `
  );

// estabelecimento (dono + funcionario): lembrete de agendamento proximo
export const bookingReminderEstablishmentHtml = (
  args: BookingEmailArgs
): string =>
  shell(
    "Lembrete de agendamento",
    `
    <p style="color: #334155; line-height: 1.6;">
      Um atendimento está chegando. Confira:
    </p>
    ${detailBlock(args)}
    ${ctaButton(panelUrl, "Abrir painel")}
    `
  );

// cliente: convite para avaliar o atendimento (link de 1 toque, sem login)
export const reviewRequestClientHtml = (args: {
  establishmentName: string;
  serviceTitle: string;
  reviewUrl: string;
}): string =>
  shell(
    "Como foi seu atendimento?",
    `
    <p style="color: #334155; line-height: 1.6;">
      Sua opini\u00e3o ajuda muito o <strong>${args.establishmentName}</strong> —
      e leva menos de 10 segundos. \u00c9 s\u00f3 tocar em uma estrela:
    </p>
    <div style="background: #f8fafc; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
      <p style="color: #334155; line-height: 1.6; margin: 4px 0;">
        <strong>Servi\u00e7o:</strong> ${args.serviceTitle}
      </p>
    </div>
    ${ctaButton(args.reviewUrl, "\u2b50 Avaliar agora")}
    `
  );

// ---------------------------------------------------------------------------
// Seguranca da conta: recuperacao e troca de senha
// ---------------------------------------------------------------------------

// escapa texto vindo do usuario (nome) antes de montar o HTML
const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// link de redefinicao (usuario com senha)
export const passwordResetHtml = (args: {
  name: string;
  resetUrl: string;
  minutes: number;
}): string =>
  shell(
    "Redefinir sua senha",
    `
    <p style="color: #334155; line-height: 1.6;">
      Olá, ${esc(args.name)}! Recebemos um pedido para redefinir a senha da
      sua conta no ServiçosPro.
    </p>
    ${ctaButton(args.resetUrl, "Criar nova senha")}
    <p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">
      Se o botão não funcionar, copie e cole este link no navegador:<br>
      <span style="color: #0f766e; word-break: break-all;">${args.resetUrl}</span>
    </p>
    <p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">
      O link vale por ${args.minutes} minutos e só pode ser usado uma vez.
      Se não foi você, ignore este e-mail — sua senha continua a mesma.
    </p>
    `
  );

// conta criada com Google (sem senha): orienta a entrar com o Google
export const passwordResetGoogleHtml = (args: {
  name: string;
  loginUrl: string;
}): string =>
  shell(
    "Sua conta usa o Google",
    `
    <p style="color: #334155; line-height: 1.6;">
      Olá, ${esc(args.name)}! Recebemos um pedido para redefinir a senha, mas
      sua conta foi criada com o Google e não tem senha própria.
    </p>
    <p style="color: #334155; line-height: 1.6;">
      Para entrar, use o botão <strong>"Entrar com Google"</strong>.
    </p>
    ${ctaButton(args.loginUrl, "Ir para o login")}
    <p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">
      Se não foi você que pediu, ignore este e-mail.
    </p>
    `
  );

// aviso de que a senha foi alterada (alerta contra acesso indevido)
export const passwordChangedHtml = (args: {
  name: string;
  whenLabel: string;
  forgotUrl: string;
}): string =>
  shell(
    "Sua senha foi alterada",
    `
    <p style="color: #334155; line-height: 1.6;">
      Olá, ${esc(args.name)}! A senha da sua conta no ServiçosPro foi alterada
      em <strong>${args.whenLabel}</strong>. Por segurança, as sessões em
      outros dispositivos foram encerradas.
    </p>
    <p style="color: #334155; line-height: 1.6;">
      <strong>Não foi você?</strong> Redefina a senha agora mesmo:
    </p>
    ${ctaButton(args.forgotUrl, "Redefinir senha")}
    `
  );
