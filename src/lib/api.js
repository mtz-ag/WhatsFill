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
 * Listagem FILTRADA — `POST /core/v1/contact/filter`.
 *
 * É o que a tela de Contatos usa quando você aplica um filtro (`filterList` no serviço,
 * `submitFilter` no componente `contacts-filter`). O body completo que a tela monta, lido do
 * chunk `2647.*.js` em 20/08/2026:
 *
 * ```
 * { name, phonenumber, instagram, email,
 *   tagsId: [], tagsOperator: 'OR',          // filtrar POR etiqueta
 *   exceptTagsId: [], exceptTagsOperator,    // EXCLUIR quem tem a etiqueta
 *   origins: [], importedAt: [], portfolioIds: [],
 *   customFieldValuesFilters: [] }
 * ```
 *
 * **Isto corrige uma conclusão errada que eu tinha escrito aqui**: eu havia procurado o filtro no
 * `main.js`, achado só `textSearch`/`tagsIdBySearchText` e concluído que não existia filtro por
 * etiqueta. Não existia *ali* — a tela de Contatos é uma rota lazy, e o filtro dela mora no chunk
 * próprio. `tagsIdBySearchText`, que parecia ser o campo, é de sessões de chat e significa outra
 * coisa (o resultado de procurar TEXTO entre as etiquetas).
 *
 * `exceptTagsId` é o que permite pedir ao servidor "quem tem SERRA e ainda **não** tem a etiqueta
 * de cidade" — idempotência sem baixar a base. `customFieldValuesFilters` existe mas o formato
 * vem de outro componente e não foi decifrado; por isso "quem tem cidade preenchida" continua
 * sendo peneirado do nosso lado.
 *
 * Mesmo envelope da listagem.
 */
