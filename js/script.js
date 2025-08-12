// Usuarios permitidos
const USERS = [
	{ username: "admin", password: "1234", isAdmin: true },
	{ username: "valet", password: "valet2024", isAdmin: false },
];

let currentRole = null;
let isParkeroLogged = false;
let ws = null;
let queue = [];
let dbService = null;
let currentUser = null;

async function initDatabaseService() {
	const module = await import("./IDatabaseService.js");
	const DatabaseServices = module.default;
	dbService = new DatabaseServices();
}

function initWebSocket() {
	ws = new WebSocket("ws://localhost:8080");

	ws.onopen = () => {
		console.log("Conectado al servidor WebSocket");
	};

	ws.onmessage = (event) => {
		const data = JSON.parse(event.data);
		switch (data.type) {
			case "INIT":
				queue = data.queue;
				renderQueue();
				updatePositionCounter();
				break;
			case "UPDATE":
				queue = data.queue;
				renderQueue();
				updatePositionCounter();
				break;
			case "NOTIFICATION":
				if (currentRole === "cliente") {
					const myTicket = getMyTicket();
					if (
						myTicket &&
						data.ticket.number === myTicket.number &&
						data.ticket.timestamp === myTicket.timestamp
					) {
						notifyCliente(data.message);
					}
				}
				break;
		}
	};

	ws.onerror = (error) => {
		console.error("Error en WebSocket:", error);
	};

	ws.onclose = () => {
		console.log("Desconectado del servidor WebSocket");
	};
}

function showRole() {
	document.getElementById("roleBox").style.display = "flex";
	document.getElementById("loginBox").style.display = "none";
	document.getElementById("mainBox").style.display = "none";
	document.getElementById("adminView").style.display = "none";
	document.getElementById("notifyBox").style.display = "none";
	currentRole = null;
	isParkeroLogged = false;
	if (ws) ws.close();
}

function showLogin() {
	document.getElementById("roleBox").style.display = "none";
	document.getElementById("loginBox").style.display = "flex";
	document.getElementById("mainBox").style.display = "none";
	document.getElementById("adminView").style.display = "none";
	document.getElementById("loginError").style.display = "none";
}

function showApp() {
	document.getElementById("roleBox").style.display = "none";
	document.getElementById("loginBox").style.display = "none";
	document.getElementById("mainBox").style.display = "flex";
	document.getElementById("adminView").style.display = "none";
	document.getElementById("adminBtn").style.display = "none";
	document.getElementById("logoutBtn").style.display =
		currentRole === "parkero" ? "inline-block" : "none";

	if (isParkeroLogged && currentUser && currentUser.isAdmin) {
		document.getElementById("adminBtn").style.display = "block";
	}

	updateClienteUI();
	renderQueue();
}

async function showAdminView() {
	document.getElementById("mainBox").style.display = "none";
	document.getElementById("adminView").style.display = "flex";

	try {
		const tickets = await dbService.getHistoricalTickets();
		renderHistoricalTickets(tickets);
	} catch (error) {
		console.error("Error loading tickets:", error);
		notifyCliente("Error cargando registros históricos");
	}
}

function renderHistoricalTickets(tickets) {
	const container = document.getElementById("historicalTickets");
	container.innerHTML = "";

	if (tickets.length === 0) {
		container.innerHTML = "<p>No hay tickets registrados</p>";
		return;
	}

	const table = document.createElement("table");
	table.className = "tickets-table";

	table.innerHTML = `
    <tr>
      <th>Ticket</th>
      <th>Fecha</th>
      <th>Estado</th>
    </tr>
  `;

	tickets.forEach((ticket) => {
		const row = document.createElement("tr");
		const fecha = ticket.fecha.toLocaleString("es-ES", {
			day: "numeric",
			month: "long",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			timeZoneName: "short",
		});

		row.innerHTML = `
      <td>${ticket.number}</td>
      <td>${fecha}</td>
      <td>${ticket.status}</td>
    `;

		table.appendChild(row);
	});

	container.appendChild(table);
}

function updatePositionCounter() {
	const counter = document.getElementById("positionCounter");
	const positionText = document.getElementById("positionText");
	const myTicket = getMyTicket();

	if (currentRole === "cliente" && myTicket) {
		const activeTickets = queue.filter((t) => !t.entregado && !t.noentregado);
		const myPosition = activeTickets.findIndex(
			(t) => t.number === myTicket.number && t.timestamp === myTicket.timestamp
		);

		if (myPosition !== -1) {
			const position = myPosition + 1;
			const ahead = myPosition > 0 ? myPosition : 0;

			positionText.textContent = `Tu ticket está en posición #${position}. `;
			if (ahead > 0) {
				positionText.textContent += `Hay ${ahead} ${
					ahead === 1 ? "ticket" : "tickets"
				} por delante.`;
			} else {
				positionText.textContent += "Es tu turno!";
			}

			counter.style.display = "block";
			return;
		}
	}

	counter.style.display = "none";
}

function updateClienteUI() {
	const myTicket = getMyTicket();
	const inputBox = document.getElementById("inputBox");
	const removeBtn = document.getElementById("removeBtn");
	const instructions = document.getElementById("instructions");

	if (currentRole === "cliente") {
		if (myTicket) {
			inputBox.style.display = "none";
			removeBtn.style.display = "block";
			instructions.innerHTML =
				"Ya tienes un ticket en cola.<br>Puedes cancelar el retiro si lo deseas.";
		} else {
			inputBox.style.display = "flex";
			removeBtn.style.display = "none";
			instructions.innerHTML =
				"Introduce tu número de ticket para agregarlo a la fila.<br><b>Solo puedes ingresar un número a la vez.</b>";
		}
	} else {
		inputBox.style.display = "flex";
		removeBtn.style.display = "none";
		instructions.innerHTML =
			"Puedes marcar los tickets como <b>Entregado</b> o <b>No entregado</b> usando los botones. El ticket se eliminará automáticamente después de 5 segundos.<br>Solo los parkeros pueden cambiar el estado.";
	}
	updatePositionCounter();
}

