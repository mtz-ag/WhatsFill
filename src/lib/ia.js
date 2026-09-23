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
 * `ehPedidoDeEndereco` vem de lá e não é reescrito aqui: é o INVARIANTE do nosso pedido de
 * endereço, e a regra deste projeto é que duas cópias de um invariante divergem na primeira
 * reescrita do texto. Ver `AVISOS_QUE_IMPEDEM_ENVIO.enderecoSemMaterial`.
 */
import { ehPedidoDeEndereco, semGabinete } from './templates.js';
import {
  ehPedidoDeRoupa,
  falouDeSaude,
  trouxeDenuncia,
  pedeAjudaFinanceira,
  pedeEmprego,
  pedeAlgoIndefinido,
  reclamaSemResposta,
  ofereceEventoPelaCampanha,
} from './cortesia.js';

/**
 * **Órgão ou benefício citado: é problema pessoal mesmo sem verbo de pedir.** Serve a uma coisa só —
 * decidir se a regra 11 (*"não somos canal de resolução de problemas"*) entra no bloco do contato.
 * Errar aqui não manda nada para ninguém: no máximo a regra não é repetida colada no pedido, e ela
 * continua no prompt de sistema.
 */
const PROBLEMA_PESSOAL =
  /(inss|aposentadoria|aposentad[oa]|benef[íi]cio|bpc|loas|aux[íi]lio|bolsa\s+fam[íi]lia|cadastro\s+[úu]nico|cras|creche|vaga\s+na\s+escola|despejo|desempregad|sem\s+emprego|conta\s+atrasada|luz\s+cortada|[áa]gua\s+cortada|fila\s+d[ao]\s+(sus|cirurgia)|pens[ãa]o|per[íi]cia)/i;

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
    gabinete ? `Quem é quem neste mandato (informação da assessoria — use-a como fonte e não invente o que não estiver aqui):\n${gabinete}\n` : '',
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

// ---------------------------------------------------------------------------
// Provedor — Anthropic ou OpenAI
// ---------------------------------------------------------------------------

/**
 * **O provedor sai do NOME DO MODELO, e não de uma segunda configuração.**
 *
 * Pedido dele (07/09/2026): *"faça agora a implementação para utilizar a api do chatgpt"*, depois
 * de comparar os custos — *"o chatgpt continua dando respostas melhores"*.
 *
 * Poderia ser um campo "provedor" na Config ao lado do campo "modelo". Não é, e a razão está
 * registrada no `CLAUDE.md` duas vezes: **dois controles para a mesma coisa divergem**, e a
 * divergência aqui seria muda — provedor Anthropic com modelo `gpt-5` dá 400, e o painel diria
 * *"a API recusou"* sem dizer que o problema é a combinação. O nome do modelo já identifica a casa
 * sem ambiguidade, então ele é a única escolha.
 *
 * **`o1`/`o3` entram** porque a família de raciocínio da OpenAI não começa com `gpt`. Nada mais é
 * reconhecido: modelo com nome estranho cai em Anthropic, que é onde a chave dele já está.
 */
export const PROVEDOR_ANTHROPIC = 'anthropic';
export const PROVEDOR_OPENAI = 'openai';
/**
 * **A terceira casa: OpenRouter, para o Qwen** — decisão dele (18/09/2026), escolhendo o OpenRouter
 * (empresa americana) em vez da Alibaba direto. O modelo do OpenRouter tem o nome com a BARRA do
 * fabricante (`qwen/qwen3.7-plus`), e é a barra que identifica a casa: nenhum modelo da Anthropic ou
 * da OpenAI tem barra no nome.
 */
export const PROVEDOR_OPENROUTER = 'openrouter';

export function provedorDoModelo(modelo) {
  const m = String(modelo || '').trim();
  if (m.includes('/')) return PROVEDOR_OPENROUTER;
  return /^(gpt-|o[1-9]|chatgpt)/i.test(m) ? PROVEDOR_OPENAI : PROVEDOR_ANTHROPIC;
}

/**
 * Onde a chave de cada provedor mora no armazenamento.
 *
 * **`iaChave` continua sendo a da Anthropic** — renomear apagaria a chave que ele já tem salva,
 * porque `store.get` só mescla o padrão em chave que FALTA (a armadilha do `-contato-assessor`).
 * As duas convivem: trocar de modelo não pode obrigar a colar chave de novo.
 */
export const CHAVE_DO_PROVEDOR = {
  [PROVEDOR_ANTHROPIC]: 'iaChave',
  [PROVEDOR_OPENAI]: 'iaChaveOpenai',
  [PROVEDOR_OPENROUTER]: 'iaChaveOpenrouter',
};

/** O nome que aparece na tela, por provedor. */
export const NOME_DO_PROVEDOR = {
  [PROVEDOR_ANTHROPIC]: 'Anthropic (Claude)',
  [PROVEDOR_OPENAI]: 'OpenAI (ChatGPT)',
  [PROVEDOR_OPENROUTER]: 'OpenRouter (Qwen)',
};

/**
 * Modelos da OpenAI que aceitam `reasoning_effort`.
 *
 * **Lista de permissão, pela lição do `effort` da Anthropic:** o Haiku 4.5 RECUSA o parâmetro com
 * 400, e a lista inversa faria todo modelo futuro nascer quebrado. Quem não está aqui roda sem o
 * parâmetro — que é o padrão do modelo, e não uma degradação. Vale também para o modelo que ele
 * digitar à mão: nascer sem o parâmetro é o lado barato do erro.
 */
const MODELOS_COM_RACIOCINIO = new Set(['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.6-luna']);

/**
 * O esquema JSON no formato que o **strict mode** da OpenAI exige.
 *
 * Duas exigências que os nossos esquemas não cumprem, e por isso esta função existe:
 *
 *  - **toda propriedade tem que estar em `required`.** Os três esquemas daqui deixam campos
 *    opcionais de propósito (`templateId` só vale quando a ação é responder, `cidade` só quando é
 *    corrigir, `motivo` é enfeite útil) — e o strict mode recusa o esquema inteiro por causa
 *    disso, com 400. Exigir tudo não muda nada do nosso lado: `validarDecisao`, `validarCidade` e
 *    `validarRascunho` já tratam campo vazio, porque a IA sempre pôde mandar string vazia;
 *  - **`additionalProperties: false` em todo objeto**, inclusive nos aninhados.
 *
 * **`enum` vazio é removido.** `esquemaDaDecisao([])` produz `enum: []`, que não casa com valor
 * nenhum: o modelo não teria o que responder e a chamada seria paga para nada.
 *
 * Não muta a entrada — o esquema original continua servindo a Anthropic na mesma chamada.
 */
export function esquemaEstrito(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(esquemaEstrito);

  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'enum' && Array.isArray(v) && !v.length) continue;
    out[k] = v && typeof v === 'object' ? esquemaEstrito(v) : v;
  }
  if (out.type === 'object' && out.properties && typeof out.properties === 'object') {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties);
  }
  return out;
}

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
  // Na OpenAI o cache é AUTOMÁTICO e o mínimo é 1.024 para todos — não se pede, não se paga para
  // escrever, e o desconto de leitura é o mesmo 10%. Com o prompt de hoje (~5.300 tokens) pega
  // em qualquer um dos três.
  'gpt-5': 1024,
  'gpt-5-mini': 1024,
  'gpt-5-nano': 1024,
  'gpt-5.6-luna': 1024,
  // Não se sabe se o OpenRouter cacheia o Qwen: sem cache é o esperado, e o "cache N" no log diz se
  // pegou. Alarme de "SEM CACHE" por desconhecimento treinaria a ignorar o alarme.
  'qwen/qwen3.7-plus': Number.POSITIVE_INFINITY,
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

/**
 * **O corpo da requisição, para as duas casas** — um lugar só, porque os três pedidos (decisão,
 * rascunho, cidade) diferem apenas no esquema, no teto de saída e no esforço.
 *
 * O que é IGUAL nos dois e não aparece aqui: o texto. `montarSistema*` e `montarContato*` são
 * português puro e não sabem de provedor nenhum — é o que torna a troca de API contida.
 *
 * **As quatro diferenças que importam:**
 *
 *  1. o sistema vai em `messages[0]` com `role: 'system'`, e não num campo próprio;
 *  2. o esquema vai em `response_format.json_schema` com `strict: true` — e por isso passa pelo
 *     `esquemaEstrito`;
 *  3. **`max_completion_tokens`, nunca `max_tokens`**: a família GPT-5 RECUSA o nome antigo com
 *     400. É a mesma classe de armadilha do `effort` no Haiku;
 *  4. **nada de `cache_control`**: na OpenAI o cache é automático a partir de 1.024 tokens de
 *     prefixo, não se pede e **não se paga para escrever**. Mandar o campo daria 400.
 */
function corpo({ sistema, contato, modelo, esquema, nome, esforco, maxTokens }) {
  /**
   * **OpenRouter: o formato da OpenAI, com duas travas a mais** (18/09/2026).
   *
   *  - `provider.require_parameters`: só servidores que aceitam TODOS os parâmetros — sem isto o
   *    pedido pode cair num servidor que ignora o esquema, e o JSON volta solto;
   *  - `provider.data_collection: 'deny'`: só servidores que não guardam nem treinam com o que
   *    mandamos. É conversa de eleitor, e foi a condição para o Qwen entrar.
   *
   * `max_tokens` (o OpenRouter aceita os dois nomes) e sem parâmetro de raciocínio: o Qwen3.7 Plus
   * não está na lista de quem raciocina, e o padrão do modelo é o lado barato do erro.
   */
  if (provedorDoModelo(modelo) === PROVEDOR_OPENROUTER) {
    return {
      model: modelo,
      messages: [
        { role: 'system', content: sistema },
        { role: 'user', content: contato },
      ],
      max_tokens: maxTokens,
      response_format: {
        type: 'json_schema',
        json_schema: { name: nome, strict: true, schema: esquemaEstrito(esquema) },
      },
      provider: { require_parameters: true, data_collection: 'deny' },
    };
  }
  if (provedorDoModelo(modelo) === PROVEDOR_OPENAI) {
    const body = {
      model: modelo,
      messages: [
        { role: 'system', content: sistema },
        { role: 'user', content: contato },
      ],
      max_completion_tokens: maxTokens,
      response_format: {
        type: 'json_schema',
        json_schema: { name: nome, strict: true, schema: esquemaEstrito(esquema) },
      },
    };
    /**
     * **O raciocínio é cobrado como SAÍDA e cabe DENTRO do teto** — a armadilha do Opus 5, que
     * custou uma sessão de diagnóstico, na casa da OpenAI. Com os 512 da conferência de cidade, o
     * raciocínio consome a cota e o JSON sai truncado: **chamada paga que devolve nada**.
     *
     * O piso é seguro porque teto não é gasto: paga-se pelo token produzido, não pelo limite. E é
     * o `reasoning_effort: 'low'` que segura a conta de verdade.
     */
    if (MODELOS_COM_RACIOCINIO.has(modelo)) {
      body.reasoning_effort = esforco;
      body.max_completion_tokens = Math.max(maxTokens, 2048);
    }
    return body;
  }

  return {
    model: modelo,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: contato }],
    output_config: saida(modelo, esforco, { type: 'json_schema', schema: esquema }),
  };
}

export function montarRequisicao({ sistema, contato, ids, modelo = MODELO_PADRAO }) {
  return corpo({
    sistema,
    contato,
    modelo,
    esquema: esquemaDaDecisao(ids),
    nome: 'decisao',
    esforco: 'low',
    maxTokens: 2048,
  });
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

// ---------------------------------------------------------------------------
// Conferência da etiqueta de MATERIAL
// ---------------------------------------------------------------------------

/**
 * **A IA confere se é mesmo caso de material antes da etiqueta** — pedido dele (16/09/2026): *"etiqueta
 * de material continua problemática; quando o determinístico identificar material, a IA assume e
 * confere se realmente é uma situação de pedido de material para então etiquetar"*.
 *
 * **Por que a etiqueta é o lugar certo para gastar uma chamada:** ela manda PULAR o contato em toda
 * passada, para sempre, e o põe na lista de quem espera ENTREGA. É a escrita mais cara de errar da
 * rodada depois de "sem interesse" — e as três portas que a acendem por texto erraram em série: a
 * palavra "material" solta (3.60), a "casa" do endereço (08/09) e o rascunho da IA que pede endereço a
 * quem não pediu nada (a forma curta, 12/09).
 *
 * Mesmo molde da conferência de cidade: prompt curto e próprio, esquema pequeno, e **`incerto` não
 * marca** — a dúvida não vira etiqueta permanente.
 */
export function esquemaDoMaterial() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['acao', 'motivo', 'confianca'],
    properties: {
      acao: {
        type: 'string',
        enum: ['material', 'nao'],
        description: 'material = é caso de ENVIO de material físico de campanha; nao = não é',
      },
      motivo: { type: 'string', description: 'Uma frase curta, em português, dizendo por quê. Vai para o log.' },
      confianca: { type: 'number', description: 'De 0 a 1. Abaixo de 0,7 o painel não marca nada.' },
    },
  };
}

/** Abaixo disto a resposta "material" não marca — a etiqueta faz pular para sempre. */
export const CONFIANCA_MATERIAL = 0.7;

export function montarSistemaMaterial({ regras = '' } = {}) {
  return [
    'Você confere uma etiqueta no atendimento de WhatsApp de um mandato parlamentar no Rio Grande do Sul.',
    '',
    'Um programa achou que esta conversa é um caso de MATERIAL DE CAMPANHA a ENVIAR, e vai pôr uma',
    'etiqueta que tira o contato da fila e o manda para a equipe que entrega material. Sua tarefa é',
    'dizer se ele acertou. Você não escreve mensagem e não fala com ninguém.',
    '',
    'É "material" quando:',
    '- a pessoa quer RECEBER FOLHETO (santinho, panfleto), ADESIVO ou a COLINHA impressa — é só isso que a',
    '  campanha envia; ou',
    '- ela mandou o endereço PARA RECEBER esse material; ou',
    '- ela aceitou ser voluntária sem pagamento e nós pedimos o endereço para mandar o material.',
    '',
    'NÃO é "material":',
    '- conteúdo DIGITAL: "quero receber o material" de um anúncio, vídeo, PDF, arte ou card para',
    '  compartilhar no grupo ou nas redes;',
    '- roupa (camiseta, boné, colete) e qualquer outro item (bandeira, placa, banner): não',
    '  fornecemos — a equipe do material não tem o que entregar;',
    '- bem que teria de ser comprado (remédio, cadeira de rodas, cesta), dinheiro ou emprego;',
    '- endereço citado por outro motivo: reclamação de rua, onde mora, local de evento;',
    '- NÓS termos pedido o endereço sem ela ter pedido material nem aceitado ser voluntária.',
    '',
    'Linhas marcadas "(texto do ANÚNCIO…)" foram escritas pela campanha, não por ela: o clique',
    'num anúncio de material digital não é pedido de material físico.',
    '',
    'Na dúvida, "nao". A etiqueta faz o contato ser pulado para sempre e aparecer na lista de entrega;',
    'não marcar custa uma linha no log.',
    '',
    regras ? `Instruções adicionais do Thiago:\n${regras}\n` : '',
  ].join('\n');
}

/**
 * O bloco sobre este contato. `gatilho` é o que o programa viu; `acabamosDeMandar` é a mensagem
 * NOSSA que acendeu a etiqueta — ela saiu agora e ainda não está na conversa que o painel tem.
 */
export function montarContatoMaterial({ mensagens = [], gatilho = '', acabamosDeMandar = '' } = {}) {
  const conversa = (mensagens || [])
    .map((m) => {
      const texto = umaLinha(typeof m === 'string' ? m : m?.texto || '', 800);
      const nos = typeof m !== 'string' && m?.de === 'nos';
      return texto ? `${nos ? 'NÓS' : 'ELA'}: ${texto}` : '';
    })
    .filter(Boolean)
    .slice(-40);
  if (String(acabamosDeMandar || '').trim()) conversa.push(`NÓS (agora): ${umaLinha(acabamosDeMandar, 800)}`);
  return [
    `O que o programa viu: ${gatilho || '(não informado)'}`,
    '',
    'A conversa, na ordem ("NÓS" é o atendimento):',
    conversa.length ? conversa.join('\n') : '(vazia)',
  ].join('\n');
}

export function montarRequisicaoMaterial({ sistema, contato, modelo = MODELO_PADRAO }) {
  return corpo({ sistema, contato, modelo, esquema: esquemaDoMaterial(), nome: 'material', esforco: 'low', maxTokens: 512 });
}

/**
 * `{acao: 'material'|'nao'|'incerto', motivo, confianca, aviso}`. **Só `material` marca**, e só com
 * `CONFIANCA_MATERIAL`; ilegível, falho ou abaixo do corte vira `incerto`, que NÃO marca.
 */
export function validarMaterial(bruto) {
  const vazio = { acao: 'incerto', motivo: '', confianca: 0, aviso: '' };
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
  if (d.acao === 'nao') return { acao: 'nao', motivo, confianca, aviso: '' };
  if (d.acao === 'material' && confianca >= CONFIANCA_MATERIAL) return { acao: 'material', motivo, confianca, aviso: '' };
  if (d.acao === 'material') return { ...vazio, motivo, confianca, aviso: `a IA achou que sim, mas com ${Math.round(confianca * 100)}% de certeza` };
  return { ...vazio, aviso: 'a IA devolveu uma resposta fora das opções' };
}

// ---------------------------------------------------------------------------
// Conferência das OUTRAS etiquetas de julgamento: pedido e sem interesse
// ---------------------------------------------------------------------------

/**
 * **A IA confere antes de o determinístico pôr etiqueta** — relato dele (17/09/2026): *"o determinístico
 * está botando etiqueta antes da IA confirmar qualquer coisa"*.
 *
 * **Medido no painel: a de MATERIAL já passava pela IA desde 16/09; estas duas não.** A de pedido de
 * dinheiro/emprego saía pelo SINAL antes de a IA escrever uma linha — no mesmo caso que a IA ia
 * responder —, e a de sem interesse saía com a tecla `s` do fluxo. As duas são de detector de TEXTO, que
 * este projeto já corrigiu dezenas de vezes (o "dinheiro" da Elenir, a piada do Alfredo, o áudio do
 * lopezp4295), e as duas ficam PERMANENTES no CRM.
 *
 * **Material não entrou aqui de propósito**: ela já funciona, tem o próprio prompt afinado, e mexer nas
 * três ao mesmo tempo é a lição da v3.63. O molde é o mesmo: prompt curto, esquema pequeno, e
 * **`incerto` não marca**.
 */
export const TIPOS_DE_ETIQUETA = {
  pedido: {
    rotulo: 'PEDIU DINHEIRO OU EMPREGO',
    efeito: 'marca o contato, para sempre, como quem pediu ajuda financeira ou emprego ao mandato',
    sim: [
      'ela pede dinheiro, PIX, empréstimo, ajuda para pagar conta, aluguel, remédio, cesta, cirurgia ou',
      '  outro bem que teria de ser COMPRADO, para ela ou para alguém da família; ou',
      'ela pede emprego, vaga, contratação ou trabalho REMUNERADO (inclusive "trabalhar na campanha"',
      '  querendo ganhar).',
    ],
    nao: [
      '"dinheiro", "auxílio" ou "emprego" citados em crítica ou opinião política, sem pedir nada;',
      'contar uma dificuldade sem pedir nada ao mandato;',
      'oferecer-se como voluntária, sem pagamento;',
      'pedir material de campanha (adesivo, bandeira, santinho) — isso não é pedido de dinheiro;',
      'perguntar sobre projeto, lei ou programa de emprego;',
      'pergunta retórica ("se eu pedisse ajuda, vocês ajudariam? não, né").',
    ],
  },
  seminteresse: {
    rotulo: 'SEM INTERESSE',
    efeito:
      'marca o contato, para sempre, como SEM INTERESSE e conclui o atendimento SEM responder nada — ele ' +
      'nunca mais recebe mensagem da campanha',
    sim: [
      'ela pede para não receber mais mensagens, sair da lista ou parar de ser procurada; ou',
      'ela recusa a campanha de forma clara ("não tenho interesse", "não voto em vocês"); ou',
      'ela ofende NÓS: o Capitão Martim, a campanha, o atendimento, o PL, o Republicanos ou os aliados',
      '  da chapa; ou',
      'ela oferece o voto em troca de dinheiro.',
    ],
    nao: [
      'criticar ou xingar o ADVERSÁRIO (PT, Lula, esquerda) — quem faz isso está do nosso lado;',
      'recusar ir a um EVENTO — não é recusar a campanha;',
      'desabafo ou raiva com a política em geral, com o governo ou com a prefeitura;',
      'piada, ironia sobre si mesma, reclamação de que não foi atendida, "não posso falar agora";',
      'texto longo de opinião: quem escreve nove linhas está conversando;',
      'áudio transcrito confuso, com "não" solto no meio.',
    ],
  },
};

export function esquemaDaEtiqueta() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['acao', 'motivo', 'confianca'],
    properties: {
      acao: {
        type: 'string',
        enum: ['sim', 'nao'],
        description: 'sim = a etiqueta está certa para esta conversa; nao = não está',
      },
      motivo: { type: 'string', description: 'Uma frase curta, em português, dizendo por quê. Vai para o log.' },
      confianca: { type: 'number', description: 'De 0 a 1. Abaixo de 0,7 o painel não marca nada.' },
    },
  };
}

