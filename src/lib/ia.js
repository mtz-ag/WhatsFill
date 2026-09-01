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
 * O limiar para o rascunho sair **sozinho**, sem ele ler antes.
 *
 * Alto e separado do `CONFIANCA_MINIMA` de propósito. Os dois números respondem perguntas
 * diferentes e têm consequências diferentes: errar a escolha entre respostas prontas manda um
 * texto que ELE escreveu para a pessoa errada — chato, recuperável. Errar aqui manda uma frase
 * **inventada** em nome de um mandato, e mensagem de WhatsApp não volta.
 *
 * Decidido pelo Thiago em 20/08/2026, ciente do risco, depois de eu apontá-lo. O desenho anterior
 * era "a IA nunca envia o que ela escreveu"; a autoavaliação da IA sozinha é garantia fraca, então
 * ela é a MENOS importante das travas em `podeEnviarSozinho` — as duras estão lá embaixo.
 */
export const CONFIANCA_RASCUNHO_AUTO = 0.9;

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
    '4. Cuidado com "ajuda": quem diz "quero ajudar", "posso ajudar", "conte comigo" é APOIADOR se',
    '   oferecendo, e é o público principal. Não é pedido de ajuda.',
    '5. Se o contato só respondeu o formulário (nome e cidade), ou só mandou uma saudação, ou',
    '   agradeceu, escolha a resposta pronta que corresponde — não escale por ser simples.',
    '6. Se duas respostas servirem, escolha a mais específica. Se nenhuma servir, escale.',
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
    gabinete ? `Quem é quem neste mandato (informação do gabinete, não pesquise nem invente):\n${gabinete}\n` : '',
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
    'Você redige um RASCUNHO de resposta para o WhatsApp de um mandato parlamentar no Rio Grande',
    'do Sul. Uma pessoa da equipe vai ler, editar e só então enviar. Você nunca envia nada.',
    '',
    'Como escrever:',
    '',
    '1. Em português do Brasil, no tom das mensagens de exemplo mais abaixo — elas foram escritas',
    '   pela própria equipe e são a referência de voz. Frases curtas, diretas, calorosas sem ser',
    '   piegas. Nada de "espero que esteja bem", "venho por meio desta" ou floreio de atendimento.',
    '2. NÃO chame a pessoa pelo nome. É regra do mandato: o cadastro erra o nome com frequência',
    '   alta demais, e errar o nome de alguém é pior do que não usar nenhum.',
    '3. Responda o que foi perguntado. Se o texto é longo, mostre que leu — cite o ponto concreto,',
    '   não faça resumo genérico.',
    '4. Tamanho de WhatsApp: no máximo uns 4 parágrafos curtos. Se não couber, priorize.',
    '',
    'O que você NÃO pode escrever, em nenhuma hipótese:',
    '',
    '- prometer dinheiro, cesta, remédio, passagem, emprego, vaga ou qualquer bem ou benefício.',
    '  A lei eleitoral (9.504/97) proíbe, e vale o ano inteiro. Se a pessoa pediu isso, escreva um',
    '  rascunho que encaminhe para a assistência social do município (CRAS, Secretaria de',
    '  Assistência Social) e ofereça cobrar o poder público — nunca prometa entregar;',
    '- prometer resolver, garantir resultado, ou marcar compromisso em nome do parlamentar;',
    '- inventar dado, número, agenda, lei ou posição. Você pode usar o que está na conversa e o',
    '  que está no bloco "Quem é quem" acima — e NADA além. Não sabe? Escreva sem o dado, ou diga',
    '  que vai confirmar;',
    '- usar {{variáveis}} ou qualquer marcador: escreva o texto final.',
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
    gabinete ? `Quem é quem neste mandato (informação do gabinete, não pesquise nem invente):\n${gabinete}\n` : '',
    regras ? `Instruções adicionais da equipe:\n${regras}\n` : '',
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

