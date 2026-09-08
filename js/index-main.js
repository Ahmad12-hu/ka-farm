import { KAStorage } from "/js/storage.js";
import { Toast } from "/js/components/toast.js";

window.tryAccessDefault = () => {
  const user = KAStorage.getCurrentUser();
  if (user) {
    window.accessDashboard(user.role.toLowerCase());
  } else {
    window.accessDashboard("terrain");
  }
};

window.accessDashboard = (role) => {
  let user = null;
  if (role === "admin") {
    user = {
      uid: "demo-admin",
      name: "Administrateur",
      email: "admin@ka-farm.sn",
      role: "admin",
      enterpriseName: "KA Farm",
      enterpriseCode: "KA-FARM",
    };
  } else {
    user = {
      uid: "demo-user",
      name: "Utilisateur KA",
      email: "user@ka-farm.sn",
      role: "Terrain",
      enterpriseName: "KA Farm",
      enterpriseCode: "KA-FARM",
    };
  }
  KAStorage.setCurrentUser(user);
  window.location.href = "/pages/shared/dashboard.html";
};

window.sendPreloadedQuestion = async (text) => {
  const input = document.getElementById("ai-chat-input");
  if (input) {
    input.value = text;
    const form = document.getElementById("ai-chat-form");
    if (form) {
      form.dispatchEvent(new Event("submit"));
    }
  }
};

const chatForm = document.getElementById("ai-chat-form");
const chatInput = document.getElementById("ai-chat-input");
const chatMessages = document.getElementById("ai-chat-messages");

if (chatForm && chatInput && chatMessages) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const prompt = chatInput.value.trim();
    if (!prompt) return;

    const userMsgDiv = document.createElement("div");
    userMsgDiv.className = "flex gap-3 items-start justify-end text-right";
    userMsgDiv.innerHTML = `
      <div class="bg-emerald-600 text-white p-3.5 rounded-2xl max-w-[85%] space-y-1 text-left">
        <p class="font-semibold leading-relaxed">${prompt}</p>
      </div>
      <div class="h-6 w-6 bg-emerald-800 rounded-md flex items-center justify-center flex-shrink-0 text-white font-extrabold text-[10px]">U</div>
    `;
    chatMessages.appendChild(userMsgDiv);
    chatInput.value = "";
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const loaderDiv = document.createElement("div");
    loaderDiv.className = "flex gap-3 items-start";
    loaderDiv.innerHTML = `
      <div class="h-6 w-6 bg-emerald-600 rounded-md flex items-center justify-center flex-shrink-0 text-white font-extrabold text-[10px]">AI</div>
      <div class="bg-[#040D06]/70 border border-emerald-950/30 p-3.5 rounded-2xl max-w-[85%] space-y-1" id="ai-msg-loader">
        <div class="flex items-center gap-1">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce"></span>
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" style="animation-delay: 0.2s"></span>
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" style="animation-delay: 0.4s"></span>
        </div>
      </div>
    `;
    chatMessages.appendChild(loaderDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, history: [] }),
      });

      const loader = document.getElementById("ai-msg-loader");
      if (loader) loader.remove();

      if (!response.ok) {
        // Logger le status HTTP + corps de la réponse d'erreur (JSON ou texte) avant de throw
        const rawErrorBody = await response.text().catch(() => "");
        let errorBody = null;
        try {
          errorBody = rawErrorBody ? JSON.parse(rawErrorBody) : null;
        } catch {
          errorBody = rawErrorBody || null;
        }
        console.error("[Gemini] Erreur de l'API", {
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
        });
        const message =
          (errorBody && errorBody.error) ||
          rawErrorBody ||
          response.statusText ||
          "Gemini API call failed";
        throw new Error(message);
      }
      const data = await response.json();

      const aiResponseDiv = document.createElement("div");
      aiResponseDiv.className = "flex gap-3 items-start";
      aiResponseDiv.innerHTML = `
        <div class="h-6 w-6 bg-emerald-600 rounded-md flex items-center justify-center flex-shrink-0 text-white font-extrabold text-[10px]">AI</div>
        <div class="bg-[#040D06]/70 border border-emerald-950/30 p-3.5 rounded-2xl max-w-[85%] space-y-2">
          <p class="font-semibold leading-relaxed whitespace-pre-line">${data.text}</p>
        </div>
      `;
      chatMessages.appendChild(aiResponseDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (err) {
      console.error(err);
      const loader = document.getElementById("ai-msg-loader");
      if (loader) loader.remove();

      const errorDiv = document.createElement("div");
      errorDiv.className = "flex gap-3 items-start";
      errorDiv.innerHTML = `
        <div class="h-6 w-6 bg-red-600 rounded-md flex items-center justify-center flex-shrink-0 text-white font-extrabold text-[10px]">!</div>
        <div class="bg-red-950/30 border border-red-500/20 p-3.5 rounded-2xl max-w-[85%] text-red-400">
          <p class="font-semibold leading-relaxed">Désolé, une erreur s'est produite lors de la connexion avec le conseiller horticole IA. Veuillez réessayer.</p>
        </div>
      `;
      chatMessages.appendChild(errorDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  });
}

const contactForm = document.getElementById("landing-contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("contact-name").value;
    const email = document.getElementById("contact-email").value;
    const msg = document.getElementById("contact-message").value;

    KAStorage.init();
    const alerts = KAStorage.getAlerts() || [];
    alerts.unshift({
      id: `A-${Date.now()}`,
      title: `📬 Contact public : ${name}`,
      message: `Nouveau message de ${name} (${email}) : "${msg.slice(0, 80)}..."`,
      type: "info",
      date: new Date().toISOString().split("T")[0],
      isRead: false,
    });
    KAStorage.saveAlerts(alerts);

    Toast.success(`Merci ${name} ! Votre message a bien été transmis à l'équipe KA-Farm.`);
    contactForm.reset();
  });
}
