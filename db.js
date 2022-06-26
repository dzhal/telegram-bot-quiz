require('dotenv').config();
const { Sequelize } = require('sequelize');

module.exports = new Sequelize(
  process.env.BOT_QUIZ_DB_NAME,
  process.env.BOT_QUIZ_DB_LOGIN,
  process.env.BOT_QUIZ_DB_PASS,
  {
    host: process.env.BOT_QUIZ_HOST,
    port: process.env.BOT_QUIZ_PORT,
    dialect: 'postgres',
  }
);
