/**
 * Maieutik Academic History Module - Minimalist Refactoring
 */

const STORAGE_KEY = 'maieutik_history';

const MaieutikHistory = {
    /**
     * Intercepte le statut de l'exercice et met à jour l'historique local.
     */
    updateHistory: (exerciseData) => {
        if (!exerciseData || !exerciseData.status) return;

        try {
            let history = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
            
            const newEntry = {
                id: Date.now(),
                title: exerciseData.title || "Session d'apprentissage",
                subject: exerciseData.subject || "LOGIC",
                status: exerciseData.status,
                timestamp: new Date().toLocaleString('fr-FR')
            };

            // On garde les 100 derniers exercices
            history.unshift(newEntry);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 100)));
        } catch (e) {
            console.error("[History] Erreur sauvegarde :", e);
        }
    },

    /**
     * Rendu minimaliste de la liste d'exercices.
     */
    renderHistoryList: (filter = 'all', supabaseExercises = []) => {
        const historyList = document.getElementById('exercises-history-list');
        if (!historyList) return;

        // Unifier les sources (locale + BDD)
        const localHistory = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        const combined = [...localHistory, ...supabaseExercises.map(ex => ({
            title: ex.problem_statement || "Exercice Maïeutique",
            subject: ex.subject || "MATHS",
            status: ex.status || "COMPLETED",
            timestamp: new Date(ex.created_at).toLocaleString('fr-FR')
        }))];

        const filtered = filter === 'all' ? combined : combined.filter(ex => ex.subject === filter);

        if (filtered.length === 0) {
            historyList.innerHTML = `<p style="padding: 24px; color: #94a3b8; font-size: 13px; text-align: center;">Aucune activité enregistrée.</p>`;
            return;
        }

        historyList.innerHTML = filtered.map(ex => `
            <div style="background: white; border: 1px solid #f1f5f9; padding: 14px 20px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; transition: all 0.2s ease;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <h4 style="font-size: 14px; font-weight: 600; color: #1e293b; margin: 0;">${UIManager.truncate(ex.title, 50)}</h4>
                    <span style="font-size: 11px; color: #94a3b8;">${ex.timestamp} • ${ex.subject}</span>
                </div>
                <span style="font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.02em; ${
                    ex.status === 'COMPLETED' ? 'background: #f0fdf4; color: #16a34a;' : 'background: #f0f9ff; color: #0284c7;'
                }">
                    ${ex.status === 'COMPLETED' ? 'Terminé' : 'En cours'}
                </span>
            </div>
        `).join('');
    },

    /**
     * Initialisation du dashboard épuré.
     */
    renderDashboard: (supabaseExercises = []) => {
        const app = document.getElementById('app');
        if (!app) return;

        app.innerHTML = `
            <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px;">
                    <h2 style="font-size: 24px; font-weight: 700; color: #0f172a; margin: 0;">Parcours Académique</h2>
                    <button onclick="router.newExercise()" style="background: #0f172a; color: white; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; border: none;">
                        Nouvelle Session
                    </button>
                </div>

                <div style="display: flex; gap: 8px; margin-bottom: 24px;">
                    ${['all', 'MATHS', 'PHILOSOPHY', 'LOGIC'].map(f => `
                        <button class="filter-btn" data-filter="${f}" style="background: ${f === 'all' ? '#f1f5f9' : 'transparent'}; border: 1px solid #e2e8f0; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; color: #64748b;">
                            ${f === 'all' ? 'Tous' : f}
                        </button>
                    `).join('')}
                </div>

                <div id="exercises-history-list"></div>
            </div>
        `;

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.filter-btn').forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = '#64748b';
                });
                btn.style.background = '#f1f5f9';
                btn.style.color = '#0f172a';
                MaieutikHistory.renderHistoryList(btn.dataset.filter, supabaseExercises);
            };
        });

        MaieutikHistory.renderHistoryList('all', supabaseExercises);
    }
};

// Compatibilité globale
window.MaieutikGamification = MaieutikHistory;