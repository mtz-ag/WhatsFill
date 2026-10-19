## 2026-10-19 - v3.173.0 - ESTADO DE AGORA - o texto dizia que ele ainda esta em campanha

**Print dele**, com a mensagem apagada na plataforma: *"resposta como se o martim ainda estivesse em
campanha, ele ja se elegeu, estamos apoiando o flavio bolsonaro ate dia 25, pesquise"*.

### Medido antes de mexer: NAO foi a IA

O que saiu e **byte a byte a terceira variante** da resposta pronta `falar-com-deputado` —
*"Agora, em campanha, quem quer falar com ele pessoalmente encontra nos eventos da agenda"*. E o
defeito estava nas **tres**, cada uma com a sua redacao da mesma clausula:

| | abertura do 2o paragrafo |
|---|---|
| texto base | *"Neste periodo de eleicoes, o jeito de encontra-lo..."* |
| variante 1 | *"Em periodo eleitoral, o encontro pessoal acontece..."* |
| variante 2 | *"Agora, em campanha, quem quer falar com ele..."* |

**E a mesma clausula estava na regra 8 do prompt** (*"em periodo eleitoral, o unico caminho e
encontra-lo nos EVENTOS DA AGENDA"*), entao a IA escreveria igual pelo outro caminho.

### A pesquisa que ele pediu, confirmada

**2o turno em 25/10/2026, Flavio Bolsonaro x Lula** — no 1o turno de 04/10 Flavio fez **47,05%** e
Lula **45,14%**, e ninguem alcancou a maioria. O que o dossie ja dizia desde 14/10 continua valendo:
o Capitao Martim foi **reeleito** e **cinco dos seis cargos da colinha estao decididos**.

### O conserto: a clausula de TEMPO saiu inteira

**Nao e so a palavra "campanha".** A resposta e verdadeira em qualquer periodo — ele e encontrado
nos eventos da agenda —, e a clausula so existia para justificar. **Texto com data dentro envelhece
sozinho**, e esta semana ja pagou isso duas vezes (a regra 19 e o item 5 do dossie nascem com prazo
marcado para 25/10). Sem clausula, o texto continua certo depois do dia 25.

**E ela NAO escreve "a eleicao acabou" no lugar** — seria o erro de 16/10 outra vez: a eleicao nao
acabou, o 2o turno e dia 25. O que acabou foi a **candidatura dele**. Tirar nao afirma nada sobre o
periodo.

### A metade que faz o conserto chegar nele

Trocar o texto de FABRICA nao alcanca ninguem: a lista dele esta gravada, e `store.get` so mescla
default em chave que **FALTA** — a armadilha do `-contato-assessor` (04/09) e a razao de
`migrarGabineteParaEquipe` existir (07/09). Hoje ha
`templates.migrarFalarComDeputadoSemCampanha`: roda **uma vez**, com flag propria, e **so mexe em
`falar-com-deputado`** — "campanha" e palavra legitima nas outras respostas, e passada larga
reescreveria texto que esta certo.

**Texto que ele tenha editado passa intacto**: a clausula e casada no comeco do paragrafo, e nao
achando, nada e tocado.

- 22 suites e os dois verificadores verdes. **Vale no proximo carregamento do painel**, sem ele
  importar nem configurar nada.

### O que fica para ele

- **A Assembleia continua fora** — decisao dele de 08/09, e o teste trava as tres ausencias (sem
  Assembleia, sem promessa de levar recado, sem `{{link_grupo}}`). O que mudou foi so a
  justificativa: a proibicao deixou de ser *"agora esta fora de questao"* e virou decisao dele, sem
  prazo. **Passado o dia 25, se a Assembleia voltar a ser uma opcao, e ele quem diz.**
- **A resposta do voluntariado (`trabalhar-na-campanha`) nao foi tocada.** O texto nao afirma que a
  campanha e dele e continua verdadeiro para o 2o turno — mas a **regra 12** do prompt manda NAO
  oferecer voluntariado (escrita em 15/10, quando a campanha dele tinha acabado). Apoiando o Flavio
  ate o dia 25, isso pode ter virado o contrario: **e decisao dele.**
- **O disparo da colinha continua configurado pedindo voto** nos cargos ja decididos, e o
  `pedir-dados` dele continua com o Instagram e o grupo da campanha encerrada.
- **Com prazo:** passado 25/10, a regra 19 e o item 5 do dossie tem de ser reescritos.
