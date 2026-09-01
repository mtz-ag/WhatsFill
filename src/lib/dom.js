/**
 * dom.js — ÚNICO arquivo que sabe como o mobiliza.app é montado por dentro.
 *
 * Se a plataforma mudar o layout, o conserto é aqui e em nenhum outro lugar.
 *
 * Fatos verificados ao vivo (Angular + template Fuse):
 *  - o composer é um <textarea class="mat-input-element"> dentro de
 *    div.flex.flex-col.border-t; o id muda a cada render (mat-input-1 → mat-input-5),
 *    então id é inútil como seletor;
 *  - o botão de enviar só existe no DOM quando há texto, e é o mat-icon
 *    data-mat-icon-name="paper-airplane";
 *  - a sessão aberta está na URL: /chat2/sessions/{sessionId}.
 */

const SESSION_URL_RE = /\/chat2\/sessions\/([0-9a-f-]{36})/i;

export function getSessionId(href = location.pathname) {
  const m = SESSION_URL_RE.exec(href);
  return m ? m[1] : null;
}

/**
 * Avisa quando o operador troca de atendimento.
 * Polling em vez de patch no history: o content script vive num mundo JS separado do
 * Angular, então interceptar history.pushState daqui não pegaria as navegações do app.
 */
export function onSessionChange(callback, intervalMs = 400) {
  let current = getSessionId();
  callback(current);
  const timer = setInterval(() => {
    const next = getSessionId();
    if (next !== current) {
      current = next;
      callback(next);
    }
  }, intervalMs);
  return () => clearInterval(timer);
}

export function getComposer() {
  return (
    document.querySelector('sessions-conversation textarea.mat-input-element') ||
    [...document.querySelectorAll('textarea.mat-input-element')].find((t) =>
      t.closest('div.flex.flex-col.border-t')
    ) ||
    null
  );
}

export function getComposerRoot() {
  const ta = getComposer();
  return ta ? ta.closest('div.flex.flex-col.border-t') : null;
}

export function getSendButton() {
  const root = getComposerRoot();
  if (!root) return null;
  const icon = root.querySelector('mat-icon[data-mat-icon-name="paper-airplane"]');
  return icon ? icon.closest('button') : null;
}

/**
 * Botão "Iniciar" do rodapé. Atendimento Pendente não tem composer nenhum: a plataforma
 * só mostra o campo de texto depois que você assume a conversa. Como a fila de contatos
 * novos chega toda em Pendente, o painel precisa saber disso e oferecer o Iniciar.
 */
export function getIniciarButton() {
  return (
    [...document.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === 'Iniciar' && !b.disabled
    ) || null
  );
}

/** Pendente = sem composer, mas com botão Iniciar disponível. */
export function isPending() {
  return !getComposer() && !!getIniciarButton();
}

/**
 * Botão "Concluir" do rodapé — a metade esquerda de um botão partido (`split-button-left`).
 *
 * **Clicar nele NÃO conclui: abre um menu.** Conferido ao vivo — depois do clique o atendimento
 * seguia "Em andamento" e um `mat-menu-panel` aparecia. Como `hasOpenDialog()` só enxerga
 * diálogo, nada acusava: a rodada dava o atendimento por fechado e o contato ficava em "Meus".
 * Era a fila que só crescia.
 *
 * O escopo importa: o **item do menu também tem o texto "Concluir"**, então excluir o que está
 * dentro do overlay é o que impede a verificação de olhar para o item em vez do rodapé.
 */
export function getConcluirButton() {
  return (
    [...document.querySelectorAll('button')].find(
      (b) =>
        b.textContent.trim() === 'Concluir' && !b.disabled && !b.closest('.cdk-overlay-container')
    ) || null
  );
}

/** Itens do menu que o Concluir abre. Os dois têm `data-cy` — gancho de teste da plataforma. */
export function getMenuConcluirItem() {
  return document.querySelector('[data-cy="menu-button-session-finish"]');
}

/** Está fora de overlay e fora da fila da esquerda? (a fila repete texto do atendimento) */
function noAtendimento(el) {
  return !el.closest('.cdk-overlay-container') && !el.closest('sessions-list-item');
}

/**
 * Concluído de verdade?
 *
 * **Dois sinais, porque a plataforma tem dois estados de "fechado"** — descoberto ao vivo,
 * depois de a rodada ficar meia hora esperando um atendimento que já estava concluído:
 *
 * 1. **"Reiniciar" no rodapé.** Foi o primeiro que apareceu, e continua valendo.
 * 2. **"Concluído" no cabeçalho**, no lugar de "Em andamento". Neste estado **não existe
 *    Reiniciar nenhum** — o rodapé vira "Nenhuma classificação definida". Era o caso do
 *    atendimento fechado logo depois de mandar uma figura à mão: a tela dizia Concluído, o
 *    `isConcluded()` dizia que não, e a rodada seguia esperando.
 *
 * O sumiço do "Concluir" continua NÃO servindo como sinal: o item do menu tem o mesmo texto e
 * sobrevive enquanto o menu estiver aberto.
 */
export function isConcluded() {
  const botoes = [...document.querySelectorAll('button')].filter(noAtendimento);
  if (botoes.some((b) => /reiniciar/i.test(b.textContent))) return true;
  if (botoes.some((b) => /^conclu[íi]d[oa]$/i.test(b.textContent.trim()))) return true;

  // Reserva: a plataforma pode mostrar o estado como chip/rótulo em vez de botão. Busca só
  // folhas (sem filhos) e só dentro da conversa — varrer o documento inteiro seria caro, e a
  // fila da esquerda repete texto de atendimento.
  const escopo = document.querySelector('sessions-conversation') || document;
  return [...escopo.querySelectorAll('button, [role="button"], mat-chip, span, div')].some(
    (el) => el.children.length === 0 && noAtendimento(el) && /^conclu[íi]d[oa]$/i.test(el.textContent.trim())
  );
}

