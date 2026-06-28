const STORAGE_KEY = "luna-daily-v1";
const SYNC_DEBOUNCE_MS = 1400;
const today = new Date();

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: ""
};

const firebaseIsConfigured = Object.values(firebaseConfig).every(Boolean);

const defaultState = {
  profile: null,
  customHabits: [],
  entries: {},
  photos: [],
  updatedAt: null
};

let state = loadState();
let selectedDate = toDateKey(today);
let firebaseServices = null;
let currentUser = null;
let syncTimer = null;
let syncInProgress = false;
let isApplyingRemoteState = false;

const setupView = document.querySelector("#setupView");
const trackerView = document.querySelector("#trackerView");
const setupForm = document.querySelector("#setupForm");
const nameInput = document.querySelector("#nameInput");
const greeting = document.querySelector("#greeting");
const todayLabel = document.querySelector("#todayLabel");
const dateInput = document.querySelector("#dateInput");
const prevDay = document.querySelector("#prevDay");
const nextDay = document.querySelector("#nextDay");
const vitaminsInput = document.querySelector("#vitaminsInput");
const workoutInput = document.querySelector("#workoutInput");
const hitsInput = document.querySelector("#hitsInput");
const drinksInput = document.querySelector("#drinksInput");
const weightInput = document.querySelector("#weightInput");
const notesInput = document.querySelector("#notesInput");
const resetToday = document.querySelector("#resetToday");
const customHabitList = document.querySelector("#customHabitList");
const addHabitForm = document.querySelector("#addHabitForm");
const newHabitInput = document.querySelector("#newHabitInput");
const newHabitType = document.querySelector("#newHabitType");
const calendarStrip = document.querySelector("#calendarStrip");
const monthHits = document.querySelector("#monthHits");
const monthDrinks = document.querySelector("#monthDrinks");
const workoutCount = document.querySelector("#workoutCount");
const photoInput = document.querySelector("#photoInput");
const photoGrid = document.querySelector("#photoGrid");
const weekRange = document.querySelector("#weekRange");
const weekHits = document.querySelector("#weekHits");
const weekDrinks = document.querySelector("#weekDrinks");
const weekVitamins = document.querySelector("#weekVitamins");
const weekWorkouts = document.querySelector("#weekWorkouts");
const weekWeight = document.querySelector("#weekWeight");
const weekInsight = document.querySelector("#weekInsight");
const weekCustomList = document.querySelector("#weekCustomList");
const adviceTitle = document.querySelector("#adviceTitle");
const adviceText = document.querySelector("#adviceText");
const exportData = document.querySelector("#exportData");
const importData = document.querySelector("#importData");
const dataStatus = document.querySelector("#dataStatus");
const signInButton = document.querySelector("#signInButton");
const signOutButton = document.querySelector("#signOutButton");
const syncNowButton = document.querySelector("#syncNowButton");
const syncTitle = document.querySelector("#syncTitle");
const syncStatus = document.querySelector("#syncStatus");

const dailyAdvice = [
  {
    title: "Make the urge observable.",
    text: "When a craving shows up, pause for one minute and name what is happening: time, place, feeling, and body sensation. You are collecting information, not judging yourself."
  },
  {
    title: "Change the first step.",
    text: "A routine often starts before the substance. Try changing the first step today: move rooms, drink water, text someone, walk outside, or delay the decision by ten minutes."
  },
  {
    title: "Look for the trigger.",
    text: "If you use more than you planned, ask what came right before it. Stress, boredom, pain, loneliness, celebration, and habit all call for different supports."
  },
  {
    title: "Plan for the risky hour.",
    text: "Pick the time of day when autopilot usually takes over and decide one substitute action in advance. Simple plans work best when the hard moment arrives."
  },
  {
    title: "Treat a slip as data.",
    text: "A hard day does not erase progress. Write down what happened, what helped even a little, and what you want to try next time."
  },
  {
    title: "Shrink the goal.",
    text: "If the whole day feels too big, choose the next honest action: take vitamins, log the number, eat something, shower, step outside, or ask for support."
  },
  {
    title: "Notice all-or-nothing thoughts.",
    text: "Thoughts like 'I already messed up' can push a day further off track. Try replacing that with: 'The next choice still counts.'"
  },
  {
    title: "Make support easier to reach.",
    text: "Before you need help, put one supportive person, place, or resource within easy reach. Recovery tools work better when they are visible."
  }
];

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(setupForm);
  const routine = form.get("routine");

  state.profile = {
    name: nameInput.value.trim() || "friend",
    routine
  };

  state.customHabits = routine === "luna"
    ? [
        { id: createId(), name: "Read or journal", type: "checkbox" },
        { id: createId(), name: "Stretch", type: "checkbox" }
      ]
    : [];

  saveState();
  render();
});

