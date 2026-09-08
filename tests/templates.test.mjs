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

grupo('ehPedidoDeDados — reconhece pelo INVARIANTE, não pela redação (01/09/2026)');
{
  /**
   * Print da Loreta: ela recebeu o pedido de dados numa redação ANTIGA em 31/08, respondeu com
   * nome e cidade, e recebeu a mensagem do momento em vez do modelo que nunca tinha recebido.
   * O painel decidia "isso foi uma pergunta?" comparando com o texto ATUAL do template — e a
   * redação dela já não existia.
   */
  const { ehPedidoDeDados } = templates;
  const storeLib = store;
  const antiga =
    'Boa tarde! Que bom ter você com a gente. Para eu poder salvar seu contato me passe seu: ' +
    'Nome / Cidade (exemplo: Maria Silva / Santo Ângelo)';
  check(ehPedidoDeDados(antiga), 'a redação ANTIGA que a Loreta recebeu é reconhecida');

  const atual = storeLib.DEFAULT_TEMPLATES.find((t) => t.id === 'pedir-dados');
  check(ehPedidoDeDados(atual.text), 'o texto atual do pedir-dados');
  (atual.variantes || []).forEach((v, i) => {
    check(ehPedidoDeDados(v), `a variante ${i + 1} do pedir-dados`);
  });
  check(ehPedidoDeDados(storeLib.INTERESSE_CONTEUDO), 'a pergunta de interesse (Sim / Nome completo / Cidade)');

  // O que NÃO pode ser confundido com pergunta: se virar, o contato deixa de receber o modelo.
  check(!ehPedidoDeDados("O RIO GRANDE VAI MOSTRAR A SUA FORCA! No dia 2 tem carreata"), "modelo de conteúdo não é pergunta");
  check(!ehPedidoDeDados("Obrigado pela atenção! Qualquer coisa é só chamar por aqui."), "agradecimento não é pergunta");
  check(!ehPedidoDeDados("Boa tarde! Que Deus abençoe o seu dia e a sua família."), "mensagem do momento não é pergunta");
  check(!ehPedidoDeDados(""), "vazio");
  check(!ehPedidoDeDados(null), "nulo não explode");
}


grupo('pedir-dados: "antes de qualquer coisa" (01/09/2026)');
{
  const padrao = store.DEFAULT_TEMPLATES.find((t) => t.id === 'pedir-dados');
  const versoes = [padrao.text, ...padrao.variantes];

  // O invariante que o parser e o `ehPedidoDeDados` dependem, nas TRES versoes.
  for (const [i, v] of versoes.entries()) {
    check(/Nome completo \/ Cidade/.test(v), `versao ${i} mantem a linha "Nome completo / Cidade"`);
    check(templates.ehPedidoDeDados(v), `versao ${i} continua sendo reconhecida como o pedido de dados`);
    check(/antes de (qualquer coisa|mais nada)/i.test(v), `versao ${i} pede antes de explicar`);
    check(!/\{\{primeiro_nome\}\}|\{\{nome\}\}/.test(v), `versao ${i} continua sem vocativo`);
  }
}

grupo('migrarPedirDadosAntesDeTudo: so mexe em quem tem o texto de fabrica');
{
  const padrao = store.DEFAULT_TEMPLATES.find((t) => t.id === 'pedir-dados');
  const antigo =
    '{{saudacao}}! Que bom ter voce com a gente.\n\n' +
    store.PEDIR_DADOS_MIOLO_ANTIGO[0] +
    '\n\nNome completo / Cidade\n\n(exemplo: Maria Silva / Santo Angelo)';

  // Quem ainda tem o texto de fabrica RECEBE o novo.
  mem.migracoes = {};
  mem.templates = [{ id: 'pedir-dados', name: 'Pedir dados (formato fixo)', text: antigo, variantes: [] }];
  check((await templates.migrarPedirDadosAntesDeTudo()) === true, 'mexeu em quem tinha o texto antigo');
  check(mem.templates[0].text === padrao.text, 'e o texto virou o novo');

  /**
   * **A assercao que importa.** Reescrever por cima do que ele escreveu e o erro que nenhuma
   * migracao pode cometer -- ele passa o dia ajustando esses textos.
   */
  mem.migracoes = {};
  const dele = 'Oi! Me manda por favor:\n\nNome completo / Cidade';
  mem.templates = [{ id: 'pedir-dados', name: 'Pedir dados (formato fixo)', text: dele, variantes: [] }];
  check((await templates.migrarPedirDadosAntesDeTudo()) === false, 'nao mexe no texto que ele reescreveu');
  check(mem.templates[0].text === dele, 'e o texto dele fica intacto');

  // Roda uma vez so.
  mem.migracoes = {};
  mem.templates = [{ id: 'pedir-dados', name: 'x', text: antigo, variantes: [] }];
  await templates.migrarPedirDadosAntesDeTudo();
  mem.templates[0].text = 'EU MEXI DEPOIS';
  check((await templates.migrarPedirDadosAntesDeTudo()) === false, 'segunda chamada nao faz nada');
  check(mem.templates[0].text === 'EU MEXI DEPOIS', 'e nao desfaz a edicao posterior dele');
}


