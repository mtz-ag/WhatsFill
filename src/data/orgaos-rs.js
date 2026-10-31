/**
 * orgaos-rs.js — o DOSSIÊ DE ÓRGÃOS: para onde mandar o que NÃO é assunto do mandato.
 *
 * Pedido dele (31/10/2026): *"nós somos do gabinete do capitão martim, então assuntos relacionados ao
 * governador é com gabinete dele; se identificar que o assunto não é com relação ao nosso gabinete,
 * teria que encaminhar para o órgão correto, pesquise o número etc e peça para adicionar ao dossiê"*.
 *
 * É a irmã de `src/data/gabinete.md` (o "quem é quem"), com uma diferença de propósito: aqui o dado é
 * lido POR CÓDIGO — `gabinete.orgaosParaAConversa` escolhe as entradas pela conversa, e só as que
 * casam vão para o prompt (custo: cada linha é token em toda chamada que a puxa).
 *
 * ## As regras deste arquivo
 *
 * 1. **Só entra contato que foi LIDO numa página.** Cada contato tem a `fonte` (URL) e o
 *    `verificado`. `verificado: false` quer dizer "o número aparece no índice de busca do site
 *    oficial, mas a página não abriu para conferir" — **contato não verificado NUNCA vai para o
 *    prompt** (`contatosVerificados`). Nenhum número aqui foi escrito de memória.
 * 2. **Número errado aqui chega a eleitor real.** Na dúvida, apague a linha — vazio faz a IA dizer
 *    o NOME do órgão sem contato; errado faz ela mandar a pessoa para o lugar errado com confiança.
 * 3. **Telefone de governo muda com o governo.** O Gabinete do Governador e a Casa Civil trocam de
 *    titular em 06/01/2027 (posse de Zucco): confira estas duas entradas na primeira semana.
 * 4. `palavras` vão SEM acento e em minúscula (o texto da conversa é normalizado antes de comparar),
 *    e casam no começo de palavra — `prefeit` pega prefeito, prefeita e prefeitura. **Palavra de até
 *    4 letras casa só INTEIRA** (`sus` não pega "suspeito", `pis` não pega "piscina").
 * 5. `exige` (opcional): além de uma `palavra`, a conversa tem de ter um destes termos — é o que
 *    impede o 156 de Porto Alegre de ir para quem é de Caxias.
 */

/** Data da última conferência, para a tela e para o prompt. dd/mm/aaaa. */
export const CONFERIDO_EM = '31/10/2026';

/**
 * @typedef {{ tipo: 'telefone'|'whatsapp'|'email'|'site', valor: string, obs?: string, verificado: boolean, fonte: string }} Contato
 * @typedef {{ id: string, nome: string, trata: string, esfera: 'estadual'|'municipal'|'federal'|'concessionaria'|'emergencia', palavras: string[], exige?: string[], contatos: Contato[], obs?: string }} Orgao
 */

