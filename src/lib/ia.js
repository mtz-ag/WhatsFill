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
export function montarSistemaRascunho({ templates = [], regras = '' } = {}) {
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
    '- inventar dado, número, agenda, lei ou posição que não esteja na conversa;',
    '- usar {{variáveis}} ou qualquer marcador: escreva o texto final.',
    '',
    'Responda SÓ com o texto do rascunho. Sem aspas, sem título, sem explicação.',
    '',
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
 * `max_tokens` maior que o da decisão porque aqui a saída é texto — mas ainda curto: resposta de
 * WhatsApp não tem mil tokens, e teto baixo é o que impede uma transcrição de virar redação.
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
    max_tokens: 1024,
    system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: contato }],
    output_config: { format: { type: 'json_schema', schema: esquemaDoRascunho() } },
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
