/**
 * ia-cliente.js — a ponte entre o painel e a API do modelo (Anthropic ou OpenAI).
 *
 * **A chave da API nunca entra na página, e essa é a razão de este arquivo existir.**
 * O `page-hook.js` roda no mundo MAIN, o mesmo contexto JS do Angular do mobiliza. Tudo o que
 * está na página, a plataforma (e qualquer script que ela carregue) consegue ler. Uma chave de
 * API ali é uma chave publicada. Por isso a requisição sai do **service worker**: ele tem as
 * `host_permissions`, roda fora de qualquer página, e o painel só lhe manda o pedido.
 *
 * O painel usa `avaliar()`. O service worker usa `atender()`. As duas metades da mesma conversa.
 */

import {
  montarSistema,
  montarContato,
  montarRequisicao,
  validarDecisao,
  montarSistemaRascunho,
  montarContatoRascunho,
  montarRequisicaoRascunho,
  validarRascunho,
  tokensAproximados,
  ANTERIOR_MAX_FALAS,
  ELA_SE_DESCULPOU,
  ELA_FALOU_DE_TRABALHO,
  montarSistemaCidade,
  montarContatoCidade,
  montarRequisicaoCidade,
  validarCidade,
  MODELO_PADRAO,
  PROVEDOR_OPENAI,
  NOME_DO_PROVEDOR,
  provedorDoModelo,
} from './ia.js';

export const MSG_IA = 'whatsfill-ia';

const VERSAO_API = '2023-06-01';

/**
 * **Quanto tempo a IA pode demorar antes de virar falha** — relato dele (08/09/2026): *"IA travou
 * em dois casos, não carrega a resposta"*, com a rodada parada em "Andando…".
 *
 * **Não havia timeout em lugar nenhum** — nem no `fetch` do service worker, nem na ponte
 * painel→worker. E são dois jeitos de pendurar, com a mesma cara na tela:
 *
 *  1. a API não responde (rede pendurada, servidor sem resposta): o `fetch` espera para sempre;
 *  2. **o service worker do MV3 é encerrado no meio da chamada** — e aí o
 *     `chrome.runtime.sendMessage` **nunca recebe resposta**, e a promessa do painel fica pendente
 *     sem erro nenhum. É o caso que só o timeout do lado do painel resolve, porque não há mais
 *     ninguém do outro lado para responder.
 *
 * A regra deste projeto é *"falha de IA nunca para a rodada"* — e **pendurar é pior que falhar**:
 * falha vira linha de aviso e a fila anda; pendurar não vira nada.
 *
 * O da PONTE é maior que o do `fetch` de propósito: assim o motivo específico ("a API demorou
 * demais", "conta sem crédito") chega à tela quando o worker está vivo, e o genérico só aparece
 * quando o worker morreu.
 *
 * **Os dois relógios foram reajustados na 3.5.0** para o RESERVA caber: com o failsafe, uma
 * chamada ruim pode virar duas (o titular e o reserva), e a ponte tem que esperar as duas — senão o
 * painel desiste antes de o reserva responder, e o failsafe nunca chega à tela.
 *
 *     45s (titular) + 45s (reserva) = 90s  <  100s da ponte
 */
const TIMEOUT_FETCH_MS = 45_000;
const TIMEOUT_PONTE_MS = 100_000;

/**
 * Pede ao service worker e **desiste na hora certa**, em vez de esperar para sempre.
 *
 * Devolve `{ok:false, motivo}` no lugar de lançar: os três chamadores já tratam isso como falha de
 * IA, que é exatamente o que um timeout é.
 *
 * `prazo` é parâmetro para o teste poder provar a corrida em milissegundos em vez de em minutos —
 * o valor de produção é o padrão, e ninguém o passa.
 */
