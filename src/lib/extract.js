/**
 * extract.js — parser determinístico da resposta do contato. Zero IA, zero custo.
 *
 * Ele NÃO decide nada: devolve palpites com a origem (o trecho da mensagem que gerou o
 * valor) para o painel pré-preencher e você confirmar em um clique.
 *
 * A precisão vem principalmente do formato da pergunta: o template "pedir-dados" pede
 * "Nome completo / Cidade / Função", e o template de tema pede um número. Resposta
 * estruturada é o que torna a regra confiável — e é o que vai permitir automatizar depois.
 */

import * as cities from './cities.js';
import * as store from './store.js';

/** Palavra-chave → nome da opção real de "Tema de Interesse". */
const TEMA_KEYWORDS = [
  [/\bimpress[oa]s?\b|\bpanfleto|\badesivo|\bmaterial\b/i, 'Aceitou receber material impresso'],
  [/\bmuito engajad|\bquero ajudar\b|\bajudar bastante\b|\bvoluntari|\bmilitar em favor/i, 'Apoiador Muito engajado'],
  [/\bapoiador\b|\bapoio\b|\bsou apoiador/i, 'Apoiador Engajado'],
  [/\bde longe\b|\bacompanh(o|ar) de longe\b|\bsó acompanho\b/i, 'Apoiador não engajado'],
  [/\bresolvi\b|\bresolvido\b|\bresolveu\b|\bdeu certo\b/i, 'Resolvemos problema'],
  [/\bnão resolv|\bnao resolv|\bcontinua o problema\b/i, 'Não resolvemos o problema'],
];

/**
 * @param {string[]} texts mensagens recebidas do contato, da mais antiga para a mais nova
 * @param {object} opts
 * @param {object} [opts.temaField] campo "Tema de Interesse" do schema (para virar id de opção)
 * @returns {Promise<object>} palpites por campo
 */
