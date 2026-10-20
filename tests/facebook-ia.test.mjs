/**
 * A CADEIA do rascunho de comentario: painel -> ia-cliente -> worker.
 *
 * Os testes de `ia.js` provam as pecas puras (o prompt, o esquema, a peneira);
 * este prova o que acontece ENTRE elas, que e onde moram os defeitos que nenhum
 * teste puro ve — o `modo` que nao chega no pedido e cai no esquema da decisao,
 * o campo que o validador descarta, o aviso que se perde no caminho.
 *
 * **A chamada de verdade nao e feita.** O `sendMessage` e trocado por um que
 * devolve o que o teste mandar, entao nada aqui gasta dinheiro nem depende de a
 * API estar no ar — o que se prova e o CONTRATO.
 *
 * Rode: node tests/facebook-ia.test.mjs
 */
import { check, grupo, fim } from './_harness.mjs';
import { rascunharComentario } from '../src/lib/ia-cliente.js';
import { AVISOS_QUE_IMPEDEM_ENVIO } from '../src/lib/ia.js';

/** O ultimo pedido que saiu para o worker, para o teste poder olhar. */
let ultimoPedido = null;

/**
 * Troca o worker por um que devolve `resposta`. Guarda o pedido: metade do que
 * este arquivo prova e o que FOI MANDADO, nao so o que voltou.
 */
function worker(resposta) {
  ultimoPedido = null;
  globalThis.chrome.runtime.sendMessage = async (msg) => {
    ultimoPedido = msg;
    return resposta;
  };
}

/** A resposta feliz, no formato que o worker devolve de verdade. */
const devolve = (decisao, custo = { entrada: 500, saida: 40 }) => ({
  ok: true,
  decisao,
  custo,
});

const PEDIDO = {
  autor: 'Marta Fictinha',
  texto: 'Parabens pelo trabalho de voces, estamos juntos nessa',
  candidato: { nome: 'Capitao Martim', tratamento: 'o Capitao Martim' },
};

grupo('o pedido que sai: modo "comentario" e o prompt do canal');
{
  worker(devolve({ texto: 'Obrigado!', confianca: 0.9, naoResponder: false }));
  const r = await rascunharComentario(PEDIDO);

  /**
   * **O `modo` e a peca que nao pode faltar**, e e a armadilha escrita no
   * proprio `atender`: sem ela o pedido cai no `montarRequisicao` do fim, que e
   * o esquema da DECISAO — a chamada sai PAGA e volta num formato que
   * `validarComentario` nao le, virando "a IA nao respondeu" em silencio.
   */
  check(ultimoPedido?.modo === 'comentario', 'o pedido sai com modo "comentario"');
  check(!!ultimoPedido?.sistema && !!ultimoPedido?.contato, 'leva sistema e contato');

  // O canal e publico: o prompt tem de carregar as proibicoes dele.
  check(/NUNCA peca nome, cidade/i.test(ultimoPedido.sistema), 'o sistema proibe pedir o cadastro');
  check(/mensagem privada/i.test(ultimoPedido.sistema), 'o sistema manda o pedido pessoal para o privado');

  // E o PADRAO do WhatsApp nao pode vazar para ca.
  check(!/PADRAO DE ATENDIMENTO/i.test(ultimoPedido.sistema), 'o padrao do WhatsApp fica fora');

  check(/Marta Fictinha/.test(ultimoPedido.contato), 'o bloco leva o autor');
  check(/Parabens pelo trabalho/.test(ultimoPedido.contato), 'o bloco leva o texto do comentario');

  check(r.texto === 'Obrigado!', 'o texto volta pronto');
  check(r.naoResponder === false, 'naoResponder falso no caminho normal');
  check(r.confianca === 0.9, 'a confianca atravessa a cadeia');
  check(!!r.custo, 'o custo atravessa — e o que alimenta o teto de gasto');
  check(!!r.lidoPelaIA?.contato, 'o "o que a IA leu" volta junto, tambem no sucesso');
}

grupo('naoResponder: a IA pode se abster, e o texto NAO vaza');
{
  worker(devolve({ texto: 'seja la o que ela escreveu', confianca: 0.4, naoResponder: true }));
  const r = await rascunharComentario(PEDIDO);

  check(r.naoResponder === true, 'a abstencao chega ao painel');
  check(r.texto === '', 'o texto e descartado — nao se publica o que ela mandou ignorar');
  check(r.avisos.length === 0, 'abster-se nao e erro, entao nao vira aviso');
}

grupo('falha do worker: vira aviso, nunca texto');
{
  worker({ ok: false, motivo: 'teto de gasto do mes atingido' });
  const r = await rascunharComentario(PEDIDO);

  check(r.texto === '', 'falha nao produz texto');
  /**
   * **O MOTIVO tem de atravessar** — a licao de 07/09: a caixa dizia "a IA nao
   * escreveu nada" (o sintoma) enquanto o motivo real estava a um campo de
   * distancia. Aqui o teto de gasto tem de chegar legivel ate a tela.
   */
  check(r.avisos[0] === 'teto de gasto do mes atingido', 'o motivo do worker chega inteiro');
  check(!!r.lidoPelaIA?.contato, 'o "o que a IA leu" volta mesmo na falha — e quando ele mais precisa');
}

