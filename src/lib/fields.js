/**
 * fields.js — schema dos campos personalizados, leitura dos valores atuais e escrita.
 *
 * Regra de ouro descoberta no levantamento: as `key` dos campos estão desalinhadas dos
 * rótulos no ambiente do cliente (Responsável tem key "temas-de-interesse", Partido tem
 * key "lista"). Então NUNCA resolvemos campo por key — sempre pelo `name` exato do schema,
 * e trabalhamos com o `id`.
 *
 * A escrita usa o contrato aprendido pelo gravador (ver recorder.js). Enquanto não houver
 * contrato, `writeValues` recusa em vez de tentar adivinhar o body e sujar dados reais.
 */

import { getCustomFields, apiFetch } from './api.js';
import * as store from './store.js';
import { buildRequest } from './contract.js';

/**
 * Os campos que o painel classifica, na ordem em que aparecem. Nomes exatos do schema.
 * "Nome" entra aqui porque o contato vindo do anúncio chega como "[NOVO] (51) 9...": assim o
 * nome que o contato informou é gravado no cadastro em vez de ficar só na mensagem.
 *
 * **Saíram em 01/09/2026, por pedido dele** (*"não preciso preencher isso"*): "Tema de Interesse",
 * "Temas de Interesse", "Função" e "Partido". A remoção é da EXTENSÃO, não do CRM — o que já foi
 * gravado nesses campos continua lá, intocado. Esta lista é o único ponto por onde a extensão
 * escreve campo de contato, então tirar daqui é o que garante que nenhum caminho novo volte a
 * preencher os quatro por engano.
 */
export const CLASSIFY_FIELDS = ['Nome', 'Cidade', 'Responsável'];

export const COMPLETION_FIELD = 'Data de conclusão do contato';

/**
 * Data de hoje no fuso de quem está atendendo, "aaaa-mm-dd".
 *
 * NÃO use `toISOString().slice(0,10)`: isso devolve a data em UTC. Atendendo às 21h no Brasil
 * (UTC-3) já é o dia seguinte em UTC, e a conclusão saía carimbada com a data de amanhã —
 * observado na prática, com o campo gravando 06/08 num atendimento do dia 05/08.
 */
