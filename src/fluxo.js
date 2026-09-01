/**
 * fluxo.js — a janela do fluxo de atendimento.
 *
 * Pedido dele (01/09/2026): *"eu não pedi uma aba eu pedi uma janela inteira pra abrir e trabalhar,
 * com fluxos visuais"* — depois de eu ter entregado uma lista arrastável numa aba de 380px.
 *
 * ## Por que o mapa é RAMIFICADO (pedido dele, 01/09: *"quero que seja ramificado"*)
 *
 * A primeira versão desenhava um caminho só: cartão, seta do *"não casou ↓"*, cartão. Mas uma
 * regra não é uma linha, é uma **bifurcação** — o que ela faz quando CASA é o galho que importa,
 * porque é ele que chega no eleitor, e ele estava reduzido a um selo de três palavras no canto do
 * cartão. Hoje cada regra tem os dois galhos na tela: **casou →** o desfecho (a tecla, o que sai)
 * e **não casou ↓** a regra de baixo.
 *
 * Isso torna visível o que só se descobria lendo o código:
 *  - **três regras têm DOIS desfechos** conforme o contexto (`tecla` que é função) — quem lia o
 *    selo "depende" não tinha como saber que os dois lados eram "manda a do momento" e "conclui";
 *  - **fixar a tecla na janela colapsa a bifurcação** e muda o que sai, então o cartão passa a
 *    mostrar o efeito da tecla FIXADA, não o do código;
 *  - **a tecla 6 volta para a IA** (`!sugestao || sugestao.tecla === '6'` no painel), que é o
 *    contrário do que a leitura de cima para baixo sugeria.
 *
 * ## Sem plataforma no meio
 *
 * Esta janela **não fala com o mobiliza**. Ela só lê e grava `store.fluxo`, que é
 * `chrome.storage.local`. Isso a torna abrível a qualquer momento, sem aba aberta e sem token — e é
 * o que permite ele mexer no fluxo antes de começar a rodada, não durante.
 *
 * ## Sincronia com o painel
 *
 * `store.onChanged` já existe e o painel recarrega a configuração dele. Aqui a janela também
 * escuta: se ele mexer no fluxo pela janela com o painel aberto, os dois ficam iguais sem ninguém
 * recarregar nada.
 */

import * as store from './lib/store.js';
import * as sugestaoLib from './lib/sugestao.js';
import {
  semInteresse,
  conversaPedeRespostaPessoal,
  ultimaEhDespedida,
  ultimaEhSoReacao,
  conversaTemPerguntaAberta,
  soExpressaApoio,
  pedeAlgoIndefinido,
  rajadaEhSoRepasse,
  confirmaPresenca,
} from './lib/cortesia.js';

/**
 * O que cada tecla faz. Sai de `sugestao.js` de propósito: enquanto a lista morava aqui, nada
 * impedia uma regra apontar para uma tecla sem verbete, e nenhum teste alcançava isso.
 */
const TECLAS = Object.entries(sugestaoLib.TECLAS).map(([k, v]) => [k, v.rotulo]);

const SELO = {
  envia: 'sai mensagem',
  silencio: 'não sai nada',
  gente: 'precisa de você',
  depende: 'depende',
};

const el = (id) => document.getElementById(id);

/** O fluxo salvo. Mantido em memória para os controles não precisarem reler a cada clique. */
let fluxo = { ordem: [], desligadas: [], teclas: {}, vitorias: {} };

/** Qual regra venceu no último teste, e por qual galho — para destacar os dois no mapa. */
let venceuNoTeste = null;
let teclaNoTeste = null;

/** A linha sendo arrastada agora. */
let arrastando = null;

async function salvar(mudancas) {
  fluxo = { ...fluxo, ...mudancas };
  await store.set('fluxo', fluxo);
  desenhar();
}

/** Um `<span>` com classe e texto — o desenho é quase só isso. */
function span(classe, texto) {
  const s = document.createElement('span');
  if (classe) s.className = classe;
  s.textContent = texto;
  return s;
}

/**
 * Os ids na ordem da tela: primeiro as ligadas na ordem dele, depois as desligadas.
 *
 * Desligada continua APARECENDO — é por ela que se religa. Ela sai da numeração, não da tela.
 */
