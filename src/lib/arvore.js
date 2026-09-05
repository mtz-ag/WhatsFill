/**
 * arvore.js — o fluxo de atendimento como ÁRVORE, que é como ele desenhou.
 *
 * Pedido dele (01/09/2026), com o diagrama no quadro: a decisão não é uma lista que se lê de cima
 * para baixo, é uma árvore que ramifica por SITUAÇÃO — "anúncio, pessoa nova" de um lado, "pessoa
 * retornando" do outro — e só depois por tipo de mensagem, até a ação. E: *"está incompleto ainda
 * o fluxo, ele precisa ser incrementado de acordo com a demanda"*, ou seja, quem acrescenta ramo
 * é ele, quando a situação aparecer, sem esperar por mim.
 *
 * ## A fronteira que mantém isso seguro
 *
 * **Ele monta a árvore; ele não escreve condição em texto livre.** Escolha dele entre as três
 * opções que ofereci (01/09): a condição de um ramo é (a) um SINAL da lista — coisas que o código
 * já sabe reconhecer e que têm teste — e/ou (b) palavras que ele digita. Nunca uma expressão
 * inventada na hora. O motivo é o mesmo de sempre: o que decide isto sai para eleitor real, em
 * nome de um mandato, e mensagem de WhatsApp não volta.
 *
 * ## Como a árvore anda
 *
 * Percorre os irmãos em ordem; o primeiro que CASA é seguido. Dentro dele, os filhos, recursivo.
 *
 * **Nó que casa mas não resolve NÃO engole o contato**: se ele não tem ação e nenhum filho dele
 * casou, a busca continua nos irmãos de baixo. Parar ali seria um buraco silencioso — o ramo pela
 * metade (que vai existir, porque a árvore cresce "de acordo com a demanda") faria o contato sair
 * da rodada sem nada acontecer, e ninguém descobriria olhando a tela. A janela marca esses nós.
 *
 * ## Compatibilidade com a tabela de regras
 *
 * Um nó pode ser **respaldado por uma regra do código** (`regra: 'sem-interesse'`): a condição e a
 * tecla saem de `REGRAS`, com os testes que elas já têm. `arvorePadrao()` devolve exatamente a
 * tabela de hoje, achatada, e o teste exige que ela decida **igual** a `sugerirAcao` — ligar a
 * árvore não muda nada até ele mexer. As dezesseis regras continuam sendo o miolo; a árvore é
 * onde ele as organiza e acrescenta o que falta.
 *
 * Puro e sem dependência de navegador, como tudo que decide sobre gente real neste projeto.
 */

import { REGRAS, SOBRE, TECLAS } from './sugestao.js';

/**
 * Os SINAIS que um ramo pode usar como condição — o menu que ele vê ao criar um nó.
 *
 * Cada um é uma chave que o painel já calcula e põe no contexto. É por isso que a lista é
 * fechada: sinal novo aqui exige alguém calcular a coisa lá, com teste. `rotulo` é o que aparece
 * no menu; `nao` é como se lê a versão negada, porque "não é hater" e "não veio de anúncio" são
 * condições legítimas e ler `NÃO <rótulo>` fica torto em português.
 */
export const SINAIS = [
  { id: 'veioDeAnuncio', rotulo: 'Veio de um anúncio', nao: 'Não veio de anúncio' },
  { id: 'anuncioReconhecido', rotulo: 'Reconheci de QUAL anúncio ela veio', nao: 'Não reconheci o anúncio' },
  { id: 'jaRespondemosAntes', rotulo: 'Já a atendemos antes (é retorno)', nao: 'Nunca a atendemos (é a primeira vez)' },
  { id: 'jaPediramDados', rotulo: 'Já pedimos o nome e a cidade dela', nao: 'Nunca pedimos o nome e a cidade dela' },
  { id: 'temEtiquetaDeCidade', rotulo: 'Já tem etiqueta de cidade', nao: 'Ainda não tem etiqueta de cidade' },
  { id: 'semInteresse', rotulo: 'Recusou ou veio hostilizar (hater)', nao: 'Não recusou nem hostilizou' },
  { id: 'etiquetaQueDispensa', rotulo: 'Tem a etiqueta que dispensa da fila', nao: 'Não tem a etiqueta que dispensa' },
  { id: 'pedeRespostaPessoal', rotulo: 'Áudio sem transcrição, arquivo ou texto longo', nao: 'Não é áudio, arquivo nem texto longo' },
  { id: 'respondeuComoAjudar', rotulo: 'Respondeu à nossa pergunta "em que posso ajudar?"', nao: 'Não é resposta à nossa pergunta' },
  { id: 'respondeuOsDados', rotulo: 'Respondeu o nome ou a cidade que pedimos', nao: 'Não respondeu o nome nem a cidade' },
  { id: 'confirmouPresenca', rotulo: 'Disse que VAI ao evento', nao: 'Não confirmou presença no evento' },
  { id: 'informouEndereco', rotulo: 'Mandou o endereço, ou já tem a etiqueta de material', nao: 'Não é caso de material a enviar' },
  { id: 'pedeAlgoIndefinido', rotulo: 'Pediu algo e não disse o quê', nao: 'Não pediu nada em aberto' },
  { id: 'pedeAjudaFinanceira', rotulo: 'Pediu dinheiro, cesta básica ou remédio', nao: 'Não pediu dinheiro nem o básico' },
  { id: 'pedeEmprego', rotulo: 'Perguntou como trabalhar no mandato', nao: 'Não perguntou sobre trabalhar aqui' },
  { id: 'pedeLigacao', rotulo: 'Pediu que a gente ligasse para ela', nao: 'Não pediu ligação' },
  { id: 'naoPodeFalarAgora', rotulo: 'Está passando mal, ou fala depois', nao: 'Não avisou nada disso' },
  { id: 'rajadaDeAnuncios', rotulo: 'Só clicou em vários anúncios seguidos', nao: 'Não é rajada de cliques' },
  { id: 'soCortesia', rotulo: 'Só cumprimentou (e nada mais)', nao: 'Escreveu mais que um cumprimento' },
  { id: 'ultimaEhNossa', rotulo: 'A última mensagem é nossa (ou ela não escreveu nada)', nao: 'Ela falou por último' },
  { id: 'etiquetaSoConclui', rotulo: 'Tem a etiqueta que só conclui (assessor)', nao: 'Não é da casa' },
  { id: 'ultimaEhDespedida', rotulo: 'Só se despediu ("amém", "é nós", "abraço")', nao: 'Não foi despedida' },
  { id: 'ultimaEhSoReacao', rotulo: 'Só figura, emoji, sticker ou link', nao: 'Escreveu alguma coisa' },
  { id: 'rajadaEhSoRepasse', rotulo: 'Só repassa link e vídeo de outras pessoas', nao: 'Não é só repasse' },
  { id: 'perguntaAberta', rotulo: 'Fez uma pergunta de razão ou de posição', nao: 'Não fez pergunta' },
  { id: 'soExpressaApoio', rotulo: 'Só apoio, sem pergunta e sem pedido', nao: 'Não é só apoio' },
  { id: 'voltouPorOutroAnuncio', rotulo: 'Voltou clicando em outro anúncio', nao: 'Não voltou por anúncio' },
  { id: 'nomeSemSentido', rotulo: 'O nome do cadastro não serve', nao: 'O nome do cadastro serve' },
  { id: 'respondidoHoje', rotulo: 'Você já respondeu hoje', nao: 'Você ainda não respondeu hoje' },
  { id: 'deOutroDia', rotulo: 'A última mensagem dela é de outro dia', nao: 'Ela escreveu hoje' },
  {
    id: 'materialPendente',
    rotulo: 'Pediu material e ainda não recebeu',
    nao: 'Não há material pendente',
  },
  { id: 'momentoJaEnviado', rotulo: 'A mensagem do momento já saiu para ela', nao: 'A mensagem do momento ainda não saiu' },
  { id: 'pedidoHoje', rotulo: 'Pedimos o nome e a cidade HOJE', nao: 'Não pedimos o nome e a cidade hoje' },
  { id: 'enviadoHoje', rotulo: 'Já mandamos o modelo hoje', nao: 'Não mandamos modelo hoje' },
  { id: 'modeloJaNaConversa', rotulo: 'O modelo já está na conversa', nao: 'O modelo não está na conversa' },
  { id: 'interessePerguntado', rotulo: 'Já perguntamos se ela quer conteúdo', nao: 'Nunca perguntamos o interesse' },
  { id: 'podeEnviar', rotulo: 'Há conteúdo reconhecido com modelo mapeado', nao: 'Não há modelo mapeado' },
];

/** O sinal existe? Ramo que aponta para sinal inexistente nunca casaria, e calado. */
export function sinalConhecido(id) {
  return SINAIS.some((s) => s.id === id);
}

/**
 * Minúsculas e sem acento, para as palavras dele casarem com o que a pessoa escreveu.
 *
 * Local de propósito: `cities.semAcentoNemCaixa` faria este arquivo puxar a lista do IBGE inteira
 * por seis linhas de código.
 */
function achatar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * As palavras casam no texto?
 *
 * `onde: 'ultima'` olha só a última mensagem dela — é o padrão, porque o fluxo é sobre o que a
 * pessoa ACABOU de fazer. `onde: 'qualquer'` varre a conversa toda, para o caso de ela ter dito a
 * coisa três mensagens atrás.
 *
 * Casa por CONTEÚDO e não por palavra inteira: ele vai digitar "bom dia" e "boa tarde", e exigir
 * fronteira de palavra quebraria em pontuação colada, que é como a base escreve.
 */
function alvoDoTexto(ctx, onde) {
  return onde === 'qualquer'
    ? achatar((ctx.textos || []).join(' \n '))
    : achatar(ctx.ultimoTexto || (ctx.textos || []).slice(-1)[0] || '');
}

/**
 * QUAL palavra casou — e não se alguma casou.
 *
 * O motivo vai para a caixa da rodada, em cima da decisão, e é o que ele lê antes de apertar a
 * tecla. Listar as cinco palavras do ramo ("escreveu ajuda financeira, cesta basica, remedio…")
 * não diz o que a pessoa escreveu; diz o que o ramo procura, que é outra coisa e é inútil na hora
 * de decidir. A frase que serve nomeia a palavra que bateu.
 */
export function palavraQueCasou(palavras, ctx, onde) {
  const alvo = alvoDoTexto(ctx || {}, onde);
  for (const p of palavras || []) {
    const chata = achatar(p);
    if (chata && alvo.includes(chata)) return p;
  }
  return null;
}

function palavrasCasam(palavras, ctx, onde) {
  const lista = (palavras || []).filter(Boolean);
  if (!lista.length) return true;
  return !!palavraQueCasou(lista, ctx, onde);
}

/** A regra do código que respalda este nó, se houver. */
function regraDoNo(no) {
  return no.regra ? REGRAS.find((r) => r.id === no.regra) || null : null;
}

/**
 * Este nó descreve o contato?
 *
 * Nó respaldado por regra usa a condição do CÓDIGO — é o que preserva os testes das dezesseis.
 * Nó dele soma sinal e palavras com E: os dois têm que valer. Nenhum dos dois preenchido é um nó
 * de agrupamento, que casa sempre (uma pasta, não uma decisão).
 */
export function casa(no, ctx) {
  if (!no || no.desligado) return false;

  const regra = regraDoNo(no);
  /**
   * **A EXCEÇÃO vale antes de tudo, e vale também para as caixas de REGRA.**
   *
   * Pedido dele (03/09/2026): *"algo que notei que está faltando nos ramos e em geral: condição de
   * mandar mensagem e exceção"*.
   *
   * Ele está apontando o buraco mais caro do quadro livre, o mesmo que o `problemas` já acusava
   * sem poder resolver: a caixa dele **parece** a regra do código e tem o mesmo desfecho na tela,
   * mas não tem as guardas que a regra carrega (`!enviadoHoje && !modeloJaNaConversa`). Antes
   * disto, a única forma de expressar "mande, mas não quando X" era não usar a caixa.
   *
   * Vale para caixa de regra **de propósito**: até aqui a condição das regras do código era o
   * único lugar do quadro que ele não podia tocar, e a exceção é a forma segura de tocar —
   * ela só **estreita** o que a regra alcança, nunca amplia. Nenhuma mensagem passa a sair por
   * causa de uma exceção; algumas deixam de sair, que é o lado barato de errar.
   */
  /**
   * **TODAS as exceções, não só a primeira** (04/09/2026). Basta uma ser verdade para a caixa não
   * decidir nada.
   */
  for (const exc of excecoesDe(no)) {
    if (condicaoCasa(exc, ctx)) return false;
  }

  const outras = no.tambemQuando || [];
  if (regra || outras.length) {
    /**
     * **UMA caixa, VÁRIAS situações que levam ao mesmo texto** — pedido dele (04/09/2026), com a
     * print de duas caixas idênticas: *"junte todas as situações que são usadas na mesma tecla; na
     * print são duas tecla 3, junte as duas e faça o mesmo com exemplos parecidos"*.
     *
     * Ele está certo e é a consequência do que pediu antes: se o quadro se lê pelo que NÓS
     * mandamos, duas caixas com o mesmo desfecho são a mesma caixa — o que muda entre elas é só a
     * situação que a libera. `tambemQuando` é a lista dessas situações a mais, e elas valem por
     * **OU**: basta uma casar.
     *
     * Note a diferença para `maisCondicoes`, que é **E**: aquelas estreitam a mesma situação; estas
     * acrescentam situações. Juntas: (esta OU aquela) E as condições extras E nenhuma exceção.
     *
     * **Só junte o que está COLADO na ordem de decisão.** Duas caixas com o mesmo desfecho em
     * posições distantes fazem trabalhos diferentes — `etiqueta-so-conclui` é proteção e vem no
     * topo; `ultima-e-despedida` tem que perder para a pergunta e para o pedido de dinheiro. Juntar
     * as duas moveria uma delas, e isso muda o que sai para eleitor.
     */
    const casouAlguma = [no.regra, ...outras].filter(Boolean).some((id) => {
      const r = REGRAS.find((x) => x.id === id);
      try {
        return !!r && !!r.quando(ctx || {});
      } catch (_) {
        // Regra quebrada não derruba a rodada: ela simplesmente não casa.
        return false;
      }
    });
    if (!casouAlguma) return false;
    /**
     * **Numa caixa de REGRA, as condições extras também estreitam.** A `quando` do código continua
     * mandando; o que ele acrescenta na janela é somado com E. Nunca amplia — é a mesma disciplina
     * da exceção.
     */
    return (no.maisCondicoes || []).every((cond) => condicaoCasa(cond, ctx));
  }

  /**
   * **TODAS as condições verdadeiras** — pedido dele (04/09/2026): *"o fluxo trabalha com prioridade
   * quando devia estar trabalhando com condições e exceções; se todas condições são aceitas, enviar
   * mensagem de acordo"*.
   *
   * Ele estava apontando um número: medido em 3.000 contextos sorteados, **10,5 regras casavam ao
   * mesmo tempo** e em **85% deles mais de uma mandaria mensagem** — ou seja, quem escolhia a
   * mensagem era a ALTURA da caixa, não a condição dela. Com uma condição só por caixa, a condição
   * significa "eu poderia atender este contato"; com todas, ela passa a significar "eu sou a
   * resposta certa para ele".
   *
   * A ordem continua existindo e vira o que sempre deveria ter sido: **desempate**. Quando duas
   * caixas completas casam juntas e as duas enviam, a de cima ganha e a rodada ACUSA o empate — ver
   * `decidir`.
   */
  return condicoesDe(no).every((cond) => condicaoCasa(cond, ctx));
}

/**
 * As condições de uma caixa: a primeira (`condicao`, que sempre existiu) mais as que ele
 * acrescentou (`maisCondicoes`). Caixa sem condição nenhuma casa com todo mundo, como antes.
 */
export function condicoesDe(no) {
  return [no?.condicao || {}, ...(no?.maisCondicoes || [])];
}

/** As exceções de uma caixa — só as que dizem alguma coisa. */
export function excecoesDe(no) {
  return [no?.excecao || {}, ...(no?.maisExcecoes || [])].filter(
    (e) => !!e && (!!e.sinal || (e.palavras || []).length > 0)
  );
}

/**
 * Uma condição (sinal + palavras) descreve este contato?
 *
 * Uma função só porque a caixa tem DUAS: a que a faz casar e a exceção que a impede. Duas cópias
 * divergiriam na primeira vez que o formato ganhasse um campo — e a exceção decide o que **não**
 * sai para eleitor, que é o lado em que divergir custa caro.
 */
