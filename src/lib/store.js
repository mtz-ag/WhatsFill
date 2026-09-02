/**
 * store.js — chrome.storage.local com defaults. Tudo que o usuário edita mora aqui.
 *
 * O token NÃO fica aqui de propósito (só em memória, ver bus.js).
 */

/**
 * Pergunta sobre grupos que a pessoa já participa, acrescentada ao pedido de dados.
 *
 * Fica em constante própria porque as migrações (`migrarPerguntaGrupos`, `migrarGruposPedeLink`)
 * precisam do mesmo texto para mexer no template que já está salvo no navegador.
 *
 * **Pede o LINK, não o nome** (decisão do Thiago, 11/08): o nome do grupo não serve para nada —
 * é o link de convite que permite entrar. Pedir "o nome ou o link" fazia quase todo mundo
 * mandar só o nome, e aí a informação chegava inútil e ainda dava trabalho de ler.
 *
 * O caminho no WhatsApp vai escrito na mensagem porque a maioria não sabe onde fica.
 */
export const PERGUNTA_GRUPOS =
  'Ah, e me conta: você já faz parte de algum grupo político no WhatsApp? ' +
  'Se sim, me manda o *link de convite* dele — é por ele que eu consigo entrar e somar com ' +
  'vocês. (No grupo: toque no nome dele em cima → Convidar via link → Copiar link.) 🇧🇷';

/**
 * O miolo do `pedir-dados` ANTES de "antes de qualquer coisa" (01/09/2026). Só a migração usa.
 *
 * É o trecho literal, e não o texto inteiro: as três versões (base e duas variantes) tinham
 * aberturas diferentes, e o que as identifica como "ainda de fábrica" é esta frase do meio.
 */
export const PEDIR_DADOS_MIOLO_ANTIGO = [
  // v1 (com a pergunta dos grupos no fim) — quem recebeu esta ainda precisa receber a v2.
  'Mas antes de qualquer coisa: me diz seu nome e a sua cidade, para eu salvar seu contato',
  'Antes de qualquer coisa, preciso de dois dados para salvar seu contato.',
  'Antes de mais nada, me diz quem é você e de onde fala, para eu salvar seu contato.',
  'Para eu te incluir no grupo certo da sua região, me responde nesta ordem, em uma única mensagem:',
  'Para eu te colocar no grupo certo da sua região, preciso de dois dados — me manda numa única mensagem, nesta ordem:',
  'Pra te incluir no grupo certo da sua região, só preciso de dois dados seus, numa mensagem só, nesta ordem:',
];

/** A versão anterior, que pedia "o nome ou o link". Só a migração usa. */
export const PERGUNTA_GRUPOS_ANTIGA =
  'Ah, e me conta: você já faz parte de algum grupo político no WhatsApp? ' +
  'Se sim, me manda o nome ou o link — assim consigo somar por lá também. 🇧🇷';

/**
 * A pergunta de interesse no conteúdo, que **já pede nome e cidade** para o caso de sim.
 *
 * Fica em constante própria porque a migração (`templates.migrarInteressePedeDados`) precisa do
 * mesmo texto para atualizar quem já tinha a versão anterior salva no navegador.
 */
export const INTERESSE_CONTEUDO =
  '{{saudacao}}! Aqui é da equipe do Capitão Martim e do Zucco. 🇧🇷\n\n' +
  'Posso te mandar por aqui os conteúdos e as novidades deles?\n\n' +
  'Se sim, me responde nesta ordem, em uma única mensagem:\n\n' +
  'Sim / Nome completo / Cidade\n\n' +
  '(exemplo: Sim / Maria Silva / Santo Ângelo)\n\n' +
  'Se preferir não receber, é só me dizer não — eu respeito e não incomodo mais.';

/** O texto anterior, sem o pedido de dados. Só a migração usa — não mande esta versão. */
export const INTERESSE_CONTEUDO_ANTIGO =
  '{{saudacao}}! Aqui é da equipe do Capitão Martim e do Zucco. 🇧🇷\n\n' +
  'Posso te mandar por aqui os conteúdos e as novidades deles?\n\n' +
  'Me responde só *sim* ou *não* — do jeito que você preferir, eu respeito.';

/**
 * As respostas prontas.
 *
 * **Nenhuma chama o contato pelo nome, e isso é regra do projeto** (decisão do Thiago,
 * 10/08/2026). O nome do cadastro erra com frequência alta demais para ir num texto que a
 * pessoa lê: apelido do perfil no lugar do nome ("Zane" por "Rosane Requia"), cidade no campo
 * do nome ("Santa Cruz - Serlei"), sigla colada ("Jeane do PL"), abreviação ("srn"), o apelido
 * automático do anúncio ("[NOVO] (51) 9…"). Errar o nome de alguém é erro que o contato percebe
 * na hora, e acertar não vale nada perto disso. De quebra some o bloqueio por variável sem
 * valor, que já tirou opção da pergunta da rodada duas vezes.
 *
 * Quem mexer aqui: `{{cidade}}` e `{{link_grupo}}` continuam valendo — o que saiu foi o nome.
 *
 * **`variantes`**: até duas reescritas alternativas do mesmo `text`, para `templates.js`
 * revezar entre as três a cada envio de verdade (ver `varianteAtual`/`avancarVariante`) — nasceu
 * do relato de que reabrir e mandar o MESMO texto repetido para muita gente parece ter pesado
 * no número. Regra ao escrever uma: muda só a superfície (abertura, conectivo, fechamento).
 * O que o parser ou a lei dependem fica **idêntico** nas três:
 *  - "Nome completo / Cidade" e "Sim / Nome completo / Cidade" são casadas literalmente por
 *    `extract.findStructured` — mexer aí quebra a resposta de quem responder pela variante 2 ou 3;
 *  - as mesmas `{{variáveis}}` do original, nunca uma nova;
 *  - `pedido-ajuda` e `pedido-emprego` ficam de fora de propósito: risco jurídico (Lei 9.504/97)
 *    é alto demais para reescrever por variedade, e são resposta a pedido individual, não
 *    disparo em massa — não é onde o problema de "parecer spam" mora.
 */
