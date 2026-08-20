/**
 * tags.js — etiquetas: quais aplicar e como.
 *
 * Duas famílias hoje, e a estrutura aceita mais sem mexer em código:
 *
 * 1. REGIÃO — a etiqueta é o COREDE da cidade do contato. O mapa município → COREDE vem da
 *    planilha oficial da Secretaria de Planejamento do RS (src/data/coredes-rs.json, 497
 *    municípios), não de chute.
 * 2. CONTEÚDO — depende do que o contato aceitou receber. Regras de texto editáveis:
 *    "zucco = Conteúdo Zucco", "fl[áa]vio = Conteúdo Flávio".
 *
 * O NOME da etiqueta nunca é inventado: ele é resolvido contra a lista real de etiquetas do
 * CRM (GET /core/v1/tag, onde o rótulo fica no campo `message`). Não resolveu? O painel diz e
 * oferece escolher da lista — e a escolha fica salva como apelido.
 */

import * as api from './api.js';
import * as store from './store.js';
import { normalize } from './cities.js';
import { buildRequest } from './contract.js';

const COREDES_PATH = 'src/data/coredes-rs.json';

let tagsCache = null;
let coredesCache = null;

// ---------------------------------------------------------------------------
// Carregamento
// ---------------------------------------------------------------------------

export async function loadTags({ force = false } = {}) {
  if (tagsCache && !force) return tagsCache;
  const raw = await api.getTags();
  const arr = Array.isArray(raw) ? raw : raw?.items || [];
  // As cores entram porque renomear (`api.updateTag`) exige mandá-las de volta: sem elas, o
  // conserto de um rótulo resetaria a cor da etiqueta como efeito colateral.
  tagsCache = arr
    .filter((t) => t.active !== false && t.message)
    .map((t) => ({
      id: t.id,
      label: String(t.message).trim(),
      bgColor: t.bgColor || undefined,
      textColor: t.textColor || undefined,
    }));
  return tagsCache;
}

let coredeLoader = async () => {
  const res = await fetch(chrome.runtime.getURL(COREDES_PATH));
  return res.json();
};

/** Ponto de injeção para teste fora do navegador. */
export function setCoredeLoader(fn) {
  coredeLoader = fn;
  coredesCache = null;
}

export async function loadCoredes() {
  if (coredesCache) return coredesCache;
  const data = await coredeLoader();
  coredesCache = {};
  for (const [municipio, corede] of Object.entries(data.municipios || {})) {
    coredesCache[normalize(municipio)] = corede;
  }
  return coredesCache;
}

/** COREDE de uma cidade, ou null se não for município do RS. */
export async function coredeFor(city) {
  if (!city) return null;
  const mapa = await loadCoredes();
  return mapa[normalize(city)] || null;
}

// ---------------------------------------------------------------------------
// Resolução de nome → etiqueta do CRM
// ---------------------------------------------------------------------------

/**
 * Acha a etiqueta real do CRM pelo nome. Casa sem acento e sem pontuação, o que já resolve
 * divergências como "Centro-Sul" (planilha) x "Centro Sul" (CRM). O resto vem da tabela de
 * apelidos, editável na aba Config.
 */
export async function resolveTag(name) {
  if (!name) return null;
  const [tags, aliases] = await Promise.all([loadTags(), store.get('tagAliases')]);
  const alvo = aliases[normalize(name)] || name;
  return tags.find((t) => normalize(t.label) === normalize(alvo)) || null;
}

/** Registra que um COREDE (ou qualquer nome) corresponde a uma etiqueta do CRM. */
export async function saveAlias(name, tagLabel) {
  const aliases = await store.get('tagAliases');
  aliases[normalize(name)] = tagLabel;
  await store.set('tagAliases', aliases);
}

// ---------------------------------------------------------------------------
// Sugestão
// ---------------------------------------------------------------------------

/**
 * "Sim" à pergunta de interesse, medido só na ÚLTIMA mensagem do contato.
 *
 * Olhar a conversa inteira acharia "sim" em qualquer lugar e aplicaria etiqueta a quem nunca
 * foi perguntado — por isso quem chama também exige que a pergunta tenha SAÍDO para o contato.
 *
 * **A decisão sai da CABEÇA da mensagem, não da mensagem inteira.** Desde que a pergunta passou
 * a pedir nome e cidade junto (10/08), a resposta esperada é "Sim / Maria Silva / Palmares do
 * Sul" — longa, e frequentemente com um "não" legítimo mais à frente ("não faço parte de nenhum
 * grupo político", que é resposta à outra pergunta do formulário). A regra anterior — limite de
 * seis palavras e negação em qualquer lugar — transformava esses dois casos em recusa.
 *
 * Puro e exportado para ter teste: é ele que decide gravar etiqueta em eleitor real.
 */
