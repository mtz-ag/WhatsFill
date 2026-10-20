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
  const bruto = ['Marta Fictinha', 'Critica politica do eleitor', '7 min', 'Curtir', 'Responder', 'Enviar mensagem', 'Ocultar'].join('\n');
  check(
    fbdom.limparTextoDoComentario(bruto, 'Marta Fictinha') === 'Critica politica do eleitor',
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

  /**
   * O CONSERTO DE 19/10: a CONTAGEM DE REACOES vinha junto. Ele viu na tela
   * "Critica politica do eleitor" com um "1" solto embaixo. Ela mora
   * DEPOIS da fileira de botoes, entao o que conserta e PARAR no primeiro
   * marcador em vez de peneirar linha a linha.
   */
  const comReacoes = ['Marta Fictinha', 'Critica politica do eleitor', '27 min', 'Curtir', 'Responder', 'Enviar mensagem', 'Ocultar', '1'].join('\n');
  check(
    fbdom.limparTextoDoComentario(comReacoes, 'Marta Fictinha') === 'Critica politica do eleitor',
    'a contagem de reacoes depois dos botoes NAO entra no texto'
  );
  check(
    fbdom.limparTextoDoComentario(['Ana Exemplo', 'texto', '1 h', 'Curtir', 'Ver traducao', '12'].join('\n'), 'Ana Exemplo') === 'texto',
    '"Ver traducao" e a contagem, que vem depois, ficam de fora'
  );

  /**
   * A forma medida na pagina em que o texto E um numero e o tempo tambem:
   * "22" com "22 min" embaixo. O corte e da linha INTEIRA, entao "22" fica.
   */
  check(
    fbdom.limparTextoDoComentario(['Ana Exemplo', '22', '22 min', 'Curtir'].join('\n'), 'Ana Exemplo') === '22',
    '"22" com "22 min" embaixo sai certo — medido na pagina'
  );
}

grupo('maisInterno: o modal do post vem aninhado');
{
  /**
   * Medido: o post aberto traz DOIS `[role="dialog"]`, um dentro do outro
   * (1351x633 e 700x569), os dois com os mesmos comentarios. Pegar o de fora
   * funcionaria hoje, mas o de dentro e o mais especifico — e se um dia o
   * externo passar a envolver mais coisa, ele traria a timeline junto, que e o
   * defeito que isto existe para evitar.
   */
  const no = (filhos = []) => ({ filhos, contains(o) { return this.filhos.includes(o) || this.filhos.some((f) => f.contains && f.contains(o)); } });
  const interno = no();
  const externo = no([interno]);

  check(fbdom.maisInterno([externo, interno]) === interno, 'escolhe o mais interno');
  check(fbdom.maisInterno([interno, externo]) === interno, 'a ordem da lista nao importa');
  check(fbdom.maisInterno([interno]) === interno, 'um so devolve ele mesmo');
  check(fbdom.maisInterno([]) === null, 'nenhum devolve nulo');
  check(fbdom.maisInterno(null) === null, 'nulo devolve nulo');

  // Dois irmaos (nenhum contem o outro): devolve um, nunca nulo — ficar sem
  // raiz seria o painel dizer "abra um post" com o post aberto na frente.
  const irmaoA = no(); const irmaoB = no();
  check(fbdom.maisInterno([irmaoA, irmaoB]) !== null, 'dois irmaos ainda devolvem uma raiz');
}

grupo('mesmoNome');
{
  check(fbdom.mesmoNome('Capitao Martim', 'CAPITÃO MARTIM'), 'acento e caixa nao importam');
  check(fbdom.mesmoNome('Marta  Fictinha', 'Marta Fictinha'), 'espaco dobrado nao importa');
  check(!fbdom.mesmoNome('Marta Fictinha', 'Marta'), 'nome parcial NAO casa — senao uma resposta a "Marta" calaria "Marta Fictinha"');
  check(!fbdom.mesmoNome('', ''), 'vazio nunca casa com vazio — senao article sem autor viraria todo mundo');
  check(!fbdom.mesmoNome('Joana Exemplo', 'Pedro Terceiro'), 'nomes diferentes nao casam');
}

