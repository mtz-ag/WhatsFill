/**
 * templates.js — CRUD das respostas prontas e o registro anti-duplicata.
 */

import * as store from './store.js';
import { semVocativo, usaNome } from './vars.js';

let migrado = false;

export async function list() {
  // Uma vez por carregamento do painel: a migração relê o storage, não custa a cada chamada.
  if (!migrado) {
    migrado = true;
    await migrarPerguntaGrupos();
    await migrarRespostasNovas();
    await migrarRespostaAgradecerInfo();
    await migrarSaudacaoSemConvite();
    await migrarRespostaInteresse();
    await migrarRespostasSemNome();
  }
  return store.get('templates');
}

/**
 * Tira a pergunta final da saudação de fé.
 *
 * A primeira versão terminava com "Estou por aqui para ouvir. Em que posso ajudar hoje?".
 * Convite a responder vira atendimento, e o gabinete não tem braço para esse volume — decisão
 * do Thiago. Só remove se a frase estiver lá **literalmente**: saudação que ele tenha reescrito
 * fica intacta.
 */
export const CONVITE_ANTIGO = 'Estou por aqui para ouvir. Em que posso ajudar hoje?';

export async function migrarSaudacaoSemConvite() {
  const migracoes = await store.get('migracoes');
  if (migracoes.saudacaoSemConvite) return false;

  const templates = await store.get('templates');
  const alvo = templates.find((t) => t.id === 'saudacao-fe');
  let mexeu = false;

  if (alvo && String(alvo.text || '').includes(CONVITE_ANTIGO)) {
    alvo.text = String(alvo.text).replace(CONVITE_ANTIGO, '').trimEnd();
    await store.set('templates', templates);
    mexeu = true;
  }

  await store.set('migracoes', { ...migracoes, saudacaoSemConvite: true });
  return mexeu;
}

/**
 * Acrescenta respostas novas a quem já tem a lista salva no navegador.
 *
 * Mesmo problema do `migrarPerguntaGrupos`: mudar `DEFAULT_TEMPLATES` só vale para quem nunca
 * gravou nada. Aqui a regra é mais simples e mais segura — **só acrescenta o que falta, nunca
 * altera nem apaga o que existe**. Resposta que o Thiago apagar de propósito não volta, porque
 * a migração roda uma vez só.
 */
async function garantirRespostas(ids, flag) {
  const migracoes = await store.get('migracoes');
  if (migracoes[flag]) return false;

  const templates = await store.get('templates');
  const faltando = store.DEFAULT_TEMPLATES.filter(
    (padrao) => ids.includes(padrao.id) && !templates.some((t) => t.id === padrao.id)
  );

  if (faltando.length) {
    await store.set('templates', [...templates, ...faltando.map((t) => ({ ...t }))]);
  }
  await store.set('migracoes', { ...migracoes, [flag]: true });
  return faltando.length > 0;
}

export const migrarRespostasNovas = () =>
  garantirRespostas(['pedido-ajuda', 'saudacao-fe'], 'respostasGabinete');

/**
 * Flag própria, e não a mesma dos anteriores: reaproveitar a flag antiga faria voltar resposta
 * que o Thiago apagou de propósito.
 */
export const migrarRespostaAgradecerInfo = () =>
  garantirRespostas(['agradecer-info'], 'respostaAgradecerInfo');

/** A pergunta de interesse no conteúdo, para quem já tinha a lista de respostas salva. */
export const migrarRespostaInteresse = () =>
  garantirRespostas(['interesse-conteudo'], 'respostaInteresseConteudo');

/**
 * Tira o nome do contato das respostas já salvas no navegador.
 *
 * Mudar `DEFAULT_TEMPLATES` só vale para quem nunca gravou nada — as respostas dele estão no
 * `chrome.storage`, algumas editadas à mão. Por isso a migração **reescreve**, em vez de só
 * acrescentar como as outras.
 *
 * Ela é segura porque não reescreve texto: só apaga o marcador `{{primeiro_nome}}`/`{{nome}}` e
 * a pontuação do vocativo em volta (ver `vars.semVocativo`, que é puro e testado). O resto da
 * frase, inclusive o que o Thiago tenha escrito, fica intacto.
 *
 * Roda **uma vez só**: se ele quiser o nome de volta em alguma resposta, é só escrever e a
 * migração não desfaz.
 *
 * A mensagem do momento (`auto.mensagemMomento`) entra junto: é texto que vai para o contato
 * pelo mesmo caminho, e com nome ela travaria a tecla 5 do mesmo jeito.
 */
