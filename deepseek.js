/**
 * Client IA Maieutik - Migration vers Google Gemini REST API (Direct)
 */

class DeepSeekAPI {
    constructor() {
        this.cachePrefix = 'maieutik_ai_cache_';
    }

    async solveProblem(problemStatement, options = {}) {
        let reasoning = '';
        let solution = '';
        await this.solveProblemStream(
            problemStatement,
            (nextReasoning) => { reasoning = nextReasoning; },
            (nextSolution) => { solution = nextSolution; },
            options
        );

        return { reasoning, solution };
    }

    async solveProblemStream(problemStatement, onReasoning, onSolution, options = {}) {
        const apiKey = (window.__ENV__?.GEMINI_API_KEY || "").trim();
        const modelName = window.__ENV__?.GEMINI_MODEL || "gemini-2.0-flash";

        if (!apiKey) {
            const errorMsg = "Erreur : Clé GEMINI_API_KEY manquante dans env.js";
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        const requestPayload = {
            problemStatement: problemStatement || '',
            mode: options.mode || 'solve',
            attempt: options.attempt || '',
            attachments: options.attachments || []
        };

        const cacheKey = await this.getCacheKey(requestPayload);
        const cached = this.getCachedResult(cacheKey);
        if (cached) {
            onReasoning?.(cached.reasoning, true);
            onSolution?.(cached.solution, true);
            return cached;
        }

        const systemInstruction = this.getSystemPrompt(requestPayload.mode);
        const promptText = `Problème: ${requestPayload.problemStatement}\n${requestPayload.attempt ? `Ma tentative: ${requestPayload.attempt}` : ''}`;
        
        // URL officielle Google Gemini REST API (Endpoint recommandé)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse`;
        
        let fullText = "";

        try {
            console.log(`[IA] Appel direct vers Google Gemini: ${modelName}`);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    systemInstruction: { parts: [{ text: systemInstruction }] }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || "Erreur lors de la requête à Gemini");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop(); // On garde la ligne incomplète

                for (const line of lines) {
                    const cleanLine = line.trim();
                    if (!cleanLine.startsWith("data: ")) continue;

                    try {
                        const json = JSON.parse(cleanLine.substring(6));
                        // Format de réponse Gemini REST
                        const textChunk = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        
                        if (textChunk) {
                            fullText += textChunk;
                            const parts = this.splitContent(fullText);
                            if (onReasoning) onReasoning(parts.reasoning, false);
                            if (onSolution) onSolution(parts.solution, false);
                        }
                    } catch (e) {
                        // Erreur de parsing sur un chunk incomplet, on ignore
                    }
                }
            }

            const finalResult = this.splitContent(fullText);
            this.setCachedResult(cacheKey, finalResult);
            return finalResult;
        } catch (error) {
            console.error("Gemini API Error:", error);
            throw new Error(`Erreur Gemini: ${error.message}`);
        }
    }

    getSystemPrompt(mode) {
        const prompts = {
            solve: "Tu es un tuteur expert en maïeutique. Résous le problème étape par étape. Tu DOIS impérativement diviser ta réponse en deux sections : commence par '## Démarche' pour expliquer la réflexion, puis '## Solution' pour donner la réponse finale.",
            hint: "Ne donne pas la solution. Donne un indice subtil sous '## Démarche' et encourage l'élève sous '## Solution'.",
            guide: "Pose des questions socratiques sous '## Démarche' pour guider l'élève vers la solution '## Solution'.",
            explain: "Explique le concept mathématique de manière imagée sous '## Démarche' et résume sous '## Solution'."
        };
        return prompts[mode] || prompts.solve;
    }

    splitContent(text) {
        const demarcation = "## Solution";
        if (text.includes(demarcation)) {
            const parts = text.split(demarcation);
            return {
                reasoning: parts[0].replace("## Démarche", "").trim(),
                solution: parts[1].trim()
            };
        }
        return {
            reasoning: text.replace("## Démarche", "").trim(),
            solution: ""
        };
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

// Rendre l'instance accessible globalement pour exercises.js et main.js
window.deepseek = new DeepSeekAPI();
