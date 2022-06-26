require('dotenv').config();
process.env.NTBA_FIX_319 = 1;
const TelegramApi = require('node-telegram-bot-api');
const sequelize = require('./db');
const UserModel = require('./models');
const questions = require('./questions');
const questionsTest = require('./questionsTest');
const bot = new TelegramApi(process.env.TELEGRAM_BOT_TEST_API_KEY, {
  polling: true,
});

bot.setMyCommands([
  { command: '/quiz', description: 'Получить вопрос OLIMPBET QUIZ!' },
  { command: '/info', description: 'Посмотреть набранные очки' },
  { command: '/rules', description: 'Правила' },
  { command: '/leaderboard', description: 'Лидеры OLIMPBET QUIZ' },
]);

const startQuestion = async (chatId) => {
  const user = await UserModel.findOne({ where: { chatId: chatId } });
  let questionIndex = user.countAnswers;
  let question = questions[questionIndex];
  let answerOptions = {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [
          {
            text: question.variant1,
            callback_data: `${question.id}_${question.variant1}`,
          },
        ],
        [
          {
            text: question.variant2,
            callback_data: `${question.id}_${question.variant2}`,
          },
        ],
        [
          {
            text: question.variant3,
            callback_data: `${question.id}_${question.variant3}`,
          },
        ],
        [
          {
            text: question.variant4,
            callback_data: `${question.id}_${question.variant4}`,
          },
        ],
      ],
    }),
  };
  let timer = 30;
  const basePoints = 10;
  let imgMsgId = '';
  bot
    .sendPhoto(chatId, question.img)
    .then((imgMsg) => {
      imgMsgId = imgMsg.message_id;
      imgMsgChatId = imgMsg.chat.chat_id;
      console.log('post:', imgMsgId);
    })
    .then(() => {
      bot
        .sendMessage(chatId, `${question.text}`, answerOptions)
        .then((msgData) => {
          let intervalId = setInterval(() => {
            timer--;
            bot.editMessageText(
              `${question.text}. \n\n‼️<b><i>Осталось ${timer} секунд.</i></b>‼️`,
              {
                ...answerOptions,
                chat_id: msgData.chat.id,
                message_id: msgData.message_id,
                parse_mode: 'HTML',
              }
            );
            if (timer === 0) {
              clearInterval(intervalId);
              user.countAnswers++;
              user.save();
              bot.deleteMessage(msgData.chat.id, imgMsgId);
              bot.removeListener('callback_query');
              bot.editMessageText(
                `Ответ на вопрос №${
                  question.id
                }: \nВремя на ответ вышло :( Переходи к следующему вопросу командой /quiz \n\n${
                  questions[questionId].date
                    ? `Следующий вопрос будет доступен c ${new Date(
                        questions[questionId].date * 1000
                      ).toLocaleString('ru-RU')}`
                    : 'Это был последний вопрос'
                }`,
                {
                  chat_id: msgData.chat.id,
                  message_id: msgData.message_id,
                  parse_mode: 'HTML',
                }
              );
            }
          }, 1000);

          bot.on('callback_query', async (msg) => {
            const questionId = msg.data.split('_')[0];
            const questionText = msg.data.split('_')[1];
            const chatId = msg.message.chat.id;
            const message_id = msg.message.message_id;

            if (/^\d{1,2}_.+/i.test(msg.data)) {
              bot.deleteMessage(msgData.chat.id, imgMsgId);
              if (
                questionText ===
                questions.find((item) => item.id == questionId).correct
              ) {
                clearInterval(intervalId);
                let totalPoints = basePoints + timer;
                user.score += totalPoints;
                user.countAnswers++;
                await user.save();
                bot.removeListener('callback_query');
                return bot.editMessageText(
                  `Ответ на вопрос №${
                    question.id
                  }: \nПравильно! Ты заработал ${totalPoints} очков! Попробуй ответить на следующий вопрос командой /quiz \n\n${
                    questions[questionId].date
                      ? `Следующий вопрос будет доступен c ${new Date(
                          questions[questionId].date * 1000
                        ).toLocaleString('ru-RU')}`
                      : 'Это был последний вопрос'
                  }`,
                  {
                    chat_id: chatId,
                    message_id: message_id,
                  }
                );
              } else {
                clearInterval(intervalId);
                user.countAnswers++;
                await user.save();
                bot.removeListener('callback_query');
                return bot.editMessageText(
                  `Ответ на вопрос №${
                    question.id
                  }: \nМимо! Попробуй следующий вопрос командой /quiz \n\n${
                    questions[questionId].date
                      ? `Следующий вопрос будет доступен c ${new Date(
                          questions[questionId].date * 1000
                        ).toLocaleString('ru-RU')}`
                      : 'Это был последний вопрос'
                  }`,
                  {
                    chat_id: chatId,
                    message_id: message_id,
                  }
                );
              }
            }
          });
        });
    });
};

