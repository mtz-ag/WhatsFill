/**
 * panel.js — a interface do painel, que roda na janela própria (src/window.html).
 *
 * Ela não tem acesso ao DOM da plataforma: tudo que mexe na página passa por page.js
 * (mensagem para o content script). Chamadas de API, parser e storage rodam aqui mesmo.
 */

import * as api from '../lib/api.js';
import * as page from '../lib/page.js';
import * as fieldsLib from '../lib/fields.js';
import * as templatesLib from '../lib/templates.js';
import * as store from '../lib/store.js';
import * as vars from '../lib/vars.js';
import * as cities from '../lib/cities.js';
import * as tagsLib from '../lib/tags.js';
import * as hsmLib from '../lib/hsm.js';
import * as keepalive from '../lib/keepalive.js';
import * as categorizar from '../lib/categorizar.js';
import * as iaCliente from '../lib/ia-cliente.js';
import * as iaLib from '../lib/ia.js';
import * as gabineteLib from '../lib/gabinete.js';
import * as anunciosLib from '../lib/anuncios.js';
import * as observacoesLib from '../lib/observacoes.js';
import { extract, rebaixarParaPalpite } from '../lib/extract.js';
import { soCortesia } from '../lib/cortesia.js';
import { sugerirAcao } from '../lib/sugestao.js';
import * as sugestaoLib from '../lib/sugestao.js';
import * as arvoreLib from '../lib/arvore.js';
import { MSG_FLUXO } from '../lib/fluxo-msg.js';
import { ultimaEhSoReacao, conversaPedeRespostaPessoal, conversaTemPerguntaAberta, soExpressaApoio, rajadaEhSoRepasse, pedeAlgoIndefinido, pedeAjudaFinanceira, confirmaPresenca, ultimaEhDespedida, semInteresse, respostasApos, pedeEmprego, pedeLigacao, ehMensagemDaPlataforma, rajadaFinal, deOutroDia, perguntaPendente, informouEndereco } from '../lib/cortesia.js';
import { SENTINEL, SENTINEL_DATE_NEEDLES, SENTINEL_DATE_HUMANO } from '../lib/contract.js';
import { looksLikePlaceholder, nomeVeioDoPerfil, nomeSemSentido, nomeDivergeDoInformado } from '../lib/vars.js';

const GROUP_TEMPLATE_ID = 'link-grupo';
const THANKS_TEMPLATE_ID = 'agradecimento';
/**
 * As duas respostas que NEGAM: dinheiro e emprego. Quem as recebe ganha a etiqueta da Config.
 *
 * As mesmas de ia.RESTRITOS, e pela mesma razao de fundo: sao as de risco juridico (Lei
 * 9.504/97). La a lista impede a IA de escolhe-las; aqui ela diz quais deixam marca no CRM.
 */
const ETIQUETA_PEDIDO_IDS = ['pedido-ajuda', 'pedido-emprego'];
/** Agradece a mensagem e fecha, sem abrir demanda. É a saída da tecla 4. */
const THANKS_INFO_TEMPLATE_ID = 'agradecer-info';
const ASK_TEMPLATE_ID = 'pedir-dados';
/**
 * Valor especial do seletor da aba Cidades: filtrar por QUALQUER etiqueta de COREDE.
 *
 * Não é id de etiqueta nenhuma — é sentinela. Começa com `__` para nunca colidir com um id real
 * do CRM, que são uuid.
 */
const TODOS_OS_COREDES = '__todos_os_coredes__';
const INTEREST_TEMPLATE_ID = 'interesse-conteudo';
/** A pergunta dos sem retorno, em texto livre. Só chega dentro da janela de 24h. */
const NO_REPLY_TEMPLATE_ID = 'sem-retorno-interesse';

/**
 * Rótulo da lista de concluídos/arquivados. Texto, e não import do `dom.js`, porque o painel em
 * janela própria não tem o DOM da plataforma: isto atravessa a ponte de mensagens. Tem que ser
 * igual ao `ABA_CONCLUIDOS` de `src/lib/dom.js`.
 */
const ABA_CONCLUIDOS = 'Concluídos';

/**
 * @param {object} opts
 * @param {'dock'|'window'} [opts.mode] 'dock' = encaixado na aba (padrão do dia a dia)
 * @param {number} [opts.initialWidth] largura inicial no modo encaixado
 * @param {function} [opts.onResize] recebe a nova largura enquanto você arrasta
 * @param {function} [opts.onToggle] recebe true/false ao mostrar/esconder
 */
export function createPanel({ mode = 'window', initialWidth = 380, onResize, onToggle } = {}) {
  const docked = mode === 'dock';

  /** Trava contra reanálises sobrepostas: o estado da página é consultado a cada 500 ms. */
  let reexaminando = false;

  /**
   * Espera antes de carregar o contato que acabou de abrir.
   *
   * O `load()` disparava no instante em que a URL mudava — ou seja, **junto** com a plataforma
   * carregando aquele mesmo atendimento. Três requisições nossas (sessão, contato, conversa)
   * mais a rajada dela, no mesmo décimo de segundo, e o limitador de taxa do servidor recusa o
   * preflight: é o `Failed to fetch` que o CLAUDE.md já registra como capaz de derrubar a
   * plataforma junto. Passar a fila clicando de contato em contato multiplicava isso por item.
   *
   * 400 ms sai da frente do carregamento dela e junta os cliques rápidos num só — imperceptível
   * para quem está lendo a conversa, e é a diferença entre acompanhar a plataforma e disputar
   * com ela.
   */
  const ESPERA_LOAD_MS = 400;

  /**
   * Espera antes de reanalisar a conversa. Maior porque não há pressa nenhuma: é resposta do
   * contato chegando, e um segundo a mais não muda nada para quem está olhando.
   *
   * O sinal de conversa é `quantidade:último texto`, e ele muda VÁRIAS vezes enquanto a
   * plataforma renderiza a lista de mensagens. Cada mudança valia uma leitura da conversa — e,
   * se houvesse o que aplicar, uma GRAVAÇÃO com releitura junto. Abrir um contato com conversa
   * longa custava várias idas ao servidor que ninguém pediu.
   */
  const ESPERA_REEXAME_MS = 1200;

  let timerLoad = null;
  let timerReexame = null;

  /** A pergunta de cidade em curso, quando há uma. Impede duas caixas iguais na tela. */
  let perguntaDeCidade = null;
  /** Resposta que não é resposta: a caixa foi tirada da tela porque o contato mudou. */
  const CANCELADA = '__cidade-cancelada__';

  const state = {
    tab: 'respostas',
    pageState: { sessionId: null, isPending: false, hasComposer: false, dark: false, conversation: '' },
    session: null,
    contact: null,
    schema: [],
    classify: [],
    draft: {}, // fieldId -> { value, from, confidence, source, suggestions }
    tagSuggestions: [], // [{ origem, nome, tag, motivo, marcada }]
    /** A ordem/teclas/desligadas que ele editou na aba Fluxo. Vazio = ordem do codigo. */
    fluxo: { ordem: [], desligadas: [], teclas: {}, vitorias: {} },
    templates: [],
    hsmTemplates: [], // modelos aprovados da plataforma
    hsmFilter: '',
    hasContract: false, // contrato de escrita já aprendido?
    settings: {},
    /** Aba Automatizado: a rodada de tentativa de contato com quem não respondeu. */
    auto: {
      cfg: { templateId: '', templateName: '', limite: 20, pausaSeg: 8 },
      rodando: false,
      /**
       * **Esta rodada anda sozinha?** — vale para a rodada em curso, não é configuração.
       *
       * A caixa "Automatizar" da fila dos "Meus" mora em `cfg.automatizarComIA`; a dos "Novos" é
       * outra (`cfg.automaticoNovos`), e quem decide qual vale é a rodada que está rodando. Guardar
       * aqui em vez de passar pelo `ctx` é o que faz a **pergunta da cidade** enxergar a decisão:
       * ela nasce lá dentro do `saveClassification`, longe de quem chamou a rodada, e pergunta sem
       * dono trava a fila inteira em silêncio.
       */
      automatico: false,
      parar: false,
      fila: [], // retrato da fila da plataforma, só para conferência
      meusAbertos: { total: null, erro: '', quando: 0 },
      log: [], // { nome, resultado, motivo } de cada contato da rodada
      /**
       * Contatos desta rodada em que NENHUMA regra recomendou nada, por id de atendimento.
       *
       * Escrito num ponto só — logo depois de `sugerirAcao` —, e não em cada saída: são vinte
       * caminhos de `return` no tratamento de um contato, e marcar em cada um é o tipo de coisa
       * que fica errada no dia em que alguém acrescenta o vigésimo primeiro.
       *
       * Um mapa por id de atendimento (e não um contador) porque o mesmo contato pode passar
       * duas vezes na rodada — a fila devolve o concluído ao topo, está no `CLAUDE.md` — e
       * contar duas vezes inflaria a medida justamente no caso que já dá trabalho.
       *
       * Guarda `{ nome, texto }` e não só a contagem: o número diz QUANTO sobrou, e para
       * escrever a regra seguinte ele precisa saber O QUÊ. Dez casos lidos de uma vez mostram
       * que seis são a mesma situação — é assim que "refinar até sobrar pouca indecisão" deixa
       * de ser tentativa e erro.
       */
      semRegra: new Map(),
      /** Já avisei nesta rodada que confirmei o diálogo de conclusão? (uma vez basta) */
      avisouConfirmacao: false,
    },
    incoming: [],
    /** O que o contato mandou, com o tipo junto — é o que enxerga figura e figurinha. */
    entrantes: [],
    /** Quando saiu a NOSSA última mensagem — o sinal de "este contato já foi respondido". */
    nossaUltimaAt: null,
    /** O nome que a pessoa escreveu nesta conversa (palpite do parser), não o do cadastro. */
    nomeInformado: '',
    /** A cidade que o parser achou no que ELA escreveu: o palpite inteiro, ou `null`. */
    cidadeInformada: null,
    /**
     * O anúncio que o texto desta conversa reconhece: `{ anuncio, trecho }` ou `null`.
     *
     * Calculado em `refreshTagSuggestions` e lido em três lugares — as etiquetas, a ação da rodada
     * e o sinal do quadro do fluxo. Um lugar só porque reconhecer três vezes daria três respostas
     * diferentes assim que um deles olhasse outra lista de mensagens.
     */
    anuncio: null,
    /** Expressões que identificam a mensagem gerada pelo anúncio (Config). */
    padroesDeAnuncio: [],
    /** O que NÓS mandamos nesta conversa — para saber o que já foi, mesmo fora do painel. */
    nossas: [],
    /**
     * Cidades que você recusou no popup, enquanto este contato estiver aberto (normalizadas).
     *
     * Sem isto, recusar não adianta: `applyGuesses` só preenche buraco, recusar esvazia o campo,
     * e a próxima releitura da conversa (que roda sozinha quando o contato responde) devolve o
     * mesmo palpite e pergunta de novo. Some com a rodada e vira popup em laço.
     */
    cidadeRecusada: new Set(),
    /** A última mensagem da conversa, de qualquer lado — { doContato, at, texto } ou null. */
    ultimaMensagem: null,
    /**
     * Conferência de GRAFIA da cidade do contato aberto — `{ok, oficial, motivo}` ou null.
     *
     * Pedido dele: avisar ao INICIAR o atendimento quando a cidade está escrita errada, porque a
     * base tem cidade digitada à mão há anos. Fica no estado (e não recalculada no desenho) porque
     * `conferirGrafia` é assíncrona: chamada no render, o aviso piscaria a cada redesenho.
     */
    grafiaDaCidade: null,
    /**
     * Aba Cidades: a categorização da base por etiqueta de cidade.
     *
     * `analise` é o retrato da última varredura, e mora em memória de propósito — o dado de 57
     * mil contatos não cabe confortavelmente no `chrome.storage` e envelhece rápido (etiqueta
     * aplicada à mão, cidade corrigida). Recarregar o painel obriga a varrer de novo, e varrer é
     * barato; o que **é** persistido é o que já foi gravado, para os lotes não repetirem trabalho.
     */
    cidades: {
      lendo: false,
      gravando: false,
      parar: false,
      lidos: 0,
      total: null,
      analise: null,
      log: [],
      /** Tamanho do lote que o botão grava de uma vez. Lote pequeno é a decisão dele (15/08). */
      lote: 200,
      /**
       * Quantos contatos LER antes de parar. **0 = a base inteira, e é o padrão.**
       *
       * Nasceu em 500, para a primeira passada ser curta e provar que a cidade estava vindo antes
       * de gastar a varredura toda. Provou, e o teto virou estorvo: *"está parando e esperando eu
       * mandar a próxima página, faça isso sozinho"*. O campo fica, para quando ele quiser uma
       * amostra de propósito; o padrão é ir até o fim.
       */
      limiteLeitura: 0,
      /**
       * Onde a leitura parou, para CONTINUAR em vez de recomeçar.
       *
       * Sem isto, clicar de novo depois de uma parada relia da página 1 — o teto interrompia e o
       * botão refazia o mesmo trabalho, então a base nunca terminava de ser lida por mais que ele
       * clicasse. Era o defeito por baixo do relato, e o mais caro dos dois.
       */
      proximaPagina: 1,
      /** Os contatos já lidos, preservados entre paradas. */
      acumulados: [],
      /**
       * Busca por texto, opcional — o mesmo campo "Pesquisar" da tela de Contatos.
       *
       * Vazio usa a listagem simples. Com texto, usa `POST /core/v1/contact/filter`. Não existe
       * filtro por etiqueta no servidor (conferido no bundle), então filtrar por "quem tem
       * etiqueta" continua sendo trabalho nosso, depois de ler.
       */
      busca: '',
      /**
       * Id da etiqueta pela qual filtrar no servidor. Vazio = base inteira.
       * `TODOS_OS_COREDES` é o valor especial que manda todos os ids de região de uma vez.
       */
      etiquetaFiltro: '',
      /**
       * As etiquetas do CRM, para o seletor.
       *
       * Carregadas **no clique na aba** (`prepararCidades`), não no desenho: a aba não pode
       * gastar rede só porque o painel redesenhou por outro motivo.
       */
      etiquetasDisponiveis: [],
      /** O que impediu a lista de carregar, para a tela poder dizer em vez de ficar "carregando". */
      erroEtiquetas: '',
      /** Os ids das etiquetas que são COREDE, para a opção "todos os COREDEs". */
      idsDeCorede: [],
    },
    /** Configuração da avaliação por IA. Ver `renderConfigIA`. */
    ia: { ligada: false, modelo: 'claude-opus-5', regras: '' },
    /** Só se EXISTE chave, nunca a chave: chave visível no painel é chave que aparece em print. */
    iaTemChave: false,
    busy: false,
    lastSendAt: 0,
    error: null,
    connection: docked ? 'encaixado na aba' : 'procurando a aba do mobiliza…',
  };

  const root = h('div', { class: `wf-root ${docked ? 'wf-dock' : 'wf-window'}` });
  const header = h('header');
  const nav = h('nav');
  const body = h('div', { class: 'wf-body' });
  const status = h('div', { class: 'wf-status' });
  root.append(header, nav, body, status);

  if (docked) {
    root.style.setProperty('--wf-width', `${initialWidth}px`);
    root.append(buildHandle(), buildResizer());
  }

  /** Aba de mostrar/esconder, colada na borda esquerda do painel. */
  function buildHandle() {
    const handle = h('div', { class: 'wf-handle', title: 'Mostrar/esconder o WhatsFill' }, 'WhatsFill');
    handle.addEventListener('click', () => toggle());
    return handle;
  }

  /** Puxador de largura: arrastar para a esquerda alarga, e a página se ajusta junto. */
  function buildResizer() {
    const resizer = h('div', { class: 'wf-resizer', title: 'Arraste para mudar a largura' });

    resizer.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      resizer.setPointerCapture(ev.pointerId);
      const xInicial = ev.clientX;
      const larguraInicial = parseInt(root.style.getPropertyValue('--wf-width'), 10) || initialWidth;

      const mover = (e) => {
        const nova = larguraInicial + (xInicial - e.clientX);
        const aplicada = onResize ? onResize(nova) : nova;
        // onResize devolve a largura já limitada (ou uma promessa); usamos o limite local.
        const valor = typeof aplicada === 'number' ? aplicada : clampWidth(nova);
        root.style.setProperty('--wf-width', `${valor}px`);
      };
      const soltar = (e) => {
        resizer.releasePointerCapture(ev.pointerId);
        resizer.removeEventListener('pointermove', mover);
        resizer.removeEventListener('pointerup', soltar);
        mover(e);
      };

      resizer.addEventListener('pointermove', mover);
      resizer.addEventListener('pointerup', soltar);
    });

    return resizer;
  }

  function clampWidth(width) {
    return Math.min(700, Math.max(300, Math.round(Number(width) || initialWidth)));
  }

  function toggle() {
    const escondido = root.classList.toggle('wf-collapsed');
    if (onToggle) onToggle(!escondido);
    return !escondido;
  }

  for (const [id, label] of [
    ['respostas', 'Respostas'],
    ['automatizado', 'Automatizado'],
    ['dados', 'Dados'],
    ['cidades', 'Cidades'],
    ['config', 'Config'],
  ]) {
    const btn = h('button', { type: 'button' }, label);
    btn.dataset.tab = id;
    btn.addEventListener('click', () => {
      state.tab = id;
      // A Cidades é a única aba que precisa de rede só para se desenhar, e o carregamento nasce
      // AQUI, do clique — não do desenho. Ver `prepararCidades`.
      if (id === 'cidades') prepararCidades();
      renderAll();
    });
    nav.append(btn);
  }

  // ---- ciclo de vida ------------------------------------------------------

  /** Chamado no boot e sempre que a aba avisa que o estado da página mudou. */
  async function applyPageState(next) {
    const anterior = state.pageState;
    const sessionChanged = next.sessionId !== anterior.sessionId;

    // Durante a rodada automatizada quem troca de atendimento é a própria rodada, uma vez por
    // contato. Deixar o `load()` do observador entrar aqui carregaria o contato duas vezes e
    // ainda dispararia a classificação automática (que GRAVA) no meio de um envio.
    if (state.auto.rodando) {
      state.pageState = next;
      root.classList.toggle('wf-dark', !!next.dark);
      return;
    }
    const conversaMudou = next.conversation !== anterior.conversation;
    state.pageState = next;
    root.classList.toggle('wf-dark', !!next.dark);

    if (sessionChanged) {
      // Concluiu e foi para o próximo: é AQUI que o número muda. Só relógio não serve — ele
      // pediu justamente isso ("atendi e não atualizou"). Vai adiado e juntado: passar a fila
      // rápido não pode virar uma requisição por clique.
      agendarContagem();
      agendarLoad(next.sessionId);
      return;
    }

    renderAll();

    // Concluiu e FICOU na mesma conversa: o campo de mensagem some quando o atendimento fecha,
    // e é esse o sinal. Sem ele o contador só se mexeria ao abrir o próximo contato — e ele
    // relatou exatamente isso ("atendi e não atualizou").
    //
    // Não uso `conversaMudou` como gatilho: ele dispara a cada mensagem que chega, e viraria
    // uma requisição a cada poucos segundos numa conversa movimentada.
    if (anterior.hasComposer && !next.hasComposer) agendarContagem();

    // Mesmo atendimento, mensagem nova: o contato respondeu enquanto você olhava a conversa.
    // Sem isto o painel só reanalisaria quando você saísse do atendimento e voltasse.
    if (conversaMudou) agendarReexame();
  }

  /**
   * Carrega o contato **depois** de a plataforma respirar. Ver `ESPERA_LOAD_MS`.
   *
   * Cancelar o anterior é o que faz passar a fila rápido custar UM carregamento em vez de um por
   * contato: só o último clique vira requisição. A caixa de cidade some na hora, junto com o
   * estado do contato antigo — deixá-la na tela enquanto o novo carrega é como responder a
   * pergunta pela pessoa errada, que já aconteceu aqui.
   */
  function agendarLoad(sessionId) {
    clearTimeout(timerLoad);
    clearTimeout(timerReexame);
    cancelarPerguntaDeCidade();

    // A tela reage na hora, mesmo que a rede espere: sem isto o painel fica mostrando o contato
    // anterior e parece travado.
    state.contact = null;
    state.error = null;
    setStatus(sessionId ? 'Carregando contato…' : 'Abra um atendimento na plataforma para começar.');
    renderAll();

    timerLoad = setTimeout(() => {
      // A rodada pode ter começado no meio da espera: quem troca de atendimento ali é ela, e
      // um `load()` por fora carregaria o contato duas vezes e gravaria no meio de um envio.
      if (state.auto.rodando) return;
      load(sessionId);
    }, ESPERA_LOAD_MS);
  }

  /** Reanalisa a conversa depois que ela parar de mudar. Ver `ESPERA_REEXAME_MS`. */
  function agendarReexame() {
    clearTimeout(timerReexame);
    timerReexame = setTimeout(() => {
      if (state.auto.rodando) return;
      reexaminarMensagens();
    }, ESPERA_REEXAME_MS);
  }

  /**
   * Reanalisa a conversa sem recarregar tudo: mantém o que você já corrigiu à mão e o que veio
   * do CRM, preenche só os buracos e aplica sozinho o que for determinístico.
   *
   * O laço de trabalho é assíncrono — você pede nome e cidade e vai para o próximo contato. Mas
   * quando a resposta chega com o atendimento aberto, ela tem que entrar na hora.
   */
  async function reexaminarMensagens() {
    if (!state.contact || reexaminando || state.busy) return;
    reexaminando = true;
    try {
      const antes = state.incoming.length;
      const conversa = await api.getConversation(state.pageState.sessionId);
      /**
       * **O texto que a PLATAFORMA escreveu não conta como mensagem dela — aqui também.**
       *
       * `entrantes` já era peneirado por `prepararEntrantes`, e `incoming` não: é a metade que
       * faltava. E `incoming` é justamente quem alimenta o parser, `tags.suggest`, o
       * reconhecimento do anúncio e a IA — ou seja, *"Não foi possível transcrever este áudio"*
       * continuava sendo lido como fala dela em quatro lugares.
       *
       * Aqui a mensagem sai da lista em vez de ficar vazia: `incoming` é uma lista de TEXTOS, e
       * texto vazio ali não carrega o "ela mandou um áudio" que os `entrantes` guardam.
       */
      state.incoming = conversa.incoming.filter((t) => !ehMensagemDaPlataforma(t));
      state.entrantes = prepararEntrantes(conversa.entrantes, {
        veioDeAnuncio: !!(state.session?.utm?.source || state.session?.utm?.referralUrl),
      });
      state.nossaUltimaAt = conversa.nossaUltimaAt || null;
      state.nossas = conversa.nossas || [];
      state.ultimaMensagem = conversa.ultima;

      // Sinal disparado por mensagem NOSSA (ou mídia): nada novo do contato para analisar.
      if (state.incoming.length <= antes) return;

      // applyGuesses só preenche buraco: valor do CRM e correção sua nunca são sobrescritos.
      applyGuesses(await extract(state.incoming), state.classify);
      await refreshTagSuggestions();
      renderAll();

      setStatus(`O contato respondeu. ${state.incoming.length} mensagem(ns) analisada(s).`);
      // Se houver o que aplicar, "Aplicado sozinho" substitui a mensagem acima.
      await aplicarAutomatico();
    } catch (err) {
      console.warn('[WhatsFill] falha ao reanalisar a conversa:', err.message);
    } finally {
      reexaminando = false;
      renderAll();
    }
  }

  async function load(sessionId) {
    // A caixa da cidade pertence ao contato que estava aberto. Trocou de contato, ela é
    // restolho — e restolho aqui não é sujeira de tela, é risco de gravar na pessoa errada:
    // visto ao vivo, painel dizendo "Abra um atendimento" com uma caixa perguntando por
    // "Estrela Velha" por cima da conversa de outro contato. Um "1 Aceitar" ali gravaria a
    // cidade de um em outro.
    cancelarPerguntaDeCidade();

    state.session = null;
    state.contact = null;
    state.draft = {};
    state.tagSuggestions = [];
    state.incoming = [];
    // Sobreviver à troca de contato faria a etiqueta de nome divergente cair na pessoa errada —
    // é a mesma armadilha da pergunta de cidade, registrada no CLAUDE.md.
    state.nomeInformado = '';
    state.cidadeInformada = null;
    /**
     * O anúncio reconhecido é do contato ANTERIOR até `refreshTagSuggestions` rodar de novo, e ele
     * decide o que a rodada manda. Sobreviver à troca é a mesma armadilha da pergunta de cidade:
     * a decisão de um contato executada em outro.
     */
    state.anuncio = null;
    state.cidadeRecusada = new Set();
    state.ultimaMensagem = null;
    state.hsmTemplates = [];
    state.error = null;
    state.hasContract = !!(await store.get('writeContract'))?.entries?.length;
    state.settings = await store.get('settings');
    state.padroesDeAnuncio = await store.get('padroesDeAnuncio');
    state.auto.cfg = await store.get('auto');
    state.ia = await store.get('ia');
    state.fluxo = await store.get('fluxo');
    state.iaTemChave = !!(await store.get('iaChave'));
    state.templates = await templatesLib.list();
    renderAll();

    if (!sessionId) {
      setStatus('Abra um atendimento na plataforma para começar.');
      return;
    }

    try {
      setStatus('Carregando contato…');
      state.session = await api.getSession(sessionId);
      const [contact, classify] = await Promise.all([
        api.getContact(state.session.contactId),
        fieldsLib.classifyFields(),
      ]);
      state.contact = contact;
      state.classify = classify;
      state.schema = await fieldsLib.loadSchema();

      // Antes de qualquer palpite: o que você já recusou para este contato não volta a perguntar.
      // Tem que vir aqui, e não depois do `extract`, senão `applyGuesses` repõe a cidade recusada
      // no rascunho e a pergunta aparece de novo antes de alguém consultar a memória.
      state.cidadeRecusada = new Set(await store.cidadesRecusadas(contact.id));

      const current = fieldsLib.readValues(contact);
      for (const field of classify) {
        const value = current[field.id];
        if (value != null && value !== '') state.draft[field.id] = { value, from: 'crm' };
      }

      // "Nome" não vive em customFieldValues: o nome real está em contact.name. E se ele for
      // o apelido automático do anúncio ("[NOVO] (51) 9..."), fica vazio para o parser preencher.
      const nomeField = classify.find((f) => f.name === 'Nome');
      if (nomeField && !state.draft[nomeField.id] && !looksLikePlaceholder(contact.name)) {
        state.draft[nomeField.id] = { value: contact.name, from: 'crm' };
      }

      const conversa = await api.getConversation(sessionId);
      /**
       * **O texto que a PLATAFORMA escreveu não conta como mensagem dela — aqui também.**
       *
       * `entrantes` já era peneirado por `prepararEntrantes`, e `incoming` não: é a metade que
       * faltava. E `incoming` é justamente quem alimenta o parser, `tags.suggest`, o
       * reconhecimento do anúncio e a IA — ou seja, *"Não foi possível transcrever este áudio"*
       * continuava sendo lido como fala dela em quatro lugares.
       *
       * Aqui a mensagem sai da lista em vez de ficar vazia: `incoming` é uma lista de TEXTOS, e
       * texto vazio ali não carrega o "ela mandou um áudio" que os `entrantes` guardam.
       */
      state.incoming = conversa.incoming.filter((t) => !ehMensagemDaPlataforma(t));
      state.entrantes = prepararEntrantes(conversa.entrantes, {
        veioDeAnuncio: !!(state.session?.utm?.source || state.session?.utm?.referralUrl),
      });
      state.nossaUltimaAt = conversa.nossaUltimaAt || null;
      state.nossas = conversa.nossas || [];
      state.ultimaMensagem = conversa.ultima;
      /**
       * A nossa ÚLTIMA mensagem foi o pedido de dados?
       *
       * É o contexto dele: perguntou, então o que veio depois é a resposta — mesmo sem "moro em"
       * e sem separador.
       */
      const respostaAoPedido = pediuNomeECidade(state.nossas[state.nossas.length - 1]?.texto);

      const palpites = await extract(state.incoming, { respostaAoPedido });
      /**
       * O nome que a PESSOA escreveu, guardado à parte do rascunho.
       *
       * O rascunho não serve para detectar cadastro errado: quando o campo "Nome" está vazio ele
       * é semeado com o próprio `contact.name`, então comparar os dois daria "igual" justamente
       * no caso que interessa. O palpite do parser é a única fonte que diz o que ela informou.
       */
      state.nomeInformado = palpites.nome?.value || '';
      state.cidadeInformada = palpites.cidade || null;
      applyGuesses(palpites, classify);

      /**
       * Segunda passada, só nas TRANSCRIÇÕES de áudio — e sempre como palpite que espera clique.
       *
       * Pedido dele, depois de ver o painel dizer "Cidade: (vazia)" para quem tinha falado a
       * cidade num áudio. O ganho é real: nesta base muita gente responde falando.
       *
       * **A trava é o que torna isto aceitável.** Transcrição é fala passada por reconhecimento
       * automático — ninguém DIGITOU aquilo. Então tudo que sai daqui vem rebaixado:
       *
       *  - `confidence: 'aproximada'`, que é o que mantém o valor fora da gravação automática
       *    (só `crm`/`exata` são gravados sozinhos);
       *  - `informada: false`, que impede substituir o que já está no CRM — a regra de "a pessoa
       *    informou outra cidade" exige texto escrito, não áudio ouvido por máquina;
       *  - a origem sai na tela dizendo que veio do áudio, para ele conferir antes de aceitar.
       *
       * E roda DEPOIS da passada normal, então o que a pessoa escreveu sempre ganha do que ela
       * falou: `applyGuesses` não sobrescreve o que já está no rascunho.
       */
      const transcricoes = state.entrantes.filter((m) => m.transcrito && m.texto).map((m) => m.texto);
      if (transcricoes.length) {
        applyGuesses(rebaixarParaPalpite(await extract(transcricoes)), classify);
      }

      // O nome que a pessoa ESCREVEU no formulário ganha do apelido do perfil do WhatsApp.
      // "Zane" (perfil) x "Rosane Requia" (resposta dela): sem isto o agradecimento sairia
      // "Obrigado pela atenção, Zane!". Nome digitado por operador continua ganhando do palpite —
      // a troca só vale quando o cadastro é literalmente o nome do perfil.
      if (nomeField && palpites.nome?.value && nomeVeioDoPerfil(contact)) {
        const atual = state.draft[nomeField.id];
        if (atual?.from === 'crm' && cities.normalize(atual.value) !== cities.normalize(palpites.nome.value)) {
          state.draft[nomeField.id] = { ...palpites.nome, from: 'palpite' };
        }
      }
      // Depois do parser: o que a pessoa escreveu vale mais que o formato do cadastro.
      await corrigirNomeComCidade(nomeField);
      await refreshTagSuggestions();

      // Modelos aprovados: falha aqui não pode derrubar o carregamento do contato.
      try {
        state.hsmTemplates = await hsmLib.list({ channelId: state.session?.channelId });
      } catch (err) {
        state.hsmTemplates = [];
        console.warn('[WhatsFill] não consegui listar os modelos de mensagem:', err.message);
      }

      setStatus(
        state.incoming.length
          ? `Contato carregado. ${state.incoming.length} mensagem(ns) do contato analisada(s).`
          : 'Contato carregado. O contato ainda não escreveu nada.'
      );

      // Depois do status: se houver o que aplicar, a mensagem de "Aplicado sozinho" substitui.
      await aplicarAutomatico();
    } catch (err) {
      state.error = err.message;
      setStatus(err.message, 'err');
    }
    renderAll();
  }

  /**
   * Cadastro no formato "Cidade - Nome" ("Canoas - Marines"): sem isto o primeiro nome é a
   * cidade e a saudação sai "Boa noite, Canoas!".
   *
   * O valor do Nome é corrigido **mantendo a origem** — veio do CRM, continua marcado como do
   * CRM e portanto não é reescrito lá. Aqui só conserta o que o painel usa e mostra.
   *
   * A cidade da esquerda vem do FORMATO do cadastro, não de a pessoa ter dito nada na conversa
   * — é o parsing que é determinístico, não o dado. Entrou como `exata` (grava sozinho) até um
   * contato ("Lourdes" / "Cerrito") pegar cidade sem nunca ter mencionado nenhuma: alguém
   * digitou o cadastro nesse formato por outro motivo (ou errado) e a extensão gravou por cima
   * do silêncio, sem clique nenhum. Por isso `aproximada` e `pendente`: fica marcada como
   * palpite e só sai daqui pro CRM depois que `confirmarCidadeSePendente` perguntar.
   */
  const FONTE_CIDADE_CADASTRO = 'cidade escrita antes do nome no cadastro';

  async function corrigirNomeComCidade(nomeField) {
    const entrada = nomeField && state.draft[nomeField.id];
    if (!entrada?.value) return;

    const separado = await cities.splitCidadeNome(entrada.value);
    if (!separado) return;

    state.draft[nomeField.id] = { ...entrada, value: separado.nome };

    const cidadeField = fieldNamed('Cidade');
    const jaRecusada = state.cidadeRecusada.has(cities.normalize(separado.cidade));
    if (cidadeField && !state.draft[cidadeField.id] && !jaRecusada) {
      state.draft[cidadeField.id] = {
        value: separado.cidade,
        from: 'palpite',
        confidence: 'aproximada',
        source: FONTE_CIDADE_CADASTRO,
        pendente: true,
      };
    }
  }

  /**
   * **Nenhuma cidade de palpite vai para o CRM sem passar por aqui.** Popup não-bloqueante (a
   * mesma caixa da rodada), antes da escrita.
   *
   * Começou cobrindo só a cidade tirada do FORMATO do cadastro ("Cidade - Nome", caso
   * "Lourdes"/"Cerrito"). Ficou de fora justamente a mais comum: a cidade tirada das MENSAGENS,
   * que casa exato com o IBGE e por isso é gravada por `aplicarAutomatico` no instante em que o
   * contato é aberto — sem clique nenhum. O relato foi *"eu pedi para me mostrar um popup antes
   * de registrar a cidade mas continua registrando automaticamente"*, e estava certo: a metade
   * silenciosa era a que ele via.
   *
   * Isto abre exceção à regra "automático grava o determinístico" do CLAUDE.md, e de propósito:
   * casar exato com a lista do IBGE prova que o texto é o nome de um município, não que seja a
   * cidade DELE — "meu genro mora em Santiago" casa igualzinho. Instrução dele vence a regra.
   *
   * Só pergunta quando a cidade **entraria mesmo** nesta gravação: palpite `aproximada` na
   * rodada automática já é filtrado pelo `somenteExatos`, e perguntar ali seria popup por um
   * valor que não ia ser gravado de qualquer jeito.
   *
   * @param {boolean} somenteExatos a gravação em curso só leva palpite exato (a automática)
   */
  async function confirmarCidadeSePendente(somenteExatos) {
    // DUAS caixas iguais na tela ao mesmo tempo, medido ao vivo. Nada impede `load()` e
    // `reexaminarMensagens()` de estarem no ar juntos — `load()` não roda dentro de `withBusy`,
    // então `state.busy` não segura o segundo —, e cada um chama a gravação automática. Enquanto
    // o primeiro espera a resposta, o segundo abre a sua própria caixa; responder uma deixa a
    // outra na tela perguntando o mesmo, e foi isso que virou "pede novamente".
    //
    // Quem chegar depois espera a MESMA pergunta em vez de abrir outra: quando ela responder, o
    // rascunho já está decidido e a segunda gravação segue com a decisão tomada.
    if (perguntaDeCidade) {
      await perguntaDeCidade;
      /**
       * Espera as ETIQUETAS também, não só a resposta da cidade.
       *
       * Quem abriu a pergunta atualiza `state.tagSuggestions` depois de resolver o rascunho — mas
       * isso acontece **depois** desta promessa resolver. Sem o refresh aqui, esta gravação
       * seguiria com as etiquetas da cidade ANTIGA: `applyTags` faz união, então aplicaria a
       * etiqueta de uma cidade que acabou de ser trocada ou recusada, e ela ficaria no contato
       * para sempre.
       *
       * O gatilho é a cidade: nada de etiqueta sai daqui antes de ela estar decidida. Refresh
       * extra custa uma leitura com cache — bem menos que uma etiqueta errada em produção.
       */
      await refreshTagSuggestions();
      return;
    }

    const campo = fieldNamed('Cidade');
    const entry = campo && state.draft[campo.id];
    if (!entry?.pendente || entry.from !== 'palpite') return;
    if (entry.value == null || entry.value === '') return;
    if (somenteExatos && entry.confidence !== 'exata') return;

    /**
     * **Palpite que não é município NÃO vira pergunta** — anotação dele (04/09/2026): a caixa
     * *"Cidade a gravar"* abriu com **"Mathias"**, que é o sobrenome dela (*"Taila, Mathias"*).
     * Ele: *"mathias não existe no IBGE, não aceite o palpite"*.
     *
     * `nao-reconhecida` é o modo generoso do parser devolvendo **qualquer palavra solta** — é o
     * mesmo caminho que já tinha feito um link do Instagram voltar como cidade. Ela existe para
     * alimentar a lista de revisão da aba Cidades, onde ninguém grava nada; oferecer para gravar é
     * transformar "não achei" em "confirme isto".
     *
     * A pergunta continua valendo para `aproximada` — ali o parser achou um município de verdade e
     * a dúvida é se é ESTE. Aqui não há município nenhum.
     */
    if (entry.confidence === 'nao-reconhecida') return;

    /**
     * Com a rodada automatizada, quem responde esta caixa é a IA — e ela responde ANTES de a
     * caixa existir.
     *
     * Relato dele (01/09): *"falta a IA aceitar a cidade e arrumar caso esteja errado, está
     * parando o processo"*. Estava travando mesmo: a rodada abre a caixa e fica esperando um
     * clique que, por definição, ninguém vai dar — automatizar tudo menos isto é não automatizar.
     *
     * A regra dele não muda: **nenhuma cidade de palpite vai para o CRM sem confirmação.** Muda
     * quem confirma quando ele não está olhando. E o que a IA pode fazer aqui é estreito: aceitar
     * o que o parser achou, trocar por outro município **da lista do IBGE**, ou não gravar nada.
     * Nome inventado não passa por `validarCidade`.
     */
    if (await cidadeConferidaPelaIA(campo, entry)) return;

    /**
     * **Rodada andando sozinha e a IA não pôde conferir: não grava e não pergunta.**
     *
     * A caixa da cidade espera um clique que, numa rodada automática, ninguém vai dar — e uma
     * pergunta sem dono trava a fila inteira em silêncio. Essa armadilha já custou uma rodada
     * parada quando a automação dos "Meus" nasceu, e a dos "Novos" a traria de volta com a IA
     * desligada, que é justamente como ela vai rodar na maior parte das vezes.
     *
     * **Não gravar é o desfecho certo**, não um remendo: a regra dele é que nenhuma cidade de
     * palpite vai para o CRM sem confirmação. O palpite volta a aparecer na próxima passada, para
     * ele. E a linha no Andamento é o que impede isto de virar "às vezes pega a cidade".
     */
    if (state.auto?.rodando && rodadaAutomatica()) {
      registrarNaRodada(
        state.contact?.name || 'contato',
        'aviso',
        `cidade "${entry.value}" não gravada: é palpite e a rodada está automática — confirme você depois`
      );
      return;
    }

    const doCadastro = entry.source === FONTE_CIDADE_CADASTRO;
    const linhas = [`Encontrei "${entry.value}" como cidade.`];
    if (doCadastro) {
      linhas.push('⚠ A pessoa não disse isso na conversa — veio só do formato "Cidade - Nome" do cadastro.');
    } else {
      linhas.push(`De onde saiu: ${entry.source || 'mensagem do contato'}`);
      if (entry.confidence !== 'exata') linhas.push('⚠ Não casou exato com a lista do IBGE — é palpite.');
    }
    if (entry.substituiu) linhas.push(`⚠ Vai SUBSTITUIR a cidade que está no CRM ("${entry.substituiu}").`);

    perguntaDeCidade = perguntarNaRodada({
      titulo: doCadastro ? 'Cidade do cadastro' : 'Cidade a gravar',
      linhas,
      pergunta: 'Está correta?',
      opcoes: [
        { tecla: '1', rotulo: 'Aceitar', valor: 'aceitar', primaria: true },
        { tecla: '2', rotulo: 'Corrigir', valor: 'corrigir' },
        { tecla: '3', rotulo: 'Sem cidade', valor: 'semcidade' },
      ],
      // Esta caixa não decide o atendimento, decide um campo: Esc aqui é "não grava esta
      // cidade", não "para a rodada" — e dizer o contrário na tela é o tipo de mentira que faz
      // ele teclar Esc esperando outra coisa.
      dica: 'Esc descarta a cidade e segue',
    });

    let escolha;
    try {
      escolha = await perguntaDeCidade;
    } finally {
      perguntaDeCidade = null;
    }

    // Cancelada porque o contato mudou: não mexe em rascunho nenhum. O rascunho que está aí
    // agora é de OUTRA pessoa, e escrever nele é como responder a pergunta pelo contato errado.
    if (escolha === CANCELADA) return;

    if (escolha === 'aceitar') {
      /**
       * `confirmada: true` é o que libera as etiquetas que saem da cidade.
       *
       * Sem esta marca, aceitar no popup gravava a cidade e **não** aplicava a etiqueta:
       * `etiquetaConfiavel` exige `from === 'crm'` ou `confidence === 'exata'`, e o palpite
       * aproximado continuava aproximado depois do aceite. O resultado era o contrário do
       * combinado — a cidade é o gatilho, e confirmar o gatilho tem que liberar o que vem dele.
       *
       * Confirmação sua vale tanto quanto valor do CRM: foi você que olhou a conversa e decidiu.
       */
      state.draft[campo.id] = { ...entry, pendente: false, confirmada: true };
    } else if (escolha === 'semcidade') {
      // Marcado como 'manual' (não 'palpite'): `corrigirNomeComCidade` e `applyGuesses` só
      // preenchem campo vazio de verdade, e aqui ele NÃO está — é uma resposta, "não tem cidade".
      await recusarCidade(entry.value);
      state.draft[campo.id] = { value: '', from: 'manual' };
      setStatus('Sem cidade — nada vai ser gravado nesse campo.');
    } else {
      // Esc também cai aqui: na dúvida não grava. Vale para a rodada — parar a rodada não pode
      // significar "então grava a cidade que eu não confirmei".
      await recusarCidade(entry.value);
      delete state.draft[campo.id];
      setStatus(`Cidade "${entry.value}" descartada — preencha na aba Dados.`, 'err');
    }
    // A etiqueta de COREDE sai da cidade: recusada a cidade, a região tem que sair junto, senão
    // o contato fica com o COREDE de uma cidade que você acabou de recusar.
    await refreshTagSuggestions();
    renderAll();
  }

  /**
   * A IA responde a caixa da cidade no lugar dele — só na rodada automatizada.
   *
   * @returns {Promise<boolean>} `true` = já resolvi, não abra a caixa. `false` = pergunte a ele.
   *
   * **As três saídas, e o que cada uma escreve:**
   *  - `aceitar`  → grava o palpite, com `confirmada: true` (é o que libera as etiquetas);
   *  - `corrigir` → grava OUTRO município, e só um que exista na lista do IBGE;
   *  - `semcidade` e `incerto` → **não escreve nada, e não recusa nada.**
   *
   * A última merece explicação, porque ela difere da caixa: quando ELE responde "Sem cidade",
   * a recusa fica guardada (`recusarCidade`) para a cidade não voltar a ser sugerida. Aqui não.
   * A recusa dele é uma decisão sobre o contato; a da IA é a falta de uma. Guardar "não é
   * Canoas" porque o modelo ficou em 60% de certeza é transformar dúvida em fato, e é o tipo de
   * memória que ninguém revisa depois. O palpite volta a aparecer na próxima vez, para ele.
   *
   * Nada aqui roda fora da rodada automatizada: no dia a dia quem confere a cidade é ele, e
   * continua sendo.
   */
  async function cidadeConferidaPelaIA(campo, entry) {
    if (!state.auto?.rodando || !rodadaAutomatica() || !state.ia?.ligada) return false;

    const municipios = await cities.loadMunicipios();
    if (!municipios?.length) {
      // Sem a lista não há como conferir invenção, e conferência sem trava é pior que não ter.
      registrarNaRodada('IA', 'aviso', 'cidade não conferida: a lista de municípios não carregou');
      return false;
    }

    /**
     * A conversa dos dois lados, na ordem.
     *
     * `state.entrantes` traz áudio transcrito junto, e é de propósito: a cidade dita num áudio é
     * exatamente o caso que o parser não enxerga e que a IA resolve. Ela grava só o que casa com
     * o IBGE, então transcrição errada vira `incerto`, não cidade errada.
     */
    const conversa = [
      ...state.entrantes.map((m) => ({ de: 'contato', texto: m.texto, at: m.at })),
      ...(state.nossas || []).map((m) => ({ de: 'nos', texto: m.texto, at: m.at })),
    ]
      .filter((m) => String(m.texto || '').trim())
      .sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0))
      .slice(-30);

    const r = await iaCliente.conferirCidade({
      regras: state.ia.regras,
      mensagens: conversa,
      candidato: entry.value,
      origem: entry.source === FONTE_CIDADE_CADASTRO
        ? 'o formato "Cidade - Nome" do cadastro — a pessoa NÃO disse isso na conversa'
        : entry.source || 'mensagem do contato',
      substituiria: entry.substituiu || '',
      municipios,
      normalizar: cities.semAcentoNemCaixa,
      modelo: state.ia.modelo,
    });

    if (r?.custoUsd) {
      registrarNaRodada('IA', 'pulado', `cidade · ${r.acao} · US$ ${r.custoUsd.toFixed(4)}`);
    }

    const nome = state.contact?.name || 'contato';
    if (r.acao === 'aceitar') {
      state.draft[campo.id] = { ...entry, pendente: false, confirmada: true };
      registrarNaRodada(nome, 'aviso', `IA confirmou a cidade "${entry.value}": ${r.motivo || 'sem motivo dado'}`);
    } else if (r.acao === 'corrigir') {
      // `substituiu` continua: o que estava no CRM vai ser trocado do mesmo jeito, e é ele que
      // faz a etiqueta de cidade e de COREDE antigas saírem junto (`etiquetasDeRegiaoASair`).
      state.draft[campo.id] = {
        ...entry,
        value: r.cidade,
        pendente: false,
        confirmada: true,
        source: `corrigido pela IA (o parser tinha achado "${entry.value}")`,
      };
      registrarNaRodada(nome, 'aviso', `IA corrigiu a cidade: "${entry.value}" → "${r.cidade}" — ${r.motivo || 'sem motivo dado'}`);
    } else {
      delete state.draft[campo.id];
      const porque = r.acao === 'semcidade' ? r.motivo || 'a conversa não diz onde a pessoa mora' : r.aviso || 'sem certeza';
      registrarNaRodada(nome, 'aviso', `cidade "${entry.value}" NÃO gravada: ${porque}`);
    }

    // A etiqueta de cidade e a de COREDE saem daqui: mudou a cidade, as sugestões têm que ser
    // refeitas antes de `applyTags` — senão aplica a etiqueta da cidade que acabou de mudar.
    await refreshTagSuggestions();
    renderAll();
    return true;
  }

  /**
   * Tira da tela a pergunta de cidade que ficou de um contato anterior.
   *
   * `CANCELADA` não é resposta: não aceita, não recusa e não vira memória. Só desfaz a pergunta,
   * porque quem ia respondê-la já não está olhando aquele contato.
   */
  function cancelarPerguntaDeCidade() {
    perguntaDeCidade?.cancelar(CANCELADA);
  }

  /**
   * Anota a recusa — na memória do contato aberto **e no armazenamento**.
   *
   * O `Set` sozinho não bastava: ele nasce vazio a cada `load()`, então bastava fechar e reabrir
   * o contato para a mesma pergunta voltar. Foi o relato *"estou botando sem cidade e pede
   * novamente"*.
   *
   * Guarda por CIDADE, não um "não perguntar mais" por contato, porque é isso que atende a outra
   * metade do pedido — *"faça disparar novamente só se tiver chat novo com provável cidade"*:
   * mensagem nova que traga uma cidade **diferente** volta a perguntar (é informação nova, e é
   * justamente o caso de quem escreve a cidade depois); a mesma cidade já recusada, nunca mais.
   */
  async function recusarCidade(valor) {
    const chave = cities.normalize(valor);
    if (!chave) return;
    state.cidadeRecusada.add(chave);
    try {
      await store.lembrarCidadeRecusada(state.contact?.id, chave);
    } catch (err) {
      // Não conseguir gravar a recusa não pode derrubar a gravação: a decisão desta abertura já
      // está valendo pelo `Set`, o que se perde é a memória para a próxima.
      console.warn('[WhatsFill] não consegui guardar a recusa de cidade:', err.message);
    }
  }

  /**
   * Recalcula as etiquetas sugeridas. Depende da cidade, então roda de novo quando você
   * corrige a cidade na aba Dados.
   */
  async function refreshTagSuggestions() {
    if (!state.contact) return;
    const jaAplicadas = new Set(state.contact.tagsId || []);
    try {
      // O "sim" só vira etiqueta se a pergunta de interesse tiver saído para ESTE contato —
      // senão qualquer "sim, moro em Pelotas" viraria aceite de conteúdo.
      const [perguntado, etiquetasInteresse, anunciosDoMomento] = await Promise.all([
        templatesLib.wasSent(state.contact.id, INTEREST_TEMPLATE_ID),
        store.get('etiquetasInteresse'),
        carregarAnuncios(),
      ]);

      /**
       * **Qual anúncio o texto reconhece — guardado no estado porque três lugares precisam.**
       *
       * As etiquetas dele saem daqui (é a única metade que é etiqueta); a AÇÃO é lida na rodada, e
       * o sinal `anuncioReconhecido` vai para o quadro do fluxo. Reconhecer nos três separadamente
       * daria três respostas diferentes assim que um deles usasse outra lista de mensagens.
       */
      /**
       * **O que a plataforma diz sobre o anúncio entra no reconhecimento, não só o que ela digitou.**
       *
       * Relato dele (02/09/2026), com a print da Inês: contato com etiqueta ADS — ou seja, chegou
       * por anúncio — e a caixa oferecendo o modelo genérico, *"não reconheceu o anúncio"*.
       *
       * O motivo é que `reconhecer` lia só `state.incoming`, que é o que **ela** escreveu. Quem
       * chega pelo anúncio e não repete o texto dele (ou repete com outra redação) ficava sem
       * anúncio reconhecido, mesmo com a plataforma dizendo de qual campanha veio.
       *
       * É a regra que já está escrita no CLAUDE.md e que este caminho não seguia: **a origem do
       * anúncio é DADO, não texto** — `utm.campaign`, `utm.headline` e `utm.referralUrl` carregam a
       * identidade da campanha e existem mesmo quando ela não escreve nada. Agora ele pode
       * cadastrar o trecho pelo nome da campanha ou pelo link, que é o identificador estável.
       *
       * **`utm.source` fica de fora de propósito.** Ele é só "FACEBOOK": diz que veio de anúncio,
       * não de QUAL — um trecho cadastrado com "face" casaria com todos os anúncios de uma vez.
       * Nas regras de etiqueta ele entra porque lá a pergunta é outra.
       */
      state.anuncio = anunciosLib.reconhecer(
        [
          ...state.incoming,
          state.session?.utm?.campaign,
          state.session?.utm?.headline,
          state.session?.utm?.referralUrl,
        ],
        anunciosDoMomento
      );

      const sugeridas = await tagsLib.suggest({
        city: valueNamed('Cidade'),
        texts: state.incoming,
        // Tudo que a plataforma conta sobre a origem entra no texto das regras dele: antes só
        // `campaign` ia, então uma regra com "facebook" ou com o link do anúncio nunca casava.
        extra: [
          state.session?.utm?.campaign,
          state.session?.utm?.headline,
          state.session?.utm?.source,
          state.session?.utm?.referralUrl,
        ]
          .filter(Boolean)
          .join(' '),
        veioDeAnuncio: !!(state.session?.utm?.source || state.session?.utm?.referralUrl),
        /**
         * O cadastro contradiz o que a pessoa informou → etiqueta para ele conferir depois.
         *
         * Compara o cadastro (`contact.name`) com o que está na aba Dados, que é onde o parser
         * põe o nome que a pessoa escreveu. Não mexe em nome nenhum: separar foi a escolha dele
         * (31/08) entre isso e a extensão trocar sozinha.
         */
        nomeDivergente: nomeDivergeDoInformado(state.contact?.name, state.nomeInformado),
        interesse: { perguntado: !!perguntado, etiquetas: etiquetasInteresse },
        etiquetasDoAnuncio: state.anuncio?.anuncio?.etiquetas || [],
      });

      // O conteúdo que o contato JÁ carrega no CRM entra na conta junto com o que as regras
      // acharam. Sem isto, etiqueta aplicada à mão (ou aplicada por nós na passada anterior,
      // quando a campanha do anúncio ainda casava) era invisível — e o botão de fechar com
      // conteúdo ficava travado dizendo "nenhum conteúdo reconhecido".
      const jaNoCrm = await tagsLib.conteudosJaAplicados(state.contact, await store.get('contentTemplates'));
      const nomesVistos = new Set(sugeridas.map((s) => cities.normalize(s.nome || '')));
      const completas = [...sugeridas, ...jaNoCrm.filter((c) => !nomesVistos.has(cities.normalize(c.nome)))];

      state.tagSuggestions = completas.map((s) => ({
        ...s,
        jaTem: !!s.tag && jaAplicadas.has(s.tag.id),
        marcada: !!s.tag && !jaAplicadas.has(s.tag.id) && state.settings.autoTags,
      }));
    } catch (err) {
      state.tagSuggestions = [];
      console.warn('[WhatsFill] não consegui sugerir etiquetas:', err.message);
    }

    /**
     * A conferência de grafia mora aqui, e não no desenho, por dois motivos.
     *
     * É assíncrona: chamada no render, o aviso piscaria a cada redesenho. E esta função já roda em
     * TODOS os pontos em que a cidade muda — carregar o contato, responder o popup, digitar na aba
     * Dados —, então o aviso acompanha sozinho, sem eu ter que lembrar de chamá-la em cada um.
     */
    try {
      const cidade = valueNamed('Cidade');
      state.grafiaDaCidade = cidade ? await cities.conferirGrafia(cidade) : null;
    } catch (err) {
      state.grafiaDaCidade = null;
      console.warn('[WhatsFill] não consegui conferir a grafia da cidade:', err.message);
    }
  }

  /**
   * Valor que já está no CRM ganha do palpite: o palpite só preenche o vazio.
   *
   * **Uma exceção, e só uma:** a cidade que a própria pessoa informou respondendo o formulário
   * ("Luís Antônio / Palmares do Sul"). Ela substitui o que estiver lá.
   *
   * O motivo é que a cidade do CRM vem, em boa parte da base, de importação e de palpite antigo
   * — e uma delas estava errada justamente quando a pessoa acabou de dizer a certa. Continuar
   * respeitando o valor velho mandava o link do grupo errado e etiquetava a região errada. As
   * travas que sustentam a exceção: só casamento **exato** com a lista do IBGE, só quando veio
   * de resposta **estruturada** (nome/cidade), e a etiqueta de região antiga sai junto — meia
   * substituição deixaria o contato com dois COREDEs.
   */
  function applyGuesses(guesses, classify) {
    const pairs = [
      ['Nome', guesses.nome],
      ['Cidade', guesses.cidade],
    ];
    for (const [name, guess] of pairs) {
      const field = classify.find((f) => f.name === name);
      if (!field || !guess) continue;

      // Cidade que você já recusou no popup não volta enquanto o contato estiver aberto.
      if (name === 'Cidade' && state.cidadeRecusada.has(cities.normalize(guess.value))) continue;

      const atual = state.draft[field.id];
      if (atual) {
        if (!podeSubstituirCidade(name, guess, atual)) continue;
        setStatus(`A pessoa informou outra cidade: ${atual.value} → ${guess.value}.`);
      }

      state.draft[field.id] = {
        value: guess.value,
        from: 'palpite',
        confidence: guess.confidence,
        source: guess.source,
        suggestions: guess.suggestions,
        // Marca a substituição para a gravação trocar também a etiqueta de região.
        substituiu: atual ? atual.value : null,
        // Cidade nenhuma vai para o CRM sem você ver antes. Ver `confirmarCidadeSePendente`.
        pendente: name === 'Cidade',
      };
    }
  }

  /**
   * O aviso de troca de cidade, para a pergunta da rodada. Vazio quando não houve troca.
   *
   * Substituir cidade é a única coisa que a extensão reescreve por cima do CRM — então ela
   * aparece na tela no momento da decisão, e não só no log depois.
   */
  function cidadeSubstituida() {
    const campo = fieldNamed('Cidade');
    const entrada = campo && state.draft[campo.id];
    return entrada?.substituiu ? ` (a pessoa informou; estava "${entrada.substituiu}")` : '';
  }

  /** A exceção acima, isolada para ficar legível — e para não valer para nenhum outro campo. */
  function podeSubstituirCidade(name, guess, atual) {
    if (name !== 'Cidade') return false;
    if (!guess.informada || guess.confidence !== 'exata') return false;
    // Correção sua à mão vence o parser: você viu a conversa inteira, ele viu uma linha.
    if (atual.from === 'manual') return false;
    return cities.normalize(atual.value) !== cities.normalize(guess.value);
  }

  function fieldNamed(name) {
    return state.classify.find((f) => f.name === name) || null;
  }

  function valueNamed(name) {
    const field = fieldNamed(name);
    const entry = field && state.draft[field.id];
    if (!entry || entry.value == null) return '';
    return Array.isArray(entry.value) ? entry.value.join(', ') : String(entry.value);
  }

  // ---- render -------------------------------------------------------------
  function renderAll() {
    for (const btn of nav.children) btn.classList.toggle('wf-active', btn.dataset.tab === state.tab);
    renderHeader();
    body.replaceChildren();
    if (state.tab === 'respostas') renderRespostas();
    else if (state.tab === 'automatizado') renderAutomatizado();
    else if (state.tab === 'dados') renderDados();
    else if (state.tab === 'cidades') renderCidades();
    else renderConfig();
  }

  /**
   * A versão do `manifest.json` que o Chrome carregou de verdade, no cabeçalho do painel.
   *
   * Existe por causa de uma tarde inteira gasta: os fixes iam pro repositório, ele recarregava a
   * extensão, e o defeito continuava — a pasta que o Chrome estava carregando não era a pasta
   * que o GitHub Desktop atualizava (**"tem extensão dentro da extensão"**). Sem número na tela
   * não há como distinguir "o fix não funcionou" de "o fix não chegou", e as duas hipóteses
   * levam a caminhos opostos. Agora dá para conferir de relance, antes de qualquer diagnóstico.
   */
  function versaoCarregada() {
    try {
      return chrome.runtime.getManifest().version;
    } catch {
      // Extensão recarregada com a aba aberta: o contexto morre e nem o manifesto responde.
      return '?';
    }
  }

  function renderHeader() {
    header.replaceChildren();

    const reload = h('button', { class: 'wf-btn wf-mini', type: 'button' }, 'Recarregar');
    reload.addEventListener('click', () => withBusy(refresh));
    header.append(
      h('div', { class: 'wf-conn' }, [h('span', {}, `${state.connection} · v${versaoCarregada()}`), reload])
    );

    /**
     * O acesso à janela do fluxo fica **logo abaixo do Recarregar**, no lugar que ele pediu, e no
     * cabeçalho de propósito: o fluxo vale para todas as abas, e escondê-lo dentro de uma delas foi
     * exatamente o erro que ele apontou.
     *
     * Não depende de atendimento aberto: a janela só lê e grava a configuração, então serve para
     * ele arrumar o fluxo ANTES de começar a rodada.
     */
    const abrirFluxo = h('button', { class: 'wf-btn wf-mini wf-fluxo-abrir', type: 'button' }, 'Fluxo de atendimento ↗');
    abrirFluxo.addEventListener('click', () => abrirJanelaDoFluxo());
    header.append(abrirFluxo);

    if (!state.contact) {
      header.append(h('div', { class: 'wf-who' }, 'WhatsFill'));
      header.append(
        h('div', { class: 'wf-sub' }, state.pageState.sessionId ? 'Carregando…' : 'Nenhum atendimento aberto')
      );
      return;
    }

    const name = state.contact.name || state.contact.nameWhatsapp || 'Sem nome';
    const phone = state.contact.phonenumberFormatted || state.contact.phonenumber || '';
    const campaign = state.session?.utm?.campaign || state.session?.utm?.source || '';
    header.append(h('div', { class: 'wf-who' }, name));
    header.append(h('div', { class: 'wf-sub' }, phone + (campaign ? ` · ${campaign}` : '')));

    const cidade = valueNamed('Cidade');
    if (cidade) header.append(h('div', { class: 'wf-sub' }, [document.createTextNode('Cidade: '), ...cidadeMarcada()]));

    /**
     * Aviso de grafia, no cabeçalho — que é onde ele olha ao abrir o atendimento.
     *
     * Pedido dele: *"me falar se está errada também quando eu iniciar o atendimento, tem casos de
     * cidade escritas erradas"*. Fica no cabeçalho, e não na aba Dados, porque o cabeçalho aparece
     * em TODAS as abas: um aviso escondido atrás de um clique não é aviso.
     *
     * Só grafia diferente do nome oficial entra aqui. Acento e caixa não — resolvem para o mesmo
     * município e avisar disso treinaria a ignorar o aviso (ver `cities.conferirGrafia`).
     */
    const grafia = state.grafiaDaCidade;
    if (grafia && !grafia.ok) {
      const aviso = h('div', { class: 'wf-block' }, `Cidade escrita fora do padrão: ${grafia.motivo}`);
      if (grafia.oficial) {
        const corrigir = h('button', { class: 'wf-btn wf-mini wf-primary', type: 'button' }, `Corrigir para "${grafia.oficial}"`);
        corrigir.disabled = state.busy;
        corrigir.addEventListener('click', () =>
          withBusy(async () => {
            const campo = fieldNamed('Cidade');
            if (!campo) return;
            // `manual` e `confirmada`: foi você que mandou corrigir, então vale como valor seu —
            // e as etiquetas que saem da cidade ficam liberadas, sem outro popup.
            state.draft[campo.id] = { value: grafia.oficial, from: 'manual', confirmada: true };
            await refreshTagSuggestions();
            setStatus(`Cidade corrigida para "${grafia.oficial}". Salve para gravar no CRM.`, 'ok');
          })
        );
        aviso.append(h('div', { class: 'wf-row', style: 'margin-top:5px' }, [corrigir]));
      }
      header.append(aviso);
    }
  }

  /**
   * A cidade no cabeçalho, em marca-texto amarelo quando foi o PARSER que a extraiu — com o
   * trecho que gerou o valor logo depois.
   *
   * Pedido dele, e o motivo é bom: cidade extraída é a informação que mais erra e a mais cara
   * de errar (leva o COREDE e o link do grupo junto). Amarelo = veio da conversa, confira.
   * Sem marca = veio do CRM ou foi você que digitou. O trecho é o que fecha o diagnóstico:
   * "Capitão ← de 'Capitão Martim'" mostra o erro na hora, sem abrir a conversa.
   */
  function cidadeMarcada() {
    const campo = fieldNamed('Cidade');
    const entrada = campo && state.draft[campo.id];
    const cidade = valueNamed('Cidade');
    if (!entrada || entrada.from !== 'palpite') return [h('b', {}, cidade)];

    const trecho =
      entrada.source && cities.normalize(entrada.source) !== cities.normalize(cidade)
        ? ` ← de “${truncate(entrada.source, 30)}”`
        : '';
    const nivel = entrada.confidence === 'exata' ? '' : ` (${entrada.confidence || 'palpite'})`;
    return [h('span', { class: 'wf-marca' }, cidade), h('span', {}, `${nivel}${trecho}`)];
  }

  // ---- aba Respostas ------------------------------------------------------
  /**
   * O rascunho para os casos que nenhuma resposta pronta cobre: transcrição longa, relato
   * comprido, pergunta específica.
   *
   * É o laço que ele já faz à mão — copiar para uma IA, ela responder, ele editar "para parecer
   * mais humano" e mandar — sem o copiar e colar, e **sem mudar a última parte**: o texto cai no
   * campo de mensagem da plataforma, e quem aperta enviar é ele.
   *
   * Fica no TOPO da aba Respostas porque é onde ele está quando o caso aparece: contato aberto,
   * conversa longa na tela, e nenhuma das respostas prontas servindo.
   */
  function renderRascunho() {
    if (!state.ia?.ligada) return;

    const card = h('div', { class: 'wf-card' }, [h('h4', {}, 'Rascunho para este contato')]);
    const botao = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Rascunhar resposta');
    const saida = h('textarea', { rows: '8', placeholder: 'O rascunho aparece aqui para você editar.' });
    const avisos = h('div', {});

    botao.addEventListener('click', () =>
      withBusy(async () => {
        avisos.replaceChildren();
        const dela = mensagensParaIA();
        if (!dela.length) return setStatus('Este contato ainda não escreveu nada.', 'err');

        setStatus('Escrevendo o rascunho…');
        const r = await iaCliente.rascunhar({
          templates: state.templates,
          regras: state.ia.regras,
          gabinete: await gabineteLib.paraOPrompt(dela),
          modelo: state.ia.modelo,
          // Rascunhar precisa dos DOIS lados: sem a nossa fala no meio a IA não sabe o que já foi
          // respondido. Ver `conversaParaIA`.
          mensagens: conversaParaIA(),
          // O relógio: sem ele a IA não sabe se a conversa é de agora ou da semana passada.
          agora: new Date(),
          campos: { Cidade: valueNamed('Cidade') },
        });

        if (!r.texto) {
          setStatus(`Não saiu rascunho: ${r.avisos.join(' · ')}`, 'err');
          return;
        }
        saida.value = r.texto;
        // Os avisos ficam ao lado do texto, não numa barra de status que a próxima ação apaga:
        // são o que ele precisa reler ANTES de mandar, não enquanto o rascunho chega.
        for (const a of r.avisos) avisos.append(h('div', { class: 'wf-block' }, `⚠ ${a}`));
        setStatus(
          r.custo
            ? `Rascunho pronto (${r.custo.saida} tokens de saída${r.custo.cacheLido ? ', cache usado' : ', SEM CACHE'}).`
            : 'Rascunho pronto. Edite antes de mandar.'
        );
      })
    );

    const inserir = h('button', { class: 'wf-btn', type: 'button' }, 'Colocar no campo de mensagem');
    inserir.addEventListener('click', () =>
      withBusy(async () => {
        const texto = saida.value.trim();
        if (!texto) return setStatus('Não há rascunho para inserir.', 'err');
        // `setComposerText`, nunca `sendText`. A diferença entre isto e a IA respondendo eleitor
        // é uma só, e é toda ela: quem aperta enviar é ele.
        await page.setComposerText(texto);
        setStatus('No campo de mensagem. Leia, ajuste e mande você mesmo.');
      })
    );

    card.append(
      h('div', { class: 'wf-preview' },
        'Para transcrição longa, relato comprido, pergunta específica — o que nenhuma resposta ' +
          'pronta cobre. A IA escreve no seu tom (ela usa as suas respostas prontas como ' +
          'referência de estilo) e o texto vem para cá. **Ela não envia nada**: você edita e ' +
          'manda pela plataforma.'),
      h('div', { class: 'wf-row' }, [botao, inserir]),
      saida,
      avisos
    );
    body.append(card);
  }

  function renderRespostas() {
    if (!state.contact) {
      body.append(h('p', { class: 'wf-hint' }, state.error || 'Abra um atendimento na plataforma.'));
      return;
    }

    if (state.session?.expired) {
      body.append(
        h('div', { class: 'wf-block' }, 'Janela de atendimento expirada — resposta livre está bloqueada. Os modelos de mensagem aprovados, no fim desta aba, continuam funcionando.')
      );
    }

    renderRascunho();

    // A fila de contatos novos chega toda como Pendente, e Pendente não tem campo de texto.
    if (state.pageState.isPending) {
      const iniciar = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Iniciar atendimento');
      iniciar.addEventListener('click', () =>
        withBusy(async () => {
          setStatus('Assumindo o atendimento…');
          state.pageState = await page.clickIniciar();
          setStatus(state.pageState.isPending ? 'A plataforma ainda não liberou o campo de mensagem.' : 'Atendimento assumido.', state.pageState.isPending ? 'err' : 'ok');
          renderAll();
        })
      );
      body.append(h('div', { class: 'wf-card' }, [
        h('h4', {}, 'Atendimento pendente'),
        h('div', { class: 'wf-preview' }, 'A plataforma só libera o campo de mensagem depois que você assume a conversa.'),
        iniciar,
      ]));
    }

    // A abertura do laço: pergunta e sai de cima. É o botão de maior volume nos oito mil.
    const pedir = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Pedir dados + concluir + próximo');
    pedir.addEventListener('click', runPedirDados);
    const cartaoPedir = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Pedir os dados e seguir'),
      h('div', { class: 'wf-preview' }, 'Envia o pedido de nome e cidade, conclui e abre o próximo. Quando a pessoa responder, a plataforma traz o atendimento de volta para as não lidas.'),
      pedir,
    ]);
    if (!state.settings.autoSend) {
      pedir.disabled = true;
      cartaoPedir.append(
        h('div', { class: 'wf-block' }, 'Precisa do "Enviar automático" ligado (aba Config): sem ele o texto só é inserido, e concluir fecharia o atendimento sem a pergunta ter saído.')
      );
    }
    body.append(cartaoPedir);

    // O contato já vem de um grupo: o link não faz parte do dia a dia. O fluxo normal é
    // classificar, concluir e seguir para o próximo que respondeu.
    // O fecho do dia a dia: manda o conteúdo que a pessoa pediu, agradece e conclui.
    const conteudos = state.tagSuggestions.filter((s) => s.origem === 'conteúdo');
    const fechar = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Enviar conteúdo + agradecer + concluir');
    fechar.addEventListener('click', runFecharComConteudo);
    // Nada reconhecido NÃO trava mais: vai o conteúdo preferido da Config (pedido dele).
    // Mais de um conteúdo continua travando — ali o painel sabe que existem dois caminhos certos
    // e escolher por você seria chutar entre modelos que a pessoa realmente pediu.
    fechar.disabled = conteudos.length > 1;
    const cartaoFechar = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Atender o pedido e encerrar'),
      h('div', { class: 'wf-preview' }, conteudos.length === 1
        ? `Envia o modelo de "${conteudos[0].nome}", agradece, grava a classificação e conclui.`
        : conteudos.length === 0
          ? 'Nada foi reconhecido: vai o MODELO PADRÃO da aba Config, agradece e conclui.'
          : 'Envia o modelo do conteúdo pedido, agradece, grava a classificação e conclui.'),
      fechar,
    ]);
    if (!conteudos.length) {
      cartaoFechar.append(
        h('div', { class: 'wf-hint' },
          'Nenhum conteúdo reconhecido nas mensagens deste contato — vai o modelo padrão, que é o ' +
            'que existe justamente para quando não se sabe o que ela quer. Nenhuma etiqueta de ' +
            'conteúdo é aplicada: o padrão não afirma que ela pediu alguma coisa.')
      );
    } else if (conteudos.length > 1) {
      cartaoFechar.append(
        h('div', { class: 'wf-block' }, `Casou com ${conteudos.length} conteúdos (${conteudos.map((c) => c.nome).join(', ')}) — escolha o modelo à mão.`)
      );
    }
    body.append(cartaoFechar);

    const concluir = h('button', { class: 'wf-btn', type: 'button' }, 'Salvar + concluir + próximo');
    concluir.addEventListener('click', runConcluir);
    body.append(h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Só encerrar'),
      h('div', { class: 'wf-preview' }, 'Grava a classificação, marca a data de conclusão, conclui e abre o próximo. Não envia mensagem.'),
      concluir,
    ]));

    const macro = h('button', { class: 'wf-btn', type: 'button' }, 'Enviar grupo + salvar + concluir');
    macro.addEventListener('click', runMacro);
    body.append(h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Com link de grupo'),
      h('div', { class: 'wf-preview' }, 'O mesmo, mas enviando antes o link do grupo da cidade. Só serve com os grupos cadastrados na aba Config.'),
      macro,
    ]));

    for (const template of state.templates) body.append(renderTemplateCard(template));
    if (!state.templates.length) {
      body.append(h('p', { class: 'wf-hint' }, 'Nenhuma resposta cadastrada. Vá na aba Config.'));
    }

    renderModelos();
  }

  // ---- o fluxo editável (a janela é src/fluxo.html; aqui só se USA e se conta) --------------

  /**
   * A tabela de regras com o fluxo que ELE editou — e contando quem venceu.
   *
   * A EDIÇÃO mora em `src/fluxo.html`, uma janela separada: pedido dele (01/09/2026), depois de eu
   * ter tentado enfiar isso numa aba do painel. Um fluxo de dezesseis passos não cabe numa coluna
   * de 380px sem virar lista, e lista não mostra que a decisão é uma cascata.
   *
   * O contador responde a pergunta que nem eu sei responder olhando o código: **quais regras
   * decidem a fila dele de verdade.** Na janela ele vê que poucas resolvem a maioria dos contatos e
   * que várias nunca disparam — e regra que nunca dispara é candidata a sair da frente de outra.
   */
  /**
   * A ÁRVORE vence a tabela quando ela existe.
   *
   * `state.fluxo.arvore` só existe depois de ele abrir a janela do fluxo, e a árvore que nasce lá
   * é a tabela de hoje achatada — há teste exigindo que as duas decidam igual em 400 contextos.
   * Ou seja: ligar não muda nada; o que muda é o que ELE montar depois.
   *
   * Sem árvore, o caminho é o de sempre. Isso importa mais do que parece: quem nunca abriu a
   * janela continua rodando o motor testado desde agosto, sem depender de nada novo dar certo.
   */
  function sugerirAcaoComFluxo(ctx) {
    const arvore = state.fluxo?.arvore;
    const r = Array.isArray(arvore) && arvore.length ? arvoreLib.decidir(ctx, arvore, state.fluxo) : sugerirAcao(ctx, state.fluxo);
    if (r?.id) {
      const v = { ...(state.fluxo?.vitorias || {}) };
      v[r.id] = (Number(v[r.id]) || 0) + 1;
      state.fluxo = { ...state.fluxo, vitorias: v };
      agendarGravacaoDoFluxo();
    }
    return r;
  }

  let timerFluxo = null;

  /**
   * Grava o contador com atraso, agrupando a rajada.
   *
   * A rodada trata dezenas de contatos seguidos, e gravar a cada decisão é escrita à toa. É
   * armazenamento local, não rede, então o custo é baixo — mas o padrão do projeto é não gastar por
   * hábito. Perder a última contagem se o painel fechar no meio não custa nada: isto é
   * estatística, não dado de eleitor.
   */
  function agendarGravacaoDoFluxo() {
    clearTimeout(timerFluxo);
    timerFluxo = setTimeout(async () => {
      try {
        const atual = await store.get('fluxo');
        await store.set('fluxo', { ...atual, vitorias: state.fluxo.vitorias });
      } catch (_) {
        // Extensão recarregada com a aba aberta: o contexto morre. Contagem não vale um erro.
      }
    }, 800);
  }

  /**
   * Abre a JANELA do fluxo — pedindo ao service worker.
   *
   * **`chrome.windows` não existe em content script**, e o painel encaixado roda dentro da página
   * do mobiliza. Chamar `chrome.windows.create` daqui daria `undefined` — mesma armadilha do
   * `chrome.power` da rodada, que já está registrada no CLAUDE.md. Quem tem a API é o
   * `background.js`, então a abertura vira mensagem.
   *
   * A janela não fala com a plataforma: só lê e grava a configuração do fluxo. Por isso abre a
   * qualquer momento, com ou sem atendimento na tela — é para arrumar o fluxo ANTES da rodada.
   */
  async function abrirJanelaDoFluxo() {
    try {
      const r = await chrome.runtime.sendMessage({ type: MSG_FLUXO });
      if (r?.ok) setStatus(r.focada ? 'A janela do fluxo já estava aberta.' : 'Janela do fluxo aberta.', 'ok');
      else setStatus('Não consegui abrir a janela do fluxo: ' + (r?.motivo || 'sem motivo'), 'err');
    } catch (err) {
      // Extensão recarregada com a aba aberta: o service worker não responde até o F5.
      setStatus('Não consegui falar com a extensão (dê F5 na aba): ' + (err?.message || err), 'err');
    }
  }


  // ---- modelos de mensagem (templates aprovados da plataforma) ------------

  /**
   * Diferente das respostas prontas, o texto do modelo é fixo e aprovado — o WhatsFill não
   * interpola nada nele. O valor aqui é o acesso rápido e, principalmente, funcionar com a
   * janela de 24h expirada.
   */
  function renderModelos() {
    body.append(h('hr', { class: 'wf-sep' }), h('h3', { class: 'wf-h' }, 'Modelos de mensagem'));

    if (!state.hsmTemplates.length) {
      /**
       * **O botão fica AQUI, não em outra aba.**
       *
       * O envio simples de um modelo — sem concluir, sem agradecer, sem próximo — sempre existiu
       * nesta lista (`renderModeloCard`: "Enviar" e "Só preparar"). Só que a lista nasce vazia e o
       * único "Carregar modelos" morava na aba Automatizado, com o texto daqui dizendo *"clique em
       * Recarregar"* sem dizer onde. Resultado: o caminho mais simples do painel era o único
       * inalcançável — *"tendo problemas para enviar novamente, só preciso enviar o modelo"*
       * (01/09/2026).
       *
       * Nasce de CLIQUE e não do desenho, pela regra do projeto: `renderAll` roda o tempo todo, e
       * rede disparada de dentro de um `render*` vira uma requisição por redesenho.
       */
      const carregar = h('button', { class: 'wf-btn', type: 'button' }, 'Carregar modelos');
      carregar.addEventListener('click', () => withBusy(carregarModelos));
      body.append(
        h('p', { class: 'wf-hint' },
          'Nenhum modelo aprovado carregado ainda. Com um atendimento aberto (é dele que sai o ' +
            'canal), clique abaixo — depois cada modelo tem "Enviar", que manda só o modelo e ' +
            'mais nada.'),
        carregar
      );
      return;
    }

    body.append(
      h('p', { class: 'wf-hint' }, `${state.hsmTemplates.length} modelo(s) aprovado(s) na plataforma. Continuam valendo com a janela expirada.`)
    );

    const lista = h('div', {});
    const filtro = h('input', { type: 'text', placeholder: 'filtrar modelos', value: state.hsmFilter });
    // Container próprio: re-renderizar só a lista evita roubar o foco enquanto você digita.
    filtro.addEventListener('input', () => {
      state.hsmFilter = filtro.value;
      renderListaModelos(lista);
    });

    body.append(filtro, lista);
    renderListaModelos(lista);
  }

  function renderListaModelos(container) {
    container.replaceChildren();
    const termo = cities.normalize(state.hsmFilter);
    const achados = termo
      ? state.hsmTemplates.filter((m) => cities.normalize(`${m.name} ${m.text}`).includes(termo))
      : state.hsmTemplates;

    if (!achados.length) {
      container.append(h('p', { class: 'wf-hint' }, 'Nenhum modelo com esse filtro.'));
      return;
    }
    for (const modelo of achados.slice(0, 8)) container.append(renderModeloCard(modelo));
    if (achados.length > 8) {
      container.append(h('p', { class: 'wf-hint' }, `… e mais ${achados.length - 8}. Refine o filtro.`));
    }
  }

  function renderModeloCard(modelo) {
    const card = h('div', { class: 'wf-card' });
    const midia = modelo.fileType ? ` · ${String(modelo.fileType).toLowerCase()}` : '';
    card.append(
      h('h4', {}, `${modelo.name}${midia}`),
      h('div', { class: 'wf-preview' }, modelo.text || '(modelo sem texto)')
    );

    const enviar = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Enviar');
    const preparar = h('button', { class: 'wf-btn', type: 'button' }, 'Só preparar');
    card.append(h('div', { class: 'wf-row' }, [enviar, preparar]));

    const pendente = state.pageState.isPending;
    const comParams = modelo.params?.length > 0;

    if (comParams) {
      enviar.disabled = true;
      preparar.disabled = true;
      card.append(h('div', { class: 'wf-block' }, `Este modelo ${hsmLib.PARAMS_NAO_APRENDIDOS}`));
    } else if (pendente) {
      enviar.disabled = true;
      preparar.disabled = true;
      card.append(h('div', { class: 'wf-block' }, 'Atendimento pendente — clique em Iniciar atendimento acima.'));
    } else {
      enviar.addEventListener('click', () => withBusy(() => enviarModelo(modelo, { send: true })));
      preparar.addEventListener('click', () => withBusy(() => enviarModelo(modelo, { send: false })));
    }

    return card;
  }

  /**
   * @param {object} opts
   * @param {boolean} opts.send envia de verdade (respeitando o "Enviar automático")
   * @param {boolean} [opts.jaConfirmado] a duplicata já foi mostrada e aceita por quem chamou.
   *   É o caso da rodada: o aviso vira linha da pergunta, e o `confirm()` nativo aqui abriria
   *   um segundo diálogo, depois da decisão, travando o laço.
   */
  async function enviarModelo(modelo, { send, jaConfirmado = false }) {
    // Mesmas travas do envio comum: automático desligado só prepara, e avisa duplicata.
    const vaiEnviar = send && state.settings.autoSend;
    // Contato capturado ANTES do envio: ver o comentário em sendTemplate.
    const alvo = state.contact;

    if (vaiEnviar && state.settings.antiDup && !jaConfirmado) {
      const already = await templatesLib.wasSent(alvo.id, hsmKey(modelo));
      if (
        already &&
        !confirm(
          `O modelo "${modelo.name}" já foi enviado para ${already.nome || alvo.name} em ${new Date(already.at).toLocaleString('pt-BR')}.\n\nEnviar de novo?`
        )
      ) {
        setStatus('Envio cancelado.');
        return false;
      }
    }

    if (vaiEnviar) await throttle();
    setStatus(vaiEnviar ? `Enviando o modelo "${modelo.name}"…` : `Abrindo "${modelo.name}" no diálogo…`);

    const resultado = await page.sendMessageTemplate(modelo, { send: vaiEnviar });

    if (resultado?.sent) {
      state.lastSendAt = Date.now();
      await templatesLib.markSent(alvo.id, hsmKey(modelo), { nome: alvo.name });
      setStatus(`Modelo enviado: ${modelo.name}`, 'ok');
      return true;
    } else {
      setStatus(
        send && !state.settings.autoSend
          ? 'Envio automático está desligado (aba Config): o diálogo ficou pronto, clique em "Enviar mensagem".'
          : `Diálogo pronto com "${modelo.name}". Confira e clique em "Enviar mensagem".`,
        'ok'
      );
    }
    // Quem pediu envio de verdade precisa saber se saiu — o fluxo de fecho depende disso.
    return !vaiEnviar;
  }

  /**
   * O fecho do atendimento: manda o modelo do conteúdo pedido, agradece e conclui.
   *
   * O conteúdo pedido já foi identificado pela regra de etiqueta ("zucco" → "Conteúdo Zucco");
   * a tabela da Config diz qual modelo aprovado corresponde. Nada é escolhido por semelhança:
   * sem mapeamento, ou com nome ambíguo, o painel para e explica.
   */
  async function runFecharComConteudo() {
    await withBusy(async () => {
      if (state.pageState.isPending) {
        setStatus('Atendimento pendente: clique em "Iniciar atendimento" antes.', 'err');
        return;
      }

      const conteudos = state.tagSuggestions.filter((s) => s.origem === 'conteúdo');
      if (conteudos.length > 1) {
        setStatus(
          `O contato casou com ${conteudos.length} conteúdos (${conteudos.map((c) => c.nome).join(', ')}). ` +
            'Não vou escolher por você — envie o modelo à mão.',
          'err'
        );
        return;
      }

      /**
       * **Nada reconhecido → vai o MODELO PADRÃO**, e não um conteúdo inventado.
       *
       * Pedido dele (02/09/2026): *"esse botão deve utilizar o modelo padrão, fica pedindo
       * conteúdo sem necessidade, só tem que mandar o que estou pedindo"*.
       *
       * Antes o vazio caía no "conteúdo preferido" da Config — que é uma ETIQUETA, e por isso
       * dependia de a tabela "Modelo por conteúdo" ter uma linha para ela. Duas configurações para
       * mandar um modelo, e a etiqueta ainda era aplicada como se ele tivesse pedido aquele
       * conteúdo. O modelo padrão é o que ele já cadastrou para exatamente este caso: mandar
       * alguma coisa quando não se sabe o que a pessoa quer.
       *
       * O preferido continua como último recurso, para quem já tinha só ele configurado — mas
       * agora vem depois, não na frente.
       */
      let modelo = null;
      let nomeDoConteudo = conteudos.length === 1 ? conteudos[0].nome : '';
      let usouPadrao = false;

      if (nomeDoConteudo) {
        const mapa = await store.get('contentTemplates');
        const achado = hsmLib.templateParaConteudo(nomeDoConteudo, mapa, state.hsmTemplates);
        if (achado.erro) return setStatus(achado.erro, 'err');
        modelo = achado.modelo;
      } else {
        const daVez = anunciosLib.padraoDaVez(
          await carregarModelosPadrao(),
          Number(await store.get('modeloPadraoIndex')) || 0
        );
        if (daVez) {
          // Mesmo caminho da rodada para achar o modelo aprovado pelo NOME.
          const porNome = hsmLib.modeloPorTexto([daVez.nome], { [daVez.nome]: daVez.nome }, state.hsmTemplates);
          if (porNome?.erro) return setStatus(porNome.erro, 'err');
          modelo = porNome?.modelo || null;
          usouPadrao = !!modelo;
          // O rodízio anda só quando o envio acontece — ver `templates.avancarVariante`, mesma
          // razão: queimar a vez de um modelo que não saiu faria o próximo pular sozinho.
          if (modelo && Number.isInteger(daVez.proximo)) {
            await store.set('modeloPadraoIndex', daVez.proximo);
          }
        }
        if (!modelo) {
          // Sem modelo padrão cadastrado, o preferido ainda resolve para quem já o tinha.
          nomeDoConteudo = String(await store.get('conteudoPreferido') || '').trim();
          if (!nomeDoConteudo) {
            setStatus(
              'Não há modelo padrão cadastrado na aba Config (nem "conteúdo preferido") — ' +
                'não tenho modelo para enviar.',
              'err'
            );
            return;
          }
          const mapa = await store.get('contentTemplates');
          const achado = hsmLib.templateParaConteudo(nomeDoConteudo, mapa, state.hsmTemplates);
          if (achado.erro) return setStatus(achado.erro, 'err');
          modelo = achado.modelo;
        }
      }

      /**
       * A etiqueta do preferido entra junto com o modelo — **mas não no caminho do modelo padrão.**
       *
       * Quando o preferido é usado, ele está dizendo "o conteúdo é este, o parser é que não viu" —
       * e a etiqueta registra isso, com o motivo dizendo que veio do fecho. O modelo padrão não
       * afirma nada sobre o que ela pediu: é o que se manda justamente quando não se sabe. Pôr uma
       * etiqueta de conteúdo ali seria inventar um pedido que ninguém fez, e a etiqueta fica
       * permanente no CRM.
       *
       * A etiqueta não é criada no CRM se não existir — criar rótulo é decisão dele, e um erro de
       * digitação na Config viraria etiqueta permanente. Falhar aqui também não cancela o envio:
       * etiqueta é organização interna, a mensagem é o que o contato recebe. O aviso vai no fim, e
       * não em `setStatus` agora, porque a linha seguinte ("1/4 gravando…") o apagaria.
       */
      let avisoEtiqueta = '';
      if (!conteudos.length && nomeDoConteudo) {
        const tag = await tagsLib.resolveTag(nomeDoConteudo);
        if (tag) {
          state.tagSuggestions = [
            ...state.tagSuggestions,
            {
              origem: 'conteúdo',
              nome: nomeDoConteudo,
              tag,
              motivo: 'posta por você no fecho (o parser não reconheceu)',
              marcada: true,
            },
          ];
        } else {
          avisoEtiqueta = ` — mas a etiqueta "${nomeDoConteudo}" não existe no CRM e não foi aplicada`;
        }
      }

      if (!state.settings.autoSend) {
        setStatus('Este fluxo manda duas mensagens seguidas, então precisa do "Enviar automático" ligado (aba Config).', 'err');
        return;
      }

      // O agradecimento usa {{primeiro_nome}}: se travar, é melhor descobrir AGORA, antes de
      // já ter mandado o modelo e deixado o atendimento pela metade.
      const agradecimento = state.templates.find((t) => t.id === THANKS_TEMPLATE_ID);
      if (agradecimento) {
        const { missing, reasons } = vars.render(agradecimento.text, await currentVarContext());
        if (missing.length) {
          setStatus('Parei antes de enviar nada: ' + vars.explainMissing(missing, reasons), 'err');
          return;
        }
      }

      setStatus('1/4 gravando classificação…');
      if (!(await saveClassification({ withCompletionDate: true, quiet: true, tirarSemRetorno: true }))) return;

      setStatus(`2/4 enviando o modelo "${modelo.name}"…`);
      if (!(await enviarModelo(modelo, { send: true }))) return;

      if (agradecimento) {
        setStatus('3/4 agradecendo…');
        if (!(await sendTemplate(agradecimento, { send: true }))) return;
      }

      setStatus('4/4 concluindo…');
      // Diz QUAL modelo saiu: com o padrão em rodízio, o próximo contato recebe outro, e sem esta
      // linha ele não teria como saber qual foi para este.
      const deOnde = usouPadrao ? ` (modelo padrão "${modelo.name}")` : '';
      await concluirEAbrirProximo('Enviado e classificado' + deOnde + avisoEtiqueta);
    });
  }

  /** Prefixo separa o registro anti-duplicata das respostas prontas, que têm id próprio. */
  function hsmKey(modelo) {
    return `hsm:${modelo.id}`;
  }

  function renderTemplateCard(template) {
    const card = h('div', { class: 'wf-card' });
    const preview = h('div', { class: 'wf-preview' }, '…');
    const sendBtn = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Enviar');
    const insertBtn = h('button', { class: 'wf-btn', type: 'button' }, 'Só inserir');

    card.append(h('h4', {}, template.name), preview, h('div', { class: 'wf-row' }, [sendBtn, insertBtn]));

    async function renderPreview() {
      const ctx = await currentVarContext();
      // A variante MOSTRADA é a que `sendTemplate` vai usar se você clicar Enviar agora — só
      // avança depois que a mensagem sai de verdade, então reabrir esta aba não muda nada.
      const textoVariante = await templatesLib.varianteAtual(template);
      const { text, missing, reasons } = vars.render(textoVariante, ctx);
      preview.textContent = text;

      const pending = state.pageState.isPending;
      sendBtn.disabled = pending || missing.length > 0 || state.busy;
      insertBtn.disabled = pending || state.busy;

      card.querySelectorAll('.wf-block').forEach((n) => n.remove());
      if (pending) {
        card.append(h('div', { class: 'wf-block' }, 'Atendimento pendente — clique em Iniciar atendimento acima.'));
      } else if (missing.length) {
        card.append(h('div', { class: 'wf-block' }, vars.explainMissing(missing, reasons)));
      }

      const already = await templatesLib.wasSent(state.contact.id, template.id);
      if (already && state.settings.antiDup) {
        // O nome de quem recebeu vai no aviso: se for outro, o próprio aviso denuncia o bug.
        const outroNome = already.nome && state.contact.name && already.nome !== state.contact.name;
        card.append(
          h('div', { class: 'wf-block' },
            `Já enviei esta resposta para ${already.nome || 'este contato'} em ` +
              `${new Date(already.at).toLocaleString('pt-BR')}.` +
              (outroNome ? ` Atenção: o registro está no nome de ${already.nome}, não neste contato — isso é bug do WhatsFill.` : ''))
        );
      }
    }

    renderPreview();
    sendBtn.addEventListener('click', () => withBusy(() => sendTemplate(template, { send: true })).then(renderPreview));
    insertBtn.addEventListener('click', () => withBusy(() => sendTemplate(template, { send: false })));
    return card;
  }

  function currentVarContext() {
    return vars.buildContext({
      contact: state.contact,
      nome: valueNamed('Nome'),
      cidade: valueNamed('Cidade'),
    });
  }

  async function sendTemplate(template, { send, jaConfirmado = false }) {
    /**
     * Contato capturado ANTES de qualquer await.
     *
     * O envio demora (espera o botão aparecer e o composer esvaziar) e, nesse intervalo, um
     * clique seu na fila troca o atendimento — o painel recarrega e `state.contact` vira outra
     * pessoa. Lendo o contato só na hora de gravar, o registro anti-duplicata caía em quem
     * acabou de abrir, e o aviso "já enviei esta resposta" aparecia para quem nunca recebeu.
     */
    const alvo = state.contact;
    // Peek, não avança: só o envio de verdade lá embaixo (`page.sendText`) avança o ponteiro.
    const textoVariante = await templatesLib.varianteAtual(template);
    const { text, missing, reasons } = vars.render(textoVariante, await currentVarContext());

    if (missing.length) {
      setStatus('Bloqueado: ' + vars.explainMissing(missing, reasons), 'err');
      return false;
    }

    if (!send || !state.settings.autoSend) {
      await page.setComposerText(text);
      setStatus(
        send && !state.settings.autoSend
          ? 'Envio automático está desligado (aba Config): texto inserido, envie você.'
          : 'Texto inserido no campo de mensagem.',
        'ok'
      );
      return true;
    }

    if (state.session?.expired) {
      await page.setComposerText(text);
      setStatus('Janela expirada: inseri o texto, mas não enviei.', 'err');
      return false;
    }

    if (state.settings.antiDup && !jaConfirmado) {
      const already = await templatesLib.wasSent(alvo.id, template.id);
      if (
        already &&
        !confirm(
          `"${template.name}" já foi enviado para ${already.nome || alvo.name} em ${new Date(already.at).toLocaleString('pt-BR')}.\n\nEnviar de novo?`
        )
      ) {
        setStatus('Envio cancelado.');
        return false;
      }
    }

    await throttle();
    setStatus('Enviando…');
    await page.sendText(text);
    state.lastSendAt = Date.now();
    await templatesLib.markSent(alvo.id, template.id, { nome: alvo.name });
    await templatesLib.avancarVariante(template);
    const marca = await etiquetarPedidoDeAjuda(template, alvo);
    /**
     * **Pedir o endereço ABRE o caso de material, e é aqui que ele é marcado.**
     *
     * Relato dele (04/09/2026): *"pedi o endereço pelo modelo e não etiquetou e concluiu"*. A
     * marca existia só para quando ELA responde com um endereço — mas quem abre o caso é o nosso
     * pedido, e é dele que sai a lista que ele transfere no fim do dia.
     *
     * Fica no mesmo lugar da etiqueta de pedido de ajuda, e pelo mesmo motivo: este é o ponto
     * ÚNICO por onde toda mensagem sai — a rodada, o modelo aprovado, um ramo do quadro, a escolha
     * da IA e as respostas rápidas da caixa.
     *
     * Casa pelo TEXTO RENDERIZADO, não pelo id: o pedido dele sai por modelo aprovado, cuja
     * redação é da plataforma.
     */
    const marcaEndereco = templatesLib.ehPedidoDeEndereco(text) ? await etiquetarEndereco(alvo) : '';
    setStatus(`Enviado: ${template.name}${marca}${marcaEndereco}`, 'ok');
    return true;
  }

  /**
   * **Quem recebeu a negativa fica marcado no CRM.**
   *
   * Pedido dele (02/09/2026), com a print da Marli: *"já existe a etiqueta de 🔴Procura emprego ou
   * dinheiro, deve ser aplicada também"*.
   *
   * Fica aqui, dentro do `sendTemplate`, porque este é o **ponto único** por onde toda resposta
   * pronta sai: a rodada, a tecla `f` de um ramo do quadro, a escolha da IA e as respostas rápidas
   * da caixa. Foi por uma resposta rápida que ele mandou a da Marli — e um gancho na rodada não
   * teria pegado.
   *
   * **Aplica de verdade, não sugere.** A resposta rápida não conclui o atendimento, então nada
   * chama `saveClassification` depois dela: uma sugestão em `tagSuggestions` ficaria esperando uma
   * gravação que não vem.
   *
   * Falhar aqui **nunca** é erro do envio — a mensagem já saiu. Etiqueta é organização interna; o
   * que o contato recebe vem primeiro. O aviso vai junto do status, para ele saber que faltou.
   */
  async function etiquetarPedidoDeAjuda(template, alvo) {
    if (!ETIQUETA_PEDIDO_IDS.includes(template.id)) return '';
    const nome = String(state.auto.cfg.etiquetaPedidoAjuda || '').trim();
    if (!nome || !alvo?.id) return '';

    try {
      const tag = await tagsLib.resolveTag(nome);
      if (!tag) return ` (a etiqueta "${nome}" não existe no CRM — não marquei)`;
      if ((alvo.tagsId || []).includes(tag.id)) return '';
      const r = await tagsLib.applyTags(alvo, [tag.id]);
      return r?.ok ? ` + etiqueta "${tag.label}"` : ` (não consegui aplicar "${nome}")`;
    } catch (err) {
      return ` (não consegui aplicar "${nome}": ${err?.message || err})`;
    }
  }

  /**
   * **É caso de material a enviar?** Um lugar só, porque TRÊS pontos perguntam isso — o sinal do
   * quadro, o rótulo da tecla 2 e a etiqueta ao pular —, e três leituras separadas divergem na
   * primeira mudança.
   *
   * **A ETIQUETA vem primeiro, e é ela que manda.** Regra dele (04/09/2026): *"para pular o contato
   * sempre será depois que eu pedir o endereço e etiqueta for colocada"*. Quem já está marcado é
   * pulado em toda passada, tenha ela escrito o que for — é o mesmo desenho da etiqueta de sem
   * interesse, que a rodada aplica E lê. O detector é só a outra ponta: reconhece a resposta e põe
   * a marca, para ele não precisar marcar contato por contato.
   *
   * **O detector sozinho não sustenta o caso**, e é de propósito: ele lê a rajada, então some
   * assim que respondemos. Quem carrega o estado adiante é a etiqueta no CRM — e é ela que ele
   * tira quando a conversa for transferida, devolvendo o contato ao fluxo normal.
   */
  async function enderecoParaMaterial() {
    const marcada = await etiquetaDeEndereco();
    if (marcada) return { motivo: `tem a etiqueta "${marcada}" — é material a enviar`, jaMarcada: true };
    const dela = informouEndereco(state.entrantes, state.nossaUltimaAt);
    return dela ? { ...dela, jaMarcada: false } : null;
  }

  /** A etiqueta de endereço que o contato JÁ tem no CRM — `null` sem o campo preenchido. */
  function etiquetaDeEndereco() {
    return etiquetaDaLista(String(state.auto.cfg.etiquetaEndereco || '').trim());
  }

  /**
   * **A etiqueta de quem mandou o ENDEREÇO — a única escrita que o "pular" faz.**
   *
   * Pedido dele (04/09/2026): *"a pessoa deve ser pulada e não concluída, pois vou transferir pro
   * responsável a conversa no final"*. A etiqueta é o que torna essa lista utilizável: pular não
   * deixa rastro nenhum, e sem marca ele teria que reencontrar esses contatos na fila inteira.
   *
   * **É exceção à regra dele de 31/08** (*"ao pular tem gravado dados no CRM, o que faz eu perder
   * tempo"*), e a exceção é estreita de propósito: uma escrita de etiqueta, só quando o endereço
   * foi reconhecido, sem gravar campo nenhum, sem data de conclusão e sem abrir a pergunta de
   * cidade — que era o que custava caro ali.
   *
   * Falhar aqui **nunca** impede o pulo: etiqueta é organização interna, e o aviso vai para o log.
   */
  async function etiquetarEndereco(alvo) {
    const nome = String(state.auto.cfg.etiquetaEndereco || '').trim();
    if (!nome) return ' (sem etiqueta de endereço configurada na aba Automatizado)';
    if (!alvo?.id) return '';

    try {
      const tag = await tagsLib.resolveTag(nome);
      if (!tag) return ` (a etiqueta "${nome}" não existe no CRM — não marquei)`;
      if ((alvo.tagsId || []).includes(tag.id)) return '';
      const r = await tagsLib.applyTags(alvo, [tag.id]);
      return r?.ok ? ` + etiqueta "${tag.label}"` : ` (não consegui aplicar "${nome}")`;
    } catch (err) {
      return ` (não consegui aplicar "${nome}": ${err?.message || err})`;
    }
  }

  /**
   * O texto que vai sair pede o endereço? Olha o texto base e a variante da vez — as duas, porque
   * o revezamento pode estar em qualquer uma delas.
   */
  async function vaiPedirEndereco(template) {
    if (!template) return false;
    if (templatesLib.ehPedidoDeEndereco(template.text)) return true;
    try {
      return templatesLib.ehPedidoDeEndereco(await templatesLib.varianteAtual(template));
    } catch (_) {
      return false;
    }
  }

  async function throttle() {
    const wait = state.settings.throttleMs - (Date.now() - state.lastSendAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  /** Fecha o atendimento sem enviar nada — o caminho do dia a dia. */
  /**
   * Fecho comum das macros: conclui na plataforma e abre o próximo da fila.
   *
   * Recebe o que JÁ foi feito para o status não mentir quando o fluxo para no meio — dizer
   * "falhou" depois de a mensagem ter saído faria você reenviar para o contato.
   */
  async function concluirEAbrirProximo(jaFeito, opts) {
    let concluido;
    try {
      concluido = await concluirPeloPainel();
    } catch (err) {
      setStatus(`${jaFeito}, mas não consegui concluir (${err.message}). Conclua na aba.`, 'err');
      return false;
    }
    if (concluido.dialogOpen) {
      setStatus(`${jaFeito}. A plataforma pediu um motivo de conclusão — responda o diálogo na aba.`, 'ok');
      return false;
    }
    if (!concluido.ok) {
      setStatus(`${jaFeito}, mas ${concluido.reason}. Conclua na aba.`, 'err');
      return false;
    }

    const proximo = await page.openNextSession(opts);
    // O aviso de aba não invalida o que já foi feito: a mensagem saiu e o atendimento fechou.
    // Só diz que o próximo veio da aba em que a plataforma estava, não da pedida.
    const aviso = proximo.avisoAba ? ` ${proximo.avisoAba}` : '';
    setStatus(
      (proximo.changed ? 'Pronto. Próximo atendimento aberto.' : `${jaFeito} e concluído. ${proximo.reason}`) + aviso,
      'ok'
    );
    return true;
  }

  /**
   * Abertura do laço assíncrono: pede nome e cidade, conclui e vai para o próximo.
   *
   * Concluir aqui não é "acabou" — é tirar da fila. Quando a pessoa responder, a plataforma
   * traz o atendimento de volta para as não lidas, e aí a classificação já entra sozinha.
   *
   * NÃO carimba data de conclusão: quem só recebeu a pergunta ainda não foi concluído, e a data
   * gravada agora nunca mais seria corrigida (ela só preenche buraco).
   */
  async function runPedirDados() {
    await withBusy(async () => {
      const template = state.templates.find((t) => t.id === ASK_TEMPLATE_ID);
      if (!template) {
        setStatus(`Não achei o template "${ASK_TEMPLATE_ID}". Confira a aba Config.`, 'err');
        return;
      }
      if (state.pageState.isPending) {
        setStatus('Atendimento pendente: clique em "Iniciar atendimento" antes de rodar o fluxo.', 'err');
        return;
      }
      // Sem envio automático, sendTemplate apenas insere o texto — e concluir depois disso
      // fecharia o atendimento sem a pergunta ter saído.
      if (!state.settings.autoSend) {
        setStatus('Este fluxo conclui logo após enviar, então precisa do "Enviar automático" ligado (aba Config).', 'err');
        return;
      }

      setStatus('1/3 enviando o pedido de dados…');
      if (!(await sendTemplate(template, { send: true }))) return;

      setStatus('2/3 concluindo o atendimento…');
      // Volta para "Novos": assumir este atendimento tirou ele de lá, e é lá que está o
      // próximo contato que ainda não recebeu a pergunta.
      await concluirEAbrirProximo('Pedido de dados enviado', { aba: 'Novos' });
    });
  }

  async function runConcluir() {
    await withBusy(async () => {
      if (state.pageState.isPending) {
        setStatus('Atendimento pendente: clique em "Iniciar atendimento" antes de concluir.', 'err');
        return;
      }

      setStatus('1/3 gravando classificação…');
      if (!(await saveClassification({ withCompletionDate: true, quiet: true, tirarSemRetorno: true }))) return;

      setStatus('2/3 concluindo o atendimento…');
      await concluirEAbrirProximo('Classificado');
    });
  }

  async function runMacro() {
    await withBusy(async () => {
      const template = state.templates.find((t) => t.id === GROUP_TEMPLATE_ID);
      if (!template) {
        setStatus(`Não achei o template "${GROUP_TEMPLATE_ID}". Confira a aba Config.`, 'err');
        return;
      }
      if (state.pageState.isPending) {
        setStatus('Atendimento pendente: clique em "Iniciar atendimento" antes de rodar o fluxo.', 'err');
        return;
      }

      setStatus('1/4 gravando classificação…');
      if (!(await saveClassification({ withCompletionDate: true, quiet: true, tirarSemRetorno: true }))) return;

      setStatus('2/4 enviando o link do grupo…');
      if (!(await sendTemplate(template, { send: true }))) return;

      setStatus('3/4 concluindo o atendimento…');
      await concluirEAbrirProximo('Enviado e classificado');
    });
  }

  // ---- aba Automatizado --------------------------------------------------

  /**
   * Duas rodadas em lote sobre a fila da esquerda, uma por vez.
   *
   * **Novos → pedir os dados.** O contato chega do anúncio com uma frase só ("aceito receber
   * conteúdos do…"), que não dá nome nem cidade. A rodada assume, manda o pedido de dados,
   * conclui e volta para os Novos. Aqui o envio é texto livre porque a janela de 24h está
   * aberta — eles acabaram de chegar.
   *
   * **Sem retorno → modelo aprovado.** Quem parou de responder há dias tem a janela vencida, e
   * nessa situação texto livre não sai: modelo aprovado é o único envio que chega.
   *
   * **O que as duas fazem com cada contato:** abrem o atendimento na fila, assumem se estiver
   * pendente, enviam, marcam no anti-duplicata e concluem. Concluir tira da fila; quando a
   * pessoa responder, a plataforma traz o atendimento de volta para as não lidas e a
   * classificação automática entra sozinha. É o laço assíncrono das macros da aba Respostas,
   * percorrendo a fila em vez de um contato por clique.
   *
   * **As travas, todas porque o destinatário é gente real em produção:** anti-duplicata por
   * contato+resposta (vale também entre rodadas), pausa entre envios (rajada é o que queima
   * número no WhatsApp), limite por rodada, botão Parar e — a mais importante — a rodada
   * **para no primeiro erro** em vez de seguir mandando às cegas.
   *
   * O WhatsFill não escolhe quem entra na rodada: quem manda é o filtro aplicado na plataforma.
   */
  function renderAutomatizado() {
    const cfg = state.auto.cfg;

    body.append(
      h('p', { class: 'wf-hint' },
        'Rodadas em lote sobre a fila da esquerda, do jeito que ela está filtrada agora na ' +
          'plataforma, de cima para baixo. Uma rodada por vez.')
    );

    body.append(renderCartaoMeusAbertos());
    body.append(renderCartaoRitmo(cfg));
    body.append(renderCartaoFila());
    body.append(renderCartaoNovos(cfg));
    body.append(renderCartaoMomento(cfg));
    body.append(renderCartaoRespondidos());
    body.append(renderCartaoEtiquetas(cfg));
    // "Sem retorno" (reabrir em lote + trabalhar em Meus) escondida por decisão do Thiago
    // (15/08): risco de derrubar o número é grande demais para o uso que ela teria — reabrir
    // gente fria em sequência é o padrão que mais se parece com disparo em massa para o
    // WhatsApp. Não apaguei as funções (`renderCartaoReabrir`, `renderCartaoSemRetorno` e o que
    // elas chamam) — só as duas linhas que as colocavam na tela. Reverter é só devolvê-las aqui.
    // body.append(renderCartaoReabrir(cfg));
    // body.append(renderCartaoSemRetorno(cfg, modeloDaRodada()));

    /**
     * **As observações que ele anotou na rodada — e o botão que as manda para mim.**
     *
     * Pedido dele (02/09/2026): *"vou escrever o porque está errado e lhe passar essas informações
     * depois"*. Anotar na caixa da rodada só serve se houver como tirar de lá: sem este botão o
     * caderno ficaria preso no armazenamento do navegador dele.
     *
     * O texto sai agrupado por REGRA (ver `observacoes.paraTexto`), porque é assim que eu conserto:
     * uma regra errada é um lugar no código, e ver as três vezes que ela errou juntas mostra o
     * padrão que uma sozinha não mostra.
     */
    body.append(h('hr', { class: 'wf-sep' }), h('h3', { class: 'wf-h' }, 'Observações para o Claude'));
    const obsNode = h('div', {});
    body.append(obsNode);

    async function desenharObservacoes() {
      obsNode.replaceChildren();
      const todas = observacoesLib.normalizar(await store.get('observacoes'));

      if (!todas.length) {
        obsNode.append(
          h('p', { class: 'wf-hint' },
            'Nenhuma ainda. Quando a rodada sugerir algo errado, clique em "Anotar por que está ' +
              'errado" na caixa da pergunta — a anotação vem para cá com o caso junto.')
        );
        return;
      }

      /**
       * **A cópia manda só as NOVAS.**
       *
       * Pedido dele (02/09/2026): *"ao copiar vai vir casos anteriores, eu tenho que lembrar de
       * apagar para começar outra rodada"*. Regra que exige alguém lembrar não é regra — e a saída
       * que ele tinha (apagar tudo depois de colar) é destrutiva: colagem que der errado leva as
       * anotações junto.
       *
       * Agora cada anotação é marcada ao ser copiada. A próxima cópia começa do zero sozinha, e o
       * histórico continua ali para consultar.
       */
      const novas = todas.filter((x) => !x.copiada);
      const jaForam = todas.length - novas.length;

      obsNode.append(
        h('p', { class: 'wf-hint' },
          (novas.length
            ? `${novas.length} anotação(ões) nova(s)`
            : 'Nenhuma nova desde a última cópia') +
            (jaForam ? ` · ${jaForam} já copiada(s) antes` : '') +
            '. Cada uma traz a regra que decidiu, a tecla que ela sugeriu e o que a pessoa ' +
            'escreveu — é isso que me permite consertar sem adivinhar.')
      );

      const saida = h('textarea', { rows: '6', readonly: 'readonly' });

      /**
       * O que está na tela é o que o botão copia — senão o botão vira surpresa.
       *
       * `mostrarTudo` é o caso em que ele precisa reenviar algo já copiado (a conversa comigo se
       * perdeu, ou ele quer o histórico junto).
       */
      let mostrarTudo = !novas.length;
      const emCena = () => (mostrarTudo ? todas : novas);
      const redesenhar = () => {
        saida.value = observacoesLib.paraTexto(emCena());
      };
      redesenhar();

      const copiar = h('button', { class: 'wf-btn wf-primary', type: 'button' }, '');
      const rotularCopiar = () => {
        copiar.textContent = mostrarTudo
          ? `Copiar todas (${todas.length})`
          : `Copiar as ${novas.length} novas`;
      };
      rotularCopiar();

      copiar.addEventListener('click', async () => {
        const levadas = emCena();
        if (!levadas.length) return;
        let copiou = true;
        try {
          await navigator.clipboard.writeText(saida.value);
        } catch (_) {
          // Área de transferência recusada (foco fora da aba, permissão): selecionar deixa o
          // Ctrl+C funcionar, em vez de o botão não fazer nada e não dizer nada.
          saida.select();
          copiou = false;
        }
        /**
         * Marca mesmo quando a área de transferência recusou: ali o texto ficou SELECIONADO e o
         * caminho é o Ctrl+C dele, que eu não tenho como observar. Marcar é a suposição certa —
         * errar para o outro lado faria a próxima cópia repetir tudo, que é o defeito que isto
         * veio consertar. E se ele precisar de novo, "Copiar todas" está ao lado.
         */
        await store.set('observacoes', observacoesLib.marcarCopiadas(todas, levadas));
        setStatus(
          copiou
            ? `${levadas.length} observação(ões) copiada(s). Cole na conversa com o Claude — a próxima cópia começa do zero.`
            : 'Não consegui copiar sozinho — o texto está selecionado, use Ctrl+C. Já marquei como enviadas.',
          copiou ? 'ok' : 'err'
        );
        await desenharObservacoes();
      });

      const botoes = [copiar];

      // Só aparece quando há as duas coisas: sem novas, o botão de cima já mostra todas.
      if (novas.length && jaForam) {
        const tudo = h('button', { class: 'wf-btn wf-mini', type: 'button' }, `Ver todas (${todas.length})`);
        tudo.addEventListener('click', () => {
          mostrarTudo = !mostrarTudo;
          tudo.textContent = mostrarTudo ? `Só as ${novas.length} novas` : `Ver todas (${todas.length})`;
          redesenhar();
          rotularCopiar();
        });
        botoes.push(tudo);
      }

      /**
       * Apagar continua existindo, mas deixou de ser necessário para começar do zero — que era o
       * único motivo de ele apagar. Serve agora para limpar de vez o que já foi resolvido.
       */
      const limpar = h('button', { class: 'wf-btn wf-danger', type: 'button' }, 'Apagar todas');
      limpar.addEventListener('click', async () => {
        if (!confirm(`Apagar as ${todas.length} observações? Não tem volta.`)) return;
        await store.set('observacoes', observacoesLib.apagarTudo());
        await desenharObservacoes();
        setStatus('Observações apagadas.', 'ok');
      });
      botoes.push(limpar);

      obsNode.append(saida, h('div', { class: 'wf-row' }, botoes));
    }

    desenharObservacoes();

    body.append(h('hr', { class: 'wf-sep' }), h('h3', { class: 'wf-h' }, 'Andamento'));
    logNode = h('div', {});
    body.append(logNode);
    renderAutoLog();
  }

  /**
   * Rodada 3: quem respondeu com os dados e reapareceu em "Meus".
   *
   * A confirmação é por contato, não uma só no começo: o que sai daqui é o modelo aprovado do
   * conteúdo que a pessoa pediu, e enviar o modelo errado é o erro mais caro deste fluxo.
   */
  /**
   * O contato tem alguma etiqueta que o dispensa da rodada?
   *
   * Compara por PEDAÇO do rótulo, sem acento e sem caixa: "engajado" casa com "ENGAJADO/BIZA" e
   * com "Apoiador Muito engajado". É o mesmo tipo de comparação que o resto do projeto usa para
   * etiqueta — rótulo normalizado, nunca id, porque o CRM tem rótulos repetidos com ids
   * diferentes.
   *
   * @param {string[]} etiquetas rótulos que o contato tem (ou vai receber)
   * @returns {string|null} o rótulo que casou, para a sugestão poder nomeá-lo
   */
  async function etiquetaDaLista(lista) {
    /**
     * **Item que começa com `-` é EXCEÇÃO** — pedido dele (03/09/2026).
     *
     * A comparação é por trecho CONTIDO, de propósito ("engajado" casa com "ENGAJADO/BIZA" e com
     * "Apoiador Muito engajado"). O preço apareceu na hora: `assessor` pegava as três etiquetas de
     * assessor **e também `CONTATO-ASSESSOR`**, que é eleitor trazido por um assessor. Ele: *"com
     * exceção do contato assessor"*.
     *
     * Trocar "contido" por "começa com" resolveria este caso e quebraria o outro (a etiqueta que
     * dispensa depende de casar no meio do rótulo). A exceção explícita não quebra nada e fica
     * onde ele pode editar: `assessor, -contato-assessor`.
     */
    const itens = String(lista || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const pedacos = itens
      .filter((p) => !p.startsWith('-'))
      .map((p) => cities.semAcentoNemCaixa(p))
      .filter(Boolean);
    const excecoes = itens
      .filter((p) => p.startsWith('-'))
      .map((p) => cities.semAcentoNemCaixa(p.slice(1).trim()))
      .filter(Boolean);
    if (!pedacos.length) return null;

    /**
     * Lê as etiquetas REAIS do contato, e não a lista que a caixa mostra.
     *
     * **Este era o defeito** (relato dele: *"não pulou o engajado"*): a lista da caixa vem de
     * `tagSuggestions`, que só tem o que a rodada sugere ou reconhece — no contato da print ela
     * mostrava 3 etiquetas enquanto o cabeçalho da plataforma mostrava 5, e `ENGAJADO/BIZA` era
     * justamente uma das que faltavam. A regra nunca via a etiqueta que deveria dispensar.
     */
    const doCrm = new Set(state.contact?.tagsId || []);
    const rotulos = (await tagsLib.allTags().catch(() => []))
      .filter((t) => doCrm.has(t.id))
      .map((t) => t.label);

    for (const rotulo of rotulos) {
      const alvo = cities.semAcentoNemCaixa(rotulo);
      if (excecoes.some((e) => alvo.includes(e))) continue;
      if (pedacos.some((p) => alvo.includes(p))) return rotulo;
    }
    return null;
  }

  /** A etiqueta que dispensa da fila (hoje: manda a mensagem do momento uma vez e conclui). */
  function etiquetaQueDispensaDaFila() {
    return etiquetaDaLista(state.auto.cfg.etiquetasQuePulam);
  }

  /**
   * A etiqueta que só CONCLUI — assessor, equipe, quem é da casa.
   *
   * Pedido dele (03/09/2026): *"contatos com etiqueta de assessor só conclua"*. Lista própria e
   * não um item da outra, porque o desfecho é outro: aqui **nada sai, nunca**.
   */
  /**
   * **A etiqueta de SEM INTERESSE entra junto: quem já foi marcado não recebe mais nada.**
   *
   * Anotação da susana (03/09/2026), na segunda vez que ela apareceu: *"segunda vez que ela vem e
   * eu já tinha especificado que era hostil, por que não gravou? ela está com etiqueta de sem
   * interesse"*.
   *
   * **Gravou — o que faltava era LER.** A etiqueta é aplicada pela tecla `s` e fica permanente no
   * CRM, e nada a consultava depois: na visita seguinte o detector tinha que reconhecer a hostilidade
   * outra vez, do zero, a partir do que ela escrevesse naquele dia. Detector é palpite; a etiqueta é
   * decisão dele, e decisão dele não se redescobre.
   *
   * Entra por aqui e não numa regra nova porque o desfecho é exatamente o mesmo de
   * `etiqueta-so-conclui`: **conclui e não manda nada, nunca**. A lista dele continua editável e
   * independente; o que se soma é a etiqueta que a própria rodada aplica.
   *
   * **Depende do campo estar preenchido na Config** ("Etiqueta de sem interesse"). Vazio, isto não
   * faz nada — e a caixa da rodada já avisa disso na opção `s`.
   */
  /**
   * **A exceção do `contato-assessor` é PISO do código, não texto da Config** — relato dele
   * (04/09/2026): *"pra onde está indo parar as regras que eu falo?"*, com a print de uma contato
   * que chegou pelo anúncio do Instagram pedindo material, tinha cidade e etiqueta de conteúdo, e
   * foi **concluída sem receber nada**. A etiqueta dela era `CONTATO-ASSESSOR`.
   *
   * A regra dele é de 03/09 e eu a implementei como **valor padrão** do campo
   * (`assessor, -contato-assessor`). Só que `store.get` mescla o default apenas nas chaves que
   * FALTAM: quem já tinha `assessor` salvo continuou com `assessor`, e a exceção nunca chegou.
   * **Regra que ele dita não pode virar default de campo que ele já preencheu.**
   *
   * É o mesmo conserto do `tags.ORIGEM_SEMPRE`: a guarda que depende de o campo estar escrito não
   * é guarda. O nome é literal de propósito — `contato-assessor` é eleitor trazido por um assessor,
   * e nenhuma etiqueta de "da casa" se chama assim.
   */
  const NUNCA_SO_CONCLUI = ['-contato-assessor'];

  function etiquetaQueSoConclui() {
    const marcada = String(state.auto.cfg.etiquetaSemInteresse || '').trim();
    const lista = [state.auto.cfg.etiquetasSoConcluir, marcada, ...NUNCA_SO_CONCLUI]
      .filter((p) => String(p || '').trim())
      .join(', ');
    return etiquetaDaLista(lista);
  }

  function renderCartaoRespondidos() {
    const card = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Conferir e responder a fila'),
      h('div', { class: 'wf-preview' },
        'Percorre a fila classificando (nome, cidade, etiquetas, data) e pergunta, contato a ' +
          'contato, o que fazer. A pergunta aparece sempre — sem conteúdo identificado ela vem ' +
          'sem a opção de modelo, e você resolve com concluir, agradecer ou responder à mão.'),
    ]);

    const btn = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Começar pelos Meus');
    btn.disabled = state.auto.rodando;
    btn.addEventListener('click', runLoteRespondidos);

    const btnOutros = h('button', { class: 'wf-btn', type: 'button' }, 'Começar pelos Outros');
    btnOutros.disabled = state.auto.rodando;
    btnOutros.addEventListener('click', runLoteOutros);
    card.append(h('div', { class: 'wf-row' }, [btn, btnOutros]));

    /**
     * A caixa que faz a IA ASSUMIR a rodada — pedido dele (01/09).
     *
     * Fica logo abaixo dos botões de começar porque é o que muda o que a rodada faz: com ela
     * marcada, a caixa de pergunta não abre nos contatos em que a IA escolheu uma resposta.
     *
     * Ela **depende** da avaliação por IA estar ligada na Config, e a linha abaixo diz isso em
     * vez de a caixa ficar marcada sem efeito nenhum — caixa marcada que não faz nada é a
     * armadilha que este painel já pagou com o botão "Avaliar o contato aberto".
     */
    card.append(
      /**
       * O rótulo diz **as duas** coisas que a caixa faz.
       *
       * Ele dizia só "Automatizar com IA", e a caixa automatiza também as REGRAS — que é a metade
       * que resolve a maioria dos contatos, com ou sem IA ligada. Nome que conta metade do que o
       * interruptor faz é o motivo de ele ter perguntado *"essa mensagem foi mandada sozinha?"*
       * olhando para uma conversa que a rodada tinha fechado sem perguntar (02/09/2026).
       */
      checkbox(
        'Automatizar a rodada: envia sozinha a escolha das REGRAS e da IA, sem perguntar',
        state.auto.cfg.automatizarComIA,
        (v) => salvarAuto({ automatizarComIA: v }).then(renderAll)
      )
    );
    card.append(
      h('div', { class: 'wf-origin' },
        'Marcado, quando a IA escolhe uma das SUAS respostas prontas com confiança suficiente, a ' +
          'rodada manda e conclui sozinha — sem abrir a caixa. O que sai continua sendo, palavra ' +
          'por palavra, um texto que você escreveu: isto automatiza o clique, não a escrita. ' +
          'Cada envio vai para o Andamento com o motivo e a confiança dela.'),
      h('div', { class: 'wf-origin' },
        'A caixa volta a abrir sempre que a IA não decide: "este é para você", confiança baixa, ' +
          'resposta travada por variável, contato que já recebeu essa mesma resposta hoje, IA sem ' +
          'chave ou sem rede. O caminho de falha é a rodada de sempre.'),
      h('div', { class: 'wf-origin' },
        'Marcado, a IA também responde a caixa "Cidade a gravar", que era o outro ponto onde a ' +
          'rodada parava esperando clique. Ela aceita o que o parser achou, troca por outro ' +
          'município — e só um que exista na lista do IBGE — ou não grava nada. Município que ela ' +
          'invente não passa. O que ela decidir sobre a cidade vai para o Andamento, linha a linha.')
    );
    /**
     * **O aviso dizia que a caixa não fazia nada sem a IA, e era falso.**
     *
     * Pergunta dele (02/09/2026), depois de ver duas mensagens saírem sozinhas: *"essa mensagem foi
     * mandada sozinha? tem algum gatilho no momento que pede sem ser no modo IA?"*.
     *
     * Tem: esta mesma caixa. A automação das REGRAS é controlada por ela e **não** consulta
     * `state.ia.ligada` — com a avaliação desligada, a rodada continua executando a tecla que a
     * regra recomenda, e a maioria das regras ENVIA. O texto antigo mandava ele procurar no lugar
     * errado justamente quando fosse investigar um envio que não entendeu.
     */
    if (state.auto.cfg.automatizarComIA && !state.ia?.ligada) {
      card.append(
        h('div', { class: 'wf-block' },
          'Atenção: com "Ligar a avaliação por IA" desmarcada, a parte da IA não roda — mas as ' +
            'REGRAS continuam sendo executadas sozinhas por esta caixa, e a maioria delas envia ' +
            'mensagem. Para a rodada voltar a perguntar antes de cada envio, desmarque esta caixa.')
      );
    }

    card.append(
      campoNumero('Perguntar (em vez de concluir) após quantas horas de silêncio', state.auto.cfg.horasSemResposta, (v) =>
        salvarAuto({ horasSemResposta: clampInt(v, 1, 240) }).then(renderAll)
      )
    );
    card.append(
      h('div', { class: 'wf-origin' },
        'Contato cuja última mensagem é minha some da fila sozinho — mas só se eu tiver ' +
          'respondido há POUCO. Passou dessas horas sem ele voltar, a rodada para e pergunta: ' +
          'é a chance de mandar a mensagem do momento (tecla 5) ou um modelo, em vez de fechar ' +
          'quem nunca mandou os dados.')
    );

    card.append(
      campoTexto('Etiquetas que a rodada pode pular (separe por vírgula)', state.auto.cfg.etiquetasQuePulam, (v) =>
        salvarAuto({ etiquetasQuePulam: v.trim() }).then(renderAll)
      ),
      campoTexto('Etiquetas que só CONCLUEM, sem mandar nada (separe por vírgula)', state.auto.cfg.etiquetasSoConcluir, (v) =>
        salvarAuto({ etiquetasSoConcluir: v.trim() }).then(renderAll)
      ),
      h('div', { class: 'wf-hint' },
        'A de cima ainda manda a mensagem do momento uma vez; esta não manda nada, nunca. É para ' +
          'quem é da casa — assessor, equipe. Casa por PEDAÇO do nome: "assessor" pega ' +
          '"Assessor Cap" e "Assessor Claudia". Para tirar uma do meio, ponha um traço na frente ' +
          '— "assessor, -contato-assessor" pega as de assessor e deixa CONTATO-ASSESSOR de fora.')
    );
    card.append(
      checkbox('Pular sozinho, sem perguntar', state.auto.cfg.pularEtiquetasSozinho, (v) =>
        salvarAuto({ pularEtiquetasSozinho: v }).then(renderAll)
      )
    );
    card.append(
      h('div', { class: 'wf-origin' },
        'Marcado, a rodada NÃO pergunta nesses contatos: pula e vai para o próximo, e o pulo ' +
          'aparece no Andamento com o nome da etiqueta que causou. Pular não envia nada e não ' +
          'conclui — o atendimento fica aberto onde estava. Desmarcado, ela só sugere a tecla 2.')
    );
    card.append(
      h('div', { class: 'wf-origin' },
        'Quem tem uma destas vem com "Pular" sugerido: o trabalho da rodada é transformar ' +
          'desconhecido em engajado, e quem já chegou lá não precisa que peçam os dados. Casa por ' +
          'pedaço do rótulo, sem acento e sem caixa — "engajado" pega "ENGAJADO/BIZA" e ' +
          '"Apoiador Muito engajado". Vazio = não pula ninguém. **A sugestão continua sendo só ' +
          'sugestão:** quem mandou áudio ou texto longo continua vindo com "Responder à mão", ' +
          'mesmo engajado.')
    );

    card.append(
      h('div', { class: 'wf-origin' },
        '"Meus" é quem respondeu os dados; "Outros" é a aba de vídeo e "bom dia". Nas duas nada ' +
          'sai da fila sem você decidir.')
    );

    if (!state.hsmTemplates.length) {
      card.append(h('div', { class: 'wf-block' }, 'Nenhum modelo aprovado carregado. Abra um atendimento e clique em Recarregar.'));
    }
    return card;
  }

  /**
   * A mensagem da ocasião (tecla 5).
   *
   * Fica aqui, e não na lista de respostas prontas, porque muda toda semana: hoje é Dia dos
   * Pais, semana que vem é outra coisa. O lugar de editar é onde a rodada começa.
   *
   * Só é gravada no `change` (não a cada tecla): salvar a cada letra brigaria com o foco.
   */
  function renderCartaoMomento(cfg) {
    const card = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Mensagem do momento (tecla 5)'),
      h('div', { class: 'wf-preview' },
        'Para a data do dia — Dia dos Pais, Natal, uma agenda da campanha. Aparece como opção 5 ' +
          'na pergunta da rodada, envia e conclui. Deixe vazio para a tecla 5 não aparecer.'),
    ]);

    const area = h('textarea', { rows: '4', placeholder: 'Ex.: {{saudacao}}! Feliz Dia dos Pais…' });
    area.value = cfg.mensagemMomento || '';
    area.addEventListener('change', () => salvarAuto({ mensagemMomento: area.value }).then(renderAll));
    card.append(area);


    if (cfg.mensagemMomento) {
      card.append(h('div', { class: 'wf-hint' }, 'Variáveis: ' + vars.KNOWN_VARS.map(([v]) => v).join(' ')));
    }

    /**
     * **O pedido que vai JUNTO, para quem já ignorou o formulário uma vez.**
     *
     * Pedido dele (04/09/2026): *"soltou sem contexto nenhum... será a mensagem do momento +
     * notei que estou sem seu nome aqui nos meus contatos e não sei de onde você é"*.
     *
     * Fica neste cartão, e não num próprio, porque ele só existe grudado na mensagem do momento —
     * nunca sai sozinho.
     */
    card.append(
      h('div', { class: 'wf-preview' },
        'Quando o contato JÁ recebeu o formulário e continua sem nome e sem cidade, a tecla 5 ' +
          'manda a mensagem do momento com este pedido no fim — o formulário sozinho, dias ' +
          'depois, chega sem contexto. Deixe vazio para a tecla 5 mandar só a mensagem do momento.')
    );
    const pedido = h('textarea', { rows: '4', placeholder: 'Deixe vazio para não pedir junto' });
    pedido.value = cfg.pedidoJuntoDoMomento || '';
    pedido.addEventListener('change', () => salvarAuto({ pedidoJuntoDoMomento: pedido.value }).then(renderAll));
    card.append(pedido);
    if (cfg.pedidoJuntoDoMomento && !templatesLib.ehPedidoDeDados(cfg.pedidoJuntoDoMomento)) {
      /**
       * **O aviso existe porque o defeito seria calado.** Sem a linha `Nome , Cidade` o texto
       * continua saindo — e a resposta dela deixa de ser reconhecida como resposta ao formulário,
       * então a rodada pede os dados outra vez. Já custou três anotações quando o separador do
       * template mudou.
       */
      card.append(h('div', { class: 'wf-block' },
        'Falta a linha "Nome , Cidade" neste texto. Sem ela a extensão não reconhece a resposta ' +
          'do contato como resposta ao pedido, e vai pedir de novo.'));
    }

    // Mesmo tratamento das respostas prontas: reveza entre variações a cada envio de verdade,
    // para não repetir a mesma frase mandada em massa para quem recebe a mensagem do momento.
    const variantesBtn = h('button', { class: 'wf-btn wf-mini', type: 'button' },
      cfg.mensagemMomentoVariantes?.length ? `Variações (${cfg.mensagemMomentoVariantes.length + 1})` : 'Variações');
    variantesBtn.addEventListener('click', () => abrirEditorDeVariantesDoMomento(state.auto.cfg));
    card.append(h('div', { class: 'wf-row' }, [variantesBtn]));

    return card;
  }

  /**
   * Popup das variações da mensagem do momento — mesmo mecanismo das respostas prontas
   * (`montarListaDeVariantes`), só que salva em `auto.mensagemMomentoVariantes` (via
   * `salvarAuto`) em vez de `templates.save`: a mensagem do momento não mora na lista de
   * respostas, mora na config da rodada, porque muda toda semana.
   */
  /**
   * Onde as caixas flutuantes moram: **fora do `root`**, e essa é a razão de existir.
   *
   * Pedido dele (31/08): *"ao eu mandar o whatsfill ocultar ele oculta o popup da automatização,
   * faça com que fique o popup mesmo ocultando, preciso de espaço na area de trabalho"*.
   *
   * Esconder o painel é `transform: translateX(100%)` no `.wf-root` (classe `wf-collapsed`), e
   * **transform arrasta os filhos**: a caixa da rodada era filha do `root` e deslizava para fora
   * da tela junto. Como irmã dele, dentro do mesmo shadow, ela fica onde está — e o painel sai da
   * frente devolvendo a largura da tela para a conversa.
   *
   * O shadow é o mesmo, então o CSS do painel continua valendo. Sem ele (caso o `root` ainda não
   * esteja anexado), cai no próprio `root`: melhor a caixa aparecer no lugar antigo do que não
   * aparecer.
   */
  function destinoDaCaixa() {
    return root.parentNode || root;
  }
  function abrirEditorDeVariantesDoMomento(cfg) {
    const fundo = h('div', { class: 'wf-pergunta-fundo' });
    const caixa = h('div', { class: 'wf-pergunta' });
    fundo.append(caixa);

    const barra = h('div', { class: 'wf-pergunta-titulo' }, 'Variações — Mensagem do momento');
    caixa.append(barra);
    tornarArrastavel(caixa, barra);

    caixa.append(
      h('div', { class: 'wf-pergunta-linha' },
        'Reveza entre estas e o texto principal a cada envio de verdade. O texto principal se ' +
          'edita no campo de cima, não aqui.')
    );
    caixa.append(h('div', { class: 'wf-pergunta-corpo' }, truncate(cfg.mensagemMomento || '(vazio)', 160)));

    const variantesBox = h('div', {});
    caixa.append(variantesBox);
    const listaDeVariantes = montarListaDeVariantes(variantesBox, cfg.mensagemMomentoVariantes);

    const addVarianteBtn = h('button', { class: 'wf-btn wf-mini', type: 'button' }, '+ Adicionar variação');
    addVarianteBtn.addEventListener('click', () => listaDeVariantes.adicionar());
    caixa.append(addVarianteBtn);

    const linhaBotoes = h('div', { class: 'wf-pergunta-botoes' });
    const salvarBtn = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Salvar');
    const fecharBtn = h('button', { class: 'wf-btn', type: 'button' }, 'Fechar sem salvar');
    linhaBotoes.append(salvarBtn, fecharBtn);
    caixa.append(linhaBotoes);
    caixa.append(h('div', { class: 'wf-pergunta-dica' }, 'Esc fecha sem salvar'));

    function fechar() {
      document.removeEventListener('keydown', aoTeclar, true);
      fundo.remove();
    }
    function aoTeclar(ev) {
      if (ev.key !== 'Escape') return;
      ev.preventDefault();
      fechar();
    }
    document.addEventListener('keydown', aoTeclar, true);

    salvarBtn.addEventListener('click', () =>
      withBusy(async () => {
        const mensagemMomentoVariantes = listaDeVariantes.valores();
        await salvarAuto({ mensagemMomentoVariantes });
        setStatus(
          mensagemMomentoVariantes.length
            ? `Mensagem do momento revezando entre ${mensagemMomentoVariantes.length + 1} variações.`
            : 'Mensagem do momento sem variações — sempre manda o texto principal.',
          'ok'
        );
        fechar();
      })
    );
    fecharBtn.addEventListener('click', fechar);

    destinoDaCaixa().append(fundo);
    aplicarPosicao(caixa, null);
  }

  /** Limite, pausa e o Parar — valem para qualquer rodada. */
  /**
   * **As etiquetas que a rodada APLICA sozinha.**
   *
   * Cartão próprio porque os dois campos decidem o que fica gravado no CRM, e estavam presos dentro
   * de um cartão escondido desde 15/08 (relato dele em 04/09: *"não achei esse campo"*). Regra que
   * depende de configuração precisa da configuração ALCANÇÁVEL — senão ela nasce desligada em quem
   * mais precisa dela, que é a armadilha do `store.get` que este projeto já registrou.
   *
   * As duas listas de etiqueta que a rodada LÊ (pular, só concluir) ficam no cartão da fila, junto
   * do botão que as usa. Estas duas são o contrário: elas ESCREVEM.
   */
  function renderCartaoEtiquetas(cfg) {
    const card = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Etiquetas que a rodada aplica'),
      h('div', { class: 'wf-preview' },
        'Três etiquetas que a rodada grava no contato sozinha. Digite o nome EXATAMENTE como está ' +
          'no CRM — a extensão nunca cria etiqueta. Vazio = não marca ninguém.'),
    ]);

    card.append(
      campoTexto('Etiqueta de SEM INTERESSE (recusou ou hostilizou)', cfg.etiquetaSemInteresse, (v) =>
        salvarAuto({ etiquetaSemInteresse: v.trim() }).then(renderAll)
      ),
      h('div', { class: 'wf-origin' },
        'Quem pede para não receber mais, ou vem hostilizar, é marcado com ela e concluído SEM ' +
          'resposta (tecla "S"). Ela também é LIDA na visita seguinte: sem o campo preenchido, a ' +
          'rodada precisa redescobrir a hostilidade toda vez. A detecção exige sinal forte — ' +
          'xingar o adversário em terceira pessoa NÃO conta, isso é apoiador.'),
      campoTexto('Etiqueta de quem PEDIU DINHEIRO OU EMPREGO', cfg.etiquetaPedidoAjuda, (v) =>
        salvarAuto({ etiquetaPedidoAjuda: v.trim() }).then(renderAll)
      ),
      h('div', { class: 'wf-origin' },
        'Aplicada assim que sai uma das duas respostas que negam — "Pedido de ajuda financeira" ou ' +
          '"Pedido de emprego" —, por qualquer caminho: a rodada, um ramo do quadro, a escolha da ' +
          'IA ou a resposta rápida da caixa. Ex.: "🔴Procura emprego ou dinheiro".'),
      campoTexto('Etiqueta de quem MANDOU ENDEREÇO (material para enviar)', cfg.etiquetaEndereco, (v) =>
        salvarAuto({ etiquetaEndereco: v.trim() }).then(renderAll)
      ),
      h('div', { class: 'wf-origin' },
        'Quem escreve um endereço — rua com número, bairro ou CEP — é marcado com ela e PULADO, ' +
          'com o atendimento deixado aberto para você transferir a conversa ao responsável pelo ' +
          'envio. É a única etiqueta que a rodada aplica ao pular: nos outros casos, pular não ' +
          'grava nada. O endereço sozinho basta porque você só o pede para mandar material.')
    );

    if (!cfg.etiquetaSemInteresse && !cfg.etiquetaPedidoAjuda && !cfg.etiquetaEndereco) {
      card.append(h('div', { class: 'wf-block' }, 'Nenhuma das três está preenchida — a rodada não vai marcar ninguém.'));
    }
    return card;
  }

  function renderCartaoRitmo(cfg) {
    const card = h('div', { class: 'wf-card' }, [h('h4', {}, 'Ritmo')]);
    card.append(
      campoNumero('Quantos envios nesta rodada', cfg.limite, (v) =>
        salvarAuto({ limite: clampInt(v, 1, 200) }).then(renderAll)
      ),
      campoNumero('Pausa entre envios (segundos)', cfg.pausaSeg, (v) =>
        salvarAuto({ pausaSeg: clampInt(v, 3, 300) }).then(renderAll)
      )
    );

    const parar = h('button', { class: 'wf-btn wf-danger', type: 'button' }, 'Parar a rodada');
    parar.disabled = !state.auto.rodando;
    parar.addEventListener('click', () => {
      state.auto.parar = true;
      setStatus('Vou parar assim que o contato atual terminar.');
    });
    card.append(h('div', { class: 'wf-row' }, [parar]));

    if (!state.settings.autoSend) {
      card.append(
        h('div', { class: 'wf-block' },
          'Ligue o "Enviar automático" na aba Config: sem ele nada é enviado de verdade, e ' +
            'concluir depois disso fecharia o atendimento sem a mensagem ter saído.')
      );
    }
    return card;
  }

  /**
   * Rodada 1: a fila dos NOVOS — quem acabou de chegar, quase sempre pelo anúncio.
   *
   * **Ela era um motor à parte, e por isso envelheceu sozinha.** Relato dele (03/09/2026): *"o
   * iniciar conversas não foi atualizado com as regras atuais"*. Estava certo, e a distância era
   * grande: todo o redesenho da chegada — reconhecer de qual anúncio ela veio, mandar o modelo
   * daquele anúncio como recibo, pedir nome e cidade em seguida, responder a pendência que veio
   * depois — foi escrito no caminho de quem já está em "Meus". Aqui continuava o motor antigo:
   * **uma frase única** no lugar do cadastro de anúncios, **o formulário como única mensagem
   * possível**, e o quadro do fluxo **sem voz nenhuma**.
   *
   * O efeito prático era o pior tipo: quem chega pelo anúncio está EXATAMENTE nesta fila, então o
   * ramo "pessoa chegando" que ele montou no quadro quase nunca decidia a chegada de verdade.
   *
   * Hoje a rodada assume o atendimento e **entrega o caso ao mesmo caminho das outras**. Regra que
   * ele mexe no quadro passa a valer aqui no mesmo instante — que é o que "as regras atuais"
   * significa.
   */
  function renderCartaoNovos(cfg) {
    const card = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Novos: começar a conversa'),
      h('div', { class: 'wf-preview' },
        'Percorre a aba "Novos", assume o atendimento (é o que libera o campo de mensagem) e ' +
          'decide pelo MESMO fluxo dos "Meus": reconhece o anúncio, manda o modelo dele, pede o ' +
          'nome e a cidade, responde o que ficou pendente. Assumido, o contato sai da fila mesmo ' +
          'quando o fluxo resolve não mandar nada — ele fica em "Meus" para você ver depois.'),
      h('div', { class: 'wf-origin' },
        'Até a versão 1.77 esta rodada tinha regras próprias, de antes do fluxo: só mandava o ' +
          'pedido de nome e cidade, e só para quem repetisse uma frase exata. Quem chega pelo ' +
          'anúncio está nesta fila, então o ramo "pessoa chegando" do seu quadro quase nunca ' +
          'decidia a chegada de verdade.'),
    ]);

    /**
     * A frase do aceite continua aqui, mas ela **não é mais a porta da rodada**.
     *
     * Quem reconhece o anúncio agora é a Config ("Anúncios do momento") mais o que a plataforma
     * diz sobre a campanha. Esta frase serve a outra coisa: notar quando o contato VOLTA clicando
     * noutro anúncio em vez de responder o que pedimos.
     */
    card.append(
      campoTexto('Frase que identifica o aceite do anúncio', cfg.padraoNovos, (v) =>
        salvarAuto({ padraoNovos: v.trim() }).then(renderAll)
      ),
      h('div', { class: 'wf-hint' },
        'Não é mais o filtro da rodada: serve para reconhecer quem voltou clicando no anúncio de ' +
          'novo. Os anúncios em si ficam na aba Config, em "Anúncios do momento".')
    );

    /**
     * **A caixa que faz a rodada dos Novos andar sozinha** — pedido dele (03/09/2026): *"nos novos
     * as mensagens raramente saem do contexto, faça um botão para mandar mensagem automática nos
     * novos, um box de marcar automático ligado"*.
     *
     * Ele tem razão sobre a chegada: o que sai aqui é o recibo do anúncio e o pedido de nome e
     * cidade, e os dois valem para quase todo mundo que chega. Na fila dos "Meus" não é assim —
     * lá chega desabafo, pedido de ajuda e pergunta de posição —, e por isso esta caixa é
     * **separada** da de lá: uma caixa só o obrigaria a automatizar as duas ou nenhuma.
     *
     * O rótulo diz as DUAS coisas que ela faz, que é a lição da caixa dos "Meus": ela chamava-se
     * "Automatizar com IA" e executava as REGRAS também, com a IA desligada.
     */
    const auto = checkbox(
      'Automático ligado: envia sozinha a escolha das REGRAS e da IA, sem perguntar',
      !!cfg.automaticoNovos,
      async (v) => {
        await salvarAuto({ automaticoNovos: v });
        setStatus(
          v
            ? 'Automático LIGADO nos Novos: o fluxo manda sozinho. Cada envio fica no Andamento.'
            : 'Automático desligado: volto a perguntar contato a contato.',
          v ? 'err' : 'ok'
        );
        renderAll();
      }
    );
    card.append(auto);

    /**
     * **A avaliação por IA, aqui também** — pedido dele (03/09/2026): *"adicione o box de iniciar
     * com IA também"*.
     *
     * É a MESMA chave da aba Config (`ia.ligada`), e não uma segunda: dois interruptores para a
     * mesma coisa é como as duas versões da extensão divergiram, e aqui divergir significaria a
     * rodada gastando dinheiro que a outra tela diz estar desligado.
     *
     * Está aqui porque é aqui que ele decide começar a rodada — e a decisão "usar IA nesta leva"
     * é tomada olhando para o botão de começar, não numa aba de configuração.
     *
     * **Ela e a caixa de cima são coisas diferentes**, e a linha abaixo diz isso: esta liga a IA;
     * a de cima decide se o que a IA (ou a regra) escolher sai sem perguntar.
     */
    const comIA = checkbox(
      'Usar a avaliação por IA nesta rodada (custa por contato avaliado)',
      !!state.ia?.ligada,
      async (v) => {
        await salvarIA({ ligada: v });
        setStatus(
          v
            ? 'Avaliação por IA ligada — vale para todas as rodadas, e custa por contato.'
            : 'Avaliação por IA desligada: só as regras do fluxo decidem.',
          'ok'
        );
        renderAll();
      }
    );
    card.append(comIA);

    card.append(
      h('div', { class: 'wf-origin' },
        'A primeira caixa vale para as regras do fluxo E para a IA — não é uma caixa de IA. A ' +
          'segunda é a MESMA chave da aba Config: ligar aqui liga em todas as rodadas. Só a tecla ' +
          '"Responder à mão" continua parando para você: ela quer dizer, por definição, que ' +
          'alguém precisa escrever. E cidade de palpite não é gravada sozinha — fica esperando ' +
          'você, com a linha no Andamento.')
    );

    // Caixa marcada que não faz nada é a armadilha que este painel já pagou: sem chave, a IA não
    // roda, e a rodada segue só com as regras. Dizer isso aqui é mais barato que ele descobrir
    // pelo silêncio no Andamento.
    if (state.ia?.ligada && !state.iaTemChave) {
      card.append(h('div', { class: 'wf-block' }, 'A IA está ligada mas não há chave salva — cadastre na aba Config, senão ela não avalia nada.'));
    }

    const comecar = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Começar pelos Novos');
    comecar.addEventListener('click', () => withBusy(runLoteNovos));
    card.append(h('div', { class: 'wf-row' }, [comecar]));

    const impedimentos = [];
    if (!state.settings.autoSend) impedimentos.push('Precisa do "Enviar automático" ligado (acima).');
    if (!state.hsmTemplates.length) {
      impedimentos.push('Nenhum modelo aprovado carregado — abra um atendimento e clique em Recarregar.');
    }

    comecar.disabled = state.auto.rodando || impedimentos.length > 0;
    for (const motivo of impedimentos) card.append(h('div', { class: 'wf-block' }, motivo));
    return card;
  }

  /**
   * Rodada 5: reabrir em lote, sem enviar nada. Ver `processarReabrir`.
   *
   * Fica ANTES do cartão de "reabrir e mandar" de propósito: é o caminho novo, e o de baixo
   * continua existindo só para quando ele quiser o fluxo antigo, tudo num contato só.
   */
  function renderCartaoReabrir(cfg) {
    const card = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Sem retorno: só reabrir (em lote)'),
      h('div', { class: 'wf-preview' },
        'Percorre a lista dos CONCLUÍDOS (o ícone de caixa ao lado de "Outros") e clica em ' +
          'Reiniciar em cada um, até o limite acima. **Não manda mensagem nenhuma.** Cada ' +
          'atendimento reaberto sai dos concluídos e passa para "Meus", onde você manda a ' +
          'mensagem e conclui com calma.'),
      h('div', { class: 'wf-origin' },
        'Reabrir tira o atendimento da lista de concluídos de vez — ele não volta ao topo nem ' +
          'é tratado duas vezes, que era o problema de fazer tudo num contato só. Como nada é ' +
          'enviado, esta rodada não precisa de modelo, não depende da janela de 24h e não pode ' +
          'incomodar ninguém: a pausa entre um e outro é a curta, só para não sobrecarregar o ' +
          'servidor.'),
    ]);

    /**
     * **Os campos de ETIQUETA saíram daqui em 04/09/2026** — relato dele: *"não achei esse campo na
     * extensão, na aba Automatizado"*.
     *
     * Este cartão está escondido desde 15/08 (a rodada de "sem retorno", que ele decidiu não usar),
     * e os três campos de etiqueta foram junto **sem que ninguém notasse**: dois deles não têm nada
     * a ver com esta rodada, e as regras que dependem deles — a etiqueta de sem interesse e a de
     * quem pede dinheiro — ficaram **impossíveis de configurar**. Uma delas estava na lista de
     * pendências há dois dias como coisa para ele preencher, num campo que não existia na tela.
     *
     * Foram para `renderCartaoEtiquetas`, que é visível. Aqui fica só o desta fila.
     */
    card.append(
      campoTexto('Etiqueta que marca esta fila (some ao concluir pelo painel)', cfg.etiquetaSemRetorno, (v) =>
        salvarAuto({ etiquetaSemRetorno: v.trim() }).then(renderAll)
      ),
      h('div', { class: 'wf-origin' },
        'Concluir sem tirar esta etiqueta devolve o contato ao topo da lista filtrada por ela — ' +
          'ele vira trabalho de novo amanhã, já tendo sido trabalhado hoje. O Concluir do painel ' +
          'tira sozinho; para quando você conclui pela plataforma, tem o botão na aba Dados. ' +
          'Vazio = não tira nada.')
    );

    const comecar = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Reabrir em lote');
    comecar.addEventListener('click', () => withBusy(runLoteReabrir));
    comecar.disabled = state.auto.rodando;
    card.append(h('div', { class: 'wf-row' }, [comecar]));

    card.append(
      h('p', { class: 'wf-hint' },
        `Vai reabrir até ${clampInt(cfg.limite, 1, 200)} — o mesmo limite do cartão de ritmo, lá em cima.`)
    );

    // A segunda metade do fluxo mora no mesmo cartão de propósito: são um passo só, feitos em
    // dois momentos. Separar em dois cartões distantes é o que faz esquecer o segundo.
    card.append(h('hr', { class: 'wf-sep' }));
    card.append(
      h('h4', {}, 'Depois: trabalhar os reabertos em "Meus"'),
      h('div', { class: 'wf-preview' },
        'Percorre a aba "Meus" FILTRADA pela etiqueta acima e para em cada contato com a ' +
          'pergunta: mandar o modelo, mandar a pergunta de interesse (só se a janela de 24h ' +
          'estiver aberta), pular, concluir ou responder à mão. O que enviar e concluir tira a ' +
          'etiqueta junto; pular a mantém.'),
      h('div', { class: 'wf-origin' },
        'Usa o modelo aprovado escolhido no cartão de baixo. Reabrir NÃO reabre a janela de 24h ' +
          '(ela é regra do WhatsApp, não da plataforma): para quem está calado há dias, só o ' +
          'modelo aprovado chega. A tela diz, contato a contato, de que lado cada um está.')
    );

    const emMeus = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Trabalhar os reabertos em "Meus"');
    emMeus.addEventListener('click', () => withBusy(runLoteEmMeus));
    card.append(h('div', { class: 'wf-row' }, [emMeus]));

    const trava = [];
    if (!modeloDaRodada()) trava.push('Escolha o modelo aprovado no cartão abaixo.');
    if (!state.settings.autoSend) trava.push('Precisa do "Enviar automático" ligado (aba Config).');
    if (!cfg.etiquetaSemRetorno) {
      trava.push('Sem a etiqueta acima, a rodada não sabe quem é sem retorno dentro de "Meus".');
    }
    emMeus.disabled = state.auto.rodando || trava.length > 0;
    for (const motivo of trava) card.append(h('div', { class: 'wf-block' }, motivo));

    return card;
  }

  /**
   * Rodada 2: quem não respondeu. **Um cartão só** — ver o comentário do `runLote`.
   */
  function renderCartaoSemRetorno(cfg, modelo) {
    const card = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Sem retorno: reabrir e perguntar'),
      h('div', { class: 'wf-preview' },
        'Percorre a lista que você filtrou — normalmente a dos CONCLUÍDOS (o ícone de caixa ao ' +
          'lado de "Outros"), com a etiqueta "1 SEM RETORNO". Em cada um: reabre com o Reiniciar ' +
          'se estiver concluído, manda a mensagem e conclui de novo. Reabrir joga o atendimento ' +
          'para "Meus"; a rodada volta sozinha para a lista antes do próximo.'),
    ]);

    if (!state.hsmTemplates.length) {
      const carregar = h('button', { class: 'wf-btn', type: 'button' }, 'Carregar modelos');
      carregar.addEventListener('click', () => withBusy(carregarModelos));
      card.append(
        h('div', { class: 'wf-preview' },
          'Nenhum modelo aprovado carregado. Abra um atendimento da fila (é dele que sai o canal) e clique abaixo.'),
        carregar
      );
      return card;
    }

    const select = h('select', {});
    select.append(h('option', { value: '' }, '(escolha o modelo aprovado)'));
    for (const m of state.hsmTemplates) {
      const rotulo = m.fileType ? `${m.name} · ${String(m.fileType).toLowerCase()}` : m.name;
      select.append(h('option', { value: m.id }, rotulo));
    }
    select.value = cfg.templateId || '';
    select.addEventListener('change', async () => {
      const escolhido = state.hsmTemplates.find((m) => m.id === select.value);
      await salvarAuto({ templateId: select.value, templateName: escolhido?.name || '' });
      renderAll();
    });
    card.append(select);

    if (modelo) {
      card.append(h('div', { class: 'wf-preview' }, modelo.text || '(modelo sem texto)'));
      if (modelo.params?.length) {
        card.append(h('div', { class: 'wf-block' }, `Este modelo ${hsmLib.PARAMS_NAO_APRENDIDOS}`));
      }
    } else if (cfg.templateId) {
      card.append(
        h('div', { class: 'wf-block' },
          `O modelo salvo ("${cfg.templateName || cfg.templateId}") não está na lista deste canal. Escolha de novo.`)
      );
    }

    card.append(
      campoNumero('Não repetir para o mesmo contato por quantas horas', cfg.horasSemRepetir, (v) =>
        salvarAuto({ horasSemRepetir: clampInt(v, 1, 720) }).then(renderAll)
      ),
      h('div', { class: 'wf-origin' },
        'Quem acabou de ser concluído volta para o TOPO desta lista, então a rodada seguinte ' +
          'começaria justo por ele. A rodada olha a conversa (não só o registro de qual modelo ' +
          'já foi): se a última mensagem for nossa e recente, ela pula e diz há quanto tempo.')
    );

    card.append(
      h('div', { class: 'wf-origin' },
        'Todo mundo desta rodada recebe o modelo escolhido acima — é ele e só ele. A maioria ' +
          'desta fila está com a janela de 24h vencida, e aí modelo aprovado é o único envio ' +
          'que chega. Quem por acaso ainda estiver dentro da janela aparece marcado no ' +
          'Andamento: nesses dá para responder à mão, com a resposta pronta "Sem retorno: ainda ' +
          'tem interesse?" da aba Respostas.')
    );

    const comecar = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Começar pelos sem retorno');
    comecar.addEventListener('click', () => withBusy(runLote));

    // A lista de concluídos é o único gancho de fila sem `data-cy` conhecido. A rodada tenta
    // descobrir sozinha (clicando e conferindo); este botão é o caminho para o conserto
    // definitivo quando nem isso resolver.
    const achar = h('button', { class: 'wf-btn', type: 'button' }, 'Achar a lista de concluídos');
    const caixaDiagnostico = h('div', { class: 'wf-mono' }, '');
    achar.addEventListener('click', () =>
      withBusy(async () => {
        const d = await page.diagnosticarAbas();
        caixaDiagnostico.textContent = [
          d.achou ? '✓ Achei um candidato direto.' : '× Nenhum candidato direto — a rodada vai tentar por eliminação.',
          `data-cy na barra: ${d.dataCy.join(', ') || '(nenhum)'}`,
          `ícones: ${d.icones.join(', ') || '(nenhum)'}`,
          `rótulos: ${d.rotulos.join(' | ') || '(nenhum)'}`,
        ].join('\n');
        setStatus('Me mande o texto que apareceu no cartão.', 'ok');
      })
    );
    card.append(h('div', { class: 'wf-row' }, [comecar, achar]), caixaDiagnostico);

    // Cada impedimento é um jeito conhecido de a rodada sair errada — melhor travar o botão e
    // dizer o porquê do que descobrir no meio de trinta envios.
    const impedimentos = [];
    if (!modelo) impedimentos.push('Escolha o modelo aprovado da rodada.');
    if (modelo?.params?.length) {
      impedimentos.push('O modelo escolhido pede parâmetro, e a tela de parâmetros ainda não foi aprendida.');
    }
    if (!state.settings.autoSend) impedimentos.push('Precisa do "Enviar automático" ligado (acima).');

    comecar.disabled = state.auto.rodando || impedimentos.length > 0;
    for (const motivo of impedimentos) card.append(h('div', { class: 'wf-block' }, motivo));
    return card;
  }

  /** Retrato da fila para você conferir antes de disparar. Nenhum envio depende deste texto. */
  /**
   * Quantos atendimentos abertos estão com você de verdade.
   *
   * **Existe porque a plataforma não mostra esse número.** Ela pede a lista com
   * `skipCount=true`, que diz à API para não contar — o badge ao lado de "Meus" é outra coisa.
   * Medido lado a lado em 30/08/2026: badge **76**, total real **353**.
   *
   * A contagem nasce do CLIQUE, nunca do desenho: `renderAll()` roda o tempo todo (troca de
   * atendimento, mensagem nova, cada `setStatus`), e rede disparada de dentro de um `render*`
   * vira uma requisição por redesenho. Falha vira botão de tentar de novo com o motivo na tela,
   * nunca nova tentativa automática.
   */
  /** A janelinha do contador, enquanto estiver aberta. Fora do `state` porque não é desenho. */
  let contadorFlutuante = null;

  /**
   * Janelinha arrastável com o total de "Meus" abertos, para acompanhar o progresso trabalhando.
   *
   * **Por que flutuante e não dentro da aba:** o número dentro do painel só é visto quando você
   * está na aba Automatizado, e o trabalho acontece na conversa. Ele pediu para acompanhar o
   * progresso enquanto atende — um número que exige trocar de aba para consultar não acompanha
   * nada.
   *
   * Segue as regras da caixa da rodada, e não é coincidência: a camada é `pointer-events: none`
   * e sem fundo, então **a conversa continua legível e clicável por baixo**; a caixa é arrastada
   * pelo título e a posição fica no `settings` (chave própria, senão ela e a pergunta da rodada
   * disputariam o mesmo canto). Ver `tools/checar-pergunta.mjs`.
   *
   * **O progresso é a diferença, não o total.** Guardo quanto havia quando você abriu e mostro
   * quantos saíram desde então — é isso que responde "estou andando?". O total sozinho sobe
   * quando chega gente nova e daria a impressão de que você andou para trás.
   *
   * A atualização automática é de 60s de propósito. Nesta API rajada de requisição já derrubou a
   * plataforma, e um contador não vale um pedido por segundo. O botão atualiza na hora quando
   * você quiser.
   */
  const CONTADOR_INTERVALO_MS = 45000;

  /** Espera antes de recontar depois de trocar de atendimento. */
  const CONTADOR_ESPERA_MS = 2500;

  let contadorTimer = null;

  /**
   * Pede uma recontagem, juntando as que chegarem coladas.
   *
   * Passar a fila rápido dispara uma troca de atendimento por clique. Sem juntar, isso vira uma
   * requisição por clique numa API que já caiu por rajada — e o número nem teria mudado ainda,
   * porque a plataforma leva um instante para registrar a conclusão.
   */
  /**
   * Concluir pelo painel — e recontar logo depois.
   *
   * Pedido dele: *"o gatilho deve ser quando manda concluir e atualizar"*. Os gatilhos de tela
   * (trocou de atendimento, o campo de mensagem sumiu) cobrem quem conclui PELA PLATAFORMA;
   * este cobre o caminho do painel, que é o que ele usa nas rodadas e nos botões.
   *
   * Só reconta quando a conclusão deu certo: contar depois de um Concluir que falhou traria o
   * mesmo número e daria a impressão de que o contador é que está quebrado.
   */
  /**
   * Concluir pelo painel.
   *
   * Quando a plataforma abre uma **confirmação** ("tem certeza?"), a página confirma sozinha —
   * a conclusão foi pedida por ele dois cliques atrás, e parar ali travava a rodada em todo
   * contato (print de 01/09). Mas o que foi aceito em nome dele **vai para o log**: este diálogo
   * avisa que mensagens pendentes serão canceladas, e aceitar isso em silêncio seria decidir por
   * ele sem contar.
   *
   * Uma vez por rodada basta: o texto é o mesmo em todo contato, e repeti-lo cem vezes afogaria o
   * resto do log — que é onde ele procura o que deu errado.
   */
  async function concluirPeloPainel() {
    const r = await page.clickConcluir();
    if (r?.ok) agendarContagem();

    if (r?.avisoDaConfirmacao && !state.auto.avisouConfirmacao) {
      state.auto.avisouConfirmacao = true;
      registrarNaRodada('plataforma', 'aviso',
        `confirmei o diálogo de conclusão em seu nome: "${r.avisoDaConfirmacao}"`);
    }
    return r;
  }

  function agendarContagem() {
    if (!contadorFlutuante) return;
    if (contadorTimer) clearTimeout(contadorTimer);
    contadorTimer = setTimeout(() => {
      contadorTimer = null;
      contadorFlutuante?.medir();
    }, CONTADOR_ESPERA_MS);
  }

  async function abrirContadorFlutuante() {
    if (contadorFlutuante) return; // uma só: duas janelinhas contando dão dois números

    const caixa = h('div', { class: 'wf-pergunta wf-contador' });
    const fundo = h('div', { class: 'wf-pergunta-fundo' }, [caixa]);
    const barra = h('div', { class: 'wf-pergunta-titulo' }, 'Meus abertos');
    caixa.append(barra);

    const numero = h('div', { class: 'wf-contador-numero' }, '…');
    // Barra: enche conforme os atendimentos saem. O denominador é quanto havia quando você
    // abriu — é o "dia de trabalho" que ela mede, não a fila inteira do CRM.
    const trilho = h('div', { class: 'wf-contador-trilho' });
    const preenchida = h('div', { class: 'wf-contador-barra' });
    trilho.append(preenchida);

    const progresso = h('div', { class: 'wf-pergunta-linha' }, 'contando…');
    const carimbo = h('div', { class: 'wf-pergunta-dica' }, '');
    caixa.append(numero, trilho, progresso, carimbo);

    const linhaBotoes = h('div', { class: 'wf-pergunta-botoes' });
    const atualizar = h('button', { class: 'wf-btn', type: 'button' }, 'Atualizar');
    const fechar = h('button', { class: 'wf-btn', type: 'button' }, 'Fechar');
    linhaBotoes.append(atualizar, fechar);
    caixa.append(linhaBotoes);

    let timer = null;

    async function medir() {
      try {
        const { abertos, concluidosHoje } = await api.contarMeuDia();
        const total = abertos;
        state.auto.meusAbertos = { total, erro: '', quando: Date.now() };

        // O DESTAQUE é o que ele fez, não o que sobrou. "Abertos" sobe quando chega gente nova,
        // então usá-lo como medida de progresso mostra o número crescendo num dia de trabalho
        // bom — foi o relato dele, "continua sem diminuir". Concluídos hoje só sobe, e sobe por
        // causa dele.
        numero.textContent = concluidosHoje + ' concluídos hoje';
        const feitos = concluidosHoje;

        // A barra é a fatia do dia que já saiu da sua mão: concluídos sobre tudo que passou por
        // ela hoje. Com teto e piso, porque um denominador zero (dia recém-começado) e um total
        // que oscila fariam a barra saltar ou ficar negativa.
        const doDia = feitos + total;
        const fatia = doDia > 0 ? Math.min(100, Math.max(0, (feitos / doDia) * 100)) : 0;
        preenchida.style.width = fatia + '%';
        trilho.title = feitos + ' de ' + doDia + ' que passaram pela sua mão hoje';
        progresso.textContent = total + ' ainda abertos em "Meus"';
        carimbo.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR')} — sozinho a cada atendimento.`;
      } catch (err) {
        // Erro não fecha a janelinha nem apaga o último número bom: some com o dado justamente
        // quando a rede está ruim, que é quando você mais quer saber onde estava.
        carimbo.textContent = `Falhou às ${new Date().toLocaleTimeString('pt-BR')}: ${traduzirErroDeRede(err.message)}`;
      }
    }

    function encerrar() {
      if (timer) clearInterval(timer);
      if (contadorTimer) clearTimeout(contadorTimer);
      timer = null;
      contadorTimer = null;
      fundo.remove();
      contadorFlutuante = null;
      renderAll();
    }

    atualizar.addEventListener('click', () => medir());
    fechar.addEventListener('click', encerrar);

    contadorFlutuante = { encerrar, medir };
    tornarArrastavel(caixa, barra, 'contadorPos');
    destinoDaCaixa().append(fundo);
    aplicarPosicao(caixa, state.settings.contadorPos);

    await medir();
    timer = setInterval(medir, CONTADOR_INTERVALO_MS);
    renderAll();
  }

  function renderCartaoMeusAbertos() {
    const estado = state.auto.meusAbertos;
    const card = h('div', { class: 'wf-card' }, [h('h4', {}, 'Meus atendimentos abertos')]);

    const botao = h('button', { class: 'wf-btn', type: 'button' },
      estado.total === null ? 'Contar' : 'Contar de novo');
    botao.disabled = state.auto.rodando;
    botao.addEventListener('click', () =>
      withBusy(async () => {
        try {
          const { total } = await api.contarMeusAbertos();
          state.auto.meusAbertos = { total, erro: '', quando: Date.now() };
          setStatus(`Você tem ${total} atendimento(s) aberto(s) em "Meus".`);
        } catch (err) {
          state.auto.meusAbertos = { total: null, erro: traduzirErroDeRede(err.message), quando: 0 };
          setStatus('Não consegui contar os seus atendimentos.', 'err');
        }
        renderAll();
      })
    );

    card.append(
      h('div', { class: 'wf-preview' },
        'O número ao lado de "Meus" na plataforma não é o total: ela pede a lista sem mandar ' +
          'contar. Este aqui é o total de verdade, em andamento e atribuídos a você.'),
      botao
    );

    // Para acompanhar enquanto atende: o número dentro da aba só aparece quando você está NELA,
    // e o trabalho acontece na conversa.
    const flutuar = h('button', { class: 'wf-btn wf-primary', type: 'button' },
      contadorFlutuante ? 'Fechar a janelinha' : 'Acompanhar em janelinha');
    flutuar.addEventListener('click', () =>
      contadorFlutuante ? contadorFlutuante.encerrar() : abrirContadorFlutuante()
    );
    card.append(flutuar);
    card.append(
      h('p', { class: 'wf-hint' },
        'A janelinha fica por cima da plataforma, arrasta pelo título e mostra quantos saíram ' +
          'desde que você a abriu. Ela não bloqueia a conversa.')
    );

    if (estado.total !== null) {
      card.append(h('p', { class: 'wf-h' }, `${estado.total} aberto(s) em "Meus"`));
      card.append(
        h('p', { class: 'wf-hint' },
          `Contado às ${new Date(estado.quando).toLocaleTimeString('pt-BR')}. A fila da esquerda ` +
            'carrega 50 por vez, então ela quase nunca mostra tudo.')
      );
    }
    if (estado.erro) card.append(h('div', { class: 'wf-block' }, estado.erro));

    return card;
  }

  function renderCartaoFila() {
    const card = h('div', { class: 'wf-card' }, [h('h4', {}, 'Quem vai receber')]);
    const ver = h('button', { class: 'wf-btn', type: 'button' }, 'Ver a fila');
    ver.addEventListener('click', () =>
      withBusy(async () => {
        state.auto.fila = await page.queuePreview();
        setStatus(`${state.auto.fila.length} atendimento(s) carregado(s) na fila.`);
      })
    );

    card.append(
      h('div', { class: 'wf-preview' },
        'O WhatsFill não escolhe quem entra: quem manda é o filtro que você aplicou na ' +
          'plataforma (ex.: a etiqueta "1 SEM RETORNO"). Confira a lista antes de disparar.'),
      ver
    );

    if (state.auto.fila.length) {
      card.append(
        h('p', { class: 'wf-hint' },
          `${state.auto.fila.length} na fila carregada. A rodada só enxerga o que já está ` +
            'carregado — use o "Ver mais" da plataforma para trazer o resto.')
      );
      for (const item of state.auto.fila.slice(0, 6)) {
        card.append(h('div', { class: 'wf-preview' }, item.texto));
      }
      if (state.auto.fila.length > 6) {
        card.append(h('p', { class: 'wf-hint' }, `… e mais ${state.auto.fila.length - 6}.`));
      }
    }
    return card;
  }

  /**
   * O sinal de cada linha do log.
   *
   * `refinar` é resultado PRÓPRIO e não 'pulado' de propósito: as linhas da lista de casos sem
   * regra entram depois de o resumo estar montado, e reusar um resultado que o resumo conta
   * deixaria uma bomba armada para quem mover a ordem dessas duas coisas um dia.
   */
  const SINAL_RODADA = { enviado: '✓', concluido: '▪', pulado: '–', triado: '→', reiniciado: '↻', erro: '×', fim: '■', aviso: '⚠', refinar: '?', info: '·' };

  /** Resultados em que o contato deixa a lista: a posição não pode avançar junto. */
  const SAI_DA_FILA = new Set(['triado', 'concluido', 'reiniciado']);

  /**
   * Resultados que contam para o limite da rodada.
   *
   * Era só 'enviado', e por isso a rodada de **só reiniciar** rodaria até a fila acabar — o
   * limite que ele digita ("reiniciar determinado número de conversas") nunca seria atingido,
   * porque nela nada é enviado.
   */
  const CONTA_NO_LIMITE = new Set(['enviado', 'reiniciado']);
  let logNode = null;

  /** Só o log é redesenhado durante a rodada: renderAll roubaria o foco dos campos. */
  function renderAutoLog() {
    if (!logNode || !logNode.isConnected) return;
    logNode.replaceChildren();
    if (!state.auto.log.length) {
      logNode.append(h('p', { class: 'wf-hint' }, 'Nenhuma rodada ainda nesta sessão do painel.'));
      return;
    }
    for (const linha of state.auto.log) {
      const sinal = SINAL_RODADA[linha.resultado] || '·';
      logNode.append(
        h('div', { class: 'wf-preview' }, `${sinal} ${linha.nome}${linha.motivo ? ` — ${linha.motivo}` : ''}`)
      );
    }
  }

  function registrarNaRodada(nome, resultado, motivo) {
    state.auto.log.push({ nome, resultado, motivo });
    renderAutoLog();
  }

  function modeloDaRodada() {
    return state.hsmTemplates.find((m) => m.id === state.auto.cfg.templateId) || null;
  }

  async function carregarModelos() {
    state.hsmTemplates = await hsmLib.list({ channelId: state.session?.channelId, force: true });
    setStatus(
      state.hsmTemplates.length
        ? `${state.hsmTemplates.length} modelo(s) aprovado(s) carregado(s).`
        : 'A plataforma não devolveu nenhum modelo aprovado.',
      state.hsmTemplates.length ? 'ok' : 'err'
    );
  }

  /** Relê antes de gravar: a Config mexe na mesma chave por outro caminho. */
  async function salvarAuto(mudanca) {
    const atual = await store.get('auto');
    state.auto.cfg = { ...atual, ...mudanca };
    await store.set('auto', state.auto.cfg);
  }

  /**
   * O percurso da fila, que as duas rodadas compartilham.
   *
   * É por POSIÇÃO, não pelo topo: dependendo do filtro (e da aba), o atendimento tratado
   * continua ou não na lista. A regra que funciona nos dois casos é comparar o id da sessão que
   * abriu com os já visitados — repetiu, a rodada anda uma casa; veio outro, a posição continua
   * valendo. Quem foi pulado também fica onde está, então ali a posição avança sozinha.
   *
   * @param {object} opts
   * @param {string|null} opts.aba aba da fila a garantir antes de cada item ("Novos")
   * @param {function} opts.processar recebe (sessionId, { contatosTratados }) e devolve
   *   { nome, resultado: 'enviado'|'triado'|'pulado'|'erro', motivo?, parar? }
   *
   *   'triado' = assumido sem enviar nada, só para sair da fila. Sai da lista, então a posição
   *   NÃO avança; 'pulado' continua na lista e a posição avança.
   */
  /** Respiro entre contatos pulados. Curto: aqui o risco é o servidor, não o WhatsApp. */
  const PAUSA_PULO_MS = 1500;

  /** Teto de "Ver mais" por rodada. ~50 itens por clique: 20 cliques cobrem mil contatos. */
  const MAX_CARREGAMENTOS = 20;

  /**
   * A aba ficou parada. A pergunta que importa não é "congelou?", é **"a plataforma
   * sobreviveu?"** — e essa dá para responder com uma leitura barata em vez de supor.
   *
   * Antes isto abortava a rodada sempre, com base num incidente que depois foi re-diagnosticado
   * como limite de requisições, não congelamento. Abortar 185 contatos por um engasgo de 48s é
   * caro demais para uma suposição.
   */
  async function lidarComCongelamento(pedidoMs, gastoMs) {
    const segundos = Math.round(gastoMs / 1000);
    const audio = keepalive.ativo() ? 'áudio de keepalive ativo' : 'ÁUDIO DE KEEPALIVE PARADO';

    let viva = false;
    try {
      await api.getCustomFields(); // leitura barata, mesmo caminho de rede dos envios
      viva = true;
    } catch (_) {
      viva = false;
    }

    if (viva) {
      registrarNaRodada(
        'aba',
        'pulado',
        `o navegador segurou a aba por ${segundos}s (${audio}), mas a plataforma respondeu — sigo`
      );
      return { parar: false };
    }

    return {
      parar: true,
      motivo:
        `O navegador congelou esta aba (a pausa de ${Math.round(pedidoMs / 1000)}s levou ` +
        `${segundos}s, ${audio}) e a plataforma parou de responder. Dê F5 na aba antes de continuar.`,
    };
  }

  /**
   * "Failed to fetch" não é erro HTTP: é o navegador dizendo que a requisição nem completou —
   * tipicamente o preflight CORS recusado, que é o que um limitador de taxa devolve. Traduzir
   * importa porque a ação é outra: não adianta repetir na hora, tem que esperar.
   */
  function traduzirErroDeRede(mensagem) {
    if (!/failed to fetch|networkerror|load failed/i.test(String(mensagem || ''))) return mensagem;
    return (
      'a API parou de responder (provável limite de requisições do servidor). ' +
      'Espere alguns minutos, dê F5 e recomece com uma pausa maior.'
    );
  }

  /**
   * Espera a tela ficar sem diálogo aberto, para o próximo clique na fila valer.
   *
   * Não fecha nada por conta própria: o diálogo aberto no meio de uma rodada costuma ser o seu
   * (anexo de figura, preview de mídia), e fechar seria descartar o que você estava mandando.
   */
  async function esperarTelaLivre(timeoutMs = 3 * 60 * 1000) {
    const limite = Date.now() + timeoutMs;
    let avisou = false;

    while (Date.now() < limite) {
      if (state.auto.parar) return { ok: false, motivo: 'você parou a rodada' };
      const estado = await page.getState();
      if (!estado.hasDialog) return { ok: true };
      if (!avisou) {
        avisou = true;
        setStatus('Tem um diálogo aberto na plataforma. Termino o que você está fazendo e sigo.');
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return {
      ok: false,
      motivo: 'a plataforma ficou com um diálogo aberto por 3 min — feche o diálogo e recomece a rodada',
    };
  }

  async function percorrerFila({ aba = null, limite, pausaMs, processar }) {
    const visitados = new Set();
    /**
     * Os CONTATOS já tratados nesta rodada — a trava que o id da sessão não dá.
     *
     * `visitados` guarda id de SESSÃO, e na rodada dos concluídos a sessão não é estável: o
     * Reiniciar reabre o atendimento e o Concluir fecha de novo, e o item volta para a lista.
     * Se a plataforma devolver esse atendimento com outro id — ou se a mesma pessoa tiver dois
     * atendimentos na lista —, o id não repete e a rodada manda a mensagem **de novo para a
     * mesma pessoa**. Contato é a identidade que importa aqui: é quem recebe o WhatsApp.
     *
     * O registro anti-duplicata (`sentLog`) cobre o caso entre rodadas, mas depende de estar
     * ligado e é por contato+modelo. Esta trava vale dentro da rodada e não tem exceção.
     */
    const contatosTratados = new Set();
    let posicao = 0;
    let enviados = 0;
    let carregamentos = 0;
    let interrompida = '';
    // Quantos itens a lista tinha da última vez que olhamos. Serve para o veredito saber se a
    // rodada percorreu a fila inteira ou parou no meio dela — ver o `restaram` lá embaixo.
    let totalDaLista = 0;

    while (enviados < limite && !state.auto.parar) {
      // Diálogo do Material é MODAL: com ele aberto, o clique no item da fila não chega ao item
      // e a rodada terminava dizendo "a fila acabou". Acontecia toda vez que você anexava uma
      // figura no meio da resposta à mão. Esperar é melhor que fechar — o diálogo é seu.
      const livre = await esperarTelaLivre();
      if (!livre.ok) {
        interrompida = livre.motivo;
        break;
      }

      let aberto = await page.openQueueSession(posicao, { aba });

      // A fila mostra 50 por vez e só traz o resto no "Ver mais". Acabar o carregado não é
      // acabar a fila: pede a próxima página e tenta a MESMA posição de novo.
      //
      // Não vale quando a falha foi de ABA: aí a lista na tela é outra, e clicar em "Ver mais"
      // seria paginar a fila errada.
      if (!aberto.ok && !aberto.avisoAba && carregamentos < MAX_CARREGAMENTOS) {
        const mais = await page.carregarMaisDaFila();
        if (mais.ok) {
          carregamentos++;
          registrarNaRodada('fila', 'pulado', `carreguei mais da fila (${mais.antes} → ${mais.agora} itens)`);
          const respiro = await pausarRodada(Math.min(pausaMs, PAUSA_PULO_MS));
          if (respiro.congelou) {
            const gelo = await lidarComCongelamento(PAUSA_PULO_MS, respiro.gasto);
            if (gelo.parar) {
              interrompida = gelo.motivo;
              break;
            }
          }
          continue;
        }
        aberto = { ...aberto, reason: `${aberto.reason} ${mais.reason}.` };
      }

      if (!aberto.ok) {
        interrompida = aberto.reason;
        break;
      }
      // Aba pedida não encontrada: parar. Seguir seria percorrer a fila errada.
      if (aberto.avisoAba) {
        interrompida = aberto.avisoAba;
        break;
      }
      if (!aberto.sessionId) {
        interrompida = 'Nenhum atendimento abriu — a fila pode ter recarregado.';
        break;
      }
      if (aberto.total) totalDaLista = aberto.total;
      if (visitados.has(aberto.sessionId)) {
        // Cai aqui quando o item não saiu da fila como esperado (assumir falhou, por exemplo).
        // Sem respiro isto vira rajada de aberturas, que é o que derruba a API.
        posicao++;
        const respiro = await pausarRodada(Math.min(pausaMs, PAUSA_PULO_MS));
        if (respiro.congelou) {
          const gelo = await lidarComCongelamento(PAUSA_PULO_MS, respiro.gasto);
          if (gelo.parar) {
            interrompida = gelo.motivo;
            break;
          }
        }
        continue;
      }
      visitados.add(aberto.sessionId);

      const r = await processar(aberto.sessionId, { contatosTratados });
      registrarNaRodada(r.nome, r.resultado, r.motivo);

      if (r.resultado === 'erro') {
        interrompida = `Parei em ${r.nome}: ${r.motivo}`;
        break;
      }

      const contou = CONTA_NO_LIMITE.has(r.resultado);
      if (contou) enviados++;
      // Só envio de verdade conta para o intervalo do WhatsApp: reabrir não manda mensagem.
      if (r.resultado === 'enviado') state.lastSendAt = Date.now();

      // `parar` vale para qualquer resultado, não só para envio: o Esc da pergunta e o diálogo
      // de motivo de conclusão podem cair em qualquer um deles.
      if (r.parar) {
        interrompida = r.motivo;
        break;
      }

      /**
       * Andar uma casa ou não é a única decisão de posição que existe aqui, e ela tem uma
       * pergunta só: **o contato continua na lista depois de tratado?**
       *
       * - saiu (assumido, concluído, reaberto): o próximo escorrega para esta mesma posição;
       * - continua (pulado, ou concluído que volta ao TOPO dos concluídos): precisa andar,
       *   senão a rodada reabre o mesmo — `visitados` protege, mas ao custo de uma abertura
       *   extra por contato, e abertura é o que derruba a API.
       */
      /**
       * `saiuDaFila` é o que a rodada dos Novos precisa dizer: lá o contato é ASSUMIDO antes de
       * qualquer decisão, então ele sai da lista mesmo quando o fluxo resolve não mandar nada.
       * Sem isso, um `pulado` faria a posição andar em cima de uma lista que já encurtou — e o
       * contato que escorregou para o lugar deste nunca seria aberto, em silêncio.
       */
      const saiuDaLista =
        r.saiuDaFila === true || SAI_DA_FILA.has(r.resultado) || (contou && !r.continuaNaFila);
      if (!saiuDaLista) posicao++;

      if (enviados >= limite || state.auto.parar) continue;

      /**
       * A pausa longa protege o NÚMERO no WhatsApp; a curta protege o SERVIDOR.
       *
       * Só quem manda mensagem precisa da longa. Pulo e reabertura não mandam nada — mas custam
       * à API o mesmo que um envio (abrem a sessão na plataforma e fazem três chamadas nossas),
       * e vinte seguidos sem respiro já derrubaram a API e a plataforma junto.
       */
      const enviou = r.resultado === 'enviado';
      const ms = enviou ? pausaMs : Math.min(pausaMs, PAUSA_PULO_MS);
      if (contou) setStatus(`${enviados}/${limite}. Pausa de ${ms / 1000}s…`);

      const pausa = await pausarRodada(ms);
      if (pausa.congelou) {
        const gelo = await lidarComCongelamento(ms, pausa.gasto);
        if (gelo.parar) {
          interrompida = gelo.motivo;
          break;
        }
      }
    }

    /**
     * Contato da lista que a rodada nunca chegou a abrir.
     *
     * A posição anda supondo que o item tratado sai da fila ou volta para o TOPO — que é o que a
     * plataforma faz, e foi simulado. Se ela reordenar de outro jeito, `visitados` impede
     * repetir o mesmo contato, mas alguém pode ficar para trás **em silêncio**, com a rodada
     * dizendo "a fila acabou". Contar é barato e transforma isso numa linha em vez de um sumiço.
     */
    const restaram = Math.max(0, totalDaLista - visitados.size);
    return { enviados, interrompida, visitados: visitados.size, restaram };
  }

  /** Abre a rodada, roda o percurso e fecha o status. Comum às duas. */
  /**
   * **Esta rodada decide sozinha?**
   *
   * Duas caixas respondem que sim, e são de filas diferentes: "Automatizar" (os "Meus") e
   * "Automático ligado" (os "Novos"). Uma função só porque três lugares perguntam isso — a
   * execução da tecla, a da IA e a pergunta da cidade —, e três leituras separadas divergiriam na
   * primeira caixa nova.
   */
  function rodadaAutomatica() {
    return !!state.auto.cfg.automatizarComIA || !!state.auto.automatico;
  }

  async function rodar({ aba, processar, automatico = false }) {
    const limite = clampInt(state.auto.cfg.limite, 1, 200);
    const pausaMs = clampInt(state.auto.cfg.pausaSeg, 3, 300) * 1000;

    state.auto.automatico = !!automatico;
    state.auto.rodando = true;
    state.auto.parar = false;
    state.auto.log = [];
    state.auto.semRegra = new Map();
    state.auto.avisouConfirmacao = false;
    renderAll();

    // Aba escondida é aba CONGELADA — timer nenhum roda, nem o da plataforma. Sem isto, a
    // rodada morre no primeiro contato assim que você minimiza ou troca de aba.
    const acordada = await keepalive.ligar();
    if (!acordada.ok) {
      registrarNaRodada('rodada', 'pulado', `${acordada.motivo}. Deixe esta aba visível.`);
    }
    // A trava de modo de espera falha em separado do áudio (permissão "power" ausente, por
    // exemplo). Sem aviso, a rodada morreria no meio da madrugada sem explicação.
    if (acordada.energia && !acordada.energia.ok) {
      registrarNaRodada(
        'rodada',
        'pulado',
        `Não consegui impedir o computador de suspender (${acordada.energia.motivo}). ` +
          'Se a máquina dormir, a rodada para no meio.'
      );
    }

    let resultado = { enviados: 0, interrompida: '', visitados: 0, restaram: 0 };
    let aindaTocando = false;
    try {
      resultado = await percorrerFila({ aba, limite, pausaMs, processar });
    } finally {
      // Antes de desligar: se o áudio subiu mas o navegador o pausou no caminho, isso é o dado
      // que distingue "o remédio não foi aplicado" de "o remédio não funciona".
      aindaTocando = keepalive.ativo();
      keepalive.desligar();
      state.auto.rodando = false;
      // Zerado aqui e não onde foi ligado: o `automatico` vale para a rodada, e uma rodada que
      // termina por erro deixaria a próxima andando sozinha sem ninguém ter marcado nada.
      state.auto.automatico = false;
    }

    const conta = (tipo) => state.auto.log.filter((l) => l.resultado === tipo).length;
    const triados = conta('triado');
    const concluidos = conta('concluido');
    const reabertos = conta('reiniciado');
    /**
     * Quantos a rodada NÃO soube recomendar.
     *
     * É a medida que ele pediu sem pedir: *"terá que reconhecer isso pela falta de opções"*.
     * Cada um destes é um contato que o determinístico não resolveu — a conta encolhendo,
     * rodada após rodada, é o refinamento das regras funcionando, e ela diz quando vale a pena
     * ligar a IA (que custa por contato avaliado).
     *
     * Sai da própria rodada, sem etiqueta nenhuma no CRM: rótulo novo na base para dizer o que
     * o painel já sabe seria trabalho a mais para a mesma informação.
     */
    const semRegra = state.auto.semRegra.size;
    const resumo =
      `Rodada encerrada: ${conta('enviado')} enviado(s), ${conta('pulado')} pulado(s)` +
      (reabertos ? `, ${reabertos} reaberto(s) em "Meus"` : '') +
      (concluidos ? `, ${concluidos} concluído(s) sem enviar` : '') +
      (triados ? `, ${triados} assumido(s) para triagem em "Meus"` : '') +
      (semRegra ? `, ${semRegra} que nenhuma regra reconheceu` : '') + '.';

    // Alguém da lista ficou para trás sem ninguém abrir. Não é o caso normal — a posição
    // acompanha a reordenação da plataforma —, mas quando acontece tem que aparecer, senão o
    // contato some do trabalho com a rodada dizendo que terminou.
    const sobra = resultado.restaram
      ? ` Atenção: percorri ${resultado.visitados} de ${resultado.visitados + resultado.restaram} da lista — ` +
        `${resultado.restaram} não chegaram a ser abertos. Rode de novo para pegar o resto.`
      : '';

    // Sem `interrompida` só há duas saídas possíveis do laço, e as duas merecem ser ditas:
    // ninguém deveria ter que adivinhar se a rodada acabou ou desistiu.
    const motivo =
      resultado.interrompida ||
      (state.auto.parar ? 'Parada por você.' : `Limite de ${limite} atingido.`);

    // Estado do keepalive no veredito, não só no topo do log: numa rodada longa a linha de
    // início fica fora da vista, e é justamente ela que explica um congelamento.
    const audio = !acordada.ok
      ? `Áudio de keepalive NÃO subiu (${acordada.motivo}).`
      : aindaTocando
        ? 'Áudio de keepalive esteve ativo do começo ao fim.'
        : 'Áudio de keepalive subiu mas foi interrompido no caminho.';

    // O log ANTES do status: `refresh()` logo abaixo carrega o contato aberto e sobrescreve a
    // barra de status, então o veredito da rodada só sobrevive aqui. Era por isso que a rodada
    // parecia parar sem explicação.
    /**
     * Os casos que nenhuma regra reconheceu, listados no fim para serem lidos JUNTOS.
     *
     * Separados no meio do log eles são vinte linhas perdidas entre cem; juntos, o padrão
     * aparece — e o padrão é a próxima regra a escrever. É o instrumento do plano dele:
     * refinar até sobrar pouca indecisão, e só então ligar a IA para o que sobrou.
     */
    if (state.auto.semRegra.size) {
      registrarNaRodada('— a refinar —', 'refinar',
        `${state.auto.semRegra.size} caso(s) que nenhuma regra reconheceu. Vários iguais = uma regra nova:`);
      for (const caso of state.auto.semRegra.values()) {
        const oQue = caso.texto ? `"${caso.texto}"` : `(${caso.tipo || 'sem texto'})`;
        registrarNaRodada(caso.nome, 'refinar', `última mensagem: ${oQue}`);
      }
    }

    registrarNaRodada('rodada', 'fim', `${resumo}${sobra} ${motivo} ${audio}`);

    setStatus(`${resumo}${sobra} ${motivo}`, resultado.interrompida || sobra ? 'err' : 'ok');

    // A rodada trocou de atendimento várias vezes com o observador desligado: resincroniza o
    // painel com o que ficou aberto na tela.
    await refresh();
  }

  /**
   * Rodada 2: quem não respondeu — **uma rodada só**, não duas.
   *
   * Havia dois cartões para isto: um para a fila aberta e outro para os concluídos. Ele
   * apontou o óbvio que eu não tinha visto: *"os sem retorno sempre estão nos concluídos, só
   * preciso de um e não dois"*. O fluxo dele conclui todo atendimento, então a fila aberta de
   * sem retorno nunca tem ninguém — o primeiro cartão era um seletor de modelo a mais para
   * errar, e nada além disso.
   *
   * A rodada que sobrou é a que reabre: `processarSemRetorno` só clica em Reiniciar quando o
   * atendimento está fechado, então ela também dá conta de um sem retorno que por acaso esteja
   * aberto. Uma rodada, um modelo, os dois casos.
   */
  /**
   * Rodada 6: os reabertos, agora em "Meus". Ver `processarSemRetornoEmMeus`.
   *
   * Sem `confirm()` de abertura, diferente das outras: esta pergunta contato a contato, então a
   * confirmação em massa no começo seria uma porta a mais para atravessar sem decidir nada.
   */
  async function runLoteEmMeus() {
    const modelo = modeloDaRodada();
    if (!modelo) return setStatus('Escolha o modelo aprovado da rodada (cartão abaixo).', 'err');
    if (!state.settings.autoSend) {
      return setStatus('Ligue o "Enviar automático" na aba Config antes de rodar.', 'err');
    }
    await rodar({ aba: 'Meus', processar: (sessionId, ctx) => processarSemRetornoEmMeus(sessionId, modelo, ctx) });
  }

  /** Rodada 5: percorre os concluídos e só reabre. Ver `processarReabrir`. */
  async function runLoteReabrir() {
    const limite = clampInt(state.auto.cfg.limite, 1, 200);

    if (
      !confirm(
        `Vou percorrer a lista que você filtrou e REABRIR até ${limite} atendimento(s).\n\n` +
          'Nenhuma mensagem é enviada. Cada um que reabrir sai dos concluídos e passa para ' +
          '"Meus", onde você manda a mensagem e conclui.\n\n' +
          'Confira que a lista da esquerda é a que você quer percorrer. Confirma?'
      )
    ) {
      return setStatus('Rodada cancelada.');
    }

    await rodar({ aba: ABA_CONCLUIDOS, processar: processarReabrir });
  }

  async function runLote() {
    const modelo = modeloDaRodada();
    if (!modelo) return setStatus('Escolha o modelo aprovado da rodada.', 'err');
    if (!state.settings.autoSend) {
      return setStatus('Ligue o "Enviar automático" na aba Config antes de rodar.', 'err');
    }

    const limite = clampInt(state.auto.cfg.limite, 1, 200);
    const pausaSeg = clampInt(state.auto.cfg.pausaSeg, 3, 300);

    // Última porta antes de a mensagem sair para gente real, com os números na frente.
    if (
      !confirm(
        `Vou percorrer até ${limite} atendimento(s) da lista que você filtrou, com ${pausaSeg}s ` +
          'entre um envio e outro. Em cada um: reabro se estiver concluído, mando ' +
          `"${modelo.name}" (ou a resposta pronta, se a janela de 24h ainda estiver aberta) e ` +
          'concluo de novo.\n\n' +
          'Reabrir aparece para o contato como conversa retomada. Quem já recebeu é pulado.\n\n' +
          'Confira que a lista da esquerda é a que você quer percorrer. Confirma?'
      )
    ) {
      return setStatus('Rodada cancelada.');
    }

    await rodar({
      aba: ABA_CONCLUIDOS,
      processar: (sessionId, ctx) => processarSemRetorno(sessionId, modelo, ctx),
    });
  }

  /**
   * Rodada 1: a fila dos Novos.
   *
   * A aba é garantida a cada item de propósito: assumir o atendimento move o contato de "Novos"
   * para "Meus", e a plataforma fica na aba nova. Sem voltar, a rodada seguiria percorrendo os
   * "Meus" — que é justamente quem já foi atendido.
   */
  /**
   * Rodada 3: quem respondeu com os dados, na aba "Meus".
   *
   * Não pergunta os números na frente como as outras: aqui a confirmação é **por contato**, o
   * que já é a trava. O limite continua valendo como teto de envios.
   */
  async function runLoteRespondidos() {
    if (!state.settings.autoSend) {
      return setStatus('Ligue o "Enviar automático" na aba Config antes de rodar.', 'err');
    }
    const mapa = await store.get('contentTemplates');
    if (!Object.keys(mapa || {}).length) {
      return setStatus('Cadastre a tabela "Modelo por conteúdo" na aba Config: sem ela não há o que enviar.', 'err');
    }
    if (!state.hsmTemplates.length) {
      return setStatus('Nenhum modelo aprovado carregado. Abra um atendimento e clique em Recarregar.', 'err');
    }

    await rodar({ aba: 'Meus', processar: processarRespondido });
  }

  /**
   * Rodada 4: a aba "Outros".
   *
   * Ali o normal é vídeo, link e "bom dia" — mensagem que merece resposta mas não abre demanda.
   * Por isso a pergunta aparece **sempre**, mesmo sem conteúdo identificado: a saída esperada é
   * agradecer e concluir.
   *
   * Atenção: "Outros" são atendimentos **em andamento com outro operador** (medido:
   * `statuses=IN_PROGRESS` + `exceptUserIds=você`). Concluir ali fecha o atendimento de um
   * colega, então o aviso vai no confirm.
   */
  async function runLoteOutros() {
    if (!state.settings.autoSend) {
      return setStatus('Ligue o "Enviar automático" na aba Config antes de rodar.', 'err');
    }
    if (
      !confirm(
        'A aba "Outros" são atendimentos em andamento com OUTRO operador.\n\n' +
          'Concluir ali fecha o atendimento de um colega. Você decide contato a contato, mas ' +
          'confirme que é isso mesmo.'
      )
    ) {
      return setStatus('Rodada cancelada.');
    }

    await rodar({ aba: 'Outros', processar: processarRespondido });
  }

  async function runLoteNovos() {
    if (!state.settings.autoSend) {
      return setStatus('Ligue o "Enviar automático" na aba Config antes de rodar.', 'err');
    }
    if (!state.hsmTemplates.length) {
      return setStatus('Nenhum modelo aprovado carregado. Abra um atendimento e clique em Recarregar.', 'err');
    }

    const limite = clampInt(state.auto.cfg.limite, 1, 200);
    const pausaSeg = clampInt(state.auto.cfg.pausaSeg, 3, 300);

    const sozinha = !!state.auto.cfg.automaticoNovos;
    if (
      !confirm(
        `Vou percorrer a aba "Novos", assumir o atendimento e decidir pelo fluxo em até ${limite} ` +
          `contato(s), com ${pausaSeg}s entre um envio e outro.\n\n` +
          (sozinha
            ? 'AUTOMÁTICO LIGADO: a mensagem que o fluxo escolher sai SEM eu perguntar, contato a ' +
              'contato. Cada envio fica no log do Andamento.\n\n'
            : 'Vou perguntar a cada contato antes de mandar qualquer coisa.\n\n') +
          'Assumir tira o contato de "Novos" mesmo quando o fluxo resolve não mandar nada — ele ' +
          'passa para "Meus". Confirma?'
      )
    ) {
      return setStatus('Rodada cancelada.');
    }

    await rodar({ aba: 'Novos', processar: processarNovo, automatico: !!state.auto.cfg.automaticoNovos });
  }

  /**
   * Um contato da fila dos Novos: **assume o atendimento e entrega o caso ao fluxo.**
   *
   * Esta função tinha 120 linhas de decisão própria — gate por uma frase, formulário, mensagem do
   * momento, triagem — escritas antes de o quadro existir. Era o motor que ele viu envelhecer:
   * *"o iniciar conversas não foi atualizado com as regras atuais"* (03/09/2026).
   *
   * **Assumir vem antes de decidir, e é obrigatório**, não uma escolha: contato em "Novos" está
   * PENDENTE, e pendente não tem campo de mensagem — nenhuma decisão do fluxo poderia ser
   * executada. O efeito colateral é o que a rodada antiga já queria de propósito: assumido, ele
   * sai da fila mesmo quando o fluxo resolve não mandar nada, em vez de ser reaberto por toda
   * rodada futura (que é o que derrubava a API). Ele fica em "Meus".
   *
   * O que se perdeu ao apagar o motor antigo — e onde cada coisa foi parar:
   *
   *  - *só cumprimentou* → a caixa "só cumprimentou, e nada mais" do quadro, com o sinal
   *    `soCortesia`, que é mais estrita que a lista de palavras que estava aqui;
   *  - *já informou nome ou cidade* → o quadro decide, e o parser roda no `load()`;
   *  - *o formulário* → continua saindo, agora pela tecla que o quadro escolher — inclusive junto
   *    do modelo do anúncio, que era a metade que esta rodada nunca soube mandar.
   */
  async function processarNovo(sessionId, ctx) {
    let alvo = sessionId;
    let assumido = false;

    try {
      let estado = await page.getState();
      if (estado.sessionId !== sessionId) {
        return { nome: 'contato', resultado: 'erro', motivo: 'a aba trocou de atendimento no meio do caminho' };
      }

      if (estado.isPending) {
        setStatus('Assumindo o atendimento…');
        estado = await page.clickIniciar();
        assumido = true;
        // A plataforma pode devolver o atendimento com outro id ao assumir. Seguir o que está na
        // ABA é o certo: é ele que tem o campo de mensagem, e decidir sobre um id e escrever no
        // outro é a pior falha possível aqui.
        if (estado.sessionId) alvo = estado.sessionId;
      }

      if (estado.isPending || !estado.hasComposer) {
        // As duas causas pedem conserto diferente, então não vale colapsar numa frase só.
        return {
          nome: 'contato',
          resultado: 'erro',
          motivo: estado.isPending
            ? 'a plataforma não assumiu o atendimento (o botão Iniciar continua na tela)'
            : 'o campo de mensagem não apareceu depois de assumir o atendimento',
        };
      }
    } catch (err) {
      await page.closeOverlay().catch(() => {});
      return { nome: 'contato', resultado: 'erro', motivo: traduzirErroDeRede(err.message) };
    }

    const r = await processarRespondido(alvo, ctx);
    return assumido ? { ...r, saiuDaFila: true } : r;
  }

  /**
   * Rodada 3, um contato: quem já respondeu com os dados.
   *
   * Diferente das outras duas, esta **reusa o caminho normal do painel** (`load()` +
   * `saveClassification()`) em vez de reimplementar a classificação. É código testado e já trata
   * o que importa: nunca sobrescrever o CRM, somar etiquetas em vez de trocar, e conferir a
   * escrita relendo o contato.
   *
   * E ela **pergunta antes de enviar**, por decisão do Thiago: aqui a mensagem é o modelo
   * aprovado do conteúdo pedido, e mandar o modelo errado é o erro mais caro que existe neste
   * fluxo. Pular não conclui — o contato fica na fila para ele responder à mão.
   */
  async function processarRespondido(sessionId, ctx) {
    let nome = 'contato';
    try {
      // Carrega pelo caminho de sempre: parser, sugestão de etiquetas, e a classificação
      // automática do que é determinístico.
      await load(sessionId);
      if (!state.contact) return { nome, resultado: 'erro', motivo: 'não consegui carregar o contato' };
      nome = state.contact.name || state.contact.nameWhatsapp || 'sem nome';

      // Aqui a marca é por CONTATO TRATADO, não por mensagem enviada como nas outras duas
      // rodadas — e a diferença é de propósito. Esta pergunta contato a contato: você já decidiu
      // o que fazer com esta pessoa nesta rodada, e mostrar a mesma pergunta de novo (porque o
      // atendimento voltou para a lista com outro id) é perguntar duas vezes a mesma coisa.
      if (ctx?.contatosTratados?.has(state.contact.id)) {
        return { nome, resultado: 'pulado', motivo: 'já tratei este contato nesta rodada' };
      }
      ctx?.contatosTratados?.add(state.contact.id);

      /**
       * Pulo automático por etiqueta — a única coisa nesta rodada que sai da fila sem pergunta.
       *
       * Só acontece com a caixa marcada por ele, e o motivo vai para o Andamento **com o nome da
       * etiqueta que causou**: regra que tira contato da fila sem dizer por quê é exatamente o
       * "alguns concluem e outros não" que este projeto já pagou caro.
       *
       * Nada é enviado e nada é concluído: o atendimento fica aberto, onde estava.
       */
      if (state.auto.cfg.pularEtiquetasSozinho) {
        const dispensa = await etiquetaQueDispensaDaFila();
        if (dispensa) {
          return { nome, resultado: 'pulado', motivo: `etiqueta "${dispensa}" — pulado sem perguntar` };
        }
      }

      /**
       * A etiqueta de CIDADE é o que faz o contato existir para o trabalho: a API só filtra por
       * etiqueta, e sem ela a pessoa não entra em lista nenhuma. Conta tanto a que já está no CRM
       * quanto a que esta rodada vai gravar agora.
       *
       * **Sobe até aqui porque o modelo PADRÃO depende dela** — ver `modelosPadrao`, logo abaixo.
       * Antes era calculada só na hora de montar a caixa, e a escolha do modelo acontecia antes.
       */
      const idsDeCidade = await tagsLib.cityTagIds().catch(() => new Set());
      const temEtiquetaDeCidade =
        (state.contact?.tagsId || []).some((id) => idsDeCidade.has(id)) ||
        state.tagSuggestions.some((sug) => sug.origem === 'cidade' && sug.tag && (sug.marcada || sug.jaTem));

      const conteudos = state.tagSuggestions.filter((s) => s.origem === 'conteúdo');
      let modelo = null;
      let semModelo = '';
      let conteudoEscolhido = null;
      let desempatado = false;

      /**
       * **O TEXTO decide primeiro.**
       *
       * Pedido dele (01/09): *"o padrão para casar o modelo deve ser o texto (Olá! Eu apoio as
       * Escolas Cívico-Militares = modelo)"*, e *"não será feito etiqueta a etiqueta para os
       * anúncios, agora é só ads"*.
       *
       * A etiqueta ADS não distingue de QUAL anúncio a pessoa veio; o texto que ela mandou
       * distingue. Quando a tabela casa, o modelo sai daí — a etiqueta nem é consultada.
       *
       * Nada casando, o caminho antigo (etiqueta → modelo) segue exatamente como era: é o que
       * atende quem chega por outra via e quem já tem "Conteúdo Zucco"/"Conteúdo Flávio".
       */
      /**
       * **O ANÚNCIO decide, e agora decide mais que o modelo.**
       *
       * Pedido dele (02/09): *"falta reconhecer o anúncio, nas configurações bote os anúncios do
       * momento onde botarei o texto para ser reconhecido e o que fazer quando for determinado
       * texto do anúncio"*.
       *
       * A versão anterior (`modeloPorTexto`) reconhecia o anúncio pelo texto e só sabia responder
       * **uma** coisa: qual modelo mandar. Anúncio sem modelo — convite de evento, pesquisa,
       * anúncio que só traz gente nova — era reconhecido e morria ali.
       *
       * `store.anuncios` é a única fonte (a tabela antiga foi migrada por `carregarAnuncios`).
       * Consultar as duas faria apagar um anúncio não ter efeito: a linha velha continuaria
       * mandando o modelo que ele acabou de tirar do ar.
       *
       * Aqui só a ação `modelo` é tratada; `resposta` e `dados` viram recomendação depois da
       * regra (ver `sugestaoDoAnuncio`), e `fluxo` não faz nada de propósito — devolve o caso ao
       * quadro, com as etiquetas do anúncio já marcadas por `refreshTagSuggestions`.
       */
      const anuncio = state.anuncio?.anuncio || null;

      /**
       * **Subiu para cá em 04/09/2026**: a escolha do modelo passou a depender dele, e no lugar
       * antigo (bem abaixo) ele ainda não existia. O bloco é fechado em si — só lê `state.nossas`
       * e `state.templates` —, então mover é seguro.
       */
      /**
       * Já **ENTREGAMOS** algo a este contato — e não apenas perguntado algo a ele?
       *
       * Escolha dele (31/08), print do Cris: *"histórico de conversa grande provavelmente já
       * recebeu modelo de mensagem, vou mandar mensagem do momento"*.
       *
       * **A primeira versão contava QUALQUER mensagem nossa, e estava errada.** Print da Ivone,
       * uma hora depois: a nossa única mensagem tinha sido o **pedido de dados**, ela respondeu
       * *"Ivone trentim Borges passo fundo"* — e a caixa dizia *"já foi atendida antes (o modelo
       * provavelmente já saiu)"*. Não tinha saído nada. *"o atendimento foi perguntar os dados"*.
       *
       * **Pergunta não é entrega.** Quem só foi perguntado não recebeu nada ainda, e é exatamente
       * quem está esperando o material. Por isso as nossas mensagens que são PERGUNTA saem da
       * conta: o pedido de dados, a pergunta de interesse e a de "em que posso ajudar".
       *
       * A comparação usa o maior pedaço literal de cada texto, como o `modeloJaNaConversa` — é o
       * que sobrevive às variáveis substituídas e às três variantes de cada resposta.
       */
      const jaRespondemosAntes = (() => {
        if (!state.nossas.length) return false;

        const perguntas = ['pedir-dados', 'interesse-conteudo', 'perguntar-como-ajudar']
          .map((id) => state.templates.find((t) => t.id === id))
          .filter(Boolean);

        // Todos os textos possíveis de cada pergunta: o base e as variantes.
        const pedacosDePergunta = [];
        for (const t of perguntas) {
          for (const texto of [t.text, ...(t.variantes || [])]) {
            const literais = String(texto || '')
              .split(/\{\{[^}]*\}\}/g)
              .map((x) => achatarTexto(x))
              .filter((x) => x.length >= 30);
            if (literais.length) pedacosDePergunta.push(literais.sort((a, b) => b.length - a.length)[0]);
          }
        }

        /**
         * **O INVARIANTE vem primeiro, e o texto literal só depois.**
         *
         * `templatesLib.ehPedidoDeDados` reconhece o pedido pela linha `Nome / Cidade`, que não
         * muda entre redações nem entre variantes — ver o porquê lá, com o caso da Loreta. O
         * casamento por trecho literal fica como segunda camada: ele cobre as outras duas
         * perguntas (interesse e "como posso ajudar"), que não têm essa linha.
         */
        const ehPergunta = (m) => {
          if (templatesLib.ehPedidoDeDados(m.texto)) return true;
          const texto = achatarTexto(m.texto);
          return pedacosDePergunta.some((pedaco) => texto.includes(pedaco));
        };

        return state.nossas.some((m) => !ehPergunta(m));
      })();

      /**
       * **Qual modelo sai para quem chegou por anúncio** — o específico dele, ou o padrão.
       *
       * Redesenho dele (02/09): *"o modelo agora será feito pra cada anúncio específico e será
       * mandado no momento que a pessoa chegar pelo anúncio"* e *"caso o texto do anúncio não seja
       * reconhecido será mandado o modelo padrão"*.
       *
       * O padrão só entra quando o texto **não** foi reconhecido, e só para quem veio de anúncio —
       * a origem é dado da plataforma (`utm.source`), então não há como sair para quem chegou por
       * outra via. Anúncio reconhecido cuja ação é outra (resposta pronta, pedir dados, devolver ao
       * quadro) é escolha explícita dele, e escolha explícita não se substitui por um padrão.
       */
      /**
       * **O padrão não sai para quem já tem etiqueta de cidade** — decisão dele de 02/09/2026:
       * *"se a pessoa já respondeu a cidade a chance de ela ter recebido um modelo é muito grande,
       * então não tem necessidade de mandar o padrão novamente"*.
       *
       * A decisão estava escrita e valia por meio caminho: `anuncio-modelo-e-dados` exige
       * `!temEtiquetaDeCidade`, mas `conteudo-pedido` não exige nada — e é ele que manda o modelo
       * sozinho. Resultado na anotação da Maria Bernardete (03/09): cidade Caxias do Sul no CRM,
       * anúncio NÃO reconhecido, e a caixa oferecendo *"pediu «anúncio não reconhecido — modelo
       * padrão» e há modelo mapeado — mande"*. Ela: *"está retornando por outro anúncio que não
       * pode ser reconhecido, com uma mensagem de apoio — mandar 8"*.
       *
       * **Só o padrão é travado.** Anúncio RECONHECIDO continua mandando o modelo dele mesmo com
       * cidade — ela clicou pedindo aquilo, e há teste travando isso (*"com cidade: o modelo sai
       * igual"*). O padrão é o contrário: é o que sai quando não se sabe o que ela pediu, e para
       * quem já está cadastrada ele é repetição.
       */
      const veioDeUmAnuncio = !!(state.session?.utm?.source || state.session?.utm?.referralUrl);
      /**
       * **O modelo PADRÃO só sai na PRIMEIRA vinda pelo anúncio** — regra dele (04/09/2026):
       * *"a exceção de mandar modelo novamente é somente quando o modelo não é o padrão; contato
       * que não é a primeira vez que vem por anúncio não recebe modelo padrão"*.
       *
       * O padrão é o recibo de quem chegou: ele **confirma que a pessoa vai receber o conteúdo**,
       * e não entrega conteúdo nenhum (decisão dele, 02/09). Mandado de novo, é a mesma frase pela
       * segunda vez — e quem volta pelo anúncio já ouviu isso.
       *
       * `jaRespondemosAntes` é o "não é a primeira vez" **entregue**, e não "já falamos": pergunta
       * não conta (a lição da Ivone, 31/08 — quem só recebeu o pedido de dados não recebeu nada
       * ainda). A guarda de `temEtiquetaDeCidade`, de 03/09, continua junto: cidade conhecida é
       * indício de recibo já enviado.
       *
       * **O modelo do anúncio RECONHECIDO não é travado por nada disto** — é a exceção que ele
       * nomeou. Ela clicou pedindo aquilo, e aquilo é conteúdo de verdade, não recibo.
       */
      const modelosPadrao =
        veioDeUmAnuncio && !temEtiquetaDeCidade && !jaRespondemosAntes ? await carregarModelosPadrao() : [];
      const escolhaDeModelo = anunciosLib.modeloDoAnuncio(
        state.anuncio,
        modelosPadrao,
        veioDeUmAnuncio ? Number(await store.get('modeloPadraoIndex')) || 0 : 0
      );
      const porTexto = escolhaDeModelo
        ? hsmLib.modeloPorTexto([escolhaDeModelo.nome], { [escolhaDeModelo.nome]: escolhaDeModelo.nome }, state.hsmTemplates)
        : null;

      if (porTexto?.modelo) {
        modelo = porTexto.modelo;
        // Vira o "conteúdo escolhido" para a tela dizer POR QUE este modelo: sem isso a caixa
        // mostraria "Sem modelo" enquanto oferece a tecla 1, que é pior que não explicar.
        conteudoEscolhido = {
          nome:
            escolhaDeModelo.deOnde === 'padrao'
              ? 'anúncio não reconhecido — modelo padrão'
              : `anúncio: ${anuncio.nome || `"${state.anuncio.trecho}"`}`,
        };
      } else if (porTexto?.erro) {
        // Casou o texto e o modelo não existe: isto é erro de configuração DELE, e some no
        // silêncio se a rodada cair no caminho da etiqueta como se nada tivesse acontecido.
        semModelo = porTexto.erro;
      } else {
        const escolha0 = hsmLib.escolherConteudo(conteudos, await store.get('conteudoPreferido'));
        if (escolha0.erro) {
          /**
           * **Veio de anúncio e não sabemos qual: diga isso, não "nenhum conteúdo reconhecido".**
           *
           * Depois que a etiqueta ADS deixou de ser conteúdo (02/09/2026, decisão dele), quem chega
           * por anúncio sem anúncio cadastrado e sem modelo padrão cai aqui — e a mensagem genérica
           * mandaria ele procurar uma etiqueta de tema que nunca vai existir.
           *
           * As duas saídas estão na frase porque são as duas que resolvem: cadastrar o anúncio faz
           * sair o modelo certo daqui em diante; o modelo padrão atende quem chegar por campanha
           * não cadastrada. É o mesmo cuidado da mensagem de `templateParaConteudo`, que diz o que
           * fazer AGORA e o que fazer para não acontecer de novo.
           */
          semModelo = veioDeUmAnuncio
            ? 'veio de um anúncio e não sei qual: o texto dela não casou com nenhum anúncio da ' +
              'Config, e não há modelo padrão cadastrado. Cadastre o anúncio (pelo texto ou pelo ' +
              'nome da campanha, que aparece no cabeçalho) ou preencha os modelos padrão.'
            : escolha0.erro;
        } else {
          conteudoEscolhido = escolha0.conteudo;
          desempatado = !!escolha0.desempatado;
          const mapa = await store.get('contentTemplates');
          const achado = hsmLib.templateParaConteudo(conteudoEscolhido.nome, mapa, state.hsmTemplates);
          modelo = achado.modelo || null;
          semModelo = achado.erro || '';
        }
      }

      // Sem conteúdo identificado a pergunta aparece do mesmo jeito, só sem a tecla 1.
      //
      // Antes isso era pulo silencioso em "Meus". O efeito era o contato ficar preso: a rodada
      // pulava, ele continuava na fila, e a rodada seguinte pulava de novo — a mesma fila que
      // não drenava que consertamos em "Novos". E "obrigado" é justamente a conversa que
      // acabou e deveria fechar.
      //
      // Os dois textos são conferidos ANTES de a pergunta aparecer: oferecer uma opção que vai
      // travar na hora do envio é pior do que não oferecer.
      const contexto = await currentVarContext();
      const agradecimento = state.templates.find((t) => t.id === THANKS_TEMPLATE_ID);
      const agradecimentoTrava = agradecimento
        ? vars.render(agradecimento.text, contexto).missing.length > 0
        : false;

      const agradecerInfo = state.templates.find((t) => t.id === THANKS_INFO_TEMPLATE_ID);

      /**
       * O pedido de dados, que passou a ser a tecla 4 no lugar do "Agradecer informações".
       *
       * É o que falta na maioria desta fila: sem nome e sem cidade não há o que classificar, e o
       * contato fica dando voltas. O agradecimento não sumiu — continua nas respostas rápidas da
       * própria caixa, a um clique, só sem ocupar uma tecla.
       *
       * As "mais duas variações" que ele pediu **já existem**: `pedir-dados` carrega três textos
       * (`text` + duas `variantes`) e a rotação as reveza a cada envio. Uma tecla, três redações
       * diferentes — que é o ponto, já que repetir o mesmo texto em sequência é o que se suspeita
       * ter derrubado o número.
       *
       * A conferência de variável é feita na variante QUE VAI SAIR, não no texto-base: se a
       * corrente travar por variável faltando, a tecla some com o motivo na tela, em vez de
       * travar na hora do envio.
       */
      /**
       * A tecla 4 escolhe entre TRÊS textos, conforme ela ter dito que vai ao evento.
       *
       * Anúncio novo (01/09): o convite pergunta se a pessoa vai. Ele responde de dois jeitos —
       * consolo para quem não pode, comemoração para quem vai — e **os dois terminam pedindo nome
       * e cidade**. São o `pedir-dados` com um prefixo, então não precisaram de tecla nova: a 4
       * troca o texto e o rótulo diz qual vai sair.
       *
       * Sem resposta clara sobre presença, sai o `pedir-dados` de sempre. Aqui a dúvida não custa
       * nada: o texto seco continua servindo, só é mais frio.
       */
      const presenca = confirmaPresenca(state.entrantes, state.nossaUltimaAt);
      const idDoPedido =
        presenca === 'nao'
          ? 'pedir-dados-evento-nao'
          : presenca === 'sim'
            ? 'pedir-dados-evento-sim'
            : ASK_TEMPLATE_ID;

      // Se o texto do evento não estiver na lista (migração ainda não rodou, ou ele apagou),
      // cai no pedido de sempre em vez de sumir com a tecla 4.
      const pedirDados =
        state.templates.find((t) => t.id === idDoPedido) ||
        state.templates.find((t) => t.id === ASK_TEMPLATE_ID);
      const textoPedirDados = pedirDados ? await templatesLib.varianteAtual(pedirDados) : '';
      const pedirTrava = pedirDados ? vars.render(textoPedirDados, contexto).missing.length > 0 : true;
      const pedidoDeEvento = !!pedirDados && pedirDados.id !== ASK_TEMPLATE_ID;

      // A mensagem da ocasião vira um template de mentira, para reaproveitar o caminho de envio
      // inteiro: variáveis, anti-duplicata e registro. A chave inclui um resumo do texto, senão
      // trocar de data (Dia dos Pais -> Natal) seria barrado pelo anti-duplicata da anterior.
      const textoMomento = String(state.auto.cfg.mensagemMomento || '').trim();
      const momento = textoMomento
        ? {
            id: `momento:${chaveDoTexto(textoMomento)}`,
            name: 'Mensagem do momento',
            text: textoMomento,
            // Mesmo mecanismo das respostas prontas: `sendTemplate` reveza sozinho.
            variantes: state.auto.cfg.mensagemMomentoVariantes,
          }
        : null;
      // `let`: o texto pode ganhar o pedido de dados mais abaixo, e a trava por variável tem
      // que valer para o texto que REALMENTE vai sair.
      let momentoTrava = momento ? vars.render(momento.text, contexto).missing.length > 0 : true;

      // A pergunta de interesse (tecla 7): só faz sentido para quem NÃO tem etiqueta de
      // conteúdo. Quem já pediu conteúdo tem modelo para receber, não pergunta.
      /**
       * Tecla `i` (a 8 até 03/09): a pessoa só expressou apoio e já está classificada — agradecer
       * é o desfecho.
       *
       * Pedido dele (31/08, print do Ciro): *"esse é um caso comum até onde a pessoa só expressa
       * o apoio, ja tem as etiquetas, então é só uma questão de agradecer o apoio e carinho"*.
       *
       * A trava por variável segue a mesma disciplina das outras teclas: falta variável, a tecla
       * SOME com o motivo na tela, em vez de travar na hora do envio.
       */
      const apoio = state.templates.find((t) => t.id === 'agradecer-apoio');
      const perguntarAjuda = state.templates.find((t) => t.id === 'perguntar-como-ajudar');
      const textoPerguntarAjuda = perguntarAjuda ? await templatesLib.varianteAtual(perguntarAjuda) : '';
      const perguntarAjudaTrava = perguntarAjuda
        ? vars.render(textoPerguntarAjuda, contexto).missing.length > 0
        : true;
      const textoApoio = apoio ? await templatesLib.varianteAtual(apoio) : '';
      const apoioTrava = apoio ? vars.render(textoApoio, contexto).missing.length > 0 : true;

      /**
       * A METADE QUE FALTAVA: confirmar a presença **sem** pedir o cadastro de novo.
       *
       * Diagnóstico dele (02/09/2026): *"provavelmente pode ser o problema do padrão de mensagem,
       * ela já vem incluso pedindo dados; se usar a mensagem rápida sempre irá pedir os dados"*.
       * As duas respostas de evento fundem confirmação e pedido de `Nome / Cidade`, e não havia
       * versão só com a primeira metade — então quem já tinha tudo no CRM levava o formulário
       * junto, por qualquer caminho.
       *
       * Fica separado de `apoioTrava` de propósito: aquele alimenta a regra `so-expressa-apoio`,
       * que é sobre apoio genérico. Misturar os dois faria a falta de variável de um sumir com a
       * tecla do outro.
       */
      const presencaOk = state.templates.find((t) => t.id === 'presenca-confirmada');
      const textoPresencaOk = presencaOk ? await templatesLib.varianteAtual(presencaOk) : '';
      const presencaOkTrava = presencaOk ? vars.render(textoPresencaOk, contexto).missing.length > 0 : true;

      const interesse = state.templates.find((t) => t.id === INTEREST_TEMPLATE_ID);
      const interesseTrava = interesse
        ? vars.render(interesse.text, contexto).missing.length > 0
        : true;
      const etiquetasInteresse = await store.get('etiquetasInteresse');
      const podePerguntarInteresse = !interesseTrava && !conteudos.length;
      // Já perguntei antes? Então a tecla 7 vira "perguntar de novo" e perde o destaque: a
      // pessoa que respondeu "Sim." e continua sem etiqueta está esperando o conteúdo, não
      // outra pergunta igual. (Visto ao vivo com a Beti, 10/08.)
      const interessePerguntado = interesse
        ? await templatesLib.wasSent(state.contact.id, interesse.id)
        : null;

      // Contato já respondido — a última mensagem da conversa é nossa.
      //
      // Conclui sozinho **só quem foi respondido há pouco**: a conversa está viva, a pessoa
      // ainda pode voltar, e não há o que enviar. Quem está calado desde ontem NÃO: esse saía
      // da fila em silêncio sem nunca ter mandado os dados, que foi o relato dele. Passou do
      // limite, a rodada pergunta como faz com todo mundo — e quem decide se manda alguma coisa
      // é ele.
      //
      // A primeira versão disto tinha outra exceção (não concluir quem estava sem etiqueta de
      // conteúdo) e virou *"alguns concluem e outros não"*: regra que depende de estado
      // invisível parece defeito. Esta aqui aparece na tela, na linha do silêncio.
      //
      // `ultimaMensagem` vem do `load()` acima, da mesma leitura que trouxe as mensagens do
      // contato: uma chamada, não duas.
      const ultima = state.ultimaMensagem;
      const decisao = ultima && !ultima.doContato
        ? hsmLib.decidirSemResposta({
            horasDesdeMinha: (Date.now() - new Date(ultima.at).getTime()) / 3600000,
            limiteHoras: clampInt(state.auto.cfg.horasSemResposta, 1, 240),
          })
        : null;

      // Conclui sozinho só quem eu respondi HÁ POUCO. Quem está calado desde ontem cai na
      // pergunta como todo mundo — a regra e o porquê moram em `hsm.decidirSemResposta`.
      if (decisao?.acao === 'concluir') {
        await saveClassification({ withCompletionDate: true, quiet: true });
        const fechouRespondido = await concluirPeloPainel();
        if (!fechouRespondido.ok) {
          return { nome, resultado: 'pulado', motivo: `já respondido, mas ${fechouRespondido.reason}` };
        }
        if (fechouRespondido.dialogOpen) {
          return {
            nome,
            resultado: 'concluido',
            parar: true,
            motivo: 'já respondido, mas a plataforma pediu um motivo de conclusão — responda o diálogo',
          };
        }
        return {
          nome,
          resultado: 'concluido',
          // O motivo vem de `decidirSemResposta`: é ele que sabe se foi "respondi agora há
          // pouco", "a janela venceu" ou "já mandei o momento". Sem isso a rodada trataria
          // contatos de forma diferente sem o porquê aparecer na tela.
          motivo:
            `${decisao.motivo} (${formatarQuando(ultima.at)}) — concluí e segui` +
            // Visível no Andamento: é a lista de quem vale uma rodada de pergunta de interesse.
            (conteudos.length ? '' : ' (ainda sem etiqueta de conteúdo)'),
        };
      }

      // Já mandei este mesmo modelo hoje?
      //
      // O aviso de duplicata existia, mas era um `confirm()` do navegador disparado lá dentro do
      // envio — no meio da rodada ele aparece DEPOIS da decisão, fora do lugar onde você está
      // olhando. Aqui ele vira uma linha da própria pergunta, e o modelo perde o destaque de
      // opção primária: mandar de novo passa a ser uma escolha consciente.
      const jaEnviado = modelo ? await templatesLib.wasSent(state.contact.id, hsmKey(modelo)) : null;
      const enviadoHoje = !!jaEnviado && ehHoje(jaEnviado.at);

      // Mesma conferência para as respostas de texto. Todas elas passariam pelo `confirm()` do
      // navegador dentro do envio — que no meio da rodada abre DEPOIS da sua decisão e trava o
      // laço num diálogo nativo. Aqui o aviso vem antes, na pergunta, e o envio segue sem
      // confirm: a pergunta da rodada é a confirmação.
      const textosDeHoje = [];
      let momentoHoje = false;
      // "Já mandei a mensagem do momento" no relato dele não quer dizer hoje — a chave do envio
      // inclui um resumo do texto, então isto é sobre a mensagem do momento ATUAL.
      const momentoJaEnviado = momento ? !!(await templatesLib.wasSent(state.contact.id, momento.id)) : false;
      for (const t of [agradecerInfo, momento, interesse].filter(Boolean)) {
        const envio = await templatesLib.wasSent(state.contact.id, t.id);
        if (envio && ehHoje(envio.at)) {
          textosDeHoje.push(`"${t.name}" às ${formatarHora(envio.at)}`);
          if (momento && t.id === momento.id) momentoHoje = true;
        }
      }

      // O pedido de dados tem aviso PRÓPRIO, e não uma linha na lista acima: ele é a tecla 4, a
      // opção destacada, e é a que mais tenta ser repetida. Merece a hora na cara.
      /**
       * **O pedido de dados JÁ SAIU? Pergunte à conversa, por invariante — nunca por id de modelo.**
       *
       * Print do Deoclecio (02/09/2026): ele tem TODAS as etiquetas, e recebeu duas vezes *"Que
       * bom! Será uma grande satisfação contar com você… Nome / Cidade"*. Relato dele: *"repetindo
       * resposta em pessoa com todas etiquetas"*.
       *
       * A causa era esta linha. Havia **três formas** do pedido de dados — `pedir-dados` e as duas
       * de evento — e a trava perguntava `wasSent(contato, pedirDados.id)`, ou seja **só a forma
       * que sairia AGORA**. Basta `confirmaPresenca` responder diferente entre duas passadas (ela lê
       * a rajada depois da nossa última mensagem, e a rajada muda) para a trava olhar um id que
       * nunca saiu e concluir que ninguém pediu nada.
       *
       * Somava-se o registro de envios só enxergar o que saiu PELO PAINEL — o que o CLAUDE.md já
       * registra —, então mensagem disparada à mão ou pela automação da plataforma passava batido.
       *
       * Hoje quem responde é a **conversa**, por `templates.ehPedidoDeDados`, que casa pela linha
       * `Nome / Cidade`: o invariante das três formas, protegido por teste em cada texto. Pega toda
       * variante, toda redação antiga e todo envio fora do painel de uma vez.
       */
      const nossosPedidos = state.nossas.filter((m) => templatesLib.ehPedidoDeDados(m?.texto));
      const pedidoDeHoje = [...nossosPedidos].reverse().find((m) => m.at && ehHoje(m.at)) || null;
      const pedidoHoje = !!pedidoDeHoje;

      /**
       * O formulário já saiu para este contato ALGUMA VEZ?
       *
       * Duas fontes, pela mesma razão de sempre: `wasSent` só enxerga o que o painel mandou, e
       * o formulário também pode ter saído pela plataforma ou pela mão de outra pessoa. A
       * segunda fonte é a conversa — um trecho do meio do texto contra o que já mandamos.
       */
      /**
       * Mesma pergunta, sem recorte de "hoje" — e sem o palpite que havia aqui.
       *
       * A versão anterior comparava os caracteres 40 a 100 do texto que sairia agora contra o que
       * já mandamos. Isso amarrava a trava à REDAÇÃO: variante diferente, texto de evento com
       * preâmbulo, ou uma reescrita minha, e a fatia deixava de casar. O invariante `Nome / Cidade`
       * não depende de redação nenhuma.
       */
      const jaPediramDados = nossosPedidos.length > 0;

      /**
       * **Quem ignorou o pedido de dados não recebe a mensagem do momento seca** — pedido dele
       * (04/09/2026), com a print do contato que mandou uma imagem de bom dia às 08:18 e recebeu,
       * treze horas depois, *"🚨 ATENÇÃO! Para eu poder salvar seu contato me diga seu: Nome,
       * Cidade"*. Ele: *"soltou sem contexto nenhum"*.
       *
       * A ideia é dele: **a mensagem do momento + o pedido de novo, agora explicando por quê**.
       * O formulário sozinho, treze horas depois de uma figura, não tem contexto nenhum; junto do
       * conteúdo do dia ele vira o que é — alguém falando com ela.
       *
       * **Não é tecla nova.** É a tecla 5 trocando de TEXTO quando o contato já recebeu o pedido e
       * continua sem nome e sem cidade — o mesmo desenho de `confirmaPresenca` na tecla 4. O
       * rótulo da opção diz o que vai sair, senão a rodada mandaria duas coisas diferentes com o
       * mesmo nome na tela.
       *
       * **O id continua sendo o do momento**, de propósito: a anti-duplicata tem que enxergar as
       * duas formas como a mesma entrega — quem recebeu a combinada recebeu a do momento — e é
       * isso que faz `momentoJaEnviado` apagar o sinal no dia seguinte, em vez de a caixa repetir.
       *
       * **O bloco `Nome , Cidade` é obrigatório no texto**, e é o que `templates.ehPedidoDeDados`
       * casa: sem ele, a resposta dela deixaria de ser lida como resposta ao formulário e a rodada
       * pediria os dados outra vez. Tem teste.
       */
      const faltaCadastro =
        jaPediramDados &&
        !temEtiquetaDeCidade &&
        !(state.nomeInformado && state.cidadeInformada?.value && state.cidadeInformada.confidence !== 'nao-reconhecida');
      const pedidoJunto = String(state.auto.cfg.pedidoJuntoDoMomento || '').trim();
      if (momento && faltaCadastro && pedidoJunto) {
        momento.name = 'Mensagem do momento + pedir nome e cidade';
        momento.text = `${momento.text}\n\n${pedidoJunto}`;
        momento.variantes = (momento.variantes || []).map((v) => `${String(v || '').trim()}\n\n${pedidoJunto}`);
        momentoTrava = vars.render(momento.text, contexto).missing.length > 0;
      }

      // Nome errado — o apelido automático do anúncio ("[NOVO] (51) 9…") ou qualquer cadastro
      // que o `looksLikePlaceholder` recuse — deixa o {{primeiro_nome}} do agradecimento sem
      // valor. Isto aqui devolvia 'pulado' ANTES da pergunta, e o contato saía da rodada sem o
      // Thiago ver: o mesmo pulo silencioso que já tínhamos tirado de "Meus", entrando por
      // outra porta. Agora a pergunta aparece sempre; o que some é só a tecla 1, com o motivo
      // na tela — mandar o modelo sem o agradecimento seria enviar o fluxo pela metade.
      let modeloTravado = '';
      if (modelo && agradecimentoTrava) {
        const { missing, reasons } = vars.render(agradecimento.text, contexto);
        modeloTravado = vars.explainMissing(missing, reasons);
      }
      const podeEnviar = !!modelo && !modeloTravado;

      // A porta humana. O texto carrega o que foi classificado para conferência — o painel não
      // está mostrando a aba Dados durante a rodada.
      const etiquetas = state.tagSuggestions
        .filter((s) => s.tag && (s.marcada || s.jaTem))
        .map((s) => s.tag.label);

      // Canal fora do ar: some TODA saída que envia, e sobra pular. Ver `canalDesteContatoFora`.
      const canalFora = await canalDesteContatoFora();
      if (canalFora) {
        // Não grava ANTES de perguntar: as duas saídas daqui são pular (que não grava) e
        // concluir (que grava na hora). Gravar aqui pagava o custo mesmo quando ele ia pular.
        const escolhaFora = await perguntarNaRodada({
          titulo: nome,
          linhas: [linhaCanalFora(canalFora), canalFora.texto].filter(Boolean),
          pergunta: 'Nada pode ser enviado por este número agora. O que fazer?',
          opcoes: [
            { tecla: '1', valor: 'pular', rotulo: 'Pular este contato', primaria: true },
            { tecla: '2', valor: 'parar', rotulo: 'Parar a rodada' },
          ],
        });
        return {
          nome,
          resultado: 'pulado',
          parar: escolhaFora !== 'pular',
          motivo: 'o número deste atendimento está fora do ar — nada gravado, nada enviado',
        };
      }

      /**
       * **Qual texto a tecla do agradecimento manda** (o `i`; era a 8 até 03/09/2026).
       *
       * A tecla é uma só ("agradece e conclui") e as situações são duas: apoio genérico, e
       * confirmação de presença de quem já está cadastrada.
       *
       * **Nenhuma regra recomenda esta tecla para presença desde 03/09/2026** — quem confirma vai
       * para `confirmou-presenca-evento`, que PULA e deixa o atendimento para ele (*"não é para
       * responder, é para pular e eu atendo no final"*). Isto aqui continua valendo para quando
       * ELE aperta o 8 assim mesmo: o texto certo é o de presença, e mandar o agradecimento de
       * apoio genérico seria responder outra coisa.
       *
       * Sem a etiqueta de cidade não entra aqui: aí ainda falta dado, e quem resolve é a tecla 4
       * com o preâmbulo de evento.
       */
      const ehPresencaSemPendencia = presenca === 'sim' && temEtiquetaDeCidade && !!presencaOk && !presencaOkTrava;
      // O agradecimento trocou de tecla em 03/09 (foi para o `i`, e a chamada da IA ficou com o 8,
      // a pedido dele), e o nome acompanha: variavel chamada "tecla8" governando outra tecla seria a
      // armadilha ja registrada do comentario que descreve a ordem sem ser a ordem.
      const textoDoApoio = ehPresencaSemPendencia ? presencaOk : apoio;
      const travaDoApoio = ehPresencaSemPendencia ? presencaOkTrava : apoioTrava;

      // O destaque vem da tabela de regras (`sugestao.js`), não de condições espalhadas aqui.
      // Ela só RECOMENDA: todas as opções continuam na tela e todas as teclas continuam valendo.
      /**
       * Voltou clicando em OUTRO anúncio, sem responder o pedido de dados.
       *
       * O sinal é a última mensagem dele ser de novo o aceite do anúncio, tendo o formulário já
       * saído alguma vez. A frase do aceite é curta e genérica ("Olá!"), então sozinha ela casaria
       * com meio mundo — por isso a regra em `sugestao.js` exige, junto, que o contato continue
       * SEM etiqueta de cidade: é isso que separa "ignorou o formulário" de "respondeu começando
       * com Olá".
       */
      const ultimaDoContato = state.entrantes[state.entrantes.length - 1]?.texto || '';
      const padraoAnuncio = String(state.auto.cfg.padraoNovos || '').trim();
      /**
       * O sinal de "voltou" é **já termos falado antes**, não o formulário ter saído.
       *
       * A primeira versão exigia `pedidoDeHoje` e que o contato não tivesse cidade — e por isso
       * não pegou o Telmo (print de 31/08): cidade Viamão, modelo enviado às 10:28, e às 18:24 ele
       * voltou por outro anúncio. A rodada sugeriu mandar o modelo de novo.
       *
       * Ter alguma mensagem NOSSA na conversa é o que separa "voltou" de "chegou agora", e é
       * verdade tanto para quem recebeu formulário quanto para quem recebeu modelo.
       */
      const voltouPorOutroAnuncio =
        state.nossas.length > 0 &&
        !!padraoAnuncio &&
        achatarTexto(ultimaDoContato).includes(achatarTexto(padraoAnuncio));

      /**
       * Este modelo já está na conversa?
       *
       * `wasSent` só sabe do que o painel mandou. Modelo disparado pela automação da plataforma,
       * pelo chatbot do anúncio ou à mão por outra pessoa é invisível para ele — e a rodada
       * sugeria mandar de novo o que já estava na tela.
       *
       * Compara um trecho do MEIO do modelo com o que já saiu: o começo costuma ser saudação
       * igual em todos, e um trecho curto sobrevive a variável interpolada no caminho.
       */
      /**
       * O modelo já está na conversa?
       *
       * **Compara o maior pedaço LITERAL do modelo, e não uma fatia fixa.** A versão anterior
       * pegava os caracteres 40 a 100 — e modelo aprovado tem variáveis (`{{1}}`, nome, cidade).
       * Variável caindo nessa fatia fazia a comparação nunca casar, porque o que saiu tem o VALOR
       * no lugar do marcador. Print do Cris (31/08): histórico grande, modelo provavelmente já
       * entregue, e a caixa sugerindo mandar de novo.
       *
       * 30 caracteres literais é pouco para dar falso positivo (é meia frase específica) e curto
       * o bastante para sobrar mesmo em modelo cheio de variável.
       */
      /**
       * **Este texto nosso já saiu nesta conversa?**
       *
       * Compara pelo maior pedaço LITERAL do texto — o que sobra depois de tirar as variáveis. É o
       * que sobrevive ao `{{primeiro_nome}}` substituído e às três variantes de cada resposta, e é
       * a mesma conta que `jaRespondemosAntes` já fazia.
       *
       * Pergunta à CONVERSA e não ao registro de envios de propósito: `templatesLib.wasSent` só
       * enxerga o que saiu pelo painel, e nesta base a mensagem sai também pela automação da
       * plataforma, pelo chatbot do anúncio e pela mão dele.
       */
      const jaSaiuNaConversa = (texto) => {
        const pedacos = String(texto || '')
          .split(/\{\{[^}]*\}\}|\{\{?\d+\}?\}/g)
          .map((t) => achatarTexto(t))
          .filter((t) => t.length >= 30);
        if (!pedacos.length) return false;
        const maior = pedacos.sort((a, b) => b.length - a.length)[0];
        return state.nossas.some((m) => achatarTexto(m.texto).includes(maior));
      };

      /**
       * **O modelo já está na conversa — e quando ele é o PADRÃO, são os três.**
       *
       * O modelo padrão reveza entre três (pedido dele, 02/09: *"o modelo padrão deve variar entre
       * 3 modelos já que chega bastante gente por eles"*), e esta conferência olhava só o da vez.
       * Bastava a roleta ter andado entre uma passada e outra para o modelo ser **reenviado** —
       * anotações da Mary e da Eliana (02/09): *"já foi mandado modelo, última resposta foi um
       * emoji, só concluir"*.
       *
       * Não é preferência de redação: os três dizem a mesma coisa (que ela vai receber o
       * conteúdo), então ter recebido um é ter recebido o recibo.
       */
      const modeloJaNaConversa = (() => {
        if (jaSaiuNaConversa(modelo?.text)) return true;
        if (escolhaDeModelo?.deOnde !== 'padrao') return false;

        return modelosPadrao.some((nome) => {
          const outro = hsmLib.modeloPorTexto([nome], { [nome]: nome }, state.hsmTemplates);
          return outro?.modelo ? jaSaiuNaConversa(outro.modelo.text) : false;
        });
      })();

      /**
       * Nós perguntamos "em que você precisa de ajuda?" e ela RESPONDEU.
       *
       * A pergunta é reconhecida pelo invariante (`ehPerguntaComoAjudar`), não pela redação — a
       * lição da Loreta: comparar com o texto atual do template só enxerga o que saiu hoje.
       *
       * A ordem é por HORA, que é o que `getConversation` traz nos dois lados justamente para
       * poder intercalar. Sem hora nos dois, cai no fallback "ela escreveu alguma coisa": quem
       * abriu um caso respondendo à nossa pergunta tem que ir para uma pessoa, e **errar para o
       * lado de chamar gente é barato** — errar para o outro manda propaganda em cima de uma
       * denúncia, que foi o que aconteceu.
       */
      const respondeuComoAjudar = (() => {
        const pergunta = [...state.nossas].reverse().find((m) => templatesLib.ehPerguntaComoAjudar(m.texto));
        if (!pergunta) return null;

        const comTexto = state.entrantes.filter((m) => String(m?.texto || '').trim());
        if (!comTexto.length) return null;

        const depois = pergunta.at
          ? comTexto.filter((m) => m.at && new Date(m.at) > new Date(pergunta.at))
          : comTexto;
        const alvo = depois.length ? depois : pergunta.at ? [] : comTexto;
        if (!alvo.length) return null;

        const ultima = alvo[alvo.length - 1];
        // `\s+`, com a barra: sem ela o padrão é a LETRA "s", e o trecho que aparece na caixa da
        // rodada saía com todo "s" trocado por espaço ("Maria Silva / Canoas" → "Maria Silva / Canoa ").
        return { trecho: String(ultima.texto || '').replace(/\s+/g, ' ').trim().slice(0, 90) };
      })();

      // Lida aqui, antes das opções e da regra, porque as duas usam.
      const etiquetaSemInteresse = String(state.auto.cfg.etiquetaSemInteresse || '').trim();

      /**
       * **Ela respondeu o nome ou a cidade DEPOIS do pedido?**
       *
       * O parser dos palpites roda na conversa INTEIRA, e a pergunta aqui e outra. Print dele (02/09/2026): pedimos os dados às 12:51, ela não respondeu, e
       * saiu o agradecimento — *"agradecimento saindo sem a pessoa responder nome e cidade"*.
       *
       * O motivo é essa diferença. Se o parser tinha achado um nome ou uma cidade em qualquer
       * mensagem anterior — e nesta base isso é comum, porque ela costuma dizer de onde é antes de
       * qualquer pedido —, bastava ela escrever QUALQUER coisa depois (um "ok", um link
       * repassado, um vídeo) para as duas metades darem verdadeiro. Agradecíamos por um dado que
       * ela nunca deu, e concluíamos o atendimento.
       *
       * O comentário do sinal já dizia *"o parser achou nome ou cidade no que ela escreveu"* — a
       * intenção estava certa e o código não a cumpria. Agora o parser roda **só nas mensagens que
       * vieram depois do pedido**.
       *
       * `respostaAoPedido: true` é o modo que a nossa própria pergunta autoriza: estas mensagens
       * SÃO a resposta ao formulário, então "maria cachoeirinha" vale sem separador e sem pista.
       */
      const depoisDoPedido = respostasApos(state.entrantes, state.nossas, pediuNomeECidade);
      const respondeuOsDados = await (async () => {
        /**
         * **E depois da NOSSA ÚLTIMA mensagem, não só depois do pedido.**
         *
         * Anotação da Iraci Salete (02/09/2026): ela respondeu *"sou de cristal do sul meu nome é
         * iraci salete cardoso"*, foi agradecida, e mandou dois emojis — e a rodada quis agradecer
         * de novo. Relato dele: *"mandou emoji só concluir"*.
         *
         * O recorte "depois do pedido" não se apaga nunca: a resposta dela continua sendo posterior
         * ao pedido para sempre, então o sinal ficava verdadeiro em toda passada seguinte. Cortar
         * na nossa última mensagem é o que faz o sinal significar **"ela respondeu e nós ainda não
         * respondemos de volta"** — que é quando o agradecimento é devido.
         *
         * Estreitar aqui é seguro: quem responde depois de nós continua sendo pego na passada
         * seguinte, porque aí a resposta dela é que passa a ser a mais recente.
         */
        const aindaSemResposta = (depoisDoPedido || []).filter(
          (m) => !state.nossaUltimaAt || (m?.at && new Date(m.at) > new Date(state.nossaUltimaAt))
        );
        const textos = aindaSemResposta.map((m) => String(m?.texto || '').trim()).filter(Boolean);
        if (!textos.length) return false;
        const doPedido = await extract(textos, { respostaAoPedido: true });
        /**
         * **Cidade `nao-reconhecida` NÃO conta como resposta.**
         *
         * No modo `respostaAoPedido` o parser é generoso de propósito — é ele que faz
         * "maria cachoeirinha" virar nome e cidade sem separador nenhum. O preço é que qualquer
         * palavra solta volta como cidade com confiança `nao-reconhecida`: medido, um link do
         * Instagram repassado devolve `cidade: "www.instagram.com"`.
         *
         * Isso sozinho reproduziria a print inteira — ela repassa um vídeo depois do pedido e nós
         * agradecemos pelos dados. Exigir cidade RECONHECIDA (ou um nome, que já passa pelas
         * guardas de `NAO_E_NOME`) é o que separa "respondeu" de "escreveu qualquer coisa".
         */
        const cidadeVale = !!doPedido.cidade && doPedido.cidade.confidence !== 'nao-reconhecida';
        return cidadeVale || !!doPedido.nome;
      })();

      let sugestao = sugerirAcaoComFluxo({
        // Recusou ou veio hostilizar: a regra mais alta da tabela, porque continuar mandando
        // mensagem para quem pediu para parar é o que gera denúncia.
        semInteresse: semInteresse(state.entrantes),
        // Perguntamos e ela respondeu: a resposta precisa de gente, nunca de modelo.
        respondeuComoAjudar,
        /**
         * **Ela respondeu o nome ou a cidade que pedimos** — agradece e encerra, sem modelo.
         *
         * Pedido dele (02/09): *"agora só precisa agradecer a atenção e encerrar sem mandar
         * modelo"*, porque o modelo passou a ser o recibo da chegada.
         *
         * **As duas metades juntas, e é isso que o torna seguro:** o pedido de dados saiu e ela
         * escreveu depois (`respostasApos`, casando por INVARIANTE e não pelo texto atual do
         * template) **e** o parser achou nome ou cidade **nessas** mensagens — não na conversa
         * inteira, que era o defeito de 02/09. Ver `respondeuOsDados`, acima.
         */
        respondeuOsDados,
        /**
         * **Ela já escreveu o nome E a cidade — pedir de novo é pedir o que já temos.**
         *
         * Anotação do Plauto (03/09/2026): a última mensagem dele era *"Plauto Velho, cidade São
         * Leopoldo"* e a caixa sugeria a tecla 4, *"peça os dados esta vez"*. Ele: *"já foi pedido
         * dados, seria agradecer e encerrar"*.
         *
         * **É um sinal diferente de `respondeuOsDados`, e as duas metades explicam por quê.** Aquele
         * pergunta *"ela respondeu ao NOSSO pedido e nós ainda não respondemos de volta?"* — e para
         * quem informa sem ter sido perguntado ele é falso, porque a nossa pergunta nunca saiu. Este
         * pergunta só *"nós já sabemos as duas coisas?"*, que é o que decide se o formulário faz
         * sentido.
         *
         * **Por isso ele roda na conversa INTEIRA, e aqui isso está certo** — a armadilha de 02/09
         * (o parser da conversa toda dando "ela respondeu") era sobre o outro sinal, que afirma algo
         * sobre o momento. "Ela já disse de onde é" não deixa de ser verdade com o tempo.
         *
         * **As duas metades juntas**: nome e cidade RECONHECIDA. Só o nome, ou só a cidade, e o
         * pedido continua tendo o que buscar — e `nao-reconhecida` é o modo generoso do parser
         * devolvendo qualquer palavra solta, que já causou agradecimento por um link do Instagram.
         *
         * Ele **só bloqueia o pedido**; não manda nada. Quem decide o desfecho é o quadro.
         */
        jaDeuNomeECidade:
          !!state.nomeInformado &&
          !!state.cidadeInformada?.value &&
          state.cidadeInformada.confidence !== 'nao-reconhecida',
        /**
         * **Disse que VAI ao evento.** `presenca` já era calculado aqui para escolher o texto da
         * tecla 4; agora também é sinal, porque faltava um desfecho para "confirmou e não falta
         * dado nenhum" — o caso do Deoclecio, que recebeu o pedido de cadastro duas vezes tendo
         * todas as etiquetas.
         */
        confirmouPresenca: presenca === 'sim',
        /**
         * **Ela mandou o endereço.** Pedido dele (04/09/2026): só se pede endereço para enviar
         * material, então o endereço sozinho identifica o caso — pula, não conclui, e a etiqueta
         * fica no contato para ele transferir a conversa ao responsável no fim.
         */
        informouEndereco: !!(await enderecoParaMaterial()),
        modeloJaNaConversa,
        jaRespondemosAntes,
        ultimaEhDespedida: ultimaEhDespedida(state.entrantes),
        // "Já foi respondida": nossa última mensagem saiu hoje. Serve para a reação (figura,
        // emoji, link) virar "concluir" em vez de "mais uma mensagem".
        respondidoHoje: !!state.nossaUltimaAt && ehHoje(state.nossaUltimaAt),
        voltouPorOutroAnuncio,
        momentoHoje,
        momentoJaEnviado,
        // A RAJADA, não só a última: três mensagens curtas somando 450 caracteres são conversa
        // igual a uma longa de 450 (print dele, 31/08).
        // Os padroes do anuncio entram para a mensagem GERADA pelo anuncio nao contar como
        // mensagem propria dela -- mesmo criterio de `soExpressaApoio`, logo abaixo.
        pedeRespostaPessoal: conversaPedeRespostaPessoal(state.entrantes, state.nossaUltimaAt, state.padroesDeAnuncio),
        // Pergunta de razão ou de posição: nenhuma resposta pronta responde, e mandar o modelo
        // vira material de campanha em cima da pergunta dela (print da Clair, 31/08).
        perguntaAberta: conversaTemPerguntaAberta(state.entrantes, state.nossaUltimaAt),
        // Só apoio, sem pergunta e sem pedido: agradecer é o desfecho (print do Ciro, 31/08).
        // A tecla só é oferecida se o texto do agradecimento não estiver travado por variável.
        // Os padrões do anúncio vêm da Config: é por eles que a mensagem gerada pelo anúncio
        // ("Olá! Eu apoio as Escolas Cívico-Militares") deixa de contar como apoio escrito por
        // ela. Por TEXTO e não por posição — a figura que a Erenita mandou antes derrubou a
        // versão posicional (01/09).
        soExpressaApoio: apoioTrava
          ? null
          : soExpressaApoio(state.entrantes, state.nossaUltimaAt, state.padroesDeAnuncio),
        /**
         * **O apoio foi escrito em outro dia?** — é o que escolhe entre agradecer e mandar a
         * mensagem do momento (critério dele, 03/09/2026: *"se foi no dia anterior, é mensagem do
         * momento; se foi recente, mensagem de apoio"*).
         *
         * Olha a ÚLTIMA mensagem dela com hora, não a rajada inteira: o que interessa é quando ela
         * falou pela última vez, e uma conversa que atravessa a meia-noite continua sendo de hoje.
         */
        /**
         * **A última coisa que ela escreveu é de outro dia?**
         *
         * Nasceu como `apoioDeOutroDia` em 03/09 e perdeu o "apoio" do nome em 04/09: quatro
         * anotações mostraram que a razão nunca teve a ver com apoio — responder o conteúdo de
         * ontem soa a quem não estava lá, seja ele apoio, cadastro ou piada política.
         */
        deOutroDia: deOutroDia(state.entrantes),
        /**
         * **Terminou com uma pergunta?** Só impede a conclusão em silêncio — ver
         * `cortesia.perguntaPendente`, que olha a RAJADA inteira. Não é `perguntaAberta`, que
         * decide o desfecho.
         */
        perguntaPendente: perguntaPendente(state.entrantes, state.nossaUltimaAt),
        etiquetaQueDispensa: await etiquetaQueDispensaDaFila(),
        // "É da casa": conclui e não manda nada. Lista própria — ver `etiquetaQueSoConclui`.
        etiquetaSoConclui: await etiquetaQueSoConclui(),
        /**
         * **Não há o que responder: a conversa termina numa mensagem NOSSA.**
         *
         * Print dele (03/09/2026): a conversa tinha só o nosso disparo, ele assumiu o atendimento
         * e a rodada mandou o pedido de nome e cidade em cima. *"pegando conversas que a última
         * mensagem foi minha e mandando mensagem, é pra concluir sem mandar nada"*.
         *
         * `'vazia'` é o caso que escapava de tudo: sem nenhuma mensagem dela,
         * `hsm.decidirSemResposta` não tem `ultima` para olhar e o contato descia até
         * `nunca-pediram-dados`, que envia. A string vale como verdadeiro e ainda diz na caixa
         * QUAL dos dois casos é.
         */
        ultimaEhNossa: !state.entrantes.length
          ? 'vazia'
          : !!state.ultimaMensagem && !state.ultimaMensagem.doContato,
        ultimaEhSoReacao: ultimaEhSoReacao(state.entrantes),
        // Só links e vídeos repassados: é ruído, e ruído não pede formulário (print do Odone).
        rajadaEhSoRepasse: rajadaEhSoRepasse(state.entrantes, state.nossaUltimaAt),
        // Pediu algo sem dizer o quê: material de campanha em cima disso é o pior caso do
        // projeto (print da Mari, 31/08). Perguntar é a única resposta segura.
        pedeAlgoIndefinido: pedeAlgoIndefinido(state.entrantes, state.nossaUltimaAt),
        // Pediu DINHEIRO: vem antes do "pediu algo sem dizer o quê" no quadro, porque aqui já se
        // sabe o que ela quer — perguntar seria fingir que não (print da Marli, 02/09).
        pedeAjudaFinanceira: pedeAjudaFinanceira(state.entrantes, state.nossaUltimaAt),
        /**
         * **Perguntou como trabalhar no mandato.** Anotação do Kelvem (02/09/2026): a pergunta veio
         * numa mensagem e o *"No caso vcs não pagam"* na seguinte, e a rodada agradeceu e concluiu.
         * O texto que explica e nega já existia sem ninguém acioná-lo.
         */
        pedeEmprego: pedeEmprego(state.entrantes, state.nossaUltimaAt),
        /**
         * **Pediu que a gente ligasse.** Anotação da Jucileia (04/09/2026): *"Oi"*, três mensagens
         * que a plataforma não leu e *"Me liga"* — e a rodada ofereceu concluir, deixando a pessoa
         * esperando o telefone tocar.
         */
        pedeLigacao: pedeLigacao(state.entrantes, state.nossaUltimaAt),
        /**
         * **Só cumprimentou, e nada mais.** Substitui a caixa de palavras "bom dia", que casava por
         * trecho contido e por isso pegava a Teresinha (*"Boa tarde o senhor tá concorendo
         * também"*) e o desabafo da Cris. `soCortesia` olha se TODAS as últimas mensagens são só
         * cumprimento — que é o que o nome da caixa sempre prometeu.
         */
        // A RAJADA, e nao as tres ultimas da conversa: `soCortesia` olha as ultimas mensagens sem
        // saber onde a nossa entrou, entao sem este recorte o sinal continuaria verdadeiro depois
        // de respondermos — e a caixa mandaria a mensagem do momento em toda passada.
        soCortesia: soCortesia(rajadaFinal(state.entrantes, state.nossaUltimaAt)),
        podePerguntarAjuda: !perguntarAjudaTrava,
        podeMandarMomento: !momentoTrava,
        temEtiquetaDeCidade,
        // O critério de "pedir dados" é o NOME, não a cidade (decisão dele, 31/08).
        nomeSemSentido: nomeSemSentido(state.contact?.name),
        jaPediramDados,
        podePedirDados: !pedirTrava,
        pedidoHoje,
        podeEnviar,
        enviadoHoje,
        conteudoPedido: conteudoEscolhido?.nome || '',
        podePerguntarInteresse,
        /**
         * **Tudo o que ela mandou foi mídia que a plataforma não conseguiu ler.**
         *
         * Print do Tilin (03/09/2026): dois avisos de tipo não suportado, número privado, e nada
         * mais. A rodada pediu nome e cidade — *"a mensagem de nome e cidade ficou deslocada
         * demais"*.
         *
         * `prepararEntrantes` marca essas mensagens com `sistema: true` e ESVAZIA o texto, em
         * vez de descartá-las: "mandou algo que não deu para ler" é diferente de "não mandou nada",
         * e é essa diferença que o sinal usa. Conversa vazia de verdade é `ultimaEhNossa`.
         *
         * Exige que TODAS sejam ruído. Uma figura no meio já é algo que ele pode olhar, e aí quem
         * decide é `ultima-e-so-reacao`; um áudio, `ultima-pede-resposta-pessoal`.
         */
        soRuidoDaPlataforma:
          (state.entrantes || []).length > 0 && state.entrantes.every((m) => !!m?.sistema),
        interessePerguntado: !!interessePerguntado,
        /**
         * O TEXTO, para os ramos que ele monta por palavra na janela do fluxo.
         *
         * A tabela de regras nunca precisou disto: as dezesseis leem sinais ja calculados. A
         * arvore precisa, porque a condicao dele pode ser "escreveu bom dia" -- e sem o texto no
         * contexto esse ramo nunca casaria, em silencio.
         */
        textos: (state.entrantes || []).map((e) => e?.texto || ''),
        ultimoTexto: (state.entrantes || []).slice(-1)[0]?.texto || '',
        // A origem e DADO, nao texto (utm.source/referralUrl) -- ver o CLAUDE.md.
        veioDeAnuncio: !!(state.session?.utm?.source || state.session?.utm?.referralUrl),
        /**
         * **Reconheci de QUAL anúncio ela veio** — diferente de `veioDeAnuncio`, que é a origem.
         *
         * A origem vem da plataforma e diz só que houve um anúncio; este sinal diz que o texto
         * casou com um dos anúncios do momento que ele cadastrou. É o que permite um ramo do
         * quadro separar "veio de anúncio que eu conheço" de "veio de anúncio qualquer".
         */
        anuncioReconhecido: !!state.anuncio,
      });

      /**
       * **O anúncio impõe o desfecho — mas nunca por cima de quem decidiu não mandar nada.**
       *
       * Pedido dele (02/09): o anúncio agora diz *o que fazer*, e não só qual modelo. As ações
       * `resposta` e `dados` são as duas que a tabela antiga não sabia expressar; `modelo` já saiu
       * pela tecla 1 lá em cima e `fluxo` de propósito não muda nada.
       *
       * Vem DEPOIS da regra e ANTES da IA: escolha explícita dele não se substitui por dedução, e
       * pagar pela IA num caso que ele já configurou não muda o resultado.
       *
       * **A trava está em `anuncios.decidirComAnuncio`**, e é a lição que este projeto já pagou
       * duas vezes: pôr algo no topo sem olhar o que ele passou a vencer. Quem escreveu o texto do
       * anúncio uma vez carrega esse texto na conversa para sempre — então a regra que decidiu
       * **não enviar** (recusa, despedida, etiqueta que dispensa) continua ganhando. Foi assim que
       * quem só escreveu "Amém" recebeu mais uma mensagem 36 min depois.
       */
      /**
       * **A ação do anúncio já foi cumprida?** Anotações da Lúcia e do Deoclécio (03/09/2026).
       *
       * O texto do anúncio fica na conversa para sempre, então sem esta pergunta a resposta pronta
       * dele era oferecida em toda passada — para a Lúcia, que já tinha respondido nome, cidade e
       * confirmado presença (*"só concluir, ela confirmou minha mensagem"*), e para o Deoclécio,
       * seis vídeos depois (*"o contexto se perdeu"*).
       *
       * Cada ação tem a sua própria pergunta, e as duas olham a CONVERSA:
       *
       *  - `resposta` → o texto daquela resposta pronta já saiu;
       *  - `dados` → o pedido de nome e cidade já saiu, em qualquer uma das três formas
       *    (`jaPediramDados` casa pelo invariante `Nome / Cidade`).
       */
      const acaoDoAnuncio = state.anuncio?.anuncio?.acao;
      const jaSaiuOAnuncio = (() => {
        if (acaoDoAnuncio === 'dados') return jaPediramDados;
        if (acaoDoAnuncio !== 'resposta') return false;
        const pronta = state.templates.find((x) => x.id === state.anuncio.anuncio.valor);
        if (!pronta) return false;
        return [pronta.text, ...(pronta.variantes || [])].some((texto) => jaSaiuNaConversa(texto));
      })();

      const doAnuncio = anunciosLib.decidirComAnuncio(
        state.anuncio?.anuncio,
        sugestao,
        sugestao?.id ? sugestaoLib.efeitoDaRegra(sugestao.id, state.fluxo) : null,
        { jaSaiu: jaSaiuOAnuncio }
      );
      if (doAnuncio) {
        registrarNaRodada(nome, 'info', doAnuncio.motivo);
        sugestao = doAnuncio;
      } else if (state.anuncio) {
        /**
         * **Reconhecer o anúncio e não fazer nada precisa APARECER.**
         *
         * Relato dele em 02/09/2026, com a print: *"não seguiu o fluxo"*. O anúncio dele estava
         * reconhecido certo, com a ação "só etiquetar e deixar o fluxo decidir" e **sem etiqueta
         * nenhuma** — ou seja, configurado para não fazer nada. Do lado de fora era
         * indistinguível de o reconhecimento ter falhado, e o tempo foi gasto procurando defeito
         * onde não havia.
         *
         * Então a linha diz as três coisas: qual anúncio casou, o que ele manda fazer, e — quando
         * o fluxo também não decidiu — que ninguém decidiu nada. A Config passou a acusar a
         * configuração inerte (`anuncios.conferir`); esta linha é a mesma verdade no momento em
         * que ele está olhando a conversa.
         */
        const qual = state.anuncio.anuncio.nome || `"${state.anuncio.trecho}"`;
        const oQue = anunciosLib.desfechoEmPortugues(state.anuncio.anuncio);
        registrarNaRodada(
          nome,
          sugestao ? 'info' : 'aviso',
          `anúncio reconhecido: ${qual} → ${oQue}` +
            (sugestao ? '' : ' — e o fluxo não decidiu nada para este caso, então é com você')
        );
      }

      /**
       * A avaliação de contexto — a SEGUNDA camada, e só do que a primeira não resolveu.
       *
       * **A ordem estava invertida até 01/09/2026, e isso mandou mensagem errada para eleitor.**
       * A chamada ficava lá em cima, antes de `sugerirAcao`, e o comentário aqui afirmava que a
       * regex já havia filtrado — não havia. Com "Automatizar com IA" ligado, a escolha da IA era
       * executada direto, então regra determinística nenhuma era consultada: um contato que só
       * escreveu "Amém" recebeu mais uma mensagem 36 min depois da anterior, porque
       * `ultima-e-despedida` (que manda concluir sem responder) nunca chegou a ser olhada.
       *
       * Agora é o que sempre esteve escrito no desenho: **`sugestao === null` é o gatilho**. Regra
       * conhecida decide de graça e não depende de a IA estar no ar; a IA só vê o que sobrou.
       *
       * Ela decide entre TRÊS saídas:
       *  - `escalar` → sai da rodada, com o motivo (e só aqui o rascunho pode sair sozinho);
       *  - `responder` → vira a tecla 0 da caixa, com o texto que ela escolheu;
       *  - `incerto` → a caixa aparece exatamente como aparecia antes da IA existir.
       */
      /**
       * **A tecla 6 também chama a IA, e é o ponto todo dela.**
       *
       * "Responda à mão" quer dizer, por definição, *nenhuma regra sabe o que mandar aqui* — que é
       * exatamente o buraco que a avaliação de contexto existe para tapar. Deixar a IA de fora
       * justamente aí fazia a rodada parar em todo áudio e em todo texto longo, e foi o relato
       * dele: *"ela parou de ver praticamente tudo e está passando pra mim"* (01/09/2026).
       *
       * As outras teclas continuam decidindo sozinhas e de graça: a regra que manda **concluir**
       * (tecla 3) ou **mandar o modelo** (tecla 1) já sabe o que fazer, e pagar por uma segunda
       * opinião ali não muda o resultado — foi o excesso oposto, o que mandou mensagem para quem
       * só disse "Amém".
       */
      const regraPedeGente = sugestao?.tecla === '6';

      /**
       * **Um ramo do fluxo pode ENTREGAR o caso para a IA** (pedido dele, 01/09/2026).
       *
       * Até aqui a IA só entrava onde nenhuma regra resolvia — ela era o desfecho do que ninguém
       * previu. Ele quis o contrário também: apontar uma situação e dizer *"esta eu confio nela"*.
       * São coisas diferentes, e a segunda é uma escolha, não um resto.
       *
       * O caso segue exatamente o caminho da IA que já existia, com as mesmas travas: id inventado
       * vira `incerto`, `RESTRITOS` vira escalada, sem chave ou sem crédito vira `incerto`, e o
       * teto de gasto continua obrigado no service worker. Nada aqui é caminho novo para o
       * dinheiro nem para o que chega ao eleitor.
       */
      const ramoChamaIA = !!sugestao?.ia;

      let decisaoIA = null;
      /** Preenchido quando a IA escala: vira uma linha da caixa, para ele ver POR QUE está com ele. */
      let escalouParaVoce = '';
      if (!sugestao || regraPedeGente || ramoChamaIA) {
        decisaoIA = await avaliarComIA();
        if (decisaoIA?.acao === 'escalar') {
          /**
           * A IA escalou: nenhuma resposta pronta serve. É AQUI, e só aqui, que o rascunho pode
           * sair sozinho — decisão dele (20/08/2026), com o padrão sendo as respostas prontas e o
           * rascunho como exceção.
           *
           * `rascunharParaEle` **nunca envia** (03/09/2026, pedido dele: *"retire essa mensagem
           * automática"*). Ela deixa o texto no campo de mensagem e o contato segue para a caixa
           * de pergunta, onde ele lê e decide — inclusive apagar o rascunho e escrever outro.
           */
          /**
           * Deixa o rascunho no campo de mensagem e SEGUE para a caixa: quem manda é ele.
           *
           * **O `try` não é decoração.** Sem ele, um defeito aqui dentro vira `resultado: 'erro'`
           * lá embaixo e `percorrerFila` PARA a rodada — foi exatamente o que aconteceu em
           * 03/09/2026 (*"× Catarina — auto is not defined"*, e a rodada encerrou ali). Relato
           * dele: *"e parou a rodada, o que não é pra acontecer"*.
           *
           * É a regra que o CLAUDE.md já registra e que este caminho não seguia: **falha de IA
           * nunca para a rodada.** O rascunho é uma conveniência; a fila é o trabalho.
           */
          let rascunho = { enviado: false, motivo: '' };
          try {
            rascunho = await rascunharParaEle();
          } catch (err) {
            rascunho = { enviado: false, motivo: `falhou: ${err?.message || err}` };
            registrarNaRodada(nome, 'aviso', `não consegui rascunhar (${rascunho.motivo}) — segui sem`);
          }

          /**
           * Escalar = sair da rodada sem enviar nada.
           *
           * Antes isto aplicava a etiqueta de triagem, que deixava o contato achável no filtro do
           * CRM depois. A triagem foi **removida a pedido dele** (29/08), e a etiqueta foi junto —
           * então hoje escalar deixa rastro só no log da rodada, que some quando o painel fecha.
           * É consequência direta da remoção, não esquecimento: se um dia a etiqueta voltar a ser
           * desejada, é aqui que ela entra.
           */
          /**
           * **Escalar ABRE A CAIXA — não pula.**
           *
           * Relato dele (02/09/2026): *"pulando contato sem eu pedir mesmo a minha mensagem não
           * sendo a última e com o box de pular desmarcado"*. Estava certo, e a causa era esta
           * linha: escalar devolvia `pulado` **sem perguntar nada**, e sem olhar caixa de seleção
           * nenhuma — nem a de automatizar, nem a de pular por etiqueta. O contato sumia da rodada
           * com o motivo só no log.
           *
           * A incoerência era com a própria tecla 6: as duas coisas significam *"aqui precisa de
           * gente"*, e a tecla 6 **abre a caixa** (é a exceção que a automação respeita). Escalar
           * fazia o oposto. Agora as duas fazem o mesmo.
           *
           * O rascunho, quando existe, já está no campo de mensagem — então ele decide olhando o
           * texto pronto, que era o laço manual que a IA veio encurtar.
           */
          const porque = rascunho.motivo ? ` · ${rascunho.motivo}` : '';
          const motivoIA = decisaoIA.motivo || 'a IA achou que este é para você';
          // Nome diferente do `sugestao` de fora DE PROPÓSITO: este bloco vive dentro do
          // `if (!sugestao)`, e sombrear a recomendação determinística aqui dentro é armadilha
          // esperando quem vier depois.
          const sugestaoDela = decisaoIA.templateId ? ` (sugestão dela: "${decisaoIA.templateId}")` : '';
          escalouParaVoce = `IA passou para você: ${motivoIA}${sugestaoDela}${porque}`;
          registrarNaRodada(nome, 'aviso', escalouParaVoce);
        }
      }

      const opcoes = [];
      if (podeEnviar) {
        opcoes.push({
          tecla: '1',
          valor: 'enviar',
          rotulo: enviadoHoje ? `Mandar de novo "${modelo.name}"` : `Mandar modelo "${modelo.name}"`,
        });
      }

      /**
       * **Tecla `a` — o modelo do anúncio E o pedido de dados, na mesma passada.**
       *
       * Escolha dele em 02/09/2026: *"o modelo seria uma resposta automática ao anúncio, o
       * atendimento vem depois disso que seria pedir dados e responder as perguntas"*, e "depois"
       * é **a mesma passada**, sabendo que são duas mensagens seguidas para o mesmo número.
       *
       * A oferta exige as **duas** metades prontas — o modelo resolvido e o texto do pedido sem
       * variável travada. Oferecer uma tecla que vai travar no meio do envio é pior que não
       * oferecer: a primeira mensagem já saiu e a segunda não sai mais.
       */
      /**
       * **A tecla `a` não depende mais do agradecimento**, porque não o manda.
       *
       * `podeEnviar` e `modeloTravado` são a trava do AGRADECIMENTO (ver onde `modeloTravado` é
       * calculado): a tecla 1 some quando aquele texto fica sem variável. Como a tecla `a` deixou
       * de mandá-lo (02/09/2026), continuar amarrada ali faria a opção desaparecer por causa de uma
       * mensagem que ela não envia — e o motivo na tela falaria de um texto que não está no caminho.
       */
      const podeModeloEDados = !!modelo && !!pedirDados && !pedirTrava;
      if (podeModeloEDados) {
        opcoes.push({
          tecla: 'a',
          valor: 'modelodados',
          rotulo: `Mandar "${modelo.name}" + ${pedirDados.name} e concluir`,
        });
      }
      /**
       * A recomendação da IA entra como tecla **0**, e não substituindo outra.
       *
       * Substituir o significado de uma tecla que ele já tem no dedo é como o "2" digitado na
       * conversa acabou concluindo atendimento. Tecla nova, posição nova, e as antigas seguem
       * fazendo o que sempre fizeram — com ou sem IA ligada.
       */
      const recomendada = decisaoIA?.acao === 'responder'
        ? state.templates.find((t) => t.id === decisaoIA.templateId)
        : null;
      const recomendadaTrava = recomendada
        ? vars.render(await templatesLib.varianteAtual(recomendada), contexto).missing.length > 0
        : false;

      if (recomendada && !recomendadaTrava) {
        opcoes.push({
          tecla: '0',
          valor: `ia:${recomendada.id}`,
          rotulo: `Mandar "${recomendada.name}" e concluir (IA)`,
          primaria: true,
        });
      }

      /**
       * **Tecla `f` — o desfecho que um ramo da ÁRVORE escolheu.**
       *
       * A tabela de regras só sabia apontar para uma das teclas fixas. A árvore que ele monta na
       * janela do fluxo pode dizer "neste caso manda ESTA resposta pronta" — foi o que o diagrama
       * dele pediu em "pediu ajuda financeira → mensagem pronta + concluir".
       *
       * Letra e não dígito, pelo mesmo motivo do `s`: os dez dígitos já têm significado no dedo
       * dele, e trocar o sentido de um é como o "2" digitado na conversa acabou concluindo
       * atendimento.
       */
      const doFluxo = sugestao?.resposta ? state.templates.find((tpl) => tpl.id === sugestao.resposta) : null;
      const doFluxoTrava = doFluxo
        ? vars.render(await templatesLib.varianteAtual(doFluxo), contexto).missing.length > 0
        : false;
      if (doFluxo && !doFluxoTrava) {
        opcoes.push({
          tecla: 'f',
          valor: `arvore:${doFluxo.id}`,
          rotulo: `Mandar "${doFluxo.name}" e concluir (fluxo)`,
        });
      }

      /**
       * O rótulo diz o que vai acontecer, e são três coisas diferentes: marcar agora, já estar
       * marcado, ou o pulo de sempre. Regra da rodada que depende de estado invisível parece
       * defeito — e aqui a diferença é uma escrita no CRM num caminho que normalmente não grava
       * nada.
       */
      const enderecoDela = await enderecoParaMaterial();
      const etiquetaEndereco = String(state.auto.cfg.etiquetaEndereco || '').trim();
      opcoes.push({
        tecla: '2',
        valor: 'pular',
        rotulo: !enderecoDela
          ? 'Pular (deixa aberto)'
          : enderecoDela.jaMarcada
            ? 'Pular (já marcado como material a enviar)'
            : etiquetaEndereco
              ? `Pular e marcar "${etiquetaEndereco}" (deixa aberto para transferir)`
              : 'Pular (mandou o endereço — etiqueta não configurada)',
      });
      opcoes.push({ tecla: '3', valor: 'concluir', rotulo: 'Concluir sem enviar' });
      /**
       * Tecla `s` — sem interesse. **Letra, não dígito**, porque os dez dígitos já têm significado
       * no dedo dele e trocar o sentido de um é como o "2" digitado na conversa acabou concluindo
       * atendimento.
       *
       * Existe sempre, não só quando a regra dispara: ele pode ver algo que a regra não viu, e a
       * opção precisa estar na lista para ele poder apertar.
       */
      opcoes.push({
        tecla: 's',
        valor: 'seminteresse',
        rotulo: etiquetaSemInteresse
          ? `Marcar "${etiquetaSemInteresse}" e concluir sem responder`
          : 'Concluir sem responder (etiqueta de sem interesse não configurada)',
      });
      if (!pedirTrava) {
        // Primária quando não há modelo a enviar: sem nome e sem cidade não há o que
        // classificar, então pedir os dados é a saída que faz o contato andar. Já pedido hoje
        // perde o destaque — repetir tem que ser decisão, não inércia.
        opcoes.push({
          tecla: '4',
          valor: 'pedirdados',
          rotulo: pedidoHoje
            ? 'Pedir dados DE NOVO e concluir'
            : pedidoDeEvento
              ? `${presenca === 'nao' ? 'Não vai ao evento' : 'Vai ao evento'} + pedir dados e concluir`
              : 'Pedir dados e concluir',
        });
      }
      if (!momentoTrava) {
        opcoes.push({ tecla: '5', valor: 'momento', rotulo: `${momento.name} e concluir` });
      }
      opcoes.push({ tecla: '6', valor: 'responder', rotulo: 'Responder à mão (retomo quando você concluir)' });
      if (podePerguntarInteresse) {
        opcoes.push({
          tecla: '7',
          valor: 'interesse',
          rotulo: interessePerguntado
            ? 'Perguntar interesse DE NOVO (já perguntei antes)'
            : 'Perguntar interesse + pedir nome e cidade, e concluir',
        });
      }
      /**
       * **Tecla `8` — a IA escreve, o texto fica no campo, e quem manda é você.**
       *
       * Pedido dele (03/09/2026), olhando a caixa: *"no botão 8 bote a opção chamar IA"* e, depois
       * de eu a pôr como uma opção A MAIS: *"era pra SUBSTITUIR o botão 8 com o chamar IA"*.
       *
       * **As duas trocaram de lugar, e nenhuma some.** O agradecimento foi para o `i`, que é o que
       * torna a troca segura: o agradecimento é o desfecho que `so-expressa-apoio` e a confirmação de
       * presença RECOMENDAM, e fazer a recomendação apontar para a IA pararia a rodada em cada
       * contato de apoio, esperando ele escrever. As regras continuam recomendando o agradecimento
       * — só que agora ele mora no `i` — e **nenhuma regra recomenda a IA**, que é como tem que
       * ser: chamar a IA é escolha dele, contato a contato.
       *
       * **É `rascunharParaEle`, que já existia e nunca envia** (`setComposerText`, nunca
       * `sendText`) — até 03/09 ela só era alcançada quando a IA ESCALAVA, e não havia como pedir
       * um rascunho de propósito. É o laço que ele fazia à mão (copiar a conversa para uma IA,
       * ler, ajustar, mandar) sem o copiar e colar.
       *
       * **O desfecho é o mesmo da tecla 6:** a rodada sai da frente e fica de vigia, retomando
       * quando ele concluir. Tem que ser — fechar a caixa e seguir para o próximo contato deixaria
       * o rascunho num campo de mensagem que ele não está mais olhando.
       *
       * **A caixa "Usar a avaliação por IA nesta rodada" NÃO governa esta tecla** — ele apertou a
       * opção e ela não estava lá (03/09/2026: *"agora eu queria testar a resposta e não posso"*).
       * Aquela caixa decide se a rodada gasta sozinha, contato a contato, e é por isso que ela
       * existe e nasce desligada. Apertar o `i` é o contrário disso: é ele pedindo UM rascunho,
       * de propósito, olhando aquela conversa. O que a tecla precisa é de chave cadastrada, e é
       * isso que ela pergunta. Sem chave, a opção não aparece e o 8 fica livre.
       */
      if (state.iaTemChave) {
        opcoes.push({
          tecla: '8',
          valor: 'rascunhar',
          rotulo: 'Chamar a IA: põe o rascunho no campo, sem mandar (retomo quando você concluir)',
        });
      }
      /**
       * **Tecla `i` — o agradecimento, que morava no 8 até 03/09/2026.**
       *
       * Trocou de lugar com a chamada da IA a pedido dele. **Letra e não dígito** é o que sobrou de
       * teclado livre — os dez dígitos já têm significado no dedo dele —, e é o mesmo caminho do
       * `s`, do `a` e do `f`. As regras (`so-expressa-apoio`, `respondeu-os-dados`) recomendam
       * esta tecla, e `sugestao.TECLAS` foi renomeada junto: é lá que a recomendação vira destaque.
       */
      if (!travaDoApoio) {
        opcoes.push({
          tecla: 'i',
          valor: 'apoio',
          // O rótulo diz qual dos dois vai sair — a tecla é a mesma, o texto não.
          rotulo: ehPresencaSemPendencia
            ? 'Agradecer a presença e concluir (sem pedir dados)'
            : 'Agradecer o apoio e concluir',
        });
      }
      /**
       * Tecla 9 — perguntar em que pode ajudar.
       *
       * **Não conclui**, ao contrário das outras que enviam texto: a resposta dela é o que decide
       * o caso, e concluir tiraria o contato da fila justamente antes de ela responder.
       */
      if (!perguntarAjudaTrava) {
        opcoes.push({ tecla: '9', valor: 'perguntarajuda', rotulo: 'Perguntar em que pode ajudar (deixa aberto)' });
      }

      // Um lugar só decide o destaque. Antes eram três expressões independentes, e duas podiam
      // acender ao mesmo tempo num contato que casasse com as duas condições.
      // Um lugar só decide o destaque, e ele conta os dois jeitos de uma regra apontar: pela
      // tecla (a tabela) e pela resposta pronta (um ramo da árvore, que traz `tecla` nula).
      for (const opcao of opcoes) {
        opcao.primaria =
          !!sugestao &&
          (ramoChamaIA
            ? opcao.tecla === '0'
            : sugestao.resposta
              ? opcao.tecla === 'f' && !!doFluxo
              : opcao.tecla === sugestao.tecla);
      }

      // Nenhuma regra reconheceu: o caso é para ele decidir hoje, e é o gatilho da IA no outro
      // branch. Marcado AQUI, onde a informação existe — não em cada `return` lá embaixo.
      if (!sugestao) {
        const ultimaDela = [...state.entrantes].reverse().find((m) => String(m?.texto || '').trim());
        state.auto.semRegra.set(sessionId, {
          nome,
          texto: String(ultimaDela?.texto || '').replace(/\s+/g, ' ').trim().slice(0, 120),
          tipo: ultimaDela?.tipo || '',
        });
      }

      /**
       * Manda a resposta que a IA escolheu e conclui — o corpo da tecla 0.
       *
       * **Isto faltava.** A tecla 0 existia, aparecia em destaque na caixa e devolvia
       * `ia:<id>`... que nenhum ramo tratava. A escolha caía no fim da função e mandava o
       * `modelo` do conteúdo, não a resposta que a IA escolheu — e quando não havia modelo,
       * quebrava. Bug de merge, do mesmo tipo que apagou `avaliarComIA`: a opção foi criada e o
       * ramo que a executa não veio junto.
       *
       * Envia com `sendTemplate`, não `enviarModelo`: a recomendação sai de `state.templates`,
       * que são as respostas prontas dele.
       */
      const enviarEscolhaDaIA = async (porQue) => {
        if (!(await saveClassification({ withCompletionDate: true, quiet: true }))) {
          return { nome, resultado: 'erro', motivo: 'a classificação não gravou; não enviei nada' };
        }
        if (!(await sendTemplate(recomendada, { send: true, jaConfirmado: true }))) {
          return { nome, resultado: 'erro', motivo: `"${recomendada.name}" (escolha da IA) não saiu` };
        }
        const fechouIA = await concluirPeloPainel();
        if (!fechouIA.ok) {
          return { nome, resultado: 'enviado', parar: true, motivo: `${porQue}, mas ${fechouIA.reason}` };
        }
        if (fechouIA.dialogOpen) {
          return {
            nome,
            resultado: 'enviado',
            parar: true,
            motivo: `${porQue}, mas a plataforma pediu um motivo de conclusão — responda o diálogo`,
          };
        }
        return { nome, resultado: 'enviado', motivo: porQue };
      };

      /**
       * A IA ASSUME a rodada — só com a caixa "Automatizar com IA" marcada por ele.
       *
       * Aqui a caixa de pergunta não chega a abrir: é a tecla 0 sendo apertada sozinha. A
       * fronteira do branch não se move — o que sai é uma resposta pronta que ele escreveu, e a
       * IA continua só escolhendo entre elas.
       *
       * **Três travas antes de enviar**, e as duas primeiras já vieram de graça:
       *  - `acao === 'responder'` (escalar e incerto nunca chegam aqui, e `validarDecisao` já
       *    rebaixou a confiança baixa e os RESTRITOS a `incerto`/escalada);
       *  - `!recomendadaTrava` — resposta com variável faltando não sai nem no manual;
       *  - a mesma resposta não pode ter saído HOJE para este contato. Esta é a que importa: a
       *    caixa de pergunta mostrava o aviso de duplicata e deixava ELE decidir; sem ninguém
       *    para ler o aviso, a decisão vira "não manda e pergunta".
       */
      if (rodadaAutomatica() && recomendada && !recomendadaTrava) {
        const jaSaiu = await templatesLib.wasSent(state.contact.id, recomendada.id);
        if (jaSaiu && ehHoje(jaSaiu.at)) {
          registrarNaRodada(
            nome,
            'aviso',
            `automático não assumiu: "${recomendada.name}" já saiu hoje às ${formatarHora(jaSaiu.at)} — decida você`
          );
        } else {
          const confianca = Math.round((decisaoIA.confianca || 0) * 100);
          return enviarEscolhaDaIA(
            `IA assumiu (${confianca}%): mandei "${recomendada.name}" e concluí — ` +
              (decisaoIA.motivo || 'sem motivo dado')
          );
        }
      }

      /**
       * A automação executa a RECOMENDAÇÃO DETERMINÍSTICA quando existe uma.
       *
       * Esta metade nasceu junto com a reordenação acima, e sem ela o conserto viraria um defeito
       * pior: com a regra decidindo antes, a IA deixa de ser chamada nos casos conhecidos, então
       * `recomendada` fica nula e a caixa abriria esperando um clique **em todo contato com
       * regra** — a rodada automatizada pararia em quase todos. Trocar "manda a mensagem errada"
       * por "não anda" não é conserto.
       *
       * O que sai daqui é a tecla que a caixa mostraria em destaque, escolhida pelas regras que
       * ele escreveu — não uma decisão nova. É o que "automatizar a rodada" sempre significou.
       *
       * **A tecla 6 fica de fora, e é a única exceção:** "Responder à mão" quer dizer, por
       * definição, que alguém precisa escrever. Automatizá-la seria concluir sem responder.
       */
      let escolhaAutomatica = null;
      // Ramo que entregou o caso para a IA não passa por aqui: a tecla dele vem nula, e esta
      // automação diria "tecla não disponível" e pararia a rodada em todo contato desses. Quem o
      // executa é a automação da IA, algumas linhas acima — a mesma de sempre.
      if (rodadaAutomatica() && sugestao && !ramoChamaIA) {
        // Ramo da árvore com resposta pronta aponta para a tecla `f`, que não é a `sugestao.tecla`
        // (essa vem nula). Sem esta linha o automático diria "tecla não disponível" e pararia em
        // todo contato que caísse num ramo desses — o mesmo "trocar mensagem errada por não anda".
        const alvo = opcoes.find((o) => (sugestao.resposta ? o.tecla === 'f' : o.tecla === sugestao.tecla));
        if (!alvo) {
          // A regra recomendou uma tecla que não está na lista (travada por variável faltando,
          // por exemplo). Cai na caixa, com o motivo no log — silêncio aqui viraria "a rodada
          // ignorou a regra" sem ninguém conseguir dizer por quê.
          registrarNaRodada(nome, 'aviso', `o fluxo pediu ${sugestao.resposta ? `a resposta "${sugestao.resposta}"` : `a tecla ${sugestaoLib.mostrarTecla(sugestao.tecla)}`} ("${sugestao.id}"), que não está disponível agora — decida você`);
        } else if (sugestao.tecla === '6') {
          registrarNaRodada(nome, 'aviso', `regra "${sugestao.id}": ${sugestao.motivo} — precisa de você`);
        } else {
          /**
           * **O EMPATE vai para o log junto** — escolha dele (04/09/2026), quando pediu que o fluxo
           * trabalhasse por condições e exceções: *"a de cima ganha, e o quadro acusa"*.
           *
           * Medido antes de existir: em 85% dos contextos sorteados **mais de uma caixa mandaria
           * mensagem**, e quem escolhia era a altura. O empate era invisível porque a rodada só
           * mostra quem venceu; aqui ele aparece com o nome de quem perdeu, no atendimento em que
           * aconteceu de verdade.
           */
          const empate = (sugestao.empate || []).length
            ? ` — empate com: ${sugestao.empate.join('; ')} (ganhou por estar mais acima)`
            : '';
          registrarNaRodada(nome, 'aviso', `automático pelo fluxo ("${sugestao.id}"${sugestao.caminho ? `, caminho ${sugestao.caminho.join(' > ')}` : ''}): ${alvo.rotulo}${empate}`);
          escolhaAutomatica = alvo.valor;
        }
      }

      // `??` e não `||`: a escolha automática é sempre uma string não vazia, mas usar `||` aqui
      // ensinaria o padrão errado para a próxima opção cujo valor possa ser falsy.
      const escolha = escolhaAutomatica ?? await perguntarNaRodada({
        titulo: nome,
        recomendacao: sugestao,
        // A falta de recomendação é o sinal de "isto é para a IA" (pedido dele, 31/08): sem
        // etiqueta nova, sem tecla nova — a própria ausência de regra é o que marca o caso.
        semRegra: !sugestao,
        // O passo manual dele quando a resposta tem que ser escrita: copiar a conversa e colar
        // numa IA. Aqui vira um clique — sem sair da caixa e sem parar a rodada.
        copiarConversa: state.entrantes,
        linhas: [
          valueNamed('Cidade')
            ? ['Cidade: ', ...cidadeMarcada(), cidadeSubstituida()]
            : 'Cidade: (vazia)',
          `Etiquetas: ${etiquetas.join(', ') || '(nenhuma)'}`,
          /**
           * **Quando ela falou pela última vez** — pedido dele (04/09), com a print da Isaura: a
           * caixa recomendava a mensagem do momento por um "Bom dia" do dia anterior, e nada na
           * tela dizia isso.
           *
           * Fica no alto, junto de cidade e etiquetas, porque é retrato do contato e não aviso:
           * ele lê essas três linhas antes de olhar as opções.
           */
          (() => {
            const ultimaDela = [...(state.entrantes || [])].reverse().find((m) => m?.at);
            if (!ultimaDela) return '';
            const quando = quandoFoi(ultimaDela.at);
            return quando ? `Última mensagem dela: ${quando}` : '';
          })(),
          // O que ela respondeu sobre o evento, quando respondeu: é o que explica por que a
          // tecla 4 mudou de nome, e sem isso a troca de texto seria invisível.
          presenca
            ? `Sobre o evento: ela disse que ${presenca === 'nao' ? 'NÃO vai' : 'VAI'}`
            : '',
          modelo
            ? `Conteúdo pedido: ${conteudoEscolhido.nome}` +
              (desempatado ? ` (casou com ${conteudos.length}, escolhi o preferido)` : '')
            : `Sem modelo: ${semModelo}`,
          // Quem trava é o AGRADECIMENTO, não o modelo — dizer "modelo travado" mandava ele
          // procurar o problema no lugar errado. A tecla `a` continua na lista porque não o manda.
          modeloTravado ? `Tecla 1 fora: o agradecimento não sai — ${modeloTravado}` : '',
          enviadoHoje
            ? `⚠ "${modelo.name}" JÁ FOI ENVIADO hoje, às ${formatarHora(jaEnviado.at)}` +
              (jaEnviado.nome ? ` (para ${jaEnviado.nome})` : '') +
              '. Confirme antes de mandar de novo.'
            : '',
          textosDeHoje.length ? `⚠ Hoje este contato já recebeu: ${textosDeHoje.join(', ')}.` : '',
          // O que a IA achou, e com quanta certeza. Vai para a tela SEMPRE que ela opinou —
          // recomendação sem o porquê é ordem, e quem responde pelo envio é ele.
          recomendada && !recomendadaTrava
            ? `IA (${Math.round((decisaoIA.confianca || 0) * 100)}%): ${decisaoIA.motivo || 'sem motivo dado'}`
            : '',
          recomendada && recomendadaTrava
            ? `A IA sugeriu "${recomendada.name}", mas essa resposta está travada por variável faltando.`
            : '',
          decisaoIA?.acao === 'incerto' && decisaoIA.aviso ? `IA não opinou: ${decisaoIA.aviso}` : '',
          // A IA escalou: nenhuma resposta pronta serve. Antes isto pulava o contato em silêncio.
          escalouParaVoce ? `⚠ ${escalouParaVoce}` : '',
          pedidoHoje
            ? `⚠ Já pedi os dados hoje, às ${formatarHora(pedidoDeHoje.at)}. Pedir de novo no ` +
              'mesmo dia soa a robô — o texto muda (são três variações que se revezam), o pedido não.'
            : '',
          // Por que este contato parou a rodada em vez de ser concluído: é a diferença que ele
          // precisa ver na tela, senão vira "alguns concluem e outros não" de novo.
          decisao?.acao === 'perguntar'
            ? `⚠ ${decisao.motivo} (${formatarQuando(ultima.at)}). Ele nunca voltou — por isso ` +
              'parei aqui em vez de concluir.'
            : '',
          decisao?.acao === 'perguntar' && state.session?.expired
            ? 'A janela de 24h venceu: texto livre não chega mais neste contato, só modelo aprovado.'
            : '',
          interessePerguntado
            ? `Já perguntei o interesse ${formatarQuando(interessePerguntado.at)}.` +
              (etiquetasInteresse.length ? ' A resposta não foi reconhecida como "sim".' : '')
            : '',
          podePerguntarInteresse && !etiquetasInteresse.length
            ? 'A tecla 7 pergunta o interesse, mas o "sim" ainda não vira etiqueta: preencha ' +
              '"Etiquetas quando responder sim" na aba Config.'
            : '',
        ].filter(Boolean),
        // As respostas prontas viajam junto: elas são o que faltava para resolver um contato
        // sem sair da rodada.
        respostas: state.templates.map((t) => {
          const { missing, reasons } = vars.render(t.text, contexto);
          return {
            nome: t.name,
            bloqueio: missing.length ? vars.explainMissing(missing, reasons) : '',
            enviar: () => sendTemplate(t, { send: true, jaConfirmado: true }),
          };
        }),
        /**
         * **O título descreve a SITUAÇÃO, não uma das teclas.**
         *
         * Ele dizia *"Enviar o modelo X + agradecimento e concluir?"* — a frase da tecla 1, num
         * título que encima dez opções. Com a tecla `a` na lista (modelo + pedir dados), o título
         * prometia agradecimento e a opção prometia pedido de dados: duas frases sobre o mesmo
         * contato, discordando. Foi assim que ele viu o defeito (02/09/2026).
         *
         * Cada opção já diz exatamente o que faz. O título só precisa dizer onde estamos.
         */
        pergunta: modelo
          ? `Modelo "${modelo.name}" disponível para este contato. O que fazer?`
          : 'Não há modelo de conteúdo para este contato. O que fazer?',
        opcoes,
      });

      if (escolha === 'parar') {
        return { nome, resultado: 'pulado', parar: true, motivo: 'você parou a rodada' };
      }

      /**
       * Pular **não escreve nada no CRM**, e essa é a razão de ele existir.
       *
       * Pedido dele (31/08): *"ao pular tem gravado dados no crm o que faz eu perder tempo com
       * esses contatos que eram pra ser pulados rapidamente"*. Está certo — gravar custava, por
       * contato pulado, uma escrita por campo mais uma de etiquetas, e podia abrir a pergunta de
       * cidade, que é a espera mais longa que existe no meio de uma gravação.
       *
       * **E gravava a "Data de conclusão do contato" num atendimento que fica ABERTO** — marcava
       * como tratado quem foi deixado para depois, que é o oposto do que pular quer dizer.
       *
       * Nada se perde: o parser reconstrói tudo na próxima vez que o contato abrir. O que ele
       * gravava era palpite que ninguém tinha confirmado ainda.
       *
       * **Uma exceção, criada em 04/09/2026: a etiqueta de quem mandou o ENDEREÇO.** Ela é o que
       * torna a lista de material utilizável, e é uma escrita só — sem campo, sem data de
       * conclusão e sem a pergunta de cidade, que era o que custava caro aqui.
       */
      if (escolha === 'pular') {
        const dela = await enderecoParaMaterial();
        if (dela) {
          /**
           * **Já marcado, nada é escrito** — a etiqueta que faz pular já está lá, e reaplicar seria
           * uma requisição por passada num contato que fica na fila até ele transferir.
           *
           * Marcar vale também quando é ELE que aperta a tecla: a situação é a mesma, e gravar só
           * no automático faria a marca depender de quem apertou.
           */
          const aviso = dela.jaMarcada ? '' : await etiquetarEndereco(state.contact);
          return { nome, resultado: 'pulado', motivo: `${dela.motivo} — pulei para você transferir${aviso}` };
        }
        return { nome, resultado: 'pulado', motivo: 'você pulou — nada gravado, atendimento aberto' };
      }

      /**
       * Tecla 8: a IA rascunha, o texto fica no campo, e a rodada fica de vigia como na 6.
       *
       * **Rascunhar primeiro, gravar depois:** o que ele espera ver na tela é o texto, e a gravação
       * não muda nada do que a IA lê (o rascunho usa o cadastro em memória, não o gravado).
       *
       * **Falhou o rascunho? A rodada continua no mesmo desfecho**, com o motivo no log. Ele pediu
       * o caso para si ao apertar a tecla; devolvê-lo à fila por causa de uma conveniência que não
       * saiu seria trocar um problema por outro — é a mesma disciplina do rascunho da escalada,
       * que nunca para a rodada.
       */
      if (escolha === 'rascunhar') {
        setStatus('Escrevendo o rascunho…');
        let r = { ok: false, motivo: '' };
        try {
          r = await rascunharParaEle();
        } catch (err) {
          r = { ok: false, motivo: `falhou: ${err?.message || err}` };
        }
        // `rascunharParaEle` já escreve a linha do SUCESSO (com os avisos da revisão junto);
        // aqui só entra o que deu errado, senão a mesma coisa apareceria duas vezes no log.
        if (!r.ok) registrarNaRodada(nome, 'aviso', `não consegui rascunhar (${r.motivo}) — o caso ficou com você`);
        await saveClassification({ withCompletionDate: true, quiet: true });
        return esperarVoceConcluir(sessionId, nome);
      }

      // Tecla 6: a rodada sai da frente e fica de vigia. Você responde à mão no atendimento que
      // já está aberto; quando concluir, ela retoma sozinha do próximo.
      if (escolha === 'responder') {
        await saveClassification({ withCompletionDate: true, quiet: true });
        return esperarVoceConcluir(sessionId, nome);
      }

      // Um texto só e fecha. Conta como envio: é mensagem para gente real, então entra no
      // limite e na pausa da rodada como qualquer outra.
      //
      // A pergunta de interesse entra aqui pelo mesmo caminho: concluir tira da fila, e quando
      // a pessoa responder a plataforma devolve o atendimento para "Meus" sozinha — é lá que o
      // "sim" vira etiqueta, na passada seguinte.
      /**
       * Tecla 9: manda a pergunta e **deixa o atendimento aberto**.
       *
       * Todas as outras teclas que enviam texto concluem. Esta não: o caso só se resolve com a
       * resposta dela, e concluir tiraria o contato da fila exatamente antes disso.
       */
      if (escolha === 'perguntarajuda') {
        await saveClassification({ withCompletionDate: true, quiet: true });
        if (!(await sendTemplate(perguntarAjuda, { send: true, jaConfirmado: true }))) {
          return { nome, resultado: 'erro', motivo: 'a pergunta não saiu' };
        }
        return {
          nome,
          resultado: 'enviado',
          motivo: 'perguntei em que posso ajudar — atendimento aberto, esperando a resposta dela',
        };
      }

      /**
       * **Tecla `f`: manda a resposta pronta que o ramo da árvore escolheu, e conclui.**
       *
       * O ramo entra no MESMO commit da opção, de propósito — foi assim que a tecla 0 mandou o
       * modelo errado para eleitor: a opção existia, devolvia um valor e nenhum `if` o tratava,
       * então a escolha caía no fim da função e enviava outra coisa.
       */
      if (typeof escolha === 'string' && escolha.startsWith('arvore:') && doFluxo) {
        if (!(await saveClassification({ withCompletionDate: true, quiet: true }))) {
          return { nome, resultado: 'erro', motivo: 'a classificação não gravou; não enviei nada' };
        }
        if (!(await sendTemplate(doFluxo, { send: true, jaConfirmado: true }))) {
          return { nome, resultado: 'erro', motivo: `"${doFluxo.name}" (ramo do fluxo) não saiu` };
        }
        // Pedido de endereço não conclui: o caso vai para a lista de material, aberto.
        if (await vaiPedirEndereco(doFluxo)) {
          return {
            nome,
            resultado: 'enviado',
            motivo: `mandei "${doFluxo.name}" — pedido de endereço, deixei o atendimento ABERTO para você transferir`,
          };
        }
        const fechouFluxo = await concluirPeloPainel();
        if (!fechouFluxo.ok) {
          return { nome, resultado: 'enviado', parar: true, motivo: `"${doFluxo.name}" saiu, mas ${fechouFluxo.reason}` };
        }
        return { nome, resultado: 'enviado', motivo: `mandei "${doFluxo.name}" (ramo do fluxo) e concluí` };
      }

      // Tecla 0 apertada à mão: mesmo caminho do automático, sem o automático.
      if (typeof escolha === 'string' && escolha.startsWith('ia:') && recomendada) {
        return enviarEscolhaDaIA(`mandei "${recomendada.name}" (escolha da IA) e concluí`);
      }

      if (escolha === 'pedirdados' || escolha === 'momento' || escolha === 'interesse' || escolha === 'apoio') {
        const texto =
          escolha === 'pedirdados'
            ? pedirDados
            : escolha === 'momento'
              ? momento
              : escolha === 'apoio'
                ? textoDoApoio
                : interesse;
        const rotulo =
          escolha === 'pedirdados'
            ? 'pedi os dados'
            : escolha === 'momento'
              ? 'mensagem do momento enviada'
              : escolha === 'apoio'
                ? ehPresencaSemPendencia
                  ? 'agradeci a presença no evento (sem pedir dados)'
                  : 'agradeci o apoio'
                : 'perguntei o interesse no conteúdo';

        await saveClassification({ withCompletionDate: true, quiet: true });
        if (!(await sendTemplate(texto, { send: true, jaConfirmado: true }))) {
          return { nome, resultado: 'erro', motivo: `${texto.name} não saiu` };
        }
        const fechouTexto = await concluirPeloPainel();
        if (!fechouTexto.ok) {
          return { nome, resultado: 'enviado', parar: true, motivo: `${rotulo}, mas ${fechouTexto.reason}` };
        }
        if (fechouTexto.dialogOpen) {
          return {
            nome,
            resultado: 'enviado',
            parar: true,
            motivo: `${rotulo}, mas a plataforma pediu um motivo de conclusão — responda o diálogo`,
          };
        }
        return { nome, resultado: 'enviado', motivo: `${rotulo} e concluído` };
      }

      /**
       * Sem interesse: marca a etiqueta e conclui **sem enviar nada**.
       *
       * Pedido dele (01/09/2026). A ordem importa: a etiqueta entra na lista de gravação ANTES do
       * `saveClassification`, senão ela não é escrita — quem grava é ele, a partir de
       * `state.tagSuggestions`.
       *
       * **Falha de etiqueta não impede a conclusão**, que é a regra do projeto (etiqueta é
       * organização interna; o que o contato recebe — ou deixa de receber — vem primeiro). Se a
       * etiqueta não existir no CRM, o contato é concluído do mesmo jeito e o motivo vai para o
       * log, onde dá para conferir depois.
       */
      if (escolha === 'seminteresse') {
        let avisoEtiqueta = '';
        if (etiquetaSemInteresse) {
          const tag = await tagsLib.resolveTag(etiquetaSemInteresse);
          if (tag) {
            const jaTem = (state.contact.tagsId || []).includes(tag.id);
            if (!jaTem) {
              state.tagSuggestions.push({
                origem: 'revisão',
                nome: etiquetaSemInteresse,
                tag,
                motivo: 'recusou ou veio hostilizar — marcado como sem interesse',
                marcada: true,
              });
            }
          } else {
            avisoEtiqueta = ` (a etiqueta "${etiquetaSemInteresse}" não existe no CRM — não marquei)`;
          }
        } else {
          avisoEtiqueta = ' (sem etiqueta configurada na aba Automatizado)';
        }

        await saveClassification({ withCompletionDate: true, quiet: true });
        const fechouSI = await concluirPeloPainel();
        if (!fechouSI.ok) {
          return { nome, resultado: 'pulado', motivo: `marquei sem interesse, mas ${fechouSI.reason}` };
        }
        if (fechouSI.dialogOpen) {
          return { nome, resultado: 'concluido', parar: true, motivo: 'a plataforma pediu um motivo de conclusão — responda o diálogo' };
        }
        return { nome, resultado: 'concluido', motivo: `sem interesse: concluí sem responder${avisoEtiqueta}` };
      }

      if (escolha === 'concluir') {
        await saveClassification({ withCompletionDate: true, quiet: true });
        const fechou = await concluirPeloPainel();
        if (!fechou.ok) {
          return { nome, resultado: 'pulado', motivo: `você mandou concluir, mas ${fechou.reason}` };
        }
        if (fechou.dialogOpen) {
          return {
            nome,
            resultado: 'concluido',
            parar: true,
            motivo: 'a plataforma pediu um motivo de conclusão — responda o diálogo',
          };
        }
        return { nome, resultado: 'concluido', motivo: 'concluído sem enviar, a seu pedido' };
      }

      if (!(await saveClassification({ withCompletionDate: true, quiet: true }))) {
        return { nome, resultado: 'erro', motivo: 'a classificação não gravou; não enviei nada' };
      }

      if (!(await enviarModelo(modelo, { send: true, jaConfirmado: true }))) {
        return { nome, resultado: 'erro', motivo: `o modelo "${modelo.name}" não saiu` };
      }

      /**
       * **O rodízio do modelo padrão anda AQUI, e não na decisão.**
       *
       * Mesma separação de `templates.varianteAtual` / `avancarVariante`, e pela mesma razão: a
       * caixa da rodada mostra o nome do modelo antes de o envio acontecer, e queimar o rodízio ali
       * faria o próximo pular sozinho em todo contato que ele decidisse não mandar.
       *
       * Só o padrão gira. O modelo específico de um anúncio é escolha dele para aquele anúncio, e
       * não tem rodízio nenhum.
       */
      if (escolhaDeModelo?.deOnde === 'padrao' && Number.isInteger(escolhaDeModelo.proximo)) {
        await store.set('modeloPadraoIndex', escolhaDeModelo.proximo);
      }

      /**
       * **A tecla `a` continua daqui: o pedido de dados vai atrás do modelo.**
       *
       * A ordem é essa e não a inversa: o modelo é o recibo do anúncio, e recibo depois da pergunta
       * fica estranho. O modelo já saiu na linha acima — as duas teclas compartilham esse envio de
       * propósito, para não haver duas maneiras de mandar a mesma coisa.
       *
       * **Se a segunda mensagem falhar, o resultado é `enviado` e a rodada PARA.** Contar como
       * enviado é a verdade (o modelo saiu) e parar é o certo: o contato ficou com o recibo e sem o
       * pedido, e seguir a fila esconderia isso. O motivo diz exatamente onde parou.
       */
      if (escolha === 'modelodados') {
        if (!(await sendTemplate(pedirDados, { send: true, jaConfirmado: true }))) {
          return {
            nome,
            resultado: 'enviado',
            parar: true,
            motivo: `o modelo "${modelo.name}" saiu, mas "${pedirDados.name}" não — este contato ficou sem o pedido de dados`,
          };
        }
        registrarNaRodada(nome, 'info', `recibo do anúncio + pedido de dados ("${pedirDados.name}")`);
      }

      /**
       * **O agradecimento NÃO vai atrás do pedido de dados.**
       *
       * Relato dele (02/09/2026), com a print da caixa: *"botão a totalmente errado mandando modelo
       * + pedindo dados + agradecendo e concluindo, não existe agradecer depois de pedir dados"*.
       *
       * Ele está certo, e o texto mostra o tamanho do erro: o agradecimento é *"Obrigado pela
       * atenção! Qualquer coisa, é só chamar por aqui. Um abraço"* — um ENCERRAMENTO. Sair logo
       * depois de perguntar o nome e a cidade fecha a conversa que a pergunta acabou de abrir, e a
       * pessoa lê "não precisa responder".
       *
       * Era sobra do desenho antigo, quando a tecla 1 era "modelo + agradecimento" e a tecla `a`
       * ainda não existia. Quando o pedido de dados entrou no meio, o encerramento ficou depois
       * dele sem ninguém reparar.
       *
       * A tecla 1 continua mandando o agradecimento: lá o modelo é a entrega e o encerramento
       * fecha o atendimento, que é o que ele sempre fez.
       */
      if (escolha !== 'modelodados' && agradecimento && !(await sendTemplate(agradecimento, { send: true, jaConfirmado: true }))) {
        return { nome, resultado: 'erro', motivo: 'o modelo saiu mas o agradecimento não' };
      }

      /**
       * **Pedido de endereço NÃO conclui o atendimento** — relato dele (04/09/2026): *"pedi o
       * endereço pelo modelo e não etiquetou e concluiu"*.
       *
       * É a mesma regra que ele deu para o caso de material: *"a pessoa deve ser pulada e não
       * concluída, pois vou transferir pro responsável a conversa no final"*. Concluir aqui é pior
       * que nos outros casos — a conversa acabou de fazer uma pergunta, e fechar diz "não precisa
       * responder" para quem está prestes a mandar o endereço.
       *
       * A etiqueta já foi aplicada no envio (ver `sendTemplate`); o que falta é não fechar.
       */
      if (await vaiPedirEndereco(modelo)) {
        return {
          nome,
          resultado: 'enviado',
          motivo: `mandei "${modelo.name}" — pedido de endereço, deixei o atendimento ABERTO para você transferir`,
        };
      }

      const concluido = await concluirPeloPainel();
      if (!concluido.ok) {
        // Enviado mas nao fechou: parar e dizer. Contar como concluido faria a fila crescer
        // em silencio, que foi o sintoma de "Meus" so aumentando.
        return { nome, resultado: "enviado", parar: true, motivo: concluido.reason };
      }
      if (concluido.dialogOpen) {
        return {
          nome,
          resultado: 'enviado',
          parar: true,
          motivo: 'enviado, mas a plataforma pediu motivo de conclusão — responda o diálogo',
        };
      }
      return { nome, resultado: 'enviado' };
    } catch (err) {
      await page.closeOverlay().catch(() => {});
      return { nome, resultado: 'erro', motivo: traduzirErroDeRede(err.message) };
    }
  }

  /**
   * Pergunta de várias saídas, com atalho de teclado, dentro do shadow root do painel.
   *
   * `confirm()` nativo só tem duas opções e não aceita atalho — e aqui são três mais o Esc.
   *
   * O foco **precisa** vir para cá ao abrir: o campo de mensagem da plataforma está logo atrás,
   * e sem isso teclar "1" escreveria "1" na conversa do contato. Pelo mesmo motivo as teclas
   * tratadas são capturadas e param aqui.
   *
   * `respostas` são as respostas prontas, disponíveis **sem sair da pergunta**. Antes elas só
   * existiam na aba Respostas, e a pergunta é uma cortina `position: fixed` por cima do painel
   * inteiro: durante a rodada não havia como mandar uma resposta pronta — o jeito era parar a
   * rodada ou ir de tecla 6 e escrever à mão. Mandar uma resposta daqui **não fecha a
   * pergunta**: você manda e continua decidindo o que fazer com o atendimento.
   *
   * @returns {Promise<string>} o `valor` da opção escolhida, ou 'parar' no Esc
   */
  function perguntarNaRodada({ titulo, linhas = [], pergunta, opcoes, respostas = [], recomendacao = null, semRegra = false, copiarConversa = null, dica = 'Esc para parar a rodada' }) {
    // `fechar` sai daqui de dentro para virar `promessa.cancelar`: caixa que ficou na tela
    // depois de o contato mudar tem que poder ser tirada de fora. Ver `cancelarPerguntaDeCidade`.
    let fecharDeFora = null;
    const promessa = new Promise((resolve) => {
      const caixa = h('div', { class: 'wf-pergunta' });
      const fundo = h('div', { class: 'wf-pergunta-fundo' }, [caixa]);

      const barra = h('div', { class: 'wf-pergunta-titulo' }, titulo);
      caixa.append(barra);
      tornarArrastavel(caixa, barra);

      // A recomendação vai EM CIMA de tudo (pedido dele): é a primeira coisa a ser lida, antes
      // dos dados do contato e das opções. O destaque na tecla continua, mas sozinho ele não
      // dizia POR QUE aquela era a sugerida — e o porquê é o que deixa discordar dela.
      if (recomendacao) {
        /**
         * **Vermelho** — pedido dele (02/09/2026): *"marque a sugestão e o botão referente da
         * sugestão de vermelho para se destacar"*.
         *
         * A faixa e o botão usam a mesma cor de propósito: são a mesma informação dita duas vezes,
         * e cores diferentes fariam procurar qual das duas é a sugestão de verdade.
         */
        caixa.append(
          h('div', { class: 'wf-pergunta-recomendada wf-rec' }, `Sugiro a ${sugestaoLib.mostrarTecla(recomendacao.tecla)}: ${recomendacao.motivo}`)
        );
      } else if (semRegra) {
        /**
         * Nenhuma regra reconheceu este caso — e isso é INFORMAÇÃO, não ausência dela.
         *
         * Pedido dele (31/08): *"terá que reconhecer isso pela falta de opções"*, recusando a
         * ideia anterior de marcar esses contatos com uma etiqueta. Está certo: a falta de
         * recomendação já é o sinal, e etiqueta nova seria um rótulo a mais na base para dizer
         * o que o próprio painel já sabe.
         *
         * Antes disto a caixa ficava calada nesses casos, e "a rodada não sugeriu nada" não se
         * distinguia de "a rodada não olhou". É exatamente esta faixa que a IA vai substituir:
         * no branch `claude/whatsfill-ia`, `sugestao === null` é o gatilho da avaliação, e o
         * lugar dela na tela é aqui.
         */
        caixa.append(
          h(
            'div',
            { class: 'wf-pergunta-recomendada wf-pergunta-semregra' },
            'Nenhuma regra reconheceu este caso — a decisão é sua.'
          )
        );
      }
      // Linha pode ser texto ou lista de nós — é o que deixa a cidade sair em marca-texto.
      // Linha de aviso (começa com ⚠) sai destacada: ela existe justamente para ser notada
      // antes de a tecla ser apertada, e cinza-claro como as outras ela passa batido.
      for (const linha of linhas) {
        const aviso = typeof linha === 'string' && linha.startsWith('⚠');
        caixa.append(h('div', { class: `wf-pergunta-linha${aviso ? ' wf-pergunta-aviso' : ''}` }, linha));
      }
      if (pergunta) caixa.append(h('div', { class: 'wf-pergunta-corpo' }, pergunta));

      const botoes = [];
      const linhaBotoes = h('div', { class: 'wf-pergunta-botoes' });
      for (const opcao of opcoes) {
        /**
         * O botão da sugestão sai em VERMELHO, e só ele. `wf-rec` em vez de `wf-primary` porque
         * `wf-primary` é o botão de ação padrão do painel inteiro — repintá-lo tornaria vermelho o
         * "Aceitar" do popup de cidade e o "Começar pelos Meus", que não são sugestão nenhuma.
         */
        const ehSugestao = !!opcao.primaria && !!recomendacao;
        const btn = h(
          'button',
          { class: `wf-btn ${ehSugestao ? 'wf-rec-btn' : opcao.primaria ? 'wf-primary' : ''}`, type: 'button' },
          `${sugestaoLib.mostrarTecla(opcao.tecla)}  ${opcao.rotulo}`
        );
        btn.addEventListener('click', () => fechar(opcao.valor));
        botoes.push(btn);
        linhaBotoes.append(btn);
      }
      caixa.append(linhaBotoes);
      if (copiarConversa?.length) caixa.append(montarCopiarConversa(copiarConversa, titulo));
      if (respostas.length) caixa.append(montarRespostasRapidas(respostas));
      caixa.append(montarObservacao(titulo, recomendacao, linhas));
      caixa.append(h('div', { class: 'wf-pergunta-dica' }, dica));

      function aoTeclar(ev) {
        // Você está digitando na conversa: o "2" é um dois, não a tecla Pular.
        //
        // Antes a camada da pergunta bloqueava a página inteira e não havia como estar
        // digitando em lugar nenhum. Agora que a conversa é clicável (para você ler e responder
        // sem parar a rodada), o atalho tem que sair da frente de quem está escrevendo — senão
        // o número vai para a decisão e o atendimento fecha no meio de uma frase.
        if (ehCampoDeTexto(ev.composedPath?.()[0] || ev.target)) return;

        // A caixa mostra a letra em MAIÚSCULA (ver `sugestao.mostrarTecla`), então o Shift junto
        // tem que valer: caixa que ensina uma tecla e recusa o jeito óbvio de apertá-la é pior
        // que caixa sem atalho. As teclas em si continuam minúsculas — o que muda é só a leitura.
        const apertada = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
        const opcao = opcoes.find((o) => o.tecla === apertada);
        if (!opcao && ev.key !== 'Escape') return;
        ev.preventDefault();
        ev.stopPropagation();
        fechar(opcao ? opcao.valor : 'parar');
      }

      function fechar(valor) {
        document.removeEventListener('keydown', aoTeclar, true);
        fundo.remove();
        resolve(valor);
      }
      fecharDeFora = fechar;

      // Captura no documento: o shadow root não recebe tecla quando o foco está na página.
      document.addEventListener('keydown', aoTeclar, true);
      destinoDaCaixa().append(fundo);
      // De novo agora que a caixa está na tela: fora do DOM ela não tem altura, e o limite de
      // "não sair da janela" sairia calculado por estimativa.
      aplicarPosicao(caixa, state.settings.perguntaPos);
      botoes[0]?.focus();
    });

    promessa.cancelar = (valor) => fecharDeFora?.(valor);
    return promessa;
  }

  /** Campo onde alguém digita: input, textarea ou qualquer coisa editável (o composer é um). */
  function ehCampoDeTexto(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = String(el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true;
  }

  /**
   * Deixa a caixa de pergunta ser arrastada pelo título, e lembra onde você a largou.
   *
   * A pergunta nasceu presa no centro da tela, em cima da conversa — e a decisão que ela pede
   * (mandar modelo? agradecer? pular?) depende de ler o que a pessoa escreveu. Arrastar uma vez
   * resolve para a rodada inteira: a posição fica no `settings`, então vale também para os
   * próximos contatos e para as próximas rodadas.
   *
   * `setPointerCapture` em vez de ouvir o documento: o ponteiro continua sendo desta alça mesmo
   * quando o cursor passa por cima do iframe/conversa da plataforma, que é onde um listener no
   * documento perderia o `pointermove` e a caixa "grudaria" no meio do arrasto.
   */
  function tornarArrastavel(caixa, alca, chavePos = 'perguntaPos') {
    aplicarPosicao(caixa, state.settings[chavePos]);

    let arrasto = null;

    alca.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const r = caixa.getBoundingClientRect();
      // Fixa a posição atual ANTES de mexer: até aqui ela vinha do flex, sem left/top nenhum.
      arrasto = { dx: ev.clientX - r.left, dy: ev.clientY - r.top };
      aplicarPosicao(caixa, { left: r.left, top: r.top });
      alca.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });

    alca.addEventListener('pointermove', (ev) => {
      if (!arrasto) return;
      aplicarPosicao(caixa, { left: ev.clientX - arrasto.dx, top: ev.clientY - arrasto.dy });
    });

    const soltar = (ev) => {
      if (!arrasto) return;
      arrasto = null;
      if (alca.hasPointerCapture?.(ev.pointerId)) alca.releasePointerCapture(ev.pointerId);
      const r = caixa.getBoundingClientRect();
      const pos = { left: Math.round(r.left), top: Math.round(r.top) };
      state.settings[chavePos] = pos;
      // Grava relendo o storage: a Config mexe no mesmo objeto por outro caminho.
      salvarAjuste({ [chavePos]: pos }).catch(() => {});
    };
    alca.addEventListener('pointerup', soltar);
    alca.addEventListener('pointercancel', soltar);
  }

  /**
   * Posiciona a caixa, sempre dentro da tela.
   *
   * O limite não é enfeite: monitor desconectado, janela redimensionada ou um arrasto até a
   * borda deixariam a pergunta fora da vista — e ela é modal para a rodada, então uma pergunta
   * invisível trava o trabalho sem dizer por quê. Mesma lição do `sanitize()` das janelas.
   */
  function aplicarPosicao(caixa, pos) {
    if (!pos || !Number.isFinite(pos.left) || !Number.isFinite(pos.top)) {
      caixa.classList.remove('wf-pergunta-solta');
      caixa.style.left = '';
      caixa.style.top = '';
      // Centrada, quem limita é o CSS (`max-height: calc(100vh - 32px)`).
      caixa.style.maxHeight = '';
      return;
    }
    caixa.classList.add('wf-pergunta-solta');
    const largura = caixa.offsetWidth || 460;
    const altura = caixa.offsetHeight || 200;
    // Deixa sempre uma faixa visível, mesmo que a caixa seja mais alta que a janela.
    const maxLeft = Math.max(0, window.innerWidth - largura);
    const maxTop = Math.max(0, window.innerHeight - Math.min(altura, window.innerHeight - 40));
    const top = Math.min(Math.max(0, pos.top), maxTop);
    caixa.style.left = `${Math.min(Math.max(0, pos.left), maxLeft)}px`;
    caixa.style.top = `${top}px`;

    /**
     * **A altura que sobra DEPOIS do topo escolhido** — o CSS não sabe disso.
     *
     * Relato dele (04/09/2026): *"cortado e não consigo pegar a resposta"*. A caixa com dez opções
     * e as respostas rápidas abertas passava do fim da janela, e a pergunta é modal para a rodada:
     * opção inalcançável trava o trabalho, com Esc (que descarta a decisão) como única saída.
     *
     * Centrada, `max-height: calc(100vh - 32px)` no CSS resolve. Arrastada, o espaço disponível
     * depende de onde ela está — e é por isso que esta linha existe aqui, e não lá.
     *
     * O piso de 160px é para a caixa nunca virar uma fresta ilegível se `top` ficar no limite.
     */
    caixa.style.maxHeight = `${Math.max(160, window.innerHeight - top - 12)}px`;
  }

  /**
   * As respostas prontas dentro da caixa de pergunta, fechadas por padrão.
   *
   * Fechadas porque a pergunta é uma decisão de um toque, e uma lista de oito botões no meio
   * dela atrapalharia o caso comum. `<details>` guarda o estado de aberto enquanto a pergunta
   * existe, e é nativo — sem estado nosso para sincronizar.
   *
   * Resposta bloqueada por variável aparece **desabilitada com o motivo**, nunca sumindo: já
   * aconteceu duas vezes de a opção sumir e ninguém entender por quê.
   */
  /**
   * Copia o que o contato escreveu, para colar numa IA e escrever a resposta.
   *
   * É o passo manual que ele já faz — *"vou mandar pra uma IA ler e fazer a resposta para eu
   * copiar e mandar"* —, sem o selecionar-e-arrastar por cima da conversa. Copia só as mensagens
   * DO CONTATO: é o que a IA precisa ler, e as nossas já são respostas prontas dele.
   *
   * Não fecha a pergunta nem para a rodada. E não manda nada para lugar nenhum: o texto vai para
   * a área de transferência da máquina dele, e quem escolhe onde colar é ele.
   */
  function montarCopiarConversa(entrantes, quem) {
    const linha = h('div', { class: 'wf-pergunta-botoes' });
    const botao = h('button', { class: 'wf-btn wf-mini', type: 'button' }, 'Copiar a conversa');
    const aviso = h('span', { class: 'wf-pergunta-dica' }, '');

    botao.addEventListener('click', async () => {
      const texto = entrantes
        .map((m) => {
          const t = String(m?.texto || '').trim();
          const tipo = String(m?.tipo || '').toUpperCase();

          // Transcrição vai marcada: quem for ler precisa saber que é fala passada por
          // reconhecimento automático, com os erros disso, e não o que a pessoa escreveu.
          if (t && m?.transcrito) return `[${tipo.toLowerCase()} transcrito] ${t}`;
          if (t) return t;

          // Mídia sem texto e sem transcrição: marcação, para a IA saber que houve algo ali.
          return tipo && tipo !== 'TEXT' ? `[${tipo.toLowerCase()}, sem transcrição]` : '';
        })
        .filter(Boolean)
        .join('\n\n');

      try {
        await navigator.clipboard.writeText(`Mensagens de ${quem}:\n\n${texto}`);
        aviso.textContent = 'Copiado.';
      } catch (_) {
        // Sem permissão de área de transferência: dizer é melhor que fingir que copiou.
        aviso.textContent = 'O navegador não deixou copiar — selecione na conversa.';
      }
    });

    linha.append(botao, aviso);
    return linha;
  }

  /**
   * **"Por que esta sugestão está errada?"** — o caderno dele, dentro da caixa da rodada.
   *
   * Pedido dele (02/09/2026): *"vamos implementar a observação para sugestão onde vou escrever o
   * porque está errado e lhe passar essas informações depois, monte um botão de salvar as
   * observações para que isso seja possível"*.
   *
   * **Salvar não fecha a pergunta**, igual às respostas rápidas: anotar é sobre o caso que ele está
   * olhando, e fechar a caixa o obrigaria a decidir antes de terminar de escrever.
   *
   * O que vai junto com o texto dele — a regra, a tecla, o motivo que a caixa mostrou, o que a
   * pessoa escreveu e as etiquetas — o painel preenche sozinho. É a lição que ele mesmo me deu na
   * janela do fluxo: *"não faz sentido eu colar para você sem você ter a visão do fluxo"*. Aqui é o
   * mesmo — sem o caso, "essa sugestão está errada" me faria adivinhar.
   */
  function montarObservacao(nomeDoContato, recomendacao, linhas) {
    const bloco = h('div', { class: 'wf-pergunta-obs' });

    const abrir = h('button', { class: 'wf-btn wf-mini', type: 'button' }, '✎ Anotar por que está errado');
    const corpo = h('div', { class: 'wf-pergunta-obs-corpo' });
    corpo.style.display = 'none';

    abrir.addEventListener('click', () => {
      const aberto = corpo.style.display !== 'none';
      corpo.style.display = aberto ? 'none' : 'block';
      abrir.textContent = aberto ? '✎ Anotar por que está errado' : '▾ Fechar a anotação';
      if (!aberto) area.focus();
    });

    const area = h('textarea', {
      rows: '3',
      placeholder: recomendacao
        ? 'Ex.: ele já tem todas as etiquetas, era só agradecer e concluir.'
        : 'Ex.: a caixa não sugeriu nada, e o certo aqui seria…',
    });

    const salvar = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Salvar observação');
    const aviso = h('div', { class: 'wf-pergunta-obs-aviso' });

    salvar.addEventListener('click', async () => {
      const porque = area.value.trim();
      if (!porque) {
        // Botão que grava nada e diz "salvo" ensina a não confiar no botão.
        aviso.textContent = 'Escreva o que está errado antes de salvar.';
        aviso.className = 'wf-pergunta-obs-aviso ruim';
        return;
      }
      try {
        const guardadas = await store.get('observacoes');
        const r = observacoesLib.acrescentar(guardadas, {
          contato: nomeDoContato,
          regra: recomendacao?.id || '',
          tecla: recomendacao?.tecla || (recomendacao?.resposta ? 'f' : ''),
          motivo: recomendacao?.motivo || '',
          /**
           * **As cinco últimas dela**, e não só a última — pedido dele (02/09/2026) depois de me
           * mandar as dez primeiras anotações: *"o contexto das conversas está muito pequeno"*.
           *
           * Ele estava certo. Em várias delas a última mensagem era um link solto ou um "Estamos
           * juntos", e o que explicava o caso estava duas acima — eu leria o sintoma sem a conversa.
           */
          /**
           * **Figura, figurinha e áudio sem transcrição também contam** — pedido dele (04/09):
           * *"elas pegam só texto e ignoram fotos, links e emojis"*. Descartar o que não tem texto
           * fazia o corte das cinco últimas alcançar mensagens mais antigas para completar o
           * número, e eu lia uma conversa que nunca existiu daquele jeito.
           */
          mensagens: (state.entrantes || [])
            .map((m) => observacoesLib.descreverMensagem(m))
            .filter(Boolean)
            .slice(-observacoesLib.MAX_MENSAGENS),
          etiquetas: (state.tagSuggestions || []).filter((t) => t.jaTem || t.marcada).map((t) => t.nome),
          /**
           * **A versão que decidiu** — sem ela, anotação e conserto do mesmo dia são
           * indistinguíveis, e três anotações de 03/09 chegaram até mim já consertadas.
           */
          versao: versaoCarregada(),
          // Quando ela falou pela última vez — mesmo pedido que pôs a linha na caixa da rodada.
          ultimaDelaEm: [...(state.entrantes || [])].reverse().find((m) => m?.at)?.at || '',
          porque,
        });
        await store.set('observacoes', r.lista);
        area.value = '';
        aviso.textContent = `Anotado. São ${r.lista.length} observação(ões) — copie na aba Automatizado e me mande.`;
        aviso.className = 'wf-pergunta-obs-aviso bom';
      } catch (err) {
        // Extensão recarregada com a aba aberta: o armazenamento morre. Dizer é melhor que fingir.
        aviso.textContent = 'Não consegui salvar: ' + (err?.message || err);
        aviso.className = 'wf-pergunta-obs-aviso ruim';
      }
    });

    corpo.append(area, h('div', { class: 'wf-row' }, [salvar]), aviso);
    bloco.append(abrir, corpo);
    return bloco;
  }

  function montarRespostasRapidas(respostas) {
    const bloco = h('details', { class: 'wf-rapidas' });
    bloco.append(h('summary', {}, `Respostas rápidas (${respostas.length})`));

    const aviso = h('div', { class: 'wf-pergunta-dica' }, 'Enviar daqui não fecha a pergunta.');
    bloco.append(aviso);

    // Par botão↔resposta guardado aqui: reabilitar depois do envio tem que devolver cada botão
    // ao estado dele, e quem estava bloqueado por variável continua bloqueado.
    const pares = respostas.map((resposta) => {
      const btn = h('button', { class: 'wf-btn wf-mini', type: 'button' }, resposta.nome);
      btn.disabled = !!resposta.bloqueio;
      if (resposta.bloqueio) btn.title = resposta.bloqueio;
      bloco.append(btn);
      return { resposta, btn };
    });

    const soltar = () => pares.forEach(({ resposta, btn }) => (btn.disabled = !!resposta.bloqueio));

    for (const { resposta, btn } of pares) {
      if (resposta.bloqueio) continue;
      btn.addEventListener('click', async () => {
        // Trava todos durante o envio: dois cliques seguidos mandariam duas mensagens para
        // gente real, e o envio leva segundos (espera o composer esvaziar).
        pares.forEach(({ btn: b }) => (b.disabled = true));
        aviso.textContent = `Enviando "${resposta.nome}"…`;
        try {
          const foi = await resposta.enviar();
          aviso.textContent = foi
            ? `Enviado: ${resposta.nome}. A pergunta continua aberta.`
            : `Não saiu: ${resposta.nome}. Veja o status do painel.`;
        } catch (err) {
          aviso.textContent = `Erro ao enviar: ${err?.message || err}`;
        } finally {
          soltar();
        }
      });
    }
    return bloco;
  }

  /**
   * Fica de vigia enquanto você responde à mão. Retoma quando o atendimento é concluído.
   *
   * Vigia a sessão em que a pergunta apareceu, não "a sessão aberta": se você for para outro
   * atendimento no meio, a rodada não pode ficar esperando a conclusão de um contato que não é
   * mais este — e nem contá-lo como resolvido.
   *
   * Saídas: você concluiu (retoma), você abriu outro atendimento (segue adiante), você clicou
   * em "Parar a rodada", ou meia hora sem nada acontecer.
   *
   * **Mandar uma figura não é trocar de atendimento.** Anexar mídia abre um diálogo do Material
   * por cima da conversa, e enquanto ele está aberto a URL deixa de ter o id da sessão. A
   * versão anterior lia isso como "você abriu outro atendimento", devolvia o contato e mandava
   * a rodada seguir — só que o diálogo continuava aberto, modal, e o clique no próximo item da
   * fila não acontecia: a rodada morria ali. Daí as duas travas abaixo, que só custam segundos:
   * diálogo aberto (ou URL sem sessão) não vale julgamento, e a troca de atendimento precisa
   * se confirmar em três leituras seguidas.
   */
  const LEITURAS_PARA_TROCA = 3;

  async function esperarVoceConcluir(sessionId, nome) {
    const limite = Date.now() + 30 * 60 * 1000;
    setStatus(`Responda ${nome} à mão. Quando você concluir, eu retomo daqui.`, 'ok');
    let foraDaSessao = 0;
    let semControles = 0;

    while (Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 1000));
      if (state.auto.parar) {
        return { nome, resultado: 'pulado', parar: true, motivo: 'você parou a rodada' };
      }

      const estado = await page.getState();
      if (estado.concluded && estado.sessionId === sessionId) {
        return { nome, resultado: 'concluido', motivo: 'você respondeu e concluiu' };
      }

      // Rede de segurança: o atendimento ficou sem composer, sem Concluir e sem Iniciar. Isso é
      // um atendimento fechado, mesmo que o rótulo da tela não seja nenhum dos que conhecemos.
      // Três leituras seguidas porque durante a troca de tela os controles somem por um
      // instante — e retomar cedo demais abriria o próximo contato por cima deste.
      if (estado.semControles && estado.sessionId === sessionId && !estado.hasDialog) {
        if (++semControles >= 3) {
          return { nome, resultado: 'concluido', motivo: 'o atendimento ficou sem controles — dei por concluído' };
        }
        continue;
      }
      semControles = 0;

      // Você está no meio de alguma coisa (anexando figura, preview de mídia, diálogo aberto):
      // a tela não está em estado de ser lida. Espera.
      if (estado.hasDialog || !estado.sessionId) {
        foraDaSessao = 0;
        continue;
      }

      if (estado.sessionId !== sessionId) {
        if (++foraDaSessao < LEITURAS_PARA_TROCA) continue;
        return { nome, resultado: 'pulado', motivo: 'você abriu outro atendimento — segui daqui' };
      }
      foraDaSessao = 0;
    }
    return { nome, resultado: 'pulado', motivo: 'esperei 30 min e o atendimento seguiu aberto' };
  }

  /**
   * Resumo estável de um texto, para a chave do anti-duplicata da mensagem do momento.
   *
   * Sem isto, a chave seria fixa ("momento") e trocar de data — Dia dos Pais para Natal — seria
   * barrado como duplicata da mensagem anterior.
   */
  function chaveDoTexto(texto) {
    let h = 0;
    const s = String(texto);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36);
  }

  /**
   * Mesmo dia no calendário local — não "nas últimas 24 horas".
   *
   * A pergunta que o Thiago faz é "já mandei isso hoje?": mensagem de ontem às 23h e de hoje às
   * 8h são dois dias de trabalho diferentes, mesmo separadas por nove horas.
   */
  function ehHoje(quando) {
    if (!quando) return false;
    const d = new Date(quando);
    if (Number.isNaN(d.getTime())) return false;
    const hoje = new Date();
    return (
      d.getFullYear() === hoje.getFullYear() &&
      d.getMonth() === hoje.getMonth() &&
      d.getDate() === hoje.getDate()
    );
  }

  function formatarHora(quando) {
    const d = new Date(quando);
    return Number.isNaN(d.getTime())
      ? '?'
      : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  /** "hoje às 14:03" / "05/08 às 09:12" — o dia só aparece quando não é hoje. */
  /**
   * **Quando foi, do jeito que ele lê** — "hoje às 11:00", "ONTEM às 11:00", "há 3 dias (01/09)".
   *
   * Pedido dele (04/09/2026), com a print da Isaura: a caixa recomendava a mensagem do momento por
   * um "Bom dia" que era **do dia anterior**, e nada na tela dizia isso. *"A sugestão não fala que
   * foi ontem a mensagem dela; especifique sempre quando foi feita a última mensagem."*
   *
   * "Ontem" vem em MAIÚSCULA de propósito: é a informação que muda a decisão dele — cumprimento de
   * hoje se responde, cumprimento de ontem já é outra conversa — e ela estava passando despercebida
   * no meio das outras linhas.
   *
   * O corte é o DIA local, o mesmo de `cortesia.deOutroDia`: é o que a plataforma mostra na tela,
   * e duas contagens diferentes de "ontem" na mesma tela seriam pior que nenhuma.
   */
  function quandoFoi(quando) {
    const d = new Date(quando);
    if (Number.isNaN(d.getTime())) return '';
    const hora = formatarHora(quando);
    if (ehHoje(quando)) return `hoje às ${hora}`;

    const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    const dias = Math.round((dia(new Date()) - dia(d)) / 86400000);
    const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    if (dias === 1) return `ONTEM às ${hora}`;
    if (dias > 1) return `há ${dias} dias (${data} às ${hora})`;
    return `${data} às ${hora}`;
  }

  function formatarQuando(quando) {
    const d = new Date(quando);
    if (Number.isNaN(d.getTime())) return 'em data desconhecida';
    return ehHoje(quando)
      ? `hoje às ${formatarHora(quando)}`
      : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${formatarHora(quando)}`;
  }

  /** Comparação de texto sem acento e sem diferença de caixa. */
  /**
   * A linha do formato que TODO pedido de dados carrega.
   *
   * `Nome completo / Cidade` no `pedir-dados`, `*Nome / Cidade*` nos dois textos de evento, e a
   * mesma linha em toda variante — porque é dela que sai a precisão do parser, e há teste em cada
   * um dos textos travando isso.
   */
  /**
   * **Era a TERCEIRA cópia do mesmo invariante, e a última a ficar para trás** (relato dele,
   * 04/09/2026): *"já havia mandado modelo, contato deu os dados, e a sugestão foi mandar modelo
   * novamente"*.
   *
   * O painel tinha a sua própria expressão exigindo a BARRA (`nome / cidade`), e o texto em uso
   * passou a ser `Nome , Cidade`. Com ela furada, duas coisas paravam de funcionar de uma vez: o
   * parser deixava de ler a mensagem seguinte como RESPOSTA ao formulário, e `respondeuOsDados`
   * ficava falso — então a rodada voltava a oferecer o modelo a quem tinha acabado de se cadastrar.
   *
   * Consertei `templates.ehPedidoDeDados` de manhã e esta cópia continuou quebrada, porque o
   * `CLAUDE.md` mandava usar aquela função e o painel não usava. **Agora chama, e é a única
   * definição** — duas cópias de um invariante divergem na primeira reescrita do texto.
   *
   * O mesmo erro, uma camada acima, já tinha custado a print da Loreta (01/09): eu comparava um
   * trecho do TEXTO BASE, e bastava sair a variante para a resposta dela deixar de ser lida.
   */
  function pediuNomeECidade(texto) {
    return templatesLib.ehPedidoDeDados(texto);
  }

  function achatarTexto(texto) {
    return String(texto || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // marcas de acento, já separadas pelo NFD
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Um contato: assume, envia o modelo e conclui.
   *
   * Não checa `session.expired` de propósito — janela vencida é exatamente o caso desta aba, e
   * é o que o modelo aprovado resolve.
   */
  /**
   * Rodada 4: a fila dos CONCLUÍDOS sem retorno — reabre, pergunta e fecha de novo.
   *
   * É a única rodada que trabalha sobre atendimento **fechado**, e por isso tem um passo a mais:
   * concluído não tem campo de mensagem, então é preciso **Reiniciar** antes de enviar.
   *
   * A ordem, e o porquê de cada passo:
   *
   * 1. **Reiniciar.** Reabre a conversa. A plataforma, ao reabrir, joga o atendimento para
   *    "Meus" e troca de aba sozinha — daí o passo 4.
   * 2. **Modelo aprovado.** Quem está sem retorno há dias tem a janela de 24h vencida, e
   *    reabrir o atendimento **não** reabre a janela: ela é regra do WhatsApp, não da
   *    plataforma. Texto livre não chegaria. Modelo aprovado é o único envio que sai daqui.
   * 3. **Concluir.** Devolve o contato para a lista de concluídos. Se ele responder, a
   *    plataforma o traz de volta para "Meus" sozinha — que é exatamente o que se quer.
   * 4. **Voltar para a lista de concluídos** antes do próximo. Isso é feito pelo `aba` do
   *    `openQueueSession`, que garante a lista certa a cada item.
   *
   * `continuaNaFila` existe por causa do passo 3: diferente das outras rodadas, o contato
   * **volta** para a mesma lista (agora no topo, porque acabou de ser concluído). Sem andar uma
   * casa, a rodada reabriria o mesmo atendimento.
   */
  /**
   * Rodada 5: **só reabrir**, em lote, sem mandar nada.
   *
   * O fluxo antigo fazia tudo num contato só — reabrir, mandar e concluir — e o Concluir devolvia
   * o contato ao TOPO dos concluídos, o que obrigou trava sobre trava para não tratar a mesma
   * pessoa duas vezes. Ele desmontou o problema por outro lado, e é melhor: *"em vez de reiniciar
   * ir para os meus e mandar mensagem, irá somente reiniciar as conversas"*. Reabrir tira o
   * atendimento da lista de concluídos **de vez** — não volta, não sobe ao topo, não se repete.
   * A rodada vira um movimento só, e o trabalho de mandar acontece depois, na aba "Meus", com
   * ele olhando.
   *
   * Nada é enviado aqui, então não há modelo para escolher, janela de 24h para respeitar nem
   * anti-duplicata para consultar. É por isso que ela é a rodada mais barata que existe no
   * painel — e a única que não pode causar dano a contato nenhum.
   */
  async function processarReabrir(sessionId, ctx) {
    let nome = 'contato';
    try {
      const sessao = await api.getSession(sessionId);
      const contato = await api.getContact(sessao.contactId);
      nome = contato.name || contato.nameWhatsapp || 'sem nome';

      // Mesma pessoa com dois atendimentos na lista: reabrir os dois é ruído em "Meus", e é
      // trabalho a mais para ele depois. Continua na fila porque este item não saiu de lá.
      if (ctx?.contatosTratados?.has(contato.id)) {
        return { nome, resultado: 'pulado', continuaNaFila: true, motivo: 'já reabri esta pessoa nesta rodada' };
      }

      const estado = await page.getState();
      if (estado.sessionId !== sessionId) {
        return { nome, resultado: 'erro', motivo: 'a aba trocou de atendimento no meio do caminho' };
      }

      // Já aberto: nada a fazer, e não é erro. Sai da lista de concluídos sozinho.
      if (estado.hasComposer) {
        ctx?.contatosTratados?.add(contato.id);
        return { nome, resultado: 'reiniciado', motivo: 'já estava aberto — deixei em "Meus"' };
      }

      setStatus(`Reabrindo o atendimento de ${nome}…`);
      const reaberto = await page.clickReiniciar();
      if (!reaberto.ok) {
        return {
          nome,
          resultado: 'erro',
          continuaNaFila: true,
          motivo: reaberto.reason || 'não consegui reabrir o atendimento',
        };
      }

      // Confere em vez de acreditar no clique: sem campo de mensagem o atendimento não reabriu,
      // e contar como reaberto deixaria a pessoa fora do trabalho em "Meus" sem ninguém saber.
      const depois = reaberto.state || (await page.getState());
      if (!depois.hasComposer) {
        return {
          nome,
          resultado: 'erro',
          continuaNaFila: true,
          motivo: 'cliquei em Reiniciar mas o campo de mensagem não apareceu',
        };
      }

      ctx?.contatosTratados?.add(contato.id);
      return { nome, resultado: 'reiniciado', motivo: 'reaberto — está em "Meus" esperando você' };
    } catch (err) {
      await page.closeOverlay().catch(() => {});
      return { nome, resultado: 'erro', motivo: traduzirErroDeRede(err.message) };
    }
  }

  /**
   * Rodada 6, um contato: os sem retorno **já reabertos**, agora em "Meus".
   *
   * É a segunda metade do fluxo que a rodada 5 abriu. Aqui o atendimento já está aberto (foi ela
   * que reabriu), então não há Reiniciar: é abrir, decidir, mandar, tirar a etiqueta e concluir.
   *
   * **A etiqueta sai junto com o Concluir, e é isso que fecha o ciclo.** Sem tirá-la, o contato
   * volta ao topo da lista filtrada por ela e vira trabalho de novo amanhã, já tendo sido
   * trabalhado hoje — que é o problema que ele identificou ao pedir esta separação.
   *
   * Pergunta a cada contato, como a rodada 3: aqui a decisão depende de ler a conversa (a pessoa
   * pode ter voltado a falar entre o reabrir e o trabalhar), e essa leitura é dele.
   */
  async function processarSemRetornoEmMeus(sessionId, modelo, ctx) {
    let nome = 'contato';
    try {
      await load(sessionId);
      if (!state.contact) return { nome, resultado: 'erro', motivo: 'não consegui carregar o contato' };
      nome = state.contact.name || state.contact.nameWhatsapp || 'sem nome';

      if (ctx?.contatosTratados?.has(state.contact.id)) {
        return { nome, resultado: 'pulado', motivo: 'já tratei este contato nesta rodada' };
      }

      /**
       * "Meus" não é uma fila só: tem quem veio da rodada dos Novos, quem respondeu, e quem foi
       * reaberto aqui. Quem separa é o filtro que ele aplicou — e a etiqueta é o que esse filtro
       * usa. Conferir custa nada (o contato já está carregado) e é a diferença entre a rodada
       * mandar a pergunta de sem retorno para quem está no meio de outra conversa e não mandar.
       */
      const nomeEtiqueta = String(state.auto.cfg.etiquetaSemRetorno || '').trim();
      if (nomeEtiqueta) {
        const etiqueta = await etiquetaSemRetornoDoContato();
        if (!etiqueta) {
          return {
            nome,
            resultado: 'pulado',
            motivo: `não tem a etiqueta "${nomeEtiqueta}" — filtre a lista por ela antes de rodar`,
          };
        }
      }

      const contexto = await currentVarContext();
      const pergunta = state.templates.find((t) => t.id === NO_REPLY_TEMPLATE_ID);
      const faltando = pergunta ? vars.render(pergunta.text, contexto) : null;
      const perguntaTrava = faltando ? faltando.missing.length > 0 : true;

      // Janela de 24h: quem manda é o WhatsApp, não a plataforma, e reabrir o atendimento não a
      // reabre. Fechada, texto livre não chega — a opção nem aparece, com o motivo na tela.
      const janelaAberta = !state.session?.expired;
      const podeTexto = !!pergunta && !perguntaTrava && janelaAberta;

      const ultima = state.ultimaMensagem;
      const respondeu = !!ultima?.doContato;

      // Anti-duplicata, as duas travas: por modelo (nosso registro) e por conversa (que conta
      // também o que foi mandado à mão). Aqui elas viram LINHA da pergunta, não pulo: quem
      // decide repetir é ele, olhando. Pulo silencioso já foi defeito duas vezes neste projeto.
      const jaEnviado = modelo ? await templatesLib.wasSent(state.contact.id, hsmKey(modelo)) : null;
      const reenvio = hsmLib.decidirReenvio({
        ultimaFoiNossa: !!ultima && !ultima.doContato,
        horasDesdeUltima: ultima ? (Date.now() - new Date(ultima.at).getTime()) / 3600000 : Infinity,
        limiteHoras: clampInt(state.auto.cfg.horasSemRepetir, 1, 720),
      });

      // Canal fora do ar: some tudo que envia. Ver `canalDesteContatoFora`. Aqui a etiqueta
      // NÃO sai e o atendimento NÃO fecha — o contato tem que continuar na fila para quando o
      // número voltar, que é a razão inteira de esta rodada existir.
      const canalFora = await canalDesteContatoFora();
      if (canalFora) {
        const escolhaFora = await perguntarNaRodada({
          titulo: nome,
          linhas: [linhaCanalFora(canalFora), canalFora.texto].filter(Boolean),
          pergunta: 'Nada pode ser enviado por este número agora. O que fazer?',
          opcoes: [
            { tecla: '1', valor: 'pular', rotulo: 'Pular (mantém a etiqueta)', primaria: true },
            { tecla: '2', valor: 'parar', rotulo: 'Parar a rodada' },
          ],
        });
        return {
          nome,
          resultado: 'pulado',
          parar: escolhaFora !== 'pular',
          motivo: 'o número deste atendimento está fora do ar — etiqueta mantida, nada enviado',
        };
      }

      const opcoes = [];
      if (modelo) {
        opcoes.push({
          tecla: '1',
          valor: 'modelo',
          rotulo: jaEnviado ? `Mandar de novo "${modelo.name}"` : `Mandar modelo "${modelo.name}"`,
          primaria: !jaEnviado && reenvio.acao === 'enviar',
        });
      }
      if (podeTexto) {
        opcoes.push({ tecla: '2', valor: 'texto', rotulo: `Mandar "${pergunta.name}"`, primaria: !modelo });
      }
      opcoes.push({ tecla: '3', valor: 'pular', rotulo: 'Pular (mantém a etiqueta)' });
      opcoes.push({ tecla: '4', valor: 'concluir', rotulo: 'Concluir sem enviar (tira a etiqueta)' });
      opcoes.push({ tecla: '5', valor: 'responder', rotulo: 'Responder à mão (retomo quando você concluir)' });

      const escolha = await perguntarNaRodada({
        titulo: nome,
        linhas: [
          `Última mensagem: ${ultima ? `${respondeu ? 'dele' : 'nossa'}, ${formatarQuando(ultima.at)}` : '(nenhuma)'}`,
          valueNamed('Cidade') ? ['Cidade: ', ...cidadeMarcada(), cidadeSubstituida()] : 'Cidade: (vazia)',
          respondeu ? '⚠ ELE VOLTOU A FALAR depois da nossa última mensagem — leia antes de decidir.' : '',
          janelaAberta
            ? 'A janela de 24h está ABERTA: texto livre chega neste contato.'
            : 'A janela de 24h venceu: só modelo aprovado chega. Texto livre não sai.',
          !pergunta ? `Não achei a resposta "${NO_REPLY_TEMPLATE_ID}" na aba Config.` : '',
          pergunta && perguntaTrava && janelaAberta
            ? `A resposta "${pergunta.name}" está travada: ${vars.explainMissing(faltando.missing, faltando.reasons)}`
            : '',
          jaEnviado ? `⚠ "${modelo.name}" já foi enviado ${formatarQuando(jaEnviado.at)}.` : '',
          reenvio.acao === 'pular' ? `⚠ ${reenvio.motivo}.` : '',
        ].filter(Boolean),
        pergunta: 'O que fazer com este contato?',
        respostas: state.templates.map((t) => {
          const { missing, reasons } = vars.render(t.text, contexto);
          return {
            nome: t.name,
            bloqueio: missing.length ? vars.explainMissing(missing, reasons) : '',
            enviar: () => sendTemplate(t, { send: true, jaConfirmado: true }),
          };
        }),
        opcoes,
      });

      if (escolha === 'parar') return { nome, resultado: 'pulado', parar: true, motivo: 'você parou a rodada' };

      // Pular NÃO tira a etiqueta: o contato tem que continuar na lista filtrada, senão ele
      // some do trabalho sem nunca ter sido atendido.
      // Pular não escreve no CRM — ver o comentário do outro `pular`, na rodada principal.
      if (escolha === 'pular') {
        return { nome, resultado: 'pulado', motivo: 'você pulou — nada gravado, atendimento aberto' };
      }

      // A rodada sai da frente e fica de vigia. Ele responde à mão; quando concluir, ela segue.
      // A etiqueta fica com ele: quem conclui é a plataforma, e o botão da aba Dados é o gancho.
      if (escolha === 'responder') {
        await saveClassification({ withCompletionDate: true, quiet: true });
        return esperarVoceConcluir(sessionId, nome);
      }

      ctx?.contatosTratados?.add(state.contact.id);

      if (escolha === 'concluir') {
        if (!(await saveClassification({ withCompletionDate: true, quiet: true, tirarSemRetorno: true }))) {
          return { nome, resultado: 'erro', motivo: 'a classificação não gravou; não concluí' };
        }
        return await fecharSemRetorno(nome, 'concluído sem enviar, a seu pedido', 'concluido');
      }

      const texto = escolha === 'texto' ? pergunta : null;
      const rotulo = texto ? `"${texto.name}"` : `modelo "${modelo.name}"`;

      // Grava e tira a etiqueta ANTES de enviar: se o envio falhar, o contato continua na lista
      // — o inverso (etiqueta fora, mensagem não enviada) o tiraria do trabalho em silêncio.
      if (!(await saveClassification({ withCompletionDate: true, quiet: true, tirarSemRetorno: true }))) {
        return { nome, resultado: 'erro', motivo: 'a classificação não gravou; não enviei nada' };
      }

      const enviou = texto
        ? await sendTemplate(texto, { send: true, jaConfirmado: true })
        : await enviarModelo(modelo, { send: true, jaConfirmado: true });
      if (!enviou) return { nome, resultado: 'erro', motivo: `${rotulo} não saiu` };

      return await fecharSemRetorno(nome, `mandei ${rotulo}, tirei a etiqueta e concluí`, 'enviado');
    } catch (err) {
      await page.closeOverlay().catch(() => {});
      return { nome, resultado: 'erro', motivo: traduzirErroDeRede(err.message) };
    }
  }

  /** O Concluir das saídas acima, com os dois tropeços conhecidos separados. */
  async function fecharSemRetorno(nome, motivo, resultado) {
    const fechou = await concluirPeloPainel();
    if (!fechou.ok) return { nome, resultado, parar: true, motivo: `${motivo}, mas ${fechou.reason}` };
    if (fechou.dialogOpen) {
      return {
        nome,
        resultado,
        parar: true,
        motivo: `${motivo}, mas a plataforma pediu um motivo de conclusão — responda o diálogo`,
      };
    }
    return { nome, resultado, motivo };
  }

  async function processarSemRetorno(sessionId, modelo, ctx) {
    let nome = 'contato';
    try {
      const sessao = await api.getSession(sessionId);
      const contato = await api.getContact(sessao.contactId);
      nome = contato.name || contato.nameWhatsapp || 'sem nome';

      // Mesma pessoa, outro atendimento: o Reiniciar/Concluir devolve o item para a lista e o id
      // da sessão pode vir trocado. Aqui a mensagem já saiu uma vez nesta rodada — parar antes
      // de enviar é a diferença entre um pulo no log e a pessoa recebendo duas vezes.
      if (ctx?.contatosTratados?.has(contato.id)) {
        return {
          nome,
          resultado: 'pulado',
          continuaNaFila: true,
          motivo: 'já tratei este contato nesta rodada (o atendimento voltou para a lista)',
        };
      }

      /**
       * **Vai o modelo que ele escolheu. Sempre.**
       *
       * Isto já foi mais esperto: com a janela de 24h aberta, a rodada trocava o modelo por uma
       * resposta de texto — mais barata e editável. Ele reportou como defeito, e está certo:
       * *"não utilizou o modelo escolhido e mandou texto"*. Escolha explícita não se
       * substitui por dedução, ainda que a dedução esteja tecnicamente certa — é a mesma regra
       * que faz o painel recusar em vez de chutar em todo o resto.
       *
       * A resposta pronta "Sem retorno: ainda tem interesse?" continua na aba Respostas, para
       * ele mandar à mão ou pelas respostas rápidas da pergunta da rodada.
       */
      const chaveEnvio = hsmKey(modelo);
      const rotuloEnvio = `modelo "${modelo.name}"`;

      if (state.settings.antiDup) {
        const quando = await templatesLib.wasSent(contato.id, chaveEnvio);
        if (quando) {
          return {
            nome,
            resultado: 'pulado',
            continuaNaFila: true,
            motivo: `já recebeu ${rotuloEnvio} em ${new Date(quando.at).toLocaleDateString('pt-BR')}`,
          };
        }

        /**
         * A trava que o `contatosTratados` acima **não** dá: ele é um `Set` que nasce vazio a
         * cada rodada, e o caso real foram DUAS rodadas — resposta pronta numa, modelo aprovado
         * na seguinte, 32 min depois. Chaves diferentes no registro, `Set` novo no laço, duas
         * mensagens na cara da pessoa.
         *
         * Quem responde "já falei com esta pessoa agora há pouco?" é a conversa, não o nosso
         * registro: assim conta também o que foi mandado à mão. Custa uma leitura por contato.
         */
        const conversa = await api.getConversation(sessionId, 5);
        const reenvio = hsmLib.decidirReenvio({
          ultimaFoiNossa: !!conversa.ultima && !conversa.ultima.doContato,
          horasDesdeUltima: conversa.ultima
            ? (Date.now() - new Date(conversa.ultima.at).getTime()) / 3600000
            : Infinity,
          limiteHoras: clampInt(state.auto.cfg.horasSemRepetir, 1, 720),
        });
        if (reenvio.acao === 'pular') {
          return { nome, resultado: 'pulado', continuaNaFila: true, motivo: reenvio.motivo };
        }
      }

      let estado = await page.getState();
      if (estado.sessionId !== sessionId) {
        return { nome, resultado: 'erro', motivo: 'a aba trocou de atendimento no meio do caminho' };
      }

      // Reabrir só quando precisa: item da lista de concluídos que já esteja aberto (ou que a
      // plataforma tenha reaberto sozinha) não deve levar um clique à toa.
      if (!estado.hasComposer) {
        setStatus(`Reabrindo o atendimento de ${nome}…`);
        const reaberto = await page.clickReiniciar();
        if (!reaberto.ok) {
          return {
            nome,
            resultado: 'erro',
            continuaNaFila: true,
            motivo: reaberto.reason || 'não consegui reabrir o atendimento',
          };
        }
        estado = reaberto.state || (await page.getState());
      }

      if (!estado.hasComposer) {
        return { nome, resultado: 'erro', continuaNaFila: true, motivo: 'o campo de mensagem não apareceu depois do Reiniciar' };
      }

      // Reaberto e com o canal fora: pular deixa o atendimento aberto em "Meus", que é melhor
      // que concluí-lo sem ter enviado nada — ele fica visível esperando o número voltar.
      const canalFora = await canalDesteContatoFora();
      if (canalFora) {
        return { nome, resultado: 'pulado', motivo: 'o número deste atendimento está fora do ar — não enviei nada' };
      }

      setStatus(`Enviando ${rotuloEnvio} para ${nome}…`);
      const envio = await page.sendMessageTemplate(modelo, { send: true });
      if (!envio?.sent) {
        // Reaberto e sem enviar: o atendimento ficou em "Meus". Parar é o certo — seguir
        // deixaria um rastro de conversas reabertas sem mensagem.
        return { nome, resultado: 'erro', parar: true, motivo: 'reabri o atendimento mas o diálogo não confirmou o envio' };
      }
      await templatesLib.markSent(contato.id, chaveEnvio, { nome });
      // Marca assim que a mensagem SAI, não depois de concluir: se o Concluir falhar, a pessoa
      // já recebeu, e é isso que não pode acontecer duas vezes.
      ctx?.contatosTratados?.add(contato.id);

      const concluido = await concluirPeloPainel();
      if (!concluido.ok) {
        return { nome, resultado: 'enviado', parar: true, continuaNaFila: true, motivo: concluido.reason };
      }
      if (concluido.dialogOpen) {
        return {
          nome,
          resultado: 'enviado',
          parar: true,
          continuaNaFila: true,
          motivo: 'enviado, mas a plataforma pediu motivo de conclusão — responda o diálogo na aba',
        };
      }
      // A janela vai no log mesmo sem mudar o que é enviado: contato com a janela ABERTA é
      // quem daria para responder à mão, e essa informação some se ninguém escrever.
      return {
        nome,
        resultado: 'enviado',
        continuaNaFila: true,
        motivo:
          `reaberto, mandei o ${rotuloEnvio} e concluí` +
          (sessao.expired ? '' : ' — a janela dele estava ABERTA, dava para responder à mão'),
      };
    } catch (err) {
      await page.closeOverlay().catch(() => {});
      return { nome, resultado: 'erro', motivo: traduzirErroDeRede(err.message) };
    }
  }

  /** Pausa fatiada, para o Parar não ter que esperar o intervalo inteiro. */
  /**
   * Pausa entre envios, e o detector de congelamento.
   *
   * Aba congelada volta com a plataforma quebrada: as requisições em voo e o socket do app
   * morrem, e ele fica em "Sem conexão com o servidor" com o spinner preso. Seguir a rodada
   * nesse estado é agir sobre uma página morta — clicar em coisa que não responde e, pior,
   * contar como enviado o que não saiu.
   *
   * O sinal é o relógio de parede: se a pausa demorou muito mais do que foi pedido, o navegador
   * parou a aba no meio. Aí a rodada para e manda dar F5.
   */
  async function pausarRodada(ms) {
    const inicio = Date.now();
    const fim = inicio + ms;
    while (Date.now() < fim && !state.auto.parar) {
      await new Promise((r) => setTimeout(r, 200));
    }
    const gasto = Date.now() - inicio;
    // 3x + 10s de folga: o clamp de 1s da aba escondida não dispara isso; congelamento sim.
    if (gasto > ms * 3 + 10000) {
      return { congelou: true, gasto };
    }
    return { congelou: false, gasto };
  }

  function campoTexto(rotulo, valor, onChange) {
    const input = h('input', { type: 'text', value: String(valor ?? '') });
    input.addEventListener('change', () => onChange(input.value));
    return h('label', { class: 'wf-field' }, [h('span', {}, rotulo), input]);
  }

  function campoNumero(rotulo, valor, onChange) {
    const input = h('input', { type: 'text', inputmode: 'numeric', value: String(valor) });
    input.addEventListener('change', () => onChange(input.value));
    return h('label', { class: 'wf-field' }, [h('span', {}, rotulo), input]);
  }

  function clampInt(valor, min, max) {
    const n = parseInt(String(valor).replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  // ---- aba Dados ---------------------------------------------------------
  function renderDados() {
    if (!state.contact) {
      body.append(h('p', { class: 'wf-hint' }, 'Abra um atendimento para classificar.'));
      return;
    }

    // Sem contrato nada é gravado — nem campo, nem etiqueta, nem data de conclusão. Avisar só
    // depois de clicar em Salvar fazia parecer que o preenchimento estava quebrado.
    if (!state.hasContract) {
      body.append(
        h('div', { class: 'wf-block' }, [
          document.createTextNode(
            'Ainda não dá para gravar: o contrato de escrita não foi aprendido. Vá na aba Config → "Gravar campos no CRM". '
          ),
          h('b', {}, 'O valor de teste tem que ser digitado no painel "Dados do contato" da própria plataforma'),
          document.createTextNode(' (no "Alterar" ao lado do campo), e não aqui no WhatsFill — é lá que o gravador enxerga.'),
        ])
      );
    }

    if (state.incoming.length) {
      body.append(
        h('p', { class: 'wf-hint' }, `Palpites (em amarelo) vieram de: “${truncate(state.incoming.join(' | '), 140)}”`)
      );
    }

    for (const field of state.classify) body.append(renderFieldEditor(field));

    renderTagsSection();

    const saveBtn = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Salvar no CRM');
    saveBtn.disabled = !state.hasContract;
    saveBtn.addEventListener('click', () => withBusy(() => saveClassification({ withCompletionDate: true })));

    const linha = [saveBtn];

    /**
     * Quando ele conclui pela plataforma (que é o que vai acontecer trabalhando em "Meus"), a
     * extensão não tem gancho nenhum para tirar a etiqueta sozinha — o Concluir é dela, não
     * nosso. Este botão é esse gancho, num clique, sem passar pelo diálogo de Etiquetas.
     */
    const nomeSemRetorno = String(state.auto.cfg.etiquetaSemRetorno || '').trim();
    if (nomeSemRetorno) {
      const tirar = h('button', { class: 'wf-btn', type: 'button' }, `Tirar "${nomeSemRetorno}"`);
      tirar.addEventListener('click', () => withBusy(tirarSemRetornoDoContato));
      linha.push(tirar);
    }

    body.append(h('div', { class: 'wf-row' }, linha));
    if (nomeSemRetorno) {
      body.append(
        h('div', { class: 'wf-origin' },
          `Concluir sem tirar "${nomeSemRetorno}" devolve o contato ao topo da lista filtrada ` +
            'por ela, e ele vira trabalho de novo amanhã. O Concluir do painel já tira sozinho; ' +
            'este botão é para quando você conclui pela plataforma.')
      );
    }
  }

  /**
   * O canal deste atendimento caiu? Se caiu, a rodada só oferece Pular.
   *
   * Pedido dele com a tarja na tela: *"o número está fora do ar para alguns contatos, até voltar
   * esse número só tem a opção de pular"*.
   *
   * O que torna isso obrigatório, e não um capricho: com o canal fora a plataforma **aceita** o
   * envio. O balão aparece na conversa e fica lá sem entregar. A rodada contaria como enviado,
   * marcaria no anti-duplicata (que depois recusaria mandar de novo) e concluiria o atendimento
   * — o contato sairia do trabalho sem nunca ter recebido nada, e ninguém saberia. É a pior
   * falha possível aqui: silenciosa e com a tela dizendo que deu certo.
   *
   * Falha para o lado seguro: se der erro ao ler a tela, devolve "não está fora". Uma tarja não
   * lida custa um envio que talvez não saia; um falso positivo trava a rodada inteira à toa.
   */
  async function canalDesteContatoFora() {
    try {
      const aviso = await page.canalForaDoAr();
      return aviso?.fora ? aviso : null;
    } catch (err) {
      console.warn('[WhatsFill] não consegui ler o aviso de canal desconectado:', err.message);
      return null;
    }
  }

  /** A linha que explica a trava, na caixa da rodada. */
  function linhaCanalFora(aviso) {
    if (!aviso) return '';
    const numero = aviso.numero ? ` (${aviso.numero})` : '';
    return (
      `⚠ O NÚMERO DESTE ATENDIMENTO${numero} ESTÁ FORA DO AR. A plataforma aceita o envio e a ` +
      'mensagem não chega. Só dá para pular até o número voltar.'
    );
  }

  /** O botão acima: tira a etiqueta de fluxo do contato aberto, e diz o que aconteceu. */
  async function tirarSemRetornoDoContato() {
    if (!state.contact) return setStatus('Abra um atendimento primeiro.', 'err');

    const nome = String(state.auto.cfg.etiquetaSemRetorno || '').trim();
    const tag = await etiquetaSemRetornoDoContato();
    if (!tag) {
      // Duas causas bem diferentes, e confundi-las manda ele procurar no lugar errado.
      const existe = await tagsLib.resolveTag(nome);
      return setStatus(
        existe
          ? `Este contato não tem a etiqueta "${nome}" — nada a tirar.`
          : `Não achei nenhuma etiqueta chamada "${nome}" na plataforma. Confira o nome na aba Automatizado.`,
        'err'
      );
    }

    const resultado = await tagsLib.applyTags(state.contact, [], { remover: [tag.id] });
    if (!resultado.ok) return setStatus(`Não consegui tirar a etiqueta: ${resultado.error}`, 'err');

    // Relê em vez de acreditar no 2xx — é a regra desta API, e aqui vale igual.
    state.contact = await api.getContact(state.contact.id);
    const saiu = !(state.contact.tagsId || []).includes(tag.id);
    setStatus(
      saiu ? `Etiqueta "${tag.label}" retirada.` : `A API aceitou mas "${tag.label}" continua no contato.`,
      saiu ? 'ok' : 'err'
    );
    await refreshTagSuggestions();
    renderAll();
  }

  function renderTagsSection() {
    body.append(h('hr', { class: 'wf-sep' }), h('h3', { class: 'wf-h' }, 'Etiquetas'));

    const jaAplicadas = (state.contact.tags || [])
      .map((t) => (typeof t === 'string' ? t : t.message))
      .filter(Boolean);
    if (jaAplicadas.length) {
      body.append(h('div', { class: 'wf-origin' }, 'Já no contato: ' + jaAplicadas.join(', ')));
    }

    if (!state.tagSuggestions.length) {
      body.append(h('p', { class: 'wf-hint' }, 'Nada a sugerir ainda — preencha a Cidade para as etiquetas de cidade e de região.'));
      return;
    }

    for (const sug of state.tagSuggestions) {
      const linha = h('div', { class: 'wf-card' });
      const titulo = sug.nome || '(sem etiqueta definida)';

      if (sug.tag && !sug.jaTem) {
        const chip = h('button', { class: 'wf-chip' + (sug.marcada ? ' wf-on' : ''), type: 'button' }, `${titulo}`);
        chip.addEventListener('click', () => {
          sug.marcada = !sug.marcada;
          renderAll();
        });
        linha.append(h('div', { class: 'wf-chips' }, [chip]));
      } else if (sug.tag && sug.jaTem) {
        linha.append(h('div', { class: 'wf-chips' }, [h('span', { class: 'wf-chip' }, `${titulo} ✓ já aplicada`)]));
      } else if (sug.origem === 'cidade' && sug.nome) {
        /**
         * Etiqueta de CIDADE que não existe: o caminho é CRIAR, não apontar para outra.
         *
         * Para COREDE, "escolha a correspondente" faz sentido — o nome da planilha pode divergir
         * do rótulo do CRM ("Paranhana Encosta da Serra" → "Vale do Paranhana"), e o apelido
         * resolve. Para cidade não existe correspondente: se "PELOTAS" não está lá, é porque
         * nenhum contato de Pelotas foi etiquetado ainda. Oferecer o seletor de apelido aqui
         * convidaria a apontar Pelotas para outra etiqueta qualquer — exatamente o erro que a
         * etiqueta de cidade existe para evitar.
         */
        linha.append(
          h('div', { class: 'wf-block' },
            `A etiqueta "${sug.nome}" ainda não existe no CRM. Sem ela, este contato fica sem ` +
              'etiqueta de cidade e não aparece no filtro por município.')
        );
        const criar = h('button', { class: 'wf-btn wf-primary wf-mini', type: 'button' }, `Criar "${sug.nome}"`);
        criar.disabled = state.busy;
        criar.addEventListener('click', () =>
          withBusy(async () => {
            await api.createTag(sug.nome);
            // O cache tem que cair, senão a releitura devolve a lista velha e a etiqueta recém
            // criada continua "não encontrada".
            tagsLib.invalidateTags();
            await refreshTagSuggestions();
            setStatus(`Etiqueta "${sug.nome}" criada. Agora ela pode ser aplicada.`, 'ok');
          })
        );
        linha.append(h('div', { class: 'wf-row' }, [criar]));
      } else {
        // Nome não existe (ou não casa) na lista de etiquetas do CRM: escolha manual, e a
        // escolha fica salva como apelido para não precisar repetir.
        linha.append(h('div', { class: 'wf-block' }, sug.nome
          ? `Não achei a etiqueta "${sug.nome}" no CRM. Escolha a correspondente:`
          : sug.motivo));
        if (sug.nome) linha.append(renderTagPicker(sug));
      }

      linha.append(h('div', { class: 'wf-origin' }, `${sug.origem}: ${sug.motivo}`));
      body.append(linha);
    }
  }

  function renderTagPicker(sug) {
    const input = h('input', { type: 'text', placeholder: 'digite para filtrar as etiquetas do CRM' });
    const resultados = h('div', { class: 'wf-chips', style: 'margin-top:5px' });

    input.addEventListener('input', async () => {
      const termo = cities.normalize(input.value);
      resultados.replaceChildren();
      if (termo.length < 2) return;
      const todas = await tagsLib.allTags();
      for (const tag of todas.filter((t) => cities.normalize(t.label).includes(termo)).slice(0, 8)) {
        const chip = h('button', { class: 'wf-chip', type: 'button' }, tag.label);
        chip.addEventListener('click', () =>
          withBusy(async () => {
            await tagsLib.saveAlias(sug.nome, tag.label);
            await refreshTagSuggestions();
            setStatus(`"${sug.nome}" agora aponta para a etiqueta "${tag.label}".`, 'ok');
            renderAll();
          })
        );
        resultados.append(chip);
      }
    });

    return h('div', {}, [input, resultados]);
  }

  function renderFieldEditor(field) {
    const entry = state.draft[field.id] || {};
    const wrap = h('label', { class: 'wf-field' });
    wrap.append(h('span', {}, field.name));

    if (field.isSelect && field.options.length) {
      const selected = new Set(Array.isArray(entry.value) ? entry.value : entry.value ? [entry.value] : []);
      const chips = h('div', { class: 'wf-chips' });
      for (const option of field.options) {
        const chip = h('button', { class: 'wf-chip' + (selected.has(option.id) ? ' wf-on' : ''), type: 'button' }, option.name);
        chip.addEventListener('click', () => {
          if (selected.has(option.id)) selected.delete(option.id);
          else {
            if (field.type !== 'MULTISELECT') selected.clear();
            selected.add(option.id);
          }
          state.draft[field.id] = { value: [...selected], from: 'manual' };
          renderAll();
        });
        chips.append(chip);
      }
      wrap.append(chips);
    } else {
      const input = h('input', {
        type: 'text',
        value: entry.value == null ? '' : String(entry.value),
        placeholder: field.type === 'DATE' ? 'aaaa-mm-dd' : '',
      });
      if (entry.from === 'palpite') input.classList.add('wf-guess');
      // A cidade extraída também vem marcada aqui, onde você a corrige.
      if (field.name === 'Cidade' && entry.from === 'palpite' && entry.value) {
        wrap.append(h('div', {}, [h('span', { class: 'wf-marca' }, String(entry.value))]));
      }
      input.addEventListener('input', () => {
        state.draft[field.id] = { value: input.value, from: 'manual' };
        input.classList.remove('wf-guess');
        // Erro fácil e caro: digitar o valor de teste AQUI durante o aprendizado. O gravador
        // observa as requisições da plataforma, então nada sai daqui e ele espera para sempre.
        if (input.value.trim().toUpperCase() === SENTINEL) {
          setStatus(
            `${SENTINEL} é o valor de teste do aprendizado, e ele tem que ser digitado no painel "Dados do contato" DA PLATAFORMA (no "Alterar"), não neste campo. Aqui o gravador não enxerga.`,
            'err'
          );
        }
        if (field.name === 'Cidade') renderHeader();
      });
      // Só no change (não a cada tecla): recalcular a etiqueta de região re-renderiza a aba
      // e roubaria o foco do campo enquanto você digita.
      if (field.name === 'Cidade') {
        input.addEventListener('change', () =>
          withBusy(async () => {
            await refreshTagSuggestions();
            renderAll();
          })
        );
      }
      wrap.append(input);
      if (field.name === 'Cidade') attachCityHelpers(wrap, input, entry);
    }

    if (entry.from === 'palpite') {
      const rotulo =
        entry.confidence === 'exata'
          ? 'palpite (bateu exato)'
          : entry.confidence === 'aproximada'
            ? 'palpite (aproximado)'
            : 'não reconhecido';
      wrap.append(
        h('div', { class: 'wf-origin' }, `${rotulo}${entry.source ? ` — de “${truncate(entry.source, 50)}”` : ''}`)
      );
    }
    return wrap;
  }

  function attachCityHelpers(wrap, input, entry) {
    const box = h('div', { class: 'wf-row', style: 'margin-top:5px' });
    for (const suggestion of entry.suggestions || []) {
      const chip = h('button', { class: 'wf-chip', type: 'button' }, suggestion);
      chip.addEventListener('click', () =>
        withBusy(async () => {
          state.draft[fieldNamed('Cidade').id] = { value: suggestion, from: 'manual' };
          await refreshTagSuggestions();
          renderAll();
        })
      );
      box.append(chip);
    }
    if (box.children.length) wrap.append(box);

    const linkInfo = h('div', { class: 'wf-origin' }, '');
    cities.linkFor(input.value).then((r) => {
      linkInfo.textContent = r.link ? `Grupo: ${truncate(r.link, 46)} (${r.source})` : r.reason || '';
    });
    wrap.append(linkInfo);
  }

  /**
   * Aplica sozinho, ao abrir o contato, só o que é determinístico.
   *
   * O laço de trabalho é assíncrono: você pede nome e cidade, passa para o próximo contato e
   * volta quando a pessoa respondeu. É na REABERTURA que a classificação precisa já estar
   * feita — clicar Salvar oito mil vezes é o trabalho que a extensão existe para eliminar.
   *
   * O que entra sem perguntar: o COREDE e as etiquetas de conteúdo (regex que você mesmo
   * escreveu — ou a palavra está na mensagem ou não está). Palpite aproximado, cidade não
   * reconhecida e nome continuam em amarelo esperando seu clique — errar aqui grava dado errado
   * em contato real, e a extensão não sabe desfazer.
   *
   * **A cidade NÃO entra sem perguntar**, mesmo casando exato com o IBGE: casar exato prova que
   * o texto é nome de município, não que seja a cidade dele. Ver `confirmarCidadeSePendente`, que
   * roda dentro de `saveClassification` inclusive nesta chamada automática. O COREDE vai junto
   * com a resposta dela: recusada a cidade, a sugestão de região some antes da gravação.
   *
   * Nada é sobrescrito: valor que já veio do CRM é sempre pulado.
   */
  async function aplicarAutomatico() {
    if (!state.settings.autoApply || !state.hasContract) return;

    const temExato = state.classify.some((f) => {
      const e = state.draft[f.id];
      return e?.from === 'palpite' && e.confidence === 'exata';
    });
    const temEtiqueta = state.tagSuggestions.some((s) => s.marcada && s.tag && etiquetaConfiavel(s));

    // A data de conclusão entra junto com o resto, e não só no Salvar manual. A regra está em
    // fields.deveCarimbarData, separada para poder ser testada.
    const faltaData = fieldsLib.deveCarimbarData({
      dataVazia: dataDeConclusaoVazia(),
      temExato,
      temEtiqueta,
      temCidade: !!valueNamed('Cidade'),
    });

    if (!temExato && !temEtiqueta && !faltaData) return;

    await saveClassification({
      somenteExatos: true,
      quiet: true,
      automatico: true,
      withCompletionDate: faltaData,
    });
  }

  function dataDeConclusaoVazia() {
    const campo = state.schema.find((f) => f.name === fieldsLib.COMPLETION_FIELD);
    if (!campo) return false;
    const entry = state.draft[campo.id];
    return !entry || entry.value == null || entry.value === '';
  }

  /**
   * A etiqueta de região vale-se da cidade: se a cidade é palpite aproximado, o COREDE herda a
   * dúvida e não pode ser gravado sozinho. Regra de conteúdo é literal e não tem esse problema.
   */
  function etiquetaConfiavel(sugestao) {
    // 'cidade' entra junto com 'região': as duas SAEM da cidade, então herdam a dúvida dela.
    // Sem isto, palpite aproximado gravaria a etiqueta da cidade sozinho — e a etiqueta é o que
    // ele usa para filtrar, então errar aqui suja o filtro, não só o campo.
    if (sugestao.origem !== 'região' && sugestao.origem !== 'cidade') return true;
    const campo = fieldNamed('Cidade');
    const entry = campo && state.draft[campo.id];
    // `confirmada` = você respondeu "Aceitar" no popup. Vale tanto quanto valor do CRM: foi você
    // que olhou a conversa e decidiu. Sem isso, aceitar a cidade gravava o campo e deixava as
    // etiquetas de fora — o oposto de "o gatilho é a cidade".
    return entry?.from === 'crm' || entry?.confidence === 'exata' || entry?.confirmada === true;
  }

  /**
   * As etiquetas de COREDE que precisam sair — as que não são a da cidade deste contato.
   *
   * Duas portas levam aqui, e a segunda demorou a aparecer:
   *
   * 1. a cidade foi **substituída** (a pessoa informou outra): o COREDE antigo vira informação
   *    errada. Meia substituição deixaria o contato com dois COREDEs;
   * 2. a cidade **preencheu um buraco** e o contato já carregava um COREDE de antes. Visto ao
   *    vivo: contato com Cidade "Caçapava do Sul" (COREDE Campanha) e a etiqueta "Médio Alto
   *    Uruguai" pendurada junto. Como `substituiu` era nulo, nada saía — e dois COREDEs num
   *    contato é o mesmo dado errado da porta 1, só que por outro caminho.
   *
   * Só sai a antiga quando a certa **fica**: ou vai ser aplicada agora, ou o contato já a tem.
   * Tirar a antiga sem pôr a nova deixa o contato sem COREDE nenhum, que é pior que os dois. E é
   * o caso comum na porta 2: a etiqueta certa já está aplicada, então ela nem aparece em
   * `aplicaveis` (`marcada` é falso justamente para não reaplicar o que já está lá).
   *
   * @param {Array} aplicaveis as sugestões que esta gravação vai aplicar (já filtradas)
   */
  async function etiquetasDeRegiaoASair(aplicaveis) {
    const campo = fieldNamed('Cidade');
    const entrada = campo && state.draft[campo.id];

    /**
     * Duas famílias saem por cidade trocada: a REGIÃO e a CIDADE.
     *
     * A de região existe desde sempre. A de cidade entrou em 20/08/2026, junto com a etiqueta de
     * cidade no fluxo normal — e sem ela o defeito é pior que o do COREDE: trocar de cidade
     * deixaria o contato com "CAXIAS DO SUL" **e** "PELOTAS", aparecendo nos dois filtros de
     * cidade. Era exatamente o que a limpeza de COREDE existe para evitar, um nível abaixo.
     *
     * `etiquetaConfiavel` é a mesma trava para as duas: cidade de palpite não-exato não manda
     * tirar etiqueta nenhuma.
     */
    const familias = ['região', 'cidade'].map((origem) => {
      const nova = state.tagSuggestions.find((s) => s.origem === origem && s.tag) || null;
      const fica = nova && (aplicaveis.includes(nova) || etiquetaConfiavel(nova));
      return { origem, fica: fica ? nova.tag : null };
    });

    // Sem troca de cidade e sem nada que fique: nem carrega as listas — resolver isso contra as
    // etiquetas do CRM custa passadas que não valem a cada gravação.
    if (!entrada?.substituiu && !familias.some((f) => f.fica)) return [];

    const [regioes, cidades, todas] = await Promise.all([
      tagsLib.regionTagIds(),
      tagsLib.cityTagIds(),
      tagsLib.allTags(),
    ]);
    const conjunto = { 'região': regioes, cidade: cidades };

    const sair = new Set();
    for (const { origem, fica } of familias) {
      // Nada que fique nesta família = não mexe nela. Tirar a antiga sem pôr a nova deixaria o
      // contato sem etiqueta de lugar nenhuma, que é pior que a antiga errada.
      if (!fica) continue;
      for (const id of state.contact.tagsId || []) {
        if (conjunto[origem].has(id) && id !== fica.id) sair.add(id);
      }
    }

    return [...sair].map((id) => todas.find((t) => t.id === id)).filter(Boolean);
  }

  /**
   * A etiqueta de fluxo dos sem retorno, quando o contato aberto a tem. `null` fora disso.
   *
   * Ela é a razão de o contato aparecer na lista filtrada: concluir sem tirá-la devolve a pessoa
   * ao TOPO dessa lista, e ela vira trabalho de novo amanhã, já tendo sido trabalhada hoje.
   * Foi o que ele pediu — *"retirar a etiqueta de sem retorno para quando concluir ela não
   * voltar pro topo dos concluídos"*.
   *
   * É a única etiqueta que a extensão tira sem ser COREDE. Resolvida pelo NOME configurado, e
   * só sai se estiver mesmo aplicada — na dúvida, não mexe em etiqueta de ninguém.
   */
  async function etiquetaSemRetornoDoContato() {
    const nome = String(state.auto.cfg.etiquetaSemRetorno || '').trim();
    if (!nome || !state.contact) return null;
    const tag = await tagsLib.resolveTag(nome);
    if (!tag) return null;
    return (state.contact.tagsId || []).includes(tag.id) ? tag : null;
  }

  async function saveClassification({
    withCompletionDate = false,
    quiet = false,
    somenteExatos = false,
    automatico = false,
    tirarSemRetorno = false,
  } = {}) {
    // Único lugar que escreve no CRM, então é aqui que a cidade é confirmada — inclusive na
    // gravação automática, que era justamente a que passava batido.
    const alvo = state.contact?.id || null;
    await confirmarCidadeSePendente(somenteExatos);

    /**
     * A pergunta é a única espera longa que existe no meio de uma gravação — e ela é
     * **não-bloqueante de propósito**, para você poder ler a conversa e trocar de atendimento
     * enquanto decide. Ou seja: quando ela responde, o contato aberto pode ser outro.
     *
     * O `changes` abaixo é montado do `state.draft`, e o `writeValues` manda para
     * `state.contact.id` — os dois já apontam para a pessoa nova. Gravar aqui é gravar dado de
     * um em outro, e é escrita em produção, em base de eleitor real. Na dúvida, não grava:
     * a próxima abertura do contato certo refaz tudo do zero, sem custo nenhum.
     */
    if ((state.contact?.id || null) !== alvo) {
      if (!quiet) setStatus('Você trocou de atendimento no meio — não gravei nada.', 'err');
      return false;
    }

    const changes = {};
    for (const field of state.classify) {
      const entry = state.draft[field.id];
      if (!entry || entry.from === 'crm') continue; // não reescreve o que já estava lá
      if (somenteExatos && !(entry.from === 'palpite' && entry.confidence === 'exata')) continue;
      const empty = entry.value == null || entry.value === '' || (Array.isArray(entry.value) && !entry.value.length);
      if (!empty) changes[field.id] = entry.value;
    }

    // Data de conclusão só preenche buraco, nunca reescreve: um contato concluído em 05/08 não
    // pode virar 06/08 porque você reabriu a conversa para conferir.
    if (withCompletionDate && dataDeConclusaoVazia()) {
      const completion = state.schema.find((f) => f.name === fieldsLib.COMPLETION_FIELD);
      if (completion) changes[completion.id] = fieldsLib.hojeLocal();
    }

    const aplicaveis = state.tagSuggestions.filter(
      (s) => s.marcada && s.tag && (!somenteExatos || etiquetaConfiavel(s))
    );
    const etiquetas = aplicaveis.map((s) => s.tag);

    // COREDE que não é o da cidade deste contato tem que sair. Só saem etiquetas que são COREDE
    // (lista oficial) — etiqueta de conteúdo e de fluxo ("1 SEM RETORNO") nunca entram nesta
    // conta. A lista das aplicáveis vai junto: tirar a antiga sem pôr a nova é pior que as duas.
    const remover = await etiquetasDeRegiaoASair(aplicaveis);

    // Só quando quem chamou está CONCLUINDO. Um Salvar no meio do trabalho não pode tirar a
    // etiqueta: o contato sumiria da lista filtrada ainda faltando ser atendido.
    if (tirarSemRetorno) {
      const semRetorno = await etiquetaSemRetornoDoContato();
      if (semRetorno) remover.push(semRetorno);
    }

    if (!Object.keys(changes).length && !etiquetas.length && !remover.length) {
      if (!quiet) setStatus('Nada novo para gravar.');
      return true;
    }

    const contract = await store.get('writeContract');
    if (!contract?.entries?.length) {
      setStatus(fieldsLib.NO_CONTRACT, 'err');
      return false;
    }

    setStatus('Gravando no CRM…');
    const results = Object.keys(changes).length
      ? await fieldsLib.writeValues(state.contact.id, changes)
      : [];

    const gravados = results.filter((r) => r.ok).map((r) => r.name);
    const problemas = results.filter((r) => !r.ok).map((r) => `${r.name}: ${r.error}`);

    // As etiquetas são tentadas mesmo se algum campo falhou: melhor gravar o que dá do que
    // perder tudo por causa de um campo.
    if (etiquetas.length || remover.length) {
      const resultado = await tagsLib.applyTags(
        state.contact,
        etiquetas.map((t) => t.id),
        { remover: remover.map((t) => t.id) }
      );
      if (!resultado.ok) {
        problemas.push(`etiquetas: ${resultado.error}`);
      } else if (!resultado.skipped) {
        gravados.push(...etiquetas.map((t) => t.label));
        if (remover.length) gravados.push(...remover.map((t) => `−${t.label}`));
      }
    }

    // Confere no CRM em vez de acreditar no 200. Também é o que dispensa o F5: o painel passa
    // a mostrar o que o servidor devolveu, não o que a gente torceu para ter acontecido.
    const conferencia = await confirmarNoCrm(changes, etiquetas);
    problemas.push(...conferencia.naoGravou.map((n) => `${n}: a API aceitou mas não gravou`));

    /**
     * O que bloqueia o FLUXO: campos do contato. **Etiqueta não bloqueia mais.**
     *
     * `etiquetas` estava aqui, e em 20/08/2026 isso parou o envio de modelos. A cadeia: a etiqueta
     * de CIDADE passou a ser sugerida no fluxo normal (nova para quase todo contato), a
     * conferência via que ela não entrou no CRM, o problema entrava como bloqueante, e
     * `saveClassification` devolvia `false` — então a rodada retornava *"a classificação não
     * gravou; não enviei nada"* e **o modelo aprovado não saía**.
     *
     * A prioridade estava invertida: etiqueta é organização interna, a mensagem é o que o contato
     * recebe. Etiqueta que não entrou continua aparecendo no status e no log — dá para reprocessar
     * pela aba Cidades a qualquer momento —, mas não impede mais alguém de ser atendido.
     *
     * Cidade e data de conclusão **continuam** bloqueando: são campos do próprio contato, e
     * seguir com eles errados é classificar errado.
     */
    const essenciais = ['Cidade', fieldsLib.COMPLETION_FIELD];
    const bloqueantes = problemas.filter((p) => essenciais.some((e) => p.startsWith(e)));

    const prefixo = automatico ? 'Aplicado sozinho' : 'Confirmado no CRM';
    setStatus(
      (conferencia.confirmados.length
        ? `${prefixo}: ${conferencia.confirmados.join(', ')}`
        : `Gravado: ${gravados.join(', ') || 'nada'}`) +
        (problemas.length ? ` — PROBLEMA: ${problemas.join(' | ')}` : ''),
      problemas.length ? 'err' : 'ok'
    );

    /**
     * Problema não-bloqueante dentro de uma rodada some da tela.
     *
     * O status é sobrescrito pela linha seguinte da rodada, então uma etiqueta que não entrou —
     * que agora **não** para o envio, de propósito — passaria sem registro. Vai para o log da
     * rodada, que é onde ele olha depois, senão o conserto de hoje trocaria um envio travado por
     * uma falha silenciosa.
     */
    if (problemas.length && state.auto.rodando) {
      // 'aviso' de propósito, e não 'pulado': o contato NÃO foi pulado — ele foi atendido, só
      // ficou um problema de gravação para trás. 'pulado' inflaria a contagem do resumo e faria
      // a rodada parecer que deixou gente sem atender.
      registrarNaRodada(state.contact?.name || 'contato', 'aviso', `atendido, mas: ${problemas.join(' | ')}`);
    }

    renderAll();
    return bloqueantes.length === 0;
  }

  /**
   * Relê o contato e confirma o que ficou gravado de verdade.
   *
   * Existe porque a API responde **200 ignorando o valor** quando o formato não serve — foi
   * assim que a Data de conclusão passou dias "gravando" sem gravar. E porque o painel nativo
   * da plataforma só relê no F5: conferir cada contato à mão é inviável em oito mil.
   */
  async function confirmarNoCrm(changes, etiquetas) {
    const confirmados = [];
    const naoGravou = [];

    let contato;
    try {
      contato = await api.getContact(state.contact.id);
    } catch (err) {
      // Não conseguir conferir não é o mesmo que ter falhado: avisa sem acusar erro de escrita.
      return { confirmados: [], naoGravou: [], erro: err.message };
    }

    state.contact = contato;
    const atuais = fieldsLib.readValues(contato);

    for (const [fieldId, esperado] of Object.entries(changes)) {
      const nome = state.schema.find((f) => f.id === fieldId)?.name || fieldId;
      if (mesmoValor(atuais[fieldId], esperado)) {
        confirmados.push(nome);
        state.draft[fieldId] = { value: atuais[fieldId], from: 'crm' };
      } else {
        naoGravou.push(nome);
      }
    }

    const idsNoCrm = new Set(contato.tagsId || []);
    for (const tag of etiquetas) {
      if (idsNoCrm.has(tag.id)) confirmados.push(tag.label);
      else naoGravou.push(`etiquetas (${tag.label})`);
    }

    await refreshTagSuggestions();
    return { confirmados, naoGravou };
  }

  /** Data volta com hora, múltipla escolha volta fora de ordem — nada disso é diferença real. */
  function mesmoValor(doCrm, esperado) {
    if (doCrm == null) return false;
    if (Array.isArray(esperado) || Array.isArray(doCrm)) {
      const a = [...(Array.isArray(doCrm) ? doCrm : [doCrm])].sort();
      const b = [...(Array.isArray(esperado) ? esperado : [esperado])].sort();
      return a.length === b.length && a.every((v, i) => String(v) === String(b[i]));
    }
    const x = String(doCrm).trim();
    const y = String(esperado).trim();
    if (x === y) return true;
    // "2026-08-05T00:00:00" x "2026-08-05"
    return /^\d{4}-\d{2}-\d{2}/.test(x) && /^\d{4}-\d{2}-\d{2}/.test(y) && x.slice(0, 10) === y.slice(0, 10);
  }

  /**
   * Grava UM ajuste relendo o que está no storage antes.
   *
   * Gravar o `state.settings` inteiro (que é um retrato do momento em que o contato carregou)
   * apagava a largura do painel e o aberto/fechado, que o main.js grava por outro caminho:
   * bastava você redimensionar o painel e depois marcar qualquer caixa aqui.
   */
  async function salvarAjuste(mudancas) {
    const atual = await store.get('settings');
    state.settings = { ...atual, ...mudancas };
    await store.set('settings', state.settings);
  }

  // ---- aba Cidades -------------------------------------------------------

  /**
   * Categorização da base por etiqueta de cidade.
   *
   * **O problema:** a API da plataforma só filtra por etiqueta, e a etiqueta de região (COREDE)
   * agrupa dezenas de municípios. Sem uma etiqueta por cidade não existe "todos de Santo Ângelo".
   *
   * **A forma:** varre a base lendo, mostra o que pretende fazer, e só grava quando você aperta —
   * em lotes do tamanho que você escolher. Nada de rodada longa disparando sozinha: foi decisão
   * dele (15/08), depois de a rajada derrubar a API e a plataforma junto.
   */
  /**
   * Carrega o que a aba Cidades precisa — **e só quando você clica nela**.
   *
   * Isto morava dentro do `renderCidades()`, e ali era desenho, não escolha: `renderAll()` roda
   * o tempo todo (troca de atendimento, mensagem nova, cada `setStatus`), então a aba refazia a
   * tentativa a cada redesenho enquanto estivesse aberta — e, quando a listagem falhava, virava
   * uma tentativa por redesenho, sem ninguém ter pedido nada. Pedido dele: *"faça com que a aba
   * cidades não abra junto, somente quando eu realmente clicar nela"*.
   *
   * `preparando` guarda as duas pontas: não dispara duas vezes se você clicar rápido na aba, e
   * **não tenta de novo sozinho** se falhar — quem decide repetir é o botão "Tentar de novo".
   */
  let cidadesPreparando = false;

  async function prepararCidades() {
    const c = state.cidades;
    if (c.etiquetasDisponiveis.length || cidadesPreparando) return;

    cidadesPreparando = true;
    c.erroEtiquetas = '';
    try {
      const [todas, regioes] = await Promise.all([tagsLib.allTags(), tagsLib.regionTagIds()]);
      c.etiquetasDisponiveis = [...todas].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
      c.idsDeCorede = [...regioes];
    } catch (err) {
      // O erro vai para a TELA, não só para o console: sem isso o seletor ficava eternamente em
      // "Carregando a lista de etiquetas…" e não havia como saber que a busca tinha falhado.
      c.erroEtiquetas = err.message;
      console.warn('[WhatsFill] não consegui listar as etiquetas:', err.message);
    } finally {
      cidadesPreparando = false;
      if (state.tab === 'cidades') renderAll();
    }
  }

  function renderCidades() {
    const c = state.cidades;

    body.append(
      h('p', { class: 'wf-hint' },
        'A API da plataforma só filtra por etiqueta, e o COREDE agrupa dezenas de municípios. ' +
          'Esta aba dá a cada contato a etiqueta da própria cidade, somada às que ele já tem.')
    );

    // O aviso mais importante da aba, e ele vem primeiro por um motivo: foi assim que uma passada
    // inteira se perdeu em silêncio.
    body.append(
      h('div', { class: 'wf-block' },
        'DEIXE ESTA ABA VISÍVEL enquanto roda. O Chrome CONGELA aba em segundo plano — o laço ' +
          'para no meio sem erro nenhum. A extensão toca um áudio inaudível para evitar isso, mas ' +
          'ele não sobrevive a tudo: minimizar a janela ou o computador suspender ainda param a ' +
          'passada. O log avisa se o áudio cair.')
    );

    // --- passo 1: varrer -------------------------------------------------
    const cardLer = h('div', { class: 'wf-card' }, [
      h('h4', {}, '1. Ler a base'),
      h('div', { class: 'wf-preview' },
        'Percorre os contatos e monta o retrato do que falta. Só leitura — nada é gravado neste ' +
          'passo. Precisa ser refeito se você recarregar o painel.\n\n' +
          'Vai até o fim sozinho, página por página, com respiro entre elas. Se você parar (ou se ' +
          'o teto interromper), o botão vira "Continuar" e retoma de onde ficou — não relê o que ' +
          'já leu.'),
    ]);
    cardLer.append(
      campoNumero('Ler no máximo — 0 = tudo (recomendado)', c.limiteLeitura, (v) => {
        c.limiteLeitura = clampInt(v, 0, 200000);
        renderAll();
      })
    );

    /**
     * Filtro por ETIQUETA, no servidor. É o que evita ler 57 mil para trabalhar 586.
     *
     * Três tipos de escolha, e a do meio é a que ele pediu:
     *  - todos os contatos (sem filtro);
     *  - **todos os COREDEs de uma vez** — o filtro aceita vários ids com `tagsOperator: 'OR'`,
     *    então dá para pedir "quem tem QUALQUER etiqueta de região" numa consulta só. É a fatia
     *    que interessa para esta aba: quem tem COREDE já passou pela classificação;
     *  - uma etiqueta específica.
     *
     * As opções vão em `optgroup` porque a lista do CRM é longa e misturada — no print dele,
     * COREDEs apareciam entre "Procura emprego ou dinheiro" e "Amigos do Capitão…". Separar as
     * regiões do resto é o que torna a lista utilizável.
     */
    const selEtiqueta = h('select', {});
    selEtiqueta.append(h('option', { value: '' }, '— todos os contatos —'));

    const idsCorede = new Set(c.idsDeCorede || []);
    const todas = c.etiquetasDisponiveis || [];
    const regioes = todas.filter((t) => idsCorede.has(t.id));
    const outras = todas.filter((t) => !idsCorede.has(t.id));

    if (regioes.length) {
      const optTodos = h('option', { value: TODOS_OS_COREDES }, `— todos os COREDEs (${regioes.length}) —`);
      if (c.etiquetaFiltro === TODOS_OS_COREDES) optTodos.selected = true;
      selEtiqueta.append(optTodos);
    }

    for (const [rotulo, lista] of [['COREDEs (região)', regioes], ['Outras etiquetas', outras]]) {
      if (!lista.length) continue;
      const grupo = h('optgroup', { label: rotulo });
      for (const t of lista) {
        const opt = h('option', { value: t.id }, t.label);
        if (t.id === c.etiquetaFiltro) opt.selected = true;
        grupo.append(opt);
      }
      selEtiqueta.append(grupo);
    }
    selEtiqueta.addEventListener('change', () => {
      c.etiquetaFiltro = selEtiqueta.value;
      // Trocar o filtro invalida a continuação: retomar a página 7 de outra consulta juntaria
      // contatos de duas listas diferentes.
      reiniciarLeituraDeCidades();
      renderAll();
    });
    cardLer.append(h('label', { class: 'wf-field' }, [h('span', {}, 'Só quem tem a etiqueta'), selEtiqueta]));
    if (!(c.etiquetasDisponiveis || []).length) {
      if (cidadesPreparando) {
        cardLer.append(h('div', { class: 'wf-origin' }, 'Carregando a lista de etiquetas do CRM…'));
      } else {
        // Falhou (ou nem chegou a rodar): botão explícito, e nenhuma tentativa automática. Uma
        // listagem que falha costuma ser limite de requisições — repetir sozinho piora.
        const tentar = h('button', { class: 'wf-btn', type: 'button' }, 'Carregar a lista de etiquetas');
        tentar.addEventListener('click', () => prepararCidades());
        cardLer.append(
          h('div', { class: 'wf-block' },
            c.erroEtiquetas
              ? `Não consegui listar as etiquetas: ${c.erroEtiquetas}`
              : 'A lista de etiquetas ainda não foi carregada.'),
          h('div', { class: 'wf-row' }, [tentar])
        );
      }
    }

    const inputBusca = h('input', { type: 'text', value: c.busca, placeholder: 'deixe vazio para não filtrar por texto' });
    inputBusca.addEventListener('change', () => {
      if (c.busca === inputBusca.value.trim()) return;
      c.busca = inputBusca.value.trim();
      reiniciarLeituraDeCidades();
      renderAll();
    });
    cardLer.append(h('label', { class: 'wf-field' }, [h('span', {}, 'Filtrar por texto (opcional)'), inputBusca]));

    // Parou no meio? O botão vira Continuar e diz de onde — clicar não pode refazer o já lido.
    const pausada = !c.lendo && c.proximaPagina > 1;
    const btnLer = h('button', { class: 'wf-btn wf-primary', type: 'button' },
      c.lendo
        ? `Lendo… ${c.lidos}${c.total ? ` de ${c.total}` : ''}`
        : pausada
          ? `Continuar da página ${c.proximaPagina} (${c.lidos} lidos)`
          : 'Ler a base');
    btnLer.disabled = c.lendo || c.gravando;
    btnLer.addEventListener('click', () => withBusy(() => lerBaseParaCidades({ continuar: pausada })));

    const linha = [btnLer, botaoParar()];
    if (pausada) {
      const btnZerar = h('button', { class: 'wf-btn', type: 'button' }, 'Recomeçar do zero');
      btnZerar.addEventListener('click', () => {
        reiniciarLeituraDeCidades();
        setStatus('Leitura zerada. O próximo "Ler a base" começa da página 1.');
        renderAll();
      });
      linha.push(btnZerar);
    }
    cardLer.append(h('div', { class: 'wf-row' }, linha));
    body.append(cardLer);

    // Rótulo repetido no CRM: sujeira que atrapalha o filtro dele e faz qualquer comparação por
    // id mentir. Só avisa — apagar etiqueta é decisão dele, e a extensão não apaga etiqueta.
    const repetidas = categorizar.etiquetasComRotuloRepetido(c.etiquetasDisponiveis);
    if (repetidas.length) {
      body.append(
        h('div', { class: 'wf-card' }, [
          h('h4', {}, `⚠ ${repetidas.length} etiqueta(s) com nome repetido no CRM`),
          h('div', { class: 'wf-preview' },
            'Existem etiquetas diferentes com o MESMO nome. O filtro por etiqueta trata as duas ' +
              'como coisas distintas, então um contato pode "ter SERRA" e não aparecer no filtro ' +
              'de SERRA. Vale limpar no CRM — a extensão não apaga etiqueta.'),
          h('div', { class: 'wf-origin' },
            repetidas.slice(0, 10).map((x) => `"${x.rotulo}" (${x.ids.length}×)`).join(' · ')),
        ])
      );
    }

    // Conserto do prefixo antigo. Aparece sozinho, antes de qualquer varredura, porque quem já
    // gravou com o nome errado precisa disto ANTES de gravar mais.
    const comPrefixo = categorizar.etiquetasComPrefixoAntigo(c.etiquetasDisponiveis);
    if (comPrefixo.length) {
      const cardFix = h('div', { class: 'wf-card' }, [
        h('h4', {}, `Corrigir ${comPrefixo.length} etiqueta(s) com "CIDADE: "`),
        h('div', { class: 'wf-preview' },
          'A primeira versão criava a etiqueta como "CIDADE: CAXIAS DO SUL". Renomear no CRM ' +
            'conserta TODOS os contatos que já a receberam de uma vez — a etiqueta é a mesma, ' +
            'muda só o nome. Nenhum contato é tocado.'),
        h('div', { class: 'wf-origin' }, comPrefixo.slice(0, 10).map((x) => `${x.de} → ${x.para}`).join(' · ')),
      ]);
      const btnFix = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Renomear agora');
      btnFix.disabled = c.lendo || c.gravando;
      btnFix.addEventListener('click', () => withBusy(() => corrigirPrefixoDasEtiquetas(comPrefixo)));
      cardFix.append(h('div', { class: 'wf-row' }, [btnFix]));
      body.append(cardFix);
    }

    if (!c.analise) {
      if (c.log.length) renderLogCidades();
      return;
    }

    const a = c.analise;

    // --- o retrato -------------------------------------------------------
    // Todo número aqui é CONTATO, e as linhas que também contam cidades dizem as duas coisas.
    // A primeira versão misturava as unidades — mostrava "Cidades sem etiqueta no CRM: 43" ao
    // lado de contagens de contato, e a pergunta que veio foi exatamente "os 586 têm cidade
    // porque 43 etiquetas?". Número sem unidade na mesma lista é armadilha, não economia.
    const contatosRevisar = a.revisar.reduce((s, x) => s + x.quantos, 0);
    const cidadesACriar = a.faltamCriar.filter((x) => x.tipo === 'cidade').length;
    const coredesACriar = a.faltamCriar.filter((x) => x.tipo === 'corede').length;
    // Quantas ETIQUETAS vão ser gravadas: um contato pode receber cidade e COREDE de uma vez.
    const etiquetasAGravar = a.paraGravar.reduce((s, x) => s + x.etiquetas.length, 0);

    /**
     * O total que DEVE receber etiqueta de cidade, mostrado explicitamente.
     *
     * Ele perguntou olhando a tela: *"são 7474 contatos com corede correto? então todos deviam
     * receber a etiqueta de cidade"*. Estava certo, e a tela não deixava isso visível: mostrava
     * os baldes sem mostrar o total elegível, então "1358 prontos" parecia ser o universo todo
     * em vez de a fatia que dá para fazer agora.
     */
    const elegiveis = a.paraGravar.length + a.jaOk + a.esperandoCriacao;

    const resumo = h('div', { class: 'wf-card' }, [h('h4', {}, 'O que a leitura encontrou')]);
    for (const [rotulo, valor, forte] of [
      ['Contatos lidos', `${c.lidos}`, false],
      ['— sem cidade preenchida', `${a.semCidade}`, false],
      ['— cidade a revisar (não é município do RS)', `${contatosRevisar}, em ${a.revisar.length} grafia(s)`, false],
      ['— sem etiqueta nenhuma (não entram)', `${a.semEtiqueta}`, false],
      ['DEVEM receber etiqueta de cidade', `${elegiveis} contato(s)`, true],
      ['   · já completos', `${a.jaOk}`, false],
      ['   · prontos para gravar AGORA', `${a.paraGravar.length} contato(s) · ${etiquetasAGravar} etiqueta(s)`, true],
      ['   · travados: falta criar a etiqueta', `${a.esperandoCriacao}`, a.esperandoCriacao > 0],
    ]) {
      resumo.append(h('div', { class: forte ? '' : 'wf-origin' }, `${rotulo}: ${valor}`));
    }

    // A soma tem que fechar com os lidos. Se não fechar, é bug de contagem — e é melhor a tela
    // acusar do que eu descobrir por um número estranho num print.
    const soma =
      a.paraGravar.length + a.jaOk + a.semEtiqueta + a.semCidade + a.esperandoCriacao + contatosRevisar;
    if (soma !== c.lidos) {
      resumo.append(h('div', { class: 'wf-block' }, `Atenção: a soma dá ${soma} e foram lidos ${c.lidos}. Isso é bug de contagem — me avise.`));
    }
    resumo.append(
      h('div', { class: 'wf-origin' },
        'Cada contato recebe DUAS etiquetas: a da cidade e a do COREDE dela (planilha oficial da ' +
          'SPGG-RS). As duas vão na mesma requisição — o COREDE não custa escrita a mais.')
    );

    // O "travados" não é uma exclusão: é fila de espera com desbloqueio conhecido. Dizer isso
    // aqui evita a leitura de que só os "prontos agora" vão ser etiquetados algum dia.
    if (a.esperandoCriacao) {
      resumo.append(
        h('div', { class: 'wf-block' },
          `Os ${a.esperandoCriacao} travados NÃO estão de fora: eles só esperam as ` +
            `${a.faltamCriar.length} etiqueta(s) do passo 2 serem criadas. Crie e leia de novo — ` +
            `aí os ${elegiveis} elegíveis ficam todos gravaveis.`)
      );
    }
    body.append(resumo);

    // Contato com COREDE que não é o da cidade dele. Gravar deixa os DOIS, e aí o filtro por
    // região devolve o contato em duas regiões. Só avisa — remover etiqueta é destrutivo, e pode
    // ser a cidade que está errada, não a etiqueta.
    if (a.coredeDivergente?.length) {
      const exemplos = a.coredeDivergente.slice(0, 6).map((x) => {
        const nomes = x.outros
          .map((id) => (c.etiquetasDisponiveis.find((t) => t.id === id) || {}).label || id)
          .join(', ');
        return `${x.cidade} → ${x.corede} (tem: ${nomes})`;
      });
      body.append(
        h('div', { class: 'wf-card' }, [
          h('h4', {}, `⚠ ${a.coredeDivergente.length} contato(s) com COREDE de outra região`),
          h('div', { class: 'wf-preview' },
            'A cidade destes contatos pertence a um COREDE, mas eles têm a etiqueta de OUTRO. ' +
              'Gravar vai somar o certo e deixar o errado — o contato passa a aparecer no filtro ' +
              'das duas regiões. Não removo nada sozinho: pode ser a cidade que está errada, e ' +
              'não a etiqueta. Confira alguns antes de gravar.'),
          h('div', { class: 'wf-origin' }, exemplos.join(' · ')),
        ])
      );
    }

    if (c.etiquetaFiltro) {
      body.append(h('div', { class: 'wf-origin' }, `Filtrado por etiqueta: ${rotuloDoFiltroDeEtiqueta()}.`));
    }

    // --- passo 2: criar as etiquetas que faltam --------------------------
    if (a.faltamCriar.length) {
      const cardCriar = h('div', { class: 'wf-card' }, [
        h('h4', {}, `2. Criar ${a.faltamCriar.length} etiqueta(s)` +
          (coredesACriar ? ` (${cidadesACriar} de cidade, ${coredesACriar} de COREDE)` : ' de cidade')),
        h('div', { class: 'wf-preview' },
          'Estas cidades existem na base e ainda não têm etiqueta no CRM. Sem elas, os contatos ' +
            'dessas cidades não podem ser gravados — o painel não inventa id de etiqueta.'),
        h('div', { class: 'wf-block' },
          'A rota de criar etiqueta foi lida do código do app (PUT /core/v1/tag), mas nunca foi ' +
            'executada de verdade. Por isso a primeira é criada sozinha, como sonda: se ela ' +
            'falhar, nenhuma outra é tentada e o motivo aparece aqui.'),
      ]);
      cardCriar.append(
        h('div', { class: 'wf-origin' },
          'As mais frequentes: ' +
            a.faltamCriar.slice(0, 12).map((x) => `${x.nome} (${x.quantos})`).join(' · ') +
            (a.faltamCriar.length > 12 ? ` … e ${a.faltamCriar.length - 12} outras` : ''))
      );
      const btnCriar = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Criar as etiquetas');
      btnCriar.disabled = c.lendo || c.gravando;
      btnCriar.addEventListener('click', () => withBusy(criarEtiquetasDeCidade));
      cardCriar.append(h('div', { class: 'wf-row' }, [btnCriar]));
      body.append(cardCriar);
    }

    // --- passo 3: gravar em lotes ----------------------------------------
    if (a.paraGravar.length) {
      const cardGravar = h('div', { class: 'wf-card' }, [
        h('h4', {}, `3. Gravar (${a.paraGravar.length} restantes)`),
        h('div', { class: 'wf-preview' },
          'Grava em lote, somando a etiqueta da cidade às que o contato já tem. O ritmo se ajusta: ' +
            'acelera enquanto a API responde bem e recua na primeira recusa. Pode parar no meio — ' +
            'o que já foi gravado não é refeito.'),
      ]);
      const inputLote = campoNumero('Quantos gravar agora', c.lote, (v) => {
        c.lote = clampInt(v, 1, 2000);
        renderAll();
      });
      cardGravar.append(inputLote);

      const btnGravar = h('button', { class: 'wf-btn wf-primary', type: 'button' },
        c.gravando ? 'Gravando…' : `Gravar ${Math.min(c.lote, a.paraGravar.length)} agora`);
      btnGravar.disabled = c.lendo || c.gravando;
      btnGravar.addEventListener('click', () => withBusy(() => gravarLoteDeCidades(c.lote)));
      cardGravar.append(h('div', { class: 'wf-row' }, [btnGravar, botaoParar()]));
      body.append(cardGravar);
    }

    // --- o que precisa de olho humano ------------------------------------
    if (a.revisar.length) {
      const cardRevisar = h('div', { class: 'wf-card' }, [
        h('h4', {}, `Cidades a revisar (${a.revisar.length})`),
        h('div', { class: 'wf-preview' },
          'O campo Cidade é texto livre, e isto não casou com nenhum dos 497 municípios do RS. ' +
            'Nenhuma etiqueta é criada a partir daqui — corrigir o campo no CRM e ler de novo é o ' +
            'caminho. Erro de digitação e cidade de outro estado caem os dois aqui.'),
      ]);
      cardRevisar.append(
        h('div', { class: 'wf-origin' },
          a.revisar.slice(0, 30).map((x) => `"${x.cidade}" (${x.quantos})`).join(' · ') +
            (a.revisar.length > 30 ? ` … e ${a.revisar.length - 30} outras` : ''))
      );
      body.append(cardRevisar);
    }

    renderLogCidades();
  }

  function botaoParar() {
    const c = state.cidades;
    const btn = h('button', { class: 'wf-btn wf-danger', type: 'button' }, 'Parar');
    btn.disabled = !c.lendo && !c.gravando;
    btn.addEventListener('click', () => {
      c.parar = true;
      setStatus('Parando… termino o contato atual e paro.');
    });
    return btn;
  }

  function renderLogCidades() {
    const c = state.cidades;
    if (!c.log.length) return;
    body.append(h('hr', { class: 'wf-sep' }), h('h3', { class: 'wf-h' }, 'Andamento'));
    // Mais recente primeiro: numa passada longa é o fim da lista que interessa.
    for (const linha of [...c.log].reverse().slice(0, 60)) {
      body.append(h('div', { class: linha.erro ? 'wf-block' : 'wf-origin' }, linha.texto));
    }
  }

  function logCidades(texto, erro = false) {
    state.cidades.log.push({ texto, erro });
    // Teto no log: uma passada de 15 mil contatos encheria a memória do painel com texto.
    if (state.cidades.log.length > 400) state.cidades.log.splice(0, 200);
  }

  /**
   * Varre a base e monta o retrato.
   *
   * Lê **só** o que precisa e para de página em página, com respiro entre elas: mesmo leitura é
   * requisição, e a armadilha da rajada não distingue leitura de escrita.
   */
  /**
   * Zera a leitura, para a próxima começar do início.
   *
   * Chamado quando o FILTRO muda: continuar de onde parou só faz sentido sobre a mesma consulta —
   * retomar a página 7 depois de trocar a etiqueta juntaria contatos de duas listas diferentes.
   */
  /**
   * Os ids que vão no filtro, expandindo a sentinela de "todos os COREDEs".
   *
   * O filtro da plataforma usa `tagsOperator: 'OR'`, então uma lista de 28 ids significa "tem
   * qualquer uma delas" — é uma consulta, não 28.
   */
  function idsDoFiltroDeEtiqueta() {
    const c = state.cidades;
    if (!c.etiquetaFiltro) return [];
    if (c.etiquetaFiltro !== TODOS_OS_COREDES) return [c.etiquetaFiltro];
    return c.idsDeCorede || [];
  }

  /** O que está escrito no seletor agora, para o log e para o rodapé do retrato. */
  function rotuloDoFiltroDeEtiqueta() {
    const c = state.cidades;
    if (!c.etiquetaFiltro) return '';
    if (c.etiquetaFiltro === TODOS_OS_COREDES) return `todos os COREDEs (${(c.idsDeCorede || []).length})`;
    return (c.etiquetasDisponiveis.find((t) => t.id === c.etiquetaFiltro) || {}).label || c.etiquetaFiltro;
  }

  function reiniciarLeituraDeCidades() {
    const c = state.cidades;
    c.proximaPagina = 1;
    c.acumulados = [];
    c.lidos = 0;
    c.total = null;
    c.analise = null;
  }

  /**
   * Mantém a aba acordada enquanto a passada roda, e avisa quando não consegue.
   *
   * **Aba escondida é aba CONGELADA, não lenta** — medido neste projeto: `setInterval(120ms)` deu
   * ZERO disparos em mais de um minuto. As rodadas do Automatizado ligam keepalive desde sempre;
   * a aba Cidades nasceu **sem** ele, e o resultado foi o relato: *"eu não abri a página para ele
   * trabalhar, deixando rodando sozinho"* — a leitura e a gravação simplesmente pararam quando a
   * aba saiu da frente, sem erro nenhum na tela.
   *
   * O áudio exige gesto do usuário, e aqui sempre há um: a passada começa por um clique no botão.
   */
  async function acordarParaCidades(oQue) {
    const acordada = await keepalive.ligar();
    if (!acordada.ok) {
      logCidades(`${acordada.motivo}. Deixe esta aba VISÍVEL durante ${oQue}.`, true);
    }
    if (acordada.energia && !acordada.energia.ok) {
      logCidades(
        `Não consegui impedir o computador de suspender (${acordada.energia.motivo}). ` +
          'Se a máquina dormir, a passada para no meio.',
        true
      );
    }
    return acordada;
  }

  async function lerBaseParaCidades({ continuar = false } = {}) {
    const c = state.cidades;
    if (!continuar) reiniciarLeituraDeCidades();

    c.lendo = true;
    c.parar = false;
    if (!continuar) {
      c.log = [];
      // Qual consulta produziu este retrato fica no log: sem isso, dois retratos com números
      // diferentes parecem contradição em vez de filtros diferentes.
      const filtro = rotuloDoFiltroDeEtiqueta();
      logCidades(
        `Lendo ${filtro ? `só quem tem: ${filtro}` : 'todos os contatos'}` +
          (c.busca ? ` · texto "${c.busca}"` : '') +
          (c.limiteLeitura ? ` · teto ${c.limiteLeitura}` : '')
      );
    }
    renderAll();

    const ritmo = new categorizar.Ritmo({ inicialMs: 250, minMs: 120, maxMs: 5000 });

    // Esta aba não depende de contato aberto, mas o schema só é carregado quando um contato
    // carrega. Buscar aqui evita mandar você abrir um atendimento à toa só para varrer a base.
    if (!state.schema.length) {
      try {
        state.schema = await fieldsLib.loadSchema();
      } catch (err) {
        c.lendo = false;
        return setStatus(`Não consegui carregar o schema dos campos: ${err.message}`, 'err');
      }
    }

    const campoCidade = state.schema.find((f) => f.name === 'Cidade');
    if (!campoCidade) {
      c.lendo = false;
      return setStatus('Não achei o campo "Cidade" no schema da plataforma.', 'err');
    }

    // Continua do que já foi lido, em vez de recomeçar. É o que faz a base terminar de ser lida
    // mesmo com paradas no meio.
    const contatos = c.acumulados;
    let pagina = c.proximaPagina;
    let acabou = false;
    await acordarParaCidades('a leitura');

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (c.parar) {
          logCidades(`Parado por você na página ${pagina} — clique em Continuar para retomar daqui.`);
          break;
        }

        let resposta;
        try {
          // Com etiqueta ou busca, vai pelo filtro (`POST /core/v1/contact/filter`), que é o que
          // a tela usa; sem nada, pela listagem simples. As duas devolvem o mesmo envelope.
          resposta = c.etiquetaFiltro || c.busca
            ? await api.filterContacts({
                textSearch: c.busca,
                tagsId: idsDoFiltroDeEtiqueta(),
                page: pagina,
                pageSize: 100,
              })
            : await api.listContacts({ page: pagina, pageSize: 100 });
          ritmo.sucesso();
        } catch (err) {
          if (categorizar.ehLimiteDeTaxa(err.message) && !ritmo.desistir()) {
            const nova = ritmo.recuar();
            logCidades(`A API recusou a página ${pagina} — esperando ${nova}ms e tentando de novo.`, true);
            await esperar(nova);
            continue; // mesma página
          }
          throw err;
        }

        if (resposta.total != null) c.total = resposta.total;
        if (!resposta.itens.length) {
          // Primeira página vazia não é "acabou", é "não veio nada" — e sem dizer isso a tela
          // mostra "Leitura completa: 0 contatos" como se estivesse tudo certo. Foi o relato
          // *"se eu não filtrar ele não faz"*: a consulta voltou vazia e nada explicou por quê.
          if (pagina === c.proximaPagina && !contatos.length) {
            logCidades(
              `A consulta não devolveu NENHUM contato na primeira página (${c.busca || c.etiquetaFiltro ? 'com filtro' : 'sem filtro'}). ` +
                'Se a tela de Contatos mostra contatos, é a consulta da extensão que está errada — me avise.',
              true
            );
          }
          acabou = true;
          break;
        }
        // `countPages` vem no envelope do app: é sinal melhor que "veio menos que o pedido",
        // porque a última página cheia daria falso negativo e pediria uma página vazia à toa.
        const ultimaPagina = resposta.paginas != null && pagina >= resposta.paginas;

        for (const bruto of resposta.itens) {
          const valores = fieldsLib.readValues(bruto);
          contatos.push({
            id: bruto.id,
            tagsId: Array.isArray(bruto.tagsId) ? bruto.tagsId : (bruto.tags || []).map((t) => t.id).filter(Boolean),
            cidade: valores[campoCidade.id] || '',
          });
        }
        c.lidos = contatos.length;
        // A página vira a PRÓXIMA logo depois de consumir esta: se a parada vier agora, o
        // ponteiro já aponta para o lugar certo e nada é lido duas vezes.
        pagina++;
        c.proximaPagina = pagina;
        setStatus(
          `Lendo… ${c.lidos}${c.total ? ` de ${c.total}` : ''}` +
            (resposta.paginas ? ` (página ${pagina - 1} de ${resposta.paginas})` : '')
        );
        renderAll();

        if (ultimaPagina || resposta.itens.length < 100) {
          acabou = true;
          break;
        }
        // Teto opcional: só quando você pediu uma amostra de propósito. O padrão é 0 — vai até o
        // fim sozinho, sem esperar clique nenhum.
        if (c.limiteLeitura && contatos.length >= c.limiteLeitura) {
          logCidades(`Parei no teto de ${c.limiteLeitura} lidos. Clique em Continuar (ou ponha 0 no teto) para seguir.`);
          break;
        }
        await esperar(ritmo.pausaMs);
      }

      c.analise = await analisarParaCidades(contatos);
      const restam = c.total ? Math.max(0, c.total - c.lidos) : 0;
      logCidades(
        (acabou ? 'Leitura COMPLETA' : 'Leitura pausada') +
          `: ${c.lidos} contato(s)${restam ? `, faltam ${restam}` : ''}. ` +
          `${c.analise.paraGravar.length} para gravar, ${c.analise.faltamCriar.length} etiqueta(s) a criar.`
      );
      setStatus(
        (acabou ? 'Leitura completa. ' : `Leitura pausada (faltam ~${restam}). `) +
          `${c.analise.paraGravar.length} contato(s) para gravar.`,
        'ok'
      );
      if (acabou) {
        // Terminou de verdade: a próxima leitura recomeça, senão ela partiria de uma página que
        // já não existe e voltaria vazia.
        c.proximaPagina = 1;
        c.acumulados = [];
      }
    } catch (err) {
      logCidades(`Leitura interrompida: ${err.message}`, true);
      setStatus(err.message, 'err');
    } finally {
      // Se o áudio caiu no meio, a aba pode ter congelado — e isso explica passada curta demais.
      if (!keepalive.ativo()) logCidades('Atenção: o áudio que mantém a aba acordada não estava mais ativo no fim.', true);
      keepalive.desligar();
      c.lendo = false;
      renderAll();
    }
  }

  /** O retrato, com as etiquetas reais do CRM, a lista oficial de municípios e os COREDEs. */
  async function analisarParaCidades(contatos) {
    const [todas, coredes, aliases] = await Promise.all([
      tagsLib.allTags(),
      tagsLib.loadCoredes(),
      store.get('tagAliases'),
    ]);

    const etiquetasPorNome = new Map(todas.map((t) => [cities.normalize(t.label), t]));

    /**
     * Os apelidos entram como chaves extras do mesmo mapa.
     *
     * O nome do COREDE na planilha oficial não é sempre o nome da etiqueta no CRM — "Paranhana
     * Encosta da Serra" está lá como "Vale do Paranhana", "Centro-Sul" como "Centro Sul". A
     * resolução por apelido já existe em `tags.resolveTag`, mas ela é assíncrona e por nome; aqui
     * o mapa é consultado dezenas de milhares de vezes, então os apelidos são achatados uma vez
     * em vez de resolvidos um a um. Sem isto, COREDE existente entraria como "falta criar" e
     * viraria etiqueta duplicada com outro nome.
     */
    for (const [apelido, rotulo] of Object.entries(aliases || {})) {
      const etiqueta = etiquetasPorNome.get(cities.normalize(rotulo));
      if (etiqueta) etiquetasPorNome.set(cities.normalize(apelido), etiqueta);
    }

    // As chaves de `loadCoredes` já são os municípios normalizados — a mesma fonte oficial que a
    // etiqueta de região usa, então cidade e COREDE nunca discordam sobre o que é município.
    const municipios = new Set(Object.keys(coredes));
    const coredePorMunicipio = new Map(Object.entries(coredes));

    return categorizar.analisar(contatos, {
      etiquetasPorNome,
      municipios,
      coredePorMunicipio,
      // Para detectar contato com COREDE que não é o da cidade dele.
      idsDeCorede: await tagsLib.regionTagIds(),
      // A comparação de divergência é por NOME: o CRM tem etiquetas de rótulo repetido, e
      // comparar id produzia "Caxias do Sul → Serra (tem: Serra)" em 1293 contatos.
      rotuloPorId: new Map(todas.map((t) => [t.id, t.label])),
      prefixo: categorizar.PREFIXO_PADRAO,
    });
  }

  /**
   * Renomeia as etiquetas que ficaram com o prefixo antigo.
   *
   * Conserta os contatos já gravados sem tocar em nenhum: a etiqueta é a mesma, muda o rótulo.
   * As cores atuais vão de volta no body porque a rota as exige — omitir resetaria a cor.
   */
  async function corrigirPrefixoDasEtiquetas(lista) {
    const c = state.cidades;
    if (!confirm(
      `Vou renomear ${lista.length} etiqueta(s) no CRM (ex.: "${lista[0].de}" → "${lista[0].para}").\n\n` +
        'Os contatos que já receberam essas etiquetas passam a mostrar o nome novo — nenhum contato é alterado. Confirma?'
    )) {
      return setStatus('Renomeação cancelada.');
    }

    c.gravando = true;
    renderAll();
    await acordarParaCidades('a renomeação');
    const ritmo = new categorizar.Ritmo({ inicialMs: 400, minMs: 200, maxMs: 8000 });
    let feitas = 0;

    try {
      for (const alvo of lista) {
        if (c.parar) break;
        const atual = c.etiquetasDisponiveis.find((t) => t.id === alvo.id) || {};
        try {
          await api.updateTag(alvo.id, alvo.para, { bgColor: atual.bgColor, textColor: atual.textColor });
          feitas++;
          ritmo.sucesso();
          logCidades(`Renomeada: ${alvo.de} → ${alvo.para}`);
        } catch (err) {
          if (categorizar.ehLimiteDeTaxa(err.message) && !ritmo.desistir()) {
            const nova = ritmo.recuar();
            logCidades(`A API recusou — esperando ${nova}ms.`, true);
            await esperar(nova);
          } else {
            logCidades(`Falhou renomear "${alvo.de}": ${err.message}`, true);
          }
        }
        await esperar(ritmo.pausaMs);
      }

      // O cache e o retrato ficaram velhos: os nomes mudaram.
      tagsLib.invalidateTags();
      c.etiquetasDisponiveis = [];
      c.analise = null;
      setStatus(
        `${feitas} etiqueta(s) renomeada(s). Os contatos que já as tinham estão corrigidos — ` +
          'clique em "Ler a base" para atualizar o retrato.',
        'ok'
      );
    } finally {
      if (!keepalive.ativo()) logCidades('Atenção: o áudio que mantém a aba acordada não estava mais ativo no fim.', true);
      keepalive.desligar();
      c.gravando = false;
      renderAll();
    }
  }

  /**
   * Cria as etiquetas de cidade que faltam.
   *
   * A primeira vai sozinha, como sonda: a rota de criação nunca foi conferida ao vivo, e mandar
   * 300 requisições contra uma rota que talvez não exista é a definição de rajada inútil.
   */
  async function criarEtiquetasDeCidade() {
    const c = state.cidades;
    const faltam = c.analise?.faltamCriar || [];
    if (!faltam.length) return;

    if (!confirm(`Vou criar ${faltam.length} etiqueta(s) de cidade no CRM. A primeira vai como teste. Confirma?`)) {
      return setStatus('Criação cancelada.');
    }

    c.gravando = true;
    c.parar = false;
    renderAll();
    await acordarParaCidades('a criação das etiquetas');

    const ritmo = new categorizar.Ritmo({ inicialMs: 400, minMs: 200, maxMs: 8000 });
    let criadas = 0;
    try {
      for (const [i, alvo] of faltam.entries()) {
        if (c.parar) {
          logCidades(`Parado por você depois de ${criadas} etiqueta(s).`);
          break;
        }
        try {
          await api.createTag(alvo.nome);
          criadas++;
          ritmo.sucesso();
          logCidades(`Criada: ${alvo.nome}`);
        } catch (err) {
          if (i === 0) {
            // A sonda falhou: não insiste em mais nenhuma.
            logCidades(`A criação de etiqueta falhou na primeira tentativa: ${err.message}`, true);
            setStatus(
              `Não consegui criar etiqueta pela API (${err.message.slice(0, 160)}). ` +
                'Crie uma à mão no CRM e me diga — pode ser que precise passar pelo gravador, como os outros contratos.',
              'err'
            );
            return;
          }
          if (categorizar.ehLimiteDeTaxa(err.message) && !ritmo.desistir()) {
            const nova = ritmo.recuar();
            logCidades(`A API recusou "${alvo.nome}" — esperando ${nova}ms.`, true);
            await esperar(nova);
          } else {
            logCidades(`Falhou "${alvo.nome}": ${err.message}`, true);
          }
        }
        setStatus(`Criando etiquetas… ${criadas}/${faltam.length}`);
        renderAll();
        await esperar(ritmo.pausaMs);
      }

      // Reler o retrato: as etiquetas novas mudam quem pode ser gravado agora.
      tagsLib.invalidateTags();
      logCidades(`${criadas} etiqueta(s) criada(s). Leia a base de novo para atualizar o retrato.`);
      setStatus(`${criadas} etiqueta(s) criada(s). Clique em "Ler a base" para atualizar.`, 'ok');
    } finally {
      if (!keepalive.ativo()) logCidades('Atenção: o áudio que mantém a aba acordada não estava mais ativo no fim.', true);
      keepalive.desligar();
      c.gravando = false;
      renderAll();
    }
  }

  /**
   * Grava um lote, com ritmo adaptativo.
   *
   * Cada item gravado sai de `paraGravar`, então parar no meio e voltar depois continua de onde
   * ficou sem repetir ninguém — e o contato que falha **fica** na lista, para a próxima tentativa.
   */
  async function gravarLoteDeCidades(quantos) {
    const c = state.cidades;
    const fila = c.analise?.paraGravar || [];
    if (!fila.length) return;

    const lote = Math.min(quantos, fila.length);
    if (!confirm(`Vou gravar a etiqueta de cidade em ${lote} contato(s), somando às que já têm. Confirma?`)) {
      return setStatus('Gravação cancelada.');
    }

    c.gravando = true;
    c.parar = false;
    renderAll();
    await acordarParaCidades('a gravação');

    const ritmo = new categorizar.Ritmo({ inicialMs: 400, minMs: 150, maxMs: 8000 });
    let gravados = 0;
    let falhas = 0;

    try {
      while (gravados + falhas < lote && fila.length) {
        if (c.parar) {
          logCidades(`Parado por você: ${gravados} gravado(s) neste lote.`);
          break;
        }

        const alvo = fila[0];
        // `applyTags` faz a UNIÃO com o que o contato já tem — é o que garante somar em vez de
        // substituir. O objeto sintético carrega as etiquetas atuais lidas na varredura.
        //
        // Cidade e COREDE vão na MESMA requisição: são duas etiquetas, uma escrita. Mandar
        // separado dobraria o custo da passada inteira sem ganhar nada.
        const resultado = await tagsLib.applyTags(
          { id: alvo.contactId, tagsId: alvo.tagsId },
          alvo.etiquetas.map((t) => t.id)
        );

        if (resultado.ok) {
          fila.shift();
          gravados++;
          ritmo.sucesso();

          /**
           * SONDA: confere o primeiro gravado do lote relendo o contato.
           *
           * A regra mais antiga deste projeto é "a API responde 200 e IGNORA o valor quando o
           * formato não serve — nunca confie no 2xx". `saveClassification` sempre conferiu; esta
           * aba não conferia nada, e por isso podia contar 5 mil como gravados sem uma única
           * etiqueta ter entrado. Foi o relato: *"não estou achando os que foram feitos"*.
           *
           * Uma leitura por lote, não por contato: pegar o formato errado exige um exemplo, não
           * uma auditoria — e auditar 5 mil dobraria as requisições da passada inteira.
           */
          if (gravados === 1) {
            const conferida = await conferirEtiquetasGravadas(alvo);
            if (!conferida.ok) {
              logCidades(`SONDA FALHOU: ${conferida.motivo}`, true);
              setStatus(
                `Parei no primeiro contato: ${conferida.motivo} ` +
                  'A API aceitou e não gravou — nada mais foi tentado.',
                'err'
              );
              break;
            }
            logCidades(`Sonda ok: as etiquetas entraram de verdade no primeiro contato.`);
          }
        } else if (categorizar.ehLimiteDeTaxa(resultado.error) && !ritmo.desistir()) {
          const nova = ritmo.recuar();
          logCidades(`A API recusou — esperando ${nova}ms e tentando o mesmo contato de novo.`, true);
          await esperar(nova);
          continue; // não consome do lote: é a mesma tentativa
        } else if (categorizar.ehLimiteDeTaxa(resultado.error)) {
          logCidades('A API continua recusando no teto de espera. Parei para não castigar a plataforma.', true);
          break;
        } else {
          // Erro do próprio contato: sai da fila para não travar o lote, e vai para o log.
          fila.shift();
          falhas++;
          logCidades(`Falhou ${alvo.cidade} (${alvo.contactId}): ${resultado.error}`, true);
        }

        if ((gravados + falhas) % 10 === 0) {
          setStatus(`Gravando… ${gravados}/${lote} (pausa ${ritmo.pausaMs}ms, ${fila.length} na fila)`);
          renderAll();
        }
        await esperar(ritmo.pausaMs);
      }

      c.analise.jaOk += gravados;
      logCidades(
        `Lote encerrado: ${gravados} gravado(s)${falhas ? `, ${falhas} com erro` : ''}. ` +
          `${fila.length} ainda na fila.`
      );
      setStatus(
        `${gravados} contato(s) etiquetado(s)${falhas ? `, ${falhas} com erro` : ''}. ` +
          `${fila.length} restantes.`,
        falhas ? 'err' : 'ok'
      );
    } finally {
      if (!keepalive.ativo()) logCidades('Atenção: o áudio que mantém a aba acordada não estava mais ativo no fim.', true);
      keepalive.desligar();
      c.gravando = false;
      renderAll();
    }
  }

  /**
   * Relê o contato e confirma que as etiquetas entraram de verdade.
   *
   * Existe porque esta API responde **200 ignorando o valor** quando algo não serve — a armadilha
   * mais antiga do projeto. Sem isto, a aba conta como gravado o que a plataforma descartou, e o
   * erro só aparece quando alguém vai procurar os contatos no CRM e não acha.
   */
  async function conferirEtiquetasGravadas(alvo) {
    let contato;
    try {
      contato = await api.getContact(alvo.contactId);
    } catch (err) {
      // Não conseguir CONFERIR é diferente de ter falhado a gravação: não trava o lote por isso.
      return { ok: true, motivo: `não consegui reler para conferir (${err.message})` };
    }

    const agora = new Set(Array.isArray(contato?.tagsId) ? contato.tagsId : []);
    const faltando = alvo.etiquetas.filter((t) => !agora.has(t.id));
    if (!faltando.length) return { ok: true };

    return {
      ok: false,
      motivo:
        `o contato de ${alvo.cidade} continua sem ${faltando.map((t) => `"${t.label}"`).join(' e ')} ` +
        'depois da gravação.',
    };
  }

  /** Espera fatiada, para o Parar não ter que aguardar o intervalo inteiro. */
  async function esperar(ms) {
    const fim = Date.now() + ms;
    while (Date.now() < fim) {
      if (state.cidades.parar) return;
      await new Promise((r) => setTimeout(r, Math.min(150, fim - Date.now())));
    }
  }

  /**
   * **As mensagens dela como a IA precisa ler — com a TRANSCRIÇÃO do áudio junto.**
   *
   * Print da Sueli (03/09/2026): ela mandou 29 segundos de áudio, a plataforma transcreveu na
   * tela (*"tomara que vocês enxerguem as pessoas que não enxergam…"*), e o rascunho saiu falando
   * de presença em evento. Ele: *"a IA não pegou o texto transcrito"*.
   *
   * A causa é `incoming`: ele filtra `m.text`, e o áudio **não tem** `text` — a transcrição mora
   * em `details.transcription.text`, que só chega em `entrantes`. Está escrito no `api.js` desde
   * 31/08 (*"incoming continua exatamente como era: é a base do parser"*), e a ressalva vale para
   * o PARSER, que não deve gravar cidade a partir de fala ouvida por máquina. Para a IA é o
   * contrário: ela existe justamente para os casos que a regex não cobre, e áudio é a maior fatia
   * deles nesta base. O painel já mostra a transcrição na tela; esconder dela era o defeito.
   *
   * A marca `(áudio, transcrito automaticamente)` vai junto de propósito: transcrição erra
   * palavra, e a IA precisa saber que não é o que a pessoa escreveu.
   *
   * Ruído da plataforma continua fora: `prepararEntrantes` esvazia o texto dessas mensagens, e
   * o filtro de vazio as descarta aqui — é o conserto do Carlos, preservado.
   */
  function mensagensParaIA() {
    return (state.entrantes || [])
      .map((m) => {
        const texto = String(m?.texto || '').trim();
        if (!texto) return null;
        // `{texto, at}` e não string solta: o QUANDO de cada mensagem é metade do relógio — a
        // outra metade é o "agora", que `montarContato` escreve no topo do bloco.
        return { texto: m?.transcrito ? `(áudio, transcrito automaticamente) ${texto}` : texto, at: m?.at || null };
      })
      .filter(Boolean);
  }

  /**
   * **A conversa dos DOIS lados, em ordem** — é disto que o rascunho precisa.
   *
   * Print da Maria Geny (03/09/2026): ela mandou um áudio às 21:39, nós já tínhamos respondido às
   * 19:47, e o rascunho respondeu a mensagem anterior à nossa resposta. Ele: *"ignorou a última
   * mensagem da pessoa e a minha resposta, e respondeu a penúltima mensagem dela"*.
   *
   * `mensagensParaIA` manda só o que ELA escreveu — está certo para a DECISÃO (escolher entre as
   * respostas prontas é sobre o que ela pediu), e é insuficiente para ESCREVER: sem a nossa fala no
   * meio, não há como saber o que já foi respondido.
   *
   * Ordena pelo horário porque as duas listas vêm separadas; mensagem sem hora vai para o fim da
   * ordem em que já estava, que é a ordem da própria plataforma.
   */
  function conversaParaIA() {
    const dela = (state.entrantes || []).map((m, i) => ({
      de: 'contato',
      texto: m?.transcrito ? `(áudio, transcrito automaticamente) ${String(m?.texto || '')}` : String(m?.texto || ''),
      at: m?.at || null,
      ordem: i,
    }));
    const nossa = (state.nossas || []).map((m, i) => ({
      de: 'nos',
      texto: String(m?.texto || ''),
      at: m?.at || null,
      ordem: i,
    }));
    return [...dela, ...nossa]
      .filter((m) => m.texto.trim())
      .sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0) || a.ordem - b.ordem)
      // O `at` VAI JUNTO: sem ele a IA sabe a ordem e não sabe o tempo, e foi disso que ele
      // reclamou em 04/09 — "a IA está sem acesso a data e hora atual".
      .map(({ de, texto, at }) => ({ de, texto, at }));
  }
  /**
   * Rascunha com a IA e **deixa o texto no campo de mensagem, para ele mandar.**
   *
   * **Esta função ENVIAVA sozinha até 03/09/2026.** Era o único ponto do projeto em que texto
   * gerado por IA chegava a um eleitor sem ninguém ler, protegido por quatro travas (ligado na
   * Config, zero avisos da revisão, a IA não ter pedido revisão, confiança ≥ 90%).
   *
   * As quatro travas funcionaram — o log mostrava *"rascunho da IA enviado sozinho (confiança 92%,
   * sem avisos)"*. Ele viu a mensagem sair e cortou: *"retire essa mensagem automática, só no modo
   * IA manda sem eu escolher"*. É o desfecho certo: trava boa não transforma texto inventado em
   * texto revisado, e mensagem de WhatsApp não volta.
   *
   * O que sobrou é o laço que ele já fazia à mão — pedir uma resposta a uma IA, ler, ajustar,
   * mandar — sem o copiar e colar. **Quem aperta enviar é ele.**
   *
   * **Dois caminhos chegam aqui.** Até 03/09 só a ESCALADA da IA — quando nenhuma resposta pronta
   * servia. Desde então também a **tecla `i`** da caixa, que é ele pedindo um rascunho de propósito
   * (*"no botão 8 bote a opção chamar IA, que irá botar a resposta na caixa de mensagem sem
   * mandar"*). A função é a mesma nos dois; o que muda é quem decidiu chamá-la.
   *
   * @returns {Promise<{ok:boolean, enviado:boolean, motivo:string}>} `enviado` é sempre falso: a
   *   rodada segue para a caixa de pergunta, que é onde ele escolhe. `ok` diz se o texto chegou ao
   *   campo — quem chama usa isso para não repetir no log a linha que esta função já escreveu.
   */
  async function rascunharParaEle() {
    // `iaTemChave` e não `ia.ligada`: a caixa da rodada governa o gasto AUTOMÁTICO; um rascunho
    // pedido na tecla `i` é escolha dele, contato a contato. Sem chave não há o que chamar.
    if (!state.iaTemChave) return { ok: false, enviado: false, motivo: 'não há chave da API cadastrada na aba Config' };
    const dela = mensagensParaIA();
    if (!dela.length) return { ok: false, enviado: false, motivo: 'o contato não escreveu nada' };
    if (state.session?.expired) return { ok: false, enviado: false, motivo: 'janela de 24h vencida' };

    let rascunho;
    try {
      rascunho = await iaCliente.rascunhar({
        templates: state.templates,
        regras: state.ia.regras,
        gabinete: await gabineteLib.paraOPrompt(dela),
        modelo: state.ia.modelo,
        // Rascunhar precisa dos DOIS lados — ver `conversaParaIA`.
        mensagens: conversaParaIA(),
        // O relógio: sem ele a IA não sabe se a conversa é de agora ou da semana passada.
        agora: new Date(),
        /**
         * **O cadastro inteiro, e não só a cidade.**
         *
         * Anotação dele (03/09/2026, print da Catarina): *"a IA perguntou nome — o nome dela é
         * Catarina, eu apaguei a parte perguntando"*. O nome estava no CRM; a IA não o recebia, e
         * pedir o que já se tem é o jeito mais rápido de a pessoa achar que ninguém leu nada.
         *
         * O nome vai para a IA **saber que já o tem**, não para usar: a regra de não chamar a
         * pessoa pelo nome continua no prompt de sistema, e é decisão dele de 10/08.
         */
        campos: { Nome: valueNamed('Nome') || state.contact?.name || '', Cidade: valueNamed('Cidade') },
      });
    } catch (err) {
      return { ok: false, enviado: false, motivo: `falha ao rascunhar: ${err?.message || err}` };
    }

    const texto = String(rascunho?.texto || '').trim();
    if (!texto) return { ok: false, enviado: false, motivo: 'a IA não escreveu nada' };

    // `setComposerText`, NUNCA `sendText`: a diferença entre as duas é a decisão dele.
    try {
      await page.setComposerText(texto);
    } catch (err) {
      return { ok: false, enviado: false, motivo: `não consegui pôr o rascunho no campo: ${err?.message || err}` };
    }

    /**
     * Os avisos da revisão continuam aparecendo, e continuam **sem esconder o texto**: esconder
     * tiraria a decisão dele, que é justamente o que este caminho passou a existir para devolver.
     */
    const avisos = iaLib.revisarRascunho(rascunho)?.avisos || [];
    registrarNaRodada(
      state.contact?.name || 'contato',
      'refinar',
      `rascunho da IA no campo de mensagem, para você mandar${avisos.length ? ` — confira: ${avisos.join('; ')}` : ''}`
    );
    return { ok: true, enviado: false, motivo: 'rascunho pronto no campo de mensagem' };
  }

  /**
   * A avaliação por IA deste contato.
   *
   * **Esta função foi PERDIDA no merge `c7a6d59` e restaurada em 01/09.** O auto-merge do git a
   * removeu junto com o rascunho automatico, e ninguém notou porque `checar-modulos.mjs` só
   * vê sintaxe: o arquivo continuava válido, com duas chamadas para funções que não existiam.
   *
   * A lição virou armadilha no `CLAUDE.md`: naquele merge eu conferi que nada de PRODUÇÃO se
   * perdeu e não conferi o outro lado. Merge tem dois lados.
   */
  async function avaliarComIA() {
    const cfg = state.ia || {};
    if (!cfg.ligada || !state.contact) return null;

    // Com a transcrição junto: o áudio é a maior fatia do que a regex não cobre nesta base.
    const dela = mensagensParaIA();

    const decisao = await iaCliente.avaliar({
      templates: state.templates,
      regras: cfg.regras,
      gabinete: await gabineteLib.paraOPrompt(dela),
      modelo: cfg.modelo,
      mensagens: dela,
      // O relógio: sem ele a IA não sabe se a conversa é de agora ou da semana passada.
      agora: new Date(),
      campos: Object.fromEntries(
        state.classify.map((f) => [f.name, valueNamed(f.name)]).filter(([, v]) => v)
      ),
      etiquetas: state.tagSuggestions.filter((sg) => sg.tag && sg.jaTem).map((sg) => sg.tag.label),
    });

    // O custo de cada chamada vai para o log da rodada: sem número na tela, "quanto isso está
    // custando" vira palpite — e foi palpite que quase manteve a IA fora do projeto.
    if (decisao?.custo) {
      const c = decisao.custo;
      // "SEM CACHE" só é alarme onde o cache PODERIA ter pego. No Haiku 4.5 o prompt não
      // alcança o mínimo de 4.096 tokens, então o zero é o normal — e alarme que toca sempre
      // é alarme que se aprende a ignorar.
      const podia = iaLib.vaiCachear(
        cfg.modelo || iaLib.MODELO_PADRAO,
        // O MESMO gabinete que foi mandado, não o da textarea: com o dossiê ligado o prompt é
        // maior, e estimar com a fonte errada faria o painel dizer "SEM CACHE" (ou o contrário)
        // sobre um prompt que não é o que saiu.
        iaLib.tokensAproximados(
          iaLib.montarSistema({ templates: state.templates, regras: cfg.regras, gabinete: await gabineteLib.paraOPrompt(dela) })
        )
      );
      const cacheOk = c.cacheLido > 0 ? `cache ${c.cacheLido}` : podia ? 'SEM CACHE' : 'sem cache (esperado)';
      // O dólar vem junto do token: token é diagnóstico (o cache está pegando?), dólar é a
      // pergunta que ele realmente faz. Sem o acumulado do mês, cada linha parece barata e a
      // soma só aparece na fatura.
      const usd = decisao.custoUsd ? ` · US$ ${decisao.custoUsd.toFixed(4)}` : '';
      const mes = decisao.gastoMes ? ` · mês US$ ${(decisao.gastoMes.usd || 0).toFixed(2)}` : '';
      registrarNaRodada('IA', 'pulado', `${decisao.acao} · ${cacheOk} · entrada ${c.entrada} · saída ${c.saida}${usd}${mes}`);
    }
    if (decisao?.aviso) {
      // Teto atingido não é "a IA não decidiu": é uma decisão dele, tomada antes, chegando
      // agora. Vai como aviso para não se perder entre as linhas normais do log.
      const teto = /teto de gasto/i.test(decisao.aviso);
      registrarNaRodada('IA', teto ? 'aviso' : 'pulado', teto ? decisao.aviso : `avaliação não usada: ${decisao.aviso}`);
    }
    return decisao;
  }

  function renderConfigIA() {
    const cfg = state.ia || {};
    body.append(h('h3', { class: 'wf-h' }, 'Avaliação por IA'));

    body.append(
      h('div', { class: 'wf-preview' },
        'A IA lê a conversa e ESCOLHE entre as suas respostas prontas. No caminho normal o que ' +
          'sai é, palavra por palavra, um texto que você escreveu. Ela também pode dizer "este é ' +
          'para você", e aí o contato sai da rodada com a etiqueta de triagem, igualzinho ao que ' +
          'a detecção por texto já faz.'),
      h('div', { class: 'wf-origin' },
        'Ela roda DEPOIS da detecção por texto, e só no que sobrou: o caso conhecido é pego de ' +
          'graça e não depende de a IA estar no ar. Pedido de ajuda e de emprego nunca são ' +
          'enviados por ela — se ela escolher um desses, vira escalada com a sugestão junto.')
    );

    body.append(
      checkbox('Ligar a avaliação por IA (custa por contato avaliado)', !!cfg.ligada, async (v) => {
        await salvarIA({ ligada: v });
        renderAll();
      })
    );

    /**
     * **O que a IA faz e o que ela NÃO faz** — a fronteira, escrita onde ele decide sobre ela.
     *
     * Aqui havia o interruptor que deixava a IA escrever e enviar sozinha, com quatro travas.
     * Elas funcionaram e a mensagem saiu mesmo assim; ele tirou em 03/09: *"retire essa mensagem
     * automática, só no modo IA manda sem eu escolher"*.
     */
    if (cfg.ligada) {
      body.append(
        h('div', { class: 'wf-block' },
          'A IA ESCOLHE entre as suas respostas prontas; ela nunca escreve o que sai. Quando ' +
            'nenhuma pronta serve, ela escala e o rascunho dela cai no campo de mensagem para ' +
            'VOCÊ ler, ajustar e mandar.'),
        h('div', { class: 'wf-origin' },
          'Até a versão 1.79 havia aqui uma caixa que deixava a IA escrever E ENVIAR sozinha, ' +
            'com quatro travas. As travas funcionavam e a mensagem saía mesmo assim — você tirou ' +
            'em 03/09: "retire essa mensagem automática".')
      );
    }

    // A chave fica no armazenamento e NUNCA é relida para a tela: campo de senha, e o que se
    // mostra é se existe ou não. Chave visível no painel é chave que aparece em print.
    const campoChave = h('input', { type: 'password', placeholder: state.iaTemChave ? '•••••• (já salva)' : 'sk-ant-…' });
    const salvarChave = h('button', { class: 'wf-btn', type: 'button' }, 'Salvar chave');
    salvarChave.addEventListener('click', () =>
      withBusy(async () => {
        const valor = campoChave.value.trim();
        if (!valor) return setStatus('Cole a chave antes de salvar.', 'err');
        await store.set('iaChave', valor);
        state.iaTemChave = true;
        campoChave.value = '';
        setStatus('Chave salva. Ela fica só no armazenamento da extensão e não passa pela página.');
        renderAll();
      })
    );
    const apagarChave = h('button', { class: 'wf-btn', type: 'button' }, 'Apagar chave');
    apagarChave.addEventListener('click', () =>
      withBusy(async () => {
        await store.set('iaChave', '');
        state.iaTemChave = false;
        setStatus('Chave apagada.');
        renderAll();
      })
    );
    body.append(
      h('label', { class: 'wf-field' }, [h('span', {}, 'Chave da API (Anthropic)'), campoChave]),
      h('div', { class: 'wf-row' }, [salvarChave, apagarChave]),
      h('div', { class: 'wf-origin' },
        'A chave fica no armazenamento da extensão e a chamada sai do service worker — ela NÃO ' +
          'entra na página do mobiliza. Isso importa: o gancho da extensão roda no mesmo ' +
          'contexto do código deles, e o que está na página, a plataforma lê. Ela também fica ' +
          'fora do backup exportado.')
    );

    const selModelo = h('select', {});
    for (const [id, rotulo] of [
      ['claude-haiku-4-5', 'Haiku 4.5 — o mais barato (~US$ 2,50 por mil contatos)'],
      ['claude-sonnet-5', 'Sonnet 5 — meio-termo (~US$ 4,50 por mil)'],
      ['claude-opus-5', 'Opus 5 — o mais capaz (~US$ 11 por mil)'],
    ]) {
      const opt = h('option', { value: id }, rotulo);
      if (id === (cfg.modelo || iaLib.MODELO_PADRAO)) opt.selected = true;
      selModelo.append(opt);
    }
    selModelo.addEventListener('change', () => salvarIA({ modelo: selModelo.value }).then(renderAll));
    body.append(
      h('label', { class: 'wf-field' }, [h('span', {}, 'Modelo'), selModelo]),
      h('div', { class: 'wf-origin' },
        avisoDoModelo(cfg))
    );
    montarTetoDeGasto(cfg);

    const areaRegras = h('textarea', { rows: '4', placeholder: 'ex.: quem falar em agenda de Caxias esta semana é para mim' });
    areaRegras.value = cfg.regras || '';
    areaRegras.addEventListener('change', () =>
      salvarIA({ regras: areaRegras.value.trim() }).then(() => setStatus('Instruções salvas.'))
    );
    body.append(
      h('label', { class: 'wf-field' }, [h('span', {}, 'Instruções extras para a IA'), areaRegras]),
      h('div', { class: 'wf-origin' },
        'Somam-se às regras de fábrica, nunca as substituem: a de não escrever texto e a de ' +
          'escalar pedido de ajuda ficam de pé mesmo que você escreva o contrário aqui.')
    );

    /**
     * Quem é quem: a chapa, os números, as pautas.
     *
     * Pedido dele (01/09): *"a extensão deve ter salva informações dos candidatos relacionados ao
     * gabinete do capitão martim e sua chapa para a ia não pesquisar toda vez"*.
     *
     * Fica no prompt de SISTEMA, que é a parte cacheada — encher de detalhe custa 10% do preço a
     * partir da segunda chamada. O texto avisa disso, porque a reação natural é economizar palavra
     * onde justamente não precisa.
     */
    const areaGabinete = h('textarea', {
      rows: '6',
      placeholder:
        'Capitão Martim — deputado estadual, Republicanos.\n' +
        'Fulano — candidato a senador, número XX.\n' +
        'Pautas do mandato: segurança, escolas cívico-militares…',
    });
    areaGabinete.value = cfg.gabinete || '';
    areaGabinete.addEventListener('change', () =>
      salvarIA({ gabinete: areaGabinete.value.trim() }).then(() =>
        setStatus(
          areaGabinete.value.trim()
            ? 'Salvei. A IA passa a decidir sabendo quem é quem, sem pesquisar.'
            : 'Vazio: a IA volta a decidir sem saber nada da chapa.'
        )
      )
    );
    body.append(
      h('label', { class: 'wf-field' }, [h('span', {}, 'Quem é quem (chapa, números, pautas)'), areaGabinete]),
      h('div', { class: 'wf-origin' },
        'Serve para DIMINUIR a necessidade de a IA buscar contexto, não para proibi-la de buscar. ' +
          'Sem isto ela decide sobre nomes que não conhece: alguém escreve "vou votar no Marcel ' +
          'para senador" e ela não tem como saber se é aliado, adversário ou outro cargo. Escreva o ' +
          'que a equipe sabe: nome, cargo, número de urna, partido, quem é da chapa, as pautas do ' +
          'mandato. Isto entra na parte CACHEADA do prompt, então custa uma vez e 10% do preço nas ' +
          'chamadas seguintes — detalhe aqui é barato, e é a falta dele que sai caro em decisão ' +
          'errada.')
    );

    /**
     * O dossiê de arquivo (src/data/gabinete.md).
     *
     * Nasce DESLIGADO porque o conteúdo veio de pesquisa na internet, e número de urna errado manda
     * eleitor votar em outra pessoa. Ligar é ato dele, depois de conferir — e a tela diz o porquê
     * em vez de deixar o interruptor mudo.
     */
    const avisoDossie = h('div', { class: 'wf-block' }, 'Conferindo o arquivo do dossiê…');
    const checkDossie = h('input', { type: 'checkbox' });
    checkDossie.checked = !!cfg.dossieAtivo;
    checkDossie.addEventListener('change', () =>
      withBusy(async () => {
        await salvarIA({ dossieAtivo: checkDossie.checked });
        setStatus(
          checkDossie.checked
            ? 'Dossiê LIGADO: o arquivo entra no prompt da IA.'
            : 'Dossiê desligado: só o texto que você escreveu acima vai para a IA.',
          'ok'
        );
      })
    );
    body.append(
      h('label', { class: 'wf-field' }, [
        h('span', {}, 'Usar o dossiê do arquivo (src/data/gabinete.md)'),
        checkDossie,
      ]),
      avisoDossie
    );

    // `renderConfigIA` é SÍNCRONA de propósito (render que espera rede vira tela em branco), então
    // o tamanho do arquivo chega depois e preenche o aviso. Enquanto não chega, o texto já diz o
    // que importa — que está desligado e por quê.
    gabineteLib.estado().then((e) => {
      checkDossie.disabled = !e.temArquivo;
      avisoDossie.className = e.ativo ? 'wf-origin' : 'wf-block';
      avisoDossie.textContent = !e.temArquivo
        ? 'Nenhum arquivo de dossiê encontrado em src/data/gabinete.md.'
        : `O arquivo tem ${e.caracteresArquivo} caracteres e a caixa acima, ${e.caracteresTextarea}. ` +
          'Os dois vão juntos, o arquivo primeiro. ' +
          (e.ativo
            ? 'CONFIRA os números de urna marcados [CONFERIR] no arquivo antes de confiar neles.'
            : 'Está DESLIGADO: o arquivo veio de pesquisa na internet e precisa da sua revisão. Número de urna errado manda eleitor votar em outra pessoa.');
    });

    const testar = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Avaliar o contato aberto');
    testar.disabled = !cfg.ligada || !state.contact;
    testar.addEventListener('click', () =>
      withBusy(async () => {
        const d = await avaliarComIA();
        if (!d) return setStatus('A IA está desligada ou não há contato aberto.', 'err');
        if (d.aviso) return setStatus(`A IA não decidiu: ${d.aviso}`, 'err');
        const alvo = d.templateId ? ` → "${d.templateId}"` : '';
        setStatus(`IA: ${d.acao}${alvo} (${Math.round((d.confianca || 0) * 100)}%) — ${d.motivo}`);
      })
    );
    body.append(h('div', { class: 'wf-row' }, [testar]));
    if (!state.contact) {
      body.append(h('div', { class: 'wf-origin' }, 'Abra um atendimento para poder testar sem gastar uma rodada.'));
    }
    body.append(h('hr', { class: 'wf-sep' }));
  }

  /**
   * O teto de gasto da API.
   *
   * Existe por um mal-entendido que valia dinheiro: a assinatura Claude Pro/Max **não** cobre a
   * API. São faturas separadas, e cada avaliação daqui é despesa nova em cima do plano. Por isso
   * a primeira linha deste bloco é essa frase, e não o campo.
   *
   * **Não há botão de zerar o contador de propósito.** Zerar é o único controle que torna o teto
   * decorativo — precisando de mais, ele levanta o teto, que é uma escolha visível e fica salva.
   * O contador vira sozinho na mudança de mês.
   */
  /**
   * O aviso embaixo do seletor de modelo.
   *
   * Ele muda com o modelo por um motivo específico: o painel ensina que "SEM CACHE" em chamadas
   * seguidas é sinal de problema, e **no Haiku 4.5 isso aparece em toda chamada estando tudo
   * certo** — o prompt tem ~1.300 tokens e o mínimo dele para cachear é 4.096. Alarme que toca
   * sempre é alarme que se aprende a ignorar, e aí ele não toca no dia em que é de verdade.
   */
  function avisoDoModelo(cfg) {
    const modelo = cfg.modelo || iaLib.MODELO_PADRAO;
    const tks = iaLib.tokensAproximados(iaLib.montarSistema({ templates: state.templates, regras: cfg.regras }));
    const cacheia = iaLib.vaiCachear(modelo, tks);
    const base =
      'Estimativa por mil contatos AVALIADOS, não por contato da base: a detecção por texto ' +
      'roda antes e a IA só vê o que sobrou. Já conta o raciocínio do modelo, cobrado como ' +
      'saída. Quem vale é o contador abaixo, que soma o que a API realmente cobrou. ';
    return (
      base +
      (cacheia
        ? 'Neste modelo o cache pega: "SEM CACHE" no log em chamadas seguidas significa conta ' +
          'bem maior, e que alguma coisa no prompt passou a variar.'
        : `Neste modelo o cache NÃO pega e isso é esperado: seu prompt tem ~${tks} tokens e o ` +
          `mínimo para cachear é ${iaLib.CACHE_MINIMO_TOKENS[modelo]}. O log vai dizer "SEM CACHE" ` +
          'em toda chamada — aqui não é defeito, e já está embutido na estimativa acima.')
    );
  }

  function montarTetoDeGasto(cfg) {
    const gasto = cfg.gasto || {};
    const mes = iaLib.mesDe();
    const usado = gasto.mes === mes ? Number(gasto.usd) || 0 : 0;
    const chamadas = gasto.mes === mes ? Number(gasto.chamadas) || 0 : 0;
    const teto = Number(cfg.tetoUsd) || 0;

    body.append(
      h('div', { class: 'wf-block' },
        'A chave da API NÃO usa a sua assinatura do Claude (Pro/Max). São duas cobranças ' +
          'diferentes: a assinatura é do claude.ai e do Claude Code; a API é pré-paga por token, ' +
          'com fatura própria no console.anthropic.com. Ligar a IA aqui gera gasto NOVO em cima ' +
          'do que você já paga — o teto abaixo é o que impede esse gasto de surpreender.')
    );

    const linha = teto > 0
      ? `US$ ${usado.toFixed(2)} de US$ ${teto.toFixed(2)} em ${mes} · ${chamadas} chamada(s)`
      : `US$ ${usado.toFixed(2)} em ${mes} · ${chamadas} chamada(s) · SEM TETO`;
    const estourou = teto > 0 && usado >= teto;
    const perto = teto > 0 && !estourou && usado >= teto * 0.8;

    body.append(
      h('div', { class: estourou || perto ? 'wf-block' : 'wf-preview' },
        estourou
          ? `TETO ATINGIDO — ${linha}. A IA está parada até você levantar o teto ou virar o mês. ` +
            'O resto da extensão segue funcionando normalmente.'
          : perto
            ? `${linha} — passou de 80% do teto.`
            : linha)
    );

    const campoTeto = h('input', { type: 'number', min: '0', step: '1' });
    campoTeto.value = String(teto);
    campoTeto.addEventListener('change', () =>
      withBusy(async () => {
        const v = Math.max(0, Number(campoTeto.value) || 0);
        await salvarIA({ tetoUsd: v });
        setStatus(
          v > 0
            ? `Teto de US$ ${v.toFixed(2)} por mês. A IA para sozinha ao atingir.`
            : 'Teto REMOVIDO — nada limita o gasto da API a partir de agora.',
          v > 0 ? 'ok' : 'err'
        );
        renderAll();
      })
    );

    body.append(
      h('label', { class: 'wf-field' }, [h('span', {}, 'Teto de gasto (US$ por mês, 0 = sem teto)'), campoTeto]),
      h('div', { class: 'wf-origin' },
        'Quem obriga o teto é o service worker, no mesmo lugar onde a chave é usada — não o ' +
          'painel. Atingido, toda chamada vira "incerto" e o painel volta a se comportar como ' +
          'antes da IA existir: a rodada pergunta, você decide. Não há botão de zerar o ' +
          'contador; precisando de mais, levante o teto — assim a decisão fica registrada. ' +
          'O valor é estimado pelos tokens que a API devolve, para decidir parar; a fatura de ' +
          'verdade é a do console.')
    );
  }
  async function salvarIA(mudanca) {
    state.ia = { ...(await store.get('ia')), ...mudanca };
    await store.set('ia', state.ia);
  }

  function renderConfig() {
    renderConfigIA();
    body.append(h('h3', { class: 'wf-h' }, 'Envio'));
    body.append(
      checkbox('Enviar automático (um clique manda a mensagem)', state.settings.autoSend, (v) =>
        salvarAjuste({ autoSend: v })
      ),
      checkbox('Avisar quando o template já foi enviado ao contato', state.settings.antiDup, (v) =>
        salvarAjuste({ antiDup: v })
      ),
      checkbox('Já marcar as etiquetas sugeridas (região e conteúdo)', state.settings.autoTags, async (v) => {
        await salvarAjuste({ autoTags: v });
        await refreshTagSuggestions();
      }),
      checkbox(
        'Gravar sozinho, ao abrir o contato, o que bate exato (COREDE e etiquetas de conteúdo). ' +
          'A cidade pergunta antes, sempre.',
        state.settings.autoApply,
        (v) => salvarAjuste({ autoApply: v })
      )
    );

    const throttleInput = h('input', { type: 'text', value: String(state.settings.throttleMs) });
    throttleInput.addEventListener('change', async () => {
      const value = Math.max(0, parseInt(throttleInput.value, 10) || 0);
      throttleInput.value = String(value);
      await salvarAjuste({ throttleMs: value });
      setStatus(`Intervalo mínimo entre envios: ${value} ms`, 'ok');
    });
    body.append(h('label', { class: 'wf-field' }, [h('span', {}, 'Intervalo mínimo entre envios (ms)'), throttleInput]));

    body.append(h('hr', { class: 'wf-sep' }), h('h3', { class: 'wf-h' }, 'Grupos por cidade'));
    body.append(
      h('p', { class: 'wf-hint' }, 'Uma linha por cidade, no formato "Cidade = link". Acento e maiúscula não importam no casamento.')
    );

    const cityArea = h('textarea', { rows: '7' });
    const defaultInput = h('input', { type: 'text', placeholder: 'link usado quando a cidade não tem grupo' });
    store.get('cityLinks').then((m) => (cityArea.value = cities.formatCityLinks(m)));
    store.get('defaultGroupLink').then((v) => (defaultInput.value = v || ''));

    const cityBtn = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Salvar grupos');
    cityBtn.addEventListener('click', async () => {
      const parsed = cities.parseCityLinksText(cityArea.value);
      await store.set('cityLinks', parsed);
      await store.set('defaultGroupLink', defaultInput.value.trim());
      setStatus(`${Object.keys(parsed).length} cidade(s) salva(s).`, 'ok');
    });
    body.append(cityArea, h('label', { class: 'wf-field' }, [h('span', {}, 'Link padrão (opcional)'), defaultInput]), cityBtn);

    body.append(h('hr', { class: 'wf-sep' }), h('h3', { class: 'wf-h' }, 'Etiquetas por conteúdo'));
    body.append(
      h('p', { class: 'wf-hint' }, [
        'Uma linha por regra, no formato "padrão = Etiqueta". O padrão é casado (sem diferenciar maiúscula) contra as mensagens do contato e a campanha do anúncio. A etiqueta de ',
        h('b', {}, 'região'),
        ' não vem daqui: é o COREDE da cidade, pela tabela oficial da Secretaria de Planejamento do RS.',
      ])
    );

    const rulesArea = h('textarea', { rows: '4' });
    store.get('tagRules').then((rules) => {
      rulesArea.value = rules.map((r) => `${r.padrao} = ${r.etiqueta}`).join('\n');
    });
    const rulesBtn = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Salvar regras');
    rulesBtn.addEventListener('click', () =>
      withBusy(async () => {
        const rules = [];
        const invalidas = [];
        for (const linha of rulesArea.value.split('\n')) {
          const texto = linha.trim();
          if (!texto || texto.startsWith('#')) continue;
          const i = texto.indexOf('=');
          if (i < 0) continue;
          const padrao = texto.slice(0, i).trim();
          const etiqueta = texto.slice(i + 1).trim();
          if (!padrao || !etiqueta) continue;
          try {
            new RegExp(padrao, 'i');
          } catch (_) {
            invalidas.push(padrao);
            continue;
          }
          rules.push({ padrao, etiqueta });
        }
        await store.set('tagRules', rules);
        await refreshTagSuggestions();
        setStatus(
          `${rules.length} regra(s) salva(s).` + (invalidas.length ? ` Ignorei padrão inválido: ${invalidas.join(', ')}` : ''),
          invalidas.length ? 'err' : 'ok'
        );
      })
    );
    body.append(rulesArea, rulesBtn);

    /**
     * **OS ANÚNCIOS DO MOMENTO.**
     *
     * Pedido dele (02/09/2026): *"falta reconhecer o anúncio, nas configurações bote os anúncios do
     * momento onde botarei o texto para ser reconhecido e o que fazer quando for determinado texto
     * do anúncio"*.
     *
     * Substitui a tabela "Modelo por TEXTO da mensagem", que fazia metade disto: reconhecia o
     * anúncio pelo texto e só sabia responder qual modelo mandar. Anúncio sem modelo — convite de
     * evento, pesquisa, anúncio que só traz gente nova — era reconhecido e morria ali. As linhas
     * antigas vêm para cá sozinhas na primeira abertura (`carregarAnuncios`).
     *
     * Vem ANTES da tabela por etiqueta na tela porque vem antes na decisão: reconhecido o anúncio,
     * a ação dele decide, e a etiqueta de conteúdo nem é consultada.
     *
     * Cartões em vez de uma caixa de texto com `chave = valor`: a ação não é um valor, é uma
     * escolha entre quatro, e cada uma pede um alvo diferente (um modelo, uma resposta, nada). Um
     * formato de texto para isso seria uma linguagem que só eu saberia escrever.
     */
    body.append(h('hr', { class: 'wf-sep' }), h('h3', { class: 'wf-h' }, 'Anúncios do momento'));
    body.append(
      h('p', { class: 'wf-hint' },
        'Um cartão por anúncio no ar: o texto que a pessoa manda quando clica nele, e o que fazer ' +
          'quando esse texto aparecer. Casa por trecho CONTIDO na conversa, sem diferenciar acento ' +
          'nem maiúscula — não precisa copiar a mensagem inteira nem se preocupar com o emoji. ' +
          'Havendo dois trechos que casam, ganha o mais específico (o maior).')
    );

    /**
     * **Os modelos padrão do anúncio — e o rodízio entre eles.**
     *
     * Pedidos dele em 02/09/2026: *"caso o texto do anúncio não seja reconhecido será mandado o
     * modelo padrão"* e, em seguida, *"o modelo padrão deve variar entre 3 modelos já que chega
     * bastante gente por eles"*.
     *
     * O segundo pedido tem o mesmo motivo das variações das respostas prontas: quando muita gente
     * chega pela mesma porta, todo mundo receber a frase idêntica é o que faz a mensagem parecer
     * robô. O rodízio anda **um por envio de verdade** — não a cada vez que a caixa da rodada
     * mostra o nome.
     *
     * Fica ACIMA da lista de anúncios porque é o que vale quando a lista não resolve — e porque,
     * sem ele à vista, "o anúncio não foi reconhecido" não teria desfecho visível em lugar nenhum.
     */
    const padraoLinha = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Modelos padrão do anúncio (revezam)'),
      h('div', { class: 'wf-preview' },
        'Saem para quem a plataforma diz que veio de anúncio, mas cujo texto não casou com nenhum ' +
          'da lista abaixo. Com mais de um, eles se revezam a cada envio. Deixe vazio para esses ' +
          'caírem na sua mão como antes.'),
    ]);
    body.append(padraoLinha);

    /**
     * Redesenha só este cartão, relendo do armazenamento — o mesmo motivo da lista de anúncios:
     * o que está na tela tem que ser o que a rodada vai ler.
     */
    async function desenharModelosPadrao() {
      // Tudo depois do título e da explicação é a lista; os dois primeiros filhos ficam.
      while (padraoLinha.children.length > 2) padraoLinha.lastChild.remove();

      /**
       * Aqui a lista é lida CRUA, e não pelo `carregarModelosPadrao`.
       *
       * O carregador peneira os vazios — que é o certo para a rodada, porque nome vazio não é
       * modelo. Mas a tela precisa da linha em branco existindo enquanto ele digita: com o
       * carregador, clicar em "+ modelo" com a lista de aprovados fora do ar criava um item vazio
       * que o gravar descartava na mesma hora, e o botão **não fazia nada, em silêncio**. Peguei
       * abrindo a Config de verdade.
       */
      const salva = await store.get('modelosPadraoAnuncio');
      const antigo = String((await store.get('modeloPadraoAnuncio')) || '').trim();
      const lista = Array.isArray(salva) && salva.length ? salva : antigo ? [antigo] : [];
      const indice = Number(await store.get('modeloPadraoIndex')) || 0;

      const gravar = async (nova) => {
        // Guarda como ele digitou (só sem espaço nas pontas). Quem peneira vazio é a leitura da
        // rodada — `carregarModelosPadrao` e `anuncios.padraoDaVez`, os dois com teste.
        const limpa = nova.map((m) => String(m || '').trim());
        await store.set('modelosPadraoAnuncio', limpa);
        /**
         * O ponteiro volta para dentro da lista quando ela encolhe.
         *
         * Sem isto, apagar o terceiro modelo deixaria o ponteiro em 2 numa lista de 2 — e o
         * `padraoDaVez` cairia no primeiro por causa do resto da divisão, o que funciona, mas o
         * número gravado seria mentira e confundiria a próxima leitura.
         */
        if (indice >= limpa.filter(Boolean).length) await store.set('modeloPadraoIndex', 0);
        await desenharModelosPadrao();
      };

      if (!lista.length) {
        padraoLinha.append(
          h('div', { class: 'wf-hint' },
            'Nenhum modelo padrão. Anúncio que o painel não reconhece cai na sua mão.')
        );
      }

      lista.forEach((nome, i) => {
        const linha = h('div', { class: 'wf-row' });

        /**
         * O da vez fica marcado. É a única forma de ele conferir que o rodízio está andando —
         * rodízio invisível é indistinguível de rodízio parado, e ele descobriria pelo eleitor
         * recebendo sempre a mesma frase.
         */
        linha.append(h('span', { class: 'wf-hint' }, i === indice % Math.max(lista.length, 1) ? '▶' : `${i + 1}.`));

        if (state.hsmTemplates.length) {
          const sel = h('select', {});
          for (const m of state.hsmTemplates) {
            const o = h('option', { value: m.name }, m.name);
            if (m.name === nome) o.setAttribute('selected', 'selected');
            sel.append(o);
          }
          sel.addEventListener('change', () =>
            withBusy(() => gravar(lista.map((x, j) => (j === i ? sel.value : x))))
          );
          linha.append(sel);
        } else {
          const campo = h('input', { type: 'text', placeholder: 'nome exato do modelo' });
          campo.value = nome;
          campo.addEventListener('change', () =>
            withBusy(() => gravar(lista.map((x, j) => (j === i ? campo.value : x))))
          );
          linha.append(campo);
        }

        if (!nome.trim()) linha.append(h('span', { class: 'wf-hint' }, '(vazio — não entra no rodízio)'));

        const tirar = h('button', { class: 'wf-btn wf-mini', type: 'button' }, '×');
        tirar.title = 'Tirar este da lista';
        tirar.addEventListener('click', () => withBusy(() => gravar(lista.filter((_, j) => j !== i))));
        linha.append(tirar);

        padraoLinha.append(linha);
      });

      const somar = h('button', { class: 'wf-btn wf-mini', type: 'button' }, '+ modelo');
      somar.addEventListener('click', () =>
        withBusy(() => gravar([...lista, state.hsmTemplates[0]?.name || '']))
      );
      padraoLinha.append(h('div', { class: 'wf-row' }, [somar]));

      if (!state.hsmTemplates.length) {
        padraoLinha.append(
          h('div', { class: 'wf-hint' },
            'A lista de modelos aprovados não está carregada, então digite os nomes exatos. Abra um ' +
              'atendimento e volte aqui para eu conferir se existem.')
        );
      } else if (lista.length) {
        const desconhecidos = lista.filter(
          (n) => n.trim() && !state.hsmTemplates.some((m) => m.name.trim().toLowerCase() === n.trim().toLowerCase())
        );
        for (const n of desconhecidos) {
          padraoLinha.append(
            h('div', { class: 'wf-origin wf-aviso-anuncio' },
              `⚠ "${n}" não está entre os modelos aprovados da plataforma.`)
          );
        }
      }
    }

    desenharModelosPadrao();

    const anunciosNode = h('div', {});
    body.append(anunciosNode);

    /**
     * Redesenha só a lista, e **relê do armazenamento**.
     *
     * Reler em vez de mexer numa cópia em memória é o que faz duas abas do painel (encaixado e
     * janela) não se sobrescreverem, e é o que garante que o que está na tela é o que a rodada vai
     * ler. A lista é curta — meia dúzia de anúncios —, então o custo é irrelevante.
     */
    async function desenharAnuncios() {
      const lista = await carregarAnuncios();
      anunciosNode.replaceChildren();

      const gravar = async (nova) => {
        await store.set('anuncios', anunciosLib.normalizar(nova));
        await desenharAnuncios();
      };

      if (!lista.length) {
        anunciosNode.append(
          h('p', { class: 'wf-hint' },
            'Nenhum anúncio cadastrado. Sem isto o painel sabe que a pessoa veio de um anúncio (a ' +
              'plataforma informa), mas não de qual — e é o texto que distingue.')
        );
      }

      for (const anuncio of lista) {
        const card = h('div', { class: 'wf-card' });

        // ---- nome e o interruptor -------------------------------------------
        const nome = h('input', { type: 'text', placeholder: 'nome do anúncio (só para você)' });
        nome.value = anuncio.nome;
        nome.addEventListener('change', () =>
          withBusy(() => gravar(lista.map((x) => (x.id === anuncio.id ? { ...x, nome: nome.value } : x))))
        );

        /**
         * Desligar em vez de apagar: a campanha que acabou volta no mês seguinte, e o texto dela
         * é a parte chata de digitar. Desligado, o anúncio não casa com nada.
         */
        const ligado = h('input', { type: 'checkbox' });
        ligado.checked = anuncio.ligado;
        ligado.addEventListener('change', () =>
          withBusy(() => gravar(lista.map((x) => (x.id === anuncio.id ? { ...x, ligado: ligado.checked } : x))))
        );

        const apagar = h('button', { class: 'wf-btn wf-mini', type: 'button' }, 'Apagar');
        apagar.addEventListener('click', () =>
          withBusy(async () => {
            if (!confirm(`Apagar o anúncio "${anuncio.nome || '(sem nome)'}"? O texto dele se perde.`)) return;
            await gravar(lista.filter((x) => x.id !== anuncio.id));
            setStatus('Anúncio apagado.', 'ok');
          })
        );

        card.append(
          h('div', { class: 'wf-row' }, [
            nome,
            h('label', { class: 'wf-switch' }, [ligado, h('span', {}, 'no ar')]),
            apagar,
          ])
        );

        // ---- o texto que reconhece ------------------------------------------
        card.append(h('div', { class: 'wf-hint' }, 'Texto que reconhece — um por linha:'));
        const trechos = h('textarea', { rows: '2', placeholder: 'Olá! Eu apoio as Escolas Cívico-Militares' });
        trechos.value = anuncio.trechos.join('\n');
        trechos.addEventListener('change', () =>
          withBusy(() =>
            gravar(
              lista.map((x) =>
                x.id === anuncio.id ? { ...x, trechos: trechos.value.split('\n').map((t) => t.trim()).filter(Boolean) } : x
              )
            )
          )
        );
        card.append(trechos);

        // ---- o que fazer -----------------------------------------------------
        card.append(h('div', { class: 'wf-hint' }, 'O que fazer quando este texto aparecer:'));
        const acao = h('select', {});
        for (const op of anunciosLib.ACOES) {
          const o = h('option', { value: op.id }, op.rotulo);
          if (op.id === anuncio.acao) o.setAttribute('selected', 'selected');
          acao.append(o);
        }
        acao.addEventListener('change', () =>
          // O alvo é zerado junto: o nome de um modelo não serve como id de resposta pronta, e
          // guardá-lo faria a conferência acusar um erro que ele não cometeu.
          withBusy(() => gravar(lista.map((x) => (x.id === anuncio.id ? { ...x, acao: acao.value, valor: '' } : x))))
        );
        card.append(acao);

        const sobre = anunciosLib.sobreAcao(anuncio.acao);
        if (sobre?.ajuda) card.append(h('div', { class: 'wf-hint' }, sobre.ajuda));

        /**
         * O alvo da ação, quando ela precisa de um.
         *
         * **Lista, não campo de texto, sempre que a lista existe** — é a lição do "Ramos dentro
         * deste" na janela do fluxo: escolher de uma lista não erra o nome, e nome errado aqui só
         * daria erro na hora de enviar. O campo de texto sobra para o caso em que a lista de
         * modelos ainda não carregou (o painel abre a Config antes de abrir atendimento).
         */
        if (sobre?.precisaValor === 'modelo') {
          if (state.hsmTemplates.length) {
            const alvo = h('select', {});
            alvo.append(h('option', { value: '' }, '— escolha o modelo aprovado —'));
            for (const m of state.hsmTemplates) {
              const o = h('option', { value: m.name }, m.name);
              if (m.name === anuncio.valor) o.setAttribute('selected', 'selected');
              alvo.append(o);
            }
            alvo.addEventListener('change', () =>
              withBusy(() => gravar(lista.map((x) => (x.id === anuncio.id ? { ...x, valor: alvo.value } : x))))
            );
            card.append(alvo);
          } else {
            const alvo = h('input', { type: 'text', placeholder: 'nome exato do modelo na plataforma' });
            alvo.value = anuncio.valor;
            alvo.addEventListener('change', () =>
              withBusy(() => gravar(lista.map((x) => (x.id === anuncio.id ? { ...x, valor: alvo.value } : x))))
            );
            card.append(
              alvo,
              h('div', { class: 'wf-hint' },
                'A lista de modelos aprovados não está carregada, então digite o nome exato. Abra um ' +
                  'atendimento e volte aqui para eu conferir se ele existe.')
            );
          }
        }

        if (sobre?.precisaValor === 'resposta') {
          const alvo = h('select', {});
          alvo.append(h('option', { value: '' }, '— escolha a resposta pronta —'));
          for (const t of state.templates) {
            const o = h('option', { value: t.id }, t.name);
            if (t.id === anuncio.valor) o.setAttribute('selected', 'selected');
            alvo.append(o);
          }
          alvo.addEventListener('change', () =>
            withBusy(() => gravar(lista.map((x) => (x.id === anuncio.id ? { ...x, valor: alvo.value } : x))))
          );
          card.append(alvo);
          // Lista vazia é um seletor que não deixa escolher nada, e sem explicação ele parece
          // quebrado. `load()` carrega as respostas antes de qualquer outra coisa, então isto só
          // aparece se a Config for aberta antes da primeira leitura.
          if (!state.templates.length) {
            card.append(
              h('div', { class: 'wf-hint' },
                'As respostas prontas ainda não carregaram. Clique em Recarregar e volte aqui.')
            );
          }
        }

        // ---- etiquetas --------------------------------------------------------
        /**
         * As etiquetas existem porque a etiqueta ADS diz que a pessoa veio de anúncio e **não de
         * qual** — sem isto não há como filtrar depois quem chegou por qual campanha. Entram com
         * origem `anúncio`, fora da disputa de conteúdo: quem manda o modelo é a ação acima.
         */
        card.append(
          h('div', { class: 'wf-hint' }, 'Etiquetas a aplicar (separadas por vírgula) — valem em qualquer ação:')
        );
        const etiquetas = h('input', { type: 'text', placeholder: 'ex.: ADS Escolas' });
        etiquetas.value = anuncio.etiquetas.join(', ');
        etiquetas.addEventListener('change', () =>
          withBusy(() =>
            gravar(
              lista.map((x) =>
                x.id === anuncio.id
                  ? { ...x, etiquetas: etiquetas.value.split(',').map((t) => t.trim()).filter(Boolean) }
                  : x
              )
            )
          )
        );
        card.append(etiquetas);

        card.append(h('div', { class: 'wf-preview' }, `→ ${anunciosLib.desfechoEmPortugues(anuncio)}`));
        anunciosNode.append(card);
      }

      /**
       * A conferência, embaixo da lista.
       *
       * Roda a cada redesenho porque é depois de editar que ela importa. O que ela pega — modelo
       * que não existe, resposta apagada, anúncio sem texto, o mesmo texto em dois anúncios — não
       * daria erro ao salvar: daria na hora de enviar, no meio de uma rodada, com o contato aberto.
       */
      const avisos = anunciosLib.conferir(lista, { modelos: state.hsmTemplates, respostas: state.templates });
      for (const aviso of avisos) {
        anunciosNode.append(h('div', { class: 'wf-origin wf-aviso-anuncio' }, '⚠ ' + aviso));
      }

      const novo = h('button', { class: 'wf-btn', type: 'button' }, '+ Anúncio novo');
      novo.addEventListener('click', () => withBusy(() => gravar([...lista, anunciosLib.anuncioVazio()])));
      anunciosNode.append(h('div', { class: 'wf-row' }, [novo]));
    }

    desenharAnuncios();


    body.append(h('hr', { class: 'wf-sep' }), h('h3', { class: 'wf-h' }, 'Modelo por conteúdo'));
    body.append(
      h('p', { class: 'wf-hint' }, 'Uma linha por conteúdo, no formato "Etiqueta = Nome do modelo". É o que o botão "Enviar conteúdo + agradecer + concluir" usa: a regra acima diz o que o contato pediu, e esta tabela diz qual modelo aprovado responde. Sem mapeamento, o painel não adivinha.')
    );

    const mapaArea = h('textarea', { rows: '4' });
    store.get('contentTemplates').then((m) => (mapaArea.value = hsmLib.formatContentTemplates(m)));
    if (state.hsmTemplates.length) {
      body.append(
        h('div', { class: 'wf-origin' }, 'Modelos disponíveis: ' + state.hsmTemplates.map((m) => m.name).join(' · '))
      );
    }
    // Empate é comum: as regras acima também são casadas contra a campanha do anúncio, e
    // anúncio que cita dois nomes faz o contato casar com os dois sem ter pedido nada.
    const preferidoInput = h('input', { type: 'text', placeholder: 'ex.: Conteúdo Flávio' });
    store.get('conteudoPreferido').then((v) => (preferidoInput.value = v || ''));
    preferidoInput.addEventListener('change', () =>
      withBusy(async () => {
        await store.set('conteudoPreferido', preferidoInput.value.trim());
        setStatus(
          preferidoInput.value.trim()
            ? `No empate entre conteúdos, mando o de "${preferidoInput.value.trim()}".`
            : 'Sem preferido: empate volta a bloquear o modelo.',
          'ok'
        );
      })
    );
    body.append(
      h('label', { class: 'wf-field' }, [
        h('span', {}, 'Conteúdo preferido no empate'),
        preferidoInput,
        h('div', { class: 'wf-origin' },
          'Quando a conversa casa com mais de uma regra, este é o modelo que vai. As etiquetas ' +
            'continuam sendo aplicadas todas — isto decide só o envio.'),
      ])
    );

    // Municípios que colidem com o vocabulário da campanha. Nasceu de "Capitão", que é
    // município do RS e patente do candidato: toda mensagem de aceite do anúncio virava cidade.
    const ignoradasInput = h('input', { type: 'text', placeholder: 'ex.: Capitão' });
    store.get('cidadesIgnoradas').then((lista) => (ignoradasInput.value = (lista || []).join(', ')));
    ignoradasInput.addEventListener('change', () =>
      withBusy(async () => {
        const lista = ignoradasInput.value.split(',').map((s) => s.trim()).filter(Boolean);
        await store.set('cidadesIgnoradas', lista);
        setStatus(
          lista.length ? `Não vou mais reconhecer como cidade: ${lista.join(', ')}.` : 'Nenhum município ignorado.',
          'ok'
        );
      })
    );
    body.append(
      h('label', { class: 'wf-field' }, [
        h('span', {}, 'Municípios que NÃO são cidade aqui'),
        ignoradasInput,
        h('div', { class: 'wf-origin' },
          '"Capitão" é município do RS e é a patente do candidato: sem isto, toda mensagem que ' +
            'cita "Capitão Martim" gravava a cidade Capitão. Separe por vírgula.'),
      ])
    );

    // Etiqueta de quem chega por anúncio. A plataforma diz a origem em dado estruturado
    // (`utm.source`, `utm.referralUrl`), então aqui não há texto a adivinhar.
    const anuncioInput = h('input', { type: 'text' });
    store.get('etiquetaAnuncio').then((v) => {
      anuncioInput.value = v || '';
    });
    anuncioInput.addEventListener('change', async () => {
      await store.set('etiquetaAnuncio', anuncioInput.value.trim());
      setStatus(
        anuncioInput.value.trim()
          ? `Quem chegar por anúncio recebe a etiqueta "${anuncioInput.value.trim()}".`
          : 'Ninguém será etiquetado por vir de anúncio.'
      );
    });
    body.append(
      h('label', { class: 'wf-field' }, [
        h('span', {}, 'Etiqueta de quem chega por anúncio'),
        anuncioInput,
        h('div', { class: 'wf-origin' },
          'O bloco "ANÚNCIO | FACEBOOK" no topo da conversa vem de um campo da sessão, não de ' +
            'texto — então isto não depende de regra nem de acerto de regex. Ela é só ETIQUETA: ' +
            'entra no CRM e serve ao filtro, e NÃO escolhe o modelo, porque diz que a pessoa veio ' +
            'de anúncio e não de qual. Quem escolhe o modelo é "Anúncios do momento", pelo texto. ' +
            'Vazio = não etiqueta ninguém por essa via.'),
      ])
    );

    // O cadastro diz um nome e a pessoa disse outro. A extensão NÃO troca o nome: marca, e ele
    // corrige à mão depois. Escolha dele em 31/08, entre trocar sozinho e separar.
    const nomeDivInput = h('input', { type: 'text', placeholder: 'ex.: Conferir nome' });
    store.get('etiquetaNomeDivergente').then((v) => {
      nomeDivInput.value = v || '';
    });
    nomeDivInput.addEventListener('change', async () => {
      const v = nomeDivInput.value.trim();
      await store.set('etiquetaNomeDivergente', v);
      tagsLib.invalidateTags();
      setStatus(
        v
          ? `Cadastro que não bate com o nome informado recebe a etiqueta "${v}".`
          : 'Ninguém será marcado por nome divergente.'
      );
    });
    body.append(
      h('label', { class: 'wf-field' }, [
        h('span', {}, 'Etiqueta de "o nome do cadastro não bate"'),
        nomeDivInput,
        h('div', { class: 'wf-origin' },
          'Quando a pessoa informa um nome diferente do que está no cadastro (o caso do ' +
            'cadastro "viver a vida" com a pessoa respondendo "Daniel Ribeiro"), a extensão ' +
            'marca com esta etiqueta e NÃO mexe no nome. Você filtra a fila por ela e corrige ' +
            'todos de uma vez. Nome completo sobre nome curto ("Daniel" → "Daniel Ribeiro"), ' +
            'acento e caixa não contam como divergência. A etiqueta precisa existir no CRM. ' +
            'Vazio = não marca ninguém.'),
      ])
    );

    // Etiquetas do "sim" — a contrapartida da tecla 7 da rodada. Vazio de propósito no padrão:
    // o rótulo tem que ser o nome exato da etiqueta no CRM, e chutar aqui grava etiqueta errada
    // em eleitor real.
    const interesseInput = h('input', { type: 'text', placeholder: 'ex.: Conteúdo Martim, Conteúdo Zucco' });
    store.get('etiquetasInteresse').then((lista) => (interesseInput.value = (lista || []).join(', ')));
    interesseInput.addEventListener('change', () =>
      withBusy(async () => {
        const lista = interesseInput.value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        await store.set('etiquetasInteresse', lista);

        // Confere contra o CRM na hora: etiqueta que não existe aqui é etiqueta que nunca vai
        // ser aplicada, e descobrir isso só no meio da rodada custa a passada inteira.
        const todas = await tagsLib.allTags().catch(() => []);
        const semTag = lista.filter((nome) => !todas.some((t) => cities.normalize(t.label) === cities.normalize(nome)));
        setStatus(
          lista.length
            ? `Quem responder "sim" recebe: ${lista.join(', ')}.` +
                (semTag.length ? ` Não existe etiqueta no CRM com o nome: ${semTag.join(', ')}` : '')
            : 'Sem etiquetas: a pergunta de interesse continua saindo, mas o "sim" não vira etiqueta.',
          semTag.length ? 'err' : 'ok'
        );
      })
    );
    body.append(
      h('label', { class: 'wf-field' }, [
        h('span', {}, 'Etiquetas quando responder sim'),
        interesseInput,
        h('div', { class: 'wf-origin' },
          'Aplicadas quando o contato responde "sim" à pergunta de interesse (tecla 7 da rodada). ' +
            'Só vale para quem RECEBEU a pergunta: um "sim" solto na conversa não etiqueta ninguém. ' +
            'Separe por vírgula, com o nome exato da etiqueta no CRM.'),
      ])
    );

    const mapaBtn = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Salvar mapeamento');
    mapaBtn.addEventListener('click', () =>
      withBusy(async () => {
        const parsed = hsmLib.parseContentTemplates(mapaArea.value);
        await store.set('contentTemplates', parsed);
        const semModelo = Object.values(parsed).filter(
          (nome) => !state.hsmTemplates.some((m) => m.name.trim().toLowerCase() === nome.trim().toLowerCase())
        );
        setStatus(
          `${Object.keys(parsed).length} mapeamento(s) salvo(s).` +
            (semModelo.length ? ` Não existe modelo aprovado com o nome: ${semModelo.join(', ')}` : ''),
          semModelo.length ? 'err' : 'ok'
        );
      })
    );
    body.append(mapaArea, mapaBtn);

    body.append(h('hr', { class: 'wf-sep' }), h('h3', { class: 'wf-h' }, 'Respostas prontas'));
    body.append(h('p', { class: 'wf-hint' }, 'Variáveis: ' + vars.KNOWN_VARS.map(([v]) => v).join(' ')));
    for (const template of state.templates) body.append(renderTemplateEditor(template));

    const addBtn = h('button', { class: 'wf-btn', type: 'button' }, '+ Nova resposta');
    addBtn.addEventListener('click', async () => {
      const name = prompt('Nome da resposta:');
      if (!name) return;
      state.templates = await templatesLib.save({ name, text: '' });
      renderAll();
      // Abre o popup direto: sem isto você criaria a linha vazia e precisaria de mais um
      // clique em "Editar" para escrever o texto pela primeira vez.
      const criada = state.templates.find((t) => t.name === name && !t.text);
      if (criada) abrirEditorDeResposta(criada);
    });
    const resetBtn = h('button', { class: 'wf-btn', type: 'button' }, 'Restaurar padrão');
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Isso descarta suas respostas e volta às originais. Continuar?')) return;
      state.templates = await templatesLib.restoreDefaults();
      renderAll();
    });
    body.append(h('div', { class: 'wf-row' }, [addBtn, resetBtn]));

    renderRecorderSection();
    renderBackupSection();
  }

  /**
   * Linha compacta na lista: só o que a resposta É (nome + começo do texto), e um botão que
   * abre o popup de edição de verdade. Antes cada card vinha com um textarea grande sempre
   * aberto — pedido dele foi enxugar a lista e deixar edição (nome, texto, variações) só no
   * popup, que abre sob demanda.
   */
  function renderTemplateEditor(template) {
    const card = h('div', { class: 'wf-card' });

    const editBtn = h('button', { class: 'wf-btn wf-mini wf-primary', type: 'button' }, 'Editar');
    editBtn.addEventListener('click', () => {
      // Pega o template FRESCO do state, não o capturado no fechamento: se você editou e voltou
      // sem recarregar a aba, a próxima abertura tem que ver o que acabou de ser salvo.
      const atual = state.templates.find((t) => t.id === template.id) || template;
      abrirEditorDeResposta(atual);
    });
    const upBtn = h('button', { class: 'wf-btn wf-mini', type: 'button' }, '↑');
    upBtn.addEventListener('click', async () => {
      state.templates = await templatesLib.move(template.id, -1);
      renderAll();
    });
    const downBtn = h('button', { class: 'wf-btn wf-mini', type: 'button' }, '↓');
    downBtn.addEventListener('click', async () => {
      state.templates = await templatesLib.move(template.id, 1);
      renderAll();
    });
    const delBtn = h('button', { class: 'wf-btn wf-mini wf-danger', type: 'button' }, 'Excluir');
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Excluir "${template.name}"?`)) return;
      state.templates = await templatesLib.remove(template.id);
      renderAll();
    });

    card.append(
      h('div', {}, [h('b', {}, template.name)]),
      h('div', { class: 'wf-hint' }, truncate(template.text, 90) || '(sem texto ainda)'),
      h('div', { class: 'wf-row' }, [editBtn, upBtn, downBtn, delBtn])
    );
    if (template.variantes?.length) {
      card.append(
        h('div', { class: 'wf-origin' }, `Reveza entre ${template.variantes.length + 1} variações a cada envio.`)
      );
    }
    card.append(h('div', { class: 'wf-origin' }, 'id: ' + template.id));
    return card;
  }

  /**
   * A lista dinâmica de variações, compartilhada pelo popup das respostas prontas e pelo da
   * mensagem do momento: "+ Adicionar variação" cria uma caixa vazia, "×" remove qualquer uma.
   *
   * Devolve `{ adicionar, valores }` em vez de mexer em estado externo: quem chama nem precisa
   * saber que existe um array por trás, só lê `valores()` na hora de salvar. `valores()` já
   * filtra vazio — nunca sai variação em branco, porque mandar mensagem vazia para um contato é
   * pior que não ter variação nenhuma.
   */
  function montarListaDeVariantes(container, iniciais) {
    const variantesState = [...(iniciais || [])];

    function redesenhar() {
      while (container.firstChild) container.removeChild(container.firstChild);
      variantesState.forEach((valor, i) => {
        const linha = h('div', { class: 'wf-row', style: 'align-items:flex-start;margin-top:6px' });
        const ta = h('textarea', { rows: '3', style: 'width:100%;box-sizing:border-box' });
        ta.value = valor;
        ta.addEventListener('input', () => {
          variantesState[i] = ta.value;
        });
        const rmBtn = h('button', { class: 'wf-btn wf-mini wf-danger', type: 'button' }, '×');
        rmBtn.addEventListener('click', () => {
          variantesState.splice(i, 1);
          redesenhar();
        });
        linha.append(ta, rmBtn);
        container.append(linha);
      });
    }
    redesenhar();

    return {
      adicionar() {
        variantesState.push('');
        redesenhar();
      },
      valores() {
        return variantesState.map((v) => v.trim()).filter(Boolean);
      },
    };
  }

  /**
   * Popup de edição: nome, texto principal e as variações — tudo num lugar só. A mesma caixa
   * não-bloqueante e arrastável da pergunta da rodada (`wf-pergunta`/`wf-pergunta-fundo`), com
   * campos de texto em vez de botões de decisão.
   *
   * **Variações não têm mais número fixo.** Começou com exatamente duas (variação 2 e 3, revezando
   * com o texto principal); ele pediu para poder acrescentar mais, então virou lista: "+
   * Adicionar variação" cria uma nova caixa vazia, "×" remove. Campo deixado em branco não é
   * gravado — nunca sai variação vazia, porque mandar mensagem em branco para um contato é pior
   * que não ter variação nenhuma.
   */
  function abrirEditorDeResposta(template) {
    const fundo = h('div', { class: 'wf-pergunta-fundo' });
    const caixa = h('div', { class: 'wf-pergunta' });
    fundo.append(caixa);

    const barra = h('div', { class: 'wf-pergunta-titulo' }, 'Editar resposta');
    caixa.append(barra);
    tornarArrastavel(caixa, barra);

    caixa.append(h('div', { class: 'wf-pergunta-linha' }, 'Nome:'));
    const nameInput = h('input', { type: 'text', value: template.name, style: 'width:100%;box-sizing:border-box' });
    caixa.append(nameInput);

    caixa.append(h('div', { class: 'wf-pergunta-linha' }, 'Texto principal:'));
    const textArea = h('textarea', { rows: '5', style: 'width:100%;box-sizing:border-box' });
    textArea.value = template.text;
    caixa.append(textArea);

    // Aviso, não bloqueio: a decisão de não chamar pelo nome é dele, e ele pode desfazer numa
    // resposta específica. O que não pode é o nome voltar sem ninguém perceber — foi ele que
    // mandou "Boa noite, Zane!" para a Rosane e "Boa noite, Santa Cruz!" para a Serlei.
    const avisoNome = h('div', { class: 'wf-block' },
      'Esta resposta chama o contato pelo nome. O nome do cadastro erra bastante (apelido do ' +
        'perfil, cidade no campo do nome, "[NOVO] …") e, sem valor, ele BLOQUEIA o envio.');
    const conferirNome = () => {
      avisoNome.style.display = vars.usaNome(textArea.value) ? '' : 'none';
    };
    textArea.addEventListener('input', conferirNome);
    caixa.append(avisoNome);
    conferirNome();

    caixa.append(
      h('div', { class: 'wf-pergunta-linha' },
        'Variações: reveza entre estas e o texto principal a cada envio de verdade, para não repetir a mesma frase.')
    );
    const variantesBox = h('div', {});
    caixa.append(variantesBox);
    const listaDeVariantes = montarListaDeVariantes(variantesBox, template.variantes);

    const addVarianteBtn = h('button', { class: 'wf-btn wf-mini', type: 'button' }, '+ Adicionar variação');
    addVarianteBtn.addEventListener('click', () => listaDeVariantes.adicionar());
    caixa.append(addVarianteBtn);

    const linhaBotoes = h('div', { class: 'wf-pergunta-botoes' });
    const salvarBtn = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Salvar');
    const fecharBtn = h('button', { class: 'wf-btn', type: 'button' }, 'Fechar sem salvar');
    linhaBotoes.append(salvarBtn, fecharBtn);
    caixa.append(linhaBotoes);
    caixa.append(h('div', { class: 'wf-pergunta-dica' }, 'Esc fecha sem salvar'));

    function fechar() {
      document.removeEventListener('keydown', aoTeclar, true);
      fundo.remove();
    }
    function aoTeclar(ev) {
      if (ev.key !== 'Escape') return;
      ev.preventDefault();
      fechar();
    }
    document.addEventListener('keydown', aoTeclar, true);

    salvarBtn.addEventListener('click', () =>
      withBusy(async () => {
        const variantes = listaDeVariantes.valores();
        state.templates = await templatesLib.save({
          id: template.id,
          name: nameInput.value,
          text: textArea.value,
          variantes,
        });
        setStatus(
          variantes.length
            ? `"${nameInput.value}" salvo, revezando entre ${variantes.length + 1} variações.`
            : `"${nameInput.value}" salvo — sem variações, sempre manda o texto principal.`,
          'ok'
        );
        fechar();
        // `withBusy` redesenha no `finally` — é o que faz a linha da lista mostrar o nome, o
        // texto e a contagem de variações novos sem precisar reabrir a aba.
      })
    );
    fecharBtn.addEventListener('click', fechar);

    destinoDaCaixa().append(fundo);
    aplicarPosicao(caixa, null);
    nameInput.focus();
  }

  function renderRecorderSection() {
    body.append(h('hr', { class: 'wf-sep' }), h('h3', { class: 'wf-h' }, 'Gravar campos no CRM'));

    const contractBox = h('div', { class: 'wf-origin' }, '');
    store
      .get('writeContract')
      .then((c) => {
        contractBox.textContent = c?.entries?.length
          ? `Contrato aprendido para: ${c.entries.map((e) => `${e.type} (${e.method})`).join(', ')}`
          : 'Ainda não aprendido — a aba Dados não consegue gravar.';
      })
      // Caixa vazia esconde o motivo e faz parecer "não aprendido" quando na verdade é a aba
      // que ficou órfã depois de recarregar a extensão.
      .catch((err) => {
        contractBox.textContent = err.message;
        setStatus(err.message, 'err');
      });
    body.append(contractBox);

    body.append(
      h('p', { class: 'wf-hint' }, [
        'A extensão não adivinha o formato que a plataforma usa para gravar um campo: ela observa você fazendo isso uma vez. Abra um contato ',
        h('b', {}, 'de teste'),
        ', clique em Aprender, e então altere o campo pela interface do mobiliza usando exatamente o valor indicado.',
      ])
    );

    const learnText = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Aprender campo de texto (Cidade)');
    learnText.addEventListener('click', () =>
      withBusy(() =>
        learn(
          'Cidade',
          [SENTINEL],
          `Gravando. Agora vá no painel "Dados do contato" DA PLATAFORMA (não aqui no WhatsFill), clique em "Alterar" ao lado de Cidade, ponha ${SENTINEL} e salve.`
        )
      )
    );

    // "Aprender múltipla escolha (Tema)" saiu em 01/09/2026 com o campo "Tema de Interesse": era o
    // único MULTISELECT que a extensão gravava, então não há mais contrato desse tipo a aprender.
    // O suporte a MULTISELECT continua em contract.js (com teste) — só não há campo usando.

    const learnTags = h('button', { class: 'wf-btn', type: 'button' }, 'Aprender etiquetas');
    learnTags.addEventListener('click', () => withBusy(learnTagContract));

    const learnDate = h('button', { class: 'wf-btn', type: 'button' }, 'Aprender data (conclusão)');
    learnDate.addEventListener('click', () => withBusy(learnDateContract));

    body.append(h('div', { class: 'wf-row' }, [learnText, learnTags, learnDate]));

    const logBox = h('div', { class: 'wf-mono' }, '');
    const showLog = h('button', { class: 'wf-btn wf-mini', type: 'button' }, 'Ver requisições capturadas');
    showLog.addEventListener('click', () =>
      withBusy(async () => {
        const buffer = await page.recorderBuffer();
        logBox.textContent = buffer.length
          ? buffer.slice(0, 6).map((r) => `${r.method} ${r.url}\n${truncate(r.body || '(sem body)', 300)}`).join('\n\n')
          : 'Nada capturado ainda (a gravação liga sozinha durante o aprendizado).';
      })
    );
    body.append(h('div', { class: 'wf-row', style: 'margin-top:6px' }, [showLog]), logBox);
  }

  /**
   * Etiquetas não são um valor de campo comum, então têm contrato próprio (tipo TAGS). Os
   * alvos são os ids reais das etiquetas do CRM: qualquer uma que você marcar identifica a
   * requisição.
   */
  async function learnTagContract() {
    if (!state.contact) return setStatus('Abra um atendimento primeiro.', 'err');
    const etiquetaField = state.schema.find((f) => f.name === 'Etiquetas');
    const todas = await tagsLib.allTags();
    if (!todas.length) return setStatus('Não consegui listar as etiquetas do CRM.', 'err');

    return runLearn(
      {
        id: etiquetaField?.id || 'tags',
        name: 'Etiquetas',
        type: 'TAGS',
      },
      todas.map((t) => t.id),
      'Gravando. Agora, no painel "Dados do contato" DA PLATAFORMA (não aqui), abra as Etiquetas deste contato de teste, marque qualquer uma e salve.'
    );
  }

  /**
   * A data de conclusão não é campo de classificação (não aparece na aba Dados), então é
   * procurada no schema inteiro. Sem contrato DATE próprio, a escrita cai no contrato de
   * texto — e a API responde 200 sem gravar nada, que foi o bug observado.
   */
  async function learnDateContract() {
    if (!state.contact) return setStatus('Abra um atendimento primeiro.', 'err');
    const campo = state.schema.find((f) => f.name === fieldsLib.COMPLETION_FIELD);
    if (!campo) {
      return setStatus(`Campo "${fieldsLib.COMPLETION_FIELD}" não existe no schema.`, 'err');
    }

    return runLearn(
      { id: campo.id, name: campo.name, type: campo.type },
      SENTINEL_DATE_NEEDLES,
      `Gravando. Agora, no painel "Dados do contato" DA PLATAFORMA (não aqui), clique em "Alterar" ao lado de "${fieldsLib.COMPLETION_FIELD}", ponha ${SENTINEL_DATE_HUMANO} e salve.`
    );
  }

  /** needles nulo = usa os ids das opções do campo (caso da múltipla escolha). */
  async function learn(fieldName, needles, instrucao) {
    if (!state.contact) return setStatus('Abra um atendimento primeiro.', 'err');
    const field = fieldNamed(fieldName);
    if (!field) return setStatus(`Campo "${fieldName}" não existe no schema.`, 'err');

    const alvos = needles || field.options.map((o) => o.id);
    if (!alvos.length) return setStatus(`Campo "${fieldName}" sem opções no schema.`, 'err');

    return runLearn({ id: field.id, name: field.name, type: field.type }, alvos, instrucao);
  }

  async function runLearn(field, alvos, instrucao) {
    setStatus(instrucao);
    await page.learnStart({ contactId: state.contact.id, field, needles: alvos });

    // A aba grava em segundo plano enquanto você altera o campo; aqui só acompanhamos.
    const deadline = Date.now() + 150000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000));
      const st = await page.learnStatus();
      if (st.status === 'done') {
        state.hasContract = true; // libera o Salvar da aba Dados sem precisar recarregar
        setStatus(
          `Aprendido: ${st.entry.method} (${st.entry.type}). Agora desfaça a alteração de teste no contato.`,
          'ok'
        );
        renderAll();
        return;
      }
      if (st.status === 'error') {
        setStatus(st.error, 'err');
        return;
      }
    }

    await page.recorderStop().catch(() => {});
    setStatus('Desisti de esperar. Ligue de novo e salve a alteração na interface do mobiliza.', 'err');
  }

  function renderBackupSection() {
    body.append(h('hr', { class: 'wf-sep' }), h('h3', { class: 'wf-h' }, 'Backup'));
    const area = h('textarea', { rows: '4', placeholder: 'cole aqui um backup para importar' });

    const exportBtn = h('button', { class: 'wf-btn', type: 'button' }, 'Exportar para a caixa');
    exportBtn.addEventListener('click', async () => {
      area.value = await store.exportJson();
      setStatus('Exportado. Copie e guarde em lugar seguro.', 'ok');
    });
    const importBtn = h('button', { class: 'wf-btn', type: 'button' }, 'Importar da caixa');
    importBtn.addEventListener('click', async () => {
      try {
        await store.importJson(area.value);
        state.templates = await templatesLib.list();
        state.settings = await store.get('settings');
        setStatus('Importado.', 'ok');
        renderAll();
      } catch (err) {
        setStatus('JSON inválido: ' + err.message, 'err');
      }
    });
    body.append(area, h('div', { class: 'wf-row' }, [exportBtn, importBtn]));
  }

  // ---- utilidades --------------------------------------------------------
  function checkbox(label, checked, onChange) {
    const input = h('input', { type: 'checkbox' });
    input.checked = !!checked;
    input.addEventListener('change', () => onChange(input.checked));
    return h('label', { class: 'wf-switch' }, [input, h('span', {}, label)]);
  }

  /** Relê o estado da página e recarrega o contato. */
  async function refresh() {
    let next;
    let tabId = null;
    try {
      if (!docked) {
        tabId = await page.resolveTab({ force: true });
        state.connection = `aba do mobiliza: ${tabId}`;
      }
      next = await page.getState();
    } catch (err) {
      // Aba existir e não responder é problema diferente de não haver aba: a primeira se
      // resolve com F5 (content script velho depois de recarregar a extensão), a segunda
      // abrindo a plataforma.
      state.connection = tabId ? 'aba sem resposta — dê F5 nela' : 'sem aba do mobiliza';
      state.pageState = { sessionId: null, isPending: false, hasComposer: false, dark: false, conversation: '' };
      renderAll();
      setStatus(err.message, 'err');
      return;
    }

    state.pageState = next;
    root.classList.toggle('wf-dark', !!next.dark);
    await load(next.sessionId);
  }

  /**
   * Roda uma ação impedindo que duas rodem juntas — e **redesenha ao terminar**.
   *
   * O redesenho não é enfeite. Os botões de envio nascem desabilitados enquanto `busy` está
   * ligado, e há renderização acontecendo DENTRO da ação (`saveClassification` chama
   * `renderAll`, e a chegada de mensagem também). Sem redesenhar no fim, eles eram desenhados
   * mortos e continuavam assim: era o bug de "as respostas rápidas ficaram obsoletas depois de
   * enviar, só voltaram recarregando".
   */
  async function withBusy(fn) {
    if (state.busy) return;
    state.busy = true;
    try {
      return await fn();
    } catch (err) {
      setStatus(err.message, 'err');
    } finally {
      state.busy = false;
      // Um erro ao redesenhar não pode escapar daqui e virar falha da ação, que já terminou.
      try {
        renderAll();
      } catch (err) {
        console.warn('[WhatsFill] falha ao redesenhar o painel:', err);
      }
    }
  }

  function setStatus(text, kind) {
    status.textContent = text || '';
    status.classList.toggle('wf-is-err', kind === 'err');
    status.classList.toggle('wf-is-ok', kind === 'ok');
    if (kind === 'err') console.warn('[WhatsFill]', text);
  }

  function setConnection(text) {
    state.connection = text;
    renderHeader();
  }

  /**
   * A configuração da IA é lida no boot, e não só quando um contato abre.
   *
   * A aba Config é o primeiro lugar onde alguém vai olhar para saber se a IA está ligada, e ela
   * abre sem contato nenhum. Sem isto, a tela mostrava os padrões — "desligada" mesmo estando
   * ligada, que é o pior sentido possível para essa mentira.
   */
  (async () => {
    try {
      state.ia = await store.get('ia');
      state.iaTemChave = !!(await store.get('iaChave'));
      renderAll();
    } catch (err) {
      console.warn('[WhatsFill+IA] não consegui ler a configuração da IA:', err.message);
    }
  })();

  return {
    root,
    applyPageState,
    refresh,
    setConnection,
    setStatus,
    toggle,
    setCollapsed(collapsed) {
      root.classList.toggle('wf-collapsed', !!collapsed);
    },
  };
}

function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') el.className = value;
    else if (key === 'value') el.value = value;
    else el.setAttribute(key, value);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child == null) continue;
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

/**
 * **Os anúncios do momento, já peneirados — e a mudança da tabela antiga, uma vez só.**
 *
 * `modeloPorTexto` reconhecia o anúncio pelo texto e só sabia responder qual modelo mandar. Os
 * anúncios (`store.anuncios`) guardam as duas metades que ele pediu: o texto que reconhece e o que
 * fazer. Estrear a tela sem trazer a tabela antiga apagaria em silêncio o reconhecimento que já
 * funcionava, e ele descobriria pelo modelo que parou de sair.
 *
 * **A migração roda uma vez e nunca sobrescreve o que ele editou.** Sem a marca em `migracoes`, ela
 * ressuscitaria linhas velhas toda vez que o painel subisse — inclusive as que ele apagou de
 * propósito, que é o pior caso: o anúncio que saiu do ar voltaria a mandar modelo sozinho.
 */
async function carregarAnuncios() {
  const lista = anunciosLib.normalizar(await store.get('anuncios'));

  const migracoes = await store.get('migracoes');
  if (migracoes.anunciosDoModeloPorTexto) return lista;

  const vindos = anunciosLib.deModeloPorTexto(await store.get('modeloPorTexto'));
  await store.set('migracoes', { ...migracoes, anunciosDoModeloPorTexto: true });

  // Já mexeu aqui? A tabela antiga não passa por cima do que ele montou.
  if (!vindos.length || lista.length) return lista;

  await store.set('anuncios', vindos);
  return vindos;
}

/**
 * **Os modelos padrão do anúncio, na ordem do rodízio.**
 *
 * Pedido dele (02/09/2026): *"o modelo padrão deve variar entre 3 modelos já que chega bastante
 * gente por eles"*.
 *
 * Junta a lista nova com o texto único da versão anterior: quem já tinha um modelo escolhido não
 * perde nada, e não precisou de migração com marca em `migracoes` — a leitura resolve, porque aqui
 * o dado antigo é só o primeiro item do novo.
 */
async function carregarModelosPadrao() {
  const lista = await store.get('modelosPadraoAnuncio');
  if (Array.isArray(lista) && lista.length) return lista.map((m) => String(m || '').trim()).filter(Boolean);

  const unico = String((await store.get('modeloPadraoAnuncio')) || '').trim();
  return unico ? [unico] : [];
}

/**
 * **Tira do que a pessoa "escreveu" o que a PLATAFORMA escreveu.**
 *
 * Duas anotações de 02/09/2026, e a primeira é a mais grave que apareceu:
 *
 *  - **Carlos** mandou um áudio, e o que chegou no lugar foi *"Não foi possível transcrever este
 *    áudio"*. `semInteresse` leu o "Não foi possível" como recusa: ele foi **etiquetado como sem
 *    interesse e concluído em silêncio**, sendo apoiador do anúncio. Etiqueta permanente errada, no
 *    CRM, num eleitor real;
 *  - **Vera** teve dois *"*Atenção:* o tipo da mensagem enviada pelo contato não é suportado."*
 *    lidos como "escreveu apoio em mensagem própria", e recebeu o modelo em cima de um aviso.
 *
 * A plataforma injeta esses textos no fluxo do contato, então chegam idênticos a uma mensagem dela.
 * Nenhum parser tem como saber: é ruído com forma de fala.
 *
 * **Esvazia, não descarta.** A mensagem continua na lista com o `tipo` dela — "mandou um áudio e não
 * deu para ler" é informação diferente de "não mandou nada", e é a primeira que leva o caso para a
 * tecla 6, onde alguém abre.
 *
 * Um lugar só de propósito: `state.entrantes` é atribuído em dois pontos (o carregamento e a
 * reanálise), e peneirar em cada um seria garantir que o próximo esquecesse.
 */
/**
 * As duas marcas que TODA regra precisa ver, postas num lugar só, antes de qualquer uma decidir.
 *
 *  - **`sistema`**: o texto foi a PLATAFORMA que escreveu (*"Não foi possível transcrever este
 *    áudio"*, *"o tipo da mensagem não é suportado"*). Esvazia o texto e mantém a mensagem — "ela
 *    mandou um áudio e não deu para ler" é diferente de "ela não mandou nada".
 *  - **`geradaPeloAnuncio`**: a PRIMEIRA mensagem de uma sessão que veio de anúncio é o texto
 *    pré-preenchido pelo Facebook, não a voz dela. Pedido dele (04/09/2026) depois de a contato
 *    que chegou pelo anúncio receber o agradecimento pelo apoio: o padrão de texto cadastrado
 *    (`^olá!? eu apoio`) não casou com a redação nova do anúncio, e a mensagem do anúncio passou a
 *    contar como apoio escrito por ela.
 *
 * **Por que a primeira, e por que isso basta:** `getConversation` é por SESSÃO, e o `utm` também —
 * então a primeira mensagem de uma sessão com `utm` é, por construção, o clique que a abriu. Quem
 * clica noutro anúncio depois cai na lista de padrões, que continua existindo como reforço.
 */
function prepararEntrantes(entrantes, { veioDeAnuncio = false } = {}) {
  let primeiraDela = true;
  return (entrantes || []).map((m) => {
    const marcada = ehMensagemDaPlataforma(m?.texto)
      ? { ...m, texto: '', transcrito: false, sistema: true }
      : { ...m };
    if (primeiraDela && veioDeAnuncio && !marcada.sistema && String(marcada.texto || '').trim()) {
      marcada.geradaPeloAnuncio = true;
      primeiraDela = false;
    }
    return marcada;
  });
}

function truncate(text, max) {
  const s = String(text || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
