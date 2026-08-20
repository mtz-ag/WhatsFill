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
 * Listagem paginada de contatos.
 *
 * **Rota e parâmetros lidos do código do próprio app** (`main.*.js`, método `list()` do serviço
 * de contatos), em 20/08/2026. A primeira versão disto chutava os parâmetros e chutou errado em
 * dois pontos que valem registro:
 *
 * - o parâmetro é **`isToIncludeCustomFieldValues`**, não `isToIncludeCustomFields`. O nome
 *   parecido é do `GET /core/v1/contact/{id}`, que usa o OUTRO. Com o nome errado a API responde
 *   200 e ignora — o mesmo modo de falhar que já custou dias neste projeto com a data de
 *   conclusão: resposta boa, valor ausente. Aqui teria dado "nenhum contato tem cidade";
 * - `status=ACTIVE` e `orderBy=name` fazem parte do que o app manda. Sem `status`, não se sabe se
 *   a API devolve arquivado e bloqueado junto — e etiquetar contato arquivado é trabalho jogado
 *   fora.
 *
 * `isToIncludeTags` vai como reforço: o app **não** o manda aqui e a tela de Contatos mostra as
 * etiquetas de qualquer forma (`contact.tagsId` é campo próprio do contato), então ele
 * provavelmente é redundante. Se a API o ignorar, não custa nada; se respeitar, garante.
 *
 * Envelope, também lido do app (`_pageControl.update`):
 * `{ items, page, countPages, totalItems, pageSize, lastTimestamp }`.
 *
 * @returns {Promise<{itens: Array, total: number|null, paginas: number|null}>}
 */
export async function listContacts({ page = 1, pageSize = 100, status = 'ACTIVE' } = {}) {
  const q = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    orderBy: 'name',
    status,
    isToIncludeCustomFieldValues: 'true',
    isToIncludeTags: 'true',
  });

  const corpo = await apiFetch(`/core/v1/contact?${q}`);
  const itens = Array.isArray(corpo) ? corpo : corpo?.items || [];
  return {
    itens,
    total: Array.isArray(corpo) ? null : corpo?.totalItems ?? null,
    paginas: Array.isArray(corpo) ? null : corpo?.countPages ?? null,
  };
}

/**
 * Listagem COM busca por texto — `POST /core/v1/contact/filter`.
 *
 * É o que a tela de Contatos usa quando você digita no campo Pesquisar (método `filterList` do
 * app). Body: `{textSearch, isToIncludeCustomFieldValues, page, pageSize, orderBy}`.
 *
 * **O que o filtro NÃO faz:** não existe "só quem tem a etiqueta X" nem "só quem tem cidade". Os
 * campos aceitos são `textSearch`, `statuses`, `tagsIdBySearchText` e
 * `isToIncludeCustomFieldValues` — conferidos no bundle. `tagsIdBySearchText` é o resultado de
 * procurar TEXTO entre as etiquetas, não um filtro por etiqueta escolhida. Por isso a
 * categorização por cidade lê a base e filtra do nosso lado: não há como o servidor fazer isso.
 *
 * Mesmo envelope da listagem.
 */
export async function filterContacts({ textSearch = '', page = 1, pageSize = 100 } = {}) {
  const corpo = await apiFetch('/core/v1/contact/filter', {
    method: 'POST',
    body: {
      textSearch: String(textSearch || '').trim(),
      isToIncludeCustomFieldValues: true,
      page,
      pageSize,
      orderBy: 'name',
    },
  });
  const itens = Array.isArray(corpo) ? corpo : corpo?.items || [];
  return {
    itens,
    total: Array.isArray(corpo) ? null : corpo?.totalItems ?? null,
    paginas: Array.isArray(corpo) ? null : corpo?.countPages ?? null,
  };
}

/**
 * Cria uma etiqueta.
 *
 * **É `PUT`, não `POST`** — lido do serviço de etiquetas do app (`save(message, textColor,
 * bgColor)`), 20/08/2026. A primeira versão disto usava `POST` com só `{message}`: método errado
 * e body incompleto.
 *
 * As cores são passadas porque o app as passa sempre, juntas, na tela de etiquetas. O par padrão
 * (`#EFEFEF` no fundo, `#4F4F4F` no texto) são as duas cores neutras mais usadas no próprio app —
 * etiqueta de cidade é organização interna, não precisa competir por atenção com "1 SEM RETORNO",
 * que é vermelha.
 */
export function createTag(nome, { bgColor = '#EFEFEF', textColor = '#4F4F4F' } = {}) {
  return apiFetch('/core/v1/tag', {
    method: 'PUT',
    body: { message: String(nome).trim(), textColor, bgColor },
  });
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

/** Mensagem do operador e do bot são as duas "nossas": as duas dizem que o contato foi atendido. */
function doContato(m) {
  return m.direction === DIRECTION_IN && !m.userId && !m.botId;
}

/**
 * A conversa em uma requisição só: o que o contato escreveu **e** quem falou por último.
 *
 * Existe junta de propósito. A rodada precisa das duas coisas por contato, e cada contato já
 * custa uma sessão na plataforma mais três chamadas nossas — foi rajada de requisição que
 * derrubou a API (e a plataforma junto) uma vez. Duas leituras da mesma lista não podem virar
 * duas idas ao servidor.
 *
 * `ultima` **não** filtra mensagem sem texto: figura, áudio e sticker também são a última
 * mensagem da conversa. Filtrar faria uma figura nossa desaparecer e a rodada leria a mensagem
 * anterior como se ainda fosse a vez do contato.
 *
 * @returns {Promise<{incoming:string[], ultima:{doContato:boolean, at:string, texto:string}|null}>}
 */
export async function getConversation(sessionId, pageSize = 50) {
  const items = await getMessages(sessionId, pageSize);
  const ordenadas = [...items].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const ultima = ordenadas[ordenadas.length - 1] || null;

  return {
    incoming: ordenadas.filter((m) => doContato(m) && m.text).map((m) => m.text),
    ultima: ultima
      ? { doContato: doContato(ultima), at: ultima.createdAt, texto: ultima.text || '' }
      : null,
  };
}

/** Só o que o contato escreveu, do mais antigo para o mais novo. Base do parser. */
export async function getIncomingText(sessionId, pageSize = 50) {
  return (await getConversation(sessionId, pageSize)).incoming;
}
