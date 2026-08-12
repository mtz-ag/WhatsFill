/**
 * checar-dom.mjs — confere os SINAIS DE TELA do `dom.js` contra recortes reais da plataforma.
 *
 * Por que existe: três vezes seguidas a rodada quebrou porque um sinal de tela mudou ou não
 * cobria um estado — o menu do Concluir que não conclui, o diálogo modal que engole o clique, e
 * o atendimento que fica "Concluído" **sem nenhum botão Reiniciar**. Nenhuma dessas falhas
 * aparece em teste de lógica: elas moram no HTML.
 *
 * Não entra nas seis suítes de propósito. Precisa de um navegador (Playwright), e o
 * compromisso do projeto é `node tests/*.mjs` rodar em Node puro, sem dependência. Este aqui é
 * ferramenta: rode quando mexer no `dom.js` ou quando a plataforma mudar de cara.
 *
 *   npx playwright@1 ...   (ou, se já houver Playwright na máquina)
 *   node tools/checar-dom.mjs
 *
 * Cada recorte abaixo foi transcrito de uma tela real. Quando a plataforma mudar, o conserto é
 * atualizar o recorte aqui junto com o `dom.js` — o par é que documenta o que era verdade.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const DOM_JS = new URL('../src/lib/dom.js', import.meta.url);

/** Estado da tela → o que `isConcluded()` e `semControlesDeAtendimento()` devem responder. */
const CASOS = [
  {
    nome: 'em andamento: tem composer e o Concluir do rodapé',
    html: `
      <sessions-conversation>
        <div><span>Em andamento</span><button>Transferir</button><button>Concluir</button></div>
        <div class="flex flex-col border-t"><textarea class="mat-input-element"></textarea></div>
      </sessions-conversation>`,
    concluido: false,
    semControles: false,
  },
  {
    nome: 'pendente: só o Iniciar, sem composer',
    html: `
      <sessions-conversation>
        <div><span>Pendente</span><button>Iniciar</button></div>
      </sessions-conversation>`,
    concluido: false,
    semControles: false,
  },
  {
    // O estado que deixou a rodada esperando meia hora (10/08/2026). Repare: NÃO existe
    // "Reiniciar" nenhum — o rodapé virou "Nenhuma classificação definida".
    nome: 'concluído do jeito que a plataforma mostra hoje: rótulo "Concluído", sem Reiniciar',
    html: `
      <sessions-conversation>
        <div><button>Concluído</button></div>
        <div><span>Thiago concluiu o atendimento em 10/08/2026 às 20:09</span></div>
        <div><span>Nenhuma classificação definida</span></div>
      </sessions-conversation>`,
    concluido: true,
    semControles: true,
  },
  {
    nome: 'concluído pelo sinal antigo: "Reiniciar" no rodapé',
    html: `
      <sessions-conversation>
        <div><button>Reiniciar</button></div>
      </sessions-conversation>`,
    concluido: true,
    semControles: true,
  },
  {
    nome: 'concluído mostrado como chip em vez de botão',
    html: `
      <sessions-conversation>
        <div><mat-chip>Concluído</mat-chip></div>
      </sessions-conversation>`,
    concluido: true,
    semControles: true,
  },
  {
    // A armadilha inversa: o menu do Concluir aberto tem um item com o MESMO texto. Dar isto
    // por concluído era o bug que deixava o atendimento em andamento e a fila crescendo.
    nome: 'menu do Concluir aberto: ainda NÃO concluiu',
    html: `
      <sessions-conversation>
        <div><span>Em andamento</span><button>Concluir</button></div>
        <div class="flex flex-col border-t"><textarea class="mat-input-element"></textarea></div>
      </sessions-conversation>
      <div class="cdk-overlay-container"><div class="mat-menu-panel">
        <button data-cy="menu-button-session-finish">Concluir</button>
        <button>Classificar e concluir</button>
      </div></div>`,
    concluido: false,
    semControles: false,
  },
  {
    // A fila da esquerda repete texto de atendimento. Se ela contasse, qualquer contato
    // concluído na lista daria o atendimento ABERTO por fechado.
    nome: 'a palavra "Concluído" na fila da esquerda não conta',
    html: `
      <sessions-list-item><div data-cy="list-item-session"><span>Concluído</span></div></sessions-list-item>
      <sessions-conversation>
        <div><span>Em andamento</span><button>Concluir</button></div>
        <div class="flex flex-col border-t"><textarea class="mat-input-element"></textarea></div>
      </sessions-conversation>`,
    concluido: false,
    semControles: false,
  },
];

