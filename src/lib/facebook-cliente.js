/**
 * facebook-cliente.js — a ponte entre o painel e a Graph API.
 *
 * **O token nunca entra na página, e essa é a razão de este arquivo existir** — a mesma de
 * `ia-cliente.js`. O painel roda dentro da página do mobiliza, no mesmo navegador em que a
 * plataforma carrega o que quiser; token ali é token publicado. A requisição sai do **service
 * worker**, que tem as `host_permissions` e roda fora de qualquer página.
 *
 * **E o token de PÁGINA nunca volta para o painel.** Ele nasce dentro da resposta de
 * `/me/accounts`, então quem lê aquela resposta tem de ser o worker: ele guarda os tokens e
 * devolve ao painel só o id e o nome de cada página. Devolver a lista crua seria publicar o token
 * pelo caminho mais discreto possível — dentro de um JSON que ninguém olha.
 *
 * O painel usa `pedirAoFacebook()`. O service worker usa `atenderFacebook()`.
 */

import {
  pedidoDePaginas,
  lerPaginas,
  traduzirErro,
  ehErroDeToken,
} from './facebook.js';

export const MSG_FB = 'whatsfill-facebook';

/** Onde ficam as credenciais. Leitura direta no storage: credencial não passa por `store`. */
export const CHAVE_TOKEN_USUARIO = 'fbToken';
export const CHAVE_TOKENS_DE_PAGINA = 'fbPageTokens';

/**
 * **Os dois relógios, pelas duas formas de pendurar** — a lição de 08/09 com a IA: o `fetch` que
 * nunca volta, e o service worker do MV3 encerrado no meio da chamada, que deixa a promessa do
 * painel pendente para sempre. O da ponte é maior para o motivo específico chegar quando o worker
 * está vivo.
 */
export const TIMEOUT_FETCH_MS = 30000;
export const TIMEOUT_PONTE_MS = 45000;

/** O painel pede; o worker atende. */
export async function pedirAoFacebook(mensagem, prazo = TIMEOUT_PONTE_MS) {
  let acabou;
  const relogio = new Promise((res) => {
    acabou = setTimeout(
      () => res({ ok: false, motivo: 'o Facebook não respondeu a tempo (o serviço da extensão pode ter sido encerrado) — tente de novo' }),
      prazo
    );
  });
  try {
    return await Promise.race([chrome.runtime.sendMessage(mensagem), relogio]);
  } finally {
    clearTimeout(acabou);
  }
}

async function buscar(pedido, token) {
  const ctrl = new AbortController();
  const relogio = setTimeout(() => ctrl.abort(), TIMEOUT_FETCH_MS);
  try {
    const opcoes = {
      method: pedido.metodo || 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    };
    if (pedido.corpo) {
      opcoes.headers['Content-Type'] = 'application/json';
      opcoes.body = JSON.stringify(pedido.corpo);
    }
    const resp = await fetch(pedido.url, opcoes);
    let json = null;
    try {
      json = await resp.json();
    } catch {
      json = null;
    }
    return { status: resp.status, json };
  } finally {
    clearTimeout(relogio);
  }
}

/**
 * **O lado do service worker.**
 *
 * Três tipos de pedido, e o que os separa é de QUEM é o token:
 *
 *  - `paginas` — token do USUÁRIO. É a SONDA desta aba: falhando ela, nada mais é tentado, e a
 *    mensagem diz o que fazer. Guarda os tokens de página e devolve a lista sem eles.
 *  - `chamada` — token da PÁGINA escolhida. É por onde passam posts, comentários e a resposta.
 *  - `esquecer` — apaga tudo, para ele trocar de token sem resíduo.
 */
export async function atenderFacebook(msg) {
  const guardado = await chrome.storage.local.get([CHAVE_TOKEN_USUARIO, CHAVE_TOKENS_DE_PAGINA]);

  if (msg.acao === 'esquecer') {
    await chrome.storage.local.remove([CHAVE_TOKEN_USUARIO, CHAVE_TOKENS_DE_PAGINA]);
    return { ok: true, esquecido: true };
  }

  if (msg.acao === 'paginas') {
    const token = String(guardado[CHAVE_TOKEN_USUARIO] || '').trim();
    if (!token) return { ok: false, motivo: 'nenhum token salvo — cole o token no campo e salve.', semToken: true };
    const { status, json } = await buscar(pedidoDePaginas(), token);
    if (!json || json.error) {
      return { ok: false, motivo: traduzirErro(json, status), erroDeToken: ehErroDeToken(json) };
    }
    const lido = lerPaginas(json);
    if (!lido.ok) return { ok: false, motivo: lido.erro };
    /**
     * **Os tokens ficam aqui e não vão para o painel.** O que o painel recebe é id, nome e se
     * aquela página aceita moderar — o bastante para ele escolher, e nada mais.
     */
    const tokens = {};
    for (const p of lido.paginas) if (p.token) tokens[p.id] = p.token;
    await chrome.storage.local.set({ [CHAVE_TOKENS_DE_PAGINA]: tokens });
    return {
      ok: true,
      paginas: lido.paginas.map(({ id, nome, podeResponder }) => ({ id, nome, podeResponder, temToken: !!tokens[id] })),
    };
  }

  if (msg.acao === 'chamada') {
    const tokens = guardado[CHAVE_TOKENS_DE_PAGINA] || {};
    const token = String(tokens[msg.pageId] || '').trim();
    if (!token) {
      return { ok: false, motivo: 'não tenho o token desta página — clique em "Carregar as páginas" antes.', semToken: true };
    }
    if (!msg.pedido || !msg.pedido.url) return { ok: false, motivo: 'pedido vazio.' };
    const { status, json } = await buscar(msg.pedido, token);
    if (!json || json.error) {
      return { ok: false, motivo: traduzirErro(json, status), erroDeToken: ehErroDeToken(json) };
    }
    return { ok: true, json };
  }

  return { ok: false, motivo: `ação desconhecida: ${msg.acao}` };
}
