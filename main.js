/**
 * Routeur et orchestration de l'application
 */

class Router {
    constructor() {
        this.currentPage = null;
        this.routes = {
            home: 'homePage',
            login: 'loginPage',
            signup: 'signupPage',
            dashboard: 'dashboardPage',
            exercise: 'exercisePage',
            profile: 'profilePage',
            'new-discussion': 'newDiscussionPage'
        };
        this.init();
    }

    init() {
        window.addEventListener('hashchange', () => this.handleNavigation());
        this.handleNavigation();
    }

    navigate(page) {
        window.location.hash = page;
    }

    async openExercise(exerciseId) {
        const exercise = await exerciseManager.loadExercise(exerciseId);
        if (!exercise) {
            UIManager.showNotification('Exercice introuvable', 'error');
            return;
        }
        this.navigate('exercise');
    }

    newExercise() {
        exerciseManager.clearCurrentExercise();
        this.navigate('new-discussion');
    }

    async handleNavigation() {
        try {
            const page = window.location.hash.slice(1) || 'home';
            const authManager = window.authManager;
            
            if (!authManager) {
                console.error("Erreur critique : authManager n'est pas défini. Vérifiez le chargement de js/auth.js");
                this.hideLoader();
                return;
            }

            // S'assurer que la session est chargée depuis Supabase
            await authManager.ensureInitialized();

            if (['dashboard', 'exercise', 'profile', 'new-discussion'].includes(page) && !authManager.isAuthenticated()) {
                UIManager.showNotification('Veuillez vous connecter', 'warning');
                this.navigate('login');
                return;
            }

            if (['login', 'signup'].includes(page) && authManager.isAuthenticated()) {
                this.navigate('dashboard');
                return;
            }

            await this.loadPage(page);
            this.updateNavbar();
        } catch (error) {
            console.error("Erreur lors de la navigation :", error);
            this.hideLoader();
        }
    }

    updateNavbar() {
        const nav = document.getElementById('nav-user');
        const tabs = document.getElementById('nav-tabs');
        const authNav = document.getElementById('nav-auth');
        
        if (authManager.isAuthenticated()) {
            const userEmail = authManager.user?.email || 'Utilisateur';
            // Injection de la zone utilisateur avec le bouton "Create New Exercise"
            nav.innerHTML = `
                <div class="flex items-center gap-4">
                    <span class="text-sm font-semibold text-slate-700">${userEmail}</span>
                    <button onclick="router.newExercise()" class="px-4 py-2 bg-[#0f172a] text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition">
                        Create New Exercise
                    </button>
                    <button onclick="authManager.logout()" class="text-sm text-red-500 hover:text-red-700 font-medium">Quitter</button>
                </div>
            `;
            nav.classList.remove('hidden');
            nav.classList.add('flex');
            if (tabs) tabs.classList.remove('hidden');
            if (authNav) authNav.classList.add('hidden');
        } else {
            nav.classList.add('hidden');
            nav.classList.remove('flex');
            if (tabs) tabs.classList.add('hidden');
            if (authNav) authNav.classList.remove('hidden');
        }
    }

    async loadPage(page) {
        const templateId = this.routes[page] || 'homePage';
        const template = document.getElementById(templateId);
        if (!template) return;

        const app = document.getElementById('app');
        this.hideLoader();

        app.innerHTML = '';
        app.appendChild(template.content.cloneNode(true));
        this.currentPage = page;

        switch (page) {
            case 'login':
                this.setupLoginPage();
                break;
            case 'signup':
                this.setupSignupPage();
                break;
            case 'dashboard':
                await this.setupDashboardPage();
                break;
            case 'new-discussion':
                this.setupNewDiscussionPage();
                break;
            case 'exercise':
                this.setupExercisePage();
                break;
            case 'profile':
                await this.setupProfilePage();
                break;
        }
    }

    hideLoader() {
        const loader = document.getElementById('loadingApp');
        if (loader) loader.style.display = 'none';
    }

