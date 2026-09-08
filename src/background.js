/**
 * background.js — o que o clique no ícone da extensão faz.
 *
 * Regra:
 *  - está numa aba do mobiliza → mostra/esconde o painel **encaixado** nela (é o modo do dia a
 *    dia: empurra a página em vez de cobrir a conversa);
 *  - está em qualquer outra aba → abre a **janela separada** do painel, que continua dirigindo
 *    a aba do mobiliza (útil em dois monitores).
 *
 * A janela separada lembra posição e tamanho.
 */

import { RPC } from './lib/rpc.js';
import { MSG_ENERGIA } from './lib/keepalive.js';
import { MSG_FLUXO } from './lib/fluxo-msg.js';
import { MSG_IA, atender } from './lib/ia-cliente.js';
import {
  podeGastar,
  acumularGasto,
  custoEmDolares,
  provedorDoModelo,
  CHAVE_DO_PROVEDOR,
  MODELO_PADRAO,
} from './lib/ia.js';
import * as store from './lib/store.js';

const BOUNDS_KEY = 'windowBounds';
const DEFAULT_BOUNDS = { width: 430, height: 760, left: 40, top: 60 };

let panelWindowId = null;

/**
 * Trava de modo de espera, pedida pela aba durante a rodada.
 *
 * Mora aqui porque `chrome.power` só existe em contexto de extensão — content script não
 * alcança. `display` mantém tela e sistema acordados: manter só o sistema deixaria a tela
 * apagar, e tela apagada volta a ser candidata a congelar a aba, que é o que o áudio do
 * `keepalive` está ali para evitar.
 *
 * O estado é global do navegador, não por aba: duas rodadas ao mesmo tempo pedindo a trava e
 * uma delas terminando soltaria a da outra. Por isso a contagem de quem pediu.
 */
let travasDeEnergia = 0;

