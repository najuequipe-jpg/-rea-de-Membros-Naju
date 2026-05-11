import { checkUser, supabaseClient } from './auth.js';

// admin.js - Lógica do Painel Administrativo Naju Araújo
let currentUser = null;

async function initAdmin() {
    currentUser = await checkUser();
    // Nota: O acesso admin agora é simplificado ou via e-mail específico
    if (!currentUser) return;

    document.getElementById('adminContent').style.display = 'grid';
    document.getElementById('adminName').textContent = currentUser.nome_completo || 'Administrador';
    
    // Carregar dados iniciais
    loadDashboardStats();
    loadModules();
    loadSiteSettings();
}

// --- DASHBOARD ---
async function loadDashboardStats() {
    const { count: userCount } = await supabaseClient.from('compras').select('*', { count: 'exact', head: true });
    const { count: prodCount } = await supabaseClient.from('produtos').select('*', { count: 'exact', head: true });
    const { count: lessCount } = await supabaseClient.from('lessons').select('*', { count: 'exact', head: true });

    document.getElementById('stat-users').textContent = userCount || 0;
    document.getElementById('stat-modules').textContent = prodCount || 0;
    document.getElementById('stat-lessons').textContent = lessCount || 0;
}

// --- MÓDULOS ---
async function loadModules() {
    const { data: modules, error } = await supabaseClient
        .from('modules')
        .select('*')
        .order('order_index', { ascending: true });

    if (error) return console.error(error);

    const container = document.getElementById('modulesList');
    const select = document.getElementById('lessModule');
    
    container.innerHTML = modules.map(m => `
        <div class="admin-card">
            <div class="card-info">
                <h4>${m.title}</h4>
                <p>${m.description || 'Sem descrição'}</p>
                <span class="badge ${m.status}">${m.status}</span>
            </div>
            <div class="card-actions">
                <button onclick="editModule('${m.id}')" class="btn-icon">✏️</button>
                <button onclick="deleteModule('${m.id}')" class="btn-icon delete">🗑️</button>
            </div>
        </div>
    `).join('');

    // Atualiza select de aulas
    if (select) {
        select.innerHTML = '<option value="">Selecione um Módulo</option>' + 
            modules.map(m => `<option value="${m.id}">${m.title}</option>`).join('');
    }
}

async function editModule(id) {
    const { data: m } = await supabaseClient.from('modules').select('*').eq('id', id).single();
    if (!m) return;
    document.getElementById('modId').value = m.id;
    document.getElementById('modTitle').value = m.title;
    document.getElementById('modDesc').value = m.description || '';
    document.getElementById('modCover').value = m.cover_url || '';
    document.getElementById('modStatus').value = m.status || 'liberado';
    document.getElementById('modOrder').value = m.order_index;
    openModal('moduleModal', false);
}

async function saveModule(e) {
    e.preventDefault();
    const id = document.getElementById('modId').value;
    const title = document.getElementById('modTitle').value;
    const data = {
        title,
        slug: title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''),
        description: document.getElementById('modDesc').value,
        cover_url: document.getElementById('modCover').value,
        status: document.getElementById('modStatus').value,
        order_index: parseInt(document.getElementById('modOrder').value) || 0
    };

    let error;
    if (id) {
        ({ error } = await supabaseClient.from('modules').update(data).eq('id', id));
    } else {
        ({ error } = await supabaseClient.from('modules').insert(data));
    }

    if (!error) {
        closeModal('moduleModal');
        loadModules();
        loadDashboardStats();
    } else {
        alert("Erro ao salvar: " + error.message);
    }
}

