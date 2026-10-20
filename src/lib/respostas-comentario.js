/**
 * **AS RESPOSTAS RAPIDAS DO COMENTARIO** — pedido dele (20/10/2026): *"preciso de respostas
 * rapidas para o facebook, a ia nao e necessaria para tudo"*.
 *
 * Um clique (ou a tecla) poe o texto no campo e insere no comentario da vez. **A fronteira e a
 * mesma da IA**: nada e enviado — quem aperta Enter no Facebook e ele.
 *
 * ---
 *
 * **CADA BOTAO E UMA CATEGORIA COM ATE DEZ VARIACOES, QUE REVEZAM** — pedido dele no mesmo dia:
 * *"numero 1 = apoio e dentro dele quero 10 variacoes (...) ao apertar o numero 1 ira seguir na
 * sequencia das variacoes para cada resposta e nao se repetir ate ter ido as 10"*.
 *
 * **E o mecanismo que ja existe para a mensagem do momento** (`templates.varianteAtual` /
 * `avancarVariante`), com as duas disciplinas de la:
 *
 *  1. **o ponteiro mora em `varianteIndex`**, chave propria que o `exportJson` descarta — ele e
 *     medicao desta maquina, nao configuracao dele;
 *  2. **so anda depois que o texto SAIU** (aqui: entrou na caixa). Avancar no preview faria a
 *     proxima variacao pular sozinha, e a lista de dez viraria uma lista de cinco.
 *
 * A volta e CIRCULAR, e e o que cumpre o *"nao se repetir ate ter ido as 10"* sem sortear nada:
 * 0, 1, 2, ... 9, 0. Sorteio repetiria antes de fechar a volta.
 *
 * **Por que variar importa mais aqui do que no WhatsApp:** os comentarios ficam na MESMA pagina,
 * um embaixo do outro. Seis "Muito obrigado pelo apoio!" identicos em sequencia e o que denuncia
 * robo — a mesma razao pela qual a mensagem do momento reveza desde 02/09.
 *
 * ---
 *
 * **POR QUE ESTA LISTA E PROPRIA, E NAO AS RESPOSTAS PRONTAS DO WHATSAPP.** Medido em 20/10/2026,
 * contra as 21 de fabrica: **3 serviriam**. Cinco **pedem o cadastro** (`Nome , Cidade`), que e
 * proibicao escrita do canal publico; dezesseis tem `{{saudacao}}`, e no Facebook **nao ha contato
 * carregado**: a variavel nao resolve. **Nao ha variavel nenhuma aqui, de proposito** —
 * `{{cidade}}` seria dado de eleitor em publico, e o nome ja vai na mencao que o Facebook poe.
 *
 * **E por CANDIDATO** (`perfis.CHAVES_DO_PERFIL`): o comentario sai na pagina dele, com a cara
 * dele.
 */

/**
 * **Teto de botoes.** O painel tem 380px e a tira fica junto do campo: passando disso ela empurra
 * a lista de comentarios para fora da vista, que e o que ele veio ler. **As teclas vao so ate 9**
 * — do decimo em diante, so clique.
 */
export const MAX_RESPOSTAS = 12;

/** **Dez variacoes por botao** — o numero que ele pediu. */
export const MAX_VARIACOES = 10;

/** O rotulo do botao. Curto porque e um botao, nao um titulo. */
export const MAX_NOME = 28;

/** Uma ou duas frases. O corte e generoso de proposito: quem escreve e ele. */
export const MAX_TEXTO = 600;

