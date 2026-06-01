import OpenAI from 'openai';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { problemStatement, mode, attempt } = await req.json();
  
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENROUTER_API_KEY;
  const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-reasoner';

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'IA configuration missing on server' }), { status: 500 });
  }

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });

  const baseInstruction = "Tu es un professeur de mathématiques socratique. Règle d'or : utilise toujours $ pour le LaTeX en ligne et les chiffres isolés (ex: $3$). Utilise $$ pour les blocs centrés. JAMAIS de \\mathbf, \\( ou \\[. JAMAIS de ** pour les maths.";

  const systemPrompts = {
    solve: `${baseInstruction} Résous étape par étape. Sections : ## Démarche et ## Solution.`,
    hint: `${baseInstruction} Ne donne pas la solution, donne un indice subtil.`,
    guide: `${baseInstruction} Guide l'élève par des questions socratiques.`,
    review: `${baseInstruction} Analyse la tentative sans donner la correction directe immédiatement.`,
    explain: `${baseInstruction} Explique le concept de manière imagée.`
  };

  const stream = await openai.chat.completions.create({
    model: model,
    messages: [
      { role: "system", content: systemPrompts[mode] || systemPrompts.solve },
      { role: "user", content: attempt ? `Problème: ${problemStatement}\nMa tentative: ${attempt}` : problemStatement }
    ],
    stream: true,
  });

  const encoder = new TextEncoder();
  const customStream = new ReadableStream({
    async start(controller) {
      let fullReasoning = '';
      let fullContent = '';

      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          
          // Gestion du raisonnement (spécifique au modèle DeepSeek Reasoner / R1)
          if (delta?.reasoning_content) {
            fullReasoning += delta.reasoning_content;
            controller.enqueue(encoder.encode(`event: reasoning\ndata: ${JSON.stringify({ delta: delta.reasoning_content })}\n\n`));
          }

          // Gestion du contenu de la réponse finale
          if (delta?.content) {
            fullContent += delta.content;
            controller.enqueue(encoder.encode(`event: solution\ndata: ${JSON.stringify({ delta: delta.content })}\n\n`));
          }
        }

        // Envoi du signal de fin avec l'agrégation complète pour le cache
        controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ reasoning: fullReasoning, solution: fullContent })}\n\n`));
        controller.close();
      } catch (err) {
        console.error('Streaming error:', err);
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(customStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}