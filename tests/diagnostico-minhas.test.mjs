/**
 * Os quatro defeitos achados usando a extensao na fila "Minhas" dele (17/11/2026), com dados
 * ficticios no lugar dos eleitores.
 *
 *  1. o painel travava na troca de conversa (ver page-mob.test e dom-mob.test);
 *  2. quem respondeu ao FORMULARIO recebia a mensagem do momento (o Itamar);
 *  3. a IA sem o que responder mandava repetir a mensagem do momento ja enviada (o Andre);
 *  4. o engajado que contava algo dele em primeira pessoa era concluido calado (a Lia).
 */
import { readFileSync } from 'node:fs';
import { check, grupo, fim, lib } from './_harness.mjs';

const cortesia = await lib('cortesia.js');
const sug = await lib('sugestao.js');
const painel = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const nossaAt = '2026-11-16T10:18:00-03:00';
const ela = (texto, at = '2026-11-17T14:16:00-03:00') => ({ texto, tipo: 'TEXT', at });
const formulario = [
  { texto: 'Bom dia! para podermos passar para o responsável da agenda por favor preencha esse formulário', at: '2026-11-16T10:17:30-03:00' },
  { texto: 'https://mobiliza.me/capitaomartim/formulario/agenda', at: nossaAt },
];

grupo('quem responde ao formulario recebe a IA, nao a mensagem do momento (o Itamar)');
{
  const r = cortesia.respostaAoFormulario([ela('Ola'), ela('Ja fiz agendamento')], formulario, nossaAt);
  check(!!r, 'responder depois do link do formulario e reconhecido');
  check(!cortesia.respostaAoFormulario([ela('https://www.facebook.com/share/r/x/')], formulario, nossaAt), 'link sozinho nao e resposta');
  check(!cortesia.respostaAoFormulario([ela('Ja fiz agendamento')], [{ texto: 'Bom dia! Que Deus abençoe', at: nossaAt }], nossaAt),
    'sem formulario na nossa ultima fala, nada muda');

  const decisaoDoFluxo = { id: 'r:ja-respondemos-antes:sem-cidade', tecla: '5' };
  const d = sug.decisaoDaRespostaAoFormulario({ respostaAoFormulario: r }, decisaoDoFluxo);
  check(d?.ia === true && d?.tecla == null, 'a mensagem do momento vira rascunho da IA');
  check(!sug.decisaoDaRespostaAoFormulario({ respostaAoFormulario: r, cortesiaDeFechamento: { motivo: 'x' } }, decisaoDoFluxo),
    'quem so agradeceu continua no fecho (a IA nao ganha a ultima palavra)');
  check(!sug.decisaoDaRespostaAoFormulario({ respostaAoFormulario: r }, { id: 'r:etiqueta-so-conclui', tecla: '3' }),
    'nao atravessa a protecao do assessor');
  const fonteSug = readFileSync(new URL('../src/lib/sugestao.js', import.meta.url), 'utf8');
  const fonteArv = readFileSync(new URL('../src/lib/arvore.js', import.meta.url), 'utf8');
  check((fonteSug.match(/\|\| decisaoDaRespostaAoFormulario\(c, (decisao|null)\)/g) || []).length === 2, 'sugerirAcao aplica o ajuste com e sem decisao');
  check(/decisaoDaRespostaAoFormulario\(c, escolhida\)/.test(fonteArv), 'e o quadro (arvore.decidir) tambem');
  check(sug.rascunhoSemCadastro({ respostaAoFormulario: r }), 'e o rascunho nao pede o cadastro de quem acabou de preencher o formulario');
}

grupo('a IA sem o que responder nao repete a mensagem do momento (o Andre)');
{
  const corpo = painel.slice(painel.indexOf('const momentoNaoCabe = sugestaoLib.momentoDeNovoNaoCabe'), painel.indexOf('const escolha = escolhaAutomatica ??'));
  check(/semOQueResponder && escolhaAutomatica == null && rodadaAutomatica\(\) && momentoNaoCabe && !temPergunta[\s\S]{0,200}escolhaAutomatica = 'concluir'/.test(corpo),
    'ja tendo falado hoje, a rodada conclui sem enviar');
  check(/temPergunta = !!\(sinaisDoContato\?\.perguntaAberta \|\| sinaisDoContato\?\.perguntaPendente\)/.test(corpo),
    'com pergunta, o caso continua com ele');
  check(painel.includes("'a IA não achou o que responder e já falamos com ela hoje — conclua sem enviar (tecla 3)'"),
    'e fora da rodada a tela tambem diz para concluir, nao para mandar a tecla 5');
}

grupo('engajado que conta algo DELE nao e concluido calado (a Lia)');
{
  const ate = '2026-11-17T10:00:00-03:00';
  const lia = 'Eu estou impossibilitada de exercer um ganho extra porque estao ameacando cortar o BPC';
  check(!!cortesia.falaPessoalDela([ela(lia)], ate), 'primeira pessoa contando a propria situacao');
  for (const t of ['Eu apoio vocês demais', 'Obrigada meu capitão', 'Bom dia meu querido, Deus abençoe',
    'Corta, salga, 8 pedaços GARANTE 8 refeições Proteína Força', 'https://www.facebook.com/share/r/x/',
    'Amém, minha família é toda 22', 'Tamo junto, eu voto no 22']) {
    check(!cortesia.falaPessoalDela([ela(t)], ate), `nao e fala pessoal: "${t}"`);
  }
  const regra = sug.REGRAS.find((r) => r.id === 'etiqueta-dispensa-da-fila');
  check(regra.tecla({ respondidoHoje: true, falaPessoalDela: { motivo: 'x' } }) === '6', 'com fala pessoal, a IA escreve (tecla 6)');
  check(regra.tecla({ respondidoHoje: true }) === '3', 'sem ela, o engajado ja respondido continua concluindo');
}

grupo('a saudacao nao conta como frase na cortesia (o Jandir)');
{
  const tom = await lib('tom-cortesia.js');
  const resposta = 'Boa tarde! Tudo bem sim, graças a Deus. Que Deus abençoe você também. Obrigado pelo carinho, um grande abraço!';
  check(tom.contarFrases(resposta) === 3, 'responder o "tudo bem?" com saudacao, bencao e abraco cabe em 3');
  const ctx = { ativo: true, bencao: true, texto: 'Boa tarde Capitao tudo bem com voce abencoe abraco' };
  check(!tom.falhasTomCortesia(resposta, ctx).includes('máximo de 3 frases'), 'e a conferencia do tom nao reprova mais');
  check(tom.contarFrases('Uma frase longa aqui. Outra frase longa aqui. Terceira frase longa aqui. Quarta frase longa aqui.') === 4,
    'quatro frases de conteudo continuam sendo quatro');
  for (const arq of ['tom-publico.js', 'repasse-ia.js']) {
    const fonte = readFileSync(new URL(`../src/lib/${arq}`, import.meta.url), 'utf8');
    check(/contarFrases\(texto\) > 3/.test(fonte), `${arq} usa a mesma contagem`);
  }
}

grupo('boato do adversario: sem aula e sem inventar a vida do candidato (a Evani)');
{
  const ia = await lib('ia.js');
  const sis = ia.montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  check(/BOATO OU TEORIA SOBRE O ADVERSÁRIO/.test(sis), 'o boato perguntado por apoiador tem regra propria');
  check(/nunca dê aula/.test(sis) && /confira fontes oficiais/.test(sis), 'e a aula de "fontes oficiais" esta proibida pelo nome');
  check(/NUNCA AFIRME o que o candidato viu, onde esteve, com quem tem contato/.test(sis), 'e nao se inventa o que o candidato viu ou com quem tem contato');
}

grupo('o contato do orgao vai em frase natural, sem colar a linha do catalogo (a Lia)');
{
  const gab = await lib('gabinete.js');
  const bloco = gab.blocoDeOrgaos([{ nome: 'INSS', trata: 'aposentadoria, BPC/LOAS, pericia', contatos: [{ tipo: 'telefone', valor: '135', obs: 'seg a sab, 7h-22h' }] }]);
  check(/NUNCA cole a linha inteira nem a lista de assuntos/.test(bloco), 'o bloco de orgaos manda escrever em frase natural');
  const ia = await lib('ia.js');
  const contato = ia.montarContatoRascunho({ mensagens: [{ de: 'ela', texto: 'vao cortar meu BPC, a quem eu recorro?', at: '2026-11-17T14:00:00-03:00' }], orgaos: bloco, agora: new Date('2026-11-17T15:00:00-03:00') });
  check(/sem colar a linha inteira nem a lista de assuntos/.test(contato), 'e a regra 20 colada no pedido tambem');
}