function idsParaMostrar() {
  const ligadas = sugestaoLib.ordenar({ ordem: fluxo.ordem, desligadas: fluxo.desligadas }).map((r) => r.id);
  const resto = sugestaoLib.REGRAS.map((r) => r.id).filter((id) => !ligadas.includes(id));
  return [...ligadas, ...resto];
}

function desenharContagem() {
  const desligadas = new Set(fluxo.desligadas || []);
  const c = { envia: 0, silencio: 0, gente: 0, depende: 0, off: 0 };
  for (const r of sugestaoLib.REGRAS) {
    if (desligadas.has(r.id)) {
      c.off++;
      continue;
    }
    // O efeito da tecla EFETIVA, não o do código: fixar a tecla muda o que sai, e a contagem do
    // topo é justamente o resumo de "quantas dessas mandam mensagem para gente de verdade".
    c[sugestaoLib.efeitoDaRegra(r.id, fluxo)]++;
  }
  const caixa = el('contagem');
  caixa.replaceChildren();
  const par = (classe, texto) => caixa.append(span(classe, texto));
  par('c-envia', `${c.envia} enviam mensagem`);
  par('c-silencio', `${c.silencio} não enviam`);
  par('c-gente', `${c.gente} precisam de você`);
  if (c.depende) par('c-depende', `${c.depende} com dois desfechos`);
  if (c.off) par('c-off', `${c.off} desligadas`);
}

function desenharTeclas() {
  const dl = el('teclas');
  dl.replaceChildren();
  for (const [k, texto] of TECLAS) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = texto;
    dl.append(dt, dd);
  }
}

/**
 * Uma folha do galho "casou": o desfecho que o eleitor recebe.
 *
 * A folha é o pedaço da tela que fala do ELEITOR, e por isso ela carrega o `se` do ramo: numa
 * regra de dois desfechos, "manda a mensagem do momento" e "conclui calado" são coisas muito
 * diferentes, e a condição que separa as duas não estava escrita em lugar nenhum.
 */
function folhaDoRamo(ramo, id) {
  const d = document.createElement('div');
  const efeito = ramo.efeito || 'depende';
  // O destaque do teste e da REGRA vencedora, nao da tecla: marcar por tecla acenderia o mesmo
  // desfecho em todas as regras que usam aquela tecla, e o mapa perderia o ponto do teste.
  const venceu = venceuNoTeste === id && teclaNoTeste === ramo.tecla;
  d.className = `folha ${efeito}${venceu ? ' folha-venceu' : ''}`;

  const topo = document.createElement('div');
  topo.className = 'folha-topo';
  topo.append(span('folha-tecla', `tecla ${ramo.tecla}`), span(`selo ${efeito}`, SELO[efeito]));

  d.append(topo, span('folha-rot', ramo.rotulo || 'tecla sem verbete'));
  if (ramo.se) d.append(span('folha-se', `se ${ramo.se}`));
  if (ramo.fixada) d.append(span('folha-fixada', 'tecla fixada por você'));
  // A tecla 6 não é o fim do fluxo: ela volta para a IA antes de parar em cima dele.
  if (ramo.tecla === '6') d.append(span('folha-ia', '↘ a IA ainda opina antes de parar em você'));
  return d;
}

/** O galho do "casou": a seta horizontal e as folhas. */
function ramoDaRegra(id) {
  const ramos = sugestaoLib.ramosDaRegra(id, fluxo);
  const caixa = document.createElement('div');
  caixa.className = 'ramo';
  caixa.append(span('casou', ramos.length > 1 ? 'casou · e aí' : 'casou'));

  const folhas = document.createElement('div');
  folhas.className = `folhas${ramos.length > 1 ? ' bifurca' : ''}`;
  for (const ramo of ramos) folhas.append(folhaDoRamo(ramo, id));
  caixa.append(folhas);
  return caixa;
}

