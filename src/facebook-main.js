/**
 * facebook-main.js — o painel de COMENTARIOS, montado na aba do Facebook.
 *
 * Por que nao e o painel de sempre: aquele vive na aba do mobiliza e depende da
 * API de la (o Bearer capturado, a ponte RPC, o contrato de escrita). Aqui nao
 * ha nada disso — o que existe e o DOM da pagina, lido por `dom-facebook.js`.
 *
 * O FLUXO E O QUE ELE PEDIU EM 16/10: *"eu abro o post e mando a extensao
 * inserir o texto na caixa de resposta e eu envio e a extensao segue para o
 * proximo"*. Entao este painel:
 *   1. le os comentarios do post ABERTO e mostra quem ainda nao foi respondido
 *      por nos;
 *   2. no clique, abre a caixa daquele comentario e ACRESCENTA o texto;
 *   3. para ai. **Quem envia e ele** — nada aqui aperta Enter nem clica em
 *      "Comentar", que e a fronteira do projeto inteiro.
 *
 * E ENCAIXADO, empurrando a pagina — **a mesma coisa que no mobiliza**, e por
 * pedido dele em 19/10 (*"preciso que empurre pro lado pra que caiba a extensao
 * da mesma forma do mobiliza"*). A primeira versao flutuava por cima, com o
 * argumento de que mexer no layout do Facebook era arriscado; **medido, o
 * argumento nao se sustentou** e quem reusa e o proprio `dock.js`, porque duas
 * copias do mesmo empurrao divergem na primeira semana.
 *
 * O QUE A MEDICAO MOSTROU, com 380px encaixados (19/10/2026):
 *  - `body` e o cabecalho foram de **1351 para 971** — o cabecalho do Facebook
 *    e `position: static`, entao ele acompanha sozinho;
 *  - `[role="main"]` de 991 para 611, **sem barra de rolagem horizontal**;
 *  - **nenhum elemento `fixed` largo vazou** para baixo do painel;
 *  - e o que mais importava: **o modal do post se recentra na area encolhida**
 *    (ficou em 136..836, com a borda do painel em 971), entao o post aberto nao
 *    fica escondido atras do painel. A camada que escurece o fundo continua
 *    cobrindo a tela inteira, e isso e so cosmetico: o painel e opaco e fica
 *    por cima dela.
 *
 * A LISTA NUNCA E AFIRMADA COMO COMPLETA. O DOM do Facebook e virtualizado e
 * "Mais relevantes" esconde gente (medido: a contagem dizia 5 e a arvore tinha
 * 4). Por isso ha botao de reler: o que esta na arvore muda quando ele rola.
 *
 * **MAS ISSO NAO E ALARME, e deixou de ser em 20/10/2026** — decisao dele, vendo o painel no ar:
 * *"nao tem problema estar nos relevantes pois quero responder eles e nao todos"*. O amarelo
 * mandava trocar a ordenacao para "Todos os comentarios", ou seja, mandava fazer o contrario do
 * que ele quer, ocupando um quarto da tela. **Alarme sobre uma escolha dele e ruido**, e alarme
 * que toca sempre e o que se aprende a ignorar — inclusive no dia em que e de verdade.
 * Hoje a contagem e uma linha CINZA e o amarelo fica so para o que ele nao escolheu: o nome da
 * pagina nao lido, sem o qual a lista traz quem ja tem resposta nossa.
 */

import * as fb from './lib/dom-facebook.js';
import * as dock from './lib/dock.js';
import * as store from './lib/store.js';
import * as perfis from './lib/perfis.js';
import * as gabinete from './lib/gabinete.js';
import { rascunharComentario } from './lib/ia-cliente.js';
import * as rapidas from './lib/respostas-comentario.js';

const HOST_ID = 'whatsfill-facebook-host';
const VERSAO = chrome.runtime.getManifest().version;
const LARGURA = dock.DEFAULT_WIDTH;

const estado = {
  aberto: true,
  comentarios: [],
  aviso: '',
  /** A linha cinza sobre a lista (contagem / "role para carregar mais"), separada do amarelo. */
  dicaDaLista: '',
  texto: '',
  status: '',
  /**
   * **As respostas rapidas DESTE candidato** (20/10/2026) — pedido dele: *"preciso de respostas
   * rapidas para o facebook, a ia nao e necessaria para tudo"*.
   *
   * Lidas na montagem e no "Reler a pagina": este painel nao fica sabendo quando ele troca de
   * candidato no mobiliza, entao reler e o gesto que atualiza as duas coisas de uma vez.
   */
  respostas: [],
  /** O id da resposta sendo renomeada — vazio quando nenhuma esta. */
  renomeando: '',
  /** O modo de organizar a tira (renomear/apagar). Fora dele a tira e so os rotulos. */
  gerindo: false,
  /** O id do comentario DA VEZ — o que o teclado atinge. Vazio = o primeiro que ainda espera. */
  daVezId: '',
  /** A leitura do post inteiro esta rodando? O botao vira "Parar" enquanto estiver. */
  lendo: false,
  /** Ele pediu para parar no meio da leitura. */
  pararLeitura: false,
  /** Uma insercao por vez: a caixa do Facebook ACRESCENTA, entao duas duplicariam o texto. */
  inserindo: false,
  /**
   * **O ponteiro de cada rodizio de variacoes** (`varianteIndex`, a chave compartilhada que o
   * `exportJson` descarta por ser medicao e nao configuracao). Carregado junto das respostas.
   */
  indices: {},
  /** O id da resposta aberta no EDITOR — vazio quando nenhuma esta. */
  editando: '',
  /**
   * **O rascunho do editor mora no ESTADO, como o campo principal.**
   *
   * O painel redesenha sozinho a cada 2s. A guarda de foco so segura enquanto o cursor esta no
   * campo — bastava ele clicar fora para o redesenho restaurar o valor GRAVADO e comer as
   * variacoes que ele acabou de digitar.
   */
  edNome: '',
  edVariacoes: '',
  /** Verdadeiro so no instante em que o editor abre — ver o foco no desenho. */
  edFocar: false,
  /**
   * **O MODO DE RESPONDER** (21/10/2026, pedido dele: *"criei um botao de comecar a responder onde
   * vai esconder a extensao e ter as opcoes de resposta, subir e descer comentarios nas setas e
   * enter para mandar a mensagem; crie o botao de parar tambem"*).
   *
   * Nele o painel **solta o empurrao** e vira uma barra fina embaixo: a tela inteira e do post,
   * que e o que ele veio ler. As respostas rapidas vem na barra, as setas andam na fila e o Enter
   * envia.
   */
  respondendo: false,
  /**
   * **O que a barra esta esperando virar "respondido"** — `{ id, autor }`.
   *
   * O avanco automatico **nao confia no Enter**: ele espera a RESPOSTA aparecer no post, que e o
   * sinal que `comentariosDoPost` ja le. Assim o mesmo mecanismo cobre os tres jeitos de enviar
   * (o Enter dele na caixa, o nosso despacho e o botao de enviar do Facebook), e nenhum deles
   * precisa provar nada por conta propria.
   */
  aguardando: null,
  /**
   * **O no que esta com o realce amarelo NA PAGINA** (21/10/2026).
   *
   * Guardado para ser LIMPO: sem a referencia do anterior, trocar de comentario deixaria um rastro
   * amarelo em todo mundo por quem ele passou — e ai o realce deixa de dizer onde a tecla bate,
   * que e a unica coisa que ele existe para dizer.
   */
  realcado: null,
  /** O relogio do modo de responder. Zerado ao sair — senao ele continua lendo o DOM para sempre. */
  vigia: 0,
  /**
   * **O QUE ELE FEZ SEM RESPONDER** — `id -> 'curtido' | 'ocultado'` (21/10/2026).
   *
   * **Nao vira `respondido`**: amarelo significa "ja tem resposta nossa", e curtir nao e responder
   * — marcar assim mentiria na lista e no contador.
   *
   * **E so o OCULTADO sai da fila** (correcao dele no mesmo dia: *"ao curtir nao precisa pular a
   * mensagem, somente ao responder"*). Curtir e um complemento: ele pode querer responder a mesma
   * pessoa depois, entao o comentario continua esperando e o realce fica onde esta. Ocultado nao
   * tem o que responder — deixar o cursor nele seria um beco sem saida.
   *
   * **So memoria, e isso e de proposito:** gravar faria o painel esconder gente numa sessao
   * futura por causa de um clique que ninguem lembra. No F5 eles voltam, e o que decide e a pagina.
   */
  marcados: new Map(),
};

/**
 * **Le as respostas rapidas do candidato logado.**
 *
 * As de fabrica entram como `vazio` de proposito: `perfis.ler` devolveria `[]` para o candidato
 * que nunca guardou nada, e tira vazia faria o painel parecer quebrado. Elas podem servir a
 * qualquer um porque **nenhuma cita candidato pelo nome** — ver `RESPOSTAS_DE_FABRICA`.
 */
async function carregarRespostas() {
  try {
    const lista = await perfis.ler(
      'respostasComentario',
      await store.get('perfilAtivo'),
      rapidas.RESPOSTAS_DE_FABRICA
    );
    estado.respostas = rapidas.sanitizar(lista);
    estado.indices = (await store.get('varianteIndex')) || {};
  } catch (_) {
    // Falha de armazenamento nao pode derrubar o painel: sem a tira ele ainda le e insere.
    estado.respostas = [];
    estado.indices = {};
  }
}

/**
 * **Escreve na linha de status.**
 *
 * O status mora no ESTADO e o elemento e procurado no shadow a cada escrita, nunca guardado numa
 * variavel: quem pede o rascunho redesenha o painel no meio do caminho, e o elemento capturado
 * antes disso ja saiu da arvore — a mensagem iria para um no orfao e a tela ficaria muda justo
 * depois da chamada paga.
 *
 * **E funcao de MODULO** desde 20/10, porque o teclado tambem fala e ele vive fora do `desenhar`.
 */
function falar(shadow, t) {
  estado.status = t;
  const atual = shadow.querySelector('.status');
  if (atual) atual.textContent = t;
}

/**
 * **O comentario DA VEZ** — o que o Enter e as teclas de resposta atingem.
 *
 * Guardado por ID e nao por indice: o painel rele sozinho a cada 2s e a lista encurta quando um
 * comentario e respondido. Com indice, o foco pularia para outra pessoa sem ninguem mexer.
 * Sumindo o id (foi respondido, ou o post fechou), volta para o primeiro.
 */
function comentarioDaVez() {
  if (!estado.comentarios.length) return null;
  const escolhido = estado.comentarios.find((c) => c.id === estado.daVezId);
  if (escolhido) return escolhido;
  /**
   * **Sem escolha dele, a vez e do primeiro que AINDA ESPERA.** Desde que os respondidos entraram
   * na lista (20/10), cair no `[0]` cru poria o teclado em cima de quem ja foi atendido — e a
   * tecla 1 escreve na pagina. Ele continua podendo escolher um respondido pelo clique ou pelas
   * setas; o que nao pode e isso acontecer por padrao.
   */
  // Pula o que ele OCULTOU — nao ha o que responder ali. O curtido continua na fila: curtir e
  // complemento, nao resposta (correcao dele, 21/10). Ver `estado.marcados`.
  return estado.comentarios.find((c) => !c.respondido && !c.foraDaFila) || estado.comentarios[0];
}

/** Quantos comentarios o painel guarda de um post. Acima disso ele para de acumular. */
const MAX_ACUMULADO = 300;

/**
 * **A LISTA ACUMULA, EM VEZ DE SER A FOTO DA ARVORE** (20/10/2026).
 *
 * O DOM do Facebook e virtualizado: rolando para carregar os de baixo, **os de cima saem da
 * arvore**. Com a lista sendo a foto de agora, "ler o post inteiro" nao produziria lista nenhuma —
 * ela so trocaria de conteudo. Era por isso que ele estava rolando a mao e anotando.
 *
 * Acumular tem um preco, e ele e tratado em `inserir`: o `no` de um comentario que saiu da arvore
 * fica obsoleto. Por isso o painel **reacha pelo id** na hora de inserir, e so desiste se nem
 * assim achar.
 *
 * O que CHEGA ganha prioridade sobre o que estava guardado: `respondido` muda quando ele responde,
 * e o `no` novo e o que ainda esta vivo.
 */
