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
    // `migrarPerguntaGrupos` saiu da fila em 01/09/2026, quando a pergunta dos grupos foi tirada
    // do `pedir-dados`: ela ACRESCENTA a pergunta em quem não a tem, então numa instalação nova
    // desfaria a remoção no primeiro carregamento. A função fica, porque é história de como o texto
    // chegou onde chegou — o que não pode é ela rodar.
    await migrarRespostasNovas();
    await migrarRespostaAgradecerInfo();
    await migrarSaudacaoSemConvite();
    await migrarRespostaInteresse();
    await migrarRespostasSemNome();
    await migrarInteressePedeDados();
    await migrarGruposPedeLink();
    await migrarRespostaSemRetorno();
    await migrarRespostaPedidoEmprego();
    await migrarRespostaAgradecerApoio();
    await migrarRespostaPerguntarAjuda();
    await migrarRespostasDeEvento();
    await migrarVariantesDeTexto();
    await migrarPedirDadosAntesDeTudo();
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

/** A pergunta dos sem retorno, usada pela rodada dos concluídos quando a janela está aberta. */
export const migrarRespostaSemRetorno = () =>
  garantirRespostas(['sem-retorno-interesse'], 'respostaSemRetorno');

/**
 * A recusa de pedido de emprego — irmã da `pedido-ajuda`, mesmo risco jurídico e volume alto.
 *
 * Flag própria pelo mesmo motivo das outras: reaproveitar flag antiga faria voltar resposta que
 * ele apagou de propósito.
 */
export const migrarRespostaPedidoEmprego = () =>
  garantirRespostas(['pedido-emprego'], 'respostaPedidoEmprego');

/**
 * O agradecimento pelo APOIO, para quem já tinha a lista de respostas salva.
 *
 * Sem isto ela não chega a ninguém que já usa a extensão — e a tecla do agradecimento (`i` desde
 * 03/09/2026, antes a 8), que depende
 * dela, some junto. Foi o que aconteceu em 31/08: ele atualizou para a 0.48.0 e a opção
 * "Agradecer o apoio e concluir" não apareceu. **A tecla não estava faltando; o texto é que
 * nunca tinha chegado.**
 *
 * Flag própria pelo mesmo motivo das outras: reaproveitar flag antiga faria voltar resposta que
 * ele apagou de propósito.
 */
export const migrarRespostaAgradecerApoio = () =>
  garantirRespostas(['agradecer-apoio'], 'respostaAgradecerApoio');

/**
 * A pergunta "em que posso ajudar?", para quem já tinha a lista salva.
 *
 * É a resposta de maior risco jurídico do conjunto — não pela promessa que faz, mas pela que
 * ela EVITA: sem esta, a rodada mandava material de campanha para quem escreveu "preciso da
 * força do senhor" (31/08). Se a migração não roda, a tecla não aparece e o caso volta a cair
 * na tecla 1.
 */
export const migrarRespostaPerguntarAjuda = () =>
  garantirRespostas(['perguntar-como-ajudar'], 'respostaPerguntarAjuda');

/**
 * Os dois textos do convite de evento, para quem já tinha a lista salva.
 *
 * Sem esta migração eles não chegam a ninguém que já usa a extensão, e a tecla 4 continua
 * mandando o pedido de dados seco — que é o defeito que os dois consertam.
 */
export const migrarRespostasDeEvento = () =>
  garantirRespostas(['pedir-dados-evento-nao', 'pedir-dados-evento-sim'], 'respostasDeEvento');

/**
 * A pergunta dos grupos passa a pedir o LINK de convite, e não o nome.
 *
 * Nome de grupo não serve para nada: é o link que permite entrar. Como a frase vive dentro de
 * outras respostas (hoje o `pedir-dados`), a troca é feita **em qualquer resposta que a
 * contenha literalmente** — quem reescreveu a frase fica com a dele.
 */
export async function migrarGruposPedeLink() {
  const migracoes = await store.get('migracoes');
  if (migracoes.gruposPedeLink) return false;

  const templates = await store.get('templates');
  const mexidos = [];
  for (const template of templates) {
    if (!String(template.text || '').includes(store.PERGUNTA_GRUPOS_ANTIGA)) continue;
    template.text = template.text.replace(store.PERGUNTA_GRUPOS_ANTIGA, store.PERGUNTA_GRUPOS);
    mexidos.push(template.name);
  }
  if (mexidos.length) await store.set('templates', templates);

  await store.set('migracoes', { ...migracoes, gruposPedeLink: true });
  return mexidos;
}

