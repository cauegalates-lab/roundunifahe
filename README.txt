ROUND 1 UNIFAHE — Painel com Firebase Realtime Database
=======================================================

Arquivos principais:
- index.html: página principal
- css/style.css: visual do painel
- js/config.js: baias, membros, fotos, logos, regras, Firebase e fallback da planilha
- js/app.js: Firebase em tempo real, fallback da planilha, totais, ranking, cofre, animações e contador
- google-apps-script/Code.gs: script para colar no Apps Script da planilha
- google-apps-script/README.txt: passo a passo da integração

O que mudou nesta versão:
- O painel agora está preparado para usar Firebase Realtime Database.
- Quando o Firebase estiver habilitado, a página fica ouvindo o caminho round6/dashboard em tempo real.
- O polling de 10 segundos fica como fallback somente se o Firebase estiver desativado ou sem configuração.
- A comparação de assinatura/hash do dashboard continua ativa.
- Se os dados recebidos forem iguais, o painel não redesenha ranking, cards, cofre, baias ou valores.
- Se o valor/venda aumentar, mantém a animação de dinheiro caindo.
- Se venda/valor diminuir, atualiza sem disparar animação de nova venda.
- Se chegar atualização durante animação, ela fica pendente e só é aplicada depois da animação.
- Layout, estilos, cards, nomes, fotos, ranking, cofre e animações visuais foram preservados.

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
=ARREDONDAR.PARA.BAIXO(C2/1000;0)*5 + B2*2

COMO ATIVAR O FIREBASE
======================

1. Acesse o console do Firebase.
2. Crie um projeto.
3. Crie um app Web no projeto.
4. Copie a configuração do app Web.
5. Ative o Realtime Database.
6. Em js/config.js, preencha o bloco firebase:

firebase: {
  habilitado: true,
  apiKey: '...',
  authDomain: '...',
  databaseURL: '...',
  projectId: '...',
  storageBucket: '...',
  messagingSenderId: '...',
  appId: '...',
  caminhoDashboard: 'round6/dashboard'
}

7. No Apps Script da planilha, cole o conteúdo de google-apps-script/Code.gs.
8. No topo do Code.gs, preencha:

USAR_FIREBASE: true,
FIREBASE_DATABASE_URL: 'https://round6-unifahe-default-rtdb.firebaseio.com',
FIREBASE_CAMINHO_DASHBOARD: 'round6/dashboard'

9. No Apps Script, rode a função:

instalarGatilhosFirebaseRound6

10. Autorize o script.
11. Rode também a função:

testarFirebaseRound6

12. Abra o Firebase Realtime Database e confira se apareceu o caminho:

round6/dashboard

13. Publique o site no GitHub Pages.

REGRAS DO FIREBASE PARA TESTE
=============================

Para testar rápido, é possível usar regras abertas no caminho do painel:

{
  "rules": {
    "round6": {
      "dashboard": {
        ".read": true,
        ".write": true
      }
    }
  }
}

Observação importante:
Essas regras abertas são práticas para teste e painel interno, mas não são a opção mais segura para produção pública. Se o painel ficar público, o ideal é proteger a escrita usando autenticação, Cloud Function ou outro backend controlado.

FALLBACK ANTIGO
===============

Se firebase.habilitado estiver false, o site continua usando o modo antigo:
Google Sheets / Apps Script Web App + verificação a cada 10 segundos.

STATUS DOS VENDEDORES
=====================

- O Apps Script também lê uma aba chamada Vendedores.
- A aba Vendedores deve ter os cabeçalhos:
  Vendedor | STATUS
- Use STATUS = ativo para deixar a foto normal.
- Use STATUS = eliminado para escurecer a foto e mostrar um X vermelho no meio.
- A comparação pelo nome ignora acentos, maiúsculas/minúsculas e espaços extras.
- Se a aba Vendedores não existir, todos ficam normais.