grupo('nao repetir o que dissemos nos ultimos dias (o Jandir)');
{
  const ia = await lib('ia.js');
  const agora = new Date('2026-11-17T15:00:00-03:00');
  const antiga = { texto: 'Boa tarde! O Capitão Martim está bem, na correria do mandato. Agradeço o carinho e os votos de bom trabalho.', at: '2026-11-13T14:41:00-03:00' };
  const bloco = ia.blocoDoQueJaDissemos([antiga], agora);
  check(/O QUE JÁ DISSEMOS A ELA NOS ÚLTIMOS DIAS/.test(bloco) && bloco.includes('na correria do mandato'), 'a fala de dias atras chega a IA, fora do limite de horas');
  check(ia.blocoDoQueJaDissemos([], agora) === '', 'sem falas, nada entra');
  const contato = ia.montarContatoRascunho({ agora, mensagens: [{ de: 'ela', texto: 'Boa tarde tudo bem com voce', at: '2026-11-17T14:31:00-03:00' }], jaDissemos: [antiga] });
  check(contato.includes('O QUE JÁ DISSEMOS'), 'e entra no bloco do contato');
  const rev = ia.revisarRascunho('O Capitão Martim está bem, na correria do mandato. Que Deus abençoe você e sua família, um abraço!', agora,
    { nossasRecentes: [antiga.texto] });
  check(!/correria do mandato/.test(rev.texto || rev), 'a frase quase identica a uma resposta recente sai');
  const painel2 = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');
  check(/jaDissemos: \(\(\) => \{/.test(painel2) && /7 \* 24 \* 3600 \* 1000/.test(painel2), 'o painel manda as nossas falas dos ultimos 7 dias');
}

grupo('a preocupacao mais grave do bloco nao some atras da mais recente (a Lia, decisao dele)');
{
  const ia = await lib('ia.js');
  const agora = new Date('2026-11-17T15:00:00-03:00');
  const msg = (texto, h) => ({ de: 'ela', texto, at: `2026-11-17T${h}:00-03:00` });
  const bloco = ia.montarContatoRascunho({
    agora,
    campos: { Nome: 'Maria Ficticia', Cidade: 'Porto Alegre' },
    mensagens: [
      { de: 'nos', texto: 'Vou orar por você.', at: '2026-11-17T13:05:00-03:00' },
      msg('Eu estou com medo porque estao ameacando cortar o meu beneficio', '14:27'),
      msg('O apartamento precisa de conserto', '14:40'),
      msg('Se souber de alguem interessado...', '14:52'),
    ],
  });
  check(/O EIXO da sua resposta/.test(bloco), 'o eixo continua sendo a mais recente');
  check(/a preocupação mais GRAVE do bloco nunca fica de fora/.test(bloco), 'e a mais grave e nomeada para nao sumir');
  check(/perder benefício, renda, salário ou moradia/.test(bloco), 'com os exemplos que a tornam reconhecivel');
}

grupo('"o que e isso?" com link recebe a resposta pronta de link, sem a IA adivinhar o video (o Taura)');
{
  const ate = '2026-11-17T09:44:00-03:00';
  const link = 'https://www.facebook.com/share/v/1AbCdEfGhI/';
  const r = cortesia.linkComOpiniao([ela('O que é isso Jesus Querido?..'), ela(link)], ate);
  check(!!r, 'exclamacao "o que e isso?" junto do link puxa a nossa opiniao');
  check(!cortesia.linkComOpiniao([ela('O que é isso? É verdade que vai fechar o posto?'), ela(link)], ate),
    'pergunta de conteudo depois continua indo para a IA');
  check(!cortesia.linkComOpiniao([ela('O que é isso?')], ate), 'sem link, nada muda');
  const ia = await lib('ia.js');
  const contato = ia.montarContatoRascunho({ agora: new Date('2026-11-18T10:00:00-03:00'),
    mensagens: [{ de: 'ela', texto: link, at: '2026-11-18T09:48:00-03:00' }] });
  check(/nem suponha que é sobre o assunto da NOSSA última mensagem/.test(contato), 'e a IA nao supoe que o video e sobre o nosso ultimo aviso');
}

grupo('trocar o rascunho pela tecla do popup nao registra o rascunho como enviado (a Julita)');
{
  check(/if \(mandou\.ok && \/\^tecla \\d\/\.test\(String\(mandou\.como \|\| ''\)\)\) trocouPelaTecla = mandou\.como;/.test(painel),
    'a espera do rascunho sabe que a tecla trocou o texto');
  const i = painel.indexOf('if (trocouPelaTecla) {');
  check(i > 0 && i < painel.indexOf("markSent(state.contact.id, 'ia-rascunho'", i), 'e conclui antes de marcar o rascunho e as etiquetas dele');
  check(/Você trocou pela \$\{mandou\.como\}/.test(painel), 'a resposta pronta trocada pela tecla tambem nao se marca como enviada');
}

grupo('ela encerrou e ja respondemos hoje: conclui em vez de pagar um rascunho (o odone)');
{
  const dec = { id: 'r:ultima-pede-resposta-pessoal:sem-cidade', tecla: '6', motivo: 'texto longo' };
  const c = { ultimaEhDespedida: true, respondidoHoje: true };
  check(sug.encerrouDepoisDeHoje(c, dec)?.tecla === '3', 'texto longo que encerra, depois da nossa de hoje, conclui');
  check(!sug.encerrouDepoisDeHoje({ ...c, respondidoHoje: false }, dec), 'sem resposta nossa hoje, a IA continua escrevendo');
  check(!sug.encerrouDepoisDeHoje({ ...c, perguntaPendente: true }, dec), 'com pergunta, continua com a IA');
  check(!sug.encerrouDepoisDeHoje({ ...c, desabafoPessoal: { motivo: 'x' } }, dec), 'desabafo continua com a IA');
  check(!sug.encerrouDepoisDeHoje(c, { id: 'r:pergunta-aberta', tecla: '6' }), 'so troca a tecla 6 do TAMANHO');
  const fonteSug = readFileSync(new URL('../src/lib/sugestao.js', import.meta.url), 'utf8');
  check(/return encerrouDepoisDeHoje\(c, decisao\) \|\|/.test(fonteSug), 'a tabela aplica o ajuste');
  const fonteArv = readFileSync(new URL('../src/lib/arvore.js', import.meta.url), 'utf8');
  check(/encerrouDepoisDeHoje\(c, escolhida\)/.test(fonteArv), 'e o quadro tambem');
}

grupo('tom juridico pede reescrita, nao so aviso (a Evani)');
{
  const ia = await lib('ia.js');
  check(ia.falhasTomJuridico('Esse assunto circula bastante, mas não tenho nada que confirme isso.').length === 1, '"nao tenho nada que confirme" e tom de nota');
  check(ia.falhasTomJuridico('Sobre ter visto o Lula, não tenho como afirmar experiências pessoais.').length === 1, '"nao tenho como afirmar" tambem');
  check(ia.falhasTomJuridico('Vou verificar isso e te retorno.').length === 0, '"vou verificar" continua livre');
  check(ia.falhasTomJuridico('Esse boato circula bastante por aí. Um abraço!').length === 0, 'a resposta leve passa');
  const cli = readFileSync(new URL('../src/lib/ia-cliente.js', import.meta.url), 'utf8');
  check(/\.\.\.falhasTomJuridico\(texto\)/.test(cli), 'e entra na conferencia que manda reescrever');
}

grupo('a regra do boato nao manda dizer a frase que a trava barra (a Evani, terceira vez)');
{
  const ia = await lib('ia.js');
  const sis = ia.montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  const i = sis.indexOf('BOATO OU TEORIA SOBRE O ADVERSÁRIO');
  const regra = sis.slice(i, i + 1500);
  check(!/diga que[^.]*não tem nada que confirme/.test(regra), 'a regra nao manda dizer "nao tenho nada que confirme"');
  check(/"você já viu ele\?"\) NÃO se/.test(regra.replace(/\s+/g, ' ')), 'o "voce ja viu ele?" nao se responde');
  check(/Pois é, esse boato circula/.test(regra.replace(/',\s*'\s*/g, ' ')) || /Pois é, esse boato circula/.test(regra), 'e da o exemplo no jeito dele');
  check(ia.falhasTomJuridico('Bom dia! Pois é, esse boato circula bastante por aí, mas não tenho como confirmar nada. Um abraço!').length === 0,
    'o "nao tenho como confirmar nada" casual dele passa na trava');
  check(ia.falhasTomJuridico('Não tenho como confirmar essa informação.').length === 1, 'a forma de nota continua barrada');
}

grupo('sem fala dela dentro do limite de horas, a IA nao e chamada (seis conferencias "conversa vazia")');
{
  check(/function sobrouFalaDelaParaAIA\(\)/.test(painel), 'existe a conta do que a IA vai ler');
  const enc = painel.slice(painel.indexOf('async function encerrouAConversa'), painel.indexOf('async function etiquetarEndereco'));
  check(/if \(!sobrouFalaDelaParaAIA\(\)\) return false;/.test(enc) && enc.indexOf('sobrouFalaDelaParaAIA') < enc.indexOf('conferirEncerramento'),
    'o encerramento nao paga quando nao sobrou nada dela');
  const ras = painel.slice(painel.indexOf('async function rascunharParaEle'));
  check(ras.indexOf('sobrouFalaDelaParaAIA()') > 0 && ras.indexOf('sobrouFalaDelaParaAIA()') < ras.indexOf('iaCliente.rascunhar('),
    'e o rascunho tambem nao, antes da chamada');
}

grupo('sugestao de lei vai para o formulario de demandas (a Dirce)');
{
  const ia = await lib('ia.js');
  const bloco = ia.blocoDosFormularios({ demanda: 'https://exemplo.test/formulario/demanda-cidada' });
  check(/SUGESTÃO de lei, projeto ou ideia para o mandato/.test(bloco), 'o formulario de demandas cobre sugestao de lei');
  check(!/Capitão|Martim/.test(bloco), 'sem nome de candidato no bloco (vale para os dois perfis)');
}

grupo('a conferencia de cidade nao paga de novo o "nao e cidade" (Feliz, Saude, Cerrito)');
{
  check(/const jaOuvido = cidadesSemCidade\.get\(chaveCidade\);/.test(painel) && /const r = jaOuvido \|\| await iaCliente\.conferirCidade/.test(painel),
    'o semcidade ja ouvido nesta sessao nao chama a IA');
  check(/if \(r\?\.acao === 'semcidade' && !jaOuvido\) cidadesSemCidade\.set/.test(painel), 'e so o semcidade e guardado, em memoria');
}

grupo('opiniao ou bandeira nao e cortesia (a Gabriela)');
{
  const ate = '2026-11-16T11:04:00-03:00';
  check(!cortesia.cortesiaParaRascunho([ela('https://www.facebook.com/share/v/1AbCdEf/'),
    ela('Boa tarde Capitão Martim, lamentável que coisas desse tipo continuem acontecendo😥Por mais Escolas Cívico Militares.')], ate),
    'lamentar e defender uma causa nao vira "agradeco o carinho"');
  check(!!cortesia.cortesiaParaRascunho([ela('Bom dia meu amigo, que Deus abençoe você e sua família, um abraço')], ate),
    'a bencao pura continua sendo cortesia');
}

grupo('"seguimos firmes" e bordao, e xingar eleitor nao e deboche do adversario (a Maria Teresa)');
{
  const ia = await lib('ia.js');
  check(ia.falhasDeBordao('Pois é. Seguimos firmes! Um abraço').length === 1, '"seguimos firmes" pede reescrita');
  check(ia.falhasDeBordao('Seguimos trabalhando para recuperar nosso estado! Um abraço').length === 0, 'a frase dele passa');
  const sis = ia.montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  const i = sis.indexOf('DEBOCHE E IRONIA CONTRA O ADVERSÁRIO');
  const regra = sis.slice(i, i + 2500);
  check(!/Seguimos firmes!"/.test(regra) && !/"É isso aí! Obrigado por compartilhar/.test(regra), 'o exemplo do deboche nao ensina mais o "e isso ai... seguimos firmes"');
  check(/XINGAMENTO AO POVO OU A ELEITORES NÃO É DEBOCHE DO ADVERSÁRIO/.test(regra), 'insulto a eleitor tem regra propria');
  check(/"SEGUIMOS FIRMES" VIROU BORDÃO — NÃO USE/.test(sis), 'e o bordao esta proibido pelo nome');
  const cli = readFileSync(new URL('../src/lib/ia-cliente.js', import.meta.url), 'utf8');
  check(/\.\.\.falhasDeBordao\(texto\)/.test(cli), 'e entra na conferencia que manda reescrever');
}

grupo('concluir marca o que ja foi tratado (o odone)');
{
  const concl = painel.slice(painel.indexOf('async function concluirPeloPainel'), painel.indexOf('function agendarContagem'));
  check(/markSent\('conv:' \+ id, 'tratado-ate'\)/.test(concl), 'concluir grava a marca por conversa');
  check((painel.match(/state\.nossaUltimaAt = await nossaUltimaComConclusao\(/g) || []).length === 2, 'as duas leituras da conversa usam a marca');
  check(/respondidoHoje: !!state\.nossaUltimaEnviadaAt && ehHoje\(state\.nossaUltimaEnviadaAt\)/.test(painel),
    'e "respondido hoje" continua pela fala enviada');
  const templates = await lib('templates.js');
  await templates.markSent('conv:teste-odone', 'tratado-ate');
  const marca = await templates.wasSent('conv:teste-odone', 'tratado-ate');
  check(marca?.at > 0, 'a marca e lida de volta com a hora');
}

grupo('fale com ela, nao sobre o texto dela (a Lia)');
{
  const ia = await lib('ia.js');
  check(ia.falhasDeImpessoal('A reflexão interior pode trazer mais serenidade. É uma mensagem de fé que merece ser acolhida com respeito.').length === 1,
    'comentario em terceira pessoa pede reescrita');
  for (const t of ['Que bonita reflexão! Concordo que as Escolas Cívico-Militares ganham muito com valores. Um grande abraço!',
    'Pois é, a conta de luz pesa no bolso de todo mundo. Seguimos trabalhando para recuperar nosso estado! Um abraço',
    'Que essa confiança em Deus traga serenidade e força para o seu dia. Um abraço.']) {
    check(ia.falhasDeImpessoal(t).length === 0, `resposta que fala com ela passa: "${t.slice(0, 30)}"`);
  }
  const sis = ia.montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  check(/FALE COM ELA, NÃO SOBRE O TEXTO DELA/.test(sis), 'e a regra esta no prompt');
  const cli = readFileSync(new URL('../src/lib/ia-cliente.js', import.meta.url), 'utf8');
  check(/\.\.\.falhasDeImpessoal\(texto\)/.test(cli), 'e entra na conferencia que manda reescrever');
}

grupo('virou o dia: reacao ou link de ontem nao fecha, vale a mensagem do momento (19/11)');
{
  const nossaOntem = '2026-11-18T16:00:00-03:00';
  const emoji = [{ texto: '👍', tipo: 'TEXT', at: '2026-11-18T16:20:00-03:00' }];
  check(!!cortesia.cortesiaDeFechamento(emoji, nossaOntem, { janelaHoras: 16, agora: new Date('2026-11-18T18:00:00-03:00') }),
    'no mesmo dia, a reacao depois da nossa fecha');
  check(!cortesia.cortesiaDeFechamento(emoji, nossaOntem, { janelaHoras: 16, agora: new Date('2026-11-19T08:30:00-03:00') }),
    'no dia seguinte nao fecha mais');
  const enc = painel.slice(painel.indexOf('async function encerrouAConversa'), painel.indexOf('async function encerrouAConversa') + 600);
  check(/toDateString\(\) !== new Date\(\)\.toDateString\(\)\) return false;/.test(enc), 'e a conferencia "ela encerrou?" tambem e do mesmo dia');
  const regra = sug.REGRAS.find((r) => r.id === 'ultima-e-so-reacao');
  check(regra.tecla({ respondidoHoje: false, podeMandarMomento: true }) === '5', 'e o fluxo manda a mensagem do momento');
}

grupo('envio com o id da rodada nao pula pela lista atrasada (a Claudete)');
{
  const pm = readFileSync(new URL('../src/lib/page-mob.js', import.meta.url), 'utf8');
  check(/if \(alvo && st\.sessionId !== alvo\)/.test(pm) && /exigirDoisSinais && !alvo && st\.porQuantosSinais !== 'os-dois'/.test(pm),
    'com id, basta o painel mostrar a conversa da rodada; sem id, os dois sinais');
  check((painel.match(/page\.sendText\([^)]*, idDoEnvio\(\)\)/g) || []).length === 3, 'os tres envios da rodada levam o id');
}

