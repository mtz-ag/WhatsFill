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
  tagsCache = arr
    .filter((t) => t.active !== false && t.message)
    .map((t) => ({ id: t.id, label: String(t.message).trim() }));
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
 * Etiquetas sugeridas para o contato.
 *
 * @param {object} ctx
 * @param {string} ctx.city    cidade já classificada
 * @param {string[]} ctx.texts mensagens recebidas do contato
 * @param {string} [ctx.extra] texto adicional para casar as regras (ex.: campanha do anúncio)
 * @returns {Promise<Array<{origem:string, nome:string, tag:object|null, motivo:string}>>}
 */
export async function suggest({ city, texts = [], extra = '' }) {
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

  // Uma etiqueta só, mesmo que duas regras apontem para ela.
  const vistas = new Set();
  return out.filter((s) => {
    const chave = `${s.origem}|${s.nome}`;
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export const NO_TAG_CONTRACT =
  'Para gravar etiquetas, primeiro use "Aprender etiquetas" na aba Config.';

/**
 * Aplica etiquetas ao contato SOMANDO às que ele já tem.
 *
 * A união é essencial: a plataforma grava a lista inteira de etiquetas do contato, então
 * mandar só as novas apagaria as antigas.
 */
export async function applyTags(contact, tagIds) {
  const novas = tagIds.filter(Boolean);
  if (!novas.length) return { ok: true, applied: [], skipped: true };

  const contract = await store.get('writeContract');
  const entry = contract?.entries?.find((e) => e.type === 'TAGS');
  if (!entry) return { ok: false, error: NO_TAG_CONTRACT };

  const atuais = Array.isArray(contact.tagsId) ? contact.tagsId : [];
  const uniao = [...new Set([...atuais, ...novas])];
  if (uniao.length === atuais.length) return { ok: true, applied: [], skipped: true };

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
