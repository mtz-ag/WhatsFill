/**
 * Base dos testes: stub de chrome.storage.local em memória e um contador de falhas.
 * Roda em Node puro (>=18), sem dependência nenhuma.
 */

export const mem = {};

globalThis.chrome = {
  storage: {
    local: {
      async get(key) {
        const keys = Array.isArray(key) ? key : [key];
        const out = {};
        for (const k of keys) if (k in mem) out[k] = mem[k];
        return out;
      },
      async set(obj) {
        Object.assign(mem, obj);
      },
    },
    onChanged: { addListener() {} },
  },
  /**
   * `getURL` devolve o caminho ABSOLUTO do arquivo no repositório, e não o relativo.
   *
   * O `fetch` do Node não resolve caminho relativo — ele exige uma URL —, e o stub antigo fazia a
   * leitura de `src/data/*.json` falhar com *"Failed to parse URL"*. Não incomodava enquanto a
   * única leitura era a lista do RS, que os testes já plantam no storage; a lista nacional
   * (`municipios-br.json`, 08/09/2026) não tem cache no storage e só existe em arquivo.
   */
  runtime: {
    getURL: (p) => new URL(`../${p}`, import.meta.url).href,
  },
};

/**
 * **O `fetch` do Node não abre `file://`**, e é assim que a extensão lê os dados que vêm no pacote
 * (`chrome.runtime.getURL` + `fetch`). Sem esta ponte, `municipios-br.json` falha com
 * *"fetch failed"* e a lista nacional chega vazia — o teste passaria a medir uma lista sem nomes,
 * que é o pior tipo de teste verde.
 *
 * Só intercepta `file://`; qualquer outra URL segue para o `fetch` de verdade, que é o que deixa a
 * chamada ao IBGE falhar como falha no ambiente sem rede (e é o que os testes esperam).
 */
const fetchOriginal = globalThis.fetch;
globalThis.fetch = async (url, ...resto) => {
  const alvo = String(url);
  if (alvo.startsWith('file://')) {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const texto = await readFile(fileURLToPath(alvo), 'utf8');
    return { ok: true, status: 200, async json() { return JSON.parse(texto); }, async text() { return texto; } };
  }
  return fetchOriginal(url, ...resto);
};

let falhas = 0;

export function check(ok, texto) {
  if (!ok) falhas++;
  console.log(`${ok ? '  ok  ' : ' FALHA'} ${texto}`);
}

export function grupo(titulo) {
  console.log(`\n${titulo}`);
}

export function fim() {
  console.log(`\n=== falhas: ${falhas} ===`);
  process.exit(falhas ? 1 : 0);
}

/** Importa um módulo de src/lib pelo nome, com caminho relativo a este arquivo. */
export function lib(name) {
  return import(new URL(`../src/lib/${name}`, import.meta.url).href);
}