function condicaoCasa(cond, ctx) {
  if (cond.sinal) {
    if (!sinalConhecido(cond.sinal)) return false;
    const valor = !!(ctx || {})[cond.sinal];
    if (cond.negar ? valor : !valor) return false;
  }
  return palavrasCasam(cond.palavras, ctx || {}, cond.onde);
}

/**
 * A ação deste nó, já contando a tecla que ele fixou na janela.
 *
 * Devolve `null` quando o nó não resolve nada — e isso é normal: nó de agrupamento existe para
 * ramificar, não para decidir.
 */
export function acaoDoNo(no, ctx, fixadas) {
  // Numa caixa juntada, quem dita o MOTIVO e a tecla e a regra que realmente casou -- as outras
  // levam ao mesmo desfecho, mas a frase que aparece na caixa da rodada tem que dizer qual foi.
  const regra = regraQueCasou(no, ctx);
  if (regra) {
    const fixa = fixadas?.[regra.id];
    const tecla = fixa || (typeof regra.tecla === 'function' ? regra.tecla(ctx || {}) : regra.tecla);
    if (!tecla) return null;
    let motivo = '';
    try {
      motivo = regra.motivo(ctx || {});
    } catch (_) {
      motivo = SOBRE[regra.id]?.rotulo || regra.id;
    }
    return { tecla, resposta: null, motivo };
  }

  const acao = no.acao || {};
  /**
   * **"A IA assume e responde"** — pedido dele (01/09/2026).
   *
   * Até aqui a IA só entrava onde NENHUM ramo resolvia, o que a tornava o desfecho do que ninguém
   * previu. Ele quer o contrário também: apontar uma situação e dizer *"esta aqui eu confio nela"*.
   * São coisas diferentes — uma é o resto, a outra é uma escolha.
   *
   * O que sai daqui é só a marca; quem chama a IA é o painel, com as mesmas travas de sempre
   * (`validarDecisao`, os `RESTRITOS`, o teto de gasto). A árvore não fala com a API.
   */
  if (acao.ia) return { tecla: null, resposta: null, ia: true, motivo: motivoDele(no, ctx) };
  if (acao.resposta) return { tecla: null, resposta: acao.resposta, motivo: motivoDele(no, ctx) };
  if (acao.tecla) return { tecla: acao.tecla, resposta: null, motivo: motivoDele(no, ctx) };
  return null;
}

/** A frase que aparece em cima da caixa da rodada, para um ramo que é dele. */
/** Entre as regras de uma caixa juntada, a que realmente casou — é o motivo que vai para a tela. */
function regraQueCasou(no, ctx) {
  for (const id of [no.regra, ...(no.tambemQuando || [])].filter(Boolean)) {
    const r = REGRAS.find((x) => x.id === id);
    try {
      if (r && r.quando(ctx || {})) return r;
    } catch (_) {
      // ignora a quebrada
    }
  }
  return regraDoNo(no);
}

function motivoDele(no, ctx) {
  const cond = no.condicao || {};
  const sinal = SINAIS.find((s) => s.id === cond.sinal);
  const partes = [];
  if (sinal) partes.push(cond.negar ? sinal.nao.toLowerCase() : sinal.rotulo.toLowerCase());
  const casou = palavraQueCasou(cond.palavras, ctx || {}, cond.onde);
  if (casou) partes.push(`escreveu "${casou}"`);
  const porque = partes.join(' e ');
  return porque ? `${no.rotulo || 'ramo do fluxo'}: ${porque}.` : `${no.rotulo || 'ramo do fluxo'}.`;
}

/**
 * A decisão da árvore, ou `null` quando nenhum ramo resolve.
 *
 * `null` é resposta legítima e comum — é o que manda o caso para a IA, exatamente como a tabela
 * fazia. O `caminho` volta junto porque a janela acende os nós percorridos, e porque o log da
 * rodada tem que dizer POR ONDE a decisão passou: "veio de anúncio → mensagem padrão → pedir
 * dados" explica-se sozinho; "regra 8" não.
 *
 * @returns {{id:string, tecla:string|null, resposta:string|null, motivo:string, caminho:string[]}|null}
 */
/**
 * **As protecoes que valem MESMO QUE NAO ESTEJAM NO QUADRO DELE.**
 *
 * O quadro de trabalho e uma COPIA do padrao, e nada entra nele sozinho — decisao de desenho, e
 * certa: no quadro a posicao e a prioridade, e enfiar caixa por conta propria mudaria a rodada sem
 * ninguem escolher onde.
 *
 * O preco apareceu em 03/09/2026. Ele reportou duas vezes no mesmo dia o mesmo defeito -- conversa
 * em que so nos falamos recebendo mensagem --, eu criei a regra `ultima-e-nossa`, e ela **nao podia
 * decidir nada** para ele: existe so no padrao. A caixa iria aparecer no cartao "O padrao mudou?" e
 * ficaria esperando ele encaixar, enquanto a mensagem continuava saindo para eleitor.
 *
 * A saida e a distincao entre **preferencia** e **protecao**. Onde mandar o modelo, o que mandar,
 * em que ordem: preferencia, e e dele. "Nao mande nada": protecao, e nao ha ordem em que ela seja
 * outra coisa -- ela nunca compete com as outras caixas, porque o desfecho dela e o silencio.
 *
 * Esta lista e curta de proposito, e o criterio para entrar e duro: **a regra tem que ter efeito
 * `silencio` na tabela, e nao pode enviar nada em nenhum ramo.** Quem esta aqui continua podendo
 * aparecer no quadro (e aparece no padrao), e la ele posiciona; a lista so garante que a ausencia
 * nao vira envio.
 */
const PROTECOES = ['sem-interesse', 'etiqueta-so-conclui', 'ultima-e-nossa', 'confirmou-presenca-evento', 'informou-endereco'];

export function decidir(ctx, arvore, fluxo) {
  const fixadas = fluxo?.teclas || {};
  const c = ctx || {};

  /**
   * As protecoes primeiro, e so as que o quadro dele NAO tem.
   *
   * Tendo a caixa, ela decide pelo quadro como sempre -- inclusive desligada, que continua sendo
   * escolha dele. O que a lista impede e o buraco: protecao que o codigo ganhou e o quadro nunca
   * recebeu.
   */
  /**
   * **As regras JUNTADAS também contam como "está no quadro"** (04/09/2026).
   *
   * Peguei isto na varredura, não por teste: ao juntar `informou-endereco` dentro da caixa de
   * `confirmou-presenca-evento`, ela sumiu desta conta — e a proteção do código passou a disparar
   * ANTES da árvore, vencendo até a recusa. **32% das decisões mudaram** numa varredura de 10.000
   * contextos, com o desfecho errado (`s` virando 2 ou 3).
   */
  const noQuadro = new Set(
    todosOsNos(arvore).flatMap(({ no }) => [no.regra, ...(no.tambemQuando || [])]).filter(Boolean)
  );
  const desligadas = new Set(fluxo?.desligadas || []);
  for (const id of PROTECOES) {
    if (noQuadro.has(id) || desligadas.has(id)) continue;
    const regra = REGRAS.find((r) => r.id === id);
    if (!regra || !regra.quando(c)) continue;
    const tecla = typeof regra.tecla === 'function' ? regra.tecla(c) : regra.tecla;
    return {
      id: 'protecao:' + id,
      tecla,
      resposta: null,
      ia: false,
      motivo: regra.motivo(c),
      caminho: ['protecao do codigo'],
    };
  }

  const andar = (nos, trilha) => {
    for (const no of nos || []) {
      if (!casa(no, c)) continue;
      const daqui = [...trilha, no.id];

      // Filho primeiro: o mais específico vence o mais geral, que é o ponto de ter árvore.
      const doFilho = andar(no.filhos, daqui);
      if (doFilho) return doFilho;

      const acao = acaoDoNo(no, c, fixadas);
      if (acao) {
        return { id: no.id, tecla: acao.tecla, resposta: acao.resposta, ia: !!acao.ia, motivo: acao.motivo, caminho: daqui };
      }
      // Casou e não resolveu: continua nos irmãos. Ver o cabeçalho — parar aqui seria um buraco.
    }
    return null;
  };

  const escolhida = andar(arvore, []);
  return escolhida ? { ...escolhida, empate: empatesDe(escolhida, arvore, c, fixadas) } : null;
}

/**
 * **Quem mais teria mandado mensagem neste contato** — a acusação de empate, escolha dele em
 * 04/09/2026: *"a de cima ganha, e o quadro acusa"*.
 *
 * Medido antes de existir: 10,5 regras casavam ao mesmo tempo e, em 85% dos contextos sorteados,
 * mais de uma MANDARIA mensagem. Isso é a definição de quadro decidido por prioridade — e o
 * empate era invisível, porque a rodada só mostra a caixa que venceu.
 *
 * **É medido no contato real, não no papel.** Uma varredura estática do quadro ("estas duas podem
 * casar juntas?") acusaria quase todos os pares, e alarme que toca sempre se aprende a ignorar. Aqui
 * só aparece o empate que aconteceu de verdade, com o nome de quem perdeu, no log daquele
 * atendimento.
 *
 * Só conta quem **envia**: duas caixas que concluem em silêncio não são um empate que custe nada.
 */
function empatesDe(escolhida, arvore, ctx, fixadas) {
  const envia = (acao) => !!acao && (!!acao.resposta || (!!acao.tecla && TECLAS[acao.tecla]?.efeito === 'envia'));
  const daEscolhida = { tecla: escolhida.tecla, resposta: escolhida.resposta };
  if (!envia(daEscolhida)) return [];

  const perdedores = [];
  for (const { no } of todosOsNos(arvore)) {
    if (no.id === escolhida.id) continue;
    if (!casa(no, ctx)) continue;
    if (envia(acaoDoNo(no, ctx, fixadas))) perdedores.push(no.rotulo || no.regra || no.id);
    if (perdedores.length >= 3) break;
  }
  return perdedores;
}

// ---- construção -------------------------------------------------------------

let contador = 0;
/** Id de nó. Curto porque aparece no log da rodada e em `store`, que não é infinito. */
export function novoId() {
  contador += 1;
  return `n${Date.now().toString(36)}${contador.toString(36)}`;
}

/** Um nó vazio, do jeito que a janela cria quando ele clica em "novo ramo". */
export function noVazio(rotulo) {
  return {
    id: novoId(),
    rotulo: rotulo || 'ramo novo',
    regra: null,
    condicao: { sinal: '', negar: false, palavras: [], onde: 'ultima' },
    /**
     * **"Exceto quando…"** — a condição que IMPEDE esta caixa de decidir.
     *
     * Pedido dele (03/09/2026): *"falta condição de mandar mensagem e exceção"*. É o que permite
     * uma caixa dele carregar a guarda que a regra do código carrega sozinha — "mande o modelo,
     * exceto quando o modelo já está na conversa" — e é a única forma de estreitar uma caixa de
     * regra sem mexer no código.
     *
     * Vazia (sem sinal e sem palavras) não faz nada, que é como toda caixa nasce.
     */
    excecao: { sinal: '', negar: false, palavras: [], onde: 'ultima' },
    acao: null,
    /**
     * O que ele quer que MUDE neste ramo — escrito para mim, não para a extensão.
     *
     * Pedido dele (01/09/2026): *"preciso que cada caixa tenha um input para botar observações que
     * vou escrever para você modificar depois, principalmente as com código não editáveis"*. É a
     * saída para o único lugar do quadro que ele não pode mexer: a condição dos ramos respaldados
     * por regra, que fica no código porque decide o que sai para eleitor. Em vez de me descrever
     * de memória qual regra estava errada, ele escreve na própria caixa.
     *
     * **Nada aqui muda o comportamento da rodada.** É texto, e é de propósito: se a observação
     * mudasse alguma coisa sozinha, ela deixaria de ser um recado e viraria uma condição sem teste.
     */
    nota: '',
    desligado: false,
    filhos: [],
  };
}

/**
 * **O catalogo das regras do codigo — o que o painel do lado oferece para pôr de volta no quadro.**
 *
 * Pedido dele (01/09/2026): *"quando regras são apagadas tem que ter uma opção ou uma aba ali com
 * a lista de regras para arrastar pro fluxo novamente"*. Antes disto, apagar uma caixa "do codigo"
 * era **irreversivel na pratica**: a regra continuava viva no codigo, mas o unico jeito de traze-la
 * de volta era resetar o quadro inteiro para o padrao — que joga fora o arranjo dele. Apagar duas
 * caixas custava o trabalho de uma tarde.
 *
 * Devolve TODAS as regras, e nao so as que faltam, com `quantasNoQuadro` dizendo quantas caixas ja
 * apontam para cada uma. Sao duas coisas diferentes e as duas importam: sumir da lista assim que
 * entra no quadro esconderia que **pôr a mesma regra em dois lugares e legitimo** — o proprio
 * padrao faz isso, com as sete caixas que se repetem dos dois lados da bifurcacao de cidade.
 */
export function catalogoDeRegras(arvore) {
  const quantas = new Map();
  for (const { no } of todosOsNos(arvore)) {
    for (const id of [no.regra, ...(no.tambemQuando || [])].filter(Boolean)) {
      quantas.set(id, (quantas.get(id) || 0) + 1);
    }
  }
  return REGRAS.map((r) => ({
    id: r.id,
    rotulo: SOBRE[r.id]?.rotulo || r.id,
    efeito: SOBRE[r.id]?.efeito || '',
    quando: SOBRE[r.id]?.quando || '',
    quantasNoQuadro: quantas.get(r.id) || 0,
  }));
}

/**
 * Uma caixa de regra com id que ainda nao existe no quadro.
 *
 * `noDeRegra` cunha o id a partir da propria regra (`r:sem-interesse`), o que basta enquanto cada
 * regra aparece uma vez. No catalogo ela pode entrar de novo estando ja no quadro — e id repetido e
 * defeito de verdade, nao cosmetico: `problemas` acusa, e na janela um clique abriria as duas
 * caixas de uma vez. O sufixo numerado e o mesmo formato que `fluxoPadrao` ja usa (`r:id:onde`).
 */
export function noDeRegraLivre(arvore, regra, extras) {
  const usados = new Set(todosOsNos(arvore).map(({ no }) => no.id));
  const base = noDeRegra(regra);
  let id = base.id;
  for (let n = 2; usados.has(id); n += 1) id = `r:${regra}:${n}`;
  return { ...base, id, ...(extras || {}) };
}

function noDeRegra(id) {
  return {
    id: `r:${id}`,
    rotulo: SOBRE[id]?.rotulo || id,
    regra: id,
    condicao: null,
    acao: null,
    nota: '',
    desligado: false,
    filhos: [],
  };
}

/**
 * A árvore de partida: a tabela de hoje, achatada, **na ordem que ele já tinha salvo**.
 *
 * Tem que decidir IGUAL a `sugerirAcao` — há teste exigindo isso —, senão abrir a janela mudaria
 * o comportamento da rodada sem ninguém pedir. Por isso ela nasce plana: agrupar já é uma
 * decisão, e decisão é dele.
 *
 * A ordem e as desligadas que ele tinha na versão de lista vêm junto. Sem isso, semear a árvore
 * jogaria fora o trabalho dele em silêncio — a lista voltaria à ordem do código.
 */
export function arvorePadrao(fluxo) {
  const desligadas = new Set(fluxo?.desligadas || []);
  const vistos = new Set();
  const salva = (fluxo?.ordem || []).filter((id) => REGRAS.some((r) => r.id === id) && !vistos.has(id) && vistos.add(id));

  let ids = REGRAS.map((r) => r.id);
  if (salva.length) {
    // Mesma regra do `ordenar`: id que a ordem salva não conhece herda a posição do vizinho de
    // cima. Regra nova do código não pode nascer no fim da árvore dele.
    const pos = new Map(salva.map((id, i) => [id, i]));
    let herdada = -1;
    const chave = new Map();
    REGRAS.forEach((r, i) => {
      if (pos.has(r.id)) herdada = pos.get(r.id);
      chave.set(r.id, pos.has(r.id) ? pos.get(r.id) : herdada + 0.001 * (i + 1));
    });
    ids = ids.slice().sort((a, b) => chave.get(a) - chave.get(b));
  }

  return ids.map((id) => ({ ...noDeRegra(id), desligado: desligadas.has(id) }));
}