/**
 * O atendimento aberto não tem mais NENHUM controle: nem campo de mensagem, nem Concluir, nem
 * Iniciar. É o retrato de um atendimento fechado visto pela estrutura, e não pelo texto.
 *
 * Existe como rede de segurança da espera da tecla 6: se a plataforma trocar o rótulo de novo,
 * a rodada percebe pela ausência dos controles em vez de ficar meia hora parada. Não entra no
 * `isConcluded()` porque durante a troca de tela os três somem por um instante — quem usa isto
 * exige leituras seguidas.
 */
export function semControlesDeAtendimento() {
  return !getComposer() && !getConcluirButton() && !getIniciarButton();
}

/**
 * Itens da fila na coluna da esquerda, na ordem em que aparecem.
 *
 * Conferido ao vivo: `<sessions-list-item>` não tem atributo nenhum; quem é clicável e carrega
 * o gancho de teste é o primeiro `div` de dentro (`data-cy="list-item-session"`, `cursor-pointer`).
 * Daí a reserva pelo `data-cy` — devolve o próprio clicável, e `openQueueSession` continua
 * funcionando porque procura o div dentro e cai no elemento se não achar.
 */
export function getSessionListItems() {
  const itens = [...document.querySelectorAll('sessions-list-item')];
  return itens.length ? itens : [...document.querySelectorAll('[data-cy="list-item-session"]')];
}

/**
 * A fila está buscando os itens no servidor AGORA?
 *
 * Medido ao vivo (12/08/2026): a lista tem spinner próprio, um `mat-progress-spinner` **dentro
 * de `sessions-list-online-content`**. É esse, e não o `fuse-loading-bar` do topo — o de cima
 * sobe em qualquer requisição do app, inclusive nas nossas, e daria falso positivo o tempo todo.
 */
function filaCarregando() {
  const escopo = document.querySelector('sessions-list-online-content');
  if (!escopo) return false;
  return !!escopo.querySelector('mat-progress-spinner, mat-spinner, [role="progressbar"]');
}

/**
 * Espera a fila da esquerda TERMINAR de carregar, e devolve quantos itens vieram.
 *
 * **É o conserto da rodada dos concluídos, e o número diz por quê.** Medido na máquina dele:
 * clicar na lista de arquivados tira o `bg-gray-300` das três abas em **1,0 s**, mas os itens
 * só aparecem em **13,0 s**. O código antigo confirmava a troca pela classe, esperava 400 ms
 * fixos e olhava a lista — que naquele instante tinha **zero** itens.
 *
 * Isso estragava as duas pontas:
 *  - a lista de concluídos era **recusada como candidata errada** ("a lista veio vazia, então
 *    não era este botão"), e a rodada saía clicando nos outros ícones da barra até desistir
 *    com "Tentei 3 botão(ões) e nenhum abriu a lista de concluídos" — mentira, o primeiro
 *    clique estava certo;
 *  - quando passava, `openQueueSession` lia a lista ainda vazia e dizia **"a fila carregada
 *    acabou (0 itens)"**, que é a mesma mentira com outro nome.
 *
 * Ordem: dá um tempo para o spinner APARECER (medido: ~400 ms), espera enquanto ele estiver na
 * tela, e então aguarda os itens pintarem. Lista que termina de carregar vazia é resposta
 * legítima — quem chama decide o que fazer com `itens: 0`.
 *
 * **O limite é 60 s, e não é exagero.** Medido na máquina dele em duas passadas do mesmo dia:
 * a lista dos arquivados levou **13 s** numa e **mais de 25 s** noutra. Quem chama tem que
 * distinguir os dois "zero" possíveis — por isso o retorno traz `estourou`: sem ele, "ainda
 * está carregando" vira "a lista está vazia", que é a mesma mentira que este conserto tirou
 * da rodada.
 */
export async function esperarFilaCarregar(opts) {
  const { timeoutMs = 60000, esperaDoSpinnerMs = 1200 } = opts || {};
  const fim = Date.now() + timeoutMs;

  // 1) o spinner pode demorar um pouco para subir; sem esta janela, uma leitura logo depois do
  //    clique acharia "não está carregando" quando a requisição nem tinha saído.
  const limiteSpinner = Math.min(fim, Date.now() + esperaDoSpinnerMs);
  while (Date.now() < limiteSpinner && !filaCarregando()) {
    await new Promise((r) => setTimeout(r, 100));
  }

  // 2) enquanto estiver buscando, esperar é a única coisa certa a fazer.
  while (Date.now() < fim && filaCarregando()) {
    await new Promise((r) => setTimeout(r, 150));
  }

  // 3) o spinner sai um instante ANTES de a lista pintar, então vai uma folga curta. Passada a
  //    folga sem item nenhum, a lista terminou vazia de verdade — e vazio é resposta, não erro.
  //    Se outra busca começar no meio (paginação, filtro), volta a esperar por ela.
  let folga = Date.now() + 800;
  while (Date.now() < fim && Date.now() < folga && !getSessionListItems().length) {
    await new Promise((r) => setTimeout(r, 100));
    if (!filaCarregando()) continue;
    while (Date.now() < fim && filaCarregando()) {
      await new Promise((r) => setTimeout(r, 150));
    }
    folga = Date.now() + 800;
  }

  const itens = getSessionListItems().length;
  return { ok: !filaCarregando(), itens, estourou: Date.now() >= fim };
}

/**
 * O "Ver mais" da fila. A plataforma carrega 50 por vez e só traz o resto quando você clica —
 * a rodada enxerga só o que já veio, e é por isso que ela terminava em "A fila carregada
 * acabou" com o contador da aba ainda na casa das centenas.
 *
 * Este é o único gancho da fila SEM `data-cy` (conferido ao vivo), então casa por texto. O
 * escopo é `sessions-list-online-content`, ancestral comum do botão e dos itens — evita casar
 * com um "Ver mais" de outro canto da tela.
 */
