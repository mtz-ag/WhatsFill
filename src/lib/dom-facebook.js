/**
 * dom-facebook.js — UNICO arquivo que sabe como a pagina do Facebook e montada
 * por dentro. Se o Facebook mudar o layout, o conserto e aqui e em nenhum outro
 * lugar. E o irmao do `dom.js`, que faz o mesmo papel para o mobiliza.app.
 *
 * FATOS MEDIDOS AO VIVO em 19/10/2026, na pagina do Capitao Martim, logado como
 * a propria pagina. Nenhum deles foi deduzido:
 *
 *  - Comentario e resposta sao os dois `[role="article"][aria-label]`, e o
 *    `aria-label` diz TUDO, em duas formas:
 *      "Comentario de <AUTOR> ha <TEMPO>"
 *      "Resposta de <AUTOR> ao comentario de <PAI> ha <TEMPO>"
 *    A forma da RESPOSTA nomeia o comentario-pai, e e dai que sai o sinal
 *    "este comentario ja foi respondido".
 *
 *  - O "ha" aparece nas DUAS caixas ("Ha 4 minutos", "ha mais ou menos uma
 *    hora"), entao todo casamento aqui ignora caixa e acento.
 *
 *  - RESPONDIDO POR NOS exige o NOME DA PAGINA. Medido: existem respostas de
 *    terceiros ao comentario de outra pessoa ("Resposta de <X> ao comentario de
 *    <Y>") — isso NAO e resposta nossa, e trata-la como nossa deixaria o
 *    eleitor sem resposta. E o mesmo papel do `filter=toplevel` somado ao
 *    `from.id === pageId` do caminho da Graph API, em `facebook.js`.
 *
 *  - O NOME DA PAGINA se le do proprio DOM, sem token nenhum: o composer do
 *    post e `aria-label="Comente como <NOME DA PAGINA>"`.
 *
 *  - IDENTIDADE do comentario e o `comment_id` do href — e ele esta nos TRES
 *    links do article (a foto, o nome e o carimbo de hora). So o CARIMBO tem o
 *    post no pathname; os outros dois apontam para o PERFIL de quem comentou.
 *    Peguei o primeiro href com `comment_id` para abrir o post e cai no perfil
 *    de uma eleitora: o link do nome serve para identificar e NUNCA para abrir.
 *    O `aria-label` NAO e identidade: ele carrega o tempo, que muda sozinho
 *    ("Ha 4 minutos" vira "ha uma hora") — a familia do rotulo repetido do CRM,
 *    em que comparar pelo que a tela mostra nao identifica nada.
 *
 *  - O `comment_id` NAO e um numero: e base64 de `comment:<post>_<comentario>`
 *    (medido nos quatro comentarios de um post). Entao ele e opaco, serve para
 *    comparar e nunca para fazer conta — e um `parseInt` nele daria `NaN`.
 *
 *  - O CARIMBO COM O CAMINHO DO POST SO EXISTE NO FEED. Medido nos quatro
 *    comentarios do post aberto: `linkDoPost` devolveu null em todos, porque
 *    dentro do post os links do article apontam so para perfil — o permalink do
 *    post e a propria URL. Por isso `postDaPagina()` existe: quem precisa saber
 *    "de que post e este comentario" pergunta ao article (no feed) e cai na
 *    pagina (no post aberto).
 *
 *  - A CAIXA DE RESPOSTA nasce do clique no `[role="button"]` de texto
 *    "Responder" DENTRO do article, e vem
 *    `[contenteditable="true"][data-lexical-editor]` com
 *    `aria-label="Responder a <AUTOR>"`, ja focada.
 *
 *  - ELA JA VEM COM A MENCAO DENTRO. Entao escrever ali e ACRESCENTAR no fim,
 *    nunca atribuir: substituir apagaria a mencao e a resposta sairia sem
 *    marcar a pessoa.
 *
 *  - HA VARIAS CAIXAS NA TELA AO MESMO TEMPO (medidas 3: a da resposta e dois
 *    composers "Comente como ..."). `querySelector('[contenteditable]')` pega a
 *    errada — a caixa certa se acha pelo NOME no `aria-label`.
 *
 *  - INSERIR FUNCIONA, APAGAR NAO. `document.execCommand('insertText')` com o
 *    cursor colapsado no fim entra e preserva a mencao. No mesmo teste,
 *    `selectAll` + `delete` nao apagou nada, e `delete` colapsado comeu UM
 *    caractere de CADA ponta ("... Mendes teste" -> "... Mende test"). Por isso
 *    esta biblioteca NAO LIMPA caixa: ela so acrescenta, e quem desfaz e ele,
 *    com o teclado. Para limpar de verdade, o unico caminho medido e recarregar
 *    a pagina, o que descarta o rascunho da resposta.
 *
 *  - O DOM E VIRTUALIZADO. No feed da pagina, nunca mais de QUATRO articles
 *    existem ao mesmo tempo (12 comentarios acumulados em 14 rolagens, com 30
 *    posts na arvore e quase todos VAZIOS). Nao ha como montar a lista de
 *    "todos os comentarios sem resposta" pelo feed: a rodada trabalha no POST
 *    ABERTO e sobre o que esta na arvore AGORA.
 *
 *  - "MAIS RELEVANTES" E O PADRAO E ESCONDE GENTE. Medido no post aberto: o
 *    botao de comentar dizia 4 e o DOM tinha 3. Quem confiar na lista tem de
 *    compara-la com a contagem — e por isso `contagemDoPost` existe.
 *
 *  - O `aria-label` que comeca com "Excluir, ocultar ou denunciar" so aparece
 *    para quem administra: e a confirmacao de que estamos como a pagina.
 *
 * Nada aqui PUBLICA. Nenhuma funcao deste arquivo aperta Enter nem clica em
 * "Comentar": a ultima tecla e dele, que e a fronteira que ele pediu em 16/10
 * ("eu abro o post e mando a extensao inserir o texto na caixa de resposta e eu
 * envio e a extensao segue para o proximo").
 */