// --- AULAS ---
async function loadLessons() {
    const { data: lessons, error } = await supabaseClient
        .from('lessons')
        .select('*, modules(title)')
        .order('module_id', { ascending: true })
        .order('order_index', { ascending: true });

    if (error) return console.error(error);

    const container = document.getElementById('lessonsList');
    container.innerHTML = lessons.map(l => `
        <div class="admin-card">
            <div class="card-info">
                <h4>${l.title}</h4>
                <p>Módulo: ${l.modules?.title || 'N/A'}</p>
                <span class="badge ${l.status}">${l.status}</span>
            </div>
            <div class="card-actions">
                <button onclick="editLesson('${l.id}')" class="btn-icon">✏️</button>
                <button onclick="deleteLesson('${l.id}')" class="btn-icon delete">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function editLesson(id) {
    const { data: l } = await supabaseClient.from('lessons').select('*').eq('id', id).single();
    if (!l) return;
    document.getElementById('lessId').value = l.id;
    document.getElementById('lessModule').value = l.module_id || '';
    document.getElementById('lessTitle').value = l.title;
    document.getElementById('lessDesc').value = l.description || '';
    document.getElementById('lessVideo').value = l.video_url || '';
    document.getElementById('lessType').value = l.video_type || 'youtube';
    document.getElementById('lessDuration').value = l.duration || '';
    document.getElementById('lessOrder').value = l.order_index;
    document.getElementById('lessStatus').value = l.status || 'liberada';
    if(document.getElementById('lessMaterial')) {
        document.getElementById('lessMaterial').value = l.attachment_url || '';
    }
    openModal('lessonModal', false);
}

async function saveLesson(e) {
    e.preventDefault();
    const id = document.getElementById('lessId').value;
    const title = document.getElementById('lessTitle').value;
    const data = {
        module_id: document.getElementById('lessModule').value,
        title,
        slug: title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''),
        description: document.getElementById('lessDesc').value,
        video_url: document.getElementById('lessVideo').value,
        video_type: document.getElementById('lessType').value,
        attachment_url: document.getElementById('lessMaterial') ? document.getElementById('lessMaterial').value : null,
        duration: document.getElementById('lessDuration').value,
        status: document.getElementById('lessStatus').value,
        order_index: parseInt(document.getElementById('lessOrder').value) || 0
    };

    let error;
    if (id) {
        ({ error } = await supabaseClient.from('lessons').update(data).eq('id', id));
    } else {
        ({ error } = await supabaseClient.from('lessons').insert(data));
    }

    if (!error) {
        closeModal('lessonModal');
        loadLessons();
        loadDashboardStats();
    } else {
        alert("Erro ao salvar: " + error.message);
    }
}

// --- CONFIGURAÇÕES SITE ---
async function loadSiteSettings() {
    const { data, error } = await supabaseClient.from('site_settings').select('*').limit(1).single();
    if (error) return;

    document.getElementById('setHeroTitle').value = data.hero_title;
    document.getElementById('setHeroSubtitle').value = data.hero_subtitle;
    document.getElementById('setSupport').value = data.support_link || '';
}

async function updateSettings(e) {
    e.preventDefault();
    const data = {
        hero_title: document.getElementById('setHeroTitle').value,
        hero_subtitle: document.getElementById('setHeroSubtitle').value,
        support_link: document.getElementById('setSupport').value,
        updated_at: new Date()
    };

    const { error } = await supabaseClient.from('site_settings').update(data).not('id', 'is', null);
    
    if (!error) {
        alert("Configurações salvas com sucesso!");
    } else {
        alert("Erro ao salvar: " + error.message);
    }
}

// --- HELPERS ---
function switchSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    
    document.querySelectorAll('.sidebar-nav li').forEach(l => l.classList.remove('active'));
    event.currentTarget.classList.add('active');

    if (sectionId === 'lessons') loadLessons();
    if (sectionId === 'modules') loadModules();
    if (sectionId === 'dashboard') loadDashboardStats();
}

function openModal(id, reset = true) {
    if (reset) document.querySelector(`#${id} form`).reset();
    document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

// --- DELETE OPS ---
async function deleteModule(id) {
    if (!confirm("Tem certeza? Isso excluirá todas as aulas deste módulo.")) return;
    await supabaseClient.from('modules').delete().eq('id', id);
    loadModules();
}

async function deleteLesson(id) {
    if (!confirm("Tem certeza?")) return;
    await supabaseClient.from('lessons').delete().eq('id', id);
    loadLessons();
}

// Em ambiente de módulos ES, expomos para o escopo global as funções chamadas por handlers onclick no HTML
Object.assign(window, {
    switchSection,
    openModal,
    closeModal,
    saveModule,
    saveLesson,
    updateSettings,
    deleteModule,
    deleteLesson,
    editModule,
    editLesson
});

// Iniciar
window.addEventListener('load', initAdmin);
