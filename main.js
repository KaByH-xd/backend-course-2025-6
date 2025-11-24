const express = require('express');
const { program } = require('commander');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');


program
  .requiredOption('-h, --host <address>', 'Адреса сервера')
  .requiredOption('-p, --port <number>', 'Порт сервера')
  .requiredOption('-c, --cache <path>', 'Шлях до директорії кешу');

program.parse(process.argv);
const options = program.opts();

const cachePath = path.resolve(options.cache);
if (!fs.existsSync(cachePath)) {
    console.log(`Директорія '${options.cache}' не існує. Створюємо...`);
    fs.mkdirSync(cachePath, { recursive: true });
}


const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Inventory API',
            version: '1.0.0',
            description: 'API сервісу інвентаризації (Лабораторна №6)',
        },
        servers: [
            {
                url: `http://${options.host}:${options.port}`,
                description: 'Main Server'
            }
        ],
    },
    apis: [__filename],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, cachePath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

let inventory = [];

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Реєстрація нового пристрою
 *     description: Приймає multipart/form-data. Створює запис і зберігає фото.
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *                 description: Назва речі (обов'язково)
 *               description:
 *                 type: string
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       '201':
 *         description: Created
 *       '400':
 *         description: Bad Request (Missing name)
 */
app.post('/register', upload.single('photo'), (req, res) => {
    const { inventory_name, description } = req.body;

    if (!inventory_name) {
        return res.status(400).send('Bad Request: inventory_name is required');
    }

    const newItem = {
        id: Date.now().toString(),
        name: inventory_name,
        description: description || '',
        photo: req.file ? req.file.filename : null
    };

    inventory.push(newItem);
    res.status(201).send('Created');
});

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Отримати список всіх речей
 *     responses:
 *       '200':
 *         description: Список у форматі JSON
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
app.get('/inventory', (req, res) => {
    const response = inventory.map(item => ({
        ...item,
        photoUrl: item.photo ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null
    }));
    res.status(200).json(response);
});

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Отримати інформацію про конкретну річ
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Інформація про річ
 *       '404':
 *         description: Not Found
 */
app.get('/inventory/:id', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    if (!item) return res.status(404).send('Not Found');

    const response = {
        ...item,
        photoUrl: item.photo ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null
    };
    res.status(200).json(response);
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Отримати фото речі
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Зображення (image/jpeg)
 *       '404':
 *         description: Фото або річ не знайдено
 */
app.get('/inventory/:id/photo', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);

    if (!item || !item.photo) return res.status(404).send('Not Found');

    const filePath = path.join(cachePath, item.photo);

    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found on disk');
    }
});

/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     summary: Оновити ім'я або опис
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Updated
 *       '404':
 *         description: Not Found
 */
app.put('/inventory/:id', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    if (!item) return res.status(404).send('Not Found');

    if (req.body.name) item.name = req.body.name;
    if (req.body.description) item.description = req.body.description;

    res.status(200).json(item);
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   put:
 *     summary: Оновити фото речі
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       '200':
 *         description: Photo updated
 *       '400':
 *         description: No file uploaded
 *       '404':
 *         description: Not Found
 */
app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    if (!item) return res.status(404).send('Not Found');

    if (!req.file) return res.status(400).send('No file uploaded');

    if (item.photo) {
        const oldPath = path.join(cachePath, item.photo);
        if (fs.existsSync(oldPath)) {
            try { fs.unlinkSync(oldPath); } catch (e) { console.error('Failed to remove old photo:', e); }
        }
    }

    item.photo = req.file.filename;
    res.status(200).send('Photo updated');
});

/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     summary: Видалити річ
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Deleted
 *       '404':
 *         description: Not Found
 */
app.delete('/inventory/:id', (req, res) => {
    const index = inventory.findIndex(i => i.id === req.params.id);
    if (index === -1) return res.status(404).send('Not Found');

    const [deletedItem] = inventory.splice(index, 1);

    if (deletedItem.photo) {
        const filePath = path.join(cachePath, deletedItem.photo);
        if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) { console.error(e); }
        }
    }

    res.status(200).send('Deleted');
});

/**
 * @swagger
 * /search:
 * post:
 * summary: Пошук пристрою за ID
 * requestBody:
 * content:
 * application/x-www-form-urlencoded:
 * schema:
 * type: object
 * properties:
 * id:
 * type: string
 * has_photo:
 * type: string
 * description: Прапорець (on/true)
 * responses:
 * 200:
 * description: Found
 * 404:
 * description: Not Found
 */
app.post('/search', (req, res) => {
    // ДІАГНОСТИКА
    console.log('--- SEARCH REQUEST ---');
    console.log('Отримані дані:', req.body);

    const { id } = req.body;
    
    // !!! ГОЛОВНЕ ВИПРАВЛЕННЯ !!!
    // Ми беремо значення або з has_photo, або з includePhoto.
    // Тепер не важливо, як називається поле в HTML.
    const rawPhotoParam = req.body.has_photo || req.body.includePhoto;

    const item = inventory.find(i => i.id === id);
    if (!item) return res.status(404).send('Not Found');

    let result = { ...item };

    // Перевіряємо галочку (враховуємо всі можливі варіанти "так")
    const showPhoto = rawPhotoParam === 'on' || rawPhotoParam === 'true' || rawPhotoParam === true;

    console.log('Чи показувати фото?', showPhoto);

    if (showPhoto) {
        const link = item.photo 
            ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` 
            : 'Фото не завантажено';
            
        result.description = `${result.description}. [Photo: ${link}]`;
    } else {
        delete result.photo; 
    }

    res.status(200).json(result);
});

app.get('/RegisterForm.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});

app.get('/SearchForm.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

app.use((req, res) => {
    res.status(405).send('Method not allowed');
});

app.listen(options.port, options.host, () => {
    console.log(`Сервер запущено: http://${options.host}:${options.port}`);
    console.log(`Документація API: http://${options.host}:${options.port}/docs`);
    console.log(`Кеш директорія: ${cachePath}`);
});
