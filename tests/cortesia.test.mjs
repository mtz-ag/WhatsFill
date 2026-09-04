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
import { soCortesia, ehSoReacao, ultimaEhSoReacao, pedeRespostaPessoal, conversaPedeRespostaPessoal, conversaTemPerguntaAberta, soExpressaApoio, ehMensagemDeAnuncio, pedeAlgoIndefinido, pedeAjudaFinanceira, confirmaPresenca, ehRepasse, rajadaEhSoRepasse, rajadaFinal, ehDespedida, ultimaEhDespedida, semInteresse , pedeEmprego, ehMensagemDaPlataforma, deOutroDia, perguntaPendente } from '../src/lib/cortesia.js';

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

  // A frase exata da print dele. A primeira versao NAO pegava:  antes de "é" nunca casa no
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

fim();
