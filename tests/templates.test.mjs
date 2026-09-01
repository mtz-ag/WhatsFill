/**
 * Rotação de variantes das respostas prontas.
 *
 * Nasceu do relato de que reabrir e mandar o MESMO texto repetido para muita gente pode ter
 * pesado no número. `avancarVariante` só é chamada depois que a mensagem SAI de verdade — testar
 * isso importa porque é lógica que decide o texto que vai para um contato real.
 *
 * Rode: node tests/templates.test.mjs
 */
import { check, grupo, fim, lib, mem } from './_harness.mjs';

const templates = await lib('templates.js');
const store = await lib('store.js');

grupo('varianteAtual: sem variantes devolve o texto de sempre');
{
  const t = { id: 'x', text: 'Base.' };
  check((await templates.varianteAtual(t)) === 'Base.', 'sem variantes = texto base');
}

grupo('varianteAtual: pico não avança o ponteiro');
{
  const t = { id: 'y', text: 'V0', variantes: ['V1', 'V2'] };
  const a = await templates.varianteAtual(t);
  const b = await templates.varianteAtual(t);
  check(a === 'V0' && b === 'V0', `duas leituras seguidas continuam na mesma variante (${a}, ${b})`);
}

grupo('avancarVariante: revezamento 0 → 1 → 2 → 0');
{
  const t = { id: 'z', text: 'V0', variantes: ['V1', 'V2'] };
  const vistos = [];
  for (let i = 0; i < 4; i++) {
    vistos.push(await templates.varianteAtual(t));
    await templates.avancarVariante(t);
  }
  check(vistos.join(',') === 'V0,V1,V2,V0', `revezou nesta ordem: ${vistos.join(',')}`);
}

grupo('avancarVariante: cada id tem o próprio ponteiro');
{
  const a = { id: 'ida-a', text: 'A0', variantes: ['A1'] };
  const b = { id: 'ida-b', text: 'B0', variantes: ['B1'] };
  await templates.avancarVariante(a); // a foi para A1; b continua em B0
  check((await templates.varianteAtual(a)) === 'A1', 'a avançou');
  check((await templates.varianteAtual(b)) === 'B0', 'b não foi mexido pelo avanço de a');
}

grupo('migrarVariantesDeTexto: acrescenta a quem já tem a resposta salva, sem editar');
{
  const padrao = store.DEFAULT_TEMPLATES.find((t) => t.id === 'agradecimento');
  mem.templates = [{ id: 'agradecimento', name: padrao.name, text: padrao.text }]; // sem variantes, texto intacto
  mem.migracoes = {};

  const mexidos = await templates.migrarVariantesDeTexto();
  check(mexidos.includes(padrao.name), 'relatou a resposta mexida');

  const salvo = mem.templates.find((t) => t.id === 'agradecimento');
  check(salvo.variantes?.length === padrao.variantes.length, 'ganhou as variantes do padrão');
  check(salvo.text === padrao.text, 'o texto-base não mudou');
}

grupo('migrarVariantesDeTexto: NÃO mexe em resposta que o Thiago reescreveu');
{
  mem.templates = [{ id: 'agradecimento', name: 'Agradecer e encerrar', text: 'Texto que eu escrevi, diferente do padrão.' }];
  mem.migracoes = {};

  await templates.migrarVariantesDeTexto();
  const salvo = mem.templates.find((t) => t.id === 'agradecimento');
  check(!salvo.variantes, 'ficou sem variantes — a base dele diverge do padrão');
  check(salvo.text === 'Texto que eu escrevi, diferente do padrão.', 'o texto dele continua intacto');
}

grupo('migrarVariantesDeTexto: roda uma vez só');
{
  mem.templates = [{ id: 'agradecimento', name: 'Agradecer e encerrar', text: store.DEFAULT_TEMPLATES.find((t) => t.id === 'agradecimento').text }];
  mem.migracoes = {};

  await templates.migrarVariantesDeTexto();
  // Ele apaga as variantes de propósito depois.
  const salvo = mem.templates.find((t) => t.id === 'agradecimento');
  delete salvo.variantes;

  const segunda = await templates.migrarVariantesDeTexto();
  check(segunda === false, 'segunda chamada não faz nada (a flag já estava marcada)');
  check(!mem.templates.find((t) => t.id === 'agradecimento').variantes, 'apagar de propósito não volta sozinho');
}

grupo('todos os templates padrão que têm variantes preservam o que o parser/lei exigem');
{
  const EXIGE = {
    'pedir-dados': /Nome completo \/ Cidade/,
    'interesse-conteudo': /Sim \/ Nome completo \/ Cidade/,
    'sem-retorno-interesse': /Sim \/ Nome completo \/ Cidade/,
  };
  for (const t of store.DEFAULT_TEMPLATES) {
    if (!t.variantes?.length) continue;
    const regra = EXIGE[t.id];
    if (!regra) continue;
    for (const [i, variante] of t.variantes.entries()) {
      check(regra.test(variante), `"${t.id}" variante ${i + 1} mantém o formato que o parser espera`);
    }
  }
  // pedido-ajuda e pedido-emprego ficam de fora de propósito (risco jurídico) — conferido aqui
  // para a decisão não se perder numa reescrita futura sem ninguém perceber.
  check(!store.DEFAULT_TEMPLATES.find((t) => t.id === 'pedido-ajuda').variantes, 'pedido-ajuda sem variantes');
  check(!store.DEFAULT_TEMPLATES.find((t) => t.id === 'pedido-emprego').variantes, 'pedido-emprego sem variantes');
}


