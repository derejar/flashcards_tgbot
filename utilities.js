const Config = require("./config.js");
const database = require("./database.js");
const ActionType = require("./actiontype.js");

    function getLastTypeLog(user_id, actionType, callback)
    {
        if(isUserExist(user_id, async function(isExist){
            if(isExist)
            {
                database.logs.find({
                    $and: [
                        {user_id: user_id}, 
                        {actionType: actionType}
                    ]
                }).sort({date: -1}).limit(1).exec(function(err, log){
                    callback(log[0]);
                })
            }
            else
            {
                const log = {
                    user_id: user_id,
                    actionType: ActionType.MAIN_MENU,
                    info: {},
                    date: Date.now()
                };
                callback(log);
            }
        }));
    }

    function getLastLog(user_id, callback)
    {
        if(isUserExist(user_id, async function(isExist){
            if(isExist)
            {
                database.logs.find({user_id: user_id}).sort({date: -1}).limit(1).exec(function(err, log){
                    callback(log[0]);
                });
            }
            else
            {
                const log = {
                    user_id: user_id,
                    actionType: ActionType.MAIN_MENU,
                    info: {},
                    date: Date.now()
                };
                callback(log);
            }
        }));

    }

    function isUserExist(user_id, callback)
    {
        database.users.count({_id: user_id}, function(err, count){
            callback(count != 0);
        });
    }

    function addLog(user_id, actionType, info)
    {
        const log = {
            user_id: user_id,
            actionType: actionType,
            info: info,
            date: Date.now()
        };
        database.logs.update({$and: [{user_id: user_id}, {actionType: actionType}]}, log, {upsert: true});
    }
    
    function addUser(user_id)
    {
        database.users.insert({
            _id: user_id,
        });
    }

    function addDeck(user_id, deck_name)
    {
        database.decks.insert({
            user_id: user_id,
            size: 0,
            name: deck_name,
            lastUnusedFlashcardId: 0,
        });
    }

    function getDeckId(user_id, deck_name, callback)
    {
        database.decks.findOne({$and: [{user_id: user_id}, {name: deck_name}]}, function(err, deck){
            callback(deck._id);
        });
    }

    function addFlashcard(deck_id, frontText, backText, callback)
    {
        database.decks.findOne({_id: deck_id}, function(err, deck){
            let flashcard = {
                numeric_id: deck.lastUnusedFlashcardId,
                deck_id: deck_id,
                frontText: frontText,
                backText: backText,
                rightGuesses: 0,
                wrongGuesses: 0,
                weight: 300
            };
            database.flashcards.insert(flashcard, function(err, insertedFlashcard){
                callback();
            });
            database.decks.update({_id: deck_id}, {$inc: {size: 1}});
            database.decks.update({_id: deck_id}, {$inc: {lastUnusedFlashcardId: 1}});
        });
    }

    function findFlashcards(user_id, regexpr, callback)
    {
        getDeckId(user_id, Config.BASE_DECK_NAME, function(deck_id){
            database.flashcards.find({
                $and: [
                    {deck_id: deck_id}, 
                    {$or: [{frontText: regexpr}, {backText: regexpr}]}
                ]
            }).sort({numeric_id: 1}).exec(function(err, flashcards){
                callback(flashcards);
            });
        });
    }

    function removeFlashcard(deck_id, flashcard_id, callback)
    {
        database.flashcards.remove({$and: [{numeric_id: flashcard_id}, {deck_id: deck_id}]}, {}, function(err, numRemoved){
            if(numRemoved != 0)
                database.decks.update({_id: deck_id}, {$inc: {size: -numRemoved}})
            callback(numRemoved);
        });      
    }

    function calculateFlashcardWeight(rightGuessesCount, wrongGuessesCount, callback)
    {
        if(wrongGuessesCount + rightGuessesCount < 5)
            callback(300);
        else
            callback(100 + 400*(wrongGuessesCount / (wrongGuessesCount + rightGuessesCount)));
    }

    function guessFlashcard(flashcard_id, isGuessed)
    {
        database.flashcards.findOne({_id: flashcard_id}, function(err, flashcard){
            if(isGuessed)
                flashcard.rightGuesses += 1;
            else
                flashcard.wrongGuesses += 1;
            calculateFlashcardWeight(flashcard.rightGuesses, flashcard.wrongGuesses, function(weight){
                flashcard.weight = weight;
                database.flashcards.update({_id: flashcard_id}, flashcard);
            });
        });
        
    }

    function getRandomInt(min, max) 
    {
        const minCeiled = Math.ceil(min);
        const maxFloored = Math.floor(max);
        return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
    }

    async function shuffleArrayByWeights(array)
    {
        return array.sort(function(a, b){
            let result = getRandomInt(0, a.weight + b.weight);
            if(result > a.weight)
                return 1;
            return -1;
        });
    }

    async function updateQueue(user_id, deck_id, callback = () => {})
    {
        database.flashcards.find({deck_id: deck_id}, async function(err, flashcards){
            flashcards = await shuffleArrayByWeights(flashcards);
            let queue = new Array();
            for(const [index, flashcard] of flashcards.entries())
            {
                queue.push({
                    numeric_id: index,
                    flashcard_id: flashcard._id,
                    deck_id: deck_id
                });
            }
            database.queues.remove({deck_id: deck_id}, {multi: true}, function(err, numRemoved){
                database.queues.insert(queue, function(err, insertedQueue){
                    addLog(user_id, ActionType.UPDATE_QUEUE, {deck_id: deck_id});
                    getLastTypeLog(user_id, ActionType.SHOW_FLASHCARD_FRONT, function(log){
                        const info = {
                            queueSize: insertedQueue.length,
                            guessedCount: 0,
                            modeType: (log) ? log.info.modeType : 0
                        }
                        addLog(user_id, ActionType.SHOW_FLASHCARD_FRONT, info);
                        callback();
                    });
                });
            });
        });
    }

    function getFlashcardFromQueue(user_id, deck_name, flashcardsGuessed, callback)
    {
        getDeckId(user_id, deck_name, function(deck_id){
            database.queues.findOne({$and: [{deck_id: deck_id}, {numeric_id: flashcardsGuessed}]}, function(err, queueItem){
                database.flashcards.findOne({_id: queueItem.flashcard_id}, function(err, flashcard){
                    callback(flashcard);
                })
            });
        });
    }

    async function isNumber(string)
    {
        return /^\d+$/.test(string);
    }

    function isQueueOutdated(user_id, callback)
    {
        getLastTypeLog(user_id, ActionType.UPDATE_QUEUE, function(queueLog){
            if(!queueLog)
                callback(true);
            else
                callback(Date.now() - queueLog.date > (1000*Config.QUEUE_TTL_IN_SECONDS));
        });
    }

module.exports = {
    getLastTypeLog,
    getLastLog,
    isUserExists: isUserExist,
    addLog,
    addUser,
    addDeck,
    getDeckId,
    addFlashcard,
    findFlashcards,
    removeFlashcard,
    guessFlashcard,
    getRandomInt,
    shuffleArrayByWeights,
    updateQueue,
    getFlashcardFromQueue,
    isNumber,
    isQueueOutdated,
}