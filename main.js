const Menu = require("./menu.js")
const Config = require("./config.js");
const Database = require("./database.js");
const Utilities = require("./utilities.js")
const ActionType = require("./actiontype.js");
const TelegramBot = require('node-telegram-bot-api');

const ModeType = {
    FRONT_TO_BACK: "front_to_back",
    BACK_TO_FRONT: "back_to_front",
    MIXED: "mixed"
};

const bot = new TelegramBot(Config.TELEGRAM_BOT_API_KEY, {
    polling: true
});

const commands = [{
        command: "start",
        description: "Запуск бота"
    }, {
        command: "menu",
        description: "Главное меню"
    }, {
        command: "stepback",
        description: "Вернуться на шаг назад"
    },
]

bot.setMyCommands(commands);

bot.on("polling_error", err => console.log(err));

async function isInputCorrect(text)
{
    let result = {
        result: true,
        reason: ""
    };
    if(text.length > Config.MAX_CHARACTERS_IN_FLASHCARD_TEXT)
    {
        result.result = false;
        result.reason = "Слишком много символов в тексте! Попробуй написать короче!";
    }
    return result;
}

function isInputIsCommand(text)
{
    return text == "\/start" || text == "\/menu" || text == "\/stepback";
}

async function createFlashcardsList(flashcards)
{
    let messages = new Array();
    let flashcardsInMessage = Config.MAX_FLASHCARDS_IN_BOT_MESSAGE;
    for(let i = 0; i*flashcardsInMessage < flashcards.length; ++i)
    {
        let messageText = new String();
        for(let j = 0; j < Math.min(flashcardsInMessage, flashcards.length - i*flashcardsInMessage); ++j)
        {
            const index = i*flashcardsInMessage + j;
            messageText += "ID: " + flashcards[index].numeric_id.toString() + "\n";
            messageText += "Текст спереди: " + flashcards[index].frontText + "\n";
            messageText += "Текст сзади: " + flashcards[index].backText + "\n\n";
        }
        messages.push(messageText);
    }
    return messages;
}

async function findFlashcards(user_id, regexpr, callback)
{
    let regexp;
    try {
        regexp = new RegExp(regexpr, "i");
    } catch(error){
        console.log(error);
    }
    
    Utilities.findFlashcards(user_id, regexp, async function(flashcards){
        const messages = await createFlashcardsList(flashcards);
        callback(messages);
    });
}

async function sendFlashcardsToUser(user_id, messages)
{
    const menu = await Menu.flashcards();
    if(messages.length == 0)
    {
        menu.show(bot, user_id, "Я не нашел ни одной карточки!");
        return;
    }
    else
    {
        for(const [index, message] of messages.entries())
        {
            if(index == 0)
            {
                menu.show(bot, user_id, "Вот карточки, которые я нашел:\n" + message);
            }
            else
            {
                setTimeout(function(){
                    bot.sendMessage(user_id, message);
                }, 50*(index + 1));
            }
        }
    }
}

