/**
 * Testa a decisão da categorização por cidade.
 *
 * Vale teste porque é o que decide o que vai ser ESCRITO em base de eleitor real, 57 mil
 * contatos, em produção. Cada asserção aqui é uma trava contra um jeito específico de estragar a
 * base: etiqueta de lixo criada a partir de texto livre, etiqueta gravada duas vezes, contato
 * ainda não triado entrando no filtro de cidade.
 *
 * Rode: node tests/categorizar.test.mjs
 */

import { readFileSync } from 'node:fs';
import { check, grupo, fim, lib, mem } from './_harness.mjs';

const coredes = JSON.parse(readFileSync(new URL('../src/data/coredes-rs.json', import.meta.url), 'utf8'));
mem.municipios = Object.keys(coredes.municipios).sort((a, b) => a.localeCompare(b, 'pt-BR'));

const { nomeDaEtiqueta, analisar, Ritmo, ehLimiteDeTaxa, PREFIXO_PADRAO, PREFIXO_ANTIGO, etiquetasComPrefixoAntigo } =
  await lib('categorizar.js');
const { normalize } = await lib('cities.js');

/** Os 497 municípios do RS, normalizados — a mesma fonte que o painel usa. */
const municipios = new Set(Object.keys(coredes.municipios).map(normalize));

/** Monta o mapa "nome normalizado → etiqueta" como ele sai da lista real do CRM. */
function etiquetas(...nomes) {
  const mapa = new Map();
  nomes.forEach((nome, i) => mapa.set(normalize(nome), { id: `t-${i}`, label: nome }));
  return mapa;
}

/** Município normalizado → COREDE, da mesma planilha oficial que o painel usa. */
const coredePorMunicipio = new Map(Object.entries(coredes.municipios).map(([m, c]) => [normalize(m), c]));

const ctx = (mapa) => ({
  etiquetasPorNome: mapa,
  municipios,
  coredePorMunicipio,
  prefixo: PREFIXO_PADRAO,
});

/** Sem o mapa de COREDEs: isola o comportamento da etiqueta de cidade. */
const ctxSoCidade = (mapa) => ({ etiquetasPorNome: mapa, municipios, prefixo: PREFIXO_PADRAO });

grupo('nomeDaEtiqueta: sem prefixo, so o nome da cidade');
{
  // Pedido dele depois de ver a primeira gravada: "deixe somente caxias do sul".
  check(PREFIXO_PADRAO === '', 'o padrão não tem prefixo');
  check(nomeDaEtiqueta('Santo Ângelo') === 'SANTO ÂNGELO', 'maiúsculas, acento mantido');
  check(nomeDaEtiqueta('  Pelotas  ') === 'PELOTAS', 'apara o espaço');
  check(nomeDaEtiqueta('') === '', 'vazio não vira etiqueta');
  check(nomeDaEtiqueta('Pelotas', 'CIDADE: ') === 'CIDADE: PELOTAS', 'prefixo ainda é respeitado se pedido');
}

grupo('nenhum município do RS colide com nome de COREDE');
{
  // É esta conferência que torna seguro tirar o prefixo: com colisão, a etiqueta de cidade e a
  // de região teriam o mesmo nome e o filtro dele ficaria ambíguo.
  const nomesDeCorede = new Set(Object.values(coredes.municipios).map(normalize));
  const colidem = Object.keys(coredes.municipios).filter((m) => nomesDeCorede.has(normalize(m)));
  check(colidem.length === 0, `nenhuma colisão cidade × COREDE (${colidem.join(', ') || 'nenhuma'})`);
}

grupo('etiquetasComPrefixoAntigo: acha o que precisa renomear');
{
  const lista = [
    { id: 't1', label: 'CIDADE: CAXIAS DO SUL' },
    { id: 't2', label: 'SERRA' },
    { id: 't3', label: 'CIDADE: PELOTAS' },
  ];
  const fora = etiquetasComPrefixoAntigo(lista, PREFIXO_ANTIGO);
  check(fora.length === 2, `achou as duas com prefixo = ${fora.length}`);
  check(fora[0].de === 'CIDADE: CAXIAS DO SUL' && fora[0].para === 'CAXIAS DO SUL', 'monta o nome novo');
  check(fora[0].id === 't1', 'leva o id, que é o que a renomeação usa');
  check(!fora.some((x) => x.de === 'SERRA'), 'etiqueta sem prefixo não é mexida');
}

