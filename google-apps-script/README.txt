PASSO RESUMIDO PARA CONECTAR A PLANILHA AO FIREBASE
===================================================

1. Crie uma aba chamada config no Google Sheets.
2. Na primeira linha, use estes cabeçalhos:
   Baia | Boleto | Cartão | Quantidade | Valor do Cofre
3. Preencha uma linha por baia.
4. A coluna Cartão deve representar o valor faturado da baia.
5. A coluna Boleto deve representar o total de boletos da baia.
6. A coluna Valor do Cofre deve ser o valor que entra direto no cofre.
7. Fórmula sugerida para Valor do Cofre:
   =ARREDONDAR.PARA.BAIXO(C2/1000;0)*5 + B2*2
8. Em Extensões > Apps Script, cole o conteúdo do arquivo Code.gs.
9. No topo do Code.gs, preencha:
   USAR_FIREBASE: true
   FIREBASE_DATABASE_URL: URL real do seu Realtime Database
   FIREBASE_CAMINHO_DASHBOARD: round6/dashboard
10. No Apps Script, rode a função:
    instalarGatilhosFirebaseRound6
11. Autorize o script.
12. Rode a função:
    testarFirebaseRound6
13. Confira no Firebase se o caminho round6/dashboard foi criado.

FUNÇÕES IMPORTANTES
===================

publicarFirebaseRound6
- Monta os dados da planilha e envia para o Firebase.

instalarGatilhosFirebaseRound6
- Cria um gatilho instalável ao editar a planilha.
- Cria também um gatilho de segurança a cada 1 minuto, útil quando alguma fórmula recalcular.
- Envia os dados uma vez imediatamente.

testarFirebaseRound6
- Envia uma vez e grava o resultado no log.

FALLBACK ANTIGO
===============

O doGet continua existindo.
Se quiser manter o modo antigo por Apps Script Web App, ainda pode publicar como Aplicativo da Web e usar a URL /exec em js/config.js.

ABA OPCIONAL DE VENDEDORES
==========================

1. Para mostrar o X vermelho nos vendedores eliminados, crie uma aba chamada Vendedores.
2. Na primeira linha, use estes cabeçalhos:
   Vendedor | STATUS
3. Use STATUS = ativo para foto normal e STATUS = eliminado para foto com X vermelho.
4. O nome do vendedor será comparado com os nomes cadastrados no site.
