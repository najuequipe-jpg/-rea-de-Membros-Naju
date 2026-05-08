import { checkUser, supabaseClient } from './auth.js';

// player.js - Lógica do Reprodutor Premium Naju Araújo
let currentUser = null;
let allModules = [];
let allLessonsFlattened = []; 
let moduleAnexos = [];
let allAnexosByModule = {}; // mapa: module_id -> array de anexos
let currentLesson = null;
let currentModule = null;

async function initPlayer() {
    // Garante topo da página ao navegar entre módulos
    window.scrollTo({ top: 0, behavior: 'instant' });

    currentUser = await checkUser();
    if (!currentUser) return;

    const urlParams = new URLSearchParams(window.location.search);
    const moduleIdParam = urlParams.get('moduleId');
    const lessonIdParam = urlParams.get('lessonId');
    let productId = urlParams.get('productId');

    if (!moduleIdParam) {
        window.location.href = 'index.html';
        return;
    }

    // 1. Fallback se productId n estiver na URL
    if (!productId) {
        const { data: mod } = await supabaseClient.from('modules').select('product_id').eq('id', moduleIdParam).single();
        if (mod && mod.product_id) productId = mod.product_id;
        else { window.location.href = 'index.html'; return; }
    }

    // 2. Montar Array de Aulas Linear
    const { data: modules } = await supabaseClient
        .from('modules')
        .select('id, title, description, cover_url, order_index, product_id')
        .eq('product_id', productId)
        .order('order_index', { ascending: true });

    allModules = modules || [];
    const moduleIds = allModules.map(m => m.id);

    if (moduleIds.length === 0) {
        alert("Este produto não possui módulos.");
        window.location.href = 'index.html';
        return;
    }

    const { data: lessons } = await supabaseClient
        .from('lessons')
        .select('id, module_id, title, description, video_url, video_type, duration, order_index')
        .in('module_id', moduleIds);

    // Flatten and Sort com suporte a Módulos sem vídeo
    let rawLessons = lessons || [];
    allLessonsFlattened = [];
    
    allModules.forEach(mod => {
        let modLessons = rawLessons.filter(l => l.module_id === mod.id);
        if (modLessons.length > 0) {
            modLessons.sort((a, b) => a.order_index - b.order_index);
            allLessonsFlattened.push(...modLessons);
        } else {
            // Se não houver aula para este módulo, criamos uma aula fantasma
            // Para não quebrar a navegação linear (o módulo aparecerá com seus anexos)
            allLessonsFlattened.push({
                id: 'dummy_' + mod.id,
                module_id: mod.id,
                title: 'Conteúdo do Módulo',
                description: 'Acesse os anexos e materiais abaixo.',
                video_url: null,
                video_type: null,
                duration: 'N/A'
            });
        }
    });

    // Validar se tem aulas
    if (allLessonsFlattened.length === 0) {
        document.querySelector('.player-container').innerHTML = '<h3 style="color:#fff; text-align:center; margin-top: 50px;">Ainda não há conteúdo cadastrado neste produto.</h3>';
        return;
    }

    // Determinar a aula atual
    if (lessonIdParam) {
        currentLesson = allLessonsFlattened.find(l => l.id == lessonIdParam);
    } 
    if (!currentLesson) {
        // Se n achou a lessonId, pega a primeira aula do modulo passado na URL
        currentLesson = allLessonsFlattened.find(l => l.module_id == moduleIdParam) || allLessonsFlattened[0];
    }

    currentModule = allModules.find(m => m.id == currentLesson.module_id);

    // Carregar anexos de TODOS os módulos de uma vez (para a sidebar)
    const { data: todosAnexos } = await supabaseClient
        .from('anexos')
        .select('*')
        .in('modulo_id', moduleIds)
        .order('ordem', { ascending: true });

    allAnexosByModule = {};
    (todosAnexos || []).forEach(a => {
        if (!allAnexosByModule[a.modulo_id]) allAnexosByModule[a.modulo_id] = [];
        allAnexosByModule[a.modulo_id].push(a);
    });

    // Anexos do módulo atual
    moduleAnexos = allAnexosByModule[currentModule.id] || [];

    // Ajustar Link de Voltar aos Módulos
    const backBtn = document.querySelector('.back-link');
    if (backBtn && productId) {
        backBtn.href = `index.html?product_id=${productId}`;
    }

    renderPlayer();
    renderSidebar();
}

/**
 * Utilitário de Parsing de URL de Vídeo (YouTube, Vimeo, Mp4 direto)
 */
