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
let canGetNextQuestion = true;

bot.setMyCommands([
  { command: '/quiz', description: 'Получить вопрос OLIMPBET QUIZ!' },
  { command: '/info', description: 'Посмотреть набранные очки' },
  { command: '/rules', description: 'Правила' },
  { command: '/leaderboard', description: 'Лидеры OLIMPBET QUIZ' },
  { command: '/promo', description: 'Акции OLIMPBET' },
]);

const startQuestion = async (chatId, user) => {
  let questionIndex = user.countAnswers;
  let question = questions[questionIndex];
  let answerOptions = {
    reply_markup: JSON.stringify({
      one_time_keyboard: true,
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
  const basePoints = 60;
  let imgMsgId = '';
  bot
    .sendPhoto(chatId, question.img)
    .then((imgMsg) => {
      imgMsgId = imgMsg.message_id;
      imgMsgChatId = imgMsg.chat.chat_id;
      user.countAnswers++;
      user.save();
    })
    .then(() => {
      bot
        .sendMessage(
          chatId,
          `Всего 30 секунд от ответ! \n\n‼️<b><i>Не теряй время</i></b>‼️`,
          { parse_mode: 'HTML' }
        )
        .then((msgData) => {
          let intervalId = setInterval(() => {
            timer--;
            bot
              .editMessageText(
                `Всего 30 секунд от ответ! \n\n‼️<b><i>Осталось ${timer} секунд.</i></b>‼️`,
                {
                  ...answerOptions,
                  chat_id: msgData.chat.id,
                  message_id: msgData.message_id,
                  parse_mode: 'HTML',
                }
              )
              .then(() => {
                if (timer === 0) {
                  clearInterval(intervalId);
                  bot
                    .editMessageText(
                      `Ответ на вопрос №${
                        question.id
                      }: \nВремя на ответ вышло :( Переходи к следующему вопросу командой /quiz \n\n${
                        questions[questionIndex + 1]
                          ? `Следующий вопрос будет доступен c ${new Date(
                              questions[questionIndex + 1].date * 1000 +
                                10800000
                            ).toLocaleString('ru-RU')} по МСК`
                          : 'Это был последний вопрос'
                      }`,
                      {
                        chat_id: msgData.chat.id,
                        message_id: msgData.message_id,
                        parse_mode: 'HTML',
                      }
                    )
                    .then(() => {
                      canGetNextQuestion = true;
                    });
                }
              });
          }, 1000);

          bot.on('callback_query', async (msg) => {
            const questionId = msg.data.split('_')[0];
            const questionText = msg.data.split('_')[1];
            const chatId = msg.message.chat.id;
            const message_id = msg.message.message_id;

            if (
              questionText ===
              questions.find((item) => item.id == questionId).correct
            ) {
              bot.removeListener('callback_query');
              clearInterval(intervalId);
              let totalPoints = basePoints + timer;
              user.score += totalPoints;
              await user.save();
              return bot
                .editMessageText(
                  `Ответ на вопрос №${
                    question.id
                  }: \nПравильно! Ты заработал ${totalPoints} очков! Попробуй ответить на следующий вопрос командой /quiz \n\n${
                    questions[questionId]
                      ? `Следующий вопрос будет доступен c ${new Date(
                          questions[questionId].date * 1000 + 10800000
                        ).toLocaleString('ru-RU')} по МСК`
                      : 'Это был последний вопрос'
                  }`,
                  {
                    chat_id: chatId,
                    message_id: message_id,
                  }
                )
                .then(() => {
                  canGetNextQuestion = true;
                });
            } else {
              bot.removeListener('callback_query');
              clearInterval(intervalId);
              return bot
                .editMessageText(
                  `Ответ на вопрос №${
                    question.id
                  }: \nМимо! Попробуй следующий вопрос командой /quiz \n\n${
                    questions[questionId]
                      ? `Следующий вопрос будет доступен c ${new Date(
                          questions[questionId].date * 1000 + 10800000
                        ).toLocaleString('ru-RU')} по МСК`
                      : 'Это был последний вопрос'
                  }`,
                  {
                    chat_id: chatId,
                    message_id: message_id,
                  }
                )
                .then(() => {
                  canGetNextQuestion = true;
                });
            }
          });
        });
    })
    .catch((error) => {
      console.log(error);
    });
};

const start = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync(); //{ force: true } to drop db
  } catch (e) {
    console.log('Error' + e);
  }

  bot.on('message', async (msg) => {
    canGetNextQuestion = true;
    const text = msg.text;
    const chatId = msg.chat.id;
    const username = msg.from.username;
    const firstName = msg.from.first_name;
    try {
      if (text === '/start') {
        let user;
        try {
          await UserModel.create({
            chatId: chatId,
            username: username,
          });
        } catch (error) {
          if (error.name === 'SequelizeUniqueConstraintError') {
            user = await UserModel.findOne({
              where: { chatId },
            });
            if (!user.username) {
              user.username = username;
              await user.save();
            }
            return bot.sendMessage(
              chatId,
              `Ты уже зарегистрирован. Выбери в меню вопрос или введи команду /quiz`
            );
          }
        }

        return bot.sendMessage(
          chatId,
          '👋Привет! \n\n🏟🏆<b>9 июля в Санкт-Петербурге пройдет Olimpbet Суперкубок России по футболу.</b> \n\n🤓 Специально к суперматчу «Зенит» – «Спартак» и старту нового сезона c 1 июля 10:00 по 5 июля 23:59 по МСК мы запускаем <b>«Olimpbet QUIZ»!</b> \n\n❗️Когда будешь готов начать игру, запускай вопросы командой /quiz. После этого у тебя будет всего 30 секунд, чтобы дать правильный ответ! Надо отвечать не только правильно, но и быстро – за это будут начисляться дополнительные баллы. Чем больше ты наберешь очков, тем выше будут твои шансы попасть на Olimpbet-Суперкубок 2022. \n\n🎁 <b>Пять игроков, которые наберут наибольшее количество баллов, получат по два билета на игру.</b>',
          { parse_mode: 'HTML' }
        );
      }
      if (text === '/rules') {
        return bot.sendMessage(
          chatId,
          `<b>Период акции:</b> с 1 по 5 июля 23:59 по МСК \n\n<b>Количество вопросов:</b> 15 вопросов, вопросы становятся доступными по одному с 1 по 5 июля в 10:00, 15:00, 20:00 по МСК \n\n<b>Время на ответ:</b> 30 секунд \n\n<b>Порядок начисления очков:</b> Базовая стоимость правильного ответа 60 очков. Конечное количество очков рассчитывается как сумма базовой стоимости и количества оставшихся секунд на ответ. \n\n<b>Подведение итогов: </b> 6 июля мы свяжемся с 5 игроками с наибольшим количеством очков.`,
          { parse_mode: 'HTML' }
        );
      }
      if (text === '/promo') {
        return bot.sendMessage(
          chatId,
          `<a href="https://www.olimp.bet/promo/welcome_1500/?utm_source=bot_quiz&utm_medium=refer">🎁1500 рублей без условий и депозита для новых клиентов</a> \n\n<a href="https://www.olimp.bet/promo/freebet/?utm_source=bot_quiz&utm_medium=refer">🤑30 000 рублей бонус на первый депозит для новых клиентов</a> \n\n<a href="https://www.olimp.bet/promo/bonus-club/?utm_source=bot_quiz&utm_medium=refer">🧰Вступай в бонус-клуб OLIMPBET и получай фрибеты, деньги на счет и кэшбэк до 20%!</a> \n\n<a href="https://www.olimp.bet/promo/bonus-na-express-100/?utm_source=bot_quiz&utm_medium=refer">🤩Собирай экспрессы OLIMPBET и получай бонус до 100% к выигрышу!</a>`,
          { parse_mode: 'HTML' }
        );
      }
      if (text === '/info') {
        const user = await UserModel.findOne({
          where: { chatId },
        });
        return bot.sendMessage(
          chatId,
          `Привет!👋 \n\n<b>Количество пройденных вопросов:</b> ${user.countAnswers} \n\n✅ <b>Количество набранных очков:</b> ${user.score} \n\nОтвечай правильно на вопросы и зарабатывай очки 🙌`,
          { parse_mode: 'HTML' }
        );
      }
      if (text === '/leaderboard') {
        const leaders = await UserModel.findAll({
          order: [['score', 'DESC']],
          group: ['user.id'],
          limit: 5,
          raw: true,
        });
        return bot.sendMessage(
          chatId,
          `ТОП-5 знатоков 🏆<b>OLIMPBET Суперкубка России</b>🏆:
          ${
            leaders.length !== 0
              ? `\n1️⃣ <b>${leaders[0].username}</b>, количество очков: ${leaders[0].score}`
              : 'Пока знатоков нет 🤷‍♂️'
          }
          ${
            leaders.length > 1
              ? `\n2️⃣ <b>${leaders[1].username}</b>, количество очков: ${leaders[1].score}`
              : ''
          }
          ${
            leaders.length > 2
              ? `\n3️⃣ <b>${leaders[2].username}</b>, количество очков: ${leaders[2].score}`
              : ''
          }
          ${
            leaders.length > 3
              ? `\n4️⃣ <b>${leaders[3].username}</b>, количество очков: ${leaders[3].score}`
              : ''
          }
          ${
            leaders.length > 4
              ? `\n5️⃣ <b>${leaders[4].username}</b>, количество очков: ${leaders[4].score}`
              : ''
          }`,
          { parse_mode: 'HTML' }
        );
      }
      if (text === '/quiz') {
        const user = await UserModel.findOne({
          where: { chatId },
        });
        if (!username) {
          return bot.sendMessage(
            chatId,
            '‼️ Необходимо открыть свой аккаунт в Telegram, указать свое имя пользователя в личных настройках, чтобы принять участие в «Olimpbet quiz», и мы могли связаться с победителями!',
            {
              parse_mode: 'HTML',
            }
          );
        }
        if (!user.username) {
          try {
            user.username = username;
            await user.save();
          } catch (e) {
            return bot.sendMessage(
              chatId,
              '‼️ Необходимо открыть свой аккаунт в Telegram, чтобы принять участие в «Olimpbet quiz», и мы могли связаться с победителями!',
              {
                parse_mode: 'HTML',
              }
            );
          }
        }
        if (!canGetNextQuestion) {
          return bot.sendMessage(
            chatId,
            'Необходимо ответить на предыдущий вопрос',
            {
              parse_mode: 'HTML',
            }
          );
        }
        const currentDate = new Date().getTime() / 1000;
        const canAnswer = user.countAnswers < questions.length;
        const availableQuestions = questions.filter(
          (q) => q.date < currentDate
        );
        if (currentDate > 1657054799 + 10800000) {
          return bot.sendMessage(
            chatId,
            'Время на ответы истекло, мы уже начали подводить итоги. \nТы можешь посмотреть свою статистику командой /info и общий зачет командой /leaderboard',
            {
              parse_mode: 'HTML',
            }
          );
        }
        if (!canAnswer) {
          return bot.sendMessage(
            chatId,
            'Это был последний вопрос. \nТы можешь посмотреть свою статистику командой /info и общий зачет командой /leaderboard',
            {
              parse_mode: 'HTML',
            }
          );
        }

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
          canGetNextQuestion = false;
          return startQuestion(chatId, user);
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
        'Я тебя не понимаю, попробуй воспользоваться меню'
      );
    } catch (e) {
      return bot.sendMessage(
        chatId,
        `Произошла ошибка: ${e}, попробуй еще раз. ChatId = ${chatId}`
      );
    }
  });
};
start();
