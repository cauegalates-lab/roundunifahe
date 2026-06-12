const state = {
  soundEnabled: false,
  audioContext: null,
  previousTotal: null,
  previousRanking: {},
  lastDashboard: null,
  lastDashboardSignature: null,
  refreshTimer: null,
  resumeRefreshTimer: null,
  saleAnimationInProgress: false,
  isUpdating: false
};

const STORAGE_KEYS = {
  totalCofre: 'round6-unifahe-total-cofre',
  totalRealizado: 'round6-unifahe-total-realizado',
  totalBoletos: 'round6-unifahe-total-boletos',
  totalVendas: 'round6-unifahe-total-vendas'
};

const $ = selector => document.querySelector(selector);

function iniciarPainel() {
  aplicarAssets();
  renderizarBaseBaias();
  atualizarPainel(true);
  iniciarContador();

  $('#btnSound')?.addEventListener('click', ativarSom);
  $('#btnRefresh')?.addEventListener('click', () => atualizarPainel(false));

  iniciarAutoAtualizacao();

  if (CONFIG.googleSheets?.atualizarAoFocarPagina !== false) {
    window.addEventListener('focus', () => atualizarPainel(false));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) atualizarPainel(false);
    });
  }
}

function obterIntervaloAtualizacao() {
  return Number(CONFIG.googleSheets?.intervaloAtualizacao || 10000);
}

function iniciarAutoAtualizacao() {
  const intervalo = obterIntervaloAtualizacao();
  clearInterval(state.refreshTimer);
  state.refreshTimer = null;

  if (intervalo > 0) {
    state.refreshTimer = setInterval(() => atualizarPainel(false), intervalo);
  }
}

function pausarAutoAtualizacao() {
  clearInterval(state.refreshTimer);
  state.refreshTimer = null;
}

function pausarAtualizacaoDuranteAnimacao(duracaoMs = 4200) {
  state.saleAnimationInProgress = true;
  pausarAutoAtualizacao();
  clearTimeout(state.resumeRefreshTimer);

  const status = $('#statusAtualizacao');
  if (status) status.textContent = 'Animação da venda...';

  state.resumeRefreshTimer = setTimeout(() => {
    state.saleAnimationInProgress = false;
    iniciarAutoAtualizacao();
    atualizarPainel(false);
  }, Math.max(1600, Number(duracaoMs) || 4200));
}

function aplicarAssets() {
  const logo = $('#logoUnifahe');
  if (logo) logo.src = CONFIG.assets.logo;

  const cofre = $('#cofreRound6');
  if (cofre && CONFIG.assets.cofreRound6) {
    cofre.src = CONFIG.assets.cofreRound6;
  }
}

function renderizarBaseBaias() {
  const container = $('#baiasContainer');
  if (!container) return;
  container.innerHTML = CONFIG.baias.map(baia => templateBaiaCard(baia)).join('');
}

async function atualizarPainel(inicial = false) {
  if (!inicial && state.saleAnimationInProgress) return;
  if (state.isUpdating) return;

  state.isUpdating = true;
  const status = $('#statusAtualizacao');
  const urlPlanilha = obterUrlPlanilhaConfigurada();

  try {
    if (inicial && status) {
      status.textContent = urlPlanilha ? 'Carregando planilha...' : 'Aguardando planilha';
    }

    let dashboard = null;
    if (urlPlanilha) {
      const dadosPlanilha = await carregarDadosPlanilha(urlPlanilha);
      dashboard = normalizarDashboardPlanilha(dadosPlanilha);
    }

    if (!dashboard) {
      dashboard = calcularDashboard([]);
    }

    const assinaturaDashboard = criarAssinaturaDashboard(dashboard);
    const dadosMudaram = inicial || !state.lastDashboardSignature || assinaturaDashboard !== state.lastDashboardSignature;

    if (!dadosMudaram) {
      state.lastDashboard = dashboard;
      return;
    }

    renderizarDashboard(dashboard, inicial);
    state.lastDashboardSignature = assinaturaDashboard;

    if (status) {
      const horario = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      status.textContent = state.saleAnimationInProgress
        ? 'Animação da venda...'
        : (urlPlanilha ? `Planilha · ${horario}` : 'Planilha não conectada');
    }
  } catch (error) {
    console.warn('Não foi possível atualizar com os dados da planilha.', error);

    if (inicial && !state.lastDashboard) {
      const dashboardFallback = calcularDashboard([]);
      renderizarDashboard(dashboardFallback, true);
      state.lastDashboardSignature = criarAssinaturaDashboard(dashboardFallback);
    }

    if (status) {
      status.textContent = 'Falha ao ler planilha';
    }
  } finally {
    state.isUpdating = false;
  }
}

function obterUrlPlanilhaConfigurada() {
  const url = String(CONFIG.googleSheets?.webAppUrl || '').trim();
  if (!url || url.includes('COLE_AQUI')) return '';
  return url;
}

function carregarDadosPlanilha(url) {
  const usarJsonp = CONFIG.googleSheets?.usarJsonp !== false;
  return usarJsonp ? carregarJsonp(url) : carregarFetchJson(url);
}