bot.on("text", async function(msg) {
    const inputCorrectness = await isInputCorrect(msg.text);
   if(!inputCorrectness.result)
    {
        const menu = await Menu.removeKeyboard();
        menu.show(bot, msg.from.id, inputCorrectness.reason)
        return;
    }
    if(isInputIsCommand(msg.text))
        return;
    Utilities.getLastLog(msg.from.id, async function(log){
        if(log.actionType == ActionType.INPUT_FLASHCARD_FRONT)
        {
            Utilities.addLog(msg.from.id, ActionType.INPUT_FLASHCARD_BACK, {frontText: msg.text});
            const menu = await Menu.removeKeyboard();
            menu.show(bot, msg.from.id, "Введите текст для задней части карточки:");
        }
        else if(log.actionType == ActionType.INPUT_FLASHCARD_BACK)
        {
            Utilities.getDeckId(msg.from.id, Config.BASE_DECK_NAME, function(deck_id){
                Utilities.addFlashcard(deck_id, log.info.frontText, msg.text, function(){
                    Utilities.updateQueue(msg.from.id, deck_id, async function(){
                        const menu = await Menu.flashcards();
                        menu.show(bot, msg.from.id, "Карточка успешно добавлена!")
                    });
                });
            });
        }
        else if(log.actionType == ActionType.FIND_FLASHCARD)
        {
            findFlashcards(msg.from.id, msg.text, function(messages){
                sendFlashcardsToUser(msg.from.id, messages);
            });
        }
        else if(log.actionType == ActionType.REMOVE_FLASHCARD)
        {
            const isNumber = await Utilities.isNumber(msg.text);
            const menu = await Menu.flashcards();
            if(isNumber)
            {
                Utilities.getDeckId(msg.from.id, Config.BASE_DECK_NAME, function(deck_id){
                    Utilities.removeFlashcard(deck_id, parseInt(msg.text), function(numRemoved){
                        if(numRemoved != 0)
                        {
                            Utilities.updateQueue(msg.from.id, deck_id, function(){
                                menu.show(bot, msg.from.id, "Карточка успешно удалена!");
                            });
                        }
                        else
                            menu.show(bot, msg.from.id, "Карточка с таким ID не найдена!");
                    });
                });
            }
            else
                menu.show(bot, msg.from.id, "ID карточки должно состоять только из цифр!");
        }
    });
});

bot.onText(/^\/start$/, function(msg, regexprResult) {
    Utilities.isUserExists(msg.from.id, async function(isExist){
        if(!isExist)
        {
            Utilities.addUser(msg.from.id);
            Utilities.addDeck(msg.from.id, Config.BASE_DECK_NAME);
        }
        const menu = await Menu.main();
        menu.show(bot, msg.from.id, "Привет! Этот бот поможет тебе выучить новые слова на желаемом тобой языке! Выбери действие:");
    })
});

function isInputIsText(log)
{
    return log.actionType == ActionType.INPUT_FLASHCARD_FRONT || log.actionType == ActionType.INPUT_FLASHCARD_BACK ||
        log.actionType == ActionType.FIND_FLASHCARD || log.actionType == ActionType.REMOVE_FLASHCARD;
}

bot.onText(/^(\/menu|Меню|❌)$/, async (msg, regexprResult) => {
    if(regexprResult[0] == "\/menu")
    {
        const menu = await Menu.main();
        menu.show(bot, msg.from.id);
    }
    else
    {
        Utilities.getLastLog(msg.from.id, async function(log){
            if(!isInputIsText(log))
            {
                const menu = await Menu.main();
                menu.show(bot, msg.from.id);
            }
        });
    }
});

bot.onText(/^Карточки$/, async (msg, regexprResult) => {
    Utilities.getLastLog(msg.from.id, async function(log){
        if(log.actionType == ActionType.MAIN_MENU)
        {
            const menu = await Menu.flashcards();
            menu.show(bot, msg.from.id);
        }
    });
});

bot.onText(/^Добавить карточку$/, async (msg, regexprResult) => {
    Utilities.getLastLog(msg.from.id, async function(log){
        if(log.actionType == ActionType.FLASHCARDS_MENU)
        {
            Utilities.addLog(msg.from.id, ActionType.INPUT_FLASHCARD_FRONT, {});
            const menu = await Menu.removeKeyboard();
            menu.show(bot, msg.from.id, "Введите текст для передней части карточки:");
        }
    });
});

bot.onText(/^Найти карточку$/, async (msg, regexprResult) => {
    Utilities.getLastLog(msg.from.id, async function(log){
        if(log.actionType == ActionType.FLASHCARDS_MENU)
        {
            Utilities.addLog(msg.from.id, ActionType.FIND_FLASHCARD, {});
            const menu = await Menu.removeKeyboard();
            menu.show(bot, msg.from.id, "Введите текст сзади или спереди карточки для поиска:");
        }
    });
});

