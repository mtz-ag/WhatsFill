/**
 * **OS DOIS FORMULÁRIOS** — pedido dele em 09/11/2026: *"iremos passar esse formulário para
 * demandas https://capitaomartim.com.br/formulario/demanda-cidada e para visitas
 * https://mobiliza.me/capitaomartim/formulario/agenda"*, e logo depois *"adicione na extensão para
 * que o formulário possa ser mudado caso necessário e seja utilizado pela IA"*.
 *
 * O que este arquivo trava, em ordem de preço:
 *
 *  1. **o endereço que a IA escreve é o do CADASTRO** — link redigitado é o número de urna de novo
 *     (09/09/2026), e um caractere trocado manda o eleitor para uma página que não existe achando
 *     que registrou a demanda dele;
 *  2. **o site do órgão continua passando** — a regra 20 manda copiar o contato do bloco ÓRGÃOS, e
 *     trava que fecha o caminho certo junto com o errado é defeito que se paga sem perceber;
 *  3. **campo vazio DESLIGA** — sem link não há bloco no prompt e a variável bloqueia o envio: o
 *     candidato que não tem esses formulários não manda o link do outro;
 *  4. **a migração só preenche o que está vazio** — o endereço que ele trocar amanhã não pode
 *     voltar ao antigo no próximo carregamento do painel.
 *
 * Rode: node tests/formularios.test.mjs
 */

import { check, grupo, fim, lib, mem } from './_harness.mjs';

const vars = await lib('vars.js');
const store = await lib('store.js');
const perfis = await lib('perfis.js');
const templates = await lib('templates.js');
const ia = await lib('ia.js');

const DEMANDA = templates.LINK_DEMANDA_09_11_2026;
const AGENDA = templates.LINK_AGENDA_09_11_2026;
const agora = new Date('2026-11-09T14:00:00-03:00');

grupo('os dois links medidos na página dele');
{
  check(DEMANDA === 'https://capitaomartim.com.br/formulario/demanda-cidada', `demanda = ${DEMANDA}`);
  check(AGENDA === 'https://mobiliza.me/capitaomartim/formulario/agenda', `agenda = ${AGENDA}`);
}

grupo('sem link preenchido a resposta não sai, e o motivo diz onde se mexe');
{
  mem.linkDemanda = '';
  mem.linkAgenda = '';
  const r = vars.render('Registre aqui: {{link_demanda}}', await vars.buildContext({}));
  check(r.missing.includes('link_demanda'), `faltando = ${JSON.stringify(r.missing)}`);
  check(r.text.includes('{{link_demanda}}'), 'o marcador continua visível no preview');
  const motivo = vars.explainMissing(r.missing, r.reasons);
  check(/Formulários/.test(motivo) && /Config/.test(motivo), `motivo aponta o cartão = ${JSON.stringify(motivo)}`);
}

grupo('com link preenchido a variável resolve');
{
  mem.linkDemanda = DEMANDA;
  mem.linkAgenda = AGENDA;
  const ctx = await vars.buildContext({});
  const r = vars.render('Demanda: {{link_demanda}} / Agenda: {{link_agenda}}', ctx);
  check(!r.missing.length, `nada faltando = ${JSON.stringify(r.missing)}`);
  check(r.text.includes(DEMANDA) && r.text.includes(AGENDA), 'os dois endereços entram no texto');
  const conhecidas = ia && vars.KNOWN_VARS.map(([v]) => v);
  check(conhecidas.includes('{{link_demanda}}') && conhecidas.includes('{{link_agenda}}'), 'as duas estão na lista que ele vê na Config');
}

grupo('a migração preenche o que está vazio e não toca no que ele trocou');
{
  mem.migracoes = {};
  mem.linkDemanda = '';
  mem.linkAgenda = '';
  const postos = await templates.migrarLinksDosFormularios();
  check(postos.length === 2, `preencheu os dois = ${JSON.stringify(postos)}`);
  check((await store.get('linkDemanda')) === DEMANDA, 'com o link de demandas que ele mandou');
  check((await store.get('linkAgenda')) === AGENDA, 'e com o da agenda');

  // O endereço que ELE trocar vence: sem isto, o link novo voltaria ao antigo no próximo painel.
  mem.migracoes = {};
  mem.linkDemanda = 'https://outro.exemplo/demanda';
  await templates.migrarLinksDosFormularios();
  check((await store.get('linkDemanda')) === 'https://outro.exemplo/demanda', 'o link dele fica');

  // Roda uma vez: apagar o campo de propósito é desligar, e desligar não se desfaz sozinho.
  mem.linkDemanda = '';
  await templates.migrarLinksDosFormularios();
  check((await store.get('linkDemanda')) === '', 'campo apagado continua apagado na segunda passada');
}

