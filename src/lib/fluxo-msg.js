/**
 * A mensagem que pede para o service worker abrir a janela do fluxo.
 *
 * Em arquivo proprio porque os DOIS lados importam: o painel (que roda em content script e nao
 * alcanca `chrome.windows`) e o background (que alcanca). Constante duplicada nas duas pontas e
 * como as duas divergem numa renomeacao.
 */
export const MSG_FLUXO = 'whatsfill-fluxo';