const AFIRMATIVAS =
  /^(s|sim+|claro|quero|aceito|pode|manda|mande|positivo|afirmativo|isso|ok|okay|blz|beleza|certeza|gostaria|bora|adoraria)\b/;

const NEGATIVAS = /\bnao\b|\bnunca\b|\bdispenso\b/;

/** As primeiras palavras — onde mora a resposta a uma pergunta fechada. */
const PALAVRAS_DA_CABECA = 4;

export function respostaAfirmativa(texts = []) {
  const ultima = [...texts].reverse().find((t) => String(t || '').trim());
  if (!ultima) return false;

  const norm = normalize(ultima).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!norm) return false;

  const cabeca = norm.split(' ').slice(0, PALAVRAS_DA_CABECA).join(' ');
  // "sim, mas não quero" continua sendo recusa: a negação está na própria resposta.
  if (NEGATIVAS.test(cabeca)) return false;
  return AFIRMATIVAS.test(cabeca);
}

/**
 * Etiquetas sugeridas para o contato.
 *
 * @param {object} ctx
 * @param {string} ctx.city    cidade já classificada
 * @param {string[]} ctx.texts mensagens recebidas do contato
 * @param {string} [ctx.extra] texto adicional para casar as regras (ex.: campanha do anúncio)
 * @param {object} [ctx.interesse] `{ perguntado:boolean, etiquetas:string[] }` — o aceite à
 *   pergunta de interesse no conteúdo. Só vira etiqueta quando a pergunta SAIU para este
 *   contato: sem isso, qualquer "sim" solto da conversa viraria aceite.
 * @returns {Promise<Array<{origem:string, nome:string, tag:object|null, motivo:string}>>}
 */
