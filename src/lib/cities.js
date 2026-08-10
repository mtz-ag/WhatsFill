/**
 * cities.js — cidade → link do grupo, e o casamento tolerante do que o contato digitou.
 *
 * O campo Cidade no CRM é texto livre (verificado no schema), então quem garante
 * consistência é este arquivo: normaliza, corrige abreviação comum e aceita erro de
 * digitação por distância de Levenshtein.
 *
 * A lista de municípios vem do IBGE na primeira execução e fica em cache. Sem lista
 * (offline), o casamento cai para as cidades que já existem na sua tabela de links.
 */

import * as store from './store.js';

const IBGE_RS = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/RS/municipios';

/** Abreviações que aparecem toda hora no WhatsApp. */
const ALIASES = [
  [/\bsto\.?\b/g, 'santo'],
  [/\bsta\.?\b/g, 'santa'],
  [/\bs\.\s*/g, 'sao '],
  [/\bpto\.?\b/g, 'porto'],
  [/\bp\.\s*alegre\b/g, 'porto alegre'],
  [/\bpoa\b/g, 'porto alegre'],
  [/\bbge\b/g, 'bage'],
  [/\bcxs\b/g, 'caxias do sul'],
  [/\bsm\b/g, 'santa maria'],
];

export function normalize(value) {
  let s = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tira acento (marcas combinantes)
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [re, to] of ALIASES) s = s.replace(re, to);
  return s.replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

let municipiosCache = null;

