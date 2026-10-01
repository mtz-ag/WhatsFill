/**
 * checar-referencias.mjs — toda função chamada dentro de um arquivo existe nele?
 *
 * **Nasceu de um bug que passou por tudo.** No merge `c7a6d59` (31/08) o git removeu duas funções
 * inteiras do `panel.js` — `avaliarComIA` e `tentarRascunhoAutomatico` — e o arquivo continuou
 * **sintaticamente válido**, com duas chamadas para funções que não existiam mais. `node --check`
 * não vê, `checar-modulos.mjs` não vê (ele só importa e olha `SyntaxError`), e as suítes não veem
 * porque o `panel.js` não é importado por nenhuma: ele precisa de `window`.
 *
 * O erro só apareceria ao rodar, no meio de uma rodada, como `avaliarComIA is not defined` — e a
 * rodada morre em silêncio, que é o pior jeito de descobrir.
 *
 * **O que isto faz, e o que deliberadamente NÃO faz.** Ele coleta os nomes declarados no arquivo
 * (funções, `const`/`let` de arrow, importados) e as chamadas `nome(`, e reclama do que é chamado
 * sem estar declarado nem importado. Não resolve escopo, não segue `this`, não entende
 * `obj.metodo()` — por isso ignora tudo que tem ponto antes e mantém uma lista de globais
 * conhecidas. É um detector de função-que-sumiu, não um analisador de verdade.
 *
 * Falso positivo aqui custa uma linha na lista `GLOBAIS`; falso negativo custa uma rodada morta.
 *
 * Rode: node tools/checar-referencias.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Nomes que existem sem ser declarados no arquivo: navegador, JS e o que o Chrome injeta. */
const GLOBAIS = new Set([
  // JS
  'Array', 'Boolean', 'Date', 'Error', 'Intl', 'JSON', 'Map', 'Math', 'Number', 'Object',
  'Promise', 'Proxy', 'RegExp', 'Set', 'String', 'Symbol', 'WeakMap', 'WeakSet', 'BigInt',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'encodeURI', 'decodeURI', 'structuredClone', 'queueMicrotask', 'eval', 'require',
  // navegador
  'window', 'document', 'console', 'fetch', 'setTimeout', 'clearTimeout', 'setInterval',
  'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'alert', 'confirm', 'prompt',
  'Audio', 'Blob', 'File', 'FileReader', 'FormData', 'Headers', 'Request', 'Response', 'URL',
  'URLSearchParams', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'Event',
  'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'AbortController', 'DOMParser', 'Node',
  'HTMLElement', 'Element', 'getComputedStyle', 'matchMedia', 'localStorage', 'sessionStorage',
  'XMLHttpRequest', 'WebSocket', 'Notification', 'Image', 'Worker', 'TextEncoder', 'TextDecoder',
  'NodeFilter', 'NodeList', 'Text', 'Range', 'Selection',
  // Decodifica a imagem escolhida para o canvas convertê-la em JPEG (ver `converterParaJpeg`).
  'createImageBitmap', 'OffscreenCanvas', 'ImageData',
  'navigator', 'location', 'history', 'screen', 'performance', 'crypto', 'atob', 'btoa',
  'TextEncoder', 'TextDecoder', 'AudioContext', 'webkitAudioContext',
  'ArrayBuffer', 'DataView', 'Uint8Array', 'Uint16Array', 'Int8Array', 'Float32Array',
  // extensão
  'chrome',
  // palavras que o coletor pode confundir com chamada
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'await', 'new',
  'else', 'do', 'try', 'case', 'delete', 'void', 'in', 'of', 'yield', 'super', 'this', 'async',
  // `import()` dinamico: e o carregador do content script (import classico -> ESM)
  'import',
]);

/**
 * Só o CÓDIGO: fora comentários, strings e template literals.
 *
 * A primeira versão não fazia isto e acusou **503** chamadas inexistentes — todas palavras dentro
 * de comentário seguidas de parêntese ("a rodada (que já fechou)"), que neste projeto são muitas e
 * em português. Ferramenta que grita 503 falsos ninguém roda duas vezes, e aí ela não serve para
 * nada.
 *
 * Troca cada trecho por espaços do mesmo tamanho, para os números de linha continuarem valendo.
 */