export const DEFAULT_TEMPLATES = [
  {
    /**
     * **"Antes de qualquer coisa"** — reescrito a pedido dele (01/09/2026).
     *
     * A mensagem é o portão do fluxo do anúncio: ela pede os dois dados e conclui, e a pessoa volta
     * pelo ramo de "pessoa retornando" com a resposta. *"não faz sentido perguntar quando a pessoa
     * não quer diálogo"* é a outra metade — quem vem hostil nem chega aqui, porque a recusa é
     * testada antes no quadro.
     *
     * A abertura calorosa ficou por pedido dele (*"pode ser mantida"*); o que mudou é o miolo, que
     * antes explicava o grupo da região antes de pedir. O pedido vem primeiro agora.
     *
     * **E a pergunta dos grupos saiu** (01/09/2026): *"não tem necessidade de perguntar por grupos,
     * ninguém estava me dando links"*. Era a segunda coisa a responder numa mensagem cujo ponto é
     * ser um portão curto, e a medida dele é a que vale — a pergunta existia para conseguir links de
     * convite, e links não estavam vindo.
     *
     * **A linha `Nome completo / Cidade` é intocável nas três versões.** É o invariante que
     * `extract.findStructured` casa para ler a resposta dela e que `templates.ehPedidoDeDados`
     * usa para reconhecer que esta mensagem foi o pedido — e ele tem teste nas três.
     */
    id: 'pedir-dados',
    name: 'Pedir dados (formato fixo)',
    text:
      '{{saudacao}}! Que bom ter você com a gente. 🇧🇷\n\n' +
      'Mas antes de qualquer coisa: me diz seu nome e a sua cidade, para eu salvar seu contato ' +
      'direitinho. Responde nesta ordem, numa mensagem só:\n\n' +
      'Nome completo / Cidade\n\n' +
      '(exemplo: Maria Silva / Santo Ângelo)',
    variantes: [
      '{{saudacao}}! Fico feliz que você esteja com a gente. 🇧🇷\n\n' +
        'Antes de qualquer coisa, preciso de dois dados para salvar seu contato. Me manda numa ' +
        'mensagem só, nesta ordem:\n\n' +
        'Nome completo / Cidade\n\n' +
        '(exemplo: Maria Silva / Santo Ângelo)',
      '{{saudacao}}! Que bom te ter por aqui. 🇧🇷\n\n' +
        'Antes de mais nada, me diz quem é você e de onde fala, para eu salvar seu contato. Numa ' +
        'mensagem só, nesta ordem:\n\n' +
        'Nome completo / Cidade\n\n' +
        '(exemplo: Maria Silva / Santo Ângelo)',
    ],
  },
  // A resposta "Perguntar o tema (opções numeradas)" saiu em 01/09/2026 junto com o campo "Tema de
  // Interesse": perguntar o que ninguém vai gravar é fazer o contato responder à toa.
  //
  // **Isto é o DEFAULT, não o que está salvo.** Quem já usava a extensão tem a resposta guardada no
  // `chrome.storage` e ela continua aparecendo na lista até ser apagada à mão na aba Respostas.
  {
    id: 'link-grupo',
    name: 'Enviar link do grupo',
    text:
      'Prontinho! Este é o grupo de {{cidade}}:\n\n' +
      '{{link_grupo}}\n\n' +
      'É lá que a gente avisa das agendas e manda os conteúdos primeiro. Te espero! 🇧🇷',
    variantes: [
      'Aqui está! Esse é o grupo de {{cidade}}:\n\n' +
        '{{link_grupo}}\n\n' +
        'As agendas e os conteúdos saem primeiro por lá. Vem com a gente! 🇧🇷',
      'Segue o grupo de {{cidade}}:\n\n' +
        '{{link_grupo}}\n\n' +
        'É por ali que avisamos as agendas e mandamos os conteúdos em primeira mão. Esperamos você! 🇧🇷',
    ],
  },
  {
    id: 'agradecimento',
    name: 'Agradecer e encerrar',
    text:
      'Obrigado pela atenção! Qualquer coisa, é só chamar por aqui. ' +
      'Um abraço e conte com a gente. 🇧🇷',
    variantes: [
      'Agradecemos a atenção! Qualquer necessidade, é só nos chamar por aqui. ' +
        'Um abraço e pode contar com a gente. 🇧🇷',
      'Muito obrigado pelo contato! Sempre que precisar, é só falar por aqui. ' +
        'Um abraço, e conte com a gente. 🇧🇷',
    ],
  },
  {
    /**
     * Pedido de dinheiro, cesta, remédio, passagem.
     *
     * A recusa se apoia na lei em vez de na vontade do gabinete — é verdade e tira o peso
     * pessoal do não. Base: Lei 9.504/97, art. 41-A (captação ilícita de sufrágio, que cita
     * expressamente dinheiro e emprego) e art. 73, §10 (distribuição gratuita de bens em ano
     * eleitoral). O caminho indicado é o SUAS: CRAS, Cadastro Único e os benefícios eventuais
     * da Lei 8.742/93 (LOAS), que existem justamente para nascimento, falecimento,
     * vulnerabilidade temporária e calamidade.
     */
    id: 'pedido-ajuda',
    name: 'Pedido de ajuda financeira (negar com respeito)',
    text:
      '{{saudacao}}! Obrigado por confiar na gente para falar de uma situação difícil. ' +
      'Li com atenção.\n\n' +
      'Preciso te responder com sinceridade: um mandato não pode doar dinheiro, cestas, ' +
      'remédios ou qualquer bem a eleitores. Não é falta de vontade — a lei eleitoral proíbe, ' +
      'e vale para todos os gabinetes, o ano inteiro.\n\n' +
      'O caminho certo para esse apoio é a assistência social do seu município, que é gratuita ' +
      'e feita para isso:\n\n' +
      '• CRAS do seu bairro — orienta e faz o seu Cadastro Único\n' +
      '• Secretaria de Assistência Social da prefeitura\n' +
      '• Em caso de nascimento, falecimento, calamidade ou vulnerabilidade temporária, existem ' +
      'os benefícios eventuais, previstos em lei\n\n' +
      'Se você já procurou e não foi atendido, me conta o que aconteceu. Aí sim é trabalho ' +
      'nosso: cobrar o poder público e encaminhar a sua situação a quem tem o dever de resolver.',
  },
  {
    /**
     * Pedido de emprego, indicação para vaga, "arruma um serviço para mim".
     *
     * Volume alto e o MESMO risco jurídico do `pedido-ajuda` — na verdade um pouco pior, porque
     * a lei cita **emprego** com todas as letras: Lei 9.504/97, art. 41-A, define captação
     * ilícita de sufrágio como oferecer ou prometer ao eleitor vantagem de qualquer natureza,
     * "inclusive emprego ou função pública". O art. 73, V ainda proíbe nomear, contratar ou
     * admitir servidor nos três meses anteriores ao pleito. Por isso a recusa se apoia na lei,
     * como a do `pedido-ajuda`: é verdade e tira o peso pessoal do não.
     *
     * O caminho indicado é o do trabalho, não o da assistência: no RS as agências do SINE são
     * operadas pela FGTAS, e as mesmas vagas estão no Emprega Brasil (gov.br). O CRAS entra
     * depois, para qualificação e para o que sustenta a pessoa enquanto o trabalho não vem.
     *
     * Não oferece encaminhar currículo a empresa nenhuma **de propósito**: intermediar contratação
     * é exatamente o que a regra proíbe, e "eu passo adiante" vira promessa que ninguém cumpre.
     */
    id: 'pedido-emprego',
    name: 'Pedido de emprego (negar com respeito)',
    text:
      '{{saudacao}}! Obrigado por confiar na gente para falar disso. ' +
      'Procurar trabalho cansa, e eu li a sua mensagem com atenção.\n\n' +
      'Preciso te responder com sinceridade: um mandato não pode arrumar emprego, indicar para ' +
      'vaga nem prometer contratação a eleitor. A lei eleitoral proíbe isso expressamente, e ' +
      'vale para todos os gabinetes, o ano inteiro — não é falta de vontade.\n\n' +
      'O caminho certo, e que é gratuito, é este:\n\n' +
      '• Agência do SINE/FGTAS da sua cidade — encaminha para as vagas abertas e resolve o ' +
      'seguro-desemprego (leve os documentos e a Carteira de Trabalho Digital)\n' +
      '• App ou site *Emprega Brasil* (gov.br) — as mesmas vagas do SINE, direto do celular\n' +
      '• CRAS do seu bairro — Cadastro Único, cursos gratuitos de qualificação e o apoio ' +
      'previsto em lei enquanto o trabalho não vem\n' +
      '• Concursos e seleções da prefeitura e do Estado saem sempre no site oficial — ali ' +
      'ninguém depende da indicação de ninguém\n\n' +
      'Se você já procurou o SINE ou a prefeitura e não foi atendido, me conta o que aconteceu. ' +
      'Aí sim é trabalho nosso: cobrar o poder público e encaminhar a sua situação a quem tem o ' +
      'dever de resolver.',
  },
  {
    /**
     * Saudação de abertura. Teor católico a pedido do Thiago — o Capitão Martim é religioso.
     *
     * Termina sem pergunta de propósito: convite a responder vira atendimento, e o gabinete não
     * tem braço para o volume que isso geraria. A mensagem entrega o afeto e fecha.
     */
    id: 'saudacao-fe',
    name: 'Saudação com mensagem de fé',
    text:
      '{{saudacao}}! Que Deus abençoe o seu dia e a sua família. 🙏\n\n' +
      'Que Nossa Senhora interceda por você e por quem você ama.',
    variantes: [
      '{{saudacao}}! Que Deus abençoe a sua vida e a sua família. 🙏\n\n' +
        'Que Nossa Senhora interceda sempre por você e pelos seus.',
      '{{saudacao}}! Que a bênção de Deus esteja com você e sua família. 🙏\n\n' +
        'Que Nossa Senhora ilumine o seu caminho e o de quem você ama.',
    ],
  },
  {
    /**
     * Ela pediu algo e não disse o quê. **Perguntar é a única resposta segura.**
     *
     * Print da Mari (31/08): *"Preciso da forca do senhor"*, e a caixa sugeria mandar o modelo da
     * campanha. Ele: *"provável pedido financeiro ou trabalho, vou perguntar em que posso ajudar?
     * para ter certeza"*.
     *
     * **O que este texto NÃO faz é o que importa:**
     *
     *  - não promete nada — nem ajuda, nem encaminhamento, nem "vou ver o que posso fazer";
     *  - não nega nada — a recusa (`pedido-ajuda`, `pedido-emprego`) só cabe depois de ela dizer
     *    o que quer, e negar antes disso ofende quem só queria apoio político;
     *  - não manda material de campanha, que é o que a rodada fazia.
     *
     * Promessa em ano eleitoral é o risco que a Lei 9.504/97 trata (art. 41-A, captação ilícita;
     * art. 73, §10, distribuição de bens). Uma pergunta não é promessa.
     *
     * Sem vocativo, como todo o resto (`vars.semVocativo`): o cadastro erra demais para ir num
     * texto que a pessoa lê — e neste, em que ela está pedindo ajuda, errar o nome é pior.
     */
    id: 'perguntar-como-ajudar',
    name: 'Perguntar em que pode ajudar (pedido sem detalhe)',
    text:
      '{{saudacao}}! Obrigado por escrever e por confiar na gente.\n\n' +
      'Para eu entender direito e te responder com sinceridade: em que você precisa de ajuda? ' +
      'Me conta com suas palavras o que está acontecendo.',
    variantes: [
      '{{saudacao}}! Obrigado pela mensagem e pela confiança.\n\n' +
        'Me explica um pouco melhor em que você precisa de ajuda? Assim eu consigo te responder ' +
        'com sinceridade sobre o que está no meu alcance.',
      '{{saudacao}}! Recebi sua mensagem, obrigado por procurar a gente.\n\n' +
        'Para eu te ajudar direito, me conta o que está acontecendo e em que você precisa de ajuda?',
    ],
  },
  {
    /**
     * Convite de evento, resposta NEGATIVA — e depois o pedido de dados.
     *
     * Texto dele, palavra por palavra (01/09). Anúncio novo: o convite pergunta se a pessoa vai,
     * e quem não pode merece consolo antes do formulário — mandar só "me passe nome e cidade" a
     * quem acabou de dizer que gostaria de ir e não tem condições lê como se ninguém tivesse lido.
     *
     * **É o `pedir-dados` com um prefixo**, e é por isso que não gastou tecla nova: a tecla 4
     * escolhe entre os três textos conforme `cortesia.confirmaPresenca`.
     *
     * O pedido no fim é IGUAL ao do `pedir-dados`, incluindo o exemplo: é dele que sai a precisão
     * do parser (`respostaAoPedido`), e mudar o formato aqui quebraria a leitura do nome e da
     * cidade sem avisar.
     */
    id: 'pedir-dados-evento-nao',
    name: 'Não vai ao evento + pedir dados',
    text:
      'Sem problema! O mais importante é saber que você está conosco e apoiando essa caminhada. ' +
      'Muito obrigado pelo carinho e pelo apoio!\n\n' +
      'Para eu poder salvar seu contato me passe seu:\n\n' +
      '*Nome / Cidade*\n\n' +
      '(exemplo: Maria Silva / Santo Ângelo)',
  },
  {
    /**
     * Convite de evento, resposta POSITIVA — e depois o pedido de dados.
     *
     * Texto dele, palavra por palavra (01/09). Mesma estrutura da irmã negativa: prefixo próprio,
     * pedido de dados idêntico ao do `pedir-dados` no fim.
     */
    id: 'pedir-dados-evento-sim',
    name: 'Vai ao evento + pedir dados',
    text:
      'Que bom! Será uma grande satisfação contar com você! 🇧🇷🙌 ' +
      'Sua presença é muito importante para nós.\n\n' +
      'Para eu poder salvar seu contato me passe seu:\n\n' +
      '*Nome / Cidade*\n\n' +
      '(exemplo: Maria Silva / Santo Ângelo)',
  },
  {
    /**
     * **Confirmou presença e NÃO falta dado nenhum: só agradece.**
     *
     * Diagnóstico dele (02/09/2026), depois de o mesmo contato receber o pedido de cadastro duas
     * vezes: *"provavelmente pode ser o problema do padrão de mensagem, ela já vem incluso pedindo
     * dados; se usar a mensagem rápida sempre irá pedir os dados"*.
     *
     * Estava certo, e é a raiz que faltava. As duas respostas de evento **fundem** duas coisas —
     * a confirmação e o pedido de `Nome / Cidade` — e não havia versão só com a primeira metade.
     * Então quem já tinha tudo no CRM recebia o formulário junto do "que bom", por qualquer
     * caminho: a rodada, ou ele clicando na resposta rápida.
     *
     * Este texto é a metade que faltava. É `pedir-dados-evento-sim` **sem o bloco do cadastro** —
     * a mesma voz, para a pessoa não perceber duas redações diferentes para a mesma situação.
     *
     * **Não pede nada e não promete nada.** Quem confirmou presença já fez a sua parte; o que resta
     * é reconhecer e encerrar.
     */
    id: 'presenca-confirmada',
    name: 'Confirmou presença (só agradecer)',
    text:
      'Que bom! Será uma grande satisfação contar com você! 🇧🇷🙌 ' +
      'Sua presença é muito importante para nós.\n\n' +
      'Já está tudo certo com o seu cadastro — é só chegar. Até lá! 🙏',
    variantes: [
      'Que alegria! Contar com você faz toda a diferença. 🇧🇷🙌\n\n' +
        'Seu cadastro já está com a gente, então não precisa fazer mais nada — nos vemos lá!',
    ],
  },
  {
    /**
     * A pessoa só expressou apoio, e já está classificada. Não há o que pedir nem o que mandar.
     *
     * Pedido dele (31/08), print do Ciro: *"esse é um caso comum até onde a pessoa só expressa o
     * apoio, ja tem as etiquetas, então é só uma questão de agradecer o apoio e carinho"*.
     *
     * Separado do `agradecer-info` de propósito: aquele agradece **informações** ("recebemos
     * tudo por aqui"), e usá-lo em quem escreveu *"sou Bolsonaro desde sempre"* responde outra
     * conversa. Aqui o que se reconhece é o apoio e a torcida, que é o que a pessoa ofereceu.
     *
     * **Não promete nada e não pede nada** — nem grupo, nem material, nem dados. Quem só quis
     * dizer que está com você não pediu tarefa; mandar uma vira cobrança em cima de um agrado.
     *
     * Sem `{{primeiro_nome}}` como todo o resto: o cadastro erra demais para ir num texto que a
     * pessoa lê (decisão dele, 10/08 — ver `vars.semVocativo`).
     */
    id: 'agradecer-apoio',
    name: 'Agradecer o apoio e encerrar',
    text:
      '{{saudacao}}! Muito obrigado pelo apoio e pelo carinho — palavra como a sua dá força ' +
      'para seguir.\n\n' +
      'Seguimos juntos nessa caminhada. Que Deus abençoe você e sua família! 🙏',
    variantes: [
      '{{saudacao}}! Obrigado de coração pelo apoio e pela confiança — é isso que sustenta o ' +
        'trabalho.\n\n' +
        'Estamos juntos. Que Deus abençoe você e os seus! 🙏',
      '{{saudacao}}! Que bom ler isso, obrigado pelo apoio e pelo carinho de sempre.\n\n' +
        'Seguimos lado a lado. Que Deus abençoe você e sua família! 🇧🇷',
    ],
  },
  {
    /**
     * Para quem mandou vídeo, link, "bom dia" — mensagem que merece resposta mas não abre
     * demanda. Agradece e fecha.
     *
     * Sem pergunta no fim, pela mesma razão da saudação de fé: convite a responder vira
     * atendimento, e o volume é do gabinete.
     */
    id: 'agradecer-info',
    name: 'Agradecer a mensagem e encerrar',
    text:
      '{{saudacao}}! Obrigado pela mensagem e pelas informações — ' +
      'recebemos tudo por aqui.\n\n' +
      'Seguimos juntos. Que Deus abençoe você e sua família! 🙏',
    variantes: [
      '{{saudacao}}! Obrigado pela mensagem — ' +
        'recebemos tudo certinho por aqui.\n\n' +
        'Seguimos juntos nessa caminhada. Que Deus abençoe você e os seus! 🙏',
      '{{saudacao}}! Agradeço a mensagem e as informações — ' +
        'chegou tudo por aqui.\n\n' +
        'Vamos seguindo juntos. Que Deus abençoe você e sua família! 🙏',
    ],
  },
  {
    /**
     * Para quem está em "Meus" sem nenhuma etiqueta de conteúdo: nunca disse o que quer receber,
     * então nenhuma regra casa e não há modelo a enviar. Esta pergunta transforma o silêncio em
     * um sim ou um não.
     *
     * **Pede nome e cidade na mesma mensagem** (decisão do Thiago, 10/08): quem responde "sim"
     * quase sempre é gente que ainda está sem nome e sem cidade no CRM, e uma segunda mensagem
     * para pedir os dados custa outro atendimento inteiro — mais um dia de espera, e mais uma
     * chance de a pessoa não responder.
     *
     * O formato pedido ("Sim / Nome / Cidade") não é enfeite: é dele que sai a precisão do
     * parser. Resposta estruturada é o que separa "está respondendo o formulário" de "está
     * conversando" — a mesma razão do `pedir-dados`.
     */
    id: 'interesse-conteudo',
    name: 'Perguntar interesse no conteúdo (e pedir os dados)',
    text: INTERESSE_CONTEUDO,
    variantes: [
      '{{saudacao}}! Aqui é da equipe do Capitão Martim e do Zucco. 🇧🇷\n\n' +
        'Posso te enviar por aqui os conteúdos e novidades deles?\n\n' +
        'Se sim, me responde numa única mensagem, nesta ordem:\n\n' +
        'Sim / Nome completo / Cidade\n\n' +
        '(exemplo: Sim / Maria Silva / Santo Ângelo)\n\n' +
        'Se preferir não receber, é só dizer não — eu respeito e não insisto.',
      '{{saudacao}}! Falo daqui da equipe do Capitão Martim e do Zucco. 🇧🇷\n\n' +
        'Posso mandar pra você os conteúdos e as novidades deles por aqui?\n\n' +
        'Se sim, me responde nesta ordem, numa mensagem só:\n\n' +
        'Sim / Nome completo / Cidade\n\n' +
        '(exemplo: Sim / Maria Silva / Santo Ângelo)\n\n' +
        'Se preferir não receber, só me avisar que não — eu respeito e não incomodo mais.',
    ],
  },
  {
    /**
     * Para quem parou de responder há dias — a fila dos concluídos "sem retorno".
     *
     * Texto livre, então **só chega dentro da janela de 24h**. Na fila dos sem retorno a maioria
     * está com a janela vencida e recebe o modelo aprovado; esta resposta é para os que ainda
     * dá, e para quando ele quiser perguntar à mão. A rodada escolhe entre as duas sozinha.
     *
     * Dá a saída de sair da lista de propósito: quem não tem interesse dizendo "não" custa
     * muito menos que quem bloqueia o número — e número bloqueado derruba a entrega de todo o
     * resto da campanha.
     */
    id: 'sem-retorno-interesse',
    name: 'Sem retorno: ainda tem interesse?',
    text:
      '{{saudacao}}! Faz um tempo que a gente se falou por aqui e você não retornou — ' +
      'sem problema nenhum, a vida corre. 🇧🇷\n\n' +
      'Só preciso saber de uma coisa, para não te incomodar à toa: você ainda quer receber ' +
      'os conteúdos do Capitão Martim e do Zucco?\n\n' +
      'Se sim, me responde nesta ordem, em uma única mensagem:\n\n' +
      'Sim / Nome completo / Cidade\n\n' +
      'Se não quiser, é só responder *não* — eu tiro você da lista e não te chamo mais. ' +
      'Fica tudo bem do mesmo jeito. 🙏',
    variantes: [
      '{{saudacao}}! Faz um tempinho que trocamos mensagem por aqui e você não voltou a responder — ' +
        'sem problema, a correria da vida é assim mesmo. 🇧🇷\n\n' +
        'Só preciso confirmar uma coisa, pra não te incomodar à toa: você ainda tem interesse em ' +
        'receber os conteúdos do Capitão Martim e do Zucco?\n\n' +
        'Se sim, me responde nesta ordem, numa única mensagem:\n\n' +
        'Sim / Nome completo / Cidade\n\n' +
        'Se não quiser mais, é só responder *não* — eu tiro você da lista e não chamo de novo. ' +
        'Fica tudo bem do mesmo jeito. 🙏',
      '{{saudacao}}! Já faz um tempo desde a nossa última conversa por aqui e você não retornou — ' +
        'tudo bem, a vida é corrida mesmo. 🇧🇷\n\n' +
        'Só para não te incomodar à toa, preciso confirmar uma coisa: você continua com interesse ' +
        'em receber os conteúdos do Capitão Martim e do Zucco?\n\n' +
        'Se sim, me responde nesta ordem, em uma mensagem só:\n\n' +
        'Sim / Nome completo / Cidade\n\n' +
        'Se preferir não continuar, é só responder *não* — eu retiro você da lista e não chamo ' +
        'mais. Fica tudo certo do mesmo jeito. 🙏',
    ],
  },
  {
    id: 'sem-interesse',
    name: 'Sem interesse / encerrar com respeito',
    text:
      'Sem problema! Agradeço o retorno e não vou mais te incomodar. ' +
      'Se mudar de ideia, é só mandar uma mensagem aqui. Um abraço!',
    variantes: [
      'Tudo bem! Agradeço a resposta e não vou mais incomodar. ' +
        'Se um dia mudar de ideia, é só me chamar por aqui. Um abraço!',
      'Sem problema nenhum! Obrigado pelo retorno, não vou mais te incomodar. ' +
        'Se mudar de ideia depois, é só mandar mensagem por aqui. Um abraço!',
    ],
  },
];

