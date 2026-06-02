/**
 * Maieutik Gamification Module - Partie 1
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

const saveUserStats = (stats) => {
    localStorage.setItem(GAMIFICATION_CONFIG.STORAGE_KEYS.XP, stats.xp);
    localStorage.setItem(GAMIFICATION_CONFIG.STORAGE_KEYS.STREAK, stats.streak);
    localStorage.setItem(GAMIFICATION_CONFIG.STORAGE_KEYS.BADGES, JSON.stringify(stats.badges));
};

const getLevelData = (xp) => {
    const level = Math.floor(xp / GAMIFICATION_CONFIG.XP_PER_LEVEL) + 1;
    const currentLevelXp = xp % GAMIFICATION_CONFIG.XP_PER_LEVEL;
    const progressPercent = (currentLevelXp / GAMIFICATION_CONFIG.XP_PER_LEVEL) * 100;
    return { level, currentLevelXp, progressPercent };
};

const processAIResponse = (responseText) => {
    const completionRegex = /\{[\s\S]*?"status"\s*:\s*"COMPLETED"[\s\S]*?\}/;
    const match = responseText.match(completionRegex);

    if (match) {
        try {
            const data = JSON.parse(match[0]);
            const stats = getUserStats();

            stats.xp += (data.xp_awarded || 0);
            if (data.streak_increment) stats.streak += 1;
            if (data.badge_unlocked && !stats.badges.includes(data.badge_unlocked)) {
                stats.badges.push(data.badge_unlocked);
            }

            const history = JSON.parse(localStorage.getItem(GAMIFICATION_CONFIG.STORAGE_KEYS.HISTORY)) || [];
            history.unshift({
                title: "Analyse socratique",
                subject: "LOGIC",
                status: data.status,
                xp_earned: data.xp_awarded || 0
            });
            localStorage.setItem(GAMIFICATION_CONFIG.STORAGE_KEYS.HISTORY, JSON.stringify(history.slice(0, 50)));

            saveUserStats(stats);
            return data;
        } catch (error) {
            console.error("[Maieutik-Gamification] Erreur JSON :", error);
        }
    }
    return null;
};

/**
 * 1. Déclaration de l'affichage de la liste d'historique
 */
const renderHistoryList = (filter = 'all') => {
    const historyList = document.getElementById('exercises-history-list');
    if (!historyList) return;

    // Récupération des exercices réels depuis l'application
    const rawExercises = (window.exerciseManager && typeof window.exerciseManager.getExercises === 'function') ? window.exerciseManager.getExercises() : [];

    const history = rawExercises.map(ex => {
        // Adapter selon la structure réelle de vos objets exercices
        return {
            title: ex.title || ex.problem_statement || ex.problemStatement || "Exercice Maïeutique",
            subject: ex.subject || "LOGIC", // Si l'exercice n'a pas de sujet, défaut LOGIC
            status: ex.status || "COMPLETED",
            xp_earned: (ex.status === "COMPLETED" || !ex.status) ? 100 : 0
        };
    });

    const filtered = filter === 'all' ? history : history.filter(ex => ex.subject === filter);

    if (filtered.length === 0) {
        historyList.innerHTML = `<p style="font-size: 12px; color: #94a3b8; font-style: italic; padding: 16px 0; font-family: sans-serif;">Aucun exercice trouvé dans cette catégorie.</p>`;
        return;
    }

    historyList.innerHTML = filtered.map(ex => `
        <div style="background-color: white; padding: 16px; border-radius: 12px; border: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-family: sans-serif; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
            <div style="display: flex; align-items: center; gap: 16px;">
                <span style="padding: 4px 8px; border-radius: 4px; font-size: 9px; font-weight: 900; text-transform: uppercase; ${
                    ex.status === 'COMPLETED' ? 'background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;' : 'background-color: #fffbeb; color: #d97706; border: 1px solid #fde68a;'
                }">
                    ${ex.status}
                </span>
                <div>
                    <h4 style="font-size: 14px; font-weight: bold; color: #0f172a; margin: 0;">${ex.title}</h4>
                    <p style="font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase; margin: 0; letter-spacing: 0.05em;">${ex.subject}</p>
                </div>
            </div>
            <div style="font-size: 14px; font-weight: 900; color: #4f46e5;">
                ${ex.xp_earned > 0 ? `+ ${ex.xp_earned} XP` : '---'}
            </div>
        </div>
    `).join('');
};

/**
 * 2. Déclaration de l'initialisation des interactions (filtres)
 */
const initDashboardInteractions = () => {
    const filterButtons = document.querySelectorAll('.filter-btn');
    if (!filterButtons.length) return;

    filterButtons.forEach(btn => {
        btn.onclick = () => {
            filterButtons.forEach(b => {
                b.style.backgroundColor = 'transparent';
                b.style.color = '#64748b';
            });
            btn.style.backgroundColor = '#0f172a';
            btn.style.color = 'white';
            renderHistoryList(btn.dataset.filter);
        };
    });

    renderHistoryList('all');
};

/**
 * 3. Fonction principale de rendu
 */
