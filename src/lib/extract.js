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
export async function extract(texts, { temaField } = {}) {
  const dicts = await store.get('dicts');
  const list = (texts || []).filter(Boolean);
  const joined = list.join('\n');

  const structured = await findStructured(list, isCityAlone);
  const guesses = {};

  // --- Cidade -------------------------------------------------------------
  if (structured) {
    guesses.cidade = {
      value: structured.cidade,
      confidence: 'exata',
      source: structured.cidadeInformada,
    };
  } else {
    const hit = await cities.matchCity(joined);
    if (hit) guesses.cidade = { value: hit.city, confidence: hit.confidence, source: hit.matched };
  }

  if (!guesses.cidade) {
    // Nenhum município reconhecido. Se a pessoa respondeu algo curto na posição da cidade,
    // mostramos como não reconhecido com sugestões — melhor pedir confirmação que ignorar.
    const naPosicao = cityPositionGuess(list);
    if (naPosicao) {
      guesses.cidade = {
        value: naPosicao,
        confidence: 'nao-reconhecida',
        source: naPosicao,
        suggestions: await cities.suggest(naPosicao, 3),
      };
    }
  }

  // --- Nome ---------------------------------------------------------------
  const nomeMatch = /\bmeu nome (?:é|e)\s+([\p{L}][\p{L}\s'.-]{2,60})/iu.exec(joined);
  if (structured?.nome) {
    guesses.nome = { value: titleCase(structured.nome), confidence: 'aproximada', source: structured.nome };
  } else if (nomeMatch) {
    guesses.nome = { value: titleCase(nomeMatch[1].trim()), confidence: 'aproximada', source: nomeMatch[0] };
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

/** Aberturas e verbos que descartam um pedaço como candidato a nome de pessoa. */
const NAO_E_NOME =
  /\b(oi|ol[aá]|bom dia|boa tarde|boa noite|obrigad|quero|queria|sou|moro|resido|aceito|gostaria|pode|tenho|preciso|meu|minha|aqui|somos)\b/i;

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
        nome: plausivelNome(anterior) ? anterior : null,
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
  return palavras.length >= 1 && palavras.length <= 4;
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
