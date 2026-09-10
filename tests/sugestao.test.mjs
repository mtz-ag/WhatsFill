/**
 * A recomendação da rodada: qual opção sai destacada, e por quê.
 *
 * O que este arquivo protege é a ORDEM. As regras são uma lista e a primeira que casa vence —
 * então acrescentar uma situação no lugar errado muda silenciosamente o que é recomendado para
 * milhares de contatos. Cada teste aqui fixa uma prioridade que foi decidida de propósito.
 *
 * Rode: node tests/sugestao.test.mjs
 */
import { check, grupo, fim } from './_harness.mjs';
import { sugerirAcao, REGRAS } from '../src/lib/sugestao.js';
import * as sugestaoLib from '../src/lib/sugestao.js';

/** Retrato de um contato "sem nada": nenhuma regra deveria casar por acidente. */
const base = {
  momentoJaEnviado: false,
  jaPediramDados: true,
  nomeSemSentido: false,
  modeloJaNaConversa: false,
  respondidoHoje: false,
  ultimaEhDespedida: false,
  voltouPorOutroAnuncio: false,
  momentoHoje: false,
  pedeRespostaPessoal: null,
  etiquetaQueDispensa: null,
  ultimaEhSoReacao: false,
  perguntaAberta: null,
  soExpressaApoio: null,
  rajadaEhSoRepasse: false,
  pedeAlgoIndefinido: null,
  podePerguntarAjuda: true,
  jaRespondemosAntes: false,
  podeMandarMomento: true,
  temEtiquetaDeCidade: true,
  podePedirDados: true,
  pedidoHoje: false,
  podeEnviar: false,
  enviadoHoje: false,
  conteudoPedido: '',
  podePerguntarInteresse: false,
  interessePerguntado: false,
};
const com = (mudanca) => sugerirAcao({ ...base, ...mudanca });

grupo('nome sem sentido: pedir dados');
{
  const r = com({ nomeSemSentido: true });
  check(r?.tecla === '4', `recomendou a tecla 4 = ${JSON.stringify(r)}`);
  check(/nome/.test(r?.motivo || ''), `o motivo fala do nome = ${r?.motivo}`);

  // O que ele corrigiu: SO faltar cidade nao pede mais nada. "ao abrir conversas esta pedindo
  // dados pra quem ja tem etiquetas".
  check(com({ temEtiquetaDeCidade: false })?.id !== 'nome-sem-sentido',
    'so faltar cidade nao pede dados');

  // A prioridade MUDOU em 31/08, com a print da Janete: quem pediu conteúdo e não deu a cidade
  // recebe o conteúdo. "Talvez em outra hora ela forneça" — e o formulário repetido não aproxima
  // ninguém de fornecer. A regra de cidade e a de conteúdo trocaram de lugar na lista.
  const comConteudo = com({ nomeSemSentido: true, podeEnviar: true, conteudoPedido: 'Conteúdo Flávio' });
  check(comConteudo?.tecla === '1', 'com modelo a enviar, o modelo vence — mesmo sem nome');

  // E sem nada a enviar, pedir dados continua sendo a saída.
  check(com({ nomeSemSentido: true })?.tecla === '4', 'sem nada a enviar, pede os dados');

  // Mas não recomenda pedir DE NOVO no mesmo dia.
  const jaPedi = com({ nomeSemSentido: true, pedidoHoje: true });
  check(jaPedi?.tecla !== '4', `já pedido hoje não recomenda pedir de novo = ${JSON.stringify(jaPedi)}`);

  // Sem a opção na tela (texto travado por variável), não adianta recomendá-la.
  check(com({ nomeSemSentido: true, podePedirDados: false })?.tecla !== '4', 'opção indisponível não é recomendada');
}

grupo('com cidade: manda o conteúdo pedido');
{
  const r = com({ podeEnviar: true, conteudoPedido: 'Conteúdo Zucco' });
  check(r?.tecla === '1', `recomendou a tecla 1 = ${JSON.stringify(r)}`);
  check(/Zucco/.test(r?.motivo || ''), `o motivo nomeia o conteúdo = ${r?.motivo}`);

  // Enviado hoje perde o destaque: repetir tem que ser decisão, não inércia.
  check(com({ podeEnviar: true, enviadoHoje: true })?.tecla !== '1', 'enviado hoje não é recomendado de novo');
}

grupo('nunca perguntaram o interesse');
{
  const r = com({ podePerguntarInteresse: true });
  check(r?.tecla === '7', `recomendou a tecla 7 = ${JSON.stringify(r)}`);
  check(com({ podePerguntarInteresse: true, interessePerguntado: true })?.tecla !== '7', 'já perguntado não repete');

  // Conteúdo a enviar vence a pergunta de interesse.
  check(com({ podePerguntarInteresse: true, podeEnviar: true })?.tecla === '1', 'modelo vence a pergunta');
}

grupo('já pedi hoje e não veio nada: concluir');
{
  const r = com({ temEtiquetaDeCidade: false, pedidoHoje: true });
  check(r?.tecla === '3', `recomendou concluir = ${JSON.stringify(r)}`);
}

grupo('nenhuma regra casa: nenhum destaque');
{
  check(sugerirAcao(base) === null, 'contato sem situação conhecida não recebe recomendação');
  check(sugerirAcao(null) === null, 'contexto nulo não explode');
  check(sugerirAcao({}) === null, 'contexto vazio não inventa recomendação');
}

grupo('a lista de regras se mantém sã');
{
  check(REGRAS.length > 0, `tem regra = ${REGRAS.length}`);
  check(REGRAS.every((r) => r.id && (typeof r.tecla === 'string' || typeof r.tecla === 'function') && typeof r.quando === 'function' && typeof r.motivo === 'function'),
    'toda regra tem id, tecla, quando e motivo');
  check(new Set(REGRAS.map((r) => r.id)).size === REGRAS.length, 'nenhum id repetido');

  // Regra que estoura não pode derrubar a rodada — ela só deixa de sugerir.
  const original = REGRAS[0].quando;
  REGRAS[0].quando = () => { throw new Error('regra quebrada'); };
  check(sugerirAcao({ ...base, podeEnviar: true })?.tecla === '1', 'regra quebrada é pulada, a seguinte vale');
  REGRAS[0].quando = original;
}

grupo('ultima mensagem e so reacao: mensagem do momento, e na frente');
{
  const r = com({ ultimaEhSoReacao: true });
  check(r?.tecla === '5', `recomendou a tecla 5 = ${JSON.stringify(r)}`);
  check(/figura|emoji|link/.test(r?.motivo || ''), `o motivo diz o que ela mandou = ${r?.motivo}`);

  // Vence até a regra de cidade: responder um 👍 pedindo nome e cidade lê como robô.
  check(com({ ultimaEhSoReacao: true, temEtiquetaDeCidade: false })?.tecla === '5', 'vence a regra de cidade');
  check(com({ ultimaEhSoReacao: true, podeEnviar: true })?.tecla === '5', 'vence o modelo a enviar');

  // Sem mensagem do momento configurada, a opção nem está na tela.
  check(com({ ultimaEhSoReacao: true, podeMandarMomento: false })?.tecla !== '5', 'sem momento configurado não recomenda');
}

grupo('audio ou texto longo: responder a mao, e na frente de tudo');
{
  const pede = { motivo: 'mandou um áudio — só dá para responder depois de abrir' };
  const r = com({ pedeRespostaPessoal: pede });
  check(r?.tecla === '6', `recomendou a tecla 6 = ${JSON.stringify(r)}`);
  check(/áudio/.test(r?.motivo || ''), 'o motivo vem da detecção');

  // O caso que ele trouxe: contato JA classificado, com conteudo pedido e modelo mapeado, que
  // mandou um audio. Mandar modelo para quem acabou de falar 1min13 parece deboche.
  check(com({ pedeRespostaPessoal: pede, podeEnviar: true, conteudoPedido: 'ADS' })?.tecla === '6',
    'vence o modelo a enviar — ter etiqueta não quer dizer que a conversa acabou');
  check(com({ pedeRespostaPessoal: pede, ultimaEhSoReacao: true })?.tecla === '6', 'vence a reação');
  check(com({ pedeRespostaPessoal: pede, temEtiquetaDeCidade: false })?.tecla === '6', 'vence a regra de cidade');
}


