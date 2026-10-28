/**
 * dom-mob.js — UNICO arquivo que sabe ler a TELA da plataforma nova (mobiliza.me).
 *
 * E o irmao de `dom.js` (que lia o mobiliza.app) e de `dom-facebook.js`. A diferenca com os dois e
 * o tamanho: **aqui quase nada precisa ser lido da tela**, porque a fila, a conversa e o cadastro
 * sao consulta (ver `mob.js`). Este arquivo existe para UMA coisa que a API nao faz:
 *
 *                      **abrir, na tela dele, a conversa que a rodada esta tratando.**
 *
 * ---------------------------------------------------------------------------
 * POR QUE ISSO E REQUISITO, E NAO ENFEITE
 * ---------------------------------------------------------------------------
 *
 * Decisao dele em 26/10/2026, quando perguntei por onde a migracao comecava — ele nao escolheu uma
 * opcao, deu a condicao: *"na antiga eu ainda tinha que ver o que estava acontecendo, pois
 * normalmente 90% das vezes o fluxo e a IA respondiam correto, mas faltava os 10% que eu tinha que
 * apagar e responder novamente manualmente"*.
 *
 * **E a plataforma nova NAO apaga mensagem.** Varri os 33 pacotes dela (~2,9 MB): as funcoes de
 * borda sao `enviar-mensagem-atendimento`, `transcrever-audio-whatsapp`, `sugerir-resposta-whatsapp`,
 * `classificar-conversa-whatsapp`, `enviar-reacao-whatsapp`, `gerar-audio-tts` e mais — **nenhuma
 * apaga**. Apagar continua existindo no celular dele, nao na tela.
 *
 * Entao o laco dele mudou de lado: era *deixa sair, eu leio, e apago os 10%*; passa a ser **ver
 * ANTES**. Perguntado com esse custo na mesa, ele escolheu *"mostrar antes, com a tela junto"*. Por
 * isso a rodada **abre a conversa e para** — e por isso este arquivo tem de acertar QUAL conversa.
 *
 * ---------------------------------------------------------------------------
 * A LINHA DA FILA NAO TEM GANCHO NENHUM — E MESMO ASSIM NAO SE CASA POR NOME
 * ---------------------------------------------------------------------------
 *
 * Medido na pagina dele: a linha e um `<button>` com **so `class`** (Tailwind), sem id, sem
 * `data-*`. O texto visivel e `"<nome><hora><ultima mensagem>"`.
 *
 * **Casar por NOME seria o erro.** Esta base tem nome repetido (a propria extensao ja tropecou em
 * etiqueta de rotulo repetido), o nome vem do WhatsApp e muda sozinho, e **abrir a conversa errada
 * aqui nao e cosmetico**: e ele conferindo a mensagem de uma pessoa e apertando a tecla que
 * responde a outra.
 *
 * **O React guarda a linha do banco no proprio no.** Medido:
 *
 * ```
 * no fiber do pai -> memoizedProps.conversa -> { id, tenant_id, instance_id, numero, nome,
 *                                                external_chat_id, status, nao_lidas, ... }
 * 69 linhas na tela -> 69 ids distintos -> achar pelo id funciona
 * ```
 *
 * Entao a identidade existe: e o **`id`**, o mesmo que veio na consulta. Casar por ele e identidade;
 * casar por nome e adivinhacao. O nome fica so de RESERVA, para o dia em que o React mudar as
 * chaves internas — e a reserva avisa que foi usada, porque a partir dali o painel esta adivinhando.
 *
 * ---------------------------------------------------------------------------
 * TRES COISAS QUE QUEM MEXER PRECISA SABER
 * ---------------------------------------------------------------------------
 *
 *  1. **Isto so funciona no mundo MAIN.** As propriedades `__reactFiber$*` sao expandos que o React
 *     poe no no do DOM, e expando **nao atravessa mundo isolado** no Chrome: um content script
 *     comum ve o mesmo `<button>` e NAO ve a chave. Por isso quem chama e `mob-hook.js`, que roda
 *     no mundo da pagina — a mesma razao pela qual o `page-hook.js` existia.
 *  2. **Nem toda conversa esta na tela.** Medido: 69 linhas no DOM com 100 na consulta. A fila de
 *     verdade tem centenas. Entao `acharLinha` devolve `null` com frequencia e **isso nao e erro**:
 *     e o caso de rolar a lista ou de ler a conversa dentro do painel, que e o caminho que sempre
 *     funciona.
 *  3. **O pacote da plataforma e publicado o tempo todo** — o hash do arquivo mudou entre duas
 *     medicoes minhas no MESMO dia. Nada aqui pode depender de nome de arquivo, e tudo o que
 *     depende das entranhas do React degrada para a reserva em vez de estourar.
 */

