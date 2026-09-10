/**
 * detalhes.js — o excesso de texto do painel fica atrás de um botão "detalhes".
 *
 * Pedido dele (10/09/2026): *"o frontend continua poluído, crie botões para mais detalhes e bote todo
 * o excesso de texto lá"*. A versão de 08/09 cortava as explicações em TRÊS linhas com um "ver mais"
 * — e a aba continuava um muro.
 *
 * **Duas regras, e só duas:**
 *
 *  1. **Explicação** (`.wf-origin`, `.wf-hint`) que passa de UMA linha some atrás de um botão. As de
 *     uma linha ficam — são rótulo. **Vizinhas vão juntas**: três parágrafos seguidos viram UM botão.
 *  2. **Resumo** (só nas abas Automatizado e Config) — pedido dele no mesmo dia, depois de ver a
 *     primeira versão: *"continua com muito texto no frontend, pode resumir mais e botar o resto pros
 *     detalhes"*. Medido montando o painel de verdade: sobravam 4.428 caracteres à vista no
 *     Automatizado e 4.863 na Config, e o grosso NÃO era explicação — eram os RÓTULOS (*"Automatizar a
 *     rodada: envia sozinha o que as REGRAS decidem — e, com a IA ligada, o que ela escrever"*), as
 *     descrições dos cartões (`.wf-preview`, até 336 caracteres) e os avisos (`.wf-block`, até 426).
 *     Cada um fica com a CABEÇA — o nome do controle, a primeira frase do aviso — e o resto vai para
 *     os detalhes.
 *
 * **O que é DADO ou AVISO de estado fica sempre inteiro à vista** — quem cria marca com `data-fica`.
 *
 * **Um passe DEPOIS de desenhar**: só o navegador sabe quantas linhas o texto ocupou. E o painel liga
 * o passe também a cada mudança no corpo (MutationObserver), porque parte do conteúdo chega depois do
 * desenho, e esse pedaço escapava até o próximo redesenho.
 *
 * **O aberto continua aberto** — `renderAll()` roda o tempo todo, e sem memória o bloco fecharia no
 * redesenho seguinte. A memória é por texto e só em memória.
 */

const SELETOR_EXPLICACAO = '.wf-origin, .wf-hint';

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

/** Maiúscula só em FRASE: "src/data/gabinete.md" não vira "Src/…" (visto medindo os rótulos reais). */
const maiuscula = (s) => (s && /\s/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Fecha com ponto o pedaço que vai ser emendado em outro — senão as frases colam. */
const comPonto = (s) => (/[.!?…)]$/.test(s) ? s : `${s}.`);

/**
 * Parte um texto em CABEÇA e RESTO, no primeiro corte natural.
 *
 * Os cortes, em ordem de posição: fim de frase, travessão, e — só em rótulo — dois-pontos e o
 * parêntese que FECHA o texto. Parêntese no meio (*"Perguntar (em vez de concluir) após quantas
 * horas"*) não corta: o que sobraria seria só "Perguntar". A cabeça precisa de um mínimo de
 * caracteres, senão o corte leva o sentido junto.
 *
 * Exportada para teste.
 *
 * @returns {{cabeca:string, resto:string}|null}
 */
