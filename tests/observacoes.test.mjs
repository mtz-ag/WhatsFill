/**
 * As observacoes da rodada: o que ele anota quando a sugestao esta errada.
 *
 * O que este arquivo protege e a UTILIDADE da anotacao. "essa sugestao esta errada" sem o caso
 * junto nao me diz nada -- eu responderia adivinhando. Entao a entrada nasce com a regra, a tecla,
 * o motivo que a caixa mostrou e o que a pessoa escreveu, e nada disso e opcional.
 *
 * Rode: node tests/observacoes.test.mjs
 */
import { check, grupo, fim } from './_harness.mjs';
import * as obs from '../src/lib/observacoes.js';

const caso = (extra) => ({
  contato: 'Deoclecio Mello',
  regra: 'nunca-pediram-dados',
  tecla: '4',
  motivo: 'veio do anuncio e nunca pedimos o nome e a cidade dela',
  mensagens: ['Boa tarde', 'Recebi o convite', 'Que bom! Vou sim'],
  etiquetas: ['ADS', 'CACHOEIRINHA'],
  porque: 'ele ja tem todas as etiquetas, era so agradecer',
  ...extra,
});

grupo('a anotacao carrega o caso junto');
{
  const it = obs.nova(caso());
  check(it.regra === 'nunca-pediram-dados', 'guarda a regra que decidiu');
  check(it.tecla === '4', 'e a tecla que ela mandou apertar');
  check(it.mensagens.length === 3, 'e as mensagens dela, nao so a ultima');
  check(it.mensagens[it.mensagens.length - 1].includes('Vou sim'), 'a mais recente por ultimo');
  check(it.etiquetas.length === 2, 'e as etiquetas do contato');
  check(!!it.em && it.em.includes('T'), 'e carimba a hora sozinho');

  // A hora vinda de fora e respeitada: e o que permite reimportar sem embaralhar a ordem.
  check(obs.nova(caso({ em: '2026-09-02T10:00:00.000Z' })).em === '2026-09-02T10:00:00.000Z', 'aceita a hora ja gravada');
}

grupo('nao grava anotacao vazia');
{
  /**
   * Botao que grava nada e diz "salvo" ensina a nao confiar no botao. Quem chama precisa saber que
   * nao gravou para poder avisar na tela.
   */
  const r = obs.acrescentar([], caso({ porque: '' }));
  check(r.gravou === false && r.lista.length === 0, 'sem o porque, nao grava');
  check(obs.acrescentar([], caso({ porque: '   ' })).gravou === false, 'so espaco tambem nao');
  check(obs.acrescentar([], caso()).gravou === true, 'com o porque, grava');
}

grupo('a lista nao cresce para sempre');
{
  let lista = [];
  for (let i = 0; i < obs.MAX + 25; i++) lista = obs.acrescentar(lista, caso({ porque: 'nota ' + i })).lista;
  check(lista.length === obs.MAX, `para em ${obs.MAX} anotacoes`);
  // A mais ANTIGA sai: o armazenamento nao e infinito, e o problema recente e o que interessa.
  check(lista[lista.length - 1].porque === 'nota ' + (obs.MAX + 24), 'a mais recente fica por ultimo');
  check(!lista.some((x) => x.porque === 'nota 0'), 'e a primeira saiu');
}

grupo('a peneira do que veio do armazenamento');
{
  check(obs.normalizar(null).length === 0, 'lista ausente vira vazia');
  check(obs.normalizar('nada').length === 0, 'o que nao e lista vira vazia');
  check(obs.normalizar([null, 7, 'x']).length === 0, 'item que nao e objeto e descartado');
  check(obs.normalizar([{ porque: 'ok' }]).length === 1, 'item com o porque sobrevive');
  check(obs.normalizar([{ contato: 'x' }]).length === 0, 'item SEM o porque e descartado');

  // Texto longo e cortado -- `chrome.storage.local` nao e infinito.
  const gigante = obs.nova(caso({ porque: 'x'.repeat(5000), mensagens: ['y'.repeat(5000)] }));
  check(gigante.porque.length <= 1000, 'o porque e limitado');
  check(gigante.mensagens[0].length <= 300, 'a mensagem dela tambem');
  check(obs.nova(caso({ etiquetas: Array(40).fill('E') })).etiquetas.length <= 12, 'e as etiquetas');

  // Campo desconhecido nao passa: e o mesmo cuidado de `arvore.sanitizar`.
  const extra = obs.nova({ porque: 'ok', enviarPix: 1 });
  check(!('enviarPix' in extra), 'campo desconhecido nao passa');
}

