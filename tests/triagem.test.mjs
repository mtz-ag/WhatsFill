/**
 * Quem a rodada põe de lado para o Thiago ver em pessoa.
 *
 * O erro que este arquivo existe para impedir é o FALSO NEGATIVO: a rodada mandando um pedido de
 * dados para quem acabou de contar que está sem comida, ou o mandato respondendo sozinho a pedido
 * de dinheiro — que é o caso com risco jurídico (Lei 9.504/97).
 *
 * O falso POSITIVO também tem custo, e é o mais fácil de cometer: "ajuda" é a mesma palavra dos
 * dois lados da campanha. Metade das asserções aqui é sobre apoiador OFERECENDO ajuda continuar
 * passando pela rodada normalmente.
 */
import { check, grupo, fim } from './_harness.mjs';
import { precisaDeVoce } from '../src/lib/triagem.js';

const pede = (t) => precisaDeVoce([t]);

grupo('pedido de dinheiro: o caso que nunca pode ser automático');
{
  check(pede('Oi, você teria como me mandar um pix de 50 reais?')?.motivo === 'falou em dinheiro', 'pix');
  check(!!pede('preciso de dinheiro para comprar comida'), 'dinheiro dito com todas as letras');
  check(!!pede('me ajuda com um valor aí pelo amor de Deus'), 'ajuda + valor');
  check(!!pede('consegue me emprestar R$ 200?'), 'valor com R$');
  check(!!pede('faz um deposito pra mim'), 'depósito');
}

grupo('ajuda material');
{
  check(pede('minha família está precisando de uma cesta básica')?.motivo === 'pediu cesta básica', 'cesta básica');
  check(!!pede('preciso de um remédio que a farmácia popular não tem'), 'remédio');
  check(!!pede('estou pra ser despejado, o aluguel venceu'), 'aluguel');
  check(!!pede('não tenho o que comer em casa'), 'sem comida');
  check(!!pede('preciso de passagem pra consulta em Porto Alegre'), 'passagem para consulta');
}

grupo('emprego: mesma família, mesmo cuidado');
{
  check(!!pede('estou desempregado faz seis meses'), 'desempregado');
  check(!!pede('procuro emprego, tem alguma vaga aí?'), 'procura emprego');
  check(!!pede('posso mandar meu curriculo?'), 'currículo');
  check(!!pede('preciso arrumar um trabalho, qualquer coisa serve'), 'precisa de trabalho');
}

grupo('APOIADOR OFERECENDO AJUDA continua na rodada — a armadilha central');
{
  // Este é o público principal da campanha. Marcar essa gente para revisão manual pararia o
  // trabalho: "ajuda" é a mesma palavra dos dois lados.
  check(pede('quero ajudar bastante na campanha') === null, '"quero ajudar" não é pedido');
  check(pede('Posso ajudar de alguma forma?') === null, '"posso ajudar" não é pedido');
  check(pede('como posso ajudar o Capitão?') === null, '"como posso ajudar"');
  check(pede('conte comigo aqui na minha cidade') === null, '"conte comigo"');
  check(pede('estou à disposição para o que precisar') === null, '"à disposição"');
  check(pede('quero ser voluntário') === null, 'voluntário');
  check(pede('ajudo quando posso, sou apoiador') === null, '"ajudo quando posso"');

  // O caso que quebra o padrão ingênuo: a palavra "dinheiro" numa OFERTA.
  check(pede('quero ajudar de qualquer forma, nem que seja com dinheiro') === null,
    'oferta desarma a mensagem inteira, mesmo citando dinheiro');
}

grupo('conversa normal não vira revisão');
{
  check(pede('Olá! Eu aceito receber conteúdos do Flávio e do Cap Martim') === null, 'aceite do anúncio');
  check(pede('Maria Silva / Santo Ângelo') === null, 'resposta do formulário');
  check(pede('Bom dia, Deus abençoe!') === null, 'saudação de fé');
  check(pede('') === null, 'mensagem vazia');
  check(precisaDeVoce([]) === null, 'sem mensagem nenhuma');
  check(precisaDeVoce(null) === null, 'lista nula não explode');
}

grupo('olha todas as mensagens, e devolve o trecho para conferência');
{
  // O motivo é o MAIS ESPECÍFICO que casar, não o primeiro genérico: "ajuda com o aluguel" vira
  // "pediu ajuda com contas", que é o que ele precisa ler na caixa para decidir sem abrir a
  // conversa. A ordem das regras é o que garante isso.
  const r = precisaDeVoce(['Boa tarde', 'sou de Pelotas', 'preciso muito de uma ajuda com o aluguel']);
  check(r?.motivo === 'pediu ajuda com contas', `achou na terceira mensagem = ${JSON.stringify(r)}`);
  check(/ajuda/.test(r?.trecho || ''), `o trecho mostra o que casou = ${r?.trecho}`);

  // Mensagem longa é recortada — a caixa da rodada não pode virar parede de texto.
  const longa = 'bom dia '.repeat(40) + 'preciso de uma ajuda';
  const rr = precisaDeVoce([longa]);
  check(rr && rr.trecho.length <= 95, `trecho recortado = ${rr?.trecho.length} caracteres`);
}

grupo('padrões da Config entram, e padrão quebrado não derruba a rodada');
{
  const r = precisaDeVoce(['quero falar sobre a escola do meu bairro'], ['escola']);
  check(r?.motivo === 'casou com um padrão seu', `padrão extra casou = ${JSON.stringify(r)}`);

  check(precisaDeVoce(['qualquer coisa'], ['(regex ['] ) === null, 'regex inválida é ignorada, não explode');
  check(precisaDeVoce(['qualquer coisa'], ['', '  ']) === null, 'padrão vazio não casa com tudo');
}

fim();