[vitaminsInput, workoutInput, hitsInput, drinksInput, weightInput, notesInput].forEach((input) => {
  input.addEventListener("input", saveCurrentEntry);
});

document.querySelectorAll("[data-step]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.querySelector(`#${button.dataset.step}`);
    const delta = Number(button.dataset.delta);
    const current = Number(input.value || 0);
    const min = Number(input.min || 0);
    const max = Number(input.max || 999);
    const next = Math.min(max, Math.max(min, current + delta));
    input.value = Number.isInteger(next) ? String(next) : next.toFixed(1);
    saveCurrentEntry();
  });
});

dateInput.addEventListener("change", () => {
  selectedDate = dateInput.value || toDateKey(today);
  renderTracker();
});

prevDay.addEventListener("click", () => moveSelectedDay(-1));
nextDay.addEventListener("click", () => moveSelectedDay(1));

resetToday.addEventListener("click", () => {
  delete state.entries[selectedDate];
  saveState();
  renderTracker();
});

addHabitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = newHabitInput.value.trim();
  if (!name) return;
  state.customHabits.push({ id: createId(), name, type: newHabitType.value });
  newHabitInput.value = "";
  newHabitType.value = "checkbox";
  saveState();
  renderTracker();
});

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.photos.unshift(reader.result);
    state.photos = state.photos.slice(0, 6);
    saveState();
    renderPhotos();
  });
  reader.readAsDataURL(file);
});

exportData.addEventListener("click", exportBackup);
importData.addEventListener("change", importBackup);
signInButton.addEventListener("click", signInWithGoogle);
signOutButton.addEventListener("click", signOutOfGoogle);
syncNowButton.addEventListener("click", () => syncToCloud({ force: true }));

render();
initializeFirebaseSync();

function render() {
  const hasProfile = Boolean(state.profile);
  setupView.classList.toggle("hidden", hasProfile);
  trackerView.classList.toggle("hidden", !hasProfile);
  if (hasProfile) renderTracker();
}

function renderTracker() {
  const selected = fromDateKey(selectedDate);
  const entry = getEntry(selectedDate);
  const isToday = selectedDate === toDateKey(today);
  const firstName = state.profile.name.split(/\s+/)[0];

  todayLabel.textContent = selected.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric"
  });
  greeting.textContent = isToday ? `Hi, ${firstName}.` : "Past check-in";
  dateInput.value = selectedDate;
  vitaminsInput.checked = Boolean(entry.vitamins);
  workoutInput.checked = Boolean(entry.workout);
  hitsInput.value = entry.hits ?? 0;
  drinksInput.value = entry.drinks ?? 0;
  weightInput.value = entry.weight ?? "";
  notesInput.value = entry.notes ?? "";

  renderCustomHabits(entry);
  renderDailyAdvice();
  renderStats();
  renderWeekAnalysis();
  renderCalendar();
  renderPhotos();
}

function saveCurrentEntry() {
  const current = getEntry(selectedDate);
  state.entries[selectedDate] = {
    ...current,
    vitamins: vitaminsInput.checked,
    workout: workoutInput.checked,
    hits: clampNumber(hitsInput.value, 0, 99),
    drinks: clampNumber(drinksInput.value, 0, 30),
    weight: weightInput.value === "" ? "" : clampNumber(weightInput.value, 0, 700),
    notes: notesInput.value
  };
  saveState();
  renderStats();
  renderWeekAnalysis();
  renderCalendar();
}

