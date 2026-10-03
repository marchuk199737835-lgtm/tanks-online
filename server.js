const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

app.use(express.static(path.join(__dirname, 'public')));
const musicDir = path.join(__dirname, 'music');
if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir); 
const musicCategories = ['loby', 'dezmatch', 'survive', 'main']; let musicData = {};
musicCategories.forEach(cat => { const catDir = path.join(musicDir, cat); if (!fs.existsSync(catDir)) fs.mkdirSync(catDir, { recursive: true }); });
function scanMusic() { musicCategories.forEach(cat => { const catDir = path.join(musicDir, cat); musicData[cat] = fs.readdirSync(catDir).filter(f => f.endsWith('.mp3')).map(f => `${cat}/${f}`); }); }
scanMusic();
app.use('/music', express.static(musicDir));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const MAX_HP = 500; const BUFF_DURATION = 15000;
const mongoUri = process.env.MONGO_URI; let dbUsersCol = null; let dbUsers = {}; 

if (mongoUri) {
    const client = new MongoClient(mongoUri);
    client.connect().then(() => {
        console.log("✅ Підключено до MongoDB!");
        const db = client.db("tanks_db"); dbUsersCol = db.collection("users");
        dbUsersCol.find({}).toArray().then(users => { users.forEach(u => dbUsers[u.name] = u); console.log(`Завантажено акаунтів: ${users.length}`); });
    }).catch(err => console.error("❌ Помилка MongoDB:", err));
}

function saveUser(name) { if (dbUsersCol && dbUsers[name]) { dbUsersCol.updateOne({ name: name }, { $set: dbUsers[name] }, { upsert: true }); } }
function hashPwd(pwd) { return crypto.createHash('sha256').update(pwd).digest('hex'); }