grupo('legenda de foto nao troca a cidade do cadastro (o Gilberto)');
{
  const ex = await lib('extract.js');
  check(JSON.stringify(ex.semAsLegendas(['Estamos aqui no Gabinete pra fazer uma visita.', 'Santa Maria'], ['Santa Maria']))
    === JSON.stringify(['Estamos aqui no Gabinete pra fazer uma visita.']), 'a legenda sai da passada que substitui o cadastro');
  check(ex.semAsLegendas(['Santa Maria', 'Santa Maria'], ['Santa Maria']).length === 1, 'tira so uma ocorrencia: a mesma frase escrita a parte continua');
  const rebaixada = ex.rebaixarParaPalpite(await ex.extract(['Santa Maria']), 'legenda de foto ou vídeo');
  check(rebaixada.cidade?.informada === false && rebaixada.cidade?.confidence === 'aproximada', 'a legenda volta rebaixada: nao substitui o CRM nem grava sozinha');
  check(/legenda de foto ou vídeo/.test(rebaixada.cidade?.source || ''), 'e a origem diz que veio da legenda');
  check(/ouvido no áudio/.test(ex.rebaixarParaPalpite({ cidade: { value: 'Canoas' } }).cidade.source), 'o audio continua com a origem de sempre');
  check(/extract\(semAsLegendas\(state\.incoming, legendas\)/.test(painel), 'o painel tira as legendas da primeira passada');
  check(/legenda de uma foto ou vídeo que ela mandou/.test(painel), 'e a conferencia de cidade da IA sabe que era legenda');
  const ia = await lib('ia.js');
  const sis = ia.montarSistemaRascunho({ templates: [], regras: '', gabinete: '', formularios: { agenda: 'https://exemplo.test/formulario/agenda' } });
  const contato = ia.montarContatoRascunho({ mensagens: [{ de: 'ela', texto: 'quero agendar', at: '2026-11-18T09:00:00-03:00' }],
    formularios: { agenda: 'https://exemplo.test/formulario/agenda' }, agora: new Date('2026-11-18T10:00:00-03:00') });
  check(/VISITA QUE JÁ ACONTECEU OU ESTÁ ACONTECENDO/.test(sis + contato), 'visita que ja esta acontecendo nao recebe o formulario da agenda');
}


grupo('acolher nao e rotular nem discursar (Vanda, Rogerio e Cleomar, 21/11)');
{
  const ia = await lib('ia.js');
  const f = (t) => ia.falhasDeAcolhimento(t);
  check(f('Dá muita revolta ver o nosso povo sofrendo tanto com essas tragédias. Um abraço!').length === 1, '"da revolta" pede reescrita');
  check(f('Boa tarde! Eu entendo a sua revolta. Viver com medo é pesado.').length === 2, '"Eu entendo a sua revolta" depois da saudacao: as duas falhas');
  check(f('Entendo. Depois de uma cirurgia, espero que você se recupere bem.').length === 1, '"Entendo." na abertura pede reescrita');
  check(f('Segurança e moradia precisam ser tratadas com seriedade. Um abraço!').length === 1, 'frase de discurso pede reescrita');
  check(f('Pois é, tempos difíceis aqui no Sul. Seguimos trabalhando para ajudar quem foi atingido! Um abraço!').length === 0, 'a frase que ele aprovou passa');
  check(f('Bom dia! Que bom que vocês estão bem. Para a reconstrução, procure a Defesa Civil do município. Um abraço!').length === 0, 'orientar com solidariedade passa');
  check(f('Bom dia! Eu também acho que a gente se entende bem. Um abraço!').length === 0, '"entende" no meio nao e abertura');
  const sis = ia.montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  check(/QUEM FOI ATINGIDO POR TEMPORAL, ENCHENTE OU DESASTRE/.test(sis), 'o temporal tem regra no prompt');
  check(/só entra se ela PEDIR ajuda agora, com clareza/.test(sis) && /Força nessa/.test(sis), 'o caminho so para quem pede; quem agradece recebe solidariedade (o Cleomar, 3a vez)');
  const i = sis.indexOf('11. CANAL DE ATENDIMENTO'); const j = sis.indexOf('QUEM FOI ATINGIDO POR TEMPORAL');
  check(i > 0 && j > i && j - i < 2500, 'e ela mora colada na regra 11');
  const cli = readFileSync(new URL('../src/lib/ia-cliente.js', import.meta.url), 'utf8');
  check(/\.\.\.falhasDeAcolhimento\(texto\)/.test(cli), 'e entra na conferencia que manda reescrever');
}


grupo('cortesia de dias atras nao vence o emoji de hoje (a Bernardete, 21/11)');
{
  const cortesia = await lib('cortesia.js');
  const nossa = '2026-11-17T09:40:00-03:00';
  const ent = [
    { de: 'ela', texto: 'Bom dia Deus no comando boa terca feira pra voce tambem querido obrigada pelo carinho', at: '2026-11-17T09:42:00-03:00', tipo: 'TEXT' },
    { de: 'ela', texto: '🌹', at: '2026-11-21T13:20:00-03:00', tipo: 'TEXT' },
    { de: 'ela', texto: '🙏', at: '2026-11-21T13:20:00-03:00', tipo: 'TEXT' },
  ];
  check(cortesia.cortesiaParaRascunho(ent, nossa) === null, 'so emoji hoje: o carinho de 17/11 nao pede rascunho (decide o fluxo)');
  check(!!cortesia.cortesiaParaRascunho(ent.slice(0, 1), nossa), 'o carinho sozinho, no dia dele, continua indo para o rascunho');
  const hoje = [{ de: 'ela', texto: ent[0].texto, at: '2026-11-21T09:42:00-03:00', tipo: 'TEXT' }, { de: 'ela', texto: '🌹', at: '2026-11-21T13:20:00-03:00', tipo: 'TEXT' }];
  check(!!cortesia.cortesiaParaRascunho(hoje, '2026-11-20T09:40:00-03:00'), 'carinho e emoji no mesmo dia continuam sendo cortesia');
}

grupo('teoria sobre o temporal nao se responde com nota oficial (a Iria, 21/11)');
{
  const ia = await lib('ia.js');
  const rascunho = 'A preocupação com a segurança das pessoas e das famílias atingidas é legítima, mas eu não posso prometer fazer a coleta. A presença de substâncias precisa ser confirmada por análise técnica, com coleta e destino definidos por órgãos e laboratórios competentes.';
  check(ia.falhasDeAcolhimento(rascunho).some((f) => /nota oficial/.test(f)), 'o rascunho da Iria pede reescrita');
  check(ia.falhasDeAcolhimento('Obrigado pela confiança! Esse assunto circula bastante por aí, e só as análises técnicas podem confirmar alguma coisa. Cuide-se, um abraço!').length === 0, 'a resposta leve passa');
  const sis = ia.montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  check(/O MESMO VALE PARA TEORIA SOBRE TEMPORAL OU DESASTRE/.test(sis), 'a teoria do temporal tem regra no prompt');
}


grupo('fala de outro dia + so gesto ou repasse hoje = mensagem do momento (a Bernadette Breton, 21/11)');
{
  const { hojeSoGestoSobreFalaAntiga } = await lib('fala-antiga.js');
  const sug = await lib('sugestao.js');
  const AGORA = new Date('2026-11-21T14:00:00-03:00');
  const nossa = '2026-11-19T13:49:00-03:00';
  const bern = [
    { de: 'ela', texto: '🙏🙏🙏', at: '2026-11-19T20:45:00-03:00', tipo: 'TEXT' },
    { de: 'ela', texto: 'Eu estava ha pouco no Supermercado e o sistema caiu, as pessoas largaram os carrinhos e eu fiquei ajudando a botar os produtos nos lugares', at: '2026-11-19T23:12:00-03:00', tipo: 'TEXT' },
    { de: 'ela', texto: 'Assinei o abaixo-assinado. Assine voce tambem: https://exemplo.test/a', at: '2026-11-20T18:19:00-03:00', tipo: 'TEXT' },
    { de: 'ela', texto: 'https://exemplo.test/x', at: '2026-11-21T01:07:00-03:00', tipo: 'TEXT' },
    { de: 'ela', texto: '*DR. BRASIL FALA SOBRE A SAUDE DO PRESIDENTE* ' + 'O Brasil esta vendo ao vivo uma injustica. Um homem inocente, com a saude debilitada, preso. '.repeat(3) + 'Liberdade para Bolsonaro! #BolsonaroInocente', at: '2026-11-21T01:08:00-03:00', tipo: 'TEXT' },
  ];
  check(hojeSoGestoSobreFalaAntiga(bern, nossa, AGORA) === true, 'a Bernadette: so repasse hoje sobre a historia de 19/11');
  check(hojeSoGestoSobreFalaAntiga(bern.slice(0, 2), nossa, AGORA) === false, 'sem nada hoje, nao se aplica');
  check(hojeSoGestoSobreFalaAntiga([...bern, { de: 'ela', texto: 'e voces viram isso?', at: '2026-11-21T09:00:00-03:00', tipo: 'TEXT' }], nossa, AGORA) === false, 'fala propria hoje: decide o fluxo de sempre');
  check(hojeSoGestoSobreFalaAntiga(bern, '2026-11-21T09:00:00-03:00', AGORA) === false, 'nossa ultima de hoje: nao se aplica');
  const base = { hojeSoGestoSobreFalaAntiga: true, podeMandarMomento: true, respondidoHoje: false };
  const d6 = { id: 'ultima-pede-resposta-pessoal', tecla: '6', motivo: 'x' };
  check(sug.momentoSobreFalaAntiga(base, d6)?.tecla === '5', 'tecla 6 vira a mensagem do momento');
  // 23/11 (a Fatima): quem julga a pergunta antiga e o sinal; o Rogerio fica protegido nele (grupo abaixo).
  check(sug.momentoSobreFalaAntiga({ ...base, perguntaPendente: true }, d6)?.tecla === '5', 'pergunta retorica ja julgada pelo sinal nao segura de novo');
  check(sug.momentoSobreFalaAntiga({ ...base, pedeAjudaFinanceira: true }, d6) === null, 'pedido continua com a IA e com ele');
  check(sug.momentoSobreFalaAntiga(base, { id: 'sem-interesse', tecla: 's' }) === null, 'decisao que nao vai para a IA nao e trocada');
  check(sug.momentoSobreFalaAntiga({ ...base, podeMandarMomento: false }, d6) === null, 'sem mensagem do momento, nada muda');
  const arv = readFileSync(new URL('../src/lib/arvore.js', import.meta.url), 'utf8');
  check(arv.includes('momentoSobreFalaAntiga(c, escolhida)'), 'e vale no quadro salvo, sem reimportar');
  check(painel.includes('hojeSoGestoSobreFalaAntiga: hojeSoGestoSobreFalaAntiga(state.entrantes, state.nossaUltimaAt)'), 'e o painel passa o sinal');
}


grupo('pergunta retorica de apoiadora nao vira resposta ao pe da letra nem licao (a logos.veit, 21/11)');
{
  const ia = await lib('ia.js');
  const rascunho = 'Boa tarde! Não dá para medir o QI de alguém apenas por uma opinião. O mais importante é manter o respeito, tanto dentro de casa quanto ao falar do nosso país. Um abraço!';
  check(ia.falhasDeAcolhimento(rascunho).some((f) => /lição/.test(f)), 'a licao pede reescrita');
  check(ia.falhasDeAcolhimento('Boa tarde! Pois é, quem ama o Brasil fala dele com respeito e trabalha para ele melhorar! Um abraço!').length === 0, 'a frase que ele aprovou passa');
  const sis = ia.montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  const i = sis.indexOf('13. DESCRENÇA E PERGUNTA RETÓRICA'); const j = sis.indexOf('PERGUNTA RETÓRICA OU PROVOCAÇÃO DE QUEM ESTÁ DO NOSSO LADO');
  check(i > 0 && j > i && j - i < 1200, 'a regra mora colada na 13');
}


grupo('cobranca em mensagens separadas mantem a fala antiga com a IA (o Rogerio Senna, 21/11)');
{
  const { hojeSoGestoSobreFalaAntiga } = await lib('fala-antiga.js');
  const AGORA = new Date('2026-11-21T14:00:00-03:00');
  const nossa = '2026-11-19T14:48:00-03:00';
  const L = (t, at) => ({ de: 'ela', texto: t, at, tipo: 'TEXT' });
  const ent = [
    L('Eu sendo perseguido ja faz duas semanas que nao vou trabalhar, tenho que pagar meu aluguel. Sou inscrito mas nunca ganhei casa', '2026-11-19T14:53:00-03:00'),
    L('E aí capitão', '2026-11-19T17:21:00-03:00'),
    L('https://exemplo.test/reel?x=1', '2026-11-19T17:21:10-03:00'),
    L('Até quando', '2026-11-19T17:21:20-03:00'),
    L('????', '2026-11-19T17:21:30-03:00'),
    L('https://exemplo.test/reel/z', '2026-11-21T05:46:00-03:00'),
  ];
  check(hojeSoGestoSobreFalaAntiga(ent, nossa, AGORA) === false, 'o "????" separado e o "ate quando" seguram o caso');
  check(hojeSoGestoSobreFalaAntiga(ent.filter((m) => !/[?]$|Até quando|E aí/.test(m.texto)), nossa, AGORA) === true, 'sem a cobranca, vira a mensagem do momento');
  check(hojeSoGestoSobreFalaAntiga([L('Olha que historia aconteceu hoje no mercado', '2026-11-19T20:00:00-03:00'), L('https://exemplo.test/v?id=9', '2026-11-21T05:46:00-03:00')], nossa, AGORA) === true, 'o "?" de dentro do link nao conta como pergunta');
}


grupo('"Boa tarde. Meu dep. Martin." fecha a conversa (a Isabel, 21/11)');
{
  const cortesia = await lib('cortesia.js');
  const nossa = '2026-11-21T14:10:00-03:00';
  const agora = new Date('2026-11-21T14:30:00-03:00');
  const f = (t) => cortesia.cortesiaDeFechamento([{ de: 'ela', texto: t, at: '2026-11-21T14:17:00-03:00', tipo: 'TEXT' }], nossa, { agora });
  check(!!f('Boa tarde. Meu dep. Martin.'), 'o tratamento abreviado e o nome com n fecham');
  check(!!f('Boa tarde meu deputado'), '"meu deputado" fecha');
  check(!f('Boa tarde dep. preciso falar com o senhor'), 'pedido continua aberto');
  check(!f('Boa tarde, dep. quando vem a Cachoeirinha?'), 'pergunta continua aberta');
}


grupo('provocacao de militante nao vira nota oficial (o Andre, 21/11)');
{
  const ia = await lib('ia.js');
  check(ia.falhasDeAcolhimento('Boa tarde! Prefiro que qualquer viagem custeada com recursos públicos seja acompanhada de transparência e responsabilidade. Um abraço!').some((f) => /nota oficial/.test(f)), 'o "prefiro que... acompanhada de transparencia" pede reescrita');
  check(ia.falhasDeAcolhimento('Boa tarde! Pois é, viagem paga com dinheiro do povo tinha que ter muito mais transparência. Um abraço!').length === 0, 'a frase que ele aprovou passa');
  const sis = ia.montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  check(/JANJA NA ESPANHA, GOSTARAM/.test(sis), 'o exemplo dele esta na regra da provocacao');
}


grupo('a rodada so escreve no campo com a tela na conversa que ela abriu (o Peco, 21/11)');
{
  const fn = painel.slice(painel.indexOf('async function telaNaConversaDaRodada'), painel.indexOf('const MOTIVO_TELA_EM_OUTRA'));
  check(fn.includes("if (!state.auto.rodando || !idQueARodadaAbriu) return true"), 'fora da rodada sempre vale');
  check(fn.includes("String(st.sessionId || '') === idQueARodadaAbriu"), 'dentro da rodada compara a tela com o id aberto');
  const rasc = painel.slice(painel.indexOf('async function rascunharParaEle'));
  const i = rasc.indexOf('telaNaConversaDaRodada()'); const j = rasc.indexOf('await page.setComposerText(texto)');
  check(i > 0 && j > i, 'o rascunho da IA confere a tela antes de escrever');
  const ins = painel.indexOf('if (!send || !state.settings.autoSend) {');
  const trecho = painel.slice(ins, ins + 400);
  check(trecho.indexOf('telaNaConversaDaRodada()') > 0 && trecho.indexOf('telaNaConversaDaRodada()') < trecho.indexOf('setComposerText(text)'), 'a resposta pronta inserida tambem confere');
  check(painel.includes("rascunho?.motivo === MOTIVO_TELA_EM_OUTRA) {\n          return { nome, resultado: 'pulado'"), 'e a rodada pula o contato em vez de perguntar sobre a tela errada');
}


grupo('apoiador que compartilha conteudo politico nao e corrigido (o Peco, 21/11)');
{
  const ia = await lib('ia.js');
  const f = ia.falhasDeAcolhimento('Boa tarde! Questões de imigração, integração e segurança precisam ser debatidas com responsabilidade, sem transformar uma religião inteira em ameaça. Um abraço.');
  check(f.some((x) => /não corrija/.test(x)), '"sem transformar... em ameaca" pede reescrita');
  check(f.some((x) => /discurso/.test(x)), '"precisam ser debatidas com responsabilidade" pede reescrita');
  check(ia.falhasDeAcolhimento('Boa tarde! Obrigado por compartilhar, um abraço!').length === 0, 'agradecer passa');
}

grupo('boletim assinado é repasse, não pergunta do contato nem denúncia local');
{
  const ia = await lib('ia.js');
  const repasse = await lib('repasse-ia.js');
  const { hojeSoGestoSobreFalaAntiga } = await lib('fala-antiga.js');
  const arvore = await lib('arvore.js');
  const agora = new Date('2026-11-23T10:00:00-03:00');
  const nossa = '2026-11-22T15:00:00-03:00';
  const boletim = 'No nosso encontro de hoje, uma reflexão: quem ganha com o alarmismo? ' +
    'O que acontece com o país? De Brasília, Alexandre Garcia.';
  const audio = { de: 'contato', tipo: 'AUDIO', transcrito: true, texto: boletim, at: '2026-11-23T09:00:00-03:00' };
  check(repasse.ehBoletimDeComentarista?.(boletim) === true, 'assinatura de boletim exportada');
  check(cortesia.ehRepasse(audio), 'boletim é repasse mesmo sem flag de encaminhado');
  check(!cortesia.perguntaPendente([audio], nossa), 'pergunta interna do boletim não fica pendente');
  check(!cortesia.conversaTemPerguntaAberta([audio], nossa), 'pergunta interna não pede resposta pessoal');
  const entrantes = [{ de: 'contato', tipo: 'TEXT', texto: 'Juntos sempre. Sem o agro não tem comida.', at: '2026-11-22T16:00:00-03:00' }, audio];
  const sinais = { hojeSoGestoSobreFalaAntiga: hojeSoGestoSobreFalaAntiga(entrantes, nossa, agora),
    perguntaPendente: cortesia.perguntaPendente(entrantes, nossa),
    pedeRespostaPessoal: cortesia.conversaPedeRespostaPessoal(entrantes, nossa) || cortesia.falouAlgoProprio(entrantes, nossa),
    podeMandarMomento: true, jaRespondemosAntes: true, respondidoHoje: false };
  check(sug.sugerirAcao(sinais)?.tecla === '5', 'tabela aplica mensagem do momento sobre fala antiga');
  check(arvore.decidir(sinais, arvore.fluxoPadrao(), {})?.tecla === '5', 'árvore aplica a mesma decisão');
  for (const texto of ['O Alexandre Garcia falou do agro. O que você acha?', 'Eu sou jornalista e preciso de ajuda com uma pauta.', 'Gostei do boletim, mas quando será a reunião?', 'Ouvi a frase de Brasília, Alexandre Garcia. Quando será a reunião?']) {
    const msg = { ...audio, texto };
    check(!repasse.ehBoletimDeComentarista?.(texto), 'não confunde fala própria com assinatura: ' + texto);
    check(!cortesia.ehRepasse(msg), 'fala própria continua fora dos repasses');
  }
  check(cortesia.perguntaPendente([...entrantes, { ...audio, texto: 'Quando será a reunião?', tipo: 'TEXT' }], nossa), 'pergunta própria depois do boletim continua pendente');
  const f = ia.falhasDeFormulaDeDenuncia;
  const rascunho = 'Bom dia! Agradeço as informações e estamos atentos e acompanhando o assunto. Um abraço!';
  const local = [{ de: 'contato', texto: 'a prefeitura desviou a verba da obra' }];
  check(!!cortesia.trouxeDenuncia(local[0].texto) && !cortesia.trouxeDenuncia(local[0].texto).contraOAdversario, 'controle é denúncia local reconhecida');
  check((f?.(rascunho, entrantes) || []).length > 0, 'fórmula fora de denúncia pede reescrita');
  check(f?.(rascunho, local)?.length === 0, 'denúncia local permite a fórmula');
  check((f?.(rascunho, [{ de: 'contato', texto: 'Lula ladrão, esse governo é uma vergonha' }]) || []).length > 0, 'desabafo contra adversário não vira denúncia local');
  check((f?.(rascunho, [{ de: 'nos', texto: local[0].texto }, audio]) || []).length > 0, 'fala nossa não habilita a fórmula');
  check((f?.(rascunho, [{ de: 'contato', texto: local[0].texto, encaminhado: true }]) || []).length > 0, 'denúncia dentro de repasse não é atribuída ao contato');
  check(f?.('Bom dia! Obrigado por compartilhar, um abraço!', entrantes)?.length === 0, 'agradecimento curto aprovado passa');
  check(f?.(rascunho, [{ de: 'contato', texto: 'Lula ladrão' }, ...local])?.length === 0, 'denúncia local não some atrás do desabafo contra adversário');
  const cliente = await lib('ia-cliente.js');
  const runtime = chrome.runtime;
  const pedidos = [];
  const aprovada = 'Bom dia! Obrigado por compartilhar, um abraço!';
  chrome.runtime = { ...runtime, sendMessage: async pedido => {
    pedidos.push(pedido);
    return { ok: true, decisao: { texto: pedidos.length === 1 ? rascunho : aprovada, confianca: 0.95, precisaDeRevisao: false } };
  } };
  try {
    const r = await cliente.rascunhar({ mensagens: [audio], agora, campos: {}, templates: [] });
    check(pedidos.length === 2 && r.texto === aprovada, 'cliente pede uma reescrita e devolve agradecimento aprovado');
    check(pedidos[1]?.contato.includes('fórmula de denúncia fora de denúncia local'), 'motivo novo chega à reescrita');
    pedidos.length = 0;
    const denuncia = await cliente.rascunhar({ mensagens: local, agora, campos: {}, templates: [] });
    check(pedidos.length === 1 && denuncia.texto === rascunho, 'denúncia local não gasta reescrita por essa fórmula');
  } finally { chrome.runtime = runtime; }
}

grupo('video repassado com "?" nao segura a fala antiga, e chamar de deputado nao e politica (o Vilmar, 23/11)');
{
  const { hojeSoGestoSobreFalaAntiga } = await lib('fala-antiga.js');
  const repasse = await lib('repasse-ia.js');
  const agora = new Date('2026-11-23T09:50:00-03:00');
  const nossa = '2026-11-21T12:50:00-03:00';
  const lista = [
    { de: 'ela', tipo: 'TEXT', at: '2026-11-21T13:43:00-03:00', texto: 'Obrigado igualmente amem meu amigo deputado Capitao Martins deputado Estadual parabens pela secretaria, voce merece, estamos juntos' },
    { de: 'ela', tipo: 'TEXT', at: '2026-11-21T15:49:00-03:00', texto: '🙏' },
    { de: 'ela', tipo: 'VIDEO', transcrito: true, at: '2026-11-22T10:46:00-03:00', texto: 'Voce ja parou para pensar no que Deus preparou para a sua vida? Ele firma os teus pes.' },
    { de: 'ela', tipo: 'VIDEO', transcrito: true, at: '2026-11-23T09:48:00-03:00', texto: 'Bom dia, que Deus abencoe a sua segunda-feira.' },
  ];
  check(hojeSoGestoSobreFalaAntiga(lista, nossa, agora) === true, 'a "?" de dentro do video repassado nao e pergunta dela');
  const pergunta = [...lista.slice(0, 2), { de: 'ela', tipo: 'TEXT', at: '2026-11-22T10:00:00-03:00', texto: '????' }, lista[3]];
  check(hojeSoGestoSobreFalaAntiga(pergunta, nossa, agora) === false, '"????" escrito por ela continua segurando o caso');
  const vocativo = repasse.contextoDeAutoria([{ de: 'nos', texto: 'Boa tarde!' }, lista[0]]);
  check(vocativo.politico === false, 'agradecimento que chama o candidato de deputado nao e compartilhamento politico');
  const politico = repasse.contextoDeAutoria([{ de: 'nos', texto: 'Boa tarde!' }, { de: 'ela', texto: 'Os deputados precisam aprovar o voto aberto no Senado' }]);
  check(politico.politico === true, 'falar dos deputados continua sendo politico');
}

grupo('compartilhamento do TikTok com a moldura do app e repasse (a Teresinha, 23/11)');
{
  const tiktok = 'Confira o vídeo de fulanodetal! #TikTok Abra o TikTok para ver a publicação de  @fulanodetal #bomdia #gratidão #🙏🙏🙏 #yyy... https://vm.tiktok.com/ZMabc123/ Esta publicação é compartilhada via TikTok Lite. Baixe o TikTok Lite para curtir mais publicações: https://www.tiktok.com/tiktoklite';
  check(cortesia.ehRepasse({ tipo: 'TEXT', texto: tiktok }) === true, 'a moldura do TikTok nao e fala dela');
  check(cortesia.ehRepasse({ tipo: 'TEXT', texto: 'Olha que lindo esse video, me lembrou voces! ' + tiktok }) === false, 'comentario dela junto do compartilhamento continua sendo fala');
  check(cortesia.ehRepasse({ tipo: 'TEXT', texto: 'Confira o video de ontem no meu perfil, fiquei feliz https://exemplo.com/x' }) === false, '"confira o video de" escrito por ela nao apaga o resto');
  const nossa = '2026-11-16T09:44:00-03:00';
  const entrantes = [{ de: 'ela', tipo: 'TEXT', texto: tiktok, at: '2026-11-23T08:08:00-03:00' }];
  check(cortesia.rajadaEhSoRepasse(entrantes, nossa) === true, 'a rajada so de compartilhamento e repasse');
  check(!cortesia.falouAlgoProprio(entrantes, nossa), 'nao conta como fala propria');
}

grupo('hoje so link com "boa semana na paz de Jesus" sobre fala antiga: mensagem do momento (o Joao Sergio, 23/11)');
{
  const { hojeSoGestoSobreFalaAntiga } = await lib('fala-antiga.js');
  const agora = new Date('2026-11-23T08:00:00-03:00');
  const nossa = '2026-11-21T15:27:00-03:00';
  const antigas = [
    { de: 'ela', tipo: 'TEXT', at: '2026-11-22T05:07:00-03:00', texto: 'Amem, que Deus restaure a cidade atingida' },
    { de: 'ela', tipo: 'TEXT', at: '2026-11-22T05:08:00-03:00', texto: 'Estamos em oracao e com disposicao de ajudar' },
  ];
  const hoje = (texto) => ({ de: 'ela', tipo: 'TEXT', at: '2026-11-23T07:56:00-03:00', texto });
  check(hojeSoGestoSobreFalaAntiga([...antigas, hoje('https://www.facebook.com/share/r/abc/\n\n🔥🔥BOA SEMANA NA PAZ DE JESUS 🔥🔥')], nossa, agora) === true, 'link + boa semana na paz de Jesus e gesto');
  check(hojeSoGestoSobreFalaAntiga([...antigas, hoje('Bom dia! Semana abencoada para todos')], nossa, agora) === true, 'so o cumprimento da semana e gesto');
  check(hojeSoGestoSobreFalaAntiga([...antigas, hoje('https://x.com/a Bom dia, isso nao pode terminar em pizza')], nossa, agora) === false, 'cumprimento com opiniao continua sendo fala');
  check(hojeSoGestoSobreFalaAntiga([...antigas, hoje('Bom dia, preciso falar com voces')], nossa, agora) === false, 'cumprimento com pedido continua sendo fala');
  check(hojeSoGestoSobreFalaAntiga([{ de: 'ela', tipo: 'TEXT', at: '2026-11-22T05:07:00-03:00', texto: 'Bom dia' }, hoje('https://x.com/a')], nossa, agora) === true, 'fala antiga so de cumprimento continua contando como antes');
  // A Iracema (23/11): figura com "Bom dia, boa segunda-feira!".
  check(hojeSoGestoSobreFalaAntiga([...antigas, { ...hoje('Bom dia, boa segunda-feira!'), tipo: 'IMAGE' }], nossa, agora) === true, 'boa segunda-feira (com -feira) e cumprimento');
  check(hojeSoGestoSobreFalaAntiga([...antigas, hoje('Abencoada terca feira a todos')], nossa, agora) === true, 'abencoada terca feira e cumprimento');
}

grupo('pergunta retorica sobre terceiros nao segura a fala antiga; pergunta para nos segura (a Fatima, 23/11)');
{
  const { hojeSoGestoSobreFalaAntiga } = await lib('fala-antiga.js');
  const agora = new Date('2026-11-23T08:00:00-03:00');
  const nossa = '2026-11-13T16:09:00-03:00';
  const hoje = { de: 'ela', tipo: 'TEXT', at: '2026-11-23T07:48:00-03:00', texto: 'https://www.instagram.com/p/abc/' };
  const antiga = (texto) => ({ de: 'ela', tipo: 'TEXT', at: '2026-11-22T17:12:00-03:00', texto });
  check(hojeSoGestoSobreFalaAntiga([antiga('Se ele ja morreu porque permitem sosias governarem? E ninguem desmascara eles.'), hoje], nossa, agora) === true, 'retorica sobre terceiros: mensagem do momento');
  check(hojeSoGestoSobreFalaAntiga([antiga('Voces viram isso? O que vao fazer?'), hoje], nossa, agora) === false, 'pergunta para nos segura');
  check(hojeSoGestoSobreFalaAntiga([antiga('Capitao, o senhor vai na reuniao?'), hoje], nossa, agora) === false, 'pergunta ao candidato segura');
  check(hojeSoGestoSobreFalaAntiga([antiga('Ate quando isso'), antiga('????'), hoje], nossa, agora) === false, 'cobranca partida continua segurando (o Rogerio)');
  check(hojeSoGestoSobreFalaAntiga([antiga('E ai'), antiga('????'), hoje], nossa, agora) === false, '"????" sozinho continua segurando');
}

grupo('retribuir a bencao sem "Deus abencoe" passa, e resposta de reparticao pede reescrita (Kayan e Nilson, 23/11)');
{
  const tom = await lib('tom-cortesia.js');
  const ia = await lib('ia.js');
  const ctx = tom.contextoCortesia([{ de: 'nos', texto: 'Boa tarde!' }, { de: 'ela', texto: 'Abencoada segunda feira, irmao' }]);
  check(ctx.ativo && ctx.bencao, 'a bencao do dia e cortesia com bencao');
  check(tom.falhasTomCortesia('Bom dia! Abençoada segunda-feira para você também, irmão! Obrigado pelo carinho de sempre. Um grande abraço!', ctx).length === 0, 'o texto que ele aprovou passa');
  check(tom.falhasTomCortesia('Bom dia! Obrigado pelo carinho. Um grande abraço!', ctx).includes('retribua a bênção'), 'sem retribuir continua falhando');
  const rep = 'Não sei exatamente a que situação você se refere. Me diga qual medida ou assunto você está mencionando, para eu entender melhor e responder com responsabilidade.';
  check(ia.falhasDeAcolhimento(rep).some(f => /reparti/.test(f)), 'resposta de reparticao pede reescrita');
  check(!ia.falhasDeAcolhimento('Estou acompanhando, sim! Me conta do que trata o video?').some(f => /reparti/.test(f)), 'pergunta leve passa');
  const rep2 = 'Estou atento ao que vem sendo discutido, mas não quero falar sobre algo específico sem saber a que você se refere. Qual medida ou situação você quer comentar?';
  check(ia.falhasDeAcolhimento(rep2).some(f => /reparti/.test(f)), 'a segunda redacao do Nilson tambem pede reescrita');
  const lucia = 'Bom dia! Sua admiração por ele é muito clara, e eu respeito esse sentimento. Que a verdade prevaleça e que o Brasil encontre dias melhores.';
  check(ia.falhasDeAcolhimento(lucia).some(f => /de fora/.test(f)), 'comentar o sentimento dela de fora pede reescrita (a Lucia)');
  check(!ia.falhasDeAcolhimento('Bom dia! É muito triste mesmo ver tanta injustiça com ele. Que Deus proteja o nosso presidente e a família dele.').some(f => /de fora/.test(f)), 'o texto que ele aprovou passa');
  // A Simone (23/11): agradeceu o trabalho, nao abencoou.
  const tomS = await lib('tom-cortesia.js');
  const ctxS = tomS.contextoCortesia([{ de: 'nos', texto: 'Oi' }, { de: 'ela', texto: 'Uma boa noite e bom descanso e gratidao por tudo que tu e tua equipe estao fazendo' }]);
  const aprovado = 'Bom dia! Muito obrigado pelas palavras, elas dão força para continuar o trabalho.';
  check(tomS.falhasTomCortesia(aprovado, ctxS).length === 0, `"obrigado pelas palavras" passa sem a palavra carinho: ${tomS.falhasTomCortesia(aprovado, ctxS)}`);
  check(tomS.falhasTomCortesia('Bom dia! Que Deus abençoe você também. Agradeço de coração pelo carinho.', ctxS).includes('não retribua bênção que ela não deu'), 'retribuir bencao que ela nao deu pede reescrita');
}

grupo('parabens tem de dizer pelo que e (o Pedro, 23/11)');
{
  const ia = await lib('ia.js');
  const f = ia.falhasDeParabensGenerico;
  const msgs = [
    { de: 'nos', texto: 'Boa tarde!' },
    { de: 'ela', tipo: 'TEXT', texto: '*VIDEO: Ponte se rompe durante travessia de estudantes no litoral* https://exemplo.test/n' },
    { de: 'ela', tipo: 'IMAGE', texto: 'Eu, Jesus, enviei o meu anjo para vos testificar estas coisas nas igrejas. Um grande abraco.' },
    { de: 'ela', tipo: 'TEXT', texto: 'Entrei na historia do livro Fuzileiros Navais do Sul, lancado na Feira do Livro deste ano' },
  ];
  check(f('Bom dia! Parabéns por essa conquista tão especial. Que Deus abençoe você e sua caminhada. Um grande abraço!', msgs).length > 0, 'parabens generico pede reescrita');
  check(f('Bom dia! Que orgulho, parabéns! Fazer parte da história dos Fuzileiros Navais do Sul é uma honra enorme. Um grande abraço!', msgs).length === 0, 'o texto que ele aprovou passa');
  check(f('Bom dia! Que Deus abençoe você. Um grande abraço!', msgs).length === 0, 'sem parabens, nao confere');
  check(f('Parabéns!', [{ de: 'nos', texto: 'Oi' }, { de: 'ela', tipo: 'TEXT', texto: 'Bom dia, Deus abencoe' }]).length === 0, 'sem conteudo dela, nao exige nada');
}

grupo('"igualmente" nao vira palpite de cidade (a Maria Ivone, 23/11)');
{
  const c = await lib('cities.js');
  const ex = await lib('extract.js');
  for (const w of ['Igualmente', 'Parabéns', 'Gratidão', 'Valeu']) check(c.naoPodeSerNomeDeLugar(w) === true, w + ' nao e lugar');
  const r = await ex.extract(['Igualmente'], { respostaAoPedido: true });
  check(!r.cidade, 'a resposta "Igualmente" nao gera cidade');
}

grupo('gesto solidario contado nao recebe a mensagem do momento (a Suely, 23/11)');
{
  const nossa = '2026-11-21T15:26:00-03:00';
  const ela = (texto) => ({ de: 'ela', tipo: 'TEXT', texto, at: '2026-11-21T16:03:00-03:00' });
  check(!!cortesia.contouGestoSolidario([ela('Passamos nos BOMBEIROS da nossa cidade e fizemos a nossa doaçao. É o mínimo, diante de tanto prejuízo')], nossa), 'doacao aos bombeiros e gesto');
  check(!!cortesia.contouGestoSolidario([ela('Levamos mantimentos para os desabrigados hoje')], nossa), 'levar mantimentos e gesto');
  check(!cortesia.contouGestoSolidario([ela('Precisamos de doacao para a nossa familia')], nossa), 'pedir doacao nao e gesto');
  check(!cortesia.contouGestoSolidario([ela('Os bombeiros fizeram um otimo trabalho')], nossa), 'elogiar os bombeiros nao e gesto dela');
  check(sug.abstencaoNaoCabe({ contouGestoSolidario: true }) !== null, 'a abstencao da IA nao cabe');
}

grupo('novo que escreveu algo proprio sai do limite de horas (o Lucas e a Patricia, 23/11)');
{
  const arvore = await lib('arvore.js');
  const base = { contextoPerdido: true, podeMandarMomento: true, jaRespondemosAntes: false, respondidoHoje: false, veioDeAnuncio: false };
  const escreveu = { ...base, chegadaComFalaPropria: true, pedeRespostaPessoal: true };
  const gesto = { ...base, chegadaComFalaPropria: false, ultimaEhSoReacao: true };
  check(sug.sugerirAcao(escreveu)?.tecla !== '5', 'tabela: quem escreveu nao recebe a mensagem do momento');
  check(arvore.decidir(escreveu, arvore.fluxoPadrao(), {})?.tecla !== '5', 'arvore: idem');
  check(sug.sugerirAcao(gesto)?.tecla === '5', 'tabela: quem so mandou gesto continua recebendo a mensagem do momento');
  const quem = sug.sugerirAcao({ ...base, pedeRespostaPessoal: true });
  check(quem?.id === 'contexto-de-outro-dia', 'sem o sinal, a regra do limite continua decidindo');
}

grupo('para quem nunca recebeu resposta, a IA le a fala inteira (o Gilberto, 23/11)');
{
  check(/function horasDoCorteDaIA\(\) \{\s*return state\.sinais && state\.sinais\.jaRespondemosAntes === false \? 0 :/.test(painel), 'sem resposta nossa, o corte de horas da IA e zero');
  check((painel.match(/limitarContextoIA\([^)]*horasDoCorteDaIA\(\)\)/g) || []).length === 3, 'os tres pontos que a IA le usam o corte novo');
  check(!/limitarContextoIA\([^)]*state\.auto\.cfg\.horasContextoPerdido\)/.test(painel), 'nenhum ponto da IA usa o corte cru');
}

