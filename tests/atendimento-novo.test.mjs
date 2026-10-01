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

  resposta = { id: 'msg-2' };
  let acusou = false;
  try {
    await api.mandarTexto({ sessionId: 'sess-7', texto: 'oi' });
  } catch (_) {
    acusou = true;
  }
  check(acusou, '2xx sem o texto de volta NAO conta como enviado -- a armadilha mais antiga daqui');
}

fim();
