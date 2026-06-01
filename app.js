console.log("Piper Chat UI loaded - Dark Theme Edit");

// --- Backend selection -------------------------------------------------
// When the page is opened locally (file:// or localhost) we talk to a local
// Piper server; when it is served from a real host we use the deployment.
const LOCAL_API = "http://127.0.0.1:8002";
const REMOTE_API = "https://experiments-ml-1.onrender.com";
const IS_LOCAL =
  location.protocol === "file:" ||
  ["localhost", "127.0.0.1", ""].includes(location.hostname);
const API_BASE = IS_LOCAL ? LOCAL_API : REMOTE_API;

// Optional API key. Leave empty for local testing when the server runs with
// PIPER_DISABLE_AUTH=1. Set it to hit a deployment that enforces auth.
const API_KEY = "";

// Build request headers, attaching the api_key only when one is configured.
function withApiKey(headers = {}) {
  return API_KEY ? { ...headers, api_key: API_KEY } : headers;
}

console.log("Piper UI -> API_BASE:", API_BASE);

// Basic health check
fetch(`${API_BASE}/piper/health`)
  .then((response) => response.json())
  .then((data) => console.log("Piper System Health:", data))
  .catch((error) => console.error("Health Check failed:", error));

document.addEventListener("DOMContentLoaded", function () {
  const messageInput = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const attachBtn = document.getElementById("attach-file");
  const fileInput = document.getElementById("file-input");
  const filePreview = document.getElementById("file-preview");
  const fileName = document.getElementById("file-name");
  const removeFileBtn = document.getElementById("remove-file");
  const messages = document.getElementById("messages");
  const newChatBtn = document.getElementById("new-chat");

  let currentFile = null;
  let chatHistory = [];
  let isTyping = false; // Prevent multiple requests at once

  // Initialize welcome message time
  document.getElementById("welcome-time").textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Auto-resize textarea
  messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight < 150 ? this.scrollHeight : 150) + 'px';
  });

  // Event listeners
  messageInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener("click", sendMessage);
  attachBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", handleFileSelect);
  removeFileBtn.addEventListener("click", removeFile);
  newChatBtn.addEventListener("click", startNewChat);

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      currentFile = file;
      fileName.textContent = file.name;
      filePreview.classList.remove("hidden");
      attachBtn.classList.add("attached");
    }
  }

  function removeFile() {
    currentFile = null;
    fileInput.value = "";
    filePreview.classList.add("hidden");
    attachBtn.classList.remove("attached");
  }

  function startNewChat() {
    // Preserve welcome message, remove others
    const welcomeHtml = messages.querySelector('.welcome-message').outerHTML;
    messages.innerHTML = welcomeHtml;
    chatHistory = [];
    removeFile();
    messageInput.value = "";
    messageInput.style.height = 'auto';
    messageInput.focus();
  }

  // --- Inline Typing Indicator Logic ---
  let typingIndicatorId = null;

  function showTypingIndicator() {
    isTyping = true;
    const typingDiv = document.createElement("div");
    typingDiv.className = "message bot-message";
    typingDiv.id = "typing-indicator";
    
    // UUID-ish id to make sure we remove the right one
    typingIndicatorId = "typing-" + Date.now();
    typingDiv.dataset.id = typingIndicatorId;

    typingDiv.innerHTML = `
      <div class="message-avatar"><i class="fas fa-robot"></i></div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-sender">Piper</span>
        </div>
        <div class="typing-indicator">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>
    `;
    
    messages.appendChild(typingDiv);
    messages.scrollTop = messages.scrollHeight;
  }

  function hideTypingIndicator() {
    isTyping = false;
    const indicator = document.getElementById("typing-indicator");
    if (indicator) {
      indicator.remove();
    }
  }

  async function sendMessage() {
    if (isTyping) return;
    
    const message = messageInput.value.trim();
    if (!message && !currentFile) return;

    // Add user message to chat
    addMessage("user", message, currentFile);
    
    // Clean up input
    messageInput.value = "";
    messageInput.style.height = 'auto';
    
    const fileToSend = currentFile;
    removeFile(); // Clear file preview immediately after appending visually

    showTypingIndicator();

    try {
      let response;
      if (fileToSend) {
        response = await sendFileMessage(message, fileToSend);
      } else {
        response = await sendTextMessage(message);
      }
      
      hideTypingIndicator();
      addMessage("bot", response);
      
    } catch (error) {
      hideTypingIndicator();
      addMessage("bot", `Error connecting to Piper: ${error.message}`, null, true);
    }
  }

  async function sendTextMessage(message) {
    const response = await fetch(`${API_BASE}/piper/query`, {
      method: "POST",
      headers: withApiKey({ "Content-Type": "application/json" }),
      body: JSON.stringify({ query: message }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.answer;
  }

  async function sendFileMessage(message, file) {
    const formData = new FormData();
    formData.append("file", file);
    if (message) {
      formData.append("query", message);
    }

    const response = await fetch(`${API_BASE}/piper/report/analyze`, {
      method: "POST",
      // Do NOT set Content-Type for FormData — the browser adds the multipart
      // boundary. Only attach the api_key header when one is configured.
      headers: withApiKey(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return formatAnalysisResponse(data);
  }

  function formatAnalysisResponse(data) {
    // We can rely on marked.js to render this, so we just build a markdown string
    let md = "";

    // Summary
    if (data.summary && data.summary.text) {
      md += data.summary.text + "\n\n";
    }

    // Actions
    if (data.actions && data.actions.length > 0) {
      md += "**Recommended Actions:**\n";
      data.actions.forEach((action) => {
        md += `- **${action.action}** (${action.confidence} confidence)\n  ${action.rationale}\n`;
      });
      md += "\n";
    }

    // Cross-analysis insights
    if (data.cross_analysis) {
      const cross = data.cross_analysis;
      if (cross.soer && cross.soer.length > 0) {
        md += "**Stock-Out Risk (SOER):**\n";
        cross.soer.slice(0, 3).forEach((soer) => {
          md += `- ${soer.location}: ${soer.soer}% SOER\n`;
        });
        md += "\n";
      }

      if (cross.restock) {
        md += `**Restock Signals:** ${cross.restock.urgent_count} urgent, ${cross.restock.monitor_count} monitor\n\n`;
      }

      if (cross.note) {
        md += `*${cross.note}*\n\n`;
      }
    }

    return md || "Analysis complete. View details in the dashboard.";
  }

  function addMessage(sender, content, file = null, isError = false) {
    // Hide welcome message if it's the first actual message
    const welcome = document.querySelector('.welcome-message');
    if (welcome && welcome.style.display !== 'none') {
      welcome.style.display = 'none';
    }

    const messageDiv = document.createElement("div");
    // Append 'error-message' class if it's an error
    let cls = `message ${sender}-message`;
    if (isError) cls += " error-message";
    messageDiv.className = cls;

    const isUser = sender === "user";
    const avatarHtml = isUser
      ? '<div class="message-avatar"><i class="fas fa-user"></i></div>'
      : '<div class="message-avatar"><i class="fas fa-robot"></i></div>';

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const headerHtml = `
      <div class="message-header">
        <span class="message-sender">${isUser ? "You" : "Piper"}</span>
        <span class="message-time">${timeString}</span>
      </div>
    `;

    // Content processing
    let contentHtml = "";
    if (file) {
      contentHtml += `
        <div class="file-attachment">
          <i class="fas fa-file-csv"></i> ${file.name}
        </div>
      `;
    }

    if (content) {
      // Use marked plugin if it's the bot, else escape standard text for user
      if (isUser) {
        // basic escape to prevent HTML injection in user text
        const span = document.createElement('span');
        span.textContent = content;
        contentHtml += span.innerHTML;
      } else {
        // Parse markdown for bot 
        contentHtml += window.marked ? marked.parse(content) : content;
      }
    }

    // Assemble completely
    messageDiv.innerHTML = `
      ${avatarHtml}
      <div class="message-content">
        ${headerHtml}
        <div class="message-text">
          ${contentHtml}
        </div>
      </div>
    `;

    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;

    // Save to memory
    chatHistory.push({
      sender,
      content,
      file: file ? file.name : null,
      timestamp: new Date(),
    });
  }
});
