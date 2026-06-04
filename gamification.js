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

const SOCRATIC_TITLES = [
    "Sophiste Égaré",     // Level 1
    "Apprenti Socratique", // Level 2
    "Chercheur de Vérité", // Level 3
    "Disciple de l'Académie", // Level 4
    "Maître du Logos",    // Level 5
    "Philosophe Éclairé",  // Level 6
    "Sage de la Cité"      // Level 7+
];

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

/**
 * Vérifie si l'ajout d'XP déclenche un passage de niveau et lance l'animation
 * @param {number} additionalXp - Les XP gagnés à cette étape
 */
const checkAndTriggerLevelUp = (additionalXp) => {
    if (additionalXp <= 0) return;

    const stats = getUserStats();
    
    // 1. Calcul du niveau AVANT l'ajout
    const oldLevel = Math.floor(stats.xp / GAMIFICATION_CONFIG.XP_PER_LEVEL) + 1;
    
    // 2. Mise à jour et sauvegarde
    stats.xp += additionalXp;
    saveUserStats(stats);

    // 3. Calcul du niveau APRÈS l'ajout
    const newLevel = Math.floor(stats.xp / GAMIFICATION_CONFIG.XP_PER_LEVEL) + 1;
    if (newLevel > oldLevel) {
        triggerLevelUpEffects(newLevel);
    }
};

const processAIResponse = (responseText) => {
    const completionRegex = /\{[\s\S]*?"status"\s*:\s*"COMPLETED"[\s\S]*?\}/;
    const match = responseText.match(completionRegex);

    if (match) {
        try {
            const data = JSON.parse(match[0]);
            const stats = getUserStats();

            // Mise à jour des stats (la logique de level up est gérée par checkAndTriggerLevelUp ou ici)
            const oldLevel = Math.floor(stats.xp / GAMIFICATION_CONFIG.XP_PER_LEVEL) + 1;
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

            // Détection du Level Up
            const newLevel = Math.floor(stats.xp / GAMIFICATION_CONFIG.XP_PER_LEVEL) + 1;
            if (newLevel > oldLevel) {
                triggerLevelUpEffects(newLevel);
            }

            return data;
        } catch (error) {
            console.error("[Maieutik-Gamification] Erreur JSON :", error);
        }
    }
    return null;
};

/**
 * Moteur d'effets visuels "Level Up" (Confettis & Banner)
 */
