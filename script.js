"use strict";

// THIRST:TRAIL — Week 1 prototype. No frameworks or external dependencies.
const LOCATIONS = {
  village: {
    name: "The Village", icon: "🏘️", type: "STARTING POINT",
    description: "Villagers need a dependable safe-water source. Begin by gathering clues and useful supplies.",
    entry: "You are at the village. An elder knows the area, and there is a small toolkit you can take.",
    actions: ["talkToElder", "collectToolkit"]
  },
  river: {
    name: "River Bend", icon: "🌊", type: "RIVER CROSSING",
    description: "The river looks inviting, but looks alone cannot tell you whether water is safe. Investigate it and look for supplies.",
    entry: "You reach River Bend. Testing the water and searching the shore may help your mission.",
    actions: ["testRiver", "collectTreatment"]
  },
  pump: {
    name: "Old Water Pump", icon: "🔧", type: "POSSIBLE SAFE SOURCE",
    description: "The village's old pump has stopped working. Inspect it before attempting to fix it.",
    entry: "The old pump is silent. Could it provide safe water if the damaged mechanism is repaired?",
    actions: ["inspectPump", "repairPump"]
  },
  spring: {
    name: "Hill Spring", icon: "⛰️", type: "POSSIBLE SAFE SOURCE",
    description: "Water flows from the hillside, but its safety is unknown. Test it first, then decide on the next step.",
    entry: "You find a hillside spring. Don't assume clear-looking water is safe to drink.",
    actions: ["testSpring", "treatSpring"]
  }
};