    setupLoginPage() {
        const form = document.getElementById('loginForm');
        const errorDiv = document.getElementById('loginError');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorDiv.classList.add('hidden');

            const auth = window.authManager;
            if (!auth) {
                errorDiv.textContent = 'AuthManager indisponible.';
                errorDiv.classList.remove('hidden');
                return;
            }

            const emailEl = document.getElementById('loginEmail');
            const passEl = document.getElementById('loginPassword');

            if (!emailEl || !passEl) {
                errorDiv.textContent = 'Erreur technique: champs introuvables.';
                errorDiv.classList.remove('hidden');
                return;
            }

            const result = await auth.login(
                emailEl.value,
                passEl.value
            );

            if (result.success) {
                UIManager.showNotification('Connexion réussie !', 'success');
                this.navigate('dashboard');
            } else {
                errorDiv.textContent = result.error;
                errorDiv.classList.remove('hidden');
            }
        });
    }

    setupSignupPage() {
        const form = document.getElementById('signupForm');
        const errorDiv = document.getElementById('signupError');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('signupUsername').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;

            if (password.length < 6) {
                errorDiv.textContent = 'Le mot de passe doit contenir au moins 6 caracteres';
                errorDiv.classList.remove('hidden');
                return;
            }

            errorDiv.classList.add('hidden');
            const result = await authManager.signup(email, password, username);

            if (result.success) {
                UIManager.showNotification('Inscription réussie !', 'success');
                this.navigate('dashboard');
            } else {
                errorDiv.textContent = result.error;
                errorDiv.classList.remove('hidden');
            }
        });
    }

    setupNewDiscussionPage() {
        const form = document.getElementById('newDiscussionForm');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const subject = document.getElementById('discussionSubject').value;
            const question = document.getElementById('initialQuestion').value;
            const mode = document.getElementById('discussionMode').value;

            // On prépare l'état de l'exercice pour la page de discussion
            exerciseManager.currentExercise = {
                problem_statement: `${subject}\n\nQuestion de l'étudiant : ${question}`,
                mode: mode,
                isNew: true
            };

            // Navigation vers la page d'exercice (qui appellera populateCurrentExercise)
            this.navigate('exercise');
            
            // Petit feedback visuel
            UIManager.showNotification('Initialisation du dialogue...', 'info');
        });
    }

    async setupDashboardPage() {
        const app = document.getElementById('app');
        
        // 0. Récupération des données en amont
        await exerciseManager.loadUserExercises();
        const profile = await authManager.loadProfile();
        const exercises = exerciseManager.getExercises();

        const initials = (profile?.full_name || 'S').charAt(0).toUpperCase();
        const name = profile?.full_name || 'Student';
        const exerciseCount = exercises.length;

        // 1. Injection de la structure fixe (Squelette Grid + Sidebar)
        // On injecte cela une seule fois pour établir le layout global
        app.innerHTML = `
            <div class="max-w-7xl mx-auto pt-4 px-0 pb-12">
                <h1 class="text-2xl font-bold text-slate-900 mb-8 font-serif">Dashboard : Votre pratique guidée par l'IA</h1>
                <div class="dashboard-grid">
                    <!-- Colonne Gauche : Reçoit les exercices -->
                    <div id="dashboardCardsContainer" class="flex flex-col gap-6"></div>
                    
                    <!-- Colonne Droite : Le volet de statistiques fixe -->
                    <aside class="sidebar-panel">
                        <div class="flex flex-col items-center text-center mb-6">
                            <div class="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full mb-3 flex items-center justify-center text-xl font-bold">${initials}</div>
                            <h3 class="font-bold text-slate-800">${name}</h3>
                            <span class="text-xs text-slate-400">Licence Étudiant Maieutik</span>
                        </div>
                        <div class="border-t border-slate-100 pt-4 mb-6">
                            <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Statistiques d'apprentissage</h4>
                            <div class="grid grid-cols-3 gap-2 text-center">
                                <div class="bg-slate-50 p-2 rounded-lg"><strong>${exerciseCount}</strong><p class="text-[10px] text-slate-400 uppercase">Sujets</p></div>
                                <div class="bg-slate-50 p-2 rounded-lg"><strong>${exerciseCount > 0 ? 1 : 0}</strong><p class="text-[10px] text-slate-400 uppercase">Actifs</p></div>
                                <div class="bg-slate-50 p-2 rounded-lg"><strong class="text-indigo-600">94%</strong><p class="text-[10px] text-slate-400 uppercase">Logique</p></div>
                            </div>
                        </div>
                        <div class="border-t border-slate-100 pt-4">
                            <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Progression Cognitive</h4>
                            <div style="height: 60px; display: flex; align-items: flex-end; gap: 4px; padding-bottom: 5px;">
                                <svg viewBox="0 0 100 30" style="width: 100%; height: auto;"><path d="M0,25 Q25,5 50,20 T100,5" fill="none" stroke="#4f46e5" stroke-width="2"/></svg>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        `;

        // 2. Injection des cartes dynamiques dans le conteneur dédié
        const cardsContainer = document.getElementById('dashboardCardsContainer');
        
        if (exercises.length === 0) {
            cardsContainer.innerHTML = `
                <div class="p-12 bg-white rounded-2xl border border-dashed border-slate-200 text-center">
                    <p class="text-slate-500 mb-6">Votre journal d'apprentissage est encore vide.</p>
                    <button onclick="router.newExercise()" class="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:shadow-lg transition-all">Initialiser ma première discussion</button>
                </div>
            `;
        } else {
            // Boucle sur les exercices et injection chirurgicale
            cardsContainer.innerHTML = exercises.map((ex, i) => ui.createExerciseCard(ex, i)).join('');
            
            // 3. Activation de KaTeX sur le conteneur de cartes uniquement
            // Cela transforme les formules mathématiques en rendu scientifique parfait
            UIManager.renderMath(cardsContainer);
        }
    }

    setupExercisePage() {
        const form = document.getElementById('exerciseForm');
        const solveBtn = document.getElementById('solveBtn');
        const errorDiv = document.getElementById('exerciseError');
        const cacheNotice = document.getElementById('cacheNotice');
        const reasoningSection = document.getElementById('reasoningSection');
        const solutionSection = document.getElementById('solutionSection');
        const reasoningContent = document.getElementById('reasoningContent');
        const solutionContent = document.getElementById('solutionContent');
        const fileInput = document.getElementById('exerciseFiles');
        const fileList = document.getElementById('fileList');

        this.populateCurrentExercise();

        fileInput.addEventListener('change', () => {
            const files = Array.from(fileInput.files || []);
            fileList.textContent = files.length
                ? files.map(file => `${file.name} (${Math.ceil(file.size / 1024)} Ko)`).join(' | ')
                : '';
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const problemStatement = document.getElementById('exerciseInput').value.trim();
            const attempt = document.getElementById('attemptInput').value.trim();
            const mode = document.getElementById('aiMode').value;
            const files = Array.from(fileInput.files || []);

            if (!problemStatement && files.length === 0) {
                errorDiv.textContent = 'Ajoutez un enonce, une image ou un PDF.';
                errorDiv.classList.remove('hidden');
                return;
            }

            solveBtn.disabled = true;
            errorDiv.classList.add('hidden');
            cacheNotice.classList.add('hidden');
            reasoningSection.classList.remove('hidden');
            solutionSection.classList.remove('hidden');
            reasoningContent.innerHTML = this.loaderMarkup('Preparation de la demarche...');
            solutionContent.innerHTML = this.loaderMarkup('Generation de la reponse...');

            try {
                const attachments = await this.readAttachments(files);

                await exerciseManager.solveProblemStream(
                    problemStatement || this.describeAttachments(files),
                    (reasoning, fromCache) => {
                        if (fromCache) cacheNotice.classList.remove('hidden');
                        reasoningContent.innerHTML = UIManager.renderMarkdown(reasoning || 'Demarche indisponible');
                        UIManager.renderMath(reasoningContent);
                        reasoningContent.scrollTop = reasoningContent.scrollHeight;
                    },
                    (solution, fromCache) => {
                        if (fromCache) cacheNotice.classList.remove('hidden');
                        solutionContent.innerHTML = UIManager.renderMarkdown(solution || 'Solution indisponible');
                        UIManager.renderMath(solutionContent);
                        solutionContent.scrollTop = solutionContent.scrollHeight;
                    },
                    { mode, attempt, attachments }
                );

                UIManager.showNotification('Reponse IA prete!', 'success');
                exerciseManager.clearCurrentExercise();
            } catch (error) {
                console.error("Détail de l'erreur IA:", error);
                errorDiv.textContent = error.message || (typeof error === 'string' ? error : "Une erreur inconnue est survenue");
                errorDiv.classList.remove('hidden');
                reasoningContent.innerHTML = '<p class="text-red-600">Erreur lors de la demarche</p>';
                solutionContent.innerHTML = '<p class="text-red-600">Erreur lors de la reponse IA</p>';
            } finally {
                solveBtn.disabled = false;
            }
        });
    }

    populateCurrentExercise() {
        const exercise = exerciseManager.currentExercise;
        if (!exercise) return;

        const input = document.getElementById('exerciseInput');
        const reasoningSection = document.getElementById('reasoningSection');
        const solutionSection = document.getElementById('solutionSection');
        const reasoningContent = document.getElementById('reasoningContent');
        const solutionContent = document.getElementById('solutionContent');

        input.value = exercise.problem_statement || '';
        reasoningSection.classList.remove('hidden');
        solutionSection.classList.remove('hidden');
        reasoningContent.innerHTML = UIManager.renderMarkdown(exercise.reasoning_content || 'Demarche indisponible');
        solutionContent.innerHTML = UIManager.renderMarkdown(exercise.solution_content || 'Solution indisponible');
        UIManager.renderMath(reasoningContent);
        UIManager.renderMath(solutionContent);
    }

    async readAttachments(files) {
        const validFiles = files.slice(0, 3).filter(file =>
            file.type.startsWith('image/') || file.type === 'application/pdf'
        );

        return Promise.all(validFiles.map(file => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({
                name: file.name,
                type: file.type,
                size: file.size,
                dataUrl: reader.result
            });
            reader.onerror = () => reject(new Error(`Lecture impossible: ${file.name}`));
            reader.readAsDataURL(file);
        })));
    }

    describeAttachments(files) {
        return `Piece jointe: ${files.map(file => file.name).join(', ')}`;
    }

    loaderMarkup(message) {
        return `
            <div class="flex flex-col justify-center items-center h-32 gap-3">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p class="text-sm text-gray-600">${message}</p>
            </div>
        `;
    }

    async setupProfilePage() {
        const profile = await authManager.loadProfile();
        const user = authManager.user;

        document.getElementById('profileName').value = profile?.full_name || user?.email || 'Non defini';
        document.getElementById('profileEmail').value = user?.email || '';
        document.getElementById('exerciseCount').textContent = exerciseManager.getExerciseCount();

        if (profile?.created_at) {
            document.getElementById('joinDate').textContent = ui.formatDate(profile.created_at);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.router = new Router();
    console.log('Application Maieutik initialisee');
});