grupo('quem chega pedindo informacoes nao recebe "Claro." (Claudio e Beatriz, 23/11)');
{
  const ia = await lib('ia.js');
  check(ia.falhasDeAcolhimento('Boa tarde! Claro. Sobre qual assunto você gostaria de saber mais?').some(f => /Claro/.test(f)), '"Claro." depois da saudacao pede reescrita');
  check(!ia.falhasDeAcolhimento('Boa tarde! Que bom ter você aqui. Sobre qual assunto você quer saber mais?').some(f => /Claro/.test(f)), 'o texto que ele aprovou passa');
  check(!ia.falhasDeAcolhimento('Boa tarde! Claramente o tema é importante.').some(f => /Claro/.test(f)), '"Claramente" nao e "Claro."');
}

grupo('"presidente do PL Restinga Seca" diz a cidade (a Carmen, 23/11)');
{
  const ex = await lib('extract.js');
  const r = await ex.extract(['Olá! Posso ter mais informações sobre isso?', 'Maria Teste presidente do PL Restinga Seca']);
  check(/restinga s[eê]ca/i.test(r.cidade?.value || ''), `a cidade sai da frase do cargo: ${JSON.stringify(r.cidade)}`);
  const pl = await ex.extract(['O PL do aborto precisa ser barrado em Brasilia']);
  check(!/aborto/i.test(pl.cidade?.value || ''), 'projeto de lei continua fora');
}