/** Quantos niveis subir no fiber procurando a conversa. Medido: ela estava no nivel 1. */
const NIVEIS = 8;

/**
 * A linha do banco que o React guardou neste no da tela, ou `null`.
 *
 * **Pura de proposito** — recebe o no e devolve o objeto, sem tocar em `document`. E o que permite
 * ter teste de uma coisa que, de resto, so existiria dentro do navegador dele.
 *
 * Sobe pelo `return` do fiber porque o `<button>` e so o clicavel: quem carrega a conversa e o
 * componente acima dele.
 */
export function conversaDoNo(no) {
  if (!no || typeof no !== 'object') return null;

  const chave = Object.keys(no).find((k) => k.startsWith('__reactFiber$'));
  if (!chave) return null;

  let fiber = no[chave];
  for (let i = 0; i < NIVEIS && fiber; i++) {
    const props = fiber.memoizedProps;
    const c = props && props.conversa;
    if (c && typeof c === 'object' && typeof c.id === 'string' && c.id) return c;
    fiber = fiber.return;
  }
  return null;
}

/**
 * O texto que a linha mostra, normalizado para comparar.
 *
 * So e usado pela RESERVA (casar por nome), e por isso ele e deliberadamente burro: tira acento,
 * baixa a caixa e junta espaco. Nao tenta separar nome de hora nem de previa — quem compara usa
 * `linhaParece`, que procura o nome DENTRO deste texto.
 */
