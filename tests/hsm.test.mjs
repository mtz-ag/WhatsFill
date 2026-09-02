/**
 * Modelos de mensagem: a escolha da linha no diálogo.
 *
 * É o ponto onde errar significa mandar o modelo errado para um contato real, e a conta tem
 * modelos de nome repetido ("A" e "A", "Flávio" e "Flávio"), então a regra é: na dúvida,
 * recusa.
 */
import { check, grupo, fim, lib, mem } from './_harness.mjs';

const { pickRow, PARAMS_NAO_APRENDIDOS, templateParaConteudo, parseContentTemplates, formatContentTemplates, modeloPorTexto, escolherConteudo, decidirSemResposta, decidirReenvio } =
  await lib('hsm.js');

// Linhas como o diálogo as mostra: nome + começo do texto (line-clamp de uma linha).
const LINHAS = [
  { name: 'A', preview: 'Bom dia! Agora é oficial: aprovado na convenção, sou candidato' },
  { name: 'A', preview: 'Boa tarde! Agora é oficial: aprovado na convenção, sou candidato' },
  { name: 'Bolsonaro 03/08', preview: 'Ele avisou desde o início…' },
  { name: 'Flávio', preview: 'Sintonizado com o Trabalho de Verdade! Você acaba de garantir' },
  { name: 'Flávio', preview: 'Sintonizado com o Trabalho de Verdade! A partir de agora, você' },
];

grupo('nome único casa direto');
{
  const r = pickRow(LINHAS, { name: 'Bolsonaro 03/08', text: 'Ele avisou desde o início…' });
  check(r && r.name === 'Bolsonaro 03/08', 'achou o modelo de nome único');
}

grupo('candidato único ainda assim confere o texto');
{
  // Regressão de um bug pego ao vivo: enquanto a busca repinta, a lista passa por um estado
  // com UM só "Flávio" na tela — e era o Flávio errado. Aceitar pelo nome mandou o modelo
  // trocado para a tela de envio. Nome nunca basta quando existe texto para conferir.
  const soUmaLinha = [{ name: 'Flávio', preview: 'Sintonizado com o Trabalho de Verdade! Você acaba de garantir' }];

  const errado = pickRow(soUmaLinha, { name: 'Flávio', text: 'Sintonizado com o Trabalho de Verdade!\n\nA partir de agora, você está conectado' });
  check(errado === null, 'recusou o candidato único cujo texto diverge');

  const certo = pickRow(soUmaLinha, { name: 'Flávio', text: 'Sintonizado com o Trabalho de Verdade!\n\nVocê acaba de garantir sua entrada' });
  check(certo === soUmaLinha[0], 'aceitou o candidato único cujo texto bate');
}

grupo('nome repetido desempata pelo começo do texto');
{
  const manha = pickRow(LINHAS, { name: 'A', text: 'Bom dia! \n\nAgora é oficial: aprovado na convenção' });
  check(manha && manha.preview.startsWith('Bom dia'), 'pegou a versão "Bom dia"');

  const tarde = pickRow(LINHAS, { name: 'A', text: 'Boa tarde! \n\nAgora é oficial: aprovado na convenção' });
  check(tarde && tarde.preview.startsWith('Boa tarde'), 'pegou a versão "Boa tarde"');
}

grupo('quebra de linha no texto da API não atrapalha o casamento');
{
  const r = pickRow(LINHAS, { name: 'Flávio', text: 'Sintonizado com o Trabalho de Verdade!\n\nVocê acaba de garantir sua entrada' });
  check(r && /Você acaba/.test(r.preview), 'achatou os espaços e casou a linha certa');
}

grupo('ambiguidade recusa em vez de chutar');
{
  // Os dois "Flávio" começam igual: 16 primeiros caracteres não separam.
  const r = pickRow(LINHAS, { name: 'Flávio', text: 'Sintonizado com o Trabalho de Verdade!' });
  check(r === null, 'devolveu null quando o prefixo não desempata');

  const semTexto = pickRow(LINHAS, { name: 'A', text: '' });
  check(semTexto === null, 'modelo sem texto e nome repetido não é escolhido');
}

grupo('nome que não está na tela');
{
  check(pickRow(LINHAS, { name: 'Pampa', text: 'qualquer' }) === null, 'devolveu null');
  check(pickRow([], { name: 'A', text: 'Bom dia' }) === null, 'lista vazia devolve null');
}

grupo('modelo com parâmetro tem recusa explicada');
{
  check(/parâmetro/i.test(PARAMS_NAO_APRENDIDOS), 'a mensagem diz o motivo');
  check(/plataforma/i.test(PARAMS_NAO_APRENDIDOS), 'e diz o que fazer no lugar');
}

