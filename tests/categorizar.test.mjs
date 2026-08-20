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

const { nomeDaEtiqueta, analisar, Ritmo, ehLimiteDeTaxa, PREFIXO_PADRAO } = await lib('categorizar.js');
const { normalize } = await lib('cities.js');

/** Os 497 municípios do RS, normalizados — a mesma fonte que o painel usa. */
const municipios = new Set(Object.keys(coredes.municipios).map(normalize));

/** Monta o mapa "nome normalizado → etiqueta" como ele sai da lista real do CRM. */
function etiquetas(...nomes) {
  const mapa = new Map();
  nomes.forEach((nome, i) => mapa.set(normalize(nome), { id: `t-${i}`, label: nome }));
  return mapa;
}

const ctx = (mapa) => ({ etiquetasPorNome: mapa, municipios, prefixo: PREFIXO_PADRAO });

grupo('nomeDaEtiqueta');
{
  check(nomeDaEtiqueta('Santo Ângelo') === 'CIDADE: SANTO ÂNGELO', 'maiúsculas, acento mantido');
  check(nomeDaEtiqueta('  Pelotas  ') === 'CIDADE: PELOTAS', 'apara o espaço');
  check(nomeDaEtiqueta('') === '', 'vazio não vira etiqueta');
  check(nomeDaEtiqueta('Pelotas', '') === 'PELOTAS', 'prefixo vazio é respeitado');
}

grupo('contato sem etiqueta NÃO entra — ainda não foi trabalhado');
{
  const r = analisar([{ id: 'c1', tagsId: [], cidade: 'Pelotas' }], ctx(etiquetas('CIDADE: PELOTAS')));
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
    ctx(etiquetas()) // CRM sem nenhuma etiqueta de cidade
  );
  check(r.paraGravar.length === 0, 'não grava sem id de verdade');
  check(r.faltamCriar.length === 2, 'duas cidades a criar');
  check(r.faltamCriar[0].cidade === 'Pelotas' && r.faltamCriar[0].quantos === 2,
    `a mais frequente vem primeiro = ${r.faltamCriar[0].cidade} (${r.faltamCriar[0].quantos})`);
  check(r.faltamCriar[0].nome === 'CIDADE: PELOTAS', 'já traz o nome a criar');
}

grupo('IDEMPOTENTE: quem já tem a etiqueta não gasta requisição');
{
  const mapa = etiquetas('CIDADE: PELOTAS');
  const id = mapa.get(normalize('CIDADE: PELOTAS')).id;
  const r = analisar([{ id: 'c1', tagsId: ['outra', id], cidade: 'Pelotas' }], ctx(mapa));
  check(r.paraGravar.length === 0, 'não regrava');
  check(r.jaOk === 1, 'contado como pronto');
}

grupo('o caso que importa: grava, e leva as etiquetas atuais para somar');
{
  const mapa = etiquetas('CIDADE: SANTO ÂNGELO');
  const r = analisar([{ id: 'c1', tagsId: ['t-corede', 't-conteudo'], cidade: 'Santo Ângelo' }], ctx(mapa));
  check(r.paraGravar.length === 1, 'entrou para gravar');

  const item = r.paraGravar[0];
  check(item.contactId === 'c1', 'contato certo');
  check(item.etiqueta.label === 'CIDADE: SANTO ÂNGELO', 'etiqueta certa');
  check(
    item.tagsId.includes('t-corede') && item.tagsId.includes('t-conteudo'),
    'leva as etiquetas atuais — é o que permite somar em vez de substituir'
  );
}

grupo('casamento com o CRM ignora acento e caixa');
{
  // A etiqueta pode ter sido criada à mão, sem acento ou em caixa diferente. Não pode virar
  // etiqueta duplicada só por isso.
  const r = analisar(
    [{ id: 'c1', tagsId: ['x'], cidade: 'Santo Ângelo' }],
    ctx(etiquetas('cidade: santo angelo'))
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
  const mapa = etiquetas('CIDADE: PELOTAS');
  const id = mapa.get(normalize('CIDADE: PELOTAS')).id;
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
  const somaFaltam = r.faltamCriar.reduce((s, x) => s + x.quantos, 0);
  const total = r.paraGravar.length + r.jaOk + r.semCidade + r.semEtiqueta + somaRevisar + somaFaltam;
  check(total === entrada.length, `nenhum contato some da conta = ${total}/${entrada.length}`);
}

fim();
