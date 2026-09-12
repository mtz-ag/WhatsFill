/**
 * Quem só cumprimentou, mandou link ou figura recebe a mensagem do momento.
 *
 * O erro caro aqui é o FALSO POSITIVO — o inverso do `triagem.js`. Mandar "Feliz Dia dos Pais"
 * para quem perguntou outra coisa é responder ao lado, e sai de um mandato. Por isso a regra
 * exige que TODAS as mensagens da janela sejam cortesia, e metade destas asserções é sobre
 * mensagem com substância continuar de fora.
 *
 * Rode: node tests/cortesia.test.mjs
 */
import { check, grupo, fim, lib } from './_harness.mjs';
import { rajadaDeAnuncios, naoPodeFalarAgora, reclamaSemResposta, pedeLigacao, soCortesia, ehSoReacao, ultimaEhSoReacao, pedeRespostaPessoal, conversaPedeRespostaPessoal, conversaTemPerguntaAberta, soExpressaApoio, ehMensagemDeAnuncio, pedeAlgoIndefinido, pedeAjudaFinanceira, confirmaPresenca, ehRepasse, rajadaEhSoRepasse, rajadaFinal, desdeNossaUltima, ehDespedida, ultimaEhDespedida, semInteresse , pedeEmprego, ehMensagemDaPlataforma, deOutroDia, perguntaPendente, informouEndereco, pedeMaterial, pedeMaterialForaDoAnuncio, pedeColinha, pareceTextoProntoDeAnuncio, marcarLoteEncaminhado, pedeFalarComDeputado, respostasApos } from '../src/lib/cortesia.js';

const templates = await lib('templates.js');

/**
 * Os padrões do anúncio saem do STORE, e não de uma cópia escrita à mão aqui.
 *
 * A primeira versão duplicava a string — e divergiu na primeira escrita: no arquivo de teste
 * ficou `'s'` com UMA barra, que em string JS é só a letra `s`. Três asserções passaram a
 * mentir por causa disso. Lendo do store, o teste prova o valor que a extensão usa.
 */
const storeParaPadroes = await lib('store.js');
const PADROES_DO_STORE = await storeParaPadroes.get('padroesDeAnuncio');

const texto = (t) => ({ texto: t, tipo: 'TEXT' });

grupo('cortesia: cumprimento, link e figura');
{
  check(!!soCortesia([texto('Bom dia')]), 'bom dia');
  check(!!soCortesia([texto('boa tarde!')]), 'boa tarde com pontuação');
  check(!!soCortesia([texto('BOA NOITE 🙏')]), 'caixa alta e emoji');
  check(!!soCortesia([texto('Bom dia, deputado! Abraço')]), 'cumprimento com vocativo e abraço');
  check(soCortesia([texto('Bom dia')])?.motivo === 'cumprimentou', 'o motivo diz o que ela fez');

  check(!!soCortesia([{ texto: '', tipo: 'IMAGE' }]), 'figura sem legenda — o caso que sumia da conta');
  check(!!soCortesia([{ texto: '', tipo: 'STICKER' }]), 'figurinha também');
  check(soCortesia([{ texto: '', tipo: 'IMAGE' }])?.motivo === 'mandou uma figura', 'motivo da figura');

  check(!!soCortesia([texto('https://youtu.be/abc123')]), 'link sozinho');
  check(!!soCortesia([texto('www.jornal.com.br/materia')]), 'link sem http');
  check(!!soCortesia([texto('Bom dia! https://site.com/x')]), 'cumprimento mais link');

  check(!!soCortesia([texto('bom dia'), { texto: '', tipo: 'IMAGE' }, texto('boa tarde')]), 'as três são cortesia');

  // A janela é de 3 por pedido dele. Substância DENTRO dela derruba; fora dela, não — quem
  // escreveu algo há semanas e hoje só manda "bom dia" está cumprimentando.
  check(
    soCortesia([texto('quero receber o conteúdo do Flávio'), texto('bom dia'), texto('boa tarde')]) === null,
    'substância dentro das últimas 3 derruba'
  );
  check(
    !!soCortesia([texto('quero receber o conteúdo do Flávio'), texto('bom dia'), texto('boa tarde'), texto('bom dia')]),
    'a mesma frase, agora fora da janela de 3, não impede'
  );
}

grupo('cortesia: o que NÃO pode virar mensagem do momento');
{
  check(soCortesia([texto('Bom dia, preciso falar com o deputado')]) === null, 'cumprimento com pedido junto');
  check(soCortesia([texto('boa tarde, quero receber os conteúdos')]) === null, 'cumprimento com interesse junto');
  check(soCortesia([texto('Olá! Eu apoio o Flávio e quero ajudar')]) === null, 'aceite do anúncio não é cortesia');
  check(soCortesia([texto('Meu nome é Maria Silva / Pelotas')]) === null, 'resposta ao formulário não é cortesia');
  check(soCortesia([]) === null, 'conversa vazia não é cortesia');
  check(soCortesia([{ texto: '', tipo: 'AUDIO' }]) === null, 'áudio não é figura — pede outra resposta');
  check(soCortesia([texto('bom dia'), texto('preciso de ajuda')]) === null, 'uma com substância derruba o conjunto');
  check(soCortesia([{ texto: 'olha esse absurdo aqui na minha rua', tipo: 'IMAGE' }]) === null, 'figura com legenda de peso');
  check(soCortesia(null) === null, 'entrada inválida não explode');
}

grupo('ultima mensagem e so uma reacao: figura, figurinha, emoji ou link');
{
  check(ehSoReacao({ texto: '', tipo: 'IMAGE' }), 'figura sem legenda');
  check(ehSoReacao({ texto: '', tipo: 'STICKER' }), 'figurinha');
  check(ehSoReacao({ texto: '👍', tipo: 'TEXT' }), 'emoji sozinho');
  check(ehSoReacao({ texto: '🙏🙏🙏', tipo: 'TEXT' }), 'emoji repetido');
  check(ehSoReacao({ texto: '👍🏽', tipo: 'TEXT' }), 'emoji com tom de pele');
  check(ehSoReacao({ texto: 'https://youtu.be/abc', tipo: 'TEXT' }), 'link sozinho');
  check(ehSoReacao({ texto: 'www.jornal.com.br/x', tipo: 'TEXT' }), 'link sem http');

  // A instância de regex com `g` guardava posição entre chamadas: o mesmo texto dava resultado
  // diferente na segunda vez, e isso só apareceria no segundo contato da rodada.
  check(ehSoReacao({ texto: '👍', tipo: 'TEXT' }), 'o mesmo emoji de novo (regex não pode guardar estado)');
  check(ehSoReacao({ texto: '👍', tipo: 'TEXT' }), 'e uma terceira vez');
}

grupo('reacao: o que NAO conta');
{
  check(!ehSoReacao({ texto: 'bom dia', tipo: 'TEXT' }), 'cumprimento escrito não é reação (é caso da cortesia)');
  check(!ehSoReacao({ texto: 'quero o conteúdo', tipo: 'TEXT' }), 'texto com substância');
  check(!ehSoReacao({ texto: '...', tipo: 'TEXT' }), 'só pontuação não merece mensagem do momento');
  check(!ehSoReacao({ texto: '!!!', tipo: 'TEXT' }), 'só exclamação também não');
  check(!ehSoReacao({ texto: '', tipo: 'AUDIO' }), 'áudio não é figura');
  check(!ehSoReacao({ texto: 'olha isso aqui https://site.com', tipo: 'TEXT' }), 'link com comentário junto');
  check(!ehSoReacao({ texto: 'olha esse absurdo', tipo: 'IMAGE' }), 'figura com legenda de peso');
  check(!ehSoReacao(null), 'nulo não explode');
}

grupo('ultimaEhSoReacao olha so a ultima');
{
  const t = (x) => ({ texto: x, tipo: 'TEXT' });
  check(ultimaEhSoReacao([t('quero o conteudo'), { texto: '', tipo: 'IMAGE' }]), 'a última é figura');
  check(!ultimaEhSoReacao([{ texto: '', tipo: 'IMAGE' }, t('quero o conteudo')]), 'a última tem substância');
  check(!ultimaEhSoReacao([]), 'conversa vazia');
  check(!ultimaEhSoReacao(null), 'nulo não explode');
}

grupo('mensagem que pede resposta escrita por voce');
{
  check(!!pedeRespostaPessoal({ texto: '', tipo: 'AUDIO' }), 'áudio pede sempre');
  check(/áudio/.test(pedeRespostaPessoal({ texto: '', tipo: 'AUDIO' }).motivo), 'o motivo diz que foi áudio');
  /**
   * O vídeo saiu daqui em 31/08, a pedido dele (print do Odone): *"não existe essa de parar pra
   * ver vídeos e responder"*. A asserção antiga dizia o contrário e fica trocada, não apagada —
   * a reversão é o que impede alguém de "consertar" isto de volta daqui a um mês.
   */
  check(!pedeRespostaPessoal({ texto: '', tipo: 'VIDEO' }), 'vídeo NÃO pede — é conteúdo repassado');
  check(!!pedeRespostaPessoal({ texto: '', tipo: 'DOCUMENT' }), 'documento também');

  /**
   * Áudio TRANSCRITO não pode alegar que precisa ser aberto (01/09/2026).
   *
   * O motivo "só dá para responder depois de abrir" nasceu quando áudio chegava vazio. Com a
   * transcrição na tela, a caixa aparecia com o texto inteiro do lado e ainda dizia isso — e o
   * efeito não era só cosmético: a regra da tecla 6 vencia pelo FORMATO, sem ninguém olhar o
   * conteúdo, e a rodada parava em todo áudio.
   */
  const curto = { texto: 'bom dia, tudo bem?', tipo: 'AUDIO', transcrito: true };
  check(!pedeRespostaPessoal(curto), 'áudio transcrito CURTO não pede: as outras regras decidem pelo conteúdo');

  const falado = { texto: 'Oi, tudo bem. Queria falar contigo sobre uma coisa importante. '.repeat(12), tipo: 'AUDIO', transcrito: true };
  const rFalado = pedeRespostaPessoal(falado);
  check(!!rFalado, 'áudio transcrito LONGO continua pedendo você — é conversa');
  check(/falou/.test(rFalado.motivo), 'e o motivo diz "falou", não "escreveu" — quem lê não vai procurar um texto que não existe');
  check(!/depois de abrir/.test(rFalado.motivo), 'e não afirma mais que precisa abrir');

  // Sem a marca de transcrição, nada muda: áudio vazio continua exigindo abrir.
  check(/depois de abrir/.test(pedeRespostaPessoal({ texto: '', tipo: 'AUDIO' }).motivo), 'áudio sem transcrição não regrediu');
  check(/depois de abrir/.test(pedeRespostaPessoal({ texto: 'x', tipo: 'AUDIO', transcrito: false }).motivo), 'texto sem a marca também não conta como transcrição');

  // O caso da Janete: áudio de 1min13 que a plataforma transcreveu num texto enorme.
  const transcricao = 'Obrigada, eu já estou falando de você para meus filhos, eu tenho três filhos. '.repeat(8);
  const r = pedeRespostaPessoal({ texto: transcricao, tipo: 'TEXT' });
  check(!!r, 'transcrição longa pede resposta pessoal mesmo vindo como TEXT');
  check(/caracteres/.test(r.motivo), `o motivo diz o tamanho = ${r.motivo}`);

  check(!pedeRespostaPessoal({ texto: 'quero receber o conteúdo', tipo: 'TEXT' }), 'mensagem curta não pede');
  check(!pedeRespostaPessoal({ texto: '', tipo: 'IMAGE' }), 'figura não é caso disto (é reação)');
  check(!pedeRespostaPessoal({ texto: '', tipo: 'TEXT' }), 'vazia não pede');
  check(!pedeRespostaPessoal(null), 'nulo não explode');
}


grupo('despedida: a pessoa so fechou a conversa');
{
  const t = (x) => ({ texto: x, tipo: 'TEXT' });

  // A frase exata da print dele. A primeira versao NAO pegava: \b antes de "é" nunca casa no
  // comeco da string, porque acento nao e caractere de palavra.
  check(ehDespedida(t('É nós.')), 'É nós. — a frase da print');
  check(ehDespedida(t('É NÓS')), 'em caixa alta');
  check(ehDespedida(t('é nois')), 'escrito como se fala');

  /**
   * Estas duas diziam `ehDespedida(...)` e viraram a negacao em 31/08, por decisao dele:
   * *"a ultima mensagem foi tamojuntos, seria estamos juntos"*. Solidariedade nao e fecho — quem
   * diz que esta junto esta afirmando apoio, e a resposta e reconhecer, nao encerrar.
   *
   * Trocadas e nao apagadas: lidas sozinhas, as antigas soavam corretas.
   */
  check(!ehDespedida(t('Tamo junto!')), 'tamo junto e APOIO, nao despedida');
  check(!ehDespedida(t('estamos juntos 🙏')), 'estamos juntos tambem');
  check(ehDespedida(t('Abraço')), 'abraço');
  check(ehDespedida(t('forte abraço')), 'forte abraço');
  check(ehDespedida(t('Valeu')), 'valeu');
  check(ehDespedida(t('vlw')), 'vlw');
  check(!ehDespedida(t('tmj')), 'tmj e a abreviacao de tamo junto: apoio');
  check(ehDespedida(t('Obrigada')), 'obrigada');
  check(ehDespedida(t('Que Deus abençoe')), 'bencao tambem fecha conversa');
  check(ehDespedida(t('Valeu, abraço!')), 'duas despedidas juntas');
}

grupo('despedida: o que NAO pode virar concluir');
{
  const t = (x) => ({ texto: x, tipo: 'TEXT' });

  // Concluir aqui seria fechar a porta na cara de quem pediu alguma coisa.
  check(!ehDespedida(t('É nós, me manda o material')), 'despedida com pedido junto');
  check(!ehDespedida(t('Valeu, mas preciso de ajuda')), 'valeu com pedido de ajuda');
  check(!ehDespedida(t('quero o conteudo')), 'pedido puro');
  check(!ehDespedida(t('bom dia')), 'cumprimento nao e despedida');
  check(!ehDespedida(t('')), 'vazia');
  check(!ehDespedida(null), 'nulo nao explode');

  check(ultimaEhDespedida([t('quero conteudo'), t('É nós')]), 'olha a ultima');
  check(!ultimaEhDespedida([t('É nós'), t('me manda o material')]), 'a ultima tem pedido');
  check(!ultimaEhDespedida([]), 'vazio');
}


grupo('despedida com vocativo: "Amem mestre"');
{
  const t = (x) => ({ texto: x, tipo: 'TEXT' });
  // Print dele: a pessoa escreveu "Amem mestre" e a caixa sugeriu perguntar interesse. O
  // vocativo sobrava e derrubava a regra.
  check(ehDespedida(t('Amém mestre')), 'Amém mestre — o caso da print');
  check(ehDespedida(t('Amem chefe')), 'amem chefe');
  check(ehDespedida(t('É nós guerreiro')), 'é nós guerreiro');
  check(ehDespedida(t('Valeu parceiro')), 'valeu parceiro');
  check(ehDespedida(t('Obrigado meu irmão')), 'obrigado meu irmão');

  // O vocativo nao pode engolir pedido de verdade.
  check(!ehDespedida(t('Amém, mas preciso de ajuda')), 'amém com pedido junto');
  check(!ehDespedida(t('mestre, me manda o material')), 'vocativo com pedido');
}


grupo('rajadaFinal: o que chegou depois da nossa ultima mensagem');
{
  const m = (texto, at) => ({ texto, tipo: 'TEXT', at });
  const lista = [
    m('antiga', '2026-08-31T10:00:00Z'),
    m('depois 1', '2026-08-31T18:17:00Z'),
    m('depois 2', '2026-08-31T18:19:00Z'),
  ];

  const r = rajadaFinal(lista, '2026-08-31T15:55:00Z');
  check(r.length === 2 && r[0].texto === 'depois 1', 'pega so as posteriores a nossa');

  /**
   * Esta assercao dizia `=== 3` ("sem nossa mensagem, a rajada e tudo") e caiu em 31/08, com a
   * print do Odone: sem parada por tempo, quem nunca foi respondido tinha o historico inteiro
   * como rajada, e 76 repasses viravam "conversa de 3254 caracteres".
   *
   * A de 10:00 esta a oito horas das outras duas: nao e a mesma rajada. Trocada e nao apagada,
   * para que a reversao fique legivel para quem vier depois.
   */
  check(rajadaFinal(lista, null).length === 2, 'sem nossa mensagem, a rajada vai ate o buraco de tempo');

  // Mensagem sem `at` entra: por fora, a soma baixa e o modelo volta a ser sugerido — que e
  // exatamente o defeito que isto conserta.
  check(rajadaFinal([m('sem hora', null)], '2026-08-31T15:55:00Z').length === 1, 'sem hora, entra');
}

grupo('conversaPedeRespostaPessoal: tres mensagens curtas somam como uma longa');
{
  const NOSSA = '2026-08-31T15:55:00Z';
  const m = (texto, at, tipo) => ({ texto, tipo: tipo || 'TEXT', at });

  /**
   * O caso REAL da print de 31/08 (texto encurtado, sem dado de eleitor).
   *
   * Tres mensagens em dois minutos, cada uma abaixo do limite de 400, o conjunto acima. Antes
   * disto a rodada sugeria MANDAR O MODELO DA CAMPANHA para quem tinha acabado de avisar que
   * gente paga podia estar se passando por apoiador.
   */
  const rajada = [
    m('a'.repeat(250), '2026-08-31T18:17:00Z'),
    m('b'.repeat(55), '2026-08-31T18:18:00Z'),
    m('c'.repeat(145), '2026-08-31T18:19:00Z'),
  ];
  const r = conversaPedeRespostaPessoal(rajada, NOSSA);
  check(!!r, 'a rajada de 450 caracteres pede resposta pessoal');
  check(/3 mensagens/.test(r.motivo), 'e o motivo diz que foram varias: ' + (r && r.motivo));

  // Rajada curta continua sendo caso de resposta pronta.
  const curta = [m('oi', '2026-08-31T18:17:00Z'), m('tudo bem?', '2026-08-31T18:18:00Z')];
  check(!conversaPedeRespostaPessoal(curta, NOSSA), 'duas mensagens curtas nao viram conversa');

  // Tipo vence tamanho, e em qualquer posicao da rajada.
  const comAudio = [m('', '2026-08-31T18:17:00Z', 'AUDIO'), m('oi', '2026-08-31T18:18:00Z')];
  check(!!conversaPedeRespostaPessoal(comAudio, NOSSA), 'audio no meio da rajada pede voce');

  // Uma mensagem longa sozinha mantem o motivo antigo, sem contagem de mensagens.
  const umaLonga = [m('x'.repeat(500), '2026-08-31T18:17:00Z')];
  const r2 = conversaPedeRespostaPessoal(umaLonga, NOSSA);
  check(!!r2 && !/mensagens/.test(r2.motivo), 'uma so nao fala em varias mensagens');

  check(!conversaPedeRespostaPessoal([], NOSSA), 'sem rajada, nao ha o que responder');
}


grupo('conversaTemPerguntaAberta: so razao e posicao, nao toda pergunta');
{
  const E = (...t) => t.map((texto, i) => ({ texto, tipo: 'TEXT', at: `2026-08-31T23:2${i}:00Z` }));
  const q = (...t) => conversaTemPerguntaAberta(E(...t), null);

  // O caso REAL da print da Clair (31/08).
  check(!!q('tem muita propaganda aqui em santa Maria, mas não do capitão Martins.', 'Porque?'),
    'a pergunta da Clair pede resposta a mao');

  // Razao, nas grafias que aparecem no WhatsApp.
  check(!!q('por que ele nao veio aqui?'), 'por que separado');
  check(!!q('pq nao tem material aqui'), 'pq abreviado');
  check(!!q('por quê?'), 'com acento circunflexo');

  // Posicao: depende do que ELE pensa, e nenhum texto pronto cobre.
  check(!!q('qual a posição dele sobre a reforma?'), 'qual a posicao');
  check(!!q('o que ele acha disso?'), 'o que ele acha');
  check(!!q('o que vocês vão fazer sobre isso?'), 'o que voces vao fazer');
  check(!!q('me explica melhor'), 'pedido de explicacao');

  /**
   * Os falsos positivos que importam: cada um destes tiraria um contato da automacao, e a meta
   * dele e 90% resolvido SEM IA. Pergunta que pede material tem resposta pronta e continua indo
   * para o modelo.
   */
  check(!q('pode me mandar o material?'), 'pedido de material nao vira resposta a mao');
  check(!q('me manda o link do grupo?'), 'pedido de link tambem nao');
  check(!q('quero receber as novidades'), 'querer receber nao e pergunta aberta');
  check(!q('Tudo bem?'), 'cortesia com interrogacao nao conta');
  check(!q('quero ajudar na campanha'), 'oferta de ajuda nao conta');
  check(!q('Bom dia!'), 'cumprimento nao conta');
  check(!q(''), 'texto vazio nao conta');

  check(!conversaTemPerguntaAberta([], null), 'sem rajada nao ha pergunta');

  /**
   * **"Como consigo..." e pergunta de LOGISTICA** -- anotacao do Valdomiro (03/09/2026):
   * *"Boa tarde Como consigo as coisas de campanha adevisto bandeira camiseta?"*, e a rodada mandou
   * o cartao da campanha e concluiu. Ele: *"nao respondeu a pergunta e concluiu"*.
   *
   * Adesivo, bandeira e camiseta sao coisa fisica: quem responde e quem sabe onde tem, quem entrega
   * e quando. Mandar o modelo e responder "pega o material" a quem perguntou COMO pega.
   */
  check(q('Boa tarde Como consigo as coisas de campanha adevisto bandeira camiseta?'), 'o caso do Valdomiro');
  check(q('onde consigo uma bandeira?'), 'onde consigo');
  check(q('Como faco pra conversar com voces'), 'como faco, no comeco, sem interrogacao');

  /**
   * **A exclusao de proposito continua de pe**, e quem a mantem e o `PEDIDO_DE_MATERIAL`, que
   * desarma a mensagem inteira: pedir material tem resposta pronta.
   */
  check(!q('Como consigo receber o conteudo de voces?'), '"receber" desarma: segue sendo caso de modelo');
  check(!q('me manda como consigo o material'), '"me manda" tambem desarma');

  // "posso" ficou de fora: oferta e o publico principal desta base.
  check(!q('Como posso ajudar na campanha?'), 'oferta de ajuda nao vira atendimento a mao');
  // E a guarda de POSICAO segura o resto.
  check(!q('nao sei como consigo agradecer voces'), 'no meio da frase e sem "?" nao conta');
}


grupo('pergunta: "pq" no MEIO da frase e conjuncao, nao pergunta');
{
  const E = (...t) => t.map((texto, i) => ({ texto, tipo: 'TEXT', at: `2026-08-31T23:2${i}:00Z` }));
  const q = (...t) => !!conversaTemPerguntaAberta(E(...t), null);

  /**
   * Regressao da print do Ciro (31/08): *"ficou muito grato pq sou Bolsonaro desde sempre"*
   * virava "fez uma pergunta" e ia para resposta a mao. "pq" explicativo e dos usos mais
   * comuns do portugues de WhatsApp — a regra tirava da automacao justamente quem agradecia.
   */
  check(!q('Pode e desde ja ficou muito grato pq sou Bolsonaro desde sempre e vou votar no PL'),
    'pq explicativo no meio da frase NAO e pergunta');
  check(!q('vou votar nele pq confio'), 'outro pq explicativo');
  check(!q('eu apoio ele porque acredito no trabalho'), 'porque explicativo por extenso');

  // E o que continua valendo: interrogacao, ou o padrao no comeco da mensagem.
  check(q('Porque?'), 'com interrogacao vale');
  check(q('pq nao tem material aqui'), 'no comeco da mensagem vale');
  check(q('tem muita propaganda aqui, mas nao do capitao.', 'Porque?'), 'a pergunta na 2a mensagem vale');
  check(q('por que ele nao veio aqui?'), 'por que separado com interrogacao');
}