grupo('o texto que ele cola para mim');
{
  check(obs.paraTexto([]).includes('Nenhuma observação'), 'lista vazia diz que esta vazia');

  let lista = [];
  lista = obs.acrescentar(lista, caso({ porque: 'primeira' })).lista;
  lista = obs.acrescentar(lista, caso({ porque: 'segunda' })).lista;
  lista = obs.acrescentar(lista, caso({ regra: 'conteudo-pedido', tecla: '1', porque: 'outra regra' })).lista;

  const t = obs.paraTexto(lista);
  /**
   * Agrupado por REGRA porque e assim que eu conserto: uma regra errada e um lugar no codigo, e ver
   * as tres vezes que ela errou juntas mostra o padrao que uma sozinha nao mostra.
   */
  check(t.includes('## nunca-pediram-dados  (2×)'), 'agrupa por regra e conta quantas vezes');
  check(t.includes('## conteudo-pedido  (1×)'), 'e separa a outra regra');
  check(t.includes('primeira') && t.includes('segunda') && t.includes('outra regra'), 'todas as anotacoes saem');
  check(t.includes('Deoclecio Mello'), 'com o contato');
  check(t.includes('Vou sim') && t.includes('Recebi o convite'), 'e com as mensagens dela, nao so a ultima');
  check(t.includes('tecla 4'), 'e a tecla que a caixa sugeriu');
  check(t.includes('ADS, CACHOEIRINHA'), 'e as etiquetas');

  // Sem regra nenhuma (a caixa nao sugeriu nada) tem grupo proprio, e nao some.
  const semRegra = obs.paraTexto(obs.acrescentar([], caso({ regra: '', porque: 'a caixa nao sugeriu nada' })).lista);
  check(semRegra.includes('sem regra'), 'o caso sem regra tem grupo proprio');
}

grupo('apagar tudo');
{
  check(obs.apagarTudo().length === 0, 'devolve lista vazia');
}


grupo('o contexto sao as CINCO ultimas (02/09/2026)');
{
  /**
   * Pedido dele depois de me mandar as dez primeiras anotacoes: *"o contexto das conversas esta
   * muito pequeno, deve pegar ao menos as 5 ultimas mensagens"*. Estava certo -- em varias delas a
   * ultima mensagem era um link solto ou um "Estamos juntos", e o que explicava o caso estava duas
   * mensagens acima. Com uma so, eu leria o sintoma sem a conversa.
   */
  check(obs.MAX_MENSAGENS === 5, 'guarda cinco');

  const muitas = obs.nova(caso({ mensagens: ['1', '2', '3', '4', '5', '6', '7'] }));
  check(muitas.mensagens.length === 5, 'passando de cinco, guarda cinco');
  check(muitas.mensagens[0] === '3' && muitas.mensagens[4] === '7', 'e sao as CINCO ULTIMAS, nao as primeiras');

  // Anotacao gravada pela versao anterior tinha `mensagem` no singular: nao pode se perder.
  const antiga = obs.nova({ porque: 'x', mensagem: 'a unica que eu tinha' });
  check(antiga.mensagens.length === 1 && antiga.mensagens[0] === 'a unica que eu tinha', 'a anotacao antiga sobrevive');

  check(obs.nova({ porque: 'x' }).mensagens.length === 0, 'sem mensagem nenhuma nao quebra');
  check(obs.nova({ porque: 'x', mensagens: ['', '  ', 'ok'] }).mensagens.length === 1, 'mensagem em branco nao conta');

  // No texto que ele cola, uma so continua numa linha; varias viram uma lista.
  const uma = obs.paraTexto([obs.nova({ porque: 'p', regra: 'r', mensagens: ['so essa'] })]);
  check(uma.includes('ela escreveu: "so essa"'), 'com uma mensagem, a linha e direta');
  const varias = obs.paraTexto([obs.nova({ porque: 'p', regra: 'r', mensagens: ['antes', 'depois'] })]);
  check(varias.includes('as ultimas 2 dela:') || varias.includes('as últimas 2 dela:'), 'com varias, vira lista');
  check(varias.includes('· "antes"') && varias.includes('· "depois"'), 'e todas aparecem');
}


