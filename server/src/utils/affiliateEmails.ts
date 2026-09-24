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
}): void {
  const acao = args.renewed ? "renovou" : "pagou";
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
        O valor cai direto na sua conta Asaas — confira e saque por lá.
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