function soCodigo(src) {
  let saida = '';
  let estado = 'codigo'; // codigo | linha | bloco | aspas | apostrofo | template
  let fecho = '';
  let dentroDeClasse = false; // [...] dentro de regex: a barra ali não fecha

  /**
   * `/` abre REGEX ou é divisão?
   *
   * Sem esta distinção sobravam ~25 falsos: as palavras de dentro dos dicionários deste projeto
   * (`/(sempre|junto) com/`) contam como chamada, porque regex tem parêntese. A heurística é a
   * de sempre: depois de operador, abertura ou palavra-chave, `/` é regex; depois de
   * identificador, número ou fechamento, é divisão.
   */
  const abreRegex = (ate) => {
    const anteriores = ate.replace(/\s+$/, '');
    if (!anteriores) return true;
    const ultimo = anteriores[anteriores.length - 1];
    if ('([{,;=:!&|?+-*%~^<>'.includes(ultimo)) return true;
    return /\b(return|typeof|case|in|of|new|delete|void|do|else|yield|await)$/.test(anteriores);
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const prox = src[i + 1];
    // (o caractere anterior deixou de ser lido quando a barra invertida passou a consumir o par)

    if (estado === 'codigo') {
      if (c === '/' && prox === '/') { estado = 'linha'; saida += '  '; i++; continue; }
      if (c === '/' && prox === '*') { estado = 'bloco'; saida += '  '; i++; continue; }
      if (c === '/' && abreRegex(saida)) { estado = 'regex'; dentroDeClasse = false; saida += ' '; continue; }
      if (c === '"' || c === "'" || c === '`') {
        estado = 'texto';
        fecho = c;
        saida += ' ';
        continue;
      }
      saida += c;
      continue;
    }

    if (estado === 'linha') {
      if (c === '\n') { estado = 'codigo'; saida += c; continue; }
      saida += ' ';
      continue;
    }

    if (estado === 'bloco') {
      if (c === '*' && prox === '/') { estado = 'codigo'; saida += '  '; i++; continue; }
      saida += c === '\n' ? c : ' ';
      continue;
    }

    if (estado === 'regex') {
      if (c === '\\') { saida += '  '; i++; continue; } // escape: pula o par
      if (c === '[') dentroDeClasse = true;
      else if (c === ']') dentroDeClasse = false;
      else if (c === '/' && !dentroDeClasse) {
        estado = 'codigo';
        saida += ' ';
        /**
         * **As FLAGS somem junto com a expressão.** `/\d+/i.test(x)` deixava um `i` solto seguido
         * de ponto, e as duas passadas o liam como variável — cinco falsos, todos chamados `i`.
         */
        while (i + 1 < src.length && /[a-z]/.test(src[i + 1])) { saida += ' '; i++; }
        continue;
      }
      saida += c === '\n' ? c : ' ';
      continue;
    }

    // texto: aspas, apóstrofo ou template
    /**
     * **A barra invertida consome o PAR, como na regex** — sem isso o verificador acusou 61
     * problemas inventados em 20/09/2026, todos palavras de dentro de comentario (`Anthropic()`,
     * `cadastro()`, `bastante()`).
     *
     * A causa: uma string com DUAS barras escapadas termina em barra antes da aspa, e o teste
     * `anterior !== barra` lia a aspa de fechamento como escapada. A string nao fechava, o
     * pareamento de aspas saia deslocado dali para a frente e o comentario seguinte virava codigo
     * a vista. **Pior que o falso positivo e o outro lado**: deslocado, o pareamento tambem apaga
     * codigo de verdade, e ai o verificador deixa de ver a chamada que sumiu.
     */
    if (c === '\\') { saida += '  '; i++; continue; }
    if (c === fecho) { estado = 'codigo'; saida += ' '; continue; }
    saida += c === '\n' ? c : ' ';
  }
  return saida;
}
function nomesDeclarados(src) {
  const nomes = new Set();
  const add = (re, grupo = 1) => {
    for (const m of src.matchAll(re)) if (m[grupo]) nomes.add(m[grupo]);
  };

  add(/(?:^|\s)(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g);
  add(/(?:^|\s)(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g);
  add(/(?:^|\s)class\s+([A-Za-z_$][\w$]*)/g);
  // método de objeto literal ou de classe: `nome(args) {` no começo da linha
  add(/^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm);
  // propriedade que recebe função: `nome: (…) =>` ou `nome: function`
  add(/([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?(?:function|\()/g);
  // import { a, b as c } / import x / import * as ns
  for (const m of src.matchAll(/import\s+([^;]+?)\s+from/g)) {
    const clausula = m[1];
    for (const parte of clausula.replace(/[{}]/g, ' ').split(',')) {
      const t = parte.trim();
      if (!t) continue;
      const comoAlias = t.match(/\bas\s+([A-Za-z_$][\w$]*)/);
      if (comoAlias) nomes.add(comoAlias[1]);
      else if (/^[A-Za-z_$][\w$]*$/.test(t)) nomes.add(t);
    }
  }
  /**
   * Parâmetros contam como declarados.
   *
   * Sem isto sobravam 57 falsos: `fn`, `onResize`, `onToggle`, `resolve`, `sendResponse` — todos
   * parâmetros chamados dentro da própria função. A coleta é grosseira de propósito (pega qualquer
   * identificador entre parênteses de declaração), porque **errar para o lado de calar é o certo
   * aqui**: o alvo é função que SUMIU, e função que sumiu não aparece em declaração nenhuma.
   */
  const declaracoes = [
    /function\s*\*?\s*[A-Za-z_$][\w$]*\s*\(([^)]*)\)/g, // function nome(a, b)
    /function\s*\(([^)]*)\)/g, // function (a, b)
    /\(([^)]*)\)\s*=>/g, // (a, b) =>
    /catch\s*\(([^)]*)\)/g, // catch (err)
  ];
  for (const re of declaracoes) {
    for (const m of src.matchAll(re)) {
      for (const bruto of (m[1] || '').split(',')) {
        // tira default, desestruturação e rest: sobra o identificador
        for (const ident of bruto.matchAll(/[A-Za-z_$][\w$]*/g)) nomes.add(ident[0]);
      }
    }
  }
  // arrow de um parâmetro sem parênteses: x => …
  for (const m of src.matchAll(/(^|[^\w$.])([A-Za-z_$][\w$]*)\s*=>/g)) nomes.add(m[2]);

  /**
   * **Desestruturação e `for…of`** — as formas que a passada dos ACESSOS obrigou a cobrir.
   *
   * A passada das chamadas vivia sem elas porque quase ninguém CHAMA o que desestruturou; a dos
   * acessos usa `x.campo` o tempo todo (`const { a, b } = …; a.nome`), e sem isto ela acusava 47
   * falsos de uma vez — número que ensina a ignorar a ferramenta.
   */
  const ligacoes = [
    /(?:const|let|var)\s*\{([^}]*)\}/g,      // const { a, b: c } = …
    /(?:const|let|var)\s*\[([^\]]*)\]/g,     // const [a, b] = …
    /for\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s+(?:of|in)/g,
  ];
  for (const re of ligacoes) {
    for (const m of src.matchAll(re)) {
      for (const ident of (m[1] || '').matchAll(/[A-Za-z_$][\w$]*/g)) nomes.add(ident[0]);
    }
  }

  return nomes;
}

