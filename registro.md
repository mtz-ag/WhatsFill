## 2026-10-14 - v3.157.0 - o aviso de colisao dizia a consequencia errada para a etiqueta do disparo

**Print dele** com o cartao novo "Etiquetas que a rodada REMOVE" em uso, e a caixa de aviso em cima
de **"1 TESTE DISPARO"** dizendo: *"esta nesta lista E num dos campos que a rodada APLICA — ela vai
sair e voltar em toda passada, uma escrita por contato sem nada mudar no fim"*.

**A frase e falsa para aquele campo.** Medido: `auto.etiquetaLote` e aplicada em `processarLote` —
a rodada do DISPARO, que e outro percurso e **nem remove etiqueta**. Nao ha oscilacao por passada: a
remocao mora em `processarRespondido` (a rodada do fluxo) e a aplicacao so acontece quando ele
dispara.

### O erro foi juntar cinco campos numa frase so

Dos cinco que a conferencia olha, **quatro sao da rodada do fluxo** (sem interesse, pedido, endereco,
fora do RS) e um e do disparo. Para os quatro a frase esta certa. Para o do disparo a consequencia e
outra, e e o oposto de inofensiva: **aquela etiqueta e a memoria que impede o reenvio** (ela entra no
`exceptTagsId`), entao tira-la **devolve essas pessoas para os proximos lotes** — que pode ser
exatamente o que ele quer depois de um teste, mas nao e "nada mudar no fim".

Hoje `lote.colisaoDeRemocao` recebe `{ nome, rotulo, onde }` e devolve os tres. A tela escreve uma
frase por caso **e NOMEIA o campo**, em vez de mandar procurar entre cinco.

### E a conferencia tem um buraco, que agora esta escrito na tela

Ela olha os cinco campos de etiqueta das abas Automatizado e Disparo. **Nao enxerga a tabela
"Etiqueta por palavra do que saiu"** (aba Config): ela mora numa chave propria, fora de `auto`, e e
lida de forma assincrona — o cartao desenha com o `cfg` que ja esta em memoria. Etiqueta listada
para remover que esteja naquela tabela **tambem volta sozinha**, e a linha nova diz isso.

### Medido

- 21 suites e os dois verificadores verdes. As assercoes da colisao foram reescritas para exigir o
  `onde` certo nos dois casos, mais o campo nomeado e o padrao seguro (campo sem `onde` cai em
  `rodada`, que e o mais comum e o mais barato de errar para).
- **Nada mudou no comportamento da remocao** — so o texto do aviso e o que ele devolve. A rodada
  continua tirando as etiquetas listadas de quem ela atende, com a sonda de uma releitura por rodada.