const triggerLevelUpEffects = (newLevel) => {
    const title = SOCRATIC_TITLES[Math.min(newLevel - 1, SOCRATIC_TITLES.length - 1)] || "Sage de la Cité";
    
    // 1. Injection des styles d'animation
    if (!document.getElementById('maieutik-levelup-styles')) {
        const style = document.createElement('style');
        style.id = 'maieutik-levelup-styles';
        style.innerHTML = `
            @keyframes confetti-fall {
                0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
                100% { transform: translate(var(--translateX), 100vh) rotate(var(--rotateEnd)); opacity: 0; }
            }
            @keyframes banner-pop {
                0% { transform: translate(-50%, -40%) scale(0.8); opacity: 0; }
                15% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                85% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                100% { transform: translate(-50%, -60%) scale(0.9); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // 2. Création de la bannière de félicitations
    const banner = document.createElement('div');
    banner.style.cssText = `
        position: fixed; top: 50%; left: 50%; z-index: 10000;
        text-align: center; pointer-events: none; width: 100%;
        font-family: 'Inter', system-ui, sans-serif; animation: banner-pop 3.5s ease-out forwards;
    `;
    banner.innerHTML = `
        <div style="background: white; display: inline-block; padding: 35px 50px; border-radius: 32px; box-shadow: 0 25px 50px -12px rgba(99, 102, 241, 0.35); border: 2px solid #e0e7ff;">
            <div style="font-size: 55px; margin-bottom: 8px;">🏆</div>
            <h2 style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em;">Progression Absolue</h2>
            <p style="margin: 5px 0; color: #4f46e5; font-size: 26px; font-weight: 900;">Niveau Supérieur ${newLevel}</p>
            <p style="margin: 0; color: #64748b; font-size: 15px; font-weight: 500;">Vous êtes maintenant un <b style="color: #0f172a;">${title}</b></p>
        </div>
    `;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 3600);

    // 3. Explosion de confettis (Moteur de particules JS)
    const colors = ['#6366f1', '#818cf8', '#fbbf24', '#f472b6', '#34d399', '#60a5fa'];
    const particleCount = 100;

    for (let i = 0; i < particleCount; i++) {
        const confetti = document.createElement('div');
        const size = Math.random() * 8 + 6 + 'px';
        const color = colors[Math.floor(Math.random() * colors.length)];
        const isCircle = Math.random() > 0.5;

        // Propriétés de trajectoire aléatoires
        const translateX = (Math.random() - 0.5) * 500 + 'px';
        const rotateEnd = (Math.random() * 720 - 360) + 'deg';
        const duration = Math.random() * 1.5 + 2 + 's';
        const delay = Math.random() * 0.2 + 's';

        confetti.style.cssText = `
            position: fixed; top: 50%; left: 50%;
            width: ${size}; height: ${size};
            background-color: ${color};
            border-radius: ${isCircle ? '50%' : '3px'};
            z-index: 9999; pointer-events: none;
            --translateX: ${translateX};
            --rotateEnd: ${rotateEnd};
            animation: confetti-fall ${duration} ${delay} cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        `;

        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 3800);
    }
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
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => {
                b.style.backgroundColor = 'transparent';
                b.style.color = '#64748b';
            });
            btn.style.backgroundColor = '#0f172a';
            btn.style.color = 'white';
            renderHistoryList(btn.dataset.filter, supabaseExercises);
        });
    });

    const newExBtn = document.getElementById('dashboard-new-exercise-btn');
    if (newExBtn) {
        newExBtn.addEventListener('click', () => {
            if (window.router && window.router.newExercise) window.router.newExercise();
            else window.location.hash = '#new-discussion';
        });
    }

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
        // Fallback chirurgical : si ex.status n'existe pas en BDD, on le considère complété d'office
        const isCompleted = !ex.status || ex.status === 'COMPLETED' || ex.status === 'Terminé';
        
        if (isCompleted) {
            // Accepte toutes les variantes de clés possibles, ou donne 100 XP par défaut
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
    const title = SOCRATIC_TITLES[Math.min(displayLevel - 1, SOCRATIC_TITLES.length - 1)];
    let currentLevelXp = finalXp % xpPerLevel;
    let progressPercent = (currentLevelXp / xpPerLevel) * 100;

    // Si l'utilisateur a exactement atteint le niveau (reste = 0) et qu'il a de l'XP
    if (currentLevelXp === 0 && finalXp > 0) {
        progressPercent = 100; // Indique que le niveau précédent a été complété à 100%
    }

    // 3. Récupération Streak & Badges
    const streak = (userProfile && userProfile.streak_days !== undefined)
        ? Number(userProfile.streak_days)
        : (parseInt(localStorage.getItem(GAMIFICATION_CONFIG.STORAGE_KEYS.STREAK)) || 1); // Fallback à 1 jour par défaut

    const badgesCount = (userProfile && userProfile.badges_count !== undefined)
        ? Number(userProfile.badges_count)
        : (JSON.parse(localStorage.getItem(GAMIFICATION_CONFIG.STORAGE_KEYS.BADGES)) || ['🎓']).length; // Fallback local

    console.log(`[Maieutik-Gamification] XP Total: ${finalXp}, Level: ${displayLevel}, Progress: ${progressPercent}%`);

    const xpDisplayText = `${finalXp} XP au total`;

    // 4. Injection du code HTML épuré (Sans doublons)
    container.innerHTML = `
        <style>
            #dashboard-new-exercise-btn:hover { background-color: #4f46e5 !important; transform: translateY(-1px); }
            #dashboard-new-exercise-btn:active { transform: translateY(0); }
            .filter-btn:hover { background-color: #f1f5f9 !important; }
            .filter-btn[style*="background-color: rgb(15, 23, 42)"]:hover { background-color: #1e293b !important; }
            
            .xp-progress-inner {
                transition: width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
        </style>

        <!-- BLOC 1 : GAMIFICATION -->
        <div style="background: white; border: 1px solid #e2e8f0; padding: 24px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
            <div>
                <h2 style="color: #6366f1; font-size: 12px; font-weight: 900; text-transform: uppercase; margin: 0;">${title}</h2>
                <p style="font-size: 30px; font-weight: 900; margin: 4px 0; color: #0f172a;">Niveau ${displayLevel}</p>
                <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">${xpDisplayText} (Niveau ${displayLevel})</div>
                <div style="width: 240px; background: #f1f5f9; height: 10px; border-radius: 10px; overflow: hidden; margin-top: 8px;">
                    <div class="xp-progress-inner" style="background: linear-gradient(90deg, #6366f1, #818cf8); width: ${progressPercent}%; height: 100%;"></div>
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
            <div style="display: flex; align-items: center; gap: 12px;">
                <div id="subjectFilters" style="display: flex; gap: 4px; background: #f8fafc; padding: 4px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <button data-filter="all" class="filter-btn" style="background: #0f172a; color: white; padding: 6px 14px; border-radius: 6px; border: 0; font-size: 12px; font-weight: bold; cursor: pointer;">Tous</button>
                    <button data-filter="MATHEMATICS" class="filter-btn" style="background: transparent; color: #64748b; padding: 6px 14px; border-radius: 6px; border: 0; font-size: 12px; font-weight: bold; cursor: pointer;">Maths</button>
                    <button data-filter="PHILOSOPHY" class="filter-btn" style="background: transparent; color: #64748b; padding: 6px 14px; border-radius: 6px; border: 0; font-size: 12px; font-weight: bold; cursor: pointer;">Philo</button>
                    <button data-filter="LOGIC" class="filter-btn" style="background: transparent; color: #64748b; padding: 6px 14px; border-radius: 6px; border: 0; font-size: 12px; font-weight: bold; cursor: pointer;">Logique</button>
                </div>
                <button id="dashboard-new-exercise-btn" style="background: #6366f1; color: white; padding: 6px 14px; border-radius: 8px; border: 0; font-size: 12px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.2s;">
                    <span>+</span> New Exercise
                </button>
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
window.MaieutikGamification = { processAIResponse, renderDashboard, getStats: getUserStats, checkAndTriggerLevelUp };