function acumular(antigos, novos, raiz) {
  const porId = new Map();
  for (const c of antigos) porId.set(c.id, c);
  for (const c of novos) porId.set(c.id, c);

  const vivos = [...porId.values()];
  if (vivos.length <= MAX_ACUMULADO) return ordenarComoNaTela(vivos, raiz);
  // Teto: o que esta na arvore AGORA fica; o excedente sai do fim do acumulado.
  const naTela = new Set(novos.map((c) => c.id));
  const fica = vivos.filter((c) => naTela.has(c.id));
  for (const c of vivos) {
    if (fica.length >= MAX_ACUMULADO) break;
    if (!naTela.has(c.id)) fica.push(c);
  }
  return ordenarComoNaTela(fica, raiz);
}

/**
 * A ordem da LISTA e a da TELA — quem esta na arvore vem na ordem em que aparece no post, e quem
 * ja saiu dela vai para o fim.
 *
 * Sem isto, a ordem seria a de descoberta: o comentario que ele rolou ate achar apareceria no
 * meio de gente que esta no topo do post, e a lista deixaria de corresponder ao que ele ve.
 */
function ordenarComoNaTela(lista, raiz) {
  const ordem = new Map();
  fb.articles(raiz || document).forEach((art, i) => {
    const id = fb.idDoComentario(art);
    if (id) ordem.set(id, i);
  });
  return lista
    .map((c, i) => ({ c, pos: ordem.has(c.id) ? ordem.get(c.id) : 1e6 + i }))
    .sort((a, b) => a.pos - b.pos)
    .map((x) => x.c);
}

/** Grava a lista no candidato logado. Devolve o que deu errado, ou vazio. */
async function salvarRespostas(lista) {
  estado.respostas = rapidas.sanitizar(lista);
  try {
    await perfis.gravar('respostasComentario', await store.get('perfilAtivo'), estado.respostas);
    return '';
  } catch (err) {
    return `nao consegui guardar: ${err?.message || err}`;
  }
}

/* ------------------------------------------------------------------ */

function css() {
  return `
    :host { all: initial; }
    /* Encaixado na faixa que o dock abriu: altura inteira, colado na direita,
       sem cantos arredondados -- e a borda da tela, como no mobiliza.
       (Sem crase aqui dentro: isto vive num template literal, e a crase o
       fecharia no meio -- foi o que quebrou o modulo na primeira versao.) */
    .caixa {
      position: fixed; top: 0; right: 0; bottom: 0; width: ${LARGURA}px; z-index: 2147483000;
      font: 13px/1.45 -apple-system, "Segoe UI", Roboto, sans-serif;
      color: #111; background: #fff; border-left: 1px solid #ccd0d5;
      box-sizing: border-box; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .topo {
      display: flex; align-items: center; gap: 8px; padding: 8px 10px;
      background: #f0f2f5; border-bottom: 1px solid #ccd0d5; font-weight: 600;
    }
    .topo .v { font-weight: 400; color: #65676b; font-size: 11px; }
    .topo button { margin-left: auto; }
    button {
      font: inherit; padding: 5px 9px; border-radius: 6px; border: 1px solid #ccd0d5;
      background: #fff; cursor: pointer;
    }
    button.primario { background: #1877f2; border-color: #1877f2; color: #fff; font-weight: 600; }
    button:disabled { opacity: .5; cursor: default; }
    /* flex:1 para o corpo tomar a altura que sobra e o rodape ficar colado
       embaixo; sem isso a lista para no meio e sobra tela vazia. */
    .corpo { padding: 10px; overflow-y: auto; flex: 1; }
    .aviso { background: #fff3cd; border: 1px solid #ffe69c; border-radius: 6px; padding: 7px 9px; margin-bottom: 9px; }
    .vazio { color: #65676b; }
    .item { border: 1px solid #e4e6eb; border-radius: 8px; padding: 8px; margin-bottom: 8px; }
    /* O comentario DA VEZ: e nele que o Enter e as teclas 1..9 batem. O realce e o CONTRATO —
       sem ele, inserir por teclado e no escuro.
       A barra grossa a esquerda entrou em 20/10: na print dele o fundo azul claro e a borda de
       1px nao davam para distinguir qual estava aceso, e "nao da para distinguir" ja e defeito
       numa marca que decide onde o texto vai ser escrito na pagina. */
    .item.davez {
      border-color: #1877f2; background: #f0f6ff;
      border-left: 4px solid #1877f2; padding-left: 10px;
    }
    /* AMARELO = ja recebeu resposta nossa (pedido dele, 20/10). Fica DEPOIS da regra .davez para o
       fundo amarelo vencer o azul no comentario respondido que ele escolher — mas a barra azul
       da esquerda continua, porque ela responde outra pergunta: onde a tecla bate. */
    .item.respondido { border-color: #ffe69c; background: #fff8e1; }
    /* A border-color acima pinta as QUATRO bordas: sem esta linha a barra azul da vez sumiria
       justo no caso em que as duas marcas se encontram. */
    .item.respondido.davez { border-left-color: #1877f2; }
    .item.respondido .quem::after {
      content: ' · respondido'; color: #8a6d3b; font-weight: 400; font-size: 11px;
    }
    /* Curtido ou ocultado por ele nesta rodada: cinza, porque NAO e resposta nossa — a palavra
       vem do proprio dado, para a tela nunca dizer "curtido" sobre um ocultado. */
    .item.marcado { border-color: #ccd0d5; background: #f7f8fa; }
    .item.marcado .quem::after {
      content: ' · ' attr(data-marca); color: #65676b; font-weight: 400; font-size: 11px;
    }
    .item .quem { font-weight: 600; margin-bottom: 2px; }
    .item .txt { color: #333; white-space: pre-wrap; word-break: break-word; margin-bottom: 7px; }
    textarea {
      font: inherit; width: 100%; box-sizing: border-box; min-height: 64px;
      border: 1px solid #ccd0d5; border-radius: 6px; padding: 6px; resize: vertical;
    }
    .rodape { padding: 9px 10px; border-top: 1px solid #e4e6eb; background: #fafbfc; }
    .linha { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 7px; }
    /* A tira das respostas rapidas. Quebra em varias linhas de proposito: com
       rolagem lateral ele nao veria que existe uma quinta resposta.
       No uso normal sao SO os rotulos -- o renomear e o apagar vivem atras do
       botao de gerir, senao seis pares de [rotulo][x][v] empilham seis linhas
       no rodape e enterram a lista de comentarios, que e o que ele veio ler. */
    .rapidas { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
    .rapidas .par { display: flex; align-items: stretch; }
    .rapidas .usar {
      max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      padding: 4px 8px;
    }
    /* Gerindo, o rotulo encosta nos controles e vira a ponta esquerda do par. */
    .rapidas .par.edit .usar { border-radius: 6px 0 0 6px; border-right: 0; }
    .rapidas .mini { padding: 4px 6px; border-radius: 0; border-right: 0; color: #65676b; }
    .rapidas .fim { border-radius: 0 6px 6px 0; border-right: 1px solid #ccd0d5; }
    /* As acoes fixas (Curtir, Ocultar, Responder a mao) moram na mesma fileira das respostas
       rapidas, com a borda marcada: o numero e a ordem sao os mesmos, o que muda e o que o
       numero FAZ — e isso tem de dar para ver sem ler. */
    .rapidas .usar.acao { border-color: #8a8d91; color: #050505; background: #f0f2f5; }
    .rapidas .engrenagem { padding: 4px 7px; color: #65676b; }
    .rapidas .engrenagem.ligado { background: #e7f0fd; border-color: #1877f2; color: #1877f2; }
    /* O editor toma o corpo: dez variacoes nao cabem numa tira de 380px. */
    .editor input {
      font: inherit; width: 100%; box-sizing: border-box; padding: 6px;
      border: 1px solid #ccd0d5; border-radius: 6px; margin: 6px 0;
    }
    .editor textarea.variacoes { min-height: 190px; }
    .status { color: #65676b; margin-top: 6px; min-height: 16px; }
    .dica { color: #8a8d91; font-size: 11px; margin-bottom: 5px; }
    /* Escondido, o painel solta o empurrao e vira so a pestana. */
    .pestana {
      position: fixed; top: 96px; right: 0; z-index: 2147483000;
      font: 600 12px -apple-system, "Segoe UI", Roboto, sans-serif;
      background: #1877f2; color: #fff; border: 0; border-radius: 8px 0 0 8px;
      padding: 9px 11px; cursor: pointer; box-shadow: 0 3px 10px rgba(0,0,0,.2);
    }
    /* ------------------------------------------------------------------
       O MODO DE RESPONDER: barra fina embaixo, e a tela inteira e do post.
       Ela NAO empurra a pagina (o dock e soltado) de proposito -- esconder a
       extensao foi metade do pedido dele. Embaixo e nao em cima porque o
       cabecalho do Facebook e a barra de comentarios do post vivem no topo.
       Largura limitada e centralizada: numa tela larga, uma barra de ponta a
       ponta joga os botoes para longe de onde ele esta lendo. ------------ */
    .barra {
      position: fixed; left: 50%; transform: translateX(-50%); bottom: 12px;
      width: min(880px, calc(100vw - 24px)); z-index: 2147483000;
      font: 13px/1.45 -apple-system, "Segoe UI", Roboto, sans-serif; color: #111;
      background: #fff; border: 1px solid #ccd0d5; border-radius: 10px;
      box-sizing: border-box; padding: 9px 11px;
      box-shadow: 0 6px 22px rgba(0,0,0,.22);
    }
    .barra .alvo { display: flex; align-items: baseline; gap: 7px; margin-bottom: 7px; }
    .barra .alvo .quem { font-weight: 600; }
    /* O texto do comentario encolhe numa linha: a barra nao pode crescer e
       cobrir o post, e o comentario inteiro esta na pagina, atras dela. */
    .barra .alvo .txt {
      color: #444; flex: 1; min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .barra .alvo .marca { font-size: 11px; color: #65676b; white-space: nowrap; }
    /* Ambar: a mesma linguagem do amarelo da lista ("ja tem resposta nossa"). */
    .barra .alvo .marca.ja {
      color: #8a6d3b; background: #fff8e1; border: 1px solid #ffe69c;
      border-radius: 10px; padding: 1px 7px;
    }
    .barra .alvo .conta { color: #65676b; font-size: 11px; white-space: nowrap; }
    .barra .alvo .parar { margin-left: auto; }
    .barra .rapidas { margin-bottom: 7px; }
    .barra .status { margin-top: 0; }
    .barra .aviso { margin-bottom: 7px; }
    .barra .dica { margin: 0; }
    .barra button.parar { background: #fff; border-color: #f02849; color: #f02849; font-weight: 600; }
  `;
}

/* ------------------------------------------------------------------ */

/**
 * **Tudo e lido da RAIZ do post aberto, nunca do `document`.** Abrindo o post
 * pela contagem de comentarios, o Facebook usa um modal e a timeline continua
 * viva atras — medido, 9 comentarios no documento contra 7 no post. Ler o
 * documento misturava comentarios de outros posts na lista e fazia a resposta
 * ser inserida na caixa errada, que foi o que ele viu em 19/10.
 */
