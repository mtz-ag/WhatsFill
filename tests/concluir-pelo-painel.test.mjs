/**
 * Concluir pelo painel fora da rodada, e a data de conclusão que saiu (12/11/2026).
 *
 *  - a Dirce: "Classificado, mas undefined. Conclua na aba." — o resolver da plataforma nova
 *    devolvia só `{ok, estado}` e o painel lia `reason`;
 *  - o Gilmar e a Simone: "nao esta renderizada na lista" depois de enviar — a conversa JÁ estava
 *    resolvida; quem falhou foi abrir a seguinte, e a mensagem os misturava;
 *  - fora da rodada o concluir ia SEM id, e sem id a guarda exige os dois sinais da tela.
 *
 * Rode: node tests/concluir-pelo-painel.test.mjs
 */
import { readFileSync } from 'node:fs';
import { check, grupo, fim, lib } from './_harness.mjs';

const apiMob = await lib('api-mob.js');
const fields = await lib('fields.js');
const painel = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');
const apiMobTexto = readFileSync(new URL('../src/lib/api-mob.js', import.meta.url), 'utf8');

grupo('o resolver que falha diz POR QUE, nunca "undefined"');
{
  const { motivoDoResolver } = apiMob;
  const aberta = motivoDoResolver({ ok: false, estado: 'aberto' });
  check(/aguardando atendente/.test(aberta) && !/undefined/.test(aberta), `aberta: ${aberta}`);
  const emAtendimento = motivoDoResolver({ ok: false, estado: 'em_atendimento' });
  check(/ainda em atendimento/.test(emAtendimento), `em atendimento: ${emAtendimento}`);
  const semLeitura = motivoDoResolver({ ok: null, estado: 'nao-da-para-saber' });
  check(/n[aã]o consegui reler/.test(semLeitura), `sem releitura: ${semLeitura}`);
  const comRecusa = motivoDoResolver({ ok: false, estado: 'em_atendimento' }, { ok: false, message: 'conversa de outro atendente' });
  check(/conversa de outro atendente/.test(comRecusa), 'a recusa da funcao do banco vai junto');
  check(!/undefined/.test(motivoDoResolver({ ok: false })), 'sem estado nenhum, ainda sem "undefined"');
  check(/reason: r\.ok \? '' : motivoDoResolver\(r, resposta\)/.test(apiMobTexto),
    'resolverConversa devolve o motivo junto do estado');
  check(/const resposta = await rpc\(mob\.RPCS\.resolver/.test(apiMobTexto),
    'e guarda o corpo da funcao do banco em vez de jogar fora');
}

grupo('fora da rodada, o concluir leva o id da conversa que o painel carregou');
{
  const corpo = painel.slice(painel.indexOf('function idDaConversaParaConcluir'), painel.indexOf('function agendarContagem'));
  check(/idQueARodadaAbriu \|\| \(naPlataformaNova\(\) \? String\(state\.session\?\.id/.test(corpo),
    'sem a rodada, usa state.session.id (so na plataforma nova)');
  check(/const id = idDaConversaParaConcluir\(\);/.test(corpo), 'concluirPeloPainel usa esse id');
  check(/r\.reason = r\.motivo \|\|/.test(corpo), 'e completa o motivo quando a plataforma nao deu um');
}

grupo('concluir e abrir o proximo sao dois atos na mensagem');
{
  const corpo = painel.slice(painel.indexOf('async function concluirEAbrirProximo'), painel.indexOf('async function runPedirDados'));
  check(/Não abri o próximo: \$\{proximo\.reason \|\| /.test(corpo), 'falha do proximo nao parece falha do concluir');
  check(/const abriu = !!\(proximo\.changed \|\| proximo\.ok\)/.test(corpo), 'a plataforma nova devolve ok, nao changed');
}

grupo('a data de conclusao / primeiro contato saiu');
{
  check(!/withCompletionDate/.test(painel), 'nenhuma chamada passa withCompletionDate');
  check(!/COMPLETION_FIELD/.test(painel), 'o painel nao le nem grava o campo da data');
  check(!/primeiroContatoDoContato|dataDeConclusaoAtual|learnDateContract/.test(painel), 'as funcoes de apoio sairam');
  for (const nome of ['deveGravarPrimeiroContato', 'primeiroContato', 'diaLocalDe', 'COMPLETION_FIELD']) {
    check(!(nome in fields), `fields.js nao exporta mais ${nome}`);
  }
  check(/const essenciais = \['Cidade'\];/.test(painel), 'a data deixou de ser campo essencial da conferencia');
  check(/tirarSemRetorno: true/.test(painel), 'a retirada do "sem retorno" continua ao concluir');
}

fim();
