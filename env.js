/**
 * Configuration des variables d'environnement pour le frontend.
 * En production, ces valeurs sont injectées via le dashboard Vercel/Netlify.
 */
window.__ENV__ = {
    // Remplacer par vos identifiants réels récupérés sur Supabase et DeepSeek
    SUPABASE_URL: "https://lowhqvqynqanwvxsuqha.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_14EgjL1bdg4cACqNykhjug_cYrSiqIV",
    DEEPSEEK_API_KEY: "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",
    DEEPSEEK_MODEL: "deepseek-v4-flash:free",
    AI_PROXY_URL: "https://openrouter.ai/api/v1/chat/completions", // Configuration pour OpenRouter
    APP_NAME: "Maieutik UAC",
    APP_VERSION: "1.0.0"
};