const renderDashboard = () => {
    const hash = window.location.hash;
    
    // CONDITION STRICTE : Si on n'est pas sur le tableau de bord, on stoppe immédiatement
    if (hash !== '#dashboard') return;

    console.log("[Maieutik-Gamification] Début officiel du rendu visuel...");

    // 1. Ciblage du conteneur d'affichage de l'application
    const appContainer = document.getElementById('app') || document.querySelector('main') || document.body;
    if (!appContainer) return;
    
    // 2. Extraction forcée du template si le wrapper n'est pas encore actif
    let container = document.getElementById('dashboard-content');
    if (!container) {
        console.log("[Maieutik-Gamification] #dashboard-content introuvable. Extraction forcée du template...");
        const template = document.getElementById('dashboardPage');
        if (template) {
            appContainer.innerHTML = template.innerHTML;
            container = document.getElementById('dashboard-content');
        } else {
            appContainer.innerHTML = '<div id="dashboard-content" class="maieutik-dashboard-wrapper"></div>';
            container = document.getElementById('dashboard-content');
        }
    }

    if (!container) return;

    // 3. Récupération et calcul des statistiques réelles
    const rawExercises = (window.exerciseManager && typeof window.exerciseManager.getExercises === 'function') ? window.exerciseManager.getExercises() : [];
    
    // Calcul de l'XP totale : 100 XP par exercice COMPLETED
    const totalXp = rawExercises.reduce((acc, ex) => {
        return (ex.status === 'COMPLETED' || !ex.status) ? acc + 100 : acc;
    }, 0);

    const stats = getUserStats();
    const { level, currentLevelXp, progressPercent } = getLevelData(totalXp);

    console.log("[Maieutik-Gamification] Injection du code HTML hybride...");

    // 4. Injection de l'interface complète (Gamification + Historique)
    container.innerHTML = `
        <div style="font-family: sans-serif; padding: 12px;">
            <!-- BLOC 1 : GAMIFICATION -->
            <div style="background: white; border: 1px solid #e2e8f0; padding: 24px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div>
                    <h2 style="color: #6366f1; font-size: 12px; font-weight: 900; text-transform: uppercase; margin: 0;">Apprenti Socratique</h2>
                    <p style="font-size: 30px; font-weight: 900; margin: 4px 0; color: #0f172a;">Niveau ${level}</p>
                    <div style="width: 240px; background: #f1f5f9; height: 10px; border-radius: 10px; overflow: hidden; margin-top: 8px;">
                        <div style="background: #6366f1; width: ${progressPercent}%; height: 100%; transition: width 1s ease-out;"></div>
                    </div>
                    <span style="font-size: 11px; font-weight: bold; color: #94a3b8; margin-top: 4px; display: block;">${currentLevelXp} / 500 XP (${Math.round(progressPercent)}%)</span>
                </div>
                <div style="font-size: 32px; width: 56px; height: 56px; background: #e0e7ff; border-radius: 12px; display: flex; align-items: center; justify-content: center;">🎓</div>
            </div>
            
            <div style="display: flex; gap: 16px; margin: 16px 0;">
                <div style="background: white; border: 1px solid #e2e8f0; padding: 16px; border-radius: 16px; flex: 1; display: flex; align-items: center; gap: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);"><span>🔥</span> <b style="color: #0f172a;">${stats.streak} Jours</b></div>
                <div style="background: white; border: 1px solid #e2e8f0; padding: 16px; border-radius: 16px; flex: 1; display: flex; align-items: center; gap: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);"><span>🏆</span> <b style="color: #0f172a;">${stats.badges.length} Badges</b></div>
            </div>

            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">

            <!-- BLOC 2 : HISTORIQUE -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
                <h3 style="font-size: 18px; font-weight: 900; margin: 0; color: #0f172a;">Historique des exercices</h3>
                <div id="subjectFilters" style="display: flex; gap: 4px; background: #f8fafc; padding: 4px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <button data-filter="all" class="filter-btn" style="background: #0f172a; color: white; padding: 6px 14px; border-radius: 6px; border: 0; font-size: 12px; font-weight: bold; cursor: pointer;">Tous</button>
                    <button data-filter="MATHEMATICS" class="filter-btn" style="background: transparent; color: #64748b; padding: 6px 14px; border-radius: 6px; border: 0; font-size: 12px; font-weight: bold; cursor: pointer;">Maths</button>
                    <button data-filter="PHILOSOPHY" class="filter-btn" style="background: transparent; color: #64748b; padding: 6px 14px; border-radius: 6px; border: 0; font-size: 12px; font-weight: bold; cursor: pointer;">Philo</button>
                    <button data-filter="LOGIC" class="filter-btn" style="background: transparent; color: #64748b; padding: 6px 14px; border-radius: 6px; border: 0; font-size: 12px; font-weight: bold; cursor: pointer;">Logique</button>
                </div>
            </div>
            <div id="exercises-history-list"></div>
        </div>
    `;

    // 5. Activation des filtres et injection de la liste
    initDashboardInteractions();
    console.log("[Maieutik-Gamification] Rendu terminé avec succès !");
};

/**
 * 4. Écouteurs d'événements et exportation globale
 */
window.addEventListener('hashchange', renderDashboard);
window.addEventListener('DOMContentLoaded', renderDashboard);
window.MaieutikGamification = { processAIResponse, renderDashboard, getStats: getUserStats };