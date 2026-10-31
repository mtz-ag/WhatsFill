/**
 * A corrente política encaminhada e o "estamos atentos" repetido (31/10/2026).
 *
 * Print de 31/10/2026: a pessoa mandou o textão que circula nos grupos ("*3ª FASE* ... *Em
 * andamento*", "E você, vai ajudar a *Organização Criminosa*...") e o rascunho saiu "Agradeço as
 * informações. Estamos atentos e acompanhando o assunto." + o formulário de Nome e Cidade. Ele:
 * "fica mandando essa mesma mensagem".
 *
 * O caminho medido: texto >= 400 caracteres -> `ultima-pede-resposta-pessoal` (tecla 6) -> IA ->
 * a linha DENÚNCIA do bloco do contato DITA o agradecimento (`trouxeDenuncia` casa "criminosa" +
 * "partido") -> o piso do painel cola `Nome , Cidade`. E a linha lê a conversa inteira, então a
 * cada corrente nova ela manda agradecer de novo.
 *
 * Rode: node tests/corrente.test.mjs
 */
import { readFileSync } from 'node:fs';
import { check, grupo, fim, lib } from './_harness.mjs';

const cortesia = await lib('cortesia.js');
const sugestao = await lib('sugestao.js');
const ia = await lib('ia.js');

const raiz = new URL('../', import.meta.url);
const ler = (p) => readFileSync(new URL(p, raiz), 'utf8');

const CORRENTE = [
  '*1ª FASE*', 'Aparelhamento do STF e das instituições - *Concluído*', '',
  '*3ª FASE*', 'Desmoralizar e desacreditar as polícias Militar, Civil e Federal - *Em andamento*', '',
  'Criação de um Exército Nacional para atender as vontades do governo -  *Em andamento*', '',
  'Criação de uma *Exército Civil Paralelo* com caráter revolucionário -  *Em andamento*', '',
  'Perseguição e diminuição de igrejas cristãs-  *Em andamento*', '',
  'Criação de Centros de Militância -  *Em andamento*', '',
  'Criação de um "firewall" para regular e controlar a internet -  *Em andamento*', '',
  'Criação de cotas alimentares para as famílias -  *Em andamento*', '',
  'Criação de Moeda Digital  -  *Em andamento*', '',
  'E você, vai ajudar a *Organização Criminosa do Partido dos Trabalhadores que Nunca Trabalharam* a concretizar todos os desejos e vontades no nosso país?',
].join('\n');

const DESABAFO =
  'Boa tarde, Capitão. Sou de Canoas e queria contar o que está acontecendo no meu bairro. Faz três ' +
  'meses que a rua está cheia de buracos, a água da chuva entra nas casas e a prefeitura não aparece. ' +
  'Minha mãe tem 82 anos e não consegue mais sair de casa porque a cadeira de rodas não passa. Eu já ' +
  'liguei várias vezes, abri protocolo, e ninguém resolve. Eu votei no senhor porque acredito que pode ' +
  'ajudar a gente a ser ouvido. O que eu posso fazer? Obrigada pela atenção de sempre.';

const at = (h) => new Date(`2026-10-31T${h}:00-03:00`).toISOString();
const NOSSA = 'Boa tarde.\n\nAgradeço as informações. Estamos atentos e acompanhando o assunto.\n\n' + ia.PEDIDO_DE_DADOS_NO_RASCUNHO;

