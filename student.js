import { checkUser, supabaseClient } from './auth.js';

// student.js - Lógica da Área do Aluno Naju Araújo
let currentUser = null;
let allProdutos = [];
let userPurchasedProducts = [];

async function initStudent() {
    currentUser = await checkUser();
    if (!currentUser) return;

    // Atualizar UI do Perfil (Ícone de Usuário)
    const profileImg = document.getElementById('userProfile');
    if (profileImg) {
        profileImg.textContent = '👤';
    }

    const userNameLabel = document.getElementById('userNameLabel');
    if (userNameLabel) {
        // Puxa do novo campo 'primeiro_nome' ou do antigo 'nome_completo'
        const firstName = (currentUser.primeiro_nome || currentUser.nome_completo || 'Aluno(a)').split(' ')[0];
        userNameLabel.textContent = `Seja bem-vindo(a), ${firstName}`;
    }

    // Carregar Componentes
    loadSiteSettings();
    await loadData();
    
    // Auto-open modules if returning from player
    const urlParams = new URLSearchParams(window.location.search);
    const viewProductId = urlParams.get('product_id');
    if (viewProductId) {
        showModules(viewProductId);
    } else {
        renderProducts();
    }
}

// --- CONFIGURAÇÕES DO SITE (HERO) ---
async function loadSiteSettings() {
    const { data: settings, error } = await supabaseClient
        .from('site_settings')
        .select('*')
        .limit(1)
        .single();

    if (error || !settings) return;

    const heroTitle = document.querySelector('.hero-title');
    const heroSubtitle = document.querySelector('.hero-subtitle');
    const heroDesc = document.querySelector('.hero-description');

    if (heroTitle) heroTitle.textContent = settings.hero_title;
    if (heroSubtitle) heroSubtitle.textContent = settings.hero_subtitle;
    if (heroDesc) heroDesc.textContent = settings.motivational_text;
}

// --- BUSCANDO DADOS ---
async function loadData() {
    const grid = document.getElementById('modulesGrid');
    if (!grid) return;

    grid.innerHTML = '<div class="loader-placeholder" style="text-align: center; width: 100%; padding: 4rem;"><span style="color: var(--gold); font-size: 1.2rem;">Carregando sua jornada...</span></div>';

    // 1. Buscar Compras do usuário pelo e-mail
    const { data: compras } = await supabaseClient
        .from('compras')
        .select('nome_do_produto')
        .ilike('email', currentUser.email);

    userPurchasedProducts = (compras || []).map(c => c.nome_do_produto.trim().toLowerCase());

    // 2. Buscar Produtos e seus Módulos
    const { data: produtosRes, error: prodError } = await supabaseClient
        .from('produtos')
        .select(`
            *,
            modules (
                id, title, description, cover_url, order_index, status
            )
        `)
        .order('created_at', { ascending: true });

    if (prodError) return console.error(prodError);

    allProdutos = produtosRes || [];
}

// --- RENDERIZAR PRODUTOS (View 1) ---
function renderProducts() {
    const grid = document.getElementById('modulesGrid');
    const sectionTitle = document.querySelector('.section-title');
    if (sectionTitle) sectionTitle.innerHTML = 'Seus Produtos Exclusivos';

    window.scrollTo({ top: document.getElementById('modulos').offsetTop - 100, behavior: 'smooth' });

    if (allProdutos.length === 0) {
        grid.innerHTML = '<p class="text-muted" style="text-align:center; width:100%;">Nenhum produto encontrado.</p>';
        return;
    }

    let html = `<div class="cards-grid">`;

    // 1. Separar produtos que usuário possui dos que não possui
    const purchased = [];
    const unpurchased = [];

    allProdutos.forEach(produto => {
        const prodNameNorm = produto.name.trim().toLowerCase();
        const hasAccess = userPurchasedProducts.includes(prodNameNorm);
        
        // Garante que 'ordem' existe (se for nulo, joga pro fim)
        produto._ordem = typeof produto.ordem === 'number' ? produto.ordem : 999;
        
        if (hasAccess) {
            purchased.push(produto);
        } else {
            unpurchased.push(produto);
        }
    });

    // 2. Ordenar ambos os grupos pela coluna 'ordem' (se existir)
    purchased.sort((a, b) => a._ordem - b._ordem);
    unpurchased.sort((a, b) => a._ordem - b._ordem);

    // 3. Juntar colocando quem tem acesso sempre em primeiro
    const sortedProdutos = [...purchased, ...unpurchased];

    sortedProdutos.forEach(produto => {
        const prodNameNorm = produto.name.trim().toLowerCase();
        const hasAccess = userPurchasedProducts.includes(prodNameNorm);
        const cover = produto.url_da_capa || produto.cover_url || 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=600';
        const lockRedirectUrl = produto.se_bloqueado || '#';
        const clickFn = hasAccess ? `showModules('${produto.id}')` : `window.location.href='${lockRedirectUrl}'`;

        html += `
          <div class="product-card ${!hasAccess ? 'locked' : ''}" onclick="${clickFn}">
            <div class="product-card__cover">
              <img src="${cover}" alt="${produto.name}" loading="lazy">
              <div class="product-card__cover-overlay">
                <p class="product-card__title">${produto.name}</p>
                ${!hasAccess ? '<span class="product-card__badge">🔒 Adquira para Acessar</span>' : ''}
              </div>
            </div>
            <div class="product-card__footer">
              <p class="product-card__desc">${produto.description || 'Clique para acessar os conteúdos deste produto.'}</p>
              <button class="product-card__btn${!hasAccess ? ' locked' : ''}" onclick="${clickFn}">
                ${!hasAccess ? '🔒 Desbloquear' : 'Acessar →'}
              </button>
            </div>
          </div>
        `;
    });

    html += `</div>`;
    grid.innerHTML = html;
}