function carregarFetchJson(url) {
  const separador = url.includes('?') ? '&' : '?';
  return fetch(`${url}${separador}t=${Date.now()}`, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
}

function carregarJsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `round6Planilha_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const separador = url.includes('?') ? '&' : '?';
    const script = document.createElement('script');
    const timeoutMs = Number(CONFIG.googleSheets?.timeout || 12000);

    const cleanup = () => {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Tempo limite ao carregar a planilha.'));
    }, timeoutMs);

    window[callbackName] = data => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Erro ao carregar o endpoint da planilha.'));
    };

    script.src = `${url}${separador}callback=${encodeURIComponent(callbackName)}&t=${Date.now()}`;
    document.body.appendChild(script);
  });
}

function normalizarDashboardPlanilha(data) {
  if (!data || typeof data !== 'object') return null;

  if (Array.isArray(data.vendas)) {
    return calcularDashboard(data.vendas);
  }

  if (!Array.isArray(data.baias)) return null;

  const statusVendedores = montarMapaStatusVendedores(data.vendedores || data.membros || data.vendedoresStatus || []);

  const baias = CONFIG.baias.map(baiaConfig => {
    const origem = data.baias.find(item => compararBaia(item.id || item.nome || item.baia || item.time, baiaConfig)) || {};

    // Formato principal da planilha por baia:
    // Baia | Boleto | Cartão/Faturado | Quantidade | Valor do Cofre
    const realizado = pegarNumero(
      origem.realizado ??
      origem.faturado ??
      origem.totalFaturado ??
      origem.cartao ??
      origem.cartão ??
      origem.valorCartao ??
      origem.valorCartão ??
      origem.valorTotal ??
      origem.totalVendido ??
      origem.total ??
      origem.valor ??
      0
    );

    const boletos = pegarInteiro(origem.boletos ?? origem.boleto ?? origem.totalBoletos ?? 0);
    const vendasConfirmadas = pegarInteiro(origem.vendasConfirmadas ?? origem.quantidade ?? origem.qtd ?? origem.vendas ?? 0);
    const valorCofreInformado = origem.valorCofre ?? origem.cofre ?? origem.valor_do_cofre ?? origem.valorPremio ?? origem.premio;
    const valorCofre = valorCofreInformado !== undefined && valorCofreInformado !== null && String(valorCofreInformado).trim() !== ''
      ? pegarNumero(valorCofreInformado)
      : calcularValorCofre(realizado, boletos);

    const membros = baiaConfig.membros.map(membro => {
      const statusPlanilha = obterStatusVendedor(statusVendedores, membro.nome);
      const eliminado = statusIndicaEliminado(statusPlanilha);

      return {
        ...membro,
        baiaId: baiaConfig.id,
        foto: membro.foto || CONFIG.assets.placeholderFoto,
        valorHoje: realizado,
        statusPlanilha: statusPlanilha || 'ativo',
        situacao: eliminado ? 'eliminado' : 'vivo'
      };
    });

    return {
      ...baiaConfig,
      membros,
      realizado,
      valorCofre,
      boletos,
      vendasConfirmadas,
      vivos: membros.filter(membro => membro.situacao !== 'eliminado').length,
      emRisco: 0,
      eliminados: membros.filter(membro => membro.situacao === 'eliminado').length
    };
  });

  return montarResumoDashboard(baias);
}

function calcularDashboard(vendasPlanilha) {
  const acumulado = CONFIG.baias.reduce((acc, baia) => {
    acc[baia.id] = {
      quantidade: 0,
      realizado: 0,
      boletos: 0,
      valorCofre: 0
    };
    return acc;
  }, {});

  (vendasPlanilha || []).forEach(registro => {
    if (!vendaConfirmada(registro)) return;

    const baiaNome = registro.baia ?? registro.time ?? registro.equipe ?? registro.baiaNome ?? registro.baia_id ?? registro.id;
    const baia = encontrarBaiaPorId(baiaNome) || encontrarBaiaPorNome(baiaNome);
    if (!baia) return;

    const atual = acumulado[baia.id];
    const valor = pegarNumero(registro.valorTotal ?? registro.valor ?? registro.realizado ?? registro.total ?? registro.venda ?? 0);
    const boletos = contarBoletos(registro.boletos ?? registro.boleto ?? registro.temBoleto ?? registro.pagamento);
    const quantidade = pegarInteiro(registro.quantidade ?? registro.qtd ?? 1) || 1;

    const cofreAntes = calcularValorCofre(atual.realizado, atual.boletos);
    atual.quantidade += quantidade;
    atual.realizado += Math.max(0, valor);
    atual.boletos += boletos;
    const cofreDepois = calcularValorCofre(atual.realizado, atual.boletos);
    atual.valorCofre += Math.max(0, cofreDepois - cofreAntes);
  });

  const baias = CONFIG.baias.map(baia => {
    const dados = acumulado[baia.id] || { quantidade: 0, realizado: 0, boletos: 0, valorCofre: 0 };
    const membros = baia.membros.map(membro => ({
      ...membro,
      baiaId: baia.id,
      foto: membro.foto || CONFIG.assets.placeholderFoto,
      valorHoje: dados.realizado,
      situacao: 'vivo'
    }));

    return {
      ...baia,
      membros,
      realizado: dados.realizado,
      valorCofre: dados.valorCofre,
      boletos: dados.boletos,
      vendasConfirmadas: dados.quantidade,
      vivos: membros.filter(membro => membro.situacao !== 'eliminado').length,
      emRisco: 0,
      eliminados: membros.filter(membro => membro.situacao === 'eliminado').length
    };
  });

  return montarResumoDashboard(baias);
}

function montarResumoDashboard(baias) {
  const ranking = [...baias].sort((a, b) => {
    if (b.realizado !== a.realizado) return b.realizado - a.realizado;
    return b.vendasConfirmadas - a.vendasConfirmadas;
  });

  const totalRealizado = baias.reduce((sum, b) => sum + b.realizado, 0);
  const totalCofre = baias.reduce((sum, b) => sum + b.valorCofre, 0);
  const vendasConfirmadas = baias.reduce((sum, b) => sum + b.vendasConfirmadas, 0);
  const boletos = baias.reduce((sum, b) => sum + b.boletos, 0);
  const capacidade = Number(CONFIG.regrasCofre?.capacidadeVisualCofre || 300);
  const percentualCofre = capacidade > 0 ? Math.min((totalCofre / capacidade) * 100, 100) : 0;

  return {
    baias,
    ranking,
    totalRealizado,
    totalCofre,
    vendasConfirmadas,
    boletos,
    percentualCofre
  };
}

function criarAssinaturaDashboard(data) {
  const dadosEstaveis = {
    totalRealizado: numeroAssinatura(data?.totalRealizado),
    totalCofre: numeroAssinatura(data?.totalCofre),
    vendasConfirmadas: numeroAssinatura(data?.vendasConfirmadas),
    boletos: numeroAssinatura(data?.boletos),
    baias: (data?.baias || []).map(baia => ({
      id: String(baia.id || ''),
      nome: String(baia.nome || ''),
      realizado: numeroAssinatura(baia.realizado),
      valorCofre: numeroAssinatura(baia.valorCofre),
      boletos: numeroAssinatura(baia.boletos),
      vendasConfirmadas: numeroAssinatura(baia.vendasConfirmadas),
      vivos: numeroAssinatura(baia.vivos),
      emRisco: numeroAssinatura(baia.emRisco),
      eliminados: numeroAssinatura(baia.eliminados),
      membros: (baia.membros || []).map(membro => ({
        nome: String(membro.nome || ''),
        situacao: String(membro.situacao || ''),
        statusPlanilha: String(membro.statusPlanilha || '')
      }))
    })),
    ranking: (data?.ranking || []).map(baia => String(baia.id || ''))
  };

  return gerarHashEstavel(JSON.stringify(dadosEstaveis));
}

function numeroAssinatura(value) {
  const numero = Number(value || 0);
  return Number.isFinite(numero) ? Math.round(numero * 1000) / 1000 : 0;
}

function gerarHashEstavel(texto) {
  let hash = 5381;

  for (let i = 0; i < texto.length; i++) {
    hash = ((hash << 5) + hash) ^ texto.charCodeAt(i);
  }

  return (hash >>> 0).toString(36);
}

function calcularValorCofre(valorTotal, boletos) {
  const valorPorMil = Number(CONFIG.regrasCofre?.valorPorMilhar || 5);
  const valorPorBoleto = Number(CONFIG.regrasCofre?.valorPorBoleto || 2);
  const milharesCompletos = Math.floor(Math.max(0, Number(valorTotal || 0)) / 1000);
  const totalBoletos = Math.max(0, Number(boletos || 0));
  return (milharesCompletos * valorPorMil) + (totalBoletos * valorPorBoleto);
}

function vendaConfirmada(registro) {
  const status = normalizar(registro?.status ?? registro?.situacao ?? registro?.pagamento ?? '');
  if (!status) return true;

  const validos = ['quitado', 'cartao', 'cartão', 'pago', 'paga', 'aprovado', 'aprovada', 'confirmado', 'confirmada', 'sim'];
  return validos.some(item => status.includes(normalizar(item)));
}

function contarBoletos(value) {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return Math.max(0, Math.floor(value));

  const texto = normalizar(value);
  if (!texto || texto === 'nao' || texto === 'não' || texto === 'false' || texto === '0') return 0;
  if (texto.includes('boleto') || texto === 'sim' || texto === 'true' || texto === '1') return 1;

  const numero = pegarInteiro(value);
  return numero > 0 ? numero : 0;
}

function montarMapaStatusVendedores(vendedores) {
  const mapa = {};

  if (!Array.isArray(vendedores)) return mapa;

  vendedores.forEach(item => {
    const nome = item?.vendedor ?? item?.nome ?? item?.membro ?? item?.name ?? '';
    const status = normalizar(item?.status ?? item?.STATUS ?? item?.situacao ?? item?.situação ?? '');
    const chave = normalizarNomeComparacao(nome);

    if (!chave) return;
    mapa[chave] = status || 'ativo';
  });

  return mapa;
}


function statusIndicaEliminado(status) {
  const valor = normalizar(status);
  return valor.includes('eliminad') || valor.includes('cancelad') || valor === 'x' || valor === 'fora';
}

function obterStatusVendedor(mapa, nome) {
  const chave = normalizarNomeComparacao(nome);
  return chave ? (mapa[chave] || 'ativo') : 'ativo';
}

function normalizarNomeComparacao(value) {
  return normalizar(value).replace(/\s+/g, ' ');
}

function pegarInteiro(value) {
  return Math.max(0, Math.floor(pegarNumero(value)));
}

function encontrarBaiaPorId(id) {
  const normalizado = normalizar(id);
  return CONFIG.baias.find(baia => normalizar(baia.id) === normalizado);
}

function encontrarBaiaPorNome(nome) {
  const normalizado = normalizar(nome);
  return CONFIG.baias.find(baia => normalizar(baia.nome) === normalizado || normalizar(baia.id) === normalizado);
}

function compararBaia(nomeBaiaVenda, baiaConfig) {
  const venda = normalizar(nomeBaiaVenda);
  return venda === normalizar(baiaConfig.nome) || venda === normalizar(baiaConfig.id);
}

function renderizarDashboard(data, inicial = false) {
  const totalParaMostrar = Number(data.totalCofre || 0);
  const totalRealizado = Number(data.totalRealizado || 0);
  const totalBoletos = Number(data.boletos || 0);
  const totalVendas = Number(data.vendasConfirmadas ?? data.quantidade ?? (Array.isArray(data.baias) ? data.baias.reduce((sum, baia) => sum + Number(baia.vendasConfirmadas ?? baia.quantidade ?? baia.qtd ?? 0), 0) : 0));

  $('#valorCofre').textContent = dinheiro(totalParaMostrar);
  $('#vendasConfirmadas').textContent = totalBoletos;
  $('#metaCofre').textContent = dinheiro(totalRealizado);
  const percentualVisual = obterPercentualVisualCofre(totalParaMostrar);

  const totalAnteriorSessao = state.previousTotal;
  const totalAnteriorSalvo = lerNumeroLocal(STORAGE_KEYS.totalCofre);
  const realizadoAnteriorSalvo = lerNumeroLocal(STORAGE_KEYS.totalRealizado);
  const boletosAnteriorSalvo = lerNumeroLocal(STORAGE_KEYS.totalBoletos);
  const vendasAnteriorSalvo = lerNumeroLocal(STORAGE_KEYS.totalVendas);

  const totalAnteriorComparacao = totalAnteriorSessao !== null
    ? totalAnteriorSessao
    : totalAnteriorSalvo;

  const houveAumentoCofre = totalAnteriorComparacao !== null && totalParaMostrar > totalAnteriorComparacao + 0.009;
  const houveReducaoCofre = totalAnteriorComparacao !== null && totalParaMostrar < totalAnteriorComparacao - 0.009;
  const novasVendas = vendasAnteriorSalvo !== null ? Math.max(0, totalVendas - vendasAnteriorSalvo) : 0;
  const houveAumentoVendas = vendasAnteriorSalvo !== null && novasVendas > 0;
  const houveAumentoOperacional = (realizadoAnteriorSalvo !== null && totalRealizado > realizadoAnteriorSalvo + 0.009)
    || (boletosAnteriorSalvo !== null && totalBoletos > boletosAnteriorSalvo)
    || houveAumentoVendas;

  const quantidadeAtualNoCofre = obterQuantidadeAtualNoCofre();
  const quantidadeDesejadaNoCofre = obterQuantidadeVisualCofre(totalParaMostrar);
  const quantidadeAnteriorDesejada = totalAnteriorComparacao !== null
    ? obterQuantidadeVisualCofre(totalAnteriorComparacao)
    : null;

  if (totalAnteriorComparacao === null) {
    preencherCofrePorQuantidade(quantidadeDesejadaNoCofre);
  } else if (houveAumentoCofre) {
    if (inicial && quantidadeAtualNoCofre === 0) {
      preencherCofrePorQuantidade(quantidadeAnteriorDesejada || 0);
    }
    const faltantes = Math.max(0, quantidadeDesejadaNoCofre - obterQuantidadeAtualNoCofre());
    const qtdAnimacao = faltantes > 0
      ? faltantes
      : Math.max(10, Math.min(45, Math.round((totalParaMostrar - totalAnteriorComparacao) * 1.8) || 12));
    dispararEfeitosVenda(totalParaMostrar - totalAnteriorComparacao, false, 'Planilha atualizada', qtdAnimacao);
  } else if (houveReducaoCofre) {
    reduzirCofreParaQuantidade(quantidadeDesejadaNoCofre);
    if (!inicial) {
      mostrarAlerta('Cofre atualizado', `Valor reduzido · ${dinheiro(totalParaMostrar)}`);
    }
  } else if (!inicial && quantidadeDesejadaNoCofre > quantidadeAtualNoCofre) {
    dispararEfeitosVenda(0, true, 'Nova venda registrada', quantidadeDesejadaNoCofre - quantidadeAtualNoCofre);
  } else if (!inicial && quantidadeDesejadaNoCofre < quantidadeAtualNoCofre) {
    reduzirCofreParaQuantidade(quantidadeDesejadaNoCofre);
  } else if (!inicial && houveAumentoOperacional) {
    const qtdNotasNovaVenda = Math.max(10, Math.min(45, novasVendas > 0 ? novasVendas * 12 : 14));
    dispararEfeitosVenda(0, true, houveAumentoVendas ? 'Nova venda registrada' : 'Planilha atualizada', qtdNotasNovaVenda);
  } else if (inicial) {
    preencherCofrePorQuantidade(quantidadeDesejadaNoCofre);
  }

  renderizarRanking(data.ranking);
  renderizarBaias(data.baias);

  state.previousTotal = totalParaMostrar;
  state.lastDashboard = data;
  salvarNumeroLocal(STORAGE_KEYS.totalCofre, totalParaMostrar);
  salvarNumeroLocal(STORAGE_KEYS.totalRealizado, totalRealizado);
  salvarNumeroLocal(STORAGE_KEYS.totalBoletos, totalBoletos);
  salvarNumeroLocal(STORAGE_KEYS.totalVendas, totalVendas);
}

function lerNumeroLocal(chave) {
  try {
    const valor = localStorage.getItem(chave);
    if (valor === null || valor === undefined || valor === '') return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  } catch (error) {
    return null;
  }
}

function salvarNumeroLocal(chave, valor) {
  try {
    localStorage.setItem(chave, String(Number(valor || 0)));
  } catch (error) {
    // Ignora ambientes sem localStorage disponível.
  }
}

function renderizarRanking(ranking) {
  const antigo = state.previousRanking || {};
  const novo = {};
  const container = $('#rankingContainer');
  if (!container) return;

  container.innerHTML = ranking.map((baia, index) => {
    const pos = index + 1;
    novo[baia.id] = pos;
    const mudou = antigo[baia.id] && antigo[baia.id] !== pos;

    return `
      <article class="rank-row ${mudou ? 'rank-move' : ''}">
        <div class="rank-pos ${pos <= 3 ? 'rank-top' : ''}">${pos}</div>
        <img class="rank-logo" src="${baia.logo}" alt="${escapeHTML(baia.nome)}">
        <div class="rank-info">
          <strong>${escapeHTML(baia.nome)}</strong>
          <span>${baia.boletos} boleto${baia.boletos === 1 ? '' : 's'} · ${baia.vendasConfirmadas} qtd.</span>
        </div>
        <div class="rank-value">${dinheiro(baia.realizado)}</div>
      </article>
    `;
  }).join('');

  state.previousRanking = novo;
}

function renderizarBaias(baias) {
  baias.forEach(baia => {
    const card = document.querySelector(`[data-baia="${baia.id}"]`);
    if (!card) return;

    const value = card.querySelector('.team-value');
    if (value) value.textContent = dinheiro(baia.realizado);

    const boletos = card.querySelector('.team-boletos');
    if (boletos) boletos.textContent = baia.boletos;

    const members = card.querySelector('.team-members');
    if (members) members.innerHTML = baia.membros.map(member => templateMembro(member)).join('');

    card.classList.toggle('team-eliminated', baia.eliminados === baia.membros.length);
  });
}

function templateBaiaCard(baia) {
  return `
    <article class="team-card" data-baia="${baia.id}" aria-label="${escapeHTML(baia.nome)}">
      <div class="team-left">
        <img class="team-logo" src="${baia.logo}" alt="${escapeHTML(baia.nome)}">
      </div>

      <div class="team-members"></div>

      <div class="team-score">
        <div class="team-metric team-metric-main">
          <small>FATURADO</small>
          <strong class="team-value">R$ 0,00</strong>
        </div>
        <div class="team-metric team-metric-compact">
          <small>BOLETOS</small>
          <strong class="team-boletos">0</strong>
        </div>
      </div>
    </article>
  `;
}

function templateMembro(member) {
  const cls = member.situacao === 'eliminado' ? 'member-dead' : member.situacao === 'risco' ? 'member-risk' : 'member-live';
  const label = member.situacao === 'eliminado' ? 'ELIM.' : member.situacao === 'risco' ? 'RISCO' : 'VIVO';

  return `
    <div class="member ${cls}" title="${escapeHTML(member.nome)} · ${label}">
      <div class="member-photo-wrap">
        <img src="${member.foto || CONFIG.assets.placeholderFoto}" alt="${escapeHTML(member.nome)}" onerror="this.src='${CONFIG.assets.placeholderFoto}'">
      </div>
      <span>${primeiroNome(member.nome)}</span>
    </div>
  `;
}

function dispararEfeitosVenda(aumento, forcar, textoExtra, qtdNotasOverride = null) {
  tocarSomVenda();
  const qtdNotas = qtdNotasOverride !== null
    ? Math.max(1, Math.min(75, Math.round(qtdNotasOverride)))
    : (forcar ? 12 : Math.max(8, Math.min(70, Math.round(aumento * 1.8))));

  const duracaoAnimacao = adicionarVendaAoCofre(qtdNotas);
  pausarAtualizacaoDuranteAnimacao(duracaoAnimacao + 650);

  const frame = $('#cofreFrame');
  frame?.classList.remove('shake', 'receiving-money');
  void frame?.offsetWidth;
  frame?.classList.add('shake', 'receiving-money');
  clearTimeout(frame?._receivingMoneyTimer);
  if (frame) {
    frame._receivingMoneyTimer = setTimeout(() => frame.classList.remove('receiving-money'), duracaoAnimacao + 260);
  }

  mostrarAlerta('Venda adicionada!', aumento > 0 ? `${textoExtra || 'O cofre aumentou'} · +${dinheiro(aumento)} no cofre` : (textoExtra || 'Painel atualizado com sucesso'));
}

function mostrarAlerta(titulo, texto) {
  const alert = $('#saleAlert');
  if (!alert) return;
  $('#saleAlertTitle').textContent = titulo;
  $('#saleAlertText').textContent = texto;
  alert.classList.add('show');
  clearTimeout(alert._timer);
  alert._timer = setTimeout(() => alert.classList.remove('show'), 3300);
}

function obterMaxNotasCofre() {
  return 260;
}

function obterProgressoEnchimentoFinal() {
  const final = new Date(CONFIG.dataFinal);
  const agora = new Date();
  const inicioDiaFinal = new Date(final);
  inicioDiaFinal.setHours(0, 0, 0, 0);

  if (agora < inicioDiaFinal) return 0;
  if (agora >= final) return 1;

  const intervalo = Math.max(1, final.getTime() - inicioDiaFinal.getTime());
  return limitarValor((agora.getTime() - inicioDiaFinal.getTime()) / intervalo, 0, 1);
}

function obterQuantidadeBaseCofre(valorCofre) {
  return Math.max(0, Math.min(obterMaxNotasCofre(), Math.round(Number(valorCofre || 0) / 1.9)));
}

function obterQuantidadeVisualCofre(valorCofre) {
  const maxNotas = obterMaxNotasCofre();
  const quantidadeBase = obterQuantidadeBaseCofre(valorCofre);
  const progressoFinal = obterProgressoEnchimentoFinal();

  if (progressoFinal <= 0) return quantidadeBase;

  return Math.max(quantidadeBase, Math.min(maxNotas, Math.round(quantidadeBase + ((maxNotas - quantidadeBase) * progressoFinal))));
}

function obterPercentualVisualCofre(valorCofre) {
  return (obterQuantidadeVisualCofre(valorCofre) / obterMaxNotasCofre()) * 100;
}

function obterQuantidadeAtualNoCofre() {
  const layer = $('#cofreMoneyLayer');
  return layer ? layer.children.length : 0;
}

function preencherCofrePorQuantidade(quantidade) {
  const layer = $('#cofreMoneyLayer');
  if (!layer) return;

  layer.innerHTML = '';
  const total = Math.max(0, Math.min(obterMaxNotasCofre(), Math.round(Number(quantidade || 0))));
  if (!total) return;

  for (let i = 0; i < total; i++) {
    const bill = criarNotaCofre(true, i, total);
    layer.appendChild(bill);
  }
}


function reduzirCofreParaQuantidade(quantidade) {
  const layer = $('#cofreMoneyLayer');
  if (!layer) return;

  const alvo = Math.max(0, Math.min(obterMaxNotasCofre(), Math.round(Number(quantidade || 0))));
  limitarNotasNoCofre(layer, alvo);
  relayoutNotasNoCofre(layer);
}

function numeroAleatorioBase(seed) {
  const x = Math.sin((seed + 1) * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function limitarValor(valor, minimo, maximo) {
  return Math.max(minimo, Math.min(maximo, valor));
}

function posicaoNotaNoCofre(indice = 0) {
  const alvo = Math.max(0, Number(indice) || 0);
  let consumidas = 0;

  const centroX = 50;
  const centroY = 58;
  const raioX = 43.5;
  const raioY = 36.5;
  const yBase = 86.5;
  const espacoVertical = 4.0;
  const linhasMaximas = 24;

  for (let linha = 0; linha < linhasMaximas; linha++) {
    const yLinha = yBase - (linha * espacoVertical);
    const normalizadoY = (yLinha - centroY) / raioY;
    if (Math.abs(normalizadoY) >= 1) continue;

    const metadeLargura = Math.sqrt(1 - (normalizadoY * normalizadoY)) * raioX;
    const notasNaLinha = limitarValor(Math.floor((metadeLargura * 2) / 8.2), 4, 14);

    if (alvo < consumidas + notasNaLinha) {
      const posicaoNaLinha = alvo - consumidas;
      const deslocamentoAlternado = linha % 2 === 0 ? .52 : .08;
      const fracao = ((posicaoNaLinha + deslocamentoAlternado) % notasNaLinha + .5) / notasNaLinha;
      const jitterX = (numeroAleatorioBase((alvo + 3) * 19 + linha * 7) - .5) * 4.2;
      const jitterY = (numeroAleatorioBase((alvo + 5) * 23 + linha * 11) - .5) * 1.8;

      return {
        x: limitarValor(centroX - metadeLargura + (fracao * metadeLargura * 2) + jitterX, 10, 90),
        y: limitarValor(yLinha + jitterY, 43, 89)
      };
    }

    consumidas += notasNaLinha;
  }

  // Quando chega perto do limite visual, continua preenchendo a parte superior interna,
  // sempre dentro da máscara elíptica do cofre.
  const extra = alvo - consumidas;
  return {
    x: limitarValor(50 + (numeroAleatorioBase(extra * 29 + 17) - .5) * 54, 18, 82),
    y: limitarValor(43 + numeroAleatorioBase(extra * 31 + 9) * 11, 43, 56)
  };
}

function aplicarPosicaoNota(bill, indice, estatica = false) {
  const pos = posicaoNotaNoCofre(indice);
  const profundidade = limitarValor((pos.y - 42) / 43, 0, 1);

  const rotStart = -150 + numeroAleatorioBase(indice * 13 + 1) * 300;
  const rotMid = -92 + numeroAleatorioBase(indice * 17 + 2) * 184;
  const rotSettle = -46 + numeroAleatorioBase(indice * 19 + 3) * 92;
  const rotEnd = -22 + numeroAleatorioBase(indice * 23 + 4) * 44;
  const scale = limitarValor(.58 + (profundidade * .32) + numeroAleatorioBase(indice * 29 + 5) * .16, .58, 1.04);
  const entryX = -82 + numeroAleatorioBase(indice * 31 + 6) * 164;
  const startY = -150 - numeroAleatorioBase(indice * 67 + 14) * 88;
  const swayA = -38 + numeroAleatorioBase(indice * 37 + 7) * 76;
  const swayB = -22 + numeroAleatorioBase(indice * 41 + 8) * 44;
  const bounce = -8 + numeroAleatorioBase(indice * 43 + 9) * 16;
  const skew = -9 + numeroAleatorioBase(indice * 59 + 12) * 18;
  const tilt = -12 + numeroAleatorioBase(indice * 61 + 13) * 24;

  bill.style.setProperty('--bill-left', `${pos.x}%`);
  bill.style.setProperty('--bill-top', `${pos.y}%`);
  bill.style.setProperty('--bill-entry-x', `${entryX}px`);
  bill.style.setProperty('--bill-start-y', `${startY}px`);
  bill.style.setProperty('--bill-sway-a', `${swayA}px`);
  bill.style.setProperty('--bill-sway-b', `${swayB}px`);
  bill.style.setProperty('--bill-bounce', `${bounce}px`);
  bill.style.setProperty('--bill-rot-start', `${rotStart}deg`);
  bill.style.setProperty('--bill-rot-mid', `${rotMid}deg`);
  bill.style.setProperty('--bill-rot-settle', `${rotSettle}deg`);
  bill.style.setProperty('--bill-rot-end', `${rotEnd}deg`);
  bill.style.setProperty('--bill-scale', scale.toFixed(2));
  bill.style.setProperty('--bill-skew', `${skew.toFixed(1)}deg`);
  bill.style.setProperty('--bill-tilt', `${tilt.toFixed(1)}deg`);
  bill.style.setProperty('--bill-depth', String(Math.round(pos.y * 10)));

  if (!estatica) {
    bill.style.setProperty('--bill-duration', `${1.85 + numeroAleatorioBase(indice * 47 + 10) * .85}s`);
    bill.style.setProperty('--bill-delay', `${numeroAleatorioBase(indice * 53 + 11) * .42}s`);
  }
}

function criarNotaCofre(estatica = false, indice = 0) {
  const bill = document.createElement('div');
  bill.className = estatica ? 'vault-bill vault-bill-static' : 'vault-bill vault-bill-preparing';
  bill.textContent = 'R$';
  bill.dataset.vaultIndex = String(indice);
  aplicarPosicaoNota(bill, indice, estatica);
  return bill;
}

function relayoutNotasNoCofre(layer) {
  Array.from(layer.children).forEach((bill, indice) => {
    bill.dataset.vaultIndex = String(indice);
    aplicarPosicaoNota(bill, indice, bill.classList.contains('vault-bill-static'));
  });
}

function obterPosicaoViewportNotaNoCofre(indice = 0) {
  const layer = $('#cofreMoneyLayer');
  if (!layer) {
    return {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.42
    };
  }

  const rect = layer.getBoundingClientRect();
  const pos = posicaoNotaNoCofre(indice);
  return {
    x: rect.left + ((pos.x / 100) * rect.width),
    y: rect.top + ((pos.y / 100) * rect.height)
  };
}

function obterAreaQuedaNoTopo() {
  const frame = $('#cofreFrame');
  if (!frame) {
    const larguraFallback = Math.min(window.innerWidth * 0.34, 340);
    const centroFallback = window.innerWidth / 2;
    return {
      minX: centroFallback - (larguraFallback / 2),
      maxX: centroFallback + (larguraFallback / 2)
    };
  }

  const rect = frame.getBoundingClientRect();
  const largura = Math.max(160, rect.width * 0.84);
  const centro = rect.left + (rect.width / 2);
  return {
    minX: limitarValor(centro - (largura / 2), 20, window.innerWidth - 96),
    maxX: limitarValor(centro + (largura / 2), 20, window.innerWidth - 20)
  };
}

function criarNotaVooAteCofre(indice = 0, atrasoBase = 0) {
  const dropLayer = $('#moneyDropLayer');
  if (!dropLayer) return 0;

  const bill = document.createElement('div');
  bill.className = 'drop-bill';
  bill.textContent = 'R$';

  const alvo = obterPosicaoViewportNotaNoCofre(indice);
  const areaTopo = obterAreaQuedaNoTopo();
  const larguraNota = 76;
  const alturaNota = 36;
  const progresso = numeroAleatorioBase(indice * 17 + 3);
  const startX = areaTopo.minX + ((areaTopo.maxX - areaTopo.minX) * progresso);
  const desvioTopo = -12 + (numeroAleatorioBase(indice * 19 + 7) * 24);
  const desvioMeio = -10 + (numeroAleatorioBase(indice * 23 + 9) * 20);
  const desvioFinal = -8 + (numeroAleatorioBase(indice * 29 + 11) * 16);
  const duracao = 3.4 + (numeroAleatorioBase(indice * 31 + 13) * 0.9);
  const atraso = atrasoBase + (numeroAleatorioBase(indice * 37 + 15) * 0.05);
  const startXFinal = Math.round(startX);
  const alvoX = Math.round(alvo.x - (larguraNota / 2));
  const alvoY = Math.round(alvo.y - (alturaNota / 2));

  bill.style.setProperty('--drop-start-x', `${startXFinal}px`);
  bill.style.setProperty('--drop-mid-x', `${Math.round(startXFinal + desvioTopo)}px`);
  bill.style.setProperty('--drop-late-x', `${Math.round(((startXFinal * 0.35) + (alvoX * 0.65)) + desvioMeio)}px`);
  bill.style.setProperty('--drop-near-target-x', `${Math.round(alvoX + desvioFinal)}px`);
  bill.style.setProperty('--drop-target-x', `${alvoX}px`);
  bill.style.setProperty('--drop-target-y', `${alvoY}px`);
  bill.style.setProperty('--drop-duration', `${duracao.toFixed(2)}s`);
  bill.style.setProperty('--drop-delay', `${atraso.toFixed(2)}s`);
  bill.style.setProperty('--drop-rot-start', `${(-10 + (numeroAleatorioBase(indice * 41 + 17) * 20)).toFixed(1)}deg`);
  bill.style.setProperty('--drop-rot-mid', `${(-8 + (numeroAleatorioBase(indice * 43 + 19) * 16)).toFixed(1)}deg`);
  bill.style.setProperty('--drop-rot-end', `${(-7 + (numeroAleatorioBase(indice * 47 + 21) * 14)).toFixed(1)}deg`);

  dropLayer.appendChild(bill);
  setTimeout(() => bill.remove(), ((duracao + atraso) * 1000) + 320);
  return (duracao + atraso) * 1000;
}

function adicionarVendaAoCofre(qtd = 24) {
  const layer = $('#cofreMoneyLayer');
  if (!layer) return 4200;

  const quantidadeTotal = Math.max(1, Math.min(Number(qtd) || 1, 75));
  const quantidadeAnimada = Math.min(quantidadeTotal, 18);
  const quantidadeDireta = Math.max(0, quantidadeTotal - quantidadeAnimada);
  const maxNotas = obterMaxNotasCofre();

  limitarNotasNoCofre(layer, Math.max(0, maxNotas - quantidadeTotal));
  relayoutNotasNoCofre(layer);

  const notasAtuais = layer.children.length;

  for (let i = 0; i < quantidadeDireta; i++) {
    const indiceDireto = notasAtuais + i;
    const notaDireta = criarNotaCofre(true, indiceDireto);
    layer.appendChild(notaDireta);
  }

  const inicioAnimado = notasAtuais + quantidadeDireta;
  let maiorDuracaoMs = 0;

  for (let i = 0; i < quantidadeAnimada; i++) {
    const indice = inicioAnimado + i;
    const atrasoEmCascata = i * 0.12;
    const duracaoNota = criarNotaVooAteCofre(indice, atrasoEmCascata);
    maiorDuracaoMs = Math.max(maiorDuracaoMs, duracaoNota);

    setTimeout(() => {
      const bill = criarNotaCofre(true, indice);
      layer.appendChild(bill);
      relayoutNotasNoCofre(layer);
      limitarNotasNoCofre(layer, maxNotas);
    }, Math.max(120, duracaoNota - 120));
  }

  relayoutNotasNoCofre(layer);
  limitarNotasNoCofre(layer, maxNotas);
  return Math.max(4200, Math.ceil(maiorDuracaoMs));
}

function limitarNotasNoCofre(layer, maximo) {
  while (layer.children.length > maximo) {
    layer.removeChild(layer.firstElementChild);
  }
}


function ativarSom() {
  state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  state.soundEnabled = true;
  $('#btnSound').classList.add('active');
  $('#btnSound').innerHTML = '<span>🔊</span> Som ativo';
  tocarSomVenda();
}

function tocarSomVenda() {
  if (!state.soundEnabled || !state.audioContext) return;
  const ctx = state.audioContext;
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();

  osc1.type = 'triangle';
  osc2.type = 'sine';
  osc1.frequency.setValueAtTime(520, now);
  osc1.frequency.exponentialRampToValueAtTime(1040, now + .18);
  osc2.frequency.setValueAtTime(980, now + .06);
  osc2.frequency.exponentialRampToValueAtTime(1560, now + .24);
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(.18, now + .03);
  gain.gain.exponentialRampToValueAtTime(.0001, now + .42);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  osc1.start(now);
  osc2.start(now + .06);
  osc1.stop(now + .45);
  osc2.stop(now + .42);
}

function iniciarContador() {
  const final = new Date(CONFIG.dataFinal);
  const render = () => {
    const diff = final.getTime() - Date.now();
    if (diff <= 0) {
      $('#countdown').innerHTML = '<strong>FINAL LIBERADA</strong>';
      return;
    }
    const s = Math.floor(diff / 1000);
    const dias = Math.floor(s / 86400);
    const horas = Math.floor((s % 86400) / 3600);
    const min = Math.floor((s % 3600) / 60);
    const seg = s % 60;
    $('#countdown').innerHTML = `
      <strong>${String(dias).padStart(2, '0')}</strong><span>DIAS</span>
      <strong>${String(horas).padStart(2, '0')}</strong><span>HORAS</span>
      <strong>${String(min).padStart(2, '0')}</strong><span>MIN</span>
      <strong>${String(seg).padStart(2, '0')}</strong><span>SEG</span>
    `;
  };
  render();
  setInterval(render, 1000);
}

function dinheiro(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pegarNumero(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  let cleaned = String(value || '0')
    .replace(/R\$/g, '')
    .replace(/\s/g, '')
    .replace(/[^0-9,.-]/g, '');

  if (!cleaned || cleaned === '-' || cleaned === ',' || cleaned === '.') return 0;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    const parts = cleaned.split(',');
    const decimalLike = parts.length === 2 && parts[1].length !== 3;
    cleaned = decimalLike ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const parts = cleaned.split('.');
    const decimalLike = parts.length === 2 && parts[1].length !== 3;
    cleaned = decimalLike ? cleaned : cleaned.replace(/\./g, '');
  }

  return Number(cleaned) || 0;
}

function normalizar(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function primeiroNome(nome) {
  const partes = String(nome || '').split(' ').filter(Boolean);
  if (!partes.length) return 'Sem nome';

  const nomeCurto = partes.slice(0, 2).join(' ');
  return nomeCurto.length > 10 ? partes[0] : nomeCurto;
}

function escapeHTML(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

window.addEventListener('DOMContentLoaded', iniciarPainel);