grupo('etiquetasComPrefixoAntigo: NÃO renomeia se o nome novo já existe');
{
  // Renomear criaria dois rótulos iguais no CRM. Quem decide nesse caso é ele, não o código.
  const lista = [
    { id: 't1', label: 'CIDADE: CAXIAS DO SUL' },
    { id: 't2', label: 'CAXIAS DO SUL' },
  ];
  check(etiquetasComPrefixoAntigo(lista, PREFIXO_ANTIGO).length === 0, 'recusa em vez de duplicar rótulo');
}

grupo('contato sem etiqueta NÃO entra — ainda não foi trabalhado');
{
  const r = analisar([{ id: 'c1', tagsId: [], cidade: 'Pelotas' }], ctxSoCidade(etiquetas('PELOTAS')));
  check(r.paraGravar.length === 0, 'não grava');
  check(r.semEtiqueta === 1, 'contado como sem etiqueta');
}

grupo('contato sem cidade não entra');
{
  const r = analisar([{ id: 'c1', tagsId: ['x'], cidade: '' }], ctx(etiquetas()));
  check(r.paraGravar.length === 0 && r.semCidade === 1, 'contado como sem cidade');
}

grupo('TRAVA: texto livre no campo Cidade não vira etiqueta');
{
  // A base tem cidade digitada à mão. Sem esta trava, cada bobagem viraria etiqueta nova no CRM.
  const lixo = ['não sei', 'aaa', 'Rio de Janeiro', 'Pelotinhas'];
  const r = analisar(
    lixo.map((cidade, i) => ({ id: `c${i}`, tagsId: ['x'], cidade })),
    ctx(etiquetas())
  );
  check(r.paraGravar.length === 0, 'nada gravado');
  check(r.faltamCriar.length === 0, 'e nada entra na fila de criar etiqueta');
  check(r.revisar.length === 4, `os quatro foram para revisão = ${r.revisar.length}`);
  check(
    r.revisar.some((x) => x.cidade === 'Rio de Janeiro'),
    'município de outro estado também vai para revisão, não vira etiqueta'
  );
}

grupo('cidade válida sem etiqueta no CRM: entra na fila de criar, não é inventada');
{
  const r = analisar(
    [
      { id: 'c1', tagsId: ['x'], cidade: 'Pelotas' },
      { id: 'c2', tagsId: ['x'], cidade: 'Pelotas' },
      { id: 'c3', tagsId: ['x'], cidade: 'Bagé' },
    ],
    ctxSoCidade(etiquetas()) // CRM sem nenhuma etiqueta de cidade
  );
  check(r.paraGravar.length === 0, 'não grava sem id de verdade');
  check(r.faltamCriar.length === 2, 'duas cidades a criar');
  check(r.faltamCriar[0].cidade === 'Pelotas' && r.faltamCriar[0].quantos === 2,
    `a mais frequente vem primeiro = ${r.faltamCriar[0].cidade} (${r.faltamCriar[0].quantos})`);
  check(r.faltamCriar[0].nome === 'PELOTAS', 'já traz o nome a criar');
}

grupo('IDEMPOTENTE: quem já tem a etiqueta não gasta requisição');
{
  const mapa = etiquetas('PELOTAS');
  const id = mapa.get(normalize('PELOTAS')).id;
  const r = analisar([{ id: 'c1', tagsId: ['outra', id], cidade: 'Pelotas' }], ctxSoCidade(mapa));
  check(r.paraGravar.length === 0, 'não regrava');
  check(r.jaOk === 1, 'contado como pronto');
}

grupo('o caso que importa: grava cidade E COREDE, na mesma requisicao');
{
  // Pedido dele: "preciso que extensao marque todas as etiquetas que tenham corede".
  const mapa = etiquetas('SANTO ÂNGELO', 'Missões');
  const r = analisar([{ id: 'c1', tagsId: ['t-conteudo'], cidade: 'Santo Ângelo' }], ctx(mapa));
  check(r.paraGravar.length === 1, 'entrou para gravar');

  const item = r.paraGravar[0];
  check(item.contactId === 'c1', 'contato certo');
  check(item.etiquetas.length === 2, `duas etiquetas de uma vez = ${item.etiquetas.length}`);
  const rotulos = item.etiquetas.map((t) => t.label);
  check(rotulos.includes('SANTO ÂNGELO'), 'a da cidade');
  check(rotulos.includes('Missões'), 'a do COREDE, derivada da cidade pela planilha oficial');
  check(item.corede === 'Missões', 'o COREDE fica no item, para o log');
  check(
    item.tagsId.includes('t-conteudo'),
    'leva as etiquetas atuais — é o que permite somar em vez de substituir'
  );
}

