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
  let burstParticles = [];
  let lightningTimer = 0;
  let nextLightning = 3;
  let lightningAlpha = 0;
  let audioCtx = null;
  let rainSource = null;
  let rainGain = null;

  const goodEmojis = [ '🐈‍⬛','🐈','🐕','🦮','🐩', ];
  const hazardEmojis = [ '🦝','🐭','🦨','🐢','🪰','🦡','🐍','🦇' ];
  const rainEmoji = '💧';

  // Don't need to load images anymore, using text emojis
  function loadImages(){
    return Promise.resolve();
  }

 function initAudio(){
  if(audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // 10s flat white noise buffer — no fade, no pulsing loop seam
  const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 10, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0; i<data.length; i++){
    data[i] = (Math.random() * 2 - 1) * 0.8;
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  // Lowpass: cuts hiss above 1200Hz
  const lowpass = audioCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 1200;

  // Highpass: cuts boomy rumble below 400Hz
  const highpass = audioCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 400;

  rainGain = audioCtx.createGain();
  rainGain.gain.value = 0;

  // Chain: source → lowpass → highpass → gain → output
  source.connect(lowpass);
  lowpass.connect(highpass);
  highpass.connect(rainGain);
  rainGain.connect(audioCtx.destination);

  source.start();
  rainSource = source;
}

  function setRainVolume(value){
    if(audioCtx && rainGain){
      rainGain.gain.setTargetAtTime(value, audioCtx.currentTime, 0.1);
    }
  }

  function playTone(frequency, duration, volume, type='sine'){
    if(!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function playMeow(){
    if(!audioCtx) return;
    playTone(523, 0.2, 0.12, 'triangle');
    setTimeout(()=> playTone(660, 0.15, 0.08, 'triangle'), 120);
  }

  function playBark(){
    if(!audioCtx) return;
    playTone(220, 0.12, 0.18, 'square');
    setTimeout(()=> playTone(170, 0.18, 0.12, 'square'), 120);
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
    } else if(rand < 0.875){
      // 37.5% good animals
      emoji = goodEmojis[Math.floor(Math.random() * goodEmojis.length)];
      isGood = true;
    } else {
      // 12.5% hazards
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

    // lightning timing
    nextLightning -= dt;
    if(nextLightning <= 0){
      lightningAlpha = 1;
      nextLightning = 2 + Math.random() * 4;
    }
    lightningAlpha = Math.max(0, lightningAlpha - dt * 1.8);
    
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
          playMeow();
        } else {
          // hazard: lose combo and points, animate a few cats/dogs out of the basket
          combo = 0;
          score = Math.max(0, score - 15);
          scoreEl.textContent = score;
          const burstCount = 3 + Math.floor(Math.random() * 3);
          const choices = goodEmojis;
          for(let j=0;j<burstCount;j++){
            burstParticles.push({
              emoji: choices[Math.floor(Math.random() * choices.length)],
              x: bx + (Math.random()*bw - bw/2),
              y: by - 10,
              vx: (Math.random()-0.5) * 200,
              vy: -150 - Math.random()*120,
              life: 0,
              size: 24 + Math.random()*14
            });
          }
          playBark();
        }
        entities.splice(i,1);
      } else if(e.y > H + 100){ entities.splice(i,1); }
    }
    
    for(let i=burstParticles.length-1;i>=0;i--){
      const p = burstParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
      p.life += dt;
      if(p.life > 1.2 || p.y > H + 50) burstParticles.splice(i,1);
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
      ctx.lineTo(drop.x - 2, drop.y + 12);
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
      } else {
        ctx.shadowBlur = 0;
      }
      
      ctx.fillText(e.emoji, 0, 0);
      ctx.restore();
    }

    // draw burst particles
    for(const p of burstParticles){
      ctx.save();
      ctx.font = `${p.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = Math.max(0, 1 - p.life / 1.2);
      ctx.fillText(p.emoji, p.x, p.y);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // lightning overlay
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if(lightningAlpha > 0 && !isMobile){
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = lightningAlpha * 0.18;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0,0,W,H);
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
    initAudio();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    setRainVolume(0.15);
    nextLightning = 1 + Math.random() * 2;
    lightningAlpha = 0;
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
    setRainVolume(0);  // fade rain out
    if(audioCtx) audioCtx.suspend();
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
      ctx.clearRect(0,0,W,100);
      ctx.fillStyle='rgba(0,13,38,0.8)'; ctx.fillRect(0,0,W,100);
      ctx.font = '60px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for(let i=0;i<caught.length;i++){
        ctx.fillText(caught[i], paradeX + i*60, 50);
      }
      if(paradeX > W + 100){ clearInterval(paradeInterval); canvas.removeEventListener('click', handleParadeClick); paradeFinished(); }
    },40);
  }

  function paradeFinished(){
    alert('Thanks for playing! Final Score: ' + score + ' | Best Combo: ' + maxCombo);
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
  startBtn.addEventListener('touchend', (e) => { e.preventDefault(); startGame(); });
})();
