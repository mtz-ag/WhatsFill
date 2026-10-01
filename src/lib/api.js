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

/**
 * **Engasgo de rede, e não defeito** (22/09/2026) — o que a rodada ESPERA e segue, em vez de parar.
 *
 * O navegador recusando a requisição (`Failed to fetch`, o preflight que o limitador de taxa derruba)
 * e os status de servidor sobrecarregado (429, 502, 503, 504). Todo o resto — 400, 401, 404, erro de
 * tela — continua parando a rodada: aquilo é defeito, e insistir não conserta.
 */
export function ehErroDeRede(mensagem) {
  const m = String(mensagem || '');
  return /failed to fetch|networkerror|load failed|sem resposta/i.test(m) || /→ (429|502|503|504)\b/.test(m);
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

    /**
     * **O `Failed to fetch` passa a dizer QUAL rota falhou** (22/09/2026). Cru, ele não traz nada: o
     * navegador recusa a requisição antes de haver status, e o Andamento dizia só "a API parou de
     * responder" — sem saber se era a conversa, o contato ou a gravação, não há como medir de onde
     * vem o excesso. O texto "Failed to fetch" fica dentro, porque é por ele que o painel reconhece.
     */
    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      });
    } catch (err) {
      const rota = path.split('?')[0];
      throw new Error(`${method} ${rota} → sem resposta (${err?.message || 'Failed to fetch'})`);
    }

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
 * de cidade" — idempotência sem baixar a base.
 *
 * **`customFieldValuesFilters` foi decifrado em 26/09/2026, e é o MESMO corpo do contrato de
 * ESCRITA**: cada item é `{customFieldId, valueString | valuesInteger[] | valuesFloat[] |
 * valuesId[] | valuesDateTime[] | valueBoolean}`, montado no app pela mesma função que monta a
 * gravação do campo. Ou seja, o que o `contract.js` aprendeu para gravar vale para filtrar — dá
 * para pedir ao servidor "quem tem a Data de conclusão do contato igual a tal dia". Esta função
 * ainda não o manda: "quem tem cidade preenchida" continua peneirado do nosso lado até haver um
 * caminho que precise dele, porque campo de filtro de terceiro sem uso é aposta não conferida.
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
/**
 * **O id da sessão ANTERIOR deste contato — o que o botão "Ver conversa anterior" carrega.**
 *
 * Pedido dele (07/09/2026): *"veja como abrir a conversa anterior, será necessário quando houver
 * para não perder o contexto; mas será uma abertura só, tem conversas que podem ter múltiplas
 * instâncias. Depois de abrir, pegue os dados de cidade e prossiga com a sugestão"*.
 *
 * **Lido no bundle do app, não chutado** (a receita registrada no `CLAUDE.md`). O botão é um
 * `h-button` com `text="Ver conversa anterior"` que emite `loadPreviousEvent`, e quem atende faz
 * duas coisas, nesta ordem:
 *
 *  1. `getPreviousSessionId(session)` → **`GET /chat/v1/session/{id}/previous`**, que devolve o id
 *     da anterior. O app guarda em `currentPreviousSessionId` e liga o botão com
 *     `hasMorePrevious = id != null` — ou seja, **o botão na tela é exatamente esta rota**;
 *  2. `loadPrevious(id)` → `GET /chat/v2/session/{id}`, que traz a sessão anterior inteira.
 *
 * **A CADEIA é o que ele chamou de "múltiplas instâncias":** carregada uma, o app pergunta o
 * `/previous` DAQUELA e o botão volta a aparecer. Aqui vai **um nível só**, de propósito — é a
 * regra dele, e cada nível a mais é uma requisição a mais por contato numa API que já caiu por
 * rajada.
 *
 * O passo 2 do app não é o que usamos: `GET /chat/v2/session/{id}` traz a sessão com um controle
 * de paginação próprio, e nós já temos `getMessages(id)`, que pagina, é testado e devolve o
 * formato que o resto do painel entende. O id é a única coisa que faltava.
 *
 * **Não haver anterior é o caso normal**, e a plataforma trata assim: o app pede esta rota com
 * `suppressError: true`. Aqui, qualquer falha vira `''` — quem chama decide como decidia.
 */