export function getVerMaisButton() {
  const escopo = document.querySelector('sessions-list-online-content') || document;
  return (
    [...escopo.querySelectorAll('button')].find(
      (b) => b.textContent.replace(/\s+/g, ' ').trim() === 'Ver mais' && !b.disabled
    ) || null
  );
}

/**
 * Pede a próxima página da fila e **confirma pelo crescimento da lista**, em vez de esperar um
 * tempo fixo. Medido ao vivo: 50 → 99 itens num clique.
 */
export async function carregarMaisDaFila(opts) {
  const { timeoutMs = 8000 } = opts || {};
  const botao = getVerMaisButton();
  if (!botao) return { ok: false, reason: 'não há "Ver mais": a fila acabou de verdade' };

  const antes = getSessionListItems().length;
  botao.click();

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 150));
    const agora = getSessionListItems().length;
    if (agora > antes) return { ok: true, antes, agora };
  }
  return { ok: false, reason: 'cliquei em "Ver mais" e a lista não cresceu' };
}

/**
 * Abas da fila: o contato novo chega em "Novos" e migra para "Meus" quando você o assume.
 * Depois de concluir, o próximo a trabalhar está em "Novos" — não onde a plataforma deixou.
 *
 * Os seletores foram conferidos ao vivo: a plataforma marca as três abas com `data-cy`, que é
 * gancho de teste dela e não muda com tradução, tema ou mexida de layout. Bem melhor do que
 * casar pelo texto, que era como isto nasceu.
 *
 * Marcação de uma aba (a ativa):
 *   <span data-cy="button-new-sessions" class="… rounded-full … bg-gray-300 text-black">
 *     <span> Novos </span><span class="… bg-red-600">119</span>
 *   </span>
 *
 * O clique vai no elemento do `data-cy` (o handler é dele), e `bg-gray-300` é o que distingue a
 * aba ativa — verificado alternando entre Novos e Meus: a contagem da lista muda junto.
 */
const ABAS_DA_FILA = {
  Novos: 'button-new-sessions',
  Meus: 'button-my-sessions',
  Outros: 'button-other-sessions',
};

export const ABA_NOVOS = 'Novos';

/** Quem respondeu depois de concluído reaparece aqui: o atendimento já é seu. */
export const ABA_MEUS = 'Meus';

/**
 * A lista dos **concluídos/arquivados** — o ícone de caixa ao lado das três abas de texto.
 *
 * É onde mora a fila de "sem retorno": atendimento fechado, com a etiqueta que ele filtra. Sem
 * ela não dá para percorrer essa fila, porque `Novos/Meus/Outros` não mostram concluído.
 *
 * **Conferido ao vivo na máquina dele em 12/08/2026:** é
 * `[data-cy="icon-chat-sessions-archive"]`, e o elemento do `data-cy` **é o próprio
 * `<mat-icon data-mat-icon-name="archive">`** — não um botão em volta. Ele ganha `bg-gray-300`
 * quando está ativo, igual às três abas de texto, o que dá sinal DIRETO em vez de dedução.
 *
 * Os outros nomes ficam como reserva para o dia em que a plataforma renomear, junto com a
 * reserva por ícone e por rótulo. Se nada casar, a rodada **para e diz** em vez de percorrer a
 * fila errada. `diagnosticarAbasDaFila()` continua existindo para redescobrir em uma passada.
 */
export const ABA_CONCLUIDOS = 'Concluídos';

const CY_CONCLUIDOS = [
  'icon-chat-sessions-archive',
  'button-archived-sessions',
  'button-finished-sessions',
  'button-closed-sessions',
  'button-archive-sessions',
  'button-concluded-sessions',
];

/** Nomes de ícone plausíveis para a caixa de arquivo (o tema usa heroicons). */
const ICONES_CONCLUIDOS = ['archive-box', 'archive-box-arrow-down', 'archive', 'inbox-stack', 'inbox-arrow-down'];

/** Rótulo de acessibilidade / tooltip, em português e inglês. */
const RE_ROTULO_CONCLUIDOS = /arquiv|conclu[íi]d|encerrad|finalizad|archiv|closed|finished/i;

/** O que a rodada descobriu sozinha, para não reprobar a cada volta do laço. */
let concluidosAprendido = null;

/**
 * A lista de concluídos achada por `data-cy` — o caminho CONFIÁVEL.
 *
 * Separado do resto porque a diferença importa na hora de decidir: quem veio daqui é gancho de
 * teste da plataforma e não precisa provar nada. Quem vem de palpite (ícone, rótulo, tentativa
 * na barra) precisa — e é essa distinção que evita exigir prova de quem já é certo.
 */
function abaConcluidosPorCy() {
  for (const cy of CY_CONCLUIDOS) {
    const el = document.querySelector(`[data-cy="${cy}"]`);
    if (el) return el;
  }
  return null;
}

