#!/usr/bin/env node
/**
 * contatos-para-vcf.mjs — transforma a exportacao de contatos do mobiliza num arquivo .vcf que o
 * proprio aplicativo de Contatos do Android importa, sem app nenhum no meio.
 *
 * **POR QUE ISTO EXISTE, e por que NAO e um app:** a metade "adicionar os contatos no celular" do
 * plano dele e um FORMATO DE ARQUIVO, nao um programa. O Android (e o iPhone, e o Google Contatos)
 * importam vCard desde sempre: Contatos -> Configuracoes -> Importar -> .vcf. Escrever um app para
 * fazer isso seria pedir permissao de contatos para repetir o que o sistema ja faz melhor.
 *
 * **O QUE ESTE ARQUIVO NAO FAZ, de proposito:** ele nao manda mensagem e nao abre o WhatsApp. O que
 * ele entrega e (1) o .vcf dos contatos e (2) o PLANO de mensagens — qual texto vai para qual
 * numero, ja revezando entre as variacoes. Quem dispara e outra coisa, e essa escolha esta escrita
 * no `celular/README.md` com o preco de cada caminho.
 *
 * **NADA DE DADO DE ELEITOR ENTRA NO REPOSITORIO.** O arquivo de entrada e o de saida ficam onde ele
 * mandar — por padrao, na pasta da entrada. A ferramenta RECUSA escrever dentro do repositorio, e o
 * relatorio na tela conta LINHAS e MOTIVOS, nunca nome nem telefone.
 *
 * Uso:
 *   node celular/contatos-para-vcf.mjs <entrada.csv> [opcoes]
 *
 *   --saida=<caminho>        onde escrever (padrao: ao lado da entrada)
 *   --prefixo=<texto>        prefixo no nome, para achar e APAGAR em massa depois (padrao: ZDISPARO)
 *   --por-arquivo=<n>        quebra em varios .vcf de n cartoes (padrao: 500; 0 = um arquivo so)
 *   --mensagens=<arquivo>    variacoes de texto separadas por uma linha com ---, gera o plano
 *   --coluna-telefone=<nome> forca a coluna do telefone (quando o cabecalho nao for reconhecido)
 *   --coluna-nome=<nome>     forca a coluna do nome
 *   --incluir-fixo           inclui telefone fixo (fora por padrao: quase nenhum tem WhatsApp)
 *   --sem-prefixo            nao prefixa o nome (leia o aviso antes de usar)
 */

import fs from 'node:fs';
import path from 'node:path';

/* ------------------------------------------------------------------ *
 * Telefone brasileiro
 * ------------------------------------------------------------------ */

/**
 * Os DDDs que existem. A lista e de PERMISSAO de proposito: numero com DDD inventado (20, 23, 30,
 * 52, 70, 90...) e lixo de digitacao, e aceitar o que nao existe poe um numero que nunca vai
 * entregar no meio da fila — e cada tentativa dessas e um sinal ruim para o numero que dispara.
 */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Os quatro DDDs do Rio Grande do Sul — a base e estadual, entao o resto merece ser contado. */
const DDDS_DO_RS = new Set([51, 53, 54, 55]);

/**
 * Normaliza para o formato que o WhatsApp usa: `+55` + DDD + numero.
 *
 * **As armadilhas, todas reais nesta base:**
 * - **O "55" do pais colide com o DDD 55** (Santa Rosa, Santo Angelo). Por isso o `55` da frente so
 *   e tirado quando o que sobra tem tamanho de numero COM DDD — `55999999999` (11 digitos) e o
 *   celular de um DDD 55, e nao um numero sem DDD.
 * - **O NONO DIGITO.** Cadastro antigo guarda o celular com 8 digitos; hoje todo celular tem 9. Um
 *   numero sem o 9 nao entrega: o `9` e inserido quando o numero local tem 8 digitos e comeca em
 *   6-9 (faixa de celular). Comecando em 2-5 e FIXO, e fixo fica de fora.
 * - **Sem DDD nao da para adivinhar.** Nove digitos soltos sao recusados em vez de receber um `51`
 *   por conta propria: chutar o DDD manda a mensagem para um desconhecido de outra cidade.
 */
