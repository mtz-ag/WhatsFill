/**
 * categorizar.js — etiqueta de CIDADE para a base inteira.
 *
 * ## Por que existe
 *
 * A API da plataforma **só filtra por etiqueta**. A etiqueta de região (COREDE) já é aplicada
 * pelo fluxo normal, mas COREDE agrupa dezenas de municípios — e o Thiago precisa filtrar por
 * cidade. Sem uma etiqueta por cidade, não há como montar a lista de "todos de Santo Ângelo".
 *
 * Então: todo contato que **já tem etiqueta** (ou seja, já foi trabalhado) e **tem cidade
 * preenchida** ganha a etiqueta da própria cidade, somada às que já tem.
 *
 * ## As travas, e o que cada uma evita
 *
 * 1. **Cidade tem que ser município do RS de verdade**, casado contra a planilha oficial
 *    (`coredes-rs.json`, 497 municípios). O campo Cidade é texto livre e a base tem coisa
 *    digitada à mão: sem esta trava, "não sei", "aaa" e cidade com erro de digitação virariam
 *    etiqueta nova no CRM — e apagar 300 etiquetas de lixo é trabalho que ninguém quer.
 *    O que não casa vai para uma lista de revisão, visível na tela, em vez de virar etiqueta.
 * 2. **Nome de etiqueta nunca é inventado.** O id sai da lista real do CRM (`tags.allTags`).
 *    Cidade sem etiqueta correspondente entra em `faltamCriar` — nada é gravado no escuro.
 * 3. **Idempotente.** Contato que já tem a etiqueta da cidade é contado como pronto e não gera
 *    requisição. Rodar duas vezes não escreve duas vezes; retomar de onde parou é o caso normal,
 *    não a exceção.
 * 4. **Soma, nunca substitui.** Quem grava é `tags.applyTags`, que faz a união com as etiquetas
 *    que o contato já tem — a regra "nunca sobrescrever o que está no CRM" vale aqui como em
 *    todo o resto.
 *
 * A parte pura (`nomeDaEtiqueta`, `analisar`, `Ritmo`) é separada das chamadas de rede de
 * propósito: é ela que decide o que vai ser escrito em base de eleitor real, e por isso tem teste.
 */

import { normalize } from './cities.js';

/**
 * Sem prefixo: a etiqueta é o nome da cidade, e nada mais.
 *
 * Começou como `'CIDADE: '`, para agrupar as etiquetas na lista do CRM. Ele viu a primeira
 * gravada e pediu o contrário — *"deixe somente caxias do sul"* —, e está certo: a etiqueta
 * aparece no cartão do contato e na coluna da tela de Contatos, onde o prefixo repetido em toda
 * linha só rouba espaço de leitura. As etiquetas dele já são assim (`SERRA`, `SEM INTERESSE`).
 *
 * **Conferido antes de tirar:** nenhum dos 497 municípios do RS tem o mesmo nome de um dos 28
 * COREDEs, então cidade e região não colidem sem o prefixo — o filtro continua sem ambiguidade.
 * Município novo no país? Reconfira, porque é o prefixo que estaria protegendo disso.
 */
export const PREFIXO_PADRAO = '';

/** O prefixo da primeira versão, para achar e renomear o que já foi criado com ele. */
export const PREFIXO_ANTIGO = 'CIDADE: ';

/**
 * O nome da etiqueta de uma cidade.
 *
 * Maiúsculas para acompanhar o padrão das etiquetas que já existem no CRM ("1 SEM RETORNO",
 * "SEM INTERESSE", "CONTEÚDO FLÁVIO"). O acento **fica**: o casamento com a lista do CRM é feito
 * por `normalize`, que já ignora acento, então manter deixa o nome legível sem custar precisão.
 */
export function nomeDaEtiqueta(cidade, prefixo = PREFIXO_PADRAO) {
  const limpa = String(cidade || '').trim();
  if (!limpa) return '';
  return `${prefixo}${limpa.toLocaleUpperCase('pt-BR')}`;
}

/**
 * As etiquetas que ficaram com o prefixo antigo, e o nome que cada uma deveria ter.
 *
 * Renomear no CRM é o que conserta os contatos **sem tocar em nenhum deles**: a etiqueta é a
 * mesma, muda só o rótulo, e todo mundo que a tem passa a mostrar o nome novo. Uma requisição por
 * etiqueta, em vez de duas por contato (remover a antiga, aplicar a nova) — e sem janela em que o
 * contato fica sem etiqueta nenhuma.
 *
 * Só devolve quando o nome novo **não existe ainda**: se as duas versões estiverem no CRM,
 * renomear criaria duplicata de rótulo, e aí quem decide o que fazer é você, não este código.
 *
 * @param {Array<{id, label}>} etiquetas as etiquetas reais do CRM
 * @returns {Array<{id, de: string, para: string}>}
 */
export function etiquetasComPrefixoAntigo(etiquetas, prefixo = PREFIXO_ANTIGO) {
  const alvo = normalize(prefixo);
  if (!alvo) return [];

  const existentes = new Set((etiquetas || []).map((t) => normalize(t.label)));
  const fora = [];

  for (const t of etiquetas || []) {
    const rotulo = String(t.label || '');
    if (normalize(rotulo).indexOf(alvo) !== 0) continue;

    const semPrefixo = rotulo.slice(prefixo.length).trim();
    if (!semPrefixo) continue;
    if (existentes.has(normalize(semPrefixo))) continue; // já existe: não cria duplicata

    fora.push({ id: t.id, de: rotulo, para: semPrefixo });
  }
  return fora;
}

