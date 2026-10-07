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
 * Um instante qualquer vira o DIA local, no formato que o campo guarda (`AAAA-MM-DD`).
 *
 * **`AAAA-MM-DD` não pode passar por `new Date()`** — a string sem hora é lida como UTC, e em
 * UTC−3 ela volta um dia: `2026-08-13` viraria 12/08. Por isso a forma que já é um dia local sai
 * como está, e só o que tem hora de verdade é convertido.
 */
export function diaLocalDe(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : hojeLocal(valor);

  const s = String(valor).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : hojeLocal(d);
}

/**
 * **A primeira vez que a pessoa entrou em contato** — o menor dia entre a criação do contato no
 * CRM e o que se enxerga de mensagem dela.
 *
 * Decisão dele (07/10/2026): *"preciso que a data de conclusão permaneça a data da primeira vez
 * que a pessoa entrou em contato"*. O campo continua se chamando "Data de conclusão do contato"
 * porque o nome é do CRM; o que mudou é o que ele guarda.
 *
 * **Por que a criação do contato entra, e em primeiro lugar:** medido na exportação de 02/10/2026
 * (9.457 contatos) — ela está preenchida em **100%** deles, nunca é posterior à conclusão, e
 * apenas **145 (2%)** nasceram de importação em massa (todos no mesmo minuto). Nos outros 98% o
 * contato foi criado pela chegada da pessoa, então criação **é** o primeiro contato. As mensagens
 * entram porque a extensão às vezes enxerga conversa mais antiga que isso.
 *
 * Ordenar texto `AAAA-MM-DD` dá a ordem cronológica, e é de propósito: comparar como data criaria
 * um `Date` por item só para desempatar dia.
 */
export function primeiroContato({ criadoEm, momentos = [] } = {}) {
  const dias = [criadoEm, ...(momentos || [])].map(diaLocalDe).filter(Boolean).sort();
  return dias[0] || null;
}

/**
 * O campo da data entra nesta gravação?
 *
 * **A regra virou do avesso em 07/10/2026, a pedido dele** (*"se possível arrumar todas as datas
 * ao atender"*). Antes ela era *"só preenche buraco, nunca reescreve"*, e isso existia para um
 * valor que significava CONCLUSÃO: reabrir a conversa não podia empurrar 05/08 para 06/08.
 * Guardando o PRIMEIRO CONTATO, a mesma preocupação pede o contrário — a data tem de poder ser
 * corrigida para trás quando aparece uma anterior.
 *
 * **O invariante que substitui a trava antiga: a data só anda PARA TRÁS.** Nunca é empurrada para
 * frente, então nenhuma passada pode estragar um valor certo, não há como oscilar entre duas
 * passadas, e reabrir a conversa continua sendo inofensivo — que era tudo o que a regra velha
 * protegia.
 *
 * **Âncora só para o campo VAZIO.** Carimbar alguém que nunca respondeu continua errado, e a
 * âncora é o que acabou de ser reconhecido (campo exato ou etiqueta confiável) ou a cidade que já
 * estava no CRM. **Corrigir não precisa de âncora**: a data já está lá e já se sabe que está
 * errada.
 *
 * @param {object} ctx
 * @param {string}  ctx.dataAtual       o que está gravado hoje (qualquer formato)
 * @param {string}  ctx.primeiroContato o dia calculado, `AAAA-MM-DD`
 * @param {boolean} ctx.temExato        algum campo casou exato agora
 * @param {boolean} ctx.temEtiqueta     alguma etiqueta confiável será aplicada agora
 * @param {boolean} ctx.temCidade       o contato tem cidade (recém-reconhecida ou já no CRM)
 */
export function deveGravarPrimeiroContato({
  dataAtual,
  primeiroContato: primeiro,
  temExato,
  temEtiqueta,
  temCidade,
}) {
  if (!primeiro) return false;
  const atual = diaLocalDe(dataAtual);
  if (!atual) return !!(temExato || temEtiqueta || temCidade);
  return primeiro < atual;
}