/**
 * **As de fabrica, escritas a partir do que ESTA pagina recebe** — declaracao de voto ("22"),
 * apoio, superfa, pedido pessoal e material que circula.
 *
 * **Quantas variacoes cada uma tem segue o USO, nao um numero redondo.** O apoio leva dez porque
 * e o que mais chega e onde a repeticao aparece: dez agradecimentos iguais na mesma pagina sao
 * seis vezes o mesmo robo. "Pro privado" leva tres porque sai pouco, e inventar dez formas de
 * dizer a mesma frase produz texto ruim. **O teto e dez e o editor esta no painel** — completar e
 * dele, e a tela diz quantas cada botao tem.
 *
 * **Todas passam pelas travas do canal publico**, e ha teste exigindo isso: nenhuma pede cadastro,
 * nenhuma promete entrega, nenhuma afirma que ja fizemos, nenhuma cita a chapa pelo nome e nenhuma
 * passa de duas frases.
 *
 * **Nenhuma cita candidato pelo nome**, e isso nao e estilo: e o que permite elas servirem de
 * ponto de partida para QUALQUER candidato — ver `ler` com `vazio` em `facebook-main`.
 */
export const RESPOSTAS_DE_FABRICA = [
  {
    id: 'apoio',
    nome: 'Apoio',
    variacoes: [
      'Muito obrigado pelo apoio! Seguimos juntos. 🙏',
      'Obrigado de coração! É com gente como você que a gente segue. 💪',
      'Que bom ler isso! Obrigado pela força. 🙏',
      'Valeu demais pelo apoio! Seguimos firmes. 💪',
      'Obrigado! Seu apoio faz diferença. 🙏',
      'Gratidão pelo carinho! Seguimos juntos nessa. 🙏',
      'Obrigado pela confiança! Vamos juntos. 💪',
      'Muito obrigado! É isso que dá força para continuar. 🙏',
      'Obrigado pelo carinho de sempre! 🙏',
      'Valeu pelo apoio! Conta com a gente também. 💪',
    ],
  },
  {
    id: 'dia-25',
    // **O nome carrega a data de proposito:** texto com prazo dentro envelhece sozinho (19/10), e
    // assim ele VE que este e datado ao olhar o botao, sem precisar abrir.
    nome: 'Dia 25 — 2o turno',
    variacoes: [
      'Dia 25 é 22! Leva a família e os amigos para votar. 💪',
      'Agora é dia 25! Confirma com todo mundo da sua casa. 💪',
      'Dia 25 a gente decide. Leva dois amigos junto! 💪',
      'Falta pouco: dia 25, é 22!',
      'Dia 25 tem que ser 22. Conto com você! 💪',
    ],
  },
  {
    id: 'privado',
    // Pedido pessoal NAO se nega em publico — e a regra do canal. Aqui so se muda de lugar.
    nome: 'Pro privado',
    variacoes: [
      'Me chama na mensagem da página que a gente vê isso com calma por lá.',
      'Me manda uma mensagem aqui na página para a gente conversar melhor.',
      'Chama no privado da página que a gente conversa sobre isso.',
    ],
  },
  {
    id: 'informacao',
    // Agradece e NAO opina: denuncia e acusacao politica nao se discute (regra dele, 23/09).
    nome: 'Obrigado pela info',
    variacoes: [
      'Obrigado por trazer, vamos acompanhar. 🙏',
      'Valeu pela informação! Estamos atentos.',
      'Obrigado por compartilhar. 🙏',
      'Recebido, obrigado por avisar!',
    ],
  },
  {
    id: 'junto',
    // Quem xinga o adversario esta do nosso lado: agradece, nunca modera (regra 17, 25/09).
    nome: 'Está junto',
    variacoes: [
      'É isso aí! Obrigado por estar junto nessa. 💪',
      'Tamo junto! 💪',
      'Isso mesmo! Seguimos firmes. 💪',
      'Boa! Conta com a gente. 💪',
      'Verdade! Obrigado por falar isso. 💪',
      'É nós! Obrigado. 💪',
    ],
  },
  {
    id: 'acompanhe',
    nome: 'Seguir a página',
    variacoes: [
      'Obrigado! Segue a página para não perder nada. 👊',
      'Valeu! Ativa as notificações para acompanhar tudo.',
      'Obrigado! Por aqui a gente posta tudo primeiro. 👊',
    ],
  },
];

/** Id novo, curto e sem relógio no meio — o relógio faria o `git diff` acusar mudança à toa. */
export function novoId() {
  return 'r' + Math.random().toString(36).slice(2, 9);
}

