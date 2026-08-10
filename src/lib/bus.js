/**
 * bus.js — ponte entre o mundo MAIN (page-hook.js) e o mundo ISOLATED (o painel).
 *
 * O token nunca vai para chrome.storage: fica só nesta variável em memória. Se a aba
 * recarregar, o hook recaptura na primeira requisição do app.
 */

const ORIGIN = window.location.origin;
const listeners = { token: [], request: [] };

let token = null;

window.addEventListener('message', (ev) => {
  if (ev.source !== window || ev.origin !== ORIGIN) return;
  const msg = ev.data;
  if (!msg || msg.__whatsfill !== 'page') return;

  if (msg.type === 'token' && msg.payload?.token) {
    token = msg.payload.token;
    listeners.token.forEach((fn) => fn(token));
  } else if (msg.type === 'request') {
    listeners.request.forEach((fn) => fn(msg.payload));
  }
});

function toPage(type, payload) {
  window.postMessage({ __whatsfill: 'cs', type, payload }, ORIGIN);
}

/** Espera o hook capturar o token. O app dispara XHR constantemente, então costuma vir rápido. */
export function waitForToken(timeoutMs = 20000) {
  if (token) return Promise.resolve(token);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error('Token não capturado. Interaja com a plataforma (abra um atendimento) e tente de novo.'));
    }, timeoutMs);
    const handler = (t) => {
      clearTimeout(timer);
      off();
      resolve(t);
    };
    const off = () => {
      const i = listeners.token.indexOf(handler);
      if (i >= 0) listeners.token.splice(i, 1);
    };
    listeners.token.push(handler);
    // Só depois de registrar o ouvinte: o hook pode já ter o token de antes do painel subir.
    toPage('ping', {});
  });
}

export function onRecordedRequest(fn) {
  listeners.request.push(fn);
}

export function setRecording(enabled) {
  toPage('recorder', { enabled: !!enabled });
}
