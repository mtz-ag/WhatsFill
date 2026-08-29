/**
 * triagem.js — quem a rodada NÃO pode tratar sozinha.
 *
 * Pedido de ajuda financeira, pedido de emprego, e qualquer coisa que peça uma resposta pensada:
 * *"o pedido de ajuda e dinheiro poderia ser pulado e deixar tudo por último pra eu ver
 * pessoalmente"*. A rodada põe de lado, marca com uma etiqueta e segue — quem responde é ele,
 * depois, filtrando a fila por essa etiqueta.
 *
 * **Por que isto é determinístico e não IA:** aqui errar tem lado caro e lado barato. Marcar à
 * toa custa um contato na lista de revisão dele; deixar passar custa a rodada mandando um pedido
 * de dados para quem acabou de contar que está sem comida, ou — pior — um mandato respondendo
 * automaticamente a pedido de dinheiro, que é o caso com risco jurídico (Lei 9.504/97) e o
 * único que a `pedido-ajuda` existe para tratar com cuidado. Regex é auditável, roda de graça e
 * não muda de opinião entre um contato e outro.
 *
 * **A armadilha central, e a razão de este arquivo ter teste:** "ajuda" é a mesma palavra dos
 * dois lados da campanha. *"Quero ajudar"* é apoiador se oferecendo — é o público principal, e
 * `extract.js` já o classifica como "Apoiador Muito engajado". *"Preciso de ajuda"* é o oposto.
 * Um padrão ingênuo com `/ajuda/` põe metade da base na fila de revisão dele e o trabalho para.
 * Por isso a regra tem duas metades: o que PEDE casa, o que OFERECE desarma.
 *
 * Puro e sem dependência: decide se uma mensagem de gente real recebe resposta automática.
 */

/**
 * O que OFERECE ajuda — desarma antes de qualquer outra coisa.
 *
 * Vem primeiro de propósito: "quero ajudar de qualquer forma, nem que seja com dinheiro" é
 * apoiador, não pedinte, e a palavra "dinheiro" está lá.
 */
const OFERECE = [
  /\b(quero|posso|gostaria de|vou|pretendo|adoraria)\s+(te\s+|lhe\s+|nos\s+|os?\s+)?ajudar\b/i,
  /\bajud(o|ar)\s+(bastante|muito|no que|quando|com o que|em que)\b/i,
  /\b(estou|to|tô)\s+(a\s+)?dispos(i[çc][ãa]o|to)\b/i,
  /\bconte\s+comigo\b/i,
  /\bquero\s+(ser\s+)?volunt[áa]ri/i,
  /\bcomo\s+(eu\s+)?posso\s+(ajudar|contribuir|colaborar)\b/i,
];

/**
 * O que PEDE. Cada linha traz o motivo que vai para a tela — ele precisa saber POR QUE aquele
 * contato saiu da rodada, senão vira "alguns a rodada trata e outros não".
 */