function chamadasSemPonto(src) {
  const fora = new Set();
  // `nome(` que NÃO vem depois de ponto, e não é declaração
  for (const m of src.matchAll(/(^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const nome = m[2];
    const antes = src.slice(Math.max(0, m.index - 24), m.index + m[1].length);
    if (/\b(function|class)\s*$/.test(antes)) continue;
    fora.add(nome);
  }
  return fora;
}

const dir = 'src';
const arquivos = [];
(function varrer(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const caminho = join(d, e.name);
    if (e.isDirectory()) varrer(caminho);
    else if (e.name.endsWith('.js')) arquivos.push(caminho);
  }
})(dir);

let problemas = 0;
for (const arquivo of arquivos) {
  const bruto = readFileSync(arquivo, 'utf8');
  const src = soCodigo(bruto);
  const declarados = nomesDeclarados(src);
  const faltando = [...chamadasSemPonto(src)]
    .filter((n) => !declarados.has(n) && !GLOBAIS.has(n))
    .sort();

  if (faltando.length) {
    problemas += faltando.length;
    console.log(`\n${arquivo}`);
    for (const n of faltando) {
      const linha = src.slice(0, src.search(new RegExp(`(^|[^\\w$.])${n}\\s*\\(`))).split('\n').length;
      console.log(`   ${n}()  — chamada na linha ~${linha}, sem declaração no arquivo`);
    }
  }
}

/**
 * Segunda passada: toda opção da pergunta da rodada tem quem a execute?
 *
 * **Nasceu do mesmo tipo de bug, um dia depois.** A tecla 0 (a recomendação da IA) devolvia
 * `ia:<id>` e NENHUM `if` tratava esse valor: a escolha caía no fim da função e mandava outra
 * mensagem, para gente de verdade. Sintaxe válida, nenhuma função faltando — a passada de cima
 * não vê, porque não falta chamada nenhuma. O que falta é o **ramo**.
 *
 * A checagem é literal e por isso confiável: cada `valor: 'x'` das opções tem que aparecer em
 * algum `=== 'x'`. Valor montado (`valor: \`ia:${id}\``) é conferido pelo prefixo, que tem que
 * aparecer num `startsWith('ia:'`.
 */
const opcoesOrfas = [];
for (const arquivo of arquivos) {
  const src = soCodigo(readFileSync(arquivo, 'utf8'));

  for (const m of src.matchAll(/valor:\s*'([^']+)'/g)) {
    const valor = m[1];
    if (!src.includes(`=== '${valor}'`) && !src.includes(`!== '${valor}'`)) {
      opcoesOrfas.push({ arquivo, valor, como: 'nenhum `=== ' + `'${valor}'` + '` no arquivo' });
    }
  }
  for (const m of src.matchAll(/valor:\s*`([^`$]+)\$\{/g)) {
    const prefixo = m[1];
    if (!src.includes(`startsWith('${prefixo}'`)) {
      opcoesOrfas.push({ arquivo, valor: `${prefixo}…`, como: `nenhum startsWith('${prefixo}')` });
    }
  }
}
if (opcoesOrfas.length) {
  console.log('\nOpções de pergunta sem ramo que as execute:');
  for (const o of opcoesOrfas) console.log(`   ${o.arquivo}: valor "${o.valor}" — ${o.como}`);
  problemas += opcoesOrfas.length;
}