export function normalizarTelefone(bruto, { incluirFixo = false } = {}) {
  let n = String(bruto ?? '').replace(/[^0-9]/g, '');
  if (!n) return { ok: false, motivo: 'sem telefone' };

  // Discagem internacional escrita a mao: 00 55 ...
  if (n.startsWith('0055')) n = n.slice(2);
  // Zero de operadora: 0 51 9...
  if (n.length === 12 && n.startsWith('0')) n = n.slice(1);

  if (n.startsWith('55') && (n.length === 12 || n.length === 13)) n = n.slice(2);

  if (n.length > 11) return { ok: false, motivo: 'digitos demais' };
  if (n.length < 10) return { ok: false, motivo: n.length === 9 || n.length === 8 ? 'sem DDD' : 'digitos de menos' };

  const ddd = Number(n.slice(0, 2));
  if (!DDDS.has(ddd)) return { ok: false, motivo: `DDD ${n.slice(0, 2)} nao existe` };

  let local = n.slice(2);

  if (local.length === 8) {
    const primeiro = local[0];
    if (primeiro >= '6' && primeiro <= '9') {
      local = `9${local}`; // nono digito
    } else if (!incluirFixo) {
      return { ok: false, motivo: 'telefone fixo' };
    }
  } else if (local[0] !== '9' && !incluirFixo) {
    // 9 digitos que nao comecam em 9 nao e celular brasileiro.
    return { ok: false, motivo: 'nao parece celular' };
  }

  if (/^(\d)\1+$/.test(local)) return { ok: false, motivo: 'digito repetido' };

  return { ok: true, numero: `+55${n.slice(0, 2)}${local}`, ddd, foraDoRS: !DDDS_DO_RS.has(ddd) };
}

/* ------------------------------------------------------------------ *
 * CSV
 * ------------------------------------------------------------------ */

/**
 * Le o arquivo decidindo a codificacao pelo conteudo. Exportacao de planilha vem em UTF-8 **ou** em
 * Windows-1252, e abrir 1252 como UTF-8 nao da erro: da "JoÃ£o" — nome torto que vira contato torto
 * no celular dele. O teste e tentar UTF-8 em modo severo e cair para 1252 quando ele reclamar.
 */
function lerTexto(caminho) {
  let bytes = fs.readFileSync(caminho);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    bytes = bytes.subarray(3); // BOM do Excel
  }
  try {
    return { texto: new TextDecoder('utf-8', { fatal: true }).decode(bytes), codificacao: 'UTF-8' };
  } catch {
    return { texto: new TextDecoder('windows-1252').decode(bytes), codificacao: 'Windows-1252' };
  }
}

/** Virgula, ponto e virgula ou tabulacao — o Excel em portugues exporta com ponto e virgula. */
function detectarSeparador(primeiraLinha) {
  const conta = (c) => primeiraLinha.split(c).length - 1;
  const candidatos = [
    ['\t', conta('\t')],
    [';', conta(';')],
    [',', conta(',')],
  ];
  candidatos.sort((a, b) => b[1] - a[1]);
  return candidatos[0][1] > 0 ? candidatos[0][0] : ',';
}

/** Leitor de CSV com aspas, separador dentro de aspas e quebra de linha dentro de campo. */
export function lerCsv(texto, separador) {
  const sep = separador || detectarSeparador(texto.split(/\r?\n/, 1)[0] || '');
  const linhas = [];
  let campo = '';
  let linha = [];
  let dentroDeAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else { dentroDeAspas = false; }
      } else {
        campo += c;
      }
      continue;
    }
    if (c === '"') { dentroDeAspas = true; continue; }
    if (c === sep) { linha.push(campo); campo = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; continue; }
    campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }

  return { linhas: linhas.filter((l) => l.some((v) => String(v).trim() !== '')), separador: sep };
}

const semAcentoNemCaixa = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/**
 * Acha a coluna do telefone e a do nome pelo cabecalho. **O formato da exportacao do mobiliza nao
 * foi observado**, entao a lista e larga e, nao achando, a ferramenta IMPRIME O CABECALHO e para —
 * em vez de escolher a primeira coluna com cara de numero e montar um .vcf errado em silencio.
 */