grupo('etiqueta que dispensa da fila: momento uma vez, depois concluir (03/09/2026)');
{
  /**
   * Pedido dele, anotacao do Paulo Cezar: *"engajado recebe mensagem do momento uma vez por dia e
   * depois toda vez que aparecer pode concluir em vez de pular"*.
   *
   * Pular deixava o atendimento ABERTO: o engajado que manda video o dia inteiro voltava a custar
   * uma abertura por rodada, para sempre, e nunca recebia nada.
   */
  const r = com({ etiquetaQueDispensa: 'ENGAJADO/BIZA' });
  check(r?.tecla === '5', 'ainda nao recebeu o momento: manda o momento = ' + JSON.stringify(r));
  check(String(r?.motivo || '').includes('ENGAJADO/BIZA'), 'o motivo nomeia a etiqueta = ' + r?.motivo);

  const jaFoi = com({ etiquetaQueDispensa: 'engajado', momentoJaEnviado: true });
  check(jaFoi?.tecla === '3', 'ja recebeu o momento: concluir, e nao pular = ' + JSON.stringify(jaFoi));
  check(com({ etiquetaQueDispensa: 'engajado', podeMandarMomento: false })?.tecla === '3',
    'sem mensagem do momento configurada, concluir');

  // Nao pula mais NUNCA: pular era o que prendia o engajado na fila.
  check(r?.tecla !== '2' && jaFoi?.tecla !== '2', 'a tecla 2 saiu deste desfecho');

  // Vence o resto do trabalho de fila: engajado nao precisa de formulario nem de interesse.
  const id = (extra) => com({ etiquetaQueDispensa: 'engajado', ...extra })?.id;
  check(id({ nomeSemSentido: true }) === 'etiqueta-dispensa-da-fila', 'vence pedir dados');
  check(id({ podeEnviar: true }) === 'etiqueta-dispensa-da-fila', 'vence o modelo');
  check(id({ ultimaEhSoReacao: true }) === 'etiqueta-dispensa-da-fila', 'vence a reacao');

  // A prioridade INVERTEU em 31/08, por decisao dele (print do Deoclecio, engajado com video):
  // "veja isso tambem que nao pulou o engajado". Engajado manda video e link o dia inteiro, e
  // responder a cada um e nao sair da fila. A tecla 6 continua a um toque quando merecer.
  check(id({ pedeRespostaPessoal: { motivo: 'mandou um video' } }) === 'etiqueta-dispensa-da-fila',
    'engajado com video: a etiqueta vence tudo');
}


grupo('voltou por outro anuncio');
{
  /**
   * **A regra exige que o modelo JA esteja na conversa** -- anotacao da Eroni (03/09/2026).
   *
   * Ela recusou o convite e clicou em dois anuncios diferentes; a caixa ofereceu a mensagem do
   * momento. *"aqui ela veio por outro modelo sem ser o padrao, mandar o modelo pedido e pedir
   * dados que falta"*. "Nao mande o mesmo conteudo de novo" pressupoe que o conteudo e o mesmo.
   */
  check(com({ voltouPorOutroAnuncio: true, modeloJaNaConversa: false })?.id !== 'voltou-por-outro-anuncio',
    'voltou por um anuncio cujo modelo NUNCA saiu: nao e esta regra');

  // Os dois desfechos que ele descreveu, escolhidos pelo que ja saiu.
  const r = com({ voltouPorOutroAnuncio: true, modeloJaNaConversa: true });
  check(r?.tecla === '5', 'momento ainda nao enviado, sugere a mensagem do momento = ' + JSON.stringify(r));
  check(String(r?.motivo).includes('outro an'), 'o motivo diz que voltou por anuncio = ' + r?.motivo);

  const jaFoi = com({ voltouPorOutroAnuncio: true, modeloJaNaConversa: true, momentoJaEnviado: true });
  check(jaFoi?.tecla === '3', 'momento ja enviado, sugere concluir = ' + JSON.stringify(jaFoi));

  const semMomento = com({ voltouPorOutroAnuncio: true, modeloJaNaConversa: true, podeMandarMomento: false });
  check(semMomento?.tecla === '3', 'sem mensagem do momento configurada, sugere concluir');

  // Vence "sem etiqueta de cidade", que sugeriria justamente pedir dados de novo.
  check(r?.tecla !== '4', 'nao sugere pedir dados de novo');

  // Print do Telmo: cidade Viamao, modelo enviado as 10:28, voltou por anuncio as 18:24 -- e a
  // rodada sugeria mandar o modelo de novo. Ter cidade nao muda o que a pessoa acabou de fazer.
  check(com({ voltouPorOutroAnuncio: true, modeloJaNaConversa: true, temEtiquetaDeCidade: true })?.id === 'voltou-por-outro-anuncio',
    'com cidade a regra casa igual');
  check(com({ voltouPorOutroAnuncio: true, modeloJaNaConversa: true, momentoJaEnviado: true, podeEnviar: true, conteudoPedido: 'ADS' })?.tecla === '3',
    'vence o modelo: nao manda o mesmo conteudo de novo');

  // E audio continua ganhando: quem falou merece resposta.
  check(com({ voltouPorOutroAnuncio: true, modeloJaNaConversa: true, pedeRespostaPessoal: { motivo: 'audio' } })?.tecla === '6',
    'audio vence o retorno por anuncio');
}


grupo('so se despediu: concluir');
{
  const r = com({ ultimaEhDespedida: true });
  check(r?.tecla === '3', 'recomendou concluir = ' + JSON.stringify(r));

  // O caso da print: ela JA tinha recebido o conteudo e escreveu "É nós" horas depois. Mandar o
  // modelo de novo ali e responder despedida com propaganda.
  check(com({ ultimaEhDespedida: true, podeEnviar: true, conteudoPedido: 'ADS' })?.tecla === '3',
    'vence o modelo a enviar');
  check(com({ ultimaEhDespedida: true, nomeSemSentido: true })?.tecla === '3', 'vence pedir dados');

  // Mas audio continua ganhando: "valeu" falado num audio de um minuto e outra coisa.
  check(com({ ultimaEhDespedida: true, pedeRespostaPessoal: { motivo: 'audio' } })?.tecla === '6',
    'audio vence a despedida');
}


grupo('ja respondida e mandou so um link: concluir');
{
  // Print do Paulo Quevedo: resposta longa dele as 09:29, link do TikTok dela as 14:43. Mandar a
  // mensagem do momento ali e empilhar uma segunda mensagem nossa em cima da que ela nem comentou.
  const r = com({ ultimaEhSoReacao: true, respondidoHoje: true });
  check(r?.tecla === '3', 'ja respondida hoje, sugere concluir = ' + JSON.stringify(r));
  check(String(r?.motivo).includes('respondeu hoje'), 'o motivo diz que voce ja respondeu');

  // Sem ter respondido hoje, continua sendo a mensagem do momento.
  check(com({ ultimaEhSoReacao: true })?.tecla === '5', 'sem resposta hoje, manda o momento');

  // Sem mensagem do momento configurada tambem conclui, em vez de nao sugerir nada.
  check(com({ ultimaEhSoReacao: true, podeMandarMomento: false })?.tecla === '3', 'sem momento, conclui');
}


grupo('modelo ja esta na conversa: nao sugere mandar de novo');
{
  // Print dele: o modelo estava na tela algumas mensagens acima, e a caixa sugeria mandar. O
  // registro de envios nao viu porque quem mandou foi a automacao da plataforma, nao o painel.
  const enviavel = { podeEnviar: true, conteudoPedido: 'ADS' };
  check(com(enviavel)?.tecla === '1', 'sem estar na conversa, sugere mandar');
  check(com({ ...enviavel, modeloJaNaConversa: true })?.id !== 'conteudo-pedido',
    'ja na conversa, nao sugere mandar de novo');

  // E sem cidade, o que sobra e pedir os dados — nao mandar o modelo duas vezes.
  check(com({ ...enviavel, modeloJaNaConversa: true, nomeSemSentido: true })?.tecla === '4',
    'cai para pedir dados');
}


