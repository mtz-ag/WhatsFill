/**
 * page.js — o que o painel usa para mexer na página e falar com a API.
 *
 * Dois modos, mesma interface:
 *
 *  - ENCAIXADO (o padrão): o painel roda dentro da aba do mobiliza, então tudo é chamada
 *    direta. É também o modo em que a API funciona sem atrito, porque a requisição sai com
 *    `Origin: https://mobiliza.app` — que é o único que o servidor aceita.
 *  - JANELA SEPARADA: o painel roda numa janela própria e não tem o DOM da plataforma nem o
 *    token, então tudo vira mensagem para o content script (ver rpc-host.js).
 */

import { callTab, findMobilizaTab } from './rpc.js';
import * as dom from './dom.js';
import * as composer from './composer.js';
import * as recorder from './recorder.js';
import * as hsm from './hsm.js';
import { apiFetch } from './api.js';

/** Estamos rodando dentro da aba do mobiliza? */
export const IS_IN_PAGE = location.hostname === 'mobiliza.app';

// ---------------------------------------------------------------------------
// Resolução da aba (só no modo janela separada)
// ---------------------------------------------------------------------------

let tabId = null;

export async function resolveTab({ force = false } = {}) {
  if (IS_IN_PAGE) return null;

  if (tabId != null && !force) {
    try {
      await chrome.tabs.get(tabId);
      return tabId;
    } catch (_) {
      tabId = null; // aba foi fechada
    }
  }
  const tab = await findMobilizaTab();
  if (!tab) {
    throw new Error('Nenhuma aba do mobiliza.app aberta. Abra a plataforma e clique em Recarregar.');
  }
  tabId = tab.id;
  return tabId;
}

export function getTabId() {
  return tabId;
}

async function call(method, args = []) {
  const id = await resolveTab();
  try {
    return await callTab(id, method, args);
  } catch (err) {
    // Aba trocada ou recarregada: tenta reencontrar uma vez antes de desistir.
    const retryId = await resolveTab({ force: true });
    if (retryId === id) throw err;
    return callTab(retryId, method, args);
  }
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

function local(fn) {
  return fn;
}

export const api = IS_IN_PAGE
  ? local((path, opts) => apiFetch(path, opts))
  : (path, opts) => call('api', [path, opts]);

export const getState = IS_IN_PAGE ? local(() => pageStateLocal()) : () => call('pageState');

export const setComposerText = IS_IN_PAGE
  ? local((text) => {
      composer.setComposerText(text);
      return true;
    })
  : (text) => call('setComposerText', [text]);

export const sendText = IS_IN_PAGE
  ? local(async (text) => {
      await composer.sendText(text);
      return true;
    })
  : (text) => call('sendText', [text]);

export const clickIniciar = IS_IN_PAGE
  ? local(async () => {
      const btn = dom.getIniciarButton();
      if (!btn) throw new Error('O botão Iniciar não está na tela.');
      btn.click();

      // Espera o COMPOSER, não "deixar de estar pendente".
      //
      // `isPending()` é `sem composer E com botão Iniciar`. O Iniciar some no instante do
      // clique, então a condição fica falsa ANTES de o campo de mensagem existir — a espera
      // acabava na primeira volta e `hasComposer` voltava false. Quem chamava concluía que "a
      // plataforma não liberou o campo de mensagem" e a rodada em lote morria no primeiro
      // contato, depois de já ter assumido o atendimento.
      for (let i = 0; i < 60 && !dom.getComposer(); i++) await sleep(200);
      return pageStateLocal();
    })
  : () => call('clickIniciar');

export const clickConcluir = IS_IN_PAGE
  ? local(async () => {
      const btn = dom.getConcluirButton();
      if (!btn) throw new Error('O botão Concluir não está na tela.');

      // São DOIS cliques, não um: o botão do rodapé abre um menu ("Classificar e concluir" /
      // "Concluir"), e quem fecha o atendimento é o item. Conferido ao vivo. Com um clique só,
      // a plataforma ficava com o menu aberto e o atendimento em andamento — e a rodada
      // seguia dizendo que tinha concluído.
      btn.click();

      let item = null;
      const abertura = Date.now() + 4000;
      while (Date.now() < abertura && !item) {
        await sleep(150);
        item = dom.getMenuConcluirItem();
      }
      if (!item) {
        await fecharOverlay();
        return { ok: false, dialogOpen: dom.hasOpenDialog(), reason: 'o menu do Concluir não abriu' };
      }
      item.click();

      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        await sleep(200);
        // Diálogo de motivo de conclusão: quem decide é o humano, então devolve para o painel.
        if (dom.hasOpenDialog()) return { ok: true, dialogOpen: true };
        // "Reiniciar" no rodapé é o sinal de que fechou. O sumiço do "Concluir" não serve: o
        // item do menu tem o mesmo texto e sobrevive enquanto o menu estiver aberto.
        if (dom.isConcluded()) {
          await fecharOverlay(); // menu que a extensão abriu, a extensão fecha
          return { ok: true, dialogOpen: false, confirmado: true };
        }
      }

      await fecharOverlay();
      return {
        ok: false,
        dialogOpen: dom.hasOpenDialog(),
        reason: 'cliquei em Concluir e o atendimento continuou aberto',
      };
    })
  : () => call('clickConcluir');

