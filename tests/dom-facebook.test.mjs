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

  /**
   * **O TEXTO REAL DA PAGINA DELE** (print de 20/10/2026): o resumo e o botao sao a MESMA coisa —
   * "Capitao Martim respondeu · 1 resposta", tudo num clicavel so.
   *
   * O padrao antigo exigia que o texto FOSSE "1 resposta" e por isso nao pegava: a leitura
   * terminou com *"19 comentarios, 0 ja respondido"* com tres resumos a vista na tela.
   */
  check(achados(['Capitao Martim respondeu · 1 resposta']).length === 1, 'o resumo+botao junto revela');
  check(achados(['Rita Jesus respondeu · 2 respostas']).length === 1, 'o de terceiro tambem — expandir traz mais articles');
  check(achados(['Ver 30 comentarios anteriores']).length === 1, '"Ver 30 comentarios anteriores" revela');
  check(achados(['Ver todos os comentarios']).length === 1, '"Ver todos os comentarios" revela');

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
  const comentarioLongo =
    'Ver mais respostas sobre isso porque eu acho que voces precisam saber de uma coisa importante';
  check(achados([comentarioLongo]).length === 0, 'texto longo nao e botao, mesmo casando o padrao');
  check(achados(['linha um\n2 respostas']).length === 0, 'texto com quebra de linha nao e botao');
}

grupo('respostaNossaColapsada: o resumo mora FORA do article');
{
  /**
   * **Medido em 20/10/2026 e esta e a causa de "0 ja respondido" em 19.** O caminho pelo
   * `innerText` do article funciona quando o Facebook poe o resumo dentro dele — na pagina dele
   * NAO poe: o resumo e um `[role="button"]` irmao.
   */
  const article = (rotulo, texto) => ({
    innerText: texto,
    getAttribute: () => rotulo,
    querySelectorAll: () => [],
  });
  const botao = (texto) => ({ innerText: texto, ehBotao: true });
  const caixa = (filhos) => ({
    filhos,
    querySelectorAll(sel) {
      return sel === '[role="button"]'
        ? this.filhos.filter((f) => f.ehBotao)
        : this.filhos.filter((f) => f.getAttribute);
    },
  });

  const monta = ({ resumoNoBloco, resumoSoNaLista }) => {
    const art = article('Comentario de Luciane Souza ha 2 horas', 'Luciane Souza\nBoa\n2h\nCurtir\nOcultar');
    const resumo = botao(`${PAGINA} respondeu · 1 resposta`);
    const outro = article('Comentario de Outra Pessoa ha 1 hora', 'Outra Pessoa\nTexto\n1h\nCurtir');

    const bloco = caixa(resumoNoBloco ? [art, resumo] : [art]);
    const lista = caixa(resumoSoNaLista ? [art, outro, resumo] : [art, outro]);
    bloco.parentElement = lista;
    lista.parentElement = null;
    art.parentElement = bloco;
    return art;
  };

  check(fbdom.respostaNossaColapsada(monta({ resumoNoBloco: true }), PAGINA), 'o resumo irmao do article marca');
  check(!fbdom.respostaNossaColapsada(monta({}), PAGINA), 'sem resumo nenhum, nao marca');

  /**
   * **A guarda que importa:** parar no ancestral que ja mistura DOIS comentarios. Acima dali o
   * "respondeu" encontrado pode ser do vizinho — e marcar de amarelo quem nunca foi atendido o
   * ESCONDE da fila, que e o defeito caro.
   */
  check(
    !fbdom.respostaNossaColapsada(monta({ resumoSoNaLista: true }), PAGINA),
    'resumo que so aparece onde ha dois comentarios NAO marca'
  );
}

