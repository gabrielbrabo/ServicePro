import { LegalDocument } from "../components/LegalDocument";
import { COMPANY, LegalSection } from "../lib/legal";

// Politica de Privacidade do ServiçosPro (LGPD — Lei 13.709/2018).
// ATENCAO: modelo redigido a partir do funcionamento real do sistema. Deve ser
// REVISADO POR UM ADVOGADO antes da publicacao. Ao alterar o texto, troque a
// LEGAL_VERSION (client/src/lib/legal.ts e server/src/config/legal.ts).

const C = COMPANY;

const sections: LegalSection[] = [
  {
    title: "Quem é o responsável pelos seus dados",
    blocks: [
      `O ${C.brand} é operado por ${C.legalName}, CNPJ ${C.cnpj}, ${C.address}.`,
      `Nos dados da sua conta e do uso da plataforma (cadastro, login, buscas, agendamentos feitos por você, assinaturas, programa de afiliados), o ${C.brand} é o controlador.`,
      `Nos dados que um estabelecimento registra sobre os próprios clientes e pacientes (fichas, prontuários, anamneses, fotos de antes/depois, documentos, ordens de serviço), o estabelecimento é o controlador e o ${C.brand} é o operador: tratamos esses dados apenas para prestar o serviço ao estabelecimento, conforme as instruções dele. Pedidos sobre esses dados devem ser feitos primeiro ao estabelecimento.`,
      `Encarregado pelo tratamento de dados (DPO): ${C.dpoName} — ${C.dpoEmail}.`,
    ],
  },
  {
    title: "Quais dados coletamos",
    blocks: [
      [
        "Cadastro: nome, e-mail, telefone, estado, cidade, senha (guardada apenas como hash criptográfico, nunca em texto) e foto de perfil, se você enviar.",
        "Login com Google: nome, e-mail, foto e identificador da conta Google, quando você escolhe essa opção.",
        "Localização: a cidade informada e, quando você autoriza no navegador ou digita um endereço, a localização usada para mostrar estabelecimentos por distância. Estabelecimentos informam o endereço do negócio.",
        "Agendamentos: serviço, data, horário, profissional, observações, status, lembretes e avaliações.",
        "Pagamentos: valores, status das cobranças e, se você salvar um cartão, apenas um identificador (token), a bandeira e os últimos 4 dígitos. O número completo do cartão fica com o parceiro de pagamentos.",
        "Estabelecimentos e afiliados: dados do negócio e, para abrir a conta de recebimento, CPF/CNPJ, data de nascimento, endereço e telefone exigidos pelo parceiro de pagamentos.",
        "Dados registrados pelos estabelecimentos sobre seus clientes: fichas técnicas, fórmulas, fotos, termos de consentimento e, na área de Saúde, dados de saúde (prontuário, anamnese, evolução, sinais vitais, documentos clínicos), que são dados pessoais sensíveis.",
        "Dados técnicos e de segurança: registros de acesso, endereço IP, navegador, data e hora do aceite destes documentos e trilha de auditoria de acesso a dados de pacientes.",
      ],
    ],
  },
  {
    title: "Para que usamos os dados",
    blocks: [
      [
        "Criar e manter sua conta, autenticar o acesso e proteger contra fraudes e acessos indevidos.",
        "Mostrar estabelecimentos por categoria e distância e permitir agendamentos.",
        "Enviar confirmações, lembretes e avisos por e-mail e, se você autorizar, por WhatsApp.",
        "Processar assinaturas, pagamentos, sinais e comissões de afiliados.",
        "Oferecer aos estabelecimentos as ferramentas de gestão (agenda, caixa, fichas, prontuários, documentos).",
        "Cumprir obrigações legais e regulatórias e exercer direitos em processos.",
        "Melhorar a plataforma e atender suas solicitações de suporte.",
      ],
      "Não vendemos dados pessoais.",
    ],
  },
  {
    title: "Bases legais (LGPD)",
    blocks: [
      [
        "Execução de contrato: para prestar o serviço que você contratou ou solicitou (conta, agendamentos, assinatura, programa de afiliados).",
        "Cumprimento de obrigação legal ou regulatória: registros fiscais, guarda de documentos e prontuários pelos prazos legais.",
        "Legítimo interesse: segurança, prevenção a fraudes e melhoria da plataforma, sempre respeitando seus direitos.",
        "Consentimento: avisos por WhatsApp e demais situações em que ele for pedido; você pode revogá-lo a qualquer momento.",
        "Dados de saúde: tratados pelos profissionais e estabelecimentos de saúde para a tutela da saúde, conforme o art. 11 da LGPD e as normas de cada profissão; o ServiçosPro atua como operador.",
        "Exercício regular de direitos em processos judiciais, administrativos ou arbitrais.",
      ],
    ],
  },
  {
    title: "Com quem compartilhamos",
    blocks: [
      "Compartilhamos apenas o necessário para o serviço funcionar, com parceiros que tratam os dados em nosso nome ou para a finalidade indicada:",
      [
        "Estabelecimentos: quando você agenda, o estabelecimento recebe seu nome, contato e os dados do agendamento.",
        "Asaas: processamento de pagamentos, assinaturas, sinais e repasse de comissões.",
        "Amazon Web Services (AWS): armazenamento de fotos e arquivos.",
        "Provedores de hospedagem e banco de dados: onde a plataforma e os dados ficam armazenados.",
        "Brevo: envio de e-mails.",
        "Meta (WhatsApp Business): envio de avisos por WhatsApp, quando autorizado.",
        "Google: login com a conta Google, quando você escolhe essa opção.",
        "Clicksign: assinatura digital de documentos, quando o estabelecimento usa esse recurso.",
        "Serviços de mapas e endereços (OpenStreetMap/Photon): sugestão e localização de endereços.",
        "Sentry: monitoramento de erros técnicos da plataforma, sem envio de dados pessoais como nome, e-mail, senha, documentos ou dados de saúde.",
        "Autoridades públicas, quando houver obrigação legal ou ordem judicial.",
      ],
    ],
  },
  {
    title: "Transferência internacional",
    blocks: [
      "Alguns parceiros (como provedores de nuvem, e-mail e mensagens) podem armazenar ou processar dados fora do Brasil. Nesses casos, adotamos parceiros que oferecem garantias de proteção compatíveis com a LGPD.",
    ],
  },
  {
    title: "Por quanto tempo guardamos",
    blocks: [
      "Mantemos os dados enquanto sua conta estiver ativa e pelo tempo necessário para as finalidades desta política. Depois, os dados são excluídos ou anonimizados, exceto quando a lei exigir a guarda por mais tempo, por exemplo:",
      [
        "Registros de acesso à aplicação: no mínimo 6 meses (Marco Civil da Internet).",
        "Dados fiscais e de pagamentos: pelos prazos da legislação tributária.",
        "Prontuários e registros de saúde: pelos prazos definidos pelas normas das profissões de saúde, sob responsabilidade do estabelecimento controlador.",
      ],
    ],
  },
  {
    title: "Seus direitos",
    blocks: [
      "Conforme o art. 18 da LGPD, você pode pedir:",
      [
        "Confirmação de que tratamos seus dados e acesso a eles.",
        "Correção de dados incompletos, inexatos ou desatualizados (boa parte pode ser feita direto no seu perfil).",
        "Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade.",
        "Portabilidade dos dados a outro fornecedor.",
        "Eliminação dos dados tratados com base no consentimento e informação sobre as consequências de negá-lo.",
        "Informação sobre com quem compartilhamos seus dados.",
        "Revogação do consentimento, como desativar os avisos por WhatsApp no seu perfil.",
      ],
      `Para exercer seus direitos, escreva para ${C.dpoEmail}. Responderemos no prazo legal. Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).`,
    ],
  },
  {
    title: "Segurança",
    blocks: [
      [
        "Senhas armazenadas apenas como hash criptográfico.",
        "Links de confirmação e de recuperação de senha com validade curta e uso único.",
        "Troca de senha encerra as sessões nos outros dispositivos.",
        "Limite de tentativas de login e de recuperação de senha.",
        "Controle de acesso por papel (dono, profissional, secretária) e trilha de auditoria de acesso a dados de pacientes na área de Saúde.",
        "Comunicação criptografada (HTTPS).",
      ],
      "Nenhum sistema é 100% invulnerável. Em caso de incidente de segurança que possa gerar risco ou dano relevante, comunicaremos os titulares afetados e a ANPD, conforme a lei.",
    ],
  },
  {
    title: "Cookies e armazenamento no navegador",
    blocks: [
      "Usamos o armazenamento local do navegador para manter você conectado (token de acesso), lembrar preferências (como tema claro/escuro e a área em uso) e guardar o código de indicação de afiliado até o cadastro. Não usamos cookies de publicidade de terceiros.",
      "Você pode limpar esses dados nas configurações do navegador; nesse caso, será preciso entrar novamente.",
    ],
  },
  {
    title: "Crianças e adolescentes",
    blocks: [
      "As contas do ServiçosPro são destinadas a maiores de 18 anos. Dados de crianças e adolescentes podem ser registrados por estabelecimentos (por exemplo, em atendimentos de saúde ou aulas), sob responsabilidade do estabelecimento e com o consentimento de um dos pais ou responsável legal, no melhor interesse da criança ou do adolescente.",
    ],
  },
  {
    title: "Alterações desta política e contato",
    blocks: [
      "Podemos atualizar esta política. A data da última atualização fica no topo desta página e, em mudanças relevantes, pediremos seu aceite novamente.",
      `Dúvidas sobre privacidade: ${C.dpoEmail}. Demais assuntos: ${C.contactEmail}.`,
    ],
  },
];

export function PrivacyPage() {
  return (
    <LegalDocument
      title="Política de Privacidade"
      intro={`Esta política explica quais dados pessoais o ${C.brand} coleta, para que usa, com quem compartilha, por quanto tempo guarda e quais são os seus direitos, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018).`}
      sections={sections}
      other={{ to: "/termos", label: "Termos de Uso →" }}
    />
  );
}
