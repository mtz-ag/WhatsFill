/**
 * ia.js — a avaliação de contexto, para escolher entre as respostas que já existem.
 *
 * **O que ela faz, e o que ela NUNCA faz.** Ela lê a conversa e responde uma pergunta fechada:
 * *qual das respostas prontas se aplica, ou isto é para o Thiago ver?* Ela **não escreve texto
 * para eleitor**. O que sai do painel continua sendo, byte a byte, um texto que ele escreveu e
 * revisou — a IA só escolhe qual. Essa fronteira é o que torna o custo do erro recuperável: o
 * pior caso é a resposta pronta errada, não uma frase inventada num mandato.
 *
 * **Por que existe, se já há o `triagem.js`.** O determinístico pega o previsível; ele não pega
 * o pedido de ajuda escrito de um jeito que ninguém antecipou. Foi a razão dele:
 * *"muito arriscado só pelo determinístico, tem que avaliar o contexto"*. Os dois se somam, nesta
 * ordem: a regex decide primeiro (de graça, e nunca deixa passar o caso conhecido) e a IA entra
 * só quando a regex não encontrou nada. Ordem que é a mais barata E a mais segura.
 *
 * **As travas moram aqui, não no prompt.** Prompt é pedido; `validarDecisao` é regra. Um modelo
 * que devolva um id inventado, ou que escolha a resposta de negar ajuda financeira, não consegue
 * fazer o painel enviar nada — a validação rebaixa para "incerto" ou força a escalada. Ver
 * `RESTRITOS`.
 *
 * Sem dependência e sem rede: quem chama passa o transporte. É o que permite testar a decisão
 * inteira offline, e é o que mantém a **chave da API fora da página** — a requisição sai do
 * service worker, nunca do painel (`page-hook.js` roda no mundo do Angular do mobiliza, e o que
 * está na página a plataforma lê).
 */

/**
 * A única dependência deste arquivo, e ela é um DOCUMENTO, não código: o padrão de atendimento que
 * ele escreveu (06/09/2026). `atendimento.js` é puro como este — sem rede, sem `chrome` —, então a
 * propriedade que importa continua de pé: dá para testar a decisão inteira offline.
 */
import * as atendimento from './atendimento.js';

/**
 * O modelo padrão.
 *
 * **Haiku 4.5 por escolha dele** (29/08: *"vou testar com o haiku somente, os outros tem custo
 * alto"*). Padrão importa mais do que parece: ligar a IA com o Opus 5 embaixo custaria ~4× o
 * que ele escolheu, e o padrão é o que roda em quem nunca abriu o seletor.
 *
 * Consequência a lembrar: o Haiku **não cacheia** este prompt (ver `CACHE_MINIMO_TOKENS`), então
 * "SEM CACHE" no log é o esperado aqui, não defeito.
 */
export const MODELO_PADRAO = 'claude-haiku-4-5';

/** Abaixo disto a decisão não é recomendada: vira "incerto" e ele decide como antes. */
export const CONFIANCA_MINIMA = 0.7;

/**
 * Respostas que a IA pode SUGERIR mas nunca disparar sozinha.
 *
 * São as de risco jurídico (Lei 9.504/97): negar ajuda financeira e negar pedido de emprego.
 * Escolher uma delas é, na prática, a IA dizendo "isto é um pedido de ajuda" — e esse caso vai
 * para ele, com a sugestão junto. É a mesma regra do `triagem.js`, aplicada ao caminho da IA.
 */
export const RESTRITOS = ['pedido-ajuda', 'pedido-emprego'];

/**
 * O esquema que a resposta do modelo tem que satisfazer.
 *
 * Structured outputs em vez de "por favor devolva JSON": o formato deixa de ser algo que pode
 * dar errado numa conversa fora do comum. A validação abaixo continua existindo — o esquema
 * garante a FORMA, não que o `templateId` seja um id que existe.
 */
export function esquemaDaDecisao(idsPermitidos) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['acao', 'motivo', 'confianca'],
    properties: {
      acao: {
        type: 'string',
        enum: ['responder', 'escalar'],
        description: 'responder = uma das respostas prontas serve; escalar = o Thiago responde em pessoa',
      },
      templateId: {
        type: 'string',
        enum: idsPermitidos,
        description: 'O id da resposta pronta. Obrigatório quando acao = responder.',
      },
      motivo: {
        type: 'string',
        description: 'Uma frase curta, em português, dizendo por quê. Vai aparecer na tela para o Thiago.',
      },
      confianca: {
        type: 'number',
        description: 'De 0 a 1. Abaixo de 0,7 o painel trata como incerto e pergunta como sempre.',
      },
    },
  };
}

/**
 * O prompt de sistema — a parte que **não muda entre contatos**, e por isso é a parte cacheada.
 *
 * Ordem importa para o cache: o que é estável vem primeiro e o que varia fica no `messages`.
 * Ver `montarRequisicao`.
 */
