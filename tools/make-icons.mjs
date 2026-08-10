/**
 * Gera os ícones da extensão (16/32/48/128) sem nenhuma dependência.
 *
 * Por que desenhar em vez de baixar: a Chrome Web Store exige ícone, e um PNG qualquer da
 * internet traria dúvida de licença. Aqui o desenho é código — dá para reproduzir e ajustar.
 *
 * Técnica: campo de distância (SDF) com anti-aliasing por distância, em vez de pixel cru.
 * É o que mantém a borda limpa em 16px, onde qualquer serrilhado aparece.
 *
 * Rode: node tools/make-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const SAIDA = new URL('../icons/', import.meta.url);
const TAMANHOS = [16, 32, 48, 128];

// Mesmo índigo do painel (--wf-accent).
const FUNDO = [79, 70, 229];
const MARCA = [255, 255, 255];

// ---------------------------------------------------------------------------
// Geometria
// ---------------------------------------------------------------------------

/** Distância assinada até um retângulo de cantos arredondados. Negativo = dentro. */
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Distância até um segmento de reta. */
function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

/** Cobertura 0..1 a partir da distância, suavizada na largura de um pixel. */
function cobertura(d, suavidade) {
  return Math.min(1, Math.max(0, 0.5 - d / suavidade));
}

/**
 * O desenho: quadrado arredondado índigo com um "check" branco.
 * O check é o que a extensão faz — confirmar a classificação do contato.
 */
function pixel(x, y, size) {
  const px = x + 0.5;
  const py = y + 0.5;
  const s = size;
  const aa = Math.max(1, s / 16); // suavidade proporcional ao tamanho

  const fundo = cobertura(sdRoundRect(px, py, s / 2, s / 2, s / 2, s / 2, s * 0.22), aa);

  const esp = s * 0.105; // meia-espessura do traço
  const d = Math.min(
    sdSegment(px, py, s * 0.28, s * 0.53, s * 0.43, s * 0.69),
    sdSegment(px, py, s * 0.43, s * 0.69, s * 0.74, s * 0.32)
  );
  const check = cobertura(d - esp, aa);

  // Branco sobre índigo, dentro da máscara do quadrado.
  const a = fundo;
  const m = check * fundo;
  return [
    Math.round(FUNDO[0] * (1 - m) + MARCA[0] * m),
    Math.round(FUNDO[1] * (1 - m) + MARCA[1] * m),
    Math.round(FUNDO[2] * (1 - m) + MARCA[2] * m),
    Math.round(a * 255),
  ];
}

// ---------------------------------------------------------------------------
// Codificação PNG
// ---------------------------------------------------------------------------

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

function chunk(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

function png(size) {
  // Cada linha começa com o byte de filtro 0 (sem filtro), seguido de RGBA.
  const linhas = Buffer.alloc(size * (1 + size * 4));
  let i = 0;
  for (let y = 0; y < size; y++) {
    linhas[i++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      linhas[i++] = r;
      linhas[i++] = g;
      linhas[i++] = b;
      linhas[i++] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compressão deflate
  ihdr[11] = 0; // filtro padrão
  ihdr[12] = 0; // sem entrelaçamento

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(linhas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(SAIDA, { recursive: true });
for (const size of TAMANHOS) {
  const arquivo = new URL(`icon${size}.png`, SAIDA);
  const buf = png(size);
  writeFileSync(arquivo, buf);
  console.log(`icon${size}.png — ${buf.length} bytes`);
}
console.log('pronto:', SAIDA.pathname);