export async function getPreviousSessionId(sessionId) {
  if (!sessionId) return '';
  let resposta;
  try {
    resposta = await apiFetch(`/chat/v1/session/${sessionId}/previous`);
  } catch (_) {
    return '';
  }
  // O app guarda a resposta INTEIRA como id (`previousSessionIds[id] = resposta`), então ela é o
  // id cru. `apiFetch` já devolve string quando o corpo não é JSON, e objeto quando é — as duas
  // formas são aceitas aqui porque o corpo desta rota não foi visto ao vivo, só no código do app.
  if (!resposta) return '';
  if (typeof resposta === 'string') return resposta.trim().replace(/^"|"$/g, '');
  if (typeof resposta === 'object') return String(resposta.id || resposta.sessionId || '').trim();
  return '';
}

/**
 * A conversa ANTERIOR deste contato — uma, e no mesmo formato de `getConversation`.
 *
 * Devolve `null` quando não há anterior, quando a leitura falha, ou quando a sessão anterior está
 * vazia. **Custa duas requisições** (o id e as mensagens), então quem chama tem que ter um motivo:
 * hoje é "falta a cidade e o botão está na tela".
 */
export async function getConversaAnterior(sessionId, pageSize = MENSAGENS_POR_PAGINA) {
  const anteriorId = await getPreviousSessionId(sessionId);
  if (!anteriorId || anteriorId === String(sessionId)) return null;

  try {
    const conversa = await getConversation(anteriorId, pageSize);
    if (!conversa || (!conversa.incoming?.length && !conversa.entrantes?.length)) return null;
    return { ...conversa, sessionId: anteriorId };
  } catch (_) {
    return null;
  }
}

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
        // `at` existe para separar a RAJADA do resto: as mensagens que chegaram depois da
        // nossa última são uma conversa pendente, e é o conjunto delas que decide se cabe
        // resposta pronta. Sem o horário, `entrantes` é uma lista sem antes e depois.
        at: m.createdAt || null,
        /**
         * **`ts` e `bytes` existem para uma pergunta só: isto foi GRAVADO agora ou ENCAMINHADO?**
         *
         * Print da Irene (07/09/2026): cinco áudios somando quase três minutos de fala entregues
         * em **dois segundos**. Foi ele quem nomeou o critério: *"realmente não é possível áudios
         * com aquele tempo naquele espaço de tempo"*. Ver `cortesia.marcarLoteEncaminhado`.
         *
         * **`timestamp` é o do WhatsApp e `createdAt` é o da plataforma**, e a diferença importa
         * exatamente no caso que separa o encaminhamento do falso positivo: aparelho que estava
         * sem rede entrega tudo junto quando reconecta (mesmo `createdAt`), e aí os `timestamp`
         * continuam espalhados, como as gravações foram.
         *
         * A API não devolve a DURAÇÃO do áudio — o tempo que a tela mostra é o player lendo o
         * arquivo. `details.file.size` é o que existe, e serve: duração e tamanho crescem juntos.
         */
        ts: m.timestamp || m.createdAt || null,
        bytes: Number(m.details?.file?.size) || 0,
      };
    }),
    ultima: ultima
      ? { doContato: doContato(ultima), at: ultima.createdAt, texto: ultima.text || '' }
      : null,
    /**
     * O que NÓS mandamos, com texto e tipo.
     *
     * Existe porque `templatesLib.wasSent` só enxerga o que saiu **pelo painel**: modelo mandado
     * pela automação da plataforma, pelo chatbot do anúncio ou à mão por outra pessoa não deixa
     * rastro nenhum ali. Foi assim que a rodada sugeriu "mande o modelo" para quem já estava com
     * o modelo na tela, algumas mensagens acima (print dele, 31/08).
     */
    nossas: ordenadas
      .filter((m) => !doContato(m))
      // `at` pelo mesmo motivo que em `entrantes`: sem hora nao da para intercalar os dois lados,
      // e "o que ela respondeu DEPOIS da nossa pergunta" e uma pergunta sobre ordem.
      .map((m) => ({ texto: m.text || '', tipo: String(m.type || 'TEXT').toUpperCase(), at: m.createdAt || null })),
    /**
     * Quando saiu a NOSSA última mensagem, de qualquer tipo.
     *
     * Existe para a rodada saber que o contato **já foi respondido**. \`ultima\` não serve: quando
     * a pessoa escreve depois de nós — que é o caso comum — a última é dela, e a nossa some da
     * conta. E `templatesLib.wasSent` também não, porque só enxerga o que saiu por template:
     * resposta escrita à mão, que é a maioria das respostas de verdade, não deixa rastro ali.
     */
    nossaUltimaAt: [...ordenadas].reverse().find((m) => !doContato(m))?.createdAt || null,
    /**
     * **O `senderId` da última mensagem nossa** — o que o corpo do envio de imagem exige (ver
     * `imagem.corpoDaMensagem`).
     *
     * **CORREÇÃO (01/10/2026): ele NÃO é identidade, e não é o mesmo em toda a sessão.** O que
     * estava escrito aqui — *"toda mensagem da sessão carrega o mesmo senderId"* — é falso: lido no
     * bundle, o app faz `senderId: uuid()` **a cada mensagem** (`createMessage`, `sendFileMessage`,
     * `resendTemplateMessage`), com o módulo de UUID v4. É um id de correlação do cliente, não o
     * agente nem o canal.
     *
     * Isso tem uma consequência prática grande: **atendimento recém-criado não tem mensagem
     * nenhuma, e mesmo assim dá para mandar** — basta gerar um (`novoSenderId`). A crença antiga
     * dizia que sem conversa não havia como enviar.
     *
     * Reusar o da última mensagem nossa continua certo onde a conversa existe: sai de graça, e
     * nesta API o que derruba a plataforma é NÚMERO de requisições.
     */
    senderId: String(([...ordenadas].reverse().find((m) => !doContato(m)) || ultima)?.senderId || ''),
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

