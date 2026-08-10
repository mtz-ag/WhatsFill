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
  runtime: { getURL: (p) => p },
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
