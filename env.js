/**
 * Configuration des variables d'environnement pour le frontend.
 * En production, ces valeurs sont injectées via le dashboard Vercel/Netlify.
 */
window.__ENV__ = {
    // Remplacer par vos identifiants réels récupérés sur Supabase et DeepSeek
    SUPABASE_URL: "https://lowhqvqynqanwvxsuqha.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_14EgjL1bdg4cACqNykhjug_cYrSiqIV",
    DEEPSEEK_API_KEY: "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",
    DEEPSEEK_MODEL: "google/gemma-2-9b-it:free",
    AI_PROXY_URL: "https://openrouter.ai/api/v1/chat/completions", // Configuration pour OpenRouter
    APP_NAME: "Maieutik UAC",
    APP_VERSION: "1.0.0"
};