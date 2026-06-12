const CONFIG_ROUND6 = {
  ABA_DADOS: 'config',
  ABA_FALLBACK: 'config',
  ABA_VENDEDORES: 'Vendedores',
  LINHA_CABECALHO: 1,
  TIMEZONE: 'America/Sao_Paulo',
  VALOR_POR_MILHAR: 5,
  VALOR_POR_BOLETO: 2,

  // Firebase Realtime Database
  // Preencha com a URL do banco e mude USAR_FIREBASE para true após criar o projeto.
  USAR_FIREBASE: true,
  FIREBASE_DATABASE_URL: 'https://round6-unifahe-default-rtdb.firebaseio.com',
  FIREBASE_CAMINHO_DASHBOARD: 'round6/dashboard',
  FIREBASE_AUTH_PARAM: '',
  BAIAS: [
    { id: 'predadores', nome: 'PREDADORES' },
    { id: 'invictus', nome: 'INVICTUS' },
    { id: 'evolution', nome: 'EVOLUTION' },
    { id: 'vip', nome: 'VIP' },
    { id: 'winx', nome: 'WINX' },
    { id: 'alfas', nome: 'ALFAS' },
    { id: 'goat', nome: 'GOAT' }
  ]
};

function doGet(e) {
  const payload = montarDashboardRound6_();
  const callback = e && e.parameter && e.parameter.callback;
  const json = JSON.stringify(payload);
  const output = ContentService.createTextOutput(callback ? `${callback}(${json});` : json);
  output.setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  return output;
}

function publicarFirebaseRound6() {
  const dashboard = montarDashboardRound6_();
  enviarDashboardFirebaseRound6_(dashboard);
  return dashboard;
}

function testarFirebaseRound6() {
  const dashboard = publicarFirebaseRound6();
  Logger.log('Dashboard enviado para o Firebase:');
  Logger.log(JSON.stringify(dashboard, null, 2));
}

function instalarGatilhosFirebaseRound6() {
  removerGatilhosFirebaseRound6_();

  ScriptApp.newTrigger('aoEditarFirebaseRound6_')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  ScriptApp.newTrigger('atualizarFirebaseRound6Minuto_')
    .timeBased()
    .everyMinutes(1)
    .create();

  publicarFirebaseRound6();
}

