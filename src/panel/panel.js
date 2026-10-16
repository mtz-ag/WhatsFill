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
import * as perfisLib from '../lib/perfis.js';
import * as observacoesLib from '../lib/observacoes.js';
import * as imagemLib from '../lib/imagem.js';
import { extract, rebaixarParaPalpite } from '../lib/extract.js';
import { soCortesia } from '../lib/cortesia.js';
import { sugerirAcao } from '../lib/sugestao.js';
import * as sugestaoLib from '../lib/sugestao.js';
import * as arvoreLib from '../lib/arvore.js';
import * as loteLib from '../lib/lote.js';
import { MSG_FLUXO } from '../lib/fluxo-msg.js';
import { PADRAO_DE_ATENDIMENTO } from '../lib/atendimento.js';
import { MSG_PADRAO } from '../lib/padrao-msg.js';
import { recolherExplicacoes } from './detalhes.js';
import { criarGuardaDeRolagem, TECLAS_QUE_ROLAM } from './rolagem.js';
import { ehSoReacao, ehRepasse, ultimaEhSoReacao, conversaPedeRespostaPessoal, conversaTemPerguntaAberta, soExpressaApoio, rajadaEhSoRepasse, pedeAlgoIndefinido, pedeAjudaFinanceira, confirmaPresenca, ultimaEhDespedida, semInteresse, respostasApos, pedeEmprego, pedeLigacao, pedeFalarComDeputado, naoPodeFalarAgora, reclamaSemResposta, rajadaDeAnuncios, ehMensagemDaPlataforma, rajadaFinal, desdeNossaUltima, deOutroDia, contextoPerdido, perguntaPendente, informouEndereco, pedeMaterial, pedeMaterialForaDoAnuncio, pedeMaterialEscrito, falouAlgoProprio, pedeRoupa, pareceTextoProntoDeAnuncio, marcarLoteEncaminhado, disseQueEDeOutroEstado } from '../lib/cortesia.js';
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
    /** A plataforma mostra "Ver conversa anterior"? É a prova de que ela já esteve aqui. */
    temConversaAnterior: false,
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
      /**
       * **Nesta rodada quem troca de atendimento na TELA é ELE** — o modo de só abrir (02/10/2026).
       *
       * `rodando` manda o observador da página ignorar a troca de atendimento, e com razão: na
       * rodada normal quem abre contato é a própria rodada, e um `load()` por fora carregaria o
       * contato duas vezes e gravaria no CRM no meio de um envio.
       *
       * **No modo de só abrir a premissa se inverte:** a rodada não abre conversa nenhuma na tela —
       * ela cria o atendimento pela API e ESPERA ele atender. Sem esta marca, o painel ficaria mudo
       * exatamente no contato que ele acabou de receber: sem classificação, sem etiqueta sugerida e
       * sem resposta pronta. É o mesmo defeito do aviso que manda procurar o controle na aba errada,
       * com a diferença de que aqui o que falta é o painel inteiro.
       */
      telaEDele: false,
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
      /**
       * O que a lista de REMOVER etiquetas já fez nesta rodada: se a sonda que relê o contato já
       * rodou (uma por rodada, não por contato) e se o nome que não existe no CRM já foi avisado
       * (uma vez, senão vira alarme em todo contato).
       */
      remocao: { sonda: false, avisou: false },
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
    /**
     * **COMO QUEM VOCÊ ESTÁ ENTRANDO** — o candidato ativo (25/09/2026).
     *
     * Correção dele: *"eu queria algo como um perfil de login no Windows, aparenta estar tudo
     * misturado"*. A primeira versão decidia pelo CANAL, sozinha, e trocava por baixo dele. Hoje é
     * escolha dele, gravada em `store.perfilAtivo`, e **não se zera na troca de contato**: login
     * não cai quando se abre outra conversa.
     *
     * Nunca fica nulo depois do `load()`: `perfis.porId` sempre devolve alguém, porque painel sem
     * candidato é painel sem nome para escrever.
     */
    perfil: null,
    /** Todos os candidatos cadastrados — o seletor de login e a Config leem daqui. */
    perfis: [],
    /**
     * **De quem é o número deste atendimento** — `{ estado, dono }`, ver `perfis.situacaoDoCanal`.
     *
     * O canal **não troca** o login (trocar por baixo foi o que ele recusou), mas ele AVISA e, na
     * rodada, BARRA — relato dele de 25/09/2026: *"não devia ter uma barreira caso o número não
     * esteja na extensão?"*. São quatro estados, e a primeira versão só sabia dois.
     */
    canalDoAtendimento: { estado: 'quieto', dono: null },
    /**
     * **O número da instância lido da TELA**, guardado para a conta do canal poder ser refeita sem
     * voltar ao DOM — e para a tela poder DIZER o que comparou. Vazio quer dizer que a leitura
     * falhou, e isso precisa aparecer: é a diferença entre "o número não está cadastrado" e "eu não
     * consegui ler o número".
     */
    numeroDoCanal: '',
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
    /**
     * Quais provedores têm chave salva — `{anthropic, openai}`.
     *
     * `iaTemChave` continua existindo e significa **"há chave para o modelo ESCOLHIDO"**, que é a
     * pergunta que os cinco pontos de decisão do painel fazem. Ter a chave do outro provedor não
     * ajuda em nada: cada uma é recusada pela outra API.
     */
    iaChaves: { anthropic: false, openai: false },
    /** As imagens que vão junto da mensagem, lidas do armazenamento — ver `campoDeImagem`. */
    imagens: { imagemMomentoArquivo: null, imagemPedidoDadosArquivo: null },
    /** O ponteiro de revezamento dos pares do lote — ver `lote.parDaVez`. */
    loteIndice: 0,
    /**
     * Quantos envios do lote saíram por número HOJE — a cópia em memória de `store.loteEnvios`,
     * para o cartão poder desenhar o saldo sem ler o armazenamento dentro de um `render*`. Quem
     * decide é sempre a leitura do armazenamento (`saldoDosNumerosDoLote`); esta é só a tela.
     */
    loteEnvios: {},
    /**
     * As EQUIPES e os NÚMEROS da conta, para escolher ao abrir atendimento no envio em lote.
     *
     * `null` é "ainda não carreguei" e `[]` é "carreguei e não veio nada" — a distinção importa,
     * porque a segunda é a rota devolvendo vazio (ela nunca foi executada) e a tela tem de dizer
     * isso em vez de mostrar um seletor vazio como se fosse a verdade. Carregam no CLIQUE, nunca
     * no desenho: rede disparada de dentro de um `render*` vira uma requisição por redesenho.
     */
    equipes: null,
    canais: null,
    /**
     * A lista de etiquetas do CRM, só para ele escolher a do disparo sem ter de acertar a grafia de
     * cabeça. `null` = ainda não pedi; carrega no CLIQUE, nunca no desenho, e só em memória.
     */
    etiquetasDoCrm: null,
    /**
     * **O disparo agendado** — `{quando, rotulo}` ou `null`. Só em memória, e de propósito: um
     * agendamento que sobrevivesse ao F5 poderia disparar sozinho num dia em que ele nem lembra de
     * ter marcado. Enquanto ele vive, o keepalive está tocando (ver `agendarDisparo`).
     */
    agendado: null,
    /** A hora que está no campo, antes de ele apertar Agendar. */
    horaDoDisparo: '',
    /** O envio de imagem aprendido observando a plataforma — ver `recorder.aprenderEnvioDeImagem`. */
    contratoImagem: null,
    /** Esperas longas em curso, por tarefa — ver `semTravarOPainel`. NUNCA use `state.busy` para elas. */
    esperando: {},
    /** De onde a plataforma manda neste atendimento, lido da conversa — ver `imagem.corpoDaMensagem`. */
    senderId: '',
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

  /**
   * **O painel não perde o lugar quando um botão redesenha a aba** — relato dele (13/09/2026):
   * *"vários botões ao serem clicados rolam a página da extensão e eu tenho que procurar toda vez
   * onde eu estava"*. Quem puxava a rolagem era o conteúdo que chega DEPOIS do desenho (o corpo fica
   * curto por um instante). Ver `panel/rolagem.js`. Roda, toque, tecla de rolar e a barra de rolagem
   * soltam a guarda: a posição passa a ser dele.
   */
  const rolagem = criarGuardaDeRolagem(body);
  body.addEventListener('wheel', () => rolagem.soltar(), { passive: true });
  body.addEventListener('touchstart', () => rolagem.soltar(), { passive: true });
  body.addEventListener('keydown', (e) => {
    if (TECLAS_QUE_ROLAM.has(e.key)) rolagem.soltar();
  });
  // Clique na BARRA de rolagem tem o próprio corpo como alvo; clique num botão, não.
  body.addEventListener('pointerdown', (e) => {
    if (e.target === body) rolagem.soltar();
  });

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
    ['disparo', 'Disparo'],
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
    if (state.auto.rodando && !state.auto.telaEDele) {
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
      if (state.auto.rodando && !state.auto.telaEDele) return;
      load(sessionId);
    }, ESPERA_LOAD_MS);
  }

  /** Reanalisa a conversa depois que ela parar de mudar. Ver `ESPERA_REEXAME_MS`. */
  function agendarReexame() {
    clearTimeout(timerReexame);
    timerReexame = setTimeout(() => {
      if (state.auto.rodando && !state.auto.telaEDele) return;
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
        anuncios: await carregarAnuncios(perfilAtivo()),
      });
      state.nossaUltimaAt = conversa.nossaUltimaAt || null;
      state.nossas = conversa.nossas || [];
      // De onde a plataforma manda neste atendimento — o envio de imagem exige (ver `imagem.js`).
      state.senderId = conversa.senderId || '';
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
    /**
     * **O candidato ativo NÃO se zera na troca de contato** — ele é o seu login (25/09/2026), e
     * login não cai quando se abre outra conversa. O que se zera é o AVISO: "este atendimento é do
     * número do outro candidato" é uma afirmação sobre ESTE contato, e sobreviver à troca faria a
     * tarja falar de uma conversa que não está mais na tela — a armadilha do `state.anuncio`.
     */
    state.canalDoAtendimento = { estado: 'quieto', dono: null };
    state.numeroDoCanal = '';
    state.lidoPelaIA = null;
    state.materialPelaRegra = null;
    state.anuncioSemResposta = null;
    // Os sinais do contato anterior decidiriam o rascunho deste. Mesma armadilha do anuncio.
    state.sinais = null;
    // "Já esteve aqui antes" é do CONTATO: sobreviver à troca faria a primeira vinda de um herdar
    // o histórico do outro. Mesma armadilha do anúncio.
    state.temConversaAnterior = false;
    // A conversa anterior CARREGADA, pelo mesmo motivo da linha acima: história de outro contato
    // decidindo o cadastro deste é a armadilha que a pergunta de cidade já custou uma vez.
    state.conversaAnterior = null;
    state.cidadeRecusada = new Set();
    state.ultimaMensagem = null;
    state.hsmTemplates = [];
    state.error = null;
    state.hasContract = !!(await store.get('writeContract'))?.entries?.length;
    state.settings = await store.get('settings');
    /**
     * **QUEM ESTÁ LOGADO** — e é isto que decide tudo o que a tela mostra (25/09/2026).
     *
     * Vem do armazenamento e não do canal: quem escolhe é ele, e a escolha dura até ele trocar.
     * Carregado ANTES de qualquer outra coisa porque as respostas prontas, os anúncios, as
     * instruções extras, a mensagem do momento e os modelos saem daqui — e uma tela que desenha com
     * o candidato errado por um instante é uma tela em que ele pode clicar.
     *
     * **Subiu para cima de `auto` em 25/09**, quando a mensagem do momento passou a ser do
     * candidato: lida antes do login, ela seria sempre a do perfil de fábrica.
     */
    state.perfis = perfisLib.sanitizar(await store.get('perfis'));
    state.perfil = perfisLib.porId(state.perfis, await store.get('perfilAtivo'));
    state.padroesDeAnuncio = await store.get('padroesDeAnuncio');
    state.auto.cfg = await perfisLib.lerAuto(state.perfil.id);
    state.ia = await store.get('ia');
    state.fluxo = await store.get('fluxo');
    await lerChavesDaIA();
    state.templates = await templatesLib.list({ perfil: state.perfil.id });
    /**
     * **As instruções extras também são do candidato.**
     *
     * Sobrescrever `state.ia.regras` em MEMÓRIA, em vez de criar um segundo nome, é o que impede a
     * armadilha registrada quatro vezes aqui: duas cópias da mesma coisa divergem, e a que ninguém
     * olha é a que vai para o prompt. Os seis pontos que leem `state.ia.regras` continuam lendo um
     * campo só, e o `load()` relê o `ia` do armazenamento, então a sobrescrita nunca sobrevive.
     *
     * **Em branco quer dizer em branco**, não "herda as do outro".
     */
    if (state.perfil.id !== perfisLib.PERFIL_PADRAO) {
      state.ia = { ...state.ia, regras: String((await perfisLib.ler('iaRegras', state.perfil.id, '')) || '') };
    }
    renderAll();

    if (!sessionId) {
      setStatus('Abra um atendimento na plataforma para começar.');
      return;
    }

    try {
      setStatus('Carregando contato…');
      state.session = await api.getSession(sessionId);
      /**
       * **De quem é esta conversa** — pelo CANAL, que é dado (escolha dele, 24/09/2026).
       *
       * O `channelId` é o id opaco que a API usa; o NÚMERO é o que ele lê na tela ("Instância
       * cccad9 · (51) 98051-0122") e o único que ele tem como digitar na Config. Os dois casam
       * contra a mesma lista — ver `perfis.donoDoCanal`.
       */
      /**
       * **Pela PONTE, nunca `dom` direto** — no modo janela o painel não alcança o DOM da aba, e a
       * chamada direta seria `ReferenceError` no meio do `load()` de todo contato. Falhar aqui não
       * pode custar o atendimento: sem o número, sobra o `channelId`.
       */
      try {
        state.numeroDoCanal = (await page.numeroDoCanal()) || '';
      } catch {
        state.numeroDoCanal = '';
      }
      /**
       * **O canal só AVISA** (decisão dele, 25/09/2026, o modelo de login): quem escolhe o
       * candidato é ele, e trocar sozinho por baixo foi exatamente o que ele recusou.
       *
       * `donoDoCanal` e não `doCanal`: aquele nunca devolve nulo, então "ninguém reivindicou este
       * número" e "é do candidato de sempre" seriam a mesma resposta — e a tarja apareceria em todo
       * atendimento de número não cadastrado, que é quase todos. Alarme que toca sempre se aprende
       * a ignorar.
       */
      recalcularCanalDoAtendimento();

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
        anuncios: await carregarAnuncios(perfilAtivo()),
      });
      state.nossaUltimaAt = conversa.nossaUltimaAt || null;
      state.nossas = conversa.nossas || [];
      // De onde a plataforma manda neste atendimento — o envio de imagem exige (ver `imagem.js`).
      state.senderId = conversa.senderId || '';
      state.ultimaMensagem = conversa.ultima;

      /**
       * **"Ver conversa anterior" — o botão que diz se ela já esteve aqui.**
       *
       * Ele apontou o sinal (05/09/2026): *"tem uma trava que identifica pessoa nova, que é
       * conversa anterior; normalmente eu tenho que clicar para abrir a conversa do dia anterior"*.
       * A plataforma só mostra esse botão quando existe atendimento anterior.
       *
       * É o que a API não dá: `getConversation` é por SESSÃO, então uma conversa sem nada nosso
       * pode ser a primeira vinda ou a décima. Falhar aqui devolve `false`, e o painel decide como
       * decidia — o lado barato do erro.
       */
      try {
        state.temConversaAnterior = !!(await page.temConversaAnterior());
      } catch {
        state.temConversaAnterior = false;
      }

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

      /**
       * **A CONVERSA ANTERIOR, quando falta a cidade** — pedido dele (07/09/2026): *"veja como
       * abrir a conversa anterior, será necessário quando houver para não perder o contexto; mas
       * será uma abertura só... depois de abrir, pegue os dados de cidade e prossiga com a
       * sugestão"*.
       *
       * `getConversation` é por SESSÃO, e é por isso que quem volta semanas depois chegava aqui
       * como se nunca tivesse escrito nada — a cidade que ela deu em julho está numa sessão que
       * ninguém lê. O botão "Ver conversa anterior" é a prova de que existe uma; `api` agora sabe
       * ir buscá-la (`GET /chat/v1/session/{id}/previous`, lido no bundle do app).
       *
       * **Três guardas, e as três são sobre custo e sobre não mudar o que não foi pedido:**
       *
       *  - **só quando FALTA a cidade.** É o dado que ele nomeou, é o que decide a etiqueta, e é o
       *    único que não envelhece: quem morava em Canoas em julho mora em Canoas hoje. Tendo
       *    cidade, a conversa antiga não acrescenta nada que valha duas requisições por contato —
       *    e foi rajada de requisição que já derrubou a API e a plataforma junto;
       *  - **só quando o BOTÃO está na tela** (`state.temConversaAnterior`). Ele custa zero rede, e
       *    é a mesma pergunta que a rota responde. Falhando a leitura da tela, não se gasta nada e
       *    o painel decide como decidia — o lado barato do erro;
       *  - **UMA sessão**, que é a regra dele. A cadeia existe (carregada uma, o app pergunta o
       *    `/previous` daquela), e cada nível a mais é mais uma requisição.
       *
       * **O que entra daqui é SÓ palpite de cadastro, e rebaixado.** A conversa anterior não entra
       * em `state.incoming` nem em `state.entrantes`: eles são a memória DESTA sessão, e é sobre
       * eles que a rajada, o tempo (`deOutroDia`, `respondidoHoje`) e o "já respondemos" decidem —
       * misturar história de julho ali mudaria todos os sinais de uma vez, que não é o que ele
       * pediu. `rebaixarParaPalpite` faz o resto: a cidade vinda de outra conversa **espera
       * confirmação** (dele ou da IA) como todo palpite, nunca vai sozinha para o CRM.
       */
      const campoCidade = classify.find((f) => f.name === 'Cidade');
      const cidadeAtual = String(state.draft[campoCidade?.id]?.value || '').trim();
      const faltaCidade = !cidadeAtual || cities.naoPodeSerNomeDeLugar(cidadeAtual);

      state.conversaAnterior = null;
      if (faltaCidade && state.temConversaAnterior) {
        try {
          const anterior = await api.getConversaAnterior(sessionId);
          if (anterior) {
            state.conversaAnterior = anterior;
            const textosAntes = (anterior.incoming || []).filter((t) => !ehMensagemDaPlataforma(t));
            if (textosAntes.length) {
              applyGuesses(rebaixarParaPalpite(await extract(textosAntes)), classify);
            }
          }
        } catch {
          state.conversaAnterior = null;
        }
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
      marcarCidadeParaLimpar(classify);
      await refreshTagSuggestions();
      /**
       * A etiqueta por palavra lida da CONVERSA — pega o que saiu por fora do painel. Dentro de
       * `try` porque falha de etiqueta nunca pode derrubar o carregamento do contato (20/08).
       */
      try {
        await etiquetarPorPalavraDoQueJaSaiu();
      } catch (err) {
        console.warn('[WhatsFill] etiqueta por palavra:', err?.message || err);
      }

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
    // Com "IA pega a cidade sozinha", o palpite aproximado também vai para ela na gravação automática —
    // a IA confirma, corrige para outro município do IBGE ou não grava nada.
    if (somenteExatos && entry.confidence !== 'exata' && !(state.ia?.cidadeSozinha && state.iaTemChave)) return;

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
     *
     * **E não oferecer nunca quis dizer gravar.** Este `return` deixava o palpite no rascunho, e a
     * gravação logo abaixo não olhava `pendente`: o valor ia para o campo Cidade sem passar por
     * caixa nenhuma — print dele de 07/09/2026, com `"mais Apoiadores com patrocínio"` gravado num
     * contato novo. Quem fecha isso agora é `fields.deveGravarEntrada`, no ponto de escrita.
     */
    if (entry.confidence === 'nao-reconhecida') {
      if (state.auto?.rodando) {
        registrarNaRodada(
          state.contact?.name || 'contato',
          'aviso',
          `cidade "${entry.value}" não gravada: não é município do RS — corrija na aba Dados se for o caso`
        );
      }
      return;
    }

    /**
     * **Com a IA ligada, quem responde esta caixa é ela** — e responde ANTES de a caixa existir.
     *
     * Nasceu para a rodada automatizada (relato dele, 01/09: *"falta a IA aceitar a cidade e
     * arrumar caso esteja errado, está parando o processo"*) e passou a valer na rodada normal em
     * 06/09, a pedido dele: *"a IA deve assumir para ter certeza que a cidade está correta"*. Ver
     * `cidadeConferidaPelaIA`.
     *
     * A regra dele não muda: **nenhuma cidade de palpite vai para o CRM sem confirmação.** Muda
     * QUEM confirma. E o que a IA pode fazer aqui é estreito: aceitar o que o parser achou, trocar
     * por outro município **da lista do IBGE**, ou não gravar nada. Nome inventado não passa por
     * `validarCidade`, e incerteza devolve a caixa para ele.
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
   * A IA confere a cidade antes de a caixa abrir — **sempre que a avaliação por IA estiver
   * ligada e uma rodada estiver andando**.
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
   * **A exigência de rodada AUTOMÁTICA saiu em 06/09/2026, a pedido dele:** *"a IA deve assumir
   * para ter certeza que a cidade está correta"*. A guarda tinha nascido de outro problema — a
   * rodada automática travava esperando um clique que ninguém ia dar (01/09) —, e com ela a
   * conferência só existia no modo que ele quase nunca usa: rodando contato a contato, ligar a IA
   * não conferia cidade nenhuma. Conferir é a metade do trabalho dela que ele nomeou.
   *
   * **Continua exigindo a RODADA andando.** Abrir um contato à mão para olhar não é pedir
   * conferência, e cada chamada é dinheiro — a mesma razão pela qual o rascunho automático também
   * só roda dentro da rodada. Incerta, ela devolve `false` e a caixa abre para ele, como antes.
   */
  async function cidadeConferidaPelaIA(campo, entry) {
    // Na rodada, com a IA ligada; fora dela, só com "IA pega a cidade sozinha" marcada (19/09/2026).
    const pode = (state.auto?.rodando && state.ia?.ligada) || !!state.ia?.cidadeSozinha;
    if (!pode || !state.iaTemChave) return false;

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
  /**
   * **Abreviação de cidade se corrige SOZINHA** — decisão dele (12/09/2026): *"isso já era pra
   * estar sendo corrigido pela IA; se já escreve a cidade pode reescrever"*.
   *
   * Ele tem razão nas duas metades. A extensão já escreve o campo Cidade, então reescrever uma
   * abreviação para o nome oficial não é um poder novo — e **isto não precisa da IA**: o apelido
   * resolve pela tabela de `normalize` (`poa` → `porto alegre`), sem modelo nenhum. A IA só era
   * consultada quando havia palpite PENDENTE, e `POA` no CRM sem ninguém falar de cidade na
   * conversa não gera palpite: ela nunca veria o caso.
   *
   * **Corrige só o que é a mesma cidade escrita de outro jeito** (`podeCorrigirSozinho`): apelido,
   * abreviação, acento, caixa e sigla do estado. Erro de digitação e nome PARCIAL de município
   * (`Vitoria` → Vitória das Missões) continuam pedindo o clique dele — ali quem resolveu foi a
   * distância, e reescrever trocaria a cidade do eleitor.
   *
   * **Roda ANTES das sugestões de etiqueta**, na mesma passada: com o campo valendo `POA` a
   * etiqueta de cidade sairia do valor errado. E entra como escrita comum (`from: 'grafia'`), que
   * `fields.deveGravarEntrada` leva no Salvar e na conclusão e **recusa na gravação automática** —
   * a que roda a cada abertura de contato.
   */
  async function corrigirGrafiaDaCidade() {
    state.grafiaCorrigida = null;
    const campo = fieldNamed('Cidade');
    const cidade = valueNamed('Cidade');
    if (!campo || !cidade) return;
    try {
      const g = await cities.conferirGrafia(cidade);
      if (!g || g.ok || !g.oficial || !g.podeCorrigirSozinho) return;
      state.draft[campo.id] = { value: g.oficial, from: 'grafia', confirmada: true };
      // O cabeçalho tem que DIZER: aviso que desaparece sozinho parece defeito consertado por acaso.
      state.grafiaCorrigida = { de: cidade, para: g.oficial };
    } catch (err) {
      console.warn('[WhatsFill] não consegui corrigir a grafia da cidade:', err.message);
    }
  }

  async function refreshTagSuggestions() {
    if (!state.contact) return;
    await corrigirGrafiaDaCidade();
    const jaAplicadas = new Set(state.contact.tagsId || []);
    try {
      // O "sim" só vira etiqueta se a pergunta de interesse tiver saído para ESTE contato —
      // senão qualquer "sim, moro em Pelotas" viraria aceite de conteúdo.
      const [perguntado, etiquetasInteresse, anunciosDoMomento] = await Promise.all([
        templatesLib.wasSent(state.contact.id, INTEREST_TEMPLATE_ID),
        store.get('etiquetasInteresse'),
        carregarAnuncios(perfilAtivo()),
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

      /**
       * **O anúncio que AINDA NÃO FOI RESPONDIDO** — regra dele (06/09/2026), com quatro prints da
       * Sirlene em ordem: *"o modelo só sai novamente no contexto do anúncio; se tiver resposta
       * minha após o anúncio, não mandar"*.
       *
       * Ela clicou no anúncio das Escolas Cívico-Militares em **04/09 às 19:53**. Respondemos em
       * 05/09 (mensagem do momento) e de novo em 06/09 pela manhã. Às 12:31 ela escreveu *"10.122
       * já está anotado 🌸💕"* — uma confirmação carinhosa, que não pede nada — e às 13:23 recebeu o
       * **modelo institucional do canal de transmissões**, com agradecimento e conclusão em cima.
       * *"O modelo tem sido mandado fora de contexto, achei que tinha sido arrumado mas continua."*
       *
       * **A causa é a armadilha que já está no CLAUDE.md desde 01/09: o TEXTO do anúncio fica na
       * conversa para sempre.** `state.anuncio` responde *"de qual anúncio ela veio"*, e isso não
       * deixa de ser verdade nunca — então o grupo *"veio de um anúncio que eu reconheço"* continuava
       * ganhando dois dias depois, com o modelo daquele clique atrás dele.
       *
       * O critério dele resolve pela POSIÇÃO: o clique só conta enquanto estiver **depois** da nossa
       * última fala. Respondido, o anúncio se cala e o quadro decide como decide para qualquer um.
       *
       * Duas leituras, e as duas pela mesma régua:
       *  - **as mensagens** entram só se estiverem na rajada (o que ela escreveu desde a nossa
       *    última);
       *  - **a `utm`** entra só se ainda não falamos nada nesta sessão. Ela é da SESSÃO e não tem
       *    horário próprio: o clique que a abriu é, por construção, anterior a qualquer resposta
       *    nossa dentro dela.
       *
       * **`state.anuncio` continua existindo e não mudou de sentido** — é ele que aplica as
       * etiquetas de origem, que são permanentes de propósito. O que passou a depender da resposta é
       * o MODELO e o sinal do quadro.
       */
      state.anuncioSemResposta = anunciosLib.reconhecer(
        [
          ...rajadaFinal(state.entrantes, state.nossaUltimaAt).map((m) => m?.texto),
          ...(state.nossaUltimaAt
            ? []
            : [state.session?.utm?.campaign, state.session?.utm?.headline, state.session?.utm?.referralUrl]),
        ],
        anunciosDoMomento
      );

      /**
       * **A UF de quem mora fora do RS** — pedido dele (08/09/2026), print da etiqueta
       * *"Fora do RS"*. Lida do VALOR DO CAMPO, e nao do palpite do parser: assim ela tambem
       * alcanca quem ja tem "Curitiba" gravado no CRM desde antes, na primeira passada da rodada.
       */
      const ufDeFora = await cities.ufForaDoRS(valueNamed('Cidade'));

      const sugeridas = await tagsLib.suggest({
        city: valueNamed('Cidade'),
        foraDoRS: ufDeFora,
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
      const jaNoCrm = await tagsLib.conteudosJaAplicados(state.contact, await lerContentTemplates());
      const nomesVistos = new Set(sugeridas.map((s) => cities.normalize(s.nome || '')));
      const completas = [...sugeridas, ...jaNoCrm.filter((c) => !nomesVistos.has(cities.normalize(c.nome)))];

      /**
       * **A etiqueta de MATERIAL não sai por aqui — só pela conferência da IA** (17/09/2026). Relato
       * dele: *"o determinístico está botando etiqueta antes da IA confirmar; se a etiqueta é colocada
       * antes, a IA nunca é chamada"*. Esta lista vem das regras de etiqueta da Config, das etiquetas
       * do anúncio e da tabela de conteúdo — qualquer uma delas apontando para a etiqueta de endereço a
       * gravava direto, e marcada ela faz a rodada PULAR sem nunca chegar a `etiquetarEndereco`.
       *
       * A sugestão continua na tela, **desmarcada** e dizendo por quê; o que a regra achou vai para
       * `state.materialPelaRegra`, e a rodada o entrega à IA depois da decisão da passada.
       */
      const tagMaterial = await rotuloDaEtiquetaDeEndereco();
      const ehMaterial = (s) =>
        !!tagMaterial && cities.semAcentoNemCaixa(s.tag?.label || s.nome || '') === cities.semAcentoNemCaixa(tagMaterial.label);
      const materialPelaRegra = completas.find((s) => ehMaterial(s) && !(s.tag && jaAplicadas.has(s.tag.id)));
      state.materialPelaRegra = materialPelaRegra ? { motivo: materialPelaRegra.motivo || materialPelaRegra.origem || 'uma regra de etiqueta' } : null;

      state.tagSuggestions = completas.map((s) => ({
        ...s,
        ...(ehMaterial(s) ? { motivo: `${s.motivo || ''} — a de material só entra depois de a IA conferir, na rodada`.replace(/^ — /, '') } : {}),
        jaTem: !!s.tag && jaAplicadas.has(s.tag.id),
        marcada: !!s.tag && !jaAplicadas.has(s.tag.id) && state.settings.autoTags && !ehMaterial(s),
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
   * **Cidade que é endereço de máquina vai ser APAGADA do CRM.**
   *
   * Print do José (07/09/2026): campo Cidade valendo `www.threads.com`, a rodada passou por ele e
   * concluiu — *"passou por ele, não removeu a cidade errada"*. Estava certo: a extensão nunca
   * apagou nada. Ela preenche buraco, e desde a 2.69 substitui lixo **quando a pessoa menciona uma
   * cidade de verdade**. Quem nunca mais menciona ficava com o lixo para sempre.
   *
   * E o lixo é nosso: veio do vazamento que a 2.88 fechou. Isto é o conserto do passado que aquela
   * entrada deixou aberto.
   *
   * **Roda DEPOIS de todo palpite**, de propósito: cidade reconhecida na conversa vence a limpeza,
   * porque substituir é melhor que apagar. Chegando aqui, ninguém tinha nada melhor a pôr.
   *
   * O valor antigo fica em `limpando` para a tela e o log poderem nomear o que saiu — `value` já é
   * vazio, e log que não diz o que apagou é log que não serve.
   */
  function marcarCidadeParaLimpar(classify) {
    const campo = (classify || state.classify).find((f) => f.name === 'Cidade');
    const atual = campo && state.draft[campo.id];
    if (!atual || atual.from !== 'crm') return;
    if (!cities.naoPodeSerNomeDeLugar(atual.value)) return;

    state.draft[campo.id] = { value: '', from: 'limpar', limpar: true, limpando: atual.value };
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
    if (guess.confidence !== 'exata') return false;
    // Correção sua à mão vence o parser: você viu a conversa inteira, ele viu uma linha.
    if (atual.from === 'manual') return false;

    /**
     * **Lixo no campo não é "o que já está no CRM"** — print da Maria Antonia (06/09/2026).
     *
     * O campo Cidade dela tinha **`vt.tiktok.com`** (um link que ela mandou, gravado numa passada
     * antiga pelo modo generoso do parser), e na última mensagem ela escreveu *"Moro em
     * Cachoeirinha…"*. O parser achava Cachoeirinha com confiança `exata` — e **nada acontecia**,
     * porque a substituição exige `informada`, que só é verdade quando a cidade é a resposta ao
     * formulário ou a mensagem inteira. A caixa da cidade nunca abria, e a IA nunca era consultada:
     * as duas dependem de um palpite PENDENTE, e o valor do CRM impedia o palpite de entrar.
     *
     * Ele: *"a IA ficou responsável por verificar a cidade; quando estiver no automatizado tem que
     * resolver casos como esse"*.
     *
     * **A regra de não sobrescrever o CRM continua inteira.** Ela existe para não apagar o que
     * alguém preencheu certo — e um endereço de máquina não é isso: não é nome de lugar em hipótese
     * nenhuma, e `cities.naoPodeSerNomeDeLugar` reconhece isso por FORMA e por VOCABULÁRIO, sem
     * depender de casar com lista de município — ver a print do Sabino (08/09/2026), cujo campo
     * valia *"transformar nosso país"*: não tem forma de endereço e não é lugar em lugar nenhum.
     *
     * **Cidade de outro estado NÃO entra aqui, de propósito.** "Curitiba" não casa com os 497
     * municípios, mas é um lugar de verdade e pode ser onde a pessoa mora — trocá-la por uma cidade
     * mencionada de passagem seria inventar. O que esta porta abre é só o caso em que o campo tem
     * uma coisa que ninguém escreveria como cidade.
     *
     * E abrir a porta **não grava nada**: o palpite entra como `pendente`, e quem decide continua
     * sendo a IA (no automatizado) ou a caixa, que é a regra dele desde sempre.
     */
    /**
     * `from: 'limpar'` conta como lixo aqui, e a linha existe por causa do
     * `reexaminarMensagens`: na segunda passada o campo já está marcado para apagar, e sem isto uma
     * cidade que ela mencionasse depois deixaria de substituir — o conserto da 2.69 valeria só na
     * primeira leitura. **Substituir é sempre melhor que apagar.**
     */
    const lixoNoCampo =
      atual.from === 'limpar' || (atual.from === 'crm' && cities.naoPodeSerNomeDeLugar(atual.value));
    if (!guess.informada && !lixoNoCampo) return false;

    return cities.normalize(atual.value) !== cities.normalize(guess.value);
  }

  /**
   * Lê quais provedores têm chave e resolve `iaTemChave` para o modelo escolhido.
   *
   * **Um lugar só, porque a conta é feita em três** (a carga inicial, a releitura da Config e a
   * troca de modelo) — e três leituras separadas divergem na primeira caixa nova, que é a lição
   * do `rodadaAutomatica()`.
   */
  async function lerChavesDaIA() {
    state.contratoImagem = await store.get('contratoImagem');
    state.imagens = {
      imagemMomentoArquivo: await store.get(perfisLib.chaveDeImagem('imagemMomentoArquivo', perfilAtivo())),
      imagemPedidoDadosArquivo: await store.get(perfisLib.chaveDeImagem('imagemPedidoDadosArquivo', perfilAtivo())),
    };
    /**
     * **As artes do disparo, no MESMO lugar que as outras duas.**
     *
     * Chave nova de imagem lida noutro ponto é a armadilha registrada em 25/09 (*"ao pôr uma chave
     * nova em `CHAVES_DO_PERFIL`, procure os DOIS lugares que releem: o `load()` e a troca de
     * login"*) — esta função é chamada pelos dois, e é por isso que elas entram aqui.
     *
     * **Só as peças que ele está usando**, e não o teto de 8: cada arte guardada chega a ~2,7 MB em
     * base64, e ler quatro a mais em todo contato aberto é memória por nada. Adicionar uma peça não
     * precisa de recarga — `campoDeImagem` escreve em `state.imagens` ao subir a arte.
     */
    for (let n = 1; n <= loteLib.quantasPecas(state.auto.cfg); n++) {
      const chave = perfisLib.chaveDeImagem(loteLib.chaveDaImagem(n), perfilAtivo());
      state.imagens[chave] = await store.get(chave);
    }
    state.loteIndice = (await store.get('varianteIndex'))[loteLib.ID_DA_ROTACAO] || 0;
    state.loteEnvios = (await store.get('loteEnvios')) || {};
    state.iaChaves = {
      anthropic: !!(await store.get('iaChave')),
      openai: !!(await store.get('iaChaveOpenai')),
      openrouter: !!(await store.get('iaChaveOpenrouter')),
    };
    state.iaTemChave = !!state.iaChaves[iaLib.provedorDoModelo(state.ia?.modelo || iaLib.MODELO_PADRAO)];
  }

  function fieldNamed(name) {
    return state.classify.find((f) => f.name === name) || null;
  }

  /**
   * **A conta do canal, num lugar só — e refeita sempre que qualquer das pontas muda.**
   *
   * Print dele (25/09/2026): a tarja dizia *"o número deste atendimento não está em nenhum
   * candidato"* com **(51) 98051-0122 já cadastrado** e o atendimento sendo desse número. Medido:
   * com o número lido, a conta dá `meu`; **sem ele, dá `desconhecido`** — então o defeito estava em
   * QUANDO a conta é feita, não em como.
   *
   * Ela era feita uma vez, no `load()`, e nada a refazia: salvar o número na Config redesenhava a
   * tela e deixava a tarja da leitura anterior. É a família do **aviso que não envelhece com o que
   * já foi feito** (20/09) — e o pior tipo, porque ele acabara de fazer exatamente o que o aviso
   * mandava.
   *
   * Agora é uma função só, chamada no `load()`, ao trocar de candidato e ao salvar o cadastro.
   */
  function recalcularCanalDoAtendimento() {
    state.canalDoAtendimento = perfisLib.situacaoDoCanal(
      state.perfis,
      state.session?.channelId,
      state.numeroDoCanal,
      state.perfil?.id
    );
  }

  /**
   * **O que a conta do canal COMPAROU** — para a tela dizer, em vez de ele adivinhar.
   *
   * O `channelId` é um id opaco e o número vem de LER A TELA, que pode falhar quando a plataforma
   * mudar o layout — e aí a tarja acusa "número não cadastrado" sobre um número que está lá. Sem
   * esta linha, o próximo diagnóstico desse caso é outra sessão inteira.
   */
  function oQueComparei() {
    const canal = String(state.session?.channelId || '').trim();
    const numero = String(state.numeroDoCanal || '').trim();
    return [
      canal ? `canal ${canal}` : 'sem canal na sessão',
      numero ? `número lido da tela: ${numero}` : 'NÃO consegui ler o número na tela desta conversa',
    ].join(' · ');
  }

  /**
   * **O LOGIN: como quem você está entrando** — correção dele (25/09/2026), *"eu queria algo como
   * um perfil de login no Windows, aparenta estar tudo misturado"*.
   *
   * Fica no CABEÇALHO, acima de tudo e em toda aba, porque é a pergunta que precede qualquer
   * decisão: *"a mensagem que vai sair é de quem?"*. Trocar aqui troca a tela inteira — respostas
   * prontas, anúncios, dossiê e instruções da IA.
   *
   * **Com um candidato só, não aparece nada.** Não há login a fazer, e uma linha em 100% das telas
   * é ruído — alarme que toca sempre se aprende a ignorar.
   */
  function montarLoginDoCandidato(onde) {
    if ((state.perfis || []).length < 2 || !state.perfil) return;

    const seletor = h('select', {});
    for (const p of state.perfis) {
      const op = h('option', { value: p.id }, p.nome);
      if (p.id === state.perfil.id) op.selected = true;
      seletor.append(op);
    }
    seletor.addEventListener('change', () => entrarComo(seletor.value));
    onde.append(
      h('div', { class: 'wf-login', 'data-fica': '1' }, [h('span', {}, 'Você está como:'), seletor])
    );

    /**
     * **A tarja do canal — o aviso que substituiu a troca automática, e a barreira da rodada.**
     *
     * Ele recusou o painel trocar de candidato por baixo dele; o que sobra é dizer, alto, de quem é
     * o número — e deixar o botão a um clique. **São DOIS casos**, e a primeira versão só tinha um:
     * o número é de outro candidato, ou **não está em nenhum**. Ver `perfis.situacaoDoCanal`.
     */
    const canal = state.canalDoAtendimento || { estado: 'quieto' };

    if (canal.estado === 'outro' && canal.dono) {
      const trocar = h('button', { class: 'wf-btn wf-mini', type: 'button' }, `Entrar como ${canal.dono.nome}`);
      trocar.addEventListener('click', () => entrarComo(canal.dono.id));
      onde.append(
        h('div', { class: 'wf-block wf-err-block', 'data-fica': '1' }, [
          h('div', {},
            `Atenção: este atendimento é do número de ${canal.dono.nome}, e você está como ${state.perfil.nome}. ` +
              'A rodada não vai tratar este contato — o que sair daqui vai com o nome do candidato errado.'),
          h('div', { class: 'wf-origin', 'data-fica': '1' }, oQueComparei()),
          trocar,
        ])
      );
    }

    /**
     * **Número que não está em candidato nenhum** — relato dele (25/09/2026): *"eu só adicionei os
     * dois números do Martim, não adicionei o número do Felipe Pedri ainda; não devia ter uma
     * barreira caso o número não esteja na extensão?"*.
     *
     * Ele está certo, e o defeito era meu: eu tratei *"ninguém cadastrou nada"* e *"tem cadastro e
     * este número não está nele"* como a mesma coisa, para não criar alarme constante. **Depois que
     * o cadastro existe, a ausência vira informação** — e é o caso perigoso, porque não se sabe de
     * quem é a conversa.
     */
    if (canal.estado === 'desconhecido') {
      onde.append(
        h('div', { class: 'wf-block wf-err-block', 'data-fica': '1' }, [
          h('div', {},
            'Atenção: o número deste atendimento não está em nenhum candidato, e você está como ' +
              `${state.perfil.nome}. A rodada não vai tratar este contato — some o número ao ` +
              'candidato certo na aba Config.'),
          h('div', { class: 'wf-origin', 'data-fica': '1' }, oQueComparei()),
        ])
      );
    }
  }

  /**
   * Entra como outro candidato: grava a escolha e recarrega o que é dele.
   *
   * **Recarrega em vez de confiar no `load()`**: a troca acontece com um atendimento já aberto, e
   * esperar o próximo contato deixaria a tela mostrando as respostas do candidato antigo com o nome
   * do novo no cabeçalho — a pior combinação possível, porque ela parece certa.
   */
  async function entrarComo(id) {
    const alvo = perfisLib.porId(state.perfis, id);
    await store.set('perfilAtivo', alvo.id);
    state.perfil = alvo;
    state.templates = await templatesLib.list({ perfil: alvo.id });
    /**
     * **Tudo o que é do candidato é RELIDO aqui** — 25/09/2026, e isto é o relato dele num lugar
     * novo: trocar de login e desenhar com o `auto` do candidato anterior faria a mensagem do
     * momento do Felipe aparecer como se fosse do Martim, que é exatamente o que ele viu.
     *
     * `lerChavesDaIA` entra junto porque a ARTE também é do candidato, e ela é lida por uma chave
     * que carrega o id do perfil.
     */
    state.auto.cfg = await perfisLib.lerAuto(alvo.id);
    await lerChavesDaIA();
    const cfg = await store.get('ia');
    state.ia =
      alvo.id === perfisLib.PERFIL_PADRAO
        ? cfg
        : { ...cfg, regras: String((await perfisLib.ler('iaRegras', alvo.id, '')) || '') };
    // O aviso é sobre o contato aberto e muda com o login: a tarja dizia "você está como o outro",
    // e agora você não está mais. Pela função ÚNICA, nunca remendando o objeto à mão.
    recalcularCanalDoAtendimento();
    renderAll();
    setStatus(`Você está como ${alvo.nome}. As respostas, os anúncios, a mensagem do momento, as artes, os modelos e o dossiê são dele.`, 'ok');
  }

  /**
   * **De qual candidato são os textos que esta tela edita** — 24/09/2026, ver `lib/perfis.js`.
   *
   * Um lugar só: as seis escritas da aba Respostas (salvar, apagar, mover duas vezes, restaurar,
   * reler) consultam isto, e espalhar a conta faria uma delas gravar no perfil errado — o texto de
   * um candidato indo parar no outro.
   *
   * **Sem atendimento aberto é o de fábrica**, porque quem decide é o CANAL e ainda não há canal.
   */
  function perfilAtivo() {
    return state.perfil?.id || perfisLib.PERFIL_PADRAO;
  }

  /**
   * **"Modelo por conteúdo" é do candidato**, porque o que ele guarda são ids de MODELO APROVADO, e
   * modelo aprovado é do canal: o id do Martim não existe no canal do Felipe.
   *
   * Uma função só para os seis pontos que leem o mapa — seis `perfisLib.ler` espalhados divergiriam
   * na primeira vez que o vazio mudasse de significado.
   */
  function lerContentTemplates() {
    return perfisLib.ler('contentTemplates', perfilAtivo(), {});
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
    rolagem.antesDeDesenhar(state.tab);
    body.replaceChildren();
    if (state.tab === 'respostas') renderRespostas();
    else if (state.tab === 'automatizado') renderAutomatizado();
    else if (state.tab === 'disparo') renderDisparo();
    else if (state.tab === 'dados') renderDados();
    else if (state.tab === 'cidades') renderCidades();
    else renderConfig();
    encolherExplicacoes();
  }

  /**
   * **As explicações longas passam a ficar atrás de um toque** — pedido dele (08/09/2026): *"o
   * frontend está muito poluído; as informações de configurações devem ser exibidas de outra forma,
   * deixar as informações básicas para não ficar poluído e outra forma de ler o resto"*.
   *
   * Cada campo da Config e do Automatizado tem, embaixo, um parágrafo que explica POR QUE ele
   * existe — e vários deles têm oito, dez linhas. Juntos, empurram o campo seguinte para fora da
   * tela e transformam a aba num muro de texto cinza.
   *
   * **Um passe depois de desenhar, e não 58 edições.** As explicações são criadas em 58 lugares
   * como `.wf-origin`; mexer em cada chamada seria 58 chances de errar e nenhuma garantia para a
   * próxima que alguém escrever. Aqui a regra é uma só: **explicação que passa de três linhas
   * nasce fechada, com um "ver mais"**. As curtas — que são a maioria e servem de rótulo — não são
   * tocadas, senão a tela ganharia um botão para esconder uma linha.
   *
   * A medida é o `scrollHeight` DEPOIS do desenho, porque só o navegador sabe quantas linhas o
   * texto ocupou na largura de agora. Por isso é um passe, e não uma decisão na hora de criar.
   *
   * **10/09/2026: três linhas com "ver mais" não bastou** — *"o frontend continua poluído, crie
   * botões para mais detalhes e bote todo o excesso de texto lá"*. Hoje tudo o que passa de UMA
   * linha fica atrás de "ⓘ detalhes" (ver `panel/detalhes.js`), e o que é dado ou aviso é marcado
   * com `data-fica` onde é criado.
   */
  const detalhesAbertos = new Set();
  let observadorDeDetalhes = null;
  let detalhesAgendado = false;

  function encolherExplicacoes() {
    /**
     * **Resumir só nas abas de ajuste** (10/09/2026, *"pode resumir mais e botar o resto pros
     * detalhes"*): lá o texto é rótulo e explicação; em Respostas e Dados ele é conteúdo — o texto
     * do modelo, o campo do contato — e não pode ser encurtado.
     */
    recolherExplicacoes(body, detalhesAbertos, {
      resumir: state.tab === 'automatizado' || state.tab === 'disparo' || state.tab === 'config',
    });
    // Depois de recolher (que muda a altura) e a cada pedaço de conteúdo que chegar atrasado.
    rolagem.devolver();

    /**
     * **E de novo quando o corpo muda** — parte do conteúdo chega DEPOIS do desenho, e esse pedaço
     * ficava inteiro na tela até o redesenho seguinte. O passe é idempotente (marca o que já tratou),
     * então a mudança que ele mesmo causa não gera outra.
     */
    if (!observadorDeDetalhes && typeof MutationObserver === 'function') {
      observadorDeDetalhes = new MutationObserver(() => {
        if (detalhesAgendado) return;
        detalhesAgendado = true;
        // `setTimeout` e não `requestAnimationFrame`: sem a janela desenhando, o quadro de animação
        // não chega, e o pedaço que entrou depois ficava inteiro (visto medindo, 10/09).
        setTimeout(() => {
          detalhesAgendado = false;
          encolherExplicacoes();
        }, 0);
      });
      observadorDeDetalhes.observe(body, { childList: true, subtree: true });
    }
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
    montarLoginDoCandidato(header);

    if (!state.contact) {
      header.append(h('div', { class: 'wf-who' }, 'WhatsFill'));
      /**
       * **"Carregando…" para sempre era mentira** — print dele de 24/09/2026, com a plataforma
       * recusando `GET /chat/v1/session/{id}` por limite de requisições: o `load()` caiu no
       * `catch`, o erro foi para o rodapé e o cabeçalho continuou dizendo que estava carregando.
       * É a família do aviso que não envelhece com o que já aconteceu (20/09): **ao escrever
       * "estou fazendo X", escreva junto o que ele diz quando X falhou.**
       */
      header.append(
        h(
          'div',
          { class: 'wf-sub' },
          state.error
            ? 'não carreguei este atendimento — o motivo está no rodapé; clique em Recarregar'
            : state.pageState.sessionId
              ? 'Carregando…'
              : 'Nenhum atendimento aberto'
        )
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
     * **A limpeza da cidade tem que APARECER.** Sem esta linha o cabeçalho ficava MUDO: a linha
     * "Cidade:" some (o valor virou vazio) e o aviso de grafia some junto — e o CRM continua com o
     * lixo até a conclusão gravar. Estado invisível numa escrita que APAGA é o pior lugar possível
     * para esconder algo.
     */
    const paraLimpar = (() => {
      const campo = fieldNamed('Cidade');
      const e = campo && state.draft[campo.id];
      return e?.limpar ? e.limpando : '';
    })();
    if (paraLimpar) {
      header.append(
        h('div', { class: 'wf-block' },
          `Cidade "${paraLimpar}" vai ser APAGADA do CRM ao concluir — não é nome de lugar, é ` +
            'endereço de máquina. Se a pessoa disser de onde é, a cidade dela entra no lugar.')
      );
    }

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
    /**
     * **A grafia corrigida sozinha aparece, e sem botão** — o aviso amarelo some porque o campo já
     * vale o nome oficial, e correção silenciosa em dado de eleitor é o que ele não pode ter.
     */
    if (state.grafiaCorrigida) {
      header.append(
        h('div', { class: 'wf-origin', 'data-fica': '1' },
          `Cidade: estava "${state.grafiaCorrigida.de}" no CRM — vai gravar "${state.grafiaCorrigida.para}".`)
      );
    }

    /**
     * **A data do primeiro contato também aparece, pelo mesmo motivo da limpeza da cidade.** Esta
     * é a única escrita do painel que REESCREVE um dado que já estava no CRM — as outras só
     * preenchem buraco —, e ela acontece ao concluir, quando ele já não está olhando. A linha
     * nomeia a FONTE porque é ela que diz se a data faz sentido: cadastro do contato é uma coisa,
     * mensagem mais antiga que a extensão enxergou é outra.
     */
    (() => {
      const primeiro = primeiroContatoDoContato();
      if (!primeiro) return;
      const atual = fieldsLib.diaLocalDe(dataDeConclusaoAtual());
      if (atual === primeiro) return;
      const comoSeLe = (d) => d.split('-').reverse().join('/');
      header.append(
        h('div', { class: 'wf-origin', 'data-fica': '1' },
          atual
            ? `Primeiro contato: está ${comoSeLe(atual)} no CRM — vai corrigir para ` +
              `${comoSeLe(primeiro)} (${origemDoPrimeiroContato()}).`
            : `Primeiro contato: vai gravar ${comoSeLe(primeiro)} (${origemDoPrimeiroContato()}).`)
      );
    })();

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
            /**
             * **GRAVA NA HORA** — relato dele (12/09/2026), com a print da Cidade valendo `POA`:
             * *"mando corrigir e continua escrito POA em vez de Porto Alegre"*.
             *
             * O botão só punha o valor no rascunho e dizia *"Salve para gravar no CRM"* — e o
             * Salvar mora na aba **Dados**, enquanto este aviso mora no CABEÇALHO, que aparece em
             * todas as abas. Ou seja: a frase mandava procurar um botão que não está na tela em
             * que ele está, e fechar o atendimento antes disso jogava a correção fora. É a família
             * do aviso que mandava procurar o interruptor na aba errada (06/09).
             *
             * **Clicar em "Corrigir para X" já é o ato deliberado** que a regra da escrita exige —
             * não há segunda decisão a tomar depois dele. `saveClassification()` sem opção nenhuma
             * não carimba data de conclusão, não conclui e não tira etiqueta: grava o campo e as
             * etiquetas de lugar que saem dele, e **confere relendo o contato**, então um "a API
             * aceitou mas não gravou" aparece na hora em vez de virar silêncio.
             */
            if (await saveClassification()) {
              // Sem isto o aviso amarelo fica na tela depois de gravado, e parece que não funcionou.
              state.grafiaDaCidade = await cities.conferirGrafia(grafia.oficial);
              renderAll();
            }
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
  /**
   * **Chamar a IA — o mesmo que a tecla 8 da caixa da rodada.**
   *
   * Pedido dele (05/09/2026): *"faça um botão de chamar IA na aba das respostas que bote o texto na
   * caixa"*. Um clique, e o rascunho já está no campo de mensagem — sem o passo intermediário de
   * copiar de um textarea para lá.
   *
   * **Ele CHAMA `rascunharParaEle`, e isso é o conserto principal deste cartão.** A versão antiga
   * montava a chamada por conta própria, e por isso ficou para trás em três consertos que a tecla 8
   * recebeu:
   *
   *  - **não mandava o Nome** — a IA pedia o nome de quem já estava cadastrado (a Catarina, 03/09);
   *  - **não pedia o cadastro** de quem não o deu (05/09), nem tinha o PISO que acrescenta o bloco
   *    `Nome , Cidade` quando a IA não o copia — e é esse invariante que faz a rodada enxergar que
   *    o pedido saiu;
   *  - **jogava fora os avisos da revisão**, que é onde aparece a saudação trocada e o traço eme.
   *
   * É a armadilha registrada quatro vezes neste projeto: duas cópias da mesma decisão divergem, e a
   * que ninguém olha é a que manda o texto errado. Agora há um caminho só.
   */
  function renderRascunho() {
    const card = h('div', { class: 'wf-card' }, [h('h4', {}, 'Chamar a IA (o mesmo da tecla 8)')]);

    /**
     * **O cartão aparece mesmo com a avaliação por IA desligada**, e o botão é quem se desativa.
     *
     * `state.ia.ligada` governa o gasto AUTOMÁTICO da rodada; chamar a IA aqui é escolha dele,
     * contato a contato — a mesma distinção que faz `rascunharParaEle` olhar `iaTemChave` e não
     * `ligada`. Esconder o cartão faria o botão sumir justamente para quem deixou a avaliação
     * desligada por causa do custo, que é quem mais precisa do caminho manual. É a lição dos dois
     * campos de etiqueta que sumiram dentro de um cartão escondido (04/09).
     */
    const botao = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Chamar a IA');
    const saida = h('textarea', { rows: '8', placeholder: 'O texto que foi para o campo de mensagem aparece aqui.' });
    const avisos = h('div', {});

    botao.addEventListener('click', () =>
      withBusy(async () => {
        avisos.replaceChildren();
        setStatus('Escrevendo o rascunho…');
        const r = await rascunharParaEle();
        if (!r.ok) return setStatus(`Não saiu rascunho: ${r.motivo}`, 'err');

        saida.value = r.texto || '';
        // Os avisos ficam ao lado do texto, e não numa barra de status que a próxima ação apaga:
        // são o que ele precisa reler ANTES de mandar, não enquanto o rascunho chega.
        for (const a of r.avisos || []) avisos.append(h('div', { class: 'wf-block' }, `⚠ ${a}`));
        setStatus('No campo de mensagem. Leia, ajuste e mande você mesmo.', 'ok');
      })
    );

    const inserir = h('button', { class: 'wf-btn', type: 'button' }, 'Pôr no campo de novo');
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
          'pronta cobre. A IA escreve no seu tom (usa as suas respostas prontas como referência de ' +
          'estilo), o texto vai direto para o campo de mensagem e uma cópia fica aqui para você ' +
          'editar. **Ela não envia nada**: quem aperta enviar é você.'),
      h('div', { class: 'wf-row' }, [botao, inserir]),
      saida,
      avisos
    );

    if (!state.iaTemChave) {
      botao.disabled = true;
      card.append(h('div', { class: 'wf-block' }, 'Sem chave da API cadastrada (aba Config) não há o que chamar.'));
    } else if (state.session?.expired) {
      botao.disabled = true;
      card.append(h('div', { class: 'wf-block' }, 'Janela de 24h vencida: texto livre não chega neste contato. Só modelo aprovado.'));
    }

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

    /**
     * **Os cartões daqui em diante são as MESMAS ações das teclas da caixa da rodada**, e o rótulo
     * diz qual — pedido dele (05/09/2026): *"mude os botões da aba de respostas para ficar de
     * acordo com o projeto atual"*.
     *
     * Eles nasceram antes do quadro existir, com nomes próprios ("Pedir os dados e seguir"), e hoje
     * o trabalho dele é por TECLA. Dois nomes para a mesma ação é o começo de duas versões dela:
     * enquanto o nome não disser a tecla, não há como notar que uma delas envelheceu — foi o que
     * aconteceu com o cartão da IA logo acima, que ficou três consertos atrás da tecla 8.
     *
     * O que muda aqui é só o RÓTULO. Nenhuma ação foi trocada, e nada saiu da aba.
     */
    // A abertura do laço: pergunta e sai de cima. É o botão de maior volume nos oito mil.
    const pedir = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Pedir dados + concluir + próximo');
    pedir.addEventListener('click', runPedirDados);
    const cartaoPedir = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Pede nome e cidade, e conclui (tecla 4)'),
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
      h('h4', {}, 'Manda o modelo do conteúdo, e conclui (tecla 1)'),
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
      h('h4', {}, 'Conclui sem enviar nada (tecla 3)'),
      h('div', { class: 'wf-preview' }, 'Grava a classificação, marca a data de conclusão, conclui e abre o próximo. Não envia mensagem.'),
      concluir,
    ]));

    for (const template of state.templates) body.append(renderTemplateCard(template));
    if (!state.templates.length) {
      body.append(h('p', { class: 'wf-hint' }, 'Nenhuma resposta cadastrada. Vá na aba Config.'));
    }

    /**
     * **O link de grupo desceu para o fim da aba** (05/09/2026), e não saiu.
     *
     * O comentário que estava aqui desde agosto já dizia o que ele virou: *"o contato já vem de um
     * grupo: o link não faz parte do dia a dia"*. Ele não corresponde a tecla nenhuma da caixa da
     * rodada, o quadro não o alcança, e ficava no meio dos três botões de maior volume.
     *
     * **Não removi**: nenhuma função sai da aba sem ele pedir, e o grupo da cidade continua
     * cadastrado na Config para quem precisar. O lugar dele é depois das respostas prontas, junto
     * dos modelos aprovados — os dois caminhos que existem para o caso avulso.
     */
    const macro = h('button', { class: 'wf-btn', type: 'button' }, 'Enviar grupo + salvar + concluir');
    macro.addEventListener('click', runMacro);
    body.append(h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Com link de grupo (caminho antigo)'),
      h('div', { class: 'wf-preview' }, 'Envia o link do grupo da cidade, grava a classificação e conclui. Não corresponde a nenhuma tecla da rodada — o quadro não usa este caminho. Só funciona com os grupos cadastrados na aba Config.'),
      macro,
    ]));

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
      h('div', { class: 'wf-preview', 'data-fica': '1' }, modelo.text || '(modelo sem texto)')
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
      /**
       * **O modelo de MATERIAL marca a etiqueta de material no envio** — regra dele (10/09/2026): *"a
       * etiqueta de material será colocada agora quando o modelo de material sair, como prioridade"*.
       *
       * Print da Natalia, no mesmo dia: o modelo do anúncio de material pediu o endereço e o contato
       * ficou SEM etiqueta. Medido: a marca existia só em `sendTemplate` (respostas prontas) — este
       * caminho, que é por onde sai TODO modelo aprovado, nunca a aplicou. **Mesmo critério do outro
       * caminho**: o modelo é "de material" quando o TEXTO dele pede o endereço
       * (`ehPedidoDeEndereco`), porque a redação é da plataforma e o nome do modelo muda.
       */
      // `abreCasoDeMaterial` e nao `ehPedidoDeEndereco`: o pedido de endereco do VOLUNTARIADO
      // pede igual e nao e material (24/09/2026) — ver `templates.abreCasoDeMaterial`.
      const marcaMaterial = templatesLib.abreCasoDeMaterial(modelo.text || '')
        ? await etiquetarEndereco(alvo, { gatilho: `o modelo aprovado "${modelo.name}" que acabou de sair pede o endereço`, acabamosDeMandar: modelo.text || '' })
        : '';
      const marcaPalavra = await etiquetarPorPalavra(alvo, modelo.text || '');
      setStatus(`Modelo enviado: ${modelo.name}${marcaMaterial}${marcaPalavra}`, 'ok');
      return true;
    } else {
      // O mesmo buraco da resposta pronta (02/10/2026): com o diálogo ficando pronto para ELE
      // apertar, o texto sai e o painel nunca viu envio nenhum para marcar.
      const marcaPalavra = await etiquetarPorPalavra(alvo, modelo.text || '');
      setStatus(
        (send && !state.settings.autoSend
          ? 'Envio automático está desligado (aba Config): o diálogo ficou pronto, clique em "Enviar mensagem".'
          : `Diálogo pronto com "${modelo.name}". Confira e clique em "Enviar mensagem".`) + marcaPalavra,
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
        const mapa = await lerContentTemplates();
        const achado = hsmLib.templateParaConteudo(nomeDoConteudo, mapa, state.hsmTemplates);
        if (achado.erro) return setStatus(achado.erro, 'err');
        modelo = achado.modelo;
      } else {
        const daVez = anunciosLib.padraoDaVez(
          await carregarModelosPadrao(perfilAtivo()),
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
          const mapa = await lerContentTemplates();
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
    const preview = h('div', { class: 'wf-preview', 'data-fica': '1' }, '…');
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
      /**
       * **A ETIQUETA POR PALAVRA VALE TAMBÉM AQUI — COLAR É ESCOLHER O TEXTO** (relato dele,
       * 02/10/2026: *"estou colando uma mensagem pronta e não está botando a etiqueta por palavra;
       * o texto tem a palavra colinha"*).
       *
       * **Medido: o defeito não era a etiqueta, era o CAMINHO.** A marca ficava depois do envio de
       * verdade (`page.sendText`), e este ramo — "Inserir" na aba Respostas, e **toda** resposta
       * pronta quando o "Enviar automático" está desligado — devolve `true` antes de chegar lá. Do
       * lado dele a mensagem saiu igual; do lado do painel, nunca houve envio para marcar.
       *
       * **O preço, dito na tela:** colar e NÃO mandar deixa a etiqueta aplicada. É o lado barato —
       * a etiqueta é organização interna, enquanto não marcar quem recebeu some com o caso da lista
       * dele. A linha de status diz o que entrou, para ele tirar se desistir do envio.
       */
      const marcaPalavra = await etiquetarPorPalavra(alvo, text);
      setStatus(
        (send && !state.settings.autoSend
          ? 'Envio automático está desligado (aba Config): texto inserido, envie você.'
          : 'Texto inserido no campo de mensagem.') + marcaPalavra,
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
    /**
     * **A IMAGEM vai primeiro, e este texto é a legenda dela** (20/09/2026, pedido dele: *"preciso
     * da opção de mandar imagem e na descrição mandar mensagem do momento ou pedir dados"*).
     *
     * Duas coisas que a ordem garante: falha de imagem **nunca** impede a mensagem (mesma prioridade
     * de "falha de etiqueta nunca bloqueia o envio" — o que o contato recebe vem primeiro), e a
     * legenda só é dada por entregue quando a plataforma a devolve na resposta. Não voltando, o
     * texto sai do jeito de sempre: o pior caso é o contato receber duas mensagens, nunca uma
     * imagem muda.
     */
    const comImagem = await mandarImagemSeLigada(template, text);
    if (!comImagem.legendaFoi) await page.sendText(text);
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
    // `abreCasoDeMaterial`: a resposta do voluntariado pede o endereço do mesmo jeito e NÃO é
    // material — a marca dela espera ela mandar o endereço (24/09/2026).
    const marcaEndereco = templatesLib.abreCasoDeMaterial(text)
      ? await etiquetarEndereco(alvo, { gatilho: `a resposta pronta "${template.name}" que acabou de sair pede o endereço`, acabamosDeMandar: text })
      : '';
    const marcaPalavra = await etiquetarPorPalavra(alvo, text);
    setStatus(`Enviado: ${template.name}${comImagem.marca}${marca}${marcaEndereco}${marcaPalavra}`, 'ok');
    return true;
  }

  /**
   * **A imagem que acompanha este texto, se ele tiver uma ligada.**
   *
   * Quem decide QUAL é `imagem.imagemDoEnvio`, que é pura e testada — o momento casa pelo id e o
   * pedido de dados pelo invariante do texto, que é como o resto do projeto o reconhece.
   *
   * Nunca lança: devolve `legendaFoi: false` e uma marca para o status. Imagem é acompanhamento;
   * a mensagem é o que o contato precisa receber.
   */
  async function mandarImagemSeLigada(template, texto) {
    const escolha = imagemLib.imagemDoEnvio({
      templateId: template?.id,
      ehPedidoDeDados: templatesLib.ehPedidoDeDados(texto),
      cfg: state.auto?.cfg,
      imagens: state.imagens,
    });
    if (!escolha) return { legendaFoi: false, marca: '' };

    const chave = perfisLib.chaveDeImagem(
      escolha.arquivo === state.imagens.imagemMomentoArquivo ? 'imagemMomentoArquivo' : 'imagemPedidoDadosArquivo',
      perfilAtivo()
    );
    try {
      const r = await page.enviarImagem({
        sessionId: state.pageState.sessionId,
        senderId: state.senderId,
        chave,
        legenda: texto,
      });
      const comoFoi = r.legendaFoi ? '(legenda junto)' : '— a legenda foi como mensagem separada';
      registrarNaRodada(state.contact?.name || 'contato', 'aviso', `imagem enviada com ${escolha.de} ${comoFoi}`);
      return { legendaFoi: !!r.legendaFoi, marca: r.legendaFoi ? ' + imagem' : ' + imagem (legenda à parte)' };
    } catch (err) {
      const motivo = err?.message || String(err);
      registrarNaRodada(state.contact?.name || 'contato', 'erro', `a imagem de ${escolha.de} NAO saiu: ${motivo}`);
      return { legendaFoi: false, marca: ` — a imagem não saiu (${motivo})` };
    }
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
    return aplicarEtiquetaDePedido(alvo, { gatilho: `a resposta pronta "${template.name}" que acabou de sair nega o pedido` });
  }

  /**
   * A etiqueta de quem pediu dinheiro ou emprego, sem depender de QUAL texto saiu — desde 10/09/2026
   * a rodada marca pelo sinal (`sugestao.motivoDaEtiquetaDePedido`), porque quem responde esses casos
   * é a IA, e texto livre não tem id de resposta pronta.
   */
  async function aplicarEtiquetaDePedido(alvo, { gatilho = '' } = {}) {
    const nome = String(state.auto.cfg.etiquetaPedidoAjuda || '').trim();
    if (!nome || !alvo?.id) return '';

    try {
      const tag = await tagsLib.resolveTag(nome);
      if (!tag) return ` (a etiqueta "${nome}" não existe no CRM — não marquei)`;
      if ((alvo.tagsId || []).includes(tag.id)) return '';
      // A IA confere ANTES (17/09/2026) — depois de saber que a etiqueta existe e falta, para não pagar
      // uma chamada por um contato que já está marcado.
      const recusa = await conferirEtiquetaComIA('pedido', alvo, gatilho);
      if (recusa) return recusa;
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
    /**
     * **A nossa ÚLTIMA mensagem ter sido o pedido de endereço abre a janela do detector** — print
     * de 23/09/2026, em que o endereço veio em três mensagens (cidade, rua com número, bairro) e
     * nada foi etiquetado. Ver `cortesia.informouEndereco`.
     *
     * **Pela última e não por "já pedimos alguma vez"**: o pedido some da nossa fala assim que
     * respondemos, e sem isso qualquer rajada futura com um "bairro" dentro viraria endereço — a
     * etiqueta é permanente e manda PULAR o contato para sempre. Quem carrega o caso adiante depois
     * de marcado é a etiqueta, como a regra dele (04/09) manda.
     */
    const nossaUltima = [...(state.nossas || [])].reverse().find((m) => String(m?.texto || '').trim());
    const respondendoNossoPedido = templatesLib.ehPedidoDeEndereco(nossaUltima?.texto || '');
    const dela = informouEndereco(state.entrantes, state.nossaUltimaAt, { respondendoNossoPedido });
    return dela ? { ...dela, jaMarcada: false } : null;
  }

  /** A etiqueta de endereço que o contato JÁ tem no CRM — `null` sem o campo preenchido. */
  /**
   * **Pelo RÓTULO EXATO, e não por trecho contido** (17/09/2026). Relato dele: *"se a etiqueta é colocada
   * antes, a IA nunca é chamada"*. `etiquetaDaLista` casa por trecho CONTIDO — certo para as listas de
   * engajado e assessor, errado aqui: com o campo valendo "Material", qualquer etiqueta com "material"
   * no nome (a do anúncio do Material da Direita, uma de conteúdo) contava como a de endereço, o contato
   * era PULADO em toda passada e `etiquetarEndereco` — onde a IA confere — nunca rodava. Comparação por
   * rótulo e não por id: o CRM tem rótulo repetido.
   */
  async function etiquetaDeEndereco() {
    const tag = await rotuloDaEtiquetaDeEndereco();
    if (!tag) return null;
    const alvo = cities.semAcentoNemCaixa(tag.label);
    const doCrm = new Set(state.contact?.tagsId || []);
    const rotulos = (await tagsLib.allTags().catch(() => [])).filter((t) => doCrm.has(t.id)).map((t) => t.label);
    return rotulos.find((r) => cities.semAcentoNemCaixa(r) === alvo) || null;
  }

  /** A etiqueta de endereço como está no CRM (`resolveTag` aplica os apelidos) — `null` sem o campo. */
  async function rotuloDaEtiquetaDeEndereco() {
    const nome = String(state.auto.cfg.etiquetaEndereco || '').trim();
    return nome ? tagsLib.resolveTag(nome).catch(() => null) : null;
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
  /** Conferências de material já feitas nesta abertura do painel — ver `etiquetarEndereco`. */
  const conferenciasDeMaterial = new Map();

  /**
   * **A IA confere as etiquetas de PEDIDO e de SEM INTERESSE antes de o determinístico pô-las** — relato
   * dele (17/09/2026): *"o determinístico está botando etiqueta antes da IA confirmar qualquer coisa"*.
   * Medido: a de material já passava pela IA (`etiquetarEndereco`, 16/09); estas duas saíam só pelo
   * detector de texto. Ver `ia.TIPOS_DE_ETIQUETA`.
   *
   * Devolve **string vazia quando pode marcar**, e a frase do porquê quando não pode. Mesmas regras da
   * de material: só com a IA ligada e chave (desligada, marca como antes); só `sim` marca; `nao` e
   * `incerto` não marcam; uma conferência por situação (contato + última fala dela + gatilho); e o
   * contato tem de ser o que está aberto, porque a conversa lida é a da tela.
   */
  const conferenciasDeEtiqueta = new Map();
  async function conferirEtiquetaComIA(tipo, alvo, gatilho = '') {
    if (!(state.ia?.ligada && state.iaTemChave)) return '';
    if (alvo?.id !== state.contact?.id) return ' (a IA não conferiu: o atendimento mudou — não marquei)';
    const ultimaDela = (state.entrantes || []).map((m) => m?.at).filter(Boolean).pop() || '';
    const chave = `${tipo}|${alvo.id}|${ultimaDela}|${gatilho}`;
    let c = conferenciasDeEtiqueta.get(chave);
    if (!c) {
      c = await iaCliente.conferirEtiqueta({
        tipo,
        regras: state.ia.regras,
        mensagens: conversaParaIA(),
        gatilho,
        modelo: state.ia.modelo,
      });
      if (c.acao !== 'incerto') conferenciasDeEtiqueta.set(chave, c);
      registrarNaRodada(
        'IA',
        'pulado',
        `${tipo === 'seminteresse' ? 'sem interesse' : 'pedido'} · ${c.acao}${c.custoUsd ? ` · US$ ${c.custoUsd.toFixed(4)}` : ''}${c.motivo ? ` · ${c.motivo}` : ''}${c.aviso ? ` · ${c.aviso}` : ''}`
      );
    }
    if (c.acao === 'sim') return '';
    if (c.acao === 'nao') return ` (a IA conferiu e NÃO é o caso: ${c.motivo || 'sem motivo dado'} — não marquei)`;
    return ` (a IA não confirmou${c.aviso ? `: ${c.aviso}` : ''} — não marquei)`;
  }

  const conferenciasDeEncerramento = new Map();

  /**
   * **ELA ESTÁ ENCERRANDO A CONVERSA?** — decisão dele (15/10/2026): *"determinístico para encerrar
   * tem dado errado demais, a IA terá que assumir o encerramento"*.
   *
   * **O que falhava era o GATILHO, não o desfecho.** `ehDespedida` é um vocabulário de onze formas,
   * e as falhas medidas foram todas falso NEGATIVO: *"Amém firme dia 25 é 22"*, *"Tudo certo
   * obrigado"*, e 29 de 41 formas comuns de encerrar. Trocar a tecla da caixa não resolveria —
   * **a caixa nunca casava.**
   *
   * **O vocabulário fica como SIM BARATO.** Ele erra para o lado de não ver (11 de 11 falsos
   * positivos barrados na medição de hoje), então quando ele reconhece não há o que conferir e a
   * chamada não acontece. Tirá-lo e perguntar sempre custaria uma chamada em todo contato sem
   * mudar desfecho nenhum — e, se ele quiser isso assim mesmo, é apagar esta primeira linha.
   *
   * **A PORTA é estrutural, não é outra lista:** só se pergunta quando nós JÁ respondemos (há
   * conversa para encerrar) e ela escreveu alguma coisa depois. Fora disso não existe encerramento
   * a reconhecer.
   *
   * **Três guardas mecânicas, e cada uma tem dono:**
   *  - **pergunta pendente nunca é encerramento** — a mesma guarda do `naoHaOQueResponder`
   *    (24/09), e a regra dele de 03/09: tem pergunta, não conclui;
   *  - **a IA desligada ou sem chave decide como antes** — ele pediu que a IA assuma, não que o
   *    encerramento deixe de existir sem ela;
   *  - **falha, resposta ilegível e certeza baixa viram "não"**, que é o comportamento de hoje:
   *    manda. Concluir em silêncio por erro de rede seria o lado caro.
   *
   * **Nunca acrescenta mensagem: só silencia.** O pior caso deste caminho é o caso de hoje.
   */
  async function encerrouAConversa(jaRespondemosAntes) {
    const peloVocabulario = ultimaEhDespedida(state.entrantes);
    if (peloVocabulario) return true;
    if (!(state.ia?.ligada && state.iaTemChave)) return false;
    if (!jaRespondemosAntes) return false;

    const dela = desdeNossaUltima(state.entrantes, state.nossaUltimaAt);
    const escreveu = dela.filter((m) => String(m?.texto || '').trim());
    if (!escreveu.length) return false;
    if (perguntaPendente(state.entrantes, state.nossaUltimaAt, state.padroesDeAnuncio)) return false;
    /**
     * **Repasse não é despedida, e perguntar custava dinheiro em toda passada** — relato dele
     * (16/10/2026), com o Andamento aberto: *"estou gastando tokens"*. No log, quem mandava links
     * em sequência gerava uma conferência por passada, e a resposta era sempre a mesma: *"Ela
     * continuou vendo links/compartilhamentos — não é despedida nem agradecimento final"*.
     *
     * É a quarta guarda mecânica desta porta, e a mais barata: link e vídeo de outra pessoa não
     * carregam despedida nenhuma, então não há julgamento a pedir. Mensagem que tem link **e**
     * texto dela continua passando — `ehRepasse` só vale quando, tirando o link, não sobra nada.
     */
    if (escreveu.every((m) => ehRepasse(m))) return false;

    const alvo = state.contact?.id;
    const chave = `${alvo}|${escreveu.map((m) => m?.at || '').join(',')}`;
    let c = conferenciasDeEncerramento.get(chave);
    if (!c) {
      try {
        c = await iaCliente.conferirEncerramento({
          regras: state.ia.regras,
          mensagens: conversaParaIA(),
          gatilho: 'a rodada ia responder; o vocabulário de despedida não reconheceu nada',
          modelo: state.ia.modelo,
        });
      } catch (err) {
        c = { acao: 'incerto', motivo: '', confianca: 0, aviso: err?.message || String(err) };
      }
      if (c.acao !== 'incerto') conferenciasDeEncerramento.set(chave, c);
      registrarNaRodada(
        'IA',
        'pulado',
        `encerramento · ${c.acao}${c.custoUsd ? ` · US$ ${c.custoUsd.toFixed(4)}` : ''}${c.motivo ? ` · ${c.motivo}` : ''}${c.aviso ? ` · ${c.aviso}` : ''}`
      );
    }
    /** O atendimento trocou no meio da chamada: a decisão era de outro contato. */
    if (state.contact?.id !== alvo) return false;
    return c.acao === 'sim';
  }

  async function etiquetarEndereco(alvo, { gatilho = '', acabamosDeMandar = '' } = {}) {
    const nome = String(state.auto.cfg.etiquetaEndereco || '').trim();
    if (!nome) return ' (sem etiqueta de endereço configurada na aba Automatizado)';
    if (!alvo?.id) return '';

    /**
     * **A IA CONFERE ANTES DE MARCAR** — pedido dele (16/09/2026): *"etiqueta de material continua
     * problemática; quando o determinístico identificar material, a IA assume e confere se realmente
     * é uma situação de pedido de material para então etiquetar"*.
     *
     * **Aqui, e não em cada caminho**, porque os cinco que acendem a etiqueta passam por esta função:
     * o modelo aprovado e a resposta pronta que pedem o endereço, o rascunho da IA que o pede, o pedido
     * de material fora do anúncio e o endereço que ela mandou. Cinco cópias da conferência divergiriam
     * na primeira semana.
     *
     * **Só com a IA ligada e chave cadastrada.** Com ela desligada a etiqueta segue como antes — ele
     * pediu que a IA assuma, não que a lista de material deixe de existir sem ela. **Com a IA ligada,
     * só `material` marca**: `nao` e `incerto` (falha, resposta ilegível, certeza baixa) não marcam, e
     * a linha diz por quê — dúvida não vira etiqueta que faz pular para sempre.
     *
     * **Uma conferência por situação**: o pulo de quem mandou endereço volta a acender a cada passada
     * enquanto ninguém responde, e perguntar de novo à IA a mesma coisa seria dinheiro por nada. A
     * chave é o contato, a última mensagem dela e o gatilho — mudou qualquer um, confere de novo.
     *
     * **E o contato tem de ser o que está aberto**: a conferência lê a conversa da tela, e conferir
     * a conversa de um para marcar outro é a armadilha da pergunta de cidade.
     */
    if (state.ia?.ligada && state.iaTemChave) {
      if (alvo.id !== state.contact?.id) return ' (a IA não conferiu: o atendimento mudou — não marquei)';
      const ultimaDela = (state.entrantes || []).map((m) => m?.at).filter(Boolean).pop() || '';
      const chave = `${alvo.id}|${ultimaDela}|${gatilho}|${String(acabamosDeMandar || '').length}`;
      let c = conferenciasDeMaterial.get(chave);
      if (!c) {
        c = await iaCliente.conferirMaterial({
          regras: state.ia.regras,
          mensagens: conversaParaIA(),
          gatilho,
          acabamosDeMandar,
          modelo: state.ia.modelo,
        });
        if (c.acao !== 'incerto') conferenciasDeMaterial.set(chave, c);
        registrarNaRodada(
          'IA',
          'pulado',
          `material · ${c.acao}${c.custoUsd ? ` · US$ ${c.custoUsd.toFixed(4)}` : ''}${c.motivo ? ` · ${c.motivo}` : ''}${c.aviso ? ` · ${c.aviso}` : ''}`
        );
      }
      if (c.acao === 'nao') return ` (a IA conferiu e NÃO é pedido de material: ${c.motivo || 'sem motivo dado'} — não marquei)`;
      if (c.acao !== 'material') return ` (a IA não confirmou que é material${c.aviso ? `: ${c.aviso}` : ''} — não marquei)`;
    }

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
   * **AS ETIQUETAS POR PALAVRA NO QUE NÓS MANDAMOS** (pedido dele, 01/10/2026: *"preciso da opção
   * de que quando eu enviar uma palavra chave uma etiqueta que eu escolher também seja colocada"*).
   *
   * **A metade do CONTATO já existia** (`store.tagRules`, as etiquetas por conteúdo); esta é a do
   * nosso lado, e é a generalização do que a etiqueta de material já fazia por um invariante
   * escrito no código — aqui a palavra e a etiqueta são dele, na aba Config.
   *
   * **Chamada de TODOS os pontos por onde texto nosso sai**, que são quatro e não um: o modelo
   * aprovado (`enviarModelo`), a resposta pronta (`sendTemplate`), o rascunho da IA e a legenda do
   * envio em lote. Foi essa contagem que custou a etiqueta de material em 15/09 — *"ao pôr uma
   * marca no ponto único por onde tudo sai, confira que são DOIS pontos"*.
   *
   * **Falha de etiqueta NUNCA bloqueia o envio** (a prioridade de 20/08): isto devolve o sufixo da
   * linha do Andamento e nada mais. E **não confere com a IA**: o fato é o nosso texto, que está
   * escrito — não há julgamento sobre o que a pessoa quis dizer.
   */
  async function etiquetarPorPalavra(alvo, texto) {
    if (!alvo?.id || !String(texto || '').trim()) return '';
    let achadas;
    try {
      achadas = await tagsLib.etiquetasDoEnvio(texto);
    } catch (err) {
      return ` (não consegui ler as etiquetas por palavra: ${err?.message || err})`;
    }
    if (!achadas.length) return '';

    const partes = [];
    const ids = [];
    for (const achada of achadas) {
      if (!achada.tag) {
        partes.push(`(a etiqueta "${achada.nome}" de "${achada.padrao}" não existe no CRM)`);
        continue;
      }
      // Já está no contato: não é falha, e reaplicar seria uma escrita por nada.
      if ((alvo.tagsId || []).includes(achada.tag.id) || ids.includes(achada.tag.id)) continue;
      ids.push(achada.tag.id);
      partes.push(`"${achada.tag.label}" (casou "${achada.padrao}")`);
    }
    if (!ids.length) return partes.length ? ` ${partes.join(' ')}` : '';

    try {
      const r = await tagsLib.applyTags(alvo, ids);
      if (!r?.ok) return ` (não consegui aplicar a etiqueta por palavra: ${partes.join(', ')})`;
      // O contato em memória passa a ter as etiquetas, senão a passada seguinte reaplica.
      alvo.tagsId = [...(alvo.tagsId || []), ...ids];
      return ` + etiqueta por palavra: ${partes.join(', ')}`;
    } catch (err) {
      return ` (não consegui aplicar a etiqueta por palavra: ${err?.message || err})`;
    }
  }

  /**
   * **A ETIQUETA POR PALAVRA LIDA DA CONVERSA — porque o painel só vê o que o PAINEL mandou**
   * (relato dele, 02/10/2026: *"só no automatizado está sendo colocada a etiqueta"*).
   *
   * **Medido: os dois consertos anteriores cobriam caminhos do painel, e o buraco é maior que
   * isso.** Marcar no instante do envio só funciona para mensagem que SAIU POR AQUI — e sai muita
   * coisa por fora: ele digitando na conversa, as respostas rápidas da PRÓPRIA plataforma, o
   * chatbot do anúncio, outra pessoa da equipe, o celular na mão dele.
   *
   * **A saída é a que este projeto já aprendeu três vezes:** marca amarrada a QUAL caminho enviou
   * morre quando o caminho muda — quem precisa saber o que já saiu **pergunta à CONVERSA**
   * (`getConversation().nossas`, que existe exatamente porque `wasSent` só enxerga o painel).
   *
   * Roda no `load()`, depois das sugestões de etiqueta. **Só ESCREVE quando há regra casada e a
   * etiqueta ainda não está no contato**, então abrir o mesmo contato dez vezes não custa escrita
   * nenhuma — e a conversa é a desta sessão, que é a janela em que a decisão dele faz sentido.
   */
  async function etiquetarPorPalavraDoQueJaSaiu() {
    if (!state.contact?.id) return;
    const textos = (state.nossas || [])
      .map((m) => (typeof m === 'string' ? m : String(m?.texto || '')))
      .filter((t) => t.trim());
    if (!textos.length) return;

    const marca = await etiquetarPorPalavra(state.contact, textos.join('\n'));
    // Linha no Andamento só quando houve o que marcar: o log é onde ele descobre por que a
    // extensão fez alguma coisa, e linha que aparece sempre é linha que se aprende a ignorar.
    if (marca.trim()) {
      registrarNaRodada(state.contact?.name || 'contato', 'etiqueta', `pelo que já mandamos:${marca}`);
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
        'Rodadas que LEEM a conversa e decidem pelo quadro, andando pela fila da esquerda do jeito ' +
          'que ela está filtrada agora na plataforma, de cima para baixo. Uma rodada por vez — e o ' +
          'disparo, na aba Disparo, conta como uma delas.')
    );

    /**
     * **A caixa da IA subiu para o TOPO da aba** — print dele (06/09/2026): *"o box de IA está
     * ligado, então aqui deveria chamar a IA para escrever e enviar"*. Não estava: o que ele tinha
     * marcado era "Automatizar a rodada", e a caixa da IA estava **desmarcada, dentro do cartão dos
     * Novos** — outro cartão, longe do botão "Começar pelos Meus", que é o que ele aperta.
     *
     * `ia.ligada` é uma chave SÓ e vale para as duas filas; morando dentro de um dos cartões, ela
     * parecia ser daquela fila. E o aviso do cartão dos Meus ainda mandava procurá-la na aba
     * Config, de onde ela saiu na 2.59 — ou seja, a tela apontava para um controle que não existe.
     *
     * Um interruptor, um lugar, acima dos dois botões de começar.
     */
    body.append(renderCartaoIA());

    /**
     * **OS BOTÕES DE COMEÇAR FICAM JUNTOS** — relato dele (02/10/2026): *"organize também o
     * frontend, o automatizado dos meus e novos ficou longe um do outro"*.
     *
     * Estava: "Novos" era o 5º cartão e "Meus" o 8º, com o texto da mensagem do momento e o cartão
     * inteiro do envio em lote no meio — duas telas de rolagem entre os dois botões que ele mais
     * aperta. A ordem agora tem três blocos, e o critério é o momento de uso: o que vale para
     * TODAS as rodadas (a IA, o ritmo, a fila da esquerda), depois as rodadas em si, e por último o
     * que se configura uma vez e não se olha mais (o contador, o texto do momento, as etiquetas).
     *
     * É a mesma correção de 06/09, quando a caixa da IA morava dentro do cartão dos Novos: um
     * controle longe do botão que ele aperta parece ser de outra coisa.
     */
    body.append(renderCartaoRitmo(cfg));
    body.append(renderCartaoFila());

    body.append(h('div', { class: 'wf-sub wf-secao' }, h('b', {}, 'As rodadas')));
    body.append(renderCartaoRespondidos());
    body.append(renderCartaoNovos(cfg));
    /**
     * **O disparo e o "atender um por um" MUDARAM DE ABA** — pedido dele (02/10/2026): *"separe
     * toda essa criação nova para uma aba nova chamada disparo"*. Eles não consultam o quadro e não
     * respondem ninguém: são ele mandando (ou abrindo) para uma lista, e moravam no fim desta aba
     * empurrando as rodadas do fluxo para cima. Ver `renderDisparo`.
     */

    body.append(h('div', { class: 'wf-sub wf-secao' }, h('b', {}, 'O que as rodadas usam')));
    body.append(renderCartaoMeusAbertos());
    body.append(renderCartaoMomento(cfg));
    body.append(renderCartaoEtiquetas(cfg));
    // Logo abaixo do que a rodada APLICA, de propósito: as duas listas se leem juntas, e é olhando
    // as duas que ele vê a etiqueta que está nos dois lados (sai e volta em toda passada).
    body.append(renderCartaoRemoverEtiquetas(cfg));
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
    // `data-fica`: as anotações são DADO (a contagem de novas, o caso copiado) — nada aqui vai para
    // "detalhes" (10/09, "tenha discernimento").
    const obsNode = h('div', { 'data-fica': '1' });
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
    // `data-fica`: o log é DADO — cada linha é um contato e o motivo. O resumo da 3.37 cortava cada
    // linha no travessão e escondia o motivo (print dele, 10/09: "aplicou detalhes até no log").
    logNode = h('div', { 'data-fica': '1' });
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

  /**
   * **Ela veio de anúncio?** — e a resposta não está só na sessão.
   *
   * Relato dele (05/09/2026), com a print do Orides: *"a pessoa com etiqueta de ADS e parou no ramo
   * de sem etiqueta"*. Ele mandou um vídeo do TikTok, tem a etiqueta **ADS** no CRM — e recebeu as
   * boas-vindas de *"chegou sem anúncio"*, com o pedido de cadastro junto.
   *
   * A causa: o sinal lia só `session.utm`, que é **"veio de anúncio NESTA sessão"**. Quem clicou no
   * anúncio semanas atrás e voltou sozinho abre sessão sem `utm` — e a etiqueta é justamente o que
   * guarda que ele veio de lá. Detector é palpite; a marca no CRM é decisão, e decisão não se
   * redescobre — mesma lição da etiqueta de sem interesse e da de material.
   *
   * **As outras duas leituras de `utm` continuam como estão, e de propósito:** `prepararEntrantes`
   * marca a primeira mensagem da sessão como gerada pelo anúncio (uma etiqueta velha marcaria a
   * fala de outra visita), e a etiqueta de origem só é aplicada por quem chega agora. O que muda
   * aqui é só o SINAL do quadro.
   */
  async function veioDeAnuncioAlgumaVez() {
    if (state.session?.utm?.source || state.session?.utm?.referralUrl) return true;
    const doCrm = new Set(state.contact?.tagsId || []);
    if (!doCrm.size) return false;
    const [todas, deOrigem] = await Promise.all([
      tagsLib.allTags().catch(() => []),
      tagsLib.etiquetasDeOrigem().catch(() => new Set()),
    ]);
    return todas.some((t) => doCrm.has(t.id) && deOrigem.has(cities.normalize(t.label)));
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

  /**
   * **O interruptor da IA, e o único que existe** — no topo da aba Automatizado (06/09/2026).
   *
   * Ele já morou em dois lugares ao mesmo tempo (aba Config e cartão dos Novos) e nenhum dos dois
   * era onde a decisão acontece. Agora é um só, acima dos dois botões de começar, porque a chave é
   * uma só e vale para as duas filas.
   *
   * O texto diz as DUAS coisas que ela faz — escrever onde o fluxo não resolve, e conferir a
   * cidade — porque o rótulo antigo (*"a avaliação por IA"*) descrevia a IA que escolhia resposta
   * pronta, e essa deixou de existir na 2.58.
   */
  function renderCartaoIA() {
    const card = h('div', { class: 'wf-card' });
    card.append(h('h4', {}, 'A IA nesta aba'));

    card.append(
      checkbox(
        'Usar a IA nas rodadas (custa por contato em que ela entra)',
        !!state.ia?.ligada,
        async (v) => {
          await salvarIA({ ligada: v });
          setStatus(
            v
              ? 'IA ligada — vale para as duas filas, e custa por contato em que ela entra.'
              : 'IA desligada: só as regras do fluxo decidem, e a cidade de palpite espera você.',
            'ok'
          );
          renderAll();
        }
      )
    );

    /**
     * **O interruptor do modo de TREINO** — pedido dele (15/09/2026): *"deixe o antigo, que irá
     * rodar sozinho já com o conhecimento, quando estiver com taxa baixa de erro, e crie o modo de
     * treino da IA, que foi o que fizemos agora"*.
     *
     * Fica ao lado do interruptor da IA, na aba em que ele aperta "Começar" — a mesma razão pela
     * qual a caixa da IA desceu da Config para cá em 06/09: controle longe do botão que o usa é
     * controle que ninguém encontra (ele perguntou duas vezes onde estava).
     */
    /**
     * **"O que a IA leu" também fora do treino** — no modo antigo não há janela de escolha, e a
     * pergunta dele (*"o que ela tem acesso e o que não tem"*) vale para os dois modos. Só aparece
     * depois de um rascunho neste contato: antes disso não há o que mostrar, e botão que abre vazio
     * ensina a não clicar.
     */
    if (state.lidoPelaIA) {
      const btnLido = h('button', { class: 'wf-btn', type: 'button' }, 'O que a IA leu no último rascunho');
      btnLido.addEventListener('click', () => mostrarOQueAIALeu());
      card.append(btnLido);
    }

    card.append(
      h('div', { class: 'wf-origin' },
        'Ligada, ela faz duas coisas e só elas: ESCREVE a resposta nos casos que o fluxo passa ' +
          'para você (uns 5% dos contatos, medido) e CONFERE a cidade antes de ela ir para o CRM. ' +
          'O resto continua sendo decidido pelo fluxo, de graça.'),
      h('div', { class: 'wf-origin' },
        'Com "Automatizar a rodada" também marcada, o que ela escrever é ENVIADO sem perguntar. ' +
          'Sozinha, ela só deixa o rascunho no campo de mensagem para você mandar.')
    );

    // Caixa marcada que não faz nada é a armadilha que este painel já pagou: sem chave, a IA não
    // roda, e a rodada segue só com as regras.
    if (state.ia?.ligada && !state.iaTemChave) {
      // Diz o PROVEDOR: com dois, "não há chave salva" manda procurar no campo errado — e o campo
      // do outro pode estar cheio, o que faz o aviso parecer defeito do painel.
      const prov = iaLib.NOME_DO_PROVEDOR[iaLib.provedorDoModelo(state.ia?.modelo || iaLib.MODELO_PADRAO)];
      card.append(
        h('div', { class: 'wf-block' },
          `A IA está ligada mas não há chave da ${prov} salva — o modelo escolhido é dessa casa. ` +
            'Cadastre na aba Config, senão ela não escreve nada.')
      );
    }
    return card;
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
        'Automatizar a rodada: envia sozinha o que as REGRAS decidem — e, com a IA ligada, o que ela escrever',
        state.auto.cfg.automatizarComIA,
        (v) => salvarAuto({ automatizarComIA: v }).then(renderAll)
      )
    );
    /**
     * **Concluir sozinho quem está num número REMOVIDO** — pedido dele (14/10/2026).
     *
     * Fica ao lado de "Automatizar" porque **depende dela**: desmarcada a de cima, a rodada
     * pergunta contato a contato de qualquer jeito, e esta não muda nada. É por isso que o texto
     * diz "na rodada automática" em vez de prometer um efeito que ela sozinha não tem.
     */
    card.append(
      checkbox(
        'Concluir sozinho quando o NÚMERO do atendimento foi REMOVIDO da conta (na rodada automática)',
        state.auto.cfg.concluirCanalRemovido,
        (v) => salvarAuto({ concluirCanalRemovido: v }).then(renderAll)
      ),
      h('div', { class: 'wf-origin' },
        'Número REMOVIDO é diferente de número fora do ar. Fora do ar volta, e aí a rodada pula e ' +
          'espera. Removido não volta: não há por onde mandar nada, e o atendimento ficaria aberto ' +
          'na fila para sempre. Desmarcado, a rodada continua perguntando — a opção de concluir ' +
          'aparece na caixa, ao lado de pular e parar.'),
      h('div', { class: 'wf-origin' },
        'A conferência é pela API (a lista de números da conta), e não pela tarja da tela: número ' +
          'removido pode não gerar tarja nenhuma. A leitura é uma por rodada, e falhando ela a ' +
          'rodada se comporta como antes — não consegui ler NÃO é "foi removido", e concluir por ' +
          'causa de um erro de rede tiraria a pessoa da fila por engano.')
    );

    /**
     * **O limite de tempo do contexto** — pedido dele (14/10/2026): *"bote um limite de 48 horas
     * para seguir o fluxo normalmente, senão mandar mensagem do momento"*. Campo e não constante,
     * pela lição do teto de 45 por número (02/10).
     */
    card.append(
      campoNumero(
        'Contexto passou depois de quantas HORAS sem ela escrever (0 desliga)',
        state.auto.cfg.horasContextoPerdido,
        (v) => salvarAuto({ horasContextoPerdido: v }).then(renderAll)
      ),
      h('div', { class: 'wf-origin' },
        'Passado o limite, a rodada para de seguir o fluxo e manda a MENSAGEM DO MOMENTO — ou ' +
          'conclui sem enviar, se não houver mensagem do momento para mandar. Responder o assunto ' +
          'de doze dias atrás soa a quem não estava lá.'),
      h('div', { class: 'wf-origin' },
        'Passado o limite, o fluxo não decide mais nada — nem pergunta pendente nem pedido de ' +
          'material seguram (as duas exceções saíram em 14/10, por decisão sua: o material era do ' +
          'período eleitoral, e pergunta de doze dias atrás não tem o que responder).'),
      h('div', { class: 'wf-origin' },
        'Só duas coisas continuam passando por cima: quem só se DESPEDIU, que segue sendo ' +
          'concluído em silêncio, e as protecões que não enviam nada — sem interesse, assessor, ' +
          'presença confirmada, endereço informado e a etiqueta que dispensa da fila. Na CHEGADA ' +
          'pelo anúncio, o recibo ainda vence o tempo: essa posição é do seu quadro.')
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
          'Atenção: a caixa "Usar a IA nas rodadas", no TOPO desta aba, está DESMARCADA — então a ' +
            'IA não escreve nada aqui. As REGRAS continuam sendo executadas sozinhas por esta ' +
            'caixa, e a maioria delas envia mensagem. Marque a de cima para a IA escrever (e, com ' +
            'esta marcada, mandar) nos casos que o fluxo passa para você; desmarque esta para a ' +
            'rodada voltar a perguntar antes de cada envio.')
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

    card.append(...campoDeImagem({
      rotulo: 'Imagem junto da mensagem do momento',
      valor: cfg.imagemMomento,
      ligada: cfg.imagemMomentoLigada,
      aoMudar: (v) => salvarAuto({ imagemMomento: v }).then(renderAll),
      aoLigar: (v) => salvarAuto({ imagemMomentoLigada: v }).then(renderAll),
      chaveDoArquivo: perfisLib.chaveDeImagem('imagemMomentoArquivo', perfilAtivo()),
    }));

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
    card.append(...campoDeImagem({
      rotulo: 'Imagem junto do pedido de dados',
      valor: cfg.imagemPedidoDados,
      ligada: cfg.imagemPedidoDadosLigada,
      aoMudar: (v) => salvarAuto({ imagemPedidoDados: v }).then(renderAll),
      aoLigar: (v) => salvarAuto({ imagemPedidoDadosLigada: v }).then(renderAll),
      chaveDoArquivo: perfisLib.chaveDeImagem('imagemPedidoDadosArquivo', perfilAtivo()),
    }));

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

    card.append(...aprenderEnvioDeImagemUI());

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
      // Esc SINTÉTICO não fecha nada: a extensão dispara um para fechar menu e diálogo do Material
      // (`dom.fecharOverlay`, `hsm`), e ele borbulha até aqui — fecharia o editor no meio da
      // digitação, perdendo o texto. Só teclado de verdade traz `isTrusted`.
      if (ev.key !== 'Escape' || !ev.isTrusted) return;
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
        'Aplicada quando a rodada reconhece o pedido de dinheiro, ajuda financeira ou emprego — ' +
          'seja quem for que responda: a IA, um ramo do quadro ou a resposta rápida. Quem quer ' +
          'trabalhar como voluntário na campanha não é marcado. Ex.: "🔴Procura emprego ou dinheiro".'),
      campoTexto('Etiqueta de quem MANDOU ENDEREÇO (material para enviar)', cfg.etiquetaEndereco, (v) =>
        salvarAuto({ etiquetaEndereco: v.trim() }).then(renderAll)
      ),
      h('div', { class: 'wf-origin' },
        'Quem escreve um endereço — rua com número, bairro ou CEP — é marcado com ela e PULADO, ' +
          'com o atendimento deixado aberto para você transferir a conversa ao responsável pelo ' +
          'envio. É a única etiqueta que a rodada aplica ao pular: nos outros casos, pular não ' +
          'grava nada. O endereço sozinho basta porque você só o pede para mandar material.'),
      campoTexto('Etiqueta de quem mora FORA DO RS', cfg.etiquetaForaDoRS, (v) =>
        salvarAuto({ etiquetaForaDoRS: v.trim() }).then(renderAll)
      ),
      h('div', { class: 'wf-origin' },
        'Quando a cidade do contato é um município do Brasil que não é do RS (Curitiba, ' +
          'Florianópolis, São Paulo), ele recebe ESTA etiqueta — e nenhuma de cidade nem de ' +
          'COREDE, que são estaduais. Já vem preenchida com "Fora do RS"; apagando o campo, o ' +
          'código usa esse mesmo nome.')
    );

    if (!cfg.etiquetaSemInteresse && !cfg.etiquetaPedidoAjuda && !cfg.etiquetaEndereco) {
      card.append(h('div', { class: 'wf-block' }, 'Nenhuma das três primeiras está preenchida — nesses casos a rodada não marca ninguém.'));
    }
    return card;
  }

  /**
   * **O cartão das etiquetas que a rodada TIRA** — pedido dele (14/10/2026): *"crie um espaço no
   * automatizado para remover etiquetas, as etiquetas que eu listar nesse espaço devem ser
   * removidas"*, e, perguntado de quem elas saem, **"de quem a rodada atender"**.
   *
   * É o irmão do cartão de cima, e o único lugar do painel que APAGA etiqueta de eleitor em laço —
   * por isso a tela diz as três coisas que não se descobrem usando: que a etiqueta sai ANTES de a
   * rodada decidir (então protege menos), que cidade/COREDE/conteúdo voltam na passada seguinte
   * porque são derivadas do cadastro, e que remover a etiqueta do disparo devolve a pessoa para a
   * lista dele.
   */
  function renderCartaoRemoverEtiquetas(cfg) {
    const card = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Etiquetas que a rodada REMOVE'),
      h('div', { class: 'wf-preview' },
        'A lista das etiquetas que devem SAIR de cada contato que a rodada atender. Nome EXATO do ' +
          'CRM, separado por vírgula ou uma por linha. Vazio = não remove nada de ninguém.'),
    ]);

    card.append(
      campoTexto('Etiquetas a remover (separe por vírgula)', cfg.etiquetasParaRemover, (v) =>
        salvarAuto({ etiquetasParaRemover: v.trim() }).then(renderAll)
      ),
      h('div', { class: 'wf-origin' },
        'Sai de quem a rodada do fluxo atender (Meus, Novos e Outros), logo depois de carregar o ' +
          'contato — antes de qualquer barreira que o pularia, senão a lista não funcionaria ' +
          'justamente para as etiquetas que fazem a rodada pular. Quem não tem nenhuma delas não ' +
          'custa requisição nenhuma. O disparo por etiqueta NÃO remove: lá o contato não é ' +
          'carregado, e é a etiqueta do próprio disparo que impede o reenvio.'),
      h('div', { class: 'wf-origin' },
        'A etiqueta sai ANTES de a rodada decidir o que fazer, e isso tem preço: listando a ' +
          'etiqueta de SEM INTERESSE ou a de assessor, ela deixa de proteger nessa mesma passada — ' +
          'o contato passa a receber o que ela impedia. Listando a etiqueta do DISPARO, a pessoa ' +
          'volta a entrar nos lotes seguintes.'),
      h('div', { class: 'wf-origin' },
        'Etiqueta de CIDADE, de COREDE e de conteúdo são DERIVADAS do cadastro: a rodada as ' +
          'reaplica na passada seguinte, então listar uma delas é guerra perdida — o que resolve ' +
          'ali é corrigir o campo Cidade ou a regra que as gera.'),
      h('div', { class: 'wf-origin' },
        'Nome que não existe no CRM só gera aviso no Andamento e a rodada segue: ao contrário da ' +
          'lista de PULAR do disparo, aqui o nome errado não manda nada para ninguém — ele apenas ' +
          'deixa a etiqueta onde estava. O primeiro contato de cada rodada em que algo sai é relido ' +
          'para conferir que a plataforma removeu de verdade; se não removeu, a rodada para ali.')
    );

    /**
     * **Etiqueta que ele manda remover e alguma rodada APLICA — e a consequência depende de QUEM.**
     *
     * A primeira versão deste aviso dizia "sai e volta em toda passada" para os cinco campos, e
     * print dele mostrou a frase errada em cima de *"1 TESTE DISPARO"*: aquele é o campo do
     * DISPARO, aplicado em `processarLote`, que é outra rodada e nem remove etiqueta. Duas
     * consequências diferentes, dois textos — e o campo é NOMEADO, em vez de mandar procurar
     * entre cinco.
     */
    const colidem = loteLib.colisaoDeRemocao({
      remover: loteLib.nomesDaLista(cfg.etiquetasParaRemover),
      aplicadas: [
        { nome: cfg.etiquetaSemInteresse, rotulo: 'Etiqueta de SEM INTERESSE', onde: 'rodada' },
        { nome: cfg.etiquetaPedidoAjuda, rotulo: 'Etiqueta de quem PEDIU DINHEIRO OU EMPREGO', onde: 'rodada' },
        { nome: cfg.etiquetaEndereco, rotulo: 'Etiqueta de quem MANDOU ENDEREÇO', onde: 'rodada' },
        { nome: cfg.etiquetaForaDoRS, rotulo: 'Etiqueta de quem mora FORA DO RS', onde: 'rodada' },
        { nome: cfg.etiquetaLote, rotulo: 'Etiqueta de quem JÁ RECEBEU (o recibo), na aba Disparo', onde: 'disparo' },
      ],
    });
    for (const c of colidem) {
      const texto = c.onde === 'disparo'
        ? `"${c.nome}" está nesta lista E é a "${c.rotulo}". Não é a cada passada: o disparo só a ` +
          'aplica quando você dispara. O preço é outro — essa etiqueta é a memória que impede o ' +
          'reenvio, então tirá-la devolve essas pessoas para os próximos lotes.'
        : `"${c.nome}" está nesta lista E é a "${c.rotulo}", que a rodada do fluxo aplica — ela vai ` +
          'sair e voltar em toda passada, uma escrita por contato sem nada mudar no fim. Apague o ' +
          'nome de um dos dois lados.';
      card.append(h('div', { class: 'wf-block', 'data-fica': '1' }, texto));
    }
    card.append(h('div', { class: 'wf-origin' },
      'Esta conferência olha os cinco campos de etiqueta das abas Automatizado e Disparo. Ela NÃO ' +
        'enxerga a tabela "Etiqueta por palavra do que saiu" (aba Config): se a etiqueta que você ' +
        'listou aqui estiver lá, ela também volta sozinha.'));
    return card;
  }

  /**
   * **O MESMO cartão aparece na aba Automatizado e na Disparo**, de propósito: o limite e a pausa
   * são UMA configuração (`auto.limite`, `auto.pausaSeg`) que vale para todas as rodadas. Uma cópia
   * por aba divergiria na primeira correção; o que a tela precisa é DIZER que o valor é comum,
   * senão trocar o limite no disparo mudaria a rodada dos "Meus" sem ele perceber.
   */
  function renderCartaoRitmo(cfg) {
    const card = h('div', { class: 'wf-card' }, [h('h4', {}, 'Ritmo')]);
    card.append(
      campoNumero('Quantos envios nesta rodada', cfg.limite, (v) =>
        salvarAuto({ limite: clampInt(v, 1, LIMITE_MAX) }).then(renderAll)
      ),
      campoNumero('Pausa entre envios (segundos, 0 = sem pausa)', cfg.pausaSeg, (v) => {
        /**
         * **Texto sem dígito volta ao PADRÃO, nunca a zero** — a mesma guarda do teto por número:
         * com o mínimo em 0, um campo apagado ou um "oito" digitado gravariam "sem pausa", que é a
         * proteção desligada por um escorregão. Desligar exige digitar o zero.
         */
        const so = String(v).replace(/[^\d]/g, '');
        const valor = so === '' ? PAUSA_PADRAO : Math.min(PAUSA_MAX, parseInt(so, 10));
        salvarAuto({ pausaSeg: valor }).then(renderAll);
      }),
      h('div', { class: 'wf-origin' },
        'Estes dois valem para TODAS as rodadas — as do fluxo e as do disparo. É o mesmo cartão nas ' +
          'duas abas, não duas configurações.')
    );

    /**
     * **Os limites viraram AVISO** (03/10/2026, pedido dele). Era trava: a pausa não descia de 3 s e
     * o limite não passava de 200. O que eles protegiam continua verdadeiro, então o número some e o
     * motivo fica — alarme que só aparece quando ele passa do que era o limite, e não a cada desenho.
     */
    const limiteAgora = limiteDaRodada(cfg);
    const pausaAgora = pausaDaRodada(cfg);
    if (pausaAgora < 3) {
      card.append(h('div', { class: 'wf-block', 'data-fica': '1' },
        `Pausa de ${pausaAgora}s: cada contato do disparo custa ~8 requisições, e quando a ` +
          'plataforma recusa por excesso o erro chega como "Failed to fetch" — a rodada espera e, ' +
          'em três seguidos, para. Do lado do WhatsApp o que pune é o ritmo: menos de dez mensagens ' +
          'iguais em sequência já derrubaram um número seu. Foi você quem tirou o piso de 3s.'));
    }
    if (limiteAgora > 200) {
      card.append(h('div', { class: 'wf-block', 'data-fica': '1' },
        `${limiteAgora} contatos numa rodada: a lista do filtro vem de 200 em 200, então acima disso ` +
          'eu peço mais páginas (uma requisição a cada 200). O freio que continua valendo é o teto ' +
          'por número, por dia — confira que ele comporta o que você pediu aqui.'));
    }

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
      'Automático ligado: envia sozinha o que as REGRAS decidem — e, com a IA ligada, o que ela escrever',
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

    const comecar = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Começar pelos Novos');
    comecar.addEventListener('click', () => withBusy(runLoteNovos));
    card.append(h('div', { class: 'wf-row' }, [comecar]));

    const impedimentos = [];
    if (!state.settings.autoSend) impedimentos.push('Precisa do "Enviar automático" ligado (acima).');
    if (!state.hsmTemplates.length) {
      impedimentos.push('Nenhum modelo aprovado carregado — abra um atendimento e clique em Recarregar.');
    }

    comecar.disabled = state.auto.rodando || impedimentos.length > 0;
    for (const motivo of impedimentos) card.append(h('div', { class: 'wf-block', 'data-fica': '1' }, motivo));
    return card;
  }

  // ---- aba Disparo -------------------------------------------------------

  /**
   * **A ABA DO DISPARO** — pedido dele (02/10/2026): *"separe toda essa criação nova para uma aba
   * nova chamada disparo"*.
   *
   * **Por que ela é uma aba e não um cartão:** o que vive aqui não responde ninguém. As rodadas da
   * aba Automatizado leem a conversa e consultam o quadro; estas duas percorrem uma LISTA — ele
   * mandando a mesma coisa, ou abrindo atendimento para atender à mão. São trabalhos diferentes, em
   * momentos diferentes do dia, e um deles estava empurrando o outro para o fim de duas telas de
   * rolagem.
   *
   * A ordem é a de montar um disparo: **o que sai → para quem → por qual número → ritmo → dispara**,
   * e o modo de só abrir no fim, porque reusa a lista e os números dos cartões de cima.
   */
  function renderDisparo() {
    const cfg = state.auto.cfg;

    body.append(
      h('p', { class: 'wf-hint' },
        'Mandar a mesma coisa para uma lista, fora do fluxo: nada aqui consulta o quadro nem lê a ' +
          'conversa para decidir. As proteções continuam de pé — etiqueta de sem interesse, de ' +
          'assessor, número fora do ar e quem já recebeu.')
    );

    body.append(renderCartaoPecas(cfg));
    body.append(renderCartaoParaQuem(cfg));
    body.append(renderCartaoNumeros(cfg));
    body.append(renderCartaoRitmo(cfg));
    body.append(renderCartaoDisparar(cfg));

    body.append(h('div', { class: 'wf-sub wf-secao' }, h('b', {}, 'Sem enviar nada')));
    body.append(renderCartaoAtender(cfg));
  }

  /**
   * **O DISPARO: peças (texto, com arte ou sem), para quem, por qual número** — pedido dele
   * (02/10/2026): *"separe toda essa criação nova para uma aba nova chamada disparo; preciso que
   * tenha a opção de só mandar texto sem imagem; a opção de mandar imagens não precisa ser 4, bote
   * a opção de adicionar ou remover quantidades, e também as caixas de texto com a mesma opção"*.
   *
   * Era UM cartão de 340 linhas no fim da aba Automatizado — peças, etiquetas, equipe, fila de
   * números, teto e botões, tudo junto, abaixo das rodadas do fluxo. Hoje são quatro cartões na aba
   * própria, na ordem em que ele monta um disparo: **o que sai → para quem → por qual número →
   * dispara**.
   *
   * Esta rodada **não passa pelo quadro**: não há nada a responder, é ele mandando a mesma coisa
   * para uma lista. O que continua de pé são as PROTEÇÕES (etiqueta de sem interesse, de assessor,
   * barreira do canal) — a distinção preferência/proteção de 03/09.
   *
   * **O revezamento é o ponto, não um enfeite.** A medição é dele (26/09): menos de dez mensagens
   * IGUAIS em sequência derrubaram um número, e o eixo que pune isso é o padrão de envio
   * (`channel.status` FLAGGED), não a denúncia.
   */
  function renderCartaoPecas(cfg) {
    const porPerfil = (nome) => perfisLib.chaveDeImagem(nome, perfilAtivo());
    const pares = loteLib.paresProntos({ cfg, imagens: state.imagens, chaveDeImagem: porPerfil });
    const faltas = loteLib.oQueFalta({ cfg, imagens: state.imagens, chaveDeImagem: porPerfil });
    const quantas = loteLib.quantasPecas(cfg);
    const limite = limiteDaRodada(cfg);

    const card = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'O que vai sair'),
      h('div', { class: 'wf-preview' },
        'Cada peça é um TEXTO e, se você quiser, uma ARTE junto. Peça sem arte sai como mensagem de ' +
          'texto; com arte, sai a imagem com o texto de legenda. O disparo reveza entre as peças ' +
          'prontas, uma por contato.'),
      h('div', { class: 'wf-origin' },
        'A arte e o texto dela andam juntos na mesma peça, de propósito: listas separadas cruzariam ' +
          'tudo com tudo e sairia legenda falando de uma imagem que não é a que foi. Peça com arte e ' +
          'SEM texto fica de fora — imagem muda não sai daqui, e é pelo texto que a extensão ' +
          'reconhece na conversa quem já recebeu.'),
    ]);

    /**
     * **Adicionar e remover peça, e remover NÃO apaga nada.** Baixar a conta só para de usar a
     * peça; o texto e a arte dela continuam guardados e voltam se ele adicionar de novo. Apagar
     * seria o gesto destrutivo escondido no botão inofensivo (a lição do quadro, 01/09).
     */
    const menos = h('button', { class: 'wf-btn wf-mini', type: 'button' }, '−');
    menos.disabled = quantas <= 1 || state.auto.rodando;
    menos.addEventListener('click', () => salvarAuto({ lotePecas: quantas - 1 }).then(renderAll));
    const mais = h('button', { class: 'wf-btn wf-mini', type: 'button' }, '+');
    mais.disabled = quantas >= loteLib.MAX_PECAS || state.auto.rodando;
    mais.addEventListener('click', () => salvarAuto({ lotePecas: quantas + 1 }).then(renderAll));
    card.append(
      h('div', { class: 'wf-row', 'data-fica': '1' }, [
        h('div', { class: 'wf-preview', 'data-fica': '1' }, `${quantas} peça(s), até ${loteLib.MAX_PECAS}`),
        menos,
        mais,
      ]),
      h('div', { class: 'wf-origin' },
        'Remover só para de usar a última peça: o texto e a arte dela ficam guardados e voltam se ' +
          'você adicionar de novo. Para liberar espaço de verdade, use o "Tirar" da imagem.')
    );

    for (let n = 1; n <= quantas; n++) {
      const bloco = h('div', {}, [h('div', { class: 'wf-sub' }, h('b', {}, `Peça ${n}`))]);
      const area = h('textarea', { rows: '3', placeholder: `Texto da peça ${n}` });
      area.value = cfg[loteLib.chaveDaLegenda(n)] || '';
      area.addEventListener('change', () =>
        salvarAuto({ [loteLib.chaveDaLegenda(n)]: area.value }).then(renderAll)
      );
      bloco.append(area);
      bloco.append(...campoDeImagem({
        rotulo: `Arte da peça ${n} (opcional)`,
        valor: cfg[loteLib.chaveDoLink(n)],
        aoMudar: (v) => salvarAuto({ [loteLib.chaveDoLink(n)]: v }).then(renderAll),
        chaveDoArquivo: porPerfil(loteLib.chaveDaImagem(n)),
        semInterruptor: true,
      }));
      card.append(bloco);
    }

    /**
     * **Quanto as artes estão ocupando, medido** — a extensão não pede `unlimitedStorage`, então
     * `chrome.storage.local` tem ~10 MB. Cada arte guardada pode ter 2 MB de bytes, que em base64
     * viram ~2,7 MB: oito artes cheias estouram a cota, e a escrita falharia no meio de uma edição
     * em vez de avisar antes. Com o número na tela ele vê chegando.
     */
    const bytesGuardados = Object.values(state.imagens || {}).reduce(
      (soma, arq) => soma + (arq?.dados ? Math.round((arq.dados.length * 3) / 4) : 0),
      0
    );
    const mb = (bytesGuardados / (1024 * 1024)).toFixed(1);
    if (bytesGuardados) {
      card.append(h('div', { class: 'wf-preview', 'data-fica': '1' },
        `Artes guardadas: ${mb} MB dos ~10 MB que o navegador permite.`));
    }
    if (bytesGuardados > 7 * 1024 * 1024) {
      card.append(h('div', { class: 'wf-block', 'data-fica': '1' },
        `As artes já ocupam ${mb} MB e o teto do navegador é ~10 MB: a próxima imagem grande pode ` +
          'não ser gravada. Tire a arte de uma peça que você não está usando.'));
    }

    if (pares.length) {
      /**
       * **A variável só vale no caminho pela FILA.** Lá a conversa está carregada e `vars.render`
       * resolve; no caminho por ETIQUETA não há contato nenhum aberto, e por isso ele se RECUSA a
       * começar quando acha chaves no texto (ver `runLoteContatos`). Dizer "variáveis" sem dizer
       * onde faria o texto sair com as chaves à mostra na metade dos disparos.
       */
      card.append(h('div', { class: 'wf-hint' },
        'Variáveis (só no disparo pela FILA): ' + vars.KNOWN_VARS.map(([v]) => v).join(' ')));
      const divisao = loteLib.comoVaiRevezar(pares.length, limite);
      const comArte = pares.filter((p) => p.temArte).length;
      card.append(h('div', { class: 'wf-preview', 'data-fica': '1' },
        `${pares.length} peça(s) pronta(s)` +
          (comArte === pares.length ? ' (todas com arte)' : comArte ? ` (${comArte} com arte)` : ' (todas só texto)') +
          `. Em ${limite} contatos: ` +
          divisao.map((q, i) => `${q} com a peça ${pares[i].n}`).join(', ') +
          `. A próxima a sair é a peça ${loteLib.parDaVez(pares, state.loteIndice).n}.`));
    }

    // Arte sem texto é o único estado que vale avisar: peça vazia é peça que ele não usou.
    for (const falta of faltas) card.append(h('div', { class: 'wf-block', 'data-fica': '1' }, falta));

    return card;
  }

  /**
   * **Para QUEM, e a etiqueta que ele troca à vontade** — relato dele (02/10/2026): *"com relação à
   * etiqueta deve ter a opção de mudar para outra etiqueta e trocar à vontade, creio que no momento
   * só tem colinha"*.
   *
   * **Medido: o campo sempre foi texto livre e aceita qualquer etiqueta** — `COLINHA` é só o valor
   * de fábrica. O que havia era um campo enterrado no meio de um cartão de 340 linhas, abaixo das
   * quatro artes: ele estava lá e não aparecia. Hoje as duas etiquetas que decidem o disparo ficam
   * juntas, no cartão que responde "para quem", e o botão carrega a lista do CRM para ele escolher
   * em vez de digitar o nome exato.
   */
  function renderCartaoParaQuem(cfg) {
    const card = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Para quem'),
      h('div', { class: 'wf-preview' },
        'Quem tem a etiqueta da lista recebe, MENOS quem está marcado como sem interesse e quem já ' +
          'tem a etiqueta do disparo. As duas exclusões são feitas pelo servidor, então rodar de ' +
          'novo continua de onde parou, sem repetir ninguém.'),
    ]);

    card.append(
      campoTexto('Etiqueta de quem VAI RECEBER', cfg.loteEtiquetaFiltro, (v) =>
        salvarAuto({ loteEtiquetaFiltro: v.trim() }).then(renderAll)
      ),
      campoTexto('Etiqueta de quem JÁ RECEBEU (o recibo)', cfg.etiquetaLote, (v) =>
        salvarAuto({ etiquetaLote: v.trim() }).then(renderAll)
      ),
      /**
       * **A lista de PULAR** — pedido dele (02/10/2026): *"bote nos disparos uma caixa para inserir
       * etiquetas que devem ser puladas"*. Nome EXATO, separado por vírgula; vale nos três botões
       * desta aba (os dois disparos e o "atender um por um").
       */
      campoTexto('Etiquetas que devem ser PULADAS (separe por vírgula)', cfg.disparoEtiquetasPuladas, (v) =>
        salvarAuto({ disparoEtiquetasPuladas: v.trim() }).then(renderAll)
      ),
      h('div', { class: 'wf-origin' },
        'A segunda é marcada no CRM a cada envio e lida antes do próximo: é ela que impede mandar ' +
          'duas vezes para a mesma pessoa, inclusive quando ela volta dias depois (aí a conversa é ' +
          'outra e só a etiqueta lembra). Troque as duas quando quiser — são só nomes de etiqueta do ' +
          'CRM, e cada disparo pode usar outras. A extensão nunca cria etiqueta: o nome tem de ' +
          'existir lá. Recibo vazio = manda sem marcar, e sem a trava que ele dá.')
    );

    /**
     * **A lista do CRM carrega no CLIQUE, nunca no desenho** — rede disparada de dentro de um
     * `render*` vira uma requisição por redesenho. Com ela na tela, trocar de etiqueta é ler e
     * copiar em vez de acertar a grafia de cabeça, que é o que faz a rodada recusar.
     */
    const verEtiquetas = h('button', { class: 'wf-btn', type: 'button' },
      state.etiquetasDoCrm ? 'Atualizar a lista do CRM' : 'Ver as etiquetas do CRM');
    verEtiquetas.disabled = state.auto.rodando;
    verEtiquetas.addEventListener('click', () =>
      withBusy(async () => {
        const todas = await tagsLib.allTags();
        state.etiquetasDoCrm = (todas || []).map((t) => t.label || t.name || '').filter(Boolean).sort();
        setStatus(`${state.etiquetasDoCrm.length} etiqueta(s) no CRM.`, 'ok');
        renderAll();
      })
    );
    card.append(h('div', { class: 'wf-row' }, [verEtiquetas]));
    if (state.etiquetasDoCrm) {
      card.append(h('div', { class: 'wf-preview', 'data-fica': '1' },
        `Etiquetas do CRM (${state.etiquetasDoCrm.length}): ${state.etiquetasDoCrm.join(' · ')}`));
    }

    const nomesPulados = loteLib.nomesPulados(cfg.disparoEtiquetasPuladas);
    card.append(h('div', { class: 'wf-origin' },
      nomesPulados.length
        ? `Ninguém com ${nomesPulados.map((n) => `"${n}"`).join(', ')} entra em nenhum dos três ` +
          'botões desta aba — os dois disparos e o "atender um por um". O nome tem de ser EXATO: a ' +
          'rodada confere antes de começar e se recusa se algum não existir no CRM, porque nome ' +
          'errado sairia da exclusão em silêncio e essa gente receberia.'
        : 'A lista de PULAR está vazia. As exclusões que já existem continuam valendo sozinhas (a ' +
          'etiqueta de sem interesse e a do recibo); esta é a sua, para tirar qualquer outro grupo ' +
          'de um disparo — nome exato, separado por vírgula.'));

    if (!String(cfg.etiquetaLote || '').trim()) {
      card.append(h('div', { class: 'wf-block', 'data-fica': '1' },
        'Sem etiqueta de recibo: quem já recebeu só é reconhecido enquanto a conversa estiver ' +
          'aberta. Voltando noutro dia, o contato recebe de novo.'));
    }
    const nomeSemInteresse = String(cfg.etiquetaSemInteresse || '').trim();
    card.append(h('div', { class: 'wf-origin' },
      nomeSemInteresse
        ? `Fora da lista: quem tem "${nomeSemInteresse}" (a etiqueta de sem interesse, na aba Automatizado).`
        : 'ATENÇÃO: sem a etiqueta de sem interesse configurada (aba Automatizado), ninguém está ' +
          'sendo excluído por isso.'));

    return card;
  }

  /**
   * **Por qual NÚMERO: a equipe, a fila e o teto do dia.**
   *
   * Um lugar só para escolher o número, e os dois percursos do disparo e o modo de só abrir leem
   * daqui: dois lugares para escolher o mesmo número é como as duas cópias de qualquer coisa neste
   * projeto divergem, e aqui a divergência seria mandar a arte de um candidato pelo número do outro.
   */
  function renderCartaoNumeros(cfg) {
    const teto = loteLib.tetoDoCfg(cfg);
    const card = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Por qual número'),
      h('div', { class: 'wf-preview' },
        'A equipe e o número são o que a plataforma pede para ABRIR um atendimento. A fila manda ' +
          'pelo primeiro número até ele chegar ao teto do dia, e então passa para o seguinte.'),
    ]);

    /**
     * **As listas carregam no CLIQUE, nunca no desenho**: rede disparada de dentro de um `render*`
     * vira uma requisição por redesenho.
     */
    if (!state.equipes || !state.canais) {
      const carregar = h('button', { class: 'wf-btn', type: 'button' }, 'Carregar equipes e números');
      carregar.addEventListener('click', () =>
        withBusy(async () => {
          // Uma de cada vez: duas consultas no mesmo instante é rajada contra o limitador (24/09).
          state.equipes = await api.listarEquipes();
          state.canais = await api.canaisDaConta();
          setStatus(`${state.equipes.length} equipe(s) e ${state.canais.length} numero(s).`, 'ok');
          renderAll();
        })
      );
      card.append(h('div', { class: 'wf-row' }, [carregar]));
      card.append(h('div', { class: 'wf-origin' },
        cfg.loteCanalNome
          ? `Guardado: equipe "${cfg.loteEquipeNome || 'nenhuma'}", numero "${cfg.loteCanalNome}". ` +
            'Carregue para conferir ou trocar.'
          : 'Preciso ler as equipes e os números da conta para você escolher — são duas leituras, ' +
            'feitas só quando você pede.'));
      return card;
    }

    const selEquipe = h('select', {});
    selEquipe.append(h('option', { value: '' }, 'sem equipe'));
    for (const e of state.equipes) selEquipe.append(h('option', { value: e.id }, e.nome || e.id));
    selEquipe.value = cfg.loteEquipeId || '';
    selEquipe.addEventListener('change', () => {
      const escolhida = state.equipes.find((e) => e.id === selEquipe.value);
      salvarAuto({ loteEquipeId: selEquipe.value, loteEquipeNome: escolhida?.nome || '' }).then(renderAll);
    });
    card.append(h('label', { class: 'wf-field' }, [h('span', {}, 'Equipe'), selEquipe]));

    /**
     * **A FILA DE NÚMEROS, na ordem dele** (pedido dele, 01/10/2026: *"limite de 45 por número;
     * quando chegar em 45 é para trocar por um número seguinte da lista que eu especificar"*).
     *
     * **Era um `<select>` de um número só.** Agora é uma lista: marcar põe o número no fim da
     * fila, e a POSIÇÃO está escrita em cada linha — ordem guardada sem aparecer na tela seria a
     * armadilha de 01/09 do quadro, em que a rodada obedecia uma prioridade que ninguém via.
     */
    const fila = loteLib.filaDeNumeros(cfg);
    const dia = loteLib.diaLocal();
    card.append(h('div', { class: 'wf-sub' }, h('b', {}, `Números (${loteLib.textoDoTeto(teto)} por número, por dia)`)));

    /**
     * **O TETO É DELE** — relato de 02/10/2026: *"a restrição dos contatos deveria ser opcional,
     * bote uma caixa para inserir o número desejado, acabou de me bloquear"*. O 45 era constante,
     * então a recusa não tinha saída nenhuma na tela.
     */
    card.append(
      campoNumero('Máximo de conversas por número, por dia (0 = sem teto)', cfg.tetoPorNumero ?? loteLib.TETO_POR_NUMERO, (v) => {
        /**
         * **`clampInt` NÃO serve aqui, e com min 0 ela seria o defeito**: ela devolve o mínimo
         * para texto sem dígito, então um campo apagado ou um "quarenta" digitado gravariam
         * **0 = sem teto** — a proteção desligada por um escorregão, em silêncio.
         */
        const so = String(v).replace(/[^\d]/g, '');
        const valor = so === '' ? loteLib.TETO_POR_NUMERO : Math.min(5000, parseInt(so, 10));
        salvarAuto({ tetoPorNumero: valor }).then(renderAll);
      }),
      h('div', { class: 'wf-origin' },
        'Vale para os dois caminhos que abrem atendimento — o disparo e o "atender um por um". ' +
          'Chegando no teto, a fila passa para o número seguinte; com 0 não há teto, e aí quem cuida ' +
          'do número é você: o WhatsApp recusa (status RESTRICTED) quando um número estoura o limite ' +
          'de conversas iniciadas em 24h.'),
      /**
       * **O NÚMERO MEDIDO, escrito ao lado do campo que o define** (03/10/2026): *"acabei de mandar
       * 30 mensagens em outro número e foi banido"*. É a medição mais dura que este projeto tem, e
       * ela é sobre o número SECUNDÁRIO — o que menos aguenta, e não o que mais aguenta.
       *
       * Fica aqui, e não só no registro, porque é exatamente aqui que ele escolhe quantas conversas
       * um número vai iniciar hoje. O padrão de 45 foi o número que ELE ditou em 01/10, e passou a
       * estar ACIMA do que derrubou um número de verdade: quem precisa saber disso é quem digita.
       */
      h('div', { class: 'wf-block', 'data-fica': '1' },
        'MEDIDO em 03/10/2026: 30 conversas iniciadas por um número SECUNDÁRIO baniram esse número. ' +
          'Número sem histórico — que só manda e nunca recebe — cai muito antes do que um número com ' +
          'conversa de verdade. Para iniciar conversa com quem nunca falou com você, o caminho que a ' +
          'plataforma fez é a Campanha, com modelo aprovado pela Meta.')
    );
    if (!Number.isFinite(teto)) {
      card.append(h('div', { class: 'wf-block', 'data-fica': '1' },
        'SEM TETO: a fila nunca troca de número por contagem, e nada aqui vai segurar o volume do ' +
          'dia. Foi escolha sua — ponha um número no campo acima para voltar a ter o freio.'));
    }

    for (const c of state.canais) {
      const pos = fila.indexOf(c.id);
      const usados = loteLib.usadosNoDia(state.loteEnvios, c.id, dia);
      const restam = Math.max(0, teto - usados);
      /**
       * **Campo vazio NÃO vira texto na tela.** O print dele de 01/10 mostrava
       * *"status UNDEFINED · qualidade UNDEFINED"*: aqueles dois são da Cloud API e não existem
       * em canal Z-API, e escrever "UNDEFINED" é a tela afirmando que leu algo que não leu.
       */
      const veredito = loteLib.porqueNaoUsarONumero(c);
      const rotulo =
        `${pos >= 0 ? `${pos + 1}º · ` : ''}${c.numero || c.nome}` +
        ` · ${usados}/${loteLib.textoDoTeto(teto)} hoje` +
        (c.saude && c.saude !== 'OK' ? ` · conexão ${c.saude}` : '') +
        (c.status && c.status !== 'CONNECTED' ? ` · ${c.status}` : '') +
        (c.qualidade && c.qualidade !== 'HIGH' ? ` · qualidade ${c.qualidade}` : '') +
        (veredito.barra ? ' · NÃO USO' : '') +
        (pos >= 0 && !restam ? ' · CHEIO hoje' : '');

      const linha = h('div', { class: 'wf-row', 'data-fica': '1' }, [
        checkbox(rotulo, pos >= 0, (marcado) => {
          const nova = fila.filter((id) => id !== c.id);
          if (marcado) nova.push(c.id);
          salvarAuto({
            loteCanais: nova,
            // O campo antigo acompanha o PRIMEIRO da fila: ele é o que a tela guardada mostra
            // quando os números ainda não foram carregados, e o fallback de quem não tem fila.
            loteCanalId: nova[0] || '',
            loteCanalNome: nova[0] ? nomeDoNumero(nova[0]) : '',
          }).then(renderAll);
        }),
      ]);
      /** Subir um número o faz ser usado AGORA: a vez é do primeiro da fila com saldo. */
      if (pos > 0) {
        const subir = h('button', { class: 'wf-btn wf-mini', type: 'button' }, '↑');
        subir.addEventListener('click', () => {
          const nova = [...fila];
          [nova[pos - 1], nova[pos]] = [nova[pos], nova[pos - 1]];
          salvarAuto({
            loteCanais: nova,
            loteCanalId: nova[0] || '',
            loteCanalNome: nova[0] ? nomeDoNumero(nova[0]) : '',
          }).then(renderAll);
        });
        linha.append(subir);
      }
      card.append(linha);
    }
    card.append(h('div', { class: 'wf-origin' },
      'Marque os números na ordem em que quer usá-los: a rodada manda pelo primeiro da fila até ' +
        `ele chegar a ${loteLib.textoDoTeto(teto)} envios no dia, e então passa para o seguinte. ` +
        'A contagem zera na virada do dia, porque o teto que o WhatsApp cobra é o das últimas ' +
        'horas — número queimado para sempre não voltaria a servir amanhã.'));

    if (fila.length) {
      const saldo = loteLib.saldoTotal({ fila, envios: state.loteEnvios, dia, teto });
      card.append(h('div', { class: 'wf-preview', 'data-fica': '1' },
        Number.isFinite(saldo)
          ? `Cabem ${saldo} envio(s) hoje na fila de ${fila.length} numero(s).`
          : `Fila de ${fila.length} numero(s), sem teto por numero.`));
    }

    if (!state.equipes.length || !state.canais.length) {
      card.append(h('div', { class: 'wf-block', 'data-fica': '1' },
        'A conta respondeu sem ' + (!state.canais.length ? 'numero' : 'equipe') +
          ' nenhum. Estas duas rotas nunca foram executadas antes de hoje — me diga o que ' +
          'apareceu aqui para eu conferir o formato.'));
    }

    /**
     * **A saúde do número, escrita ao lado da escolha** — é a medição que ele pagou em 26/09
     * (menos de dez mensagens iguais derrubaram um número). `FLAGGED` é o WhatsApp punindo o
     * PADRÃO de envio; `RESTRICTED` é o teto de conversas iniciadas em 24h, que é exatamente o
     * que esta rodada faz, uma por contato.
     */
    for (const canalId of fila) {
      const canal = state.canais.find((c) => c.id === canalId);
      if (!canal) continue;
      const d = canal.detalhes || {};
      // Sem `typeDetails` o padrão é -1 (SEM janela), que é o que o próprio app faz.
      const janela = loteLib.janelaEmMinutos(canal);
      const quem = canal.numero || canal.nome || canalId;
      const veredito = loteLib.porqueNaoUsarONumero(canal);
      const linhas = [
        // Campo que a plataforma não mandou não vira texto: escrever "?" ou "UNDEFINED" é a tela
        // afirmando que leu algo que não leu.
        [
          `${quem}: ${canal.tipo || 'tipo nao informado'}`,
          canal.saude ? `conexão ${canal.saude}` : '',
          canal.status ? `status ${canal.status}` : '',
          canal.qualidade ? `qualidade ${canal.qualidade}` : '',
        ].filter(Boolean).join(' · '),
        janela === -1 ? '' : `${quem}: canal COM janela de 24h — fora dela a plataforma exige modelo aprovado, e esta rodada não manda modelo.`,
        d.canStartNewSession === false ? `${quem}: este canal NAO abre atendimento novo.` : '',
        /**
         * **O que este número aceita de DISPARO EM MASSA, lido do `typeDetails`** — pedido indireto
         * dele (03/10/2026: *"guardar mensagem para soltar tudo de uma vez é exatamente o que eu
         * queria"*). Quem faz isso de verdade, guardando tudo e soltando sem depender desta aba, é
         * a **Campanha da própria plataforma** (`chat/v1/campaign`), e `canSendCampaign` diz se ela
         * existe neste canal. Custa ZERO requisição: o campo já veio junto com os números.
         *
         * **Campo que a plataforma não mandou não vira texto** (a lição de 01/10): sem o campo, a
         * linha diz que ela não informou, e não "não aceita".
         */
        typeof d.canSendCampaign === 'boolean'
          ? `${quem}: disparo em massa da plataforma (Campanha) — ${d.canSendCampaign ? 'ACEITA' : 'NAO aceita'} neste canal.`
          : `${quem}: a plataforma nao informou se este canal aceita Campanha.`,
        d.mustUseTemplate === true ? `${quem}: fora da janela, so passa modelo aprovado.` : '',
      ].filter(Boolean);
      for (const linha of linhas) card.append(h('div', { class: 'wf-preview', 'data-fica': '1' }, linha));
      if (veredito.barra) {
        card.append(h('div', { class: 'wf-block', 'data-fica': '1' },
          `${quem}: ${veredito.motivo} — a rodada se recusa a usar este número, porque nesses ` +
            'casos a plataforma aceita o envio e a mensagem não chega.'));
      } else if (veredito.aviso) {
        card.append(h('div', { class: 'wf-block', 'data-fica': '1' },
          `${quem}: ${veredito.aviso}. A rodada NÃO barra por isto — a mensagem continua chegando, ` +
            'e mandar em lote sabendo disso é decisão sua.'));
      }
      if (canal.qualidade === 'LOW' || canal.qualidade === 'MEDIUM') {
        card.append(h('div', { class: 'wf-block', 'data-fica': '1' },
          `${quem}: qualidade ${canal.qualidade} pela Meta — a própria plataforma diz para evitar ` +
            'disparo em massa neste número.'));
      }
    }

    return card;
  }

  /**
   * **DISPARAR: os dois percursos, e o que falta em cada um.**
   *
   * **Por ETIQUETA** abre um atendimento novo em cada contato da lista (é o único caminho que
   * alcança quem não tem conversa nenhuma) e **conclui** depois de mandar. **Pela FILA** anda pelos
   * atendimentos que ele filtrou na esquerda e não conclui nada. Nenhum dos dois consulta o quadro.
   */
  /**
   * **AGENDAR O DISPARO: montar agora, sair na hora marcada** — pedido dele (03/10/2026), depois de
   * um teste que não fez o que ele esperava: *"eu achava que ao desligar a internet do celular as
   * mensagens iriam sair somente quando eu ligasse novamente; as mensagens foram iguais pela
   * plataforma, tem a opção de fazer o que eu pretendia?"*.
   *
   * **Por que o teste dele não segurou nada:** o canal é Z-API, um aparelho PAREADO à conta — como o
   * WhatsApp Web. Desde o multi-aparelho, cliente pareado tem conexão própria com o servidor do
   * WhatsApp e manda com o celular sem rede; o celular só precisa aparecer de tempos em tempos para
   * a sessão não expirar. Cortar a internet do celular não tira o número do ar e não enfileira nada.
   *
   * **O que isto NÃO é: uma fila de mensagens guardadas para soltar de uma vez.** Soltar quarenta
   * mensagens iguais no instante da reconexão é exatamente o padrão que derrubou um número dele com
   * menos de dez (26/09). O que fica agendado é a RODADA — ela começa na hora marcada e anda com a
   * mesma pausa e os mesmos freios de sempre.
   *
   * **O agendamento vive NESTA ABA, e isso está escrito na tela.** Não é a plataforma que agenda:
   * quem conta as horas é o painel, dentro da página do mobiliza. F5, fechar o navegador ou derrubar
   * a extensão cancelam. Por isso o keepalive sobe no CLIQUE de agendar e fica tocando a espera
   * inteira — aba escondida é aba CONGELADA (medido: zero disparos de um `setInterval` de 120 ms em
   * mais de um minuto), e sem o áudio o horário passaria sem ninguém acordar.
   */
  const TOLERANCIA_DO_AGENDAMENTO_MS = 10 * 60 * 1000;

  /** A que instante corresponde "14:30": hoje, ou amanhã se a hora já passou. */
  function quandoSeria(hora) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora || '').trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    const alvo = new Date();
    alvo.setHours(h, min, 0, 0);
    // Hora que já passou é amanhã — e o rótulo diz isso, senão "agendado para 08:00" às 09:00
    // parecia um agendamento que nunca vai chegar.
    const amanha = alvo.getTime() <= Date.now();
    if (amanha) alvo.setDate(alvo.getDate() + 1);
    return { quando: alvo.getTime(), rotulo: `${amanha ? 'amanhã' : 'hoje'} às ${m[1].padStart(2, '0')}:${m[2]}` };
  }

  /** Quanto falta, do jeito que se lê num relógio. */
  function faltaPara(quando) {
    const ms = Math.max(0, quando - Date.now());
    const h = Math.floor(ms / 3600000);
    const min = Math.round((ms % 3600000) / 60000);
    return h ? `${h}h${String(min).padStart(2, '0')}` : `${min} min`;
  }

  function cancelarAgendamento(motivo) {
    if (!state.agendado) return;
    state.agendado = null;
    keepalive.desligar();
    setStatus(motivo || 'Agendamento cancelado.');
    renderAll();
  }

  async function agendarDisparo() {
    if (state.agendado) return cancelarAgendamento('Agendamento cancelado — nada vai sair sozinho.');
    if (state.auto.rodando) return setStatus('Já há uma rodada andando. Espere ela terminar.', 'err');

    const alvo = quandoSeria(state.horaDoDisparo);
    if (!alvo) return setStatus('Escolha a hora do disparo (HH:MM).', 'err');

    const cfg = state.auto.cfg;
    const porPerfil = (nome) => perfisLib.chaveDeImagem(nome, perfilAtivo());
    const pares = loteLib.paresProntos({ cfg, imagens: state.imagens, chaveDeImagem: porPerfil });
    if (!pares.length) return setStatus('Escreva o texto de ao menos uma peca antes de agendar.', 'err');
    if (!String(cfg.loteEtiquetaFiltro || '').trim()) {
      return setStatus('Escolha a etiqueta de quem vai receber antes de agendar.', 'err');
    }
    if (!loteLib.filaDeNumeros(cfg).length) {
      return setStatus('Marque ao menos um numero na fila antes de agendar.', 'err');
    }

    /**
     * **As ETIQUETAS são conferidas agora, e o resto na hora.** Nome de etiqueta não muda sozinho, e
     * descobrir às 14:00 que ele está errado queima a janela inteira; o número no ar e o saldo do dia
     * mudam até lá e são conferidos quando a rodada começa, que é onde eles decidem.
     */
    setStatus('Conferindo as etiquetas…');
    const tagFiltro = await tagsLib.resolveTag(String(cfg.loteEtiquetaFiltro || '').trim());
    if (!tagFiltro) return setStatus(`A etiqueta "${cfg.loteEtiquetaFiltro}" nao existe no CRM.`, 'err');
    const nomeEtiquetaLote = String(cfg.etiquetaLote || '').trim();
    if (nomeEtiquetaLote && !(await tagDoEnvioEmLote())) {
      return setStatus(`A etiqueta de recibo "${nomeEtiquetaLote}" nao existe no CRM.`, 'err');
    }
    const puladas = await tagsPuladasDoDisparo();
    if (puladas.faltando.length) return setStatus(recusaDasEtiquetasPuladas(puladas.faltando), 'err');

    if (
      !confirm(
        `Vou disparar ${alvo.rotulo}, sozinho, para os contatos da etiqueta "${tagFiltro.label}".\n\n` +
          `Revezando entre ${pares.length} peca(s), ate ${limiteDaRodada(cfg)} contato(s), com ` +
          `${pausaDaRodada(cfg)}s entre um e outro.\n\n` +
          'NA HORA eu confiro de novo a lista, o numero no ar e o saldo do dia — e comeco sem ' +
          'perguntar nada, porque voce esta confirmando agora.\n\n' +
          'O AGENDAMENTO VIVE NESTA ABA: deixe o navegador aberto e esta aba do mobiliza viva. F5, ' +
          'fechar o navegador ou recarregar a extensao cancelam, e nada sai.\n\n' +
          'Confirma?'
      )
    ) {
      return setStatus('Agendamento cancelado.');
    }

    /**
     * **O keepalive sobe AQUI, no clique** — áudio exige gesto do usuário, e o gesto é este. Sem
     * ele a aba congela assim que ele troca de janela e o horário passa sem nada acontecer. A trava
     * de modo de espera vem junto (`chrome.power`), senão o computador dorme antes da hora.
     */
    const acordada = await keepalive.ligar();
    if (!acordada.ok) {
      return setStatus(`Nao consegui agendar: ${acordada.motivo}`, 'err');
    }
    if (acordada.energia && !acordada.energia.ok) {
      registrarNaRodada(
        'agendamento',
        'pulado',
        `Nao consegui impedir o computador de suspender (${acordada.energia.motivo}). ` +
          'Deixe o modo de espera desligado ate a hora marcada.'
      );
    }

    state.agendado = { quando: alvo.quando, rotulo: alvo.rotulo };
    registrarNaRodada('agendamento', 'info', `disparo agendado para ${alvo.rotulo} (etiqueta "${tagFiltro.label}")`);
    renderAll();
    // Solta a espera FORA do `withBusy` do clique: `withBusy` é um interruptor único, e segurá-lo
    // por horas mataria todo botão do painel (a lição de 20/09). O `catch` existe porque promessa
    // solta que estoura some sem deixar linha nenhuma na tela.
    esperarEDisparar().catch((err) => {
      state.agendado = null;
      keepalive.desligar();
      setStatus(`O agendamento morreu: ${err?.message || err}`, 'err');
      renderAll();
    });
  }

  /**
   * A espera. Fatiada em um segundo para o cancelar valer na hora, e **o atraso é medido no fim**:
   * se a aba congelou mesmo com o áudio, o relógio salta e o salto aparece aqui.
   */
  async function esperarEDisparar() {
    const alvo = state.agendado?.quando;
    if (!alvo) return;
    let ultimoAviso = 0;

    while (state.agendado && Date.now() < alvo) {
      await new Promise((r) => setTimeout(r, 1000));
      if (Date.now() - ultimoAviso > 60000) {
        ultimoAviso = Date.now();
        setStatus(`Disparo agendado para ${state.agendado?.rotulo} — faltam ${faltaPara(alvo)}.`, 'ok');
      }
    }
    if (!state.agendado) return; // ele cancelou

    const atraso = Date.now() - alvo;
    state.agendado = null;
    // O `rodar` liga o keepalive por conta própria; soltar aqui é o que mantém a conta de travas
    // de energia equilibrada — trava esquecida ligada é bateria consumida a noite inteira.
    keepalive.desligar();
    renderAll();

    if (state.auto.rodando) {
      return setStatus('Chegou a hora do disparo e havia uma rodada andando — nao comecei.', 'err');
    }
    /**
     * **Horário que passou há muito tempo NÃO dispara.** Se a aba congelou e o relógio pulou duas
     * horas, começar um disparo em massa sozinho, fora da janela que ele escolheu, é a pior coisa
     * que esta tela pode fazer. Dez minutos de folga cobrem um engasgo; mais que isso, ele aperta.
     */
    if (atraso > TOLERANCIA_DO_AGENDAMENTO_MS) {
      return setStatus(
        `A hora do disparo passou ha ${faltaPara(Date.now() + atraso)} enquanto a aba estava ` +
          'congelada ou parada — NAO comecei sozinho. Aperte "Disparar para a etiqueta" se ainda quiser.',
        'err'
      );
    }

    registrarNaRodada('agendamento', 'info', 'chegou a hora — comecando o disparo');
    await runLoteContatos({ semPerguntar: true });
  }

  function renderCartaoDisparar(cfg) {
    const porPerfil = (nome) => perfisLib.chaveDeImagem(nome, perfilAtivo());
    const pares = loteLib.paresProntos({ cfg, imagens: state.imagens, chaveDeImagem: porPerfil });
    const comArte = loteLib.temArte(pares);
    const limite = limiteDaRodada(cfg);
    const pausaSeg = pausaDaRodada(cfg);

    const card = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Disparar'),
      h('div', { class: 'wf-preview' },
        `Vai até ${limite} contato(s), com ${pausaSeg}s entre um envio e outro — o limite e a pausa ` +
          'são os do cartão de Ritmo acima, os MESMOS das rodadas do fluxo.'),
    ]);

    /**
     * **As travas comuns aos dois caminhos, e a do contrato de imagem só vale com ARTE** — era
     * exigida sempre, então "só mandar texto" ficava bloqueado por um passo de imagem que nada
     * naquele disparo usaria.
     */
    const comuns = [];
    if (!pares.length) comuns.push('Escreva o texto de ao menos uma peça.');
    if (!state.settings.autoSend) comuns.push('Precisa do "Enviar automático" ligado (aba Config).');
    if (comArte && !state.contratoImagem) {
      comuns.push(
        'Alguma peça leva ARTE e falta aprender o envio de imagem (aba Config) — sem isso a arte ' +
          'não sai. Tirando as artes, o disparo de texto funciona sem esse passo.'
      );
    }

    card.append(h('div', { class: 'wf-sub' }, h('b', {}, 'Pelos CONTATOS de uma etiqueta')));
    /**
     * **As travas do caminho por etiqueta são montadas ANTES dos botões**, porque três deles leem a
     * lista (começar, testar e agendar). `const` lido antes da linha que o declara é
     * `ReferenceError` na hora de desenhar — a armadilha de 02/10, e desta vez pela minha mão.
     */
    const travaEtiqueta = [...comuns];
    if (!String(cfg.loteEtiquetaFiltro || '').trim()) {
      travaEtiqueta.push('Escolha a etiqueta de quem vai receber (cartão "Para quem").');
    }
    if (!loteLib.filaDeNumeros(cfg).length) {
      travaEtiqueta.push('Marque ao menos um número na fila: é por ele que o atendimento abre.');
    }

    const comecarPorEtiqueta = h('button', { class: 'wf-btn wf-primary', type: 'button' },
      'Disparar para a etiqueta');
    comecarPorEtiqueta.addEventListener('click', () => withBusy(() => runLoteContatos({})));
    const sonda = h('button', { class: 'wf-btn', type: 'button' }, 'Testar em UM contato');
    sonda.addEventListener('click', () => withBusy(() => runLoteContatos({ sonda: true })));
    card.append(h('div', { class: 'wf-row' }, [comecarPorEtiqueta, sonda]));

    /**
     * **Agendar: montar agora e sair na hora** (03/10/2026). Fica só neste caminho, e não no da
     * fila: lá o percurso é a lista que ELE filtrou na tela da plataforma, e o que estiver filtrado
     * daqui a cinco horas não é o que ele viu ao agendar — agendar uma rodada sobre uma lista que
     * muda sozinha seria prometer o que não dá para cumprir.
     */
    const hora = h('input', { type: 'time', value: state.horaDoDisparo || '' });
    hora.addEventListener('change', () => {
      state.horaDoDisparo = hora.value;
    });
    const agendar = h('button', { class: 'wf-btn', type: 'button' },
      state.agendado ? 'Cancelar o agendamento' : 'Agendar');
    agendar.addEventListener('click', () => withBusy(agendarDisparo));
    agendar.disabled = state.auto.rodando || (!state.agendado && travaEtiqueta.length > 0);
    card.append(h('div', { class: 'wf-row' }, [hora, agendar]));

    if (state.agendado) {
      card.append(h('div', { class: 'wf-block', 'data-fica': '1' },
        `DISPARO AGENDADO para ${state.agendado.rotulo} — faltam ${faltaPara(state.agendado.quando)}. ` +
          'Deixe o navegador aberto e esta aba viva: F5, fechar o navegador ou recarregar a extensão ' +
          'cancelam, e nada sai. O som que mantém a aba acordada está tocando até lá.'));
    } else {
      card.append(h('div', { class: 'wf-origin' },
        'Agendar deixa a rodada pronta e ela começa sozinha na hora marcada, com a mesma pausa e os ' +
          'mesmos freios. Não é guardar mensagem para soltar tudo de uma vez — rajada é o que derruba ' +
          'número. Quem conta as horas é esta aba, não a plataforma: o navegador precisa ficar aberto.'));
    }

    comecarPorEtiqueta.disabled = state.auto.rodando || travaEtiqueta.length > 0;
    sonda.disabled = comecarPorEtiqueta.disabled;
    for (const motivo of travaEtiqueta) card.append(h('div', { class: 'wf-block', 'data-fica': '1' }, motivo));

    card.append(h('div', { class: 'wf-origin' },
      'Cada contato recebe a peça da vez, é marcado com a etiqueta do recibo e o atendimento é ' +
        'CONCLUÍDO — sem concluir, um disparo de 200 deixa 200 atendimentos abertos em "Meus". ' +
        'Mensagem que ficar em fila não é concluída: concluir cancelaria o próprio envio.'));
    card.append(h('div', { class: 'wf-origin' },
      '"Testar em UM contato" manda para o PRIMEIRO da lista e para — a rota que abre atendimento ' +
        'nunca foi executada antes de hoje, e é assim que se prova uma escrita nova neste projeto: ' +
        'uma, conferida, antes das outras.'));

    card.append(h('div', { class: 'wf-sub' }, h('b', {}, 'Pela FILA que você filtrou na esquerda')));
    const comecarPelaFila = h('button', { class: 'wf-btn', type: 'button' }, 'Disparar para a fila');
    comecarPelaFila.addEventListener('click', () => withBusy(runLoteImagem));
    card.append(h('div', { class: 'wf-row' }, [comecarPelaFila]));
    comecarPelaFila.disabled = state.auto.rodando || comuns.length > 0;
    card.append(h('div', { class: 'wf-origin' },
      'Este caminho usa os atendimentos que JÁ existem, do jeito que a fila está filtrada agora na ' +
        'plataforma. Não abre atendimento novo, não conclui nada e não grava campo no CRM — só a ' +
        'etiqueta do recibo. Quem já recebeu qualquer peça é pulado; quem tem etiqueta de sem ' +
        'interesse, de assessor ou da lista de PULAR também.'));

    return card;
  }


  /**
   * Rodada 5: reabrir em lote, sem enviar nada. Ver `processarReabrir`.
   *
   * Fica ANTES do cartão de "reabrir e mandar" de propósito: é o caminho novo, e o de baixo
   * continua existindo só para quando ele quiser o fluxo antigo, tudo num contato só.
   */
  /**
   * **O cartão do modo de SÓ ABRIR** — pedido dele (02/10/2026): *"faça um modo só para abrir o
   * contato e deixar nos meus sem enviar nada e quando concluir abrir o próximo contato"*.
   *
   * **Ele fica no fim da aba Disparo de propósito:** anda pela mesma rota do disparo (a lista por
   * etiqueta + abrir atendimento), e a EQUIPE e a FILA DE NÚMEROS são escolhidas uma vez, no cartão
   * "Por qual número". Dois lugares para escolher o mesmo número é como as duas cópias de qualquer
   * coisa neste projeto divergem — e aqui a divergência seria abrir conversa pelo número do outro
   * candidato.
   *
   * A etiqueta é campo PRÓPRIO: a lista de quem recebe a arte não é a lista de quem ele vai atender
   * à mão, e um campo só obrigaria a redigitar a cada troca de modo.
   */
  function renderCartaoAtender(cfg) {
    const fila = loteLib.filaDeNumeros(cfg);
    const limite = limiteDaRodada(cfg);
    const card = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Atender um por um: só abre, nada sai'),
      h('div', { class: 'wf-preview' },
        'Percorre os CONTATOS de uma etiqueta, abre um atendimento novo em cada um e para ali: o ' +
          'contato fica em "Meus" esperando você. Quando VOCÊ concluir, eu abro o próximo.'),
      h('div', { class: 'wf-origin' },
        'Não manda imagem, não manda texto, não aplica etiqueta, não grava nada no CRM e não ' +
          'conclui. Serve para trabalhar uma lista à mão sem ter que achar cada pessoa na busca — e ' +
          'alcança quem não tem atendimento nenhum, que não aparece em fila alguma da plataforma.'),
    ]);

    card.append(
      campoTexto('Etiqueta dos contatos que você vai atender', cfg.atenderEtiqueta, (v) =>
        salvarAuto({ atenderEtiqueta: v.trim() }).then(renderAll)
      ),
      h('div', { class: 'wf-origin' },
        'Quem tem esta etiqueta entra na lista, MENOS quem está marcado como sem interesse e quem ' +
          'tem alguma das etiquetas da lista de PULAR (cartão "Para quem"). Esta rodada não marca ' +
          'ninguém, então recomeçar amanhã começa a lista do início: quem você já concluiu volta a ' +
          'ser aberto.')
    );

    const comecar = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Abrir e me entregar um por um');
    comecar.addEventListener('click', () => semTravarOPainel('atender', () => runAtenderContatos({})));
    const sonda = h('button', { class: 'wf-btn', type: 'button' }, 'Abrir UM só');
    sonda.addEventListener('click', () => semTravarOPainel('atender', () => runAtenderContatos({ sonda: true })));
    card.append(h('div', { class: 'wf-row' }, [comecar, sonda]));

    const travas = [];
    if (!String(cfg.atenderEtiqueta || '').trim()) travas.push('Escolha a etiqueta dos contatos que você vai atender.');
    if (!fila.length) {
      travas.push('Marque ao menos um número na fila do cartão "Por qual número", acima: é por ele que o atendimento abre.');
    }
    comecar.disabled = state.auto.rodando || !!state.esperando.atender || travas.length > 0;
    sonda.disabled = comecar.disabled;
    for (const motivo of travas) card.append(h('div', { class: 'wf-block', 'data-fica': '1' }, motivo));

    if (fila.length) {
      card.append(h('div', { class: 'wf-preview', 'data-fica': '1' },
        `Abre pelo ${nomeDoNumero(fila[0])} (teto de ${loteLib.textoDoTeto(loteLib.tetoDoCfg(cfg))} conversas por numero, por dia)` +
          (cfg.loteEquipeNome ? `, equipe ${cfg.loteEquipeNome}` : ', sem equipe') +
          ` — a mesma fila e a mesma equipe do cartão acima. Vai até ${limite} contato(s) (o limite do cartão de Ritmo).`));
    }

    card.append(h('div', { class: 'wf-origin' },
      'Abrir a conversa conta no teto do número, junto com o lote de imagem: o que o WhatsApp cobra ' +
        'em 24h são as CONVERSAS INICIADAS, e é isso que abrir faz — a mensagem vindo da sua mão ' +
        'depois não muda a conta.'));
    card.append(h('div', { class: 'wf-origin' },
      '"Abrir UM só" abre o PRIMEIRO da lista e para. A rota que cria atendimento nunca foi ' +
        'executada neste projeto, e a rodada confere, relendo, se ele caiu em "Meus" mesmo — caindo ' +
        'em "Novos" ou com outro operador, ela para no primeiro e diz o que leu.'));
    card.append(h('p', { class: 'wf-hint' },
      'Passando 30 minutos sem você concluir, a rodada para e o contato fica em "Meus" do mesmo ' +
        'jeito — o play do controle flutuante recomeça de onde parou.'));

    return card;
  }

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
        `Vai reabrir até ${limiteDaRodada(cfg)} — o mesmo limite do cartão de ritmo, lá em cima.`)
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
    for (const motivo of trava) card.append(h('div', { class: 'wf-block', 'data-fica': '1' }, motivo));

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
      card.append(h('div', { class: 'wf-preview', 'data-fica': '1' }, modelo.text || '(modelo sem texto)'));
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
    for (const motivo of impedimentos) card.append(h('div', { class: 'wf-block', 'data-fica': '1' }, motivo));
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

  /**
   * **O PISO entre duas contagens — e ele nasceu de uma conta feia** (24/09/2026).
   *
   * Print dele com a rodada parada por limite de requisições em `GET /chat/v6/session`, depois de
   * **222 conclusões no dia**. Medido: com a janelinha aberta, `agendarContagem` dispara a cada
   * conclusão e cada medição custa **DUAS** requisições naquela rota, as duas com
   * `skipCount=false` (a API tem que CONTAR — é a consulta mais cara do painel, e a plataforma
   * pede a dela com `skipCount=true` para não pagá-la). Em 222 contatos isso é ~444 requisições
   * **só para manter um número na tela**, em cima do tráfego da própria rodada.
   *
   * Com o piso, o gatilho por conclusão continua existindo — ele é o que mantém o número fresco
   * quando ele conclui um contato à mão — mas nunca mais de uma vez por meio minuto. O botão
   * "Atualizar" passa por cima (`forcado`): ali quem pediu foi ele.
   */
  const CONTADOR_PISO_MS = 30000;

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

  /**
   * **O controle flutuante da rodada: ⏹ parar e ▶ continuar** — pedido dele (07/09/2026).
   *
   * *"crie um botão popup de parar a automação e continuar... o de parar vermelho e o de continuar
   * verde, simples, com ícone play e stop, mesmo estilo de poder arrastar pela tela; ele deve
   * aparecer sempre que a automação for iniciada"* — e, logo depois: *"atribua o esc para o stop"*.
   *
   * **⏹ ENCERRA a rodada, e ▶ começa de novo** — decisão dele no mesmo dia: *"eu quero que pare
   * totalmente, não pause"*. A primeira versão pausava (e o ▶ retomava de onde estava); com a pausa
   * saiu o estado que ela exigia, e o que sobra é `state.auto.parar`, que já existia e é o mesmo do
   * botão "Parar a rodada" do cartão.
   *
   * **Por isso a janelinha SOBREVIVE ao stop**: acabando sozinha ela some, mas parada por ele fica,
   * porque é aí que o ▶ tem o que fazer.
   *
   * Ela segue o molde do contador (`wf-pergunta` + `wf-contador`): irmã do painel para sobreviver
   * ao `transform` que o esconde, arrastável pelo título, com a posição gravada em `controlePos`.
   */
  let controleDaRodada = null;
  /**
   * Como recomeçar a rodada que ele parou — o ▶ precisa saber por onde ela entrou.
   *
   * Guarda o `runLote*`, e não o `rodar()`, de propósito: os confirms de "Outros" (atendimento de
   * OUTRO operador) e de "Novos" (assumir tira o contato da fila) moram nos `runLote*`, e um ▶ que
   * chamasse `rodar` direto pularia os dois.
   */
  let recomecarRodada = null;

  function abrirControleDaRodada() {
    if (controleDaRodada) {
      controleDaRodada.pintar();
      return;
    }

    const caixa = h('div', { class: 'wf-pergunta wf-contador wf-controle' });
    const fundo = h('div', { class: 'wf-pergunta-fundo' }, [caixa]);
    const barra = h('div', { class: 'wf-pergunta-titulo' }, 'Rodada');
    caixa.append(barra);

    const estado = h('div', { class: 'wf-controle-estado' }, 'Andando…');
    caixa.append(estado);

    /**
     * **Só o ícone, e maior** — pedido dele (07/09/2026): *"os botões só preciso do ícone um pouco
     * maior sem texto"*. O `title` e o `aria-label` carregam o nome: botão sem texto que também
     * não se anuncia é botão que só quem o viu nascer sabe usar.
     */
    const linha = h('div', { class: 'wf-pergunta-botoes wf-controle-botoes' });
    const parar = h(
      'button',
      { class: 'wf-btn wf-controle-parar', type: 'button', title: 'Parar a rodada (Esc)', 'aria-label': 'Parar a rodada' },
      '■'
    );
    const seguir = h(
      'button',
      { class: 'wf-btn wf-controle-seguir', type: 'button', title: 'Começar de novo', 'aria-label': 'Começar de novo' },
      '▶'
    );
    linha.append(parar, seguir);
    caixa.append(linha);

    function pintar() {
      const rodando = !!state.auto.rodando;
      estado.textContent = rodando ? 'Andando…' : 'PARADA';
      estado.classList.toggle('wf-controle-pausada', !rodando);
      parar.disabled = !rodando;
      seguir.disabled = rodando || !recomecarRodada;
    }

    /**
     * **PARAR é encerrar, e foi ele que decidiu** (07/09/2026): *"eu quero que pare totalmente, não
     * pause"*.
     *
     * A primeira versão pausava, para o ▶ poder retomar de onde estava. Ele cortou, e com a pausa
     * saiu o estado novo que ela exigia (`state.auto.pausada`) — o que sobra é `state.auto.parar`,
     * que já existia, é o mesmo do botão "Parar a rodada" do cartão e é lido em cinco pontos do
     * laço, inclusive dentro da espera entre envios. Menos um caminho para a rodada travar.
     *
     * **O ▶ passa a ser "começar de novo"**, pelo mesmo botão por onde ela entrou. A fila é relida
     * do zero — é o que "parar totalmente" significa —, e o contato já tratado não recebe duas
     * vezes: quem impede é `hsm.decidirReenvio`, que pergunta à CONVERSA e vale entre rodadas.
     */
    parar.addEventListener('click', () => {
      if (!state.auto.rodando) return;
      state.auto.parar = true;
      pintar();
      registrarNaRodada('rodada', 'pulado', 'você parou a rodada.');
    });
    seguir.addEventListener('click', () => {
      if (state.auto.rodando || !recomecarRodada) return;
      // Sem acento no nome: `checar-referencias` lê a chamada por expressão regular e um
      // identificador acentuado chega lá partido ("ar()"), virando um falso "sem declaração".
      const iniciar = recomecarRodada;
      iniciar();
    });

    /**
     * **Esc para a rodada, e só enquanto ela anda.**
     *
     * Na BOLHA e conferindo `defaultPrevented` de propósito: os editores da Config e o da resposta
     * escutam Esc na CAPTURA para fechar sem salvar, e a caixa da pergunta já usa Esc como "parar".
     * Quem tratou primeiro marcou o evento — roubar a tecla deles faria Esc fechar um diálogo E
     * parar a rodada com um toque só. Campo de texto continua de fora, pela mesma razão de sempre.
     */
    function aoTeclar(ev) {
      if (ev.key !== 'Escape' || ev.defaultPrevented) return;
      /**
       * **O Esc que a EXTENSÃO dispara não é dele — e era ele que parava a rodada.**
       *
       * Relato dele (07/09/2026), com a print e o log junto: *"mesmo erro, começou e parou sem eu
       * mandar"*, e o Andamento dizia **"você parou a rodada pelo Esc"** numa rodada em que ele não
       * tocou no teclado. A culpa é nossa e está escrita em dois lugares do próprio projeto:
       * `dom.fecharOverlay` e `hsm` **disparam `new KeyboardEvent('keydown', {key:'Escape'})` no
       * document** para fechar menu e diálogo do Material — é assim que a rodada fecha o diálogo do
       * modelo, ou seja, **em toda passada que envia**. Esse evento borbulha, e o atalho o lia como
       * dedo dele.
       *
       * `isTrusted` é a única leitura exata: só evento gerado pelo navegador a partir de teclado de
       * verdade vem `true`; tudo o que sai de `dispatchEvent` vem `false`. Vale também para o Esc
       * que a própria plataforma vier a disparar amanhã.
       *
       * **Atalho que age em evento sintético é atalho que a extensão aperta sozinha.**
       */
      if (!ev.isTrusted) return;
      if (!state.auto.rodando) return;
      if (ehCampoDeTexto(ev.composedPath?.()[0] || ev.target)) return;
      ev.preventDefault();
      state.auto.parar = true;
      pintar();
      registrarNaRodada('rodada', 'pulado', 'você parou a rodada pelo Esc.');
    }
    document.addEventListener('keydown', aoTeclar);

    destinoDaCaixa().append(fundo);
    tornarArrastavel(caixa, barra, 'controlePos');
    pintar();

    controleDaRodada = {
      pintar,
      fechar() {
        document.removeEventListener('keydown', aoTeclar);
        fundo.remove();
        controleDaRodada = null;
      },
    };
  }

  function fecharControleDaRodada() {
    controleDaRodada?.fechar();
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
    /**
     * Quando a última contagem SAIU — marcada antes da resposta, de propósito: a requisição já foi
     * gasta, e insistir na hora é o que piora um limitador de taxa.
     */
    let ultimaMedicao = 0;

    async function medir({ forcado = false } = {}) {
      if (!forcado && Date.now() - ultimaMedicao < CONTADOR_PISO_MS) return;
      ultimaMedicao = Date.now();
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
        carimbo.textContent =
          `Falhou às ${new Date().toLocaleTimeString('pt-BR')}: ` +
          traduzirErroDeRede(err.message, 'O número acima é o da última contagem boa; tento de novo sozinho.');
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

    atualizar.addEventListener('click', () => medir({ forcado: true }));
    fechar.addEventListener('click', encerrar);

    contadorFlutuante = { encerrar, medir };
    tornarArrastavel(caixa, barra, 'contadorPos');
    destinoDaCaixa().append(fundo);
    aplicarPosicao(caixa, state.settings.contadorPos);

    await medir({ forcado: true });
    // `() => medir()` e não `medir`: o `setInterval` passa o id do timer como primeiro argumento,
    // e ele viraria o objeto de opções — com `forcado` indefinido dá no mesmo hoje, mas a próxima
    // opção que nascer aqui seria lida de um número.
    timer = setInterval(() => medir(), CONTADOR_INTERVALO_MS);
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
    if (estado.erro) card.append(h('div', { class: 'wf-block', 'data-fica': '1' }, estado.erro));

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
        card.append(h('div', { class: 'wf-preview', 'data-fica': '1' }, item.texto));
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
  /**
   * `'triado'` entrou em 02/10/2026 com o modo de **só abrir e deixar em "Meus"**: lá também nada é
   * enviado, e sem contar, o limite que ele digita no cartão de Ritmo nunca seria atingido — a
   * rodada andaria até a lista de contatos acabar. É a mesma lição do "só reiniciar", e o mapa já
   * tinha o sinal (`→`) e o veredito (*"assumido(s) para triagem em Meus"*) esperando por ela.
   */
  const CONTA_NO_LIMITE = new Set(['enviado', 'reiniciado', 'triado']);
  let logNode = null;

  /** Só o log é redesenhado durante a rodada: renderAll roubaria o foco dos campos. */
  /**
   * **A linha do Andamento fala da IA?** — pedido dele (08/09/2026): *"os dados com IA no log bote
   * em vermelho"*.
   *
   * O Andamento é uma parede de cinza de 12px, e o que ele procura ali é o que a IA fez e quanto
   * custou. A cor é o que faz isso achável sem ler tudo.
   *
   * **A conferência é `IA` como PALAVRA**, no nome ou no motivo. Fica aqui, num lugar só, e não
   * numa marca em cada chamador: são 31 pontos que registram no log, e vários deles não registram
   * direto — devolvem `{nome, resultado, motivo}` para quem percorre a fila, então a marca teria
   * que atravessar o resultado inteiro. Casar por palavra é o caminho barato E é seguro **porque o
   * texto é nosso**: é código deste arquivo, não resposta que ele edita — a armadilha do "compare
   * pelo invariante" é sobre o texto DELE.
   *
   * A palavra inteira é obrigatória (`\bIA\b` com fronteira de letra, e a flag `u`): sem ela,
   * "família" e "MARIA" pintariam metade do log de vermelho.
   *
   * **O sinal do começo continua sendo quem diz se deu certo** (`✓`, `⚠`, `·`). O vermelho aqui é
   * "isto é da IA", e não "isto falhou" — é a mesma cor do erro, e essa é a única ambiguidade.
   */
  const LINHA_DE_IA = /(^|[^\p{L}])IA([^\p{L}]|$)/u;
  const ehLinhaDeIA = (linha) => LINHA_DE_IA.test(`${linha?.nome || ''} ${linha?.motivo || ''}`);

  function renderAutoLog() {
    if (!logNode || !logNode.isConnected) return;
    logNode.replaceChildren();
    if (!state.auto.log.length) {
      logNode.append(h('p', { class: 'wf-hint' }, 'Nenhuma rodada ainda nesta sessão do painel.'));
      return;
    }
    for (const linha of state.auto.log) {
      const sinal = SINAL_RODADA[linha.resultado] || '·';
      const texto = `${sinal} ${linha.nome}${linha.motivo ? ` — ${linha.motivo}` : ''}`;
      logNode.append(h('div', { class: `wf-preview${ehLinhaDeIA(linha) ? ' wf-log-ia' : ''}` }, texto));
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
  /**
   * **Cada campo para o lugar dele** (25/09/2026): a mensagem do momento, o pedido que vai junto, as
   * artes e o modelo aprovado são do CANDIDATO; o limite da rodada, a pausa, "Automatizar" e as
   * etiquetas são do OPERADOR e continuam sendo uma coisa só.
   *
   * Quem separa é `perfis.gravarAuto`, e ele devolve o `auto` já composto — guardar aqui o objeto
   * que eu mandei faria a tela mostrar o valor do candidato errado até o próximo `load()`.
   */
  async function salvarAuto(mudanca) {
    state.auto.cfg = await perfisLib.gravarAuto(perfilAtivo(), mudanca);
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
  /**
   * `comoSeguir` é o que fazer A SEGUIR, e quem chama decide — a rodada parada pede F5 e um
   * recomeço; a janelinha do contador, que tenta sozinha de novo, não pede nada. Print de
   * 24/09/2026: a contagem falhou e mandou ele dar F5 e "recomeçar com uma pausa maior", conselho
   * de uma rodada que não estava rodando. É a família do aviso que manda procurar o interruptor na
   * aba errada: **mensagem que descreve o sintoma certo e a ação errada custa uma sessão.**
   */
  function traduzirErroDeRede(mensagem, comoSeguir = 'Espere alguns minutos, dê F5 e recomece com uma pausa maior.') {
    if (!ehErroDeRede(mensagem)) return mensagem;
    // A rota vai junto (api.js a põe na frente): é ela que diz de onde vem o excesso.
    const rota = String(mensagem).match(/^([A-Z]+ \/\S+)/)?.[1];
    return (
      'a API parou de responder (provável limite de requisições do servidor)' +
      (rota ? ` em ${rota}` : '') +
      (comoSeguir ? `. ${comoSeguir}` : '.')
    );
  }

  /**
   * **Engasgo de rede, e não defeito** — o que a rodada ESPERA e segue, em vez de parar.
   *
   * O navegador recusando a requisição (`Failed to fetch`, o preflight que o limitador de taxa
   * derruba) e os status de servidor sobrecarregado (429, 502, 503, 504). Todo o resto — 400, 401,
   * 404, erro de tela — continua parando a rodada: aquilo é defeito, e insistir não conserta.
   */
  function ehErroDeRede(mensagem) {
    return api.ehErroDeRede(mensagem);
  }

  /** Quanto a rodada espera a cada engasgo seguido: 30 s, 1 min, 2 min — e na quarta, para. */
  const ESPERAS_DE_REDE_MS = [30000, 60000, 120000];

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
    // Engasgos de rede SEGUIDOS — ver `ESPERAS_DE_REDE_MS`. Zera no primeiro contato que dá certo.
    let falhasDeRede = 0;
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

      /**
       * **Engasgo de rede ESPERA e segue; só três seguidos param a rodada** (22/09/2026, relato dele:
       * *"tenho tido bastante problemas de fetch failed, está parando bastante o automatizado"*).
       *
       * Até aqui todo `Failed to fetch` encerrava a rodada — e o próprio texto que ele lia dizia que
       * a ação certa é ESPERAR, não repetir na hora. Agora a rodada faz isso sozinha: espera
       * (30 s, 1 min, 2 min), confere com uma leitura barata se a plataforma voltou, e segue para o
       * PRÓXIMO contato.
       *
       * **O contato que falhou NÃO é refeito, de propósito**: o erro pode ter vindo depois de a
       * mensagem sair (na gravação, na conclusão), e refazer seria mandar de novo. Ele continua na
       * fila e é pego na próxima rodada, onde a conversa diz o que já saiu.
       */
      if (r.resultado === 'erro' && r.rede) {
        falhasDeRede++;
        if (falhasDeRede > ESPERAS_DE_REDE_MS.length) {
          interrompida = `Parei em ${r.nome}: a plataforma não voltou depois de ${falhasDeRede - 1} esperas. ${r.motivo}`;
          break;
        }
        const espera = ESPERAS_DE_REDE_MS[falhasDeRede - 1];
        registrarNaRodada(
          'rede',
          'pulado',
          `engasgo de rede (${falhasDeRede}º seguido) — espero ${espera / 1000}s e sigo para o próximo; ${r.nome} fica para a próxima rodada`
        );
        setStatus(`Engasgo de rede: esperando ${espera / 1000}s antes de seguir…`);
        const folga = await pausarRodada(espera);
        if (state.auto.parar) break;
        if (folga.congelou) {
          const gelo = await lidarComCongelamento(espera, folga.gasto);
          if (gelo.parar) {
            interrompida = gelo.motivo;
            break;
          }
        }
        posicao++;
        continue;
      }
      if (r.resultado === 'erro') {
        interrompida = `Parei em ${r.nome}: ${r.motivo}`;
        break;
      }
      falhasDeRede = 0;

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

  /**
   * **O PERCURSO do envio em lote: uma lista de CONTATOS, não a fila da plataforma.**
   *
   * Pedido dele (01/10/2026): *"todos os contatos da lista que vou filtrar pela etiqueta, com
   * exceção dos sem interesse, devem receber e ser marcados com a etiqueta colinha"*.
   *
   * **Por que não é a fila:** quem ele quer alcançar pode não ter atendimento aberto nenhum — é
   * contato da base, achado por etiqueta. Então o percurso não abre item de fila: ele **cria** um
   * atendimento por contato (`api.abrirAtendimento`), manda e segue.
   *
   * **Nenhum `load()`**: a decisão não depende da conversa (é ele mandando a mesma coisa), e as
   * etiquetas do contato já vieram no filtro. São ~7 requisições por contato em vez de ~10 — e
   * nesta API o que derruba é número de requisições.
   *
   * O respiro, o congelamento e o engasgo de rede seguem a mesma política de `percorrerFila`: três
   * engasgos seguidos param, um só espera e segue para o próximo.
   */
  async function percorrerContatos({ contatos, limite, pausaMs, processar }) {
    let enviados = 0;
    let interrompida = '';
    let falhasDeRede = 0;
    let visitados = 0;

    for (const contato of contatos) {
      if (enviados >= limite || state.auto.parar) break;
      visitados++;

      const r = await processar(contato);
      registrarNaRodada(r.nome, r.resultado, r.motivo || '');

      if (r.resultado === 'erro' && r.rede) {
        falhasDeRede++;
        if (falhasDeRede > ESPERAS_DE_REDE_MS.length) {
          interrompida = `Parei em ${r.nome}: a plataforma não voltou depois de ${falhasDeRede - 1} esperas. ${r.motivo}`;
          break;
        }
        const espera = ESPERAS_DE_REDE_MS[falhasDeRede - 1];
        registrarNaRodada(
          'rede',
          'pulado',
          `engasgo de rede (${falhasDeRede}º seguido) — espero ${espera / 1000}s e sigo para o próximo`
        );
        const folga = await pausarRodada(espera);
        if (state.auto.parar) break;
        if (folga.congelou) {
          const gelo = await lidarComCongelamento(espera, folga.gasto);
          if (gelo.parar) {
            interrompida = gelo.motivo;
            break;
          }
        }
        continue;
      }
      /**
       * **Erro que NÃO é de rede para a rodada** — a disciplina de sempre. Aqui ela pesa mais: o
       * primeiro contato é a SONDA da rota de abrir atendimento, que nunca foi executada. Falhando
       * nele, ninguém mais é tocado.
       */
      if (r.resultado === 'erro') {
        interrompida = `Parei em ${r.nome}: ${r.motivo}`;
        break;
      }
      falhasDeRede = 0;

      /**
       * **O que conta para o limite é o mesmo conjunto de `percorrerFila`** — e não só `'enviado'`,
       * que era o que estava escrito aqui: o modo de só abrir devolve `'triado'`, e com a conta
       * presa em "enviado" ele percorreria os 200 contatos da lista ignorando o limite dele.
       *
       * **`lastSendAt` continua sendo só de envio de verdade:** ele é o intervalo que protege o
       * número no WhatsApp, e abrir atendimento não manda mensagem nenhuma.
       */
      if (CONTA_NO_LIMITE.has(r.resultado)) enviados++;
      if (r.resultado === 'enviado') state.lastSendAt = Date.now();
      if (r.parar) {
        interrompida = r.motivo;
        break;
      }

      if (enviados >= limite || state.auto.parar) continue;
      // A pausa longa protege o NÚMERO; pulo só precisa do respiro curto do servidor.
      const ms = r.resultado === 'enviado' ? pausaMs : Math.min(pausaMs, PAUSA_PULO_MS);
      if (r.resultado === 'enviado') setStatus(`${enviados}/${limite}. Pausa de ${ms / 1000}s…`);
      const pausa = await pausarRodada(ms);
      if (pausa.congelou) {
        const gelo = await lidarComCongelamento(ms, pausa.gasto);
        if (gelo.parar) {
          interrompida = gelo.motivo;
          break;
        }
      }
    }

    return { enviados, interrompida, visitados, restaram: Math.max(0, contatos.length - visitados) };
  }

  /** O número legível, para a linha do Andamento e para o cartão. */
  function nomeDoNumero(canalId) {
    const achado = (state.canais || []).find((c) => c.id === canalId);
    if (achado) return achado.numero || achado.nome || canalId;
    if (String(state.auto.cfg.loteCanalId || '') === canalId) return state.auto.cfg.loteCanalNome || canalId;
    return canalId;
  }

  /**
   * **O saldo de hoje de cada número da fila** — um lugar só, lido pelo cartão, pela pré-conferência
   * e pela rodada. Três leituras separadas divergiriam na primeira correção.
   */
  async function saldoDosNumerosDoLote() {
    const fila = loteLib.filaDeNumeros(state.auto.cfg);
    const envios = (await store.get('loteEnvios')) || {};
    const dia = loteLib.diaLocal();
    // O teto é DELE (`auto.tetoPorNumero`); 45 é só o padrão, e 0 é "sem teto". Lido aqui, no ponto
    // único que responde "quanto cabe hoje" — três leituras separadas divergiriam na primeira troca.
    const teto = loteLib.tetoDoCfg(state.auto.cfg);
    return { fila, envios, dia, teto, saldo: loteLib.saldoDaFila({ fila, envios, dia, teto }) };
  }

  /**
   * **O CANAL CAÍDO NO LOTE É PERGUNTADO À API, E NÃO À TELA** (relato dele, 01/10/2026: *"caso
   * caia o número preciso que pare o envio, anteriormente ficou enviando"*).
   *
   * **Medido: a barreira do canal caído nunca alcançou esta rodada.** `page.canalForaDoAr` junta
   * duas leituras do DOM — a tarja de desconexão e **o número da conversa ABERTA** — e este lote
   * não abre conversa nenhuma na tela: ele cria o atendimento pela API e manda pela API. Sem
   * conversa aberta não há número para comparar, e o único ponto do painel que chama aquela guarda
   * é o caminho da rodada de fila. **Então o lote não tinha barreira: tinha a ausência dela.**
   *
   * O que serve aqui é `GET /chat/v4/channel/my`, que devolve o `status` de cada canal da conta
   * (`CONNECTED`, `DISCONNECTED`, `BANNED`, `FLAGGED`, `RESTRICTED`) sem depender de tela alguma —
   * e é a mesma leitura que o cartão já faz para mostrar a saúde do número.
   *
   * **Falha ao LER o status não é "o número caiu"**: devolve lista vazia com o aviso no log, como a
   * guarda da tela sempre fez. O limitador de taxa recusa requisição com frequência, e parar a
   * rodada inteira por uma leitura que não voltou é a automação desligada — quem segura o caso de
   * verdade é a conferência da mensagem em FILA, logo abaixo.
   */
  async function numerosForaDoAr(fila) {
    try {
      const canais = await api.canaisDaConta();
      // A tela passa a mostrar o estado novo de graça, já que a leitura foi feita.
      if (Array.isArray(canais) && canais.length) state.canais = canais;
      const fora = [];
      for (const id of fila) {
        const c = (canais || []).find((x) => x.id === id);
        const veredito = loteLib.porqueNaoUsarONumero(c);
        if (veredito.barra) fora.push({ id, status: veredito.motivo });
        else if (veredito.aviso) registrarNaRodada('canal', 'pulado', `${nomeDoNumero(id)}: ${veredito.aviso}`);
      }
      return fora;
    } catch (err) {
      registrarNaRodada('canal', 'pulado', `nao consegui conferir o status do numero: ${err?.message || err}`);
      return [];
    }
  }

  /** Quantos contatos passaram desde a última conferência do canal nesta rodada. */
  let contatosDesdeAConferenciaDoCanal = 0;

  /**
   * **De quantos em quantos contatos o número é reconferido.** O número pode cair no meio da
   * rodada, e a conferência reativa (mensagem em fila) só dispara quando a plataforma devolve
   * `QUEUED` — que é o que ela faz com o canal fora, mas não foi observado ao vivo. Dez é o que
   * limita o estrago a dez mensagens ao custo de uma requisição a cada dez contatos (~1% do que
   * a rodada já gasta).
   */
  const CONTATOS_ENTRE_CONFERENCIAS_DO_CANAL = 10;

  /**
   * **Um contato do envio em lote por etiqueta: abre o atendimento, manda a arte, marca.**
   *
   * A ordem é a que torna o erro recuperável: abrir → mandar → marcar. Falhando ao abrir, nada
   * saiu e nada foi marcado; falhando ao marcar, a arte saiu e a linha do Andamento diz isso (a
   * prioridade de 20/08 — a mensagem é o que o contato recebe).
   */
  async function processarContatoDoLote(contato) {
    const nome = String(contato?.name || contato?.nameWhatsapp || 'sem nome');
    try {
      const porPerfil = (chave) => perfisLib.chaveDeImagem(chave, perfilAtivo());
      const pares = loteLib.paresProntos({
        cfg: state.auto.cfg,
        imagens: state.imagens,
        chaveDeImagem: porPerfil,
      });
      if (!pares.length) return { nome, resultado: 'erro', motivo: 'nenhuma peca com texto — nada a mandar' };

      const tagDoLote = await tagDoEnvioEmLote();
      /**
       * O filtro já pediu ao servidor para EXCLUIR quem tem a etiqueta do lote e quem tem a de sem
       * interesse (`exceptTagsId`). Esta segunda conferência é de graça e pega o que o filtro não
       * pega: a etiqueta aplicada entre o filtro e a vez deste contato, numa lista longa.
       */
      if (tagDoLote && (contato.tagsId || []).includes(tagDoLote.id)) {
        return { nome, resultado: 'pulado', motivo: `já tem a etiqueta "${tagDoLote.label}"` };
      }
      /**
       * **A lista de pular, conferida de novo aqui** — pelo mesmo motivo da linha acima: o filtro
       * já excluiu no servidor, e esta segunda leitura é de graça (a lista de etiquetas é cacheada)
       * e pega o que o filtro não pega — a etiqueta aplicada entre o filtro e a vez deste contato.
       */
      const puladaAqui = (await tagsPuladasDoDisparo()).tags.find((t) =>
        (contato.tagsId || []).includes(t.id)
      );
      if (puladaAqui) {
        return { nome, resultado: 'pulado', motivo: `tem a etiqueta "${puladaAqui.label}", que voce mandou pular` };
      }

      const par = loteLib.parDaVez(pares, state.loteIndice);

      /**
       * **O NÚMERO DA VEZ: o primeiro da fila que ainda não chegou ao teto de hoje** (pedido dele,
       * 01/10/2026: *"limite de 45 por número; quando chegar em 45 é para trocar por um número
       * seguinte da lista"*).
       *
       * **Fila esgotada PARA a rodada, e não é erro:** não há nada a consertar, e o resto da lista
       * continua esperando amanhã — `parar: true` com o motivo, que é o canal que `percorrerContatos`
       * tem para encerrar sem acusar defeito.
       */
      const { fila, dia, teto } = await saldoDosNumerosDoLote();
      const envios = (await store.get('loteEnvios')) || {};
      const numero = loteLib.numeroDaVez({ fila, envios, dia, teto });
      if (!numero) {
        return {
          nome,
          resultado: 'pulado',
          parar: true,
          motivo: fila.length
            ? `todos os ${fila.length} numero(s) da fila chegaram ao teto de ${loteLib.textoDoTeto(teto)} hoje — o resto da lista fica para amanha`
            : 'nenhum numero escolhido para o lote',
        };
      }

      /**
       * **O número continua no ar?** Conferido de dez em dez contatos e sempre que a fila troca de
       * número — sem isso, um número que cai no meio da rodada só é notado pela mensagem em fila.
       */
      contatosDesdeAConferenciaDoCanal++;
      if (contatosDesdeAConferenciaDoCanal >= CONTATOS_ENTRE_CONFERENCIAS_DO_CANAL || numero.usados === 0) {
        contatosDesdeAConferenciaDoCanal = 0;
        const fora = await numerosForaDoAr([numero.canalId]);
        if (fora.length) {
          return {
            nome,
            resultado: 'pulado',
            parar: true,
            motivo:
              `PAREI: o numero ${nomeDoNumero(numero.canalId)} — ${fora[0].status}. ` +
              'Com o numero fora a plataforma ACEITA o envio e a mensagem nao chega — ' +
              'reconecte o numero (ou suba outro na fila) e recomece.',
          };
        }
      }

      const aberto = await api.abrirAtendimento({
        contactId: contato.id,
        departmentId: String(state.auto.cfg.loteEquipeId || '') || null,
        channelId: numero.canalId,
      });
      /**
       * **"Já existe um atendimento" não é defeito** — é o caso que a própria tela da plataforma
       * trata com um botão de abrir o que já existe. Para a rodada é um PULO: mandar numa conversa
       * em andamento é entrar no meio do atendimento de alguém, e este lote não lê conversa para
       * saber onde está pisando.
       */
      if (!aberto.ok) {
        return {
          nome,
          resultado: 'pulado',
          motivo: 'já tem atendimento aberto neste número — não entrei no meio da conversa',
        };
      }

      /**
       * **PEÇA SEM ARTE SAI COMO TEXTO** (02/10/2026: *"preciso que tenha a opção de só mandar
       * texto sem imagem"*). `api.mandarTexto` é a MESMA rota do envio de imagem com `type: 'TEXT'`
       * — e `page.sendText` não serve aqui, porque digita no campo da conversa ABERTA e nesta
       * rodada não há conversa na tela.
       *
       * **O texto vai como está escrito**: este caminho não carrega a conversa, então não há
       * contexto de variável nenhum (ver a recusa em `runLoteContatos`).
       */
      let r = { legendaFoi: true, status: '' };
      if (par.temArte) {
        r = await page.enviarImagem({
          sessionId: aberto.sessionId,
          // Atendimento recém-criado não tem mensagem de onde copiar — e `senderId` é id de
          // correlação por mensagem, não identidade (a correção de 01/10 em `api.js`).
          senderId: api.novoSenderId(),
          chave: par.chave,
          legenda: par.legenda,
        });
      }
      /**
       * A legenda só é dada por entregue quando a plataforma a devolve. Não voltando — ou não
       * havendo arte —, o texto vai pela API na MESMA sessão.
       */
      if (!r.legendaFoi || !par.temArte) {
        const soTexto = await api.mandarTexto({
          sessionId: aberto.sessionId,
          senderId: api.novoSenderId(),
          texto: par.legenda,
        });
        // Sem arte, o status da MENSAGEM DE TEXTO é o que decide se dá para concluir (o `QUEUED`
        // abaixo): concluir em cima de mensagem em fila cancela o próprio envio.
        if (!par.temArte) r = { legendaFoi: true, status: soTexto.status };
      }

      // O ponteiro só anda depois de a mensagem sair de verdade.
      const indices = await store.get('varianteIndex');
      state.loteIndice = (Number(state.loteIndice) || 0) + 1;
      await store.set('varianteIndex', { ...indices, [loteLib.ID_DA_ROTACAO]: state.loteIndice });

      /**
       * **O contador do número anda aqui, pela mesma razão do ponteiro: a mensagem SAIU.** Contar
       * antes queimaria saldo do número por uma falha nossa — e saldo queimado só volta amanhã.
       * Relido do armazenamento agora para não escrever em cima de uma contagem mais nova.
       */
      const antes = (await store.get('loteEnvios')) || {};
      state.loteEnvios = loteLib.somarEnvio(antes, numero.canalId, dia);
      await store.set('loteEnvios', state.loteEnvios);
      const usados = loteLib.usadosNoDia(antes, numero.canalId, dia) + 1;

      /**
       * **MENSAGEM EM FILA: aqui é onde o número caído aparece de verdade.**
       *
       * `QUEUED` tem duas causas e desfechos OPOSTOS, e é por isso que o status do canal é
       * consultado antes de decidir: com o número **no ar** a fila é passageira (a mensagem sai em
       * segundos) e o certo é só não concluir, senão a conclusão CANCELA o próprio envio — a guarda
       * de 01/10. Com o número **fora**, aquela mensagem não vai a lugar nenhum, e seguir a fila é
       * exatamente o *"ficou enviando"* que ele relatou.
       *
       * **E a etiqueta NÃO é aplicada neste caso**, de propósito: ela é o que exclui o contato de
       * todos os lotes futuros (`exceptTagsId`), então marcar quem não recebeu nada o apagaria da
       * lista para sempre — a pior falha possível aqui, silenciosa e com a tela dizendo que deu
       * certo. Sem a marca ele volta na lista de amanhã. O preço, dito na linha: se a mensagem em
       * fila for entregue quando o número voltar, esse contato recebe a arte duas vezes.
       */
      const status = String(r.status || '').toUpperCase();
      if (status === 'QUEUED') {
        const fora = await numerosForaDoAr([numero.canalId]);
        if (fora.length) {
          return {
            nome,
            resultado: 'pulado',
            parar: true,
            motivo:
              `PAREI: a mensagem ficou em FILA e o numero ${nomeDoNumero(numero.canalId)} — ` +
              `${fora[0].status}. NAO marquei a etiqueta — este contato volta na lista. A mensagem ` +
              'em fila pode ser entregue quando o numero voltar: concluir o atendimento na ' +
              'plataforma cancela, deixar aberto entrega.',
          };
        }
      }

      const marca = await marcarEtiquetaDoLote(contato, tagDoLote);
      // A palavra-chave vale também aqui: a legenda é texto que ELE escreveu e que o eleitor leu.
      const marcaPalavra = await etiquetarPorPalavra(contato, par.legenda);

      /**
       * **Concluir o atendimento** — decisão dele (01/10/2026): *"sim tem que concluir"*. Sem isso
       * um lote de 200 envios deixa 200 atendimentos abertos em "Meus", e as outras rodadas
       * passariam a percorrê-los.
       *
       * **A guarda é o status da mensagem, e ela não é teórica:** a própria tela avisa, antes de
       * concluir, que *"uma mensagem está aguardando resposta do contato; se você prosseguir com a
       * conclusão, essas mensagens serão canceladas"*. Pela API não há diálogo nenhum — então
       * mensagem que ficou em FILA não é concluída, porque concluir **cancelaria o próprio envio**
       * e a rodada contaria como enviado. O atendimento fica aberto e a linha diz por quê.
       *
       * **Falha ao concluir não desfaz o envio** (a prioridade de 20/08): a arte saiu e a etiqueta
       * está no contato. O que não pode é ser silenciosa.
       */
      let fecho = '';
      if (status === 'QUEUED') {
        // Chegando aqui, o número está no ar: a fila é passageira e concluir cancelaria o envio.
        fecho = ' — deixei ABERTO: a mensagem ficou em fila, e concluir agora a cancelaria';
      } else {
        try {
          await api.concluirAtendimento(aberto.sessionId);
          fecho = ' + concluido';
        } catch (err) {
          fecho = ` — nao consegui concluir (${err?.message || err}); o atendimento ficou aberto`;
        }
      }

      return {
        nome,
        resultado: 'enviado',
        motivo:
          (par.temArte ? `peca ${par.n} ("${par.arquivo.nome}")` : `peca ${par.n} (so texto)`) +
          // O número e a contagem na linha: sem isso, "trocou de número" é invisível no Andamento.
          ` pelo ${nomeDoNumero(numero.canalId)} (${usados}/${loteLib.textoDoTeto(teto)} hoje)` +
          (!par.temArte ? '' : r.legendaFoi ? ' com a legenda junto' : ' — a legenda foi como mensagem separada') +
          marca +
          marcaPalavra +
          fecho,
      };
    } catch (err) {
      return { nome, resultado: 'erro', motivo: traduzirErroDeRede(err.message), rede: ehErroDeRede(err.message) };
    }
  }

  /**
   * **A RODADA DE SÓ ABRIR: cria o atendimento, deixa em "Meus" e espera VOCÊ concluir** — pedido
   * dele (02/10/2026): *"faça um modo só para abrir o contato e deixar nos meus sem enviar nada e
   * quando concluir abrir o próximo contato, utilizando o mesmo método do envio de imagens"*.
   *
   * **"O mesmo método do envio de imagens" é o percurso por ETIQUETA**: a lista sai de
   * `contact/filter` e cada contato ganha um atendimento novo por `PUT /chat/v1/session`. É a única
   * forma de alcançar quem não tem atendimento nenhum — esse contato não existe em fila nenhuma da
   * plataforma, então não há item para clicar.
   *
   * **O que esta rodada NÃO faz, e é o pedido inteiro:** não manda imagem, não manda texto, não
   * aplica etiqueta, não grava campo no CRM e **não conclui**. O único efeito é o atendimento
   * existir, aberto, com você. Por isso ela é a segunda rodada mais barata do painel: 2 requisições
   * por contato mais uma leitura a cada 30s de espera, contra as ~9 do lote de imagem.
   *
   * **A sessão é RELIDA depois de criada, e isso é a sonda.** `PUT /chat/v1/session` nunca foi
   * executado: que o atendimento criado caia em "Meus" é hipótese lida no bundle, e é a hipótese em
   * que o modo todo se apoia. Caindo em "Novos" (`PENDING`), ou com outro operador, a rodada PARA no
   * primeiro contato com o motivo escrito — um atendimento aberto e nada mais, que é o preço mais
   * barato possível de uma rota nova.
   *
   * **O contador do número ANDA aqui, e é a diferença em relação ao lote de imagem.** Lá ele só
   * anda depois de a mensagem sair; aqui o que é contado é a CONVERSA INICIADA, que já aconteceu —
   * e `RESTRICTED`, o status que a plataforma devolve quando o número estoura o teto de 24h, é
   * literalmente *"atingiu o limite de conversas iniciadas nas últimas 24 horas"*. Abrir é o ato que
   * aquele teto conta, mesmo que a mensagem venha da mão dele depois.
   */
  let primeiroAtendimentoDaRodada = true;

  async function processarContatoParaAtender(contato) {
    const nome = String(contato?.name || contato?.nameWhatsapp || 'sem nome');
    try {
      /**
       * O filtro já pediu ao servidor para excluir quem tem a etiqueta de sem interesse. Esta
       * segunda conferência é de graça e pega o que o filtro não pega: a etiqueta aplicada entre o
       * filtro e a vez deste contato, numa lista longa.
       */
      const tagSemInteresse = await tagDeSemInteresse();
      if (tagSemInteresse && (contato.tagsId || []).includes(tagSemInteresse.id)) {
        return { nome, resultado: 'pulado', motivo: `tem a etiqueta "${tagSemInteresse.label}"` };
      }
      const puladaAqui = (await tagsPuladasDoDisparo()).tags.find((t) =>
        (contato.tagsId || []).includes(t.id)
      );
      if (puladaAqui) {
        return { nome, resultado: 'pulado', motivo: `tem a etiqueta "${puladaAqui.label}", que voce mandou pular` };
      }

      const { fila, dia, teto } = await saldoDosNumerosDoLote();
      const envios = (await store.get('loteEnvios')) || {};
      const numero = loteLib.numeroDaVez({ fila, envios, dia, teto });
      if (!numero) {
        return {
          nome,
          resultado: 'pulado',
          parar: true,
          motivo: fila.length
            ? `todos os ${fila.length} numero(s) da fila chegaram ao teto de ${loteLib.textoDoTeto(teto)} conversas hoje — o resto da lista fica para amanha`
            : 'nenhum numero escolhido na fila do cartao "Por qual numero"',
        };
      }

      /**
       * **O número continua no ar?** Aqui nada é enviado pelo painel, mas é NELE que ele vai
       * escrever à mão daqui a um minuto — e com o número fora a plataforma aceita o texto e a
       * mensagem não chega (a armadilha de 31/08). Abrir vinte atendimentos num número caído é
       * vinte conversas mudas.
       */
      contatosDesdeAConferenciaDoCanal++;
      if (contatosDesdeAConferenciaDoCanal >= CONTATOS_ENTRE_CONFERENCIAS_DO_CANAL || numero.usados === 0) {
        contatosDesdeAConferenciaDoCanal = 0;
        const fora = await numerosForaDoAr([numero.canalId]);
        if (fora.length) {
          return {
            nome,
            resultado: 'pulado',
            parar: true,
            motivo:
              `PAREI: o numero ${nomeDoNumero(numero.canalId)} — ${fora[0].status}. Abrir atendimento ` +
              'nele deixaria voce escrevendo numa conversa que nao chega — reconecte o numero (ou ' +
              'suba outro na fila) e recomece.',
          };
        }
      }

      const aberto = await api.abrirAtendimento({
        contactId: contato.id,
        departmentId: String(state.auto.cfg.loteEquipeId || '') || null,
        channelId: numero.canalId,
      });
      // "Já existe um atendimento" é o caso que a própria tela trata com um botão: a conversa já
      // está em andamento com alguém, e entrar no meio dela não é trabalho desta rodada.
      if (!aberto.ok) {
        return {
          nome,
          resultado: 'pulado',
          motivo: 'já tem atendimento aberto neste número — não entrei no meio da conversa',
        };
      }

      // A conversa foi INICIADA: o teto de 24h do número conta isso, tenha a mensagem saído ou não.
      const antes = (await store.get('loteEnvios')) || {};
      state.loteEnvios = loteLib.somarEnvio(antes, numero.canalId, dia);
      await store.set('loteEnvios', state.loteEnvios);
      const usados = loteLib.usadosNoDia(antes, numero.canalId, dia) + 1;

      /** A SONDA: onde o atendimento recém-criado foi parar. */
      let sessao = null;
      try {
        sessao = await api.getSession(aberto.sessionId);
      } catch (err) {
        return {
          nome,
          resultado: 'pulado',
          parar: true,
          motivo:
            `PAREI: abri o atendimento de ${nome} e nao consegui reler para conferir se ele ficou em ` +
            `"Meus" (${err?.message || err}). O atendimento existe — confira na plataforma antes de seguir.`,
        };
      }
      const meuUserId = await meuUsuario();
      const onde = loteLib.ondeCaiuOAtendimento(sessao, meuUserId);

      /**
       * **As chaves que a rota devolveu, uma vez por rodada.** A FORMA, nunca o conteúdo (a
       * disciplina de 07/09): a sessão carrega telefone e nome de eleitor, e o que serve para saber
       * o que esta rota responde são os nomes dos campos.
       */
      if (primeiroAtendimentoDaRodada) {
        primeiroAtendimentoDaRodada = false;
        registrarNaRodada(
          'sonda',
          'info',
          `o atendimento criado voltou como ${onde.status || 'SEM status'}` +
            (onde.dono ? ' e com dono legivel' : ' e sem dono legivel') +
            `. Campos que a plataforma devolveu: ${loteLib.chavesDaSessao(sessao) || 'nenhum'}.`
        );
      }

      const barra = [
        loteLib.ONDE_PENDENTE,
        loteLib.ONDE_DE_OUTRO,
        loteLib.ONDE_DESCONHECIDO,
        loteLib.ONDE_CONCLUIDO,
      ];
      if (barra.includes(onde.estado)) {
        return {
          nome,
          resultado: 'pulado',
          parar: true,
          motivo:
            `PAREI no primeiro: ${onde.motivo}. Este modo existe para deixar o contato em "Meus", e ` +
            `eu nao consigo prometer isso — o atendimento de ${nome} foi criado e esta na plataforma; ` +
            'nada foi enviado e nada foi marcado.' +
            (onde.estado === loteLib.ONDE_PENDENTE
              ? ' Me diga que caiu em "Novos" e eu faco a rodada assumir antes de entregar a voce.'
              : ''),
        };
      }

      registrarNaRodada(
        nome,
        'info',
        `abri o atendimento pelo ${nomeDoNumero(numero.canalId)} (${usados}/${loteLib.textoDoTeto(teto)} conversas hoje)` +
          (onde.estado === loteLib.ONDE_SEM_DONO ? ` — ${onde.motivo}` : ' — esta em "Meus"') +
          '. Atenda e conclua: eu abro o proximo quando voce concluir.'
      );

      /**
       * **A espera é a mesma de quando a rodada entrega um contato para ele responder à mão**, com
       * duas diferenças: a conversa NÃO está na tela quando a espera começa (o atendimento nasceu
       * pela API), então sair dela não encerra nada; e a conclusão é perguntada à API de 30 em 30
       * segundos, para alcançar quem conclui com a tela noutro lugar.
       */
      const fim = await esperarVoceConcluir(aberto.sessionId, nome, {
        trocaSegue: false,
        perguntarAApi: true,
        meuUserId,
        aviso: `${nome} esta em "Meus", pelo ${nomeDoNumero(numero.canalId)}. Atenda e conclua — eu abro o proximo quando voce concluir.`,
      });

      if (fim.resultado === 'concluido') {
        return { nome, resultado: 'triado', motivo: `abri, voce atendeu e concluiu (${fim.motivo})` };
      }
      if (fim.parar) return { ...fim, resultado: 'pulado' };
      /**
       * Meia hora e o atendimento seguiu aberto: a rodada PARA em vez de abrir o próximo. Abrir
       * mais um por cima de um que ele não terminou é encher "Meus" exatamente do jeito que este
       * modo existe para evitar — e o ▶ do controle recomeça daqui.
       */
      return {
        nome,
        resultado: 'pulado',
        parar: true,
        motivo: `${fim.motivo} — nao abri o proximo: ${nome} continua em "Meus" esperando voce. Conclua e aperte o play.`,
      };
    } catch (err) {
      return { nome, resultado: 'erro', motivo: traduzirErroDeRede(err.message), rede: ehErroDeRede(err.message) };
    }
  }

  /** O seu `userId` na plataforma, para dizer se o atendimento ficou com VOCÊ. Cacheado na `api`. */
  async function meuUsuario() {
    try {
      return String((await api.getAgente())?.userId || '');
    } catch (err) {
      console.warn('[WhatsFill] nao consegui descobrir o seu usuario:', err);
      return '';
    }
  }

  /** A etiqueta de sem interesse, resolvida uma vez. Vazia no campo = ninguém é excluído. */
  async function tagDeSemInteresse() {
    const nome = String(state.auto.cfg.etiquetaSemInteresse || '').trim();
    return nome ? await tagsLib.resolveTag(nome) : null;
  }

  /**
   * **A rodada de só abrir, começando pela etiqueta.**
   *
   * As travas do lote de imagem que NÃO valem aqui: não precisa de par de imagem, não precisa do
   * "Enviar automático" nem do contrato de envio de imagem — nada sai. As que valem são as duas que
   * decidem a lista e o número.
   */
  async function runAtenderContatos({ sonda = false } = {}) {
    const cfg = state.auto.cfg;
    const nomeFiltro = String(cfg.atenderEtiqueta || '').trim();
    if (!nomeFiltro) return setStatus('Escolha a etiqueta dos contatos que voce vai atender.', 'err');
    if (!loteLib.filaDeNumeros(cfg).length) {
      return setStatus(
        'Marque ao menos um numero na fila (cartao "Por qual numero"): e por ele que o atendimento abre.',
        'err'
      );
    }

    contatosDesdeAConferenciaDoCanal = 0;
    primeiroAtendimentoDaRodada = true;
    setStatus('Montando a lista…');

    const tagFiltro = await tagsLib.resolveTag(nomeFiltro);
    if (!tagFiltro) return setStatus(`A etiqueta "${nomeFiltro}" nao existe no CRM. Confira o nome.`, 'err');
    const tagSemInteresse = await tagDeSemInteresse();
    /**
     * **A lista de pular vale aqui também**, e não só no disparo: abrir atendimento para quem ele
     * mandou pular é pôr essa pessoa na frente dele para atender — o mesmo trabalho que a lista
     * existe para evitar. É a aba inteira.
     */
    const puladas = await tagsPuladasDoDisparo();
    if (puladas.faltando.length) return setStatus(recusaDasEtiquetasPuladas(puladas.faltando), 'err');

    let lista;
    try {
      lista = await contatosDoFiltro({
        tagsId: [tagFiltro.id],
        exceptTagsId: [tagSemInteresse?.id, ...puladas.tags.map((t) => t.id)].filter(Boolean),
        quantos: limiteDaRodada(cfg),
      });
    } catch (err) {
      return setStatus(
        `Nao consegui montar a lista: ${traduzirErroDeRede(err.message, 'Tente de novo em instantes.')}`,
        'err'
      );
    }

    const contatos = (lista.itens || []).filter((c) => c?.id);
    if (!contatos.length) {
      return setStatus(
        `Nenhum contato com a etiqueta "${tagFiltro.label}" fora dos marcados como sem interesse.`,
        'ok'
      );
    }

    const { fila, envios, dia, teto, saldo } = await saldoDosNumerosDoLote();
    setStatus('Conferindo os numeros…');
    const fora = await numerosForaDoAr(fila);
    if (fora.length) {
      renderAll();
      return setStatus(
        `Nao comecei: ${fora.map((f) => `${nomeDoNumero(f.id)} — ${f.status}`).join('; ')}. ` +
          'Com o numero fora voce escreveria numa conversa que nao chega — reconecte, ou desmarque ' +
          'esse numero da fila.',
        'err'
      );
    }

    /**
     * **A recusa do teto diz a CONTA de cada numero e onde se troca o teto** — ela foi a que o
     * bloqueou em 02/10, e dizia so "ja iniciaram 45", sem o numero nem onde mexer.
     */
    const vagas = loteLib.saldoTotal({ fila, envios, dia, teto });
    if (!vagas) {
      return setStatus(
        `Nao comecei: ${saldo.map((n) => `${nomeDoNumero(n.canalId)} ja iniciou ${n.usados}`).join('; ')} ` +
          `conversa(s) hoje, e o teto esta em ${loteLib.textoDoTeto(teto)} por numero. Troque o teto no ` +
          'campo "Maximo de conversas por numero, por dia" (0 = sem teto), marque outro numero na ' +
          'fila, ou recomece amanha — a contagem zera na virada do dia.',
        'err'
      );
    }

    const quantos = sonda ? 1 : Math.min(limiteDaRodada(cfg), contatos.length, vagas);

    if (
      !confirm(
        (sonda
          ? 'TESTE: vou abrir o atendimento de UM contato so — o primeiro da lista — e esperar voce concluir.\n\n'
          : `Vou abrir o atendimento de ${quantos} contato(s), UM POR VEZ: abro, ele fica em "Meus", ` +
            'e so abro o proximo quando voce concluir.\n\n') +
          `Etiqueta: "${tagFiltro.label}" (${contatos.length} contato(s) na lista` +
          (lista.total && lista.total > contatos.length ? `, de ${lista.total} no total` : '') +
          ').\n' +
          `Numeros, nesta ordem: ${saldo
            .map((n) => `${nomeDoNumero(n.canalId)} (${loteLib.textoDoTeto(n.restam)} hoje)`)
            .join(' → ')}` +
          (cfg.loteEquipeNome ? ` · equipe ${cfg.loteEquipeNome}` : '') +
          '.\n\n' +
          'NAO envio nada, NAO aplico etiqueta, NAO gravo nada no CRM e NAO concluo: quem escreve e ' +
          'quem conclui e voce, na plataforma.\n' +
          'Abrir a conversa conta no teto do numero (sao as "conversas iniciadas nas ultimas 24h").\n' +
          (tagSemInteresse
            ? `Fora da lista: quem tem a etiqueta "${tagSemInteresse.label}".\n`
            : 'ATENCAO: sem etiqueta de sem interesse configurada, ninguem esta sendo excluido.\n') +
          'Esperando voce, a rodada dura o tempo que voce levar — passando 30 min num contato, ela ' +
          'para e o play recomeca.\n' +
          '\nConfirma?'
      )
    ) {
      return setStatus('Rodada cancelada.');
    }

    // O ▶ do controle flutuante recomeça POR AQUI: os confirms desta rodada moram nesta função.
    recomecarRodada = () => runAtenderContatos({ sonda });
    await rodar({
      telaEDele: true,
      percorrer: ({ limite: teto, pausaMs }) =>
        percorrerContatos({
          contatos,
          limite: sonda ? 1 : teto,
          pausaMs,
          processar: processarContatoParaAtender,
        }),
    });
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

  /**
   * **`percorrer` troca o PERCURSO, não o motor** (01/10/2026, o envio em lote por etiqueta).
   *
   * As cinco rodadas antigas andam pela FILA da plataforma (`percorrerFila` + `openQueueSession`);
   * o envio em lote anda por uma lista de CONTATOS que veio da API, e abre um atendimento novo em
   * cada um. O percurso é legitimamente outro — o resto (keepalive, trava de suspensão, a
   * janelinha de controle, o log, o veredito, o `finally`) é o mesmo, e duplicar isso é como as
   * duas cópias de qualquer coisa neste projeto divergem (*"rodada com motor próprio não herda
   * conserto"*, 03/09).
   */
  async function rodar({ aba, processar, automatico = false, percorrer = null, telaEDele = false }) {
    const limite = limiteDaRodada();
    const pausaMs = pausaDaRodada() * 1000;

    state.auto.automatico = !!automatico;
    // Quem troca de atendimento na tela é ele: o observador da página volta a carregar o contato.
    state.auto.telaEDele = !!telaEDele;
    state.auto.rodando = true;
    state.auto.parar = false;
    state.auto.log = [];
    state.auto.semRegra = new Map();
    state.auto.avisouConfirmacao = false;
    // A sonda da remoção é UMA por rodada, e o aviso de nome que não existe também.
    state.auto.remocao = { sonda: false, avisou: false };
    // Pedido dele: aparece SEMPRE que a automação começa, em qualquer uma das rodadas.
    abrirControleDaRodada();
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

    /**
     * **O candidato logado tem com o que trabalhar?** — 25/09/2026, o mesmo relato do *"não está
     * fazendo nada"*.
     *
     * Desde a v3.123 a mensagem do momento, os modelos e o link do grupo são de cada candidato, e
     * **o candidato novo nasce com tudo vazio, de propósito** (o texto do outro saindo pelo número
     * dele é o defeito que aquela separação existe para impedir). O efeito colateral é este: a
     * rodada percorre a fila inteira sem ter o que mandar, e por fora isso é indistinguível de uma
     * rodada quebrada.
     *
     * Dito ANTES da fila e não depois, porque depois já custou uma fila inteira de aberturas na
     * plataforma — e cada abertura é rede, que é o que derruba a API.
     *
     * **Avisa e SEGUE**: a rodada ainda conclui, reabre e etiqueta sem mandar nada, e barrar aqui
     * transformaria um campo em branco em rodada travada. É a mesma escolha da barreira do canal.
     */
    if (!percorrer && perfilAtivo() !== perfisLib.PERFIL_PADRAO) {
      const faltando = [];
      if (!String(state.auto.cfg.mensagemMomento || '').trim()) faltando.push('a mensagem do momento');
      if (!state.templates.length) faltando.push('as respostas prontas');
      if (!String(state.auto.cfg.templateId || '').trim()) faltando.push('o modelo aprovado da rodada');
      if (faltando.length) {
        registrarNaRodada(
          'rodada',
          'pulado',
          `Você está como ${state.perfil?.nome}, e este candidato ainda está sem ${faltando.join(', sem ')} ` +
            '— o que faltar não sai. Preencha na aba Config/Automatizado com ele logado.'
        );
      }
    }

    /**
     * **Nenhuma das TRÊS fontes de modelo tem nada?** — 25/09/2026, a outra metade de tirar o
     * pré-requisito da tabela "Modelo por conteúdo".
     *
     * A trava antiga barrava a rodada por UMA das três estar vazia, o que é errado. Mas calar por
     * completo trocaria um defeito por outro: com as três vazias nenhum modelo aprovado sai desta
     * rodada, e isso é coisa que ele quer saber ANTES de percorrer a fila.
     *
     * **Avisa e SEGUE**, como a barreira do canal e o aviso do candidato vazio: a rodada continua
     * concluindo, pulando, pedindo o cadastro e chamando a IA — que é 100% do que ela decide,
     * medido em 20.000 contextos.
     */
    // O envio em lote não manda modelo aprovado nenhum: avisar que não há seria alarme falso.
    try {
      if (percorrer) throw { pular: true };
      const temAnuncioComModelo = (await carregarAnuncios(perfilAtivo())).some(
        (a) => a.ligado && a.acao === 'modelo' && String(a.valor || '').trim()
      );
      const temPadrao = (await carregarModelosPadrao(perfilAtivo())).length > 0;
      const temTabela = Object.keys((await lerContentTemplates()) || {}).length > 0;
      if (!temAnuncioComModelo && !temPadrao && !temTabela) {
        registrarNaRodada(
          'rodada',
          'pulado',
          'Nenhum modelo aprovado pode sair nesta rodada: não há anúncio com modelo, nem modelo ' +
            'padrão, nem a tabela "Modelo por conteúdo". O resto do fluxo continua valendo.'
        );
      }
    } catch (err) {
      // Aviso é conveniência: falhar aqui não pode impedir a rodada de rodar.
      if (!err?.pular) {
        registrarNaRodada('rodada', 'pulado', `Não consegui conferir os modelos configurados (${err?.message || err}).`);
      }
    }

    let resultado = { enviados: 0, interrompida: '', visitados: 0, restaram: 0 };
    let aindaTocando = false;
    try {
      resultado = percorrer
        ? await percorrer({ limite, pausaMs })
        : await percorrerFila({ aba, limite, pausaMs, processar });
    } finally {
      // Antes de desligar: se o áudio subiu mas o navegador o pausou no caminho, isso é o dado
      // que distingue "o remédio não foi aplicado" de "o remédio não funciona".
      aindaTocando = keepalive.ativo();
      keepalive.desligar();
      state.auto.rodando = false;
      // Zerado aqui e não onde foi ligado: o `automatico` vale para a rodada, e uma rodada que
      // termina por erro deixaria a próxima andando sozinha sem ninguém ter marcado nada. Vale
      // igual para `telaEDele`: deixá-la ligada faria a próxima rodada carregar o contato duas
      // vezes, que é o defeito que a guarda do observador existe para impedir.
      state.auto.automatico = false;
      state.auto.telaEDele = false;
      /**
       * **A janelinha só FICA quando foi ele que parou** — aí o ▶ tem o que fazer.
       *
       * Acabando sozinha (fila no fim, limite atingido, erro de ambiente), ela some: controle de
       * uma coisa que terminou é botão que mente, e janelinha que nunca sai vira lixo por cima da
       * conversa. No `finally` pelo mesmo motivo do `automatico`: rodada que morre por erro
       * deixaria um ⏹ flutuando para sempre.
       */
      if (state.auto.parar) controleDaRodada?.pintar();
      else fecharControleDaRodada();
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

    /**
     * **POR QUE nada saiu** — 25/09/2026, relato dele: *"iniciei o automatizado mas não está fazendo
     * nada"*, logado como o candidato novo.
     *
     * O veredito contava (*"0 enviado(s), 37 pulado(s)"*) e **não dizia o motivo**, então uma rodada
     * que pulou a fila inteira pela MESMA razão — a barreira do canal, o candidato sem mensagem do
     * momento — parecia uma rodada que funcionou. O motivo existia, uma linha por contato, no
     * Andamento: cem linhas iguais que ninguém lê uma a uma.
     *
     * A conta é do motivo DOMINANTE entre os pulados, e só aparece quando **nada foi enviado**: com
     * envio no meio, pular é o funcionamento normal e a linha viraria alarme que toca sempre.
     */
    const motivoDominante = (() => {
      if (conta('enviado') || conta('concluido')) return '';
      const pulados = state.auto.log.filter((l) => l.resultado === 'pulado' && l.motivo);
      if (pulados.length < 2) return '';
      const porMotivo = new Map();
      for (const l of pulados) {
        // O motivo carrega o nome do candidato e do contato: a CABEÇA dele é o que se repete.
        const chave = String(l.motivo).split(/ — |, /)[0].slice(0, 90);
        porMotivo.set(chave, (porMotivo.get(chave) || 0) + 1);
      }
      const [chave, quantos] = [...porMotivo.entries()].sort((a, b) => b[1] - a[1])[0];
      if (quantos < pulados.length * 0.8) return '';
      return ` NADA foi enviado, e ${quantos} dos ${pulados.length} pulados foi pelo mesmo motivo: ${chave}.`;
    })();

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

    registrarNaRodada('rodada', 'fim', `${resumo}${motivoDominante}${sobra} ${motivo} ${audio}`);

    setStatus(
      `${resumo}${motivoDominante}${sobra} ${motivo}`,
      resultado.interrompida || sobra || motivoDominante ? 'err' : 'ok'
    );

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
    // O ▶ do controle flutuante recomeça POR AQUI, e não por `rodar` direto: os confirms
    // desta rodada moram nesta função, e pular um deles seria decidir no lugar dele.
    recomecarRodada = runLoteEmMeus;
    await rodar({ aba: 'Meus', processar: (sessionId, ctx) => processarSemRetornoEmMeus(sessionId, modelo, ctx) });
  }

  /** Rodada 5: percorre os concluídos e só reabre. Ver `processarReabrir`. */
  async function runLoteReabrir() {
    const limite = limiteDaRodada();

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

    // O ▶ do controle flutuante recomeça POR AQUI, e não por `rodar` direto: os confirms
    // desta rodada moram nesta função, e pular um deles seria decidir no lugar dele.
    recomecarRodada = runLoteReabrir;
    await rodar({ aba: ABA_CONCLUIDOS, processar: processarReabrir });
  }

  async function runLote() {
    const modelo = modeloDaRodada();
    if (!modelo) return setStatus('Escolha o modelo aprovado da rodada.', 'err');
    if (!state.settings.autoSend) {
      return setStatus('Ligue o "Enviar automático" na aba Config antes de rodar.', 'err');
    }

    const limite = limiteDaRodada();
    const pausaSeg = pausaDaRodada();

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
    /**
     * **A tabela "Modelo por conteúdo" DEIXOU DE SER pré-requisito** — 25/09/2026, pergunta dele:
     * *"em Meus está dando esse erro, isso não é um resquício do padrão anterior? agora temos os
     * modelos por anúncio"*. Estava certo, e era resquício mesmo.
     *
     * Quando a trava nasceu, aquela tabela era o ÚNICO jeito de a rodada saber qual modelo mandar.
     * Hoje ela é a TERCEIRA da fila: quem escolhe é `anuncios.modeloDoAnuncio` (o modelo que ele
     * cadastrou no anúncio), depois o modelo padrão com rodízio, e só então a etiqueta de conteúdo.
     *
     * **Medido em 20.000 contextos: sem modelo NENHUM disponível a rodada ainda decide em 100%
     * deles** — só 6 em 20.000 usavam a tecla 1. Ela conclui, pula, pede o cadastro, manda a
     * mensagem do momento e chama a IA sem tocar nessa tabela.
     *
     * **A assimetria já era a prova:** "Novos" e "Outros" nunca tiveram esta trava, e as três
     * rodadas usam o mesmo motor (`processarRespondido`, medido em 06/09).
     *
     * O que apareceu na tela dele foi a v3.123 mordendo: a tabela virou POR CANDIDATO, e a do
     * candidato novo nasce vazia — então o resquício, que dormia desde que o anúncio passou a
     * decidir, passou a barrar a fila inteira.
     *
     * **A informação não se perde: ela desceu para o CONTATO**, onde já existia e é melhor. Sem
     * conteúdo reconhecido a caixa diz o que fazer agora e o que fazer para não repetir (cadastrar
     * o anúncio, ou preencher o modelo padrão) — aviso por contato, em vez de rodada travada.
     */
    if (!state.hsmTemplates.length) {
      return setStatus('Nenhum modelo aprovado carregado. Abra um atendimento e clique em Recarregar.', 'err');
    }

    // O ▶ do controle flutuante recomeça POR AQUI, e não por `rodar` direto: os confirms
    // desta rodada moram nesta função, e pular um deles seria decidir no lugar dele.
    recomecarRodada = runLoteRespondidos;
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
  /**
   * A etiqueta do lote resolvida no CRM, ou nulo quando o campo está vazio.
   *
   * `resolveTag` lê a lista cacheada de etiquetas, então chamar por contato não custa requisição —
   * e devolver o objeto (e não só o nome) é o que permite comparar por ID com o que o contato já
   * tem. **Comparar por rótulo aqui seria a armadilha do rótulo repetido** ("1 Sem Retorno" /
   * "2 Sem Retorno"), e comparar com a lista da caixa da rodada seria a de 31/08: ela é só o que a
   * rodada sugere, nunca o que o contato tem.
   */
  /**
   * **As etiquetas que ELE mandou pular, resolvidas no CRM** — pedido de 02/10/2026.
   *
   * Devolve as achadas E as que faltam, porque as duas metades decidem coisas diferentes: as
   * achadas viram `exceptTagsId` no filtro e conferência por contato; **as que faltam fazem a
   * rodada se RECUSAR a começar**. Nome que não existe no CRM some do `exceptTagsId` em silêncio, e
   * aí quem ele mandou pular recebe — a falha mais cara possível numa lista de exclusão, e a mesma
   * regra que já vale para a etiqueta do recibo (01/10).
   */
  /**
   * **A lista de contatos do disparo, em quantas PÁGINAS forem precisas** (03/10/2026).
   *
   * O filtro traz 200 por requisição, e era daí que vinha o teto de 200 da rodada: pedir 500 não
   * adiantava, porque a lista acabava em 200. Tirado o teto, quem pede mais páginas é isto —
   * **uma requisição a cada 200 contatos**, e só até encher o que ele pediu.
   *
   * As duas saídas do laço são as duas formas de a lista acabar: página incompleta (não há mais) e
   * o `countPages` da própria resposta. O corte em 50 páginas é o último freio contra um laço que
   * não termina — 10.000 contatos é o teto do campo.
   */
  async function contatosDoFiltro({ tagsId, exceptTagsId, quantos }) {
    const itens = [];
    let total = null;
    for (let pagina = 1; itens.length < quantos && pagina <= 50; pagina++) {
      const r = await api.filterContacts({
        tagsId,
        exceptTagsId,
        page: pagina,
        pageSize: CONTATOS_POR_PAGINA,
      });
      total = r.total ?? total;
      const novos = (r.itens || []).filter((c) => c?.id);
      itens.push(...novos);
      if (novos.length < CONTATOS_POR_PAGINA) break;
      if (r.paginas && pagina >= r.paginas) break;
      setStatus(`Montando a lista… ${itens.length} contato(s).`);
    }
    return { itens, total };
  }

  async function tagsPuladasDoDisparo() {
    const nomes = loteLib.nomesPulados(state.auto.cfg.disparoEtiquetasPuladas);
    const tags = [];
    const faltando = [];
    for (const nome of nomes) {
      let tag = null;
      try {
        tag = await tagsLib.resolveTag(nome);
      } catch (_) {
        tag = null;
      }
      if (tag) tags.push(tag);
      else faltando.push(nome);
    }
    return { nomes, tags, faltando };
  }

  /**
   * **As etiquetas da lista de REMOVER, resolvidas no CRM** — pedido dele (14/10/2026): *"crie um
   * espaço no automatizado para remover etiquetas, as etiquetas que eu listar nesse espaço devem
   * ser removidas"*.
   *
   * Mesma forma de `tagsPuladasDoDisparo`, e de propósito: nome EXATO, e o que não existe volta em
   * `faltando` em vez de sumir. A lista de etiquetas é cacheada, então resolver nome por nome não
   * custa requisição depois da primeira.
   */
  async function tagsParaRemover() {
    const nomes = loteLib.nomesDaLista(state.auto.cfg.etiquetasParaRemover);
    const tags = [];
    const faltando = [];
    for (const nome of nomes) {
      let tag = null;
      try {
        tag = await tagsLib.resolveTag(nome);
      } catch (_) {
        tag = null;
      }
      if (tag) tags.push(tag);
      else faltando.push(nome);
    }
    return { nomes, tags, faltando };
  }

  /**
   * **TIRA DO CONTATO ABERTO as etiquetas que ele listou.** Roda uma vez por contato, dentro da
   * rodada, e escreve a própria linha no Andamento.
   *
   * **Vem logo depois do `load()`, antes de TODA saída antecipada** — e essa posição é a coisa mais
   * importante daqui. `processarRespondido` devolve cedo em pelo menos quatro lugares (número
   * removido da conta, a barreira do candidato, contato já tratado nesta rodada, erro de ambiente),
   * e a etiqueta mais provável de ele listar é justamente uma das que fazem a rodada PULAR — a de
   * material pula para sempre. Posta depois da decisão, a lista não funcionaria exatamente nos
   * casos para os quais ele a criou: é o defeito de ontem (*a barreira do candidato pulava o canal
   * removido antes de a opção existir*) com outro nome, e a lição pela quinta vez — **meça a ORDEM,
   * não só o sinal.**
   *
   * **Custa ZERO em quem não tem nenhuma delas:** `lote.etiquetasQueSaem` pergunta antes, e sem
   * nada a tirar nem `applyTags` é chamado.
   *
   * **Nada é reaplicado na mesma passada.** As sugestões (`state.tagSuggestions`) são a lista que
   * `saveClassification` grava no fim; a etiqueta de CIDADE, de COREDE e de conteúdo nascem lá
   * marcadas, então sem desmarcá-las aqui a mesma passada removeria e regravaria a mesma etiqueta —
   * duas escritas, nada mudado e **o Andamento dizendo que removeu**. Log que mente é o defeito que
   * este projeto mais paga para não ter.
   *
   * **Não para a rodada** (a regra de sempre: falha de etiqueta nunca interrompe o que o contato
   * recebe) — com UMA exceção, a sonda abaixo, que é defeito e não engasgo.
   */
  async function removerEtiquetasListadas(nome) {
    const cru = String(state.auto.cfg.etiquetasParaRemover || '').trim();
    if (!cru || !state.contact) return null;

    try {
      const { tags, faltando } = await tagsParaRemover();

      /**
       * **Avisa e SEGUE, ao contrário da lista de PULAR, que recusa a rodada.** Lá o nome errado
       * sai do `exceptTagsId` em silêncio e **alguém RECEBE** um disparo — ato para fora, sem
       * volta. Aqui o nome errado só deixa uma etiqueta onde ela estava: nada é enviado, nada é
       * apagado, e travar a fila inteira por isso seria parar o atendimento por causa de uma
       * faxina. Uma vez por rodada, senão vira alarme que toca em todo contato.
       */
      if (faltando.length && !state.auto.remocao.avisou) {
        state.auto.remocao.avisou = true;
        registrarNaRodada(
          'remover etiquetas',
          'aviso',
          `${faltando.map((n) => `"${n}"`).join(', ')} nao existe(m) no CRM — nao removi nada com ` +
            'esse(s) nome(s). Confira a grafia no cartao "Etiquetas que a rodada REMOVE".'
        );
      }

      const saem = loteLib.etiquetasQueSaem({ tags, tagsDoContato: state.contact.tagsId });
      if (!saem.length) return null;

      const ids = saem.map((t) => t.id);
      const r = await tagsLib.applyTags(state.contact, [], { remover: ids });
      if (!r?.ok) {
        registrarNaRodada(nome, 'aviso', `nao consegui tirar ${saem.map((t) => `"${t.label}"`).join(', ')}: ${r?.error}`);
        return null;
      }

      // O contato em memória e as sugestões param de carregar o que acabou de sair. Sem isto a
      // decisão desta passada ainda veria a etiqueta, e `saveClassification` a regravaria.
      state.contact.tagsId = (state.contact.tagsId || []).filter((id) => !ids.includes(id));
      for (const s of state.tagSuggestions || []) {
        if (s?.tag && ids.includes(s.tag.id)) s.marcada = false;
      }

      /**
       * **A SONDA: o primeiro contato da rodada em que algo saiu é RELIDO.** *A API responde 200 e
       * IGNORA o valor* é a armadilha mais antiga deste projeto, e numa remoção em laço o preço de
       * acreditar no 2xx é a rodada inteira escrevendo no vazio com o log dizendo que removeu.
       *
       * **Uma leitura por rodada, não por contato:** pegar formato que não funciona exige UM
       * exemplo, não auditoria — é a mesma disciplina da aba Cidades, que relê o primeiro gravado
       * de cada lote. O custo é uma requisição por rodada.
       *
       * `ainda-la` PARA a rodada: é defeito, e seguir removeria nada em mais duzentos contatos.
       * `nao-da-para-saber` segue com aviso — não consegui reler NÃO é não removeu.
       */
      if (!state.auto.remocao.sonda) {
        state.auto.remocao.sonda = true;
        let depois = null;
        try {
          const relido = await api.getContact(state.contact.id);
          depois = Array.isArray(relido?.tagsId) ? relido.tagsId : null;
        } catch (err) {
          console.warn('[WhatsFill] nao consegui reler o contato para conferir a remocao:', err.message);
        }
        const veredito = loteLib.etiquetaSaiuMesmo({ ids, tagsDepois: depois });
        /**
         * **O veredito é DEVOLVIDO, nunca escrito em `state.auto.parar`** — aquela bandeira é a do
         * botão "Parar a rodada" dele. Mexer nela aqui faria a linha do Andamento culpar a remoção
         * no instante em que ele mesmo apertasse o botão: log que mente por causa de um sinal
         * compartilhado, e quem decide parar é quem conhece o contato.
         */
        if (veredito.estado === 'ainda-la') {
          return {
            parar: true,
            motivo:
              `${veredito.motivo} ("${saem.map((t) => t.label).join('", "')}") — parei no primeiro ` +
              'contato de proposito, em vez de percorrer a fila inteira escrevendo no vazio',
          };
        }
        if (veredito.estado === 'nao-da-para-saber') {
          registrarNaRodada(nome, 'aviso', `removi ${saem.map((t) => `"${t.label}"`).join(', ')}, mas ${veredito.motivo}`);
          return null;
        }
      }

      registrarNaRodada(nome, 'info', `tirei ${saem.map((t) => `"${t.label}"`).join(', ')} (lista de remover)`);
      return null;
    } catch (err) {
      registrarNaRodada(nome, 'aviso', `nao consegui tirar as etiquetas da lista: ${err?.message || err}`);
      return null;
    }
  }

  /** O recado único da recusa, para as três rodadas não escreverem três textos diferentes. */
  function recusaDasEtiquetasPuladas(faltando) {
    return (
      `A(s) etiqueta(s) ${faltando.map((n) => `"${n}"`).join(', ')} da lista de PULAR nao existe(m) ` +
      'no CRM. Conferi antes de comecar de proposito: nome errado sairia do filtro em silencio e ' +
      'quem voce mandou pular receberia. Corrija o nome no cartao "Para quem" (o botao "Ver as ' +
      'etiquetas do CRM" lista os nomes de verdade).'
    );
  }

  async function tagDoEnvioEmLote() {
    const nome = String(state.auto.cfg.etiquetaLote || '').trim();
    if (!nome) return null;
    try {
      return await tagsLib.resolveTag(nome);
    } catch (_) {
      return null;
    }
  }

  /**
   * **Marca quem recebeu o lote.** Devolve o pedaço que entra na linha do Andamento — nunca lança,
   * porque quem chama acabou de mandar a imagem e não há o que desfazer.
   *
   * **Sem conferência da IA, de propósito.** A regra de 17/09 (*"etiqueta nova que depende de
   * julgamento de texto entra em `TIPOS_DE_ETIQUETA`"*) vale para etiqueta que afirma algo sobre o
   * que a pessoa QUIS dizer — material, sem interesse, pedido. Esta afirma o que NÓS fizemos: a
   * arte saiu para este contato. Não há julgamento a conferir, e pagar uma chamada por contato
   * para confirmar um fato nosso seria dinheiro por nada.
   */
  async function marcarEtiquetaDoLote(alvo, tag) {
    const nome = String(state.auto.cfg.etiquetaLote || '').trim();
    if (!nome) return ' (sem etiqueta configurada — não marquei)';
    if (!tag) return ` (a etiqueta "${nome}" não existe no CRM — não marquei)`;
    if (!alvo?.id) return '';
    if ((alvo.tagsId || []).includes(tag.id)) return '';
    try {
      const r = await tagsLib.applyTags(alvo, [tag.id]);
      return r?.ok ? ` + etiqueta "${tag.label}"` : ` (não consegui aplicar "${tag.label}")`;
    } catch (err) {
      return ` (não consegui aplicar "${tag.label}": ${err?.message || err})`;
    }
  }

  /**
   * **O envio em lote POR ETIQUETA: abre atendimento novo em cada contato e manda a arte.**
   *
   * Pedido dele (01/10/2026): *"teremos que abrir um novo atendimento e abrir a conversa por lá e
   * mandar a colinha que são as imagens... todos os contatos da lista que vou filtrar pela etiqueta
   * com exceção dos sem interesse devem receber e ser marcados com a etiqueta colinha"*.
   *
   * **O "exceto" é do SERVIDOR** (`exceptTagsId`), e isso é o que torna o lote repetível: quem já
   * recebeu carrega a etiqueta do lote e não volta na lista. Rodar de novo continua de onde parou.
   *
   * **`sonda: true` manda para UM e para.** `PUT /chat/v1/session` foi lido no bundle e **nunca
   * executado** — a disciplina deste projeto para escrita nova é uma, conferida, antes das outras
   * (a aba Cidades cria uma etiqueta como sonda; o contrato de escrita observa um envio à mão).
   */
  async function runLoteContatos({ sonda = false, semPerguntar = false } = {}) {
    const cfg = state.auto.cfg;
    const porPerfil = (chave) => perfisLib.chaveDeImagem(chave, perfilAtivo());
    const pares = loteLib.paresProntos({ cfg, imagens: state.imagens, chaveDeImagem: porPerfil });

    if (!pares.length) return setStatus('Escreva o texto de ao menos uma peca (aba Disparo).', 'err');
    if (!state.settings.autoSend) {
      return setStatus('Ligue o "Enviar automatico" na aba Config antes de rodar.', 'err');
    }
    /**
     * **O contrato de imagem só é exigido se alguma peça LEVAR arte** (02/10/2026). Era exigido
     * sempre, então o disparo de texto ficava bloqueado por um passo de imagem que nada naquele
     * disparo usaria.
     */
    if (loteLib.temArte(pares) && !state.contratoImagem) {
      return setStatus('Falta aprender o envio de imagem (aba Config) — sem isso a arte nao sai.', 'err');
    }
    /**
     * **NESTE CAMINHO A VARIÁVEL NÃO É RESOLVIDA, e por isso ele se recusa a começar.**
     *
     * O percurso por etiqueta **não chama `load()`** de propósito (a decisão vale para a lista
     * inteira, e abrir contato é o que derruba a API) — então não há contato carregado de onde
     * tirar a cidade ou o primeiro nome. Mandar o texto como está faria as chaves chegarem
     * literalmente ao eleitor; pior, usar o `state.contact` que estiver aberto mandaria o dado de
     * OUTRA pessoa. **O percurso pela FILA resolve as variáveis normalmente**, porque ali a conversa
     * está carregada.
     */
    const comVariavel = pares.filter((p) => p.legenda.includes('{{')).map((p) => p.n);
    if (comVariavel.length) {
      return setStatus(
        `A peca ${comVariavel.join(', ')} usa variavel entre chaves, e neste caminho nao ha conversa ` +
          'carregada para resolver — o texto sairia com as chaves a mostra. Tire as variaveis, ou ' +
          'use o "Disparar para a fila", que resolve.',
        'err'
      );
    }
    const nomeFiltro = String(cfg.loteEtiquetaFiltro || '').trim();
    if (!nomeFiltro) return setStatus('Escolha a etiqueta de quem vai receber.', 'err');
    if (!loteLib.filaDeNumeros(cfg).length) {
      return setStatus('Marque ao menos um numero na fila do lote.', 'err');
    }

    // Rodada nova zera o relógio da conferência: a pré-conferência abaixo já olha todos os números.
    contatosDesdeAConferenciaDoCanal = 0;
    setStatus('Montando a lista…');

    /**
     * As três etiquetas que decidem a lista. A do lote e a de sem interesse viram `exceptTagsId`;
     * a do filtro é quem entra. **Etiqueta que não existe no CRM é recusa com o motivo**, nunca um
     * filtro que devolve a base inteira por engano.
     */
    const tagFiltro = await tagsLib.resolveTag(nomeFiltro);
    if (!tagFiltro) {
      return setStatus(`A etiqueta "${nomeFiltro}" nao existe no CRM. Confira o nome.`, 'err');
    }
    const tagDoLote = await tagDoEnvioEmLote();
    const nomeEtiquetaLote = String(cfg.etiquetaLote || '').trim();
    if (nomeEtiquetaLote && !tagDoLote) {
      return setStatus(
        `A etiqueta "${nomeEtiquetaLote}" nao existe no CRM. Crie-a la e recomece, ou apague o campo ` +
          'para mandar sem marcar (ai quem ja recebeu volta na lista).',
        'err'
      );
    }
    const nomeSemInteresse = String(cfg.etiquetaSemInteresse || '').trim();
    const tagSemInteresse = nomeSemInteresse ? await tagsLib.resolveTag(nomeSemInteresse) : null;

    // A lista DELE de etiquetas a pular. Nome que não existe no CRM recusa a rodada (ver a função).
    const puladas = await tagsPuladasDoDisparo();
    if (puladas.faltando.length) return setStatus(recusaDasEtiquetasPuladas(puladas.faltando), 'err');

    const excluir = [tagDoLote?.id, tagSemInteresse?.id, ...puladas.tags.map((t) => t.id)].filter(Boolean);
    const limite = limiteDaRodada(cfg);

    let lista;
    try {
      lista = await contatosDoFiltro({
        tagsId: [tagFiltro.id],
        exceptTagsId: excluir,
        quantos: limite,
      });
    } catch (err) {
      return setStatus(`Nao consegui montar a lista: ${traduzirErroDeRede(err.message, 'Tente de novo em instantes.')}`, 'err');
    }

    const contatos = (lista.itens || []).filter((c) => c?.id);
    if (!contatos.length) {
      return setStatus(
        `Nenhum contato com a etiqueta "${tagFiltro.label}"` +
          (excluir.length ? ' que ainda nao tenha recebido e nao esteja marcado como sem interesse.' : '.'),
        'ok'
      );
    }

    /**
     * **A FILA DE NÚMEROS, conferida ANTES de começar** — os dois jeitos de não poder começar são
     * o saldo do dia esgotado e o número fora do ar, e os dois falham para TODOS os contatos: a
     * regra de 01/10 vale aqui (*"etiqueta que não existe no CRM faz a rodada se recusar a começar"*),
     * ao contrário da falha de UM contato, que só pula.
     *
     * **A conferência do canal é por API e acontece aqui** porque a tarja mora no CABEÇALHO, que é
     * a tela que ele esconde durante a rodada — aviso de tela não protege rodada (a lição de 25/09).
     */
    const { fila, envios, dia, teto, saldo } = await saldoDosNumerosDoLote();
    if (!fila.length) return setStatus('Escolha ao menos um numero para o lote.', 'err');

    setStatus('Conferindo os numeros…');
    const fora = await numerosForaDoAr(fila);
    if (fora.length) {
      renderAll();
      return setStatus(
        `Nao comecei: ${fora.map((f) => `${nomeDoNumero(f.id)} — ${f.status}`).join('; ')}. ` +
          'Com o numero fora a plataforma aceita o envio e a mensagem nao chega — reconecte, ou ' +
          'desmarque esse numero da fila.',
        'err'
      );
    }

    const vagas = loteLib.saldoTotal({ fila, envios, dia, teto });
    if (!vagas) {
      return setStatus(
        `Nao comecei: ${saldo.map((n) => `${nomeDoNumero(n.canalId)} ja mandou ${n.usados}`).join('; ')} ` +
          `hoje, e o teto esta em ${loteLib.textoDoTeto(teto)} por numero. Troque o teto no campo ` +
          '"Maximo de conversas por numero, por dia" (0 = sem teto), marque outro numero na fila, ou ' +
          'recomece amanha — a contagem zera na virada do dia.',
        'err'
      );
    }

    const quantos = sonda ? 1 : Math.min(limite, contatos.length, vagas);
    const pausaSeg = pausaDaRodada(cfg);
    const divisao = loteLib.comoVaiRevezar(pares.length, quantos);

    /**
     * **O `confirm` com os números na frente** — esta é a rodada que mais se parece com disparo em
     * massa, e o orçamento medido é pequeno (26/09). O que ele precisa ler antes: quantos, por qual
     * número, com que pausa, e o que acontece com quem não tem a etiqueta ainda.
     */
    /**
     * **`semPerguntar` é o caminho do AGENDAMENTO**, e só dele: ele confirmou tudo na hora de
     * agendar, e um `confirm` esperando clique às 14:00 seria a rodada parada num diálogo com
     * ninguém na frente. As conferências continuam todas — o que se pula é a pergunta.
     */
    if (
      !semPerguntar &&
      !confirm(
        (sonda
          ? 'TESTE: vou abrir atendimento e mandar para UM contato só — o primeiro da lista.\n\n'
          : `Vou abrir um atendimento NOVO e mandar para ${quantos} contato(s), ` +
            `com ${pausaSeg}s entre um e outro.${pausaSeg === 0 ? ' SEM PAUSA: vai o mais rapido que a plataforma deixar — e quando ela recusar por excesso, a rodada espera 30s, 1min e 2min, e tres seguidos param.' : ''}\n\n`) +
          `Etiqueta: "${tagFiltro.label}" (${contatos.length} contato(s) na lista` +
          (lista.total && lista.total > contatos.length ? `, de ${lista.total} no total` : '') +
          ').\n' +
          `Numeros, nesta ordem: ${saldo
            .map((n) => `${nomeDoNumero(n.canalId)} (${loteLib.textoDoTeto(n.restam)} hoje)`)
            .join(' → ')}` +
          (cfg.loteEquipeNome ? ` · equipe ${cfg.loteEquipeNome}` : '') +
          '.\n' +
          `Cada numero manda ate ${loteLib.textoDoTeto(teto)} por dia; chegando no teto, passo para o seguinte.\n` +
          (quantos < Math.min(limite, contatos.length)
            ? `Hoje cabem ${vagas} envio(s) na fila, menos que os ${Math.min(limite, contatos.length)} ` +
              'que a lista e o limite permitiriam — o resto fica para amanha.\n'
            : '') +
          (sonda
            ? ''
            : `Revezando: ${divisao
                .map((q, i) => `${q} com a peca ${pares[i].n}${pares[i].temArte ? ' (arte + texto)' : ' (so texto)'}`)
                .join(', ')}.\n`) +
          '\n' +
          (excluir.length
            ? 'Fora da lista: quem ja tem a etiqueta do lote, quem esta marcado como sem interesse' +
              (puladas.tags.length ? `, e quem tem ${puladas.tags.map((t) => `"${t.label}"`).join(', ')}` : '') +
              '.\n'
            : 'ATENCAO: sem etiqueta de lote nem de sem interesse configuradas, ninguem esta sendo excluido.\n') +
          (nomeEtiquetaLote ? `Cada um que receber e marcado com "${nomeEtiquetaLote}".\n` : '') +
          'O atendimento e CONCLUIDO depois de mandar.\n' +
          '\nConfirma?'
      )
    ) {
      return setStatus('Envio em lote cancelado.');
    }

    // O ▶ do controle flutuante recomeça POR AQUI: os confirms desta rodada moram nesta função.
    recomecarRodada = () => runLoteContatos({ sonda });
    await rodar({
      percorrer: ({ limite: teto, pausaMs }) =>
        percorrerContatos({
          contatos,
          limite: sonda ? 1 : teto,
          pausaMs,
          processar: processarContatoDoLote,
        }),
    });
  }

  /**
   * **A rodada do ENVIO EM LOTE** — pedido dele (01/10/2026): *"preciso enviar uma imagem e um texto
   * especifico fora do fluxo, simplesmente vou mandar para os contatos"*.
   *
   * **O `confirm` diz os números na frente** porque esta é a rodada que mais se parece com disparo
   * em massa, e o orçamento medido é pequeno: menos de dez mensagens iguais em sequência já
   * derrubaram um número dele (26/09). O que ele precisa ler antes de começar é quantos vão, com
   * que pausa e quantos cada par pega.
   */
  async function runLoteImagem() {
    const porPerfil = (nome) => perfisLib.chaveDeImagem(nome, perfilAtivo());
    const pares = loteLib.paresProntos({
      cfg: state.auto.cfg,
      imagens: state.imagens,
      chaveDeImagem: porPerfil,
    });
    if (!pares.length) return setStatus('Escreva o texto de ao menos uma peca (aba Disparo).', 'err');
    if (!state.settings.autoSend) {
      return setStatus('Ligue o "Enviar automatico" na aba Config antes de rodar.', 'err');
    }
    // O contrato de imagem só é exigido se alguma peça levar arte (02/10/2026).
    if (loteLib.temArte(pares) && !state.contratoImagem) {
      return setStatus('Falta aprender o envio de imagem (aba Config) — sem isso a arte nao sai.', 'err');
    }

    const limite = limiteDaRodada();
    const pausaSeg = pausaDaRodada();
    const divisao = loteLib.comoVaiRevezar(pares.length, limite);

    if (
      !confirm(
        `Vou mandar para até ${limite} contato(s) da lista que você filtrou, com ` +
          `${pausaSeg}s entre um e outro.${pausaSeg === 0 ? ' SEM PAUSA: vai o mais rapido que a plataforma deixar — e quando ela recusar por excesso, a rodada espera 30s, 1min e 2min, e tres seguidos param.' : ''}\n\n` +
          `Revezando entre ${pares.length} peca(s): ` +
          divisao
            .map((q, i) => `${q} com a peca ${pares[i].n}${pares[i].temArte ? ' (arte + texto)' : ' (so texto)'}`)
            .join(', ') +
          '.\n\n' +
          'Nao consulta o fluxo, nao conclui o atendimento e nao grava nada no CRM. Quem ja ' +
          'recebeu qualquer um dos pares é pulado, e quem tem etiqueta de sem interesse ou de ' +
          'assessor também.\n\n' +
          'Confira que a lista da esquerda é a que você quer percorrer. Confirma?'
      )
    ) {
      return setStatus('Envio em lote cancelado.');
    }

    /**
     * **A etiqueta é conferida UMA vez, antes da fila** — e aqui ela BARRA, ao contrário da regra
     * de 20/08 (*"falha de etiqueta nunca bloqueia o envio da mensagem"*), que vale para a falha
     * de UM contato no meio da rodada.
     *
     * A diferença é o alcance: etiqueta que não existe no CRM falha para TODOS, e ele pediu a
     * marca justamente para achar essa gente depois. Quarenta artes enviadas sem marca nenhuma é o
     * trabalho que não dá para refazer — e conferir antes custa zero requisição (a lista de
     * etiquetas é cacheada). As duas saídas estão escritas no aviso.
     */
    /**
     * **A lista de pular é conferida ANTES da fila**, como a etiqueta do recibo: nome errado sai da
     * guarda em silêncio e quem ele mandou pular recebe — e aqui não há `exceptTagsId` nenhum
     * segurando, porque o percurso é a fila da plataforma.
     */
    const puladas = await tagsPuladasDoDisparo();
    if (puladas.faltando.length) return setStatus(recusaDasEtiquetasPuladas(puladas.faltando), 'err');

    const nomeDaEtiqueta = String(state.auto.cfg.etiquetaLote || '').trim();
    if (nomeDaEtiqueta) {
      const tag = await tagsLib.resolveTag(nomeDaEtiqueta);
      if (!tag) {
        return setStatus(
          `A etiqueta "${nomeDaEtiqueta}" não existe no CRM. Crie-a lá e recomece, ou apague o campo ` +
            'para mandar sem marcar (aí quem volta noutro dia recebe de novo).',
          'err'
        );
      }
    }

    // O ▶ do controle flutuante recomeça POR AQUI: o confirm desta rodada mora nesta função.
    recomecarRodada = runLoteImagem;
    await rodar({ aba: null, processar: processarLote });
  }

  /**
   * **Um contato do envio em lote: manda a arte com a legenda e segue.**
   *
   * Fora do quadro de propósito — não há o que responder. O que NÃO é dispensável e continua aqui:
   *
   *  - **a barreira do canal**, igual à de `processarRespondido`: mandar o material de um candidato
   *    pelo número do outro é o defeito que ela existe para impedir;
   *  - **a etiqueta que só conclui** (sem interesse, assessor): material de campanha para quem
   *    pediu para não ser mais chamado é a etiqueta permanente do CRM virando dano;
   *  - **quem já recebeu QUALQUER par**, pela conversa e nunca pelo registro de envios.
   *
   * **Não conclui e não escreve nada no CRM** (a decisão dele de 31/08 sobre o pulo), então o
   * atendimento continua na lista: `continuaNaFila: true` é o que faz a posição andar. Sem isso o
   * laço reabriria o mesmo contato, e abertura é o que derruba a API.
   */
  async function processarLote(sessionId, ctx) {
    let nome = 'contato';
    try {
      await load(sessionId);
      if (!state.contact) return { nome, resultado: 'erro', motivo: 'nao consegui carregar o contato' };
      nome = state.contact.name || state.contact.nameWhatsapp || 'sem nome';

      const canal = state.canalDoAtendimento || { estado: 'quieto' };
      if (canal.estado === 'outro' && canal.dono) {
        return {
          nome,
          resultado: 'pulado',
          motivo:
            `este atendimento é do número de ${canal.dono.nome} e você está como ` +
            `${state.perfil?.nome || 'o candidato de sempre'} — nao mandei para nao sair a arte do candidato errado`,
        };
      }
      if (canal.estado === 'desconhecido') {
        return {
          nome,
          resultado: 'pulado',
          motivo: 'o número deste atendimento nao está em nenhum candidato da Config — nao mandei nada',
        };
      }

      const soConclui = await etiquetaQueSoConclui();
      if (soConclui) {
        return { nome, resultado: 'pulado', motivo: `tem a etiqueta "${soConclui}" — nao recebe material` };
      }

      const porPerfil = (chave) => perfisLib.chaveDeImagem(chave, perfilAtivo());
      const pares = loteLib.paresProntos({
        cfg: state.auto.cfg,
        imagens: state.imagens,
        chaveDeImagem: porPerfil,
      });
      if (!pares.length) {
        return { nome, resultado: 'erro', motivo: 'nenhuma peca com texto — nada a mandar' };
      }

      const tagDoLote = await tagDoEnvioEmLote();
      const naoMandar = loteLib.porqueNaoMandar({
        pares,
        nossas: state.nossas,
        tagsDoContato: state.contact.tagsId || [],
        tagDoLote,
        tagsPuladas: (await tagsPuladasDoDisparo()).tags,
      });
      if (naoMandar) return { nome, resultado: 'pulado', motivo: naoMandar };

      const par = loteLib.parDaVez(pares, state.loteIndice);
      const rendido = vars.render(par.legenda, await currentVarContext());
      if (rendido.missing.length) {
        return {
          nome,
          resultado: 'pulado',
          motivo: `o texto da peca ${par.n} usa ${rendido.missing.join(', ')} e este contato nao tem`,
        };
      }

      /**
       * **Peça sem arte sai como TEXTO** (02/10/2026). Aqui a conversa está na tela, então o texto
       * vai por `page.sendText` — o mesmo caminho que a plataforma renderiza igual ao que uma
       * pessoa faria.
       */
      let r = { legendaFoi: true };
      if (par.temArte) {
        r = await page.enviarImagem({
          sessionId,
          senderId: state.senderId,
          chave: par.chave,
          legenda: rendido.text,
        });
      }
      // A legenda só é dada por entregue quando a plataforma a devolve. Nao voltando — ou nao
      // havendo arte —, o texto sai do jeito de sempre: o pior caso é o contato receber duas
      // mensagens, nunca uma imagem muda.
      if (!r.legendaFoi || !par.temArte) await page.sendText(rendido.text);
      state.lastSendAt = Date.now();

      /**
       * **O ponteiro só anda DEPOIS de a mensagem sair** — mesma disciplina de
       * `templates.avancarVariante`. Queimar a rotação num envio que falhou faria o par seguinte
       * pular sozinho, e o par que ninguém recebeu seria dado por entregue.
       */
      const indices = await store.get('varianteIndex');
      state.loteIndice = (Number(state.loteIndice) || 0) + 1;
      await store.set('varianteIndex', { ...indices, [loteLib.ID_DA_ROTACAO]: state.loteIndice });

      /**
       * **A marca vem DEPOIS do envio, e falhar aqui não desfaz nada** — a prioridade de 20/08:
       * etiqueta é organização interna, a mensagem é o que o contato recebe. O que não pode é a
       * falha ser silenciosa, então ela vai para a linha do Andamento junto do envio.
       */
      const marca = await marcarEtiquetaDoLote(state.contact, tagDoLote);

      registrarNaRodada(
        nome,
        'enviado',
        (par.temArte ? `peca ${par.n} ("${par.arquivo.nome}")` : `peca ${par.n} (so texto)`) +
          (!par.temArte ? '' : r.legendaFoi ? ' com a legenda junto' : ' — a legenda foi como mensagem separada') +
          marca
      );
      return { nome, resultado: 'enviado', continuaNaFila: true };
    } catch (err) {
      return { nome, resultado: 'erro', motivo: traduzirErroDeRede(err.message), rede: ehErroDeRede(err.message) };
    }
  }

  async function runLoteOutros() {
    if (!state.settings.autoSend) {
      return setStatus('Ligue o "Enviar automático" na aba Config antes de rodar.', 'err');
    }
    /**
     * **A caixa "Automatizar a rodada" vale AQUI TAMBÉM, e o aviso não dizia.**
     *
     * `rodadaAutomatica()` lê `cfg.automatizarComIA` sem olhar em qual fila a rodada está — o que
     * é o desenho certo (a caixa fica no mesmo cartão dos dois botões), mas o `confirm` dos Novos
     * diz *"AUTOMÁTICO LIGADO: sai SEM eu perguntar"* e este não dizia nada. E aqui é mais grave
     * que lá: **o atendimento é de outro operador**, e concluir sozinho fecha o trabalho de alguém.
     *
     * Mesma disciplina do rótulo da caixa (02/09/2026): interruptor que faz duas coisas tem que
     * dizer as duas — e aviso que descreve metade do que vai acontecer manda procurar no lugar
     * errado justamente quando ele for investigar um envio que não entendeu.
     */
    const sozinha = rodadaAutomatica();
    if (
      !confirm(
        'A aba "Outros" são atendimentos em andamento com OUTRO operador.\n\n' +
          'Concluir ali fecha o atendimento de um colega.\n\n' +
          (sozinha
            ? 'ATENÇÃO: "Automatizar a rodada" está MARCADA — a mensagem que o fluxo escolher sai ' +
              'SEM eu perguntar, e o atendimento do colega é concluído sozinho. Cada envio fica ' +
              'no log do Andamento.\n\n'
            : 'Você decide contato a contato.\n\n') +
          'Confirma?'
      )
    ) {
      return setStatus('Rodada cancelada.');
    }

    // O ▶ do controle flutuante recomeça POR AQUI, e não por `rodar` direto: os confirms
    // desta rodada moram nesta função, e pular um deles seria decidir no lugar dele.
    recomecarRodada = runLoteOutros;
    await rodar({ aba: 'Outros', processar: processarRespondido });
  }

  async function runLoteNovos() {
    if (!state.settings.autoSend) {
      return setStatus('Ligue o "Enviar automático" na aba Config antes de rodar.', 'err');
    }
    if (!state.hsmTemplates.length) {
      return setStatus('Nenhum modelo aprovado carregado. Abra um atendimento e clique em Recarregar.', 'err');
    }

    const limite = limiteDaRodada();
    const pausaSeg = pausaDaRodada();

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

    // O ▶ do controle flutuante recomeça POR AQUI, e não por `rodar` direto: os confirms
    // desta rodada moram nesta função, e pular um deles seria decidir no lugar dele.
    recomecarRodada = runLoteNovos;
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
      return { nome: 'contato', resultado: 'erro', motivo: traduzirErroDeRede(err.message), rede: ehErroDeRede(err.message) };
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

      /**
       * **AS ETIQUETAS QUE ELE MANDOU REMOVER SAEM AQUI, antes de qualquer outra coisa.**
       *
       * A posição é a regra: abaixo deste ponto a função devolve cedo em quatro lugares, e a
       * etiqueta mais provável de estar na lista dele é justo uma das que fazem a rodada pular.
       * Ver o comentário de `removerEtiquetasListadas`.
       *
       * **E a etiqueta sai antes de a rodada DECIDIR, de propósito e com um preço:** listando a
       * etiqueta de sem interesse ou a de assessor, ela deixa de proteger nesta mesma passada — o
       * contato passa a receber o que a etiqueta impedia. Está escrito no cartão.
       */
      const falhouARemocao = await removerEtiquetasListadas(nome);
      if (falhouARemocao) {
        return { nome, resultado: 'pulado', parar: true, motivo: falhouARemocao.motivo };
      }

      /**
       * **O NÚMERO DESTE ATENDIMENTO FOI REMOVIDO DA CONTA** — pedido dele (14/10/2026):
       * *"adicione a opção de concluir no automatizado quando o canal estiver removido"*.
       *
       * **Vem ANTES da tarja de propósito.** A tarja diz *"desconectado"*, e número removido pode
       * não gerar tarja nenhuma — a rodada seguiria em frente e tentaria enviar por um canal que
       * não existe. Quem responde isto é a API, não a tela.
       *
       * **E vem ANTES DA BARREIRA DO CANDIDATO, que é o que fazia a opção não funcionar** (print
       * dele, 14/10/2026: *"não está concluindo"*, com a plataforma marcando **"Canal removido"** e
       * dizendo *"no canal null"*). Número removido da conta **não está em candidato nenhum por
       * definição** — então a barreira de 25/09 o classificava como `desconhecido` e **pulava antes
       * de este bloco rodar**. A opção existia e nunca era alcançada.
       *
       * A barreira continua certa para o que ela foi escrita: número que existe e é de OUTRO
       * candidato, ou que ele ainda não cadastrou. **Removido não é cadastro faltando — é número
       * que não existe mais**, e mandá-lo para o cadastro é mandar arrumar o que não tem conserto.
       *
       * **E é outro desfecho, não outra mensagem.** Desconectado volta, então pular e esperar é o
       * certo; removido não volta, e pular deixa o atendimento aberto na fila **para sempre**.
       *
       * **Concluir é a sugestão em destaque, e mesmo assim não acontece sozinho** sem a caixa
       * "Concluir sozinho…" marcada: `primaria` aqui é só realce de tecla — quem decide sem
       * perguntar é o `concluirSozinho` abaixo, e ele nasce desligado porque concluir escreve no
       * CRM e tira a pessoa da fila.
       */
      const canalRemovido = await canalDesteAtendimentoRemovido();
      if (canalRemovido) {
        const concluirSozinho = !!state.auto.cfg.concluirCanalRemovido && rodadaAutomatica();
        const escolhaRemovido = concluirSozinho
          ? 'concluir'
          : await perguntarNaRodada({
              titulo: nome,
              linhas: [
                '⚠ O NÚMERO DESTE ATENDIMENTO FOI REMOVIDO DA CONTA. Não é queda passageira: não ' +
                  'há por onde mandar nada, e pular deixa este atendimento aberto na fila para sempre.',
              ],
              pergunta: 'O número deste atendimento não existe mais. O que fazer?',
              opcoes: [
                { tecla: '1', valor: 'concluir', rotulo: 'Concluir sem enviar nada', primaria: true },
                { tecla: '2', valor: 'pular', rotulo: 'Pular (deixa aberto)' },
                { tecla: '3', valor: 'parar', rotulo: 'Parar a rodada' },
              ],
            });

        if (escolhaRemovido === 'concluir') {
          await saveClassification({ withCompletionDate: true, quiet: true });
          const fechouRemovido = await concluirPeloPainel();
          if (!fechouRemovido.ok) {
            return { nome, resultado: 'pulado', motivo: `número removido, mas ${fechouRemovido.reason}` };
          }
          if (fechouRemovido.dialogOpen) {
            return {
              nome,
              resultado: 'concluido',
              parar: true,
              motivo: 'número removido; a plataforma pediu um motivo de conclusão — responda o diálogo',
            };
          }
          return {
            nome,
            resultado: 'concluido',
            motivo: `concluí sem enviar nada: ${canalRemovido.motivo}`,
          };
        }

        return {
          nome,
          resultado: 'pulado',
          parar: escolhaRemovido !== 'pular',
          motivo: `${canalRemovido.motivo} — nada enviado, atendimento continua aberto`,
        };
      }

      /**
       * **A BARREIRA DO CANAL** — relato dele (25/09/2026): *"eu só adicionei os dois números do
       * Martim, não adicionei o número do Felipe Pedri ainda na extensão; não devia ter uma
       * barreira caso o número não esteja na extensão?"*.
       *
       * Antes disto o painel avisava na tarja e mais nada — e a tarja **mora no cabeçalho**, que
       * ele esconde justamente durante a rodada (*"preciso de espaço na área de trabalho"*, 31/08).
       * Ou seja: o aviso ficava atrás da única tela que ele não está olhando.
       *
       * **Pular, e não parar a rodada:** parar num contato transforma um número faltando na Config
       * em rodada travada, e a fila pode ter os dois números misturados. Pular não grava, não envia
       * e deixa o atendimento aberto — o contato volta assim que ele arrumar o cadastro.
       *
       * **As duas rodadas passam por aqui**, porque `processarNovo` delega para esta função — é a
       * razão de a barreira morar no começo dela e não em cada chamador.
       */
      const canal = state.canalDoAtendimento || { estado: 'quieto' };
      if (canal.estado === 'outro' && canal.dono) {
        return {
          nome,
          resultado: 'pulado',
          motivo:
            `este atendimento é do número de ${canal.dono.nome} e você está como ` +
            `${state.perfil?.nome || 'o candidato de sempre'} — não tratei para não mandar o texto do candidato errado`,
        };
      }
      /**
       * **Número REMOVIDO da conta não chega aqui** — o bloco acima o resolve antes, porque ele
       * cai neste `desconhecido` por definição (não está em candidato nenhum porque não existe
       * mais) e seria pulado para sempre, com a tela mandando arrumar um cadastro que não tem
       * conserto. Aqui ficam só os dois casos de CADASTRO: número que existe e ainda não foi
       * somado ao candidato, e número que não deu para ler.
       */
      if (canal.estado === 'desconhecido') {
        return {
          nome,
          resultado: 'pulado',
          motivo:
            'o número deste atendimento não está em candidato nenhum — some o número ao candidato certo na aba Config',
        };
      }

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

      /**
       * **A cidade que JÁ ESTAVA no CRM** — separada da que esta passada vai gravar.
       *
       * As duas contam para "tem cidade" (é o que decide o lado do quadro), mas só esta prova que
       * **alguém já trabalhou este contato antes** — ver `jaRespondemosAntes`, logo abaixo. A que
       * vamos gravar agora é desta conversa: contá-la ali faria quem acabou de responder o cadastro
       * na primeira vinda ser tratada como retorno.
       */
      const cidadeJaNoCrm =
        (state.contact?.tagsId || []).some((id) => idsDeCidade.has(id)) ||
        state.tagSuggestions.some((sug) => sug.origem === 'cidade' && sug.tag && sug.jaTem);

      const temEtiquetaDeCidade =
        cidadeJaNoCrm ||
        state.tagSuggestions.some((sug) => sug.origem === 'cidade' && sug.tag && sug.marcada);

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
      // `anuncioSemResposta`: esta variável só serve para NOMEAR o modelo que vai sair, e o modelo
      // sai do clique que ainda espera resposta. Ler `state.anuncio` aqui mostraria o nome de um
      // anúncio e o trecho de outro. Ver o bloco em `load()`.
      const anuncio = state.anuncioSemResposta?.anuncio || null;

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
      /**
       * **A conversa é a memória da SESSÃO; o CRM é a memória de verdade** — print da Rosa
       * (05/09/2026): ela mandou uma figura de "bom dia", carregava etiqueta de cidade, de COREDE e
       * de conteúdo, e recebeu as **boas-vindas do gabinete** — *"não foi a primeira vez que a
       * pessoa veio, mesmo que esteja sem etiqueta ADS; correto seria mensagem do momento, dois
       * casos seguidos já"*.
       *
       * Ela voltou sozinha, semanas depois, e isso abre uma **sessão nova**: `state.nossas` nasce
       * vazio, `jaRespondemosAntes` dava falso, e o quadro a mandava para o ramo *"anúncio — pessoa
       * nova"*, onde `chegada-boas-vindas` a apresentou ao gabinete pela segunda vez.
       *
       * É a mesma armadilha do Orides, três dias antes: **`session.utm` é "veio de anúncio NESTA
       * sessão"; a etiqueta é "veio de anúncio"**. Aqui o par é o mesmo — a conversa é uma janela,
       * a marca no CRM é a memória.
       *
       * **A prova de primeira mão é o botão "Ver conversa anterior"** (`state.temConversaAnterior`),
       * que a plataforma só mostra quando existe atendimento anterior — foi ele quem apontou o
       * sinal, e é o único aqui que não é dedução.
       *
       * A segunda marca é **a etiqueta de cidade que já estava lá** — decisão dele de 02/09,
       * escrita neste arquivo: *"se a pessoa já respondeu a cidade a chance de ela ter recebido um
       * modelo é muito grande"*. Ela cobre o caso em que a leitura da tela falha. **O custo, dito a
       * ele:** contato de base importada, com cidade preenchida e conversando pela primeira vez,
       * passa a receber a mensagem do momento em vez das boas-vindas.
       *
       * **A Data de conclusão do contato ESTAVA aqui e saiu no mesmo dia** — print da Neiva
       * (05/09/2026): ela chegou pelo anúncio do Facebook, escreveu só o texto do próprio anúncio,
       * **não tem etiqueta de cidade**, e recebeu o modelo + agradecimento em vez do modelo + o
       * pedido de nome e cidade. *"Começou a mandar agradecimento em vez de pedir os dados; segundo
       * caso já, e claramente é pessoa nova que chegou por anúncio."* Medido: com o sinal
       * verdadeiro o caso vai para `conteudo-pedido` (tecla 1); com ele falso, para
       * `anuncio-modelo-e-dados` (tecla `a`), que é o desfecho certo.
       *
       * Eu havia escrito que ali **"falso positivo é impossível"**, e é o contrário: a data prova
       * que já **CONCLUÍMOS** um atendimento, não que já **ENTREGAMOS** alguma coisa. Concluir em
       * silêncio grava a data igual — e esta rodada conclui em silêncio o tempo todo (tecla 3,
       * `ultima-e-nossa`, `etiqueta-so-conclui`). Num dia de 268 conclusões, a data está em quase
       * todo mundo que já passou por uma rodada.
       *
       * É a lição da Ivone (31/08) uma linha acima, na forma que eu não reconheci: **pergunta não é
       * entrega — e conclusão também não é.**
       */
      const jaRespondemosAntes = (() => {
        if (state.temConversaAnterior || cidadeJaNoCrm) return true;
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
        veioDeUmAnuncio && !temEtiquetaDeCidade && !jaRespondemosAntes ? await carregarModelosPadrao(perfilAtivo()) : [];
      // `anuncioSemResposta`, e não `anuncio`: o modelo do anúncio é a resposta AO CLIQUE, e um
      // clique já respondido não pede nada. Ver o bloco em `load()`.
      const escolhaDeModelo = anunciosLib.modeloDoAnuncio(
        state.anuncioSemResposta,
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
              : `anúncio: ${anuncio.nome || `"${state.anuncioSemResposta.trecho}"`}`,
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
          const mapa = await lerContentTemplates();
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
      /**
       * **Quem ESCREVEU depois do formulário não o ignorou** — print da Lenir (08/09/2026).
       *
       * Ela recebeu o pedido em 07/09 e respondeu, em duas mensagens: *"Lenir"* e *"Curitiba"*. No
       * dia seguinte a rodada mandou a mensagem do momento **com o pedido de novo**. Ele: *"pediu
       * dados novamente"*.
       *
       * **Medido: o parser não devolve NADA dessas duas mensagens** — nem nome, nem cidade. Curitiba
       * não está entre os 497 municípios do RS (a extensão só conhece os daqui), e o nome sozinho
       * numa mensagem própria não é alcançado pelo modo generoso, que espera nome e cidade juntos.
       * Então `state.nomeInformado` e `state.cidadeInformada` ficam vazios e o cadastro parece não
       * ter chegado.
       *
       * **O texto combinado existe para quem IGNOROU o formulário** — é o pedido dele de 04/09, com
       * a print da figura de bom dia que recebeu o formulário seco treze horas depois. Quem
       * respondeu não ignorou, mesmo que a resposta seja invisível para o parser; e pedir de novo a
       * quem acabou de responder é o pior efeito possível deste texto.
       *
       * A conferência exige TEXTO de verdade: figura e emoji soltos não contam como resposta, que é
       * o que preserva o caso de 04/09.
       */
      const escreveuDepoisDoPedido = (respostasApos(state.entrantes, state.nossas, templatesLib.ehPedidoDeDados) || [])
        .some((m) => String(m?.texto || '').trim() && !m?.sistema && !ehSoReacao(m));

      const faltaCadastro =
        jaPediramDados &&
        !temEtiquetaDeCidade &&
        !escreveuDepoisDoPedido &&
        !(state.nomeInformado && state.cidadeInformada?.value && state.cidadeInformada.confidence !== 'nao-reconhecida');
      const pedidoJunto = String(state.auto.cfg.pedidoJuntoDoMomento || '').trim();
      /**
       * **O texto do momento pode JÁ TER o pedido dentro** — print do Luiz Cavalheiro (08/09/2026),
       * em que a mensagem saiu com o bloco `Nome , Cidade` **duas vezes**, a segunda cópia idêntica
       * à primeira. Ele perguntou se a IA tinha alucinado; não tinha — texto de modelo não se
       * repete byte a byte, isto é concatenação.
       *
       * A conferência é o mesmo invariante que o resto do projeto usa (`ehPedidoDeDados`), e não a
       * comparação com o texto atual do campo: ele pode ter escrito o pedido no momento com outra
       * redação, e comparar redação é a armadilha registrada desde 01/09.
       *
       * A tela já avisava quando o campo `pedidoJuntoDoMomento` **não** é um pedido de dados; o que
       * faltava era o outro lado — o momento que já é um.
       */
      const momentoJaPede = momento && templatesLib.ehPedidoDeDados(momento.text);
      if (momento && faltaCadastro && pedidoJunto && !momentoJaPede) {
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
       * **As três NEGATIVAS saem uma vez por contato, e nunca mais** — regra dele (06/09/2026),
       * com a print da Cleonice: *"mandou mensagem sobre pedido financeiro novamente pra mesma
       * pessoa, só deve ser mandado uma vez"*.
       *
       * Ela já tinha recebido a negativa de ajuda financeira; mandou um áudio longo contando da
       * mãe, do cartório e do dinheiro emprestado — e recebeu a MESMA negativa de novo. Ele apagou
       * a mensagem na plataforma.
       *
       * **O detector não estava errado.** `pedeAjudaFinanceira` lê a RAJADA (o que ela escreveu
       * depois da nossa última mensagem), então ela pediu de novo e o sinal ficou verdadeiro de
       * novo — corretamente. O que faltava é que **dizer "não podemos" duas vezes não é responder,
       * é repetir**: a segunda vez não acrescenta nada e soa a robô em cima de quem está pedindo
       * socorro.
       *
       * **Vale para as TRÊS**, porque são a mesma classe de texto — ajuda financeira, emprego e
       * ligação, as três dizem "não podemos fazer isso". Repetir qualquer uma tem o mesmo defeito.
       *
       * **A trava mora no SINAL, e é o que a faz valer no quadro dele sem importar nada.** As
       * caixas são dele (`noVazio` + `condicao: pedeAjudaFinanceira`), então uma exceção nova só
       * chegaria depois de ele importar o fluxo — e esta precisa valer hoje. Mesmo desenho do
       * `apoioTrava`: o sinal chega nulo, e o quadro decide como se ela não tivesse pedido.
       *
       * **Pergunta à CONVERSA e não ao registro de envios** (`jaSaiuNaConversa`): a mensagem sai
       * também pela mão dele e pela automação da plataforma, e a que ele APAGOU na plataforma
       * continua contando — apagar tira da tela dela, não do que já foi dito.
       *
       * O que acontece depois: o caso desce para a caixa seguinte. No caso da Cleonice, o áudio
       * longo cai em "você responde" — que é a outra metade do que ele pediu: *"o contexto também
       * pedia resposta minha ou de IA por ser conversa extensa"*.
       */
      /**
       * **E ela pergunta pelo INVARIANTE também, não só pelo texto da resposta pronta.**
       *
       * Print do "Silva pinturas" (12/09/2026): a negativa de ajuda saiu às 10:20 escrita pela IA,
       * ela reescreveu pedindo o Pix, e às 14:22 saiu **a mesma negativa outra vez**. Ele: *"IA se
       * repetindo, já vi outros casos; esse é o maior sinal de máquina respondendo, repetição, não
       * pode acontecer isso."*
       *
       * **Medido: `jaSaiuNaConversa` procura o maior pedaço LITERAL da resposta pronta — 815
       * caracteres** — e desde a 3.10 o pedido de dinheiro é respondido pela IA em texto livre, que
       * nunca contém aquele pedaço. A guarda de 06/09 devolvia `false` sempre.
       *
       * **Terceira vez da mesma classe:** marca amarrada a QUAL texto saiu morre quando o caminho
       * de resposta muda (a etiqueta de material na 3.40, a de pedido de dinheiro na 3.46).
       */
      const INVARIANTE_DA_RESPOSTA = {
        'pedido-ajuda': templatesLib.ehNegativaDeAjuda,
        'pedido-emprego': templatesLib.ehNegativaDeTrabalho,
        'trabalhar-na-campanha': templatesLib.ehNegativaDeTrabalho,
        /**
         * **O agradecimento pelo apoio entrou em 15/10/2026** — print dele: `agradecer-apoio`
         * saiu as 13:11 na variante 2 e as 13:48 no texto base, e ele apagou (*"novamente
         * repeticao"*). **O revezamento entre as tres formas fez a mesma resposta parecer
         * outra**, que e a armadilha de 02/09 (*a conferencia tem de cobrir todo o conjunto que
         * pode sair, nao o item sorteado*) numa porta nova: la o rodizio era do modelo padrao,
         * aqui e das variantes de uma resposta pronta.
         *
         * **O texto se chama "Agradecer o apoio e ENCERRAR"**: ele fecha a conversa, e fechar
         * duas vezes e o sinal de maquina. Uma vez por conversa.
         */
        'agradecer-apoio': templatesLib.ehAgradecimentoDeApoio,
      };

      const respostaJaSaiu = (id) => {
        const pronta = state.templates.find((t) => t.id === id);
        if (pronta && [pronta.text, ...(pronta.variantes || [])].some((texto) => jaSaiuNaConversa(texto))) {
          return true;
        }
        const invariante = INVARIANTE_DA_RESPOSTA[id];
        if (!invariante) return false;
        return (state.nossas || []).some((m) => invariante(m?.texto || ''));
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

      /**
       * **Ela encerrou a conversa?** — calculada aqui, antes do contexto, porque DOIS sinais
       * dependem dela: `ultimaEhDespedida` e `soCortesia`. Ver `encerrouAConversa`.
       */
      const encerrou = await encerrouAConversa(jaRespondemosAntes);

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

      /**
       * Os sinais ficam num nome próprio porque o painel os consulta DEPOIS — e a primeira consulta
       * foi a troca de texto das boas-vindas (05/09/2026). Lidos de um objeto só, painel e quadro
       * não têm como discordar sobre o mesmo contato.
       */
      const sinaisDoContato = {
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
        /**
         * **A IA ASSUME O ENCERRAMENTO** — decisão dele (15/10/2026): *"determinístico para
         * encerrar tem dado errado demais, a IA terá que assumir o encerramento"*.
         *
         * **No SINAL, e não numa caixa nova**, porque é aqui que vale no quadro DELE sem ele
         * importar nada — o mesmo desenho da trava da negativa (06/09) e da do agradecimento
         * (15/10). Quem decide continua sendo a caixa "Só se despediu", na posição em que ela já
         * está; o que mudou é quem responde à pergunta.
         */
        ultimaEhDespedida: encerrou,
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
        // ROUPA (12/09/2026): não fornecemos e a lei proíbe (9.504/97, art. 39 § 6º). Entra NESTE
        // sinal para ser tecla 6 alta nos dois ramos sem ele importar o quadro — a IA responde que
        // não temos. Antes era "material": etiqueta que pula e pedido de endereço.
        //
        // MATERIAL ESCRITO POR ELA (19/09/2026, o Jair): o mesmo caminho da roupa, e pela mesma razão —
        // entrar aqui torna o caso tecla 6 ALTA nos dois ramos (na chegada, acima do recibo) sem ele
        // importar o quadro. **Só sem anúncio reconhecido esperando resposta:** se ela clicou num
        // anúncio cadastrado, o modelo DELE é o que ela pediu, e o recibo responde.
        pedeRespostaPessoal:
          conversaPedeRespostaPessoal(state.entrantes, state.nossaUltimaAt, state.padroesDeAnuncio) ||
          pedeRoupa(state.entrantes, state.nossaUltimaAt, state.padroesDeAnuncio) ||
          (!state.anuncioSemResposta && pedeMaterialEscrito(state.entrantes, state.nossaUltimaAt, state.padroesDeAnuncio)) ||
          // ELA FALOU ALGO QUE NINGUÉM RESPONDEU (22/09/2026): a inversão — tudo o que não é cortesia,
          // reação, apoio, despedida, o texto do anúncio ou o próprio cadastro pede resposta. Mesmo
          // caminho da roupa: tecla 6 alta nos dois ramos, e na chegada acima do recibo.
          falouAlgoProprio(state.entrantes, state.nossaUltimaAt, state.padroesDeAnuncio, {
            jaSabemos: [state.nomeInformado, state.cidadeInformada?.value, state.contact?.name],
          }),
        // Pergunta de razão ou de posição: nenhuma resposta pronta responde, e mandar o modelo
        // vira material de campanha em cima da pergunta dela (print da Clair, 31/08).
        perguntaAberta: conversaTemPerguntaAberta(state.entrantes, state.nossaUltimaAt, state.padroesDeAnuncio),
        // Só apoio, sem pergunta e sem pedido: agradecer é o desfecho (print do Ciro, 31/08).
        // A tecla só é oferecida se o texto do agradecimento não estiver travado por variável.
        // Os padrões do anúncio vêm da Config: é por eles que a mensagem gerada pelo anúncio
        // ("Olá! Eu apoio as Escolas Cívico-Militares") deixa de contar como apoio escrito por
        // ela. Por TEXTO e não por posição — a figura que a Erenita mandou antes derrubou a
        // versão posicional (01/09).
        /**
         * **O AGRADECIMENTO SAI UMA VEZ POR CONVERSA** — print dele (15/10/2026): ela escreveu
         * apoio, recebeu `agradecer-apoio` as 13:11, respondeu *"Amem firme dia 25 e 22"* e
         * recebeu a MESMA resposta pronta as 13:48, noutra variante. *"novamente repeticao, a
         * pessoa finalizou a conversa"*.
         *
         * **O detector nao estava errado:** `soExpressaApoio` le a RAJADA desde a nossa ultima
         * fala, ela apoiou de novo, o sinal ficou verdadeiro de novo. O que faltava e que
         * **agradecer duas vezes nao e responder, e repetir** — a mesma forma da trava da
         * negativa (a Cleonice, 06/09), e por isso ela mora no SINAL e nao numa excecao da
         * caixa: excecao so chegaria depois de ele importar o quadro, e esta precisa valer hoje.
         *
         * **Medido:** calado o sinal, quem decide e `ja-respondemos-antes` -> **tecla 3**, que
         * conclui sem enviar nada. E uma das duas saidas que ele pediu (*"ou nem mandar"*), e e
         * SILENCIOSA — a guarda nao empurra o caso para nenhuma caixa que envie (a licao da
         * Noeli, 06/09).
         */
        soExpressaApoio:
          apoioTrava || respostaJaSaiu('agradecer-apoio')
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
         * **Faz mais de X horas que ela escreveu** — a régua de `contexto-de-outro-dia` desde
         * 14/10/2026, com o limite em `auto.horasContextoPerdido` (nasce em 48, `0` desliga).
         *
         * `deOutroDia` continua calculado ao lado: ele é a régua antiga (dia local) e ainda é lido
         * pelo QUADRO dele como sinal. Tirá-lo daqui apagaria a condição das caixas que ele já
         * montou com esse sinal — quadro é cópia, e sinal que some de lá não casa mais nunca.
         */
        contextoPerdido: contextoPerdido(state.entrantes, state.auto.cfg.horasContextoPerdido),
        /**
         * **Ela pediu material e ainda não recebeu.**
         *
         * Regra dele (05/09/2026): *"o modelo de material é uma exceção, ele sempre tem que ser
         * mandado quando requisitado"*. É a exceção de `contexto-de-outro-dia`: a print mostrava
         * *"Olá! Eu quero receber o Material da Direita"* de ontem recebendo a mensagem do momento
         * e sendo concluída.
         *
         * **As duas metades:** o pedido, que `cortesia.pedeMaterial` lê na conversa INTEIRA (o
         * pedido não vence com o dia), e a ENTREGA, que é a guarda contra a repetição — saíndo o
         * modelo, o sinal se apaga e a caixa do tempo volta a valer. Sem a segunda metade isto
         * seria a armadilha já registrada: o texto do anúncio fica na conversa para sempre.
         */
        materialPendente: !modeloJaNaConversa && !enviadoHoje && !!pedeMaterial(state.entrantes),
        /**
         * **Terminou com uma pergunta?** Só impede a conclusão em silêncio — ver
         * `cortesia.perguntaPendente`, que olha a RAJADA inteira. Não é `perguntaAberta`, que
         * decide o desfecho.
         */
        perguntaPendente: perguntaPendente(state.entrantes, state.nossaUltimaAt, state.padroesDeAnuncio),
        /**
         * **Ela disse que não é do RS** — 24/09/2026. Entra em `sugestao.pedirDadosNaoCabe`, então
         * cala o formulário nos DOIS caminhos (a rodada e o fecho do rascunho). Lê a conversa
         * INTEIRA: dizer de onde se é não deixa de ser verdade com o tempo.
         */
        deOutroEstado: disseQueEDeOutroEstado(state.entrantes),
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
        pedeAjudaFinanceira: respostaJaSaiu('pedido-ajuda') ? null : pedeAjudaFinanceira(state.entrantes, state.nossaUltimaAt),
        /**
         * **Perguntou como trabalhar no mandato.** Anotação do Kelvem (02/09/2026): a pergunta veio
         * numa mensagem e o *"No caso vcs não pagam"* na seguinte, e a rodada agradeceu e concluiu.
         * O texto que explica e nega já existia sem ninguém acioná-lo.
         */
        pedeEmprego: respostaJaSaiu('pedido-emprego') ? null : pedeEmprego(state.entrantes, state.nossaUltimaAt),
        /**
         * **Pediu que a gente ligasse.** Anotação da Jucileia (04/09/2026): *"Oi"*, três mensagens
         * que a plataforma não leu e *"Me liga"* — e a rodada ofereceu concluir, deixando a pessoa
         * esperando o telefone tocar.
         */
        pedeLigacao: respostaJaSaiu('pedido-ligacao') ? null : pedeLigacao(state.entrantes, state.nossaUltimaAt),
        /**
         * **"Gostaria de falar com o deputado"** — pedido dele (08/09/2026), print do pastor.
         *
         * Entra com a mesma trava das outras negativas (`respostaJaSaiu`): dizer *"o WhatsApp
         * pessoal não é repassado"* duas vezes não é responder, é repetir — a regra da Cleonice
         * (06/09). Barrada a repetição, o caso desce para quem o alcançar, que é o desfecho certo.
         */
        pedeFalarComDeputado: respostaJaSaiu('falar-com-deputado')
          ? null
          : pedeFalarComDeputado(state.entrantes, state.nossaUltimaAt),
        naoPodeFalarAgora: naoPodeFalarAgora(state.entrantes, state.nossaUltimaAt),
        /**
         * **Ela reclama de não ter sido atendida** — pedido dele (09/09/2026), sobre o print do
         * Maicon. Fica ao lado do `naoPodeFalarAgora` porque as duas dizem a mesma coisa: aqui
         * precisa de gente, e as duas dividem a caixa de `ultima-pede-resposta-pessoal`.
         */
        reclamaSemResposta: reclamaSemResposta(state.entrantes, state.nossaUltimaAt),
        rajadaDeAnuncios: rajadaDeAnuncios(state.entrantes, state.nossaUltimaAt, state.padroesDeAnuncio),
        /**
         * **Só cumprimentou, e nada mais.** Substitui a caixa de palavras "bom dia", que casava por
         * trecho contido e por isso pegava a Teresinha (*"Boa tarde o senhor tá concorendo
         * também"*) e o desabafo da Cris. `soCortesia` olha se TODAS as últimas mensagens são só
         * cumprimento — que é o que o nome da caixa sempre prometeu.
         */
        // A RAJADA, e nao as tres ultimas da conversa: `soCortesia` olha as ultimas mensagens sem
        // saber onde a nossa entrou, entao sem este recorte o sinal continuaria verdadeiro depois
        // de respondermos — e a caixa mandaria a mensagem do momento em toda passada.
        /**
         * **QUEM ENCERROU NÃO "SÓ CUMPRIMENTOU"** — medido em 15/10/2026, e é a peça sem a qual o
         * encerramento não chega ao desfecho no quadro DELE.
         *
         * *"Bom dia, tudo certo obrigado"* liga os dois sinais, e no quadro a caixa **"só
         * cumprimentou" (tecla 5, ENVIA) está acima de "Só se despediu" (tecla 3)** nos dois ramos
         * do retorno — medido: tabela dá 3, quadro dá 5. Reordenar o quadro dele é o que este
         * projeto não faz; **calar o sinal é CONDIÇÃO, e condição vale hoje, sem ele importar nada**
         * (a trava da negativa, 06/09, e a do agradecimento, 15/10).
         *
         * E não é um contorno: quem escreveu *"bom dia, tudo certo obrigado"* **não** só
         * cumprimentou — ela fechou a conversa. O sinal estava afirmando a coisa errada.
         *
         * **Só silencia, nunca acrescenta:** o efeito é tirar uma tecla 5 da frente e deixar a
         * caixa da despedida decidir, que conclui sem enviar.
         */
        soCortesia: encerrou ? null : soCortesia(rajadaFinal(state.entrantes, state.nossaUltimaAt)),
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
        // A sessão OU a etiqueta de origem no CRM — ver `veioDeAnuncioAlgumaVez`.
        veioDeAnuncio: await veioDeAnuncioAlgumaVez(),
        /**
         * **Reconheci de QUAL anúncio ela veio** — diferente de `veioDeAnuncio`, que é a origem.
         *
         * A origem vem da plataforma e diz só que houve um anúncio; este sinal diz que o texto
         * casou com um dos anúncios do momento que ele cadastrou. É o que permite um ramo do
         * quadro separar "veio de anúncio que eu conheço" de "veio de anúncio qualquer".
         */
        // O sinal do quadro é "há um clique de anúncio esperando resposta", e não "ela já veio de
        // anúncio um dia" — ver `anuncioSemResposta` em `load()`.
        anuncioReconhecido: !!state.anuncioSemResposta,
      };
      /**
       * **Guardados no `state` porque o RASCUNHO precisa deles** (05/09/2026): a IA só sabe se deve
       * pedir o cadastro consultando a mesma conta que guarda o formulário, e `rascunharParaEle`
       * roda fora deste bloco. Zerado no `load()`, como o anúncio: sinal de um contato executado em
       * outro é a armadilha da pergunta de cidade.
       */
      state.sinais = sinaisDoContato;
      let sugestao = sugerirAcaoComFluxo(sinaisDoContato);

      /**
       * **A EXCEÇÃO da etiqueta de material: ela pediu material fora do anúncio** — regra dele
       * (10/09/2026): *"a etiqueta de material será colocada agora quando o modelo de material sair,
       * como prioridade, e em caso de exceção quando a pessoa pedir material fora do anúncio"*. A
       * prioridade mora em `enviarModelo`; esta é a outra metade.
       *
       * **Depois da decisão, de propósito.** Marcar antes faria a etiqueta decidir ESTA passada (ela é
       * o que manda pular), e o modelo de material nunca sairia — contra a prioridade que ele deu. Assim
       * esta passada segue como seria, e a etiqueta passa a valer da próxima em diante.
       *
       * Só quem ainda não tem a etiqueta: marcada uma vez, não se marca de novo.
       *
       * **O `await` é obrigatório**: `etiquetaDaLista` é assíncrona, e `!etiquetaDeEndereco()` sem ele
       * testa uma PROMESSA — sempre verdadeira —, então a exceção nunca marcaria ninguém, e em silêncio.
       * Escrevi assim na primeira versão; testes e verificadores passaram, porque nenhum roda o painel.
       */
      if (!(await etiquetaDeEndereco())) {
        const pediuMaterial = pedeMaterialForaDoAnuncio(state.entrantes, state.padroesDeAnuncio);
        if (pediuMaterial) {
          const aviso = await etiquetarEndereco(state.contact, { gatilho: `ela escreveu um pedido de material: ${pediuMaterial.motivo}` });
          registrarNaRodada(nome, 'info', `${pediuMaterial.motivo} — etiqueta de material${aviso || ' marcada'}`);
        } else if (state.materialPelaRegra) {
          /**
           * **Uma regra de etiqueta da Config apontou para a de material** (17/09/2026) — ela não é mais
           * gravada direto (ver `refreshTagSuggestions`); passa pela mesma conferência da IA.
           */
          const aviso = await etiquetarEndereco(state.contact, { gatilho: `uma regra de etiqueta achou material: ${state.materialPelaRegra.motivo}` });
          registrarNaRodada(nome, 'info', `regra de etiqueta (${state.materialPelaRegra.motivo}) — etiqueta de material${aviso || ' marcada'}`);
        }
      }

      /**
       * **A etiqueta de quem PEDIU DINHEIRO OU EMPREGO sai pelo SINAL** — pedido dele (10/09/2026):
       * *"como a IA atende pedido de ajuda e dinheiro, a etiqueta não está sendo colocada"*. Ver
       * `sugestao.motivoDaEtiquetaDePedido`. Depois da decisão pelo mesmo motivo do material, e a
       * etiqueta que o contato já tem não é aplicada de novo (`aplicarEtiquetaDePedido` confere).
       */
      const motivoDoPedido = sugestaoLib.motivoDaEtiquetaDePedido(sinaisDoContato);
      if (motivoDoPedido && String(state.auto.cfg.etiquetaPedidoAjuda || '').trim()) {
        const marca = await aplicarEtiquetaDePedido(state.contact, { gatilho: motivoDoPedido });
        if (marca) registrarNaRodada(nome, 'info', `${motivoDoPedido} — etiqueta de pedido${marca}`);
      }

      /**
       * **A tecla `i` tem TRÊS textos, e quem respondeu o cadastro recebe o da INFORMAÇÃO.**
       *
       * Print da Mari (06/09/2026): ela respondeu ao formulário por áudio — *"Boa tarde, tudo bem
       * com você? Sou de Caxias do Sul."* — e recebeu *"Obrigado de coração pelo apoio e pela
       * confiança — é isso que sustenta o trabalho"*. Ela não expressou apoio nenhum: deu a cidade.
       * *"mensagem fora de contexto"*.
       *
       * `respondeu-os-dados` sempre apontou para a tecla `i`, e a tecla `i` mandava um texto sobre
       * APOIO. O agradecimento certo já existia (`agradecer-info`: *"obrigado pela mensagem e pelas
       * informações — recebemos tudo por aqui"*) e não era alcançado por nenhuma regra.
       *
       * É o mesmo desenho do evento (02/09): **a regra decide o DESTAQUE, o painel decide o TEXTO**,
       * e o rótulo da opção muda junto — senão a rodada mandaria duas coisas diferentes com o mesmo
       * nome na tela.
       */
      const agradecerInfoTexto = agradecerInfo ? await templatesLib.varianteAtual(agradecerInfo) : '';
      const agradecerInfoTrava = agradecerInfo
        ? vars.render(agradecerInfoTexto, contexto).missing.length > 0
        : true;
      /**
       * **O SINAL decide, e não o id da regra** — print da Rosane (06/09/2026).
       *
       * Pedimos os dados às 11:30; às 12:00 ela respondeu *"Rosane Maria Bossle Debiasi"* e *"Caxias
       * do sul"*; às 13:47 recebeu *"Que bom ler isso, obrigado pelo apoio e pelo carinho de
       * sempre"*. Ele apagou a mensagem na plataforma.
       *
       * **O conserto de 2.65 nunca funcionou no quadro**, e a causa é uma linha: a comparação era
       * `sugestao?.id === 'respondeu-os-dados'`, e no quadro o id da caixa é
       * **`r:respondeu-os-dados:com-cidade`** — o `r()` do `fluxoPadrao` reescreve o id de propósito,
       * porque a mesma regra aparece nos dois ramos e id repetido é o que `problemas` acusa. Medido:
       * a comparação dava `false` em 100% dos casos, então **o texto do apoio saía sempre**.
       *
       * Somava-se `tambemQuando`: a caixa junta `respondeu-os-dados` com `so-expressa-apoio`, então
       * nem o id da caixa diria qual das duas casou.
       *
       * Perguntar ao SINAL resolve as duas coisas e não depende de rota nenhuma — é a mesma
       * disciplina de `ehPresencaSemPendencia`, três blocos acima, que sempre leu os sinais.
       */
      const ehRespostaAoCadastro =
        !!sinaisDoContato.respondeuOsDados && !ehPresencaSemPendencia && !agradecerInfoTrava;
      const textoDaTeclaI = ehRespostaAoCadastro ? agradecerInfo : textoDoApoio;
      const travaDaTeclaI = ehRespostaAoCadastro ? agradecerInfoTrava : travaDoApoio;

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

      /**
       * **A IA ENTRA ONDE O DETERMINISTICO NAO RESOLVE, E O QUE ELA FAZ ALI E ESCREVER.**
       *
       * Regra dele (06/09/2026): *"o botao de chamar IA foi feito exatamente pra isso: quando
       * nenhuma resposta serve, ela da uma resposta personalizada. Essa e a funcao dela. Tudo que
       * o deterministico nao consegue resolver, ela resolve"*.
       *
       * **O que mudou:** ate aqui a IA ESCOLHIA uma resposta pronta nesses casos, e com
       * "Automatizar" marcado ela mandava e concluia. Havia uma contradicao no meio: a tecla 6
       * significa, por definicao, que **nenhuma resposta pronta serve** — e o que saia era
       * justamente uma resposta pronta, escolhida de um conjunto que a regra acabara de dizer que
       * nao servia. Medido: e o unico ponto em que a IA substituia uma decisao do quadro.
       *
       * Hoje o desfecho e um so: **rascunho personalizado no campo de mensagem**, e ele manda.
       * `rascunharParaEle` nunca envia (decisao dele, 03/09) — a fronteira que torna o erro
       * recuperavel continua de pe, porque quem aperta enviar e gente.
       *
       * As tres portas continuam sendo as mesmas, e sao as que ele nomeou: nenhuma caixa decidiu,
       * tecla 6, ou um ramo dele entregou o caso a ela. Medido em 20.000 contextos: **5,4% do
       * total no quadro dele**. Os outros 94,6% o fluxo resolve sem gastar um centavo.
       *
       * **`state.ia.ligada` e obrigatorio aqui**, e nao `iaTemChave`: este gasto e da rodada, e a
       * caixa da Config e o interruptor dele. Rascunho pedido a mao (o botao da aba Respostas, a
       * tecla 8) continua olhando so a chave, porque ali quem pediu foi ele.
       */
      const iaEntra = !!state.ia?.ligada && (!sugestao || regraPedeGente || ramoChamaIA);
      /** Vira uma linha da caixa, para ele ver POR QUE o caso esta com ele e o que ela escreveu. */
      let escalouParaVoce = '';
      /** A IA leu e disse que não há o que responder — ver `rascunharParaEle` e a regra 16. */
      let semOQueResponder = false;
      if (iaEntra) {
        /**
         * **O `try` nao e decoracao.** Sem ele, um defeito aqui dentro vira `resultado: 'erro'` la
         * embaixo e `percorrerFila` PARA a rodada — foi exatamente o que aconteceu em 03/09/2026
         * (*"parou a rodada, o que nao e pra acontecer"*). Falha de IA nunca para a rodada: o
         * rascunho e uma conveniencia, a fila e o trabalho.
         */
        let rascunho = { ok: false, motivo: '' };
        try {
          rascunho = await rascunharParaEle();
        } catch (err) {
          rascunho = { ok: false, motivo: `falhou: ${err?.message || err}` };
        }

        const porQue = sugestao
          ? `o fluxo mandou para você ("${sugestao.id}")`
          : 'nenhuma caixa do fluxo decidiu este caso';

        /**
         * **A IA ESCREVE E MANDA quando a rodada está automática** — decisão dele (06/09/2026):
         * *"o box de IA está ligado, então aqui deveria chamar a IA para escrever e enviar"*.
         *
         * **Isto atravessa a fronteira que o projeto manteve desde o começo:** até aqui o que saía
         * para o eleitor era, byte a byte, um texto que ELE escreveu, e era isso que tornava o
         * erro recuperável — o pior caso era a resposta pronta errada, nunca uma frase inventada
         * num mandato. Agora, com as duas caixas marcadas, sai texto que a IA escreveu.
         *
         * **Ele já viveu este caminho e o cortou uma vez** (03/09: *"retire essa mensagem
         * automática"*), com quatro travas que funcionaram e a mensagem saiu mesmo assim. A
         * diferença de hoje é o rótulo da caixa, que diz o que ela faz: *"envia sozinha, sem
         * perguntar"*. Marcá-la é a escolha; desmarcá-la devolve o rascunho para ele mandar.
         *
         * **As travas que ficam, e são todas sobre o TEXTO que voltou:** marcador esquecido
         * (`{{primeiro_nome}}` iria literal para a tela do WhatsApp), promessa de entregar
         * (Lei 9.504/97, a mesma razão dos `RESTRITOS`) e afirmação de que alguém já providenciou
         * algo (2.74). As outras revisões são cosméticas ou já corrigidas — barrar por elas pararia
         * a rodada por um traço eme.
         *
         * **A lista de casos SENSÍVEIS que existiu aqui por uma hora foi retirada a pedido dele**
         * (*"volte a mensagem automática da IA"*): eu a criei diagnosticando como alucinação da IA
         * uma mensagem que era do determinístico. Ver `rascunhoPodeSairSozinho`.
         */
        if (rascunho.ok && rodadaAutomatica() && iaLib.rascunhoPodeSairSozinho(rascunho.avisos)) {
          if (!(await saveClassification({ withCompletionDate: true, quiet: true }))) {
            return { nome, resultado: 'erro', motivo: 'a classificação não gravou; não enviei o rascunho' };
          }
          await throttle();
          try {
            await page.sendText(rascunho.texto);
          } catch (err) {
            return { nome, resultado: 'erro', motivo: `o rascunho da IA não saiu: ${err?.message || err}` };
          }
          state.lastSendAt = Date.now();

          /**
           * **Este é um SEGUNDO ponto de saída, e o `CLAUDE.md` diz que só devia haver um.**
           *
           * `sendTemplate` é o ponto único por onde toda mensagem sai, e é lá que moram as marcas
           * do envio. Aqui não dá para passar por ele: o que sai é texto livre, sem template — não
           * há id para `markSent`, e as etiquetas de pedido de ajuda dependem de um template que a
           * IA não pode escolher.
           *
           * **A marca que se aplica mesmo assim é a do ENDEREÇO**, e ela é por INVARIANTE do texto
           * (não por id), então vale igual aqui: quem pede o endereço abre o caso de material, e
           * sem esta linha um rascunho que pedisse endereço sumiria da lista que ele transfere no
           * fim do dia. `jaPediramDados` não precisa de nada: ele lê a CONVERSA, e o texto acabou
           * de entrar nela.
           */
          // `abreCasoDeMaterial`: a IA usa a resposta do voluntariado como BASE, então o rascunho
          // dela pede o endereço com a negativa de trabalho junto — e aquilo não é material.
          const marcaEndereco = templatesLib.abreCasoDeMaterial(rascunho.texto)
            ? await etiquetarEndereco(state.contact, { gatilho: 'o rascunho da IA que acabou de sair pede o endereço', acabamosDeMandar: rascunho.texto })
            : '';
          // A palavra-chave vale no texto que SAIU, e aqui quem escreveu foi a IA: a regra é dele,
          // o texto é o que o eleitor recebeu, e é por isso que ela casa no mesmo lugar.
          const marcaPalavra = await etiquetarPorPalavra(state.contact, rascunho.texto);
          const comoFoi = `IA escreveu e mandou${marcaEndereco}${marcaPalavra} (${porQue})`;
          const fechou = await concluirPeloPainel();
          if (!fechou.ok) return { nome, resultado: 'enviado', parar: true, motivo: `${comoFoi}, mas ${fechou.reason}` };
          return { nome, resultado: 'enviado', motivo: `${comoFoi} — e concluí` };
        }

        /** Rascunho barrado por aviso: ele lê e decide, que é o desfecho que a trava existe para dar. */
        const barrado =
          rascunho.ok && rodadaAutomatica() && !iaLib.rascunhoPodeSairSozinho(rascunho.avisos)
            ? ` — NÃO mandei sozinho: ${(rascunho.avisos || []).join('; ')}`
            : '';

        /**
         * **Não achou o que responder: o desfecho é a mensagem do momento** (regra dele, 24/09/2026).
         * A escolha é aplicada mais abaixo, junto da automação do fluxo, para reusar o MESMO caminho
         * de envio da tecla 5 — duas cópias do "manda e conclui" divergem na primeira semana.
         */
        semOQueResponder = !!rascunho.naoHaOQueResponder;

        escalouParaVoce = semOQueResponder
          ? `${porQue} — a IA não achou o que responder nisso; o desfecho é a mensagem do momento (tecla 5)`
          : rascunho.ok
          ? `${porQue} — a IA escreveu um rascunho no campo de mensagem; leia e mande${barrado}`
          : `${porQue} — a IA não conseguiu rascunhar (${rascunho.motivo || 'sem motivo'})`;
        /**
         * **Só o que deu errado entra no log aqui.** `rascunharParaEle` já escreve a linha do
         * sucesso, com os avisos da revisão junto (a saudação trocada, o traço eme); repetir
         * faria a mesma coisa aparecer duas vezes no Andamento. O motivo de o caso estar com ele
         * vai para a CAIXA, que é onde ele está olhando.
         */
        // A abstenção já tem as duas linhas dela (a de `rascunharParaEle` e a do desfecho, mais
        // abaixo): repetir aqui faria o mesmo evento aparecer três vezes no Andamento.
        if (!rascunho.ok && !semOQueResponder) registrarNaRodada(nome, 'aviso', escalouParaVoce);
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
       * **A tecla 0 SAIU em 06/09/2026** — era "mandar a resposta que a IA escolheu e concluir".
       *
       * Ela nasceu quando o papel da IA era ESCOLHER entre as respostas prontas, e só aparecia em
       * três situações: nenhuma caixa decidiu, tecla 6, ou um ramo dele entregou o caso a ela. Ele
       * redefiniu as três: *"quando nenhuma resposta serve, ela dá uma resposta personalizada;
       * essa é a função dela"*. Escolher uma resposta pronta num caso em que a regra acabou de
       * dizer que nenhuma serve era a contradição que ele apontou.
       *
       * O que fica no lugar é o **rascunho no campo de mensagem** (ver `iaEntra`, acima) — e ele
       * manda pelo botão da conversa, como já faz na tecla 8.
       *
       * `avaliarComIA` foi apagada junto (06/09), quando o botão "Avaliar o contato aberto" saiu
       * da aba Config: era o último a chamá-la, e ela previa um desfecho que o painel não produz
       * mais. Função sem gatilho é a armadilha do `pedido-emprego` — e esta era a que alguém
       * religaria sem querer. O custo por chamada, que era escrito lá dentro, mudou-se para
       * `rascunharParaEle`.
       */

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
      /**
       * **As boas-vindas têm DUAS redacões, e quem escolhe é o cadastro** — print dele (05/09/2026):
       * o contato tinha etiqueta de cidade (Erechim) e de conteúdo, mandou uma figura, e recebeu as
       * boas-vindas com o *"nos informe Nome , Cidade"* dentro. *"já tem os dados e pediu
       * novamente; a mensagem padrão provavelmente só tem pedindo dados"*.
       *
       * Ele estava certo sobre a causa: a resposta funde as duas coisas e existia numa redacão só,
       * então não havia como dar as boas-vindas sem pedir o cadastro — o mesmo defeito das duas
       * respostas de evento, e o mesmo conserto: escrever a metade que faltava.
       *
       * **A troca é do TEXTO e não da caixa**, como a tecla 4 faz com o evento e a tecla 5 com o
       * pedido junto do momento: o quadro continua dizendo "manda boas-vindas", e o rótulo da opção
       * mostra qual das duas sai — duas caixas para a mesma situação divergiriam na primeira semana.
       *
       * A conta de "não há o que pedir" é a de `sugestao.pedirDadosNaoCabe`, a mesma que guarda o
       * formulário: duas cópias divergem na primeira guarda nova.
       */
      /**
       * **A segunda troca de texto, e pela mesma razão** — print do Luciano (09/09/2026).
       *
       * `pedido-emprego` manda para o SINE, o CRAS e o Emprega Brasil: é o caminho de quem procura
       * TRABALHO. Quem se oferece para fazer MILITÂNCIA precisa da outra resposta — a regra dele:
       * *"trabalhamos somente com voluntários sem remuneração e caso tenha interesse dar o
       * endereço"*. Quem separa os dois é `pedeEmprego().tipo`, e a escolha é do TEXTO e não da
       * caixa, como acima.
       */
      const respostaDoFluxo =
        sugestao?.resposta === 'boas-vindas' && sugestaoLib.pedirDadosNaoCabe(sinaisDoContato)
          ? 'boas-vindas-tem-dados'
          : sugestao?.resposta === 'pedido-emprego' && sinaisDoContato?.pedeEmprego?.tipo === 'campanha'
          ? 'trabalhar-na-campanha'
          : sugestao?.resposta;
      const doFluxo = respostaDoFluxo ? state.templates.find((tpl) => tpl.id === respostaDoFluxo) : null;
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
      if (!travaDaTeclaI) {
        opcoes.push({
          tecla: 'i',
          valor: 'apoio',
          // O rótulo diz qual dos TRES vai sair — a tecla é a mesma, o texto não.
          rotulo: ehRespostaAoCadastro
            ? 'Agradecer a informação e concluir'
            : ehPresencaSemPendencia
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
      /**
       * **Ramo que entrega o caso à IA não acende opção nenhuma** (06/09/2026). Ele apontava para
       * a tecla 0, que saiu junto com a escolha de resposta pronta pela IA: o que ela faz ali
       * agora é deixar o rascunho no campo de mensagem, e quem manda é o botão da conversa. A
       * linha `⚠` da caixa diz que o rascunho está lá.
       */
      for (const opcao of opcoes) {
        opcao.primaria =
          !!sugestao &&
          (sugestao.resposta ? opcao.tecla === 'f' && !!doFluxo : opcao.tecla === sugestao.tecla);
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
       * **A IA NAO ASSUME MAIS A RODADA mandando resposta pronta** (06/09/2026).
       *
       * Aqui ficava o bloco que, com "Automatizar" marcado, mandava a resposta escolhida pela IA e
       * concluia — o unico ponto do painel em que ela substituia uma decisao do quadro. Saiu com a
       * tecla 0, pela regra dele: *"quando nenhuma resposta serve, ela da uma resposta
       * personalizada; essa e a funcao dela"*.
       *
       * O que a IA faz nesses casos agora acontece bem antes, na montagem do contexto: ela deixa o
       * **rascunho no campo de mensagem** e a caixa abre para ele mandar. Automatizar continua
       * valendo para tudo o que o quadro decide — que sao 94% dos contatos, medidos.
       */

      /**
       * A automação executa a RECOMENDAÇÃO DETERMINÍSTICA quando existe uma.
       *
       * Esta metade nasceu junto com a reordenação acima, e sem ela o conserto viraria um defeito
       * pior: com a regra decidindo antes, a IA deixa de ser chamada nos casos conhecidos, então
       * não haveria recomendação nenhuma e a caixa abriria esperando um clique **em todo contato
       * com regra** — a rodada automatizada pararia em quase todos. Trocar "manda a mensagem
       * errada" por "não anda" não é conserto.
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

      /**
       * **A IA não achou o que responder → mensagem do momento** (regra dele, 24/09/2026:
       * *"quando for o caso mandar a mensagem do momento"*).
       *
       * Fica DEPOIS da automação do fluxo e só age com ela em branco: o caso chegou aqui pela tecla
       * 6 (ou por nenhuma caixa ter decidido), então não há escolha do quadro para atropelar — e a
       * guarda da pergunta pendente já foi aplicada em `rascunharParaEle`.
       *
       * **Só na rodada automática.** Contato a contato a caixa abre com a linha do `escalouParaVoce`
       * dizendo qual é o desfecho, e quem aperta é ele: mandar sozinho num modo em que ele escolhe
       * tecla a tecla seria decidir no lugar dele.
       *
       * **Sem a mensagem do momento disponível** (travada por variável, ou já enviada hoje) o caso
       * volta a ser dele, com o motivo no log — inventar outro desfecho aqui seria a caixa muda.
       */
      if (semOQueResponder && escolhaAutomatica == null && rodadaAutomatica()) {
        const alvoMomento = opcoes.find((o) => o.valor === 'momento');
        if (alvoMomento) {
          registrarNaRodada(nome, 'aviso', `a IA não achou o que responder — mandando ${alvoMomento.rotulo}`);
          escolhaAutomatica = alvoMomento.valor;
        } else {
          registrarNaRodada(nome, 'aviso', 'a IA não achou o que responder, e a mensagem do momento não está disponível agora — decida você');
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
          // A IA entrou: diz POR QUE o caso está com ele e se o rascunho ficou no campo. As três
          // linhas antigas (a opinião dela, a resposta travada e o "não opinou") saíram junto com
          // a tecla 0 — ela não escolhe mais resposta pronta aqui, ela escreve.
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
          const aviso = dela.jaMarcada ? '' : await etiquetarEndereco(state.contact, { gatilho: `ela mandou um endereço: ${dela.motivo}` });
          return { nome, resultado: 'pulado', motivo: `${dela.motivo} — pulei para você transferir${aviso}` };
        }
        /**
         * **A linha do pulo dizia "você pulou" mesmo quando foi o fluxo** — relato dele
         * (12/09/2026, print da Laura): *"pulando sem motivo, não sei dizer o porquê"*.
         *
         * O Andamento JÁ trazia `automático pelo fluxo ("<regra>", caminho …)` uma linha acima —
         * mas a linha seguinte dizia *"você pulou"*, e duas linhas discordando sobre quem decidiu
         * fazem a primeira parecer de outro contato. **Pular é o único desfecho que não deixa
         * rastro nenhum** (não manda nada, não conclui, não grava), então a linha do log é tudo o
         * que existe para explicá-lo.
         */
        return {
          nome,
          resultado: 'pulado',
          motivo:
            escolhaAutomatica != null
              ? `pulei pelo fluxo ("${sugestao?.id || 'sem regra'}") — nada gravado, atendimento aberto`
              : 'você pulou — nada gravado, atendimento aberto',
        };
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

      if (escolha === 'pedirdados' || escolha === 'momento' || escolha === 'interesse' || escolha === 'apoio') {
        const texto =
          escolha === 'pedirdados'
            ? pedirDados
            : escolha === 'momento'
              ? momento
              : escolha === 'apoio'
                ? textoDaTeclaI
                : interesse;
        const rotulo =
          escolha === 'pedirdados'
            ? 'pedi os dados'
            : escolha === 'momento'
              ? 'mensagem do momento enviada'
              : escolha === 'apoio'
                ? ehRespostaAoCadastro
                  ? 'agradeci a informação'
                  : ehPresencaSemPendencia
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
        /**
         * **Quando foi o FLUXO que escolheu, a IA confere antes** (17/09/2026, *"o determinístico está
         * botando etiqueta antes da IA confirmar qualquer coisa"*). Esta é a mais destrutiva da rodada —
         * etiqueta permanente E conclusão sem resposta —, então sem o `sim` não se faz NENHUMA das duas:
         * o contato fica aberto para ele. **Quando foi ELE quem apertou a tecla, não se confere**: a
         * escolha é dele, e a IA não passa por cima de decisão dele.
         */
        if (escolhaAutomatica) {
          const recusa = await conferirEtiquetaComIA('seminteresse', state.contact, `o fluxo decidiu sem interesse ("${sugestao?.id || ''}"): ${sugestao?.motivo || ''}`);
          if (recusa) {
            return { nome, resultado: 'pulado', motivo: `o fluxo pediu "sem interesse"${recusa.replace('não marquei', 'não marquei nem concluí, fica para você')}` };
          }
        }
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
      return { nome, resultado: 'erro', motivo: traduzirErroDeRede(err.message), rede: ehErroDeRede(err.message) };
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
        // O Esc que a EXTENSÃO dispara para fechar overlay do Material chega aqui como qualquer
        // outro, e aqui Esc significa PARAR A RODADA — foi assim que ela parou sozinha (07/09).
        if (ev.key === 'Escape' && !ev.isTrusted) return;
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
          if (t && m?.encaminhado) return `[${tipo.toLowerCase()} ENCAMINHADO, transcrito] ${t}`;
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
      bloco.append(btn);
      /**
       * **O motivo do bloqueio vai NA TELA, e não no tooltip** — relato dele (05/09/2026):
       * *"bloqueio de mensagens ao mandar a IA responder"*, sobre resposta rápida com o Enviar
       * apagado. O botão só ficava cinza, com a explicação num `title` que exige parar o mouse em
       * cima — ou seja, na prática, sem explicação.
       *
       * A aba Respostas já fazia certo (o `.wf-block` embaixo do cartão); era esta lista, dentro da
       * caixa da rodada, que faltava. É a regra do projeto: *na dúvida, recusar com o motivo na
       * tela* — e tooltip não é tela.
       */
      if (resposta.bloqueio) {
        btn.title = resposta.bloqueio;
        bloco.append(h('div', { class: 'wf-rapidas-bloqueio' }, resposta.bloqueio));
      }
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

  /** Teto da espera, e de quanto em quanto tempo a API é consultada quando a tela não serve. */
  const TETO_DA_ESPERA_MS = 30 * 60 * 1000;
  const ESPERA_ENTRE_LEITURAS_DA_API_MS = 30 * 1000;

  /**
   * **As duas formas de esperar, numa função só** (02/10/2026, o modo de só abrir e atender).
   *
   *  - `trocaSegue: true` (o jeito de sempre) — a conversa JÁ ESTÁ na tela quando a espera começa,
   *    porque a rodada a abriu; você ir para outro atendimento significa "deixei este para depois",
   *    e a rodada segue adiante.
   *  - `trocaSegue: false` (o modo novo) — o atendimento foi criado **pela API** e a tela está onde
   *    você a deixou: "não está na tela" é o estado NORMAL no começo da espera, e tratá-lo como
   *    troca de atendimento abriria o contato seguinte em um segundo, que é o oposto do pedido
   *    (*"quando concluir abrir o próximo"*). Aí a pergunta vai à **API**, de 30 em 30 segundos.
   *
   * **A tela é lida de graça e por isso continua sendo a primeira pergunta:** atendendo na
   * plataforma, a conclusão é notada em um segundo e nenhuma requisição é gasta. A API é a rede de
   * segurança de quem conclui com a tela noutro lugar — ou do celular.
   */
  async function esperarVoceConcluir(sessionId, nome, opcoes = {}) {
    const { trocaSegue = true, perguntarAApi = false, aviso = '', meuUserId = '' } = opcoes || {};
    const limite = Date.now() + TETO_DA_ESPERA_MS;
    setStatus(aviso || `Responda ${nome} à mão. Quando você concluir, eu retomo daqui.`, 'ok');
    let foraDaSessao = 0;
    let semControles = 0;
    let proximaLeitura = Date.now() + ESPERA_ENTRE_LEITURAS_DA_API_MS;

    while (Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 1000));
      if (state.auto.parar) {
        return { nome, resultado: 'pulado', parar: true, motivo: 'você parou a rodada' };
      }

      const estado = await page.getState();
      if (estado.concluded && estado.sessionId === sessionId) {
        return { nome, resultado: 'concluido', motivo: 'você respondeu e concluiu' };
      }

      /**
       * **A API, quando a tela não responde a pergunta.** Falha ao ler NÃO é "concluiu" nem
       * "parou": é a mesma política da barreira do canal — o limitador de taxa recusa requisição
       * com frequência, e desistir da espera por uma leitura que não voltou seria a rodada
       * morrendo por engasgo de rede.
       */
      if (perguntarAApi && Date.now() >= proximaLeitura) {
        proximaLeitura = Date.now() + ESPERA_ENTRE_LEITURAS_DA_API_MS;
        try {
          const onde = loteLib.ondeCaiuOAtendimento(await api.getSession(sessionId), meuUserId);
          if (onde.estado === loteLib.ONDE_CONCLUIDO) {
            return { nome, resultado: 'concluido', motivo: 'você concluiu (vi pela API, não pela tela)' };
          }
        } catch (err) {
          console.warn('[WhatsFill] não consegui reler o atendimento durante a espera:', err);
        }
        /**
         * **A linha de status é reescrita a cada leitura, e não só no começo da espera.** Abrindo o
         * contato na plataforma, o `load()` do painel escreve a barra de status com o que ele
         * carregou — e o aviso de "atenda e conclua" sumiria justo quando ele está atendendo. Com os
         * minutos ao lado, a barra também diz que a rodada está viva e quanto falta para o teto.
         */
        const minutos = Math.round((TETO_DA_ESPERA_MS - (limite - Date.now())) / 60000);
        setStatus(`${aviso || `Responda ${nome} à mão.`} (${minutos} min esperando)`, 'ok');
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
        if (!trocaSegue) continue;
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
      return { nome, resultado: 'erro', motivo: traduzirErroDeRede(err.message), rede: ehErroDeRede(err.message) };
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
      return { nome, resultado: 'erro', motivo: traduzirErroDeRede(err.message), rede: ehErroDeRede(err.message) };
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
      return { nome, resultado: 'erro', motivo: traduzirErroDeRede(err.message), rede: ehErroDeRede(err.message) };
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

  /**
   * **O campo da imagem que vai junto do texto** — pedido dele (20/09/2026). Devolve as linhas para
   * o cartão: a caixa de ligar, o caminho e o aviso do que a extensão ainda não faz.
   *
   * **A caixa e o caminho são separados de propósito:** desligar não apaga o link, então religar no
   * feriado seguinte não custa colar de novo — é o mesmo desenho do modelo reserva.
   *
   * **Caminho do disco (`C:\...`) não serve, e o aviso diz isso na hora**: a extensão roda dentro da
   * página e não lê arquivo do computador; o que ela consegue buscar é um endereço público.
   */
  /** Os bytes de um arquivo em base64, sem o prefixo `data:`. */
  function base64De(blob) {
    return new Promise((ok, falhou) => {
      const leitor = new FileReader();
      leitor.onerror = () => falhou(new Error('Não consegui ler o arquivo.'));
      leitor.onload = () => {
        const dados = String(leitor.result || '').split(',')[1] || '';
        if (dados) ok(dados);
        else falhou(new Error('Não consegui ler a imagem.'));
      };
      leitor.readAsDataURL(blob);
    });
  }

  /**
   * **Desenha a imagem num canvas e devolve JPEG** — a parte da conversão que precisa do navegador,
   * e por isso fica aqui e não em `imagem.js`, que é puro e testado. O que é decidível (quais
   * formatos, qual fundo, qual medida, quais qualidades) mora lá.
   */
  async function converterParaJpeg(arquivo) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(arquivo);
    } catch (_) {
      throw new Error('O navegador não conseguiu abrir esta imagem — o arquivo pode estar corrompido.');
    }
    try {
      const medida = imagemLib.medidaParaDesenhar(bitmap.width, bitmap.height);
      const canvas = document.createElement('canvas');
      canvas.width = medida.largura;
      canvas.height = medida.altura;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('O navegador não deu um canvas para converter a imagem.');
      // JPEG não tem transparência: sem pintar o fundo, PNG recortado sai com quadrado PRETO.
      ctx.fillStyle = imagemLib.FUNDO_DO_JPEG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      let feito = null;
      for (const qualidade of imagemLib.QUALIDADES_JPEG) {
        const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', qualidade));
        if (!blob) throw new Error('O navegador não converteu a imagem para JPEG.');
        feito = { blob, qualidade, largura: canvas.width, altura: canvas.height, reduziu: medida.reduziu };
        if (blob.size <= imagemLib.TETO_GUARDADO_BYTES) break;
      }
      return feito;
    } finally {
      bitmap.close?.();
    }
  }

  /**
   * **O que é guardado é sempre JPEG** (01/10/2026, relato dele: *"baixei uma imagem nova e ela não
   * mostra"* — era PNG, escondido pelo `accept` do seletor).
   *
   * A lista de permissão da plataforma continua sendo só JPEG, porque é o único formato que o envio
   * gravado mostrou. O que mudou é que PNG, WEBP, GIF e BMP **param aqui**: são desenhados num
   * canvas e convertidos antes de ir para o armazenamento, então a cadeia de envio recebe
   * exatamente o que já recebia e nada foi chutado sobre o passo do `transform`.
   *
   * **JPEG que já cabe vai byte a byte**: reconverter perderia qualidade de graça.
   */
  async function lerImagemEscolhida(arquivo) {
    const mime = String(arquivo.type || '').trim().toLowerCase();
    if (arquivo.size > imagemLib.TETO_ESCOLHIDO_BYTES) {
      throw new Error(
        `A imagem tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB. Use uma de até ` +
          `${Math.round(imagemLib.TETO_ESCOLHIDO_BYTES / 1024 / 1024)} MB.`
      );
    }
    const jaEhJpeg = !!imagemLib.conversaoDe(mime);
    if (!jaEhJpeg && !imagemLib.podeConverterAqui(mime)) {
      throw new Error(
        `Não sei ler "${mime || 'este formato'}". Escolha JPEG, PNG, WEBP, GIF ou BMP — os quatro ` +
          'últimos eu converto para JPEG aqui, que é o formato que a plataforma mostrou como manda.'
      );
    }

    if (jaEhJpeg && arquivo.size <= imagemLib.TETO_GUARDADO_BYTES) {
      const dados = await base64De(arquivo);
      return {
        arquivo: { nome: arquivo.name, mime: 'image/jpeg', dados },
        aviso: `Imagem "${arquivo.name}" guardada · ${Math.round(arquivo.size / 1024)} KB.`,
      };
    }

    const feito = await converterParaJpeg(arquivo);
    const dados = await base64De(feito.blob);
    const kb = Math.round(imagemLib.bytesDoBase64(dados) / 1024);
    if (imagemLib.bytesDoBase64(dados) > imagemLib.TETO_GUARDADO_BYTES) {
      throw new Error(
        `Mesmo convertida e na qualidade mais baixa a imagem ficou com ${kb} KB, acima do teto de ` +
          `${Math.round(imagemLib.TETO_GUARDADO_BYTES / 1024)} KB. Use uma arte menor.`
      );
    }
    const nome = imagemLib.nomeComoJpeg(arquivo.name);
    /** A linha diz o que foi FEITO com a arte dele — conversão silenciosa em dado dele não serve. */
    const partes = [`Imagem "${nome}" guardada · ${kb} KB`];
    partes.push(
      jaEhJpeg
        ? 'recomprimida para caber no armazenamento'
        : `convertida de ${mime.replace('image/', '').toUpperCase()} para JPEG`
    );
    if (mime === 'image/gif') partes.push('GIF virou imagem parada: só o primeiro quadro');
    if (feito.reduziu) partes.push(`reduzida para ${feito.largura}×${feito.altura}`);
    if (feito.qualidade < imagemLib.QUALIDADES_JPEG[0]) {
      partes.push(`qualidade ${Math.round(feito.qualidade * 100)}%`);
    }
    return { arquivo: { nome, mime: 'image/jpeg', dados }, aviso: `${partes.join(' · ')}.` };
  }

  function campoDeImagem({ rotulo, valor, ligada, aoMudar, aoLigar, chaveDoArquivo, semInterruptor = false }) {
    const caminho = String(valor || '').trim();
    const doDisco = /^[a-z]:\\/i.test(caminho) || caminho.startsWith('\\\\') || caminho.startsWith('file:');
    const guardada = state.imagens?.[chaveDoArquivo] || null;
    const nome = rotulo.split(' (')[0];
    /**
     * **O interruptor existe onde a imagem ACOMPANHA um texto que sai de qualquer jeito** (a do
     * momento, a do pedido de dados): ali "mandar junto" e uma escolha. No DISPARO a arte e
     * opcional desde 02/10, e quem a tira e o botao "Tirar" da propria imagem — uma caixa de
     * "mandar junto" ao lado seria um segundo jeito de dizer a mesma coisa, e os dois divergiriam.
     */
    const linhas = semInterruptor ? [] : [checkbox(`${nome}: mandar junto`, !!ligada, aoLigar)];

    /**
     * **Escolher o arquivo é o caminho principal** (20/09/2026). A janela do Windows abre a partir do
     * clique DELE — é o único jeito de um arquivo do disco entrar no navegador —, e o que fica guardado
     * são os BYTES, não o caminho: mover ou renomear a arte depois não quebra o envio.
     */
    const escolher = h('input', { type: 'file', accept: imagemLib.MIMES_DO_SELETOR, style: 'display:none' });
    escolher.addEventListener('change', () =>
      withBusy(async () => {
        const arquivo = escolher.files && escolher.files[0];
        if (!arquivo) return;
        try {
          const lido = await lerImagemEscolhida(arquivo);
          await store.set(chaveDoArquivo, lido.arquivo);
          state.imagens[chaveDoArquivo] = lido.arquivo;
          setStatus(lido.aviso, 'ok');
          renderAll();
        } catch (err) {
          setStatus(err?.message || String(err), 'err');
        } finally {
          /**
           * **Sem zerar, o MESMO arquivo escolhido de novo não dispara `change`** — e escolher de
           * novo é justamente o que se faz depois de uma recusa, ou depois de trocar a arte
           * mantendo o nome. O campo ficaria mudo, que é a outra metade de "não atualiza".
           */
          escolher.value = '';
        }
      })
    );
    const btnEscolher = h('button', { class: 'wf-btn', type: 'button' }, guardada ? 'Trocar a imagem' : 'Escolher imagem');
    btnEscolher.addEventListener('click', () => escolher.click());
    const botoes = [btnEscolher];
    if (guardada) {
      const btnTirar = h('button', { class: 'wf-btn wf-mini', type: 'button' }, 'Tirar');
      btnTirar.addEventListener('click', () =>
        withBusy(async () => {
          await store.set(chaveDoArquivo, null);
          state.imagens[chaveDoArquivo] = null;
          setStatus('Imagem removida.');
          renderAll();
        })
      );
      botoes.push(btnTirar);
    }
    linhas.push(h('div', { class: 'wf-row' }, [...botoes, escolher]));

    if (guardada) {
      const mini = h('img', {
        src: `data:${guardada.mime};base64,${guardada.dados}`,
        alt: guardada.nome,
        style: 'max-height:64px;max-width:120px;border-radius:6px;display:block',
      });
      const tamanho = Math.round((guardada.dados.length * 3) / 4 / 1024);
      linhas.push(
        h('div', { class: 'wf-row', 'data-fica': '1' }, [
          mini,
          h('div', { class: 'wf-preview', 'data-fica': '1' }, `${guardada.nome} · ${tamanho} KB`),
        ])
      );
    }

    linhas.push(campoTexto(`${nome}: link da imagem (opcional, https)`, caminho, aoMudar));
    if (doDisco) {
      linhas.push(h('div', { class: 'wf-block', 'data-fica': '1' },
        'Isto é um caminho do computador, e nenhuma extensão pode usá-lo: preencher campo de arquivo ' +
          'a partir de um caminho é o que o navegador proíbe. Use o botão "Escolher imagem" aqui em ' +
          'cima — a janela do Windows abre a partir do seu clique, e a extensão guarda a imagem.'));
    }
    /**
     * **A extensão ainda NÃO manda a imagem**, e o campo dizer isso é a diferença entre um controle
     * que espera conserto e um que mente. Falta aprender o envio observando a plataforma fazer uma
     * vez — a mesma disciplina do contrato de escrita no CRM (`recorder.js`).
     */
    /**
     * **Aviso que não envelhece com o que já foi feito é aviso que mente** — e este mentia duas
     * vezes (01/10/2026). Ele dizia *"falta eu ligar o envio de verdade"* **com o envio já ligado**:
     * a cadeia foi escrita em 20/09 (`imagem.enviarImagem`), e `sendTemplate` manda a arte antes do
     * texto desde então. O texto velho era verdade por algumas horas e ficou na tela.
     *
     * O que continua verdadeiro é só o caso de NÃO haver envio aprendido, e é só ele que fica.
     */
    if ((ligada || semInterruptor) && guardada && !state.contratoImagem) {
      linhas.push(h('div', { class: 'wf-block', 'data-fica': '1' },
        'Guardada. Falta o passo de aprender o envio, com você mandando uma imagem à mão uma vez — ' +
          'até lá a extensão não tem como mandar a arte sozinha.'));
    }
    return linhas;
  }

  /**
   * **O botão que aprende o envio de imagem** — a extensão observa ELE mandando uma vez e copia o
   * formato, em vez de adivinhar a cadeia de upload (a mesma disciplina do contrato de escrita).
   *
   * Enquanto não houver contrato, a linha diz que a imagem não sai — controle que promete o que não
   * faz é pior que controle nenhum.
   */
  function aprenderEnvioDeImagemUI() {
    const contrato = state.contratoImagem;
    const gravando = !!state.esperando.imagem;
    const linhas = [];
    const btn = h('button', { class: 'wf-btn', type: 'button' },
      gravando
        ? 'Parar a gravação'
        : contrato
          ? 'Aprender de novo o envio de imagem'
          : 'Aprender envio de imagem');
    btn.addEventListener('click', () => (gravando ? pararDeAprenderImagem() : aprenderEnvioDeImagem()));
    linhas.push(h('div', { class: 'wf-row' }, [btn]));
    linhas.push(
      h('div', { class: contrato && !gravando ? 'wf-origin' : 'wf-block', 'data-fica': '1' },
        gravando
          ? 'Gravando. Mande UMA imagem com legenda à mão, pela plataforma, no seu contato de teste. ' +
            'O painel continua funcionando; se você não mandar, eu paro sozinho em 3 minutos.'
          : contrato
            ? `Envio aprendido em ${new Date(contrato.aprendidoEm).toLocaleString('pt-BR')}, ` +
              `${contrato.passos.length} passos. Me avise para eu ligar o envio automático.`
            : 'A extensão ainda não sabe mandar imagem. Clique aqui, mande UMA imagem com legenda à mão ' +
              'no contato de teste, e ela copia o formato. Nada é enviado para fora: fica no seu navegador.')
    );
    if (contrato && !gravando) linhas.push(...montarEnvioAprendido(contrato));
    return linhas;
  }

  /**
   * **O que foi gravado, em texto, para ele me mandar.**
   *
   * O contrato mora no armazenamento da extensão, na máquina dele — eu não o alcanço daqui, e é assim
   * que tem que ser. Para eu escrever o envio de verdade preciso LER os passos, então o caminho é o
   * mesmo das observações da rodada: um botão que copia e uma caixa que mostra, para ele decidir o que
   * sai do navegador dele.
   *
   * **O aviso é obrigatório:** os corpos gravados podem levar a legenda que ele digitou e o id do
   * contato. Por isso o aprendizado é no contato de TESTE, e a caixa diz isso de novo aqui.
   */
  function montarEnvioAprendido(contrato) {
    const texto = envioAprendidoEmTexto(contrato);
    const caixa = h('textarea', { rows: '6', class: 'wf-mono', readonly: 'readonly' });
    caixa.value = texto;
    caixa.style.display = 'none';

    const ver = h('button', { class: 'wf-btn wf-mini', type: 'button' }, 'Ver o que foi gravado');
    ver.addEventListener('click', () => {
      const escondido = caixa.style.display === 'none';
      caixa.style.display = escondido ? '' : 'none';
      ver.textContent = escondido ? 'Esconder' : 'Ver o que foi gravado';
    });

    const copiar = h('button', { class: 'wf-btn wf-mini', type: 'button' }, 'Copiar o envio aprendido');
    copiar.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(texto);
        setStatus('Copiado. Cole na conversa com o Claude para eu ligar o envio da imagem.', 'ok');
      } catch (_) {
        // Mesma saída das observações: recusada a área de transferência, o Ctrl+C dele resolve.
        caixa.style.display = '';
        ver.textContent = 'Esconder';
        caixa.select();
        setStatus('Não consegui copiar sozinho — o texto está selecionado, use Ctrl+C.', 'err');
      }
    });

    const testar = h('button', { class: 'wf-btn wf-mini', type: 'button' }, 'Mandar a imagem no contato aberto (teste)');
    testar.addEventListener('click', () => testarEnvioDeImagem());

    return [
      h('div', { class: 'wf-row' }, [copiar, ver]),
      h('div', { class: 'wf-origin' },
        'Isto é o formato que a plataforma usou, não a imagem. Pode levar a legenda que você digitou e ' +
          'o id do contato — foi por isso que o aprendizado foi no contato de teste.'),
      caixa,
      h('div', { class: 'wf-row' }, [testar]),
      h('div', { class: 'wf-origin' },
        'A sonda: manda a imagem do momento AGORA, no atendimento que estiver aberto, com a mensagem ' +
          'do momento como legenda. Use no seu contato de teste antes de deixar a rodada mandar.'),
    ];
  }

  /**
   * **A sonda do envio de imagem** — "toda escrita em massa precisa de sonda que relê".
   *
   * Aqui a sonda é ele mandando UMA, no contato de teste, antes de a rodada mandar para eleitor. Pede
   * confirmação com o nome do contato na frente, porque isto escreve em produção de verdade — e a
   * resposta diz o que mais importa saber: **a legenda foi junto da imagem ou não?**
   */
  async function testarEnvioDeImagem() {
    const arquivo = state.imagens?.imagemMomentoArquivo;
    if (!arquivo) return setStatus('Escolha primeiro a imagem da mensagem do momento.', 'err');
    if (!state.contact || !state.pageState.sessionId) {
      return setStatus('Abra um atendimento (o seu contato de teste) antes de testar.', 'err');
    }

    const bruto = String(state.auto?.cfg?.mensagemMomento || '').trim();
    const rendido = bruto ? vars.render(bruto, await currentVarContext()) : null;
    // Variável sem valor bloquearia o envio de verdade; no teste ela vira um texto próprio, para a
    // sonda medir o que ela existe para medir (a legenda chega junto?) e não a Config.
    const legenda = rendido && !rendido.missing.length ? rendido.text : 'Teste de envio de imagem pela extensão.';

    if (!confirm(
      `Mandar a imagem "${arquivo.nome}" AGORA para ${state.contact.name}?\n\n` +
        `A legenda será:\n${legenda.slice(0, 200)}\n\nIsto envia de verdade.`
    )) return setStatus('Teste cancelado.');

    return semTravarOPainel('imagem-teste', async () => {
      setStatus('Mandando a imagem…');
      const r = await page.enviarImagem({
        sessionId: state.pageState.sessionId,
        senderId: state.senderId,
        chave: perfisLib.chaveDeImagem('imagemMomentoArquivo', perfilAtivo()),
        legenda,
      });
      setStatus(
        r.legendaFoi
          ? 'Imagem enviada COM a legenda junto — é assim que vai sair na rodada.'
          : 'Imagem enviada, mas a plataforma não guardou a legenda: na rodada o texto sai como mensagem separada.',
        'ok'
      );
    });
  }

  /** Os passos gravados em texto corrido: é o que eu leio para escrever o envio. */
  function envioAprendidoEmTexto(contrato) {
    const cabeca = `Envio de imagem aprendido em ${contrato.aprendidoEm}, ${contrato.passos.length} passos.`;
    const corpo = contrato.passos
      .map((passo, i) =>
        [
          `--- passo ${i + 1}: ${passo.metodo} ${passo.url}`,
          `corpo: ${passo.corpo || '(vazio)'}`,
          `resposta: ${passo.resposta || '(nao capturada)'}`,
        ].join('\n')
      )
      .join('\n\n');
    return `${cabeca}\n\n${corpo}\n`;
  }

  /**
   * **Quem termina esta espera é ELE, na outra metade da tela** — por isso ela fica fora do `withBusy`
   * (ver `semTravarOPainel`) e tem botão de parar.
   *
   * A rodada é numerada porque parar e recomeçar em seguida deixaria o laço antigo vivo por até 2 s: ao
   * acabar, ele desligaria a gravação que a rodada NOVA acabou de ligar.
   */
  let rodadaDeImagem = 0;

  async function aprenderEnvioDeImagem() {
    const minha = (rodadaDeImagem += 1);
    return semTravarOPainel('imagem', async () => {
      setStatus('Gravando: mande UMA imagem com legenda pela plataforma, no seu contato de teste.');
      try {
        await page.aprenderImagemStart();
        // Espera em passos de 2 s, por até ~3 min — o mesmo prazo do gravador.
        for (let i = 0; i < 100 && rodadaDeImagem === minha; i += 1) {
          await new Promise((ok) => setTimeout(ok, 2000));
          if (rodadaDeImagem !== minha) return;
          const r = await page.aprenderImagemStatus();
          if (r?.status === 'done') {
            state.contratoImagem = r.contrato;
            setStatus(`Aprendi o envio em ${r.contrato.passos.length} passos.`, 'ok');
            return;
          }
          if (r?.status === 'error') {
            setStatus(r.error || 'não consegui aprender o envio', 'err');
            return;
          }
        }
        if (rodadaDeImagem === minha) {
          setStatus('Parei de gravar: não vi envio de imagem nenhum. Clique de novo quando for mandar.', 'err');
        }
      } finally {
        if (rodadaDeImagem === minha) await page.recorderStop().catch(() => {});
      }
    });
  }

  function pararDeAprenderImagem() {
    rodadaDeImagem += 1; // o laço em curso vê o número mudado e encerra sem desligar nada de ninguém
    state.esperando.imagem = false;
    page.recorderStop().catch(() => {});
    setStatus('Parei de gravar.');
    renderAll();
  }

  function campoTexto(rotulo, valor, onChange) {
    const input = h('input', { type: 'text', value: String(valor ?? '') });
    input.addEventListener('change', () => onChange(input.value));
    return h('label', { class: 'wf-field' }, [h('span', {}, rotulo), input]);
  }

  /** O limite e a pausa, lidos num lugar só: clamp esquecido num canto continua capando calado. */
  function limiteDaRodada(cfg) {
    return clampInt((cfg || state.auto.cfg).limite, 1, LIMITE_MAX);
  }
  function pausaDaRodada(cfg) {
    return clampInt((cfg || state.auto.cfg).pausaSeg, 0, PAUSA_MAX);
  }

  function campoNumero(rotulo, valor, onChange) {
    const input = h('input', { type: 'text', inputmode: 'numeric', value: String(valor) });
    input.addEventListener('change', () => onChange(input.value));
    return h('label', { class: 'wf-field' }, [h('span', {}, rotulo), input]);
  }

/**
 * **OS LIMITES DO RITMO SAIRAM, A PEDIDO DELE** (03/10/2026: *"o disparo está com um limitador que
 * não deixa botar abaixo de 3 segundos e 200 contatos, tire esses limites"*).
 *
 * **O que eles protegiam, medido, para ficar registrado o que ele passou a carregar:**
 *
 *  - **a pausa de 3 s** protegia a API da plataforma e o número. Cada contato do disparo por
 *    etiqueta custa ~8 requisições (abrir + cinco do envio de imagem + etiqueta + concluir), e
 *    `Failed to fetch` aqui **não é erro de HTTP: é o preflight CORS recusado pelo limitador de
 *    taxa** — a rodada que estourou em 24/09 fez 444 requisições. Do lado do WhatsApp, o que pune é
 *    o RITMO e a REPETIÇÃO: menos de dez mensagens iguais em sequência já derrubaram um número dele
 *    (26/09).
 *  - **o teto de 200 contatos** era o `pageSize` do filtro de contatos — acima disso a lista nem
 *    vinha — e, de quebra, o teto de estrago de uma rodada só.
 *
 * **Os dois viraram AVISO em vez de trava**, e o que continua barrando é o que barra de verdade: o
 * teto por número por dia (que ele também escolhe), a barreira do canal caído e o botão Parar. Os
 * tetos abaixo existem só para um dedo escorregado não virar uma rodada de um milhão.
 */
const LIMITE_MAX = 10000;
const PAUSA_MAX = 3600;
const PAUSA_PADRAO = 8;
/** Quantos contatos a lista do filtro traz por requisição. Paginar é o que tirou o teto de 200. */
const CONTATOS_POR_PAGINA = 200;

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

  /**
   * **O número deste atendimento ainda existe na conta?** A resposta vem da API, e não da tela: a
   * tarja do cabeçalho diz *"desconectado"*, que é outra coisa — **número removido pode não gerar
   * tarja nenhuma**, e aí a rodada seguiria tentando enviar por um canal que não existe.
   *
   * **Uma requisição por RODADA, nunca por contato.** A lista é guardada com a hora da leitura e
   * vale por `FRESCOR_DOS_CANAIS_MS`; relida, ela também atualiza `state.canais`, então a tela
   * ganha o estado novo de graça. Uma leitura por contato seria uma requisição a mais em cada um,
   * e é número de requisição que derruba esta API.
   *
   * **Lista velha não decide conclusão.** Concluir tira a pessoa da fila; decidir isso com uma
   * leitura de uma hora atrás faria um canal criado nesse meio-tempo parecer removido.
   */
  const FRESCOR_DOS_CANAIS_MS = 5 * 60 * 1000;
  let canaisLidosEm = 0;

  async function canaisFrescos() {
    if (state.canais?.length && Date.now() - canaisLidosEm < FRESCOR_DOS_CANAIS_MS) return state.canais;
    try {
      const canais = await api.canaisDaConta();
      if (Array.isArray(canais)) {
        state.canais = canais;
        canaisLidosEm = Date.now();
        return canais;
      }
    } catch (err) {
      console.warn('[WhatsFill] não consegui ler os números da conta:', err.message);
    }
    return null; // não é "a conta está vazia": é "não deu para ler"
  }

  /** `{motivo}` quando o número deste atendimento sumiu da conta; `null` nos outros dois estados. */
  async function canalDesteAtendimentoRemovido() {
    const veredito = loteLib.canalSumiuDaConta({
      canalId: state.session?.channelId,
      canais: await canaisFrescos(),
    });
    return veredito.estado === 'removido' ? veredito : null;
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

      linha.append(h('div', { class: 'wf-origin', 'data-fica': '1' }, `${sug.origem}: ${sug.motivo}`));
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
        h('div', { class: 'wf-origin', 'data-fica': '1' }, `${rotulo}${entry.source ? ` — de “${truncate(entry.source, 50)}”` : ''}`)
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
      if (e?.from !== 'palpite') return false;
      if (e.confidence === 'exata') return true;
      // "IA pega a cidade sozinha": a cidade aproximada também abre a gravação, e a IA decide dentro dela.
      return f.name === 'Cidade' && e.confidence === 'aproximada' && !!state.ia?.cidadeSozinha && state.iaTemChave;
    });
    const temEtiqueta = state.tagSuggestions.some((s) => s.marcada && s.tag && etiquetaConfiavel(s));

    // A data de conclusão entra junto com o resto, e não só no Salvar manual. A regra está em
    // fields.deveGravarPrimeiroContato, separada para poder ser testada.
    const faltaData = fieldsLib.deveGravarPrimeiroContato({
      dataAtual: dataDeConclusaoAtual(),
      primeiroContato: primeiroContatoDoContato(),
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

  /** O que está gravado hoje no campo da data, do jeito que veio. Vazio devolve `''`. */
  function dataDeConclusaoAtual() {
    const campo = state.schema.find((f) => f.name === fieldsLib.COMPLETION_FIELD);
    if (!campo) return '';
    const entry = state.draft[campo.id];
    return entry && entry.value != null ? String(entry.value) : '';
  }

  /**
   * **A primeira vez que esta pessoa entrou em contato.**
   *
   * Três fontes, e a mais antiga ganha: a criação do contato no CRM (preenchida em 100% da base
   * medida, e em 98% dela é a própria chegada da pessoa), as mensagens desta sessão, e as da
   * sessão anterior **quando ela já estiver carregada**.
   *
   * **A anterior não é buscada por causa disto, de propósito:** ela custa duas requisições e só é
   * lida quando falta cidade (a regra de 07/09). Pedi-la aqui poria duas requisições a mais em
   * todo contato aberto, e é número de requisição que derruba esta API. Quando ela estiver na
   * mão, entra de graça.
   *
   * **O campo `createdAt` do contato nunca foi lido ao vivo neste projeto** — ele aparece na
   * exportação como "Data de cadastro". Não vindo, as mensagens resolvem sozinhas, e o cabeçalho
   * diz de onde a data saiu.
   */
  function primeiroContatoDoContato() {
    const momentos = [];
    for (const m of state.entrantes || []) if (m?.at) momentos.push(m.at);
    for (const m of state.conversaAnterior?.entrantes || []) if (m?.at) momentos.push(m.at);
    return fieldsLib.primeiroContato({
      criadoEm: state.contact?.createdAt || state.contact?.createdat || null,
      momentos,
    });
  }

  /** De onde a data saiu — para o cabeçalho dizer, em vez de o número aparecer do nada. */
  function origemDoPrimeiroContato() {
    const dia = primeiroContatoDoContato();
    if (!dia) return null;
    const doCadastro = fieldsLib.diaLocalDe(state.contact?.createdAt || state.contact?.createdat);
    if (doCadastro && doCadastro === dia) return 'cadastro do contato';
    return state.conversaAnterior ? 'mensagem mais antiga (com a conversa anterior)' : 'mensagem mais antiga desta conversa';
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

    // Quem decide o que entra é `fields.deveGravarEntrada` — inclusive a guarda do `pendente`,
    // que faltava aqui e por onde um palpite de cidade chegou ao CRM sem ninguém confirmar.
    const changes = {};
    const limpando = [];
    for (const field of state.classify) {
      const entry = state.draft[field.id];
      if (!fieldsLib.deveGravarEntrada(entry, { somenteExatos })) continue;
      changes[field.id] = entry.value;
      if (entry.limpar) limpando.push(`${field.name} ("${entry.limpando}")`);
    }
    /**
     * A limpeza é a única escrita que APAGA, então ela é dita — na tela e no Andamento. Escrita
     * destrutiva silenciosa é o que faria ele descobrir pela ausência do dado.
     */
    if (limpando.length && state.auto?.rodando) {
      registrarNaRodada(
        state.contact?.name || 'contato',
        'aviso',
        `apagando do CRM: ${limpando.join(', ')} — não é nome de lugar`
      );
    }

    /**
     * O campo guarda o PRIMEIRO CONTATO desde 07/10/2026, e **só anda para trás** — reabrir a
     * conversa não empurra nada para frente, e uma data mais antiga que apareça corrige a que
     * está lá. A regra inteira mora em `fields.deveGravarPrimeiroContato`, e é a MESMA que a
     * gravação automática consulta antes de decidir chamar isto aqui: duas cópias divergiriam na
     * primeira correção.
     */
    if (withCompletionDate) {
      const completion = state.schema.find((f) => f.name === fieldsLib.COMPLETION_FIELD);
      const primeiro = primeiroContatoDoContato();
      const corrigindo = fieldsLib.diaLocalDe(dataDeConclusaoAtual());
      /**
       * **As âncoras vão satisfeitas aqui de propósito, e isso não é desligar a guarda.** Ela
       * existe para a gravação AUTOMÁTICA, que abre contato sozinha: `faltaData` a consulta de
       * verdade antes de chamar. Quem chega até aqui passou `withCompletionDate: true` — é o
       * Salvar dele, ou uma conclusão —, e nesses casos a decisão já foi tomada por gente. Era
       * assim antes também: o código velho carimbava direto quando o campo estava vazio.
       */
      const pedidoExplicito = { temExato: true, temEtiqueta: true, temCidade: true };
      if (
        completion &&
        fieldsLib.deveGravarPrimeiroContato({
          dataAtual: dataDeConclusaoAtual(),
          primeiroContato: primeiro,
          ...pedidoExplicito,
        })
      ) {
        changes[completion.id] = primeiro;
        // Corrigir é diferente de preencher, e quem olha o Andamento precisa ver a diferença:
        // uma data que MUDOU é a única escrita aqui que reescreve dado que já estava no CRM.
        if (corrigindo && state.auto?.rodando) {
          registrarNaRodada(
            state.contact?.name || 'contato',
            'aviso',
            `corrigindo a data: ${corrigindo} → ${primeiro} (${origemDoPrimeiroContato()})`
          );
        }
      }
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
    /**
     * **Vazio esperado, vazio no CRM: gravou.**
     *
     * `doCrm == null` devolvia `false` antes desta linha, e a limpeza da cidade escreve `''` — o
     * campo apagado volta do CRM como ausente ou vazio, e a conferência acusaria
     * *"a API aceitou mas não gravou"* justamente quando funcionou. Alarme falso na única escrita
     * que apaga dado é o pior lugar possível para um.
     */
    const vazio = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);
    if (vazio(esperado)) return vazio(doCrm);

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
        h('div', { class: 'wf-origin', 'data-fica': '1' }, comPrefixo.slice(0, 10).map((x) => `${x.de} → ${x.para}`).join(' · ')),
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
          h('div', { class: 'wf-origin', 'data-fica': '1' }, exemplos.join(' · ')),
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
      // Log é dado: nunca vai para "detalhes" (ver o log do Automatizado, 10/09).
      body.append(h('div', { class: linha.erro ? 'wf-block' : 'wf-origin', 'data-fica': '1' }, linha.texto));
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
  /**
   * **A marca que vai junto da transcrição, e ela diz DE ONDE aquilo veio.**
   *
   * `(áudio, transcrito automaticamente)` existe desde 03/09: transcrição erra palavra, e a IA
   * precisa saber que não é o que a pessoa escreveu.
   *
   * A segunda marca é da print da Irene (07/09/2026): cinco áudios de outra conversa chegaram em
   * dois segundos e a IA respondeu uma pergunta que estava dentro de um deles. **Sem dizer que é
   * encaminhado, a transcrição chega indistinguível da fala dela** — e ler o conteúdo é
   * exatamente o que a IA deve fazer com o que ela disse, e não com o que ela repassou.
   */
  /**
   * **A NATUREZA da mensagem, escrita para a IA ler.**
   *
   * A IA recebe texto; tudo o que o painel sabe sobre uma mensagem e não escrever aqui, ela não
   * sabe. São três coisas hoje, e as três nasceram de uma print:
   *
   *  - **áudio transcrito** (31/08): sem a marca, a IA discute a redação de uma fala que ninguém
   *    digitou;
   *  - **áudio ENCAMINHADO** (a Irene, 07/09): cinco áudios de outra conversa chegaram em dois
   *    segundos e a IA respondeu o que estava DENTRO deles;
   *  - **texto do ANÚNCIO** (08/09) — ver abaixo.
   *
   * **O anúncio era o buraco.** `prepararEntrantes` marca `geradaPeloAnuncio` desde 04/09 e **todo
   * detector determinístico respeita a marca** (foi ela que impediu o agradecimento pelo apoio de
   * sair para quem só clicou num botão), mas os dois montadores de mensagem para a IA jogavam a
   * marca fora: o texto pré-preenchido pelo Facebook chegava como fala dela, sem distinção. Pior,
   * o pedido do EIXO manda responder *"a mais recente que pede ou pergunta alguma coisa"* — com
   * "bom dia" contando como cortesia, o eixo caía no **texto do anúncio**, e a resposta inteira
   * era construída em cima de uma frase que a campanha escreveu.
   *
   * **O NOME do anúncio entra junto, e só na mensagem que dá para nomear.** A identidade vem do
   * `utm` da SESSÃO, então ela vale para o clique que abriu a sessão (`anuncioDaSessao`) — o
   * segundo e o terceiro clique são reconhecidos pela forma do texto e podem ser de outro anúncio
   * (a Irene, 05/09, clicou em três). Nomear todos com o mesmo rótulo seria inventar.
   */
  function marcaDaMensagem(m, texto, nomeDoAnuncio = '') {
    if (m?.geradaPeloAnuncio) {
      const qual = m?.anuncioDaSessao && nomeDoAnuncio ? ` "${nomeDoAnuncio}"` : '';
      return `(texto do ANÚNCIO${qual} em que ela clicou — escrito pela campanha, não por ela) ${texto}`;
    }
    if (m?.encaminhado) return `(áudio ENCAMINHADO de outra conversa, transcrito automaticamente — não é fala dela e não é dirigido a nós) ${texto}`;
    return m?.transcrito ? `(áudio, transcrito automaticamente) ${texto}` : texto;
  }

  /**
   * Como o anúncio desta sessão se chama, para a IA.
   *
   * A ordem é do mais específico para o mais genérico: o **nome que ELE cadastrou** na Config diz o
   * que aquele anúncio é; o `headline` é a promessa que a pessoa leu antes de clicar; o `campaign`
   * é o nome interno. Nenhum dos três existindo, a mensagem sai marcada sem nome — que continua
   * sendo melhor que sair como fala dela.
   */
  function nomeDoAnuncioDaSessao() {
    const bruto = String(
      state.anuncio?.anuncio?.nome ||
        state.session?.utm?.headline ||
        state.session?.utm?.campaign ||
        ''
    ).trim();
    /**
     * **O nome tem que ser um NOME, e o `headline` do Facebook é um parágrafo** — print da Leonir
     * (12/09/2026). Ela clicou num anúncio e mandou um áudio; o rascunho abriu agradecendo *"o seu
     * apoio ao Flávio, ao Zucco e ao Capitão Martim"*, apoio que ela nunca declarou. Pergunta dele:
     * *"vou ter que listar pra IA as frases específicas que são de anúncio?"*
     *
     * **Medido: a marca funcionava e o nome tinha 277 caracteres.** O `headline` daquele anúncio é
     * *"Sou o candidato a deputado estadual de Flávio Bolsonaro… Tenho orgulho de contar com esse
     * apoio… Vote Capitão Martim, deputado estadual. 10122"* — e ele entrava INTEIRO dentro da marca,
     * no meio da linha da conversa. A linha que existe para dizer *"isto não é fala dela"* passou a
     * injetar a peça de campanha no lugar onde a IA lê o que a pessoa disse, com a palavra "apoio"
     * duas vezes. **Marca que carrega o texto que ela deveria ignorar não avisa: abastece.**
     *
     * O corte é de tamanho porque o nome serve a uma coisa só — dizer QUAL anúncio. Ele continua
     * vindo do que ele cadastrou na Config quando existe, que é sempre curto. A conta mora em
     * `ia.nomeCurtoDeAnuncio`, que é pura e tem teste — aqui nenhuma suíte alcança.
     */
    return iaLib.nomeCurtoDeAnuncio(bruto);
  }

  function mensagensParaIA() {
    const doAnuncio = nomeDoAnuncioDaSessao();
    return (state.entrantes || [])
      .map((m) => {
        const texto = String(m?.texto || '').trim();
        if (!texto) return null;
        // `{texto, at}` e não string solta: o QUANDO de cada mensagem é metade do relógio — a
        // outra metade é o "agora", que `montarContato` escreve no topo do bloco.
        return { texto: marcaDaMensagem(m, texto, doAnuncio), at: m?.at || null };
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
    const doAnuncio = nomeDoAnuncioDaSessao();
    const dela = (state.entrantes || []).map((m, i) => ({
      de: 'contato',
      /**
       * **Mídia sem texto vira LINHA, em vez de sumir** — pedido dele (16/09/2026). Até aqui o
       * `filter` do fim tirava figura, vídeo, documento e áudio sem transcrição: quem mandava uma
       * foto e escrevia *"olha isso"* chegava à IA só com o *"olha isso"*. `iaLib.marcaDeMidia` é a
       * linha, e ela é pura e testada.
       */
      texto: marcaDaMensagem(m, String(m?.texto || ''), doAnuncio) || iaLib.marcaDeMidia(m),
      semConteudo: !String(m?.texto || '').trim() && !!iaLib.marcaDeMidia(m),
      // Figura/vídeo COM legenda: a legenda chega como texto, e sem esta marca a IA não sabe que houve
      // mídia — e pergunta o que é (22/09/2026).
      midia: ['IMAGE', 'VIDEO', 'STICKER', 'DOCUMENT'].includes(String(m?.tipo || '').toUpperCase()),
      at: m?.at || null,
      // `anuncio` NÃO é decoração: é o que tira o clique da CONTAGEM de mensagens sem resposta.
      // Sem ele, "ela escreveu 2 mensagens" conta uma que ela não escreveu.
      anuncio: !!m?.geradaPeloAnuncio,
      // E `transcrito` liga a regra do ÁUDIO no fim do bloco: a palavra "transcrição" é máquina
      // nossa e não pode sair no rascunho (print do Jose Carlos, 12/09/2026).
      transcrito: !!m?.transcrito,
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
      /**
       * **`transcrito` e `semConteudo` PASSAM** (16/09/2026). Este `map` jogava `transcrito` fora, e
       * por isso a regra do áudio colada no pedido (*"para ela, nós OUVIMOS"*, 3.51) **nunca foi
       * ligada**: `montarContatoRascunho` pergunta `m.transcrito` e recebia sempre `undefined`. Achado
       * lendo o código para responder *"o que a IA vê"*. É a lição do `conversaPedeRespostaPessoal`
       * que passava só o tipo: função testada não garante nada se quem chama filtrar os campos que ela
       * lê — e aqui o filtro estava no ÚLTIMO passo, depois de o campo ter sido montado.
       */
      .map(({ de, texto, at, anuncio, transcrito, semConteudo, midia }) => ({ de, texto, at, anuncio, transcrito, semConteudo, midia }));
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

    /**
     * **O que FALTA tem que ser pedido** — print dele (05/09/2026): o rascunho respondeu bem o
     * policial militar da reserva e não pediu nada. *"faltou detalhes, não pediu dados"*. O prompt
     * dizia o que NÃO pedir, e nada dizia o que pedir.
     *
     * A conta é a MESMA que guarda o formulário da rodada (`pedirDadosNaoCabe`), lida dos sinais
     * deste contato: duas definições divergiriam, e a que ninguém olha é a que pede o cadastro de
     * quem já o deu. Sem sinais (rascunho pedido fora da rodada), não pede — o lado seguro.
     *
     * **E não se fecha uma NEGATIVA com o formulário** (`casoDeNegativa`, 12/09/2026): quem acabou
     * de ouvir que não podemos dar dinheiro nem contratar não vai entender um "me diga seu nome e
     * cidade" no fim. Está lá e não aqui porque é conta pura e tem teste.
     */
    const pedirDadosNoRascunho =
      !!state.sinais &&
      !sugestaoLib.pedirDadosNaoCabe(state.sinais) &&
      !sugestaoLib.casoDeNegativa(state.sinais);

    /**
     * **O ATENDIMENTO ANTERIOR vai para a IA** — pedido dele (16/09/2026): *"creio que o fluxo está
     * barrando ela de ler o contexto"*. Medido, não era o fluxo: era a SESSÃO. Quem volta sozinho
     * abre atendimento novo, e a IA via só o de hoje.
     *
     * **As guardas de custo são as de 07/09:** só quando o botão "Ver conversa anterior" está na
     * tela (custa zero rede), **uma** sessão, e reaproveita o que o `load()` já buscou para a cidade.
     * A busca é aqui, no momento em que a IA vai escrever (~5% dos contatos), e não em todo contato
     * aberto — rajada de requisição já derrubou a API e a plataforma junto.
     *
     * **Não entra em `state.entrantes`**: aquele é a memória desta sessão, e a rajada, o tempo e o
     * "já respondemos" decidem sobre ele. Vai só para o prompt, num bloco separado que diz que nada
     * ali espera resposta. Falhar a busca não impede o rascunho.
     */
    if (!state.conversaAnterior && state.temConversaAnterior && state.pageState?.sessionId) {
      try {
        state.conversaAnterior = (await api.getConversaAnterior(state.pageState.sessionId)) || null;
      } catch {
        state.conversaAnterior = null;
      }
    }
    const anteriorParaIA = (() => {
      const c = state.conversaAnterior;
      if (!c) return [];
      const dela = (c.entrantes || [])
        .filter((m) => !ehMensagemDaPlataforma(m?.texto))
        .map((m) => ({ de: 'contato', texto: String(m?.texto || '') || iaLib.marcaDeMidia(m), at: m?.at || null }));
      const nossa = (c.nossas || []).map((m) => ({ de: 'nos', texto: String(m?.texto || ''), at: m?.at || null }));
      return [...dela, ...nossa]
        .filter((m) => m.texto.trim())
        .sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
    })();

    // `async` é obrigatório: há `await` no meio dos argumentos (o dossiê e a chapa saem de funções).
    const chamarIA = async () =>
      iaCliente.rascunhar({
        templates: state.templates,
        regras: state.ia.regras,
        gabinete: await gabineteLib.paraOPrompt(dela, { perfil: state.perfil }),
        modelo: modeloDoRascunho(),
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
        pedirDados: pedirDadosNoRascunho,
        /**
         * **A chapa, para a trava de cargo e número** — print da Nara (08/09/2026).
         *
         * Vem do dossiê, que é a fonte, e **não passa por `dossieAtivo`**: a tabela pode não estar
         * no prompt e o modelo escrever os nomes do mesmo jeito, do saber dele — que foi o que
         * aconteceu. Ver `ia.conferirChapa`.
         */
        chapa: await gabineteLib.chapa(),
        /**
         * **O sinal que diz se ela pediu material de CAMPANHA** — print da Cleo (08/09/2026).
         *
         * Liga a trava `enderecoSemMaterial`: o rascunho não pode pedir endereço de entrega a quem
         * pediu um bem que teria de ser comprado. `false` explícito e não `undefined` — a trava
         * distingue "ela não pediu" de "ninguém mediu", e fora da rodada não há sinais.
         */
        // `state.sinais.pedeMaterial` nunca existiu (18/09/2026, a Rita): o pedido é lido da conversa.
        pedeMaterial: state.sinais ? !!pedeMaterial(state.entrantes) : undefined,
        /**
         * **Sessão nova não é pessoa nova** (10/09/2026): sem isto o prompt dizia "é a primeira coisa
         * que o atendimento diz a esta pessoa" a quem tem cidade no CRM, e o rascunho se apresentava.
         * É o `jaRespondemosAntes` da rodada; fora dela, o botão "Ver conversa anterior".
         */
        jaNosConhece: !!(state.sinais?.jaRespondemosAntes || state.temConversaAnterior),
        anterior: anteriorParaIA,
        /**
         * **O CANDIDATO desta conversa** — 24/09/2026. Sai do canal do atendimento, e é ele que dá
         * o nome que a IA escreve. Nulo (sem atendimento aberto) é o de fábrica, então o rascunho
         * pedido à mão continua como sempre foi.
         */
        candidato: state.perfil || null,
      });

    let rascunho;
    try {
      rascunho = await chamarIA();
    } catch (err) {
      return { ok: false, enviado: false, motivo: `falha ao rascunhar: ${err?.message || err}` };
    }

    /**
     * **O que a IA leu fica à mão** — pergunta dele (16/09/2026): *"qual a visão da IA sobre a
     * conversa, o que ela tem acesso e o que não tem"*. Guardado ANTES de olhar se deu certo: quando
     * a chamada falha é que ele mais precisa ver o que foi pedido. Só em memória (tem dado de
     * eleitor), e zerado no `load()` — mostrar o prompt de um contato na tela de outro é a armadilha
     * da pergunta de cidade.
     */
    state.lidoPelaIA = rascunho?.lidoPelaIA || null;

    /**
     * **O CUSTO mudou de caminho junto com a IA** (06/09/2026).
     *
     * Ele era escrito dentro de `avaliarComIA`, que sumiu quando a IA deixou de escolher resposta
     * pronta. Sem trazer estas linhas para cá, o painel ficaria **sem número nenhum de gasto** —
     * e a regra deste projeto sobre dinheiro é a mesma desde 29/08: sem número na tela, *"quanto
     * isso está custando"* vira palpite, e foi palpite que quase manteve a IA fora daqui.
     *
     * O `vaiCachear` estima com o prompt do RASCUNHO, que é o que saiu — estimar com o da decisão
     * (que não existe mais) faria a tela dizer "SEM CACHE" sobre um prompt que ninguém mandou.
     */
    const logarCusto = async (r, marca = 'rascunho') => {
      if (!r?.custo) return;
      const c = r.custo;
      // "SEM CACHE" só é alarme onde o cache PODERIA ter pego. No Haiku 4.5 o prompt não alcança
      // o mínimo de 4.096 tokens, então o zero é o normal — e alarme que toca sempre se aprende
      // a ignorar.
      const podia = iaLib.vaiCachear(
        modeloDoRascunho(),
        iaLib.tokensAproximados(
          iaLib.montarSistemaRascunho({
            templates: state.templates,
            regras: state.ia.regras,
            gabinete: await gabineteLib.paraOPrompt(dela, { perfil: state.perfil }),
          })
        )
      );
      const cacheOk = c.cacheLido > 0 ? `cache ${c.cacheLido}` : podia ? 'SEM CACHE' : 'sem cache (esperado)';
      const usd = r.custoUsd ? ` · US$ ${r.custoUsd.toFixed(4)}` : '';
      const mes = r.gastoMes ? ` · mês US$ ${(r.gastoMes.usd || 0).toFixed(2)}` : '';
      /**
       * **QUEM atendeu, sempre — e POR QUE, quando não foi o titular.**
       *
       * Pedido dele (08/09/2026), com a print em que o log dizia só *"RESERVA: claude-haiku-4-5"*:
       * *"preciso saber o porquê que a IA do ChatGPT não mandou mensagem antes de ir pro failsafe,
       * tem que ficar distinto qual está mandando"*. Duas coisas faltavam, e as duas são desta
       * linha:
       *
       *  1. **o motivo do titular existia e era jogado fora.** O `background.js` já o punha em
       *     `motivoDoTitular`; `ia-cliente` não o repassava. É a família do log que mentia e do
       *     *"a IA não escreveu nada"* que escondia a causa: **mensagem que descreve o sintoma
       *     esconde a causa**, e a causa estava a um campo de distância.
       *  2. **o modelo só aparecia quando falhava.** Dando certo, a linha não dizia quem tinha
       *     atendido — e com duas casas configuradas *"qual está mandando"* vira adivinhação.
       */
      const titular = modeloDoRascunho();
      const quem = r.usouReserva
        ? ` · RESERVA ${r.usouReserva} (o titular ${titular} falhou: ${r.motivoDoTitular || 'sem motivo'})`
        : ` · ${titular}`;
      registrarNaRodada('IA', 'pulado', `${marca} · ${cacheOk} · entrada ${c.entrada} · saída ${c.saida}${usd}${mes}${quem}`);
    };
    await logarCusto(rascunho);

    /**
     * **A IA PODE DIZER QUE NÃO HÁ O QUE RESPONDER** — regra dele, 24/09/2026, com a print de uma
     * contato que chegou pelo anúncio e escreveu só *"As outras de Venâncio Aires capital do
     * chimarrão"*: *"não fez sentido nenhum o que a pessoa falou, não tem contexto e a IA tentou
     * arrumar uma resposta; quando for o caso, mandar a mensagem do momento"*.
     *
     * **Medido antes de mexer:** dos dezesseis detectores, só `falouAlgoProprio` casou — e ele é a
     * INVERSÃO (tudo o que não é cortesia, reação, apoio, despedida ou o texto do anúncio é fala
     * dela), então cinco palavras de conteúdo bastaram para o caso subir à tecla 6. Com o sinal
     * desligado o quadro decide `contexto-de-outro-dia`, **tecla 5 — a mensagem do momento**, que é
     * exatamente o desfecho que ele pediu.
     *
     * **Por que a decisão é da IA e não de um detector:** "isto faz sentido?" é JULGAMENTO, e a lista
     * de frases sem contexto não fecha — pior, ela erraria na direção cara, apagando a fala de quem
     * falou de verdade. A única coisa na cadeia que lê a conversa inteira é quem escreve o rascunho.
     * É a mesma razão de `precisaDeRevisao` existir: **é barato perguntar.**
     *
     * **A guarda é mecânica e é uma só: PERGUNTA PENDENTE.** É o sinal criado em 04/09 para dizer o
     * que ainda não foi respondido, e é o falso positivo caro desta trava — a mensagem do momento
     * CONCLUI, e concluir em cima de uma pergunta é o defeito que ele reportou três vezes. Lida da
     * conversa e não de `state.sinais`, porque o rascunho também é pedido fora da rodada (a tecla 8,
     * o cartão da aba Respostas), e ali os sinais não existem.
     *
     * **Nada vai para o campo de mensagem**: pôr um texto que a própria IA disse não valer seria
     * devolver o problema com mais um passo.
     */
    if (rascunho?.naoHaOQueResponder) {
      const pendente = perguntaPendente(state.entrantes, state.nossaUltimaAt, state.padroesDeAnuncio);
      if (!pendente) {
        registrarNaRodada(
          state.contact?.name || 'contato',
          'aviso',
          'a IA leu e não achou o que responder: a fala dela não pede nada e não diz a que se refere'
        );
        return {
          ok: false,
          enviado: false,
          naoHaOQueResponder: true,
          motivo: 'a IA não achou o que responder — mande a mensagem do momento (tecla 5)',
        };
      }
      registrarNaRodada(
        state.contact?.name || 'contato',
        'aviso',
        'a IA disse que não há o que responder, mas há PERGUNTA PENDENTE na conversa — mantive o rascunho'
      );
    }

    const bruto = String(rascunho?.texto || '').trim();
    if (!bruto) {
      /**
       * **O MOTIVO DE VERDADE vem em `avisos`, e esta linha o jogava fora.**
       *
       * Print dele (07/09/2026), perguntando *"qual foi o erro?"* sobre a caixa que dizia
       * *"a IA não conseguiu rascunhar (a IA não escreveu nada)"* — uma frase que **descreve o
       * sintoma e esconde a causa**. Do outro lado, `iaCliente.rascunhar` devolve
       * `{ texto: '', avisos: [motivo] }` em toda falha, e ali estava escrito o que aconteceu:
       * teto de gasto atingido, chave recusada, conta sem crédito, resposta ilegível, sem rede.
       * Nada disso chegava à tela nem ao Andamento.
       *
       * É a família do log que mentia (a cidade *"não gravada"* que era gravada, 03/09) e do aviso
       * que mandava procurar o interruptor na aba errada: **mensagem de erro que não diz o que
       * fazer custa uma sessão de diagnóstico**, e esta custou a dele.
       *
       * Note que o caminho do SUCESSO já mostrava os avisos (o `barrado` da caixa da rodada junta
       * todos) — só o da falha não. Guarda para o futuro: quando uma função devolve motivo em dois
       * campos, quem chama tem que ler os dois.
       */
      const porque = (rascunho?.avisos || []).map((a) => String(a || '').trim()).filter(Boolean).join('; ');
      // O modelo entra no motivo pelo mesmo pedido de 08/09: com duas casas configuradas, "a IA
      // falhou" não diz QUAL falhou — e é o que decide se o problema é a chave, o crédito ou a rota.
      const casa = modeloDoRascunho();
      return { ok: false, enviado: false, motivo: `${casa}: ${porque || 'a IA não escreveu nada e não disse por quê'}` };
    }

    /**
     * **Os avisos vêm de quem já revisou** — e este era o defeito, desde 04/09/2026.
     *
     * `iaCliente.rascunhar` chama `validarRascunho`, que chama `revisarRascunho` com o texto e o
     * relógio: o que volta em `rascunho.texto` **já está corrigido** (a saudação trocada, o traço
     * eme virado hífen) e `rascunho.avisos` já traz o que ele precisa ler. O painel jogava os dois
     * fora e chamava `revisarRascunho(rascunho)` de novo — com o OBJETO, que vira
     * `[object Object]`. Nenhum aviso jamais apareceu, e a revisão foi feita duas vezes.
     */
    /**
     * **UM rascunho, e o treino saiu** — pedido dele (18/09/2026): *"o sistema de treino ficou
     * irrelevante, estou gastando tokens e as respostas não variam de verdade; retire o treino, a IA
     * terá que ser refinada de outra forma"*. Saíram as três opções, a janela de escolha, a refeita
     * das opções iguais, os perfis e as lições medidas. Ver o `registro.md` da v3.82.
     */
    const escolhida = (rascunho?.opcoes || [])[0] || { texto: bruto, avisos: rascunho?.avisos || [] };

    const avisos = [...(escolhida?.avisos || [])];
    let texto = String(escolhida?.texto || bruto);

    /**
     * **O PISO do pedido de dados.** O prompt manda copiar o bloco; se a IA não copiar, o painel o
     * acrescenta — e o texto é o mesmo (`ia.PEDIDO_DE_DADOS_NO_RASCUNHO`), porque o que está em jogo
     * é o INVARIANTE `Nome , Cidade`: sem ele a rodada não enxerga que o pedido saiu e pede de novo
     * na passada seguinte. Acrescentar TEXTO NOSSO, fixo e já revisado, é diferente de escrever no
     * lugar da IA — que continua sendo o motivo de a saudação ausente não ser inventada.
     */
    /**
     * **A IA pode dizer que o formulário não cabe** — decisão dele de 24/09/2026, com a print da
     * contato de Minas Gerais que se despediu e recebeu `Nome , Cidade` no fim. As três travas que
     * existiam respondem *"já temos o cadastro?"*; esta responde *"cabe pedir agora?"*, que é
     * julgamento — e quem julga é quem leu a conversa. Ver a EXCEÇÃO no bloco do contato.
     *
     * **Marcando, o PISO se cala E o bloco literal sai**, caso ela o tenha escrito mesmo assim: o
     * texto é ditado por nós palavra por palavra, então tirá-lo é mecânico (`ia.semOFormulario`) e
     * não é reescrever no lugar dela. Paráfrase continua passando, de propósito.
     */
    if (escolhida?.naoCabePedirOCadastro) {
      const limpo = iaLib.semOFormulario(texto);
      if (limpo !== texto) {
        texto = limpo;
        avisos.push('a IA disse que o cadastro não cabe aqui — tirei o formulário do fim');
      }
    } else if (pedirDadosNoRascunho && !templatesLib.ehPedidoDeDados(texto)) {
      texto = [texto, '', iaLib.PEDIDO_DE_DADOS_NO_RASCUNHO].join('\n');
      avisos.push('a IA não pediu o cadastro — acrescentei o formulário no fim');
    }

    // `setComposerText`, NUNCA `sendText`: a diferença entre as duas é a decisão dele.
    try {
      await page.setComposerText(texto);
    } catch (err) {
      return { ok: false, enviado: false, motivo: `não consegui pôr o rascunho no campo: ${err?.message || err}` };
    }

    registrarNaRodada(
      state.contact?.name || 'contato',
      'refinar',
      `rascunho da IA no campo de mensagem, para você mandar${avisos.length ? ` — confira: ${avisos.join('; ')}` : ''}`
    );
    // `texto` e `avisos` existem para o cartão da aba Respostas MOSTRAR o que foi para o campo.
    // A rodada só olha `ok`/`motivo`, e continua funcionando igual.
    return { ok: true, enviado: false, motivo: 'rascunho pronto no campo de mensagem', texto, avisos };
  }


  /**
   * **O que a IA leu, em duas partes** — pergunta dele (16/09/2026): *"qual a visão da IA sobre a
   * conversa, o que ela tem acesso e o que não tem"*.
   *
   * A parte do CONTATO vai literal, porque é ela que muda de caso para caso e é nela que se vê o que
   * chegou e o que não chegou (figura sem texto, por exemplo, simplesmente não está lá). O SISTEMA é
   * igual para todos e tem ~10 mil tokens: vai como a lista do que ele contém.
   *
   * Recolhido por padrão: é consulta, não leitura obrigatória a cada escolha.
   */
  /** A mesma leitura, numa caixa própria. */
  function mostrarOQueAIALeu() {
    const lido = state.lidoPelaIA;
    if (!lido) return;
    const caixa = h('div', { class: 'wf-pergunta wf-escolha' });
    const fundo = h('div', { class: 'wf-pergunta-fundo' }, [caixa]);
    const barra = h('div', { class: 'wf-pergunta-titulo' }, `O que a IA leu — ${state.contact?.name || 'contato'}`);
    caixa.append(barra);
    tornarArrastavel(caixa, barra, 'escolhaPos');
    const detalhe = montarOQueAIALeu(lido);
    detalhe.open = true;
    const fecharBtn = h('button', { class: 'wf-btn', type: 'button' }, 'Fechar');
    const fechar = () => {
      document.removeEventListener('keydown', aoTeclar, true);
      fundo.remove();
    };
    function aoTeclar(ev) {
      if (ev.key === 'Escape' && ev.isTrusted) fechar();
    }
    fecharBtn.addEventListener('click', fechar);
    caixa.append(detalhe, fecharBtn);
    document.addEventListener('keydown', aoTeclar, true);
    destinoDaCaixa().append(fundo);
    aplicarPosicao(caixa, state.settings.escolhaPos);
  }

  function montarOQueAIALeu(lido) {
    const partes = [
      `o seu padrão de atendimento e as regras fixas`,
      `${lido.respostasProntas} respostas prontas como base de tom e de conteúdo`,
      lido.instrucoesExtras ? 'as suas instruções extras' : null,
      lido.dossie ? 'o dossiê do mandato (a conversa puxou)' : 'o dossiê NÃO entrou (a conversa não puxou)',
      lido.anterior ? `${lido.anterior} falas do atendimento anterior` : 'nenhum atendimento anterior',
    ].filter(Boolean);
    const detalhe = h('details', { class: 'wf-escolha-lido' }, [
      h('summary', {}, 'O que a IA leu para escrever isto'),
      h('div', { class: 'wf-pergunta-linha' },
        `Fixo para todo contato (~${lido.sistemaTokens} tokens): ${partes.join(' · ')}.`),
      h('div', { class: 'wf-pergunta-linha' },
        `Sobre ESTE contato (~${lido.contatoTokens} tokens), exatamente assim:`),
      h('pre', { class: 'wf-escolha-prompt' }, String(lido.contato || '')),
    ]);
    return detalhe;
  }

  function renderConfigIA() {
    const cfg = state.ia || {};
    body.append(h('h3', { class: 'wf-h' }, 'Avaliação por IA'));

    /**
     * **Esta tela descrevia a IA que ela deixou de ser** — conferido a pedido dele (06/09/2026),
     * logo depois de a 2.58 mudar o papel dela.
     *
     * Dizia *"a IA lê a conversa e ESCOLHE entre as suas respostas prontas"* e, mais abaixo,
     * *"ela nunca escreve o que sai"*. As duas frases estavam certas até hoje de manhã e viraram
     * o pior tipo de texto de tela: **descrição que envelheceu e continua parecendo verdade**.
     * É a mesma armadilha do desfecho no quadro — mapa que envelhece vira mapa mentiroso.
     */
    body.append(
      h('div', { class: 'wf-preview' },
        'A IA faz DUAS coisas, e só elas: ESCREVE um rascunho quando o fluxo não resolve o caso ' +
          '(nenhuma caixa decidiu, ou a caixa mandou o contato para você), e CONFERE a cidade ' +
          'antes de ela ir para o CRM. Todo o resto — 94% dos contatos, medido — é decidido pelo ' +
          'fluxo, sem gastar um centavo.'),
      h('div', { class: 'wf-origin' },
        'O rascunho NUNCA é enviado sozinho: ele cai no campo de mensagem e quem aperta enviar é ' +
          'você. E a IA não escolhe mais entre as suas respostas prontas — isso saiu em 06/09, ' +
          'porque a caixa que manda o caso para você quer dizer, por definição, que nenhuma delas ' +
          'serve.')
    );

    /**
     * **O interruptor daqui SAIU** — pedido dele (06/09/2026): *"só preciso do botão na aba de
     * automatização para ligar e desligar a IA"*.
     *
     * Eram dois controles para a MESMA chave (`ia.ligada`), e o outro está onde a decisão é
     * tomada: na tela em que ele aperta "Começar". Dois interruptores para a mesma coisa é a
     * família do "uma pasta, duas extensões" — não divergem no valor (a chave é uma só), divergem
     * na cabeça de quem olha: desligar num lugar e ver o outro marcado é o tipo de dúvida que
     * custa uma rodada inteira gastando dinheiro que ele achava desligado.
     *
     * **O que fica aqui é o que só existe aqui:** a chave, o modelo, o teto de gasto, as
     * instruções extras e o dossiê.
     */
    body.append(
      h('div', { class: cfg.ligada ? 'wf-origin' : 'wf-block' },
        cfg.ligada
          ? 'A avaliação por IA está LIGADA. O interruptor fica na aba Automatizado, junto do botão de começar.'
          : 'A avaliação por IA está DESLIGADA. O interruptor fica na aba Automatizado, junto do botão de começar.')
    );

    /**
     * **O MODELO vem antes da chave nesta tela, e a ordem é a explicação.**
     *
     * São dois provedores desde 07/09/2026 (pedido dele: *"faça agora a implementação para
     * utilizar a api do chatgpt"*), e o que decide a casa é o modelo escolhido — não há um campo
     * "provedor", porque dois controles para a mesma coisa divergem. Então o campo da chave que
     * aparece embaixo é o do provedor DESTE modelo: trocar o modelo troca o campo.
     */
    const modeloAtual = cfg.modelo || iaLib.MODELO_PADRAO;
    const provedorAtual = iaLib.provedorDoModelo(modeloAtual);

    /**
     * **As casas e os modelos de cada uma, numa lista só** — ela monta o seletor E os campos de
     * chave logo abaixo. Duas listas divergiriam no primeiro modelo novo, e a que ninguém olha
     * seria a que diz para qual chave o modelo escolhido vai.
     */
    const CASAS = [
      [iaLib.PROVEDOR_ANTHROPIC, [
        ['claude-haiku-4-5', 'Haiku 4.5 — o mais barato (~US$ 2,50 por mil contatos)'],
        ['claude-sonnet-5', 'Sonnet 5 — meio-termo (~US$ 4,50 por mil)'],
        ['claude-opus-5', 'Opus 5 — o mais capaz (~US$ 11 por mil)'],
      ]],
      [iaLib.PROVEDOR_OPENAI, [
        ['gpt-5', 'gpt-5 — o grande; raciocina (~US$ 11 por mil)'],
        ['gpt-5-mini', 'gpt-5-mini — um terço do Haiku (~US$ 2 por mil)'],
        ['gpt-5-nano', 'gpt-5-nano — o mais barato de todos (~US$ 0,45 por mil)'],
        ['gpt-5.6-luna', 'gpt-5.6-luna — geração nova, acima do gpt-5 nos testes (~US$ 2 por mil)'],
      ]],
      [iaLib.PROVEDOR_OPENROUTER, [
        ['qwen/qwen3.7-plus', 'Qwen3.7 Plus — pelo OpenRouter, acima do gpt-5 nos testes (~US$ 2,50 por mil)'],
      ]],
    ];

    const seletorDeModelo = (atual) => {
      const sel = h('select', {});
      for (const [casaId, modelos] of CASAS) {
        const grupo = h('optgroup', { label: iaLib.NOME_DO_PROVEDOR[casaId] });
        for (const [id, rotulo] of modelos) {
          const opt = h('option', { value: id }, rotulo);
          if (id === atual) opt.selected = true;
          grupo.append(opt);
        }
        sel.append(grupo);
      }
      // Modelo que ele digitou à mão (ou de uma versão futura) não pode sumir do seletor: sem esta
      // opção o `select` mostraria outro modelo e a próxima mexida na tela salvaria esse outro.
      if (!CASAS.some(([, modelos]) => modelos.some(([id]) => id === atual))) {
        const opt = h('option', { value: atual }, `${atual} (escolhido à mão)`);
        opt.selected = true;
        sel.append(opt);
      }
      return sel;
    };

    /**
     * **Dois modelos, duas tarefas** (18/09/2026). O RASCUNHO é o texto que o eleitor lê, e é onde o
     * modelo barato falha; as CONFERÊNCIAS são sim ou não com esquema fechado, e o barato dá conta.
     */
    const rascunhoAtual = cfg.modeloRascunho || modeloAtual;
    const selRascunho = seletorDeModelo(rascunhoAtual);
    selRascunho.addEventListener('change', () =>
      withBusy(async () => {
        await salvarIA({ modeloRascunho: selRascunho.value });
        renderAll();
      })
    );
    const semChaveDoRascunho = !state.iaChaves?.[iaLib.provedorDoModelo(rascunhoAtual)];
    body.append(
      h('label', { class: 'wf-field' }, [h('span', {}, 'Modelo do rascunho (o texto que o eleitor lê)'), selRascunho]),
      semChaveDoRascunho
        ? h('div', { class: 'wf-block', 'data-fica': '1' },
            `Sem a chave da ${iaLib.NOME_DO_PROVEDOR[iaLib.provedorDoModelo(rascunhoAtual)]}: o rascunho vai falhar ` +
              '(e cair no reserva, se houver). Salve a chave abaixo.')
        : h('div', { class: 'wf-origin' },
            'Um modelo forte aqui: é o único texto que sai para o eleitor, e a IA só escreve nos ~5% de ' +
              'contatos que o fluxo não resolve. Suba o teto de gasto junto.')
    );

    const selModelo = seletorDeModelo(modeloAtual);
    selModelo.addEventListener('change', () =>
      withBusy(async () => {
        await salvarIA({ modelo: selModelo.value });
        // `iaTemChave` é por PROVEDOR: trocar de modelo pode deixar a IA sem chave, e o aviso da
        // aba Automatizado tem que refletir isso na hora.
        await lerChavesDaIA();
        renderAll();
      })
    );
    body.append(
      h('label', { class: 'wf-field' }, [h('span', {}, 'Modelo das conferências (cidade e etiquetas)'), selModelo]),
      h('div', { class: 'wf-origin', 'data-fica': '1' }, avisoDoModelo(cfg))
    );

    body.append(
      checkbox('IA pega a cidade sozinha (também fora da rodada)', !!cfg.cidadeSozinha, async (v) => {
        await salvarIA({ cidadeSozinha: v });
        setStatus(
          v
            ? 'Ligado: ao abrir um contato, a IA confere a cidade que o parser achou e grava sozinha.'
            : 'Desligado: fora da rodada, a cidade volta a esperar o seu clique.',
          'ok'
        );
        renderAll();
      }),
      h('div', { class: 'wf-origin' },
        'Marcada, a cidade que o parser achou na conversa é conferida pela IA ao abrir o contato, sem ' +
          'rodada andando: ela confirma, corrige para outro município do IBGE ou não grava nada. ' +
          'Cada conferência é uma chamada paga (~US$ 0,001). Na rodada ela já confere com a IA ligada.')
    );

    /**
     * **O modelo RESERVA** — pedido dele (08/09/2026), depois de a IA pendurar duas vezes: *"se for
     * algo comum tem que ter um failsafe; eu já quero botar o chatgpt, então o padrão seria chatgpt
     * atender, se ele falhar tenta com o claude"*.
     *
     * A troca acontece no service worker (as duas chamadas passam pelo teto de gasto). Aqui é só a
     * escolha — e o aviso que diz quando ela NÃO vale.
     */
    const selReserva = h('select', {});
    const reservaAtual = String(cfg.modeloReserva || '');
    selReserva.append(h('option', { value: '' }, 'Sem reserva — se falhar, falhou'));
    for (const [casa, modelos] of [
      ['Anthropic (Claude)', [
        ['claude-haiku-4-5', 'Haiku 4.5'],
        ['claude-sonnet-5', 'Sonnet 5'],
        ['claude-opus-5', 'Opus 5'],
      ]],
      ['OpenAI (ChatGPT)', [
        ['gpt-5', 'gpt-5'],
        ['gpt-5-mini', 'gpt-5-mini'],
        ['gpt-5-nano', 'gpt-5-nano'],
        ['gpt-5.6-luna', 'gpt-5.6-luna'],
      ]],
      ['OpenRouter (Qwen)', [
        ['qwen/qwen3.7-plus', 'Qwen3.7 Plus'],
      ]],
    ]) {
      const g = h('optgroup', { label: casa });
      for (const [id, rotulo] of modelos) {
        const opt = h('option', { value: id }, rotulo);
        if (id === reservaAtual) opt.selected = true;
        g.append(opt);
      }
      selReserva.append(g);
    }
    selReserva.addEventListener('change', () =>
      withBusy(async () => {
        await salvarIA({ modeloReserva: selReserva.value });
        renderAll();
      })
    );
    body.append(
      h('label', { class: 'wf-field' }, [h('span', {}, 'Modelo reserva (failsafe)'), selReserva]),
      h('div', { class: 'wf-origin', 'data-fica': '1' }, avisoDoReserva(cfg, state.iaChaves))
    );

    /**
     * **O padrão de atendimento, para ele VER** — pedido dele (08/09/2026): *"a IA do chatgpt tem
     * acesso ao mesmo padrão de comportamento que passei pro claude? crie um botão nas
     * configurações para o padrão de comportamento para eu visualizar e saber que está lá"*.
     *
     * A resposta à pergunta é sim, e é medível: o prompt é montado por `montarSistemaRascunho`, que
     * não sabe qual casa vai atender — o que muda entre as duas é só a FORMA do pedido
     * (`system` na Anthropic, `messages[0].role = 'system'` na OpenAI), e o texto é o mesmo objeto.
     *
     * **Somente leitura, de propósito.** O documento é dele e mora em `atendimento.js`; a regra
     * escrita no `CLAUDE.md` é *"não altere sem ele pedir"*. Um editor aqui convidaria a mexer sem
     * o `git diff` que hoje protege cada mudança — e ele já tem onde escrever o que muda toda
     * semana: as Instruções extras, logo abaixo.
     */
    /**
     * **O padrão de atendimento abre em JANELA** — pedido dele (08/09/2026): *"faça para que abra em
     * popup, as letras estão pequenas demais para ler"*.
     *
     * A primeira versão era um `<details>` aqui dentro, e ele estava certo: o painel tem 380px e o
     * texto saía em 11px numa caixa de 320px de altura. Dava para conferir que o documento estava
     * lá — não para lê-lo, que era o pedido original.
     *
     * `chrome.windows` não existe em content script (a armadilha já registrada), então a abertura é
     * uma mensagem para o service worker, igual à da janela do fluxo.
     */
    const btnPadrao = h('button', { class: 'wf-btn', type: 'button' }, 'Ver o padrão de atendimento ↗');
    btnPadrao.addEventListener('click', () =>
      withBusy(async () => {
        const r = await chrome.runtime.sendMessage({ type: MSG_PADRAO });
        if (!r?.ok) setStatus(`Não consegui abrir a janela: ${r?.motivo || 'sem motivo'}`, 'err');
      })
    );
    body.append(
      btnPadrao,
      h('div', { class: 'wf-origin' },
        `${(PADRAO_DE_ATENDIMENTO.match(/^## /gm) || []).length} seções, e vai INTEIRO no prompt — ` +
          'o mesmo texto no Claude e no ChatGPT.')
    );

    /**
     * **UMA CHAVE POR CASA, as duas na tela ao mesmo tempo** — pedido dele (12/09/2026): *"o
     * armazenamento da key ficou confuso, deixe um espaço de key para cada modelo"*.
     *
     * Havia **um campo só**, e o que ele significava mudava com o modelo escolhido: para salvar a
     * chave da OpenAI era preciso trocar o modelo primeiro, salvar, e trocar de volta. Pior com o
     * failsafe, que precisa das DUAS chaves de uma vez — titular numa casa, reserva na outra. A
     * linha *"Guardadas: Anthropic ✓ · OpenAI —"* era remendo em cima disso: ela existia porque o
     * campo escondia a outra chave.
     *
     * **É por CASA e não por modelo, e a razão é o que a chave é:** uma chave da Anthropic atende
     * Haiku, Sonnet e Opus; uma da OpenAI atende os três gpt-5. Um campo por modelo seria a mesma
     * chave colada seis vezes — mais confuso, não menos. Cada campo diz quais modelos ele atende,
     * que é a informação que faltava.
     *
     * A chave continua **nunca sendo relida para a tela**: campo de senha, e o que se mostra é se
     * existe. Chave visível no painel é chave que aparece em print.
     */
    const provedorDoReserva = String(cfg.modeloReserva || '').trim()
      ? iaLib.provedorDoModelo(cfg.modeloReserva)
      : null;

    for (const [casaId, modelos] of CASAS) {
      const nomeDaCasa = iaLib.NOME_DO_PROVEDOR[casaId];
      const chaveDaCasa = iaLib.CHAVE_DO_PROVEDOR[casaId];
      const tem = !!state.iaChaves?.[casaId];
      const prefixo = { anthropic: 'sk-ant-…', openai: 'sk-…', openrouter: 'sk-or-…' }[casaId] || 'sk-…';

      const campoChave = h('input', { type: 'password', placeholder: tem ? '•••••• (já salva)' : prefixo });
      const salvarChave = h('button', { class: 'wf-btn', type: 'button' }, 'Salvar');
      salvarChave.addEventListener('click', () =>
        withBusy(async () => {
          const valor = campoChave.value.trim();
          if (!valor) return setStatus(`Cole a chave da ${nomeDaCasa} antes de salvar.`, 'err');
          /**
           * **Chave colada no campo errado custaria uma rodada inteira devolvendo 401** — que o
           * painel traduz como *"a chave da API foi recusada"*, mandando conferir a chave que está
           * certa. O prefixo separa as duas sem chamar API nenhuma, então a conferência é de graça.
           *
           * Com um campo por casa o aviso mudou de recado: antes mandava **trocar o modelo**;
           * agora diz em qual dos dois campos aquela chave vai.
           */
          // Três casas desde 18/09/2026: o prefixo diz de qual é — "sk-ant-" Anthropic, "sk-or-"
          // OpenRouter, o resto OpenAI.
          const casaDaChave = /^sk-ant-/i.test(valor)
            ? iaLib.PROVEDOR_ANTHROPIC
            : /^sk-or-/i.test(valor)
              ? iaLib.PROVEDOR_OPENROUTER
              : iaLib.PROVEDOR_OPENAI;
          if (casaDaChave !== casaId) {
            return setStatus(
              `Essa chave não parece ser da ${nomeDaCasa}: as da Anthropic começam com "sk-ant-", as do ` +
                `OpenRouter com "sk-or-" e as da OpenAI com "sk-". Ela vai no campo da ` +
                `${iaLib.NOME_DO_PROVEDOR[casaDaChave]}.`,
              'err'
            );
          }
          await store.set(chaveDaCasa, valor);
          await lerChavesDaIA();
          campoChave.value = '';
          setStatus(`Chave da ${nomeDaCasa} salva. Ela fica só no armazenamento da extensão e não passa pela página.`);
          renderAll();
        })
      );

      const apagarChave = h('button', { class: 'wf-btn', type: 'button' }, 'Apagar');
      apagarChave.disabled = !tem;
      apagarChave.addEventListener('click', () =>
        withBusy(async () => {
          await store.set(chaveDaCasa, '');
          await lerChavesDaIA();
          setStatus(`Chave da ${nomeDaCasa} apagada.`);
          renderAll();
        })
      );

      // Para que ESTA chave serve agora — é o que responde "preciso das duas?" sem adivinhação.
      const usos = [];
      if (casaId === provedorAtual) usos.push('as conferências');
      if (casaId === iaLib.provedorDoModelo(rascunhoAtual)) usos.push('o rascunho');
      if (casaId === provedorDoReserva) usos.push('o reserva do failsafe');

      body.append(
        h('label', { class: 'wf-field' }, [h('span', {}, `Chave da ${nomeDaCasa}`), campoChave]),
        h('div', { class: 'wf-row' }, [salvarChave, apagarChave]),
        h('div', { class: tem || !usos.length ? 'wf-origin' : 'wf-block', 'data-fica': '1' },
          (tem ? 'Salva ✓' : 'NÃO salva') +
            ` — atende ${modelos.map(([id]) => id).join(', ')}.` +
            (usos.length
              ? ` Hoje ela atende ${usos.join(' e ')}${tem ? '.' : ' — sem ela a IA não escreve nada.'}`
              : ' Nenhum modelo escolhido agora usa esta casa.'))
      );
    }

    body.append(
      h('div', { class: 'wf-origin' },
        'Uma chave por CASA, e não por modelo: a mesma chave da Anthropic atende Haiku, Sonnet e ' +
          'Opus, a da OpenAI atende os gpt-5, e a do OpenRouter atende o Qwen. Elas convivem — ' +
          'trocar de modelo não obriga a colar chave de novo. O OpenRouter é pedido só a servidores ' +
          'que não guardam nem treinam com as conversas.'),
      h('div', { class: 'wf-origin' },
        'A chave fica no armazenamento da extensão e a chamada sai do service worker — ela NÃO ' +
          'entra na página do mobiliza. Isso importa: o gancho da extensão roda no mesmo ' +
          'contexto do código deles, e o que está na página, a plataforma lê. Ela também fica ' +
          'fora do backup exportado.')
    );
    montarTetoDeGasto(cfg);

    const areaRegras = h('textarea', { rows: '4', placeholder: 'ex.: quem falar em agenda de Caxias esta semana é para mim' });
    // `state.ia.regras` já vem do candidato do atendimento aberto (ver o `load()`), então o campo
    // mostra o que vai valer para ELE — e não o que está gravado na chave geral.
    areaRegras.value = state.ia?.regras || cfg.regras || '';
    areaRegras.addEventListener('change', () => {
      const texto = areaRegras.value.trim();
      const perfil = perfilAtivo();
      const gravou =
        perfil === perfisLib.PERFIL_PADRAO
          ? salvarIA({ regras: texto })
          : perfisLib.gravar('iaRegras', perfil, texto).then(() => {
              state.ia = { ...state.ia, regras: texto };
            });
      gravou.then(() =>
        setStatus(
          state.perfis.length > 1
            ? `Instruções salvas para ${state.perfil?.nome || 'o candidato de sempre'}.`
            : 'Instruções salvas.'
        )
      );
    });
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

    /**
     * **O botão "Avaliar o contato aberto" SAIU** (06/09/2026), e a razão não é espaço na tela:
     * ele testava um caminho que a rodada abandonou horas antes.
     *
     * Ele chamava `avaliarComIA` e respondia *"IA: responder → 'agradecer-apoio' (88%)"* — uma
     * escolha de resposta pronta que **a rodada não faz mais**. Botão de teste que prevê o que o
     * programa não vai fazer é pior que não ter teste: ele dá confiança na coisa errada.
     *
     * Quem quer ver o que ela escreveria já tem o caminho certo, e ele é do mesmo dia: o botão
     * **"Chamar a IA"** na aba Respostas, que põe o rascunho no campo de mensagem.
     */
    body.append(
      h('div', { class: 'wf-origin' },
        'Para ver o que a IA escreveria neste contato, use "Chamar a IA" na aba Respostas — o ' +
          'rascunho cai no campo de mensagem e nada é enviado.')
    );
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
  /**
   * O que a tela diz sobre o RESERVA — e ela precisa dizer quando ele NÃO vale.
   *
   * São três jeitos de o failsafe estar desligado sem parecer: vazio, igual ao titular (repetir a
   * mesma casa não é failsafe) e sem chave do provedor dele. Os três com o campo preenchido na
   * tela, que é o pior tipo de configuração — a que parece feita.
   */
  function avisoDoReserva(cfg, chaves) {
    const titular = cfg.modelo || iaLib.MODELO_PADRAO;
    const reserva = String(cfg.modeloReserva || '').trim();
    if (!reserva) {
      return 'Sem reserva: se a casa do modelo acima não responder, a rodada segue sem a IA.';
    }
    if (reserva === titular) {
      return 'O reserva é o MESMO modelo do titular — repetir a mesma casa não é failsafe. Escolha ' +
        'um da outra casa (se o titular é ChatGPT, um Claude).';
    }
    const provedor = iaLib.provedorDoModelo(reserva);
    if (!chaves?.[provedor]) {
      return `O reserva é ${reserva}, e não há chave da ${iaLib.NOME_DO_PROVEDOR[provedor]} salva ` +
        '— sem ela o failsafe não roda. Preencha a chave abaixo.';
    }
    return `Se ${titular} falhar (sem resposta, chave recusada, fila cheia, apagão), a mesma ` +
      `pergunta é refeita em ${reserva}. As duas chamadas passam pelo teto de gasto e as duas ` +
      'entram na conta. O Andamento diz quando o reserva atendeu.';
  }

  /**
   * **O modelo que ESCREVE** — separado do das conferências em 18/09/2026 (ver `store.ia.modeloRascunho`).
   * Um lugar só: a chamada, o log de custo e a mensagem de falha perguntam isto, e três leituras
   * separadas divergem no primeiro modelo novo.
   */
  function modeloDoRascunho() {
    return state.ia?.modeloRascunho || state.ia?.modelo || iaLib.MODELO_PADRAO;
  }

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
        'A chave da API NÃO usa assinatura nenhuma — nem o Claude Pro/Max, nem o ChatGPT Plus. ' +
          'São cobranças diferentes: a assinatura é do site e do app; a API é pré-paga por token, ' +
          'com fatura própria no console do provedor. Ligar a IA aqui gera gasto NOVO em cima do ' +
          'que você já paga — o teto abaixo é o que impede esse gasto de surpreender. E o teto é ' +
          'UM só, somando os dois provedores: o que interessa é quanto saiu do bolso no mês.')
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
  /**
   * **O CANDIDATO EM QUE VOCÊ ESTÁ** — refeito em 25/09/2026 pela correção dele: *"não gostei do
   * método utilizado para os perfis, eu queria algo como um perfil de login no Windows, aparenta
   * estar tudo misturado"*.
   *
   * A primeira versão empilhava TODOS os candidatos nesta tela, com todos os campos de todos ao
   * mesmo tempo — e era isso que parecia misturado. Aqui se edita **um**: o que está logado. Para
   * mexer no outro, entra-se como ele pelo seletor do cabeçalho, que é o mesmo gesto do Windows.
   *
   * **O canal não troca mais o login, só avisa** — ver `montarLoginDoCandidato`. O cartão continua
   * mostrando o canal do atendimento aberto porque o `channelId` é um id opaco que ninguém digita
   * de cabeça: sem essa linha, preencher o campo seria adivinhação.
   */
  function renderCartaoCandidatos() {
    const perfil = state.perfil || perfisLib.porId(state.perfis, perfisLib.PERFIL_PADRAO);
    const card = h('div', { class: 'wf-card' }, [h('h4', {}, `Candidato: ${perfil.nome}`)]);
    card.append(
      h('div', { class: 'wf-origin' },
        'Esta tela edita o candidato em que você está. As respostas prontas, os anúncios, o dossiê ' +
          'e as instruções da IA são dele; o quadro do fluxo, o parser e as etiquetas de cidade ' +
          'valem para todos. Para mexer em outro candidato, entre como ele no alto do painel.')
    );

    const salvar = async (mudanca) => {
      const limpa = perfisLib.sanitizar(state.perfis.map((p) => (p.id === perfil.id ? { ...p, ...mudanca } : p)));
      await store.set('perfis', limpa);
      state.perfis = limpa;
      state.perfil = perfisLib.porId(limpa, perfil.id);
      /**
       * **Refazer a conta do canal AQUI era o que faltava** — print dele de 25/09/2026, com a tarja
       * dizendo *"não está em nenhum candidato"* logo depois de ele cadastrar o número. A conta era
       * feita uma vez, no `load()`, e salvar o cadastro só redesenhava a tela: o aviso continuava
       * com a resposta de antes, **justo depois de ele fazer o que o aviso mandava**.
       */
      recalcularCanalDoAtendimento();
      renderAll();
    };

    card.append(
      campoTexto('Nome', perfil.nome, (v) => salvar({ nome: v })),
      campoTexto('Como citá-lo no meio da frase (ex.: o Capitão Martim)', perfil.tratamento, (v) => salvar({ tratamento: v })),
      campoTexto('Cargo (ex.: deputado estadual)', perfil.cargo, (v) => salvar({ cargo: v })),
      campoTexto('Número de urna', perfil.numero, (v) => salvar({ numero: v }))
    );

    const canaisInput = h('input', { type: 'text', value: perfil.canais.join(', '), placeholder: 'ex.: 51980510122, cccad9' });
    canaisInput.addEventListener('change', () =>
      salvar({ canais: canaisInput.value.split(',').map((c) => c.trim()).filter(Boolean) }));
    card.append(
      h('label', { class: 'wf-field' }, [
        h('span', {}, 'Números deste candidato (para o painel avisar)'),
        canaisInput,
        h('div', { class: 'wf-origin' },
          'Separe por vírgula: o número que aparece no cabeçalho da conversa (só os dígitos contam) ' +
            'ou o id da instância. Isto NÃO troca o candidato sozinho — serve para o painel avisar, ' +
            'em vermelho, quando o atendimento aberto for do número do outro.'),
      ])
    );

    const canalAgora = String(state.session?.channelId || '').trim();
    if (canalAgora) {
      const usar = h('button', { class: 'wf-btn wf-mini', type: 'button' }, 'Somar o canal deste atendimento a este candidato');
      usar.addEventListener('click', () => salvar({ canais: [...new Set([...perfil.canais, canalAgora])] }));
      /**
       * **Diz o que a conta comparou, e não só o id do canal.** Sem o número lido, "não está
       * cadastrado" e "não consegui ler a tela" parecem a mesma coisa — e foi exatamente isso que
       * custou o diagnóstico da print de 25/09.
       */
      card.append(
        h('div', { class: 'wf-preview', 'data-fica': '1' }, `Atendimento aberto — ${oQueComparei()}`),
        h('div', { class: 'wf-origin' },
          'Somar o CANAL é o caminho seguro: ele vem da API e não depende de ler a tela. O número ' +
            'serve para você reconhecer de qual instância é.'),
        usar
      );
    } else {
      card.append(h('div', { class: 'wf-hint' }, 'Abra um atendimento para copiar o canal dele para cá.'));
    }

    if (perfil.id !== perfisLib.PERFIL_PADRAO) {
      const dossieArea = h('textarea', { rows: '6', placeholder: 'quem ele é, o que já fez, o que defende — a IA só afirma o que estiver escrito aqui' });
      dossieArea.value = perfil.dossie || '';
      dossieArea.addEventListener('change', () => salvar({ dossie: dossieArea.value }));
      card.append(
        h('label', { class: 'wf-field' }, [
          h('span', {}, 'Dossiê deste candidato'),
          dossieArea,
          h('div', { class: 'wf-origin' },
            'O dossiê do Capitão Martim vem empacotado com a extensão e NÃO é usado aqui — mandá-lo ' +
              'numa conversa de outro candidato seria a IA responder com a biografia de outra ' +
              'pessoa. Em branco, a IA fica sem dossiê e prefere não afirmar nada, que é o lado seguro.'),
        ])
      );

      const apagar = h('button', { class: 'wf-btn wf-mini wf-danger', type: 'button' }, `Apagar ${perfil.nome}`);
      apagar.addEventListener('click', async () => {
        if (!window.confirm(`Apagar o candidato "${perfil.nome}"? As respostas prontas e os anúncios dele vão junto.`)) return;
        const todos = { ...((await store.get('porPerfil')) || {}) };
        delete todos[perfil.id];
        await store.set('porPerfil', todos);
        const limpa = perfisLib.sanitizar(state.perfis.filter((p) => p.id !== perfil.id));
        await store.set('perfis', limpa);
        state.perfis = limpa;
        // Apagar o candidato em que se está é deslogar: entra-se no de sempre, e a tela inteira
        // volta a ser dele. Sem isto o painel ficaria com o nome de um candidato que não existe.
        await entrarComo(perfisLib.PERFIL_PADRAO);
        setStatus(`Candidato "${perfil.nome}" apagado. Você está como ${state.perfil.nome}.`, 'ok');
      });
      card.append(apagar);
    } else {
      card.append(
        h('div', { class: 'wf-origin' },
          'Este é o candidato de sempre: as respostas prontas, os anúncios e o dossiê dele são os ' +
            'que a extensão já usava, nas mesmas chaves. Por isso nada mudou para ele.')
      );
    }

    body.append(card);

    /**
     * **Criar é uma tela à parte, e não mais um bloco no meio dos outros.**
     *
     * Criar COPIA os textos do candidato em que você está, com o nome e o número de urna trocados:
     * perfil sem texto é perfil mudo, e mudo numa rodada automática é contato saindo da fila sem
     * receber nada. Ver `perfis.semearTextos`.
     */
    const novoCard = h('div', { class: 'wf-card' }, [h('h4', {}, 'Outro candidato')]);
    if (state.perfis.length > 1) {
      novoCard.append(
        h('div', { class: 'wf-preview', 'data-fica': '1' },
          `Cadastrados: ${state.perfis.map((p) => p.nome).join(' · ')}`),
        h('div', { class: 'wf-origin' },
          'Para editar outro, entre como ele no seletor do alto do painel — a tela inteira passa a ' +
            'ser dele.')
      );
    }

    const novoNome = h('input', { type: 'text', placeholder: 'ex.: Felipe Pedri' });
    const criar = h('button', { class: 'wf-btn', type: 'button' }, `Criar candidato (copiando os textos de ${perfil.nome})`);
    criar.addEventListener('click', () =>
      withBusy(async () => {
        const nome = novoNome.value.trim();
        if (!nome) return setStatus('Escreva o nome do candidato antes de criar.', 'err');
        const id = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (!id) return setStatus('Esse nome não vira um identificador; use letras.', 'err');
        if (state.perfis.some((p) => p.id === id)) return setStatus(`Já existe um candidato "${nome}".`, 'err');

        const novo = { id, nome, tratamento: `o ${nome}`, cargo: '', numero: '', canais: [], dossie: '' };
        const textos = perfisLib.semearTextos(state.templates, perfil, novo);
        await perfisLib.gravar('templates', id, textos);
        const limpa = perfisLib.sanitizar([...state.perfis, novo]);
        await store.set('perfis', limpa);
        state.perfis = limpa;
        novoNome.value = '';
        // Entrar como ele na hora: criar e continuar no outro deixaria a tela mostrando o antigo
        // com um candidato novo e vazio invisível — e ele iria editar os textos errados.
        await entrarComo(id);
        setStatus(
          `Você está como ${nome}, com ${textos.length} respostas copiadas. Preencha o cargo, o ` +
            'número de urna e o dossiê, e confira os textos na aba Respostas.',
          'ok'
        );
      })
    );
    novoCard.append(h('label', { class: 'wf-field' }, [h('span', {}, 'Nome do novo candidato'), novoNome]), criar);
    body.append(novoCard);
  }

  function renderConfig() {
    renderCartaoCandidatos();
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
    perfisLib.ler('cityLinks', perfilAtivo(), {}).then((m) => (cityArea.value = cities.formatCityLinks(m)));
    perfisLib.ler('defaultGroupLink', perfilAtivo(), '').then((v) => (defaultInput.value = v || ''));

    const cityBtn = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Salvar grupos');
    cityBtn.addEventListener('click', async () => {
      const parsed = cities.parseCityLinksText(cityArea.value);
      await perfisLib.gravar('cityLinks', perfilAtivo(), parsed);
      await perfisLib.gravar('defaultGroupLink', perfilAtivo(), defaultInput.value.trim());
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
      rulesArea.value = tagsLib.escreverRegrasEmTexto(rules);
    });
    const rulesBtn = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Salvar regras');
    rulesBtn.addEventListener('click', () =>
      withBusy(async () => {
        // O leitor do formato `padrão = Etiqueta` é de `tags.js`: as DUAS tabelas o usam, e duas
        // cópias divergiriam na primeira correção.
        const { regras, invalidas } = tagsLib.lerRegrasDeTexto(rulesArea.value);
        await store.set('tagRules', regras);
        await refreshTagSuggestions();
        setStatus(
          `${regras.length} regra(s) salva(s).` + (invalidas.length ? ` Ignorei padrão inválido: ${invalidas.join(', ')}` : ''),
          invalidas.length ? 'err' : 'ok'
        );
      })
    );
    body.append(rulesArea, rulesBtn);

    /**
     * **ETIQUETA POR PALAVRA NO QUE NÓS MANDAMOS** (pedido dele, 01/10/2026: *"preciso da opção de
     * que quando eu enviar uma palavra chave uma etiqueta que eu escolher também seja colocada"*).
     *
     * **É o espelho da tabela de cima, e por isso fica colada nela:** aquela casa no que o CONTATO
     * escreve e decide qual conteúdo mandar; esta casa no que SAIU e registra o que nós fizemos.
     * Mesmo formato, mesmo leitor — o que muda é o lado da conversa.
     *
     * Nasce VAZIA de propósito: regra inventada aqui põe etiqueta permanente em eleitor real.
     */
    body.append(h('hr', { class: 'wf-sep' }), h('h3', { class: 'wf-h' }, 'Etiquetas por palavra no que EU mando'));
    body.append(
      h('p', { class: 'wf-hint' }, [
        'Uma linha por regra, no formato "palavra = Etiqueta". Quando o texto que SAI contiver a ' +
          'palavra, a etiqueta é aplicada no contato — ',
        h('b', {}, 'além'),
        ' das outras. Vale na resposta pronta e no modelo aprovado (inclusive quando o painel só ' +
          'INSERE o texto para você mandar), na legenda do envio em lote, e no rascunho da IA ' +
          'quando ela mesma envia — rascunho que fica no campo para você ajustar não marca nada, ' +
          'porque o texto ainda vai mudar. A tabela de cima é o contrário: ela casa no que o ' +
          'contato escreveu. A etiqueta precisa existir no CRM, e a linha de status diz qual ' +
          'palavra casou.',
      ])
    );

    const envioArea = h('textarea', { rows: '3' });
    store.get('etiquetasPorEnvio').then((regras) => {
      envioArea.value = tagsLib.escreverRegrasEmTexto(regras);
    });
    const envioBtn = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Salvar etiquetas por palavra');
    envioBtn.addEventListener('click', () =>
      withBusy(async () => {
        const { regras, invalidas } = tagsLib.lerRegrasDeTexto(envioArea.value);
        await store.set('etiquetasPorEnvio', regras);
        setStatus(
          `${regras.length} regra(s) salva(s).` + (invalidas.length ? ` Ignorei padrão inválido: ${invalidas.join(', ')}` : ''),
          invalidas.length ? 'err' : 'ok'
        );
      })
    );
    body.append(envioArea, envioBtn);

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
      const salva = await perfisLib.ler('modelosPadraoAnuncio', perfilAtivo(), []);
      const antigo = String((await perfisLib.ler('modeloPadraoAnuncio', perfilAtivo(), '')) || '').trim();
      const lista = Array.isArray(salva) && salva.length ? salva : antigo ? [antigo] : [];
      const indice = Number(await store.get('modeloPadraoIndex')) || 0;

      const gravar = async (nova) => {
        // Guarda como ele digitou (só sem espaço nas pontas). Quem peneira vazio é a leitura da
        // rodada — `carregarModelosPadrao` e `anuncios.padraoDaVez`, os dois com teste.
        const limpa = nova.map((m) => String(m || '').trim());
        await perfisLib.gravar('modelosPadraoAnuncio', perfilAtivo(), limpa);
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
          /**
           * **O mesmo cuidado da lista de anúncios, e aqui a mentira era maior:** este `<select>`
           * não tem opção vazia, então um nome salvo que não está neste canal fazia o navegador
           * marcar o PRIMEIRO modelo da lista — a tela mostrando um modelo que não é o gravado,
           * como se fosse. O rodízio continuava usando o salvo.
           */
          const foraDoCanal = nome.trim() && !state.hsmTemplates.some((m) => m.name === nome);
          if (foraDoCanal) {
            const o = h('option', { value: nome }, `${nome} (não é deste canal)`);
            o.setAttribute('selected', 'selected');
            sel.append(o);
          }
          for (const m of state.hsmTemplates) {
            const o = h('option', { value: m.name }, m.name);
            if (m.name === nome) o.setAttribute('selected', 'selected');
            sel.append(o);
          }
          sel.addEventListener('change', () =>
            withBusy(() => gravar(lista.map((x, j) => (j === i ? sel.value : x))))
          );
          linha.append(sel);
          if (foraDoCanal) linha.append(h('span', { class: 'wf-hint' }, '(salvo, mas não sai neste canal)'));
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
      const lista = await carregarAnuncios(perfilAtivo());
      anunciosNode.replaceChildren();

      const gravar = async (nova) => {
        await perfisLib.gravar('anuncios', perfilAtivo(), anunciosLib.normalizar(nova));
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
            /**
             * **O modelo salvo que este canal não tem CONTINUA na lista** — 25/09/2026, relato dele:
             * *"ao trocar os perfis está removendo os modelos setados para cada anúncio"*.
             *
             * Ele não estava sendo removido do armazenamento: o `<select>` só mostra o que está
             * entre as `option`, e os modelos aprovados são do CANAL. Trocando de candidato, o nome
             * salvo some da lista, o select cai no vazio e a tela diz "— escolha o modelo —" sobre
             * um valor que está gravado. **Parece apagado, e o primeiro clique em qualquer outro
             * campo deste cartão o apagaria de verdade.**
             *
             * O conserto é o que a caixa do modelo da rodada já fazia desde sempre, três mil linhas
             * acima: mostrar o salvo e DIZER que ele não é deste canal, em vez de engolir.
             */
            const foraDoCanal = anuncio.valor && !state.hsmTemplates.some((m) => m.name === anuncio.valor);
            if (foraDoCanal) {
              const o = h('option', { value: anuncio.valor }, `${anuncio.valor} (não é deste canal)`);
              o.setAttribute('selected', 'selected');
              alvo.append(o);
            }
            for (const m of state.hsmTemplates) {
              const o = h('option', { value: m.name }, m.name);
              if (m.name === anuncio.valor) o.setAttribute('selected', 'selected');
              alvo.append(o);
            }
            alvo.addEventListener('change', () =>
              withBusy(() => gravar(lista.map((x) => (x.id === anuncio.id ? { ...x, valor: alvo.value } : x))))
            );
            card.append(alvo);
            if (foraDoCanal) {
              card.append(
                h('div', { class: 'wf-block' },
                  `O modelo "${anuncio.valor}" continua salvo, mas não está entre os modelos aprovados ` +
                    'deste canal — ele não vai sair enquanto for assim. Escolha um da lista, ou volte ' +
                    'para o candidato dono deste anúncio.')
              );
            }
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

        card.append(h('div', { class: 'wf-preview', 'data-fica': '1' }, `→ ${anunciosLib.desfechoEmPortugues(anuncio)}`));
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
    lerContentTemplates().then((m) => (mapaArea.value = hsmLib.formatContentTemplates(m)));
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
        await perfisLib.gravar('contentTemplates', perfilAtivo(), parsed);
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
      state.templates = await templatesLib.save({ name, text: '' }, { perfil: perfilAtivo() });
      renderAll();
      // Abre o popup direto: sem isto você criaria a linha vazia e precisaria de mais um
      // clique em "Editar" para escrever o texto pela primeira vez.
      const criada = state.templates.find((t) => t.name === name && !t.text);
      if (criada) abrirEditorDeResposta(criada);
    });
    const resetBtn = h('button', { class: 'wf-btn', type: 'button' }, 'Restaurar padrão');
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Isso descarta suas respostas e volta às originais. Continuar?')) return;
      state.templates = await templatesLib.restoreDefaults({ perfil: perfilAtivo() });
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
      state.templates = await templatesLib.move(template.id, -1, { perfil: perfilAtivo() });
      renderAll();
    });
    const downBtn = h('button', { class: 'wf-btn wf-mini', type: 'button' }, '↓');
    downBtn.addEventListener('click', async () => {
      state.templates = await templatesLib.move(template.id, 1, { perfil: perfilAtivo() });
      renderAll();
    });
    const delBtn = h('button', { class: 'wf-btn wf-mini wf-danger', type: 'button' }, 'Excluir');
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Excluir "${template.name}"?`)) return;
      state.templates = await templatesLib.remove(template.id, { perfil: perfilAtivo() });
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
      // Esc SINTÉTICO não fecha nada: a extensão dispara um para fechar menu e diálogo do Material
      // (`dom.fecharOverlay`, `hsm`), e ele borbulha até aqui — fecharia o editor no meio da
      // digitação, perdendo o texto. Só teclado de verdade traz `isTrusted`.
      if (ev.key !== 'Escape' || !ev.isTrusted) return;
      ev.preventDefault();
      fechar();
    }
    document.addEventListener('keydown', aoTeclar, true);

    salvarBtn.addEventListener('click', () =>
      withBusy(async () => {
        const variantes = listaDeVariantes.valores();
        state.templates = await templatesLib.save(
          {
            id: template.id,
            name: nameInput.value,
            text: textArea.value,
            variantes,
          },
          { perfil: perfilAtivo() }
        );
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
      // Espera longa: fora do `withBusy`, senão o painel inteiro morre enquanto ele altera o campo pela
      // plataforma — é o mesmo defeito que travou "Começar pelos Novos" (20/09/2026).
      semTravarOPainel('contrato', () =>
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
    learnTags.addEventListener('click', () => semTravarOPainel('contrato', learnTagContract));

    const learnDate = h('button', { class: 'wf-btn', type: 'button' }, 'Aprender data (conclusão)');
    learnDate.addEventListener('click', () => semTravarOPainel('contrato', learnDateContract));

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
        state.templates = await templatesLib.list({ perfil: perfilAtivo() });
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
  /**
   * **Espera longa NAO pode passar por `withBusy`.**
   *
   * Print dele (20/09/2026): *"travou para começar os novos, o botão bloqueou"*. `withBusy` é um
   * interruptor **único** do painel (`if (state.busy) return`), então enquanto a extensão esperava ele
   * mandar a imagem à mão — até 200 s —, **todo** botão do painel morria em silêncio, inclusive
   * "Começar pelos Novos". E aprender é justamente a espera em que ele precisa das duas coisas: a
   * plataforma para agir e o painel para seguir trabalhando.
   *
   * Aqui a trava é por TAREFA, e é só isto que ela impede: começar a MESMA espera duas vezes.
   */
  async function semTravarOPainel(chave, fn) {
    if (state.esperando[chave]) return undefined;
    state.esperando[chave] = true;
    renderAll();
    try {
      return await fn();
    } catch (err) {
      setStatus(err?.message || String(err), 'err');
      return undefined;
    } finally {
      state.esperando[chave] = false;
      try {
        renderAll();
      } catch (err) {
        console.warn('[WhatsFill] falha ao redesenhar o painel:', err);
      }
    }
  }

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
      await lerChavesDaIA();
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
/**
 * **Os anúncios DESTE candidato** — 24/09/2026, ver `lib/perfis.js`.
 *
 * O de fábrica lê a chave de sempre, e a migração da tabela antiga continua valendo só para ele:
 * `modeloPorTexto` é dado de antes de existirem perfis, e semeá-lo num candidato novo daria a ele
 * os anúncios do outro. Perfil novo começa com a lista VAZIA — a tela diz isso, e sem anúncio
 * cadastrado o painel só sabe que a pessoa veio de um anúncio, não de qual.
 */
async function carregarAnuncios(perfil = null) {
  if (perfil && perfil !== perfisLib.PERFIL_PADRAO) {
    return anunciosLib.normalizar((await perfisLib.ler('anuncios', perfil, [])) || []);
  }
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
/**
 * **O perfil vem por ARGUMENTO, e isso não é estilo: esta função é de MÓDULO.**
 *
 * `perfilAtivo()` mora dentro da closure do painel, e chamá-la daqui é `ReferenceError` em TODO
 * contato — foi o que a v3.123 fez, e o relato dele foi *"iniciei o automatizado mas não está
 * fazendo nada"*. É a mesma armadilha do `dom.numeroDaConversa()` chamado do painel (25/09), e o
 * verificador de referências não pega: ele não vê escopo.
 *
 * `carregarAnuncios(perfil)`, logo acima, já recebia o perfil por argumento pela mesma razão.
 */
async function carregarModelosPadrao(perfil = null) {
  const lista = await perfisLib.ler('modelosPadraoAnuncio', perfil, []);
  if (Array.isArray(lista) && lista.length) return lista.map((m) => String(m || '').trim()).filter(Boolean);

  const unico = String((await perfisLib.ler('modeloPadraoAnuncio', perfil, '')) || '').trim();
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
/**
 * **O texto pré-preenchido do anúncio tem forma fixa: "Olá! Eu ..."**
 *
 * Todos os anúncios desta campanha geram a mesma abertura — *"Olá! Eu apoio as Escolas
 * Cívico-Militares"*, *"Olá! Eu escolho o Lado de Quem Produz"*, *"Olá! Eu estou do lado da
 * segurança..."*, *"Olá! Eu quero receber o Material da Direita"*.
 *
 * Serve para marcar o **segundo e o terceiro** cliques, que a marca de posição não alcança: ela
 * cobre só a primeira mensagem da sessão. Print da Irene (05/09/2026): três cliques seguidos, e
 * apenas um deles era reconhecido.
 *
 * As guardas existem porque isto é texto, não dado: só vale **dentro de uma sessão que veio de
 * anúncio**, e a mensagem não pode ter "?" nem ser longa — quem escreve *"Olá! Eu queria saber se
 * vocês têm..."* está falando, e o texto do anúncio é curto e afirmativo.
 */
const ABERTURA_DE_ANUNCIO = /^\s*ol[áa]!?[\s,]+eu\s+\S/i;

function pareceCliqueDeAnuncio(texto) {
  const t = String(texto || '').trim();
  if (!t || t.length > 160 || t.includes('?')) return false;
  return ABERTURA_DE_ANUNCIO.test(t);
}

function prepararEntrantes(entrantes, { veioDeAnuncio = false, anuncios = [] } = {}) {
  let primeiraDela = true;
  /**
   * **O lote de áudio encaminhado é marcado AQUI**, junto do ruído da plataforma e do texto
   * gerado pelo anúncio: um lugar só, antes de qualquer regra ver. Ver
   * `cortesia.marcarLoteEncaminhado` — e a print da Irene (07/09/2026), em que cinco áudios de
   * outra conversa chegaram em dois segundos e a IA respondeu o que estava dentro deles.
   */
  return marcarLoteEncaminhado(entrantes || []).map((m) => {
    const marcada = ehMensagemDaPlataforma(m?.texto)
      ? { ...m, texto: '', transcrito: false, sistema: true }
      : { ...m };
    const temTexto = !marcada.sistema && String(marcada.texto || '').trim();
    /**
     * **Só marca a primeira se ela tiver cara de texto pronto** — print do Rodrigo (10/09/2026): o
     * anúncio CONVERSE CONOSCO não traz texto, a primeira mensagem era o pedido DELE, e a marca o
     * apagava de todos os detectores. Ver `cortesia.pareceTextoProntoDeAnuncio`. Não tendo cara, a
     * mensagem é dela, e a "primeira" acaba ali.
     */
    /**
     * **O DADO que ele cadastrou vence a heurística** — 25/09/2026, print do Valdeci.
     *
     * Ele chegou pelo anúncio do Pedri e escreveu *"Gostaria de receber material da direita :"* —
     * o texto pré-preenchido, cadastrado na Config palavra por palavra, com a ação "mandar o
     * modelo Material de Campanha". **O modelo não saiu**: a IA escreveu um texto que ele apagou.
     *
     * Medido: `ehOTextoDoAnuncio` dava **true** e `pareceTextoProntoDeAnuncio` dava **false**,
     * porque a heurística exige abrir com "Olá" e este anúncio não abre. Sem a marca, o texto do
     * anúncio contou como fala dele — `pedeMaterialEscrito` e `falouAlgoProprio` ligaram, e os dois
     * levam à tecla 6. Com a marca, os dois se calam e o caso volta para o recibo.
     *
     * **É a guarda do Rodrigo (10/09) mordendo pelo outro lado:** ela existe para não apagar a fala
     * de quem chega por anúncio SEM texto pronto, e estava rejeitando um texto pronto de verdade só
     * porque a redação mudou. A lista de redações não fecha — o que fecha é o que ELE cadastrou.
     *
     * A guarda que torna isto seguro já existe dentro de `ehOTextoDoAnuncio`: o trecho reconhecido
     * tem de cobrir **60%** da mensagem, então o pedido dela emendado no texto do anúncio continua
     * contando como fala dela.
     */
    const ehOTextoCadastrado = temTexto && anunciosLib.ehOTextoDoAnuncio(marcada.texto, anuncios);
    if (primeiraDela && veioDeAnuncio && temTexto && !pareceTextoProntoDeAnuncio(marcada.texto) && !ehOTextoCadastrado) {
      primeiraDela = false;
    } else if (primeiraDela && veioDeAnuncio && temTexto) {
      marcada.geradaPeloAnuncio = true;
      /**
       * **Só ESTA dá para nomear.** A identidade do anúncio vem do `utm`, que é da SESSÃO — então
       * ela pertence ao clique que abriu a sessão, e não ao segundo nem ao terceiro, que são
       * reconhecidos pela FORMA do texto e podem ser de outro anúncio (a Irene clicou em três,
       * 05/09). Ver `marcaDaMensagem`.
       */
      marcada.anuncioDaSessao = true;
      primeiraDela = false;
    } else if (veioDeAnuncio && temTexto && (pareceCliqueDeAnuncio(marcada.texto) || ehOTextoCadastrado)) {
      marcada.geradaPeloAnuncio = true;
    }
    return marcada;
  });
}

function truncate(text, max) {
  const s = String(text || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
