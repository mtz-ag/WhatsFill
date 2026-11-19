import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const fonte = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');
const trecho = fonte.match(/const encerrou = simular[\s\S]*?;/)?.[0];
assert.ok(trecho);
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
const executar = new AsyncFunction('simular','ultimaEhDespedida','state','encerrouAConversa','jaRespondemosAntes', trecho + 'return encerrou;');
let chamadas = 0;
const ia = async () => { chamadas++; return true; };
assert.equal(await executar(true, () => false, {entrantes: []}, ia, true), false);
assert.equal(chamadas, 0);
assert.equal(await executar(true, () => true, {entrantes: [], nossaUltimaAt: new Date().toISOString()}, ia, true), true);
// 19/11/2026: despedida de ONTEM nao encerra a conversa de hoje.
assert.equal(await executar(true, () => true, {entrantes: [], nossaUltimaAt: new Date(Date.now() - 36 * 3600e3).toISOString()}, ia, true), false);
assert.equal(chamadas, 0);
assert.equal(await executar(false, () => false, {entrantes: []}, ia, true), true);
assert.equal(chamadas, 1);
assert.match(fonte, /if \(!state.auto.rodando\) \{\s*state.auto.remocao = [\s\S]*?await removerEtiquetasListadas/);
console.log('Previa nao chama IA; rodada preserva chamada; remocao ao abrir integrada OK');