function removerGatilhosFirebaseRound6_() {
  const funcoes = ['aoEditarFirebaseRound6_', 'atualizarFirebaseRound6Minuto_'];
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (funcoes.includes(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function aoEditarFirebaseRound6_(e) {
  publicarFirebaseRound6();
}

function atualizarFirebaseRound6Minuto_() {
  publicarFirebaseRound6();
}

function enviarDashboardFirebaseRound6_(dashboard) {
  if (CONFIG_ROUND6.USAR_FIREBASE !== true) {
    throw new Error('Ative CONFIG_ROUND6.USAR_FIREBASE e preencha FIREBASE_DATABASE_URL antes de publicar no Firebase.');
  }

  const databaseUrl = String(CONFIG_ROUND6.FIREBASE_DATABASE_URL || '').replace(/\/+$/, '');
  const caminho = String(CONFIG_ROUND6.FIREBASE_CAMINHO_DASHBOARD || 'round6/dashboard').replace(/^\/+|\/+$/g, '');

  if (!databaseUrl || databaseUrl.includes('SEU-PROJETO')) {
    throw new Error('Preencha CONFIG_ROUND6.FIREBASE_DATABASE_URL com a URL real do Realtime Database.');
  }

  const auth = String(CONFIG_ROUND6.FIREBASE_AUTH_PARAM || '').trim();
  const url = `${databaseUrl}/${caminho}.json${auth ? `?auth=${encodeURIComponent(auth)}` : ''}`;
  const payload = {
    origem: 'google-sheets',
    publicadoEm: new Date().toISOString(),
    dashboard
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json; charset=utf-8',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(`Firebase retornou HTTP ${status}: ${response.getContentText()}`);
  }

  return response.getContentText();
}

function montarDashboardRound6_() {
  const sheet = obterAbaDadosRound6_();
  if (!sheet) {
    throw new Error(`Crie uma aba chamada "${CONFIG_ROUND6.ABA_DADOS}" com as colunas: Baia | Boleto | Cartão | Quantidade | Valor do Cofre.`);
  }

  const values = sheet.getDataRange().getValues();
  if (values.length <= CONFIG_ROUND6.LINHA_CABECALHO) {
    return montarRespostaRound6_({});
  }

  const headers = values[CONFIG_ROUND6.LINHA_CABECALHO - 1].map(normalizarRound6_);
  const col = {
    baia: encontrarColunaRound6_(headers, ['baia', 'baía', 'time', 'equipe', 'grupo']),
    boleto: encontrarColunaRound6_(headers, ['boleto', 'boletos', 'total boleto', 'total boletos']),
    cartao: encontrarColunaRound6_(headers, ['cartao', 'cartão', 'faturado', 'valor faturado', 'total faturado', 'valor cartao', 'valor cartão', 'total cartao', 'total cartão']),
    quantidade: encontrarColunaRound6_(headers, ['quantidade', 'qtd', 'vendas', 'total vendas']),
    valorCofre: encontrarColunaRound6_(headers, ['valor do cofre', 'valor cofre', 'cofre', 'prêmio', 'premio', 'valor premio', 'valor prêmio'])
  };

  if (col.baia === -1) {
    throw new Error('A planilha precisa ter a coluna Baia. Cabeçalhos esperados: Baia | Boleto | Cartão | Quantidade | Valor do Cofre.');
  }

  const acumulado = {};
  CONFIG_ROUND6.BAIAS.forEach(baia => {
    acumulado[baia.id] = {
      id: baia.id,
      nome: baia.nome,
      realizado: 0,
      vendasConfirmadas: 0,
      boletos: 0,
      valorCofre: 0
    };
  });

  values.slice(CONFIG_ROUND6.LINHA_CABECALHO).forEach(row => {
    if (linhaVaziaRound6_(row)) return;

    const baia = encontrarBaiaRound6_(row[col.baia]);
    if (!baia) return;

    const item = acumulado[baia.id];
    const faturado = col.cartao !== -1 ? numeroRound6_(row[col.cartao]) : 0;
    const boletos = col.boleto !== -1 ? inteiroRound6_(row[col.boleto]) : 0;
    const quantidade = col.quantidade !== -1 ? inteiroRound6_(row[col.quantidade]) : 0;
    const valorCofreCelula = col.valorCofre !== -1 ? row[col.valorCofre] : '';
    const valorCofre = valorPreenchidoRound6_(valorCofreCelula)
      ? numeroRound6_(valorCofreCelula)
      : calcularCofreRound6_(faturado, boletos);

    item.realizado += faturado;
    item.boletos += boletos;
    item.vendasConfirmadas += quantidade;
    item.valorCofre += valorCofre;
  });

  return montarRespostaRound6_(acumulado);
}

function obterAbaDadosRound6_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const direta = ss.getSheetByName(CONFIG_ROUND6.ABA_DADOS) || ss.getSheetByName(CONFIG_ROUND6.ABA_FALLBACK);
  if (direta) return direta;

  return ss.getSheets().find(sheet => {
    const range = sheet.getRange(CONFIG_ROUND6.LINHA_CABECALHO, 1, 1, Math.max(1, sheet.getLastColumn()));
    const headers = range.getValues()[0].map(normalizarRound6_);
    return headers.includes('baia') || headers.includes('baía');
  }) || null;
}

function montarRespostaRound6_(acumulado) {
  const vendedores = lerVendedoresRound6_();

  const baias = CONFIG_ROUND6.BAIAS.map(baia => {
    const item = acumulado[baia.id] || {
      id: baia.id,
      nome: baia.nome,
      realizado: 0,
      vendasConfirmadas: 0,
      boletos: 0,
      valorCofre: 0
    };

    return {
      id: baia.id,
      nome: baia.nome,
      realizado: item.realizado,
      faturado: item.realizado,
      boletos: item.boletos,
      boleto: item.boletos,
      vendasConfirmadas: item.vendasConfirmadas,
      quantidade: item.vendasConfirmadas,
      valorCofre: item.valorCofre
    };
  });

  return {
    atualizadoEm: new Date().toISOString(),
    baias,
    totalRealizado: baias.reduce((soma, baia) => soma + baia.realizado, 0),
    totalFaturado: baias.reduce((soma, baia) => soma + baia.realizado, 0),
    vendasConfirmadas: baias.reduce((soma, baia) => soma + baia.vendasConfirmadas, 0),
    boletos: baias.reduce((soma, baia) => soma + baia.boletos, 0),
    totalCofre: baias.reduce((soma, baia) => soma + baia.valorCofre, 0),
    vendedores
  };
}

function lerVendedoresRound6_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG_ROUND6.ABA_VENDEDORES);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length <= CONFIG_ROUND6.LINHA_CABECALHO) return [];

  const headers = values[CONFIG_ROUND6.LINHA_CABECALHO - 1].map(normalizarRound6_);
  const col = {
    vendedor: encontrarColunaRound6_(headers, ['vendedor', 'vendedores', 'nome', 'membro', 'colaborador']),
    status: encontrarColunaRound6_(headers, ['status', 'situacao', 'situação'])
  };

  if (col.vendedor === -1 || col.status === -1) return [];

  return values.slice(CONFIG_ROUND6.LINHA_CABECALHO)
    .filter(row => !linhaVaziaRound6_(row))
    .map(row => ({
      vendedor: String(row[col.vendedor] || '').trim(),
      status: String(row[col.status] || 'ativo').trim().toLowerCase()
    }))
    .filter(item => item.vendedor);
}