/**
 * Os dois números do dia numa chamada só de quem chama.
 *
 * **UMA DE CADA VEZ, e não `Promise.all`** (24/09/2026). As duas são a MESMA rota
 * (`/chat/v6/session`) com `skipCount=false`, que manda a API **calcular o total** — é a consulta
 * mais cara que este painel faz, e a plataforma pede a dela com `skipCount=true` justamente para
 * não pagar isso. Mandar as duas no mesmo instante é uma rajada de dois contra o limitador de
 * taxa, e foi numa delas que a conta dele estourou depois de 222 conclusões no dia.
 *
 * Serializar não custa nada aqui: é um número na tela, não o caminho de uma mensagem.
 */
export async function contarMeuDia() {
  const abertos = await contarMeusAbertos();
  const concluidosHoje = await contarConcluidosHoje();
  return { abertos: abertos.total, concluidosHoje };
}

/**
 * **Um `senderId` novo** — id de correlação do cliente, um por mensagem, como o app faz.
 *
 * Existe para o atendimento que acabou de ser criado: ele não tem mensagem nenhuma de onde copiar.
 */
export function novoSenderId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) {
    /* segue para o caminho manual */
  }
  // Mesmo formato do uuid v4 que o app usa, para o caso de `randomUUID` não existir no contexto.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * **As EQUIPES (departamentos) da conta** — `GET /core/v1/department`.
 *
 * Lida no bundle em 01/10/2026 e **nunca executada**: por isso quem chama trata a lista vazia como
 * "não consegui ler", e não como "não há equipe". A disciplina é a de `listContacts`/`createTag`
 * (20/08): ler o código do app não é ter chamado a rota.
 */
export async function listarEquipes() {
  const corpo = await apiFetch('/core/v1/department');
  const itens = Array.isArray(corpo) ? corpo : corpo?.items || [];
  return itens
    .map((d) => ({ id: String(d?.id || ''), nome: String(d?.name || d?.description || '').trim() }))
    .filter((d) => d.id);
}

