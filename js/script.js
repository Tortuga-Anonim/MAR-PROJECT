const USERS = [
    { username: "admin", password: "1234" },
    { username: "valet", password: "valet2024" }
];

const WS_URL = "ws://localhost:8080";
let ws = null;
let currentRole = null;
let isParkeroLogged = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Elementos UI
const elements = {
    roleBox: document.getElementById("roleBox"),
    loginBox: document.getElementById("loginBox"),
    mainBox: document.getElementById("mainBox"),
    notifyBox: document.getElementById("notifyBox"),
    loginError: document.getElementById("loginError"),
    queueBox: document.getElementById("queueBox"),
    numberInput: document.getElementById("numberInput"),
    addBtn: document.getElementById("addBtn"),
    removeBtn: document.getElementById("removeBtn"),
    instructions: document.getElementById("instructions"),
    logoutBtn: document.getElementById("logoutBtn")
};

// ===== WEBSOCKET FUNCTIONS =====
function initWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log("WebSocket connected");
        reconnectAttempts = 0;
        hideReconnectAlert();
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    ws.onerror = (error) => {
        console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
        console.log("WebSocket disconnected");
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            setTimeout(initWebSocket, 3000);
            reconnectAttempts++;
            showReconnectAlert();
        }
    };
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case "INIT":
        case "UPDATE":
            renderQueue(data.queue);
            updateClienteUI();
            break;
        case "NOTIFICATION":
            notifyCliente(data.message);
            const myTicket = getMyTicket();
            if (myTicket) {
                setMyTicket(null);
                updateClienteUI();
            }
            break;
    }
}

function showReconnectAlert() {
    const alert = document.getElementById("reconnectAlert") || createReconnectAlert();
    alert.style.display = "block";
    alert.textContent = `Intentando reconectar... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`;
}

function hideReconnectAlert() {
    const alert = document.getElementById("reconnectAlert");
    if (alert) alert.style.display = "none";
}

function createReconnectAlert() {
    const alert = document.createElement("div");
    alert.id = "reconnectAlert";
    alert.style.position = "fixed";
    alert.style.bottom = "20px";
    alert.style.left = "50%";
    alert.style.transform = "translateX(-50%)";
    alert.style.backgroundColor = "#e74c3c";
    alert.style.color = "white";
    alert.style.padding = "10px 20px";
    alert.style.borderRadius = "5px";
    alert.style.zIndex = "1000";
    document.body.appendChild(alert);
    return alert;
}

// ===== UI FUNCTIONS =====
function showRole() {
    elements.roleBox.style.display = "flex";
    elements.loginBox.style.display = "none";
    elements.mainBox.style.display = "none";
    elements.notifyBox.style.display = "none";
    currentRole = null;
    isParkeroLogged = false;
}

function showLogin() {
    elements.roleBox.style.display = "none";
    elements.loginBox.style.display = "flex";
    elements.mainBox.style.display = "none";
    elements.loginError.style.display = "none";
}

function showApp() {
    elements.roleBox.style.display = "none";
    elements.loginBox.style.display = "none";
    elements.mainBox.style.display = "flex";
    elements.logoutBtn.style.display = currentRole === "parkero" ? "inline-block" : "none";
    updateClienteUI();
}

function backToRole() {
    showRole();
}

function logout() {
    isParkeroLogged = false;
    showRole();
}

function selectRole(role) {
    currentRole = role;
    if (role === "cliente") {
        showApp();
    } else {
        showLogin();
    }
}

function notifyCliente(msg) {
    elements.notifyBox.textContent = msg;
    elements.notifyBox.style.display = "block";
    setTimeout(() => {
        elements.notifyBox.style.display = "none";
    }, 4000);
}

// ===== TICKET FUNCTIONS =====
function getMyTicket() {
    return JSON.parse(localStorage.getItem("my_valet_ticket") || "null");
}

function setMyTicket(ticket) {
    if (ticket) {
        localStorage.setItem("my_valet_ticket", JSON.stringify(ticket));
    } else {
        localStorage.removeItem("my_valet_ticket");
    }
}

function updateClienteUI() {
    const myTicket = getMyTicket();

    if (currentRole === "cliente") {
        if (myTicket) {
            elements.inputBox.style.display = "none";
            elements.removeBtn.style.display = "block";
            elements.instructions.innerHTML =
                "Tu retiro está en espera. Puedes cancelar el retiro si lo deseas.";
        } else {
            elements.inputBox.style.display = "flex";
            elements.removeBtn.style.display = "none";
            elements.instructions.innerHTML =
                "Introduce tu número de ticket para agregarlo a la fila.<br><b>Solo el personal autorizado puede marcar los tickets como entregados o no entregados.</b>";
        }
    } else {
        elements.inputBox.style.display = "flex";
        elements.removeBtn.style.display = "none";
        elements.instructions.innerHTML =
            "Puedes marcar los tickets como <b>Entregado</b> o <b>No entregado</b> usando los botones. El ticket se eliminará automáticamente después de 5 segundos.<br>Solo los parkeros pueden cambiar el estado.";
    }
}

