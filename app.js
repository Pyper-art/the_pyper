console.log("Piper Chat UI loaded");

const API_BASE = "http://localhost:8000";

fetch(`${API_BASE}`)
  .then((response) => {
    console.log("Health check response status:", response.status);
    if (!response.ok) throw new Error("Network response was not ok");
    return response.json(); // Parses JSON response into native JS object
  })
  .then((data) => console.log(data))
  .catch((error) => console.error("Fetch error:", error));

// app.js - Piper Chat UI
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

  console.log('igothere')
  // const loadingModal = new bootstrap.Modal(
  //   document.getElementById("loading-modal"),
  // );

  console.log('igothere2')
  // Change this to your deployed Piper backend URL
  const API_BASE = "http://localhost:8000";

  fetch(`${API_BASE}`)
    .then((response) => {
      console.log("Health check response status:", response.status);
      if (!response.ok) throw new Error("Network response was not ok");
      return response.json(); // Parses JSON response into native JS object
    })
    .then((data) => console.log(data))
    .catch((error) => console.error("Fetch error:", error));

  let currentFile = null;
  let chatHistory = [];

  // Initialize welcome message time
  document.getElementById("welcome-time").textContent =
    new Date().toLocaleTimeString();

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
      filePreview.classList.remove("d-none");
      attachBtn.innerHTML = '<i class="fas fa-file-csv"></i>';
      attachBtn.classList.add("attached");
    }
  }

  function removeFile() {
    currentFile = null;
    fileInput.value = "";
    filePreview.classList.add("d-none");
    attachBtn.innerHTML = '<i class="fas fa-paperclip"></i>';
    attachBtn.classList.remove("attached");
  }

  function startNewChat() {
    messages.innerHTML = "";
    chatHistory = [];
    removeFile();
    messageInput.focus();
  }

  async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message && !currentFile) return;

    // Add user message to chat
    addMessage("user", message, currentFile);
    messageInput.value = "";
    const fileToSend = currentFile;
    removeFile(); // Clear file after sending

    // loadingModal.show();

    try {
      let response;
      if (fileToSend) {
        // Use analyze endpoint with file
        response = await sendFileMessage(message, fileToSend);
      } else {
        // Use regular query endpoint
        response = await sendTextMessage(message);
      }

      // Add bot response to chat
      addMessage("bot", response);
    } catch (error) {
      addMessage("bot", `Error: ${error.message}`, null, true);
    } finally {
      // loadingModal.hide();
    }
  }

  async function sendTextMessage(message) {
    console.log("Sending text message:", message);
    const response = await fetch(`${API_BASE}/piper/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: message, user_id: "string" }), // Include user_id for better tracking
    });

    console.log("Text message response status:", response.status);  

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

    console.log("Sending file message with formData:", formData);

    const response = await fetch(`${API_BASE}/piper/report/analyze`, {
      method: "POST",
      body: formData,
    });

    console.log("File message response status:", response.status);



    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return formatAnalysisResponse(data);
  }

  function formatAnalysisResponse(data) {
    let response = "";

    // Summary
    if (data.summary && data.summary.text) {
      response += data.summary.text + "\n\n";
    }

    // Actions
    if (data.actions && data.actions.length > 0) {
      response += "**Recommended Actions:**\n";
      data.actions.forEach((action) => {
        response += `• ${action.action} (${action.confidence} confidence)\n`;
        if (action.rationale) {
          response += `  ${action.rationale}\n`;
        }
      });
      response += "\n";
    }

    // Cross-analysis insights
    if (data.cross_analysis) {
      const cross = data.cross_analysis;
      if (cross.soer && cross.soer.length > 0) {
        response += "**Stock-Out Risk (SOER):**\n";
        cross.soer.slice(0, 3).forEach((soer) => {
          response += `• ${soer.location}: ${soer.soer}% SOER\n`;
        });
        response += "\n";
      }

      if (cross.restock) {
        response += `**Restock Signals:** ${cross.restock.urgent_count} urgent, ${cross.restock.monitor_count} monitor\n\n`;
      }

      if (cross.note) {
        response += `*${cross.note}*\n\n`;
      }
    }

    return (
      response ||
      "Analysis complete. Check the details below for more information."
    );
  }

  function addMessage(sender, content, file = null, isError = false) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}-message`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.innerHTML =
      sender === "user"
        ? '<i class="fas fa-user"></i>'
        : '<i class="fas fa-robot"></i>';

    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";

    const header = document.createElement("div");
    header.className = "message-header";
    header.innerHTML = `
      <span class="message-sender">${sender === "user" ? "You" : "Piper"}</span>
      <span class="message-time">${new Date().toLocaleTimeString()}</span>
    `;

    const textDiv = document.createElement("div");
    textDiv.className = "message-text";

    if (file) {
      textDiv.innerHTML += `
        <div class="file-attachment">
          <i class="fas fa-file-csv"></i> ${file.name}
        </div>
      `;
    }

    if (isError) {
      textDiv.innerHTML += `<div class="alert alert-danger">${content}</div>`;
    } else {
      // Convert markdown-style formatting to HTML
      const formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/\n/g, "<br>");
      textDiv.innerHTML += formattedContent;
    }

    contentDiv.appendChild(header);
    contentDiv.appendChild(textDiv);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);

    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;

    // Add to chat history
    chatHistory.push({
      sender,
      content,
      file: file ? file.name : null,
      timestamp: new Date(),
    });
  }
});