/**
 * **O FLUXO PADRAO — o que o botao "Resetar para o padrao" devolve.**
 *
 * Combinado com ele em 01/09/2026: *"preciso de um reset para o padrao do fluxo atual, quando eu
 * mandar aqui voce atualiza o padrao"*. Ou seja, esta funcao e um DOCUMENTO mantido por mim a
 * partir do que ele escreve nas observacoes das caixas. Ele mexe no quadro a vontade sabendo que
 * o caminho de volta existe; quando quiser que o padrao mude, manda as observacoes e eu edito
 * aqui.
 *
 * **Nao mexa nisto por conta propria.** O padrao e o estado ao qual ele volta quando o quadro
 * ficou confuso — se eu o alterar sem ele pedir, o "volta ao que funcionava" devolve outra coisa,
 * e e justamente nesse momento que ele nao vai conferir ramo por ramo.
 *
 * Nasceu do desenho do quadro dele, virado arvore.
 *
 * Duas coisas que o desenho não tinha e que entram aqui de propósito:
 *
 * 1. **As protecões ficam ACIMA da bifurcação.** Recusa, denúncia respondida, despedida, pergunta
 *    aberta e a etiqueta que dispensa valem para pessoa nova e para quem retorna — o próprio
 *    desenho dele repete "hater xingando" nos dois lados, que é a mesma coisa dita duas vezes.
 *    Sem isto, carregar este preset apagaria a regra que impede material de campanha em cima de
 *    denúncia (o erro de 01/09) e a que impede etiquetar como sem interesse quem só disse que não
 *    podia ir ao evento.
 * 2. **Os dois ramos que ele desenhou e o código não tinha**: saudação escrita ("bom dia") de quem
 *    está voltando, e o pedido de ajuda financeira com a resposta pronta.
 */
