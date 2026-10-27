/**
 * dock.js — encaixa o painel na borda direita EMPURRANDO a página, em vez de cobri-la.
 *
 * No mobiliza.app e no facebook.com o empurrão é só `padding-right` no `html`, e funciona
 * porque o layout deles colabora (verificado ao vivo):
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
 *
 * ---------------------------------------------------------------------------------------
 * O EMPURRÃO NÃO É O MESMO NAS TRÊS PLATAFORMAS — e só medir mostrou isso (27/10/2026)
 * ---------------------------------------------------------------------------------------
 *
 * Relato dele na primeira vez que o painel subiu no mobiliza.me: *"sobrepôs em vez de
 * empurrar"*. **Medido, e o padding estava sendo aplicado certo — ele é que não alcança nada:**
 * a tela de conversas é `position: fixed; inset: 0`, e elemento `fixed` resolve contra a
 * VIEWPORT, nunca contra a caixa do `html`. Com os 380px de padding no html, a tela continuava
 * com 1708px — a janela inteira, por baixo do painel.
 *
 * O que resolve é **prender o app**: o `#root` vira `fixed inset-0` com `right` na largura do
 * painel, e ganha `contain: layout`, que faz dele o BLOCO CONTENEDOR dos `fixed` de dentro.
 * Medido depois: #root 1328×791, a tela 1328×791 encostada em x=0, o toast dentro da área do
 * app (x=908, antes `w-full`), **zero elementos transbordando** e sem barra horizontal.
 *
 * **`contain: layout` faz `fixed` se comportar como `absolute`** — ou seja, passa a rolar junto
 * com a página. Aqui isso não muda nada, e foi medido ANTES de escolher: `scrollHeight` 791 ===
 * `clientHeight` 791, a página não rola (quem rola são os contêineres internos). Numa plataforma
 * que rolasse, esta mesma regra grudaria o cabeçalho no lugar errado.
 *
 * **Por que o alvo é `#root` e não o `body`:** o painel é pendurado em `document.body`
 * (`main.js`), então `contain` no body encolheria O PAINEL junto. `#root` é IRMÃO do
 * `#whatsfill-host`, e os três elementos `fixed` da plataforma vivem dentro dele — conferidos um
 * a um, nenhum escapa.
 *
 * **E `#root` não é chute:** é o ponto de montagem escrito no `index.html` do Vite, não classe
 * utilitária gerada (que é o que o parágrafo acima proíbe tocar). Mudando de nome, o empurrão
 * simplesmente PARA DE EMPURRAR e ele vê a sobreposição — **falha visível, não silenciosa**, que
 * é a única forma aceitável de um seletor envelhecer neste projeto.
 *
 * **O que fica de fora, e é HIPÓTESE DECLARADA:** popup do Radix que se pendure no `body` em vez
 * do `#root` escaparia do encolhimento e abriria sob o painel. Nenhum dos três `fixed` medidos
 * faz isso e nada foi para o body ao tentar abrir um menu, mas **não consegui abrir um por
 * script** (o Radix escuta `pointerdown`), então isso não foi observado de verdade. Aparecendo,
 * o sintoma é visível e o conserto é um seletor a mais aqui.
 */

const STYLE_ID = 'whatsfill-dock-style';
const CLASS = 'whatsfill-docked';
export const MIN_WIDTH = 300;
export const MAX_WIDTH = 700;
export const DEFAULT_WIDTH = 380;

/**
 * As plataformas cujo app está PRESO NA VIEWPORT (`position: fixed`), onde o padding no `html`
 * não alcança nada. O valor é o seletor do elemento que vira o bloco contenedor.
 *
 * A tabela é de PERMISSÃO: plataforma que não está aqui recebe só o padding, que é o que sempre
 * funcionou. A inversa faria toda plataforma nova nascer com uma regra que ninguém mediu.
 */
const PRESOS_NA_VIEWPORT = {
  'mobiliza.me': '#root',
};

/**
 * A regra extra de encaixe, PURA — recebe o hostname em vez de ler `location`, e por isso dá
 * para testá-la fora do navegador. Devolve string vazia onde o padding basta.
 */
export function regraDeEncaixe(hostname, width = DEFAULT_WIDTH) {
  const alvo = PRESOS_NA_VIEWPORT[String(hostname || '').replace(/^www\./, '')];
  if (!alvo) return '';
  return `
    html.${CLASS} ${alvo} {
      position: fixed !important;
      inset: 0 !important;
      right: ${clamp(width)}px !important;
      contain: layout !important;
    }
  `;
}

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
    ${regraDeEncaixe(location.hostname, largura)}
  `;
  document.documentElement.classList.add(CLASS);
  return largura;
}

export function removeDock() {
  document.documentElement.classList.remove(CLASS);
}

export function clamp(width) {
  const n = Math.round(Number(width) || DEFAULT_WIDTH);
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n));
}
