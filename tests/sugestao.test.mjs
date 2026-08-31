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

/** Retrato de um contato "sem nada": nenhuma regra deveria casar por acidente. */
const base = {
  modeloJaNaConversa: false,
  respondidoHoje: false,
  ultimaEhDespedida: false,
  voltouPorOutroAnuncio: false,
  momentoHoje: false,
  pedeRespostaPessoal: null,
  etiquetaQueDispensa: null,
  ultimaEhSoReacao: false,
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

grupo('sem etiqueta de cidade: pedir dados, e na frente de tudo');
{
  const r = com({ temEtiquetaDeCidade: false });
  check(r?.tecla === '4', `recomendou a tecla 4 = ${JSON.stringify(r)}`);
  check(/filtro/.test(r?.motivo || ''), `o motivo diz por que importa = ${r?.motivo}`);

  // A prioridade MUDOU em 31/08, com a print da Janete: quem pediu conteúdo e não deu a cidade
  // recebe o conteúdo. "Talvez em outra hora ela forneça" — e o formulário repetido não aproxima
  // ninguém de fornecer. A regra de cidade e a de conteúdo trocaram de lugar na lista.
  const comConteudo = com({ temEtiquetaDeCidade: false, podeEnviar: true, conteudoPedido: 'Conteúdo Flávio' });
  check(comConteudo?.tecla === '1', 'com modelo a enviar, o modelo vence — mesmo sem cidade');

  // E sem nada a enviar, pedir dados continua sendo a saída.
  check(com({ temEtiquetaDeCidade: false })?.tecla === '4', 'sem nada a enviar, pede os dados');

  // Mas não recomenda pedir DE NOVO no mesmo dia.
  const jaPedi = com({ temEtiquetaDeCidade: false, pedidoHoje: true });
  check(jaPedi?.tecla !== '4', `já pedido hoje não recomenda pedir de novo = ${JSON.stringify(jaPedi)}`);

  // Sem a opção na tela (texto travado por variável), não adianta recomendá-la.
  check(com({ temEtiquetaDeCidade: false, podePedirDados: false })?.tecla !== '4', 'opção indisponível não é recomendada');
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
  check(com({ etiquetaQueDispensa: 'engajado', temEtiquetaDeCidade: false })?.tecla === '2', 'vence pedir dados');
  check(com({ etiquetaQueDispensa: 'engajado', podeEnviar: true })?.tecla === '2', 'vence o modelo');
  check(com({ etiquetaQueDispensa: 'engajado', ultimaEhSoReacao: true })?.tecla === '2', 'vence a reacao');

  // A prioridade INVERTEU em 31/08, por decisao dele (print do Deoclecio, engajado com video):
  // "veja isso tambem que nao pulou o engajado". Engajado manda video e link o dia inteiro, e
  // responder a cada um e nao sair da fila. A tecla 6 continua a um toque quando merecer.
  const pede = { motivo: 'mandou um video' };
  check(com({ etiquetaQueDispensa: 'engajado', pedeRespostaPessoal: pede })?.tecla === '2',
    'engajado com video e pulado — a etiqueta vence tudo');
}


grupo('ignorou o pedido de dados e voltou por outro anuncio');
{
  // Os dois desfechos que ele descreveu, escolhidos pelo que ja saiu hoje.
  const r = com({ voltouPorOutroAnuncio: true, temEtiquetaDeCidade: false });
  check(r?.tecla === '5', 'sem momento hoje, sugere a mensagem do momento = ' + JSON.stringify(r));
  check(String(r?.motivo).includes('nao peca de novo') || String(r?.motivo).includes('não peça de novo'),
    'o motivo diz para NAO pedir de novo');

  const jaFoi = com({ voltouPorOutroAnuncio: true, temEtiquetaDeCidade: false, momentoHoje: true });
  check(jaFoi?.tecla === '3', 'momento ja enviado hoje, sugere concluir = ' + JSON.stringify(jaFoi));

  const semMomento = com({ voltouPorOutroAnuncio: true, temEtiquetaDeCidade: false, podeMandarMomento: false });
  check(semMomento?.tecla === '3', 'sem mensagem do momento configurada, sugere concluir');

  // Vence "sem etiqueta de cidade", que sugeriria justamente pedir dados de novo.
  check(r?.tecla !== '4', 'nao sugere pedir dados de novo');

  // Quem JA tem cidade nao e este caso: respondeu, so voltou pelo anuncio.
  check(com({ voltouPorOutroAnuncio: true, temEtiquetaDeCidade: true })?.id !== 'voltou-por-outro-anuncio',
    'com cidade ja preenchida a regra nao casa');

  // E audio continua ganhando: quem falou merece resposta.
  check(com({ voltouPorOutroAnuncio: true, temEtiquetaDeCidade: false, pedeRespostaPessoal: { motivo: 'audio' } })?.tecla === '6',
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
  check(com({ ultimaEhDespedida: true, temEtiquetaDeCidade: false })?.tecla === '3', 'vence pedir dados');

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
  check(com({ ...enviavel, modeloJaNaConversa: true, temEtiquetaDeCidade: false })?.tecla === '4',
    'cai para pedir dados');
}

fim();
