/**
 * checar-modulos.mjs — todo arquivo de `src/` PARSEIA como ES module?
 *
 * **Por que isto existe.** `node --check arquivo.js` analisa como **CommonJS**, que é modo
 * solto; o Chrome carrega a extensão como **ES module**, que é sempre strict. Um arquivo pode
 * passar no `--check` e o navegador recusar.
 *
 * Foi assim que a extensão parou de carregar em 30/08/2026: um `.join('\n\n')` virou uma string
 * com quebra de linha CRUA no meio (acidente de escape ao gerar o patch). O `--check` disse OK, o
 * Chrome disse "Invalid or unexpected token", e o painel simplesmente não apareceu — sem erro
 * visível na aba, porque o content script morre antes de desenhar qualquer coisa.
 *
 * O que ele faz: importa cada módulo e **só reclama de `SyntaxError`**. Erro de execução
 * (`window is not defined`, `chrome is not defined`) é esperado fora do navegador e é ignorado —
 * o que importa aqui é o arquivo ser analisável.
 *
 * Rode: node tools/checar-modulos.mjs
 */
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

function listar(dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...listar(caminho));
    else if (nome.endsWith('.js')) saida.push(caminho);
  }
  return saida;
}

const arquivos = listar(join(raiz, 'src'));
let quebrados = 0;

for (const arquivo of arquivos) {
  const relativo = arquivo.slice(raiz.length + 1).replace(/\\/g, '/');
  try {
    await import(pathToFileURL(arquivo).href);
    console.log(`  ok   ${relativo}`);
  } catch (err) {
    if (err instanceof SyntaxError) {
      quebrados++;
      console.log(` QUEBRADO ${relativo} → ${err.message}`);
    } else {
      // Erro de execução fora do navegador: esperado, e não é o que este conferidor procura.
      console.log(`  ok   ${relativo}  (parseou; parou em "${String(err.message).slice(0, 40)}")`);
    }
  }
}

console.log(`\n=== ${arquivos.length} arquivo(s), ${quebrados} com erro de sintaxe ===`);
process.exit(quebrados ? 1 : 0);