export async function migrarRespostasSemNome() {
  const migracoes = await store.get('migracoes');
  if (migracoes.respostasSemNome) return false;

  const templates = await store.get('templates');
  const mexidos = [];
  for (const template of templates) {
    if (!usaNome(template.text)) continue;
    template.text = semVocativo(template.text);
    mexidos.push(template.name);
  }
  if (mexidos.length) await store.set('templates', templates);

  const auto = await store.get('auto');
  if (usaNome(auto.mensagemMomento)) {
    await store.set('auto', { ...auto, mensagemMomento: semVocativo(auto.mensagemMomento) });
    mexidos.push('Mensagem do momento');
  }

  await store.set('migracoes', { ...migracoes, respostasSemNome: true });
  return mexidos;
}

/**
 * Acrescenta a pergunta sobre grupos políticos ao "Pedir dados" que já está salvo no navegador.
 *
 * Mudar o texto padrão não bastaria: quem já usa o painel tem o template gravado no storage, e
 * o padrão só vale para chave inexistente. Duas travas para não atropelar edição sua:
 *  - roda **uma vez só** (registrada em `migracoes`), então apagar a pergunta depois não faz
 *    ela voltar sozinha;
 *  - não mexe em texto que já fale de grupo político.
 */
export async function migrarPerguntaGrupos() {
  const migracoes = await store.get('migracoes');
  if (migracoes.perguntaGrupos) return false;

  const templates = await store.get('templates');
  const alvo = templates.find((t) => t.id === 'pedir-dados');
  let mexeu = false;

  if (alvo && !/grupo\s+pol[ií]tico/i.test(alvo.text || '')) {
    alvo.text = `${String(alvo.text || '').trimEnd()}\n\n${store.PERGUNTA_GRUPOS}`;
    await store.set('templates', templates);
    mexeu = true;
  }

  await store.set('migracoes', { ...migracoes, perguntaGrupos: true });
  return mexeu;
}

export async function save(template) {
  const templates = await list();
  const idx = templates.findIndex((t) => t.id === template.id);
  if (idx >= 0) templates[idx] = { ...templates[idx], ...template };
  else templates.push({ ...template, id: template.id || slug(template.name) });
  await store.set('templates', templates);
  return templates;
}

export async function remove(id) {
  const templates = (await list()).filter((t) => t.id !== id);
  await store.set('templates', templates);
  return templates;
}

export async function move(id, delta) {
  const templates = await list();
  const i = templates.findIndex((t) => t.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= templates.length) return templates;
  [templates[i], templates[j]] = [templates[j], templates[i]];
  await store.set('templates', templates);
  return templates;
}

export async function restoreDefaults() {
  await store.set('templates', structuredClone(store.DEFAULT_TEMPLATES));
  return list();
}

// --- anti-duplicata --------------------------------------------------------

function logKey(contactId, templateId) {
  return `${contactId}|${templateId}`;
}

/**
 * O registro guarda também o NOME de quem recebeu.
 *
 * Não é enfeite: o aviso "já enviei esta resposta" apareceu em contato que não tinha recebido, e
 * com o nome no registro o próprio aviso diz se ele é de outra pessoa (bug) ou do mesmo contato
 * em outro atendimento (comportamento certo, só confuso). Registro antigo era só o timestamp,
 * daí a normalização.
 */
function normalizarEntrada(valor) {
  if (!valor) return null;
  if (typeof valor === 'number') return { at: valor, nome: '' };
  return { at: valor.at || 0, nome: valor.nome || '' };
}

/** @returns {Promise<{at:number, nome:string}|null>} */
export async function wasSent(contactId, templateId) {
  const log = await store.get('sentLog');
  return normalizarEntrada(log[logKey(contactId, templateId)]);
}

export async function markSent(contactId, templateId, { nome = '' } = {}) {
  const log = await store.get('sentLog');
  log[logKey(contactId, templateId)] = { at: Date.now(), nome };

  // Mantém o registro enxuto: só os 5 mil envios mais recentes.
  const entries = Object.entries(log);
  if (entries.length > 5000) {
    entries.sort((a, b) => (normalizarEntrada(b[1])?.at || 0) - (normalizarEntrada(a[1])?.at || 0));
    await store.set('sentLog', Object.fromEntries(entries.slice(0, 5000)));
  } else {
    await store.set('sentLog', log);
  }
}

function slug(name) {
  const base = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return base || `template-${Math.random().toString(36).slice(2, 8)}`;
}