export function fluxoPadrao() {
  /**
   * Atalho: um ramo que é só uma regra do código.
   *
   * `onde` entra no ID porque a mesma regra aparece nos dois lados da bifurcação, e id repetido é
   * o que `problemas` acusa — na janela, faria um clique abrir as duas caixas de uma vez.
   */
  const r = (id, rotulo, onde) => ({
    ...noDeRegra(id),
    ...(onde ? { id: `r:${id}:${onde}` } : {}),
    ...(rotulo ? { rotulo } : {}),
  });

  /** Atalho: um ramo dele, que casa por PALAVRAS na última mensagem. */
  const porPalavras = (rotulo, palavras, acao) => ({
    ...noVazio(rotulo),
    condicao: { sinal: '', negar: false, palavras, onde: 'ultima' },
    acao,
  });

  /** Atalho: uma caixa que só agrupa — quem decide são os ramos de dentro. */
  const grupo = (rotulo, condicao, filhos) => ({ ...noVazio(rotulo), condicao, filhos });

  const SEM_CONDICAO = { sinal: '', negar: false, palavras: [], onde: 'ultima' };

  /**
   * As caixas que se repetem nos dois lados (com e sem etiqueta de cidade).
   *
   * Ele montou as mesmas situações nas duas pontas de propósito: ter ou não ter a etiqueta não muda
   * o que fazer com quem só disse "bom dia". Uma função em vez de copiar e colar porque, copiado, um
   * lado é consertado e o outro fica para trás.
   */
  const dosDoisLados = (onde) => [
    /**
     * **"Ela respondeu o nome e a cidade" fica no TOPO — e agora dos dois lados.**
     *
     * Conserto de um conflito que eu mesmo criei ao trazer `conteudo-pedido` para cá (03/09/2026).
     * A prioridade está escrita na regra desde 02/09 (*"vem ACIMA de `conteudo-pedido` de
     * propósito: quem respondeu o que pedimos não precisa de mais material"*), e ela valia porque
     * as duas moravam no mesmo grupo — "sem pendência".
     *
     * Com o modelo dentro de `dosDoisLados`, o lado sem cidade passou a decidir o modelo **antes**
     * de chegar naquele grupo: medido, quem respondia nome e cidade e tinha modelo mapeado recebia
     * o modelo (tecla 1) em vez do agradecimento. A ordem escrita numa regra não se garante sozinha
     * quando as duas caixas mudam de grupo.
     *
     * No topo, e nos dois lados, ela volta a valer sempre — que é como estava documentada.
     */


    /**
     * **Pediu dinheiro: a condicao virou SINAL, nao lista de palavras.**
     *
     * Print da Marli (02/09/2026): ela mandou a propria chave PIX e "50 me ajuda muito", e a caixa
     * sugeria a tecla 9 -- a pergunta de quem ainda nao sabe o que a pessoa quer. A lista casava
     * por trecho contido ("me ajuda com") e ela escreveu "me ajuda muito".
     *
     * Palavra a palavra a lista nunca fecha, e o que decide aqui manda uma NEGATIVA para eleitor.
     * `cortesia.pedeAjudaFinanceira` e testada, olha a rajada inteira (a chave vem numa mensagem e
     * o valor na seguinte) e separa pedir de agradecer -- "voces me ajudaram muito" nao casa.
     */
    { ...noVazio('pediu dinheiro, cesta basica ou remedio'),
      condicao: { sinal: 'pedeAjudaFinanceira', negar: false, palavras: [], onde: 'ultima' },
      acao: { tecla: null, resposta: 'pedido-ajuda' } },

    /**
     * **Quer trabalhar para o mandato** — anotação do Kelvem Marinho (02/09/2026).
     *
     * Ele perguntou *"como faz para trabalhar para vc"* e, na mensagem seguinte, *"No caso vcs não
     * pagam"*. A rodada agradeceu e concluiu. O texto `pedido-emprego` existia desde sempre, entre
     * os `RESTRITOS` que a IA não pode escolher — **e nada no quadro o alcançava.**
     *
     * Fica ao lado do pedido de dinheiro porque é a mesma família: os dois são pedidos que o
     * mandato **não pode atender**, e os dois têm um texto que explica e nega com respeito. Deixar
     * a pergunta sem resposta, ou respondê-la com um agradecimento genérico, é o que faz
     * *"vocês pagam?"* parecer um sim — e prometer emprego a eleitor é proibido pela Lei 9.504/97.
     */
    { ...noVazio('quer trabalhar para o mandato'),
      condicao: { sinal: 'pedeEmprego', negar: false, palavras: [], onde: 'ultima' },
      acao: { tecla: null, resposta: 'pedido-emprego' } },

    /**
     * **"Me liga"** — pedido dele (04/09/2026, anotação da Jucileia).
     *
     * Ela escreveu *"Oi"*, três mensagens que a plataforma não leu, e *"Me liga"*; a rodada ofereceu
     * concluir. Ele: *"caso raro que a pessoa pede ligação: criar mensagem falando que não podemos
     * e dando uma desculpa; não fazemos ligações, a plataforma não aceita e é contraproducente"*.
     *
     * Mesma família das duas de cima: é um pedido que o atendimento **não pode atender**, e o texto
     * explica sem prometer retorno. Concluir em silêncio deixa a pessoa esperando o telefone tocar.
     */
    { ...noVazio('pediu que a gente ligasse'),
      condicao: { sinal: 'pedeLigacao', negar: false, palavras: [], onde: 'ultima' },
      acao: { tecla: null, resposta: 'pedido-ligacao' } },

    /**
     * **Texto longo vem ANTES das caixas de palavra** — print da Cris (02/09/2026).
     *
     * Ela escreveu 437 caracteres de desabafo: sem esperança nas eleições, urnas, *"tudo tempo
     * perdido"*, *"Triste!"*. E começou com *"Oi. Bom dia,"*. A caixa de saudação casa por palavra
     * **contida**, então o desabafo inteiro era lido como um "bom dia" seco e levava a mensagem do
     * momento — material de campanha em cima de um desabafo. Relato dele: *"a IA devia ter assumido
     * e mandado uma mensagem personalizada"*.
     *
     * Aqui em cima, quem escreve conversa nunca é decidido por palavra solta: vai para a tecla 6,
     * que é justamente onde o painel chama a IA (`!sugestao || sugestao.tecla === '6'`) e onde o
     * rascunho personalizado pode sair.
     *
     * **A ajuda financeira continua acima**, e é decisão dele: aquele texto é uma resposta que ele
     * escolheu para sair sozinha. O resto do que é longo passa a ser conversa.
     */
    { ...r('ultima-pede-resposta-pessoal', 'você responde: áudio, texto longo, ou ela está passando mal', onde),
      tambemQuando: ['nao-pode-falar-agora'] },

    /**
     * **"Só cumprimentou" virou SINAL, e não lista de palavras.**
     *
     * Anotação da Teresinha (02/09/2026): ela escreveu *"Boa tarde queria saber mais"*, *"Como faso
     * pra conversar com vocês"* e *"Boa tarde o senhor tá concorendo também"* — e recebeu a mensagem
     * do momento, porque a caixa de palavras casa por trecho CONTIDO e "boa tarde" estava lá.
     * Relato dele: *"não foi só boa tarde, ela fez uma pergunta"*.
     *
     * É a armadilha que o CLAUDE.md já registra com estas palavras: *"caixa de PALAVRAS casa por
     * trecho contido, então ela não sabe se a mensagem é SÓ aquilo"* — e o nome da caixa promete
     * exatamente essa exclusividade. A print da Cris (desabafo de 437 caracteres começando com
     * "Oi. Bom dia,") foi o mesmo defeito em 02/09.
     *
     * `cortesia.soCortesia` responde a pergunta certa: **todas** as últimas mensagens são só
     * cumprimento, figura ou link? Medido nos quatro casos — a Teresinha e a Cris deixam de casar,
     * "Boa tarde" sozinho e "bom dia" continuam.
     */
    /**
     * **A exceção é o que faltava, e é o defeito que ele achou** — print da Carmem Souza
     * (03/09/2026). A caixa da rodada mostrava, em amarelo, *"Hoje este contato já recebeu:
     * Mensagem do momento às 09:36"* — e recomendava, em destaque, a tecla 5. Ele: *"sugestão
     * totalmente errada, já identificou que mandou e sugeriu mandar novamente"*.
     *
     * **É a armadilha registrada da caixa com tecla FIXA**: ela parece a regra do código e tem o
     * mesmo desfecho na tela, mas não carrega as guardas dela. `ultima-e-so-reacao`, logo abaixo,
     * nunca teve esse problema — a tecla dela é função e olha `respondidoHoje`.
     *
     * `repeteSozinha` não acusava, e com razão: `soCortesia` lê a RAJADA depois da nossa última
     * mensagem, então o envio apaga o sinal e a caixa não repete sozinha. O que aconteceu foi
     * outra coisa — ela **escreveu de novo** no mesmo dia, a rajada encheu com outro cumprimento, e
     * a caixa ofereceu a mesma mensagem pela segunda vez.
     *
     * `momentoJaEnviado` é a guarda exata: é literalmente o que o aviso amarelo diz. Sem casar
     * aqui, o caso desce para `ultima-e-so-reacao` ou `ja-respondemos-antes`, que concluem.
     */
    /**
     * **A figura e o link vêm ANTES do cumprimento** — anotação da Maria Genoli (04/09/2026):
     * *"confusão entre cumprimento e mandar link"*.
     *
     * A última coisa que ela mandou foi um link do Facebook, e a caixa que decidiu foi a do
     * cumprimento, com o motivo dizendo *"só cumprimentou, e nada mais"*. `soCortesia` conta link e
     * figura como cortesia de propósito (é o "bom dia ilustrado" desta base), então ela casa nos
     * dois casos — e, estando em cima, engolia o que a caixa de baixo descreve melhor.
     *
     * **A troca resolve as duas coisas de uma vez.** A caixa da reação diz na tela o que de fato
     * aconteceu, e a tecla dela é FUNÇÃO: olha `respondidoHoje` e conclui em vez de repetir a
     * mensagem do momento. A do cumprimento fica com o que sobra — cumprimento **escrito**, que é o
     * que `ehSoReacao` não considera reação.
     */
    r('ultima-e-so-reacao', 'mandou figura, emoji, sticker ou link', onde),
    { ...noVazio('só cumprimentou, e nada mais'),
      condicao: { sinal: 'soCortesia', negar: false, palavras: [], onde: 'ultima' },
      excecao: { sinal: 'momentoJaEnviado', negar: false, palavras: [], onde: 'ultima' },
      acao: { tecla: '5', resposta: null } },
    { ...r('pediu-algo-sem-dizer-o-que', 'você responde: pedido sem objeto, ou pergunta', onde),
      tambemQuando: ['pergunta-aberta'] },
    r('ultima-e-despedida', null, onde),

    /**
     * **O apoio vive nos DOIS lados da bifurcação de cidade** — pedido dele em 03/09/2026, depois
     * de eu apontar a assimetria comparando o quadro dele com o padrão: *"arrume para que a regra
     * siga pras duas"*.
     *
     * Ela existia só em "sem etiqueta de cidade". Quem voltava **com** cidade e só escrevia apoio
     * nunca passava por aqui: caía em `ja-respondemos-antes`, que é a caixa mais genérica do ramo e
     * não olha o que a pessoa escreveu. Na prática o critério de tempo que ele definiu no mesmo dia
     * (apoio de ontem → mensagem do momento; de hoje → agradecer) valia só para metade da base.
     *
     * É a lição que o projeto já pagou uma vez, com `etiqueta-dispensa-da-fila`: **regra que vive
     * só num lado da bifurcação é regra pela metade**, e o lado que falta é invisível — nada
     * acusa, o contato só desce até a primeira caixa genérica.
     *
     * Fica no FIM, abaixo de todas as pendências: quem escreveu uma pergunta, um pedido ou um
     * desabafo é atendido por aquilo, não pelo apoio que veio junto.
     */
    /**
     * **O modelo vem ANTES do agradecimento** — anotação da Rosa (03/09/2026).
     *
     * Ela já tinha etiqueta de cidade, voltou clicando no anúncio das Escolas Cívico-Militares e
     * escreveu *"Temo junto"*, *"Obrigado"*, *"Temo junto 22222"*. A caixa recomendou agradecer
     * (`so-expressa-apoio`). Ele: *"ela veio por um anúncio diferente do padrão, vou mandar o
     * modelo"*.
     *
     * **O lado "com etiqueta de cidade" não tinha `conteudo-pedido`**: quem voltava com cidade e
     * clicava num anúncio novo nunca recebia o modelo daquele anúncio. `voltou-por-outro-anuncio`
     * não cobre — ela exige `modeloJaNaConversa`, ou seja, existe para quem volta pedindo a MESMA
     * coisa (é a distinção da Eroni, 03/09).
     *
     * Fica **abaixo de todas as pendências e acima do apoio**: quem escreveu pergunta ou pedido é
     * atendido por aquilo; quem só disse que está junto e pediu um conteúdo novo recebe o conteúdo,
     * que é resposta melhor que um obrigado. As guardas da regra (`!enviadoHoje`,
     * `!modeloJaNaConversa`) são o que impede isso de virar repetição.
     *
     * No lado "sem cidade" ela já existia em "sem pendência"; aqui ela também aparece dentro de
     * "com pendência", e o efeito é o mesmo daquela — as duas só casam quando nenhuma pendência
     * casou antes.
     */
    /**
     * **A resposta à NOSSA pergunta vem antes do modelo, e agora nos dois lados.**
     *
     * Ela vivia só em "sem etiqueta de cidade", e **abaixo** do apoio. Duas coisas erradas: é a
     * mesma assimetria de cidade que já custou duas regras, e a posição deixava de proteger o caso
     * que ela existe para proteger — a contato respondeu *"é sobre as irregularidades na compra
     * assistida em Eldorado do Sul"* e recebeu material de campanha (01/09/2026).
     *
     * Com o modelo entrando aqui embaixo, a ordem passou a importar de verdade: sem esta caixa
     * acima dele, quem responde uma denúncia à nossa própria pergunta recebe o modelo. O teste que
     * trava o caso de 01/09 acusou na hora.
     */
    r('respondeu-nossa-pergunta', null, onde),

    /**
     * **O tempo decide DEPOIS das pendências, e é a exceção que ele nomeou.**
     *
     * *"Único pretexto que exclui a necessidade de hora é pergunta pendente, que deve ser
     * respondida"* (03/09). Vale para todas as caixas acima, não só para a pergunta: pedido de
     * dinheiro, áudio longo e denúncia respondida não esfriam por ser de ontem.
     *
     * Abaixo delas, porém, o tempo manda — e passa na frente do agradecimento pelo cadastro, do
     * agradecimento pelo apoio e do modelo por etiqueta de conteúdo, que foram os quatro casos de
     * 04/09.
     */
    /**
     * **O modelo só passa na frente do apoio quando o ANÚNCIO foi reconhecido.**
     *
     * Duas anotações no mesmo dia, e a segunda desfez metade da primeira:
     *
     *  - **Rosa** (03/09): já tinha cidade, voltou clicando no anúncio das Escolas Cívico-Militares
     *    e escreveu só apoio. Ele: *"ela veio por um anúncio diferente do padrão, vou mandar o
     *    modelo"*. Eu pus `conteudo-pedido` acima do apoio.
     *  - **Elaine** (04/09): já tinha cidade, escreveu *"Tamos junto capitão"* ONTEM, sem anúncio
     *    reconhecido — e recebeu o modelo por causa daquela mudança. Ele: *"não foi arrumado"*.
     *
     * **A diferença entre as duas é o anúncio, não o apoio.** A Rosa clicou em alguma coisa e
     * aquilo tem um modelo próprio que nunca saiu; a Elaine só disse que está junto, e o "modelo"
     * dela vem da etiqueta de conteúdo — que é justamente o caminho que o critério de tempo do
     * apoio deve decidir (apoio de ontem → mensagem do momento).
     *
     * Por isso o modelo sobe para cima do apoio **dentro do grupo do anúncio reconhecido**, e a
     * cópia de baixo continua atendendo quem não expressou apoio nenhum.
     */
    /**
     * **A rajada de cliques vence o modelo do anúncio** — print da Irene (05/09/2026).
     *
     * Ela precisa ficar acima das duas portas do modelo (o grupo do anúncio reconhecido, logo
     * abaixo, e `conteudo-pedido` mais adiante): quem clicou em três anúncios não está pedindo o
     * conteúdo de um deles.
     */
    r('rajada-de-anuncios', 'só clicou em vários anúncios: mensagem do momento', onde),

    grupo('veio de um anúncio que eu reconheço', { sinal: 'anuncioReconhecido', negar: false, palavras: [], onde: 'ultima' }, [
      r('conteudo-pedido', 'manda o modelo daquele anúncio', `${onde}-anuncio`),
    ]),

    /**
     * **O tempo fica ABAIXO do anúncio reconhecido, e acima de todo o resto que envia.**
     *
     * Clicar num anúncio é pedir uma coisa específica; o `CLAUDE.md` já registra que escolha
     * explícita dela não se substitui por dedução nossa. Um clique de ontem continua sendo um
     * pedido, e o modelo daquele anúncio é a resposta.
     *
     * Daqui para baixo o tempo manda: o agradecimento pelo cadastro, o agradecimento pelo apoio e o
     * modelo por etiqueta de conteúdo foram os quatro casos de 04/09, e nos quatro ele pediu a
     * mensagem do momento.
     */
    r('contexto-de-outro-dia', 'a última dela é de outro dia', onde),
    { ...r('respondeu-os-dados', 'agradecer: respondeu os dados, ou só expressou apoio', onde),
      tambemQuando: ['so-expressa-apoio'] },
    r('conteudo-pedido', 'pediu conteúdo e há modelo mapeado', onde),
  ];

  /**
   * **1. Quem chega do anúncio.**
   *
   * A hostilidade é testada ANTES do pedido de dados, e é decisão dele: *"não faz sentido perguntar
   * quando a pessoa não quer diálogo"* (01/09/2026). Entre irmãos a prioridade é a altura, e
   * `arrumar` respeita a ordem desta lista — a recusa nasce em cima.
   *
   * **As duas são IRMÃS, não uma dentro da outra.** No quadro que ele mandou, "mensagem padrão" tinha
   * caído DENTRO de "Recusou", e como o motor testa o filho antes da ação do próprio nó, o resultado
   * era o inverso do desenho: o hostil recebia o pedido de nome e cidade, e o contato normal não
   * recebia nada. Medido antes de consertar.
   */
  const doAnuncio = grupo('anúncio — pessoa nova', { sinal: 'jaRespondemosAntes', negar: true, palavras: [], onde: 'ultima' }, [
    r('sem-interesse', 'Recusou ou veio hostilizar'),
    /**
     * **Duas situações, um desfecho, UMA caixa** — pedido dele (04/09/2026): *"junte todas as
     * situações que são usadas na mesma tecla; na print são duas tecla 3, junte as duas"*.
     *
     * Só junto o que está COLADO na ordem: estas duas são vizinhas, então juntar não move nada. A
     * despedida também conclui e ficou de fora de propósito — ela vive lá embaixo, onde tem que
     * perder para a pergunta e para o pedido de dinheiro.
     */
    { ...r('etiqueta-so-conclui', 'não mandar nada: é da casa, ou a última é nossa', 'chegada'),
      tambemQuando: ['ultima-e-nossa'] },
    { ...r('confirmou-presenca-evento', 'pular: confirmou presença, ou mandou o endereço', 'chegada'),
      tambemQuando: ['informou-endereco'] },

    /**
     * **A etiqueta que dispensa da fila fica ACIMA do modelo, e isto foi conserto de regressão.**
     *
     * Antes de o modelo subir para cá, quem chegava do anúncio carregando essa etiqueta caía por
     * exclusão no lado "com etiqueta de cidade", onde `etiqueta-dispensa-da-fila` a pegava. Com o
     * modelo no topo, ela passou a **receber mensagem** — e essa etiqueta existe justamente para
     * ninguém receber. Pegado pelos testes do lado de quem chega.
     *
     * É a lição registrada no CLAUDE.md: regra nova no topo tem que ser conferida contra as regras
     * que ela passou a vencer.
     */
    r('etiqueta-dispensa-da-fila', null, 'chegada'),

    /**
     * **Duas pendências que ficam ACIMA do modelo, contra a ordem que ele descreveu.**
     *
     * Ele pediu *"após o modelo terá que ver se tem uma pendência"* — e essa ordem vale para as
     * pendências neutras (bom dia, figura, despedida), que estão logo abaixo. Estas três não:
     * medindo o quadro novo, quem **pediu ajuda financeira** na mensagem seguinte à do anúncio
     * recebia a tecla 1 na primeira passada, e as outras duas também.
     *
     * As três estão registradas neste projeto como o caso em que mandar a nossa mensagem primeiro
     * é o dano, não o atraso:
     *
     * **A ajuda financeira ESTAVA nesta lista e saiu, por decisão dele** (02/09, no mesmo dia):
     * *"o modelo não irá confirmar apoio ao pedido de ajuda ou confirmar que irá ajudar então pode
     * ser respondido após"*. Ele está certo sobre o texto — o modelo é recibo de cadastro e não
     * promete coisa nenhuma, então mandá-lo antes não é promessa de benefício (Lei 9.504/97), que
     * era a minha objeção. A negativa sai na passada seguinte, e continua sendo o `pedido-ajuda`.
     *
     *  - **pediu algo e não disse o quê** → *"material de campanha em cima disso é o pior caso do
     *    projeto"* (print da Mari, 31/08). Perguntar é a única resposta segura;
     *  - **fez uma pergunta de razão ou de posição** → mandar a nossa mensagem vira material de
     *    campanha em cima da pergunta dela (print da Clair, 31/08).
     *
     * O modelo não deixa de sair: sai na passada seguinte, quando a pendência estiver resolvida.
     * O que muda é a ORDEM entre os dois, e nos três casos o custo de inverter é assimétrico —
     * atrasar o recibo um dia contra responder propaganda a um pedido de socorro.
     */
    /**
     * **A ajuda financeira VOLTOU para cima do modelo, por decisão dele** (03/09/2026).
     *
     * Anotação da Regina: *"Presizo de uma ajuda"*, *"Meda uma ajuda"*, *"Eu preciso pagar umas
     * contas que estão muito atrasada"* — e a caixa ofereceu o modelo padrão. Ele: *"modelo fora de
     * contexto, ela quer ajuda financeira, mandar mensagem pronta referente"*.
     *
     * **Isto desfaz a decisão dele de 02/09**, que era *"o modelo não irá confirmar apoio ao pedido
     * de ajuda ou confirmar que irá ajudar então pode ser respondido após"*. O argumento continua
     * verdadeiro sobre o TEXTO — o modelo é recibo de cadastro e não promete nada. O que o caso
     * real mostrou é outra coisa: mandar propaganda como primeira resposta a quem escreve que não
     * consegue pagar as contas é a resposta errada mesmo quando o texto é inofensivo.
     *
     * A negativa (`pedido-ajuda`) sai aqui, e o modelo sai na passada seguinte.
     */
    { ...noVazio('pediu dinheiro, cesta basica ou remedio'), id: 'chegada-ajuda',
      condicao: { sinal: 'pedeAjudaFinanceira', negar: false, palavras: [], onde: 'ultima' },
      acao: { tecla: null, resposta: 'pedido-ajuda' } },

    /**
     * **As outras DUAS respostas que negam também valem na chegada** — relato dele (04/09/2026):
     * *"o fluxo de chegada parece ter sido deixado para trás; muitas regras se aplicam lá
     * também"*. Estava certo, e estas duas eram a metade mais fácil de ver: a ajuda financeira
     * tinha caixa aqui desde 02/09 e as irmãs dela nunca vieram junto.
     *
     * Quem chega perguntando como trabalhar no mandato, ou pedindo que a gente ligue, recebia o
     * MODELO — porque `conteudo-pedido` fica logo abaixo e casa. É o mesmo dano do pedido de
     * socorro: propaganda como primeira resposta a quem perguntou outra coisa.
     */
    { ...noVazio('quer trabalhar para o mandato'), id: 'chegada-emprego',
      condicao: { sinal: 'pedeEmprego', negar: false, palavras: [], onde: 'ultima' },
      acao: { tecla: null, resposta: 'pedido-emprego' } },
    { ...noVazio('pediu que a gente ligasse'), id: 'chegada-ligacao',
      condicao: { sinal: 'pedeLigacao', negar: false, palavras: [], onde: 'ultima' },
      acao: { tecla: null, resposta: 'pedido-ligacao' } },

    { ...r('pediu-algo-sem-dizer-o-que', 'você responde: pedido sem objeto, ou pergunta', 'chegada-antes'),
      tambemQuando: ['pergunta-aberta'] },

    /**
     * **Quem escreveu conversa na chegada também fica acima do modelo** — print dele de
     * 03/09/2026, e a palavra que ele usou foi *"crítico"*.
     *
     * A contato de Serafina Corrêa chegou pelo anúncio e escreveu duas mensagens, 314 caracteres:
     * pedia uma **cola com letras maiores, do primeiro ao último**, porque tem *"muita gente idosa
     * pedindo"*, e se oferecia para imprimir. A rodada mandou o cartão da campanha e **concluiu**.
     * *"ignorou o pedido e concluiu"*.
     *
     * **Nada pegava, e não havia como pegar por lista.** Ela disse o que queria, então
     * `pediu-algo-sem-dizer-o-que` não casa; não é pergunta de razão nem de posição, então
     * `pergunta-aberta` não casa. O único sinal que existe para *"isto é conversa"* é o TAMANHO, e
     * ele estava calculado e correto — só não era consultado neste ramo.
     *
     * **Por que esta caixa tinha ficado fora da chegada.** Correção dele em 02/09: as pendências
     * neutras se resolvem na VOLTA, porque a tecla `a` conclui. Vale para figura, cumprimento e
     * despedida — adiar o recibo delas custa um dia. Não vale aqui, pelo mesmo motivo das duas
     * caixas acima: **mandar a nossa mensagem primeiro É o dano**, não o atraso. E concluir apaga
     * o pedido.
     *
     * **O custo, que é real:** quem chega mandando um áudio sem transcrição, um arquivo ou um texto
     * longo deixa de receber o recibo do anúncio nessa passada e vai para você. Foi dito a ele.
     */
    { ...r('ultima-pede-resposta-pessoal', 'você responde: áudio, texto longo, denúncia, ou ela está passando mal', 'chegada-antes'),
      tambemQuando: ['respondeu-nossa-pergunta', 'nao-pode-falar-agora'] },

    /**
     * **A DENÚNCIA respondida à nossa própria pergunta — a quarta pendência que fica acima do
     * recibo, e a que faltava.**
     *
     * Esta regra nasceu em 01/09 por causa do pior caso já registrado aqui: a contato respondeu
     * *"é sobre as irregularidades na compra assistida"* à nossa pergunta "em que posso ajudar?"
     * e recebeu **material de campanha**. Ela protegia a volta e **não existia na chegada** —
     * medido: com um modelo disponível, o caso ia para a tecla 1.
     *
     * Fica acima do recibo pelo critério que já separa as outras três: pendência neutra (bom dia,
     * figura, despedida) custa um dia de atraso; aqui mandar a nossa mensagem primeiro **É** o
     * dano.
     */


    /**
     * **Chegou SEM anúncio e só cumprimentou → boas-vindas do gabinete, e conclui.**
     *
     * Decisão dele (04/09/2026), na revisão caixa a caixa da chegada: *"se ela chegou
     * cumprimentando, podemos mandar uma mensagem: bem-vindo, você está falando com o gabinete do
     * Capitão Martim, em quê podemos ajudar? E se puder nos forneça seu nome e cidade para melhor
     * atendê-lo — e então concluir até o contato responder"*.
     *
     * **Duas condições, e é o primeiro uso do que ele pediu hoje**: só cumprimentou **E** não veio
     * de anúncio. Quem chega por anúncio tem recibo a receber, e o recibo já pede os dados — as
     * duas caixas nunca disputam o mesmo contato, e é a condição que garante isso, não a posição.
     *
     * Fica ABAIXO do bloco que precisa de gente: pergunta logo de cara continua sendo sua ou da IA,
     * e hostilidade continua sendo pega pela proteção lá em cima — as duas exceções que ele nomeou
     * no mesmo recado.
     */
    { ...noVazio('chegou sem anúncio e só cumprimentou'),
      id: 'chegada-boas-vindas',
      condicao: { sinal: 'soCortesia', negar: false, palavras: [], onde: 'ultima' },
      maisCondicoes: [{ sinal: 'veioDeAnuncio', negar: true, palavras: [], onde: 'ultima' }],
      acao: { tecla: null, resposta: 'boas-vindas' } },

    /**
     * **O MODELO PRIMEIRO** — redesenho dele em 02/09/2026, e a inversão da ordem que valia antes.
     *
     * O que ele escreveu: *"o sistema atual está dando problemas, o modelo agora será feito pra
     * cada anúncio específico e será mandado no momento que a pessoa chegar pelo anúncio, pedir
     * dados virá após isso se a pessoa não tiver etiqueta de cidade, se ela tiver etiqueta de
     * cidade fica só no modelo"*. E: *"caso o texto do anúncio não seja reconhecido será mandado o
     * modelo padrão"*.
     *
     * Antes era o contrário — o pedido de dados vinha primeiro, decisão dele de 01/09. O que mudou
     * é que agora existe **um modelo por anúncio**, então o que sai na chegada responde ao que a
     * pessoa clicou, em vez de ser um pedido de cadastro seco.
     *
     * Quem resolve o "qual modelo" é `anuncios.modeloDoAnuncio`, fora do quadro: o específico do
     * anúncio reconhecido, ou o modelo padrão quando o texto não casou com nenhum. O quadro só vê
     * `podeEnviar`, como sempre viu.
     *
     * **Uma passada, uma mensagem** — a propriedade que ele escolheu em 01/09 para não sair rajada
     * ao mesmo número. As guardas de `conteudo-pedido` (`!enviadoHoje && !modeloJaNaConversa`) são
     * o que faz a passada seguinte cair no passo de baixo em vez de repetir o modelo.
     *
     * **Consequência a lembrar:** quem recebe o modelo e **não escreve de novo** nunca chega no
     * pedido de dados, porque a rodada só volta a quem respondeu. Antes, com os dados primeiro, o
     * cadastro era capturado logo. Foi dito a ele no mesmo dia.
     */
    /**
     * **O recibo e o atendimento na MESMA passada** — escolha dele em 02/09/2026, depois de
     * explicar que *"o modelo seria uma resposta automática ao anúncio, o atendimento vem depois
     * disso que seria pedir dados e responder as perguntas"*.
     *
     * Vem acima das duas caixas de baixo porque é o caso completo: quando as duas metades cabem,
     * saem as duas. Faltando uma, esta não casa e cada caixa de baixo resolve o seu pedaço — o
     * modelo sozinho para quem já tem cidade, o pedido de dados sozinho quando não há modelo.
     */
    /**
     * **Vários cliques em rajada não são um pedido** — a Irene (05/09/2026) chegou clicando em três
     * anúncios seguidos e a caixa ofereceu o modelo de um deles. Fica acima do recibo porque é o
     * recibo que ela vence: a mensagem do momento serve para os três.
     */
    r('rajada-de-anuncios', 'só clicou em vários anúncios: mensagem do momento', 'chegada'),

    r('anuncio-modelo-e-dados', 'modelo + pedir os dados', 'chegada'),

    /**
     * **As pendências NEUTRAS ficam abaixo do recibo — e essa é a diferença deliberada para a
     * volta**, onde elas ficam acima. Decisão dele de 02/09: figura, cumprimento e despedida
     * custam um dia de atraso no recibo, e o recibo é o que ela clicou para receber.
     *
     * O que faltava era elas existirem AQUI, abaixo. Sem isso, quem chegava e só se despedia caía
     * na caixa do TEMPO (logo abaixo) e recebia a **mensagem do momento** — enviar por cima de um
     * "amém" —, ou no modelo, quando havia um. Medido nos dois casos.
     */
    r('ultima-e-so-reacao', 'mandou figura, emoji, sticker ou link', 'chegada'),
    r('ultima-e-despedida', null, 'chegada'),
    /**
     * **Na chegada o tempo entra ABAIXO do recibo** — anotação do Giovani (04/09/2026): ele mandou
     * um texto político longo e um link ontem à noite, e a caixa oferecia o modelo. *"Modelo fora
     * de contexto, aqui vou mandar mensagem do momento."*
     *
     * A posição é diferente da que ela tem na volta, e de propósito: `anuncio-modelo-e-dados` fica
     * **acima**. Quem chega pelo anúncio e ainda não recebeu nada tem direito ao recibo, mesmo que
     * a rodada só a alcance no dia seguinte — trocar isso pela mensagem do momento tiraria o recibo
     * de quase todo mundo, porque a rodada quase sempre roda depois.
     *
     * O que o tempo alcança aqui é o outro caso: quem **já tem cidade** e por isso receberia só o
     * modelo. Aí o conteúdo dela é de ontem, e o modelo responde a um assunto que esfriou.
     */
    r('contexto-de-outro-dia', 'a última dela é de outro dia', 'chegada'),
    /**
     * **Ela respondeu o nome e a cidade — agradece, não manda modelo.** Decisão dele de 02/09
     * (*"agora só precisa agradecer a atenção e encerrar sem mandar modelo"*), que também só
     * valia na volta: na chegada o caso descia até `conteudo-pedido` e recebia o modelo.
     *
     * A posição é a mesma da volta — abaixo do tempo e do anúncio reconhecido, acima do modelo
     * genérico. O anúncio reconhecido continua ganhando porque ela clicou pedindo aquilo.
     */
    r('respondeu-os-dados', 'respondeu o nome e a cidade', 'chegada'),
    r('conteudo-pedido', 'manda só o modelo (ela já tem cidade)', 'chegada'),

    /**
     * **Depois do modelo, os dados — e só para quem não tem cidade.**
     *
     * *"pedir dados virá após isso se a pessoa não tiver etiqueta de cidade, se ela tiver etiqueta
     * de cidade fica só no modelo"*. A segunda metade não precisa de caixa: `nunca-pediram-dados`
     * já exige `!temEtiquetaDeCidade`, então quem tem cidade simplesmente não casa aqui — e "fica
     * só no modelo" acontece por si.
     */
    /**
     * **Não deu nada para trabalhar: pergunte o interesse, não o cadastro** — print do Tilin
     * (03/09/2026), em que a conversa inteira eram dois avisos de *"tipo da mensagem não
     * suportado"* e um *"número privado"*, e a rodada mandou o pedido de nome e cidade. Ele: *"eu
     * não tenho nenhuma informação nesse caso, então é para perguntar se a pessoa tem interesse em
     * receber conteúdo; a mensagem de nome e cidade ficou deslocada demais"*.
     *
     * Fica ABAIXO do modelo e ACIMA do pedido de dados: quem chega com modelo mapeado recebe o
     * recibo, que responde melhor que qualquer pergunta. Esta caixa é o que sobra para quem não
     * deixou nada.
     */
    r('nada-legivel-dela', 'ela não mandou nada legível', 'chegada'),
    r('nunca-pediram-dados', 'ainda não temos nome e cidade', 'chegada'),

    /**
     * **O apoio, no FIM do ramo — o que sobra quando não há o que mandar.**
     *
     * Duas anotações de 03/09/2026, as duas chegando pelo anúncio e as duas terminando em vazio:
     *
     *  - **Maria Bernardete** já tinha cidade no CRM, veio por um anúncio que não dá para
     *    reconhecer e escreveu *"estou falando com todas as minhas amigas para votarem no
     *    Senhor"*. Ele: *"mandar 8"*;
     *  - **Plauto** escreveu *"CAPITÃO CONTA COM MEU VOTO"* e, em seguida, o nome e a cidade. Ele:
     *    *"já foi pedido dados, seria agradecer e encerrar"*.
     *
     * **A posição é o que torna isto seguro, e é por ela que a caixa não existia aqui.** A mensagem
     * do anúncio é apoio escrito ("Eu apoio as Escolas Cívico-Militares"), e `soExpressaApoio` só a
     * descarta quando o anúncio está cadastrado — para todo anúncio novo, ela conta como fala da
     * pessoa. Em cima, esta caixa agradeceria a chegada e engoliria o recibo de quem acabou de
     * clicar. No fim, ela só alcança quem **já passou** por todas as saídas que mandam alguma
     * coisa: o recibo, o modelo sozinho e o pedido de dados.
     */
    r('so-expressa-apoio', 'só expressou apoio (não sobrou o que mandar)', 'chegada'),

    /**
     * **A pendência: o que ela escreveu DEPOIS da mensagem do anúncio.**
     *
     * *"após o modelo terá que ver se tem uma pendência que é a mensagem após a mensagem de anúncio
     * e escolher a resposta de acordo com a pendência"*.
     *
     * São as mesmas caixas que ele já montou para quem retorna (`dosDoisLados`), e é de propósito
     * que sejam as mesmas: "só mandou bom dia", "pediu ajuda financeira", "mandou figura", "fez
     * pergunta" não mudam de resposta por a pessoa ser nova. Uma cópia com outra redação seria o
     * jeito de as duas divergirem em uma semana.
     *
     * Elas leem a ÚLTIMA mensagem, que é justamente "a mensagem após a mensagem de anúncio" quando
     * existe uma. Quando a única mensagem é a do anúncio, nenhuma casa e o caso termina nos passos
     * de cima — que é o certo.
     *
     * Ficam ABAIXO do modelo e do pedido de dados porque é a ordem que ele escreveu: o modelo sai
     * na chegada, os dados vêm em seguida, e a pendência é o "após o modelo".
     */
    /**
     * **As pendências NÃO ficam aqui — e a correção é dele** (02/09/2026): *"porque o modelo que
     * você criou tem todas essas opções em pessoa nova? ao mandar modelo e pedir dados irá concluir
     * a conversa e ela volta pelo pessoa retornando"*.
     *
     * Ele está certo, e a medição confirmou: as cinco caixas de pendência que eu havia posto aqui
     * (ajuda financeira, bom dia, figura, áudio, despedida) **já existem em "pessoa retornando"** —
     * e é lá que ela chega, porque a tecla `a` conclui. Eu as havia copiado por causa do pedido
     * anterior dele (*"após o modelo terá que ver se tem uma pendência"*), sem perceber que o
     * "depois" acontece na volta, não aqui.
     *
     * Deixá-las nos dois lugares é a receita para as duas versões divergirem: um conserto de um
     * lado e o outro fica para trás. É a mesma razão de `dosDoisLados` ser uma função em vez de
     * copiar e colar.
     *
     * **O que fica são as três coisas que só a chegada resolve:** o recibo com o pedido de dados,
     * o recibo sozinho para quem já tem cidade, e o pedido de dados sozinho para quem não tem
     * modelo mapeado. Sem as duas últimas, medido, esses dois casos atravessam o quadro sem
     * desfecho.
     */
  ]);

  /**
   * **2. Quem volta.**
   *
   * Divide por ter ou não a etiqueta de cidade, porque é isso que diz se ela já foi classificada.
   *
   * **A condição do lado "sem etiqueta" é NEGADA, e essa é a única coisa que eu mudei do quadro que
   * ele mandou.** Lá ela estava sem condição — pegava todo mundo —, e como os dois lados têm as
   * mesmas regras, o lado "com etiqueta" nunca era alcançado: a mesma regra já havia falhado do
   * outro lado. Nove caixas mortas. O rótulo da caixa já prometia "sem etiqueta de cidade"; aqui o
   * código passa a fazer o que o nome dela diz.
   */
  const retornando = grupo('pessoa retornando', SEM_CONDICAO, [
    /**
     * **A recusa é testada aqui também, antes da bifurcação.**
     *
     * No quadro que ele mandou ela existia só do lado do anúncio — quem já tinha sido atendido e
     * voltava hostilizando não era pego por lugar nenhum, e caía nas regras de baixo: podia receber
     * a mensagem do momento depois de mandar um desaforo. O teste do preset já exigia isto, e
     * pegou. Uma caixa aqui em cima cobre os dois lados da bifurcação de uma vez.
     */
    r('sem-interesse', 'Recusou ou veio hostilizar', 'volta'),

    /**
     * **As duas caixas de "conclua e nao mande nada"** -- pedidos dele de 03/09/2026.
     *
     * `etiqueta-so-conclui` e a etiqueta de assessor (*"contatos com etiqueta de assessor so
     * conclua"*); `ultima-e-nossa` e a conversa que termina em mensagem NOSSA, ou em que ela nunca
     * escreveu (*"pegando conversas que a ultima mensagem foi minha e mandando mensagem, e pra
     * concluir sem mandar nada"*).
     *
     * As duas ficam acima da bifurcacao de cidade pelo mesmo motivo da recusa: sao sobre NAO
     * mandar, e isso nao depende de o contato ter cidade cadastrada. Protecao que vive so num lado
     * da bifurcacao e protecao pela metade -- ja aconteceu com a etiqueta que dispensa.
     */
    { ...r('etiqueta-so-conclui', 'não mandar nada: é da casa, ou a última é nossa', 'volta'),
      tambemQuando: ['ultima-e-nossa'] },
    { ...r('confirmou-presenca-evento', 'pular: confirmou presença, ou mandou o endereço', 'volta'),
      tambemQuando: ['informou-endereco'] },
    /**
     * **O endereço fica acima da bifurcação de cidade**, com as outras proteções.
     *
     * Quem mandou o endereço quase sempre já tem etiqueta de cidade — mas nem sempre, e proteção
     * que vive só num lado é proteção pela metade: já aconteceu duas vezes neste arquivo (a
     * etiqueta que dispensa e o apoio). Aqui o custo de errar o lado seria mandar mensagem por
     * cima de quem está esperando o material.
     */


    /**
     * **A etiqueta que dispensa da fila também sobe para cima da bifurcação de cidade.**
     *
     * Ela vivia só dentro de "com etiqueta de cidade", e o efeito era uma assimetria invisível:
     * quem carregava a etiqueta e **não** tinha cidade nunca era protegido — recebia o modelo antes,
     * e ia receber o agradecimento depois da caixa nova de 02/09/2026. A etiqueta significa "não
     * trabalhe este contato", e isso não depende de ele ter cidade cadastrada.
     *
     * É o mesmo raciocínio já escrito na recusa, uma linha acima: uma caixa aqui cobre os dois lados
     * da bifurcação de uma vez, em vez de repetir a proteção e esquecer um dos lados — que foi
     * exatamente o que aconteceu.
     */
    r('etiqueta-dispensa-da-fila', null, 'volta'),

    grupo('sem etiqueta de cidade', { sinal: 'temEtiquetaDeCidade', negar: true, palavras: [], onde: 'ultima' }, [
      /**
       * **A pendência só é olhada enquanto não respondemos hoje.**
       *
       * Sem esta guarda o modelo nunca sai — foi o que ele viu: *"se continuar como na print o
       * modelo nunca será enviado porque está concluindo após resolver a pendência"*. Medido: quem
       * diz "bom dia" recebe a mensagem do momento, e na passada seguinte a MESMA caixa casa de
       * novo e manda o momento outra vez. A entrega fica presa atrás da pendência para sempre.
       *
       * Com a guarda o fluxo anda: resolvemos a pendência numa passada, e quando ela volta a
       * escrever no mesmo dia a pendência já não está na frente — o caso desce para "sem pendência"
       * e o modelo sai.
       *
       * **Escolha dele entre os dois caminhos possíveis** (01/09/2026): a alternativa era a ação
       * composta, que resolveria e mandaria o modelo na mesma passada — e sairiam DUAS mensagens
       * seguidas para a mesma pessoa, na fila inteira. Rajada para o mesmo número é o que já pesou
       * no WhatsApp dele antes. Uma mensagem por passada é a propriedade que se preferiu manter.
       */
      /**
       * **Os dois grupos viraram UM** — anotação da Maria Genoli (03/09/2026): ela mandou dois
       * áudios longos, transcritos, contando que está doente e não consegue ir ao evento, e a
       * rodada mandou o **modelo padrão**. Ele: *"texto gigante obviamente é conversa, eu respondo
       * ou IA"*.
       *
       * **A causa era a divisão, não a ordem.** "Com pendência" exigia `!respondidoHoje` e continha
       * TODAS as caixas que leem o que ela escreveu; "sem pendência" tinha duas, e nenhuma delas
       * olha o texto. Bastava termos respondido alguma coisa no mesmo dia para o quadro parar de
       * ler a conversa e mandar o modelo — que foi exatamente o caso dela.
       *
       * **A guarda existia por um motivo que já não existe** (01/09: *"se continuar como na print o
       * modelo nunca será enviado porque está concluindo após resolver a pendência"*). O que a
       * tornava necessária era a caixa do cumprimento repetir a mensagem do momento a cada passada;
       * hoje ela tem a exceção `momentoJaEnviado`, e `ultima-e-so-reacao` olha `respondidoHoje` na
       * própria tecla. As guardas moram nas caixas, que é onde dá para testá-las.
       *
       * **O lado "com etiqueta de cidade" nunca teve essa divisão** e funciona — os dois lados
       * passam a ter a mesma forma, que é o que impede um deles de envelhecer sozinho.
       */
      r('voltou-por-outro-anuncio'),
      ...dosDoisLados('sem-cidade'),
      /**
       * **O grupo "sem pendência" foi REMOVIDO em 03/09/2026** — com a divisão desfeita, as duas
       * caixas dele (`respondeu-os-dados` e `conteudo-pedido`) viraram cópias mortas: as de
       * `dosDoisLados` decidem antes, com a mesma condição. O verificador de caixas mortas acusou
       * as duas.
       *
       * Ele autorizou a remoção no mesmo dia, e o critério é dele: *"se for necessário é para
       * remover se der conflito com as novas regras"*. Duplicata no mesmo ramo é o começo de duas
       * caixas divergirem.
       */

      /**
       * **Veio de um anúncio que ele cadastrou e não disse mais nada** — pedido dele em
       * 02/09/2026, depois da print da Inge: *"não seguiu o fluxo"* / *"atualize o ramo"*.
       *
       * Era o buraco que produziu aquela print. A Inge chegou pelo ANÚNCIO | FACEBOOK e escreveu só
       * o texto do anúncio (*"Olá! Eu apoio as Escolas Cívico-Militares"*). Sem etiqueta de cidade,
       * sem modelo mapeado, e **nenhuma caixa casava** — ela atravessava o quadro inteiro e caía na
       * caixa de pergunta.
       *
       * O motivo é consequência de uma decisão certa: a mensagem gerada pelo anúncio é excluída de
       * propósito de "só expressa apoio" (`padroesDeAnuncio`), para não contar como apoio escrito
       * por ela. O efeito colateral era este vazio.
       *
       * **Três escolhas de desenho, todas conservadoras:**
       *
       *  1. **Fica EMBAIXO de "com pendência" e de "sem pendência".** É último recurso dentro do
       *     lado sem cidade: quem tem pendência resolve a pendência, quem tem modelo mapeado recebe
       *     o modelo, e só o que sobra chega aqui. Pôr esta caixa em cima roubaria a vez de quem já
       *     funcionava — o erro que a regra de sem interesse no topo já custou uma vez.
       *  2. **A condição é `anuncioReconhecido`, não `veioDeAnuncio`.** A origem vem da plataforma
       *     e vale para qualquer anúncio; este sinal só é verdade para anúncio que ELE cadastrou na
       *     Config. Assim o ramo não muda nada para quem chega por campanha que ele não mapeou.
       *  3. **O desfecho é a regra do código `nunca-pediram-dados`, não uma tecla fixa.** Ela traz
       *     as guardas junto: só dispara se nunca pedimos o nome e a cidade, se não pedimos hoje, se não é só
       *     repasse de link e se não há etiqueta de cidade. Uma tecla 4 fixa aqui pediria os dados
       *     de novo a quem já recebeu o pedido.
       *
       * Consequência a lembrar: quem **já recebeu** o pedido de dados e volta mandando só o texto do
       * anúncio continua sem desfecho automático, e é de propósito — ela não respondeu o que
       * perguntamos, e não existe resposta certa para mandar sozinho. Esse caso é da IA ou dele.
       */
      grupo('veio de um anúncio que eu reconheço', { sinal: 'anuncioReconhecido', negar: false, palavras: [], onde: 'ultima' }, [
        r('nunca-pediram-dados', 'ainda não temos nome e cidade', 'anuncio-conhecido'),
      ]),

      /**
       * **O fecho do lado SEM cidade — e ele desfaz o "de propósito" logo acima.**
       *
       * Quatro anotações de 03/09/2026, todas com a caixa mostrando *"a decisão é sua"* e nenhuma
       * recomendação: **Antônio Bersch** (*"mandou foto ou sticker de boa noite, só concluir"*),
       * **jairoc** e **Sidnei Martins** (*"mandou link, pode concluir"*), e **Maria de Lourdes**
       * (*"quando voltasse pelo mesmo anúncio sem enviar nada além do texto padrão do anúncio era
       * pra concluir"*). Nos quatro o desfecho que ele quer é o mesmo: **concluir**.
       *
       * **A causa é estrutural, e é a mesma família da assimetria de cidade.** Os três grupos acima
       * cobrem quem AINDA não foi respondido hoje ("com pendência"), quem tem dado ou modelo a
       * receber ("sem pendência") e a chegada por anúncio cadastrado. Quem já foi respondido hoje e
       * não tem nada disso atravessava os três e saía sem desfecho — o lado "com etiqueta de
       * cidade" nunca teve esse buraco, porque `ja-respondemos-antes` fecha ele.
       *
       * A mesma regra resolve aqui, e traz as guardas junto: **conclui** quando já respondemos hoje
       * ou a do momento já saiu, e **manda a do momento** quando ela ainda não foi. É o que ele
       * pediu nos quatro casos, sem inventar um desfecho novo.
       */
      r('ja-respondemos-antes', 'já entregamos algo antes', 'sem-cidade'),
    ]),
    grupo('com etiqueta de cidade', { sinal: 'temEtiquetaDeCidade', negar: false, palavras: [], onde: 'ultima' }, [
      /**
       * **O agradecimento vale nos DOIS lados da bifurcação de cidade.**
       *
       * Sem esta caixa, quem respondeu o nome e a cidade era agradecida ou concluída em silêncio
       * dependendo de a etiqueta de cidade já ter sido aplicada ou não — e isso é decidido pela
       * ORDEM das coisas dentro da rodada, que ela não vê. Regra que trata dois contatos iguais de
       * forma diferente por estado invisível é o "alguns concluem e outros não" que este projeto já
       * pagou.
       *
       * Vence `ja-respondemos-antes` (que conclui em silêncio) só quando ela de fato respondeu o
       * que pedimos — condição estreita, e é exatamente a intenção dele.
       */
      /**
       * **As pendências vêm ANTES de "já entregamos algo antes"** — print da Cris (02/09/2026).
       *
       * `ja-respondemos-antes` é a caixa mais genérica deste lado: ela não olha o que a pessoa
       * escreveu, só que já fomos atendidos antes, e manda a mensagem do momento. Estando em
       * terceiro lugar, ela vencia TODAS as caixas que reconhecem o conteúdo — inclusive a que
       * manda um desabafo de 437 caracteres para quem escreve.
       *
       * Medido antes de mover: a Cris caía em `pessoa retornando > com etiqueta de cidade > já
       * entregamos algo antes` e recebia a mensagem do momento. Depois: `ultima-pede-resposta-
       * pessoal`, tecla 6, que é o caminho da IA.
       *
       * É a mesma ordem que o lado "sem etiqueta de cidade" já tinha — pendência primeiro, o
       * genérico depois. Os dois lados passam a concordar, que era o sinal de que este estava
       * errado.
       */
      ...dosDoisLados('com-cidade'),
      r('ja-respondemos-antes', 'já entregamos algo antes'),
    ]),
  ]);

  /**
   * **O que ele mandou descartar** (01/09/2026), e por quê:
   *
   *  - `nunca-perguntaram-interesse` — *"descarte também"*;
   *  - `nome-sem-sentido` — *"descarte, essa regra será refeita ou não de acordo com a necessidade"*;
   *  - `pedido-hoje-sem-resposta` — *"retire o concluir, só deixe o lembrete para não enviar
   *    novamente, ou retire essa caixa"*. Tirei a caixa, que era a opção que ele deu: o que ela
   *    protegia (não repetir o pedido no mesmo dia) **já está dentro de `nunca-pediram-dados`**, que
   *    exige `!pedidoHoje` para disparar. Sem a caixa, ninguém pede duas vezes — só deixa de ser
   *    concluído, que era o que ele queria.
   *
   * As regras continuam no código: descartadas do QUADRO, não apagadas. Ele volta a pôr qualquer uma
   * arrastando um ramo novo.
   */
  return [doAnuncio, retornando];
}

