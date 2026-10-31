/**
 * Emoji na chegada e as boas-vindas na primeira pessoa (31/10/2026).
 *
 * Modo Normal, rodada no automático: a única mensagem do dia era um emoji, e o campo recebeu
 * "Boa tarde! Seja bem-vinda — aqui é a equipe do Capitão Martim. Em que podemos ajudar?".
 * Ele: "o erro persiste, a mensagem deveria ser a mensagem do momento".
 *
 * Duas causas:
 *  1. Na chegada, a caixa `chegada-boas-vindas` ficava ACIMA de `ultima-e-so-reacao` e casava com
 *     qualquer primeira vinda sem anúncio — inclusive só emoji. O quadro dele é GRAVADO, então a
 *     regra mora também no código (`arvore.momentoNoGesto`).
 *  2. O "aqui é a equipe" veio do texto gravado dele: "gabinete" virou "equipe" na migração de
 *     07/09. As boas-vindas agora falam na primeira pessoa do singular (fábrica, migração e envio).
 *
 * Rode: node tests/momento-no-gesto.test.mjs
 */
import { readFileSync } from 'node:fs';
import { check, grupo, fim, lib, mem } from './_harness.mjs';

const arv = await lib('arvore.js');
const cortesia = await lib('cortesia.js');
const templates = await lib('templates.js');
const store = await lib('store.js');
const vars = await lib('vars.js');

const raiz = new URL('../', import.meta.url);
const painel = readFileSync(new URL('src/panel/panel.js', raiz), 'utf8');

const emoji = [{ texto: '😍', tipo: 'TEXT' }];
const gesto = {
  soCortesia: cortesia.soCortesia(emoji),
  ultimaEhSoReacao: cortesia.ultimaEhSoReacao(emoji),
  podeMandarMomento: true,
  podePedirDados: true,
  temEtiquetaDeCidade: false,
  veioDeAnuncio: false,
  jaRespondemosAntes: false,
  jaPediramDados: false,
  respondidoHoje: false,
  textos: ['😍'],
  ultimoTexto: '😍',
};

/** O quadro como ele tem GRAVADO: a caixa das boas-vindas sem a condição nova. */
function quadroGravado() {
  const fluxo = JSON.parse(JSON.stringify(arv.fluxoPadrao()));
  let achou = 0;
  for (const { no } of arv.todosOsNos(fluxo)) {
    if (no.acao?.resposta === 'boas-vindas') {
      no.maisCondicoes = (no.maisCondicoes || []).filter((c) => c.sinal !== 'ultimaEhSoReacao');
      achou += 1;
    }
  }
  return { fluxo, achou };
}

{
  grupo('emoji na chegada recebe a mensagem do momento, não as boas-vindas');
  check(gesto.ultimaEhSoReacao === true, 'o emoji conta como "só reação"');
  const fluxo = arv.fluxoPadrao();
  const r = arv.decidir(gesto, fluxo, {});
  check(r?.resposta !== 'boas-vindas' && r?.tecla === '5', `quadro padrão: tecla 5 (${r?.id} / ${r?.tecla} / ${r?.resposta})`);

  const { fluxo: gravado, achou } = quadroGravado();
  check(achou >= 1, 'o quadro gravado tem a caixa das boas-vindas');
  const g = arv.decidir(gesto, gravado, {});
  check(g?.tecla === '5' && g?.id === arv.MOMENTO_NO_GESTO, `quadro GRAVADO (sem a condição nova): a guarda do código manda a do momento (${g?.id} / ${g?.tecla})`);
  check(/mensagem do momento/.test(g?.motivo || ''), 'o motivo diz por quê');
  check(g?.caminho?.includes(arv.MOMENTO_NO_GESTO), 'o caminho mostra a guarda');
}

{
  grupo('o que NÃO muda');
  const { fluxo } = quadroGravado();
  const semMomento = arv.decidir({ ...gesto, podeMandarMomento: false }, fluxo, {});
  check(semMomento?.resposta === 'boas-vindas', `sem mensagem do momento, as boas-vindas continuam (${semMomento?.resposta})`);
  const respondido = arv.momentoNoGesto({ id: 'x', resposta: 'boas-vindas' }, { ...gesto, respondidoHoje: true });
  check(respondido === null, 'já respondemos hoje: a guarda não age');
  const pergunta = arv.momentoNoGesto({ id: 'x', resposta: 'boas-vindas' }, { ...gesto, perguntaAberta: true });
  check(pergunta === null, 'pergunta aberta: a guarda não age');
  check(arv.momentoNoGesto({ id: 'x', resposta: 'pedido-ligacao' }, gesto) === null, 'outra resposta pronta: a guarda não age');

  const oi = [{ texto: 'Boa tarde', tipo: 'TEXT' }];
  const cumprimento = { ...gesto, soCortesia: cortesia.soCortesia(oi), ultimaEhSoReacao: cortesia.ultimaEhSoReacao(oi), textos: ['Boa tarde'], ultimoTexto: 'Boa tarde' };
  const padrao = arv.fluxoPadrao();
  const c = arv.decidir(cumprimento, padrao, {});
  check(c?.resposta === 'boas-vindas', `primeira vinda que CUMPRIMENTA continua recebendo as boas-vindas — decisão dele de 04/09 (${c?.resposta || c?.tecla})`);
}