/**
 * A avaliação por IA sai DAQUI, e não do painel — é o que mantém a chave fora da página.
 *
 * O painel vive dentro da aba do mobiliza, e o `page-hook.js` roda no mesmo contexto JS do
 * Angular deles. Chave de API na página é chave publicada. Aqui ela é lida do armazenamento da
 * extensão, usada, e não atravessa nenhuma fronteira: o painel manda o pedido e recebe a
 * decisão, nunca a credencial.
 *
 * `return true` mantém o canal aberto para a resposta assíncrona — sem ele o painel recebe
 * `undefined` e a rodada acha que a IA não respondeu.
 */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== MSG_IA) return undefined;

  (async () => {
    try {
      /**
       * **A chave é a do provedor DESTE modelo** — são duas, e as duas convivem.
       *
       * Quem decide é `provedorDoModelo`, a mesma função que o `ia-cliente` usa para escolher o
       * endpoint: uma fonte de verdade. Guardar o provedor à parte do modelo daria a combinação
       * impossível (chave da Anthropic mandada para a OpenAI) com um 401 de mensagem inútil.
       *
       * A leitura é `chrome.storage.local` direto e não `store.get` de propósito: credencial não
       * passa pela mescla de defaults nem pelo backup exportado.
       */
      const modeloDoPedido = msg.modelo || MODELO_PADRAO;
      const chaveDe = async (modelo) => {
        const nome = CHAVE_DO_PROVEDOR[provedorDoModelo(modelo)];
        const guardado = await chrome.storage.local.get(nome);
        return guardado[nome];
      };
      const chave = await chaveDe(modeloDoPedido);

      // O teto ANTES da chamada. Este é o único ponto por onde sai dinheiro, e é por isso que a
      // trava mora aqui e não no painel: nenhum caminho novo lá consegue passar por fora.
      const conf = (await store.get('ia')) || {};
      const veredito = podeGastar({ gasto: conf.gasto, tetoUsd: conf.tetoUsd });
      if (!veredito.pode) {
        sendResponse({ ok: false, motivo: veredito.motivo, tetoAtingido: true });
        return;
      }

      /**
       * **O FAILSAFE: falhou o titular, tenta o reserva** — pedido dele (08/09/2026), depois de a
       * IA pendurar duas vezes: *"se for algo comum tem que ter um failsafe; eu já quero botar o
       * chatgpt, então o padrão seria chatgpt atender, se ele falhar tenta com o claude"*.
       *
       * **Mora AQUI, e não no painel**, pela mesma razão que o teto: este é o único ponto por onde
       * o dinheiro passa. As duas chamadas são contabilizadas, e a segunda não escapa do teto —
       * ela é feita depois de o teto já ter sido conferido nesta mesma passada, e o gasto das duas
       * entra na conta.
       *
       * **Quando NÃO tenta:** sem modelo reserva configurado, reserva igual ao titular (repetir a
       * mesma casa não é failsafe), ou sem chave do provedor do reserva. Nesses casos a falha do
       * titular é a resposta, como era antes.
       *
       * **Tenta em qualquer falha do titular** (`ok: false`), de propósito: 401, 429, 500, timeout
       * e sem rede são todos "esta casa não atendeu", e é isso que o reserva existe para cobrir. Só
       * o teto de gasto não chega aqui — ele barra antes, lá em cima.
       */
      const contabilizar = async (resultado, modelo, base) => {
        if (!resultado?.custo) return base;
        const usd = custoEmDolares(resultado.custo, modelo);
        const c = resultado.custo;
        const tokens = (c.entrada || 0) + (c.cacheEscrito || 0) + (c.cacheLido || 0) + (c.saida || 0);
        const gasto = acumularGasto(base, usd, Date.now(), tokens);
        resultado.custoUsd = usd;
        return gasto;
      };

      let r = await atender(msg, chave);
      let gasto = await contabilizar(r, modeloDoPedido, conf.gasto);

      const reserva = String(conf.modeloReserva || '').trim();
      if (!r?.ok && reserva && reserva !== modeloDoPedido) {
        const chaveReserva = await chaveDe(reserva);
        if (chaveReserva) {
          const motivoDoTitular = r?.motivo || 'sem motivo';
          const segunda = await atender({ ...msg, modelo: reserva }, chaveReserva);
          gasto = await contabilizar(segunda, reserva, gasto);
          /**
           * O motivo do titular vai junto **nos dois desfechos**: se o reserva salvou, ele explica
           * por que o log fala de outro modelo; se os dois falharam, esconder o primeiro faria a
           * tela culpar a casa errada.
           */
          if (segunda?.ok) {
            r = { ...segunda, usouReserva: reserva, motivoDoTitular };
          } else {
            r = {
              ...segunda,
              usouReserva: reserva,
              motivo: `${modeloDoPedido}: ${motivoDoTitular} — e o reserva ${reserva}: ${segunda?.motivo || 'sem motivo'}`,
            };
          }
        }
      }

      if (gasto !== conf.gasto) {
        await store.set('ia', { ...conf, gasto });
        r.gastoMes = gasto;
      }

      sendResponse(r);
    } catch (err) {
      // Falha aqui nunca pode derrubar a rodada: vira "incerto" do outro lado.
      sendResponse({ ok: false, motivo: err?.message || String(err) });
    }
  })();
  return true;
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== MSG_ENERGIA) return undefined;

  try {
    if (msg.manterAcordado) {
      travasDeEnergia++;
      chrome.power.requestKeepAwake('display');
    } else {
      travasDeEnergia = Math.max(0, travasDeEnergia - 1);
      if (travasDeEnergia === 0) chrome.power.releaseKeepAwake();
    }
    sendResponse({ ok: true, travas: travasDeEnergia });
  } catch (err) {
    // Sem a permissão "power" (ou API indisponível) a rodada continua: ela só perde a trava.
    sendResponse({ ok: false, motivo: err?.message || String(err) });
  }
  return undefined;
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.url?.startsWith('https://mobiliza.app/')) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: RPC, method: 'togglePanel', args: [] });
      await avisar(tab.id, null);
    } catch (_) {
      // Content script velho (extensão recarregada sem F5 na aba) ou ainda não injetado.
      // Não recarregamos a aba por conta própria: você pode ter uma mensagem sendo digitada.
      await avisar(tab.id, 'F5');
    }
    return;
  }
  await openPanelWindow();
});