/** Abaixo disto "sim" não marca — as duas etiquetas são permanentes, e uma delas conclui sem responder. */
export const CONFIANCA_ETIQUETA = 0.7;

export function montarSistemaEtiqueta({ tipo, regras = '' } = {}) {
  const t = TIPOS_DE_ETIQUETA[tipo];
  if (!t) return '';
  return [
    'Você confere uma etiqueta no atendimento de WhatsApp de um mandato parlamentar no Rio Grande do Sul.',
    '',
    `Um programa leu palavras nesta conversa e vai pôr a etiqueta "${t.rotulo}", que ${t.efeito}.`,
    'Sua tarefa é dizer se ele acertou. Você não escreve mensagem e não fala com ninguém.',
    '',
    'É "sim" quando:',
    ...t.sim.map((l) => (l.startsWith('  ') ? l : `- ${l}`)),
    '',
    'É "nao" quando:',
    ...t.nao.map((l) => `- ${l}`),
    '',
    'Linhas marcadas "(texto do ANÚNCIO…)" foram escritas pela campanha, não por ela.',
    'Julgue o que ELA escreveu, não o que nós escrevemos.',
    '',
    'Na dúvida, "nao". A etiqueta fica no CRM para sempre; não marcar custa uma linha no log.',
    '',
    regras ? `Instruções adicionais do Thiago:\n${regras}\n` : '',
  ].join('\n');
}

export function montarRequisicaoEtiqueta({ sistema, contato, modelo = MODELO_PADRAO }) {
  return corpo({ sistema, contato, modelo, esquema: esquemaDaEtiqueta(), nome: 'etiqueta', esforco: 'low', maxTokens: 512 });
}

/** `{acao: 'sim'|'nao'|'incerto', motivo, confianca, aviso}` — só `sim` com a confiança mínima marca. */
export function validarEtiqueta(bruto) {
  const vazio = { acao: 'incerto', motivo: '', confianca: 0, aviso: '' };
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
  if (d.acao === 'nao') return { acao: 'nao', motivo, confianca, aviso: '' };
  if (d.acao === 'sim' && confianca >= CONFIANCA_ETIQUETA) return { acao: 'sim', motivo, confianca, aviso: '' };
  if (d.acao === 'sim') return { ...vazio, motivo, confianca, aviso: `a IA achou que sim, mas com ${Math.round(confianca * 100)}% de certeza` };
  return { ...vazio, aviso: 'a IA devolveu uma resposta fora das opções' };
}