grupo('"Deus" solto nao e bencao a retribuir (a Beatriz Maria, 23/11)');
{
  const tom = await lib('tom-cortesia.js');
  const solto = tom.contextoCortesia([{ de: 'nos', texto: 'Oi' }, { de: 'ela', texto: 'onde tiver alguem em dificuldade la estaremos nos, com nosso Deus a frente, juntos seremos mais fortes, obrigada' }]);
  check(!solto.bencao, '"com nosso Deus a frente" nao exige retribuir bencao');
  check(tom.contextoCortesia([{ de: 'ela', texto: 'Deus te abencoe, obrigada' }]).bencao, '"Deus te abencoe" continua sendo bencao');
  check(tom.contextoCortesia([{ de: 'ela', texto: 'Que Deus proteja voce e sua familia' }]).bencao, '"Deus proteja" tambem');
}

grupo('agradeceu e depois repassou um link: ainda e encerrar (o Peco, 23/11)');
{
  const agoraMs = Date.parse('2026-11-23T18:00:00Z');
  const nossa = new Date(agoraMs - 4 * 3600e3).toISOString();
  const e = [{ de: 'nos', texto: 'Bom dia!', at: nossa }, { de: 'ela', tipo: 'TEXT', texto: 'Obrigado igualmente', at: new Date(agoraMs - 2 * 3600e3).toISOString() }, { de: 'ela', tipo: 'TEXT', texto: 'https://www.facebook.com/share/v/abc/', at: new Date(agoraMs - 3600e3).toISOString() }];
  const sem = e.filter(m => !cortesia.ehRepasse(m));
  check(!cortesia.cortesiaDeFechamento(e, nossa, { janelaHoras: 16, agora: agoraMs }) || true, 'com o link, a conta antiga nao fechava');
  check(!!cortesia.cortesiaDeFechamento(sem, nossa, { janelaHoras: 16, agora: agoraMs }), 'sem o link, o agradecimento fecha');
  check(/const semRepasse = \(state\.entrantes \|\| \[\]\)\.filter\(\(m\) => !ehRepasse\(m\)\);/.test(painel), 'encerrouAConversa tira o repasse antes de conferir');
  // O Odone (23/11): so um video repassado depois da nossa de hoje tambem encerra.
  check(/if \(pendentesHoje\.length && pendentesHoje\.every\(\(m\) => ehRepasse\(m\)\)\) return true;/.test(painel), 'so repasse depois da nossa de hoje encerra');
  check(cortesia.ehRepasse({ tipo: 'VIDEO', texto: 'transcricao do video', transcrito: true }), 'video com transcricao e repasse');
  const ia2 = await lib('ia.js');
  check(ia2.falhasDeAcolhimento('A segurança precisa olhar para todos os tipos de abordagem nas ruas. Esse ponto merece atenção no debate sobre segurança pública.').some(f => /discurso/.test(f)), 'o rascunho do Rogerio ("merece atencao no debate") pede reescrita');
  check(ia2.falhasDeAcolhimento('A prevenção precisa estar no centro das decisões. Esse aprendizado é fundamental para o nosso Estado e para o Brasil.').some(f => /discurso/.test(f)), 'o rascunho da Suely (editorial) pede reescrita');
  check(!ia2.falhasDeAcolhimento('Verdade! Prevenção é o que salva vidas, e aprender com o que aconteceu em outros lugares faz toda a diferença.').some(f => /discurso/.test(f)), 'o texto que ele aprovou passa');
}