{
  grupo('o modo Normal não desliga a mensagem do momento');
  const aviso = painel.indexOf('Modo Normal: esta frase não é consultada');
  const campo = painel.lastIndexOf("campoTexto('Frase que identifica o aceite do anúncio'", aviso);
  check(aviso > 0 && campo > 0 && aviso - campo < 1200, 'o aviso do modo Normal fica no campo da frase do aceite');
  check(/const textoMomento = String\(state\.auto\.cfg\.mensagemMomento \|\| ''\)\.trim\(\);/.test(painel), 'a mensagem do momento é lida sem olhar o modo');
}

{
  grupo('boas-vindas na primeira pessoa, sem "equipe"');
  const vivo = 'Boa tarde! Seja bem-vinda — aqui é a equipe do Capitão Martim.\n\nEm que podemos ajudar?';
  const saida = templates.boasVindasNaPrimeiraPessoa(vivo);
  check(saida === 'Boa tarde! Seja bem-vinda!\n\nEm que posso ajudar?', `o texto gravado: ${JSON.stringify(saida)}`);
  check(templates.falaComoEquipe(vivo) && !templates.falaComoEquipe(saida), 'falaComoEquipe acusa o antes e não o depois');
  check(templates.boasVindasNaPrimeiraPessoa(saida) === saida, 'idempotente');

  const comPedido = '{{saudacao}}! Bem-vindo. Você está falando com o gabinete do Capitão Martim.\n\nEm que podemos ajudar?\n\nE, se puder, nos informe para melhor atendê-lo:\n\nNome , Cidade\n\n(exemplo: Pedro Silva , Porto Alegre)';
  const s2 = templates.boasVindasNaPrimeiraPessoa(templates.semGabinete(comPedido));
  check(!/equipe|gabinete|assessoria|podemos|nos informe/i.test(s2), `gabinete, equipe, primeira pessoa: ${JSON.stringify(s2.slice(0, 80))}`);
  check(templates.ehPedidoDeDados(s2) && /Nome , Cidade/.test(s2), 'o invariante "Nome , Cidade" fica');
  check(/me informe para eu melhor atendê-lo/.test(s2), 'o pedido fica no singular');
  check(vars.concordarGenero(s2, 'Marina').includes('atendê-la'), 'a concordância de gênero continua funcionando');

  for (const id of templates.IDS_DAS_BOAS_VINDAS) {
    const t = store.DEFAULT_TEMPLATES.find((x) => x.id === id);
    for (const texto of [t.text, ...(t.variantes || [])]) {
      check(!templates.falaComoEquipe(texto) && !/equipe|assessoria|podemos/i.test(texto), `fábrica "${id}" na primeira pessoa: ${JSON.stringify(texto.slice(0, 40))}`);
    }
  }
}

{
  grupo('a migração alcança o texto GRAVADO dele, uma vez');
  const interesse = store.DEFAULT_TEMPLATES.find((t) => t.id === 'interesse-conteudo');
  mem.templates = [
    { id: 'boas-vindas-tem-dados', name: 'Boas-vindas (já temos o cadastro)', text: '{{saudacao}}! Seja bem-vindo — aqui é a equipe do Capitão Martim.\n\nEm que podemos ajudar?', variantes: ['{{saudacao}}! Bem-vindo. Você está falando com a equipe do Capitão Martim.\n\nEm que podemos ajudar?'] },
    { ...interesse },
  ];
  mem.migracoes = {};
  const mudadas = await templates.migrarBoasVindasPrimeiraPessoa();
  check(mudadas.length === 1, `mudou só as boas-vindas (${JSON.stringify(mudadas)})`);
  const bv = mem.templates.find((t) => t.id === 'boas-vindas-tem-dados');
  check(bv.text === '{{saudacao}}! Seja bem-vindo!\n\nEm que posso ajudar?', `texto: ${JSON.stringify(bv.text)}`);
  check(bv.variantes[0] === '{{saudacao}}! Bem-vindo!\n\nEm que posso ajudar?', `variante: ${JSON.stringify(bv.variantes[0])}`);
  check(mem.templates.find((t) => t.id === 'interesse-conteudo').text === interesse.text, 'as outras respostas ficam intactas');
  check(mem.migracoes.boasVindasPrimeiraPessoa === true, 'flag própria gravada');
  mem.templates[0].text = 'Texto que ele reescreveu depois, aqui é a equipe.';
  check((await templates.migrarBoasVindasPrimeiraPessoa()).length === 0, 'roda uma vez só');
  const src = readFileSync(new URL('src/lib/templates.js', raiz), 'utf8');
  check(src.indexOf('await migrarBoasVindasPrimeiraPessoa()') > src.indexOf('await migrarGabineteParaEquipe();'), 'roda DEPOIS da que trocou gabinete por equipe');
  check(/IDS_DAS_BOAS_VINDAS\.includes\(template\?\.id\)[\s\S]{0,120}boasVindasNaPrimeiraPessoa\(text\)/.test(painel), 'e o envio passa o texto pela primeira pessoa (cobre edição posterior)');
}

fim();
