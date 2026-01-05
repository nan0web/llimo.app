1. Мені потрібно зробити так щоб можна було обирати моделі і провайдер.
1. Потрібно тестувати будь який код через сценарії логів. Тобто є можливість надіслати або зберегти лог з будь якого чату і протестувати без API чат, тобто запустити його емуляцію з логів, з можливістю запускати у різних режимах:
- імітація запуску (prompt) і автоматичної відповіді (chunks) у визначені терміни (швидкість відповіді), наприклад `llimo-chat-test chat/b651551f-8212-405a-a787-5634706f87a2 --step 3` - що має запустити з третього повідомлення user, або `llimo-chat-test chat/b651551f-8212-405a-a787-5634706f87a2 info` - показує інформацію стосовно повідомлень, їхньої ваги і можливість запустити тест з будь якого повідомлення
- імітація розпаковки `llimo-chat-test chat/b651551f-8212-405a-a787-5634706f87a2 --step 3 unpack --dir /tmp/unpack-chat`
- імітація тестування `llimo-chat-test chat/b651551f-8212-405a-a787-5634706f87a2 --step 3 test`
1. Розбий bin на методи, які імпортуються з `src/**` і покриті тестами на 100%.
1. Write node:tests with describe > it format.
1. Follow @todo comments in the code.
1. Add missing jsdoc in English in the code.

Що з цього всього вже працює (опиши як користуватись), а що ще потрібно інтегрувати (інтегруй).


This test must cover next scenarios:
1. Create a proper file structure of inputs, prompts, reasons, asnwers, chunks, messages > should get proper info
2. Run a test process (scenarios) with a delay to see all outputs as they should with the real API.
3. Scenarios:
3.1. Correct communication with correct tests. Just running a chat process including 
     packing input into prompt and assert equality with the original ones already saved,
     unpacking answers into files and commands, running tests (mocks) with predefined output.
3.2. Correct communication with failed 1st test iteration, 2nd iteration answer with fixes produces 100% correct tests.
3.3. Communication with 429 errors and proper timeout handlers or switching to another model.
3.4. Communication with errors by showing the error and if cannot continue process.exit(1).

4. split properly by \s+ but include \s+ in chunks
5. Add missing jsdoc in English in the code
6. Follow @todo comments in the code
7. Write node:tests with describe > it format.
8. Fix errors.

