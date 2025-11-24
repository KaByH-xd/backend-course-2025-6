const express = require('express');
const { program } = require('commander');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

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

app.get('/inventory', (req, res) => {
    const response = inventory.map(item => ({
        ...item,
        
        photoUrl: item.photo ? `/inventory/${item.id}/photo` : null
    }));
    res.status(200).json(response);
});

app.get('/inventory/:id', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    if (!item) return res.status(404).send('Not Found');

    res.status(200).json(item);
});

app.put('/inventory/:id', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    if (!item) return res.status(404).send('Not Found');

    if (req.body.name) item.name = req.body.name;
    if (req.body.description) item.description = req.body.description;

    res.status(200).json(item);
});

app.get('/inventory/:id/photo', (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    
    if (!item || !item.photo) return res.status(404).send('Not Found');

    const filePath = path.join(cachePath, item.photo);
    
    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
    const item = inventory.find(i => i.id === req.params.id);
    if (!item) return res.status(404).send('Not Found');

    if (!req.file) return res.status(400).send('No file uploaded');

    item.photo = req.file.filename;
    res.status(200).send('Photo updated');
});

app.delete('/inventory/:id', (req, res) => {
    const index = inventory.findIndex(i => i.id === req.params.id);
    if (index === -1) return res.status(404).send('Not Found');

    const [deletedItem] = inventory.splice(index, 1);
    
    if (deletedItem.photo) {
        const filePath = path.join(cachePath, deletedItem.photo);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    res.status(200).send('Deleted');
});

app.post('/search', (req, res) => {
    const { id, has_photo } = req.body;
    
    const item = inventory.find(i => i.id === id);
    if (!item) return res.status(404).send('Not Found');

    let result = { ...item };

    if (has_photo === 'on' || has_photo === 'true' || has_photo === true) {
        const link = item.photo ? `/inventory/${item.id}/photo` : 'No photo';
        result.description = `${result.description} (Photo: ${link})`;
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
    console.log(`Сервер працює на http://${options.host}:${options.port}`);
    console.log(`Папка кешу: ${cachePath}`);
});
