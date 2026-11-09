import './_harness.mjs';
import assert from 'node:assert/strict';
import { montarSistemaRascunho, montarContatoRascunho } from '../src/lib/ia.js';

const sistema = montarSistemaRascunho();
assert.match(sistema, /primeiro pergunte se a pessoa já registrou/);
assert.match(sistema, /Se ela já contou que registrou, NÃO pergunte novamente/);
assert.match(sistema, /Meu papel é cobrar providências/);
assert.match(sistema, /Na MESMA resposta, identifique ONDE reclamar/);
assert.match(sistema, /Copie telefone, site ou e-mail exatamente/);
assert.match(sistema, /Não afirme que já cobrou/);
assert.match(sistema, /Desabafo pessoal ou relato de perda/);
for (const texto of ['Todo dia falta água na minha rua.', 'Já reclamei, protocolo 123, e não responderam.']) {
  const contato = montarContatoRascunho({ mensagens: [{ de: 'contato', texto }], orgaos: 'CANAL_OFICIAL_TESTE' });
  assert.match(contato, /EXCEÇÃO: reclamação de serviço público segue a regra 20/);
  assert.match(contato, /protocolo e retorno apenas se faltarem/);
}
console.log('Orientacao de reclamacao no sistema e no contexto: OK');
