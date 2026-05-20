const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Розміри екрану роблю фіксовані під рамку
canvas.width = 1000;
canvas.height = 700;

const gridSize = 50; // Розмір клітинки для сітки

// Точки по яким йдуть танки (вирівняв по координатах клітинок)
function getWaypoints() {
    return [
        { x: 0, y: 250 },
        { x: 400, y: 250 },
        { x: 400, y: 550 },
        { x: 900, y: 550 },
        { x: 1000, y: 550 }
    ];
}

// Наші ігрові масиви (ігрові об'єкти)
let enemies = [];
let towers = [];
let projectiles = [];
let particles = [];

// Початкові налаштування гри (баланс)
let money = 100;
let baseHealth = 10;
let currentWave = 1;
let enemiesToSpawn = 5;
let waveInProgress = false;

// Завантаження картинок з папки assets
//const towerImg = new Image(); towerImg.src = 'assets/tower.png'; 
//const enemyImg = new Image(); enemyImg.src = 'assets/enemy.png';

const towerImg = { complete: false };
const enemyImg = { complete: false };

// Звукові ефекти
const shootSound = new Audio('assets/shoot.mp3');
const explosionSound = new Audio('assets/explosion.mp3');
shootSound.volume = 0.1;
explosionSound.volume = 0.2;

// --- ОПИСУЄМО КЛАСИ (ООП) ---

// Базовий клас ворога
class Enemy {
    constructor(waypoints) {
        this.waypoints = waypoints;
        this.x = waypoints[0].x;
        this.y = waypoints[0].y;
        this.index = 0; // поточна точка, до якої йде
        this.health = 100;
        this.speed = 1.5;
        this.reward = 20; // Скільки дають за вбивство
    }

    update() {
        const target = this.waypoints[this.index + 1];
        if (target) {
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 5) {
                this.index++; // якщо дійшов до точки, беремо наступну
            } else {
                // рух вперед
                this.x += (dx / dist) * this.speed;
                this.y += (dy / dist) * this.speed;
            }
        }
    }

    draw() {
        // Перевірка чи завантажився спрайт, якщо ні — малюємо червоне коло
        if (enemyImg.complete && enemyImg.src.includes('png')) {
            ctx.drawImage(enemyImg, this.x - 15, this.y - 15, 30, 30);
        } else {
            ctx.fillStyle = '#ff3333';
            ctx.beginPath(); 
            ctx.arc(this.x, this.y, 15, 0, Math.PI * 2); 
            ctx.fill();
        }
    }
}

// Швидкий ворог (наслідування від Enemy)
class FastEnemy extends Enemy {
    constructor(waypoints) {
        super(waypoints); // викликаємо конструктор батьківського класу
        this.health = 50;  // ХП менше
        this.speed = 3;    // Швидкість більша
        this.reward = 15;
    }
    draw() {
        ctx.fillStyle = '#3399ff'; // Швидкі будуть синіми колами
        ctx.beginPath(); 
        ctx.arc(this.x, this.y, 11, 0, Math.PI * 2); 
        ctx.fill();
    }
}

// Клас захисної вежі
class Tower {
    constructor(gridX, gridY) {
        // Вираховуємо центр клітинки, щоб вежа стояла рівно
        this.x = gridX * gridSize + gridSize / 2;
        this.y = gridY * gridSize + gridSize / 2;
        this.range = 150; // радіус стрільби
        this.reload = 0;  // таймер КД
    }

    update() {
        if (this.reload > 0) {
            this.reload--;
        }
        
        // Шукаємо ворога в зоні дії
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            const dist = Math.sqrt((enemy.x - this.x)**2 + (enemy.y - this.y)**2);
            
            if (dist < this.range && this.reload <= 0) {
                this.shoot(enemy);
                this.reload = 30; // КД між пострілами
                break; // Стріляємо тільки в одного за кадр
            }
        }
    }

    draw() {
        if (towerImg.complete && towerImg.src.includes('png')) {
            ctx.drawImage(towerImg, this.x - 20, this.y - 20, 40, 40);
        } else {
            ctx.fillStyle = '#00ffcc';
            ctx.fillRect(this.x - 20, this.y - 20, 40, 40);
        }
        
        // Тонка рамка радіусу дії
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
        ctx.stroke();
    }

    shoot(target) { 
        projectiles.push(new Projectile(this.x, this.y, target)); 
        shootSound.play().catch(() => {}); // catch щоб не вилітало якщо немає mp3 файлу
    }
}

// Снаряд, що летить у ворога
class Projectile {
    constructor(x, y, target) {
        this.x = x; 
        this.y = y; 
        this.target = target;
        this.speed = 7; 
        this.active = true;
    }
    update() {
        // Перевірка чи ворога вже не вбили інші вежі
        if (!enemies.includes(this.target)) { 
            this.active = false; 
            return; 
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 5) {
            this.active = false; // Вибух
            this.target.health -= 25; // Наносимо дамаг
            
            // Спавн ефектів часток
            for (let i = 0; i < 6; i++) {
                particles.push(new Particle(this.x, this.y));
            }
            explosionSound.play().catch(() => {});
        } else {
            // Летимо до цілі
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        }
    }
    draw() {
        ctx.fillStyle = '#ffff00';
        ctx.beginPath(); 
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2); 
        ctx.fill();
    }
}