grupo('comentariosDoPost: a lista traz TODOS, dizendo quem ja tem resposta nossa');
{
  /**
   * Pedido dele em 20/10/2026: *"troque a cor dos que receberam resposta na lista para amarelo"*.
   * Ate entao os respondidos eram DESCARTADOS aqui — devolver a marca nao custa leitura nenhuma,
   * porque a conta ja existia para poder filtrar.
   *
   * O DOM falso e o minimo que `articles` + `nomeDaPagina` leem: `querySelectorAll` por seletor,
   * `getAttribute('aria-label')` e `innerText`.
   */
  const art = (rotulo, texto) => ({
    seletor: '[role="article"][aria-label]',
    getAttribute: (k) => (k === 'aria-label' ? rotulo : null),
    innerText: texto,
    querySelectorAll: () => [],
  });
  const composer = (pagina) => ({
    seletor: '[aria-label]',
    getAttribute: () => `Comente como ${pagina}`,
    querySelectorAll: () => [],
  });
  const raizCom = (nos) => ({
    querySelectorAll: (sel) => nos.filter((n) => n.seletor === sel || sel === '[aria-label]'),
  });

  const raiz = raizCom([
    composer(PAGINA),
    art('Comentario de Marta Fictinha ha 2 horas', 'Marta Fictinha\nApoio voces!\n2 h\nCurtir'),
    art('Comentario de Joana Exemplo ha 1 hora', 'Joana Exemplo\n22 com certeza\n1 h\nCurtir'),
    art(`Resposta de ${PAGINA} ao comentario de Marta Fictinha ha 1 hora`, `${PAGINA}\nObrigado!\n1 h\nCurtir`),
  ]);

  const todos = fbdom.comentariosDoPost(raiz);
  check(todos.length === 2, 'os dois comentarios de primeiro nivel vem na lista');

  const marta = todos.find((c) => c.autor === 'Marta Fictinha');
  const joana = todos.find((c) => c.autor === 'Joana Exemplo');
  check(marta?.respondido === true, 'quem NOS respondemos vem marcado — e o que fica amarelo');
  check(joana?.respondido === false, 'quem ainda espera vem sem a marca');

  /**
   * **Uma fonte de verdade:** `comentariosSemResposta` e esta lista peneirada. Duas varreduras
   * separadas divergiriam, e a divergencia seria a tela mostrar como pendente quem o painel
   * considera respondido.
   */
  const faltam = fbdom.comentariosSemResposta(raiz);
  check(faltam.length === 1 && faltam[0].autor === 'Joana Exemplo', 'a peneira continua dando so quem espera');
  check(
    faltam.every((c) => !c.respondido),
    'e nada que esteja marcado passa por ela'
  );
}

grupo('comentariosDoPost: sem o nome da pagina, NADA e marcado como respondido');
{
  /**
   * **Marcar de amarelo por chute esconderia da fila quem nunca foi atendido.** Sem o composer
   * nao da para saber quem respondeu — e o painel ja avisa em amarelo quando isso acontece.
   */
  const art = (rotulo, texto) => ({
    seletor: '[role="article"][aria-label]',
    getAttribute: (k) => (k === 'aria-label' ? rotulo : null),
    innerText: texto,
    querySelectorAll: () => [],
  });
  const raiz = {
    querySelectorAll: (sel) =>
      sel === '[aria-label]'
        ? []
        : [
            art('Comentario de Marta Fictinha ha 2 horas', 'Marta Fictinha\nApoio!\n2 h\nCurtir'),
            art('Resposta de Capitao Martim ao comentario de Marta Fictinha ha 1 hora', 'Capitao Martim\nObrigado!\n1 h\nCurtir'),
          ],
  };

  const todos = fbdom.comentariosDoPost(raiz);
  check(todos.length === 1, 'so o comentario de primeiro nivel entra');
  check(todos[0].respondido === false, 'sem o nome da pagina, erra MOSTRANDO como pendente');
}

