/**
 * fluxo.js — a janela do fluxo: o QUADRO, do jeito que ele desenhou.
 *
 * ## Duas correções que ele fez em mim
 *
 * Ele mandou a foto do quadro dele e eu entreguei um esquema indentado, argumentando que o leque
 * horizontal não cabe quando a árvore cresce. Ele respondeu: *"a visualização continua sem ter
 * nenhuma referência com o que mandei, não posso arrastar editar etc"*. As duas coisas eram
 * verdade, e o argumento do espaço não compra o direito de entregar outra coisa — ele desenhou
 * caixas soltas ligadas por setas, e é isso que tem que aparecer.
 *
 * Então: **quadro livre**. Caixa que se arrasta para qualquer lugar, seta curva ligando pai e
 * filho, arrastar uma caixa em cima de outra para pendurar o ramo nela, clique para editar. O
 * problema do espaço se resolve com o quadro sendo maior que a tela — ele anda pelo quadro,
 * afasta e aproxima —, não encolhendo o desenho dele.
 *
 * ## A regra que o quadro livre exige
 *
 * Entre irmãos, **a caixa mais alta é olhada primeiro**. É a única regra honesta aqui: guardar uma
 * ordem invisível ao lado da posição faria a tela mostrar um ramo acima do outro e a rodada
 * obedecer o contrário. Ele decide a prioridade OLHANDO, e é assim que ela funciona.
 *
 * ## O que ele monta sozinho
 *
 * Escolha dele (01/09): a condição de um ramo é um SINAL da lista — coisas que o código já
 * reconhece, todas com teste — e/ou palavras que ele digita. A ação é uma tecla ou uma resposta
 * pronta. Nunca condição escrita à mão: o que decide isto sai para eleitor real.
 *
 * ## A trava que torna seguro ligar
 *
 * A árvore nasce sendo a tabela de hoje achatada, e o teste exige que as duas decidam igual em 400
 * contextos (`tests/arvore.test.mjs`). Abrir esta janela não muda a rodada; muda o que ele montar.
 */

import * as store from './lib/store.js';
import * as sugestaoLib from './lib/sugestao.js';
import * as arvoreLib from './lib/arvore.js';
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

const TECLAS = Object.entries(sugestaoLib.TECLAS).map(([k, v]) => [k, v.rotulo]);

const SELO = {
  envia: 'sai mensagem',
  silencio: 'não sai nada',
  gente: 'precisa de você',
  depende: 'depende',
};

const el = (id) => document.getElementById(id);

let fluxo = { ordem: [], desligadas: [], teclas: {}, vitorias: {}, arvore: null };
let respostas = [];
/** O ramo aberto no editor do lado. */
let selecionado = null;
/** O caminho que venceu no último teste, para acender as caixas e os fios. */
let caminhoDoTeste = [];
/** A vista: quanto o quadro está deslocado e em que zoom. */
let vista = { x: 40, y: 30, z: 1 };

async function gravar(nova) {
  fluxo = { ...fluxo, arvore: nova };
  await store.set('fluxo', fluxo);
  desenhar();
}

function span(classe, texto) {
  const s = document.createElement('span');
  if (classe) s.className = classe;
  s.textContent = texto;
  return s;
}

// ---- leitura de um nó, em português ----------------------------------------

function efeitoDoNo(no) {
  if (no.regra) return sugestaoLib.efeitoDaRegra(no.regra, fluxo);
  if (no.acao?.resposta) return 'envia';
  if (no.acao?.tecla) return sugestaoLib.TECLAS[no.acao.tecla]?.efeito || 'depende';
  return null;
}

function condicaoEmPortugues(no) {
  if (no.regra) return sugestaoLib.SOBRE[no.regra]?.quando || '';
  const cond = no.condicao || {};
  const partes = [];
  const sinal = arvoreLib.SINAIS.find((s) => s.id === cond.sinal);
  if (sinal) partes.push(cond.negar ? sinal.nao : sinal.rotulo);
  if ((cond.palavras || []).length) {
    partes.push(`escreveu "${cond.palavras.join('", "')}"${cond.onde === 'qualquer' ? ' (em qualquer mensagem)' : ''}`);
  }
  return partes.length ? partes.join(' E ') : 'qualquer contato que chegar aqui';
}

