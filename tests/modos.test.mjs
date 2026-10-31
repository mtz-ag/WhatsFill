/**
 * Os dois modos de trabalho: Campanha e Normal (31/10/2026).
 *
 * Pedido dele: *"o bom seria ter o modo campanha e modo normal, no modo de campanha as pessoas
 * chegam por anuncio e tem todo esse fluxo diferente, já fora de eleições as coisas mudam"*.
 *
 * O que este arquivo trava:
 *  - o valor (`'normal'` padrao, `'pos-campanha'` lido como normal);
 *  - as QUATRO pecas de campanha: em Campanha, o texto de antes palavra por palavra; em Normal, o
 *    texto novo;
 *  - a tira do Facebook ("Dia 25" so na campanha);
 *  - o fluxo do anuncio e o seletor da Config, lidos no codigo do painel.
 *
 * Rode: node tests/modos.test.mjs
 */
import { readFileSync } from 'node:fs';
import { check, grupo, fim, lib, mem } from './_harness.mjs';

const modo = await lib('modo.js');
const ia = await lib('ia.js');
const store = await lib('store.js');
const templates = await lib('templates.js');
const rapidas = await lib('respostas-comentario.js');

const raiz = new URL('../', import.meta.url);
const ler = (p) => readFileSync(new URL(p, raiz), 'utf8');
const plano = (s) => String(s).replace(/\s+/g, ' ');

grupo('o valor do modo: normal e o padrao, pos-campanha e alias');
{
  check(modo.FASE_PADRAO === 'normal', 'modo.FASE_PADRAO e normal');
  check(ia.FASE_PADRAO === 'normal', 'ia.FASE_PADRAO segue o modo.js');
  check(modo.normalizarFase('campanha') === 'campanha', 'campanha fica campanha');
  check(modo.normalizarFase('Campanha ') === 'campanha', 'maiuscula e espaco nao mudam nada');
  check(modo.normalizarFase('pos-campanha') === 'normal', 'pos-campanha (o nome antigo) vira normal');
  check(modo.normalizarFase('normal') === 'normal', 'normal fica normal');
  check(modo.normalizarFase(undefined) === 'normal' && modo.normalizarFase('') === 'normal', 'vazio e normal');
  check(modo.normalizarFase('xyz') === 'normal', 'valor desconhecido e normal (o modo que nao pede voto)');
  check(modo.emCampanha('campanha') && !modo.emCampanha('pos-campanha'), 'emCampanha so com campanha');
  for (const k of Object.keys(mem)) delete mem[k];
  const cfg = await store.get('ia');
  check(cfg.fase === 'normal', `o padrao gravado e normal (${cfg.fase})`);
  check(modo.MODOS.map((m) => m.rotulo).join('/') === 'Campanha/Normal', 'os rotulos da Config sao Campanha / Normal');
  check(/an[úu]ncio/.test(modo.explicacaoDoModo('campanha')) && /desligado/.test(modo.explicacaoDoModo('normal')),
    'cada modo tem a sua explicacao');
}

// As respostas de fabrica, como saem do armazenamento vazio.
for (const k of Object.keys(mem)) delete mem[k];
const guardadas = await templates.list({});
const copia = JSON.stringify(guardadas);
const falar = (lista) => lista.find((t) => t.id === 'falar-com-deputado');

grupo('respostas prontas: Campanha devolve o texto guardado, sem tocar');
{
  const camp = modo.respostasDoModo(guardadas, 'campanha');
  check(camp === guardadas, 'em campanha e a MESMA lista');
  check(!!falar(camp) && falar(camp).text === falar(guardadas).text, 'falar-com-deputado: o texto de antes');
  check(/eventos da agenda/.test(falar(camp).text), 'que fala dos eventos da agenda');
  check(camp.some((t) => t.id === 'trabalhar-na-campanha'), 'trabalhar-na-campanha continua em campanha');
}

