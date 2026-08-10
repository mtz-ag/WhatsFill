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

import { onRecordedRequest, setRecording } from './bus.js';
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
