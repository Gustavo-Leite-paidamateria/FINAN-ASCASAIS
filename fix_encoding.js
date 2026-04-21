const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'src', 'models', 'index.js');
let content = fs.readFileSync(targetFile, 'utf8');

const replacements = {
    'AlimentaÃ§Ã£o': 'Alimentação',
    'SaÃºde': 'Saúde',
    'EducaÃ§Ã£o': 'Educação',
    'ðŸ›’': '🛒',
    'ðŸ •': '🍕',
    'ðŸš—': '🚗',
    'ðŸ  ': '🏠',
    'ðŸŽ®': '🎮',
    'ðŸ ¥': '🏥',
    'ðŸ ¾': '🐾',
    'ðŸ› ï¸ ': '🛍️',
    'ðŸ“š': '📚',
    'âœˆï¸ ': '✈️',
    'ðŸŽ ': '🎁',
    'ðŸ“ˆ': '📈',
    'ðŸ“º': '📺',
    'ðŸ“¦': '📦',
    'EmprÃ©stimo': 'Empréstimo',
    'CartÃ£o': 'Cartão'
};

for (const [bad, good] of Object.entries(replacements)) {
    // replaceAll equivalent using split and join to cover all occurrences
    content = content.split(bad).join(good);
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Fixed encoding in models/index.js');