grupo('conteúdo pedido → modelo a enviar');
{
  const modelos = [
    { id: 'm1', name: 'Zucco, Capitão', text: 'conteúdo do Zucco' },
    { id: 'm2', name: 'Flávio', text: 'primeira versão' },
    { id: 'm3', name: 'Flávio', text: 'segunda versão' },
  ];
  const mapa = parseContentTemplates('Conteúdo Zucco = Zucco, Capitão\nConteúdo Flávio = Flávio\nConteúdo Sumido = Não Existe');

  const ok = templateParaConteudo('Conteúdo Zucco', mapa, modelos);
  check(ok.modelo?.id === 'm1', 'achou o modelo mapeado');

  // Nome do modelo que não existe na plataforma: recusa em vez de mandar outro parecido.
  const inexistente = templateParaConteudo('Conteúdo Sumido', mapa, modelos);
  check(!inexistente.modelo && /não está na lista/.test(inexistente.erro), 'modelo inexistente vira erro explicado');

  // Dois modelos com o mesmo nome: não dá para saber qual, então não envia nenhum.
  const ambiguo = templateParaConteudo('Conteúdo Flávio', mapa, modelos);
  check(!ambiguo.modelo && /2 modelos/.test(ambiguo.erro), 'nome ambíguo recusa em vez de chutar');

  const semMapa = templateParaConteudo('Conteúdo Novo', mapa, modelos);
  check(!semMapa.modelo && /Config/.test(semMapa.erro), 'sem mapeamento, manda cadastrar na Config');

  check(templateParaConteudo('Conteúdo Zucco', {}, modelos).erro != null, 'mapa vazio não inventa modelo');
}

grupo('empate entre conteúdos: vence o preferido');
{
  const zucco = { nome: 'Conteúdo Zucco' };
  const flavio = { nome: 'Conteúdo Flávio' };

  // Empate é comum porque as regras também casam contra a campanha do anúncio: anúncio que
  // cita dois nomes faz o contato casar com os dois sem ter pedido nada.
  const dois = escolherConteudo([zucco, flavio], 'Conteúdo Flávio');
  check(dois.conteudo === flavio && dois.desempatado, 'com dois, escolheu o preferido');

  const um = escolherConteudo([zucco], 'Conteúdo Flávio');
  check(um.conteudo === zucco && !um.desempatado, 'com um só, não desempata nem troca');

  check(escolherConteudo([zucco, flavio], 'conteúdo flávio').conteudo === flavio, 'caixa não engana');
  check(escolherConteudo([zucco, flavio], 'Conteudo Flavio').conteudo === flavio, 'acento não engana');

  // Preferido ausente da disputa: não dá para inventar um vencedor.
  const semPreferido = escolherConteudo([zucco, { nome: 'Conteúdo Outro' }], 'Conteúdo Flávio');
  check(!semPreferido.conteudo && /nenhum deles o preferido/.test(semPreferido.erro), 'preferido fora da disputa recusa');

  const semConfig = escolherConteudo([zucco, flavio], '');
  check(!semConfig.conteudo && /preferido definido/.test(semConfig.erro), 'sem preferido configurado, recusa');

  check(escolherConteudo([], 'Conteúdo Flávio').erro === 'nenhum conteúdo reconhecido', 'lista vazia');
}

grupo('editor do mapeamento em texto');
{
  const mapa = parseContentTemplates('  Conteúdo Zucco = Zucco, Capitão \n# comentário\nlinha sem igual\n = sem etiqueta\nX =\n');
  check(Object.keys(mapa).length === 1, 'ignorou comentário, linha sem "=", etiqueta vazia e modelo vazio');
  check(formatContentTemplates(mapa).includes('Zucco, Capitão'), 'ida e volta preserva o nome do modelo');
  // Vírgula no nome do modelo não pode quebrar o parse (só o primeiro "=" separa).
  check(Object.values(mapa)[0] === 'Zucco, Capitão', 'nome com vírgula sobrevive');
}

grupo('registro anti-duplicata: por contato, com o nome de quem recebeu');
{
  // O aviso "já enviei esta resposta" apareceu em contato que não tinha recebido. O registro
  // agora guarda o nome, e é ele que diz se o aviso é do contato certo.
  const { wasSent, markSent } = await lib('templates.js');

  mem.sentLog = {};
  await markSent('c-1', 'pedir-dados', { nome: 'Marines' });

  const entrada = await wasSent('c-1', 'pedir-dados');
  check(entrada?.nome === 'Marines' && entrada.at > 0, `guardou nome e data = ${JSON.stringify(entrada)}`);
  check((await wasSent('c-2', 'pedir-dados')) === null, 'outro contato não herda o registro');
  check((await wasSent('c-1', 'agradecimento')) === null, 'outro template do mesmo contato também não');

  // Registro gravado por versão anterior era só o timestamp.
  mem.sentLog = { 'c-9|pedir-dados': 1754000000000 };
  const antigo = await wasSent('c-9', 'pedir-dados');
  check(antigo?.at === 1754000000000 && antigo.nome === '', 'registro antigo (só timestamp) continua valendo');
}