// Each action costs some thirst and gives points. Completed actions cannot be repeated.
const ACTIONS = {
  talkToElder: { label: "Ask the elder for a clue", cost: 7, points: 10,
    result: "The elder says the old pump may work again with the right tools. Check the village supplies.",
    flags: ["hasClue"] },
  collectToolkit: { label: "Pick up the repair toolkit", cost: 7, points: 15,
    result: "Repair toolkit collected! Inspect the old pump before using it.",
    flags: ["hasToolkit"] },
  testRiver: { label: "Test the river water", cost: 10, points: 15,
    result: "The game test flags the river water as unsafe. Good call checking instead of drinking it!",
    flags: ["testedRiver"] },
  collectTreatment: { label: "Collect treatment supplies", cost: 8, points: 10,
    result: "Treatment supplies collected! They may help at the Hill Spring once you test the water.",
    flags: ["hasTreatment"] },
  inspectPump: { label: "Inspect the broken pump", cost: 8, points: 15,
    result: "You find a loose valve! A repair toolkit could get the pump running again.",
    flags: ["inspectedPump"] },
  repairPump: { label: "Repair the pump & get water", cost: 12, points: 50,
    requires: ["hasToolkit", "inspectedPump"],
    requirementText: "Needs repair toolkit + pump inspection",
    result: "The repaired pump supplies safe water in this game! The village celebrates.",
    win: true, winMethod: "pump", flags: ["fixedPump"] },
  testSpring: { label: "Test the spring water", cost: 10, points: 20,
    result: "Testing shows this spring needs treatment before the water can be used. Look for supplies near the river.",
    flags: ["testedSpring"] },
  treatSpring: { label: "Treat the spring water", cost: 12, points: 50,
    requires: ["hasTreatment", "testedSpring"],
    requirementText: "Needs treatment supplies + spring test",
    result: "Your treatment process works in this game! You secure safe water for the village.",
    win: true, winMethod: "spring", flags: ["treatedSpring"] }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const introScreen = $("#introScreen");
const gameScreen = $("#gameScreen");
const endOverlay = $("#endOverlay");
let game;

function startGame() {
  game = {
    thirst: 100, score: 0, location: "village", over: false,
    visited: new Set(["village"]), completed: new Set(), flags: new Set(),
    message: "Start with a clue or pick up a repair kit.",
    journal: "You arrive at the village with 100% thirst. Your mission is to find a safe drinking-water source."
  };
  introScreen.hidden = true;
  gameScreen.hidden = false;
  endOverlay.hidden = true;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  $(".map-location[data-location='village']").focus({ preventScroll: true });
}

function spendThirst(amount) {
  game.thirst = Math.max(0, game.thirst - amount);
  return game.thirst > 0;
}

function travelTo(locationId) {
  if (!game || game.over || !LOCATIONS[locationId] || game.location === locationId) return;
  const safeToContinue = spendThirst(9);
  if (!safeToContinue) {
    game.message = "You ran out of thirst while traveling. Try a shorter route next time.";
    game.journal = game.message;
    render();
    endGame(false);
    return;
  }
  game.location = locationId;
  game.visited.add(locationId);
  game.message = LOCATIONS[locationId].entry;
  game.journal = `Traveled to ${LOCATIONS[locationId].name} (−9% thirst). ${game.message}`;
  render();
}

function doAction(actionId) {
  if (!game || game.over || !ACTIONS[actionId]) return;
  const site = LOCATIONS[game.location];
  if (!site.actions.includes(actionId) || game.completed.has(actionId)) return;
  const action = ACTIONS[actionId];
  if (action.requires && !action.requires.every(flag => game.flags.has(flag))) return;

  if (!spendThirst(action.cost)) {
    game.message = "Your thirst reached zero before you could finish. Try taking a more direct path.";
    game.journal = game.message;
    render();
    endGame(false);
    return;
  }

  game.completed.add(actionId);
  game.score += action.points;
  for (const flag of action.flags || []) game.flags.add(flag);
  game.message = action.result;
  game.journal = `${site.name}: ${action.result} (+${action.points} points; −${action.cost}% thirst)`;
  render();
  if (action.win) endGame(true, action.winMethod);
}

function render() {
  $("#thirstValue").textContent = `${game.thirst}%`;
  $("#scoreValue").textContent = game.score;
  $("#visitedValue").textContent = `${game.visited.size} / 4`;
  $("#thirstBar").style.width = `${game.thirst}%`;
  $("#thirstBar").classList.toggle("low", game.thirst <= 30);
  $("#thirstMeter").setAttribute("aria-valuenow", game.thirst);
  $("#journalText").textContent = game.journal;
  $("#messageText").textContent = game.message;
  $("#messageIcon").textContent = game.message.includes("collected") || game.message.includes("toolkit") ? "🎒" : "💬";

  $$(".map-location").forEach(button => {
    const id = button.dataset.location;
    const isActive = id === game.location;
    button.classList.toggle("active", isActive);
    button.classList.toggle("visited", game.visited.has(id));
    button.setAttribute("aria-pressed", String(isActive));
  });

  const site = LOCATIONS[game.location];
  $("#detailIcon").textContent = site.icon;
  $("#detailType").textContent = site.type;
  $("#detailTitle").textContent = site.name;
  $("#detailDescription").textContent = site.description;

  const actionList = $("#actionList");
  actionList.replaceChildren();
  site.actions.forEach(actionId => {
    const action = ACTIONS[actionId];
    const done = game.completed.has(actionId);
    const missing = action.requires && !action.requires.every(flag => game.flags.has(flag));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-btn";
    button.dataset.action = actionId;
    button.disabled = !!(done || missing || game.over);
    const actionLabel = document.createElement("span");
    actionLabel.textContent = `${done ? "✓ " : ""}${action.label}`;
    const costLabel = document.createElement("span");
    costLabel.className = "action-cost";
    costLabel.textContent = done ? "DONE" : `−${action.cost}%`;
    button.append(actionLabel, costLabel);
    actionList.append(button);
    if (missing && !done) {
      const hint = document.createElement("p");
      hint.className = "prereq-hint";
      hint.textContent = `🔒 ${action.requirementText}`;
      actionList.append(hint);
    }
  });

  const bag = $("#inventoryItems");
  bag.replaceChildren();
  const possessions = [];
  if (game.flags.has("hasToolkit")) possessions.push("🔧 Repair toolkit");
  if (game.flags.has("hasTreatment")) possessions.push("🧪 Treatment supplies");
  if (game.flags.has("hasClue")) possessions.push("📜 Elder's clue");
  if (!possessions.length) {
    const empty = document.createElement("span");
    empty.className = "empty-bag";
    empty.textContent = "Nothing yet";
    bag.append(empty);
  } else {
    possessions.forEach(item => {
      const pill = document.createElement("span");
      pill.className = "inventory-pill";
      pill.textContent = item;
      bag.append(pill);
    });
  }
}

function endGame(won, method) {
  game.over = true;
  $("#endSymbol").textContent = won ? "🎉" : "💧";
  $("#endEyebrow").textContent = won ? "MISSION COMPLETE" : "MISSION ENDED";
  $("#endTitle").textContent = won ? "You found safe water!" : "You ran out of thirst!";
  $("#endDescription").textContent = won
    ? (method === "pump"
      ? "You repaired the village pump! Your careful choices helped the community reach safe water."
      : "You tested and treated the spring water! Your smart decisions helped the community reach safe water.")
    : "The journey took too much energy. Try collecting only the supplies you need and reaching a safe source sooner.";
  $("#endScore").textContent = game.score;
  $("#endThirst").textContent = `${game.thirst}%`;
  endOverlay.hidden = false;
  $("#playAgainButton").focus();
}

$("#startButton").addEventListener("click", startGame);
$("#restartButton").addEventListener("click", startGame);
$("#playAgainButton").addEventListener("click", startGame);
$$(".map-location").forEach(button => button.addEventListener("click", () => travelTo(button.dataset.location)));
$("#actionList").addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (button) doAction(button.dataset.action);
});