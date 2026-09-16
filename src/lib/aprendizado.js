/**
 * **O QUE A IA APRENDE COM AS ESCOLHAS DELE.**
 *
 * Pedido dele (15/09/2026): *"o ideal seria a IA ir aprendendo sozinha qual tipo de resposta eu
 * quero; no momento parece que isso não está acontecendo. Quando a IA for fazer rascunho, faça ela
 * criar 3 diferentes e vou escolher qual eu quero, e ela deve ir aprendendo com minhas escolhas"*.
 *
 * ---
 *
 * **Não existe treinar modelo aqui, e fingir que existe seria o pior desenho possível.** O que
 * existe é uma chamada de API por rascunho, com um prompt. Então "aprender" só pode significar uma
 * coisa honesta: **medir o que separa o texto que ele escolheu dos que ele descartou, e escrever
 * isso no prompt** — em português, como as regras que ele mesmo dita.
 *
 * **Por que a comparação é com os DESCARTADOS, e não com o escolhido sozinho.** Se os três
 * rascunhos abrirem com saudação e ele escolher um, a escolha não diz nada sobre saudação: ele não
 * teve alternativa. O sinal só existe onde os textos DIFERIAM. Cada dimensão só conta quando o
 * escolhido difere de pelo menos um descartado — é o que impede a lista de encher de lições que
 * ninguém ensinou.
 *
 * **O que se mede é a FORMA, nunca o conteúdo** — e isto é regra de segurança, não de gosto. Guardar
 * o texto escolhido e devolvê-lo ao prompt como exemplo faria a cidade de um eleitor, ou o caso
 * dele, vazar para a mensagem de outro: é a **proximidade lexical**, o defeito que este projeto já
 * pagou cinco vezes (o "representante", a "placa", o *"É o deputado?"*, o *"te ajudar na votação"*,
 * a pergunta retórica da Eloiza). Aqui não há texto de eleitor guardado em lugar nenhum: o que fica
 * são contadores de coisas como *abriu com saudação* e *fez pergunta*.
 *
 * **As lições são poucas, e é de propósito.** Uma dimensão só vira linha de prompt com
 * `MINIMO_DE_ESCOLHAS` observações INFORMATIVAS e `MAIORIA` de um lado. Lição tirada de duas
 * escolhas é ruído promovido a regra — e regra errada aqui muda o que sai para eleitor real.
 *
 * Puro e testado: `tests/aprendizado.test.mjs`.
 */

/** Quantas escolhas informativas uma dimensão precisa antes de virar regra no prompt. */
export const MINIMO_DE_ESCOLHAS = 5;

/** Qual proporção decide o lado. 0,7 = 7 em 10; abaixo disso é empate, e empate não ensina nada. */
export const MAIORIA = 0.7;

const semAcentos = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * **As dimensões que se mede.**
 *
 * O critério de entrada é duro: tem de ser **mecânico** (nada de julgar tom), **visível no texto** e
 * **acionável no prompt** — uma frase que o modelo consegue cumprir. *"Mais caloroso"* não entra:
 * não dá para medir nem para cumprir.
 *
 * Cada uma diz as duas frases que vão para o prompt, porque a lição pode cair para qualquer lado —
 * e escrever só metade faria a preferência oposta virar silêncio em vez de regra.
 */
export const DIMENSOES = [
  {
    id: 'saudacao',
    rotulo: 'abrir com saudação',
    de: (t) => /^\s*(bom\s+dia|boa\s+tarde|boa\s+noite|ola|oi)\b/.test(semAcentos(t)),
    com: 'ABRA com a saudação do horário.',
    sem: 'NÃO abra com saudação ("bom dia", "olá") — vá direto ao assunto.',
  },
  {
    id: 'pergunta',
    rotulo: 'terminar fazendo uma pergunta',
    de: (t) => /\?/.test(String(t || '')),
    com: 'FECHE com uma pergunta que convide a resposta dela.',
    sem: 'NÃO faça pergunta: responda e encerre. Pergunta abre um atendimento que não temos braço para dar.',
  },
  {
    id: 'emoji',
    rotulo: 'usar emoji',
    de: (t) => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(String(t || '')),
    com: 'Pode usar um emoji, no máximo um.',
    sem: 'NÃO use emoji.',
  },
  {
    id: 'agradece',
    rotulo: 'agradecer',
    de: (t) => /(^|[^\p{L}])(obrigad|agradec|grato|grata)/u.test(semAcentos(t)),
    com: 'AGRADEÇA a mensagem dela, em poucas palavras.',
    sem: 'NÃO abra agradecendo — ele acha que isso enche a mensagem.',
  },
  {
    id: 'senhor',
    rotulo: 'tratar por "o senhor"/"a senhora"',
    // `a?o senhor` pega "o senhor" e "ao senhor" — a preposição colada é peça separada, a lição
    // que este projeto já aprendeu em "trabalhar NA campanha" e em "gostaria DE saber".
    de: (t) => /(^|[^\p{L}])(a?o\s+senhor|a\s+senhora|lhe\s|vossa\s)/u.test(semAcentos(t)),
    com: 'Trate por "o senhor" / "a senhora".',
    sem: 'Trate por "você" — ele prefere assim.',
  },
  {
    id: 'paragrafos',
    rotulo: 'quebrar em parágrafos',
    de: (t) => /\n\s*\n/.test(String(t || '')),
    com: 'Separe em parágrafos curtos, com linha em branco entre eles.',
    sem: 'Escreva em um bloco só, sem quebrar em parágrafos.',
  },
];

