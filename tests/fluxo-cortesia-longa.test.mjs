import { readFileSync } from 'node:fs';
import { check, fim, lib } from './_harness.mjs';
const c = await lib('cortesia.js');
const s = await lib('sugestao.js');
const a = await lib('arvore.js');
const { rascunhar } = await lib('ia-cliente.js');
const agora = new Date(); agora.setHours(10, 0, 0, 0);
const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1);
const texto = 'Vamos madrugar com os galos ? Rsrsrs tenha tu e os teus mais um dia baita abençoado e essa guria ti deseja tudo de bom e boas soluções para os problemas climáticos do nosso estado bjs';
const msgs = (...textos) => textos.map(texto => ({ texto, tipo: 'TEXT', at: agora.toISOString() }));
function sinais(entrantes) {
  return {
    jaRespondemosAntes: true, temEtiquetaDeCidade: true, podeMandarMomento: true, podeEnviar: true,
    textos: entrantes.map(m => m.texto), ultimoTexto: entrantes.at(-1)?.texto,
    cortesiaParaRascunho: c.cortesiaParaRascunho(entrantes, ontem),
    pedeRespostaPessoal: c.conversaPedeRespostaPessoal(entrantes, ontem) || c.falouAlgoProprio(entrantes, ontem),
    perguntaAberta: c.conversaTemPerguntaAberta(entrantes, ontem),
    perguntaPendente: c.perguntaPendente(entrantes, ontem),
    reclamaSemResposta: c.reclamaSemResposta(entrantes, ontem),
    naoPodeFalarAgora: c.naoPodeFalarAgora(entrantes, ontem),
    desabafoPessoal: c.desabafoPessoal(entrantes, ontem),
    denunciaOuCorrente: c.denunciaOuCorrente(entrantes, ontem),
    pedeAlgoIndefinido: c.pedeAlgoIndefinido(entrantes, ontem),
    soCortesia: c.soCortesia(entrantes),
    cortesiaDeFechamento: c.cortesiaDeFechamento(entrantes, ontem),
  };
}
const conversa = msgs(texto, 'Gratidão');
check(s.rascunhoSemCadastro(sinais(conversa)), 'cortesia não termina pedindo cadastro');
for (const entrada of [conversa, msgs((texto + ' ').repeat(3)), [{ ...msgs((texto + ' ').repeat(3))[0], tipo: 'AUDIO', transcrito: true }]]) {
  const ctx = sinais(entrada);
  check(!!ctx.cortesiaParaRascunho && !ctx.pedeRespostaPessoal, 'cortesia vence tamanho e falouAlgoProprio');
  for (const decisao of [s.sugerirAcao(ctx), a.decidir(ctx, a.fluxoPadrao(), {}), a.decidir(ctx, a.arvorePadrao(), {})]) {
    check(decisao?.ia && decisao.tecla !== '6' && !/responda à mão/i.test(decisao.motivo), 'fluxo gera rascunho automaticamente: ' + JSON.stringify(decisao));
  }
}
const extras = [
  'Minha irmã me bateu por causa de política e estou muito triste.',
  'Estou com infecção urinária e respiratória, muita tosse e febre. Falarei assim que for possível.',
  'Quero denunciar irregularidades nas compras da prefeitura.',
  'Quais são as propostas para resolver os problemas climáticos?',
  'Ninguém quis entrar em contato comigo, vocês nunca respondem.',
];
for (const extra of extras) {
  const entrada = msgs(('Bom dia, Deus abençoe. ' + extra + ' ').repeat(4));
  const ctx = sinais(entrada);
  check(!ctx.cortesiaParaRascunho, 'não classifica como cortesia: ' + extra);
  check(s.sugerirAcao(ctx)?.tecla === '6', 'tabela mantém tecla 6');
  check(a.decidir(ctx, a.fluxoPadrao(), {})?.tecla === '6', 'árvore mantém tecla 6');
}
const audio = sinais([...conversa, { tipo: 'AUDIO', texto: '', at: agora.toISOString() }]);
check(!audio.cortesiaParaRascunho && a.decidir(audio, a.fluxoPadrao(), {})?.tecla === '6', 'áudio sem transcrição vence cortesia');
const boa = 'Bom dia! Amém, que Deus abençoe você e os seus também. Obrigado pelo carinho de sempre, um grande abraço!';
let chamadas = 0;
chrome.runtime.sendMessage = async () => { chamadas++; return { ok: true, decisao: { texto: boa, confianca: 0.95, precisaDeRevisao: false } }; };
const decisao = a.decidir(sinais(conversa), a.fluxoPadrao(), {});
const resultado = decisao?.ia ? await rascunhar({ mensagens: [{ de: 'nos', texto: 'Bom dia, obrigado!', at: ontem.toISOString() }, ...conversa.map(m => ({ ...m, de: 'contato' }))], agora, templates: [], campos: {} }) : null;
check(chamadas === 1 && resultado?.texto === boa, 'decisão automática chega ao worker e gera resposta aprovada');
check(resultado && !/soluções|climáticos|estado|Rio Grande do Sul|beijo|\?/i.test(resultado.texto), 'saída sem tema, beijo ou pergunta');
const painel = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');
check(painel.includes('cortesiaParaRascunho: cortesiaParaRascunho(state.entrantes, state.nossaUltimaAt)'), 'painel calcula o sinal');
check(painel.includes('const ramoChamaIA = !!sugestao?.ia') && painel.includes('rascunho = await rascunharParaEle()'), 'ramo usa geração automática existente');
fim();