function addToQueue() {
    if (currentRole === "cliente" && getMyTicket()) {
        notifyCliente("Ya tienes un ticket en cola");
        return;
    }

    const value = elements.numberInput.value.trim();
    if (!value) return;

    const ticket = {
        number: value,
        timestamp: new Date().toLocaleString(),
        entregado: false,
        noentregado: false,
    };

    // Enviar al backend
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: "ADD_TICKET",
            ticket: ticket
        }));
    }

    // Guardar el ticket del cliente y mostrar el botón de cancelar
    if (currentRole === "cliente") {
        setMyTicket(ticket);         // Guardamos el ticket del cliente
        updateClienteUI();           //  Esto fuerza que se actualice la interfaz y aparezca el botón
    }

    elements.numberInput.value = "";
    elements.numberInput.focus();
}
function removeMyTicket() {
    const myTicket = getMyTicket();
    if (!myTicket) return;

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: "REMOVE_TICKET",
            ticket: myTicket
        }));
    }

    setMyTicket(null);
    updateClienteUI();
}

function renderQueue(queue = []) {
    elements.queueBox.innerHTML = "";
    const myTicket = getMyTicket();
    let ticketStillActive = false;

    queue.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = `queue-item ${item.entregado ? "entregado" : ""} ${item.noentregado ? "noentregado" : ""}`;
        div.tabIndex = 0;

        const infoDiv = document.createElement("div");
        infoDiv.className = "queue-info";

        const numberSpan = document.createElement("span");
        numberSpan.textContent = item.number;

        const timestamp = document.createElement("span");
        timestamp.className = "timestamp";
        timestamp.textContent = item.timestamp;

        infoDiv.appendChild(numberSpan);
        infoDiv.appendChild(timestamp);
        div.appendChild(infoDiv);

        const status = document.createElement("span");
        status.className = "status-label";
        status.textContent = item.entregado ? "Entregado" : item.noentregado ? "No entregado" : "Por entregar";
        div.appendChild(status);

        if (
            currentRole === "parkero" &&
            isParkeroLogged &&
            !item.entregado &&
            !item.noentregado
        ) {
            const actions = document.createElement("div");
            actions.className = "queue-actions";

            const btnEntregar = document.createElement("button");
            btnEntregar.className = "entregar-btn";
            btnEntregar.textContent = "Entregado";
            btnEntregar.onclick = () => {
                ws.send(JSON.stringify({
                    type: "UPDATE_STATUS",
                    ticket: item,
                    status: "entregado"
                }));
                registrarEvento(item, "entregado");
            };

            const btnNoEntregar = document.createElement("button");
            btnNoEntregar.className = "noentregar-btn";
            btnNoEntregar.textContent = "No entregado";
            btnNoEntregar.onclick = () => {
                ws.send(JSON.stringify({
                    type: "UPDATE_STATUS",
                    ticket: item,
                    status: "noentregado"
                }));
                registrarEvento(item, "noentregado");
            };

            actions.appendChild(btnEntregar);
            actions.appendChild(btnNoEntregar);
            div.appendChild(actions);
        }

        // Verificar estado del ticket del cliente
        if (
            currentRole === "cliente" &&
            myTicket &&
            item.number === myTicket.number &&
            item.timestamp === myTicket.timestamp
        ) {
            if (item.entregado || item.noentregado) {
                setMyTicket(null);
                setTimeout(updateClienteUI, 100);
            } else {
                ticketStillActive = true;
            }
        }

        elements.queueBox.appendChild(div);
    });

    // Si ya no está en la cola, eliminar ticket y actualizar UI
    if (currentRole === "cliente" && myTicket && !ticketStillActive) {
        setMyTicket(null);
        setTimeout(updateClienteUI, 100);
    }
}

function registrarEvento(ticket, status) {
    console.log("Registro enviado al servidor:", {
        ...ticket,
        status: status,
        fechaRegistro: new Date().toISOString()
    });
}

// ===== EVENT LISTENERS =====
document.getElementById("loginForm").onsubmit = function (e) {
    e.preventDefault();
    const user = document.getElementById("username").value.trim();
    const pass = document.getElementById("password").value;
    const found = USERS.find((u) => u.username === user && u.password === pass);

    if (found) {
        isParkeroLogged = true;
        showApp();
    } else {
        elements.loginError.textContent = "Usuario o contraseña incorrectos";
        elements.loginError.style.display = "block";
    }
};

elements.numberInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        addToQueue();
    }
});

// ===== INICIALIZACIÓN =====
document.addEventListener("DOMContentLoaded", () => {
    initWebSocket();
    showRole();
});