grupo('mensagem do ANUNCIO se reconhece pelo TEXTO, nao pela posicao');
{
  const P = PADROES_DO_STORE;
  const M = (texto, tipo, at) => ({ texto, tipo: tipo || 'TEXT', at: at || '2026-09-01T18:52:00Z' });

  check(ehMensagemDeAnuncio(M('Olá! Eu apoio as Escolas Cívico-Militares 🤙'), P), 'o texto do anuncio');
  check(ehMensagemDeAnuncio(M('Ola! Eu apoio o Flávio, Zucco e Capitão Martim'), P), 'sem acento tambem');
  check(ehMensagemDeAnuncio(M('olá! eu apoio'), P), 'em minusculas tambem');

  check(!ehMensagemDeAnuncio(M('Eu apoio muito voces'), P), 'apoio ESCRITO por ela nao e do anuncio');
  check(!ehMensagemDeAnuncio(M('sempre com voces'), P), 'nem outras formas de apoio');
  check(!ehMensagemDeAnuncio(M(''), P), 'vazio nao e do anuncio');

  /**
   * Expressao invalida na Config nao pode derrubar a leitura da conversa: cada padrao e tentado
   * por conta propria, e o que nao compila e ignorado em silencio.
   */
  check(ehMensagemDeAnuncio(M('Olá! Eu apoio X'), ['((((', '^ol[áa]!?\\s+eu\\s+apoio']),
    'padrao invalido e ignorado, o valido continua valendo');
  check(!ehMensagemDeAnuncio(M('qualquer coisa'), ['((((']), 'so padrao invalido: nao casa nada');
  check(!ehMensagemDeAnuncio(M('Olá! Eu apoio X'), []), 'sem padroes, nada e do anuncio');
}

grupo('soExpressaApoio: ela precisa ter escrito algo QUE NAO SEJA o texto do anuncio');
{
  const P = PADROES_DO_STORE;
  const M = (texto, tipo, at) => ({ texto, tipo: tipo || 'TEXT', at });

  /**
   * Print da Erenita (01/09), e o defeito era meu: a versao anterior excluia a PRIMEIRA mensagem,
   * presumindo que era a do anuncio. Ela mandou uma FIGURA antes, o texto do anuncio virou a
   * segunda, e a regra leu "Eu apoio as Escolas Civico-Militares" como apoio escrito por ela.
   *
   * *"preciso que identifique o modelo pelo texto (Ola! Eu apoio as Escolas Civico-Militares)"*.
   */
  const erenita = [
    M('', 'IMAGE', '2026-08-31T23:37:00Z'),
    M('Olá! Eu apoio as Escolas Cívico-Militares 🤙', 'TEXT', '2026-09-01T18:52:00Z'),
  ];
  check(!soExpressaApoio(erenita, null, P), 'figura antes do anuncio: NAO e apoio dela');

  // E o que continua valendo: ela escreveu algo proprio depois do clique.
  const izaak = [
    M('Olá! Eu apoio as Escolas Cívico-Militares', 'TEXT', '2026-08-31T11:44:00Z'),
    M('Tamojuntos', 'TEXT', '2026-08-31T11:44:30Z'),
  ];
  check(!!soExpressaApoio(izaak, null, P), 'Izaak: o Tamojuntos e dela');

  const ciro = [
    M('Olá! Eu apoio o Flávio, Zucco e Capitão Martim', 'TEXT', '2026-08-30T17:34:00Z'),
    M('Pode e desde já ficou muito grato pq sou Bolsonaro desde sempre e vou votar no PL', 'TEXT', '2026-08-31T00:03:00Z'),
  ];
  check(!!soExpressaApoio(ciro, null, P), 'Ciro: o texto de baixo e dele');

  /**
   * **O contra-teste que e a regra**, nas palavras dele: *"se nao tivesse o texto de baixo eu
   * mandaria o modelo, agradeceria a atencao e encerraria"*.
   */
  check(!soExpressaApoio([M('Olá! Eu apoio as Escolas', 'TEXT', '2026-09-01T18:52:00Z')], null, P),
    'so o clique no anuncio: vai para o modelo');

  // Sem os padroes configurados, o texto do anuncio conta como dela — e a regra volta a exigir
  // que haja mais de uma mensagem, que era o comportamento antigo.
  check(!!soExpressaApoio(izaak, null, []), 'sem padroes: cai no comportamento antigo');

  // O que NAO pode virar agradecimento, mesmo sendo dela.
  check(!soExpressaApoio([M('Olá! Eu apoio X', 'TEXT', '2026-09-01T18:00:00Z'), M('apoio, mas por que nao vem aqui?', 'TEXT', '2026-09-01T18:05:00Z')], null, P),
    'apoio + pergunta e pergunta');
  check(!soExpressaApoio([M('Olá! Eu apoio X', 'TEXT', '2026-09-01T18:00:00Z'), M('apoio, me manda o material?', 'TEXT', '2026-09-01T18:05:00Z')], null, P),
    'apoio + pedido e pedido');
  check(!soExpressaApoio([M('Olá! Eu apoio X', 'TEXT', '2026-09-01T18:00:00Z'), M('bom dia', 'TEXT', '2026-09-01T18:05:00Z')], null, P),
    'cumprimento nao e apoio');

  check(!soExpressaApoio([], null, P), 'sem rajada nao ha o que agradecer');
}

grupo('video compartilhado NAO para a fila; audio sim');
{
  const M = (tipo, texto) => [{ texto: texto || '', tipo, at: '2026-08-31T23:20:00Z' }];

  /**
   * Print do Odone (31/08): reel do Instagram e video do Facebook de 631 mil visualizacoes. A
   * caixa mandava responder a mao. *"sao centenas de mensagens e crescendo, nao existe essa de
   * parar pra ver videos e responder, e ignorar dando bom dia ou enrolar com outro assunto"*.
   */
  check(!conversaPedeRespostaPessoal(M('VIDEO'), null), 'video NAO pede resposta a mao');
  check(ultimaEhSoReacao(M('VIDEO')), 'video conta como reacao: vai para a mensagem do momento');

  /**
   * O contra-teste, e a razao de a mudanca ser segura: AUDIO e a pessoa gravando para ELE. O
   * caso que criou a regra foi 1min13 sobre a familia e a igreja, e mandar modelo ali parece
   * deboche. Video compartilhado e conteudo de terceiro chegando pela decima vez no dia.
   */
  check(!!conversaPedeRespostaPessoal(M('AUDIO'), null), 'audio continua pedindo resposta a mao');
  check(!ultimaEhSoReacao(M('AUDIO')), 'e audio nao vira reacao');

  // O que a pessoa anexou ou enderecou a ele continua pedindo.
  check(!!conversaPedeRespostaPessoal(M('DOCUMENT'), null), 'arquivo pede');
  check(!!conversaPedeRespostaPessoal(M('CONTACT'), null), 'contato pede');
  check(!!conversaPedeRespostaPessoal(M('LOCATION'), null), 'localizacao pede');

  // O nome do tipo aparece certo na frase da caixa (antes, tudo que nao era audio/video
  // virava "um arquivo").
  check(/localização/.test(conversaPedeRespostaPessoal(M('LOCATION'), null).motivo), 'localizacao tem nome proprio na frase');
  check(/contato/.test(conversaPedeRespostaPessoal(M('CONTACT'), null).motivo), 'contato tambem');

  // Video COM texto longo junto continua sendo conversa: o texto e que manda.
  const comTexto = [{ texto: 'a'.repeat(500), tipo: 'VIDEO', at: '2026-08-31T23:20:00Z' }];
  check(!!conversaPedeRespostaPessoal(comTexto, null), 'video com texto longo junto ainda pede voce');
}


grupo('rajada: para no buraco de tempo, senao o historico inteiro vira "conversa"');
{
  /**
   * Print do Odone (31/08), e o defeito era meu, do mesmo dia.
   *
   * Ele compartilha video o dia todo e nunca foi respondido. Sem parada por tempo, a "rajada"
   * era o historico INTEIRO: a caixa anunciou *"escreveu 76 mensagens somando 3254 caracteres —
   * e conversa"*. Nao era: 43 caracteres por mensagem, links e repasses acumulados.
   *
   * O erro foi de definicao — tratei "tudo que nao respondemos" como "tudo que ela escreveu de
   * uma vez". A diferenca entre as duas coisas e o relogio.
   */
  const odone = [];
  for (let i = 0; i < 76; i++) {
    const d = new Date(Date.UTC(2026, 7, 1 + Math.floor(i / 3), 12 + (i % 3) * 4, 0, 0));
    odone.push({ texto: 'https://www.facebook.com/share/v/' + i, tipo: 'VIDEO', at: d.toISOString() });
  }
  check(rajadaFinal(odone, null).length === 1, 'so a ultima entra: as outras vieram horas antes');
  check(!conversaPedeRespostaPessoal(odone, null), 'e 76 repasses nao viram "conversa"');

  /**
   * O contra-teste: o caso que criou a regra continua valendo. Tres mensagens em dois minutos.
   */
  const alerta = [
    { texto: 'a'.repeat(250), tipo: 'TEXT', at: '2026-08-31T21:17:00Z' },
    { texto: 'b'.repeat(55), tipo: 'TEXT', at: '2026-08-31T21:18:00Z' },
    { texto: 'c'.repeat(145), tipo: 'TEXT', at: '2026-08-31T21:19:00Z' },
  ];
  check(rajadaFinal(alerta, null).length === 3, 'tres em dois minutos sao uma rajada so');
  check(!!conversaPedeRespostaPessoal(alerta, null), 'e continuam pedindo resposta a mao');

  // A fronteira dos 30 minutos, dos dois lados.
  const perto = [
    { texto: 'x'.repeat(300), tipo: 'TEXT', at: '2026-08-31T21:00:00Z' },
    { texto: 'y'.repeat(300), tipo: 'TEXT', at: '2026-08-31T21:25:00Z' },
  ];
  check(rajadaFinal(perto, null).length === 2, '25 minutos ainda e a mesma rajada');

  const longe = [
    { texto: 'x'.repeat(300), tipo: 'TEXT', at: '2026-08-31T21:00:00Z' },
    { texto: 'y'.repeat(300), tipo: 'TEXT', at: '2026-08-31T22:00:00Z' },
  ];
  check(rajadaFinal(longe, null).length === 1, 'uma hora depois e outra rajada');
  check(!conversaPedeRespostaPessoal(longe, null), 'e as duas separadas nao somam 400');

  // A nossa mensagem continua cortando, mesmo com tudo junto no tempo.
  const respondida = [
    { texto: 'z'.repeat(300), tipo: 'TEXT', at: '2026-08-31T21:00:00Z' },
    { texto: 'w'.repeat(50), tipo: 'TEXT', at: '2026-08-31T21:10:00Z' },
  ];
  check(rajadaFinal(respondida, '2026-08-31T21:05:00Z').length === 1, 'a nossa resposta corta a rajada');

  // Sem horario nenhum, tudo entra: nao da para afirmar que houve buraco.
  const semHora = [
    { texto: 'a'.repeat(300), tipo: 'TEXT' },
    { texto: 'b'.repeat(300), tipo: 'TEXT' },
  ];
  check(rajadaFinal(semHora, null).length === 2, 'sem hora, a corrente nao quebra');
}


grupo('repasse: link e video sao ruido; emoji nao e');
{
  const M = (t, tipo, at) => ({ texto: t, tipo: tipo || 'TEXT', at: at || '2026-08-31T21:30:00Z' });

  check(ehRepasse(M('https://www.facebook.com/share/v/1Kr4Cdw')), 'link sozinho e repasse');
  check(ehRepasse(M('', 'VIDEO')), 'video e repasse');

  /**
   * A distincao inteira esta aqui: **para quem o gesto aponta.**
   *
   * Um emoji e dirigido a ELE — a Marta respondeu o anuncio com 🙏 e ali pedir os dados e o
   * certo (31/08). Um link do Facebook e conteudo de outra pessoa passando adiante, e nao diz
   * nada sobre este contato.
   */
  check(!ehRepasse(M('🙏🙏')), 'emoji NAO e repasse: e gesto dirigido a ele');
  check(!ehRepasse(M('olha isso https://x.com/a')), 'link COM texto nao e repasse: ela escreveu algo');
  check(!ehRepasse(M('bom dia')), 'texto puro nao e repasse');
  check(!ehRepasse(M('', 'AUDIO')), 'audio nunca e repasse: e a voz dela');

  // A rajada inteira.
  check(rajadaEhSoRepasse([M('https://a.com/1', 'TEXT', '2026-08-31T21:30:00Z'), M('https://b.com/2', 'VIDEO', '2026-08-31T21:33:00Z')], null),
    'rajada so de links e video e so repasse');
  check(!rajadaEhSoRepasse([M('🙏🙏')], null), 'rajada com emoji nao e so repasse');
  check(!rajadaEhSoRepasse([M('https://a.com/1', 'TEXT', '2026-08-31T21:30:00Z'), M('bom dia', 'TEXT', '2026-08-31T21:33:00Z')], null),
    'um link e um bom dia: ela escreveu algo');
  check(!rajadaEhSoRepasse([], null), 'sem rajada nao ha ruido a ignorar');
}


grupo('pedeAlgoIndefinido: pediu algo sem dizer o que — o caso de maior risco');
{
  const E = (...t) => t.map((texto, i) => ({ texto, tipo: 'TEXT', at: `2026-08-31T23:5${i}:00Z` }));
  const p = (...t) => !!pedeAlgoIndefinido(E(...t), null);

  /**
   * Print da Mari (31/08): *"Preciso da forca do senhor"*, e a caixa sugeria MANDAR O MODELO da
   * campanha. Ele: *"provavel pedido financeiro ou trabalho, vou perguntar em que posso ajudar?
   * para ter certeza"*.
   *
   * Pedido de dinheiro ou emprego nao pode receber resposta automatica (Lei 9.504/97), e material
   * de campanha em cima de quem pede ajuda e pior que nao responder.
   */
  check(p('Preciso da forca do senhor'), 'o caso da Mari');
  check(p('preciso de uma ajuda'), 'preciso de ajuda');
  check(p('conto com o senhor'), 'conto com o senhor');
  check(p('o senhor pode me ajudar?'), 'pode me ajudar');
  check(p('me ajuda por favor'), 'me ajuda');
  check(p('to passando por um problema'), 'passando por');
  check(p('estou desempregado'), 'desempregado');

  /**
   * **A armadilha do `CLAUDE.md`, e ela e a razao de a oferta desarmar a mensagem INTEIRA:**
   * *"ajuda" e a mesma palavra dos dois lados da campanha*. "Quero ajudar" e apoiador se
   * oferecendo — o publico principal. Um padrao que confunda os dois poe metade da base na fila de
   * revisao dele e o trabalho para.
   */
  check(!p('quero ajudar na campanha'), 'quero ajudar e OFERTA, nao pedido');
  check(!p('posso ajudar de alguma forma?'), 'posso ajudar tambem');
  check(!p('estou aqui para ajudar'), 'estou aqui para ajudar tambem');
  check(!p('vou ajudar a divulgar'), 'vou ajudar tambem');

  // E o vocabulario normal de apoio nao vira pedido.
  check(!p('Eu apoio o candidato'), 'apoio nao e pedido');
  check(!p('tamo junto'), 'tamo junto nao e pedido');
  check(!p('preciso te dizer que sou seu eleitor'), 'preciso DIZER nao e preciso DE algo');

  /**
   * **O que torna o pedido INDEFINIDO e o OBJETO dele** -- print da Odete (03/09/2026):
   * *"Preciso do nome de um deputado federal que seja de direita"*, e a rodada perguntou *"em que
   * voce precisa de ajuda?"*. Ele: *"interpretou 'preciso' fora de contexto, ja estava explicado"*.
   *
   * O padrao era `preciso de|da|do` e mais nada -- a regra se chama "pediu algo sem dizer o que" e
   * nao olhava o que. Mesma familia do "so mandou bom dia" que pegava um desabafo de 437
   * caracteres: nome de caixa que promete uma condicao que a condicao nao verifica.
   */
  check(!p('Preciso do nome de um deputado federal que seja de direita'), 'o caso da Odete: ela DISSE o que queria');
  check(!p('preciso do link do evento'), 'objeto concreto: link');
  check(!p('preciso de informacoes sobre a agenda'), 'objeto concreto: informacoes');
  check(!p('preciso da data da caminhada'), 'objeto concreto: data');

  // E o que continua sendo indefinido: o objeto e vago, ou e a propria pessoa.
  check(p('preciso do senhor'), 'o objeto e ele mesmo');
  check(p('preciso de voces'), 'no plural tambem');
  check(p('preciso de apoio'), 'apoio');
  check(p('necessito de uma forca'), 'necessito de uma forca');
  check(p('preciso da sua ajuda'), 'preciso da sua ajuda');

  check(!pedeAlgoIndefinido([], null), 'sem rajada nao ha pedido');
}


grupo('fronteira de palavra: (^|\\s) nao casa depois de PONTUACAO');
{
  const M = (texto, at) => ({ texto, tipo: 'TEXT', at: at || '2026-08-31T19:30:00Z' });
  /**
   * Os padroes do anuncio vao junto: sem eles, o "Eu apoio" da mensagem do ANUNCIO conta como
   * escrito por ela, e todo caso vira apoio (01/09).
   */
  const PADROES = PADROES_DO_STORE;
  const A = (t) =>
    !!soExpressaApoio([M('Olá! Eu apoio X'), M(t, '2026-08-31T19:35:00Z')], null, PADROES);
  const P = (t) => !!pedeAlgoIndefinido([M(t)], null);
  const Q = (t) => !!conversaTemPerguntaAberta([M(t)], null);

  /**
   * Print da Gessi (31/08): *"Itaqui Rs...sempre com vocês capitão"*. O "sempre" vem depois de
   * TRES PONTOS, sem espaco, e nenhum padrao pegava — `(^|\s)` exige espaco ou inicio de string.
   *
   * Foi a segunda armadilha em cima da mesma linha de codigo: `(^|\s)` era o conserto do `\b`,
   * que nao funciona antes de palavra acentuada ("E nos."). Agora e `(^|[^\p{L}])` com flag `u`.
   *
   * No WhatsApp se escreve com pontuacao colada o tempo todo, entao isto valia para os 26 padroes
   * do arquivo, nao so para este.
   */
  check(A('Itaqui Rs...sempre com vocês capitão'), 'apoio depois de tres pontos');
  check(Q('oi.Porque?'), 'pergunta depois de ponto colado');
  check(P('bom dia,preciso de ajuda'), 'pedido depois de virgula colada');

  /**
   * **E o que a fronteira nao pode fazer:** casar DENTRO de palavra. E o proposito de ter uma
   * fronteira, e `[^\p{L}]` preserva isso — ao contrario de simplesmente tirar a exigencia.
   */
  check(!A('desempre com voces'), 'nao casa no meio de palavra (desempre)');
  check(!P('imprecisao total'), 'nao casa no meio de palavra (imprecisao)');
  check(!Q('vou votar pq confio'), 'pq explicativo no meio continua fora');
}

grupo('apoio: "sempre com voces" e as formas sem verbo na frente');
{
  const M = (texto, at) => ({ texto, tipo: 'TEXT', at: at || '2026-08-31T19:30:00Z' });
  /**
   * Os padroes do anuncio vao junto: sem eles, o "Eu apoio" da mensagem do ANUNCIO conta como
   * escrito por ela, e todo caso vira apoio (01/09).
   */
  const PADROES = PADROES_DO_STORE;
  const A = (t) =>
    !!soExpressaApoio([M('Olá! Eu apoio X'), M(t, '2026-08-31T19:35:00Z')], null, PADROES);

  check(A('sempre com voces capitao'), 'sempre com voces');
  check(A('junto com o senhor'), 'junto com o senhor');
  check(A('sempre com vc'), 'sempre com vc');
  check(A('aqui com voces'), 'aqui com voces');

  /**
   * **"com voces" sozinho ficou de fora de proposito:** "preciso falar com voces" e pedido, nao
   * apoio. O que qualifica e o adverbio de permanencia — e e ele que separa quem declara lealdade
   * de quem pede contato.
   */
  check(!A('preciso falar com voces'), 'preciso falar com voces NAO e apoio');
  check(!A('vou conversar com vocês amanha'), 'conversar com voces tambem nao');
}


grupo('confirmaPresenca: quem NAO vai comeca dizendo que queria — a ressalva decide');
{
  const E = (t) => [{ texto: t, tipo: 'TEXT', at: '2026-09-01T22:35:00Z' }];
  const p = (t) => confirmaPresenca(E(t), null);

  /**
   * A frase REAL da print (01/09): *"Gostaria de estar mas sem condições 22 certamente"*.
   *
   * Ela tem "gostaria" E "certamente" — duas marcas positivas — e e uma recusa. Por isso a
   * negativa vence e o teste olha a mensagem INTEIRA, sem as "primeiras quatro palavras" que o
   * `tags.respostaAfirmativa` usa.
   */
  check(p('Gostaria de estar mas sem condições 22 certamente') === 'nao',
    'a frase da print e recusa, apesar de gostaria e certamente');

  /**
   * **`tags.respostaAfirmativa` NAO serve aqui, e e por isso que esta funcao existe.** Ele foi
   * escrito para "quer receber conteudo?", onde "gostaria" e um sim — e erra os dois lados das
   * respostas de presenca. Pergunta diferente pede vocabulario diferente.
   */
  check(p('nao vou poder ir') === 'nao', 'nao vou poder');
  check(p('sem condicoes') === 'nao', 'sem condicoes');
  check(p('infelizmente nao consigo') === 'nao', 'infelizmente');
  check(p('estarei viajando') === 'nao', 'estarei viajando');
  check(p('fica para a proxima') === 'nao', 'fica para a proxima');
  check(p('queria muito mas tenho outro compromisso') === 'nao', 'queria mas outro compromisso');

  check(p('vou sim') === 'sim', 'vou sim');
  check(p('estarei la') === 'sim', 'estarei la');
  check(p('confirmado') === 'sim', 'confirmado');
  /**
   * **"pode contar comigo" SAIU da lista** -- anotacao do Guilherme (04/09/2026): ele escreveu
   * *"Pode contar comigo e toda minha familia somos muitos e somos Bolsonarista ate a morte"* e a
   * rodada o PULOU como quem confirma presenca. *"nao e evento, somente apoiando"*.
   *
   * Terceiro apagamento desta lista pelo mesmo motivo, depois de "vamos"/"vou" (02/09) e
   * "confirmado" (04/09): vocabulario de campanha nao e resposta ao convite. A frase continua em
   * EXPRESSOES_DE_APOIO, que e de onde ela deve decidir.
   */
  check(p('pode contar comigo') === null, '"pode contar comigo" e apoio, nao presenca');
  check(p('Pode contar comigo e toda minha família somos Bolsonarista até a morte') === null,
    'o caso do Guilherme');
  check(p('com certeza vou') === 'sim', 'com certeza vou');
  check(p('vou participar') === 'sim', 'vou participar');
  check(p('la estarei') === 'sim', 'la estarei');

  /**
   * Sem resposta clara sobre presenca, devolve null e a tecla 4 manda o pedido de dados de sempre.
   * **"sim" solto nao basta**: pode ser resposta a outra pergunta, e o texto de comemoracao mandado
   * a quem nao falou de evento nenhum le como confusao.
   */
  check(p('sim') === null, 'sim solto NAO e confirmacao de presenca');
  check(p('bom dia') === null, 'cumprimento nao diz nada de presenca');
  check(p('quero receber o material') === null, 'pedido de material tambem nao');
  check(p('obrigado') === null, 'agradecimento tambem nao');
  check(p('') === null, 'vazio devolve null');
  check(confirmaPresenca([], null) === null, 'sem rajada devolve null');
}