/**
 * **Os NÚMEROS (canais) da conta, com a saúde de cada um** — `GET /chat/v4/channel/my`.
 *
 * É a rota que o app usa para montar a lista de canais, e ela traz o que decide as regras de cada
 * número (27/09): `status` (`CONNECTED`, `FLAGGED` = sinalizado como SPAM, `RESTRICTED` = teto de
 * conversas iniciadas em 24h, `BANNED`, `DISCONNECTED`), `quality` (`HIGH`/`MEDIUM`/`LOW`) e
 * `typeDetails`, onde moram `canStartNewSession`, `mustUseTemplate`, `canSendCampaign` e
 * `sessionDurationInMinutes` (**-1 = canal sem janela de 24h**).
 *
 * `type` separa os dois mundos: `CloudApi`/`Dialog360` são oficiais; `ZAPI`/`EvolutionAPI` não.
 */
export async function canaisDaConta() {
  const corpo = await apiFetch('/chat/v4/channel/my');
  const itens = Array.isArray(corpo) ? corpo : corpo?.items || [];
  return itens
    .map((c) => ({
      id: String(c?.id || ''),
      nome: String(c?.name || c?.description || '').trim(),
      numero: String(c?.numberFormatted || c?.number || '').trim(),
      tipo: String(c?.type || ''),
      /**
       * **`status` e `quality` são da CLOUD API e vêm VAZIOS em canal não oficial** (medido em
       * 01/10/2026 no canal `ZAPI_WHATSAPP` dele: os dois chegaram `undefined`, e a tela mostrou
       * *"status UNDEFINED · qualidade UNDEFINED"*). A armadilha já estava escrita desde 26/09 —
       * *"quality, RESTRICTED e CHANNEL_TIER_EXCEEDED são da Cloud API e podem não significar nada
       * num canal Z-API"* — e eu mapeei os dois como se fossem universais.
       */
      status: String(c?.status || ''),
      qualidade: String(c?.quality || ''),
      /**
       * **`healthStatus` é o campo que diz se o NÚMERO CAIU, e é o que existe nos dois mundos.**
       * Lido no bundle: `ChannelHealthStatus` = `OK` ("Estável"), `CHECK` ("Verificando conexão"),
       * `ALERT` ("Em alerta"), `CRITICAL` ("Crítica a conexão com o WhatsApp...") e `DISCONNECTED`
       * ("Número de telefone foi desconectado") — é o que pinta a tarja do cabeçalho da conversa,
       * que é a mesma informação que a extensão lia por TEXTO desde sempre.
       */
      saude: String(c?.healthStatus || ''),
      detalhes: c?.typeDetails || null,
    }))
    .filter((c) => c.id);
}

/** A plataforma diz que já existe atendimento aberto para este contato neste número. */
export const JA_EXISTE_ATENDIMENTO = 'ja-existe-atendimento';

/**
 * **Abre um atendimento NOVO para um contato** — `PUT /chat/v1/session`.
 *
 * Corpo lido no bundle (01/10/2026), no `execute()` do diálogo que a plataforma abre ao clicar no
 * botão `data-cy="button-start-session"` da ficha do contato:
 *
 * ```
 * { contactId, templateId: null, departmentId, channelId, compiledTemplate: null }
 * ```
 *
 * **`templateId`/`compiledTemplate` nulos é o caminho sem modelo aprovado** — o próprio app monta o
 * corpo assim e só os preenche quando há modelo escolhido. Em canal **não oficial** não há janela de
 * 24h nem modelo, então é este o caminho; em canal oficial fora da janela a plataforma vai exigir o
 * modelo, e aí ela recusa (o motivo volta no erro).
 *
 * **PUT cria, como em `createTag`** (`POST` ali atualiza) — não troque por POST.
 *
 * **Rota NUNCA EXECUTADA:** quem chama manda UMA como sonda antes do lote, e para se ela falhar.
 *
 * O caso que a própria tela trata e que a rodada precisa distinguir: a resposta de erro trazendo
 * *"Já existe um atendimento"* não é defeito — é o contato já ter conversa aberta naquele número.
 */