grupo('veio do anuncio e nunca pedimos os dados dela');
{
  // Print da Sonia: nome de verdade (a regra do nome nao pega), conteudo pedido (a regra do
  // modelo pega e manda), e o formulario nunca tinha saido. "bastante contatos que vieram de
  // anuncio sem pedir dados ao iniciar".
  const nunca = { jaPediramDados: false, temEtiquetaDeCidade: false };
  const r = com(nunca);
  check(r?.tecla === '4', 'recomendou pedir os dados = ' + JSON.stringify(r));
  check(String(r?.motivo).includes('nunca pedimos o nome e a cidade'), 'o motivo diz, sem jargao, que nunca pedimos os dados');

  /**
   * A distincao que faltava: o pedido de dados nunca e PULADO em favor do modelo.
   *
   * Desde 02/09/2026 os dois saem na MESMA passada (tecla `a`, escolha dele) quando as duas metades
   * cabem. A intencao do teste e a mesma de antes -- o que mudou e que o modelo nao precisa mais
   * esperar a passada seguinte.
   */
  check(com({ ...nunca, podeEnviar: true, conteudoPedido: 'ADS' })?.tecla === 'a',
    'nunca perguntado, com modelo: saem os DOIS na mesma passada');
  check(com({ jaPediramDados: true, temEtiquetaDeCidade: false, podeEnviar: true, conteudoPedido: 'ADS' })?.tecla === '1',
    'ja perguntado e ignorou: manda o modelo, nao insiste');

  // Ja tem cidade: nao precisa do formulario mesmo que nunca tenha saido.
  check(com({ jaPediramDados: false, temEtiquetaDeCidade: true })?.id !== 'nunca-pediram-dados',
    'com cidade nao precisa pedir');

  // Pedido hoje nao repete.
  check(com({ ...nunca, pedidoHoje: true })?.id !== 'nunca-pediram-dados', 'ja pedido hoje nao repete');

  // Audio continua ganhando.
  check(com({ ...nunca, pedeRespostaPessoal: { motivo: 'audio' } })?.tecla === '6', 'audio vence');
}


grupo('emoji como PRIMEIRA mensagem de quem veio do anuncio: pedir dados vence a reacao');
{
  /**
   * Print da Marta (31/08): veio do anuncio, mandou so um emoji, sem cidade e sem nunca ter
   * recebido o formulario. A caixa sugeria a mensagem do momento — *"nesse caso a pessoa
   * respondeu o anuncio com um emoji, eu tenho que pedir os dados"*.
   */
  const marta = com({
    ultimaEhSoReacao: true,
    jaPediramDados: false,
    temEtiquetaDeCidade: false,
    podeEnviar: true,
    conteudoPedido: 'ADS',
  });
  check(marta?.tecla === 'a', 'o emoji nao pula o pedido de dados: ' + JSON.stringify(marta));
  check(marta?.id === 'anuncio-modelo-e-dados', 'e casa a regra que manda o modelo E pede os dados');

  // Sem modelo mapeado a composta nao cabe, e o pedido de dados sai sozinho -- como sempre saiu.
  const semModelo = com({ ultimaEhSoReacao: true, jaPediramDados: false, temEtiquetaDeCidade: false, podeEnviar: false });
  check(semModelo?.id === 'nunca-pediram-dados', 'sem modelo, quem pede os dados continua sendo a regra antiga');

  /**
   * O contra-teste, que e o que impede a troca de ordem de estragar o caso original.
   *
   * Quem JA recebeu o formulario tem conversa, e responder emoji dele com "me manda seu nome e
   * cidade" e o robo que a regra de baixo existe para evitar. Continua caindo na reacao.
   */
  check(com({ ultimaEhSoReacao: true, jaPediramDados: true, temEtiquetaDeCidade: false })?.tecla === '5',
    'ja pediram: o emoji continua indo para a mensagem do momento');

  // Ter cidade tambem basta para nao cair no pedido de dados.
  check(com({ ultimaEhSoReacao: true, jaPediramDados: false, temEtiquetaDeCidade: true })?.tecla === '5',
    'com cidade, o emoji vai para a mensagem do momento');

  // Pedido hoje nao se repete, mesmo com emoji e sem cidade.
  check(com({ ultimaEhSoReacao: true, jaPediramDados: false, temEtiquetaDeCidade: false, pedidoHoje: true })?.tecla === '5',
    'ja pedido hoje: nao insiste, cai na reacao');

  // Audio continua vencendo tudo menos a etiqueta que dispensa.
  check(com({ ultimaEhSoReacao: true, jaPediramDados: false, temEtiquetaDeCidade: false, pedeRespostaPessoal: { motivo: 'audio' } })?.tecla === '6',
    'audio vence o pedido de dados');
}


grupo('pergunta-aberta: vence o modelo, perde para as regras de cima');
{
  const P = { motivo: 'pergunta' };

  // Print da Clair: tinha conteudo mapeado, e o modelo vencia.
  const clair = com({ perguntaAberta: P, podeEnviar: true, conteudoPedido: 'ADS' });
  check(clair?.tecla === '6', 'a pergunta vence o modelo: ' + JSON.stringify(clair));
  check(clair?.id === 'pergunta-aberta', 'e e a regra da pergunta');

  // Perde para tudo que ja estava certo acima dela.
  check(com({ perguntaAberta: P, etiquetaQueDispensa: 'engajado' })?.id === 'etiqueta-dispensa-da-fila', 'etiqueta dispensa vence');
  check(com({ perguntaAberta: P, pedeRespostaPessoal: { motivo: 'audio' } })?.tecla === '6', 'audio tambem manda para 6');
  check(com({ perguntaAberta: P, ultimaEhDespedida: true })?.tecla === '3', 'despedida vence');
  check(com({ perguntaAberta: P, jaPediramDados: false, temEtiquetaDeCidade: false })?.tecla === '4', 'pedir dados vence');

  // Sem pergunta, nada muda.
  check(com({ podeEnviar: true, conteudoPedido: 'ADS' })?.id === 'conteudo-pedido', 'sem pergunta o modelo continua indo');
}


grupo('so-expressa-apoio: e a EXCECAO, e vence o modelo quando casa');
{
  const A = { motivo: 'apoio' };

  /**
   * Print do Ciro (31/08), e uma reversao do mesmo dia.
   *
   * De manha eu pus esta regra ABAIXO de `conteudo-pedido`, argumentando que agradecer antes de
   * entregar engoliria o pedido. Ele desfez: *"a prioridade e responder o que foi falado, depois
   * mandar modelo"*. Quem escreveu uma mensagem propria espera resposta aquilo; o material vai na
   * rodada seguinte.
   */
  const ciro = com({ soExpressaApoio: A, podeEnviar: true, conteudoPedido: 'ADS' });
  check(ciro?.tecla === 'i', 'o apoio VENCE o modelo: ' + JSON.stringify(ciro));
  check(ciro?.id === 'so-expressa-apoio', 'e e a regra do apoio');

  /**
   * **O que impede isto de engolir o pedido e o TAMANHO, nao a ordem.**
   *
   * Ele explicou: *"sao dois tipos de agradecimento… agradecer o apoio e um adicional, uma
   * excecao a regra; se nao tivesse o texto de baixo eu mandaria o modelo, agradeceria a atencao
   * e encerraria"*. Apoio curto nao chega em `soExpressaApoio` (ver `APOIO_ELABORADO`), entao
   * `soExpressaApoio` vem nulo e a tecla 1 continua sendo o desfecho — com o agradecimento pela
   * ATENCAO, que ja sai junto do modelo.
   */
  check(com({ soExpressaApoio: null, podeEnviar: true, conteudoPedido: 'ADS' })?.id === 'conteudo-pedido',
    'apoio curto (nulo aqui) segue recebendo modelo + agradecimento pela atencao');

  // Perde para tudo que ja estava certo acima dela.
  check(com({ soExpressaApoio: A, pedeRespostaPessoal: { motivo: 'audio' } })?.tecla === '6', 'audio vence');
  check(com({ soExpressaApoio: A, ultimaEhDespedida: true })?.tecla === '3', 'despedida vence');
  check(com({ soExpressaApoio: A, jaPediramDados: false, temEtiquetaDeCidade: false })?.tecla === '4', 'pedir dados vence');
  check(com({ soExpressaApoio: A, etiquetaQueDispensa: 'engajado' })?.id === 'etiqueta-dispensa-da-fila', 'etiqueta dispensa vence');
  check(com({ soExpressaApoio: A, perguntaAberta: { motivo: 'p' } })?.tecla === '6', 'pergunta vence: responder a pergunta e mais urgente que agradecer');
}