const DEFAULTS = {
  templates: DEFAULT_TEMPLATES,
  /**
   * Etiqueta de quem chegou por anúncio. Vazio = não etiqueta ninguém por essa via.
   *
   * A plataforma diz isso em dado estruturado, não em texto: a sessão traz `utm.source`
   * ("FACEBOOK"), `utm.campaign` e `utm.referralUrl` ("https://fb.me/…") — é o bloco
   * "ANÚNCIO | FACEBOOK" que aparece no topo da conversa. Casar por regra de texto funcionaria,
   * mas depende de ele escrever a regex certa; o campo é a fonte, e não custa nada ler.
   */
  etiquetaAnuncio: 'ADS',
  /**
   * Etiqueta de "o nome do cadastro não bate com o que a pessoa informou".
   *
   * Vazia = a extensão não marca ninguém. Precisa existir no CRM: a extensão não cria etiqueta
   * sozinha, porque erro de digitação aqui vira rótulo permanente na base.
   *
   * Serve para ELE corrigir depois, filtrando a fila por ela. **O nome nativo do contato nunca é
   * sobrescrito** — escolha dele em 31/08, entre trocar sozinho e separar.
   */
  etiquetaNomeDivergente: '',
  /** { "santo angelo": "https://chat.whatsapp.com/..." } — chave sempre normalizada. */
  cityLinks: {},
  /** Usado quando a cidade não tem grupo próprio. Vazio = bloqueia o envio. */
  defaultGroupLink: '',
  settings: {
    autoSend: false, // começa desligado de propósito: primeiro teste você faz no seu número
    throttleMs: 1500,
    antiDup: true,
    autoTags: true, // sugerir etiqueta de região e de conteúdo já marcadas
    /**
     * Grava sozinho, ao abrir o contato, só o que é determinístico (cidade exata do IBGE, o
     * COREDE dela, etiquetas de conteúdo). O resto continua esperando confirmação.
     */
    autoApply: true,
    panelOpen: true, // painel encaixado visível
    dockWidth: 380, // largura do painel encaixado, ajustável pelo puxador
    /**
     * Onde a caixa de pergunta da rodada foi largada, em pixels da janela. `null` = centro.
     * Fica aqui, e não em `auto`, porque é preferência de tela como a largura do painel — vale
     * para todas as rodadas, não para uma configuração de rodada.
     */
    perguntaPos: null,
    /** Posição da janelinha do contador. Própria, senão ela e a pergunta se empurram. */
    contadorPos: null,
  },

  /**
   * Aba Automatizado: a rodada de tentativa de contato com quem não respondeu.
   *
   * `templateId` é o modelo APROVADO (HSM) escolhido para a rodada — nunca uma resposta pronta:
   * quem está sem retorno há dias tem a janela de 24h vencida, e só modelo aprovado chega.
   * `limite` e `pausaSeg` existem para o envio não sair em rajada: número real, gente real.
   */
  auto: {
    templateId: '',
    templateName: '',
    limite: 20,
    pausaSeg: 8,
    /**
     * Rodada dos Novos: trecho que identifica o aceite do anúncio ("Olá! Eu aceito receber
     * conteúdos do Fulano e do Cap Martim"). Guardado sem o nome do candidato de propósito —
     * a campanha muda o anúncio e a frase vale para todos eles.
     */
    padraoNovos: 'aceito receber conte',
    /**
     * A mensagem da ocasião — Dia dos Pais, Natal, uma data da campanha. É a tecla 5 da
     * pergunta, e fica aqui em vez de virar resposta pronta porque muda toda semana: o valor é
     * editar no lugar onde a rodada começa, sem passar pela aba Config.
     *
     * Vazia = a tecla 5 não aparece.
     */
    mensagemMomento: '',
    /**
     * Reescritas alternativas de `mensagemMomento`, mesmo mecanismo de `templates.variantes`:
     * `sendTemplate` reveza entre o texto principal e estas a cada envio de verdade, para não
     * repetir a mesma frase mandada em massa. Editável no popup do cartão da mensagem do momento.
     */
    mensagemMomentoVariantes: [],
    /**
     * A partir de quantas horas de silêncio a rodada **pergunta** em vez de concluir sozinha,
     * quando a última mensagem da conversa é nossa.
     *
     * 12h é o que ele pediu: abaixo disso a conversa ainda está viva e perguntar seria teclar à
     * toa; acima, o contato nunca voltou e fechar em silêncio é perdê-lo. Quem decide o que
     * mandar continua sendo ele. Ver `hsm.decidirSemResposta`.
     */
    horasSemResposta: 12,
    /**
     * Etiquetas que dispensam o contato da rodada — a sugestão vira "pular".
     *
     * Pedido dele (31/08): *"etiqueta engajado, quando estiver no automatizado pode ser pulado"*.
     * Quem já está engajado não precisa de formulário nem de pergunta de interesse: o trabalho da
     * rodada é justamente transformar desconhecido em engajado.
     *
     * Casa por PEDAÇO do rótulo, sem acento e sem caixa: "engajado" pega "ENGAJADO/BIZA",
     * "Apoiador Muito engajado" e o que mais vier com essa palavra. Separe por vírgula para
     * acrescentar outras — é para ele mexer aqui sem precisar de mim.
     */
    etiquetasQuePulam: 'engajado',
    /**
     * Pular esses contatos SOZINHO, sem perguntar.
     *
     * Nasce desligado de propósito. Com ele ligado a rodada deixa de perguntar em alguém — e a
     * regra deste projeto é que nada sai da fila sem decisão humana. A exceção é aceitável aqui
     * porque **é ele quem marca a caixa**, o critério é uma etiqueta que ele mesmo escolheu, e o
     * pulo aparece no log da rodada com o nome da etiqueta que causou.
     *
     * Pular não envia nada e não conclui: o atendimento fica aberto, exatamente onde estava.
     */
    pularEtiquetasSozinho: false,
    /**
     * A rodada EXECUTA a escolha da IA em vez de perguntar.
     *
     * Pedido dele (01/09): *"no automatizado deve ter um box para marcar escrito automatiza com
     * IA, agora está iniciando normalmente e IA não assume"*. Sem isto a IA opinava e a caixa
     * abria do mesmo jeito — a tecla 0 aparecia em destaque e ele apertava. Com a caixa marcada,
     * a tecla 0 é apertada sozinha.
     *
     * **A fronteira do branch continua onde estava:** o que sai é uma resposta pronta que ele
     * escreveu, escolhida pela IA. Isto automatiza o CLIQUE, não o texto. Rascunho gerado pela
     * IA segue fora daqui — quem o libera é `iaEnviarRascunhoAuto`, que é outra caixa.
     *
     * Nasce desligado, como `pularEtiquetasSozinho`, e pelo mesmo motivo: nada sai da fila sem
     * decisão dele, e a marca na caixa é essa decisão. Cada envio automático vai para o log da
     * rodada com o motivo e a confiança da IA.
     */
    automatizarComIA: false,
    /**
     * Janela em que a rodada NÃO manda de novo para quem já recebeu mensagem nossa.
     *
     * Quem acabou de ser concluído volta para o TOPO da lista de concluídos, então a rodada
     * seguinte começaria justo por ele — e foi assim que um contato recebeu duas mensagens em
     * 32 minutos. 48h porque esta fila é de quem não responde: a última mensagem ser nossa é a
     * regra, e bloquear para sempre esvaziaria a rodada. Ver `hsm.decidirReenvio`.
     */
    horasSemRepetir: 48,
    /**
     * A etiqueta de fluxo que marca a fila dos sem retorno.
     *
     * Ela sai do contato quando o atendimento é concluído pelo painel — senão, concluído de
     * novo, ele reaparece no TOPO da lista filtrada por ela e volta a ser trabalho amanhã. É a
     * única etiqueta que a extensão tira sem ser COREDE, e por isso o nome fica aqui, editável:
     * chutar nome de etiqueta é jeito conhecido de tirar a errada.
     *
     * Vazio = não tira nada.
     */
    etiquetaSemRetorno: '1 SEM RETORNO',

    /**
     * Etiqueta de quem recusou ou veio hostilizar. **Vazia = a rodada não marca ninguém.**
     *
     * Pedido dele (01/09/2026): *"falando mal do bolsonaro e martim é aliado do bolsonaro, esse
     * tipo nós botamos etiqueta sem interesse e concluímos sem responder"*, depois de a rodada
     * pedir dados a dois contatos sem interesse.
     *
     * Nasce **vazia** e o nome tem que ser digitado igual ao do CRM, pela mesma razão das outras:
     * a extensão não cria etiqueta sozinha, e erro de digitação aqui vira rótulo permanente na
     * base. Sem ela a regra continua valendo — só conclui sem marcar, e diz isso no log.
     *
     * Fica DENTRO de `auto` de propósito: é a chave que o `get` mescla com o default, então quem
     * já usa a extensão recebe o campo em vez de `undefined`.
     */
    etiquetaSemInteresse: '',
  },


  /**
   * Regras de etiqueta por conteúdo: padrão (regex, sem diferenciar maiúscula) casado contra
   * as mensagens do contato e a campanha do anúncio. Editável na aba Config.
   */
  /**
   * Como reconhecer que a mensagem foi **gerada pelo anúncio**, e não escrita pela pessoa.
   *
   * O Instagram e o Facebook mandam um texto pronto quando alguém clica no botão do anúncio:
   * *"Olá! Eu apoio as Escolas Cívico-Militares"*, *"Olá! Eu apoio o Flávio, Zucco e Capitão
   * Martim"*. **Ela não escolheu essas palavras — clicou num botão.**
   *
   * Pedido dele (01/09): *"preciso que identifique o modelo pelo texto (Olá! Eu apoio as Escolas
   * Cívico-Militares)"*. A primeira versão presumia que a mensagem do anúncio era a PRIMEIRA da
   * conversa, e a print da Erenita derrubou isso: ela mandou uma figura antes, o texto do anúncio
   * virou a segunda, e a regra passou a tratar o texto do anúncio como apoio escrito por ela.
   *
   * **Posição não serve; texto serve.** Configurável porque o texto do anúncio muda quando a
   * campanha muda, e isso não deveria exigir um commit. Uma expressão por linha, sem barras.
   */
  /**
   * TEXTO da mensagem → nome do MODELO aprovado. `{ "trecho": "Modelo" }`.
   *
   * Pedido dele (01/09): *"não será feito etiqueta a etiqueta para os anúncios, agora é só ads;
   * o padrão para casar o modelo deve ser o texto (Olá! Eu apoio as Escolas Cívico-Militares =
   * modelo)"*.
   *
   * A etiqueta ADS diz que veio de anúncio, não de QUAL anúncio — e criar uma etiqueta por
   * anúncio seria pôr rótulo permanente na base de eleitores para transportar o que já está
   * escrito na mensagem.
   *
   * **Vence a tabela por etiqueta** (`contentTemplates`) quando casa: é a informação mais
   * específica que existe sobre o que a pessoa quer. Nada casando, o caminho antigo segue igual.
   *
   * Nasce VAZIA de propósito: o nome do modelo tem de ser o exato da plataforma, e chutar aqui
   * manda o modelo errado para eleitor real. Editável na aba Config.
   */
  modeloPorTexto: {},

  /**
   * **OS ANÚNCIOS DO MOMENTO — o texto que reconhece e o que fazer com ele.**
   *
   * Pedido dele (02/09/2026): *"falta reconhecer o anúncio, nas configurações bote os anúncios do
   * momento onde botarei o texto para ser reconhecido e o que fazer quando for determinado texto do
   * anúncio"*.
   *
   * `modeloPorTexto` (acima) já reconhecia o anúncio pelo texto e só sabia responder **uma** coisa:
   * qual modelo mandar. Anúncio sem modelo — convite de evento, pesquisa, anúncio que só traz gente
   * nova — era reconhecido e morria ali. Aqui cada anúncio tem as duas metades: os `trechos` que o
   * reconhecem e a `acao` do que fazer.
   *
   * Formato de cada item (peneirado por `anuncios.normalizar`, que é quem manda):
   * `{ id, nome, trechos: [], acao: 'modelo'|'resposta'|'dados'|'fluxo', valor, etiquetas: [], ligado }`
   *
   * **Nasce vazia, e é semeada de `modeloPorTexto` na primeira abertura** (migração
   * `anunciosDoModeloPorTexto`): estrear a tela sem isso apagaria em silêncio o reconhecimento que
   * já funcionava, e ele descobriria pelo modelo que parou de sair.
   *
   * As AÇÕES são lista de permissão em `anuncios.ACOES`, e **não existe** ação de escrever a
   * mensagem aqui: o texto que sai é, byte a byte, um que ele escreveu na aba Respostas ou aprovou
   * na plataforma. Campo de texto livre nesta tela viraria redator de mensagem sem revisão.
   */
  anuncios: [],

  /**
   * **O modelo aprovado que sai para quem chega por anúncio que NÃO foi reconhecido.**
   *
   * Pedido dele (02/09/2026): *"caso o texto do anúncio não seja reconhecido será mandado o modelo
   * padrão"*. A plataforma informa a origem (`utm.source`) mesmo quando o texto não casa com nada
   * da lista — anúncio novo que ele ainda não cadastrou, texto que mudou, mensagem cortada. Antes
   * essa pessoa caía no caminho da etiqueta de conteúdo, que para quem só mandou o texto do anúncio
   * dava ADS e mais nada.
   *
   * Guarda o NOME do modelo, como o `valor` de cada anúncio — a plataforma reordena e recria ids, e
   * o nome é o que ele lê na tela. Vazio = sem padrão, e aí o não-reconhecido segue como antes.
   */
  modeloPadraoAnuncio: '',

  /**
   * **Os modelos padrão do anúncio, que se revezam.**
   *
   * Pedido dele (02/09/2026): *"o modelo padrão deve variar entre 3 modelos já que chega bastante
   * gente por eles"*. Mesmo motivo das variações das respostas prontas: quando muita gente chega
   * pela mesma porta, todo mundo receber a mesma frase é o que faz a mensagem parecer robô.
   *
   * Lista de NOMES de modelos aprovados, na ordem do rodízio. `modeloPadraoIndex` aponta o
   * PRÓXIMO a usar, e só anda depois de a mensagem sair de verdade.
   *
   * `modeloPadraoAnuncio` (acima, singular) é a versão anterior e vira o primeiro item desta lista
   * na primeira leitura — quem já tinha um escolhido não perde.
   */
  modelosPadraoAnuncio: [],

  /** Ponteiro do rodízio: o índice do PRÓXIMO modelo padrão a usar. Anda só depois do envio. */
  modeloPadraoIndex: 0,

  padroesDeAnuncio: ['^ol[áa]!?\\s+eu\\s+apoio'],

  tagRules: [
    { padrao: 'zucco', etiqueta: 'Conteúdo Zucco' },
    { padrao: 'fl[áa]vio', etiqueta: 'Conteúdo Flávio' },
  ],

  /**
   * Etiqueta de conteúdo → nome do MODELO DE MENSAGEM aprovado que atende aquele pedido.
   * Chave normalizada (ver `hsm.achatar`: minúsculo, espaço colapsado, acento mantido). É o que
   * fecha o atendimento: o contato pediu conteúdo do Zucco, a etiqueta "Conteúdo Zucco" casou, e
   * daqui sai qual modelo enviar. Editável na aba Config ("Modelo por conteúdo").
   *
   * Valor de campanha do Thiago, gravado aqui de propósito (pedido dele, 15/08): sem isto, toda
   * extensão carregada do zero (ou depois de "Restaurar padrão") volta com o mapa vazio e a
   * tecla 1 não aparece até ele digitar de novo — o que aconteceria de novo a cada vez que uma
   * pasta nova da extensão fosse carregada no Chrome. Só vale para quem NUNCA gravou nada: quem
   * já tem `contentTemplates` no storage (a maioria, hoje) não é tocado — este objeto não entra
   * na lista de merge de default do `get()`, e a leitura ignora o default assim que existe valor
   * salvo.
   */
  contentTemplates: {
    'conteúdo zucco': 'Zucco, Capitão',
    'conteúdo flávio': 'Flávio2',
  },

  /**
   * Qual conteúdo vence quando a mensagem casa com mais de uma regra.
   *
   * Empate é comum porque as regras também são casadas contra a campanha do anúncio: anúncio
   * que cita dois nomes faz o contato casar com os dois sem ter pedido nada. As etiquetas
   * continuam sendo aplicadas todas — isto decide só qual modelo enviar.
   */
  conteudoPreferido: 'Conteúdo Flávio',

  /**
   * Etiquetas aplicadas quando o contato responde SIM à pergunta de interesse no conteúdo
   * (resposta "interesse-conteudo", tecla 7 da rodada).
   *
   * Vazio de propósito: o rótulo tem que ser o nome exato da etiqueta no CRM, e chutar aqui
   * grava etiqueta errada em eleitor real. Enquanto estiver vazio, a rodada envia a pergunta
   * normalmente e diz na tela que o "sim" não vai virar etiqueta até isto ser preenchido.
   */
  etiquetasInteresse: [],

  /**
   * Municípios que o casamento de cidade ignora.
   *
   * "Capitão" é município do RS e é a patente do candidato: toda mensagem de aceite do anúncio
   * ("aceito receber conteúdos do Capitão Martim") casava com a cidade, com confiança exata —
   * que é a que grava sozinha. A expressão "Capitão Martim" já é apagada antes de casar; esta
   * lista é a segunda trava, para "Capitão" solto no meio de uma frase também não virar cidade.
   */
  cidadesIgnoradas: ['Capitão'],

  /**
   * Apelidos: nome do COREDE (ou qualquer rótulo) → nome exato da etiqueta no CRM. Só é
   * preciso quando o nome não casa nem ignorando acento e pontuação. O painel grava aqui
   * sozinho quando você escolhe a etiqueta à mão.
   */
  tagAliases: {
    'paranhana encosta da serra': 'Vale do Paranhana',
  },
  /** Contrato de escrita aprendido pelo gravador (Fase 0). Null = ainda não aprendido. */
  writeContract: null,

  /**
   * A chave da API da Anthropic. **Fica só aqui e só é lida pelo service worker.**
   *
   * Nunca vai para o painel: o painel roda dentro da aba do mobiliza, e o `page-hook.js` está no
   * mesmo contexto JS do Angular deles — o que está na página, a plataforma lê. Por isso a
   * chamada sai do `background.js`, que lê esta chave e devolve só a decisão.
   *
   * Fora do `exportJson` pelo mesmo motivo que o `sentLog`: backup é arquivo que circula.
   */
  iaChave: '',
  /**
   * A avaliação por IA. Desligada por padrão — ligar é decisão dele, e custa dinheiro por
   * contato avaliado.
   */
  ia: {
    ligada: false,
    modelo: 'claude-haiku-4-5',
    /**
     * Instruções extras dele, somadas ao prompt de sistema.
     *
     * Existe porque a campanha muda mais rápido que o código: "esta semana quem falar em agenda
     * de Caxias é para mim" não deveria exigir um commit.
     */
    /**
     * Quem é quem: o mandato, a chapa, os números, as pautas. Vai NO PROMPT, cacheado.
     *
     * Pedido dele (01/09): *"a extensão deve ter salva informações dos candidatos relacionados ao
     * gabinete do capitão martim e sua chapa para a ia não pesquisar toda vez"*.
     *
     * **A IA não pesquisa nada, e é bom que não pesquise.** Sem isto ela decide sobre nomes que
     * não conhece: um contato escreve "vou votar no Marcel para senador" e ela não tem como saber
     * se isso é aliado, adversário ou outro cargo. Aqui a informação é dele — não é a IA
     * lembrando, é o gabinete contando.
     *
     * Fica no prompt de SISTEMA, que é a parte cacheada: entra uma vez e custa 10% do preço nas
     * chamadas seguintes. Encher isto de detalhe é barato; deixar vazio é que custa, em decisão
     * errada.
     *
     * **Nasce vazio de propósito.** Número de urna, cargo e nome de aliado são dados que, errados,
     * saem numa escolha que chega a eleitor real. Quem preenche é ele.
     */
    gabinete: '',
    /**
     * O dossiê de `src/data/gabinete.md` entra no prompt?
     *
     * **Nasce false, e não é zelo decorativo.** O arquivo foi montado a partir de pesquisa na
     * internet, e número de urna errado manda eleitor votar em outra pessoa. Ele pediu para revisar
     * antes (*"vou revisar para não mandar algo errado pra ia da extensão"*), então o mecanismo fica
     * pronto e desligado. A textarea acima continua valendo desligada — o que ELE escreveu já foi
     * revisado por definição.
     */
    dossieAtivo: false,
    regras: '',
    /**
     * O rascunho escrito pela IA pode ser ENVIADO sem ele ler antes.
     *
     * **Nasce desligado, e a decisão de ligar é dele** (20/08/2026, ciente do risco). É o único
     * caminho do projeto em que texto gerado por IA chega a um eleitor sem revisão humana — e
     * mensagem de WhatsApp não volta.
     *
     * Ligar isto **não** basta para uma frase sair sozinha: `ia.podeEnviarSozinho` ainda exige
     * zero avisos da revisão (marcador, promessa, bem/benefício — Lei 9.504/97), a própria IA não
     * ter pedido revisão, e confiança acima de `CONFIANCA_RASCUNHO_AUTO`. Este campo é a primeira
     * de quatro travas, não a única.
     */
    enviarRascunhoAuto: false,
    /**
     * Teto de gasto da API, em DÓLARES por mês. `0` desliga o teto.
     *
     * **A assinatura Claude Pro/Max não cobre a API** — são faturas separadas, e cada chamada
     * daqui é despesa nova em cima do plano. Por isso o padrão nasce COM limite: teto que se
     * descobre pela fatura não é teto. US$ 20 é ponto de partida, não recomendação — a conta
     * real depende do volume dele, e a aba Config mostra quanto já foi.
     *
     * Quem obriga é o `background.js`, não o painel: caminho novo no painel não pode furar a
     * trava por esquecimento (mesma razão de a chave da API morar lá).
     */
    tetoUsd: 20,
    /** Gasto do mês corrente: `{ mes, usd, chamadas, tokens }`. Zera sozinho na virada. */
    gasto: { mes: '', usd: 0, chamadas: 0, tokens: 0 },
  },
  /** { "<contactId>|<templateId>": timestamp } para o aviso de duplicata. */
  sentLog: {},
  /**
   * Ponteiro de rotação por resposta: { "<templateId>": índice da PRÓXIMA variante a usar }.
   * Só avança em envio de verdade (`templates.avancarVariante`) — preview não mexe aqui.
   */
  varianteIndex: {},
  /**
   * Cidades que você recusou no popup, por contato:
   * `{ "<contactId>": { cidades: ["quarai"], at: <timestamp> } }` (nomes normalizados).
   *
   * Precisa sobreviver ao fechar/reabrir o contato, senão a pergunta volta toda vez que ele
   * abre — foi o relato *"estou botando sem cidade e pede novamente"*. Guardar por CIDADE (e não
   * um "não perguntar mais" por contato) é o que atende a outra metade do pedido: mensagem nova
   * com uma cidade **diferente** volta a perguntar; a mesma cidade recusada, nunca mais.
   */
  cidadeRecusada: {},
  /**
   * Migrações já aplicadas, uma vez cada. Sem isto, uma migração que mexe em texto editável
   * desfaria a sua edição toda vez que o painel subisse.
   */
  migracoes: {},
  /**
   * O FLUXO: a ordem das regras, as teclas e as desligadas — editado na aba Automatizado.
   *
   * Pedido dele (01/09/2026): *"vamos montar uma janela (…) que será o fluxo de atendimento, lá
   * será editado todo o fluxo que a extensão seguira"*. Nasceu de dois erros do mesmo dia que não
   * eram de lógica e sim de ORDEM: `ja-respondemos-antes` acima de `conteudo-pedido`, e a regra de
   * sem interesse no topo engolindo a confirmação de presença. Ordem ele resolve arrastando; me
   * chamar para isso era o gargalo.
   *
   * **Vazio = a ordem do código.** A janela nascer em branco não muda comportamento nenhum, e
   * `sugestao.ordenar` trata id novo do código inserindo-o na posição do código — não no fim.
   *
   * As CONDIÇÕES continuam no código de propósito: elas decidem o que sai para eleitor, e uma
   * expressão mal montada aqui viraria mensagem errada. Aqui só se mexe em prioridade, tecla e
   * ligar/desligar — o pior caso é um destaque no lugar errado.
   */
  fluxo: {
    /** ids na ordem que ele quer. Vazio = ordem do código. */
    ordem: [],
    /** ids que ele desligou. Regra desligada nunca vence — as de baixo passam a ser olhadas. */
    desligadas: [],
    /** id → tecla, quando ele quer outra que não a do código. */
    teclas: {},
    /** id → quantas vezes venceu. Mostra qual regra decide a fila de verdade. */
    vitorias: {},
    /**
     * O QUADRO: a árvore de ramos, com posição. `null` até ele abrir a janela do fluxo.
     *
     * Enquanto for `null`, a rodada usa a tabela de regras como sempre usou. Ao abrir a janela ela
     * é semeada com a tabela achatada, e há teste exigindo que as duas decidam igual — ligar não
     * muda nada. Ver `lib/arvore.js`.
     */
    arvore: null,
  },
  /**
   * Os quadros que ele salvou com nome — as versões dele, não um histórico automático.
   *
   * O quadro de trabalho grava sozinho a cada edição (é `fluxo.arvore`); isto aqui é outra coisa:
   * poder guardar "o fluxo da semana do evento", mexer à vontade e voltar. Sem isto, experimentar
   * custa desfazer tudo à mão.
   */
  fluxosSalvos: [],
  /**
   * Os estados anteriores do quadro do fluxo, para o botão Desfazer.
   *
   * Chave própria, e não dentro de `fluxo`: é histórico de tela, some quando ele quiser, e não
   * deve engordar o objeto que a janela lê e grava a cada mexida. Fora do `exportJson` pelo
   * mesmo motivo — ninguém quer o histórico de outra pessoa junto da configuração.
   */
  fluxoHistorico: [],
  /** Cache da lista de municípios do RS (IBGE). */
  municipios: null,
  /**
   * Dicionário do parser, editável.
   *
   * **Só sobrou `partido`, e ele não preenche campo nenhum.** O campo "Partido" saiu em
   * 01/09/2026 junto com "Função" e "Tema de Interesse"; esta lista continua porque tem uma
   * segunda função, que é a única agora: `extract.limparSiglas` a usa para tirar a sigla de dentro
   * do NOME ("Jeane do PL" → "Jeane"). Apagá-la faria o nome do contato ser gravado com a sigla
   * colada — por isso ela ficou, e por isso a aba Config a chama de "siglas removidas do nome".
   *
   * `temaByNumber` e `dicts.funcao` saíram junto: sem campo para gravar, o mapa numérico da
   * pergunta de tema e a lista de cargos não tinham mais consumidor.
   */
  dicts: {
    partido: ['PL', 'PP', 'MDB', 'PSDB', 'PT', 'PDT', 'PSD', 'REPUBLICANOS', 'NOVO', 'PODE', 'UNIÃO', 'PRD', 'PSB', 'PCdoB', 'PV', 'PSOL', 'AVANTE', 'SOLIDARIEDADE', 'CIDADANIA', 'AGIR', 'MOBILIZA', 'DC', 'PRTB'],
  },
};