/** A barra da fila, para os casos da lista de concluídos. */
const BARRA_DA_FILA = `
  <div>
    <span data-cy="button-new-sessions" class="rounded-full"><span>Novos</span></span>
    <span data-cy="button-my-sessions" class="rounded-full bg-gray-300"><span>Meus</span></span>
    <span data-cy="button-other-sessions" class="rounded-full"><span>Outros</span></span>
    <button aria-label="Atendimentos arquivados"><mat-icon data-mat-icon-name="archive-box"></mat-icon></button>
  </div>
  <sessions-list-online-content></sessions-list-online-content>`;

/** Estado da fila → o que a troca para a lista de concluídos deve responder. */
const CASOS_FILA = [
  {
    nome: 'acha a lista de concluídos pelo ícone de caixa',
    html: BARRA_DA_FILA,
    achaConcluidos: true,
    // "Meus" está ativa, então NÃO estamos nos concluídos.
    concluidosAtiva: false,
  },
  {
    nome: 'nenhuma aba de texto ativa = estamos nos concluídos',
    html: BARRA_DA_FILA.replace(' bg-gray-300', ''),
    achaConcluidos: true,
    concluidosAtiva: true,
  },
  {
    nome: 'acha pelo data-cy quando a plataforma tiver um',
    html: `<div>
      <span data-cy="button-my-sessions" class="rounded-full bg-gray-300"><span>Meus</span></span>
      <button data-cy="button-archived-sessions">arquivados</button>
    </div>`,
    achaConcluidos: true,
    concluidosAtiva: false,
  },
  {
    nome: 'barra sem nada que pareça arquivo: recusa em vez de chutar',
    html: `<div>
      <span data-cy="button-my-sessions" class="rounded-full bg-gray-300"><span>Meus</span></span>
      <button><mat-icon data-mat-icon-name="paper-airplane"></mat-icon></button>
    </div>`,
    achaConcluidos: false,
    concluidosAtiva: false,
  },
];

/**
 * Os candidatos que a rodada experimenta quando o ícone não é reconhecido pelo nome.
 *
 * É o caminho que salvou a rodada na máquina dele: adivinhar `data-cy` e nome de ícone falhou,
 * e ficar chutando mais nomes só adiaria o problema. O que não pode acontecer é a lista de
 * candidatos incluir as próprias abas de texto (clicar nelas mudaria de fila em silêncio).
 */
const CASOS_CANDIDATOS = [
  {
    nome: 'candidatos: pega os ícones vizinhos e NUNCA as três abas',
    html: `<div id="barra">
      <span data-cy="button-new-sessions" class="rounded-full"><span>Novos</span><span>2</span></span>
      <span data-cy="button-my-sessions" class="rounded-full bg-gray-300"><span>Meus</span><span>5</span></span>
      <span data-cy="button-other-sessions" class="rounded-full"><span>Outros</span></span>
      <button id="grupos"><mat-icon data-mat-icon-name="user-group"></mat-icon></button>
      <button id="caixa"><mat-icon data-mat-icon-name="inbox"></mat-icon></button>
      <button id="menu"><mat-icon data-mat-icon-name="ellipsis-vertical"></mat-icon></button>
    </div>`,
    esperados: ['grupos', 'caixa', 'menu'],
  },
  {
    nome: 'candidatos: campo de busca fica de fora (não troca de lista)',
    html: `<div id="barra">
      <span data-cy="button-new-sessions" class="rounded-full"><span>Novos</span></span>
      <span data-cy="button-my-sessions" class="rounded-full bg-gray-300"><span>Meus</span></span>
      <span data-cy="button-other-sessions" class="rounded-full"><span>Outros</span></span>
      <button id="busca"><input type="text"></button>
      <button id="caixa"><mat-icon data-mat-icon-name="inbox"></mat-icon></button>
    </div>`,
    esperados: ['caixa'],
  },
];

