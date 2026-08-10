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

await browser.close();
console.log(`\n=== falhas: ${falhas} ===`);
process.exit(falhas ? 1 : 0);