export async function pedirAoWorker(mensagem, prazo = TIMEOUT_PONTE_MS) {
  let acabou;
  const relogio = new Promise((res) => {
    acabou = setTimeout(
      () => res({ ok: false, motivo: 'a IA não respondeu a tempo (o serviço da extensão pode ter sido encerrado) — tente de novo' }),
      prazo
    );
  });
  try {
    return await Promise.race([chrome.runtime.sendMessage(mensagem), relogio]);
  } finally {
    clearTimeout(acabou);
  }
}

/**
 * **As duas casas, lado a lado** — endpoint, cabeçalhos, onde está o texto e onde está a conta.
 *
 * Tudo o que difere entre a Anthropic e a OpenAI cabe nesta tabela: o resto do arquivo (e todo o
 * `ia.js` que monta prompt) não sabe qual das duas está atendendo. Foi a estimativa dada a ele em
 * 07/09 — *"a troca de API é contida: são 7 pontos"* — e é isto aqui.
 */
export const PROVEDORES = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    /**
     * `anthropic-dangerous-direct-browser-access` é necessário porque a origem aqui é a da
     * extensão, não um servidor. O nome do cabeçalho é um aviso legítimo — chamar a API direto do
     * navegador expõe a chave a quem tiver acesso ao navegador. Vale aqui porque a extensão é
     * interna, é carregada descompactada e a chave fica no armazenamento da própria extensão, que
     * outra extensão não lê. **Não vale para nada que seja distribuído.**
     */
    cabecalhos: (chave) => ({
      'content-type': 'application/json',
      'x-api-key': chave,
      'anthropic-version': VERSAO_API,
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
    // A decisão vem como texto no primeiro bloco; o esquema garante que é JSON válido, mas quem
    // decide se dá para usar é o `validar*` do lado do painel.
    texto: (dados) => (dados.content || []).find((b) => b.type === 'text')?.text ?? null,
    /**
     * `cache_read` separado de propósito: é o número que diz se o cache está funcionando. Zero
     * nele em chamadas seguidas significa que alguma coisa no prompt de sistema passou a variar, e
     * a conta fica 3,5× maior sem nenhum erro aparecer.
     */
    uso: (u) => ({
      entrada: u.input_tokens || 0,
      cacheEscrito: u.cache_creation_input_tokens || 0,
      cacheLido: u.cache_read_input_tokens || 0,
      saida: u.output_tokens || 0,
    }),
    truncou: (dados) => (dados.stop_reason || '') === 'max_tokens',
  },

  openai: {
    // Chat Completions, e não a Responses API: é a rota com o formato mais estável para
    // `response_format: json_schema`, que é a trava de formato deste projeto.
    url: 'https://api.openai.com/v1/chat/completions',
    cabecalhos: (chave) => ({
      'content-type': 'application/json',
      authorization: `Bearer ${chave}`,
    }),
    /**
     * `refusal` vira `null`, e `null` vira `incerto` do outro lado.
     *
     * O strict mode tem um canal próprio para o modelo se recusar a responder, e ele NÃO vem em
     * `content`: ler só o `content` deixaria uma recusa parecer resposta vazia. `incerto` é o
     * painel se comportando como antes da IA existir, que é o desfecho certo.
     */
    texto: (dados) => {
      const m = dados.choices?.[0]?.message;
      if (!m || m.refusal) return null;
      return m.content ?? null;
    },
    /**
     * **`prompt_tokens` INCLUI o que veio do cache; `input_tokens` da Anthropic NÃO.**
     *
     * É a diferença mais fácil de errar entre as duas contas, e errar aqui cobra o prompt inteiro
     * duas vezes: com ~5.300 tokens de sistema, cada chamada cacheada apareceria quase 10× mais
     * caro do que é — e o teto de gasto, que é a única trava de dinheiro do projeto, fecharia
     * sozinho no meio de uma rodada. Por isso a subtração.
     */
    uso: (u) => {
      const lido = u.prompt_tokens_details?.cached_tokens || 0;
      return {
        entrada: Math.max(0, (u.prompt_tokens || 0) - lido),
        // Não existe: na OpenAI o cache é automático e escrever nele não custa nada.
        cacheEscrito: 0,
        cacheLido: lido,
        // Já inclui os tokens de raciocínio, que é como a OpenAI os cobra.
        saida: u.completion_tokens || 0,
      };
    },
    truncou: (dados) => (dados.choices?.[0]?.finish_reason || '') === 'length',
  },
};

