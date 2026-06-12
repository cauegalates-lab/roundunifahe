PASSO RESUMIDO PARA CONECTAR A PLANILHA

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
9. Clique em Implantar > Nova implantação > Aplicativo da Web.
10. Configure:
    Executar como: eu
    Quem pode acessar: qualquer pessoa
11. Autorize o script e copie a URL final que termina com /exec.
12. No site, abra js/config.js e cole a URL no campo:
    googleSheets.webAppUrl
13. Publique novamente o site.

ABA OPCIONAL DE VENDEDORES
14. Para mostrar o X vermelho nos vendedores eliminados, crie uma aba chamada Vendedores.
15. Na primeira linha, use estes cabeçalhos:
    Vendedor | STATUS
16. Use STATUS = ativo para foto normal e STATUS = eliminado para foto com X vermelho.
17. O nome do vendedor será comparado com os nomes cadastrados no site.
