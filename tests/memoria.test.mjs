/**
 * A memoria que sobrevive quando a conversa se perde.
 *
 * Helena NAO conta: 513 de 600 contatos medidos, e tratar origem como atendimento
 * repetiria o erro da importacao. Importante tambem nao: ninguem definiu essa etiqueta.
 *
 * Rode: node tests/memoria.test.mjs
 */
import { check, grupo, fim } from './_harness.mjs';
import { chaveDoTelefone, provasDeRetorno, pedimosDados, enviosDoTelefone } from '../src/lib/memoria.js';

const FONE = '5551999990001';
const CHAVE = '5199990001';

grupo('a chave do telefone ignora o 55 e o 9 do celular');
{
  check(chaveDoTelefone(FONE) === CHAVE, '55 + DDD + 9 + 8 vira DDD + 8');
  check(chaveDoTelefone('5199990001') === CHAVE, 'sem o 55 cai na mesma chave');
  check(chaveDoTelefone('(51) 99999-0001') === CHAVE, 'mascara nao muda a chave');
  check(chaveDoTelefone('123') === '', 'curto demais nao e telefone');
}

grupo('o que conta como retorno');
{
  const base = { telefone: FONE, etiquetas: [], origem: '', cfg: { origens: [], etiquetas: ['Sem Retorno', 'Sem Interesse'] }, log: {} };
  check(provasDeRetorno(base).retorno === false, 'sem prova, nao e retorno');
  check(provasDeRetorno({ ...base, origem: 'helena' }).retorno === false, 'helena sozinha nao e retorno');
  check(provasDeRetorno({ ...base, origem: 'importacao', cfg: { origens: ['importacao'], etiquetas: [] } }).retorno === false,
    'importacao nunca conta, mesmo se alguem puser na lista');
  check(provasDeRetorno({ ...base, origem: 'evento', cfg: { origens: ['evento'], etiquetas: [] } }).retorno === true,
    'origem so conta quando esta na lista, e evento nao e o padrao');
  check(provasDeRetorno({ ...base, etiquetas: ['Sem Retorno'] }).retorno === true, 'Sem Retorno e trabalho ja feito');
  check(provasDeRetorno({ ...base, etiquetas: ['⛔ 1 SEM RETORNO'] }).retorno === true, 'a grafia do banco casa pela chave');
  check(provasDeRetorno({ ...base, etiquetas: ['Sem Interesse'] }).retorno === true, 'Sem Interesse tambem');
  check(provasDeRetorno({ ...base, etiquetas: ['Importante'] }).retorno === false, 'Importante nao entra');
  check(provasDeRetorno({ ...base, etiquetas: ['_IA'] }).retorno === false, 'etiqueta da propria IA nao entra');

  const log = { [`tel:${CHAVE}|momento`]: { at: 1 } };
  check(provasDeRetorno({ ...base, log }).retorno === true, 'envio anterior para o telefone e retorno');
  check(!/5199990001|5551/.test(provasDeRetorno({ ...base, log }).motivos.join(' ')), 'o motivo nao leva o numero');

  const soPergunta = { [`tel:${CHAVE}|pedir-dados`]: { at: 1 } };
  check(provasDeRetorno({ ...base, log: soPergunta }).retorno === false, 'pergunta nao e entrega');
  check(pedimosDados(soPergunta, FONE) === true, 'mas a pergunta fica registrada');
  check(enviosDoTelefone(soPergunta, FONE).length === 0, 'e nao entra na conta de envio');
}

fim();
