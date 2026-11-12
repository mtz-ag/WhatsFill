/**
 * A leitura do mobiliza.me repete antes de desistir e, desistindo, diz por quê (12/11/2026).
 *
 * Print dele: "Rodada encerrada: 0 enviado(s), 0 pulado(s). conversas → Failed to fetch", com a aba
 * logada. Uma falha só encerrava a rodada, e o texto não dizia rota, status nem o que fazer.
 *
 * Rode: node tests/busca-mob.test.mjs
 */
import { check, grupo, fim, lib } from './_harness.mjs';

const mob = await lib('mob.js');

// A aba: sessão no localStorage, o tenant, o pacote com a chave pública.
const armazenado = {};
globalThis.localStorage = { getItem: (k) => (k in armazenado ? armazenado[k] : null) };
const emUmaHora = Math.floor(Date.now() / 1000) + 3600;
const sessao = (token, expira = emUmaHora) => JSON.stringify({ access_token: token, expires_at: expira, user: { id: 'u-1' } });
armazenado[mob.CHAVE_SESSAO] = sessao('token-velho');
armazenado[mob.CHAVE_TENANT] = 'tenant-exemplo';
globalThis.document = { querySelectorAll: () => [{ getAttribute: () => '/assets/index-abc.js' }] };
// Node 21+ tem `navigator` só com getter: troca pela definição, não pela atribuição.
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });

const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImV4cCI6OTk5OX0.assinaturaexemplo123';
let roteiro = [];
const pedidos = [];
globalThis.fetch = async (url, init = {}) => {
  if (String(url).includes('/assets/')) return { ok: true, status: 200, text: async () => `const k="${JWT}"` };
  pedidos.push({ url: String(url), auth: init.headers?.Authorization });
  const passo = roteiro.shift();
  if (passo instanceof Error) throw passo;
  if (typeof passo === 'function') return passo();
  return passo;
};
const resposta = (status, corpo) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo, text: async () => JSON.stringify(corpo) });
const SEM_ESPERA = { esperas: [0, 0] };

grupo('falha passageira na 1ª tentativa: a busca segue na 2ª');
{
  roteiro = [new TypeError('Failed to fetch'), resposta(200, [{ id: 'c1' }])];
  pedidos.length = 0;
  const linhas = await mob.buscar('conversas', { limite: 5, ...SEM_ESPERA }).catch((e) => e.message);
  check(Array.isArray(linhas) && linhas[0]?.id === 'c1', 'devolveu as linhas da segunda tentativa');
  check(pedidos.length === 2, `duas tentativas: ${pedidos.length}`);

  roteiro = [resposta(503, { message: 'upstream' }), resposta(200, [])];
  check(Array.isArray(await mob.buscar('conversas', SEM_ESPERA).catch(() => null)), '503 também repete');
}

grupo('o token renovado pela aba é relido entre as tentativas (401)');
{
  armazenado[mob.CHAVE_SESSAO] = sessao('token-velho');
  pedidos.length = 0;
  roteiro = [
    () => { armazenado[mob.CHAVE_SESSAO] = sessao('token-novo'); return resposta(401, { message: 'JWT expired' }); },
    resposta(200, [{ id: 'c2' }]),
  ];
  const linhas = await mob.buscar('conversas', SEM_ESPERA).catch((e) => [e.message]);
  check(linhas[0]?.id === 'c2', 'a segunda tentativa funcionou');
  check(pedidos[0].auth === 'Bearer token-velho' && pedidos[1].auth === 'Bearer token-novo', 'e foi com o token novo da aba');
}

grupo('falha persistente: motivo legível, nunca só "Failed to fetch"');
{
  roteiro = [new TypeError('Failed to fetch'), new TypeError('Failed to fetch'), new TypeError('Failed to fetch')];
  pedidos.length = 0;
  let erro = '';
  try { await mob.buscar('conversas', SEM_ESPERA); } catch (e) { erro = e.message; }
  check(pedidos.length === 3, `três tentativas: ${pedidos.length}`);
  check(/^conversas → Failed to fetch em GET \/rest\/v1\/\w+:/.test(erro), `rota na mensagem: ${erro}`);
  check(!/tenant|select=/.test(erro), 'a rota vai sem a query (que leva o tenant e os filtros)');
  check(/3 tentativas/.test(erro) && /Recarregue a aba do Mobiliza/.test(erro), 'diz quantas vezes e o que fazer');
  check(/a resposta não chegou/.test(erro), 'diz o motivo em português');
  const api = await lib('api.js');
  check(api.ehErroDeRede(erro), 'continua reconhecido como engasgo de rede');

  roteiro = [resposta(401, {}), resposta(401, {}), resposta(401, {})];
  try { await mob.buscar('conversas', SEM_ESPERA); } catch (e) { erro = e.message; }
  check(/→ 401 em GET/.test(erro) && /faça login de novo/.test(erro), `401: ${erro}`);

  pedidos.length = 0;
  roteiro = [resposta(400, { message: 'column x does not exist' })];
  try { await mob.buscar('conversas', SEM_ESPERA); } catch (e) { erro = e.message; }
  check(pedidos.length === 1, '400 é defeito: não repete');
  check(/→ 400 em GET .*column x does not exist/.test(erro), `400 traz a mensagem da plataforma: ${erro}`);

  globalThis.navigator.onLine = false;
  roteiro = [new TypeError('Failed to fetch'), new TypeError('Failed to fetch'), new TypeError('Failed to fetch')];
  try { await mob.buscar('conversas', SEM_ESPERA); } catch (e) { erro = e.message; }
  check(/sem internet/.test(erro), `sem internet: ${erro}`);
  globalThis.navigator.onLine = true;

  armazenado[mob.CHAVE_SESSAO] = sessao('vencido', 1000);
  pedidos.length = 0;
  try { await mob.buscar('conversas', SEM_ESPERA); } catch (e) { erro = e.message; }
  check(pedidos.length === 0 && /sessão vencida/.test(erro) && /faça login de novo/.test(erro), `sessão vencida: ${erro}`);
}

grupo('a rodada encerra com o motivo legível');
{
  const pageMob = await lib('page-mob.js');
  const r = await pageMob.openQueueSession(0, { aba: 'Meus', fila: async () => { throw new Error(mob.textoDaFalhaDeBusca('conversas', '/rest/v1/whatsapp_conversas', { tipo: 'rede' }, 3)); } });
  check(!r.ok && /Failed to fetch em GET \/rest\/v1\/whatsapp_conversas/.test(r.reason) && /Recarregue a aba/.test(r.reason), `reason: ${r.reason}`);
}

fim();
