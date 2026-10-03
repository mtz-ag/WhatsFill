/**
 * Testes do `contatos-para-vcf.mjs`. Node puro, sem dependencia.
 *
 * **TODO numero e TODO nome aqui sao FICTICIOS** — a regra do projeto vale para teste tambem:
 * telefone ou nome de eleitor real nao entra em arquivo do repositorio. Os celulares usam a faixa
 * 9000-0000, que ninguem tem.
 *
 * Metade das asercoes de `normalizarTelefone` e sobre o que NAO pode passar: numero errado no .vcf
 * e uma mensagem para um desconhecido, e cada uma dessas e um sinal ruim contra o numero que
 * dispara.
 */

import {
  normalizarTelefone,
  lerCsv,
  dobrarLinhaVcard,
  montarVcf,
  lerVariacoes,
  montarPlano,
  planoParaCsv,
} from './contatos-para-vcf.mjs';

let passou = 0;
let falhou = 0;

function ok(condicao, titulo) {
  if (condicao) { passou++; } else { falhou++; console.error(`  FALHOU: ${titulo}`); }
}
function igual(a, b, titulo) {
  const bate = JSON.stringify(a) === JSON.stringify(b);
  if (!bate) console.error(`  FALHOU: ${titulo}\n    esperado ${JSON.stringify(b)}\n    veio     ${JSON.stringify(a)}`);
  bate ? passou++ : falhou++;
}
function grupo(nome) { console.log(`\n${nome}`); }

/* ------------------------------------------------------------------ */
grupo('normalizarTelefone — as formas que a planilha traz');

igual(normalizarTelefone('(51) 90000-0001').numero, '+5551900000001', 'com parenteses e hifen');
igual(normalizarTelefone('51900000001').numero, '+5551900000001', 'so digitos, com DDD');
igual(normalizarTelefone('5551900000001').numero, '+5551900000001', 'com o 55 do pais');
igual(normalizarTelefone('+55 51 90000-0001').numero, '+5551900000001', 'com mais e espacos');
igual(normalizarTelefone('005551900000001').numero, '+5551900000001', 'discagem internacional 0055');
igual(normalizarTelefone(' 51 9 0000 0001 ').numero, '+5551900000001', 'espacos no meio');

grupo('normalizarTelefone — o NONO DIGITO (cadastro antigo)');

igual(normalizarTelefone('5190000001').numero, '+5551990000001', '8 digitos comecando em 9: insere o 9');
igual(normalizarTelefone('5460000001').numero, '+5554960000001', '8 digitos comecando em 6: insere o 9');
igual(normalizarTelefone('555590000001').numero, '+5555990000001', '55 do pais + DDD 55 + 8 digitos');

grupo('normalizarTelefone — o 55 do pais contra o DDD 55');

igual(normalizarTelefone('55900000001').numero, '+5555900000001', '11 digitos: DDD 55, nao e codigo de pais');
igual(normalizarTelefone('5555900000001').numero, '+5555900000001', '13 digitos: pais 55 + DDD 55');

grupo('normalizarTelefone — o que NAO pode passar');

ok(!normalizarTelefone('').ok, 'vazio');
ok(!normalizarTelefone(null).ok, 'nulo');
ok(!normalizarTelefone('nao tenho').ok, 'texto sem digito');
igual(normalizarTelefone('900000001').motivo, 'sem DDD', '9 digitos: recusa em vez de chutar o DDD');
igual(normalizarTelefone('90000001').motivo, 'sem DDD', '8 digitos: recusa');
ok(!normalizarTelefone('519000000012345').ok, 'digitos demais');
igual(normalizarTelefone('2090000001').motivo, 'DDD 20 nao existe', 'DDD que nao existe');
igual(normalizarTelefone('3090000001').motivo, 'DDD 30 nao existe', 'DDD 30 nao existe');
igual(normalizarTelefone('3690000001').motivo, 'DDD 36 nao existe', 'DDD 36 foi desativado');
igual(normalizarTelefone('5132000001').motivo, 'telefone fixo', 'fixo (comeca em 3) fica de fora');
igual(normalizarTelefone('5122000001').motivo, 'telefone fixo', 'fixo (comeca em 2) fica de fora');
igual(normalizarTelefone('51222222222').motivo, 'nao parece celular', '9 digitos que nao comecam em 9');
igual(normalizarTelefone('51999999999').motivo, 'digito repetido', 'digito repetido e lixo de digitacao');

grupo('normalizarTelefone — fixo entra so quando ele pede');

ok(normalizarTelefone('5132000001', { incluirFixo: true }).ok, 'com --incluir-fixo o fixo passa');
igual(normalizarTelefone('5132000001', { incluirFixo: true }).numero, '+555132000001', 'fixo fica com 8 digitos');

grupo('normalizarTelefone — marca o que e de fora do RS');

ok(normalizarTelefone('51900000001').foraDoRS === false, 'DDD 51 e do RS');
ok(normalizarTelefone('53900000001').foraDoRS === false, 'DDD 53 e do RS');
ok(normalizarTelefone('11900000001').foraDoRS === true, 'DDD 11 nao e do RS');

/* ------------------------------------------------------------------ */
grupo('lerCsv — o que o Excel produz');

igual(lerCsv('a;b\n1;2\n').linhas, [['a', 'b'], ['1', '2']], 'ponto e virgula (Excel em portugues)');
igual(lerCsv('a,b\n1,2\n').linhas, [['a', 'b'], ['1', '2']], 'virgula');
igual(lerCsv('a\tb\n1\t2\n').linhas, [['a', 'b'], ['1', '2']], 'tabulacao');
igual(lerCsv('a;b\r\n1;2\r\n').linhas, [['a', 'b'], ['1', '2']], 'quebra de linha do Windows');
igual(
  lerCsv('nome;tel\n"Silva, Maria Teste";51900000001\n').linhas[1],
  ['Silva, Maria Teste', '51900000001'],
  'separador DENTRO de aspas nao parte o campo'
);
igual(
  lerCsv('nome;tel\n"Maria ""Teste"" Silva";51900000001\n').linhas[1][0],
  'Maria "Teste" Silva',
  'aspas escapadas'
);
igual(
  lerCsv('nome;obs\n"Maria Teste";"linha 1\nlinha 2"\n').linhas[1][1],
  'linha 1\nlinha 2',
  'quebra de linha dentro do campo'
);
igual(lerCsv('a;b\n\n1;2\n\n').linhas.length, 2, 'linha vazia nao conta');

/* ------------------------------------------------------------------ */
grupo('dobrarLinhaVcard — 75 octetos, cortando em caractere');

ok(dobrarLinhaVcard('FN:Maria Teste') === 'FN:Maria Teste', 'linha curta fica igual');
{
  const longa = `FN:${'a'.repeat(200)}`;
  const dobrada = dobrarLinhaVcard(longa);
  const pedacos = dobrada.split('\r\n');
  ok(pedacos.length > 1, 'linha longa e dobrada');
  ok(pedacos.slice(1).every((p) => p.startsWith(' ')), 'a continuacao comeca com espaco');
  ok(pedacos.every((p) => Buffer.byteLength(p, 'utf8') <= 75), 'nenhum pedaco passa de 75 octetos');
  igual(dobrada.replace(/\r\n /g, ''), longa, 'juntando de volta da o texto original');
}
{
  // Acento ocupa 2 bytes e emoji 4: o corte por POSICAO partiria o caractere no meio.
  const longa = `FN:${'á'.repeat(60)}`;
  const dobrada = dobrarLinhaVcard(longa);
  ok(dobrada.split('\r\n').every((p) => Buffer.byteLength(p, 'utf8') <= 75), 'acento: respeita os octetos');
  igual(dobrada.replace(/\r\n /g, ''), longa, 'acento: nenhum caractere foi partido');
}
{
  const longa = `FN:${'\u{1F600}'.repeat(40)}`; // emoji = par de surrogates
  const dobrada = dobrarLinhaVcard(longa);
  igual(dobrada.replace(/\r\n /g, ''), longa, 'emoji: nenhum par de surrogates foi partido');
}

/* ------------------------------------------------------------------ */
grupo('montarVcf');

{
  const vcf = montarVcf([{ nome: 'ZDISPARO Maria Teste', numero: '+5551900000001' }]);
  ok(vcf.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n'), 'abre com BEGIN e VERSION 3.0');
  ok(vcf.includes('FN:ZDISPARO Maria Teste'), 'tem o nome em FN');
  ok(vcf.includes('N:;ZDISPARO Maria Teste;;;'), 'tem o nome em N');
  ok(vcf.includes('TEL;TYPE=CELL:+5551900000001'), 'tem o telefone como celular');
  ok(vcf.trimEnd().endsWith('END:VCARD'), 'fecha com END');
  ok(vcf.includes('\r\n') && !vcf.includes('\n\n'), 'linhas terminam em CRLF');
}
{
  const vcf = montarVcf([{ nome: 'Silva, Maria; Teste', numero: '+5551900000001' }]);
  ok(vcf.includes('FN:Silva\\, Maria\\; Teste'), 'virgula e ponto e virgula sao escapados');
}
{
  const vcf = montarVcf([
    { nome: 'A Teste', numero: '+5551900000001' },
    { nome: 'B Teste', numero: '+5551900000002' },
  ]);
  igual((vcf.match(/BEGIN:VCARD/g) || []).length, 2, 'dois contatos, dois cartoes');
}

/* ------------------------------------------------------------------ */
grupo('lerVariacoes');

igual(lerVariacoes('um\n---\ndois\n---\ntres').length, 3, 'tres variacoes separadas por ---');
igual(lerVariacoes('um\n---\ndois')[0], 'um', 'primeira variacao');
igual(lerVariacoes('um\n-----\ndois').length, 2, 'mais de tres tracos tambem separa');
igual(lerVariacoes('linha 1\nlinha 2\n---\noutra')[0], 'linha 1\nlinha 2', 'variacao de varias linhas');
igual(lerVariacoes('').length, 0, 'arquivo vazio nao tem variacao');
igual(lerVariacoes('um\n---\n\n---\ndois').length, 2, 'pedaco vazio no meio nao conta');

/* ------------------------------------------------------------------ */
grupo('montarPlano — reveza, e nunca dois iguais em sequencia');

{
  const contatos = Array.from({ length: 10 }, (_, i) => ({
    numero: `+555190000000${i}`,
    nome: `Teste ${i}`,
  }));
  const plano = montarPlano(contatos, ['A', 'B', 'C']);
  igual(plano.length, 10, 'uma mensagem por contato');
  igual(plano.map((p) => p.texto).join(''), 'ABCABCABCA', 'reveza em circulo');
  ok(
    plano.every((p, i) => i === 0 || p.texto !== plano[i - 1].texto),
    'nenhum par seguido recebe o mesmo texto'
  );
  igual(plano[0].variacao, 1, 'a variacao e contada de 1');
}
{
  // Uma variacao so: o revezamento nao tem o que fazer, e o plano nao mente sobre isso.
  const plano = montarPlano([{ numero: '+5551900000001', nome: 'Teste' }], ['so uma']);
  igual(plano[0].texto, 'so uma', 'uma variacao sai para todos');
}
{
  // O nome NAO entra no texto: decisao antiga do projeto (o nome do CRM erra demais).
  const plano = montarPlano([{ numero: '+5551900000001', nome: 'ZDISPARO Maria Teste' }], ['Ola {{nome}}']);
  igual(plano[0].texto, 'Ola {{nome}}', 'variavel NAO e substituida — sai como esta escrita');
}

/* ------------------------------------------------------------------ */
grupo('planoParaCsv');

{
  const csv = planoParaCsv([
    { numero: '+5551900000001', nome: 'ZDISPARO Maria Teste', variacao: 1, texto: 'Ola; tudo bem?' },
  ]);
  ok(csv.startsWith('telefone;nome;variacao;texto'), 'tem cabecalho');
  ok(csv.includes('"Ola; tudo bem?"'), 'texto com ponto e virgula sai entre aspas');
}
{
  const csv = planoParaCsv([{ numero: '+5551900000001', nome: 'T', variacao: 1, texto: 'diz "oi"' }]);
  ok(csv.includes('"diz ""oi"""'), 'aspas dentro do texto sao escapadas');
}
{
  const csv = planoParaCsv([{ numero: '+5551900000001', nome: 'T', variacao: 1, texto: 'linha 1\nlinha 2' }]);
  ok(csv.includes('"linha 1\nlinha 2"'), 'texto de varias linhas sai entre aspas');
}

/* ------------------------------------------------------------------ */
console.log(`\n${passou} passou, ${falhou} falhou`);
process.exit(falhou ? 1 : 0);
