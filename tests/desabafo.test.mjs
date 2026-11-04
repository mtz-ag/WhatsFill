/**
 * Desabafo pessoal / briga de família (31/10/2026) e "você é Governador ou Deputado?".
 *
 * O caso: a apoiadora contou uma briga com a família por política ("tenho vontade de matar 1 por
 * 1", bloqueou 3 parentes, a irmã jogou uma cuia na cabeça dela, "mas sou forte vou defender ele")
 * e perguntou "voce e Governador ou Deputado?". O rascunho abria com janeiro de 2027 e o Zucco,
 * recontava a história, perguntava "Você está em segurança agora?" e listava 190/192. Ele quer a
 * resposta emotiva (TOM_DO_DESABAFO), e o cargo respondido só com "Sou deputado estadual".
 *
 * Rode: node tests/desabafo.test.mjs
 */
import { readFileSync } from 'node:fs';
import { check, grupo, fim, lib } from './_harness.mjs';

const ia = await lib('ia.js');
const cortesia = await lib('cortesia.js');
const sugestao = await lib('sugestao.js');

const raiz = new URL('../', import.meta.url);
const ler = (p) => readFileSync(new URL(p, raiz), 'utf8');
const at = (h) => new Date(`2026-10-31T${h}:00-03:00`).toISOString();
const agora = new Date('2026-10-31T15:40:00-03:00');

const CONVERSA = [
  { de: 'contato', texto: 'Capitão boa tarde', at: at('15:20') },
  { de: 'contato', texto: 'Hoje tive uma briga feia com minha família por causa de política. Meus parentes são tudo petista e ficaram debochando de mim porque eu apoio o senhor e o Bolsonaro', at: at('15:21') },
  { de: 'contato', texto: 'Tenho vontade de matar 1 por 1 juro', at: at('15:22') },
  { de: 'contato', texto: 'Bloqueei 3 parentes. Minha irmã jogou uma cuia na minha cabeça', at: at('15:23') },
  { de: 'contato', texto: 'Mas sou forte vou defender ele', at: at('15:24') },
  { de: 'contato', texto: 'voce e Governador ou Deputado?', at: at('15:25') },
];
const entrantes = CONVERSA.map((m) => ({ texto: m.texto, tipo: 'TEXT', at: m.at }));
const so = (...textos) => textos.map((t, i) => ({ texto: t, tipo: 'TEXT', at: at(`15:2${i}`) }));

const APROVADA =
  'Olá! Sou deputado estadual.\n\nSinto muito por tudo isso que você está passando. Briga dentro da família ' +
  'dói muito, ainda mais quando é por causa de política. Sua força e sua lealdade são admiráveis, e eu ' +
  'agradeço de coração por estar do nosso lado.\n\nMas nenhuma divergência vale a sua saúde nem a paz da ' +
  'sua casa. Não deixe a raiva te levar a fazer algo de que possa se arrepender, porque você é muito ' +
  'importante. Cuide desse machucado na cabeça e, se voltarem a te agredir, ligue para o 190.\n\nEstou com ' +
  'você. Se cuide!';

{
  grupo('desabafoPessoal: o que é e o que não é desabafo');
  const d = cortesia.desabafoPessoal(entrantes, null);
  check(!!d, 'a conversa real é desabafo');
  check(d?.familia && d?.raiva && d?.agressao, `família, raiva e agressão marcadas (${JSON.stringify(d)})`);
  check(!!cortesia.desabafoPessoal(so('minha irmã me bateu ontem'), null), 'agressão da irmã é desabafo');
  check(!!cortesia.desabafoPessoal(so('estou muito triste, briguei com meu marido por causa da eleição'), null), 'tristeza + briga com o marido é desabafo');
  for (const t of [
    'que raiva desse governo do PT',
    'o PT vai matar o povo de fome',
    'meu vizinho bateu o carro na esquina',
    'minha mãe está internada e precisa de um leito',
    'o prefeito desviou dinheiro da merenda, quero denunciar',
    'Boa tarde capitão',
  ]) check(!cortesia.desabafoPessoal(so(t), null), `NÃO é desabafo: "${t}"`);
  check(!cortesia.desabafoPessoal(entrantes, at('15:30')), 'o que veio antes da nossa última não conta');
}

