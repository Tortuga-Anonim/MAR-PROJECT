// Usuarios permitidos
const USERS = [
	{ username: "admin", password: "8756", isAdmin: true },
	{ username: "valet", password: "valet2024", isAdmin: false },
];

// Variables globales
let currentRole = null;
let isParkeroLogged = false;
let queue = [];
let currentUser = null;
let unsubscribeTickets = null;

// ================== FUNCIONES DE TIEMPO REAL ==================
function initRealtimeListener() {
	unsubscribeTickets = dbService.consultData("tickets", (tickets) => {
		queue = tickets;
		renderQueue();
		updatePositionCounter();

		if (currentRole === "cliente") {
			const myTicket = getMyTicket();
			if (myTicket) {
				const currentTicket = queue.find((t) => t.id === myTicket.id);
				if (currentTicket && currentTicket.status === "no entregado") {
					notifyCliente("Comuníquese con el personal");
				}
			}
		}
	});
}

function stopRealtimeListener() {
	if (unsubscribeTickets) {
		unsubscribeTickets();
		unsubscribeTickets = null;
	}
}

// ================== FUNCIONES DE INTERFAZ ==================
function showRole() {
	document.getElementById("roleBox").style.display = "flex";
	document.getElementById("loginBox").style.display = "none";
	document.getElementById("mainBox").style.display = "none";
	document.getElementById("adminView").style.display = "none";
	document.getElementById("notifyBox").style.display = "none";
	currentRole = null;
	isParkeroLogged = false;
	stopRealtimeListener();
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
            <th>Acciones</th>
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
            <td><button class="delete-btn" data-id="${ticket.id}">Eliminar</button></td>
        `;

		table.appendChild(row);
	});

	// Agregar event listeners a los botones de eliminar
	table.querySelectorAll(".delete-btn").forEach((button) => {
		button.addEventListener("click", function () {
			const ticketId = this.getAttribute("data-id");
			deleteHistoricalTicket(ticketId);
		});
	});

	container.appendChild(table);
}

async function deleteHistoricalTicket(ticketId) {
	if (!confirm("¿Estás seguro de eliminar este ticket permanentemente?")) {
		return;
	}

	try {
		await dbService.deleteData("tickets", ticketId);
		// Recargar la vista después de eliminar
		const tickets = await dbService.getHistoricalTickets();
		renderHistoricalTickets(tickets);
		notifyCliente("Ticket eliminado correctamente");
	} catch (error) {
		console.error("Error eliminando ticket histórico:", error);
		notifyCliente("Error al eliminar ticket");
	}
}

function updatePositionCounter() {
	const counter = document.getElementById("positionCounter");
	const positionText = document.getElementById("positionText");
	const myTicket = getMyTicket();

	const activeTickets = queue.filter((t) => t.status === "pendiente");

	if (currentRole === "cliente" && myTicket) {
		const myPosition = activeTickets.findIndex((t) => t.id === myTicket.id);

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
			"Puedes marcar los tickets como <b>Entregado</b> o <b>No entregado</b> usando los botones.<br>Solo los parkeros pueden cambiar el estado.";
	}
	updatePositionCounter();
}

function renderQueue() {
	const queueBox = document.getElementById("queueBox");
	queueBox.innerHTML = "";
	const myTicket = getMyTicket();
	let ticketStillActive = false;

	// Filtrar solo tickets pendientes
	const activeTickets = queue.filter((t) => t.status === "pendiente");

	// Ordenar por fecha de creación (más antiguos primero)
	const sortedQueue = [...activeTickets].sort(
		(a, b) => a.createdAt - b.createdAt
	);

	sortedQueue.forEach((item) => {
		const div = document.createElement("div");
		div.className = "queue-item";

		const infoDiv = document.createElement("div");
		infoDiv.className = "queue-info";

		const numberSpan = document.createElement("span");
		numberSpan.textContent = item.number;

		const timestamp = document.createElement("span");
		timestamp.className = "timestamp";
		timestamp.textContent =
			item.timestamp || new Date(item.createdAt).toLocaleString();

		infoDiv.appendChild(numberSpan);
		infoDiv.appendChild(timestamp);
		div.appendChild(infoDiv);

		const status = document.createElement("span");
		status.className = "status-label";
		status.textContent = "Por entregar";
		div.appendChild(status);

		if (currentRole === "parkero" && isParkeroLogged) {
			const actions = document.createElement("div");
			actions.className = "queue-actions";

			const btnEntregar = document.createElement("button");
			btnEntregar.className = "entregar-btn";
			btnEntregar.textContent = "Entregado";
			btnEntregar.onclick = function (e) {
				e.stopPropagation();
				updateTicketStatus(item, "entregado");
			};
			actions.appendChild(btnEntregar);

			const btnNoEntregar = document.createElement("button");
			btnNoEntregar.className = "noentregar-btn";
			btnNoEntregar.textContent = "No entregado";
			btnNoEntregar.onclick = function (e) {
				e.stopPropagation();
				updateTicketStatus(item, "noentregado");
			};
			actions.appendChild(btnNoEntregar);

			div.appendChild(actions);
		}

		if (currentRole === "cliente" && myTicket && item.id === myTicket.id) {
			ticketStillActive = true;
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
	stopRealtimeListener();

	if (role === "cliente" || isParkeroLogged) {
		initRealtimeListener();
	}

	if (role === "cliente") {
		showApp();
		updateClienteUI();
	} else {
		showLogin();
	}
}

// ================== MANEJO DE TICKETS ==================
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

async function removeMyTicket() {
	const myTicket = getMyTicket();
	if (!myTicket || !myTicket.id) return;

	try {
		await dbService.deleteData("tickets", myTicket.id);
		setMyTicket(null);
		updateClienteUI();
	} catch (error) {
		console.error("Error eliminando ticket:", error);
		notifyCliente("Error al cancelar ticket");
	}
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

	try {
		const now = new Date();
		const docId = await dbService.createData("tickets", {
			number: value,
			status: "pendiente",
		});

		const ticket = {
			id: docId,
			number: value,
			status: "pendiente",
			timestamp: now.toLocaleString(),
			createdAt: now.getTime(),
		};

		if (currentRole === "cliente") {
			setMyTicket(ticket);
			updateClienteUI();
		}
	} catch (error) {
		console.error("Error guardando ticket:", error);
		notifyCliente("Error al agregar ticket");
	}

	input.value = "";
	input.focus();
}

async function updateTicketStatus(item, status) {
	try {
		await dbService.editData("tickets", item.id, {
			status: status,
			updatedAt: new Date().getTime(),
		});
	} catch (error) {
		console.error("Error actualizando estado:", error);
	}
}

async function clearOldTickets() {
	if (!currentUser?.isAdmin) return;

	if (
		confirm("¿Borrar TODOS los tickets históricos? Esto no se puede deshacer.")
	) {
		try {
			// 1. Obtener todos los tickets
			const tickets = await dbService.getHistoricalTickets();

			// 2. Borrar uno por uno (límite gratuito de Firestore)
			for (const ticket of tickets) {
				await dbService.deleteData("tickets", ticket.id);
			}

			notifyCliente(`Se borraron ${tickets.length} tickets`);
			renderHistoricalTickets([]); // Limpiar la tabla
		} catch (error) {
			console.error("Error borrando tickets:", error);
			notifyCliente("Error al borrar tickets");
		}
	}
}

// ================== EVENT LISTENERS ==================
document.getElementById("loginForm").onsubmit = function (e) {
	e.preventDefault();
	const user = document.getElementById("username").value.trim();
	const pass = document.getElementById("password").value;
	const found = USERS.find((u) => u.username === user && u.password === pass);

	if (found) {
		isParkeroLogged = true;
		currentUser = found;
		initRealtimeListener();
		showApp();
	} else {
		document.getElementById("loginError").textContent =
			"Usuario o contraseña incorrectos";
		document.getElementById("loginError").style.display = "block";
	}
};

document
	.getElementById("numberInput")
	.addEventListener("keydown", function (event) {
		if (event.key === "Enter") {
			addToQueue();
		}
	});

function notifyCliente(msg) {
	const box = document.getElementById("notifyBox");
	box.textContent = msg;
	box.style.display = "block";
	setTimeout(() => {
		box.style.display = "none";
	}, 4000);
}

// ================== INICIALIZACIÓN ==================
document.addEventListener("DOMContentLoaded", () => {
	showRole();
});