/**
 * Recarregar a extensão deixa as abas abertas com o content script órfão: qualquer
 * chrome.storage joga "Extension context invalidated" e o painel passa a falhar em silêncio
 * (caixas vazias, ações que não acontecem). Isso já custou diagnóstico errado — então o erro
 * vira uma frase que diz o que fazer.
 */
export const PRECISA_F5 =
  'A extensão foi recarregada e esta aba ficou para trás. Dê F5 na aba do mobiliza para o painel voltar a funcionar.';

function traduzErro(err) {
  if (/context invalidated/i.test(err?.message || '')) return new Error(PRECISA_F5);
  return err;
}

export async function get(key) {
  let stored;
  try {
    stored = await chrome.storage.local.get(key);
  } catch (err) {
    throw traduzErro(err);
  }
  if (stored[key] === undefined) return structuredClone(DEFAULTS[key]);
  // Mescla para que chaves novas de versões futuras não fiquem faltando em quem já salvou.
  // `ia` está na lista porque o teto de gasto entrou depois: sem a mescla, quem já tinha a IA
  // configurada leria `tetoUsd: undefined` e ficaria SEM teto — um limite que nasce desligado
  // justamente em quem mais usa.
  if (
    key === 'settings' ||
    key === 'dicts' ||
    key === 'fluxo' ||
    key === 'tagAliases' ||
    key === 'auto' ||
    key === 'ia'
  ) {
    return { ...structuredClone(DEFAULTS[key]), ...stored[key] };
  }
  return stored[key];
}