grupo('COREDE que o contato JA tem nao volta a ser gravado');
{
  const mapa = etiquetas('SANTO ÂNGELO', 'Missões');
  const idCorede = mapa.get(normalize('Missões')).id;
  const r = analisar([{ id: 'c1', tagsId: [idCorede], cidade: 'Santo Ângelo' }], ctx(mapa));
  check(r.paraGravar.length === 1, 'ainda grava (falta a cidade)');
  check(r.paraGravar[0].etiquetas.length === 1, 'mas só a cidade');
  check(r.paraGravar[0].etiquetas[0].label === 'SANTO ÂNGELO', 'e é a da cidade');
}

grupo('cidade e COREDE ja aplicados: nada a fazer');
{
  const mapa = etiquetas('SANTO ÂNGELO', 'Missões');
  const ids = [mapa.get(normalize('SANTO ÂNGELO')).id, mapa.get(normalize('Missões')).id];
  const r = analisar([{ id: 'c1', tagsId: ids, cidade: 'Santo Ângelo' }], ctx(mapa));
  check(r.paraGravar.length === 0, 'não gera requisição');
  check(r.jaOk === 1, 'contado como pronto');
}

grupo('COREDE sem etiqueta no CRM entra na fila de criar, marcado como corede');
{
  const mapa = etiquetas('SANTO ÂNGELO'); // CRM tem a cidade, não tem o COREDE
  const r = analisar([{ id: 'c1', tagsId: ['x'], cidade: 'Santo Ângelo' }], ctx(mapa));
  check(r.paraGravar.length === 1 && r.paraGravar[0].etiquetas.length === 1, 'grava a cidade agora');
  check(r.faltamCriar.length === 1, 'e anota o COREDE a criar');
  check(r.faltamCriar[0].nome === 'Missões' && r.faltamCriar[0].tipo === 'corede',
    `marcado como corede = ${r.faltamCriar[0].nome} (${r.faltamCriar[0].tipo})`);
}

grupo('REGRESSAO: ter o COREDE nao faz o contato passar por pronto');
{
  /**
   * O bug que ele pegou na tela, em 20/08/2026: "20 gravados" ao lado de "6002 já com cidade e
   * COREDE". Contato de Caxias do Sul que TEM o COREDE (Serra, do fluxo normal) mas cuja etiqueta
   * de CIDADE ainda não existe no CRM era contado como pronto — nada faltava aplicar, então a
   * versão antiga olhava `alvos.length` e concluía "completo". Quase seis mil contatos esperando
   * criação, escondidos no número de prontos.
   */
  const mapa = etiquetas('Serra'); // o COREDE existe; a etiqueta de CAXIAS DO SUL nao
  const idSerra = mapa.get(normalize('Serra')).id;
  const r = analisar([{ id: 'c1', tagsId: [idSerra], cidade: 'Caxias do Sul' }], ctx(mapa));

  check(r.jaOk === 0, 'NAO conta como pronto — falta a etiqueta de cidade');
  check(r.esperandoCriacao === 1, 'conta como esperando criação');
  check(r.paraGravar.length === 0, 'e não há o que gravar agora');
  check(
    r.faltamCriar.length === 1 && r.faltamCriar[0].nome === 'CAXIAS DO SUL',
    `a cidade entra na fila de criar = ${r.faltamCriar.map((x) => x.nome).join(',')}`
  );
}

/** Contexto completo, do jeito que o painel monta. */
function ctxCheio(mapa, { idsDeCorede = new Set(), rotuloPorId = new Map() } = {}) {
  return { etiquetasPorNome: mapa, municipios, coredePorMunicipio, idsDeCorede, rotuloPorId, prefixo: PREFIXO_PADRAO };
}

grupo('COREDE divergente: detecta, e nao remove nada');
{
  // Contato cuja cidade e de um COREDE mas que carrega a etiqueta de OUTRO. Gravar soma o certo e
  // deixa o errado -- o contato passa a aparecer no filtro das duas regioes.
  const mapa = etiquetas('CAXIAS DO SUL', 'Serra', 'Missões');
  const idMissoes = mapa.get(normalize('Missões')).id;
  const idSerra = mapa.get(normalize('Serra')).id;

  const r = analisar([{ id: 'c1', tagsId: [idMissoes], cidade: 'Caxias do Sul' }], ctxCheio(mapa, {
    idsDeCorede: new Set([idSerra, idMissoes]),
    rotuloPorId: new Map([[idSerra, 'Serra'], [idMissoes, 'Missões']]),
  }));

  check(r.coredeDivergente.length === 1, 'detectou a divergência');
  check(r.coredeDivergente[0].corede === 'Serra', 'sabe qual é o certo');
  check(r.coredeDivergente[0].outros.includes(idMissoes), 'e qual está sobrando');
  // Detectar não é agir: nada é removido, e o certo continua sendo aplicado.
  check(r.paraGravar.length === 1, 'ainda grava o que falta');
  check(r.paraGravar[0].etiquetas.length === 2, 'cidade + COREDE certo');
}

