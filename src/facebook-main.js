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

const HOST_ID = 'whatsfill-facebook-host';
const VERSAO = chrome.runtime.getManifest().version;
const LARGURA = dock.DEFAULT_WIDTH;

const estado = {
  aberto: true,
  comentarios: [],
  aviso: '',
  texto: '',
  status: '',
};

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
    .item .quem { font-weight: 600; margin-bottom: 2px; }
    .item .txt { color: #333; white-space: pre-wrap; word-break: break-word; margin-bottom: 7px; }
    textarea {
      font: inherit; width: 100%; box-sizing: border-box; min-height: 64px;
      border: 1px solid #ccd0d5; border-radius: 6px; padding: 6px; resize: vertical;
    }
    .rodape { padding: 9px 10px; border-top: 1px solid #e4e6eb; background: #fafbfc; }
    .linha { display: flex; gap: 6px; align-items: center; margin-top: 7px; }
    .status { color: #65676b; margin-top: 6px; min-height: 16px; }
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
   * A raiz e relida AGORA, e nao a do desenho: entre listar e clicar ele pode
   * ter fechado o post. E o comentario tem de continuar DENTRO dela — senao
   * estariamos abrindo a caixa de um comentario da timeline, que e o defeito
   * que esta funcao existe para nao repetir.
   */
  const raiz = fb.raizDoPost();
  if (!raiz || !raiz.contains(comentario.no)) {
    aviso('Este comentario nao esta mais no post aberto. Clique em "Reler a pagina".');
    return;
  }

  const botao = fb.botaoResponder(comentario.no);
  if (!botao) {
    aviso('Nao achei o botao "Responder" deste comentario. Role ate ele aparecer na tela e releia.');
    return;
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
    return;
  }

  // A caixa ja vem com a mencao: isto ACRESCENTA, nunca substitui.
  const ok = fb.inserirNaCaixa(caixa, texto);
  aviso(
    ok
      ? `Texto posto na caixa de ${comentario.autor}. Revise e envie — o envio e seu.`
      : 'O texto nao entrou na caixa. Clique dentro dela na pagina e tente de novo.'
  );
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
  const dizer = (t) => {
    estado.status = t;
    const atual = shadow.querySelector('.status');
    if (atual) atual.textContent = t;
  };

  if (!estado.comentarios.length) {
    const vazio = document.createElement('div');
    vazio.className = 'vazio';
    vazio.textContent = fb.raizDoPost()
      ? 'Nenhum comentario sem resposta nesta tela.'
      : '';
    corpo.append(vazio);
  }

  for (const c of estado.comentarios) {
    const item = document.createElement('div');
    item.className = 'item';

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
    btInserir.textContent = 'Abrir e inserir';
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
    btIa.textContent = 'IA';
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

  const campo = document.createElement('textarea');
  campo.placeholder = 'O texto da resposta. Ele e ACRESCENTADO depois da mencao, e quem envia e voce.';
  campo.value = estado.texto;
  campo.addEventListener('input', () => {
    estado.texto = campo.value;
  });

  const linhaR = document.createElement('div');
  linhaR.className = 'linha';
  const btReler = document.createElement('button');
  btReler.textContent = 'Reler a pagina';
  btReler.addEventListener('click', () => {
    relerComentarios();
    desenhar(shadow);
  });
  linhaR.append(btReler);

  rodape.append(campo, linhaR, status);
  caixa.append(topo, corpo, rodape);
  shadow.append(caixa);
}

/* ------------------------------------------------------------------ */

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

    const digitando = shadow.activeElement && shadow.activeElement.tagName === 'TEXTAREA';
    if (digitando && !mudouDePost) return;

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
