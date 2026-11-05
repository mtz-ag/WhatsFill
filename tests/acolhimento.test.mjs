/**
 * **O que a simulação de 05/11/2026 encontrou** — dez conversas lidas na tela dele, sem enviar.
 *
 * Os oito defeitos do relato caem em duas famílias, e as duas estão aqui:
 *
 * **(1) A ABSTENÇÃO DA IA VIRAVA A MENSAGEM DO DIA.** Agradecimento, elogio e emoji chegavam na
 * tecla 6 ou 3, a IA respondia *"não há o que responder"*, e o desfecho de 24/09 mandava o texto
 * do momento em cima de um *"Muito obrigada por zelar pela nossa segurança!"*.
 *
 * **(2) O TOM.** Emoji de tristeza recebendo formulário, saudação do período errado, *"não tenho
 * como confirmar"* em cima de um desastre, *"obrigado pelo apoio"* a quem não declarou apoio, e a
 * briga de casal no aparelho do marido lida como hostilidade contra o mandato.
 *
 * Rode: node tests/acolhimento.test.mjs
 */
import { check, grupo, fim, lib } from './_harness.mjs';
import * as cortesia from '../src/lib/cortesia.js';
import * as ia from '../src/lib/ia.js';

const sugestao = await lib('sugestao.js');

const NOSSA_AT = '2026-11-05T09:00:00-03:00';
const AGORA = new Date('2026-11-05T14:17:00-03:00');

/** A conversa como o painel a monta: a nossa fala e, depois dela, o que ela escreveu. */
const conversa = (...textos) => [
  { de: 'nos', texto: 'Obrigado pelo apoio!', at: NOSSA_AT },
  ...textos.map((t) => ({ de: 'contato', texto: t, at: '2026-11-05T14:00:00-03:00' })),
];

grupo('agradecimento e elogio nao recebem a mensagem do dia (05/11/2026)');
{
  /**
   * **Medido antes de mexer: dos doze detectores, só `falouAlgoProprio` casava** nos três casos —
   * nenhum sabia que aquilo era agradecimento, então o caso ia para a tecla 6, a IA se abstinha e
   * a mensagem do momento saía por cima.
   *
   * `soExpressaApoio` **não foi alargado** de propósito: *"parabéns"* é voto de boa vontade e só
   * conta como a mensagem inteira — a medição de 06/09 achou 15 falsos positivos em 19 frases.
   */
  const so = (...t) => cortesia.soAgradeceOuElogia(conversa(...t), NOSSA_AT);

  check(!!so('Muito obrigada por zelar pela nossa seguranca!'), 'o agradecimento da print e reconhecido');
  check(!!so('Parabens Capitao Martim! O Zucco esta escolhendo otimos auxiliares!'), 'e o elogio tambem');
  check(!!so('Otimo trabalho, continue assim'), 'e o elogio ao trabalho');

  /** As guardas, e cada uma é um caso que precisa continuar seguindo o caminho dele. */
  check(!so('Parabens! Quando vai ter evento aqui?'), 'quem PERGUNTA e respondido, nao agradecido');
  check(!so('Obrigada! Preciso de uma cesta basica'), 'o PEDIDO vem primeiro, e tem caminho proprio');
  check(
    !so('Obrigada. ' + 'tem uma coisa aqui no bairro que ninguem resolve ha anos e eu queria contar. '.repeat(3)),
    'texto longo e conversa, e conversa pede gente'
  );
  check(!so('Bom dia'), 'cumprimento sozinho nao e agradecimento — quem decide isso e soCortesia');

  /**
   * **A NOSSA mensagem não conta, e isto foi medido:** sem `nossaUltimaAt`, `desdeNossaUltima`
   * devolve a lista inteira e o *"Obrigado pelo apoio!"* que NÓS mandamos ligava o detector. E
   * chamada sem o corte é o caso real — o painel chama `semInteresse(state.entrantes)` assim.
   */
  check(!cortesia.soAgradeceOuElogia(conversa('Bom dia')), 'sem o corte, a nossa propria fala nao liga o sinal');

  /** E o desfecho: a abstenção não vira a tecla 5. */
  check(
    !!sugestao.abstencaoNaoCabe({ soAgradeceOuElogia: so('Muito obrigada por tudo!') }),
    'com agradecimento, a abstencao da IA NAO vira a mensagem do dia'
  );
  check(!sugestao.abstencaoNaoCabe({}), 'e sem nenhum dos tres sinais a regra dele de 24/09 vale como sempre');
}

