/**
 * A recomendação da rodada: qual opção sai destacada, e por quê.
 *
 * O que este arquivo protege é a ORDEM. As regras são uma lista e a primeira que casa vence —
 * então acrescentar uma situação no lugar errado muda silenciosamente o que é recomendado para
 * milhares de contatos. Cada teste aqui fixa uma prioridade que foi decidida de propósito.
 *
 * Rode: node tests/sugestao.test.mjs
 */
import { check, grupo, fim } from './_harness.mjs';
import { sugerirAcao, REGRAS } from '../src/lib/sugestao.js';

/** Retrato de um contato "sem nada": nenhuma regra deveria casar por acidente. */
const base = {
  temEtiquetaDeCidade: true,
  podePedirDados: true,
  pedidoHoje: false,
  podeEnviar: false,
  enviadoHoje: false,
  conteudoPedido: '',
  podePerguntarInteresse: false,
  interessePerguntado: false,
};
const com = (mudanca) => sugerirAcao({ ...base, ...mudanca });

grupo('sem etiqueta de cidade: pedir dados, e na frente de tudo');
{
  const r = com({ temEtiquetaDeCidade: false });
  check(r?.tecla === '4', `recomendou a tecla 4 = ${JSON.stringify(r)}`);
  check(/filtro/.test(r?.motivo || ''), `o motivo diz por que importa = ${r?.motivo}`);

  // A prioridade que ele pediu: "sempre pedir dados" vence até o conteúdo pedido.
  const comConteudo = com({ temEtiquetaDeCidade: false, podeEnviar: true, conteudoPedido: 'Conteúdo Flávio' });
  check(comConteudo?.tecla === '4', 'sem cidade vence o modelo a enviar');

  // Mas não recomenda pedir DE NOVO no mesmo dia.
  const jaPedi = com({ temEtiquetaDeCidade: false, pedidoHoje: true });
  check(jaPedi?.tecla !== '4', `já pedido hoje não recomenda pedir de novo = ${JSON.stringify(jaPedi)}`);

  // Sem a opção na tela (texto travado por variável), não adianta recomendá-la.
  check(com({ temEtiquetaDeCidade: false, podePedirDados: false })?.tecla !== '4', 'opção indisponível não é recomendada');
}

grupo('com cidade: manda o conteúdo pedido');
{
  const r = com({ podeEnviar: true, conteudoPedido: 'Conteúdo Zucco' });
  check(r?.tecla === '1', `recomendou a tecla 1 = ${JSON.stringify(r)}`);
  check(/Zucco/.test(r?.motivo || ''), `o motivo nomeia o conteúdo = ${r?.motivo}`);

  // Enviado hoje perde o destaque: repetir tem que ser decisão, não inércia.
  check(com({ podeEnviar: true, enviadoHoje: true })?.tecla !== '1', 'enviado hoje não é recomendado de novo');
}

grupo('nunca perguntaram o interesse');
{
  const r = com({ podePerguntarInteresse: true });
  check(r?.tecla === '7', `recomendou a tecla 7 = ${JSON.stringify(r)}`);
  check(com({ podePerguntarInteresse: true, interessePerguntado: true })?.tecla !== '7', 'já perguntado não repete');

  // Conteúdo a enviar vence a pergunta de interesse.
  check(com({ podePerguntarInteresse: true, podeEnviar: true })?.tecla === '1', 'modelo vence a pergunta');
}

grupo('já pedi hoje e não veio nada: concluir');
{
  const r = com({ temEtiquetaDeCidade: false, pedidoHoje: true });
  check(r?.tecla === '3', `recomendou concluir = ${JSON.stringify(r)}`);
}

grupo('nenhuma regra casa: nenhum destaque');
{
  check(sugerirAcao(base) === null, 'contato sem situação conhecida não recebe recomendação');
  check(sugerirAcao(null) === null, 'contexto nulo não explode');
  check(sugerirAcao({}) === null, 'contexto vazio não inventa recomendação');
}

grupo('a lista de regras se mantém sã');
{
  check(REGRAS.length > 0, `tem regra = ${REGRAS.length}`);
  check(REGRAS.every((r) => r.id && r.tecla && typeof r.quando === 'function' && typeof r.motivo === 'function'),
    'toda regra tem id, tecla, quando e motivo');
  check(new Set(REGRAS.map((r) => r.id)).size === REGRAS.length, 'nenhum id repetido');

  // Regra que estoura não pode derrubar a rodada — ela só deixa de sugerir.
  const original = REGRAS[0].quando;
  REGRAS[0].quando = () => { throw new Error('regra quebrada'); };
  check(sugerirAcao({ ...base, podeEnviar: true })?.tecla === '1', 'regra quebrada é pulada, a seguinte vale');
  REGRAS[0].quando = original;
}

fim();
