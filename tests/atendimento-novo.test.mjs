/**
 * Abrir um atendimento NOVO por API, e mandar texto nele — o que o envio em lote por etiqueta faz.
 *
 * O que este arquivo protege: o CORPO que a plataforma espera (lido no bundle em 01/10/2026, nunca
 * executado antes), o caso de "ja existe um atendimento" nao virar erro de rodada, e o `senderId`
 * ser um id de correlacao gerado -- a crenca antiga era que ele vinha da conversa, e por isso
 * atendimento recem-criado parecia impossivel de usar.
 *
 * Rode: node tests/atendimento-novo.test.mjs
 */
import { check, grupo, fim, lib } from './_harness.mjs';

const api = await lib('api.js');
import * as lote from '../src/lib/lote.js';

/** O que a plataforma recebeu na ultima chamada, para conferir o corpo. */
let ultima = null;
let resposta = { id: 'sess-1' };
let erro = null;

globalThis.fetch = async (url, opts = {}) => {
  ultima = { url: String(url), metodo: opts.method || 'GET', corpo: opts.body ? JSON.parse(opts.body) : null };
  if (erro) return { ok: false, status: 400, text: async () => JSON.stringify(erro) };
  return { ok: true, status: 200, text: async () => JSON.stringify(resposta) };
};

api.setTransport(api.createFetchTransport(() => 'Bearer fake'));

grupo('o senderId e um id de correlacao GERADO, nao a identidade da conversa');
{
  const a = api.novoSenderId();
  const b = api.novoSenderId();
  check(a !== b, 'cada chamada devolve um id diferente (e por mensagem, nao por sessao)');
  check(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(a), 'no formato uuid v4, como o app faz');
}

grupo('abrir atendimento: o corpo lido no bundle, com PUT');
{
  erro = null;
  resposta = { id: 'sess-99', contactId: 'c-1' };
  const r = await api.abrirAtendimento({ contactId: 'c-1', departmentId: 'eq-2', channelId: 'ch-3' });
  check(r.ok === true, 'devolve ok');
  check(r.sessionId === 'sess-99', 'e o id do atendimento criado');
  check(ultima.metodo === 'PUT', 'PUT cria -- como em createTag, onde POST atualiza');
  check(ultima.url.includes('/chat/v1/session'), 'na rota do bundle');
  check(ultima.corpo.contactId === 'c-1', 'manda o contato');
  check(ultima.corpo.departmentId === 'eq-2', 'a equipe');
  check(ultima.corpo.channelId === 'ch-3', 'e o numero');
  check(ultima.corpo.templateId === null, 'templateId NULO: este caminho e o sem modelo aprovado');
  check(ultima.corpo.compiledTemplate === null, 'e compiledTemplate tambem');
}

grupo('sem equipe escolhida, o campo vai NULO e nao ausente');
{
  await api.abrirAtendimento({ contactId: 'c-1', channelId: 'ch-3' });
  check('departmentId' in ultima.corpo, 'a chave continua no corpo');
  check(ultima.corpo.departmentId === null, 'com valor nulo -- campo omitido num filtro de terceiro e aposta');
}

grupo('o que a rodada NAO pode tratar como defeito');
{
  erro = { text: 'Já existe um atendimento em andamento para este contato' };
  const r = await api.abrirAtendimento({ contactId: 'c-1', channelId: 'ch-3' });
  check(r.ok === false, 'nao abriu');
  check(r.motivo === api.JA_EXISTE_ATENDIMENTO, 'e o motivo e reconhecido, nao um erro solto');
  check(!!r.texto, 'carrega o texto da plataforma para a linha do Andamento');
}

grupo('erro de verdade sobe, para a rodada parar na sonda');
{
  erro = { text: 'Canal nao permite iniciar atendimento' };
  let subiu = false;
  try {
    await api.abrirAtendimento({ contactId: 'c-1', channelId: 'ch-3' });
  } catch (_) {
    subiu = true;
  }
  check(subiu, 'erro desconhecido NAO e engolido: a sonda tem de parar antes do segundo contato');
}

grupo('faltando o essencial, recusa antes de gastar requisicao');
{
  for (const args of [{ channelId: 'ch-3' }, { contactId: 'c-1' }]) {
    let recusou = false;
    try {
      await api.abrirAtendimento(args);
    } catch (_) {
      recusou = true;
    }
    check(recusou, `recusa sem ${args.contactId ? 'numero' : 'contato'}`);
  }
}