export function textoDaLinha(no) {
  return String(no?.textContent || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * A reserva: esta linha PARECE ser desta conversa?
 *
 * **Exige nome com pelo menos duas letras e procura o nome inteiro**, porque o texto da linha
 * carrega hora e previa da ultima mensagem — um nome de uma letra casaria em quase tudo.
 *
 * Continua sendo adivinhacao, e quem a usa avisa: ver `acharLinha`.
 */
export function linhaParece(no, conversa) {
  const nome = String(conversa?.nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  if (nome.length < 2) return false;
  return textoDaLinha(no).includes(nome);
}

/* ------------------------------------------------------------------ *
 * A partir daqui e DOM: roda no mundo MAIN, dentro da aba             *
 * ------------------------------------------------------------------ */

/** Os clicaveis que podem ser linha da fila. Lista larga de proposito: quem peneira e o fiber. */
function candidatos(raiz = document) {
  return [...raiz.querySelectorAll('button, [role="button"]')];
}

/**
 * Acha a linha da conversa `id` na tela.
 *
 * Devolve `{ no, por }`, e o `por` importa: **`'id'` e identidade, `'nome'` e palpite**. Quem chama
 * escreve isso na tela — a partir do palpite, o painel esta dizendo "acho que e esta", e ele precisa
 * saber disso antes de apertar a tecla que responde.
 *
 * `null` quando a linha nao esta renderizada, que e o caso COMUM (69 de 100 na medicao) e nao e
 * erro: a conversa continua legivel dentro do painel.
 */
export function acharLinha(id, { nome = '', raiz = document } = {}) {
  if (!id) return null;
  const linhas = candidatos(raiz);

  for (const no of linhas) {
    const c = conversaDoNo(no);
    if (c && c.id === id) return { no, por: 'id', conversa: c };
  }

  if (!nome) return null;
  const porNome = linhas.filter((no) => linhaParece(no, { nome }));
  /**
   * **Duas linhas parecidas nao viram escolha.** Nome repetido e comum nesta base, e abrir a
   * conversa errada e ele responder a pessoa errada. Empate devolve nada, e o painel diz por que.
   */
  if (porNome.length !== 1) return null;
  return { no: porNome[0], por: 'nome', conversa: null };
}

/**
 * Abre a conversa na tela dele.
 *
 * **Clica e para ai** — a mesma fronteira do `ocultarComentario` no Facebook: a extensao coloca a
 * conversa na frente dele; quem decide o que fazer com ela e ele. Nao marca lida, nao assume, nao
 * digita nada.
 *
 * Devolve o que aconteceu, com o `por` junto, porque **"abri" e "abri achando que era esta" sao
 * coisas diferentes** e so a tela pode dizer isso a ele.
 */
export function abrirConversa(id, { nome = '', raiz = document } = {}) {
  const achada = acharLinha(id, { nome, raiz });
  if (!achada) return { ok: false, motivo: 'nao-esta-na-tela' };

  try {
    achada.no.scrollIntoView({ block: 'center' });
  } catch (e) {
    /* lista sem rolagem propria: seguir e clicar mesmo assim */
  }
  achada.no.click();
  return { ok: true, por: achada.por };
}

/**
 * A cadeia de `memoizedProps` deste no, do proprio para cima. Pura, para ter teste.
 *
 * `niveis` e parametro porque os dois sinais da conversa aberta moram em alturas diferentes: na
 * LINHA da fila a prop esta a ate 8 niveis; no PAINEL da direita, a 3. Varrer 8 em todos os `div`
 * da pagina seria pagar caro por nada.
 */
export function propsDoFiber(no, niveis = NIVEIS) {
  if (!no || typeof no !== 'object') return [];
  const chave = Object.keys(no).find((k) => k.startsWith('__reactFiber$'));
  if (!chave) return [];

  const saida = [];
  let fiber = no[chave];
  for (let i = 0; i < niveis && fiber; i++) {
    if (fiber.memoizedProps) saida.push(fiber.memoizedProps);
    fiber = fiber.return;
  }
  return saida;
}

/**
 * **Sinal 1 — a linha que o React marcou como ativa.** A prop se chama `ativa`, e e a propria
 * plataforma dizendo qual conversa esta selecionada.
 *
 * **Mais de uma ativa devolve `null`**: duas verdades ao mesmo tempo nao sao verdade nenhuma, e o
 * desfecho de afirmar a errada e o painel classificar uma pessoa e responder outra.
 */
export function linhaAtiva(nos) {
  const achadas = [];
  for (const no of nos || []) {
    for (const p of propsDoFiber(no, NIVEIS)) {
      if (p && p.conversa && typeof p.conversa.id === 'string') {
        if (p.ativa === true) achadas.push(p.conversa);
        break;
      }
    }
  }
  return achadas.length === 1 ? achadas[0] : null;
}

/**
 * **Sinal 2 — o painel da direita**, que e o componente que mostra a conversa aberta.
 *
 * Reconhecido pela ASSINATURA das props (`conversa` + `onStatusChange` + `onClose`), e nao por
 * classe: as classes sao Tailwind geradas e mudam com o tema e com a publicacao. Medido na pagina
 * dele, as props do painel sao
 * `{conversa, analise, onStatusChange, onClose, onDeleteConfirmed, onTogglePainel, …}`.
 */
export function painelDaConversa(nos) {
  for (const no of nos || []) {
    for (const p of propsDoFiber(no, 3)) {
      if (p && p.conversa && typeof p.conversa.id === 'string' && typeof p.onStatusChange === 'function' && typeof p.onClose === 'function') {
        return p.conversa;
      }
    }
  }
  return null;
}

/**
 * **A conversa que esta aberta AGORA na tela dele** — ou `null`.
 *
 * Existe porque a plataforma nova **nao poe a conversa aberta na URL** (conferido nas 424 rotas do
 * pacote: `/admin/interacoes/conversas`, sem `/:id`). Na plataforma velha quem respondia isso era o
 * `dom.js` lendo o cabecalho do atendimento; aqui o unico lugar onde a resposta existe e o estado
 * do React.
 *
 * **SAO DOIS SINAIS E ELES TEM DE CONCORDAR.** Medido na pagina dele: a linha ativa e o painel da
 * direita apontaram para o mesmo id, e **juntos custam menos de 1 ms** (0,19 + 0,75 — o precedente
 * do projeto e o `pageStateLocal`, medido em 2,9 ms e considerado barato). Entao nao ha porque
 * escolher um: discordando, **nao se afirma nada**.
 *
 * O `por` sobe junto porque o painel escreve na tela de onde tirou a resposta — e porque
 * `'so-um-sinal'` e o aviso de que a plataforma mudou por baixo e alguem precisa medir de novo.
 */
export function conversaAberta({ raiz = document } = {}) {
  const clicaveis = [...raiz.querySelectorAll('button, [role="button"]')];
  const daLista = linhaAtiva(clicaveis);
  const doPainel = painelDaConversa([...raiz.querySelectorAll('div')]);

  if (daLista && doPainel) {
    // Discordaram: a tela esta num estado que ninguem mediu. Calar e o desfecho certo.
    if (daLista.id !== doPainel.id) return null;
    return { conversa: daLista, por: 'os-dois' };
  }
  if (doPainel) return { conversa: doPainel, por: 'so-um-sinal' };
  if (daLista) return { conversa: daLista, por: 'so-um-sinal' };
  return null;
}


// ---------------------------------------------------------------------------
// O CAMPO DE MENSAGEM — e por que ele NAO e "o primeiro textarea da tela"
// ---------------------------------------------------------------------------

/**
 * **MEDIDO EM 27/10/2026, e o defeito apareceu por acidente.** Abrindo uma conversa `aberto`
 * (nao assumida) na pagina dele, a tela ja tem DOIS `textarea` VISIVEIS e nenhum deles e o campo
 * de mensagem:
 *
 * ```
 * textarea "Nota interna da conversa (so a equipe ve)..."
 * textarea "Anotacoes sobre este contato... (salva automaticamente 1s apos parar de digitar)"
 * campo de mensagem: NENHUM   <- a plataforma so o cria depois de ASSUMIR
 * ```
 *
 * O gancho perguntava `querySelectorAll('textarea, [contenteditable="true"]')` e devolvia `true`
 * no primeiro visivel: ele **afirmava campo de mensagem em TODA conversa aberta**. E essa leitura
 * de tela **vence o `status`** em `page-mob.estadoDaConversa` (`hasComposer === null ? status ===
 * EM_ATENDIMENTO : !!hasComposer`), entao o palpite errado substituia a resposta certa.
 *
 * **O proprio comentario do gancho dizia que isto nao tinha sido medido** — *"se o campo aparece
 * antes de assumir o atendimento nao foi medido"*. Agora esta: **nao aparece**.
 *
 * **TRES ESTADOS, NUNCA DOIS** (a licao do `donoDoCanal`, 25/09, e do `undefined !== 'CONNECTED'`,
 * 01/10):
 *
 * - reconheci o campo de mensagem      -> `true`
 * - nao ha NADA editavel na tela       -> `false`  (nao ha o que digitar, ponto)
 * - ha editavel e nenhum e o campo     -> `null`   (nao sei: quem chama cai no `status`)
 *
 * **O terceiro estado e o que faz isto envelhecer bem.** Mudando a redacao do placeholder, a tela
 * para de AFIRMAR e o `status` decide — em vez de dizer *"nao da para digitar"* numa conversa que
 * ele acabou de assumir. Errar para o lado de nao saber e barato; errar afirmando nao e.
 *
 * **A caixa de busca fica de fora por construcao:** ela e um `<input>`, e esta lista so olha
 * `textarea` e `contenteditable`. Incluir `input` faria `camposEditaveis` nunca vir vazia (a busca
 * esta sempre na tela) e o estado `false` deixaria de existir.
 */
const DIZ_MENSAGEM = /mensagem/;
const DIZ_ANOTACAO = /\bnotas?\b|anotac/;

/** O texto que a tela da ao campo: placeholder, `aria-label` ou `data-placeholder`. */
function rotuloDoCampo(el) {
  const bruto = (el && (el.placeholder
    || (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('data-placeholder'))))) || '';
  return String(bruto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** So o que PODE ser o campo de mensagem — ver a nota acima sobre o `<input>` da busca. */
export function camposEditaveis(raiz = document) {
  const sel = 'textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';
  return [...raiz.querySelectorAll(sel)];
}

export function ehCampoDeMensagem(el) {
  if (!el) return false;
  if (el.disabled || el.readOnly) return false;
  const r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
  if (r && (r.width <= 0 || r.height <= 0)) return false;
  // As duas anotacoes medidas sao `textarea`; contenteditable na conversa e o campo de mensagem.
  if (el.isContentEditable) return true;
  const t = rotuloDoCampo(el);
  return DIZ_MENSAGEM.test(t) && !DIZ_ANOTACAO.test(t);
}

export function campoDeMensagem({ raiz = document } = {}) {
  for (const el of camposEditaveis(raiz)) if (ehCampoDeMensagem(el)) return el;
  return null;
}

export function temCampoDeMensagem({ raiz = document } = {}) {
  try {
    const todos = camposEditaveis(raiz);
    for (const el of todos) if (ehCampoDeMensagem(el)) return true;
    return todos.length === 0 ? false : null;
  } catch (_) {
    return null;
  }
}

/** O que esta escrito no campo agora — `value` no textarea, `textContent` no contenteditable. */
export function lerCampo(el) {
  if (!el) return '';
  return el.isContentEditable ? String(el.textContent || '') : String(el.value || '');
}

/**
 * **O SETTER NATIVO, e ele e a receita MEDIDA deste projeto — nao uma hipotese minha.**
 *
 * `composer.js` (o campo do mobiliza.app) ja dizia: *"atribuir `textarea.value = x` direto nao
 * notifica o Angular; com o setter do prototipo + evento `input`, o app reconhece o texto"*.
 * **React tem o mesmo rastreador de valor** e pela mesma razao: ele guarda o ultimo valor que
 * conhece e, vendo o campo com esse valor, trata o evento como ruido e nao chama o `onChange`.
 * O setter do prototipo escreve por baixo do rastreador.
 */
function setterNativo(el) {
  // Pelo PROTOTIPO e nao por `instanceof`: e exatamente o que faz a volta por cima do rastreador
  // (o React patcha a INSTANCIA, nunca o prototipo), e nao depende do realm — content script e
  // pagina sao mundos diferentes, e `instanceof` atravessando mundo e armadilha de graca.
  const proto = el && Object.getPrototypeOf(el);
  const d = proto && Object.getOwnPropertyDescriptor(proto, 'value');
  return d && typeof d.set === 'function' ? d.set : null;
}

/** Dois quadros: um para o React processar o evento, outro para ele REDESENHAR. */
function doisQuadros() {
  return new Promise((r) => {
    if (typeof requestAnimationFrame !== 'function') return setTimeout(r, 60);
    requestAnimationFrame(() => requestAnimationFrame(() => r()));
  });
}

/**
 * **ESCREVE NO CAMPO E CONFERE RELENDO — a releitura E a medicao.**
 *
 * Campo controlado por React que nao reconhece a escrita **devolve o valor antigo no proximo
 * desenho**: o texto aparece e some. Por isso a conferencia espera DOIS quadros antes de reler —
 * ler na hora pegaria o texto que o React ainda vai apagar, e o painel diria que escreveu.
 *
 * E a mesma disciplina do `imagem.legendaEntrou` e do `inserirNaCaixa` do Facebook: **200 nao
 * prova entrega, e `el.value = x` nao prova que o app viu**. Falhando, quem chama diz na tela o
 * que aconteceu — nunca "escrevi" em cima de um campo vazio.
 */
export async function escreverNoCampo(texto, { raiz = document, esperar = doisQuadros } = {}) {
  const campo = campoDeMensagem({ raiz });
  if (!campo) return { ok: false, motivo: 'sem-campo' };

  const valor = String(texto ?? '');
  try { campo.focus(); } catch (_) { /* campo que nao aceita foco ainda pode receber o texto */ }

  if (campo.isContentEditable) {
    try {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, valor);
    } catch (_) {
      return { ok: false, motivo: 'nao-aceitou', campo };
    }
  } else {
    const set = setterNativo(campo);
    if (!set) return { ok: false, motivo: 'campo-desconhecido', campo };
    set.call(campo, valor);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  }

  await esperar();
  const ficou = lerCampo(campo);
  if (ficou === valor) return { ok: true, campo, ficou };
  return { ok: false, motivo: ficou === '' ? 'apagou' : 'ficou-diferente', campo, ficou };
}
