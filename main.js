const express = require('express');
const { program } = require('commander');
const fs = require('fs');
const path = require('path');


program
  .requiredOption('-h, --host <address>', 'Адреса сервера')
  .requiredOption('-p, --port <number>', 'Порт сервера')
  .requiredOption('-c, --cache <path>', 'Шлях до директорії з кешованими файлами');

program.parse(process.argv);


const options = program.opts();


const cachePath = path.resolve(options.cache);

if (!fs.existsSync(cachePath)) {
    console.log(`Директорія кешу '${options.cache}' не існує. Створюємо...`);
    try {
        fs.mkdirSync(cachePath, { recursive: true });
        console.log('Директорію успішно створено.');
    } catch (err) {
        console.error('Помилка при створенні директорії кешу:', err.message);
        process.exit(1);
    }
} else {
    console.log(`Використовується існуюча директорія кешу: ${cachePath}`);
}


const app = express();


app.use(express.json());

app.listen(options.port, options.host, () => {
    console.log(`\nСервер запущено!`);
    console.log(`Адреса: http://${options.host}:${options.port}`);
    console.log(`Кеш: ${options.cache}`);
});