grupo('o caminho de antes, medido: a corrente vai para a IA e a linha DENUNCIA dita o agradecimento');
{
  const entrantes = [{ texto: CORRENTE, tipo: 'TEXT', at: at('14:10') }];
  const regra = sugestao.sugerirAcao({ pedeRespostaPessoal: cortesia.conversaPedeRespostaPessoal(entrantes, null, []) });
  check(regra?.id === 'ultima-pede-resposta-pessoal' && regra.tecla === '6', `texto longo -> tecla 6 (${regra?.id})`);
  check(!!cortesia.trouxeDenuncia(CORRENTE), 'trouxeDenuncia casa ("criminosa" + "partido")');
  const bloco = ia.montarContatoRascunho({ mensagens: [{ de: 'contato', texto: CORRENTE }] });
  check(/DENÚNCIA OU ACUSAÇÃO POLÍTICA — NÃO ENTRE NO MÉRITO/.test(bloco), 'na primeira vez, a linha de sempre (agradecer uma vez)');
  check(/Agradeça as informações em UMA frase/.test(bloco.replace(/\s+/g, ' ')), 'que manda agradecer');
}

grupo('pareceCorrente: a forma da corrente, e o desabafo longo fica de fora');
{
  check(!!cortesia.pareceCorrente(CORRENTE), 'a corrente da print e corrente');
  check(!cortesia.pareceCorrente(DESABAFO), 'desabafo longo escrito para nos NAO e corrente');
  check(!cortesia.pareceCorrente(DESABAFO + ' Compartilhe com quem puder.'), 'uma marca so (o chamado) nao basta');
  check(!cortesia.pareceCorrente('*URGENTE* *REPASSEM* *JA*'), 'curto nao e corrente, mesmo com negrito e chamado');
  check(!cortesia.pareceCorrente(''), 'vazio nao quebra');
  const semNegrito = CORRENTE.replace(/\*/g, '');
  check(!!cortesia.pareceCorrente(semNegrito), 'sem negrito ainda e corrente (lista + "E voce, vai")');
}

grupo('denunciaOuCorrente: so o que ela escreveu desde a nossa ultima');
{
  const ent = [{ texto: CORRENTE, tipo: 'TEXT', at: at('14:10') }];
  check(!!cortesia.denunciaOuCorrente(ent, null), 'sem resposta nossa: acende');
  check(!cortesia.denunciaOuCorrente(ent, at('14:20')), 'ja respondida: apaga');
  check(!!cortesia.denunciaOuCorrente([{ texto: 'o governo do pt é uma organização criminosa', at: at('15:00') }], null),
    'denuncia curta tambem acende');
  check(!cortesia.denunciaOuCorrente([{ texto: DESABAFO, at: at('15:00') }], null), 'desabafo pessoal nao acende');
  check(!cortesia.denunciaOuCorrente([{ texto: 'roubaram minha moto ontem, o que eu faço?', at: at('15:00') }], null),
    'crime contra ela nao e denuncia (regra 11)');
}

grupo('o formulario nao fecha o agradecimento da denuncia nem a corrente');
{
  check(sugestao.rascunhoSemCadastro({ denunciaOuCorrente: { motivo: 'x' } }), 'denuncia/corrente: sem Nome , Cidade no rascunho');
  check(sugestao.rascunhoSemCadastro({ pedeAjudaFinanceira: true }), 'as negativas continuam (casoDeNegativa)');
  check(!sugestao.rascunhoSemCadastro({}), 'sem sinal, o rascunho continua podendo pedir o cadastro');
  check(!sugestao.casoDeNegativa({ denunciaOuCorrente: { motivo: 'x' } }), 'casoDeNegativa nao mudou de sentido');
  const p = ler('src/panel/panel.js');
  check(/!sugestaoLib\.pedirDadosNaoCabe\(state\.sinais\) &&\s+\/\/[^\n]*\n\s+!sugestaoLib\.rascunhoSemCadastro\(state\.sinais\);/.test(p),
    'o painel usa rascunhoSemCadastro no piso do formulario');
  check(/denunciaOuCorrente: denunciaOuCorrente\(state\.entrantes, state\.nossaUltimaAt\),/.test(p), 'e o sinal entra nos sinais do contato');
}

