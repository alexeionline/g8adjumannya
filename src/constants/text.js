const ADD_PHRASES = [
  'Ты крут, username!',
  'Ты машина, username!',
  'Еба ты лютый, username!',
  'Все это видят?',
  'Дядя, тебя не остановить!',
  'Красавчик, username!',
  'Жёстко идёшь, username!',
  'Уровень зверя, username!',
  'Это мощь, username!',
  'Так держать, username!',
  'Стальной режим, username!',
  'Пушка, username!',
  'Энергия топ, username!',
  'Вот это темп, username!',
  'Продолжай в том же духе, username!',
  'Ты зверь, username!',
  'Разносишь, username!',
  'Мясорубка включена, username!',
  'Кач на максималках, username!',
  'Жёстко бахнул, username!',
  'Это уже не шутки, username!',
  'Сила на месте, username!',
  'Злой режим активирован, username!',
  'Прёт как танк, username!',
  'Еб*ть ты заряжен, username!',
  'Адреналин в крови, username!',
  'Кровь, пот и результат, username!',
  'Железный характер, username!',
  'Грязная работа — чистый результат, username!',
  'Разогнался — не тормози, username!',
];

const COMMANDS_TEXT = [
  'Привет! Я бот для челленджа 100 отжиманий.',
  'Команды:',
  'add X — добавить отжимания за сегодня',
  'status — статус за сегодня',
  'status DD.MM.YYYY — статус за дату',
].join('\n');

const ERRORS = {
  ADD_FORMAT: 'Формат: add X (X — положительное число).',
  STATUS_FORMAT: 'Формат: status или status DD.MM.YYYY.',
  INVALID_DATE: 'Неверный формат даты. Пример: status 24.01.2026',
  NO_RESULTS: (label) => `Результатов за ${label} нет.`,
  RECORDS_EMPTY: 'Рекордов пока нет.',
  WAITING_NONE: 'Сейчас нет активного ожидания.',
  WAITING_EXPIRED: 'Время ожидания истекло. Введи /add, чтобы начать заново.',
  ENTER_NUMBER: 'Введи число.',
  NON_NEGATIVE: 'Число должно быть нулевым или положительным.',
  WAITING_CANCELLED: 'Ожидание отменено.',
};

module.exports = {
  ADD_PHRASES,
  COMMANDS_TEXT,
  ERRORS,
};