function acaoEmPortugues(no) {
  if (no.regra) {
    const ramos = sugestaoLib.ramosDaRegra(no.regra, fluxo);
    if (!ramos.length) return 'sem desfecho';
    return ramos.map((r) => `tecla ${r.tecla} · ${r.rotulo}`).join('  ou  ');
  }
  if (no.acao?.resposta) {
    const t = respostas.find((r) => r.id === no.acao.resposta);
    return `manda "${t?.name || no.acao.resposta}" e conclui`;
  }
  if (no.acao?.tecla) return `tecla ${no.acao.tecla} · ${sugestaoLib.TECLAS[no.acao.tecla]?.rotulo || '?'}`;
  return null;
}

// ---- o quadro ---------------------------------------------------------------

function aplicarVista() {
  el('palco').style.transform = `translate(${vista.x}px, ${vista.y}px) scale(${vista.z})`;
  el('nivelzoom').textContent = `${Math.round(vista.z * 100)}%`;
}

/**
 * Uma caixa do quadro.
 *
 * Ela carrega tudo que ele precisa ler sem abrir nada: o nome, a condição, o desfecho e a cor do
 * que o eleitor recebe. Editar é clicar; o formulário abre no lado, e não dentro da caixa, para o
 * quadro não mudar de tamanho a cada clique.
 */
function caixaDoNo(no) {
  const efeito = efeitoDoNo(no);
  const d = document.createElement('div');
  d.className = `caixa ${efeito || 'porta'}`;
  if (no.desligado) d.classList.add('off');
  if (selecionado === no.id) d.classList.add('sel');
  if (caminhoDoTeste.includes(no.id)) d.classList.add('aceso');
  d.dataset.no = no.id;
  d.style.left = `${no.x || 0}px`;
  d.style.top = `${no.y || 0}px`;

  const topo = document.createElement('div');
  topo.className = 'caixa-topo';
  const nome = document.createElement('b');
  nome.textContent = no.rotulo || '(sem nome)';
  topo.append(nome);
  if (no.regra) topo.append(span('marca-regra', 'do código'));
  d.append(topo);

  d.append(span('caixa-quando', condicaoEmPortugues(no)));

  const desfecho = acaoEmPortugues(no);
  if (desfecho) {
    const linha = span('caixa-entao', `→ ${desfecho}`);
    d.append(linha);
  } else if (!(no.filhos || []).length) {
    d.append(span('caixa-entao vazio', '→ não faz nada ainda'));
  }

  const rodape = document.createElement('div');
  rodape.className = 'caixa-rodape';
  if (efeito) rodape.append(span(`selo ${efeito}`, SELO[efeito]));
  else rodape.append(span('selo porta', 'só agrupa'));
  const vitorias = Number(fluxo.vitorias?.[no.id] || fluxo.vitorias?.[no.regra] || 0);
  if (vitorias) rodape.append(span('venceu', `${vitorias}×`));
  d.append(rodape);

  return d;
}

/**
 * Os fios entre pai e filho.
 *
 * Curva de Bézier saindo da direita do pai e entrando na esquerda do filho — é o traço do desenho
 * dele. Desenhados DEPOIS das caixas, medindo a altura real de cada uma: o texto de cada ramo tem
 * tamanho diferente, e fio calculado com altura fixa descola da caixa justamente nas maiores.
 */
