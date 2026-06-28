export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: ""
};

export const firebaseIsConfigured = Object.values(firebaseConfig).every(Boolean);