grupo('a MESMA pessoa com dois comentarios: responder um NAO marca o outro');
{
  /**
   * **A print dele de 21/10/2026:** *"a marta ja foi respondida, ela tem duas mensagens"*. Ela
   * escreveu duas vezes no post, uma ja tinha resposta nossa e a outra nao.
   *
   * O rotulo da resposta so diz o NOME do pai (*"Resposta de X ao comentario de Marta"*), entao
   * casar por nome marcava **as duas** — e a que nunca foi respondida sumia da fila, em silencio.
   * O permalink da resposta carrega os dois ids, e e dele que sai a precisao.
   */
  const antes = globalThis.location;
  globalThis.location = { origin: 'https://www.facebook.com' };

  const link = (href) => ({ seletor: 'a[href]', getAttribute: () => href });
  const art = (rotulo, texto, hrefs = []) => ({
    seletor: '[role="article"][aria-label]',
    getAttribute: (k) => (k === 'aria-label' ? rotulo : null),
    innerText: texto,
    querySelectorAll: (sel) => (sel === 'a[href]' ? hrefs.map(link) : []),
  });

  const umaDela = (id) => `/post?comment_id=${id}`;
  const nossa = (pai, resp) => `/post?comment_id=${pai}&reply_comment_id=${resp}`;

  const nos = [
    art('Comentario de Marta Fictinha ha 2 horas', 'Marta Fictinha\nEstou em oracao\n2 h\nCurtir', [umaDela('A1')]),
    art('Resposta de Capitao Martim ao comentario de Marta Fictinha ha 32 minutos', 'Capitao Martim\nAmem!\n32 min\nCurtir', [nossa('A1', 'R1')]),
    art('Comentario de Marta Fictinha ha 2 horas', 'Marta Fictinha\nEstou com o 22\n2 h\nCurtir', [umaDela('A2')]),
  ];
  const raiz = {
    querySelectorAll: (sel) =>
      sel === '[aria-label]' ? [{ getAttribute: () => `Comente como ${PAGINA}` }] : nos,
  };

  check(fbdom.paiDoComentario(nos[1]) === 'A1', 'o permalink da resposta diz de QUAL comentario ela e filha');
  check(fbdom.paiDoComentario(nos[0]) === null, 'comentario de primeiro nivel nao tem pai');

  const lista = fbdom.comentariosDoPost(raiz);
  check(lista.length === 2, 'os dois comentarios dela entram na lista');
  check(lista[0].respondido === true, 'o que recebeu a resposta fica respondido');
  check(
    lista[1].respondido === false,
    'o OUTRO continua esperando — era ele que sumia da fila'
  );

  /**
   * **A reserva por NOME e o comportamento de ate hoje**, e fica porque a forma do permalink foi
   * lida do codigo e nao medida na pagina dele: um formato diferente, sem reserva, deixaria TUDO
   * como pendente e ele responderia todo mundo duas vezes.
   */
  const semId = [
    art('Comentario de Marta Fictinha ha 2 horas', 'Marta Fictinha\nEstou em oracao\n2 h\nCurtir'),
    art('Resposta de Capitao Martim ao comentario de Marta Fictinha ha 32 minutos', 'Capitao Martim\nAmem!\n32 min\nCurtir'),
  ];
  const semIdRaiz = {
    querySelectorAll: (sel) =>
      sel === '[aria-label]' ? [{ getAttribute: () => `Comente como ${PAGINA}` }] : semId,
  };
  check(
    fbdom.comentariosDoPost(semIdRaiz)[0].respondido === true,
    'sem id no permalink, casa pelo nome como antes'
  );

  globalThis.location = antes;
}