export async function set(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (err) {
    throw traduzErro(err);
  }
}

export async function getAll() {
  const keys = Object.keys(DEFAULTS);
  const out = {};
  for (const k of keys) out[k] = await get(k);
  return out;
}

/**
 * Quantos contatos guardam recusa de cidade antes de o registro começar a esquecer os antigos.
 *
 * A base é de milhares de contatos e isto vive no `chrome.storage.local`, que não é infinito.
 * Esquecer o mais antigo custa uma pergunta repetida daqui a meses; não esquecer nada custa a
 * gravação inteira estourar um dia, no meio de uma rodada.
 */
export const MAX_CONTATOS_RECUSA = 2000;

/** As cidades (normalizadas) que você recusou para este contato. */
export async function cidadesRecusadas(contactId) {
  if (!contactId) return [];
  const mapa = await get('cidadeRecusada');
  return mapa[contactId]?.cidades || [];
}

/**
 * Guarda que você recusou esta cidade para este contato. Idempotente.
 *
 * Poda pelo mais antigo (`at`) quando passa de `MAX_CONTATOS_RECUSA` — e o `at` é renovado a cada
 * recusa, então contato ativo não é esquecido por ser velho, e sim por estar parado.
 */
export async function lembrarCidadeRecusada(contactId, cidadeNormalizada) {
  if (!contactId || !cidadeNormalizada) return;
  const mapa = { ...(await get('cidadeRecusada')) };
  const atual = mapa[contactId]?.cidades || [];
  const cidades = atual.includes(cidadeNormalizada) ? atual : [...atual, cidadeNormalizada];
  mapa[contactId] = { cidades, at: Date.now() };

  const ids = Object.keys(mapa);
  if (ids.length > MAX_CONTATOS_RECUSA) {
    ids
      .sort((a, b) => (mapa[a].at || 0) - (mapa[b].at || 0))
      .slice(0, ids.length - MAX_CONTATOS_RECUSA)
      .forEach((id) => delete mapa[id]);
  }
  await set('cidadeRecusada', mapa);
}