grupo('emoji de tristeza pede acolhimento, nunca formulario (05/11/2026)');
{
  /**
   * Print da Rosicler: ela respondeu **😢** à nossa mensagem e a rodada ofereceu a tecla 4 —
   * *"me diga seu Nome, Cidade"*.
   *
   * **Medido: `ehSoReacao` e `cortesiaDeFechamento` davam os dois VERDADEIROS** — o projeto tratava
   * o 😢 como quem *"só agradeceu ou retribuiu o cumprimento"* (31/10). O 👍 fecha a conversa; o
   * 😢 a abre.
   */
  const triste = conversa('\u{1F622}');
  const polegar = conversa('\u{1F44D}');

  check(!!cortesia.reacaoDeTristeza(triste, NOSSA_AT), 'o emoji de tristeza e reconhecido');
  check(!cortesia.reacaoDeTristeza(polegar, NOSSA_AT), 'e o polegar continua sendo so uma reacao');
  check(
    !cortesia.cortesiaDeFechamento(triste, NOSSA_AT, { janelaHoras: 48 }),
    'o fecho por cortesia NAO conclui em cima de sofrimento'
  );
  check(
    !!cortesia.cortesiaDeFechamento(polegar, NOSSA_AT, { janelaHoras: 48 }),
    'e continua concluindo quando ela so reagiu — a regra de 31/10 nao afrouxou'
  );
  check(
    !cortesia.reacaoDeTristeza(conversa('o posto fechou \u{1F622} e agora nao sei o que fazer'), NOSSA_AT),
    'emoji no MEIO de um texto nao decide: ali quem atende e o texto'
  );

  /**
   * **A guarda fica na TECLA e não na condição** (a lição da Noeli, 06/09): barrando a condição o
   * caso escorrega para a caixa de baixo, e várias delas ENVIAM.
   */
  const regraDoFormulario = sugestao.REGRAS.find((r) => r.id === 'nunca-pediram-dados');
  check(!!regraDoFormulario, 'a regra do formulario existe');
  const ctxBase = { veioDeAnuncio: true, anuncioReconhecido: false, podeMandarMomento: false, momentoJaEnviado: false };
  check(regraDoFormulario.tecla({ ...ctxBase }) === '4', 'sem tristeza, o formulario continua saindo');
  check(
    regraDoFormulario.tecla({ ...ctxBase, reacaoDeTristeza: { motivo: 'x' } }) === '6',
    'com tristeza o desfecho e a tecla 6 — acolher e trabalho de gente ou da IA'
  );
  check(
    sugestao.rascunhoSemCadastro({ reacaoDeTristeza: { motivo: 'x' } }),
    'e o rascunho da IA tambem nao fecha pedindo cadastro'
  );
}

grupo('a cidade que ela acabou de escrever nao e pedida de novo (05/11/2026)');
{
  /**
   * Print do sergio: *"Bom dia"* / *"Aqui do cacequi"* recebeu a tecla 4 — nome E cidade — com o
   * popup *"Cidade a gravar: Cacequi"* aberto ao lado.
   *
   * **O parser acertou** (medido: Cacequi, confiança `exata`). O que faltava era a escolha do que
   * pedir olhar só o CAMPO do cadastro, que continua vazio porque cidade de palpite espera o
   * clique dele — e essa regra, de 31/08, não muda.
   */
  const semCadastro = [{ de: 'contato', texto: 'Bom dia', at: '2026-11-05T14:00:00-03:00' }];

  check(
    ia.pedidoDeCadastroDoRascunho(semCadastro, {}) === ia.PEDIDO_DE_DADOS_NO_RASCUNHO,
    'sem nada, o pedido continua sendo o formulario inteiro'
  );
  const soONome = ia.pedidoDeCadastroDoRascunho(semCadastro, {}, { cidadeNoTexto: true });
  check(soONome !== ia.PEDIDO_DE_DADOS_NO_RASCUNHO, 'com a cidade no texto, o formulario inteiro NAO sai');
  check(/nome/i.test(soONome) && !/cidade/i.test(soONome), 'o que sobra e o pedido do NOME, e so dele');
  check(
    ia.pedidoDeCadastroDoRascunho(semCadastro, { Cidade: 'Cacequi' }, {}) !== ia.PEDIDO_DE_DADOS_NO_RASCUNHO,
    'a cidade ja GRAVADA tem o mesmo efeito, como sempre teve'
  );
}