grupo('mandar texto na sessao: mesma rota e envelope do envio de imagem');
{
  erro = null;
  resposta = { id: 'msg-1', text: 'Olha a colinha' };
  const r = await api.mandarTexto({ sessionId: 'sess-7', senderId: 'uuid-1', texto: 'Olha a colinha' });
  check(r.id === 'msg-1', 'devolve o id da mensagem');
  check(ultima.metodo === 'PUT' && ultima.url.includes('/chat/v1/session/sess-7/message'), 'a MESMA rota do envio de imagem');
  check(ultima.corpo.type === 'TEXT', 'com o type trocado');
  check(ultima.corpo.direction === 'TO_HUB', 'e a direcao de quem manda');
  check(ultima.corpo.senderId === 'uuid-1', 'usando o senderId que recebeu');

  /**
   * O `status` volta junto desde 02/10/2026: no disparo de SO TEXTO e ele que decide se da para
   * concluir, porque concluir CANCELA mensagem em fila e pela API nao ha dialogo avisando.
   */
  resposta = { id: 'msg-9', text: 'Olha a colinha', status: 'QUEUED' };
  const emFila = await api.mandarTexto({ sessionId: 'sess-7', texto: 'Olha a colinha' });
  check(emFila.status === 'QUEUED', 'o status da mensagem volta para quem for concluir decidir');
  resposta = { id: 'msg-10', text: 'oi' };
  check((await api.mandarTexto({ sessionId: 'sess-7', texto: 'oi' })).status === '', 'sem status, string vazia -- nunca "QUEUED" por acidente');

  resposta = { id: 'msg-2' };
  let acusou = false;
  try {
    await api.mandarTexto({ sessionId: 'sess-7', texto: 'oi' });
  } catch (_) {
    acusou = true;
  }
  check(acusou, '2xx sem o texto de volta NAO conta como enviado -- a armadilha mais antiga daqui');
}

grupo('concluir: corpo VAZIO, como o botao "Concluir" da tela');
{
  erro = null;
  resposta = { id: 'sess-7', status: 'COMPLETED' };
  const r = await api.concluirAtendimento('sess-7');
  check(r.ok === true, 'conclui');
  check(ultima.metodo === 'POST', 'POST -- aqui, ao contrario de abrir, nao e PUT');
  check(ultima.url.includes('/chat/v1/session/sess-7/complete'), 'na rota do complete');
  check(JSON.stringify(ultima.corpo) === '{}', 'corpo VAZIO: o motivo de conclusao e escolha dele por contato, nao de uma rodada');

  resposta = { id: 'sess-7', status: 'IN_PROGRESS' };
  let acusou = false;
  try {
    await api.concluirAtendimento('sess-7');
  } catch (_) {
    acusou = true;
  }
  check(acusou, '2xx com o atendimento ainda em andamento NAO conta como concluido');

  let recusou = false;
  try {
    await api.concluirAtendimento('');
  } catch (_) {
    recusou = true;
  }
  check(recusou, 'sem atendimento, recusa antes de gastar requisicao');
}

grupo('a SONDA do modo de so abrir: reler o atendimento criado');
{
  erro = null;
  resposta = { id: 'sess-99', status: 'IN_PROGRESS', userId: 'u-eu', contactId: 'c-1' };
  const sessao = await api.getSession('sess-99');
  check(ultima.metodo === 'GET', 'e uma LEITURA: a sonda nao escreve nada');
  check(ultima.url.includes('/chat/v1/session/sess-99'), 'na rota da sessao, pelo id que abrir devolveu');
  check(
    lote.ondeCaiuOAtendimento(sessao, 'u-eu').estado === lote.ONDE_MEU,
    'e o veredito le o que voltou -- "ficou em Meus" deixa de ser hipotese'
  );
}

grupo('o meu usuario sai de /core/v1/agent/me, e nao do token');
{
  resposta = { userId: 'u-eu', name: 'operador' };
  const agente = await api.getAgente();
  check(agente.userId === 'u-eu', 'e o campo userId, o mesmo que a contagem de "Meus" usa');
  check(
    ultima.url.includes('/core/v1/agent/me'),
    'descobrir por ali e o que faz funcionar tambem no modo janela, onde o token nao chega ao painel'
  );
}

fim();
