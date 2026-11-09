/**
 * O dossiê de ÓRGÃOS e o escopo do mandato (31/10/2026).
 *
 * Pedido dele: *"nós somos do gabinete do capitão martim, então assuntos relacionados ao governador
 * é com gabinete dele; se identificar que o assunto não é com relação ao nosso gabinete, teria que
 * encaminhar para o órgão correto"*. O caso real: contato de Porto Alegre quer apresentar uma
 * mulher homenageada na ALRS pelo trabalho nas enchentes e pede o telefone pessoal do governador.
 *
 * Rode: node tests/orgaos.test.mjs
 */
import { check, grupo, fim, lib, mem } from './_harness.mjs';

const gabinete = await lib('gabinete.js');
const ia = await lib('ia.js');
const cortesia = await lib('cortesia.js');
const { ORGAOS, CONFERIDO_EM } = await import('../src/data/orgaos-rs.js');

const CASO_REAL =
  'Boa tarde, sou de Porto Alegre. Queria apresentar a Dona Maria, que foi homenageada na Assembleia ' +
  'pelo trabalho nas enchentes. Vocês podem me passar o telefone pessoal do governador? O WhatsApp dele não responde.';

grupo('o arquivo de orgaos: toda entrada tem nome, o que trata, e contato com fonte');
{
  check(Array.isArray(ORGAOS) && ORGAOS.length >= 20, `ha orgaos no dossie (${ORGAOS.length})`);
  check(/^\d{2}\/\d{2}\/\d{4}$/.test(CONFERIDO_EM), `a data de conferencia esta escrita (${CONFERIDO_EM})`);
  const ids = new Set();
  for (const o of ORGAOS) {
    check(o.id && !ids.has(o.id), `id unico: ${o.id}`);
    ids.add(o.id);
    check(o.nome && o.trata && Array.isArray(o.palavras) && o.palavras.length, `${o.id}: nome, o que trata e palavras`);
    check(o.palavras.every((p) => p === p.toLowerCase() && p === p.normalize('NFD').replace(/[\u0300-\u036f]/g, '')),
      `${o.id}: palavras sem acento e em minuscula (o texto e normalizado antes)`);
    for (const c of o.contatos || []) {
      check(typeof c.verificado === 'boolean', `${o.id}: ${c.valor} diz se foi verificado`);
      check(/^https?:\/\//.test(c.fonte || ''), `${o.id}: ${c.valor} tem a URL da fonte`);
      check(['telefone', 'whatsapp', 'email', 'site'].includes(c.tipo), `${o.id}: tipo conhecido (${c.tipo})`);
    }
  }
}

grupo('o caso real: o governador vem PRIMEIRO, com o contato do Gabinete');
{
  const l = gabinete.orgaosParaAConversa([CASO_REAL]);
  check(l[0]?.id === 'gabinete-governador', `o Gabinete do Governador e o primeiro (${l.map((o) => o.id)})`);
  check(!l.some((o) => o.id === 'assembleia'), '"homenageada na Assembleia" nao puxa a Assembleia');
  check(!l.some((o) => o.id === 'prefeitura-poa-156'), '"Porto Alegre" sozinho nao puxa o 156');
  const bloco = gabinete.blocoDeOrgaos(l);
  check(bloco.includes('(51) 3210-4339') && bloco.includes('agenda@gg.rs.gov.br'), 'o bloco leva o telefone e o e-mail do Gabinete');
  check(bloco.includes(`conferido em ${CONFERIDO_EM}`), 'e a data de conferencia');
  check(l.length <= 3, 'no maximo tres orgaos: o bloco e curto');
  check(gabinete.telefonesDosOrgaos(l).includes('5132104339'), 'o numero do Gabinete e permitido na trava');
}

grupo('emergencia: so passa na frente quando e AGORA');
{
  const agora = gabinete.orgaosParaAConversa(['Socorro, a água está entrando em casa agora, enchente aqui']);
  check(agora[0]?.id === 'defesa-civil-rs', `com "agora", a Defesa Civil vem primeiro (${agora.map((o) => o.id)})`);
  const passado = gabinete.orgaosParaAConversa([CASO_REAL]);
  check(passado[0]?.id !== 'defesa-civil-rs', 'enchente no passado nao passa o governador para tras');
}

grupo('so contato VERIFICADO vai para o prompt');
{
  const falsa = [{ id: 'x', nome: 'Órgão X', trata: 'teste', esfera: 'estadual', palavras: ['teste'],
    contatos: [
      { tipo: 'telefone', valor: '(51) 1111-1111', verificado: false, fonte: 'https://exemplo' },
      { tipo: 'telefone', valor: '(51) 2222-2222', verificado: true, fonte: 'https://exemplo' },
    ] }];
  const l = gabinete.orgaosParaAConversa(['isso e um teste'], { orgaos: falsa });
  const bloco = gabinete.blocoDeOrgaos(l);
  check(bloco.includes('2222-2222'), 'o verificado entra');
  check(!bloco.includes('1111-1111'), 'o NAO verificado fica de fora');
  check(!gabinete.telefonesDosOrgaos(l).includes('5111111111'), 'e nao vira numero permitido');

  const soNaoVerificado = [{ ...falsa[0], contatos: [falsa[0].contatos[0]] }];
  check(gabinete.orgaosParaAConversa(['isso e um teste'], { orgaos: soNaoVerificado }).length === 0,
    'orgao sem contato verificado nao entra (o nome a regra 20 ja manda dizer)');

  // No arquivo de verdade: nenhum contato nao verificado aparece em nenhum bloco possivel.
  const todos = gabinete.blocoDeOrgaos(gabinete.orgaosParaAConversa(
    [ORGAOS.flatMap((o) => o.palavras).join(' . ') + ' porto alegre agora'], { max: 99 }));
  const naoVerificados = ORGAOS.flatMap((o) => o.contatos.filter((c) => !c.verificado).map((c) => c.valor));
  check(naoVerificados.length > 0, `ha contatos marcados como nao verificados (${naoVerificados.length})`);
  check(naoVerificados.every((v) => !todos.includes(v)), 'e nenhum deles chega a bloco nenhum');
}

grupo('casar palavra: comeco de palavra, e INTEIRA quando e curta');
{
  const t = gabinete.normalizarParaOrgaos('Meu PIS e o SUS; a piscina; suspeito; Prefeitura');
  check(gabinete.casaPalavra(t, 'pis') && gabinete.casaPalavra(t, 'sus'), 'pis e sus inteiros casam');
  check(!gabinete.casaPalavra(gabinete.normalizarParaOrgaos('a piscina e suspeito'), 'pis'), '"piscina" nao e PIS');
  check(!gabinete.casaPalavra(gabinete.normalizarParaOrgaos('suspeito'), 'sus'), '"suspeito" nao e SUS');
  check(gabinete.casaPalavra(t, 'prefeit'), 'prefeit pega Prefeitura (sem acento, sem caixa)');
  check(gabinete.casaPalavra(gabinete.normalizarParaOrgaos('Detran não responde'), 'detran'), 'acento e caixa nao atrapalham');
}

grupo('o que NAO e de orgao nenhum nao puxa nada');
{
  for (const f of ['Obrigado pelo apoio, Deus abençoe 🙏', 'Bom dia!', 'Votei no 22', 'Quero o material de campanha', ''])
    check(gabinete.orgaosParaAConversa([f]).length === 0, `nada para: "${f}"`);
  check(gabinete.orgaosParaAConversa([{ de: 'nos', texto: 'Ligue para a Defesa Civil' }]).length === 0,
    'o que NOS escrevemos nao conta');
  check(gabinete.orgaosParaAConversa(['buraco na minha rua em Caxias']).length === 0, 'o 156 e so de Porto Alegre');
  check(gabinete.orgaosParaAConversa(['buraco na minha rua aqui em Porto Alegre'])[0]?.id === 'prefeitura-poa-156',
    'em Porto Alegre, o 156');
}

grupo('orgaosParaOPrompt respeita a Config');
{
  delete mem.ia;
  const ligado = await gabinete.orgaosParaOPrompt([CASO_REAL]);
  check(ligado.bloco.includes('Gabinete do Governador') && ligado.ids[0] === 'gabinete-governador', 'ligado por padrao');
  mem.ia = { orgaosAtivos: false };
  const desligado = await gabinete.orgaosParaOPrompt([CASO_REAL]);
  check(desligado.bloco === '' && desligado.telefones.length === 0, 'desligado, nada vai');
  delete mem.ia;
}

grupo('o prompt pos-campanha: regras 19, 20 e 21, sem eco, e os exemplos');
{
  check(ia.FASE_PADRAO === 'normal', 'o padrao e o modo normal');
  const p = ia.montarSistemaRascunho({});
  check(/^19\. A ELEIÇÃO DE 2026 ACABOU/m.test(p), 'a regra 19 diz que a eleicao acabou');
  check(!/A ELEIÇÃO NÃO ACABOU/.test(p) && !/correria da campanha/.test(p), 'o texto de campanha saiu');
  check(!/EVENTOS DA AGENDA/.test(p.slice(p.indexOf('8. QUEM QUER FALAR'), p.indexOf('\n9. '))),
    'a regra 8 nao manda mais para os eventos da agenda');
  check(/^20\. ÓRGÃOS RESPONSÁVEIS/m.test(p) && /^21\. O ASSUNTO É NOSSO/m.test(p), 'as regras 20 e 21 existem');
  check(p.indexOf('20. ÓRGÃOS RESPONSÁVEIS') < p.indexOf('TAMANHO:'), 'e ficam antes do TAMANHO, perto de onde o modelo escreve');
  check(/NUNCA prometa encaminhar, levar ou falar com o governador/.test(p), 'nunca prometer levar ao governador');
  check(/NUNCA diga que vai chegar ao deputado/.test(p), 'nunca prometer que chega ao deputado');
  check(/RESPONSÁVEL PELA AGENDA DO CAPITÃO MARTIM/.test(p) && /NÃO escreva "nossa equipe"/.test(p),
    'regra 21: o repasse e para o responsavel pela agenda DELE, por extenso, e nunca "nossa equipe"');
  check(/e SÓ quando é nosso/.test(p), 'regra 21 vale SO para assunto nosso');
  check(/entidades SEPARADAS/.test(p) && /NÃO ofereça passar nada para o nosso lado/.test(p),
    'regra 20: outro orgao e entidade separada, e nao se oferece repasse');
  check(/O motivo é SEGURANÇA/.test(p) && /Nunca quebre a voz/.test(p) && /não temos o telefone/.test(p),
    'regra 20: motivo e seguranca, sem "aqui e o gabinete" nem "nao temos o numero"');
  check(/NUNCA fale de urgência, prioridade/.test(p), 'nunca falar de urgencia');
  check(/^SEM ECO/m.test(p), 'sem eco');
  check(!/encaminhar"|chefe_comunicacao|campo interno/.test(p), 'sem campo interno: a IA devolve so a resposta (decisao dele, 31/10/2026)');

  const ex = ia.exemplosDeEscopo();
  check(ex.includes('(51) 3210-4339') && ex.includes('agenda@gg.rs.gov.br'), 'o exemplo do caso real usa o contato do dossie');
  check(/homenageada na Assembleia/.test(ex), 'e e o caso real');
  const respostas = ex.split('\n').filter((l) => l.startsWith('Resposta:'));
  check(respostas[0] === 'Resposta: "Bom dia! Por segurança, o telefone pessoal do governador não é repassado. O caminho é o gabinete dele, pelo (51) 3210-4339 ou pelo e-mail agenda@gg.rs.gov.br. Um abraço!"',
    'o caso real e a frase que ele ditou (sem o nome, pela regra 1)');
  check(!/respons[áa]vel|equipe|passo para/.test(respostas[0]) && !/respons[áa]vel|equipe|passo para/.test(respostas[1]),
    'assunto de outro orgao termina no contato: nada de repasse para o nosso lado');
  check(!/encaminhar:|chefe_comunicacao/.test(ex), 'os exemplos nao tem mais o campo interno');
  check(/eu passo para o responsável pela agenda do Capitão Martim\."$/.test(respostas[2]),
    'o convite (assunto NOSSO) e o unico com repasse, com o dono escrito');
  check(!/aqui é o gabinete|não temos/i.test(respostas.join(' ')), 'nenhum exemplo quebra a voz dele');
  const doFelipe = ia.exemplosDeEscopo({ nome: 'Felipe Pedri', tratamento: 'o Felipe Pedri' });
  check(/agenda do Felipe Pedri/.test(doFelipe) && !/Martim/.test(doFelipe), 'no outro perfil, o nome e o dele');
  check(!/urg[êe]ncia/i.test(ex.split('\n').filter((l) => l.startsWith('Resposta:')).join(' ')), 'nenhuma resposta do exemplo fala de urgencia');
  for (const r of ex.split('\n').filter((l) => l.startsWith('Resposta:'))) {
    const texto = r.slice('Resposta: "'.length, -1).replace(/\\n/g, '\n');
    const av = ia.travasDoEscopo(texto, { telefonesPermitidos: gabinete.telefonesDosOrgaos(ORGAOS) });
    check(av.length === 0, `o exemplo passa nas proprias travas (${av.join('; ') || 'ok'})`);
  }
  check(!/Martim|Pedri/.test(p.slice(p.indexOf('19. A ELEI'), p.indexOf('20. ÓRGÃOS RESPONSÁVEIS'))), 'a regra 19 nao nomeia candidato');
  check(!/Martim/.test(ia.montarSistemaRascunho({ candidato: { nome: 'Felipe Pedri', tratamento: 'o Felipe Pedri' } })),
    'e no prompt do outro perfil nao sobra "Martim" (as regras 20 e 21 usam o nome do perfil)');

  const camp = ia.montarSistemaRascunho({ fase: 'campanha' });
  check(/A ELEIÇÃO NÃO ACABOU/.test(camp) && /EVENTOS DA AGENDA/.test(camp), 'fase campanha devolve o texto de outubro');
}

grupo('o bloco do contato leva os orgaos so quando ha');
{
  const msgs = [{ de: 'contato', texto: CASO_REAL }];
  const sem = ia.montarContatoRascunho({ mensagens: msgs });
  check(!/ÓRGÃOS QUE PODEM SER/.test(sem), 'sem bloco, nada');
  const bloco = gabinete.blocoDeOrgaos(gabinete.orgaosParaAConversa([CASO_REAL]));
  const com = ia.montarContatoRascunho({ mensagens: msgs, orgaos: bloco });
  check(com.includes('(51) 3210-4339') && /COPIE o contato/.test(com), 'com bloco, o contato e a ordem de copiar');
}

grupo('o esquema e o mesmo de antes: so a resposta, sem campo interno');
{
  const e = ia.esquemaDoRascunho();
  const props = Object.keys(e.properties.opcoes.items.properties).sort();
  check(JSON.stringify(props) === JSON.stringify(['confianca', 'motivo', 'naoCabePedirOCadastro', 'naoHaOQueResponder', 'precisaDeRevisao', 'texto']),
    `os campos de sempre (${props})`);
  check(!ia.esquemaEstrito(e).properties.opcoes.items.required.includes('encaminhar'), 'nem no modo estrito da OpenAI');
  const proibidas = /"(maxItems|minLength|maxLength|minimum|maximum|multipleOf|exclusiveMinimum|exclusiveMaximum)"/;
  check(!proibidas.test(JSON.stringify(e)), 'sem palavra-chave que a API recusa');
  const r = ia.validarRascunho({ opcoes: [{ texto: 'Que convite bonito! Me manda o horário que eu passo para o responsável pela agenda do Capitão Martim.',
    confianca: 0.95, precisaDeRevisao: false, naoHaOQueResponder: false, naoCabePedirOCadastro: false,
    encaminhar: { para: 'chefe_comunicacao', urgente: true, resumo: 'x' } }] }, new Date('2026-10-31T15:00:00'));
  check(!('encaminhar' in r) && !('encaminhar' in r.opcoes[0]), 'um modelo que ainda mande o campo tem ele ignorado');
  check(!r.avisos.some((a) => /PARA A EQUIPE/.test(a)), 'e nao ha linha "PARA A EQUIPE"');
  check(ia.encaminharDaIA === undefined && ia.avisoDeEncaminhar === undefined, 'as funcoes do recado interno sairam');
}

grupo('as travas do escopo barram o envio');
{
  const ag = new Date('2026-10-31T15:00:00');
  const barra = (t, ctx = {}) => !ia.rascunhoPodeSairSozinho(ia.revisarRascunho(t, ag, ctx).avisos);
  check(barra('Vou avaliar a urgência do seu pedido.'), '"avaliar a urgencia" (o caso real)');
  check(barra('Isso é prioridade para nós.'), '"prioridade"');
  check(barra('Vamos analisar e retornamos.'), '"vamos analisar"');
  check(barra('Vou passar seu recado para o deputado.'), 'prometer que chega ao deputado');
  check(barra('Pode deixar, ele vai ler sua mensagem.'), '"ele vai ler"');
  check(barra('Vou encaminhar seu pedido ao Gabinete do Governador.'), 'prometer encaminhar ao governador');
  check(!barra('Vou te passar o telefone do Gabinete do Governador: (51) 3210-4339.', { telefonesPermitidos: ['5132104339'] }),
    'DAR o contato do Gabinete passa');
  check(!barra('Me manda o horário e o local que eu passo para o responsável pela agenda do Capitão Martim.'),
    'o repasse do assunto NOSSO passa');
  check(barra('O gabinete dele atende pelo (51) 3210-4339. Me manda o nome dela que eu passo para o responsável pela agenda do Capitão Martim.',
    { telefonesPermitidos: ['5132104339'] }), 'contato de outro orgao + repasse para o nosso lado barra (misturouOrgaoENos)');
  check(barra('Ligue agora para a Defesa Civil no 199. Depois me diga a cidade que eu passo para o responsável pela agenda do Capitão Martim.'),
    'tambem com numero curto de emergencia');
  check(barra('Aqui é o gabinete, então não temos o telefone pessoal do governador.'), '"nao temos o telefone" barra (quebra a voz)');
  check(!barra('Por segurança, o telefone pessoal do governador não é repassado. O caminho é o gabinete dele, pelo (51) 3210-4339.',
    { telefonesPermitidos: ['5132104339'] }), 'a frase que ele ditou passa');
  check(barra('Ligue para (51) 99999-1234.', { telefonesPermitidos: ['5132104339'] }), 'telefone fora do dossie barra');
  check(!barra('Ligue para (51) 99999-1234.'), 'sem a lista de permitidos, a trava fica calada');
  check(!barra('Ligue agora para a Defesa Civil no 199.', { telefonesPermitidos: [] }), 'numero curto de emergencia passa');
  check(!barra('Ligue para 0800 541 6136.', { telefonesPermitidos: ['08005416136'] }), '0800 do dossie passa');
}

grupo('"nossa equipe" vira "o responsavel pela agenda do Capitao Martim", e "o gabinete dele" fica');
{
  const ag = new Date('2026-10-31T09:00:00');
  const r = ia.revisarRascunho('Que bom! Me manda o horário que eu passo para a nossa equipe.', ag);
  check(r.texto === 'Que bom! Me manda o horário que eu passo para o responsável pela agenda do Capitão Martim.', `trocado (${r.texto})`);
  check(r.avisos.some((a) => /nossa equipe/.test(a)) && ia.rascunhoPodeSairSozinho(r.avisos), 'com aviso, sem barrar');
  const felipe = ia.revisarRascunho('Eu passo para a nossa equipe.', ag, { candidato: { nome: 'Felipe Pedri', tratamento: 'o Felipe Pedri' } });
  check(/agenda do Felipe Pedri/.test(felipe.texto), 'com o nome do perfil');
  check(ia.revisarRascunho('Vou levar à nossa equipe dos materiais.', ag).texto.includes('equipe dos materiais'), 'a equipe dos materiais nao e tocada');
  const gov = ia.revisarRascunho('Por segurança, o telefone pessoal do governador não é repassado. O caminho é o gabinete dele.', ag);
  check(/o gabinete dele/.test(gov.texto), '"o gabinete dele" (do governador) nao vira "a equipe dele"');
}

grupo('partidos: Martim e Republicanos; Zucco e PL; o governador hoje e Eduardo Leite');
{
  const { readFileSync } = await import('node:fs');
  const md = readFileSync(new URL('../src/data/gabinete.md', import.meta.url), 'utf8');
  check(/\| Deputado Estadual \| \*\*Capitão Martim\*\* \| \*\*10122\*\* \| Republicanos \|/.test(md), 'a colinha diz Republicanos');
  check(/Que o Capitão Martim é do PL\.\*\* Ele é do \*\*Republicanos\*\*/.test(md), 'e "Martim e do PL" esta na lista do NUNCA');
  check(/O governador HOJE é Eduardo Leite/.test(md) && /06\/01\/2027/.test(md), 'o governador de hoje e o Leite');
  const fontes = ['src/lib/ia.js', 'src/lib/store.js', 'src/lib/cortesia.js', 'src/lib/gabinete.js', 'src/data/orgaos-rs.js']
    .map((f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n');
  check(!/Martim[^.\n]{0,40}\(PL\)|Martim[^.\n]{0,20}\bdo PL\b/.test(fontes), 'nenhum codigo diz que o Martim e do PL');
  check(!/gabinete do (governador )?Zucco/i.test(fontes + md), 'nada chama o gabinete de hoje de "do Zucco"');
}

grupo('pos-campanha: "a eleicao acabou" deixou de ser barrado');
{
  const ag = new Date('2026-10-31T15:00:00');
  const aviso = ia.AVISOS_QUE_IMPEDEM_ENVIO.eleicaoEncerrada;
  check(!ia.revisarRascunho('A eleição já passou, agora é trabalhar.', ag).avisos.includes(aviso), 'padrao: nao barra');
  check(ia.revisarRascunho('A eleição já passou, agora é trabalhar.', ag, { fase: 'campanha' }).avisos.includes(aviso), 'campanha: barra');
}

grupo('cortesia: pedir o contato do GOVERNADOR nao e pedir o do deputado');
{
  const at = Date.now();
  const pede = (t) => !!cortesia.pedeFalarComDeputado([{ texto: t, at }], 0);
  check(!pede('me passa o whats do governador'), 'o whats do governador vai para a IA (era casado antes)');
  check(!pede(CASO_REAL), 'o caso real tambem');
  check(!pede('vocês têm o número do prefeito?'), 'o do prefeito');
  check(!pede('quero o telefone do secretário da saúde'), 'o do secretario');
  check(pede('me passa o whats dele'), 'o dele continua sendo o da resposta pronta');
  check(pede('tem o telefone do capitão?'), 'e o do capitao');
  check(pede('queria falar com o deputado'), 'e falar com o deputado');
}

fim();