grupo('a saudacao do periodo errado nao sobra em lugar nenhum (05/11/2026)');
{
  /**
   * Print da Iraci: mensagem às 14:17 e o rascunho abrindo com *"Bom dia!"*.
   *
   * **Medido: a troca FUNCIONA no caso comum** — o que havia eram dois buracos. Tirar e trocar
   * eram `if`/`else if`, e `semSaudacao` devolve `null` quando a abertura é tudo o que há no
   * texto: com `jaFalamosHoje` verdadeiro o `else if` nem era alcançado. E o padrão ancorava em
   * `^`, então *"Olá! Bom dia"* escapava dos dois.
   */
  const comoSaiu = (texto, ctx) => ia.revisarRascunho(texto, AGORA, ctx).texto;

  check(ia.saudacaoDeAgora(AGORA) === 'Boa tarde', 'as 14:17 a saudacao certa e boa tarde');
  check(
    comoSaiu('Bom dia! Eu que agradeco pelo carinho.', { jaFalamosHoje: false }) === 'Boa tarde! Eu que agradeco pelo carinho.',
    'o caso comum: a errada e trocada'
  );
  check(
    comoSaiu('Bom dia! Eu que agradeco pelo carinho.', { jaFalamosHoje: true }) === 'Eu que agradeco pelo carinho.',
    'e falando com ela duas vezes no dia, a saudacao SAI'
  );
  check(
    !/bom\s+dia/i.test(comoSaiu('Bom dia!', { jaFalamosHoje: true })),
    'nao dando para tirar (a abertura e tudo o que ha), a TROCA e o piso'
  );
  check(
    !/bom\s+dia/i.test(comoSaiu('Ola! Bom dia, obrigado.', { jaFalamosHoje: false })),
    'e a interjeicao antes nao esconde mais a saudacao errada'
  );
  check(
    comoSaiu('Eu que agradeco pelo carinho.', {}) === 'Eu que agradeco pelo carinho.',
    'rascunho sem saudacao continua sem — acrescentar seria escrever no lugar da IA'
  );
}

grupo('tom juridico e agradecimento de apoio que nao houve (05/11/2026)');
{
  /**
   * Print da Noeli: fotos do desastre, o marido tirando gente da água, e o rascunho respondeu
   * *"Não tenho como confirmar essa informação, então prefiro não afirmar"*.
   *
   * **Isto já era regra do projeto e não estava sendo cumprido:** a regra 14 (22/09) diz, com estas
   * palavras, que *"não tenho essa informação" NÃO é a resposta*. Por isso a trava vale em
   * QUALQUER contexto — e é isso que dispensa inventar um detector de "desastre", que seria a
   * lista de texto que não fecha.
   */
  const avisos = (texto, ctx = {}) => ia.revisarRascunho(texto, AGORA, ctx).avisos;
  const temJuridico = (texto, ctx) => avisos(texto, ctx).includes(ia.AVISOS_QUE_IMPEDEM_ENVIO.tomJuridico);
  const temApoio = (texto, ctx) => avisos(texto, ctx).includes(ia.AVISOS_QUE_IMPEDEM_ENVIO.agradeceuApoioQueNaoHouve);

  check(temJuridico('Nao tenho como confirmar essa informacao, entao prefiro nao afirmar.', {}), 'a frase da print barra');
  check(temJuridico('Eu nao posso afirmar isso.', {}), 'e a forma com "nao posso afirmar"');
  check(temJuridico('Sobre esse caso, prefiro nao opinar.', {}), 'e o "prefiro nao opinar"');
  check(!temJuridico('Vou verificar isso e te retorno.', {}), '"vou verificar" NAO barra: e a frase que a regra 5 permite');
  check(!temJuridico('O caminho e a Defesa Civil do municipio, no 199.', {}), 'encaminhar para fora continua livre');
  check(
    !temJuridico('Que bom que seu marido ajudou. Forca para voces nesse momento.', {}),
    'e o acolhimento do desastre passa limpo'
  );
  check(
    !ia.rascunhoPodeSairSozinho(avisos('Prefiro nao afirmar nada sobre isso.', {})),
    'a trava BARRA o envio sozinho — ele le e decide'
  );

  /**
   * Print do Paulo César: ele compartilhou um post político e recebeu *"Obrigado pelo apoio e por
   * compartilhar. Seguimos firmes…"* — uma afirmação sobre o que ELA fez, a família do
   * `afirmouAcao` e do `desculpaInexistente`.
   */
  const generico = 'Obrigado pelo apoio e por compartilhar. Seguimos firmes.';
  check(temApoio(generico, { expressouApoio: false }), 'agradecer um apoio que ela nao declarou barra');
  check(!temApoio(generico, { expressouApoio: true }), 'declarado o apoio, agradecer e o certo');
  check(!temApoio(generico, {}), 'sem medicao a trava fica CALADA: afirmar o contrario e o mesmo erro ao reves');
  check(
    !temApoio('Obrigado por compartilhar. Isso precisa ser dito mesmo.', { expressouApoio: false }),
    'agradecer o COMPARTILHAMENTO continua livre — o que barra e inventar o apoio'
  );
}

