config = {
    TELEGRAM_BOT_API_KEY: "TELEGRAM_API_KEY", // API key вашего телеграм бота
    FLASHCARDS_FOLDER: "./flashcards", // Папка, где будут храниться файлы базы данных NeBD
    BASE_DECK_NAME: "main_deck", // Название основной колоды карты (должно иметь любое непустое значение)
    QUEUE_TTL_IN_SECONDS: 86400, // Время жизни перетасованной ботом колоды карт
    DATABASE_AUTOCOMPACTION_INTERVAL_IN_SECONDS: 86400, // Время автокомпановки файлов базы данных
    MAX_CHARACTERS_IN_FLASHCARD_TEXT: 200, // Максимальное количество символов на одной стороне карточки
    MAX_FLASHCARDS_IN_BOT_MESSAGE: 10, // Максимальное количество карточек, которые бот выводит в одном сообщении
};

module.exports = config;