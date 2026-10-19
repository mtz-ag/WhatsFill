/**
 * A leitura do rotulo dos comentarios do Facebook.
 *
 * O que este arquivo protege e QUEM FICA SEM RESPOSTA. O `aria-label` e a unica
 * camada estavel da pagina, e e dele que sai o sinal "este comentario ja foi
 * respondido" — o equivalente ao `from.id === pageId` da Graph API. Errar para
 * um lado faz a extensao pedir que ele responda duas vezes; errar para o outro
 * esconde um eleitor que nunca foi atendido.
 *
 * TODO nome aqui e FICTICIO de proposito: nome de eleitor nao entra em arquivo
 * do repositorio.
 *
 * Rode: node tests/dom-facebook.test.mjs
 */
import { check, grupo, fim } from './_harness.mjs';
import * as fbdom from '../src/lib/dom-facebook.js';

const PAGINA = 'Capitao Martim';

grupo('lerRotulo: as duas formas medidas na pagina');
{
  const c = fbdom.lerRotulo('Comentario de Marta Fictinha ha 2 horas');
  check(c?.tipo === 'comentario', 'comentario de primeiro nivel e reconhecido');
  check(c?.autor === 'Marta Fictinha', 'tira o autor do rotulo');
  check(c?.respondeA === null, 'comentario de primeiro nivel nao responde a ninguem');

  const r = fbdom.lerRotulo('Resposta de Joana Exemplo ao comentario de Marta Fictinha ha 1 hora');
  check(r?.tipo === 'resposta', 'resposta e reconhecida');
  check(r?.autor === 'Joana Exemplo', 'tira quem respondeu');
  check(r?.respondeA === 'Marta Fictinha', 'tira a QUEM a resposta responde — e este o sinal');

  /**
   * As duas caixas do "ha" foram medidas na mesma pagina, no mesmo minuto:
   * "Ha 4 minutos" (maiuscula, do comentario recente) e "ha mais ou menos uma
   * hora" (minuscula). Casar so uma deixaria metade dos comentarios invisivel.
   */
  check(fbdom.lerRotulo('Comentario de Ana Exemplo Ha 4 minutos')?.autor === 'Ana Exemplo', 'o "Ha" maiusculo tambem casa');
  check(fbdom.lerRotulo('Comentário de Ana Exemplo há ± uma hora')?.autor === 'Ana Exemplo', 'com acento e com o "mais ou menos" tambem');

  // Nome composto com preposicao dentro: o lazy tem de parar no " ha ", nao no " de ".
  check(fbdom.lerRotulo('Comentario de Maria de Souza Fictinha ha 3 dias')?.autor === 'Maria de Souza Fictinha', 'nome com "de" dentro nao e cortado');
  check(
    fbdom.lerRotulo('Resposta de Maria de Souza ao comentario de Jose dos Santos ha 5 minutos')?.respondeA === 'Jose dos Santos',
    'os dois nomes compostos saem inteiros'
  );
}

grupo('lerRotulo: o que NAO pode virar comentario');
{
  /**
   * O feed tem article de outras coisas. Rotulo desconhecido tratado como
   * comentario faria a rodada procurar uma caixa de resposta que nao existe.
   */
  check(fbdom.lerRotulo('') === null, 'rotulo vazio nao e comentario');
  check(fbdom.lerRotulo(null) === null, 'nulo nao e comentario');
  check(fbdom.lerRotulo('Capitao Martim') === null, 'nome solto nao e comentario');
  check(fbdom.lerRotulo('Deixe um comentario') === null, 'o BOTAO de comentar nao e um comentario');
  check(fbdom.lerRotulo('Comente como Capitao Martim') === null, 'o composer nao e um comentario');
  check(fbdom.lerRotulo('Comentario de Marta Fictinha') === null, 'sem o tempo nao casa — a forma medida sempre o tem');
  check(fbdom.lerRotulo('Acoes para este post de Capitao Martim') === null, 'o menu de acoes do post nao e um comentario');
}

grupo('semRespostaNossa: resposta de TERCEIRO nao conta');
{
  /**
   * Medido na pagina: existe "Resposta de <X> ao comentario de <Y>" em que X nao
   * somos nos — um eleitor respondendo outro eleitor. Contar isso como atendido
   * deixaria <Y> sem resposta nossa para sempre, parecendo resolvido.
   */
  const rotulos = [
    'Comentario de Marta Fictinha ha 2 horas',
    'Comentario de Joana Exemplo ha 1 hora',
    'Resposta de Pedro Terceiro ao comentario de Joana Exemplo ha 1 hora',
  ];
  const faltam = fbdom.semRespostaNossa(rotulos, PAGINA).map((c) => c.autor);
  check(faltam.length === 2, 'resposta de terceiro nao marca o comentario como respondido');
  check(faltam.includes('Joana Exemplo'), 'quem foi respondida por outro eleitor continua na fila');
  check(faltam.includes('Marta Fictinha'), 'quem nao recebeu nada continua na fila');
}