// ---- edição (a janela mexe na árvore por aqui) ------------------------------

/** Todos os nós, achatados, na ordem em que aparecem. Útil para contar e para validar. */
export function todosOsNos(arvore) {
  const saida = [];
  const anda = (nos, pai, nivel) => {
    for (const no of nos || []) {
      saida.push({ no, pai, nivel });
      anda(no.filhos, no, nivel + 1);
    }
  };
  anda(arvore, null, 0);
  return saida;
}

/** O nó e a lista de irmãos onde ele mora — é o que toda edição precisa saber. */
export function localizar(arvore, id) {
  const anda = (nos, pai) => {
    for (let i = 0; i < (nos || []).length; i++) {
      if (nos[i].id === id) return { no: nos[i], irmaos: nos, i, pai };
      const dentro = anda(nos[i].filhos, nos[i]);
      if (dentro) return dentro;
    }
    return null;
  };
  return anda(arvore, null);
}

/** Cópia funda: toda edição devolve árvore nova, para o desenho nunca ver estado pela metade. */
const copiar = (arvore) => JSON.parse(JSON.stringify(arvore));

/** Sobe ou desce o nó ENTRE OS IRMÃOS. Prioridade é a ordem entre irmãos, não na árvore toda. */
export function mover(arvore, id, passo) {
  const nova = copiar(arvore);
  const achado = localizar(nova, id);
  if (!achado) return arvore;
  const destino = achado.i + passo;
  if (destino < 0 || destino >= achado.irmaos.length) return arvore;
  const [tirado] = achado.irmaos.splice(achado.i, 1);
  achado.irmaos.splice(destino, 0, tirado);
  return nova;
}