grupo('xingamento ao titular nao e hostilidade contra o mandato (05/11/2026)');
{
  /**
   * Print do Adriano: a esposa falando no celular do marido, chamando o MARIDO de *"babaca"* e
   * *"mentiroso"*. A rodada ofereceu a tecla `s` — etiqueta permanente de sem interesse mais
   * conclusão em silêncio, em cima de um apoiador, por uma briga de casal.
   *
   * **Medido: o conserto da v3.263 não alcançava isto.** Ele ensinou o PROMPT a distinguir titular,
   * interlocutor e alvo do insulto — e `semInteresse` decide ANTES de a IA ser consultada, em
   * primeiro lugar na tabela. Quinta vez neste projeto em que uma decisão escrita num lugar não
   * chega ao lugar onde ela decide.
   *
   * **A guarda é um DADO e não uma lista:** o nome do próprio contato.
   */
  const dela = (t) => conversa(t);
  const comNome = (t, nome) => cortesia.semInteresse(dela(t), NOSSA_AT, { nomeDoTitular: nome });

  check(!comNome('Adriano voce e um babaca mesmo', 'Adriano Guimaraes'), 'vocativo com o nome do titular nao marca');
  check(!comNome('voce e um mentiroso, Adriano', 'Adriano Guimaraes'), 'e o nome depois do pronome tambem nao');

  /** E a hostilidade de verdade continua sendo reconhecida — é o lado que não pode afrouxar. */
  check(
    !!comNome('voces sao uns vagabundos, nunca fizeram nada', 'Adriano Guimaraes'),
    'xingar NOS continua sendo hostilidade, com nome no cadastro ou sem'
  );
  check(
    !!comNome('Adriano aqui. voces sao uns vagabundos mesmo', 'Adriano Guimaraes'),
    'o nome SOLTO na mensagem nao desfaz nada: a guarda exige o vocativo colado no pronome'
  );
  check(!!comNome('Adriano voce e um babaca mesmo', ''), 'sem nome no cadastro, o desfecho e o de sempre');
  check(!!comNome('Jo voce e um babaca', 'Jo'), 'nome de duas letras nao vale como vocativo');
  check(
    !!comNome('nao quero receber mais nada, me tira da lista', 'Adriano Guimaraes'),
    'e quem pede para sair continua saindo — a guarda nao toca nesse caminho'
  );
  check(
    !!cortesia.semInteresse(dela('voces sao uns vagabundos'), NOSSA_AT),
    'chamador antigo, sem o terceiro argumento, decide exatamente como antes'
  );
}

