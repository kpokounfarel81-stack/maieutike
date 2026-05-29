/**
 * Client IA Maieutik.
 * Les appels passent par server.js pour garder la cle API hors du navigateur.
 */

const AI_MODES = {
    solve: 'Resolution complete',
    hint: 'Indice progressif',
    guide: 'Questions guidees',
    review: 'Corriger ma tentative',
    explain: 'Expliquer autrement'
};

class DeepSeekAPI {
    constructor() {
        this.endpoint = window.__ENV__?.AI_PROXY_URL || 'https://api.deepseek.com/v1/chat/completions';
        this.cachePrefix = 'maieutik_ai_cache_';
    }

    async solveProblem(problemStatement, options = {}) {
        let reasoning = '';
        let solution = '';

        await this.solveProblemStream(
            problemStatement,
            (nextReasoning) => {
                reasoning = nextReasoning;
            },
            (nextSolution) => {
                solution = nextSolution;
            },
            options
        );

        return { reasoning, solution };
    }

    async solveProblemStream(problemStatement, onReasoning, onSolution, options = {}) {
        // Sécurisation du chargement : Vérification immédiate de la clé
        const apiKey = (window.__ENV__?.DEEPSEEK_API_KEY || "").trim();
        if (!apiKey) {
            const errorMsg = 'Erreur : Clé OpenRouter manquante dans env.js. Veuillez la configurer.';
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        const isDirectCall = this.endpoint.includes('deepseek.com') || this.endpoint.includes('openrouter.ai');

        const requestPayload = {
            problemStatement: problemStatement || '',
            mode: options.mode || 'solve',
            attempt: options.attempt || '',
            attachments: options.attachments || []
        };

        const cacheKey = await this.getCacheKey(requestPayload);
        const cached = this.getCachedResult(cacheKey);
        if (cached) {
            if (onReasoning) onReasoning(cached.reasoning, true);
            if (onSolution) onSolution(cached.solution, true);
            return cached;
        }

        const headers = { 
            'Content-Type': 'application/json'
        };
        
        // Si appel direct (GitHub Pages), on injecte la clé depuis l'env
        if (isDirectCall) {
            headers['Authorization'] = `Bearer ${apiKey}`;
            
            // En-têtes requis par OpenRouter pour le déploiement navigateur
            if (this.endpoint.includes('openrouter.ai')) {
                headers['HTTP-Referer'] = window.location.href;
                headers['X-Title'] = window.__ENV__?.APP_NAME || 'Maieutik';
            }
        }

        const body = isDirectCall 
            ? JSON.stringify(this.buildDirectPayload(requestPayload))
            : JSON.stringify(requestPayload);

        console.log(`[IA] Appel vers ${this.endpoint} avec le modèle ${window.__ENV__?.DEEPSEEK_MODEL}`);

        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: headers,
            body: body
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = (errorData.error && typeof errorData.error === 'object')
                ? (errorData.error.message || JSON.stringify(errorData.error))
                : (errorData.error || 'Erreur API IA');
            throw new Error(errorMessage);
        }

        const result = await this.readEventStream(response, onReasoning, onSolution);
        this.setCachedResult(cacheKey, result);
        return result;
    }

    /**
     * SSE parsing robuste.
     * Le serveur envoie :
     *   event: reasoning\n data: {...}\n\n
     *   event: solution\n  data: {...}\n\n
     *   event: done\n       data: {...}\n\n
     */
    async readEventStream(response, onReasoning, onSolution) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = '';
        let reasoning = '';
        let solution = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Les blocs SSE sont séparés par "\n\n".
            const blocks = buffer.split(/\n\n/);
            buffer = blocks.pop() || '';

