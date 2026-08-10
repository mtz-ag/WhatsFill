/**
 * window.js — bootstrap da janela do painel.
 *
 * Liga o painel à aba do mobiliza: instala o transporte da API (que executa as chamadas dentro
 * da aba), monta a interface e escuta os avisos de troca de atendimento.
 */

import { createPanel } from './panel/panel.js';
import * as page from './lib/page.js';
import { setTransport } from './lib/api.js';
import { EVENT_PAGE_STATE } from './lib/rpc.js';

// A API do mobiliza recusa requisições que não venham de https://mobiliza.app, então o painel
// não fala com ela direto: pede para a aba executar. O token nem chega aqui.
setTransport((path, opts) => page.api(path, opts));

const panel = createPanel({ mode: 'window' });
document.body.append(panel.root);

/** A aba avisa quando o atendimento aberto (ou o estado dele) muda. */
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === EVENT_PAGE_STATE) panel.applyPageState(msg.state);
});

/** Se você passar a trabalhar em outra aba do mobiliza, o painel segue ela. */
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  if (tabId === page.getTabId()) return;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab?.url?.startsWith('https://mobiliza.app/')) boot();
});

async function boot() {
  // refresh() já trata e explica a falta de aba; aqui só sobra o inesperado.
  try {
    await panel.refresh();
  } catch (err) {
    panel.setStatus('Falha ao iniciar o painel: ' + err.message, 'err');
  }
}

boot();