grupo('o agradecimento pelo APOIO chega a quem ja tem a lista salva');
{
  const templates = await lib('templates.js');
  const store = await lib('store.js');

  const padrao = store.DEFAULT_TEMPLATES.find((t) => t.id === 'agradecer-apoio');
  check(!!padrao, 'a resposta "agradecer-apoio" existe no padrao');
  check(/apoio/i.test(padrao.text), 'ela agradece o APOIO, e nao as informacoes');
  check(padrao.variantes.length >= 2, 'e tem variantes, como as outras');

  /**
   * Print dele (31/08): atualizou para a 0.48.0 e a tecla 8 nao apareceu. A tecla nao estava
   * faltando — o TEXTO e que nunca tinha chegado. Mudar DEFAULT_TEMPLATES so vale para quem
   * nunca gravou nada; quem ja usa a extensao precisa da migracao.
   */
  mem.migracoes = {};
  mem.templates = [{ id: 'agradecimento', name: 'Agradecer', text: 'Obrigado pela atencao!' }];
  check((await templates.migrarRespostaAgradecerApoio()) === true, 'acrescentou a quem nao tinha');
  check(mem.templates.some((t) => t.id === 'agradecer-apoio'), 'a resposta entrou na lista salva');
  check(mem.templates.length === 2, 'e nao trouxe as outras junto');

  // Roda uma vez so: resposta que ele apagar de proposito nao volta.
  check((await templates.migrarRespostaAgradecerApoio()) === false, 'nao repete na segunda vez');

  // Quem ja tem, nao ganha duplicata.
  mem.migracoes = {};
  mem.templates = [{ id: 'agradecer-apoio', name: 'meu', text: 'MEU TEXTO' }];
  await templates.migrarRespostaAgradecerApoio();
  check(mem.templates.length === 1, 'nao duplica quem ja tem');
  check(mem.templates[0].text === 'MEU TEXTO', 'e nao sobrescreve o texto dele');
}


grupo('a pergunta "em que posso ajudar" chega a quem ja tem a lista salva');
{
  const templates = await lib('templates.js');
  const store = await lib('store.js');

  const padrao = store.DEFAULT_TEMPLATES.find((t) => t.id === 'perguntar-como-ajudar');
  check(!!padrao, 'a resposta existe no padrao');

  /**
   * **O que este texto NAO faz e o que importa.** Promessa em ano eleitoral e o risco que a Lei
   * 9.504/97 trata (art. 41-A, art. 73 §10). Uma pergunta nao e promessa — mas se o texto
   * escorregar para "vou ver o que posso fazer", passa a ser.
   */
  check(!/vou (ver|tentar|providenciar|conseguir)/i.test(padrao.text), 'nao promete providenciar nada');
  check(!/(cesta|dinheiro|emprego|vaga|curr[ií]culo)/i.test(padrao.text), 'nao cita bem nem emprego');
  check(/em que voc[eê] precisa de ajuda/i.test(padrao.text), 'e pergunta o que ela precisa');
  check(!/\{\{primeiro_nome\}\}|\{\{nome\}\}/.test(padrao.text), 'sem vocativo, como todo o resto');

  mem.migracoes = {};
  mem.templates = [{ id: 'agradecimento', name: 'Agradecer', text: 'Obrigado!' }];
  check((await templates.migrarRespostaPerguntarAjuda()) === true, 'acrescentou a quem nao tinha');
  check(mem.templates.some((t) => t.id === 'perguntar-como-ajudar'), 'entrou na lista salva');
  check((await templates.migrarRespostaPerguntarAjuda()) === false, 'nao repete na segunda vez');
}


grupo('as duas respostas do convite de evento');
{
  const templates = await lib('templates.js');
  const store = await lib('store.js');

  const nao = store.DEFAULT_TEMPLATES.find((x) => x.id === 'pedir-dados-evento-nao');
  const sim = store.DEFAULT_TEMPLATES.find((x) => x.id === 'pedir-dados-evento-sim');
  check(!!nao && !!sim, 'as duas existem no padrao');

  // Os textos sao dele, palavra por palavra (01/09).
  check(/Sem problema!/.test(nao.text), 'a negativa comeca com Sem problema');
  check(/carinho e pelo apoio/.test(nao.text), 'e agradece o carinho');
  check(/Que bom!/.test(sim.text), 'a positiva comeca com Que bom');
  check(/presença é muito importante/.test(sim.text), 'e diz que a presenca importa');

  /**
   * **O que o PARSER precisa e o separador e o exemplo**, nao a frase inteira.
   *
   * O `pedir-dados` de FABRICA usa "Nome completo / Cidade" e ainda pede link de grupo — ele
   * editou o dele para "Para eu poder salvar seu contato me passe seu: *Nome / Cidade*", que e o
   * que aparece nas prints. Os dois textos do evento seguem o DELE.
   *
   * O que nao pode mudar e o formato "X / Y" com o exemplo: e dele que sai a precisao do
   * `respostaAoPedido`, e trocar isso quebraria a leitura do nome e da cidade sem avisar.
   */
  for (const [rotulo, txt] of [['negativa', nao.text], ['positiva', sim.text]]) {
    check(txt.includes('Nome / Cidade'), rotulo + ': pede no formato "Nome / Cidade"');
    check(txt.includes('exemplo: Maria Silva / Santo'), rotulo + ': traz o exemplo que o parser espera');
  }

  // A migracao leva as duas a quem ja tem a lista salva.
  mem.migracoes = {};
  mem.templates = [{ id: 'agradecimento', name: 'x', text: 'y' }];
  check((await templates.migrarRespostasDeEvento()) === true, 'acrescentou a quem nao tinha');
  check(mem.templates.filter((x) => x.id.startsWith('pedir-dados-evento')).length === 2, 'as duas entraram');
  check((await templates.migrarRespostasDeEvento()) === false, 'nao repete na segunda vez');
}

fim();
