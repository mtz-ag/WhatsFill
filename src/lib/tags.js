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
 * "Sim" a uma pergunta fechada, medido só na ÚLTIMA mensagem do contato.
 *
 * Olhar a conversa inteira acharia "sim" em qualquer lugar ("sim, moro em Pelotas") e aplicaria
 * etiqueta de conteúdo a quem nunca foi perguntado. A negação vence sempre: "sim, mas não quero"
 * não é aceite.
 *
 * Puro e exportado para ter teste — é ele que decide gravar etiqueta em eleitor real.
 */
const AFIRMATIVAS =
  /^(s|sim+|claro|quero|aceito|pode|manda|mande|positivo|afirmativo|isso|ok|okay|blz|beleza|com certeza|certeza|gostaria|por favor|pf|please|bora|adoraria|quero sim|sim quero|pode sim|pode mandar|pode enviar|quero receber)\b/;

const NEGATIVAS = /\bnao\b|\bnem\b|\bnunca\b|\bdispenso\b|\bobrigado nao\b/;

export function respostaAfirmativa(texts = []) {
  const ultima = [...texts].reverse().find((t) => String(t || '').trim());
  if (!ultima) return false;

  const norm = normalize(ultima).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!norm) return false;
  // Resposta a pergunta fechada é curta. Texto longo é outra conversa, não um "sim".
  if (norm.split(' ').length > 6) return false;
  if (NEGATIVAS.test(norm)) return false;
  return AFIRMATIVAS.test(norm);
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