const MAP_DATA = { 
    'площя': {
        size: 750, bg: '#4b5062', grid: '#393c47',
        solids: [
            {"type":"shape_rhombus","x":100,"y":100,"w":100,"h":100,"color":"#878787"}, {"type":"shape_rhombus","x":550,"y":100,"w":100,"h":100,"color":"#878787"},
            {"type":"shape_rhombus","x":100,"y":550,"w":100,"h":100,"color":"#878787"}, {"type":"shape_rhombus","x":550,"y":550,"w":100,"h":100,"color":"#878787"},
            {"type":"neon_cross","x":350,"y":350,"w":50,"h":50,"color":"#878787"},
            {"type":"spawn_player","x":150,"y":700}, {"type":"spawn_player","x":600,"y":700}, {"type":"spawn_player","x":150,"y":50}, {"type":"spawn_player","x":600,"y":50}, {"type":"spawn_player","x":250,"y":300}, {"type":"spawn_player","x":500,"y":450},
            {"type":"spawn_zombie","x":50,"y":550}, {"type":"spawn_zombie","x":50,"y":450}, {"type":"spawn_zombie","x":50,"y":350}, {"type":"spawn_zombie","x":50,"y":250}, {"type":"spawn_zombie","x":50,"y":150}, {"type":"spawn_zombie","x":50,"y":650},
            {"type":"spawn_zombie","x":700,"y":650}, {"type":"spawn_zombie","x":700,"y":550}, {"type":"spawn_zombie","x":700,"y":450}, {"type":"spawn_zombie","x":700,"y":350}, {"type":"spawn_zombie","x":700,"y":250}, {"type":"spawn_zombie","x":700,"y":150},
            {"type":"spawn_zombie","x":250,"y":500}, {"type":"spawn_zombie","x":500,"y":500}, {"type":"spawn_zombie","x":500,"y":200}, {"type":"spawn_zombie","x":250,"y":200},
            {"type":"spawn_powerup","x":250,"y":400}, {"type":"spawn_powerup","x":500,"y":350}, {"type":"spawn_powerup","x":50,"y":50}, {"type":"spawn_powerup","x":700,"y":50}, {"type":"spawn_powerup","x":700,"y":700}, {"type":"spawn_powerup","x":50,"y":700}
        ]
    },
    'epic_map': {
        size: 3000, bg: '#565a6c', grid: '#494d55',
        solids: [
            {"type":"wall_square","x":850,"y":1050,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":850,"y":1150,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":900,"y":1100,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":850,"y":1100,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":950,"y":1050,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":950,"y":1050,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":900,"y":1050,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1800,"y":1050,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1750,"y":1050,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1800,"y":1100,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1750,"y":1100,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1800,"y":1150,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":900,"y":1900,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":900,"y":1900,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":900,"y":1850,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":900,"y":1850,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":850,"y":1800,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":850,"y":1900,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":850,"y":1850,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":950,"y":1900,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1700,"y":1050,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1800,"y":1900,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1750,"y":1900,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1850,"y":1850,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1800,"y":1850,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1750,"y":1850,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1800,"y":1800,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1750,"y":1950,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1700,"y":1900,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1700,"y":1950,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1850,"y":1800,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1850,"y":1100,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1750,"y":1000,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1850,"y":1150,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":1700,"y":1000,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":800,"y":1100,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":800,"y":1150,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":900,"y":1000,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":950,"y":1000,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":800,"y":1850,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":950,"y":1950,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":900,"y":1950,"w":50,"h":50,"color":"#353940"}, {"type":"wall_square","x":800,"y":1800,"w":50,"h":50,"color":"#353940"},
            {"type":"shape_rhombus","x":1150,"y":1300,"w":400,"h":400,"color":"#353940"}, {"type":"shape_rhombus","x":1250,"y":1350,"w":200,"h":300,"color":"#22252a"},
            {"type":"tree","x":0,"y":700,"r":424.26}, {"type":"tree","x":2650,"y":2550,"r":180.27}, {"type":"tree","x":300,"y":2400,"r":158.11}, {"type":"tree","x":2850,"y":750,"r":364.00},
            {"type":"neon_circle","x":850,"y":1100,"w":50,"h":50,"color":"#21252c"}, {"type":"neon_circle","x":900,"y":1050,"w":50,"h":50,"color":"#21252c"}, {"type":"neon_circle","x":1750,"y":1050,"w":50,"h":50,"color":"#21252c"}, {"type":"neon_circle","x":1800,"y":1100,"w":50,"h":50,"color":"#21252c"}, {"type":"neon_circle","x":1800,"y":1850,"w":50,"h":50,"color":"#21252c"}, {"type":"neon_circle","x":1750,"y":1900,"w":50,"h":50,"color":"#21252c"}, {"type":"neon_circle","x":850,"y":1850,"w":50,"h":50,"color":"#21252c"}, {"type":"neon_circle","x":900,"y":1900,"w":50,"h":50,"color":"#21252c"},
            {"type":"wall_square","x":1250,"y":2200,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":1300,"y":2200,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":1350,"y":2200,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":1400,"y":2200,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":1300,"y":2250,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":1250,"y":2250,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":1350,"y":2250,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":1450,"y":2250,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":1400,"y":2250,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":1200,"y":2250,"w":50,"h":50,"color":"#21252c"},
            {"type":"wall_square","x":550,"y":1400,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":550,"y":1450,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":550,"y":1500,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":550,"y":1550,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":500,"y":1400,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":500,"y":1350,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":500,"y":1450,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":500,"y":1500,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":500,"y":1550,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":500,"y":1600,"w":50,"h":50,"color":"#21252c"},
            {"type":"wall_square","x":2100,"y":1400,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":2100,"y":1450,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":2100,"y":1500,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":2100,"y":1550,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":2150,"y":1350,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":2150,"y":1400,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":2150,"y":1450,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":2150,"y":1500,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":2150,"y":1550,"w":50,"h":50,"color":"#21252c"}, {"type":"wall_square","x":2150,"y":1600,"w":50,"h":50,"color":"#21252c"},
            {"type":"line","points":[{"x":136,"y":955},{"x":130,"y":956},{"x":124,"y":956},{"x":122,"y":956},{"x":120,"y":956},{"x":115,"y":956},{"x":112,"y":956},{"x":102,"y":956},{"x":99,"y":956},{"x":98,"y":957},{"x":98,"y":959},{"x":98,"y":960},{"x":98,"y":961},{"x":98,"y":964},{"x":98,"y":966},{"x":98,"y":967},{"x":98,"y":968},{"x":98,"y":971},{"x":98,"y":973},{"x":98,"y":974},{"x":98,"y":976},{"x":98,"y":976},{"x":98,"y":978},{"x":98,"y":980},{"x":98,"y":983},{"x":98,"y":984},{"x":98,"y":985},{"x":98,"y":987},{"x":98,"y":988},{"x":99,"y":992},{"x":99,"y":993},{"x":99,"y":995},{"x":99,"y":997},{"x":99,"y":998},{"x":99,"y":1000},{"x":99,"y":1000},{"x":99,"y":1001},{"x":99,"y":1002},{"x":99,"y":1004},{"x":99,"y":1005},{"x":101,"y":1007},{"x":101,"y":1009},{"x":101,"y":1011},{"x":101,"y":1012},{"x":101,"y":1014},{"x":102,"y":1015},{"x":102,"y":1016},{"x":102,"y":1018},{"x":102,"y":1019},{"x":102,"y":1021},{"x":102,"y":1022},{"x":102,"y":1024},{"x":102,"y":1025},{"x":102,"y":1026},{"x":102,"y":1028},{"x":102,"y":1029},{"x":102,"y":1031},{"x":102,"y":1032},{"x":99,"y":1032},{"x":95,"y":1032},{"x":89,"y":1032},{"x":83,"y":1031},{"x":81,"y":1029},{"x":80,"y":1029},{"x":76,"y":1029},{"x":75,"y":1029}],"color":"#21252c","width":16},
            {"type":"prop_crate","x":3000,"y":2950,"w":50,"h":50}, {"type":"prop_crate","x":2200,"y":1000,"w":100,"h":100}, {"type":"prop_crate","x":450,"y":1100,"w":100,"h":100}, {"type":"prop_crate","x":350,"y":1850,"w":250,"h":100}, {"type":"prop_crate","x":700,"y":2500,"w":300,"h":100}, {"type":"prop_crate","x":1800,"y":2200,"w":100,"h":100},
            {"type":"spawn_powerup","x":1600,"y":1700}, {"type":"spawn_powerup","x":1100,"y":1250}, {"type":"spawn_powerup","x":850,"y":2700}, {"type":"spawn_powerup","x":150,"y":2150}, {"type":"spawn_powerup","x":800,"y":1000}, {"type":"spawn_powerup","x":750,"y":2000}, {"type":"spawn_powerup","x":1950,"y":2000}, {"type":"spawn_powerup","x":1900,"y":1000},
            {"type":"spawn_player","x":250,"y":2750}, {"type":"spawn_player","x":2850,"y":2850}, {"type":"spawn_player","x":1500,"y":2750},
            {"type":"wall_square","x":1100,"y":2800,"w":100,"h":200,"color":"#31363f"}, {"type":"wall_square","x":1900,"y":2650,"w":400,"h":150,"color":"#31363f"}, {"type":"wall_square","x":2650,"y":1550,"w":100,"h":350,"color":"#31363f"}, {"type":"wall_square","x":450,"y":2700,"w":150,"h":150,"color":"#31363f"}
        ]
    },
    'Бравл_map': {
        size: 1700, bg: '#aaa43c', grid: '#83ae32',
        solids: [
            {"type":"water_curve","x":1700,"y":950,"w":50,"h":50}, {"type":"water_curve","x":350,"y":800,"w":950,"h":150}, {"type":"water_square","x":1700,"y":1000,"w":50,"h":50}, {"type":"water_square","x":1700,"y":950,"w":50,"h":50}, {"type":"water_curve","x":600,"y":650,"w":500,"h":450}, {"type":"water_curve","x":250,"y":1250,"w":150,"h":150}, {"type":"water_curve","x":1200,"y":200,"w":300,"h":250}, {"type":"water_square","x":650,"y":0,"w":150,"h":800}, {"type":"water_square","x":800,"y":1050,"w":200,"h":650}, {"type":"water_curve","x":950,"y":550,"w":200,"h":300}, {"type":"water_curve","x":600,"y":950,"w":200,"h":150}, {"type":"water_square","x":0,"y":800,"w":100,"h":150}, {"type":"water_curve","x":50,"y":800,"w":100,"h":150}, {"type":"water_square","x":1700,"y":950,"w":50,"h":50}, {"type":"water_square","x":1700,"y":1000,"w":50,"h":50}, {"type":"water_square","x":1700,"y":950,"w":50,"h":50}, {"type":"water_square","x":1500,"y":800,"w":200,"h":150}, {"type":"water_curve","x":1450,"y":800,"w":100,"h":150}, {"type":"prop_sandbag","x":550,"y":300,"w":50,"h":150}, {"type":"prop_sandbag","x":850,"y":550,"w":100,"h":50}, {"type":"prop_sandbag","x":850,"y":50,"w":50,"h":150}, {"type":"prop_sandbag","x":850,"y":450,"w":50,"h":100}, {"type":"prop_sandbag","x":1350,"y":0,"w":50,"h":150}, {"type":"prop_sandbag","x":1300,"y":250,"w":150,"h":50}, {"type":"prop_sandbag","x":1300,"y":250,"w":50,"h":100}, {"type":"prop_sandbag","x":1400,"y":600,"w":250,"h":100}, {"type":"prop_sandbag","x":1100,"y":400,"w":50,"h":100}, {"type":"prop_sandbag","x":1350,"y":1050,"w":250,"h":100}, {"type":"prop_sandbag","x":1050,"y":1100,"w":50,"h":250}, {"type":"prop_sandbag","x":1100,"y":1700,"w":50,"h":50}, {"type":"prop_sandbag","x":1050,"y":1550,"w":50,"h":150}, {"type":"prop_sandbag","x":1250,"y":1400,"w":250,"h":100}, {"type":"prop_sandbag","x":550,"y":0,"w":50,"h":100}, {"type":"prop_sandbag","x":450,"y":700,"w":150,"h":50}, {"type":"prop_sandbag","x":100,"y":250,"w":250,"h":100}, {"type":"prop_sandbag","x":0,"y":600,"w":250,"h":50}, {"type":"prop_sandbag","x":200,"y":850,"w":100,"h":50}, {"type":"prop_sandbag","x":350,"y":1050,"w":150,"h":50}, {"type":"prop_sandbag","x":650,"y":1200,"w":50,"h":150}, {"type":"prop_sandbag","x":500,"y":1500,"w":100,"h":150}, {"type":"prop_sandbag","x":0,"y":1400,"w":200,"h":50}, {"type":"prop_sandbag","x":100,"y":1050,"w":100,"h":50}, {"type":"water_curve","x":0,"y":0,"w":100,"h":100}, {"type":"water_square","x":0,"y":0,"w":50,"h":50}, {"type":"water_square","x":0,"y":50,"w":50,"h":50}, {"type":"water_square","x":50,"y":0,"w":50,"h":50}, {"type":"water_square","x":1650,"y":0,"w":50,"h":50}, {"type":"water_square","x":1650,"y":50,"w":50,"h":50}, {"type":"water_square","x":1650,"y":0,"w":50,"h":50}, {"type":"water_square","x":1600,"y":0,"w":50,"h":50}, {"type":"water_curve","x":1600,"y":0,"w":50,"h":100}, {"type":"water_curve","x":1600,"y":50,"w":100,"h":50}, {"type":"water_curve","x":1550,"y":1550,"w":150,"h":150}, {"type":"water_square","x":1700,"y":1650,"w":50,"h":50}, {"type":"water_square","x":1700,"y":1650,"w":50,"h":50}, {"type":"water_square","x":1700,"y":1700,"w":50,"h":50}, {"type":"water_square","x":1700,"y":1700,"w":50,"h":50}, {"type":"water_square","x":1700,"y":1700,"w":50,"h":50}, {"type":"water_square","x":1700,"y":1600,"w":50,"h":50}, {"type":"water_square","x":1650,"y":1600,"w":50,"h":50}, {"type":"water_square","x":1650,"y":1600,"w":50,"h":50}, {"type":"water_square","x":1700,"y":1550,"w":50,"h":50}, {"type":"water_square","x":1700,"y":1550,"w":50,"h":50}, {"type":"water_square","x":1700,"y":1600,"w":50,"h":50}, {"type":"water_square","x":1600,"y":1600,"w":100,"h":100}, {"type":"water_square","x":1550,"y":1650,"w":100,"h":50}, {"type":"water_square","x":1650,"y":1550,"w":50,"h":50}, {"type":"water_square","x":0,"y":1600,"w":100,"h":100}, {"type":"water_curve","x":0,"y":1500,"w":100,"h":200}, {"type":"water_square","x":0,"y":1500,"w":50,"h":50}, {"type":"water_square","x":0,"y":1500,"w":50,"h":50}, {"type":"water_square","x":0,"y":1500,"w":50,"h":50}, {"type":"water_square","x":0,"y":1450,"w":50,"h":50}, {"type":"water_curve","x":700,"y":1500,"w":200,"h":200}, {"type":"water_square","x":750,"y":1700,"w":50,"h":50}, {"type":"water_square","x":750,"y":1650,"w":50,"h":50}, {"type":"water_square","x":750,"y":1650,"w":50,"h":50}, {"type":"water_square","x":750,"y":1650,"w":50,"h":50}, {"type":"water_square","x":750,"y":1650,"w":50,"h":50}, {"type":"water_square","x":700,"y":1650,"w":50,"h":50}, {"type":"water_square","x":700,"y":1650,"w":50,"h":50}, {"type":"water_square","x":700,"y":1650,"w":50,"h":50}, {"type":"water_square","x":700,"y":1600,"w":50,"h":50},
            {"type":"spawn_player","x":200,"y":200}, {"type":"spawn_player","x":1350,"y":1250}, {"type":"spawn_player","x":400,"y":1450}, {"type":"spawn_powerup","x":500,"y":1250}, {"type":"spawn_powerup","x":300,"y":450}, {"type":"spawn_powerup","x":1250,"y":500}, {"type":"spawn_powerup","x":1350,"y":1350}, {"type":"spawn_player","x":1150,"y":300}
        ]
    },
    'Бій Насмерть': {
        size: 2500, bg: '#3e2604', grid: '#1e293b',
        solids: [
            {"type":"prop_crate","x":550,"y":1300,"w":50,"h":50}, {"type":"prop_crate","x":550,"y":1300,"w":50,"h":50}, {"type":"prop_crate","x":500,"y":1300,"w":50,"h":50}, {"type":"prop_crate","x":550,"y":1300,"w":50,"h":50}, {"type":"prop_crate","x":500,"y":1250,"w":50,"h":50}, {"type":"prop_crate","x":500,"y":1200,"w":50,"h":50}, {"type":"prop_crate","x":650,"y":1300,"w":50,"h":50}, {"type":"prop_crate","x":650,"y":1300,"w":50,"h":50}, {"type":"prop_crate","x":650,"y":1300,"w":50,"h":50}, {"type":"prop_crate","x":650,"y":1300,"w":50,"h":50}, {"type":"prop_crate","x":600,"y":1300,"w":50,"h":50}, {"type":"prop_crate","x":750,"y":1300,"w":50,"h":50}, {"type":"prop_crate","x":700,"y":1300,"w":50,"h":50}, {"type":"prop_crate","x":800,"y":1300,"w":50,"h":50}, {"type":"prop_crate","x":550,"y":950,"w":50,"h":50}, {"type":"prop_crate","x":600,"y":950,"w":50,"h":50}, {"type":"prop_crate","x":650,"y":950,"w":50,"h":50}, {"type":"prop_crate","x":750,"y":950,"w":50,"h":50}, {"type":"prop_crate","x":700,"y":950,"w":50,"h":50}, {"type":"prop_crate","x":800,"y":950,"w":50,"h":50}, {"type":"prop_crate","x":850,"y":950,"w":50,"h":50}, {"type":"prop_crate","x":850,"y":1050,"w":50,"h":50}, {"type":"prop_crate","x":850,"y":1050,"w":50,"h":50}, {"type":"prop_crate","x":850,"y":1000,"w":50,"h":50}, {"type":"prop_crate","x":850,"y":1450,"w":50,"h":50}, {"type":"prop_crate","x":850,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":900,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":950,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":950,"y":1450,"w":50,"h":50}, {"type":"prop_crate","x":500,"y":1450,"w":50,"h":50}, {"type":"prop_crate","x":500,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":500,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":500,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":450,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":450,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":450,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":400,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":400,"y":1450,"w":50,"h":50}, {"type":"prop_barrel","x":450,"y":1450,"w":50,"h":50}, {"type":"prop_barrel","x":900,"y":1450,"w":50,"h":50}, {"type":"prop_bush","x":350,"y":1450,"w":50,"h":50}, {"type":"prop_bush","x":350,"y":1500,"w":50,"h":50}, {"type":"prop_bush","x":250,"y":1450,"w":50,"h":50}, {"type":"prop_bush","x":250,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":200,"y":1450,"w":50,"h":50}, {"type":"prop_crate","x":200,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":200,"y":1450,"w":50,"h":50}, {"type":"prop_crate","x":150,"y":1450,"w":50,"h":50}, {"type":"prop_crate","x":150,"y":1500,"w":50,"h":50}, {"type":"prop_bush","x":1000,"y":1450,"w":50,"h":50}, {"type":"prop_bush","x":1000,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":1150,"y":1450,"w":50,"h":50}, {"type":"prop_crate","x":1200,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":1200,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":1200,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":1200,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":1200,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":1150,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":1200,"y":1500,"w":50,"h":50}, {"type":"prop_crate","x":1200,"y":1450,"w":50,"h":50}, {"type":"prop_bush","x":1100,"y":1450,"w":50,"h":50}, {"type":"prop_bush","x":1100,"y":1500,"w":50,"h":50}, {"type":"prop_barrel","x":1100,"y":1250,"w":50,"h":50}, {"type":"prop_barrel","x":300,"y":1200,"w":50,"h":50}, {"type":"prop_barrel","x":1100,"y":1050,"w":50,"h":50}, {"type":"prop_barrel","x":300,"y":1000,"w":50,"h":50}, {"type":"prop_crate","x":1200,"y":1050,"w":50,"h":50}, {"type":"prop_crate","x":1150,"y":1050,"w":50,"h":50}, {"type":"prop_crate","x":1200,"y":1000,"w":50,"h":50}, {"type":"prop_crate","x":1150,"y":1250,"w":50,"h":50}, {"type":"prop_crate","x":1200,"y":1250,"w":50,"h":50}, {"type":"prop_crate","x":1200,"y":1300,"w":50,"h":50}, {"type":"prop_bush","x":1200,"y":1200,"w":50,"h":50}, {"type":"prop_bush","x":1200,"y":1100,"w":50,"h":50}, {"type":"prop_crate","x":250,"y":1200,"w":50,"h":50}, {"type":"prop_crate","x":200,"y":1200,"w":50,"h":50}, {"type":"prop_crate","x":200,"y":1250,"w":50,"h":50}, {"type":"prop_crate","x":250,"y":1000,"w":50,"h":50}, {"type":"prop_crate","x":200,"y":1000,"w":50,"h":50}, {"type":"prop_crate","x":200,"y":950,"w":50,"h":50}, {"type":"prop_bush","x":250,"y":1050,"w":50,"h":50}, {"type":"prop_bush","x":250,"y":1150,"w":50,"h":50}, {"type":"prop_crate","x":200,"y":700,"w":50,"h":50}, {"type":"prop_crate","x":200,"y":750,"w":50,"h":50}, {"type":"prop_crate","x":250,"y":700,"w":50,"h":50}, {"type":"prop_crate","x":250,"y":750,"w":50,"h":50}, {"type":"prop_crate","x":450,"y":700,"w":50,"h":50}, {"type":"prop_crate","x":450,"y":750,"w":50,"h":50}, {"type":"prop_barrel","x":500,"y":750,"w":50,"h":50}, {"type":"prop_barrel","x":550,"y":750,"w":50,"h":50}, {"type":"prop_barrel","x":800,"y":750,"w":50,"h":50}, {"type":"prop_barrel","x":850,"y":750,"w":50,"h":50}, {"type":"prop_crate","x":900,"y":750,"w":50,"h":50}, {"type":"prop_crate","x":900,"y":700,"w":50,"h":50}, {"type":"prop_crate","x":1100,"y":700,"w":50,"h":50}, {"type":"prop_crate","x":1100,"y":750,"w":50,"h":50}, {"type":"prop_crate","x":1150,"y":700,"w":50,"h":50}, {"type":"prop_crate","x":1150,"y":750,"w":50,"h":50}, {"type":"water_square","x":500,"y":1650,"w":400,"h":100}, {"type":"prop_bush","x":900,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":850,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":800,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":800,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":750,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":750,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":750,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":700,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":700,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":700,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":650,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":650,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":600,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":600,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":600,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":550,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":550,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":500,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":500,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":500,"y":1750,"w":50,"h":50}, {"type":"prop_bush","x":450,"y":1750,"w":50,"h":50}, {"type":"water_square","x":450,"y":500,"w":50,"h":50}, {"type":"water_square","x":900,"y":500,"w":50,"h":50}, {"type":"prop_barrel","x":950,"y":500,"w":50,"h":50}, {"type":"prop_barrel","x":400,"y":500,"w":50,"h":50}, {"type":"prop_barrel","x":450,"y":1700,"w":50,"h":50}, {"type":"prop_barrel","x":450,"y":1650,"w":50,"h":50}, {"type":"prop_barrel","x":900,"y":1650,"w":50,"h":50}, {"type":"prop_barrel","x":900,"y":1700,"w":50,"h":50}, {"type":"water_square","x":450,"y":550,"w":500,"h":50}, {"type":"water_square","x":500,"y":500,"w":400,"h":50}, {"type":"prop_barrel","x":400,"y":550,"w":50,"h":50}, {"type":"prop_barrel","x":950,"y":550,"w":50,"h":50}, {"type":"prop_bush","x":400,"y":450,"w":50,"h":50}, {"type":"prop_bush","x":450,"y":450,"w":50,"h":50}, {"type":"prop_bush","x":500,"y":450,"w":50,"h":50}, {"type":"prop_bush","x":550,"y":450,"w":50,"h":50}, {"type":"prop_bush","x":600,"y":450,"w":50,"h":50}, {"type":"prop_bush","x":650,"y":450,"w":50,"h":50}, {"type":"prop_bush","x":700,"y":450,"w":50,"h":50}, {"type":"prop_bush","x":750,"y":450,"w":50,"h":50}, {"type":"prop_bush","x":800,"y":450,"w":50,"h":50}, {"type":"prop_bush","x":850,"y":450,"w":50,"h":50}, {"type":"prop_bush","x":900,"y":450,"w":50,"h":50}, {"type":"prop_bush","x":950,"y":450,"w":50,"h":50}, {"type":"prop_crate","x":0,"y":0,"w":350,"h":150}, {"type":"prop_crate","x":1300,"y":0,"w":350,"h":150}, {"type":"prop_crate","x":1300,"y":2350,"w":350,"h":150}, {"type":"prop_crate","x":0,"y":2350,"w":350,"h":150},
            {"type":"spawn_player","x":1400,"y":1450}, {"type":"spawn_player","x":100,"y":1350}, {"type":"spawn_player","x":1400,"y":750}, {"type":"spawn_player","x":100,"y":700},
            {"type":"spawn_zombie","x":1300,"y":250}, {"type":"spawn_zombie","x":200,"y":200}, {"type":"spawn_zombie","x":1450,"y":1950}, {"type":"spawn_zombie","x":250,"y":1950},
            {"type":"spawn_powerup","x":400,"y":850}, {"type":"spawn_powerup","x":1200,"y":850}, {"type":"spawn_powerup","x":1000,"y":1350}, {"type":"spawn_powerup","x":400,"y":1300}
        ]
    }
};

function checkCollisionServer(mapName, x, y, r) { 
    let cMap = MAP_DATA[mapName] ? mapName : 'площя'; let mSize = MAP_DATA[cMap].size; 
    if (x - r < 0 || x + r > mSize || y - r < 0 || y + r > mSize) return true; 
    for(let s of MAP_DATA[cMap].solids) { 
        if(s.type.includes('spawn') || s.type === 'line' || s.type === 'prop_puddle' || s.type === 'prop_crater') continue;
        
        if(s.type === 'tree' || s.type === 'neon_circle' || s.type === 'neon_pillar') { 
            let cx = s.x + (s.w ? s.w/2 : 0); let cy = s.y + (s.h ? s.h/2 : 0); let sr = s.r || (s.w ? s.w/2 : 30);
            if(Math.hypot(x - cx, y - cy) <= r + sr) return true; 
        } 
        else { 
            let testX = Math.max(s.x, Math.min(x, s.x+(s.w||30))), testY = Math.max(s.y, Math.min(y, s.y+(s.h||30))); 
            if(Math.hypot(x-testX, y-testY) <= r) return true; 
        } 
    } return false; 
}

function getValidSpawn(mapName, r, typeStr = 'spawn_player') { 
    let cMap = MAP_DATA[mapName] ? mapName : 'площя'; let mSize = MAP_DATA[cMap].size;
    let spawnPoints = MAP_DATA[cMap].solids.filter(s => s.type === typeStr);
    
    if (spawnPoints.length > 0) {
        let attempts = 0;
        while(attempts < 50) {
            let sp = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
            let sx = sp.x + (Math.random() * 20 - 10); let sy = sp.y + (Math.random() * 20 - 10);
            if (!checkCollisionServer(cMap, sx, sy, r)) return {x: sx, y: sy};
            attempts++;
        }
        let sp = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
        return {x: sp.x, y: sp.y};
    }
    
    for(let i=0; i<100; i++) { let x = Math.random()*(mSize-200)+100; let y = Math.random()*(mSize-200)+100; if(!checkCollisionServer(cMap, x, y, r + 20)) return {x, y}; } return {x: mSize/2, y: mSize/2}; 
}

function getValidEdgeSpawn(mapName, r, typeStr = 'spawn_zombie') { 
    let cMap = MAP_DATA[mapName] ? mapName : 'площя'; let mSize = MAP_DATA[cMap].size;
    let spawnPoints = MAP_DATA[cMap].solids.filter(s => s.type === typeStr);
    if (spawnPoints.length > 0) return getValidSpawn(mapName, r, typeStr);

    for(let i=0; i<100; i++) { let x = Math.random() < 0.5 ? 50 : mSize-50; let y = Math.random() * (mSize - 100) + 50; if(!checkCollisionServer(cMap, x, y, r + 20)) return {x, y}; }
    return getValidSpawn(mapName, r); 
}

let rooms = {}; let globalPlayers = {}; 
const Z_TYPES = { 'normal': { hp: 25, speed: 120, dmg: 10, radius: 15, color: '#22c55e' }, 'runner': { hp: 15, speed: 250, dmg: 5, radius: 12, color: '#84cc16' }, 'tanker': { hp: 100, speed: 60, dmg: 25, radius: 25, color: '#15803d' }, 'spitter': { hp: 40, speed: 90, dmg: 15, radius: 15, color: '#a3e635', ranged: true }, 'bomber': { hp: 30, speed: 140, dmg: 50, radius: 18, color: '#dc2626', explode: true }, 'ghost': { hp: 20, speed: 100, dmg: 10, radius: 15, color: '#cbd5e1', ghost: true }, 'pikus': { isBoss: true, name: 'ПІКУС', hp: 1000, speed: 294, dmg: 100, radius: 30, color: '#9333ea', bullets: 3, cd: 3000 }, 'shurik': { isBoss: true, name: 'ШУРІК', hp: 2000, speed: 280, dmg: 100, radius: 22.5, color: '#f43f5e', bullets: 10, cd: 3000 }, 'oneshot': { isBoss: true, name: 'ВАНШОТУС', hp: 3000, speed: 294, dmg: 1000, radius: 30, color: '#fbbf24', bullets: 2, cd: 2000 }, 'padlo': { isBoss: true, name: 'ПАДЛО', hp: 5000, speed: 280, dmg: 75, radius: 15, color: '#10b981', bullets: 25, cd: 1500 } };

const RARITY_PRICES = { 'common': 5, 'rare': 10, 'epic': 50, 'legendary': 250 };
const ALL_MODULES = ['can_c1','can_c2','can_c3','can_r1','can_r2','can_r3','can_e1','can_e2','can_e3','can_l1','can_l2','can_l3', 'tur_c1','tur_c2','tur_c3','tur_r1','tur_r2','tur_r3','tur_e1','tur_e2','tur_e3','tur_l1','tur_l2','tur_l3', 'hul_c1','hul_c2','hul_c3','hul_r1','hul_r2','hul_r3','hul_e1','hul_e2','hul_e3','hul_l1','hul_l2','hul_l3', 'trk_c1','trk_c2','trk_c3','trk_r1','trk_r2','trk_r3','trk_e1','trk_e2','trk_e3','trk_l1','trk_l2','trk_l3'];
const MODULES = {
    'can_c1': { id: 'can_c1', type: 'cannon', rarity: 'common', name: 'Вкорочене', stats: { dmg: 1.01, range: 0.90, cd: 1.00 } }, 'can_c2': { id: 'can_c2', type: 'cannon', rarity: 'common', name: 'Труба', stats: { dmg: 1.00, range: 1.05, cd: 0.99 } }, 'can_c3': { id: 'can_c3', type: 'cannon', rarity: 'common', name: 'Самопал', stats: { dmg: 1.02, range: 1.00, cd: 0.98 } },
    'can_r1': { id: 'can_r1', type: 'cannon', rarity: 'rare', name: 'Снайпер', stats: { dmg: 1.05, range: 1.15, cd: 1.00 } }, 'can_r2': { id: 'can_r2', type: 'cannon', rarity: 'rare', name: 'Штурмове', stats: { dmg: 1.02, range: 1.00, cd: 0.90 } }, 'can_r3': { id: 'can_r3', type: 'cannon', rarity: 'rare', name: 'Важке', stats: { dmg: 1.12, range: 0.95, cd: 1.05 } },
    'can_e1': { id: 'can_e1', type: 'cannon', rarity: 'epic', name: 'Рейлгун', stats: { dmg: 1.15, range: 1.30, cd: 1.05 } }, 'can_e2': { id: 'can_e2', type: 'cannon', rarity: 'epic', name: 'Вулкан', stats: { dmg: 1.05, range: 0.90, cd: 0.75 } }, 'can_e3': { id: 'can_e3', type: 'cannon', rarity: 'epic', name: 'Руйнівник', stats: { dmg: 1.25, range: 1.00, cd: 0.90 } },
    'can_l1': { id: 'can_l1', type: 'cannon', rarity: 'legendary', name: 'Плазма', stats: { dmg: 1.40, range: 1.00, cd: 0.85 } }, 'can_l2': { id: 'can_l2', type: 'cannon', rarity: 'legendary', name: 'Око Смерті', stats: { dmg: 1.20, range: 1.50, cd: 0.90 } }, 'can_l3': { id: 'can_l3', type: 'cannon', rarity: 'legendary', name: 'Армагеддон', stats: { dmg: 1.50, range: 1.20, cd: 0.85 } },
    'tur_c1': { id: 'tur_c1', type: 'turret', rarity: 'common', name: 'Іржа', stats: { rotSpeed: 1.01, hp: 1.01 } }, 'tur_c2': { id: 'tur_c2', type: 'turret', rarity: 'common', name: 'Клепана', stats: { rotSpeed: 1.00, hp: 1.02 } }, 'tur_c3': { id: 'tur_c3', type: 'turret', rarity: 'common', name: 'Полегшена', stats: { rotSpeed: 1.02, hp: 1.00 } },
    'tur_r1': { id: 'tur_r1', type: 'turret', rarity: 'rare', name: 'Лицар', stats: { rotSpeed: 0.98, hp: 1.10 } }, 'tur_r2': { id: 'tur_r2', type: 'turret', rarity: 'rare', name: 'Скаут', stats: { rotSpeed: 1.10, hp: 0.98 } }, 'tur_r3': { id: 'tur_r3', type: 'turret', rarity: 'rare', name: 'Баланс', stats: { rotSpeed: 1.05, hp: 1.05 } },
    'tur_e1': { id: 'tur_e1', type: 'turret', rarity: 'epic', name: 'Фортеця', stats: { rotSpeed: 0.95, hp: 1.25 } }, 'tur_e2': { id: 'tur_e2', type: 'turret', rarity: 'epic', name: 'Торнадо', stats: { rotSpeed: 1.25, hp: 0.95 } }, 'tur_e3': { id: 'tur_e3', type: 'turret', rarity: 'epic', name: 'Вартовий', stats: { rotSpeed: 1.15, hp: 1.15 } },
    'tur_l1': { id: 'tur_l1', type: 'turret', rarity: 'legendary', name: 'Титан', stats: { rotSpeed: 0.90, hp: 1.50 } }, 'tur_l2': { id: 'tur_l2', type: 'turret', rarity: 'legendary', name: 'Вихор', stats: { rotSpeed: 1.50, hp: 1.10 } }, 'tur_l3': { id: 'tur_l3', type: 'turret', rarity: 'legendary', name: 'Сингулярність', stats: { rotSpeed: 1.35, hp: 1.35 } },
    'hul_c1': { id: 'hul_c1', type: 'hull', rarity: 'common', name: 'Іржа', stats: { hp: 1.01, speed: 1.01 } }, 'hul_c2': { id: 'hul_c2', type: 'hull', rarity: 'common', name: 'Корито', stats: { hp: 1.03, speed: 0.99 } }, 'hul_c3': { id: 'hul_c3', type: 'hull', rarity: 'common', name: 'Каркас', stats: { hp: 0.99, speed: 1.03 } },
    'hul_r1': { id: 'hul_r1', type: 'hull', rarity: 'rare', name: 'Панцер', stats: { hp: 1.12, speed: 0.95 } }, 'hul_r2': { id: 'hul_r2', type: 'hull', rarity: 'rare', name: 'Болід', stats: { hp: 0.95, speed: 1.12 } }, 'hul_r3': { id: 'hul_r3', type: 'hull', rarity: 'rare', name: 'Ветеран', stats: { hp: 1.06, speed: 1.06 } },
    'hul_e1': { id: 'hul_e1', type: 'hull', rarity: 'epic', name: 'Моноліт', stats: { hp: 1.30, speed: 0.90 } }, 'hul_e2': { id: 'hul_e2', type: 'hull', rarity: 'epic', name: 'Фантом', stats: { hp: 0.90, speed: 1.30 } }, 'hul_e3': { id: 'hul_e3', type: 'hull', rarity: 'epic', name: 'Центуріон', stats: { hp: 1.15, speed: 1.15 } },
    'hul_l1': { id: 'hul_l1', type: 'hull', rarity: 'legendary', name: 'Голіаф', stats: { hp: 1.60, speed: 0.85 } }, 'hul_l2': { id: 'hul_l2', type: 'hull', rarity: 'legendary', name: 'Тінь', stats: { hp: 1.10, speed: 1.50 } }, 'hul_l3': { id: 'hul_l3', type: 'hull', rarity: 'legendary', name: 'Нано-броня', stats: { hp: 1.40, speed: 1.40 } },
    'trk_c1': { id: 'trk_c1', type: 'tracks', rarity: 'common', name: 'Іржаві', stats: { speed: 1.01, hp: 1.01 } }, 'trk_c2': { id: 'trk_c2', type: 'tracks', rarity: 'common', name: 'Шиповані', stats: { speed: 1.02, hp: 1.00 } }, 'trk_c3': { id: 'trk_c3', type: 'tracks', rarity: 'common', name: 'Тракторні', stats: { speed: 1.00, hp: 1.02 } },
    'trk_r1': { id: 'trk_r1', type: 'tracks', rarity: 'rare', name: 'Ралійні', stats: { speed: 1.10, hp: 0.98 } }, 'trk_r2': { id: 'trk_r2', type: 'tracks', rarity: 'rare', name: 'Всюдихідні', stats: { speed: 0.98, hp: 1.10 } }, 'trk_r3': { id: 'trk_r3', type: 'tracks', rarity: 'rare', name: 'Посилені', stats: { speed: 1.05, hp: 1.05 } },
    'trk_e1': { id: 'trk_e1', type: 'tracks', rarity: 'epic', name: 'Турбінні', stats: { speed: 1.25, hp: 0.95 } }, 'trk_e2': { id: 'trk_e2', type: 'tracks', rarity: 'epic', name: 'Магнітні', stats: { speed: 0.95, hp: 1.25 } }, 'trk_e3': { id: 'trk_e3', type: 'tracks', rarity: 'epic', name: 'Елітні', stats: { speed: 1.15, hp: 1.15 } },
    'trk_l1': { id: 'trk_l1', type: 'tracks', rarity: 'legendary', name: 'Гравітаційні', stats: { speed: 1.50, hp: 1.00 } }, 'trk_l2': { id: 'trk_l2', type: 'tracks', rarity: 'legendary', name: 'Кібернетичні', stats: { speed: 1.00, hp: 1.50 } }, 'trk_l3': { id: 'trk_l3', type: 'tracks', rarity: 'legendary', name: 'Омега', stats: { speed: 1.35, hp: 1.35 } }
};

function getRandomModuleId(rarity) { let filtered = ALL_MODULES.filter(m => m.includes(`_${rarity.charAt(0)}`)); return filtered[Math.floor(Math.random() * filtered.length)]; }

function sendEconomy(socketId, name) { 
    if (dbUsers[name]) io.to(socketId).emit('economyUpdate', { 
        bucks: dbUsers[name].bucks, 
        inventory: dbUsers[name].inventory, 
        equipped: dbUsers[name].equipped, 
        stats: dbUsers[name].stats,
        adventClaims: dbUsers[name].adventClaims
    }); 
}

function getActiveRooms() { return Object.values(rooms).map(r => ({ id: r.id, hostName: r.hostName, mode: r.mode, map: r.map, playersCount: Object.keys(r.players).length, maxPlayers: r.maxPlayers, status: r.status })); }

function getMaxHp(equipped) {
    let hpMult = 1.0;
    if (equipped) {
        if (equipped.hull && MODULES[equipped.hull] && MODULES[equipped.hull].stats.hp) hpMult *= MODULES[equipped.hull].stats.hp;
        if (equipped.turret && MODULES[equipped.turret] && MODULES[equipped.turret].stats.hp) hpMult *= MODULES[equipped.turret].stats.hp;
        if (equipped.tracks && MODULES[equipped.tracks] && MODULES[equipped.tracks].stats.hp) hpMult *= MODULES[equipped.tracks].stats.hp;
    }
    return Math.round(MAX_HP * hpMult);
}

function validateUser(u) { 
    if(!u.inventory) u.inventory = []; 
    if(!u.equipped) u.equipped = { cannon: null, turret: null, hull: null, tracks: null }; 
    if(!u.stats) u.stats = { kills: 0, matches: 0, earned: 0 }; 
    if(!u.usedPromos) u.usedPromos = []; 
    if(!u.adventClaims) u.adventClaims = [];
    return u; 
}

function rollDrop(name) { if (Math.random() <= 0.10) { let r = Math.random() * 100; let rarity = 'common'; if (r > 90 && r <= 98) rarity = 'rare'; else if (r > 98 && r <= 99.5) rarity = 'epic'; else if (r > 99.5) rarity = 'legendary'; let modId = getRandomModuleId(rarity); if (dbUsers[name].inventory.length < 30) { dbUsers[name].inventory.push(modId); return modId; } } return null; }

io.on('connection', (socket) => {
    socket.emit('initMusic', musicData);
    
    socket.on('register', (data) => { const { name, password } = data; if(!name || !password || name.length < 3 || password.length < 4) return socket.emit('authError', 'Логін від 3 символів, пароль від 4!'); if(dbUsers[name]) return socket.emit('authError', 'Цей логін вже зайнятий!'); const token = crypto.randomUUID(); dbUsers[name] = validateUser({ name: name, password: hashPwd(password), token: token, bucks: 0 }); saveUser(name); globalPlayers[socket.id] = name; socket.emit('authSuccess', { name, token }); sendEconomy(socket.id, name); });
    socket.on('login', (data) => { const { name, password } = data; let u = dbUsers[name]; if(!u || u.password !== hashPwd(password)) return socket.emit('authError', 'Невірний логін або пароль!'); const token = crypto.randomUUID(); u.token = token; u = validateUser(u); saveUser(name); globalPlayers[socket.id] = name; socket.emit('authSuccess', { name, token }); sendEconomy(socket.id, name); });
    socket.on('authToken', (token) => { let foundName = null; for(let n in dbUsers) { if(dbUsers[n].token === token) foundName = n; } if(foundName) { globalPlayers[socket.id] = foundName; dbUsers[foundName] = validateUser(dbUsers[foundName]); socket.emit('authSuccess', { name: foundName, token }); sendEconomy(socket.id, foundName); } else socket.emit('authError', 'Сесія закінчилась, увійдіть знову'); });

    socket.on('claimAdvent', () => {
        let name = globalPlayers[socket.id]; if(!name || !dbUsers[name]) return;
        let u = dbUsers[name]; let d = new Date();
        let month = d.getMonth(); let day = d.getDate();
        if (month !== 9) return socket.emit('promoError', 'Івент проходить лише в жовтні!');
        if (day < 3) return socket.emit('promoError', 'Івент ще не почався!');
        if (u.adventClaims.includes(day)) return socket.emit('promoError', 'Сьогоднішня нагорода вже отримана!');

        u.adventClaims.push(day);
        if (day === 31) {
            if (u.adventClaims.length >= 20) {
                let modId = getRandomModuleId('legendary');
                if (u.inventory.length < 30) u.inventory.push(modId);
                socket.emit('adventSuccess', { type: 'legendary', item: modId, day: day });
            } else {
                u.adventClaims.pop();
                return socket.emit('promoError', 'Недостатньо зібраних днів (мінімум 20) для фінальної нагороди!');
            }
        } else {
            let reward = 20 + (day - 3) * 5;
            u.bucks += reward; u.stats.earned += reward;
            socket.emit('adventSuccess', { type: 'bucks', amount: reward, day: day });
        }
        saveUser(name); sendEconomy(socket.id, name);
    });

    socket.on('usePromo', (code) => {
        let name = globalPlayers[socket.id]; if(!name || !dbUsers[name]) return; let u = dbUsers[name]; let normalizedCode = code.trim().toLowerCase();
        if (normalizedCode === 'alex-top1') { if (u.usedPromos.includes(normalizedCode)) return socket.emit('promoError', 'Промокод вже використано на цьому акаунті!'); u.bucks += 200; u.stats.earned += 200; u.usedPromos.push(normalizedCode); saveUser(name); sendEconomy(socket.id, name); socket.emit('promoSuccess', 'Успішно! +200 баксів нараховано.'); } else { socket.emit('promoError', 'Невірний або неіснуючий промокод!'); }
    });

    socket.on('buyCase', (caseId) => { 
        let name = globalPlayers[socket.id]; if(!name || !dbUsers[name]) return; let u = dbUsers[name]; 
        if (u.inventory.length >= 30) return socket.emit('authError', 'Інвентар повний (макс 30)!');
        let price = caseId === 1 ? 50 : caseId === 2 ? 100 : 150;
        if(u.bucks >= price) { 
            u.bucks -= price; let r = Math.random() * 100; let rarity = 'common';
            if (caseId === 1) { if(r>75 && r<=90) rarity='rare'; else if(r>90 && r<=99) rarity='epic'; else if(r>99) rarity='legendary'; }
            else if (caseId === 2) { if(r>55 && r<=80) rarity='rare'; else if(r>80 && r<=95) rarity='epic'; else if(r>95) rarity='legendary'; }
            else if (caseId === 3) { rarity='rare'; if(r>55 && r<=80) rarity='epic'; else if(r>80) rarity='legendary'; }
            let modId = getRandomModuleId(rarity); u.inventory.push(modId); saveUser(name); socket.emit('caseResult', { modId: modId, bucks: u.bucks, inventory: u.inventory, equipped: u.equipped, stats: u.stats }); 
        } 
    });

    socket.on('reorderInventory', (newInv) => { let name = globalPlayers[socket.id]; if(!name || !dbUsers[name]) return; let u = dbUsers[name]; if (Array.isArray(newInv) && newInv.length === u.inventory.length) { u.inventory = newInv; saveUser(name); } });
    socket.on('unequipModule', (data) => { let name = globalPlayers[socket.id]; if(!name || !dbUsers[name]) return; let u = dbUsers[name]; let modId = u.equipped[data.type]; if (modId) { if (u.inventory.length < 30) { u.inventory.push(modId); u.equipped[data.type] = null; saveUser(name); sendEconomy(socket.id, name); for(let rId in rooms) { let r = rooms[rId]; if (r.players[socket.id] && r.status === 'lobby') { r.players[socket.id].equipped = u.equipped; r.players[socket.id].hp = getMaxHp(u.equipped); io.to(rId).emit('updateLobby', r); } } } else { socket.emit('authError', 'Інвентар повний!'); } } });
    socket.on('equipModule', (data) => { let name = globalPlayers[socket.id]; if(!name || !dbUsers[name]) return; let u = dbUsers[name]; let idx = u.inventory.indexOf(data.id); if (idx !== -1) { if (u.equipped[data.type]) u.inventory.push(u.equipped[data.type]); u.equipped[data.type] = data.id; u.inventory.splice(idx, 1); saveUser(name); sendEconomy(socket.id, name); for(let rId in rooms) { let r = rooms[rId]; if (r.players[socket.id] && r.status === 'lobby') { r.players[socket.id].equipped = u.equipped; r.players[socket.id].hp = getMaxHp(u.equipped); io.to(rId).emit('updateLobby', r); } } } });
    socket.on('sellModule', (data) => { let name = globalPlayers[socket.id]; if(!name || !dbUsers[name]) return; let u = dbUsers[name]; let idx = u.inventory.indexOf(data.id); if (idx !== -1) { let rarityText = data.id.includes('_c') ? 'common' : data.id.includes('_r') ? 'rare' : data.id.includes('_e') ? 'epic' : 'legendary'; u.bucks += RARITY_PRICES[rarityText] || 5; u.stats.earned += RARITY_PRICES[rarityText] || 5; u.inventory.splice(idx, 1); saveUser(name); sendEconomy(socket.id, name); } });
    socket.on('dropModule', (data) => { let name = globalPlayers[socket.id]; if(!name || !dbUsers[name]) return; let u = dbUsers[name]; let idx = u.inventory.indexOf(data.id); if (idx !== -1) { u.inventory.splice(idx, 1); saveUser(name); sendEconomy(socket.id, name); } });

    socket.on('requestRooms', () => { socket.emit('roomsList', getActiveRooms()); });
    socket.on('createRoom', (config) => { let name = globalPlayers[socket.id]; if(!name) return; let roomId = 'room_' + Date.now(); rooms[roomId] = { id: roomId, hostName: name, hostSocket: socket.id, mode: config.mode, map: config.map, maxPlayers: Math.max(2, Math.min(10, config.maxPlayers)), winScore: Math.max(5, config.winScore), status: 'lobby', players: {}, powerups: {}, tokens: {}, zombies: {}, wave: 1, survivalState: 'waiting', nextWaveTime: 0, lastPowerupSpawn: Date.now() }; socket.emit('roomCreated', roomId); io.emit('roomsList', getActiveRooms()); });
    
    socket.on('joinRoom', (roomId) => { 
        let name = globalPlayers[socket.id]; if(!name || !rooms[roomId]) return socket.emit('joinError', 'Кімната не знайдена'); let room = rooms[roomId]; if (Object.keys(room.players).length >= room.maxPlayers) return socket.emit('joinError', 'Кімната повна'); if (room.status !== 'lobby') return socket.emit('joinError', 'Гра вже почалася'); 
        socket.join(roomId); let userEq = dbUsers[name].equipped || { cannon: null, turret: null, hull: null, tracks: null };
        room.players[socket.id] = { id: socket.id, name: name, color: null, ready: false, hp: getMaxHp(userEq), score: 0, x: 0, y: 0, bodyAngle: 0, turretAngle: 0, buff: null, buffEndTime: 0, buffProgress: 0, equipped: userEq }; 
        socket.emit('joinedRoom', { roomId: roomId, roomData: room }); io.to(roomId).emit('updateLobby', room); io.emit('roomsList', getActiveRooms()); 
    });
    
    socket.on('leaveRoom', (roomId) => { if(rooms[roomId] && rooms[roomId].players[socket.id]) { delete rooms[roomId].players[socket.id]; socket.leave(roomId); if(Object.keys(rooms[roomId].players).length === 0) { delete rooms[roomId]; } else if (rooms[roomId].hostSocket === socket.id) { rooms[roomId].hostSocket = Object.keys(rooms[roomId].players)[0]; rooms[roomId].hostName = rooms[roomId].players[rooms[roomId].hostSocket].name; } if (rooms[roomId]) io.to(roomId).emit('updateLobby', rooms[roomId]); io.emit('roomsList', getActiveRooms()); } });
    socket.on('updateRoomSettings', (data) => { let room = rooms[data.roomId]; if (room && room.hostSocket === socket.id && room.status === 'lobby') { if (data.mode) room.mode = data.mode; if (data.map) room.map = data.map; if (data.maxPlayers) room.maxPlayers = Math.max(2, Math.min(10, data.maxPlayers)); if (data.winScore) room.winScore = Math.max(5, data.winScore); io.to(data.roomId).emit('updateLobby', room); io.emit('roomsList', getActiveRooms()); } });
    socket.on('setColor', (data) => { let room = rooms[data.roomId]; if(room && room.players[socket.id]) { room.players[socket.id].color = data.color; room.players[socket.id].ready = false; io.to(data.roomId).emit('updateLobby', room); } });
    socket.on('toggleReady', (roomId) => { let room = rooms[roomId]; if(room && room.players[socket.id] && room.players[socket.id].color) { room.players[socket.id].ready = !room.players[socket.id].ready; io.to(roomId).emit('updateLobby', room); } });
    
    socket.on('startGame', (roomId) => { 
        let room = rooms[roomId]; 
        if (room && room.hostSocket === socket.id && room.status === 'lobby') { 
            const pKeys = Object.keys(room.players); 
            if (pKeys.length >= 2 && pKeys.every(id => room.players[id].ready)) { 
                room.status = 'playing'; if (room.mode === 'survival') { room.wave = 1; room.survivalState = 'spawning'; room.zombies = {}; } 
                pKeys.forEach((id) => { room.players[id].hp = getMaxHp(room.players[id].equipped); room.players[id].score = 0; room.players[id].buff = null; let spawn = getValidSpawn(room.map, 30, 'spawn_player'); room.players[id].x = spawn.x; room.players[id].y = spawn.y; }); 
                io.to(roomId).emit('gameStarting', room); io.emit('roomsList', getActiveRooms()); 
            } 
        } 
    });

    socket.on('move', (data) => { let room = rooms[data.roomId]; if(room && room.players[socket.id] && room.status === 'playing') { room.players[socket.id].x = data.x; room.players[socket.id].y = data.y; room.players[socket.id].bodyAngle = data.bodyAngle; room.players[socket.id].turretAngle = data.turretAngle; } });
    socket.on('shoot', (data) => { let room = rooms[data.roomId]; if(room && room.status === 'playing') io.to(data.roomId).emit('spawnBullet', { ...data, owner: socket.id }); });

    socket.on('registerHit', (data) => {
        let room = rooms[data.roomId]; if(!room || room.status !== 'playing' || !room.players[data.targetId]) return; 
        let victim = room.players[data.targetId]; let attackerSocketId = socket.id;
        if (room.mode === 'survival') return; if (victim.hp <= 0) return;

        let finalDmg = data.amt; let atkName = globalPlayers[attackerSocketId];
        if (atkName && dbUsers[atkName] && dbUsers[atkName].equipped && dbUsers[atkName].equipped.cannon) { 
            let cId = dbUsers[atkName].equipped.cannon;
            if (MODULES[cId] && MODULES[cId].stats.dmg) finalDmg *= MODULES[cId].stats.dmg;
        }

        victim.hp = Math.max(0, victim.hp - finalDmg); io.to(attackerSocketId).emit('hitConfirmed');

        if (victim.hp === 0) { 
            victim.buff = null; io.to(data.roomId).emit('playerDied', { id: data.targetId, killer: attackerSocketId }); 
            if(atkName && dbUsers[atkName]) { dbUsers[atkName].stats.kills++; saveUser(atkName); }
            if (room.mode === 'deathmatch') { const tid = 'tkn_' + Date.now() + Math.random(); room.tokens[tid] = { id: tid, x: victim.x, y: victim.y, color: victim.color, active: true }; } 
            
            if (room.mode !== 'survival') {
                setTimeout(() => { if(room && room.players[data.targetId] && room.status === 'playing') { room.players[data.targetId].hp = getMaxHp(room.players[data.targetId].equipped); let spawn = getValidSpawn(room.map, 30, 'spawn_player'); room.players[data.targetId].x = spawn.x; room.players[data.targetId].y = spawn.y; io.to(data.roomId).emit('playerRespawn', room.players[data.targetId]); } }, 3000); 
            }
        }
    });

    socket.on('takeDamage', (data) => {
        let room = rooms[data.roomId]; if(!room || room.status !== 'playing' || !room.players[socket.id]) return;
        if (data.attacker !== 'zombie') return; 
        let victim = room.players[socket.id]; victim.hp = Math.max(0, victim.hp - data.amt);
        if (victim.hp === 0) { 
            victim.buff = null; io.to(data.roomId).emit('playerDied', { id: socket.id, killer: 'zombie' }); 
        }
    });

    socket.on('collectToken', (data) => {
        let room = rooms[data.roomId]; if (!room || !room.tokens[data.tid] || !room.tokens[data.tid].active || !room.players[socket.id] || room.players[socket.id].hp <= 0) return;
        room.tokens[data.tid].active = false; room.players[socket.id].score += 1;
        if (room.players[socket.id].score >= room.winScore && room.mode === 'deathmatch') {
            room.status = 'finished'; let multiplier = 1 + Math.max(0, room.winScore - 5) * 0.10; let baseWin = Math.round(10 * multiplier); let baseLose = Math.round(2 * multiplier); let rewards = {};
            Object.values(room.players).forEach(p => { 
                let amt = Math.round(p.id === socket.id ? baseWin : baseLose); rewards[p.id] = amt; 
                if(dbUsers[p.name]) { dbUsers[p.name].bucks += amt; dbUsers[p.name].stats.earned += amt; dbUsers[p.name].stats.matches++; let dropped = rollDrop(p.name); saveUser(p.name); io.to(p.id).emit('economyUpdate', { bucks: dbUsers[p.name].bucks, inventory: dbUsers[p.name].inventory, equipped: dbUsers[p.name].equipped, stats: dbUsers[p.name].stats, adventClaims: dbUsers[p.name].adventClaims }); if(dropped) io.to(p.id).emit('dropReceived', dropped); } 
            });
            io.to(data.roomId).emit('tokenCollected', { tid: data.tid, playerId: socket.id, score: room.players[socket.id].score }); io.to(data.roomId).emit('gameOver', { winner: socket.id, name: room.players[socket.id].name, rewards: rewards }); io.emit('roomsList', getActiveRooms());
        } else { io.to(data.roomId).emit('tokenCollected', { tid: data.tid, playerId: socket.id, score: room.players[socket.id].score }); } delete room.tokens[data.tid]; 
    });

    socket.on('collectPowerup', (data) => { 
        let room = rooms[data.roomId]; 
        if (room && room.powerups[data.pid] && room.powerups[data.pid].active && room.players[socket.id] && room.players[socket.id].hp > 0) { 
            let pType = room.powerups[data.pid].type; room.players[socket.id].buff = pType; room.players[socket.id].buffEndTime = Date.now() + BUFF_DURATION; room.powerups[data.pid].active = false; 
            if (pType === 'healing') { room.players[socket.id].hp = Math.min(getMaxHp(room.players[socket.id].equipped), room.players[socket.id].hp + 100); }
            io.to(data.roomId).emit('powerupCollected', { pid: data.pid, playerId: socket.id, type: pType }); delete room.powerups[data.pid]; 
        } 
    });

    socket.on('zombieHit', (data) => {
        let room = rooms[data.roomId]; if (room && room.zombies[data.zid] && room.zombies[data.zid].hp > 0) {
            let finalDmg = data.dmg; let atkName = room.players[socket.id]?.name;
            if (atkName && dbUsers[atkName] && dbUsers[atkName].equipped && dbUsers[atkName].equipped.cannon) { 
                let cId = dbUsers[atkName].equipped.cannon; 
                if (MODULES[cId] && MODULES[cId].stats.dmg) finalDmg *= MODULES[cId].stats.dmg;
            }
            room.zombies[data.zid].hp -= finalDmg;
            if (room.zombies[data.zid].hp <= 0) { if(room.zombies[data.zid].type === 'bomber') io.to(data.roomId).emit('bomberExplode', { x: room.zombies[data.zid].x, y: room.zombies[data.zid].y }); delete room.zombies[data.zid]; }
        }
    });

    socket.on('backToRoomLobby', (roomId) => { let room = rooms[roomId]; if (room && room.status === 'finished') { room.status = 'lobby'; room.powerups = {}; room.tokens = {}; room.zombies = {}; room.wave = 1; Object.values(room.players).forEach(p => { p.ready = false; p.score = 0; p.hp = getMaxHp(p.equipped); p.buff = null; }); io.to(roomId).emit('updateLobby', room); io.emit('roomsList', getActiveRooms()); } });

    socket.on('disconnect', () => {
        delete globalPlayers[socket.id];
        for(let roomId in rooms) {
            if(rooms[roomId].players[socket.id]) {
                delete rooms[roomId].players[socket.id];
                if(Object.keys(rooms[roomId].players).length === 0) { delete rooms[roomId]; } else if (rooms[roomId].hostSocket === socket.id) { rooms[roomId].hostSocket = Object.keys(rooms[roomId].players)[0]; rooms[roomId].hostName = rooms[roomId].players[rooms[roomId].hostSocket].name; }
                if (rooms[roomId]) { if(Object.keys(rooms[roomId].players).length < 2 && rooms[roomId].status === 'playing') { rooms[roomId].status = 'lobby'; io.to(roomId).emit('updateLobby', rooms[roomId]); } else { io.to(roomId).emit('updateLobby', rooms[roomId]); } }
            }
        }
        io.emit('roomsList', getActiveRooms());
    });
});

setInterval(() => {
    const now = Date.now();
    for(let roomId in rooms) {
        let room = rooms[roomId]; if (room.status !== 'playing') continue;
        Object.values(room.players).forEach(p => { 
            if (p.buff) { 
                p.buffProgress = Math.max(0, (p.buffEndTime - now) / BUFF_DURATION); 
                if (p.buff === 'healing' && p.hp > 0) p.hp = Math.min(getMaxHp(p.equipped), p.hp + 10 * (1/30)); 
                if (now > p.buffEndTime) { 
                    if (p.buff === 'boss') { 
                        if (checkCollisionServer(room.map, p.x, p.y, 30)) { let found = false; for(let rad = 50; rad < 800; rad += 50) { for(let angle = 0; angle < Math.PI * 2; angle += Math.PI/4) { let testX = p.x + Math.cos(angle)*rad; let testY = p.y + Math.sin(angle)*rad; if (!checkCollisionServer(room.map, testX, testY, 30)) { p.x = testX; p.y = testY; found = true; break; } } if(found) break; } }
                    }
                    p.buff = null; p.buffProgress = 0; 
                } 
            } else p.buffProgress = 0; 
        });

        if (now - room.lastPowerupSpawn > 30000) {
            room.lastPowerupSpawn = now; 
            const types = ['explosive', 'minigun', 'boss', 'shotgun', 'healing', 'samurai', 'piercing', 'invisible', 'homing'];
            if (Object.keys(room.powerups).length > 10) delete room.powerups[Object.keys(room.powerups)[0]];
            for(let i=0; i<2; i++) { const pid = 'pu_' + now + '_' + i; let pSpawn = getValidSpawn(room.map, 30, 'spawn_powerup'); room.powerups[pid] = { id: pid, type: types[Math.floor(Math.random() * types.length)], active: true, x: pSpawn.x, y: pSpawn.y }; }
        }
        if (Object.keys(room.tokens).length > 40) delete room.tokens[Object.keys(room.tokens)[0]];

        if (room.mode === 'survival') {
            const alivePlayers = Object.values(room.players).filter(p => p.hp > 0);
            if (alivePlayers.length === 0) {
                room.status = 'finished';
                Object.values(room.players).forEach(p => { let name = p.name; if(dbUsers[name]) { let reward = room.wave; dbUsers[name].bucks += reward; dbUsers[name].stats.earned += reward; dbUsers[name].stats.matches++; let dropped = rollDrop(name); saveUser(name); io.to(p.id).emit('economyUpdate', { bucks: dbUsers[name].bucks, inventory: dbUsers[name].inventory, equipped: dbUsers[name].equipped, stats: dbUsers[name].stats, adventClaims: dbUsers[name].adventClaims }); if(dropped) io.to(p.id).emit('dropReceived', dropped); } });
                io.to(roomId).emit('gameOver', { winner: 'ZOMBIES', wave: room.wave }); io.emit('roomsList', getActiveRooms()); continue;
            }
            if (Object.keys(room.zombies).length === 0) {
                if (room.survivalState === 'playing') { 
                    room.survivalState = 'waiting'; 
                    room.nextWaveTime = now + 5000; 
                    
                    // Попередження про боса за 5 секунд
                    let nextWave = room.wave + 1;
                    if (nextWave === 10 || nextWave === 20 || nextWave === 30 || nextWave === 40) {
                        io.to(roomId).emit('bossWarning');
                    }
                } 
                else if (room.survivalState === 'waiting' && now > room.nextWaveTime) {
                    room.wave++; 
                    let isBossWave = (room.wave === 10 || room.wave === 20 || room.wave === 30 || room.wave === 40);
                    
                    if (isBossWave) { 
                        let bType = room.wave === 10 ? 'pikus' : room.wave === 20 ? 'shurik' : room.wave === 30 ? 'oneshot' : 'padlo'; 
                        let zid = `boss_${now}`; 
                        let zSpawn = getValidSpawn(room.map, 50, 'spawn_zombie'); 
                        room.zombies[zid] = { id: zid, x: zSpawn.x, y: zSpawn.y, type: bType, hp: Z_TYPES[bType].hp, nextAttack: 0 }; 
                        
                        io.to(roomId).emit('newWave', { wave: room.wave, isBoss: true, bossName: Z_TYPES[bType].name });
                    } 
                    else { 
                        // НОВИЙ БАЛАНС (старт з 20, потім +5)
                        let MathCount = 20 + (room.wave - 1) * 5;
                        let spawnCount = Math.min(150, MathCount); 
                        
                        // НОВІ ЗОМБІ КОЖНІ 5 ХВИЛЬ
                        let typesList = ['normal', 'runner', 'spitter', 'tanker', 'bomber', 'ghost']; 
                        let maxIdx = Math.min(typesList.length - 1, Math.floor(room.wave / 5));
                        let availableTypes = typesList.slice(0, maxIdx + 1);

                        for(let i=0; i<spawnCount; i++) { 
                            let type = 'normal'; 
                            let roll = Math.random();
                            
                            // 60% шанс на найкрутіших монстрів, якщо вони відкриті
                            if (roll < 0.6 && availableTypes.length > 1) {
                                type = availableTypes[availableTypes.length - 1]; 
                            } else if (roll < 0.8 && availableTypes.length > 2) {
                                type = availableTypes[availableTypes.length - 2];
                            } else {
                                type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
                            }

                            let zSpawn = getValidEdgeSpawn(room.map, 20, 'spawn_zombie'); 
                            let zid = `z_${now}_${i}`; 
                            room.zombies[zid] = { id: zid, x: zSpawn.x, y: zSpawn.y, type: type, hp: Z_TYPES[type].hp, nextAttack: 0 }; 
                        } 
                        io.to(roomId).emit('newWave', { wave: room.wave, isBoss: false });
                    }
                    room.survivalState = 'playing'; 
                } else if (room.survivalState === 'spawning') { 
                    room.survivalState = 'waiting'; room.nextWaveTime = now + 1000; 
                }
            } else if (room.survivalState === 'playing') {
                for (let zid in room.zombies) {
                    let z = room.zombies[zid]; let target = null; let minDist = Infinity; alivePlayers.forEach(p => { let dist = Math.hypot(p.x - z.x, p.y - z.y); if (p.buff === 'invisible') dist *= 3; if (dist < minDist) { minDist = dist; target = p; } });
                    if (target) {
                        let dx = target.x - z.x; let dy = target.y - z.y; let len = Math.hypot(dx, dy); let speed = Z_TYPES[z.type].speed; let nextX = z.x + (dx/len) * speed * (1/30); let nextY = z.y + (dy/len) * speed * (1/30);
                        if (!checkCollisionServer(room.map, nextX, z.y, Z_TYPES[z.type].radius)) z.x = nextX; if (!checkCollisionServer(room.map, z.x, nextY, Z_TYPES[z.type].radius)) z.y = nextY;
                        if (Z_TYPES[z.type].isBoss && now > z.nextAttack) { z.nextAttack = now + Z_TYPES[z.type].cd; let bCount = Z_TYPES[z.type].bullets; let spread = Math.PI / 4; let startAngle = Math.atan2(dy, dx) - (spread / 2); let step = spread / Math.max(1, bCount - 1); if (bCount === 25) { spread = Math.PI * 2; step = spread / 25; startAngle = 0; } for(let b=0; b<bCount; b++) { let a = startAngle + (b * step); io.to(roomId).emit('spawnBullet', { id: 'b_'+now+b+zid, x: z.x, y: z.y, vx: Math.cos(a)*500, vy: Math.sin(a)*500, type: 'boss_proj', owner: 'zombie', dmgOverride: Z_TYPES[z.type].dmg }); } }
                        else if (Z_TYPES[z.type].ranged && !Z_TYPES[z.type].isBoss && minDist < 400 && now > z.nextAttack) { z.nextAttack = now + 2000; io.to(roomId).emit('spawnBullet', { id: 'ac_'+now+zid, x: z.x, y: z.y, vx: (dx/len)*400, vy: (dy/len)*400, type: 'acid', owner: 'zombie' }); } 
                        else if (!Z_TYPES[z.type].isBoss && minDist < 30 + Z_TYPES[z.type].radius + 5 && now > z.nextAttack) { z.nextAttack = now + 1000; io.to(roomId).emit('zombieMeleeHit', { targetId: target.id, dmg: Z_TYPES[z.type].dmg }); }
                    }
                }
            }
        }
        io.to(roomId).emit('sync', { players: room.players, zombies: room.zombies, powerups: room.powerups, tokens: room.tokens });
    }
}, 1000 / 30);

const PORT = process.env.PORT || 3000; http.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });