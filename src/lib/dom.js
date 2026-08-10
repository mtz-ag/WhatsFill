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

/** A classe que a plataforma põe na aba ativa. */
const ABA_ATIVA = 'bg-gray-300';

export function getQueueTab(label) {
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
  const alvo = getQueueTab(label);
  return !!alvo && alvo.classList.contains(ABA_ATIVA);
}

/**
 * Troca de aba e **confirma** pela marca de ativa, em vez de esperar um tempo fixo e torcer.
 * Não achar a aba é o único caso que devolve `ok: false` — é o que faz a rodada parar em vez de
 * percorrer a fila errada.
 */
export async function selectQueueTab(label, opts) {
  // 6s porque a troca medida ao vivo levou ~1,6s para a aba ficar ativa (a lista recarrega
  // junto). Timeout curto aqui não erra o alvo: só faz a rodada seguir sem confirmação.
  const { timeoutMs = 6000 } = opts || {};
  const alvo = getQueueTab(label);
  if (!alvo) return { ok: false, reason: `Não achei a aba "${label}" na fila.` };

  if (alvo.classList.contains(ABA_ATIVA)) return { ok: true, confirmado: true };
  alvo.click();

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 120));
    if (isQueueTabActive(label)) {
      await new Promise((r) => setTimeout(r, 400)); // a lista ainda está repintando
      return { ok: true, confirmado: true };
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
    if (!trocou.ok) avisoAba = trocou.reason;
  }

  const itens = getSessionListItems();
  if (index >= itens.length) {
    return { ok: false, avisoAba, total: itens.length, reason: `A fila carregada acabou (${itens.length} item(ns)).` };
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