function parseVideoUrl(url, type) {
    if (!url || typeof url !== 'string') return null;
    url = url.trim();

    if (type === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = null;
        if (url.includes('youtube.com/watch')) {
            videoId = new URL(url).searchParams.get('v');
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('youtube.com/embed/')) {
            videoId = url.split('youtube.com/embed/')[1].split('?')[0];
        } else {
            // Assume the string itself is just the ID if no domain is present
            videoId = url.length === 11 ? url : null;
        }

        if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`;
    }

    if (type === 'vimeo' || url.includes('vimeo.com')) {
        let vimeoId = url.split('vimeo.com/')[1] || url;
        vimeoId = vimeoId.split('?')[0].replace(/\D/g, ''); // Extract numbers
        if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
    }

    // Tratar como link genérico ou mp4
    return url;
}


function renderPlayer() {
    if (!currentLesson) return;

    const playerFrame = document.getElementById('videoPlayer');
    const titleElem = document.getElementById('lessonTitle');
    const descElem = document.getElementById('lessonDescription');
    const metaElem = document.getElementById('lessonMeta');
    
    // Configurar Vídeo Inteligente
    const finalVideoSrc = parseVideoUrl(currentLesson.video_url, currentLesson.video_type);
    const videoWrapper = playerFrame.parentNode;
    const videoSection = document.querySelector('.video-section');
    const playerContainer = document.querySelector('.player-container');
    const sidebar = document.querySelector('.player-sidebar');

    if (finalVideoSrc) {
        videoWrapper.style.display = 'block';
        playerFrame.src = finalVideoSrc;
        
        // Retorna aos estilos da seção de vídeo
        videoSection.style.background = 'var(--dark-card)';
        videoSection.style.border = '1px solid var(--glass-border)';
        videoSection.style.boxShadow = '0 40px 100px rgba(0, 0, 0, 0.4)';
        titleElem.style.fontSize = '2.2rem';

        // Mostra sidebar e volta ao grid
        sidebar.style.display = 'flex';
        playerContainer.style.gridTemplateColumns = '1fr 380px';
    } else {
        // Esconde completamente a moldura e o player se n tiver video
        videoWrapper.style.display = 'none';
        playerFrame.src = '';

        // Tira o "caixote" envolta do titulo para mesclar com o fundo
        videoSection.style.background = 'transparent';
        videoSection.style.border = 'none';
        videoSection.style.boxShadow = 'none';
        
        // Aumenta o título para dar destaque quando não tem vídeo
        titleElem.style.fontSize = '3rem';

        // Esconde sidebar e usa 1 coluna (centralizado)
        sidebar.style.display = 'none';
        playerContainer.style.gridTemplateColumns = '1fr';
        playerContainer.style.maxWidth = '1000px'; // Centraliza melhor o texto
    }
    
    titleElem.textContent = currentLesson.title;
    // Exibe a descrição do MÓDULO (não da aula/vídeo)
    descElem.innerHTML = currentModule.description
        ? `<p>${currentModule.description}</p>`
        : '<p style="color:var(--text-muted);">Tudo o que você precisa saber para começar.</p>';
    
    const durationText = (currentLesson.duration && currentLesson.duration !== 'N/A') ? ` &bull; Duração: ${currentLesson.duration}` : '';
    metaElem.innerHTML = `<span>${currentModule.title}</span>${durationText}`;

    // Materiais (Anexos)
    const materialBox = document.getElementById('materialsBox');
    const materialList = document.getElementById('materialsList');
    
    if (moduleAnexos.length > 0) {
        materialBox.style.display = 'block';
        materialList.innerHTML = moduleAnexos.map(anexo => `
            <div class="material-item">
                <span style="font-weight: 600; color: var(--gold-light);">📄 ${anexo.titulo || 'Documento'}</span>
                <div style="display: flex; gap: 0.5rem;">
                    <a href="${anexo.arquivo_url}" target="_blank" class="btn btn-secondary btn-sm" style="padding: 0.5rem 1rem; border-radius: 8px; text-decoration: none; font-size: 0.85rem;">Ver</a>
                    <a href="${anexo.arquivo_url}" download class="btn btn-primary btn-sm" style="padding: 0.5rem 1rem; border-radius: 8px; text-decoration: none; color: #fff; font-size: 0.85rem;">Baixar</a>
                </div>
            </div>
        `).join('');
    } else {
        materialBox.style.display = 'none';
        materialList.innerHTML = '';
    }

    // Botões Navegação Contínua Módulo/Aula
    const currentIndex = allLessonsFlattened.findIndex(l => l.id == currentLesson.id);
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    // Esconder barra inteira se só existe 1 aula no produto
    if (allLessonsFlattened.length === 1) {
        document.querySelector('.lesson-actions').style.display = 'none';
    } else {
        document.querySelector('.lesson-actions').style.display = 'flex';
        // Lógica de Prev
        if (currentIndex <= 0) {
            if (allModules.length > 1) {
                prevBtn.style.display = 'block';
                prevBtn.innerHTML = "← Módulos";
                prevBtn.onclick = () => window.location.href = `index.html?product_id=${currentModule.product_id}`;
            } else {
                prevBtn.style.display = 'none';
            }
        } else {
            prevBtn.style.display = 'block';
            prevBtn.innerHTML = "← Anterior";
            prevBtn.onclick = () => navigate(-1);
        }
        
        // Lógica de Next
        if (currentIndex >= allLessonsFlattened.length - 1) {
            if (allModules.length > 1) {
                nextBtn.style.display = 'block';
                nextBtn.innerHTML = "Concluir 🎉";
                nextBtn.className = "btn btn-primary";
                nextBtn.onclick = () => window.location.href = `index.html?product_id=${currentModule.product_id}`;
            } else {
                nextBtn.style.display = 'none';
            }
        } else {
            nextBtn.style.display = 'block';
            // Verifica se a proxima aula muda de modulo
            const nextLesson = allLessonsFlattened[currentIndex + 1];
            if (nextLesson.module_id !== currentLesson.module_id) {
                nextBtn.innerHTML = "Próximo Módulo →";
                nextBtn.className = "btn btn-primary"; // Destaque
            } else {
                nextBtn.innerHTML = "Próxima Aula →";
                nextBtn.className = "btn btn-secondary";
            }
            nextBtn.onclick = () => navigate(1);
        }
    }
    // Revelar container após carregar tudo
    playerContainer.style.opacity = '1';
}

function renderSidebar() {
    const list = document.getElementById('lessonsList');
    const progressTitle = document.getElementById('moduleProgress');
    
    // Contagem baseada na Master List Flattened
    const currentIndex = allLessonsFlattened.findIndex(l => l.id == currentLesson.id);
    progressTitle.textContent = `Aulas (${currentIndex + 1}/${allLessonsFlattened.length}) - ${currentModule.title}`;

    // Vamos renderizar todas as aulas mas agrupadas por módulo visualmente (ou apenas a lista corrida pra facilitar)
    // Para design limpo, renderiza a master list com indicadores visuais se mudar de módulo.
    let html = '';
    let lastModId = null;

    allLessonsFlattened.forEach((l, i) => {
        if (l.module_id !== lastModId) {
            const modLabel = allModules.find(m => m.id === l.module_id)?.title || 'Módulo';
            html += `<div style="font-size: 0.8rem; text-transform: uppercase; color: var(--gold); margin: 1.5rem 0 0.5rem 1rem; font-weight: bold;">${modLabel}</div>`;
            lastModId = l.module_id;
        }

        // Monta label inteligente: "Aula | X Arquivos" / "X Arquivos" / "Aula"
        const modAnexos = allAnexosByModule[l.module_id] || [];
        const modAnexosCount = modAnexos.length;
        const isDummy = l.id.startsWith('dummy_');

        // Título a exibir na sidebar
        let sidebarTitle = l.title;
        if (isDummy && modAnexosCount > 0) {
            // Usa o nome do primeiro arquivo em vez de "Conteúdo do Módulo"
            sidebarTitle = modAnexos[0].titulo || l.title;
        }

        // Sub-label (quantidade de arquivos)
        let sidebarLabel;
        const arquivoWord = (n) => n === 1 ? '1 Arquivo' : `${n} Arquivos`;
        if (isDummy) {
            sidebarLabel = modAnexosCount > 0 ? arquivoWord(modAnexosCount) : 'Conteúdo';
        } else if (modAnexosCount > 0) {
            sidebarLabel = `Aula | ${arquivoWord(modAnexosCount)}`;
        } else {
            sidebarLabel = l.duration || 'Aula';
        }

        html += `
            <div class="lesson-item ${l.id == currentLesson.id ? 'active' : ''}" 
                 onclick="window.location.href='player.html?productId=${currentModule.product_id}&moduleId=${l.module_id}&lessonId=${l.id}'">
                <div class="lesson-status-icon">
                    ${i + 1}
                </div>
                <div class="lesson-content">
                    <h4 style="font-size: 0.9rem; margin-bottom: 0.2rem;">${sidebarTitle}</h4>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${sidebarLabel}</span>
                </div>
            </div>
        `;
    });

    list.innerHTML = html;

    // Scroll interno da sidebar para a aula ativa — sem afetar a página principal
    setTimeout(() => {
        const activeItem = list.querySelector('.lesson-item.active');
        if (activeItem) {
            // Calcula offset relativo ao container da lista (não à página)
            const containerTop = list.getBoundingClientRect().top;
            const itemTop = activeItem.getBoundingClientRect().top;
            const relativeOffset = itemTop - containerTop + list.scrollTop - (list.clientHeight / 2) + (activeItem.clientHeight / 2);
            list.scrollTo({ top: relativeOffset, behavior: 'smooth' });
        }
    }, 150);
}

function navigate(dir) {
    const currentIndex = allLessonsFlattened.findIndex(l => l.id == currentLesson.id);
    const targetLesson = allLessonsFlattened[currentIndex + dir];
    
    if (targetLesson) {
        window.scrollTo({ top: 0, behavior: 'instant' });
        window.location.href = `player.html?productId=${currentModule.product_id}&moduleId=${targetLesson.module_id}&lessonId=${targetLesson.id}`;
    }
}

// Expõe para html
Object.assign(window, {
    navigate
});

// Iniciar
window.addEventListener('load', initPlayer);