/* ------------------------------------------------------------------ *
 * A parte PURA: interpretar o rotulo. Tem teste proprio, porque e ela *
 * que decide quem fica sem resposta.                                  *
 * ------------------------------------------------------------------ */

const semAcento = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** O separador do tempo no fim do rotulo: "ha", "Ha", "ha mais ou menos". */
const HA = String.raw`\s+h[aá]\s`;

const RE_COMENTARIO = new RegExp(String.raw`^coment[aá]rio\s+de\s+(.+?)${HA}`, 'i');
const RE_RESPOSTA = new RegExp(
  String.raw`^resposta\s+de\s+(.+?)\s+ao\s+coment[aá]rio\s+de\s+(.+?)${HA}`,
  'i'
);

/**
 * Le o `aria-label` de um article e diz o que ele e.
 *
 * Devolve null para rotulo que nao e comentario nem resposta: o feed tem
 * article de outras coisas, e tratar rotulo desconhecido como comentario faria
 * a rodada procurar caixa onde nao ha caixa.
 */
export function lerRotulo(label) {
  const texto = String(label || '').trim();
  if (!texto) return null;

  const resp = RE_RESPOSTA.exec(texto);
  if (resp) return { tipo: 'resposta', autor: resp[1].trim(), respondeA: resp[2].trim() };

  const com = RE_COMENTARIO.exec(texto);
  if (com) return { tipo: 'comentario', autor: com[1].trim(), respondeA: null };

  return null;
}

/** Os dois nomes batem? Sem acento e sem caixa, como o resto do projeto. */
export function mesmoNome(a, b) {
  const x = semAcento(a).toLowerCase().replace(/\s+/g, ' ').trim();
  const y = semAcento(b).toLowerCase().replace(/\s+/g, ' ').trim();
  return !!x && x === y;
}

/**
 * Dada a lista de rotulos de um post e o nome da pagina, quais comentarios de
 * primeiro nivel ainda NAO foram respondidos por NOS.
 *
 * Resposta de terceiro nao conta — foi medido que ela existe, e conta-la
 * deixaria o eleitor sem resposta parecendo atendido.
 *
 * Sem o nome da pagina nao da para saber de quem e a resposta: devolve todos,
 * para errar MOSTRANDO demais, que e o lado barato — a mesma escolha que
 * `facebook.lerComentarios` faz quando nao tem o pageId.
 */
export function semRespostaNossa(rotulos, nomeDaPagina = '') {
  const lidos = (rotulos || []).map(lerRotulo).filter(Boolean);
  const comentarios = lidos.filter((r) => r.tipo === 'comentario');

  if (!nomeDaPagina) return comentarios;

  const respondidos = lidos
    .filter((r) => r.tipo === 'resposta' && mesmoNome(r.autor, nomeDaPagina))
    .map((r) => r.respondeA);

  return comentarios.filter((c) => !respondidos.some((pai) => mesmoNome(pai, c.autor)));
}

/**
 * As linhas que o `innerText` do article traz junto do texto e que NAO sao do
 * comentario. Medido na pagina: o article rende
 *   "<AUTOR> | <TEXTO> | 7 min | Curtir | Responder | Enviar mensagem | Ocultar"
 * Lista de PERMISSAO ao contrario: o que esta aqui sai, e o resto FICA — porque
 * errar para o lado de deixar sobra e barato (ele le na tela), e errar para o
 * lado de apagar comeria a fala do eleitor.
 */