/** Acrescenta um filho ao nó (ou na raiz, com `id` nulo). */
export function acrescentar(arvore, id, no) {
  const nova = copiar(arvore);
  const novo = no || noVazio();
  if (!id) {
    nova.push(novo);
    return nova;
  }
  const achado = localizar(nova, id);
  if (!achado) return arvore;
  achado.no.filhos = achado.no.filhos || [];
  achado.no.filhos.push(novo);
  return nova;
}

/**
 * Apaga o nó **e os filhos dele**.
 *
 * Os filhos vão junto de propósito: promover os filhos de um ramo apagado os solta numa condição
 * que não é mais a deles — "só mandou bom dia" fora de "pessoa retornando" passa a valer para
 * quem chegou agora. A janela avisa quantos vão junto antes de apagar.
 */
export function apagar(arvore, id) {
  const nova = copiar(arvore);
  const achado = localizar(nova, id);
  if (!achado) return arvore;
  achado.irmaos.splice(achado.i, 1);
  return nova;
}

/**
 * Duplica um ramo — o nó e tudo que está dentro dele.
 *
 * Pedido dele (01/09/2026): *"preciso da opção de duplicar uma caixa"*. Montar um ramo dá
 * trabalho (condição, palavras, desfecho), e variação do mesmo ramo é o caso comum — "isto
 * aqui, mas com outras palavras".
 *
 * **Os filhos vão junto**, pela mesma razão que vão no `apagar`: um ramo é a condição MAIS o
 * que está dentro dela, e copiar só a casca daria um grupo vazio que não faz nada. A janela
 * diz quantos vão junto antes de duplicar.
 *
 * **Id novo em cada nó copiado, sem exceção.** Id repetido é o que `problemas` acusa e o que
 * `sanitizar` renomeia na importação — e, pior, faria a janela editar dois nós de uma vez.
 *
 * A cópia entra como o **irmão seguinte** e desce um pouco na tela. Entre irmãos a prioridade é
 * a altura, então nascer logo abaixo é nascer com a prioridade seguinte — que é o que se espera
 * de uma cópia. O deslocamento lateral é para ela não sumir atrás de um irmão que já estivesse
 * ali: cópia escondida parece cópia que não aconteceu.
 *
 * Devolve `{arvore, id}` em vez de só a árvore — diferente das vizinhas de propósito, porque
 * quem chama precisa SELECIONAR a cópia. Sem o id, a janela teria que adivinhar qual das duas
 * caixas iguais é a nova.
 *
 * @returns {{arvore: Array, id: string|null}}
 */
export function duplicar(arvore, id) {
  const nova = copiar(arvore);
  const achado = localizar(nova, id);
  if (!achado) return { arvore, id: null };

  const copia = comIdsNovos(achado.no);
  copia.rotulo = texto(`${achado.no.rotulo || "ramo"} (cópia)`, 80);
  copia.x = (achado.no.x || 0) + 24;
  copia.y = (achado.no.y || 0) + CAIXA.altura + CAIXA.linhaVaga;

  achado.irmaos.splice(achado.i + 1, 0, copia);
  return { arvore: nova, id: copia.id };
}

/** Cópia funda de um ramo, com id novo em cada nó. */
export function comIdsNovos(no) {
  return {
    ...JSON.parse(JSON.stringify(no)),
    id: novoId(),
    filhos: (no.filhos || []).map((f) => comIdsNovos(f)),
  };
}
/** Troca campos de um nó. */
export function editar(arvore, id, mudancas) {
  const nova = copiar(arvore);
  const achado = localizar(nova, id);
  if (!achado) return arvore;
  Object.assign(achado.no, mudancas);
  return nova;
}

// ---- o canvas: posição, religação e arrumação ------------------------------

/**
 * `id` está DENTRO de `possivelPai`?
 *
 * A guarda que impede o defeito clássico do editor de árvore: arrastar um ramo para dentro de um
 * filho dele mesmo. O pedaço arrastado sairia da árvore junto com o novo pai e sumiria da tela —
 * com os ramos dele, que continuariam gravados e invisíveis.
 */
export function ehDescendente(arvore, possivelPai, id) {
  const achado = localizar(arvore, possivelPai);
  if (!achado) return false;
  return arvoreTem(achado.no.filhos, id);
}

function arvoreTem(nos, id) {
  for (const no of nos || []) {
    if (no.id === id) return true;
    if (arvoreTem(no.filhos, id)) return true;
  }
  return false;
}

/**
 * Muda o PAI de um ramo — é o que acontece quando ele arrasta uma caixa em cima de outra.
 *
 * `paiId` nulo solta o ramo na raiz. Devolve a árvore intacta quando o movimento não faz sentido
 * (o nó dentro de si mesmo, ou dentro de um filho dele): recusar sem mexer é melhor que aceitar e
 * fazer sumir, porque na tela "sumiu" e "está no lugar errado" parecem a mesma coisa.
 */
export function reparentar(arvore, id, paiId) {
  if (id === paiId) return arvore;
  if (paiId && ehDescendente(arvore, id, paiId)) return arvore;

  const nova = copiar(arvore);
  const achado = localizar(nova, id);
  if (!achado) return arvore;
  const [tirado] = achado.irmaos.splice(achado.i, 1);

  if (!paiId) {
    nova.push(tirado);
    return nova;
  }
  const destino = localizar(nova, paiId);
  if (!destino) return arvore;
  destino.no.filhos = destino.no.filhos || [];
  destino.no.filhos.push(tirado);
  return nova;
}

/** Onde a caixa está no quadro. Move o ramo inteiro quando `comFilhos`. */
export function posicionar(arvore, id, x, y, comFilhos) {
  const nova = copiar(arvore);
  const achado = localizar(nova, id);
  if (!achado) return arvore;
  const dx = Math.round(x) - (achado.no.x || 0);
  const dy = Math.round(y) - (achado.no.y || 0);
  const empurrar = (no) => {
    no.x = Math.round((no.x || 0) + dx);
    no.y = Math.round((no.y || 0) + dy);
    if (comFilhos) for (const f of no.filhos || []) empurrar(f);
  };
  empurrar(achado.no);
  return nova;
}

/**
 * A PRIORIDADE entre irmãos passa a ser a posição na tela: o mais alto é olhado primeiro.
 *
 * É a única regra que funciona num quadro livre. A alternativa — guardar uma ordem invisível ao
 * lado da posição — faria a tela mostrar um ramo acima do outro e a rodada obedecer o contrário,
 * e ele decide a prioridade OLHANDO. Chamada depois de todo arrasto.
 */
export function ordenarPorPosicao(arvore) {
  const nova = copiar(arvore);
  const anda = (nos) => {
    (nos || []).sort((a, b) => (a.y || 0) - (b.y || 0));
    for (const no of nos || []) anda(no.filhos);
  };
  anda(nova);
  return nova;
}

/** Largura e altura que a arrumação assume para uma caixa. A tela usa as mesmas. */
/**
 * O tamanho da caixa na tela — e `altura` tem que bater com o `height` do `.caixa` no `fluxo.css`.
 *
 * Ela subiu de 96 para 140 em 04/09/2026: o cartão ganhou a linha do desfecho no topo e a do nome
 * no rodapé, cresceu, e as caixas passaram a se sobrepor no quadro arrumado — *"as caixas estão se
 * sobrepondo, arrume para não acontecer"*. **Cartão de altura variável exigiria medir cada um na
 * tela antes de posicionar**; altura fixa com o texto cortado resolve sem isso, e de quebra deixa o
 * quadro alinhado.
 *
 * Mexeu no conteúdo do cartão? Confira os dois números juntos.
 */
export const CAIXA = { largura: 260, altura: 140, colunaVaga: 90, linhaVaga: 26 };

/**
 * Arruma o quadro: uma COLUNA por nível, filhos empilhados à direita do pai.
 *
 * Da esquerda para a direita, e não de cima para baixo como no quadro dele, por um motivo de
 * espaço: em cima da mesa o desenho tinha dezoito nós e já ocupava a largura toda; "incrementado
 * de acordo com a demanda" quer dizer o dobro. Para o lado, a árvore cresce para BAIXO, que é onde
 * a tela rola. A leitura continua a mesma: situação → tipo de mensagem → ação.
 *
 * O pai fica centrado na altura dos filhos, que é o que faz um mapa parecer um mapa.
 */
export function arrumar(arvore) {
  const nova = copiar(arvore);
  const passoX = CAIXA.largura + CAIXA.colunaVaga;
  const passoY = CAIXA.altura + CAIXA.linhaVaga;
  let proximaLinha = 0;

  const colocar = (no, nivel) => {
    no.x = nivel * passoX;
    const filhos = no.filhos || [];
    if (!filhos.length) {
      no.y = proximaLinha * passoY;
      proximaLinha += 1;
      return no.y;
    }
    const ys = filhos.map((f) => colocar(f, nivel + 1));
    no.y = Math.round((ys[0] + ys[ys.length - 1]) / 2);
    return no.y;
  };

  for (const no of nova) colocar(no, 0);
  return nova;
}

/** O quadro já tem posição? Árvore vinda da versão em lista não tem, e precisa ser arrumada. */
export function precisaArrumar(arvore) {
  return todosOsNos(arvore).some(({ no }) => typeof no.x !== 'number' || typeof no.y !== 'number');
}