grupo('semInteresse — recusa e hostilidade (01/09/2026)');
{
  const si = (t) => semInteresse([{ texto: t, tipo: 'TEXT' }]);

  // O print real: contato do anúncio que respondeu hostilizando. Começa com "Não" e xinga em
  // segunda pessoa — os dois caminhos da regra apontam para o mesmo lugar.
  const hostil = 'Não porque vocês pensam que os gaúchos são burros um grande mentiroso desses que nem as perguntas da dabatina sou a responder és igual o golpista presidiário do pai dele que culpar os outros sem projeto de governo uma grande lesma idiota';
  check(!!si(hostil), 'o print real é reconhecido como sem interesse');

  check(!!si('Não quero receber nada'), 'recusa explícita');
  check(!!si('me tira da lista'), 'pedido de sair da lista');
  check(!!si('para de mandar mensagem'), 'pedido de parar');
  check(!!si('Não tenho interesse'), 'sem interesse dito com essas palavras');
  check(!!si('nao'), 'só "não" — a pergunta era fechada');
  check(!!si('vocês são uns idiotas mentirosos'), 'xingamento no plural dirigido a nós');

  /**
   * **Os falsos positivos são o que decide se esta regra pode existir.**
   *
   * Marcar apoiador como sem interesse o tira da fila e deixa um rótulo permanente no CRM. Os dois
   * primeiros são os perigosos de verdade: apoiador xingando o adversário em TERCEIRA pessoa é o
   * tipo de mensagem mais comum nesta base.
   */
  check(!si('O Lula é um ladrão safado, golpista mesmo'), 'xingar o adversário em 3ª pessoa NÃO é recusa');
  check(!si('esse presidiário do Lula é um genocida'), 'nem com três palavras da lista');
  check(
    !si('Boa noite.\nRosane Requia\nCaxias do Sul\nNão faço parte de nenhum grupo político.'),
    'resposta real de apoiadora que contém "Não faço parte"'
  );
  check(!si('não sei minha cidade direito'), '"não sei" é resposta à cidade');
  check(!si('não tenho grupo mas quero ajudar'), '"não tenho grupo" é resposta aos grupos');
  check(!si('não moro mais em Canoas, agora é Pelotas'), 'correção de cidade não é recusa');
  check(!si('nao consigo abrir o link'), 'dificuldade técnica não é recusa');
  check(!si('vocês são demais, parabéns pelo trabalho'), 'elogio em segunda pessoa não é hostilidade');
  check(!si('Sim / Maria Silva / Canoas'), 'resposta ao formulário');
  check(!si(''), 'vazio');
  check(!semInteresse([]), 'sem mensagem');

  // Olha a ÚLTIMA: quem xingou ontem e hoje voltou pedindo conteúdo mudou de ideia.
  check(!semInteresse([{ texto: hostil, tipo: 'TEXT' }, { texto: 'me manda os conteudos por favor', tipo: 'TEXT' }]), 'a última mensagem é que vale');
}

grupo('recusar o EVENTO nao e recusar o contato (regressao de 01/09/2026)');
{
  const si = (t) => semInteresse([{ texto: t, tipo: 'TEXT' }]);

  /**
   * Print do Ze: veio do anuncio do evento e respondeu "Nao conseguirei ir!". A regra
   * `sem-interesse`, criada horas antes e primeira da tabela, venceu `confirmaPresenca` (que
   * acertava), etiquetou como sem interesse e concluiu EM SILENCIO.
   *
   * Era a pessoa mais engajada possivel -- veio pelo anuncio E se deu o trabalho de responder.
   */
  check(!si('Não conseguirei ir!'), 'a frase exata do print nao e sem interesse');
  check(!si('Nao vou poder ir'), 'nao vou poder ir');
  check(!si('Não posso ir dessa vez'), 'nao posso ir dessa vez');
  check(!si('não vou'), 'nao vou (curto)');
  check(!si('Não dá pra mim ir'), 'nao da pra mim ir');
  check(!si('Não conseguirei comparecer'), 'comparecer tambem conta como presenca');
  check(!si('Não poderei estar presente'), 'estar presente tambem');

  // A recusa EXPLICITA vem antes e continua vencendo, mesmo com verbo de ir dentro.
  check(!!si('nao vou mais receber isso, me tira da lista'), 'pedido de sair da lista vence o verbo de ir');
  check(!!si('Não quero receber nada'), 'recusa explicita nao regrediu');
  check(!!si('nao'), 'negativa seca nao regrediu');
}

grupo('pedeAjudaFinanceira: dinheiro pedido, e nao "ajuda" solta (02/09/2026)');
{
  /**
   * Print da Marli: ela mandou a propria chave PIX e "50 me ajuda muito", e a caixa sugeria a
   * tecla 9 -- *"pediu algo sem dizer o que"*, que e a pergunta de quem ainda nao sabe o que a
   * pessoa quer. Ali ja se sabia. Relato dele: *"aqui esta claro ela deu o pix dela e pediu 50,
   * caso de mandar a mensagem negando apoio financeiro"*.
   *
   * A caixa do quadro casava por trecho contido ("me ajuda com") e ela escreveu "me ajuda muito".
   * Palavra a palavra a lista nunca fecha -- e o que decide aqui manda uma NEGATIVA para eleitor.
   */
  const NOSSA = '2026-09-02T14:00:00Z';
  const m = (t) => ({ texto: t, tipo: 'TEXT', at: '2026-09-02T14:57:00Z' });
  const pede = (...textos) => pedeAjudaFinanceira(textos.map(m), NOSSA);

  // O caso da print, com o pedido PARTIDO em duas mensagens.
  const marli = pede('Meu Pix 01757539005', '50 me ajuda muito');
  check(!!marli, 'a chave PIX numa mensagem e o valor na outra: reconhece');
  check(/pix/i.test(marli?.motivo || ''), `e o motivo diz o que casou (${marli?.motivo})`);

  check(!!pede('me manda um pix por favor'), 'pedir pix');
  check(!!pede('preciso de R$ 200 para o remedio'), 'valor em reais');
  check(/R\$ 200/.test(pede('preciso de R$ 200 para o remedio').motivo), 'o motivo traz o valor inteiro, nao so o primeiro digito');
  check(!!pede('estou precisando de dinheiro'), 'dinheiro por extenso');
  check(!!pede('50 reais me ajudam muito'), 'valor sem cifrao');
  check(!!pede('vc tem como fazer um emprestimo'), 'emprestimo');

  /**
   * **A necessidade material exige VERBO DE PEDIR.** "tomei meu remedio" e relato, nao pedido --
   * e mandar a negativa para quem so contou da vida dela e o erro que esta regra pode cometer.
   */
  check(!!pede('preciso de uma cesta basica'), 'cesta basica com verbo de pedir');
  check(!!pede('tem como me ajudar com o gas'), 'gas com verbo de pedir');
  check(!pede('ja tomei meu remedio hoje, obrigada'), 'remedio SEM pedido nao conta');
  check(!pede('faltou gas la em casa ontem'), 'relato sobre gas tambem nao');

  /**
   * **Os falsos positivos sao o risco desta regra**, como no detector de sem interesse: "ajuda" e
   * a palavra mais comum desta base nos DOIS sentidos.
   */
  check(!pede('obrigada, voces me ajudaram muito'), 'agradecer nao e pedir');
  check(!pede('em que posso ajudar voces?'), 'oferecer ajuda nao e pedir');
  check(!pede('quero ajudar na campanha'), 'querer ajudar a campanha nao e pedir');
  check(!pede('posso ajudar de alguma forma?'), 'se oferecer nao e pedir');
  check(!pede('Ola! Eu apoio as Escolas Civico-Militares'), 'a mensagem do anuncio nao e pedido');
  check(!pede('bom dia'), 'saudacao nao e pedido');

  // Vazio e lixo nao explodem.
  check(!pedeAjudaFinanceira([], NOSSA), 'sem mensagem, null');
  check(!pedeAjudaFinanceira([m('')], NOSSA), 'mensagem vazia, null');
  check(!pedeAjudaFinanceira(null, NOSSA), 'nulo nao explode');

  /**
   * **A rajada e o que vem DEPOIS da nossa ultima mensagem** — e e por isso que a caixa do quadro
   * nao repete: respondida, a rajada esvazia e o sinal volta a ser falso sozinho.
   */
  const antesDaNossa = [{ texto: 'Meu Pix 123', tipo: 'TEXT', at: '2026-09-02T13:00:00Z' }];
  check(!pedeAjudaFinanceira(antesDaNossa, NOSSA), 'pedido anterior a nossa resposta nao conta de novo');
}


grupo('grito de campanha NAO e confirmacao de presenca (02/09/2026)');
{
  /**
   * Duas anotacoes dele, do mesmo defeito: *"Juntos vamos"* (Eliane) e *"Vamos vencer Flavio"*
   * (Mary) viravam confirmacao de presenca. A Eliane recebeu o agradecimento de um evento ja
   * passado; a Mary, sem cidade, recebeu o pedido de cadastro com preambulo de evento.
   *
   * A causa era o padrao aceitar o VERBO SOLTO (`vou|irei|vamos` seguido de espaco ou fim). Nesta
   * base isso e grito de campanha, nao RSVP -- e "vou votar em voces" casava igual.
   */
  const m = (t) => [{ texto: t, at: new Date().toISOString() }];
  const vai = (t) => confirmaPresenca(m(t), null);

  // Os falsos positivos que ele pegou, e os vizinhos deles.
  for (const t of ['Juntos vamos', 'Vamos vencer Flavio', 'Vamos juntos mudar o Rio Grande', 'vou votar em voces', 'vamos que vamos', 'Estamos juntos', 'vou orar por voces']) {
    check(vai(t) !== 'sim', `"${t}" nao e confirmacao de presenca`);
  }

  /**
   * E as confirmacoes de verdade continuam: o verbo vale com "sim", com um lugar, com verbo de
   * comparecer, ou sendo a mensagem inteira -- que e a resposta seca a "voce vai?".
   */
  for (const t of ['vou sim', 'Vou', 'irei', 'Vamos sim', 'vou estar la', 'vou la', 'vou participar', 'vou ao evento', 'Estarei la', 'confirmado', 'com certeza vou', 'la estarei']) {
    check(vai(t) === 'sim', `"${t}" continua sendo confirmacao`);
  }

  // A recusa vem primeiro e nao foi tocada.
  for (const t of ['Nao conseguirei ir', 'gostaria mas sem condicoes', 'infelizmente nao vou']) {
    check(vai(t) === 'nao', `"${t}" continua sendo recusa`);
  }
}


grupo('quer trabalhar para o mandato (02/09/2026)');
{
  /**
   * Anotacao do Kelvem Marinho: *"Queria saber como faz para trabalhar para vc aqui em sao gabriel"*
   * e, na mensagem seguinte, *"No caso vcs nao pagam"*. A rodada agradeceu e concluiu.
   *
   * O texto `pedido-emprego` existia desde sempre, entre os RESTRITOS que a IA nao pode escolher --
   * e nada no quadro o alcancava. Prometer emprego a eleitor e proibido pela Lei 9.504/97, e um
   * agradecimento generico em cima de "voces pagam?" soa como sim.
   */
  const agora = Date.now();
  const conv = (textos) => textos.map((t, i) => ({ texto: t, at: new Date(agora - (textos.length - i) * 60000).toISOString() }));
  const quer = (textos) => !!pedeEmprego(conv(textos), null);

  check(quer(['Queria saber como faz para trabalhar para vc aqui em sao gabriel']), 'o caso do Kelvem, numa mensagem');

  /**
   * **Le a rajada inteira**, pelo mesmo motivo de `pedeAjudaFinanceira`: o pedido vem partido. Foi
   * exatamente o caso dele -- a pergunta numa mensagem, o "vcs nao pagam" na seguinte.
   */
  check(quer(['Queria saber como faz para trabalhar', 'No caso vcs nao pagam']), 'e partido em duas mensagens');
  check(quer(['tem alguma vaga ai']), 'pergunta de vaga');
  check(quer(['posso mandar o meu curriculo?']), 'curriculo');
  check(quer(['preciso de um emprego']), 'pedido direto de emprego');
  check(quer(['e remunerado ou voluntario?']), 'pergunta se e remunerado');

  /**
   * **O falso positivo e o risco.** "vamos trabalhar juntos" e "obrigado pelo seu trabalho" sao a
   * fala mais comum desta base -- mandar o texto que NEGA emprego para quem estava elogiando seria
   * pior que nao ter a regra. Mesma logica das negativas benignas em `semInteresse`.
   */
  for (const t of ['vamos trabalhar juntos por um Brasil melhor', 'obrigado pelo trabalho de voces', 'parabens pelo belo trabalho', 'bom trabalho a todos', 'admiro o trabalho de voces', 'Estamos juntos']) {
    check(!quer([t]), `"${t}" nao e pedido de trabalho`);
  }

  // E nao rouba o pedido de dinheiro, que tem texto proprio.
  check(!quer(['preciso de remedio']), 'pedido de remedio nao vira pedido de emprego');
}


grupo('ir CONDICIONAL e recusa, e pergunta de politica pede voce (02/09/2026)');
{
  const m = (t) => [{ texto: t, at: new Date().toISOString() }];

  /**
   * Anotacao da Elsa Tonini: *"Eu irei so se ele vier para Bento Goncalves..."*. Ela nao vai ao
   * evento que existe -- vai a um que talvez nem aconteca. Relato dele: *"resposta ao evento que
   * nao ira"*. Ficar em silencio e pior que responder: quem escreveu uma condicao espera resposta.
   */
  check(confirmaPresenca(m('Eu irei só se ele vier para Bento Gonçalves que bom que o nosso futuro presidente vai vir'), null) === 'nao', 'o caso da Elsa: ida condicional e recusa');
  for (const t of ['vou se der', 'irei caso seja em Canoas', 'so vou se for perto', 'se ele vier aqui eu vou']) {
    check(confirmaPresenca(m(t), null) === 'nao', `"${t}" e recusa`);
  }
  // E a confirmacao sem condicao continua sendo confirmacao.
  for (const t of ['vou sim', 'irei', 'Estarei la', 'vou participar']) {
    check(confirmaPresenca(m(t), null) === 'sim', `"${t}" continua sendo sim`);
  }

  /**
   * Anotacao da Eliana: ela colou o texto do anuncio e emendou *"gostaria de saber se tem algum
   * projeto para criar leis mais rigidas..."* -- numa mensagem so, sem interrogacao. A trava de
   * posicao (que existe para o "pq" conjuncao) descartava, e ela recebeu o recibo do anuncio.
   *
   * Estas frases sao pergunta em QUALQUER posicao, e e isso que as separa do "pq".
   */
  const q = (t) => !!conversaTemPerguntaAberta(m(t), null);
  check(q('Olá! Eu apoio o Flávio, Zucco e Capitão Martim 🫡olá eu gostaria de saber se tem algum projeto para criar leis mais rígidas para punir bandidos'), 'o caso da Eliana, no meio da mensagem e sem "?"');
  for (const t of ['tem alguma lei sobre isso', 'voces vao apoiar o PL das drogas', 'o que voces vao fazer sobre a seguranca']) {
    check(q(t), `"${t}" pede voce`);
  }

  /**
   * **"tem algum material" fica de fora de proposito** -- aquilo o modelo responde perfeitamente, e
   * e a maior parte do que chega. E o "pq" conjuncao continua protegido.
   */
  for (const t of ['tem algum material para eu compartilhar?', 'quero receber o conteudo', 'tem algum grupo?', 'ficou muito grato pq sou Bolsonaro desde sempre', 'ele explica bem as coisas']) {
    check(!q(t), `"${t}" NAO pede voce`);
  }
}


grupo('texto da PLATAFORMA nao e fala da pessoa (02/09/2026)');
{
  /**
   * **A anotacao mais grave que apareceu.** O Carlos mandou um audio, e o que chegou no lugar foi
   * *"Nao foi possivel transcrever este audio"*. `semInteresse` leu o "Nao foi possivel" como
   * recusa: ele foi ETIQUETADO COMO SEM INTERESSE e concluido em silencio, sendo apoiador do
   * anuncio. Etiqueta permanente errada, no CRM, num eleitor real.
   *
   * E a Vera teve dois *"*Atencao:* o tipo da mensagem enviada pelo contato nao e suportado."*
   * lidos como "escreveu apoio em mensagem propria", e recebeu o modelo em cima de um aviso de erro.
   */
  for (const t of ['Não foi possível transcrever este áudio', '*Atenção:* o tipo da mensagem enviada pelo contato não é suportado.', 'Esta mensagem foi apagada', 'Mensagem não suportada']) {
    check(ehMensagemDaPlataforma(t), `"${t.slice(0, 40)}" e ruido da plataforma`);
  }

  /**
   * **O falso positivo e o risco.** Apagar o texto de quem falou de verdade e pior que ler o ruido:
   * o contato fica mudo para todas as regras. O asterisco no "*Atencao:*" e obrigatorio porque a
   * plataforma escreve em negrito e gente escreve sem.
   */
  for (const t of ['Não foi possível ir ao evento', 'atenção para o que eu vou dizer', 'Atenção: preciso muito de ajuda', 'não tenho interesse', 'Boa tarde', 'nao consegui transcrever o que ele falou']) {
    check(!ehMensagemDaPlataforma(t), `"${t.slice(0, 40)}" e fala de gente`);
  }

  // Com o texto esvaziado, o Carlos deixa de ser lido como recusa.
  const agora = new Date().toISOString();
  const carlos = [{ texto: 'Olá! Eu apoio as Escolas Cívico-Militares 🤝', at: agora }, { texto: '', tipo: 'AUDIO', sistema: true, at: agora }];
  check(semInteresse(carlos) === null, 'o caso do Carlos: nao e mais "sem interesse"');
}

grupo('"so cumprimentou" tem que ser SO isso');
{
  /**
   * Anotacao da Teresinha (02/09/2026): *"Boa tarde queria saber mais"*, *"Como faso pra conversar
   * com voces"*, *"Boa tarde o senhor ta concorendo tambem"* -- e ela recebeu a mensagem do momento,
   * porque a caixa de palavras casa por trecho CONTIDO. `soCortesia` responde a pergunta certa:
   * TODAS as ultimas mensagens sao so cumprimento?
   */
  const conv = (a) => a.map((t, i) => ({ texto: t, at: new Date(Date.now() - (a.length - i) * 60000).toISOString() }));

  check(soCortesia(conv(['Boa tarde'])) !== null, 'so "Boa tarde" e cortesia');
  check(soCortesia(conv(['Boa tarde queria saber mais', 'Como faso pra conversar com vocês', 'Boa tarde o senhor tá concorendo também'])) === null, 'o caso da Teresinha NAO e so cortesia');
  check(soCortesia(conv(['Oi. Bom dia, eu ja nao tenho mais esperanca nenhuma nessas eleicoes, as urnas sao fraudadas e tudo isso e tempo perdido. Triste!'])) === null, 'nem o desabafo da Cris, que comeca com "Bom dia,"');
}

grupo('pergunta sobre o que o mandato FAZ (03/09/2026)');
{
  /**
   * Anotacao da Teresinha: ela escreveu *"Tem alguem que vem na casa da gente pra conversar"* --
   * sem "?", sem "por que", sem "qual a posicao" -- e a rodada sugeriu CONCLUIR
   * (`ja-respondemos-antes`). Relato dele: *"ela quer saber se fazemos visitas, respondi a
   * pergunta, a regra de sempre responder uma pergunta tem que valer"*.
   */
  const conv = (a) => a.map((t, i) => ({ texto: t, at: new Date(Date.now() - (a.length - i) * 60000).toISOString() }));
  const pergunta = (t) => conversaTemPerguntaAberta(conv([t]), null);

  check(pergunta('Tem alguem que vem na casa da gente pra conversar') !== null, 'o caso dela');
  check(pergunta('Tem alguém que vem na casa da gente pra conversar') !== null, 'com acento tambem');
  check(pergunta('Tem como voces virem aqui') !== null, '"tem como" tambem e pergunta');
  check(pergunta('Voces fazem visita nas casas') !== null, '"voces fazem" tambem');

  /**
   * **A guarda de POSICAO e o que os mantem seguros.** No meio de um relato, "tem alguem" e
   * afirmacao -- e afirmacao virando pergunta tira da automacao quem so estava contando algo.
   */
  check(pergunta('aqui na minha rua tem alguem que apoia voces desde sempre') === null,
    'no meio da frase, e afirmacao e nao pergunta');
  check(pergunta('aqui na minha rua tem alguem que apoia voces?') !== null,
    'a mesma frase COM interrogacao volta a ser pergunta');

  // E o que ja funcionava continua: pedido de material nao e pergunta para gente.
  check(pergunta('tem algum material para eu divulgar') === null, 'pedido de material continua fora');
}

grupo('a RAJADA de mensagens proprias pede gente (03/09/2026)');
{
  /**
   * Print dele (Porto Alegre): o contato escreveu cinco mensagens -- duas perguntas sobre a
   * cobertura da imprensa, uma indignacao, um "??" e um comentario -- e recebeu **o modelo, com o
   * atendimento concluido**. *"mandou modelo e concluiu; quando tiver mensagens assim, ao menos
   * tem que deixar aberta a conversa"*.
   *
   * Nada pegava: ~230 caracteres (longe dos 400), nao e reacao, nao e despedida, e "ja tomaram
   * providencias" nao esta em lista de pergunta nenhuma -- ninguem cadastra isso.
   *
   * **O numero de mensagens era o sinal que faltava.** Quem escreve quatro vezes seguidas sem
   * resposta esta conversando.
   */
  const conv = (a) => a.map((t, i) => ({ texto: t, at: new Date(Date.now() - (a.length - i) * 60000).toISOString() }));
  const pede = (a, padroes) => conversaPedeRespostaPessoal(conv(a), null, padroes || []);

  const portoAlegre = [
    'Vocês viram a propaganda denegrindo o Flávio Bolsonaro nos canais Globo / RBS e Band do RS?',
    'Simplesmente horrível! Insinuando q. ele é bandido, etc. etc.',
    'Já tomaram providências?',
    '??',
    'Agora com o Vorcaro X careca...msg reveladoras.',
  ];
  check(pede(portoAlegre) !== null, 'o caso dele vai para gente');
  check(/4 mensagens/.test(pede(portoAlegre).motivo), 'e o "??" nao conta como mensagem propria');

  // A anotacao do jairoc: duas mensagens compridas entre emoji e link.
  const jairoc = [
    'Meu Amigo,eu Só Quero que Você Faça o que Prometem,Não dar uma de 9dedos,🙏estamsJuntos',
    '👍🏽🙏👁️👁️',
    'https://www.instagram.com/reel/Dcteaulxlps/',
    'Tem que Ser assim,Cago Fora do Pinico,tira Fora,Não Deixar Ficar 4 Anos Mámando no Governo,(No Povo)Risca os Benefícios pra Vagabundo,Não Vamos suster mais ,tem Que Trabalham,',
    'Sustentar',
  ];
  check(pede(jairoc) !== null, 'duas mensagens compridas tambem contam');

  /**
   * **Os falsos positivos sao onde esta o risco**, como sempre nesta base: tudo aqui embaixo tem
   * que continuar sendo resolvido pelo fluxo, sem tirar contato da automacao.
   */
  check(pede(['Maria Silva', 'Porto Alegre']) === null, 'a resposta do formulario nao e conversa');
  check(pede(['Bom dia', 'Boa tarde', 'Bom dia!']) === null, 'tres cumprimentos nao sao conversa');
  check(pede(['🙏', 'https://youtu.be/x', '👍']) === null, 'emoji e link nao sao conversa');
  check(pede(['Muito obrigado pelo trabalho de vocês', 'Estamos juntos sempre']) === null,
    'agradecimento curto nao e conversa');

  /**
   * **O texto do ANUNCIO nao conta como mensagem dela** -- e este e o falso positivo mais caro.
   * A Eroni clicou em tres anuncios; sem esta guarda ela iria para atendimento manual em vez de
   * receber o modelo que pediu.
   */
  const tresAnuncios = [
    'Olá! Eu apoio as Escolas Cívico-Militares 🤝',
    'Olá! Eu escolho o lado da Liberdade 👍🤝',
    'A família toda é 22👍',
  ];
  check(pede(tresAnuncios, ['Eu apoio as Escolas', 'Eu escolho o lado da Liberdade']) === null,
    'tres cliques em anuncio nao viram conversa');
  check(pede(tresAnuncios) !== null, 'sem os padroes cadastrados, elas contam — e por isso o painel os passa');

  // Uma mensagem so continua no criterio antigo: la o tamanho e o unico sinal.
  check(pede(['x'.repeat(300)]) === null, 'uma mensagem de 300 caracteres ainda nao e "texto longo"');
  check(pede(['x'.repeat(420)]) !== null, 'com 420 continua sendo');
}