function getAbaConcluidos() {
  if (concluidosAprendido?.isConnected) return concluidosAprendido;

  const porCy = abaConcluidosPorCy();
  if (porCy) return porCy;

  const escopo = barraDaFila();

  for (const nome of ICONES_CONCLUIDOS) {
    const icone = escopo.querySelector(`mat-icon[data-mat-icon-name="${nome}"]`);
    if (icone) return icone.closest('button, [data-cy], span, div') || icone;
  }

  const porRotulo = [...escopo.querySelectorAll('button, [role="button"], [aria-label], [title]')].find((el) => {
    const rotulo = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`;
    return RE_ROTULO_CONCLUIDOS.test(rotulo);
  });
  return porRotulo || null;
}

/**
 * O pedaço da tela que contém as três abas de texto **e os ícones vizinhos**.
 *
 * Subir só até o primeiro ancestral que contém as três não bastava: na máquina dele esse
 * ancestral é o invólucro **só das abas**, e os ícones (pessoas, caixa, "⋮") ficam num irmão.
 * O resultado foi lista de candidatos vazia e a rodada parando na volta do primeiro contato.
 * Por isso continua subindo enquanto não houver nenhum clicável além das abas.
 */
function barraDaFila() {
  const tab = document.querySelector('[data-cy="button-new-sessions"], [data-cy="button-my-sessions"]');
  let no = tab?.parentElement || null;
  let comAsTres = null;

  for (let i = 0; i < 8 && no; i++) {
    if (!comAsTres && no.querySelector('[data-cy="button-other-sessions"]')) comAsTres = no;
    // Achou as três E já tem ícone vizinho: é a barra inteira.
    if (comAsTres && no.querySelector('mat-icon')) return no;
    // Não passa da lista: item de fila não é controle de barra.
    if (no.querySelector('sessions-list-item')) return comAsTres || no;
    no = no.parentElement;
  }
  return comAsTres || document.querySelector('sessions-list-online-content')?.parentElement || document.body;
}

/** Ícone cujo nome cheira a arquivo/caixa vai na frente da fila de tentativas. */
const RE_ICONE_ARQUIVO = /arch|box|inbox|folder|caix|arquiv/i;

/**
 * Os candidatos a "ícone da lista de concluídos".
 *
 * O gancho dessa lista não tem `data-cy` conhecido e adivinhar nome de ícone falhou. Em vez de
 * continuar chutando, a rodada **experimenta**. Mas experimentar clicando em qualquer coisa da
 * barra é perigoso: "Grupos", "Todas" e "Apenas não lidas" trocam o filtro que ele montou.
 *
 * A trava que separa um do outro: **só entram controles de ícone puro, sem texto visível**. A
 * caixa de arquivo é ícone; os filtros que estragariam a fila têm rótulo escrito. Os poucos que
 * sobram (pessoas, "⋮") são inofensivos e reversíveis — e os de nome parecido com arquivo são
 * tentados primeiro.
 */
export function candidatosDeConcluidos() {
  const barra = barraDaFila();
  const tabs = Object.keys(ABAS_DA_FILA).map((nome) => getQueueTab(nome)).filter(Boolean);

  const achados = [...barra.querySelectorAll('mat-icon')]
    .map((icone) => ({ icone, alvo: icone.closest('button, [role="button"], [data-cy]') || icone.parentElement }))
    .filter(({ alvo }, i, todos) => {
      if (!alvo || todos.findIndex((o) => o.alvo === alvo) !== i) return false;
      if (tabs.some((t) => t === alvo || t.contains(alvo) || alvo.contains(t))) return false;
      // Ícone PURO: com texto visível é filtro ("Grupos", "Todas"), e clicar estraga a fila.
      if (alvo.textContent.replace(/\s+/g, '')) return false;
      if (alvo.querySelector('input') || alvo.closest('sessions-list-item')) return false;
      return true;
    });

  // Nome parecido com arquivo primeiro: reduz o número de cliques a esmo na barra dele.
  achados.sort((a, b) => {
    const pa = RE_ICONE_ARQUIVO.test(a.icone.getAttribute('data-mat-icon-name') || '') ? 0 : 1;
    const pb = RE_ICONE_ARQUIVO.test(b.icone.getAttribute('data-mat-icon-name') || '') ? 0 : 1;
    return pa - pb;
  });
  return achados.map(({ alvo }) => alvo);
}

/**
 * O que existe na barra da fila, para descobrir o gancho da aba de concluídos sem chutar.
 *
 * Devolve os `data-cy`, nomes de ícone e rótulos que estão na tela agora. É uma passada de
 * diagnóstico — o painel mostra o resultado e o seletor certo entra em `CY_CONCLUIDOS`.
 */
export function diagnosticarAbasDaFila() {
  const escopo = document.querySelector('sessions-list-online-content')?.parentElement || document.body;
  const perto = [...escopo.querySelectorAll('[data-cy], mat-icon, button, [role="button"]')].slice(0, 80);

  return {
    dataCy: [...new Set(perto.map((el) => el.getAttribute('data-cy')).filter(Boolean))],
    icones: [...new Set([...escopo.querySelectorAll('mat-icon')].map((el) => el.getAttribute('data-mat-icon-name')).filter(Boolean))],
    rotulos: [...new Set(perto.map((el) => el.getAttribute('aria-label') || el.getAttribute('title')).filter(Boolean))],
    achou: !!getAbaConcluidos(),
  };
}

/**
 * O botão "Reiniciar" do rodapé, que reabre um atendimento concluído.
 *
 * É o mesmo texto que `isConcluded()` procura — e não é coincidência: só existe quando o
 * atendimento está fechado. Aqui ele é o alvo do clique, lá é só sinal.
 */
export function getReiniciarButton() {
  return (
    [...document.querySelectorAll('button')].find(
      (b) => /^reiniciar$/i.test(b.textContent.trim()) && !b.disabled && !b.closest('.cdk-overlay-container')
    ) || null
  );
}

/** A classe que a plataforma põe na aba ativa. */
const ABA_ATIVA = 'bg-gray-300';

export function getQueueTab(label) {
  if (label === ABA_CONCLUIDOS) return getAbaConcluidos();

  const cy = ABAS_DA_FILA[label];
  const porCy = cy ? document.querySelector(`[data-cy="${cy}"]`) : null;
  if (porCy) return porCy;

  // Reserva, para o dia em que o `data-cy` sumir: o rótulo pelo texto exato. O mais fundo é o
  // rótulo em si (o de fora carrega junto o número da contagem), e o clique sobe para o handler.
  const casam = [...document.querySelectorAll('span, button, a, [role="tab"]')].filter(
    (el) => el.textContent.replace(/\s+/g, ' ').trim() === label
  );
  return casam.length ? casam[casam.length - 1] : null;
}

export function isQueueTabActive(label) {
  // A lista de concluídos tem sinal DIRETO: medido ao vivo, o `mat-icon` da caixa de arquivo
  // ganha o mesmo `bg-gray-300` das três abas de texto quando está ativo. Preferir o sinal
  // direto importa porque a eliminação também dá "true" no instante em que a plataforma está
  // trocando de aba e nenhuma das três está marcada ainda.
  //
  // A eliminação fica como reserva, para quando o gancho da lista não for encontrado.
  if (label === ABA_CONCLUIDOS) {
    const alvo = getAbaConcluidos();
    if (alvo?.classList?.contains(ABA_ATIVA)) return true;

    return !Object.keys(ABAS_DA_FILA).some((nome) => {
      const el = getQueueTab(nome);
      return !!el && el.classList.contains(ABA_ATIVA);
    });
  }

  const alvo = getQueueTab(label);
  return !!alvo && alvo.classList.contains(ABA_ATIVA);
}

/**
 * Troca de aba e **confirma** pela marca de ativa, em vez de esperar um tempo fixo e torcer.
 * Não achar a aba é o único caso que devolve `ok: false` — é o que faz a rodada parar em vez de
 * percorrer a fila errada.
 */
/**
 * Volta para a lista de concluídos **experimentando**, em vez de adivinhando o seletor.
 *
 * Adivinhar `data-cy` e nome de ícone falhou na máquina dele — a rodada parou logo no começo
 * dizendo que não achou a lista. Aqui a ordem é outra: clica um candidato da barra e confere
 * pelo sinal que já é confiável (nenhuma das três abas de texto ativa). Deu certo, guarda o
 * elemento e as próximas voltas são diretas; deu errado, desfaz e tenta o próximo.
 *
 * Desfazer importa: clicar em "Grupos" ou num filtro deixaria a rodada percorrendo outra fila.
 * Por isso, quando o palpite não leva aos concluídos, a aba de antes é restaurada.
 */
async function selecionarConcluidos(timeoutMs) {
  const preferido = getAbaConcluidos();
  const candidatos = [preferido, ...candidatosDeConcluidos()].filter(
    (el, i, todos) => el && todos.indexOf(el) === i
  );

  if (!candidatos.length) {
    return {
      ok: false,
      reason:
        'Não achei nenhum botão na barra da fila que pudesse ser a lista de concluídos. ' +
        'Clique em "Achar a lista de concluídos" na aba Automatizado e me mande o que aparecer.',
    };
  }

  const antes = Object.keys(ABAS_DA_FILA).find((nome) => isQueueTabActive(nome)) || null;
  const conhecido = abaConcluidosPorCy();

  for (const candidato of candidatos) {
    candidato.click();

    // Quem já foi aprendido nesta sessão, e quem veio do `data-cy` da plataforma, **não precisa
    // provar nada**. Foi exigir prova do candidato certo que quebrou esta rodada: a lista dos
    // arquivados leva 13 s para chegar, a prova era cobrada em 400 ms, e o clique certo era
    // descartado como errado — com a rodada saindo a clicar nos outros ícones da barra.
    const confiavel = candidato === concluidosAprendido || candidato === conhecido;
    const deadline = Date.now() + Math.max(1500, Math.floor(timeoutMs / candidatos.length));
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 120));
      if (!isQueueTabActive(ABA_CONCLUIDOS)) continue;

      // Agora a espera é pela LISTA, não por um tempo fixo. Palpite continua tendo que provar
      // que abriu algo — é o que separa a caixa de arquivo de um ícone que abre visão vazia —,
      // só que com o tempo que a plataforma realmente leva.
      const carregou = await esperarFilaCarregar();

      // Estourou o tempo com um palpite na mão: não dá para dizer se o botão era o certo. Sair
      // clicando nos outros por causa de lentidão da plataforma é mexer na fila dele à toa.
      if (!confiavel && carregou.estourou) {
        return {
          ok: false,
          reason:
            'Cliquei no que parecia ser a lista de concluídos e a plataforma não terminou de ' +
            'carregar a fila em 60s. Não sei dizer se era o botão certo, então parei aqui.',
        };
      }
      if (!confiavel && !carregou.itens) break;

      concluidosAprendido = candidato;
      return { ok: true, confirmado: true, aprendido: descrever(candidato), itens: carregou.itens };
    }

    // Não era. Fecha o que o clique possa ter aberto (o "⋮" abre menu, e menu do Material é
    // modal: deixar aberto trava o clique seguinte) e devolve a fila para onde estava.
    closeOverlay();
    if (antes) getQueueTab(antes)?.click();
    await new Promise((r) => setTimeout(r, 250));
  }

  return {
    ok: false,
    reason:
      `Tentei ${candidatos.length} botão(ões) da barra e nenhum abriu a lista de concluídos. ` +
      'Clique em "Achar a lista de concluídos" na aba Automatizado e me mande o que aparecer.',
  };
}

/** Descrição curta de um elemento, para o log dizer o que a rodada aprendeu. */
function descrever(el) {
  if (!el) return '(nada)';
  const cy = el.getAttribute?.('data-cy');
  if (cy) return `[data-cy="${cy}"]`;
  const icone = el.querySelector?.('mat-icon')?.getAttribute('data-mat-icon-name');
  if (icone) return `ícone "${icone}"`;
  const rotulo = el.getAttribute?.('aria-label') || el.getAttribute?.('title');
  if (rotulo) return `rótulo "${rotulo}"`;
  return `<${el.tagName.toLowerCase()}> sem identificação`;
}

export async function selectQueueTab(label, opts) {
  // 6s porque a troca medida ao vivo levou ~1,6s para a aba ficar ativa (a lista recarrega
  // junto). Timeout curto aqui não erra o alvo: só faz a rodada seguir sem confirmação.
  const { timeoutMs = 6000 } = opts || {};

  // Já estamos nela? Não custa nada e evita clique à toa.
  if (isQueueTabActive(label)) return { ok: true, confirmado: true };

  if (label === ABA_CONCLUIDOS) return selecionarConcluidos(timeoutMs);

  const alvo = getQueueTab(label);
  if (!alvo) return { ok: false, reason: `Não achei a aba "${label}" na fila.` };

  if (alvo.classList.contains(ABA_ATIVA)) return { ok: true, confirmado: true };
  alvo.click();

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 120));
    if (isQueueTabActive(label)) {
      // Esperar a LISTA, não um tempo fixo: a aba fica ativa em ~1s e os itens chegam bem
      // depois. Era daqui que saía "a fila carregada acabou" com a lista ainda em branco.
      const carga = await esperarFilaCarregar();
      return { ok: true, confirmado: true, itens: carga.itens };
    }
  }
  // Clicou e não deu para confirmar: segue, mas sem afirmar que trocou.
  return { ok: true, confirmado: false };
}

/**
 * Abre o primeiro atendimento da fila e informa se a sessão realmente mudou.
 * Os itens da lista não carregam o id da sessão no markup, então não há como escolher
 * "o próximo" antes de clicar — clicamos no topo, que é onde o próximo cai depois que o
 * atendimento concluído sai da fila, e conferimos a URL depois.
 */
export async function openNextSession(opts) {
  const { timeoutMs = 3000, aba = null } = opts || {};

  // Trocar de aba primeiro: assumir o atendimento move o contato de "Novos" para "Meus", então
  // depois de concluir o topo da aba atual não é mais o próximo da fila de trabalho.
  let avisoAba = null;
  if (aba) {
    const trocou = await selectQueueTab(aba);
    if (!trocou.ok) avisoAba = trocou.reason;
  }

  await esperarFilaCarregar(); // mesma razão do openQueueSession: a lista chega depois da aba

  const currentId = getSessionId();
  const target = getSessionListItems()
    .map((el) => el.querySelector('div'))
    .find(Boolean);

  if (!target) return { changed: false, avisoAba, reason: 'A fila está vazia.' };

  target.click();

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 120));
    const next = getSessionId();
    if (next && next !== currentId) return { changed: true, avisoAba, sessionId: next };
  }
  return { changed: false, avisoAba, reason: 'O topo da fila ainda é este mesmo atendimento.' };
}

/**
 * O diálogo aberto é uma CONFIRMAÇÃO da conclusão — daquelas de "tem certeza?"?
 *
 * Print dele (01/09): *"Uma mensagem está aguardando resposta do contato. Se você prosseguir com a
 * conclusão do atendimento, essas mensagens serão canceladas. Tem certeza de que deseja concluir o
 * atendimento?"*, com **Cancelar** e **Concluir**. A rodada parava em todo contato assim —
 * *"é para concluir e continuar mas está parando tudo"*.
 *
 * **A distinção que importa, e é ela que torna seguro clicar:**
 *
 *  - *confirmação* — só pergunta se pode seguir com o que a rodada JÁ pediu. Nada a decidir que a
 *    rodada não tenha decidido; ela confirma.
 *  - *formulário* (o diálogo de "motivo de conclusão") — pede um dado que só ele tem. Aqui a rodada
 *    devolve para o painel, como sempre fez.
 *
 * O teste do formulário vem PRIMEIRO e é o que segura a mão: qualquer campo dentro do diálogo
 * (`input`, `select`, `mat-select`, `textarea`, `mat-radio-group`) faz esta função devolver `null`,
 * mesmo que haja um botão "Concluir" ao lado. Errar para o lado de não clicar custa uma rodada
 * parada; errar para o outro grava decisão que ninguém tomou.
 *
 * Também exige que o TEXTO fale de concluir/encerrar: diálogo de outra coisa com um botão de nome
 * parecido não entra.
 *
 * @returns {{botao: HTMLElement, texto: string}|null}
 */
export function getConfirmacaoDeConclusao() {
  const dialogo = document.querySelector('.cdk-overlay-container mat-dialog-container');
  if (!dialogo) return null;

  // Formulário: quem decide é ele. Vem primeiro de propósito.
  if (dialogo.querySelector('input, select, textarea, mat-select, mat-radio-group')) return null;

  const texto = (dialogo.textContent || '').replace(/\s+/g, ' ').trim();
  const semAcento = texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

  // O diálogo tem de falar de concluir/encerrar o atendimento.
  if (!/conclu|encerra|finaliza/.test(semAcento)) return null;

  // O botão de confirmar, entre os do diálogo. "Cancelar" e "Voltar" nunca entram.
  const botoes = [...dialogo.querySelectorAll('button')];
  const botao = botoes.find((b) => {
    const t = (b.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
    if (!t) return false;
    if (/cancel|voltar|fechar|nao|sair/.test(t)) return false;
    return /conclu|confirm|^sim$|prosseguir|continuar/.test(t);
  });
  if (!botao || botao.disabled) return null;

  return { botao, texto };
}

/** Detecta diálogo do Material aberto (ex.: motivo de conclusão) para não atropelar o fluxo. */
export function hasOpenDialog() {
  return !!document.querySelector('.cdk-overlay-container mat-dialog-container');
}

/**
 * Fecha com Escape o menu/diálogo do Material que estiver aberto.
 *
 * Existe para a rodada automatizada: um fluxo que morre no meio deixa overlay aberto, e
 * overlay do Material é modal e fica POR CIMA do painel (1000 contra 998) — o painel inteiro
 * para de responder. Antes de abrir o próximo contato, limpa o que ficou.
 */
export function closeOverlay() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return true;
}

/**
 * O que está na fila da esquerda AGORA, para você conferir antes de disparar uma rodada.
 *
 * O texto é o do item inteiro achatado (nome, etiquetas, operador, data) — serve de conferência
 * visual e nada mais. Nenhuma decisão de envio depende dele: o envio abre o atendimento e lê o
 * contato pela API.
 */
export function getQueuePreview(max) {
  // Number(max) e não `max = 300`: no modo janela o argumento omitido chega como null pela
  // ponte de mensagens, e o valor padrão só vale para undefined — slice(0, null) devolveria zero.
  const limite = Number(max) > 0 ? Number(max) : 300;
  return getSessionListItems()
    .slice(0, limite)
    .map((el, i) => ({
      index: i,
      texto: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
    }));
}

/**
 * Abre o item da fila na posição `index` e devolve qual sessão ficou aberta.
 *
 * Diferente do `openNextSession`, que só clica no topo: numa rodada em lote o item concluído
 * pode continuar na lista (depende do filtro aplicado na plataforma). Quem percorre a fila
 * precisa poder andar de posição, e é o chamador que decide — comparando o id devolvido com os
 * que já visitou — se avança ou se o topo já é outro atendimento.
 */
export async function openQueueSession(index, opts) {
  // `opts || {}`: pela ponte de mensagens o argumento omitido vira null, e desestruturar null
  // é TypeError — o padrão `= {}` só cobre undefined.
  const { timeoutMs = 2500, aba = null } = opts || {};

  // A aba é garantida a CADA item, não uma vez por rodada: assumir o atendimento move o
  // contato de "Novos" para "Meus" e leva a plataforma junto. Sem voltar, a rodada seguiria
  // percorrendo os "Meus" — justamente quem já foi atendido.
  let avisoAba = null;
  if (aba) {
    const trocou = await selectQueueTab(aba);
    if (!trocou.ok) {
      // **Para aqui, sem olhar a lista.** Falhou a troca, a lista na tela é OUTRA — e o que a
      // rodada diria olhando para ela ("a fila carregada acabou") seria mentira: aconteceu ao
      // vivo, com a rodada parando depois do primeiro contato e culpando o tamanho da fila de
      // "Meus". Erro de aba é erro de aba, e tem que aparecer com esse nome.
      return { ok: false, avisoAba: trocou.reason, reason: trocou.reason };
    }
    avisoAba = trocou.confirmado ? null : `Cliquei na aba "${aba}" mas não deu para confirmar a troca.`;
  }

  // A lista vem do servidor e demora: medida entre 13 s e mais de 25 s na lista dos arquivados.
  // Ler antes disso era afirmar "a fila acabou" sobre uma lista que ainda nem tinha chegado —
  // e, pior, clicar numa posição que ainda ia mudar de dono quando os itens pintassem.
  // `esperaDoSpinnerMs: 0` porque aqui NÃO houve clique nosso: ou o `selectQueueTab` acima já
  // esperou a lista da aba que ele trocou, ou a aba já era a certa e não há requisição a nascer.
  // Sem isso, cada item da rodada pagaria 1,2s de espera por um spinner que não vem.
  const carga = await esperarFilaCarregar({ esperaDoSpinnerMs: 0 });

  const itens = getSessionListItems();
  if (index >= itens.length) {
    // Os dois "zero" NÃO são a mesma coisa, e dizer o nome certo é o que evita o próximo
    // diagnóstico perdido: lista vazia é filtro; lista que não chegou é lentidão da plataforma.
    const motivoVazio = carga.estourou
      ? 'A lista da fila NÃO terminou de carregar (a plataforma passou de 60s). Nada foi aberto — tente de novo daqui a pouco.'
      : 'A lista terminou de carregar e veio VAZIA — confira o filtro da fila na plataforma.';

    return {
      ok: false,
      avisoAba,
      total: itens.length,
      reason: itens.length ? `A fila carregada acabou (${itens.length} item(ns)).` : motivoVazio,
    };
  }

  const antes = getSessionId();
  const alvo = itens[index].querySelector('div') || itens[index];
  alvo.click();

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 120));
    const agora = getSessionId();
    if (agora && agora !== antes) {
      return { ok: true, changed: true, avisoAba, sessionId: agora, total: itens.length };
    }
  }
  // Sem troca: normalmente é o atendimento que já estava aberto. Quem chamou decide o que fazer.
  return { ok: true, changed: false, avisoAba, sessionId: getSessionId(), total: itens.length };
}

/**
 * Sinal de "a conversa mudou", para o painel perceber que o contato respondeu SEM você
 * precisar sair do atendimento e voltar.
 *
 * Verificado ao vivo: `.message-text` é classe do próprio app (não utilitária do Tailwind,
 * portanto bem menos volátil), a lista **não** é virtualizada (sem `cdk-virtual-scroll-viewport`)
 * e a última no DOM é a mensagem mais recente — bate com o primeiro item que a API devolve.
 *
 * Contagem E texto do fim juntos: a contagem sozinha muda ao rolar para trás (carrega mensagens
 * antigas), e o texto do fim sozinho não distingue duas mensagens iguais seguidas.
 */
/**
 * O canal (o número do WhatsApp) caiu?
 *
 * A plataforma põe uma tarja no topo: *"O WhatsApp (51) 9xxxx-xxxx foi **desconectado da
 * Z-API**. Solicite ao administrador da conta que realize a reconexão."* Com o canal fora,
 * mensagem nenhuma sai daquele número — e a plataforma **aceita** o envio: o balão aparece na
 * conversa e fica lá, sem entregar. A rodada contaria como enviado, marcaria no anti-duplicata
 * e concluiria o atendimento. O contato sumiria do trabalho sem nunca ter recebido nada.
 *
 * A conta tem mais de uma instância, e cai uma por vez — daí devolver os NÚMEROS, não um
 * "está fora" geral: quem decide se este atendimento é dos afetados é quem compara.
 *
 * Busca por TEXTO, não por classe: a tarja é do tema da plataforma e o texto é o que ela
 * promete ao usuário. Achado o pedaço "desconectad…", sobe até o bloco que contém o número —
 * o negrito parte a frase em vários nós, então o nó do texto sozinho não traz o telefone.
 */
export function canalDesconectado() {
  for (const no of textosDaPagina(/desconectad[oa]/i)) {
    let el = no.parentElement;
    // Até três níveis: o suficiente para juntar a frase quebrada pelo negrito, e pouco o
    // bastante para não subir até um contêiner que engloba a conversa inteira.
    for (let i = 0; i < 3 && el; i++, el = el.parentElement) {
      const texto = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!TELEFONE.test(texto)) continue;

      /**
       * A palavra "desconectado" sozinha NÃO basta, e este é o caso que o fixture pegou: um
       * contato escrevendo *"fiquei desconectado uns dias, desculpa a demora"* casava, o bloco
       * três níveis acima trazia o telefone do cabeçalho, e a rodada recusava enviar para uma
       * pessoa que não tinha nada a ver com isso. Falso positivo aqui é trabalho travado.
       *
       * A tarja promete duas coisas que a conversa não tem: o provedor e o que fazer a
       * respeito. Uma das duas é o que a distingue.
       */
      if (!/z-?api|reconex|solicite ao administrador/i.test(texto)) break;

      const numeros = [...new Set((texto.match(new RegExp(TELEFONE, 'g')) || []).map(soDigitos))];
      return { desconectado: true, numeros, texto: texto.slice(0, 200) };
    }
  }
  return { desconectado: false, numeros: [], texto: '' };
}

/**
 * O número da instância que atende a conversa aberta — o "(51) 9xxxx-xxxx" ao lado de
 * "Instância f68546" no cabeçalho.
 *
 * É ele que diz se a tarja de canal caído fala DESTE atendimento ou de outro. Sem isso, tarja
 * na tela viraria "não envie para ninguém", e a conta tem instância boa junto com a ruim.
 */
export function numeroDaConversa() {
  for (const no of textosDaPagina(/inst[âa]ncia/i)) {
    let el = no.parentElement;
    for (let i = 0; i < 4 && el; i++, el = el.parentElement) {
      const texto = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const achado = texto.match(TELEFONE);
      if (achado) return soDigitos(achado[0]);
    }
  }
  return '';
}

/** (51) 99511-0122, 51 99511-0122, 5199511-0122 — os formatos que a tela usa. */
const TELEFONE = /\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}/;

/** Só os dígitos, para comparar número escrito de jeitos diferentes. */
function soDigitos(texto) {
  return String(texto || '').replace(/\D/g, '');
}

/**
 * Os nós de texto da página que casam com o padrão, um a um.
 *
 * `TreeWalker` em vez de `querySelectorAll('div,span')`: percorre só nós de texto e não depende
 * de nome de classe nenhum. Trechos muito longos são pulados — texto de conversa inteira nunca
 * é a tarja que estamos procurando.
 *
 * Devolve TODOS os acertos, e não o primeiro: a palavra procurada pode aparecer antes numa
 * mensagem do contato, e parar ali faria a tarja de verdade passar despercebida.
 */
function* textosDaPagina(padrao, maxLen = 300) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let no = walker.nextNode(); no; no = walker.nextNode()) {
    const texto = no.nodeValue;
    if (!texto || texto.length > maxLen) continue;
    if (padrao.test(texto)) yield no;
  }
}

export function getConversationSignal() {
  const conv = document.querySelector('sessions-conversation');
  if (!conv) return '';
  const nos = conv.querySelectorAll('.message-text');
  const ultimo = nos[nos.length - 1];
  const texto = (ultimo?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return `${nos.length}:${texto}`;
}

// ---------------------------------------------------------------------------
// Modelo de mensagem (template aprovado do WhatsApp)
// ---------------------------------------------------------------------------

/**
 * Fatos verificados ao vivo no diálogo "Enviar modelo de mensagem":
 *  - abre pelo clipe do rodapé (mat-icon paper-clip) → item de menu "Modelo de mensagem";
 *  - é Material legado: menu é `button.mat-menu-item`, diálogo é `mat-dialog-container`;
 *  - a lista é VIRTUALIZADA: só ~6 linhas existem no DOM por vez, de 19 modelos. Por isso
 *    escolher passa pelo campo de busca (que refaz o GET no servidor), nunca por rolagem;
 *  - as duas telas (lista e parâmetros) são o MESMO diálogo. O que distingue é o botão:
 *    "Continuar" na lista, "Enviar mensagem" na tela de parâmetros.
 */

export const MENU_MODELO_MENSAGEM = 'Modelo de mensagem';

/** Clipe do rodapé, que abre o menu de anexos. */
export function getAnexoButton() {
  const root = getComposerRoot();
  const icon = (root || document).querySelector('mat-icon[data-mat-icon-name="paper-clip"]');
  return icon ? icon.closest('button') : null;
}

/** Item do menu de anexos pelo rótulo exato. */
export function getMenuItem(label) {
  return (
    [...document.querySelectorAll('.cdk-overlay-container button.mat-menu-item')].find(
      (b) => b.textContent.replace(/\s+/g, ' ').trim() === label
    ) || null
  );
}

export function getDialog() {
  return document.querySelector('.cdk-overlay-container mat-dialog-container');
}

/** Botão do diálogo pelo rótulo ("Continuar", "Enviar mensagem", "Voltar", "Cancelar"). */
export function getDialogButton(label) {
  const dlg = getDialog();
  if (!dlg) return null;
  return (
    [...dlg.querySelectorAll('button')].find(
      (b) => b.textContent.replace(/\s+/g, ' ').trim() === label
    ) || null
  );
}

export function getTemplateSearchInput() {
  const dlg = getDialog();
  return dlg ? dlg.querySelector('input.mat-input-element') : null;
}

/**
 * As linhas de modelo que estão no DOM agora. Cada uma tem o nome e o começo do texto —
 * os dois juntos são o que desempata nomes repetidos ("A" e "A", "Flávio" e "Flávio").
 * @returns {Array<{radio:Element, row:Element, name:string, preview:string}>}
 */
export function getTemplateRows() {
  const dlg = getDialog();
  if (!dlg) return [];
  return [...dlg.querySelectorAll('mat-radio-button')]
    .map((radio) => {
      const row = radio.closest('div.rounded-lg') || radio.parentElement;
      const info = row ? row.querySelector('div.flex-1') : null;
      return {
        radio,
        row,
        name: info?.firstElementChild?.textContent.replace(/\s+/g, ' ').trim() || '',
        preview: info?.querySelector('p')?.textContent.replace(/\s+/g, ' ').trim() || '',
      };
    })
    .filter((r) => r.row);
}
