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
 * 4). Por isso a tela mostra a contagem do post ao lado do que achou, e avisa
 * quando a ordenacao esta filtrando — e o painel tem botao de reler, porque o
 * que esta na arvore muda quando ele rola.
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
  /** O id do comentario DA VEZ — o que o teclado atinge. Vazio = o primeiro da lista. */
  daVezId: '',
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
  return estado.comentarios.find((c) => c.id === estado.daVezId) || estado.comentarios[0];
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
    /* O comentario DA VEZ: e nele que o Enter e as teclas 1..9 batem. O realce e o contrato —
       sem ele, inserir por teclado seria no escuro. */
    .item.davez { border-color: #1877f2; background: #f0f6ff; box-shadow: 0 0 0 1px #1877f2; }
    .item .quem { font-weight: 600; margin-bottom: 2px; }
    .item .txt { color: #333; white-space: pre-wrap; word-break: break-word; margin-bottom: 7px; }
    textarea {
      font: inherit; width: 100%; box-sizing: border-box; min-height: 64px;
      border: 1px solid #ccd0d5; border-radius: 6px; padding: 6px; resize: vertical;
    }
    .rodape { padding: 9px 10px; border-top: 1px solid #e4e6eb; background: #fafbfc; }
    .linha { display: flex; gap: 6px; align-items: center; margin-top: 7px; }
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

  estado.comentarios = fb.comentariosSemResposta(raiz);

  const partes = [];
  const total = fb.contagemDoPost(raiz);
  if (total != null && total > estado.comentarios.length) {
    // Nao e defeito: e virtualizacao mais "Mais relevantes". Dizer o numero e o
    // que impede o painel de afirmar que a fila acabou.
    partes.push(`O post diz ter ${total}. Role dentro do post e releia para ver o resto.`);
  }
  if (fb.ordenacaoEsconde(raiz)) {
    partes.push('A ordenacao esta em "Mais relevantes", que esconde comentarios. Troque para "Todos os comentarios".');
  }
  if (!fb.nomeDaPagina(raiz)) {
    partes.push('Nao achei o nome da pagina neste post, entao nao da para saber o que ja foi respondido: a lista pode trazer quem ja tem resposta.');
  }
  estado.aviso = partes.join(' ');
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

async function inserirDeVerdade(comentario, texto, aviso) {
  /**
   * A raiz e relida AGORA, e nao a do desenho: entre listar e clicar ele pode
   * ter fechado o post. E o comentario tem de continuar DENTRO dela — senao
   * estariamos abrindo a caixa de um comentario da timeline, que e o defeito
   * que esta funcao existe para nao repetir.
   */
  const raiz = fb.raizDoPost();
  if (!raiz || !raiz.contains(comentario.no)) {
    aviso('Este comentario nao esta mais no post aberto. Clique em "Reler a pagina".');
    return false;
  }

  const botao = fb.botaoResponder(comentario.no);
  if (!botao) {
    aviso('Nao achei o botao "Responder" deste comentario. Role ate ele aparecer na tela e releia.');
    return false;
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
    return false;
  }

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

function desenhar(shadow) {
  shadow.replaceChildren();

  /**
   * O empurrao acompanha o painel: escondido, a pagina volta ao tamanho dela.
   * Fica aqui e nao nos botoes porque sao tres caminhos que mudam `aberto` (os
   * dois botoes e a montagem), e tres chamadas separadas divergiriam — a
   * mesma razao do `gravar` carimbar a versao do quadro num lugar so.
   */
  if (estado.aberto) dock.applyDock(LARGURA);
  else dock.removeDock();

  const style = document.createElement('style');
  style.textContent = css();
  shadow.append(style);

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

  const status = document.createElement('div');
  status.className = 'status';
  status.textContent = estado.status;
  /**
   * O status mora no ESTADO e e procurado no shadow a cada escrita, nunca
   * guardado numa variavel: quem pede o rascunho redesenha o painel no meio do
   * caminho, e o elemento capturado antes disso ja saiu da arvore — a mensagem
   * iria para um no orfao e a tela ficaria muda justo depois da chamada paga.
   */
  const dizer = (t) => falar(shadow, t);

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
    vazio.textContent = fb.raizDoPost()
      ? 'Nenhum comentario sem resposta nesta tela.'
      : '';
    corpo.append(vazio);
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
    item.className = 'item' + (ehDaVez ? ' davez' : '');
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
    btIr.addEventListener('click', () => {
      c.no.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

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
   * **Clicar NUNCA insere na pagina**, so enche o campo. E a mesma fronteira da IA: ele le antes.
   */
  if (estado.respostas.length) {
    const tira = document.createElement('div');
    tira.className = 'rapidas';

    estado.respostas.forEach((r, i) => {
      // Da DECIMA em diante nao ha tecla: o mapa e 1..9, e numerar ate 12 ensinaria teclas que
      // nao existem. Essas so respondem ao clique.
      const tecla = i < 9 ? String(i + 1) : '';
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
      if (estado.gerindo) {
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
    });

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
    tira.append(engrenagem);

    rodape.append(tira);
  }

  const campo = document.createElement('textarea');
  campo.placeholder = 'O texto da resposta. Ele e ACRESCENTADO depois da mencao, e quem envia e voce.';
  campo.value = estado.texto;
  campo.addEventListener('input', () => {
    estado.texto = campo.value;
  });

  const linhaR = document.createElement('div');
  linhaR.className = 'linha';
  const btReler = document.createElement('button');
  btReler.textContent = 'R  Reler a pagina';
  btReler.addEventListener('click', async () => {
    relerComentarios();
    // Reler atualiza as DUAS coisas: este painel nao sabe quando ele troca de candidato no
    // mobiliza, entao e aqui que a tira do candidato certo chega.
    await carregarRespostas();
    desenhar(shadow);
  });

  const btGuardar = document.createElement('button');
  btGuardar.textContent = 'G  Guardar como rapida';
  btGuardar.disabled = !estado.texto.trim();
  // O botao e a tecla chamam a MESMA funcao: duas copias divergem na primeira correcao.
  btGuardar.addEventListener('click', () => guardarDoCampo(shadow));

  linhaR.append(btReler, btGuardar);

  /**
   * **A dica ensina SO o que nao esta escrito num botao.** As outras teclas vivem no proprio
   * botao (`1  Agradecer o apoio`, `⏎  Abrir e inserir`), que e o jeito do mobiliza; as setas nao
   * tem botao nenhum, entao sem esta linha elas seriam invisiveis.
   */
  if (estado.comentarios.length > 1) {
    const dica = document.createElement('div');
    dica.className = 'dica';
    dica.textContent = '↑ ↓ trocam o comentario da vez (o realcado)';
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
      if (!estado.aberto) return;
      if (ehCampoDeTexto(ev.composedPath?.()[0] || ev.target)) return;
      if (ev.key === 'Escape' && !ev.isTrusted) return;
      if (ev.ctrlKey || ev.altKey || ev.metaKey) return;

      // Shift junto vale: os botoes mostram a tecla em MAIUSCULA, e caixa que ensina uma tecla e
      // recusa o jeito obvio de aperta-la e pior que caixa sem atalho.
      const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      const alvo = comentarioDaVez();
      const feito = () => {
        ev.preventDefault();
        ev.stopPropagation();
      };

      if (k === 'Escape') {
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
        estado.daVezId = estado.comentarios[prox].id;
        feito();
        desenhar(shadow);
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
        pedirRascunho(alvo, (t) => falar(shadow, t), () => desenhar(shadow));
        return;
      }

      if (k === 'Enter') {
        if (!alvo || !estado.texto.trim()) return;
        feito();
        inserir(alvo, estado.texto.trim(), (t) => falar(shadow, t));
        return;
      }

      // 1..9: a enesima resposta rapida. Escolhe E insere, que e o esquema do mobiliza.
      if (/^[1-9]$/.test(k)) {
        const r = estado.respostas[Number(k) - 1];
        if (!r) return;
        feito();
        usarResposta(shadow, r);
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
    if (!estado.aberto) return;

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
