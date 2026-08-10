/**
 * Empacota a extensão para envio à Chrome Web Store.
 *
 * Gera `dist/whatsfill-<versão>.zip` só com o que a extensão precisa em execução — testes,
 * ferramentas, documentação e `.git` ficam de fora. O zip é escrito à mão (formato simples,
 * deflate vem do zlib do Node) para o projeto seguir sem nenhuma dependência.
 *
 * Rode: node tools/package.mjs
 */

import { deflateRawSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

/** O que entra no pacote. Lista de inclusão, não de exclusão: esquecer de excluir é pior. */
const INCLUIR = ['manifest.json', 'options.html', 'options.js', 'icons', 'src'];

/** Dentro das pastas incluídas, só estas extensões. */
const EXTENSOES = new Set(['.json', '.js', '.css', '.html', '.png']);

/**
 * Arquivos que moram junto mas NÃO são da extensão: a imagem promocional é enviada no
 * formulário da loja, não empacotada. Sem isto ela viajaria 18 kB à toa dentro do zip.
 */
const FORA = /^promo[-.]/i;

// ---------------------------------------------------------------------------

function listar(alvo) {
  const caminho = join(RAIZ, alvo);
  const info = statSync(caminho);
  if (info.isFile()) return [alvo];

  const saida = [];
  for (const nome of readdirSync(caminho)) {
    const filho = join(alvo, nome);
    const st = statSync(join(RAIZ, filho));
    if (st.isDirectory()) saida.push(...listar(filho));
    else if (EXTENSOES.has(nome.slice(nome.lastIndexOf('.'))) && !FORA.test(nome)) saida.push(filho);
  }
  return saida;
}

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Data/hora no formato MS-DOS que o ZIP usa. */
function dosDateTime(d) {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const data = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { hora, data };
}

function zip(arquivos, agora) {
  const { hora, data } = dosDateTime(agora);
  const locais = [];
  const central = [];
  let deslocamento = 0;

  for (const { nome, conteudo } of arquivos) {
    const comprimido = deflateRawSync(conteudo, { level: 9 });
    const crc = crc32(conteudo);
    // Nome sempre com "/" — ZIP não usa a barra do Windows.
    const nomeBuf = Buffer.from(nome.split(sep).join('/'), 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // assinatura
    local.writeUInt16LE(20, 4); // versão necessária
    local.writeUInt16LE(0x0800, 6); // flag: nome em UTF-8
    local.writeUInt16LE(8, 8); // método: deflate
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(data, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(conteudo.length, 22);
    local.writeUInt16LE(nomeBuf.length, 26);
    local.writeUInt16LE(0, 28); // sem campo extra
    locais.push(local, nomeBuf, comprimido);

    const entrada = Buffer.alloc(46);
    entrada.writeUInt32LE(0x02014b50, 0);
    entrada.writeUInt16LE(20, 4); // versão que criou
    entrada.writeUInt16LE(20, 6); // versão necessária
    entrada.writeUInt16LE(0x0800, 8);
    entrada.writeUInt16LE(8, 10);
    entrada.writeUInt16LE(hora, 12);
    entrada.writeUInt16LE(data, 14);
    entrada.writeUInt32LE(crc, 16);
    entrada.writeUInt32LE(comprimido.length, 20);
    entrada.writeUInt32LE(conteudo.length, 24);
    entrada.writeUInt16LE(nomeBuf.length, 28);
    entrada.writeUInt32LE(0, 38); // atributos externos
    entrada.writeUInt32LE(deslocamento, 42);
    central.push(entrada, nomeBuf);

    deslocamento += local.length + nomeBuf.length + comprimido.length;
  }

  const corpoCentral = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(corpoCentral.length, 12);
  fim.writeUInt32LE(deslocamento, 16);

  return Buffer.concat([...locais, corpoCentral, fim]);
}

// ---------------------------------------------------------------------------

const manifest = JSON.parse(readFileSync(join(RAIZ, 'manifest.json'), 'utf8'));

const caminhos = INCLUIR.flatMap(listar).sort();
const arquivos = caminhos.map((nome) => ({ nome, conteudo: readFileSync(join(RAIZ, nome)) }));

// Confere que todo arquivo citado no manifest está no pacote — errar isso só aparece na revisão.
const citados = [
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action?.default_icon || {}),
  manifest.background?.service_worker,
  manifest.options_page,
  ...(manifest.content_scripts || []).flatMap((c) => c.js || []),
].filter(Boolean);

const noPacote = new Set(caminhos.map((c) => c.split(sep).join('/')));
const faltando = citados.filter((c) => !noPacote.has(c));
if (faltando.length) {
  console.error('Arquivos citados no manifest que ficaram de fora:', faltando);
  process.exit(1);
}

mkdirSync(join(RAIZ, 'dist'), { recursive: true });
const destino = join(RAIZ, 'dist', `whatsfill-${manifest.version}.zip`);
const buf = zip(arquivos, new Date());
writeFileSync(destino, buf);

console.log(`${arquivos.length} arquivos empacotados:`);
for (const c of caminhos) console.log('  ' + c.split(sep).join('/'));
console.log(`\n${relative(RAIZ, destino)} — ${(buf.length / 1024).toFixed(1)} kB`);
