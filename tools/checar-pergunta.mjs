/**
 * checar-pergunta.mjs — a caixa de pergunta da rodada não pode voltar a bloquear a conversa.
 *
 * Ela nasceu como diálogo modal clássico: fundo escurecido cobrindo a tela inteira. Só que a
 * decisão que ela pede — mandar modelo? agradecer? pular? — depende de **ler o que a pessoa
 * escreveu**, e o escurecido ficava exatamente por cima da conversa. Pior: a camada comia o
 * clique, então nem rolar o histórico dava.
 *
 * O conserto foi tirar o fundo e deixar a camada atravessável, com a caixa arrastável pelo
 * título. Como isso é uma linha de CSS que qualquer refatoração desfaz sem querer, o contrato
 * fica conferido aqui, contra o `panel.css` de verdade num navegador.
 *
 * Fora das seis suítes: precisa de Playwright. Sem ele, avisa e sai com 0.
 *
 *   node tools/checar-pergunta.mjs
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const CSS = readFileSync(new URL('../src/panel/panel.css', import.meta.url), 'utf8');

async function carregarPlaywright() {
  const require = createRequire(import.meta.url);
  for (const caminho of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try {
      return await import(caminho.startsWith('/') ? caminho : require.resolve(caminho));
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

const { chromium } = mod;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

await page.setContent(`<style>${CSS}</style>
<body style="margin:0">
  <div id="conversa" style="height:100vh;background:#f3f4f6;padding:20px">
    <p>conversa da plataforma</p>
    <button id="alvo">botão no meio da conversa</button>
    <span id="conta">0</span>
  </div>
  <div class="wf-root wf-dock" id="root" style="--wf-width:380px">
    <div class="wf-pergunta-fundo">
      <div class="wf-pergunta">
        <div class="wf-pergunta-titulo">Contato de teste</div>
        <div class="wf-pergunta-corpo">O que fazer?</div>
        <div class="wf-pergunta-botoes"><button class="wf-btn">2  Pular</button></div>
      </div>
    </div>
  </div>
  <script>
    document.getElementById('alvo').addEventListener('click', () => {
      const c = document.getElementById('conta');
      c.textContent = String(Number(c.textContent) + 1);
    });
  </script>
</body>`);

let falhas = 0;
const ok = (cond, msg) => {
  if (!cond) falhas++;
  console.log(`${cond ? '  ok  ' : ' FALHA'} ${msg}`);
};

// 1. A camada não escurece a conversa.
const fundo = await page.$eval('.wf-pergunta-fundo', (el) => {
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, pointer: s.pointerEvents };
});
ok(/rgba\(0, 0, 0, 0\)|transparent/.test(fundo.bg), `a camada é transparente (${fundo.bg})`);
ok(fundo.pointer === 'none', `a camada deixa o clique passar (pointer-events: ${fundo.pointer})`);

// 2. A caixa, essa sim, recebe clique — senão os botões da pergunta não funcionam.
const caixa = await page.$eval('.wf-pergunta', (el) => getComputedStyle(el).pointerEvents);
ok(caixa === 'auto', `a caixa recebe clique (pointer-events: ${caixa})`);

// 3. O teste que importa: clicar na conversa ATRÁS da pergunta, de verdade.
await page.click('#alvo');
ok((await page.textContent('#conta')) === '1', 'clique na conversa atrás chega ao destino');

// 4. O título é a alça de arrasto, e tem que parecer uma.
const alca = await page.$eval('.wf-pergunta-titulo', (el) => getComputedStyle(el).cursor);
ok(alca === 'grab', `o título é a alça de arrasto (cursor: ${alca})`);

// 5. Solta numa posição, a caixa vira `fixed` e obedece a left/top.
const solta = await page.evaluate(() => {
  const c = document.querySelector('.wf-pergunta');
  c.classList.add('wf-pergunta-solta');
  c.style.left = '120px';
  c.style.top = '90px';
  const r = c.getBoundingClientRect();
  return { left: Math.round(r.left), top: Math.round(r.top), pos: getComputedStyle(c).position };
});
ok(solta.pos === 'fixed', `solta, a caixa é fixed (${solta.pos})`);
ok(solta.left === 120 && solta.top === 90, `e vai para onde foi largada (${solta.left}, ${solta.top})`);

await browser.close();
console.log(`\n=== falhas: ${falhas} ===`);
process.exit(falhas ? 1 : 0);