export function hojeLocal(date = new Date()) {
  const doisDigitos = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${doisDigitos(date.getMonth() + 1)}-${doisDigitos(date.getDate())}`;
}

/**
 * A data de conclusão entra na gravação automática?
 *
 * Regra em duas partes, e as duas importam em oito mil registros:
 *
 * 1. **Só preenche buraco.** Data já gravada nunca é reescrita — um contato concluído em 05/08
 *    não pode virar 06/08 porque a conversa foi reaberta para conferir.
 * 2. **Só em contato classificado.** Abrir a conversa de alguém que ainda não respondeu não
 *    pode carimbar conclusão. Serve de âncora o que acabou de ser reconhecido (campo exato ou
 *    etiqueta confiável) ou a cidade que já estava no CRM.
 *
 * @param {object} ctx
 * @param {boolean} ctx.dataVazia   campo de conclusão está sem valor
 * @param {boolean} ctx.temExato    algum campo casou exato agora
 * @param {boolean} ctx.temEtiqueta alguma etiqueta confiável será aplicada agora
 * @param {boolean} ctx.temCidade   o contato tem cidade (recém-reconhecida ou já no CRM)
 */
export function deveCarimbarData({ dataVazia, temExato, temEtiqueta, temCidade }) {
  if (!dataVazia) return false;
  return !!(temExato || temEtiqueta || temCidade);
}

let schemaCache = null;

export async function loadSchema({ force = false } = {}) {
  if (schemaCache && !force) return schemaCache;
  const raw = await getCustomFields();
  const arr = Array.isArray(raw) ? raw : raw?.items || [];
  schemaCache = arr.map((f) => ({
    id: f.id,
    name: f.name,
    key: f.key,
    type: f.type,
    isSelect: !!f.isSelectField,
    readonly: !!f.isReadonly,
    options: (f.options || []).map((o) => ({ id: o.id, name: o.name ?? o.label ?? o.value })),
  }));
  return schemaCache;
}

/** Só os campos de classificação que existem de fato no schema. */
export async function classifyFields() {
  const schema = await loadSchema();
  return CLASSIFY_FIELDS.map((name) => schema.find((f) => f.name === name)).filter(Boolean);
}

/**
 * Valores atuais do contato, indexados por fieldId.
 *
 * `customFieldValues` vem do GET /core/v1/contact/{id}. O levantamento inicial encontrou esse
 * array vazio em todos os contatos e daí saiu um palpite de formato que estava ERRADO: a
 * versão antiga procurava `item.value` / `item.values` / `item.text`, e nenhum desses existe.
 * Resultado observado na prática: o painel nunca via o que já estava gravado, marcava tudo
 * como palpite e regravava a cada Salvar.
 *
 * A forma real, capturada ao vivo:
 *   { customFieldId, customFieldKey, valueType, valueString, valueBoolean,
 *     valuesId: [], valuesDateTime: [], valuesInteger: [], valuesFloat: [] }
 */
export function readValues(contact) {
  const out = {};
  const raw = contact?.customFieldValues;
  if (!raw) return out;

  const lista = Array.isArray(raw) ? raw : Object.values(raw);
  for (const item of lista) {
    if (!item || typeof item !== 'object') continue;
    const id = item.customFieldId || item.fieldId || item.id;
    if (!id) continue;
    const valor = leValor(item);
    if (valor !== null && valor !== '') out[id] = valor;
  }
  return out;
}

/** Múltipla escolha volta como lista de ids; data volta como ISO e vira "aaaa-mm-dd". */
function leValor(item) {
  if (item.valueString != null && item.valueString !== '') return item.valueString;
  if (typeof item.valueBoolean === 'boolean') return item.valueBoolean;
  if (item.valuesId?.length) return [...item.valuesId];
  if (item.valuesDateTime?.length) return soData(item.valuesDateTime[0]);
  if (item.valuesInteger?.length) return item.valuesInteger[0];
  if (item.valuesFloat?.length) return item.valuesFloat[0];
  // Formas alternativas, mantidas caso a API mude de novo.
  return item.value ?? item.values ?? item.text ?? null;
}

function soData(valor) {
  const s = String(valor ?? '');
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export const NO_CONTRACT =
  'Contrato de escrita ainda não aprendido. Vá na aba Config → "Aprender a gravar campos".';

/**
 * Tipos em que o contrato de TEXTO não serve como substituto.
 *
 * Aprendido da pior forma: sem contrato DATE, a data ia como string no `valueString` e a API
 * respondia **200 sem gravar**. O mesmo vale para múltipla escolha, cujo valor mora em
 * `valuesId`. O fallback silencioso para STRING escondeu isso por dias — em vez de ajudar,
 * ele transformou "falta aprender" em "gravou e sumiu".
 */
const EXIGEM_CONTRATO_PROPRIO = ['DATE', 'DATETIME', 'MULTISELECT', 'SINGLESELECT'];

export function faltaContrato(type) {
  return (
    `Falta aprender o contrato de ${type}. Sem ele a API aceita a requisição e ignora o valor. ` +
    'Vá na aba Config → "Gravar campos no CRM".'
  );
}

/** Contrato para um tipo de campo. Só cai no de texto quando isso é seguro. */
export async function contractFor(type) {
  const contract = await store.get('writeContract');
  if (!contract?.entries?.length) return null;

  const exato = contract.entries.find((e) => e.type === type);
  if (exato) return exato;
  if (EXIGEM_CONTRATO_PROPRIO.includes(type)) return null;

  return contract.entries.find((e) => e.type === 'STRING') || contract.entries[0];
}

/**
 * Grava valores. `changes` é { fieldId: valor }, onde valor é string para STRING/TEXT/DATE
 * e array de ids de opção para MULTISELECT/SINGLESELECT.
 * Uma requisição por campo, na sequência, para o erro apontar o campo certo.
 */
export async function writeValues(contactId, changes) {
  const schema = await loadSchema();
  const results = [];

  for (const [fieldId, value] of Object.entries(changes)) {
    const field = schema.find((f) => f.id === fieldId);
    if (!field) {
      results.push({ fieldId, ok: false, error: 'Campo não existe no schema.' });
      continue;
    }
    if (field.readonly) {
      results.push({ fieldId, name: field.name, ok: false, error: 'Campo é somente leitura.' });
      continue;
    }

    const entry = await contractFor(field.type);
    if (!entry) {
      const contrato = await store.get('writeContract');
      results.push({
        fieldId,
        name: field.name,
        ok: false,
        error: contrato?.entries?.length ? faltaContrato(field.type) : NO_CONTRACT,
      });
      continue;
    }

    try {
      await writeOne(entry, { contactId, field, value });
      results.push({ fieldId, name: field.name, ok: true });
    } catch (err) {
      results.push({ fieldId, name: field.name, ok: false, error: err.message });
    }
  }

  return results;
}

/**
 * Grava um campo.
 *
 * Data é o caso delicado: descobrimos na prática que mandar "2026-08-05" para um campo DATE
 * usando o contrato de TEXTO faz a API responder **200 e ignorar o valor** — a extensão
 * dizia "Gravado" e o campo continuava vazio na plataforma. Como o GET do contato não devolve
 * os campos personalizados, não há como conferir depois.
 *
 * Por isso o formato não é chutado: vem do `sampleValue` capturado no aprendizado daquele
 * campo. Sem contrato DATE próprio, ainda tentamos as duas formas conhecidas — mas o painel
 * avisa que não dá para garantir.
 */
async function writeOne(entry, { contactId, field, value }) {
  const tentativas =
    field.type === 'DATE' ? formatosDeData(value, entry) : [value];
  let ultimoErro = null;

  for (const tentativa of tentativas) {
    if (tentativa == null) continue;
    try {
      const { url, body } = buildRequest(entry, { contactId, fieldId: field.id, value: tentativa });
      return await apiFetch(url, { method: entry.method, body });
    } catch (err) {
      ultimoErro = err;
    }
  }
  if (ultimoErro) throw ultimoErro;
  throw new Error('Nenhum formato de data aplicável.');
}

/**
 * Formatos a tentar para uma data "aaaa-mm-dd", na ordem. Com contrato DATE aprendido, o
 * formato do exemplo vem primeiro — e na prática é o único que precisa existir.
 */
export function formatosDeData(value, entry) {
  const s = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return [value];

  const [ano, mes, dia] = s.split('-');
  const candidatos = {
    cru: s,
    iso: `${s}T00:00:00.000Z`,
    isoCurto: `${s}T00:00:00`,
    brasileiro: `${dia}/${mes}/${ano}`,
  };

  const doExemplo = entry?.type === 'DATE' ? formatoDoExemplo(entry.sampleValue, candidatos) : null;
  const ordem = doExemplo
    ? [doExemplo, candidatos.cru, candidatos.iso]
    : [candidatos.cru, candidatos.iso];

  return [...new Set(ordem)];
}

/** Descobre qual formato o exemplo aprendido usa e devolve a data nova nesse mesmo formato. */
function formatoDoExemplo(sample, candidatos) {
  const s = String(sample ?? '');
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/.test(s)) {
    return /\.\d+Z?$/.test(s) ? candidatos.iso : candidatos.isoCurto;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return candidatos.cru;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return candidatos.brasileiro;
  return null;
}

export { buildRequest };