grupo('repasse nao pede formulario, mas reacao continua pedindo');
{
  /**
   * Print do Odone (31/08): 76 links de video em semanas, sem cidade e sem formulario enviado.
   * A rodada oferecia o formulario a cada passada, e ele nunca ia responder — nao esta
   * conversando, esta repassando. *"links em geral devem ser ignorados"*.
   */
  const odone = com({ rajadaEhSoRepasse: true, jaPediramDados: false, temEtiquetaDeCidade: false, ultimaEhSoReacao: true });
  check(odone?.id !== 'nunca-pediram-dados', 'repasse NAO pede o formulario: ' + JSON.stringify(odone));

  /**
   * O contra-teste, e e ele que impede a mudanca de ir longe demais: a Marta respondeu o anuncio
   * com um emoji, sem cidade e sem formulario — e ali pedir os dados continua sendo o certo.
   */
  const marta = com({ rajadaEhSoRepasse: false, jaPediramDados: false, temEtiquetaDeCidade: false, ultimaEhSoReacao: true });
  check(marta?.tecla === '4', 'reacao dirigida a ele continua pedindo os dados');

  // Quem tem texto de verdade tambem continua.
  check(com({ rajadaEhSoRepasse: false, jaPediramDados: false, temEtiquetaDeCidade: false })?.tecla === '4',
    'sem repasse, o formulario segue como antes');
}


grupo('pediu-algo-sem-dizer-o-que: a regra de maior risco, e fica no alto');
{
  const P = { motivo: 'pediu algo', trecho: 'Preciso da forca do senhor' };

  // Print da Mari: tinha conteudo mapeado, e o modelo vencia.
  const mari = com({ pedeAlgoIndefinido: P, podeEnviar: true, conteudoPedido: 'ADS' });
  /**
   * **A tecla virou 6 em 03/09**, decisao dele depois da print da Odete: *"ja que pedido e algo
   * dificil de ser identificado, sera agora pra mim ou IA responder"*.
   *
   * Ajustar o padrao conserta o caso e nao conserta a classe: "pedido" e intencao, nao forma de
   * frase, e toda tentativa de cerca-la por texto erra para um dos dois lados -- pergunta em cima
   * de quem ja explicou, ou modelo em cima de quem pede socorro. O que a regra protege nao mudou:
   * ela continua no alto e continua impedindo que as caixas de baixo enviem.
   */
  check(mari?.tecla === '6', 'o caso fica com ele ou com a IA: ' + JSON.stringify(mari));
  check(/Preciso da forca/.test(mari?.motivo), 'e o motivo mostra o trecho, para ele conferir');
  check(sugestaoLib.SOBRE['pediu-algo-sem-dizer-o-que'].efeito === 'gente', 'o verbete diz "gente", nao "envia"');

  /**
   * **Sem `podePerguntarAjuda`**: a guarda existia porque a regra DISPARAVA aquele texto. Agora
   * ela nao manda nada, e condicionar o desfecho a saude de um template que nao vai sair deixaria
   * o caso de maior risco do arquivo escapar para as caixas de baixo, que enviam.
   */
  check(com({ pedeAlgoIndefinido: P, podePerguntarAjuda: false, podeEnviar: true })?.tecla === '6',
    'decide mesmo com o texto da pergunta travado');

  /**
   * **Vence a despedida de proposito.** "Preciso da sua forca, abraco" tem despedida dentro, e
   * concluir ali e fechar a porta na cara de um pedido.
   */
  check(com({ pedeAlgoIndefinido: P, ultimaEhDespedida: true })?.tecla === '6', 'vence a despedida');
  check(com({ pedeAlgoIndefinido: P, ultimaEhSoReacao: true })?.tecla === '6', 'vence a reacao');
  check(com({ pedeAlgoIndefinido: P, soExpressaApoio: { motivo: 'a' } })?.tecla === '6', 'vence o apoio');
  check(com({ pedeAlgoIndefinido: P, jaPediramDados: false, temEtiquetaDeCidade: false })?.tecla === '6', 'vence pedir dados');

  /**
   * So duas coisas passam na frente, e as duas por boa razao: a etiqueta que dispensa da fila
   * (decisao explicita dele) e o audio, que precisa ser ouvido antes de qualquer decisao.
   */
  check(com({ pedeAlgoIndefinido: P, pedeRespostaPessoal: { motivo: 'audio' } })?.tecla === '6', 'audio vence: ouca primeiro');
  check(com({ pedeAlgoIndefinido: P, etiquetaQueDispensa: 'engajado' })?.id === 'etiqueta-dispensa-da-fila', 'etiqueta dispensa vence');

  /**
   * Sem o texto da pergunta (variavel faltando, ou a resposta apagada), a tecla nao pode ser
   * recomendada — senao a caixa aponta para uma opcao que nao esta na tela.
   */
  check(com({ pedeAlgoIndefinido: P, podePerguntarAjuda: false })?.tecla !== '9', 'sem o texto, nao recomenda a 9');

  // Sem pedido, nada muda.
  check(com({ podeEnviar: true, conteudoPedido: 'ADS' })?.id === 'conteudo-pedido', 'sem pedido o modelo continua indo');
}


grupo('ja-respondemos-antes: o modelo e a entrega INICIAL');
{
  /**
   * Print do Cris (31/08): historico grande, etiquetas de conteudo, e a caixa sugerindo mandar o
   * modelo. *"historico de conversa grande provavelmente ja recebeu modelo de mensagem, vou mandar
   * mensagem do momento"*.
   *
   * Quem ja foi atendido e volta dizendo que apoia nao esta pedindo o material de novo — esta
   * aparecendo. Modelo repetido parece que ninguem olhou o historico.
   */
  const cris = com({ jaRespondemosAntes: true, podeEnviar: true, conteudoPedido: 'ADS' });
  check(cris?.tecla === '5', 'manda a mensagem do momento: ' + JSON.stringify(cris));
  check(cris?.id === 'ja-respondemos-antes', 'e e a regra nova');

  /**
   * **O contra-teste que preserva o proposito do modelo:** na PRIMEIRA vez, ele vai. E a entrega
   * que a pessoa pediu ao clicar no anuncio.
   */
  check(com({ jaRespondemosAntes: false, podeEnviar: true, conteudoPedido: 'ADS' })?.id === 'conteudo-pedido',
    'primeira vez: o modelo vai');

  /**
   * O desfecho vira CONCLUIR nos tres casos em que mais uma mensagem nossa seria empilhar em cima
   * do que ela ainda nao comentou. Mesmo desenho da regra da reacao.
   */
  check(com({ jaRespondemosAntes: true, respondidoHoje: true })?.tecla === '3', 'ja respondemos hoje: conclui');
  check(com({ jaRespondemosAntes: true, momentoJaEnviado: true })?.tecla === '3', 'momento ja enviado: conclui');
  check(com({ jaRespondemosAntes: true, podeMandarMomento: false })?.tecla === '3', 'sem momento configurado: conclui');

  // Perde para tudo que fala do que ela acabou de dizer.
  check(com({ jaRespondemosAntes: true, soExpressaApoio: { motivo: 'a' } })?.tecla === 'i',
    'apoio proprio vence: responder a ela e melhor que a mensagem da semana');
  check(com({ jaRespondemosAntes: true, pedeAlgoIndefinido: { trecho: 'x' } })?.tecla === '6', 'pedido indefinido vence');
  check(com({ jaRespondemosAntes: true, perguntaAberta: { motivo: 'p' } })?.tecla === '6', 'pergunta vence');
  check(com({ jaRespondemosAntes: true, pedeRespostaPessoal: { motivo: 'a' } })?.tecla === '6', 'audio vence');
  check(com({ jaRespondemosAntes: true, ultimaEhDespedida: true })?.tecla === '3', 'despedida vence');
}