function renderCustomHabits(entry) {
  customHabitList.innerHTML = "";
  state.customHabits.forEach((habit) => {
    const row = document.createElement("div");
    row.className = "custom-item";

    const habitType = habit.type || "checkbox";
    const label = document.createElement("label");
    const control = document.createElement("input");
    control.type = habitType === "checkbox" ? "checkbox" : "number";
    if (habitType === "decimal") {
      control.step = "0.5";
      control.inputMode = "decimal";
    }
    if (habitType === "number") {
      control.step = "1";
      control.inputMode = "numeric";
    }
    control.min = habitType === "checkbox" ? "" : "0";
    if (habitType === "checkbox") {
      control.checked = Boolean(entry.custom?.[habit.id]);
    } else {
      control.value = entry.custom?.[habit.id] ?? "";
      control.placeholder = "0";
    }
    control.addEventListener("input", () => {
      const current = getEntry(selectedDate);
      const value = habitType === "checkbox"
        ? control.checked
        : clampNumber(control.value, 0, 999);
      state.entries[selectedDate] = {
        ...current,
        custom: {
          ...current.custom,
          [habit.id]: value
        }
      };
      saveState();
      renderWeekAnalysis();
      renderCalendar();
    });

    const text = document.createElement("span");
    text.textContent = habit.name;
    label.append(control, text);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-habit";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      state.customHabits = state.customHabits.filter((item) => item.id !== habit.id);
      Object.values(state.entries).forEach((day) => {
        if (day.custom) delete day.custom[habit.id];
      });
      saveState();
      renderTracker();
    });

    row.append(label, remove);
    customHabitList.append(row);
  });
}

function renderStats() {
  const selected = fromDateKey(selectedDate);
  const monthPrefix = selectedDate.slice(0, 7);
  let hits = 0;
  let drinks = 0;
  let workouts = 0;

  Object.entries(state.entries).forEach(([date, entry]) => {
    if (!date.startsWith(monthPrefix)) return;
    hits += Number(entry.hits || 0);
    drinks += Number(entry.drinks || 0);
    if (entry.workout) workouts += 1;
  });

  monthHits.textContent = formatNumber(hits);
  monthDrinks.textContent = formatNumber(drinks);
  workoutCount.textContent = formatNumber(workouts);
}

function renderDailyAdvice() {
  const dateNumber = selectedDate.replaceAll("-", "");
  const index = Number(dateNumber) % dailyAdvice.length;
  const advice = dailyAdvice[index];
  adviceTitle.textContent = advice.title;
  adviceText.textContent = advice.text;
}

function renderWeekAnalysis() {
  const selected = fromDateKey(selectedDate);
  const start = startOfWeek(selected);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const weekEntries = [];
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    weekEntries.push({
      date,
      entry: getEntry(toDateKey(date))
    });
  }

  const totals = weekEntries.reduce((summary, day) => {
    summary.hits += Number(day.entry.hits || 0);
    summary.drinks += Number(day.entry.drinks || 0);
    summary.vitamins += day.entry.vitamins ? 1 : 0;
    summary.workouts += day.entry.workout ? 1 : 0;
    if (day.entry.weight !== "" && day.entry.weight !== undefined) {
      summary.weights.push(Number(day.entry.weight));
    }
    return summary;
  }, { hits: 0, drinks: 0, vitamins: 0, workouts: 0, weights: [] });

  weekRange.textContent = `${formatShortDate(start)} to ${formatShortDate(end)}`;
  weekHits.textContent = formatNumber(totals.hits);
  weekDrinks.textContent = formatNumber(totals.drinks);
  weekVitamins.textContent = `${totals.vitamins}/7`;
  weekWorkouts.textContent = formatNumber(totals.workouts);
  weekInsight.textContent = buildWeeklyInsight(weekEntries, totals);

  if (totals.weights.length) {
    const first = totals.weights[0];
    const last = totals.weights[totals.weights.length - 1];
    const change = last - first;
    const sign = change > 0 ? "+" : "";
    weekWeight.textContent = `Weight: ${formatNumber(first)} to ${formatNumber(last)} lbs (${sign}${formatNumber(change)}).`;
  } else {
    weekWeight.textContent = "Weight: no entries this week yet.";
  }

  weekCustomList.innerHTML = "";
  state.customHabits.forEach((habit) => {
    const habitType = habit.type || "checkbox";
    const value = weekEntries.reduce((total, day) => {
      const raw = day.entry.custom?.[habit.id];
      if (habitType === "checkbox") return total + (raw ? 1 : 0);
      return total + Number(raw || 0);
    }, 0);

    const row = document.createElement("div");
    row.className = "week-row";
    const label = habitType === "checkbox" ? `${value}/7 days` : formatNumber(value);
    const name = document.createElement("span");
    name.textContent = habit.name;
    const result = document.createElement("strong");
    result.textContent = label;
    row.append(name, result);
    weekCustomList.append(row);
  });
}

