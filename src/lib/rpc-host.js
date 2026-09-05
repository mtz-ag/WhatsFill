/**
 * rpc-host.js — lado da aba: executa o que a JANELA SEPARADA do painel pede.
 *
 * No modo encaixado (o padrão) isto nem entra em jogo: o painel roda aqui dentro e chama
 * page.js direto. Este arquivo é a ponte só para quando o painel está em janela própria.
 *
 * As implementações não são duplicadas: são as mesmas de page.js, que no contexto da aba já
 * resolve tudo localmente.
 */

import { RPC, EVENT_PAGE_STATE } from './rpc.js';
import * as page from './page.js';

/** Chamado pelo main.js para o clique no ícone poder mostrar/esconder o painel encaixado. */
let togglePanel = () => {
  throw new Error('Painel encaixado não está montado nesta aba.');
};

export function setPanelToggle(fn) {
  togglePanel = fn;
}

const methods = {
  /**
   * Chamada de API executada AQUI, na aba. É o que resolve o "Origin not allowed": a API do
   * mobiliza só aceita requisições vindas de https://mobiliza.app.
   */
  api: (path, opts) => page.api(path, opts),

  pageState: () => page.getState(),
  setComposerText: (text) => page.setComposerText(text),
  sendText: (text) => page.sendText(text),
  clickIniciar: () => page.clickIniciar(),
  clickReiniciar: () => page.clickReiniciar(),
  clickConcluir: () => page.clickConcluir(),
  diagnosticarAbas: () => page.diagnosticarAbas(),
  canalForaDoAr: () => page.canalForaDoAr(),
  temConversaAnterior: () => page.temConversaAnterior(),
  openNextSession: (opts) => page.openNextSession(opts),
  queuePreview: (max) => page.queuePreview(max),
  openQueueSession: (index, opts) => page.openQueueSession(index, opts),
  carregarMaisDaFila: (opts) => page.carregarMaisDaFila(opts),
  closeOverlay: () => page.closeOverlay(),
  sendMessageTemplate: (template, opts) => page.sendMessageTemplate(template, opts),
  learnStart: (args) => page.learnStart(args),
  learnStatus: () => page.learnStatus(),
  recorderBuffer: () => page.recorderBuffer(),
  recorderStop: () => page.recorderStop(),
  togglePanel: () => togglePanel(),
};

export function installRpcHost() {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== RPC) return undefined;

    const fn = methods[msg.method];
    if (!fn) {
      sendResponse({ error: `Método desconhecido: ${msg.method}` });
      return undefined;
    }

    Promise.resolve()
      .then(() => fn(...(msg.args || [])))
      .then((result) => sendResponse({ result }))
      .catch((err) => sendResponse({ error: err?.message || String(err) }));

    return true; // resposta assíncrona
  });
}

/**
 * Observa o estado da página e avisa quem precisa: o painel encaixado (assinantes locais) e o
 * painel em janela (por mensagem).
 *
 * Polling porque o content script vive num mundo JS separado do Angular: interceptar as
 * navegações do app daqui não funcionaria.
 */
const subscribers = [];

export function onPageState(fn) {
  subscribers.push(fn);
}

export function watchPageState(intervalMs = 500) {
  let last = '';
  setInterval(() => {
    const state = page.getState();
    const key = `${state.sessionId}|${state.isPending}|${state.hasComposer}|${state.dark}|${state.conversation}`;
    if (key === last) return;
    last = key;

    subscribers.forEach((fn) => {
      try {
        fn(state);
      } catch (err) {
        console.warn('[WhatsFill] assinante do estado falhou:', err);
      }
    });

    // Sem janela aberta ninguém escuta, e o erro é esperado — daí o catch vazio.
    chrome.runtime.sendMessage({ type: EVENT_PAGE_STATE, state }).catch(() => {});
  }, intervalMs);
}