grupo('respostas prontas: Normal troca falar-com-deputado e esconde trabalhar-na-campanha');
{
  const norm = modo.respostasDoModo(guardadas, 'normal');
  const f = falar(norm);
  check(!!f, 'falar-com-deputado continua (o fluxo acha pelo id)');
  check(!norm.some((t) => t.id === 'trabalhar-na-campanha'), 'trabalhar-na-campanha some (cai na regra 12)');
  check(norm.length === guardadas.length - 1, 'so ela some');
  check(JSON.stringify(guardadas) === copia, 'a lista guardada nao foi alterada');
  const todas = [f.text, ...f.variantes];
  check(todas.length === 3, 'texto + duas variantes');
  check(todas.every((t) => /responsável pela agenda do Capitão Martim/.test(t)), 'as tres passam para o responsável pela agenda do Capitão Martim');
  check(todas.every((t) => /seguran[çc]a/.test(t)), 'as tres dao o motivo: seguranca');
  check(todas.every((t) => !/eventos da agenda|nossa equipe|gabinete/i.test(t)), 'sem eventos, sem "nossa equipe", sem "gabinete"');
  check(todas.every((t) => t.startsWith('{{saudacao}}!')), 'continuam abrindo com a saudacao');
  check(!todas.some((t) => t.includes('[[DE]]')), 'o marcador foi trocado');
  check(/repasse ao responsável pela agenda/.test(f.name), `o nome diz o que ela faz (${f.name})`);
  for (const t of todas) {
    const av = ia.travasDoEscopo(t.replace('{{saudacao}}', 'Bom dia'), { candidato: null });
    const barra = av.filter((a) => Object.values(ia.AVISOS_QUE_IMPEDEM_ENVIO).includes(a));
    check(barra.length === 0, `nenhuma trava de escopo barra o texto normal (${barra.join(' | ') || 'ok'})`);
  }
  check(modo.respostasDoModo(guardadas, 'pos-campanha').length === norm.length, 'pos-campanha se comporta como normal');
  check(modo.respostasDoModo(guardadas, undefined).length === norm.length, 'sem valor se comporta como normal');
  const outra = falar(modo.respostasDoModo(guardadas, 'normal', { de: 'da Deputada Ana' }));
  check(/responsável pela agenda da Deputada Ana/.test(outra.text) && !/Martim/.test(outra.text),
    'outro perfil nao herda o nome dele');
}

grupo('a linha ENDERECO do bloco do contato muda com o modo');
{
  const msg = [{ de: 'contato', texto: 'me manda um adesivo e uma bandeira?' }];
  const camp = plano(ia.montarContatoRascunho({ mensagens: msg, fase: 'campanha' }));
  const norm = plano(ia.montarContatoRascunho({ mensagens: msg, fase: 'normal' }));
  const ANTES =
    'ENDEREÇO: só peça o endereço dela se ela pediu MATERIAL DE CAMPANHA (folheto, adesivo, bandeira, ' +
    'santinho) ou se já disse que aceita ser voluntária sem pagamento. Quem pediu dinheiro, emprego ' +
    'ou um bem para comprar NÃO recebe pedido de endereço — pedir endereço é prometer uma entrega.';
  check(camp.includes(ANTES), 'campanha: a linha de antes, palavra por palavra');
  check(!norm.includes('só peça o endereço dela se ela pediu MATERIAL DE CAMPANHA'), 'normal: a linha de campanha saiu');
  check(/ENDEREÇO: NÃO peça o endereço dela\. A campanha acabou/.test(norm), 'normal: nao pede o endereco');
  check(/o material da campanha já foi encerrado/.test(norm), 'normal: diz que o material foi encerrado');
  check(/ENDEREÇO: NÃO peça/.test(plano(ia.montarContatoRascunho({ mensagens: msg }))), 'sem fase, vale o normal');
  check(/ENDEREÇO: NÃO peça/.test(plano(ia.montarContatoRascunho({ mensagens: msg, fase: 'pos-campanha' }))), 'pos-campanha vale o normal');
}

