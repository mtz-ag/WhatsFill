/**
 * **AS RESPOSTAS RAPIDAS DO COMENTARIO** — pedido dele (20/10/2026): *"preciso de respostas
 * rapidas para o facebook, a ia nao e necessaria para tudo"*.
 *
 * Um clique poe o texto no CAMPO; ele le e manda inserir. **A fronteira e a mesma da IA**: nada
 * vai direto para a caixa do Facebook, porque la esta a um Enter de ficar publico.
 *
 * ---
 *
 * **POR QUE ESTA LISTA E PROPRIA, E NAO AS RESPOSTAS PRONTAS DO WHATSAPP.** Medido em 20/10/2026,
 * contra as 21 de fabrica: **3 serviriam**. Cinco **pedem o cadastro** (`Nome , Cidade`), que e
 * proibicao escrita do canal publico — reusa-las mandaria o formulario para a pagina, onde todo
 * mundo ve. Dezesseis tem `{{saudacao}}`, e no Facebook **nao ha contato carregado**: a variavel
 * nao resolve. E varias passam de 260 caracteres, contra as uma ou duas frases que um comentario
 * comporta.
 *
 * **Nao ha variavel nenhuma aqui, de proposito.** `{{cidade}}` seria dado de eleitor em publico, e
 * o nome ja vai na mencao que o Facebook poe na caixa sozinho.
 *
 * **E por CANDIDATO** (`perfis.CHAVES_DO_PERFIL`), pelo criterio de sempre: entra o que o eleitor
 * recebe. O comentario sai na pagina do candidato, com a cara dele.
 */

/**
 * **Teto de itens.** O painel tem 380px e a tira fica junto do campo: passando disso ela empurra a
 * lista de comentarios para fora da vista, que e o que ele veio ler.
 */
export const MAX_RESPOSTAS = 12;

/** O rotulo do botao. Curto porque e um botao, nao um titulo. */
export const MAX_NOME = 28;

/** Uma ou duas frases. O corte e generoso de proposito: quem escreve e ele. */
export const MAX_TEXTO = 600;

/**
 * **As de fabrica, escritas a partir do que ESTA pagina recebe** — declaracao de voto ("22"),
 * apoio, superfa, pedido pessoal e material que circula.
 *
 * **Todas passam pelas travas do canal**, e ha teste exigindo isso: nenhuma pede cadastro, nenhuma
 * promete entrega, nenhuma afirma que ja fizemos, nenhuma cita a chapa pelo nome (o que faria
 * `conferirChapa` ter de opinar sobre texto que e dele) e nenhuma passa de duas frases.
 *
 * **Nenhuma cita candidato pelo nome**, e isso nao e estilo: e o que permite elas servirem de
 * ponto de partida para QUALQUER candidato — ver `ler` com `vazio` em `facebook-main`.
 */
export const RESPOSTAS_DE_FABRICA = [
  { id: 'apoio', nome: 'Agradecer o apoio', texto: 'Muito obrigado pelo apoio! Seguimos juntos. 🙏' },
  {
    id: 'dia-25',
    // **O nome carrega a data de proposito:** texto com prazo dentro envelhece sozinho (19/10), e
    // assim ele VE que este e datado ao olhar o botao, sem precisar abrir.
    nome: 'Dia 25 — 2o turno',
    texto: 'Dia 25 é 22! Leva a família e os amigos para votar. 💪',
  },
  {
    id: 'privado',
    // Pedido pessoal NAO se nega em publico — e a regra do canal. Aqui so se muda de lugar.
    nome: 'Pro privado',
    texto: 'Me chama na mensagem da página que a gente vê isso com calma por lá.',
  },
  {
    id: 'informacao',
    // Agradece e NAO opina: denuncia e acusacao politica nao se discute (regra dele, 23/09).
    nome: 'Obrigado pela info',
    texto: 'Obrigado por trazer, vamos acompanhar. 🙏',
  },
  {
    id: 'junto',
    // Quem xinga o adversario esta do nosso lado: agradece, nunca modera (regra 17, 25/09).
    nome: 'Está junto',
    texto: 'É isso aí! Obrigado por estar junto nessa. 💪',
  },
  { id: 'acompanhe', nome: 'Seguir a página', texto: 'Obrigado! Segue a página para não perder nada. 👊' },
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
 * Um backup editado a mao, ou uma versao futura com outro formato, nao pode virar botao que manda
 * `undefined` para a pagina publica.
 *
 * Item sem texto e DESCARTADO (botao que nao escreve nada e botao que confunde); id repetido ou
 * ausente ganha id novo; nome vazio volta a sair do texto.
 */
export function sanitizar(lista) {
  const vistos = new Set();
  const saida = [];
  for (const item of Array.isArray(lista) ? lista : []) {
    if (saida.length >= MAX_RESPOSTAS) break;
    const texto = String(item?.texto || '').trim().slice(0, MAX_TEXTO);
    if (!texto) continue;
    let id = String(item?.id || '').trim();
    if (!id || vistos.has(id)) id = novoId();
    vistos.add(id);
    const nome = String(item?.nome || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOME);
    saida.push({ id, nome: nome || nomeDoTexto(texto), texto });
  }
  return saida;
}

/**
 * Guarda o texto do campo como resposta rapida.
 *
 * **Texto igual nao vira segunda entrada:** ele clicaria em guardar duas vezes sem perceber, e duas
 * linhas identicas na tira sao dois botoes que fazem a mesma coisa. Devolve `jaExistia` para a tela
 * poder dizer isso em vez de fingir que guardou.
 *
 * @returns {{lista:object[], id:string, jaExistia:boolean, cheia:boolean}}
 */
export function guardar(lista, texto) {
  const atual = sanitizar(lista);
  const limpo = String(texto || '').trim().slice(0, MAX_TEXTO);
  if (!limpo) return { lista: atual, id: '', jaExistia: false, cheia: false };

  const igual = atual.find((r) => r.texto === limpo);
  if (igual) return { lista: atual, id: igual.id, jaExistia: true, cheia: false };

  if (atual.length >= MAX_RESPOSTAS) return { lista: atual, id: '', jaExistia: false, cheia: true };

  const id = novoId();
  return { lista: [...atual, { id, nome: nomeDoTexto(limpo), texto: limpo }], id, jaExistia: false, cheia: false };
}

/** Renomear so muda o ROTULO. Nome vazio volta a sair do texto, nunca fica em branco. */
export function renomear(lista, id, nome) {
  return sanitizar(lista).map((r) =>
    r.id === id
      ? { ...r, nome: String(nome || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOME) || nomeDoTexto(r.texto) }
      : r
  );
}

/**
 * Apagar, **devolvendo o texto junto**.
 *
 * O painel poe esse texto no campo: assim apagar nunca perde o que ele escreveu — um clique em
 * guardar traz de volta. E o desfazer barato que a regra de 01/09 pede sem precisar de pilha.
 *
 * @returns {{lista:object[], texto:string}}
 */
export function apagar(lista, id) {
  const atual = sanitizar(lista);
  const fora = atual.find((r) => r.id === id);
  return { lista: atual.filter((r) => r.id !== id), texto: fora ? fora.texto : '' };
}
