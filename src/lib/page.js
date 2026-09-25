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
import * as imagem from './imagem.js';
import * as store from './store.js';

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

/**
 * Reabre um atendimento concluído e espera o campo de mensagem aparecer.
 *
 * Espera o COMPOSER, não o sumiço do "Reiniciar" — mesma lição do `clickIniciar`: o botão some
 * no instante do clique, e quem chama precisa do campo de texto, não do botão ausente. Sem a
 * espera, a rodada tentava enviar antes de a plataforma liberar a conversa.
 *
 * Reabrir joga o atendimento para "Meus" (a plataforma troca de aba sozinha) — quem chama
 * precisa voltar para a lista de concluídos antes do próximo.
 */
export const clickReiniciar = IS_IN_PAGE
  ? local(async () => {
      const btn = dom.getReiniciarButton();
      if (!btn) return { ok: false, reason: 'o botão Reiniciar não está na tela' };
      btn.click();

      for (let i = 0; i < 60 && !dom.getComposer(); i++) await sleep(200);
      if (dom.hasOpenDialog()) {
        return { ok: false, dialogOpen: true, reason: 'a plataforma abriu um diálogo ao reiniciar' };
      }
      if (!dom.getComposer()) {
        return { ok: false, reason: 'cliquei em Reiniciar e o campo de mensagem não apareceu' };
      }
      return { ok: true, state: pageStateLocal() };
    })
  : () => call('clickReiniciar');

