/**
 * content.js — carregador. Content script clássico não aceita `import`, então ele só
 * faz o import dinâmico do módulo real (src/main.js), que é ES module de verdade.
 * É o que permite o projeto ter módulos sem nenhum build step.
 */
(async () => {
  try {
    await import(chrome.runtime.getURL('src/main.js'));
  } catch (err) {
    console.error('[WhatsFill] falha ao carregar o painel:', err);
  }
})();