grupo('os dois são por candidato: o perfil novo lê vazio');
{
  mem.linkDemanda = DEMANDA;
  mem.linkAgenda = AGENDA;
  check(perfis.CHAVES_DO_PERFIL.includes('linkDemanda'), 'linkDemanda está na lista do perfil');
  check(perfis.CHAVES_DO_PERFIL.includes('linkAgenda'), 'linkAgenda também');
  check((await perfis.ler('linkDemanda', 'pedri', '')) === '', 'o formulário do Martim não vaza para o outro candidato');
  check((await perfis.ler('linkAgenda', 'pedri', '')) === '', 'nem o da agenda');
}

grupo('o bloco do prompt: campo vazio não vira bloco');
{
  check(ia.blocoDosFormularios({}) === '', 'sem link nenhum, bloco vazio');
  check(ia.blocoDosFormularios({ demanda: '', agenda: '' }) === '', 'campo em branco é o mesmo que não ter');
  const soAgenda = ia.blocoDosFormularios({ agenda: AGENDA });
  check(soAgenda.includes(AGENDA) && !soAgenda.includes('DEMANDA —'), 'com um só, só ele entra');
  // 11/11/2026: "solicitar uma conversa ficou estranho, seria solicitar uma visita".
  check(/Chame o pedido de VISITA/.test(soAgenda) && /Para solicitar uma visita, preencha/.test(soAgenda),
    'o pedido da agenda se chama visita, com a frase dele');
  check(/nunca de "conversa"/.test(soAgenda), 'e nunca de conversa');
}

grupo('o bloco leva o endereço LITERAL e as proibições');
{
  const bloco = ia.blocoDosFormularios({ demanda: DEMANDA, agenda: AGENDA });
  check(bloco.includes(DEMANDA) && bloco.includes(AGENDA), 'os dois endereços, inteiros');
  check(/COPIE o endereço exatamente/.test(bloco), 'manda copiar, como os telefones do bloco ÓRGÃOS');
  check(/SÓ quando ela trouxer esse caso/.test(bloco), 'e proíbe oferecer formulário a quem não pediu');
  check(/NÃO diga que você registrou/.test(bloco), 'nem dizer que já registrou — quem preenche é ela');
  check(/regra 20/.test(bloco), 'na demanda, o contato do órgão vem primeiro (regra 20)');
  check(/regra 21/.test(bloco), 'na agenda, o link substitui a promessa de repasse (regra 21)');
}

grupo('o bloco chega ao prompt do contato, e só com formulário');
{
  const mensagens = [{ de: 'contato', texto: 'Queria convidar o deputado para um evento aqui.' }];
  const com = ia.montarContatoRascunho({ mensagens, agora, formularios: { agenda: AGENDA } });
  check(com.includes(AGENDA), 'com o campo preenchido, o endereço vai no bloco do contato');
  const sem = ia.montarContatoRascunho({ mensagens, agora });
  check(!sem.includes('FORMULÁRIOS'), 'sem formulário, o prompt sai exatamente como saía');
}

grupo('a regra 21 do sistema aponta para o bloco');
{
  const sistema = ia.montarSistemaRascunho();
  check(/bloco FORMULÁRIOS com o link da AGENDA/.test(sistema), 'a regra que promete o repasse diz quando ela é substituída');
}

grupo('endereço que ninguém cadastrou não sai');
{
  const permitidos = [DEMANDA, AGENDA];
  const barrou = (texto) => {
    const avisos = ia.revisarRascunho(texto, agora, { linksPermitidos: permitidos }).avisos || [];
    return !ia.rascunhoPodeSairSozinho(avisos);
  };

  check(!barrou(`Registre aqui: ${DEMANDA}`), 'o endereço do cadastro passa');
  check(!barrou(`Acesse ${DEMANDA}.`), 'com ponto final colado também');
  check(!barrou('Acesse WWW.Capitaomartim.com.br/formulario/demanda-cidada'), 'maiúscula e www são o mesmo endereço');
  check(!barrou(`O pedido de visita entra por aqui: ${AGENDA}`), 'e o da agenda');

  /**
   * **O caminho trocado é o que esta trava existe para pegar.** `/formulario/demanda` e
   * `/formulario/demanda-cidada` são páginas diferentes, e quem recebe a primeira acha que
   * registrou.
   */
  check(barrou('Registre aqui: https://capitaomartim.com.br/formulario/demanda'), 'uma letra a menos no caminho barra');
  check(barrou('Registre aqui: https://capitaomartim.com/formulario/demanda-cidada'), 'e o domínio parecido também');
}

grupo('o site do órgão continua passando — a regra 20 manda copiá-lo');
{
  const doBloco = ia.linksDoTexto('CORSAN — 0800 646 6444 — https://www.corsan.com.br/fale-conosco');
  check(doBloco.length === 1, `o link do bloco ÓRGÃOS é extraído = ${JSON.stringify(doBloco)}`);
  const permitidos = [DEMANDA, ...doBloco];
  const avisos = (texto) => ia.revisarRascunho(texto, agora, { linksPermitidos: permitidos }).avisos || [];
  check(ia.rascunhoPodeSairSozinho(avisos('Registre na CORSAN: https://www.corsan.com.br/fale-conosco')), 'site que está no bloco sai');
  check(!ia.rascunhoPodeSairSozinho(avisos('Veja em https://www.corsan.com.br/reclamacao')), 'site escrito de memória, não');
}

