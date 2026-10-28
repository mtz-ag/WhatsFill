/**
 * mob-hook.js — o gancho no mundo MAIN da aba do mobiliza.me.
 *
 * E o irmao do `page-hook.js` (que vive no mundo MAIN do mobiliza.app) e existe por UMA razao
 * tecnica, medida e sem contorno:
 *
 *   **`__reactFiber$<hash>` e um EXPANDO, e expando nao atravessa mundo isolado no Chrome.**
 *   Um content script comum ve o mesmo `<button>` da fila e **nao ve a chave** — cada mundo tem o
 *   seu wrapper do no do DOM, e a propriedade que o React pendurou mora no wrapper da PAGINA.
 *
 * E e do fiber que sai a unica identidade confiavel da linha da fila (ver `dom-mob.js`): a linha e
 * um `<button>` com so `class`, e casar por nome seria ele conferir a mensagem de uma pessoa e
 * apertar a tecla que responde a outra.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELE REPETE 15 LINHAS DO `dom-mob.js` — e por que a repeticao nao pode divergir
 * ---------------------------------------------------------------------------
 *
 * Script de mundo MAIN registrado no manifesto e **classico**: nao aceita `import`, e no mundo da
 * pagina nao existe `chrome.runtime` para descobrir a URL do modulo. As saidas seriam todas
 * hipotese — injetar `<script type="module">` esbarra na CSP da pagina, e `import()` de URL da
 * extensao a partir do mundo MAIN nao foi medido. **Hipotese aqui e painel que nao abre.**
 *
 * Entao a logica vive duas vezes, e a repeticao e travada por teste em vez de por promessa:
 * `tests/mob-hook.test.mjs` **carrega este arquivo como TEXTO**, roda num `window` falso e exige
 * que ele responda **exatamente o mesmo** que `dom-mob.js` nas mesmas fixtures. Divergiu, cai.
 *
 * ---------------------------------------------------------------------------
 * O QUE ELE FAZ, E O QUE ELE NAO FAZ
 * ---------------------------------------------------------------------------
 *
 * **Faz uma coisa so: achar a linha e clicar.** Nao marca lida, nao assume, nao digita, nao le
 * conversa (isso e consulta, e sai pelo `mob.js`), nao toca em nada do que a plataforma guarda.
 *
 * **E nao tem token nenhum.** O `page-hook.js` existia para capturar o Bearer; aqui a sessao esta
 * no `localStorage`, que o content script le sozinho. Este gancho **nunca ve credencial**, e por
 * isso nao ha o que vazar por ele.
 */
