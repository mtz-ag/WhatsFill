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

/** O modelo padrão. Trocável na Config — quem decide custo é ele, não este arquivo. */
export const MODELO_PADRAO = 'claude-opus-5';

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
export function montarSistema({ templates = [], regras = '' } = {}) {
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
    '4. Cuidado com "ajuda": quem diz "quero ajudar", "posso ajudar", "conte comigo" é APOIADOR se',
    '   oferecendo, e é o público principal. Não é pedido de ajuda.',
    '5. Se o contato só respondeu o formulário (nome e cidade), ou só mandou uma saudação, ou',
    '   agradeceu, escolha a resposta pronta que corresponde — não escale por ser simples.',
    '6. Se duas respostas servirem, escolha a mais específica. Se nenhuma servir, escale.',
    '',
    regras ? `Instruções adicionais do Thiago:\n${regras}\n` : '',
    'Respostas prontas disponíveis:',
    '',
    catalogo,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

/** O bloco que descreve ESTE contato. É a parte que muda, e por isso fica fora do cache. */
export function montarContato({ mensagens = [], campos = {}, etiquetas = [] } = {}) {
  const conversa = mensagens.length
    ? mensagens.map((m, i) => `${i + 1}. ${umaLinha(m, 600)}`).join('\n')
    : '(o contato ainda não escreveu nada)';

  const cadastro = Object.entries(campos)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');

  return [
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
 * `max_tokens` baixo de propósito: a saída é um JSON de decisão, não texto. Efeito colateral
 * bom — nenhuma resposta longa pode ser gerada por acidente.
 */
export function montarRequisicao({ sistema, contato, ids, modelo = MODELO_PADRAO }) {
  return {
    model: modelo,
    max_tokens: 512,
    system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: contato }],
    output_config: { format: { type: 'json_schema', schema: esquemaDaDecisao(ids) } },
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

/** Achata para uma linha e corta: conversa longa não pode dominar o prompt nem o custo. */
function umaLinha(texto, limite = 400) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  return t.length > limite ? `${t.slice(0, limite)}…` : t;
}