/**
 * **Função de MÓDULO que chama nome de dentro de uma closure** — `ReferenceError` em produção.
 *
 * Foi o defeito da v3.123: `carregarModelosPadrao` mora no nível do arquivo e passou a chamar
 * `perfilAtivo()`, que vive dentro da closure do painel. O erro estourava em TODO contato, e o
 * relato dele foi *"iniciei o automatizado mas não está fazendo nada"*. É a mesma classe do
 * `dom.numeroDaConversa()` chamado do painel, registrada um dia antes.
 *
 * **A tentativa LARGA de 03/09 foi abandonada com 33 falsos positivos** — está no CLAUDE.md, e esta
 * não a desmente: aquela procurava variável fora de escopo em qualquer lugar. Esta compara só o
 * corpo das funções declaradas na COLUNA 0 contra os nomes declarados INDENTADOS, que são
 * exatamente os dois escopos que não se enxergam. Rodada contra o commit que quebrou, acusa as duas
 * chamadas; contra o conserto, cala.
 */
const foraDeEscopo = [];
for (const arquivo of arquivos) {
  const linhas = readFileSync(arquivo, 'utf8').split('\n');
  const daClosure = new Set();
  const deModulo = [];
  for (let i = 0; i < linhas.length; i++) {
    let m = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(linhas[i]);
    if (m) {
      // O fim é o `}` na coluna 0 — ou a PRÓXIMA função de módulo, se ela vier antes: sem isso o
      // alcance de uma engole a seguinte e a acusação sai com o dono errado.
      let fim = linhas.length - 1;
      for (let j = i + 1; j < linhas.length; j++) {
        if (linhas[j] === '}' || /^(?:async\s+)?function\s/.test(linhas[j])) { fim = j; break; }
      }
      deModulo.push([m[1], i, fim]);
      continue;
    }
    m = /^\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(linhas[i]);
    if (m) daClosure.add(m[1]);
  }
  const nomesDeModulo = new Set(deModulo.map(([n]) => n));
  /**
   * **Uma varredura de CHAMADAS por linha, e o nome conferido num `Set`** — e não uma regex por
   * nome por linha, que foi como isto nasceu na v3.124.
   *
   * Com 247 nomes na closure e milhares de linhas, aquela forma compilava centenas de milhares de
   * expressões e o verificador passou de segundos para MINUTOS. **Verificador lento é verificador
   * que alguém deixa de rodar** — e este existe justamente para o defeito que nenhum teste pega.
   */
  const CHAMADA = /(^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g;
  for (const [dono, ini, fim] of deModulo) {
    for (let i = ini + 1; i <= fim; i++) {
      if (/^\s*(\*|\/\/)/.test(linhas[i])) continue;
      const linha = linhas[i].replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '');
      CHAMADA.lastIndex = 0;
      let m;
      while ((m = CHAMADA.exec(linha))) {
        const nome = m[2];
        if (!daClosure.has(nome) || nomesDeModulo.has(nome)) continue;
        foraDeEscopo.push({ arquivo, dono, nome, linha: i + 1 });
      }
    }
  }
}
if (foraDeEscopo.length) {
  console.log('\nFunção de módulo chamando nome que só existe dentro da closure:');
  for (const f of foraDeEscopo) {
    console.log(`   ${f.arquivo}:${f.linha}  ${f.dono}() chama ${f.nome}() — ReferenceError em produção`);
  }
  problemas += foraDeEscopo.length;
}

console.log(
  problemas
    ? `\n=== ${problemas} problema(s): chamada sem declaração, opção sem ramo ou nome fora de escopo ===`
    : `\n=== ${arquivos.length} arquivo(s), toda chamada declarada, toda opção com ramo e nenhum nome fora de escopo ===`
);
process.exit(problemas ? 1 : 0);