grupo('insulto ao ALIADO e recusa; insulto ao adversario nao (03/09/2026)');
{
  /**
   * Anotacao da susana: ela chegou pelo anuncio, escreveu *"So prometeram e nao cumpriram"* e
   * *"Se for bolso bosta. Negativo"*, e a caixa ofereceu o recibo do anuncio + o pedido de dados.
   * Ele: *"bolso bosta esta hostilizando; ela esta se referindo ao Bolsonaro, nosso aliado, usando
   * um termo pejorativo"*.
   *
   * **A regra geral desta base continua sendo a oposta**, e e a que este arquivo protege em doze
   * assercoes: xingar o ADVERSARIO em terceira pessoa e a fala mais comum de quem apoia. O que
   * inverte aqui e de quem se fala -- estes apelidos nao sao ambiguos de direcao: ninguem que apoia
   * o mandato chama o aliado assim.
   */
  const m = (t) => ({ texto: t, tipo: 'TEXT' });

  check(!!semInteresse([m('Se for bolso bosta. Negativo')]), 'o apelido pejorativo do aliado conta');
  check(!!semInteresse([m('mais um bostanaro')]), 'e as variantes tambem');
  check(!!semInteresse([m('bando de bozo')]), 'bozo');

  /**
   * **O outro lado, que e o caro:** o apoiador xinga o adversario o tempo todo, em terceira
   * pessoa, e tirar essa gente da fila com etiqueta permanente no CRM e o pior erro possivel aqui.
   */
  check(!semInteresse([m('o Lula e um ladrao safado, golpista')]), 'xingar o adversario NAO e recusa');
  check(!semInteresse([m('esses petistas sao uns bandidos')]), 'nem no plural');
  check(!semInteresse([m('VAMOS DERRUBAR A ESQUERDA, CAPITAO CONTA COM MEU VOTO')]), 'grito de campanha nao e recusa');
  check(!semInteresse([m('bolsonaro e o melhor presidente que ja tivemos')]), 'falar BEM do aliado, muito menos');
  check(!semInteresse([m('sou bolsonarista desde sempre')]), 'e se declarar bolsonarista e apoio');
}

grupo('deOutroDia: o corte e o DIA local, nao um numero de horas (03/09/2026)');
{
  /**
   * Criterio dele, decidindo o que fazer com quem volta so dizendo que apoia: *"a mensagem tem
   * quanto tempo que mandou dando apoio; se foi no dia anterior, e mensagem do momento; se foi
   * recente, mensagem de apoio"*.
   *
   * **Dia local e nao horas** porque e o que ele LE na tela: a plataforma separa a conversa por
   * data. Horas contadas dariam resultado diferente do que ele ve -- 23h e 1h sao "ontem e hoje"
   * para quem olha, e duas horas para quem conta.
   */
  const agora = new Date('2026-09-03T15:00:00');
  const m = (at) => ({ texto: 'conte comigo', tipo: 'TEXT', at });

  check(deOutroDia([m('2026-09-02T23:50:00')], agora), 'ontem a noite e outro dia');
  check(!deOutroDia([m('2026-09-03T01:10:00')], agora), 'de madrugada HOJE nao e');
  check(!deOutroDia([m('2026-09-03T14:59:00')], agora), 'ha um minuto, muito menos');
  check(deOutroDia([m('2026-08-20T10:00:00')], agora), 'duas semanas atras tambem e outro dia');

  // Olha a ULTIMA com hora: a conversa que atravessa a meia-noite continua sendo de hoje.
  check(!deOutroDia([m('2026-09-02T22:00:00'), m('2026-09-03T09:00:00')], agora),
    'ela voltou a escrever hoje: e hoje');

  // Sem hora nao decide nada, e o lado seguro e o que NAO manda material.
  check(!deOutroDia([{ texto: 'oi', tipo: 'TEXT' }], agora), 'mensagem sem hora nao conta');
  check(!deOutroDia([], agora), 'conversa vazia');
  check(!deOutroDia(null, agora), 'nulo nao explode');
}

grupo('semInteresse le a RAJADA, e a retratacao mais nova cancela (03/09/2026)');
{
  const M = (t, i) => ({ texto: t, tipo: 'TEXT', at: `2026-09-03T19:4${i}:00Z` });
  const r = (...t) => semInteresse(t.map(M));

  /**
   * Anotacao da susana, a SEGUNDA vez que ela apareceu: *"segunda vez que ela vem e eu ja tinha
   * especificado que era hostil, por que nao gravou?"*.
   *
   * Ela escreveu *"E o bolso bosta o que cumpriu"*, *"Nunca ouvi falar do sr"* e, por ultimo, *"9"*.
   * Lendo so a ultima mensagem com texto, o insulto duas acima era invisivel.
   *
   * **Foi um teste meu que passou enquanto a producao falhava:** eu travei "bolso bosta" com uma
   * mensagem so, que era exatamente a forma que a funcao enxergava.
   */
  check(!!r('E o bolso bosta o que cumpriu', 'Nunca ouvi falar do sr', '9'), 'o caso da susana, com o insulto no meio');
  check(!!r('Nao quero receber nada', 'obrigada'), 'recusa duas mensagens atras ainda conta');

  /**
   * **A retratacao MAIS NOVA cancela** -- e o que substitui a regra antiga de "so a ultima vale",
   * sem perder o caso que ela protegia: quem xingou e depois pediu conteudo mudou de ideia.
   *
   * O criterio nao e a posicao, e o que a mensagem DIZ: pedir material ou dizer que esta junto e
   * retratacao; um "9" solto nao e.
   */
  check(!r('seus mentirosos, vocês são um lixo', 'me manda os conteudos por favor'), 'pediu conteudo depois: mudou de ideia');
  check(!r('seus mentirosos, vocês são um lixo', 'tamo junto'), 'disse que esta junto depois: idem');

  /**
   * **A recusa e testada ANTES da retratacao.** "Nao quero receber nada" tem "receber" dentro, e
   * pela ordem inversa a propria recusa se cancelava -- tres assercoes cairam de uma vez.
   */
  check(!!r('Nao quero receber nada'), 'a recusa nao se cancela sozinha');
  check(!!r('nao vou mais receber isso, me tira da lista'), 'nem o pedido de sair da lista');

  // "Nunca ouvi falar do sr" NAO e recusa: e o falso positivo que a leitura da rajada exporia.
  check(!r('Nunca ouvi falar do sr'), '"nunca ouvi falar" e desconhecimento, nao recusa');
  check(!r('nao conheco o candidato ainda'), '"nao conheco" tambem nao');
}

grupo('perguntaPendente: pergunta pendente nunca vira "conclua" (03/09/2026)');
{
  const M = (t, tipo) => ({ texto: t, tipo: tipo || 'TEXT', at: '2026-09-03T19:29:00Z' });
  const p = (...t) => perguntaPendente(t.map((x) => (typeof x === 'string' ? M(x) : x)), null);

  /**
   * Print do Paulo Quevedo: imagem de bom dia, dois links e, por ultimo, *"Colorado ou Gremista?"*.
   * A rodada recomendou CONCLUIR. Ele: *"qual a regra que ja tinhamos acertado? tem pergunta nao
   * conclui"*.
   *
   * **Este sinal NAO e `conversaTemPerguntaAberta`.** Aquele decide que o caso precisa dele
   * (tecla 6) e por isso e uma lista curta de FORMAS conhecidas -- alargar para "qualquer ?"
   * quebrou cinco exclusoes que ele ja tinha decidido, medido antes de desistir do caminho. Este
   * faz uma coisa so: impedir o desfecho irreversivel.
   */
  check(p(M('', 'IMAGE'), 'https://youtu.be/a', 'Colorado ou Gremista?'), 'o caso do Paulo');
  check(p('e o material, chega quando?'), 'pergunta comum no fim');

  /**
   * **A pergunta do MEIO conta** -- print da Ieda (04/09/2026): *"Obrigada pelas relevantes
   * informacoes!"*, *"Voce e candidato daqui do RS?"*, *"Boa tarde!"*, e a rodada ofereceu a
   * mensagem do momento. Ele: *"a sugestao queria mandar mensagem do momento ignorando a pergunta;
   * ja vimos antes que responder a pergunta e prioridade"*.
   *
   * A pergunta nao deixa de estar pendente porque ela disse "boa tarde" depois. A rajada inteira e
   * o recorte certo: por definicao e o que ainda nao foi respondido.
   */
  check(p('Obrigada pelas relevantes informações!', 'Você é candidato daqui do RS?', 'Boa tarde!'),
    'o caso da Ieda: a pergunta esta no meio da rajada');
  check(p('Colorado ou Gremista?', 'e ai'), 'mensagem qualquer depois nao cancela a pergunta');

  /**
   * **O que cancela e a RETRATACAO**, nao uma mensagem qualquer em cima -- mesma ideia da
   * retratacao em `semInteresse`.
   */
  check(!p('Colorado ou Gremista?', 'deixa pra la'), '"deixa pra la" retira a pergunta');
  check(!p('qual o endereco do comite?', 'ja achei, obrigado'), '"ja achei" tambem');
  check(!p('cade o material?', 'esquece'), 'e "esquece"');
  check(p('deixa pra la', 'mas quando vai ser o evento?'), 'a retratacao so vale para o que veio ANTES dela');

  /**
   * **As exclusoes que a lista de perguntas ja tinha continuam.** "Tudo bem?" e o cumprimento com
   * interrogacao, das formas mais comuns desta base.
   */
  /**
   * **A cortesia com "?" TAMBEM conta** -- decisao dele em 03/09/2026, desfazendo a guarda que eu
   * tinha posto: *"tudo bem exige resposta igual; quando a pessoa faz questao de botar (?) ela
   * espera uma resposta"*.
   *
   * O argumento e dele e e bom: a interrogacao e uma ESCOLHA de quem escreveu, e o custo de
   * honra-la e uma conversa que fica aberta -- nao uma mensagem errada.
   *
   * A exclusao de "Tudo bem?" continua valendo em `conversaTemPerguntaAberta`, que e outra
   * pergunta: la se decide se o caso vai para ELE. Aqui so se decide nao concluir.
   */
  check(p('Tudo bem?'), 'cortesia com "?" tambem impede concluir (decisao dele, 03/09)');
  check(p('Bom dia! tudo certo?'), 'cumprimento + gentileza com "?"');
  check(p('Boa tarde, como vai?'), 'como vai');

  /**
   * **E muita pergunta vem SEM interrogacao** -- *"isso e problematico"*, no mesmo recado. A
   * abertura interrogativa conta: quem comeca com "quem", "quando", "cade", "qual" esta
   * perguntando, com ou sem o sinal no fim.
   */
  check(p('quando vai ser o evento'), 'abertura interrogativa, sem "?"');
  check(p('cade o material que voces prometeram'), 'cade');
  check(p('qual o endereco do comite'), 'qual');
  check(p('queria saber se tem caminhada aqui'), 'pergunta declarada');
  check(p('me diz o horario por favor'), 'me diz');

  // E o que nao e pergunta continua nao sendo: e o que impede isto de esvaziar a automacao.
  check(!p('Bom dia'), 'cumprimento seco');
  check(!p('obrigado pelo trabalho de voces'), 'agradecimento');
  check(!p('tamo junto, sempre com voces'), 'apoio');
  check(!p('vou votar 22 com certeza'), 'declaracao de voto');
  check(!p('obrigado!'), 'sem interrogacao nao conta');
  check(!p(M('', 'STICKER')), 'figurinha sem texto');
  check(!perguntaPendente([], null), 'sem rajada');
  check(!perguntaPendente(null, null), 'nulo nao explode');
}

grupo('"confirmado" sozinho nao e presenca (04/09/2026)');
{
  /**
   * Anotacao da Nice: *"Nossos votos, estao confirmados: Capitao Martim para Deputado Estadual,
   * Capitao Zucco para Governador..."* -- declaracao de VOTO -- e a rodada a PULOU como quem
   * confirma presenca em evento. Ele: *"pegou confirmacao de evento sem contexto, vou mandar
   * mensagem do dia"*.
   *
   * O padrao aceitava a palavra solta em qualquer posicao, e nesta base "confirmado" e dito de
   * voto, de chapa e de agenda. Mesmo conserto que "vamos"/"vou" soltos levaram em 02/09.
   */
  const conv = (a) => a.map((t, i) => ({ texto: t, at: new Date(Date.now() - (a.length - i) * 60000).toISOString() }));
  const presenca = (t) => confirmaPresenca(conv([t]), null);

  check(presenca('Nossos votos, estão confirmados: Capitão Martim, para Deputado Estadual, Capitão ZUCCO para Governador') === null,
    'declaracao de voto nao e confirmacao de presenca');
  check(presenca('Meu voto está confirmado no 22') === null, 'nem o voto no singular');

  // E tudo o que E presenca continua sendo.
  check(presenca('Confirmado!') === 'sim', '"Confirmado!" sozinho continua valendo');
  check(presenca('presença confirmada') === 'sim', '"presenca confirmada" tambem');
  check(presenca('Confirmo minha presença') === 'sim', '"confirmo minha presenca" tambem');
  check(presenca('Quero confirmar minha presença no evento: AMIGOS CAPITAO MARTIM') === 'sim',
    'o texto do botao do anuncio continua valendo');
  check(presenca('confirmado, estarei presente') === 'sim', '"confirmado, estarei presente" tambem');
  check(presenca('Estou confirmada') === 'sim', '"estou confirmada" tambem');
  check(presenca('Estarei lá') === 'sim', 'e "estarei la"');
}

grupo('pergunta aberta: e pergunta a menos que uma pronta responda (04/09/2026)');
{
  /**
   * Print da Ieda: *"Obrigada pelas relevantes informacoes!"*, *"Voce e candidato daqui do RS?"*,
   * *"Boa tarde!"* -- e a rodada ofereceu a mensagem do momento. Ele: *"certamente e um problema de
   * ramo"*, depois de ja ter dito *"responder a pergunta e prioridade"*.
   *
   * **Terceira vez a mesma classe**, e as tres resolvidas acrescentando uma forma a lista: a
   * Teresinha ("tem alguem que vem na casa da gente"), o Paulo Quevedo ("Colorado ou Gremista?") e
   * agora a Ieda. Lista de formas nao fecha -- ninguem cadastra todas as maneiras de perguntar.
   *
   * O que fecha e a inversao: **e pergunta a menos que uma resposta pronta a responda**.
   */
  const M = (t) => [{ texto: t, at: '2026-09-04T13:43:00' }];
  const aberta = (t) => conversaTemPerguntaAberta(M(t), null) !== null;

  check(aberta('Você é candidato daqui do RS?'), 'o caso da Ieda');
  check(aberta('Colorado ou Gremista?'), 'o caso do Paulo Quevedo');
  check(aberta('Já tomaram providências?'), 'o caso de Porto Alegre');
  check(aberta('e o material, chega quando?'), 'pergunta sobre prazo');

  /**
   * **As CINCO exclusoes dele continuam** -- em 03/09 eu alarguei para "qualquer ?" sem elas e
   * quebrei as cinco. Agora estao escritas em `RESPONDIDA_POR_PRONTA`, entao deixam de ser
   * acidente. A exclusao diz QUEM responde, nunca SE responde: `perguntaPendente` continua
   * impedindo concluir em silencio.
   */
  check(!aberta('pode me mandar o material?'), '1. pedido de material');
  check(!aberta('Tudo bem?'), '2. cortesia com interrogacao');
  check(!aberta('Como posso ajudar na campanha?'), '3. oferta de ajuda');
  check(!aberta('tem algum material para eu compartilhar?'), '4. material para compartilhar');
  check(!aberta('tem algum grupo?'), '5. grupo');

  /**
   * **A guarda de POSICAO continua**: sem "?", so conta abrindo a mensagem. E ela que impede o
   * "pq" explicativo do Ciro de virar pergunta.
   */
  check(!aberta('ficou muito grato pq sou Bolsonaro desde sempre'), 'o "pq" no meio continua nao sendo pergunta');
  check(aberta('pq nao tem material aqui'), 'mas no comeco continua sendo');

  // E o que nunca foi pergunta continua fora -- e o que impede isto de esvaziar a automacao.
  for (const t of ['Bom dia', 'obrigado pelo trabalho de voces', 'tamo junto, sempre com voces',
                   'vou votar 22 com certeza', 'Olá! Eu apoio as Escolas Cívico-Militares 🤝',
                   'Nossos votos, estão confirmados: Capitão Martim para Deputado Estadual',
                   'Quero confirmar minha presença no evento: AMIGOS CAPITAO MARTIM',
                   'Maria Silva', 'Porto Alegre', 'Boa tarde!']) {
    check(!aberta(t), `nao e pergunta: "${t.slice(0, 40)}"`);
  }
}

grupo('quatro anotacoes de 04/09/2026: o 13, a piada, e a despedida amarga');
{
  const M = (t) => [{ texto: t, at: '2026-09-03T15:00:00' }];
  const sem = (...t) => semInteresse(t.map((x) => ({ texto: x })));

  /**
   * **ROSA MARIA: o numero do ADVERSARIO.** *"SOU APOSENTADA RURAL. MINHA CONCIENCIA DIZ QUE TENHO
   * QUE SER 13"* e, na seguinte, so *"13"* -- e a rodada ofereceu a mensagem do momento. Ele:
   * *"13 e numero do Lula, adversario; e comum repetirem 13 para mostrar hostilidade"*.
   *
   * E o espelho do "22" que ja conta como apoio, com a mesma guarda: o numero sozinho nao basta.
   */
  check(sem('SOU APOSENTADA RURAL. MINHA CONCIENCIA DIZ QUE TENHO QUE SER 13'), 'o caso da Rosa');
  check(sem('13'), 'o numero sozinho, que e a resposta seca de quem quer marcar posicao');
  check(sem('vou de 13'), 'e o verbo de votar junto');
  // 13 e endereco, hora e idade -- o numero solto no meio da frase nao conta.
  check(!sem('meu numero e 13 9999-0000'), 'telefone nao e voto');
  check(!sem('chego as 13 horas'), 'hora nao e voto');
  check(!sem('moro na rua 13 de maio'), 'endereco nao e voto');

  /**
   * **ALFREDO: a piada que virou etiqueta permanente.** Ele mandou uma foto e escreveu *"Nao precisa
   * muito pra ser feliz 😂😂😂😂"* -- e foi etiquetado como sem interesse e concluido em silencio.
   * *"contexto errado, vou mandar mensagem do momento"*.
   *
   * `COMECA_NEGANDO` existe porque a pergunta que fizemos era FECHADA, e resposta a pergunta fechada
   * e curta. Uma frase que segue falando de outra coisa nao e resposta a pergunta nenhuma.
   */
  check(!sem('Não precisa muito pra ser feliz 😂😂😂😂'), 'o caso do Alfredo');
  check(!sem('Não vejo a hora de votar em vocês'), 'nem o entusiasmo que comeca com "nao"');
  check(!sem('Não tem como eu ir. Mas fico aqui na torcida e orando pra tudo dar certo 🙏'), 'nem a recusa do evento');

  // E a resposta seca continua contando, que e o motivo de a regra existir.
  check(sem('Não'), '"Nao" seco continua sendo recusa');
  check(sem('Não, obrigado'), '"Nao, obrigado" tambem');
  check(sem('não quero receber nada'), 'e a negacao colada no que se recusa');

  /**
   * **EVA: "obrigada por nada" encerra a conversa.** Ela pediu ajuda financeira, recebeu a negativa
   * e respondeu *"Entao deixa muito obrigada por nada"*. A rodada ofereceu a mensagem do momento;
   * ele: *"vou concluir sem mandar nada"*, que e o desfecho da despedida.
   */
  check(ehDespedida({ texto: 'Então deixa muito obrigada por nada' }), 'a despedida amarga da Eva');
  check(ehDespedida({ texto: 'valeu por nada' }), 'e a variante');
  check(!ehDespedida({ texto: 'Muito obrigado pelo trabalho de voces' }), 'o agradecimento de verdade nao e despedida');
  check(!ehDespedida({ texto: 'obrigada pelas informacoes' }), 'nem o agradecimento pelo conteudo');
}

grupo('"Me liga": o pedido de ligacao (04/09/2026)');
{
  /**
   * Anotacao da Jucileia: ela escreveu *"Oi"*, tres mensagens que a plataforma nao leu, e
   * *"Me liga"* -- e a rodada ofereceu CONCLUIR, deixando a pessoa esperando o telefone tocar.
   * Ele: *"caso raro que a pessoa pede ligacao: criar mensagem falando que nao podemos e dando uma
   * desculpa; nao fazemos ligacoes, a plataforma nao aceita e e contraproducente"*.
   */
  const pede = (...t) => pedeLigacao(t.map((x) => ({ texto: x })));

  check(pede('Me liga'), 'o caso da Jucileia');
  check(pede('Oi', '', 'Me liga'), 'e na rajada, depois do "oi" e do ruido da plataforma');
  check(pede('Pode me ligar?'), 'a forma com pergunta');
  check(pede('liga pra mim'), 'liga pra mim');
  check(pede('quero falar por telefone'), 'falar por telefone');
  check(pede('aguardo sua ligacao'), 'aguardo sua ligacao');

  /**
   * **Os falsos positivos.** A lista e curta e literal de proposito: alargar mandaria a recusa para
   * quem so falou de telefone, e o texto diz "nao ligamos" -- e uma recusa, e recusa errada custa.
   */
  check(!pede('meu telefone mudou'), 'falar do proprio telefone nao e pedir ligacao');
  check(!pede('liguei para o CRAS e nao atenderam'), 'ligar para terceiro tambem nao');
  check(!pede('vou ligar la'), 'ela ligando nao e ela pedindo');
  check(!pede('a ligacao caiu ontem'), 'contar que a ligacao caiu tambem nao');
  check(!pede('desliga isso'), 'e nem o verbo parecido');
  check(!pede(''), 'mensagem vazia nao quebra');
}

{
  grupo('pedido financeiro com o valor por extenso (04/09/2026)');

  /**
   * Anotacao da Maira (04/09/2026): cinco mensagens contando que ficou um mes sem trabalhar por
   * doenca, que as contas acumularam, *"Me consegue eu pago"*, *"Eu tenho que comer paga
   * farmacia"* e, duas vezes, *"Qualquer mil reais ja me ajuda"*. A rodada mandou o caso para a
   * tecla 6. Ele: *"esta claro que e pedido financeiro e nao foi identificado"*.
   *
   * Duas causas somadas: o marcador de dinheiro exigia DIGITO antes de "reais", e quem escreve mil
   * ou quinhentos escreve por extenso; e aluguel e farmacia nao estavam entre as necessidades.
   */
  const dela = [
    'Boa tarde',
    'Eu fiquei um mes cem trabalho problema de saude e ai acumulo minhas contas agora que peguei um cervico pra ganha mil reais so o aluguel e 500',
    'Me consegue eu pago',
    'Eu tenho que comer paga farmacia',
    'Qualquer mil reais ja me ajuda',
  ].map((t) => ({ texto: t }));
  check(!!pedeAjudaFinanceira(dela), 'a rajada inteira e reconhecida como pedido financeiro');
  check(!!pedeAjudaFinanceira([{ texto: 'Qualquer mil reais ja me ajuda' }]), 'e a frase sozinha tambem');
  check(!!pedeAjudaFinanceira([{ texto: 'me consegue ajuda com o aluguel' }]), 'aluguel com verbo de pedir conta');
  check(!!pedeAjudaFinanceira([{ texto: 'preciso pagar a conta de luz' }]), 'e a conta de luz tambem');

  /**
   * **Os falsos positivos.** Esta regra manda uma NEGATIVA para eleitor, entao o valor por extenso
   * so vale colado em "reais" -- "mil" e a quantidade de tudo nesta base --, e as necessidades
   * continuam exigindo o verbo de pedir.
   */
  check(!pedeAjudaFinanceira([{ texto: 'mil abracos e mil vezes obrigada' }]), '"mil" sem "reais" nao e pedido');
  check(!pedeAjudaFinanceira([{ texto: 'vou votar mil vezes no Martim' }]), 'nem "mil vezes"');
  check(!pedeAjudaFinanceira([{ texto: 'pago meu aluguel em dia gracas a Deus' }]), 'falar do aluguel sem pedir nao conta');
  check(!pedeAjudaFinanceira([{ texto: 'fui na farmacia hoje' }]), 'nem falar da farmacia');
  check(!pedeAjudaFinanceira([{ texto: 'em que posso ajudar voces?' }]), 'e quem OFERECE ajuda continua de fora');
}