// ---------------------------------------------------------------------------
// Lado do painel
// ---------------------------------------------------------------------------

/**
 * Pede ao service worker que avalie este contato.
 *
 * O **teto de gasto** é conferido do outro lado, no service worker, antes da chamada sair: é
 * o único ponto por onde o dinheiro passa, e trava que mora no painel é trava que um caminho
 * novo esquece de chamar. Teto atingido chega aqui como qualquer outra falha — `incerto`.
 *
 * Nunca lança: falha de IA não pode derrubar rodada. Sem resposta, sem rede, sem chave, sem
 * crédito — tudo vira `{acao: 'incerto'}`, que é o painel se comportando como antes da IA
 * existir. É a mesma disciplina do resto: na dúvida, quem decide é ele.
 *
 * **SEM CHAMADOR desde 06/09/2026, e isto é uma escolha registrada.** O papel da IA mudou naquele
 * dia (*"quando nenhuma resposta serve, ela dá uma resposta personalizada; essa é a função dela"*):
 * ela deixou de ESCOLHER resposta pronta, e com isso saíram a tecla 0, o botão "Avaliar o contato
 * aberto" e o `avaliarComIA` do painel.
 *
 * O que sobrou aqui — este cliente, o `modo: 'decisao'` do service worker e a metade da decisão em
 * `ia.js` — **não foi apagado junto de propósito**: é código puro, coberto por `tests/ia.test.mjs`,
 * e leva as travas que impedem a IA de escolher `pedido-ajuda`/`pedido-emprego` (`RESTRITOS`, Lei
 * 9.504/97). Apagar tudo no mesmo turno seria deletar guarda testada por causa de uma mudança de
 * produto de horas antes.
 *
 * **Se a decisão por IA não voltar, isto sai** — e sai inteiro: cliente, modo do service worker,
 * `montarSistema`, `esquemaDaDecisao`, `validarDecisao` e os testes deles. Ficar meio apagado é
 * pior que os dois lados.
 *
 * @returns {Promise<{acao:string, templateId:string, motivo:string, confianca:number,
 *                    aviso:string, custo?:object}>}
 */
export async function avaliar({ templates, regras, gabinete, mensagens, campos, etiquetas, modelo, agora }) {
  const ids = (templates || []).map((t) => t.id);
  try {
    const r = await pedirAoWorker({
      type: MSG_IA,
      sistema: montarSistema({ templates, regras, gabinete }),
      contato: montarContato({ mensagens, campos, etiquetas, agora }),
      ids,
      modelo: modelo || MODELO_PADRAO,
    });

    if (!r?.ok) {
      return { acao: 'incerto', templateId: '', motivo: '', confianca: 0, aviso: r?.motivo || 'a IA não respondeu' };
    }
    return { ...validarDecisao(r.decisao, ids), custo: r.custo, custoUsd: r.custoUsd, gastoMes: r.gastoMes, usouReserva: r.usouReserva, motivoDoTitular: r.motivoDoTitular };
  } catch (err) {
    return { acao: 'incerto', templateId: '', motivo: '', confianca: 0, aviso: err?.message || String(err) };
  }
}

/**
 * Pede um RASCUNHO de resposta para este contato — o caso da transcrição longa, do relato
 * comprido, da pergunta específica que nenhuma resposta pronta cobre.
 *
 * O que volta vai para o **campo de mensagem**, para ele editar e mandar. Nunca é enviado daqui.
 *
 * Nunca lança, pelo mesmo motivo do `avaliar`: falha de IA não pode parar o atendimento.
 */