function desenharFios() {
  const svg = el('fios');
  svg.replaceChildren();
  const caixas = new Map([...el('caixas').children].map((c) => [c.dataset.no, c]));

  let maiorX = 0;
  let maiorY = 0;
  const linhas = [];

  const anda = (nos) => {
    for (const no of nos || []) {
      const daqui = caixas.get(no.id);
      if (daqui) {
        maiorX = Math.max(maiorX, (no.x || 0) + daqui.offsetWidth);
        maiorY = Math.max(maiorY, (no.y || 0) + daqui.offsetHeight);
      }
      for (const filho of no.filhos || []) {
        const la = caixas.get(filho.id);
        if (daqui && la) {
          const x1 = (no.x || 0) + daqui.offsetWidth;
          const y1 = (no.y || 0) + daqui.offsetHeight / 2;
          const x2 = filho.x || 0;
          const y2 = (filho.y || 0) + la.offsetHeight / 2;
          const meio = Math.max(30, (x2 - x1) / 2);
          linhas.push({
            d: `M ${x1} ${y1} C ${x1 + meio} ${y1}, ${x2 - meio} ${y2}, ${x2} ${y2}`,
            aceso: caminhoDoTeste.includes(no.id) && caminhoDoTeste.includes(filho.id),
          });
        }
      }
      anda(no.filhos);
    }
  };
  anda(fluxo.arvore || []);

  svg.setAttribute('width', String(maiorX + 80));
  svg.setAttribute('height', String(maiorY + 80));
  const ns = 'http://www.w3.org/2000/svg';
  for (const linha of linhas) {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', linha.d);
    p.setAttribute('class', `fio${linha.aceso ? ' fio-aceso' : ''}`);
    svg.append(p);
  }

  // O palco acompanha o conteúdo, senão arrastar uma caixa para longe não abre espaço para ela.
  el('palco').style.width = `${maiorX + 120}px`;
  el('palco').style.height = `${maiorY + 120}px`;
}

function desenharProblemas() {
  const caixa = el('problemas');
  caixa.replaceChildren();
  const lista = arvoreLib.problemas(fluxo.arvore || []);
  caixa.classList.toggle('tem', lista.length > 0);
  for (const p of lista) caixa.append(span('problema', p));
}

function desenharResumo() {
  const caixa = el('contagem');
  caixa.replaceChildren();
  const c = { envia: 0, silencio: 0, gente: 0, depende: 0, porta: 0, off: 0 };
  for (const { no } of arvoreLib.todosOsNos(fluxo.arvore || [])) {
    if (no.desligado) c.off++;
    else c[efeitoDoNo(no) || 'porta']++;
  }
  const par = (classe, texto) => caixa.append(span(classe, texto));
  par('c-envia', `${c.envia} enviam`);
  par('c-silencio', `${c.silencio} não enviam`);
  par('c-gente', `${c.gente} pedem você`);
  if (c.depende) par('c-depende', `${c.depende} com dois desfechos`);
  if (c.porta) par('c-off', `${c.porta} só agrupam`);
  if (c.off) par('c-off', `${c.off} desligados`);
}

function desenhar() {
  desenharResumo();
  desenharProblemas();

  const alvo = el('caixas');
  alvo.replaceChildren();
  for (const { no } of arvoreLib.todosOsNos(fluxo.arvore || [])) alvo.append(caixaDoNo(no));

  desenharFios();
  desenharEditor();
  aplicarVista();
}

// ---- arrastar ---------------------------------------------------------------

/**
 * Arrastar uma caixa: move o ramo; soltando em cima de outra, pendura nela.
 *
 * Durante o arrasto só o `transform` da caixa muda — nada de redesenhar a cada pixel, que com
 * vinte caixas e os fios ficaria pesado e engasgado. Grava e redesenha uma vez, ao soltar.
 *
 * **Move o ramo inteiro, com os filhos.** Levar só o pai deixaria os filhos para trás, ligados por
 * fios atravessando o quadro — e um mapa em que o desenho não acompanha a estrutura mente.
 */
