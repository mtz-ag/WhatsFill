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
import { extract } from '../lib/extract.js';
import { SENTINEL, SENTINEL_DATE_NEEDLES, SENTINEL_DATE_HUMANO } from '../lib/contract.js';
import { looksLikePlaceholder, nomeVeioDoPerfil } from '../lib/vars.js';

const GROUP_TEMPLATE_ID = 'link-grupo';
const THANKS_TEMPLATE_ID = 'agradecimento';
/** Agradece a mensagem e fecha, sem abrir demanda. É a saída da tecla 4. */
const THANKS_INFO_TEMPLATE_ID = 'agradecer-info';
const ASK_TEMPLATE_ID = 'pedir-dados';
const INTEREST_TEMPLATE_ID = 'interesse-conteudo';

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

  const state = {
    tab: 'respostas',
    pageState: { sessionId: null, isPending: false, hasComposer: false, dark: false, conversation: '' },
    session: null,
    contact: null,
    schema: [],
    classify: [],
    draft: {}, // fieldId -> { value, from, confidence, source, suggestions }
    tagSuggestions: [], // [{ origem, nome, tag, motivo, marcada }]
    templates: [],
    hsmTemplates: [], // modelos aprovados da plataforma
    hsmFilter: '',
    hasContract: false, // contrato de escrita já aprendido?
    settings: {},
    /** Aba Automatizado: a rodada de tentativa de contato com quem não respondeu. */
    auto: {
      cfg: { templateId: '', templateName: '', limite: 20, pausaSeg: 8 },
      rodando: false,
      parar: false,
      fila: [], // retrato da fila da plataforma, só para conferência
      log: [], // { nome, resultado, motivo } de cada contato da rodada
    },
    incoming: [],
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
    ['config', 'Config'],
  ]) {
    const btn = h('button', { type: 'button' }, label);
    btn.dataset.tab = id;
    btn.addEventListener('click', () => {
      state.tab = id;
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
      await load(next.sessionId);
      return;
    }

    renderAll();

    // Mesmo atendimento, mensagem nova: o contato respondeu enquanto você olhava a conversa.
    // Sem isto o painel só reanalisaria quando você saísse do atendimento e voltasse.
    if (conversaMudou) await reexaminarMensagens();
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
      state.incoming = conversa.incoming;
      state.ultimaMensagem = conversa.ultima;

      // Sinal disparado por mensagem NOSSA (ou mídia): nada novo do contato para analisar.
      if (state.incoming.length <= antes) return;

      const temaField = state.classify.find((f) => f.name === 'Tema de Interesse');
      // applyGuesses só preenche buraco: valor do CRM e correção sua nunca são sobrescritos.
      applyGuesses(await extract(state.incoming, { temaField }), state.classify);
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
    state.session = null;
    state.contact = null;
    state.draft = {};
    state.tagSuggestions = [];
    state.incoming = [];
    state.cidadeRecusada = new Set();
    state.ultimaMensagem = null;
    state.hsmTemplates = [];
    state.error = null;
    state.hasContract = !!(await store.get('writeContract'))?.entries?.length;
    state.settings = await store.get('settings');
    state.auto.cfg = await store.get('auto');
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
      state.incoming = conversa.incoming;
      state.ultimaMensagem = conversa.ultima;
      const temaField = classify.find((f) => f.name === 'Tema de Interesse');
      const palpites = await extract(state.incoming, { temaField });
      applyGuesses(palpites, classify);

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
    if (cidadeField && !state.draft[cidadeField.id]) {
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
    const campo = fieldNamed('Cidade');
    const entry = campo && state.draft[campo.id];
    if (!entry?.pendente || entry.from !== 'palpite') return;
    if (entry.value == null || entry.value === '') return;
    if (somenteExatos && entry.confidence !== 'exata') return;

    const doCadastro = entry.source === FONTE_CIDADE_CADASTRO;
    const linhas = [`Encontrei "${entry.value}" como cidade.`];
    if (doCadastro) {
      linhas.push('⚠ A pessoa não disse isso na conversa — veio só do formato "Cidade - Nome" do cadastro.');
    } else {
      linhas.push(`De onde saiu: ${entry.source || 'mensagem do contato'}`);
      if (entry.confidence !== 'exata') linhas.push('⚠ Não casou exato com a lista do IBGE — é palpite.');
    }
    if (entry.substituiu) linhas.push(`⚠ Vai SUBSTITUIR a cidade que está no CRM ("${entry.substituiu}").`);

    const escolha = await perguntarNaRodada({
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

    if (escolha === 'aceitar') {
      state.draft[campo.id] = { ...entry, pendente: false };
    } else if (escolha === 'semcidade') {
      // Marcado como 'manual' (não 'palpite'): `corrigirNomeComCidade` e `applyGuesses` só
      // preenchem campo vazio de verdade, e aqui ele NÃO está — é uma resposta, "não tem cidade".
      state.cidadeRecusada.add(cities.normalize(entry.value));
      state.draft[campo.id] = { value: '', from: 'manual' };
      setStatus('Sem cidade — nada vai ser gravado nesse campo.');
    } else {
      // Esc também cai aqui: na dúvida não grava. Vale para a rodada — parar a rodada não pode
      // significar "então grava a cidade que eu não confirmei".
      state.cidadeRecusada.add(cities.normalize(entry.value));
      delete state.draft[campo.id];
      setStatus(`Cidade "${entry.value}" descartada — preencha na aba Dados.`, 'err');
    }
    // A etiqueta de COREDE sai da cidade: recusada a cidade, a região tem que sair junto, senão
    // o contato fica com o COREDE de uma cidade que você acabou de recusar.
    await refreshTagSuggestions();
    renderAll();
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
      const [perguntado, etiquetasInteresse] = await Promise.all([
        templatesLib.wasSent(state.contact.id, INTEREST_TEMPLATE_ID),
        store.get('etiquetasInteresse'),
      ]);

      const sugeridas = await tagsLib.suggest({
        city: valueNamed('Cidade'),
        texts: state.incoming,
        extra: [state.session?.utm?.campaign, state.session?.utm?.headline].filter(Boolean).join(' '),
        interesse: { perguntado: !!perguntado, etiquetas: etiquetasInteresse },
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
      ['Função', guesses.funcao],
      ['Partido', guesses.partido],
      ['Tema de Interesse', guesses.tema],
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
    else renderConfig();
  }

  function renderHeader() {
    header.replaceChildren();

    const reload = h('button', { class: 'wf-btn wf-mini', type: 'button' }, 'Recarregar');
    reload.addEventListener('click', () => withBusy(refresh));
    header.append(h('div', { class: 'wf-conn' }, [h('span', {}, state.connection), reload]));

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
    fechar.disabled = conteudos.length !== 1;
    const cartaoFechar = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Atender o pedido e encerrar'),
      h('div', { class: 'wf-preview' }, conteudos.length === 1
        ? `Envia o modelo de "${conteudos[0].nome}", agradece, grava a classificação e conclui.`
        : 'Envia o modelo do conteúdo pedido, agradece, grava a classificação e conclui.'),
      fechar,
    ]);
    if (!conteudos.length) {
      cartaoFechar.append(h('div', { class: 'wf-block' }, 'Nenhum conteúdo reconhecido nas mensagens deste contato.'));
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

  // ---- modelos de mensagem (templates aprovados da plataforma) ------------

  /**
   * Diferente das respostas prontas, o texto do modelo é fixo e aprovado — o WhatsFill não
   * interpola nada nele. O valor aqui é o acesso rápido e, principalmente, funcionar com a
   * janela de 24h expirada.
   */
  function renderModelos() {
    body.append(h('hr', { class: 'wf-sep' }), h('h3', { class: 'wf-h' }, 'Modelos de mensagem'));

    if (!state.hsmTemplates.length) {
      body.append(
        h('p', { class: 'wf-hint' }, 'Nenhum modelo aprovado encontrado para este canal. Clique em Recarregar se acabou de cadastrar um.')
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
      if (!conteudos.length) {
        setStatus('Nenhum conteúdo reconhecido nas mensagens deste contato. Envie o modelo à mão.', 'err');
        return;
      }
      if (conteudos.length > 1) {
        setStatus(
          `O contato casou com ${conteudos.length} conteúdos (${conteudos.map((c) => c.nome).join(', ')}). ` +
            'Não vou escolher por você — envie o modelo à mão.',
          'err'
        );
        return;
      }

      const mapa = await store.get('contentTemplates');
      const { modelo, erro } = hsmLib.templateParaConteudo(conteudos[0].nome, mapa, state.hsmTemplates);
      if (erro) return setStatus(erro, 'err');

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
      if (!(await saveClassification({ withCompletionDate: true, quiet: true }))) return;

      setStatus(`2/4 enviando o modelo "${modelo.name}"…`);
      if (!(await enviarModelo(modelo, { send: true }))) return;

      if (agradecimento) {
        setStatus('3/4 agradecendo…');
        if (!(await sendTemplate(agradecimento, { send: true }))) return;
      }

      setStatus('4/4 concluindo…');
      await concluirEAbrirProximo('Enviado e classificado');
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
      const { text, missing, reasons } = vars.render(template.text, ctx);
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
      funcao: valueNamed('Função'),
      partido: valueNamed('Partido'),
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
    const { text, missing, reasons } = vars.render(template.text, await currentVarContext());

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
    setStatus(`Enviado: ${template.name}`, 'ok');
    return true;
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
      concluido = await page.clickConcluir();
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
      if (!(await saveClassification({ withCompletionDate: true, quiet: true }))) return;

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
      if (!(await saveClassification({ withCompletionDate: true, quiet: true }))) return;

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

    body.append(renderCartaoRitmo(cfg));
    body.append(renderCartaoFila());
    body.append(renderCartaoNovos(cfg));
    body.append(renderCartaoMomento(cfg));
    body.append(renderCartaoRespondidos());
    body.append(renderCartaoSemRetorno(cfg, modeloDaRodada()));

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
    return card;
  }

  /** Limite, pausa e o Parar — valem para qualquer rodada. */
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
   * Rodada 1: a fila dos Novos, que chega do anúncio com uma frase só.
   *
   * Só entra quem tem o aceite do anúncio e **nada mais**: se a pessoa já escreveu nome ou
   * cidade, o pedido de dados não é o que falta e ela fica para a classificação normal.
   */
  function renderCartaoNovos(cfg) {
    const template = state.templates.find((t) => t.id === ASK_TEMPLATE_ID);
    const card = h('div', { class: 'wf-card' }, [
      h('h4', {}, 'Novos: pedir os dados'),
      h('div', { class: 'wf-preview' },
        'Percorre a aba "Novos": assume o atendimento, manda o pedido de nome e cidade, conclui ' +
          'e volta para os Novos. Só recebe mensagem quem tem o aceite do anúncio e ainda não ' +
          'disse nome nem cidade. Os demais são apenas assumidos, sem receber nada — saem da ' +
          'fila e ficam em "Meus" para você ver depois. A fila esvazia.'),
    ]);

    card.append(
      campoTexto('Frase que identifica o aceite do anúncio', cfg.padraoNovos, (v) =>
        salvarAuto({ padraoNovos: v.trim() }).then(renderAll)
      )
    );

    const comecar = h('button', { class: 'wf-btn wf-primary', type: 'button' }, 'Começar pelos Novos');
    comecar.addEventListener('click', () => withBusy(runLoteNovos));
    card.append(h('div', { class: 'wf-row' }, [comecar]));

    const impedimentos = [];
    if (!template) impedimentos.push(`Não achei a resposta "${ASK_TEMPLATE_ID}" na aba Config.`);
    if (!cfg.padraoNovos) impedimentos.push('Sem a frase do aceite, a rodada mandaria para qualquer um da fila.');
    if (!state.settings.autoSend) impedimentos.push('Precisa do "Enviar automático" ligado (acima).');

    comecar.disabled = state.auto.rodando || impedimentos.length > 0;
    for (const motivo of impedimentos) card.append(h('div', { class: 'wf-block' }, motivo));
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

  const SINAL_RODADA = { enviado: '✓', concluido: '▪', pulado: '–', triado: '→', erro: '×', fim: '■' };

  /** Resultados em que o contato deixa a lista: a posição não pode avançar junto. */
  const SAI_DA_FILA = new Set(['triado', 'concluido']);
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

      if (r.resultado === 'enviado') {
        enviados++;
        state.lastSendAt = Date.now();
      }

      // `parar` vale para qualquer resultado, não só para envio: o Esc da pergunta e o diálogo
      // de motivo de conclusão podem cair em qualquer um deles.
      if (r.parar) {
        interrompida = r.motivo;
        break;
      }

      // Contato que CONTINUA na lista depois de tratado (rodada dos concluídos: reiniciar e
      // concluir devolve ele para a mesma fila, agora no topo). Sem andar uma casa, a rodada
      // reabriria o mesmo atendimento — `visitados` até protege, mas ao custo de uma abertura
      // extra por contato, e abertura é o que derruba a API.
      if (r.resultado === 'enviado' && r.continuaNaFila) posicao++;

      if (r.resultado !== 'enviado') {
        // Saiu da fila (assumido ou concluído): o próximo escorrega para esta mesma posição.
        // "pulado" continua na lista, então precisa andar uma casa para não repetir.
        if (!SAI_DA_FILA.has(r.resultado)) posicao++;

        // Pulo custa à API o mesmo que envio: abre a sessão na plataforma e faz três chamadas
        // nossas. Vinte pulos seguidos sem respiro derrubaram a API (o preflight passou a ser
        // recusado, e "Failed to fetch" é o que o navegador mostra nesse caso) — e derrubaram a
        // plataforma junto. A pausa longa protege o número no WhatsApp; esta protege o servidor.
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

      if (enviados < limite && !state.auto.parar) {
        setStatus(`${enviados}/${limite} enviado(s). Pausa de ${pausaMs / 1000}s…`);
        const pausa = await pausarRodada(pausaMs);
        if (pausa.congelou) {
          const gelo = await lidarComCongelamento(pausaMs, pausa.gasto);
          if (gelo.parar) {
            interrompida = gelo.motivo;
            break;
          }
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
  async function rodar({ aba, processar }) {
    const limite = clampInt(state.auto.cfg.limite, 1, 200);
    const pausaMs = clampInt(state.auto.cfg.pausaSeg, 3, 300) * 1000;

    state.auto.rodando = true;
    state.auto.parar = false;
    state.auto.log = [];
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
    }

    const conta = (tipo) => state.auto.log.filter((l) => l.resultado === tipo).length;
    const triados = conta('triado');
    const concluidos = conta('concluido');
    const resumo =
      `Rodada encerrada: ${resultado.enviados} enviado(s), ${conta('pulado')} pulado(s)` +
      (concluidos ? `, ${concluidos} concluído(s) sem enviar` : '') +
      (triados ? `, ${triados} assumido(s) para triagem em "Meus"` : '') + '.';

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
      (state.auto.parar ? 'Parada por você.' : `Limite de ${limite} envio(s) atingido.`);

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
    const template = state.templates.find((t) => t.id === ASK_TEMPLATE_ID);
    if (!template) return setStatus(`Não achei a resposta "${ASK_TEMPLATE_ID}". Confira a aba Config.`, 'err');
    if (!state.settings.autoSend) {
      return setStatus('Ligue o "Enviar automático" na aba Config antes de rodar.', 'err');
    }
    const padrao = String(state.auto.cfg.padraoNovos || '').trim();
    if (!padrao) return setStatus('Defina a frase que identifica o aceite do anúncio.', 'err');

    const limite = clampInt(state.auto.cfg.limite, 1, 200);
    const pausaSeg = clampInt(state.auto.cfg.pausaSeg, 3, 300);

    if (
      !confirm(
        `Vou percorrer a aba "Novos" e pedir os dados para até ${limite} contato(s), ` +
          `concluindo cada atendimento, com ${pausaSeg}s entre um envio e outro.\n\n` +
          `Só entra quem tem "${padrao}" na conversa e ainda não disse nome nem cidade. Confirma?`
      )
    ) {
      return setStatus('Rodada cancelada.');
    }

    await rodar({ aba: 'Novos', processar: (sessionId, ctx) => processarNovo(sessionId, template, padrao, ctx) });
  }

  /**
   * Um contato da fila dos Novos: confere que só há o aceite do anúncio, assume, pede os dados
   * e conclui.
   *
   * A conferência é o coração desta rodada. Mandar o formulário para quem já escreveu o nome —
   * ou para quem está no meio de uma conversa de verdade — é o erro caro aqui, e ele é barato
   * de evitar: o parser já sabe dizer se saiu nome ou cidade das mensagens.
   */
  async function processarNovo(sessionId, template, padrao, ctx) {
    let nome = 'contato';
    try {
      const sessao = await api.getSession(sessionId);
      const contato = await api.getContact(sessao.contactId);
      nome = contato.name || contato.nameWhatsapp || 'sem nome';

      // Janela vencida: texto livre não sai. Esse é caso da outra rodada, não desta.
      if (sessao.expired) {
        return { nome, resultado: 'pulado', motivo: 'janela de 24h vencida — é caso de modelo aprovado' };
      }

      // Quem não traz o identificador do anúncio não é caso desta rodada — mas deixar em
      // "Novos" faz toda rodada futura abrir o contato de novo, e é justamente isso que
      // sobrecarrega a API. Assumir tira da fila sem mandar nada: vira pilha de triagem manual
      // em "Meus". Nenhuma mensagem sai daqui.
      const mensagens = await api.getIncomingText(sessionId);
      if (!mensagens.length) {
        return assumirParaTriagem(sessionId, nome, 'não escreveu nada');
      }
      if (!mensagens.some((m) => achatarTexto(m).includes(achatarTexto(padrao)))) {
        return assumirParaTriagem(sessionId, nome, 'sem o aceite do anúncio');
      }

      // Quem já respondeu nome ou cidade não precisa do formulário: precisa da classificação,
      // que é manual. Deixar em "Novos" o prendia na fila para sempre — ocupando posição em toda
      // rodada futura. Assumido, ele espera em "Meus" junto com o resto da triagem.
      const achados = await extract(mensagens, {});
      if (achados.nome || achados.cidade) {
        return assumirParaTriagem(sessionId, nome, 'já informou nome ou cidade — vai pela classificação');
      }

      // Fora do `if (antiDup)` de propósito: não é preferência, é a mesma pessoa duas vezes na
      // mesma rodada. Ver `contatosTratados` em `percorrerFila`.
      if (ctx?.contatosTratados?.has(contato.id)) {
        return { nome, resultado: 'pulado', motivo: 'já tratei este contato nesta rodada' };
      }

      if (state.settings.antiDup) {
        const quando = await templatesLib.wasSent(contato.id, template.id);
        if (quando) {
          return {
            nome,
            resultado: 'pulado',
            motivo: `já recebeu o pedido de dados em ${new Date(quando.at).toLocaleDateString('pt-BR')}`,
          };
        }
      }

      // O contexto é montado para ESTE contato: a rodada não passa pelo `load()` do painel.
      const { text, missing, reasons } = vars.render(template.text, await vars.buildContext({ contact: contato }));
      if (missing.length) return { nome, resultado: 'erro', motivo: vars.explainMissing(missing, reasons) };

      let estado = await page.getState();
      if (estado.sessionId !== sessionId) {
        return { nome, resultado: 'erro', motivo: 'a aba trocou de atendimento no meio do caminho' };
      }
      if (estado.isPending) {
        setStatus(`Assumindo o atendimento de ${nome}…`);
        estado = await page.clickIniciar();
      }
      if (estado.isPending || !estado.hasComposer) {
        // As duas causas pedem conserto diferente, então não vale colapsar numa frase só.
        return {
          nome,
          resultado: 'erro',
          motivo: estado.isPending
            ? 'a plataforma não assumiu o atendimento (o botão Iniciar continua na tela)'
            : 'o campo de mensagem não apareceu depois de assumir o atendimento',
        };
      }

      setStatus(`Pedindo os dados para ${nome}…`);
      await page.sendText(text);
      await templatesLib.markSent(contato.id, template.id, { nome });
      ctx?.contatosTratados?.add(contato.id);

      const concluido = await page.clickConcluir();
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
          motivo: 'enviado, mas a plataforma pediu motivo de conclusão — responda o diálogo na aba',
        };
      }
      return { nome, resultado: 'enviado' };
    } catch (err) {
      await page.closeOverlay().catch(() => {});
      return { nome, resultado: 'erro', motivo: traduzirErroDeRede(err.message) };
    }
  }

  /**
   * Assume o atendimento e não envia nada, só para o contato sair de "Novos".
   *
   * O ganho é duplo: você tem uma pilha de triagem em "Meus" em vez de gente perdida no meio da
   * fila, e a rodada seguinte não gasta requisição reabrindo quem já foi avaliado — que era o
   * que derrubava a API.
   *
   * Assumido some da lista de "Novos", então quem chama **não** avança a posição: o próximo
   * escorrega para o lugar deste.
   */
  async function assumirParaTriagem(sessionId, nome, motivo) {
    const estado = await page.getState();
    if (estado.sessionId !== sessionId) {
      return { nome, resultado: 'erro', motivo: 'a aba trocou de atendimento no meio do caminho' };
    }
    if (!estado.isPending) {
      // Já estava assumido: sai da fila sozinho, nada a fazer.
      return { nome, resultado: 'triado', motivo: `${motivo} — já estava assumido` };
    }

    await page.clickIniciar();
    return { nome, resultado: 'triado', motivo: `${motivo} — assumido para você ver depois` };
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

      const conteudos = state.tagSuggestions.filter((s) => s.origem === 'conteúdo');
      let modelo = null;
      let semModelo = '';
      let conteudoEscolhido = null;
      let desempatado = false;

      const escolha0 = hsmLib.escolherConteudo(conteudos, await store.get('conteudoPreferido'));
      if (escolha0.erro) {
        semModelo = escolha0.erro;
      } else {
        conteudoEscolhido = escolha0.conteudo;
        desempatado = !!escolha0.desempatado;
        const mapa = await store.get('contentTemplates');
        const achado = hsmLib.templateParaConteudo(conteudoEscolhido.nome, mapa, state.hsmTemplates);
        modelo = achado.modelo || null;
        semModelo = achado.erro || '';
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
      const infoTrava = agradecerInfo
        ? vars.render(agradecerInfo.text, contexto).missing.length > 0
        : true;

      // A mensagem da ocasião vira um template de mentira, para reaproveitar o caminho de envio
      // inteiro: variáveis, anti-duplicata e registro. A chave inclui um resumo do texto, senão
      // trocar de data (Dia dos Pais -> Natal) seria barrado pelo anti-duplicata da anterior.
      const textoMomento = String(state.auto.cfg.mensagemMomento || '').trim();
      const momento = textoMomento
        ? { id: `momento:${chaveDoTexto(textoMomento)}`, name: 'Mensagem do momento', text: textoMomento }
        : null;
      const momentoTrava = momento ? vars.render(momento.text, contexto).missing.length > 0 : true;

      // A pergunta de interesse (tecla 7): só faz sentido para quem NÃO tem etiqueta de
      // conteúdo. Quem já pediu conteúdo tem modelo para receber, não pergunta.
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
        const fechouRespondido = await page.clickConcluir();
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
      for (const t of [agradecerInfo, momento, interesse].filter(Boolean)) {
        const envio = await templatesLib.wasSent(state.contact.id, t.id);
        if (envio && ehHoje(envio.at)) textosDeHoje.push(`"${t.name}" às ${formatarHora(envio.at)}`);
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
      const opcoes = [];
      if (podeEnviar) {
        opcoes.push({
          tecla: '1',
          valor: 'enviar',
          rotulo: enviadoHoje ? `Mandar de novo "${modelo.name}"` : `Mandar modelo "${modelo.name}"`,
          // Enviado hoje deixa de ser a opção destacada: repetir tem que ser decisão, não inércia.
          primaria: !enviadoHoje,
        });
      }
      opcoes.push({ tecla: '2', valor: 'pular', rotulo: 'Pular (deixa aberto)' });
      opcoes.push({ tecla: '3', valor: 'concluir', rotulo: 'Concluir sem enviar' });
      if (!infoTrava) {
        // Primária quando não há modelo: em "Outros" é a saída esperada.
        // "Agradecer e concluir" ficava confuso ao lado da tecla 1, que também agradece. O
        // rótulo diz o que esta resposta é: o agradecimento de quem mandou informação e não
        // pediu nada (vídeo, link, "bom dia").
        opcoes.push({
          tecla: '4',
          valor: 'agradecer',
          rotulo: 'Agradecer informações e concluir',
          primaria: !podeEnviar && !podePerguntarInteresse,
        });
      }
      if (!momentoTrava) {
        opcoes.push({ tecla: '5', valor: 'momento', rotulo: 'Mensagem do momento e concluir' });
      }
      opcoes.push({ tecla: '6', valor: 'responder', rotulo: 'Responder à mão (retomo quando você concluir)' });
      if (podePerguntarInteresse) {
        opcoes.push({
          tecla: '7',
          valor: 'interesse',
          rotulo: interessePerguntado
            ? 'Perguntar interesse DE NOVO (já perguntei antes)'
            : 'Perguntar interesse + pedir nome e cidade, e concluir',
          primaria: !podeEnviar && !interessePerguntado,
        });
      }

      const escolha = await perguntarNaRodada({
        titulo: nome,
        linhas: [
          valueNamed('Cidade')
            ? ['Cidade: ', ...cidadeMarcada(), cidadeSubstituida()]
            : 'Cidade: (vazia)',
          `Etiquetas: ${etiquetas.join(', ') || '(nenhuma)'}`,
          modelo
            ? `Conteúdo pedido: ${conteudoEscolhido.nome}` +
              (desempatado ? ` (casou com ${conteudos.length}, escolhi o preferido)` : '')
            : `Sem modelo: ${semModelo}`,
          modeloTravado ? `Modelo "${modelo.name}" travado: ${modeloTravado}` : '',
          enviadoHoje
            ? `⚠ "${modelo.name}" JÁ FOI ENVIADO hoje, às ${formatarHora(jaEnviado.at)}` +
              (jaEnviado.nome ? ` (para ${jaEnviado.nome})` : '') +
              '. Confirme antes de mandar de novo.'
            : '',
          textosDeHoje.length ? `⚠ Hoje este contato já recebeu: ${textosDeHoje.join(', ')}.` : '',
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
        pergunta: podeEnviar
          ? `Enviar o modelo "${modelo.name}" + agradecimento e concluir?`
          : modeloTravado
            ? 'O modelo existe, mas o agradecimento não sai sem o nome. Corrija o nome na aba Dados ou escolha outra saída.'
            : 'Não há modelo de conteúdo para este contato. O que fazer?',
        opcoes,
      });

      if (escolha === 'parar') {
        return { nome, resultado: 'pulado', parar: true, motivo: 'você parou a rodada' };
      }

      if (escolha === 'pular') {
        await saveClassification({ withCompletionDate: true, quiet: true });
        return { nome, resultado: 'pulado', motivo: 'você pulou — classificação gravada, atendimento aberto' };
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
      if (escolha === 'agradecer' || escolha === 'momento' || escolha === 'interesse') {
        const texto =
          escolha === 'agradecer' ? agradecerInfo : escolha === 'momento' ? momento : interesse;
        const rotulo =
          escolha === 'agradecer'
            ? 'agradecido'
            : escolha === 'momento'
              ? 'mensagem do momento enviada'
              : 'perguntei o interesse no conteúdo';

        await saveClassification({ withCompletionDate: true, quiet: true });
        if (!(await sendTemplate(texto, { send: true, jaConfirmado: true }))) {
          return { nome, resultado: 'erro', motivo: `${texto.name} não saiu` };
        }
        const fechouTexto = await page.clickConcluir();
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

      if (escolha === 'concluir') {
        await saveClassification({ withCompletionDate: true, quiet: true });
        const fechou = await page.clickConcluir();
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
      if (agradecimento && !(await sendTemplate(agradecimento, { send: true, jaConfirmado: true }))) {
        return { nome, resultado: 'erro', motivo: 'o modelo saiu mas o agradecimento não' };
      }

      const concluido = await page.clickConcluir();
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
  function perguntarNaRodada({ titulo, linhas = [], pergunta, opcoes, respostas = [], dica = 'Esc para parar a rodada' }) {
    return new Promise((resolve) => {
      const caixa = h('div', { class: 'wf-pergunta' });
      const fundo = h('div', { class: 'wf-pergunta-fundo' }, [caixa]);

      const barra = h('div', { class: 'wf-pergunta-titulo' }, titulo);
      caixa.append(barra);
      tornarArrastavel(caixa, barra);
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
        const btn = h(
          'button',
          { class: `wf-btn ${opcao.primaria ? 'wf-primary' : ''}`, type: 'button' },
          `${opcao.tecla}  ${opcao.rotulo}`
        );
        btn.addEventListener('click', () => fechar(opcao.valor));
        botoes.push(btn);
        linhaBotoes.append(btn);
      }
      caixa.append(linhaBotoes);
      if (respostas.length) caixa.append(montarRespostasRapidas(respostas));
      caixa.append(h('div', { class: 'wf-pergunta-dica' }, dica));

      function aoTeclar(ev) {
        // Você está digitando na conversa: o "2" é um dois, não a tecla Pular.
        //
        // Antes a camada da pergunta bloqueava a página inteira e não havia como estar
        // digitando em lugar nenhum. Agora que a conversa é clicável (para você ler e responder
        // sem parar a rodada), o atalho tem que sair da frente de quem está escrevendo — senão
        // o número vai para a decisão e o atendimento fecha no meio de uma frase.
        if (ehCampoDeTexto(ev.composedPath?.()[0] || ev.target)) return;

        const opcao = opcoes.find((o) => o.tecla === ev.key);
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

      // Captura no documento: o shadow root não recebe tecla quando o foco está na página.
      document.addEventListener('keydown', aoTeclar, true);
      root.append(fundo);
      // De novo agora que a caixa está na tela: fora do DOM ela não tem altura, e o limite de
      // "não sair da janela" sairia calculado por estimativa.
      aplicarPosicao(caixa, state.settings.perguntaPos);
      botoes[0]?.focus();
    });
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
  function tornarArrastavel(caixa, alca) {
    aplicarPosicao(caixa, state.settings.perguntaPos);

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
      state.settings.perguntaPos = pos;
      // Grava relendo o storage: a Config mexe no mesmo objeto por outro caminho.
      salvarAjuste({ perguntaPos: pos }).catch(() => {});
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
      return;
    }
    caixa.classList.add('wf-pergunta-solta');
    const largura = caixa.offsetWidth || 460;
    const altura = caixa.offsetHeight || 200;
    // Deixa sempre uma faixa visível, mesmo que a caixa seja mais alta que a janela.
    const maxLeft = Math.max(0, window.innerWidth - largura);
    const maxTop = Math.max(0, window.innerHeight - Math.min(altura, window.innerHeight - 40));
    caixa.style.left = `${Math.min(Math.max(0, pos.left), maxLeft)}px`;
    caixa.style.top = `${Math.min(Math.max(0, pos.top), maxTop)}px`;
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
  function formatarQuando(quando) {
    const d = new Date(quando);
    if (Number.isNaN(d.getTime())) return 'em data desconhecida';
    return ehHoje(quando)
      ? `hoje às ${formatarHora(quando)}`
      : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${formatarHora(quando)}`;
  }

  /** Comparação de texto sem acento e sem diferença de caixa. */
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

      const concluido = await page.clickConcluir();
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
    body.append(h('div', { class: 'wf-row' }, [saveBtn]));
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
      body.append(h('p', { class: 'wf-hint' }, 'Nada a sugerir ainda — preencha a Cidade para a etiqueta de região.'));
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
    if (sugestao.origem !== 'região') return true;
    const campo = fieldNamed('Cidade');
    const entry = campo && state.draft[campo.id];
    return entry?.from === 'crm' || entry?.confidence === 'exata';
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

    // A região da cidade deste contato, aplicada agora ou já aplicada antes. `etiquetaConfiavel`
    // é a mesma trava do resto: cidade de palpite não-exato não manda tirar etiqueta nenhuma.
    const regiao = state.tagSuggestions.find((s) => s.origem === 'região' && s.tag) || null;
    const fica = regiao && (aplicaveis.includes(regiao) || etiquetaConfiavel(regiao));
    const novaRegiao = fica ? regiao.tag : null;

    // Sem nada a trocar e sem região que fique: nem carrega a lista de COREDEs — resolver isso
    // contra as etiquetas do CRM custa uma passada por 28 nomes e não vale a cada gravação.
    if (!entrada?.substituiu && !novaRegiao) return [];

    const regioes = await tagsLib.regionTagIds();
    const todas = await tagsLib.allTags();

    return (state.contact.tagsId || [])
      .filter((id) => regioes.has(id) && id !== novaRegiao?.id)
      .map((id) => todas.find((t) => t.id === id))
      .filter(Boolean);
  }

  async function saveClassification({
    withCompletionDate = false,
    quiet = false,
    somenteExatos = false,
    automatico = false,
  } = {}) {
    // Único lugar que escreve no CRM, então é aqui que a cidade é confirmada — inclusive na
    // gravação automática, que era justamente a que passava batido.
    await confirmarCidadeSePendente(somenteExatos);

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

    // Só bloqueia o fluxo o que é essencial: cidade, data de conclusão e etiquetas. Nome no
    // cadastro e o resto viram aviso.
    const essenciais = ['Cidade', fieldsLib.COMPLETION_FIELD, 'etiquetas'];
    const bloqueantes = problemas.filter((p) => essenciais.some((e) => p.startsWith(e)));

    const prefixo = automatico ? 'Aplicado sozinho' : 'Confirmado no CRM';
    setStatus(
      (conferencia.confirmados.length
        ? `${prefixo}: ${conferencia.confirmados.join(', ')}`
        : `Gravado: ${gravados.join(', ') || 'nada'}`) +
        (problemas.length ? ` — PROBLEMA: ${problemas.join(' | ')}` : ''),
      problemas.length ? 'err' : 'ok'
    );
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

  // ---- aba Config --------------------------------------------------------
  function renderConfig() {
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

  function renderTemplateEditor(template) {
    const card = h('div', { class: 'wf-card' });
    const nameInput = h('input', { type: 'text', value: template.name });
    const textArea = h('textarea', { rows: '5' });
    textArea.value = template.text;

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

    const saveBtn = h('button', { class: 'wf-btn wf-mini wf-primary', type: 'button' }, 'Salvar');
    saveBtn.addEventListener('click', async () => {
      state.templates = await templatesLib.save({ id: template.id, name: nameInput.value, text: textArea.value });
      setStatus(`"${nameInput.value}" salvo.`, 'ok');
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

    card.append(nameInput, textArea, avisoNome, h('div', { class: 'wf-row' }, [saveBtn, upBtn, downBtn, delBtn]));
    card.append(h('div', { class: 'wf-origin' }, 'id: ' + template.id));
    conferirNome();
    return card;
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

    const learnMulti = h('button', { class: 'wf-btn', type: 'button' }, 'Aprender múltipla escolha (Tema)');
    learnMulti.addEventListener('click', () =>
      withBusy(() =>
        learn(
          'Tema de Interesse',
          null,
          'Gravando. Agora, no painel "Dados do contato" DA PLATAFORMA (não aqui), clique em "Alterar" ao lado de "Tema de Interesse", marque qualquer opção e salve.'
        )
      )
    );

    const learnTags = h('button', { class: 'wf-btn', type: 'button' }, 'Aprender etiquetas');
    learnTags.addEventListener('click', () => withBusy(learnTagContract));

    const learnDate = h('button', { class: 'wf-btn', type: 'button' }, 'Aprender data (conclusão)');
    learnDate.addEventListener('click', () => withBusy(learnDateContract));

    body.append(h('div', { class: 'wf-row' }, [learnText, learnMulti, learnTags, learnDate]));

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

function truncate(text, max) {
  const s = String(text || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
