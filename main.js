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

    async deleteExercise(exerciseId) {
        if (!confirm('Voulez-vous vraiment supprimer cet exercice ?')) return;
        try {
            await exerciseManager.deleteExercise(exerciseId);
            UIManager.showNotification('Exercice supprimé', 'success');
            this.setupDashboardPage(); // Rafraîchir le dashboard
        } catch (error) {
            console.error(error);
            UIManager.showNotification('Erreur lors de la suppression', 'error');
        }
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
        const app = document.getElementById('app');
        
        const form = document.getElementById('newExerciseForm');
        const solveBtn = document.getElementById('solveBtn');
        const imageInput = document.getElementById('imageAttachment');
        const scannerPreview = document.getElementById('scannerPreview');
        let scannerImage = null;

        imageInput?.addEventListener('change', () => {
            const file = imageInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    scannerImage = { name: file.name, type: file.type, size: file.size, dataUrl: e.target.result };
                    scannerPreview.innerHTML = `
                        <div class="relative group inline-block">
                            <img src="${e.target.result}" class="w-24 h-24 object-cover rounded-xl border-2 border-indigo-50 shadow-sm">
                            <button type="button" id="removeScannerImage" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                    `;
                    scannerPreview.classList.remove('hidden');
                    document.getElementById('removeScannerImage').onclick = () => {
                        scannerImage = null;
                        scannerPreview.classList.add('hidden');
                        imageInput.value = '';
                    };
                };
                reader.readAsDataURL(file);
            }
        });

        const micBtn = document.getElementById('micBtn');
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            if (micBtn) micBtn.style.display = 'none';
        } else {
            const recognition = new SpeechRecognition();
            recognition.lang = 'fr-FR';
            let isRecognizing = false;

            micBtn.addEventListener('click', () => {
                if (isRecognizing) recognition.stop();
                else recognition.start();
            });

            recognition.onstart = () => {
                isRecognizing = true;
                micBtn.classList.add('bg-red-500', 'text-white');
                micBtn.classList.remove('bg-slate-100', 'text-slate-600');
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                const input = document.getElementById('exerciseInput');
                if (input) input.value += (input.value ? ' ' : '') + transcript;
            };

            recognition.onend = () => {
                isRecognizing = false;
                micBtn.classList.remove('bg-red-500', 'text-white');
                micBtn.classList.add('bg-slate-100', 'text-slate-600');
            };

            recognition.onerror = (e) => {
                isRecognizing = false;
                console.warn("STT Error:", e.error);
                if (e.error === 'not-allowed') UIManager.showNotification("Accès micro refusé", "error");
            };
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            exerciseManager.currentExercise = {
                problem_statement: document.getElementById('exerciseInput').value.trim(),
                mode: document.getElementById('ai-mode').value,
                attachments: scannerImage ? [scannerImage] : [],
                isNew: true,
                autoStart: true // Flag pour lancer l'IA automatiquement au chargement de la page suivante
            };

            this.navigate('exercise');
            UIManager.showNotification('Initialisation de l\'analyse...', 'info');
        });
    }

    async setupDashboardPage() {
        const app = document.getElementById('app');
        await exerciseManager.loadUserExercises();
        const exercises = exerciseManager.getExercises() || [];
        console.log('Exercices récupérés depuis ExerciseManager:', exercises);

        // Calcul des stats
        const exerciseCount = exercises.length;
        const modes = exercises.map(ex => ex.mode);
        const preferredMode = modes.length > 0 
            ? modes.sort((a,b) => modes.filter(v => v===a).length - modes.filter(v => v===b).length).pop()
            : 'N/A';
        const modeLabels = { guide: 'Maïeutique', solve: 'Résolution', hint: 'Indice', explain: 'Explication', 'N/A': 'Aucun' };

        const statsGrid = document.getElementById('statsGrid');
        const cardsContainer = document.getElementById('dashboardCardsContainer');

        // Injection des stats
        statsGrid.innerHTML = `
            <div class="bg-gray-50 border border-gray-200 p-6 rounded-2xl">
                <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Mode Préféré</p>
                <p class="text-2xl font-bold text-[#111827]">${modeLabels[preferredMode]}</p>
            </div>
            <div class="bg-gray-50 border border-gray-200 p-6 rounded-2xl">
                <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Exercices Complétés</p>
                <p class="text-2xl font-bold text-[#111827]">${exerciseCount}</p>
            </div>
            <div class="bg-gray-50 border border-gray-200 p-6 rounded-2xl">
                <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Série de Jours</p>
                <p class="text-2xl font-bold text-[#111827]">12 jours</p>
            </div>
        `;

        this.renderExerciseGrid(exercises);

        // Setup des filtres
        const filterButtons = document.querySelectorAll('#subjectFilters button');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                filterButtons.forEach(b => {
                    b.classList.remove('bg-gray-900', 'text-white');
                    b.classList.add('bg-gray-100', 'text-gray-600');
                });
                btn.classList.add('bg-gray-900', 'text-white');
                btn.classList.remove('bg-gray-100', 'text-gray-600');

                const filtered = filter === 'all' 
                    ? exercises 
                    : exercises.filter(ex => {
                        const text = ex.problem_statement || ex.problemStatement || "";
                        const matiere = typeof ui !== 'undefined' && ui.detecterMatiere 
                            ? ui.detecterMatiere(text) 
                            : UIManager.detecterMatiere(text);
                        return matiere.nom === filter;
                      });
                
                this.renderExerciseGrid(filtered);
            });
        });
    }

    renderExerciseGrid(exercises) {
        const cardsContainer = document.getElementById('dashboardCardsContainer');
        if (!cardsContainer) {
            console.error("Conteneur #dashboardCardsContainer introuvable dans le DOM.");
            return;
        }

        try {
            if (!exercises || exercises.length === 0) {
                cardsContainer.className = "col-span-full";
                cardsContainer.innerHTML = `
                    <div class="p-12 bg-white rounded-2xl border border-dashed border-gray-200 text-center w-full my-4">
                        <p class="text-slate-500 mb-6">Votre journal d'apprentissage est encore vide.</p>
                        <button onclick="router.newExercise()" class="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:shadow-lg transition-all">Initialiser ma première discussion</button>
                    </div>
                `;
            } else {
                // S'assurer que la classe grid est bien présente si on revient d'un état vide
                cardsContainer.className = "grid grid-cols-1 md:grid-cols-3 gap-6 mt-6";
                cardsContainer.innerHTML = exercises.map((ex, i) => ui.createExerciseCard(ex, i)).join('');
                UIManager.renderMath(cardsContainer);
            }
        } catch (error) {
            console.error("Erreur lors de l'injection des cartes d'exercices:", error);
            cardsContainer.innerHTML = `<div class="col-span-full p-4 bg-red-50 text-red-600 rounded-lg">Erreur d'affichage : ${error.message}</div>`;
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

        // Lancement automatique si on vient de la page "new-discussion"
        if (exerciseManager.currentExercise?.autoStart) {
            delete exerciseManager.currentExercise.autoStart;
            setTimeout(() => form.dispatchEvent(new Event('submit')), 100);
        }

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
            const mode = document.getElementById('ai-mode').value;
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
                const attachments = files.length > 0 
                    ? await this.readAttachments(files) 
                    : (exerciseManager.currentExercise?.attachments || []);

                await exerciseManager.solveProblemStream(
                    problemStatement || this.describeAttachments(files),
                    (reasoning, fromCache) => {
                        if (fromCache) cacheNotice.classList.remove('hidden');
                        reasoningContent.innerHTML = UIManager.renderMarkdown(reasoning || 'Demarche indisponible');
                        if (window.MaieutikTextEngine) MaieutikTextEngine.process(reasoningContent);
                        reasoningContent.scrollTop = reasoningContent.scrollHeight;
                    },
                    (solution, fromCache) => {
                        if (fromCache) cacheNotice.classList.remove('hidden');
                        solutionContent.innerHTML = UIManager.renderMarkdown(solution || 'Solution indisponible');
                        if (window.MaieutikTextEngine) MaieutikTextEngine.process(solutionContent);
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
        const mode = document.getElementById('ai-mode');
        const attempt = document.getElementById('attemptInput');
        const reasoningSection = document.getElementById('reasoningSection');
        const solutionSection = document.getElementById('solutionSection');
        const reasoningContent = document.getElementById('reasoningContent');
        const solutionContent = document.getElementById('solutionContent');

        if (input) input.value = exercise.problem_statement || '';
        if (mode) mode.value = exercise.mode || 'solve';
        if (attempt) attempt.value = exercise.attempt || '';
        
        reasoningSection.classList.remove('hidden');
        solutionSection.classList.remove('hidden');
        reasoningContent.innerHTML = UIManager.renderMarkdown(exercise.reasoning_content || 'Demarche indisponible');
        solutionContent.innerHTML = UIManager.renderMarkdown(exercise.solution_content || 'Solution indisponible');
        if (window.MaieutikTextEngine) {
            MaieutikTextEngine.process(reasoningContent);
            MaieutikTextEngine.process(solutionContent);
        }
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
