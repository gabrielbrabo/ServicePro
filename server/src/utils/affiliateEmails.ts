import { sendEmail, emailBrandHeader } from "../config/email";
import { env } from "../config/env";

// E-mails do programa de afiliados/representantes. Padrao fire-and-forget: nunca
// bloqueiam a resposta do webhook e nunca lancam (sendEmail ja engole erros).

const brl = (cents: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((cents || 0) / 100);

const panelUrl = `${env.clientUrl.replace(/\/$/, "")}/afiliado`;

const ctaButton = (href: string, label: string): string => `
    <div style="text-align: center; margin: 28px 0;">
      <a href="${href}"
         style="background: #14b8a6; color: #fff; text-decoration: none;
                padding: 12px 28px; border-radius: 12px; font-weight: 600;
                display: inline-block;">
        ${label}
      </a>
    </div>`;

const shell = (heading: string, inner: string): string => `
  <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    ${emailBrandHeader}
    <h2 style="color: #0f766e; margin-bottom: 8px;">${heading}</h2>
    ${inner}
    <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
      Você recebeu este e-mail como afiliado/representante do ServiçosPro.
    </p>
  </div>`;

// Comissao recebida: o indicado pagou ou renovou o plano.
export function sendCommissionReceivedEmail(args: {
  to: string;
  establishmentName: string;
  planName: string;
  commissionCents: number;
  renewed: boolean;
  // entrou sem split (conta de recebimento ainda nao ativa): fica a repassar
  pending?: boolean;
}): void {
  const acao = args.renewed ? "renovou" : "pagou";
  const where = args.pending
    ? "O valor fica guardado e é repassado para a sua conta Asaas assim que ela for ativada e aprovada. Ative pelo e-mail que o Asaas enviou."
    : "O valor cai direto na sua conta Asaas — confira e saque por lá.";
  const html = shell(
    "Você recebeu uma comissão! 🎉",
    `
    <p style="color: #334155; line-height: 1.6;">
      O estabelecimento <strong>${args.establishmentName}</strong> ${acao} o
      plano <strong>${args.planName}</strong>.
    </p>
    <div style="background: #f0fdfa; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
      <p style="color: #0f766e; line-height: 1.6; margin: 4px 0; font-size: 18px;">
        <strong>Sua comissão: ${brl(args.commissionCents)}</strong>
      </p>
      <p style="color: #334155; line-height: 1.6; margin: 4px 0; font-size: 14px;">
        ${where}
      </p>
    </div>
    ${ctaButton(panelUrl, "Ver meu painel")}
    `
  );

  // fire-and-forget: nao esperamos o envio
  void sendEmail({
    to: args.to,
    subject: `Comissão recebida — ${args.establishmentName}`,
    html,
  });
}

// Nao renovou: a assinatura do indicado venceu sem pagamento.
export function sendNonRenewalEmail(args: {
  to: string;
  establishmentName: string;
}): void {
  const html = shell(
    "Um indicado não renovou",
    `
    <p style="color: #334155; line-height: 1.6;">
      O estabelecimento <strong>${args.establishmentName}</strong> venceu a
      assinatura e não renovou. Enquanto ele não voltar a pagar, você não recebe
      a comissão dessa indicação.
    </p>
    <p style="color: #334155; line-height: 1.6;">
      Se ele voltar a pagar, a comissão volta automaticamente.
    </p>
    ${ctaButton(panelUrl, "Ver meu painel")}
    `
  );

  void sendEmail({
    to: args.to,
    subject: `Um indicado não renovou — ${args.establishmentName}`,
    html,
  });
}

// Conta de recebimento aberta: o 1o indicado assinou e abrimos a subconta
// Asaas do afiliado. Ele precisa ativar pelo e-mail do Asaas para sacar.
export function sendAffiliateAccountOpenedEmail(args: {
  to: string;
  establishmentName: string;
}): void {
  const html = shell(
    "Seu primeiro indicado assinou! 🎉",
    `
    <p style="color: #334155; line-height: 1.6;">
      O estabelecimento <strong>${args.establishmentName}</strong> assinou o
      ServiçosPro pela sua indicação.
    </p>
    <p style="color: #334155; line-height: 1.6;">
      Abrimos a sua <strong>conta de recebimento no Asaas</strong>, onde caem as
      suas comissões. Para liberar os saques:
    </p>
    <ol style="color: #334155; line-height: 1.7; padding-left: 20px;">
      <li>Abra o <strong>e-mail do Asaas</strong> e crie o seu acesso.</li>
      <li>Envie os <strong>documentos</strong> pedidos para a aprovação.</li>
    </ol>
    <p style="color: #334155; line-height: 1.6;">
      Nenhuma comissão se perde: o que entrar antes da aprovação é repassado
      para você assim que a conta for aprovada.
    </p>
    ${ctaButton(panelUrl, "Ver meu painel")}
    `
  );
  void sendEmail({
    to: args.to,
    subject: "Seu primeiro indicado assinou — ative sua conta de recebimento",
    html,
  });
}

// Repasse feito: comissoes que entraram antes da aprovacao foram transferidas.
export function sendAffiliatePayoutEmail(args: {
  to: string;
  valueCents: number;
}): void {
  const html = shell(
    "Comissões repassadas para você 💰",
    `
    <p style="color: #334155; line-height: 1.6;">
      Sua conta Asaas foi aprovada e repassamos as comissões que estavam
      guardadas:
    </p>
    <div style="background: #f0fdfa; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
      <p style="color: #0f766e; margin: 4px 0; font-size: 18px;">
        <strong>${brl(args.valueCents)}</strong>
      </p>
    </div>
    <p style="color: #334155; line-height: 1.6;">
      A partir de agora as comissões caem direto na sua conta Asaas a cada
      pagamento dos seus indicados.
    </p>
    ${ctaButton(panelUrl, "Ver meu painel")}
    `
  );
  void sendEmail({
    to: args.to,
    subject: "Comissões repassadas para a sua conta Asaas",
    html,
  });
}

// A abertura da conta de recebimento foi recusada pelo Asaas (ex.: CEP
// invalido): o afiliado corrige os dados no painel e a conta e aberta.
export function sendAffiliateAccountDataEmail(args: {
  to: string;
  reason: string;
}): void {
  const html = shell(
    "Corrija seus dados de recebimento",
    `
    <p style="color: #334155; line-height: 1.6;">
      Um estabelecimento indicado por você já pagou o plano, mas não
      conseguimos abrir a sua conta de recebimento no Asaas:
    </p>
    <div style="background: #fef2f2; border-radius: 12px; padding: 14px 18px; margin: 16px 0;">
      <p style="color: #b91c1c; margin: 0; font-size: 15px;">${args.reason}</p>
    </div>
    <p style="color: #334155; line-height: 1.6;">
      Entre no seu painel, corrija os dados e salve — a conta é aberta na hora.
      Suas comissões ficam guardadas e nada se perde.
    </p>
    ${ctaButton(panelUrl, "Corrigir meus dados")}
    `
  );
  void sendEmail({
    to: args.to,
    subject: "Ação necessária: corrija seus dados de recebimento",
    html,
  });
}