grupo('a copia manda so as NOVAS (02/09/2026)');
{
  /**
   * Pedido dele: *"ao copiar vai vir casos anteriores, eu tenho que lembrar de apagar para comecar
   * outra rodada"*. Regra que exige alguem lembrar nao e regra -- e a saida que ele tinha (apagar
   * tudo depois de colar) e destrutiva: colagem que der errado leva as anotacoes junto.
   */
  let lista = [];
  lista = obs.acrescentar(lista, caso({ porque: 'primeira' })).lista;
  lista = obs.acrescentar(lista, caso({ porque: 'segunda' })).lista;

  check(obs.naoCopiadas(lista).length === 2, 'as duas comecam como novas');

  // Copia as duas.
  lista = obs.marcarCopiadas(lista, obs.naoCopiadas(lista));
  check(obs.naoCopiadas(lista).length === 0, 'depois de copiadas, nao ha novas');
  check(lista.length === 2, 'e nenhuma se perdeu -- marcar nao e apagar');

  // Chega uma terceira: so ela e nova.
  lista = obs.acrescentar(lista, caso({ porque: 'terceira' })).lista;
  const novas = obs.naoCopiadas(lista);
  check(novas.length === 1 && novas[0].porque === 'terceira', 'a nova leva so traz a terceira');
  check(obs.paraTexto(novas).includes('terceira'), 'e o texto dela sai');
  check(!obs.paraTexto(novas).includes('primeira'), 'sem as ja copiadas');

  // "Copiar todas" continua possivel: o historico nao se perde.
  check(obs.paraTexto(lista).includes('primeira'), 'o texto de todas ainda traz as antigas');

  /**
   * A marca e pelo `em` (o instante em que a anotacao nasceu) e nao pela posicao: entre o clique e
   * a gravacao o painel pode ter acrescentado outra, e marcar por indice pegaria a errada.
   */
  const antes = obs.acrescentar([], caso({ em: '2026-09-02T10:00:00.000Z', porque: 'a' })).lista;
  const depois = obs.acrescentar(antes, caso({ em: '2026-09-02T11:00:00.000Z', porque: 'b' })).lista;
  const so_a = obs.marcarCopiadas(depois, [depois[0]]);
  check(so_a[0].copiada === true && so_a[1].copiada === false, 'marca exatamente a que foi copiada');

  // A marca sobrevive a leitura do armazenamento.
  check(obs.normalizar(so_a)[0].copiada === true, 'e sobrevive ao normalizar');
  check(obs.nova({ porque: 'x' }).copiada === false, 'anotacao nova nasce sem a marca');
}

grupo('a anotacao guarda a VERSAO e a hora (03/09/2026)');
{
  /**
   * Das oito anotacoes de um lote, tres ja estavam consertadas quando ele me mandou -- e com a
   * data sozinha, num dia com varios consertos, nao havia como saber. Eu medi caso a caso para
   * descobrir que nao havia nada a fazer. A anotacao nasce no instante da decisao, entao a versao
   * de entao e o unico dado que responde "isto ja foi consertado?".
   */
  const it = obs.nova({ porque: 'errou', versao: '1.70.0', em: '2026-09-03T16:45:00.000Z', contato: 'Fulano' });
  check(it.versao === '1.70.0', 'a versao e guardada');

  const texto = obs.paraTexto([it]);
  check(texto.includes('v1.70.0'), 'e sai no relatorio');
  check(/03\/09\/2026 \d\d:\d\d/.test(texto), 'com a HORA junto do dia');

  // Anotacao antiga nao tem versao, e continua valendo: campo vazio some do relatorio.
  const antiga = obs.nova({ porque: 'errou', em: '2026-09-01T10:00:00.000Z' });
  check(antiga.versao === '', 'sem versao, campo vazio');
  check(!obs.paraTexto([antiga]).includes(' · v'), 'e o relatorio nao inventa uma');
}

