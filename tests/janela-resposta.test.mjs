import assert from 'node:assert/strict';
import { avisoJanelaResposta, statusJanelaResposta } from '../src/lib/janela-resposta.js';
const agora = Date.parse('2026-11-09T15:00:00Z');
const msg = horas => ({ at: new Date(agora - horas * 3600000).toISOString() });
assert.equal(avisoJanelaResposta([msg(23.99)], agora), '');
assert.match(avisoJanelaResposta([msg(24)], agora), /ultrapassado/);
assert.match(avisoJanelaResposta([msg(48)], agora), /ultrapassado/);
assert.equal(avisoJanelaResposta([msg(48), msg(1)], agora), '');
assert.equal(avisoJanelaResposta([msg(1), msg(48)], agora), '');
assert.equal(avisoJanelaResposta([{ ...msg(1), tipo: 'audio', texto: '' }], agora), '');
assert.match(avisoJanelaResposta([], agora), /Não foi possível confirmar/);
assert.match(avisoJanelaResposta([{ at: 'invalido' }, msg(-1)], agora), /Não foi possível confirmar/);
assert.match(avisoJanelaResposta([msg(24)], agora - 1), /^$/);
console.log('Janela de 24h: limites, renovacao, midia e datas ausentes OK');

assert.equal(statusJanelaResposta([msg(1.5)], agora), '24h: restam 22h 30min');
assert.match(statusJanelaResposta([msg(24)], agora), /PRAZO VENCIDO/);
assert.match(statusJanelaResposta([], agora), /desconhecido/);
assert.equal(statusJanelaResposta([msg(48), msg(0)], agora), '24h: restam 24h 00min');
