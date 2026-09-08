/**
 * A mensagem que pede ao service worker para abrir a janela do PADRÃO DE ATENDIMENTO.
 *
 * Em arquivo próprio pelo mesmo motivo do `fluxo-msg.js`: os dois lados importam — o painel (que
 * roda em content script e **não alcança `chrome.windows`**) e o background (que alcança).
 * Constante duplicada nas duas pontas é como as duas divergem numa renomeação.
 */
export const MSG_PADRAO = 'whatsfill-padrao';