function ligarArrasto() {
  const caixas = el('caixas');
  let arrastando = null;

  caixas.addEventListener('pointerdown', (ev) => {
    const caixa = ev.target.closest('.caixa');
    if (!caixa || ev.button !== 0) return;
    ev.stopPropagation();
    const achado = arvoreLib.localizar(fluxo.arvore, caixa.dataset.no);
    if (!achado) return;

    arrastando = {
      id: caixa.dataset.no,
      elemento: caixa,
      partiuX: ev.clientX,
      partiuY: ev.clientY,
      origemX: achado.no.x || 0,
      origemY: achado.no.y || 0,
      andou: false,
      alvo: null,
    };
    /**
     * A captura é o que faz o arrasto continuar quando o ponteiro sai de cima da caixa — e ela
     * lança quando o `pointerId` já não está ativo (acontece com caneta, com toque que virou
     * gesto do navegador, e em automação). Sem o `try`, a exceção sobe no meio do `pointerdown`,
     * `arrastando` fica montado e a caixa gruda no ponteiro sem nunca soltar: exatamente o
     * sintoma de "não consigo arrastar", que é o que ele relatou.
     */
    try {
      caixa.setPointerCapture(ev.pointerId);
    } catch (_) {
      // Sem captura o arrasto ainda funciona enquanto o ponteiro estiver sobre o quadro.
    }
    caixa.classList.add('arrastando');
  });

  caixas.addEventListener('pointermove', (ev) => {
    if (!arrastando) return;
    const dx = (ev.clientX - arrastando.partiuX) / vista.z;
    const dy = (ev.clientY - arrastando.partiuY) / vista.z;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) arrastando.andou = true;
    arrastando.elemento.style.transform = `translate(${dx}px, ${dy}px)`;
    arrastando.dx = dx;
    arrastando.dy = dy;

    // Quem está embaixo do ponteiro? É onde o ramo vai ser pendurado.
    arrastando.elemento.style.pointerEvents = 'none';
    const embaixo = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.caixa');
    arrastando.elemento.style.pointerEvents = '';
    const novoAlvo = embaixo && embaixo !== arrastando.elemento ? embaixo : null;
    if (novoAlvo !== arrastando.alvo) {
      arrastando.alvo?.classList.remove('alvo');
      arrastando.alvo = novoAlvo;
      // Só acende o alvo que ACEITA o ramo: acender um destino que vai recusar é pior que não
      // acender nenhum, porque promete um movimento que não vai acontecer.
      if (novoAlvo && !arvoreLib.ehDescendente(fluxo.arvore, arrastando.id, novoAlvo.dataset.no)) {
        novoAlvo.classList.add('alvo');
      } else {
        arrastando.alvo = null;
      }
    }
  });

  const soltar = async (ev) => {
    if (!arrastando) return;
    const { id, elemento, origemX, origemY, dx = 0, dy = 0, alvo, andou } = arrastando;
    elemento.classList.remove('arrastando');
    elemento.style.transform = '';
    alvo?.classList.remove('alvo');
    arrastando = null;

    if (!andou) {
      // Clique, não arrasto: seleciona e abre o editor.
      selecionado = id;
      desenhar();
      return;
    }

    let nova = arvoreLib.posicionar(fluxo.arvore, id, origemX + dx, origemY + dy, true);
    if (alvo) nova = arvoreLib.reparentar(nova, id, alvo.dataset.no);
    nova = arvoreLib.ordenarPorPosicao(nova);
    await gravar(nova);
  };

  caixas.addEventListener('pointerup', soltar);
  caixas.addEventListener('pointercancel', soltar);
}

/** Arrastar o FUNDO anda pelo quadro. É o que permite o quadro ser maior que a tela. */
function ligarPanoramica() {
  const area = el('quadro-area');
  let puxando = null;

  area.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('.caixa') || ev.button !== 0) return;
    puxando = { x: ev.clientX, y: ev.clientY, vx: vista.x, vy: vista.y };
    area.classList.add('puxando');
    try {
      area.setPointerCapture(ev.pointerId);
    } catch (_) {
      // Mesma razão do arrasto da caixa: sem captura ainda anda, com exceção trava tudo.
    }
  });
  area.addEventListener('pointermove', (ev) => {
    if (!puxando) return;
    vista.x = puxando.vx + (ev.clientX - puxando.x);
    vista.y = puxando.vy + (ev.clientY - puxando.y);
    aplicarVista();
  });
  const parar = () => {
    puxando = null;
    area.classList.remove('puxando');
  };
  area.addEventListener('pointerup', parar);
  area.addEventListener('pointercancel', parar);

  // Duplo clique no vazio cria um ramo ali — é como se desenha num quadro.
  area.addEventListener('dblclick', async (ev) => {
    if (ev.target.closest('.caixa')) return;
    const caixa = area.getBoundingClientRect();
    const x = Math.round((ev.clientX - caixa.left - vista.x) / vista.z);
    const y = Math.round((ev.clientY - caixa.top - vista.y) / vista.z);
    const novo = { ...arvoreLib.noVazio('ramo novo'), x, y };
    selecionado = novo.id;
    await gravar(arvoreLib.ordenarPorPosicao(arvoreLib.acrescentar(fluxo.arvore, null, novo)));
  });

  /**
   * A roda do mouse é o zoom — sem Ctrl, sem modificador nenhum (pedido dele, 01/09).
   *
   * `preventDefault` com `passive: false` porque o navegador rola a página por padrão; sem isso a
   * página inteira andaria junto. O lado direito não é afetado: o ouvinte vive no quadro, e a
   * coluna da direita continua rolando com a roda como qualquer painel.
   */
  area.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault();
      aproximarNoPonto(ev.deltaY < 0 ? 1.1 : 1 / 1.1, ev.clientX, ev.clientY);
    },
    { passive: false }
  );
}

