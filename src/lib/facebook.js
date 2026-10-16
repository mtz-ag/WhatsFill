/**
 * facebook.js — os comentários das postagens da página, e a resposta a eles.
 *
 * Pedido dele (16/10/2026): *"preciso que responda os comentários nas postagens do facebook, crie
 * uma nova aba para isso"*. Perguntado por onde a extensão chega lá, escolheu a **Graph API com
 * token de página**; perguntado o que a aba faz, escolheu **listar e ele responder, com o rascunho
 * da IA** — a mesma fronteira do resto do projeto: o que sai é texto que ele leu.
 *
 * **Este arquivo é PURO.** Ele monta pedidos e lê respostas; quem vai à rede é o service worker,
 * pela mesma razão da chave da IA: o painel roda dentro da página do mobiliza, e **token na página
 * é token publicado**. Ver `MSG_FB` e o `background.js`.
 *
 * **As rotas foram LIDAS na documentação, não executadas** — é a situação de `listContacts` e
 * `createTag` em 20/08, e a disciplina é a mesma: a primeira chamada é uma SONDA (`/me/accounts`),
 * e falhando ela nenhuma outra é tentada. Toda leitura confere o formato em vez de confiar nele.
 */

/**
 * **A versão vai EXPLÍCITA na URL.** Caminho sem versão cai na mais ANTIGA ainda disponível, que é
 * a que vai ser desligada primeiro — e o sintoma seria a aba parar de funcionar num dia qualquer,
 * sem ninguém ter mexido em nada. Trocar aqui troca em todas as chamadas.
 */
export const VERSAO_GRAPH = 'v23.0';
export const BASE_GRAPH = 'https://graph.facebook.com';

/** O que a extensão precisa poder fazer. Falta uma delas e o erro é 200, não 190. */
export const PERMISSOES = ['pages_read_engagement', 'pages_manage_engagement', 'pages_show_list'];

/**
 * **Quantos comentários por página.** O Graph pagina por cursor; cada chamada a mais é uma
 * requisição a mais, e esta aba é manual (ele clica), então o lote grande sai mais barato que a
 * varredura. O teto do Graph para `limit` é 100.
 */
export const COMENTARIOS_POR_PAGINA = 50;
export const POSTS_POR_PAGINA = 10;

/** O texto da resposta tem teto na própria plataforma; cortar antes evita o 100 por tamanho. */
export const MAX_RESPOSTA = 8000;

/**
 * Monta a URL do Graph.
 *
 * **O token NÃO entra aqui.** Ele vai no cabeçalho `Authorization`, que é o que a documentação
 * recomenda e o que mantém a credencial fora de qualquer URL registrada — a mesma regra de
 * privacidade que este projeto já segue ("nunca ponha dado pessoal em query string").
 */
export function url(caminho, params = {}) {
  const limpo = String(caminho || '').replace(/^\/+/, '');
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  const cauda = qs.toString();
  return `${BASE_GRAPH}/${VERSAO_GRAPH}/${limpo}${cauda ? `?${cauda}` : ''}`;
}

/** As páginas que ele administra — e a SONDA desta aba. */
export function pedidoDePaginas() {
  return { metodo: 'GET', url: url('me/accounts', { fields: 'id,name,access_token,tasks', limit: 50 }) };
}

/**
 * As postagens da página.
 *
 * `published_posts` traz o que a PÁGINA publicou; `feed` traria também o que outros publicaram
 * nela, que não é o que ele pediu ("os comentários nas postagens do facebook" — as dele).
 */
export function pedidoDePosts(pageId, { depois = '' } = {}) {
  if (!pageId) return null;
  return {
    metodo: 'GET',
    url: url(`${pageId}/published_posts`, {
      fields: 'id,message,created_time,permalink_url,comments.summary(true).limit(0)',
      limit: POSTS_POR_PAGINA,
      after: depois,
    }),
  };
}

/**
 * Os comentários de uma postagem.
 *
 * **`filter=toplevel`**: as respostas a comentários vêm dentro de cada um, em `comments`, e não
 * soltas na lista — senão a resposta DELE apareceria como um comentário a responder.
 *
 * **`order=reverse_chronological`**: o mais novo primeiro, que é a ordem em que ele atende.
 */