grupo('quando a rodada pode concluir sozinha, e quando tem que perguntar');
{
  const decidir = decidirSemResposta;

  // Respondido há pouco: a conversa está viva, fechar é o certo e perguntar seria teclar à toa.
  check(decidir({ horasDesdeMinha: 0.5, limiteHoras: 12 }).acao === 'concluir', 'meia hora → conclui sozinho');
  check(decidir({ horasDesdeMinha: 11.9, limiteHoras: 12 }).acao === 'concluir', 'pouco antes do limite → conclui');

  // Calado desde ontem: este é o que sumia da fila sem nunca ter mandado os dados.
  check(decidir({ horasDesdeMinha: 12, limiteHoras: 12 }).acao === 'perguntar', 'no limite exato → pergunta');
  check(decidir({ horasDesdeMinha: 30, limiteHoras: 12 }).acao === 'perguntar', 'mais de um dia → pergunta');

  // O motivo vai para a tela: é o que impede virar "alguns concluem e outros não".
  check(/14h sem resposta/.test(decidir({ horasDesdeMinha: 14.7, limiteHoras: 12 }).motivo), `motivo em horas = ${decidir({ horasDesdeMinha: 14.7 }).motivo}`);
  check(/3 dias sem resposta/.test(decidir({ horasDesdeMinha: 75, limiteHoras: 12 }).motivo), `motivo em dias = ${decidir({ horasDesdeMinha: 75 }).motivo}`);

  // O limite é configurável, e o padrão não pode sumir se alguém chamar sem nada.
  check(decidir({ horasDesdeMinha: 20, limiteHoras: 48 }).acao === 'concluir', 'limite maior segura mais tempo');
  check(decidir({ horasDesdeMinha: 13 }).acao === 'perguntar', 'sem limite informado, vale o padrão de 12h');
  check(decidir({}).acao === 'concluir', 'sem dado nenhum não inventa pergunta');
}

grupo('não mandar duas vezes para o mesmo contato');
{
  const decidir = decidirReenvio;

  // O caso ao vivo: o contato recebeu a resposta pronta às 14:05 e o modelo às 14:37. Chaves
  // diferentes, então o anti-duplicata POR MODELO não viu nada — duas mensagens em 32 minutos.
  // Foram DUAS rodadas, então a trava de "contato já tratado nesta rodada" também não pega.
  check(decidir({ ultimaFoiNossa: true, horasDesdeUltima: 0.53, limiteHoras: 48 }).acao === 'pular', '32 min depois: pula');
  check(/32 min/.test(decidir({ ultimaFoiNossa: true, horasDesdeUltima: 0.53 }).motivo), `motivo em minutos = ${decidir({ ultimaFoiNossa: true, horasDesdeUltima: 0.53 }).motivo}`);
  check(decidir({ ultimaFoiNossa: true, horasDesdeUltima: 20, limiteHoras: 48 }).acao === 'pular', 'no dia seguinte ainda pula');

  // Mas esta fila é de quem NÃO responde: bloquear para sempre a esvaziaria.
  check(decidir({ ultimaFoiNossa: true, horasDesdeUltima: 72, limiteHoras: 48 }).acao === 'enviar', 'passados 3 dias, segunda tentativa vale');
  check(decidir({ ultimaFoiNossa: true, horasDesdeUltima: 48, limiteHoras: 48 }).acao === 'enviar', 'no limite exato, envia');

  // Quem escreveu por último foi o contato: não é repetição, é resposta.
  check(decidir({ ultimaFoiNossa: false, horasDesdeUltima: 0.1 }).acao === 'enviar', 'se a última é dele, envia');
  check(decidir({}).acao === 'enviar', 'conversa vazia não bloqueia');
  check(decidir({ ultimaFoiNossa: true }).acao === 'enviar', 'sem saber quando foi, não inventa bloqueio');
}