grupo('COREDE igual ao da cidade nao e divergencia');
{
  const mapa = etiquetas('CAXIAS DO SUL', 'Serra');
  const idSerra = mapa.get(normalize('Serra')).id;
  const r = analisar([{ id: 'c1', tagsId: [idSerra], cidade: 'Caxias do Sul' }], ctxCheio(mapa, {
    idsDeCorede: new Set([idSerra]),
    rotuloPorId: new Map([[idSerra, 'Serra']]),
  }));
  check(r.coredeDivergente.length === 0, 'sem falso positivo');
}

grupo('REGRESSAO: etiqueta de nome REPETIDO nao vira divergencia falsa');
{
  /**
   * O falso positivo que ele viu na base real: "Caxias do Sul → Serra (tem: Serra)", em 1293
   * contatos. O CRM tem duas etiquetas chamadas "Serra" (ids diferentes); `etiquetasPorNome`
   * guarda uma e o contato carrega a outra. Comparar ID acusava divergência onde o rótulo é o
   * mesmo — e o filtro por região trata as duas igual.
   */
  const mapa = etiquetas('CAXIAS DO SUL', 'Serra');
  const idSerraDoMapa = mapa.get(normalize('Serra')).id;
  const idSerraDuplicada = 'outro-id-mesmo-rotulo';

  const r = analisar([{ id: 'c1', tagsId: [idSerraDuplicada], cidade: 'Caxias do Sul' }], ctxCheio(mapa, {
    idsDeCorede: new Set([idSerraDoMapa, idSerraDuplicada]),
    rotuloPorId: new Map([[idSerraDoMapa, 'Serra'], [idSerraDuplicada, 'Serra']]),
  }));
  check(r.coredeDivergente.length === 0, 'mesmo rótulo, ids diferentes: NAO e divergencia');
}

grupo('divergencia: id sem rotulo conhecido nao acusa');
{
  // Na dúvida não acusa: id de etiqueta que não veio na lista pode ser qualquer coisa.
  const mapa = etiquetas('CAXIAS DO SUL', 'Serra');
  const idSerra = mapa.get(normalize('Serra')).id;
  const r = analisar([{ id: 'c1', tagsId: ['id-desconhecido'], cidade: 'Caxias do Sul' }], ctxCheio(mapa, {
    idsDeCorede: new Set([idSerra, 'id-desconhecido']),
    rotuloPorId: new Map([[idSerra, 'Serra']]),
  }));
  check(r.coredeDivergente.length === 0, 'sem rótulo, sem acusação');
}

grupo('etiquetasComRotuloRepetido');
{
  const { etiquetasComRotuloRepetido } = await lib('categorizar.js');
  const lista = [
    { id: 'a', label: 'Serra' },
    { id: 'b', label: 'SERRA' },
    { id: 'c', label: 'Missões' },
    { id: 'd', label: '1 Sem Retorno' },
  ];
  const rep = etiquetasComRotuloRepetido(lista);
  check(rep.length === 1, `achou uma repetição = ${rep.length}`);
  check(rep[0].ids.length === 2 && rep[0].ids.includes('a') && rep[0].ids.includes('b'),
    'com os dois ids');
  check(!rep.some((x) => normalize(x.rotulo) === normalize('Missões')), 'rótulo único não entra');
}

grupo('nada aplicavel agora conta como esperandoCriacao, nao como pronto');
{
  // Sem etiqueta nenhuma no CRM: não há o que gravar, mas também não está pronto. Contar como
  // "já ok" esconderia o trabalho de criação pendente.
  const r = analisar([{ id: 'c1', tagsId: ['x'], cidade: 'Santo Ângelo' }], ctx(etiquetas()));
  check(r.paraGravar.length === 0, 'não grava');
  check(r.jaOk === 0, 'NÃO conta como pronto');
  check(r.esperandoCriacao === 1, 'conta como esperando criação');
  check(r.faltamCriar.length === 2, 'as duas etiquetas entram na fila de criar');
}