/**
 * O rotulo tirado do proprio texto, para **guardar nao exigir digitar um nome**.
 *
 * Corta em palavra inteira: "Muito obrigado pelo apo…" num botao parece defeito.
 */
export function nomeDoTexto(texto) {
  const limpo = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!limpo) return 'Sem nome';
  if (limpo.length <= MAX_NOME) return limpo;
  const corte = limpo.slice(0, MAX_NOME);
  const espaco = corte.lastIndexOf(' ');
  return (espaco > 8 ? corte.slice(0, espaco) : corte).trim() + '…';
}

/**
 * **O que vem do armazenamento e ENTRADA NAO CONFIAVEL** — a mesma disciplina do arquivo de fluxo.
 * Um backup editado a mao, ou uma versao anterior com outro formato, nao pode virar botao que
 * manda `undefined` para a pagina publica.
 *
 * **Aceita a forma ANTIGA (`texto`) e converte para `variacoes`** — ele ja guardou respostas antes
 * de as variacoes existirem (20/10, de manha), e perder aquilo seria apagar texto dele sem avisar.
 *
 * Item sem nenhuma variacao e DESCARTADO (botao que nao escreve nada e botao que confunde); id
 * repetido ou ausente ganha id novo; nome vazio volta a sair da primeira variacao.
 */
export function sanitizar(lista) {
  const vistos = new Set();
  const saida = [];
  for (const item of Array.isArray(lista) ? lista : []) {
    if (saida.length >= MAX_RESPOSTAS) break;

    // A forma antiga tinha `texto`; a nova tem `variacoes`. As duas entram.
    const cruas = Array.isArray(item?.variacoes) ? item.variacoes : [item?.texto];
    const variacoes = [];
    for (const t of cruas) {
      if (variacoes.length >= MAX_VARIACOES) break;
      const limpo = String(t || '').trim().slice(0, MAX_TEXTO);
      // Variacao repetida nao e variacao: ela faria a volta "pular" para o mesmo texto.
      if (limpo && !variacoes.includes(limpo)) variacoes.push(limpo);
    }
    if (!variacoes.length) continue;

    let id = String(item?.id || '').trim();
    if (!id || vistos.has(id)) id = novoId();
    vistos.add(id);
    const nome = String(item?.nome || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOME);
    saida.push({ id, nome: nome || nomeDoTexto(variacoes[0]), variacoes });
  }
  return saida;
}

/** A chave do ponteiro desta resposta dentro de `varianteIndex`, que e compartilhado. */
export function chaveDoPonteiro(id) {
  return `fb:${id}`;
}

/**
 * **A variacao da vez — SEM avancar nada.**
 *
 * Quem desenha o botao e quem vai inserir chamam esta funcao e tem de ver a MESMA coisa; so
 * `proximoPonteiro`, chamada depois que o texto entrou na caixa, muda o que a proxima devolve.
 *
 * @returns {{texto:string, posicao:number, total:number}}
 */
export function variacaoDaVez(resposta, indices = {}) {
  const v = resposta?.variacoes || [];
  if (!v.length) return { texto: '', posicao: 0, total: 0 };
  const i = (Number(indices[chaveDoPonteiro(resposta.id)]) || 0) % v.length;
  return { texto: v[i], posicao: i + 1, total: v.length };
}

/**
 * O mapa de ponteiros com ESTA resposta avancada uma casa.
 *
 * **Circular**, que e o que cumpre o "nao repetir ate ter ido as dez": a volta so retorna ao
 * primeiro depois de passar por todos. Devolve o mapa novo em vez de gravar — gravar e do painel,
 * e so DEPOIS de a insercao ter dado certo.
 */
export function proximoPonteiro(resposta, indices = {}) {
  const v = resposta?.variacoes || [];
  if (v.length <= 1) return indices;
  const chave = chaveDoPonteiro(resposta.id);
  return { ...indices, [chave]: ((Number(indices[chave]) || 0) + 1) % v.length };
}