{
  grupo('informouEndereco — a lista de material a enviar');

  /**
   * Pedido dele (04/09/2026), com o anuncio novo de material: *"eu peco endereco... a pessoa deve
   * ser pulada e nao concluida, pois vou transferir pro responsavel a conversa no final"*, e
   * depois *"deixe somente para quando eu pedir endereco, no momento so peco endereco para enviar
   * material"*.
   *
   * **Metade destas asercoes e falso positivo, e e onde mora o risco**: a etiqueta fica permanente
   * no CRM. O separador e a CONTAGEM de marcas — endereco e uma lista de campos, reclamacao de rua
   * e uma frase.
   */
  const end = (...t) => informouEndereco(t.map((x) => ({ texto: x })));

  check(end('Rua das Flores, 123'), 'via + numero depois da virgula');
  check(end('Rua Joao Silva 456'), 'via + numero fechando a mensagem, que e como se escreve sem pontuacao');
  check(end('rua sete de setembro 200 bairro centro'), 'via + bairro');
  check(end('Meu endereco e Rua Silva 45, Canoas'), 'a palavra endereco + via');
  check(end('Av. Assis Brasil, 3500 - apto 302'), 'avenida com complemento');
  check(end('casa 12, bairro Guajuviras'), 'bairro + complemento, sem via');
  check(end('92310-000'), 'o CEP basta sozinho');
  check(end('cep 92310000 casa 2'), 'e o CEP sem o traco tambem');
  check(end('Bom dia!', 'Rua das Flores, 123'), 'acha na rajada inteira, nao so na ultima');

  /**
   * **A RAJADA, e nao a conversa inteira** -- regra dele: *"para pular o contato sempre sera depois
   * que eu pedir o endereco e etiqueta for colocada"*. O endereco que conta e o que ela escreveu
   * DEPOIS da nossa ultima mensagem, ou seja, respondendo alguma coisa nossa. Quem carrega o caso
   * adiante e a ETIQUETA, nao este detector.
   */
  const antes = [{ texto: 'Rua das Flores, 123', at: '2026-09-04T10:00:00Z' }];
  check(!informouEndereco(antes, '2026-09-04T12:00:00Z'), 'endereco anterior a nossa ultima mensagem nao conta');
  check(informouEndereco([...antes, { texto: 'Rua das Flores, 123', at: '2026-09-04T13:00:00Z' }], '2026-09-04T12:00:00Z'),
    'e o que ela escreve depois conta');

  /**
   * **Os falsos positivos.** O caro aqui e a reclamacao de rua, que e comum nesta base: ela tem a
   * via e tem digito, e o que a mantem de fora e o numero precisar de virgula na frente ou de
   * fechar a mensagem.
   */
  check(!end('a rua aqui esta esburacada ha 20 anos'), 'reclamacao de rua nao e endereco');
  check(!end('a estrada esta horrivel, precisamos de ajuda ha 2 anos assim'), 'nem reclamacao de estrada');
  check(!end('moro na rua 15 de novembro'), 'via sem numero de casa nao basta');
  check(!end('sou do bairro Restinga'), 'bairro sozinho nao basta');
  check(!end('quero receber o material'), 'pedir material nao e mandar endereco');
  check(!end('Maria da Silva, Canoas'), 'nome e cidade nao sao endereco');
  check(!end('Bom dia! Tudo bem?'), 'cortesia nao e endereco');
  check(!end(''), 'mensagem vazia nao quebra');
  check(!informouEndereco([{ texto: 'Rua das Flores, 123', sistema: true }]), 'ruido da plataforma nao conta');
  check(!informouEndereco(null), 'sem conversa nao quebra');
}

{
  grupo('a mensagem do anuncio e identificada por DADO, nao por regex (04/09/2026)');

  /**
   * Print dele: a contato chegou pelo anuncio do Facebook, escreveu so a mensagem gerada pelo
   * anuncio e recebeu **o agradecimento pelo apoio** -- *"mandou mensagem agradecendo apoio sendo
   * que e a primeira vez que aparece o contato"*.
   *
   * Medido: o padrao cadastrado e `^ol[aá]!? eu apoio` e a redacao nova do anuncio diz *"Ola! Eu
   * ESTOU DO LADO DA SEGURANCA E apoio o Capitao Martim"*. Nao casou -- entao o texto DO ANUNCIO
   * contou como fala dela, e `soExpressaApoio` deu verdadeiro.
   *
   * **Lista de texto nao fecha.** O que fecha e o dado: a plataforma diz que a sessao veio de
   * anuncio, e a primeira mensagem de uma sessao dessas e o texto pre-preenchido. Quem marca e o
   * painel (`prepararEntrantes`), num lugar so, antes de qualquer regra ver.
   */
  const PADROES_CADASTRADOS = await storeParaPadroes.get('padroesDeAnuncio');
  const doAnuncioNovo = 'Ola! Eu estou do lado da seguranca e apoio o Capitao Martim';

  check(!ehMensagemDeAnuncio({ texto: doAnuncioNovo }, PADROES_CADASTRADOS),
    'a redacao NOVA do anuncio nao casa com o padrao cadastrado -- era este o defeito');
  check(ehMensagemDeAnuncio({ texto: doAnuncioNovo, geradaPeloAnuncio: true }, PADROES_CADASTRADOS),
    'e com a marca do painel ela e reconhecida do mesmo jeito');

  // O efeito que ele viu: agradecer o apoio de quem acabou de chegar.
  const marcada = { texto: doAnuncioNovo, tipo: 'TEXT', geradaPeloAnuncio: true };
  check(!soExpressaApoio([marcada], null, PADROES_CADASTRADOS), 'com a marca, a chegada NAO conta como apoio escrito por ela');
  check(!!soExpressaApoio([{ ...marcada, geradaPeloAnuncio: false }], null, PADROES_CADASTRADOS),
    'sem a marca, contava -- e era o agradecimento saindo na primeira mensagem');

  /**
   * **O apoio de verdade continua sendo apoio.** A marca vale para UMA mensagem, a primeira da
   * sessao que veio de anuncio; o que ela escreve depois e dela.
   */
  check(!!soExpressaApoio([{ texto: 'Estou com voces, conte comigo!', tipo: 'TEXT' }], null, PADROES_CADASTRADOS),
    'quem escreve apoio depois continua sendo agradecida');
  check(!!soExpressaApoio([marcada, { texto: 'Conte comigo, sempre!', tipo: 'TEXT' }], null, PADROES_CADASTRADOS),
    'e a mensagem do anuncio seguida de apoio dela tambem');

  // A lista de padroes continua valendo: e ela que alcanca o segundo clique.
  check(ehMensagemDeAnuncio({ texto: 'Ola! Eu apoio o Capitao Martim' }, PADROES_CADASTRADOS),
    'a lista cadastrada continua reconhecendo a redacao que ela cobre');
}

{
  grupo('o material pedido nao vence com o dia (05/09/2026)');

  /**
   * Regra dele: *"o modelo de material e uma excecao, ele sempre tem que ser mandado quando
   * requisitado"*. A print: ela chegou pelo anuncio escrevendo *"Ola! Eu quero receber o Material
   * da Direita"* as 13:23, a rodada so a alcancou no dia seguinte -- e mandou a mensagem do
   * momento, concluindo.
   *
   * **Metade destas assercoes e falso positivo**, que e onde mora o risco: o objeto sozinho
   * ("obrigada pelo material") e o verbo sozinho ("quero receber a visita") aparecem o tempo todo
   * nesta base, e cada um deles sairia mandando modelo.
   */
  const pedidos = [
    'Ola! Eu quero receber o Material da Direita',
    'me manda o material por favor',
    'Pode me mandar o material?',
    'gostaria de receber os adesivos',
    'tem como enviar uns santinhos',
    'quero material',
    'como faco para conseguir bandeira',
    'quero receber o conteudo de voces',
  ];
  for (const t of pedidos) check(!!pedeMaterial([texto(t)]), `pedido reconhecido: "${t}"`);

  const naoSao = [
    'Ola! Eu apoio o Capitao Martim',
    'obrigada pelo material, muito bom',
    'ja recebi o material, valeu',
    'vou distribuir o material aqui na minha rua',
    'quero ajudar na campanha',
    'quero receber a visita de voces aqui',
    'nao quero receber material nenhum',
    'bom dia, tudo bem?',
  ];
  for (const t of naoSao) check(!pedeMaterial([texto(t)]), `nao e pedido de material: "${t}"`);

  /**
   * **Le a conversa INTEIRA, ao contrario do `informouEndereco`.** O que impede a repeticao nao e
   * a janela de tempo: e a ENTREGA, conferida por quem chama (`!modeloJaNaConversa &&
   * !enviadoHoje`). Fosse pela rajada, o pedido sumiria assim que respondessemos qualquer coisa --
   * que e justamente quando ele ainda esta de pe.
   */
  check(!!pedeMaterial([texto('quero receber o material'), texto('obrigada')]),
    'o pedido continua de pe depois de ela escrever outra coisa');
  check(!pedeMaterial([{ texto: 'quero receber o material', sistema: true }]),
    'ruido da plataforma nao conta como pedido');
}

{
  grupo('"trabalhar NA campanha" tambem e pedido de trabalho (05/09/2026)');

  /**
   * Print dele: *"Boa noite"* as 17:04 e *"Vc esta chamando gente pra trabalhar na campanha tou
   * precisando"* as 17:05. *"nao pegou o contexto"*.
   *
   * Medido: NENHUM detector via nada. A causa era gramatical -- a lista colava a preposicao no
   * artigo (`(no|na) + (o mandato|a campanha)`), e "no o mandato" nao existe. Ou seja, as tres
   * formas mais naturais de dizer isso nunca casaram, embora *"trabalhar para a campanha"*
   * casasse.
   */
  const daPrint = [texto('Boa noite'), texto('Vc esta chamando gente pra trabalhar na campanha tou precisando')];
  check(!!pedeEmprego(daPrint, null), 'a rajada da print e reconhecida como pedido de trabalho');

  for (const t of ['quero trabalhar no mandato', 'tem como trabalhar no gabinete de voces?',
                   'trabalhar na campanha de voces, como faco?', 'Voces estao contratando pessoal?']) {
    check(!!pedeEmprego([texto(t)], null), `forma reconhecida: "${t}"`);
  }

  /**
   * **Quem se OFERECE nao esta pedindo emprego**, e a metade cara da regra e esta: o texto que nega
   * abre com *"procurar trabalho cansa"* e explica que a lei proibe indicar vaga -- resposta errada
   * para quem escreveu que quer ajudar de graca. *"E remunerado ou voluntario?"* continua sendo
   * pedido, porque ali a pergunta E sobre dinheiro.
   */
  for (const t of ['sou voluntaria, quero trabalhar na campanha de voces', 'quero ajudar de graca na campanha',
                   'vamos trabalhar juntos por um Brasil melhor', 'obrigado pelo seu trabalho, admiro muito',
                   'o trabalho de voces e otimo']) {
    check(!pedeEmprego([texto(t)], null), `nao e pedido de trabalho: "${t}"`);
  }
  check(!!pedeEmprego([texto('e remunerado ou voluntario?')], null), 'perguntar se e remunerado continua sendo pedido');
}

{
  grupo('link nao e pergunta nem conversa (05/09/2026)');

  /**
   * Relato dele: *"varios casos da pessoa mandando link e reconhece como conversa e passa pra
   * mim"*.
   *
   * Medido, e a causa e boba e grande: a URL carrega a QUERY STRING (`?igsh=`, `?utm_source=`,
   * `?v=`), o teste da interrogacao via aquele "?" e o link virava *"fez uma pergunta que nenhuma
   * resposta pronta responde"* -- tecla 6, em toda pessoa que repassa video. Somava-se a soma de
   * caracteres: tres links com legenda curta dao 224 caracteres e viravam "3 mensagens proprias".
   */
  const L = 'https://www.instagram.com/reel/DCkXvC2AykS/?igsh=MWx4b3d2eDk4cXNsZw==';
  const Y = 'https://www.youtube.com/watch?v=abcdefghijk';

  check(!conversaTemPerguntaAberta([texto(L)], null), 'um link sozinho nao e pergunta');
  check(!conversaTemPerguntaAberta([texto(Y)], null), 'o link do YouTube (?v=) tambem nao');
  check(!perguntaPendente([texto(L)], null), 'e nao deixa pergunta pendente -- era o que impedia concluir');

  const rajada = [texto('olha isso ' + L), texto('veja esse ' + L), texto('e esse aqui ' + L)];
  check(!conversaPedeRespostaPessoal(rajada, null, []), 'tres links com legenda curta nao sao conversa');
  check(!conversaTemPerguntaAberta(rajada, null), 'nem pergunta');

  /**
   * **O outro lado, que e o que importa guardar:** pergunta de verdade continua indo para ele, e
   * texto escrito continua contando.
   */
  check(!!conversaTemPerguntaAberta([texto('Voce e candidato daqui do RS?')], null),
    'pergunta de verdade continua sendo pergunta');

  /**
   * **A assercao "pergunta COM link continua sendo pergunta" foi INVERTIDA em 06/09/2026**, por
   * regra dele, e a inversao esta certa: *"pergunta com link usa a regra de mandar mensagem do
   * momento ou agradecer as informacoes e encerrar"* (print do Eraldo). Ver `ehLegendaDeRepasse` —
   * o custo e conhecido e foi escolhido por ele.
   */
  check(!conversaTemPerguntaAberta([texto('o que voce acha disso? ' + L)], null),
    'pergunta colada num link NAO conta mais como pergunta (06/09)');
  check(!!conversaPedeRespostaPessoal(
    [texto('preciso muito falar com voces'), texto('ninguem me responde nunca'), texto('ja tentei varias vezes')],
    null, []), 'tres mensagens escritas de verdade continuam sendo conversa');
  check(!!conversaPedeRespostaPessoal([texto('olha ' + L), texto('a'.repeat(420))], null, []),
    'e o texto longo junto de um link tambem');
}

{
  grupo('xingamento no imperativo e hostilidade (05/09/2026)');

  /**
   * Print dele: a contato chegou pelo anuncio, mandou o texto de apoio as 23:38 e, um minuto
   * depois, *"Entao va para o inferno.. desgracado"*. *"chegou hostilizando e extensao nao
   * reconheceu"*.
   *
   * Medido: **nada** casava. `desgracado` nao estava na lista de xingamentos, e *"va para o
   * inferno"* nao estava na de segunda pessoa -- que so conhecia pronomes. Mandar alguem ir a
   * algum lugar e falar COM a pessoa.
   *
   * **Metade destas assercoes e falso positivo**, que e onde mora o risco desta regra: ela deixa
   * etiqueta permanente no CRM e conclui em silencio.
   */
  const daPrint = [
    { texto: 'Ola! Eu apoio o Flavio, Zucco e Capitao Martim', tipo: 'TEXT', geradaPeloAnuncio: true },
    texto('Entao va para o inferno.. desgracado'),
  ];
  check(!!semInteresse(daPrint, null), 'a rajada da print e reconhecida como hostilidade');

  for (const t of ['vai tomar no cu', 'va se fuder', 'voce e um desgracado', 'seu canalha, nao quero mais nada']) {
    check(!!semInteresse([texto(t)], null), `hostil reconhecido: "${t}"`);
  }

  /**
   * **O apoiador xingando o ADVERSARIO continua de fora**, que e a fala mais comum desta base. O
   * imperativo sozinho so conta quando e a mensagem inteira -- mesma guarda do "confirmado" e do
   * "13".
   */
  for (const t of ['kkkk vai tomar no cu esse Lula', 'esse governo do Lula que va para o inferno',
                   'o Lula e um ladrao safado, golpista', 'esse transito e uma desgraca',
                   'vai ser um prazer ajudar voces', 'vou votar em voces, conte comigo']) {
    check(!semInteresse([texto(t)], null), `NAO e hostilidade: "${t}"`);
  }
}

{
  grupo('"Aguardando mensagem" e ruido da plataforma (05/09/2026)');

  /**
   * Print dele: o fluxo trazia *"Aguardando mensagem. Essa acao pode levar alguns instantes. Saiba
   * mais: https://faq.whatsapp.com/..."* -- e **"faq.whatsapp.com" foi gravado no campo Cidade** de
   * uma eleitora real, com a tela oferecendo *"Este e o grupo de faq.whatsapp.com"*.
   *
   * Mesma familia do Carlos e da Vera (02/09), com uma diferenca: este ruido carrega um LINK, e
   * link vira dado.
   */
  check(ehMensagemDaPlataforma('⏳ Aguardando mensagem. Essa acao pode levar alguns instantes. Saiba mais: https://faq.whatsapp.com/1234'),
    'o aviso com o link do faq e reconhecido como ruido');
  check(ehMensagemDaPlataforma('Aguardando mensagem. Essa acao pode levar alguns instantes.'),
    'e sem o emoji tambem');

  // O falso positivo que importa: gente escreve "aguardando" o tempo todo.
  check(!ehMensagemDaPlataforma('Estou aguardando mensagem de voces ha dias'), 'fala de gente com "aguardando" nao conta');
  check(!ehMensagemDaPlataforma('Essa acao do governo foi boa'), 'nem "essa acao" solto');
}

{
  grupo('esta passando mal, ou avisou que fala depois (05/09/2026)');

  /**
   * Print da Elenir: chegou pelo anuncio das Escolas Civico-Militares e, quatro minutos depois,
   * escreveu *"Nao posso falar. Estou com infeccao urinaria e respiratoria. muita tosse e febre.
   * Falarei assim que for possivel..."*. A rodada IGNOROU E CONCLUIU -- *"caso de mal estar foi
   * ignorado e concluido"*.
   *
   * Duas causas somadas, e as duas estao aqui: `soExpressaApoio` leu **"Estou com"** como apoio
   * (o padrao aceitava qualquer objeto depois do "com"), e nada reconhecia o mal-estar.
   *
   * **Metade das asercoes e falso positivo**, que e onde mora o risco: nesta base a doenca aparece
   * na fala politica, no pedido de remedio e na noticia de terceiro.
   */
  const um = (t) => naoPodeFalarAgora([{ texto: t, tipo: 'TEXT', at: 2 }], null);

  const dela = 'Nao posso falar. Estou com infeccao urinaria e respiratoria. muita tosse e febre. Falarei assim que for possivel. Faco oracao pela minha recuperacao salutar por gentileza. Grata';
  check(!!um(dela), 'a mensagem da print e reconhecida');
  check(!soExpressaApoio([{ texto: dela, tipo: 'TEXT', at: 2 }], null, []), '"Estou com infeccao" NAO e mais lido como apoio -- era metade do defeito');

  check(!!um('Estou doente, falo depois'), 'doenca em primeira pessoa');
  check(!!um('to com febre alta'), 'sintoma com o verbo abreviado');
  check(!!um('Estou internada no hospital'), 'internada');
  check(!!um('Fiz uma cirurgia semana passada'), 'cirurgia');
  check(!!um('nao consigo falar agora, respondo mais tarde'), 'avisou que nao pode falar');
  check(!!um('Falo com voces amanha'), 'adiou para amanha');

  // O que NAO pode pegar.
  check(!um('O Brasil esta doente com essa esquerda'), 'doenca como metafora politica nao conta');
  check(!um('minha vizinha esta internada, voces podem ajudar?'), 'doenca de TERCEIRO nao conta');
  check(!um('Preciso de remedio, estou sem dinheiro'), 'pedido de remedio e da regra da ajuda, nao desta');
  check(!um('Estou com uma duvida sobre o horario do evento'), '"estou com" seguido de outra coisa nao conta');
  check(!um('meu filho fez cirurgia e precisamos de ajuda'), 'cirurgia de terceiro nao conta');
  check(!um('a saude publica esta um caos aqui'), 'falar de saude publica nao conta');

  // E o apoio de verdade continua sendo apoio.
  check(!!soExpressaApoio([{ texto: 'Estou com voces capitao!', tipo: 'TEXT', at: 2 }], null, []), '"Estou com voces" continua sendo apoio');
  check(!!soExpressaApoio([{ texto: 'Tamo junto', tipo: 'TEXT', at: 2 }], null, []), '"Tamo junto" continua sendo apoio');
  check(!!soExpressaApoio([{ texto: 'to contigo capitao', tipo: 'TEXT', at: 2 }], null, []), '"to contigo" entrou junto');
}

{
  grupo('rajada de cliques em anuncio (05/09/2026)');

  /**
   * Print da IRENE: tres cliques seguidos em anuncios diferentes do Instagram, nada mais escrito, e
   * a caixa ofereceu o modelo de UM deles ("Campanha Seguranca"). Ele: *"rajada de entrada em
   * anuncio, mensagem do momento e concluir"*.
   *
   * **A ERONI (03/09) e o contra-exemplo que define a regra**: ela recusou o convite do evento E
   * clicou em dois anuncios, e ali a decisao dele foi mandar o modelo novo. A diferenca e que ela
   * ESCREVEU alguma coisa -- por isso a rajada tem que ser SO cliques.
   */
  const clique = (t, at) => ({ texto: t, tipo: 'TEXT', at, geradaPeloAnuncio: true });

  const irene = [
    clique('Ola! Eu escolho o Lado de Quem Produz', 1),
    clique('Ola! Eu apoio o Flavio, Zucco, Hiago e Capitao Martim', 2),
    clique('Ola! Eu estou do lado da seguranca e apoio o Capitao Martim', 3),
  ];
  const r = rajadaDeAnuncios(irene, null, []);
  check(!!r, 'tres cliques seguidos sao reconhecidos');
  check(r?.quantos === 3, `e o motivo diz quantos foram (${r?.quantos})`);

  const eroni = [
    { texto: 'Nao vou conseguir ir ao evento, obrigada', tipo: 'TEXT', at: 1 },
    clique('Ola! Eu escolho o lado da Liberdade', 2),
    clique('Ola! Eu apoio as Escolas Civico-Militares', 3),
  ];
  check(!rajadaDeAnuncios(eroni, null, []), 'quem ESCREVEU alem de clicar nao cai aqui -- e a decisao da Eroni (03/09)');

  check(!rajadaDeAnuncios([irene[0]], null, []), 'um clique so e a chegada normal, nao rajada');
  check(!rajadaDeAnuncios([], null, []), 'conversa vazia nao casa');

  /**
   * **A ALDINA (08/09/2026): dois cliques no MESMO anuncio nao sao navegacao, sao insistencia.**
   *
   * Ela clicou duas vezes em *"Ola! Eu quero receber o Material da Direita"*, nao escreveu nada, e a
   * rodada mandou a mensagem do momento -- *"ignorou o modelo que e prioritario de pedido de
   * material, a pessoa mandou duas vezes"*.
   *
   * **O argumento desta regra some quando o anuncio e o mesmo:** ele e *"o modelo de um deles
   * responde a um terco do que ela fez"*, verdade com a Irene e falso aqui, onde ha um pedido so e o
   * modelo daquele anuncio o responde inteiro.
   */
  const aldina = [
    clique('Ola! Eu quero receber o Material da Direita', 1),
    clique('Ola! Eu quero receber o Material da Direita', 2),
  ];
  check(!rajadaDeAnuncios(aldina, null, []), 'dois cliques no MESMO anuncio nao sao rajada');
  check(!rajadaDeAnuncios([...aldina, clique('Ola! Eu quero receber o Material da Direita', 3)], null, []),
    'nem tres vezes o mesmo');

  /** Acento e caixa nao fazem dois anuncios de um. */
  check(!rajadaDeAnuncios([clique('Olá! Eu quero receber o Material da Direita', 1), clique('OLA! EU QUERO RECEBER O MATERIAL DA DIREITA', 2)], null, []),
    'acento e caixa nao transformam o mesmo anuncio em dois');

  /** Basta UM diferente para voltar a ser navegacao. */
  check(!!rajadaDeAnuncios([...aldina, irene[0]], null, []), 'o mesmo duas vezes MAIS um outro volta a ser rajada');
}

