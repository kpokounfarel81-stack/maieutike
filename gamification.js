/**
 * Maieutik Gamification Module
 * Gère la logique de jeu, la persistance locale et la mise à jour dynamique de l'interface.
 * Design : Épuré (Inspiration Tailwind / Shadcn).
 */

const GAMIFICATION_CONFIG = {
    XP_PER_LEVEL: 500,
    STORAGE_KEYS: {
        XP: 'maieutik_xp',
        STREAK: 'maieutik_streak',
        BADGES: 'maieutik_badges',
        HISTORY: 'maieutik_history'
    }
};

/**
 * Initialise et récupère les variables utilisateur depuis le LocalStorage.
 */
const getUserStats = () => {
    const xp = parseInt(localStorage.getItem(GAMIFICATION_CONFIG.STORAGE_KEYS.XP)) || 0;
    const streak = parseInt(localStorage.getItem(GAMIFICATION_CONFIG.STORAGE_KEYS.STREAK)) || 0;
    let badges = [];
    try {
        badges = JSON.parse(localStorage.getItem(GAMIFICATION_CONFIG.STORAGE_KEYS.BADGES)) || [];
    } catch (e) {
        badges = [];
    }
    return { xp, streak, badges };
};

/**
 * Sauvegarde l'état actuel des statistiques.
 */
const saveUserStats = (stats) => {
    localStorage.setItem(GAMIFICATION_CONFIG.STORAGE_KEYS.XP, stats.xp);
    localStorage.setItem(GAMIFICATION_CONFIG.STORAGE_KEYS.STREAK, stats.streak);
    localStorage.setItem(GAMIFICATION_CONFIG.STORAGE_KEYS.BADGES, JSON.stringify(stats.badges));
};

/**
 * Intercepte la réponse de l'IA pour extraire les récompenses.
 * Utilise une Regex pour détecter le statut COMPLETED et parser le JSON associé.
 */
const processAIResponse = (responseText) => {
    // Regex pour détecter '"status": "COMPLETED"' et capturer l'objet JSON
    const completionRegex = /\{[\s\S]*?"status"\s*:\s*"COMPLETED"[\s\S]*?\}/;
    const match = responseText.match(completionRegex);

    if (match) {
        try {
            const data = JSON.parse(match[0]);
            const stats = getUserStats();

            // Cumul de l'XP
            stats.xp += (data.xp_awarded || 0);

            // Gestion de la série (streak)
            if (data.streak_increment) {
                stats.streak += 1;
            }

            // Ajout du badge si nouveau
            if (data.badge_unlocked && !stats.badges.includes(data.badge_unlocked)) {
                stats.badges.push(data.badge_unlocked);
            }

            // Enregistrement dans l'historique local
            const history = JSON.parse(localStorage.getItem(GAMIFICATION_CONFIG.STORAGE_KEYS.HISTORY)) || [];
            history.unshift({
                title: "Analyse socratique",
                subject: "LOGIC", // Valeur par défaut, peut être enrichie par le contexte
                status: data.status,
                xp_earned: data.xp_awarded || 0
            });
            localStorage.setItem(GAMIFICATION_CONFIG.STORAGE_KEYS.HISTORY, JSON.stringify(history.slice(0, 50)));

            saveUserStats(stats);
            return data;
        } catch (error) {
            console.error("[Maieutik-Gamification] Erreur lors de l'extraction des données :", error);
        }
    }
    return null;
};

/**
 * Calcule le niveau (1 niv / 500 XP) et la progression interne.
 */
const getLevelData = (xp) => {
    const level = Math.floor(xp / GAMIFICATION_CONFIG.XP_PER_LEVEL) + 1;
    const currentLevelXp = xp % GAMIFICATION_CONFIG.XP_PER_LEVEL;
    const progressPercent = (currentLevelXp / GAMIFICATION_CONFIG.XP_PER_LEVEL) * 100;
    return { level, currentLevelXp, progressPercent };
};

/**
 * Rend dynamiquement les statistiques sur l'élément #dashboard-content.
 */
