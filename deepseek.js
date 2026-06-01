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

        // Liste des modèles mis à jour (Note : identifiants spécifiés pour la bascule de secours)
        const modelsToTry = [
            (window.__ENV__?.GEMINI_MODEL || "gemini-2.5-flash").trim(),
            "gemini-3.5-flash",
            "gemini-2.5-pro"
        ];

        // Supprimer les doublons potentiels
        const uniqueModels = [...new Set(modelsToTry)];
        let lastError = null;

        for (let i = 0; i < uniqueModels.length; i++) {
            const modelName = uniqueModels[i];
            const systemInstruction = this.getSystemPrompt(requestPayload.mode);
            const promptText = `Problème: ${requestPayload.problemStatement}\n${requestPayload.attempt ? `Ma tentative: ${requestPayload.attempt}` : ''}`;
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse`;
            
            let fullText = "";

            try {
                console.log(`[IA] Tentative avec le modèle : ${modelName} (${i + 1}/${uniqueModels.length})`);
                
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
                    const errMsg = errorData.error?.message || "";

                    // Si erreur de quota (429), modèle introuvable (404) ou accès (403), on tente le suivant
                    if ((response.status === 429 || response.status === 404 || response.status === 403 || errMsg.toLowerCase().includes("quota")) && i < uniqueModels.length - 1) {
                        console.warn(`[IA] Modèle ${modelName} non disponible ou saturé. Bascule sur le modèle de secours...`);
                        continue; 
                    }

                    // Si c'est le dernier modèle ou une autre erreur, on génère le message propre
                    if (response.status === 429 || errMsg.toLowerCase().includes("quota")) {
                        throw new Error("Les serveurs gratuits de Google sont saturés. Veuillez patienter 45 secondes avant de soumettre à nouveau l'exercice.");
                    }
                    throw new Error(errMsg || "Erreur lors de la requête à Gemini");
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop();

                    for (const line of lines) {
                        const cleanLine = line.trim();
                        if (!cleanLine.startsWith("data: ")) continue;

                        try {
                            const json = JSON.parse(cleanLine.substring(6));
                            const textChunk = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
                            
                            if (textChunk) {
                                fullText += textChunk;
                                const parts = this.splitContent(fullText);
                                if (onReasoning) onReasoning(parts.reasoning, false);
                                if (onSolution) onSolution(parts.solution, false);
                            }
                        } catch (e) { }
                    }
                }

                const finalResult = this.splitContent(fullText);
                this.setCachedResult(cacheKey, finalResult);
                return finalResult;

            } catch (error) {
                lastError = error;
                // En cas d'erreur de réseau ou de quota pendant le streaming, on tente le suivant si possible
                if (i < uniqueModels.length - 1 && (error.message.includes("429") || error.message.includes("404") || error.message.toLowerCase().includes("quota"))) {
                    continue;
                }
                throw error;
                        }
        }
        throw lastError;
    }

    getSystemPrompt(mode) {
        const katexRule = "Règle absolue de formatage : Utilise UNIQUEMENT le symbole $ pour TOUTES les expressions mathématiques et chiffres isolés (ex: $4$). Interdiction formelle d'utiliser \\mathbf, \\(, \\[, \\text ou **.";

        const prompts = {
            guide: `Tu es un tuteur socratique strict. ${katexRule}\nStructure obligatoire : Tu dois TOUJOURS structurer ta réponse avec '## Démarche' suivi de ta question, puis '## Solution' suivi du mot 'En attente'.\nInstructions : Ne donne jamais la réponse. Pose une seule question courte sous '## Démarche' et attends l'élève.`,
            
            solve: `Tu es un professeur de mathématiques clair. ${katexRule}\nStructure obligatoire : Écris '## Démarche' pour expliquer les étapes de calcul, puis '## Solution' pour donner le résultat final.`,
            
            hint: `Tu es un assistant pédagogique. ${katexRule}\nStructure obligatoire : Écris '## Démarche' pour donner ton indice court, puis '## Solution' suivi du mot 'À toi de jouer'.`,
            
            explain: `Tu es un vulgarisateur scientifique. ${katexRule}\nStructure obligatoire : Écris '## Démarche' pour donner ton analogie concrète, puis '## Solution' pour résumer le concept.`
        };

        return prompts[mode] || prompts.guide;
    }

    splitContent(text) {
        // Recherche insensible à la casse et plus flexible pour les balises
        const solutionRegex = /##\s*Solution/i;
        const démarcheRegex = /##\s*D[ée]marche/gi;

        const match = text.match(solutionRegex);
        
        if (match) {
            const index = match.index;
            const reasoningPart = text.substring(0, index);
            const solutionPart = text.substring(index + match[0].length);

            return {
                reasoning: reasoningPart.replace(démarcheRegex, "").trim(),
                solution: solutionPart.trim()
            };
        }
        return {
            reasoning: text.replace(démarcheRegex, "").trim(),
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