- [](bin/**)
- [](src/**)
- [](package.json)


---

Я хочу реалізувати дуже просту модульну систему чату.

`bin/llimo-chat.js` вже має таку послідовність з коментарями, яки починають з числа, є блоками (модулями), кожен такий блок може тестуватись окремо і підключатись як у реальному режимі так і у тестовому.

Вся логіка взаємодії файлів чату має реалізовуватись через чат: chat.save, chat.load, та інші.

Для тестування функціонала створюємо емітації, це тести, у яких є реальні сценарії і мИ їх можемо запустити через тест і побачити кожен слайд взаємодії. Можна виставляти швидкість потоків. У такому випадку замість реального API мИ використовуємо дані з файлів `chunks.jsonl`, `step/*/*` та інші.

Зроби рефакторинг даного проєкту щоб він відповідав вимогам:

1. Кожен модуль:
- логічно-лаконічний
- покритий тестами
- покритий емітаціями
1. Весь код документацію jsdoc англійською

- [](bin/**)
- [](src/**)
- [](package.json)
- [](README.md)

---

Потрібно перенести `scripts/**` у вже існуючі `bin/**`.

## LLiMo chat специфікація

Чат через консоль, або будь які інші інтерфейси, якщо забажаєте.

`bin/llimo-chat.js` має при встановленні використовуватись як `llimo`:
```bash
cd working-directory/to/allow/access/for/chat

# input data comes from the file me.md
llimo me.md

# input data comes from stdin dialogue (readline)
llimo

# input data comes from stdin stream
cat me.md > llimo 
llimo < cat me.md
grep | llimo
```

Можливо долучати файли до діалогу через:

	```markdown
	Дані можна знайти у файлах:

	- [](src/**)
	- [](package.json)
	```

Можливо виконувати команди:

	```markdown
	Дані можна знайти у файлах, якщо потрібно запитай які саме файли надати:

	- [@ls;-**/*.test.js](src/**)
	```

Всі доступні зараз команди у `src/llm/commands`, так само туди можна додавати ще.

Думаю, що потрібно використовувати ті команди `tools` які доступні через `ai-sdk`, також можна писати додаткові `tools` для `ai-sdk`.

Зараз файли додаються як текст у форматі markdown. У `ai-sdk` є можливість додавати файли у повідомлення окремо. Хотілось би це використовувати, як для файлів з текстом, та й для транскрипції аудіо, фото, пошуку по фото, наприклад:

	```markdown
	1. Дістань текст з `story` і використовуй його як сюжет.
	2. Підстав музику до відео з `audio`.
	3. Проаналізуй картинки з директорії `pictures/` створи з них відеоряд у відповідності до сюжету.
	4. Намалюй анімовані переходи між картинками.
	5. Формат олівець - скетч.
	6. Збережи відео у `cartoon@1080.mp4` у форматі 1980x1080 і друге відео з таким самим аудіо і відеорядом, тільки адаптоване під вертикальний формат `cartoon@1980.mp4` 1080x1980.

	- [](story.mp3)
	- [](audio.mp3)
	- [](pictures/**)
	```

```bash
llimo me.md 
```

### Комунікація з користувачем

Можливість створювати новий чат, якщо ще не існує зовсім чатів.

Можливість створювати новий чат за допомогою `llimo me.md --new`, зараз перезаписуються існуючий, а має створюватись новий, старий архівуватись, і значення `current` мінятись на новий.

Можливість продовжити будь який заархивований чат.

Заархивований чат має з двох файлів структуру:
```
chat/archive/a4/5a/a45aa0ca-9dd9-4529-a446-d5d87d372d14/chat.zip
chat/archive/a4/5a/a45aa0ca-9dd9-4529-a446-d5d87d372d14/chat.json
```

ID дуже довгі, їх потрібно поміняти на коротші
```js
const a = "a45aa0ca-9dd9-4529-a446-d5d87d372d14"
const b = String(a).split("-").map(
	s => parseInt(s, 16)
).map(n => n.toString(36)).join("-")
const c = Buffer.from(b)
const d = c.toString("base64")
console.info(a) // a45aa0ca-9dd9-4529-a446-d5d87d372d14
console.info(b) // 19lopmy-v6h-dnt-wg6-2bcfaouj9w
// Певно цього не достатньо. Можна обрізати теяку частину, або трансформувати base65
console.info(d) // MTlsb3BteS12NmgtZG50LXdnNi0yYmNmYW91ajl3
// Краще тоді зробити аналог для n => n.toString(64)
String("a45aa0ca-9dd9-4529-a446-d5d87d372d14").split("\n").map
```

Потрібно додати можливість виборів чатів і іменування чату автоматично. Тобто при кожному запиті до API потрібно прописати правило в інструкцію стосовно, для цього додаєм команду `@title` TitleCommand:

	```markdown
	У першій відповіді обовʼязово виконай команду `@title` з контентом, який буде мати назву цього чату за його контекстом. Заголовок має бути лаконічним і тою мовою, якою відбувається запит користувача.
	```

```bash
llimo ls

Current chat: What is the universe

Available 345 archived chat(s), recent 6 chat(s):
  Title                 Date         Time    File size   Context size
1 My passion            2025-12-10   16:20       235Kb       33,233KT
2 My goal               2025-12-09   14:30         1Kb           230T
3 Soup recipes          2025-12-09   14:00         3Kb         1,111T
4 How to run a bike     2025-12-08   22:00         6Kb         2,234T
5 Where to buy a bike   2025-12-08   15:00         9Kb         3,333T
6 How to build a bike   2025-12-09   11:00        12Kb         4,200T

Write a number of the recent chat 
  or filter by title 
	or empty to continue with the current "What is the universe"
% 
# тут користувач має можливість обрати чат з 1 по 6 + Enter, 
# або просто Enter, 
# або текст типу "holiday" і додаток має максимально швидко (on keypress) оновлювати 
# віконце зі зписком у 6 варіантів, якщо це номер 1-6, тоді просто залишити один з, 
# якщо це інший символ то виводити перші (максимум 5 + ...) де зустрічається цей символ
# після того, як користувач бачить у списку бажаний варіант він натискає Enter
# після цього знову зʼявляється повідомлення з мооивістю обрати номер зі списку, 
# якщо було більше одного елементу, якщо був один, то обирається він автоматично
```

При виборі чату архівується той який був активним і обраний розпаковується з архіву і продовжується стандартна взаємодія чату `llimo`.

Також потрібно додати команду `InfoCommand`

	```bash
	# дивимось використання чатом місця у активній директорії
	llimo info

	Available: 345 archived chat(s) and 1 current.
	Usage: 3Mb
	Context: 653,123T
	Cost: $3.341245

	# дивимось використання чатом місця у активній директорії і всіх вкладених чатів
	llimo info -r

	Available: 1,345 archived chat(s) and 3 current.
	Usage: 33Mb
	Context: 5,653,123T
	Cost: $23.341245
	```

Також потрібно додати команди видалення чату(ів) з архівів, або зачищення всіх

	```bash
	# якщо не вказано id то видаляє поточний чат
	llimo delete [id]

	# що видалити спеціально якийсь чат потрібно спочатку знайти його і зробити поточним
	llimo ls
	% 3
  # після того як обрали третій видаляємо поточний
	llimo delete

	# видаляємо всі чати
	llimo clear
	```

## Що робимо далі

1. Давай розібʼємо всі ці задачі на самі малі кроки (елементи, компоненти), які мИ можемо покрити тестами, і прикладами у `playground`, і документацією у `README.md.js`. Ці всі задачі потрібно структурувати у блоки. 
1. Давай створимо `releases/1/v1.1.0/index.test.js`, який в собі буде мати список всіх категорій і тестів для кожної задачі. `describe()` використовується для категорії, `it()` для задачі і перевірки її виконання, всі `describe.todo()` на початку і всі it мають повертати fail тестування, тому що вони не можуть бути виконані з початку запуску реліза в роботу, по мірі виконання вони мають змінювати свій результат тестування і при виконанні маємо міняти `it.todo()` на `it()`, якщо задача виконана і на `it.skip()` якщо задачу не вдалось виконати за визначену кількість ітерацій `задача → llimo → test:all → [if fail → llimo ...] → git checkout release-v1.1.0 → git merge taskID
1. Кожна задача має свою гілку з taskID тільки локально (поки що).
1. Кожен реліз має свою гілку з release-[version].
1. При запуску релізу у роботу всі `pnpm test:all` мають бути 0% fail, 0% cancelled.
1. Створюються гілки під кожну задачу і реліз, і послідовно переключаємось на гілку і виконуємо всі завдання у декілька ітерацій з тестуванням і merge при успішному виконанні.
1. Максимально близько інтегруємось у `ai-sdk` і використовуємо їхні інструменти, якщо такого ще немає, дописуємо своє.

Зараз підготовлюємо лише `releases/1/v1.1.0/**`


- [](bin/**)
- [](src/**)
- [](./scripts/batch-transcribe-api.js)
- [](package.json)
- [](README.md)


---

```bash
╭╴yaro::src/purejs/llimo.app
╰╴23:29 √ok % node bin/llimo-chat.js info

+ loaded 3 messages from existing chat a45aa0ca-9dd9-4529-a446-d5d87d372d14
Chat ID: a45aa0ca-9dd9-4529-a446-d5d87d372d14
No |  i | Role      | Files |     Size |  Tokens
-- | -- | ---       |   --- |      --- |     ---
 1 |  1 | system    |     6 |   5,757b |  1,352T
 2 |  1 | user      |    52 | 188,746b | 52,312T
 3 |  1 | assistant |     2 |   7,623b |  2,106T
   |    | TOTAL     |    60 | 202,126b | 55,770T

```

This is the info command.

1. I need to add an ability to read all the steps and show them here.
2. I need to add a column Cost with the proper calculation for every step and total calculations.
3. In release mode (llimo-release) we need to make test before first call and have a bit different calculation and storage in `chat/ID/steps/*/tests.json`, the view should be:
4. Update releases info if needed. We need to run v1.0.0 now and prepare v1.1.0 with release functionality.

	```bash
	No |  i | Role      | Files |     Size |  Tokens | Fail | Pass | Skip | Todo
	-- | -- | ---       |   --- |      --- |     --- |  --- |  --- |  --- |  ---
	 1 |  1 | system    |     6 |   5,757b |  1,352T |    0 |   22 |    0 |   12
	 2 |  1 | user      |    52 | 188,746b | 52,312T |      |      |      |
	 3 |  1 | assistant |     2 |   7,623b |  2,106T |    3 |   24 |    0 |    7
	   |    | TOTAL     |    60 | 202,126b | 55,770T |      |      |      |     
	```

- [](bin/llimo-chat.js)
- [](bin/llimo-release.js)
- [](src/**)
- [](releases/**)

---

Define the sequence of models/providers to use in different conditions, for instance until chat is reached 50KT use `gpt-oss-120b@cerebras`, until chat is reached 100KT use `gpt-oss-120b@huggingface/cerebras`, over 100KT use `grok-4-fast@openrouter`.

```bash
╭╴yaro::nan.web/apps/llimo.app
╰╴22:15 √ok % LLIMO_MODEL=gpt-oss-120b LLIMO_PROVIDER=cerebras node bin/llimo-chat.js me.md --debug --new
Debugger attached.

+ eaf74928-78eb-4da1-9496-60c32d33726c new chat created
+ system.md loaded 876b
  system instructions 5,801b
Loaded 464 inference models from 18 providers: cerebras, huggingface/cerebras, huggingface/cohere, huggingface/featherless-ai, huggingface/fireworks-ai, huggingface/groq, huggingface/hf-inference, huggingface/hyperbolic, huggingface/nebius, huggingface/novita, huggingface/nscale, huggingface/ovhcloud, huggingface/publicai, huggingface/sambanova, huggingface/scaleway, huggingface/together, huggingface/zai-org, openrouter

Multiple models match your criteria [model = gpt-oss-120b, provider = cerebras]:
  1) gpt-oss-120b (provider: cerebras)
  2) openai/gpt-oss-120b (provider: huggingface/cerebras)
```
