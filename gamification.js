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
const renderHistoryList = (filter = 'all', supabaseExercises = []) => {
    const historyList = document.getElementById('exercises-history-list');
    if (!historyList) return;

    const history = supabaseExercises.map(ex => ({
        title: ex.title || ex.problem_statement || ex.problemStatement || "Exercice Maïeutique",
        subject: ex.subject || "LOGIC", 
        status: ex.status || "COMPLETED",
        xp_earned: (ex.status === "COMPLETED" || ex.status === "Terminé" || !ex.status) ? 100 : 0
    }));

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
const initDashboardInteractions = (supabaseExercises = []) => {
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
            renderHistoryList(btn.dataset.filter, supabaseExercises);
        };
    });

    renderHistoryList('all', supabaseExercises);
};

/**
 * 3. Fonction principale de rendu
 */
const renderDashboard = (supabaseExercises = [], userProfile = null) => {
    const hash = window.location.hash;
    if (hash !== '#dashboard' && hash !== '') return;

    let container = document.getElementById('dashboard-container');
    if (!container) {
        // Si le conteneur spécifique n'existe pas, on cherche la zone de contenu principale ou le body
        const mainContent = document.querySelector('main') || document.getElementById('app') || document.body;
        container = document.createElement('div');
        container.id = 'dashboard-container';
        container.style.maxWidth = '1200px';
        container.style.margin = '40px auto';
        container.style.padding = '0 20px';
        mainContent.appendChild(container);
    }

    // 1. Extraction blindée : Somme de l'XP de TOUS les exercices
    const totalXpFromExercises = supabaseExercises.reduce((sum, ex) => {
        const isCompleted = ex.status === 'COMPLETED' || ex.status === 'Terminé';
        if (isCompleted) {
            const earned = Number(ex.xp_earned || ex.xp_awarded || 100);
            return sum + earned;
        }
        return sum;
    }, 0);

    // Valeur de XP finale : Priorité Profil Supabase (si > 0), sinon cumul dynamique des exercices
    const finalXp = (userProfile && Number(userProfile.xp) > 0)
        ? Number(userProfile.xp)
        : totalXpFromExercises;

    // 2. Calcul local fiable
    const xpPerLevel = 500;
    const displayLevel = Math.floor(finalXp / xpPerLevel) + 1;
    const currentLevelXp = finalXp % xpPerLevel;
    const progressPercent = (currentLevelXp / xpPerLevel) * 100;

    // 3. Récupération Streak & Badges
    const streak = (userProfile && userProfile.streak_days !== undefined)
        ? Number(userProfile.streak_days)
        : (parseInt(localStorage.getItem('maieutik_streak')) || 1); // Fallback à 1 jour par défaut

    const badgesCount = (userProfile && userProfile.badges_count !== undefined)
        ? Number(userProfile.badges_count)
        : (JSON.parse(localStorage.getItem('maieutik_badges')) || ['🎓']).length; // Fallback local

    console.log(`[Maieutik-Gamification] XP Total: ${finalXp}, Level: ${displayLevel}, Progress: ${progressPercent}%`);

    // 4. Injection du code HTML épuré (Sans doublons)
    container.innerHTML = `
        <!-- BLOC 1 : GAMIFICATION -->
        <div style="background: white; border: 1px solid #e2e8f0; padding: 24px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
            <div>
                <h2 style="color: #6366f1; font-size: 12px; font-weight: 900; text-transform: uppercase; margin: 0;">Apprenti Socratique</h2>
                <p style="font-size: 30px; font-weight: 900; margin: 4px 0; color: #0f172a;">Niveau ${displayLevel}</p>
                <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">${currentLevelXp} / ${xpPerLevel} XP (${Math.round(progressPercent)}%)</div>
                <div style="width: 240px; background: #f1f5f9; height: 10px; border-radius: 10px; overflow: hidden; margin-top: 8px;">
                    <div style="background: #6366f1; width: ${progressPercent}%; height: 100%; transition: width 1s ease-out;"></div>
                </div>
            </div>
            <div style="font-size: 32px; width: 56px; height: 56px; background: #e0e7ff; border-radius: 12px; display: flex; align-items: center; justify-content: center;">🎓</div>
        </div>
        
        <div style="display: flex; gap: 16px; margin: 16px 0;">
            <div style="background: white; border: 1px solid #e2e8f0; padding: 16px; border-radius: 16px; flex: 1; display: flex; align-items: center; gap: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                <span>🔥</span> <b style="color: #0f172a;">${streak} Jours</b>
            </div>
            <div style="background: white; border: 1px solid #e2e8f0; padding: 16px; border-radius: 16px; flex: 1; display: flex; align-items: center; gap: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                <span>🏆</span> <b style="color: #0f172a;">${badgesCount} Badges</b>
            </div>
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
    `;

    // 5. Réactivation de la liste d'historique et des filtres (si présents dans le DOM)
    if (document.getElementById('exercises-history-list')) {
        initDashboardInteractions(supabaseExercises);
    }
};

/**
 * 4. Exportation globale (Écouteurs supprimés car orchestrés par main.js)
 */
window.MaieutikGamification = { processAIResponse, renderDashboard, getStats: getUserStats };