bot.onText(/^Показать все карточки$/, function(msg, regexprResult) {
    Utilities.getLastLog(msg.from.id, async function(log){
        if(log.actionType == ActionType.FLASHCARDS_MENU)
        {
            findFlashcards(msg.from.id, ".*", function(messages) {
                sendFlashcardsToUser(msg.from.id, messages);
            });
        }
    });
});

bot.onText(/^Удалить карточку$/, function(msg, regexprResult) {
    Utilities.getLastLog(msg.from.id, async function(log){
        if(log.actionType == ActionType.FLASHCARDS_MENU)
        {
            Utilities.addLog(msg.from.id, ActionType.REMOVE_FLASHCARD, {});
            const menu = await Menu.removeKeyboard();
            menu.show(bot, msg.from.id, "Введите ID карточки для удаления:");
        }
    });
});

bot.onText(/^Обучение$/, function(msg, regexprResult) {
    Utilities.getLastLog(msg.from.id, async function(log){
        if(log.actionType == ActionType.MAIN_MENU)
        {
            const menu = await Menu.study();
            menu.show(bot, msg.from.id);
        }
    });
});

bot.onText(/^Обновить колоду$/, function(msg, regexprResult) {
    Utilities.getLastLog(msg.from.id, async function(log){
        if(log.actionType == ActionType.STUDY_MENU)
        {
            Utilities.getDeckId(msg.from.id, Config.BASE_DECK_NAME, function(deck_id){
                Utilities.updateQueue(msg.from.id, deck_id, async function(){
                    Utilities.getLastTypeLog(msg.from.id, ActionType.SHOW_FLASHCARD_FRONT, async function(log){
                        const menu = await Menu.study();
                        if(!log || log.info.queueSize == 0)
                            menu.show(bot, msg.from.id, "Сначала добавь хотя бы одну карточку!");
                        else
                            menu.show(bot, msg.from.id, "Колода обновлена!");
                    });
                });
            })
        }
    });
});

bot.onText(/^(Обычный режим|Обратный режим|Смешанный режим)$/, async function(msg, regexprResult) {
    Utilities.getLastLog(msg.from.id, async function(log){
        if(log.actionType == ActionType.STUDY_MENU)
        {
            let modeType;
            if(regexprResult[0] == "Обычный режим")
                modeType = ModeType.FRONT_TO_BACK;
            else if(regexprResult[0] == "Обратный режим")
                modeType = ModeType.BACK_TO_FRONT;
            else
                modeType = ModeType.MIXED;
            showFlashcardFront(msg.from.id, modeType);
        }
    });
});

function showFlashcardFront(user_id, modeType)
{
    Utilities.isQueueOutdated(user_id, async function(isOutdated){
        if(isOutdated)
        {
            Utilities.getDeckId(user_id, Config.BASE_DECK_NAME, async function(deck_id){
                Utilities.updateQueue(user_id, deck_id, function(){
                    showFlashcardFrontHelper(user_id, modeType);
                });
            });
        }
        else
            showFlashcardFrontHelper(user_id, modeType);
    });
}

function showFlashcardFrontHelper(user_id, modeType)
{
    Utilities.getLastTypeLog(user_id, ActionType.SHOW_FLASHCARD_FRONT, async function(log){
        if(!log || log.info.queueSize == 0) 
        {
            const menu = await Menu.study();
            menu.show(bot, user_id, "Сначала добавь хотя бы одну карточку!");
            return;
        }
        if(log.info.guessedCount >= log.info.queueSize)
        {
            Utilities.getDeckId(user_id, Config.BASE_DECK_NAME, function(deck_id){
                Utilities.updateQueue(user_id, deck_id, async function(){
                    const menu = await Menu.study();
                    menu.show(bot, user_id, "Поздравляю! Ты прорешал всю колоду!");
                });
            });
        }
        else
        {
            if(modeType)
                log.info.modeType = modeType;
            Utilities.getFlashcardFromQueue(user_id, Config.BASE_DECK_NAME, log.info.guessedCount, async function(flashcard){
                let tmpModeType = log.info.modeType;
                if(tmpModeType == ModeType.MIXED)
                {
                    if(Math.random() < 0.5)
                        tmpModeType = ModeType.FRONT_TO_BACK;
                    else
                        tmpModeType = ModeType.BACK_TO_FRONT;
                }
                if(tmpModeType == ModeType.BACK_TO_FRONT)
                {
                    const frontText = flashcard.frontText;
                    flashcard.frontText = flashcard.backText;
                    flashcard.backText = frontText;
                }
                log.info.flashcard = flashcard;
                Utilities.addLog(user_id, ActionType.SHOW_FLASHCARD_BACK, log.info);
                const menu = await Menu.showFlashcardFront();
                menu.show(bot, user_id, flashcard.frontText);
            });
        }
    });
}

