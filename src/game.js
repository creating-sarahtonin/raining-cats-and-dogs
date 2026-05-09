// Raining Cats and Dogs - game loop with touch support (MVP)
(function(){
  const startBtn = document.getElementById('startBtn');
  const landing = document.getElementById('landing');
  const gameArea = document.getElementById('gameArea');
  const canvas = document.getElementById('gameCanvas');
  const scoreEl = document.getElementById('score');
  const timeEl = document.getElementById('time');
  const ctx = canvas.getContext('2d');
  let W, H;
  function resize(){
    W = canvas.width = gameArea.clientWidth;
    H = canvas.height = gameArea.clientHeight;
  }
  window.addEventListener('resize', resize);

  // Initialize canvas size
  resize();

  // Game state
  let running = false;
  let entities = []; // falling animals
  let raindrops = []; // animated rain
  let basket = { x: 0.5, w: 120, h: 30 };
  let left=false, right=false;
  let score=0;
  let caught=[];
  let last = performance.now();
  let timeLeft=30;
  let initialTime=30;
  let spawnTimer=0;
  let combo=0;
  let maxCombo=0;

  const goodEmojis = [ '🐈', '🐈‍⬛','🐕','🐕‍🦺','🐩','🐅' ];
  const hazardEmojis = [ '🦝','🐭','🦨','🐢','🪰','🦡' ];
  const rainEmoji = '💧';

  // Don't need to load images anymore, using text emojis
  function loadImages(){
    return Promise.resolve();
  }

  function spawn(){
    const timeFraction = 1 - (timeLeft / initialTime);
    const speedMultiplier = 1 + timeFraction * 2; // Speed increases over time
    
    let emoji;
    let isGood = false;
    const rand = Math.random();
    
    if(rand < 0.5){
      // 50% rain
      emoji = rainEmoji;
    } else if(rand < 0.7){
      // 20% good animals
      emoji = goodEmojis[Math.floor(Math.random() * goodEmojis.length)];
      isGood = true;
    } else {
      // 30% hazards
      emoji = hazardEmojis[Math.floor(Math.random() * hazardEmojis.length)];
    }
    
    const size = 32 + Math.random()*24;
    const baseSpeed = 80 + Math.random()*150;
    entities.push({ 
      emoji, 
      x: Math.random()*(W-40)+20, 
      y:-50, 
      vy: baseSpeed * speedMultiplier, 
      size,
      isGood,
      rotation: Math.random() * Math.PI * 2
    });
  }

  function update(dt){
    if(!running) return;
    
    // Dynamic difficulty - spawn rate increases over time
    const timeFraction = 1 - (timeLeft / initialTime);
    const spawnRate = 0.15 - timeFraction * 0.12; // Much faster spawning, from 0.15s to 0.03s
    
    spawnTimer += dt;
    while(spawnTimer > spawnRate){ spawn(); spawnTimer -= spawnRate; }
    
    // Update raindrops
    for(let i=raindrops.length-1;i>=0;i--){
      raindrops[i].y += raindrops[i].speed * (1 + timeFraction * 0.8);
      if(raindrops[i].y > H) raindrops.splice(i, 1);
    }
    
    // basket movement
    const speed = 850; // px/s
    if(left) basket.x -= speed*dt/W; if(right) basket.x += speed*dt/W; // normalized
    basket.x = Math.max(0, Math.min(1, basket.x));

    // update entities
    for(let i=entities.length-1;i>=0;i--){
      const e = entities[i];
      e.y += e.vy*dt;
      e.rotation += dt * 2;
      // check catch
      const bx = basket.x*W;
      const by = H - 40;
      const bw = basket.w;
      const bh = basket.h;
      if(e.y + e.size/2 >= by - bh/2 && e.y - e.size/2 <= by + bh/2 && e.x >= bx - bw/2 && e.x <= bx + bw/2){
        // caught
        if(e.emoji === rainEmoji){
          // Rain doesn't count
        } else if(e.isGood){
          score += 10;
          combo++;
          if(combo > maxCombo) maxCombo = combo;
          caught.push(e.emoji);
          scoreEl.textContent = score;
        } else {
          // hazard: lose combo and points
          combo = 0;
          score = Math.max(0, score - 15);
          scoreEl.textContent = score;
        }
        entities.splice(i,1);
      } else if(e.y > H + 100){ entities.splice(i,1); }
    }
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    // draw storm background (darker)
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#051a2d'); g.addColorStop(1,'#001018');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    
    // Draw animated rain
    ctx.strokeStyle = 'rgba(200,220,255,0.4)';
    ctx.lineWidth = 2;
    for(const drop of raindrops){
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - 2, drop.y + 8);
      ctx.stroke();
    }

    // draw entities
    for(const e of entities){
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.emoji === rainEmoji ? 0 : e.rotation * 0.3);
      ctx.font = `${e.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Add glow for hazards
      if(!e.isGood && e.emoji !== rainEmoji){
        ctx.shadowColor = 'rgba(255,50,50,0.6)';
        ctx.shadowBlur = 15;
      }
      
      ctx.fillText(e.emoji, 0, 0);
      ctx.restore();
    }
    // draw basket
    const bx = basket.x*W;
    ctx.font = '120px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧺', bx, H-40);
    // draw caught count and combo
    if(combo > 0){
      ctx.fillStyle = 'rgba(255,215,0,0.9)';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(`COMBO x${combo}`, W/2, 60);
    }
  }

  function loop(t){
    const dt = Math.min(0.1, (t - last)/1000);
    last = t;
    update(dt);
    draw();
    
    // Spawn new raindrops - more often
    if(running && raindrops.length < 100){
      for(let i=0; i<2; i++){
        raindrops.push({
          x: Math.random() * W,
          y: -10,
          speed: 180 + Math.random() * 200
        });
      }
    }
    
    if(running) requestAnimationFrame(loop);
  }

  async function startGame(){
    await loadImages();
    landing.style.display='none';
    gameArea.style.display='block';
    resize();
    running = true;
    score=0; caught=[]; combo=0; maxCombo=0; timeLeft=30; initialTime=30; raindrops=[]; scoreEl.textContent='0'; timeEl.textContent='30';
    
    // Initialize rain - much more
    for(let i=0; i<80; i++){
      raindrops.push({
        x: Math.random() * W,
        y: Math.random() * H,
        speed: 180 + Math.random() * 200
      });
    }
    last = performance.now();
    // timer
    const timerId = setInterval(()=>{
      timeLeft -= 1; timeEl.textContent = String(timeLeft);
      if(timeLeft <= 0){ clearInterval(timerId); endGame(); }
    },1000);
    requestAnimationFrame(loop);
  }

  function endGame(){
    running = false;
    // parade: animate caught animals across screen for a short sequence
    let paradeX = -100;
    let named = new Set();
    function handleParadeClick(e){
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      for(let i=0;i<caught.length;i++){
        const ax = paradeX + i*60;
        if(x >= ax-20 && x <= ax+20 && y >= 20 && y <= 60 && !named.has(i)){
          const name = prompt(`Name your ${caught[i]}:`) || '';
          if(name){
            localStorage.setItem(`rained_pet_name_${i}`, name);
            named.add(i);
          }
        }
      }
    }
    canvas.addEventListener('click', handleParadeClick);
    const paradeInterval = setInterval(()=>{
      paradeX += 8;
      // draw overlay
      ctx.clearRect(0,0,W,80);
      ctx.fillStyle='#021027'; ctx.fillRect(0,0,W,80);
      for(let i=0;i<caught.length;i++){
        ctx.drawImage(images[caught[i]], paradeX + i*60 - 20, 20, 40, 40);
      }
      if(paradeX > W + 100){ clearInterval(paradeInterval); canvas.removeEventListener('click', handleParadeClick); paradeFinished(); }
    },40);
  }

  function paradeFinished(){
    alert('Thanks for playing!');
    // show landing again
    landing.style.display='block'; gameArea.style.display='none';
  }

  // input handlers
  window.addEventListener('keydown', (e)=>{ if(e.key==='ArrowLeft') left=true; if(e.key==='ArrowRight') right=true; });
  window.addEventListener('keyup', (e)=>{ if(e.key==='ArrowLeft') left=false; if(e.key==='ArrowRight') right=false; });

  // touch support: move basket by touching or dragging
  function handleTouch(e){
    if(!running) return;
    const t = e.touches[0];
    if(!t) return;
    const rect = canvas.getBoundingClientRect();
    const x = t.clientX - rect.left;
    basket.x = Math.max(0, Math.min(1, x / W));
    e.preventDefault();
  }
  canvas.addEventListener('touchstart', handleTouch, { passive:false });
  canvas.addEventListener('touchmove', handleTouch, { passive:false });

  startBtn.addEventListener('click', () => startGame());
})();
