/**
 * contract.js — a parte pura do aprendizado de escrita: derivar o contrato de uma
 * requisição capturada e reconstruir requisições a partir dele.
 *
 * Fica separado de recorder.js (que depende de window/postMessage) justamente para ser
 * testável fora do navegador — é o código que grava em dados reais, então ele tem teste.
 */

import { findPaths, findPathsContaining, setByPath, getByPath } from './path.js';

/**
 * Valor de teste usado no aprendizado: você digita isto no campo Cidade pela interface do
 * mobiliza, e é por ele que a extensão reconhece qual requisição grava o campo.
 */
export const SENTINEL = 'WHATSFILL-TESTE';

/**
 * Sentinela do campo de data. Data não aceita texto, então o valor de teste é uma data
 * improvável de existir de verdade num contato. As duas grafias cobrem o que a plataforma
 * pode mandar no body (ISO ou brasileiro) — o casamento por conteúdo cuida do resto.
 */
export const SENTINEL_DATE = '1999-12-31';
export const SENTINEL_DATE_NEEDLES = ['1999-12-31', '31/12/1999'];
export const SENTINEL_DATE_HUMANO = '31/12/1999';

/** Body com mais chaves que isso e com o id do contato na raiz = escrita de entidade inteira. */
const FULL_ENTITY_KEY_LIMIT = 8;

/**
 * @param {{method:string,url:string,body:string|null}} req requisição capturada
 * @param {object} ctx { contactId, field:{id,name,type}, needles:string[] }
 * @returns {object} entrada de contrato pronta para persistir
 * @throws {Error} quando o formato não é reproduzível com segurança
 */
export function deriveContract(req, { contactId, field, needles }) {
  const parsed = tryParse(req.body);

  if (parsed == null || typeof parsed !== 'object') {
    throw new Error(
      'A requisição capturada não tem body JSON — a extensão não sabe reproduzi-la com segurança. ' +
        'Use o fallback pelo DOM.'
    );
  }

  // Guarda-corpo: se a plataforma grava reenviando o contato inteiro, repetir o exemplo
  // gravado escreveria dados do contato de teste em cima do contato atual.
  const topKeys = Object.keys(parsed).length;
  if (topKeys > FULL_ENTITY_KEY_LIMIT && findPaths(parsed, contactId).includes('id')) {
    throw new Error(
      `A plataforma grava reenviando o contato inteiro (${topKeys} campos no body). ` +
        'Reproduzir isso poderia sobrescrever dados de outros contatos, então não vou aprender ' +
        'esse formato. Use o fallback pelo DOM.'
    );
  }

  // Exato primeiro. O fallback por conteúdo é o que salva a data: você escolhe 31/12/1999 e a
  // plataforma manda "1999-12-31T00:00:00.000Z".
  const valuePath =
    first(needles.flatMap((n) => findPaths(parsed, n))) ??
    first(needles.flatMap((n) => findPathsContaining(parsed, n)));

  if (valuePath == null) {
    throw new Error('Achei a requisição, mas não localizei o valor dentro do body.');
  }

  return {
    type: field.type,
    method: req.method,
    url: String(req.url).replaceAll(contactId, '{{contactId}}').replaceAll(field.id, '{{fieldId}}'),
    bodyShape: parsed,
    /**
     * O valor exato que a plataforma mandou no exemplo. É por ele que a escrita descobre o
     * FORMATO esperado (data crua x ISO completo x dd/mm/aaaa) em vez de tentar na sorte.
     */
    sampleValue: getByPath(parsed, valuePath),
    paths: {
      value: valuePath,
      valueIsArrayItem: /\[\d+\]$/.test(valuePath),
      contactId: first(findPaths(parsed, contactId)),
      fieldId: first(findPaths(parsed, field.id)),
    },
    learnedFrom: field.name,
    /** Guardado para quem grava sempre no mesmo campo (etiquetas), que não passa fieldId. */
    learnedFieldId: field.id,
    learnedAt: new Date().toISOString(),
    rawSample: { method: req.method, url: req.url, body: req.body },
  };
}

/**
 * Reconstrói a requisição trocando só contactId, fieldId e valor.
 * `fieldId` pode ser omitido por quem grava sempre no mesmo campo (etiquetas): aí vale o id
 * observado no aprendizado.
 */
export function buildRequest(entry, { contactId, fieldId, value }) {
  const campo = fieldId ?? entry.learnedFieldId ?? '';

  const url = String(entry.url)
    .replaceAll('{{contactId}}', contactId)
    .replaceAll('{{fieldId}}', campo);

  let body = null;
  if (entry.bodyShape != null) {
    body = structuredClone(entry.bodyShape);
    if (entry.paths.contactId) setByPath(body, entry.paths.contactId, contactId);
    if (entry.paths.fieldId) setByPath(body, entry.paths.fieldId, campo);
    if (entry.paths.value != null) {
      // Quando o exemplo tinha um array no caminho do valor (múltipla escolha), trocamos o
      // array inteiro — e não um item — para aceitar N opções.
      const target = entry.paths.valueIsArrayItem
        ? entry.paths.value.replace(/\[\d+\]$/, '')
        : entry.paths.value;
      const finalValue =
        entry.paths.valueIsArrayItem && !Array.isArray(value) ? [value] : value;
      setByPath(body, target, finalValue);
    }
  }

  return { url, body };
}

function first(list) {
  return list && list.length ? list[0] : null;
}

function tryParse(body) {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch (_) {
    return null;
  }
}