/**
 * Aproxima ou afasta **ancorado num ponto** — o que estiver sob o ponteiro continua sob o ponteiro.
 *
 * Sem a âncora, o zoom cresce a partir do canto do palco: você aponta para uma caixa, gira a roda,
 * e ela foge da tela — num quadro grande isso obriga a arrastar o fundo atrás dela a cada passo.
 *
 * O fator é multiplicativo e não somado: passo fixo de 0,1 é 29% do caminho quando se está em 0,35
 * e 6% quando se está em 1,6, então afastar fica brusco e aproximar fica lento. Multiplicando, o
 * passo é o mesmo em qualquer nível.
 */
function aproximarNoPonto(fator, clienteX, clienteY) {
  const area = el('quadro-area').getBoundingClientRect();
  const antes = vista.z;
  const depois = Math.min(1.6, Math.max(0.35, Math.round(antes * fator * 100) / 100));
  if (depois === antes) return;

  const px = clienteX - area.left;
  const py = clienteY - area.top;
  vista.x = px - ((px - vista.x) / antes) * depois;
  vista.y = py - ((py - vista.y) / antes) * depois;
  vista.z = depois;
  aplicarVista();
}

/** Os botões de zoom: mesma conta, ancorada no meio da área visível. */
function aproximar(fator) {
  const area = el('quadro-area').getBoundingClientRect();
  aproximarNoPonto(fator, area.left + area.width / 2, area.top + area.height / 2);
}

/** Enquadra o quadro inteiro na área visível. */
function caberNaTela() {
  const area = el('quadro-area').getBoundingClientRect();
  const nos = arvoreLib.todosOsNos(fluxo.arvore || []).map(({ no }) => no);
  if (!nos.length) return;
  const largura = Math.max(...nos.map((n) => (n.x || 0))) + arvoreLib.CAIXA.largura + 40;
  const altura = Math.max(...nos.map((n) => (n.y || 0))) + arvoreLib.CAIXA.altura + 40;
  vista.z = Math.min(1, Math.max(0.35, Math.min((area.width - 40) / largura, (area.height - 40) / altura)));
  vista.x = 20;
  vista.y = 20;
  aplicarVista();
}

// ---- o editor do lado -------------------------------------------------------

