/**
 * page-hook.js — roda no mundo MAIN (mesmo contexto JS do Angular).
 *
 * Existe por um motivo só: o access token do mobiliza.app vive na memória do app
 * (só o refresh-token fica no localStorage) e é anexado como header em XHR. Um content
 * script no mundo ISOLATED não consegue ler isso, então interceptamos aqui e mandamos
 * o token para o mundo ISOLATED por postMessage.
 *
 * O segundo papel é o gravador (Fase 0): capturar método/URL/body das requisições que a
 * própria plataforma faz quando você altera um campo pela interface, para a extensão
 * aprender o contrato de escrita em vez de adivinhá-lo.
 *
 * Nada é enviado para fora da página. Script clássico (sem import/export) de propósito.
 */
(() => {
  'use strict';

  if (window.__whatsfillHooked) return;
  window.__whatsfillHooked = true;

  const API = 'https://api.mobiliza.app';
  const ORIGIN = window.location.origin;
  let recording = false;
  let lastToken = null;

  function send(type, payload) {
    try {
      window.postMessage({ __whatsfill: 'page', type, payload }, ORIGIN);
    } catch (_) {
      /* payload não serializável — ignora */
    }
  }

  window.addEventListener('message', (ev) => {
    if (ev.source !== window || ev.origin !== ORIGIN) return;
    const msg = ev.data;
    if (!msg || msg.__whatsfill !== 'cs') return;
    if (msg.type === 'recorder') recording = !!msg.payload?.enabled;
    if (msg.type === 'ping' && lastToken) send('token', { token: lastToken });
  });

  // ---- XHR -----------------------------------------------------------------
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      this.__wf = { method: String(method || '').toUpperCase(), url: String(url || '') };
    } catch (_) {}
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try {
      if (/^authorization$/i.test(name) && value && value !== lastToken) {
        lastToken = value;
        send('token', { token: value });
      }
    } catch (_) {}
    return origSetHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    try {
      const info = this.__wf;
      if (recording && info && interessa(info.url) && info.method !== 'GET') {
        send('request', {
          method: info.method,
          url: info.url,
          body: serializeBody(body),
          at: Date.now(),
        });
        /**
         * **A RESPOSTA também, e só gravando** (20/09/2026, o envio de imagem). O upload de arquivo
         * é uma cadeia: a primeira chamada devolve a URL assinada, e sem ler a resposta não há como
         * saber para onde o arquivo vai. O contrato de escrita no CRM nunca precisou disto — ali o
         * pedido bastava —, então a captura da resposta nasce agora, e **só com a gravação ligada**.
         */
        this.addEventListener('load', () => {
          try {
            send('response', {
              url: info.url,
              status: this.status,
              body: String(this.responseText || '').slice(0, 4000),
              at: Date.now(),
            });
          } catch (_) {}
        });
      }
    } catch (_) {}
    return origSend.apply(this, arguments);
  };

  // ---- fetch (a plataforma usa XHR, mas cobrimos os dois) -------------------
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : input && input.url;
      const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (init && init.headers) {
        const auth = new Headers(init.headers).get('authorization');
        if (auth && auth !== lastToken) {
          lastToken = auth;
          send('token', { token: auth });
        }
      }
      if (recording && url && interessa(String(url)) && method !== 'GET') {
        send('request', { method, url: String(url), body: serializeBody(init && init.body), at: Date.now() });
        return origFetch.apply(this, arguments).then((r) => {
          try {
            r.clone()
              .text()
              .then((t) => send('response', { url: String(url), status: r.status, body: String(t || '').slice(0, 4000), at: Date.now() }))
              .catch(() => {});
          } catch (_) {}
          return r;
        });
      }
    } catch (_) {}
    return origFetch.apply(this, arguments);
  };

  /**
   * **O que entra na gravação.** A API do mobiliza, como sempre — e agora o UPLOAD, que sai para
   * outro endereço (o armazenamento assinado). Sem ele a cadeia da imagem fica com um buraco no meio,
   * e é justamente o passo que leva os bytes.
   */
  function interessa(url) {
    const u = String(url || '');
    return u.startsWith(API) || /(amazonaws\.com|storage\.googleapis\.com|blob\.core\.windows\.net)/i.test(u);
  }

  function serializeBody(body) {
    if (body == null) return null;
    if (typeof body === 'string') return body;
    if (body instanceof URLSearchParams) return body.toString();
    if (body instanceof FormData) {
      const out = {};
      for (const [k, v] of body.entries()) out[k] = typeof v === 'string' ? v : '[arquivo]';
      return JSON.stringify(out);
    }
    try {
      return JSON.stringify(body);
    } catch (_) {
      return '[body não serializável]';
    }
  }
})();
