/**
 * Configuration des variables d'environnement pour le frontend.
 * En production, ces valeurs sont injectées via le dashboard Vercel/Netlify.
 */
window.__ENV__ = {
    // Remplacer par vos identifiants réels récupérés sur Supabase et DeepSeek
    SUPABASE_URL: "https://lowhqvqynqanwvxsuqha.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_14EgjL1bdg4cACqNykhjug_cYrSiqIV",
    DEEPSEEK_API_KEY: "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",
    DEEPSEEK_MODEL: "google/gemma-4-31b-it:free",
    AI_PROXY_URL: "https://openrouter.ai/api/v1/chat/completions", // Configuration pour OpenRouter
    APP_NAME: "Maieutik UAC",
    APP_VERSION: "1.0.0"
};