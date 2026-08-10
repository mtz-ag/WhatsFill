/**
 * api.js — acesso à API do mobiliza.app.
 *
 * IMPORTANTE, descoberto na prática: a API valida o header `Origin`. Uma requisição saindo da
 * janela do painel (origem `chrome-extension://...`) volta com **500 "Origin not allowed"**.
 * Por isso toda chamada tem que sair de dentro da aba do mobiliza.
 *
 * Daí o transporte plugável:
 *  - na aba (content script): transporte de fetch de verdade, com o Bearer do page-hook;
 *  - na janela do painel: transporte que manda a chamada para a aba executar (ver page.js).
 *
 * Assim os mesmos helpers (getSession, getContact, …) funcionam nos dois contextos, e o token
 * nunca precisa sair da aba.
 */

const BASE = 'https://api.mobiliza.app';

/** Direção das mensagens: FROM_HUB é o que chega do canal (o contato falando). */
export const DIRECTION_IN = 'FROM_HUB';

let transport = null;

export function setTransport(fn) {
  transport = fn;
}

export function apiFetch(path, opts = {}) {
  if (!transport) throw new Error('WhatsFill: transporte da API não configurado.');
  return transport(path, opts);
}

/**
 * Transporte real. Só use no contexto da página do mobiliza — de qualquer outra origem a API
 * responde "Origin not allowed".
 * @param {function} tokenProvider devolve o header Authorization
 */
export function createFetchTransport(tokenProvider) {
  let cached = null;

  return async function fetchTransport(path, { method = 'GET', body = null, retry = true } = {}) {
    const url = path.startsWith('http') ? path : BASE + path;
    if (!url.startsWith(BASE)) throw new Error('WhatsFill só fala com ' + BASE);

    if (!cached) cached = await tokenProvider();
    const headers = { Authorization: cached };
    if (body != null) headers['Content-Type'] = 'application/json';

    const res = await fetch(url, {
      method,
      headers,
      body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });

    if (res.status === 401 && retry) {
      // Token expirou: descarta o cache e pede de novo, já que o app renova o dele sozinho.
      cached = null;
      return fetchTransport(path, { method, body, retry: false });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
    }

    if (res.status === 204) return null;
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (_) {
      return text;
    }
  };
}

export function getSession(sessionId) {
  return apiFetch(`/chat/v1/session/${sessionId}`);
}

/**
 * Contato completo.
 *
 * `isToIncludeCustomFields` NÃO é opcional: sem ele a API responde 200 com
 * `customFieldValues: []`, mesmo o contato tendo valores gravados. Foi o que fez o painel
 * achar que todo contato estava vazio — marcava tudo como palpite amarelo e regravava os
 * mesmos campos a cada Salvar. Os parâmetros são os mesmos que a própria plataforma usa.
 */
export function getContact(contactId) {
  const q = new URLSearchParams({
    isToIncludeCustomFields: 'true',
    isToIncludeTags: 'true',
    isToIncludePortfolios: 'false',
  });
  return apiFetch(`/core/v1/contact/${contactId}?${q}`);
}

/** Schema dos campos personalizados. Devolve um array puro (não é paginado num envelope). */
export function getCustomFields() {
  return apiFetch('/core/v1/custom-field?page=1&pageSize=100');
}

/**
 * Etiquetas cadastradas. Atenção: o rótulo vem no campo `message` (não em `name`), e a
 * resposta é um array puro.
 */
export function getTags() {
  return apiFetch('/core/v1/tag?page=1&pageSize=500');
}

/**
 * Modelos de mensagem salvos (templates aprovados do WhatsApp / HSM).
 *
 * Rota e parâmetros conferidos ao vivo no diálogo "Enviar modelo de mensagem". `includeDetails`
 * é o que traz `params`, o arquivo de exemplo e os botões — sem ele não dá para saber se o
 * modelo precisa de parâmetro. Envelope paginado: { items, totalItems, ... }.
 *
 * `channelId` filtra pelos modelos do canal do atendimento; omitido, a API devolve os da
 * empresa toda.
 */
export async function getMessageTemplates({ channelId, search = '', pageSize = 100 } = {}) {
  const q = new URLSearchParams({
    page: '1',
    pageSize: String(pageSize),
    includeDetails: 'PARAMS,FILE,INTERACTIVE',
    orderBy: 'name',
    searchableText: search,
    types: 'TEMPLATE',
  });
  // Repetido de propósito: a plataforma manda os dois status.
  q.append('statuses', 'APPROVED');
  q.append('statuses', 'INREVISION');
  if (channelId) q.append('channelId', channelId);

  const data = await apiFetch(`/chat/v5/template?${q}`);
  return data?.items || [];
}

/** Mensagens da sessão, mais recentes primeiro. Envelope: { items, totalItems, ... } */
export async function getMessages(sessionId, pageSize = 50) {
  const data = await apiFetch(`/chat/v1/message?sessionId=${sessionId}&page=1&pageSize=${pageSize}`);
  return data?.items || [];
}

/** Só o que o contato escreveu, do mais antigo para o mais novo. Base do parser. */
export async function getIncomingText(sessionId, pageSize = 50) {
  const items = await getMessages(sessionId, pageSize);
  return items
    .filter((m) => m.direction === DIRECTION_IN && !m.userId && !m.botId && m.text)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((m) => m.text);
}