// ---- guardar, carregar e levar para fora ------------------------------------

/** O que um arquivo de fluxo é. A marca existe para recusar cedo o JSON que não é daqui. */
export const FORMATO = 'whatsfill-fluxo';
export const FORMATO_VERSAO = 1;

/** Limites de sanidade do que vem de arquivo. Não são regras de negócio: são o teto do absurdo. */
const LIMITES = {
  // Quantas condições (e exceções) a mais uma caixa pode ter, além da primeira.
  condicoesExtras: 6, nos: 400, fundo: 8, palavras: 60, texto: 200, nota: 4000 };

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max || LIMITES.texto) : '');

/**
 * Passa uma árvore vinda de FORA por uma peneira, campo a campo.
 *
 * **Isto é entrada não confiável.** Um arquivo de fluxo decide o que a rodada manda para eleitor
 * real; `JSON.parse` e usar seria aceitar que qualquer coisa num campo vire comportamento. A
 * peneira mantém só o que existe: regra que sumiu do código, sinal desconhecido e tecla inventada
 * são DESCARTADOS com aviso, em vez de virarem um ramo que nunca casa e ninguém entende.
 *
 * Também é o que protege de arquivo velho: exportar hoje e importar depois de eu renomear uma
 * regra dá um aviso na tela, e não um ramo morto e silencioso.
 *
 * @returns {{arvore: Array, avisos: string[]}}
 */
export function sanitizar(bruto) {
  const avisos = [];
  /**
   * Peneira uma lista de condições extras. Fora da função de cima porque condição e exceção usam a
   * mesma, e duas cópias divergiriam na primeira mudança.
   */
  const extras = (lista, rotulo) => {
    if (!Array.isArray(lista)) return [];
    const saida = [];
    for (const cru of lista.slice(0, LIMITES.condicoesExtras)) {
      if (!cru || typeof cru !== 'object') continue;
      const item = { sinal: '', negar: cru.negar === true, palavras: [], onde: cru.onde === 'qualquer' ? 'qualquer' : 'ultima' };
      const sinal = texto(cru.sinal, 60);
      if (sinal) {
        if (sinalConhecido(sinal)) item.sinal = sinal;
        else avisos.push(`${rotulo}: sinal desconhecido "${sinal}" — descartada`);
      }
      if (Array.isArray(cru.palavras)) {
        item.palavras = cru.palavras.map((p) => texto(p, 80)).filter(Boolean).slice(0, LIMITES.palavras);
      }
      if (item.sinal || item.palavras.length) saida.push(item);
    }
    return saida;
  };

  const usados = new Set();
  let quantos = 0;

  const limparNo = (cru, fundura) => {
    if (!cru || typeof cru !== 'object') return null;
    if (quantos >= LIMITES.nos) return null;
    quantos += 1;

    const nome = texto(cru.rotulo) || 'ramo sem nome';
    // A observacao e recado para mim, entao pode ser longa -- mas nao infinita.
    const nota = typeof cru.nota === 'string' ? cru.nota.trim().slice(0, LIMITES.nota) : '';

    let id = texto(cru.id, 60);
    if (!id || usados.has(id)) {
      const antigo = id;
      id = novoId();
      if (antigo) avisos.push(`"${nome}": id repetido (${antigo}) — recebeu um id novo`);
    }
    usados.add(id);

    const no = {
      id,
      rotulo: nome,
      regra: null,
      condicao: { sinal: '', negar: false, palavras: [], onde: 'ultima' },
      excecao: { sinal: '', negar: false, palavras: [], onde: 'ultima' },
      tambemQuando: [],
      acao: null,
      nota,
      desligado: cru.desligado === true,
      x: Number.isFinite(cru.x) ? Math.round(cru.x) : 0,
      y: Number.isFinite(cru.y) ? Math.round(cru.y) : 0,
      filhos: [],
    };

    const regra = texto(cru.regra, 60);
    if (regra) {
      if (REGRAS.some((r) => r.id === regra)) no.regra = regra;
      else avisos.push(`"${nome}": a regra "${regra}" não existe mais no código — o ramo virou um agrupamento`);
    }

    /**
     * As situações A MAIS da caixa juntada, pela mesma peneira: regra que sumiu do código é
     * descartada com aviso, nunca aceita como situação que nunca casa e ninguém entende.
     */
    if (Array.isArray(cru.tambemQuando)) {
      no.tambemQuando = [];
      for (const bruto of cru.tambemQuando.slice(0, LIMITES.condicoesExtras)) {
        const id = texto(bruto, 60);
        if (!id) continue;
        if (REGRAS.some((r) => r.id === id)) no.tambemQuando.push(id);
        else avisos.push(`"${nome}": a situação "${id}" não existe mais no código — descartada`);
      }
    }

    /**
     * A EXCEÇÃO passa pela mesma peneira da condição — é entrada não confiável igual, e decide o
     * que a rodada manda para eleitor.
     */
    const exc = cru.excecao && typeof cru.excecao === 'object' ? cru.excecao : {};
    const sinalExc = texto(exc.sinal, 40);
    if (sinalExc) {
      if (sinalConhecido(sinalExc)) no.excecao.sinal = sinalExc;
      else avisos.push(`ramo "${no.rotulo}": exceção com sinal desconhecido "${sinalExc}" — descartada`);
    }
    no.excecao.negar = exc.negar === true;
    no.excecao.onde = exc.onde === 'qualquer' ? 'qualquer' : 'ultima';
    if (Array.isArray(exc.palavras)) {
      no.excecao.palavras = exc.palavras.map((x) => texto(x, 80)).filter(Boolean).slice(0, LIMITES.palavras);
    }

    const cond = cru.condicao && typeof cru.condicao === 'object' ? cru.condicao : {};
    const sinal = texto(cond.sinal, 60);
    if (sinal) {
      if (sinalConhecido(sinal)) no.condicao.sinal = sinal;
      else avisos.push(`"${nome}": o sinal "${sinal}" não existe — a condição dele foi descartada`);
    }
    no.condicao.negar = cond.negar === true;
    no.condicao.onde = cond.onde === 'qualquer' ? 'qualquer' : 'ultima';
    if (Array.isArray(cond.palavras)) {
      no.condicao.palavras = cond.palavras.map((p) => texto(p, 80)).filter(Boolean).slice(0, LIMITES.palavras);
    }

    /**
     * **As condições e exceções EXTRAS** (04/09/2026), pela mesma peneira das primeiras: sinal que
     * não existe é descartado com aviso, palavra é cortada, e há teto — arquivo de fluxo é entrada
     * não confiável, e o que vem nele decide o que sai para eleitor.
     */
    no.maisCondicoes = extras(cru.maisCondicoes, `"${nome}": condição a mais`);
    no.maisExcecoes = extras(cru.maisExcecoes, `"${nome}": exceção a mais`);

    const acao = cru.acao && typeof cru.acao === 'object' ? cru.acao : {};
    if (acao.ia === true) {
      no.acao = { tecla: null, resposta: null, ia: true };
    } else if (texto(acao.resposta, 60)) {
      no.acao = { tecla: null, resposta: texto(acao.resposta, 60) };
    } else if (texto(acao.tecla, 4)) {
      const t = texto(acao.tecla, 4);
      if (TECLAS[t]) no.acao = { tecla: t, resposta: null };
      else avisos.push(`"${nome}": a tecla "${t}" não existe — o desfecho foi descartado`);
    }

    if (Array.isArray(cru.filhos) && cru.filhos.length) {
      if (fundura >= LIMITES.fundo) {
        avisos.push(`"${nome}": os ramos de dentro passaram do nível ${LIMITES.fundo} e foram descartados`);
      } else {
        no.filhos = cru.filhos.map((f) => limparNo(f, fundura + 1)).filter(Boolean);
      }
    }
    return no;
  };

  const lista = Array.isArray(bruto) ? bruto : [];
  const arvore = lista.map((n) => limparNo(n, 0)).filter(Boolean);
  if (quantos >= LIMITES.nos) avisos.push(`o arquivo passou de ${LIMITES.nos} ramos — o excedente foi descartado`);
  return { arvore, avisos };
}

/** O conteúdo do arquivo que ele leva para fora. */
export function paraArquivo(fluxo, nome, extensao) {
  return {
    formato: FORMATO,
    versao: FORMATO_VERSAO,
    /**
     * **A versão da EXTENSÃO que gerou o arquivo — e ela não é a `versao` acima.**
     *
     * `versao` é o formato do arquivo (hoje 1) e quase nunca muda; esta é a `version` do
     * `manifest.json`, que é a que responde *"o quadro que eu importei é de quando?"*. Pedido dele
     * (05/09/2026): *"o fluxo atualmente não fala qual versão ele está utilizando"*.
     *
     * Até aqui ela existia **só dentro do `nome`** (`"fluxo padrão 2.54.0"`), que é texto livre que
     * ele pode reescrever — carimbo que some quando alguém renomeia não é carimbo.
     *
     * Quem chama passa: este módulo é puro e não alcança `chrome.runtime.getManifest()`.
     */
    extensao: texto(extensao, 20),
    nome: texto(nome, 80) || 'fluxo',
    salvoEm: new Date().toISOString(),
    // As contagens de vitória ficam de fora: são medição desta máquina, não o fluxo.
    teclas: { ...(fluxo?.teclas || {}) },
    arvore: fluxo?.arvore || [],
  };
}

/**
 * Lê o texto de um arquivo de fluxo.
 *
 * Devolve o erro em vez de lançar: quem chama é a tela, e "não deu" com o motivo escrito é melhor
 * que uma exceção que vira janela em branco.
 *
 * @returns {{ok: boolean, erro?: string, nome?: string, arvore?: Array, teclas?: object, avisos?: string[]}}
 */
export function deArquivo(conteudo) {
  let dados;
  try {
    dados = JSON.parse(String(conteudo || ''));
  } catch (_) {
    return { ok: false, erro: 'o arquivo não é um JSON válido' };
  }
  if (!dados || typeof dados !== 'object') return { ok: false, erro: 'o arquivo está vazio' };
  if (dados.formato !== FORMATO) {
    return { ok: false, erro: 'este arquivo não é um fluxo do WhatsFill (falta a marca do formato)' };
  }
  if (Number(dados.versao) > FORMATO_VERSAO) {
    return { ok: false, erro: `o arquivo é de uma versão mais nova (${dados.versao}) — atualize a extensão` };
  }
  if (!Array.isArray(dados.arvore) || !dados.arvore.length) {
    return { ok: false, erro: 'o arquivo não tem nenhum ramo' };
  }

  const { arvore, avisos } = sanitizar(dados.arvore);
  if (!arvore.length) return { ok: false, erro: 'nenhum ramo do arquivo sobreviveu à conferência' };

  // As teclas fixadas só valem para regras que existem, senão viram lixo que ninguém vê.
  const teclas = {};
  for (const [id, tecla] of Object.entries(dados.teclas || {})) {
    if (REGRAS.some((r) => r.id === id) && TECLAS[tecla]) teclas[id] = tecla;
  }

  return {
    ok: true,
    nome: texto(dados.nome, 80) || 'fluxo importado',
    // De qual versão da extensão veio este quadro. Arquivo antigo não tem, e aí quem chama diz
    // "desconhecida" — inventar a versão de agora seria carimbar de novo o que veio sem carimbo.
    extensao: texto(dados.extensao, 20),
    arvore,
    teclas,
    avisos,
  };
}

/**
 * O fluxo inteiro em TEXTO, para ele colar numa conversa comigo.
 *
 * Nasceu torto: eu ia fazer um botão que copiava só as observações, e ele cortou na hora —
 * *"não faz sentido eu colar para você sem você ter a visão do fluxo"*. Está certo. A observação
 * *"essa aqui está pegando gente demais"* não diz nada sem o ramo, a condição, o desfecho e a
 * posição dele na árvore; eu responderia adivinhando.
 *
 * Então sai tudo: a hierarquia com numeração (`2.1.` é o primeiro filho do segundo ramo, e serve
 * para nós dois apontarmos para o mesmo lugar), a condição, o desfecho, o que está desligado, e a
 * observação no ramo a que ela pertence. É a mesma informação da tela, na forma que atravessa uma
 * caixa de texto.
 *
 * `opcoes.respostas` é a lista de respostas prontas, só para o desfecho sair pelo NOME em vez do
 * id — `pedido-ajuda` não diz o que é para quem lê de fora.
 */
export function paraTexto(arvore, opcoes) {
  const teclas = opcoes?.teclas || {};
  const respostas = opcoes?.respostas || [];
  const linhas = [];

  const nomeDaResposta = (id) => respostas.find((r) => r.id === id)?.name || id;

  const desfecho = (no) => {
    if (no.regra) {
      const regra = REGRAS.find((r) => r.id === no.regra);
      const fixa = teclas[no.regra];
      if (fixa) return `tecla ${fixa} · ${TECLAS[fixa]?.rotulo || '?'}  (VOCÊ FIXOU; o código escolheria sozinho)`;
      if (typeof regra?.tecla === 'function') {
        const ramos = SOBRE[no.regra]?.ramos || [];
        return ramos.length
          ? ramos.map((r) => `tecla ${r.tecla} · ${TECLAS[r.tecla]?.rotulo || '?'} (se ${r.se})`).join('  OU  ')
          : 'dois desfechos, conforme o contexto';
      }
      return `tecla ${regra?.tecla} · ${TECLAS[regra?.tecla]?.rotulo || '?'}`;
    }
    if (no.acao?.ia) return 'a IA assume e responde';
    if (no.acao?.resposta) return `manda "${nomeDaResposta(no.acao.resposta)}" e conclui`;
    if (no.acao?.tecla) return `tecla ${no.acao.tecla} · ${TECLAS[no.acao.tecla]?.rotulo || '?'}`;
    return (no.filhos || []).length ? '(só agrupa — quem decide são os ramos de dentro)' : '(NADA — este ramo não faz nada ainda)';
  };

  /** Uma condição (ou exceção) em português — a mesma leitura que a janela mostra. */
  const umaCondicao = (c) => {
    const partes = [];
    const sinal = SINAIS.find((s) => s.id === c.sinal);
    if (sinal) partes.push(c.negar ? sinal.nao : sinal.rotulo);
    if ((c.palavras || []).length) {
      partes.push(`escreveu "${c.palavras.join('", "')}"${c.onde === 'qualquer' ? ' (em qualquer mensagem)' : ' (na última mensagem)'}`);
    }
    return partes.join(' e ');
  };

  const condicao = (no) => {
    const minhas = condicoesDe(no).map(umaCondicao).filter(Boolean);
    if (no.regra) {
      // Caixa juntada: as situações vêm separadas por OU, como na janela.
      const situacoes = [no.regra, ...(no.tambemQuando || [])];
      const doCodigo =
        situacoes.length > 1
          ? situacoes.map((id) => SOBRE[id]?.rotulo || id).join('  OU  ')
          : SOBRE[no.regra]?.quando || '(a condição está no código)';
      return [doCodigo, ...minhas].filter(Boolean).join(' E ');
    }
    return minhas.length ? minhas.join(' E ') : 'qualquer contato que chegar aqui';
  };

  const anda = (nos, prefixo, recuo) => {
    (nos || []).forEach((no, i) => {
      const numero = prefixo ? `${prefixo}.${i + 1}` : String(i + 1);
      const pad = ' '.repeat(recuo);
      linhas.push('');
      linhas.push(`${pad}${numero}. ${no.rotulo || '(sem nome)'}${no.regra ? `   [regra do código: ${no.regra}]` : ''}${no.desligado ? '   *** DESLIGADO ***' : ''}`);
      linhas.push(`${pad}    quando: ${condicao(no)}`);
      const excecoes = excecoesDe(no).map(umaCondicao).filter(Boolean);
      if (excecoes.length) linhas.push(`${pad}    EXCETO: ${excecoes.join('  OU  ')}`);
      linhas.push(`${pad}    então:  ${desfecho(no)}`);
      // A observação é o motivo de tudo isto existir: ela vem por último e marcada, para saltar aos
      // olhos numa colagem de cem linhas.
      if (no.nota) {
        for (const l of String(no.nota).split('\n')) linhas.push(`${pad}    >> OBSERVAÇÃO: ${l}`);
      }
      anda(no.filhos, numero, recuo + 4);
    });
  };

  const total = todosOsNos(arvore).length;
  linhas.push('FLUXO DE ATENDIMENTO — WhatsFill+IA');
  linhas.push(`${total} ramos, ${quantosEnviam(arvore)} enviam mensagem. Gerado em ${new Date().toLocaleString('pt-BR')}.`);
  linhas.push('Uma caixa decide quando TODAS as condições dela são verdade e NENHUMA exceção é.');
  linhas.push('A rodada segue o PRIMEIRO ramo que descreve o contato; dentro dele, o primeiro filho que descreve.');
  linhas.push('Entre irmãos, a ordem abaixo é a prioridade.');
  anda(arvore, '', 0);
  linhas.push('');
  return linhas.join('\n');
}