/** Quantas frases o texto tem — a medida de tamanho que ele usa quando fala de "mensagem simples". */
export function frasesDe(texto) {
  return String(texto || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((f) => f.trim())
    // **Pedaço sem letra nem número não é frase.** Um emoji solto depois do ponto final contaria
    // como mais uma, e é o número de frases que decide a lição do "escreva curto".
    .filter((f) => /[\p{L}\p{N}]/u.test(f)).length;
}

/** O retrato mecânico de um rascunho. Só formato — nenhuma palavra do texto sai daqui. */
export function medir(texto) {
  const retrato = { frases: frasesDe(texto), caracteres: String(texto || '').trim().length };
  for (const d of DIMENSOES) retrato[d.id] = d.de(texto);
  return retrato;
}

/** O estado zerado. `store.ia.aprendizado` nasce assim. */
export function vazio() {
  return { escolhas: 0, dimensoes: {}, tamanho: { curta: 0, longa: 0, meio: 0 }, primeira: { sim: 0, nao: 0 }, desde: null };
}

/**
 * **Quantas escolhas antes de a taxa de acerto querer dizer alguma coisa**, e a partir de que
 * proporção o treino já pagou o que tinha para pagar.
 *
 * Pedido dele (15/09/2026): *"deixe o antigo, que irá rodar sozinho já com o conhecimento, quando
 * estiver com taxa baixa de erro"*. **A taxa mede uma coisa só, e é preciso dizer qual:** de quantas
 * vezes o PRIMEIRO rascunho — o que a IA escreveria se você não estivesse treinando — foi o que ele
 * escolheu. Alta, o modo antigo manda o texto que ele escolheria de qualquer jeito.
 */
export const MINIMO_PARA_TAXA = 10;
export const TAXA_PARA_SOLTAR = 0.8;

/**
 * **De quantas vezes a primeira opção foi a escolhida.** É a "taxa de erro" dele, pelo avesso.
 *
 * @returns {{sim:number, total:number, proporcao:number}}
 */
export function taxaDePrimeira(estado) {
  const p = (estado && typeof estado === 'object' && estado.primeira) || {};
  const sim = Number(p.sim) || 0;
  const nao = Number(p.nao) || 0;
  const total = sim + nao;
  return { sim, total, proporcao: total ? sim / total : 0 };
}

/**
 * **Já dá para desligar o treino?** — `{pronta, taxa}`.
 *
 * Nunca desliga nada sozinho: quem decide é ele, e a tela só diz que o número chegou lá. Trocar o
 * modo por conta própria mudaria o que sai para eleitor sem ninguém escolher — a mesma razão pela
 * qual caixa nova não entra no quadro dele sozinha.
 */
export function prontaParaRodarSozinha(estado) {
  const taxa = taxaDePrimeira(estado);
  return { pronta: taxa.total >= MINIMO_PARA_TAXA && taxa.proporcao >= TAXA_PARA_SOLTAR, taxa };
}

const somar = (estado) => {
  const e = estado && typeof estado === 'object' ? estado : {};
  return {
    escolhas: Number.isFinite(e.escolhas) ? e.escolhas : 0,
    dimensoes: e.dimensoes && typeof e.dimensoes === 'object' ? { ...e.dimensoes } : {},
    tamanho: { curta: 0, longa: 0, meio: 0, ...(e.tamanho || {}) },
    primeira: { sim: 0, nao: 0, ...(e.primeira || {}) },
    desde: e.desde || null,
  };
};

/**
 * **Uma escolha dele vira números.**
 *
 * @param {object} estado o que já estava guardado (`store.ia.aprendizado`)
 * @param {{escolhido:string, descartados:string[], quando?:string}} escolha
 * @returns {object} o estado novo — **não muta o que entrou**, porque quem chama grava o resultado
 *   e gravar um objeto que já foi mexido esconde a diferença quando a gravação falha.
 */
export function registrarEscolha(estado, { escolhido, descartados = [], quando = null, indice = null } = {}) {
  const novo = somar(estado);
  const texto = String(escolhido || '').trim();
  const outros = (descartados || []).map((t) => String(t || '').trim()).filter(Boolean);
  if (!texto || !outros.length) return novo;

  novo.escolhas += 1;
  novo.desde = novo.desde || quando || new Date().toISOString().slice(0, 10);

  /**
   * **A PRIMEIRA opção é o que a IA mandaria sem treino nenhum** — então escolhê-la é a medida de
   * *"o modo antigo já acertaria este caso"*. É a taxa que ele pediu para decidir quando soltar a
   * IA sozinha.
   *
   * `indice` nulo não conta para lado nenhum: chamador que não sabe a posição não pode empurrar a
   * taxa para cima nem para baixo por omissão.
   */
  if (indice === 0) novo.primeira.sim += 1;
  else if (Number.isInteger(indice) && indice > 0) novo.primeira.nao += 1;

  const meu = medir(texto);
  const deles = outros.map(medir);

  for (const d of DIMENSOES) {
    // **Só conta onde havia diferença.** Três textos com saudação não ensinam nada sobre saudação.
    if (!deles.some((o) => o[d.id] !== meu[d.id])) continue;
    const atual = novo.dimensoes[d.id] || { com: 0, sem: 0 };
    if (meu[d.id]) atual.com += 1;
    else atual.sem += 1;
    novo.dimensoes[d.id] = atual;
  }

  /**
   * **O tamanho é comparado, não medido em absoluto.** "Ele gosta de 3 frases" seria falso: o
   * tamanho certo depende do caso. O que se aprende é a POSIÇÃO — entre as opções que ele teve, ele
   * pega a mais curta? Empate no número de frases não conta para lado nenhum.
   */
  const tamanhos = deles.map((o) => o.frases);
  const menor = Math.min(...tamanhos);
  const maior = Math.max(...tamanhos);
  if (menor !== maior || meu.frases !== menor) {
    if (meu.frases < menor) novo.tamanho.curta += 1;
    else if (meu.frases > maior) novo.tamanho.longa += 1;
    else novo.tamanho.meio += 1;
  }
  return novo;
}

/**
 * **O que já dá para afirmar** — uma lista de `{id, regra, quantas, proporcao}`, vazia enquanto não
 * houver evidência. É isto que vai para o prompt e para a tela da Config.
 */
export function licoes(estado) {
  const e = somar(estado);
  const fora = [];

  for (const d of DIMENSOES) {
    const c = e.dimensoes[d.id];
    if (!c) continue;
    const total = (c.com || 0) + (c.sem || 0);
    if (total < MINIMO_DE_ESCOLHAS) continue;
    const proporcao = Math.max(c.com || 0, c.sem || 0) / total;
    if (proporcao < MAIORIA) continue;
    fora.push({
      id: d.id,
      rotulo: d.rotulo,
      regra: (c.com || 0) >= (c.sem || 0) ? d.com : d.sem,
      quantas: Math.max(c.com || 0, c.sem || 0),
      total,
      proporcao,
    });
  }

  const t = e.tamanho || {};
  const totalT = (t.curta || 0) + (t.longa || 0) + (t.meio || 0);
  if (totalT >= MINIMO_DE_ESCOLHAS) {
    const curta = (t.curta || 0) / totalT;
    const longa = (t.longa || 0) / totalT;
    if (curta >= MAIORIA) {
      fora.push({
        id: 'tamanho',
        rotulo: 'preferir a resposta mais curta',
        regra: 'Escreva CURTO: entre duas formas de dizer a mesma coisa, ele escolhe sempre a mais curta.',
        quantas: t.curta,
        total: totalT,
        proporcao: curta,
      });
    } else if (longa >= MAIORIA) {
      fora.push({
        id: 'tamanho',
        rotulo: 'preferir a resposta mais desenvolvida',
        regra: 'Desenvolva a resposta: ele escolhe a mais completa das opções, não a mais seca.',
        quantas: t.longa,
        total: totalT,
        proporcao: longa,
      });
    }
  }
  return fora;
}

/**
 * **As lições como o bloco que entra no prompt** — string vazia quando não há nenhuma.
 *
 * **Vai no fim do bloco do CONTATO, colado no pedido**, e não no prompt de sistema. Duas razões: é a
 * lição do item 22 (07/09/2026) — *regra longe do ponto em que o modelo escreve não é cumprida* —, e
 * o sistema leva `cache_control`, então uma lição nova invalidaria o cache de todo mundo no dia em
 * que ele escolhesse um rascunho diferente.
 */
export function blocoParaOPrompt(estado) {
  const lista = licoes(estado);
  if (!lista.length) return '';
  return [
    'O QUE ELE ESCOLHEU NAS ÚLTIMAS VEZES (medido nas escolhas dele entre três rascunhos — siga):',
    ...lista.map((l) => `- ${l.regra}`),
  ].join('\n');
}

/**
 * **Abre a janela dos três rascunhos NESTA passada?** — `treinando` ligado E a rodada NÃO automática.
 *
 * Pura e testada porque já foi invertida duas vezes em dois dias: a v3.62 excluía a rodada automática;
 * a v3.63 a incluiu achando que era a causa do *"o modo de treino falhou"* (a causa era o erro 400 do
 * esquema); e a v3.66 voltou a excluir, porque com a janela aberta a rodada automática PARAVA de abrir
 * contatos — *"o modo treino interrompeu o fluxo de mandar modelo ao aparecer anúncio"* (16/09/2026).
 * Na automática ninguém está olhando para escolher, e a regra deste projeto é que pergunta dentro da
 * rodada precisa de um jeito de não abrir.
 */
export function abreJanelaDeTreino({ treinando = false, rodadaAutomatica = false } = {}) {
  return !!treinando && !rodadaAutomatica;
}
