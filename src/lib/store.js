/**
 * store.js — chrome.storage.local com defaults. Tudo que o usuário edita mora aqui.
 *
 * O token NÃO fica aqui de propósito (só em memória, ver bus.js).
 */

/**
 * Pergunta acrescentada ao pedido de dados: saber de quais grupos políticos a pessoa já
 * participa é o que abre acesso a eles. Fica separada porque a migração
 * (`templates.migrarPerguntaGrupos`) precisa do mesmo texto para acrescentar ao template que
 * já estava salvo no navegador.
 */
export const PERGUNTA_GRUPOS =
  'Ah, e me conta: você já faz parte de algum grupo político no WhatsApp? ' +
  'Se sim, me manda o nome ou o link — assim consigo somar por lá também. 🇧🇷';

export const DEFAULT_TEMPLATES = [
  {
    // Sem {{primeiro_nome}} de propósito: esta é justamente a mensagem que você manda ANTES
    // de saber o nome, quando o contato ainda está cadastrado como "[NOVO] (51) 9...".
    id: 'pedir-dados',
    name: 'Pedir dados (formato fixo)',
    text:
      '{{saudacao}}! Que bom ter você com a gente. 🇧🇷\n\n' +
      'Para eu te incluir no grupo certo da sua região, me responde nesta ordem, em uma única mensagem:\n\n' +
      'Nome completo / Cidade\n\n' +
      '(exemplo: Maria Silva / Santo Ângelo)\n\n' +
      PERGUNTA_GRUPOS,
  },
  {
    id: 'tema-opcoes',
    name: 'Perguntar o tema (opções numeradas)',
    text:
      'Só mais uma, {{primeiro_nome}}: responda com o número que mais combina com você.\n\n' +
      '1 - Quero receber material impresso\n' +
      '2 - Sou apoiador e quero ajudar bastante\n' +
      '3 - Sou apoiador e ajudo quando posso\n' +
      '4 - Só quero acompanhar de longe',
  },
  {
    id: 'link-grupo',
    name: 'Enviar link do grupo',
    text:
      'Prontinho, {{primeiro_nome}}! Este é o grupo de {{cidade}}:\n\n' +
      '{{link_grupo}}\n\n' +
      'É lá que a gente avisa das agendas e manda os conteúdos primeiro. Te espero! 🇧🇷',
  },
  {
    id: 'agradecimento',
    name: 'Agradecer e encerrar',
    text:
      'Obrigado pela atenção, {{primeiro_nome}}! Qualquer coisa, é só chamar por aqui. ' +
      'Um abraço e conte com a gente. 🇧🇷',
  },
  {
    /**
     * Pedido de dinheiro, cesta, remédio, passagem.
     *
     * Sem `{{primeiro_nome}}` de propósito: quem pede ajuda muitas vezes escreve antes de dizer
     * o nome, e este é o texto que NÃO pode ficar bloqueado esperando variável.
     *
     * A recusa se apoia na lei em vez de na vontade do gabinete — é verdade e tira o peso
     * pessoal do não. Base: Lei 9.504/97, art. 41-A (captação ilícita de sufrágio, que cita
     * expressamente dinheiro e emprego) e art. 73, §10 (distribuição gratuita de bens em ano
     * eleitoral). O caminho indicado é o SUAS: CRAS, Cadastro Único e os benefícios eventuais
     * da Lei 8.742/93 (LOAS), que existem justamente para nascimento, falecimento,
     * vulnerabilidade temporária e calamidade.
     */
    id: 'pedido-ajuda',
    name: 'Pedido de ajuda financeira (negar com respeito)',
    text:
      '{{saudacao}}! Obrigado por confiar na gente para falar de uma situação difícil. ' +
      'Li com atenção.\n\n' +
      'Preciso te responder com sinceridade: um mandato não pode doar dinheiro, cestas, ' +
      'remédios ou qualquer bem a eleitores. Não é falta de vontade — a lei eleitoral proíbe, ' +
      'e vale para todos os gabinetes, o ano inteiro.\n\n' +
      'O caminho certo para esse apoio é a assistência social do seu município, que é gratuita ' +
      'e feita para isso:\n\n' +
      '• CRAS do seu bairro — orienta e faz o seu Cadastro Único\n' +
      '• Secretaria de Assistência Social da prefeitura\n' +
      '• Em caso de nascimento, falecimento, calamidade ou vulnerabilidade temporária, existem ' +
      'os benefícios eventuais, previstos em lei\n\n' +
      'Se você já procurou e não foi atendido, me conta o que aconteceu. Aí sim é trabalho ' +
      'nosso: cobrar o poder público e encaminhar a sua situação a quem tem o dever de resolver.',
  },
  {
    /**
     * Saudação de abertura. Teor católico a pedido do Thiago — o Capitão Martim é religioso.
     *
     * Termina sem pergunta de propósito: convite a responder vira atendimento, e o gabinete não
     * tem braço para o volume que isso geraria. A mensagem entrega o afeto e fecha.
     */
    id: 'saudacao-fe',
    name: 'Saudação com mensagem de fé',
    text:
      '{{saudacao}}, {{primeiro_nome}}! Que Deus abençoe o seu dia e a sua família. 🙏\n\n' +
      'Que Nossa Senhora interceda por você e por quem você ama.',
  },
  {
    /**
     * Para quem mandou vídeo, link, "bom dia" — mensagem que merece resposta mas não abre
     * demanda. Agradece e fecha.
     *
     * Sem pergunta no fim, pela mesma razão da saudação de fé: convite a responder vira
     * atendimento, e o volume é do gabinete.
     */
    id: 'agradecer-info',
    name: 'Agradecer a mensagem e encerrar',
    text:
      '{{saudacao}}, {{primeiro_nome}}! Obrigado pela mensagem e pelas informações — ' +
      'recebemos tudo por aqui.\n\n' +
      'Seguimos juntos. Que Deus abençoe você e sua família! 🙏',
  },
  {
    /**
     * Para quem está em "Meus" sem nenhuma etiqueta de conteúdo: nunca disse o que quer receber,
     * então nenhuma regra casa e não há modelo a enviar. Esta pergunta transforma o silêncio em
     * um sim ou um não.
     *
     * Sem `{{primeiro_nome}}` de propósito. Metade destes contatos ainda está cadastrada com o
     * apelido do anúncio, e variável que não resolve tira a opção da pergunta da rodada — foi
     * assim que o fluxo já travou duas vezes. Uma pergunta que sempre pode sair vale mais aqui
     * do que o nome no vocativo.
     */
    id: 'interesse-conteudo',
    name: 'Perguntar interesse no conteúdo',
    text:
      '{{saudacao}}! Aqui é da equipe do Capitão Martim e do Zucco. 🇧🇷\n\n' +
      'Posso te mandar por aqui os conteúdos e as novidades deles?\n\n' +
      'Me responde só *sim* ou *não* — do jeito que você preferir, eu respeito.',
  },
  {
    id: 'sem-interesse',
    name: 'Sem interesse / encerrar com respeito',
    text:
      'Sem problema, {{primeiro_nome}}! Agradeço o retorno e não vou mais te incomodar. ' +
      'Se mudar de ideia, é só mandar uma mensagem aqui. Um abraço!',
  },
];

