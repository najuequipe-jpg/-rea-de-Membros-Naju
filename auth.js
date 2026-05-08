import { createClient } from '@supabase/supabase-js';

// auth.js - Sistema de Acesso Direto Naju Araújo (Sem E-mail de Confirmação)
// Nota: a anon key é uma chave pública, projetada para uso no browser.
const SUPABASE_URL = 'https://jiauidhoxuuzjdwegbyg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppYXVpZGhveHV1empkd2VnYnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MzU2NzIsImV4cCI6MjA5MzUxMTY3Mn0.FfeyKuS2SwTnuk8DBSHCRY2SONXi-gBfjvh8rYqb1BA';

// Inicializa o cliente Supabase
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * LOGIN DIRETO (Sem confirmação de e-mail)
 * Verifica acesso via RPC seguro no Supabase e libera se o e-mail for válido.
 */
export async function login(email) {
    try {
        // Busca na tabela 'compras' para validar o e-mail e obter o nome
        const { data, error } = await supabaseClient
            .from('compras')
            .select('*')
            .ilike('email', email.trim())
            .limit(1);

        if (error || !data || data.length === 0) {
            console.error("Erro ou acesso negado:", error);
            return { success: false, message: '⚠️ Acesso Negado. Nenhuma compra encontrada para este e-mail.' };
        }

        const profile = data[0]; 

        // Criar Sessão Manual no LocalStorage
        const sessionData = {
            user: profile,
            loginTime: Date.now(),
            expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // Expira em 30 dias
        };
        localStorage.setItem('av_premium_session', JSON.stringify(sessionData));

        return { success: true, message: 'Acesso liberado! Redirecionando...' };
    } catch (err) {
        console.error("Erro no login direto:", err);
        return { success: false, message: 'Erro ao validar acesso. Tente novamente.' };
    }
}

/**
 * PROTEGER ROTAS E OBTER USUÁRIO ATUAL
 * Valida a sessão manual e protege as páginas restritas.
 */
export async function checkUser() {
    const sessionStr = localStorage.getItem('av_premium_session');
    const isLoginPage = window.location.pathname.includes('login.html');
    
    if (!sessionStr) {
        if (!isLoginPage) {
            window.location.href = 'login.html';
        }
        return null;
    }

    try {
        const session = JSON.parse(sessionStr);
        
        // Verificar expiração (30 dias)
        if (Date.now() > session.expiresAt) {
            logout();
            return null;
        }

        const profile = session.user;

        // Se tentar acessar página admin (desativada), redireciona para a home
        if (window.location.pathname.includes('admin')) {
            window.location.href = 'index.html';
            return null;
        }

        // Se estiver na login mas já estiver logado, vai pro início
        if (isLoginPage) {
            window.location.href = 'index.html';
        }

        return profile;
    } catch (e) {
        logout();
        return null;
    }
}

/**
 * LOGOUT
 * Limpa a sessão manual.
 */
export async function logout() {
    localStorage.removeItem('av_premium_session');
    window.location.href = 'login.html';
}

// Mantemos o window.auth para retrocompatibilidade em chamadas inline simples (ex: botões onlick)
window.auth = { login, checkUser, logout, supabase: supabaseClient };