grupo('respondeu-nossa-pergunta: propaganda em cima de denuncia (01/09/2026)');
{
  /**
   * O pior caso que este projeto produziu. A rodada perguntou "em que voce precisa de ajuda?" as
   * 14:22; a contato respondeu as 16:19 que era "sobre as irregularidades sobre compra assistida
   * em eldorado do sul", e recebeu MATERIAL DE CAMPANHA -- porque nenhuma regra reconhecia a
   * resposta a uma pergunta nossa, e o caso caia ate `conteudo-pedido`, que ENVIA.
   */
  const denuncia = { trecho: 'e sobre as irregularidades sobre compra assistida em eldorado do sul' };

  // O contexto REAL do print: veio de anuncio, logo tem conteudo mapeado e modelo a enviar.
  const r = sugerirAcao({ respondeuComoAjudar: denuncia, podeEnviar: true, conteudoPedido: 'ADS', podePerguntarAjuda: true });
  check(r?.id === 'respondeu-nossa-pergunta', `venceu a regra certa: ${r?.id}`);
  check(r?.tecla === '6', 'tecla 6: responder a mao');
  check(/irregularidades/.test(r?.motivo || ''), 'o motivo mostra o que ela escreveu');

  // O contraste que importa: sem o sinal, o MESMO contexto volta a mandar o modelo.
  const semSinal = sugerirAcao({ podeEnviar: true, conteudoPedido: 'ADS', podePerguntarAjuda: true });
  check(semSinal?.id === 'conteudo-pedido', `sem o sinal ainda seria: ${semSinal?.id}`);

  // Nao pode perguntar DE NOVO o que ela acabou de responder.
  const ambos = sugerirAcao({ respondeuComoAjudar: denuncia, pedeAlgoIndefinido: { trecho: 'preciso de ajuda' }, podePerguntarAjuda: true });
  check(ambos?.id === 'respondeu-nossa-pergunta', 'vence pediu-algo-sem-dizer-o-que');

  // Audio continua na frente: ouvir vem antes de qualquer decisao.
  const comAudio = sugerirAcao({ respondeuComoAjudar: denuncia, pedeRespostaPessoal: { motivo: 'mandou um audio' } });
  check(comAudio?.id === 'ultima-pede-resposta-pessoal', 'o audio continua vencendo');

  // E a recusa continua acima de tudo.
  const comRecusa = sugerirAcao({ respondeuComoAjudar: denuncia, semInteresse: { motivo: 'pediu para nao receber mais' } });
  check(comRecusa?.id === 'sem-interesse', 'sem interesse continua em primeiro');
}

grupo('o FLUXO editavel: ordem, tecla e ligar/desligar (01/09/2026)');
{
  const { REGRAS, SOBRE, ordenar, regrasSemVerbete } = sugestaoLib;
  const todas = REGRAS.map((r) => r.id);
  const ctx = { jaRespondemosAntes: true, podeEnviar: true, enviadoHoje: false, modeloJaNaConversa: false };

  // Sem configuracao, nada muda: a janela nascer em branco nao altera comportamento.
  check(ordenar().length === REGRAS.length, 'sem config, devolve o codigo puro');
  check(ordenar({}).map((r) => r.id).join() === todas.join(), 'config vazia mantem a ordem do codigo');
  check(sugerirAcao(ctx)?.id === 'ja-respondemos-antes', 'e a regra vencedora e a do codigo');

  // REORDENAR: e o caso que motivou a janela -- "mandou a do momento onde devia mandar o modelo".
  const conteudoPrimeiro = ['conteudo-pedido', ...todas.filter((i) => i !== 'conteudo-pedido')];
  check(sugerirAcao(ctx, { ordem: conteudoPrimeiro })?.id === 'conteudo-pedido', 'arrastar conteudo-pedido para o topo muda quem vence');

  /**
   * Id REPETIDO na ordem salva tem que valer pela PRIMEIRA aparicao. Sem a deduplicacao, o Map
   * por indice dava a posicao da ULTIMA -- e na tela isso apareceria como "arrastei e nao mudou".
   */
  check(sugerirAcao(ctx, { ordem: ['conteudo-pedido', ...todas] })?.id === 'conteudo-pedido', 'id repetido vale pela primeira aparicao');

  // DESLIGAR: a regra some e as de baixo passam a ser olhadas.
  check(sugerirAcao({ ultimaEhDespedida: true })?.id === 'ultima-e-despedida', 'ligada, a despedida vence');
  check(sugerirAcao({ ultimaEhDespedida: true }, { desligadas: ['ultima-e-despedida'] }) === null, 'desligada, ela nao vence mais');

  // TROCAR A TECLA: a escolha dele vence a do codigo.
  const t = sugerirAcao({ ultimaEhDespedida: true }, { teclas: { 'ultima-e-despedida': '2' } });
  check(t?.tecla === '2', `tecla trocada: ${t?.tecla}`);
  check(t?.id === 'ultima-e-despedida', 'e a regra continua sendo a mesma');

  /**
   * **REGRA NOVA DO CODIGO ENTRA NA POSICAO DO CODIGO, NAO NO FIM.**
   *
   * Esta e a assercao que protege contra um defeito silencioso na atualizacao: quem ja tem ordem
   * salva receberia a regra nova em ultimo lugar. A `respondeu-nossa-pergunta` nasceu para impedir
   * propaganda em cima de denuncia; no fim da fila ela nunca venceria, e o defeito voltaria calado.
   */
  const semANova = todas.filter((i) => i !== 'respondeu-nossa-pergunta');
  const reordenada = ordenar({ ordem: semANova }).map((r) => r.id);
  check(reordenada.length === REGRAS.length, 'a regra que a ordem salva nao conhece nao desaparece');
  check(
    reordenada.indexOf('respondeu-nossa-pergunta') === REGRAS.findIndex((r) => r.id === 'respondeu-nossa-pergunta'),
    `entra na posicao do codigo (${reordenada.indexOf('respondeu-nossa-pergunta')})`
  );

  // Toda regra precisa de verbete, senao a janela mostra linha muda.
  check(regrasSemVerbete().length === 0, `toda regra tem verbete (faltando: ${JSON.stringify(regrasSemVerbete())})`);
  const efeitos = new Set(Object.values(SOBRE).map((s) => s.efeito));
  check([...efeitos].every((e) => ['envia', 'silencio', 'gente', 'depende'].includes(e)), `efeitos validos: ${[...efeitos].join()}`);
}