(() => {
  const ORIGEM = window.location.origin;

  /** Quantos niveis subir no fiber procurando a conversa. **Tem de ser igual ao do `dom-mob.js`.** */
  const NIVEIS = 8;

  /**
   * A linha do banco que o React guardou neste no, ou `null`.
   *
   * **Copia exata de `dom-mob.conversaDoNo`** — ver o cabecalho. Mexeu aqui, mexa la, e o teste
   * confere os dois contra as mesmas fixtures.
   */
  function conversaDoNo(no) {
    if (!no || typeof no !== 'object') return null;
    const chave = Object.keys(no).find((k) => k.startsWith('__reactFiber$'));
    if (!chave) return null;
    let fiber = no[chave];
    for (let i = 0; i < NIVEIS && fiber; i++) {
      const props = fiber.memoizedProps;
      const c = props && props.conversa;
      if (c && typeof c === 'object' && typeof c.id === 'string' && c.id) return c;
      fiber = fiber.return;
    }
    return null;
  }

  /** O texto da linha, normalizado. Copia de `dom-mob.textoDaLinha`. */
  function textoDaLinha(no) {
    return String((no && no.textContent) || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /** A reserva. Copia de `dom-mob.linhaParece`. */
  function linhaParece(no, nome) {
    const n = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
    if (n.length < 2) return false;
    return textoDaLinha(no).includes(n);
  }

  /** Copia de `dom-mob.acharLinha`. */
  function acharLinha(id, nome) {
    if (!id) return null;
    const linhas = [...document.querySelectorAll('button, [role="button"]')];

    for (const no of linhas) {
      const c = conversaDoNo(no);
      if (c && c.id === id) return { no, por: 'id' };
    }
    if (!nome) return null;
    const porNome = linhas.filter((no) => linhaParece(no, nome));
    // Empate nao vira escolha: nome repetido e comum nesta base.
    if (porNome.length !== 1) return null;
    return { no: porNome[0], por: 'nome' };
  }

  /** Copia de `dom-mob.abrirConversa`. **Clica e para ai.** */
  function abrirConversa(id, nome) {
    const achada = acharLinha(id, nome);
    if (!achada) return { ok: false, motivo: 'nao-esta-na-tela' };
    try {
      achada.no.scrollIntoView({ block: 'center' });
    } catch (e) {
      /* lista sem rolagem propria */
    }
    achada.no.click();
    return { ok: true, por: achada.por };
  }

  /**
   * Clica a aba da lista (`Todas 728`, `Minhas 1`). Copia de `dom-mob.clicarAbaDaFila`.
   * O texto tem de ser o rotulo e so o numero — linha de conversa nao casa, empate nao clica.
   */
  function clicarAbaDaFila(rotulo) {
    const alvo = textoDaLinha({ textContent: rotulo });
    if (!alvo) return { ok: false, motivo: 'sem-rotulo' };
    const forma = new RegExp('^' + alvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\d+$');
    const achados = [...document.querySelectorAll('button, [role="tab"], [role="button"]')].filter((no) => forma.test(textoDaLinha(no)));
    if (achados.length !== 1) return { ok: false, motivo: achados.length ? 'aba-ambigua' : 'aba-ausente' };
    achados[0].click();
    return { ok: true };
  }

  /** Copia de `dom-mob.clicarAssumir`. O texto tem de ser exatamente "Assumir". */
  function clicarAssumir() {
    const achados = [...document.querySelectorAll('button, [role="button"]')].filter((no) => textoDaLinha(no) === 'assumir');
    const visivel = achados.find((no) => {
      const r = no.getBoundingClientRect ? no.getBoundingClientRect() : null;
      return !r || (r.width > 0 && r.height > 0);
    });
    if (!visivel) return { ok: false, motivo: 'sem-botao' };
    visivel.click();
    return { ok: true };
  }

  /** Sobe a lista para o topo, para a conversa mais nova — a primeira da consulta — estar desenhada. */
  function rolarFilaParaOTopo() {
    let estilo = null;
    try { estilo = window.getComputedStyle ? window.getComputedStyle.bind(window) : null; } catch (_) { estilo = null; }
    if (!estilo) return { ok: false, motivo: 'sem-rolagem' };
    for (const no of document.querySelectorAll('button, [role="button"]')) {
      if (!conversaDoNo(no)) continue;
      let el = no.parentElement;
      while (el && el !== document.documentElement) {
        let st = null;
        try { st = estilo(el); } catch (_) { st = null; }
        const overflow = st && (st.overflowY || st.overflow);
        if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight + 8) {
          el.scrollTop = 0;
          return { ok: true };
        }
        el = el.parentElement;
      }
      return { ok: false, motivo: 'sem-rolagem' };
    }
    return { ok: false, motivo: 'sem-linha' };
  }

  /**
   * **Quantas linhas da fila este gancho esta enxergando.**
   *
   * Serve para o painel dizer a verdade quando a conversa nao esta na tela: *"a fila tem 270 e a
   * plataforma renderizou 78"* e informacao; *"nao achei"* sozinho parece defeito. Medido na pagina
   * dele: 104 clicaveis, 78 reconhecidos como linha.
   */
  function quantasLinhas() {
    let n = 0;
    for (const no of document.querySelectorAll('button, [role="button"]')) if (conversaDoNo(no)) n++;
    return n;
  }

  /** Leitura de tela que nunca derruba a resposta: falhou, devolve o padrao. */
  function leitura(fn, padrao) {
    try { return fn(); } catch (_) { return padrao; }
  }

  /**
   * **Da para digitar agora?** — lido da TELA, em TRES estados. Copia de
   * `dom-mob.temCampoDeMensagem`; ver o cabecalho de la e o teste que trava a repeticao.
   *
   * **A primeira versao AFIRMAVA campo de mensagem em toda conversa aberta**, porque pegava o
   * primeiro `textarea` visivel e a tela tem DOIS de anotacao (medido: *"Nota interna da
   * conversa"* e *"Anotacoes sobre este contato"*). Como esta leitura VENCE o `status` em
   * `page-mob.estadoDaConversa`, o palpite errado substituia a resposta certa.
   *
   * Vale a mesma regra do resto do gancho: degrada, nunca estoura.
   */
  function rotuloDoCampo(el) {
    const bruto = (el && (el.placeholder
      || (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('data-placeholder'))))) || '';
    return String(bruto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function camposEditaveis(raiz) {
    const sel = 'textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';
    return [...(raiz || document).querySelectorAll(sel)];
  }

  function ehCampoDeMensagem(el) {
    if (!el) return false;
    if (el.disabled || el.readOnly) return false;
    const r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (r && (r.width <= 0 || r.height <= 0)) return false;
    if (el.isContentEditable) return true;
    const t = rotuloDoCampo(el);
    return /mensagem/.test(t) && !/\bnotas?\b|anotac/.test(t);
  }

  function campoDeMensagem(raiz) {
    for (const el of camposEditaveis(raiz)) if (ehCampoDeMensagem(el)) return el;
    return null;
  }

  function temCampoDeMensagem() {
    try {
      const todos = camposEditaveis(document);
      for (const el of todos) if (ehCampoDeMensagem(el)) return true;
      return todos.length === 0 ? false : null;
    } catch (_) {
      return null;
    }
  }

  /** A cadeia de props deste no. Copia de `dom-mob.propsDoFiber`. */
  function propsDoFiber(no, niveis) {
    if (!no || typeof no !== 'object') return [];
    const chave = Object.keys(no).find((k) => k.startsWith('__reactFiber$'));
    if (!chave) return [];
    const saida = [];
    let f = no[chave];
    for (let i = 0; i < niveis && f; i++) {
      if (f.memoizedProps) saida.push(f.memoizedProps);
      f = f.return;
    }
    return saida;
  }

  /**
   * **A conversa aberta na tela, por DOIS sinais que tem de concordar.**
   *
   * Copia de `dom-mob.conversaAberta` — ver o cabecalho sobre a repeticao e o teste que a trava.
   * Discordando, devolve nada: afirmar a conversa errada e o painel classificar uma pessoa e
   * responder outra.
   */
  function conversaAberta() {
    let daLista = null;
    let quantasAtivas = 0;
    for (const no of document.querySelectorAll('button, [role="button"]')) {
      for (const p of propsDoFiber(no, NIVEIS)) {
        if (p && p.conversa && typeof p.conversa.id === 'string') {
          if (p.ativa === true) { daLista = p.conversa; quantasAtivas++; }
          break;
        }
      }
    }
    if (quantasAtivas > 1) daLista = null;

    let doPainel = null;
    for (const no of document.querySelectorAll('div')) {
      for (const p of propsDoFiber(no, 3)) {
        if (p && p.conversa && typeof p.conversa.id === 'string' && typeof p.onStatusChange === 'function' && typeof p.onClose === 'function') {
          doPainel = p.conversa;
          break;
        }
      }
      if (doPainel) break;
    }

    if (daLista && doPainel) {
      if (daLista.id !== doPainel.id) return null;
      return { conversa: daLista, por: 'os-dois' };
    }
    if (doPainel) return { conversa: doPainel, por: 'so-um-sinal' };
    if (daLista) return { conversa: daLista, por: 'so-um-sinal' };
    return null;
  }

  function responder(tipo, carga) {
    window.postMessage({ __whatsfill: 'mob-page', type: tipo, payload: carga }, ORIGEM);
  }

  window.addEventListener('message', (ev) => {
    // `ev.source !== window` barra mensagem vinda de iframe; a origem barra o resto.
    if (ev.source !== window || ev.origin !== ORIGEM) return;
    const msg = ev.data;
    if (!msg || msg.__whatsfill !== 'mob-cs') return;

    /**
     * **O `try` cobre a RESPOSTA INTEIRA, e nao so a acao** — e isto foi um defeito de verdade,
     * pego pelo teste antes de ir ao ar. Na primeira versao `quantasLinhas()` ficava fora dele,
     * dentro da propria chamada de `responder`: bastava a contagem estourar (um no cuja leitura
     * lanca, que e o que acontece quando o React muda as entranhas) para o ouvinte morrer **sem
     * responder**, e o painel esperaria para sempre por uma abertura que nunca volta.
     *
     * Gancho que estoura tem de RESPONDER que estourou. "Nao abriu" ele mostra na tela; silencio,
     * nao.
     */
    try {
      if (msg.type === 'abrir') {
        const { id, nome } = msg.payload || {};
        const r = abrirConversa(id, nome);
        responder('abriu', { pedido: msg.payload?.pedido || '', ...r, linhas: quantasLinhas() });
      } else if (msg.type === 'aberta') {
        /**
         * **Quem esta aberto na tela DELE.** E o que o painel usa no lugar do `dom.js` da
         * plataforma velha: la a conversa aberta se lia do cabecalho do atendimento; aqui o unico
         * lugar onde a resposta existe e o estado do React.
         *
         * Vai so o que o painel precisa, e **a linha inteira do banco NAO vai**: ela carrega dado
         * de eleitor que nao faz falta do outro lado da ponte.
         *
         * **O ESTADO vai junto de proposito, e isso nao e comodidade.** `pageStateLocal` roda a
         * cada 500ms; se o painel tivesse de consultar o banco para saber se a conversa esta
         * aberta, em atendimento ou resolvida, seria uma requisicao por tique — rajada contra o
         * PostgREST o dia inteiro, que e exatamente o que ja derrubou a plataforma velha. Estes
         * campos o React ja tem na mao, entao custam zero.
         */
        const r = conversaAberta();
        responder('aberta', {
          pedido: msg.payload?.pedido || '',
          por: r ? r.por : '',
          conversa: r
            ? {
                id: r.conversa.id,
                nome: r.conversa.nome,
                numero: r.conversa.numero,
                external_chat_id: r.conversa.external_chat_id,
                contato_id: r.conversa.contato_id,
                // O CANAL da conversa. Sem ele o painel nao tem como descobrir POR QUAL NUMERO
                // esta conversa e atendida — e a barreira do candidato compararia outra coisa.
                instance_id: r.conversa.instance_id,
                status: r.conversa.status,
                atendente_id: r.conversa.atendente_id,
                total_mensagens: r.conversa.total_mensagens,
                ultima_mensagem_em: r.conversa.ultima_mensagem_em,
              }
            : null,
          // Leituras de TELA, que so existem aqui dentro e tambem custam zero. Cada uma degrada
          // por conta propria: uma leitura que estoura nao pode levar junto a resposta inteira,
          // que e o caso em que o painel ficaria esperando para sempre.
          dark: leitura(() => !!document.documentElement.classList.contains('dark'), false),
          hasDialog: leitura(() => !!document.querySelector('[role="dialog"]'), false),
          hasComposer: temCampoDeMensagem(),
        });
      } else if (msg.type === 'ping') {
        responder('pong', { linhas: quantasLinhas() });
      } else if (msg.type === 'aba') {
        const r = clicarAbaDaFila((msg.payload && msg.payload.rotulo) || '');
        responder('aba', { pedido: msg.payload?.pedido || '', ...r });
      } else if (msg.type === 'assumir') {
        const r = clicarAssumir();
        responder('assumir', { pedido: msg.payload?.pedido || '', ...r });
      } else if (msg.type === 'topo') {
        const r = rolarFilaParaOTopo();
        responder('topo', { pedido: msg.payload?.pedido || '', ...r });
      }
    } catch (err) {
      const detalhe = String((err && err.message) || err);
      if (msg.type === 'abrir') {
        responder('abriu', { pedido: msg.payload?.pedido || '', ok: false, motivo: 'erro', detalhe, linhas: 0 });
      } else if (msg.type === 'aberta') {
        // **Nao saber nao e "nenhuma aberta"**: o painel precisa distinguir os dois, porque
        // "nenhuma" o faz pedir que ele abra uma, e "nao sei" o faz calar.
        responder('aberta', { pedido: msg.payload?.pedido || '', por: '', conversa: null, erro: detalhe });
      } else if (msg.type === 'ping') {
        responder('pong', { linhas: 0, erro: detalhe });
      } else if (msg.type === 'aba' || msg.type === 'topo' || msg.type === 'assumir') {
        responder(msg.type, { pedido: msg.payload?.pedido || '', ok: false, motivo: 'erro', detalhe });
      }
    }
  });

  // Avisa que subiu: o painel pode ter montado antes do gancho e ficaria esperando um pong.
  responder('pronto', {});
})();
