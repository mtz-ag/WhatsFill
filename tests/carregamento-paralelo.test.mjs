import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Executa os blocos usados pelo painel com leituras controladas, sem CRM ou envios.
const fonte = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const bloco = (inicio, fim) => fonte.slice(fonte.indexOf(inicio), fonte.indexOf(fim, fonte.indexOf(inicio)));
const carregar = new AsyncFunction('api', 'fieldsLib', 'state', 'sessionId',
  bloco('const [contact, classify, conversa]', 'state.contact = contact;') +
  'return { contact, classify, conversa };');
let liberar;
const cadastro = new Promise(resolve => { liberar = resolve; });
let leuConversa = false;
const resultado = carregar({
  getContact: () => cadastro,
  getConversation: async id => { leuConversa = true; return { id, incoming: ['oi'] }; },
}, { classifyFields: async () => ['Nome'] }, { session: { contactId: 'contato' } }, 'sessao');
assert.equal(leuConversa, true, 'mensagens devem comecar a carregar antes do cadastro terminar');
liberar({ id: 'contato' });
assert.deepEqual(await resultado, {
  contact: { id: 'contato' }, classify: ['Nome'], conversa: { id: 'sessao', incoming: ['oi'] },
});
await assert.rejects(carregar({
  getContact: async () => ({}), getConversation: async () => { throw new Error('leitura falhou'); },
}, { classifyFields: async () => [] }, { session: {} }, 'sessao'), /leitura falhou/);

const carregarSessao = new AsyncFunction('api', 'page', 'sessionId',
  bloco('const [session, numeroDoCanal]', 'state.session = session;') +
  'return { session, numeroDoCanal };');
for (const numeroDoCanal of [() => { throw new Error('ponte'); }, async () => { throw new Error('ponte'); }]) {
  assert.deepEqual(await carregarSessao({ getSession: async id => ({ id }) }, { numeroDoCanal }, 'sessao'),
    { session: { id: 'sessao' }, numeroDoCanal: '' });
}
console.log('Carregamento concorrente, resultados e falhas: OK');