grupo('o mapa RAMIFICADO da janela: cada regra tem os dois galhos (01/09/2026)');
{
  const { REGRAS, SOBRE, TECLAS, ramosDaRegra, efeitoDaRegra, regrasComDesfechoIncoerente } = sugestaoLib;

  /**
   * O mapa da janela desenha, ao lado de cada regra, o DESFECHO dela -- a tecla e o que o eleitor
   * recebe por ela. Isto exige tres coisas fecharem, e as tres sao conferidas aqui: toda tecla
   * usada tem verbete, toda regra de tecla-funcao escreve os dois lados, e o selo do cartao
   * concorda com o que a tecla faz. Sem esta assercao, um cartao pode dizer "sai mensagem" numa
   * regra que conclui em silencio, e ele decidiria a ORDEM olhando um mapa mentiroso.
   */
  check(regrasComDesfechoIncoerente().length === 0, `desfechos coerentes (${JSON.stringify(regrasComDesfechoIncoerente())})`);

  const efeitosDeTecla = new Set(Object.values(TECLAS).map((t) => t.efeito));
  check([...efeitosDeTecla].every((e) => ['envia', 'silencio', 'gente', 'depende'].includes(e)), 'as teclas usam o mesmo vocabulario de efeito');

  // Regra de tecla fixa: um galho so, e ele e a tecla do codigo.
  const um = ramosDaRegra('conteudo-pedido');
  check(um.length === 1 && um[0].tecla === '1', `conteudo-pedido tem um desfecho so (${JSON.stringify(um.map((r) => r.tecla))})`);

  /**
   * **Regra de tecla-funcao tem que ter os dois lados ESCRITOS, e exatamente os que a funcao
   * devolve.** Este e o teste que impede o mapa envelhecer calado: mexer na funcao sem mexer no
   * verbete deixa a janela prometendo um desfecho que o codigo nao produz mais.
   */
  for (const r of REGRAS.filter((x) => typeof x.tecla === 'function')) {
    /**
     * **A matriz precisa cobrir os campos que as funcoes LEEM.** Faltando um, a tecla que depende
     * dele nunca aparece e o teste acusa o mapa de "inventar" um desfecho que existe de verdade --
     * foi o que aconteceu com o tempo em 03/09. Campo novo numa tecla-funcao entra aqui.
     */
    const daFuncao = new Set();
    for (let m = 0; m < 32; m++) {
      daFuncao.add(r.tecla({
        respondidoHoje: !!(m & 1),
        momentoJaEnviado: !!(m & 2),
        podeMandarMomento: !!(m & 4),
        deOutroDia: !!(m & 8),
        perguntaPendente: !!(m & 16),
      }));
    }
    const noMapa = new Set(ramosDaRegra(r.id).map((x) => x.tecla));
    check([...daFuncao].every((t) => noMapa.has(t)), `${r.id}: o mapa cobre todo desfecho da funcao (funcao: ${[...daFuncao].join()}, mapa: ${[...noMapa].join()})`);
    check([...noMapa].every((t) => daFuncao.has(t)), `${r.id}: e nao inventa desfecho que a funcao nao produz`);
    check(ramosDaRegra(r.id).every((x) => x.se), `${r.id}: cada galho diz em que caso ele vale`);
  }

  /**
   * **Fixar a tecla colapsa a bifurcacao E muda o efeito.** O `efeito` do verbete e o do codigo;
   * quem fixa a tecla 's' numa regra rotulada "envia" faz o cartao prometer o contrario do que
   * vai acontecer. O mapa mostra a tecla efetiva, e `sugerirAcao` confirma que e ela que sai.
   */
  const fixada = { teclas: { 'conteudo-pedido': 's' } };
  const colapsado = ramosDaRegra('conteudo-pedido', fixada);
  check(colapsado.length === 1 && colapsado[0].fixada === true, 'tecla fixada colapsa a bifurcacao num galho so');
  check(SOBRE['conteudo-pedido'].efeito === 'envia', 'o verbete do codigo diz "envia"');
  check(efeitoDaRegra('conteudo-pedido', fixada) === 'silencio', 'e com a tecla fixada o cartao passa a dizer "silencio"');
  check(sugerirAcao({ ...base, podeEnviar: true }, fixada)?.tecla === 's', 'que e o que a rodada realmente faria');

  // Regra desconhecida nao explode: a janela desenha o que existe, nao o que ela imagina.
  check(ramosDaRegra('nao-existe').length === 0, 'id inexistente devolve lista vazia');
}

grupo('mostrarTecla: maiuscula na TELA, minuscula na comparacao (02/09/2026)');
{
  /**
   * Pedido dele: *"troque a opcao a por A maiusculo para ficar destacado, mas so na visualizacao;
   * no teclado pode ser a minusculo"*. O risco desta mudanca e a maiuscula VAZAR para a
   * comparacao -- `sugestao.tecla === 'a'` esta espalhado pelo painel e pela arvore, e um 'A'
   * chegando ali faria a rodada dizer "tecla nao disponivel" em todo contato de anuncio.
   */
  const { mostrarTecla, TECLAS } = sugestaoLib;

  check(mostrarTecla('a') === 'A', 'a letra sobe');
  check(mostrarTecla('s') === 'S', 'o s tambem');
  check(mostrarTecla('f') === 'F', 'e o f do ramo com resposta pronta');
  check(mostrarTecla('1') === '1', 'digito nao muda');

  // Nulo e indefinido viram texto vazio: quem escreve na tela nao pode explodir por falta de dado.
  check(mostrarTecla(null) === '', 'nulo vira vazio, nao "null"');
  check(mostrarTecla(undefined) === '', 'indefinido tambem');

  /**
   * **A trava que importa:** as chaves da tabela continuam minusculas. Se alguem "arrumar" a
   * TECLAS para bater com a tela, todo `=== 'a'` do painel para de casar de uma vez.
   */
  for (const k of Object.keys(TECLAS)) {
    check(k === k.toLowerCase(), `a chave "${k}" continua minuscula na tabela`);
  }
  check(!!TECLAS.a && !TECLAS.A, 'a tecla do anuncio e "a", nunca "A"');
}

grupo('conclua e nao mande nada (03/09/2026)');
{
  /**
   * Dois pedidos dele no mesmo dia, e os dois sobre NAO mandar:
   *
   *  - print da conversa que tinha so o nosso disparo, com a rodada mandando o pedido de nome e
   *    cidade em cima: *"pegando conversas que a ultima mensagem foi minha e mandando mensagem, e
   *    pra concluir sem mandar nada"*;
   *  - *"contatos com etiqueta de assessor so conclua"*.
   */
  const nossa = com({ ultimaEhNossa: true, podeEnviar: true, conteudoPedido: 'ADS' });
  check(nossa?.id === 'ultima-e-nossa' && nossa?.tecla === '3', 'ultima nossa: conclui = ' + JSON.stringify(nossa));

  // O caso que escapava de tudo: ela nunca escreveu, entao `decidirSemResposta` nao tem o que ver.
  const vazia = com({ ultimaEhNossa: 'vazia', podeEnviar: true, podePedirDados: true });
  check(vazia?.tecla === '3', 'conversa em que ela nunca escreveu: conclui');
  check(String(vazia?.motivo).includes('nao escreveu') || String(vazia?.motivo).includes('não escreveu'),
    'e o motivo diz qual dos dois casos e');

  // Vence tudo que ENVIA -- era o defeito da print.
  check(com({ ultimaEhNossa: true, podePedirDados: true, jaPediramDados: false })?.tecla === '3', 'vence o pedido de dados');
  check(com({ ultimaEhNossa: true, soCortesia: { motivo: 'bom dia' }, podeMandarMomento: true })?.tecla === '3', 'vence a mensagem do momento');

  // Mas a recusa continua acima: la a etiqueta importa.
  check(com({ ultimaEhNossa: true, semInteresse: { motivo: 'pediu para sair' } })?.id === 'sem-interesse', 'a recusa continua vencendo');

  // Etiqueta de assessor: conclui, e vence ate a que dispensa da fila.
  const casa = com({ etiquetaSoConclui: 'Assessor', podeMandarMomento: true });
  check(casa?.id === 'etiqueta-so-conclui' && casa?.tecla === '3', 'assessor: conclui = ' + JSON.stringify(casa));
  check(String(casa?.motivo).includes('Assessor'), 'o motivo nomeia a etiqueta');
  check(com({ etiquetaSoConclui: 'Assessor', etiquetaQueDispensa: 'engajado', podeMandarMomento: true })?.id === 'etiqueta-so-conclui',
    'com as duas etiquetas, o desfecho mais silencioso ganha');
}