/** @type {Orgao[]} */
export const ORGAOS = [
  {
    id: 'gabinete-governador',
    nome: 'Gabinete do Governador do RS',
    trata: 'assuntos do governador, pedidos de agenda, audiência ou contato com ele',
    esfera: 'estadual',
    palavras: ['governador', 'governadora', 'governo do estado', 'piratini', 'eduardo leite'],
    contatos: [
      { tipo: 'telefone', valor: '(51) 3210-4339', verificado: true, fonte: 'https://www.estado.rs.gov.br/governador' },
      { tipo: 'email', valor: 'agenda@gg.rs.gov.br', obs: 'solicitação de agenda', verificado: true, fonte: 'https://www.estado.rs.gov.br/governador' },
      { tipo: 'email', valor: 'chefia-gabinete@gg.rs.gov.br', verificado: true, fonte: 'https://www.estado.rs.gov.br/governador' },
    ],
    obs: 'Palácio Piratini, Praça Marechal Deodoro, s/nº, Porto Alegre. Atendimento 8h30–12h e 13h30–18h (página do Chefe de Gabinete).',
  },
  {
    id: 'casa-civil',
    nome: 'Casa Civil do RS',
    trata: 'coordenação do governo do Estado, relação com prefeituras e com a Assembleia',
    esfera: 'estadual',
    palavras: ['casa civil', 'secretaria do governo', 'governo gaucho'],
    contatos: [
      { tipo: 'telefone', valor: '(51) 3210-4193', verificado: true, fonte: 'https://casacivil.rs.gov.br/subchefias-e-vinculadas' },
      { tipo: 'email', valor: 'gabinete@casacivil.rs.gov.br', verificado: true, fonte: 'https://casacivil.rs.gov.br/subchefias-e-vinculadas' },
      { tipo: 'site', valor: 'casacivil.rs.gov.br', verificado: true, fonte: 'https://casacivil.rs.gov.br/subchefias-e-vinculadas' },
    ],
  },
  {
    id: 'ouvidoria-estado',
    nome: 'Ouvidoria-Geral do Estado do RS',
    trata: 'reclamação, denúncia, sugestão ou elogio sobre serviço do governo do Estado',
    esfera: 'estadual',
    palavras: ['ouvidoria', 'reclamacao do estado', 'reclamar do estado', 'servico estadual', 'denuncia contra o estado', 'orgao estadual'],
    contatos: [
      { tipo: 'telefone', valor: '0800 541 6136', verificado: true, fonte: 'https://ouvidoriageral.rs.gov.br/o-que-e-a-ouvidoria-geral-do-estado-rs' },
      { tipo: 'email', valor: 'ouvidoriageral@casacivil.rs.gov.br', verificado: true, fonte: 'https://ouvidoriageral.rs.gov.br/o-que-e-a-ouvidoria-geral-do-estado-rs' },
      { tipo: 'site', valor: 'ouvidoriageral.rs.gov.br', verificado: true, fonte: 'https://ouvidoriageral.rs.gov.br/o-que-e-a-ouvidoria-geral-do-estado-rs' },
    ],
    obs: 'Segunda a sexta, 8h30–12h e 13h30–18h.',
  },
  {
    id: 'assembleia',
    nome: 'Assembleia Legislativa do RS (central)',
    trata: 'falar com outro deputado estadual ou com setores da Assembleia',
    esfera: 'estadual',
    palavras: ['assembleia legislativa', 'alrs', 'outro deputado', 'outra deputada'],
    contatos: [
      { tipo: 'telefone', valor: '(51) 3210-2000', obs: 'PABX, 8h30–18h30', verificado: true, fonte: 'https://ww4.al.rs.gov.br/deputados/2116' },
      { tipo: 'site', valor: 'al.rs.gov.br', verificado: true, fonte: 'https://ww4.al.rs.gov.br/deputados/2116' },
    ],
  },
  {
    id: 'defesa-civil-rs',
    nome: 'Defesa Civil do RS',
    trata: 'enchente, alagamento, deslizamento, temporal, risco a pessoas e casas',
    esfera: 'emergencia',
    palavras: ['enchente', 'alagad', 'alagamento', 'inundac', 'cheia', 'deslizament', 'desabament', 'temporal', 'vendaval', 'granizo', 'defesa civil', 'desabrigad', 'desalojad', 'agua entrando', 'rio subindo'],
    contatos: [
      { tipo: 'telefone', valor: '199', obs: 'emergência', verificado: true, fonte: 'https://www.estado.rs.gov.br/saiba-a-quem-pedir-ajuda-em-casos-de-resgate-ou-assistencia-durante-enchentes' },
      { tipo: 'telefone', valor: '(51) 98585-2239', obs: 'coordenadoria, seg a sex 9h–18h', verificado: true, fonte: 'https://defesacivil.rs.gov.br/servicos' },
      { tipo: 'site', valor: 'defesacivil.rs.gov.br', verificado: true, fonte: 'https://defesacivil.rs.gov.br/servicos' },
    ],
    obs: 'Em emergência, a Defesa Civil do MUNICÍPIO também atende. O canal de WhatsApp da Defesa Civil RS é de AVISOS (seguir), não de atendimento.',
  },
  {
    id: 'bombeiros',
    nome: 'Corpo de Bombeiros',
    trata: 'incêndio, resgate, pessoa presa ou em risco',
    esfera: 'emergencia',
    palavras: ['incendio', 'fogo', 'bombeiro', 'resgate', 'ilhad', 'preso em casa', 'afogad'],
    contatos: [
      { tipo: 'telefone', valor: '193', verificado: true, fonte: 'https://www.estado.rs.gov.br/saiba-a-quem-pedir-ajuda-em-casos-de-resgate-ou-assistencia-durante-enchentes' },
    ],
  },
  {
    id: 'brigada-militar',
    nome: 'Brigada Militar',
    trata: 'crime acontecendo agora, violência, emergência policial',
    esfera: 'emergencia',
    palavras: ['assalto', 'assaltad', 'roubo agora', 'tiroteio', 'tiros', 'agressao', 'agredid', 'ameacad', 'brigada militar', '190', 'arrombament', 'invadiram minha casa'],
    contatos: [
      { tipo: 'telefone', valor: '190', verificado: true, fonte: 'https://www.estado.rs.gov.br/saiba-a-quem-pedir-ajuda-em-casos-de-resgate-ou-assistencia-durante-enchentes' },
      { tipo: 'site', valor: 'brigadamilitar.rs.gov.br/numeros-alternativos-190', obs: 'números alternativos por município, se o 190 cair', verificado: true, fonte: 'https://www.brigadamilitar.rs.gov.br/numeros-alternativos-190' },
      { tipo: 'telefone', valor: '(51) 3288-2931', obs: 'Fale Conosco (não emergência)', verificado: false, fonte: 'https://www.brigadamilitar.rs.gov.br/upload/arquivos/202406/20161240-carta-bm-1.pdf' },
    ],
  },
  {
    id: 'policia-civil',
    nome: 'Polícia Civil do RS',
    trata: 'registrar ocorrência, denunciar crime, golpe, investigação',
    esfera: 'estadual',
    palavras: ['boletim de ocorrencia', 'registrar ocorrencia', 'ocorrencia', 'delegacia', 'policia civil', 'golpe', 'estelionat', 'furto', 'furtad', 'denunciar crime', 'trafico'],
    contatos: [
      { tipo: 'telefone', valor: '197', obs: 'Disque Denúncia', verificado: true, fonte: 'https://www.pc.rs.gov.br/policia-civil-alerta-para-golpes-e-disseminacao-de-noticias-falsas' },
      { tipo: 'whatsapp', valor: '(51) 98444-0606', obs: 'só denúncias, não registra ocorrência', verificado: true, fonte: 'https://pc.rs.gov.br/policia-civil-tem-novo-numero-de-whatsapp-e-telegram-para-denuncias' },
      { tipo: 'site', valor: 'www.dol.rs.gov.br', obs: 'Delegacia Online', verificado: true, fonte: 'https://www.pc.rs.gov.br/policia-civil-alerta-para-golpes-e-disseminacao-de-noticias-falsas' },
    ],
  },
  {
    id: 'prefeitura-poa-156',
    nome: 'Prefeitura de Porto Alegre — Central 156',
    trata: 'serviço da prefeitura em Porto Alegre: buraco, lixo, iluminação, poda, posto de saúde, transporte',
    esfera: 'municipal',
    palavras: ['prefeitura de porto alegre', '156', 'buraco', 'iluminacao publica', 'poste', 'lixo', 'coleta', 'poda', 'calcada', 'bueiro', 'posto de saude', 'onibus', 'iptu', 'prefeit', 'dmae'],
    /** Só vale para quem é de Porto Alegre: além de uma `palavra`, a conversa tem de citar a cidade. */
    exige: ['porto alegre', 'poa', 'portoalegre'],
    contatos: [
      { tipo: 'telefone', valor: '156', obs: 'em Porto Alegre; de fora: (51) 3289-0156', verificado: true, fonte: 'https://www.prefeitura.poa.br/carta-de-servicos/156-central-de-atendimento-ao-cidadao' },
      { tipo: 'whatsapp', valor: '(51) 3433-0156', verificado: true, fonte: 'https://www.prefeitura.poa.br/carta-de-servicos/156-central-de-atendimento-ao-cidadao' },
      { tipo: 'email', valor: '156poa@portoalegre.rs.gov.br', verificado: true, fonte: 'https://www.prefeitura.poa.br/carta-de-servicos/156-central-de-atendimento-ao-cidadao' },
    ],
    obs: 'SÓ Porto Alegre. Em outra cidade, o caminho é a prefeitura DELA — não há lista das 497 aqui.',
  },
  {
    id: 'ouvidoria-sus',
    nome: 'Ouvidoria-Geral do SUS (Disque Saúde)',
    trata: 'reclamação ou informação sobre atendimento do SUS, remédio, consulta, cirurgia',
    esfera: 'federal',
    palavras: ['sus', 'consulta', 'cirurgia', 'fila do sus', 'remedio', 'medicament', 'ubs', 'upa', 'exame', 'atendimento no posto'],
    contatos: [
      { tipo: 'telefone', valor: '136', verificado: true, fonte: 'https://www.gov.br/saude/pt-br/canais-de-atendimento/ouvsus' },
      { tipo: 'site', valor: 'gov.br/saude/pt-br/canais-de-atendimento/ouvsus', verificado: true, fonte: 'https://www.gov.br/saude/pt-br/canais-de-atendimento/ouvsus' },
    ],
  },
  {
    id: 'disque-100',
    nome: 'Disque 100 — Direitos Humanos',
    trata: 'violação de direitos de criança, idoso, pessoa com deficiência, violência, discriminação',
    esfera: 'federal',
    palavras: ['disque 100', 'direitos humanos', 'maus tratos', 'maus-tratos', 'abuso', 'idoso abandonad', 'crianca abandonad', 'violencia contra crianca', 'violencia contra idoso', 'discriminac', 'racismo', 'trabalho escravo'],
    contatos: [
      { tipo: 'telefone', valor: '100', obs: '24h, gratuito', verificado: true, fonte: 'https://www.gov.br/pt-br/servicos/denunciar-violacao-de-direitos-humanos' },
      { tipo: 'whatsapp', valor: '(61) 99611-0100', verificado: true, fonte: 'https://www.gov.br/pt-br/servicos/denunciar-violacao-de-direitos-humanos' },
    ],
  },
  {
    id: 'procon-rs',
    nome: 'Procon RS',
    trata: 'problema de consumidor: compra, cobrança, loja, banco, telefonia',
    esfera: 'estadual',
    palavras: ['procon', 'consumidor', 'cobranca indevida', 'produto com defeito', 'operadora', 'telemarketing', 'nao entregaram', 'reembolso'],
    contatos: [
      { tipo: 'whatsapp', valor: '(51) 3287-6200', obs: 'só texto, seg a sex 10h–16h; só para cidades SEM Procon municipal', verificado: true, fonte: 'https://procon.rs.gov.br/procon-rs-oferece-tira-duvidas-no-whatsapp' },
      { tipo: 'site', valor: 'procon.rs.gov.br', verificado: true, fonte: 'https://procon.rs.gov.br/procon-rs-oferece-tira-duvidas-no-whatsapp' },
    ],
    obs: 'Porto Alegre e as cidades com Procon próprio são atendidas pelo Procon municipal. A página do WhatsApp é de 2021: conferir se o número segue ativo.',
  },
  {
    id: 'defensoria-rs',
    nome: 'Defensoria Pública do RS',
    trata: 'advogado gratuito: pensão, divórcio, guarda, despejo, processo, direito de quem não pode pagar',
    esfera: 'estadual',
    palavras: ['defensoria', 'advogado', 'pensao alimenticia', 'divorcio', 'guarda do filho', 'guarda da filha', 'guarda dos filhos', 'guarda da crianca', 'despejo', 'inventario', 'acao na justica'],
    contatos: [
      { tipo: 'telefone', valor: '129', obs: 'Alô Defensoria, seg a sex 12h–19h', verificado: true, fonte: 'https://www.defensoria.rs.def.br/contato' },
      { tipo: 'telefone', valor: '(51) 3211-2233', obs: 'sede, Porto Alegre', verificado: true, fonte: 'https://www.defensoria.rs.def.br/contato' },
      { tipo: 'site', valor: 'defensoria.rs.def.br', verificado: true, fonte: 'https://www.defensoria.rs.def.br/contato' },
    ],
  },
  {
    id: 'mprs',
    nome: 'Ministério Público do RS',
    trata: 'denúncia de irregularidade grave, meio ambiente, direito coletivo, fiscalização de órgão público',
    esfera: 'estadual',
    palavras: ['ministerio publico', 'mprs', 'promotor', 'promotoria', 'improbidade', 'crime ambiental'],
    contatos: [
      { tipo: 'telefone', valor: '(51) 3295-1100', obs: 'atendimento ao cidadão, 12h–19h', verificado: true, fonte: 'https://www.mprs.mp.br/atendimento/' },
      { tipo: 'site', valor: 'mprs.mp.br/atendimento', verificado: true, fonte: 'https://www.mprs.mp.br/atendimento/' },
    ],
  },
  {
    id: 'inss',
    nome: 'INSS — Central 135',
    trata: 'aposentadoria, auxílio-doença, BPC/LOAS, perícia, pensão, benefício do INSS',
    esfera: 'federal',
    palavras: ['inss', 'aposentad', 'pericia', 'auxilio doenca', 'auxilio-doenca', 'bpc', 'loas', 'meu inss', 'beneficio do inss', 'pensao por morte'],
    contatos: [
      { tipo: 'telefone', valor: '135', obs: 'seg a sáb, 7h–22h', verificado: true, fonte: 'https://www.gov.br/previdencia/pt-br/canais_atendimento/central-135' },
      { tipo: 'site', valor: 'meu.inss.gov.br', obs: 'app/site Meu INSS', verificado: false, fonte: 'https://www.gov.br/inss/pt-br/canais_atendimento/meu-inss/meu-inss' },
    ],
  },
  {
    id: 'detran-rs',
    nome: 'DETRAN RS',
    trata: 'CNH, habilitação, multa, licenciamento, vistoria, placa',
    esfera: 'estadual',
    palavras: ['detran', 'cnh', 'carteira de motorista', 'habilitac', 'multa', 'licenciament', 'vistoria do carro', 'placa do carro', 'emplacament'],
    contatos: [
      { tipo: 'telefone', valor: '0800 905 5555', obs: 'Disque-Detran, seg a sex 8h–20h', verificado: true, fonte: 'https://www.detran.rs.gov.br/atendimento-por-telefone-e-site' },
      { tipo: 'whatsapp', valor: '800 905 5555', obs: 'como escrito na página; seg a sex 8h–20h', verificado: true, fonte: 'https://www.detran.rs.gov.br/atendimento-por-telefone-e-site' },
      { tipo: 'site', valor: 'detran.rs.gov.br', verificado: true, fonte: 'https://www.detran.rs.gov.br/atendimento-por-telefone-e-site' },
    ],
  },
  {
    id: 'seduc-rs',
    nome: 'Secretaria da Educação do RS (Seduc)',
    trata: 'escola ESTADUAL: vaga, matrícula, transporte escolar, professor, merenda',
    esfera: 'estadual',
    palavras: ['seduc', 'escola estadual', 'matricula', 'vaga na escola', 'transporte escolar', 'merenda', 'cre', 'coordenadoria de educacao'],
    contatos: [
      { tipo: 'telefone', valor: '(51) 3288-4700', verificado: true, fonte: 'https://www.educacao.rs.gov.br/fale-conosco' },
      { tipo: 'site', valor: 'educacao.rs.gov.br', verificado: true, fonte: 'https://www.educacao.rs.gov.br/fale-conosco' },
    ],
    obs: 'Escola MUNICIPAL (EMEF, creche) é com a prefeitura da cidade.',
  },
  {
    id: 'receita-estadual',
    nome: 'Receita Estadual do RS',
    trata: 'IPVA, ICMS, ITCD, certidão de situação fiscal, protesto/Serasa de dívida com o Estado',
    esfera: 'estadual',
    palavras: ['ipva', 'icms', 'itcd', 'receita estadual', 'sefaz', 'imposto estadual', 'certidao negativa', 'nota fiscal gaucha'],
    contatos: [
      { tipo: 'telefone', valor: '0800 541 2323', obs: 'seg a sex 8h–20h, sáb 8h–14h', verificado: true, fonte: 'https://fazenda.rs.gov.br/servicos-a-empresas/servicos?servico=2075' },
      { tipo: 'site', valor: 'atendimento.receita.rs.gov.br/faleconosco', obs: 'Plantão Fiscal Virtual', verificado: true, fonte: 'https://fazenda.rs.gov.br/servicos-a-empresas/servicos?servico=2075' },
    ],
  },
  {
    id: 'corsan',
    nome: 'Corsan (Aegea) — água e esgoto',
    trata: 'falta de água, vazamento, conta de água, esgoto nas cidades atendidas pela Corsan',
    esfera: 'concessionaria',
    palavras: ['corsan', 'aegea', 'falta de agua', 'sem agua', 'vazament', 'conta de agua', 'esgoto'],
    contatos: [
      { tipo: 'telefone', valor: '0800 646 6444', obs: '24h, gratuito', verificado: true, fonte: 'https://www.corsan.com.br/canais-de-relacionamento/' },
      { tipo: 'whatsapp', valor: '0800 646 6444', obs: 'salvar o número e mandar "Oi"', verificado: true, fonte: 'https://www.corsan.com.br/canais-de-relacionamento/' },
      { tipo: 'site', valor: 'corsan.com.br', verificado: true, fonte: 'https://www.corsan.com.br/canais-de-relacionamento/' },
    ],
    obs: 'Porto Alegre NÃO é Corsan (é o DMAE, pelo 156).',
  },
  {
    id: 'ceee-equatorial',
    nome: 'CEEE Equatorial — energia elétrica',
    trata: 'falta de luz, conta de luz, poste com fio caído, ligação nova',
    esfera: 'concessionaria',
    palavras: ['ceee', 'equatorial', 'falta de luz', 'sem luz', 'sem energia', 'queda de energia', 'conta de luz', 'fio caido', 'energia eletrica'],
    contatos: [
      { tipo: 'telefone', valor: '0800 721 2333', obs: '24h', verificado: false, fonte: 'https://ceee.equatorialenergia.com.br/comercial/canais-de-atendimento/' },
      { tipo: 'whatsapp', valor: '(51) 3382-5500', obs: 'assistente "Clara"', verificado: false, fonte: 'https://ceee.equatorialenergia.com.br/comercial/canais-de-atendimento/' },
    ],
    obs: 'O site da CEEE recusou a leitura (HTTP 403) em 31/10/2026: os números saíram do índice de busca do site oficial, e por isso não vão para o prompt até alguém conferir na página. Atenção: parte do RS é RGE (CPFL), não CEEE.',
  },
  {
    id: 'caixa-beneficios',
    nome: 'Caixa — benefícios sociais',
    trata: 'saque e pagamento de benefício social, FGTS, PIS, Cartão Social, Caixa Tem',
    esfera: 'federal',
    palavras: ['caixa economica', 'caixa tem', 'fgts', 'pis', 'abono salarial', 'cartao social', 'seguro desemprego', 'seguro-desemprego'],
    contatos: [
      { tipo: 'telefone', valor: '0800 726 0207', obs: 'benefícios sociais, FGTS e Cartão Social', verificado: true, fonte: 'https://cidadao.caixa.gov.br/frontpage' },
      { tipo: 'telefone', valor: '111', obs: 'Central 111', verificado: true, fonte: 'https://cidadao.caixa.gov.br/frontpage' },
      { tipo: 'site', valor: 'cidadao.caixa.gov.br', verificado: true, fonte: 'https://cidadao.caixa.gov.br/frontpage' },
    ],
  },
  {
    id: 'bolsa-familia-121',
    nome: 'Bolsa Família e Cadastro Único — Disque Social 121 (MDS)',
    trata: 'situação do Bolsa Família, bloqueio, Cadastro Único, Auxílio Gás',
    esfera: 'federal',
    palavras: ['bolsa familia', 'cadastro unico', 'cadunico', 'cad unico', 'auxilio gas', 'beneficio bloqueado', 'bloquearam meu beneficio'],
    contatos: [
      { tipo: 'telefone', valor: '121', obs: 'atendimento humano seg a sex 7h–19h; eletrônico 24h', verificado: true, fonte: 'https://www.gov.br/mds/pt-br/canais_atendimento/disque-social-121' },
    ],
    obs: 'O cadastro em si é feito no CRAS da cidade.',
  },
];
