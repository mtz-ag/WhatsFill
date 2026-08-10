/**
 * dock.js — encaixa o painel na borda direita EMPURRANDO a página, em vez de cobri-la.
 *
 * Funciona porque o layout do mobiliza colabora (verificado ao vivo):
 *  - `html` já é `box-sizing: border-box`, então padding-right encolhe o conteúdo em vez de
 *    aumentar a página e criar barra horizontal;
 *  - nenhum elemento usa `100vw` (que ignoraria o padding);
 *  - o painel nativo "Dados do contato" é `position: fixed` mas sem `left`/`right` explícitos:
 *    ele usa a posição estática do fluxo, então acompanha o encolhimento.
 *
 * Medido na prática com 380px encaixados: body 1920→1540, conversa 1501→1121, lista 1862→1482,
 * e o painel de contato acompanhou (x 1862→1482). Sem barra de rolagem horizontal.
 *
 * Ficam por baixo do painel apenas: a barra de carregamento (6px no topo), o splash screen já
 * escondido, e a gaveta de chat interno da equipe quando aberta — essa é um overlay do próprio
 * app (já cobre o conteúdo dele) e mantém 400px fixos. Não mexemos nela de propósito:
 * sobrescrever classes utilitárias de outra aplicação quebra em silêncio na próxima atualização.
 */

const STYLE_ID = 'whatsfill-dock-style';
const CLASS = 'whatsfill-docked';
export const MIN_WIDTH = 300;
export const MAX_WIDTH = 700;
export const DEFAULT_WIDTH = 380;

export function applyDock(width = DEFAULT_WIDTH) {
  const largura = clamp(width);
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.append(style);
  }
  style.textContent = `
    html.${CLASS} {
      padding-right: ${largura}px !important;
      overflow-x: hidden !important;
    }
  `;
  document.documentElement.classList.add(CLASS);
  return largura;
}

export function removeDock() {
  document.documentElement.classList.remove(CLASS);
}

export function isDocked() {
  return document.documentElement.classList.contains(CLASS);
}

export function clamp(width) {
  const n = Math.round(Number(width) || DEFAULT_WIDTH);
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n));
}