/**
 * A pergunta de interesse passa a pedir nome e cidade junto.
 *
 * Só troca o texto se ele estiver **literalmente** na versão anterior: quem editou a pergunta
 * fica com a dele. É a mesma disciplina do `migrarPerguntaGrupos` — migração que reescreve
 * texto editável tem que reconhecer o que está reescrevendo.
 *
 * O nome da resposta também muda, e por isso é comparado antes: nome que ele tenha trocado
 * também é edição.
 */
export async function migrarInteressePedeDados() {
  const migracoes = await store.get('migracoes');
  if (migracoes.interessePedeDados) return false;

  const templates = await store.get('templates');
  const alvo = templates.find((t) => t.id === 'interesse-conteudo');
  let mexeu = false;

  if (alvo && alvo.text.trim() === store.INTERESSE_CONTEUDO_ANTIGO.trim()) {
    alvo.text = store.INTERESSE_CONTEUDO;
    if (alvo.name === 'Perguntar interesse no conteúdo') {
      alvo.name = 'Perguntar interesse no conteúdo (e pedir os dados)';
    }
    await store.set('templates', templates);
    mexeu = true;
  }

  await store.set('migracoes', { ...migracoes, interessePedeDados: true });
  return mexeu;
}

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

/**
 * Acrescenta `variantes` às respostas que já estão salvas no navegador — mudar
 * `DEFAULT_TEMPLATES` só vale para quem nunca gravou nada, mesmo problema de sempre.
 *
 * Só entra quando: (1) o id ainda não tem nenhuma variante (rodou de novo não duplica, e
 * variante que o Thiago tenha apagado de propósito não volta); (2) o TEXTO-BASE continua
 * IDÊNTICO ao padrão — se ele reescreveu a resposta, misturar a variante do texto original
 * com a base editada dele mandaria conteúdo inconsistente. Nesse caso fica de fora, em
 * silêncio: sem variante é o comportamento de sempre (só o texto que ele escreveu), nunca erro.
 */
/**
 * O `pedir-dados` passa a pedir os dados ANTES de explicar o grupo (01/09/2026).
 *
 * Pedido dele: *"antes de qualquer coisa nos diga seu nome e cidade para salvarmos seu contato"*.
 * Mudar `DEFAULT_TEMPLATES` só vale para quem nunca gravou nada — quem já usa a extensão tem o
 * texto antigo salvo, e sem esta migração continuaria mandando a versão de ontem.
 *
 * **Só mexe em quem ainda tem o texto de fábrica.** A identificação é pelo MIOLO antigo, não pelo
 * texto inteiro: as três versões tinham aberturas diferentes, e a saudação já foi mexida por outra
 * migração antes. Se ele reescreveu a mensagem, a frase antiga não está lá e o texto dele fica
 * intacto — reescrever por cima do que ele escreveu é o erro que nenhuma migração pode cometer.
 *
 * @returns {Promise<boolean>} se mexeu em alguma coisa
 */
export async function migrarPedirDadosAntesDeTudo() {
  const migracoes = await store.get('migracoes');
  if (migracoes.pedirDadosSemGrupos) return false;

  const templates = await store.get('templates');
  const alvo = templates.find((t) => t.id === 'pedir-dados');
  const padrao = store.DEFAULT_TEMPLATES.find((t) => t.id === 'pedir-dados');
  let mexeu = false;

  if (alvo && padrao) {
    const deFabrica = (texto) => store.PEDIR_DADOS_MIOLO_ANTIGO.some((m) => String(texto || '').includes(m));

    if (deFabrica(alvo.text)) {
      alvo.text = padrao.text;
      mexeu = true;
    }
    if (Array.isArray(alvo.variantes)) {
      alvo.variantes = alvo.variantes.map((v, i) => (deFabrica(v) ? padrao.variantes[i] || v : v));
      mexeu = mexeu || alvo.variantes.some((v, i) => v === padrao.variantes[i]);
    }
    if (mexeu) await store.set('templates', templates);
  }

  await store.set('migracoes', { ...migracoes, pedirDadosSemGrupos: true });
  return mexeu;
}

export async function migrarVariantesDeTexto() {
  const migracoes = await store.get('migracoes');
  if (migracoes.variantesDeTexto) return false;

  const templates = await store.get('templates');
  const mexidos = [];
  for (const template of templates) {
    if (template.variantes?.length) continue;
    const padrao = store.DEFAULT_TEMPLATES.find((t) => t.id === template.id);
    if (!padrao?.variantes?.length) continue;
    if (String(template.text || '').trim() !== String(padrao.text || '').trim()) continue;
    template.variantes = structuredClone(padrao.variantes);
    mexidos.push(template.name);
  }
  if (mexidos.length) await store.set('templates', templates);

  await store.set('migracoes', { ...migracoes, variantesDeTexto: true });
  return mexidos;
}

