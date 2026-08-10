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

const BOUNDS_KEY = 'windowBounds';
const DEFAULT_BOUNDS = { width: 430, height: 760, left: 40, top: 60 };

let panelWindowId = null;

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