grupo('sem a lista, a trava fica calada');
{
  const avisos = ia.revisarRascunho('Veja em https://inventado.exemplo/x', agora, {}).avisos || [];
  check(ia.rascunhoPodeSairSozinho(avisos), 'sem medição não se afirma nada — é a política dos telefones');
}

grupo('dizer que já registrou continua barrado pela trava que já existia');
{
  const avisos = ia.revisarRascunho('Já registrei sua demanda com protocolo e te retorno.', agora, {}).avisos || [];
  check(!ia.rascunhoPodeSairSozinho(avisos), 'quem preenche é ela, e afirmar o contrário é a família do "já encaminhei"');
}

/**
 * **O FORMULÁRIO DE CURRÍCULO** (10/11/2026) — *"para casos de pessoas querendo mandar currículo
 * https://capitaomartim.com.br/formulario/curriculo"*. É a exceção da regra 12, que proíbe "mande
 * seu currículo"; a outra metade da 12 (não dar a impressão de que existe vaga) continua.
 */
const CURRICULO = templates.LINK_CURRICULO_10_11_2026;

grupo('currículo: o link medido, a variável e o perfil');
{
  check(CURRICULO === 'https://capitaomartim.com.br/formulario/curriculo', `curriculo = ${CURRICULO}`);
  mem.linkCurriculo = '';
  const vazio = vars.render('Mande aqui: {{link_curriculo}}', await vars.buildContext({}));
  check(vazio.missing.includes('link_curriculo'), 'sem link a resposta que o promete não sai');
  check(/Formulários/.test(vazio.reasons?.link_curriculo || (await vars.buildContext({})).reasons.link_curriculo || ''),
    'e o motivo diz onde se mexe');
  mem.linkCurriculo = CURRICULO;
  check(vars.render('{{link_curriculo}}', await vars.buildContext({})).text === CURRICULO, 'com link, resolve');
  check(perfis.CHAVES_DO_PERFIL.includes('linkCurriculo'), 'é por candidato');
  check((await perfis.ler('linkCurriculo', 'pedri', '')) === '', 'e não vaza para o outro candidato');
}

grupo('currículo: migração própria, porque a marca dos dois primeiros já está gravada');
{
  mem.migracoes = { linksDosFormularios: true };
  mem.linkCurriculo = '';
  check((await templates.migrarLinkDoCurriculo()) === true, 'preenche mesmo com a marca antiga gravada');
  check((await store.get('linkCurriculo')) === CURRICULO, 'com o link que ele mandou');
  mem.migracoes = { linksDosFormularios: true };
  mem.linkCurriculo = 'https://outro.exemplo/cv';
  await templates.migrarLinkDoCurriculo();
  check((await store.get('linkCurriculo')) === 'https://outro.exemplo/cv', 'o link dele fica');
  mem.linkCurriculo = '';
  await templates.migrarLinkDoCurriculo();
  check((await store.get('linkCurriculo')) === '', 'apagado continua apagado');
}

grupo('currículo: o bloco e a exceção da regra 12');
{
  const bloco = ia.blocoDosFormularios({ curriculo: CURRICULO });
  check(bloco.includes(CURRICULO), 'o endereço vai literal');
  check(/NÃO diga que estamos contratando/.test(bloco) && /analisado/.test(bloco), 'sem prometer vaga nem análise');
  check(/QUEM PEDE EMPREGO, VAGA OU TRABALHO/.test(bloco), 'quem pede emprego também recebe o link (decisão dele, 11/11)');
  check(/não estamos contratando, mas se quiser pode deixar seu currículo/.test(bloco), 'a frase nega a vaga antes do link');
  check(/quanto paga\?/.test(bloco) && /não mande o link/.test(bloco), 'pergunta de preço continua fora');
  check(!ia.blocoDosFormularios({ demanda: DEMANDA }).includes('CURRÍCULO'), 'sem link, nada de currículo no bloco');
  const sistema = ia.montarSistemaRascunho();
  check(/ÚNICA EXCEÇÃO é o CURRÍCULO/.test(sistema), 'a regra 12 aponta para a exceção');
  check(/QUEM PEDE EMPREGO OU VAGA e para quem quer mandar o currículo/.test(sistema), 'a regra 12 estende a exceção a quem pede emprego');
  const avisos = ia.revisarRascunho(`Pode mandar por aqui: ${CURRICULO}`, agora, { linksPermitidos: [CURRICULO] }).avisos || [];
  check(ia.rascunhoPodeSairSozinho(avisos), 'o link do cadastro passa pela trava');
}

fim('Os dois formulários');