const DEFAULTS = {
  templates: DEFAULT_TEMPLATES,
  /** { "santo angelo": "https://chat.whatsapp.com/..." } — chave sempre normalizada. */
  cityLinks: {},
  /** Usado quando a cidade não tem grupo próprio. Vazio = bloqueia o envio. */
  defaultGroupLink: '',
  settings: {
    autoSend: false, // começa desligado de propósito: primeiro teste você faz no seu número
    throttleMs: 1500,
    antiDup: true,
    autoTags: true, // sugerir etiqueta de região e de conteúdo já marcadas
    /**
     * Grava sozinho, ao abrir o contato, só o que é determinístico (cidade exata do IBGE, o
     * COREDE dela, etiquetas de conteúdo). O resto continua esperando confirmação.
     */
    autoApply: true,
    panelOpen: true, // painel encaixado visível
    dockWidth: 380, // largura do painel encaixado, ajustável pelo puxador
  },

  /**
   * Aba Automatizado: a rodada de tentativa de contato com quem não respondeu.
   *
   * `templateId` é o modelo APROVADO (HSM) escolhido para a rodada — nunca uma resposta pronta:
   * quem está sem retorno há dias tem a janela de 24h vencida, e só modelo aprovado chega.
   * `limite` e `pausaSeg` existem para o envio não sair em rajada: número real, gente real.
   */
  auto: {
    templateId: '',
    templateName: '',
    limite: 20,
    pausaSeg: 8,
    /**
     * Rodada dos Novos: trecho que identifica o aceite do anúncio ("Olá! Eu aceito receber
     * conteúdos do Fulano e do Cap Martim"). Guardado sem o nome do candidato de propósito —
     * a campanha muda o anúncio e a frase vale para todos eles.
     */
    padraoNovos: 'aceito receber conte',
    /**
     * A mensagem da ocasião — Dia dos Pais, Natal, uma data da campanha. É a tecla 5 da
     * pergunta, e fica aqui em vez de virar resposta pronta porque muda toda semana: o valor é
     * editar no lugar onde a rodada começa, sem passar pela aba Config.
     *
     * Vazia = a tecla 5 não aparece.
     */
    mensagemMomento: '',
  },

  /**
   * Regras de etiqueta por conteúdo: padrão (regex, sem diferenciar maiúscula) casado contra
   * as mensagens do contato e a campanha do anúncio. Editável na aba Config.
   */
  tagRules: [
    { padrao: 'zucco', etiqueta: 'Conteúdo Zucco' },
    { padrao: 'fl[áa]vio', etiqueta: 'Conteúdo Flávio' },
  ],

  /**
   * Etiqueta de conteúdo → nome do MODELO DE MENSAGEM aprovado que atende aquele pedido.
   * Chave normalizada. É o que fecha o atendimento: o contato pediu conteúdo do Zucco, a
   * etiqueta "Conteúdo Zucco" casou, e daqui sai qual modelo enviar.
   * Editável na aba Config; vazio = o painel não adivinha e pede para você escolher.
   */
  contentTemplates: {},

  /**
   * Qual conteúdo vence quando a mensagem casa com mais de uma regra.
   *
   * Empate é comum porque as regras também são casadas contra a campanha do anúncio: anúncio
   * que cita dois nomes faz o contato casar com os dois sem ter pedido nada. As etiquetas
   * continuam sendo aplicadas todas — isto decide só qual modelo enviar.
   */
  conteudoPreferido: 'Conteúdo Flávio',

  /**
   * Etiquetas aplicadas quando o contato responde SIM à pergunta de interesse no conteúdo
   * (resposta "interesse-conteudo", tecla 7 da rodada).
   *
   * Vazio de propósito: o rótulo tem que ser o nome exato da etiqueta no CRM, e chutar aqui
   * grava etiqueta errada em eleitor real. Enquanto estiver vazio, a rodada envia a pergunta
   * normalmente e diz na tela que o "sim" não vai virar etiqueta até isto ser preenchido.
   */
  etiquetasInteresse: [],

  /**
   * Apelidos: nome do COREDE (ou qualquer rótulo) → nome exato da etiqueta no CRM. Só é
   * preciso quando o nome não casa nem ignorando acento e pontuação. O painel grava aqui
   * sozinho quando você escolhe a etiqueta à mão.
   */
  tagAliases: {
    'paranhana encosta da serra': 'Vale do Paranhana',
  },
  /** Contrato de escrita aprendido pelo gravador (Fase 0). Null = ainda não aprendido. */
  writeContract: null,
  /** { "<contactId>|<templateId>": timestamp } para o aviso de duplicata. */
  sentLog: {},
  /**
   * Migrações já aplicadas, uma vez cada. Sem isto, uma migração que mexe em texto editável
   * desfaria a sua edição toda vez que o painel subisse.
   */
  migracoes: {},
  /** Cache da lista de municípios do RS (IBGE). */
  municipios: null,
  /**
   * Número que o contato responde → nome da opção real de "Tema de Interesse".
   * Precisa casar com a numeração do template "tema-opcoes": se você mexer no texto do
   * template, ajuste aqui também.
   */
  temaByNumber: {
    1: 'Aceitou receber material impresso',
    2: 'Apoiador Muito engajado',
    3: 'Apoiador Engajado',
    4: 'Apoiador não engajado',
  },
  /** Dicionários do parser, editáveis. */
  dicts: {
    funcao: [
      'vereador', 'vereadora', 'prefeito', 'prefeita', 'vice-prefeito', 'deputado', 'deputada',
      'presidente de bairro', 'presidente', 'secretário', 'secretaria', 'assessor', 'assessora',
      'voluntário', 'voluntária', 'apoiador', 'apoiadora', 'coordenador', 'coordenadora',
      'militar', 'veterano', 'policial', 'bombeiro', 'agricultor', 'produtor rural',
      'empresário', 'empresária', 'professor', 'professora', 'caminhoneiro', 'CAC',
    ],
    partido: ['PL', 'PP', 'MDB', 'PSDB', 'PT', 'PDT', 'PSD', 'REPUBLICANOS', 'NOVO', 'PODE', 'UNIÃO', 'PRD', 'PSB', 'PCdoB', 'PV', 'PSOL', 'AVANTE', 'SOLIDARIEDADE', 'CIDADANIA', 'AGIR', 'MOBILIZA', 'DC', 'PRTB'],
  },
};