grupo('a linha DINHEIRO do bloco do contato muda com o modo');
{
  const msg = [{ de: 'contato', texto: 'faz um pix pra mim por favor' }];
  const camp = plano(ia.montarContatoRascunho({ mensagens: msg, fase: 'campanha' }));
  const norm = plano(ia.montarContatoRascunho({ mensagens: msg, fase: 'normal' }));
  const ANTES =
    'DINHEIRO — O CRAS NÃO É PARA TODO MUNDO: só aponte CRAS, assistência social, Cadastro Único ou ' +
    'Defensoria se ELA DISSER a dificuldade concreta (está desempregada, sem comida, com aluguel ou ' +
    'luz atrasados, ameaçada de despejo, com criança pequena sem o que comer, com benefício cortado ' +
    'ou negado, doença na família). Se ela só pediu dinheiro, PIX ou um valor, sem dizer nada disso: ' +
    'diga em UMA frase gentil que a lei eleitoral me proíbe de fazer isso e PARE — sem CRAS, sem lista ' +
    'de órgãos, sem citar artigo nem dar aula, e sem perguntar do caso. Assistência social é para quem ' +
    'está em vulnerabilidade; mandar todo mundo para lá é resposta de máquina, e erra com quem ' +
    'precisa de verdade.';
  check(camp.includes(ANTES), 'campanha: a linha de antes, palavra por palavra');
  check(!/lei eleitoral me proíbe/.test(norm), 'normal: sem "lei eleitoral"');
  check(/a lei não permite que um mandato faça doações/.test(norm), 'normal: a lei nao permite que um mandato faca doacoes');
  check(/só aponte CRAS.*se ELA DISSER a dificuldade/.test(norm), 'normal: o criterio do CRAS continua');
  check(/e PARE — sem CRAS/.test(norm), 'normal: e para');
}

grupo('a linha "nao prometa" do sistema muda com o modo');
{
  const camp = plano(ia.montarSistemaRascunho({ fase: 'campanha' }));
  const norm = plano(ia.montarSistemaRascunho({ fase: 'normal' }));
  const ANTES = plano([
    'A lei eleitoral (9.504/97) proíbe prometer dinheiro, cesta, remédio, passagem, emprego, vaga',
    'ou qualquer bem ou benefício, e vale o ano inteiro. Negar com respeito é o item 9 do padrão',
    'acima; prometer, nunca — nem "vou ver o que consigo".',
    'Ao NEGAR dinheiro, compra, pagamento ou doação, diga SEMPRE o motivo, numa frase curta: "a lei',
    'eleitoral me proíbe" — sem citar artigo e sem aula. Sem o motivo, o "não" soa como má vontade.',
  ].join('\n'));
  check(camp.includes(ANTES), 'campanha: as cinco linhas de antes, palavra por palavra');
  check(!norm.includes('A lei eleitoral (9.504/97) proíbe prometer') && !norm.includes('"a lei eleitoral me proíbe" — sem citar artigo'),
    'normal: sem a lei eleitoral nesta regra');
  check(/Não prometa obras, cargos, benefícios ou favores — nem dinheiro, cesta, remédio, passagem, emprego ou vaga\./.test(norm),
    'normal: nao prometa obras, cargos, beneficios ou favores');
  check(/prometer, nunca — nem "vou ver o que consigo"/.test(norm), 'normal: o "nem vou ver o que consigo" continua');
  check(/diga SEMPRE o motivo, numa frase curta: "a lei não permite que um mandato faça doações"/.test(norm),
    'normal: o motivo e o mesmo da linha DINHEIRO');
  check(plano(ia.montarSistemaRascunho({})).includes('Não prometa obras, cargos'), 'sem fase, vale o normal');
}

grupo('a linha da janta (apoio com evento) muda com o modo');
{
  const msg = [{ de: 'contato', texto: 'vou fazer uma janta para apoiar, vocês podem ajudar com a comida? convido o capitão' }];
  const camp = plano(ia.montarContatoRascunho({ mensagens: msg, fase: 'campanha' }));
  const norm = plano(ia.montarContatoRascunho({ mensagens: msg, fase: 'normal' }));
  check(/APOIO COM EVENTO — NÃO É PEDIDO DE AJUDA/.test(camp), 'campanha: a linha de antes entra');
  check(camp.includes('diga com franqueza que a campanha não entra com comida, bebida, som nem custo — a lei eleitoral e a prestação de contas não permitem —, e que o apoio dela vale do jeito que ela puder fazer. Se ela convidar o Capitão Martim, pode dizer que repassa o convite para o responsável pela agenda do Capitão Martim; nada além disso, e sem prometer presença.'),
    'campanha: palavra por palavra');
  check(/CONVITE PARA EVENTO — NÃO É PEDIDO DE AJUDA/.test(norm) && !/APOIO COM EVENTO/.test(norm), 'normal: a linha nova, e so ela');
  check(!/eleitora/i.test(norm), 'normal: o bloco do contato nao fala de lei eleitoral');
  check(!/a campanha não entra/.test(norm), 'normal: nada de "a campanha"');
  check(/Agradeça com carinho a iniciativa pelo nome/.test(norm), 'normal: agradece a iniciativa');
  check(/não temos como contribuir com isso — sem citar lei/.test(norm), 'normal: nega a contribuicao sem citar lei');
  check(norm.includes('diga "passo o convite para o responsável pela agenda do Capitão Martim"'), 'normal: passa o convite para o responsavel pela agenda');
  check(/NADA de CRAS/.test(norm), 'normal: continua sem CRAS');
  check(!/DINHEIRO —/.test(norm) && !/NÃO SOMOS CANAL/.test(norm), 'normal: nem a regra do dinheiro nem a 11');
  const outra = plano(ia.montarContatoRascunho({ mensagens: msg, fase: 'normal', candidato: { nome: 'Ana Souza', tratamento: 'a Deputada Ana' } }));
  check(outra.includes('responsável pela agenda da Deputada Ana') && !/Martim/.test(outra), 'outro perfil nao herda o nome dele');
}