function buildWeeklyInsight(weekEntries, totals) {
  if (!weekEntries.some((day) => hasLoggedData(day.entry))) {
    return "No entries yet this week. One honest check-in is enough to start seeing the pattern.";
  }

  const highestHits = weekEntries.reduce((highest, day) => {
    return Number(day.entry.hits || 0) > Number(highest.entry.hits || 0) ? day : highest;
  }, weekEntries[0]);

  const highestDrinks = weekEntries.reduce((highest, day) => {
    return Number(day.entry.drinks || 0) > Number(highest.entry.drinks || 0) ? day : highest;
  }, weekEntries[0]);

  if (totals.hits > 0 && Number(highestHits.entry.hits || 0) >= Number(highestDrinks.entry.drinks || 0)) {
    return `Highest cannabis day: ${formatWeekday(highestHits.date)} with ${formatNumber(Number(highestHits.entry.hits || 0))} hits. That is a clue, not a verdict.`;
  }

  if (totals.drinks > 0) {
    return `Highest drinking day: ${formatWeekday(highestDrinks.date)} with ${formatNumber(Number(highestDrinks.entry.drinks || 0))} drinks. Notice what was happening around that time.`;
  }

  if (totals.workouts > 0 || totals.vitamins > 0) {
    return `You logged ${totals.vitamins} vitamin days and ${totals.workouts} workouts. Small routines count because they make the next choice easier.`;
  }

  return "This week has a few check-ins, and that matters. Keep logging the facts kindly.";
}

function hasLoggedData(entry) {
  return Boolean(
    entry.vitamins ||
    entry.workout ||
    Number(entry.hits || 0) > 0 ||
    Number(entry.drinks || 0) > 0 ||
    entry.weight ||
    entry.notes ||
    Object.values(entry.custom || {}).some(Boolean)
  );
}

function renderCalendar() {
  calendarStrip.innerHTML = "";
  const base = fromDateKey(selectedDate);
  for (let offset = -6; offset <= 7; offset += 1) {
    const date = new Date(base);
    date.setDate(base.getDate() + offset);
    const key = toDateKey(date);
    const entry = getEntry(key);
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = `day-pill${key === selectedDate ? " active" : ""}`;
    pill.innerHTML = `
      <span>${date.toLocaleDateString(undefined, { weekday: "short" })}</span>
      <strong>${date.getDate()}</strong>
      <span class="day-dot-row" aria-hidden="true">
        <i class="dot ${Number(entry.hits || 0) > 0 ? "hit" : ""}"></i>
        <i class="dot ${Number(entry.drinks || 0) > 0 ? "drink" : ""}"></i>
        <i class="dot ${entry.workout ? "workout" : ""}"></i>
      </span>
    `;
    pill.addEventListener("click", () => {
      selectedDate = key;
      renderTracker();
    });
    calendarStrip.append(pill);
  }
}