export async function rascunhar({ templates, regras, gabinete, mensagens, campos, modelo, agora, pedirDados, chapa, pedeMaterial, jaNosConhece, aprendidas, quantas = 3, anterior = [] }) {
  /**
   * **O QUE A IA LEU, guardado para a tela mostrar** — pergunta dele (16/09/2026): *"preciso saber
   * qual a visão da IA sobre a conversa, o que ela tem acesso e o que não tem"*.
   *
   * A resposta honesta não é uma lista escrita por mim: é o TEXTO que foi mandado. `contato` vai
   * inteiro (é a parte que muda de contato para contato, e é nela que mora a conversa); o sistema,
   * que tem ~10 mil tokens e é igual para todos, vai como RESUMO do que contém. **Montado aqui, antes
   * da chamada**, para aparecer também quando a chamada falha — é justamente aí que ele mais precisa
   * ver o que foi pedido.
   *
   * Fica só em memória, no painel. Nunca vai para armazenamento nem para arquivo: tem dado de eleitor.
   */
  const sistema = montarSistemaRascunho({ templates, regras, gabinete });
  const contato = montarContatoRascunho({ mensagens, campos, agora, pedirDados, jaNosConhece, aprendidas, quantas, anterior });
  const lidoPelaIA = {
    contato,
    sistemaTokens: tokensAproximados(sistema),
    contatoTokens: tokensAproximados(contato),
    // Quantas falas do atendimento anterior foram junto - zero quando nao havia ou nao foi buscado.
    anterior: Math.min((anterior || []).length, ANTERIOR_MAX_FALAS),
    respostasProntas: (templates || []).length,
    instrucoesExtras: !!String(regras || '').trim(),
    dossie: !!String(gabinete || '').trim(),
    licoes: String(aprendidas || '').split(/\r?\n/).filter((l) => l.startsWith('- ')).length,
    quantas,
  };
  try {
    const r = await pedirAoWorker({
      type: MSG_IA,
      modo: 'rascunho',
      sistema,
      // `aprendidas` é o que ele ensinou escolhendo entre os três rascunhos — ver `aprendizado.js`.
      // Vai no bloco do CONTATO (não cacheado) de propósito: lição nova no sistema invalidaria o
      // cache de todo mundo, e é aqui, colado no pedido, que o modelo a cumpre.
      //
      // `quantas` é o MODO: 3 treina, 1 é o modo antigo — e o modo antigo continua levando as
      // lições, que é o que ele pediu ao separar os dois. Vai junto para o worker porque é lá que
      // o esquema é montado, e pedir três para usar uma pagaria a saída das outras duas.
      contato,
      modelo: modelo || MODELO_PADRAO,
      quantas,
    });

    if (!r?.ok) return { texto: '', avisos: [r?.motivo || 'a IA não respondeu'], custo: null, lidoPelaIA };
    // `validarRascunho` e não `revisarRascunho`: o rascunho passou a vir com esquema (texto +
    // confianca + precisaDeRevisao), e é a confiança que o envio automático precisa. Resposta
    // sem esquema ainda vira rascunho: o texto continua servindo para ele ler e mandar.
    // `jaFalamos` liga o aviso de apresentação repetida: a mesma conversa que o prompt usa para
    // pedir a VOZ de continuação (05/09/2026, *"está agindo como uma terceira pessoa"*).
    const jaFalamos = (mensagens || []).some((m) => m && typeof m === 'object' && m.de === 'nos');
    /**
     * **Chegou texto legível dela no que ainda não respondemos?**
     *
     * É o que condiciona `AVISOS_QUE_IMPEDEM_ENVIO.pediuReenvio` — print da Irene (07/09/2026), em
     * que a rodada respondeu *"deve ter dado ruim no áudio, pode enviar de novo?"* a quem tinha
     * mandado cinco áudios, todos transcritos.
     *
     * A conta é sobre a **rajada pendente**, e não sobre a conversa inteira: "o que ela mandou
     * agora chegou legível" é a afirmação que a trava desmente. Quem monta a lista já descartou
     * texto vazio (mídia sem transcrição não chega aqui), então a presença da mensagem é a prova.
     */
    const lista = (mensagens || []).filter((m) => m && typeof m === 'object' && String(m.texto || '').trim());
    let ultimaNossa = -1;
    lista.forEach((m, i) => { if (m.de === 'nos') ultimaNossa = i; });
    // A MIDIA sem texto (a linha "ela mandou uma IMAGEM") NAO conta: audio sem transcricao existe, e
    // ai pedir para reenviar e a resposta certa - contar a marca como "chegou legivel" barraria o texto
    // certo (16/09/2026).
    const recebemosDela = lista.some((m, i) => m.de !== 'nos' && i > ultimaNossa && !m.semConteudo);
    /**
     * Ela se desculpou em algum momento desta conversa? Liga a trava desculpaInexistente.
     * Le a CONVERSA INTEIRA dela, e nao a rajada: quem se desculpou no comeco continua tendo se
     * desculpado, e a frase que reconhece isso e a certa mais tarde tambem.
     */
    const elaSeDesculpou = lista.some((m) => m.de !== 'nos' && !m.semConteudo && ELA_SE_DESCULPOU.test(String(m.texto || '')));
    /**
     * Ela falou em trabalhar ou em ganhar? Liga a trava trabalhoInexistente. Conversa inteira e sem
     * o clique do anúncio: o texto do anúncio é da campanha, não dela.
     */
    const elaFalouDeTrabalho = lista.some((m) => m.de !== 'nos' && !m.anuncio && !m.semConteudo && ELA_FALOU_DE_TRABALHO.test(String(m.texto || '')));
    /**
     * **A NOSSA última fala, e se ela foi HOJE** — relato dele (15/09/2026): *"a IA tem agradecido
     * múltiplas vezes pelo apoio e dado boa tarde múltiplas vezes, uma mensagem após a outra"*.
     *
     * São os dois campos que tornam a regra de 12/09 (*"não repita o que já dissemos"*) mecânica em
     * vez de pedido no prompt: `nossaUltima` é o texto contra o qual `ia.semRepetirONosso` compara, e
     * `jaFalamosHoje` é o que faz a saudação SAIR em vez de ser corrigida (`ia.semSaudacao`).
     *
     * **O corte é o DIA LOCAL**, como em `cortesia.deOutroDia`: é o que ele lê na tela, e "boa tarde"
     * repetido às 14h depois de um "bom dia" às 9h é o caso que ele mandou. Sem `at` na nossa última
     * mensagem, `jaFalamosHoje` é falso — inventar a hora faria a saudação sumir por dedução.
     */
    const nossaUltima = ultimaNossa >= 0 ? String(lista[ultimaNossa].texto || '') : '';
    const quandoFalamos = ultimaNossa >= 0 ? lista[ultimaNossa].at : null;
    const jaFalamosHoje =
      !!quandoFalamos &&
      !Number.isNaN(new Date(quandoFalamos).getTime()) &&
      new Date(quandoFalamos).toDateString() === new Date(agora || Date.now()).toDateString();
    return {
      /**
       * `chapa` liga a conferência de cargo e número — ver `ia.conferirChapa`. Ela **não depende
       * de `dossieAtivo`**: o modelo tem saber próprio sobre estes nomes, e foi ele que trocou o
       * cargo do Van Hattem na print da Nara. Trava não pode depender de uma caixa marcada.
       */
      ...validarRascunho(r.decisao, agora, { jaFalamos, jaNosConhece, recebemosDela, chapa, pedeMaterial, elaSeDesculpou, elaFalouDeTrabalho, nossaUltima, jaFalamosHoje }),
      custo: r.custo,
      custoUsd: r.custoUsd,
      gastoMes: r.gastoMes,
      // Quem atendeu, quando o titular falhou: a linha do Andamento tem que dizer, senão o log
      // fala de um modelo que não é o que está escolhido na tela. E `motivoDoTitular` é o POR QUÊ
      // — sem ele a tela mostra "RESERVA" e ninguém sabe o que houve com a casa escolhida.
      usouReserva: r.usouReserva,
      motivoDoTitular: r.motivoDoTitular,
      lidoPelaIA,
    };
  } catch (err) {
    return { texto: '', avisos: [err?.message || String(err)], custo: null, lidoPelaIA };
  }
}