const PEDE = [
  // Dinheiro dito com todas as letras.
  [/\b(pix|dep[óo]sito|transfer[êe]ncia|empr[ée]stimo)\b/i, 'falou em dinheiro'],
  [/\br\$\s*\d|\b\d+\s*(reais|conto)\b/i, 'citou um valor'],
  [/\b(preciso|precisando|necessito|queria|gostaria)\b[^.!?]{0,40}\bdinheiro\b/i, 'pediu dinheiro'],
  [/\bme\s+(ajuda|ajude|ajudar)\b[^.!?]{0,40}\b(dinheiro|grana|valor|pix)\b/i, 'pediu dinheiro'],

  // Ajuda material. "cesta básica", "remédio", "aluguel" não têm outro sentido aqui.
  [/\bcesta\s*b[áa]sica\b|\bcesta\b/i, 'pediu cesta básica'],
  [/\brem[ée]dio|medicament/i, 'falou em remédio'],
  [/\b(aluguel|conta de luz|conta de [áa]gua|energia cortada|despejo)\b/i, 'pediu ajuda com contas'],
  [/\b(passagem|transporte)\b[^.!?]{0,30}\b(consult|trat|hospital|m[ée]dic)/i, 'pediu passagem'],
  [/\b(fome|passando fome|sem comida|sem ter o que comer)\b/i, 'disse estar passando necessidade'],
  // "não tenho o que comer em casa" — a forma que apareceu no teste e que as duas de cima não
  // pegavam. Negação + comer é o que distingue de "adoro comer churrasco".
  [/\bn[ãa]o\s+(tenho|temos|tem|tinha)\b[^.!?]{0,20}\bcomer\b/i, 'disse estar passando necessidade'],

  // Pedido de ajuda genérico — só quando é PEDIDO, nunca oferta (ver OFERECE).
  [/\b(preciso|precisava|precisando|necessito)\s+(muito\s+)?de\s+(uma\s+)?ajuda\b/i, 'pediu ajuda'],
  [/\b(pode|poderia|consegue|conseguiria)\s+(me\s+)?ajudar\b/i, 'pediu ajuda'],
  [/\bme\s+ajud(a|e)\b/i, 'pediu ajuda'],
  [/\best(ou|ava|á|a)\s+(muito\s+)?(necessitad|passando (por )?(uma )?dificuldade|numa situa[çc][ãa]o dif[íi]cil)/i,
    'relatou dificuldade'],

  // Emprego: mesma família, mesmo risco jurídico, mesma resposta cuidadosa.
  [/\b(vaga|emprego|trabalho)\b[^.!?]{0,40}\b(preciso|procuro|procurando|arrumar|conseguir|indica)/i,
    'pediu emprego'],
  [/\b(estou|to|tô)\s+desempregad/i, 'disse estar desempregado'],
  [/\b(curr[íi]culo|curriculum)\b/i, 'falou em currículo'],
  /**
   * O verbo pode vir ANTES do substantivo, com palavras no meio: *"preciso arrumar um
   * trabalho"*. A versão presa a `preciso de um trabalho` não pegava — e essa é a forma que as
   * pessoas usam.
   *
   * `quero`/`queria` ficam de fora de propósito: "quero trabalhar pela campanha" é apoiador, e
   * a distância entre isso e "quero um trabalho" é fina demais para arriscar tirar apoiador da
   * rodada. Aqui vale a assimetria — deixar passar um pedido de emprego custa uma resposta
   * pronta a mais; barrar apoiador custa o trabalho parado.
   */
  [/\b(preciso|precisava|procuro|procurando|queria arrumar)\b[^.!?]{0,25}\b(emprego|trabalho|vaga|servi[çc]o)\b/i,
    'pediu emprego'],
];

/**
 * Esta conversa precisa de você em pessoa?
 *
 * Olha as mensagens DO CONTATO (as nossas não interessam: a resposta pronta de negar ajuda
 * financeira fala em dinheiro, cesta e remédio o tempo todo — casar com ela poria na fila de
 * revisão justamente quem já foi respondido).
 *
 * @param {string[]} mensagens mensagens recebidas do contato
 * @param {string[]} [extras]  padrões adicionais, da aba Config
 * @returns {{motivo:string, trecho:string}|null}
 */
export function precisaDeVoce(mensagens, extras = []) {
  const regras = [
    ...PEDE,
    ...(extras || [])
      .map((p) => String(p || '').trim())
      .filter(Boolean)
      .map((p) => [montarRegex(p), 'casou com um padrão seu'])
      .filter(([re]) => re),
  ];

  for (const texto of mensagens || []) {
    const t = String(texto || '');
    if (!t.trim()) continue;
    // Oferta desarma a mensagem INTEIRA: "quero ajudar, nem que seja com dinheiro" é apoiador.
    if (OFERECE.some((re) => re.test(t))) continue;

    for (const [re, motivo] of regras) {
      const achado = re.exec(t);
      if (achado) return { motivo, trecho: recorte(t, achado.index) };
    }
  }
  return null;
}

/** Padrão da Config vira regex; inválido é ignorado em vez de derrubar a rodada. */
function montarRegex(padrao) {
  try {
    return new RegExp(padrao, 'i');
  } catch (_) {
    return null;
  }
}

/** O pedaço da mensagem que casou, para ele conferir sem abrir a conversa. */
function recorte(texto, indice, largura = 90) {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  if (limpo.length <= largura) return limpo;
  const inicio = Math.max(0, indice - 25);
  return (inicio ? '…' : '') + limpo.slice(inicio, inicio + largura).trim() + '…';
}