function relerComentarios() {
  const raiz = fb.raizDoPost();
  if (!raiz) {
    estado.comentarios = [];
    estado.aviso =
      'Abra um post para comecar — pela contagem de comentarios dele. Na linha do tempo o Facebook mantem so uns poucos comentarios na tela, entao a lista nao fecha.';
    return;
  }

  /**
   * **A lista traz TODOS, com os respondidos marcados** — pedido dele em 20/10/2026: *"troque a
   * cor dos que receberam resposta na lista para amarelo"*.
   *
   * Antes eles eram descartados, e o efeito era o comentario SUMIR da lista dois segundos depois
   * de ele responder — bom como fila, desorientador como tela: ele perdia a referencia de onde
   * estava. Em amarelo, a lista passa a mostrar o progresso dentro do post.
   */
  estado.comentarios = acumular(estado.comentarios, fb.comentariosDoPost(raiz), raiz);

  /**
   * **A marca do que ele curtiu ou ocultou e colada DEPOIS da leitura**, porque `acumular` deixa a
   * leitura nova ganhar: posta dentro do objeto, ela sumiria no tique seguinte.
   *
   * `foraDaFila` e separado da MARCA porque sao duas perguntas: o que ele fez (a tela) e se ainda
   * espera (a fila). Curtir responde a primeira e nao a segunda.
   */
  for (const c of estado.comentarios) {
    c.marca = estado.marcados.get(c.id) || '';
    c.foraDaFila = c.marca === 'ocultado';
  }

  /**
   * **O AMARELO E SO PARA PROBLEMA DE VERDADE** — decisao dele em 20/10/2026, vendo o painel no
   * ar: *"nao tem problema estar nos relevantes pois quero responder eles e nao todos"*.
   *
   * O aviso tomava um quarto da tela mandando trocar a ordenacao para "Todos os comentarios", ou
   * seja, mandando fazer o contrario do que ele quer. **Alarme sobre uma escolha dele nao e
   * alarme: e ruido** — e alarme que toca sempre e o que se aprende a ignorar, inclusive no dia em
   * que e de verdade.
   *
   * O que sobra em amarelo e o que ele nao escolheu e pode custar caro: **o nome da pagina nao
   * lido**, porque sem ele nao da para saber o que ja foi respondido e a lista traz gente que ja
   * tem resposta nossa.
   */
  estado.aviso = fb.nomeDaPagina(raiz)
    ? ''
    : 'Nao achei o nome da pagina neste post, entao nao da para saber o que ja foi respondido: a lista pode trazer quem ja tem resposta.';

  /**
   * **A contagem virou DICA cinza, e a ordenacao decide se ela e citada.**
   *
   * Com "Mais relevantes" ligado, dizer *"o post tem 42"* compara a lista com um conjunto que ele
   * NAO quer percorrer — soa como se faltassem quarenta. O total so e meta quando a ordenacao nao
   * esconde ninguem; nos outros casos o que importa e que **rolar carrega mais**, que continua
   * verdade pela virtualizacao.
   */
  const total = fb.contagemDoPost(raiz);
  const esperando = estado.comentarios.filter((c) => !c.respondido && !c.foraDaFila).length;
  const feitos = estado.comentarios.length - esperando;

  /**
   * **A conta vem primeiro: e ela que torna o amarelo util de relance.** Sem o numero ele teria de
   * contar os cartoes para saber quanto falta nesta tela.
   */
  const conta = estado.comentarios.length
    ? feitos
      ? `${esperando} esperando, ${feitos} em amarelo ja respondido. `
      : `${esperando} esperando. `
    : '';

  estado.dicaDaLista =
    conta +
    (fb.ordenacaoEsconde(raiz)
      ? 'Mostrando os mais relevantes — role dentro do post e releia para carregar mais.'
      : total != null && total > estado.comentarios.length
      ? `O post tem ${total} — role dentro do post e releia para carregar o resto.`
      : '');
  estado.dicaDaLista = estado.dicaDaLista.trim();
}

/**
 * **LER O POST INTEIRO: expande as respostas, rola, e acumula** — pedido dele em 20/10/2026:
 * *"preciso que faca uma leitura do post pegando todos os comentarios, estou tendo que fazer isso
 * manualmente; a leitura ira servir pra ver quais foram respondidos tambem"*.
 *
 * **Expandir e o que faz o amarelo funcionar**, e nao so um atalho de rolagem: enquanto a resposta
 * esta colapsada em "<pagina> respondeu · 1 resposta", o `[role="article"]` dela **nao existe**, e
 * `respondido` e falso para todo mundo.
 *
 * **A PROVA E O EFEITO, nunca o rotulo do botao.** A volta clica no que parece revelar, rola, e
 * mede quantos articles apareceram. Acertar o texto exato de cada botao do Facebook e adivinhacao
 * que envelhece na primeira traducao; contar o que surgiu, nao. Ela so para quando **duas voltas
 * seguidas** nao trazem nada novo — uma so erraria no instante em que o Facebook esta carregando.
 *
 * **Nada aqui envia, responde nem curte:** os unicos cliques sao em botoes que REVELAM, e a lista
 * de padroes e de permissao, com teto de 40 caracteres para nao clicar num comentario.
 */
async function lerPostInteiro(shadow) {
  const raiz = fb.raizDoPost();
  if (!raiz) {
    falar(shadow, 'Abra um post primeiro — pela contagem de comentarios dele.');
    return;
  }
  if (estado.lendo) {
    estado.pararLeitura = true;
    falar(shadow, 'Parando a leitura...');
    return;
  }

  estado.lendo = true;
  estado.pararLeitura = false;
  desenhar(shadow);

  let semNovidade = 0;
  try {
    for (let volta = 1; volta <= MAX_VOLTAS_DA_LEITURA && !estado.pararLeitura; volta++) {

      const botoes = fb.botoesDeExpandir(raiz);
      for (const b of botoes.slice(0, 8)) {
        if (estado.pararLeitura) break;
        try {
          b.click();
        } catch (_) {
          // Botao que sumiu entre a leitura e o clique: a volta seguinte o pega de novo.
        }
        await espera(220);
      }

      // Rolar o CONTAINER do post, nao a janela: o post vive num modal com rolagem propria.
      const andou = rolarOPost(raiz);
      await espera(700);

      const quantosAntes = estado.comentarios.length;
      relerComentarios(); // acumula
      const achouGente = estado.comentarios.length > quantosAntes;

      falar(
        shadow,
        `Lendo o post... ${estado.comentarios.length} comentario(s) ja vistos` +
          (botoes.length ? `, ${botoes.length} bloco(s) abertos` : '') +
          ` (volta ${volta}). Clique de novo para parar.`
      );
      desenhar(shadow);

      /**
       * **A volta so e "seca" quando NADA aconteceu:** nenhum bloco aberto, a rolagem nao andou e
       * ninguem novo entrou na lista. Contar so os articles da tela nao serve, porque a
       * virtualizacao os troca sem aumentar o numero — o que cresce e o ACUMULADO.
       *
       * Duas secas seguidas, porque o Facebook as vezes leva uma volta para trazer o lote
       * seguinte.
       */
      semNovidade = !botoes.length && !andou && !achouGente ? semNovidade + 1 : 0;
      if (semNovidade >= 2) break;
    }
  } finally {
    estado.lendo = false;
    estado.pararLeitura = false;
    relerComentarios();
    desenhar(shadow);
  }

  const feitos = estado.comentarios.filter((c) => c.respondido).length;
  const total = fb.contagemDoPost(raiz);
  falar(
    shadow,
    `Leitura terminada: ${estado.comentarios.length} comentario(s), ${feitos} ja respondido(s)` +
      (total != null ? ` — o post declara ${total}.` : '.')
  );
}

const MAX_VOLTAS_DA_LEITURA = 40;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Rola o post para o fim.
 *
 * **O post aberto e um modal com rolagem PROPRIA**, entao rolar a janela nao carrega nada. O
 * container e procurado subindo do primeiro comentario ate achar quem tem o que rolar; falhando,
 * a janela e a ultima tentativa, que e o caso do post aberto em pagina inteira.
 */
/** O article daquele comentario, AGORA. O id e estavel; o elemento nao. */
function acharPorId(raiz, id) {
  return fb.articles(raiz).find((art) => fb.idDoComentario(art) === id) || null;
}

function rolarOPost(raiz) {
  const art = fb.articles(raiz)[0];
  for (let n = art || raiz; n && n !== document.body; n = n.parentElement) {
    if (n.scrollHeight > n.clientHeight + 40) {
      /**
       * **Em PASSOS, nunca direto ao fim.** O DOM e virtualizado: saltando para o fim, o que esta
       * no meio nunca entra na arvore — e a lista acumulada ficaria com o comeco e o fim do post,
       * sem o miolo. Um passo de 80% da altura visivel garante sobreposicao entre as fotos.
       */
      const passo = Math.max(200, Math.floor(n.clientHeight * 0.8));
      const antes = n.scrollTop;
      n.scrollTop = Math.min(n.scrollTop + passo, n.scrollHeight);
      return n.scrollTop > antes;
    }
  }
  const antes = window.scrollY;
  window.scrollBy(0, Math.max(200, Math.floor(window.innerHeight * 0.8)));
  return window.scrollY > antes;
}

/**
 * Abre a caixa daquele comentario e acrescenta o texto. NAO envia.
 *
 * O clique e necessario: a caixa so nasce depois dele. E entre o clique e a
 * caixa existir passa um instante — dai a espera curta, relendo em vez de
 * confiar num prazo fixo.
 */
async function inserir(comentario, texto, aviso) {
  /**
   * **UMA insercao por vez, e a trava mora AQUI** (20/10/2026, junto com o teclado).
   *
   * `fb.inserirNaCaixa` **ACRESCENTA** — ela nunca limpa, porque apagar na caixa do Facebook nao
   * funciona (medido em 19/10). Entao duas chamadas em cima da outra deixam o texto DUPLICADO
   * numa caixa publica, a um Enter de ser publicado assim.
   *
   * O botao se protegia sozinho desabilitando; **a tecla nao tem como**, e apertar "1" duas vezes
   * e o gesto mais natural do mundo quando a primeira parece nao ter respondido. Por isso a trava
   * fica no ponto unico por onde as duas passam.
   */
  if (estado.inserindo) {
    aviso('Espere a insercao anterior terminar.');
    return false;
  }
  estado.inserindo = true;
  try {
    return await inserirDeVerdade(comentario, texto, aviso);
  } finally {
    estado.inserindo = false;
  }
}

/**
 * **Abre a caixa de resposta daquele comentario e devolve ela** — ponto unico do caminho que
 * `inserir` e o "Responder a mao" (tecla 4) percorrem.
 *
 * O clique e necessario: a caixa so nasce depois dele. E entre o clique e a caixa existir passa um
 * instante — dai a espera curta, relendo em vez de confiar num prazo fixo.
 */
async function abrirCaixa(comentario, aviso) {
  /**
   * A raiz e relida AGORA, e nao a do desenho: entre listar e clicar ele pode ter fechado o post.
   * E o comentario tem de continuar DENTRO dela — senao estariamos abrindo a caixa de um
   * comentario da timeline, que e o defeito que isto existe para nao repetir.
   */
  const raiz = fb.raizDoPost();
  if (!raiz) {
    aviso('O post fechou. Abra ele de novo e clique em "Reler a pagina".');
    return null;
  }

  const no = noDoComentario(raiz, comentario);
  if (!no) {
    aviso('Este comentario saiu da tela. Role ate ele dentro do post e clique em "Reler a pagina".');
    return null;
  }

  const botao = fb.botaoResponder(no);
  if (!botao) {
    aviso('Nao achei o botao "Responder" deste comentario. Role ate ele aparecer na tela e releia.');
    return null;
  }

  let caixa = fb.caixaDeResposta(comentario.autor, raiz);
  if (!caixa) {
    botao.click();
    for (let i = 0; i < 20 && !caixa; i++) {
      await new Promise((r) => setTimeout(r, 100));
      caixa = fb.caixaDeResposta(comentario.autor, raiz);
    }
  }

  if (!caixa) {
    aviso('A caixa de resposta nao abriu. Clique em "Responder" na pagina e tente de novo.');
    return null;
  }
  return caixa;
}

/**
 * **O article deste comentario, AGORA.**
 *
 * O `no` guardado pode estar obsoleto, e com a lista acumulando isso e o caso comum: o DOM e
 * virtualizado, entao rolando para ler o post inteiro os de cima saem da arvore e o nosso `no`
 * vira um elemento solto. O id (`comment_id`) e estavel; o elemento nao.
 */
function noDoComentario(raiz, c) {
  if (!raiz || !c) return null;
  return raiz.contains(c.no) ? c.no : acharPorId(raiz, c.id);
}

async function inserirDeVerdade(comentario, texto, aviso) {
  const caixa = await abrirCaixa(comentario, aviso);
  if (!caixa) return false;

  // A caixa ja vem com a mencao: isto ACRESCENTA, nunca substitui.
  const ok = fb.inserirNaCaixa(caixa, texto);
  aviso(
    ok
      ? `Texto posto na caixa de ${comentario.autor}. Revise e envie — o envio e seu.`
      : 'O texto nao entrou na caixa. Clique dentro dela na pagina e tente de novo.'
  );
  /**
   * **O booleano existe para o ponteiro das variacoes** (20/10): ele so anda quando o texto
   * ENTROU na caixa. Avancar numa falha faria a variacao seguinte pular sozinha, e a volta de dez
   * viraria uma volta de nove sem ninguem perceber — a disciplina de `templates.avancarVariante`.
   */
  return ok;
}

/**
 * **Pede o rascunho a IA e poe no CAMPO, nunca na caixa do Facebook.**
 *
 * A fronteira e a mesma do projeto inteiro: a IA escreve, ele le, e so entao
 * ele manda inserir. Pular o campo e escrever direto na caixa transformaria um
 * texto nao lido em algo a um Enter de ser publicado — e aqui e publico.
 */