const CABECALHO_TELEFONE = [
  'telefone', 'telefone1', 'telefones', 'celular', 'whatsapp', 'fone', 'numero', 'numerodetelefone',
  'phone', 'phonenumber', 'mobile', 'tel',
];
const CABECALHO_NOME = ['nome', 'nomecompleto', 'contato', 'name', 'fullname', 'razaosocial', 'cliente'];

function acharColunas(cabecalho, forcadas) {
  const chaves = cabecalho.map(semAcentoNemCaixa);
  const porLista = (lista) => {
    for (const alvo of lista) {
      const i = chaves.indexOf(alvo);
      if (i >= 0) return i;
    }
    // segundo passe: o cabecalho CONTEM a palavra ("Telefone principal")
    for (const alvo of lista) {
      const i = chaves.findIndex((c) => c.includes(alvo));
      if (i >= 0) return i;
    }
    return -1;
  };
  const forcada = (nome) => (nome ? chaves.indexOf(semAcentoNemCaixa(nome)) : -1);

  const tel = forcadas.telefone ? forcada(forcadas.telefone) : porLista(CABECALHO_TELEFONE);
  const nome = forcadas.nome ? forcada(forcadas.nome) : porLista(CABECALHO_NOME);
  return { tel, nome };
}

/* ------------------------------------------------------------------ *
 * vCard
 * ------------------------------------------------------------------ */

/** Escapa o que o vCard trata como estrutura. Sem isso, "Silva, Maria" parte o campo em dois. */
const escaparVcard = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

/**
 * Dobra a linha em 75 octetos, como o vCard pede — **contando BYTES e cortando em CARACTERE**. Nome
 * com acento ocupa 2 bytes e emoji 4: cortar por posicao de string parte o caractere no meio e
 * alguns importadores engolem o cartao inteiro. E a mesma classe do corte que partiu emoji no
 * prompt da IA (22/09) — aqui o preco seria um contato sem nome no celular dele.
 */
export function dobrarLinhaVcard(linha) {
  const tamanho = (s) => Buffer.byteLength(s, 'utf8');
  if (tamanho(linha) <= 75) return linha;

  const partes = [];
  let atual = '';
  let limite = 75;
  for (const ch of linha) {
    if (tamanho(atual) + tamanho(ch) > limite) {
      partes.push(atual);
      atual = ch;
      limite = 74; // a continuacao gasta um octeto com o espaco da frente
    } else {
      atual += ch;
    }
  }
  if (atual) partes.push(atual);
  return partes.join('\r\n ');
}

function cartao({ nome, numero }) {
  const n = escaparVcard(nome);
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    dobrarLinhaVcard(`N:;${n};;;`),
    dobrarLinhaVcard(`FN:${n}`),
    dobrarLinhaVcard(`TEL;TYPE=CELL:${numero}`),
    'END:VCARD',
  ].join('\r\n');
}

export function montarVcf(contatos) {
  return `${contatos.map(cartao).join('\r\n')}\r\n`;
}

/* ------------------------------------------------------------------ *
 * O plano de mensagens
 * ------------------------------------------------------------------ */

/**
 * As variacoes vem de um arquivo de texto, separadas por uma linha com `---`.
 *
 * **Por que texto e nao JSON:** ele escreve e reescreve essas mensagens o tempo todo, e JSON quebra
 * com uma virgula fora de lugar — num arquivo cujo erro aparece como "nenhuma variacao encontrada"
 * em cima da janela de disparo.
 */
export function lerVariacoes(texto) {
  return String(texto ?? '')
    .split(/^\s*-{3,}\s*$/m)
    .map((t) => t.replace(/^\s*\n/, '').replace(/\s+$/, ''))
    .filter((t) => t.trim() !== '');
}

/**
 * Qual texto vai para qual numero. O revezamento e circular (`i % n`), entao **dois contatos
 * seguidos nunca recebem o mesmo texto** enquanto houver mais de uma variacao — e e o ritmo e a
 * REPETICAO que o WhatsApp pune, nao o conteudo.
 *
 * **Nenhuma variavel e substituida, e isso e decisao antiga do projeto:** mensagem nao chama a
 * pessoa pelo nome, porque o nome do CRM erra demais (apelido do perfil, cidade no campo do nome,
 * "[NOVO] ..."), e errar o nome num disparo e pior que nao ter nome nenhum.
 */