            for (const block of blocks) {
                const parsed = this.parseSseEventBlock(block);
                if (!parsed) continue;

                // Gestion des flux avec événements nommés (Proxy server.js / Vercel)
                if (parsed.event === 'reasoning' || parsed.event === 'solution') {
                    const delta = parsed.data?.delta ?? '';
                    if (parsed.event === 'reasoning') {
                        reasoning += delta;
                        if (onReasoning) onReasoning(reasoning, false);
                    } else {
                        solution += delta;
                        if (onSolution) onSolution(solution, false);
                    }
                }
                // Gestion des flux standards OpenAI / OpenRouter (GitHub Pages direct)
                else if (parsed.event === 'message' && parsed.data?.choices?.[0]?.delta) {
                    const delta = parsed.data.choices[0].delta;
                    if (delta.reasoning_content) {
                        reasoning += delta.reasoning_content;
                        if (onReasoning) onReasoning(reasoning, false);
                    }
                    if (delta.content) {
                        solution += delta.content;
                        if (onSolution) onSolution(solution, false);
                    }
                }

                if (parsed.event === 'done') {
                    if (typeof parsed.data?.reasoning === 'string' && parsed.data.reasoning.trim()) {
                        reasoning = parsed.data.reasoning;
                    }
                    if (typeof parsed.data?.solution === 'string' && parsed.data.solution.trim()) {
                        solution = parsed.data.solution;
                    }
                    if (onReasoning) onReasoning(reasoning, false);
                    if (onSolution) onSolution(solution, false);
                }

                if (parsed.event === 'error') {
                    throw new Error(parsed.data?.error || 'Erreur streaming IA');
                }
            }
        }

        return {
            reasoning: reasoning || 'Demarche integree dans la reponse.',
            solution: solution || 'Solution indisponible'
        };
    }

    buildDirectPayload(payload) {
        return {
            model: window.__ENV__?.DEEPSEEK_MODEL || "google/gemma-2-9b-it:free",
            messages: [
                { 
                    role: "system", 
                    content: "Tu es un tuteur expert en maïeutique. Aide l'étudiant à comprendre par lui-même." 
                },
                { 
                    role: "user", 
                    content: payload.attempt ? `Problème: ${payload.problemStatement}\nTentative: ${payload.attempt}` : payload.problemStatement 
                }
            ],
            stream: true
        };
    }

    // Accepte plusieurs lignes "data:" (RFC SSE) et reconstitue le JSON.
    parseSseEventBlock(block) {
        if (!block || !block.trim()) return null;

        const lines = block.split(/\r?\n/);
        let event = null;
        const dataLines = [];

        for (const line of lines) {
            if (line.startsWith('event:')) {
                event = line.slice('event:'.length).trim();
            } else if (line.startsWith('data:')) {
                dataLines.push(line.slice('data:'.length).trim());
            }
        }

        // Par défaut pour OpenRouter
        if (!event && dataLines.length > 0) event = 'message';

        if (!event || dataLines.length === 0) return null;

        try {
            const dataRaw = dataLines.join('\n');
            return { event, data: JSON.parse(dataRaw) };
        } catch (e) {
            console.warn('Evenement IA ignore:', e);
            return null;
        }
    }

    async getCacheKey(payload) {
        const compactPayload = {
            problemStatement: payload.problemStatement,
            mode: payload.mode,
            attempt: payload.attempt,
            attachments: (payload.attachments || []).map(file => ({
                name: file.name,
                type: file.type,
                size: file.size
            }))
        };

        const encoded = new TextEncoder().encode(JSON.stringify(compactPayload));
        const hash = await crypto.subtle.digest('SHA-256', encoded);
        const hex = Array.from(new Uint8Array(hash))
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
        return `${this.cachePrefix}${hex}`;
    }

    getCachedResult(cacheKey) {
        try {
            const raw = localStorage.getItem(cacheKey);
            if (!raw) return null;
            const cached = JSON.parse(raw);
            const maxAge = 1000 * 60 * 60 * 24;
            if (Date.now() - cached.createdAt > maxAge) {
                localStorage.removeItem(cacheKey);
                return null;
            }
            return cached.result;
        } catch {
            return null;
        }
    }

    setCachedResult(cacheKey, result) {
        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                createdAt: Date.now(),
                result
            }));
        } catch {
            // Le cache est un bonus; l'app continue sans lui.
        }
    }
}

const deepseek = new DeepSeekAPI();
