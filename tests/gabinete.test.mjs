/**
 * Testa a regra que decide QUANDO o dossiê "quem é quem" vale o custo.
 *
 * Pedido dele (01/09/2026): *"o dossiê deve ser consultado somente quando for necessário"*. O
 * dossiê custa ~1.284 tokens em toda chamada, e quase toda conversa é "Amém", "obrigado", nome e
 * cidade — nenhuma delas precisa saber quem é vice de quem.
 *
 * A regra erra para o lado de INCLUIR: sem dossiê a IA decide sobre nome que não conhece, que é o
 * problema que ele existe para resolver; incluir à toa custa meio centavo.
 */

import { check, grupo, fim, lib } from './_harness.mjs';

const { precisaDoDossie } = await lib('gabinete.js');

grupo('NÃO precisa: a conversa comum, que é a maioria');
{
  check(!precisaDoDossie(['Amém 🙏 🙏']), 'amém');
  check(!precisaDoDossie(['Obrigado pela atenção']), 'agradecimento');
  check(!precisaDoDossie(['Maria Silva / Canoas']), 'resposta ao formulário');
  check(!precisaDoDossie(['Erechim rgds']), 'só a cidade');
  check(!precisaDoDossie(['Bom dia!']), 'saudação');
  check(!precisaDoDossie(['Preciso de ajuda com uma cesta básica']), 'pedido de ajuda (escala por outra regra, não precisa do dossiê)');
  check(!precisaDoDossie([]), 'sem mensagem');
  check(!precisaDoDossie(['']), 'mensagem vazia');
}

grupo('PRECISA: quando a decisão depende de saber quem é quem');
{
  check(precisaDoDossie(['Qual é o número dele para eu votar?']), 'pergunta o número');
  check(precisaDoDossie(['vou votar no Zucco']), 'cita nome da chapa');
  check(precisaDoDossie(['O Capitão Martim é candidato a quê?']), 'pergunta o cargo');
  check(precisaDoDossie(['ele é de qual partido?']), 'pergunta o partido');
  check(precisaDoDossie(['quem é o vice do Zucco?']), 'pergunta quem é quem');
  check(precisaDoDossie(['Digito 22 na urna?']), 'fala em urna');
  check(precisaDoDossie(['esse deputado apoia quem para governador?']), 'cargo e apoio');
  check(precisaDoDossie(['sou do Republicanos']), 'cita o partido pelo nome');
}

grupo('acento não pode furar o gatilho');
{
  // O texto é normalizado antes: "eleição" e "eleicao" têm que dar o mesmo resultado. É a
  // armadilha do `\b` antes de palavra acentuada, registrada no CLAUDE.md.
  check(precisaDoDossie(['quando é a eleição?']), 'com acento');
  check(precisaDoDossie(['quando e a eleicao?']), 'sem acento');
  check(precisaDoDossie(['CAPITÃO MARTIM']), 'caixa alta com acento');
}

fim();