{
  grupo('o desabafo vai para quem escreve (tecla 6), sem formulário');
  const pede = cortesia.conversaPedeRespostaPessoal(entrantes, null, []);
  check(/desabafo pessoal/.test(pede?.motivo || ''), `conversaPedeRespostaPessoal acusa o desabafo (${pede?.motivo})`);
  const sinais = {
    pedeRespostaPessoal: pede,
    desabafoPessoal: cortesia.desabafoPessoal(entrantes, null),
    podePedirDados: true, podeEnviar: false, textos: entrantes.map((e) => e.texto), ultimoTexto: entrantes.at(-1).texto,
  };
  const r = sugestao.sugerirAcao(sinais);
  check(r?.tecla === '6', `vai para a tecla 6 (${r?.id} / ${r?.tecla})`);
  check(sugestao.rascunhoSemCadastro(sinais) === true, 'rascunhoSemCadastro: o rascunho não pede nome e cidade');
  check(sugestao.rascunhoSemCadastro({}) === false, 'sem desabafo, nada muda');
}

{
  grupo('perguntouOCargo / perguntouDaTransicao');
  check(ia.perguntouOCargo(['voce e Governador ou Deputado?']), '"voce e Governador ou Deputado?"');
  check(ia.perguntouOCargo(['Você é deputado?']), '"Você é deputado?"');
  check(ia.perguntouOCargo(['qual é o seu cargo']), '"qual é o seu cargo"');
  check(!ia.perguntouOCargo(['o governador é ruim']), 'falar do governador não é perguntar o cargo');
  check(ia.perguntouDaTransicao(['você vai assumir a secretaria?']), 'secretaria é transição');
  check(ia.perguntouDaTransicao(['e em 2027?']), '2027 é transição');
  check(!ia.perguntouDaTransicao(['voce e Governador ou Deputado?']), 'a pergunta do cargo NÃO é de transição');
  check(ia.cargoDe(null) === 'deputado estadual', `cargo de fábrica: ${ia.cargoDe(null)}`);
}

{
  grupo('linhaDoDesabafo: calor, sem pergunta, 190 só com agressão');
  const com = ia.linhaDoDesabafo({ motivo: 'desabafo pessoal (x)', familia: true, raiva: true, agressao: true }, { cargoPerguntado: true });
  check(/Sou deputado estadual/.test(com), 'abre com o cargo quando perguntado');
  check(/190/.test(com) && /nunca na primeira frase/.test(com), '190 com agressão, nunca na primeira frase');
  check(/raiva/.test(com), 'fala da raiva quando ela falou em fazer mal');
  check(/PROIBIDO[^]*pergunta/.test(com), 'proíbe qualquer pergunta');
  check(/SEM recontar/.test(com), 'proíbe recontar');
  check(/2027/.test(com) && /cadastro/.test(com), 'proíbe 2027 e cadastro');
  const sem = ia.linhaDoDesabafo({ motivo: 'desabafo pessoal (y)', familia: true, sofrimento: true }, {});
  check(/NÃO cite 190/.test(sem), 'sem agressão: NÃO cita 190');
  check(!/Abra respondendo a pergunta do cargo/.test(sem), 'sem pergunta do cargo, não abre com ele');
  check(!/Ela falou em fazer mal/.test(sem), 'sem raiva, não fala de raiva');
}

{
  grupo('montarContatoRascunho: o bloco do desabafo, sem formulário nem explicação política');
  const bloco = ia.montarContatoRascunho({ mensagens: CONVERSA, agora, pedirDados: true, perguntaDoMandato: true });
  check(/DESABAFO PESSOAL/.test(bloco), 'tem a linha do desabafo');
  check(/PERGUNTOU O CARGO/.test(bloco) && /Sou deputado estadual/.test(bloco), 'tem a linha do cargo');
  check(!/Nome\s*,\s*Cidade/.test(bloco), 'não pede o formulário, mesmo com pedirDados');
  check(!/PERGUNTOU DO MANDATO/.test(bloco), 'a linha do mandato sai');
  const mandato = ia.montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'qual lei o senhor aprovou?', at: at('15:20') }], agora, perguntaDoMandato: true });
  check(/PERGUNTOU DO MANDATO/.test(mandato), 'sem desabafo, a linha do mandato continua (o teste acima não é vazio)');
  const normal = ia.montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'qual o horário do evento?', at: at('15:20') }], agora });
  check(!/DESABAFO PESSOAL/.test(normal), 'conversa comum não ganha a linha do desabafo');
  const transicao = ia.montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'você vai assumir a secretaria em 2027? você é deputado ainda?', at: at('15:20') }], agora });
  check(!/PERGUNTOU O CARGO/.test(transicao), 'perguntou da transição: a linha só-o-cargo não entra');
}