export async function suggest({ city, texts = [], extra = '', interesse = null }) {
  const out = [];

  const corede = await coredeFor(city);
  if (corede) {
    out.push({
      origem: 'região',
      nome: corede,
      tag: await resolveTag(corede),
      motivo: `${city} pertence ao COREDE ${corede}`,
    });
  } else if (city) {
    out.push({
      origem: 'região',
      nome: null,
      tag: null,
      motivo: `"${city}" não está na tabela oficial de municípios do RS — confira a grafia.`,
    });
  }

  const haystack = [...texts, extra].filter(Boolean).join('\n');
  for (const regra of await store.get('tagRules')) {
    if (!regra.padrao || !regra.etiqueta) continue;
    let re;
    try {
      re = new RegExp(regra.padrao, 'i');
    } catch (_) {
      continue; // regex inválida na configuração: ignora em vez de explodir
    }
    if (!re.test(haystack)) continue;
    out.push({
      origem: 'conteúdo',
      nome: regra.etiqueta,
      tag: await resolveTag(regra.etiqueta),
      motivo: `a mensagem casou com "${regra.padrao}"`,
    });
  }

  // Aceite à pergunta de interesse: a pessoa não descreveu conteúdo nenhum, só respondeu "sim",
  // então nenhuma regra de texto casaria. Quem autoriza a etiqueta é o par pergunta-enviada +
  // resposta afirmativa.
  if (interesse?.perguntado && respostaAfirmativa(texts)) {
    for (const nome of interesse.etiquetas || []) {
      if (!nome) continue;
      out.push({
        origem: 'conteúdo',
        nome,
        tag: await resolveTag(nome),
        motivo: 'respondeu que sim à pergunta de interesse no conteúdo',
      });
    }
  }

  // Uma etiqueta só, mesmo que duas regras apontem para ela.
  const vistas = new Set();
  return out.filter((s) => {
    const chave = `${s.origem}|${s.nome}`;
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}

/**
 * Etiquetas de conteúdo que o contato **já tem no CRM**, mesmo que nenhuma regra de texto case.
 *
 * Sem isto, a etiqueta que ele aplicou à mão era invisível para o painel: `suggest()` só olha o
 * que as regras acham nas mensagens. O sintoma foi "etiqueta de conteúdo do Flávio marcada e a
 * mensagem rápida não reconhece e trava o botão" — o botão de fechar com conteúdo exigia
 * exatamente um conteúdo identificado, e contava zero.
 *
 * Também acontece sem ninguém marcar nada: a regra casa contra a campanha do anúncio, o
 * contato é etiquetado na primeira passada, e na reabertura as mensagens dele sozinhas não
 * casam mais com nada.
 *
 * Só entram etiquetas **reconhecidas como conteúdo**: as que aparecem nas regras ou na tabela
 * "Modelo por conteúdo". Etiqueta de região e de fluxo continuam de fora.
 *
 * @param {object} contact contato do CRM (usa `tagsId`)
 * @param {object} [mapaModelos] tabela "Modelo por conteúdo" (chaves já achatadas)
 */
export async function conteudosJaAplicados(contact, mapaModelos = {}) {
  const ids = new Set(contact?.tagsId || []);
  if (!ids.size) return [];

  const [todas, regras] = await Promise.all([loadTags(), store.get('tagRules')]);
  const conhecidos = new Set(
    [
      ...(regras || []).map((r) => r.etiqueta),
      ...Object.keys(mapaModelos || {}),
    ]
      .filter(Boolean)
      .map((nome) => normalize(nome))
  );

  return todas
    .filter((t) => ids.has(t.id) && conhecidos.has(normalize(t.label)))
    .map((t) => ({
      origem: 'conteúdo',
      nome: t.label,
      tag: t,
      motivo: 'etiqueta de conteúdo já aplicada no contato',
    }));
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export const NO_TAG_CONTRACT =
  'Para gravar etiquetas, primeiro use "Aprender etiquetas" na aba Config.';

/**
 * Ids das etiquetas do CRM que correspondem a um COREDE.
 *
 * Serve para trocar a etiqueta de região quando a cidade muda: só uma região pode estar certa,
 * e a antiga tem que sair. A lista sai da planilha oficial, então nunca inclui etiqueta de
 * conteúdo nem etiqueta de fluxo ("1 SEM RETORNO") por engano.
 */
export async function regionTagIds() {
  const mapa = await loadCoredes();
  const nomes = [...new Set(Object.values(mapa))];
  const ids = new Set();
  for (const nome of nomes) {
    const tag = await resolveTag(nome);
    if (tag) ids.add(tag.id);
  }
  return ids;
}

/**
 * Aplica etiquetas ao contato SOMANDO às que ele já tem.
 *
 * A união é essencial: a plataforma grava a lista inteira de etiquetas do contato, então
 * mandar só as novas apagaria as antigas.
 *
 * `remover` é a exceção, e existe por um motivo só: quando a pessoa informa a cidade e ela
 * muda, o COREDE antigo passa a ser informação errada sobre o contato. Quem chama decide o
 * que sai — aqui nada é removido por conta própria.
 */
export async function applyTags(contact, tagIds, { remover = [] } = {}) {
  const novas = tagIds.filter(Boolean);
  const saem = new Set((remover || []).filter(Boolean));
  if (!novas.length && !saem.size) return { ok: true, applied: [], skipped: true };

  const contract = await store.get('writeContract');
  const entry = contract?.entries?.find((e) => e.type === 'TAGS');
  if (!entry) return { ok: false, error: NO_TAG_CONTRACT };

  const atuais = Array.isArray(contact.tagsId) ? contact.tagsId : [];
  const mantidas = atuais.filter((id) => !saem.has(id) || novas.includes(id));
  const uniao = [...new Set([...mantidas, ...novas])];
  if (uniao.length === atuais.length && atuais.every((id) => uniao.includes(id))) {
    return { ok: true, applied: [], skipped: true };
  }

  const { url, body } = buildRequest(entry, { contactId: contact.id, value: uniao });
  try {
    await api.apiFetch(url, { method: entry.method, body });
    return { ok: true, applied: novas };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Só para o painel poder listar as etiquetas na hora de escolher à mão. */
export async function allTags() {
  return loadTags();
}

/**
 * Descarta o cache da lista de etiquetas.
 *
 * Existe para a aba Cidades: ela CRIA etiquetas, e sem invalidar o cache a leitura seguinte
 * continuaria com a lista de antes — o painel diria que as etiquetas ainda faltam criar e
 * ofereceria criar as mesmas de novo, com nome duplicado no CRM.
 */
export function invalidateTags() {
  tagsCache = null;
}
