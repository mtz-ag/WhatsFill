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
 * filho, clique para editar. O problema do espaço se resolve com o quadro sendo maior que a tela —
 * ele anda pelo quadro, afasta e aproxima —, não encolhendo o desenho dele.
 *
 * ## Mover e ligar são gestos DIFERENTES
 *
 * Ligar era soltar uma caixa em cima de outra, porque antes do pino não havia outro jeito. Virou
 * armadilha no instante em que o pino nasceu: ele arruma o quadro, encosta uma caixa na outra sem
 * querer, e o ramo troca de pai — *"está removendo ligação quando tem mais de uma"* (01/09/2026,
 * com o print). Num quadro cheio a 35% de zoom as caixas têm 91px: encostar é o normal, não a
 * exceção, e o gesto perigoso era o mesmo que o inofensivo.
 *
 * Hoje **arrastar só move** e **o pino é o único jeito de ligar**.
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
  ia: 'a IA decide',
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
  if (no.acao?.ia) return 'ia';
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
  if (no.acao?.ia) return 'a IA assume: escolhe uma resposta pronta sua, ou escala para você';
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
  if (no.nota) rodape.append(span('tem-nota', 'obs.'));
  const vitorias = Number(fluxo.vitorias?.[no.id] || fluxo.vitorias?.[no.regra] || 0);
  if (vitorias) rodape.append(span('venceu', `${vitorias}×`));
  d.append(rodape);

  /**
   * O PINO de ligação, na borda direita.
   *
   * Ligar duas caixas só existia arrastando uma em cima da outra, e ele perguntou *"como faço para
   * linkar as caixas?"* — ou seja, o gesto existia e era invisível. Um pino que se puxa é como
   * todo editor de diagrama faz, e ele fica do lado de onde o fio sai, que é o mesmo lugar de onde
   * os fios já saem. **É o único jeito de ligar** — arrastar a caixa em cima da outra ligava antes
   * e virou armadilha assim que o pino nasceu; ver a nota no arrasto.
   */
  const pino = document.createElement('span');
  pino.className = 'pino';
  pino.dataset.pino = no.id;
  pino.title = 'SAÍDA: puxe daqui até outra caixa para pôr AQUELA dentro DESTA';
  d.append(pino);

  /**
   * A ENTRADA, na borda esquerda — o mesmo gesto no sentido contrário.
   *
   * Só havia a saída, e ele puxava de baixo para cima: *"as duas caixas de baixo eu quero ligar na
   * de cima e não liga"*. Explicar a direção não resolve, porque a direção certa depende de qual
   * das duas caixas ele está olhando na hora — e no quadro dele o filho está SEMPRE embaixo, então
   * o gesto natural é de baixo para cima.
   *
   * Agora os dois valem: puxar da SAÍDA de A até B põe B dentro de A; puxar da ENTRADA de B até A
   * põe B dentro de A. É a mesma ligação, dita das duas pontas, como em qualquer editor de nós.
   */
  const entrada = document.createElement('span');
  entrada.className = 'entrada-pino';
  entrada.dataset.entrada = no.id;
  entrada.title = 'ENTRADA: puxe daqui até outra caixa para pôr ESTA dentro DAQUELA';
  d.append(entrada);

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
  const c = { envia: 0, silencio: 0, gente: 0, depende: 0, ia: 0, porta: 0, off: 0 };
  for (const { no } of arvoreLib.todosOsNos(fluxo.arvore || [])) {
    if (no.desligado) c.off++;
    else c[efeitoDoNo(no) || 'porta']++;
  }
  const par = (classe, texto) => caixa.append(span(classe, texto));
  par('c-envia', `${c.envia} enviam`);
  par('c-silencio', `${c.silencio} não enviam`);
  par('c-gente', `${c.gente} pedem você`);
  if (c.ia) par('c-ia', `${c.ia} a IA decide`);
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
/** As caixas dos ramos que estão DENTRO deste — as que acompanham um arrasto com Shift. */
function descendentesNaTela(id) {
  const achado = arvoreLib.localizar(fluxo.arvore, id);
  if (!achado) return [];
  const ids = new Set(arvoreLib.todosOsNos(achado.no.filhos).map(({ no }) => no.id));
  return [...el('caixas').children].filter((c) => ids.has(c.dataset.no));
}

function ligarArrasto() {
  const caixas = el('caixas');
  let arrastando = null;
  /** A ligação sendo puxada de um pino até outra caixa. */
  let ligando = null;

  /** Onde o ponteiro está, em coordenadas do palco (o palco é movido e escalado). */
  const noPalco = (clienteX, clienteY) => {
    const area = el('quadro-area').getBoundingClientRect();
    return {
      x: (clienteX - area.left - vista.x) / vista.z,
      y: (clienteY - area.top - vista.y) / vista.z,
    };
  };

  /** O fio provisório, enquanto ele puxa do pino. Some ao soltar. */
  const desenharFioProvisorio = (de, para) => {
    let p = el('fios').querySelector('.fio-novo');
    if (!p) {
      p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('class', 'fio-novo');
      el('fios').append(p);
    }
    const meio = Math.max(30, (para.x - de.x) / 2);
    p.setAttribute('d', `M ${de.x} ${de.y} C ${de.x + meio} ${de.y}, ${para.x - meio} ${para.y}, ${para.x} ${para.y}`);
  };

  const limparFioProvisorio = () => el('fios').querySelector('.fio-novo')?.remove();

  /**
   * A frase que diz, DURANTE o arrasto, o que vai acontecer ao soltar.
   *
   * O pino puxa do pai para o filho: de A até B significa "B vai para dentro de A". Ele leu ao
   * contrário — puxou de duas caixas até a mesma caixa esperando ligá-las **a** ela, e cada
   * puxada tirava a caixa da anterior: *"ao acertar ele remove a outra caixa"* (01/09/2026).
   *
   * A direção não é adivinhável olhando um pino, e a seta do fio provisório não basta. O que
   * resolve é a frase com os DOIS nomes, e principalmente **de onde a caixa vai sair** quando ela
   * já tem pai — é essa metade que ele não estava vendo acontecer.
   */
  const dizerOQueVaiAcontecer = (alvoEl, origemId, invertido, clienteX, clienteY) => {
    const caixa = el('rotulo-ligacao');
    if (!alvoEl) {
      caixa.hidden = true;
      return;
    }
    const daArea = el('quadro-area').getBoundingClientRect();
    const naPonta = arvoreLib.localizar(fluxo.arvore, alvoEl.dataset.no);
    const naOrigem = arvoreLib.localizar(fluxo.arvore, origemId);
    // Quem entra em quem depende de qual pino ele puxou: saída manda para dentro, entrada vem.
    const filho = invertido ? naOrigem : naPonta;
    const paiNovo = invertido ? naPonta : naOrigem;
    const paiAtual = filho?.pai;

    caixa.replaceChildren();
    caixa.append(span('', `"${filho?.no?.rotulo || '?'}" vai para dentro de "${paiNovo?.no?.rotulo || '?'}"`));
    if (paiAtual) caixa.append(span('sai-de', `e sai de "${paiAtual.rotulo}"`));
    caixa.hidden = false;
    caixa.style.left = `${clienteX - daArea.left + 14}px`;
    caixa.style.top = `${clienteY - daArea.top + 16}px`;
  };

  caixas.addEventListener('pointerdown', (ev) => {
    const caixa = ev.target.closest('.caixa');
    if (!caixa || ev.button !== 0) return;
    ev.stopPropagation();

    // Os pinos ganham do arrasto: puxar deles é ligar, não mover.
    const naSaida = ev.target.closest('.pino');
    const naEntrada = ev.target.closest('.entrada-pino');
    if (naSaida || naEntrada) {
      const achado = arvoreLib.localizar(fluxo.arvore, caixa.dataset.no);
      if (!achado) return;
      ligando = {
        origem: caixa.dataset.no,
        // Puxando da ENTRADA, é ESTA caixa que vai para dentro da outra: o sentido se inverte.
        invertido: !!naEntrada,
        alvo: null,
        de: {
          x: naEntrada ? (achado.no.x || 0) : (achado.no.x || 0) + caixa.offsetWidth,
          y: (achado.no.y || 0) + caixa.offsetHeight / 2,
        },
      };
      caixa.classList.add('ligando');
      try {
        caixa.setPointerCapture(ev.pointerId);
      } catch (_) {
        // Ver a nota do arrasto: a exceção aqui deixaria o gesto preso.
      }
      return;
    }
    const achado = arvoreLib.localizar(fluxo.arvore, caixa.dataset.no);
    if (!achado) return;

    /**
     * **Arrastar move SÓ a caixa. O ramo inteiro só com Shift.**
     *
     * Era o contrário, e ele reclamou: *"quando arrasta um todos arrastam"* (01/09/2026). O motivo
     * é que os filhos não ficam colados ao pai neste quadro — ele os espalha —, então levar a
     * descendência junto atira meia dúzia de caixas para o outro lado da tela a cada ajuste de
     * layout. Num quadro em cadeia, quase toda caixa é pai de alguém, e o "quase sempre" virou
     * "sempre".
     *
     * Mover o ramo inteiro continua útil quando é ELE que quer (levar um bloco para outra área), e
     * aí é explícito. Fica escrito na dica do rodapé, que está sempre na tela: modificador que
     * ninguém vê é modificador que não existe.
     */
    const comFilhos = ev.shiftKey;
    arrastando = {
      id: caixa.dataset.no,
      elemento: caixa,
      comFilhos,
      // Com Shift, os filhos acompanham o arrasto na tela — senão eles só pulariam ao soltar, e o
      // salto some com a noção de para onde o bloco está indo.
      juntos: comFilhos ? descendentesNaTela(caixa.dataset.no) : [],
      partiuX: ev.clientX,
      partiuY: ev.clientY,
      origemX: achado.no.x || 0,
      origemY: achado.no.y || 0,
      andou: false,
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
    if (ligando) {
      desenharFioProvisorio(ligando.de, noPalco(ev.clientX, ev.clientY));
      const embaixo = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.caixa');
      const novo = embaixo && embaixo.dataset.no !== ligando.origem ? embaixo : null;
      if (novo !== ligando.alvo) {
        ligando.alvo?.classList.remove('alvo');
        /**
         * Só acende quem ACEITA: pôr um ramo dentro de um filho dele criaria ciclo e a ligação
         * seria recusada — acender ali prometeria um movimento que não vai acontecer.
         *
         * Quem é o filho e quem é o pai depende do pino que ele puxou, então a guarda também.
         */
        const filhoId = ligando.invertido ? ligando.origem : novo?.dataset.no;
        const paiId = ligando.invertido ? novo?.dataset.no : ligando.origem;
        const aceita = novo && !arvoreLib.ehDescendente(fluxo.arvore, filhoId, paiId);
        ligando.alvo = aceita ? novo : null;
        ligando.alvo?.classList.add('alvo');
      }
      dizerOQueVaiAcontecer(ligando.alvo, ligando.origem, ligando.invertido, ev.clientX, ev.clientY);
      return;
    }
    if (!arrastando) return;
    const dx = (ev.clientX - arrastando.partiuX) / vista.z;
    const dy = (ev.clientY - arrastando.partiuY) / vista.z;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) arrastando.andou = true;
    arrastando.elemento.style.transform = `translate(${dx}px, ${dy}px)`;
    for (const filho of arrastando.juntos) filho.style.transform = `translate(${dx}px, ${dy}px)`;
    arrastando.dx = dx;
    arrastando.dy = dy;
    /**
     * **Arrastar SÓ move. Não religa.**
     *
     * Antes de o pino existir, soltar uma caixa em cima de outra era o único jeito de ligar as
     * duas — e virou uma armadilha no instante em que o pino nasceu: ele arruma o quadro, encosta
     * uma caixa na outra sem querer, e o ramo troca de pai. A ligacão anterior some, calada, e o
     * que ele vê é *"está removendo ligação"* (relato dele, 01/09/2026, com o print).
     *
     * O gesto perigoso era o mesmo que o inofensivo, e num quadro cheio a 35% de zoom as caixas
     * têm 91px: encostar é o normal, não a exceção. Hoje mover é mover, e ligar é o pino.
     */
  });

  const soltar = async (ev) => {
    if (ligando) {
      const { origem, alvo, invertido } = ligando;
      limparFioProvisorio();
      el('rotulo-ligacao').hidden = true;
      caixas.querySelector('.ligando')?.classList.remove('ligando');
      alvo?.classList.remove('alvo');
      ligando = null;
      if (alvo) {
        // Da SAÍDA de A até B: B vai para dentro de A. Da ENTRADA de A até B: A vai para dentro
        // de B. É a mesma ligação, puxada de uma ponta ou da outra.
        const filhoId = invertido ? origem : alvo.dataset.no;
        const paiId = invertido ? alvo.dataset.no : origem;
        await gravar(arvoreLib.ordenarPorPosicao(arvoreLib.reparentar(fluxo.arvore, filhoId, paiId)));
      }
      return;
    }
    if (!arrastando) return;
    const { id, elemento, origemX, origemY, dx = 0, dy = 0, andou, comFilhos, juntos } = arrastando;
    elemento.classList.remove('arrastando');
    elemento.style.transform = '';
    for (const filho of juntos) filho.style.transform = '';
    arrastando = null;

    if (!andou) {
      // Clique, não arrasto: seleciona e abre o editor.
      selecionado = id;
      desenhar();
      return;
    }

    // Só posição. Quem muda a estrutura é o pino — ver a nota no pointerdown.
    const nova = arvoreLib.ordenarPorPosicao(arvoreLib.posicionar(fluxo.arvore, id, origemX + dx, origemY + dy, comFilhos));
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
          ['ia', 'a IA assume e responde'],
          ...TECLAS.map(([k, t]) => [`t:${k}`, `tecla ${k} · ${t}`]),
          ...respostas.map((r) => [`r:${r.id}`, `mandar "${r.name}" e concluir`]),
        ],
        acao.ia ? 'ia' : acao.resposta ? `r:${acao.resposta}` : acao.tecla ? `t:${acao.tecla}` : '',
        (valor) => {
          const nova = !valor
            ? null
            : valor === 'ia'
              ? { tecla: null, resposta: null, ia: true }
              : valor.startsWith('r:')
                ? { tecla: null, resposta: valor.slice(2) }
                : { tecla: valor.slice(2), resposta: null };
          gravar(arvoreLib.editar(fluxo.arvore, no.id, { acao: nova }));
        }
      )
    );
  }

  /**
   * As OBSERVAÇÕES — o campo que ele escreve para MIM, não para a extensão.
   *
   * Pedido dele (01/09/2026): *"cada caixa tenha um input para botar observações que vou escrever
   * para você modificar depois, principalmente as com código não editáveis"*. É a saída para o
   * único lugar do quadro que ele não pode mexer: a condição dos ramos de regra, que fica no
   * código porque decide o que sai para eleitor. Em vez de descrever de memória qual regra estava
   * errada, ele escreve na caixa e manda o fluxo inteiro depois.
   *
   * **Nada aqui muda a rodada**, de propósito: observação que mudasse comportamento sozinha
   * deixaria de ser recado e viraria condição sem teste.
   */
  const obs = document.createElement('textarea');
  obs.rows = 3;
  obs.value = no.nota || '';
  obs.placeholder = no.regra
    ? 'Ex.: essa regra está pegando quem só xingou o adversário — deveria ignorar terceira pessoa'
    : 'O que você quer que eu mude neste ramo';
  obs.addEventListener('change', () => gravar(arvoreLib.editar(fluxo.arvore, no.id, { nota: obs.value.trim() })));
  linha('Observações para o Claude', obs);

  /**
   * **Ligar sem gesto nenhum: escolher o pai numa lista.**
   *
   * O pino falhou duas vezes com ele — primeiro por ser invisível, depois porque a DIREÇÃO dele
   * (puxa do pai para o filho) é o contrário do que ele tentava fazer, e cada tentativa arrancava
   * a caixa do pai anterior. Gesto tem direção; lista não tem. Aqui ele lê a frase inteira — *"pôr
   * este ramo dentro de X"* — e não há como interpretar ao contrário.
   *
   * Os descendentes do próprio ramo ficam FORA da lista: pôr um ramo dentro de um filho dele seria
   * recusado, e oferecer uma opção que vai ser recusada é pior que não oferecer.
   */
  const dentroDe = arvoreLib
    .todosOsNos(fluxo.arvore)
    .filter(({ no: outro }) => outro.id !== no.id && !arvoreLib.ehDescendente(fluxo.arvore, no.id, outro.id))
    .map(({ no: outro, nivel }) => [outro.id, `${'— '.repeat(nivel)}${outro.rotulo || outro.id}`]);

  linha(
    'Pôr este ramo dentro de…',
    seletor([['', '— na raiz do quadro (sem pai) —'], ...dentroDe], achado.pai?.id || '', (valor) => {
      gravar(arvoreLib.ordenarPorPosicao(arvoreLib.reparentar(fluxo.arvore, no.id, valor || null)));
    })
  );

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

