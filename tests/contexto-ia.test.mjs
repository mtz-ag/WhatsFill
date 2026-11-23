import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { limitarContextoIA } from '../src/lib/contexto-ia.js';
const agora = Date.parse('2026-11-09T15:00:00Z');
const m = (h, de, texto) => ({at: new Date(agora - h * 3600000).toISOString(), de, texto});
const lista = [m(40, 'contato', 'reclamacao antiga'), m(39, 'nos', 'resposta antiga'), m(11, 'contato', 'https://exemplo.com')];
assert.deepEqual(limitarContextoIA(lista, 12, agora), [lista[2]]);
assert.deepEqual(limitarContextoIA(lista, 0, agora), lista);
assert.equal(limitarContextoIA([m(12, 'contato', 'limite')], 12, agora).length, 1);
assert.equal(limitarContextoIA(lista, 1, agora).length, 0);
assert.equal(limitarContextoIA([{texto: 'sem data'}], 12, agora).length, 1);
const fonte = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');
// 23/11/2026: o limite configurado passa por horasDoCorteDaIA(), que o zera para quem nunca recebeu
// resposta nossa (o Gilberto, rodada dos Novos).
assert.equal((fonte.match(/limitarContextoIA\(\[\.\.\.dela, \.\.\.nossa\], horasDoCorteDaIA\(\)\)/g) || []).length, 2, 'conversa atual e historico anterior usam o limite configurado');
assert.ok(/function horasDoCorteDaIA\(\) \{[\s\S]{0,200}state\.auto\.cfg\.horasContextoPerdido/.test(fonte), 'o limite configurado continua sendo a base');
assert.equal((fonte.match(/limitarContextoIA\(delaToda, horasDoCorteDaIA\(\)\)/g) || []).length, 1, 'dossie e orgaos usam o mesmo prazo');
console.log('Contexto IA: corte, configuracao e integracao OK');