grupo('semRespostaNossa: resposta NOSSA tira da fila');
{
  const rotulos = [
    'Comentario de Marta Fictinha ha 2 horas',
    'Comentario de Joana Exemplo ha 1 hora',
    `Resposta de ${PAGINA} ao comentario de Marta Fictinha ha 1 hora`,
  ];
  const faltam = fbdom.semRespostaNossa(rotulos, PAGINA).map((c) => c.autor);
  check(faltam.length === 1 && faltam[0] === 'Joana Exemplo', 'quem nos respondemos sai da fila');

  // Acento e caixa do nome da pagina nao podem decidir isso.
  const comAcento = fbdom.semRespostaNossa(
    ['Comentario de Marta Fictinha ha 2 horas', 'Resposta de CAPITÃO MARTIM ao comentario de Marta Fictinha ha 1 hora'],
    'Capitao Martim'
  );
  check(comAcento.length === 0, 'o nome da pagina casa sem acento e sem caixa');

  // A nossa resposta nao e, ela mesma, um comentario a responder.
  const soNossa = fbdom.semRespostaNossa([`Comentario de ${PAGINA} ha 1 hora`], PAGINA);
  check(soNossa.length === 1, 'comentario NOSSO de primeiro nivel ainda aparece — quem decide e a rodada, nao esta funcao');
}

grupo('semRespostaNossa: sem o nome da pagina, erra MOSTRANDO demais');
{
  /**
   * Sem o nome da pagina nao da para saber de quem e a resposta. Devolver todos
   * faz ele ver um comentario ja respondido — barato, ele pula. O contrario
   * esconderia eleitor sem atendimento, que e o defeito que nao se ve.
   * E a mesma escolha de `facebook.lerComentarios` sem o pageId.
   */
  const rotulos = [
    'Comentario de Marta Fictinha ha 2 horas',
    `Resposta de ${PAGINA} ao comentario de Marta Fictinha ha 1 hora`,
  ];
  check(fbdom.semRespostaNossa(rotulos, '').length === 1, 'sem o nome da pagina, o comentario continua na lista');
  check(fbdom.semRespostaNossa(rotulos).length === 1, 'nome da pagina omitido faz o mesmo');
}

grupo('semRespostaNossa: entrada torta nao derruba');
{
  check(fbdom.semRespostaNossa([], PAGINA).length === 0, 'lista vazia devolve vazio');
  check(fbdom.semRespostaNossa(null, PAGINA).length === 0, 'nulo devolve vazio');
  check(fbdom.semRespostaNossa(['', null, 'lixo'], PAGINA).length === 0, 'rotulo que nao casa e descartado, nao vira comentario');
}

grupo('postDaPagina: o feed nao e um post');
{
  /**
   * Medido: dentro do post aberto os links do article sao so de perfil, entao
   * `linkDoPost` devolve null e quem responde "de que post e isto" e a URL.
   * Tratar o feed como post faria a rodada achar que ha um post aberto quando
   * ele esta na linha do tempo, com 30 posts virtualizados na tela.
   */
  // A forma que eu MEDI: o reel mora na raiz.
  check(!!fbdom.postDaPagina('/reel/111222333444'), 'reel e um post');
  check(!!fbdom.postDaPagina('/videos/123'), 'video na raiz e um post');

  /**
   * A forma que eu NAO medi e e a mais comum: o post de foto e texto da pagina
   * mora embaixo dela. O primeiro padrao exigia a raiz e deixava este de fora.
   */
  check(!!fbdom.postDaPagina('/capitaomartim/posts/123'), 'post da PAGINA casa — a forma mais comum');
  check(!!fbdom.postDaPagina('/capitaomartim/videos/123'), 'video da pagina casa');
  check(!!fbdom.postDaPagina('/capitaomartim/photos/a.1/2/'), 'foto da pagina casa');
  check(!!fbdom.postDaPagina('/permalink.php'), 'permalink.php casa');

  // E o que NAO pode virar post.
  check(fbdom.postDaPagina('/capitaomartim') === null, 'a linha do tempo da pagina NAO e um post');
  check(fbdom.postDaPagina('/') === null, 'o feed inicial nao e um post');
  check(fbdom.postDaPagina('/joana.perfil.123') === null, 'perfil de eleitor nao e um post');
  check(fbdom.postDaPagina('/joana.videos.123') === null, 'perfil com "videos" no NOME nao e post — o segmento tem de ser inteiro');
  check(fbdom.postDaPagina('/reelsomething') === null, '"reelsomething" nao passa por reel');
  check(fbdom.postDaPagina('/capitaomartim/followers/') === null, 'seguidores nao e post');
}

