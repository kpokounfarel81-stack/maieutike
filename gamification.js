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

const renderDashboard = () => {
    console.log("[Maieutik-Gamification] Début officiel du rendu visuel...");

    // 1. Ciblage du conteneur d'affichage de l'application
    const appContainer = document.getElementById('app') || document.querySelector('main') || document.body;
    
    // 2. Extraction forcée du template si le wrapper n'est pas encore actif
    let container = document.getElementById('dashboard-content');
    if (!container) {
        console.log("[Maieutik-Gamification] #dashboard-content introuvable. Extraction forcée du template dashboardPage...");
        const template = document.getElementById('dashboardPage');
        if (template) {
            appContainer.innerHTML = template.innerHTML;
            container = document.getElementById('dashboard-content');
        } else {
            // Si même le template n'existe pas, on crée le conteneur à la volée pour éviter la page blanche
            appContainer.innerHTML = '<div id="dashboard-content" class="maieutik-dashboard-wrapper"></div>';
            container = document.getElementById('dashboard-content');
        }
    }

    // 3. Récupération des statistiques de jeu
    const stats = getUserStats();
    const { level, currentLevelXp, progressPercent } = getLevelData(stats.xp);

    console.log("[Maieutik-Gamification] Injection du code HTML hybride...");

    // 4. Injection de l'interface complète (Gamification + Historique)
    container.innerHTML = `
        <!-- BLOC 1 : GAMIFICATION -->
        <div style="font-family: sans-serif; padding: 12px;">
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
                <div style="background: white; border: 1px solid #e2e8f0; padding: 16px; border-radius: 16px; flex: 1; display: flex; items-center; gap: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);"><span>🔥</span> <b style="color: #0f172a;">${stats.streak} Jours</b></div>
                <div style="background: white; border: 1px solid #e2e8f0; padding: 16px; border-radius: 16px; flex: 1; display: flex; items-center; gap: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);"><span>🏆</span> <b style="color: #0f172a;">${stats.badges.length} Badges</b></div>
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

window.addEventListener('hashchange', renderDashboard);
window.addEventListener('DOMContentLoaded', renderDashboard);
window.MaieutikGamification = { processAIResponse, renderDashboard, getStats: getUserStats };