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
 * Pode ser uma FUNÇÃO quando a mesma situação pede teclas diferentes conforme o contexto — é o
 * caso de quem volta por outro anúncio, que ora merece a mensagem do momento, ora só concluir.
 * `quando(ctx)` recebe o retrato do contato; `motivo(ctx)` escreve a frase que aparece em cima.
 */
export const REGRAS = [
  {
    id: 'etiqueta-dispensa-da-fila',
    tecla: '2',
    /**
     * Etiqueta que dispensa o contato da rodada (configurável na aba Automatizado).
     *
     * Pedido dele: quem tem "engajado" pode ser pulado. Faz sentido — o trabalho da rodada é
     * transformar desconhecido em engajado; quem já chegou lá não precisa de formulário nem de
     * pergunta de interesse.
     *
     * **Fica em PRIMEIRO — e isto é uma reversão minha, decidida por ele** (31/08, print do
     * Deoclecio): *"veja isso também que não pulou o engajado"*, num contato engajado que tinha
     * mandado um vídeo.
     *
     * Eu tinha posto esta regra abaixo de "pede resposta pessoal" argumentando que engajado com
     * áudio é quem mais merece resposta. O argumento é bonito e o trabalho dele desmente: o que
     * o engajado manda, na prática, é vídeo e link de política o dia inteiro. Responder a cada um
     * não é atenção, é não conseguir sair da fila.
     *
     * Continua sendo só sugestão: a tecla 6 está lá, a um toque, para quando o vídeo merecer.
     *
     * Sugere PULAR e não CONCLUIR: pular deixa o atendimento aberto, e fechar quem está engajado
     * sem dizer nada é decisão maior do que uma sugestão deve tomar.
     */
    quando: (c) => !!c.etiquetaQueDispensa,
    motivo: (c) => `tem a etiqueta "${c.etiquetaQueDispensa}" — já está engajado, a rodada não precisa dele.`,
  },
  {
    id: 'ultima-pede-resposta-pessoal',
    tecla: '6',
    /**
     * Áudio, vídeo, documento ou texto longo → responder à mão.
     *
     * **Vence tudo menos a etiqueta que dispensa da fila.** Foi o caso que ele trouxe: contato
     * JÁ classificado, com etiqueta e conteúdo pedido, que mandou um áudio de 1min13 contando da
     * família, da igreja e do convite para almoçar. A caixa sugeria mandar o modelo aprovado — e
     * mandar modelo para quem acabou de falar isso parece deboche.
     *
     * Só o "engajado" passa na frente, e por decisão dele: engajado manda vídeo e link o dia
     * inteiro, e responder a cada um é não sair da fila.
     *
     * Ter etiqueta não quer dizer que a conversa acabou. O que a pessoa acabou de dizer manda
     * mais do que o que ela pediu semana passada.
     */
    quando: (c) => !!c.pedeRespostaPessoal,
    motivo: (c) => `${c.pedeRespostaPessoal.motivo}. Responda à mão.`,
  },
  {
    id: 'ultima-e-despedida',
    tecla: '3',
    /**
     * A pessoa só fechou a conversa: "É nós", "tamo junto", "abraço", "valeu".
     *
     * Pedido dele, com a print de quem escreveu apenas *"É nós."* e recebeu "mande o modelo":
     * *"a pessoa só fechou a conversa… eu concluo a conversa"*.
     *
     * **Fica acima de "conteúdo pedido", e é esse o ponto.** Ela já tinha recebido o conteúdo às
     * 10:46 e escreveu "É nós" às 14:30 — a mensagem era o agradecimento, não um novo pedido.
     * Mandar o modelo de novo ali é responder a uma despedida com propaganda.
     *
     * Concluir e não pular: a conversa acabou de verdade, e o contato volta sozinho para "Meus"
     * se escrever de novo. Pular deixaria a fila cheia de conversas encerradas.
     */
    quando: (c) => !!c.ultimaEhDespedida,
    motivo: () => 'ela só se despediu ("é nós", "abraço") — a conversa acabou. Conclua.',
  },
  {
    id: 'voltou-por-outro-anuncio',
    /**
     * Ignorou o pedido de dados e voltou clicando em OUTRO anúncio.
     *
     * Relato dele: *"uma situação frequente é a pessoa ignorar o pedido de dados e retornar por
     * outro anúncio; quando isso acontece ou eu concluo e vou pra próxima ou mando mensagem do
     * momento"*.
     *
     * **Pedir os dados de novo é o que NÃO serve aqui** — e é justamente o que a regra de "sem
     * etiqueta de cidade" sugeriria, por isso esta vem antes dela. A pessoa já viu o formulário e
     * escolheu não responder; repetir vira a terceira mensagem igual.
     *
     * A tecla é os dois desfechos que ele descreveu, escolhidos pelo que já saiu hoje: se a
     * mensagem do momento ainda não foi, ela vai (alguma coisa a pessoa recebe); se já foi, só
     * concluir — mandar duas no mesmo dia é o que faz a conta parecer robô.
     */
    tecla: (c) => (c.momentoHoje || !c.podeMandarMomento ? '3' : '5'),
    quando: (c) => c.voltouPorOutroAnuncio && !c.temEtiquetaDeCidade,
    motivo: (c) =>
      c.momentoHoje || !c.podeMandarMomento
        ? 'ignorou o pedido de dados e voltou por outro anúncio — não peça de novo, só conclua.'
        : 'ignorou o pedido de dados e voltou por outro anúncio — não peça de novo; mande a mensagem do momento.',
  },
  {
    id: 'ultima-e-so-reacao',
    /**
     * Última mensagem é imagem, figurinha, emoticon ou link.
     *
     * Vem ANTES de "sem etiqueta de cidade" porque é sobre o que a pessoa **acabou de fazer**,
     * que é o sinal mais recente que existe. Responder um 👍 com "me manda seu nome e cidade"
     * lê como robô que não olhou a tela.
     *
     * **Se você já respondeu hoje, o desfecho é CONCLUIR e não a mensagem do momento** — pedido
     * dele, com a print do Paulo Quevedo: ele tinha escrito uma resposta longa às 09:29 e a
     * pessoa mandou um link do TikTok às 14:43. Mandar a mensagem do momento ali é empilhar uma
     * segunda mensagem nossa em cima da que ela ainda nem comentou.
     */
    tecla: (c) => (c.respondidoHoje || !c.podeMandarMomento ? '3' : '5'),
    quando: (c) => c.ultimaEhSoReacao,
    motivo: (c) =>
      c.respondidoHoje
        ? 'você já respondeu hoje e ela mandou só uma figura, emoji ou link — pode concluir.'
        : !c.podeMandarMomento
          ? 'a última mensagem foi só uma figura, emoji ou link, e não há mensagem do momento — conclua.'
          : 'a última mensagem foi só uma figura, emoji ou link — a mensagem do momento responde ao gesto.',
  },
  {
    id: 'conteudo-pedido',
    tecla: '1',
    /**
     * Ele pediu um conteúdo e há modelo mapeado: mandar é o que fecha o atendimento.
     *
     * `modeloJaNaConversa` cobre o que o registro de envios não vê — modelo disparado pela
     * automação da plataforma ou à mão por outra pessoa. Sem isso a rodada sugeria mandar de novo
     * o que estava na tela algumas mensagens acima (print dele, 31/08).
     */
    quando: (c) => c.podeEnviar && !c.enviadoHoje && !c.modeloJaNaConversa,
    motivo: (c) => `pediu "${c.conteudoPedido || 'conteúdo'}" e há modelo mapeado — mande.`,
  },
  {
    id: 'nome-sem-sentido',
    tecla: '4',
    /**
     * **O critério é o NOME, não a cidade** — e esta é a segunda correção dele nesta regra.
     *
     * Ela nasceu em 30/08 como *"quando a pessoa não tiver etiqueta de cidade, sempre pedir
     * dados"*. Em 31/08 ele a pôs abaixo de "conteúdo pedido" (*"ela ignorou totalmente o pedido
     * da cidade, eu mando o modelo mesmo assim"*), e no mesmo dia apontou o que ainda sobrava:
     *
     * > *"ao abrir conversas está pedindo dados pra quem já tem etiquetas; uma exceção pra pedir
     * > é somente quando o nome da pessoa estiver totalmente sem sentido ou em falta"*
     *
     * Ele está certo, e o argumento é sobre o que cada falta CUSTA. Cidade faltando é comum e
     * não impede trabalhar o contato: ele tem etiqueta, tem conteúdo, aparece nos filtros que
     * importam, e a cidade ainda pode vir numa conversa qualquer. **Nome vazio ou impronunciável
     * é o que quebra** — bloqueia o vocativo, deixa o cadastro inútil no CRM, e nenhuma outra
     * conversa conserta sozinha.
     *
     * **A exceção que fica:** já pedido hoje não é recomendado de novo. Pedir duas vezes no
     * mesmo dia soa a robô. A opção continua na tela; ela só deixa de ser a sugerida.
     */
    quando: (c) => c.nomeSemSentido && c.podePedirDados && !c.pedidoHoje,
    motivo: () =>
      'o nome do cadastro está vazio ou sem sentido — é o que nenhuma outra conversa conserta. Peça os dados.',
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
    if (!casa) continue;
    const tecla = typeof regra.tecla === 'function' ? regra.tecla(c) : regra.tecla;
    if (!tecla) continue; // a regra casou mas não há tecla para ela agora
    return { id: regra.id, tecla, motivo: regra.motivo(c) };
  }
  return null;
}