async function pedirRascunho(comentario, dizer, redesenhar) {
  const cfg = await store.get('ia');
  if (!cfg?.ligada) {
    dizer('A avaliacao por IA esta desligada. Ligue no painel do mobiliza, na aba Automatizado.');
    return;
  }

  dizer('Pedindo o rascunho a IA...');

  const lista = await store.get('perfis');
  const candidato = perfis.porId(lista, await store.get('perfilAtivo'));

  /**
   * O dossie so vai quando o comentario pede — a mesma conta do WhatsApp, e e
   * ela que impede o arquivo inteiro de entrar em todo "22" que chega.
   * A CHAPA vai sempre: a trava dela nao depende de o dossie ter ido, porque o
   * modelo escreve os nomes de cabeca (a licao de 08/09).
   */
  const [dossie, chapa] = await Promise.all([
    gabinete.paraOPrompt([comentario.texto], { perfil: candidato }),
    gabinete.chapa(),
  ]);

  const r = await rascunharComentario({
    autor: comentario.autor,
    texto: comentario.texto,
    regras: cfg.regras || '',
    gabinete: dossie,
    candidato,
    chapa,
    modelo: cfg.modeloRascunho || cfg.modelo,
    agora: new Date(),
  });

  if (r.naoResponder) {
    estado.texto = '';
    redesenhar();
    dizer(`A IA achou que este comentario nao pede resposta${r.motivo ? ` (${r.motivo})` : ''}. Se discordar, escreva a sua.`);
    return;
  }

  if (!r.texto) {
    dizer(r.avisos[0] || 'a IA nao devolveu rascunho');
    return;
  }

  estado.texto = r.texto;
  redesenhar();

  const partes = [];
  if (r.motivo) partes.push(r.motivo);
  if (r.confianca) partes.push(`confianca ${Math.round(r.confianca * 100)}%`);
  // Os avisos aparecem SEMPRE e nunca escondem o texto: esconder tiraria a
  // decisao dele, que e a regra de `revisarRascunho` desde o comeco.
  const alerta = r.avisos.length ? ` ATENCAO: ${r.avisos.join(' | ')}` : '';
  dizer(`Rascunho no campo${partes.length ? ` (${partes.join(', ')})` : ''}. Leia antes de inserir.${alerta}`);
}

/* ------------------------------------------------------------------ */

/**
 * **A TIRA DAS RESPOSTAS RAPIDAS, montada num lugar so.**
 *
 * Dois donos: o rodape do painel e a **barra do modo de responder**. Duas copias divergiriam na
 * primeira correcao — e a divergencia aqui seria "numa tira o botao insere e na outra nao".
 *
 * `comGerir` e falso na barra de proposito: organizar (renomear, apagar) e trabalho de painel
 * aberto, e o ✕ a um dedo de distancia de quem esta respondendo em sequencia e o gesto destrutivo
 * escondido no inofensivo (a licao de 01/09).
 *
 * **Clicar faz o MESMO que a tecla:** poe no campo E insere no comentario da vez (escolha dele em
 * 20/10, *"escolhe e ja insere"*). Inserir nao e enviar.
 */
/* ------------------------------------------------------------------ */

/**
 * **Poe o realce amarelo no comentario da vez, na PAGINA — e tira do anterior.**
 *
 * Mora no `desenhar` porque e o unico lugar por onde as duas telas passam (o painel e a barra), e
 * porque o DOM e virtualizado: o article do comentario e TROCADO quando ele rola, e o realce
 * precisa ser reposto no no de agora. Reachar pelo id e o que faz isso funcionar — o
 * `comment_id` e estavel, o elemento nao.
 *
 * **Painel escondido tira o realce:** marca na pagina sem nada na tela explicando o que ela
 * significa e sujeira no Facebook dele.
 */
function realcarNaPagina() {
  const alvo = estado.aberto || estado.respondendo ? comentarioDaVez() : null;
  const no = alvo ? noDoComentario(fb.raizDoPost(), alvo) : null;
  estado.realcado = fb.realcarComentario(no, estado.realcado);
}

/**
 * **Rola a pagina ate aquele comentario.** Ponto unico: o botao "Ver na pagina" da lista e o
 * avanco do modo de responder — sem isso, "vai pro proximo sozinho" deixaria o proximo fora da
 * vista e ele teria de procurar na pagina quem o painel escolheu.
 *
 * **O `no` guardado pode estar obsoleto**, e com a lista acumulando isso e o caso comum: o article
 * e reachado pelo id antes de desistir. `scrollIntoView` num elemento solto nao leva a lugar
 * nenhum — e nao avisa.
 */