{
  grupo('legenda de repasse nao e pergunta (06/09/2026)');

  /**
   * Print do Eraldo: ele encaminhou um video com a legenda *"Voce e Patriota? Entao coloque este
   * Video nos grupos !"*, a interrogacao fez cair em `pergunta-aberta` (tecla 6) e a IA escreveu
   * uma resposta longa sobre nao poder fazer campanha com recursos de terceiros. Ele apagou.
   *
   * *"a pessoa esta encaminhando links e legendas, a resposta ficou fora de contexto; seria uma
   * excecao a regra da pergunta: pergunta com link usa a regra de mandar mensagem do momento ou
   * agradecer as informacoes e encerrar"*.
   *
   * **Nao e o conserto de 05/09** (`semLinks`, que tirava o "?" da query string): aqui a
   * interrogacao esta no texto de verdade. O que a desqualifica e o que ela acompanha.
   */
  const doEraldo = { texto: 'Voce e Patriota? Entao coloque este Video nos grupos !', tipo: 'VIDEO' };
  check(!conversaTemPerguntaAberta([doEraldo], null), 'a legenda do video encaminhado nao e pergunta');
  check(!perguntaPendente([doEraldo], null), 'e nao deixa pergunta pendente, que e o que impede concluir');

  const comLink = texto('Voce e Patriota? Coloque nos grupos! https://www.instagram.com/reel/DCkXvC2AykS/');
  check(!conversaTemPerguntaAberta([comLink], null), 'a mesma legenda com link tambem nao');

  /**
   * **FIGURA continua contando**, e o corte e o mesmo que `ehRepasse` ja fazia: video e link sao
   * conteudo de terceiro; figura nesta base tambem e a foto do exame, da rua, do documento.
   */
  check(!!conversaTemPerguntaAberta([{ texto: 'olha meu exame, voces conseguem ajudar?', tipo: 'IMAGE' }], null),
    'pergunta colada numa FIGURA continua sendo pergunta');
}

{
  grupo('a pergunta no meio da mensagem (06/09/2026)');

  /**
   * Print da Maria Antonia: *"Boa noite capitao o senhor e candidato a qual partido desculpa a
   * minha ignorancia nao prestei atencao"* (dia 05) e *"Gostaria muito saber se o senhor nao se
   * importa"*; no dia 06 ela mandou um link do TikTok e a rodada mandou a mensagem do momento.
   * Ele: *"ignorou por causa do link no final"*.
   *
   * Medido antes de mexer, os DOIS detectores devolviam false — nao era so a ordem das caixas:
   * sem "?", a guarda de posicao so aceita o padrao ABRINDO a mensagem, e ela abriu com
   * *"Boa noite capitao"*. E `PERGUNTA_DECLARADA` exigia o verbo colado em "saber".
   */
  const daMaria = 'Boa noite capitao o senhor e candidato a qual partido desculpa a minha ignorancia nao prestei atencao';
  check(!!conversaTemPerguntaAberta([texto(daMaria)], null), 'a pergunta no MEIO da mensagem conta, sem "?"');
  check(!!perguntaPendente([texto('Gostaria muito saber se o senhor nao se importa')], null),
    '"gostaria MUITO saber": o adverbio no meio nao apaga a pergunta declarada');
  check(!!perguntaPendente([texto('gostaria de saber se tem algum projeto')], null),
    '"gostaria DE saber" — a forma mais comum, e ela nunca casava');

  check(!!conversaTemPerguntaAberta([texto('qual seu partido')], null), 'qual + partido');
  check(!!conversaTemPerguntaAberta([texto('Boa noite, qual o seu numero')], null), 'qual + numero, depois do cumprimento');
  check(!!conversaTemPerguntaAberta([texto('nao sei qual a posicao dele sobre isso')], null),
    'qual + posicao continua contando (era a linha que subiu de lista)');

  /**
   * **Os falsos positivos sao a metade cara.** A guarda de posicao existe pelo "pq" (print do
   * Ciro), e ela continua de pe: o que subiu para as inequivocas foi so o "qual" seguido de
   * substantivo, que nunca e conjuncao.
   */
  check(!conversaTemPerguntaAberta([texto('ficou muito grato pq sou Bolsonaro desde sempre')], null),
    'o "pq" explicativo no meio da frase continua NAO sendo pergunta');
  check(!conversaTemPerguntaAberta([texto('cada um tem sua opiniao e eu respeito')], null),
    '"opiniao" sem o "qual" nao e pergunta');
  check(!conversaTemPerguntaAberta([texto('meu partido e o PL desde 2018')], null),
    '"partido" sem o "qual" nao e pergunta');
  check(!conversaTemPerguntaAberta([texto('vou votar no senhor qualquer que seja o partido')], null),
    '"qualquer" nao e "qual"');
  check(!conversaTemPerguntaAberta([texto('apoio o senhor de qualquer jeito')], null),
    'apoio comum continua fora');
}

{
  grupo('voto de boa vontade so conta se for a mensagem inteira (06/09/2026)');

  /**
   * Depois de eu listar as condicoes do apoio, ele: *"muito vago esses termos e podem pegar em mais
   * contextos, o que mais pode ser feito?"*. Media antes de mexer: **15 de 19** frases plausiveis
   * desta base davam apoio sem ser apoio.
   *
   * A diferenca esta na NATUREZA do termo. "Eu apoio", "conte comigo", "vou votar", "sou seu
   * eleitor" declaram lealdade e sao dirigidos a NOS -- valem onde estiverem. "Forca", "parabens",
   * "sucesso", "Deus te abencoe", "torcendo" sao votos de boa vontade: sozinhos sao carinho, e no
   * meio de uma frase quem decide e o RESTO da frase.
   *
   * E a terceira vez que este projeto aprende a mesma coisa -- a caixa do "so mandou bom dia"
   * pegando o desabafo da Cris, e o "boa tarde queria saber mais" da Teresinha.
   */
  const ap = (t) => !!soExpressaApoio([{ texto: t, tipo: 'TEXT', at: 3 }], null, []);

  // O voto SOZINHO continua sendo apoio.
  for (const t of ['forca ai', 'muita forca', 'parabens', 'sucesso', 'Deus te abencoe',
    'Deus te abencoe capitao', 'parabens capitao!', 'estou torcendo', 'torcendo muito',
    'forca amigo, abraco', 'muito sucesso pra voces']) {
    check(ap(t), `voto sozinho conta: ${t}`);
  }

  // No meio de uma frase, quem decide e a frase.
  for (const t of ['preciso de forca para continuar', 'estou sem forca nenhuma, muito cansada',
    'faca forca com o prefeito por nos', 'tentei falar com a prefeitura sem sucesso',
    'desejo sucesso no seu trabalho mas preciso de ajuda', 'parabens pelo aniversario do seu pai',
    'que Deus te abencoe e me ajude com o remedio', 'Deus te abencoe, preciso muito de uma cesta basica',
    'estou torcendo para conseguir a cirurgia']) {
    check(!ap(t), `NAO conta no meio da frase: ${t}`);
  }

  // "vamos vencer" precisa do objeto politico, ou de ser a mensagem inteira.
  check(ap('vamos vencer!'), '"vamos vencer" sozinho e apoio');
  check(ap('vamos vencer essa eleicao'), 'e com objeto politico tambem');
  check(!ap('vamos vencer essa doenca'), 'mas "vencer essa doenca" nao e apoio');
  check(!ap('vamos ganhar coragem'), 'nem "ganhar coragem"');

  /**
   * **O voto tem de ser em NOS, e o "nao" colado desfaz** — print do odone (10/09/2026): *"PRECISAMOS
   * AVISAR TODOS PARA NAO VOTAREM NO RIGOTTO, porque ele apoiou o Lula em 2022... AJUDEM A
   * DIVULGAR"* recebeu o agradecimento pelo apoio. Ele: *"de onde saiu mensagem de apoio? nesse caso
   * era mensagem do momento"*. O padrao aceitava `votarem no` + qualquer nome.
   */
  check(!ap('PRECISAMOS AVISAR TODOS PARA NÃO VOTAREM NO RIGOTTO, porque ele apoiou o Lula em 2022. Está empatado com Sanderson. AJUDEM A DIVULGAR.'),
    'a corrente do odone nao e apoio');
  /**
   * **O apoio conta so se for para OS DA COLINHA** — regra dele, com a arte: *"se o apoio nao for para
   * eles a regra de mandar obrigado pelo apoio nao deve contar"*. Partido e "direita" sozinhos nao
   * sao eles.
   */
  for (const t of ['votem no Lula', 'vou votar na Manuela', 'ninguem deve votar no PT', 'nao votem nele',
    'nunca vou votar no senhor', 'nao apoio esse governo', 'eu apoio o Lula', 'meu voto e do Lula',
    'vou votar no PL', 'vamos votar na direita', 'voto no Republicanos', 'eu apoio a greve dos professores']) {
    check(!ap(t), `NAO e apoio: "${t}"`);
  }
  for (const t of ['estou falando com minhas amigas para votarem no Senhor', 'vou votar nele pq confio',
    'voto no 22', 'votamos no capitao', 'vou votar em voces', 'nao tenho duvida, vou votar no senhor',
    'Não vejo a hora de votar em vocês', 'eu apoio', 'meu voto e seu', 'nosso voto',
    'votem no Zucco', 'vou votar no Sanderson', 'voto no Van Hattem', 'vou votar no Felipe Pedri',
    'voto no 10122', 'eu apoio o Flavio, Zucco e Capitao Martim', 'meu voto e do capitao',
    'sou Bolsonaro desde sempre']) {
    check(ap(t), `continua sendo apoio: "${t}"`);
  }

  // "eleitor" precisa do SEU: "sou eleitor de X" e endereco.
  check(ap('sou seu eleitor'), '"sou seu eleitor" e apoio');
  check(ap('sou eleitor'), 'e sozinho tambem');
  check(ap('sou bolsonarista'), '"bolsonarista" vale sozinho -- e campo politico, nao endereco');
  check(!ap('sou eleitor de Caxias do Sul'), 'mas "sou eleitor de <cidade>" e endereco, nao apoio');

  // As declaracoes de lealdade continuam valendo em qualquer posicao.
  // Lealdade vale em qualquer POSICAO -- mas "so apoio" continua exigindo que nao haja pergunta
  // nem pedido junto, o que e a guarda mais antiga desta regra.
  check(ap('Boa tarde, eu apoio o Capitao e a familia dele'), 'lealdade vale no meio da frase');
  check(!ap('Boa tarde, eu apoio o Capitao e queria saber do evento'), 'mas com pergunta junto nao e SO apoio');
  check(ap('conte comigo sempre'), 'conte comigo');
}

{
  grupo('"dinheiro" solto nao e pedido: e vocabulario de politica (06/09/2026)');

  /**
   * Print da ELENIR MINOZZO: 858 caracteres de critica politica -- *"MENOS DEPENDENTE DAS CESTAS
   * BASICAS E SEM SUBSIDIOS DO GOVERNO FEDERAL"*, *"Tem que acabar com essas benesses e auxilios
   * pecuniarios"*, *"TEMOS QUE DESMAMAR ESSES BEZERROS CRIADOS PELO PT"*, *"BASTA! Dinheiro
   * ACABA."* -- e ela recebeu **a negativa de ajuda financeira**, o texto que explica que o mandato
   * nao pode doar dinheiro. Ele apagou a mensagem.
   *
   * Medido: casou por `\bdinheiro\b`, na ultima frase. Ela estava dizendo o CONTRARIO de pedir.
   *
   * **"dinheiro", "grana", "emprestimo" e "doacao" sao o vocabulario de qualquer conversa sobre
   * gasto publico nesta base** -- que e metade do que chega. Passaram para a mesma condicao das
   * NECESSIDADES: so valem junto de um verbo de pedir. **O que decide sozinho e so o que ninguem
   * escreve sem estar pedindo:** a chave PIX e um valor concreto.
   */
  const pf = (t) => pedeAjudaFinanceira([{ texto: t, tipo: 'TEXT', at: 1 }], null);

  check(!pf('BASTA! Dinheiro ACABA. Tem que acabar com essas benesses e auxilios pecuniarios'),
    'o texto da print NAO pede ajuda financeira');
  check(!pf('MENOS DEPENDENTE DAS CESTAS BASICAS E SEM SUBSIDIOS DO GOVERNO FEDERAL'),
    'nem falar de cesta basica em critica ao governo');
  check(!pf('o governo gasta dinheiro demais com ONGs'), '"dinheiro" em critica politica nao conta');
  check(!pf('esse emprestimo do BNDES foi um roubo'), 'nem "emprestimo"');
  check(!pf('a doacao das estatais para o PT tem que acabar'), 'nem "doacao"');
  check(!pf('nao tenho dinheiro nem para o gas, mas Deus prove'), 'relatar falta sem pedir tambem nao');

  // O que decide SOZINHO, porque ninguem escreve sem estar pedindo.
  check(!!pf('Meu Pix 01757539005'), 'a chave PIX decide sozinha');
  check(!!pf('preciso de R$ 200 para o remedio'), 'e um valor concreto tambem');
  check(!!pf('Qualquer mil reais ja me ajuda'), 'inclusive por extenso');

  // Com o verbo de pedir, as palavras genericas voltam a valer.
  check(!!pf('preciso de dinheiro para o aluguel'), '"dinheiro" com verbo de pedir conta');
  check(!!pf('me ajuda com um dinheiro por favor'), 'e "me ajuda" tambem');
  check(!!pf('estou precisando de dinheiro'), 'e "estou precisando"');

  /**
   * **`me ajuda` NUNCA casou no verbo de pedir, e o `\b` final era a causa.** O padrao era
   * `\b(...|me\s+ajud|...)\b`: a fronteira de fechamento exige nao-letra depois de "ajud", e em
   * "me ajuda" vem um "a". O caso da Marli (02/09) so era pego porque ela mandou o PIX junto.
   *
   * Terceira vez que esta armadilha aparece neste arquivo -- agora num RADICAL truncado de
   * proposito. Radical nao leva fronteira de palavra no fim.
   */
  check(!!pedeAjudaFinanceira([
    { texto: 'Meu Pix 01757539005', tipo: 'TEXT', at: 1 },
    { texto: '50 me ajuda muito', tipo: 'TEXT', at: 2 },
  ], null), 'a rajada da Marli continua sendo pega');
}

/**
 * **O lote de audio ENCAMINHADO — a print da Irene (07/09/2026).**
 *
 * Ela mandou cinco audios que somam quase tres minutos de fala, e os cinco chegaram **em dois
 * segundos**; eram conversa de outras pessoas, e a IA respondeu uma pergunta que estava dentro de
 * um deles. O criterio e dele, e e aritmetica: *"realmente nao e possivel audios com aquele tempo
 * naquele espaco de tempo"*.
 *
 * Os numeros abaixo sao os que a API devolveu de verdade (tamanho em bytes e o `timestamp` do
 * WhatsApp). A conta usa 16.000 bytes por segundo — o DOBRO da densidade medida na plataforma —,
 * entao a duracao estimada sai pela metade da real e a regra sempre erra para o lado de nao
 * acusar.
 *
 * Metade das assercoes e falso positivo: audio gravado na hora chega espacado pela propria
 * duracao, e e isso que separa as duas coisas.
 */
{
  grupo('lote de audio encaminhado (a Irene, 07/09)');

  /**
   * Os TAMANHOS e os `timestamp` sao os que a API devolveu; o TEXTO e enchimento do mesmo
   * comprimento — transcricao de eleitor real nao entra em arquivo do repositorio. So a frase da
   * ultima e a do caso, porque e ela que a IA respondeu.
   */
  const enche = (n) => 'conversa entre duas outras pessoas. '.repeat(60).slice(0, n);
  const irene = [
    { tipo: 'AUDIO', texto: enche(136), ts: '2026-09-07T11:28:22Z', bytes: 136556, transcrito: true },
    { tipo: 'AUDIO', texto: enche(523), ts: '2026-09-07T11:28:23.001Z', bytes: 384236, transcrito: true },
    { tipo: 'AUDIO', texto: enche(883), ts: '2026-09-07T11:28:23Z', bytes: 566252, transcrito: true },
    { tipo: 'AUDIO', texto: enche(317), ts: '2026-09-07T11:28:23.002Z', bytes: 189932, transcrito: true },
    { tipo: 'AUDIO', texto: 'Nao deu pra ouvir nada que voce botou ali. Ta mudo?', ts: '2026-09-07T11:28:22.001Z', bytes: 73196, transcrito: true },
  ];
  const marcados = marcarLoteEncaminhado(irene);
  check(marcados.every((m) => m.encaminhado), 'os cinco audios da print sao reconhecidos como encaminhados');
  check(marcados.every((m) => ehRepasse(m)), 'e por isso viram repasse, como o video ja era');
  check(rajadaEhSoRepasse(marcados, null), 'a rajada inteira e repasse');

  /**
   * **A pergunta que esta DENTRO do audio encaminhado nao e para nos** — a regra dele de 06/09
   * (o Eraldo) chegando onde ela ainda nao valia. Sem isto, o *"Ta mudo?"* de uma terceira pessoa
   * conta como pergunta pendente e a rodada responde a ela.
   */
  check(!conversaTemPerguntaAberta(marcados, null), 'o "Ta mudo?" de dentro do repasse deixa de ser pergunta nossa');
  check(!perguntaPendente(marcados, null), 'e nao segura mais a conclusao');

  /**
   * **O que NAO muda, e e o desfecho que ele quer para audio:** cinco mensagens continuam pedindo
   * gente. Marcar como encaminhado nao pode virar atalho para a rodada responder sozinha.
   */
  check(!!conversaPedeRespostaPessoal(marcados, null), 'e o caso continua indo para ele ou para a IA');

  const seg = (s) => s * 8000; // ~8 KB/s, a densidade medida na plataforma
  const t = (s) => new Date(Date.UTC(2026, 8, 7, 12, 0, s)).toISOString();
  const encaminhou = (lista) => marcarLoteEncaminhado(lista).some((m) => m.encaminhado);

  check(encaminhou([
    { tipo: 'AUDIO', texto: 'x', ts: t(0), bytes: seg(120) },
    { tipo: 'AUDIO', texto: 'y', ts: t(1), bytes: seg(120) },
  ]), 'dois audios de dois minutos entregues juntos: encaminhado');

  // --- os falsos positivos: audio gravado na hora ---
  check(!encaminhou([
    { tipo: 'AUDIO', texto: 'x', ts: t(0), bytes: seg(5) },
    { tipo: 'AUDIO', texto: 'y', ts: t(20), bytes: seg(6) },
  ]), 'dois audios curtos gravados na hora nao sao encaminhamento');

  check(!encaminhou([
    { tipo: 'AUDIO', texto: 'x', ts: t(0), bytes: seg(120) },
    { tipo: 'AUDIO', texto: 'y', ts: t(15), bytes: seg(10) },
  ]), 'audio longo seguido de um curto tambem nao — o primeiro foi gravado ANTES da janela');

  check(!encaminhou([
    { tipo: 'AUDIO', texto: 'x', ts: t(0), bytes: seg(30) },
    { tipo: 'AUDIO', texto: 'y', ts: t(40), bytes: seg(30) },
    { tipo: 'AUDIO', texto: 'z', ts: t(80), bytes: seg(30) },
  ]), 'tres audios de 30s, um por minuto: e conversa, nao lote');

  check(!encaminhou([{ tipo: 'AUDIO', texto: 'x', ts: t(0), bytes: seg(600) }]),
    'audio unico nunca e lote, por mais longo que seja');

  check(!encaminhou([
    { tipo: 'AUDIO', texto: 'x', ts: t(0), bytes: 0 },
    { tipo: 'AUDIO', texto: 'y', ts: t(1), bytes: 0 },
  ]), 'sem o tamanho nao ha duracao: nao se julga');

  check(!encaminhou([
    { tipo: 'AUDIO', texto: 'x', ts: t(0), bytes: seg(120) },
    { tipo: 'TEXT', texto: 'oi', ts: t(1) },
    { tipo: 'AUDIO', texto: 'y', ts: t(2), bytes: seg(120) },
  ]), 'texto no meio quebra o lote — so audio seguido conta');

  /**
   * **O relogio e o do WhatsApp, e nao o da plataforma.** Aparelho sem rede entrega tudo junto ao
   * reconectar: o `at` fica igual para todos, e os `ts` continuam espalhados como as gravacoes
   * foram. Sem esta distincao, quem grava audio offline seria acusado de encaminhar.
   */
  check(!encaminhou([
    { tipo: 'AUDIO', texto: 'x', ts: t(0), at: t(300), bytes: seg(60) },
    { tipo: 'AUDIO', texto: 'y', ts: t(90), at: t(300), bytes: seg(60) },
  ]), 'gravado offline e entregue junto: o ts separa, e nao acusa');
}

/**
 * **"Estaremos" sozinho nao e confirmacao de presenca — a anotacao da Geci (06/09/2026).**
 *
 * *"Tamo junto estaremos de maos dadas e venceremos amem"* fez a rodada PULA-LA como quem confirma
 * presenca em evento. Ele: *"nao e evento, olhar os termos, provavelmente estao muito vagos e sendo
 * aplicados em contextos demais"*.
 *
 * O qualificador estava num grupo OPCIONAL, entao o verbo sozinho bastava. **E a QUARTA vez que
 * esta lista aprende a mesma coisa**, depois de "vamos"/"vou" (02/09), "confirmado" (04/09) e
 * "pode contar comigo" (04/09): vocabulario de campanha nao e resposta ao convite.
 */
{
  grupo('"estaremos" sozinho nao e presenca (a Geci, 06/09)');

  const msg = (t) => [{ texto: t, tipo: 'TEXT', at: 1 }];
  check(confirmaPresenca(msg('Tamo junto estaremos de maos dadas e venceremos amem'), null) === null,
    'a frase da print deixa de contar como presenca confirmada');
  for (const t of [
    'Estaremos juntos nessa luta',
    'Estaremos firmes ate o fim',
    'Estarei sempre torcendo por voces',
  ]) {
    check(confirmaPresenca(msg(t), null) === null, `e tambem: "${t}"`);
  }

  /** O que a poda NAO pode levar junto: a resposta de verdade ao convite. */
  for (const t of ['Estarei la!', 'Estaremos la sim', 'Estarei presente', 'Estarei', 'Estaremos com voces no evento']) {
    check(confirmaPresenca(msg(t), null) === 'sim', `continua sendo presenca: "${t}"`);
  }
  check(confirmaPresenca(msg('Nao vou poder ir'), null) === 'nao', 'e a recusa continua sendo recusa');
}

/**
 * **Aviso da plataforma nao e um arquivo esperando alguem abrir — a anotacao do Clovis
 * (07/09/2026).**
 *
 * A conversa inteira era *"*Atencao:* o tipo da mensagem enviada pelo contato nao e suportado."*, e
 * a caixa recomendou a tecla 6 dizendo *"mandou um audio — so da para responder depois de abrir"*.
 * Ele: *"mandar mensagem do momento"*.
 *
 * O ruido da plataforma JA era reconhecido (`prepararEntrantes` esvazia o texto e marca
 * `sistema: true`); o que faltava era esta metade — a mensagem continua carregando o `tipo`, e o
 * teste de formato disparava por ele. **E o motivo alegado era falso na tela:** nao existe audio
 * para abrir, a plataforma disse que nao conseguiu entregar.
 */
{
  grupo('aviso da plataforma nao pede resposta pessoal (o Clovis, 07/09)');

  const aviso = { texto: '', tipo: 'AUDIO', sistema: true, at: 1 };
  check(pedeRespostaPessoal(aviso) === null, 'a mensagem de sistema deixa de pedir resposta a mao');
  check(conversaPedeRespostaPessoal([aviso], null) === null, 'e a conversa inteira tambem');

  /** O audio DE VERDADE sem transcricao continua pedindo gente — e o que a regra existe para pegar. */
  check(!!pedeRespostaPessoal({ texto: '', tipo: 'AUDIO', at: 1 }),
    'audio de verdade sem transcricao continua pedindo voce');
  check(!!pedeRespostaPessoal({ texto: '', tipo: 'DOCUMENT', at: 1 }),
    'e o arquivo tambem');
}