/** Aviso discreto no próprio ícone, em vez de recarregar a aba sem pedir. */
async function avisar(tabId, texto) {
  await chrome.action.setBadgeText({ tabId, text: texto || '' });
  if (texto) {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#b45309' });
    await chrome.action.setTitle({
      tabId,
      title: 'WhatsFill: recarregue esta aba (F5) para o painel voltar a responder.',
    });
  } else {
    await chrome.action.setTitle({ tabId, title: 'WhatsFill — mostrar/esconder o painel' });
  }
}

async function openPanelWindow() {
  if (panelWindowId != null) {
    try {
      const win = await chrome.windows.get(panelWindowId);
      await chrome.windows.update(win.id, { focused: true, drawAttention: true });
      return;
    } catch (_) {
      panelWindowId = null; // foi fechada
    }
  }

  const bounds = await loadBounds();
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL('src/window.html'),
    type: 'popup',
    focused: true,
    ...bounds,
  });
  panelWindowId = win.id;
}

/** Sempre que você mover ou redimensionar a janela, a posição nova é guardada. */
chrome.windows.onBoundsChanged.addListener(async (win) => {
  if (win.id !== panelWindowId) return;
  await chrome.storage.local.set({
    [BOUNDS_KEY]: sanitize({ left: win.left, top: win.top, width: win.width, height: win.height }),
  });
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === panelWindowId) panelWindowId = null;
});

async function loadBounds() {
  const stored = await chrome.storage.local.get(BOUNDS_KEY);
  return sanitize({ ...DEFAULT_BOUNDS, ...(stored[BOUNDS_KEY] || {}) });
}

/**
 * Descarta valores impossíveis: janela minimizada grava left/top negativos gigantes, e um
 * monitor desconectado deixaria a janela fora da tela na próxima abertura.
 */
function sanitize(bounds) {
  const out = {
    width: clamp(Math.round(bounds.width) || DEFAULT_BOUNDS.width, 320, 2000),
    height: clamp(Math.round(bounds.height) || DEFAULT_BOUNDS.height, 400, 2000),
    left: Math.round(bounds.left),
    top: Math.round(bounds.top),
  };
  if (!Number.isFinite(out.left) || out.left < -200) out.left = DEFAULT_BOUNDS.left;
  if (!Number.isFinite(out.top) || out.top < 0) out.top = DEFAULT_BOUNDS.top;
  return out;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * A JANELA DO FLUXO — aberta daqui, e não do painel.
 *
 * `chrome.windows` **não existe em content script**, e o painel encaixado roda dentro da página do
 * mobiliza: chamar `chrome.windows.create` lá daria `undefined`. É a mesma armadilha do
 * `chrome.power` da rodada, registrada no CLAUDE.md — e eu quase repeti.
 *
 * Uma janela por vez: se ela já está aberta, foca em vez de abrir a segunda. Duas janelas do mesmo
 * fluxo gravando na mesma chave seria a última a salvar ganhando, sem ninguém entender por quê.
 */
let janelaDoFluxoId = null;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== MSG_FLUXO) return undefined;

  (async () => {
    try {
      if (janelaDoFluxoId !== null) {
        const existe = await chrome.windows.get(janelaDoFluxoId).catch(() => null);
        if (existe) {
          await chrome.windows.update(janelaDoFluxoId, { focused: true });
          sendResponse({ ok: true, focada: true });
          return;
        }
        janelaDoFluxoId = null;
      }

      const win = await chrome.windows.create({
        url: chrome.runtime.getURL('src/fluxo.html'),
        type: 'popup',
        focused: true,
        // Larga porque o mapa e ramificado: condicao a esquerda, desfecho a direita.
        width: 1400,
        height: 900,
      });
      janelaDoFluxoId = win.id;
      sendResponse({ ok: true });
    } catch (err) {
      sendResponse({ ok: false, motivo: String(err?.message || err) });
    }
  })();

  return true; // resposta assíncrona
});

chrome.windows.onRemoved.addListener((id) => {
  if (id === janelaDoFluxoId) janelaDoFluxoId = null;
});