grupo('jaAgradecemosADenuncia: o agradecimento so conta DEPOIS da denuncia');
{
  const conversa = [
    { de: 'contato', texto: CORRENTE },
    { de: 'nos', texto: NOSSA },
    { de: 'contato', texto: 'é isso mesmo que está acontecendo' },
  ];
  check(ia.jaAgradecemosADenuncia(conversa), 'corrente -> nosso "estamos atentos" -> ja agradecemos');
  check(!ia.jaAgradecemosADenuncia([{ de: 'contato', texto: CORRENTE }]), 'so a corrente: ainda nao');
  check(!ia.jaAgradecemosADenuncia([{ de: 'nos', texto: NOSSA }, { de: 'contato', texto: CORRENTE }]),
    'agradecimento ANTES da denuncia nao conta');
  check(!ia.jaAgradecemosADenuncia([{ de: 'contato', texto: CORRENTE }, { de: 'nos', texto: 'Bom dia! Tudo bem?' }]),
    'outra fala nossa nao conta');
  check(ia.jaAgradecemosADenuncia([{ de: 'contato', texto: CORRENTE }, { de: 'nos', texto: 'Obrigado por compartilhar, seguimos acompanhando.' }]),
    'a parafrase da print de 15/10 tambem conta');
}

grupo('a segunda corrente: a linha muda e o agradecimento repetido nao sai sozinho');
{
  const conversa = [
    { de: 'contato', texto: CORRENTE, at: at('14:10') },
    { de: 'nos', texto: NOSSA, at: at('14:20') },
    { de: 'contato', texto: CORRENTE.replace('*1ª FASE*', '*REPASSEM*'), at: at('16:05') },
  ];
  const bloco = ia.montarContatoRascunho({ mensagens: conversa }).replace(/\s+/g, ' ');
  check(/DENÚNCIA OU ACUSAÇÃO POLÍTICA — JÁ AGRADECEMOS/.test(bloco), 'a linha diz que ja agradecemos');
  check(!/Agradeça as informações em UMA frase/.test(bloco), 'e nao manda agradecer de novo');
  check(/marque o campo naoHaOQueResponder/.test(bloco), 'nada novo: naoHaOQueResponder');
  check(/NÃO REPITA o que já dissemos/.test(bloco), 'a regra anti-repeticao continua la');

  const repetido = 'Boa tarde.\n\nAgradeço as informações. Estamos atentos e acompanhando o assunto.';
  const parafrase = 'Boa tarde! Obrigado por compartilhar, seguimos acompanhando de perto.';
  const impede = Object.values(ia.AVISOS_QUE_IMPEDEM_ENVIO);
  for (const t of [repetido, parafrase]) {
    const av = ia.travasDoEscopo(t, { jaAgradecemosADenuncia: true });
    check(av.includes(ia.AVISOS_QUE_IMPEDEM_ENVIO.repetiuOAgradecimento) && !ia.rascunhoPodeSairSozinho(av),
      `repetido trava o envio sozinho: "${t.replace(/\s+/g, " ").slice(0, 50)}..."`);
  }
  check(!ia.travasDoEscopo(repetido, {}).includes(ia.AVISOS_QUE_IMPEDEM_ENVIO.repetiuOAgradecimento),
    'na PRIMEIRA vez o agradecimento passa (e a regra dele)');
  check(!ia.travasDoEscopo('Boa tarde! Um abraço.', { jaAgradecemosADenuncia: true }).includes(ia.AVISOS_QUE_IMPEDEM_ENVIO.repetiuOAgradecimento),
    'outra resposta, sem agradecer de novo, passa');
  const rev = ia.revisarRascunho(repetido, new Date('2026-10-31T16:10:00-03:00'), { jaAgradecemosADenuncia: true });
  check(rev.avisos.includes(ia.AVISOS_QUE_IMPEDEM_ENVIO.repetiuOAgradecimento), 'a revisao do rascunho leva a trava');
  check(/jaAgradecemosADenuncia: jaAgradecemosADenuncia\(mensagens\)/.test(ler('src/lib/ia-cliente.js')),
    'ia-cliente passa o contexto a validarRascunho');
}

fim();