/**
 * **Quer falar com o DEPUTADO em pessoa** — pedido dele (08/09/2026), print do pastor que escreveu
 * *"Gostaria de falar com deputado sou pastor Cesar de santa Maria"*.
 *
 * **O que qualifica e o OBJETO ser ELE**, e nao a vontade de falar — e e ai que mora o risco:
 * *"gostaria de falar com voces"* e a conversa que ja esta acontecendo, e responder com a negativa
 * do WhatsApp pessoal seria negar o que ninguem pediu. Metade das assercoes e falso positivo.
 */
{
  grupo('quer falar com o deputado (o pastor, 08/09)');

  const msg = (t) => [{ texto: t, tipo: 'TEXT', at: 1 }];
  const pega = (t) => !!pedeFalarComDeputado(msg(t), null);

  for (const t of [
    'Gostaria de falar com deputado sou pastor Cesar de santa Maria',
    'Quero falar com o Capitao Martim',
    'queria conversar com ele',
    'Como faco para falar com o deputado?',
    'Tem como falar com ele pessoalmente?',
    'gostaria muito de encontrar o capitao',
    'Me passa o whats dele',
    'Voces tem o numero do capitao?',
    'me manda o contato dele por favor',
    /**
     * **O ENCONTRO pedido como SUBSTANTIVO** — print do Maicon (09/09/2026): *"Queria uma reuniao
     * com deputado"*, e os OITO detectores devolveram null. A rodada mandou a saudacao de fe —
     * *"pedido de contato foi ignorado e mandou bom dia"*. A lista inteira era de VERBOS (falar,
     * conversar, encontrar, ver), e quem quer marcar pede a COISA.
     */
    'Queria uma reuniao com deputado',
    'queria um encontro com o capitao',
    'quero uma audiencia com ele',
    'gostaria de uma visita do deputado',
    'da pra marcar um horario com o Martim?',
    'queria agendar com o capitao',
    'ele pode me receber?',
  ]) {
    check(pega(t), `pega: "${t}"`);
  }

  /** Falar com NOS nao e falar com ELE — e e a conversa que ja esta em curso. */
  for (const t of [
    'Gostaria de falar com voces',
    'quero falar com a equipe',
    'posso falar com alguem ai?',
    /**
     * Print de 09/09/2026: ela escreveu isto e recebeu a regra 8 inteira (periodo eleitoral,
     * contato pessoal indisponivel, eventos da agenda). **O detector estava certo** — quem falhou
     * foi a IA, copiando o conteudo de uma resposta pronta que esta no prompt como exemplo de
     * ESTILO. A guarda fica aqui para ninguem "consertar" o detector no lugar errado.
     */
    'Posso falar com algum representante?',
    'Posso falar com um atendente?',
    'tem alguem ai?',
    'isso e robo ou tem alguem?',
    /**
     * **O verbo de QUERER e obrigatorio na familia do encontro**, e foi a medicao que obrigou:
     * sem ele, *"na reuniao com o deputado ontem, ele disse..."* viraria pedido, e a resposta
     * nega um encontro que ninguem pediu — o erro do "representante", dois dias antes.
     */
    'na reuniao com o deputado ontem ele disse isso',
    'a visita do deputado a nossa cidade foi otima',
    'tive uma reuniao com o prefeito ontem',
    'queria uma reuniao com a prefeitura',
    'vou marcar uma consulta com o medico',
    'que horario voces atendem?',
    'falei com o deputado ontem no evento',
    'conversei com ele semana passada',
    'vou falar com o prefeito da minha cidade',
    'quero falar sobre a seguranca publica',
    'gostaria de saber qual a agenda',
    'me passa o link do grupo',
    'tem como voces me ajudarem?',
  ]) {
    check(!pega(t), `nao pega: "${t}"`);
  }
}

/**
 * **Falar mal do PL ou do Republicanos e hostilidade CONTRA NOS** — regra dele (08/09/2026):
 * *"falar mal do pl ou republicanos e hostilidade contra nos, falar mal de pt esta do nosso lado"*.
 *
 * **A segunda metade da regra e a guarda da primeira, e e onde mora o risco.** As duas siglas
 * aparecem na MESMA frase o tempo todo nesta base (*"o PL e bem melhor que o PT, que e um bando de
 * ladroes"*), e `semInteresse` e a regra mais destrutiva do arquivo: etiqueta permanente no CRM
 * mais conclusao em silencio. Dezoito das vinte e quatro assercoes sao falso positivo.
 */
{
  grupo('falar mal do nosso partido (regra dele, 08/09)');

  const msg = (t) => [{ texto: t, tipo: 'TEXT', at: 1 }];
  const hostil = (t) => !!semInteresse(msg(t), null);

  for (const t of [
    'O PL e um partido de ladroes',
    'Republicanos sao uns corruptos',
    'esse bando de safados do PL',
    'o PL virou lixo',
    'partido liberal e uma vergonha, so tem pilantra',
    'Republicanos e um partido de vagabundos',
  ]) {
    check(hostil(t), `e hostilidade: "${t}"`);
  }

  /** Xingar o PT continua sendo apoio — e e o que a regra dele diz na segunda metade. */
  for (const t of [
    'PT que para mim e PP partido dos preguicosos!',
    'o PT e um bando de ladroes',
    'Lula e corrupto e safado',
    'esses petistas sao uns vagabundos',
    'o PL e bem melhor que o PT, que e um bando de ladroes',
    'prefiro o PL, o PT so tem corrupto',
    'comunista e ladrao, PL nunca',
    'o PT e ladrao, ja o PL e serio',
    'esquerda so tem corrupto, PL e diferente',
    'o Lula e um presidiario, PL o melhor',
  ]) {
    check(!hostil(t), `esta do nosso lado: "${t}"`);
  }

  /** E a sigla sozinha nao e nada: "sou PL" e a fala mais comum desta base. */
  for (const t of [
    'sou PL desde que foi criado o PL',
    'Sim Eu Sou PL, ja estou trabalhando na Campanha',
    'voces do PL estao fazendo um bom trabalho',
    'o Republicanos e o partido do Martim, certo?',
    'aqui em casa e tudo PL',
    'me manda o material do PL por favor',
    'PL 22 sempre',
  ]) {
    check(!hostil(t), `a sigla sozinha nao acusa: "${t}"`);
  }

  /**
   * **Os NOMES do nosso lado entraram em 08/09**, com a print do Sergio Nunes — e sao a regra dele
   * de 01/09 chegando onde ela ainda nao valia: ate aqui so os APELIDOS pejorativos contavam, e
   * xingar pelo nome proprio passava batido.
   */
  for (const t of [
    'o Bolsonaro e um genocida',
    'Martim e um safado',
    'Zucco e um picareta',
    'esse ladrao do Bolsonaro',
    'Essa gente do Bolsonaro, assassino, bandido, traidor, ladrao',
  ]) {
    check(hostil(t), `xingar o nosso lado pelo nome: "${t}"`);
  }

  /** E o mesmo cuidado do partido: citar o que o outro lado diz nao e xingar. */
  for (const t of [
    'Lula e ladrao, Bolsonaro e honesto',
    'o PT chamou o Bolsonaro de ladrao mas e mentira',
    'apoio o Bolsonaro e o Capitao Martim',
    'esses petistas chamam o Bolsonaro de tudo',
    'quero material do Capitao Martim',
    'esquerda so tem corrupto, Bolsonaro nunca',
    'o comunista e ladrao, Martim e serio',
  ]) {
    check(!hostil(t), `nao pega: "${t}"`);
  }
}

/**
 * **Quem ESCREVEU depois do formulario nao o ignorou** — print da Lenir (08/09/2026).
 *
 * Ela recebeu o pedido em 07/09 e respondeu em duas mensagens: *"Lenir"* e *"Curitiba"*. No dia
 * seguinte a rodada mandou a mensagem do momento COM o pedido de novo. Ele: *"pediu dados
 * novamente"*.
 *
 * **Medido: o parser nao devolve nada dessas duas mensagens** — Curitiba nao esta entre os 497
 * municipios do RS, e o nome sozinho numa mensagem propria nao e alcancado pelo modo generoso. O
 * cadastro dela e invisivel para a extensao.
 *
 * O texto combinado existe para quem IGNOROU o formulario (pedido dele de 04/09, a figura de bom
 * dia que recebeu o formulario seco treze horas depois). **Estas assercoes travam a fronteira entre
 * as duas coisas**, e sao a mesma conta que o painel faz em `faltaCadastro`.
 */
{
  grupo('escreveu depois do formulario (a Lenir, 08/09)');

  const PEDIDO = 'ATENCAO! Para eu poder salvar seu contato me diga seu:\n\nNome , Cidade\n\n(exemplo: Pedro Silva , Porto Alegre)';
  const nossas = [{ texto: PEDIDO, at: '2026-09-07T20:00:00Z' }];
  const escreveu = (entrantes) =>
    (respostasApos(entrantes, nossas, templates.ehPedidoDeDados) || [])
      .some((m) => String(m?.texto || '').trim() && !m?.sistema && !ehSoReacao(m));

  check(templates.ehPedidoDeDados(PEDIDO), 'o formulario e reconhecido pelo invariante');

  check(escreveu([
    { texto: 'Lenir', tipo: 'TEXT', at: '2026-09-07T20:41:00Z' },
    { texto: 'Curitiba', tipo: 'TEXT', at: '2026-09-07T20:41:30Z' },
  ]), 'ela respondeu — mesmo com cidade de outro estado, que o parser nao ve');

  /** O caso de 04/09, que o texto combinado existe para atender: ela NAO respondeu. */
  check(!escreveu([{ texto: '', tipo: 'IMAGE', at: '2026-09-07T20:41:00Z' }]),
    'figura sem legenda nao e resposta');
  check(!escreveu([{ texto: '\u{1F44D}', tipo: 'TEXT', at: '2026-09-07T20:41:00Z' }]),
    'emoji solto nao e resposta');
  check(!escreveu([]), 'silencio nao e resposta');
  check(!escreveu([{ texto: '', tipo: 'AUDIO', sistema: true, at: '2026-09-07T20:41:00Z' }]),
    'aviso da plataforma nao e resposta dela');
}

/**
 * **A transcricao passou a decidir pelo caminho FORTE** — print do Sergio Nunes (08/09/2026): dois
 * audios chamando o mandato e os aliados de *"assassino, bandido, traidor, ladrao"* e, em segunda
 * pessoa, *"ou tu e sem vergonha, ou tu e ordinario, tu e cafajeste"*. A rodada ofereceu responder
 * a mao. Ele: *"claramente sem interesse"*.
 *
 * **Isto AJUSTA a regra dele de 03/09** (o lopezp4295), que tirou a transcricao inteira daqui — e
 * ela continua valendo onde nasceu: naquele caso o gatilho era a NEGATIVA, e a fala vinha cheia de
 * "nao" solto. Reconhecimento automatico produz negativa falsa o tempo todo; nao produz
 * *"tu e cafajeste"*.
 */
{
  grupo('transcricao decide pelo caminho forte (o Sergio, 08/09)');

  const audio = (t) => [{ texto: t, tipo: 'AUDIO', transcrito: true, at: 1 }];
  const escrito = (t) => [{ texto: t, tipo: 'TEXT', at: 1 }];

  check(!!semInteresse(audio('Cara, ou tu e sem vergonha, ou tu e ordinario, tu e cafajeste. Eu odeio essa gente ai.'), null),
    'audio com xingamento em segunda pessoa decide');
  check(!!semInteresse(audio('Essa gente do Bolsonaro, assassino, bandido, traidor, ladrao, ninguem presta'), null),
    'e audio xingando o nosso lado pelo nome tambem');

  /** **A regra de 03/09 continua valendo:** a transcricao NAO decide pela negativa. */
  for (const t of [
    'eu nao tenho, eu nao tenho, ne, nenhum dos numeros dos candidatos, mas eu vou ir votar, sim',
    'nao sei',
    'nao tenho interesse',
    'nao quero receber nada disso',
    'nao, obrigado',
  ]) {
    check(!semInteresse(audio(t), null), `falado NAO decide pela negativa: "${t}"`);
  }

  /** E escrito continua decidindo pelos dois caminhos, como sempre decidiu. */
  check(!!semInteresse(escrito('nao tenho interesse'), null), 'escrito continua valendo pela negativa');
  check(!!semInteresse(escrito('voces sao uns mentirosos'), null), 'e pelo xingamento');
}

/**
 * **"Nunca vou apoiar essa gente" nao e recusa de EVENTO** — mesmo print do Sergio.
 *
 * `RECUSA_DE_PRESENCA` casava (`nao` … `vou`) e devolvia null ANTES de qualquer xingamento ser
 * olhado: a recusa de evento engolindo a recusa de contato, que e o oposto do que ela existe para
 * fazer. E a mesma licao que `confirmaPresenca` aprendeu quatro vezes — verbo sozinho e vocabulario
 * de campanha.
 */
{
  grupo('recusa de evento exige verbo de comparecer (08/09)');

  const si = (t) => semInteresse([{ texto: t, tipo: 'TEXT', at: 1 }], null);

  /** O que a guarda protege — e cada uma destas ja quebrou uma vez. */
  for (const t of ['Não conseguirei ir!', 'Nao vou poder ir', 'Não posso ir dessa vez', 'não vou', 'nao da pra mim']) {
    check(!si(t), `continua sem ser sem interesse: "${t}"`);
  }

  /** O que ela deixou de engolir. */
  check(!!si('So que nao, eu nunca vou apoiar essa gente. Essa gente do Bolsonaro, assassino, ladrao'),
    'e a recusa de CONTATO com xingamento nao e mais engolida');
}

/**
 * **"Casa" sozinha nao e endereco** — print da Geci carvalho (08/09/2026), com a etiqueta de
 * material num contato que nunca mandou endereco nenhum: *"nao sei porque tem etiqueta de
 * material"*.
 *
 * Ela escreveu *"ontem eu fui **na casa** nos **bairro** pedir voto para voces"* — militancia de
 * rua. Medido: `BAIRRO` contava uma marca e `COMPLEMENTO` a outra por causa de "casa", davam as
 * duas exigidas, e o contato foi **marcado e pulado**.
 *
 * **"Casa" e a palavra mais ambigua desta lista**, e como complemento ela existe — mas ai vem com
 * o que a torna complemento: um numero ou "dos fundos".
 */
{
  grupo('"casa" sozinha nao e endereco (a Geci, 08/09)');

  const m = (t) => [{ texto: t, tipo: 'TEXT', at: 1 }];
  const end = (t) => !!informouEndereco(m(t), null);

  check(!end('Ola meu amigo vamos trabalhar a favor do nosso Brasil eu moro no Rio grande do Sul cidade de Sapiranga pois tenho lutado muito ja consegui bastante voto para voce ontem eu fui na casa nos bairro pedir voto para voces'),
    'a mensagem da print deixa de virar endereco');
  for (const t of ['eu fui na casa nos bairro pedir voto', 'fui de casa em casa no bairro', 'na minha casa somos todos do PL']) {
    check(!end(t), `nao e endereco: "${t}"`);
  }

  /** O endereco de verdade continua sendo reconhecido — e "casa" como complemento tambem. */
  for (const t of [
    'Rua das Flores, 120, bairro Sao Jose',
    'meu endereco e Av Brasil 500, apto 3',
    'CEP 90000-000',
    'Rua das Flores, casa 2, bairro Centro',
    'Av Brasil, casa dos fundos, bairro Sao Jose',
  ]) {
    check(end(t), `continua sendo endereco: "${t}"`);
  }
}

/**
 * PEDIR QUE A GENTE COMPRE — print da Cleo (08/09/2026).
 *
 * *"Eu preciso que compre um encosto Rumer ali na ortoponto ai em Porto Alegre"* e *"Uma Loja de
 * venda de cadera de Roda ai em Porto Alegre"*. **Medido antes de mexer: os OITO detectores
 * devolveram null** — o verbo dispara (`preciso`), mas o objeto tem que estar em NECESSIDADES, e
 * encosto ortopedico e cadeira de rodas nao estao la.
 *
 * **O invariante nao e o item, e sim a CONSTRUCAO**: alguem pedindo que NOS gastemos dinheiro.
 * Acrescentar os dois objetos seria a quarta vez que esta base aprende que a lista nao fecha.
 */
{
  grupo('pedir que a gente COMPRE alguma coisa (08/09)');

  const um = (t) => [{ texto: t, tipo: 'TEXT', at: '2026-09-08T14:35:00' }];
  const acusa = (t) => !!pedeAjudaFinanceira(um(t), null);

  check(acusa('Eu preciso que compre um encosto Rumer ali na ortoponto ai em Porto Alegre'),
    'o caso da Cleo: "preciso que compre"');
  check(acusa('Voce pode comprar uma cadeira de rodas pra mim?'), 'segunda pessoa: "voce pode comprar"');
  check(acusa('Tem como voces pagarem a minha consulta?'), '"tem como voces pagarem"');
  check(acusa('Me compra um colchao novo pelo amor de Deus'), 'pronome oblíquo: "me compra"');
  check(acusa('Compra pra mim uma geladeira'), '"compra pra mim"');
  check(acusa('Queria que voces doassem uma cadeira de rodas'), 'doar tambem conta');
  check(acusa('Peco que a campanha custeie o meu tratamento'), 'custear tambem conta');

  /**
   * FALSOS POSITIVOS — e e aqui que mora o risco, porque esta regra manda uma NEGATIVA para
   * eleitor. **O sujeito tem que ser NOS**: quando e ELA quem compra, nao ha pedido nenhum.
   */
  check(!acusa('Eu preciso comprar um encosto novo'), 'ela e quem precisa comprar');
  check(!acusa('Onde posso comprar a camiseta de voces?'), '"posso" nao e "pode"');
  check(!acusa('Vou comprar o material e distribuir aqui no bairro'), 'ela vai comprar para ajudar');
  check(!acusa('Ja comprei os adesivos, obrigada'), 'passado nao e pedido');
  check(!acusa('Quero comprar uma bandeira do Capitao Martim'), 'ela quer comprar de nos');
  check(!acusa('Como faco pra comprar camiseta da campanha?'), 'pergunta de como comprar');

  /** Fala politica: e o vocabulario desta base, e a terceira pessoa nao e nenhuma das formas. */
  check(!acusa('Esses politicos compram votos com cesta basica, e uma vergonha'), '"compram votos" e critica');
  check(!acusa('Meu voto nao se compra'), '"nao se compra" e declaracao de apoio');
  check(!acusa('O governo paga pouco para os professores'), 'terceiro pagando nao e pedido');
  check(!acusa('Comprei a ideia de voces, estou junto'), '"comprei a ideia" e apoio');

  /** Quem OFERECE nao esta pedindo — a guarda que o detector ja tinha. */
  check(!acusa('Se precisar eu pago a impressao dos santinhos'), 'ela oferece pagar');
  check(!acusa('Quero doar um pouco do meu tempo para a campanha'), 'ela quer doar');
}

/**
 * TRABALHAR PARA A CAMPANHA NAO E PROCURAR EMPREGO — print do Luciano (09/09/2026).
 *
 * *"Posso trabalhar aqui para o Capitao Martim"*, *"Ja trabalhei para outros candidatos e consegui
 * muitos votos"*, *"Mais preciso de material"*, *"E combinarmos quanto vou ganhar"*. A rodada
 * mandou para a IA, que escreveu seis linhas negociando remuneracao. Ele: *"aqui a resposta rapida
 * sobre trabalhar na campanha bastava; trabalhamos somente com voluntarios sem remuneracao e caso
 * tenha interesse dar o endereco"*.
 *
 * **Medido: DOIS detectores estavam mudos.**
 */
{
  grupo('quer trabalhar para a campanha (o Luciano, 09/09)');

  const um = (t) => [{ texto: t, tipo: 'TEXT', at: 1 }];
  const tipo = (t) => { const r = pedeEmprego(um(t), null); return r ? r.tipo : null; };

  /**
   * **O nome do candidato nao estava na lista de objetos**, so `deputado` e `candidato` — a mesma
   * correcao que `INSULTO_AO_ALIADO` levou em 08/09. E `trabalhar` tinha de vir COLADO na
   * preposicao, e ele escreveu *"trabalhar AQUI para"*.
   */
  check(tipo('Posso trabalhar aqui para o Capitao Martim') === 'campanha', 'o caso do Luciano, com o NOME e a palavra no meio');
  check(tipo('trabalhar para o martim') === 'campanha', 'so o sobrenome tambem');
  check(tipo('E combinarmos quanto vou ganhar') === 'campanha', 'falar em quanto vai ganhar e a mesma conversa');
  check(tipo('quero trabalhar na campanha') === 'campanha', 'a forma que ja casava continua casando');

  /** Procurar TRABALHO e o outro caso, e a resposta dele e o SINE. */
  check(tipo('preciso de emprego') === 'emprego', 'quem procura emprego continua sendo "emprego"');
  check(tipo('tem alguma vaga ai') === 'emprego', 'a pergunta pela vaga tambem');
  check(tipo('estou procurando trabalho') === 'emprego', 'e quem procura trabalho');

  /** As guardas continuam: e a metade cara desta regra. */
  check(!pedeEmprego(um('sou voluntaria e quero ajudar de graca'), null), 'quem se oferece de graca nao esta pedindo');
  check(!pedeEmprego(um('vamos trabalhar juntos por um Brasil melhor'), null), 'grito de campanha nao e pedido');
  check(!pedeEmprego(um('obrigado pelo trabalho de voces'), null), 'elogio ao trabalho nao e pedido');
  check(!pedeEmprego(um('vou trabalhar amanha cedo'), null), 'a rotina dela nao e pedido');
  check(!pedeEmprego(um('o governo tem que gerar emprego'), null), 'fala politica sobre emprego nao e pedido');

  /**
   * **O POSSESSIVO entre a preposicao e o substantivo** — anotacao da Solange (08/09, lida em 10/09):
   * *"posso trabalhar na sua campanha"* devolvia null. E a licao do "trabalhar NA campanha" (05/09)
   * de novo: preposicao, artigo e possessivo sao pecas separadas.
   */
  check(tipo('posso trabalhar na sua campanha') === 'campanha', 'o caso da Solange: "na SUA campanha"');
  check(tipo('Capitao sou pobre nao moro aqui quero ir embora pra Sao paulo pode me ajudar posso trabalhar na sua campanha') === 'campanha',
    'a frase inteira dela');
  check(tipo('quero trabalhar para o seu mandato') === 'campanha', '"o SEU mandato"');
  check(tipo('da pra trabalhar com a tua campanha?') === 'campanha', '"a TUA campanha"');
  check(!pedeEmprego(um('vou trabalhar na sua cidade amanha'), null), 'possessivo com outro objeto nao e pedido');
  check(!pedeEmprego(um('vamos trabalhar juntos pela sua campanha'), null), 'o grito de campanha continua de fora');

  /**
   * **"Mais preciso de material" nunca casou** — o padrao aceitava `preciso de` so quando seguido de
   * receber/ter/pegar, ou seja *"preciso de receber material"*, que ninguem escreve. **Foi a trava
   * `enderecoSemMaterial` de ontem que revelou o buraco**: ela acusou o rascunho que pedia o
   * endereco, certa sobre a forma e errada sobre o caso, porque ele TINHA pedido material.
   */
  const pedeMat = (t) => !!pedeMaterial(um(t), null);
  check(pedeMat('Mais preciso de material'), 'a frase exata da print');
  check(pedeMat('preciso dos adesivos'), 'e o objeto especifico');
  check(pedeMat('estou precisando de material'), 'e o gerundio');
  check(pedeMat('necessito de material'), 'e "necessito"');

  /** O OBJETO e o que guarda: "preciso de" sozinho e a frase mais comum desta base. */
  check(!pedeMat('preciso de ajuda'), 'preciso de AJUDA nao e material');
  check(!pedeMat('preciso de uma cesta basica'), 'nem cesta basica');
  check(!pedeMat('preciso de emprego'), 'nem emprego');
  check(!pedeMat('preciso do numero dele'), 'nem o numero dele');
  check(!pedeMat('preciso de informacao sobre a agenda'), 'nem informacao');
}

