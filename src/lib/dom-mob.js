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
