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
  check(/\.\.\.falhasTomJuridico\(texto\)\]/.test(cli), 'e entra na conferencia que manda reescrever');
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

fim();