/** O cartão da CONDIÇÃO, com os controles. O desfecho fica no galho, ao lado. */
function cartaoDaRegra(id, posicao, efeito) {
  const regra = sugestaoLib.REGRAS.find((r) => r.id === id);
  const sobre = sugestaoLib.SOBRE[id] || {};
  const off = (fluxo.desligadas || []).includes(id);

  const card = document.createElement('div');
  card.className = `regra ${efeito}${off ? ' off' : ''}${venceuNoTeste === id ? ' venceu-no-teste' : ''}`;

  const pos = span('pos', off ? '—' : String(posicao).padStart(2, '0'));

  const corpo = document.createElement('div');
  corpo.className = 'corpo';

  const linha1 = document.createElement('div');
  linha1.className = 'linha1';
  const nome = document.createElement('b');
  nome.textContent = sobre.rotulo || id;
  linha1.append(nome);

  corpo.append(linha1, span('ident', id), span('quando', sobre.quando || ''));

  // ---- controles ----
  const controles = document.createElement('div');
  controles.className = 'controles';

  const teclaDoCodigo = typeof regra.tecla === 'function' ? 'dois desfechos' : `tecla ${regra.tecla}`;
  const sel = document.createElement('select');
  const opcoes = [['', `desfecho do código (${teclaDoCodigo})`], ...TECLAS.map(([k, t]) => [k, `${k} · ${t}`])];
  for (const [valor, rotulo] of opcoes) {
    const opt = document.createElement('option');
    opt.value = valor;
    opt.textContent = rotulo;
    if (valor === (fluxo.teclas?.[id] || '')) opt.selected = true;
    sel.append(opt);
  }
  sel.addEventListener('change', () => {
    const teclas = { ...(fluxo.teclas || {}) };
    if (sel.value) teclas[id] = sel.value;
    else delete teclas[id];
    salvar({ teclas });
  });

  const liga = document.createElement('label');
  liga.className = 'liga';
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = !off;
  chk.addEventListener('change', () => {
    const novas = new Set(fluxo.desligadas || []);
    if (chk.checked) novas.delete(id);
    else novas.add(id);
    salvar({ desligadas: [...novas] });
  });
  liga.append(chk, span('', 'ligada'));

  const total = Object.values(fluxo.vitorias || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  const meu = Number(fluxo.vitorias?.[id] || 0);
  const venceu = span('venceu', total ? `venceu ${meu}× (${Math.round((meu / total) * 100)}%)` : 'sem medição ainda');

  controles.append(sel, liga, venceu);
  card.append(pos, corpo, controles);
  return card;
}

/**
 * Um passo do fluxo: a condição à esquerda, o desfecho à direita.
 *
 * O passo INTEIRO é o que se arrasta — não só o cartão. Arrastar a condição deixando o desfecho
 * para trás separaria as duas metades da mesma regra na tela.
 */
function passoDaRegra(id, posicao) {
  const efeito = sugestaoLib.efeitoDaRegra(id, fluxo);
  const off = (fluxo.desligadas || []).includes(id);
  const passo = document.createElement('div');
  passo.className = `passo ${efeito}${off ? ' off' : ''}`;
  passo.draggable = true;
  passo.dataset.regra = id;
  passo.append(cartaoDaRegra(id, posicao, efeito), ramoDaRegra(id));

  passo.addEventListener('dragstart', (ev) => {
    arrastando = passo;
    passo.classList.add('arrastando');
    ev.dataTransfer.effectAllowed = 'move';
    // Obrigatório: sem dado no dataTransfer o Firefox não inicia o arrasto.
    ev.dataTransfer.setData('text/plain', id);
  });
  passo.addEventListener('dragend', () => {
    passo.classList.remove('arrastando');
    arrastando = null;
    gravarOrdemDaTela();
  });
  passo.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    if (!arrastando || arrastando === passo) return;
    const meio = passo.getBoundingClientRect().top + passo.offsetHeight / 2;
    passo.parentElement.insertBefore(arrastando, ev.clientY < meio ? passo : passo.nextElementSibling);
  });

  return passo;
}

/**
 * Lê a ordem que está na tela e grava.
 *
 * A tela é a fonte: depois de arrastar, o DOM já está na ordem certa e ler dele evita manter um
 * segundo modelo em memória que pode divergir do que ele está vendo.
 */
function gravarOrdemDaTela() {
  const ids = [...el('cascata').children].map((n) => n.dataset.regra).filter(Boolean);
  if (ids.length) salvar({ ordem: ids });
}

function desenharCascata() {
  const caixa = el('cascata');
  caixa.replaceChildren();
  const desligadas = new Set(fluxo.desligadas || []);
  let posicao = 0;

  const ids = idsParaMostrar();
  ids.forEach((id, i) => {
    if (!desligadas.has(id)) posicao++;
    caixa.append(passoDaRegra(id, posicao));

    if (i < ids.length - 1) {
      const entre = document.createElement('div');
      entre.className = 'entre';
      entre.append(span('', 'não casou ↓'));
      caixa.append(entre);
    }
  });
}

