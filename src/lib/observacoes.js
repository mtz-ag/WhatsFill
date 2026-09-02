/**
 * observacoes.js — **o que ele anota quando a sugestão da rodada está errada.**
 *
 * Pedido dele (02/09/2026): *"vamos implementar a observação para sugestão onde vou escrever o
 * porque está errado e lhe passar essas informações depois, monte um botão de salvar as observações
 * para que isso seja possível"*.
 *
 * ## Por que a anotação carrega o CASO junto
 *
 * A lição já está registrada no projeto, na janela do fluxo: ele ia me mandar só as observações e
 * cortou — *"não faz sentido eu colar para você sem você ter a visão do fluxo"*. Vale igual aqui, e
 * mais ainda: *"essa sugestão está errada"* não me diz nada sem **qual regra decidiu, que tecla ela
 * mandou apertar, e o que a pessoa tinha escrito**. Eu responderia adivinhando.
 *
 * Então quem grava não escolhe o que anexar: a entrada nasce com o contato, a regra, a tecla, o
 * motivo que a caixa mostrou e a última mensagem dela. Ele escreve só o porquê.
 *
 * ## O que este módulo NÃO faz
 *
 * Nada aqui muda o que a rodada decide. É um caderno — o mesmo papel do `no.nota` no quadro do
 * fluxo, e pela mesma razão: anotação que mudasse comportamento sozinha deixaria de ser recado e
 * viraria uma condição sem teste.
 */

/** Quantas anotações guardar. Passa disso, a mais antiga sai. */
export const MAX = 200;

/** Corta texto longo sem quebrar o armazenamento — `chrome.storage.local` não é infinito. */
function texto(valor, limite) {
  return String(valor || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limite);
}

/**
 * Uma anotação, com o caso preso a ela.
 *
 * `porque` é o que ele escreve; todo o resto o painel preenche sozinho, e é isso que torna a
 * anotação útil daqui a uma semana.
 */
export function nova(dados) {
  const d = dados || {};
  return {
    em: typeof d.em === 'string' && d.em ? d.em : new Date().toISOString(),
    contato: texto(d.contato, 80),
    regra: texto(d.regra, 60),
    tecla: texto(d.tecla, 4),
    motivo: texto(d.motivo, 240),
    // O que ELA escreveu. Sem isto, "a regra pegou gente demais" não tem como ser conferido.
    mensagem: texto(d.mensagem, 400),
    etiquetas: (Array.isArray(d.etiquetas) ? d.etiquetas : []).map((t) => texto(t, 40)).filter(Boolean).slice(0, 12),
    porque: texto(d.porque, 1000),
  };
}

/** Peneira o que veio do armazenamento — pode ter sido gravado por uma versão anterior. */
export function normalizar(bruto) {
  return (Array.isArray(bruto) ? bruto : [])
    .filter((x) => x && typeof x === 'object')
    .map((x) => nova(x))
    .filter((x) => x.porque);
}

/**
 * Acrescenta uma anotação, a mais recente por último.
 *
 * Recusa a anotação vazia: botão que grava nada e diz "salvo" ensina a não confiar no botão.
 */
export function acrescentar(lista, entrada) {
  const item = nova(entrada);
  if (!item.porque) return { lista: normalizar(lista), gravou: false };
  const nova_ = [...normalizar(lista), item];
  return { lista: nova_.slice(-MAX), gravou: true };
}

export function apagarTudo() {
  return [];
}

/**
 * **O texto que ele cola para mim.**
 *
 * Agrupado por REGRA, porque é assim que eu conserto: uma regra errada é um lugar no código, e ver
 * as três vezes que ela errou juntas mostra o padrão que uma sozinha não mostra.
 *
 * A data vira dia (não o instante) — o que importa é "quando isso começou", não o segundo.
 */
export function paraTexto(lista) {
  const itens = normalizar(lista);
  if (!itens.length) return 'Nenhuma observação anotada.';

  const porRegra = new Map();
  for (const it of itens) {
    const chave = it.regra || '(sem regra — a caixa não sugeriu nada)';
    if (!porRegra.has(chave)) porRegra.set(chave, []);
    porRegra.get(chave).push(it);
  }

  const linhas = [
    'OBSERVAÇÕES DA RODADA — WhatsFill+IA',
    `${itens.length} anotação(ões), em ${porRegra.size} regra(s). Gerado em ${new Date().toLocaleString('pt-BR')}.`,
    'Cada uma traz o caso junto: a regra que decidiu, a tecla que ela mandou apertar e o que a pessoa escreveu.',
    '',
  ];

  for (const [regra, doGrupo] of porRegra) {
    linhas.push(`## ${regra}  (${doGrupo.length}×)`);
    for (const it of doGrupo) {
      const dia = it.em.slice(0, 10).split('-').reverse().join('/');
      linhas.push(`  - ${dia} · ${it.contato || 'contato sem nome'} · sugeriu a tecla ${it.tecla || '?'}`);
      if (it.motivo) linhas.push(`      a caixa disse: ${it.motivo}`);
      if (it.mensagem) linhas.push(`      ela escreveu: "${it.mensagem}"`);
      if (it.etiquetas.length) linhas.push(`      etiquetas: ${it.etiquetas.join(', ')}`);
      linhas.push(`      >> ELE: ${it.porque}`);
    }
    linhas.push('');
  }
  return linhas.join('\n');
}
