/**
 * sugestao.js — o que a rodada RECOMENDA fazer com este contato.
 *
 * **Só recomenda. Nunca decide.** Todas as opções continuam na tela e todas as teclas continuam
 * valendo; isto escolhe qual sai destacada e escreve o porquê em cima. É essa fronteira que
 * permite uma regra ser agressiva ("sempre pedir dados") sem risco: o pior caso é um destaque
 * no lugar errado, não uma mensagem enviada errada.
 *
 * **Por que virou tabela.** O destaque nasceu espalhado em três expressões `primaria:` dentro do
 * montador da pergunta. Cada situação nova exigia mexer numa condição booleana no meio do
 * código, e ninguém conseguia dizer, olhando, qual regra tinha vencido. Aqui a ordem É a
 * prioridade: a primeira que casa ganha, e o motivo dela vai para a tela.
 *
 * **Como acrescentar uma situação** (o Thiago vai acrescentando conforme aparecem):
 * ponha uma entrada em `REGRAS`, na posição da prioridade dela, com `quando` e `motivo`. Nada
 * mais precisa mudar — o painel já lê a lista inteira.
 *
 * Puro e sem dependência, como tudo que decide sobre gente real neste projeto.
 */

/**
 * As regras, EM ORDEM DE PRIORIDADE. A primeira que casa vence.
 *
 * `tecla` é a mesma tecla que a caixa da rodada já usa, para o destaque cair na opção certa.
 * `quando(ctx)` recebe o retrato do contato; `motivo(ctx)` escreve a frase que aparece em cima.
 */
export const REGRAS = [
  {
    id: 'sem-etiqueta-de-cidade',
    tecla: '4',
    /**
     * Pedido do Thiago: *"quando a pessoa não tiver etiqueta de cidade, sempre pedir dados"*.
     *
     * Vem em PRIMEIRO, acima até de mandar o conteúdo pedido, e é decisão dele. A razão é o
     * trabalho todo: a API só filtra por etiqueta, então contato sem etiqueta de cidade não
     * entra em filtro nenhum — ele existe no CRM e não aparece em nenhuma lista de trabalho.
     * Mandar o conteúdo para alguém assim resolve hoje e perde a pessoa amanhã.
     *
     * **A exceção que fica:** já pedido hoje não é recomendado de novo. Pedir duas vezes no
     * mesmo dia soa a robô — é a mesma razão pela qual o destaque já saía da tecla 4 nesse caso.
     * A opção continua na tela; ela só deixa de ser a sugerida.
     */
    quando: (c) => !c.temEtiquetaDeCidade && c.podePedirDados && !c.pedidoHoje,
    motivo: () =>
      'sem etiqueta de cidade — sem ela este contato não entra em filtro nenhum. Peça os dados.',
  },
  {
    id: 'conteudo-pedido',
    tecla: '1',
    // Ele pediu um conteúdo e há modelo mapeado: mandar é o que fecha o atendimento.
    quando: (c) => c.podeEnviar && !c.enviadoHoje,
    motivo: (c) => `pediu "${c.conteudoPedido || 'conteúdo'}" e há modelo mapeado — mande.`,
  },
  {
    id: 'nunca-perguntaram-interesse',
    tecla: '7',
    // Sem conteúdo nenhum e sem nunca ter sido perguntado: a pergunta transforma silêncio em sim
    // ou não, e ainda pede nome e cidade na mesma mensagem.
    quando: (c) => c.podePerguntarInteresse && !c.interessePerguntado,
    motivo: () => 'nunca disse o que quer receber — a pergunta de interesse já pede nome e cidade.',
  },
  {
    id: 'pedido-hoje-sem-resposta',
    tecla: '3',
    /**
     * Já pediu hoje e a pessoa não respondeu nada de útil: não há o que mandar sem repetir. O
     * atendimento pode fechar — ela volta para "Meus" sozinha quando responder.
     *
     * Fica por último de propósito: recomendar concluir é a recomendação mais fácil de arrepender.
     */
    quando: (c) => c.pedidoHoje && !c.podeEnviar && !c.temEtiquetaDeCidade,
    motivo: () => 'já pedi os dados hoje e não veio resposta útil — concluir; ela volta ao responder.',
  },
];

/**
 * A recomendação para este contato, ou `null` quando nenhuma regra casa.
 *
 * `null` é resposta legítima e comum: sem regra, a caixa aparece sem destaque nenhum e a decisão
 * é inteiramente dele. Melhor nenhum destaque do que um destaque que não se sustenta.
 *
 * @param {object} ctx retrato do contato — ver `REGRAS`
 * @returns {{id:string, tecla:string, motivo:string}|null}
 */
export function sugerirAcao(ctx) {
  const c = ctx || {};
  for (const regra of REGRAS) {
    let casa = false;
    try {
      casa = !!regra.quando(c);
    } catch (_) {
      // Regra quebrada não pode derrubar a rodada: ela simplesmente não sugere nada.
      casa = false;
    }
    if (casa) return { id: regra.id, tecla: regra.tecla, motivo: regra.motivo(c) };
  }
  return null;
}