export async function abrirAtendimento({ contactId, departmentId = null, channelId }) {
  if (!contactId) throw new Error('sem contato para abrir o atendimento');
  if (!channelId) throw new Error('escolha o número (canal) antes de abrir o atendimento');
  try {
    const sessao = await apiFetch('/chat/v1/session', {
      method: 'PUT',
      body: {
        contactId,
        templateId: null,
        departmentId: departmentId || null,
        channelId,
        compiledTemplate: null,
      },
    });
    const id = String(sessao?.id || '');
    if (!id) throw new Error('a plataforma não devolveu o atendimento criado');
    return { ok: true, sessionId: id, sessao };
  } catch (err) {
    const texto = String(err?.message || err);
    if (/j[áa] existe um atendimento/i.test(texto)) {
      return { ok: false, motivo: JA_EXISTE_ATENDIMENTO, texto };
    }
    throw err;
  }
}

/**
 * **Manda TEXTO numa sessão pela API** — `PUT /chat/v1/session/{id}/message`, `type: 'TEXT'`.
 *
 * É a MESMA rota e o mesmo envelope que o envio de imagem já usa em produção desde 20/09 (ver
 * `imagem.corpoDaMensagem`), com `type` trocado — foi lido no `sendMessage` do app em 01/10/2026.
 *
 * Existe para o envio em lote, onde a conversa **não está na tela**: `page.sendText` digita no
 * campo da conversa aberta, e ali não há conversa aberta. Fora desse caso, continue usando o
 * caminho da tela, que é o que a plataforma renderiza igual ao que uma pessoa faria.
 */
export async function mandarTexto({ sessionId, senderId, texto }) {
  if (!sessionId) throw new Error('sem atendimento para mandar o texto');
  const agora = new Date().toISOString();
  const msg = await apiFetch(`/chat/v1/session/${sessionId}/message`, {
    method: 'PUT',
    body: {
      sessionId,
      senderId: senderId || novoSenderId(),
      type: 'TEXT',
      text: String(texto || ''),
      direction: 'TO_HUB',
      createdAt: agora,
      updatedAt: agora,
      timestamp: agora,
      status: 'PROCESSING',
    },
  });
  // A armadilha mais antiga daqui: 2xx não prova nada. O texto tem que voltar.
  if (!String(msg?.text || '').trim()) throw new Error('a plataforma aceitou e não guardou o texto');
  return { id: String(msg?.id || '') };
}

/**
 * **Conclui um atendimento pela API** — `POST /chat/v1/session/{id}/complete` com corpo **VAZIO**.
 *
 * Lido no bundle em 01/10/2026: o botão "Concluir" da tela chama exatamente
 * `complete(session.id, {})`. Quem preenche o corpo é a outra opção do menu, "Classificar e
 * concluir" (`{statusReasonId, statusReasonEnum, statusReasonAmount}`), que é escolha dele por
 * contato — não é o que uma rodada em lote deve inventar.
 *
 * **Existe para o lote por etiqueta**, onde o atendimento foi criado pela API e não está na tela:
 * `concluirPeloPainel` é DOM e precisa dos dois cliques do menu da conversa aberta.
 *
 * **O que esta rota NÃO faz, de propósito:** gravar a "Data de conclusão do contato". Aquele campo
 * é escrita nossa no CRM (`saveClassification`), e a decisão dele de 31/08 é que o caminho
 * automático não grava campo nenhum. Aqui só o atendimento é fechado, na plataforma.
 */
export async function concluirAtendimento(sessionId) {
  if (!sessionId) throw new Error('sem atendimento para concluir');
  const sessao = await apiFetch(`/chat/v1/session/${sessionId}/complete`, { method: 'POST', body: {} });
  // O 2xx não prova nada: o status tem de voltar concluído.
  const status = String(sessao?.status || '');
  if (status && status !== STATUS_CONCLUIDO) {
    throw new Error(`a plataforma aceitou e o atendimento ficou como ${status}`);
  }
  return { ok: true, status };
}

/** Só o que o contato escreveu, do mais antigo para o mais novo. Base do parser. */
export async function getIncomingText(sessionId, pageSize = 50) {
  return (await getConversation(sessionId, pageSize)).incoming;
}