export function montarPlano(contatos, variacoes) {
  return contatos.map((c, i) => ({
    numero: c.numero,
    nome: c.nome,
    variacao: (i % variacoes.length) + 1,
    texto: variacoes[i % variacoes.length],
  }));
}

const csvCampo = (v) => {
  const s = String(v ?? '');
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function planoParaCsv(plano) {
  const linhas = [['telefone', 'nome', 'variacao', 'texto'].join(';')];
  for (const p of plano) {
    linhas.push([p.numero, p.nome, p.variacao, p.texto].map(csvCampo).join(';'));
  }
  return `${linhas.join('\r\n')}\r\n`;
}

/* ------------------------------------------------------------------ *
 * Linha de comando
 * ------------------------------------------------------------------ */

function opcoes(argv) {
  const o = { _: [] };
  for (const a of argv) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
    if (m) o[m[1]] = m[2] === undefined ? true : m[2];
    else o._.push(a);
  }
  return o;
}

function dentroDoRepositorio(caminho) {
  const repo = path.resolve(import.meta.dirname, '..');
  const rel = path.relative(repo, path.resolve(caminho));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function principal(argv) {
  const o = opcoes(argv);
  const entrada = o._[0];
  if (!entrada) {
    console.error('Uso: node celular/contatos-para-vcf.mjs <entrada.csv> [--saida=...] [--mensagens=...]');
    console.error('     (planilha do Excel: "Salvar como" -> CSV UTF-8)');
    process.exit(2);
  }
  if (!fs.existsSync(entrada)) {
    console.error(`Nao achei o arquivo: ${entrada}`);
    process.exit(2);
  }

  const prefixo = o['sem-prefixo'] ? '' : String(o.prefixo ?? 'ZDISPARO');
  const porArquivo = o['por-arquivo'] === undefined ? 500 : Number(o['por-arquivo']);
  const incluirFixo = Boolean(o['incluir-fixo']);

  const saidaBase = o.saida
    ? String(o.saida).replace(/\.vcf$/i, '')
    : path.join(path.dirname(path.resolve(entrada)), `${path.basename(entrada).replace(/\.[^.]+$/, '')}-contatos`);

  /**
   * **A pasta do repositorio E a extensao carregada, e dado de eleitor nao entra nela.** As duas
   * razoes se somam aqui: arquivo temporario na raiz derruba o carregamento da extensao, e o .vcf
   * tem nome e telefone de gente real.
   */
  if (dentroDoRepositorio(saidaBase)) {
    console.error('A saida esta DENTRO do repositorio, e dado de eleitor nao entra aqui.');
    console.error('Passe --saida= com um caminho de fora (a Area de Trabalho serve).');
    process.exit(2);
  }

  const { texto, codificacao } = lerTexto(entrada);
  const { linhas, separador } = lerCsv(texto);
  if (!linhas.length) {
    console.error('O arquivo esta vazio.');
    process.exit(2);
  }

  const cabecalho = linhas[0];
  const { tel, nome } = acharColunas(cabecalho, { telefone: o['coluna-telefone'], nome: o['coluna-nome'] });
  if (tel < 0) {
    console.error('Nao reconheci a coluna do telefone. O cabecalho do arquivo e:');
    cabecalho.forEach((c, i) => console.error(`  [${i}] ${c}`));
    console.error('\nRode de novo com --coluna-telefone="<o nome exato da coluna>"');
    process.exit(2);
  }

  const vistos = new Map();
  const recusados = new Map();
  const porDdd = new Map();
  let repetidos = 0;
  let foraDoRS = 0;

  for (let i = 1; i < linhas.length; i++) {
    const r = normalizarTelefone(linhas[i][tel], { incluirFixo });
    if (!r.ok) {
      const lista = recusados.get(r.motivo) || [];
      lista.push(i + 1); // numero da linha no arquivo, nunca o conteudo
      recusados.set(r.motivo, lista);
      continue;
    }
    if (vistos.has(r.numero)) { repetidos++; continue; }

    const bruto = nome >= 0 ? String(linhas[i][nome] ?? '').trim() : '';
    const limpo = bruto.replace(/\s+/g, ' ').replace(/^\[[^\]]*\]\s*/, '') || r.numero.replace('+55', '');
    vistos.set(r.numero, { numero: r.numero, nome: prefixo ? `${prefixo} ${limpo}` : limpo });
    porDdd.set(r.ddd, (porDdd.get(r.ddd) || 0) + 1);
    if (r.foraDoRS) foraDoRS++;
  }

  const contatos = [...vistos.values()];
  if (!contatos.length) {
    console.error('Nenhum numero aproveitavel. Confira a coluna do telefone.');
    process.exit(1);
  }

  const pedacos = [];
  if (porArquivo > 0 && contatos.length > porArquivo) {
    for (let i = 0; i < contatos.length; i += porArquivo) pedacos.push(contatos.slice(i, i + porArquivo));
  } else {
    pedacos.push(contatos);
  }

  const escritos = [];
  pedacos.forEach((pedaco, i) => {
    const caminho = pedacos.length > 1 ? `${saidaBase}-${String(i + 1).padStart(2, '0')}.vcf` : `${saidaBase}.vcf`;
    fs.writeFileSync(caminho, montarVcf(pedaco), 'utf8');
    escritos.push({ caminho, quantos: pedaco.length });
  });

  console.log(`Lido: ${entrada}  (${codificacao}, separador "${separador === '\t' ? 'TAB' : separador}")`);
  console.log(`Linhas de dado: ${linhas.length - 1}`);
  console.log(`Contatos no .vcf: ${contatos.length}`);
  if (repetidos) console.log(`  repetidos descartados: ${repetidos}`);
  if (recusados.size) {
    console.log('Recusados:');
    for (const [motivo, lista] of [...recusados].sort((a, b) => b[1].length - a[1].length)) {
      const amostra = lista.slice(0, 8).join(', ');
      console.log(`  ${String(lista.length).padStart(5)}  ${motivo}  (linhas ${amostra}${lista.length > 8 ? ', ...' : ''})`);
    }
  }
  const topo = [...porDdd].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`DDDs: ${topo.map(([d, q]) => `${d}=${q}`).join('  ')}`);
  if (foraDoRS) console.log(`  FORA do RS: ${foraDoRS} — a base e estadual, confira se isso faz sentido`);

  console.log('');
  for (const e of escritos) console.log(`Escrito: ${e.caminho}  (${e.quantos} contatos)`);

  if (o.mensagens) {
    if (!fs.existsSync(String(o.mensagens))) {
      console.error(`\nNao achei o arquivo de mensagens: ${o.mensagens}`);
      process.exit(2);
    }
    const variacoes = lerVariacoes(lerTexto(String(o.mensagens)).texto);
    if (!variacoes.length) {
      console.error('\nO arquivo de mensagens nao tem nenhuma variacao (separe cada uma com uma linha com ---).');
      process.exit(2);
    }
    const plano = montarPlano(contatos, variacoes);
    const caminho = `${saidaBase}-plano.csv`;
    fs.writeFileSync(caminho, planoParaCsv(plano), 'utf8');
    console.log(`Escrito: ${caminho}  (${plano.length} mensagens, revezando entre ${variacoes.length} texto(s))`);
    const porVariacao = new Map();
    for (const p of plano) porVariacao.set(p.variacao, (porVariacao.get(p.variacao) || 0) + 1);
    console.log(`  ${[...porVariacao].map(([v, q]) => `texto ${v}: ${q}`).join('  ')}`);
  }

  if (prefixo) {
    console.log('');
    console.log(`Os contatos entram com "${prefixo}" na frente do nome — e e assim que voce os ACHA`);
    console.log('e APAGA em massa depois (busca no app de Contatos, selecionar tudo, excluir).');
  }
}

if (import.meta.filename === process.argv[1] || process.argv[1]?.endsWith('contatos-para-vcf.mjs')) {
  principal(process.argv.slice(2));
}
