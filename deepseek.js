/**
 * Client IA Maieutik - Migration vers Google Gemini SDK
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

class DeepSeekAPI {
    constructor() {
        const apiKey = window.__ENV__?.GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
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
        if (!this.genAI) {
            throw new Error("Clé GEMINI_API_KEY manquante dans env.js");
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

        const modelName = window.__ENV__?.GEMINI_MODEL || "gemini-1.5-flash";
        const systemInstruction = this.getSystemPrompt(requestPayload.mode);
        
        const model = this.genAI.getGenerativeModel({ 
            model: modelName,
            systemInstruction: systemInstruction 
        });

        const prompt = `Problème: ${requestPayload.problemStatement}\n${requestPayload.attempt ? `Ma tentative: ${requestPayload.attempt}` : ''}`;
        
        let fullText = "";
        let reasoning = "";
        let solution = "";

        try {
            const result = await model.generateContentStream(prompt);

            for await (const chunk of result.stream) {
                fullText += chunk.text();

                // Séparation dynamique entre Démarche et Solution basée sur les balises imposées
                const parts = this.splitContent(fullText);
                reasoning = parts.reasoning;
                solution = parts.solution;

                if (onReasoning) onReasoning(reasoning, false);
                if (onSolution) onSolution(solution, false);
            }

            const finalResult = { reasoning, solution };
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

const deepseek = new DeepSeekAPI();