function desenhar() {
  desenharContagem();
  desenharCascata();
}

/**
 * O simulador.
 *
 * **Diz o que não sabe, e isso é metade do valor.** Os sinais de conversa saem do texto colado; os
 * de CRM (etiqueta aplicada, modelo mapeado, pedido feito hoje) dependem do contato e ficam de
 * fora — está escrito na tela. Simulador que fingisse conhecer o CRM daria confiança falsa numa
 * mudança de ordem, e ordem errada manda mensagem errada para eleitor.
 */
function testar() {
  const linhas = el('conversa').value.split('\n').map((t) => t.trim()).filter(Boolean);
  const saida = el('resultado');
  saida.replaceChildren();
  saida.classList.add('tem');

  if (!linhas.length) {
    saida.append(span('fraco', 'Cole alguma coisa primeiro.'));
    return;
  }

  const entrantes = linhas.map((texto) => ({ texto, tipo: 'TEXT' }));
  // Uma hora atrás: é o que faz as regras de rajada e de presença olharem a conversa inteira.
  const nossaUltimaAt = Date.now() - 60 * 60 * 1000;

  const ctx = {
    semInteresse: semInteresse(entrantes),
    pedeRespostaPessoal: conversaPedeRespostaPessoal(entrantes, nossaUltimaAt),
    ultimaEhDespedida: ultimaEhDespedida(entrantes),
    ultimaEhSoReacao: ultimaEhSoReacao(entrantes),
    perguntaAberta: conversaTemPerguntaAberta(entrantes, nossaUltimaAt),
    soExpressaApoio: soExpressaApoio(entrantes, nossaUltimaAt, []),
    pedeAlgoIndefinido: pedeAlgoIndefinido(entrantes, nossaUltimaAt),
    rajadaEhSoRepasse: rajadaEhSoRepasse(entrantes, nossaUltimaAt),
    confirmaPresenca: confirmaPresenca(entrantes, nossaUltimaAt),
    // Suposições, para as regras poderem disparar. A tela avisa que são suposições.
    podePerguntarAjuda: true,
    podePedirDados: true,
    podePerguntarInteresse: true,
    podeMandarMomento: true,
  };

  const r = sugestaoLib.sugerirAcao(ctx, fluxo);
  venceuNoTeste = r?.id || null;
  teclaNoTeste = r?.tecla || null;

  const linha = (classe, texto) => {
    const d = document.createElement('div');
    d.className = classe;
    d.textContent = texto;
    saida.append(d);
  };

  if (r) {
    const sobre = sugestaoLib.SOBRE[r.id] || {};
    linha('venceu-linha', `${sobre.rotulo || r.id} · tecla ${r.tecla}`);
    linha('fraco', `regra: ${r.id}`);
    linha('fraco', `motivo na tela: ${r.motivo}`);
    linha('fraco', `desfecho: ${sugestaoLib.TECLAS[r.tecla]?.rotulo || '?'}`);
  } else {
    linha('nada', 'Nenhuma regra casou.');
    linha('fraco', 'Este caso iria para a IA — e é ela que decidiria.');
  }

  const achados = Object.entries(ctx)
    .filter(([, v]) => v && typeof v !== 'boolean')
    .map(([k]) => k);
  linha('fraco', `sinais achados no texto: ${achados.length ? achados.join(', ') : 'nenhum'}`);

  desenhar();
}

// ---- ligação da tela -------------------------------------------------------

el('testar').addEventListener('click', testar);

el('padrao').addEventListener('click', () => {
  salvar({ ordem: [], desligadas: [], teclas: {} });
});

el('zerar').addEventListener('click', () => {
  salvar({ vitorias: {} });
});

/**
 * A rodada roda no painel, dentro da aba, e vai contando as vitórias. Sem isto a janela mostraria
 * a contagem congelada do momento em que foi aberta.
 */
chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area !== 'local' || !mudancas.fluxo) return;
  fluxo = { ...fluxo, ...(mudancas.fluxo.newValue || {}) };
  desenhar();
});

(async function boot() {
  fluxo = await store.get('fluxo');
  desenharTeclas();
  desenhar();
})();