function verNaPagina(c, dizer) {
  const no = noDoComentario(fb.raizDoPost(), c);
  if (!no) {
    dizer('Este comentario saiu da tela. Clique em "Ler o post inteiro" ou role ate ele.');
    return false;
  }
  no.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

/**
 * **De quanto em quanto o modo de responder pergunta "ja apareceu?".**
 *
 * 700ms e o compromisso: o laco normal do painel e de 2s, e esperar 2s depois de cada envio faz o
 * "sozinho" parecer travado numa fila que ele percorre rapido. A leitura e do DOM e barata — e a
 * mesma que o laco de 2s ja faz.
 */
const INTERVALO_DA_VIGIA_MS = 700;

/** A assinatura da fila para o modo: muda quando alguem entra, sai ou passa a ser respondido. */
function assinaturaDaFila() {
  return (
    estado.comentarios.map((c) => `${c.id}${c.respondido ? '!' : ''}`).join('|') +
    `>${estado.daVezId}`
  );
}

/**
 * **COMECAR A RESPONDER** (pedido dele, 21/10/2026).
 *
 * Solta o empurrao, troca o painel pela barra e arma a vigia. **Sai do modo de organizar** antes:
 * a barra nao tem o engrenagem, e voltar ao painel com a tira em modo de apagar seria tela suja.
 */
function comecarResponder(shadow) {
  estado.respondendo = true;
  estado.gerindo = false;
  estado.editando = '';

  relerComentarios();
  const alvo = comentarioDaVez();
  estado.daVezId = alvo ? alvo.id : '';
  armar(alvo);

  if (estado.vigia) clearInterval(estado.vigia);
  estado.vigia = setInterval(() => vigiarEnvio(shadow), INTERVALO_DA_VIGIA_MS);

  desenhar(shadow);
  if (!alvo) {
    falar(shadow, 'Nao ha comentario na lista. Role o post, ou use o "L Ler tudo" no painel.');
    return;
  }
  falar(shadow, `Respondendo ${alvo.autor}. Escolha uma resposta e aperte Enter na caixa.`);
  verNaPagina(alvo, (m) => falar(shadow, m));
}

/**
 * **PARAR** — o botao que ele pediu junto. Devolve o painel e para a vigia.
 *
 * Zerar o `vigia` nao e detalhe: sem isso o relogio continua lendo o DOM para sempre, e um segundo
 * "Comecar" criaria um relogio a mais a cada clique.
 */
function pararResponder(shadow) {
  estado.respondendo = false;
  estado.aguardando = null;
  if (estado.vigia) clearInterval(estado.vigia);
  estado.vigia = 0;
  relerComentarios();
  desenhar(shadow);
  falar(shadow, 'Parei o modo de responder.');
}

/**
 * **SOLTA O FOCO DA CAIXA DO FACEBOOK, e isto e o que mantem o teclado vivo no modo.**
 *
 * Duas razoes, as duas medidas no proprio codigo:
 *
 *  1. **Os DIGITOS continuam barrados dentro de campo de texto** (e tem de continuar: "22" e o
 *     numero do candidato, e ele digita isso na resposta). `inserirNaCaixa` deixa o foco DENTRO da
 *     caixa — entao, sem soltar, depois do primeiro envio ele nao conseguiria mais apertar 1..9.
 *  2. **O Enter e o da caixa em foco.** Trocando de comentario com a caixa do ANTERIOR ainda em
 *     foco (e com texto que ele nao enviou), um Enter mandaria a resposta para a pessoa errada —
 *     a barra diria um nome e o Facebook enviaria para outro.
 *
 * So solta campo de texto: o foco num botao do painel nao incomoda ninguem.
 */
function soltarOFoco() {
  const el = document.activeElement;
  if (el && el !== document.body && el.isContentEditable) el.blur();
}

/**
 * **ARMAR a espera, e so em quem AINDA espera.**
 *
 * O avanco acontece na TRANSICAO para respondido. Armando em cima de alguem que ja esta
 * respondido, a vigia veria "respondido" no primeiro tique e pularia sozinha — ele escolheria um
 * comentario e o painel sairia de cima dele sem nada ter sido enviado.
 */
function armar(c) {
  estado.aguardando = c && !c.respondido ? { id: c.id, autor: c.autor, trecho: '' } : null;
}

/**
 * **O PEDACO DO TEXTO QUE FOI PARA A CAIXA — a segunda prova do envio** (21/10/2026, relato dele:
 * *"ao mandar o enter nao esta pulando para o proximo comentario"*).
 *
 * A prova forte continua sendo a RESPOSTA APARECER no post. Ela depende de ler o `aria-label` da
 * resposta recem-criada, e **essa forma nunca foi medida**: o rotulo exige o marcador de tempo
 * (`ha ...`), e um "Agora" no lugar dele faria a leitura devolver nulo — a resposta existiria na
 * tela e o painel nao a veria.
 *
 * Por isso guarda-se o trecho que `inserirNaCaixa` CONFIRMOU ter entrado (os mesmos 20 caracteres
 * que ela usa para conferir). Sumindo da caixa, o texto saiu.
 */
function aguardarSaida(c, texto) {
  armar(c);
  if (estado.aguardando) estado.aguardando.trecho = String(texto || '').slice(0, 20);
}

/**
 * **Os rotulos que a leitura NAO entendeu.** Existe para UMA coisa: quando o avanco acontece pela
 * prova fraca, a linha de status mostra o primeiro deles — e e esse texto que diz o que falta para
 * a prova forte voltar a funcionar. Medicao na tela dele, sem console.
 */
function rotulosNaoLidos(raiz) {
  if (!raiz) return [];
  return fb
    .articles(raiz)
    .map((a) => a.getAttribute('aria-label') || '')
    .filter((l) => l && !fb.lerRotulo(l));
}

/**
 * **A VIGIA: quem prova o envio e a RESPOSTA APARECER, nunca o Enter.**
 *
 * Com isso os tres jeitos de enviar andam pelo mesmo mecanismo — o Enter dele na caixa (que e o
 * caminho provado, o que ele usa hoje), o nosso despacho e o botao do proprio Facebook. Nenhum
 * precisa provar nada por conta propria, e **nao existe avanco sem prova**: pular sem resposta
 * esconderia da fila quem nunca foi atendido.
 */
function vigiarEnvio(shadow) {
  if (!estado.respondendo) return;

  const antes = assinaturaDaFila();
  relerComentarios();
  /**
   * **O realce e reposto a cada tique, e nao so no desenho.** O DOM e virtualizado: rolando, o
   * Facebook TROCA o article do comentario, e o amarelo iria embora com o no antigo — justo
   * enquanto ele rola para ler o que vai responder.
   */
  realcarNaPagina();

  const esperado = estado.aguardando;
  const atual = esperado && estado.comentarios.find((c) => c.id === esperado.id);

  // PROVA FORTE: a resposta apareceu no post.
  if (esperado && atual && atual.respondido) {
    avancar(shadow, `Resposta a ${esperado.autor} apareceu no post.`);
    return;
  }

  /**
   * **PROVA FRACA: o texto SAIU DA CAIXA e esta NA PAGINA.**
   *
   * **Sao DUAS condicoes, e a segunda e o que a torna segura:** o texto saiu da caixa **E**
   * continua na PAGINA. Enviado, ele sai da caixa e aparece como resposta; **fechada a caixa sem
   * enviar, ele some dos dois lugares** e nada acontece. So a primeira metade acusaria envio
   * quando ele apenas fecha a caixa — e **avancar sem envio esconde da fila quem nunca foi
   * atendido**, que e o erro caro deste painel.
   *
   * A caixa SUMIR tambem conta (o Facebook a fecha depois de enviar em alguns layouts): quem
   * decide e o texto estar na pagina.
   *
   * O pior caso dela e nao disparar, que e o comportamento de antes: dai ele anda com o ↓.
   *
   * **E a linha diz que foi pela prova fraca**, com o rotulo que a leitura nao entendeu quando
   * houver: e assim que se descobre por que a prova forte falhou, sem console nenhum.
   */
  if (esperado && esperado.trecho) {
    const raiz = fb.raizDoPost();
    const caixa = raiz && fb.caixaDeResposta(esperado.autor, raiz);
    const naCaixa = !!caixa && String(caixa.innerText || '').includes(esperado.trecho);
    const naPagina = !!raiz && String(raiz.innerText || '').includes(esperado.trecho);
    if (raiz && !naCaixa && naPagina) {
      const naoLido = rotulosNaoLidos(raiz)[0];
      avancar(
        shadow,
        `O texto saiu da caixa de ${esperado.autor} — segui sem ver a resposta no post.` +
          (naoLido ? ` (rotulo que nao entendi: "${naoLido.slice(0, 70)}")` : '')
      );
      return;
    }
  }

  // Redesenha so quando a fila mudou: refazer a barra a cada 700ms seria DOM novo embaixo do dedo
  // dele, e a barra tem botoes que ele esta clicando.
  if (assinaturaDaFila() !== antes) desenhar(shadow);
}

/**
 * **O AVANCO: o proximo que ainda espera, na vista.**
 *
 * `fb.proximoPendente` devolve `null` quando mais ninguem espera, e ai o modo FICA no lugar: sair
 * sozinho tiraria a barra da tela no instante em que ele ainda pode querer ler o que escreveu.
 */
function avancar(shadow, dito = '') {
  const prox = fb.proximoPendente(estado.comentarios, estado.daVezId);
  const enviado = dito;

  if (!prox) {
    estado.aguardando = null;
    desenhar(shadow);
    falar(
      shadow,
      `${enviado} Nao ha mais ninguem esperando NESTA lista — o "L Ler tudo" do painel traz o resto do post.`
    );
    return;
  }

  estado.daVezId = prox.id;
  armar(prox);
  soltarOFoco();
  desenhar(shadow);
  falar(shadow, `${enviado} Agora: ${prox.autor}.`);
  verNaPagina(prox, (m) => falar(shadow, m));
}

/**
 * **O ENTER DO PAINEL — e por que ele NAO intercepta o Enter da caixa.**
 *
 * Com o foco DENTRO da caixa do Facebook o Enter dele e nativo, e esse e o caminho PROVADO: e
 * assim que ele envia hoje. Interceptar trocaria um envio que funciona por um despacho sintetico
 * que nunca foi medido, e o preco do erro e ele achar que respondeu sem ter respondido.
 *
 * Esta funcao cobre o outro caso: ele clicou num botao da barra (o foco saiu da caixa) e apertou
 * Enter. Ela despacha o Enter na caixa e **nao afirma que enviou** — quem diz isso e a vigia.
 */
function enviarDaVez(shadow) {
  const alvo = comentarioDaVez();
  if (!alvo) return;

  const raiz = fb.raizDoPost();
  const caixa = raiz && fb.caixaDeResposta(alvo.autor, raiz);
  if (!caixa) {
    falar(
      shadow,
      `A caixa de ${alvo.autor} nao esta aberta. Escolha uma resposta (1 a 9) — ela abre a caixa e escreve.`
    );
    return;
  }

  estado.daVezId = alvo.id;
  armar(alvo);
  fb.enviarDaCaixa(caixa);
  falar(shadow, `Enter despachado na caixa de ${alvo.autor}. Confirmo quando a resposta aparecer.`);
}

/**
 * **A IA no modo de responder poe o rascunho NA CAIXA, porque a barra nao tem campo.**
 *
 * No painel o rascunho fica no campo e ele le antes de inserir. Na barra nao existe campo — manter
 * o rascunho ali seria texto pago que ninguem ve. A caixa do Facebook passa a ser o campo: ela
 * esta na tela, mostra exatamente o que vai sair (com a mencao) e o Enter continua sendo um
 * segundo ato deliberado. **A leitura antes de publicar nao se perde; muda de lugar.**
 *
 * Os AVISOS da revisao sao repetidos depois da insercao de proposito: `inserir` escreve a propria
 * linha de status e apagaria "ATENCAO: promessa de entrega" justo no texto que vai para a pagina.
 */
async function pedirRascunhoNoModo(shadow, alvo) {
  let ultima = '';
  const dizer = (m) => {
    ultima = m;
    falar(shadow, m);
  };
  await pedirRascunho(alvo, dizer, () => {});
  const texto = estado.texto.trim();
  if (!texto) return;
  const entrou = await inserir(alvo, texto, () => {});
  if (entrou && estado.respondendo) aguardarSaida(alvo, texto);
  falar(
    shadow,
    entrou
      ? `${ultima} O texto esta na caixa de ${alvo.autor}.`
      : `${ultima} MAS nao entrou na caixa — clique dentro dela na pagina.`
  );
}

/**
 * **AS TRES ACOES DE TECLA FIXA** (21/10/2026, pedido dele: *"troque a funcao do botao dois para
 * curtir a mensagem, botao 3 para ocultar a mensagem, botao 4 responder a mao"*).
 *
 * Elas tomam os digitos **2, 3 e 4**; as respostas rapidas ficam com o **1** e seguem do **5** em
 * diante. O mapa vive AQUI, num lugar so, e e dele que saem o rotulo do botao e o que a tecla faz
 * — duas listas divergiriam, e a divergencia seria o botao dizer "3 Ocultar" e a tecla 3 mandar
 * uma resposta pronta na pagina dele.
 */
const ACOES_DA_TIRA = [
  {
    tecla: '2',
    nome: 'Curtir',
    titulo:
      'Curte este comentario e FICA nele — curtir nao e responder. Ja curtido, nao mexe: o botao ' +
      'do Facebook e o mesmo nos dois sentidos.',
    roda: (shadow) => curtirDaVez(shadow),
  },
  {
    tecla: '3',
    nome: 'Ocultar',
    titulo: 'Clica em "Ocultar" neste comentario. Abrindo dialogo, quem confirma e voce, na pagina.',
    roda: (shadow) => ocultarDaVez(shadow),
  },
  {
    tecla: '4',
    nome: 'Responder a mao',
    titulo: 'Abre a caixa deste comentario e poe o cursor nela, sem escrever nada.',
    roda: (shadow) => maoNaCaixa(shadow),
  },
];

/** Os nove digitos, na ordem em que a tira os desenha. */
const DIGITOS_E_ACOES = [...'123456789'];

/** Os digitos que sobram para as respostas rapidas, na ordem. */
const DIGITOS_DE_RESPOSTA = [...'123456789'].filter(
  (d) => !ACOES_DA_TIRA.some((a) => a.tecla === d)
);

/**
 * **O que este digito faz.** Fonte unica do teclado E da tira: o rotulo que o botao mostra sai
 * daqui, entao nao ha como a tecla fazer uma coisa e o botao prometer outra.
 */
function doDigito(k) {
  const acao = ACOES_DA_TIRA.find((a) => a.tecla === k);
  if (acao) return { acao };
  const i = DIGITOS_DE_RESPOSTA.indexOf(k);
  return i < 0 ? {} : { resposta: estado.respostas[i] };
}

/**
 * **O botao de uma acao fixa.** Mesmo visual das respostas rapidas de proposito: para o dedo dele
 * a tira e uma fileira numerada so, e o que muda e o que cada numero FAZ.
 */
function botaoDeAcao(shadow, acao) {
  const par = document.createElement('div');
  par.className = 'par';
  const bt = document.createElement('button');
  bt.className = 'usar acao';
  bt.textContent = `${acao.tecla}  ${acao.nome}`;
  bt.title = acao.titulo;
  // O clique faz o MESMO que a tecla: ver `doDigito`.
  bt.addEventListener('click', () => acao.roda(shadow));
  par.append(bt);
  return par;
}

/** Marca o que ele fez sem responder. So o ocultado sai da fila — ver `estado.marcados`. */
function marcar(c, como) {
  estado.marcados.set(c.id, como);
  c.marca = como;
  c.foraDaFila = como === 'ocultado';
}

/**
 * **Depois de OCULTAR, o modo anda; o painel so redesenha.**
 *
 * So o ocultar passa por aqui: curtir nao pula (correcao dele, 21/10). E no painel a lista esta na
 * tela e quem escolhe o proximo e o dedo dele — avancar ali moveria o realce sem ele pedir.
 */
function seguirDepoisDaAcao(shadow, dito) {
  if (estado.respondendo) {
    avancar(shadow, dito);
    return;
  }
  desenhar(shadow);
  falar(shadow, dito);
}

/**
 * **CURTIR o comentario da vez.**
 *
 * **A PROVA E O EFEITO:** depois do clique a funcao relê o botao, e so diz "curtido" quando a
 * pagina confirma. Nao dando para confirmar, ela diz *"cliquei — confira"*, que e a verdade: o
 * estado "curtido" do comentario nunca foi medido na pagina dele.
 */
async function curtirDaVez(shadow) {
  const alvo = comentarioDaVez();
  if (!alvo) return;
  const no = noDoComentario(fb.raizDoPost(), alvo);
  if (!no) {
    falar(shadow, 'Este comentario saiu da tela. Role ate ele e aperte R para reler.');
    return;
  }

  const r = fb.curtirComentario(no);
  if (r === 'ja-estava') {
    falar(shadow, `O comentario de ${alvo.autor} JA estava curtido — nao mexi (o botao descurtiria).`);
    return;
  }
  if (r === 'sem-botao') {
    falar(shadow, `Nao achei o "Curtir" no comentario de ${alvo.autor}. Role ate ele aparecer e releia.`);
    return;
  }

  await espera(400);
  const confirmado = fb.jaCurtido(no) === true;
  marcar(alvo, 'curtido');
  /**
   * **CURTIR NAO PULA** (correcao dele, 21/10: *"ao curtir nao precisa pular a mensagem, somente
   * ao responder"*). O realce fica onde esta e o comentario continua na fila: curtir e um
   * complemento, e a resposta pode vir logo depois, para a mesma pessoa.
   */
  desenhar(shadow);
  falar(
    shadow,
    confirmado ? `Curtido: ${alvo.autor}.` : `Cliquei em Curtir (${alvo.autor}) — confira na pagina.`
  );
}

/**
 * **OCULTAR o comentario da vez.**
 *
 * Clica e para ai: abrindo dialogo, quem confirma e ele. **Nao e desfazer de graca** — por isso a
 * linha de status diz o que foi feito e em quem, com nome.
 */
async function ocultarDaVez(shadow) {
  const alvo = comentarioDaVez();
  if (!alvo) return;
  const no = noDoComentario(fb.raizDoPost(), alvo);
  if (!no) {
    falar(shadow, 'Este comentario saiu da tela. Role ate ele e aperte R para reler.');
    return;
  }
  if (!fb.ocultarComentario(no)) {
    falar(shadow, `Nao achei o "Ocultar" no comentario de ${alvo.autor}. Role ate ele aparecer e releia.`);
    return;
  }
  marcar(alvo, 'ocultado');
  seguirDepoisDaAcao(shadow, `Ocultei o comentario de ${alvo.autor} (confira na pagina).`);
}

/**
 * **RESPONDER A MAO: abre a caixa e poe o cursor nela, sem escrever nada.**
 *
 * E a unica das tres que nao marca nada: ele ainda vai escrever, e quem decide que o caso foi
 * resolvido e a resposta aparecer no post — a mesma prova do resto do modo.
 */
async function maoNaCaixa(shadow) {
  const alvo = comentarioDaVez();
  if (!alvo) return;
  const caixa = await abrirCaixa(alvo, (m) => falar(shadow, m));
  if (!caixa) return;
  caixa.focus();
  armar(alvo);
  falar(shadow, `Caixa de ${alvo.autor} aberta. Escreva e aperte Enter.`);
}

function montarTira(shadow, dizer, comGerir) {
  const tira = document.createElement('div');
  tira.className = 'rapidas';

  const parDaResposta = (r, tecla) => {
    const par = document.createElement('div');
    par.className = 'par';

    const vez = rapidas.variacaoDaVez(r, estado.indices);

    const usar = document.createElement('button');
    usar.className = 'usar';
    usar.textContent = tecla ? `${tecla}  ${r.nome}` : r.nome;
    /**
     * **O contador vai no `title`, nao no botao.** Escrever "3/10" em seis botoes e ruido numa
     * tira de 380px, e o numero so interessa num instante: o da duvida. Quem diz em voz alta e
     * a linha de status, depois de usar.
     */
    usar.title =
      vez.total > 1
        ? `Variacao ${vez.posicao} de ${vez.total} (reveza a cada uso):\n${vez.texto}`
        : vez.texto;
    usar.addEventListener('click', () => {
      // O clique faz o MESMO que a tecla: duas formas de usar a mesma resposta divergem na
      // primeira correcao, e aqui a diferenca seria "uma insere e a outra nao".
      usarResposta(shadow, r);
    });
    par.append(usar);

    /**
     * **✎ e ✕ so existem no modo de gerir**, e sao duas coisas de uma vez: a tira fica com uma
     * linha de botoes em vez de tres (o rodape nao pode comer a lista de comentarios), e o
     * apagar deixa de ficar a um dedo de distancia de quem so queria usar a resposta.
     */
    if (comGerir && estado.gerindo) {
      par.className = 'par edit';

      const editar = document.createElement('button');
      editar.className = 'mini';
      editar.textContent = '✎';
      editar.title = `Editar o nome e as ${vez.total} variacao(oes)`;
      editar.addEventListener('click', () => {
        // O rascunho e carregado AQUI, uma vez. No desenho ele seria recarregado a cada
        // redesenho e comeria o que ele digitou.
        estado.editando = r.id;
        estado.edNome = r.nome;
        estado.edVariacoes = rapidas.paraTexto(r);
        estado.edFocar = true;
        desenhar(shadow);
      });

      const tirar = document.createElement('button');
      tirar.className = 'mini fim';
      tirar.textContent = '✕';
      tirar.title = 'Apagar a resposta INTEIRA, com todas as variacoes';
      tirar.addEventListener('click', async () => {
        /**
         * **Apagar devolve o texto ao CAMPO** — e o desfazer barato: um clique em "Guardar como
         * rapida" traz de volta. Sem isso, um ✕ errado apagaria um texto que ele escreveu e nao
         * tem copia em lugar nenhum (a licao de 01/09, *"acabei de perder todo meu trabalho"*).
         */
        if (r.variacoes.length > 1 && !confirm(`Apagar "${r.nome}" e as ${r.variacoes.length} variacoes?`)) return;
        const { lista, texto } = rapidas.apagar(estado.respostas, r.id);
        estado.texto = texto;
        const erro = await salvarRespostas(lista);
        desenhar(shadow);
        dizer(erro || 'Apagada. O texto esta no campo — "Guardar como rapida" desfaz.');
      });

      par.append(editar, tirar);
    }

    tira.append(par);
  };

  /**
   * **A ORDEM DA TIRA E A ORDEM DOS DIGITOS**, e os digitos 2, 3 e 4 sao ACOES desde 21/10
   * (pedido dele). As respostas rapidas ficam com o 1 e seguem do 5 em diante.
   *
   * O laco percorre 1..9 perguntando a `ACOES_DA_TIRA` — a MESMA fonte que o teclado consulta —,
   * entao nao ha como o botao dizer "3 Ocultar" e a tecla 3 mandar uma resposta pronta.
   */
  const fila = [...estado.respostas];
  for (const d of DIGITOS_E_ACOES) {
    const acao = ACOES_DA_TIRA.find((a) => a.tecla === d);
    if (acao) {
      tira.append(botaoDeAcao(shadow, acao));
      continue;
    }
    const r = fila.shift();
    if (r) parDaResposta(r, d);
  }
  // Da decima em diante nao ha tecla: o mapa e 1..9, e numerar alem disso ensinaria teclas que
  // nao existem. Essas so respondem ao clique.
  for (const r of fila) parDaResposta(r, '');

  const engrenagem = document.createElement('button');
  engrenagem.className = 'engrenagem' + (estado.gerindo ? ' ligado' : '');
  engrenagem.textContent = '⚙';
  engrenagem.title = estado.gerindo ? 'Terminar de organizar' : 'Renomear ou apagar respostas';
  engrenagem.addEventListener('click', () => {
    estado.gerindo = !estado.gerindo;
    // Sair do modo fecha qualquer renomeacao aberta: campo de edicao orfao numa tira que
    // voltou ao normal e tela suja.
    if (!estado.gerindo) estado.editando = '';
    desenhar(shadow);
  });
  if (comGerir) tira.append(engrenagem);
  return tira;
}

function desenhar(shadow) {
  shadow.replaceChildren();
  realcarNaPagina();

  /**
   * **O status e o `dizer` nascem ANTES de qualquer tela**, porque as duas (o painel e a barra do
   * modo de responder) terminam na mesma linha de status.
   *
   * Ele mora no ESTADO e e procurado no shadow a cada escrita, nunca guardado numa variavel: quem
   * pede o rascunho redesenha no meio do caminho, e o elemento capturado antes disso ja saiu da
   * arvore — a mensagem iria para um no orfao e a tela ficaria muda justo depois da chamada paga.
   */
  const status = document.createElement('div');
  status.className = 'status';
  status.textContent = estado.status;
  const dizer = (t) => falar(shadow, t);

  /**
   * O empurrao acompanha o painel: escondido, a pagina volta ao tamanho dela.
   * Fica aqui e nao nos botoes porque sao tres caminhos que mudam `aberto` (os
   * dois botoes e a montagem), e tres chamadas separadas divergiriam — a
   * mesma razao do `gravar` carimbar a versao do quadro num lugar so.
   *
   * **No modo de responder ele SOLTA o empurrao:** esconder a extensao foi metade do pedido dele,
   * e a barra flutua sem tirar largura do post.
   */
  if (estado.aberto && !estado.respondendo) dock.applyDock(LARGURA);
  else dock.removeDock();

  const style = document.createElement('style');
  style.textContent = css();
  shadow.append(style);

  /**
   * **O MODO DE RESPONDER: a barra, e nada mais na tela** (21/10/2026).
   *
   * Ela vem ANTES da pestana de proposito: no modo, "escondido" e "aberto" deixam de decidir a
   * tela — o painel esta guardado e o que existe e a barra. Duas telas disputando o mesmo estado
   * dariam pestana e barra ao mesmo tempo.
   *
   * O que ela tem e o minimo do gesto: **a quem** estou respondendo, **as respostas rapidas**, e
   * o **Parar**. Nao ha campo de texto: a caixa do Facebook esta na tela, logo acima, e e ela que
   * mostra exatamente o que vai sair — com a mencao. Duplicar num campo criaria a pergunta "qual
   * dos dois vai?".
   */
  if (estado.respondendo) {
    const barra = document.createElement('div');
    barra.className = 'barra';

    const alvo = comentarioDaVez();
    const esperando = estado.comentarios.filter((c) => !c.respondido && !c.foraDaFila).length;

    /**
     * **O aviso do nome da pagina e MAIS grave aqui que no painel:** sem ele nada fica
     * "respondido", e sem isso **o avanco automatico nunca acontece** — a consequencia vai escrita,
     * com a saida (o ↓ anda a mao).
     */
    if (estado.aviso) {
      const aviso = document.createElement('div');
      aviso.className = 'aviso';
      aviso.textContent = estado.comentarios.length
        ? `${estado.aviso} Enquanto isso o avanco automatico nao acontece: use o ↓ para andar.`
        : estado.aviso;
      barra.append(aviso);
    }

    const linhaAlvo = document.createElement('div');
    linhaAlvo.className = 'alvo';

    if (alvo) {
      const i = estado.comentarios.findIndex((c) => c.id === alvo.id);
      const quem = document.createElement('span');
      quem.className = 'quem';
      quem.textContent = alvo.autor;

      /**
       * **"ESTA PESSOA ESCREVEU MAIS DE UMA VEZ"** (21/10/2026, print dele: *"a marta ja foi
       * respondida, ela tem duas mensagens, mostre quando for o caso"*).
       *
       * A barra mostra UMA pessoa por vez — e sem isto ele nao tem como saber que ja respondeu a
       * mesma pessoa noutro comentario, e repete a mesma frase para ela. **Repeticao e o maior
       * sinal de maquina respondendo** (12/09).
       *
       * Em AMBAR quando ja respondemos outro dela, cinza quando ela so escreveu duas vezes: a cor
       * e a mesma linguagem do amarelo da lista, e o cinza nao e alarme — e informacao.
       */
      const outros = fb.comentariosDoMesmoAutor(estado.comentarios, alvo);
      const marca = document.createElement('span');
      marca.className = outros.respondidos ? 'marca ja' : 'marca';
      marca.textContent =
        `${outros.posicao}º de ${outros.total} desta pessoa` +
        (outros.respondidos
          ? ` · ${outros.respondidos} ja respondido${outros.respondidos > 1 ? 's' : ''}`
          : '');
      marca.title = outros.respondidos
        ? 'Ja respondemos outro comentario desta pessoa — nao repita a mesma frase.'
        : 'Esta pessoa escreveu mais de uma vez neste post.';

      const txt = document.createElement('span');
      txt.className = 'txt';
      // Uma linha so, cortada por CSS: o comentario inteiro esta na pagina atras da barra, e a
      // barra que cresce cobre justamente o que ele veio ler.
      txt.textContent = alvo.texto;
      const conta = document.createElement('span');
      conta.className = 'conta';
      conta.textContent = `${i + 1} de ${estado.comentarios.length} · ${esperando} esperando`;
      // A marca so entra quando e verdade: numa pessoa com UM comentario ela seria ruido.
      linhaAlvo.append(quem);
      if (outros.total > 1) linhaAlvo.append(marca);
      linhaAlvo.append(txt, conta);
    } else {
      const vazio = document.createElement('span');
      vazio.className = 'txt';
      vazio.textContent = 'Nenhum comentario na lista. Role o post e aperte R para reler.';
      linhaAlvo.append(vazio);
    }

    const btParar = document.createElement('button');
    btParar.className = 'parar';
    btParar.textContent = 'Parar';
    btParar.title = 'Volta o painel e para o modo de responder';
    btParar.addEventListener('click', () => pararResponder(shadow));
    linhaAlvo.append(btParar);
    barra.append(linhaAlvo);

    /**
     * **A tira e a MESMA do painel** (`montarTira`), sem o engrenagem: organizar e trabalho de
     * painel aberto, e o ✕ a um dedo de quem responde em sequencia e o gesto destrutivo escondido
     * no inofensivo.
     */
    barra.append(montarTira(shadow, dizer, false));

    const linhaB = document.createElement('div');
    linhaB.className = 'linha';

    const btIaB = document.createElement('button');
    btIaB.textContent = 'I  IA';
    btIaB.title = 'Pede o rascunho a IA e poe NA CAIXA, para voce ler antes do Enter';
    btIaB.disabled = !alvo;
    btIaB.addEventListener('click', async () => {
      if (!alvo) return;
      btIaB.disabled = true;
      try {
        await pedirRascunhoNoModo(shadow, alvo);
      } catch (err) {
        // Falha de IA nunca derruba nada: a regra do projeto desde 03/09.
        dizer(`a IA falhou: ${err?.message || err}`);
      } finally {
        btIaB.disabled = false;
      }
    });

    const btVer = document.createElement('button');
    btVer.textContent = 'Ver na pagina';
    btVer.disabled = !alvo;
    btVer.addEventListener('click', () => alvo && verNaPagina(alvo, dizer));

    const btRelerB = document.createElement('button');
    btRelerB.textContent = 'R  Reler';
    btRelerB.addEventListener('click', async () => {
      relerComentarios();
      await carregarRespostas();
      desenhar(shadow);
    });

    const dicaB = document.createElement('span');
    dicaB.className = 'dica';
    /**
     * **A dica diz a verdade sobre o Enter:** quem envia e o Enter do Facebook, com o foco na
     * caixa — e o caminho provado. Prometer "o painel envia" seria prometer um despacho sintetico
     * que nunca foi medido.
     */
    dicaB.textContent = '↑ ↓ trocam · ⏎ na caixa envia · o proximo vem sozinho quando a resposta aparece';

    linhaB.append(btIaB, btVer, btRelerB, dicaB);
    barra.append(linhaB, status);
    shadow.append(barra);
    return;
  }

  if (!estado.aberto) {
    const pestana = document.createElement('button');
    pestana.className = 'pestana';
    pestana.textContent = 'WhatsFill';
    pestana.addEventListener('click', () => {
      estado.aberto = true;
      relerComentarios();
      desenhar(shadow);
    });
    shadow.append(pestana);
    return;
  }

  const caixa = document.createElement('div');
  caixa.className = 'caixa';

  // topo
  const topo = document.createElement('div');
  topo.className = 'topo';
  const titulo = document.createElement('span');
  titulo.textContent = 'Comentarios';
  const v = document.createElement('span');
  v.className = 'v';
  v.textContent = `v${VERSAO}`;
  const esconder = document.createElement('button');
  esconder.textContent = 'Esconder';
  esconder.addEventListener('click', () => {
    estado.aberto = false;
    desenhar(shadow);
  });
  topo.append(titulo, v, esconder);

  // corpo
  const corpo = document.createElement('div');
  corpo.className = 'corpo';

  if (estado.aviso) {
    const aviso = document.createElement('div');
    aviso.className = 'aviso';
    aviso.textContent = estado.aviso;
    corpo.append(aviso);
  }


  /**
   * **O EDITOR TOMA O CORPO INTEIRO, e por isso ele e aqui e nao na tira.**
   *
   * Dez variacoes nao cabem numa linha de 380px: editar ali seria dez campos minusculos, ou um
   * dialogo, que num content script e feio e a pagina pode bloquear. Tomando o corpo, o textarea
   * ganha a altura da lista de comentarios — que e exatamente o espaco que sobra quando ele parou
   * de responder para organizar.
   *
   * **Uma variacao POR LINHA**, o mesmo formato das tabelas da Config. Comentario e de uma ou duas
   * frases, entao quebra de linha dentro de uma variacao nao existe na pratica — e a regra esta
   * escrita na tela, em vez de ficar para ele adivinhar.
   */
  if (estado.editando) {
    const alvo = estado.respostas.find((r) => r.id === estado.editando);
    if (!alvo) {
      estado.editando = '';
    } else {
      const ed = document.createElement('div');
      ed.className = 'editor';

      const tit = document.createElement('div');
      tit.className = 'quem';
      tit.textContent = 'Editando a resposta rapida';

      const campoNome = document.createElement('input');
      campoNome.value = estado.edNome;
      campoNome.maxLength = rapidas.MAX_NOME;
      campoNome.placeholder = 'Nome do botao (curto)';
      campoNome.addEventListener('input', () => {
        estado.edNome = campoNome.value;
      });

      const legenda = document.createElement('div');
      legenda.className = 'dica';
      legenda.textContent = `Uma variacao POR LINHA, ate ${rapidas.MAX_VARIACOES}. Elas revezam: cada uso pega a seguinte e so repete depois de passar por todas.`;

      const campoVar = document.createElement('textarea');
      campoVar.className = 'variacoes';
      campoVar.value = estado.edVariacoes;

      const conta = document.createElement('div');
      conta.className = 'dica';
      const recontar = () => {
        const n = rapidas.deTexto(campoVar.value).length;
        conta.textContent = n
          ? `${n} variacao(oes) — a volta fecha em ${n} uso(s).`
          : 'Sem nenhuma variacao: guardar assim APAGA esta resposta.';
      };
      recontar();
      campoVar.addEventListener('input', () => {
        estado.edVariacoes = campoVar.value;
        recontar();
      });

      const linhaEd = document.createElement('div');
      linhaEd.className = 'linha';

      const btOk = document.createElement('button');
      btOk.className = 'primario';
      btOk.textContent = 'Guardar';
      btOk.addEventListener('click', async () => {
        const { lista, texto } = rapidas.editar(
          estado.respostas,
          alvo.id,
          estado.edNome,
          rapidas.deTexto(estado.edVariacoes)
        );
        if (texto) estado.texto = texto; // apagou: o texto volta para o campo
        estado.editando = '';
        const erro = await salvarRespostas(lista);
        desenhar(shadow);
        falar(shadow, erro || 'Guardado.');
      });

      const btNao = document.createElement('button');
      btNao.textContent = 'Cancelar';
      btNao.addEventListener('click', () => {
        estado.editando = '';
        desenhar(shadow);
      });

      linhaEd.append(btOk, btNao);
      ed.append(tit, campoNome, legenda, campoVar, conta, linhaEd);
      corpo.append(ed);
      caixa.append(topo, corpo, rodapeSoStatus(status));
      shadow.append(caixa);
      /**
       * **O foco so na ABERTURA.** `desenhar` roda de novo por varios motivos; focar sempre
       * arrancaria o cursor do textarea das variacoes para o campo do nome no meio da digitacao.
       */
      if (estado.edFocar) {
        estado.edFocar = false;
        campoNome.focus();
        campoNome.select();
      }
      return;
    }
  }

  if (!estado.comentarios.length) {
    const vazio = document.createElement('div');
    vazio.className = 'vazio';
    // **"Nenhum comentario" e "todos respondidos" eram a MESMA frase ate 20/10**, porque a lista
    // so trazia os pendentes. Com os respondidos nela, lista vazia significa so uma coisa.
    vazio.textContent = fb.raizDoPost() ? 'Nenhum comentario nesta tela.' : '';
    corpo.append(vazio);
  }

  // Cinza e pequena, acima da lista: ela fala DA LISTA, e nao de um problema.
  if (estado.dicaDaLista) {
    const d = document.createElement('div');
    d.className = 'dica';
    d.textContent = estado.dicaDaLista;
    corpo.append(d);
  }

  const daVez = comentarioDaVez();

  for (const c of estado.comentarios) {
    const item = document.createElement('div');
    /**
     * **O realce diz onde o teclado vai bater.** Sem ele, Enter e as teclas 1..9 inseririam num
     * comentario que ele nao escolheu — e inserir escreve na pagina. A marca e o contrato: o que
     * esta aceso e o que a tecla atinge.
     */
    const ehDaVez = !!daVez && daVez.id === c.id;
    // Amarelo = ja tem resposta nossa. O realce da VEZ continua por cima dele: a pergunta "onde a
    // tecla bate" vale mesmo num comentario ja respondido, se ele escolher um.
    /**
     * **A MARCA e separada do amarelo**, e nao pode virar amarelo: amarelo diz "ja tem resposta
     * nossa", e curtir nao e responder. A palavra vai num `data-` para a CSS escrever qual foi
     * (curtido / ocultado) sem o painel montar dois seletores.
     */
    item.className =
      'item' +
      (c.respondido ? ' respondido' : '') +
      (c.marca ? ' marcado' : '') +
      (ehDaVez ? ' davez' : '');
    if (c.marca) item.dataset.marca = c.marca;
    // Clicar no comentario tambem o torna o da vez: quem usa o mouse nao deve ter de usar as
    // setas para o teclado concordar com o que ele esta olhando.
    item.addEventListener('click', () => {
      if (estado.daVezId === c.id) return;
      estado.daVezId = c.id;
      desenhar(shadow);
    });

    const quem = document.createElement('div');
    quem.className = 'quem';
    quem.textContent = c.autor;

    const txt = document.createElement('div');
    txt.className = 'txt';
    txt.textContent = c.texto.length > 220 ? `${c.texto.slice(0, 220)}...` : c.texto;

    const linha = document.createElement('div');
    linha.className = 'linha';

    const btInserir = document.createElement('button');
    btInserir.className = 'primario';
    /**
     * **A tecla so aparece no comentario DA VEZ**, e isso e honestidade: escrever "⏎" nos seis
     * botoes prometeria que o Enter atinge qualquer um deles. A regra do mobiliza — a caixa
     * ensina a tecla que funciona — so vale se o que ela ensina for verdade.
     */
    btInserir.textContent = ehDaVez ? '⏎  Abrir e inserir' : 'Abrir e inserir';
    btInserir.addEventListener('click', async () => {
      if (!estado.texto.trim()) {
        dizer('Escreva embaixo o que deve entrar na caixa.');
        return;
      }
      btInserir.disabled = true;
      try {
        await inserir(c, estado.texto.trim(), dizer);
      } finally {
        btInserir.disabled = false;
      }
    });

    const btIa = document.createElement('button');
    btIa.textContent = ehDaVez ? 'I  IA' : 'IA';
    btIa.title = 'Pede o rascunho a IA e poe no campo, para voce ler antes de inserir';
    btIa.addEventListener('click', async () => {
      btIa.disabled = true;
      try {
        await pedirRascunho(c, dizer, () => desenhar(shadow));
      } catch (err) {
        // Falha de IA nunca pode derrubar o painel: a regra do projeto desde 03/09.
        dizer(`a IA falhou: ${err?.message || err}`);
      } finally {
        btIa.disabled = false;
      }
    });

    const btIr = document.createElement('button');
    btIr.textContent = 'Ver na pagina';
    // Ponto unico com o avanco do modo de responder: ver `verNaPagina`.
    btIr.addEventListener('click', () => verNaPagina(c, dizer));

    linha.append(btInserir, btIa, btIr);
    item.append(quem, txt, linha);
    corpo.append(item);
  }

  // rodape
  const rodape = document.createElement('div');
  rodape.className = 'rodape';

  /**
   * **A TIRA DAS RESPOSTAS RAPIDAS, e ela fica ANTES do campo.**
   *
   * A ordem e a do gesto: escolhe, le no campo, insere. E a tira e UMA, junto do campo, e nao uma
   * por comentario — a lista tem N comentarios, e repetir seis botoes em cada um encheria a tela
   * com o que ele veio ler. O campo ja e compartilhado: quem escolhe o comentario e o
   * "Abrir e inserir".
   *
   * **Clicar poe no campo E insere na caixa daquele comentario** (escolha dele em 20/10). Inserir
   * nao e enviar: a caixa fica escrita e para ai.
   */
  // A tira existe sempre: mesmo sem resposta rapida nenhuma, as acoes fixas (2, 3 e 4) estao la.
  rodape.append(montarTira(shadow, dizer, true));

  const campo = document.createElement('textarea');
  campo.placeholder = 'O texto da resposta. Ele e ACRESCENTADO depois da mencao, e quem envia e voce.';
  campo.value = estado.texto;
  campo.addEventListener('input', () => {
    estado.texto = campo.value;
  });

  const linhaR = document.createElement('div');
  linhaR.className = 'linha';
  const btReler = document.createElement('button');
  btReler.textContent = 'R  Reler';
  btReler.title = 'Rele o que esta na tela agora, e recarrega as respostas rapidas do candidato';
  btReler.addEventListener('click', async () => {
    relerComentarios();
    // Reler atualiza as DUAS coisas: este painel nao sabe quando ele troca de candidato no
    // mobiliza, entao e aqui que a tira do candidato certo chega.
    await carregarRespostas();
    desenhar(shadow);
  });

  const btGuardar = document.createElement('button');
  btGuardar.textContent = 'G  Guardar';
  btGuardar.title = 'Guarda o que esta no campo como resposta rapida';
  btGuardar.disabled = !estado.texto.trim();
  // O botao e a tecla chamam a MESMA funcao: duas copias divergem na primeira correcao.
  btGuardar.addEventListener('click', () => guardarDoCampo(shadow));

  const btLer = document.createElement('button');
  btLer.textContent = estado.lendo ? 'Parar' : 'L  Ler tudo';
  btLer.title = 'Expande as respostas e rola o post, acumulando tudo o que achar';
  btLer.addEventListener('click', () => lerPostInteiro(shadow));

  /**
   * **COMECAR A RESPONDER** (pedido dele, 21/10/2026). Primeiro e em azul: e o botao com que o
   * trabalho comeca, e os outros tres sao preparo (ler, reler, guardar).
   */
  const btResponder = document.createElement('button');
  btResponder.className = 'primario';
  btResponder.textContent = 'Comecar a responder';
  btResponder.title =
    'Esconde o painel e deixa uma barra embaixo: setas trocam o comentario, as respostas rapidas ' +
    'escrevem na caixa, e o Enter na caixa envia. O proximo vem sozinho.';
  btResponder.addEventListener('click', () => comecarResponder(shadow));

  linhaR.append(btResponder, btLer, btReler, btGuardar);

  /**
   * **A dica ensina SO o que nao esta escrito num botao.** As outras teclas vivem no proprio
   * botao (`1  Agradecer o apoio`, `⏎  Abrir e inserir`), que e o jeito do mobiliza; as setas nao
   * tem botao nenhum, entao sem esta linha elas seriam invisiveis.
   */
  if (estado.comentarios.length > 1) {
    const dica = document.createElement('div');
    dica.className = 'dica';
    dica.textContent = '↑ ↓ trocam o comentario da vez (o realcado) · amarelo = ja respondido';
    rodape.append(dica);
  }

  rodape.append(campo, linhaR, status);
  caixa.append(topo, corpo, rodape);
  shadow.append(caixa);
}

/* ------------------------------------------------------------------ */

/**
 * **O MESMO ESQUEMA DE TECLADO DO MOBILIZA** — pedido dele (20/10/2026).
 *
 * O mapa (escolha dele): **1..9** a resposta rapida, **Enter** inserir, **setas** trocar o
 * comentario da vez, **I** a IA, **R** reler, **G** guardar o campo como rapida, **Esc** sair do
 * modo de organizar.
 *
 * **A tecla EXECUTA, como la:** 1..9 poe o texto no campo E insere no comentario da vez. Continua
 * sem enviar nada — quem aperta Enter no Facebook e ele, que e a fronteira do projeto inteiro.
 *
 * ---
 *
 * **AS TRES GUARDAS SAO COPIADAS DO `panel.js`, e cada uma custou caro:**
 *
 *  1. **`composedPath()[0]`, nunca `ev.target`.** Dentro de shadow DOM o `target` e o HOST, entao
 *     `ehCampoDeTexto` olharia a div de fora e deixaria passar. Sem isto, o "2" digitado no campo
 *     do painel inseriria a segunda resposta.
 *  2. **Campo de texto sai da frente — e aqui isso e maior que no mobiliza.** A caixa de resposta
 *     do Facebook e `contenteditable`, e ele digita nela o tempo todo: sem a guarda, cada "2" que
 *     ele escrevesse dispararia uma insercao. `isContentEditable` e o que a pega.
 *  3. **`isTrusted` no Escape.** A extensao dispara `Escape` no document para fechar overlay
 *     (07/09) — atalho que nao confere isso e atalho que ela aperta sozinha.
 *
 * E o listener e ligado UMA vez, no `montar`: ligado no `desenhar` ele se acumularia a cada
 * redesenho, e o painel redesenha a cada 2s.
 */
function ligarTeclado(shadow) {
  const ehCampoDeTexto = (el) => {
    if (!el || el.nodeType !== 1) return false;
    const tag = String(el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true;
  };

  document.addEventListener(
    'keydown',
    (ev) => {
      // No modo de responder o painel esta guardado e as teclas continuam sendo o trabalho dele.
      if (!estado.aberto && !estado.respondendo) return;

      /**
       * **`isTrusted` passou a valer para TODA tecla** (21/10/2026), e nao so para o Escape.
       *
       * O painel agora DESPACHA um Enter na caixa (`fb.enviarDaCaixa`), e o despacho borbulha ate
       * o document — onde este mesmo escutador esta, em captura. Sem esta linha ele atenderia o
       * proprio Enter e reentraria no envio. A razao antiga continua de pe: a extensao dispara
       * `Escape` no document para fechar overlay (07/09).
       *
       * Teclado de verdade vem sempre `true`, entao a guarda nao custa nada ao uso normal.
       */
      if (!ev.isTrusted) return;
      if (ev.ctrlKey || ev.altKey || ev.metaKey) return;

      // Shift junto vale: os botoes mostram a tecla em MAIUSCULA, e caixa que ensina uma tecla e
      // recusa o jeito obvio de aperta-la e pior que caixa sem atalho.
      const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;

      /**
       * **A guarda de campo de texto ganhou UMA excecao: o modo de responder.**
       *
       * A guarda e medida e continua valendo (a caixa do Facebook e `contenteditable`, e sem ela
       * cada "2" que ele digitasse inseriria a segunda resposta). Mas no modo de responder o foco
       * VIVE dentro da caixa — `inserirNaCaixa` o poe la —, e manter a guarda inteira mataria
       * justamente as setas que ele pediu.
       *
       * **Passam so as setas e o Escape**, que nao sao texto. Os DIGITOS continuam barrados: ele
       * digita numero na resposta. E o **Enter nao passa de proposito** — dentro da caixa ele e o
       * envio nativo do Facebook, o unico caminho provado; intercepta-lo trocaria um envio que
       * funciona por um despacho que nunca foi medido.
       */
      const noCampo = ehCampoDeTexto(ev.composedPath?.()[0] || ev.target);
      const passamNoCampo = k === 'ArrowDown' || k === 'ArrowUp' || k === 'Escape';
      if (noCampo && !(estado.respondendo && passamNoCampo)) return;

      const alvo = comentarioDaVez();
      const feito = () => {
        ev.preventDefault();
        ev.stopPropagation();
      };

      if (k === 'Escape') {
        // No modo, Escape e o "Parar": a mesma tecla que fecha o que esta por cima.
        if (estado.respondendo) {
          feito();
          pararResponder(shadow);
          return;
        }
        if (!estado.gerindo && !estado.editando) return;
        estado.gerindo = false;
        estado.editando = '';
        feito();
        desenhar(shadow);
        return;
      }

      if (k === 'ArrowDown' || k === 'ArrowUp') {
        if (estado.comentarios.length < 2) return;
        const i = estado.comentarios.findIndex((c) => c.id === (alvo && alvo.id));
        const passo = k === 'ArrowDown' ? 1 : -1;
        const prox = (i + passo + estado.comentarios.length) % estado.comentarios.length;
        const escolhido = estado.comentarios[prox];
        estado.daVezId = escolhido.id;
        feito();
        /**
         * **As setas CIRCULAM** (o avanco automatico nao — ver `fb.proximoPendente`): aqui ele
         * esta navegando a mao, e parar na ponta esconderia o comeco da lista.
         *
         * No modo de responder a seta tambem **arma a espera e leva a vista**: sem armar, o envio
         * para quem ele acabou de escolher nao avancaria; sem rolar, "o proximo" ficaria fora da
         * tela e ele teria de procura-lo.
         */
        if (estado.respondendo) {
          armar(escolhido);
          soltarOFoco();
          desenhar(shadow);
          verNaPagina(escolhido, (m) => falar(shadow, m));
          return;
        }
        desenhar(shadow);
        return;
      }

      if (k === 'l') {
        feito();
        lerPostInteiro(shadow);
        return;
      }

      if (k === 'r') {
        feito();
        relerComentarios();
        carregarRespostas().then(() => {
          desenhar(shadow);
          falar(shadow, 'Reli a pagina.');
        });
        return;
      }

      if (k === 'g') {
        if (!estado.texto.trim()) return;
        feito();
        guardarDoCampo(shadow);
        return;
      }

      if (k === 'i') {
        if (!alvo) return;
        feito();
        estado.daVezId = alvo.id;
        desenhar(shadow);
        // Na barra nao existe campo: o rascunho vai PARA A CAIXA, que passa a ser o lugar onde ele
        // le antes do Enter. Ver `pedirRascunhoNoModo`.
        if (estado.respondendo) {
          pedirRascunhoNoModo(shadow, alvo);
          return;
        }
        pedirRascunho(alvo, (t) => falar(shadow, t), () => desenhar(shadow));
        return;
      }

      if (k === 'Enter') {
        if (!alvo) return;
        feito();
        /**
         * **No modo, Enter ENVIA; no painel, insere.** Aqui o foco esta FORA da caixa (dentro dela
         * a guarda acima deixou o Enter nativo passar), entao este caminho e o do dedo que acabou
         * de clicar num botao da barra.
         */
        if (estado.respondendo) {
          enviarDaVez(shadow);
          return;
        }
        if (!estado.texto.trim()) return;
        inserir(alvo, estado.texto.trim(), (t) => falar(shadow, t));
        return;
      }

      /**
       * **1..9 pela MESMA fonte que desenha a tira** (`doDigito`): 2, 3 e 4 sao as acoes fixas, o
       * resto e resposta rapida — escolhe E insere, que e o esquema do mobiliza.
       */
      if (/^[1-9]$/.test(k)) {
        const { acao, resposta } = doDigito(k);
        if (acao) {
          feito();
          acao.roda(shadow);
          return;
        }
        if (!resposta) return;
        feito();
        usarResposta(shadow, resposta);
      }
    },
    // Captura no documento: o shadow root nao recebe tecla quando o foco esta na pagina.
    true
  );
}

/**
 * **Usar uma resposta rapida: poe no campo E insere no comentario da vez.**
 *
 * Escolha dele em 20/10, ao pedir o esquema do mobiliza: *"escolhe e ja insere"*. La a tecla
 * EXECUTA o desfecho, e aqui o equivalente e deixar o texto na caixa daquele comentario.
 *
 * **Inserir nao e enviar.** A caixa fica escrita e para ai — quem aperta Enter no Facebook e ele,
 * que e a fronteira do projeto inteiro.
 *
 * Ponto UNICO do clique e da tecla: duas copias divergiriam em "uma insere e a outra nao".
 */
async function usarResposta(shadow, r) {
  const { texto, posicao, total } = rapidas.variacaoDaVez(r, estado.indices);
  if (!texto) return;

  estado.texto = texto;
  const alvo = comentarioDaVez();
  desenhar(shadow);

  const onde = total > 1 ? ` (${r.nome}, variacao ${posicao} de ${total})` : ` (${r.nome})`;
  if (!alvo) {
    falar(shadow, `Resposta no campo${onde} — nao ha comentario na lista para inserir.`);
    return;
  }

  estado.daVezId = alvo.id;
  const entrou = await inserir(alvo, texto, (t) => falar(shadow, t + onde));
  if (!entrou) return;

  // O texto ENTROU: dai em diante, ele sumir da caixa e sinal de que foi enviado.
  if (estado.respondendo) aguardarSaida(alvo, texto);

  /**
   * **O ponteiro so anda com o texto na caixa** — a disciplina de `templates.avancarVariante`. Se
   * a insercao falhou, a proxima tentativa tem de oferecer a MESMA variacao: avancar aqui faria a
   * volta de dez virar uma volta de nove, em silencio.
   */
  estado.indices = rapidas.proximoPonteiro(r, estado.indices);
  try {
    await store.set('varianteIndex', estado.indices);
  } catch (_) {
    // Ponteiro e medicao, nao conteudo: falhar em gravar nao pode derrubar nada. O pior caso e
    // a volta recomecar do mesmo ponto no proximo F5.
  }
  desenhar(shadow);
}

/**
 * O rodape do EDITOR: so a linha de status.
 *
 * A tira e o campo ficam de fora de proposito — no editor eles nao tem uso, e a tira ainda teria o
 * botao da resposta que ele esta editando, que inseriria na pagina no meio da edicao.
 */
function rodapeSoStatus(status) {
  const rodape = document.createElement('div');
  rodape.className = 'rodape';
  rodape.append(status);
  return rodape;
}

/** Guarda o que esta no campo como resposta rapida. Um lugar so: o botao G e a tecla G. */
async function guardarDoCampo(shadow) {
  const { lista, jaExistia, cheia } = rapidas.guardar(estado.respostas, estado.texto);
  if (cheia) {
    falar(shadow, `A tira ja tem ${rapidas.MAX_RESPOSTAS} respostas — apague uma antes de guardar outra.`);
    return;
  }
  if (jaExistia) {
    falar(shadow, 'Esta resposta ja esta guardada.');
    return;
  }
  const erro = await salvarRespostas(lista);
  desenhar(shadow);
  falar(shadow, erro || 'Guardada. Use o ⚙ e o ✎ para dar um nome mais curto.');
}

function montar() {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  // Shadow DOM: o CSS do Facebook nao entra, e o nosso nao vaza. E `articles()`
  // varre o `document`, que NAO atravessa shadow — entao o painel nunca se le
  // como se fosse um comentario.
  const shadow = host.attachShadow({ mode: 'open' });
  document.documentElement.append(host);

  relerComentarios();
  desenhar(shadow);

  /**
   * **A tira chega DEPOIS, e o painel ja esta na tela.** Ler o armazenamento e assincrono, e
   * esperar por ele atrasaria a lista de comentarios, que e o que ele veio ver. Falhando, o painel
   * fica sem a tira e continua servindo para ler e inserir.
   */
  carregarRespostas().then(() => desenhar(shadow));

  // UMA vez, e nao no `desenhar`: ali ele se acumularia a cada redesenho, e o painel redesenha
  // sozinho a cada 2s.
  ligarTeclado(shadow);

  /**
   * O painel monta em `document_idle`, que e ANTES de o Facebook ter carregado
   * os comentarios — a lista nasceria vazia e pareceria defeito. E o DOM e
   * virtualizado, entao ela muda enquanto ele ROLA a pagina, sem clique nenhum.
   * Por isso o painel rele sozinho.
   *
   * Duas guardas, e as duas sao sobre nao atrapalhar quem esta usando:
   *  - so redesenha quando a LISTA mudou (comparando os ids), senao o DOM do
   *    painel seria refeito a cada 2s para nada;
   *  - nunca redesenha com o campo de texto em foco, senao a resposta que ele
   *    esta digitando perde o cursor no meio da frase.
   */
  let ondeEstava = location.href;
  let assinatura = estado.comentarios.map((c) => c.id).join('|');

  setInterval(() => {
    // No modo de responder a vigia (700ms) e quem le; este laco continua valendo porque ele cobre
    // a TROCA DE POST, que a vigia nao olha.
    if (!estado.aberto && !estado.respondendo) return;

    const mudouDePost = location.href !== ondeEstava;
    ondeEstava = location.href;

    /**
     * **`INPUT` entrou junto do `TEXTAREA` em 20/10**: o campo de renomear a resposta rapida e um
     * `input`, e sem ele o nome que ele estivesse digitando perdia o cursor a cada 2s. A guarda e
     * sobre quem esta ESCREVENDO, nao sobre qual elemento e.
     */
    const escrevendo =
      shadow.activeElement && ['TEXTAREA', 'INPUT'].includes(shadow.activeElement.tagName);
    if (escrevendo && !mudouDePost) return;

    relerComentarios();
    // Mesma razao da vigia: o article e trocado quando ele rola, e o realce acompanha.
    realcarNaPagina();
    const agora = estado.comentarios.map((c) => c.id).join('|');
    if (!mudouDePost && agora === assinatura) return;

    assinatura = agora;
    desenhar(shadow);
  }, 2000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', montar, { once: true });
} else {
  montar();
}
