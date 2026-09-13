/**
 * rolagem.js — o painel não perde o lugar onde ele estava quando um botão redesenha a aba.
 *
 * Relato dele (13/09/2026): *"vários botões da extensão ao serem clicados rolam página da extensão e
 * eu tenho que procurar toda vez onde eu estava"*.
 *
 * **Medido num navegador, e a causa não é a que parece.** `renderAll()` esvazia o `.wf-body` e o
 * desenha de novo, e isso sozinho NÃO perde a rolagem: feito na mesma tarefa, o navegador nunca vê o
 * corpo vazio (1500 → 1500). O que perde é o conteúdo que chega DEPOIS do desenho — as abas
 * Automatizado e Config têm pedaços que esperam o armazenamento, a lista de etiquetas ou as
 * observações. Nesse intervalo o corpo fica curto, o navegador puxa a rolagem para o que cabe, e
 * quando o resto chega ela fica onde foi puxada (1500 → 240). Todo botão passa por `withBusy`, que
 * redesenha no `finally`, então o sintoma aparece em "vários botões".
 *
 * **O conserto guarda a posição antes de desenhar e a devolve enquanto o conteúdo cresce**, por uma
 * janela curta. Três regras:
 *
 *  1. **Mudança sem ninguém tocar é o navegador mexendo.** Para cima é o corpo curto; **para baixo é a
 *     ANCORAGEM do Chrome** (13/09/2026, *"ao adicionar anúncio novo ele rola toda vez pro fim"*): a lista
 *     de anúncios some e volta ACIMA do que está na tela, e o navegador empurra a rolagem junto com o que
 *     ficou visível (medido: 1764 → 2765). A v3.58 só devolvia a queda e deixava passar este. Hoje o corpo
 *     tem `overflow-anchor: none` e a guarda devolve nos dois sentidos — uma cobre a falha da outra.
 *     Nada no corpo do painel rola sozinho (não há `scrollIntoView`, e os dois `focus()` do painel
 *     ficam nas caixas flutuantes, fora do corpo) — então, dentro da janela, rolagem diferente da
 *     guardada só pode ser o navegador.
 *  2. **Dois desenhos seguidos não trocam o alvo pelo valor que o navegador mexeu** — `withBusy` e `setStatus`
 *     redesenham várias vezes por clique, e o segundo leria a posição já puxada para cima.
 *  3. **Quem manda é ele:** roda do mouse, toque, tecla de rolar ou a barra de rolagem soltam o alvo
 *     na hora. E **trocar de aba começa do topo** — devolver a posição de uma aba em outra seria
 *     mandar para um lugar que não existe.
 */

/** Por quanto tempo depois do desenho o conteúdo atrasado ainda pode chegar. */
export const JANELA_MS = 4000;

/** Teclas que rolam o corpo: com qualquer uma delas, a posição passa a ser dele. */
export const TECLAS_QUE_ROLAM = new Set(['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' ']);

/**
 * @param {{scrollTop:number}} el  o elemento que rola (o `.wf-body`)
 * @param {{agora?: () => number, janelaMs?: number}} [opcoes]
 */
export function criarGuardaDeRolagem(el, { agora = () => Date.now(), janelaMs = JANELA_MS } = {}) {
  /** A posição a devolver, e até quando ela vale. `null` = nada a devolver. */
  let alvo = null;
  let chaveAtual = null;

  // Nos DOIS sentidos: para cima e o corpo curto, para baixo e a ancoragem do navegador.
  const deslocada = () => !!alvo && Math.abs(el.scrollTop - alvo.top) > 1;

  return {
    /** Chame ANTES de esvaziar o corpo, com a aba que vai ser desenhada. */
    antesDeDesenhar(chave) {
      const t = agora();
      if (chave !== chaveAtual) {
        const primeira = chaveAtual === null;
        chaveAtual = chave;
        alvo = null;
        if (!primeira) el.scrollTop = 0;
        return;
      }
      // Um desenho anterior ainda espera o conteúdo: a posição de agora é a que o navegador mexeu, não a dele.
      if (alvo && t <= alvo.ate && deslocada()) {
        alvo.ate = t + janelaMs;
        return;
      }
      alvo = { top: el.scrollTop, ate: t + janelaMs };
    },

    /** Chame depois do desenho e a cada vez que o conteúdo mudar. Devolve se mexeu. */
    devolver() {
      if (!alvo) return false;
      if (agora() > alvo.ate) {
        alvo = null;
        return false;
      }
      if (!deslocada()) return false;
      el.scrollTop = alvo.top;
      return true;
    },

    /** Ele rolou: a posição é a dele, e nada mais é devolvido. */
    soltar() {
      alvo = null;
    },
  };
}