grupo('pedir-dados: a pergunta dos grupos saiu (01/09/2026)');
{
  const padrao = store.DEFAULT_TEMPLATES.find((t) => t.id === 'pedir-dados');
  const versoes = [padrao.text, ...padrao.variantes];

  /**
   * *"nao tem necessidade de perguntar por grupos, ninguem estava me dando links"* — decisao dele,
   * medida no trabalho. A mensagem e um portao curto: pede os dois dados e conclui.
   */
  for (const [i, v] of versoes.entries()) {
    check(!/grupo pol[ií]tico/i.test(v), `versao ${i} nao pergunta mais por grupo`);
    check(!/link de convite/i.test(v), `versao ${i} nao pede link de convite`);
    check(/Nome completo \/ Cidade/.test(v), `versao ${i} mantem o invariante do parser`);
  }

  /**
   * **`migrarPerguntaGrupos` nao pode estar na fila.** Ela ACRESCENTA a pergunta em quem nao a tem:
   * numa instalacao nova, desfaria a remocao no primeiro carregamento.
   */
  mem.migracoes = {};
  mem.templates = [{ id: 'pedir-dados', name: 'x', text: padrao.text, variantes: [] }];
  await templates.list();
  check(!/grupo pol[ií]tico/i.test(mem.templates[0].text), 'depois de list(), a pergunta continua fora');
}

grupo('quem ja recebeu a versao COM grupos recebe a versao sem');
{
  const padrao = store.DEFAULT_TEMPLATES.find((t) => t.id === 'pedir-dados');

  // A v1: mesmo miolo, mas com a pergunta dos grupos pendurada no fim.
  const v1 = padrao.text + '\n\n' + store.PERGUNTA_GRUPOS;
  mem.migracoes = {};
  mem.templates = [{ id: 'pedir-dados', name: 'Pedir dados (formato fixo)', text: v1, variantes: [] }];

  check((await templates.migrarPedirDadosAntesDeTudo()) === true, 'reconheceu a v1 como texto de fabrica');
  check(!/grupo pol[ií]tico/i.test(mem.templates[0].text), 'e tirou a pergunta dos grupos');

  // E continua sem tocar no que ele escreveu.
  mem.migracoes = {};
  const dele = 'Oi! Me manda:\n\nNome completo / Cidade\n\nE me diz de qual grupo político você faz parte.';
  mem.templates = [{ id: 'pedir-dados', name: 'x', text: dele, variantes: [] }];
  await templates.migrarPedirDadosAntesDeTudo();
  check(mem.templates[0].text === dele, 'texto reescrito por ele fica intacto, com grupo e tudo');
}