grupo('resposta ilegivel: o painel nao recebe meio rascunho');
{
  worker(devolve({ confianca: 0.9 })); // sem texto e sem naoResponder
  const r = await rascunharComentario(PEDIDO);
  check(r.texto === '', 'JSON sem texto nao vira rascunho');
  // O aviso e escrito COM acento ("legível"); procurar sem nao casa.
  check(/leg[ií]vel/i.test(r.avisos[0] || ''), 'o aviso diz que o formato nao serve');

  worker(devolve(null));
  const nulo = await rascunharComentario(PEDIDO);
  check(nulo.texto === '' && nulo.avisos.length > 0, 'decisao nula tambem e recusada');
}

grupo('as travas do WhatsApp valem aqui — e e por isso que nao foram duplicadas');
{
  /**
   * `rascunharComentario` chama a propria `revisarRascunho`. Se alguem um dia
   * trocar por uma copia, estas assercoes caem — que e o ponto delas.
   */
  worker(devolve({ texto: 'Ja encaminhei seu pedido ao assessor da sua regiao.', confianca: 0.9, naoResponder: false }));
  const acao = await rascunharComentario(PEDIDO);
  check(acao.avisos.includes(AVISOS_QUE_IMPEDEM_ENVIO.afirmouAcao), 'afirmar que ja fizemos e barrado');

  worker(devolve({ texto: 'Vou te enviar o material pelo correio.', confianca: 0.9, naoResponder: false }));
  const promessa = await rascunharComentario(PEDIDO);
  check(promessa.avisos.includes(AVISOS_QUE_IMPEDEM_ENVIO.promessa), 'promessa de entregar e barrada');

  worker(devolve({ texto: 'Como a eleicao ja acabou, nao temos mais agenda.', confianca: 0.9, naoResponder: false }));
  const eleicao = await rascunharComentario(PEDIDO);
  check(
    eleicao.avisos.includes(AVISOS_QUE_IMPEDEM_ENVIO.eleicaoEncerrada),
    'dizer que a eleicao acabou e barrado — o 2o turno e 25/10'
  );

  // E a correcao MECANICA tambem atravessa: o traco eme vira hifen.
  worker(devolve({ texto: 'Obrigado — contamos com voce!', confianca: 0.9, naoResponder: false }));
  const traco = await rascunharComentario(PEDIDO);
  check(!traco.texto.includes('—'), 'o travessao eme e trocado, como no WhatsApp');
}

grupo('a chapa e conferida mesmo sem o dossie no prompt');
{
  /**
   * O modelo escreve os nomes de cabeca — a licao de 08/09, em que ele disse
   * que o Van Hattem era deputado federal porque hoje ele e. Entao a trava NAO
   * pode depender de o dossie ter sido puxado.
   */
  const chapa = [{ cargo: 'Presidente', nome: 'Flavio Bolsonaro', numero: '22' }];

  worker(devolve({ texto: 'O Flavio Bolsonaro e candidato a deputado estadual, vote 22.', confianca: 0.9, naoResponder: false }));
  const errada = await rascunharComentario({ ...PEDIDO, chapa, gabinete: '' });
  check(
    errada.avisos.some((a) => /Flavio Bolsonaro/.test(a)),
    'cargo trocado e acusado sem dossie no prompt'
  );

  worker(devolve({ texto: 'Obrigado pelo apoio!', confianca: 0.9, naoResponder: false }));
  const certa = await rascunharComentario({ ...PEDIDO, chapa, gabinete: '' });
  check(certa.avisos.length === 0, 'texto que nao fala da chapa nao e acusado');
}

grupo('o dossie e as instrucoes dele entram quando existem');
{
  worker(devolve({ texto: 'Obrigado!', confianca: 0.9, naoResponder: false }));
  await rascunharComentario({ ...PEDIDO, gabinete: 'DOSSIE DO MANDATO', regras: 'REGRA EXTRA DELE' });

  check(/DOSSIE DO MANDATO/.test(ultimoPedido.sistema), 'o dossie entra no sistema');
  check(/REGRA EXTRA DELE/.test(ultimoPedido.sistema), 'as instrucoes extras dele entram');

  worker(devolve({ texto: 'Obrigado!', confianca: 0.9, naoResponder: false }));
  const r = await rascunharComentario(PEDIDO);
  check(r.lidoPelaIA.dossie === false, 'sem dossie, a tela diz que nao foi puxado');
  check(r.lidoPelaIA.instrucoesExtras === false, 'idem para as instrucoes extras');
}

fim();