export function montarSistema({ templates = [], regras = '', gabinete = '' } = {}) {
  const catalogo = templates
    .map((t) => `- id: ${t.id}\n  nome: ${t.name}\n  texto: ${umaLinha(t.text)}`)
    .join('\n');

  return [
    'Você ajuda no atendimento de WhatsApp de um mandato parlamentar no Rio Grande do Sul.',
    '',
    'Sua tarefa é ESCOLHER, não escrever. Leia o que o contato mandou e diga qual das respostas',
    'prontas abaixo atende — ou diga que o caso é para uma pessoa responder.',
    '',
    'Regras que valem sempre:',
    '',
    '1. Você NUNCA redige mensagem. Só escolhe entre os ids listados.',
    '2. Na dúvida, escale. Uma escalada custa um contato na fila dele; uma resposta pronta errada',
    '   vai para um eleitor real e não dá para desfazer.',
    '3. ESCALE SEMPRE, sem exceção, quando a pessoa pede dinheiro, cesta básica, remédio, ajuda',
    '   com contas, passagem, emprego, ou relata dificuldade pessoal. Um mandato não pode doar, e',
    '   essa conversa precisa de cuidado humano.',
    '4. ESCALE quando o contato RELATA UM PROBLEMA: irregularidade, denúncia, obra parada, fila,',
    '   atendimento negado, programa público que não funcionou. Isso é o trabalho do mandato e',
    '   precisa de uma pessoa lendo. Nenhuma resposta pronta serve, e material de campanha em cima',
    '   de uma denúncia é o pior que pode sair daqui.',
    '5. Cuidado com "ajuda": quem diz "quero ajudar", "posso ajudar", "conte comigo" é APOIADOR se',
    '   oferecendo, e é o público principal. Não é pedido de ajuda.',
    '6. Se o contato só respondeu o formulário (nome e cidade), ou só mandou uma saudação, ou',
    '   agradeceu, escolha a resposta pronta que corresponde — não escale por ser simples.',
    '7. Se duas respostas servirem, escolha a mais específica. Se nenhuma servir, escale.',
    '',
    /**
     * Quem é quem, antes das instruções: é contexto, não ordem.
     *
     * Vem do `store.ia.gabinete` e existe para a IA **não precisar adivinhar** sobre nomes da
     * chapa, números de urna e pautas do mandato. Sem isto ela decide sobre pessoas que não
     * conhece — e decidir sobre nome desconhecido é onde uma escolha errada nasce.
     *
     * Está no prompt de sistema, que é o cacheado: custa uma vez e 10% nas seguintes.
     */
    gabinete ? `Quem é quem neste mandato (informação do gabinete — use-a como fonte e não invente o que não estiver aqui):\n${gabinete}\n` : '',
    regras ? `Instruções adicionais do Thiago:\n${regras}\n` : '',
    'Respostas prontas disponíveis:',
    '',
    catalogo,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

/** O bloco que descreve ESTE contato. É a parte que muda, e por isso fica fora do cache. */
/**
 * **O relógio da conversa — e por que ele mora no bloco do CONTATO.**
 *
 * Relato dele (04/09/2026): *"a IA está sem acesso à data e hora atual, pelo visto; botei nos
 * comandos extras da IA para ver a data e hora atual mas não mudou nada"*.
 *
 * Ele estava certo nas duas metades. **Nada no prompt levava data nenhuma** — nem "agora", nem
 * quando cada mensagem chegou —, e as instruções extras dele vão para o prompt de SISTEMA, que é
 * texto: mandar o modelo "ver a hora" não dá hora a ele. Modelo de linguagem não tem relógio.
 *
 * **Fica no bloco do contato de propósito.** O sistema leva `cache_control: ephemeral`, e o cache
 * vale enquanto o prefixo for idêntico — pôr o horário lá dentro invalidaria o cache a cada
 * chamada, que é a diferença entre 10% e 100% do preço de entrada. O bloco do contato muda a cada
 * contato de qualquer jeito.
 *
 * O formato é RELATIVO ("hoje 11:29", "ontem 18:07") porque é assim que a decisão dele é tomada —
 * *"responder o conteúdo de ontem soa a quem não estava lá"* —, e porque é mais curto que a data
 * inteira em toda linha.
 */
function relogio(agora) {
  const d = agora instanceof Date ? agora : agora ? new Date(agora) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** O dia local, para comparar "mesmo dia" sem passar por fuso. */
function diaLocal(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function horaCurta(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Quando esta mensagem chegou, em relação a agora: `hoje 11:29`, `ontem 18:07`, `02/09 13:35`.
 *
 * Sem hora na mensagem devolve string vazia — histórico antigo não tem `createdAt`, e inventar um
 * horário seria pior que não ter: a IA passaria a raciocinar sobre um dado falso.
 */
export function quandoFoi(at, agora) {
  if (!at) return '';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';

  const hoje = relogio(agora);
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);

  if (diaLocal(d) === diaLocal(hoje)) return `hoje ${horaCurta(d)}`;
  if (diaLocal(d) === diaLocal(ontem)) return `ontem ${horaCurta(d)}`;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${horaCurta(d)}`;
}

/** A linha de "agora" que abre o bloco do contato. */
export function agoraEmPortugues(agora) {
  const d = relogio(agora);
  const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const data = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return `Agora são ${horaCurta(d)} de ${dias[d.getDay()]}, ${data}.`;
}

/**
 * A saudação certa AGORA — calculada aqui, não deduzida pelo modelo.
 *
 * Print dele (04/09/2026): o rascunho saiu com *"Boa noite!"* às 16:21. Ele: *"já tinha falado para
 * checar hora e data atual antes de formular mensagem"*.
 *
 * **Pedir ao modelo que "confira a hora" não é o conserto** — é a mesma armadilha registrada em
 * 04/09: instrução no prompt é pedido, e o que ele tinha na frente era a última mensagem dela
 * marcada `ontem 20:21`. Saudação é mecânica: hora do relógio, três faixas. Então o código diz
 * qual é, e o código conserta se vier outra.
 */
export function saudacaoDeAgora(agora) {
  const h = relogio(agora).getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** As três, para reconhecer a errada no começo do rascunho. */
const SAUDACAO_NO_COMECO = /^\s*(bom\s+dia|boa\s+tarde|boa\s+noite)\b/i;

export function montarContato({ mensagens = [], campos = {}, etiquetas = [], agora } = {}) {
  /**
   * Cada mensagem leva QUANDO chegou — ver `quandoFoi`. Sem isso, saber "agora" não serve de nada:
   * o modelo continuaria sem poder dizer se a conversa é desta manhã ou da semana passada.
   *
   * Aceita string solta (como sempre foi) e `{texto, at}`.
   */
  const linhas = (mensagens || []).map((m) => (typeof m === 'string' ? { texto: m } : m || {}));
  const conversa = linhas.length
    ? linhas
        .map((m, i) => {
          const q = quandoFoi(m.at, agora);
          return `${i + 1}. ${q ? `[${q}] ` : ''}${umaLinha(m.texto, 600)}`;
        })
        .join('\n')
    : '(o contato ainda não escreveu nada)';

  const cadastro = Object.entries(campos)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');

  return [
    agoraEmPortugues(agora),
    '',
    'Mensagens recebidas do contato, da mais antiga para a mais recente:',
    '',
    conversa,
    '',
    `Cadastro: ${cadastro || '(vazio)'}`,
    `Etiquetas que ele já tem: ${etiquetas.length ? etiquetas.join(', ') : '(nenhuma)'}`,
  ].join('\n');
}

/**
 * O corpo da requisição.
 *
 * `cache_control` no fim do sistema: o catálogo de respostas e as regras são idênticos em toda
 * chamada (~3.700 tokens medidos), e a partir da segunda custam 10% do preço. Sem isso a conta
 * é 3,5× maior — é a diferença entre trocados e uma despesa que se discute.
 *
 * `effort: 'low'` e `max_tokens` com folga por causa do Opus 5: **ele pensa por padrão**, o
 * pensamento é cobrado como saída (US$ 25/MTok) e cabe DENTRO do `max_tokens`. Com o teto de 512
 * que estava aqui, o raciocínio consumia a cota e o JSON saía truncado — chamada paga que vira
 * `incerto`, sem nada na tela dizendo por quê. Escolher entre respostas prontas é classificação,
 * e classificação não precisa de esforço alto: `low` é o que corta a maior parte da conta.
 */
/**
 * Modelos que aceitam `output_config.effort`.
 *
 * **Lista de permissão, não de bloqueio**: o Haiku 4.5 RECUSA o parâmetro com 400, e a lista
 * inversa faria todo modelo futuro nascer quebrado até alguém notar. Quem não está aqui roda
 * sem `effort` — que é o padrão do modelo, não uma degradação.
 */
const MODELOS_COM_ESFORCO = new Set(['claude-opus-5', 'claude-sonnet-5', 'claude-fable-5']);

/**
 * Prefixo mínimo, em tokens, para o `cache_control` valer alguma coisa em cada modelo.
 *
 * **Abaixo do mínimo o cache não dá erro: ele simplesmente não acontece**, e `cacheLido` volta
 * zero para sempre. Como o painel ensina que "SEM CACHE em chamadas seguidas" é sinal de
 * problema, o Haiku produziria esse alarme em 100% das chamadas sendo que está tudo certo — o
 * prompt de sistema tem ~1.300 tokens (medido em 29/08, com as 11 respostas de fábrica) e o
 * mínimo do Haiku 4.5 é 4.096. Ele nem chega perto.
 *
 * O mínimo **não cresce com a geração**: 512 no Opus 5, 1.024 no Sonnet 5, 4.096 no Haiku 4.5.
 * Por isso é tabela, e não uma regra do tipo "modelo novo cacheia".
 */
export const CACHE_MINIMO_TOKENS = {
  'claude-opus-5': 512,
  'claude-sonnet-5': 1024,
  'claude-haiku-4-5': 4096,
};

/** Tamanho aproximado do prompt de sistema hoje, em tokens. Português: ~3,5 chars por token. */
export function tokensAproximados(texto) {
  return Math.round(String(texto || '').length / 3.5);
}

/**
 * O `cache_control` deste prompt vai pegar neste modelo?
 *
 * Serve para a tela poder dizer a verdade em vez de alarme falso. Modelo fora da tabela: assume
 * que sim — o alarme existe para o caso conhecido, e alarme por desconhecimento treina a ignorar.
 */
export function vaiCachear(modelo, tokensDoSistema) {
  const min = CACHE_MINIMO_TOKENS[modelo];
  return min === undefined ? true : tokensDoSistema >= min;
}

/** `output_config` com `effort` só onde ele é aceito. */
function saida(modelo, esforco, format) {
  return MODELOS_COM_ESFORCO.has(modelo) ? { effort: esforco, format } : { format };
}
export function montarRequisicao({ sistema, contato, ids, modelo = MODELO_PADRAO }) {
  return {
    model: modelo,
    max_tokens: 2048,
    system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: contato }],
    output_config: saida(modelo, 'low', { type: 'json_schema', schema: esquemaDaDecisao(ids) }),
  };
}

/**
 * A resposta do modelo virando decisão do painel — **com as travas**.
 *
 * Toda saída que não seja claramente boa vira `incerto`, e `incerto` significa "o painel se
 * comporta como antes da IA existir": a caixa da rodada pergunta como sempre. Nenhum caminho
 * daqui produz envio sem que ele veja.
 *
 * @param {object|string} bruto o JSON devolvido pelo modelo (ou o texto que veio)
 * @param {string[]} idsPermitidos ids das respostas prontas que existem de verdade
 * @returns {{acao:'responder'|'escalar'|'incerto', templateId:string, motivo:string,
 *            confianca:number, aviso:string}}
 */
export function validarDecisao(bruto, idsPermitidos = []) {
  const vazio = { acao: 'incerto', templateId: '', motivo: '', confianca: 0, aviso: '' };

  let d = bruto;
  if (typeof d === 'string') {
    try {
      d = JSON.parse(d);
    } catch (_) {
      return { ...vazio, aviso: 'a IA respondeu num formato que não deu para ler' };
    }
  }
  if (!d || typeof d !== 'object') return { ...vazio, aviso: 'a IA não devolveu decisão' };

  const motivo = String(d.motivo || '').trim().slice(0, 300);
  const confianca = Number.isFinite(d.confianca) ? Math.min(1, Math.max(0, d.confianca)) : 0;
  const templateId = String(d.templateId || '').trim();

  if (d.acao === 'escalar') {
    // Escalada não tem confiança mínima: "não sei" e "isto é para você" levam ao mesmo lugar, e
    // exigir certeza para escalar seria exigir certeza para ter dúvida.
    return { acao: 'escalar', templateId: idsPermitidos.includes(templateId) ? templateId : '', motivo, confianca, aviso: '' };
  }

  if (d.acao !== 'responder') return { ...vazio, motivo, aviso: 'a IA não disse o que fazer' };

  if (!idsPermitidos.includes(templateId)) {
    // Id inventado. Acontece, e é exatamente o que a validação existe para conter.
    return { ...vazio, motivo, aviso: `a IA escolheu uma resposta que não existe ("${templateId}")` };
  }

  if (RESTRITOS.includes(templateId)) {
    /**
     * A IA escolheu negar ajuda financeira ou emprego. Isso não é "responder" — é o diagnóstico
     * de que o caso é sensível. Vira escalada, com a sugestão junto, e o texto só sai se ele
     * mandar. É a trava que o prompt sozinho não daria.
     */
    return {
      acao: 'escalar',
      templateId,
      motivo: motivo || 'é pedido de ajuda ou de emprego',
      confianca,
      aviso: '',
    };
  }

  if (confianca < CONFIANCA_MINIMA) {
    return { ...vazio, motivo, confianca, aviso: `a IA ficou em ${Math.round(confianca * 100)}% de certeza` };
  }

  return { acao: 'responder', templateId, motivo, confianca, aviso: '' };
}

// ---------------------------------------------------------------------------
// Cidade — a IA confere o palpite do parser, e não pode inventar município
// ---------------------------------------------------------------------------

/**
 * A conferência da cidade, para a rodada automática não parar num popup.
 *
 * **Por que isto existe.** Nenhuma cidade de palpite vai para o CRM sem confirmação — regra dele,
 * e ela continua de pé. O que muda é QUEM confirma quando ele não está olhando: com a rodada
 * automatizada, a caixa "Está correta?" travava a fila esperando um clique que ninguém ia dar.
 *
 * **O que a IA pode fazer aqui é menos do que parece.** Ela não escolhe resposta, não escreve e
 * não fala com ninguém: confere um campo. E o nome que ela devolve não vai para o CRM como ela
 * escreveu — `validarCidade` o troca pelo nome OFICIAL do IBGE ou recusa. Município inventado não
 * tem como passar: ele não está na lista.
 */
export function esquemaDaCidade() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['acao', 'motivo', 'confianca'],
    properties: {
      acao: {
        type: 'string',
        enum: ['aceitar', 'corrigir', 'semcidade'],
        description:
          'aceitar = a cidade encontrada está certa; corrigir = a conversa diz outra; ' +
          'semcidade = a conversa não diz onde a pessoa mora',
      },
      cidade: {
        type: 'string',
        description: 'Só quando acao = corrigir. O nome do município do RS, sozinho, sem estado.',
      },
      motivo: {
        type: 'string',
        description: 'Uma frase curta, em português, dizendo por quê. Vai para o log da rodada.',
      },
      confianca: { type: 'number', description: 'De 0 a 1. Abaixo de 0,7 o painel não grava nada.' },
    },
  };
}

/**
 * O prompt de sistema da conferência — estável entre contatos, como o da decisão.
 *
 * As regras aqui são as mesmas que o `cities.js` aplica na marra, escritas em português: cidade
 * citada de passagem não é a cidade da pessoa, nome de estado não é município, e na dúvida não
 * grava. Elas estão no prompt para a IA ACERTAR mais; quem impede o erro é `validarCidade`.
 */
export function montarSistemaCidade({ regras = '' } = {}) {
  return [
    'Você confere um dado de cadastro no atendimento de WhatsApp de um mandato parlamentar no',
    'Rio Grande do Sul.',
    '',
    'Um programa leu a conversa e achou que a cidade do contato é a que vai abaixo. Sua tarefa é',
    'dizer se ele acertou. Você não escolhe resposta, não escreve mensagem e não fala com',
    'ninguém: só confere um campo.',
    '',
    'Regras que valem sempre:',
    '',
    '1. Só existe município do Rio Grande do Sul, e só serve nome que você LEU na conversa.',
    '   Nome que você deduziu de outra coisa é invenção — nesse caso responda "semcidade".',
    '2. Cidade citada de passagem NÃO é a cidade da pessoa: "meu genro mora em Santiago", "vou a',
    '   Gramado no domingo", "tenho parentes em Pelotas". Isso é "semcidade".',
    '3. É a cidade dela quando ela diz "sou de X", "moro em X", "aqui em X", quando responde ao',
    '   pedido "Nome / Cidade" com o nome de um município, ou quando manda só o nome da cidade.',
    '   Leia a nossa pergunta antes de julgar a resposta: "Maria / Cachoeirinha" logo depois de',
    '   "me passe seu Nome / Cidade" é o nome dela e a cidade dela, nessa ordem.',
    '4. Nome de estado não é cidade: "sou do Rio Grande do Sul" não é a cidade Rio Grande.',
    '5. Nome de gente, de bairro, de rua e de outro estado não são município do RS.',
    '6. Na dúvida, "semcidade". Cidade errada no cadastro vira etiqueta errada e filtro errado, e',
    '   ninguém revisa isso depois. Não gravar nada custa uma linha no log; gravar errado custa o',
    '   contato aparecendo na região errada para sempre.',
    '',
    regras ? `Instruções adicionais do Thiago:\n${regras}\n` : '',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

/**
 * O bloco que descreve ESTA conferência — a parte que muda a cada contato.
 *
 * **A conversa vai dos DOIS lados, e isso não é enfeite.** A resposta mais comum ao pedido de
 * dados é *"Maria / Cachoeirinha"*, e sozinha ela é ambígua: nome de gente e nome de município,
 * sem nada dizendo qual é qual. Com a nossa pergunta na frente ("me passe seu Nome / Cidade") a
 * frase se explica. Foi exatamente o caso que ele apontou em 31/08.
 *
 * `mensagens` aceita `{de: 'nos'|'contato', texto}`, e também string solta — string é do contato,
 * que é o formato antigo.
 */
export function montarContatoCidade({ mensagens = [], candidato = '', origem = '', substituiria = '' } = {}) {
  const conversa = mensagens.length
    ? mensagens
        .map((m) => {
          const texto = umaLinha(typeof m === 'string' ? m : m?.texto || '');
          const nos = typeof m !== 'string' && m?.de === 'nos';
          return texto ? `${nos ? 'Atendimento' : 'Contato'}: ${texto}` : '';
        })
        .filter(Boolean)
        .join('\n')
    : '(o contato não escreveu nada)';

  return [
    `Cidade encontrada pelo programa: ${candidato || '(nenhuma)'}`,
    origem ? `De onde ela saiu: ${origem}` : '',
    // Substituir é mais grave que preencher: o que está no CRM alguém já pôs lá. A IA precisa
    // saber disso, porque a régua muda — só a própria pessoa dizendo onde mora justifica trocar.
    substituiria
      ? `⚠ Gravar isto vai SUBSTITUIR o que já está no CRM ("${substituiria}"). Só aceite ou ` +
        'corrija se a PRÓPRIA PESSOA disser onde mora nesta conversa; do contrário, "semcidade".'
      : '',
    '',
    'A conversa, na ordem (o "Atendimento" somos nós):',
    conversa,
  ]
    .filter(Boolean)
    .join('\n');
}

export function montarRequisicaoCidade({ sistema, contato, modelo = MODELO_PADRAO }) {
  return {
    model: modelo,
    // Conferência de um campo: a saída são três palavras e uma frase. Teto baixo é economia real
    // quando isto roda uma vez por contato da fila.
    max_tokens: 512,
    system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: contato }],
    output_config: saida(modelo, 'low', { type: 'json_schema', schema: esquemaDaCidade() }),
  };
}

/** Sem acento e sem caixa — o fallback de `validarCidade` quando ninguém passa o do `cities.js`. */
function soLetras(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tira acento (marcas combinantes)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A resposta do modelo virando decisão sobre o campo Cidade — **com as travas**.
 *
 * Espelha `validarDecisao`, e pelo mesmo motivo: prompt é pedido, validação é regra.
 *
 *  - `corrigir` só passa se o nome casar com a lista de municípios, e o que sai é o nome
 *    **oficial** da lista, não o que a IA digitou (a etiqueta de cidade nasce daqui — duas
 *    grafias seriam duas etiquetas para o mesmo município, e o filtro dele partido em dois);
 *  - confiança abaixo de `CONFIANCA_MINIMA` vira `incerto`;
 *  - qualquer outra coisa — JSON ilegível, ação desconhecida, cidade que não existe — vira
 *    `incerto`.
 *
 * `incerto` aqui **não grava nada e não recusa nada**: o palpite fica onde estava, e o campo do
 * CRM continua como estava. É a saída sem consequência, que é o que "na dúvida" tem que custar.
 *
 * @param {object|string} bruto
 * @param {{municipios?: string[], normalizar?: function}} opcoes
 * @returns {{acao:'aceitar'|'corrigir'|'semcidade'|'incerto', cidade:string, motivo:string,
 *            confianca:number, aviso:string}}
 */
export function validarCidade(bruto, { municipios = [], normalizar = soLetras } = {}) {
  const vazio = { acao: 'incerto', cidade: '', motivo: '', confianca: 0, aviso: '' };

  let d = bruto;
  if (typeof d === 'string') {
    try {
      d = JSON.parse(d);
    } catch (_) {
      return { ...vazio, aviso: 'a IA respondeu num formato que não deu para ler' };
    }
  }
  if (!d || typeof d !== 'object') return { ...vazio, aviso: 'a IA não devolveu conferência' };

  const motivo = String(d.motivo || '').trim().slice(0, 300);
  const confianca = Number.isFinite(d.confianca) ? Math.min(1, Math.max(0, d.confianca)) : 0;

  if (!['aceitar', 'corrigir', 'semcidade'].includes(d.acao)) {
    return { ...vazio, motivo, aviso: 'a IA não disse o que fazer com a cidade' };
  }

  // "Não tem cidade nesta conversa" é uma resposta, não uma dúvida: não precisa de confiança
  // alta porque não grava nada. Exigi-la faria a saída mais segura ser a mais difícil de dar.
  if (d.acao === 'semcidade') return { acao: 'semcidade', cidade: '', motivo, confianca, aviso: '' };

  if (confianca < CONFIANCA_MINIMA) {
    return { ...vazio, motivo, confianca, aviso: `a IA ficou em ${Math.round(confianca * 100)}% de certeza` };
  }

  if (d.acao === 'aceitar') return { acao: 'aceitar', cidade: '', motivo, confianca, aviso: '' };

  const pedida = String(d.cidade || '').trim();
  if (!pedida) return { ...vazio, motivo, confianca, aviso: 'a IA mandou corrigir e não disse para qual cidade' };

  const oficial = municipios.find((m) => normalizar(m) === normalizar(pedida));
  if (!oficial) {
    // Município inventado. É o erro que esta função existe para conter, e o único caminho por
    // onde um nome escrito pela IA chegaria ao CRM.
    return { ...vazio, motivo, confianca, aviso: `"${pedida}" não é município do RS` };
  }

  return { acao: 'corrigir', cidade: oficial, motivo, confianca, aviso: '' };
}

// ---------------------------------------------------------------------------
// Rascunho — o único lugar onde a IA escreve, e ela NUNCA envia
// ---------------------------------------------------------------------------

/**
 * O caso que a escolha entre respostas prontas não cobre: transcrição longa, relato comprido,
 * pergunta específica. Hoje ele copia para uma IA, ela responde, ele edita "para parecer mais
 * humano" e manda. Isto é esse laço, sem o copiar e colar — e sem a última parte mudar: **o
 * rascunho vai para o campo de mensagem, nunca para o envio.**
 *
 * A diferença entre isto e "IA respondendo eleitor" é uma só, e é a que importa: ele lê, edita e
 * aperta enviar. O que sai continua passando pelos olhos dele.
 *
 * **O truque que faz soar como ele:** as respostas prontas vão no prompt como EXEMPLOS DE ESTILO,
 * não como opções. Elas foram escritas por ele — é a amostra mais fiel do jeito dele que existe,
 * e sai de graça porque já está no prompt cacheado. "Editar para parecer mais humano" é trabalho
 * que o modelo pode adiantar se souber com que voz escrever.
 */
export function montarSistemaRascunho({ templates = [], regras = '', gabinete = '' } = {}) {
  const exemplos = templates
    .slice(0, 8)
    .map((t) => `— ${umaLinha(t.text, 500)}`)
    .join('\n');

  return [
    /**
     * **O PADRÃO DE ATENDIMENTO DELE vem primeiro, e ocupa quase todo o prompt** — entregue em
     * 06/09/2026 com a frase *"a IA deve seguir esse padrão para responder"*.
     *
     * O que estava aqui antes eram quatro linhas de estilo escritas por mim. Elas foram
     * substituídas pelo documento, que diz a mesma coisa com muito mais precisão e cobre o que eu
     * nunca teria: identificar o SENTIMENTO antes do assunto, não diminuir o problema, não discutir
     * com o cidadão, não concordar com afirmação factual falsa só para agradar.
     *
     * **Fica no prompt de SISTEMA porque não muda entre contatos** — é ele que leva
     * `cache_control`, e o documento é o mesmo em toda chamada.
     */
    atendimento.PADRAO_DE_ATENDIMENTO,
    '',
    '---',
    '',
    '## O que este mandato exige além do padrão acima',
    '',
    /**
     * **As três que o documento dele não cobre**, e por isso continuam escritas aqui.
     *
     * A do NOME é decisão dele de 10/08 e não aparece no padrão: sem ela a IA usaria o nome do
     * cadastro, que nesta base erra demais (apelido do perfil, cidade no campo do nome, `[NOVO] …`).
     * A do formato de saída é mecânica — o texto volta e vai direto para o campo de mensagem.
     */
    '1. NÃO chame a pessoa pelo nome. É regra do mandato: o cadastro erra o nome com frequência',
    '   alta demais, e errar o nome de alguém é pior do que não usar nenhum.',
    /**
     * **Gênero: na dúvida, neutro** — regra dele (06/09/2026), com a print da Marli.
     *
     * A IA escreveu *"Você está **coberto** de razão em cobrar"* para uma contato chamada Marli.
     * Ele: *"a IA não reconheceu o gênero dela e usou no masculino; quando não conseguir
     * identificar, utilizar no neutro"*.
     *
     * **O sinal confiável é como ELA fala de si** (*"obrigada"*, *"estou cansada"*, *"sozinha"*),
     * não o nome do cadastro — que é o mesmo nome que a regra 1 diz para não usar, justamente
     * porque erra. Usá-lo para deduzir gênero seria confiar, para uma coisa, no dado que não se
     * confia para outra.
     *
     * **Fica no PROMPT e não em `revisarRascunho`** porque concordância não é mecânica: consertar
     * exigiria saber o gênero e analisar a frase. É a fronteira que separa o traço eme (troca) de
     * "abriu com entendi" (aviso) — e aqui não dá nem para avisar sem julgar.
     *
     * Os exemplos são concretos de propósito: mandar "escreva no neutro" sem mostrar como fazer
     * deixa o modelo no masculino, que é o padrão dele em português.
     */
    '2. CONCORDÂNCIA DE GÊNERO: só use masculino ou feminino quando tiver certeza. O sinal que vale',
    '   é como a própria pessoa fala de si na conversa ("obrigada", "estou cansada", "sozinha") —',
    '   o nome do cadastro NÃO serve, é o mesmo que a regra 1 manda não usar porque erra demais.',
    '   Na dúvida, escreva no NEUTRO: contorne o adjetivo em vez de escolher um gênero.',
    '   "Você está coberto de razão" → "Você tem toda razão".',
    '   "Fico grato pela mensagem" → "Agradeço a mensagem".',
    '   "Seja bem-vindo" → "Que bom ter você por aqui".',
    '   "Você deve estar cansado" → "Imagino o cansaço que isso dá".',
    '   (O "obrigado" de quem escreve é do mandato, e continua no masculino.)',
    '3. Nunca use {{variáveis}} nem qualquer marcador: escreva o texto final, pronto para enviar.',
    '4. Sobre o candidato, a chapa e as pautas, use SÓ o que estiver na conversa e no bloco',
    '   "Quem é quem" abaixo. É a mesma regra do documento ("não invente informação"), dita aqui',
    '   porque aqui está a fonte.',
    /**
     * **A regra 5 nasceu da print da Sandra Grandini (06/09/2026)**, e é a alucinação mais cara que
     * este projeto viu: ela escreveu só *"E a respeito do material?"* e o rascunho respondeu *"Já
     * encaminhei seu pedido ao assessor da sua região para providenciar o material. Você deve
     * receber em breve."*
     *
     * **Nada disso aconteceu.** Não há assessor designado, ninguém encaminhou nada, e ela nunca deu
     * endereço — *"não tem como fazer entrega"*. Não é um texto fora de tom: é uma **afirmação falsa
     * sobre o mundo**, dita a um eleitor em nome do mandato, e que cria a expectativa que a
     * Lei 9.504/97 trata.
     *
     * Está escrita como proibição direta e com os exemplos do caso real, porque foi essa a forma que
     * a alucinação tomou. `revisarRascunho` a barra do envio automático; isto é a outra metade.
     */
    '5. NUNCA afirme que alguém já fez alguma coisa, e NUNCA diga que a pessoa vai receber algo.',
    '   Você não sabe o que foi feito fora desta conversa, e ninguém do mandato leu este rascunho',
    '   antes de ele sair. Proibido escrever: "já encaminhei seu pedido", "já repassei ao assessor",',
    '   "já anotei", "já solicitei", "você vai receber", "você deve receber em breve",',
    '   "está a caminho", "estou providenciando".',
    '   O que dá para dizer com verdade é o que ELE vai fazer depois de ler: "vou verificar isso",',
    '   "sua mensagem chegou aqui", "me diga o endereço para eu ver o que é possível".',
    '   Entrega de material físico depende de endereço e de gente — se a pessoa não deu o endereço,',
    '   pedir o endereço é a resposta; prometer a entrega não é.',
    '',
    /**
     * **O "encaminhe para o CRAS" SAIU daqui, e é um conflito real com o documento dele.**
     *
     * O prompt antigo mandava, no pedido de ajuda, *"escreva um rascunho que encaminhe para a
     * assistência social do município (CRAS, Secretaria de Assistência Social)"*. O padrão dele diz
     * o contrário, no item 5: *"Procure o CRAS"* está na lista do que **não** dizer, porque soa a
     * minimização — e o item 9 dá a estrutura que ele quer no lugar (não precisa se desculpar,
     * entendo a situação, infelizmente não posso assumir, obrigado pela confiança).
     *
     * A proibição legal continua inteira: prometer bem ou benefício segue proibido. O que mudou é
     * o que a IA escreve DEPOIS de negar. **O texto pronto `pedido-ajuda`, que lista SINE, CRAS e
     * Emprega Brasil, não foi tocado** — ele é dele, é detalhado e não é brusco; a regra nova vale
     * para o que a IA escreve, não para a resposta pronta.
     */
    'A lei eleitoral (9.504/97) proíbe prometer dinheiro, cesta, remédio, passagem, emprego, vaga',
    'ou qualquer bem ou benefício, e vale o ano inteiro. Negar com respeito é o item 9 do padrão',
    'acima; prometer, nunca — nem "vou ver o que consigo".',
    '',
    'Responda SÓ com o texto do rascunho. Sem aspas, sem título, sem explicação.',
    '',
    /**
     * Quem é quem — a mesma informação da decisão, e aqui ela pesa mais.
     *
     * No rascunho a IA ESCREVE, e a regra de "não inventar dado" acima ficaria impossível de
     * cumprir sem isto: perguntada sobre o número de urna ou sobre quem é da chapa, ela só
     * poderia calar. Com o bloco, ela responde com o que o gabinete informou — e a regra passa a
     * dizer exatamente isso: conversa e este bloco, nada além.
     */
    gabinete ? `Quem é quem neste mandato (informação do gabinete — use-a como fonte e não invente o que não estiver aqui):\n${gabinete}\n` : '',
    /**
     * **As instruções dele mandam sobre o ESTILO, e nunca sobre as proibições** — escrito assim
     * depois de ele perguntar *"a IA não segue todas as instruções?"* (05/09/2026). O que é
     * mecânico (o traço eme) virou conserto em `revisarRascunho`; o que depende de julgamento
     * continua aqui — e aqui é pedido, por isso o texto diz "literalmente".
     */
    regras
      ? `Instruções da equipe, a seguir LITERALMENTE (elas mandam sobre as regras de estilo acima, e nunca sobre a lista do que você não pode escrever):\n${regras}\n`
      : '',
    'Exemplos do jeito de escrever da equipe:',
    '',
    exemplos,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

/**
 * O corpo da requisição do rascunho.
 *
 * `max_tokens` maior que o da decisão porque aqui a saída é texto E o pensamento do Opus 5 cabe
 * dentro dele (ver `montarRequisicao`). O texto continua curto pelo prompt, não pelo teto.
 *
 * `effort: 'medium'` e não `'low'`: este é o único caminho em que uma frase gerada pode chegar a
 * um eleitor sem ninguém ler. Economizar esforço aqui é economizar no lugar errado.
 *
 * A conversa entra INTEIRA (até o teto de `montarConversa`): o caso de uso é justamente o texto
 * longo, e cortar o começo é como se perde o que a pessoa realmente perguntou.
 */
/**
 * O esquema do rascunho.
 *
 * Passou a ter `confianca` e `motivo` quando o envio automático entrou (20/08/2026): sem um
 * número devolvido pela própria IA não há como aplicar limiar nenhum. `precisaDeRevisao` é o
 * canal para ela **se autodenunciar** — é barato perguntar, e uma IA que hesita é exatamente o
 * caso que não pode sair sozinho.
 */
export function esquemaDoRascunho() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['texto', 'confianca', 'precisaDeRevisao'],
    properties: {
      texto: {
        type: 'string',
        description: 'A resposta pronta para enviar, no tom do Thiago. Sem marcador, sem colchete.',
      },
      confianca: {
        type: 'number',
        description:
          'De 0 a 1. Quão seguro você está de que este texto pode ser enviado SEM revisão humana. ' +
          'Abaixo de 0,9 alguém lê antes. Na dúvida, baixe.',
      },
      precisaDeRevisao: {
        type: 'boolean',
        description:
          'true se um humano precisa ler antes de enviar: assunto sensível, dado que você não ' +
          'tem certeza, promessa, qualquer coisa que possa comprometer o mandato.',
      },
      motivo: {
        type: 'string',
        description: 'Uma frase curta dizendo por que escolheu esse tom/conteúdo. Aparece na tela.',
      },
    },
  };
}

export function montarRequisicaoRascunho({ sistema, contato, modelo = MODELO_PADRAO }) {
  return {
    model: modelo,
    max_tokens: 4096,
    system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: contato }],
    output_config: saida(modelo, 'medium', { type: 'json_schema', schema: esquemaDoRascunho() }),
  };
}

/**
 * **O formulário que fecha o rascunho quando falta cadastro** — e ele é uma string só de propósito.
 *
 * A linha `Nome , Cidade` é o INVARIANTE que `templates.ehPedidoDeDados` reconhece. Quem chama usa
 * esta mesma constante como PISO: se a IA não copiar o bloco, o painel o acrescenta. Duas redações
 * (uma no prompt, outra no piso) divergiriam na primeira reescrita, e o custo é conhecido — a
 * rodada deixa de enxergar que o pedido saiu e pede de novo na passada seguinte.
 */
export const PEDIDO_DE_DADOS_NO_RASCUNHO = [
  'E, se puder, me diga seu:',
  '',
  'Nome , Cidade',
  '',
  '(exemplo: Pedro Silva , Porto Alegre)',
].join('\n');

/** O bloco do contato para o rascunho: a conversa com folga, porque é dela que ele precisa. */
export function montarContatoRascunho({ mensagens = [], campos = {}, agora, pedirDados = false } = {}) {
  /**
   * **A conversa INTEIRA, com os dois lados e com a pendência marcada.**
   *
   * Print da Maria Geny (03/09/2026): ela mandou um áudio às 21:39, nós já tínhamos respondido às
   * 19:47, e o rascunho da IA respondeu a mensagem ANTERIOR à nossa resposta. Ele: *"ignorou a
   * última mensagem da pessoa e a minha resposta, e respondeu a penúltima mensagem dela"*.
   *
   * **A IA não tinha como acertar:** este bloco mandava só as mensagens DELA, numeradas, sem o que
   * nós havíamos dito e sem dizer qual estava esperando resposta. Para o modelo a conversa era uma
   * pilha de falas soltas — responder qualquer uma era igualmente plausível.
   *
   * Aceita string solta (é do contato, como antes) e `{de, texto}`, que é a forma que
   * `montarContatoCidade` já usava. A marca **← RESPONDA A ESTA** vai na última dela, e é o que
   * transforma "escreva algo" em "responda isto".
   */
  const lista = (mensagens || [])
    .map((m) => (typeof m === 'string' ? { de: 'contato', texto: m } : m))
    .filter((m) => String(m?.texto || '').trim());

  /**
   * **A marca vai na RAJADA inteira, não só na última** — print da Janete (04/09/2026): *"IA ignorou
   * rajada de mensagens"*.
   *
   * Ela mandou um áudio longo às 10:52 contando a política da cidade dela, e depois, às 17:19,
   * clicou num anúncio (*"Olá! Eu escolho a segurança"*). O rascunho respondeu **só o clique** e
   * ignorou o áudio.
   *
   * Foi consequência direta do conserto anterior: marcar *uma* mensagem resolveu a Maria Geny (que
   * respondia a mensagem velha) e criou o oposto — o modelo passou a olhar só a última. O que
   * separa "já respondido" de "pendente" não é a posição da última, é a **nossa última fala**: tudo
   * o que ela escreveu depois disso está esperando resposta, e é a rajada inteira.
   */
  let ultimaNossa = -1;
  lista.forEach((m, i) => { if (m.de === 'nos') ultimaNossa = i; });
  const pendentes = lista.filter((m, i) => m.de !== 'nos' && i > ultimaNossa).length;

  /**
   * **O que JÁ foi respondido leva marca própria** — relato dele (05/09/2026): *"a IA pegou o
   * contexto de umas 3 mensagens e ignorou a minha resposta e respondeu todas"*.
   *
   * Até aqui a distinção era a AUSÊNCIA de "← SEM RESPOSTA", e ausência não é sinal: o modelo via
   * uma pilha de falas dela e uma nossa no meio, e tratava tudo como pendente. A marca explícita é
   * o que faz a nossa resposta valer como resposta.
   */
  const conversa = lista
    .map((m, i) => {
      const quem = m.de === 'nos' ? 'NÓS' : 'ELA';
      const pendente = m.de !== 'nos' && i > ultimaNossa;
      const jaRespondida = m.de !== 'nos' && ultimaNossa >= 0 && i < ultimaNossa;
      const marca = pendente ? '   ← SEM RESPOSTA' : jaRespondida ? '   ← já respondida' : '';
      // O horário de cada fala — é o que permite o rascunho reconhecer que a conversa esfriou.
      const q = quandoFoi(m.at, agora);
      return `${quem}${q ? ` [${q}]` : ''}: ${umaLinha(m.texto, 4000)}${marca}`;
    })
    .join('\n\n');

  /**
   * **O que já se sabe sobre a pessoa — e o pedido explícito de não perguntar de novo.**
   *
   * Anotação dele (03/09/2026, print da Catarina): *"a IA perguntou nome — o nome dela é Catarina,
   * eu apaguei a parte perguntando"*. O nome estava no cadastro e este bloco só mandava a cidade,
   * então a IA não tinha como saber. Pedir o que já se tem é o jeito mais rápido de a pessoa achar
   * que ninguém leu nada — e ele teve que editar o rascunho à mão para tirar.
   *
   * O nome entra para a IA **saber que já o tem**; usá-lo continua proibido pela regra do sistema
   * (o cadastro erra o nome com frequência alta demais).
   */
  const sabidos = Object.entries(campos || {})
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => `${k}: ${String(v).trim()}`);

  const cadastro = sabidos.length
    ? [
        `Já temos no cadastro desta pessoa — ${sabidos.join(' · ')}.`,
        'NÃO peça nada que já esteja nesta linha. Pedir de novo dá a impressão de que ninguém leu',
        'a conversa. (O nome está aqui para você saber que já o temos: continua proibido usá-lo no',
        'texto.)',
      ].join('\n')
    : '';

  return [
    /**
     * **O relógio faltava AQUI** — e era o caminho que escreve texto para o eleitor.
     *
     * Em 04/09/2026 o horário entrou em `montarContato` (a decisão) e este bloco ficou de fora:
     * ele carimbava cada mensagem com `quandoFoi`, mas nunca dizia que horas são AGORA. Com a
     * última fala dela marcada `ontem 20:21`, o modelo abriu o rascunho com *"Boa noite!"* às
     * 16:21. **Carimbar as mensagens não é ter relógio** — é saber quando as coisas foram, sem
     * saber quando é agora.
     *
     * A saudação vai escrita por extenso porque deduzir a faixa da hora é justamente o passo em
     * que ele errou.
     */
    agoraEmPortugues(agora),
    `Se abrir com saudação, a correta agora é "${saudacaoDeAgora(agora)}" — não deduza pelo horário das mensagens.`,
    '',
    'A conversa inteira, da mais antiga para a mais recente. "NÓS" é o atendimento:',
    '',
    conversa || '(nada)',
    '',
    /**
     * **Você é a MESMA pessoa que já falou com ela** — pedido dele (05/09/2026): *"ela tem que ser
     * uma sequência das minhas mensagens; no momento está agindo como uma terceira pessoa na
     * conversa"*.
     *
     * O rascunho vinha soando como alguém que chegou agora, leu tudo e respondeu ponto a ponto:
     * recapitulando, se apresentando de novo, tratando cada fala dela como um item de lista. O que
     * ele manda é a próxima mensagem DELE numa conversa que já estava em curso.
     */
    ultimaNossa >= 0
      ? 'VOZ: você é a MESMA pessoa que escreveu as falas marcadas "NÓS". Esta mensagem é a ' +
        'PRÓXIMA da conversa, não uma resposta de fora. Não se apresente de novo, não recapitule o ' +
        'que já dissemos e não abra saudação como se fosse o primeiro contato — emende de onde nós ' +
        'paramos.'
      : 'VOZ: é a primeira coisa que o atendimento diz a esta pessoa.',
    '',
    /**
     * **O eixo é a ÚLTIMA sem resposta** — mesma conversa de 05/09: *"eu queria que ela ficasse
     * ciente do contexto e respondesse a última mensagem do contato"*.
     *
     * Isto ajusta, e não desfaz, o conserto da Janete (04/09), onde o rascunho respondeu só o
     * clique e ignorou o áudio: o que estava errado lá era **ignorar**, e continua proibido. O que
     * mudou é a forma — a resposta tem um eixo, e o resto entra reconhecido de passagem, em vez de
     * virar um relatório que responde item por item.
     */
    pendentes === 0
      ? 'A última fala da conversa é NOSSA: ela não deixou nada sem resposta. Se for escrever, que ' +
        'seja um complemento curto ao que já dissemos — nunca uma repetição.'
      : pendentes > 1
      ? `Ela escreveu ${pendentes} mensagens sem resposta, marcadas "← SEM RESPOSTA". O EIXO da sua ` +
        'resposta é o que ela quer AGORA: a mais recente que pede ou pergunta alguma coisa. Se a ' +
        'última for só cortesia ("obrigada", "bom dia"), o eixo é a anterior, e a cortesia se ' +
        'responde em duas palavras. As outras você leva em conta e reconhece de passagem, numa ' +
        'frase — nunca responda uma a uma, nem por tópicos.'
      : 'Responda à mensagem marcada "← SEM RESPOSTA".',
    'As falas dela marcadas "← já respondida" NÓS JÁ RESPONDEMOS: elas são contexto, e nada mais.',
    'Não volte a elas, não as responda de novo e não retome assunto que já encerramos.',
    '',
    cadastro,
    /**
     * **O que FALTA no cadastro tem que ser pedido, e com o texto exato.**
     *
     * Print dele (05/09/2026): o rascunho respondeu bem o policial militar da reserva e **não pediu
     * nada** — *"faltou detalhes, não pediu dados"*. O bloco de cima dizia o que NÃO pedir; nada
     * dizia o que pedir. Sem cidade, o contato fica sem etiqueta e fora de todo filtro.
     *
     * **O texto vai literal de propósito, e não e enfeite:** a linha `Nome , Cidade` é o INVARIANTE
     * que `templates.ehPedidoDeDados` reconhece. Deixando a IA pedir com as palavras dela, a rodada
     * não enxerga que o pedido saiu e pede de novo na passada seguinte — o defeito que já custou
     * três anotações quando o separador do template mudou.
     *
     * Quem decide se pede é quem chama, com a MESMA conta que guarda o formulário
     * (`sugestao.pedirDadosNaoCabe`): duas definições divergiriam, e a que ninguém olha é a que
     * pede o cadastro de quem já o deu.
     */
    pedirDados
      ? [
          'O cadastro desta pessoa está incompleto. Depois de responder o que ela escreveu, FECHE a',
          'mensagem com este bloco, copiado exatamente assim (sem reescrever) — copie-o inteiro mesmo',
          'que o nome já apareça acima: é o formulário padrão do gabinete, e é por ele que o sistema',
          'reconhece que o pedido saiu.',
          '',
          PEDIDO_DE_DADOS_NO_RASCUNHO,
        ].join('\n')
      : '',
    'Escreva o rascunho da resposta.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * O rascunho que voltou está em condições de ir para o campo de mensagem?
 *
 * Não é censura de conteúdo — isso o prompt tenta e não garante. É a rede que pega as falhas
 * VERIFICÁVEIS, mais os avisos que fazem ele olhar duas vezes antes de mandar. O rascunho nunca é
 * recusado por causa de um aviso: quem decide é ele, e esconder o texto tiraria essa decisão.
 *
 * @returns {{texto:string, avisos:string[]}}
 */
/**
 * **Abertura de PRIMEIRO CONTATO** — o que a mensagem seguinte de uma conversa em curso não pode
 * ter. Relato dele (05/09/2026): *"ela tem que ser uma sequência das minhas mensagens; no momento
 * está agindo como uma terceira pessoa na conversa"*.
 *
 * É só AVISO, nunca conserto: consertar exigiria reescrever a frase, e a disciplina desta função é
 * corrigir só o mecânico (a saudação errada, o traço eme). O prompt é quem pede a voz certa; isto
 * é a rede que mostra quando ele não foi obedecido.
 */
const SE_APRESENTANDO = [
  /\bgabinete d[oa]\b/i,
  /\b(bem[- ]vind[oa]s?|seja bem[- ]vind[oa])\b/i,
  /\baqui (é|e) o\b/i,
  /\b(voc[êe]|vc) est[áa] falando com\b/i,
  /\bem que (podemos|posso) ajudar\b/i,
];

/**
 * @param {string} bruto
 * @param {Date|number} agora
 * @param {{jaFalamos?: boolean}} [contexto] `jaFalamos` liga o aviso de apresentação repetida.
 */
/**
 * **Os dois avisos que IMPEDEM o envio automático do rascunho** (06/09/2026).
 *
 * Os outros que esta função levanta são cosméticos ou já corrigidos por ela — a saudação trocada,
 * o traço eme virado hífen, a abertura com "entendi", o texto longo, a apresentação repetida.
 * Estes dois não: **marcador esquecido** iria literalmente para o eleitor (`{{primeiro_nome}}` na
 * tela do WhatsApp), e **promessa de entregar** é o risco da Lei 9.504/97, que é a razão de a IA
 * nunca ter podido escolher `pedido-ajuda`/`pedido-emprego`.
 *
 * São CONSTANTES, e não uma lista de frases reescrita no painel, porque quem compara é código: o
 * dia em que alguém reescrever o texto do aviso, a trava do envio tem que reescrever junto — ou
 * ela deixa de casar em silêncio, e o silêncio aqui é uma mensagem inventada saindo sozinha.
 */
export const AVISOS_QUE_IMPEDEM_ENVIO = {
  marcador: 'sobrou marcador no texto — troque antes de mandar',
  promessa: 'parece prometer entregar alguma coisa — confira antes de mandar',
  /**
   * **A IA AFIRMOU ter feito uma coisa que ninguém fez** — print da Sandra Grandini (06/09/2026).
   *
   * Ela escreveu só *"E a respeito do material?"*. O rascunho respondeu: *"Já encaminhei seu pedido
   * ao assessor da sua região para providenciar o material. Você deve receber em breve."* Ele apagou
   * a mensagem: *"a IA alucinou ou ignorou contexto; ela nunca nos forneceu endereço, então não tem
   * como fazer entrega"*.
   *
   * **É a pior alucinação possível neste projeto**, e é de outra natureza que as anteriores: não é
   * um texto fora de tom nem uma resposta ao lado — é uma **afirmação falsa sobre o mundo**, dita a
   * um eleitor em nome do mandato. Ninguém encaminhou nada, não há assessor designado, e a pessoa
   * nunca deu endereço. E, dita assim, ela cria a expectativa que a Lei 9.504/97 trata.
   *
   * Barra o envio automático, como o marcador e a promessa: as três são coisas que **não se
   * conserta lendo depois**, porque a mensagem já saiu.
   */
  afirmouAcao: 'afirma que alguém já providenciou algo — confira, porque ninguém fez isso',
};

/** O rascunho pode sair sozinho, ou algum aviso exige que uma pessoa leia antes? */
/**
 * **Os casos em que o rascunho NUNCA sai sozinho, por mais limpo que o texto esteja.**
 *
 * Pedido dele (06/09/2026), com a print da Dima Souza — 1min34 de áudio, transcrito: pensionista,
 * viúva, sem aumento há anos, com uma cirurgia dos dois pés de R$ 18 mil pela frente, revoltada com
 * a política. A rodada mandou uma mensagem e ele a apagou: *"bote transcrição desse tipo para IA ou
 * eu atender sempre; o automatizado mandou mensagem ignorando o contexto do pedido de ajuda"*.
 *
 * **O quadro estava certo** — medido nos dois quadros (o dele e o padrão), o caso dá **tecla 6**. E
 * a tecla 6 é a porta da IA: ela escreveu, e com "Automatizar" marcada o texto saiu sem ninguém ler.
 *
 * As duas travas que existiam olham só o TEXTO que voltou (marcador esquecido, promessa de
 * entregar). Esta olha o CASO: há situações em que o problema não é o rascunho estar errado, e sim
 * **quem tem que decidir** — e nelas o desfecho que ele pediu é literalmente *"IA ou eu"*: a IA
 * escreve, o texto fica no campo, e ele manda.
 *
 * **Isto não para a rodada** e não é o corte de 03/09: o rascunho continua sendo escrito e posto no
 * campo. O que muda é o último passo, que passa a ser dele — que é a fronteira que o projeto
 * manteve desde o começo, restaurada para os casos que mais custam quando saem errados.
 *
 * @param {string[]} avisos os que `revisarRascunho` levantou sobre o texto
 * @param {{pedeRespostaPessoal?:unknown, pedeAjudaFinanceira?:unknown, naoPodeFalarAgora?:unknown,
 *          pedeAlgoIndefinido?:unknown, semInteresse?:unknown}} [sinais] o caso deste contato
 */
export function rascunhoPodeSairSozinho(avisos = [], sinais = {}) {
  const impedem = Object.values(AVISOS_QUE_IMPEDEM_ENVIO);
  if ((avisos || []).some((a) => impedem.includes(a))) return false;

  /**
   * A lista é curta e é toda de casos **sensíveis**, não de casos difíceis:
   *
   *  - **conversa longa, áudio, arquivo** (`pedeRespostaPessoal`) — o caso da Dima. Quem gravou 1min34
   *    contando a vida espera alguém, e o pior erro possível aqui é uma resposta que não leu;
   *  - **pedido de dinheiro, cesta ou remédio** (`pedeAjudaFinanceira`) — é o caso de maior risco do
   *    projeto, e o único com a Lei 9.504/97 do lado. O texto que nega é dele, revisado;
   *  - **passando mal, ou avisou que fala depois** (`naoPodeFalarAgora`) — 05/09;
   *  - **pediu algo e não disse o quê** (`pedeAlgoIndefinido`) — decisão dele de 03/09: *"já que
   *    pedido é algo difícil de ser identificado, será agora pra mim ou IA responder"*;
   *  - **recusou ou hostilizou** (`semInteresse`) — responder a quem pediu para sair é o que gera
   *    denúncia;
   *  - **pediu material** (`pedeMaterial`) — entrou com a print da Sandra Grandini (06/09/2026),
   *    onde a IA respondeu *"já encaminhei seu pedido ao assessor da sua região"* a quem só
   *    perguntou *"e a respeito do material?"*. Material físico depende de **endereço e de gente**,
   *    e as duas coisas estão fora do alcance de um rascunho.
   */
  const sensivel =
    !!sinais?.pedeRespostaPessoal ||
    !!sinais?.pedeAjudaFinanceira ||
    !!sinais?.naoPodeFalarAgora ||
    !!sinais?.pedeAlgoIndefinido ||
    !!sinais?.semInteresse ||
    !!sinais?.pedeMaterial;

  return !sensivel;
}

export function revisarRascunho(bruto, agora, contexto = {}) {
  let texto = String(bruto || '').trim();
  const avisos = [];
  if (!texto) return { texto: '', avisos: ['a IA não devolveu texto'] };

  if (contexto?.jaFalamos && SE_APRESENTANDO.some((re) => re.test(texto))) {
    avisos.push('o rascunho se apresenta como primeiro contato, e vocês já conversaram — leia a abertura');
  }

  /**
   * **A saudação errada é consertada, não avisada.**
   *
   * É a única correção que esta função faz no texto, e ela cabe aqui por ser verificável e
   * mecânica: a hora do relógio decide, sem julgar uma vírgula do que a IA escreveu. Avisar em vez
   * de consertar devolveria a ele um trabalho de um segundo que a máquina faz melhor — e a print
   * de 04/09 mostra o custo de deixar passar: *"Boa noite!"* às 16:21, para um eleitor.
   *
   * Só troca a PALAVRA da abertura, e só quando já há uma saudação ali: rascunho sem saudação
   * continua sem, porque acrescentar uma seria escrever no lugar da IA.
   */
  const certa = saudacaoDeAgora(agora);
  const abertura = SAUDACAO_NO_COMECO.exec(texto);
  if (abertura && abertura[1].toLowerCase() !== certa.toLowerCase()) {
    texto = texto.replace(SAUDACAO_NO_COMECO, certa);
    avisos.push(`a IA abriu com "${abertura[1]}" e agora é ${certa.toLowerCase()} — troquei`);
  }

  // Marcador esquecido: iria como está para o eleitor e apareceria literalmente na conversa.
  if (/\{\{|\[nome\]|\[cidade\]|xxx+/i.test(texto)) {
    avisos.push(AVISOS_QUE_IMPEDEM_ENVIO.marcador);
  }

  /**
   * **Afirmar que alguém JÁ fez alguma coisa** — ver `AVISOS_QUE_IMPEDEM_ENVIO.afirmouAcao`.
   *
   * A lista é de verbos de **encaminhamento e providência**, não de fala: *"já falei sobre isso"* é
   * conversa, *"já encaminhei ao assessor"* é uma afirmação sobre o mundo. O `já` não é obrigatório
   * — *"encaminhei seu pedido"* diz a mesma coisa.
   */
  const AFIRMOU_ACAO = [
    /\b(j[áa]\s+)?(encaminhei|encaminhamos|repassei|repassamos|solicitei|solicitamos|providenciei|providenciamos|registrei|registramos|anotei|anotamos)\b/i,
    /\bj[áa]\s+(pedi|pedimos|avisei|avisamos|separei|separamos|enviei|enviamos|mandei|mandamos)\b/i,
    /\b(seu|o)\s+pedido\s+(foi|j[áa]\s+foi)\s+(encaminhado|repassado|registrado|anotado|enviado)/i,
    /\bfoi\s+(encaminhado|repassado)\s+(ao|para|pro)\b/i,
  ];
  if (AFIRMOU_ACAO.some((re) => re.test(texto))) {
    avisos.push(AVISOS_QUE_IMPEDEM_ENVIO.afirmouAcao);
  }

  /**
   * Promessa de bem ou benefício. A lista é grosseira de propósito: ela não julga a frase, só
   * levanta a mão para ele ler. Falso positivo aqui custa uma olhada; falso negativo custa um
   * mandato prometendo o que a lei proíbe.
   */
  const PROMESSA = [
    /\b(vou|vamos|posso|podemos|consigo|conseguimos)\b[^.!?]{0,40}\b(mandar|enviar|dar|arrumar|conseguir|providenciar)\b/i,
    /**
     * **A promessa na VOZ DELA** — *"você deve receber em breve"* (a Sandra, 06/09/2026). O padrão
     * de cima só olhava a nossa voz (*"vou mandar"*), e a forma que saiu foi a outra.
     */
    /(^|[^\p{L}])(voc[êe]|vc|o\s+senhor|a\s+senhora)[^.!?]{0,30}(vai|ir[áa]|deve|dever[áa])\s+receber/iu,
    /\breceber[áa]\b/i,
    /\b(j[áa]\s+)?est[áa]\s+a\s+caminho\b/i,
    /\b(em\s+breve|nos\s+pr[óo]ximos\s+dias)\b[^.!?]{0,40}\b(receber|chegar|entregar|mandar|enviar)/i,
    /\b(estou|estamos)\s+providenciando\b/i,
  ];
  if (PROMESSA.some((re) => re.test(texto))) {
    avisos.push(AVISOS_QUE_IMPEDEM_ENVIO.promessa);
  }
  if (/\b(cesta|rem[ée]dio|dinheiro|pix|emprego|vaga|passagem)\b/i.test(texto)) {
    avisos.push('cita bem ou benefício (cesta, remédio, dinheiro, emprego) — a lei eleitoral proíbe prometer');
  }
  if (texto.length > 1500) avisos.push('ficou longo para WhatsApp — vale cortar');

  /**
   * **O TRAVESSÃO é trocado, e não pedido** — regra dele (05/09/2026): *"não use traço eme nas
   * conversas"*, escrita nas Instruções extras da IA, e o rascunho seguinte veio com *"Salto do
   * Yucumã — tudo isso merece visibilidade"*. Ele: *"a IA não segue todas as instruções?"*.
   *
   * A resposta é a lição mais repetida deste projeto: **prompt é pedido, código é regra.** As
   * instruções extras entram no prompt e o modelo as segue quase sempre — "quase" não serve para o
   * que é verificável. Foi assim com o relógio e com a saudação (04/09), e o critério para entrar
   * aqui é o mesmo: **mecânico e sem julgamento**. Instrução de conteúdo (*"dê corda para quem
   * busca remuneração"*) continua só no prompt, porque conferi-la exigiria julgar a frase.
   *
   * Troca por hífen, com os espaços preservados: é a pontuação que a equipe usa no WhatsApp, e não
   * muda o sentido de nenhuma frase.
   */
  if (/[—–]/.test(texto)) {
    texto = texto.replace(/[—–]/g, '-');
    avisos.push('a IA usou traço eme — troquei por hífen');
  }

  /**
   * **Abrir com "entendi" é aviso, e não troca** — a outra instrução dele do mesmo dia: *"não
   * comece as mensagens pela abordagem de 'entendi' e repetindo o que foi dito"*.
   *
   * Aqui não dá para consertar sem reescrever a frase, e reescrever é escrever no lugar da IA. O
   * que cabe é levantar a mão: ele lê e corta a abertura, que é o gesto de um segundo.
   */
  if (ABRE_REPETINDO.test(texto)) {
    avisos.push('abriu repetindo o que ela disse — você pediu para não começar assim');
  }

  return { texto, avisos };
}

/** As aberturas que ele mandou evitar. Só o COMEÇO conta: "entendi" no meio da frase é normal. */
const ABRE_REPETINDO = /^\s*(entendi|entendo|compreendo|entendemos|percebi|vi que|li sua|recebi sua)\b/i;

/** Achata para uma linha e corta: conversa longa não pode dominar o prompt nem o custo. */
function umaLinha(texto, limite = 400) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  return t.length > limite ? `${t.slice(0, limite)}…` : t;
}

/**
 * Lê o que a IA devolveu no rascunho e junta com a revisão heurística.
 *
 * O esquema garante JSON válido; quem decide se dá para usar é isto.
 * `avisos` sai de `revisarRascunho` (texto) mais `precisaDeRevisao` (a própria IA levantando a
 * mão) — os dois no mesmo lugar, porque quem chama trata os dois igual: qualquer aviso, humano lê.
 *
 * @returns {{texto:string, confianca:number, motivo:string, avisos:string[], precisaDeRevisao:boolean}}
 */
export function validarRascunho(bruto, agora, contexto = {}) {
  const vazio = { texto: '', confianca: 0, motivo: '', avisos: ['a IA não devolveu rascunho'], precisaDeRevisao: true };

  let d = bruto;
  if (typeof d === 'string') {
    try {
      d = JSON.parse(d);
    } catch (_) {
      // Formato ilegível: trata como texto puro, que é o que a versão anterior devolvia. Assim
      // um modelo que ignore o esquema ainda produz rascunho — só nunca automático, porque sem
      // `confianca` ele não passa do limiar.
      const cru = revisarRascunho(bruto, agora, contexto);
      return { texto: cru.texto, confianca: 0, motivo: '', avisos: cru.avisos, precisaDeRevisao: true };
    }
  }
  if (!d || typeof d !== 'object') return vazio;

  const revisao = revisarRascunho(d.texto, agora, contexto);
  const precisaDeRevisao = d.precisaDeRevisao !== false; // ausente = sim, por segurança
  const avisos = [...revisao.avisos];
  if (precisaDeRevisao) avisos.push('a própria IA pediu revisão humana');

  return {
    texto: revisao.texto,
    confianca: Number.isFinite(d.confianca) ? Math.min(1, Math.max(0, d.confianca)) : 0,
    motivo: String(d.motivo || '').trim().slice(0, 300),
    avisos,
    precisaDeRevisao,
  };
}

// ---------------------------------------------------------------------------
// Custo
// ---------------------------------------------------------------------------

/**
 * Preço da API, em dólares por milhão de tokens.
 *
 * **A assinatura Claude Pro/Max NÃO cobre isto.** São duas cobranças diferentes: a assinatura é
 * do claude.ai e do Claude Code; a API é pré-paga por token no `console.anthropic.com`, com
 * fatura própria. Ligar a IA aqui gera despesa NOVA em cima do plano — nunca sai de dentro dele.
 * Foi a confusão dele em 20/08/2026 ("eu usaria meu plano"), e é a razão de o teto existir.
 *
 * Preço muda; confira em `anthropic.com/pricing` antes de tratar o número da tela como fatura.
 * Ele serve para **decidir parar**, não para conferir cobrança.
 */
export const PRECOS_USD_POR_MTOK = {
  'claude-opus-5': { entrada: 5, saida: 25 },
  'claude-sonnet-5': { entrada: 2, saida: 10 },
  'claude-haiku-4-5': { entrada: 1, saida: 5 },
};

/** Leitura de cache custa 10% da entrada; escrita custa 1,25× (TTL de 5 min). */
export const FATOR_CACHE_LEITURA = 0.1;
export const FATOR_CACHE_ESCRITA = 1.25;

/**
 * O que uma chamada custou, em dólares, a partir do `usage` que a API devolveu.
 *
 * Modelo desconhecido cobra pelo mais CARO da tabela de propósito: preço que a extensão não
 * conhece não pode virar gasto invisível, e superestimar só faz o teto chegar mais cedo.
 *
 * @param {{entrada:number, cacheEscrito:number, cacheLido:number, saida:number}} uso
 * @returns {number} dólares
 */
export function custoEmDolares(uso, modelo = MODELO_PADRAO) {
  if (!uso) return 0;
  const p =
    PRECOS_USD_POR_MTOK[modelo] ||
    Object.values(PRECOS_USD_POR_MTOK).reduce((a, b) => (b.saida > a.saida ? b : a));

  const M = 1e6;
  const entrada = (Number(uso.entrada) || 0) * p.entrada;
  const escrito = (Number(uso.cacheEscrito) || 0) * p.entrada * FATOR_CACHE_ESCRITA;
  const lido = (Number(uso.cacheLido) || 0) * p.entrada * FATOR_CACHE_LEITURA;
  const saida = (Number(uso.saida) || 0) * p.saida;

  return (entrada + escrito + lido + saida) / M;
}

/** `2026-08` a partir de um timestamp. Quem passa o instante é o chamador (testável). */
export function mesDe(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Soma uma chamada ao gasto do mês.
 *
 * **Vira o mês zerando**, e é isso que faz o teto ser mensal sem nenhum agendador: não há tarefa
 * de virada de mês para falhar em silêncio — o mês muda no primeiro uso do mês seguinte.
 *
 * @returns {{mes:string, usd:number, chamadas:number, tokens:number}} gasto novo (não muta)
 */
export function acumularGasto(gasto, custoUsd, ts = Date.now(), tokens = 0) {
  const mes = mesDe(ts);
  const base = gasto && gasto.mes === mes ? gasto : { mes, usd: 0, chamadas: 0, tokens: 0 };
  return {
    mes,
    usd: (Number(base.usd) || 0) + (Number(custoUsd) || 0),
    chamadas: (Number(base.chamadas) || 0) + 1,
    tokens: (Number(base.tokens) || 0) + (Number(tokens) || 0),
  };
}

/**
 * O teto. Chamado ANTES de gastar, no service worker — o único lugar por onde o dinheiro sai.
 *
 * Mora ali, e não no painel, pela mesma razão da chave da API: caminho novo no painel não pode
 * conseguir furar a trava por esquecimento. É a diferença entre um teto e uma boa intenção.
 *
 * Teto `0` significa **sem teto**, e é escolha explícita dele na Config — o padrão nasce com
 * limite. Nascer sem limite é como se descobre o valor pela fatura.
 *
 * @returns {{pode:boolean, motivo:string, usado:number, teto:number, fracao:number}}
 */
export function podeGastar({ gasto, tetoUsd = 0, ts = Date.now() } = {}) {
  const teto = Number(tetoUsd) || 0;
  const mes = mesDe(ts);
  const usado = gasto && gasto.mes === mes ? Number(gasto.usd) || 0 : 0;
  const fracao = teto > 0 ? usado / teto : 0;

  if (teto > 0 && usado >= teto) {
    return {
      pode: false,
      motivo:
        `teto de gasto da IA atingido: US$ ${usado.toFixed(2)} de US$ ${teto.toFixed(2)} em ${mes}. ` +
        'A extensão segue funcionando sem IA — mude o teto na aba Config.',
      usado,
      teto,
      fracao,
    };
  }
  return { pode: true, motivo: '', usado, teto, fracao };
}
