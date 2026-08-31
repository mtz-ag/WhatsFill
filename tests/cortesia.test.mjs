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
import { check, grupo, fim } from './_harness.mjs';
import { soCortesia, ehSoReacao, ultimaEhSoReacao, pedeRespostaPessoal, ultimaPedeRespostaPessoal, conversaPedeRespostaPessoal, conversaTemPerguntaAberta, rajadaFinal, ehDespedida, ultimaEhDespedida } from '../src/lib/cortesia.js';

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
  check(!!pedeRespostaPessoal({ texto: '', tipo: 'VIDEO' }), 'vídeo também');
  check(!!pedeRespostaPessoal({ texto: '', tipo: 'DOCUMENT' }), 'documento também');

  // O caso da Janete: áudio de 1min13 que a plataforma transcreveu num texto enorme.
  const transcricao = 'Obrigada, eu já estou falando de você para meus filhos, eu tenho três filhos. '.repeat(8);
  const r = pedeRespostaPessoal({ texto: transcricao, tipo: 'TEXT' });
  check(!!r, 'transcrição longa pede resposta pessoal mesmo vindo como TEXT');
  check(/caracteres/.test(r.motivo), `o motivo diz o tamanho = ${r.motivo}`);

  check(!pedeRespostaPessoal({ texto: 'quero receber o conteúdo', tipo: 'TEXT' }), 'mensagem curta não pede');
  check(!pedeRespostaPessoal({ texto: '', tipo: 'IMAGE' }), 'figura não é caso disto (é reação)');
  check(!pedeRespostaPessoal({ texto: '', tipo: 'TEXT' }), 'vazia não pede');
  check(!pedeRespostaPessoal(null), 'nulo não explode');

  const t2 = (x, tipo) => ({ texto: x, tipo: tipo || 'TEXT' });
  check(!!ultimaPedeRespostaPessoal([t2('oi'), t2('', 'AUDIO')]), 'olha a última');
  check(!ultimaPedeRespostaPessoal([t2('', 'AUDIO'), t2('oi')]), 'a última é curta');
  check(!ultimaPedeRespostaPessoal([]), 'vazio');
}


grupo('despedida: a pessoa so fechou a conversa');
{
  const t = (x) => ({ texto: x, tipo: 'TEXT' });

  // A frase exata da print dele. A primeira versao NAO pegava:  antes de "é" nunca casa no
  // comeco da string, porque acento nao e caractere de palavra.
  check(ehDespedida(t('É nós.')), 'É nós. — a frase da print');
  check(ehDespedida(t('É NÓS')), 'em caixa alta');
  check(ehDespedida(t('é nois')), 'escrito como se fala');

  check(ehDespedida(t('Tamo junto!')), 'tamo junto');
  check(ehDespedida(t('estamos juntos 🙏')), 'estamos juntos com emoji');
  check(ehDespedida(t('Abraço')), 'abraço');
  check(ehDespedida(t('forte abraço')), 'forte abraço');
  check(ehDespedida(t('Valeu')), 'valeu');
  check(ehDespedida(t('vlw')), 'vlw');
  check(ehDespedida(t('tmj')), 'tmj');
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

  // Nunca respondemos: tudo esta pendente, e isso e o correto.
  check(rajadaFinal(lista, null).length === 3, 'sem nossa mensagem, a rajada e tudo');

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

  // A regra antiga NAO pegava: e a regressao que este teste tranca.
  check(!ultimaPedeRespostaPessoal(rajada), 'olhando so a ultima, passava batido');

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

fim();
