import { check, fim, lib } from './_harness.mjs';
const { contextoPublico, falhasTomPublico } = await lib('tom-publico.js');
const { rascunhar } = await lib('ia-cliente.js');
const mensagens = [
  { de: 'nos', texto: 'Falamos de parcerias com especialistas e manutenção.' },
  ...['Sim', 'Eu particularmente não conheço ninguém', 'Só sei que é horrível o aspecto destes postes de luz no Brasil e sem contar os gatos que fazem na rede elétrica', 'Já soube de motoqueiro que morreu degolado por causa de fio de poste caído aí depois das enchentes'].map(texto => ({ de: 'contato', texto })),
];
const ruim = 'É muito triste e perigoso quando um fio cai depois de uma enchente, ainda mais com risco para quem passa pela rua. A rede elétrica precisa de manutenção e segurança para não colocar vidas em perigo.';
const boa = 'Lamento muito, uma vida perdida assim não pode ser tratada com descaso. Segurança na rede elétrica é coisa séria e sigo cobrando por isso. Obrigado por compartilhar, um grande abraço!';
const contexto = contextoPublico(mensagens);
check(contexto.ativo, 'reconhece a rajada real');
check(falhasTomPublico(ruim, contexto).some(x => x.includes('paráfrase')), 'barra a paráfrase real');
check(!falhasTomPublico(boa, contexto).length, 'aceita acolhimento de até 3 frases em primeira pessoa');
check(falhasTomPublico('É muito triste quando acontece isso. Obrigado!', contexto).length > 0, 'barra abertura sem detalhes repetidos');
check(!contextoPublico([...mensagens, { de: 'nos', texto: boa }]).ativo, 'ignora relatos já respondidos');
check(!contextoPublico([{ de: 'contato', texto: 'poste caído', anuncio: true }]).ativo, 'ignora anúncios');
let chamadas = [];
let respostas = [];
chrome.runtime.sendMessage = async (pedido) => { chamadas.push(pedido); return { ok: true, decisao: { texto: respostas.shift(), confianca: 0.95, precisaDeRevisao: false }, custoUsd: 0.01 }; };
const args = { mensagens, templates: [], campos: {}, agora: new Date('2026-11-12T10:00:00-03:00'), modelo: 'gpt-5.6-luna' };
respostas = [ruim, boa];
let resultado = await rascunhar(args);
check(chamadas.length === 2 && resultado.texto === boa, 'reescreve via worker e entrega o texto aprovado');
check(resultado.custoUsd === 0.02, 'soma o custo das duas tentativas');
check(!/\b(fio|enchente|rua)\b|\?/.test(resultado.texto), 'saída sem detalhes repetidos e sem pergunta');
check(chamadas.every(c => c.modelo === args.modelo), 'preserva o modelo selecionado');
respostas = [ruim, ruim]; chamadas = [];
resultado = await rascunhar(args);
check(chamadas.length === 2 && !resultado.texto && resultado.precisaDeRevisao, 'falha persistente não libera rascunho inadequado nem entra em loop');
for (const pergunta of ['Como denunciar um fio caído?', 'Quero saber quem cuida da rede elétrica', 'Pode explicar a manutenção dos postes']) {
  chamadas = []; respostas = ['A manutenção da rede elétrica cabe à concessionária responsável.'];
  const conversa = [...mensagens, { de: 'contato', texto: pergunta }];
  check(!contextoPublico(conversa).ativo, 'preserva pergunta: ' + pergunta);
  resultado = await rascunhar({ ...args, mensagens: conversa });
  check(chamadas.length === 1 && resultado.texto.includes('concessionária'), 'responde ao conteúdo sem impor encerramento');
}
fim();