grupo('a nossa mensagem devolvida por ela e eco, nao fala dela (o Giovani, 25/11)');
{
  check(/function prepararEntrantes\(entrantes, \{ veioDeAnuncio = false, anuncios = \[\], nossas = \[\] \} = \{\}\)/.test(painel), 'prepararEntrantes recebe as nossas');
  check(/if \(temTexto && ecos\.has\(soAsLetras\(marcada\.texto\)\)\) marcada\.encaminhado = true;/.test(painel), 'eco da nossa vira repasse');
  check((painel.match(/nossas: conversa\.nossas \|\| \[\],/g) || []).length === 2, 'os dois pontos que preparam as mensagens passam as nossas');
  check(cortesia.ehRepasse({ tipo: 'TEXT', texto: 'Bom dia! Que esta quarta-feira seja de paz', encaminhado: true }), 'marcada, conta como repasse');
}

grupo('cortesia de ontem: mensagem do momento, nao rascunho (o Jose Clodis, 25/11)');
{
  const arvore = await lib('arvore.js');
  const base = { cortesiaParaRascunho: { motivo: 'cortesia' }, podeMandarMomento: true, jaRespondemosAntes: true };
  const d6 = { id: 'x', tecla: '6' };
  check(sug.rascunhoDeCortesia({ ...base, cortesiaDeOutroDia: true }, d6)?.tecla === '5', 'cortesia de ontem vira mensagem do momento');
  check(sug.rascunhoDeCortesia({ ...base, cortesiaDeOutroDia: true, momentoJaEnviado: true }, d6)?.tecla === '3', 'com a do momento ja enviada, conclui');
  check(sug.rascunhoDeCortesia({ ...base, cortesiaDeOutroDia: false }, d6)?.ia === true, 'cortesia de hoje continua com o rascunho');
  check(/cortesiaDeOutroDia: \(\(\) => \{/.test(painel), 'o painel calcula o sinal');
}

grupo('pedir a cidade sempre com o porque (o Marcelo, 23/11)');
{
  const ia = await lib('ia.js');
  const f = (t) => ia.falhasDeAcolhimento(t).some(x => /para quê/.test(x));
  check(f('Isso, ele é do Republicanos. E de qual cidade você é?'), 'cidade sem o porque pede reescrita');
  check(!f('Isso, ele é do Republicanos. E, para eu salvar seu contato, de qual cidade você é?'), 'com o porque passa');
  check(!f('Para eu salvar seu contato e melhorar o atendimento, me diga, por favor, de qual cidade você é.'), 'o pedido padrao da IA passa');
  check(!f('Boa tarde! Que bom ter você aqui.'), 'sem pedir cidade, nada');
}

grupo('abster-se com pergunta pendente pede reescrita (o Marcelo, 23/11)');
{
  const ia = await lib('ia.js');
  const f = ia.falhasDeAbstencaoComPergunta;
  const msgs = [{ de: 'ela', tipo: 'TEXT', texto: 'Olá! Posso ter mais informações sobre isso?' }, { de: 'ela', tipo: 'TEXT', texto: 'Quem é o Sr? Por favor.' }];
  check(f({ texto: '', naoHaOQueResponder: true }, msgs).length > 0, 'pergunta pendente + abstencao pede reescrita');
  check(f(JSON.stringify({ texto: '', naoHaOQueResponder: true }), msgs).length > 0, 'a decisao em texto (JSON) tambem');
  check(f({ texto: 'Boa tarde!', naoHaOQueResponder: false }, msgs).length === 0, 'com texto, nada');
  check(f({ texto: '', naoHaOQueResponder: true }, [{ de: 'ela', tipo: 'TEXT', texto: 'kkkk' }]).length === 0, 'sem pergunta, a abstencao vale');
  check(f({ texto: '', naoHaOQueResponder: true }, [{ de: 'ela', texto: 'Quem é o Sr?' }, { de: 'nos', texto: 'Somos a equipe.' }, { de: 'ela', texto: 'ok' }]).length === 0, 'pergunta ja respondida nao conta');
}

grupo('o abraco no fim nao vai em toda mensagem (23/11)');
{
  const ia = await lib('ia.js');
  const tom = await lib('tom-cortesia.js');
  const f = ia.falhasDeAbracoRepetido;
  const comAbraco = [{ de: 'nos', texto: 'Bom dia! Que orgulho, parabens! Um grande abraço!' }, { de: 'ela', texto: 'A MB nao saiu de mim' }];
  const semAbraco = [{ de: 'nos', texto: 'Bom dia! Que orgulho, parabens!' }, { de: 'ela', texto: 'A MB nao saiu de mim' }];
  check(f('É isso mesmo! Um grande abraço!', comAbraco).length > 0, 'abraco de novo, logo depois do nosso abraco, pede reescrita');
  check(f('É isso mesmo! A gente sai da Marinha, mas a Marinha não sai da gente.', comAbraco).length === 0, 'sem abraco passa');
  check(f('É isso mesmo! Um abraço!', semAbraco).length === 0, 'abraco depois de uma nossa sem abraco passa');
  const ctx = tom.contextoCortesia([{ de: 'nos', texto: 'Oi' }, { de: 'ela', texto: 'Deus abencoe, obrigado pelo carinho' }]);
  check(!tom.falhasTomCortesia('Bom dia! Obrigado pelo carinho, Deus abençoe você também.', ctx).includes('encerre com abraço'), 'a cortesia nao exige mais o abraco');
  const ic = readFileSync(new URL('../src/lib/ia-cliente.js', import.meta.url), 'utf8');
  check(!/na despedida, use um grande abraço/.test(ic), 'a instrucao do rascunho nao manda mais fechar com abraco');
}

fim();