grupo('jaDeuNomeECidade: nao peca o que ela acabou de escrever (03/09/2026)');
{
  /**
   * Anotacao do Plauto: a ultima mensagem dele era *"Plauto Velho, cidade Sao Leopoldo"* -- nome e
   * cidade, sem ninguem ter pedido -- e a caixa sugeria a tecla 4, *"peca os dados esta vez"*.
   * Ele: *"ja foi pedido dados, seria agradecer e encerrar"*.
   *
   * As guardas que existiam olhavam o CRM e o nosso historico, e as duas podem ser falsas no exato
   * momento em que ela responde: a etiqueta ainda nao existe, e a pergunta nunca saiu porque ela se
   * adiantou.
   */
  const plauto = { jaPediramDados: false, temEtiquetaDeCidade: false, podePedirDados: true, pedidoHoje: false };

  check(com({ ...plauto })?.id === 'nunca-pediram-dados', 'sem o sinal, o pedido de dados continua saindo');
  check(com({ ...plauto, jaDeuNomeECidade: true })?.id !== 'nunca-pediram-dados',
    'com nome e cidade escritos, o pedido NAO sai');

  /**
   * **Na chegada ele derruba so a metade do formulario.** `anuncio-modelo-e-dados` manda o recibo
   * E o pedido juntos; se ela ja se cadastrou, o recibo continua devido e o caso desce para
   * `conteudo-pedido`, que manda o modelo sozinho.
   */
  const chegada = { ...plauto, veioDeAnuncio: true, podeEnviar: true, enviadoHoje: false, modeloJaNaConversa: false };
  check(com({ ...chegada })?.id === 'anuncio-modelo-e-dados', 'sem o sinal: recibo + pedido na mesma passada');
  const jaSeCadastrou = com({ ...chegada, jaDeuNomeECidade: true });
  check(jaSeCadastrou?.id === 'conteudo-pedido', 'com o sinal: so o recibo, sem repetir o formulario');
  check(jaSeCadastrou?.tecla === '1', 'e a tecla e a do modelo sozinho');

  /**
   * **Nenhuma outra regra olha este sinal**, e e isso que o mantem barato: ele so BLOQUEIA o
   * pedido. Quem decide o desfecho continua sendo o quadro.
   */
  check(com({ soExpressaApoio: { motivo: 'x' }, jaDeuNomeECidade: true, jaPediramDados: true })?.id === 'so-expressa-apoio',
    'o sinal nao atrapalha quem ja tinha desfecho');
}

grupo('apoio: o TEMPO escolhe entre agradecer e a mensagem do momento (03/09/2026)');
{
  /**
   * Tres anotacoes pedindo a mesma coisa (Maria Geny, Tere e Gilmar, Jacira), e o criterio dele:
   * *"a questao e o contexto, a mensagem tem quanto tempo que mandou dando apoio; se foi no dia
   * anterior, e mensagem do momento; se foi recente, mensagem de apoio"*.
   */
  const A = { motivo: 'escreveu apoio' };
  const apoio = { soExpressaApoio: A, podeMandarMomento: true, momentoJaEnviado: false, jaPediramDados: true };

  check(com({ ...apoio })?.tecla === 'i', 'apoio de hoje: agradece');

  /**
   * **O TEMPO saiu daqui em 04/09.** Quatro anotacoes no mesmo lote mostraram que a razao nunca
   * teve a ver com apoio -- responder o conteudo de ontem soa a quem nao estava la, seja ele apoio,
   * cadastro ou piada politica. Quem decide agora e `contexto-de-outro-dia`, uma caixa acima.
   */
  check(com({ ...apoio, deOutroDia: true })?.id === 'contexto-de-outro-dia', 'de outro dia, quem decide e a caixa do tempo');
  check(com({ ...apoio, deOutroDia: true })?.tecla === '5', 'e ela manda a mensagem do momento');

  /**
   * **As duas guardas do momento sairam da CONDICAO e viraram DESFECHO em 06/09/2026** — print da
   * Noeli: ela escreveu *"Eu ja estou com voces.....bom dia"* no dia 05 e recebeu **o modelo da
   * campanha** no dia 06. *"ignorou a regra da perda de contexto e mandou modelo"*.
   *
   * A regra nao foi ignorada: ela nao CASOU. Com as guardas na `quando`, sem momento para mandar a
   * caixa saia da frente e "o quadro decidia como antes" — e decidir como antes, ali, era mandar o
   * modelo. **A guarda decide o DESFECHO, nao se a caixa casa**, que e o desenho que
   * `ultima-e-so-reacao` sempre teve.
   *
   * Estas duas assercoes diziam "volta a agradecer" e agora dizem "conclui": agradecer o apoio de
   * ONTEM e responder o conteudo de ontem, que e o que a caixa existe para impedir.
   */
  check(com({ ...apoio, deOutroDia: true, momentoJaEnviado: true })?.tecla === '3',
    'ja recebeu a do momento: conclui sem responder o de ontem');
  check(com({ ...apoio, deOutroDia: true, podeMandarMomento: false })?.tecla === '3',
    'sem mensagem do momento configurada: conclui, e nao cai para quem envia');
  check(com({ ...apoio, deOutroDia: true, momentoJaEnviado: true })?.id === 'contexto-de-outro-dia',
    'e quem decide continua sendo a caixa do tempo');

  // As duas saidas ENVIAM, entao o cartao da janela e verde nos dois casos.
  check(sugestaoLib.SOBRE['so-expressa-apoio'].efeito === 'envia', 'o efeito e "envia", nao "depende"');

  /**
   * **A unica coisa que passa por cima do tempo e pergunta pendente**, e ele disse isso na mesma
   * frase: *"unico pretexto que exclui a necessidade de hora e pergunta pendente, que deve ser
   * respondida"*. Vale por ORDEM: as duas caixas de pergunta ficam acima desta.
   */
  const P = { termo: 'por que' };
  check(com({ ...apoio, deOutroDia: true, perguntaAberta: P })?.id === 'pergunta-aberta',
    'pergunta de razao vence o tempo');
  check(com({ ...apoio, deOutroDia: true, pedeAlgoIndefinido: { motivo: 'x' } })?.id === 'pediu-algo-sem-dizer-o-que',
    'pediu algo sem dizer o que tambem vence');

  const ids = REGRAS.map((r) => r.id);
  for (const antes of ['pergunta-aberta', 'pediu-algo-sem-dizer-o-que']) {
    check(ids.indexOf(antes) < ids.indexOf('so-expressa-apoio'), `"${antes}" esta acima do apoio na tabela`);
  }
}

grupo('a tecla 8 e da IA, e NENHUMA regra a recomenda (03/09/2026)');
{
  /**
   * Pedido dele: *"era pra substituir o botao 8 com o chamar IA"*. As duas trocaram de lugar -- o
   * agradecimento foi para o `i` -- e e a troca que mantem isso seguro.
   *
   * **Se uma regra voltar a recomendar o 8, a rodada PARA em cada contato daquela regra**, porque
   * chamar a IA deixa o caso com ele (mesmo desfecho da tecla 6). Com o automatico ligado, isso
   * seria a fila inteira travada esperando alguem escrever.
   */
  const { TECLAS, ramosDaRegra } = sugestaoLib;
  check(!TECLAS['8'], 'o 8 nao esta na tabela de teclas que uma REGRA pode mandar apertar');
  check(!!TECLAS.i && TECLAS.i.rotulo.includes('Agradece'), 'e o agradecimento e o `i`');

  for (const r of REGRAS) {
    const teclas = typeof r.tecla === 'function'
      ? ramosDaRegra(r.id).map((x) => x.tecla)
      : [r.tecla];
    check(!teclas.includes('8'), `"${r.id}" nao recomenda o 8`);
  }

  // As duas regras que agradecem apontam para o `i`.
  check(com({ soExpressaApoio: { motivo: 'a' }, jaPediramDados: true })?.tecla === 'i', 'so-expressa-apoio manda agradecer no `i`');
  check(com({ respondeuOsDados: true })?.tecla === 'i', 'respondeu-os-dados tambem');
}

