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
import { soCortesia, ehSoReacao, ultimaEhSoReacao, pedeRespostaPessoal, conversaPedeRespostaPessoal, conversaTemPerguntaAberta, soExpressaApoio, ehMensagemDeAnuncio, pedeAlgoIndefinido, pedeAjudaFinanceira, confirmaPresenca, ehRepasse, rajadaEhSoRepasse, rajadaFinal, ehDespedida, ultimaEhDespedida, semInteresse , pedeEmprego } from '../src/lib/cortesia.js';

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
  check(p('pode contar comigo') === 'sim', 'pode contar comigo');
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
  for (const t of ['vou sim', 'Vou', 'irei', 'Vamos sim', 'vou estar la', 'vou la', 'vou participar', 'vou ao evento', 'Estarei la', 'confirmado', 'pode contar comigo', 'com certeza vou', 'la estarei']) {
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

fim();