export async function extract(texts, { temaField, respostaAoPedido = false } = {}) {
  const dicts = await store.get('dicts');
  const list = (texts || []).filter(Boolean);
  const joined = list.join('\n');

  const structured = await findStructured(list, isCityAlone);
  const guesses = {};

  /**
   * **Você acabou de perguntar, então o que veio é a resposta.**
   *
   * Pedido dele (31/08): *"se eu perguntei qual sua cidade e ela respondeu (maria cachoeirinha),
   * terá que identificar esse tipo de resposta"*. A pessoa não escreve "moro em" quando está
   * respondendo a uma pergunta — ela escreve o nome e a cidade, sem separador nenhum.
   *
   * É o contexto mais forte que existe aqui, e é NOSSO: quem chama sabe que a última mensagem
   * enviada foi o pedido de dados. Por isso dispensa pista e dispensa limite de tamanho.
   *
   * Fica FORA do `else` porque a seção do Nome também usa: é dela que sai o "maria" de
   * "maria cachoeirinha".
   */
  const naRespostaBruta = !structured && respostaAoPedido ? await cities.matchCity(joined) : null;

  /** O que sobra da resposta depois de tirar o município — deveria ser o nome, e só ele. */
  const sobraDaResposta = naRespostaBruta
    ? joined
        .replace(new RegExp(escapeRe(naRespostaBruta.matched || ''), 'i'), ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';

  /**
   * A resposta só conta se o que sobrou for **nome ou nada**.
   *
   * Você pediu "Nome / Cidade". Se veio um município e o resto não é nome de gente, aquilo não
   * é uma resposta — é outra coisa que por acaso cita um município. O caso real: quem responde
   * o formulário com o slogan do anúncio, *"Vamos juntos mudar o Rio Grande"*, que traria a
   * cidade Rio Grande e o "nome" Vamos Juntos Mudar O.
   */
  const naResposta = naRespostaBruta && (!sobraDaResposta || plausivelNome(sobraDaResposta)) ? naRespostaBruta : null;

  // --- Cidade -------------------------------------------------------------
  if (structured) {
    guesses.cidade = {
      value: structured.cidade,
      confidence: 'exata',
      source: structured.cidadeInformada,
      // A pessoa respondeu o formulário: esta cidade veio DELA, não de um trecho solto da
      // conversa. É o único caso em que o painel troca uma cidade que já estava no CRM.
      informada: true,
    };
  } else {
    /**
     * Mensagem que é **só o nome de um município** também é a pessoa informando a cidade.
     *
     * Caso real: o contato mandou uma única mensagem, `PORTO ALEGRE`. O cadastro dele estava
     * com "Santiago" — dado velho e errado —, e a regra "nunca sobrescrever o CRM" mantinha o
     * errado, porque só resposta com separador ("Nome / Cidade") contava como informada. Só que
     * uma mensagem inteira com o nome da cidade é a pessoa dizendo a cidade dela de forma **mais**
     * clara, não menos.
     *
     * As travas são as mesmas do resto: casamento exato e o nome COMPLETO do município. Prefixo
     * não vale — "Vitória" sozinho pode ser nome de gente, e trocar a cidade de um eleitor por
     * causa disso é pior do que deixar o campo como está.
     */
    /**
     * Sem resposta ao formulário, a cidade precisa de CONTEXTO — não basta o nome aparecer.
     *
     * Pedido dele (31/08): *"a cidade deve sair de um contexto, resposta a minha pergunta, ou a
     * pessoa falar (eu moro em (cidade), eu sou de (cidade))"*. O caso da print: a mensagem do
     * anúncio dizia *"Vamos juntos mudar o Rio Grande"* — o estado — e "Rio Grande" é município.
     *
     * Sobram então os três caminhos que são a pessoa dizendo onde mora: a resposta estruturada
     * (acima), a mensagem que é só o nome da cidade, e a menção precedida de pista ("moro em",
     * "sou de", "aqui em"…).
     */
    const soCidade = await cidadeSozinha(list);

    const hit = soCidade || naResposta || (await cities.matchCityComContexto(joined));
    if (hit) {
      guesses.cidade = {
        value: hit.city,
        confidence: hit.confidence,
        source: hit.matched,
        informada: !!soCidade,
      };
    }
  }

  if (!guesses.cidade) {
    // Nenhum município reconhecido. Se a pessoa respondeu algo curto na posição da cidade,
    // mostramos como não reconhecido com sugestões — melhor pedir confirmação que ignorar.
    const naPosicao = cityPositionGuess(list);
    // Vocabulário da campanha nunca é oferecido como cidade, nem como palpite: "Zucco" virava
    // popup em toda mensagem de anúncio, porque os nomes vêm separados por vírgula.
    if (naPosicao && !(await cities.naoPodeSerCidade(naPosicao))) {
      guesses.cidade = {
        value: naPosicao,
        confidence: 'nao-reconhecida',
        source: naPosicao,
        suggestions: await cities.suggest(naPosicao, 3),
      };
    }
  }

  // --- Nome ---------------------------------------------------------------
  //
  // A limpeza de siglas roda de novo aqui, agora com o dicionário de partidos: `findStructured`
  // só conhece a lista fixa, e partido novo entra pela Config sem passar por código.
  const nomeMatch = /\bmeu nome (?:é|e)\s+([\p{L}][\p{L}\s'.-]{2,60})/iu.exec(joined);
  /**
   * Resposta ao pedido sem separador: o que sobra depois de tirar a cidade é o nome.
   *
   * "maria cachoeirinha" é o formato real da resposta — sem barra, sem vírgula. Tirar o trecho
   * que casou com o município deixa "maria", e `plausivelNome` decide se aquilo é nome de gente.
   */
  const nomeDaResposta = naResposta && plausivelNome(sobraDaResposta) ? sobraDaResposta : '';

  const nomeCru = structured?.nome || nomeDaResposta || (nomeMatch ? nomeMatch[1].trim() : '');
  const nomeLimpo = limparSiglas(nomeCru, dicts.partido);
  if (nomeLimpo) {
    guesses.nome = {
      value: titleCase(nomeLimpo),
      confidence: 'aproximada',
      // A origem é o trecho que gerou o valor, e são três caminhos possíveis agora. Sem isto,
      // nome vindo da resposta estourava em `nomeMatch[0]` — `nomeMatch` é null nesse caso.
      source: structured?.nome || nomeDaResposta || (nomeMatch ? nomeMatch[0] : nomeCru),
    };
  }

  // --- Função -------------------------------------------------------------
  const funcaoHay = structured?.funcao || joined;
  const funcao = matchDict(funcaoHay, dicts.funcao) || matchDict(joined, dicts.funcao);
  if (funcao) {
    guesses.funcao = {
      value: titleCase(funcao.term),
      confidence: structured?.funcao ? 'exata' : 'aproximada',
      source: funcao.snippet,
    };
  } else if (structured?.funcao) {
    guesses.funcao = { value: titleCase(structured.funcao), confidence: 'nao-reconhecida', source: structured.funcao };
  }

  // --- Partido ------------------------------------------------------------
  const partido = matchPartido(joined, dicts.partido);
  if (partido) {
    guesses.partido = { value: partido.term, confidence: 'aproximada', source: partido.snippet };
  }

  // --- Tema de Interesse --------------------------------------------------
  const temaNames = await matchTema(list, joined);
  if (temaNames.length && temaField) {
    const ids = temaNames
      .map((name) => temaField.options.find((o) => o.name === name)?.id)
      .filter(Boolean);
    if (ids.length) {
      guesses.tema = {
        value: ids,
        labels: temaNames,
        confidence: 'aproximada',
        source: temaNames.join(', '),
      };
    }
  }

  return guesses;
}

/**
 * Aberturas e verbos que descartam um pedaço como candidato a nome de pessoa.
 *
 * O "sim"/"não" entrou quando a pergunta de interesse passou a pedir os dados junto: a resposta
 * vem como "Sim / Maria Silva / Palmares do Sul", e sem isto o **Sim** vira o nome do eleitor
 * sempre que ele escrever a cidade antes do nome.
 */
const NAO_E_NOME =
  /\b(oi|ol[aá]|bom dia|boa tarde|boa noite|obrigad|quero|queria|sou|moro|resido|aceito|gostaria|pode|tenho|preciso|meu|minha|aqui|somos|sim|n[aã]o|claro|isso|ok|beleza|positivo|afirmativo|vamos|juntos|mudar|apoio|apoiar|escolho|voto|vote|luta|firme|lado)\b/i;

/**
 * Siglas que vêm coladas no nome e nunca são nome de gente.
 *
 * Duas entradas reais: "Jeane do PL" gravava o partido dentro do Nome, e "srn" (abreviação
 * digitada na posição do nome) virava o nome do eleitor — o agradecimento saía "Obrigado pela
 * atenção, Srn!". Partido tem campo próprio; aqui ele só atrapalha.
 */
const SIGLAS_FIXAS = new Set([
  'pl', 'pp', 'mdb', 'psdb', 'pt', 'pdt', 'psd', 'pv', 'psol', 'psb', 'prd', 'dc', 'prtb',
  'pcdob', 'rs', 'br', 'cac', 'mst', 'ong', 'cnpj', 'cpf',
]);

/** Partículas de nome composto, que sobram penduradas quando a sigla sai ("Jeane do ~~PL~~"). */
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/**
 * Nome de gente em português sempre tem vogal. É o que separa "srn", "jrn" e "kkk" de um nome
 * curto de verdade ("Ana", "Ivo") sem precisar de lista.
 */
function semVogal(texto) {
  return !/[aeiouáàâãéêíóôõúüy]/i.test(String(texto || ''));
}

function ehSigla(token, conhecidas) {
  const t = String(token || '').toLowerCase().replace(/[.'-]/g, '');
  if (!t) return true;
  if (conhecidas.has(t)) return true;
  // Curta e sem vogal: "PL", "srn", "MDB". Nome de gente com 5 letras sempre tem vogal.
  return t.length <= 5 && semVogal(t);
}

/**
 * Tira as siglas de um nome e devolve o que sobrou de nome de verdade.
 *
 * Devolve string vazia quando NADA sobra — é o que impede "srn" e "PL" de virarem o Nome do
 * eleitor no CRM. Quem chama trata vazio como "não achei nome", não como nome em branco.
 *
 * @param {string} nome
 * @param {string[]} [siglas] siglas extras (o dicionário de partidos, na prática)
 */
export function limparSiglas(nome, siglas = []) {
  const conhecidas = new Set([...SIGLAS_FIXAS, ...(siglas || []).map((s) => String(s).toLowerCase())]);
  const tokens = String(nome || '').trim().split(/\s+/).filter(Boolean);
  const limpos = tokens.filter((t) => !ehSigla(t, conhecidas));

  // "Jeane do PL" vira "Jeane do": a partícula pendurada sai junto.
  while (limpos.length && PARTICULAS.has(limpos[limpos.length - 1].toLowerCase())) limpos.pop();
  while (limpos.length && PARTICULAS.has(limpos[0].toLowerCase())) limpos.shift();

  const saida = limpos.join(' ').trim();
  return semVogal(saida) ? '' : saida;
}

/**
 * Resposta ao template "Nome / Cidade / Função".
 *
 * Na prática o contato responde do jeito dele: com barra, com vírgula, em linhas separadas, e
 * às vezes só "Nome, Cidade" (foi o que aconteceu no atendimento real que motivou isto).
 * Aceitar vírgula sem mais nenhum critério pegaria frase solta como "boa tarde, sou de
 * Cachoeira do Sul" e viraria nome="Boa Tarde".
 *
 * O critério que separa um do outro: um dos pedaços tem que ser SÓ o nome de um município do
 * RS. Isso indica que a pessoa está respondendo o formulário, e não conversando.
 *
 * @param {string[]} texts mensagens recebidas
 * @param {function} isCity (texto) => nome oficial do município, ou null
 */
export async function findStructured(texts, isCity) {
  for (const text of [...texts].reverse()) {
    for (const separador of [/\n/, /\//, /[;|]/, /,/]) {
      const partes = text.split(separador).map((p) => p.trim()).filter(Boolean);
      if (partes.length < 2 || partes.length > 4) continue;
      if (partes.some((p) => p.length > 60)) continue;

      // Qual pedaço é exatamente uma cidade?
      let idx = -1;
      let cidade = null;
      for (let i = 0; i < partes.length; i++) {
        const achou = await isCity(partes[i]);
        if (achou) {
          idx = i;
          cidade = achou;
          break;
        }
      }
      if (idx < 0) continue;

      const anterior = idx > 0 ? partes[idx - 1] : null;
      const posterior = idx + 1 < partes.length ? partes[idx + 1] : null;

      return {
        nome: plausivelNome(anterior) ? limparSiglas(anterior) : null,
        cidade,
        cidadeInformada: partes[idx],
        funcao: posterior || null,
        raw: text,
      };
    }
  }
  return null;
}

/**
 * A mensagem mais recente que é, sozinha, o nome completo de um município.
 *
 * Da mais nova para a mais antiga: se a pessoa mandou "Canoas" e depois corrigiu para "Porto
 * Alegre", vale a correção.
 */
async function cidadeSozinha(textos) {
  for (const texto of [...textos].reverse()) {
    const t = String(texto || '').trim();
    if (!t || t.length > 40) continue;

    const hit = await cities.matchCity(t);
    // Nome COMPLETO, não prefixo: "Vitória" pode ser gente, "Vitória das Missões" não.
    if (hit?.confidence === 'exata' && cities.normalize(t) === cities.normalize(hit.city)) {
      return { city: hit.city, confidence: 'exata', matched: t };
    }
  }
  return null;
}

/**
 * O pedaço é SÓ o nome de um município? É o que distingue "Thiago, porto alegre" (resposta
 * ao formulário) de "boa tarde, sou de porto alegre e quero ajudar" (conversa).
 * @returns {Promise<string|null>} nome oficial do município
 */
async function isCityAlone(parte) {
  const hit = await cities.matchCity(parte);
  if (!hit) return null;
  const p = cities.normalize(parte);
  if (p === cities.normalize(hit.city)) return hit.city;
  // Erro de digitação: aceita quando o pedaço INTEIRO foi o que casou, não um trecho dele.
  if (hit.confidence === 'aproximada' && cities.normalize(hit.matched || '') === p) return hit.city;
  return null;
}

/**
 * Último recurso para a cidade: a pessoa respondeu no formato pedido, mas escreveu algo que
 * não é município. Devolve o que ela pôs na posição da cidade, para o painel sugerir as
 * parecidas em vez de deixar o campo vazio.
 */
function cityPositionGuess(texts) {
  for (const text of [...texts].reverse()) {
    for (const separador of [/\n/, /\//, /[;|]/, /,/]) {
      const partes = text.split(separador).map((p) => p.trim()).filter(Boolean);
      if (partes.length < 2 || partes.length > 4) continue;
      const candidato = partes[1];
      if (!candidato || candidato.length < 3 || candidato.length > 30) continue;
      if (NAO_E_NOME.test(candidato)) continue;
      if (!/^[\p{L}][\p{L}\s'.-]*$/u.test(candidato)) continue;
      return candidato;
    }
  }
  return null;
}

function plausivelNome(parte) {
  if (!parte) return false;
  const s = parte.trim();
  if (s.length < 3 || s.length > 40) return false;
  if (NAO_E_NOME.test(s)) return false;
  if (!/^[\p{L}][\p{L}\s'.-]*$/u.test(s)) return false; // só letras, espaço e pontuação de nome
  const palavras = s.split(/\s+/);
  if (palavras.length < 1 || palavras.length > 4) return false;
  // Só sigla ("PL", "srn") não é nome: se depois da limpeza não sobra nada, não era nome.
  return !!limparSiglas(s);
}

function matchDict(text, terms) {
  const norm = cities.normalize(text);
  let best = null;
  for (const term of terms || []) {
    const t = cities.normalize(term);
    if (!t) continue;
    const re = new RegExp(`(^|\\s)${escapeRe(t)}(\\s|$)`);
    if (re.test(norm) && (!best || t.length > cities.normalize(best.term).length)) {
      best = { term, snippet: term };
    }
  }
  return best;
}

/** Sigla de partido: exige token isolado, no texto original, para não pegar "PT" dentro de palavra. */
function matchPartido(text, siglas) {
  for (const sigla of siglas || []) {
    const re = new RegExp(`(^|[^\\p{L}])${escapeRe(sigla)}([^\\p{L}]|$)`, 'u');
    if (re.test(text)) return { term: sigla.toUpperCase(), snippet: sigla };
  }
  return null;
}

async function matchTema(texts, joined) {
  const numberMap = await store.get('temaByNumber');
  const found = new Set();

  // Resposta que é só um número (ou "opção 2", "2)") → mapa numérico do template.
  for (const text of texts) {
    const m = /^\s*(?:op(?:ç|c)(?:ão|ao)\s*)?([1-9])\s*[).\-]?\s*$/i.exec(text);
    if (m && numberMap[m[1]]) found.add(numberMap[m[1]]);
  }

  for (const [re, name] of TEMA_KEYWORDS) {
    if (re.test(joined)) found.add(name);
  }

  return [...found];
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function titleCase(s) {
  const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return String(s)
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .trim();
}

/**
 * Rebaixa todo palpite para "espera clique", e diz de onde veio.
 *
 * **Existe para uma coisa só: o que sai de TRANSCRIÇÃO de áudio.** Nesta base muita gente
 * responde falando, e o painel dizia "Cidade: (vazia)" para quem tinha dito a cidade em voz.
 * Ler a transcrição resolve — e cria um risco novo, porque ninguém DIGITOU aquilo: é fala
 * passada por reconhecimento automático, com os erros disso.
 *
 * As duas marcas são o que tornam isso seguro, e cada uma fecha um caminho diferente:
 *
 *  - `confidence: 'aproximada'` mantém o valor **fora da gravação automática** — só `crm` e
 *    `exata` são gravados sozinhos;
 *  - `informada: false` impede **substituir o que já está no CRM** — a regra de "a pessoa
 *    informou outra cidade" exige texto escrito, e áudio ouvido por máquina não é isso.
 *
 * A origem sai na tela dizendo que veio do áudio, para dar para conferir antes de aceitar.
 *
 * @param {object} guesses o que `extract` devolveu
 * @returns {object} os mesmos palpites, rebaixados
 */
export function rebaixarParaPalpite(guesses) {
  const saida = {};
  for (const [chave, guess] of Object.entries(guesses || {})) {
    if (!guess || typeof guess !== 'object' || !guess.value) {
      saida[chave] = guess;
      continue;
    }
    saida[chave] = {
      ...guess,
      confidence: 'aproximada',
      informada: false,
      source: `${guess.source || guess.value} — ouvido no áudio`,
    };
  }
  return saida;
}
