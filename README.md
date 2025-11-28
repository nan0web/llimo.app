# Тестування чату у файловому режимі (File-Based Chat Testing Toolkit)

Цей інструментарій дозволяє симулювати роботу чату LLiMo за допомогою попередньо записаних файлів з директорії чату. Це корисно для:
- Покриття тестами неочевидних сценаріїв (e.g., помилки сервера, специфічні чанки).
- Відтворення помилок від користувачів (вИ надсилаєте архів з файлами чату, і мИ відтворюємо).
- Автоматизованого тестування без реальних API викликів.

## Підтримувані файли чату
- **answer.md**: Повна відповідь AI.
- **chunks.json**: Масив чанків для симуляції стримінгу.
- ~~**me.md**: Ігнорується (користувацький ввід, не впливає на симуляцію).~~
- **messages.jsonl**: Перезаписує повідомлення чату.
- ~~**prompt.md**: Ігнорується (промпт вже запакований).~~
- **reason.md**: Контент міркування (reasoning).
- **response.json**: Допоміжні дані (usage, headers тощо).
- **stream.json**: Події стримінгу (fallback для chunks.json).
- **stream.md**: Додатковий текст стримінгу (додається до відповіді).
- **tests.txt**: Логується для дебагу (очікувані результати тестів).
- **todo.md**: Логується для дебагу (залишені завдання).
- **unknown.json**: Логується для дебагу (невідомі дані).

## Запуск інструментарію

### 1. Установка та базовий запуск
```bash
pnpm install  # Якщо потрібно
pnpm test:all  # Перевірити базові тести, включаючи TestAI
```

### 2. Симуляція чату з файлами (Test Mode)
Використовуйте флаг `--test` або `--test-dir` у `llimo-chat.js`:

- `--test=chat-id`: Використовує директорію з поточного чату (chat/chat-id).
- `--test-dir=/path/to/chat/dir`: Використовує зовнішню директорію (e.g., розпакований архів від користувача).
- `--input file.md`: Опціонально, надати промпт для симуляції (інакше використовується поточний).

Приклад відтворення помилки з архіву:
```bash
# Розпакуйте архів користувача в temp/chat-repro
unzip user-chat.zip -d temp/chat-repro

# Запустіть симуляцію
node bin/llimo-chat.js --test-dir=temp/chat-repro --input repro-prompt.md

# Або глобально
npx llimo-chat --test-dir=temp/chat-repro
```

Вивід:
- Симулює один крок чату з файлами.
- Виконує unpack, run tests, git (якщо потрібно).
- Логує дебаг (tests.txt тощо) у console.debug.
- Прогрес-бари та метрики (usage) базуються на файлах.

### 3. Створення тестових файлів для нових сценаріїв
Створіть директорію з файлами для тестування помилки/сценарію:

```bash
mkdir test-chat-scenario
cd test-chat-scenario

# Приклад файлів для симуляції помилки в чанках
cat > chunks.json << 'EOF'
[{"type": "text-delta", "text": "Partial response"}, {"type": "error", "text": "Simulated server error"}]
EOF

cat > answer.md << 'EOF'
Incomplete answer due to error.
EOF

cat > response.json << 'EOF'
{"usage": {"inputTokens": 100, "outputTokens": 50, "totalTokens": 150}, "error": "Simulated"}
EOF

cat > tests.txt << 'EOF'
Expected: Tests should handle partial response gracefully.
EOF
```

Запустіть:
```bash
node bin/llimo-chat.js --test-dir=test-chat-scenario --input test-prompt.md
```

### 4. Інтеграція з тестами
- **Автоматизовані тести**: Використовуйте `TestAI.test.js` як шаблон. Додавайте it() для конкретних сценаріїв з mkdtemp + writeFile.
- **CI/CD**: Додайте скрипт у package.json:
  ```bash
  pnpm test:scenario --test-dir=tests/scenarios/bug-repro
  ```
- **Відтворення від користувача**:
  1. Користувач надсилає архів (zip з chat dir).
  2. Розпакуйте: `unzip user-bug.zip -d repro/`.
  3. Запустіть: `node bin/llimo-chat.js --test-dir=repro --yes` (щоб автоматично unpack та test).
  4. Проаналізуйте лог: unpack помилок, test results, git changes.

### 5. Розширення (Future)
- `@todo`: Команда `llimo-test create <scenario>` для генерації шаблонів файлів.
- `@todo`: Плагін для vitest/jest інтеграції (e.g., test.each з chat dirs).
- `@todo`: Валідація файлів (e.g., ensure chunks.json має правильну структуру).

Цей toolkit покриває 100% сценаріїв на основі файлів чату, дозволяючи тестувати unpack, commands, tests без AI API.