/**
 * O texto a usar AGORA — a variante corrente do ponteiro de rotação, sem avançar nada.
 *
 * Preview (aba Respostas, card de cada resposta) e o começo de um envio de verdade chamam
 * esta função e têm que ver a MESMA coisa; só `avancarVariante`, chamada depois que a
 * mensagem sai de verdade, muda o que a próxima chamada devolve.
 */
export async function varianteAtual(template) {
  const variantes = [template.text, ...(template.variantes || [])];
  if (variantes.length <= 1) return template.text;

  const indices = await store.get('varianteIndex');
  const i = (indices[template.id] || 0) % variantes.length;
  return variantes[i];
}

/**
 * Avança o ponteiro de rotação — só depois que a mensagem SAIU de verdade (não a cada
 * preview, não em "Só inserir": ali o envio de fato ainda depende de você, ou de mais uma
 * ação sua, e queimar a rotação sem nada ter saído faria a próxima variante pular sozinha).
 */
export async function avancarVariante(template) {
  const variantes = [template.text, ...(template.variantes || [])];
  if (variantes.length <= 1) return;

  const indices = await store.get('varianteIndex');
  const atual = indices[template.id] || 0;
  await store.set('varianteIndex', { ...indices, [template.id]: (atual + 1) % variantes.length });
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

/**
 * Esta mensagem NOSSA é o pedido de dados? (em qualquer redação, de qualquer época)
 *
 * **Reconhece pelo INVARIANTE, não pelo texto.** Comparar com o texto atual do template só
 * enxerga o que saiu com a redação de hoje — e a redação muda. Print da Loreta (01/09/2026): ela
 * recebeu *"Para eu poder salvar seu contato me passe seu: Nome / Cidade"* em 31/08, uma redação
 * que já não existe. O trecho literal não casou, o painel concluiu que já havíamos ENTREGADO algo
 * a ela, e a rodada mandou a mensagem do momento **em vez do modelo que ela nunca recebeu**.
 *
 * A linha `Nome / Cidade` é o que nunca muda entre as três formas do pedido (`pedir-dados`, a
 * pergunta de interesse e as de evento) nem entre as variantes: os testes a protegem em cada texto,
 * e o parser depende dela para ler a resposta. O `CLAUDE.md` já registrava isso para a leitura da
 * RESPOSTA — vale igual para reconhecer a PERGUNTA.
 *
 * @param {string} texto uma mensagem que NÓS mandamos
 * @returns {boolean}
 */
export function ehPedidoDeDados(texto) {
  const plano = String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  /**
   * **O SEPARADOR não é o invariante — e foi ele que quebrou tudo** (04/09/2026).
   *
   * A regra exigia a barra (`nome / cidade`) e o texto em uso passou a ser `Nome , Cidade`, com
   * vírgula. O efeito é grande e silencioso: `jaPediramDados` ficava **falso para todo mundo** que
   * recebeu a redação atual, e a rodada voltava a pedir nome e cidade a quem já tinha o formulário.
   *
   * Custou três anotações antes de aparecer — Iris (*"a minha última mensagem já pediu dados"*),
   * Plauto (*"já foi pedido dados"*) e jairoc (*"o contato ignorou o pedido de dados no dia
   * anterior"*) —, e nas três eu procurei a causa no quadro. **Escrever "reconhece pelo invariante"
   * não torna invariante o que está escrito:** barra, vírgula, hífen e "e" são a mesma frase para
   * quem lê.
   */
  return /\bnome( completo)?\s*(\/|,|-|–|—|\be\b)?\s*cidade\b/.test(plano);
}

/**
 * Esta mensagem NOSSA é a pergunta "em que você precisa de ajuda?"
 *
 * Mesmo princípio de `ehPedidoDeDados`: reconhece pelo **invariante**, não pela redação. A frase
 * `em que você precisa de ajuda` já é travada por teste no texto do template — é ela que não muda.
 *
 * Existe porque a pergunta abre um caso e **a resposta dela precisa de gente**. Print de
 * 01/09/2026: a rodada perguntou às 14:22, a contato respondeu às 16:19 *"é sobre as irregularidades
 * sobre compra assistida em eldorado do sul"* — uma denúncia sobre programa público, que é o
 * trabalho de um mandato — e recebeu **material de campanha**, porque nenhuma regra reconhecia que
 * aquilo era a resposta a uma pergunta nossa.
 *
 * @param {string} texto uma mensagem que NÓS mandamos
 * @returns {boolean}
 */
export function ehPerguntaComoAjudar(texto) {
  const plano = String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /em que voce precisa de ajuda/.test(plano);
}