/**
 * PEDIR QUE A GENTE CONSIGA UMA COISA E PEDIDO DE DOACAO — print do Oseias (09/09/2026).
 *
 * *"Viu se vc conseguir uma bota de gaucho, numero 42"*, e o rascunho ofereceu o endereco e o
 * repasse a equipe de materiais — o caso da Cleo (08/09) se repetindo com outro objeto. Regra dele:
 * *"nossa lista e pequena do que podemos dar, que e (folhetos, adesivos etc); todo o resto entra
 * como pedido de emprego, ajuda, doacao"*.
 *
 * **A guarda que faz esta regra ser segura sem enumerar objetos e a LISTA DE PERMISSAO do
 * material** — havendo palavra de material na rajada, isto nao decide nada e `pedeMaterial` resolve.
 */
{
  grupo('pedir que a gente consiga uma coisa (o Oseias, 09/09)');

  const um = (t) => [{ texto: t, tipo: 'TEXT', at: 1 }];
  const acusa = (t) => !!pedeAjudaFinanceira(um(t), null);

  check(acusa('Viu se vc conseguir uma bota de gaucho , numero 42 ,eu fico muito feliz'), 'a frase exata da print');
  check(acusa('voce consegue uma cadeira de rodas pra mim'), 'cadeira de rodas');
  check(acusa('vcs conseguem um colchao?'), 'colchao');
  check(acusa('me arruma uma cesta basica'), '"me arruma"');

  /** A LISTA DE PERMISSAO ganha: o que a campanha tem para dar nao e pedido de doacao. */
  check(!acusa('voce consegue uns adesivos pra mim'), 'adesivo e material');
  check(!acusa('vcs conseguem uma bandeira'), 'bandeira tambem');
  check(!acusa('me arruma uns folhetos'), 'e folheto, que ele nomeou');

  /** O verbo tem que ser de OBTER, e o que vem depois tem que ser COISA. */
  check(!acusa('voce consegue verificar isso pra mim?'), 'verificar e fazer, nao obter');
  check(!acusa('voce consegue falar com a prefeitura?'), 'falar tambem');
  check(!acusa('vc consegue o numero dele?'), 'numero nao e coisa');
  check(!acusa('voces conseguem o link do grupo?'), 'link tambem nao');
  check(!acusa('se voces conseguirem uma resposta me avisem'), 'nem resposta');

  /**
   * **O SUJEITO e obrigatorio, e foi a medicao que obrigou** — sem ele, *"vamos conseguir a
   * vitoria"* virava pedido de doacao. E a quinta vez que este arquivo aprende que verbo sozinho e
   * fala de campanha.
   */
  check(!acusa('vamos conseguir a vitoria'), 'grito de campanha nao e pedido');
  check(!acusa('juntos vamos conseguir um Brasil melhor'), 'nem este');
  check(!acusa('espero que voces consigam muitos votos'), 'nem torcida');
  check(!acusa('consegui uma vaga, obrigado'), 'passado nao e pedido');
}

/**
 * RECLAMAR DE NAO TER SIDO ATENDIDA E TECLA 6 — decisao dele (09/09/2026), sobre o print do Maicon:
 * *"Ninguem quis entrar em contato comigo"*, escrito quatro minutos depois de ele chegar pelo
 * anuncio. Perguntado se aquilo devia virar tecla 6: *"virar tecla 6"*.
 *
 * **Nao existe resposta pronta para isto, e escrever uma seria pior:** o que a pessoa esta dizendo e
 * que NOS falhamos com ela. Texto automatico em cima disso confirma a queixa, e concluir em silencio
 * confirma duas vezes.
 */
{
  grupo('reclama de nao ter sido atendida (o Maicon, 09/09)');

  const um = (t) => [{ texto: t, tipo: 'TEXT', at: 1 }];
  const acusa = (t) => !!reclamaSemResposta(um(t), null);

  check(acusa('Ninguem quis entrar em contato comigo'), 'a frase exata da print');
  check(acusa('ninguem me respondeu ate agora'), 'ninguem me respondeu');
  check(acusa('ninguem me atendeu'), 'ninguem me atendeu');
  check(acusa('voces nunca respondem'), 'a queixa dirigida a nos');
  check(acusa('mandei mensagem semana passada e ninguem respondeu'), 'mandei e ninguem respondeu');
  check(acusa('estou esperando resposta ha dias'), 'a espera');
  check(acusa('ja faz uma semana sem retorno nenhum'), 'sem retorno');
  check(acusa('ate hoje sem resposta'), 'sem resposta');
  check(acusa('me sinto ignorado'), 'ignorado');
  check(acusa('nao fui atendido ate hoje'), 'nao fui atendido');

  /**
   * **A GUARDA e o alvo ser NOS, e e ela que sustenta a regra.** Nesta base *"ninguem me respondeu"*
   * e dito o tempo todo sobre a prefeitura, o CRAS, o INSS e o banco — e ai e o OPOSTO: e o caso que
   * o mandato existe para encaminhar, e que tem caminho proprio.
   */
  check(!acusa('ninguem me respondeu na prefeitura'), 'a queixa e da prefeitura');
  check(!acusa('fui no CRAS e ninguem me atendeu'), 'e do CRAS');
  check(!acusa('estou esperando resposta do INSS ha meses'), 'e do INSS');
  check(!acusa('liguei no posto de saude e ninguem respondeu'), 'e do posto de saude');
  check(!acusa('o banco nunca responde'), 'e do banco');

  /** E o vocabulario comum que tem "ninguem" e "esperando" dentro. */
  check(!acusa('ninguem merece esse governo'), '"ninguem merece" e fala politica');
  check(!acusa('ninguem quer trabalhar mais hoje em dia'), 'nem esta');
  check(!acusa('ninguem vai nos parar'), 'nem grito de campanha');
  check(!acusa('obrigado por responder rapido'), 'elogio nao e queixa');
  check(!acusa('voces sempre respondem, parabens'), 'nem este');
  check(!acusa('estou esperando o evento com ansiedade'), 'esperar o EVENTO nao e esperar resposta');
  check(!acusa('vou esperando a resposta do medico'), 'nem a resposta do medico');
}

/**
 * A CONFIRMACAO FICA PENDENTE ATE ALGUEM TRATAR — print do Dair (09/09/2026).
 *
 * *"Quero confirmar minha presenca no evento: AMIGOS CAPITAO MARTIM E GUSTAVO VICTORINO"* as 09:02,
 * e um link do Facebook as 09:45. A rodada mandou a mensagem do momento e concluiu — *"era pra pular
 * e concluiu por causa do link"*.
 *
 * **Medido: nao foi o link.** `confirmaPresenca` devolvia "sim" com a confirmacao sozinha e **null**
 * com o link junto, porque `rajadaFinal` corta em **30 minutos** e 43 separam as duas: a confirmacao
 * virou "rajada anterior" e sumiu, **sem nunca ter sido respondida**.
 *
 * O corte de tempo esta certo para o que ele foi escrito (a pessoa digitando de uma vez) e errado
 * para este sinal, que e um ESTADO pendente. O limite passou a ser so a NOSSA ultima mensagem.
 */
{
  grupo('a confirmacao fica pendente ate alguem tratar (o Dair, 09/09)');

  const conf = { texto: 'Quero confirmar minha presenca no evento: AMIGOS CAPITAO MARTIM E GUSTAVO VICTORINO', tipo: 'TEXT', at: '2026-09-09T09:02:00' };
  const link = { texto: 'https://www.facebook.com/share/r/19WE1ghYgg/', tipo: 'TEXT', at: '2026-09-09T09:45:00' };

  check(confirmaPresenca([conf, link], null) === 'sim', 'o caso da print: 43 minutos depois, ainda vale');
  check(confirmaPresenca([conf], null) === 'sim', 'a confirmacao sozinha continua valendo');
  check(confirmaPresenca([conf, { texto: 'ok', tipo: 'TEXT', at: '2026-09-09T09:45:00' }], null) === 'sim',
    'qualquer mensagem depois nao apaga a confirmacao');

  /**
   * **O limite e a NOSSA ultima mensagem, e nao a conversa inteira** — senao quem confirmou em julho
   * seria pulado para sempre.
   */
  check(confirmaPresenca([conf, { texto: 'https://x.com/y', tipo: 'TEXT', at: '2026-09-09T10:30:00' }], '2026-09-09T10:00:00') === null,
    'respondida, a confirmacao deixa de estar pendente');

  /** A negativa posterior continua vencendo: e a ressalva que decide. */
  check(confirmaPresenca([conf, { texto: 'infelizmente nao vou poder ir', tipo: 'TEXT', at: '2026-09-09T09:45:00' }], null) === 'nao',
    'quem confirmou e depois desistiu conta como NAO');

  /**
   * **`desdeNossaUltima` e `rajadaFinal` respondem perguntas DIFERENTES**, e e por isso que as duas
   * existem: uma diz o que ainda nao respondemos, a outra o que ela digitou de uma vez.
   */
  const distantes = [conf, link];
  check(rajadaFinal(distantes, null).length === 1, 'a rajada final continua cortando em 30 minutos');
  check(desdeNossaUltima(distantes, null).length === 2, 'e o pendente pega as duas');
  check(desdeNossaUltima(distantes, '2026-09-09T09:30:00').length === 1, 'cortando na nossa ultima fala');

  /** Mensagem sem horario fica: descarta-la esconderia fala que ninguem respondeu. */
  check(desdeNossaUltima([{ texto: 'sem hora' }], '2026-09-09T09:30:00').length === 1, 'mensagem sem horario nao some');
}

/**
 * O TEXTO DO ANUNCIO NAO E PERGUNTA DELA — print da Lidia (10/09/2026). Ela clicou no anuncio
 * *"Ola! Posso ter mais informacoes sobre isso?"*, cadastrado com a acao "mandar o modelo", e o
 * quadro deu tecla 6 (pergunta pendente) em vez do recibo. Ele: *"nao reconheceu o anuncio"* — e
 * reconheceu: `ehMensagemDeAnuncio` dava true. Quem nao olhava a marca eram os detectores de pergunta.
 */
{
  grupo('o texto do anuncio nao e pergunta dela (a Lidia, 10/09)');
  const at = Date.parse('2026-09-10T13:15:00-03:00');
  const doAnuncio = 'Olá! Posso ter mais informações sobre isso?';
  const P = ['Olá! Posso ter mais informações sobre isso?'];
  const pergunta = (ents, padroes = []) => !!conversaTemPerguntaAberta(ents, null, padroes);
  const pendente = (ents, padroes = []) => perguntaPendente(ents, null, padroes);

  const marcada = [{ texto: doAnuncio, tipo: 'TEXT', at, geradaPeloAnuncio: true }];
  check(!pergunta(marcada), 'com a marca de gerada pelo anuncio: nao e pergunta aberta');
  check(!pendente(marcada), 'nem pergunta pendente');
  const cadastrada = [{ texto: doAnuncio, tipo: 'TEXT', at }];
  check(!pergunta(cadastrada, P), 'com o texto cadastrado na Config: nao e pergunta aberta');
  check(!pendente(cadastrada, P), 'nem pergunta pendente');

  /** **A guarda: o que ELA escreve continua sendo pergunta.** */
  check(pergunta(cadastrada), 'sem marca e sem cadastro, a mesma frase continua sendo pergunta');
  const depois = [...marcada, { texto: 'qual o número dele?', tipo: 'TEXT', at: at + 30000 }];
  check(pergunta(depois), 'pergunta escrita por ela DEPOIS do clique continua valendo');
  check(pendente(depois), 'e continua pendente');
  const mesmoTexto = [...marcada, { texto: 'Posso ter mais informações sobre isso?', tipo: 'TEXT', at: at + 30000 }];
  check(pendente(mesmoTexto), 'ela repetindo a pergunta com as proprias palavras tambem conta');
}

/**
 * O NUMERO COLADO NO NOME DA RUA — print da Natalia (10/09/2026). Ela respondeu ao pedido de endereco
 * com "Rua <nome> <numero>, <bairro> <cidade>" e a rodada agradeceu e concluiu em vez de pular e
 * marcar. `informouEndereco` so aceitava o numero depois da virgula, no fim ou com "no". Enderecos
 * abaixo sao ficticios.
 */
{
  grupo('numero colado no nome da rua e endereco (a Natalia, 10/09)');
  const end = (t) => !!informouEndereco([{ texto: t, tipo: 'TEXT' }], null);

  for (const t of [
    'Rua das Acácias 845, Vila Nova Cachoeira do Sul',
    'Rua das Flores 120, Centro, Canoas',
    'rua sete de setembro 1998, centro',
    'Av Brasil 900 - Centro',
    'Avenida Getúlio Vargas 3100; bairro São José',
    'Travessa dos Pinheiros 45\nIgrejinha',
  ]) {
    check(end(t), `e endereco: "${t.replace(/\n/g, ' / ')}"`);
  }

  /** **A guarda: reclamacao de rua e tempo nao sao endereco.** */
  for (const t of [
    'a rua aqui está esburacada há 20, ninguém arruma',
    'moro nessa rua desde 2010, nunca vi um asfalto',
    'a rua ficou 3 meses sem luz',
    'na minha rua tem 15 casas sem agua',
    'fui na rua do mercado e voltei',
    'a rua 13 de maio está linda',
  ]) {
    check(!end(t), `NAO e endereco: "${t}"`);
  }
}

/**
 * A EXCECAO DA ETIQUETA DE MATERIAL — regra dele (10/09/2026): *"a etiqueta de material sera colocada
 * quando o modelo de material sair, como prioridade, e em caso de excecao quando a pessoa pedir material
 * fora do anuncio"*. O clique no anuncio nao conta (quem o responde e o modelo, e o modelo marca), e o
 * vocabulario de conteudo DIGITAL fica de fora: a etiqueta manda pular.
 */
{
  grupo('pediu material fora do anuncio (regra de 10/09)');
  const pede = (texto, extra = {}, padroes = []) =>
    !!pedeMaterialForaDoAnuncio([{ texto, tipo: 'TEXT', ...extra }], padroes);

  for (const t of ['quero uns adesivos', 'me manda material de campanha', 'queria uma bandeira do capitao',
    'preciso de santinhos para distribuir', 'tem como me mandar uma camiseta?']) {
    check(pede(t), `marca: "${t}"`);
  }

  /** **O clique no anuncio nao e excecao** — pela marca e pela lista. */
  const doAnuncio = 'Olá! Eu quero receber o Material da Direita';
  check(!pede(doAnuncio, { geradaPeloAnuncio: true }), 'o clique no anuncio (marcado) nao marca');
  check(!pede(doAnuncio, {}, ['Olá! Eu quero receber o Material da Direita']), 'nem pelo texto cadastrado');

  /** **Conteudo digital e agradecimento nao marcam** — a etiqueta faria a rodada pular para sempre. */
  for (const t of ['quero receber o conteúdo', 'me manda o card', 'obrigada pelo material', 'não quero material nenhum',
    'quero uma arte para compartilhar']) {
    check(!pede(t), `NAO marca: "${t}"`);
  }
}

/**
 * VENDA DE VOTO E SEM INTERESSE — print da Simone (10/09/2026): *"Quer meu voto?"* e *"Faz um pix pra
 * mim"*, e a IA respondeu com a negativa de ajuda. Ele: *"estava praticamente propondo venda de votos,
 * ela sabe que e ilegal, e pessoa sem interesse"*. A oferta vem PARTIDA em duas mensagens.
 */
{
  grupo('venda de voto e sem interesse (a Simone, 10/09)');
  const sem = (...textos) => semInteresse(textos.map((texto, i) => ({ texto, tipo: 'TEXT', at: 1000 + i })), null);

  check(!!sem('Quer meu voto?', 'Fas um pix pra mim🤑'), 'a rajada da print, partida em duas mensagens');
  for (const t of ['vendo meu voto', 'quanto vocês pagam pelo meu voto?', 'meu voto por um pix', 'compra meu voto?',
    'quer meu voto? me manda 50 reais']) {
    check(!!sem(t), `e venda: "${t}"`);
  }

  /** **A guarda: a oferta sem dinheiro, a negativa e a critica a terceiro nao sao venda.** */
  for (const t of ['meu voto não se compra', 'quer meu voto? então trabalha pela nossa cidade', 'o PT compra voto com bolsa família',
    'já tem meu voto, capitão', 'faz um pix pra mim, to precisando']) {
    check(!sem(t), `NAO e venda: "${t}"`);
  }
  check(!sem('Quer meu voto?', 'meu voto não se compra, é pela segurança'), 'quem pergunta e diz que nao vende, nao vende');
}

/**
 * O PEDIDO DA COLINHA — print do Rodrigo (10/09/2026): *"Eu gostaria que me mandasse a sequencia para
 * votacao com os numeros do time de direita inteiro para eu passar para minha familia inteira"*, e o
 * atendimento foi concluido com o modelo. Os sete detectores davam null.
 */
{
  grupo('o pedido da colinha vai para a IA (o Rodrigo, 10/09)');
  const um = (texto) => [{ texto, tipo: 'TEXT', at: 1 }];
  const daPrint = 'Eu gostaria que me mandasse a sequência para votação com os números do time de direita inteiro para eu passar para minha família inteira';

  check(!!conversaTemPerguntaAberta(um(daPrint), null), 'a frase da print vira pergunta aberta (tecla 6, a IA)');
  check(perguntaPendente(um(daPrint), null) === true, 'e pendencia: o atendimento nao conclui em cima dela');

  const pede = (t) => pedeColinha(t.normalize('NFD').replace(/\p{Diacritic}/gu, ''));
  for (const t of ['me manda a colinha', 'tem como passar os números dos candidatos?', 'queria a lista da chapa pra votar',
    'pode me mandar os nomes dos deputados', 'preciso da cola eleitoral']) {
    check(pede(t), `pede a colinha: "${t}"`);
  }

  /** **A guarda: sem verbo de pedir, e fala de voto, nao sao pedido.** */
  for (const t of ['já tenho os números dos candidatos', 'eu não tenho nenhum dos números dos candidatos, mas vou votar',
    'o número do capitão é 10122 né', 'a lista de presença do evento', 'passa a cola aqui que o cano quebrou']) {
    check(!pede(t), `NAO pede: "${t}"`);
  }

  /**
   * **A primeira mensagem da sessao de anuncio so e texto pronto com cara de texto pronto.** O anuncio
   * CONVERSE CONOSCO nao traz texto, e o pedido dele era a primeira mensagem — marcado como do anuncio,
   * sumia de todo detector.
   */
  for (const t of ['Olá! Posso ter mais informações sobre isso?', 'Olá! Eu apoio as Escolas Cívico-Militares 🤝',
    'Ola! Eu quero receber o Material da Direita']) {
    check(pareceTextoProntoDeAnuncio(t), `e texto pronto: "${t}"`);
  }
  for (const t of [daPrint, 'Boa tarde, queria saber como faço pra ajudar', 'Olavo aqui, de Canoas',
    'Olá, ' + 'eu queria contar uma coisa que aconteceu na minha cidade e que precisa de atenção do deputado, porque a gente está sem resposta faz tempo e ninguém faz nada']) {
    check(!pareceTextoProntoDeAnuncio(t), `NAO e texto pronto: "${t.slice(0, 50)}"`);
  }
}

grupo('venda de voto pelo VERBO: "pix pra votar" (12/09/2026)');
{
  /**
   * Print do "Silva pinturas": *"Tem que enxerga nos num pix antes tenho 29 piao pra votar"* e, no
   * dia seguinte, *"Nao eu que quero um pix para votar em vcs"*.
   *
   * **Medido antes de mexer: `semInteresse` devolvia null nas duas rajadas** e
   * `pedeAjudaFinanceira` casava pelo "pix" -- entao o caso foi para a IA, que respondeu com a
   * negativa de ajuda. Os padroes da Simone (10/09) exigem o OBJETO "meu/nosso voto", e a forma
   * mais natural de propor a venda usa o VERBO com um elo de finalidade. E a licao do "queria uma
   * reuniao" (09/09) invertida.
   */
  const rajada = (textos) => semInteresse(textos.map((t) => ({ texto: t, tipo: 'TEXT' })));

  check(!!rajada(['Tem que enxerga nos num pix antes tenho 29 piao pra votar']), 'pix ANTES de votar e venda de voto');
  check(!!rajada(['Nao eu que quero um pix para votar em vcs']), '"um pix para votar em vcs" tambem');
  check(!!rajada(['manda um pix pra eu votar']), '"pix pra eu votar"');
  check(!!rajada(['quanto voces pagam pra votar']), '"quanto pagam pra votar"');
  check(!!rajada(['eu voto se mandarem um pix']), 'e a ordem inversa: "voto se mandarem um pix"');
  check(!!rajada(['Quer meu voto?', 'Faz um pix pra mim']), 'a forma da Simone (10/09) continua valendo');

  /**
   * **Onde mora o risco:** `semInteresse` aplica etiqueta PERMANENTE no CRM e conclui em silencio.
   * Nove das assercoes deste grupo sao falso positivo, e duas guardas sustentam o resto -- o
   * TERCEIRO (critica ao adversario) e a NEGACAO.
   */
  /**
   * **Medido: este caso NAO e da venda de voto** — quem dispara e a RECUSA EXPLICITA, por "nao
   * quero nada", que e outro caminho de `semInteresse` e mais antigo que este bloco. Fica anotado
   * em vez de travado: mexer na lista de recusa a partir de um caso que a print nao mostra seria
   * alargar a regra mais destrutiva do arquivo sem ele ter pedido.
   */
  check(
    !!rajada(['vou votar em voces, nao quero nada nem pix']),
    'FICA EM ABERTO: "nao quero nada" ainda decide sozinho, por outro caminho'
  );
  check(!rajada(['o PT da pix pra pobre votar neles']), 'critica ao adversario comprando voto nao e venda');
  check(!rajada(['esses politicos compram voto com dinheiro, e um absurdo']), 'nem a critica generica');
  check(!rajada(['nao vendo meu voto por pix nenhum']), 'nem a negativa explicita');
  check(!rajada(['meu voto nao se compra']), 'nem "meu voto nao se compra"');
  check(!rajada(['preciso de um pix pra pagar a luz, e vou votar em voces']), 'pedido de ajuda + apoio NAO e venda');
  check(!rajada(['vou votar em voces e depois se puder me ajuda com um pix']), 'nem apoio com pedido depois');
  check(!rajada(['me manda um pix que eu preciso de remedio']), 'nem pedido de dinheiro sem falar de voto');
  check(!rajada(['vou votar 10122']), 'nem a declaracao de voto sozinha');
}

grupo('"vou la" solto nao e confirmacao de presenca (12/09/2026)');
{
  /**
   * Print da Laura: audio de 1min16 de militancia e oracao -- *"estao botando os folhetos do 3 na
   * minha tela, EU VOU LA, rasgo tudo, boto no lixo"* -- e a rodada PULOU o contato. Relato dele:
   * *"pulando sem motivo, nao sei dizer o porque"*, e nao havia como saber: pular nao manda nada e
   * nao conclui.
   *
   * **Medido: `confirmaPresenca` devolvia "sim"**, e `confirmou-presenca-evento` e a tecla 2
   * (pular, regra dele de 03/09). Dos nove casos de fala comum deste grupo, **cinco** casavam.
   *
   * **QUINTA vez que esta funcao aprende a mesma coisa** — sairam "vamos"/"vou" soltos (02/09),
   * "confirmado" solto (04/09), "pode contar comigo" (04/09) e "estaremos" solto (06/09).
   */
  const presenca = (t) => confirmaPresenca([{ texto: t, tipo: 'TEXT' }], null);

  const transcricao =
    'estao botando os folhetos do 3 na minha tela, eu vou la, rasgo tudo, boto no lixo. ' +
    'So Jesus na casa, irmao, vai dar tudo certo, ne?';
  check(presenca(transcricao) !== 'sim', 'a transcricao da print NAO e confirmacao de presenca');

  check(!presenca('vou la ver se resolvo isso'), '"vou la ver se resolvo" nao e presenca');
  check(!presenca('vou la no CRAS amanha pedir ajuda'), 'nem "vou la no CRAS"');
  check(!presenca('amanha vou la na prefeitura cobrar'), 'nem "vou la na prefeitura"');
  check(!presenca('vou la e falo com o prefeito'), 'nem "vou la e falo com o prefeito"');
  check(!presenca('semana que vem eu vou para a rua trabalhar para ela'), 'nem a militancia de rua');

  /** **O que CONTINUA valendo**: a mensagem inteira, e o "sim" em qualquer posicao. */
  check(presenca('vou') === 'sim', 'a mensagem inteira "vou" continua sendo presenca');
  check(presenca('eu vou') === 'sim', 'e "eu vou" tambem (era falso negativo antes)');
  check(presenca('vou la') === 'sim', '"vou la" como a mensagem INTEIRA continua valendo');
  check(presenca('vou la!') === 'sim', 'com pontuacao tambem');
  check(presenca('vou sim') === 'sim', '"vou sim" em qualquer posicao');
  check(presenca('vou la sim') === 'sim', 'e "vou la sim" tambem');
  check(presenca('vou estar la') === 'sim', '"vou estar la" continua');
  check(presenca('vou comparecer') === 'sim', 'e "vou comparecer"');
  check(presenca('nao vou poder ir') === 'nao', 'e a recusa continua vencendo');
}

fim();