export const openNextSession = IS_IN_PAGE
  ? local((opts) => dom.openNextSession(opts))
  : (opts) => call('openNextSession', [opts]);

/** Fila da esquerda, do jeito que o filtro da plataforma deixou. Só conferência visual. */
export const queuePreview = IS_IN_PAGE
  ? local((max) => dom.getQueuePreview(max))
  : (max) => call('queuePreview', [max]);

/** Abre o item da fila naquela posição (usado pela rodada automatizada). */
export const openQueueSession = IS_IN_PAGE
  ? local((index, opts) => dom.openQueueSession(index, opts))
  : (index, opts) => call('openQueueSession', [index, opts]);

/** `async` de propósito: quem chama usa `.catch()`, e valor cru não tem `.catch`. */
export const carregarMaisDaFila = IS_IN_PAGE
  ? local(async (opts) => dom.carregarMaisDaFila(opts))
  : (opts) => call('carregarMaisDaFila', [opts]);

/**
 * Escape no overlay do Material que tenha sobrado de um fluxo interrompido.
 * `async` de propósito: quem chama usa `.catch(...)`, e no modo encaixado um retorno cru
 * (não-promessa) faria o `.catch` estourar TypeError.
 */
export const closeOverlay = IS_IN_PAGE
  ? local(async () => dom.closeOverlay())
  : () => call('closeOverlay');

/**
 * Modelo de mensagem salvo: dirige o diálogo da plataforma. `template` tem que ser objeto
 * simples ({ id, name, text, params }) porque atravessa a ponte de mensagens.
 */
export const sendMessageTemplate = IS_IN_PAGE
  ? local((template, opts) => hsm.sendTemplate(template, opts))
  : (template, opts) => call('sendMessageTemplate', [template, opts]);

export const recorderBuffer = IS_IN_PAGE ? local(() => recorder.getBuffer()) : () => call('recorderBuffer');

// `async` porque o painel chama `page.recorderStop().catch(...)`: no modo encaixado, devolver
// `true` cru fazia o `.catch` estourar "não é função" e derrubar o fim do aprendizado.
export const recorderStop = IS_IN_PAGE
  ? local(async () => {
      recorder.setEnabled(false);
      return true;
    })
  : () => call('recorderStop');

/**
 * Aprendizado do contrato de escrita em duas etapas: começa e depois consulta o status,
 * porque entre uma e outra você vai até a interface do mobiliza alterar o campo.
 * `args.field` precisa ser objeto simples: { id, name, type }.
 */
let learnLocal = { status: 'idle' };

export const learnStart = IS_IN_PAGE
  ? local((args) => {
      learnLocal = { status: 'waiting' };
      recorder
        .learn(args)
        .then((entry) => {
          learnLocal = { status: 'done', entry };
        })
        .catch((err) => {
          learnLocal = { status: 'error', error: err?.message || String(err) };
        })
        .finally(() => recorder.setEnabled(false));
      return true;
    })
  : (args) => call('learnStart', [args]);

export const learnStatus = IS_IN_PAGE ? local(() => learnLocal) : () => call('learnStatus');

export function pageStateLocal() {
  return {
    sessionId: dom.getSessionId(),
    isPending: dom.isPending(),
    hasComposer: !!dom.getComposer(),
    dark: document.body.classList.contains('dark'),
    // Muda quando chega mensagem nova no atendimento aberto. É o que faz o painel reanalisar
    // a resposta do contato na hora, em vez de só quando você troca de atendimento.
    conversation: dom.getConversationSignal(),
    // O atendimento aberto já foi fechado? É o que a tecla 6 fica esperando para retomar.
    concluded: dom.isConcluded(),
    // Diálogo do Material aberto (anexar figura, preview de mídia, motivo de conclusão). A
    // espera da tecla 6 usa isto para não confundir "você está mandando uma imagem" com "você
    // abriu outro atendimento".
    hasDialog: dom.hasOpenDialog(),
    // Rede de segurança da espera da tecla 6: atendimento sem composer, sem Concluir e sem
    // Iniciar está fechado, mesmo que o rótulo da tela mude de nome na próxima versão.
    semControles: dom.semControlesDeAtendimento(),
  };
}

/** Menu/diálogo que a extensão abriu, a extensão fecha — aberto e esquecido trava o painel. */
async function fecharOverlay() {
  try {
    await dom.closeOverlay();
  } catch (_) {
    /* já fechou sozinho */
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