/** Export/import para você não perder os templates ao trocar de máquina. */
export async function exportJson() {
  const data = await getAll();
  delete data.municipios; // cache, se refaz sozinho
  delete data.sentLog;
  delete data.varianteIndex; // ponteiro de rotação, não é configuração
  delete data.cidadeRecusada; // referência a contato real, e é memória de trabalho
  delete data.iaChave; // credencial: backup é arquivo que circula
  return JSON.stringify(data, null, 2);
}

export async function importJson(text) {
  const data = JSON.parse(text);
  /**
   * O que o backup restaura.
   *
   * `modeloPorTexto` e `padroesDeAnuncio` entraram em 01/09 junto com as próprias funções: são
   * tabelas que ele preenche à mão, e ficar fora daqui significaria perdê-las na restauração —
   * um trabalho que só se descobre perdido quando o modelo errado sai para um eleitor.
   *
   * `conteudoPreferido` estava faltando desde antes, pelo mesmo motivo e com o mesmo efeito.
   */
  const allowed = [
    'templates', 'cityLinks', 'defaultGroupLink', 'settings', 'writeContract', 'dicts',
    'tagRules', 'tagAliases', 'contentTemplates', 'auto', 'fluxo',
    'modeloPorTexto', 'padroesDeAnuncio', 'conteudoPreferido', 'anuncios',
    'modeloPadraoAnuncio', 'modelosPadraoAnuncio',
  ];
  for (const key of allowed) {
    if (data[key] !== undefined) await set(key, data[key]);
  }
}
