const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const MONGO_URI = process.env.MONGO_URI || 'твой_ключ_к_бд';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ База данных MongoDB успешно подключена!'))
  .catch(err => console.error('❌ Ошибка подключения к БД:', err));

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  balance: { type: Number, default: 1000 },
  stats: {
    totalGames: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    totalWon: { type: Number, default: 0 },
    totalLost: { type: Number, default: 0 }
  },
  history: { type: Array, default: [] }
});

const User = mongoose.model('User', userSchema);

app.get('/api/user/:telegramId', async (req, res) => {
  try {
    let user = await User.findOne({ telegramId: req.params.telegramId });
    if (!user) {
      user = new User({ telegramId: req.params.telegramId, balance: 1000 });
      await user.save();
    }
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/play', async (req, res) => {
  const { telegramId, bet, multiplier } = req.body;

  if (!telegramId || bet <= 0 || !multiplier) {
    return res.status(400).json({ error: 'Неверные данные запроса' });
  }

  try {
    const user = await User.findOne({ telegramId });
    if (!user || user.balance < bet) {
      return res.status(400).json({ error: 'Недостаточно средств на балансе' });
    }

    const chances = { 1.5: 55, 2: 42, 3: 26, 5: 15, 10: 7 };
    const winChance = chances[multiplier] || 42;
    const isWin = Math.random() * 100 < winChance;

    user.stats.totalGames += 1;
    let prize = 0;

    if (isWin) {
      prize = Math.round(bet * multiplier);
      user.balance += (prize - bet);
      user.stats.wins += 1;
      user.stats.totalWon += (prize - bet);
    } else {
      user.balance -= bet;
      user.stats.totalLost += bet;
    }

    const gameRecord = {
      id: Date.now(),
      win: isWin,
      mult: multiplier,
      amount: isWin ? prize : bet
    };

    user.history.unshift(gameRecord);
    if (user.history.length > 10) user.history.pop();

    await user.save();

    res.json({
      success: true,
      isWin,
      newBalance: user.balance,
      prize: isWin ? prize : bet,
      stats: user.stats,
      historyItem: gameRecord
    });

  } catch (e) {
    res.status(500).json({ error: 'Ошибка при обработке ставки' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер успешно запущен на порту ${PORT}`);
});