/**
 * Decide o que fazer com a base inteira, sem tocar na rede.
 *
 * @param {Array} contatos       contatos com `id`, `tagsId` e a cidade já extraída em `cidade`
 * @param {object} ctx
 * @param {Map<string,object>} ctx.etiquetasPorNome  nome normalizado → { id, label } do CRM
 * @param {Set<string>} ctx.municipios               nomes normalizados dos municípios do RS
 * @param {string} ctx.prefixo
 * @returns {{
 *   paraGravar: Array<{contactId, cidade, etiqueta, tagsId}>,
 *   faltamCriar: Array<{cidade, nome, quantos}>,
 *   revisar: Array<{cidade, quantos}>,
 *   jaOk: number, semCidade: number, semEtiqueta: number
 * }}
 */
export function analisar(contatos, { etiquetasPorNome, municipios, prefixo = PREFIXO_PADRAO } = {}) {
  const paraGravar = [];
  const faltam = new Map();
  const revisar = new Map();
  let jaOk = 0;
  let semCidade = 0;
  let semEtiqueta = 0;

  for (const contato of contatos || []) {
    const cidade = String(contato.cidade || '').trim();
    const tagsId = Array.isArray(contato.tagsId) ? contato.tagsId : [];

    // Regra dele: só quem JÁ tem etiqueta entra. Quem não tem nenhuma ainda não foi trabalhado —
    // e etiquetar cidade de quem não passou pela triagem misturaria as duas coisas no filtro.
    if (!tagsId.length) {
      semEtiqueta++;
      continue;
    }
    if (!cidade) {
      semCidade++;
      continue;
    }

    // Trava 1: é município do RS de verdade? Texto livre não vira etiqueta.
    if (!municipios.has(normalize(cidade))) {
      const chave = normalize(cidade);
      const atual = revisar.get(chave) || { cidade, quantos: 0 };
      atual.quantos++;
      revisar.set(chave, atual);
      continue;
    }

    const nome = nomeDaEtiqueta(cidade, prefixo);
    const etiqueta = etiquetasPorNome.get(normalize(nome));

    // Trava 2: sem etiqueta no CRM, não inventa id — a cidade entra na lista do que falta criar.
    if (!etiqueta) {
      const chave = normalize(nome);
      const atual = faltam.get(chave) || { cidade, nome, quantos: 0 };
      atual.quantos++;
      faltam.set(chave, atual);
      continue;
    }

    // Trava 3: já tem? Não gasta requisição.
    if (tagsId.includes(etiqueta.id)) {
      jaOk++;
      continue;
    }

    paraGravar.push({ contactId: contato.id, cidade, etiqueta, tagsId });
  }

  const porQuantidade = (a, b) => b.quantos - a.quantos;
  return {
    paraGravar,
    faltamCriar: [...faltam.values()].sort(porQuantidade),
    revisar: [...revisar.values()].sort(porQuantidade),
    jaOk,
    semCidade,
    semEtiqueta,
  };
}

/**
 * O ritmo entre requisições, que se ajusta ao que a API aguenta.
 *
 * "O mais rápido possível" e "não derrubar a plataforma" só convivem se o ritmo for medido em vez
 * de escolhido: pausa fixa alta desperdiça horas, pausa fixa baixa derruba a API — e a plataforma
 * junto, que é onde ele atende. Então acelera enquanto responde bem e recua na primeira recusa.
 *
 * O sinal de limite é `Failed to fetch`, não status HTTP: um limitador de taxa recusa o preflight
 * CORS, e o navegador entrega isso como falha de rede. Armadilha já documentada no CLAUDE.md.
 *
 * A recuada é agressiva de propósito (dobra a pausa, e o teto é alto): errar para o lado lento
 * custa minutos; errar para o lado rápido custa a plataforma fora do ar no meio do atendimento.
 */
export class Ritmo {
  constructor({ inicialMs = 400, minMs = 150, maxMs = 8000, acelerarApos = 12 } = {}) {
    this.pausaMs = inicialMs;
    this.minMs = minMs;
    this.maxMs = maxMs;
    this.acelerarApos = acelerarApos;
    this.seguidas = 0;
    this.recuadas = 0;
  }

  /** Deu certo. Depois de uma sequência limpa, acelera um pouco. */
  sucesso() {
    this.seguidas++;
    if (this.seguidas >= this.acelerarApos) {
      this.seguidas = 0;
      this.pausaMs = Math.max(this.minMs, Math.round(this.pausaMs * 0.8));
    }
  }

  /** Recusado. Dobra a pausa e zera a contagem — a próxima aceleração começa do zero. */
  recuar() {
    this.seguidas = 0;
    this.recuadas++;
    this.pausaMs = Math.min(this.maxMs, Math.round(this.pausaMs * 2));
    return this.pausaMs;
  }

  /** Bateu no teto e continua sendo recusado: insistir é castigar a plataforma. */
  desistir() {
    return this.pausaMs >= this.maxMs && this.recuadas >= 3;
  }
}

/**
 * Isto é limitador de taxa, e não erro de verdade?
 *
 * `Failed to fetch` é o preflight CORS recusado — o que um limitador devolve. 429 e 503 são o
 * mesmo recado dito em HTTP. Qualquer outra coisa (400, 404, 500 de negócio) é problema do
 * pedido, e nesse caso esperar mais não conserta nada: quem chama trata como erro do contato.
 */
export function ehLimiteDeTaxa(mensagem) {
  const m = String(mensagem || '');
  return /failed to fetch|load failed|networkerror|→ 429|→ 503|too many requests/i.test(m);
}
