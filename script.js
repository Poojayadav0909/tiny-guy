
(() => {

  "use strict";

  // These are all the colors in our game.
  const colors = {
    night: "#1d1a2f",
    desk: "#c98f5b",
    deskDark: "#a8703f",
    ink: "#2b2d42",
    paper: "#f4efe6",
    red: "#e63946",
    yellow: "#ffd166",
    green: "#06d6a0",
    blue: "#4cc9f0",
    pink: "#ff8fab",
    skin: "#ffe0bd",
    crumb: "#e8c07d"
  };

  // The player can choose one of these shirt colors.
  const shirtColors = [
    colors.red,
    colors.yellow,
    colors.green,
    colors.blue,
    colors.pink,
    "#9b5de5",
    colors.paper
  ];

  // This is how big our desk is.
  const world = {
    w: 3200,
    h: 2000
  };

  const playerSize = 9;
  const speed = 150;
  const maxCrumbs = 8;
  const goal = 60;

  const zoomIn = 2.4;
  const zoomOut = 0.55;

  const networkTime = 100;
  const playerTimeout = 3000;

  const emojis = {
    1: "😀",
    2: "👋",
    3: "❤️",
    4: "😂"
  };

  // This is  home.
  const home = {
    x: 300,
    y: 400,
    r: 70
  };

  // This helps us find things in HTML.
  function get(id) {
    return document.getElementById(id);
  }

  const canvas = get("c");
  const ctx = canvas.getContext("2d");

  const chatInput = get("chatInput");
  const chatLog = get("chatLog");

 
  // CHOOSE  SHIRT
 

  let shirt = shirtColors[
    Math.floor(Math.random() * shirtColors.length)
  ];

  shirtColors.forEach(function(color) {
    const box = document.createElement("div");

    box.className = "swatch";

    if (color === shirt) {
      box.classList.add("active");
    }

    box.style.background = color;

    box.onclick = function() {
      shirt = color;

      document.querySelectorAll(".swatch").forEach(function(item) {
        item.classList.remove("active");
      });

      box.classList.add("active");
    };

    get("swatches").appendChild(box);
  });

  // Press Enter to join the game.
  get("nameInput").addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
      get("joinBtn").click();
    }
  });

  // Click Join to start playing.
  get("joinBtn").onclick = function() {
    let name = get("nameInput").value.trim();

    if (name === "") {
      name = "tiny" + Math.floor(Math.random() * 99);
    }

    get("join").classList.add("hidden");
    get("game").classList.remove("hidden");

    startGame(name, shirt);
  };

  
  // BIG THINGS ON OUR DESK
 

  // We cannot walk through these objects.
  const solids = [
    { t: "rect", x: 170, y: 150, w: 260, h: 170, id: "matchbox" },
    { t: "circle", x: 750, y: 800, r: 150, id: "mug" },
    { t: "rect", x: 1500, y: 260, w: 420, h: 280, id: "books" },
    { t: "rect", x: 900, y: 1150, w: 650, h: 46, id: "pencil" },
    { t: "rect", x: 2550, y: 300, w: 50, h: 700, id: "pencil2" },
    { t: "rect", x: 1750, y: 950, w: 170, h: 90, id: "eraser" },
    { t: "rect", x: 2300, y: 800, w: 260, h: 110, id: "stapler" },
    { t: "circle", x: 1250, y: 1650, r: 90, id: "tape" }
  ];

  // We can walk over these things
  const flats = [
    { id: "keyboard", x: 250, y: 1300, w: 900, h: 380 },
    { id: "notebook", x: 2050, y: 1250, w: 600, h: 430 },
    { id: "sticky", x: 1000, y: 780, w: 180, h: 180 }
  ];

  // These little lines make the desk look like wood
  const grain = [];

  let seed = 7;

  function woodRandom() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }

  for (let i = 0; i < 90; i++) {
    grain.push({
      y: woodRandom() * world.h,
      x: woodRandom() * world.w,
      l: 200 + woodRandom() * 700
    });
  }

  
  // GAME INFORMATION
  

  let me;
  let others = new Map();

  let crumbs = [];
  let carried = 0;
  let delivered = 0;

  const keys = {};

  let chatting = false;
  let zoom = zoomIn;
  let lastNet = 0;

  let activeNpc = null;
  let channel = null;

  let shake = 0;
  let castleDone = false;

  const myId = Math.random().toString(36).slice(2, 9);

  // This is our scary cat paw.
  const paw = {
    state: "idle",
    next: 3000,
    x: 0,
    y: 0,
    t0: 0,
    hit: false
  };

  // This is our ant friend.
  const ant = {
    name: "Big Ant Bob",
    x: 1250,
    y: 1000,

    home: {
      x: 1250,
      y: 1000
    },

    dir: 1,
    target: null,
    i: -1,

    lines: [
      "i am 100 times your size and i am also tiny. everything is relative.",
      "the cat paw lands where the shadow grows. move!",
      "carry crumbs home. 60 crumbs = a castle. i checked the math.",
      "i once lifted a whole cracker. nobody clapped."
    ]
  };

 
  // START OUR GAME
 

  function startGame(name, color) {
    me = {
      id: myId,
      name: name,
      color: color,

      x: home.x + 20,
      y: home.y + 100,

      dir: 1,
      moving: false,

      msg: null,
      msgUntil: 0,

      emote: null,
      emoteUntil: 0,

      delivered: 0
    };

    makeCrumbs(70);

    setupInput();
    setupNetwork();
    resize();

    addEventListener("resize", resize);

    systemMessage("you are a very small guy. be brave.");

    requestAnimationFrame(gameLoop);
  }

  // Make the game fit our screen.
  function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }

 
  // SMALL HELPER FUNCTIONS

  // Keep a number between two numbers.
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // Get a random number.
  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  // Find how far two things are from each other.
  function distance(x1, y1, x2, y2) {
    return Math.hypot(x1 - x2, y1 - y2);
  }

  // Check if we are touching a big object.
  function hitSolid(object, x, y, radius) {
    if (object.t === "circle") {
      return distance(x, y, object.x, object.y) < object.r + radius;
    }

    const nearX = clamp(x, object.x, object.x + object.w);
    const nearY = clamp(y, object.y, object.y + object.h);

    return distance(x, y, nearX, nearY) < radius;
  }

  // Check if we are allowed to walk somewhere
  function blocked(x, y, radius = playerSize) {
    if (x < radius) return true;
    if (y < radius + 70) return true;
    if (x > world.w - radius) return true;
    if (y > world.h - radius) return true;

    return solids.some(function(object) {
      return hitSolid(object, x, y, radius);
    });
  }

  
  // MAKE CRUMBS
 
  function makeCrumbs(amount) {
    let tries = 0;

    while (crumbs.length < amount && tries < 500) {
      tries++;

      const x = random(60, world.w - 60);
      const y = random(120, world.h - 60);

      const isBlocked = blocked(x, y, 16);
      const nearHome = distance(x, y, home.x, home.y) <= 140;

      if (!isBlocked && !nearHome) {
        crumbs.push({
          x: x,
          y: y,
          a: random(0, 6),
          s: random(5, 8)
        });
      }
    }
  }

 
  // GAME SOUNDS
 

  let audio = null;

  function beep(freq, duration = 0.08, type = "square", volume = 0.04, slide = 0) {
    try {
      if (!audio) {
        audio = new (window.AudioContext || window.webkitAudioContext)();
      }

      const sound = audio.createOscillator();
      const gain = audio.createGain();

      sound.type = type;
      sound.frequency.value = freq;

      if (slide) {
        sound.frequency.linearRampToValueAtTime(
          freq + slide,
          audio.currentTime + duration
        );
      }

      gain.gain.value = volume;

      sound.connect(gain);
      gain.connect(audio.destination);

      sound.start();

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audio.currentTime + duration
      );

      sound.stop(audio.currentTime + duration);
    } catch (error) {
      // It is okay if the browser does not allow sound yet.
    }
  }

  
  // KEYBOARD CONTROLS
 

  function setupInput() {
    addEventListener("keydown", function(event) {
      // If we are chatting, type the message first.
      if (chatting) {
        if (event.key === "Enter") {
          const text = chatInput.value.trim();

          if (text) {
            say(text);
          }

          chatInput.value = "";
          chatInput.blur();
          chatting = false;
        }

        else if (event.key === "Escape") {
          chatInput.value = "";
          chatInput.blur();
          chatting = false;
        }

        return;
      }

      // Open chat with Enter.
      if (event.key === "Enter") {
        chatting = true;
        chatInput.focus();
        event.preventDefault();
        return;
      }

      const key = event.key.toLowerCase();

      keys[key] = true;

      // Numbers show emojis.
      if (emojis[event.key]) {
        showEmoji(emojis[event.key]);
      }

      // E talks to the ant
      if (key === "e") {
        talkToAnt();
      }

      // Space makes a squeak
      if (key === " ") {
        squeak();
        event.preventDefault();
      }

      if (key.startsWith("arrow")) {
        event.preventDefault();
      }
    });

    // Stop moving when the key is released
    addEventListener("keyup", function(event) {
      keys[event.key.toLowerCase()] = false;
    });

    // Stop moving when we leave the game window
    addEventListener("blur", function() {
      for (const key in keys) {
        keys[key] = false;
      }
    });

    // Buttons for playing on a phone
    const buttonKeys = {
      up: "w",
      down: "s",
      left: "a",
      right: "d"
    };

    document.querySelectorAll("#dpad button").forEach(function(button) {
      const key = buttonKeys[button.dataset.k];

      button.addEventListener("pointerdown", function(event) {
        keys[key] = true;
        event.preventDefault();
      });

      ["pointerup", "pointerleave"].forEach(function(type) {
        button.addEventListener(type, function(event) {
          keys[key] = false;
          event.preventDefault();
        });
      });
    });
  }

  // EMOJIS AND CHAT
 

  function showEmoji(symbol) {
    me.emote = symbol;
    me.emoteUntil = performance.now() + 2500;

    send({
      type: "emote",
      id: me.id,
      emote: symbol
    });

    beep(660, 0.1, "triangle");
  }

  function squeak() {
    showEmoji("!");
    beep(1200, 0.12, "square", 0.05, 500);
  }

  function say(text) {
    me.msg = text;
    me.msgUntil = performance.now() + 5000;

    addChat(me.name, text, me.color);

    send({
      type: "chat",
      id: me.id,
      name: me.name,
      color: me.color,
      text: text
    });

    beep(900, 0.06, "square");
  }

  function addChat(name, text, color) {
    const line = document.createElement("div");
    line.className = "line";

    const bold = document.createElement("b");
    bold.style.color = color;
    bold.textContent = name + ": ";

    line.append(bold, document.createTextNode(text));

    chatLog.appendChild(line);

    while (chatLog.children.length > 6) {
      chatLog.removeChild(chatLog.firstChild);
    }

    setTimeout(function() {
      line.remove();
    }, 12000);
  }

  function systemMessage(text) {
    const line = document.createElement("div");

    line.className = "line sys";
    line.textContent = text;

    chatLog.appendChild(line);

    setTimeout(function() {
      line.remove();
    }, 12000);
  }

  // A small message that appears for a little whil
  let toastTimer = 0;

  function toast(text) {
    const box = get("toast");

    box.textContent = text;
    box.classList.remove("hidden");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(function() {
      box.classList.add("hidden");
    }, 1800);
  }

  
  // TALK TO OUR ANT FRIEND
 

  function talkToAnt() {
    if (activeNpc) {
      activeNpc = null;
      get("dialog").classList.add("hidden");
      return;
    }

    const howFar = distance(ant.x, ant.y, me.x, me.y);

    if (howFar < 90) {
      activeNpc = ant;

      ant.i = (ant.i + 1) % ant.lines.length;

      get("dName").textContent = ant.name;
      get("dText").textContent = ant.lines[ant.i];

      get("dialog").classList.remove("hidden");

      beep(500, 0.08, "triangle");
    }
  }

  
  // MULTIPLAYER

  // Share where  player is
  function playerInfo() {
    return {
      id: me.id,
      name: me.name,
      color: me.color,
      x: me.x,
      y: me.y,
      dir: me.dir,
      moving: me.moving,
      delivered: delivered
    };
  }

  function send(message) {
    if (channel) {
      channel.postMessage(message);
    }
  }

  function setupNetwork() {
    if (!("BroadcastChannel" in window)) {
      return;
    }

    channel = new BroadcastChannel("little-guy-big-desk");

    channel.onmessage = function(event) {
      const message = event.data;

      if (!message) return;
      if (message.id === me.id) return;

      const now = performance.now();

      // Another player's position.
      if (message.type === "state") {
        let player = others.get(message.id);

        if (!player) {
          player = {
            id: message.id,
            x: message.x,
            y: message.y
          };

          others.set(message.id, player);

          systemMessage(message.name + " hopped on the desk");

          send({
            type: "state",
            ...playerInfo()
          });
        }

        Object.assign(player, {
          name: message.name,
          color: message.color,
          dir: message.dir,
          moving: message.moving,
          tx: message.x,
          ty: message.y,
          delivered: message.delivered,
          seen: now
        });
      }

      // Another player's chat.
      else if (message.type === "chat") {
        const player = others.get(message.id);

        if (player) {
          player.msg = message.text;
          player.msgUntil = now + 5000;
        }

        addChat(message.name, message.text, message.color);
      }

      // Another player's emoji.
      else if (message.type === "emote") {
        const player = others.get(message.id);

        if (player) {
          player.emote = message.emote;
          player.emoteUntil = now + 2500;
        }
      }

      // A player leaves.
      else if (message.type === "bye") {
        const player = others.get(message.id);

        if (player) {
          systemMessage(player.name + " left");
        }

        others.delete(message.id);
      }
    };

    addEventListener("beforeunload", function() {
      send({
        type: "bye",
        id: me.id
      });
    });

    send({
      type: "state",
      ...playerInfo()
    });
  }


  // MAIN GAME LOOP
 

  let lastTime = performance.now();

  function gameLoop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);

    lastTime = now;

    updateGame(dt, now);
    drawGame(now);

    requestAnimationFrame(gameLoop);
  }

  
  // UPDATE  GAME
  

  function updateGame(dt, now) {
    let dx = 0;
    let dy = 0;

    // Move with WASD or arrow keys
    if (!chatting) {
      if (keys["w"] || keys["arrowup"]) {
        dy--;
      }

      if (keys["s"] || keys["arrowdown"]) {
        dy++;
      }

      if (keys["a"] || keys["arrowleft"]) {
        dx--;
      }

      if (keys["d"] || keys["arrowright"]) {
        dx++;
      }
    }

    me.moving = Boolean(dx || dy);

    if (me.moving) {
      // This keeps diagonal movement at the same speed
      const length = Math.hypot(dx, dy);

      dx = dx / length;
      dy = dy / length;

      if (dx) {
        me.dir = dx > 0 ? 1 : -1;
      }

      const newX = me.x + dx * speed * dt;
      const newY = me.y + dy * speed * dt;

      if (!blocked(newX, me.y)) {
        me.x = newX;
      }

      if (!blocked(me.x, newY)) {
        me.y = newY;
      }

      // Walking closes the ant's dialog
      if (activeNpc) {
        activeNpc = null;
        get("dialog").classList.add("hidden");
      }
    }

    // Hide old messages and emojis
    if (me.msg && now > me.msgUntil) {
      me.msg = null;
    }

    if (me.emote && now > me.emoteUntil) {
      me.emote = null;
    }

    // Hold Z to zoom out.
    let targetZoom = zoomIn;

    if (keys["z"] && !chatting) {
      targetZoom = zoomOut;
    }

    zoom += (targetZoom - zoom) * Math.min(1, dt * 6);

    
    // PICK UP CRUMBS
  

    for (let i = crumbs.length - 1; i >= 0; i--) {
      const crumb = crumbs[i];

      const nearCrumb = distance(
        crumb.x,
        crumb.y,
        me.x,
        me.y
      ) < 18;

      if (carried < maxCrumbs && nearCrumb) {
        crumbs.splice(i, 1);

        carried++;

        beep(800 + carried * 60, 0.06, "square");
      }
    }

    // Add new crumbs when there are fewer crumbs
    if (crumbs.length < 50 && Math.random() < dt * 2) {
      makeCrumbs(crumbs.length + 1);
    }

    
    // TAKE CRUMBS HOME
  
    const nearHome = distance(
      me.x,
      me.y,
      home.x,
      home.y
    ) < home.r;

    if (carried > 0 && nearHome) {
      delivered += carried;

      toast("+" + carried + " crumbs home!");

      beep(523, 0.1, "triangle");

      setTimeout(function() {
        beep(784, 0.15, "triangle");
      }, 100);

      carried = 0;

      // We win after bringing 60 crumbs home.
      if (delivered >= goal && !castleDone) {
        castleDone = true;

        toast("🏰 TINY CASTLE BUILT! little guy did it!");

        systemMessage(
          "castle complete. you're still a little guy though."
        );
      }
    }

    // Update the cat.
    updateCat(now);

   
    // MAKE THE ANT WALK
   

    if (ant !== activeNpc) {
      const reachedTarget = ant.target &&
        distance(ant.x, ant.y, ant.target.x, ant.target.y) < 6;

      if (!ant.target || reachedTarget) {
        if (Math.random() < dt * 0.5) {
          const target = {
            x: ant.home.x + random(-200, 200),
            y: ant.home.y + random(-150, 150)
          };

          if (!blocked(target.x, target.y, 30)) {
            ant.target = target;
          }
        }
      }

      else {
        const angle = Math.atan2(
          ant.target.y - ant.y,
          ant.target.x - ant.x
        );

        const newX = ant.x + Math.cos(angle) * 55 * dt;
        const newY = ant.y + Math.sin(angle) * 55 * dt;

        if (!blocked(newX, newY, 30)) {
          ant.x = newX;
          ant.y = newY;
          ant.dir = Math.cos(angle) >= 0 ? 1 : -1;
          ant.ang = angle;
        }

        else {
          ant.target = null;
        }
      }
    }

   
    // UPDATE OTHER PLAYERS
    

    let onlineCount = 1;

    for (const [id, player] of others) {
      if (now - player.seen > playerTimeout) {
        systemMessage(player.name + " left");
        others.delete(id);
        continue;
      }

      // Make other players move smoothly.
      player.x += (player.tx - player.x) * Math.min(1, dt * 12);
      player.y += (player.ty - player.y) * Math.min(1, dt * 12);

      if (player.msg && now > player.msgUntil) {
        player.msg = null;
      }

      if (player.emote && now > player.emoteUntil) {
        player.emote = null;
      }

      onlineCount++;
    }

  
    // SHOW OUR SCORE
    
    get("carry").textContent =
      `🍪 carrying ${carried}/${maxCrumbs}`;

    get("deliv").textContent =
      `🏠 delivered ${delivered}`;

    get("online").textContent =
      `👥 ${onlineCount}`;

    const percent = Math.min(
      100,
      Math.round((delivered / goal) * 100)
    );

    get("castleFill").style.width = percent + "%";
    get("castleText").textContent = `tiny castle ${percent}%`;

    // Make our leaderboard.
    const players = [
      {
        name: me.name,
        d: delivered,
        me: true
      }
    ];

    for (const player of others.values()) {
      players.push({
        name: player.name,
        d: player.delivered || 0
      });
    }

    players.sort(function(a, b) {
      return b.d - a.d;
    });

    const topFive = players.slice(0, 5);

    get("board").innerHTML =
      "<b>top little guys</b><br>" +
      topFive.map(function(player) {
        const arrow = player.me ? "▶ " : "";
        return `${arrow}${player.name} ${player.d}`;
      }).join("<br>");

    // Slowly stop shaking the screen
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 30);
    }

    // Tell friends where we are
    if (now - lastNet > networkTime) {
      lastNet = now;

      send({
        type: "state",
        ...playerInfo()
      });
    }
  }

  
  // THE CAT PAW
  
  const warnTime = Math.max(0, 1500);
  const slamTime = 500;

  function updateCat(now) {
    // The cat starts looking for us.
    if (paw.state === "idle" && now > paw.next) {
      paw.state = "warn";
      paw.t0 = now;
      paw.hit = false;

      paw.x = me.x + random(-60, 60);
      paw.y = me.y + random(-60, 60);
    }

    // The cat attacks after the warning.
    else if (
      paw.state === "warn" &&
      now - paw.t0 > warnTime - Math.min(500, delivered * 6)
    ) {
      paw.state = "slam";
      paw.t0 = now;

      shake = 12;

      beep(90, 0.3, "sawtooth", 0.08, -40);

      if (distance(me.x, me.y, paw.x, paw.y) < 110) {
        catGotMe();
      }
    }

    // The cat goes away.
    else if (
      paw.state === "slam" &&
      now - paw.t0 > slamTime
    ) {
      paw.state = "idle";

      paw.next = now +
        random(3000, 6000) -
        Math.min(1500, delivered * 20);
    }
  }

  // When the cat catches us.
  function catGotMe() {
    let message = "SPLAT! the cat got you 🐾";

    if (carried) {
      message += ` (lost ${carried} crumbs)`;
    }

    toast(message);

    // Drop all our crumbs.
    for (let i = 0; i < carried; i++) {
      crumbs.push({
        x: me.x + random(-60, 60),
        y: me.y + random(-60, 60),
        a: random(0, 6),
        s: random(5, 8)
      });
    }

    carried = 0;

    // Go back home.
    me.x = home.x + 20;
    me.y = home.y + 100;
  }

 
  // CAMERA
 
  let cameraX = 0;
  let cameraY = 0;

  let offsetX = 0;
  let offsetY = 0;

  // Find where something should appear on the screen.
  function toScreen(x, y) {
    return {
      x: (x - cameraX + offsetX) * zoom,
      y: (y - cameraY + offsetY) * zoom
    };
  }

  
  // DRAW THE WHOLE GAME
 
  function drawGame(now) {
    const width = canvas.width;
    const height = canvas.height;

    const viewWidth = width / zoom;
    const viewHeight = height / zoom;

    cameraX = clamp(
      me.x - viewWidth / 2,
      0,
      Math.max(0, world.w - viewWidth)
    );

    cameraY = clamp(
      me.y - viewHeight / 2,
      0,
      Math.max(0, world.h - viewHeight)
    );

    offsetX = world.w < viewWidth ?
      (viewWidth - world.w) / 2 : 0;

    offsetY = world.h < viewHeight ?
      (viewHeight - world.h) / 2 : 0;

    const shakeX = shake ? random(-shake, shake) : 0;
    const shakeY = shake ? random(-shake, shake) : 0;

    // Clear the screen.
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.fillStyle = colors.night;
    ctx.fillRect(0, 0, width, height);

    // Move the camera.
    ctx.setTransform(
      zoom,
      0,
      0,
      zoom,
      (-cameraX + offsetX) * zoom + shakeX,
      (-cameraY + offsetY) * zoom + shakeY
    );

    // Draw everything on our desk
    drawDesk();

    flats.forEach(drawFlat);

    drawHome();

    crumbs.forEach(function(crumb) {
      drawCrumb(crumb, now);
    });

    // Draw things in the right order.
    const things = [];

    solids.forEach(function(object) {
      things.push({
        y: object.t === "circle" ? object.y : object.y + object.h,
        draw: function() {
          drawSolid(object);
        }
      });
    });

    things.push({
      y: ant.y,
      draw: function() {
        drawAnt(now);
      }
    });

    others.forEach(function(player) {
      things.push({
        y: player.y,
        draw: function() {
          drawPlayer(player, now, false);
        }
      });
    });

    things.push({
      y: me.y,
      draw: function() {
        drawPlayer(me, now, true);
      }
    });

    things.sort(function(a, b) {
      return a.y - b.y;
    });

    things.forEach(function(thing) {
      thing.draw();
    });

    drawCatPaw(now);

    // Reset the camera to draw readable names.
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const allPlayers = [...others.values(), me];

    allPlayers.forEach(function(player) {
      const position = toScreen(player.x, player.y);

      const nameColor = player === me ?
        colors.yellow : "#fff";

      drawTag(
        player.name,
        position.x,
        position.y - 20 * zoom,
        nameColor
      );

      if (player.msg) {
        drawBubble(
          player.msg,
          position.x,
          position.y - 30 * zoom
        );
      }

      if (player.emote) {
        ctx.font = `${Math.max(18, 14 * zoom)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";

        ctx.fillText(
          player.emote,
          position.x,
          position.y - 34 * zoom
        );
      }
    });

    // Show the ant's name
    const antPosition = toScreen(ant.x, ant.y);

    drawTag(
      ant.name,
      antPosition.x,
      antPosition.y - 34 * zoom,
      colors.blue
    );

    if (
      !activeNpc &&
      distance(ant.x, ant.y, me.x, me.y) < 90
    ) {
      drawTag(
        "press E",
        antPosition.x,
        antPosition.y - 50 * zoom,
        "#fff"
      );
    }

    // Funny message when we zoom out.
    if (zoom < 1) {
      const position = toScreen(me.x, me.y);

      ctx.strokeStyle = colors.red;
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.arc(position.x, position.y, 22, 0, 7);
      ctx.stroke();

      drawTag(
        "← that's you. tiny.",
        position.x + 90,
        position.y - 28,
        colors.red
      );
    }
  }

  
  // DRAW OUR DESK
 

  function drawDesk() {
    ctx.fillStyle = colors.desk;
    ctx.fillRect(0, 0, world.w, world.h);
    // Draw little wood lines.
    ctx.strokeStyle = colors.deskDark;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.45;

    grain.forEach(function(line) {
      ctx.beginPath();

      ctx.moveTo(line.x, line.y);

      ctx.bezierCurveTo(
        line.x + line.l / 3,
        line.y - 8,
        line.x + line.l * 0.66,
        line.y + 8,
        line.x + line.l,
        line.y
      );

      ctx.stroke();
    });

    ctx.globalAlpha = 1;

    // Draw old mug marks.
    ctx.strokeStyle = "rgba(80,40,10,.25)";
    ctx.lineWidth = 8;

    ctx.beginPath();
    ctx.arc(2700, 1650, 90, 0, 7);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(2720, 1660, 84, 0, 7);
    ctx.stroke();

    // Draw the yellow ruler.
    ctx.fillStyle = colors.yellow;
    ctx.fillRect(0, 0, world.w, 70);

    ctx.fillStyle = colors.ink;
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";

    for (let x = 0; x < world.w; x += 20) {
      const bigLine = x % 100 === 0;

      const lineHeight = bigLine ? 34 : 16;

      ctx.fillRect(
        x,
        70 - lineHeight,
        2,
        lineHeight
      );

      if (bigLine) {
        ctx.fillText(String(x / 100), x + 5, 24);
      }
    }

    ctx.font = "bold 14px monospace";

    ctx.fillText(
      "cm  (you are ~0.2 of one. sorry.)",
      1500,
      52
    );

    // Draw the desk border
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 12;

    ctx.strokeRect(0, 0, world.w, world.h);
  }
  // DRAW FLAT THINGS
  function drawFlat(object) {
    // Keyboard.
    if (object.id === "keyboard") {
      ctx.fillStyle = colors.ink;

      ctx.fillRect(
        object.x,
        object.y,
        object.w,
        object.h
      );

      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 15; col++) {
          if ((row + col) % 7 === 0) {
            ctx.fillStyle = colors.red;
          } else {
            ctx.fillStyle = colors.paper;
          }

          ctx.fillRect(
            object.x + 16 + col * 58,
            object.y + 16 + row * 68,
            50,
            56
          );
        }
      }
    }

    // Notebook
    else if (object.id === "notebook") {
      ctx.fillStyle = colors.paper;

      ctx.fillRect(
        object.x,
        object.y,
        object.w,
        object.h
      );

      ctx.strokeStyle = colors.blue;
      ctx.lineWidth = 2;

      for (
        let y = object.y + 40;
        y < object.y + object.h;
        y += 34
      ) {
        ctx.beginPath();
        ctx.moveTo(object.x, y);
        ctx.lineTo(object.x + object.w, y);
        ctx.stroke();
      }

      ctx.strokeStyle = colors.red;

      ctx.beginPath();
      ctx.moveTo(object.x + 60, object.y);
      ctx.lineTo(object.x + 60, object.y + object.h);
      ctx.stroke();

      ctx.fillStyle = colors.ink;
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "left";

      ctx.fillText("TODO:", object.x + 80, object.y + 70);
      ctx.fillText("1. be bigger", object.x + 80, object.y + 104);
      ctx.fillText("2. (failed)", object.x + 80, object.y + 138);
      ctx.fillText("3. get crumbs", object.x + 80, object.y + 172);
    }

    // Sticky note.
    else if (object.id === "sticky") {
      ctx.fillStyle = colors.yellow;

      ctx.fillRect(
        object.x,
        object.y,
        object.w,
        object.h
      );

      ctx.fillStyle = colors.ink;
      ctx.font = "bold 26px monospace";
      ctx.textAlign = "center";

      ctx.fillText(
        "hi tiny!",
        object.x + object.w / 2,
        object.y + 80
      );

      ctx.fillText(
        ":)",
        object.x + object.w / 2,
        object.y + 120
      );
    }
  }


  // DRAW OUR HOME AND CASTLE
  
  function drawHome() {
    // Green home circle.
    ctx.strokeStyle = colors.green;
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 10]);

    ctx.beginPath();
    ctx.arc(home.x, home.y, home.r, 0, 7);
    ctx.stroke();

    ctx.setLineDash([]);

    // Every 3 crumbs adds one castle block
    const blocks = Math.min(
      20,
      Math.floor(delivered / 3)
    );

    for (let i = 0; i < blocks; i++) {
      if (i % 2) {
        ctx.fillStyle = colors.crumb;
      } else {
        ctx.fillStyle = colors.paper;
      }

      const x = 480 + (i % 4) * 16;
      const y = 300 - Math.floor(i / 4) * 14;

      ctx.fillRect(x, y, 15, 13);

      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1;

      ctx.strokeRect(x, y, 15, 13);
    }

    // Add a flag when we win.
    if (castleDone) {
      ctx.fillStyle = colors.red;
      ctx.fillRect(510, 215, 22, 12);

      ctx.fillStyle = colors.ink;
      ctx.fillRect(510, 215, 2, 70);
    }
  }

  
  // DRAW BIG OBJECTS
 

  function drawSolid(object) {
    const x = object.x;
    const y = object.y;
    const w = object.w;
    const h = object.h;

    // Draw shadow.
    ctx.save();

    ctx.fillStyle = "rgba(43,45,66,.28)";

    if (object.t === "circle") {
      ctx.beginPath();
      ctx.arc(x + 18, y + 22, object.r, 0, 7);
      ctx.fill();
    }

    else {
      ctx.fillRect(x + 16, y + 20, w, h);
    }

    ctx.restore();

    // Coffee mug.
    if (object.id === "mug") {
      ctx.fillStyle = colors.paper;


      
      ctx.beginPath();
      ctx.arc(x, y, object.r, 0, 7);
      ctx.fill();

      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.fillStyle = "#6b3f1d";

      ctx.beginPath();
      ctx.arc(x, y, object.r - 24, 0, 7);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,.25)";

      ctx.beginPath();
      ctx.arc(x - 30, y - 30, 28, 0, 7);
      ctx.fill();

      ctx.strokeStyle = colors.paper;
      ctx.lineWidth = 26;

      ctx.beginPath();
      ctx.arc(x + object.r + 20, y, 40, -1.2, 1.2);
      ctx.stroke();
    }

    // Tape
    else if (object.id === "tape") {
      ctx.fillStyle = colors.blue;

      ctx.beginPath();
      ctx.arc(x, y, object.r, 0, 7);
      ctx.fill();

      ctx.fillStyle = colors.desk;

      ctx.beginPath();
      ctx.arc(x, y, object.r * 0.55, 0, 7);
      ctx.fill();

      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 5;

      ctx.beginPath();
      ctx.arc(x, y, object.r, 0, 7);
      ctx.stroke();
    }

    // Matchbox home.
    else if (object.id === "matchbox") {
      ctx.fillStyle = colors.red;
      ctx.fillRect(x, y, w, h);

      ctx.fillStyle = colors.yellow;
      ctx.fillRect(x + 14, y + 14, w - 28, h - 28);

      ctx.fillStyle = colors.ink;
      ctx.font = "bold 30px monospace";
      ctx.textAlign = "center";

      ctx.fillText(
        "HOME",
        x + w / 2,
        y + h / 2 + 10
      );

      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 5;
      ctx.strokeRect(x, y, w, h);
    }

    // Books.
    else if (object.id === "books") {
      const bookColors = [
        colors.red,
        colors.blue,
        colors.green,
        colors.pink
      ];

      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = bookColors[i];

        ctx.fillRect(
          x,
          y + i * 70,
          w - i * 18,
          66
        );

        ctx.fillStyle = colors.paper;

        ctx.fillRect(
          x + 20,
          y + i * 70 + 26,
          w - i * 18 - 70,
          12
        );
      }

      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, w, h);
    }

    // Pencils.
    else if (
      object.id === "pencil" ||
      object.id === "pencil2"
    ) {
      const horizontal = w > h;

      ctx.fillStyle = colors.yellow;
      ctx.fillRect(x, y, w, h);

      ctx.fillStyle = colors.ink;

      if (horizontal) {
        ctx.fillRect(x, y + h / 2 - 2, w, 4);

        ctx.fillStyle = colors.pink;
        ctx.fillRect(x + w - 60, y, 60, h);
      }

      else {
        ctx.fillRect(x + w / 2 - 2, y, 4, h);

        ctx.fillStyle = colors.pink;
        ctx.fillRect(x, y + h - 60, w, 60);
      }

      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
    }

    // Eraser
    else if (object.id === "eraser") {
      ctx.fillStyle = colors.pink;
      ctx.fillRect(x, y, w, h);

      ctx.fillStyle = colors.blue;
      ctx.fillRect(x, y, w * 0.35, h);

      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, w, h);
    }

    // Stapler.
    else if (object.id === "stapler") {
      ctx.fillStyle = colors.green;
      ctx.fillRect(x, y, w, h);

      ctx.fillStyle = colors.ink;
      ctx.fillRect(x + w - 50, y + 10, 40, h - 20);

      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, w, h);
    }
  }

  // DRAW A CRUMB
  

  function drawCrumb(crumb, now) {
    const bounce = Math.sin(now / 250 + crumb.a) * 1.5;

    // Small shadow.
    ctx.fillStyle = "rgba(43,45,66,.25)";

    ctx.beginPath();

    ctx.ellipse(
      crumb.x + 2,
      crumb.y + 5,
      crumb.s,
      crumb.s * 0.5,
      0,
      0,
      7
    );

    ctx.fill();

    // Crumb shape
    ctx.fillStyle = colors.crumb;
    ctx.beginPath();

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * 6.283 + crumb.a;

      const radius = crumb.s *
        (i % 2 ? 0.7 : 1.15);

      const x = crumb.x + Math.cos(angle) * radius;
      const y = crumb.y + bounce + Math.sin(angle) * radius;

      ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  
  // DRAW OUR TINY PERSON
  

  function drawPlayer(player, now, isMe) {
    const x = player.x;
    const y = player.y;

    let bounce = 0;

    if (player.moving) {
      bounce = Math.abs(Math.sin(now / 90)) * 2.5;
    }

    const direction = player.dir || 1;

    // Shadow.
    ctx.fillStyle = "rgba(43,45,66,.35)";

    ctx.beginPath();
    ctx.ellipse(x, y + 8, 8, 3.5, 0, 0, 7);
    ctx.fill();

    // Legs
    ctx.fillStyle = colors.ink;

    const legMove = player.moving ?
      Math.sin(now / 90) * 2 : 0;

    ctx.fillRect(x - 4, y + 2 - bounce, 3, 6 + legMove);
    ctx.fillRect(x + 1, y + 2 - bounce, 3, 6 - legMove);

    // Shirt.
    ctx.fillStyle = player.color;

    ctx.fillRect(x - 5, y - 7 - bounce, 10, 11);

    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1.4;

    ctx.strokeRect(x - 5, y - 7 - bounce, 10, 11);

    // Head.
    ctx.fillStyle = colors.skin;

    ctx.beginPath();
    ctx.arc(x, y - 12 - bounce, 6, 0, 7);
    ctx.fill();
    ctx.stroke();

    // Eyes
    ctx.fillStyle = colors.ink;

    ctx.fillRect(
      x + direction * 2 - 1,
      y - 13 - bounce,
      2,
      2.5
    );

    ctx.fillRect(
      x + direction * 5 - 1,
      y - 13 - bounce,
      2,
      2.5
    );

    // Yellow circle around our own player.
    if (isMe) {
      ctx.strokeStyle = colors.yellow;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.ellipse(x, y + 8, 11, 5, 0, 0, 7);
      ctx.stroke();
    }
  }

  
  // DRAW BIG ANT BOB
  

  function drawAnt(now) {
    const x = ant.x;
    const y = ant.y;
    const direction = ant.dir;

    const wiggle = Math.sin(now / 120) * 4;

    // Ant shadow.
    ctx.fillStyle = "rgba(43,45,66,.3)";

    ctx.beginPath();
    ctx.ellipse(x, y + 20, 48, 12, 0, 0, 7);
    ctx.fill();

    // Ant legs.
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 3;

    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();

      ctx.moveTo(x + i * 18, y);
      ctx.lineTo(x + i * 18 + wiggle, y - 26);

      ctx.moveTo(x + i * 18, y);
      ctx.lineTo(x + i * 18 - wiggle, y + 26);

      ctx.stroke();
    }

    // Ant body circles.
    ctx.fillStyle = colors.ink;

    const circles = [
      [-34 * direction, 17],
      [0, 20],
      [38 * direction, 14]
    ];

    circles.forEach(function(circle) {
      ctx.beginPath();

      ctx.arc(
        x + circle[0],
        y,
        circle[1],
        0,
        7
      );

      ctx.fill();
    });

    // Ant eye
    ctx.fillStyle = colors.red;

    ctx.beginPath();
    ctx.arc(x + 44 * direction, y - 4, 3, 0, 7);
    ctx.fill();

    // Ant antenna.
    ctx.strokeStyle = colors.ink;

    ctx.beginPath();
    ctx.moveTo(x + 50 * direction, y - 8);
    ctx.lineTo(x + 66 * direction, y - 22 + wiggle);
    ctx.stroke();
  }

  
  // DRAW THE CAT PAW
  
  function drawCatPaw(now) {
    // First the cat shows a shadow.
    if (paw.state === "warn") {
      const time = Math.min(
        1,
        (now - paw.t0) / warnTime
      );

      ctx.fillStyle =
        `rgba(43,45,66,${0.15 + time * 0.35})`;

      ctx.beginPath();
      ctx.arc(paw.x, paw.y, 30 + time * 85, 0, 7);
      ctx.fill();

      ctx.strokeStyle = colors.red;
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 8]);

      ctx.beginPath();
      ctx.arc(paw.x, paw.y, 110, 0, 7);
      ctx.stroke();

      ctx.setLineDash([]);
    }

    // Then the paw lands on the desk.
    else if (paw.state === "slam") {
      const time = (now - paw.t0) / slamTime;

      if (time > 0.7) {
        ctx.globalAlpha = 1 - (time - 0.7) / 0.3;
      } else {
        ctx.globalAlpha = 1;
      }

      // Outer paw
      ctx.fillStyle = "#f1e3d3";
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 5;

      ctx.beginPath();
      ctx.arc(paw.x, paw.y, 105, 0, 7);
      ctx.fill();
      ctx.stroke();

      // Pink middle.
      ctx.fillStyle = colors.pink;

      ctx.beginPath();
      ctx.ellipse(paw.x, paw.y + 18, 46, 38, 0, 0, 7);
      ctx.fill();

      // Pink toes
      const toes = [
        [-52, -48],
        [-18, -70],
        [18, -70],
        [52, -48]
      ];

      toes.forEach(function(toe) {
        ctx.beginPath();

        ctx.arc(
          paw.x + toe[0],
          paw.y + toe[1],
          22,
          0,
          7
        );

        ctx.fill();
        ctx.stroke();
      });

      ctx.globalAlpha = 1;
    }
  }

  
  // DRAW PLAYER NAMES
  

  function drawTag(text, x, y, color) {
    ctx.font = "bold 12px 'Courier New', monospace";
    ctx.textAlign = "center";

    const width = ctx.measureText(text).width + 8;

    // Dark box behind the name.
    ctx.fillStyle = "rgba(29,26,47,.85)";
    ctx.fillRect(x - width / 2, y - 11, width, 16);

    // Player name.
    ctx.fillStyle = color;
    ctx.fillText(text, x, y + 1);
  }

  
  // DRAW CHAT BUBBLES

  function drawBubble(text, x, y) {
    ctx.font = "12px 'Courier New', monospace";
    ctx.textAlign = "center";

    let shortText = text;

    if (text.length > 34) {
      shortText = text.slice(0, 33) + "…";
    }

    const width = ctx.measureText(shortText).width + 16;

    // White message box.
    ctx.fillStyle = colors.paper;
    ctx.fillRect(x - width / 2, y - 40, width, 24);

    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - width / 2, y - 40, width, 24);

    // Small triangle below the message.
    ctx.fillStyle = colors.paper;

    ctx.beginPath();
    ctx.moveTo(x - 5, y - 16);
    ctx.lineTo(x + 5, y - 16);
    ctx.lineTo(x, y - 8);
    ctx.fill();

       // Write the message.
    ctx.fillStyle = colors.ink;
        ctx.fillText(shortText, x, y - 24);
  }

})();
  