// ---- salvar, carregar e levar para fora -------------------------------------

/** As versões que ele guardou. Vive fora de `fluxo` para não crescer o objeto do quadro. */
let salvos = [];

function escreverAviso(linhas, tipo) {
  const caixa = el('aviso-arquivo');
  caixa.replaceChildren();
  caixa.className = `aviso-arquivo ${tipo || ''}`.trim();
  for (const linha of [].concat(linhas || [])) caixa.append(span('', linha));
}

function quandoFoi(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function desenharSalvos() {
  const caixa = el('salvos');
  caixa.replaceChildren();
  if (!salvos.length) {
    caixa.append(span('vazio', 'Nenhuma versão salva ainda.'));
    return;
  }
  for (const s of salvos) {
    const linha = document.createElement('div');
    linha.className = 'salvo';

    const nome = document.createElement('div');
    nome.className = 'salvo-nome';
    nome.append(document.createTextNode(s.nome));
    // Quantos ramos, e quantos ENVIAM: é o número que diz o tamanho da troca antes de fazê-la.
    nome.append(span('salvo-sub', `${quandoFoi(s.salvoEm)} · ${arvoreLib.todosOsNos(s.arvore).length} ramos, ${arvoreLib.quantosEnviam(s.arvore)} enviam`));

    const botoes = document.createElement('div');
    botoes.className = 'salvo-botoes';

    const carregar = document.createElement('button');
    carregar.type = 'button';
    carregar.className = 'btn';
    carregar.textContent = 'Carregar';
    carregar.addEventListener('click', () => aplicarFluxo(s.arvore, s.teclas, `a versão "${s.nome}"`));

    const apagar = document.createElement('button');
    apagar.type = 'button';
    apagar.className = 'btn btn-perigo';
    apagar.textContent = 'Apagar';
    apagar.addEventListener('click', async () => {
      if (!confirm(`Apagar a versão salva "${s.nome}"? O quadro de agora não muda.`)) return;
      salvos = salvos.filter((x) => x.id !== s.id);
      await store.set('fluxosSalvos', salvos);
      desenharSalvos();
    });

    botoes.append(carregar, apagar);
    linha.append(nome, botoes);
    caixa.append(linha);
  }
}

/**
 * Troca o quadro de trabalho por outro — de uma versão salva ou de um arquivo.
 *
 * **Pergunta antes, dizendo o tamanho da troca.** Carregar substitui o que decide as mensagens da
 * rodada; ver "23 ramos, 6 enviam" no lugar de "vai trocar?" é a diferença entre uma confirmação
 * que se lê e uma que se aperta no automático.
 */
async function aplicarFluxo(arvore, teclas, deOnde, avisos) {
  const nos = arvoreLib.todosOsNos(arvore).length;
  if (!confirm(`Carregar ${deOnde}? O quadro de agora é substituído por ${nos} ramos, ${arvoreLib.quantosEnviam(arvore)} deles enviando mensagem.`)) {
    return;
  }
  selecionado = null;
  caminhoDoTeste = [];
  fluxo = { ...fluxo, teclas: { ...(teclas || {}) } };
  let nova = arvoreLib.ordenarPorPosicao(arvore);
  if (arvoreLib.precisaArrumar(nova)) nova = arvoreLib.arrumar(nova);
  await gravar(nova);
  caberNaTela();

  /**
   * **Os avisos do arquivo continuam na tela DEPOIS de carregar.**
   *
   * Eles diziam o que a conferência descartou — regra que sumiu do código, sinal desconhecido,
   * tecla inventada —, e a linha de sucesso os apagava um instante depois. Ou seja: a informação
   * que justifica a peneira existir sumia justo quando ele passaria a olhar o quadro novo e a
   * estranhar um ramo faltando. Carregado com problema mostra os dois, em vermelho.
   */
  const lista = [].concat(avisos || []);
  if (lista.length) escreverAviso([`Carregado ${deOnde}, com o que a conferência descartou:`, ...lista], 'ruim');
  else escreverAviso(`Carregado: ${deOnde}.`, 'bom');
}

el('salvar').addEventListener('click', async () => {
  const nome = el('nome-fluxo').value.trim();
  if (!nome) {
    escreverAviso('Dê um nome para esta versão antes de salvar.', 'ruim');
    el('nome-fluxo').focus();
    return;
  }
  // Mesmo nome sobrescreve, e a pergunta é explícita: salvar duas "teste" e não saber qual é qual
  // é pior que perder a antiga sabendo.
  const existente = salvos.find((s) => s.nome.toLowerCase() === nome.toLowerCase());
  if (existente && !confirm(`Já existe uma versão chamada "${existente.nome}". Substituir?`)) return;

  const registro = {
    id: existente?.id || `s${Date.now().toString(36)}`,
    nome,
    salvoEm: new Date().toISOString(),
    teclas: { ...(fluxo.teclas || {}) },
    arvore: structuredClone(fluxo.arvore || []),
  };
  salvos = [registro, ...salvos.filter((s) => s.id !== registro.id)];
  await store.set('fluxosSalvos', salvos);
  el('nome-fluxo').value = '';
  desenharSalvos();
  escreverAviso(`Salvo: "${nome}".`, 'bom');
});

/**
 * Leva o fluxo para fora, num arquivo.
 *
 * `URL.createObjectURL` + link com `download`: a janela é uma página da própria extensão, então o
 * navegador salva sem pedir permissão nenhuma. As contagens de vitória ficam de fora — são medição
 * desta máquina, não o fluxo.
 */
el('exportar').addEventListener('click', () => {
  const nome = el('nome-fluxo').value.trim() || 'fluxo-whatsfill';
  const dados = arvoreLib.paraArquivo(fluxo, nome);
  const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nome.replace(/[^\w\-]+/g, '-').toLowerCase()}.json`;
  a.click();
  // Sem o revoke, cada exportação segura o conteúdo do arquivo na memória até a janela fechar.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  escreverAviso(`Exportado ${arvoreLib.todosOsNos(fluxo.arvore || []).length} ramos em ${a.download}.`, 'bom');
});

/**
 * Copia o fluxo INTEIRO em texto, para ele colar numa conversa comigo.
 *
 * Eu ia fazer um botão que copiava só as observações, e ele cortou na hora — *"não faz sentido eu
 * colar para você sem você ter a visão do fluxo"*. Está certo: *"essa aqui está pegando gente
 * demais"* não diz nada sem o ramo, a condição, o desfecho e a posição na árvore.
 *
 * A área de transferência precisa de gesto do usuário e pode ser negada; quando falha, o texto
 * aparece num campo pronto para selecionar. Botão que não faz nada e não explica é pior que um
 * passo a mais.
 */
el('copiar').addEventListener('click', async () => {
  const texto = arvoreLib.paraTexto(fluxo.arvore || [], { teclas: fluxo.teclas, respostas });
  const campo = el('saida-texto');
  const aviso = el('aviso-copia');
  try {
    await navigator.clipboard.writeText(texto);
    campo.hidden = true;
    aviso.textContent = `Copiado: ${arvoreLib.todosOsNos(fluxo.arvore || []).length} ramos. Cole na conversa com o Claude.`;
  } catch (_) {
    campo.value = texto;
    campo.hidden = false;
    campo.focus();
    campo.select();
    aviso.textContent = 'O navegador não deixou copiar sozinho — o texto está aí embaixo, selecionado. Use Ctrl+C.';
  }
});

el('importar').addEventListener('click', () => el('arquivo').click());

el('arquivo').addEventListener('change', async (ev) => {
  const arquivo = ev.target.files?.[0];
  ev.target.value = ''; // permite reimportar o MESMO arquivo depois de corrigi-lo fora
  if (!arquivo) return;

  let conteudo = '';
  try {
    conteudo = await arquivo.text();
  } catch (err) {
    escreverAviso(`Não consegui ler o arquivo: ${err?.message || err}`, 'ruim');
    return;
  }

  const lido = arvoreLib.deArquivo(conteudo);
  if (!lido.ok) {
    escreverAviso(`Não deu para importar: ${lido.erro}.`, 'ruim');
    return;
  }
  /**
   * **Os avisos aparecem ANTES de perguntar, e continuam depois.** Eles dizem o que o arquivo
   * perdeu na conferência; mostrá-los só depois de trocar o fluxo seria contar o que aconteceu em
   * vez de deixar ele decidir, e apagá-los ao carregar tira a explicação do ramo que vai faltar.
   */
  if (lido.avisos?.length) escreverAviso(['O arquivo tem problemas, e a conferência vai descartar:', ...lido.avisos], 'ruim');
  else escreverAviso([], '');

  await aplicarFluxo(lido.arvore, lido.teclas, `o arquivo "${arquivo.name}"`, lido.avisos);
});

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
      r.ia
        ? 'desfecho: a IA assume — escolhe uma resposta pronta, ou escala para você'
        : r.resposta
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
  if (confirm('Resetar para o fluxo PADRÃO? O quadro de agora é substituído, e as suas observações nos ramos se perdem junto — exporte antes se quiser guardá-las.')) {
    selecionado = null;
    await gravar(arvoreLib.arrumar(arvoreLib.fluxoPadrao()));
    caberNaTela();
  }
});

el('padrao').addEventListener('click', async () => {
  if (confirm('Deixar SÓ as regras do código, sem o padrão montado? Os ramos que você criou e as observações se perdem.')) {
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

  salvos = (await store.get('fluxosSalvos')) || [];
  desenharSalvos();
  desenharTeclas();
  ligarArrasto();
  ligarPanoramica();
  desenhar();
  caberNaTela();
})();