export function partir(texto, { rotulo = false } = {}) {
  let cabeca = String(texto || '').replace(/\s+/g, ' ').trim();
  const restos = [];

  // Duas passadas: "Gravar sozinho... (COREDE e etiquetas). A cidade pergunta antes." corta a frase e
  // depois o parêntese que ficou no fim da cabeça.
  for (let passada = 0; passada < 2; passada++) {
    const cortes = [];
    const frase = /[.!?](\s+)(?=[A-ZÀ-Ú"“(])/g;
    let m;
    while ((m = frase.exec(cabeca))) {
      if (m.index >= 20) {
        cortes.push({ em: m.index + 1, pula: m[1].length });
        break;
      }
    }
    const travessao = cabeca.indexOf(' — ');
    if (travessao >= 12) cortes.push({ em: travessao, pula: 3 });
    // Dois-pontos: em rótulo cedo ("Automatizar a rodada: …"); em aviso só com cabeça que se sustenta
    // ("Ligue o 'Enviar automático' na aba Config: sem ele…") — "Guardadas: …" não corta.
    const dois = cabeca.indexOf(': ');
    if (dois >= (rotulo ? 12 : 20)) cortes.push({ em: dois, pula: 2 });
    if (rotulo) {
      const par = /\s\(([^()]{3,})\)\.?\s*$/.exec(cabeca);
      if (par && par.index >= 12) cortes.push({ em: par.index, parentese: par[1] });
    }
    if (!cortes.length) break;
    const corte = cortes.sort((a, b) => a.em - b.em)[0];
    const resto = corte.parentese != null ? corte.parentese : cabeca.slice(corte.em + corte.pula);
    if (resto.trim().length < 6) break;
    restos.unshift(maiuscula(resto.trim()));
    cabeca = cabeca.slice(0, corte.em).trim();
  }

  if (!restos.length) return null;
  const resto = restos.length === 1 ? restos[0] : restos.map(comPonto).join(' ');
  return { cabeca, resto };
}

/** Cria o parágrafo de detalhe com o resto de um texto resumido — ele sempre vai para o botão. */
function detalheDe(resto) {
  const el = document.createElement('div');
  el.className = 'wf-origin';
  el.dataset.detalhe = '1';
  el.textContent = resto;
  return el;
}

/** Só texto dentro? Elemento com filhos (negrito, botão, link) não se reescreve. */
const soTexto = (el) => el.childElementCount === 0 && el.textContent.trim();

/**
 * **Dentro de uma área marcada, NADA é tocado** — nem resumido, nem recolhido. Print dele (10/09/2026):
 * *"aplicou detalhes até no log do automatizado, tenha discernimento"*. As linhas do Andamento são
 * `.wf-preview` com `"⚠ nome — motivo"`, e o resumo cortava cada uma no travessão. A marca olhava só o
 * PRÓPRIO elemento; um log é um bloco, e quem marca o bloco protege tudo o que está dentro.
 */
const protegido = (el) => !!el.closest('[data-fica]');

/**
 * **O resumo** — ver a regra 2 no topo. Devolve os elementos que devem ir INTEIROS para os detalhes
 * (descrição cuja cabeça ainda seria longa demais).
 */
function resumir(raiz) {
  const inteiros = [];

  // Rótulos: o span de texto dentro de um <label>. O resto vai para DEPOIS do label — dentro dele,
  // clicar no botão de detalhes marcaria a caixa.
  for (const span of raiz.querySelectorAll('label > span')) {
    if (span.dataset.resumido || !soTexto(span) || span.closest('[data-fica]')) continue;
    span.dataset.resumido = '1';
    if (span.textContent.trim().length < 40) continue;
    const p = partir(span.textContent, { rotulo: true });
    if (!p) continue;
    span.textContent = p.cabeca;
    span.closest('label').after(detalheDe(p.resto));
  }

  /**
   * **O que é marcado para ficar à vista também se resume — a CABEÇA fica, só o resto vai.** Medido:
   * a estimativa de custo da IA, marcada `data-fica`, seguia inteira com 459 caracteres. O estado
   * ("o reserva é o MESMO modelo do titular") continua na tela; a explicação dele não precisa.
   */
  for (const el of raiz.querySelectorAll('.wf-origin[data-fica]')) {
    // Linha de um BLOCO protegido (um log) não se resume: só o aviso marcado sozinho.
    if (el.dataset.resumido || !soTexto(el) || (el.parentElement && protegido(el.parentElement))) continue;
    el.dataset.resumido = '1';
    if (!ehLonga(el)) continue;
    const p = partir(el.textContent);
    if (!p || p.cabeca.length > 140) continue;
    el.textContent = p.cabeca;
    el.after(detalheDe(p.resto));
  }

  // Descrições de cartão e avisos: a primeira frase fica, o resto vai.
  for (const el of raiz.querySelectorAll('.wf-preview, .wf-block')) {
    if (el.dataset.resumido || protegido(el) || !soTexto(el)) continue;
    el.dataset.resumido = '1';
    if (!ehLonga(el)) continue;
    const p = partir(el.textContent);
    const ehAviso = el.classList.contains('wf-block');
    if (p && p.cabeca.length <= 120) {
      el.textContent = p.cabeca;
      el.after(detalheDe(p.resto));
    } else if (!ehAviso) {
      // Descrição sem corte bom: inteira para os detalhes. AVISO sem corte fica — é estado.
      inteiros.push(el);
    }
  }
  return inteiros;
}

/**
 * @param {HTMLElement} raiz onde procurar (o corpo do painel)
 * @param {Set<string>} abertos memória dos blocos que ele abriu, compartilhada entre redesenhos
 * @param {{resumir?: boolean}} [opcoes] `resumir` liga a regra 2 (abas Automatizado e Config)
 * @returns {number} quantos botões foram criados
 */
export function recolherExplicacoes(raiz, abertos = new Set(), opcoes = {}) {
  if (!raiz) return 0;
  const inteiros = new Set(opcoes.resumir ? resumir(raiz) : []);

  const candidatos = [...raiz.querySelectorAll(`${SELETOR_EXPLICACAO}, .wf-preview`)].filter(
    (el) => !protegido(el) && !el.dataset.recolhido && !el.closest('.wf-detalhes')
  );
  const vaiParaDetalhes = new Set(
    candidatos.filter((el) =>
      el.classList.contains('wf-preview') ? inteiros.has(el) : el.dataset.detalhe || ehLonga(el)
    )
  );

  let criados = 0;
  for (const primeira of candidatos) {
    if (!vaiParaDetalhes.has(primeira) || primeira.dataset.recolhido) continue;

    // As vizinhas que também vão seguidas entram no mesmo botão.
    const grupo = [primeira];
    let proxima = primeira.nextElementSibling;
    while (proxima && vaiParaDetalhes.has(proxima)) {
      grupo.push(proxima);
      proxima = proxima.nextElementSibling;
    }
    for (const el of grupo) el.dataset.recolhido = '1';

    const chave = grupo.map((el) => el.textContent.trim().slice(0, 60)).join('|');
    const aberto = abertos.has(chave);

    const caixa = document.createElement('div');
    caixa.className = 'wf-detalhes';
    caixa.hidden = !aberto;

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'wf-detalhes-botao';
    const atualizar = () => {
      botao.textContent = caixa.hidden ? 'ⓘ detalhes' : 'ⓘ ocultar detalhes';
      botao.setAttribute('aria-expanded', String(!caixa.hidden));
    };

    primeira.before(botao);
    botao.after(caixa);
    caixa.append(...grupo);
    atualizar();

    botao.addEventListener('click', () => {
      caixa.hidden = !caixa.hidden;
      if (caixa.hidden) abertos.delete(chave);
      else abertos.add(chave);
      atualizar();
    });
    criados += 1;
  }
  return criados;
}