function renderPhotos() {
  photoGrid.innerHTML = "";
  const photos = state.photos.length ? state.photos : ["assets/daily-header.svg"];
  photos.forEach((photo) => {
    const img = document.createElement("img");
    img.src = photo;
    img.alt = "";
    photoGrid.append(img);
  });
}

function exportBackup() {
  const backup = {
    app: "Luna Daily",
    version: 1,
    exportedAt: new Date().toISOString(),
    state
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `luna-daily-backup-${toDateKey(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setDataStatus("Backup exported.");
}

function importBackup() {
  const file = importData.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(reader.result);
      const importedState = parsed.state || parsed;
      state = normalizeState(importedState);
      selectedDate = toDateKey(today);
      saveState();
      render();
      setDataStatus("Backup imported.");
    } catch {
      setDataStatus("That backup could not be imported.");
    } finally {
      importData.value = "";
    }
  });
  reader.readAsText(file);
}

function setDataStatus(message) {
  dataStatus.textContent = message;
  window.clearTimeout(setDataStatus.timeout);
  setDataStatus.timeout = window.setTimeout(() => {
    dataStatus.textContent = "";
  }, 4000);
}

async function initializeFirebaseSync() {
  renderSyncState("Checking sync setup...");

  if (!firebaseIsConfigured) {
    signInButton.disabled = true;
    signInButton.textContent = "Firebase setup needed";
    renderSyncState("Local only", "Firebase is not configured yet. Add project keys to firebase-config.js to enable Google sign-in sync.");
    return;
  }

  try {
    const [
      { initializeApp },
      authModule,
      firestoreModule
    ] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
    ]);

    const app = initializeApp(firebaseConfig);
    const auth = authModule.getAuth(app);
    const db = firestoreModule.getFirestore(app);
    const provider = new authModule.GoogleAuthProvider();

    firebaseServices = {
      auth,
      db,
      provider,
      signInWithPopup: authModule.signInWithPopup,
      signInWithRedirect: authModule.signInWithRedirect,
      getRedirectResult: authModule.getRedirectResult,
      signOut: authModule.signOut,
      onAuthStateChanged: authModule.onAuthStateChanged,
      doc: firestoreModule.doc,
      getDoc: firestoreModule.getDoc,
      setDoc: firestoreModule.setDoc,
      serverTimestamp: firestoreModule.serverTimestamp
    };

    firebaseServices.onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      renderSyncState();
      if (user) await loadCloudState();
    });

    await firebaseServices.getRedirectResult(auth);
    renderSyncState();
  } catch (error) {
    console.error(error);
    renderSyncState("Sync unavailable", "Firebase could not load. Local tracking still works.");
  }
}

async function signInWithGoogle() {
  if (!firebaseServices) return;
  renderSyncState("Opening Google sign-in...");
  try {
    await firebaseServices.signInWithPopup(firebaseServices.auth, firebaseServices.provider);
  } catch (error) {
    if (error?.code === "auth/popup-blocked" || error?.code === "auth/popup-closed-by-user") {
      await firebaseServices.signInWithRedirect(firebaseServices.auth, firebaseServices.provider);
      return;
    }
    console.error(error);
    renderSyncState("Sign-in did not finish", "Local tracking still works. Try Google sign-in again when ready.");
  }
}

async function signOutOfGoogle() {
  if (!firebaseServices) return;
  await firebaseServices.signOut(firebaseServices.auth);
  currentUser = null;
  renderSyncState();
}

async function loadCloudState() {
  if (!canUseCloud()) return;
  renderSyncState("Checking cloud data...");

  try {
    const snapshot = await firebaseServices.getDoc(cloudStateDoc());
    if (!snapshot.exists()) {
      await syncToCloud({ force: true });
      return;
    }

    const remoteState = normalizeState(snapshot.data().state);
    const remoteUpdated = Date.parse(remoteState.updatedAt || "");
    const localUpdated = Date.parse(state.updatedAt || "");

    if (remoteUpdated > localUpdated) {
      isApplyingRemoteState = true;
      state = {
        ...remoteState,
        photos: state.photos
      };
      selectedDate = toDateKey(today);
      saveState({ sync: false, touch: false });
      isApplyingRemoteState = false;
      render();
      renderSyncState("Synced from cloud", "Loaded your latest Luna Daily data. Photos stay local for now.");
      return;
    }

    await syncToCloud({ force: true });
  } catch (error) {
    console.error(error);
    renderSyncState("Cloud check failed", "Local tracking still works. The app will try again later.");
  }
}

async function syncToCloud({ force = false } = {}) {
  if (!canUseCloud() || syncInProgress) return;
  if (!force && isApplyingRemoteState) return;

  syncInProgress = true;
  renderSyncState("Syncing...");

  try {
    await firebaseServices.setDoc(cloudStateDoc(), {
      app: "Luna Daily",
      version: 1,
      updatedAt: state.updatedAt,
      savedAt: firebaseServices.serverTimestamp(),
      state: cloudSafeState()
    }, { merge: true });
    renderSyncState("Synced", "Your habit data is backed up for signed-in devices. Photos stay local for now.");
  } catch (error) {
    console.error(error);
    renderSyncState("Sync failed", "Local tracking is saved. Cloud sync will try again after your next change.");
  } finally {
    syncInProgress = false;
  }
}

function scheduleCloudSync() {
  if (!canUseCloud()) return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    syncToCloud();
  }, SYNC_DEBOUNCE_MS);
}

function canUseCloud() {
  return Boolean(firebaseServices && currentUser);
}

function cloudStateDoc() {
  return firebaseServices.doc(firebaseServices.db, "users", currentUser.uid, "lunaDaily", "state");
}

function cloudSafeState() {
  return {
    ...state,
    photos: []
  };
}

function renderSyncState(title, message) {
  if (!firebaseIsConfigured) {
    syncTitle.textContent = title || "Local only";
    syncStatus.textContent = message || "Firebase is not configured yet.";
    signInButton.classList.remove("hidden");
    signOutButton.classList.add("hidden");
    syncNowButton.classList.add("hidden");
    return;
  }

  if (!firebaseServices) {
    syncTitle.textContent = title || "Preparing sync";
    syncStatus.textContent = message || "Loading Google sign-in.";
    return;
  }

  if (!currentUser) {
    syncTitle.textContent = title || "Local only";
    syncStatus.textContent = message || "Sign in with Google to sync across devices.";
    signInButton.disabled = false;
    signInButton.textContent = "Sign in with Google";
    signInButton.classList.remove("hidden");
    signOutButton.classList.add("hidden");
    syncNowButton.classList.add("hidden");
    return;
  }

  syncTitle.textContent = title || "Cloud sync on";
  syncStatus.textContent = message || `Signed in as ${currentUser.email || "Google user"}.`;
  signInButton.classList.add("hidden");
  signOutButton.classList.remove("hidden");
  syncNowButton.classList.remove("hidden");
}

function moveSelectedDay(delta) {
  const date = fromDateKey(selectedDate);
  date.setDate(date.getDate() + delta);
  selectedDate = toDateKey(date);
  renderTracker();
}

function getEntry(dateKey) {
  return state.entries[dateKey] || {
    vitamins: false,
    workout: false,
    hits: 0,
    drinks: 0,
    weight: "",
    notes: "",
    custom: {}
  };
}

function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return structuredClone(defaultState);
  }
}

function normalizeState(value) {
  return {
    ...structuredClone(defaultState),
    ...(value && typeof value === "object" ? value : {}),
    customHabits: Array.isArray(value?.customHabits) ? value.customHabits : [],
    entries: value?.entries && typeof value.entries === "object" ? value.entries : {},
    photos: Array.isArray(value?.photos) ? value.photos : []
  };
}

function saveState(options = {}) {
  const { sync = true, touch = true } = options;
  if (touch) state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (sync) scheduleCloudSync();
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function clampNumber(value, min, max) {
  const number = Number(value || 0);
  return Math.min(max, Math.max(min, number));
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function startOfWeek(date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return start;
}

function formatShortDate(date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function formatWeekday(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long"
  });
}
