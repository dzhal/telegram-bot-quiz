const sequelize = require('./db');
const { DataTypes } = require('sequelize');

const User = sequelize.define('user', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    unique: true,
    autoIncrement: true,
  },
  chatId: { type: DataTypes.INTEGER, unique: true },
  username: { type: DataTypes.STRING },
  score: { type: DataTypes.INTEGER, defaultValue: 0 },
  countAnswers: { type: DataTypes.INTEGER, defaultValue: 0 },
});

module.exports = User;
