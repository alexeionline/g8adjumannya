const INDEX_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const { ADD_PHRASES } = require('../constants/text');

function formatDisplayName(row) {
  if (row.username) {
    return row.username;
  }

  const parts = [row.first_name, row.last_name].filter(Boolean);
  if (parts.length) {
    return parts.join(' ');
  }

  return `User ${row.user_id}`;
}

function formatIndexEmoji(index) {
  return INDEX_EMOJIS[index] || `${index + 1}.`;
}

function formatProgressBar(count) {
  const totalBlocks = 5;
  const completedBlocks = Math.min(totalBlocks, Math.floor(count / 20));
  const remainingBlocks = totalBlocks - completedBlocks;
  return `${'🟢'.repeat(completedBlocks)}${'⚪'.repeat(remainingBlocks)}`;
}

function formatAddHeader(name) {
  const phrase = ADD_PHRASES[Math.floor(Math.random() * ADD_PHRASES.length)];
  return phrase.replace('username', name);
}

module.exports = {
  formatAddHeader,
  formatDisplayName,
  formatIndexEmoji,
  formatProgressBar,
};