grupo('limparTextoDoComentario: o innerText vem com nome, tempo e botoes juntos');
{
  /**
   * A forma medida na pagina: o article rende o nome, o texto, o tempo e a
   * fileira de botoes, tudo em linhas. O que vai para a tela e para a IA e so
   * o que a pessoa escreveu.
   */
  const bruto = ['Marta Fictinha', 'Gastando o dinheiro dos velhinhos', '7 min', 'Curtir', 'Responder', 'Enviar mensagem', 'Ocultar'].join('\n');
  check(
    fbdom.limparTextoDoComentario(bruto, 'Marta Fictinha') === 'Gastando o dinheiro dos velhinhos',
    'sobra so o que a pessoa escreveu'
  );

  const comHa = ['Ana Exemplo', 'Parabens pelo trabalho', 'Ha 4 minutos', 'Curtir', 'Responder'].join('\n');
  check(fbdom.limparTextoDoComentario(comHa, 'Ana Exemplo') === 'Parabens pelo trabalho', 'o tempo por extenso tambem sai');

  // Varias linhas de texto continuam inteiras.
  const duasLinhas = ['Ana Exemplo', 'Primeira linha', 'Segunda linha', '1 h', 'Curtir', 'Responder'].join('\n');
  check(
    fbdom.limparTextoDoComentario(duasLinhas, 'Ana Exemplo') === 'Primeira linha\nSegunda linha',
    'comentario de duas linhas nao e cortado'
  );

  /**
   * O que NAO pode ser comido. Errar aqui apaga a fala do eleitor, que e o
   * lado caro — por isso a lista de corte e curta e literal.
   */
  check(
    fbdom.limparTextoDoComentario(['Ana Exemplo', 'Voces vao responder?', '2 d', 'Curtir'].join('\n'), 'Ana Exemplo') === 'Voces vao responder?',
    'pergunta curta sobrevive'
  );
  check(
    fbdom.limparTextoDoComentario(['Ana Exemplo', 'Curtir muito o trabalho de voces', '1 h'].join('\n'), 'Ana Exemplo') === 'Curtir muito o trabalho de voces',
    'frase que COMECA com a palavra de um botao nao e cortada — o corte e da linha INTEIRA'
  );
  check(
    fbdom.limparTextoDoComentario(['Ana Exemplo', 'Responder isso e dificil', '1 h'].join('\n'), 'Ana Exemplo') === 'Responder isso e dificil',
    '"Responder" dentro de uma frase nao e o botao'
  );
  check(
    fbdom.limparTextoDoComentario(['Ana Exemplo', '22', '1 h', 'Curtir'].join('\n'), 'Ana Exemplo') === '22',
    'o numero da chapa sozinho NAO e tempo — "22" sem unidade sobrevive'
  );
  check(
    fbdom.limparTextoDoComentario(['Ana Exemplo', '1 h de fila no posto', '1 h', 'Curtir'].join('\n'), 'Ana Exemplo') === '1 h de fila no posto',
    'frase que comeca com tempo nao e cortada — o corte e da linha inteira'
  );

  check(fbdom.limparTextoDoComentario('', 'Ana') === '', 'vazio devolve vazio');
  check(fbdom.limparTextoDoComentario(null, 'Ana') === '', 'nulo devolve vazio');
  check(
    fbdom.limparTextoDoComentario(['Ana Exemplo', 'Curtir', 'Responder'].join('\n'), 'Ana Exemplo') === '',
    'comentario que era so foto vira vazio — e a rodada o descarta'
  );
}

grupo('mesmoNome');
{
  check(fbdom.mesmoNome('Capitao Martim', 'CAPITÃO MARTIM'), 'acento e caixa nao importam');
  check(fbdom.mesmoNome('Marta  Fictinha', 'Marta Fictinha'), 'espaco dobrado nao importa');
  check(!fbdom.mesmoNome('Marta Fictinha', 'Marta'), 'nome parcial NAO casa — senao uma resposta a "Marta" calaria "Marta Fictinha"');
  check(!fbdom.mesmoNome('', ''), 'vazio nunca casa com vazio — senao article sem autor viraria todo mundo');
  check(!fbdom.mesmoNome('Joana Exemplo', 'Pedro Terceiro'), 'nomes diferentes nao casam');
}

fim();
