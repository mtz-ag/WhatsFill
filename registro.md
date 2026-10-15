## 2026-10-15 - v3.163.0 - a campanha acabou, e a regra continuava oferecendo vaga nela

**Print dele:** o contato mandou uma foto e escreveu so *"Quanto paga?"*. As 16:10 saiu *"Boa
tarde! Infelizmente nao estamos contratando, so estamos trabalhando com voluntarios, sem
remuneracao. Se tiver interesse nesse formato, me avise."*; ele apagou e digitou, a mao, *"boa tarde
somos da equipe do capitao martim em que podemos ajudar?"*. Relato: *"resposta ainda se tratando de
campanha, a campanha acabou do martim e a conversa era um provavel engano de remetente"*.

### Quem escreveu aquilo foi a REGRA 12, e a medicao disse isso antes de eu mexer

O texto e **byte a byte** o modelo que estava escrito nela: a frase dele de 25/09 (*"infelizmente
nao estamos contratando, so estamos trabalhando com voluntarios, sem remuneracao"*) mais o convite
do fim (*"se tiver interesse nesse formato, me avise"*).

**Nao foi resposta pronta e nao foi o detector.** Medido: `pedeEmprego` **nao chega a IA** — nao
esta em nenhum argumento de `rascunhar` —, e quem mandou o caso para la foi `pergunta-aberta`
(tecla 6). A regra 12 esta em TODA chamada e foi puxada pela proximidade com a palavra "paga".

**E o fato que a desmentia nao chegava junto:** medido, *"Quanto paga?"* nao aciona
`precisaDoDossie`, entao as linhas do dossie que dizem que a eleicao foi em **04/10** e que cinco
dos seis cargos estao decididos **nunca entram nessa conversa**. E a licao de 07/09 outra vez —
regra longe do pedido nao e cumprida —, e por isso o fato passou a ser escrito DENTRO da regra.

### O que mudou na regra 12

- **o modelo a copiar virou uma frase so:** *"infelizmente nao estamos contratando"*, e PARE;
- **o convite ao voluntariado saiu do modelo e virou frase PROIBIDA**, com as palavras escritas
  (proibicao que nao nomeia a frase nao diz ao modelo qual evitar). A campanha acabou: oferecer
  vaga de voluntario nela e a **porta que nao abre** da regra 7, com quem aceitar esperando um
  chamado que nao vem;
- **"a campanha acabou" entrou na lista do que NAO se diz ao eleitor**, junto da equipe paga e dos
  contratos da pre-campanha: e motivo interno, e dito vira *"e quando abre a proxima?"*;
- **escopo**: *"Quanto paga?"*, *"quanto voces pagam?"* e *"qual o valor?"* soltos nao sao pedido de
  vaga — sao engano de destinatario, e a resposta e a da **regra 9**, que e exatamente a frase que
  ele digitou a mao. E a licao registrada tres vezes em 10/09: ao escrever regra sobre um assunto,
  escreva tambem o que ela NAO cobre.

### E o detector decidia sozinho dizendo que nao decidia

`MENCIONA_REMUNERACAO` era um dos itens de `QUER_TRABALHAR`, entao *"Quanto paga?"* sozinho devolvia
`{tipo: 'campanha'}` — **com o comentario logo acima dela afirmando o contrario** (*"sozinha ela nao
decide nada: so e lida depois de `QUER_TRABALHAR` ja ter casado"*). O "comentario que descreve a
ordem nao e a ordem" (01/09) numa lista.

Hoje sao duas: **`REMUNERACAO_DO_TRABALHO`** decide sozinha (quanto VOU GANHAR, salario, remunerado,
ser pago — ninguem pergunta isso sobre outra coisa) e **`PRECO_SOLTO`** nao (quanto paga, qual o
valor — o que se pergunta a qualquer anuncio de venda). Juntas continuam decidindo o TIPO depois que
outra forma ja casou, entao o caso do Luciano (09/09) segue `campanha`, e a guarda literal de 05/09
(*"e remunerado ou voluntario?"*) segue sendo pedido.

### Medido

- *"Quanto paga?"*, *"qual o valor?"* e *"qual o valor do bone?"* -> **null** (antes: `campanha`);
- *"e remunerado ou voluntario?"*, *"quanto vou ganhar?"*, *"qual o salario?"* -> **continuam**;
- Luciano (*"trabalhar aqui para o Capitao Martim"* + *"combinarmos quanto vou ganhar"*) ->
  `campanha`; vaga + preco na mesma rajada -> `campanha`;
- 21 suites e os dois verificadores verdes.

### O que NAO entrou, e e decisao dele

- **Se continua havendo trabalho voluntario para o MANDATO** (ele foi reeleito), a frase que convida
  e uma linha e as palavras sao dele. Enquanto ele nao disser, a regra fecha a porta sem oferecer
  nada: prometer o que nao se sabe que existe e o *"procure a coordenacao"* pela outra porta.
- **A resposta pronta `trabalhar-na-campanha` continua com o texto antigo** (*"aqui a gente trabalha
  so com voluntarios"* + pedido de endereco). Medido: as tres caixas do quadro exportado mandam o
  caso para a IA (`ia: true`), entao ela **nao sai pelo fluxo** — mas sai pelo botao da aba
  Respostas. Texto que vai para eleitor e dele.
- **`"voces estao contratando?"` nao e reconhecido** (medido, e ja era assim antes desta versao): o
  padrao exige um objeto depois do verbo (*"contratando gente"*). O comentario do codigo diz que
  essa forma e coberta — e a mesma classe do comentario que eu acabei de consertar. Nao mexi junto
  porque alarga o detector no commit que o estreita, e aqui se muda uma coisa por vez.
