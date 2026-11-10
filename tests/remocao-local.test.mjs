import './_harness.mjs';
import assert from 'node:assert/strict';
import { etiquetaLocalParaRemover } from '../src/lib/tags.js';
const local = {id: 'sem retorno', name: '⛔ 1 SEM RETORNO'};
assert.equal(etiquetaLocalParaRemover('⛔ 1 Sem Retorno', [local]), local);
assert.equal(etiquetaLocalParaRemover('⛔ 2 Sem Retorno', [local]), null);
assert.equal(etiquetaLocalParaRemover('Outra', [local]), null);
assert.equal(etiquetaLocalParaRemover('⛔ 1 Sem Retorno', []), null);
console.log('Remocao: resolve etiqueta local sem catalogo e preserva numero OK');
