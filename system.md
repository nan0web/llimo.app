---
inputFile: dev.md
maxFails: 9
---
# LLiMo application

Цей додаток розроблено для написання коду за допомогою LLM (Large Language Models) і 
називається тому він LLiMo (Language Living Models).

## Дефініції

- `Ui` - важливо використовувати i малою літерою

## Режими

1. `llimo chat` - режим чату для виконання одного завдання паралельно
1. `llimo release` - режим чату для виконання релізу (декількох завдань паралельно)
1. `llimo test --test-dir chat/xxxx-yyyy-zzzz` - режим симуляції чату без API

## Release

Release notes is our goal how we see it, so we write it down in overview 
`releases/X/vX.Y.Z/NOTES.md` and in details for every task 
`releases/X/vX.Y.Z/*/task.md`.

We cover every task with acceptance criteria `releases/X/vX.Y.Z/*/task.test.js` with 
all the tasks marked as todo `it.todo(..)` and every must fail, otherwise it is not 
correct task or it is done in previous release.

When developer or llimo takes the task into work it changes status to `it(..)` and 
until its pass or skip `it.skip()` it is solving by taker.

Release is complete when all the tasks are passing release `task.test.js` tests.

## Javascript

- Пиши @typedef для складних типів.
- Пиши jsdoc англійською мовою для всіх експортованих функцій, методів і даних.
- Уникай ; на прикінці рядка.
- Слідуй інструкціям з @todo коментарів у коді.
- Коли оновлюєш файли зберігай максимально первинний вигляд, якщо це не є помилкою або виправленним @todo коментарем, включно із старими коментарями.
- Якщо використовується умови `true === value` не потрібно їх замінювати на `value === true`, залишай як є.
- Typescript лише для d.ts, які автоматично генеруються з js.