grupo('realcarComentario: o amarelo na volta do selecionado, e o rastro que ele NAO deixa');
{
  /**
   * **Pedido dele (21/10):** *"faca uma marcacao amarela na volta do comentario selecionado"*. No
   * modo de responder o painel esta guardado e ele le a PAGINA — sem isto, a barra diz o nome e
   * nada mostra ONDE.
   */
  const no = () => ({ style: {} });

  const a = no();
  const devolveu = fbdom.realcarComentario(a, null);
  check(devolveu === a, 'devolve o no realcado, para quem chama guardar e limpar depois');
  check(/#ffc107/.test(a.style.outline), 'poe o amarelo em volta');
  check(
    a.style.outlineOffset === '-1px',
    'com offset NEGATIVO: positivo some quando o container corta o que transborda'
  );

  /**
   * **O rastro e o defeito que isto evita:** sem limpar o anterior, passar pela fila com as setas
   * deixaria meia pagina amarela — e o realce para de dizer onde a tecla bate, que e a unica coisa
   * que ele existe para dizer.
   */
  const b = no();
  fbdom.realcarComentario(b, a);
  check(!a.style.outline, 'o anterior perde o realce');
  check(/#ffc107/.test(b.style.outline), 'e o novo ganha');

  // Sem alvo (painel escondido, post fechado): limpa e devolve nulo.
  check(fbdom.realcarComentario(null, b) === null, 'sem alvo devolve nulo');
  check(!b.style.outline, 'e tira o realce de quem estava marcado');

  /**
   * **O que estava la ANTES volta.** O comentario e elemento da pagina dele: limpar para vazio
   * apagaria um inline-style do Facebook se um dia existir.
   */
  const c = { style: { outline: '1px dotted red', outlineOffset: '4px' } };
  fbdom.realcarComentario(c, null);
  check(/#ffc107/.test(c.style.outline), 'o realce entra por cima');
  fbdom.realcarComentario(null, c);
  check(c.style.outline === '1px dotted red' && c.style.outlineOffset === '4px', 'e devolve o que estava la');

  // Realcar o MESMO no de novo nao pode perder o valor original.
  const d = { style: { outline: 'none' } };
  fbdom.realcarComentario(d, null);
  fbdom.realcarComentario(d, d);
  fbdom.realcarComentario(null, d);
  check(d.style.outline === 'none', 'repor no mesmo no nao estraga o valor guardado');

  check(fbdom.realcarComentario(undefined, undefined) === null, 'entrada torta nao derruba');
}

grupo('comentariosDoMesmoAutor: o que a barra mostra');
{
  const c = (id, autor, respondido = false) => ({ id, autor, respondido });
  const lista = [c('1', 'Marta Fictinha', true), c('2', 'Jose Exemplo'), c('3', 'Marta Fictinha')];

  const dela = fbdom.comentariosDoMesmoAutor(lista, lista[2]);
  check(dela.total === 2, 'conta os dois comentarios da mesma pessoa');
  check(dela.posicao === 2, 'diz qual deles e o da vez');
  check(dela.respondidos === 1, 'e quantos dos OUTROS ja tem resposta nossa');

  // O da vez nao entra na propria conta: senao a barra diria "1 ja respondido" sobre ele mesmo.
  check(fbdom.comentariosDoMesmoAutor(lista, lista[0]).respondidos === 0, 'o da vez nao conta como respondido dele mesmo');

  const sozinho = fbdom.comentariosDoMesmoAutor(lista, lista[1]);
  check(sozinho.total === 1 && sozinho.respondidos === 0, 'quem escreveu uma vez so nao ganha marca');

  // Acento e caixa do nome nao podem separar a mesma pessoa em duas.
  const acento = [c('1', 'MARTA FICTINHA', true), c('2', 'Marta Fictínha')];
  check(fbdom.comentariosDoMesmoAutor(acento, acento[1]).respondidos === 1, 'acento e caixa nao separam a pessoa');

  check(fbdom.comentariosDoMesmoAutor(null, c('1', 'x')).total === 0, 'lista nula nao derruba');
}

grupo('proximoPendente: o avanco do modo de responder');
{
  const c = (id, respondido = false) => ({ id, autor: `Fict ${id}`, respondido });

  const fila = [c('a', true), c('b'), c('c', true), c('d'), c('e')];

  check(fbdom.proximoPendente(fila, 'b')?.id === 'd', 'pula os respondidos e vai para o proximo que espera');
  check(fbdom.proximoPendente(fila, 'd')?.id === 'e', 'anda para a frente');

  /**
   * **Da a volta ao comeco, e isso nao e enfeite:** comecando no meio do post, so-para-frente
   * deixaria todo mundo que esta acima sem resposta e a fila terminaria cedo.
   */
  check(fbdom.proximoPendente(fila, 'e')?.id === 'b', 'no fim, volta ao comeco e acha quem ficou para tras');

  // Nunca devolve o atual: o painel sairia de cima dele apontando para ele mesmo.
  check(fbdom.proximoPendente([c('a', true), c('b')], 'b') === null, 'sozinho na fila, nao devolve ele mesmo');

  /**
   * **`null` quando mais ninguem espera** — e a diferenca desta funcao para as SETAS, que
   * circulam. Avanco automatico que da a volta reofereceria quem acabou de ser respondido, e o
   * painel diria "proximo" apontando para trabalho feito.
   */
  check(fbdom.proximoPendente([c('a', true), c('b', true)], 'a') === null, 'todos respondidos devolve nulo');
  check(fbdom.proximoPendente([], 'a') === null, 'fila vazia devolve nulo');
  check(fbdom.proximoPendente(null, 'a') === null, 'lista nula devolve nulo');

  // Id que nao esta na lista (o comentario saiu da tela): comeca do topo em vez de travar.
  check(fbdom.proximoPendente(fila, 'zzz')?.id === 'b', 'id desconhecido comeca do primeiro que espera');
}

grupo('curtir e ocultar: a fileira do comentario, por texto EXATO');
{
  /**
   * A fileira medida em 19/10 e `Curtir | Responder | Enviar mensagem | Ocultar`. **Clicar e agir
   * na pagina dele**, entao a lista e de PERMISSAO e o casamento e justo: "contem" faria
   * "Ocultar" casar com "Ocultar todos os comentarios desta pessoa".
   */
  const bt = (texto, pressed) => ({
    seletor: '[role="button"]',
    innerText: texto,
    cliques: 0,
    getAttribute: (k) => (k === 'aria-pressed' ? pressed ?? null : null),
    click() {
      this.cliques++;
    },
  });
  const art = (botoes) => ({ querySelectorAll: () => botoes });

  const curtir = bt('Curtir');
  const ocultar = bt('Ocultar');
  const comum = art([curtir, bt('Responder'), bt('Enviar mensagem'), ocultar]);

  check(fbdom.botaoDoComentario(comum, 'curtir') === curtir, 'acha o Curtir deste comentario');
  check(fbdom.botaoDoComentario(comum, 'ocultar') === ocultar, 'acha o Ocultar deste comentario');
  check(fbdom.botaoDoComentario(comum, 'descurtir') === null, 'o que nao esta la devolve nulo');
  check(fbdom.botaoDoComentario(null, 'curtir') === null, 'sem article nao derruba');

  check(
    fbdom.botaoDoComentario(art([bt('Ocultar todos os comentarios desta pessoa')]), 'ocultar') === null,
    'texto PARECIDO nao conta — o casamento e exato'
  );

  /**
   * **TRES estados em `jaCurtido`, nunca dois** (a licao do `donoDoCanal`, 25/09): colapsar "nao
   * sei" em "nao curtido" faria o painel DESCURTIR o que ele curtiu, porque o botao e o mesmo nos
   * dois sentidos.
   */
  check(fbdom.jaCurtido(art([bt('Descurtir')])) === true, 'o rotulo "Descurtir" diz que ja esta curtido');
  check(fbdom.jaCurtido(art([bt('Curtir', 'true')])) === true, 'aria-pressed="true" tambem');
  check(fbdom.jaCurtido(art([bt('Curtir', 'false')])) === false, 'aria-pressed="false" diz que nao');
  check(fbdom.jaCurtido(art([bt('Curtir')])) === null, 'sem nenhum dos dois sinais: NAO DA PARA SABER');
  check(fbdom.jaCurtido(art([bt('Responder')])) === null, 'sem o botao, nao da para saber');

  // Na duvida CLICA: a assimetria que importa e nao desfazer o que ele fez.
  const semSinal = bt('Curtir');
  check(fbdom.curtirComentario(art([semSinal])) === 'cliquei', 'na duvida, curte');
  check(semSinal.cliques === 1, 'e clicou uma vez so');

  const jaEstava = bt('Descurtir');
  check(fbdom.curtirComentario(art([jaEstava])) === 'ja-estava', 'ja curtido NAO e clicado de novo');
  check(jaEstava.cliques === 0, 'e o botao nem foi tocado — clicar ali DESCURTIRIA');

  check(fbdom.curtirComentario(art([bt('Responder')])) === 'sem-botao', 'sem o Curtir, diz que nao achou');

  const paraOcultar = bt('Ocultar');
  check(fbdom.ocultarComentario(art([paraOcultar])) === true && paraOcultar.cliques === 1, 'ocultar clica uma vez');
  check(fbdom.ocultarComentario(art([bt('Curtir')])) === false, 'sem o Ocultar, devolve falso');
}

grupo('proximoPendente: o OCULTADO sai da fila; o curtido NAO');
{
  const c = (id, extra = {}) => ({ id, autor: `Fict ${id}`, respondido: false, ...extra });

  /**
   * **Correcao dele (21/10): *"ao curtir nao precisa pular a mensagem, somente ao responder"*.**
   * Curtir e um complemento — ele pode querer responder a mesma pessoa depois —, entao o
   * comentario continua esperando. Ocultado nao tem o que responder.
   */
  const fila = [c('a'), c('b', { marca: 'curtido' }), c('c', { marca: 'ocultado', foraDaFila: true }), c('d')];

  check(fbdom.proximoPendente(fila, 'a')?.id === 'b', 'o CURTIDO continua na fila');
  check(fbdom.proximoPendente(fila, 'b')?.id === 'd', 'e o ocultado e pulado');
  check(
    fbdom.proximoPendente([c('a'), c('b', { marca: 'ocultado', foraDaFila: true })], 'a') === null,
    'so sobrando ocultado, a fila acabou'
  );
  /**
   * A marca nao e `respondido`, e nao pode virar: amarelo significa "ja tem resposta nossa", e
   * curtir nao e responder.
   */
  check(fila[1].respondido === false, 'curtir nao marca como respondido');
}

grupo('enviarDaCaixa: o despacho do Enter — e o que ele NAO prova');
{
  /**
   * **O KeyboardEvent e simulado com a FORMA que o navegador entrega**, e nao com a que parece
   * certa: o construtor recebe o `init` e os campos ficam no evento. Foi um simulado com forma
   * inventada que deixou `validarComentario` passar verde por um dia (20/10).
   */
  const antes = globalThis.KeyboardEvent;
  globalThis.KeyboardEvent = class {
    constructor(tipo, init) {
      this.type = tipo;
      Object.assign(this, init || {});
    }
  };

  const eventos = [];
  let focou = 0;
  const caixa = {
    focus() {
      focou++;
      eventos.push('focus');
    },
    dispatchEvent(ev) {
      eventos.push(ev);
      return true;
    },
  };

  const devolveu = fbdom.enviarDaCaixa(caixa);

  check(devolveu === true, 'devolve true — e isso significa "despachei", NUNCA "enviou"');
  check(focou === 1, 'foca a caixa antes de despachar: editor sem foco ignora a tecla');
  check(eventos[0] === 'focus', 'o foco vem ANTES do primeiro evento, nao depois');

  const tipos = eventos.filter((e) => e !== 'focus').map((e) => e.type);
  check(
    tipos.join(',') === 'keydown,keypress,keyup',
    'despacha os tres na ordem do teclado de verdade'
  );

  /**
   * **Os quatro campos vao juntos de proposito.** Bibliotecas de editor olham campos diferentes
   * (`key`, `code`, `keyCode`, `which`), e faltar um e a forma silenciosa de nao enviar nada —
   * sem erro, sem aviso, com ele achando que respondeu.
   */
  const d = eventos.find((e) => e.type === 'keydown');
  check(d.key === 'Enter' && d.code === 'Enter', 'leva key e code');
  check(d.keyCode === 13 && d.which === 13, 'leva keyCode e which, que e o que editor antigo le');
  check(d.bubbles === true && d.cancelable === true, 'borbulha e e cancelavel, como o de verdade');

  check(fbdom.enviarDaCaixa(null) === false, 'sem caixa nao despacha nada');

  globalThis.KeyboardEvent = antes;
  // Sem `KeyboardEvent` (o Node puro) ela desiste em vez de estourar: o modulo e importado nos
  // testes, e funcao que lanca no import derruba a suite inteira.
  check(fbdom.enviarDaCaixa(caixa) === false, 'sem KeyboardEvent no ambiente, devolve falso');
}

grupo('marcacao: o nome que vai para o menu');
{
  /**
   * **O nome que o Facebook mostra carrega emoji e pontuacao, e o menu nao casa isso** — digitar o
   * nome inteiro devolveria lista vazia e a marcacao falharia sem ninguem entender por que.
   */
  check(fbdom.nomeParaMarcar('Marta Fictinha') === 'Marta Fictinha', 'nome de duas palavras vai inteiro');
  check(
    fbdom.nomeParaMarcar('Marta Fictinha Exemplo de Souza') === 'Marta Fictinha',
    'duas palavras: e o que se digita a mao, e estreita sem arriscar'
  );
  check(fbdom.nomeParaMarcar('Marta Fictinha \u{1F1E7}\u{1F1F7}') === 'Marta Fictinha', 'emoji sai');
  check(fbdom.nomeParaMarcar('Jose  dos   Santos') === 'Jose dos', 'espaco repetido nao vira palavra');
  check(fbdom.nomeParaMarcar("Sant'Ana Exemplo") === "Sant'Ana Exemplo", 'apostrofo FICA: e nome de gente');
  check(fbdom.nomeParaMarcar('Ana-Clara Exemplo') === 'Ana-Clara Exemplo', 'hifen FICA pelo mesmo motivo');
  check(fbdom.nomeParaMarcar('Joana Exemplo | Consultora') === 'Joana Exemplo', 'o que vem depois do pipe sai');

  // Sem nome legivel nao se marca nada: um "@" solto na caixa publica nao serve a ninguem.
  check(fbdom.nomeParaMarcar('\u{1F1E7}\u{1F1F7}') === '', 'nome que e so emoji devolve vazio');
  check(fbdom.nomeParaMarcar('') === '', 'vazio devolve vazio');
  check(fbdom.nomeParaMarcar(null) === '', 'nulo devolve vazio');
}

grupo('marcacao: o menu esta aberto? (ARIA)');
{
  const caixa = (attrs) => ({ nodeType: 1, getAttribute: (k) => attrs[k] ?? null });

  check(fbdom.menuDeMarcacaoAberto(caixa({ 'aria-activedescendant': 'opcao-2' })) === true, 'activedescendant com valor: o menu esta destacando uma opcao');
  check(fbdom.menuDeMarcacaoAberto(caixa({ 'aria-activedescendant': '  ' })) === false, 'activedescendant vazio nao conta');
  check(fbdom.menuDeMarcacaoAberto(caixa({ 'aria-expanded': 'true' })) === true, 'expanded=true conta');
  check(fbdom.menuDeMarcacaoAberto(caixa({ 'aria-expanded': 'false' })) === false, 'expanded=false e o estado normal da caixa');
  check(fbdom.menuDeMarcacaoAberto(caixa({})) === false, 'caixa sem nada: as setas continuam do painel');
  check(fbdom.menuDeMarcacaoAberto(null) === false, 'sem caixa, false');

  /**
   * O terceiro sinal: `aria-controls` aponta para um popup que EXISTE e tem opcao dentro. Id que
   * nao resolve nao conta — ele fica no atributo mesmo com o menu fechado.
   */
  const comPop = { nodeType: 1, getAttribute: (k) => (k === 'aria-controls' ? 'pop-1' : null) };
  comPop.ownerDocument = { getElementById: (id) => (id === 'pop-1' ? { querySelector: () => ({}) } : null) };
  check(fbdom.menuDeMarcacaoAberto(comPop) === true, 'aria-controls com popup que tem [role=option] conta');

  const popVazio = { nodeType: 1, getAttribute: (k) => (k === 'aria-controls' ? 'pop-1' : null) };
  popVazio.ownerDocument = { getElementById: () => ({ querySelector: () => null }) };
  check(fbdom.menuDeMarcacaoAberto(popVazio) === false, 'popup SEM opcao nao conta: o menu nao esta oferecendo nada');

  const semPop = { nodeType: 1, getAttribute: (k) => (k === 'aria-controls' ? 'pop-1' : null) };
  semPop.ownerDocument = { getElementById: () => null };
  check(fbdom.menuDeMarcacaoAberto(semPop) === false, 'id que nao resolve nao conta');
}

grupo('marcacao: a reserva que le so o TEXTO');
{
  /**
   * **O espaco no fim e o que diz que a marcacao acabou.** Escolhido o nome, quem continua
   * escrevendo digita um espaco antes da frase — entao `"@Mar"` segura a seta e
   * `"@Marta Fictinha "` nao.
   */
  check(fbdom.mencaoInacabada('@Mar') === true, 'a caixa termina num @ meio digitado');
  check(fbdom.mencaoInacabada('Obrigado @Marta') === true, 'no fim de uma frase tambem');
  check(fbdom.mencaoInacabada('@Marta Fictinha ') === false, 'com espaco no fim, acabou');

  /**
   * **O nome tem espaco DENTRO, e isto custou uma medicao:** a primeira versao exigia uma palavra
   * so e nao reconhecia `"@Marta Fictinha"` — que e exatamente o que a tecla M escreve. Com ela, o
   * smoke acusou a seta sendo roubada no meio da marcacao.
   */
  check(fbdom.mencaoInacabada('@Marta Fictinha') === true, 'nome de DUAS palavras ainda e marcacao em curso');
  check(
    fbdom.mencaoInacabada('@Marta Fictinha obrigado pelo apoio') === false,
    'com frase depois, acabou: o teto de tres palavras impede a leitura de valer para sempre'
  );
  // O custo conhecido, escrito: uma palavra depois do nome ainda cabe no teto.
  check(fbdom.mencaoInacabada('@Marta Fictinha obrigado') === true, 'a janela estreita que fica — a status avisa');
  check(fbdom.mencaoInacabada('') === false, 'caixa vazia nao e marcacao');
  check(fbdom.mencaoInacabada('Obrigado pelo apoio!') === false, 'texto sem @ nao e marcacao');

  // O "@" tem de abrir palavra: senao e-mail e a forma mais comum de travar a seta sem motivo.
  check(fbdom.mencaoInacabada('meu email e a@b') === false, 'arroba no meio de palavra nao conta');
  check(fbdom.mencaoInacabada('@') === false, 'arroba sozinho nao conta: o menu nem tem o que filtrar');
  check(fbdom.mencaoInacabada(' @Mar') === true, 'espaco duro conta como espaco — e o que o editor usa');
}

grupo('marcacao: comecarMencao escreve e PARA');
{
  const chamadas = [];
  const docAntes = globalThis.document;
  const winAntes = globalThis.window;

  const caixa = { innerText: '@Marta Fictinha ', focus: () => chamadas.push('focus') };
  globalThis.document = {
    createRange: () => ({ selectNodeContents() {}, collapse() {} }),
    execCommand: (cmd, _ui, texto) => {
      chamadas.push(`${cmd}:${texto}`);
      caixa.innerText += texto;
      return true;
    },
  };
  globalThis.window = { getSelection: () => ({ removeAllRanges() {}, addRange() {} }) };

  const ok = fbdom.comecarMencao(caixa, 'Joana Exemplo da Silva');
  check(ok === true, 'devolve true quando o texto entrou na caixa');
  check(caixa.innerText === '@Marta Fictinha @Joana Exemplo', 'ACRESCENTA no fim: a mencao que ja estava la fica');

  /**
   * **Letra por letra, e nao a string inteira:** o menu do Facebook reage a cada `input`, e se ele
   * abre com uma insercao unica de quinze caracteres NAO foi medido. Teclar e o caminho provado.
   */
  const inseridos = chamadas.filter((c) => c.startsWith('insertText:'));
  check(inseridos.length === '@Joana Exemplo'.length, 'uma chamada por caractere, como o dedo dele');
  check(chamadas[0] === 'focus', 'foca antes de escrever');
  check(inseridos[0] === 'insertText:@', 'o primeiro caractere e o @, que e o que abre o menu');

  // Nenhum clique, nenhum Enter: quem escolhe o nome e ele. Marcar o estranho errado num
  // comentario publico e o estrago que esta ausencia impede.
  check(!chamadas.some((c) => c === 'click' || c.includes('Enter')), 'nao clica em opcao nenhuma');

  check(fbdom.comecarMencao(null, 'Joana') === false, 'sem caixa nao escreve nada');
  check(fbdom.comecarMencao(caixa, '\u{1F1E7}\u{1F1F7}') === false, 'sem nome legivel nao escreve o @ sozinho');

  // O `execCommand` que devolve true sem o Lexical aceitar: a verdade e a caixa relida.
  const mentiroso = { innerText: 'nada muda', focus() {} };
  globalThis.document.execCommand = () => true;
  check(fbdom.comecarMencao(mentiroso, 'Joana Exemplo') === false, 'caixa que nao mudou devolve false, mesmo com o execCommand dizendo true');

  globalThis.document = docAntes;
  globalThis.window = winAntes;
}

fim();