// --- RENDERIZAR MÓDULOS DE UM PRODUTO (View 2) ---
window.showModules = (produtoId) => {
    const produto = allProdutos.find(p => p.id == produtoId);
    if (!produto) return;

    const grid = document.getElementById('modulesGrid');
    const sectionTitle = document.querySelector('.section-title');
    
    if (sectionTitle) {
        sectionTitle.innerHTML = `
            <button onclick="window.history.replaceState({}, '', 'index.html#modulos'); renderProducts()" class="btn btn-secondary" style="padding: 0.4rem 1rem; margin-right: 1rem; border-radius: 8px; font-size: 0.9rem;">
                ← Voltar
            </button> 
            ${produto.name}
        `;
    }

    if (!produto.modules || produto.modules.length === 0) {
        grid.innerHTML = '<p class="text-muted" style="text-align:center; width:100%;">Nenhum módulo disponível neste produto no momento.</p>';
        return;
    }

    produto.modules.sort((a, b) => a.order_index - b.order_index);

    let html = `<div class="cards-grid">`;

    produto.modules.forEach((mod, index) => {
        const isLocked = mod.status === 'bloqueado';
        const isSoon = mod.status === 'em_breve';
        const cover = mod.cover_url || mod.url_da_capa || produto.url_da_capa || produto.cover_url || 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=600';
        const targetUrl = (isSoon || isLocked) ? '#' : `player.html?productId=${produto.id}&moduleId=${mod.id}`;
        const clickFn = (!isSoon && !isLocked) ? `window.location.href='${targetUrl}'` : '';

        html += `
          <div class="product-card ${isLocked ? 'locked' : ''}" ${clickFn ? `onclick="${clickFn}"` : ''}>
            <div class="product-card__cover">
              <img src="${cover}" alt="${mod.title}" loading="lazy">
              <div class="product-card__cover-overlay">
                <span class="product-card__number">Módulo ${(index + 1).toString().padStart(2, '0')}</span>
                <p class="product-card__title">${mod.title}</p>
                ${isLocked ? '<span class="product-card__badge">🔒 Bloqueado</span>' : ''}
                ${isSoon ? '<span class="product-card__badge">⏳ Em Breve</span>' : ''}
              </div>
            </div>
            <div class="product-card__footer">
              <p class="product-card__desc">${mod.description || 'Acesse as aulas e materiais deste módulo.'}</p>
              <button class="product-card__btn${isSoon || isLocked ? ' locked' : ''}" 
                      ${isSoon || isLocked ? 'disabled' : `onclick="${clickFn}"`}>
                ${isSoon ? 'Em Breve' : (isLocked ? 'Bloqueado' : 'Acessar →')}
              </button>
            </div>
          </div>
        `;
    });

    html += `</div>`;
    grid.innerHTML = html;
};


// Expõe a função pro html
Object.assign(window, {
    renderProducts
});

// Iniciar
window.addEventListener('load', initStudent);
