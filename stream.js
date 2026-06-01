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

  const baseInstruction = "Tu es un tuteur socratique strict. Règles absolues :\n1. Utilise UNIQUEMENT le symbole $ pour TOUTES les expressions mathématiques et chiffres isolés (ex: $4$).\n2. Interdiction formelle d'utiliser \\mathbf, \\(, \\[, \\text ou **.\n3. Ne donne JAMAIS la réponse finale.\n4. Pose UNE SEULE question courte à la fois et attends la réponse de l'élève. Ne fais jamais les questions et les réponses dans le même message.";

  const systemPrompts = {
    solve: `${baseInstruction} Salue l'élève, analyse sa demande sans donner le résultat, et pose la première question pour le mettre sur la voie. Écris au maximum 3 phrases.`
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