function renderQueue() {
	const queueBox = document.getElementById("queueBox");
	queueBox.innerHTML = "";
	const myTicket = getMyTicket();
	let ticketStillActive = false;

	queue.forEach((item, idx) => {
		const div = document.createElement("div");
		div.className =
			"queue-item" +
			(item.entregado ? " entregado" : "") +
			(item.noentregado ? " noentregado" : "");
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
		if (item.entregado) {
			status.textContent = "Entregado";
		} else if (item.noentregado) {
			status.textContent = "No entregado";
		} else {
			status.textContent = "Por entregar";
		}
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
			btnEntregar.onclick = function (e) {
				e.stopPropagation();
				if (ws && ws.readyState === WebSocket.OPEN) {
					ws.send(
						JSON.stringify({
							type: "UPDATE_STATUS",
							ticket: item,
							status: "entregado",
						})
					);

					// Actualizar en Firestore
					if (dbService) {
						dbService.editData("tickets", item.id, { status: "entregado" });
					}
				}
			};
			actions.appendChild(btnEntregar);

			const btnNoEntregar = document.createElement("button");
			btnNoEntregar.className = "noentregar-btn";
			btnNoEntregar.textContent = "No entregado";
			btnNoEntregar.onclick = function (e) {
				e.stopPropagation();
				if (ws && ws.readyState === WebSocket.OPEN) {
					ws.send(
						JSON.stringify({
							type: "UPDATE_STATUS",
							ticket: item,
							status: "noentregado",
						})
					);

					// Actualizar en Firestore
					if (dbService) {
						dbService.editData("tickets", item.id, { status: "noentregado" });
					}
				}
			};
			actions.appendChild(btnNoEntregar);

			div.appendChild(actions);
		}

		if (
			currentRole === "cliente" &&
			myTicket &&
			item.number === myTicket.number &&
			item.timestamp === myTicket.timestamp &&
			!item.entregado &&
			!item.noentregado
		) {
			ticketStillActive = true;
		}

		if (
			currentRole === "cliente" &&
			myTicket &&
			item.number === myTicket.number &&
			item.timestamp === myTicket.timestamp &&
			(item.entregado || item.noentregado)
		) {
			setMyTicket(null);
			setTimeout(updateClienteUI, 100);
		}

		queueBox.appendChild(div);
	});

	if (currentRole === "cliente" && myTicket && !ticketStillActive) {
		setMyTicket(null);
		setTimeout(updateClienteUI, 100);
	}

	updatePositionCounter();
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
	initWebSocket();

	if (role === "cliente") {
		showApp();
		updateClienteUI();
	} else {
		showLogin();
	}
}

document.getElementById("loginForm").onsubmit = function (e) {
	e.preventDefault();
	const user = document.getElementById("username").value.trim();
	const pass = document.getElementById("password").value;
	const found = USERS.find((u) => u.username === user && u.password === pass);

	if (found) {
		isParkeroLogged = true;
		currentUser = found;
		showApp();
	} else {
		document.getElementById("loginError").textContent =
			"Usuario o contraseña incorrectos";
		document.getElementById("loginError").style.display = "block";
	}
};

function notifyCliente(msg) {
	const box = document.getElementById("notifyBox");
	box.textContent = msg;
	box.style.display = "block";
	setTimeout(() => {
		box.style.display = "none";
	}, 4000);
}

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

function removeMyTicket() {
	const myTicket = getMyTicket();
	if (!myTicket) return;

	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(
			JSON.stringify({
				type: "REMOVE_TICKET",
				ticket: myTicket,
			})
		);
	}

	setMyTicket(null);
	updateClienteUI();
}

async function addToQueue() {
	if (currentRole === "cliente" && getMyTicket()) {
		notifyCliente(
			"Ya tienes un ticket en cola. Cancela el retiro si deseas ingresar otro."
		);
		return;
	}

	const input = document.getElementById("numberInput");
	const value = input.value.trim();
	if (!value) return;

	const now = new Date();
	const ticket = {
		number: value,
		timestamp: now.toLocaleString(),
		entregado: false,
		noentregado: false,
	};

	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(
			JSON.stringify({
				type: "ADD_TICKET",
				ticket: ticket,
			})
		);
	}

	// Guardar en Firestore
	if (dbService) {
		try {
			const docId = await dbService.createData("tickets", {
				number: value,
				status: "pendiente",
				fecha: new Date(),
			});
			ticket.id = docId; // Guardar el ID para futuras actualizaciones
		} catch (error) {
			console.error("Error saving to Firestore:", error);
		}
	}

	if (currentRole === "cliente") {
		setMyTicket(ticket);
		updateClienteUI();
	}

	input.value = "";
	input.focus();
}

document
	.getElementById("numberInput")
	.addEventListener("keydown", function (event) {
		if (event.key === "Enter") {
			addToQueue();
		}
	});

// Inicialización
document.addEventListener("DOMContentLoaded", async () => {
	showRole();
	await initDatabaseService();
});