async function sendQueueOutdatedMessage(user_id)
{
    const menu = await Menu.study();
    menu.show(bot, user_id, "Колода устарела! Начни с начала!");
}

function showFlashcardBack(user_id)
{
    Utilities.isQueueOutdated(user_id, async function(isOutdated){
        if(isOutdated)
            sendQueueOutdatedMessage(user_id);
        else
        {
            Utilities.getLastLog(user_id, async function(log){
                if(log.actionType == ActionType.SHOW_FLASHCARD_BACK)
                {
                    Utilities.addLog(user_id, ActionType.WAIT_FOR_GUESS, log.info);
                    const menu = await Menu.showFlashcardBack();
                    menu.show(bot, user_id, log.info.flashcard.backText)
                }
            })
        }
    });
}

function flashcardGuessResult(user_id, isGuessed)
{
    Utilities.isQueueOutdated(user_id, async function(isOutdated){
        if(isOutdated)
            sendQueueOutdatedMessage(user_id);
        else
        {
            Utilities.getLastLog(user_id, async function(log){
                if(log.actionType == ActionType.WAIT_FOR_GUESS || log.actionType == ActionType.SHOW_FLASHCARD_BACK)
                {
                    Utilities.guessFlashcard(log.info.flashcard._id, isGuessed);
                    delete log.info.flashcard;
                    log.info.guessedCount += 1;
                    Utilities.addLog(user_id, ActionType.SHOW_FLASHCARD_FRONT, log.info);
                    showFlashcardFront(user_id);
                }
            })
        }
    });
}

bot.onText(/^👍$/, function(msg, regexprResult){
    Utilities.getLastLog(msg.from.id, async function(log){
        if(log.actionType == ActionType.SHOW_FLASHCARD_FRONT || log.actionType == ActionType.SHOW_FLASHCARD_BACK || 
                                                                log.actionType == ActionType.WAIT_FOR_GUESS)
        {
            flashcardGuessResult(msg.from.id, true);
        }
    });
})

bot.onText(/^🔄$/, function(msg, regexprResult){
    Utilities.getLastLog(msg.from.id, async function(log){
        if(log.actionType == ActionType.SHOW_FLASHCARD_BACK)
        {
            showFlashcardBack(msg.from.id);
        }
    });
})

bot.onText(/^👎$/, function(msg, regexprResult){
    Utilities.getLastLog(msg.from.id, async function(log){
        if(log.actionType == ActionType.WAIT_FOR_GUESS)
        {
            flashcardGuessResult(msg.from.id, false);
        }
    });
})

bot.onText(/^(\/stepback|Назад)$/, function(msg, regexprResult){
    Utilities.getLastLog(msg.from.id, async function(log){
        if(log.actionType == ActionType.FLASHCARDS_MENU || log.actionType == ActionType.STUDY_MENU)
        {
            const menu = await Menu.main();
            menu.show(bot, msg.from.id);
        }
        else if(log.actionType == ActionType.SHOW_FLASHCARD_BACK || log.actionType == ActionType.WAIT_FOR_GUESS)
        {
            const menu = await Menu.study();
            menu.show(bot, msg.from.id);
        }
        else if(isInputIsText(log) && regexprResult[0] == "\/stepback")
        {
            const menu = await Menu.flashcards();
            menu.show(bot, msg.from.id);
        }
    });
})