function desenharEditor() {
  const caixa = el('editor');
  caixa.replaceChildren();
  const achado = selecionado ? arvoreLib.localizar(fluxo.arvore, selecionado) : null;

  if (!achado) {
    el('titulo-edicao').textContent = 'Nenhum ramo selecionado';
    el('ajuda-edicao').textContent = 'Clique numa caixa do quadro para editar a condição e o desfecho dela.';
    return;
  }

  const no = achado.no;
  el('titulo-edicao').textContent = no.rotulo || '(sem nome)';
  el('ajuda-edicao').textContent = achado.pai
    ? `Dentro de "${achado.pai.rotulo}" — só é olhado se aquele ramo casar.`
    : 'Na raiz do quadro.';

  const linha = (rotulo, campo) => {
    const l = document.createElement('label');
    l.className = 'campo';
    l.append(span('campo-rot', rotulo), campo);
    caixa.append(l);
  };
  const seletor = (opcoes, atual, aoMudar) => {
    const s = document.createElement('select');
    for (const [valor, rotulo] of opcoes) {
      const o = document.createElement('option');
      o.value = valor;
      o.textContent = rotulo;
      if (valor === (atual || '')) o.selected = true;
      s.append(o);
    }
    s.addEventListener('change', () => aoMudar(s.value));
    return s;
  };

  const nome = document.createElement('input');
  nome.type = 'text';
  nome.value = no.rotulo || '';
  nome.addEventListener('change', () => gravar(arvoreLib.editar(fluxo.arvore, no.id, { rotulo: nome.value.trim() || 'ramo sem nome' })));
  linha('Nome do ramo', nome);

  if (no.regra) {
    /**
     * Ramo respaldado por regra do código: a condição não se edita aqui.
     *
     * É o que preserva os testes das dezesseis regras, e a condição é o que decide o que sai para
     * eleitor. Ele troca o desfecho, desliga, move e pendura ramos mais específicos dentro.
     */
    const nota = document.createElement('p');
    nota.className = 'nota';
    nota.textContent = 'A condição deste ramo vem do código e tem teste — por isso não se edita aqui. Você pode trocar o desfecho, movê-lo, desligá-lo e pendurar ramos mais específicos dentro dele.';
    caixa.append(nota);
    caixa.append(span('leitura', condicaoEmPortugues(no)));

    const daRegra = sugestaoLib.REGRAS.find((r) => r.id === no.regra);
    const padrao = typeof daRegra?.tecla === 'function' ? 'dois desfechos, conforme o contexto' : `tecla ${daRegra?.tecla}`;
    linha(
      'Desfecho',
      seletor([['', `o do código (${padrao})`], ...TECLAS.map(([k, t]) => [k, `${k} · ${t}`])], fluxo.teclas?.[no.regra] || '', (valor) => {
        const teclas = { ...(fluxo.teclas || {}) };
        if (valor) teclas[no.regra] = valor;
        else delete teclas[no.regra];
        fluxo = { ...fluxo, teclas };
        store.set('fluxo', fluxo).then(desenhar);
      })
    );
  } else {
    const cond = no.condicao || {};
    const trocarCond = (mudanca) => gravar(arvoreLib.editar(fluxo.arvore, no.id, { condicao: { ...cond, ...mudanca } }));

    linha(
      'Quando o contato…',
      seletor([['', '— qualquer um que chegar aqui —'], ...arvoreLib.SINAIS.map((s) => [s.id, s.rotulo])], cond.sinal || '', (v) => trocarCond({ sinal: v }))
    );

    if (cond.sinal) {
      const inverter = document.createElement('label');
      inverter.className = 'chk';
      const c = document.createElement('input');
      c.type = 'checkbox';
      c.checked = !!cond.negar;
      c.addEventListener('change', () => trocarCond({ negar: c.checked }));
      inverter.append(c, span('', `ao contrário: ${arvoreLib.SINAIS.find((s) => s.id === cond.sinal)?.nao || 'não'}`));
      caixa.append(inverter);
    }

    const palavras = document.createElement('input');
    palavras.type = 'text';
    palavras.placeholder = 'bom dia, boa tarde, boa noite';
    palavras.value = (cond.palavras || []).join(', ');
    palavras.addEventListener('change', () => trocarCond({ palavras: palavras.value.split(',').map((p) => p.trim()).filter(Boolean) }));
    linha('E escreveu (vírgula separa; acento e maiúscula não importam)', palavras);

    linha(
      'Procurar as palavras',
      seletor(
        [
          ['ultima', 'só na última mensagem dela'],
          ['qualquer', 'em qualquer mensagem da conversa'],
        ],
        cond.onde || 'ultima',
        (v) => trocarCond({ onde: v })
      )
    );

    const acao = no.acao || {};
    linha(
      'Então…',
      seletor(
        [
          ['', '— nada: este ramo só agrupa outros —'],
          ...TECLAS.map(([k, t]) => [`t:${k}`, `tecla ${k} · ${t}`]),
          ...respostas.map((r) => [`r:${r.id}`, `mandar "${r.name}" e concluir`]),
        ],
        acao.resposta ? `r:${acao.resposta}` : acao.tecla ? `t:${acao.tecla}` : '',
        (valor) => {
          const nova = !valor
            ? null
            : valor.startsWith('r:')
              ? { tecla: null, resposta: valor.slice(2) }
              : { tecla: valor.slice(2), resposta: null };
          gravar(arvoreLib.editar(fluxo.arvore, no.id, { acao: nova }));
        }
      )
    );
  }

  const ligado = document.createElement('label');
  ligado.className = 'chk';
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = !no.desligado;
  chk.addEventListener('change', () => gravar(arvoreLib.editar(fluxo.arvore, no.id, { desligado: !chk.checked })));
  ligado.append(chk, span('', 'ligado (desligado, a rodada pula este ramo)'));
  caixa.append(ligado);

  const botoes = document.createElement('div');
  botoes.className = 'botoes';

  const dentro = document.createElement('button');
  dentro.type = 'button';
  dentro.className = 'btn';
  dentro.textContent = '+ Ramo dentro deste';
  dentro.addEventListener('click', async () => {
    const filho = { ...arvoreLib.noVazio('ramo novo'), x: (no.x || 0) + arvoreLib.CAIXA.largura + arvoreLib.CAIXA.colunaVaga, y: (no.y || 0) + (no.filhos || []).length * (arvoreLib.CAIXA.altura + arvoreLib.CAIXA.linhaVaga) };
    selecionado = filho.id;
    await gravar(arvoreLib.acrescentar(fluxo.arvore, no.id, filho));
  });

  const soltar = document.createElement('button');
  soltar.type = 'button';
  soltar.className = 'btn';
  soltar.textContent = 'Soltar na raiz';
  soltar.disabled = !achado.pai;
  soltar.addEventListener('click', () => gravar(arvoreLib.ordenarPorPosicao(arvoreLib.reparentar(fluxo.arvore, no.id, null))));

  const apagar = document.createElement('button');
  apagar.type = 'button';
  apagar.className = 'btn btn-perigo';
  apagar.textContent = 'Apagar';
  apagar.addEventListener('click', () => {
    const filhos = arvoreLib.todosOsNos([no]).length - 1;
    const texto = filhos ? `Apagar "${no.rotulo}" e os ${filhos} ramos que estão dentro dele?` : `Apagar "${no.rotulo}"?`;
    if (confirm(texto)) {
      selecionado = null;
      gravar(arvoreLib.apagar(fluxo.arvore, no.id));
    }
  });

  botoes.append(dentro, soltar, apagar);
  caixa.append(botoes);
}