/** Diagnóstico da barra da fila, para achar o gancho da lista de concluídos. */
export const diagnosticarAbas = IS_IN_PAGE
  ? local(async () => dom.diagnosticarAbasDaFila())
  : () => call('diagnosticarAbas');

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
      let confirmacoes = 0;
      let avisoDaConfirmacao = '';

      while (Date.now() < deadline) {
        await sleep(200);

        /**
         * Diálogo aberto: **confirmação a rodada resolve; formulário devolve para ele.**
         *
         * Print dele (01/09): *"Uma mensagem está aguardando resposta do contato… Tem certeza de
         * que deseja concluir o atendimento?"* com Cancelar/Concluir. A rodada parava em todo
         * contato assim — *"é para concluir e continuar mas está parando tudo"*.
         *
         * Confirmar aqui não decide nada novo: a conclusão foi pedida por ele, dois cliques atrás.
         * O diálogo de MOTIVO, que pede um dado que só ele tem, continua devolvendo — a distinção
         * é feita em `dom.getConfirmacaoDeConclusao`, que recusa qualquer diálogo com campo.
         *
         * `confirmacoes` limita a duas: se a plataforma reabrir o mesmo diálogo sem fechar o
         * atendimento, clicar em laço até o prazo seria bater na mesma porta 40 vezes. Duas cobrem
         * o encadeado ("tem certeza?" → "confirma?") e param antes de virar teimosia.
         */
        const confirmacao = dom.getConfirmacaoDeConclusao();
        if (confirmacao && confirmacoes < 2) {
          confirmacoes++;
          // O texto vai para o painel: ele precisa saber o que foi aceito em nome dele — e este
          // diálogo avisa que mensagens pendentes serão canceladas.
          if (!avisoDaConfirmacao) avisoDaConfirmacao = confirmacao.texto.slice(0, 200);
          confirmacao.botao.click();
          continue;
        }

        // Formulário (ex.: motivo de conclusão), ou confirmação que insistiu: quem decide é ele.
        if (dom.hasOpenDialog()) {
          return { ok: true, dialogOpen: true, avisoDaConfirmacao };
        }
        // "Reiniciar" no rodapé é o sinal de que fechou. O sumiço do "Concluir" não serve: o
        // item do menu tem o mesmo texto e sobrevive enquanto o menu estiver aberto.
        if (dom.isConcluded()) {
          await fecharOverlay(); // menu que a extensão abriu, a extensão fecha
          return { ok: true, dialogOpen: false, confirmado: true, avisoDaConfirmacao };
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

/**
 * **Aprender o envio de IMAGEM** — em duas etapas pela mesma razão do contrato de escrita: entre
 * começar e terminar, ele vai até a plataforma e manda a imagem à mão. No modo JANELA o painel não
 * roda na aba, então o gravador só é alcançável por esta ponte.
 */
let imagemLocal = { status: 'idle' };

export const aprenderImagemStart = IS_IN_PAGE
  ? local(() => {
      imagemLocal = { status: 'waiting' };
      recorder
        .aprenderEnvioDeImagem({})
        .then((contrato) => {
          imagemLocal = { status: 'done', contrato };
        })
        .catch((err) => {
          imagemLocal = { status: 'error', error: err?.message || String(err) };
        })
        .finally(() => recorder.setEnabled(false));
      return true;
    })
  : () => call('aprenderImagemStart');

export const aprenderImagemStatus = IS_IN_PAGE ? local(() => imagemLocal) : () => call('aprenderImagemStatus');

/**
 * **Manda a imagem guardada, com a legenda** — a cadeia inteira está em `imagem.js`, gravada
 * observando a plataforma (20/09/2026).
 *
 * Roda SEMPRE na aba, nos dois modos, por duas razões que se somam: a API recusa qualquer origem
 * que não seja a do mobiliza, e os BYTES não atravessam ponte nenhuma — o que viaja é a CHAVE do
 * armazenamento, e quem lê a imagem é quem vai usá-la (a aba, para o nome e o tipo; o service
 * worker, para subir).
 */
export const enviarImagem = IS_IN_PAGE
  ? local(async ({ sessionId, senderId, chave, legenda }) => {
      const arquivo = await store.get(chave);
      return imagem.enviarImagem({
        sessionId,
        senderId,
        arquivo,
        legenda,
        api: apiFetch,
        subirBytes: (url, mime) => subirBytesPeloWorker({ url, mime, chave }),
      });
    })
  : (args) => call('enviarImagem', [args]);

async function subirBytesPeloWorker({ url, mime, chave }) {
  const r = await chrome.runtime.sendMessage({ type: imagem.MSG_UPLOAD, url, mime, chave });
  if (!r?.ok) throw new Error(r?.erro || 'não consegui subir a imagem');
  return r;
}

/**
 * O canal deste atendimento está fora do ar?
 *
 * Junta as duas leituras da tela — a tarja de desconexão e o número da instância da conversa —
 * e responde a pergunta que a rodada precisa fazer: **manda ou não manda para ESTE contato?**
 *
 * Fora da `pageStateLocal` de propósito: aquilo é lido a cada 400 ms, e isto varre os nós de
 * texto da página. Uma vez por contato é barato; quatro vezes por segundo, não.
 */
export const canalForaDoAr = IS_IN_PAGE
  ? local(() => {
      const aviso = dom.canalDesconectado();
      if (!aviso.desconectado) return { fora: false, texto: '', numero: '' };

      const numero = dom.numeroDaConversa();
      // Sem saber de quem é a conversa não dá para dizer que ela está fora — mas também não dá
      // para dizer que está boa. Devolve o aviso com `numero` vazio e quem chama decide.
      const fora = !numero || aviso.numeros.length === 0 || aviso.numeros.includes(numero);
      return { fora, texto: aviso.texto, numero, numeros: aviso.numeros };
    })
  : () => call('canalForaDoAr');

/**
 * **O NÚMERO da instância que atende esta conversa** — o "(51) 9…" ao lado de "Instância cccad9".
 *
 * Existe desde 24/09/2026 para escolher o CANDIDATO (ver `lib/perfis.js`): o `channelId` da API é
 * um id opaco, e o que ele tem como digitar na Config é o número que a tela mostra.
 *
 * **Atravessa a ponte como o canal caído**, e não é lido direto: no modo JANELA o painel não
 * alcança o DOM da aba, e chamar `dom` de lá é `ReferenceError` no meio do `load()` — de todo
 * contato. Fora da `pageStateLocal` pela mesma razão das duas vizinhas: varre nós de texto, e uma
 * vez por contato é barato.
 */
export const numeroDoCanal = IS_IN_PAGE ? local(() => dom.numeroDaConversa()) : () => call('numeroDoCanal');

/**
 * O contato tem atendimento ANTERIOR? (o botão "Ver conversa anterior" no topo da conversa)
 *
 * Fora da `pageStateLocal` pelo mesmo motivo do canal caído: aquilo é lido a cada 400 ms e isto
 * varre os nós de texto da página. Uma vez por contato é barato.
 */
export const temConversaAnterior = IS_IN_PAGE
  ? local(() => dom.temConversaAnterior())
  : () => call('temConversaAnterior');

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
