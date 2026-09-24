import { LegalDocument } from "../components/LegalDocument";
import { COMPANY, LegalSection } from "../lib/legal";

// Termos de Uso do ServiçosPro.
// ATENCAO: modelo redigido a partir do funcionamento real do sistema. Deve ser
// REVISADO POR UM ADVOGADO antes da publicacao. Ao alterar o texto, troque a
// LEGAL_VERSION (client/src/lib/legal.ts e server/src/config/legal.ts).

const C = COMPANY;

const sections: LegalSection[] = [
  {
    title: "Quem somos e o que é o ServiçosPro",
    blocks: [
      `O ${C.brand} (${C.site}) é uma plataforma operada por ${C.legalName}, inscrita no CNPJ ${C.cnpj}, com sede em ${C.address} ("${C.brand}", "nós").`,
      "A plataforma conecta pessoas que procuram serviços (clientes) a estabelecimentos e profissionais que prestam esses serviços, permitindo busca por categoria e localização, agendamento online e, para os estabelecimentos, ferramentas de gestão (agenda, equipe, caixa, comissões, fichas e prontuários, ordens de serviço, entre outras).",
      `O ${C.brand} fornece a tecnologia. Os serviços anunciados e prestados (corte de cabelo, consulta, conserto, aula etc.) são de responsabilidade exclusiva do estabelecimento ou profissional que os oferece.`,
    ],
  },
  {
    title: "Aceite destes Termos",
    blocks: [
      "Ao criar uma conta ou usar a plataforma, você declara que leu, entendeu e concorda com estes Termos de Uso e com a Política de Privacidade. Se não concordar, não utilize o ServiçosPro.",
      "O aceite é registrado com data, hora e versão do documento. Quando os Termos forem alterados de forma relevante, pediremos um novo aceite no seu próximo acesso.",
    ],
  },
  {
    title: "Tipos de usuário",
    blocks: [
      [
        "Cliente: pessoa que procura, agenda e avalia serviços.",
        "Estabelecimento (dono): pessoa física ou jurídica que cadastra o negócio, contrata um plano e administra o painel.",
        "Profissional/funcionário e secretária(o): pessoas convidadas pelo estabelecimento, com acesso limitado ao que o dono permitir.",
        "Afiliado/representante: pessoa que indica estabelecimentos ao ServiçosPro e recebe comissão sobre as assinaturas indicadas (seção 9).",
      ],
      "Uma mesma conta pode acumular mais de um papel (por exemplo, dono e afiliado).",
    ],
  },
  {
    title: "Cadastro e segurança da conta",
    blocks: [
      "Para criar uma conta você precisa ter pelo menos 18 anos e fornecer informações verdadeiras e atualizadas. Você pode entrar com e-mail e senha ou com a sua conta Google.",
      "Você é responsável por manter sua senha em sigilo e por toda atividade feita na sua conta. Se suspeitar de acesso indevido, altere a senha imediatamente (a troca encerra as sessões em outros dispositivos) e nos avise.",
      "Podemos pedir a confirmação do seu e-mail e limitar tentativas repetidas de login ou de recuperação de senha, por segurança.",
    ],
  },
  {
    title: "Agendamentos",
    blocks: [
      "O agendamento é um compromisso entre o cliente e o estabelecimento. Horários, preços, duração, políticas de cancelamento, remarcação e eventual cobrança de sinal são definidos pelo estabelecimento e exibidos antes da confirmação.",
      "O ServiçosPro envia lembretes e avisos (e-mail e, quando autorizado, WhatsApp) como apoio, mas não garante que todas as mensagens sejam entregues. Você pode desativar os avisos por WhatsApp no seu perfil.",
      "Faltas, atrasos, cancelamentos e a qualidade do serviço prestado são de responsabilidade das partes envolvidas no agendamento.",
    ],
  },
  {
    title: "Pagamentos feitos pelos clientes (sinal e serviços)",
    blocks: [
      "Quando o estabelecimento habilita o recebimento pelo app, o pagamento do cliente (Pix ou cartão) é processado pelo parceiro de pagamentos Asaas e repassado à conta de recebimento do estabelecimento.",
      "Dados de cartão são tratados pelo parceiro de pagamentos. O ServiçosPro não armazena o número completo do cartão; guarda apenas um identificador (token), a bandeira e os últimos 4 dígitos, para facilitar pagamentos futuros quando o cliente escolher salvar o cartão. O cartão salvo pode ser removido a qualquer momento.",
      "Reembolsos e devoluções de valores pagos ao estabelecimento seguem a política do próprio estabelecimento e a legislação aplicável, inclusive o Código de Defesa do Consumidor.",
    ],
  },
  {
    title: "Planos e assinatura dos estabelecimentos",
    blocks: [
      "O uso do painel de gestão pelo estabelecimento depende de uma assinatura. O preço é definido pela área do estabelecimento (Beleza e bem-estar, Saúde ou Serviços gerais) e informado no momento da contratação, em ciclo mensal ou anual.",
      "A assinatura é renovada automaticamente ao fim de cada ciclo, na mesma modalidade, até ser cancelada. Recursos adicionais (funcionários acima dos incluídos no plano e pacotes extras de galeria) são cobrados à parte, conforme valores exibidos antes da compra.",
      "Se o pagamento não for confirmado, o painel pode ser bloqueado até a regularização. Os agendamentos já existentes continuam visíveis e os dados não são apagados por causa do bloqueio.",
      "O estabelecimento pode cancelar a assinatura a qualquer momento; o acesso segue até o fim do período já pago. Podemos alterar preços mediante aviso prévio, valendo o novo valor a partir do ciclo seguinte.",
      "Quando o contratante for consumidor, ficam preservados os direitos previstos no Código de Defesa do Consumidor, inclusive o direito de arrependimento em até 7 dias da contratação feita pela internet.",
    ],
  },
  {
    title: "Responsabilidades do estabelecimento",
    blocks: [
      [
        "Manter informações verdadeiras sobre serviços, preços, endereço, horários e profissionais.",
        "Possuir as licenças, registros profissionais e autorizações exigidas para a sua atividade (por exemplo, conselho de classe na área de saúde e alvarás sanitários).",
        "Tratar os dados dos seus clientes e pacientes de acordo com a LGPD e com as normas da sua profissão, inclusive o sigilo profissional.",
        "Obter dos clientes as autorizações necessárias, como o consentimento para uso de imagem e para procedimentos, quando aplicável.",
        "Administrar os acessos da sua equipe e remover o acesso de quem deixar o estabelecimento.",
      ],
      "Nos dados que o estabelecimento registra sobre os próprios clientes e pacientes (fichas, prontuários, fotos, anamneses, documentos), o estabelecimento é o controlador e o ServiçosPro atua como operador, seguindo suas instruções, conforme a Política de Privacidade.",
      "Documentos emitidos pela plataforma (atestados, receitas, declarações, contratos, ordens de serviço, laudos, certificados e termos de garantia) têm conteúdo de responsabilidade exclusiva do profissional que os emite.",
    ],
  },
  {
    title: "Programa de afiliados e representantes",
    blocks: [
      "O afiliado divulga o ServiçosPro usando o seu link de indicação. Quando um estabelecimento indicado assina um plano, o afiliado recebe comissão sobre os pagamentos dessa assinatura, no percentual informado no painel do afiliado, enquanto a assinatura estiver ativa e paga.",
      "A comissão é repassada automaticamente pelo parceiro de pagamentos a uma conta de recebimento em nome do afiliado, que precisa ser aprovada (verificação de identidade e documentos) antes de o link ser liberado. Saques, prazos e tarifas dessa conta seguem as regras do parceiro de pagamentos.",
      "Não há comissão sobre pagamentos não realizados, estornados ou cancelados. A participação no programa não gera vínculo empregatício, societário ou de representação exclusiva.",
      "É proibido usar spam, propaganda enganosa, se passar pelo ServiçosPro ou indicar a si mesmo de forma fraudulenta. Nesses casos, a conta de afiliado pode ser suspensa e as comissões indevidas, canceladas.",
    ],
  },
  {
    title: "Avaliações e conteúdo publicado",
    blocks: [
      "Clientes podem avaliar atendimentos. As avaliações devem ser verdadeiras e respeitosas. Podemos remover avaliações ou conteúdos falsos, ofensivos, discriminatórios, que exponham dados de terceiros ou que violem a lei.",
      "Ao publicar fotos, textos e outros conteúdos (por exemplo, na galeria do estabelecimento), você declara ter os direitos sobre eles e nos autoriza a exibi-los na plataforma para a finalidade do serviço.",
    ],
  },
  {
    title: "Condutas proibidas",
    blocks: [
      [
        "Usar a plataforma para atividades ilegais ou para oferecer serviços proibidos.",
        "Criar agendamentos falsos, contas falsas ou se passar por outra pessoa.",
        "Tentar acessar dados ou contas de terceiros, burlar mecanismos de segurança ou sobrecarregar os sistemas.",
        "Copiar, revender ou explorar comercialmente a plataforma sem autorização.",
      ],
    ],
  },
  {
    title: "Propriedade intelectual",
    blocks: [
      "A marca ServiçosPro, o logotipo, o software, o layout e os materiais da plataforma pertencem aos seus titulares e são protegidos por lei. O uso da plataforma não transfere nenhum desses direitos a você.",
    ],
  },
  {
    title: "Disponibilidade e limitação de responsabilidade",
    blocks: [
      "Trabalhamos para manter a plataforma disponível e segura, mas podem ocorrer interrupções para manutenção, falhas de terceiros (internet, provedores de hospedagem, e-mail, WhatsApp, pagamentos) ou eventos fora do nosso controle.",
      "Na extensão permitida pela lei, o ServiçosPro não responde pela prestação dos serviços agendados, por acordos entre clientes e estabelecimentos, por lucros cessantes ou por decisões tomadas com base em informações publicadas por usuários.",
    ],
  },
  {
    title: "Suspensão e encerramento",
    blocks: [
      "Você pode encerrar sua conta a qualquer momento pelos nossos canais de contato. Podemos suspender ou encerrar contas que violem estes Termos, a lei ou que coloquem outros usuários em risco.",
      "Após o encerramento, os dados são tratados conforme a Política de Privacidade, podendo ser mantidos pelo prazo exigido por lei (por exemplo, registros fiscais e prontuários).",
    ],
  },
  {
    title: "Alterações destes Termos",
    blocks: [
      "Podemos atualizar estes Termos para refletir melhorias na plataforma ou mudanças legais. A data da última atualização fica no topo desta página e, em mudanças relevantes, pediremos o seu aceite novamente.",
    ],
  },
  {
    title: "Lei aplicável, foro e contato",
    blocks: [
      `Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de ${C.forum} para resolver eventuais disputas, ressalvado o direito do consumidor de propor a ação no foro do seu domicílio.`,
      `Dúvidas, solicitações ou reclamações: ${C.contactEmail}.`,
    ],
  },
];

export function TermsPage() {
  return (
    <LegalDocument
      title="Termos de Uso"
      intro={`Estes Termos de Uso explicam as regras para usar o ${C.brand}: o que a plataforma faz, as responsabilidades de cada tipo de usuário, como funcionam os agendamentos, os pagamentos, as assinaturas e o programa de afiliados.`}
      sections={sections}
      other={{ to: "/privacidade", label: "Política de Privacidade →" }}
    />
  );
}