/** Quantos ramos ENVIAM mensagem — o número que ele precisa ver antes de trocar o fluxo. */
export function quantosEnviam(arvore) {
  let conta = 0;
  for (const { no } of todosOsNos(arvore)) {
    if (no.desligado) continue;
    if (no.regra) {
      if (SOBRE[no.regra]?.efeito === 'envia') conta += 1;
      continue;
    }
    if (no.acao?.resposta) conta += 1;
    else if (no.acao?.tecla && TECLAS[no.acao.tecla]?.efeito === 'envia') conta += 1;
  }
  return conta;
}

// ---- conferência ------------------------------------------------------------

/**
 * O que está errado na árvore — o que a janela mostra em vermelho no topo.
 *
 * Não corrige nada: árvore é dele, e "consertar" sozinho o ramo pela metade que ele está no meio
 * de montar seria pior que avisar. O que existe aqui é o que faz um ramo NUNCA funcionar, e que
 * sem aviso pareceria "a extensão ignorou minha regra".
 */
/**
 * **Os sinais que o NOSSO próprio envio apaga** — os únicos que servem de guarda contra repetir.
 *
 * Todo o resto (`veioDeAnuncio`, `anuncioReconhecido`, `temEtiquetaDeCidade`, `semInteresse`…) é
 * estado do contato: continua verdadeiro depois de a gente mandar a mensagem, e uma caixa que casa
 * só por ele **casa de novo na passada seguinte**.
 *
 * A polaridade importa e está tratada em `repeteSozinha`: `jaRespondemosAntes` NEGADO ("nunca
 * entregamos nada") vira falso depois do envio e por isso é guarda; não negado, não é.
 */
/**
 * Sinais lidos da RAJADA — as mensagens dela depois da nossa última.
 *
 * Responder move a nossa última mensagem para a frente delas, e a rajada fica vazia: o sinal volta
 * a ser falso sozinho. São o oposto da lista de baixo, e por isso a caixa que os exige VERDADEIROS
 * já está protegida contra repetir.
 */
const SINAIS_QUE_A_RESPOSTA_APAGA = new Set([
  'pedeAjudaFinanceira',
  'soCortesia',
  'pedeEmprego',
  'pedeLigacao',
  'naoPodeFalarAgora',
  'rajadaDeAnuncios',
  'pedeAlgoIndefinido',
  'pedeRespostaPessoal',
  'perguntaAberta',
  'soExpressaApoio',
  'rajadaEhSoRepasse',
  'respondeuComoAjudar',
]);

const SINAIS_QUE_O_ENVIO_APAGA = new Set([
  'modeloJaNaConversa',
  'enviadoHoje',
  'pedidoHoje',
  'jaPediramDados',
  'momentoJaEnviado',
  'respondidoHoje',
  'interessePerguntado',
  'jaRespondemosAntes',
]);

/**
 * **Esta caixa manda mensagem e vai casar de novo na próxima passada?**
 *
 * Nasceu de um caso real (02/09/2026). Ele montou à mão uma caixa *"mandar modelo conforme o
 * anuncio"* com a condição "Reconheci de QUAL anúncio ela veio" e a **tecla 1 fixa** — e o motor
 * mostrou o modelo saindo em TODA passada, para sempre, porque:
 *
 *  - a condição é estado do contato: continua verdadeira depois de mandarmos;
 *  - **fixar a tecla não herda as guardas da regra do código.** `conteudo-pedido` exige
 *    `!enviadoHoje && !modeloJaNaConversa`; a caixa dele não exigia nada.
 *
 * É a armadilha central do quadro livre: a caixa parece a regra, tem o mesmo desfecho na tela, e
 * não tem a metade que impede repetir. Máquina de repetir mensagem para eleitor real é o defeito
 * que este projeto mais pagou.
 *
 * Só olha caixa DELE (`regra` nula): regra do código carrega as próprias guardas. Palavra na
 * ÚLTIMA mensagem conta como guarda — a última muda quando a pessoa escreve de novo.
 */
function repeteSozinha(no) {
  if (no.regra) return false;
  const acao = no.acao || {};
  if (!acao.tecla && !acao.resposta) return false;

  const efeito = acao.tecla ? TECLAS[acao.tecla]?.efeito : 'envia';
  if (efeito !== 'envia') return false;

  /**
   * **A EXCEÇÃO conta como guarda** — é para isso que ele a pediu (03/09/2026).
   *
   * "Mande o modelo, EXCETO quando o modelo já está na conversa" é exatamente a guarda que a
   * regra do código carrega, escrita do lado de fora. A polaridade é invertida em relação à
   * condição: aqui o envio tem que tornar a exceção VERDADEIRA, e aí a caixa deixa de casar.
   */
  const exc = no.excecao || {};
  if (exc.sinal && SINAIS_QUE_O_ENVIO_APAGA.has(exc.sinal) && !exc.negar) return false;
  if (exc.sinal && SINAIS_QUE_A_RESPOSTA_APAGA.has(exc.sinal) && exc.negar) return false;
  // Palavra na ÚLTIMA mensagem também: a última muda quando ela escreve de novo.
  if ((exc.palavras || []).length && exc.onde !== 'qualquer') return false;

  const cond = no.condicao || {};
  if ((cond.palavras || []).length && cond.onde !== 'qualquer') return false;

  if (!cond.sinal) return true;

  /**
   * **Sinal que só existe enquanto ela não foi respondida protege sozinho.**
   *
   * Estes são calculados sobre a RAJADA depois da nossa última mensagem: assim que respondemos,
   * as mensagens dela ficam para trás e o sinal volta a ser falso. A polaridade é o contrário da
   * lista de cima — aqui a caixa está protegida quando exige o sinal VERDADEIRO.
   *
   * Sem esta lista, `pedeAjudaFinanceira` foi acusada de repetir na primeira vez que virou caixa
   * do quadro (02/09/2026), e o aviso era falso: mandar a negativa apaga a condição.
   */
  if (SINAIS_QUE_A_RESPOSTA_APAGA.has(cond.sinal)) return !!cond.negar;

  if (!SINAIS_QUE_O_ENVIO_APAGA.has(cond.sinal)) return true;
  /**
   * A polaridade: todos estes viram VERDADE depois do envio, então a caixa só está protegida se
   * exigir o sinal FALSO. "O modelo não está na conversa" protege; "o modelo está" não protegeria
   * nada — casaria justamente depois de já ter saído.
   */
  return !cond.negar;
}

/**
 * O efeito de uma caixa, para a conferência: `envia`, `silencio`, `gente`, `depende` ou `''`.
 *
 * Caixa de regra pega do verbete (`SOBRE`); caixa dele, da tecla que ela dispara. Resposta pronta
 * é sempre envio.
 */
function efeitoDaCaixa(no) {
  if (no.regra) return SOBRE[no.regra]?.efeito || '';
  const acao = no.acao || {};
  if (acao.resposta) return 'envia';
  if (acao.tecla) return TECLAS[acao.tecla]?.efeito || '';
  return '';
}

/**
 * **Caixa que NÃO manda nada, com caixa que MANDA dentro dela.**
 *
 * É o erro mais caro do quadro livre, e já aconteceu **duas vezes** com a mesma forma:
 *
 *  - 01/09/2026: "mensagem padrão" caiu dentro de "Recusou ou veio hostilizar";
 *  - 02/09/2026: "mandar modelo conforme o anuncio" caiu no mesmo lugar. Medido no quadro que ele
 *    colou: **o hostil recebia o pedido de nome e cidade** e **a pessoa normal não recebia o
 *    modelo** — ela escapava para "pessoa retornando" e terminava agradecida por um apoio que nunca
 *    expressou.
 *
 * O motivo é o desenho do motor: **o filho é testado ANTES da ação do próprio nó**, e o filho só é
 * alcançado quando o PAI casa. Então pôr um remetente dentro de uma proteção significa, literalmente,
 * "quando eu reconhecer que não devo mandar nada, mande isto".
 *
 * Duas ocorrências do mesmo erro é problema de ferramenta, não de quem usa: o aninhamento não
 * anuncia essa inversão em lugar nenhum da tela. Agora anuncia.
 */
function remetenteDentroDeProtecao(no) {
  if (efeitoDaCaixa(no) !== 'silencio') return null;
  const dentro = todosOsNos(no.filhos).filter(({ no: f }) => efeitoDaCaixa(f) === 'envia');
  return dentro.length ? dentro.map(({ no: f }) => f.rotulo || f.id) : null;
}

export function problemas(arvore) {
  const achados = [];
  const ids = new Set();

  for (const { no, nivel } of todosOsNos(arvore)) {
    const nome = no.rotulo || no.id;
    if (ids.has(no.id)) achados.push(`"${nome}": id repetido (${no.id}) — a janela não consegue editar os dois`);
    ids.add(no.id);

    if (no.regra && !REGRAS.some((r) => r.id === no.regra)) {
      achados.push(`"${nome}": aponta para a regra "${no.regra}", que não existe mais no código`);
      continue;
    }
    /**
     * **Remetente dentro de proteção** — o erro que já aconteceu duas vezes. Ver
     * `remetenteDentroDeProtecao`.
     *
     * Fica ACIMA do `continue` das caixas de regra de propósito: as proteções deste projeto **são**
     * regras do código (`sem-interesse`, `etiqueta-dispensa-da-fila`), e nas duas vezes foi dentro
     * de uma delas que o remetente caiu. Posta depois do `continue`, esta conferência nunca teria
     * visto o caso real — foi o que aconteceu na primeira versão dela.
     */
    const dentroDaProtecao = remetenteDentroDeProtecao(no);
    if (dentroDaProtecao) {
      achados.push(
        `"${nome}" NÃO manda nada, mas tem ${dentroDaProtecao.length} caixa(s) que MANDAM dentro ` +
          `dela (${dentroDaProtecao.map((x) => `"${x}"`).join(', ')}). O filho é olhado ANTES da ação ` +
          'do pai, e só é alcançado quando o pai casa — então quem esta caixa deveria proteger é ' +
          'justamente quem vai receber. Solte-as na raiz e ponha-as ABAIXO desta.'
      );
    }

    if (no.regra) continue;

    const cond = no.condicao || {};
    if (cond.sinal && !sinalConhecido(cond.sinal)) {
      achados.push(`"${nome}": o sinal "${cond.sinal}" não existe — este ramo nunca vai casar`);
    }
    const acao = no.acao || {};
    if (acao.tecla && !TECLAS[acao.tecla]) achados.push(`"${nome}": a tecla "${acao.tecla}" não existe`);

    const semCondicao = !cond.sinal && !(cond.palavras || []).length;
    const semAcao = !acao.tecla && !acao.resposta && !acao.ia;
    const semFilhos = !(no.filhos || []).length;
    /**
     * A caixa que manda mensagem e casa de novo na passada seguinte. Ver `repeteSozinha`: nasceu de
     * uma caixa dele que mandava o modelo em toda passada, porque fixar a tecla não herda as
     * guardas da regra do código.
     */
    if (repeteSozinha(no)) {
      achados.push(
        `"${nome}": manda mensagem e a condição continua verdadeira depois do envio — vai mandar de ` +
          'novo em toda passada. Acrescente uma guarda (ex.: "O modelo não está na conversa"), ou ' +
          'use a regra do código, que já traz as guardas.'
      );
    }

    if (semCondicao && semAcao && semFilhos) {
      achados.push(`"${nome}": sem condição, sem ação e sem ramo dentro — não faz nada`);
    } else if (semAcao && semFilhos) {
      achados.push(`"${nome}": casa mas não faz nada — o fluxo segue para os ramos de baixo`);
    }
    if (nivel > 6) achados.push(`"${nome}": fundo demais (nível ${nivel}) — ninguém vai achar este ramo na tela`);
  }
  return achados;
}

/**
 * A chave que diz "esta caixa é a mesma coisa que aquela", entre dois quadros diferentes.
 *
 * Não é o `id`: os ids do quadro dele nasceram em outro momento e não batem com os do padrão. O que
 * identifica uma caixa é **o que ela decide** — a regra do código que ela carrega, ou a condição que
 * ele montou (sinal + palavras).
 *
 * Caixa que só AGRUPA (sem regra, sem sinal e sem palavra) fica fora da comparação: ela é estrutura,
 * não decisão, e todas colidiriam na mesma chave.
 */
function chaveDeComparacao(no) {
  /**
   * A exceção entra na chave: "mande o modelo" e "mande o modelo exceto quando já mandamos" são
   * caixas diferentes, e tratá-las como a mesma faria o cartão "O padrão mudou?" dizer que ele já
   * tem uma guarda que não tem.
   */
  const umaSo = (c) => {
    const palavras = (c.palavras || []).map((p) => String(p).trim().toLowerCase()).filter(Boolean).sort();
    if (!c.sinal && !palavras.length) return '';
    return `${c.sinal || ''}:${c.negar ? 'nao' : 'sim'}:${palavras.join('|')}`;
  };

  // As extras entram ordenadas: "A e B" e "B e A" são a mesma caixa.
  const marca = excecoesDe(no).map(umaSo).filter(Boolean).sort().join('+');
  const selo = marca ? `|exceto:${marca}` : '';

  if (no.regra) {
    const extras = (no.maisCondicoes || []).map(umaSo).filter(Boolean).sort().join('+');
    // A caixa juntada é OUTRA caixa: "conclui quando é assessor" e "conclui quando é assessor OU a
    // última é nossa" cobrem gente diferente, e o cartão "O padrão mudou?" tem que dizer isso.
    const juntas = [no.regra, ...(no.tambemQuando || [])].sort().join('+');
    return `regra:${juntas}${extras ? `|e:${extras}` : ''}${selo}`;
  }
  const todas = condicoesDe(no).map(umaSo).filter(Boolean).sort().join('+');
  if (!todas && !selo) return null;
  return `cond:${todas}${selo}`;
}

/**
 * **O que mudou no padrão e não está no quadro dele.**
 *
 * Relato dele (02/09/2026), depois de eu reordenar a chegada pelo anúncio várias vezes num dia:
 * *"a ramificação não foi atualizada"*. Estava certo — e o problema é de desenho, não daquele dia:
 * `fluxoPadrao` é o que o botão "Resetar para o padrão" devolve, e o quadro de trabalho dele é uma
 * CÓPIA que nada atualiza. Toda melhoria no padrão era invisível para ele, e o único caminho de
 * volta ("resetar") joga fora o arranjo feito à mão — que é justamente o trabalho que ele não quer
 * perder.
 *
 * Devolve `{ faltando, sobrando }`, os dois como caixas. `faltando` é o que o padrão decide e o
 * quadro dele não; `sobrando` é o contrário — e é **informação, não erro**: ele monta ramos que o
 * padrão nunca teve, e essa é a razão da janela existir.
 *
 * **Não mexe em nada.** Quem decide o que entra é ele, caixa por caixa, porque no quadro a POSIÇÃO
 * é a prioridade: enfiar uma caixa nova por conta própria mudaria o que a rodada faz sem ninguém ter
 * escolhido onde.
 */
export function diferencaDoPadrao(arvore) {
  const doPadrao = todosOsNos(arrumar(fluxoPadrao()));
  const dele = todosOsNos(arvore || []);

  const chavesDele = new Set(dele.map(({ no }) => chaveDeComparacao(no)).filter(Boolean));
  const chavesDoPadrao = new Set(doPadrao.map(({ no }) => chaveDeComparacao(no)).filter(Boolean));

  const junta = (nos, jaTem) => {
    const vistos = new Set();
    const saida = [];
    for (const { no } of nos) {
      const chave = chaveDeComparacao(no);
      if (!chave || jaTem.has(chave) || vistos.has(chave)) continue;
      vistos.add(chave);
      saida.push(no);
    }
    return saida;
  };

  return { faltando: junta(doPadrao, chavesDele), sobrando: junta(dele, chavesDoPadrao) };
}