grupo('desejar sucesso tambem e carinho, e felicitacao e LONGA (05/11/2026)');
{
  /**
   * **Print do Mauricio: 462 caracteres felicitando pela nova missao, e a rodada mandou para a
   * mao dele** — a IA marcou `naoHaOQueResponder` e o painel escreveu *"a IA nao achou o que
   * responder nisso"*. Pergunta dele: *"por que a IA nao achou algo quando era uma questao de
   * agradecer?"*.
   *
   * **Medido antes de mexer, e o diagnostico obvio era o errado.** A guarda que barrava nao era
   * so o teto de 200: o texto **nao casa NENHUMA** das cinco formas de agradecer/elogiar, nem
   * cortado em 200 — ele nunca diz "obrigado" nem "parabens". Diz *"tenho plena confianca"*,
   * *"sucesso nessa nova missao"*, *"um forte abraco"*.
   *
   * ```
   * soAgradeceOuElogia .... null      <- nao e agradecimento nem elogio
   * soExpressaApoio ....... null      <- voto de boa vontade, a medicao de 06/09
   * desabafoPessoal ....... null
   * semInteresse .......... null
   * falouAlgoProprio ...... casou     <- o unico, e ele leva a tecla 6
   * ```
   *
   * **E a classe e NOVA:** o anuncio da Defesa Civil (29/10) passou a trazer felicitacao pelo
   * cargo todo dia, e nenhum detector a conhecia.
   */
  const AT = '2026-11-05T10:47:00-03:00';
  const NOSSA = '2026-11-05T09:00:00-03:00';
  const um = (t) => [{ texto: t, tipo: 'TEXT', at: AT, de: 'contato' }];
  const carinho = (t) => !!cortesia.soAgradeceOuElogia(um(t), NOSSA);

  const felicitacao = [
    'Bom dia, Capitao!',
    '',
    'Tenho plena confianca de que voce sabera conduzir e superar os novos desafios que surgirao em sua trajetoria.',
    '',
    'Suas competencias profissionais, experiencia e capacidade de lideranca sao qualidades que certamente farao a diferenca nessa nova etapa.',
    '',
    'Sucesso nessa nova missao! Voce esta preparado para esse novo desafio.',
    '',
    'Um forte abraco!',
  ].join('\n');

  check(felicitacao.length > 200, 'a felicitacao da print passa de 200 caracteres — e por isso o teto antigo a descartava');
  check(carinho(felicitacao), 'felicitacao longa pela nova missao e carinho, e tem resposta');

  check(carinho('Sucesso sempre!'), 'desejar sucesso conta');
  check(carinho('Estamos torcendo pelo senhor nessa nova etapa.'), 'torcer conta');
  check(carinho('Muito merecido! Boa sorte na nova funcao.'), 'merecido e boa sorte contam');
  check(carinho('Muito obrigada por zelar pela nossa seguranca!'), 'e o agradecimento de ontem continua contando');

  /**
   * **"nao tive sucesso no INSS" e EXITO, nao voto** — a forma mais comum de "sucesso" nesta
   * base. Sem esta guarda, quem conta que nao conseguiu resolver recebia instrucao de obrigado.
   */
  check(!carinho('Fiz de tudo e nao tive sucesso no INSS, ja sao oito meses esperando a pericia.'),
    'sucesso de EXITO nao e voto de bem');
  check(!carinho('Tentei sem sucesso falar com a prefeitura sobre a rua aqui do bairro.'),
    'e "sem sucesso" tambem nao');

  /**
   * **As tres guardas que substituiram o teto de tamanho.** O teto protegia de verdade o
   * desabafo que abre agradecendo (a Cris, 02/09) — e isso tem detector proprio, que diz o que
   * o tamanho so insinuava.
   */
  const desabafo = 'Oi. Bom dia, obrigada por responder. Eu estou passando por um momento muito dificil, perdi meu emprego, minha mae esta doente e eu nao sei mais o que fazer da vida. Chorei a noite inteira e nao tenho ninguem para conversar.';
  check(desabafo.length > 200 && !carinho(desabafo), 'desabafo que abre agradecendo continua fora — mas agora por SER desabafo, nao por ser longo');
  check(!carinho('URGENTE repassem para todos os grupos. Estao desviando verba da merenda na prefeitura e ninguem faz nada. Boa sorte a quem ainda confia nesses politicos.'),
    'corrente com "boa sorte" dentro continua fora');

  check(!carinho('Obrigada pelo retorno! Queria saber se voces conseguem me mandar o material.'),
    'pedido educado continua sendo pedido');
  check(!carinho('Parabens pela nomeacao! O senhor vai continuar como deputado?'),
    'quem pergunta e respondido, nao agradecido');

  /**
   * **A ASSIMETRIA continua sendo o desenho, e e ela que permite a lista alargada:** este sinal
   * NUNCA envia e NUNCA conclui — ele so impede a abstencao de virar a mensagem do dia e pede a
   * IA um obrigado curto. **E por isso que as mesmas palavras que a medicao de 06/09 tirou de
   * `soExpressaApoio` podem decidir aqui:** la o desfecho e agradecer o apoio E CONCLUIR.
   */
  check(cortesia.soExpressaApoio(um('Sucesso nessa nova missao! Um forte abraco!'), NOSSA, []) === null,
    'e soExpressaApoio NAO foi alargado: voto de boa vontade continua nao sendo declaracao de apoio');

  check(!!sugestao.abstencaoNaoCabe({ soAgradeceOuElogia: cortesia.soAgradeceOuElogia(um(felicitacao), NOSSA) }),
    'com o sinal aceso, a abstencao da IA nao vira a mensagem do dia');
}

fim();
