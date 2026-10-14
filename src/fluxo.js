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

/**
 * Os estados anteriores do quadro, do mais antigo para o mais recente.
 *
 * Nasceu de perda de dados real: *"acabei de perder todo meu trabalho"* (01/09/2026). Os botões que
 * substituem o quadro já perguntavam antes, mas **"Arrumar o quadro" não** — e ele reposiciona
 * TODAS as caixas de uma vez. Num quadro que ele arrumou à mão, isso é o trabalho inteiro.
 *
 * **Gravada no armazenamento, não só em memória.** Desfazer que morre ao fechar a janela não serve
 * para o caso que a criou: ele percebe o estrago, fecha para "ver se volta", e aí não volta mais.
 * Fica em chave PRÓPRIA — não dentro de `fluxo` — para não engordar o objeto que a janela lê e
 * grava a cada mexida.
 */
let historico = [];

/** Quantos passos guardar. Vinte cobre uma sessão de trabalho sem inchar o armazenamento. */
const TETO_HISTORICO = 20;

/**
 * Grava o quadro, empilhando o estado ANTERIOR.
 *
 * Empilhar aqui dentro, e não em cada botão, é o que faz o desfazer valer para as dezenove
 * chamadas de uma vez — inclusive as que eu ainda não escrevi. Todos os campos do editor gravam no
 * evento `change` (nunca `input`), então cada entrada da pilha é uma ação de verdade, e não uma
 * tecla digitada.
 */
async function gravar(nova, opcoes) {
  if (!opcoes?.semHistorico) {
    historico.push(JSON.parse(JSON.stringify(fluxo.arvore || [])));
    if (historico.length > TETO_HISTORICO) historico.shift();
    store.set('fluxoHistorico', historico).catch(() => {});
  }
  fluxo = { ...fluxo, arvore: nova };
  /**
   * **A origem é carimbada aqui, junto da gravação** — e não em cada botão, pelo mesmo motivo do
   * histórico logo acima: são quatro caminhos que substituem o quadro inteiro (importar, resetar
   * para o padrão, só as regras do código, carregar uma versão salva), e o quinto que eu ainda não
   * escrevi carimbaria errado se cada um tivesse que lembrar.
   *
   * Edição normal (arrastar, trocar condição) **não** mexe no carimbo: o quadro continua sendo o
   * que veio daquela versão, com as mexidas dele por cima.
   */
  if (opcoes?.origem) fluxo = { ...fluxo, origem: { ...opcoes.origem, em: new Date().toISOString() } };
  await store.set('fluxo', fluxo);
  desenhar();
}

/** A versão da extensão carregada. Fora da aba do mobiliza, é o único lugar que sabe disto. */
function versaoDaExtensao() {
  try {
    return chrome.runtime.getManifest?.().version || '';
  } catch (_) {
    return '';
  }
}

/**
 * Volta um passo.
 *
 * Não empilha o que está desfazendo: desfazer não é uma ação nova, e empilhá-la faria o botão
 * alternar entre dois estados para sempre em vez de andar para trás.
 */
async function desfazer() {
  if (!historico.length) return;
  const anterior = historico.pop();
  await store.set('fluxoHistorico', historico);
  selecionado = null;
  caminhoDoTeste = [];
  await gravar(anterior, { semHistorico: true });
}