function calcularCofreRound6_(valorFaturado, boletos) {
  const milhares = Math.floor(Math.max(0, Number(valorFaturado || 0)) / 1000);
  const totalBoletos = Math.max(0, Number(boletos || 0));
  return (milhares * CONFIG_ROUND6.VALOR_POR_MILHAR) + (totalBoletos * CONFIG_ROUND6.VALOR_POR_BOLETO);
}

function encontrarColunaRound6_(headers, aliases) {
  const normalizados = aliases.map(normalizarRound6_);
  return headers.findIndex(header => normalizados.includes(header));
}

function encontrarBaiaRound6_(valor) {
  const nome = normalizarRound6_(valor);
  return CONFIG_ROUND6.BAIAS.find(baia => normalizarRound6_(baia.id) === nome || normalizarRound6_(baia.nome) === nome);
}

function valorPreenchidoRound6_(valor) {
  return String(valor === null || valor === undefined ? '' : valor).trim() !== '';
}

function numeroRound6_(valor) {
  if (typeof valor === 'number') return isFinite(valor) ? valor : 0;

  let texto = String(valor || '0')
    .replace(/R\$/g, '')
    .replace(/\s/g, '')
    .replace(/[^0-9,.-]/g, '');

  if (!texto || texto === '-' || texto === ',' || texto === '.') return 0;

  const ultimaVirgula = texto.lastIndexOf(',');
  const ultimoPonto = texto.lastIndexOf('.');

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    texto = ultimaVirgula > ultimoPonto ? texto.replace(/\./g, '').replace(',', '.') : texto.replace(/,/g, '');
  } else if (ultimaVirgula >= 0) {
    texto = texto.replace(/\./g, '').replace(',', '.');
  }

  return Number(texto) || 0;
}

function inteiroRound6_(valor) {
  return Math.max(0, Math.floor(numeroRound6_(valor)));
}

function linhaVaziaRound6_(row) {
  return row.every(cell => String(cell || '').trim() === '');
}

function normalizarRound6_(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