/** A legenda das teclas. */
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

// ---- o simulador ------------------------------------------------------------

/**
 * Testa uma conversa contra o quadro de agora, e acende o caminho.
 *
 * **Diz o que não sabe, e isso é metade do valor.** Os sinais de conversa saem do texto colado; os
 * de CRM (etiqueta aplicada, modelo mapeado, pedido feito hoje) dependem do contato e ficam de
 * fora — está escrito na tela. Simulador que fingisse conhecer o CRM daria confiança falsa numa
 * mudança de prioridade, e prioridade errada manda mensagem errada para eleitor.
 */
function testar() {
  const linhas = el('conversa').value.split('\n').map((t) => t.trim()).filter(Boolean);
  const saida = el('resultado');
  saida.replaceChildren();
  saida.classList.add('tem');

  const escreve = (classe, texto) => {
    const d = document.createElement('div');
    d.className = classe;
    d.textContent = texto;
    saida.append(d);
  };

  if (!linhas.length) {
    escreve('fraco', 'Cole alguma coisa primeiro.');
    return;
  }

  const entrantes = linhas.map((texto) => ({ texto, tipo: 'TEXT' }));
  const nossaUltimaAt = Date.now() - 60 * 60 * 1000;
  const retornando = el('retornando').checked;

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
    textos: linhas,
    ultimoTexto: linhas[linhas.length - 1],
    jaRespondemosAntes: retornando,
    jaPediramDados: retornando,
    veioDeAnuncio: el('deanuncio').checked,
    podePerguntarAjuda: true,
    podePedirDados: true,
    podePerguntarInteresse: true,
    podeMandarMomento: true,
  };

  const r = arvoreLib.decidir(ctx, fluxo.arvore || [], fluxo);
  caminhoDoTeste = r?.caminho || [];

  if (r) {
    const nomes = (r.caminho || []).map((id) => arvoreLib.localizar(fluxo.arvore, id)?.no?.rotulo || id).join(' → ');
    escreve('venceu-linha', nomes);
    escreve(
      'fraco',
      r.resposta
        ? `desfecho: manda "${respostas.find((t) => t.id === r.resposta)?.name || r.resposta}" e conclui`
        : `desfecho: tecla ${r.tecla} · ${sugestaoLib.TECLAS[r.tecla]?.rotulo || '?'}`
    );
    escreve('fraco', `motivo na tela: ${r.motivo}`);
  } else {
    escreve('nada', 'Nenhum ramo resolveu.');
    escreve('fraco', 'Este caso iria para a IA — e é ela que decidiria.');
  }

  const achados = Object.entries(ctx)
    .filter(([k, v]) => v && typeof v !== 'boolean' && k !== 'textos' && k !== 'ultimoTexto')
    .map(([k]) => k);
  escreve('fraco', `sinais achados no texto: ${achados.length ? achados.join(', ') : 'nenhum'}`);

  desenhar();
}

