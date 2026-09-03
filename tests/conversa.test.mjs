/**
 * Testa a leitura da conversa (api.getConversation) — quem falou por último e o que o contato
 * escreveu, em UMA requisição.
 *
 * Tem teste próprio porque é ela que autoriza a rodada a **concluir um atendimento sozinha**:
 * se ler errado quem falou por último, o contato é fechado sem resposta. E porque a regra de
 * "mensagem nossa" não é só a direção — operador e bot também são nós.
 *
 * Rode: node tests/conversa.test.mjs
 */

import { check, grupo, fim, lib } from './_harness.mjs';

const api = await lib('api.js');

/** A resposta da plataforma vem em envelope paginado e FORA de ordem — como no ambiente real. */
let ITENS = [];

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('/chat/v1/message')) {
    return { ok: true, status: 200, text: async () => JSON.stringify({ items: ITENS, totalItems: ITENS.length }) };
  }
  return { ok: true, status: 200, text: async () => '{}' };
};

api.setTransport(api.createFetchTransport(() => 'Bearer fake'));

const doContato = (at, text) => ({ direction: 'FROM_HUB', createdAt: at, text });
const nossa = (at, text) => ({ direction: 'TO_HUB', createdAt: at, text, userId: 'u-thiago' });
const doBot = (at, text) => ({ direction: 'TO_HUB', createdAt: at, text, botId: 'b-1' });

grupo('quem falou por último');
{
  ITENS = [
    nossa('2026-08-09T10:00:00Z', 'Bom dia! Que bom ter você com a gente.'),
    doContato('2026-08-09T11:00:00Z', 'Luís Antônio / Palmares do Sul'),
  ];
  let c = await api.getConversation('s-1');
  check(c.ultima.doContato === true, 'a última é do contato');
  check(c.ultima.texto.includes('Palmares'), `texto = ${c.ultima.texto}`);

  ITENS = [
    doContato('2026-08-09T11:00:00Z', 'Luís Antônio / Palmares do Sul'),
    nossa('2026-08-09T11:30:00Z', 'Prontinho! Já anotei.'),
  ];
  c = await api.getConversation('s-1');
  check(c.ultima.doContato === false, 'a última é nossa — é isto que manda a rodada concluir');

  ITENS = [doContato('2026-08-09T11:00:00Z', 'oi'), doBot('2026-08-09T11:05:00Z', 'menu automático')];
  c = await api.getConversation('s-1');
  check(c.ultima.doContato === false, 'mensagem do bot também é nossa');

  ITENS = [];
  c = await api.getConversation('s-1');
  check(c.ultima === null, 'conversa vazia devolve null em vez de estourar');
}

grupo('a ordem vem do createdAt, não do array');
{
  // A API devolve as mais recentes primeiro. Confiar na posição do array invertia a conclusão.
  ITENS = [
    nossa('2026-08-09T11:30:00Z', 'Prontinho!'),
    doContato('2026-08-09T11:00:00Z', 'obrigado'),
    doContato('2026-08-09T10:00:00Z', 'oi'),
  ];
  const c = await api.getConversation('s-1');
  check(c.ultima.texto === 'Prontinho!', `última = ${c.ultima.texto}`);
  check(c.incoming.join('|') === 'oi|obrigado', `entrantes em ordem = ${c.incoming.join('|')}`);
}

grupo('figura não pode sumir da conta');
{
  // Mídia chega sem `text`. A leitura antiga descartava, e uma figura NOSSA fazia a rodada ler
  // a mensagem anterior (do contato) como se ainda fosse a vez dele — perguntava de novo a
  // quem já tinha sido respondido com uma imagem.
  ITENS = [
    doContato('2026-08-09T11:00:00Z', 'me manda o santinho'),
    { direction: 'TO_HUB', createdAt: '2026-08-09T11:10:00Z', userId: 'u-thiago', type: 'IMAGE' },
  ];
  const c = await api.getConversation('s-1');
  check(c.ultima.doContato === false, 'figura nossa continua sendo a última mensagem');
  check(c.ultima.texto === '', 'sem texto, devolve string vazia (não undefined)');
  check(c.incoming.length === 1, 'e ela não entra na lista do que o contato escreveu');

  // Figura do contato é a vez dele: a rodada tem que perguntar, não concluir.
  ITENS = [
    nossa('2026-08-09T11:00:00Z', 'Prontinho!'),
    { direction: 'FROM_HUB', createdAt: '2026-08-09T11:20:00Z', type: 'IMAGE' },
  ];
  const dele = await api.getConversation('s-1');
  check(dele.ultima.doContato === true, 'figura do contato é a vez dele');
}

grupo('getIncomingText continua sendo o que era');
{
  ITENS = [
    doContato('2026-08-09T10:00:00Z', 'oi'),
    nossa('2026-08-09T10:30:00Z', 'bom dia'),
    doContato('2026-08-09T11:00:00Z', 'Maria / Pelotas'),
  ];
  const textos = await api.getIncomingText('s-1');
  check(textos.length === 2 && textos[1] === 'Maria / Pelotas', `só o contato, em ordem = ${JSON.stringify(textos)}`);
}

grupo('a TRANSCRICAO do audio so existe em entrantes -- nunca em incoming (03/09/2026)');
{
  /**
   * Print da Sueli: ela mandou 29 segundos de audio, a plataforma transcreveu na tela, e o rascunho
   * da IA saiu falando de outra coisa. Ele: *"a IA nao pegou o texto transcrito"*.
   *
   * A causa esta aqui: `incoming` filtra `m.text`, e o audio NAO tem `text` -- a transcricao mora
   * em `details.transcription.text`. Quem alimenta a IA com `incoming` a deixa cega para a maior
   * fatia do que a regex nao cobre nesta base.
   *
   * A assimetria e de PROPOSITO e continua: `incoming` e a base do parser, e gravar cidade a partir
   * de fala ouvida por maquina e outra decisao. O teste existe para que quem ler `incoming` saiba
   * que ela nao e a conversa inteira.
   */
  const audio = {
    direction: 'FROM_HUB',
    createdAt: '2026-09-03T14:31:00Z',
    type: 'AUDIO',
    details: { transcription: { text: 'tomara que voces enxerguem as pessoas que nao enxergam' } },
  };
  ITENS = [doContato('2026-09-03T14:30:00Z', 'Ola! Eu apoio'), audio];

  const c = await api.getConversation('s-1');
  check(c.incoming.length === 1, 'incoming NAO traz o audio transcrito');
  check(!c.incoming.join(' ').includes('enxergam'), 'e nao traz a transcricao por nenhuma via');

  check(c.entrantes.length === 2, 'entrantes traz as duas');
  const t = c.entrantes[1];
  check(t.texto.includes('enxergam'), 'com a transcricao no texto');
  check(t.transcrito === true, 'e marcada como transcrita, porque nao foi ela que escreveu');
  check(t.tipo === 'AUDIO', 'com o tipo junto');
}

fim();
