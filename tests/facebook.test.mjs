/**
 * facebook.test.mjs — os comentários da página, e a resposta a eles.
 *
 * **As rotas foram LIDAS na documentação, não executadas** (16/10/2026), que é a situação de
 * `listContacts` e `createTag` em 20/08. O que este arquivo pode provar é o que não depende da
 * rede: a URL montada, a leitura do que volta, o erro traduzido e as guardas. O que só a execução
 * responde está dito no registro, e a primeira chamada da aba é uma SONDA.
 */

import './_harness.mjs';
import {
  VERSAO_GRAPH,
  BASE_GRAPH,
  PERMISSOES,
  url,
  pedidoDePaginas,
  pedidoDePosts,
  pedidoDeComentarios,
  pedidoDeResposta,
  traduzirErro,
  ehErroDeToken,
  lerPaginas,
  lerPosts,
  lerComentarios,
  semResposta,
  respostaEntrou,
  pedeRascunho,
  MAX_RESPOSTA,
} from '../src/lib/facebook.js';

let falhas = 0;
const check = (cond, nome) => {
  if (cond) console.log(`  ok   ${nome}`);
  else {
    falhas++;
    console.log(` FALHA ${nome}`);
  }
};
const grupo = (nome) => console.log(`\n${nome}`);

grupo('a URL leva a versão, e o token NUNCA entra nela');
{
  const u = url('me/accounts', { fields: 'id,name', limit: 50 });
  check(u.startsWith(`${BASE_GRAPH}/${VERSAO_GRAPH}/`), 'base e versão explícitas');
  /**
   * **Caminho sem versão cai na mais ANTIGA ainda disponível**, que é a primeira a ser desligada:
   * o sintoma seria a aba parar num dia qualquer sem ninguém ter mexido em nada.
   */
  check(/\/v\d+\.\d+\//.test(u), 'a versão vai escrita na URL');
  check(u.includes('fields=id%2Cname') || u.includes('fields=id,name'), 'os campos vão na query');
  check(!/access_token|Bearer|token=/i.test(u), 'nenhum token na URL');

  /** Valor vazio não vira `&after=`: o Graph trata string vazia como cursor inválido. */
  check(!url('x/comments', { after: '' }).includes('after='), 'parâmetro vazio não entra');
  check(url('/me/accounts').includes('/me/accounts'), 'barra sobrando no caminho não duplica');
}

grupo('os quatro pedidos');
{
  const paginas = pedidoDePaginas();
  check(paginas.metodo === 'GET' && paginas.url.includes('me/accounts'), 'as páginas são a sonda, e é um GET');
  check(paginas.url.includes('tasks'), 'pede `tasks`, que é quem diz se o token pode MODERAR');

  const posts = pedidoDePosts('123');
  check(posts.url.includes('123/published_posts'), 'as postagens são as PUBLICADAS pela página');
  /**
   * `feed` traria também o que outros publicaram na página, que não é o que ele pediu — e cada um
   * desses viraria uma linha para atender.
   */
  check(!posts.url.includes('/feed'), 'e não o `feed`, que traz o que outros publicaram');
  check(posts.url.includes('summary'), 'pede o total de comentários, para ele escolher por onde começar');
  check(pedidoDePosts('') === null, 'sem id de página não monta pedido nenhum');

  const coment = pedidoDeComentarios('p_1');
  check(coment.url.includes('p_1/comments'), 'os comentários são os da postagem');
  check(coment.url.includes('filter=toplevel'), 'só os de primeiro nível');
  /**
   * **Sem `toplevel`, a nossa própria resposta voltaria na lista como um comentário a responder** —
   * e a aba pediria para ele responder a si mesmo, todo dia.
   */
  check(coment.url.includes('order=reverse_chronological'), 'do mais novo para o mais velho');
  check(/comments\.limit\(\d+\)/.test(decodeURIComponent(coment.url)), 'traz as respostas de cada um, que é como se sabe o que já foi respondido');

  const resp = pedidoDeResposta('c_1', '  oi  ');
  check(resp.metodo === 'POST' && resp.url.includes('c_1/comments'), 'responder é POST no COMENTÁRIO');
  /**
   * POST na POSTAGEM criaria um comentário solto, sem notificar quem escreveu — a resposta
   * apareceria no fim da lista, longe da pessoa.
   */
  check(resp.corpo.message === 'oi', 'o texto vai aparado');
  check(pedidoDeResposta('c_1', '   ') === null, 'resposta vazia não monta pedido');
  check(pedidoDeResposta('', 'oi') === null, 'sem id de comentário também não');
  check(pedidoDeResposta('c_1', 'a'.repeat(MAX_RESPOSTA + 500)).corpo.message.length === MAX_RESPOSTA, 'texto gigante é cortado antes de sair');
}

grupo('o erro do Graph vira o que FAZER');
{
  const err = (code, error_subcode, message = '') => ({ error: { code, error_subcode, message } });

  check(/token da P[ÁA]GINA|expirou|INVALIDADO/i.test(traduzirErro(err(190))), '190 fala do token');
  check(/EXPIROU/.test(traduzirErro(err(190, 463))), '190/463 diz que expirou');
  check(/senha|sess[ãa]o/i.test(traduzirErro(err(190, 467))), '190/467 diz por que foi invalidado');
  /** A mensagem crua do Facebook ("Invalid OAuth access token") manda procurar no lugar errado. */
  check(traduzirErro(err(200)).includes(PERMISSOES[0]), '200 nomeia as permissões que faltam');
  check(/administrador/.test(traduzirErro(err(200))), 'e lembra que ele precisa ser admin da página');
  check(/limitando/.test(traduzirErro(err(4))), '4 é limite de chamadas');
  check(/limitando/.test(traduzirErro(err(17))), '17 também');
  check(/duplicada/.test(traduzirErro(err(506))), '506 é a resposta repetida');
  check(/n[ãa]o entendeu/.test(traduzirErro(err(100))), '100 é pedido malformado');
  check(/code 999/.test(traduzirErro(err(999))), 'código desconhecido aparece escrito, para dar para procurar');

  /** Sem corpo de erro, o status é tudo o que há — e 500 do Facebook passa sozinho. */
  check(/servidor/.test(traduzirErro(null, 503)), '5xx sem corpo vira "erro de servidor"');
  check(traduzirErro(null, 0) === '', 'sem erro e sem status, não inventa mensagem');

  check(ehErroDeToken(err(190)) === true, '190 para a aba inteira');
  check(ehErroDeToken(err(200)) === false, '200 não: é permissão, não token');
  check(ehErroDeToken(null) === false, 'nada não é erro de token');
}

grupo('ler as páginas, e os tokens');
{
  const json = {
    data: [
      { id: '1', name: 'Página A', access_token: 'T1', tasks: ['MODERATE', 'ANALYZE'] },
      { id: '2', name: 'Página B', access_token: 'T2', tasks: ['ANALYZE'] },
      { id: '3' },
      null,
    ],
  };
  const r = lerPaginas(json);
  check(r.ok && r.paginas.length === 3, 'as três com id entram, a nula sai');
  check(r.paginas[0].podeResponder === true, 'MODERATE é quem pode responder');
  check(r.paginas[1].podeResponder === false, 'sem MODERATE, é só leitura');
  /**
   * **`tasks` ausente não é "não pode"** — seria a tela afirmando o que não leu, e a aba barraria
   * uma página que funciona. É a lição do `undefined !== 'CONNECTED'` (01/10).
   */
  check(r.paginas[2].podeResponder === null, 'sem `tasks`, não se afirma nada');
  check(r.paginas[2].nome === '3', 'página sem nome cai no id, em vez de ficar em branco');

  check(lerPaginas({}).ok === false, 'formato inesperado NÃO vira lista vazia silenciosa');
  check(lerPaginas(null).paginas.length === 0, 'e devolve lista vazia junto do erro');
}

grupo('ler as postagens');
{
  const json = {
    data: [
      { id: 'p1', message: 'Olá', created_time: '2026-10-16T12:00:00+0000', permalink_url: 'u', comments: { summary: { total_count: 7 } } },
      { id: 'p2' },
    ],
    paging: { cursors: { after: 'CUR' }, next: 'https://x' },
  };
  const r = lerPosts(json);
  check(r.ok && r.posts.length === 2, 'as duas entram');
  check(r.posts[0].comentarios === 7, 'o total de comentários vem do summary');
  check(r.posts[1].comentarios === 0, 'sem summary, zero — e não "desconhecido"');
  check(r.proxima === 'CUR', 'o cursor da próxima página');
  /** Sem `next` não há próxima: devolver o cursor faria a tela oferecer uma página que não existe. */
  check(lerPosts({ data: [], paging: { cursors: { after: 'X' } } }).proxima === '', 'cursor sem `next` não conta');
  check(lerPosts({}).ok === false, 'formato inesperado acusa');
}

grupo('ler os comentários, e saber quais JÁ respondemos');
{
  const json = {
    data: [
      {
        id: 'c1',
        message: 'Parabéns!',
        created_time: '2026-10-16T12:00:00+0000',
        like_count: 3,
        from: { id: 'u9', name: 'Fulana' },
        comments: { data: [{ id: 'r1', message: 'Obrigado!', from: { id: 'PAG', name: 'Página' } }] },
      },
      { id: 'c2', message: 'E o material?', from: { id: 'u8', name: 'Beltrano' } },
      { id: 'c3', message: '', from: { id: 'u7' } },
      { id: 'c4', message: 'Alguém responde?', comments: { data: [{ id: 'r2', message: 'eu também quero', from: { id: 'u6', name: 'Outro' } }] } },
    ],
  };
  const r = lerComentarios(json, 'PAG');
  check(r.ok && r.comentarios.length === 4, 'os quatro entram');
  check(r.comentarios[0].respondido === true, 'respondido é o que tem resposta NOSSA');
  check(r.comentarios[1].respondido === false, 'sem resposta nenhuma, não respondido');
  /**
   * **Resposta de outra pessoa não conta como nossa** — senão a discussão entre dois eleitores
   * esconderia da aba quem está esperando o mandato.
   */
  check(r.comentarios[3].respondido === false, 'resposta de terceiro não conta');
  check(r.comentarios[3].respostas[0].nossa === false, 'e vem marcada como não nossa');

  /**
   * **O `from` pode vir VAZIO, e isso não é defeito**: desde 2018 o Facebook não entrega a
   * identidade de quem comenta de um perfil pessoal sem autorização do app.
   */
  check(r.comentarios[3].deQuem === '', 'sem `from`, nome vazio — a tela escreve "sem nome"');
  check(r.comentarios[2].deQuem === '', 'nome ausente no `from` também');

  /** **Sem o id da página não dá para separar**, e aí nada é marcado: erra para MOSTRAR demais. */
  const semPagina = lerComentarios(json, '');
  check(semPagina.comentarios[0].respondido === false, 'sem o id da página, nada é dado como respondido');

  check(lerComentarios({}).ok === false, 'formato inesperado acusa');
}

grupo('quem ainda espera resposta');
{
  const lista = [
    { id: 'a', texto: 'pergunta', respondido: false },
    { id: 'b', texto: 'ja respondido', respondido: true },
    { id: 'c', texto: '   ', respondido: false },
    { id: 'd', texto: '', respondido: false },
  ];
  const abertos = semResposta(lista);
  check(abertos.length === 1 && abertos[0].id === 'a', 'só o que tem texto e não foi respondido');
  /**
   * Comentário sem texto é figura ou sticker: não há o que responder, e é a mesma decisão de
   * `ehSoReacao` no WhatsApp.
   */
  check(semResposta(null).length === 0, 'lista nula não quebra');
}

grupo('o POST gravou mesmo?');
{
  /** **O 200 não prova que gravou** — a armadilha mais antiga deste projeto, numa API nova. */
  check(respostaEntrou({ id: '123_456' }) === true, 'com id, entrou');
  check(respostaEntrou({}) === false, 'sem id, NÃO entrou');
  check(respostaEntrou({ id: '  ' }) === false, 'id em branco também não');
  check(respostaEntrou(null) === false, 'resposta ilegível não conta como enviada');
}

grupo('quando vale pagar um rascunho da IA');
{
  check(pedeRascunho({ texto: 'Qual a posição de vocês sobre a reforma?' }) === true, 'pergunta de verdade pede rascunho');
  /** Cada chamada é dinheiro, e o aplauso não precisa de texto nenhum. */
  check(pedeRascunho({ texto: '👏' }) === false, 'emoji sozinho não');
  check(pedeRascunho({ texto: 'top' }) === false, 'uma palavra não');
  check(pedeRascunho({ texto: 'Amém amém amém' }) === true, 'três palavras já passam — o corte é barato de propósito');
  check(pedeRascunho({ texto: '' }) === false, 'vazio não');
  check(pedeRascunho(null) === false, 'nulo não quebra');
}

console.log(`\n=== falhas: ${falhas} ===`);
if (falhas) process.exitCode = 1;
