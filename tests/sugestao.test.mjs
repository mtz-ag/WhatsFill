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


grupo('etiqueta que dispensa da fila: sugere pular');
{
  const r = com({ etiquetaQueDispensa: 'ENGAJADO/BIZA' });
  check(r?.tecla === '2', 'recomendou pular = ' + JSON.stringify(r));
  check(String(r?.motivo || '').includes('ENGAJADO/BIZA'), 'o motivo nomeia a etiqueta = ' + r?.motivo);

  // Vence o resto do trabalho de fila: engajado nao precisa de formulario nem de interesse.
  check(com({ etiquetaQueDispensa: 'engajado', nomeSemSentido: true })?.tecla === '2', 'vence pedir dados');
  check(com({ etiquetaQueDispensa: 'engajado', podeEnviar: true })?.tecla === '2', 'vence o modelo');
  check(com({ etiquetaQueDispensa: 'engajado', ultimaEhSoReacao: true })?.tecla === '2', 'vence a reacao');

  // A prioridade INVERTEU em 31/08, por decisao dele (print do Deoclecio, engajado com video):
  // "veja isso tambem que nao pulou o engajado". Engajado manda video e link o dia inteiro, e
  // responder a cada um e nao sair da fila. A tecla 6 continua a um toque quando merecer.
  const pede = { motivo: 'mandou um video' };
  check(com({ etiquetaQueDispensa: 'engajado', pedeRespostaPessoal: pede })?.tecla === '2',
    'engajado com video e pulado — a etiqueta vence tudo');
}


grupo('voltou por outro anuncio');
{
  // Os dois desfechos que ele descreveu, escolhidos pelo que ja saiu.
  const r = com({ voltouPorOutroAnuncio: true });
  check(r?.tecla === '5', 'momento ainda nao enviado, sugere a mensagem do momento = ' + JSON.stringify(r));
  check(String(r?.motivo).includes('outro an'), 'o motivo diz que voltou por anuncio = ' + r?.motivo);

  const jaFoi = com({ voltouPorOutroAnuncio: true, momentoJaEnviado: true });
  check(jaFoi?.tecla === '3', 'momento ja enviado, sugere concluir = ' + JSON.stringify(jaFoi));

  const semMomento = com({ voltouPorOutroAnuncio: true, podeMandarMomento: false });
  check(semMomento?.tecla === '3', 'sem mensagem do momento configurada, sugere concluir');

  // Vence "sem etiqueta de cidade", que sugeriria justamente pedir dados de novo.
  check(r?.tecla !== '4', 'nao sugere pedir dados de novo');

  // Print do Telmo: cidade Viamao, modelo enviado as 10:28, voltou por anuncio as 18:24 -- e a
  // rodada sugeria mandar o modelo de novo. Ter cidade nao muda o que a pessoa acabou de fazer.
  check(com({ voltouPorOutroAnuncio: true, temEtiquetaDeCidade: true })?.id === 'voltou-por-outro-anuncio',
    'com cidade a regra casa igual');
  check(com({ voltouPorOutroAnuncio: true, momentoJaEnviado: true, podeEnviar: true, conteudoPedido: 'ADS' })?.tecla === '3',
    'vence o modelo: nao manda o mesmo conteudo de novo');

  // E audio continua ganhando: quem falou merece resposta.
  check(com({ voltouPorOutroAnuncio: true, pedeRespostaPessoal: { motivo: 'audio' } })?.tecla === '6',
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


grupo('veio do anuncio e o formulario NUNCA saiu');
{
  // Print da Sonia: nome de verdade (a regra do nome nao pega), conteudo pedido (a regra do
  // modelo pega e manda), e o formulario nunca tinha saido. "bastante contatos que vieram de
  // anuncio sem pedir dados ao iniciar".
  const nunca = { jaPediramDados: false, temEtiquetaDeCidade: false };
  const r = com(nunca);
  check(r?.tecla === '4', 'recomendou pedir os dados = ' + JSON.stringify(r));
  check(String(r?.motivo).includes('nunca saiu'), 'o motivo diz que nunca saiu');

  // A distincao que faltava: pedir vence o modelo SO para quem nunca foi perguntado.
  check(com({ ...nunca, podeEnviar: true, conteudoPedido: 'ADS' })?.tecla === '4',
    'nunca perguntado: pedir vence o modelo');
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
  check(marta?.tecla === '4', 'pedir dados vence o emoji: ' + JSON.stringify(marta));
  check(marta?.id === 'nunca-pediram-dados', 'e e a regra do formulario que casa');

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
  check(com({ perguntaAberta: P, etiquetaQueDispensa: 'engajado' })?.tecla === '2', 'etiqueta dispensa vence');
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
  check(ciro?.tecla === '8', 'o apoio VENCE o modelo: ' + JSON.stringify(ciro));
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
  check(com({ soExpressaApoio: A, etiquetaQueDispensa: 'engajado' })?.tecla === '2', 'etiqueta dispensa vence');
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
  check(mari?.tecla === '9', 'pergunta em que pode ajudar: ' + JSON.stringify(mari));
  check(/Preciso da forca/.test(mari?.motivo), 'e o motivo mostra o trecho, para ele conferir');

  /**
   * **Vence a despedida de proposito.** "Preciso da sua forca, abraco" tem despedida dentro, e
   * concluir ali e fechar a porta na cara de um pedido.
   */
  check(com({ pedeAlgoIndefinido: P, ultimaEhDespedida: true })?.tecla === '9', 'vence a despedida');
  check(com({ pedeAlgoIndefinido: P, ultimaEhSoReacao: true })?.tecla === '9', 'vence a reacao');
  check(com({ pedeAlgoIndefinido: P, soExpressaApoio: { motivo: 'a' } })?.tecla === '9', 'vence o apoio');
  check(com({ pedeAlgoIndefinido: P, jaPediramDados: false, temEtiquetaDeCidade: false })?.tecla === '9', 'vence pedir dados');

  /**
   * So duas coisas passam na frente, e as duas por boa razao: a etiqueta que dispensa da fila
   * (decisao explicita dele) e o audio, que precisa ser ouvido antes de qualquer decisao.
   */
  check(com({ pedeAlgoIndefinido: P, pedeRespostaPessoal: { motivo: 'audio' } })?.tecla === '6', 'audio vence: ouca primeiro');
  check(com({ pedeAlgoIndefinido: P, etiquetaQueDispensa: 'engajado' })?.tecla === '2', 'etiqueta dispensa vence');

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
  check(com({ jaRespondemosAntes: true, soExpressaApoio: { motivo: 'a' } })?.tecla === '8',
    'apoio proprio vence: responder a ela e melhor que a mensagem da semana');
  check(com({ jaRespondemosAntes: true, pedeAlgoIndefinido: { trecho: 'x' } })?.tecla === '9', 'pedido indefinido vence');
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
    const daFuncao = new Set();
    for (let m = 0; m < 8; m++) {
      daFuncao.add(r.tecla({
        respondidoHoje: !!(m & 1),
        momentoJaEnviado: !!(m & 2),
        podeMandarMomento: !!(m & 4),
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

fim();