grupo('respostaNossaColapsada: o Facebook diz "X respondeu" ANTES de criar o article');
{
  /**
   * **A causa do amarelo nao aparecer** (print dele, 20/10/2026). Abaixo do comentario da
   * eleitora estava *"Capitao Martim respondeu · 1 resposta"*, COLAPSADO — e o Facebook so cria o
   * `[role="article"]` da resposta depois do clique. Sem esta leitura, `respondido` era falso para
   * todo mundo.
   */
  const art = (texto) => ({ innerText: texto });

  check(
    fbdom.respostaNossaColapsada(art(`Rita Jesus\nBora de 22\n1 h\nCurtir\nResponder\n${PAGINA} respondeu · 1 resposta`), PAGINA),
    'o resumo colapsado conta como respondido'
  );
  check(
    fbdom.respostaNossaColapsada(art(`Rita Jesus\nBora de 22\n1 h\nCurtir\n${PAGINA} respondeu`), PAGINA),
    'sem o "· 1 resposta" tambem'
  );
  check(
    fbdom.respostaNossaColapsada(art('Rita Jesus\nBora\n1 h\nCurtir\nCAPITÃO MARTIM respondeu'), 'Capitao Martim'),
    'acento e caixa do nome da pagina nao decidem isso'
  );

  /**
   * **A guarda e a POSICAO.** Antes do primeiro marcador de tempo/botao ainda e o texto do
   * comentario — e "o Capitao Martim respondeu meu pedido" e o eleitor falando de nos, nao o
   * Facebook resumindo.
   */
  check(
    !fbdom.respostaNossaColapsada(art(`Rita Jesus\n${PAGINA} respondeu meu pedido, obrigada!\n1 h\nCurtir`), PAGINA),
    'no TEXTO do comentario nao conta — e o eleitor falando de nos'
  );
  check(
    !fbdom.respostaNossaColapsada(art('Rita Jesus\nBora\n1 h\nCurtir\nPedro Terceiro respondeu · 1 resposta'), PAGINA),
    'resposta de TERCEIRO colapsada nao conta'
  );
  check(!fbdom.respostaNossaColapsada(art('Rita\nBora\n1 h\nCurtir'), PAGINA), 'sem resumo nenhum, falso');
  check(!fbdom.respostaNossaColapsada(art(`x\n1 h\n${PAGINA} respondeu`), ''), 'sem o nome da pagina nunca marca');
  check(!fbdom.respostaNossaColapsada(null, PAGINA), 'entrada torta nao derruba');
}

grupo('botoesDeExpandir: lista de PERMISSAO, com teto de tamanho');
{
  const btn = (texto) => ({ seletor: '[role="button"]', innerText: texto });
  const raiz = (nos) => ({ querySelectorAll: () => nos });

  const achados = (lista) => fbdom.botoesDeExpandir(raiz(lista.map(btn))).map((b) => b.innerText);

  check(achados(['1 resposta']).length === 1, '"1 resposta" revela');
  check(achados(['12 respostas']).length === 1, '"12 respostas" revela');
  check(achados(['Ver mais comentarios']).length === 1, '"Ver mais comentarios" revela');
  check(achados(['Ver mais 3 respostas']).length === 1, '"Ver mais 3 respostas" revela');
  check(achados(['Ver respostas anteriores']).length === 1, '"Ver respostas anteriores" revela');

  // O que NAO pode ser clicado — e e aqui que mora o risco, porque clicar e agir na pagina dele.
  check(achados(['Curtir']).length === 0, 'Curtir nao e botao de revelar');
  check(achados(['Responder']).length === 0, 'Responder nao e botao de revelar');
  check(achados(['Enviar mensagem']).length === 0, 'Enviar mensagem nao e botao de revelar');
  check(achados(['Ocultar']).length === 0, 'Ocultar nao e botao de revelar');
  check(achados(['']).length === 0, 'botao sem texto nao entra');

  /**
   * **O teto de 40 caracteres e a guarda que importa:** um comentario que por acaso seja um
   * `role="button"` entraria na lista, e o painel clicaria no que o eleitor escreveu.
   */
  const comentarioLongo = 'Ver mais respostas sobre isso porque eu acho que voces precisam saber de uma coisa';
  check(achados([comentarioLongo]).length === 0, 'texto longo nao e botao, mesmo casando o padrao');
}

fim();