export function pedidoDeComentarios(postId, { depois = '' } = {}) {
  if (!postId) return null;
  return {
    metodo: 'GET',
    url: url(`${postId}/comments`, {
      fields: 'id,message,created_time,like_count,from{id,name},comments.limit(10){id,message,created_time,from{id,name}}',
      filter: 'toplevel',
      order: 'reverse_chronological',
      limit: COMENTARIOS_POR_PAGINA,
      after: depois,
    }),
  };
}

/**
 * **A resposta a um comentário** — `POST` em `{comment-id}/comments`.
 *
 * Responder ao COMENTÁRIO e não à postagem é o que faz a resposta aparecer embaixo da pessoa, com
 * a notificação indo para ela. `POST` em `{post-id}/comments` criaria um comentário solto.
 */
export function pedidoDeResposta(comentarioId, texto) {
  const corpo = String(texto || '').trim();
  if (!comentarioId || !corpo) return null;
  return {
    metodo: 'POST',
    url: url(`${comentarioId}/comments`),
    corpo: { message: corpo.slice(0, MAX_RESPOSTA) },
  };
}

/**
 * **O que o Graph devolveu quando deu errado**, dito de um jeito que diz o que fazer.
 *
 * O corpo do erro é `{error: {message, type, code, error_subcode, fbtrace_id}}`, e o `message`
 * sozinho manda procurar no lugar errado quase sempre: *"Invalid OAuth access token"* não diz que
 * o token de página vence junto com o token de usuário que o gerou.
 */
export function traduzirErro(json, status = 0) {
  const e = json && json.error;
  if (!e) {
    if (status >= 500) return 'o Facebook respondeu com erro de servidor — tente de novo em alguns minutos.';
    if (status) return `o Facebook respondeu ${status} e não disse por quê.`;
    return '';
  }
  const codigo = Number(e.code) || 0;
  const sub = Number(e.error_subcode) || 0;
  const detalhe = String(e.message || '').trim();
  const fim = detalhe ? ` (${detalhe})` : '';

  if (codigo === 190) {
    if (sub === 463) return `o token EXPIROU${fim} — gere um novo token de página e cole no campo acima.`;
    if (sub === 467) return `o token foi INVALIDADO${fim} — isso acontece quando a senha do Facebook muda ou a sessão é encerrada. Gere outro.`;
    return `o token não foi aceito${fim} — confira se você colou o token da PÁGINA, e não o do usuário.`;
  }
  if (codigo === 200 || codigo === 10) {
    return `falta permissão${fim} — o token precisa de ${PERMISSOES.join(', ')}, e você precisa ser administrador da página.`;
  }
  if (codigo === 4 || codigo === 17 || codigo === 32 || codigo === 613) {
    return `o Facebook está limitando as chamadas${fim} — espere alguns minutos antes de carregar de novo.`;
  }
  if (codigo === 368) return `a página está temporariamente bloqueada para esta ação${fim}.`;
  if (codigo === 506) return `esta resposta é duplicada${fim} — o Facebook recusa o mesmo texto duas vezes seguidas.`;
  if (codigo === 100) return `o Facebook não entendeu o pedido${fim} — pode ser id de postagem errado, ou campo que esta versão da API não tem.`;
  return `o Facebook recusou${fim}${codigo ? ` [code ${codigo}${sub ? `/${sub}` : ''}]` : ''}.`;
}

/** `true` quando o erro é do TOKEN, que é o único que faz a aba inteira parar. */
export function ehErroDeToken(json) {
  const codigo = Number(json && json.error && json.error.code) || 0;
  return codigo === 190 || codigo === 102 || codigo === 467;
}

const texto = (v) => String(v == null ? '' : v);

/**
 * As páginas da sonda.
 *
 * **`tasks` diz o que ele pode fazer naquela página.** Sem `MODERATE` o token lê e não responde, e
 * o erro só apareceria na hora do envio — que é tarde. A lista marca cada página.
 */
export function lerPaginas(json) {
  const dados = json && Array.isArray(json.data) ? json.data : null;
  if (!dados) return { ok: false, erro: 'o Facebook não devolveu a lista de páginas no formato esperado.', paginas: [] };
  const paginas = dados
    .filter((p) => p && p.id)
    .map((p) => ({
      id: texto(p.id),
      nome: texto(p.name) || texto(p.id),
      token: texto(p.access_token),
      podeResponder: Array.isArray(p.tasks) ? p.tasks.includes('MODERATE') : null,
    }));
  return { ok: true, erro: '', paginas };
}