export async function loadMunicipios() {
  if (municipiosCache) return municipiosCache;

  const cached = await store.get('municipios');
  if (cached && cached.length) {
    municipiosCache = cached;
    return municipiosCache;
  }

  try {
    const res = await fetch(IBGE_RS);
    if (!res.ok) throw new Error('IBGE ' + res.status);
    const data = await res.json();
    const names = data.map((m) => m.nome).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (names.length) {
      await store.set('municipios', names);
      municipiosCache = names;
      return names;
    }
  } catch (err) {
    console.warn('[WhatsFill] não consegui buscar os municípios no IBGE:', err.message);
  }

  // Fallback: as cidades que você já cadastrou na tabela de links.
  const links = await store.get('cityLinks');
  municipiosCache = Object.values(links).map((v) => v.label).filter(Boolean);
  return municipiosCache;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

function tolerance(name) {
  if (name.length <= 6) return 1;
  if (name.length <= 12) return 2;
  return 3;
}

/**
 * Procura um município dentro de um texto qualquer.
 * @returns {{city:string, confidence:'exata'|'aproximada', matched:string}|null}
 */
/**
 * O nome do ESTADO contém o nome de um município: "Rio Grande do Sul" tem "Rio Grande" dentro.
 *
 * Como o passo 1 procura o nome do município em qualquer lugar do texto, quem escrevia "sou do
 * Rio Grande do Sul" era gravado como morador de Rio Grande — cidade errada, e o COREDE errado
 * junto, porque a etiqueta de região sai da cidade. Nenhum município do RS se chama "Rio Grande
 * do Sul", então apagar a frase inteira antes de casar não custa nenhum acerto: quem quis dizer
 * a cidade escreve "Rio Grande", que continua casando.
 */
const NOME_DO_ESTADO = /\brio grande do sul\b/g;

/**
 * Expressões que contêm nome de município mas não são endereço de ninguém.
 *
 * A campanha inteira fala em "Capitão Martim" — e **Capitão é município do RS**. Toda mensagem
 * de aceite do anúncio ("aceito receber conteúdos do Capitão Martim e do Zucco") casava com a
 * cidade Capitão, com confiança `exata`, que é a que grava **sozinha, sem clique**. Era cidade
 * errada e COREDE errado em cima de quem só repetiu o nome do candidato.
 *
 * Apagar a expressão inteira antes de casar resolve sem tirar o município da lista: quem mora
 * lá escreve "Capitão" sem "Martim" atrás.
 */
const EXPRESSOES_QUE_NAO_SAO_CIDADE = [
  /\bcapitao martim\b/g,
  /\bcap martim\b/g,
  /\bcapitao martins\b/g,
];

/**
 * Encurtamentos que nenhuma regra genérica alcança, porque não são prefixo do nome oficial.
 *
 * Ficam aqui, e **não** em `ALIASES`: `normalize()` roda também sobre o nome do município, e
 * "Santana do Livramento" viraria "santana do santana do livramento" — o casamento exato
 * quebrava e a cidade caía em "Santana da Boa Vista". Aqui só o texto do contato passa.
 */
const ENCURTAMENTOS = [[/\blivramento\b/g, 'santana do livramento']];

/** Texto pronto para casar: sem o nome do estado e sem as expressões da campanha. */
function prepararTexto(text) {
  let norm = normalize(text).replace(NOME_DO_ESTADO, ' ');
  for (const re of EXPRESSOES_QUE_NAO_SAO_CIDADE) norm = norm.replace(re, ' ');
  for (const [re, to] of ENCURTAMENTOS) norm = norm.replace(re, to);
  return norm.replace(/\s+/g, ' ').trim();
}

/**
 * Municípios que a extensão ignora, por decisão do Thiago (aba Config).
 *
 * Nasceu de "Capitão", que colide com a patente do candidato em toda mensagem. Fica
 * configurável em vez de fixo no código porque a próxima campanha muda o nome — e porque
 * apagar um município da lista é decisão dele, não minha.
 */
async function municipiosValidos() {
  const municipios = await loadMunicipios();
  const ignoradas = await store.get('cidadesIgnoradas');
  if (!ignoradas?.length) return municipios;
  const fora = new Set(ignoradas.map((c) => normalize(c)));
  return municipios.filter((c) => !fora.has(normalize(c)));
}

export async function matchCity(text) {
  const municipios = await municipiosValidos();
  if (!municipios.length) return null;

  const norm = prepararTexto(text);
  if (!norm) return null;

  // 1) Nome inteiro aparece no texto. Preferimos o mais longo ("Santo Ângelo" antes de "Ângelo").
  let best = null;
  for (const city of municipios) {
    const n = normalize(city);
    if (n.length >= 4 && norm.includes(n)) {
      if (!best || n.length > normalize(best).length) best = city;
    }
  }
  if (best) return { city: best, confidence: 'exata', matched: best };

  const words = norm.split(' ').filter(Boolean);
  const lista = municipios.map((city) => {
    const n = normalize(city);
    return { city, n, partes: n.split(' ') };
  });

  // 2) Erro de digitação no nome INTEIRO: "Caxias do Sull", "Erechin".
  let melhor = null;
  for (const m of lista) {
    if (m.n.length < 4) continue;
    // Município de nome curto exige grafia exata (o passo 1 já pega essa). Com tolerância, uma
    // palavra comum de quatro letras virava cidade: "o cara" casava com **Caraá** a distância 1,
    // e o painel oferecia etiqueta de região para quem só elogiou o candidato.
    const tol = m.n.length <= 5 ? 0 : tolerance(m.n);
    for (let size = 1; size <= 4; size++) {
      for (let i = 0; i + size <= words.length; i++) {
        const gram = words.slice(i, i + size).join(' ');
        if (Math.abs(gram.length - m.n.length) > tol) continue;
        const d = levenshtein(gram, m.n);
        if (d <= tol && (!melhor || d < melhor.d)) melhor = { city: m.city, d, gram };
      }
    }
  }
  if (melhor) {
    return { city: melhor.city, confidence: melhor.d === 0 ? 'exata' : 'aproximada', matched: melhor.gram };
  }

  // 3) Sufixo omitido: a pessoa escreve "São Lourenço" e o município é "São Lourenço do Sul".
  //    Não é erro de digitação — a distância até o nome completo é grande demais — então
  //    comparamos com o PREFIXO do município que tem o mesmo número de palavras.
  return prefixoDeMunicipio(words, lista);
}

/**
 * Casa um pedaço do texto com o começo do nome de um município.
 *
 * Três travas, cada uma tirada de um jeito real de errar:
 *
 * - **Uma palavra só é aceita, mas nunca como valor exato.** Era o mínimo de duas, e por isso
 *   "Palmares" (Palmares do Sul) e "Sentinela" (Sentinela do Sul) não eram reconhecidos — o
 *   jeito mais comum de encurtar. Quem protege contra "Carlos" virar "Carlos Barbosa" não é a
 *   contagem de palavras, é a trava da preposição logo abaixo: "Barbosa" não é preposição, então
 *   "Carlos" continua não casando. As duas travas que sobram para o pedaço de uma palavra são
 *   o tamanho mínimo de 6 letras (tira "Passo", "Porto", "Santa") e a confiança **aproximada**,
 *   que espera clique e nunca é gravada sozinha.
 * - **O texto não pode estar continuando o nome.** Em "Vila Nova do Nada", o pedaço
 *   "vila nova" é prefixo de "Vila Nova do Sul", mas a palavra seguinte no texto ("do") é
 *   também a próxima do município: a pessoa está escrevendo um nome mais longo, que não é esse.
 *   Já em "sou de são lourenço e quero ajudar", a seguinte é "e", que não continua o nome.
 * - **O sufixo omitido tem que começar com preposição.** É assim que se encurta nome de cidade
 *   em português: "São Lourenço ~~do Sul~~", "Santa Cruz ~~do Sul~~". Ninguém encurta "Vila Nova
 *   do Sul" para "Vila Nova do" — e era justamente assim que "Vila Nova do Nada", um lugar
 *   inexistente, virava "Vila Nova do Sul".
 * - **Empate não vira palpite.** "Porto" prefixa cinco municípios; nesse caso não devolvemos
 *   nada e o painel oferece as parecidas para você escolher.
 */
const PREPOSICOES = new Set(['do', 'da', 'de', 'dos', 'das']);

function prefixoDeMunicipio(words, lista) {
  let melhor = null;

  for (let i = 0; i < words.length; i++) {
    for (let size = Math.min(4, words.length - i); size >= 1; size--) {
      const gram = words.slice(i, i + size).join(' ');
      if (gram.length < 6) continue;
      const seguinte = words[i + size] || null;

      const candidatos = [];
      for (const m of lista) {
        if (m.partes.length <= size) continue; // precisa sobrar sufixo para ter sido omitido
        if (!PREPOSICOES.has(m.partes[size])) continue; // sufixo que ninguém omite
        const prefixo = m.partes.slice(0, size).join(' ');
        const tol = tolerance(prefixo);
        if (Math.abs(gram.length - prefixo.length) > tol) continue;
        const d = levenshtein(gram, prefixo);
        if (d > tol) continue;
        if (seguinte && seguinte === m.partes[size]) continue; // o texto continua o nome
        candidatos.push({ city: m.city, d });
      }
      if (!candidatos.length) continue;

      const menor = Math.min(...candidatos.map((c) => c.d));
      const empatados = [...new Set(candidatos.filter((c) => c.d === menor).map((c) => c.city))];
      if (empatados.length > 1) continue; // ambíguo: recusa em vez de chutar

      if (!melhor || menor < melhor.d) melhor = { city: empatados[0], d: menor, gram };
      break; // nesta posição já valeu o pedaço mais longo
    }
  }

  if (!melhor) return null;

  // Prefixo de DUAS palavras escrito certo identifica o município sem margem ("Santa Cruz" só
  // pode ser Santa Cruz do Sul). De uma palavra só, nunca: "Palmares" é quase certamente
  // Palmares do Sul, mas "quase" não grava sozinho em contato real — vira palpite e espera o
  // seu clique.
  const umaPalavra = melhor.gram.split(' ').length === 1;
  return {
    city: melhor.city,
    confidence: melhor.d === 0 && !umaPalavra ? 'exata' : 'aproximada',
    matched: melhor.gram,
  };
}

/**
 * Cadastro no formato "Cidade - Nome" ("Canoas - Marines"), que é como parte da base foi
 * digitada. Sem separar, o primeiro nome vira a cidade e a saudação sai "Boa noite, Canoas!".
 *
 * Só separa quando a esquerda é **exatamente** um município do RS. Duas travas, porque errar
 * aqui troca o nome de um eleitor:
 *  - o casamento tem que ser `exata` (palpite aproximado não separa nada);
 *  - o município casado tem que cobrir a esquerda inteira, senão "Grupo Canoas - Marines"
 *    também seria separado.
 *
 * @returns {Promise<{cidade:string, nome:string}|null>}
 */
export async function splitCidadeNome(texto) {
  const m = /^(.{3,40}?)\s*[-–—|/]\s*(.{2,60})$/.exec(String(texto || '').trim());
  if (!m) return null;

  const esquerda = m[1].trim();
  const direita = m[2].trim();
  // Do lado do nome tem que sobrar nome, não telefone nem pontuação.
  if (!esquerda || !/\p{L}{2}/u.test(direita)) return null;

  const casou = await matchCity(esquerda);
  if (!casou || casou.confidence !== 'exata') return null;

  const alvo = normalize(esquerda);
  if (normalize(casou.city) !== alvo && normalize(casou.matched) !== alvo) return null;

  return { cidade: casou.city, nome: direita };
}

/** As N cidades mais parecidas, para o painel oferecer como botão quando erra. */
export async function suggest(text, n = 3) {
  const municipios = await loadMunicipios();
  const norm = normalize(text);
  if (!norm) return [];
  return municipios
    .map((city) => ({ city, d: levenshtein(norm, normalize(city)) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.city);
}

/**
 * Link do grupo para a cidade. Devolve o motivo quando não encontra, para o painel
 * poder explicar por que o envio está bloqueado em vez de mandar {{link_grupo}} cru.
 */
export async function linkFor(city) {
  const links = await store.get('cityLinks');
  const fallback = await store.get('defaultGroupLink');
  const key = normalize(city);

  if (!key) return { link: null, reason: 'Cidade não definida.' };
  if (links[key]?.link) return { link: links[key].link, source: 'cidade' };
  if (fallback) return { link: fallback, source: 'padrão' };
  return {
    link: null,
    reason: `Sem grupo cadastrado para "${city}" e sem link padrão. Cadastre na aba Config.`,
  };
}

/** Editor da tabela em texto: uma linha por cidade, "Cidade = link". */
export function parseCityLinksText(text) {
  const out = {};
  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const label = line.slice(0, idx).trim();
    const link = line.slice(idx + 1).trim();
    if (!label || !link) continue;
    out[normalize(label)] = { label, link };
  }
  return out;
}

export function formatCityLinks(map) {
  return Object.values(map || {})
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
    .map((v) => `${v.label} = ${v.link}`)
    .join('\n');
}