/**
 * Pede à IA que confira a cidade que o parser achou — o popup "Está correta?" sem o clique.
 *
 * Só a rodada automatizada chama isto. No dia a dia quem confere é ele, e continua sendo.
 *
 * `municipios` é a lista oficial do IBGE, e vai daqui: `validarCidade` é pura de propósito, e a
 * lista vive no `cities.js`, que precisa de armazenamento. Sem ela, correção nenhuma passa.
 *
 * Nunca lança. Falha vira `incerto`, e `incerto` não grava nada — o campo fica como estava.
 */
export async function conferirCidade({ regras, mensagens, candidato, origem, substituiria, municipios, normalizar, modelo }) {
  try {
    const r = await pedirAoWorker({
      type: MSG_IA,
      modo: 'cidade',
      sistema: montarSistemaCidade({ regras }),
      contato: montarContatoCidade({ mensagens, candidato, origem, substituiria }),
      modelo: modelo || MODELO_PADRAO,
    });

    if (!r?.ok) {
      return { acao: 'incerto', cidade: '', motivo: '', confianca: 0, aviso: r?.motivo || 'a IA não respondeu' };
    }
    return { ...validarCidade(r.decisao, { municipios, normalizar }), custo: r.custo, custoUsd: r.custoUsd, gastoMes: r.gastoMes, usouReserva: r.usouReserva, motivoDoTitular: r.motivoDoTitular };
  } catch (err) {
    return { acao: 'incerto', cidade: '', motivo: '', confianca: 0, aviso: err?.message || String(err) };
  }
}