grupo('a anotacao diz QUANDO ela falou pela ultima vez (04/09/2026)');
{
  /**
   * Mesmo pedido dele que pos a linha na caixa da rodada: *"a sugestao nao fala que foi ontem a
   * mensagem dela, especifique sempre quando foi feita a ultima mensagem"*.
   *
   * Vale igual aqui -- eu li varios lotes sem saber se as mensagens eram do mesmo dia, e
   * "cumprimento de hoje" e "cumprimento de ontem" pedem desfechos diferentes desde o criterio de
   * tempo do apoio.
   */
  const em = '2026-09-04T09:40:00';
  const com = (ultima) => obs.paraTexto([obs.nova({ porque: 'x', em, ultimaDelaEm: ultima })]);

  check(com('2026-09-04T08:00:00').includes('no mesmo dia'), 'mesma data: "no mesmo dia"');
  check(com('2026-09-03T11:00:00').includes('no dia ANTERIOR'), 'vespera: "no dia ANTERIOR"');
  check(com('2026-09-01T11:00:00').includes('3 dias antes'), 'tres dias atras');

  // Sem o campo (anotacao antiga) o relatorio nao inventa nada.
  check(!obs.paraTexto([obs.nova({ porque: 'x', em })]).includes('a última dela'), 'sem o campo, nada aparece');
  check(!com('nao-e-data').includes('a última dela'), 'data invalida tambem nao');
  check(obs.nova({ porque: 'x', ultimaDelaEm: '2026-09-03T11:00:00' }).ultimaDelaEm === '2026-09-03T11:00:00', 'o campo e guardado');
}

grupo('descreverMensagem: a anotacao mostra o que NAO e texto (04/09/2026)');
{
  /**
   * Pedido dele: *"as observacoes estao com um problema: elas pegam so texto e ignoram fotos, links
   * e emojis; ao menos tem que ter ciencia do que foi enviado alem do texto"*.
   *
   * A anotacao juntava `m.texto` e descartava o vazio -- figura, figurinha e audio sem transcricao
   * sumiam. Duas perdas: eu lia uma conversa que nunca existiu daquele jeito, e o corte das cinco
   * ultimas alcancava mensagens mais antigas para completar o numero.
   */
  const d = (m) => obs.descreverMensagem(m);

  check(d({ texto: 'bom dia', tipo: 'TEXT' }) === 'bom dia', 'texto passa como esta');
  check(d({ texto: '👍🏻👍🏻', tipo: 'TEXT' }) === '👍🏻👍🏻', 'emoji e texto, e continua aparecendo');
  check(d({ texto: 'https://youtu.be/x', tipo: 'TEXT' }) === 'https://youtu.be/x', 'link tambem');

  // O que sumia:
  check(d({ texto: '', tipo: 'IMAGE' }) === '[foto, sem legenda]', 'foto sem legenda vira uma linha');
  check(d({ texto: '', tipo: 'STICKER' }) === '[figurinha]', 'figurinha');
  check(d({ texto: '', tipo: 'AUDIO' }) === '[áudio, sem transcrição]', 'audio sem transcricao');
  check(d({ texto: '', tipo: 'VIDEO' }) === '[vídeo, sem legenda]', 'video');
  check(d({ texto: '', tipo: 'DOCUMENT' }) === '[arquivo]', 'arquivo');
  check(d({ texto: '', tipo: 'COISA_NOVA' }) === '[coisa_nova, sem texto]', 'tipo desconhecido nao some');

  // A transcricao vem marcada: e fala ouvida por maquina, nao o que ela escreveu.
  check(d({ texto: 'moro em Canoas', tipo: 'AUDIO', transcrito: true }) === '[áudio transcrito] moro em Canoas',
    'audio com transcricao vem marcado');

  /**
   * O ruido da plataforma aparece COMO TAL: "ela mandou algo que a plataforma nao leu" e
   * informacao, nao ausencia -- a mesma distincao que `semRuidoDaPlataforma` preserva ao esvaziar
   * em vez de descartar.
   */
  check(d({ texto: '', tipo: 'TEXT', sistema: true }) === '[aviso da plataforma: mensagem não suportada]',
    'o ruido da plataforma tem a sua propria linha');

  check(d(null) === '[text, sem texto]', 'nulo nao explode');
}

fim();
