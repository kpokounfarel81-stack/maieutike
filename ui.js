/**
 * Utilitaires UI et composants
 */

class UIManager {
    /**
     * Rendre du Markdown en HTML
     */
    static renderMarkdown(markdown) {
        try {
            // Vérification de la présence de Marked
            if (typeof marked === 'undefined') {
                return `<div class="p-4 bg-gray-50 text-gray-700 border border-gray-200 rounded italic">${markdown}</div>`;
            }

            let html = marked.parse(markdown);

            // Sécuriser le HTML rendu (XSS)
            html = DOMPurify.sanitize(html, {
                USE_PROFILES: { html: true }
            });

            // Utilisation d'un wrapper avec la classe 'prose' pour le style
            return `<div class="markdown-content prose max-w-none">${html}</div>`;
        } catch (error) {
            console.error('Erreur render markdown:', error);
            return `<p class="text-red-500">Erreur de rendu: ${error.message}</p>`;
        }
    }

    /**
     * Afficher une notification
     */
    static showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-4 rounded-lg shadow-lg text-white z-50 transition-all duration-300 transform translate-y-0`;
        
        switch(type) {
            case 'success':
                notification.classList.add('bg-green-500');
                break;
            case 'error':
                notification.classList.add('bg-red-500');
                break;
            case 'warning':
                notification.classList.add('bg-yellow-500');
                break;
            default:
                notification.classList.add('bg-blue-500');
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, duration);
    }

    /**
     * Formater une date
     */
    static formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Tronquer un texte
     */
    static truncate(text, length = 100) {
        if (text.length > length) {
            return text.substring(0, length) + '...';
        }
        return text;
    }

    /**
     * Créer une carte d'exercice
     */
    static createExerciseCard(exercise, index = 0) {
        const problemPreview = this.truncate(exercise.problem_statement, 100);
        const date = this.formatDate(exercise.created_at);
        const isFocus = index === 0;

        return `
            <div class="p-6 card-row ${isFocus ? 'card-focus' : ''} flex items-center justify-between gap-6 mb-4">
                <div class="flex-1">
                    <div class="flex items-center gap-3 mb-2">
                        <span class="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase rounded tracking-wider">
                            Mathematics
                        </span>
                        <span class="text-xs text-slate-400">${date}</span>
                    </div>
                    
                    ${isFocus ? `
                        <div class="bubble-frame mb-3 flex gap-4 items-center">
                            <div class="w-10 h-10 flex-shrink-0 bg-white rounded-full border border-slate-200 flex items-center justify-center">
                                <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                            </div>
                            <p class="text-sm font-medium text-slate-700 leading-relaxed">${problemPreview}</p>
                        </div>
                    ` : `
                        <h3 class="text-base font-bold text-slate-900 mb-1">Concept Mastery</h3>
                        <p class="text-sm text-slate-500 line-clamp-1">${problemPreview}</p>
                    `}
                </div>
                
                <div class="flex-shrink-0">
                    <button onclick="router.openExercise('${exercise.id}')" 
                        class="${isFocus ? 'btn-blue' : 'px-5 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition'}">
                        ${isFocus ? 'Start Practice' : 'Review Results'}
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Afficher le loader
     */
    static showLoader(element, message = 'Chargement...') {
        element.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p class="text-gray-600">${message}</p>
            </div>
        `;
    }

    /**
     * Afficher une erreur
     */
    static showError(element, message) {
        element.innerHTML = `
            <div class="p-6 bg-red-50 border border-red-200 rounded-lg">
                <p class="text-red-700 font-semibold mb-2">Erreur</p>
                <p class="text-red-600 text-sm">${message}</p>
            </div>
        `;
    }

    /**
     * Rendu des formules mathématiques avec KaTeX
     * Supporte les délimiteurs standards et les parenthèses simples
     */
    static renderMath(element) {
        const target = element || document.body;
        if (typeof renderMathInElement === 'function') {
            renderMathInElement(target, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '\\[', right: '\\]', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false}
                ],
                throwOnError: false
            });
        }
    }

    /**
     * Alias pour compatibilité avec les anciens appels
     */
    static renderLaTeX(element) {
        this.renderMath(element);
    }
}

// Alias pratique pour le code existant
const ui = UIManager;