// ---------------------------------------------------------------------------
// Lado do service worker
// ---------------------------------------------------------------------------

/**
 * Faz a chamada de verdade. Só o service worker executa isto.
 *
 * **Quem escolhe a casa é o MODELO** (`provedorDoModelo`), e não um parâmetro à parte: o service
 * worker usa a mesma função para saber qual chave ler. Uma fonte de verdade — a alternativa
 * (provedor guardado separado do modelo) diverge em silêncio e o sintoma é um 400 sem explicação.
 *
 * @param {object} pedido    o que o painel montou
 * @param {string} chave     a chave da API do provedor deste modelo, lida pelo chamador
 * @returns {Promise<{ok:boolean, decisao?:object, custo?:object, motivo?:string}>}
 */
export async function atender(pedido, chave) {
  const provedor = provedorDoModelo(pedido.modelo || MODELO_PADRAO);
  const casa = PROVEDORES[provedor];

  // Diz QUAL chave falta: com dois provedores, "sem chave da API" mandaria procurar no campo
  // errado — e o campo do outro provedor pode estar preenchido, o que faz parecer defeito.
  if (!chave) {
    return { ok: false, motivo: `sem a chave da ${NOME_DO_PROVEDOR[provedor]} — preencha na aba Config` };
  }

  // Três formas de pedido pelo mesmo canal: decisão (JSON com esquema), rascunho (texto) e
  // conferência de cidade (JSON, esquema próprio e teto de saída baixo).
  const corpo =
    pedido.modo === 'rascunho'
      ? montarRequisicaoRascunho({ sistema: pedido.sistema, contato: pedido.contato, modelo: pedido.modelo, quantas: pedido.quantas })
      : pedido.modo === 'cidade'
      ? montarRequisicaoCidade({ sistema: pedido.sistema, contato: pedido.contato, modelo: pedido.modelo })
      : montarRequisicao({
          sistema: pedido.sistema,
          contato: pedido.contato,
          ids: pedido.ids,
          modelo: pedido.modelo,
        });

  let resposta;
  /**
   * **O `fetch` desiste** — ver `TIMEOUT_FETCH_MS`. Sem o abort, a chamada que a API deixa pendurada
   * segura a rodada inteira: o painel espera o worker, e o worker espera a rede.
   */
  const corta = new AbortController();
  const relogio = setTimeout(() => corta.abort(), TIMEOUT_FETCH_MS);
  try {
    resposta = await fetch(casa.url, {
      method: 'POST',
      headers: casa.cabecalhos(chave),
      body: JSON.stringify(corpo),
      signal: corta.signal,
    });
  } catch (err) {
    const demorou = err?.name === 'AbortError';
    return {
      ok: false,
      motivo: demorou
        ? `a API não respondeu em ${Math.round(TIMEOUT_FETCH_MS / 1000)}s — tente de novo`
        : `não consegui falar com a API: ${err?.message || err}`,
    };
  } finally {
    clearTimeout(relogio);
  }

  if (!resposta.ok) {
    const texto = await resposta.text().catch(() => '');
    return { ok: false, motivo: traduzirErro(resposta.status, texto) };
  }

  let dados;
  try {
    dados = await resposta.json();
  } catch (_) {
    return { ok: false, motivo: 'a API devolveu algo que não é JSON' };
  }

  const custo = dados.usage ? casa.uso(dados.usage) : null;

  /**
   * **Truncada é chamada PAGA que devolve nada — e o `custo` vai junto do erro.**
   *
   * `background.js` contabiliza sempre que houver `custo`, independentemente do `ok`: a API cobra
   * pela chamada, não pelo acerto. Gasto que só conta o que deu certo subestima a fatura, e este
   * é justamente o caso em que ela cresce sem nada aparecer na tela.
   *
   * Nos modelos que raciocinam o teto é o suspeito número um, porque o raciocínio é cobrado como
   * saída e cabe DENTRO dele — a armadilha do Opus 5, que aqui tem o piso de 2.048 como defesa.
   */
  if (casa.truncou(dados)) {
    return { ok: false, motivo: 'a resposta foi truncada no teto de saída — nada dela pôde ser usado', custo };
  }

  return { ok: true, decisao: casa.texto(dados), custo };
}