/**
 * Guarda o texto do campo como **resposta nova** (uma variacao).
 *
 * **Texto igual nao vira segunda entrada:** ele clicaria em guardar duas vezes sem perceber. A
 * busca varre TODAS as variacoes de TODAS as respostas — guardar de novo um texto que ja e a
 * terceira variacao do "Apoio" criaria um botao duplicado que diz a mesma coisa.
 *
 * @returns {{lista:object[], id:string, jaExistia:string, cheia:boolean}}
 */
export function guardar(lista, texto) {
  const atual = sanitizar(lista);
  const limpo = String(texto || '').trim().slice(0, MAX_TEXTO);
  if (!limpo) return { lista: atual, id: '', jaExistia: '', cheia: false };

  const dono = atual.find((r) => r.variacoes.includes(limpo));
  if (dono) return { lista: atual, id: dono.id, jaExistia: dono.nome, cheia: false };

  if (atual.length >= MAX_RESPOSTAS) return { lista: atual, id: '', jaExistia: '', cheia: true };

  const id = novoId();
  return { lista: [...atual, { id, nome: nomeDoTexto(limpo), variacoes: [limpo] }], id, jaExistia: '', cheia: false };
}

/** Renomear so muda o ROTULO. Nome vazio volta a sair da primeira variacao, nunca fica em branco. */
export function renomear(lista, id, nome) {
  return sanitizar(lista).map((r) =>
    r.id === id
      ? { ...r, nome: String(nome || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOME) || nomeDoTexto(r.variacoes[0]) }
      : r
  );
}

/**
 * **As variacoes viram texto para o editor: UMA POR LINHA.**
 *
 * E o formato que o projeto ja usa nas tabelas da Config (`padrao = Etiqueta`, uma por linha), e
 * editar dez frases num campo so e muito mais rapido que dez campos. **Comentario e de uma ou duas
 * frases**, entao quebra de linha dentro de uma variacao nao existe na pratica — e a tela diz a
 * regra, em vez de deixar adivinhar.
 */
export function paraTexto(resposta) {
  return (resposta?.variacoes || []).join('\n');
}

/**
 * A volta: o texto do editor vira a lista de variacoes.
 *
 * Linha vazia some (ele vai deixar uma sobrando ao apagar), repetida some (duas iguais fariam a
 * volta parecer menor do que e) e o teto corta.
 */
export function deTexto(texto) {
  const fora = [];
  for (const linha of String(texto || '').split('\n')) {
    if (fora.length >= MAX_VARIACOES) break;
    const limpo = linha.trim().slice(0, MAX_TEXTO);
    if (limpo && !fora.includes(limpo)) fora.push(limpo);
  }
  return fora;
}

/**
 * Grava nome e variacoes de uma resposta.
 *
 * **Lista de variacoes vazia APAGA a resposta** — e o gesto natural de quem quer tirar um botao, e
 * sem isso ele apagaria tudo no editor e ficaria com um botao que nao escreve nada. Devolve o que
 * saiu para o painel por no campo, como o apagar faz.
 *
 * @returns {{lista:object[], texto:string}}
 */
export function editar(lista, id, nome, variacoes) {
  const atual = sanitizar(lista);
  const v = (variacoes || []).slice(0, MAX_VARIACOES);
  if (!v.length) return apagar(atual, id);
  return {
    lista: atual.map((r) =>
      r.id === id
        ? {
            ...r,
            nome: String(nome || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOME) || nomeDoTexto(v[0]),
            variacoes: v,
          }
        : r
    ),
    texto: '',
  };
}

/**
 * Apagar, **devolvendo a primeira variacao junto**.
 *
 * O painel poe esse texto no campo: assim apagar nunca perde tudo de uma vez — um clique em
 * guardar traz a resposta de volta. E o desfazer barato que a regra de 01/09 pede sem precisar de
 * pilha. **As outras variacoes se perdem**, e a tela diz isso antes.
 *
 * @returns {{lista:object[], texto:string}}
 */
export function apagar(lista, id) {
  const atual = sanitizar(lista);
  const fora = atual.find((r) => r.id === id);
  return { lista: atual.filter((r) => r.id !== id), texto: fora ? fora.variacoes[0] : '' };
}