const renderDashboard = () => {
    const hash = window.location.hash;
    
    // Forcer le rendu si le hash est vide (accueil par défaut) ou strictement #dashboard
    if (hash !== '' && hash !== '#dashboard') return;

    console.log("[Maieutik-Gamification] Injection du tableau de bord en cours...");

    // 1. Détection du conteneur de l'application
    const appContainer = document.getElementById('app') || document.querySelector('main');
    if (!appContainer) return;

    let container = document.getElementById('dashboard-content');
    
    // 2. Injection forcée du template si nécessaire (Nettoyée du return parasite)
    if (!container) {
        const template = document.getElementById('dashboardPage');
        if (template) {
            appContainer.innerHTML = template.innerHTML;
            container = document.getElementById('dashboard-content');
        }
    }

    // 3. Exécution du rendu si le conteneur est présent
    if (!container) {
        console.error("[Maieutik-Gamification] Impossible de trouver ou d'injecter #dashboard-content");
        return;
    }

    const stats = getUserStats();
    const { level, currentLevelXp, progressPercent } = getLevelData(stats.xp);

    container.innerHTML = `
        <!-- BLOC 1 : GAMIFICATION (EN HAUT) -->
        <div class="space-y-6 animate-in fade-in duration-500 mb-8">
            <!-- Carte de Niveau & Progression -->
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
                <div>
                    <h2 class="text-xs font-black text-indigo-500 uppercase tracking-widest mb-1">Apprenti Socratique</h2>
                    <p class="text-3xl font-black text-slate-900">Niveau ${level}</p>
                    <div class="w-64 bg-slate-100 h-3 rounded-full overflow-hidden shadow-inner mt-2">
                        <div class="bg-indigo-500 h-full rounded-full transition-all duration-1000" style="width: ${progressPercent}%"></div>
                    </div>
                    <span class="text-[11px] font-bold text-slate-400 mt-1 block">${currentLevelXp} / 500 XP (${Math.round(progressPercent)}%)</span>
                </div>
                <div class="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-2xl shadow-inner">🎓</div>
            </div>

            <!-- Grille Stats & Badges -->
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
                    <div class="text-2xl">🔥</div>
                    <div><p class="text-[10px] font-bold text-slate-400 uppercase">Série</p><p class="text-lg font-black text-slate-900">${stats.streak} Jours</p></div>
                </div>
                <div class="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
                    <div class="text-2xl">🏆</div>
                    <div><p class="text-[10px] font-bold text-slate-400 uppercase">Badges</p><p class="text-lg font-black text-slate-900">${stats.badges.length}</p></div>
                </div>
            </div>
        </div>

        <hr class="border-slate-100 my-8">

        <!-- BLOC 2 : HISTORIQUE DES EXERCICES (EN BAS) -->
        <div class="history-section pb-12">
            <div class="flex justify-between items-center mb-6 flex-wrap gap-4">
                <h3 class="text-xl font-black text-slate-900">Historique des exercices</h3>
                
                <div id="subjectFilters" class="flex gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                    <button data-filter="all" class="filter-btn px-4 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white transition-all shadow-sm">Tous</button>
                    <button data-filter="MATHEMATICS" class="filter-btn px-4 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-900 transition-all">Maths</button>
                    <button data-filter="PHILOSOPHY" class="filter-btn px-4 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-900 transition-all">Philo</button>
                    <button data-filter="LOGIC" class="filter-btn px-4 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-900 transition-all">Logique</button>
                </div>

                <button onclick="router.newExercise()" class="text-indigo-600 hover:text-indigo-700 font-bold text-xs flex items-center gap-1 transition-colors">
                    <span>Nouvel exercice</span>
                    <span class="text-lg leading-none">+</span>
                </button>
            </div>

            <!-- Zone dynamique de la liste des exercices passés -->
            <div id="exercises-history-list" class="grid grid-cols-1 gap-4">
                <p class="text-xs text-slate-400 italic py-4">Chargement de votre historique...</p>
            </div>
        </div>`;

    // Ré-initialisation des filtres et de la liste après l'écriture dans le DOM
    if (typeof initDashboardInteractions === 'function') {
        initDashboardInteractions();
    }
};

/**
 * Initialise les interactions du tableau de bord (Filtres)
 */
const initDashboardInteractions = () => {
    const filterButtons = document.querySelectorAll('.filter-btn');
    if (!filterButtons.length) return;

    filterButtons.forEach(btn => {
        btn.onclick = () => {
            // Mise à jour de l'état visuel des boutons
            filterButtons.forEach(b => {
                b.classList.remove('bg-slate-900', 'text-white', 'shadow-sm');
                b.classList.add('text-slate-500', 'hover:text-slate-900');
            });
            btn.classList.add('bg-slate-900', 'text-white', 'shadow-sm');
            btn.classList.remove('text-slate-500', 'hover:text-slate-900');

            // Re-filtrage et rendu de la liste
            renderHistoryList(btn.dataset.filter);
        };
    });

    // Premier rendu (Tous)
    renderHistoryList('all');
};

/**
 * Rend dynamiquement la liste des exercices dans l'historique
 */
const renderHistoryList = (filter = 'all') => {
    const historyList = document.getElementById('exercises-history-list');
    if (!historyList) return;

    // Récupération de l'historique (Initialisation si clé absente)
    const historyRaw = localStorage.getItem(GAMIFICATION_CONFIG.STORAGE_KEYS.HISTORY);
    let history = [];
    if (!historyRaw) {
        localStorage.setItem(GAMIFICATION_CONFIG.STORAGE_KEYS.HISTORY, JSON.stringify([]));
    } else {
        history = JSON.parse(historyRaw);
    }

    // Application du filtre
    const filtered = filter === 'all' ? history : history.filter(ex => ex.subject === filter);

    if (filtered.length === 0) {
        historyList.innerHTML = `<p class="text-xs text-slate-400 italic py-4">Aucun exercice trouvé dans cette catégorie.</p>`;
        return;
    }

    // Injection des cartes d'exercices avec le design épuré
    historyList.innerHTML = filtered.map(ex => `
        <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-indigo-100 transition-all group">
            <div class="flex items-center gap-4">
                <span class="px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter ${
                    ex.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                }">
                    ${ex.status}
                </span>
                <div>
                    <h4 class="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">${ex.title || 'Exercice Maïeutique'}</h4>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${ex.subject || 'Général'}</p>
                </div>
            </div>
            <div class="text-sm font-black text-indigo-600">
                ${ex.xp_earned > 0 ? `+ ${ex.xp_earned} XP` : '---'}
            </div>
        </div>
    `).join('');
};

// Cycle de vie : Déclenchement automatique lors de la navigation
window.addEventListener('hashchange', renderDashboard);
window.addEventListener('DOMContentLoaded', renderDashboard);

// Exportation globale pour les autres modules (exercises.js)
window.MaieutikGamification = { processAIResponse, renderDashboard, getStats: getUserStats };