/** Erro de API vira frase que diz o que fazer, não código HTTP. */
function traduzirErro(status, texto) {
  if (status === 401) return 'a chave da API foi recusada — confira na aba Config';
  // `insufficient_quota` é 429 na OpenAI e significa conta sem saldo, não excesso de velocidade:
  // "espere um pouco" mandaria esperar por uma coisa que não passa sozinha.
  if (/insufficient_quota/i.test(texto)) return 'a conta da API está sem saldo — recarregue no painel do provedor';
  if (status === 429) return 'limite de uso da API atingido — espere um pouco';
  if (status === 400 && /credit balance|insufficient/i.test(texto)) return 'a conta da API está sem crédito';
  /**
   * **Modelo que não existe é o erro esperado ao trocar de provedor**, e a mensagem crua não diz
   * o que fazer: as duas APIs respondem 404/400 com "model not found" para o nome da outra casa.
   */
  if (/model.*(not found|does not exist)|invalid.*model/i.test(texto)) {
    return 'esse modelo não existe nesta API — confira o modelo escolhido na aba Config';
  }
  if (/unsupported_parameter|unknown_parameter|unrecognized/i.test(texto)) {
    return `a API recusou um parâmetro que mandamos (${status}) — o modelo escolhido não aceita algo do pedido`;
  }
  if (status >= 500) return `a API está com problema (${status}) — tente de novo daqui a pouco`;

  let detalhe = '';
  try {
    detalhe = JSON.parse(texto)?.error?.message || '';
  } catch (_) {
    detalhe = texto.slice(0, 200);
  }
  return `a API recusou (${status})${detalhe ? `: ${detalhe}` : ''}`;
}
