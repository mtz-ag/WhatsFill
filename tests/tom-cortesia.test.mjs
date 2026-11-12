import { check, fim, lib } from './_harness.mjs';
const { contextoCortesia, falhasTomCortesia, normalizarLugar } = await lib('tom-cortesia.js');
const { rascunhar } = await lib('ia-cliente.js');
const { revisarRascunho } = await lib('ia.js');
const agora = new Date(); agora.setHours(10, 0, 0, 0);
const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1);
const mensagens = [
  { de: 'nos', texto: 'Bom dia, obrigado pelo carinho!', at: ontem.toISOString() },
  { de: 'contato', texto: 'Vamos madrugar com os galos ? Rsrsrs tenha tu e os teus mais um dia baita abençoado e essa guria ti deseja tudo de bom e boas soluções para os problemas climáticos do nosso estado bjs' },
  { de: 'contato', texto: 'Gratidão' },
];
const ruim = 'Bom dia! Que Deus abençoe você e os seus também. 🙏\n\nAgradeço o carinho e essa preocupação com o nosso estado. Que possamos encontrar boas soluções para os problemas climáticos do Rio Grande do Sul. Um beijo!';
const boa = 'Bom dia! Amém, que Deus abençoe você e os seus também. Obrigado pelo carinho de sempre, um grande abraço!';
const contexto = contextoCortesia(mensagens);
check(contexto.ativo && contexto.bencao, 'rajada com brincadeira e Gratidão é cortesia');
check(falhasTomCortesia(ruim, contexto).some(x => x.includes('paráfrase')), 'detecta paráfrase com expressões compartilhadas');
check(!falhasTomCortesia(boa, contexto).length, 'resposta aprovada cumpre tom e extensão');
for (const lugar of ['nosso estado', 'Rio Grande do Sul', 'RS', 'gaúcho']) {
  check(normalizarLugar(lugar) === 'estado', 'normaliza ' + lugar);
  check(falhasTomCortesia(`Obrigado pelo carinho. Que Deus abençoe as boas soluções para os problemas climáticos do ${lugar}. Um abraço!`, contexto).length > 0, 'barra tema com ' + lugar);
}
for (const beijo of ['Um beijo!', 'bjs!', 'Beijão!', 'Beijos!', 'Um grande beijo!']) {
  const r = revisarRascunho(beijo, agora);
  check(r.texto === 'um grande abraço!', 'troca despedida: ' + beijo);
}
let chamadas = []; let respostas = [];
chrome.runtime.sendMessage = async (pedido) => { chamadas.push(pedido); return { ok: true, decisao: { texto: respostas.shift(), confianca: 0.95, precisaDeRevisao: false }, custoUsd: 0.01 }; };
const args = { mensagens, templates: [], campos: {}, agora, modelo: 'gpt-5.6-luna' };
respostas = [ruim, boa];
let r = await rascunhar(args);
check(chamadas.length === 2 && r.texto === boa, 'integração reescreve o caso real');
check(!/soluções|climáticos|estado|Rio Grande do Sul|beijo|\?/i.test(r.texto), 'saída sem tema, beijo ou pergunta');
check(chamadas[0].contato.includes('CORTESIA AFETUOSA'), 'instrução chega ao modelo');
for (const pedido of ['Bom dia! Quais as propostas para os problemas climáticos?', 'Deus abençoe. Preciso de ajuda com a enchente', 'Bom dia, solicito informações sobre prevenção de enchentes', 'Gostaria de saber as soluções para o clima', 'Bom dia, quero ajuda com a enchente']) {
  chamadas = []; respostas = ['Defendo medidas de prevenção e adaptação climática.'];
  const conversa = [...mensagens, { de: 'contato', texto: pedido }];
  check(!contextoCortesia(conversa).ativo, 'demanda real vence cortesia: ' + pedido);
  r = await rascunhar({ ...args, mensagens: conversa });
  check(chamadas.length === 1 && r.texto.includes('climática'), 'preserva resposta ao conteúdo');
}
check(!contextoCortesia([{ de: 'contato', texto: 'Bom dia, a enchente invadiu minha casa' }]).ativo, 'relato concreto não vira cortesia');
check(!contextoCortesia([...mensagens, { de: 'nos', texto: boa }]).ativo, 'ignora rajada respondida');
respostas = [ruim, ruim]; chamadas = [];
r = await rascunhar(args);
check(chamadas.length === 2 && !r.texto && r.precisaDeRevisao, 'não libera reincidência nem repete indefinidamente');
fim();