export function montarRequisicaoCidade({ sistema, contato, modelo = MODELO_PADRAO }) {
  return corpo({
    sistema,
    contato,
    modelo,
    esquema: esquemaDaCidade(),
    nome: 'cidade',
    esforco: 'low',
    // Conferência de um campo: a saída são três palavras e uma frase. Teto baixo é economia real
    // quando isto roda uma vez por contato da fila.
    maxTokens: 512,
  });
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
  /**
   * **As respostas prontas iam SEM NOME e cortadas em oito** — print da nicce (09/09/2026).
   *
   * Ela escreveu *"Trabalho com divulgação de campanha nas redes sociais… gostaria de saber se não
   * precisa de alguém pra trabalhar"* e o rascunho perguntou se ela queria *"trabalho remunerado ou
   * voluntário"*, pediu portfólio e prometeu *"registrar sua mensagem para que a equipe responsável
   * analise"*. Ele: *"a IA deve usar como base a nossa resposta pra esses casos"* — e a resposta
   * existe desde a 3.15, com o texto que ele ditou (voluntário, sem remuneração, endereço de quem
   * tiver interesse).
   *
   * **Medido: ela era a NONA da lista, e o corte era `slice(0, 8)`. A IA nunca a viu.** Somando, 13
   * das 21 respostas de fábrica ficavam de fora — entre elas as de evento, as de boas-vindas e a de
   * perguntar em que pode ajudar.
   *
   * **E as oito que entravam iam SEM O NOME**, o que as tornava inutilizáveis como base: oito textos
   * soltos não dizem a que caso cada um serve, e escolher entre eles vira adivinhação — foi assim
   * que o texto do "falar com o deputado" saiu para quem perguntou por um *representante* (3.14).
   *
   * O `name` é o que separa "use a que serve" de "não copie as outras", e é por isso que as duas
   * regras podem conviver agora.
   */
  const exemplos = templates
    .slice(0, 24)
    // `semConviteAoCaso`: as frases que abrem atendimento do caso não chegam à IA (a Irema, 10/09).
    .map((t) => `— **${umaLinha(t.name || 'sem nome', 90)}**: ${umaLinha(semConviteAoCaso(t.text), 500)}`)
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
     * **"Gabinete" saiu do vocabulário** — decisão dele (07/09/2026): *"não se refira mais a
     * gabinete do Capitão Martim, se refira como assessoria ou equipe; a IA deve ficar ciente
     * também"*.
     *
     * Vale para os dois lados do prompt: aqui, para o que a IA ESCREVE; e no bloco "Quem é quem",
     * cuja própria etiqueta dizia *"informação do gabinete"* — a palavra estava sendo ensinada a
     * ela pelo texto que a instrui.
     */
    '   E NUNCA escreva "gabinete". Quem fala aqui é a EQUIPE ou a ASSESSORIA do Capitão Martim —',
    '   é assim que este mandato se apresenta. Vale para qualquer forma: "o gabinete", "nosso',
    '   gabinete", "gabinete do deputado".',
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
     * **"Como está o capitão?" é carinho, não pedido de informação** — relato dele (17/09/2026): as três
     * opções responderam que não sabem, e ele: *"a resposta deveria ser enrolar dizendo que está bem e
     * na correria por causa das eleições; se tiver um acontecimento eu ponho no dossiê ou nas instruções
     * extras"*. A causa era esta regra somada à seção 20 do documento dele (*"informação pessoal do
     * candidato… Não sabendo: não quero te passar uma informação errada"*) — lidas ao pé da letra, uma
     * pergunta de cortesia virou pedido de dado pessoal. O documento dele não foi tocado.
     */
    '   EXCEÇÃO: perguntar COMO ELE ESTÁ ("como está o capitão?", "o Martim está bem?") não é pedido',
    '   de informação, é carinho. Responda que ele está bem e na correria da campanha — nunca "não sei",',
    '   "não tenho essa informação" nem "vou verificar". Se as instruções ou o "Quem é quem" trouxerem',
    '   notícia dele (viagem, saúde, acontecimento), use a notícia no lugar.',
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
    /**
     * **A outra metade da regra 5, e é sobre o PRESENTE** — print do Lucas Mendes (07/09/2026).
     *
     * Ele perguntou como conseguir um boné, e o rascunho abriu com *"Temos adesivos e camisetas da
     * campanha disponíveis"*. Ele apagou: *"a IA confirmou algo sem saber"*. Nada no prompt fala de
     * estoque — nem quais itens existem, nem se existem —, então qualquer frase dessas é invenção.
     *
     * Escrito como PROIBIÇÃO com o exemplo do caso real, que é a forma que funcionou nas outras
     * quatro regras: mandar "não invente" sem mostrar a frase inventada não muda o que o modelo faz.
     */
    '   E NUNCA diga que temos o que não está na lista do material, logo abaixo. Proibido escrever:',
    '   "temos bandeiras disponíveis", "temos camisetas", "o boné está disponível".',
    /**
     * **A regra dele para MATERIAL, ditada em 07/09/2026**, logo depois da print do Lucas Mendes:
     * *"quando for relacionado a material nunca confirmar nada; nesse caso era específico como
     * adesivos, se não for específico perguntar que tipo de material a pessoa precisa"*.
     *
     * São duas metades, e a segunda é o que faltava. "Nunca confirmar" já estava virando trava
     * (`AVISOS_QUE_IMPEDEM_ENVIO.afirmouTer`); o que não existia era **o que dizer no lugar**, e
     * fechar um caminho sem escrever a saída troca um defeito por uma resposta muda — a lição que
     * este projeto já pagou com o modelo padrão (02/09).
     *
     * **A divisão é ESPECÍFICO x GENÉRICO**, e é dele: quem já nomeou o item (o Lucas disse "boné")
     * não pode ser perguntado de novo o que quer — isso é fazer a pessoa repetir o que acabou de
     * escrever. Quem só disse "material" é que precisa da pergunta.
     */
    /**
     * **O ESCOPO da regra faltava, e sem ele ela alcançou uma cadeira de rodas.**
     *
     * Print da Cleo (08/09/2026): *"preciso que compre um encosto Rumer ali na ortoponto"* e *"uma
     * loja de venda de cadeira de roda"*. O rascunho abriu dizendo, corretamente, que *"um mandato
     * não pode comprar nem doar bens a eleitor por causa da lei eleitoral"* — e **em seguida pediu o
     * endereço completo e prometeu o repasse à equipe de materiais**, abrindo a porta que a frase
     * anterior tinha fechado. Ele: *"IA confundindo entrega de material com pedido de ajuda"*.
     *
     * **Ela DIFERENCIOU e mesmo assim errou o caminho, e a culpa é da regra:**
     *
     *  - a condição escrita era a FORMA do pedido (*"ela disse qual item quer"*), nunca a CATEGORIA
     *    do item — e um encosto ortopédico é um item que ela disse que quer;
     *  - medido no prompt: a palavra "material" aparecia cinco vezes e **`"material de campanha"`
     *    nenhuma** — eu nunca escrevi a fronteira;
     *  - e a POSIÇÃO decide: esta regra está na linha 298 de 350, colada no pedido, enquanto a seção
     *    9 do padrão dele (pedido de dinheiro) está na linha 80. É a armadilha de 07/09 outra vez —
     *    **regra que vive longe do ponto em que o modelo começa a escrever não é cumprida** —, com o
     *    agravante de que a regra PERTO era a errada, e é a única das duas que diz o que FAZER.
     */
    /**
     * **A LISTA VIROU DE PERMISSÃO, e a de bloqueio durou um dia.**
     *
     * Na 3.13 (o caso da Cleo) eu escrevi o escopo como uma lista do que NÃO é material — cadeira de
     * rodas, órtese, remédio, colchão. No dia seguinte veio o print do Oseias pedindo **uma bota de
     * gaúcho número 42**, e o rascunho ofereceu o endereço e o repasse à equipe de materiais outra
     * vez: bota não estava na lista, e nenhuma lista de bloqueio fecha.
     *
     * Ele deu a regra e a razão dela: *"nossa lista é pequena do que podemos dar, que é (folhetos,
     * adesivos etc); todo o resto entra como pedido de emprego, ajuda, doação"*.
     *
     * **É a mesma disciplina de `MODELOS_COM_ESFORCO`, e está escrita no CLAUDE.md desde então:**
     * lista de permissão, nunca de bloqueio — a inversa faz todo item novo nascer aceito até alguém
     * notar. Aqui o item novo que nasce aceito é um bem que o mandato não pode dar a eleitor.
     *
     * **A lista é curta porque o estoque é curto**, e ela é a mesma de `cortesia.OBJETO_DE_MATERIAL`
     * — a mesma que decide o sinal `pedeMaterial`. Duas listas separadas divergiriam na primeira vez
     * que ele acrescentasse um item.
     */
    /**
     * **O CRITÉRIO deixou de ser a lista e passou a ser a MARCA** — print da Sirlei (09/09/2026).
     *
     * Ela mandou nome, cidade, rua e número — o endereço inteiro — e pediu uma **placa**. O rascunho
     * respondeu *"não é possível fornecer placas nem doar esse tipo de bem, a lei eleitoral
     * proíbe"* e **recitou a minha lista para ela**: *"posso informar quais materiais de campanha
     * trabalhamos (adesivo, santinho, panfleto, folder, card, informativo, cartilha, bandeira,
     * camiseta, boné e conteúdo digital)"*.
     *
     * Regra dele: *"a pessoa se expressou mal e falou placa, seria banner ou algo do tipo.
     * Provavelmente não temos, mas isso é melhor encaminhar para equipe do material como todo o
     * resto, e a equipe do material decide o que tem e não tem."*
     *
     * **Dois defeitos meus, e o segundo é pior:**
     *
     *  1. **A lista fechada da 3.16 virou lista de ESTOQUE, e ela não é isso.** Ela nasceu para
     *     separar propaganda de bem que precisa ser comprado (a cadeira de rodas, a bota) — e eu a
     *     escrevi de um jeito que fez a IA **recusar propaganda** que talvez exista. **Quem decide o
     *     que tem é a equipe dos materiais**, e é a regra da Jonice (08/09) desde o começo.
     *  2. **A lista foi para dentro da mensagem, palavra por palavra.** Texto de prompt não é texto
     *     para eleitor, e nada dizia isso.
     *
     * **O critério que fica é melhor que qualquer lista: a coisa leva o NOME, o NÚMERO ou a MARCA da
     * campanha?** Placa, banner e faixa levam; cadeira de rodas e bota não. Isso resolve o item que
     * ninguém previu sem precisar prever, que é o que uma lista nunca faz.
     */
    /**
     * **SÓ FOLHETO E COLINHA** — regra dele (22/09/2026): *"não fornecemos nenhum material além de
     * folhetos e colinhas"*. **Substitui a regra da Sirlei (09/09)**, em que o estoque era desconhecido
     * e a IA repassava tudo à equipe dos materiais para ela decidir: agora o estoque é conhecido, e
     * repassar um adesivo que não existe cria a expectativa que a lei trata.
     */
    '   **O QUE TEMOS PARA ENVIAR É POUCO, E ESTÁ ESCRITO AQUI: FOLHETO (santinho, panfleto — o mesmo',
    '   papel), ADESIVO e a COLINHA com os números.** Nada além disso.',
    '   Qualquer outro item de campanha — bandeira, placa, banner, faixa, cartaz, bottom,',
    '   chaveiro — NÃO temos: diga isso em UMA frase gentil e que o que TEMOS são folhetos e adesivos.',
    '   (Escreva "o que temos são folhetos e adesivos", e não "consigo te mandar": isso é prometer entrega.)',
    '   Sem "vou verificar", sem repassar o item que não existe e sem sugerir onde comprar.',
    '   **ROUPA NÃO É MATERIAL, E NÃO FORNECEMOS NENHUMA:** camiseta, camisa, boné, colete, blusa,',
    '   uniforme ou qualquer peça de vestir, com ou sem a marca da campanha. A lei eleitoral proíbe a',
    '   campanha de distribuir camiseta, boné e brinde (Lei 9.504/97, art. 39, § 6º). Diga em UMA',
    '   frase gentil que não temos roupa nem boné para enviar e PARE: sem pedir endereço, sem repassar',
    '   à equipe, sem "vou verificar" e sem sugerir onde comprar. Se ela pediu folheto junto, siga a',
    '   regra do folheto só para ESSE item.',
    '   **O que fica FORA desta regra é o bem de uso PESSOAL, que teria de ser comprado** e não leva a',
    '   marca da campanha: cadeira de rodas, órtese, muleta, remédio, óculos, colchão, eletrodoméstico,',
    '   móvel, cesta básica, passagem, exame, consulta, calçado e roupa comum. Aí sim é PEDIDO DE',
    '   AJUDA OU DOAÇÃO, e vai para a seção 9 do padrão: NEGUE com respeito, sem humilhar, e PARE aí —',
    '   sem endereço, sem equipe de materiais e sem promessa de repasse.',
    '   **E nunca na mesma mensagem:** se você disse que o mandato não pode comprar nem doar bens,',
    '   está proibido pedir endereço ou prometer encaminhamento depois disso. As duas coisas juntas',
    '   se contradizem, e quem lê fica esperando a entrega.',
    '   Três situações, e elas se respondem diferente:',
    /**
     * **O caminho do FOLHETO continua sendo o da Jonice (08/09/2026)**: endereço, repasse à equipe
     * responsável, e ela entra em contato. O que mudou em 22/09 é QUAL item percorre esse caminho — só
     * o folheto e a colinha impressa.
     */
    '   (a) ela pediu FOLHETO, santinho, panfleto, ADESIVO ou a colinha IMPRESSA: não pergunte de novo o que',
    '       ela quer. PEÇA O ENDEREÇO COMPLETO e diga que, com ele, o pedido vai para a',
    '       EQUIPE RESPONSÁVEL PELOS MATERIAIS, que entra em contato sobre a entrega.',
    '       **A única promessa que você pode fazer é a de REPASSAR.** Nunca diga que ela vai receber,',
    '       nem quando, nem que "dá para providenciar".',
    '       E não mande ela PROCURAR a equipe (regra 7) — quem repassa somos nós.',
    '   (b) ela pediu a colinha para VOTAR: é a lista digitada da regra 10, não material.',
    '   (c) ela falou em "material" sem dizer qual: pergunte o que ela precisa. Se o anúncio era de',
    '       conteúdo digital, é o conteúdo digital.',
    /**
     * **A regra 6 nasceu da print da Irene (07/09/2026)** — cinco áudios encaminhados de uma vez,
     * todos transcritos, e o rascunho respondeu *"deve ter dado ruim no áudio, pode enviar de
     * novo?"*.
     *
     * **A transcrição chegou inteira** (medido na API: 1.909 caracteres em cinco áudios). O que a
     * IA fez foi responder o que estava DENTRO de um deles: o último do lote é uma pessoa dizendo a
     * outra *"não deu pra ouvir nada que você botou ali, tá mudo?"*. Os áudios eram conversa de
     * terceiros — chamavam gente por outros nomes —, encaminhados para nós.
     *
     * É a mesma classe da legenda de repasse (o Eraldo, 06/09): **pergunta que veio dentro do
     * material que circula não é pergunta para nós**. A diferença é que ali dava para reconhecer o
     * repasse pelo tipo da mensagem, e aqui o que denuncia está no conteúdo — por isso é regra de
     * prompt, com a metade mecânica virando trava em `revisarRascunho`.
     */
    '6. Áudio é GRAVAÇÃO, e gravação circula: as pessoas encaminham para nós áudios de outras',
    '   conversas, inteiros. Quando a transcrição chama alguém por um nome que não é o nosso,',
    '   responde a uma pergunta que ninguém aqui fez, ou é claramente duas outras pessoas',
    '   conversando, ela NÃO está falando conosco: não responda o que está escrito dentro dela.',
    '   Nesse caso o rascunho agradece o envio e trata do que ELA disser por escrito — nada mais.',
    '   E NUNCA diga que o áudio falhou nem peça para reenviar: se a transcrição chegou até você,',
    '   nós ouvimos. Proibido escrever: "deu ruim no áudio", "não consegui ouvir", "pode mandar de',
    '   novo?".',
    '   **A palavra "transcrição" NUNCA sai no rascunho, e nem a ideia.** Ela é máquina nossa: a pessoa',
    '   não sabe o que é isso, não precisa saber, e explicar o mecanismo derruba a confiança — ela',
    '   escreveu para gente. Para ela, nós OUVIMOS — e por isso NÃO se confirma o áudio: responda',
    '   direto ao que ela disse, sem abrir com "ouvi seu áudio" ou "recebi sua mensagem". Proibido escrever',
    '   "a transcrição do seu áudio chegou", "eu li o que você falou" ou qualquer explicação de como o',
    '   áudio virou texto.',
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
    'Ao NEGAR dinheiro, compra, pagamento ou doação, diga SEMPRE o motivo, numa frase curta: "a lei',
    'eleitoral me proíbe" — sem citar artigo e sem aula. Sem o motivo, o "não" soa como má vontade.',
    '',
    /**
     * **O TAMANHO já estava no padrão dele, e o modelo não o cumpria** — print do contato que
     * ofereceu patrocínio (07/09/2026). Ele comparou com o que o ChatGPT escreveu para a mesma
     * conversa: *"deu uma resposta mais de acordo"*. A do rascunho tinha ~880 caracteres e virou
     * aula sobre a lei eleitoral.
     *
     * O item 22 do documento dele diz *"mensagem simples: 1 a 3 frases"* — e está a **3.804
     * tokens** de distância do ponto em que o modelo começa a escrever, no meio de um documento de
     * 37 seções. Repetir a regra ao lado do pedido é o que a torna visível para um modelo pequeno:
     * é o mesmo motivo pelo qual a saudação e o relógio ficam no fim do bloco do contato.
     *
     * **Não é reescrever o documento dele** — é citá-lo onde ele é lido. E a segunda frase é o que
     * o caso pediu: a pergunta era sobre patrocínio, e o modelo respondeu explicando a lei e
     * listando alternativas que ninguém pediu.
     */
    /**
     * **A regra 7 é dele, ditada em 07/09/2026**, respondendo à pergunta que ficou aberta na 2.86
     * sobre o contato que oferecia patrocínio: *"o GPT seguiu o caminho certo porque nada será
     * aceito agora em período eleitoral, os contratos que deviam ser feitos já foram feitos"*.
     *
     * **O que ele decidiu não é "explique melhor": é não abrir porta.** O rascunho que saiu dizia
     * *"a melhor forma é conversar direto com a coordenação"* — e não há coordenação para
     * conversar sobre isso, porque a decisão já está tomada e o prazo já passou. Mandar a pessoa
     * procurar alguém é prometer uma conversa que não vai acontecer, que é a mesma família da
     * promessa de entrega da regra 5.
     *
     * A saída é a do ChatGPT que ele aprovou: **agradecer o apoio e responder o resto**. Quem
     * oferece patrocínio nesta base quase sempre também está apoiando de verdade — o contato da
     * print abriu dizendo que já trabalha na campanha.
     */
    '7. PROPOSTA COMERCIAL (patrocínio, publicidade paga, impulsionamento, permuta, parceria,',
    '   "tenho espaço para apoiadores", orçamento, tabela de preços) NÃO é assunto de atendimento,',
    '   e a resposta não é explicar por quê. Nada disso é aceito em período eleitoral e o que tinha',
    '   de ser contratado já foi. Não discuta a lei, não peça proposta, não diga que alguém vai',
    '   analisar e NÃO mande procurar a coordenação, a equipe nem a campanha — a pessoa já está',
    '   falando com a equipe, e não há porta atrás desta.',
    '   Faça o que faria se ela não tivesse oferecido nada: agradeça o apoio, com sinceridade, e',
    '   responda o resto da mensagem. Sobre a oferta, silêncio é melhor que uma frase.',
    /**
     * **A regra 8 é dele, ditada em 08/09/2026**, com o print do pastor que escreveu *"Gostaria de
     * falar com deputado"* e o texto que ele digitou à mão para responder.
     *
     * Duas metades, e a segunda é a que a IA erraria sozinha: *"fora de eleições tem a opção de
     * encontrar na assembleia mas agora está fora de questão"*. **Oferecer a Assembleia agora seria
     * abrir uma porta que não abre**, exatamente como o *"procure a coordenação"* da regra 7.
     *
     * A resposta pronta `falar-com-deputado` cobre o caso quando a rodada o reconhece; isto aqui é
     * para quando o pedido vem embrulhado em outra coisa e o caso chega à IA.
     */
    '8. QUEM QUER FALAR COM O DEPUTADO EM PESSOA: em período eleitoral, o único caminho é encontrá-lo',
    '   nos EVENTOS DA AGENDA. O WhatsApp e o telefone pessoais dele NÃO são repassados, por motivo',
    '   de segurança — diga isso com desculpas e sem rodeio, é uma frase.',
    '   NÃO ofereça a Assembleia, o gabinete parlamentar nem "marcar uma reunião": fora de eleição',
    '   isso existe, agora está fora de questão, e prometer é abrir porta que não abre.',
    '   E não diga que vai passar o recado para ele. O que você pode dizer com verdade é que a',
    '   mensagem chegou e é lida por aqui.',
    /**
     * **A regra 9 é a FRONTEIRA da regra 8, e nasceu de ela ter sido cruzada** — print de
     * 09/09/2026. A contato escreveu *"Posso falar com algum representante?"* e recebeu a regra 8
     * inteira: período eleitoral, contato pessoal indisponível, eventos da agenda. **Ela não pediu
     * ele.** Perguntou se há gente do outro lado — e há, somos nós.
     *
     * A resposta dele, digitada à mão depois de apagar a da IA, é a regra: *"bom dia, somos da
     * equipe do capitão martim do que precisa?"* — **uma linha**, e é por isso que o tamanho está
     * escrito aqui dentro em vez de ficar só no item 22: a mensagem que saiu tinha cinco frases e
     * mais o pedido de cadastro.
     *
     * **Recusar o que ninguém pediu é a irmã de abrir a porta que não existe** (a regra 7): as duas
     * respondem uma pergunta que a pessoa não fez, e esta ainda dá a impressão de que ela pediu
     * demais logo na primeira mensagem.
     *
     * O que separa as duas regras é o OBJETO, e é o mesmo critério de `cortesia.pedeFalarComDeputado`
     * — que, medido, devolve **null** para a frase dela, corretamente.
     */
    /**
     * **A regra 9 ganhou a segunda forma da mesma pergunta** — print da Denise (09/09/2026). Ela
     * escreveu *"Oiii"* e *"É o deputado ?"*, e o rascunho respondeu com a regra 8 inteira: período
     * de eleição, encontro nos eventos da agenda, WhatsApp pessoal não repassado.
     *
     * Ele: *"dando informações além do necessário; era falar que era do gabinete e se ater ao
     * pedido — exemplo: somos do gabinete do Capitão Martim, em que podemos ajudar?"*
     *
     * **Medido, e o determinístico acertou:** `pedeFalarComDeputado` devolve **null** para a frase
     * dela, corretamente — ela não pediu para falar com ele, perguntou **quem está do outro lado**.
     * `conversaTemPerguntaAberta` casou e o caso foi para a IA, que é o desfecho certo. **O que puxou
     * a regra 8 foi a palavra "deputado" dentro da pergunta** — a regra mais próxima que fala dela
     * venceu, exatamente como o "representante" (3.14) puxou a resposta pronta.
     *
     * A frase que ele escreveu é o modelo, e o que ela tem de notável é o que NÃO tem: nada de
     * agenda, nada de segurança, nada de eleição. **Duas informações e um convite.**
     */
    '9. QUEM PERGUNTA QUEM ESTÁ DO OUTRO LADO. Duas formas da mesma pergunta:',
    '   (a) "posso falar com um representante?", "tem alguém aí?", "isso é robô?", "tem uma pessoa',
    '       falando comigo?" — ela quer saber se existe gente aqui;',
    '   (b) "é o deputado?", "é o Capitão Martim?", "falo com ele mesmo?", "é você mesmo?", "o senhor é',
    '       senador?" — ela acha que é ELE quem está escrevendo.',
    '   **Achar que fala com ele NÃO é problema** — não corrija quem não perguntou. Só quando ela',
    '   PERGUNTAR, diga que aqui é a EQUIPE do Capitão Martim, no formato',
    '   "Somos a equipe do Capitão Martim, em que podemos ajudar?".',
    '   **Se a pergunta também quer saber algo DELE — o cargo, o partido, o número —, responda isso na',
    '   mesma mensagem**, com o dado do bloco "Quem é quem". A "o senhor é senador?": "Somos a equipe do',
    '   Capitão Martim. Ele é deputado estadual." Sem o bloco, não escreva cargo nem número.',
    '   **NÃO acrescente nada além disso.** Nada de período eleitoral, nada de agenda, nada de',
    '   WhatsApp pessoal, nada de explicar por que não é ele.',
    '   Isto NÃO é a regra 8: ela só vale quando a pessoa PEDE ele — para falar, para encontrar, ou o',
    '   contato pessoal dele. Perguntar se é ele NÃO é pedir para falar com ele. Aplicar a regra 8',
    '   aqui é RECUSAR o que ninguém pediu, e sai como se ela tivesse pedido demais.',
    /**
     * **A COLINHA não é material** — decisão dele (09/09/2026): *"quando pedir a colinha só passe a
     * lista com os números e o que cada um é, não entra como material"*.
     *
     * Print do mesmo dia: a contato pediu a colinha dos candidatos e o rascunho respondeu *"me passe
     * o endereço completo para que o pedido vá para a equipe responsável pelos materiais"* — a
     * TERCEIRA vez em dois dias que o caminho do material engoliu um pedido que não era dele (a
     * Cleo, o Oseias, e agora uma lista de números). A trava `enderecoSemMaterial` barrou o envio.
     *
     * **Isto substitui a regra de 07/09** (*"quem pergunta em quem votar recebe a ARTE, não a lista
     * digitada pela IA"*), e o que mudou foi a proteção existir: naquele dia o argumento era que
     * seis números redigitados são seis chances de mandar o eleitor votar em outra pessoa, e nada
     * conferia. **Desde 08/09 `conferirChapa` confere**, lendo a mesma tabela, e barra o envio
     * automático de número colado no nome errado. O risco virou mecânico.
     *
     * **A tabela tem que ESTAR no prompt para esta regra valer**, e por isso `colinha` entrou nos
     * gatilhos do dossiê no mesmo commit — *"quero a colinha"* não o puxava.
     */
    '10. QUEM PEDE A COLINHA (a lista dos candidatos, "em quem votar", "os números de vocês") recebe',
    '    A LISTA, na mesma mensagem: o CARGO, o NOME e o NÚMERO de cada um, um por linha.',
    '    **COPIE da tabela do dossiê, nunca de memória.** Se a tabela não estiver aqui, diga que vai',
    '    confirmar e não escreva número nenhum — número errado manda o eleitor votar em outra pessoa.',
    '    **A colinha NÃO É MATERIAL:** não peça endereço, não fale em equipe de materiais e não',
    '    prometa entrega. A resposta é a lista, e ela cabe na própria mensagem.',
    /**
     * **Encaminhou ao órgão certo? PARE.** Regra dele (09/09/2026), com o print da Bia: o rascunho
     * apontou o SINE e o Emprega Brasil — certo, é o que a resposta pronta dele faz — e **emendou**
     * *"se quiser, eu anoto aqui que você busca panfletagem e posso te ajudar a montar um currículo
     * rápido"*. Ele apagou:
     *
     * > *"só encaminhe pro órgão responsável, evite oferecer serviços fora da nossa alçada como
     * > fazer currículo; isso faz a pessoa retornar várias vezes para pedir outras coisas e não é
     * > nosso foco"*
     *
     * **A razão é operacional e é dele:** cada oferta dessas abre uma porta que alguém vai ter de
     * atender depois, e o atendimento não tem braço. É a irmã do *"procure a coordenação"* (regra 7)
     * com o sinal trocado — lá a porta prometida não existia, aqui ela existe e custa caro.
     *
     * **Fica no PROMPT e não vira trava** porque decidir se uma oferta está dentro da alçada exige
     * saber qual é a alçada, e isso é julgamento: a disciplina deste arquivo é mecânico → conserto,
     * verificável → aviso, o resto → prompt. Medido: o rascunho que saiu tinha **um aviso só, não
     * bloqueante**, e `rascunhoPodeSairSozinho` devolvia **true**.
     *
     * **A última linha desta regra SAIU em 10/09/2026, por decisão dele.** Ela dizia *"se ela JÁ
     * procurou o órgão e NÃO foi atendida, peça que ela conte o que aconteceu"* — eu a tirei da
     * resposta pronta dele, e ela virou triagem. Print da Irema: uma preocupação com aposentadoria
     * recebeu, sozinha e com zero avisos, *"você já deu entrada no INSS ou teve o benefício negado?
     * Está faltando documentação, tem perícia marcada? Se você já tentou e não foi atendida, conte o
     * que aconteceu que a gente vê como orientar. Fico no aguardo"*. Ele:
     *
     * > *"nós não somos um canal de resolução de problemas, a intenção é ganhar votos"*
     *
     * O que a mensagem faz agora é o que ele descreveu: a pessoa sai gostando do Capitão Martim, e o
     * caso vai para quem resolve. **Ele não quis aviso** (*"quero que o comportamento da IA mude"*):
     * a regra vai aqui, repetida no fim do bloco do contato, e as frases que convidavam a contar o
     * caso SAÍRAM das respostas prontas que a IA lê como base (`semConviteAoCaso`).
     */
    '11. NÃO SOMOS UM CANAL DE RESOLUÇÃO DE PROBLEMAS — a conversa existe para a pessoa sair gostando',
    '    do Capitão Martim, não para abrir um atendimento do caso dela. Diante de um problema pessoal',
    '    (INSS, aposentadoria, benefício, saúde, emprego, prefeitura): acolha em UMA frase, diga em UMA',
    '    frase onde aquilo se resolve (INSS, SINE, CRAS, prefeitura, Defensoria) e agradeça a',
    '    confiança. **E PARE.** Nada de perguntas sobre o caso ("já deu entrada?", "foi negado?", "tem',
    '    perícia?"), nada de "conte o que aconteceu", "me explica melhor", "para eu te orientar",',
    '    "fico no aguardo", "a gente vê como resolver". Não ofereça fazer nada por ela: nada de montar',
    '    currículo, preencher cadastro, agendar consulta, acompanhar processo, "eu anoto aqui".',
    '    **Cada pergunta dessas faz a pessoa voltar com o caso inteiro**, e o atendimento não tem braço.',
    /**
     * **A exceção de SAÚDE, aberta por ele em 17/09/2026** — uma pessoa chegou pedindo ajuda por estar
     * doente e as três opções despacharam para o posto de saúde: *"ficou algo muito seco e direto para
     * uma pessoa doente; ao menos teria que perguntar qual o problema. Quando é pessoa pedindo
     * diretamente dinheiro não tem problema de descartar rápido, mas em saúde a situação sempre é mais
     * complicada"*.
     *
     * **A regra 11 acima é dele (a Irema, 10/09) e continua valendo para o resto.** Esta é a exceção
     * estreita que ele abriu, e mora COLADA nela: separadas, a de cima ganha por estar antes.
     */
    '    EXCEÇÃO — SAÚDE: se o problema é doença, dela ou de alguém da família, NÃO despache. Acolha com',
    '    cuidado e PERGUNTE o que está acontecendo ("o que você tem?", "o que os médicos disseram?") —',
    '    é a única situação em que perguntar sobre o caso é certo. Não mande posto de saúde, UPA, CRAS',
    '    nem Cadastro Único na primeira resposta, e não negue ajuda que ela não pediu. Pedido de dinheiro',
    '    por outro motivo continua sendo negado de uma vez; doença, não.',
    /**
     * **Não dê a impressão de que há chance** — anotação da Solange (08/09/2026, lida em 10/09). Ela
     * pediu para trabalhar na campanha e ajuda para ir embora para São Paulo, e o rascunho respondeu
     * *"em período eleitoral as contratações são bem limitadas e as decisões saem da assessoria com
     * base em necessidades pontuais; o melhor é entrar em contato direto com a equipe"*. Ele:
     * *"contratos de eleição e essas decisões são tomadas na pré-campanha, nunca iremos contratar
     * ninguém assim pelo WhatsApp; a IA deu impressão que tem chance"*.
     *
     * **A metade "procure a equipe" já estava barrada** (`mandouProcurarNos`, 07/09) — medido: o texto
     * que saiu hoje não sairia sozinho. **A outra metade não tinha regra nenhuma:** "limitadas",
     * "pontuais" e "a assessoria decide" não prometem nada e por isso nenhuma trava as pega — é
     * julgamento, e fica no prompt. É a irmã da regra 7 (o que tinha de ser contratado já foi) do lado
     * de quem quer ser contratado.
     */
    '12. QUEM QUER TRABALHAR NA CAMPANHA — pedindo pagamento ou sem dizer: a equipe paga foi fechada na',
    '    PRÉ-CAMPANHA, e ninguém é contratado pelo WhatsApp. **Não dê a impressão de que existe chance**:',
    '    nada de "as contratações são limitadas", "depende da necessidade", "vou registrar seu interesse",',
    '    "a assessoria avalia", "mande seu currículo" nem "procure a equipe". A base é a resposta pronta',
    '    "Quer trabalhar para a campanha": aqui é só voluntário, sem remuneração. Se ela pediu mais alguma',
    '    coisa (dinheiro, passagem, ajuda), responda essa parte pelo item 9 do padrão, numa frase.',
    '    **NÃO PEÇA O ENDEREÇO NESTA MENSAGEM.** O endereço e o assessor são o caminho do MATERIAL de',
    '    campanha, e ela não pediu material: pediu pagamento. Ofereça o voluntariado numa frase e PARE —',
    '    se ela disser que aceita sem remuneração, o endereço vem na resposta seguinte. Pedir endereço é',
    '    prometer uma entrega, e é o passo que não volta atrás.',
    /**
     * **Pergunta retórica não é pedido** — print da Eloiza (10/09/2026). Três áudios: *"Desculpe,
     * minha amiga, simplesmente não gosto de política"*, *"É só promessa"* e *"Se eu pedisse ajuda pro
     * senhor e a senhorinha, poderiam me ajudar, capitão? Não, né?"*. O rascunho respondeu com a
     * negativa inteira da ajuda financeira — lei eleitoral, CRAS, Cadastro Único. Ele: *"a IA ignorou
     * o contexto, a pergunta foi retórica"*.
     *
     * **Medido: nenhum detector leu pedido de dinheiro** (`pedeAjudaFinanceira` = null); o caso foi
     * para a IA como pergunta em aberto, que é o desfecho certo. O que a IA fez foi responder a
     * hipótese ao pé da letra, com a resposta pronta "Pedido de ajuda financeira" como base — a
     * proximidade lexical, pela quinta vez.
     */
    '13. DESCRENÇA E PERGUNTA RETÓRICA NÃO SÃO PEDIDO. "É só promessa", "político é tudo igual", "não',
    '    gosto de política", "se eu pedisse ajuda, vocês não iam ajudar, né?" — ela está dizendo o que',
    '    pensa, não pedindo nada. **NÃO responda a pergunta ao pé da letra:** nada de explicar a lei,',
    '    nada de dizer o que o mandato pode ou não doar, nada de CRAS, nada de "se precisar, a equipe',
    '    procura ajudar". Responda em UMA ou DUAS frases curtas: respeite a opinião dela e agradeça por',
    '    ela ter escrito. Sem discurso sobre política e sem tentar convencer.',
    /**
     * **A regra 14 nasceu do caminhoneiro de fronteira (22/09/2026)** — ver a linha colada no pedido,
     * no bloco do contato. Aqui ela fica pelo mesmo motivo das outras: a colada só aparece quando o
     * dossiê foi puxado, e a falta de dado acontece também fora disso (uma pergunta de agenda, um
     * número que não temos, um tema que o dossiê não cobre).
     */
    '14. NÃO TENHO O DADO NÃO É A RESPOSTA. Perguntaram um projeto, uma lei, um número ou uma agenda',
    '    que você não tem: diga isso em UMA frase e responda o TEMA no resto da mensagem — por que',
    '    aquilo importa, o que precisa estar no debate, e que você quer conhecer o que ela vive nisso.',
    '    Mensagem que é só "não tenho essa informação" (ainda mais duas vezes) é porta fechada na cara',
    '    de quem escreveu. Isso NÃO autoriza inventar: projeto, lei, posição tomada, número e promessa',
    '    de resolver continuam valendo só se estiverem na conversa ou no "Quem é quem".',
    /**
     * **A regra 15 é dele, de 23/09/2026** — ver a linha colada no pedido, no bloco do contato. Aqui
     * ela fica por ser PROIBIÇÃO: proibição não obriga forma, então vale em toda chamada (17/09), e
     * a colada só aparece quando o detector reconhece a acusação.
     */
    '15. DENÚNCIA E ACUSAÇÃO POLÍTICA NÃO SE DISCUTE. Corrupção, roubo, desvio, fraude, esquema,',
    '    denúncia contra prefeito, governo, partido ou adversário: nós NÃO temos como verificar nada',
    '    disso. Agradeça as informações, diga que estamos atentos e acompanhando, e PARE. Nunca diga',
    '    que a denúncia é séria ou grave, nunca diga o que deveria ser apurado, nunca fale de provas,',
    '    fatos, responsabilidade ou direitos de ninguém, e nunca prometa levar o caso adiante.',
    // O item 22 INTEIRO, e não só a primeira faixa: citar só "mensagem simples: 1 a 3 frases" fez o
    // desabafo de 58 s do Adair (18/09/2026) receber três respostas de uma frase por parágrafo, contra
    // os dois parágrafos que o ChatGPT escreveu dentro da regra dele.
    'TAMANHO: siga o item 22 do padrão, pelo TIPO do que ela escreveu. Mensagem simples: 1 a 3 frases.',
    'Dúvida comum: 3 a 6 frases. Desabafo: 1 a 4 parágrafos curtos. Quem desabafou (um áudio longo, um',
    'texto sobre a vida dela) recebe resposta de desabafo, não uma frase só. Isto sai no WhatsApp, não é ofício.',
    'E, do mesmo item: uma linha em branco depois de todo ponto final — cada frase no seu parágrafo.',
    'Não dê aula sobre regra nem sobre lei, e não liste alternativas que ninguém pediu. Quando algo',
    'não for possível, uma frase basta — e o resto da mensagem é para a pessoa, não para o assunto.',
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
    gabinete ? `Quem é quem neste mandato (informação da assessoria — use-a como fonte e não invente o que não estiver aqui):\n${gabinete}\n` : '',
    /**
     * **"Vou verificar e volto" para o que está no bloco acima** — print do Fernando Britto
     * (10/09/2026). Perguntaram se ele foi bombeiro e comandante dos salva-vidas; o rascunho disse que
     * ia verificar. Ele: *"se não tem nenhuma informação a respeito é só falar o que ele foi e deu"*.
     * A regra está no dossiê (item 2) e é repetida aqui, colada no bloco, porque regra longe do ponto
     * em que o modelo escreve não é cumprida.
     */
    gabinete
      ? 'Perguntaram o que o Capitão Martim FOI ou FEZ e o bloco acima não fala disso? Diga o que o bloco diz sobre a carreira dele e PARE — sem "vou verificar", sem "volto a responder", sem confirmar nem negar o resto.\n'
      : '',
    /**
     * **As instruções dele mandam sobre o ESTILO, e nunca sobre as proibições** — escrito assim
     * depois de ele perguntar *"a IA não segue todas as instruções?"* (05/09/2026). O que é
     * mecânico (o traço eme) virou conserto em `revisarRascunho`; o que depende de julgamento
     * continua aqui — e aqui é pedido, por isso o texto diz "literalmente".
     */
    regras
      ? `Instruções da equipe, a seguir LITERALMENTE (elas mandam sobre as regras de estilo acima, e nunca sobre a lista do que você não pode escrever):\n${regras}\n`
      : '',
    /**
     * **O modelo usou um EXEMPLO DE ESTILO como banco de respostas** — print de 09/09/2026.
     *
     * A contato escreveu *"Posso falar com algum representante?"* e o rascunho respondeu, em cinco
     * frases, que *"no período eleitoral não é possível disponibilizar o contato pessoal do
     * deputado; a forma de falar com ele pessoalmente é nos eventos públicos da agenda"* — que é a
     * resposta pronta `falar-com-deputado` parafraseada. Ele apagou e escreveu, à mão:
     * *"bom dia, somos da equipe do capitão martim do que precisa?"*
     *
     * **Medido, e o determinístico estava certo:** `pedeFalarComDeputado` devolve **null** para a
     * frase dela (o objeto tem que ser ELE), e o quadro mandou o caso para a IA, que é o desfecho
     * correto — nenhuma resposta pronta serve. O que falhou foi o que a IA fez com o prompt:
     * `falar-com-deputado` é a **6ª das 8** respostas que entram aqui, com o texto inteiro, e o
     * rótulo dizia só *"exemplos"*. **"Exemplo" convida a copiar**, e "representante" está perto de
     * "deputado" o bastante para o modelo recuperar o vizinho errado.
     *
     * O rótulo agora separa as duas coisas, que é a única correção possível no prompt: eles ensinam
     * a VOZ (tom, tamanho, pontuação), e o assunto vem sempre do que ESTA pessoa escreveu.
     */
    'AS RESPOSTAS PRONTAS DA EQUIPE, cada uma com o NOME do caso que ela atende. Servem a duas',
    'coisas, e o nome é o que separa uma da outra:',
    '',
    '1. **TOM e TAMANHO, sempre.** É assim que a equipe escreve: curto, humano, sem discurso.',
    '2. **CONTEÚDO, quando uma delas atende o caso DESTA pessoa.** Aí ela é a BASE da sua resposta:',
    '   diga o que ela diz, com as suas palavras, ajustado ao que esta pessoa escreveu. **Não invente',
    '   outra resposta para um caso que a equipe já respondeu** — nem faça perguntas que a resposta',
    '   pronta já dispensa.',
    '',
    '**Se NENHUMA atender esta pessoa, não copie o conteúdo de nenhuma.** Exemplo que fala de um tema',
    'que ela não trouxe não tem nada a ver com esta conversa, e o assunto vem SEMPRE do que ela',
    'escreveu. Olhe o NOME antes de usar: é ele que diz a que caso a resposta serve.',
    /**
     * **A regra 3 citada onde a tentação está**, e é a lição de 07/09: regra que vive longe do ponto
     * em que o modelo escreve não é cumprida. Os textos dele são cheios de `{{saudacao}}`, e agora
     * são 21 deles colados no pedido — a regra 3 fica lá em cima, no começo das instruções.
     */
    '**As respostas prontas têm {{variáveis}} dentro; você NÃO.** Escreva a saudação por extenso e o',
    'texto final, pronto para enviar — é a regra 3, e ela vale principalmente aqui.',
    /**
     * **Frase de exemplo carrega uma PREMISSA, e a premissa não vem junto** — print da Dileta
     * (09/09/2026). Ela escreveu *"Bom dia"* e *"Preciso de uma ajuda sua"*, e o rascunho respondeu
     * *"não precisa se desculpar"*. Ele: *"de onde saiu que ela pediu desculpas?"*
     *
     * **Medido: a frase aparece cinco vezes no padrão dele e a condição que a libera, uma.** A
     * repetição venceu a condição.
     *
     * Fica AQUI, colado nos exemplos, porque foi a instrução de usar as respostas prontas como BASE
     * (3.22) que abriu isto — e uma regra que corrige o efeito de outra tem que morar ao lado dela.
     */
    '',
    '**Toda frase pronta carrega uma PREMISSA sobre o que a pessoa fez.** Antes de usar uma, confira',
    'se aquilo aconteceu NESTA conversa. Não diga "não precisa se desculpar" a quem não se desculpou,',
    '"obrigado por avisar" a quem não avisou, "que pena que não vai poder ir" a quem não recusou nada,',
    'nem "obrigado pela paciência" a quem não esperou. **Afirmar o que ela fez, errado, é pior que',
    'não dizer nada**: a pessoa lê que você não a leu.',
    'O mesmo com "aqui é só voluntário, sem remuneração" e o pedido de endereço: é a resposta de quem',
    'PEDIU para trabalhar ou falou em ganhar. Quem diz que vai votar, que vai ajudar na votação ou',
    'convida o candidato para uma visita está APOIANDO — e apoio se agradece, curto.',
    '**Mas o texto do ANÚNCIO não é apoio dela.** A linha marcada "(texto do ANÚNCIO…)" foi escrita pela',
    'campanha e ela só clicou num botão: não agradeça o apoio que está ali, não a chame de apoiadora por',
    'causa dele e não construa a resposta em cima dele. Responda o que ELA escreveu.',
    'E a negativa de ajuda ("um mandato não pode doar…", CRAS) é a resposta de quem PEDIU. "Se eu',
    'pedisse ajuda, vocês ajudariam?" é hipótese, e quase sempre descrença — é a regra 13, não o pedido.',
    '**E não feche uma NEGATIVA pedindo o cadastro.** Quem acabou de ouvir que não podemos dar dinheiro',
    'nem contratar não vai entender um "me diga seu nome e cidade" no fim da mensagem: soa a formulário',
    'em cima de um não. Peça o cadastro só quando o bloco do CONTATO mandar pedir.',
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
  const opcao = {
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
        description:
          'Em até 5 palavras, o que você considerou importante responder. Aparece na tela.',
      },
    },
  };

  return {
    type: 'object',
    additionalProperties: false,
    required: ['opcoes'],
    properties: {
      /**
       * **SEM `minItems` NEM `maxItems` — e foi isto que derrubou o treino** (16/09/2026). Relato dele:
       * *"o modo de treino falhou"*. A documentação das saídas estruturadas da Anthropic diz, com
       * todas as letras: `minItems` só aceita **0 ou 1**, e `maxItems` **não é aceito**; qualquer outra
       * coisa volta **400**. A v3.61 mandava `minItems: 3, maxItems: 3` e a v3.62 `1`/`1` — **nos dois
       * modos, todo rascunho numa casa Claude voltava erro.** Nenhum teste pegou porque nenhum teste
       * chama a API; nenhum verificador pegou porque o esquema é JSON válido.
       *
       * **Os SDKs Python e TypeScript tiram essas restrições sozinhos antes de mandar** — e é por isso
       * que o erro não aparece nos exemplos de lugar nenhum. **Esta extensão usa `fetch` cru**, então
       * o que se escreve aqui vai literal. A contagem mora em dois lugares que a API não recusa: o
       * `description` (e o bloco do contato) e `validarRascunho`, que corta em três e descarta vazia e
       * repetida. `tests/ia.test.mjs` varre os três esquemas atrás de palavra-chave proibida.
       */
      opcoes: {
        type: 'array',
        description: 'UMA resposta para a mensagem dela, pronta para enviar.',
        items: opcao,
      },
    },
  };
}