/** O bloco do contato para o rascunho: a conversa com folga, porque é dela que ele precisa. */
export function montarContatoRascunho({ mensagens = [], campos = {} } = {}) {
  const conversa = (mensagens || [])
    .map((m, i) => `[${i + 1}] ${umaLinha(m, 4000)}`)
    .join('\n\n');

  const cidade = campos?.Cidade ? `A pessoa é de ${campos.Cidade}.` : '';
  return [
    'Mensagens recebidas desta pessoa, da mais antiga para a mais recente:',
    '',
    conversa || '(nada)',
    '',
    cidade,
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
export function revisarRascunho(bruto) {
  const texto = String(bruto || '').trim();
  const avisos = [];
  if (!texto) return { texto: '', avisos: ['a IA não devolveu texto'] };

  // Marcador esquecido: iria como está para o eleitor e apareceria literalmente na conversa.
  if (/\{\{|\[nome\]|\[cidade\]|xxx+/i.test(texto)) {
    avisos.push('sobrou marcador no texto — troque antes de mandar');
  }

  /**
   * Promessa de bem ou benefício. A lista é grosseira de propósito: ela não julga a frase, só
   * levanta a mão para ele ler. Falso positivo aqui custa uma olhada; falso negativo custa um
   * mandato prometendo o que a lei proíbe.
   */
  if (/\b(vou|vamos|posso|podemos|consigo|conseguimos)\b[^.!?]{0,40}\b(mandar|enviar|dar|arrumar|conseguir|providenciar)\b/i.test(texto)) {
    avisos.push('parece prometer entregar alguma coisa — confira antes de mandar');
  }
  if (/\b(cesta|rem[ée]dio|dinheiro|pix|emprego|vaga|passagem)\b/i.test(texto)) {
    avisos.push('cita bem ou benefício (cesta, remédio, dinheiro, emprego) — a lei eleitoral proíbe prometer');
  }
  if (texto.length > 1500) avisos.push('ficou longo para WhatsApp — vale cortar');

  return { texto, avisos };
}

/** Achata para uma linha e corta: conversa longa não pode dominar o prompt nem o custo. */
function umaLinha(texto, limite = 400) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  return t.length > limite ? `${t.slice(0, limite)}…` : t;
}

/**
 * Lê o que a IA devolveu no rascunho e junta com a revisão heurística.
 *
 * O esquema garante JSON válido; quem decide se dá para usar é isto e `podeEnviarSozinho`.
 * `avisos` sai de `revisarRascunho` (texto) mais `precisaDeRevisao` (a própria IA levantando a
 * mão) — os dois no mesmo lugar, porque quem chama trata os dois igual: qualquer aviso, humano lê.
 *
 * @returns {{texto:string, confianca:number, motivo:string, avisos:string[], precisaDeRevisao:boolean}}
 */
export function validarRascunho(bruto) {
  const vazio = { texto: '', confianca: 0, motivo: '', avisos: ['a IA não devolveu rascunho'], precisaDeRevisao: true };

  let d = bruto;
  if (typeof d === 'string') {
    try {
      d = JSON.parse(d);
    } catch (_) {
      // Formato ilegível: trata como texto puro, que é o que a versão anterior devolvia. Assim
      // um modelo que ignore o esquema ainda produz rascunho — só nunca automático, porque sem
      // `confianca` ele não passa do limiar.
      const cru = revisarRascunho(bruto);
      return { texto: cru.texto, confianca: 0, motivo: '', avisos: cru.avisos, precisaDeRevisao: true };
    }
  }
  if (!d || typeof d !== 'object') return vazio;

  const revisao = revisarRascunho(d.texto);
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

/**
 * O rascunho pode sair **sem ninguém ler antes**?
 *
 * Esta é a função mais perigosa do projeto: é o único ponto em que texto **gerado por IA** chega a
 * um eleitor em nome de um mandato sem revisão humana. Mensagem de WhatsApp não volta.
 *
 * Por isso a resposta padrão é **não**, e cada `true` exige uma razão. As travas, da mais forte
 * para a mais fraca:
 *
 * 1. **Desligado por padrão.** Sem `ligado` explícito na Config, nada sai sozinho — e é assim que
 *    a extensão se comporta em qualquer instalação nova.
 * 2. **Qualquer aviso bloqueia.** `revisarRascunho` já levantava a mão para marcador esquecido,
 *    promessa de entrega, menção a bem/benefício (Lei 9.504/97) e texto longo. Ali eram avisos
 *    ao lado do texto; aqui viram **veto**. É a trava mais valiosa, porque não depende de a IA
 *    ser honesta sobre si mesma.
 * 3. **A IA pedindo revisão bloqueia** (entra em `avisos` por `validarRascunho`).
 * 4. **Confiança acima do limiar.** A mais fraca das quatro — autoavaliação de modelo não é
 *    medida confiável — e por isso a última, nunca a única.
 *
 * Pura e testada de propósito: é a linha entre "a IA sugere" e "a IA fala pelo parlamentar".
 *
 * @returns {{pode:boolean, motivo:string}}
 */
export function podeEnviarSozinho({ rascunho, ligado = false, limiar = CONFIANCA_RASCUNHO_AUTO } = {}) {
  if (!ligado) return { pode: false, motivo: 'envio automático de rascunho está desligado' };
  if (!rascunho) return { pode: false, motivo: 'não há rascunho' };

  const texto = String(rascunho.texto || '').trim();
  if (!texto) return { pode: false, motivo: 'o rascunho veio vazio' };

  const avisos = rascunho.avisos || [];
  if (avisos.length) {
    return { pode: false, motivo: `a revisão levantou: ${avisos.join(' · ')}` };
  }

  const confianca = Number(rascunho.confianca) || 0;
  if (confianca < limiar) {
    return {
      pode: false,
      motivo: `confiança ${(confianca * 100).toFixed(0)}% abaixo do mínimo de ${(limiar * 100).toFixed(0)}%`,
    };
  }

  return { pode: true, motivo: `confiança ${(confianca * 100).toFixed(0)}%, sem avisos` };
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