grupo('"Confirmou presenca (so agradecer)": a metade que faltava (02/09/2026)');
{
  /**
   * Diagnostico dele, depois de o mesmo contato receber o pedido de cadastro duas vezes:
   * *"provavelmente pode ser o problema do padrao de mensagem, ela ja vem incluso pedindo dados;
   * se usar a mensagem rapida sempre ira pedir os dados"*.
   *
   * As duas respostas de evento FUNDEM confirmacao e pedido de dados, e nao havia versao so com a
   * primeira metade. Este teste trava a propriedade que faz o texto novo existir.
   */
  const todos = store.DEFAULT_TEMPLATES;
  const so = todos.find((t) => t.id === 'presenca-confirmada');
  check(!!so, 'a resposta "presenca-confirmada" existe de fabrica');

  /**
   * **A assercao que importa.** Se este texto virar um pedido de dados numa reescrita futura, o
   * defeito volta inteiro — e volta calado, porque a tecla continua se chamando "agradecer a
   * presenca". Vale para o texto base E para cada variante.
   */
  check(!templates.ehPedidoDeDados(so.text), 'o texto base NAO pede nome e cidade');
  for (const v of so.variantes || []) {
    check(!templates.ehPedidoDeDados(v), `a variante tambem nao pede: "${String(v).slice(0, 34)}..."`);
  }

  // As duas de evento continuam PEDINDO -- e por isso que a terceira precisou existir.
  const sim = todos.find((t) => t.id === 'pedir-dados-evento-sim');
  const nao = todos.find((t) => t.id === 'pedir-dados-evento-nao');
  check(templates.ehPedidoDeDados(sim.text), 'a de evento com "sim" continua pedindo os dados');
  check(templates.ehPedidoDeDados(nao.text), 'a de evento com "nao" continua pedindo os dados');

  // Nao promete nada: quem confirmou presenca ja fez a parte dela (Lei 9.504/97, e bom senso).
  const proibido = /(cesta|rem[ée]dio|dinheiro|emprego|vaga|benef[ií]cio|ajuda financeira)/i;
  check(!proibido.test(so.text), 'nao promete beneficio nenhum');

  // Sem variavel de template: texto que trava por variavel faltando some a tecla da tela.
  check(!/\{\{/.test(so.text), 'nao depende de variavel, entao a tecla nunca some por isso');
}

{
  grupo('o pedido que vai junto da mensagem do momento (04/09/2026)');

  /**
   * Print dele: o contato mandou uma imagem de bom dia as 08:18 e recebeu, treze horas depois, o
   * formulario seco -- *"soltou sem contexto nenhum"*. A ideia e dele: *"sera a mensagem do
   * momento + notei que estou sem seu nome aqui nos meus contatos e nao sei de onde voce e"*.
   *
   * **A linha `Nome , Cidade` e o que este teste protege.** Sem ela o texto continua saindo e o
   * defeito e calado: a resposta dela deixa de ser lida como resposta ao formulario, e a rodada
   * pede os dados mais uma vez. Foi o que custou tres anotacoes quando o separador do template
   * mudou de barra para virgula.
   */
  const auto = await store.get('auto');
  const junto = auto.pedidoJuntoDoMomento;

  check(!!junto, 'o texto nasce preenchido');
  check(templates.ehPedidoDeDados(junto), 'e carrega o invariante "Nome , Cidade"');
  check(!/\{\{/.test(junto), 'nao depende de variavel, entao a tecla 5 nao some por isso');

  // Ele vai COLADO na mensagem do momento -- e o conjunto tambem tem que ser reconhecido.
  const comMomento = `Bom dia! Que hoje seja um dia leve.\n\n${junto}`;
  check(templates.ehPedidoDeDados(comMomento), 'e o texto inteiro, com a mensagem do momento na frente, tambem');

  // Nao promete nada: e um pedido de cadastro, nao uma oferta.
  check(!/(cesta|rem[ée]dio|dinheiro|emprego|vaga|benef[ií]cio)/i.test(junto), 'nao promete beneficio nenhum');
}

{
  grupo('ehPedidoDeEndereco — o pedido que ABRE o caso de material (04/09/2026)');

  /**
   * Relato dele: *"pedi o endereco pelo modelo e nao etiquetou e concluiu"*. A marca existia so
   * para quando ELA responde com um endereco -- mas quem abre o caso e o NOSSO pedido, e e dele
   * que sai a lista que ele transfere no fim do dia.
   *
   * O texto abaixo e o modelo aprovado que ele mandou, palavra por palavra: e a redacao da
   * plataforma, que muda sem passar por nos -- e por isso o reconhecimento e por INVARIANTE.
   */
  const modelo = [
    'Ola! Que bom saber do seu interesse em receber materiais de campanha do Capitao Martim!',
    '',
    'Para encaminharmos seu pedido ao assessor responsavel pela sua regiao, por favor, me informe',
    'seu endereco completo (rua, numero, bairro e cidade).',
    '',
    'Assim, conseguimos direcionar o atendimento para a pessoa responsavel pela sua regiao. Um abraco!',
  ].join('\n');

  check(templates.ehPedidoDeEndereco(modelo), 'o modelo aprovado que ele usa e reconhecido');
  check(templates.ehPedidoDeEndereco('me passa o seu endereco completo por favor'), 'a forma curta, com "endereco completo"');
  check(templates.ehPedidoDeEndereco('qual seu endereco? rua, numero e bairro'), 'e a enumeracao rua + numero + bairro');

  /**
   * **Os falsos negativos importam mais que os positivos aqui**: a funcao so ve texto NOSSO, entao
   * errar para o lado de nao reconhecer significa concluir o atendimento de quem ia mandar o
   * endereco -- que e exatamente a anotacao dele.
   */
  check(!templates.ehPedidoDeEndereco('Para eu poder salvar seu contato me diga seu: Nome , Cidade'), 'o pedido de nome e cidade NAO e pedido de endereco');
  check(!templates.ehPedidoDeEndereco('Obrigado pela atencao! Qualquer coisa e so chamar'), 'nem o agradecimento');
  check(!templates.ehPedidoDeEndereco('moro na rua das flores 123, bairro centro'), 'nem um endereco escrito por ela');
  check(!templates.ehPedidoDeEndereco(''), 'texto vazio nao quebra');

  // As duas coisas andam juntas no mesmo caso, mas sao perguntas diferentes.
  const auto2 = await store.get('auto');
  check(!templates.ehPedidoDeEndereco(auto2.pedidoJuntoDoMomento), 'o pedido de nome e cidade do momento tambem nao conta como endereco');
}

{
  grupo('boas-vindas de quem chega sem anuncio (04/09/2026)');

  /**
   * Decisao dele: *"se ela chegou cumprimentando, podemos mandar uma mensagem: bem-vindo, voce esta
   * falando com o gabinete do Capitao Martim, em que podemos ajudar? E se puder nos forneca seu
   * nome e cidade para melhor atende-lo"*.
   */
  const bv = store.DEFAULT_TEMPLATES.find((t) => t.id === 'boas-vindas');
  check(!!bv, 'a resposta existe entre as de fabrica');
  check(templates.ehPedidoDeDados(bv.text), 'carrega o invariante "Nome , Cidade"');
  for (const v of bv.variantes || []) check(templates.ehPedidoDeDados(v), 'e a variante tambem');
  /**
   * INVERTIDA em 07/09/2026. Ela exigia a palavra "gabinete" — *"diz de quem e o gabinete, e o
   * contexto que faltava"* —, e o contexto continua sendo obrigatorio: o que mudou foi COMO este
   * mandato se apresenta. Decisao dele: *"nao se refira mais a gabinete, se refira como assessoria
   * ou equipe"*. Travar a palavra antiga faria a regra dele voltar atras no proximo teste verde.
   */
  check(/(equipe|assessoria) do Capit/i.test(bv.text), 'diz de quem e a equipe -- e o contexto que faltava');
  check(!/gabinete/i.test(bv.text), 'e nao diz "gabinete", que saiu do vocabulario');
  check(!/(cesta|rem[ée]dio|dinheiro|emprego|vaga|benef[ií]cio)/i.test(bv.text), 'nao promete beneficio nenhum');

  /**
   * **Chega em quem JA tem a lista salva.** Mudar DEFAULT_TEMPLATES sozinho so alcanca instalacao
   * nova -- e existe uma so, a dele. E a licao de 04/09, o dia em que uma regra dele ficou parada
   * num valor padrao.
   */
  mem.templates = [{ id: 'pedir-dados', name: 'x', text: 'Nome , Cidade', variantes: [] }];
  mem.migracoes = {};
  await templates.migrarRespostaBoasVindas();
  check(mem.templates.some((t) => t.id === 'boas-vindas'), 'a migracao acrescenta a resposta em quem ja tinha lista salva');

  // E nao volta depois que ele apagar: a migracao roda uma vez so.
  mem.templates = [{ id: 'pedir-dados', name: 'x', text: 'Nome , Cidade', variantes: [] }];
  await templates.migrarRespostaBoasVindas();
  check(!mem.templates.some((t) => t.id === 'boas-vindas'), 'e nao volta se ele apagar depois');
}

{
  grupo('as boas-vindas tem a metade SEM o pedido de dados (05/09/2026)');

  /**
   * Print dele: o contato tinha etiqueta de cidade (Erechim) e de conteudo, mandou uma figura, e
   * recebeu as boas-vindas com o *"nos informe Nome , Cidade"* dentro. *"ja tem os dados e pediu
   * novamente; a mensagem padrao provavelmente so tem pedindo dados"*.
   *
   * E o mesmo defeito das duas respostas de evento -- resposta que FUNDE duas coisas nao tem como
   * ser usada pela metade -- e o mesmo conserto: escrever a metade que faltava.
   */
  const todos = store.DEFAULT_TEMPLATES;
  const comPedido = todos.find((t) => t.id === 'boas-vindas');
  const semPedido = todos.find((t) => t.id === 'boas-vindas-tem-dados');
  check(!!semPedido, 'a resposta "boas-vindas-tem-dados" existe de fabrica');

  /**
   * **A assercao que importa.** Se este texto voltar a pedir o cadastro numa reescrita futura, o
   * defeito volta calado, porque a resposta continua se chamando "boas-vindas". Vale para o texto
   * base E para cada variante.
   */
  check(!templates.ehPedidoDeDados(semPedido.text), 'o texto base NAO pede nome e cidade');
  for (const v of semPedido.variantes || []) {
    check(!templates.ehPedidoDeDados(v), `a variante tambem nao pede: "${String(v).slice(0, 34)}..."`);
  }

  // A primeira continua PEDINDO -- e por isso que a segunda precisou existir.
  check(templates.ehPedidoDeDados(comPedido.text), 'a de quem NAO tem cadastro continua pedindo');

  // As duas dizem a mesma coisa na abertura: e a mesma mensagem, sem o bloco do cadastro.
  // INVERTIDA em 07/09/2026 pelo mesmo motivo da de cima: a apresentacao continua obrigatoria, a
  // palavra e que mudou.
  check(/(equipe|assessoria) do Capit/i.test(semPedido.text),
    'a metade sem pedido continua se apresentando — hoje como equipe/assessoria');
  check(semPedido.text.includes('Em que podemos ajudar?'), 'e continua perguntando em que pode ajudar');
}

{
  grupo('"gabinete" saiu do vocabulario (07/09/2026)');

  /**
   * Decisao dele: *"nao se refira mais a gabinete do Capitao Martim, se refira como assessoria ou
   * equipe; a IA deve ficar ciente tambem, veja nas respostas prontas"*.
   *
   * **A concordancia e metade do trabalho:** trocar a palavra e deixar o artigo produz "falando com
   * o equipe" — mensagem com erro de portugues saindo para eleitor. Por isso a lista casa a
   * preposicao junto.
   */
  const t = (x) => templates.semGabinete(x);
  check(t('Voce esta falando com o gabinete do Capitao Martim.') === 'Voce esta falando com a equipe do Capitao Martim.',
    'o gabinete -> a equipe, com o artigo certo');
  check(t('Encaminhei ao gabinete') === 'Encaminhei à equipe', 'ao gabinete -> à equipe');
  check(t('nosso gabinete vai ver') === 'nossa equipe vai ver', 'nosso gabinete -> nossa equipe');
  check(t('Trabalho no gabinete desde 2023') === 'Trabalho na equipe desde 2023', 'no gabinete -> na equipe');
  check(t('Gabinete do Capitao Martim, bom dia!').startsWith('Equipe'), 'a inicial MAIUSCULA e preservada');

  /**
   * O PLURAL vira "mandatos", e nao "equipes": *"vale para todos os gabinetes"* fala dos OUTROS
   * parlamentares, e "todas as equipes" ali nao quer dizer nada.
   */
  check(t('vale para todos os gabinetes, o ano inteiro') === 'vale para todos os mandatos, o ano inteiro',
    'o plural vira "mandatos", que e o que a frase quer dizer');

  // Nao inventa troca onde a palavra nao esta.
  check(t('Bem-vindo a equipe do Capitao Martim.') === 'Bem-vindo a equipe do Capitao Martim.',
    'texto que ja esta certo fica intacto');
  check(t('') === '' && t(null) === '', 'texto vazio nao quebra');

  // E o texto de FABRICA ja nasce sem a palavra.
  const defaults = JSON.stringify(store.DEFAULT_TEMPLATES);
  check(!/gabinete/i.test(defaults), 'nenhuma resposta de fabrica diz "gabinete"');
}

grupo('o link do grupo entra uma vez, e nunca por cima do dele (07/09/2026)');
{
  /**
   * Ele mandou o link atual junto do pedido, e mandou porque **o link cai e ele troca**. O valor vai
   * para `defaultGroupLink` — o campo "Link padrao" da Config —, que e o UM LUGAR onde ele troca: as
   * tres variantes da resposta pegam o valor novo sem reescrita nenhuma.
   *
   * A marca em `migracoes` e o que garante o "uma vez": sem ela, o link que ele trocar amanha
   * voltaria ao antigo no proximo carregamento do painel.
   */
  mem.migracoes = {};
  mem.defaultGroupLink = '';
  check(await templates.migrarLinkDoGrupoAtual(), 'campo vazio: preenche');
  check(mem.defaultGroupLink === templates.LINK_GRUPO_07_09_2026, 'com o link que ele mandou');

  // Roda de novo: nao mexe (e a marca que segura).
  mem.defaultGroupLink = 'https://chat.whatsapp.com/OUTRO';
  check(!(await templates.migrarLinkDoGrupoAtual()), 'segunda passada nao faz nada');
  check(mem.defaultGroupLink === 'https://chat.whatsapp.com/OUTRO', 'e o link dele fica');

  // E o caso que importa mais: ele JA tinha um link quando a migracao estreou.
  mem.migracoes = {};
  mem.defaultGroupLink = 'https://chat.whatsapp.com/DELE';
  check(!(await templates.migrarLinkDoGrupoAtual()), 'campo preenchido: nao preenche');
  check(mem.defaultGroupLink === 'https://chat.whatsapp.com/DELE', 'o link que ele ja tinha vence');

  // A resposta nova chega nas respostas DELE, que estao gravadas sem ela.
  mem.migracoes = {};
  mem.templates = store.DEFAULT_TEMPLATES.filter((t) => t.id !== 'agenda-grupo').map((t) => ({ ...t }));
  check(await templates.migrarRespostaAgendaGrupo(), 'acrescenta a resposta da agenda');
  check(mem.templates.some((t) => t.id === 'agenda-grupo'), 'e ela esta la');
  check(!(await templates.migrarRespostaAgendaGrupo()), 'e nao acrescenta duas vezes');
}

/**
 * **"Gostaria de falar com o deputado"** — pedido dele (08/09/2026), com o print do pastor e a
 * resposta que ele digitou a mao.
 *
 * O que este grupo trava e o CONTEUDO da decisao dele, que uma reescrita futura pode desfazer sem
 * querer: a Assembleia ficou de fora ("fora de eleicoes tem a opcao de encontrar na assembleia mas
 * agora esta fora de questao"), e o texto nao promete levar recado nem pede dados.
 */
{
  grupo('a resposta de "falar com o deputado" (o pastor, 08/09)');

  const pronta = store.DEFAULT_TEMPLATES.find((t) => t.id === 'falar-com-deputado');
  check(!!pronta, 'a resposta existe de fabrica');
  const textos = [pronta.text, ...(pronta.variantes || [])];
  check(textos.length === 3, `tem base e duas variantes (${textos.length})`);

  for (const t of textos) {
    check(/agenda/i.test(t), 'diz que o encontro e nos eventos da agenda');
    check(/seguran/i.test(t), 'e diz por que o numero pessoal nao e repassado');
    /**
     * **A Assembleia NAO pode aparecer** — e a metade da regra dele que a IA e uma reescrita
     * errariam: fora de eleicao ela existe, agora esta fora de questao, e oferecer e abrir porta
     * que nao abre (a mesma familia do "procure a coordenacao", 07/09).
     */
    check(!/assembleia|gabinete\s+parlamentar|marcar\s+(uma\s+)?reuniao/i.test(t),
      'e NAO oferece a assembleia nem reuniao');
    /** Nao promete levar recado: e a regra 5, e vale para o texto pronto tambem. */
    check(!/(levo|vou\s+levar|passo|vou\s+passar)\s+(o\s+)?(recado|para\s+ele)/i.test(t),
      'e nao promete levar o recado ate ele');
    /** Texto que FUNDE duas coisas nao se usa pela metade: o link do grupo mora em `agenda-grupo`. */
    check(!/\{\{link_grupo\}\}/.test(t), 'e nao carrega o link do grupo (que bloquearia o envio)');
  }
}

fim();