export function montarRequisicaoRascunho({ sistema, contato, modelo = MODELO_PADRAO }) {
  return corpo({
    sistema,
    contato,
    modelo,
    esquema: esquemaDoRascunho(),
    nome: 'rascunho',
    esforco: 'medium',
    // 8192 desde 18/09/2026, quando o rascunho passou para um modelo forte (gpt-5): o raciocínio
    // cabe DENTRO do teto e, com ~10 mil tokens de prompt, 4096 arriscava o texto sair truncado.
    // Teto não é gasto — paga-se o que o modelo produz.
    maxTokens: 8192,
  });
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

/**
 * **Tira do rascunho a frase que fala de TRANSCRIÇÃO** — print do Jose Carlos (12/09/2026).
 *
 * O rascunho respondeu *"A transcrição do seu áudio chegou aqui e eu li o que você falou."*, e ele:
 * *"a pessoa nem sabe o que é isso e não precisa saber, é só responder que ouvimos; essa resposta
 * tirou credibilidade"*.
 *
 * **É conserto e não aviso** pela disciplina desta função: mecânico e sem julgamento vira correção
 * (a saudação errada, o traço eme, "gabinete"), e aqui não há nada a julgar — a palavra é
 * vocabulário da nossa máquina e **não existe mensagem em que ela caiba** para um eleitor. E não
 * pode ser trava que barra: ele já cortou isso hoje (*"não parar todo tempo para eu revisar"*).
 *
 * **Sai a FRASE inteira, não a palavra:** trocar "transcrição" por "áudio" deixaria *"o áudio do seu
 * áudio chegou aqui e eu li o que você falou"*. A frase que fala do mecanismo é sempre inteira sobre
 * o mecanismo, então o que fica em volta continua de pé — medido no texto da print.
 *
 * **O piso existe para o texto não virar farelo:** se depois do corte sobrar menos de 40 caracteres,
 * nada é removido e quem chama recebe `null` (vira aviso). Rascunho pela metade saindo sozinho é
 * pior que a frase errada.
 */
export function semFalarDeTranscricao(texto) {
  const bruto = String(texto || '');
  if (!/transcri/i.test(bruto)) return null;
  let mexeu = false;
  const linhas = bruto.split('\n').map((linha) => {
    if (!/transcri/i.test(linha)) return linha;
    const frases = linha.split(/(?<=[.!?])\s+/);
    const ficam = frases.filter((f) => !/transcri/i.test(f));
    // Linha que era SO a frase do mecanismo desaparece inteira -- o piso no fim e que protege
    // o texto de virar farelo, e foi este `!ficam.length` que deixou o caso da print passar.
    if (ficam.length === frases.length) return linha;
    mexeu = true;
    return ficam.join(' ').trim();
  });
  if (!mexeu) return null;
  const novo = linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return novo.length >= 40 ? novo : null;
}

/**
 * **"AQUI É O WHATSAPP DO CAPITÃO MARTIM" NÃO É COMO NOS APRESENTAMOS** — print dele
 * (22/09/2026), com o rascunho abrindo assim para quem chegou pelo anúncio perguntando de vaga:
 * *"a mensagem mudou para whatsapp do capitão martim, não gostei, era pra estar equipe ou
 * assessoria do capitão martim e nesse caso nem era necessário se identificar"*.
 *
 * **São duas correções e elas moram em lugares diferentes.** *"Nem era necessário"* é julgamento
 * — quando cabe apresentação e quando não cabe —, e isso ficou no prompt (a VOZ da pessoa nova, e
 * a regra 9). **Já O NOME está errado sempre**: quem atende é a equipe, e é o que a regra 9 manda
 * dizer desde 09/09 — então é mecânico, como o "gabinete" e a transcrição.
 *
 * **O WhatsApp PESSOAL dele continua intocado** (*"não passamos o WhatsApp pessoal do Capitão
 * Martim"* é a resposta `falar-com-deputado`, e é a frase certa): a troca exige a moldura de
 * apresentação na mesma frase e desiste havendo "pessoal"/"particular".
 */
const SE_APRESENTA_COMO_O_WHATSAPP =
  /\b(?:aqui|est[ae]|isto|isso)\s+(?:é|e)(?=\s)|\bfalando\s+com\b|\bvoc[êe]\s+(?:está|esta)\s+n[oa]\b/i;
const O_WHATSAPP_DELE =
  /\bo\s+whats(?:app)?\s+(?:oficial\s+)?(?:do\s+(?:capit[ãa]o\s+)?martim|dele)\b/gi;
const NAO_E_APRESENTACAO = /\bpessoal\b|\bparticular\b|\bn[úu]mero\b/i;
const ABRE_COM_ESTE_E = /^(?:este|esse|isto|isso)\s+(é|e)(?=\s)/i;

export function semDizerQueEOWhatsAppDele(texto) {
  const bruto = String(texto || '');
  if (!O_WHATSAPP_DELE.test(bruto)) {
    O_WHATSAPP_DELE.lastIndex = 0;
    return null;
  }
  O_WHATSAPP_DELE.lastIndex = 0;
  let mexeu = false;
  const linhas = bruto.split('\n').map((linha) =>
    linha
      .split(/(?<=[.!?])\s+/)
      .map((frase) => {
        if (NAO_E_APRESENTACAO.test(frase)) return frase;
        if (!SE_APRESENTA_COMO_O_WHATSAPP.test(frase)) return frase;
        O_WHATSAPP_DELE.lastIndex = 0;
        if (!O_WHATSAPP_DELE.test(frase)) return frase;
        O_WHATSAPP_DELE.lastIndex = 0;
        mexeu = true;
        // "Este é a equipe" nao concorda; quem se apresenta diz "Aqui e".
        return frase
          .replace(ABRE_COM_ESTE_E, (_m, verbo) => `Aqui ${verbo}`)
          .replace(O_WHATSAPP_DELE, 'a equipe do Capitão Martim');
      })
      .join(' ')
  );
  return mexeu ? linhas.join('\n') : null;
}

/**
 * **A SAUDACAO ABRE O CONTATO, NAO CADA MENSAGEM** — relato dele (15/09/2026): *"a IA tem
 * agradecido multiplas vezes pelo apoio e dado boa tarde multiplas vezes, uma mensagem apos a
 * outra; ela nao consegue ver o contexto da conversa?"*.
 *
 * **Medido: ela ve, e esta funcao e que era a maquina de repetir.** O bloco do contato ja manda a
 * conversa inteira com "NOS"/"ELA", ja marca o que foi respondido, a VOZ ja diz *"nao abra saudacao
 * como se fosse o primeiro contato"* e a regra de 12/09 ja diz *"NAO REPITA o que ja dissemos"*.
 * Mesmo assim o rascunho que repetia *"Boa tarde! Obrigado pelo apoio"* saiu com **zero avisos** —
 * e, quando a IA abria com a saudacao ERRADA, `revisarRascunho` a **consertava**: o unico efeito
 * dela nesse caso era deixar a segunda saudacao do dia bem-formada.
 *
 * Somava-se a posicao: a linha *"se abrir com saudacao, a correta agora e X"* e a **segunda** do
 * bloco, e a VOZ so aparece depois da conversa inteira. E a licao do item 22 (07/09) outra vez —
 * **regra longe do ponto em que o modelo escreve nao e cumprida** —, e a saida e a mesma da saudacao
 * errada, do "gabinete" e da transcricao: **mecanico vira conserto.**
 *
 * @param {string} texto
 * @returns {string|null} o texto sem a abertura, ou `null` se nao havia saudacao
 */
const ABERTURA_DE_SAUDACAO = /^\s*(bom\s+dia|boa\s+tarde|boa\s+noite)\b[\s,!.:;–—-]*/i;

export function semSaudacao(texto) {
  const bruto = String(texto || '');
  if (!ABERTURA_DE_SAUDACAO.test(bruto)) return null;
  const novo = bruto.replace(ABERTURA_DE_SAUDACAO, '').trimStart();
  if (!novo) return null;
  return novo.charAt(0).toUpperCase() + novo.slice(1);
}

/** Palavras que nao carregam conteudo — duas frases que so as compartilham nao dizem o mesmo. */
const PALAVRAS_SEM_CONTEUDO = new Set(
  (
    'a o as os um uma uns umas de do da dos das e em no na nos nas por para pra com que se ' +
    'sua seu suas seus nosso nossa nossos nossas isso isto muito mais ja aqui ao aos eu voce ' +
    'nao sim tem ter esta estao foi sao te lhe me'
  ).split(/\s+/)
);

const conteudoDaFrase = (f) =>
  semAcentoIA(f)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !PALAVRAS_SEM_CONTEUDO.has(w));

