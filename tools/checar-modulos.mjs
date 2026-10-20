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
import { readdirSync, statSync, readFileSync } from 'node:fs';
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

/**
 * **CRASE DENTRO DE TEMPLATE LITERAL, a variante que este conferidor NAO pegava** (20/10/2026).
 *
 * Com UMA crase a mais a string fecha e sobra identificador solto: `SyntaxError`, pego acima —
 * foi o que quebrou o modulo em 19/10. **Com DUAS elas nao se cancelam:** a primeira fecha a
 * string, o que vem no meio vira acesso a propriedade e a segunda abre um TAGGED TEMPLATE. Isso
 * e sintaticamente VALIDO, passa por aqui, e estoura em runtime com *"... is not a function"* —
 * no instante em que o painel desenha, ou seja, na tela dele.
 *
 * Medido: `` `a ${x} `.davez` b` `` devolve `TypeError: "...".davez is not a function`.
 *
 * A varredura e deliberadamente ESTREITA: so acusa crase dentro de um **comentario de bloco CSS**
 * (`/* ... *\/`), que e onde o caso real aconteceu duas vezes e onde crase nunca tem uso legitimo.
 * Larga demais, ela acusaria todo template com crase escapada e viraria alarme que se ignora.
 */
let comCrase = 0;

/**
 * **A varredura e ESTREITA de proposito, e a primeira versao provou por que.**
 *
 * Varrendo todo comentario de bloco ela acusou **1277** ocorrencias — os JSDoc deste projeto citam
 * nomes entre crase o tempo todo. Alarme que toca sempre e alarme que se aprende a ignorar.
 *
 * O que ela olha e so o padrao em que o caso real aconteceu duas vezes: uma funcao que **devolve
 * um template literal** (os `css()` dos paineis). Ali dentro so devem existir DUAS crases — a que
 * abre e a que fecha. Qualquer outra fechou a string no meio.
 */
const devolveTemplate = /\n(?:export )?function (\w+)\(\)\s*\{\n(\s*)return `([\s\S]*?)\n\s*`;/g;

for (const arquivo of arquivos) {
  const relativo = arquivo.slice(raiz.length + 1).replace(/\\/g, '/');
  const texto = readFileSync(arquivo, 'utf8');
  for (const m of texto.matchAll(devolveTemplate)) {
    const dentro = (m[3].match(/`/g) || []).length;
    if (!dentro) continue;
    comCrase++;
    const linha = texto.slice(0, m.index).split('\n').length;
    console.log(
      ` CRASE  ${relativo}:${linha} → ${m[1]}() tem ${dentro} crase(s) dentro do template; ` +
        'uma fecha a string (SyntaxError), duas viram tagged template e estouram na TELA'
    );
  }
}

console.log(
  `\n=== ${arquivos.length} arquivo(s), ${quebrados} com erro de sintaxe, ${comCrase} com crase em comentario CSS ===`
);
process.exit(quebrados || comCrase ? 1 : 0);
