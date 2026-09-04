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

/**
 * Quantas mensagens dela cada anotação carrega.
 *
 * Cinco é o número dele (*"deve pegar ao menos as 5 últimas mensagens"*), e é o que faz a anotação
 * explicar o caso em vez de mostrar o sintoma: nas dez que ele me mandou, várias tinham como última
 * mensagem um link solto ou um "Estamos juntos", com o assunto duas mensagens acima.
 */
export const MAX_MENSAGENS = 5;

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
    /**
     * **As últimas mensagens dela** — pedido dele (02/09/2026): *"o contexto das conversas está
     * muito pequeno, deve pegar ao menos as 5 últimas mensagens"*.
     *
     * A primeira versão guardava só a última, e ele estava certo: em várias das dez anotações que
     * ele me mandou a última mensagem era um link solto ou um "Estamos juntos", e o que explicava o
     * caso estava duas mensagens acima. Com uma só, eu leria o sintoma sem a conversa.
     *
     * Aceita também o `mensagem` singular das anotações já gravadas — elas não se perdem.
     */
    mensagens: (() => {
      const lista = Array.isArray(d.mensagens) ? d.mensagens : d.mensagem ? [d.mensagem] : [];
      return lista.map((m) => texto(m, 300)).filter(Boolean).slice(-MAX_MENSAGENS);
    })(),
    etiquetas: (Array.isArray(d.etiquetas) ? d.etiquetas : []).map((t) => texto(t, 40)).filter(Boolean).slice(0, 12),
    /**
     * **Qual versão da extensão decidiu isto.**
     *
     * Custou uma tarde em 03/09/2026: das oito anotações de um lote, três já estavam consertadas
     * antes de ele me mandar — a confirmação de presença, o insulto ao aliado e a resposta enlatada
     * em cima do áudio longo. Com a data sozinha (e vários consertos no MESMO dia) não havia como
     * saber, e eu medi caso a caso para descobrir que não havia nada a fazer.
     *
     * A anotação nasce no instante da decisão, então a versão de então é o único dado que responde
     * *"isto já foi consertado?"* sem adivinhação. Vazio nas anotações antigas, que continuam
     * valendo.
     */
    versao: texto(d.versao, 12),
    /**
     * **Quando ela falou pela última vez.**
     *
     * Mesmo pedido dele que pôs a linha na caixa da rodada (04/09/2026): *"especifique sempre
     * quando foi feita a última mensagem"*. Vale igual aqui — eu li vários lotes sem saber se as
     * mensagens eram do mesmo dia, e "cumprimento de hoje" e "cumprimento de ontem" pedem
     * desfechos diferentes desde o critério de tempo do apoio.
     */
    ultimaDelaEm: texto(d.ultimaDelaEm, 40),
    porque: texto(d.porque, 1000),
    /**
     * **Já foi copiada para o Claude?**
     *
     * Pedido dele (02/09/2026): *"ao copiar vai vir casos anteriores, eu tenho que lembrar de apagar
     * para começar outra rodada"*. Regra que exige alguém lembrar não é regra — é a mesma lição que
     * a série da versão deste projeto já carrega.
     *
     * Sem esta marca a única saída era apagar tudo depois de colar, e apagar é destrutivo: se a
     * colagem desse errado, as anotações tinham ido embora. Marcar não perde nada e ainda deixa o
     * histórico consultável.
     */
    copiada: !!d.copiada,
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

/** As que ainda não foram para o Claude — é o que a cópia manda por padrão. */
export function naoCopiadas(lista) {
  return normalizar(lista).filter((x) => !x.copiada);
}

/**
 * Marca como copiadas as anotações cujo `em` está na lista dada.
 *
 * Pelo `em` (o instante em que ela nasceu) e não pela posição: entre o clique e a gravação o painel
 * pode ter acrescentado outra anotação, e marcar por índice pegaria a errada.
 */
export function marcarCopiadas(lista, marcadas) {
  const alvos = new Set(normalizar(marcadas).map((x) => x.em));
  return normalizar(lista).map((x) => (alvos.has(x.em) ? { ...x, copiada: true } : x));
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
      // A HORA junto do dia: num dia com vários consertos, "de manhã" e "à tarde" são versões
      // diferentes da extensão, e é isso que diz se a anotação já foi atendida.
      const quando = new Date(it.em);
      const dia = it.em.slice(0, 10).split('-').reverse().join('/');
      const hora = Number.isNaN(quando.getTime())
        ? ''
        : ` ${String(quando.getHours()).padStart(2, '0')}:${String(quando.getMinutes()).padStart(2, '0')}`;
      const versao = it.versao ? ` · v${it.versao}` : '';
      linhas.push(`  - ${dia}${hora}${versao} · ${it.contato || 'contato sem nome'} · sugeriu a tecla ${it.tecla || '?'}`);
      if (it.motivo) linhas.push(`      a caixa disse: ${it.motivo}`);
      if (it.mensagens.length === 1) {
        linhas.push(`      ela escreveu: "${it.mensagens[0]}"`);
      } else if (it.mensagens.length) {
        // Em ordem, a mais recente por último — é como a conversa é lida na tela.
        linhas.push(`      as últimas ${it.mensagens.length} dela:`);
        for (const m of it.mensagens) linhas.push(`         · "${m}"`);
      }
      if (it.ultimaDelaEm) {
        const q = new Date(it.ultimaDelaEm);
        if (!Number.isNaN(q.getTime())) {
          const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
          const dias = Math.round((dia(new Date(it.em)) - dia(q)) / 86400000);
          const quando = dias <= 0 ? 'no mesmo dia' : dias === 1 ? 'no dia ANTERIOR' : `${dias} dias antes`;
          linhas.push(`      a última dela foi ${quando} (${q.toLocaleString('pt-BR')})`);
        }
      }
      if (it.etiquetas.length) linhas.push(`      etiquetas: ${it.etiquetas.join(', ')}`);
      linhas.push(`      >> ELE: ${it.porque}`);
    }
    linhas.push('');
  }
  return linhas.join('\n');
}
