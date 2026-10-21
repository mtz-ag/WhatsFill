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
 * **PARA no primeiro marcador em vez de peneirar linha a linha**, e isso e um
 * conserto de 19/10: peneirando, a CONTAGEM DE REACOES entrava no texto (ele
 * viu um comentario com o texto certo e um `1` solto embaixo).
 * Ela vem DEPOIS da fileira de botoes, junto com "Ver traducao" e "Editado" —
 * tudo o que vier dali para baixo nao e do comentario.
 *
 * O texto sempre mora ENTRE o nome e o tempo, e e so isso que se coleta.
 * Medido: `"22"` com `"22 min"` embaixo sai certo, porque o corte e da linha
 * INTEIRA — `"22"` nao e tempo, `"22 min"` e.
 */
export function limparTextoDoComentario(innerText, autor = '') {
  const linhas = String(innerText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const uteis = [];
  for (const linha of linhas) {
    if (autor && mesmoNome(linha, autor)) continue; // o nome de quem comentou
    if (LINHA_DE_TEMPO.test(linha) || LINHA_DE_BOTAO.test(linha)) break; // acabou o texto
    uteis.push(linha);
  }
  return uteis.join('\n').trim();
}

/**
 * Entre varios candidatos aninhados, o MAIS INTERNO — o que nao contem nenhum
 * outro. Puro para ter teste: e ele que decide de qual caixa o painel le.
 */
export function maisInterno(candidatos) {
  const lista = (candidatos || []).filter(Boolean);
  if (!lista.length) return null;
  return (
    lista.find((d) => !lista.some((o) => o !== d && d.contains && d.contains(o))) ||
    lista[lista.length - 1]
  );
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

/** Tem composer de pagina aqui dentro? E o que marca o bloco de um post. */
function temComposer(no) {
  return [...no.querySelectorAll('[aria-label]')].some((e) =>
    /^comente como\s+/i.test(e.getAttribute('aria-label') || '')
  );
}

/**
 * A RAIZ de onde ler: o post aberto, e nada alem dele.
 *
 * **Esta funcao existe por causa de um defeito que foi ao ar** (19/10/2026):
 * *"ele inseriu na pagina na timeline, eu queria dentro do post"*. Clicando na
 * contagem de comentarios, o Facebook abre o post num **modal**, e a timeline
 * continua viva ATRAS dele. Medido: **9 articles no `document` e 7 no modal** —
 * os outros dois eram comentarios de posts da linha do tempo, que apareciam na
 * lista e faziam a resposta ser inserida na caixa errada.
 *
 * Sao DOIS `[role="dialog"]` aninhados (medidos 1351x633 e 700x569), os dois
 * com os mesmos comentarios dentro; pega-se o **mais interno**, que e o mais
 * especifico.
 *
 * Sem modal, vale a pagina inteira quando a URL e de um post. E `null` na linha
 * do tempo: ali nao ha post aberto, e e justamente onde ler o `document`
 * misturaria tudo.
 */
export function raizDoPost(doc = document) {
  const candidatos = [...doc.querySelectorAll('[role="dialog"]')].filter(
    (d) => d.querySelector('[role="article"][aria-label]') || temComposer(d)
  );
  const modal = maisInterno(candidatos);
  if (modal) return modal;
  return postDaPagina() ? doc : null;
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

/**
 * A ordenacao esta escondendo comentario? "Mais relevantes" e o padrao do Facebook.
 *
 * **Isto NAO e mais um aviso** (20/10/2026): ele decidiu trabalhar nos relevantes — *"nao tem
 * problema estar nos relevantes pois quero responder eles e nao todos"*. O painel usa esta funcao
 * para decidir **se cita o total do post**: com a ordenacao filtrando, dizer "o post tem 42"
 * compara a lista com um conjunto que ele nao quer percorrer.
 */
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
 * **Todos os comentarios de primeiro nivel desta tela, cada um dizendo se JA TEM resposta
 * nossa** (`respondido`).
 *
 * Ate 20/10/2026 esta conta existia so para DESCARTAR os respondidos. Ele pediu para ve-los —
 * *"troque a cor dos que receberam resposta na lista para amarelo"* —, e devolver a marca em vez
 * de jogar fora nao custa leitura nenhuma: `respondidos` ja era calculado aqui.
 *
 * **"Nesta tela" e literal e nao e descuido:** o DOM e virtualizado, entao esta lista e o que
 * existe AGORA — compare sempre com `contagemDoPost()` antes de dizer a ele que acabou.
 *
 * **Sem o nome da pagina, `respondido` e sempre falso** — e nao e engano: nao da para saber quem
 * respondeu, e marcar de amarelo por chute esconderia da fila quem nunca foi atendido. O painel
 * avisa em amarelo quando isso acontece.
 */
export function comentariosDoPost(raiz = document) {
  const arts = articles(raiz);
  const pagina = nomeDaPagina(raiz);
  const lidos = arts.map(lerComentario).filter(Boolean);

  const respondidos = lidos
    .filter((c) => c.tipo === 'resposta' && pagina && mesmoNome(c.autor, pagina))
    .map((c) => c.respondeA);

  return lidos
    .filter(
      (c) =>
        c.tipo === 'comentario' &&
        c.texto &&
        !(pagina && mesmoNome(c.autor, pagina)) // o que NOS comentamos nao e fila
    )
    .map((c) => ({
      ...c,
      /**
       * **Duas fontes, e a segunda e a que a print de 20/10 obrigou.** A resposta de verdade
       * (`respondidos`) so existe depois de alguem EXPANDIR; enquanto isso, o Facebook ja diz
       * "<pagina> respondeu · 1 resposta" em texto colapsado. Sem a segunda, o amarelo so
       * apareceria depois de ler o post inteiro.
       */
      respondido:
        respondidos.some((pai) => mesmoNome(pai, c.autor)) || respostaNossaColapsada(c.no, pagina),
    }));
}

/**
 * Os que ainda esperam resposta — a mesma leitura, peneirada.
 *
 * **Uma fonte de verdade:** duas varreduras separadas divergiriam na primeira correcao, e a
 * divergencia aqui seria a lista mostrando como pendente quem o painel considera respondido.
 */
export function comentariosSemResposta(raiz = document) {
  return comentariosDoPost(raiz).filter((c) => !c.respondido);
}

/**
 * **OS BOTOES QUE REVELAM MAIS: "Ver mais comentarios", "1 resposta", "Ver mais respostas".**
 *
 * Nasceu da print dele de 20/10/2026, que mostrou a causa do amarelo nao aparecer: embaixo do
 * comentario da eleitora estava **"Capitao Martim respondeu · 1 resposta"**, COLAPSADO. O Facebook
 * so cria o `[role="article"]` da resposta depois do clique — entao, sem expandir, `respondido` e
 * falso para todo mundo e **nada fica amarelo**. E a mesma razao de ele estar rolando a mao.
 *
 * **O rotulo nao e medido, e por isso a lista e larga e a PROVA e o efeito:** quem chama clica e
 * mede se apareceram mais articles. Acertar o texto exato de cada botao do Facebook e adivinhacao
 * que envelhece na primeira traducao; contar o que apareceu, nao.
 *
 * **O teto de 40 caracteres e a guarda** — sem ele, um comentario que por acaso seja um
 * `role="button"` entraria na lista e o painel clicaria no que o eleitor escreveu.
 */
const REVELAM = [
  // Largo porque a redacao varia: "Ver mais comentarios", "Ver 30 comentarios anteriores",
  // "Ver todos os comentarios". O que todas tem e "ver … coment".
  /\bver\s+[\w\s]{0,14}coment/i,
  /respostas? anterior/i,
  /^ver mais$/i,
  /^ver anteriores$/i,
  /^ver\s+\d*\s*respostas?/i,
  /**
   * **TERMINA em "N resposta(s)" — e foi a print de 20/10 que obrigou isto.**
   *
   * O padrao anterior exigia que o texto FOSSE "1 resposta", e na pagina dele o botao diz
   * **"Capitao Martim respondeu · 1 resposta"** — tudo num clicavel so. Medido: nao pegava, e por
   * isso "Ler tudo" terminou com *"19 comentarios, 0 ja respondido"* com tres resumos a vista.
   *
   * Cobre tambem o de terceiro (*"Fulana respondeu · 2 respostas"*), e isso e de proposito:
   * expandir traz mais articles, que e o objetivo da leitura.
   */
  /\b\d+\s+respostas?$/i,
];

export function botoesDeExpandir(raiz = document) {
  return [...raiz.querySelectorAll('[role="button"]')].filter((b) => {
    const t = String(b.innerText || '').trim();
    // O teto subiu de 40 para 80: "<nome comprido> respondeu · 12 respostas" passa de 40, e era
    // isso que escapava. Ele continua existindo para o painel nunca clicar num texto grande.
    return !!t && t.length <= 80 && !t.includes('\n') && REVELAM.some((p) => p.test(t));
  });
}

/** "<alguem> respondeu…" — o resumo que o Facebook poe no lugar da resposta colapsada. */
function ehResumoDeRespostaDe(texto, pagina) {
  const m = String(texto || '').trim().match(/^(.{1,60}?)\s+respondeu\b/i);
  return !!m && mesmoNome(m[1], pagina);
}

/**
 * **O comentario cuja resposta esta COLAPSADA ja diz isso em texto** — "<pagina> respondeu".
 *
 * Rede de seguranca do expandir: pegando este texto, o amarelo aparece **antes** de ele mandar ler
 * o post inteiro. Nao substitui o expandir, porque sem os articles nao da para saber QUEM mais
 * respondeu nem reusar a caixa.
 *
 * **A guarda e a POSICAO:** so conta depois do primeiro marcador de tempo/botao, que e onde o
 * texto do comentario acaba (ver `limparTextoDoComentario`). No meio do texto, "o Capitao Martim
 * respondeu" e o eleitor falando de nos.
 */
export function respostaNossaColapsada(art, pagina) {
  if (!pagina || !art) return false;

  /**
   * **Caminho 1: dentro do proprio `innerText`.** Funciona quando o Facebook poe o resumo dentro
   * do article. **Medido em 20/10: na pagina dele NAO esta** — a leitura deu 0 respondidos em 19
   * com tres resumos a vista. Fica porque e barato e cobre o layout em que ele esta dentro.
   */
  const linhas = String(art.innerText || '').split('\n');
  let passouOsBotoes = false;
  for (const linha of linhas) {
    const l = linha.trim();
    if (!passouOsBotoes) {
      // A guarda e a POSICAO: no meio do texto, "o Capitao Martim respondeu meu pedido" e o
      // eleitor falando de nos.
      if (LINHA_DE_TEMPO.test(l) || LINHA_DE_BOTAO.test(l)) passouOsBotoes = true;
      continue;
    }
    if (ehResumoDeRespostaDe(l, pagina)) return true;
  }

  /**
   * **Caminho 2: o BOTAO do resumo, que mora fora do article.**
   *
   * Procurar o `[role="button"]` e mais preciso que varrer o `innerText` do ancestral: o botao e
   * exatamente o resumo, enquanto o texto do ancestral traz junto o comentario inteiro.
   *
   * **A guarda e parar no ancestral que ja mistura DOIS comentarios** — dali para cima o
   * "respondeu" encontrado poderia ser do vizinho, e marcar de amarelo quem nunca foi atendido o
   * esconde da fila. Por isso o laco sobe no maximo quatro niveis e conta antes de olhar.
   */
  for (let n = art.parentElement, i = 0; n && i < 4; n = n.parentElement, i++) {
    if (quantosComentarios(n) > 1) break;
    const botoes = [...n.querySelectorAll('[role="button"]')];
    if (botoes.some((b) => ehResumoDeRespostaDe(b.innerText, pagina))) return true;
  }
  return false;
}

/** Quantos comentarios de PRIMEIRO NIVEL existem dentro deste no. Resposta nao conta. */
function quantosComentarios(no) {
  return articles(no).filter((a) => lerRotulo(a.getAttribute('aria-label'))?.tipo === 'comentario')
    .length;
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
