/**
 * path.js — get/set por caminho ("a.b[0].c") em objetos JSON.
 * Usado pelo gravador para lembrar ONDE dentro do body a plataforma coloca contactId,
 * fieldId e valor, em vez de tratar o body como texto (que quebraria em arrays).
 */

function tokenize(path) {
  return String(path)
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((t) => t !== '');
}

export function getByPath(obj, path) {
  let cur = obj;
  for (const key of tokenize(path)) {
    if (cur == null) return undefined;
    cur = cur[key];
  }
  return cur;
}

export function setByPath(obj, path, value) {
  const tokens = tokenize(path);
  let cur = obj;
  for (let i = 0; i < tokens.length - 1; i++) {
    const key = tokens[i];
    if (cur[key] == null || typeof cur[key] !== 'object') {
      cur[key] = /^\d+$/.test(tokens[i + 1]) ? [] : {};
    }
    cur = cur[key];
  }
  cur[tokens[tokens.length - 1]] = value;
  return obj;
}

/** Todos os caminhos cujo valor (string/número) é igual a `needle`. */
export function findPaths(obj, needle, prefix = '') {
  return walk(obj, prefix, (folha) => String(folha) === String(needle));
}

/**
 * Como findPaths, mas aceita o valor que apenas CONTÉM `needle`.
 *
 * Existe por causa da data: você escolhe 31/12/1999 na interface e a plataforma manda
 * "1999-12-31T00:00:00.000Z" no body. Igualdade exata não acharia o caminho, e sem caminho
 * não há contrato.
 */
export function findPathsContaining(obj, needle, prefix = '') {
  const alvo = String(needle);
  if (!alvo) return [];
  return walk(obj, prefix, (folha) => String(folha).includes(alvo));
}

function walk(obj, prefix, casa) {
  const hits = [];
  if (obj == null) return hits;

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => hits.push(...walk(item, `${prefix}[${i}]`, casa)));
    return hits;
  }

  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      hits.push(...walk(value, prefix ? `${prefix}.${key}` : key, casa));
    }
    return hits;
  }

  if (casa(obj)) hits.push(prefix);
  return hits;
}
