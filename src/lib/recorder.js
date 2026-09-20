/**
 * recorder.js — Fase 0: aprender como a plataforma grava um campo, em vez de adivinhar.
 *
 * Motivo: o trecho do bundle que monta a chamada de /core/v1/custom-field/value não pôde
 * ser lido no levantamento, e um GET nessa rota devolve 500 (ela não é de leitura).
 * Chutar o formato do body significaria escrever errado em contato real, então a extensão
 * observa você fazendo a alteração UMA vez pela interface do mobiliza e copia o formato.
 *
 * A derivação em si mora em contract.js (puro e testado). Aqui fica só a captura.
 */

import { onRecordedRequest, onRecordedResponse, setRecording } from './bus.js';
import { deriveContract } from './contract.js';
import * as store from './store.js';

const buffer = [];
const MAX_BUFFER = 60;
const waiters = [];
let enabled = false;

onRecordedRequest((req) => {
  buffer.unshift(req);
  if (buffer.length > MAX_BUFFER) buffer.pop();
  waiters.slice().forEach((w) => w(req));
});

const respostas = [];
const MAX_RESPOSTAS = 60;
onRecordedResponse((r) => {
  respostas.unshift(r);
  if (respostas.length > MAX_RESPOSTAS) respostas.pop();
});

/**
 * **Aprender o ENVIO DE IMAGEM observando ele fazer uma vez** — pedido dele (20/09/2026):
 * *"preciso da opção de mandar imagem e na descrição mandar mensagem do momento ou pedir dados"*.
 *
 * Do pacote da plataforma dá para ver que a cadeia existe (`POST /core/v1/file/upload` devolve para
 * onde subir, depois `PUT /core/v1/file`, depois a mensagem com o arquivo) — **o que não dá para ver
 * é o formato exato de cada corpo**, e chutar aqui é mandar coisa errada para eleitor. É a mesma
 * disciplina do contrato de escrita no CRM: a extensão observa e copia.
 *
 * Guarda a cadeia INTEIRA (pedido + resposta, recortados) em `contratoImagem`. **Nada disso vai para
 * o backup** e nada é enviado: fica no armazenamento da extensão, na máquina dele.
 *
 * @param {object} opts
 * @param {number} [opts.timeoutMs] quanto tempo esperar ele mandar a imagem
 * @param {number} [opts.janelaMs]  quanto tempo continuar gravando depois do primeiro passo
 */
export function aprenderEnvioDeImagem({ timeoutMs = 180000, janelaMs = 20000 } = {}) {
  setEnabled(true);
  const inicio = Date.now();

  return new Promise((resolve, reject) => {
    const desistir = setTimeout(() => {
      limpar();
      reject(
        new Error(
          `Não vi nenhum envio de imagem em ${Math.round(timeoutMs / 1000)}s. ` +
            'Mande uma imagem com legenda pela plataforma, no contato de teste, com esta janela aberta.'
        )
      );
    }, timeoutMs);

    let fecha = null;
    const limpar = () => {
      clearTimeout(desistir);
      if (fecha) clearTimeout(fecha);
      const i = waiters.indexOf(waiter);
      if (i >= 0) waiters.splice(i, 1);
    };

    const fechar = async () => {
      limpar();
      const passos = buffer
        .filter((r) => r.at >= inicio)
        .sort((a, b) => a.at - b.at)
        .map((r) => ({
          metodo: r.method,
          url: r.url,
          corpo: recortar(r.body),
          resposta: recortar(respostas.find((x) => x.url === r.url && x.at >= r.at)?.body),
        }));
      const contrato = { aprendidoEm: new Date().toISOString(), passos };
      await store.set('contratoImagem', contrato);
      resolve(contrato);
    };

    // O primeiro passo da cadeia abre a janela: o resto (o upload e a mensagem) vem em seguida.
    const waiter = (req) => {
      if (!/\/file\/upload|\/file\b|amazonaws|storage\.googleapis|blob\.core\.windows/i.test(req.url || '')) return;
      if (fecha) return;
      fecha = setTimeout(fechar, janelaMs);
    };

    waiters.push(waiter);
  });
}

/** Corpo recortado: o formato é o que interessa, e base64 de imagem enche o armazenamento. */
function recortar(texto) {
  const t = String(texto == null ? '' : texto);
  return t.length > 1500 ? `${t.slice(0, 1500)}…[cortado, ${t.length} caracteres]` : t;
}

export function setEnabled(value) {
  enabled = !!value;
  setRecording(enabled);
}

export function getBuffer() {
  return buffer.slice();
}

/**
 * Liga a gravação e espera a requisição que contenha um dos `needles`, então aprende e
 * persiste o contrato para o tipo daquele campo.
 *
 * @param {object} opts
 * @param {string} opts.contactId contato usado no teste
 * @param {object} opts.field     campo do schema alterado (id, name, type)
 * @param {string[]} opts.needles valores que devem aparecer na requisição
 * @param {number} [opts.timeoutMs]
 */
export function learn({ contactId, field, needles, timeoutMs = 120000 }) {
  setEnabled(true);

  // A alteração pode ter sido capturada antes de learn() ser chamado.
  const existing = buffer.find((req) => containsNeedle(req, needles));
  if (existing) return persist(existing, { contactId, field, needles });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(
        new Error(
          `Não vi nenhuma requisição com "${needles[0]}" em ${Math.round(timeoutMs / 1000)}s. ` +
            'Confirme que você salvou a alteração na interface do mobiliza.'
        )
      );
    }, timeoutMs);

    const waiter = (req) => {
      if (!containsNeedle(req, needles)) return;
      clearTimeout(timer);
      off();
      persist(req, { contactId, field, needles }).then(resolve, reject);
    };

    const off = () => {
      const i = waiters.indexOf(waiter);
      if (i >= 0) waiters.splice(i, 1);
    };

    waiters.push(waiter);
  });
}

function containsNeedle(req, needles) {
  const haystack = `${req.url} ${req.body || ''}`;
  return needles.some((n) => n && haystack.includes(n));
}

async function persist(req, ctx) {
  const entry = deriveContract(req, ctx);
  const contract = (await store.get('writeContract')) || { entries: [] };
  contract.entries = [...(contract.entries || []).filter((e) => e.type !== entry.type), entry];
  await store.set('writeContract', contract);
  return entry;
}
