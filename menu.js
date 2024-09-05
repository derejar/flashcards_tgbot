const { addLog } = require("./utilities");
const ActionType = require("./actiontype")

    async function main()
    {
        const answer = {
            text: "Выберите действие:",
            options: {
                reply_markup : {
                    keyboard : [
                        ["Карточки"],
                        ["Обучение"]
                    ],
                    resize_keyboard : true
                }
            },
            show: function(bot, user_id, text = this.text, options = this.options)
            {
                addLog(user_id, ActionType.MAIN_MENU, {});
                bot.sendMessage(user_id, text, options);
            }
        };
        return answer;
    }

    async function flashcards()
    {
        const answer = {
            text: "Выберите действие:",
            options: {
                reply_markup : {
                    keyboard : [
                        ["Добавить карточку"],
                        ["Найти карточку", "Показать все карточки"],
                        ["Удалить карточку"],
                        ["Назад"]
                    ],
                    resize_keyboard : true
                }
            },
            show: function(bot, user_id, text = this.text, options = this.options)
            {
                addLog(user_id, ActionType.FLASHCARDS_MENU, {});
                bot.sendMessage(user_id, text, options);
            }
        };
        return answer;
    }

    async function study()
    {
        const answer = {
            text: "Выберите действие:",
            options: {
                reply_markup : {
                    keyboard : [
                        ["Обновить колоду"],
                        ["Обычный режим", "Обратный режим"],
                        ["Смешанный режим"],
                        ["Назад"]
                    ],
                    resize_keyboard : true
                }
            },
            show: function(bot, user_id, text = this.text, options = this.options)
            {
                addLog(user_id, ActionType.STUDY_MENU, {});
                bot.sendMessage(user_id, text, options);
            }
        };
        return answer;
    }

    async function removeKeyboard()
    {
        const answer = {
            text: "Введите текст:",
            options: {
                reply_markup : {
                    remove_keyboard : true
                }
            },
            show: function(bot, user_id, text = this.text, options = this.options)
            {
                bot.sendMessage(user_id, text, options);
            }
        }
        return answer;
    }

    async function showFlashcardFront()
    {
        const answer = {
            text: "Передняя часть карточки",
            options: {
                reply_markup : {
                    keyboard : [
                        ["👍", "🔄", "❌"],
                    ],
                    resize_keyboard : true
                }
            },
            show: function(bot, user_id, text = this.text, options = this.options)
            {
                bot.sendMessage(user_id, text, options);
            }
        };
        return answer;
    }
    
    async function showFlashcardBack()
    {
        const answer = {
            text: "Задняя часть карточки",
            options: {
                reply_markup : {
                    keyboard : [
                        ["👍", "👎", "❌"],
                    ],
                    resize_keyboard : true
                }
            },
            show: function(bot, user_id, text = this.text, options = this.options)
            {
                bot.sendMessage(user_id, text, options);
            }
        };
        return answer;
    }

module.exports = {
    main,
    flashcards,
    study,
    removeKeyboard,
    showFlashcardFront,
    showFlashcardBack,
}