{
  grupo('travas: pergunta, formulário e transição barram o envio');
  const A = ia.AVISOS_QUE_IMPEDEM_ENVIO;
  const ctx = { desabafo: cortesia.desabafoPessoal(entrantes, null), perguntouSoOCargo: true };
  check(ia.travasDoEscopo('Sinto muito. Você está em segurança agora?', ctx).includes(A.perguntouNoDesabafo), 'pergunta no desabafo barra');
  check(ia.travasDoEscopo('Sinto muito.\n\nNome , Cidade', ctx).includes(A.cadastroNoDesabafo), 'formulário no desabafo barra');
  check(ia.travasDoEscopo('Fui anunciado para assumir a Secretaria em janeiro de 2027.', ctx).includes(A.explicouATransicao), 'explicar 2027 a quem só perguntou o cargo barra');
  const aprovada = ia.travasDoEscopo(APROVADA, ctx);
  check(aprovada.length === 0, `a resposta aprovada passa sem aviso (${JSON.stringify(aprovada)})`);
  check(ia.travasDoEscopo('Tudo bem? Posso ajudar?', {}).every((a) => a !== A.perguntouNoDesabafo), 'fora do desabafo, pergunta não barra');
}

{
  grupo('o painel e o cliente passam o desabafo adiante');
  const painel = ler('src/panel/panel.js');
  const cli = ler('src/lib/ia-cliente.js');
  check(/desabafoPessoal:\s*desabafoPessoal\(state\.entrantes, state\.nossaUltimaAt\)/.test(painel), 'sinaisDoContato tem desabafoPessoal');
  check(/desabafo:/.test(cli) && /perguntouSoOCargo/.test(cli), 'validarRascunho recebe desabafo e perguntouSoOCargo');
}

{
  grupo('briga privada não vira pedido por mencionar valores');
  check(!!cortesia.desabafoPessoal(so('Briguei com meu marido pela administração da empresa e pelo dinheiro'), null), 'casal e empresa: desabafo');
  check(!!cortesia.desabafoPessoal(so('Meu marido é um mentiroso, você babaca'), null), 'xingamento ao marido: desabafo');
  check(!cortesia.desabafoPessoal(so('Preciso de dinheiro para a empresa'), null), 'menção empresarial sozinha não prova briga familiar');
  const fonte = ler('src/lib/ia.js');
  const inicio = fonte.indexOf('  const identidadeIncerta =');
  const final = fonte.indexOf(';', inicio);
  const detectar = new Function('lista', fonte.slice(inicio, final + 1) + 'return identidadeIncerta;');
  check(detectar([{ de: 'contato', texto: 'É a Ana, estou usando o telefone do meu marido' }]), 'apresentação de esposa em telefone emprestado');
  check(detectar([{ de: 'contato', texto: 'Eu tô com o telefone do Carlos' }]), 'telefone emprestado por pessoa nomeada');
  check(!detectar([{ de: 'nos', texto: 'Estou com o telefone do Carlos' }]), 'fala nossa não troca identidade do contato');
  check(!detectar([{ de: 'contato', texto: 'Meu marido trabalha comigo' }]), 'referência ao marido não basta para trocar falante');
  check(fonte.includes('IDENTIDADE DO FALANTE') && fonte.includes('telefone emprestado'), 'prompt inclui contexto de outro falante');
  check(fonte.includes('mantenha o alvo indeterminado'), 'não presume que insulto é dirigido ao atendimento');
}
{
  grupo('não repetir nome informado espontaneamente');
  const conversa = [{ de: 'contato', texto: 'Sou Carlos Almeida' }];
  check(ia.nomeApresentado(conversa), 'reconhece apresentação sem formulário');
  check(ia.pedidoDeCadastroDoRascunho(conversa).includes('qual cidade'), 'pede só cidade');
  check(ia.pedidoDeCadastroDoRascunho(conversa, { Cidade: 'Canoas' }) === '', 'não pede nada quando a cidade também é conhecida');
  for (const texto of ['Sou Presidente da Federação', 'Sou de Porto Alegre', 'Sou muito grato']) {
    check(!ia.nomeApresentado([{ de: 'contato', texto }]), `não confunde descrição com nome: ${texto}`);
  }
  check(!ia.nomeApresentado([{ de: 'nos', texto: 'Sou Carlos Almeida' }]), 'não usa apresentação do atendente');
  const templates = await lib('templates.js');
  check(templates.ehPedidoDeDados(ia.pedidoDeCadastroDoRascunho(conversa)), 'pedido parcial continua reconhecível no histórico');
}
fim();
