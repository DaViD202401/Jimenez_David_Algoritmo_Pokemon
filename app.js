// =====================
// 1) Datos base
// =====================

const pokemonIDs = Array.from({length:151}, (_,i)=> i+1);

const segmentos = {
  "C": "Jugador Casual",
  "N": "Jugador Nostálgico",
  "P": "Jugador Competitivo"
};

const contextos = {
  "F": "¿Cuál es más fuerte?",
  "I": "¿Cuál es más icónico?",
  "E": "¿Cuál elegirías como inicial?"
};

const RATING_INICIAL = 1000;
const K = 32;
const STORAGE_KEY = "pokemash_state_v1";

// =====================
// Estado
// =====================

function defaultState(){
  const buckets = {};
  for(const s in segmentos){
    for(const c in contextos){
      const key = `${s}__${c}`;
      buckets[key] = {};
      pokemonIDs.forEach(id=>{
        buckets[key][id] = RATING_INICIAL;
      });
    }
  }
  return { buckets };
}

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return defaultState();
  return JSON.parse(raw);
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

// =====================
// Elo
// =====================

function expectedScore(ra, rb){
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

function updateElo(bucket, A, B, winner){
  const ra = bucket[A];
  const rb = bucket[B];

  const ea = expectedScore(ra, rb);
  const eb = expectedScore(rb, ra);

  const sa = (winner==="A")?1:0;
  const sb = (winner==="B")?1:0;

  bucket[A] = ra + K*(sa - ea);
  bucket[B] = rb + K*(sb - eb);
}

// =====================
// UI
// =====================

const segmentSelect = document.getElementById("segmentSelect");
const contextSelect = document.getElementById("contextSelect");
const labelA = document.getElementById("labelA");
const labelB = document.getElementById("labelB");
const imgA = document.getElementById("imgA");
const imgB = document.getElementById("imgB");
const topBox = document.getElementById("topBox");

let currentA, currentB;

function fillSelect(select,obj){
  for(const k in obj){
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = obj[k];
    select.appendChild(opt);
  }
}

fillSelect(segmentSelect, segmentos);
fillSelect(contextSelect, contextos);

function randomPair(){
  const a = pokemonIDs[Math.floor(Math.random()*pokemonIDs.length)];
  let b = a;
  while(b===a){
    b = pokemonIDs[Math.floor(Math.random()*pokemonIDs.length)];
  }
  return [a,b];
}

async function fetchPokemon(id){
  try{
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const data = await res.json();
    return {
      name: data.name,
      img: data.sprites.front_default
    };
  }catch{
    return { name: `Pokemon #${id}`, img:null };
  }
}

async function newDuel(){
  [currentA,currentB] = randomPair();

  const pokeA = await fetchPokemon(currentA);
  const pokeB = await fetchPokemon(currentB);

  labelA.textContent = pokeA.name;
  labelB.textContent = pokeB.name;

  if(pokeA.img){ imgA.src = pokeA.img; imgA.style.display="block"; }
  else{ imgA.style.display="none"; }

  if(pokeB.img){ imgB.src = pokeB.img; imgB.style.display="block"; }
  else{ imgB.style.display="none"; }
}

function vote(winner){
  const key = `${segmentSelect.value}__${contextSelect.value}`;
  const bucket = state.buckets[key];
  updateElo(bucket,currentA,currentB,winner);
  saveState();
  renderTop();
  newDuel();
}

async function renderTop(){
  const key = `${segmentSelect.value}__${contextSelect.value}`;
  const bucket = state.buckets[key];

  const arr = Object.entries(bucket)
    .sort((a,b)=> b[1]-a[1])
    .slice(0,10);

  topBox.innerHTML = "Cargando...";

  // Obtener nombres desde la API
  const enriched = await Promise.all(
    arr.map(async (r)=>{
      const id = r[0];
      try{
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
        const data = await res.json();
        return {
          name: data.name,
          rating: r[1]
        };
      }catch{
        return {
          name: `Pokemon #${id}`,
          rating: r[1]
        };
      }
    })
  );

  topBox.innerHTML = enriched.map((p,i)=>
    `<div class="toprow">
      <div>${i+1}. ${p.name}</div>
      <div>${p.rating.toFixed(1)}</div>
    </div>`
  ).join("");
}


document.getElementById("btnA").addEventListener("click",()=>vote("A"));
document.getElementById("btnB").addEventListener("click",()=>vote("B"));
document.getElementById("btnNewPair").addEventListener("click",()=>newDuel());
document.getElementById("btnShowTop").addEventListener("click",()=>renderTop());
document.getElementById("btnReset").addEventListener("click",()=>{
  state = defaultState();
  saveState();
  renderTop();
  newDuel();
});

newDuel();
renderTop();