/**
 * Esta entrada do rascunho vai para o CRM nesta gravação?
 *
 * Estava escrita solta dentro de `saveClassification`, e **faltava a linha mais importante**:
 * nada olhava `pendente`. Print dele (07/09/2026): um contato novo, aberto e concluído no mesmo
 * dia, ficou com o campo **Cidade** valendo `"mais Apoiadores com patrocínio"` — um trecho da
 * própria mensagem dele.
 *
 * A cadeia, medida:
 *
 * 1. `extract.cityPositionGuess` pega o **segundo pedaço** depois da vírgula e devolve como
 *    palpite `nao-reconhecida` — sem casar com município nenhum, de propósito: ele existe para
 *    virar popup com sugestões e para alimentar a revisão da aba Cidades;
 * 2. `panel.applyGuesses` marca toda cidade com `pendente: true`;
 * 3. `confirmarCidadeSePendente` **desiste** em três situações e volta sem mexer no rascunho —
 *    palpite que não é município (04/09), rodada automática sem IA (03/09, que ainda escreve
 *    *"não gravada"* no Andamento) e a pergunta que outra instância já está fazendo;
 * 4. e a gravação, sem esta guarda, escrevia o palpite mesmo assim.
 *
 * **A regra dele é uma frase: nenhuma cidade de palpite vai para o CRM sem confirmação.** Quem
 * pergunta respeitava; quem escreve não sabia da marca. Por isso a guarda mora **aqui**, no ponto
 * único de escrita: cada saída nova de `confirmarCidadeSePendente` seria mais um vazamento, e a
 * de 04/09 — criada para PROTEGER, tirando o palpite ruim da caixa — foi justamente a que abriu
 * este. É a terceira vez que texto solto chega ao campo Cidade (`faq.whatsapp.com` em 05/09,
 * `vt.tiktok.com` em 06/09); as duas primeiras foram consertadas na origem, e esta não tinha
 * origem para consertar — é frase comum, sem forma que `cities.ehEnderecoDeMaquina` reconheça.
 *
 * `pendente` só é posto na Cidade (`applyGuesses`, `corrigirNomeComCidade`) e é zerado por toda
 * resposta que aceita ou corrige, então nenhum outro campo muda de comportamento.
 *
 * @param {object|undefined} entry entrada de `state.draft`
 * @param {boolean} somenteExatos a gravação em curso só leva palpite exato (a automática)
 */
export function deveGravarEntrada(entry, { somenteExatos = false } = {}) {
  if (!entry) return false;
  // Não reescreve o que já estava lá.
  if (entry.from === 'crm') return false;
  // Palpite esperando confirmação: dele, ou da IA. Nunca gravado sozinho.
  if (entry.pendente) return false;

  /**
   * **A LIMPEZA é a única escrita de valor vazio que existe** — print do José (07/09/2026), cujo
   * campo Cidade valia `www.threads.com`: *"passou por ele, não removeu a cidade errada"*.
   *
   * A extensão nunca APAGOU nada: ela preenche buraco e, desde a 2.69, substitui lixo quando a
   * pessoa menciona uma cidade de verdade. Quem nunca mais menciona ficava com o lixo para sempre
   * — e o lixo foi escrito pela própria extensão (o vazamento fechado na 2.88).
   *
   * **Só vale para o que NÃO PODE SER LUGAR** (`cities.naoPodeSerNomeDeLugar`), por duas peneiras:
   * a FORMA (URL, domínio, e-mail, sequência longa de dígitos) e o VOCABULÁRIO (verbo, pronome,
   * advérbio — palavras que nenhum dos 5.571 municípios do Brasil tem no nome).
   *
   * **A segunda peneira entrou em 08/09/2026, com a print do Sabino** (campo Cidade valendo
   * *"transformar nosso país"*): *"a extensão está falhando em limpar ou corrigir cidades
   * erradas"*. Até ali a limpeza era só de forma, e frase comum ficava de fora com o argumento de
   * que podia ser cidade de outro estado — verdade para *"Curitiba"*, falsa para uma frase com
   * verbo dentro. **O que separa os dois não é casar com a lista de municípios, é o vocabulário**,
   * e "Curitiba" continua protegida.
   *
   * **Fica fora da gravação automática** (`somenteExatos`), que roda a cada abertura de contato:
   * apagar é destrutivo, e destrutivo pede ato deliberado — a conclusão, ou o Salvar. Todo contato
   * que a rodada trata é concluído, então a limpeza acontece de qualquer jeito.
   */
  if (entry.limpar) return !somenteExatos;

  // Confirmado por ele ou pela IA (19/09/2026, "IA pega a cidade sozinha") vale como exato: a dúvida que
  // `somenteExatos` protege é a do palpite, e ela acabou de ser respondida.
  if (somenteExatos && !(entry.from === 'palpite' && (entry.confidence === 'exata' || entry.confirmada))) return false;
  const valor = entry.value;
  if (valor == null || valor === '') return false;
  if (Array.isArray(valor) && !valor.length) return false;
  return true;
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