grupo('casamento com o CRM ignora acento e caixa');
{
  // A etiqueta pode ter sido criada à mão, sem acento ou em caixa diferente. Não pode virar
  // etiqueta duplicada só por isso.
  const r = analisar(
    [{ id: 'c1', tagsId: ['x'], cidade: 'Santo Ângelo' }],
    ctxSoCidade(etiquetas('santo angelo'))
  );
  check(r.paraGravar.length === 1, 'casou mesmo escrita diferente');
  check(r.faltamCriar.length === 0, 'e não pediu para criar uma segunda');
}

grupo('Ritmo: acelera na sequência limpa e recua na recusa');
{
  const r = new Ritmo({ inicialMs: 400, minMs: 150, maxMs: 8000, acelerarApos: 3 });
  check(r.pausaMs === 400, 'começa no inicial');

  r.sucesso(); r.sucesso();
  check(r.pausaMs === 400, 'não acelera antes da sequência completar');
  r.sucesso();
  check(r.pausaMs === 320, `acelerou = ${r.pausaMs}ms`);

  r.recuar();
  check(r.pausaMs === 640, `recuou dobrando = ${r.pausaMs}ms`);

  // Recuar zera a contagem: a próxima aceleração começa do zero, não de onde parou.
  r.sucesso(); r.sucesso();
  check(r.pausaMs === 640, 'a contagem de aceleração zerou na recuada');
}

grupo('Ritmo: respeita piso e teto');
{
  const r = new Ritmo({ inicialMs: 200, minMs: 150, maxMs: 800, acelerarApos: 1 });
  for (let i = 0; i < 20; i++) r.sucesso();
  check(r.pausaMs === 150, `não desce do piso = ${r.pausaMs}ms`);

  for (let i = 0; i < 20; i++) r.recuar();
  check(r.pausaMs === 800, `não passa do teto = ${r.pausaMs}ms`);
}

grupo('Ritmo: desiste quando o teto não resolve');
{
  const r = new Ritmo({ inicialMs: 400, maxMs: 800 });
  check(!r.desistir(), 'não desiste no começo');
  r.recuar();
  check(!r.desistir(), 'nem numa recusa isolada');
  r.recuar(); r.recuar();
  check(r.desistir(), 'desiste no teto depois de três recuadas — insistir é castigar a plataforma');
}

grupo('ehLimiteDeTaxa: o sinal é de rede, não só HTTP');
{
  check(ehLimiteDeTaxa('Failed to fetch'), 'preflight CORS recusado é o sinal mais comum');
  check(ehLimiteDeTaxa('PUT /core/v1/contact/x → 429 Too Many Requests'), '429');
  check(ehLimiteDeTaxa('GET /core/v1/contact → 503 '), '503');
  check(!ehLimiteDeTaxa('PUT /core/v1/contact/x → 400 campo inválido'), '400 é problema do pedido, esperar não conserta');
  check(!ehLimiteDeTaxa('→ 404 not found'), '404 idem');
  check(!ehLimiteDeTaxa(''), 'vazio não é limite');
}

grupo('contagens fecham com o total');
{
  const mapa = etiquetas('PELOTAS');
  const id = mapa.get(normalize('PELOTAS')).id;
  const entrada = [
    { id: 'a', tagsId: [], cidade: 'Pelotas' },          // sem etiqueta
    { id: 'b', tagsId: ['x'], cidade: '' },              // sem cidade
    { id: 'c', tagsId: ['x'], cidade: 'aaa' },           // revisar
    { id: 'd', tagsId: ['x'], cidade: 'Bagé' },          // falta criar
    { id: 'e', tagsId: [id], cidade: 'Pelotas' },        // já ok
    { id: 'f', tagsId: ['x'], cidade: 'Pelotas' },       // grava
  ];
  const r = analisar(entrada, ctx(mapa));
  const somaRevisar = r.revisar.reduce((s, x) => s + x.quantos, 0);
  // `faltamCriar` conta OCORRÊNCIAS de etiqueta faltante (um contato pode gerar duas), então a
  // conta de CONTATOS usa `esperandoCriacao`. Confundir os dois foi o defeito da tela em 20/08.
  const total = r.paraGravar.length + r.jaOk + r.semCidade + r.semEtiqueta + somaRevisar + r.esperandoCriacao;
  check(total === entrada.length, `nenhum contato some da conta = ${total}/${entrada.length}`);
}

fim();