grupo('escolherConteudo so recebe TEMA: a origem (ADS) nao chega mais aqui');
{
  const ESCOLAS = { nome: 'CONTEUDO ESCOLAS' };
  const FLAVIO = { nome: 'CONTEUDO FLAVIO' };

  /**
   * Decisao dele (02/09/2026): *"o conteudo a ser mandado nao deve ser decidido pelo ads, e sim
   * pelo texto do ads"*.
   *
   * Havia um `fallback` aqui para a etiqueta ADS perder de qualquer tema de verdade. Era meia
   * medida: quem chegava por anuncio e nao dizia mais nada continuava com a ADS escolhendo o
   * modelo -- e ADS diz que veio de anuncio, nao de QUAL. Print da Vera: anuncio das Escolas
   * Civico-Militares e a caixa oferecendo "Campanha Martim", porque a Config mapeia ADS para ele.
   *
   * Hoje a ADS sai de `tags.suggest` com origem `anuncio` e nao chega nesta funcao. O teste que
   * garante isso vive em `tags.test.mjs`; aqui fica o que sobrou: um desempate entre temas.
   */
  check(escolherConteudo([ESCOLAS], '').conteudo?.nome === 'CONTEUDO ESCOLAS', 'um tema so: e ele');
  check(!escolherConteudo([ESCOLAS], '').desempatado, 'e nao ha desempate para relatar');
  check(escolherConteudo([], '').erro === 'nenhum conteúdo reconhecido', 'sem conteudo: erro, nao chute');

  /**
   * O desempate por preferido continua existindo **entre iguais** — dois temas de verdade sem
   * preferido seguem sendo erro, com o motivo na tela. E a regra do projeto: na duvida, recusar.
   */
  check(escolherConteudo([FLAVIO, ESCOLAS], '').erro, 'dois temas sem preferido: erro, como antes');
  check(escolherConteudo([FLAVIO, ESCOLAS], 'conteudo escolas').conteudo?.nome === 'CONTEUDO ESCOLAS',
    'e o preferido desempata entre temas');

  check(escolherConteudo([], 'ads').erro, 'sem conteudo nenhum: erro');
}


grupo('modeloPorTexto: o TEXTO do anuncio escolhe o modelo, sem etiqueta nova');
{
  const modelos = [{ name: 'Campanha Martim2' }, { name: 'Escolas CM' }];
  const mapa = { 'Olá! Eu apoio as Escolas Cívico-Militares': 'Escolas CM' };

  /**
   * Pedido dele (01/09): *"nao sera feito etiqueta a etiqueta para os anuncios, agora e so ads; o
   * padrao para casar o modelo deve ser o texto (Ola! Eu apoio as Escolas Civico-Militares =
   * modelo)"*.
   *
   * A mensagem real vem com emoji e com o que a pessoa acrescentou depois — casar por igualdade
   * nunca funcionaria.
   */
  const real = ['Olá! Eu apoio as Escolas Cívico-Militares 🤙 olá Capitão Martins será a segunda vez'];
  check(modeloPorTexto(real, mapa, modelos)?.modelo?.name === 'Escolas CM',
    'casa com emoji e texto extra depois');

  /**
   * Ele digita a tabela a mao: "Civico" sem acento tem de casar com "Cívico" da mensagem. E o
   * proprio hsm.js reserva `semAcento` para exatamente este caso.
   */
  check(modeloPorTexto(real, { 'Ola! Eu apoio as Escolas Civico-Militares': 'Escolas CM' }, modelos)?.modelo?.name === 'Escolas CM',
    'acento e caixa nao impedem o casamento');

  /**
   * **A entrada mais especifica ganha.** Sem isto, "eu apoio" cadastrado para o modelo generico
   * venceria "eu apoio as escolas" pela ordem de digitacao — e ordem de digitacao nao e decisao.
   */
  const dois = { 'eu apoio': 'Campanha Martim2', 'eu apoio as Escolas Cívico-Militares': 'Escolas CM' };
  check(modeloPorTexto(real, dois, modelos)?.modelo?.name === 'Escolas CM', 'o trecho mais longo ganha');

  // Outro anuncio: nada casa, e a rodada cai no caminho antigo (etiqueta -> modelo).
  check(modeloPorTexto(['Olá! Eu apoio o Flávio, Zucco e Capitão Martim'], mapa, modelos) === null,
    'texto que nao esta na tabela devolve null');
  check(modeloPorTexto(real, {}, modelos) === null, 'tabela vazia devolve null');
  check(modeloPorTexto([], mapa, modelos) === null, 'sem mensagem devolve null');

  /**
   * Nome de modelo que a plataforma nao tem vira ERRO, nao null: null faria a rodada cair no
   * caminho da etiqueta como se nada tivesse acontecido, e o erro de configuracao dele
   * desapareceria em silencio.
   */
  const errado = modeloPorTexto(real, { 'escolas': 'Nao Existe' }, modelos);
  check(!!errado?.erro, 'modelo inexistente vira erro, nao null');
  check(/Nao Existe/.test(errado.erro), 'e o erro diz qual nome nao foi achado');

  // Nome repetido na plataforma: nao arrisca escolher.
  const repetido = modeloPorTexto(real, { 'escolas': 'Igual' }, [{ name: 'Igual' }, { name: 'Igual' }]);
  check(!!repetido?.erro && /2 modelos/.test(repetido.erro), 'dois modelos com o mesmo nome: recusa');
}



fim();