const LINHA_DE_BOTAO =
  /^(curtir|responder|enviar mensagem|ocultar|editado|ver tradu[cç][aã]o|traduzir|ver mais|top f[aã]|autor|segue|seguir|denunciar|excluir|responder·)$/i;

/** "7 min", "1 h", "2 d", "3 sem", "Ha 4 minutos", "12 de outubro". */
const LINHA_DE_TEMPO =
  /^(h[aá]\s+.+|\d+\s*(s|seg|segundos?|m|min|minutos?|h|horas?|d|dias?|sem|semanas?|a|anos?)|\d{1,2} de [a-zà-ú]+( de \d{4})?)$/i;

/**
 * O que a pessoa ESCREVEU, tirado do `innerText` do article.
 *
 * Fica separado do DOM de proposito: e a funcao que decide o que vai para a IA
 * e para a tela, e tem teste.
 */
export function limparTextoDoComentario(innerText, autor = '') {
  const linhas = String(innerText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const uteis = [];
  for (const linha of linhas) {
    if (autor && mesmoNome(linha, autor)) continue; // o nome de quem comentou
    if (LINHA_DE_BOTAO.test(linha)) continue;
    if (LINHA_DE_TEMPO.test(linha)) continue;
    uteis.push(linha);
  }
  return uteis.join('\n').trim();
}

/* ------------------------------------------------------------------ *
 * A partir daqui e DOM: roda na aba do Facebook.                      *
 * ------------------------------------------------------------------ */

/**
 * Os pathnames que sao um POST, e nao um perfil. Lista de PERMISSAO.
 *
 * Tem de casar as DUAS formas, e eu medi so uma: o reel mora na RAIZ
 * (`/reel/<id>`) e o post da pagina mora embaixo dela
 * (`/capitaomartim/posts/<id>`). O primeiro padrao que escrevi exigia a raiz e
 * teria deixado de fora justamente o post comum de foto e texto — quem pegou
 * foi o teste, nao a medicao.
 *
 * O segmento tem de ser INTEIRO (`(^|\/)` ... `(\/|$)`): sem isso um perfil
 * chamado `/joana.videos.123` passaria por post.
 */
const CAMINHO_DE_POST =
  /(^|\/)(reel|reels|posts|videos|photos|photo|watch|permalink\.php|story\.php)(\/|$)/i;

export function articles(raiz = document) {
  return [...raiz.querySelectorAll('[role="article"][aria-label]')];
}

/** O nome da pagina, lido do composer. Sem ele nao ha sinal de "ja respondi". */
export function nomeDaPagina(raiz = document) {
  const alvo = [...raiz.querySelectorAll('[aria-label]')]
    .map((e) => e.getAttribute('aria-label') || '')
    .find((l) => /^comente como\s+/i.test(l));
  return alvo ? alvo.replace(/^comente como\s+/i, '').trim() : '';
}

/** Somos admin desta pagina? O menu de moderacao so existe para quem e. */
export function somosAdmin(raiz = document) {
  return [...raiz.querySelectorAll('[aria-label]')].some((e) =>
    /^excluir, ocultar ou denunciar/i.test(e.getAttribute('aria-label') || '')
  );
}

/**
 * O `comment_id` deste article. Vem de qualquer um dos tres links; o do NOME
 * serve, e e o mais facil de achar.
 */
export function idDoComentario(art) {
  for (const a of art.querySelectorAll('a[href]')) {
    try {
      const u = new URL(a.getAttribute('href'), location.origin);
      const reply = u.searchParams.get('reply_comment_id');
      if (reply) return reply;
      const id = u.searchParams.get('comment_id');
      if (id) return id;
    } catch (e) {
      /* href relativo esquisito: segue para o proximo */
    }
  }
  return null;
}

/**
 * O link do POST deste comentario (o carimbo de hora). Diferente do link do
 * NOME, que vai para o perfil de quem comentou — confundir os dois me levou ao
 * perfil de uma eleitora em vez do post.
 *
 * Devolve null DENTRO de um post aberto, e isso e o normal: ali os links do
 * article sao so de perfil, porque o permalink do post e a propria URL. Quem
 * precisa do post usa `postDaPagina()` como segunda porta.
 */
export function linkDoPost(art) {
  for (const a of art.querySelectorAll('a[href]')) {
    try {
      const u = new URL(a.getAttribute('href'), location.origin);
      if (CAMINHO_DE_POST.test(u.pathname)) return u;
    } catch (e) {
      /* idem */
    }
  }
  return null;
}

/** Estamos DENTRO de um post? Devolve o caminho dele, ou null se e o feed. */
export function postDaPagina(href = location.pathname) {
  return CAMINHO_DE_POST.test(href) ? href : null;
}

/**
 * De que post e este comentario: o carimbo (no feed) ou a pagina (no post
 * aberto). Uma funcao so, porque duas leituras separadas discordariam.
 */
export function postDoComentario(art) {
  const link = linkDoPost(art);
  if (link) return link.pathname;
  return postDaPagina();
}

/** Quantos comentarios o post DIZ ter. Serve para desconfiar da lista. */
export function contagemDoPost(raiz = document) {
  const btn = [...raiz.querySelectorAll('[aria-label]')].find((e) =>
    /^(comentar|deixe um coment[aá]rio)$/i.test(e.getAttribute('aria-label') || '')
  );
  if (!btn) return null;
  const n = parseInt(String(btn.innerText || '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

/** A ordenacao esta escondendo comentario? "Mais relevantes" e o padrao. */
export function ordenacaoEsconde(raiz = document) {
  return [...raiz.querySelectorAll('[role="button"]')].some((b) =>
    /^mais relevantes$/i.test(String(b.innerText || '').trim())
  );
}

/** O comentario inteiro, pronto para a tela e para a IA. */
export function lerComentario(art) {
  const dados = lerRotulo(art.getAttribute('aria-label'));
  if (!dados) return null;
  return {
    id: idDoComentario(art),
    tipo: dados.tipo,
    autor: dados.autor,
    respondeA: dados.respondeA,
    texto: limparTextoDoComentario(art.innerText, dados.autor),
    no: art,
  };
}

/**
 * Os comentarios de primeiro nivel ainda sem resposta NOSSA, nesta tela.
 *
 * "Nesta tela" e literal e nao e descuido: o DOM e virtualizado, entao esta
 * lista e o que existe AGORA — compare sempre com `contagemDoPost()` antes de
 * dizer a ele que acabou.
 */
export function comentariosSemResposta(raiz = document) {
  const arts = articles(raiz);
  const pagina = nomeDaPagina(raiz);
  const lidos = arts.map(lerComentario).filter(Boolean);

  const respondidos = lidos
    .filter((c) => c.tipo === 'resposta' && pagina && mesmoNome(c.autor, pagina))
    .map((c) => c.respondeA);

  return lidos.filter(
    (c) =>
      c.tipo === 'comentario' &&
      c.texto &&
      !(pagina && mesmoNome(c.autor, pagina)) && // o que NOS comentamos nao e fila
      !respondidos.some((pai) => mesmoNome(pai, c.autor))
  );
}

/** O botao "Responder" DESTE comentario. */
export function botaoResponder(art) {
  return (
    [...art.querySelectorAll('[role="button"]')].find(
      (b) => String(b.innerText || '').trim().toLowerCase() === 'responder'
    ) || null
  );
}

/**
 * A caixa de resposta ABERTA para este autor. O nome no `aria-label` e
 * obrigatorio: medi tres caixas na tela ao mesmo tempo, e pegar a primeira
 * escreveria a resposta no composer de outro post.
 */
export function caixaDeResposta(autor, raiz = document) {
  const caixas = [...raiz.querySelectorAll('[contenteditable="true"][data-lexical-editor]')];
  return (
    caixas.find((c) => {
      const l = c.getAttribute('aria-label') || '';
      if (!/^responder a\s+/i.test(l)) return false;
      return !autor || mesmoNome(l.replace(/^responder a\s+/i, ''), autor);
    }) || null
  );
}

/**
 * ACRESCENTA texto no fim da caixa. Nunca substitui, porque a mencao da pessoa
 * ja esta la. Nao aperta Enter e nao clica em nada: quem envia e ele.
 *
 * O caminho e `execCommand('insertText')` porque a caixa e Lexical — atribuir
 * `innerText` nao chega ao estado do editor, e o texto some no primeiro toque
 * de tecla. Medido funcionando, com a mencao preservada.
 */
export function inserirNaCaixa(caixa, texto) {
  if (!caixa || !texto) return false;

  caixa.focus();

  const sel = window.getSelection();
  const r = document.createRange();
  r.selectNodeContents(caixa);
  r.collapse(false); // o FIM: depois da mencao
  sel.removeAllRanges();
  sel.addRange(r);

  const antes = String(caixa.innerText || '');
  const entrou = document.execCommand('insertText', false, texto);
  const depois = String(caixa.innerText || '');

  // O 200 que mente tem irmao aqui: `execCommand` devolve true sem o Lexical
  // ter aceitado. A verdade e a caixa relida.
  return entrou && depois !== antes && depois.includes(texto.slice(0, 20));
}