// Ефекти вибуху (частинки)
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.alpha = 1; // Прозорість
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= 0.04; // Поволі зникає
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(this.x, this.y, 3, 3);
        ctx.restore();
    }
}

// --- КЕРУВАННЯ ГРОЮ, СЛУХАЧІ ПОДІЙ ---

// Подія кліку по карті — будівництво
canvas.addEventListener('click', function(e) {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Математика округлення до клітинок сітки
    const gridX = Math.floor(clickX / gridSize);
    const gridY = Math.floor(clickY / gridSize);

    // Перевірка чи тут вже стоїть вежа, щоб не ставити поверх
    let isOccupied = false;
    for (let i = 0; i < towers.length; i++) {
        if (Math.floor(towers[i].x / gridSize) === gridX && Math.floor(towers[i].y / gridSize) === gridY) {
            isOccupied = true;
            break;
        }
    }

    if (money >= 50 && !isOccupied) {
        towers.push(new Tower(gridX, gridY));
        money -= 50;
        updateUI();
    }
});
window.updateUI = function() {
    const goldEl = document.getElementById('gold');
    const hpEl = document.getElementById('health-display');
    if (goldEl) goldEl.innerText = money;
    if (hpEl) hpEl.innerText = baseHealth;
}

//кнопа наст хвилі
function startNextWave() {
window.startNextWave = function() {
    if (waveInProgress) return;
    waveInProgress = true;
    
    const btn = document.getElementById('wave-button');
    if (btn) { 
        btn.disabled = true; 
        btn.innerText = `Атака...`; 
    }

    let spawned = 0;
    console.log("Хвиля запустилася! Має з'явитися ворогів:", enemiesToSpawn);

    const interval = setInterval(function() {
        // Отримуємо свіжі точки шляху
        const points = getWaypoints(); 
        
        if (spawned >= enemiesToSpawn) {
            clearInterval(interval);
            
            // Перевіряємо, коли з карти зникне останній ворог
            const checkEnd = setInterval(function() {
                if (enemies.length === 0) {
                    clearInterval(checkEnd);
                    waveInProgress = false;
                    currentWave++;
                    enemiesToSpawn = enemiesToSpawn + 2; // збільшуємо кількість на наступну хвилю
                    
                    if (btn) { 
                        btn.disabled = false; 
                        btn.innerText = `Запуск хвилі ${currentWave}`; 
                    }
                    console.log("Хвиля зачищена. Наступна хвиля:", currentWave);
                }
            }, 500);
            return;
        }

        try {
            // Шанс 30% на швидкого синього ворога
            if (Math.random() < 0.3) {
                enemies.push(new FastEnemy(points));
            } else {
                enemies.push(new Enemy(points));
            }
            spawned++;
            console.log(`Спавн ворога #${spawned}`);
        } catch (error) {
            console.error("Помилка під час створення ворога:", error);
        }

    }, 1000); // Новий ворог виходить кожну 1 секунду
}
}

// -= МЄНАЙТОВСЬКИЙ ГАМЕЛОП =- \\
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Малюю сітку фону (для краси)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    const currentWaypoints = getWaypoints();

    // малюєм 
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 36;
    ctx.lineCap = 'round'; 
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(currentWaypoints[0].x, currentWaypoints[0].y);
    for (let i = 1; i < currentWaypoints.length; i++) {
        ctx.lineTo(currentWaypoints[i].x, currentWaypoints[i].y);
    }
    ctx.stroke();

    // Оновлюємо
    towers.forEach(function(t) { t.update(); t.draw(); });
    
    projectiles = projectiles.filter(p => p.active); 
    projectiles.forEach(p => { p.update(); p.draw(); });
    
    particles = particles.filter(p => p.alpha > 0); 
    particles.forEach(p => { p.update(); p.draw(); });

    // Фільтр і логіка ворогів
    enemies = enemies.filter(function(e) {
        if (e.index >= currentWaypoints.length - 1) { 
            baseHealth -= 1; // Блінить базу
            updateUI(); 
            return false; 
        }
        if (e.health <= 0) { 
            money += e.reward; // Хабухнули ворога, отримали гроші
            updateUI(); 
            return false; 
        }
        return true;
    });
    enemies.forEach(e => { e.update(); e.draw(); });

    // Коли вмерла база — кінець гри
    if (baseHealth <= 0) {
        alert(`Гру закінчено! Пройдено хвиль: ${currentWave - 1}`);
        location.reload();
        return;
    }

    requestAnimationFrame(gameLoop);
}

// Запуск бомбочки нащої
updateUI();
gameLoop();