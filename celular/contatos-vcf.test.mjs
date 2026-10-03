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

import zlib from 'node:zlib';
import {
  normalizarTelefone,
  lerCsv,
  dobrarLinhaVcard,
  montarVcf,
  lerVariacoes,
  montarPlano,
  planoParaCsv,
  separadorSuspeito,
  desescaparXml,
  etiquetasDaCelula,
  pularPorEtiqueta,
  lerXlsx,
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
grupo('lerVariacoes — o separador e a linha de IGUAIS');

igual(lerVariacoes('um\n===\ndois\n===\ntres').length, 3, 'tres variacoes separadas por ===');
igual(lerVariacoes('um\n===\ndois')[0], 'um', 'primeira variacao');
igual(lerVariacoes('um\n=====\ndois').length, 2, 'mais de tres iguais tambem separa');
igual(lerVariacoes('linha 1\nlinha 2\n===\noutra')[0], 'linha 1\nlinha 2', 'variacao de varias linhas');
igual(lerVariacoes('').length, 0, 'arquivo vazio nao tem variacao');
igual(lerVariacoes('um\n===\n\n===\ndois').length, 2, 'pedaco vazio no meio nao conta');

/**
 * A colinha dele tem uma regua de tracos separando a abertura dos numeros. Ela NAO pode partir a
 * mensagem: se partisse, a introducao sairia para uma pessoa e os numeros para a seguinte.
 */
{
  const comRegua = 'Aqui e a equipe!\n\n-----------------------------------\n\nCOLINHA 2026\n2228 Fulano';
  igual(lerVariacoes(comRegua).length, 1, 'linha de tracos NAO separa');
  ok(lerVariacoes(comRegua)[0].includes('2228'), 'os numeros continuam na mesma mensagem');
}
igual(lerVariacoes('a\n===\nb\n---\nc').length, 2, 'traco dentro da variacao nao conta');
igual(lerVariacoes('a\n  ===  \nb').length, 2, 'espaco em volta do separador nao atrapalha');
igual(lerVariacoes('a\nb === c\nd').length, 1, 'iguais no MEIO da linha nao separa');

grupo('separadorSuspeito — pega quem usou o separador velho');

ok(separadorSuspeito('um\n---\ndois'), 'so tracos: suspeito');
ok(!separadorSuspeito('um\n===\ndois'), 'so iguais: certo');
ok(!separadorSuspeito('Aqui e a equipe\n-----\nCOLINHA\n===\noutra'), 'tendo iguais, o traco e so pontuacao');
ok(!separadorSuspeito('uma mensagem so, sem separador nenhum'), 'sem separador nao e suspeito');

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
grupo('desescaparXml — o & vem escrito &amp; na exportacao de verdade');

igual(desescaparXml('MARTIM-&amp;-PEDRI'), 'MARTIM-&-PEDRI', 'e comercial');
igual(desescaparXml('a &lt;b&gt; c'), 'a <b> c', 'menor e maior');
igual(desescaparXml('diz &quot;oi&quot;'), 'diz "oi"', 'aspas');
igual(desescaparXml('d&apos;Agua'), "d'Agua", 'apostrofo (Olho d\'Agua)');
igual(desescaparXml('Jo&#227;o'), 'João', 'numerica decimal');
igual(desescaparXml('Jo&#xE3;o'), 'João', 'numerica hexadecimal');
igual(desescaparXml('100% &naoexiste; ok'), '100% &naoexiste; ok', 'entidade desconhecida fica como esta');
igual(desescaparXml('a &amp;amp; b'), 'a &amp; b', 'desescapa uma vez so, nao em cascata');

/* ------------------------------------------------------------------ */
grupo('etiquetasDaCelula');

igual(etiquetasDaCelula('ADS, SERRA, COLINHA'), ['ADS', 'SERRA', 'COLINHA'], 'separadas por virgula');
igual(etiquetasDaCelula('ADS;SERRA'), ['ADS', 'SERRA'], 'ponto e virgula tambem separa');
igual(etiquetasDaCelula('  ADS ,  SERRA  '), ['ADS', 'SERRA'], 'espacos em volta somem');
igual(etiquetasDaCelula('ADS,,SERRA'), ['ADS', 'SERRA'], 'vazio no meio nao conta');
igual(etiquetasDaCelula(''), [], 'celula vazia');
igual(etiquetasDaCelula(null), [], 'celula nula');
igual(etiquetasDaCelula('MARTIM-&-PEDRI'), ['MARTIM-&-PEDRI'], 'o & nao separa nada');

/* ------------------------------------------------------------------ */
grupo('pularPorEtiqueta — nome EXATO, acento e caixa nao contam');

{
  const pular = new Set(['colinha']);
  igual(pularPorEtiqueta(['ADS', 'COLINHA'], pular), 'COLINHA', 'casa em caixa alta');
  igual(pularPorEtiqueta(['colinha'], pular), 'colinha', 'casa em caixa baixa');
  igual(pularPorEtiqueta(['Colinha'], pular), 'Colinha', 'casa em caixa mista');
  igual(pularPorEtiqueta(['ADS', 'SERRA'], pular), null, 'quem nao tem, nao pula');
  igual(pularPorEtiqueta([], pular), null, 'sem etiqueta nenhuma');
}
{
  // Esta base tem SERRA e Serra como etiquetas diferentes — 15 grupos assim, medidos.
  const pular = new Set(['serra']);
  ok(pularPorEtiqueta(['SERRA'], pular) === 'SERRA', 'SERRA e Serra sao a mesma coisa aqui');
  ok(pularPorEtiqueta(['Serra'], pular) === 'Serra', 'idem ao contrario');
}
{
  // O perigo da lista de EXCLUSAO e o trecho contido: "col" nao pode levar meia base junto.
  const pular = new Set(['col']);
  igual(pularPorEtiqueta(['COLINHA'], pular), null, 'trecho contido NAO casa (COLINHA)');
  igual(pularPorEtiqueta(['Noroeste Colonial'], pular), null, 'trecho contido NAO casa (Colonial)');
  igual(pularPorEtiqueta(['COLORADO'], pular), null, 'trecho contido NAO casa (COLORADO)');
}
{
  const pular = new Set(['naoperturbe']);
  igual(pularPorEtiqueta(['Nao Perturbe'], pular), 'Nao Perturbe', 'espaco nao conta');
  igual(pularPorEtiqueta(['NÃO-PERTURBE'], pular), 'NÃO-PERTURBE', 'acento e hifen nao contam');
}

/* ------------------------------------------------------------------ */
grupo('lerXlsx — zip e XML sem dependencia nenhuma');

/**
 * Monta um .xlsx de mentira na memoria. O CRC vai zerado de proposito: o leitor nao o confere, e
 * implementar CRC32 aqui so para o teste seria codigo que nada do programa exercita.
 */
function zipDeMentira(arquivos) {
  const locais = [];
  const indice = [];
  let posicao = 0;
  for (const [nome, conteudo] of arquivos) {
    const cru = Buffer.from(conteudo, 'utf8');
    const comprimido = zlib.deflateRawSync(cru);
    const nomeBuf = Buffer.from(nome, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(cru.length, 22);
    local.writeUInt16LE(nomeBuf.length, 26);
    locais.push(local, nomeBuf, comprimido);

    const entrada = Buffer.alloc(46);
    entrada.writeUInt32LE(0x02014b50, 0);
    entrada.writeUInt16LE(20, 4);
    entrada.writeUInt16LE(20, 6);
    entrada.writeUInt16LE(8, 10);
    entrada.writeUInt32LE(comprimido.length, 20);
    entrada.writeUInt32LE(cru.length, 24);
    entrada.writeUInt16LE(nomeBuf.length, 28);
    entrada.writeUInt32LE(posicao, 42);
    indice.push(entrada, nomeBuf);

    posicao += local.length + nomeBuf.length + comprimido.length;
  }
  const corpo = Buffer.concat(locais);
  const dir = Buffer.concat(indice);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(dir.length, 12);
  fim.writeUInt32LE(corpo.length, 16);
  return Buffer.concat([corpo, dir, fim]);
}

const planilha = (linhasXml, extras = []) =>
  zipDeMentira([
    ['xl/worksheets/sheet1.xml', `<?xml version="1.0"?><worksheet><sheetData>${linhasXml}</sheetData></worksheet>`],
    ...extras,
  ]);

const emLinha = (ref, valor) => `<c r="${ref}" t="inlineStr"><is><t>${valor}</t></is></c>`;

{
  const buf = planilha(
    `<row r="1">${emLinha('A1', 'Nome')}${emLinha('B1', 'Telefone')}</row>` +
      `<row r="2">${emLinha('A2', 'Maria Teste')}${emLinha('B2', '51900000001')}</row>`
  );
  igual(lerXlsx(buf), [['Nome', 'Telefone'], ['Maria Teste', '51900000001']], 'cabecalho e uma linha');
}
{
  // Celula vazia SOME do XML: a posicao tem de sair da letra, nao da ordem de aparicao.
  const buf = planilha(
    `<row r="1">${emLinha('A1', 'Nome')}${emLinha('B1', 'Email')}${emLinha('C1', 'Telefone')}</row>` +
      `<row r="2">${emLinha('A2', 'Maria Teste')}${emLinha('C2', '51900000001')}</row>`
  );
  igual(lerXlsx(buf)[1], ['Maria Teste', '', '51900000001'], 'coluna vazia nao escorrega as outras');
}
{
  // Celula que se fecha sozinha nao pode roubar o valor da vizinha.
  const buf = planilha(`<row r="1"><c r="A1"/>${emLinha('B1', 'valor de B')}</row>`);
  igual(lerXlsx(buf)[0], ['', 'valor de B'], 'celula auto-fechada fica vazia e a seguinte mantem o valor');
}
{
  const buf = planilha(
    `<row r="1">${emLinha('A1', 'Etiquetas')}</row><row r="2">${emLinha('A2', 'MARTIM-&amp;-PEDRI')}</row>`
  );
  igual(lerXlsx(buf)[1][0], 'MARTIM-&-PEDRI', 'o &amp; e desfeito na leitura');
}
{
  // Telefone guardado como NUMERO nao tem <t>, so <v>.
  const buf = planilha(`<row r="1"><c r="A1"><v>51900000001</v></c></row>`);
  igual(lerXlsx(buf)[0], ['51900000001'], 'celula numerica');
}
{
  // O caminho da tabela compartilhada, que e como o Excel salva por cima.
  const buf = planilha(
    `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>`,
    [['xl/sharedStrings.xml', '<?xml version="1.0"?><sst><si><t>Nome</t></si><si><t>Telefone</t></si></sst>']]
  );
  igual(lerXlsx(buf)[0], ['Nome', 'Telefone'], 'cadeias da tabela compartilhada');
}
{
  const buf = planilha(
    `<row r="1">${emLinha('A1', 'Nome')}</row><row r="2"/><row r="3">${emLinha('A3', 'Maria Teste')}</row>`
  );
  igual(lerXlsx(buf).length, 2, 'linha vazia nao vira contato');
}
{
  const buf = planilha(`<row r="1"><c r="A1" t="inlineStr"><is><r><t>Ma</t></r><r><t>ria</t></r></is></c></row>`);
  igual(lerXlsx(buf)[0], ['Maria'], 'texto rico (varios <t>) vira um valor so');
}
{
  let estourou = false;
  try { lerXlsx(Buffer.from('isto nao e um zip')); } catch { estourou = true; }
  ok(estourou, 'arquivo que nao e .xlsx reclama em vez de devolver lixo');
}

/* ------------------------------------------------------------------ */
console.log(`\n${passou} passou, ${falhou} falhou`);
process.exit(falhou ? 1 : 0);