/** Estado do rodapé → o botão Reiniciar está disponível? */
const CASOS_REINICIAR = [
  {
    nome: 'concluído: o Reiniciar está lá para reabrir',
    html: '<sessions-conversation><div><button>Reiniciar</button></div></sessions-conversation>',
    temReiniciar: true,
  },
  {
    nome: 'em andamento: não há o que reiniciar',
    html:
      '<sessions-conversation><div><button>Concluir</button></div>' +
      '<div class="flex flex-col border-t"><textarea class="mat-input-element"></textarea></div></sessions-conversation>',
    temReiniciar: false,
  },
  {
    nome: 'Reiniciar dentro de overlay não conta',
    html:
      '<sessions-conversation><div><button>Concluir</button></div></sessions-conversation>' +
      '<div class="cdk-overlay-container"><button>Reiniciar</button></div>',
    temReiniciar: false,
  },
];

function carregarPlaywright() {
  const require = createRequire(import.meta.url);
  for (const caminho of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try {
      return import(caminho.startsWith('/') ? caminho : require.resolve(caminho));
    } catch (_) {
      /* tenta o próximo */
    }
  }
  return null;
}

const mod = await carregarPlaywright();
if (!mod) {
  console.log('Playwright não encontrado — este conferidor precisa de um navegador.');
  console.log('As seis suítes de tests/ continuam valendo sem ele. Pulando.');
  process.exit(0);
}

const { chromium } = await mod;
const fonte = readFileSync(DOM_JS, 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
let falhas = 0;

for (const caso of CASOS) {
  await page.setContent(`<body>${caso.html}</body>`);
  const r = await page.evaluate(async (src) => {
    const url = 'data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(src)));
    const dom = await import(url);
    return { concluido: dom.isConcluded(), semControles: dom.semControlesDeAtendimento() };
  }, fonte);

  const ok = r.concluido === caso.concluido && r.semControles === caso.semControles;
  if (!ok) falhas++;
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${caso.nome}`);
  if (!ok) {
    console.log(`        isConcluded=${r.concluido} (esperado ${caso.concluido}), ` +
      `semControles=${r.semControles} (esperado ${caso.semControles})`);
  }
}

for (const caso of CASOS_FILA) {
  await page.setContent(`<body>${caso.html}</body>`);
  const r = await page.evaluate(async (src) => {
    const url = 'data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(src)));
    const dom = await import(url);
    return {
      achou: !!dom.getQueueTab(dom.ABA_CONCLUIDOS),
      ativa: dom.isQueueTabActive(dom.ABA_CONCLUIDOS),
    };
  }, fonte);

  const ok = r.achou === caso.achaConcluidos && r.ativa === caso.concluidosAtiva;
  if (!ok) falhas++;
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${caso.nome}`);
  if (!ok) {
    console.log(`        achou=${r.achou} (esperado ${caso.achaConcluidos}), ` +
      `ativa=${r.ativa} (esperado ${caso.concluidosAtiva})`);
  }
}

for (const caso of CASOS_CANDIDATOS) {
  await page.setContent(`<body>${caso.html}</body>`);
  const ids = await page.evaluate(async (src) => {
    const url = 'data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(src)));
    const dom = await import(url);
    return dom.candidatosDeConcluidos().map((el) => el.id || el.tagName.toLowerCase());
  }, fonte);

  const ok = JSON.stringify(ids) === JSON.stringify(caso.esperados);
  if (!ok) falhas++;
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${caso.nome}`);
  if (!ok) console.log(`        candidatos=${JSON.stringify(ids)} (esperado ${JSON.stringify(caso.esperados)})`);
}

for (const caso of CASOS_REINICIAR) {
  await page.setContent(`<body>${caso.html}</body>`);
  const r = await page.evaluate(async (src) => {
    const url = 'data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(src)));
    const dom = await import(url);
    return !!dom.getReiniciarButton();
  }, fonte);

  const ok = r === caso.temReiniciar;
  if (!ok) falhas++;
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${caso.nome}`);
  if (!ok) console.log(`        getReiniciarButton=${r} (esperado ${caso.temReiniciar})`);
}

await browser.close();
console.log(`\n=== falhas: ${falhas} ===`);
process.exit(falhas ? 1 : 0);