const emFrases = (t) =>
  String(t || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((f) => f.trim())
    .filter(Boolean);

/**
 * **Ela perguntou como o Capitão Martim ESTÁ?** (17/09/2026) — cortesia, não pedido de dado. Casa só a
 * pergunta pelo estado dele: o nome tem de vir colado no verbo e a frase tem de acabar ali (ou em "bem",
 * "hoje", "de saúde"), senão *"como está o capitão nas pesquisas?"* e *"como vai o deputado votar?"*
 * virariam carinho. `ele` sozinho fica de fora: sem o nome, não se sabe de quem é.
 */
export function perguntaComoEleEsta(texto) {
  const t = semAcentoIA(String(texto || '')).toLowerCase();
  const ELE = '(?:o\\s+)?(?:nosso\\s+)?(?:capitao|martim|deputado)(?:\\s+martim)?';
  const FIM = '\\s*(?:$|[?!.,]|\\s+(?:hoje|ai|bem|de saude)\\b)';
  return (
    new RegExp(`(?:^|[^a-z])como\\s+(?:e\\s+que\\s+)?(?:esta|ta|vai|anda)\\s+${ELE}${FIM}`).test(t) ||
    new RegExp(`(?:^|[^a-z])${ELE}\\s+(?:esta|ta|anda)\\s+bem\\s*(?:$|[?!.,])`).test(t) ||
    new RegExp(`(?:^|[^a-z])tudo\\s+(?:bem|certo|tranquilo)\\s+com\\s+${ELE}\\s*(?:$|[?!.,])`).test(t)
  );
}

/**
 * **A frase que reescreve o que nos acabamos de dizer SAI** — a outra metade do mesmo relato: o
 * *"obrigado pelo apoio"* mandado duas vezes seguidas.
 *
 * **A regra e a de 12/09 (*"repeticao e o maior sinal de maquina"*), agora mecanica.** A comparacao
 * e por PALAVRA DE CONTEUDO contra a NOSSA ULTIMA fala: uma frase do rascunho sai quando 80% das
 * palavras que ela carrega ja estao numa frase que acabou de sair. Nao e semelhanca de assunto — e
 * a mesma frase com outra roupa, que e exatamente o que o modelo escreve quando nao tem o que
 * acrescentar.
 *
 * **Tres guardas, e sao elas que tornam isto seguro:**
 * - **Pergunta nunca sai** — perguntar de novo e uma acao (o endereco que veio errado, a cidade que
 *   faltou), e nao repeticao de cortesia.
 * - **Frase com menos de duas palavras de conteudo nao conta** — senao *"Claro!"* casaria com
 *   qualquer coisa.
 * - **Piso de 40 caracteres**, como em `semFalarDeTranscricao`: se tirar deixasse farelo, o texto
 *   fica inteiro e o aviso diz que ele repete — quem decide ai e ele.
 *
 * Olha so a NOSSA ULTIMA mensagem, e nao a conversa inteira: retomar em outro dia o que se disse
 * semana passada e conversa; dizer de novo o que acabou de sair e maquina.
 *
 * @param {string} texto o rascunho
 * @param {string} nossaUltima a ultima mensagem que NOS mandamos
 * @returns {string|null} o texto sem as frases repetidas, ou `null` se nada saiu
 */
export function semRepetirONosso(texto, nossaUltima) {
  const bruto = String(texto || '');
  const nossas = emFrases(nossaUltima)
    .map((f) => new Set(conteudoDaFrase(f)))
    .filter((c) => c.size >= 2);
  if (!bruto.trim() || !nossas.length) return null;

  const frases = emFrases(bruto);
  const ficam = frases.filter((f) => {
    if (f.includes('?')) return true;
    const palavras = conteudoDaFrase(f);
    if (palavras.length < 2) return true;
    return !nossas.some((c) => palavras.filter((w) => c.has(w)).length / palavras.length >= 0.8);
  });
  if (ficam.length === frases.length) return null;
  const novo = ficam.join(' ').trim();
  return novo.length >= 40 ? novo : null;
}

/** O rascunho inteiro e a nossa ultima mensagem outra vez? (o caso em que nao sobra nada a tirar) */
export function soRepeteONosso(texto, nossaUltima) {
  const frases = emFrases(texto);
  if (!frases.length) return false;
  const nossas = emFrases(nossaUltima)
    .map((f) => new Set(conteudoDaFrase(f)))
    .filter((c) => c.size >= 2);
  if (!nossas.length) return false;
  return frases.every((f) => {
    if (f.includes('?')) return false;
    const palavras = conteudoDaFrase(f);
    if (palavras.length < 2) return true;
    return nossas.some((c) => palavras.filter((w) => c.has(w)).length / palavras.length >= 0.8);
  });
}

/**
 * **O nome do anúncio, curto** — print da Leonir (12/09/2026).
 *
 * A marca da mensagem diz à IA *"(texto do ANÚNCIO <nome> em que ela clicou — escrito pela campanha,
 * não por ela)"*, e o nome vem do que ele cadastrou na Config ou, faltando isso, do `headline` do
 * Facebook. **O `headline` é um parágrafo de campanha**: no caso medido tinha 277 caracteres e dizia
 * *"Tenho orgulho de contar com esse apoio… Vote Capitão Martim, deputado estadual. 10122"* — e
 * entrava inteiro dentro da marca, no meio da linha da conversa. O rascunho abriu agradecendo *"o seu
 * apoio ao Flávio, ao Zucco e ao Capitão Martim"*, apoio que ela nunca declarou.
 *
 * **Marca que carrega o texto que a IA deveria ignorar não avisa: abastece.** O nome serve a uma
 * coisa só — dizer QUAL anúncio —, então o corte é de tamanho, e é aqui (puro e testado) em vez de
 * no painel, que nenhuma suíte importa.
 */
export const LIMITE_NOME_DO_ANUNCIO = 60;

export function nomeCurtoDeAnuncio(bruto) {
  const t = String(bruto || '').replace(/\s+/g, ' ').trim();
  return t.length > LIMITE_NOME_DO_ANUNCIO ? cortar(t, LIMITE_NOME_DO_ANUNCIO - 1) + '\u2026' : t;
}

/** O bloco do contato para o rascunho: a conversa com folga, porque é dela que ele precisa. */
/**
 * **Quanto do atendimento anterior vai.** O fim dele, que é o que tem a ver com hoje, e cortado: a
 * sessão comum tem dezenas de mensagens (uma medida em 30/08 tinha 168), e o bloco do contato não é
 * cacheado — cada linha aqui é paga em toda chamada. 30 falas de até 600 caracteres somam no máximo
 * ~5 mil tokens, US$ 0,005 por rascunho no Haiku; o caso comum fica muito abaixo disso.
 */
export const ANTERIOR_MAX_FALAS = 30;
export const ANTERIOR_MAX_CARACTERES = 600;

/**
 * **Como uma mensagem SEM TEXTO aparece para a IA** — pedido dele (16/09/2026), depois de ver que
 * figura, vídeo, documento e áudio sem transcrição sumiam da conversa que ela lê.
 *
 * Devolve a linha a pôr no lugar do texto, ou `''` quando a mensagem tem texto (aí ela vai como é).
 * O aviso da plataforma (`sistema`) também vira linha: *"ela mandou algo e não chegou"* é diferente
 * de *"ela não mandou nada"* — a lição do Carlos (02/09), agora do lado da IA.
 *
 * @param {{tipo?:string, texto?:string, sistema?:boolean}} m
 */
export function marcaDeMidia(m) {
  if (String(m?.texto || '').trim()) return '';
  if (m?.sistema) return '(ela mandou uma mensagem que não chegou legível até aqui)';
  const tipo = String(m?.tipo || '').toUpperCase();
  const nome = {
    IMAGE: 'uma IMAGEM',
    STICKER: 'uma FIGURINHA',
    VIDEO: 'um VÍDEO',
    DOCUMENT: 'um DOCUMENTO',
    AUDIO: 'um ÁUDIO (sem texto)',
  }[tipo];
  return nome ? `(ela mandou ${nome} — o conteúdo não aparece aqui)` : '';
}

/** O bloco do atendimento anterior — vazio quando não há nada a mostrar. */
function blocoDoAtendimentoAnterior(anterior, agora) {
  const falas = (anterior || [])
    .map((m) => (typeof m === 'string' ? { de: 'contato', texto: m } : m))
    .filter((m) => String(m?.texto || '').trim())
    .slice(-ANTERIOR_MAX_FALAS);
  if (!falas.length) return [];
  return [
    'ATENDIMENTO ANTERIOR — já encerrado. É CONTEXTO: serve para você saber quem ela é e o que já ' +
      'conversamos. Nada daqui espera resposta, e não retome pedido nem assunto dali a menos que ela ' +
      'volte a ele hoje:',
    '',
    falas
      .map((m) => {
        const q = quandoFoi(m.at, agora);
        return `${m.de === 'nos' ? 'NÓS' : 'ELA'}${q ? ` [${q}]` : ''}: ${umaLinha(m.texto, ANTERIOR_MAX_CARACTERES)}`;
      })
      .join('\n\n'),
    '',
    '— fim do atendimento anterior —',
    '',
  ];
}

export function montarContatoRascunho({ mensagens = [], campos = {}, agora, pedirDados = false, jaNosConhece = false, anterior = [], perguntaDoMandato = false } = {}) {
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
  /**
   * **O clique no anúncio não conta como mensagem que ela escreveu** (08/09/2026).
   *
   * `m.anuncio` chega do painel, que sabe disso desde 04/09 e não estava contando à IA. Sem a
   * distinção, *"Olá! Eu apoio as Escolas Cívico-Militares"* + *"Bom dia"* vira **"ela escreveu 2
   * mensagens"**, e o pedido do EIXO logo abaixo manda pegar *"a mais recente que pede ou pergunta
   * alguma coisa"* — com "bom dia" descartado como cortesia, o eixo cai no texto do anúncio, e a
   * resposta inteira nasce em cima de uma frase escrita pela campanha.
   *
   * Os dois números são necessários: `pendentesDela` é o que a IA responde, e a diferença entre
   * eles é o caso em que ela **só clicou e não escreveu nada** — que existe e é comum (a Irene,
   * 05/09, clicou em três anúncios seguidos sem digitar uma palavra). Dizer "a última fala é
   * NOSSA" ali seria mentira.
   */
  /**
   * **Já falamos com ela HOJE?** — o que troca o convite à saudação pela proibição dela.
   *
   * A linha *"se abrir com saudação, a correta agora é X"* é a SEGUNDA do bloco, e a VOZ que manda
   * emendar de onde paramos só aparece depois da conversa inteira. Com a saudação convidada no
   * topo, o modelo abria "Boa tarde" pela segunda vez no mesmo dia — relato dele de 15/09/2026. É a
   * lição do item 22 (07/09): **regra longe do ponto em que o modelo escreve não é cumprida.**
   *
   * Quem garante é `revisarRascunho`, que TIRA a saudação repetida; esta linha é para o modelo não
   * gastar a abertura com ela.
   */
  const mesmoDia = (a, b) => {
    const x = a ? new Date(a) : null;
    const y = b ? new Date(b) : new Date();
    return !!x && !Number.isNaN(x.getTime()) && x.toDateString() === y.toDateString();
  };
  const falamosHoje = ultimaNossa >= 0 && mesmoDia(lista[ultimaNossa].at, agora);

  const temCliqueDeAnuncio = lista.some((m) => m.anuncio);
  const temAudioOuvido = lista.some((m) => m.transcrito);
  const temMidiaSemTexto = lista.some((m) => m.semConteudo);
  /**
   * **Mídia COM legenda e link também** (22/09/2026): *"a IA tem focado nas imagens e links perguntando
   * sobre o que é, o certo é desconversar"*. A regra só entrava com mídia SEM texto, e a figura com
   * legenda ou o link chegavam como fala comum — o modelo perguntava o que era.
   */
  const temMidiaOuLink = lista.some(
    (m, i) => m.de !== 'nos' && i > ultimaNossa && (m.semConteudo || m.midia || /https?:\/\/|www\./i.test(String(m.texto || '')))
  );
  const pediuRoupa = lista.some((m, i) => m.de !== 'nos' && i > ultimaNossa && !m.anuncio && ehPedidoDeRoupa(m.texto));
  /**
   * **Saúde é a exceção da regra 11, e ela vale na conversa INTEIRA** (17/09/2026) — não só na rajada:
   * quem contou ontem que está doente continua doente hoje, e a resposta seca não deixa de ser seca.
   */
  const saude = lista
    .filter((m) => m.de !== 'nos' && !m.anuncio)
    .map((m) => falouDeSaude(m.texto))
    .find(Boolean);
  /**
   * **Denúncia e acusação política: na conversa INTEIRA, pela mesma razão da saúde.** Quem trouxe a
   * acusação ontem segue falando dela hoje — na print de 23/09/2026 a mensagem da vez era só *"é
   * assim mesmo que está ocorrendo"*, e foi o SEGUIMENTO que virou lição de moral.
   */
  const denuncia = lista
    .filter((m) => m.de !== 'nos' && !m.anuncio)
    .map((m) => trouxeDenuncia(m.texto))
    .find(Boolean);
  /**
   * **Pediu dinheiro?** — a mesma leitura do painel (rajada desde a nossa última fala), porque a regra
   * do CRAS é sobre o que ela acabou de pedir. 17/09/2026: *"a IA não está identificando quando realmente
   * a pessoa precisa ir pro CRAS; muitas pedem dinheiro sem esclarecer que estão com dificuldades"*.
   */
  const dela = lista.filter((m) => m.de !== 'nos' && !m.anuncio);
  const desdeNossa = ultimaNossa >= 0 ? lista[ultimaNossa].at : null;
  const pediuDinheiro = !!pedeAjudaFinanceira(dela, desdeNossa);
  /**
   * **Ela trouxe um PROBLEMA PESSOAL?** — a regra 11 era escrita em TODA chamada, e é ela que manda
   * *"acolha em uma frase… e PARE"*. Relato dele (17/09/2026): *"conferiu todas as hipóteses das 3
   * mensagens se repetirem em todas as situações… quando pedi pra verificar isso falei de todas as
   * situações"*.
   *
   * **Medido: era a hipótese que faltava.** Mandada sempre, ela encurtava a resposta de quem só
   * agradeceu, e aí as três opções não tinham por onde diferir. Ela continua inteira no prompt de
   * sistema (é regra dele, vale sempre); o que passou a depender do caso é a repetição colada no pedido.
   */
  /**
   * **Ela OFERECE um evento pela campanha e pede que a gente entre com algo** (17/09/2026). Não é
   * problema pessoal nem pedido de ajuda: é apoio. Por isso também DESLIGA a regra 11 abaixo — foi ela,
   * somada à resposta pronta de ajuda financeira, que pôs o CRAS em quem oferecia uma janta.
   */
  const eventoPelaCampanha = ofereceEventoPelaCampanha(dela, desdeNossa);
  const trouxeProblema =
    !eventoPelaCampanha &&
    (pediuDinheiro ||
    !!saude ||
    !!pedeEmprego(dela, desdeNossa) ||
    !!pedeAlgoIndefinido(dela, desdeNossa) ||
    !!reclamaSemResposta(dela, desdeNossa) ||
      dela.some((m) => PROBLEMA_PESSOAL.test(String(m?.texto || ''))));
  const perguntouComoEleEsta = lista.some((m, i) => m.de !== 'nos' && i > ultimaNossa && !m.anuncio && perguntaComoEleEsta(m.texto));
  const pendentesTotal = lista.filter((m, i) => m.de !== 'nos' && i > ultimaNossa).length;
  const pendentes = lista.filter((m, i) => m.de !== 'nos' && i > ultimaNossa && !m.anuncio).length;
  const soCliques = pendentes === 0 && pendentesTotal > 0;

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
      /**
       * **O clique no anúncio não recebe marca nenhuma.** Nem "← SEM RESPOSTA" (não é pergunta
       * dela esperando resposta) nem "← já respondida" (ela não disse aquilo). O que ele é já está
       * escrito no começo da própria linha, e é a única coisa verdadeira a dizer sobre ele.
       *
       * Sem isto a instrução fica ambígua no caso mais comum: anúncio + "bom dia" davam **duas**
       * linhas marcadas "← SEM RESPOSTA" com a frase no singular logo abaixo.
       */
      const pendente = m.de !== 'nos' && i > ultimaNossa && !m.anuncio;
      const jaRespondida = m.de !== 'nos' && ultimaNossa >= 0 && i < ultimaNossa && !m.anuncio;
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
    falamosHoje
      ? 'NÃO abra com saudação: nós já falamos com ela hoje, e "bom dia/boa tarde" duas vezes no ' +
        'mesmo dia é o que denuncia uma máquina. Emende de onde nós paramos.'
      : `Se abrir com saudação, a correta agora é "${saudacaoDeAgora(agora)}" — não deduza pelo horário das mensagens.`,
    '',
    /**
     * **O ATENDIMENTO ANTERIOR, quando existe** — pedido dele (16/09/2026): *"creio que o fluxo está
     * barrando ela de ler o contexto"*. Medido, não era o fluxo: era a SESSÃO. Quem volta sozinho
     * abre atendimento novo, e a IA via só o de hoje — a cidade, o pedido e a conversa de semana
     * passada ficavam do outro lado de um botão que ninguém apertava por ela.
     *
     * **Vai ANTES e em bloco separado, com o aviso de que nada ali espera resposta.** É a lição da
     * Maria Geny e da Janete ao contrário: o que separa pendente de respondido é a marca, e uma pilha
     * de falas antigas sem marca seria lida como rajada — a IA responderia um pedido de agosto.
     * Por isso as linhas daqui NÃO recebem `← SEM RESPOSTA`.
     */
    ...blocoDoAtendimentoAnterior(anterior, agora),
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
    /**
     * **Sessão nova não é pessoa nova** — anotação de 10/09/2026, sobre um áudio de apoio de quem
     * tem etiqueta de cidade no CRM: o rascunho abriu com *"Somos a equipe do Capitão Martim"*. Ele:
     * *"se identificar é quando a pessoa é nova no WhatsApp ou ela perguntou"*.
     *
     * **A IA não tinha como acertar:** quem volta sozinho abre sessão nova, sem nenhuma fala NÓS, e
     * este bloco dizia *"é a primeira coisa que o atendimento diz a esta pessoa"* — mentira. É a
     * armadilha da Rosa (05/09) do lado da IA: **a conversa é a memória da sessão; o CRM é a memória
     * de verdade.** `jaNosConhece` vem do painel, e é o `jaRespondemosAntes` da rodada.
     */
    ultimaNossa >= 0
      ? 'VOZ: você é a MESMA pessoa que escreveu as falas marcadas "NÓS". Esta mensagem é a ' +
        'PRÓXIMA da conversa, não uma resposta de fora. Não se apresente de novo, não recapitule o ' +
        'que já dissemos e não abra saudação como se fosse o primeiro contato — emende de onde nós ' +
        'paramos. Só diga quem somos se ela PERGUNTAR quem está do outro lado (regra 9).'
      : jaNosConhece
      ? 'VOZ: esta pessoa JÁ CONHECE o atendimento — conversou conosco em outro dia, e a conversa ' +
        'de antes só não aparece aqui. NÃO se apresente: nada de "somos a equipe do Capitão Martim", ' +
        '"aqui é", "seja bem-vindo". Só diga quem somos se ela PERGUNTAR quem está do outro lado ' +
        '(regra 9).'
      : 'VOZ: é a primeira coisa que o atendimento diz a esta pessoa. Escreva como o Capitão Martim, ' +
        'na primeira pessoa. NÃO se apresente por hábito: responda o que ela trouxe. Só diga quem ' +
        'somos se ela PERGUNTAR quem está do outro lado (regra 9), e aí é "a equipe do Capitão ' +
        'Martim" ou "a assessoria do Capitão Martim" — nunca "o WhatsApp dele".',
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
    soCliques
      ? 'Ela NÃO ESCREVEU nada: o que há sem resposta é só clique em anúncio, e o texto daquelas ' +
        'mensagens é da campanha. Não agradeça o que a campanha escreveu nem trate aquilo como ' +
        'declaração dela. Responda ao que ela pediu AO CLICAR, de forma curta e acolhedora.'
      : pendentes === 0
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
    /**
     * **NÃO REPETIR é regra dele, e a mais curta de justificar** (12/09/2026, print do "Silva
     * pinturas"): *"IA se repetindo, já vi outros casos; esse é o maior sinal de máquina
     * respondendo, repetição, não pode acontecer isso"*.
     *
     * A conversa inteira está no bloco acima, com as nossas falas marcadas `NÓS:` — então o modelo
     * TEM como saber. Vai colada no pedido pela razão de 07/09: regra longe do ponto em que ele
     * escreve não é cumprida. O conserto determinístico do caso da print é a guarda da negativa
     * (`negativaJaSaiu` pelo invariante); esta linha é o que cobre a classe inteira.
     */
    'NÃO REPITA o que já dissemos: leia as falas marcadas NÓS acima e nunca reescreva uma mensagem ' +
      'que já saiu, nem com outras palavras. Dizer a mesma coisa duas vezes é o que denuncia uma ' +
      'máquina, e a segunda vez não acrescenta nada. Se a resposta certa já foi dada e ela insiste, ' +
      'responda o que há de NOVO na fala dela — e se não houver nada novo, escreva uma linha curta ' +
      'que reconheça o que ela disse, sem repetir o conteúdo.',
    /**
     * **A regra do anúncio, colada no pedido, e só quando há clique na conversa** — print da Leonir
     * (12/09/2026): o rascunho agradeceu *"o seu apoio ao Flávio, ao Zucco e ao Capitão Martim"* a
     * quem só clicou no anúncio que diz isso. A marca na linha existe desde 08/09 e não bastou —
     * regra longe do ponto em que o modelo escreve não é cumprida (07/09). Condicional para não
     * gastar as chamadas em que não há clique nenhum.
     */
    /**
     * **A regra do áudio, colada no pedido** — print do Jose Carlos (12/09/2026): o rascunho
     * respondeu *"A transcrição do seu áudio chegou aqui e eu li o que você falou"*, e ele: *"a
     * pessoa nem sabe o que é isso e não precisa saber, é só responder que ouvimos; essa resposta
     * tirou credibilidade"*. **A palavra vem do nosso próprio prompt** — a marca da linha diz
     * "transcrito automaticamente" e a regra 6 fala de transcrição cinco vezes —, e nada dizia que
     * o vocabulário é interno. É a irmã do nome do anúncio (3.50): marca nossa virando conteúdo da
     * mensagem. Condicional: só entra quando há áudio na conversa.
     */
    temAudioOuvido
      ? 'ÁUDIO: para ela, nós OUVIMOS o áudio — e por isso não se confirma: responda direto ao que ela ' +
        'disse, sem abrir com "ouvi seu áudio" ou "recebi sua mensagem". A palavra ' +
        '"transcrição" é máquina nossa e NÃO pode aparecer no rascunho, nem a ideia: nada de "a ' +
        'transcrição chegou", "eu li o que você falou" ou explicar como o áudio virou texto.'
      : '',
    /**
     * **A regra da MÍDIA, colada no pedido** — pedido dele (16/09/2026). Até aqui figura, vídeo,
     * documento e áudio sem transcrição sumiam da conversa, e a IA respondia *"olha isso"* sem saber
     * que havia uma foto. Agora a linha existe, e esta regra diz o que fazer com ela.
     *
     * **A metade que se erra sozinha é a segunda frase.** A marca é vocabulário NOSSO, e a lição da
     * "transcrição" (3.51) é que o modelo reusa o vocabulário que recebe: sem proibir, sai *"não
     * consegui abrir a imagem"* para um eleitor — que é mentira (a imagem chegou) e ainda denuncia a
     * máquina.
     */
    temMidiaSemTexto || temMidiaOuLink
      ? 'MÍDIA E LINK: ela mandou imagem, vídeo ou link, e o conteúdo deles NÃO é o assunto. Você não o ' +
        'vê — então NÃO pergunte o que é, não peça para explicar, não descreva e não adivinhe o que ' +
        'tem nele. E NUNCA diga que não viu, não abriu ou não carregou. Desconverse com leveza: agradeça ' +
        'em poucas palavras se couber e responda pelo que ela ESCREVEU; se ela só mandou a mídia, uma ' +
        'frase curta e calorosa basta.'
      : '',
    temCliqueDeAnuncio
      ? 'O CLIQUE NO ANÚNCIO NÃO É FALA DELA: a linha marcada "(texto do ANÚNCIO…)" foi escrita pela ' +
        'campanha. Não agradeça o apoio que está escrito nela, não a trate como apoiadora por causa do ' +
        'clique e não responda àquele texto — responda o que ela escreveu por conta própria.'
      : '',
    /**
     * **A regra da ROUPA, colada no pedido** (12/09/2026) — mesma razão das de cima: regra longe do
     * ponto em que o modelo escreve não é cumprida. Só entra quando ela pediu roupa e ainda não
     * respondemos, para o "não temos" não se repetir.
     */
    pediuRoupa
      ? 'ROUPA: ela pediu camiseta, boné ou outra peça de vestir — NÃO fornecemos nenhuma, e a lei ' +
        'eleitoral proíbe a campanha de distribuir. Diga isso em uma frase gentil e pare: sem pedir ' +
        'endereço, sem repassar à equipe, sem prometer verificar e sem indicar onde comprar.'
      : '',
    /** A exceção da regra 4, colada no pedido quando a pergunta está na conversa (17/09/2026). */
    perguntouComoEleEsta
      ? 'COMO ELE ESTÁ: ela perguntou como está o Capitão Martim. É carinho, não pedido de informação — ' +
        'NÃO diga que não sabe, que não tem a informação nem que vai verificar. Diga que ele está bem e na ' +
        'correria da campanha, e agradeça a lembrança. Se as instruções ou o "Quem é quem" trouxerem ' +
        'notícia dele, use a notícia no lugar.'
      : '',
    /**
     * **DENÚNCIA E ACUSAÇÃO POLÍTICA — colada no pedido** (23/09/2026). Regra dele: *"em caso de
     * denúncias políticas e acusações etc nós não entramos em detalhes pois essas informações não
     * podem ser verificadas, só agradecemos as informações e desconversamos sem entrar em
     * detalhes"*. Ver `cortesia.trouxeDenuncia`.
     *
     * **Fica FORA de quem trouxe um problema pessoal**, como a regra da pauta: quem foi roubada ou
     * teve o benefício fraudado não recebe "obrigado, estamos atentos" — a regra 11 é quem atende.
     */
    denuncia && !trouxeProblema
      ? 'DENÚNCIA OU ACUSAÇÃO POLÍTICA — NÃO ENTRE NO MÉRITO: nós não temos como verificar essas ' +
        'informações, então NÃO diga se é grave, se é séria, o que precisa ser apurado, nem dê aula ' +
        'sobre fatos, provas, responsabilidade ou direitos. Agradeça as informações em UMA frase e ' +
        'diga que estamos atentos e acompanhando o assunto — e PARE. Nada de opinião sobre o caso, ' +
        'nada de prometer levar adiante, nada de pedir detalhes.'
      : '',
    /**
     * **A regra do endereço, colada no pedido** — mesma razão da regra 11 acima, e mesma decisão
     * dele (12/09/2026): o conserto é o que a IA lê, não uma trava que para a rodada depois.
     */
    'ENDEREÇO: só peça o endereço dela se ela pediu MATERIAL DE CAMPANHA (folheto, adesivo, bandeira, ' +
      'santinho) ou se já disse que aceita ser voluntária sem pagamento. Quem pediu dinheiro, emprego ' +
      'ou um bem para comprar NÃO recebe pedido de endereço — pedir endereço é prometer uma entrega.',
    /**
     * **FALTAR O DADO NÃO É A RESPOSTA** — print do caminhoneiro de fronteira (22/09/2026). Ele
     * perguntou o que o mandato tem de projeto para caminhoneiros e se haveria uma agenda do Flávio
     * na cidade dele; o rascunho saiu com DUAS negativas e mais nada, e ele apagou. Ao lado, a
     * resposta que ele mandou no lugar (escrita no ChatGPT, com o MESMO modelo) respondeu o TEMA —
     * a fronteira, as rodovias, os pontos de parada — e pôs a falta da agenda em uma frase.
     *
     * *"Os dois modelos são iguais mas as respostas diferem totalmente; o nosso poderia ter seguido
     * o mesmo caminho mesmo que não conheça nenhum projeto."*
     *
     * **Medido: nenhuma trava disparou nos dois textos** — não é caso de barrar nada, é o que a IA
     * lê. A regra 4 (*"use SÓ o que estiver na conversa e no bloco"*) e a seção 20 do documento dele
     * estavam sendo cumpridas ao pé da letra: sem o dado, o modelo só tinha a negativa. É a mesma
     * forma do *"como está o capitão"* (17/09) num assunto novo — **"não invente" não significa
     * "não responda"**.
     *
     * **A condição é o DOSSIÊ ter sido puxado**, que é exatamente "ela perguntou do mandato": não
     * há lista nova de formas de perguntar, e a conta já existia. E fica FORA de quem trouxe um
     * problema pessoal, senão esta linha e a regra 11 mandariam coisas opostas sobre perguntar.
     */
    perguntaDoMandato && !trouxeProblema
      ? 'PERGUNTOU DO MANDATO E FALTA O DADO: se você não tem o projeto, a lei, o número ou a agenda ' +
        'que ela pediu, a falta é UMA frase da mensagem — nunca a mensagem inteira. Antes dela, ' +
        'responda o TEMA que ela trouxe: por que aquilo importa para o Estado e o que precisa estar ' +
        'no debate, e diga que quer conhecer o que ELA vive naquele tema. Isso é conversa de ' +
        'campanha, não é "me conte seu caso". Sem inventar projeto, lei, posição tomada nem ' +
        'promessa de resolver.'
      : '',
    /**
     * **A regra 11, colada no pedido** — print da Irema (10/09/2026): *"nós não somos um canal de
     * resolução de problemas, a intenção é ganhar votos"*. No sistema ela está a milhares de tokens
     * daqui, e regra longe do ponto em que o modelo escreve não é cumprida (07/09).
     */
    trouxeProblema
      ? 'NÃO SOMOS CANAL DE RESOLUÇÃO DE PROBLEMAS: ela trouxe um problema — acolha em uma frase, diga ' +
        'onde aquilo se resolve e agradeça a confiança, sem perguntas sobre o caso, sem pedir que ela ' +
        'conte mais e sem "fico no aguardo". A mensagem é para ela sair gostando do Capitão Martim.'
      : '',
    /**
     * **SAÚDE: a exceção, colada na regra que a excepciona** (17/09/2026). A linha de cima é a razão de
     * a resposta ter saído seca; pôr a exceção longe dela seria escrever as duas para o modelo escolher
     * a primeira. Vale para as três opções, porque foi assim que ele viu o defeito: *"as 3 respostas
     * estavam iguais"* — sem nada a acolher nem a perguntar, as três viram o mesmo despacho.
     */
    /**
     * **O CRAS não é para todo mundo que fala de dinheiro** — regra dele (17/09/2026): *"a IA não está
     * identificando quando realmente a pessoa precisa ir pro CRAS ou assistência social; muitas pedem
     * dinheiro sem esclarecer que realmente estão com dificuldades"*.
     *
     * Medido: nada no prompt separava os dois casos — a regra 11 manda *"diga em UMA frase onde aquilo se
     * resolve"*, e o resultado é a aula sobre CRAS e Cadastro Único para quem só escreveu *"faz um pix"*.
     * **É também metade do problema das três opções iguais:** obrigada a citar o CRAS, a IA escreve a
     * mesma mensagem três vezes.
     */
    pediuDinheiro
      ? 'DINHEIRO — O CRAS NÃO É PARA TODO MUNDO: só aponte CRAS, assistência social, Cadastro Único ou ' +
        'Defensoria se ELA DISSER a dificuldade concreta (está desempregada, sem comida, com aluguel ou ' +
        'luz atrasados, ameaçada de despejo, com criança pequena sem o que comer, com benefício cortado ' +
        'ou negado, doença na família). Se ela só pediu dinheiro, PIX ou um valor, sem dizer nada disso: ' +
        'diga em UMA frase gentil que a lei eleitoral me proíbe de fazer isso e PARE — sem CRAS, sem lista ' +
        'de órgãos, sem citar artigo nem dar aula, e sem perguntar do caso. Assistência social é para quem ' +
        'está em vulnerabilidade; mandar todo mundo para lá é resposta de máquina, e erra com quem ' +
        'precisa de verdade.'
      : '',
    /**
     * **Apoio com evento NÃO é pedido de ajuda** — caso dele (17/09/2026): *"a pessoa quer apoiar a
     * campanha fazendo uma janta e quer que participemos com comida"*, e saíram três mensagens mandando
     * para o CRAS. Medido: nenhum detector casou, e o CRAS veio da resposta pronta mais parecida no
     * vocabulário (comida, ajuda) — a proximidade lexical.
     *
     * **O que a campanha pode dizer com verdade:** agradecer a iniciativa e dizer que não entra com
     * comida, bebida nem custo. O repasse do convite é a única promessa que cabe (a regra da Jonice,
     * 08/09), e é ele que dá um desfecho em vez de um "não" seco.
     */
    eventoPelaCampanha
      ? 'APOIO COM EVENTO — NÃO É PEDIDO DE AJUDA: ' + eventoPelaCampanha.motivo + '. Ela está do NOSSO ' +
        'lado, gastando tempo e dinheiro dela. É proibido tratar isso como pedido de ajuda: NADA de CRAS, ' +
        'assistência social, Cadastro Único ou "não podemos ajudar com dinheiro". Agradeça a iniciativa ' +
        'pelo nome (a janta, o café, o bingo), diga com franqueza que a campanha não entra com comida, ' +
        'bebida, som nem custo — a lei eleitoral e a prestação de contas não permitem —, e que o apoio ' +
        'dela vale do jeito que ela puder fazer. Se ela convidar o Capitão Martim, pode dizer que repassa ' +
        'o convite para a equipe da agenda; nada além disso, e sem prometer presença.'
      : '',
    saude
      ? `SAÚDE — EXCEÇÃO À REGRA ACIMA: ela ${saude.motivo}. Doença não se despacha. Acolha ` +
        'com cuidado, no tempo dela, e PERGUNTE o que está acontecendo (o que ela tem, como está o ' +
        'tratamento, o que os médicos disseram) — aqui perguntar sobre o caso é o certo. NÃO mande posto ' +
        'de saúde, UPA, CRAS nem Cadastro Único nesta mensagem, e não negue ajuda que ela não pediu. Se ' +
        'ela pediu dinheiro ou remédio, o "não podemos" vem DEPOIS de ela contar o que tem, nunca na ' +
        'primeira resposta.'
      : '',
    /**
     * **NÃO OFEREÇA O QUE ELA NÃO PEDIU** — print da Margarida (16/09/2026): as três opções ofereciam a
     * colinha (*"quer que eu te mande a lista com os candidatos?"*, *"posso te encaminhar a colinha ou o
     * link do grupo?"*) a quem só tinha mandado carinho. Ele: *"sugeriu colinha sem motivo nenhum nas 3,
     * e eu não queria isso"*.
     *
     * **Medido no prompt gerado: nada proibia oferta sem pedido** — havia proibições pontuais (não
     * ofereça catálogo, não ofereça a Assembleia) e nenhuma geral. E o empurrão veio de mim: a instrução
     * das três opções mandava variar *"fechar ou não com pergunta"*, e para fechar com pergunta sem ter
     * o que perguntar o modelo inventa uma oferta. Vale nos dois modos, então fica fora do ternário.
     */
    'NÃO OFEREÇA O QUE ELA NÃO PEDIU: colinha, lista de candidatos, link de grupo, agenda, material ou ' +
      'conteúdo só entram se ela pediu ou perguntou por isso. Nada de "quer que eu te mande…?", "posso ' +
      'te encaminhar…?" ou "qual prefere?" para criar assunto. Se fechar com pergunta, a pergunta é ' +
      'sobre o que ELA trouxe.',
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
  /**
   * `equipe`/`assessoria` entraram junto em 07/09/2026, quando "gabinete" saiu do vocabulário
   * (decisão dele). Sem isso, a apresentação passaria a escapar exatamente na redação nova — o
   * detector continuaria "funcionando" e deixaria de ver o caso que existe para ver.
   */
  /\b(gabinete|equipe|assessoria) d[oa]\b/i,
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
  /**
   * **A IA afirmou que TEMOS uma coisa** — print do Lucas Mendes (07/09/2026).
   *
   * Ele perguntou *"Como faço para conseguir um boné ou acessório do CAP MARTIM"*, e o rascunho
   * respondeu: *"Temos adesivos e camisetas da campanha disponíveis. Para te enviar, preciso saber
   * sua cidade."* Ele apagou a mensagem: *"a IA confirmou algo sem saber"*.
   *
   * **É a irmã do caso da Sandra (06/09), e a diferença é o tempo do verbo.** Lá a alucinação era
   * sobre o PASSADO (*"já encaminhei seu pedido"*); aqui é sobre o PRESENTE — o que existe no
   * estoque. Ninguém disse à IA que há boné, adesivo ou camiseta: nada no prompt fala de material
   * físico, e a pergunta dele era justamente **como conseguir**. A resposta inventou a resposta.
   *
   * O dano é o mesmo e é pior que tom errado: a pessoa passa a esperar um item que talvez não
   * exista, e dito assim vira a expectativa que a Lei 9.504/97 trata.
   *
   * **A lista é de item FÍSICO, e "material" ficou de fora de propósito**: nesta base *"quero
   * receber o material"* é conteúdo DIGITAL — a frase mais comum que chega, e que a rodada
   * responde com modelo. Avisar nela seria alarme em cima do caso normal.
   */
  afirmouTer: 'afirma que temos o que não temos (bandeira, boné, camiseta) — só há folheto, adesivo e colinha',
  /**
   * **A IA disse que o áudio falhou e pediu para reenviar — e nós tínhamos ouvido tudo.**
   *
   * Print da Irene (07/09/2026): ela encaminhou **cinco áudios de uma vez**, às 08:28, e a rodada
   * respondeu *"Boa tarde! Desculpa, deve ter dado ruim no áudio. Pode enviar de novo? 🎙️"*. Ele
   * apagou a mensagem e mandou o print: *"falhou em pegar o texto da transcrição"*.
   *
   * **Medido na API antes de mexer, e a leitura dele está invertida:** os cinco áudios chegaram
   * **com transcrição** (1.909 caracteres somados, `processing: false`, `error` vazio), e a
   * transcrição chegou inteira à IA. O que ela fez foi **responder o conteúdo de dentro de um
   * áudio encaminhado** — o último do lote é uma pessoa dizendo a outra *"não deu pra ouvir nada
   * que você botou ali, tá mudo?"*, e a IA leu aquilo como se fosse dirigido a nós.
   *
   * **É uma afirmação falsa sobre o nosso próprio lado**, que é o que a torna mecânica: o painel
   * SABE se chegou texto legível dela. Por isso o aviso é condicionado — quando o áudio vem mesmo
   * sem transcrição, pedir para reenviar é a resposta certa e não pode ser barrada.
   */
  pediuReenvio: 'diz que o áudio ou a mensagem falhou e pede para reenviar — mas a mensagem dela chegou legível',
  /**
   * **Mandar a pessoa procurar quem ela já está procurando.**
   *
   * Print de 07/09/2026, o contato que oferecia patrocínio: o rascunho respondeu *"a melhor forma
   * é conversar direto com a coordenação. Você pode entrar em contato com a equipe de campanha"*.
   * Ele apagou, e a regra que ditou fecha as duas pontas: *"nada será aceito agora em período
   * eleitoral, os contratos que deviam ser feitos já foram feitos"*. **Não há coordenação para
   * conversar** — a frase promete uma conversa que não vai acontecer.
   *
   * **E o defeito é maior que este caso, o que é o que o torna mecânico:** quem escreve para o
   * WhatsApp do mandato JÁ ESTÁ falando com a equipe. Mandá-la procurar a equipe, a coordenação ou
   * a campanha é devolver a pessoa para o lugar em que ela já está — não importa o assunto.
   *
   * **Encaminhar para FORA continua livre** (a prefeitura, a Secretaria de Saúde, o SINE): a lista
   * é só do que somos nós. E a primeira pessoa também: *"vou falar com a equipe"* é o mandato
   * fazendo, não a pessoa sendo mandada embora — é a frase que a regra 5 dá como exemplo do que se
   * pode dizer com verdade.
   */
  mandouProcurarNos: 'manda a pessoa procurar a equipe ou a coordenação — ela já está falando com a equipe',
  /**
   * **Cargo ou número de outro candidato da chapa** — ver `conferirChapa`, print da Nara
   * (08/09/2026). Barra o envio automático porque é o erro que **manda o eleitor votar em outra
   * pessoa**, e mensagem de WhatsApp não volta.
   */
  chapaTrocada: 'atribui a alguém da chapa um cargo ou número que não é dele — confira na colinha',
  /**
   * **"Não precisa se desculpar" para quem não se desculpou** — print da Dileta (09/09/2026). Ela
   * escreveu duas linhas, *"Bom dia"* e *"Preciso de uma ajuda sua"*, e o rascunho respondeu
   * *"Entendo que você precisa de ajuda — não precisa se desculpar"*. Ele: *"de onde saiu que ela
   * pediu desculpas?"*
   *
   * **Medido: a frase aparece CINCO vezes no padrão dele**, e a condição que a libera — *"ela se
   * desculpa por ter pedido algo"* — aparece **uma**. A repetição venceu a condição.
   *
   * **É a terceira invenção da mesma família em três dias**, e as três vêm de copiar texto pronto
   * sem conferir a premissa: a resposta do "falar com o deputado" para quem pediu um representante
   * (3.14), a lista de materiais recitada (3.23), e agora uma frase que **afirma um fato sobre o que
   * ela fez**. Esta é a pior das três: as outras soam fora de contexto, esta diz à pessoa que ela se
   * comportou de um jeito que não se comportou.
   *
   * **Mecânica de verdade:** a conversa está aqui, e desculpa é palavra, não julgamento.
   */
  desculpaInexistente: 'diz "não precisa se desculpar" e ela não se desculpou — tire a frase',
  /**
   * **"Aqui é só voluntário, sem remuneração" para quem não pediu trabalho** — anotação de
   * 10/09/2026. Um áudio de apoio (*"tu precisava fazer uma visita aqui... pra poder te ajudar na
   * votação... o meu voto é certo pra ti"*) recebeu *"estamos trabalhando apenas com voluntários não
   * remunerados; se for do seu interesse, mande o endereço completo"*. Ele: *"é praticamente uma
   * mensagem de apoio, o rascunho foi totalmente errado"*.
   *
   * **Medido: os nove detectores deram null, e a decisão (tecla 6, IA) estava certa.** Quem errou foi
   * o modelo, usando a resposta pronta `trabalhar-na-campanha` como BASE (a instrução de 3.22) para
   * uma fala que só PARECIA oferta — "te ajudar" perto de "votação". É a quarta vez da proximidade
   * lexical, e a mesma família do `desculpaInexistente`: **frase pronta carrega uma premissa**, e a
   * premissa desta é *"ela falou em trabalhar ou em ganhar"*. Dizer "não há remuneração" a quem não
   * pediu nada afirma que ela pediu.
   *
   * **Mecânica:** a conversa está aqui, e o que libera a frase é vocabulário de trabalho ou de
   * pagamento dito POR ELA (`ELA_FALOU_DE_TRABALHO`, lida em `ia-cliente`).
   */
  trabalhoInexistente: 'fala de trabalho voluntário ou remuneração, e ela não falou em trabalhar nem em ganhar — confira o que ela disse',
  /**
   * **O rascunho inteiro é a nossa última mensagem de novo** — relato dele (15/09/2026): *"a IA tem
   * agradecido múltiplas vezes pelo apoio e dado boa tarde múltiplas vezes, uma mensagem após a
   * outra"*, e a regra de 12/09: *"esse é o maior sinal de máquina respondendo, repetição, não pode
   * acontecer isso"*.
   *
   * `semRepetirONosso` tira a parte repetida quando sobra mensagem; quando **não sobra nada**, não há
   * o que consertar — o que a IA escreveu não acrescenta nada à conversa, e mandar de novo é o defeito
   * que ele apagou na tela duas vezes. Então este barra o envio automático e o rascunho fica com ele.
   */
  sopraRepeticao: 'o rascunho só repete a nossa última mensagem — não há nada novo nele',
};

/**
 * **As frases que abrem um atendimento do caso** — print da Irema (10/09/2026). Uma preocupação com
 * aposentadoria recebeu *"você já deu entrada no INSS ou teve o benefício negado?… Se você já tentou e
 * não foi atendida, conte o que aconteceu que a gente vê como orientar. Fico no aguardo"*. Ele: *"nós
 * não somos um canal de resolução de problemas, a intenção é ganhar votos"* — e, perguntado por aviso,
 * *"eu não quero aviso, quero que o comportamento da IA mude"*.
 *
 * **De onde veio, medido:** da última linha da regra 11, escrita por mim (*"peça que ela conte o que
 * aconteceu"*). As respostas prontas `pedido-ajuda` e `pedido-emprego` também terminam com *"me conta o
 * que aconteceu. Aí sim é trabalho nosso"* — mas os exemplos entram cortados em 500 caracteres e essa
 * frase fica DEPOIS do corte: a IA nunca a leu ali. Tirá-la dos exemplos é **garantia**, para o dia em
 * que o corte mudar ou uma resposta pronta curta disser o mesmo; o texto pronto dele fica intocado.
 *
 * **O que fica é o CONVITE, não a pergunta:** *"em que podemos ajudar?"* é a pergunta certa para quem
 * não disse o que quer, e continua lá.
 */
const CONVIDA_A_CONTAR_O_CASO = [
  /(^|[^\p{L}])trabalho\s+nosso/iu,
  /(^|[^\p{L}])(me\s+)?(conta|conte|contar|explica|explique|explicar|detalha|detalhe|detalhar)\s+(pra\s+mim\s+|para\s+mim\s+)?(o\s+que\s+aconteceu|melhor|mais|os\s+detalhes|a\s+sua\s+situa[çc][ãa]o|o\s+seu\s+caso)/iu,
  /(^|[^\p{L}])fico\s+no\s+aguardo/iu,
  /(^|[^\p{L}])aguardo\s+(o\s+|a\s+)?(seu|sua|teu|tua)\s+(retorno|resposta|mensagem|contato)/iu,
  /(^|[^\p{L}])(a\s+gente|eu|n[óo]s)\s+(v[êe]|vejo|vemos|v[êe]\s+aqui)\s+como\s+(orientar|resolver|ajudar|encaminhar)/iu,
  /(^|[^\p{L}])para\s+(eu|a\s+gente|que\s+eu)\s+(te\s+|lhe\s+)?(orientar|encaminhar|ver\s+como)/iu,
];

/**
 * O texto de uma resposta pronta sem as frases que convidam a contar o caso — é o que a IA lê como
 * exemplo. Frase a frase: tirar a frase inteira é o que não deixa meia oração pendurada.
 */
export function semConviteAoCaso(texto) {
  return String(texto || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((f) => f.trim() && !CONVIDA_A_CONTAR_O_CASO.some((re) => re.test(f)))
    .join(' ');
}

/**
 * **Avisos que NÃO barram o envio automático.**
 *
 * Existem porque o painel consegue ver o problema e **não** consegue consertá-lo sem reescrever a
 * frase — então ele aparece na tela e a rodada segue. A separação é decisão dele, de 12/09/2026:
 * *"eu quero que mude o que a IA diz, não parar todo tempo para eu revisar; isso tira todo sentido
 * do automatizado"*. **Trava que para a rodada em caso comum não é proteção: é a automação
 * desligada.** O que muda comportamento é o prompt; isto é o que mostra quando ele não foi cumprido.
 */
export const AVISOS_QUE_SO_AVISAM = {
  /**
   * **Pede o endereço de entrega sem ninguém ter pedido material de campanha** — print da Cleo
   * (08/09/2026), que pediu que comprássemos um encosto ortopédico e uma cadeira de rodas.
   *
   * **É a metade mecânica de um erro que o prompt sozinho não segura.** As outras duas metades
   * (o detector e o escopo da regra 5) reduzem a frequência; esta barra o envio. E ela é mecânica
   * de verdade porque **o painel SABE as duas coisas**: `pedeMaterial` é sinal calculado do que ela
   * escreveu, e `templates.ehPedidoDeEndereco` é o invariante do nosso pedido de endereço — o mesmo
   * que aplica a etiqueta de material desde 04/09.
   *
   * **Pedir o endereço é o passo irreversível deste assunto:** ele cria a expectativa de entrega,
   * que é a expectativa que a Lei 9.504/97 trata. Medido no rascunho que saiu para ela: os avisos
   * eram um só, cosmético, e `rascunhoPodeSairSozinho` devolvia **true** — com "Automatizar"
   * marcada aquela mensagem sairia sozinha.
   *
   * **DEIXOU DE BARRAR em 12/09/2026, por decisão dele** — *"eu quero que mude o que a IA diz, não
   * parar todo tempo para eu revisar; isso tira todo sentido do automatizado"*. Enquanto o
   * invariante só conhecia a redação do modelo aprovado ela quase nunca disparava; reconhecida a
   * forma curta (*"mande seu endereço"*), ela passou a parar a rodada em caso comum — e rodada que
   * para não é proteção, é a automação desligada. **O conserto foi para onde a decisão é tomada:**
   * a regra do endereço está na regra 12 e repetida no fim do bloco do CONTATO, colada no ponto em
   * que o modelo escreve. Este aviso continua na tela, e é ele que mostra se o prompt não bastou.
   *
   * Condicionado, como o `pediuReenvio`: quem PEDIU material de campanha tem que receber o pedido
   * de endereço, que é o caminho certo dele desde a print da Jonice.
   */
  enderecoSemMaterial: 'pede o endereço de entrega, e ela não pediu material de campanha — confira o que ela pediu',
};

/**
 * **Ela falou em TRABALHAR ou em GANHAR?** — o que libera `AVISOS_QUE_IMPEDEM_ENVIO.trabalhoInexistente`.
 *
 * Larga de propósito, porque aqui o erro barato é o falso NEGATIVO da trava: qualquer menção a
 * trabalho, emprego, vaga, currículo, salário, contratação, serviço, divulgação ou panfletagem
 * libera a frase. **Duas palavras ficaram de fora e são a razão da trava:** `ajudar` (*"pra poder te
 * ajudar na votação"* é apoio, e é o caso da anotação) e `ganhar` solto (*"vamos ganhar essa"* é o
 * grito de campanha mais comum desta base) — ganhar só conta como *"quanto vou ganhar"* ou *"vou
 * ganhar"*.
 */
export const ELA_FALOU_DE_TRABALHO =
  /(^|[^\p{L}])(trabalh|emprego|vagas?([^\p{L}]|$)|curr[íi]culo|sal[áa]ri|remunera|contrat|servi[çc]o|freela|cach[êe]|ajuda\s+de\s+custo|volunt[áa]ri|divulg|panflet|cabo\s+eleitoral|or[çc]amento|quanto\s+.{0,15}?(ganh|receb|pag)|vou\s+ganhar|(voc[êe]s|vcs)\s+pagam)/iu;

/** O rascunho fala de trabalho voluntário ou de remuneração — a frase de `trabalhar-na-campanha`. */
const FALA_DE_REMUNERACAO =
  /(^|[^\p{L}])(remunera|volunt[áa]ri|ajuda\s+de\s+custo|n[ãa]o\s+(pagamos|contratamos|h[áa]\s+contrata))/iu;

// ---------------------------------------------------------------------------
// A chapa: cargo trocado e número de outro
// ---------------------------------------------------------------------------

/** Sem acento e em minúscula — a comparação é de nome próprio, e acento não é diferença. */
const semAcentoIA = (s) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Como cada cargo aparece ESCRITO numa mensagem. As chaves são as da tabela do dossiê.
 *
 * **"Deputado" sozinho não conta como cargo nenhum**, de propósito: sem o qualificador ele é
 * ambíguo, e contá-lo como um dos dois faria a trava acusar a metade das frases certas.
 */
const CARGOS_ESCRITOS = [
  { chave: 'presidente', re: /(^|[^\p{L}])(presidente|presid[êe]ncia)/iu },
  { chave: 'governador', re: /(^|[^\p{L}])(governador|governo do estado)/iu },
  { chave: 'senador', re: /(^|[^\p{L}])(senador|senadora|senado)(\P{L}|$)/iu },
  { chave: 'deputado federal', re: /(deputad[oa]s?\s+federa|c[âa]mara\s+federal|c[âa]mara\s+dos\s+deputados)/iu },
  { chave: 'deputado estadual', re: /(deputad[oa]s?\s+estadua|assembleia\s+legislativa)/iu },
];

/**
 * Sobrenome que NÃO serve como apelido: significa outra pessoa com a mesma frequência.
 *
 * `bolsonaro` sozinho é o Jair na fala desta base, não o Flávio da chapa. `zucco` é o caso que o
 * próprio dossiê nomeia como *"o erro mais provável"* — há o Luciano (governador) e o Delegado
 * (estadual) —, e por isso ele tem guarda própria mais abaixo em vez de sair da lista: "Zucco" é
 * o nome inteiro dele na tabela, e tirá-lo deixaria o governador sem conferência nenhuma.
 */
const SOBRENOME_AMBIGUO = new Set(['bolsonaro']);

/** Como este nome pode aparecer escrito: o nome inteiro, e o sobrenome quando ele identifica. */
function apelidosDaChapa(nome) {
  const inteiro = semAcentoIA(nome).replace(/\s+/g, ' ').trim();
  const partes = inteiro.split(' ');
  const lista = [inteiro];
  const ultimo = partes[partes.length - 1];
  if (partes.length > 1 && ultimo.length >= 5 && !SOBRENOME_AMBIGUO.has(ultimo)) lista.push(ultimo);
  return lista;
}

/**
 * Como o rascunho diz que ela não precisava se desculpar, e como ELA se desculpa.
 *
 * As duas listas vivem juntas porque uma só faz sentido contra a outra: a primeira é o que a IA
 * escreve, a segunda é o que tem de existir na conversa para aquilo ser verdade.
 */
const DIZ_QUE_NAO_PRECISA_DESCULPAR =
  /(^|[^\p{L}])(n[ãa]o\s+(precisa|precisava|precisa\s+ficar)\s+(se\s+)?(desculp|pedir\s+desculp|se\s+sentir\s+mal)|sem\s+necessidade\s+de\s+(se\s+)?desculp|n[ãa]o\s+tem\s+(do\s+)?que\s+(se\s+)?desculp)/iu;

/** Ela se desculpou de verdade. "Desculpa" solto como "com licença" conta: é a mesma intenção. */
export const ELA_SE_DESCULPOU =
  /(^|[^\p{L}])(desculp|perd[ãa]o|me\s+perdoe|foi\s+mal|sinto\s+muito\s+(por|em)\s+(incomodar|pedir)|vergonha\s+de\s+(pedir|estar\s+pedindo)|n[ãa]o\s+queria\s+(te\s+)?incomodar|incomodar\s+voc[êe])/iu;

/** Nome que vira pedaço de expressão: o dossiê é editável, e um ponto ali quebraria a busca. */
const escaparParaRegex = (s) => String(s).replace(/[^\p{L}\p{N}\s]/gu, (c) => `\\${c}`);

/** Onde este nome aparece no texto já normalizado. Vazio quando não aparece. */
function ondeAparece(texto, nome) {
  const posicoes = [];
  for (const apelido of apelidosDaChapa(nome)) {
    const re = new RegExp(`(^|[^\\p{L}])${escaparParaRegex(apelido)}(\\P{L}|$)`, 'giu');
    let m;
    while ((m = re.exec(texto))) {
      /**
       * **O DELEGADO Zucco não é o Zucco da chapa.** O dossiê chama isto de *"o erro mais provável"*:
       * são irmãos, do mesmo campo, na mesma eleição — um disputa o governo e o outro a reeleição
       * a deputado estadual. Sem esta guarda, a frase certa sobre o Delegado seria acusada.
       */
      const antes = texto.slice(Math.max(0, m.index - 12), m.index + m[1].length);
      if (/delegad[oa]\s*$/.test(antes)) continue;
      const ini = m.index + m[1].length;
      posicoes.push({ ini, fim: ini + apelido.length });
    }
  }
  return posicoes;
}

/**
 * De quem é este número — o que está ANTES dele, ou o que vem DEPOIS?
 *
 * **Proximidade pura não serve, e a medição pegou isto.** Em *"Para senador são dois: Sanderson
 * (222) e Marcel Van Hattem (300)"*, o `222` está a 11 caracteres de "Sanderson" e a 6 de "Marcel"
 * — o dono certo é o mais LONGE. O que decide é o que está no meio: `" ("` liga, `" e "` separa,
 * porque o "e" começa outro item da lista.
 *
 * Por isso a ligação é por FORMA, nas duas ordens que o português usa: *"Sanderson (222)"* e
 * *"Martim, número 10122"* (o nome antes), *"vote 22 no Zucco"* (o nome depois). Não achando
 * nenhuma das duas, o número fica sem dono e nada é acusado — errar para o lado de não acusar.
 */
const LIGA_ANTES = /^[\s,;:–—-]*\(?\s*(n[uú]mero|n[ºo°]\.?)?\s*$/;
const LIGA_DEPOIS = /^[\s,;:)–—-]*(no|na|em|para|pelo|pela|e o|e a)?\s*$/;

function deQuemEEsteNumero(texto, ini, fim, mencoes) {
  let antes = null;
  let depois = null;
  for (const men of mencoes) {
    if (men.fim <= ini && ini - men.fim <= 40 && LIGA_ANTES.test(texto.slice(men.fim, ini))) {
      if (!antes || men.fim > antes.fim) antes = men;
    }
    if (men.ini >= fim && men.ini - fim <= 40 && LIGA_DEPOIS.test(texto.slice(fim, men.ini))) {
      if (!depois || men.ini < depois.ini) depois = men;
    }
  }
  return (antes || depois)?.pessoa || null;
}

/**
 * **O rascunho atribuiu a alguém da chapa um cargo ou um número que não é dele?**
 *
 * Print da Nara (08/09/2026): ela perguntou quem eram os candidatos a **deputado federal**, e o
 * rascunho respondeu *"nossa chapa tem o Felipe Pedri (número 2228) e o Marcel Van Hattem (número
 * 300)"*. Ele: *"marcou van hattem para deputado federal sendo que é senador"*. A tabela do dossiê
 * está **certa** (Senador | Marcel Van Hattem | 300) e foi mandada inteira no prompt — o que houve
 * é que o modelo tem um saber próprio que CONTRADIZ a chapa: Van Hattem é hoje deputado federal, e
 * nesta eleição concorre ao Senado. Contra prior assim, instrução no prompt é pedido; isto é regra.
 *
 * **É a pior classe de erro deste projeto**, pior que tom ou contexto: manda o eleitor votar em
 * outra pessoa, e a mensagem não volta. Por isso entra em `AVISOS_QUE_IMPEDEM_ENVIO`.
 *
 * **Duas conferências, e as duas erram para o lado de não acusar:**
 *
 * 1. **Cargo** — frase a frase (o mesmo recorte de `mandouProcurarNos`): se um nome da chapa
 *    aparece numa frase que fala de um cargo, e o cargo DELE não aparece em lugar nenhum daquela
 *    frase, é troca. Uma frase que diga os dois (*"é deputado federal hoje e agora vai ao Senado"*)
 *    passa, porque a frase está certa.
 * 2. **Número** — só onde o texto está claramente dando um número de urna (depois de "número",
 *    "vote", "digite" ou entre parênteses), e o número é atribuído ao **nome mais próximo**. Sem o
 *    "mais próximo", *"vote 22 no Zucco e 10122 no Martim"* acusaria; sem o contexto de voto,
 *    *"o Martim estará dia 22 em Canoas"* acusaria.
 *
 * @param {string} texto o rascunho
 * @param {{cargo:string,nome:string,numero:string}[]} chapa a tabela do dossiê
 * @returns {string} o problema, em uma linha; vazio quando não há
 */
export function conferirChapa(texto, chapa) {
  const lista = (chapa || []).filter((p) => p && p.nome && p.cargo);
  if (!lista.length) return '';
  const cru = String(texto || '');
  if (!cru.trim()) return '';

  // 1) Cargo trocado.
  /**
   * **"Ele é" na frase seguinte também é cargo dele** — print da Juscelia (10/09/2026). A pergunta
   * *"O senhor é senador?"* passou a pedir identificação E o cargo, e a forma natural é *"Somos a
   * equipe do Capitão Martim. Ele é deputado estadual."* Medido: com "federal" no lugar, a trava não
   * acusava — o nome e o cargo estavam em frases diferentes. O pronome só herda o nome da frase
   * IMEDIATAMENTE anterior, e só quando ela nomeia uma pessoa: com duas, "ele" é ambíguo.
   */
  let doAnterior = null;
  for (const frase of cru.split(/(?<=[.!?])\s+|\n+/)) {
    const f = semAcentoIA(frase);
    const nomeados = lista.filter((p) => ondeAparece(f, p.nome).length);
    const cargosAqui = CARGOS_ESCRITOS.filter((c) => c.re.test(frase)).map((c) => c.chave);
    const alvo = nomeados.length ? nomeados : doAnterior && /^\s*(ele|ela)\b/.test(f) ? [doAnterior] : [];
    doAnterior = nomeados.length === 1 ? nomeados[0] : null;
    if (!cargosAqui.length) continue;
    for (const pessoa of alvo) {
      const dele = semAcentoIA(pessoa.cargo);
      if (!cargosAqui.includes(dele)) {
        return `${pessoa.nome} aparece como "${cargosAqui[0]}" e é ${pessoa.cargo.toLowerCase()}`;
      }
    }
  }

  // 2) Número de outro.
  const f = semAcentoIA(cru);
  const mencoes = [];
  for (const pessoa of lista) for (const onde of ondeAparece(f, pessoa.nome)) mencoes.push({ ...onde, pessoa });
  if (mencoes.length) {
    for (const pessoa of lista) {
      if (!pessoa.numero) continue;
      const re = new RegExp(`(?<!\\d)${pessoa.numero}(?!\\d)`, 'g');
      let m;
      while ((m = re.exec(f))) {
        /**
         * Só onde o texto está dando um número de urna — ver o comentário acima.
         *
         * **O traço e os dois-pontos entraram em 09/09/2026**, quando ele decidiu que a colinha vai
         * DIGITADA (*"só passe a lista com os números e o que cada um é"*). O formato de lista é
         * `Deputado Estadual: Capitão Martim - 10122`, e medindo a trava contra ele descobri que
         * **`Capitão Martim - 2228` passava**: o filtro só conhecia "número", "vote" e o parêntese.
         * Eu ia liberar a regra citando esta trava como a proteção que a torna segura, e ela não
         * cobria o formato que a regra produz.
         *
         * Ampliar aqui é seguro porque **quem decide o dono continua sendo `deQuemEEsteNumero`**:
         * em *"o Capitão Martim estará em Canoas - 22 de setembro"* o traço casa, mas entre o nome e
         * o número há palavras, então o número fica sem dono e nada é acusado.
         */
        const antes = f.slice(Math.max(0, m.index - 18), m.index);
        if (!/(numero|n[.ºo]\s*|vote|voto|votar|digite|\(|[-–—:])\s*$/.test(antes)) continue;
        const dono = deQuemEEsteNumero(f, m.index, m.index + pessoa.numero.length, mencoes);
        if (dono && dono.numero !== pessoa.numero) {
          return `o número ${pessoa.numero} aparece colado em ${dono.nome}, e é de ${pessoa.nome}`;
        }
      }
    }
  }

  return '';
}

/** O rascunho pode sair sozinho, ou algum aviso exige que uma pessoa leia antes? */
/**
 * **A lista de casos SENSÍVEIS foi RETIRADA em 06/09/2026, no mesmo dia em que entrou.**
 *
 * Ela nasceu da print da Dima Souza, com o meu diagnóstico de que o texto que saiu tinha vindo da
 * IA. **Estava errado, e foi ele quem corrigiu:** *"foi o determinístico novamente mandando
 * mensagem, no outro caso foi também; volte a mensagem automática da IA"*.
 *
 * O que estava mandando mensagem fora de contexto era `pedeAjudaFinanceira`, largo demais — a
 * palavra "dinheiro" solta bastava, e num texto político sobre auxílios ela aparece o tempo todo.
 * Barrar a IA por causa disso foi tratar o sintoma no lugar errado, e o preço era alto: a rodada
 * automática pararia justamente nos casos que ela existe para resolver.
 *
 * **A lição, que fica:** antes de pôr trava na IA, prove que foi a IA. O Andamento da rodada
 * registra cada envio automático com o motivo, e é lá que se olha — eu deduzi pelo caminho ("nenhuma
 * resposta pronta alcança este contexto") e o caminho estava certo para o quadro e errado para a
 * conversa real, porque `pedeAjudaFinanceira` alcançava.
 *
 * **As duas travas de TEXTO continuam** (marcador esquecido, promessa de entregar), mais a de
 * afirmar ação, que entrou na 2.74 e é sobre o que a IA escreve — não sobre o caso.
 */
export function rascunhoPodeSairSozinho(avisos = []) {
  const impedem = Object.values(AVISOS_QUE_IMPEDEM_ENVIO);
  return !(avisos || []).some((a) => impedem.includes(a));
}

export function revisarRascunho(bruto, agora, contexto = {}) {
  let texto = String(bruto || '').trim();
  const avisos = [];
  if (!texto) return { texto: '', avisos: ['a IA não devolveu texto'] };

  if (contexto?.jaFalamos && SE_APRESENTANDO.some((re) => re.test(texto))) {
    avisos.push('o rascunho se apresenta como primeiro contato, e vocês já conversaram — leia a abertura');
  } else if (contexto?.jaNosConhece && SE_APRESENTANDO.some((re) => re.test(texto))) {
    /**
     * **Sessão nova não é pessoa nova** — anotação de 10/09/2026: *"não tem necessidade de se
     * identificar como a equipe do Martim sempre; se identificar é quando a pessoa é nova no
     * WhatsApp ou ela perguntou"*. `jaFalamos` só olha ESTA sessão, e quem volta sozinho abre
     * sessão vazia — a armadilha da Rosa (05/09), agora do lado da IA.
     */
    avisos.push('o rascunho se apresenta, e esta pessoa já conversou conosco antes — só se identifique se ela perguntou quem fala');
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
  /**
   * **Já falamos hoje: a saudação SAI, não é corrigida** — ver `semSaudacao`. Enquanto a correção
   * vinha sozinha, o efeito desta função no caso repetido era deixar a segunda "Boa tarde" do dia
   * bem-formada.
   *
   * `contexto.jaFalamosHoje` chega do `ia-cliente`, que tem a conversa e o relógio. `undefined` não
   * confere nada: fora da rodada não há conversa medida, e tirar a saudação de um rascunho pedido à
   * mão seria decidir sem saber.
   */
  if (abertura && contexto?.jaFalamosHoje === true) {
    const sem = semSaudacao(texto);
    if (sem) {
      texto = sem;
      avisos.push('nós já falamos com ela hoje — tirei a saudação repetida da abertura');
    }
  } else if (abertura && abertura[1].toLowerCase() !== certa.toLowerCase()) {
    texto = texto.replace(SAUDACAO_NO_COMECO, certa);
    avisos.push(`a IA abriu com "${abertura[1]}" e agora é ${certa.toLowerCase()} — troquei`);
  }

  /**
   * **O que a nossa última mensagem já dizia sai** — ver `semRepetirONosso`. Depois da saudação de
   * propósito: a abertura já foi resolvida por quem sabe que ela é uma saudação.
   *
   * **Sobrando só a repetição, o texto fica e o aviso avisa.** É o piso do `semFalarDeTranscricao`:
   * devolver farelo ao eleitor é pior que devolver a repetição para ele ler.
   */
  if (contexto?.nossaUltima) {
    const semRepetir = semRepetirONosso(texto, contexto.nossaUltima);
    if (semRepetir) {
      texto = semRepetir;
      avisos.push('o rascunho repetia o que a nossa última mensagem já dizia — tirei a parte repetida');
    } else if (soRepeteONosso(texto, contexto.nossaUltima)) {
      avisos.push(AVISOS_QUE_IMPEDEM_ENVIO.sopraRepeticao);
    }
  }

  /**
   * **"Gabinete" é consertado, não avisado** — o segundo rascunho da Eloiza (10/09/2026) saiu com
   * *"o gabinete procuraria ajudar"*, três dias depois de a palavra sair do vocabulário (decisão dele,
   * 07/09) e com a proibição escrita no prompt. É mecânico como a saudação: a MESMA tabela que migrou
   * as respostas prontas dele, com a concordância (`o gabinete` → `a equipe`).
   *
   * **Gabinete de OUTRA pessoa fica** — *"fui no gabinete do prefeito"* é um lugar, e trocar mudaria o
   * sentido.
   */
  if (!/gabinetes?\s+d[oa]s?\s+(prefeit|vereador|governador|secret|ministr|juiz|presiden)/i.test(texto)) {
    const trocado = semGabinete(texto);
    if (trocado !== texto) {
      texto = trocado;
      avisos.push('a IA escreveu "gabinete", que saiu do vocabulário — troquei por "equipe"');
    }
  }

  /**
   * **Quem atende é a EQUIPE, e a apresentação errada é mecânica** — ver
   * `semDizerQueEOWhatsAppDele`, print dele de 22/09/2026.
   */
  const semOWhatsAppDele = semDizerQueEOWhatsAppDele(texto);
  if (semOWhatsAppDele) {
    texto = semOWhatsAppDele;
    avisos.push('a IA se apresentou como "o WhatsApp do Capitão Martim" — troquei por "a equipe dele"');
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
  /**
   * **"Encaminhamos" é presente e futuro também — e a trava o lia só como passado.** Print de 10/09/2026
   * (quem perguntou *"como faço pra trabalhar na campanha"*): o rascunho dizia *"se tiver interesse
   * mesmo assim, é só mandar seu endereço que encaminhamos ao assessor da região"* — o texto certo, o
   * repasse condicionado que é a única promessa que a regra dele (08/09) permite —, e foi BARRADO com
   * *"afirma que alguém já providenciou algo"*. Ele: *"resposta correta, já não tem necessidade de
   * parar"*. Medido: era o único aviso.
   *
   * **A forma em -EI só pode ser passado** (*"encaminhei"*, a Sandra de 06/09) e continua barrando
   * sempre. **A forma em -AMOS é ambígua**, e só vale como afirmação com o que a torna passado: *"já"*
   * antes, ou *"seu pedido"* logo depois. E **frase com condição antes do verbo** (*"se"*, *"é só"*,
   * *"assim que"*, *"me manda… que"*) é promessa de repasse, não afirmação de feito.
   */
  const AFIRMOU_ACAO = [
    /\b(j[áa]\s+)?(encaminhei|repassei|solicitei|providenciei|registrei|anotei)\b/i,
    /\bj[áa]\s+(encaminhamos|repassamos|solicitamos|providenciamos|registramos|anotamos)\b/i,
    /\b(encaminhamos|repassamos|solicitamos|providenciamos|registramos|anotamos)\s+(o\s+|a\s+)?(seu|sua|teu|tua)\s+(pedido|solicita[çc][ãa]o|contato|cadastro|endere[çc]o|dados|mensagem|caso)\b/i,
    /\bj[áa]\s+(pedi|pedimos|avisei|avisamos|separei|separamos|enviei|enviamos|mandei|mandamos)\b/i,
    /\b(seu|o)\s+pedido\s+(foi|j[áa]\s+foi)\s+(encaminhado|repassado|registrado|anotado|enviado)/i,
    /\bfoi\s+(encaminhado|repassado)\s+(ao|para|pro)\b/i,
  ];
  const CONDICAO_ANTES =
    /(^|[^\p{L}])(se|caso|assim\s+que|quando|depois\s+que|basta|[ée]\s+s[óo]|me\s+(manda|mande|envia|envie|passa|passe)|mande|envie)([^\p{L}]|$)/iu;
  const afirmouFeito = texto.split(/(?<=[.!?])\s+|\n+/).some((frase) =>
    AFIRMOU_ACAO.some((re) => {
      const achado = re.exec(frase);
      return !!achado && !CONDICAO_ANTES.test(frase.slice(0, achado.index));
    })
  );
  if (afirmouFeito) {
    avisos.push(AVISOS_QUE_IMPEDEM_ENVIO.afirmouAcao);
  }

  /**
   * **Afirmar que TEMOS material físico** — ver `AVISOS_QUE_IMPEDEM_ENVIO.afirmouTer`.
   *
   * A guarda que sustenta isto é a NEGATIVA: *"não temos adesivos para enviar"* é exatamente o que
   * a resposta honesta diz, e barrá-la seria impedir o texto certo. Por isso a negação vence,
   * testada antes.
   */
  /**
   * **Só o que NÃO temos** (22/09/2026): folheto, santinho, panfleto, folder e adesivo saíram da lista,
   * porque agora ele disse que existem — "o que temos são folhetos e adesivos" é o texto CERTO.
   *
   * **E `String.raw` é obrigatório aqui**: em template literal comum `\s` vira `s` e `\p{L}` vira
   * `p{L}`, e a primeira expressão era `temoss+...` — nunca casou desde que nasceu (07/09). Quem
   * barrava o caso do Lucas era só a segunda, a do "disponível".
   */
  const ITEM_FISICO = 'camiseta|bon[ée]|bandeira|chaveiro|brinde|cartaz|faixa|colete|caneta|placa|banner|bottom';
  const AFIRMOU_TER = [
    new RegExp(String.raw`(^|[^\p{L}])(temos|tenho|dispomos\s+de|disponibilizamos)\s+[^.!?]{0,40}?(${ITEM_FISICO})`, 'iu'),
    new RegExp(String.raw`(${ITEM_FISICO})[^.!?]{0,30}(dispon[íi]ve(l|is)|em\s+estoque)`, 'iu'),
  ];
  const NEGA_TER = /(^|[^\p{L}])n[ãa]o\s+(temos|tenho|dispomos|h[áa])/iu;
  if (!NEGA_TER.test(texto) && AFIRMOU_TER.some((re) => re.test(texto))) {
    avisos.push(AVISOS_QUE_IMPEDEM_ENVIO.afirmouTer);
  }

  /**
   * **Dizer que o áudio falhou quando ele chegou** — ver `AVISOS_QUE_IMPEDEM_ENVIO.pediuReenvio`.
   *
   * A condição é `contexto.recebemosDela`, e ela é o que torna esta trava honesta: áudio que chega
   * mesmo sem transcrição existe, e nesse caso pedir para reenviar é a resposta CERTA. O que não
   * pode é dizer isso a quem mandou cinco áudios transcritos.
   *
   * A fronteira das expressões é `(^|[^\p{L}])` com a flag `u`, e não `\b`: a fronteira ASCII não
   * fecha depois de letra acentuada, e metade destas frases termina em "áudio". É a armadilha do
   * *"É nós"* (31/08) e a do *"Você deve receber"* (06/09), que já custaram uma trava escrita e
   * cega cada uma.
   */
  const MIDIA = '[áa]udio|v[íi]deo|arquivo|mensagem|foto|imagem|figura';
  const PEDIU_REENVIO = [
    // "pode mandar de novo?", "consegue enviar novamente", "dá pra gravar outra vez"
    new RegExp(
      `(pode|poderia|consegue|conseguiria|d[áa]\\s+pra|d[áa]\\s+para)\\s+(me\\s+)?(mandar|enviar|gravar|repetir|reenviar)[^.!?]{0,25}(de\\s+novo|novamente|outra\\s+vez)`,
      'iu'
    ),
    new RegExp(`(^|[^\\p{L}])(reenvi[ae]|reenviar|manda|mande|envie|envia)\\s+(de\\s+novo|novamente|outra\\s+vez)`, 'iu'),
    // "não deu para ouvir o áudio", "não consegui abrir o vídeo", "não recebi sua mensagem"
    new RegExp(
      `n[ãa]o\\s+(deu|foi\\s+poss[íi]vel|consegui|conseguimos|deu\\s+pra)[^.!?]{0,25}(ouvir|escutar|abrir|carregar|ver|receber)[^.!?]{0,20}(${MIDIA})`,
      'iu'
    ),
    new RegExp(`n[ãa]o\\s+(recebi|recebemos|chegou|chegaram)[^.!?]{0,20}(${MIDIA})`, 'iu'),
    // "o áudio não chegou", "o áudio veio mudo", "deve ter dado ruim no áudio"
    new RegExp(`(${MIDIA})[^.!?]{0,20}n[ãa]o\\s+(chegou|abriu|carregou|funcionou|veio|rodou)`, 'iu'),
    new RegExp(`(${MIDIA})[^.!?]{0,15}(veio|est[áa]|ficou)\\s+(mudo|vazio|sem\\s+som)`, 'iu'),
    new RegExp(`(deu|dado)\\s+(ruim|problema|erro|falha)[^.!?]{0,20}(${MIDIA})`, 'iu'),
    new RegExp(`(problema|erro|falha)\\s+(no|na|com\\s+o|com\\s+a)\\s+(${MIDIA})`, 'iu'),
  ];
  if (contexto?.recebemosDela && PEDIU_REENVIO.some((re) => re.test(texto))) {
    avisos.push(AVISOS_QUE_IMPEDEM_ENVIO.pediuReenvio);
  }

  /**
   * **Mandar procurar a equipe** — ver `AVISOS_QUE_IMPEDEM_ENVIO.mandouProcurarNos`.
   *
   * A conferência é **frase a frase**, e as três condições valem dentro da MESMA frase: alguém
   * sendo mandado (o verbo), o destino sendo NÓS, e a frase não estar na primeira pessoa. Sem o
   * recorte por frase, *"vou verificar com a equipe. Se precisar, procure a Secretaria de Saúde"*
   * casaria pelos pedaços de duas frases diferentes — que é o oposto do que a regra quer.
   */
  const SOMOS_NOS = /(equipe|coordena[çc][ãa]o|coordenador|assessoria|campanha|mandato|gabinete|deputado)/iu;
  const MANDA_PROCURAR =
    /(procur[ae]|procurar|entr[ae]\s+em\s+contato|entrar\s+em\s+contato|contat[ae]|contatar|fal[ae]|falar|convers[ae]|conversar|busqu[ae]|buscar|acion[ae]|acionar|dirij[ae]|dirigir)\s+(direto\s+|diretamente\s+)?(com\s+)?(a|o|à|ao)?\s*(equipe|coordena[çc][ãa]o|coordenador|assessoria|campanha|mandato|gabinete|deputado)/iu;
  /** Nós fazendo, e não ela sendo mandada. É a frase que a regra 5 dá como exemplo do que se pode dizer. */
  const NOS_FAZENDO = /(^|[^\p{L}])(vou|vamos|irei|iremos|posso|podemos|consigo|conseguimos|estou|estamos|j[áa])(\s|$)/iu;
  for (const frase of texto.split(/(?<=[.!?])\s+|\n+/)) {
    if (!SOMOS_NOS.test(frase)) continue;
    if (NOS_FAZENDO.test(frase)) continue;
    if (MANDA_PROCURAR.test(frase)) {
      avisos.push(AVISOS_QUE_IMPEDEM_ENVIO.mandouProcurarNos);
      break;
    }
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
    /**
     * **A promessa em TERCEIRA PESSOA e na impessoal** — print da Jonice Terezinha (08/09/2026),
     * com a pergunta dele: *"esse erro de confirmar algo já foi resolvido?"*.
     *
     * A mensagem que saiu era *"Sobre o material do Bolsonaro para o carro — **a gente consegue
     * providenciar**, mas preciso do seu endereço"*. Medido: **zero avisos**, sairia sozinha. O
     * padrão de cima só conhece a primeira pessoa (`vou`, `vamos`, `posso`, `consigo`), e a forma
     * que saiu foi *"a gente consegue"*.
     *
     * É a mesma lição da voz dela (a Sandra, 06/09): **a promessa muda de pessoa, não de natureza.**
     * Aqui entram a impessoal (*"dá para providenciar"*) e o sujeito de fora (*"a equipe manda"*,
     * *"eles enviam"*) — este último é o que a regra dele de 08/09 proíbe de propósito: quem diz o
     * que a equipe dos materiais vai fazer é a equipe dos materiais.
     */
    /\b(a\s+gente|voc[êe]s|eles|elas|a\s+equipe|o\s+pessoal)\s+(consegue[m]?|arruma[m]?|providencia[m]?|manda[m]?|envia[m]?|d[áa]|dão)\b[^.!?]{0,30}\b(mandar|enviar|dar|arrumar|conseguir|providenciar|material|adesivo|camiseta|bon[ée]|bandeira)?/i,
    /\bd[áa]\s+(pra|para)\s+(mandar|enviar|arrumar|conseguir|providenciar)\b/i,
  ];
  if (PROMESSA.some((re) => re.test(texto))) {
    avisos.push(AVISOS_QUE_IMPEDEM_ENVIO.promessa);
  }
  if (/\b(cesta|rem[ée]dio|dinheiro|pix|emprego|vaga|passagem)\b/i.test(texto)) {
    avisos.push('cita bem ou benefício (cesta, remédio, dinheiro, emprego) — a lei eleitoral proíbe prometer');
  }
  /**
   * **Endereço de entrega pedido a quem não pediu material de campanha** — ver
   * `AVISOS_QUE_IMPEDEM_ENVIO.enderecoSemMaterial`.
   *
   * `contexto.pedeMaterial` chega do painel (o sinal da rodada). **Sem o contexto, não confere
   * nada**: `undefined` não é "ela não pediu" — é "ninguém mediu", e barrar por isso pararia o
   * rascunho pedido a mão, onde não há sinais.
   */
  if (contexto?.pedeMaterial === false && ehPedidoDeEndereco(texto)) {
    avisos.push(AVISOS_QUE_SO_AVISAM.enderecoSemMaterial);
  }

  /**
   * **A desculpa que ninguém pediu** — ver `AVISOS_QUE_IMPEDEM_ENVIO.desculpaInexistente`.
   *
   * Condicionada como o `pediuReenvio`: quando ela SE desculpa, dizer que não precisava é o texto
   * certo, e está escrito no padrão dele. `undefined` não confere nada — fora da rodada não há
   * conversa medida, e barrar ali pararia o rascunho pedido à mão.
   */
  if (contexto?.elaSeDesculpou === false && DIZ_QUE_NAO_PRECISA_DESCULPAR.test(texto)) {
    avisos.push(AVISOS_QUE_IMPEDEM_ENVIO.desculpaInexistente);
  }

  /**
   * **A frase que fala de transcrição é RETIRADA** — ver `semFalarDeTranscricao`, print do Jose
   * Carlos (12/09/2026). Vocabulário da nossa máquina não vai para o eleitor, e não havia o que
   * julgar: a correção é mecânica, como a saudação e o "gabinete".
   */
  const semTranscricao = semFalarDeTranscricao(texto);
  if (semTranscricao) {
    texto = semTranscricao;
    avisos.push('a IA falou de "transcrição" do áudio — tirei a frase; para ela, nós ouvimos');
  } else if (/transcri/i.test(texto)) {
    avisos.push('a IA falou de "transcrição" do áudio — troque por "ouvi seu áudio" antes de mandar');
  }

  /**
   * **O voluntariado que ninguém pediu** — ver `AVISOS_QUE_IMPEDEM_ENVIO.trabalhoInexistente`.
   * Condicionada como a desculpa: quem falou em trabalhar ou em ganhar tem que ouvir que aqui é só
   * voluntário, que é a regra dele de 09/09. `undefined` não confere nada.
   */
  if (contexto?.elaFalouDeTrabalho === false && FALA_DE_REMUNERACAO.test(texto)) {
    avisos.push(AVISOS_QUE_IMPEDEM_ENVIO.trabalhoInexistente);
  }
  /**
   * **Cargo ou número trocado na chapa** — ver `conferirChapa`.
   *
   * Vai em DUAS linhas de propósito: a constante é o que `rascunhoPodeSairSozinho` compara por
   * identidade (barrar depende da igualdade exata), e a segunda diz **qual** troca é, que é o que
   * ele precisa para conferir sem reler a colinha inteira.
   *
   * Sem chapa (dossiê não empacotado, tabela renomeada) não confere nada: inventar a resposta seria
   * pior que não ter a trava.
   */
  if (contexto?.chapa?.length) {
    const trocado = conferirChapa(texto, contexto.chapa);
    if (trocado) {
      avisos.push(AVISOS_QUE_IMPEDEM_ENVIO.chapaTrocada);
      avisos.push(`na chapa: ${trocado}`);
    }
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
/**
 * **EMOJI CORTADO AO MEIO DERRUBA A CHAMADA INTEIRA** — print dele (22/09/2026), com os DOIS modelos
 * recusando o mesmo pedido: o gpt-5.6-luna com *"Invalid body: failed to parse JSON value"* e o
 * claude-haiku-4-5 com *"no low surrogate in string: line 1 column 38311"*.
 *
 * Emoji ocupa DOIS caracteres em JavaScript (um par substituto). Todo corte por tamanho — o texto das
 * respostas prontas em 500, o nome do anúncio em 60, o atendimento anterior em 600 — podia cair no meio
 * do par e deixar meia letra na string: JSON que nenhuma das duas casas aceita. E a base dele é cheia
 * de emoji.
 *
 * `cortar` recua um caractere quando a faca cai no meio do par. **A segunda camada é
 * `semSurrogateSolto`**, aplicada no envio: corte novo que alguém escrever amanhã não volta a derrubar
 * a chamada.
 */
export function cortar(texto, limite) {
  const t = String(texto || '');
  if (t.length <= limite) return t;
  const c = t.charCodeAt(limite - 1);
  // Terminou num substituto ALTO: o par ficaria partido, então corta um antes.
  const fim = c >= 0xd800 && c <= 0xdbff ? limite - 1 : limite;
  return t.slice(0, fim);
}

/**
 * **Meio par de substitutos não é texto, e é o que a API recusa.** Tira o que sobrou de um emoji
 * partido — por corte nosso, ou por já ter chegado assim da plataforma.
 */
export function semSurrogateSolto(texto) {
  const t = String(texto == null ? '' : texto);
  let saida = '';
  for (let i = 0; i < t.length; i += 1) {
    const c = t.charCodeAt(i);
    const alto = c >= 0xd800 && c <= 0xdbff;
    const baixo = c >= 0xdc00 && c <= 0xdfff;
    if (alto) {
      const prox = t.charCodeAt(i + 1);
      if (prox >= 0xdc00 && prox <= 0xdfff) {
        saida += t[i] + t[i + 1];
        i += 1;
      }
      continue; // alto sem o par: some
    }
    if (baixo) continue; // baixo sem o alto antes: some
    saida += t[i];
  }
  return saida;
}

function umaLinha(texto, limite = 400) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  return t.length > limite ? `${cortar(t, limite)}…` : t;
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

  /**
   * **Cada opção é revisada por conta própria** — as travas (a chapa trocada, a promessa, a
   * repetição) valem por TEXTO, e uma opção limpa não faz a outra ficar limpa. Sem isto, escolher a
   * segunda mandaria um texto que ninguém conferiu.
   *
   * **A forma antiga continua aceita**, e é de propósito: um modelo que devolva `{texto, confianca}`
   * sem o array ainda produz rascunho. Trocar esquema é o momento em que o de fora pode devolver o
   * de ontem, e cair com "a IA não devolveu rascunho" esconderia isso.
   */
  const uma = (o) => {
    const revisao = revisarRascunho(o?.texto, agora, contexto);
    const precisaDeRevisao = o?.precisaDeRevisao !== false;
    const avisos = [...revisao.avisos];
    if (precisaDeRevisao) avisos.push('a própria IA pediu revisão humana');
    return {
      texto: revisao.texto,
      confianca: Number.isFinite(o?.confianca) ? Math.min(1, Math.max(0, o.confianca)) : 0,
      motivo: String(o?.motivo || '').trim().slice(0, 300),
      avisos,
      precisaDeRevisao,
    };
  };

  const brutas = Array.isArray(d.opcoes) && d.opcoes.length ? d.opcoes : [d];
  /**
   * **Opção vazia não vira rascunho**: o modelo pode devolver o array com um texto em branco, e pôr
   * string vazia no campo de mensagem é pior que dizer que a IA não escreveu nada.
   */
  const vistos = new Set();
  const opcoes = brutas
    .map(uma)
    .filter((o) => {
      const chave = o.texto.replace(/\s+/g, ' ').trim().toLowerCase();
      if (!chave || vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    })
    .slice(0, 1);

  if (!opcoes.length) return vazio;

  // `texto`, `avisos` e companhia continuam sendo os da PRIMEIRA: quem só sabia ler um rascunho
  // (o cartão da aba Respostas, o log, as travas de envio) continua funcionando sem mudar nada.
  return { ...opcoes[0], opcoes };
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

  /**
   * OpenAI — preços lidos na página oficial em 07/09/2026, e é a mesma tabela com que a
   * comparação foi entregue a ele naquele dia.
   *
   * **Escrever no cache é de graça** (`cacheEscrita: 0`), ao contrário da Anthropic, que cobra
   * 1,25×. É o que faz a coluna FRIA — o caso comum numa rodada espaçada — favorecer mais a
   * OpenAI do que a quente.
   */
  'gpt-5': { entrada: 1.25, saida: 10, cacheEscrita: 0 },
  'gpt-5-mini': { entrada: 0.25, saida: 2, cacheEscrita: 0 },
  'gpt-5-nano': { entrada: 0.05, saida: 0.4, cacheEscrita: 0 },
  // Lido na página oficial em 18/09/2026: a geração nova, mais barata que o mini e, no índice da
  // Artificial Analysis, acima do gpt-5 (38 contra 23). Pedido dele, para o rascunho.
  'gpt-5.6-luna': { entrada: 0.2, saida: 1.2, cacheEscrita: 0 },
  // Página do modelo no OpenRouter, 18/09/2026. Índice 32 na Artificial Analysis (gpt-5: 23).
  'qwen/qwen3.7-plus': { entrada: 0.32, saida: 1.28, cacheEscrita: 0 },
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

  // Os fatores de cache são POR MODELO, com o da Anthropic como padrão: na OpenAI escrever no
  // cache não custa nada, e cobrar 1,25× por isso inflaria o teto sem nenhum erro aparecer.
  const fEscrita = p.cacheEscrita === undefined ? FATOR_CACHE_ESCRITA : p.cacheEscrita;
  const fLeitura = p.cacheLeitura === undefined ? FATOR_CACHE_LEITURA : p.cacheLeitura;

  const M = 1e6;
  const entrada = (Number(uso.entrada) || 0) * p.entrada;
  const escrito = (Number(uso.cacheEscrito) || 0) * p.entrada * fEscrita;
  const lido = (Number(uso.cacheLido) || 0) * p.entrada * fLeitura;
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
