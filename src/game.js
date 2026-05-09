// Minimal game loop for Raining Cats and Dogs (MVP)
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

  // Game state
  let running = false;
  let entities = []; // falling animals
  let basket = { x: 0.5, w: 120, h: 30 };
  let left=false, right=false;
  let score=0;
  let caught=[];
  let timeLeft=60;
  let spawnTimer=0;

  const types = [ 'cat','dog','raccoon','possum' ];

  function spawn(){
    const t = Math.random() < 0.75 ? (Math.random()<0.5?'cat':'dog') : (Math.random()<0.5?'raccoon':'possum');
    const size = 24 + Math.random()*30;
    entities.push({ type:t, x: Math.random()*(W-40)+20, y:-50, vy: 60+Math.random()*120, size });
  }

  function update(dt){
    if(!running) return;
    spawnTimer += dt;
    if(spawnTimer > 0.5){ spawn(); spawnTimer=0; }
    // basket movement
    const speed = 800; // px/s
    if(left) basket.x -= speed*dt/W; if(right) basket.x += speed*dt/W; // normalized
    basket.x = Math.max(0, Math.min(1, basket.x));

    // update entities
    for(let i=entities.length-1;i>=0;i--){
      const e = entities[i];
      e.y += e.vy*dt;
      // check catch
      const bx = basket.x*W;
      const by = H - 40;
      const bw = basket.w;
      const bh = basket.h;
      if(e.y + e.size/2 >= by - bh/2 && e.y - e.size/2 <= by + bh/2 && e.x >= bx - bw/2 && e.x <= bx + bw/2){
        // caught
        if(e.type==='cat' || e.type==='dog'){
          score += (e.type==='cat'?10:15);
          caught.push(e.type);
          scoreEl.textContent = score;
        } else {
          // hazard: pop basket and remove 1-3 caught animals
          const remove = Math.min(caught.length, 1 + Math.floor(Math.random()*3));
          caught.splice(-remove, remove);
          score = Math.max(0, score - remove*20);
          scoreEl.textContent = score;
        }
        entities.splice(i,1);
      } else if(e.y > H + 100){ entities.splice(i,1); }
    }
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    // draw rain/storm background (simple lines)
    ctx.fillStyle = '#021027';
    ctx.fillRect(0,0,W,H);
    for(let i=0;i<80;i++){
      ctx.strokeStyle = 'rgba(173,216,230,0.02)';
      ctx.beginPath(); ctx.moveTo((i*53)%W,(i*17)%H); ctx.lineTo(((i*53)+10)%W, ((i*17)+30)%H); ctx.stroke();
    }

    // draw entities
    for(const e of entities){
      if(e.type==='cat') ctx.fillStyle='orange';
      else if(e.type==='dog') ctx.fillStyle='saddlebrown';
      else ctx.fillStyle='gray';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.size/2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='10px sans-serif'; ctx.fillText(e.type[0].toUpperCase(), e.x-4, e.y+4);
    }
    // draw basket
    const bx = basket.x*W;
    ctx.fillStyle='#663300'; ctx.fillRect(bx - basket.w/2, H-60, basket.w, basket.h);
    // draw caught count
    ctx.fillStyle='#fff'; ctx.font='14px sans-serif'; ctx.fillText(`Caught: ${caught.length}`, 10, H-10);
  }

  let last = performance.now();
  function loop(t){
    const dt = Math.min(0.1, (t - last)/1000);
    last = t;
    update(dt);
    draw();
    if(running) requestAnimationFrame(loop);
  }

  function startGame(){
    landing.style.display='none';
    gameArea.style.display='block';
    resize();
    running = true;
    score=0; caught=[]; timeLeft=60; scoreEl.textContent='0'; timeEl.textContent='60';
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
    // parade: animate caught animals across screen
    // Simple representation: draw them moving across top for 6s
    let paradeX = -100;
    const paradeInterval = setInterval(()=>{
      paradeX += 8;
      // redraw overlay
      ctx.clearRect(0,0,W,80);
      ctx.fillStyle='#021027'; ctx.fillRect(0,0,W,80);
      for(let i=0;i<caught.length;i++){
        ctx.fillStyle = (caught[i]==='cat'?'orange':'saddlebrown');
        ctx.beginPath(); ctx.arc(paradeX + i*60, 40, 20,0,Math.PI*2); ctx.fill();
      }
      if(paradeX > W + 100){ clearInterval(paradeInterval); paradeFinished(); }
    },40);
  }

  function paradeFinished(){
    if(caught.length > 0){
      // allow naming first pet
      const first = caught[0];
      const name = prompt(`You caught a ${first}! Give it a name:`) || '';
      if(name) localStorage.setItem('rained_pet_name', name);
      alert('Thanks for playing!');
    } else alert('No pets caught — try again!');
    // show landing again
    landing.style.display='block'; gameArea.style.display='none';
  }

  // input handlers
  window.addEventListener('keydown', (e)=>{ if(e.key==='ArrowLeft') left=true; if(e.key==='ArrowRight') right=true; });
  window.addEventListener('keyup', (e)=>{ if(e.key==='ArrowLeft') left=false; if(e.key==='ArrowRight') right=false; });

  startBtn.addEventListener('click', startGame);
})();