/** As postagens, já com a contagem de comentários quando o Graph a mandou. */
export function lerPosts(json) {
  const dados = json && Array.isArray(json.data) ? json.data : null;
  if (!dados) return { ok: false, erro: 'o Facebook não devolveu a lista de postagens no formato esperado.', posts: [], proxima: '' };
  const posts = dados
    .filter((p) => p && p.id)
    .map((p) => ({
      id: texto(p.id),
      texto: texto(p.message),
      quando: texto(p.created_time),
      link: texto(p.permalink_url),
      comentarios: Number(p.comments && p.comments.summary && p.comments.summary.total_count) || 0,
    }));
  return { ok: true, erro: '', posts, proxima: cursor(json) };
}

/** O cursor da próxima página, quando existe. */
function cursor(json) {
  const p = json && json.paging;
  if (!p) return '';
  if (p.cursors && p.cursors.after && p.next) return texto(p.cursors.after);
  return '';
}

/**
 * Os comentários de uma postagem, já sabendo quais **nós** já respondemos.
 *
 * **Quem responde é a PÁGINA**, então a resposta nossa é a que tem `from.id === pageId`. Sem o id
 * da página não dá para separar, e aí nada é marcado como respondido — erra para o lado de mostrar
 * demais, que é o lado barato: o oposto esconderia alguém esperando resposta.
 *
 * **O `from` pode vir VAZIO, e isso não é defeito.** Desde 2018 o Facebook não entrega a
 * identidade de quem comenta de um perfil pessoal, a menos que a pessoa tenha autorizado o app.
 * A tela diz "sem nome" em vez de inventar um.
 */
export function lerComentarios(json, pageId = '') {
  const dados = json && Array.isArray(json.data) ? json.data : null;
  if (!dados) return { ok: false, erro: 'o Facebook não devolveu os comentários no formato esperado.', comentarios: [], proxima: '' };
  const daPagina = texto(pageId);
  const comentarios = dados
    .filter((c) => c && c.id)
    .map((c) => {
      const respostas = (c.comments && Array.isArray(c.comments.data) ? c.comments.data : [])
        .filter((r) => r && r.id)
        .map((r) => ({
          id: texto(r.id),
          texto: texto(r.message),
          quando: texto(r.created_time),
          deQuem: texto(r.from && r.from.name),
          nossa: !!daPagina && texto(r.from && r.from.id) === daPagina,
        }));
      return {
        id: texto(c.id),
        texto: texto(c.message),
        quando: texto(c.created_time),
        curtidas: Number(c.like_count) || 0,
        deQuem: texto(c.from && c.from.name),
        deQuemId: texto(c.from && c.from.id),
        respostas,
        respondido: respostas.some((r) => r.nossa),
      };
    });
  return { ok: true, erro: '', comentarios, proxima: cursor(json) };
}

/**
 * **Os que ainda esperam resposta.** Comentário sem texto (só figura, só sticker) fica de fora:
 * não há o que responder, e é a mesma decisão de `ehSoReacao` no WhatsApp.
 */
export function semResposta(comentarios) {
  return (comentarios || []).filter((c) => c && !c.respondido && texto(c.texto).trim());
}

/**
 * **A resposta saiu mesmo?** O `POST` devolve `{id}`; qualquer outra coisa é 200 que não gravou —
 * a armadilha mais antiga deste projeto, agora numa API nova.
 */
export function respostaEntrou(json) {
  return !!(json && texto(json.id).trim());
}

/**
 * **Vale a pena perguntar à IA?** Comentário de uma palavra ("👏", "top", "amém") não precisa de
 * rascunho, e cada chamada é dinheiro. O corte é o mesmo espírito do vocabulário de despedida:
 * barato, e errando para o lado de NÃO gastar.
 */
export function pedeRascunho(comentario) {
  const t = texto(comentario && comentario.texto).trim();
  if (t.length < 12) return false;
  const palavras = t.split(/\s+/).filter((p) => /\p{L}/u.test(p));
  return palavras.length >= 3;
}
