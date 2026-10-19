/**
 * facebook-content.js — carregador do painel de comentarios, na aba do Facebook.
 *
 * E o gemeo do `content.js`: content script classico nao aceita `import`, entao
 * ele so faz o import dinamico do modulo real. O arquivo separado existe porque
 * o `main.js` do mobiliza monta o painel INTEIRO e depende da API de la
 * (`setTransport`, `waitForToken`, a ponte RPC) — nada disso existe aqui.
 */
(async () => {
  try {
    await import(chrome.runtime.getURL('src/facebook-main.js'));
  } catch (err) {
    console.error('[WhatsFill] falha ao carregar o painel do Facebook:', err);
  }
})();
