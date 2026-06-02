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
            if (typeof renderHistoryList === 'function') {
                renderHistoryList(btn.dataset.filter);
            }
        };
    });
    if (typeof renderHistoryList === 'function') {
        renderHistoryList('all');
    }
};

/**
 * Maieutik Gamification Module - Partie 2
 */
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

const renderHistoryList = (filter = 'all') => {
    const historyList = document.getElementById('exercises-history-list');
    if (!historyList) return;

    const historyRaw = localStorage.getItem(GAMIFICATION_CONFIG.STORAGE_KEYS.HISTORY);
    let history = historyRaw ? JSON.parse(historyRaw) : [];

    const filtered = filter === 'all' ? history : history.filter(ex => ex.subject === filter);

    if (filtered.length === 0) {
        historyList.innerHTML = `<p style="font-size: 12px; color: #94a3b8; font-style: italic; padding: 16px 0;">Aucun exercice trouvé.</p>`;
        return;
    }

    historyList.innerHTML = filtered.map(ex => `
        <div style="background-color: white; padding: 16px; border-radius: 12px; border: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 16px;">
                <span style="padding: 4px 8px; border-radius: 4px; font-size: 9px; font-weight: 900; ${
                    ex.status === 'COMPLETED' ? 'background-color: #ecfdf5; color: #059669;' : 'background-color: #fffbeb; color: #d97706;'
                }">${ex.status}</span>
                <div>
                    <h4 style="font-size: 14px; font-weight: bold; margin: 0;">${ex.title}</h4>
                    <p style="font-size: 10px; color: #94a3b8; margin: 0; text-transform: uppercase;">${ex.subject}</p>
                </div>
            </div>
            <div style="font-size: 14px; font-weight: 900; color: #4f46e5;">+ ${ex.xp_earned} XP</div>
        </div>
    `).join('');
};

const renderDashboard = () => {
    if (window.location.hash !== '' && window.location.hash !== '#dashboard') return;

    const appContainer = document.getElementById('app') || document.querySelector('main');
    if (!appContainer) return;

    let container = document.getElementById('dashboard-content');
    if (!container) {
        const template = document.getElementById('dashboardPage');
        if (template) {
            appContainer.innerHTML = template.innerHTML;
            container = document.getElementById('dashboard-content');
        }
    }

    if (!container) return;

    const stats = getUserStats();
    const { level, currentLevelXp, progressPercent } = getLevelData(stats.xp);

    container.innerHTML = `
        <div style="font-family: sans-serif; padding: 12px;">
            <div style="background: white; border: 1px solid #e2e8f0; padding: 24px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; mb-6;">
                <div>
                    <h2 style="color: #6366f1; font-size: 12px; font-weight: 900; text-transform: uppercase; margin: 0;">Apprenti Socratique</h2>
                    <p style="font-size: 30px; font-weight: 900; margin: 4px 0;">Niveau ${level}</p>
                    <div style="width: 240px; background: #f1f5f9; height: 10px; border-radius: 10px; overflow: hidden;"><div style="background: #6366f1; width: ${progressPercent}%; height: 100%;"></div></div>
                </div>
                <div style="font-size: 32px;">🎓</div>
            </div>
            <div style="display: flex; gap: 16px; margin: 16px 0;">
                <div style="background: white; border: 1px solid #e2e8f0; padding: 16px; border-radius: 16px; flex: 1; display: flex; gap: 12px;"><span>🔥</span> <b>${stats.streak} Jours</b></div>
                <div style="background: white; border: 1px solid #e2e8f0; padding: 16px; border-radius: 16px; flex: 1; display: flex; gap: 12px;"><span>🏆</span> <b>${stats.badges.length} Badges</b></div>
            </div>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="font-size: 18px; font-weight: 900; margin: 0;">Historique des exercices</h3>
                <div id="subjectFilters" style="display: flex; gap: 4px; background: #f8fafc; padding: 4px; border-radius: 8px;">
                    <button data-filter="all" class="filter-btn" style="background: #0f172a; color: white; padding: 4px 12px; border-radius: 6px; border: 0; font-size: 12px; font-weight: bold;">Tous</button>
                    <button data-filter="MATHEMATICS" class="filter-btn" style="background: transparent; color: #64748b; padding: 4px 12px; border-radius: 6px; border: 0; font-size: 12px; font-weight: bold;">Maths</button>
                    <button data-filter="PHILOSOPHY" class="filter-btn" style="background: transparent; color: #64748b; padding: 4px 12px; border-radius: 6px; border: 0; font-size: 12px; font-weight: bold;">Philo</button>
                    <button data-filter="LOGIC" class="filter-btn" style="background: transparent; color: #64748b; padding: 4px 12px; border-radius: 6px; border: 0; font-size: 12px; font-weight: bold;">Logique</button>
                </div>
            </div>
            <div id="exercises-history-list"></div>
        </div>
    `;

    initDashboardInteractions();
};

window.addEventListener('hashchange', renderDashboard);
window.addEventListener('DOMContentLoaded', renderDashboard);
window.MaieutikGamification = { processAIResponse, renderDashboard, getStats: getUserStats };