// ---- ligação da tela --------------------------------------------------------

el('testar').addEventListener('click', testar);
el('mais').addEventListener('click', () => aproximar(1.1));
el('menos').addEventListener('click', () => aproximar(1 / 1.1));
el('ajustar').addEventListener('click', caberNaTela);
el('arrumar').addEventListener('click', () => gravar(arvoreLib.arrumar(fluxo.arvore)));

el('novo').addEventListener('click', async () => {
  // Nasce à vista, no canto de cima da área visível — caixa criada fora da tela parece que o
  // botão não fez nada.
  const novo = { ...arvoreLib.noVazio('ramo novo'), x: Math.round(-vista.x / vista.z) + 40, y: Math.round(-vista.y / vista.z) + 40 };
  selecionado = novo.id;
  await gravar(arvoreLib.ordenarPorPosicao(arvoreLib.acrescentar(fluxo.arvore, null, novo)));
});

el('quadro').addEventListener('click', async () => {
  if (confirm('Substituir o quadro de agora pelo desenho do quadro? As protecões (hater, denúncia, despedida, pergunta aberta) entram na frente da bifurcação.')) {
    selecionado = null;
    await gravar(arvoreLib.arrumar(arvoreLib.arvoreDoQuadro()));
    caberNaTela();
  }
});

el('padrao').addEventListener('click', async () => {
  if (confirm('Voltar às regras do código, como elas estão hoje? Os ramos que você criou se perdem.')) {
    selecionado = null;
    fluxo = { ...fluxo, teclas: {} };
    await gravar(arvoreLib.arrumar(arvoreLib.arvorePadrao({})));
    caberNaTela();
  }
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
  try {
    respostas = (await store.get('templates')) || [];
  } catch (_) {
    respostas = [];
  }

  /**
   * Semeia o quadro com a tabela de hoje, **carregando a ordem e as desligadas da versão em
   * lista**. Sem isso, abrir esta janela jogaria fora em silêncio o que ele já tinha arrastado.
   */
  let arvore = Array.isArray(fluxo.arvore) && fluxo.arvore.length ? fluxo.arvore : arvoreLib.arvorePadrao(fluxo);
  // Árvore de antes do quadro não tem posição, e caixa sem posição empilha tudo no canto.
  if (arvoreLib.precisaArrumar(arvore)) arvore = arvoreLib.arrumar(arvore);
  fluxo = { ...fluxo, arvore };
  await store.set('fluxo', fluxo);

  desenharTeclas();
  ligarArrasto();
  ligarPanoramica();
  desenhar();
  caberNaTela();
})();