const start = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force: true }); //{ force: true } to drop db
  } catch (e) {
    console.log('Error' + e);
  }

  bot.on('message', async (msg) => {
    const text = msg.text;
    const chatId = msg.chat.id;
    const username = msg.from.username;
    const firstName = msg.from.first_name;
    try {
      if (text === '/start') {
        try {
          await UserModel.create({
            chatId: chatId,
            username: username,
          });
        } catch (error) {
          if (error.name === 'SequelizeUniqueConstraintError') {
            return bot.sendMessage(
              chatId,
              `Ты уже зарегистрирован. Выбери в меню вопрос или введи команду /quiz`
            );
          }
        }
        return bot.sendMessage(
          chatId,
          '👋Привет! \n\n🏟🏆<b>9 июля в Санкт-Петербурге пройдет Olimpbet Суперкубок России по футболу.</b> \n\n🤓 Специально к суперматчу «Зенит» – «Спартак» и старту нового сезона мы запускаем <b>«Olimpbet QUIZ»!</b> \n\n❗️Когда будешь готов начать игру, запускай вопросы командой /quiz. После этого у тебя будет всего 30 секунд, чтобы дать правильный ответ! Надо отвечать не только правильно, но и быстро – за это будут начисляться дополнительные баллы. Чем больше ты наберешь очков, тем выше будут твои шансы попасть на Olimpbet-Суперкубок 2022. \n\n🎁 <b>Пять игроков, которые наберут наибольшее количество баллов, получат по два билета на игру.</b>',
          { parse_mode: 'HTML' }
        );
      }
      if (text === '/rules') {
        return bot.sendMessage(
          chatId,
          `<b>Период акции:</b> с 2 по 6 июля \n\n<b>Количество вопросов:</b> 15 вопросов, вопросы становятся доступными по одному с 2 по 6 июля в 10:00, 15:00, 20:00 по МСК \n\n<b>Время на ответ:</b> 30 секунд \n\n<b>Порядок начисления очков:</b> Базовая стоимость правильного ответа 10 очков. Конечное количество очков рассчитывается как сумма базовой стоимости и количества оставшихся секунд на ответ. \n\n<b>Подведение итогов: </b> 6 июля мы свяжемся с 5 игроками с наибольшим количеством очков.`,
          { parse_mode: 'HTML' }
        );
      }
      if (text === '/info') {
        const user = await UserModel.findOne({
          where: { chatId },
        });
        return bot.sendMessage(
          chatId,
          `👋Привет, ${firstName}! \n\n🤔<b>Количество пройденных вопросов:</b> ${user.countAnswers} \n\n✅<b>Количество набранных очков:</b> ${user.score} \n\n🙌Отвечай правильно на вопросы и зарабатывай очки`,
          { parse_mode: 'HTML' }
        );
      }
      if (text === '/leaderboard') {
        const leaders = await UserModel.findAll({
          order: [['score', 'DESC']],
          group: ['user.id'],
          limit: 5,
        });
        return bot.sendMessage(
          chatId,
          `ТОП-5 знатоков 🏆<b>OLIMPBET Суперкубка России</b>🏆:
          ${
            leaders[0]
              ? `\n1️⃣<b>${leaders[0].username}</b>, количество очков: ${leaders[0].score}`
              : 'Пока знатоков нет 🤷‍♂️'
          }
          ${
            leaders[1]
              ? `\n2️⃣<b>${leaders[1].username}</b>, количество очков: ${leaders[1].score}`
              : ''
          }
          ${
            leaders[2]
              ? `\n3️⃣<b>${leaders[2].username}</b>, количество очков: ${leaders[2].score}`
              : ''
          }
          ${
            leaders[2]
              ? `\n4️⃣<b>${leaders[3].username}</b>, количество очков: ${leaders[3].score}`
              : ''
          }
          ${
            leaders[2]
              ? `\n5️⃣<b>${leaders[4].username}</b>, количество очков: ${leaders[4].score}`
              : ''
          }`,
          { parse_mode: 'HTML' }
        );
      }
      if (text === '/quiz') {
        const user = await UserModel.findOne({
          where: { chatId },
        });
        const currentDate = new Date().getTime() / 1000;
        const canAnswer = user.countAnswers < questionsTest.length;
        if (!canAnswer) {
          return bot.sendMessage(
            chatId,
            'Это был последний вопрос. \nТы можешь посмотреть свою статистику командой /info и общий зачет командой /leaderboard',
            {
              parse_mode: 'HTML',
            }
          );
        }
        const availableQuestions = questionsTest.filter(
          (q) => q.date < currentDate
        );
        if (
          availableQuestions.length === 0 ||
          availableQuestions.length <= user.countAnswers
        ) {
          return bot.sendMessage(
            chatId,
            'Активных вопросов еще нет. \nТы можешь посмотреть график публикации вопросов командой /rules',
            {
              parse_mode: 'HTML',
            }
          );
        }
        if (availableQuestions.length > user.countAnswers) {
          return startQuestion(chatId);
        }
        return bot.sendMessage(
          chatId,
          'Что-то пошло не так. \nТы можешь посмотреть график публикации вопросов командой /rules, посмотреть свою статистику командой /info и общий зачет командой /leaderboard',
          {
            parse_mode: 'HTML',
          }
        );
      }
      return bot.sendMessage(
        chatId,
        'Я тебя не понимаю, попробуй воспользоваться меню)'
      );
    } catch (e) {
      return bot.sendMessage(
        chatId,
        `Произошла ошибка: ${e}, попробуй еще раз`
      );
    }
  });
};
start();