/**
 * Recarregar a extensão deixa as abas abertas com o content script órfão: qualquer
 * chrome.storage joga "Extension context invalidated" e o painel passa a falhar em silêncio
 * (caixas vazias, ações que não acontecem). Isso já custou diagnóstico errado — então o erro
 * vira uma frase que diz o que fazer.
 */
export const PRECISA_F5 =
  'A extensão foi recarregada e esta aba ficou para trás. Dê F5 na aba do mobiliza para o painel voltar a funcionar.';

function traduzErro(err) {
  if (/context invalidated/i.test(err?.message || '')) return new Error(PRECISA_F5);
  return err;
}

export async function get(key) {
  let stored;
  try {
    stored = await chrome.storage.local.get(key);
  } catch (err) {
    throw traduzErro(err);
  }
  if (stored[key] === undefined) return structuredClone(DEFAULTS[key]);
  // Mescla settings/dicts para que chaves novas de versões futuras não fiquem faltando.
  if (key === 'settings' || key === 'dicts' || key === 'temaByNumber' || key === 'tagAliases' || key === 'auto') {
    return { ...structuredClone(DEFAULTS[key]), ...stored[key] };
  }
  return stored[key];
}

export async function set(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (err) {
    throw traduzErro(err);
  }
}

export async function getAll() {
  const keys = Object.keys(DEFAULTS);
  const out = {};
  for (const k of keys) out[k] = await get(k);
  return out;
}

/** Export/import para você não perder os templates ao trocar de máquina. */
export async function exportJson() {
  const data = await getAll();
  delete data.municipios; // cache, se refaz sozinho
  delete data.sentLog;
  return JSON.stringify(data, null, 2);
}

export async function importJson(text) {
  const data = JSON.parse(text);
  const allowed = [
    'templates', 'cityLinks', 'defaultGroupLink', 'settings', 'writeContract', 'dicts',
    'temaByNumber', 'tagRules', 'tagAliases', 'contentTemplates', 'auto',
  ];
  for (const key of allowed) {
    if (data[key] !== undefined) await set(key, data[key]);
  }
}