grupo('nada-legivel-dela: sem nenhuma informacao, pergunte o interesse (03/09/2026)');
{
  /**
   * Print do Tilin: a conversa inteira eram dois avisos *"Atencao: o tipo da mensagem enviada pelo
   * contato nao e suportado"* e um *"Numero privado"* -- sem texto, sem nome, sem cidade e sem nem
   * o telefone. A rodada mandou *"Para eu poder salvar seu numero me diga seu: Nome, Cidade"* e
   * concluiu. Ele: *"eu nao tenho nenhuma informacao nesse caso, entao e para perguntar se a pessoa
   * tem interesse em receber conteudo; a mensagem de nome e cidade ficou deslocada demais"*.
   *
   * *"Para eu poder salvar seu numero"* pressupoe uma conversa em andamento. A pergunta de
   * interesse cria o contexto que falta e ja pede nome e cidade na mesma mensagem, entao nada se
   * perde em relacao ao pedido seco.
   */
  const tilin = { soRuidoDaPlataforma: true, podePerguntarInteresse: true, interessePerguntado: false,
    jaPediramDados: false, temEtiquetaDeCidade: false, podePedirDados: true, pedidoHoje: false };

  check(com({ ...tilin, soRuidoDaPlataforma: false })?.id === 'nunca-pediram-dados', 'sem o sinal, o pedido de dados sai como antes');
  const r = com({ ...tilin });
  check(r?.id === 'nada-legivel-dela', 'com o sinal, quem decide e a caixa nova');
  check(r?.tecla === '7', 'e a tecla e a da pergunta de interesse');

  /**
   * **Abaixo do modelo, de proposito:** quem chega por anuncio com modelo mapeado recebe o recibo,
   * que responde melhor que qualquer pergunta.
   */
  check(com({ ...tilin, podeEnviar: true, enviadoHoje: false, modeloJaNaConversa: false })?.id !== 'nada-legivel-dela',
    'havendo modelo, o recibo vence');

  // Sem o texto da pergunta configurado, cai no pedido de dados -- que e o que ja acontecia.
  check(com({ ...tilin, podePerguntarInteresse: false })?.id === 'nunca-pediram-dados', 'sem o texto da pergunta, o pedido de dados continua');
  check(com({ ...tilin, interessePerguntado: true })?.id === 'nunca-pediram-dados', 'ja perguntado uma vez, nao insiste');
}

grupo('engajado: ja respondi hoje, nao manda nada (04/09/2026)');
{
  /**
   * Anotacao da Janete: ela tem a etiqueta "Engajado", mandou dois audios e clicou em dois
   * anuncios, e a caixa ofereceu a mensagem do momento. Ele: *"ja mandei mensagem hoje, mesmo nao
   * sendo do momento -- nao mandar quando ja respondi"*.
   *
   * A guarda que existia era `momentoJaEnviado`, que so sabe da mensagem do momento: quem
   * respondeu a mao, ou com outra resposta pronta, nao aparecia ali.
   */
  const base = { etiquetaQueDispensa: 'Engajado', podeMandarMomento: true };
  check(com({ ...base, respondidoHoje: true })?.tecla === '3', 'ja respondemos hoje: conclui, nada sai');
  check(String(com({ ...base, respondidoHoje: true })?.motivo).includes('já respondeu hoje'),
    'e o motivo diz por que');
  check(com(base)?.tecla === '5', 'sem ter respondido hoje, a mensagem do momento continua saindo');
  check(com({ ...base, momentoJaEnviado: true })?.tecla === '3', 'a guarda antiga continua valendo');
}

{
  grupo('"nao ha o que pedir" tem uma definicao so (05/09/2026)');

  /**
   * Print dele: o contato tinha etiqueta de cidade (Erechim) e recebeu as boas-vindas com o
   * *"nos informe Nome , Cidade"* dentro. *"ja tem os dados e pediu novamente"*.
   *
   * A conta que guarda o formulario (`nunca-pediram-dados`) passou a ser exportada, porque o
   * PAINEL precisa dela para escolher qual das duas redacoes de boas-vindas sai. Duas copias
   * divergem na primeira guarda nova, e a que ninguem olha e a que pede o cadastro de quem ja deu.
   */
  const { pedirDadosNaoCabe } = sugestaoLib;
  check(!pedirDadosNaoCabe({}), 'contato sem nada: o pedido cabe');
  check(pedirDadosNaoCabe({ temEtiquetaDeCidade: true }), 'com etiqueta de cidade, nao cabe');
  check(pedirDadosNaoCabe({ jaDeuNomeECidade: true }), 'tendo escrito nome e cidade, nao cabe');
  check(pedirDadosNaoCabe({ jaPediramDados: true }), 'ja tendo pedido, nao cabe -- pedir duas vezes soa a robo');

  // E a regra continua lendo a mesma conta: o quadro e o painel nao podem discordar.
  const regra = REGRAS.find((r) => r.id === 'nunca-pediram-dados');
  const base = { podePedirDados: true, veioDeAnuncio: true };
  check(regra.quando(base), 'a regra do formulario casa quando nao temos nada');
  check(!regra.quando({ ...base, temEtiquetaDeCidade: true }), 'e nao casa para quem ja tem etiqueta de cidade');
}

/**
 * MATERIAL PEDIDO NAO SE CONCLUI EM SILENCIO — print da Sadra (09/09/2026).
 *
 * Ela escreveu *"Quero umas. Camisetas"* e *"Dos meus candidatos"*, e o atendimento foi **concluido
 * sem nada sair**. Ele: *"nao identificou que ela queria algo"*.
 *
 * **Medido, e o detector estava certo:** `pedeMaterial` casou — o ponto no meio de *"Quero umas.
 * Camisetas"* nao atrapalha. O caso morreu em `ja-respondemos-antes`, porque ja tinhamos respondido
 * hoje e aquela caixa conclui.
 *
 * **`conteudo-pedido` nao salvava porque exige `podeEnviar`** — um modelo aprovado para mandar —, e
 * camiseta nao tem modelo: o que existe para material FISICO e o caminho da Jonice (08/09), pedir o
 * endereco e repassar a equipe. Nenhuma caixa levava a ele.
 *
 * **A guarda decide o DESFECHO e nao se a caixa casa** — licao da Noeli (06/09), e o que
 * `perguntaPendente` ja fazia na linha de cima.
 */
{
  grupo('material pedido nao se conclui em silencio (a Sadra, 09/09)');

  const base = {
    jaRespondemosAntes: true, respondidoHoje: true, momentoJaEnviado: true,
    podeMandarMomento: true, temEtiquetaDeCidade: true,
  };
  const tecla = (extra) => sugerirAcao({ ...base, ...extra })?.tecla;

  check(tecla({ pedeMaterial: { motivo: 'ela pediu o material' } }) === '6',
    'com material pedido, o caso vai para voce ou para a IA');

  /** Os outros ramos da mesma caixa continuam intactos. */
  check(tecla({}) === '3', 'sem material, ja respondemos hoje: conclui');
  check(tecla({ perguntaPendente: { motivo: 'x' } }) === '6', 'pergunta pendente continua sendo 6');
  check(tecla({ respondidoHoje: false, momentoJaEnviado: false }) === '5',
    'nada saiu hoje: manda a do momento');

  /**
   * **O verbete tem que dizer o mesmo que a funcao faz** — senao a janela do fluxo promete um
   * desfecho que o codigo nao produz, e e olhando essa janela que ele decide a ordem.
   */
  const ramos = sugestaoLib.SOBRE['ja-respondemos-antes'].ramos;
  check(ramos.some((r) => r.tecla === '6' && /material/.test(r.se)), 'e o verbete nomeia o material');
  check(sugestaoLib.regrasComDesfechoIncoerente().length === 0, 'nenhum desfecho incoerente');
}

/**
 * A ETIQUETA DE QUEM PEDIU DINHEIRO OU EMPREGO SAI PELO SINAL — pedido dele (10/09/2026): *"como a IA
 * atende pedido de ajuda e dinheiro, a etiqueta nao esta sendo colocada"*. A marca dependia de sair a
 * resposta pronta que nega, e desde a 3.10 quem responde e a IA, em texto livre.
 */
{
  grupo('etiqueta de pedido sai pelo sinal, nao pela resposta pronta (10/09)');
  const { motivoDaEtiquetaDePedido } = sugestaoLib;

  check(!!motivoDaEtiquetaDePedido({ pedeAjudaFinanceira: { motivo: 'escreveu pix' } }), 'pedido de dinheiro marca');
  check(!!motivoDaEtiquetaDePedido({ pedeEmprego: { tipo: 'emprego' } }), 'procura de emprego marca');
  check(!motivoDaEtiquetaDePedido({ pedeEmprego: { tipo: 'campanha' } }), 'quem quer ser voluntario na campanha NAO e marcado');
  check(!motivoDaEtiquetaDePedido({ pedeAjudaFinanceira: null, pedeEmprego: null }),
    'sinais vazios (a negativa pronta ja saiu e ja marcou) nao marcam de novo');
  check(!motivoDaEtiquetaDePedido({}), 'sem sinal, nada');
  check(motivoDaEtiquetaDePedido(null) === null, 'sem contexto nao quebra');
}

fim();
