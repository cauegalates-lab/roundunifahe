ROUND 1 UNIFAHE — Painel conectado ao Google Sheets
===================================================

Arquivos principais:
- index.html: página principal
- css/style.css: visual do painel
- js/config.js: baias, membros, fotos, logos, regras do cofre e URL da planilha
- js/app.js: leitura da planilha, totais, ranking, cofre, animações e contador
- google-apps-script/Code.gs: script para colar no Apps Script da planilha
- google-apps-script/README.txt: passo a passo resumido da integração

Formato atual da planilha:
Crie uma aba chamada config e use estes cabeçalhos na primeira linha:

Baia | Boleto | Cartão | Quantidade | Valor do Cofre

Como o painel usa esses campos:
- Baia: nome da baia/time.
- Boleto: quantidade total de boletos daquela baia.
- Cartão: valor faturado daquela baia.
- Quantidade: quantidade total de vendas, usada no ranking como informação complementar.
- Valor do Cofre: valor que vai direto para o prêmio acumulado do cofre.

Exemplo:
PREDADORES | 3 | R$ 4.000,00 | 5 | R$ 26,00

Regra sugerida para calcular o Valor do Cofre na planilha:
- A cada R$ 1.000 de faturado/cartão: R$ 5 no cofre.
- A cada 1 boleto: R$ 2 no cofre.

Exemplo de fórmula na coluna Valor do Cofre, considerando:
B = Boleto
C = Cartão/Faturado

=ARREDONDAR.PARA.BAIXO(C2/1000;0)*5 + B2*2

O que mudou nesta versão:
- Os cards das baias mostram FATURADO e BOLETOS juntos, alinhados na ponta da linha.
- O valor acumulado do cofre vem da coluna Valor do Cofre da planilha.
- Se Valor do Cofre estiver vazio, o script calcula como fallback usando R$ 5 por R$ 1.000 faturado + R$ 2 por boleto.
- A área de lançamento manual de vendas continua removida.
- O X/status manual dos membros continua removido.

Como conectar:
1. Abra sua planilha no Google Sheets.
2. Crie uma aba chamada config.
3. Use estes cabeçalhos na primeira linha:
   Baia | Boleto | Cartão | Quantidade | Valor do Cofre
4. Vá em Extensões > Apps Script.
5. Cole o conteúdo de google-apps-script/Code.gs.
6. Publique como Aplicativo da Web.
7. Copie a URL final /exec.
8. Cole essa URL em js/config.js no campo:
   googleSheets.webAppUrl
9. Publique o site novamente.

Observação:
- Os nomes das baias precisam bater com os nomes do site: PREDADORES, INVICTUS, EVOLUTION, VIP, WINX, ALFAS e GOAT.

AJUSTE DE ANIMAÇÃO DO COFRE
- O site compara o último valor do cofre salvo no navegador com o novo valor vindo da planilha.
- Quando o Valor do Cofre aumenta, a animação do dinheiro caindo é disparada automaticamente.
- Quando a Quantidade/vendas, boletos ou faturamento aumentam sem alterar imediatamente o Valor do Cofre, o efeito visual também é disparado.
- A atualização automática da planilha está configurada para rodar a cada 10 segundos.
- Se a página for recarregada depois da alteração na planilha, a animação também pode disparar usando o último valor salvo no localStorage.

STATUS DOS VENDEDORES
- O Apps Script também lê uma aba chamada Vendedores.
- A aba Vendedores deve ter os cabeçalhos:
  Vendedor | STATUS
- Use STATUS = ativo para deixar a foto normal.
- Use STATUS = eliminado para escurecer a foto e mostrar um X vermelho no meio.
- A comparação pelo nome ignora acentos, maiúsculas/minúsculas e espaços extras.
- Se a aba Vendedores não existir, todos ficam normais.
