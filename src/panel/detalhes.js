/**
 * detalhes.js — o excesso de texto do painel fica atrás de um botão "detalhes".
 *
 * Pedido dele (10/09/2026): *"o frontend continua poluído, crie botões para mais detalhes e bote todo
 * o excesso de texto lá"*. A versão de 08/09 cortava as explicações em TRÊS linhas com um "ver mais"
 * — e a aba continuava um muro: cada campo seguia com três linhas cinza embaixo, e o corte com
 * degradê ainda chamava o olho para o texto.
 *
 * **A regra agora:** explicação (`.wf-origin`, `.wf-hint`) que passa de UMA linha some atrás de um
 * botão. As de uma linha ficam — são rótulo, e esconder uma linha atrás de um botão do mesmo tamanho
 * não limpa nada. **Vizinhas vão juntas**: três parágrafos seguidos sob o mesmo campo viram UM botão,
 * não três.
 *
 * **O que é DADO ou AVISO fica sempre à vista** — quem cria marca com `data-fica` (a origem de um
 * campo do contato, a lista de exemplos da aba Cidades, o aviso de modelo e de reserva da IA).
 * Esconder isso seria esconder o que ele precisa ver para decidir.
 *
 * **Um passe DEPOIS de desenhar**, e não uma decisão em cada um dos 60 lugares que criam explicação:
 * só o navegador sabe quantas linhas o texto ocupou na largura de agora, e assim a regra vale também
 * para a próxima explicação que alguém escrever.
 *
 * **O aberto continua aberto** — `renderAll()` roda o tempo todo (cada `setStatus`, cada mensagem
 * nova), e sem memória o bloco que ele acabou de abrir fecharia no redesenho seguinte. A memória é
 * por TEXTO, e fica em memória: não vale guardar isto no armazenamento.
 */

const SELETOR = '.wf-origin, .wf-hint';

/** Altura de uma linha do elemento, em px — `line-height: normal` não vira número. */
function alturaDaLinha(el) {
  const estilo = getComputedStyle(el);
  const lh = parseFloat(estilo.lineHeight);
  if (Number.isFinite(lh)) return lh;
  return (parseFloat(estilo.fontSize) || 11) * 1.35;
}

/** Passa de uma linha? Invisível (painel escondido, cartão fechado) mede zero e não conta. */
function ehLonga(el) {
  const altura = el.scrollHeight;
  return altura > 0 && altura > alturaDaLinha(el) * 1.6;
}

/**
 * @param {HTMLElement} raiz onde procurar (o corpo do painel)
 * @param {Set<string>} abertos memória dos blocos que ele abriu, compartilhada entre redesenhos
 * @returns {number} quantos botões foram criados
 */
export function recolherExplicacoes(raiz, abertos = new Set()) {
  if (!raiz) return 0;
  const candidatos = [...raiz.querySelectorAll(SELETOR)].filter(
    (el) => !el.dataset.fica && !el.dataset.recolhido && !el.closest('.wf-detalhes')
  );
  const longas = new Set(candidatos.filter(ehLonga));

  let criados = 0;
  for (const primeira of candidatos) {
    if (!longas.has(primeira) || primeira.dataset.recolhido) continue;

    // As vizinhas longas seguidas vão para o mesmo botão.
    const grupo = [primeira];
    let proxima = primeira.nextElementSibling;
    while (proxima && longas.has(proxima)) {
      grupo.push(proxima);
      proxima = proxima.nextElementSibling;
    }
    for (const el of grupo) el.dataset.recolhido = '1';

    const chave = grupo.map((el) => el.textContent.trim().slice(0, 60)).join('|');
    const aberto = abertos.has(chave);

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'wf-detalhes-botao';
    const rotulo = () => (caixa.hidden ? 'ⓘ detalhes' : 'ⓘ ocultar detalhes');

    const caixa = document.createElement('div');
    caixa.className = 'wf-detalhes';
    caixa.hidden = !aberto;

    primeira.before(botao);
    botao.after(caixa);
    caixa.append(...grupo);

    botao.textContent = rotulo();
    botao.setAttribute('aria-expanded', String(aberto));
    botao.addEventListener('click', () => {
      caixa.hidden = !caixa.hidden;
      if (caixa.hidden) abertos.delete(chave);
      else abertos.add(chave);
      botao.textContent = rotulo();
      botao.setAttribute('aria-expanded', String(!caixa.hidden));
    });
    criados += 1;
  }
  return criados;
}