export async function filterContacts({
  textSearch = '',
  tagsId = [],
  exceptTagsId = [],
  page = 1,
  pageSize = 100,
  status = 'ACTIVE',
} = {}) {
  const body = {
    isToIncludeCustomFieldValues: true,
    page,
    pageSize,
    orderBy: 'name',
    status,
  };
  // Só manda o que foi pedido: campo vazio num filtro de terceiro é aposta — pode ser ignorado
  // ou pode significar "nenhum", e as duas leituras dão resultados opostos.
  const texto = String(textSearch || '').trim();
  if (texto) body.textSearch = texto;
  if (tagsId.length) {
    body.tagsId = tagsId;
    body.tagsOperator = 'OR';
  }
  if (exceptTagsId.length) {
    body.exceptTagsId = exceptTagsId;
    body.exceptTagsOperator = 'OR';
  }

  const corpo = await apiFetch('/core/v1/contact/filter', { method: 'POST', body });
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
 * Renomeia (atualiza) uma etiqueta. **`POST /core/v1/tag/{id}`** — sim, `POST` para atualizar e
 * `PUT` para criar, ao contrário do que a convenção REST sugeriria. Lido do serviço de etiquetas
 * do app: `post(.../core/v1/tag/${id}, {id, message, textColor, bgColor})`.
 *
 * É o caminho para consertar etiqueta com nome errado **sem tocar nos contatos**: a etiqueta é a
 * mesma, muda o rótulo, e todos que a têm passam a mostrar o nome novo. O alternativo (remover de
 * cada contato e aplicar outra) custa duas escritas por contato e abre uma janela em que o contato
 * fica sem etiqueta.
 *
 * As cores vão no body porque o app as manda sempre — e quem chama deve passar as ATUAIS, senão
 * renomear reseta a cor da etiqueta sem querer.
 */
export function updateTag(id, nome, { bgColor = '#EFEFEF', textColor = '#4F4F4F' } = {}) {
  return apiFetch(`/core/v1/tag/${id}`, {
    method: 'POST',
    body: { id, message: String(nome).trim(), textColor, bgColor },
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
/**
 * Quantas mensagens ler por página.
 *
 * **Era 50, e 50 estava cegando o painel.** Medido ao vivo em 30/08/2026, num atendimento comum:
 * a sessão tinha **168 mensagens em 4 páginas**, e a página 1 cobria só os últimos 20 dias — as
 * outras **118 eram invisíveis**. Sessão aqui não é "a conversa de hoje": a que eu medi foi
 * criada em 20/07 e continuava aberta em 30/08, 41 dias depois.
 *
 * Era esta a causa do *"a extensão não reconhece o conteúdo quando é do dia anterior"*: o pedido
 * estava lá, numa mensagem que a extensão nunca leu.
 *
 * **Subir isto não custa requisição nenhuma** — é a MESMA chamada, com resposta maior. Foi o que
 * fez a escolha ser fácil: nesta API o que derruba a plataforma é número de requisições, não
 * tamanho de resposta.
 */
const MENSAGENS_POR_PAGINA = 200;

/** Teto de páginas por sessão. Duas cobrem 400 mensagens; além disso, história antiga demais. */
const MAX_PAGINAS_DE_MENSAGEM = 2;

/**
 * As mensagens da sessão, da página 1 em diante enquanto houver e couber no teto.
 *
 * A ordem que a API devolve é da mais nova para a mais velha, então a página 2 é história mais
 * antiga. Quem chama ordena por `createdAt` de qualquer jeito.
 */
export async function getMessages(sessionId, pageSize = MENSAGENS_POR_PAGINA) {
  const todas = [];

  for (let pagina = 1; pagina <= MAX_PAGINAS_DE_MENSAGEM; pagina++) {
    const data = await apiFetch(
      `/chat/v1/message?sessionId=${sessionId}&page=${pagina}&pageSize=${pageSize}`
    );
    const itens = data?.items || [];
    todas.push(...itens);

    // `isLastPage` é da própria API. Sem ele, a única saída seria pedir mais uma página "por via
    // das dúvidas" — uma requisição a mais por contato, em toda rodada.
    if (data?.isLastPage !== false || !itens.length) break;
  }

  return todas;
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
    /**
     * O que o contato mandou **com o tipo junto, inclusive o que não tem texto**.
     *
     * Existe porque `incoming` filtra `m.text` — e isso apagava a figura: quem mandava só uma
     * imagem (o "bom dia" ilustrado, comum nesta base) chegava à rodada como *"não escreveu
     * nada"* e era assumido sem receber resposta nenhuma. O `type` vem da própria plataforma
     * (`TEXT`, `IMAGE`, `STICKER`, `AUDIO`, `VIDEO`, `DOCUMENT`), conferido no bundle do app.
     *
     * **O áudio traz a TRANSCRIÇÃO junto**, em `details.transcription.text` — conferido ao vivo
     * em 31/08/2026: de 12 mídias olhadas, 9 tinham transcrição, uma delas com 2838 caracteres.
     * É o que a plataforma mostra na tela como "Transcrição", e sem ela o áudio chegava aqui como
     * mensagem vazia: o botão "Copiar a conversa" copiava cinco `[audio]` e mais nada, que foi o
     * relato dele.
     *
     * `transcrito` marca de onde o texto veio. Importa para quem lê depois: transcrição é fala
     * passada por reconhecimento automático, com os erros disso — não é o que a pessoa escreveu.
     *
     * `incoming` continua exatamente como era: é a base do parser, e alimentar o parser com
     * transcrição é decisão à parte (nome e cidade sairiam de texto que a máquina ouviu).
     */
    entrantes: ordenadas.filter(doContato).map((m) => {
      const transcricao = String(m.details?.transcription?.text || '').trim();
      const texto = m.text || transcricao;
      return {
        texto,
        tipo: String(m.type || 'TEXT').toUpperCase(),
        transcrito: !m.text && !!transcricao,
      };
    }),
    ultima: ultima
      ? { doContato: doContato(ultima), at: ultima.createdAt, texto: ultima.text || '' }
      : null,
  };
}

/**
 * Quem está logado — e, principalmente, o `userId` que a fila usa para dizer o que é "Meus".
 *
 * A rota foi conferida ao vivo (30/08/2026): `GET /core/v1/agent/me` devolve o agente, e o
 * campo `userId` dele é exatamente o que a plataforma manda em `?userId=` ao abrir "Meus".
 * Descobrir por aqui, e não decodificando o Bearer, é o que faz isto funcionar também no modo
 * janela — lá a chamada é executada pela aba e o token nunca chega ao painel.
 */
let agenteCache = null;

export async function getAgente() {
  // Guardado por carregamento: quem está logado não muda no meio da sessão, e o contador passou
  // a atualizar a cada atendimento — sem isto, cada atualização custaria DUAS requisições numa
  // API onde rajada já derrubou a plataforma.
  if (agenteCache) return agenteCache;
  agenteCache = await apiFetch('/core/v1/agent/me');
  return agenteCache;
}

/** Status de atendimento em andamento, que é o que "aberto" quer dizer na fila. */
export const STATUS_EM_ANDAMENTO = 'IN_PROGRESS';

/**
 * Quantos atendimentos EM ANDAMENTO estão com você — o número que a plataforma não mostra.
 *
 * **Por que ele não aparece na tela dela:** ao abrir "Meus", o app pede
 * `/chat/v6/session?...&skipCount=true`, que manda a API **não calcular o total**. A resposta
 * volta com `totalItems: 0`, e o número do badge é outra coisa. Medido lado a lado em
 * 30/08/2026: badge dizia **76**, o total real era **353**.
 *
 * Aqui é a mesma rota com `skipCount=false`. `pageSize=1` de propósito: só interessa o
 * `totalItems`, e trazer 50 sessões para contar uma seria gastar rede à toa — nesta API rajada
 * de requisição já derrubou a plataforma.
 *
 * @returns {Promise<{total:number, userId:string}>}
 */
export async function contarMeusAbertos() {
  const agente = await getAgente();
  const userId = agente?.userId;
  if (!userId) throw new Error('não consegui descobrir o seu usuário em /core/v1/agent/me');

  const q = new URLSearchParams({
    skipCount: 'false',
    page: '1',
    pageSize: '1',
    includeDetails: 'All',
    statuses: STATUS_EM_ANDAMENTO,
    userId,
    sessionType: 'INDIVIDUAL',
    orderBy: 'createdat',
  });

  const corpo = await apiFetch(`/chat/v6/session?${q}`);
  return { total: Number(corpo?.totalItems ?? 0), userId };
}

/** Status de atendimento concluído. Descoberto sondando a API: os outros nomes dão 400. */
export const STATUS_CONCLUIDO = 'COMPLETED';

/**
 * Quantos atendimentos VOCÊ concluiu hoje.
 *
 * **É este o número de progresso, e não a queda dos abertos.** Medido ao vivo em 30/08/2026: o
 * total de abertos SUBIU de 353 para 359 no meio da conversa, porque chega gente nova mais
 * rápido do que se conclui. Quem olha "abertos" para saber se andou vê o número crescer num dia
 * de trabalho bom — foi exatamente o relato dele, *"continua sem diminuir"*. Concluídos hoje só
 * sobe, e sobe por causa do trabalho dele.
 *
 * `timestampFilter` com a meia-noite LOCAL (não UTC): o dia é o de quem atende. Sem
 * `timestampField`, a API filtra pela atualização — que é quando o atendimento foi concluído.
 * Com `createdat` o número é outro (as sessões CRIADAS hoje), e foi conferido lado a lado:
 * 82 pelo padrão, 38 por `createdat`.
 *
 * @returns {Promise<number>}
 */
export async function contarConcluidosHoje() {
  const agente = await getAgente();
  const userId = agente?.userId;
  if (!userId) throw new Error('não consegui descobrir o seu usuário em /core/v1/agent/me');

  const meiaNoite = new Date();
  meiaNoite.setHours(0, 0, 0, 0);

  const q = new URLSearchParams({
    skipCount: 'false',
    page: '1',
    pageSize: '1',
    includeDetails: 'All',
    statuses: STATUS_CONCLUIDO,
    userId,
    sessionType: 'INDIVIDUAL',
    orderBy: 'createdat',
    timestampFilter: meiaNoite.toISOString(),
  });

  const corpo = await apiFetch(`/chat/v6/session?${q}`);
  return Number(corpo?.totalItems ?? 0);
}

/** Os dois números do dia numa chamada só de quem chama. */
export async function contarMeuDia() {
  const [abertos, concluidosHoje] = await Promise.all([contarMeusAbertos(), contarConcluidosHoje()]);
  return { abertos: abertos.total, concluidosHoje };
}

/** Só o que o contato escreveu, do mais antigo para o mais novo. Base do parser. */
export async function getIncomingText(sessionId, pageSize = 50) {
  return (await getConversation(sessionId, pageSize)).incoming;
}