grupo('Facebook: "Dia 25 — 2o turno" so aparece na tira em campanha');
{
  const lista = rapidas.sanitizar(rapidas.RESPOSTAS_DE_FABRICA);
  const camp = rapidas.daTiraNoModo(lista, 'campanha');
  const norm = rapidas.daTiraNoModo(lista, 'normal');
  check(camp.some((r) => r.id === 'dia-25'), 'campanha: Dia 25 esta la');
  check(!norm.some((r) => r.id === 'dia-25'), 'normal: Dia 25 sumiu');
  check(norm.length === lista.length - 1, 'so ela sumiu');
  check(rapidas.daTiraNoModo(lista, undefined).length === norm.length, 'sem valor: normal');
  const fb = ler('src/facebook-main.js');
  check(/rapidas\.daTiraNoModo\(estado\.respostas, estado\.fase\)\[i\]/.test(fb), 'o teclado usa a tira do modo');
  check(/const fila = \[\.\.\.rapidas\.daTiraNoModo\(estado\.respostas, estado\.fase\)\]/.test(fb), 'a tira desenhada usa a do modo');
  check(/fase: cfg\.fase/.test(fb), 'o rascunho de comentario recebe o modo');
}

grupo('o painel: seletor na Config e fluxo do anuncio atras do modo');
{
  const p = ler('src/panel/panel.js');
  check(/function renderConfig\(\) \{\s+renderCartaoCandidatos\(\);\s+body\.append\(boxDoModo\(\)\);/.test(p),
    'o seletor "Modo" e o primeiro cartao da Config, logo depois do candidato');
  check(/escolha\('wf-modo-fase', modoLib\.MODOS, faseAtual\(\)/.test(p), 'um radio com as duas opcoes (o mesmo `escolha` do envio)');
  check(/store\.set\('ia', \{ \.\.\.\(await store\.get\('ia'\)\), fase: v \}\)/.test(p), 'grava ia.fase no chrome.storage.local');
  check(/state\.anuncioSemResposta = !emCampanha\(\)\s+\? null/.test(p), 'normal: o clique do anuncio nao pede resposta (modelo do anuncio, sinal do quadro)');
  check(/const veioDeUmAnuncio = emCampanha\(\) &&/.test(p), 'normal: sem modelo padrao de anuncio');
  check(/const voltouPorOutroAnuncio =\s+emCampanha\(\) &&/.test(p), 'normal: a frase do aceite nao e consultada');
  check(/const doAnuncio = !emCampanha\(\) \? null : anunciosLib\.decidirComAnuncio/.test(p), 'normal: a acao do anuncio nao decide');
  check((p.match(/fase: faseAtual\(\)/g) || []).length === 2, 'o rascunho da IA recebe o modo normalizado');
  check(/templates: respostasEmUso\(\)/.test(p), 'a IA ve as respostas do modo');
  check(/respostaDoFluxo \? respostasEmUso\(\)\.find/.test(p), 'o fluxo acha a resposta do modo');
  check(/for \(const template of state\.templates\) body\.append\(renderTemplateEditor\(template\)\)/.test(p),
    'o EDITOR continua no texto guardado (nao grava o normal por cima do de campanha)');
}

fim();
