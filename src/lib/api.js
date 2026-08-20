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
 * A rota de LISTAGEM de contatos, descoberta na primeira chamada e memorizada.
 *
 * As outras rotas deste arquivo foram conferidas ao vivo, uma a uma. Esta não deu: os domínios do
 * mobiliza estão bloqueados pela política de navegação da sessão em que ela foi escrita. Como a
 * regra do projeto é **não chutar rota**, o código não escolhe uma: ele testa as candidatas com
 * `pageSize=1` (leitura mínima, nada de puxar base durante a descoberta) e fica com a que
 * responder no formato certo.
 *
 * A ordem tenta primeiro a versão COM os campos personalizados, porque é ela que decide o custo
 * da categorização inteira: com a cidade vindo na listagem, ler 57 mil contatos custa ~580
 * requisições; sem ela, custaria uma por contato — o que é exatamente a rajada que já derrubou a
 * API uma vez.
 */
let rotaDeListagem = null;

const CANDIDATAS_LISTAGEM = [
  (q) => `/core/v1/contact?${q}&isToIncludeCustomFields=true&isToIncludeTags=true`,
  (q) => `/core/v1/contact?${q}&isToIncludeCustomFields=true`,
  (q) => `/core/v1/contact?${q}`,
];

function pareceListagem(corpo) {
  return Array.isArray(corpo) || Array.isArray(corpo?.items);
}

export async function descobrirRotaDeListagem() {
  if (rotaDeListagem) return rotaDeListagem;

  const erros = [];
  for (const montar of CANDIDATAS_LISTAGEM) {
    const rota = montar('page=1&pageSize=1');
    try {
      const corpo = await apiFetch(rota);
      if (pareceListagem(corpo)) {
        rotaDeListagem = montar;
        return rotaDeListagem;
      }
      erros.push(`${rota} → respondeu, mas não é lista`);
    } catch (err) {
      erros.push(`${rota} → ${err.message.slice(0, 120)}`);
    }
  }

  throw new Error(
    'Não achei a rota de listagem de contatos. Tentei:\n' +
      erros.join('\n') +
      '\n\nAbra o F12 → Network na tela de Contatos, filtre por "contact" e me diga a URL real.'
  );
}

/**
 * Uma página da base de contatos.
 *
 * @returns {Promise<{itens: Array, total: number|null}>}
 */
export async function listContacts({ page = 1, pageSize = 100 } = {}) {
  const montar = await descobrirRotaDeListagem();
  const corpo = await apiFetch(montar(`page=${page}&pageSize=${pageSize}`));
  const itens = Array.isArray(corpo) ? corpo : corpo?.items || [];
  const total = Array.isArray(corpo) ? null : corpo?.totalItems ?? corpo?.total ?? null;
  return { itens, total };
}

/**
 * Cria uma etiqueta.
 *
 * O rótulo vai em `message` porque é de lá que a leitura o tira (ver `getTags`) — a plataforma
 * chama de "message" o que a tela mostra como nome da etiqueta.
 *
 * **Esta rota não foi conferida ao vivo.** Diferente de tudo o mais aqui, ela ESCREVE, e escrita
 * não verificada é o que este projeto evita por regra. Por isso quem chama tem que tratar a
 * falha com o motivo na tela, e a aba Categorizar cria **uma** etiqueta de teste antes de criar
 * as outras — se a primeira não passar, nenhuma outra é tentada.
 */
export function createTag(nome) {
  return apiFetch('/core/v1/tag', { method: 'POST', body: { message: String(nome).trim() } });
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