function atualizarDesfazer() {
  const b = el('desfazer');
  if (!b) return;
  b.disabled = !historico.length;
  b.textContent = historico.length ? `↶ Desfazer (${historico.length})` : '↶ Desfazer';
  b.title = historico.length
    ? 'Volta o quadro ao estado anterior — Ctrl+Z'
    : 'Nada para desfazer nesta sessão';
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

/**
 * **"Exceto quando…"** em português, para a caixa e para a lista de regras.
 *
 * Devolve string vazia quando não há exceção — quem chama só acrescenta a linha se houver, para a
 * caixa não ganhar um rótulo vazio em todo ramo.
 */
/** Uma condição (ou exceção) em português. Vazia quando ela não diz nada. */
function umaCondicaoEmPortugues(c) {
  const partes = [];
  const sinal = arvoreLib.SINAIS.find((x) => x.id === c.sinal);
  if (sinal) partes.push(c.negar ? sinal.nao : sinal.rotulo);
  if ((c.palavras || []).length) {
    partes.push(
      `escreveu ${c.palavras.map((x) => `“${x}”`).join(' ou ')}` +
        (c.onde === 'qualquer' ? ' (em qualquer mensagem)' : ' (na última)')
    );
  }
  return partes.join(' e ');
}

function excecaoEmPortugues(no) {
  const todas = arvoreLib.excecoesDe(no).map(umaCondicaoEmPortugues).filter(Boolean);
  return todas.length ? `exceto quando: ${todas.join('  OU  ')}` : '';
}

/**
 * **TODAS as condições, ligadas por E** — pedido dele (04/09/2026): *"o fluxo trabalha com
 * prioridade quando devia estar trabalhando com condições e exceções"*. A caixa tem que se explicar
 * sozinha; era isso que uma condição só impedia.
 */
function condicaoEmPortugues(no) {
  const minhas = arvoreLib.condicoesDe(no).map(umaCondicaoEmPortugues).filter(Boolean);
  if (no.regra) {
    /**
     * **As situações juntadas aparecem separadas por OU** — pedido dele (04/09/2026): *"junte todas
     * as situações que são usadas na mesma tecla"*. A caixa é uma, e o cartão tem que dizer as duas
     * portas que levam a ela.
     */
    const situacoes = [no.regra, ...(no.tambemQuando || [])]
      .map((id) => sugestaoLib.SOBRE[id]?.rotulo || id)
      .filter(Boolean);
    const cabecalho = situacoes.length > 1 ? situacoes.join('  OU  ') : sugestaoLib.SOBRE[no.regra]?.quando || '';
    return [cabecalho, ...minhas].filter(Boolean).join(' E ');
  }
  return minhas.length ? minhas.join(' E ') : 'qualquer contato que chegar aqui';
}

function acaoEmPortugues(no) {
  if (no.regra) {
    const ramos = sugestaoLib.ramosDaRegra(no.regra, fluxo);
    if (!ramos.length) return 'sem desfecho';
    // O que sai vem primeiro; a tecla vai atrás, entre parênteses -- ela é detalhe do dedo dele na
    // caixa da rodada, não o assunto do quadro (relato de 04/09: *"a ordem está trocada"*).
    return ramos.map((r) => `${r.rotulo} (tecla ${sugestaoLib.mostrarTecla(r.tecla)})`).join('  ou  ');
  }
  if (no.acao?.ia) return 'a IA assume: escolhe uma resposta pronta sua, ou escala para você';
  if (no.acao?.resposta) {
    const t = respostas.find((r) => r.id === no.acao.resposta);
    return `manda "${t?.name || no.acao.resposta}" e conclui`;
  }
  if (no.acao?.tecla) return `${sugestaoLib.TECLAS[no.acao.tecla]?.rotulo || '?'} (tecla ${sugestaoLib.mostrarTecla(no.acao.tecla)})`;
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

  /**
   * **O QUE NÓS VAMOS MANDAR vem primeiro; a condição vem depois.**
   *
   * Relato dele (04/09/2026), com a print de uma caixa: *"no momento o fluxo se baseia no texto de
   * quem vem, eu quero me basear no que vamos falar e nas nossas respostas rápidas — na print a
   * ordem está trocada"*.
   *
   * Ele está certo, e o cartão dizia isso na cara: a linha grande era a descrição do CONTATO
   * ("só expressou apoio"), e o que sai para o eleitor ficava na última linha, pequeno, atrás de
   * uma seta. Um quadro que decide o que mandar tem que ser lido pelo que manda.
   *
   * O nome da caixa continua existindo, embaixo: ele é a etiqueta que os dois usam para apontar
   * para o mesmo lugar ("a caixa 2.7.3"). O que mudou é o que salta aos olhos.
   */
  const desfecho = acaoEmPortugues(no);
  const topo = document.createElement('div');
  topo.className = 'caixa-topo';
  const nome = document.createElement('b');
  nome.textContent = desfecho || ((no.filhos || []).length ? 'só agrupa outras caixas' : 'não faz nada ainda');
  topo.append(nome);
  if (no.regra) topo.append(span('marca-regra', 'do código'));
  d.append(topo);

  d.append(span('caixa-quando', `quando: ${condicaoEmPortugues(no)}`));
  const excCaixa = excecaoEmPortugues(no);
  if (excCaixa) d.append(span('caixa-exceto', excCaixa));

  d.append(span('caixa-nome', no.rotulo || '(sem nome)'));

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
  pino.title = 'Puxe daqui até outra caixa para pôr ESTA dentro DAQUELA';
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
  entrada.title = 'Puxe daqui até outra caixa para pôr ESTA dentro DAQUELA';
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

/**
 * **De quando é este quadro** — pedido dele (05/09/2026): *"o fluxo atualmente não fala qual versão
 * ele está utilizando"*.
 *
 * A pergunta é a que mais custa neste projeto. O quadro é uma **cópia** do padrão e nada entra
 * nele sozinho, então caixa nova do código só decide depois que ele importa — e nada na tela dizia
 * isso: o quadro dele passou o dia 05/09 no arranjo da 2.41.0 enquanto o padrão andava até a 2.55.0.
 *
 * São duas informações diferentes, e as duas ficam na linha:
 *
 *  - **a versão** de onde este quadro veio, que é um carimbo e pode envelhecer;
 *  - **quantas caixas do padrão de HOJE não estão aqui**, que é medido a cada desenho e não depende
 *    de ninguém ter lembrado de carimbar nada. É a mesma conta do cartão "O padrão mudou?" — a
 *    diferença é que aqui ela aparece sem ele precisar rolar até lá.
 *
 * Quadro montado antes disto existir não tem carimbo, e a linha diz **"versão desconhecida"**: pôr
 * a versão de agora seria responder a pergunta com um palpite.
 */
function desenharVersao() {
  const caixa = el('versao-quadro');
  if (!caixa) return;
  caixa.replaceChildren();

  const agora = versaoDaExtensao();
  const origem = fluxo.origem || null;
  const de = {
    padrao: 'do padrão',
    arquivo: 'de um arquivo',
    salvo: 'de uma versão salva',
    semeado: 'das regras do código',
  }[origem?.de] || '';

  caixa.append(
    span('v-rotulo', 'Quadro:'),
    span('v-versao', origem?.versao ? `${de} ${origem.versao}` : 'versão desconhecida'),
    span('v-sep', '·'),
    span('v-rotulo', `extensão ${agora || '?'}`)
  );

  // O que a comparação diz vale mais que o carimbo: ela é de agora.
  const { faltando, foraDeOrdem } = arvoreLib.diferencaDoPadrao(fluxo.arvore || []);
  if (faltando.length) {
    const alerta = span('v-atras', `${faltando.length} caixa(s) do padrão de hoje não estão aqui`);
    alerta.title = 'Veja em "O padrão mudou?", no lado direito — ou importe o fluxo de hoje.';
    caixa.append(alerta);
  } else if (foraDeOrdem.length) {
    /**
     * **"Em dia com o padrão" era uma afirmação FALSA quando só a ordem mudava** — e no quadro a
     * ordem é a prioridade. Print dele de 14/10/2026: o limite de 48h não decidia nada e o rodapé
     * dizia que o quadro estava em dia, porque a comparação só olhava presença.
     *
     * Não é alarme: a ordem ser diferente da do padrão é o normal (o arranjo é dele). O que a linha
     * faz é parar de AFIRMAR o contrário, e nomear as caixas que saíram do lugar.
     */
    const nomes = foraDeOrdem.slice(0, 3).map((no) => no.rotulo || no.regra || 'sem nome');
    const alerta = span('v-atras',
      `mesmas caixas do padrão, ${foraDeOrdem.length} em outra ordem: ${nomes.join(', ')}` +
        (foraDeOrdem.length > nomes.length ? '…' : ''));
    alerta.title =
      'No quadro a ordem é a prioridade, então isto muda o que a rodada faz. Pode ser escolha sua — ' +
      'se não for, mova a caixa, ou importe o fluxo de hoje.';
    caixa.append(alerta);
  } else {
    caixa.append(span('v-emdia', 'em dia com o padrão'));
  }
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
  atualizarDesfazer();
  desenharResumo();
  desenharVersao();

  const alvo = el('caixas');
  alvo.replaceChildren();
  for (const { no } of arvoreLib.todosOsNos(fluxo.arvore || [])) alvo.append(caixaDoNo(no));

  desenharFios();
  desenharEditor();
  // O catálogo mostra quantas caixas apontam para cada regra — pôr, apagar e desfazer mudam isso.
  desenharCatalogo();
  desenharDiferenca();
  aplicarVista();
}

/**
 * Onde o ponteiro está, em coordenadas do palco (o palco é movido e escalado).
 *
 * Fora de `ligarArrasto` porque o catálogo do lado precisa da mesma conta: largar uma regra no
 * quadro tem que pousar onde o ponteiro está, e não onde ele estaria se o quadro nunca tivesse
 * sido rolado nem aproximado.
 */
function noPalco(clienteX, clienteY) {
  const area = el('quadro-area').getBoundingClientRect();
  return {
    x: (clienteX - area.left - vista.x) / vista.z,
    y: (clienteY - area.top - vista.y) / vista.z,
  };
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
        const filhoId = ligando.origem;
        const paiId = novo?.dataset.no;
        const aceita = novo && !arvoreLib.ehDescendente(fluxo.arvore, filhoId, paiId);
        ligando.alvo = aceita ? novo : null;
        ligando.alvo?.classList.add('alvo');
      }
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
      const { origem, alvo } = ligando;
      limparFioProvisorio();
      caixas.querySelector('.ligando')?.classList.remove('ligando');
      alvo?.classList.remove('alvo');
      ligando = null;
      if (alvo) {
        /**
         * **Uma regra só, para os dois pinos: a caixa de onde você puxa é a que se move.**
         *
         * Os dois tinham direções opostas, e era isso que produzia *"ao tentar uma remove a
         * outra"* (01/09/2026): o pai que ele queria estava em cima, a mão alcançava a entrada
         * dele, e cada puxada movia a caixa de cima em vez de trazer a de baixo.
         *
         * Explicar a direção não resolveu em três tentativas — pino de saída, pino de entrada e a
         * frase ao vivo. O que resolve é **não haver direção para ler**: puxe de qualquer lado de
         * A até B e A entra em B. Duas caixas puxadas até a mesma viram duas filhas dela, e
         * nenhuma remove a outra.
         */
        const filhoId = origem;
        const paiId = alvo.dataset.no;
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
    nota.textContent = 'A condição deste ramo vem do código e tem teste — por isso não se edita aqui. Você pode trocar o desfecho, movê-lo, desligá-lo, pendurar ramos mais específicos dentro dele e pôr uma exceção abaixo.';
    caixa.append(nota);
    caixa.append(span('leitura', condicaoEmPortugues(no)));

    const daRegra = sugestaoLib.REGRAS.find((r) => r.id === no.regra);
    const padrao = typeof daRegra?.tecla === 'function' ? 'dois desfechos, conforme o contexto' : `tecla ${sugestaoLib.mostrarTecla(daRegra?.tecla)}`;
    linha(
      'Vamos mandar…',
      seletor([['', `o do código (${padrao})`], ...TECLAS.map(([k, t]) => [k, `${sugestaoLib.mostrarTecla(k)} · ${t}`])], fluxo.teclas?.[no.regra] || '', (valor) => {
        const teclas = { ...(fluxo.teclas || {}) };
        if (valor) teclas[no.regra] = valor;
        else delete teclas[no.regra];
        fluxo = { ...fluxo, teclas };
        store.set('fluxo', fluxo).then(desenhar);
      })
    );
  } else {
    /**
     * **O DESFECHO vem primeiro no editor, como no cartão** — relato dele (04/09/2026): *"eu quero
     * me basear no que vamos falar e nas nossas respostas rápidas; na print a ordem está trocada"*.
     *
     * Primeiro se escolhe o que NÓS vamos mandar; depois se escreve quando aquilo pode sair. Era o
     * contrário, e o contrário ensina a montar o quadro pelo texto de quem chega.
     */
    const acao = no.acao || {};
    linha(
      'Vamos mandar…',
      seletor(
        [
          ['', '— nada: este ramo só agrupa outros —'],
          ['ia', 'a IA assume e responde'],
          ...TECLAS.map(([k, t]) => [`t:${k}`, `tecla ${sugestaoLib.mostrarTecla(k)} · ${t}`]),
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

    const cond = no.condicao || {};
    const trocarCond = (mudanca) => gravar(arvoreLib.editar(fluxo.arvore, no.id, { condicao: { ...cond, ...mudanca } }));

    linha(
      'Só quando o contato…',
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

  }

  /**
   * **A EXCEÇÃO, e ela vale para os DOIS tipos de caixa** — pedido dele (03/09/2026): *"algo que
   * notei que está faltando nos ramos e em geral: condição de mandar mensagem e exceção"*.
   *
   * Fica fora do `if/else` de propósito. Na caixa de REGRA é o único jeito de estreitar o que o
   * código decide sem mexer no código — e estreitar é seguro: exceção nunca faz uma mensagem
   * passar a sair, só deixar de sair. Na caixa dele é a guarda que faltava, a mesma que a regra do
   * código carrega sozinha ("mande o modelo, exceto quando o modelo já está na conversa"), e é o
   * que tira o aviso de "esta caixa vai mandar de novo em toda passada".
   */
  /**
   * **As condições A MAIS** — pedido dele (04/09/2026): *"o fluxo trabalha com prioridade quando
   * devia estar trabalhando com condições e exceções; se todas condições são aceitas, enviar
   * mensagem de acordo"*.
   *
   * Fica fora do `if/else` de propósito, como a exceção: numa caixa de REGRA, condição a mais
   * ESTREITA o que o código decide, que é a forma segura de tocar numa regra sem mexer no código.
   *
   * Cada linha tem o seu "— tirar esta —" no próprio seletor: botão separado de remover, num
   * editor que já é comprido, é mais uma coisa para procurar.
   */
  const listaExtras = (campo, titulo, rotuloDaLinha, aviso) => {
    const atuais = no[campo] || [];
    const gravarLista = (nova) => gravar(arvoreLib.editar(fluxo.arvore, no.id, { [campo]: nova }));

    const t = document.createElement('p');
    t.className = 'nota';
    t.textContent = titulo;
    caixa.append(t);

    atuais.forEach((item, i) => {
      const trocar = (mudanca) => gravarLista(atuais.map((x, j) => (i === j ? { ...x, ...mudanca } : x)));

      /**
       * **O botão de tirar é um BOTÃO** — relato dele (04/09/2026): *"ficou sem botão de excluir
       * condição adicionada"*.
       *
       * Eu tinha posto o "tirar esta" como opção dentro do seletor de sinais, argumentando que um
       * botão a mais seria "mais uma coisa para procurar". É o oposto: ele procurou o botão e não
       * achou. É a lição que este projeto já registrou duas vezes (o arrastar e o pino):
       * **gesto invisível é gesto que não existe** — e esconder o destrutivo dentro da lista do
       * inofensivo é pior ainda, porque ninguém procura "apagar" numa lista de sinais.
       */
      const dupla = document.createElement('div');
      dupla.className = 'acoes';
      dupla.append(
        seletor(
          [['', '— escolha o sinal —'], ...arvoreLib.SINAIS.map((x) => [x.id, x.rotulo])],
          item.sinal || '',
          (v) => trocar({ sinal: v })
        )
      );
      const tirar = document.createElement('button');
      tirar.type = 'button';
      tirar.className = 'btn btn-perigo';
      tirar.textContent = 'Tirar';
      tirar.title = `Tirar ${rotuloDaLinha.toLowerCase()} ${i + 1}`;
      tirar.addEventListener('click', () => gravarLista(atuais.filter((_, j) => j !== i)));
      dupla.append(tirar);
      linha(`${rotuloDaLinha} ${i + 1}`, dupla);
      if (item.sinal) {
        const inv = document.createElement('label');
        inv.className = 'chk';
        const ci = document.createElement('input');
        ci.type = 'checkbox';
        ci.checked = !!item.negar;
        ci.addEventListener('change', () => trocar({ negar: ci.checked }));
        inv.append(ci, span('', `ao contrário: ${arvoreLib.SINAIS.find((x) => x.id === item.sinal)?.nao || 'não'}`));
        caixa.append(inv);
      }
    });

    const mais = document.createElement('button');
    mais.type = 'button';
    mais.className = 'btn';
    mais.textContent = aviso;
    mais.addEventListener('click', () =>
      gravarLista([...atuais, { sinal: '', negar: false, palavras: [], onde: 'ultima' }])
    );
    caixa.append(mais);
  };

  /**
   * **Juntar e separar situações** — pedido dele (04/09/2026): *"junte todas as situações que são
   * usadas na mesma tecla"*. A caixa fica uma só e as situações valem por OU.
   *
   * Só aparece em caixa de REGRA: juntar é somar situações do CÓDIGO, e cada uma traz as guardas
   * dela. Numa caixa dele, "mais situações" seria só outra caixa.
   *
   * **A lista de escolha esconde as que levam a outro desfecho.** Juntar duas situações de teclas
   * diferentes faria a caixa mandar uma coisa quando a outra casasse — que é o defeito que o
   * `problemas` acusa como "caixa que promete o que não cumpre".
   */
  if (no.regra) {
    const juntas = no.tambemQuando || [];
    const gravarJuntas = (nova) => gravar(arvoreLib.editar(fluxo.arvore, no.id, { tambemQuando: nova }));
    const meuDesfecho = sugestaoLib.SOBRE[no.regra]?.efeito;

    const t = document.createElement('p');
    t.className = 'nota';
    t.textContent =
      'OU TAMBÉM QUANDO — outras situações que levam a esta MESMA mensagem. Basta uma delas para a caixa decidir.';
    caixa.append(t);

    juntas.forEach((id, i) => {
      const dupla = document.createElement('div');
      dupla.className = 'acoes';
      dupla.append(span('', sugestaoLib.SOBRE[id]?.rotulo || id));
      const tirar = document.createElement('button');
      tirar.type = 'button';
      tirar.className = 'btn btn-perigo';
      tirar.textContent = 'Separar';
      tirar.addEventListener('click', () => gravarJuntas(juntas.filter((_, j) => j !== i)));
      dupla.append(tirar);
      linha(`Ou também quando ${i + 1}`, dupla);
    });

    const candidatas = sugestaoLib.REGRAS.filter(
      (r) => r.id !== no.regra && !juntas.includes(r.id) && sugestaoLib.SOBRE[r.id]?.efeito === meuDesfecho
    );
    if (candidatas.length) {
      linha(
        'Juntar outra situação',
        seletor(
          [['', '— escolha uma —'], ...candidatas.map((r) => [r.id, sugestaoLib.SOBRE[r.id]?.rotulo || r.id])],
          '',
          (v) => v && gravarJuntas([...juntas, v])
        )
      );
    }
  }

  listaExtras(
    'maisCondicoes',
    'E TAMBÉM — todas estas precisam ser verdade junto com a de cima. É o que faz a caixa decidir por ela mesma, em vez de depender da altura.',
    'E também quando…',
    '+ acrescentar condição'
  );

  const exc = no.excecao || {};
  const trocarExc = (mudanca) => gravar(arvoreLib.editar(fluxo.arvore, no.id, { excecao: { ...exc, ...mudanca } }));

  const tituloExc = document.createElement('p');
  tituloExc.className = 'nota';
  tituloExc.textContent = 'Exceção — quando isto for verdade, este ramo não decide nada e a rodada segue procurando abaixo.';
  caixa.append(tituloExc);

  linha(
    'Exceto quando o contato…',
    seletor([['', '— sem exceção —'], ...arvoreLib.SINAIS.map((x) => [x.id, x.rotulo])], exc.sinal || '', (v) => trocarExc({ sinal: v }))
  );

  if (exc.sinal) {
    const inverterExc = document.createElement('label');
    inverterExc.className = 'chk';
    const ce = document.createElement('input');
    ce.type = 'checkbox';
    ce.checked = !!exc.negar;
    ce.addEventListener('change', () => trocarExc({ negar: ce.checked }));
    inverterExc.append(ce, span('', `ao contrário: ${arvoreLib.SINAIS.find((x) => x.id === exc.sinal)?.nao || 'não'}`));
    caixa.append(inverterExc);
  }

  const palavrasExc = document.createElement('input');
  palavrasExc.type = 'text';
  palavrasExc.placeholder = 'obrigado, já recebi';
  palavrasExc.value = (exc.palavras || []).join(', ');
  palavrasExc.addEventListener('change', () =>
    trocarExc({ palavras: palavrasExc.value.split(',').map((x) => x.trim()).filter(Boolean) })
  );
  linha('Ou escreveu (vírgula separa)', palavrasExc);

  if ((exc.palavras || []).length) {
    linha(
      'Procurar essas palavras',
      seletor(
        [
          ['ultima', 'só na última mensagem dela'],
          ['qualquer', 'em qualquer mensagem da conversa'],
        ],
        exc.onde || 'ultima',
        (v) => trocarExc({ onde: v })
      )
    );
  }

  listaExtras(
    'maisExcecoes',
    'OU TAMBÉM — basta UMA destas ser verdade para a caixa não decidir nada. Exceção só estreita: nenhuma mensagem passa a sair por causa dela.',
    'Ou exceto quando…',
    '+ acrescentar exceção'
  );

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
   * **Marcar os ramos que ficam DENTRO deste.**
   *
   * Ele pediu dez vezes a mesma coisa — *"eu preciso que as duas liguem na mesma"* — e todo
   * caminho que eu dei era uma-por-vez-com-direção: o pino de saída, o pino de entrada, e a lista
   * "pôr este ramo dentro de". Ligar duas caixas na mesma é uma operação de **várias para uma**, e
   * nenhum arrasto expressa isso: cada puxada é uma ligação só, e quando ele pegava a ponta errada
   * a puxada seguinte desfazia a anterior.
   *
   * Aqui a operação inteira acontece num lugar. Ele seleciona a caixa de cima, marca as duas de
   * baixo, e as duas ficam. Sem direção, sem mira, sem ordem — as caixas marcadas SÃO os filhos.
   *
   * Desmarcar solta o ramo na raiz, e não o apaga: tirar de dentro nunca pode destruir nada.
   *
   * Os descendentes deste ramo ficam de fora da lista — pôr um ramo dentro de um filho dele seria
   * recusado, e oferecer o que vai ser recusado é pior que não oferecer.
   */
  const candidatos = arvoreLib
    .todosOsNos(fluxo.arvore)
    .filter(({ no: outro }) => outro.id !== no.id && !arvoreLib.ehDescendente(fluxo.arvore, no.id, outro.id));

  const campoFilhos = document.createElement('div');
  campoFilhos.className = 'campo';
  campoFilhos.append(span('campo-rot', `Ramos dentro deste (${(no.filhos || []).length} marcados)`));

  const lista = document.createElement('div');
  lista.className = 'lista-filhos';
  for (const { no: outro, nivel } of candidatos) {
    const item = document.createElement('label');
    item.className = 'chk item-filho';
    const marca = document.createElement('input');
    marca.type = 'checkbox';
    marca.checked = (no.filhos || []).some((f) => f.id === outro.id);
    marca.addEventListener('change', () => {
      const paiNovo = marca.checked ? no.id : null;
      gravar(arvoreLib.ordenarPorPosicao(arvoreLib.reparentar(fluxo.arvore, outro.id, paiNovo)));
    });
    item.append(marca, span('', `${'· '.repeat(nivel)}${outro.rotulo || outro.id}`));
    lista.append(item);
  }
  campoFilhos.append(lista);
  caixa.append(campoFilhos);

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

  /**
   * Duplicar leva o que está DENTRO junto, e o rótulo do botão diz isso quando há filhos — do
   * mesmo jeito que o Apagar avisa. Cópia que traz seis ramos sem avisar é surpresa.
   */
  const duplicar = document.createElement('button');
  duplicar.type = 'button';
  duplicar.className = 'btn';
  const dentroDele = arvoreLib.todosOsNos([no]).length - 1;
  duplicar.textContent = dentroDele ? `Duplicar (com ${dentroDele} dentro)` : 'Duplicar';
  duplicar.title = 'A cópia nasce logo abaixo, com a prioridade seguinte';
  duplicar.addEventListener('click', async () => {
    const r = arvoreLib.duplicar(fluxo.arvore, no.id);
    if (!r.id) return;
    selecionado = r.id;
    await gravar(arvoreLib.ordenarPorPosicao(r.arvore));
  });

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

  botoes.append(dentro, duplicar, soltar, apagar);
  caixa.append(botoes);
}

// ---- o catálogo das regras do código ----------------------------------------

/**
 * **A lista de onde as regras voltam para o quadro.**
 *
 * Pedido dele (01/09/2026): *"quando regras são apagadas tem que ter uma opção ou uma aba ali com a
 * lista de regras para arrastar pro fluxo novamente"*. O buraco era real e caro: apagar uma caixa
 * "do código" é reversível em um passo pelo Desfazer, e **irreversível depois disso** — a regra
 * continua viva no código, mas o único jeito de trazê-la de volta era "Resetar para o padrão", que
 * joga fora o arranjo inteiro feito à mão. Duas caixas apagadas custavam a tarde de trabalho.
 *
 * Mostra as dezesseis, com a marca de quantas caixas já apontam para cada uma. Repetir é legítimo —
 * o próprio padrão põe as mesmas sete regras dos dois lados da bifurcação de cidade —, então a
 * marca informa e o filtro "só as que estão fora" é dele.
 */
function desenharCatalogo() {
  const area = el('catalogo');
  area.replaceChildren();

  const busca = (el('busca-regra').value || '').trim().toLowerCase();
  const soFora = el('so-fora').checked;

  const lista = arvoreLib.catalogoDeRegras(fluxo.arvore || []).filter((r) => {
    if (soFora && r.quantasNoQuadro) return false;
    if (!busca) return true;
    return `${r.rotulo} ${r.id} ${r.quando}`.toLowerCase().includes(busca);
  });

  if (!lista.length) {
    area.append(span('vazio', soFora ? 'Todas as regras já estão no quadro.' : 'Nenhuma regra com esse nome.'));
    return;
  }

  for (const r of lista) {
    const item = document.createElement('div');
    item.className = 'regra-item';
    item.dataset.regra = r.id;
    item.title = r.quando || r.rotulo;

    const texto = document.createElement('div');
    texto.className = 'regra-item-texto';
    texto.append(span('regra-item-nome', r.rotulo));

    const selos = document.createElement('div');
    selos.className = 'regra-item-selos';
    if (r.efeito) selos.append(span(`selo ${r.efeito}`, SELO[r.efeito]));
    if (r.quantasNoQuadro) {
      selos.append(span('ja-no-quadro', r.quantasNoQuadro > 1 ? `já no quadro ${r.quantasNoQuadro}×` : 'já no quadro'));
    }
    texto.append(selos);
    if (r.quando) texto.append(span('regra-item-quando', r.quando));
    item.append(texto);

    /**
     * O botão faz o mesmo que o arrasto.
     *
     * Não é redundância: o quadro pode estar rolado longe ou muito afastado, e aí a mira do arrasto
     * é trabalho. A lição do "Ramos dentro deste" vale aqui — quando o gesto exige pontaria, a
     * lista tem que oferecer o caminho sem pontaria ao lado.
     */
    const por = document.createElement('button');
    por.type = 'button';
    por.className = 'btn';
    por.textContent = 'Pôr';
    por.title = 'Largar esta regra no meio da vista';
    por.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const vis = el('quadro-area').getBoundingClientRect();
      const meio = noPalco(vis.left + vis.width / 2, vis.top + vis.height / 3);
      await largarRegra(r.id, meio.x - arvoreLib.CAIXA.largura / 2, meio.y);
    });
    item.append(por);

    area.append(item);
  }
}

/**
 * Põe a regra no quadro, solta na raiz, na posição pedida.
 *
 * **Nasce na raiz de propósito**, e não dentro do ramo selecionado: na raiz ela é o último recurso
 * — só decide quando tudo acima falha —, enquanto dentro de um grupo ela passa a valer só naquele
 * ramo e pode roubar a vez de quem está embaixo. Largar uma regra que ENVIA num lugar que ele não
 * escolheu é o tipo de surpresa que este quadro existe para não ter. Ele pendura onde quiser
 * depois, com o pino.
 */
async function largarRegra(regra, x, y) {
  const no = arvoreLib.noDeRegraLivre(fluxo.arvore || [], regra, { x: Math.round(x), y: Math.round(y) });
  selecionado = no.id;
  await gravar(arvoreLib.ordenarPorPosicao(arvoreLib.acrescentar(fluxo.arvore, null, no)));
}

/**
 * Arrastar um item do catálogo até o quadro.
 *
 * O que acompanha o ponteiro é a **caixa de verdade** (`caixaDoNo` sobre um nó de mentira), e não
 * um retângulo genérico: ele vê o nome, o desfecho e a cor do que vai chegar lá antes de soltar. É
 * a mesma razão de o pino existir — o gesto tem que mostrar o que faz enquanto acontece.
 *
 * Ponteiro, e não o arrastar nativo do HTML: o quadro inteiro já é ponteiro (mover, ligar, andar,
 * zoom), e misturar os dois daria dois modelos de arrasto na mesma tela, com o nativo ignorando o
 * `vista.z` de que a conta de posição precisa.
 */
function ligarCatalogo() {
  const area = el('catalogo');
  let puxando = null;

  const soltarFantasma = () => {
    puxando?.fantasma?.remove();
    puxando?.item?.classList.remove('arrastando');
    el('quadro-area').classList.remove('recebendo');
    puxando = null;
  };

  const noQuadro = (ev) => {
    const vis = el('quadro-area').getBoundingClientRect();
    return ev.clientX >= vis.left && ev.clientX <= vis.right && ev.clientY >= vis.top && ev.clientY <= vis.bottom;
  };

  area.addEventListener('pointerdown', (ev) => {
    const item = ev.target.closest('.regra-item');
    if (!item || ev.button !== 0) return;
    if (ev.target.closest('button')) return; // o "Pôr" é clique, não arrasto

    const molde = { ...arvoreLib.noDeRegraLivre(fluxo.arvore || [], item.dataset.regra), x: 0, y: 0 };
    const fantasma = caixaDoNo(molde);
    fantasma.classList.add('fantasma');
    fantasma.style.left = '0px';
    fantasma.style.top = '0px';
    fantasma.style.width = `${arvoreLib.CAIXA.largura}px`;
    document.body.append(fantasma);

    puxando = { regra: item.dataset.regra, item, fantasma, moveu: false };
    item.classList.add('arrastando');
    // Ver a armadilha do `setPointerCapture`: ele LANÇA quando o id não está ativo, e a exceção no
    // meio do pointerdown deixaria o fantasma grudado no ponteiro sem soltar nunca.
    try {
      item.setPointerCapture(ev.pointerId);
    } catch (_) {
      /* segue sem captura: os ouvintes na janela dão conta */
    }
    ev.preventDefault();
  });

  window.addEventListener('pointermove', (ev) => {
    if (!puxando) return;
    puxando.moveu = true;
    puxando.fantasma.style.transform = `translate(${ev.clientX + 12}px, ${ev.clientY - 18}px)`;
    el('quadro-area').classList.toggle('recebendo', noQuadro(ev));
  });

  window.addEventListener('pointerup', async (ev) => {
    if (!puxando) return;
    const { regra, moveu } = puxando;
    const largar = moveu && noQuadro(ev);
    soltarFantasma();
    // Soltar fora do quadro não faz nada: desistir do arrasto tem que ser possível sem consequência.
    if (!largar) return;
    const p = noPalco(ev.clientX, ev.clientY);
    await largarRegra(regra, p.x, p.y);
  });

  window.addEventListener('pointercancel', soltarFantasma);
}

// ---- o que mudou no padrão --------------------------------------------------

/**
 * **A comparação entre este quadro e o padrão de hoje.**
 *
 * Relato dele (02/09/2026), depois de eu reordenar a chegada pelo anúncio várias vezes num dia:
 * *"a ramificação não foi atualizada"*. Estava certo, e o defeito é de desenho e não daquele dia:
 * este quadro é uma **cópia**, e melhoria no padrão nunca chegava nele. O único caminho de volta —
 * "Resetar para o padrão" — joga fora o arranjo feito à mão, que é exatamente o trabalho que ele não
 * quer perder. Então toda mudança minha no padrão era invisível ou custava o quadro dele.
 *
 * **Nada entra sozinho.** No quadro a posição é a prioridade: enfiar uma caixa nova por conta
 * própria mudaria o que a rodada faz sem ninguém escolher onde. Ele põe uma por uma, e arrasta.
 */
function desenharDiferenca() {
  const area = el('diferenca');
  area.replaceChildren();

  const { faltando, sobrando } = arvoreLib.diferencaDoPadrao(fluxo.arvore || []);

  if (!faltando.length && !sobrando.length) {
    area.append(span('vazio', 'Este quadro decide as mesmas coisas que o padrão de hoje.'));
    return;
  }

  if (faltando.length) {
    area.append(span('dif-titulo', `${faltando.length} no padrão e não aqui:`));
  }

  for (const no of faltando) {
    const item = document.createElement('div');
    item.className = 'regra-item';

    const texto = document.createElement('div');
    texto.className = 'regra-item-texto';
    texto.append(span('regra-item-nome', no.rotulo || '(sem nome)'));

    const selos = document.createElement('div');
    selos.className = 'regra-item-selos';
    const efeito = efeitoDoNo(no);
    if (efeito) selos.append(span(`selo ${efeito}`, SELO[efeito]));
    if (no.regra) selos.append(span('marca-regra', 'do código'));
    texto.append(selos);
    texto.append(span('regra-item-quando', condicaoEmPortugues(no)));
    item.append(texto);

    /**
     * Traz o ramo INTEIRO, e o botão diz quantas caixas vêm.
     *
     * Metade de um grupo não decide nada — "veio de um anúncio que eu reconheço" sem o filho dentro
     * é uma caixa que casa e não faz nada. E a lição do Duplicar vale igual: cópia que traz seis
     * ramos sem avisar é surpresa, então o número está no botão antes do clique.
     */
    const dentro = arvoreLib.todosOsNos([no]).length;
    const por = document.createElement('button');
    por.type = 'button';
    por.className = 'btn';
    por.textContent = dentro > 1 ? `Pôr (${dentro})` : 'Pôr';
    por.title = dentro > 1
      ? `Põe esta caixa e os ${dentro - 1} ramos que estão dentro dela, soltos na raiz do quadro`
      : 'Põe esta caixa solta na raiz do quadro';
    por.addEventListener('click', async () => {
      const vis = el('quadro-area').getBoundingClientRect();
      const meio = noPalco(vis.left + vis.width / 2, vis.top + vis.height / 3);
      const copia = {
        ...arvoreLib.comIdsNovos(JSON.parse(JSON.stringify(no))),
        x: Math.round(meio.x - arvoreLib.CAIXA.largura / 2),
        y: Math.round(meio.y),
      };
      selecionado = copia.id;
      await gravar(arvoreLib.ordenarPorPosicao(arvoreLib.acrescentar(fluxo.arvore, null, copia)));
    });
    item.append(por);

    area.append(item);
  }

  /**
   * O que é só dele. **Informação, não erro** — montar ramo que o padrão nunca teve é a razão de
   * esta janela existir. Aparece porque, olhando os dois lados, ele consegue dizer se é uma escolha
   * sua ou uma caixa que ficou para trás de uma versão antiga.
   */
  if (sobrando.length) {
    area.append(span('dif-titulo', `${sobrando.length} aqui e não no padrão (suas, ou de uma versão antiga):`));
    for (const no of sobrando) {
      area.append(span('dif-so-dele', `· ${no.rotulo || '(sem nome)'}`));
    }
  }
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
    carregar.addEventListener('click', () =>
      aplicarFluxo(s.arvore, s.teclas, `a versão "${s.nome}"`, null, {
        de: 'salvo',
        versao: s.origem?.versao || '',
        nome: s.nome,
      })
    );

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
async function aplicarFluxo(arvore, teclas, deOnde, avisos, origem) {
  const nos = arvoreLib.todosOsNos(arvore).length;
  if (!confirm(`Carregar ${deOnde}? O quadro de agora é substituído por ${nos} ramos, ${arvoreLib.quantosEnviam(arvore)} deles enviando mensagem.`)) {
    return;
  }
  selecionado = null;
  caminhoDoTeste = [];
  fluxo = { ...fluxo, teclas: { ...(teclas || {}) } };
  let nova = arvoreLib.ordenarPorPosicao(arvore);
  if (arvoreLib.precisaArrumar(nova)) nova = arvoreLib.arrumar(nova);
  await gravar(nova, { origem: origem || { de: 'arquivo', versao: '', nome: deOnde } });
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
    // De qual versão é o quadro que está sendo guardado — para carregá-lo de volta daqui a um mês
    // e a janela continuar sabendo dizer de quando ele é.
    origem: fluxo.origem ? { ...fluxo.origem } : null,
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
  // A versão que EXPORTOU. Reimportado, é o que a janela mostra — e é o que diz se aquele arquivo
  // guardado na pasta de downloads está atrás do padrão de hoje.
  const dados = arvoreLib.paraArquivo(fluxo, nome, versaoDaExtensao());
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
 * **Baixa o PADRÃO DE HOJE como arquivo** — pedido dele (03/09/2026), depois de eu lhe mandar o
 * arquivo por fora: *"me dê o botão de download, esse caminho ficou esquisito"*.
 *
 * Ele estava certo duas vezes. O caminho era mesmo esquisito (uma pasta temporária), e o problema
 * de fundo é pior: **ele dependia de mim para ter o fluxo atual.** Toda vez que eu mexesse no
 * padrão, o arquivo só chegaria nele se eu lembrasse de gerar e mandar — regra que exige alguém
 * lembrar não é regra, e este projeto já pagou por isso.
 *
 * Com o botão, o padrão de agora está sempre a um clique, na pasta de downloads dele, com nome e
 * versão no arquivo. Ele baixa e importa quando quiser.
 *
 * **Baixar não muda nada no quadro**, de propósito: é o vizinho seguro do "Resetar para o padrão",
 * que substitui tudo. Aqui ele fica com o arquivo na mão e decide depois.
 */
el('baixar-padrao').addEventListener('click', () => {
  const arvore = arvoreLib.arrumar(arvoreLib.fluxoPadrao());
  const versao = chrome.runtime.getManifest?.().version || '';
  const nome = `fluxo-padrao${versao ? '-' + versao : ''}`;
  // A versão também em campo próprio: o nome do arquivo ele renomeia, o carimbo fica.
  const dados = arvoreLib.paraArquivo({ arvore, teclas: {} }, nome, versao);

  const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nome}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  escreverAviso(
    `Baixado ${a.download}: ${arvoreLib.todosOsNos(arvore).length} ramos, ` +
      `${arvoreLib.quantosEnviam(arvore)} deles enviando. Seu quadro não mudou — use "Importar arquivo" quando quiser trocar.`,
    'bom'
  );
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

  await aplicarFluxo(lido.arvore, lido.teclas, `o arquivo "${arquivo.name}"`, lido.avisos, {
    de: 'arquivo',
    // Arquivo gerado antes de 2.56 não tem carimbo: fica vazio e a janela diz "versão
    // desconhecida". Pôr a versão de AGORA aqui seria carimbar como novo um quadro velho — que é
    // exatamente a confusão que este campo existe para desfazer.
    versao: lido.extensao || '',
    nome: arquivo.name,
  });
});

/** A legenda das teclas. */
function desenharTeclas() {
  const dl = el('teclas');
  dl.replaceChildren();
  for (const [k, texto] of TECLAS) {
    const dt = document.createElement('dt');
    dt.textContent = sugestaoLib.mostrarTecla(k);
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
          : `desfecho: tecla ${sugestaoLib.mostrarTecla(r.tecla)} · ${sugestaoLib.TECLAS[r.tecla]?.rotulo || '?'}`
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
el('desfazer').addEventListener('click', desfazer);

/**
 * Ctrl+Z, e **só fora de campo de texto**.
 *
 * Dentro de um `input` ou `textarea` o Ctrl+Z do navegador desfaz a digitação, que é o que ele
 * espera ali. Roubar o atalho faria o quadro voltar um passo enquanto ele só queria apagar uma
 * palavra que acabou de escrever.
 */
document.addEventListener('keydown', (ev) => {
  if (!(ev.ctrlKey || ev.metaKey) || ev.key.toLowerCase() !== 'z' || ev.shiftKey) return;
  if (ev.target.closest('input, textarea, select')) return;
  ev.preventDefault();
  desfazer();
});

/**
 * "Arrumar o quadro" reposiciona TODAS as caixas, e era o único botão que mexia em tudo sem
 * perguntar — o suspeito mais provável do trabalho que ele perdeu. Hoje pergunta, e mesmo que ele
 * confirme sem ler, o desfazer está a um clique.
 */
el('arrumar').addEventListener('click', () => {
  const quantas = arvoreLib.todosOsNos(fluxo.arvore || []).length;
  if (!confirm(`Reposicionar as ${quantas} caixas em colunas? O arranjo que você fez à mão se perde (dá para desfazer).`)) return;
  gravar(arvoreLib.arrumar(fluxo.arvore));
});

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
    await gravar(arvoreLib.arrumar(arvoreLib.fluxoPadrao()), {
      origem: { de: 'padrao', versao: versaoDaExtensao(), nome: 'o padrão desta versão' },
    });
    caberNaTela();
  }
});

el('padrao').addEventListener('click', async () => {
  if (confirm('Deixar SÓ as regras do código, sem o padrão montado? Os ramos que você criou e as observações se perdem.')) {
    selecionado = null;
    fluxo = { ...fluxo, teclas: {} };
    await gravar(arvoreLib.arrumar(arvoreLib.arvorePadrao({})), {
      origem: { de: 'semeado', versao: versaoDaExtensao(), nome: 'só as regras do código' },
    });
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

/**
 * O cabeçalho recolhe, e a escolha fica gravada.
 *
 * Gravada em `fluxo` porque é onde esta janela já lê e grava — e `arvore.paraArquivo` só exporta
 * `teclas` e `arvore`, então a preferência de tela não vaza para o arquivo que ele manda para
 * alguém.
 *
 * Recolhido some o título, a contagem, os botões e a linha de atalhos; sobra a faixa com o botão.
 * A roda do mouse continua dando zoom e o duplo clique continua criando ramo, então dá para
 * trabalhar o tempo todo assim.
 */
function aplicarCabecalho(oculto) {
  const topo = el('topo');
  const botao = el('alternar-topo');
  topo.classList.toggle('oculto', !!oculto);
  botao.textContent = oculto ? '▾ Mostrar controles' : '▴ Ocultar';
  botao.title = oculto
    ? 'Mostrar o título, a contagem e os botões'
    : 'Recolher e devolver a altura ao quadro (a roda do mouse continua dando zoom)';
  botao.setAttribute('aria-expanded', oculto ? 'false' : 'true');
}

el('busca-regra').addEventListener('input', desenharCatalogo);
el('so-fora').addEventListener('change', desenharCatalogo);

el('alternar-topo').addEventListener('click', async () => {
  const oculto = !el('topo').classList.contains('oculto');
  aplicarCabecalho(oculto);
  fluxo = { ...fluxo, cabecalhoOculto: oculto };
  await store.set('fluxo', fluxo);
});

// O rótulo já vale agora: `boot` é assíncrono e espera o armazenamento, e sem isto o botão ficaria
// em branco até a leitura voltar. Se ele tiver deixado recolhido, o `boot` corrige em seguida.
aplicarCabecalho(false);

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
  const tinhaQuadro = Array.isArray(fluxo.arvore) && fluxo.arvore.length;
  let arvore = tinhaQuadro ? fluxo.arvore : arvoreLib.arvorePadrao(fluxo);
  // Árvore de antes do quadro não tem posição, e caixa sem posição empilha tudo no canto.
  if (arvoreLib.precisaArrumar(arvore)) arvore = arvoreLib.arrumar(arvore);
  fluxo = { ...fluxo, arvore };
  /**
   * O quadro semeado agora nasce carimbado com a versão de agora — ele É a tabela desta versão.
   *
   * Quem já tinha quadro fica **sem** carimbo de propósito, e a janela diz "versão desconhecida":
   * carimbar um quadro antigo com a versão de hoje transformaria a pergunta que este campo existe
   * para responder numa mentira.
   */
  if (!tinhaQuadro) {
    fluxo = { ...fluxo, origem: { de: 'semeado', versao: versaoDaExtensao(), nome: 'as regras do código', em: new Date().toISOString() } };
  }
  await store.set('fluxo', fluxo);

  historico = (await store.get('fluxoHistorico')) || [];
  aplicarCabecalho(!!fluxo.cabecalhoOculto);

  salvos = (await store.get('fluxosSalvos')) || [];
  desenharSalvos();
  desenharTeclas();
  ligarArrasto();
  ligarPanoramica();
  ligarCatalogo();
  desenhar();
  caberNaTela();
})();
