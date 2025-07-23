// --- Usuarios permitidos (puedes agregar más) ---
const USERS = [
	{ username: "admin", password: "1234" },
	{ username: "valet", password: "valet2024" },
];

let currentRole = null; // 'cliente' o 'parkero'
let isParkeroLogged = false;

function showRole() {
	document.getElementById("roleBox").style.display = "flex";
	document.getElementById("loginBox").style.display = "none";
	document.getElementById("mainBox").style.display = "none";
	document.getElementById("notifyBox").style.display = "none";
	currentRole = null;
	isParkeroLogged = false;
}
function showLogin() {
	document.getElementById("roleBox").style.display = "none";
	document.getElementById("loginBox").style.display = "flex";
	document.getElementById("mainBox").style.display = "none";
	document.getElementById("loginError").style.display = "none";
}
function showApp() {
	document.getElementById("roleBox").style.display = "none";
	document.getElementById("loginBox").style.display = "none";
	document.getElementById("mainBox").style.display = "flex";
	document.getElementById("logoutBtn").style.display =
		currentRole === "parkero" ? "inline-block" : "none";
	updateClienteUI();
	renderQueue();
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
document.getElementById("loginForm").onsubmit = function (e) {
	e.preventDefault();
	const user = document.getElementById("username").value.trim();
	const pass = document.getElementById("password").value;
	const found = USERS.find((u) => u.username === user && u.password === pass);
	if (found) {
		isParkeroLogged = true;
		showApp();
	} else {
		document.getElementById("loginError").textContent =
			"Usuario o contraseña incorrectos";
		document.getElementById("loginError").style.display = "block";
	}
};
function getQueue() {
	return JSON.parse(localStorage.getItem("valet_queue") || "[]");
}
function setQueue(arr) {
	localStorage.setItem("valet_queue", JSON.stringify(arr));
}
function registrarEvento(ticket, status) {
	// Aquí deberías hacer un fetch POST a tu backend real
	// fetch('/api/registro', {method:'POST', body: JSON.stringify({...})})
	// Simulación:
	console.log("Registro enviado al servidor:", {
		...ticket,
		status: status,
		fechaRegistro: new Date().toISOString(),
	});
}
function notifyCliente(msg) {
	const box = document.getElementById("notifyBox");
	box.textContent = msg;
	box.style.display = "block";
	setTimeout(() => {
		box.style.display = "none";
	}, 4000);
}
// --- Cliente: solo puede tener un ticket activo ---
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
	const addBtn = document.getElementById("addBtn");
	const numberInput = document.getElementById("numberInput");
	const inputBox = document.getElementById("inputBox");
	const removeBtn = document.getElementById("removeBtn");
	const instructions = document.getElementById("instructions");
	if (currentRole === "cliente") {
		if (myTicket) {
			inputBox.style.display = "none";
			removeBtn.style.display = "block";
			instructions.innerHTML =
				"Tu retiro está en espera. Puedes cancelar el retiro si lo deseas.";
		} else {
			inputBox.style.display = "flex";
			removeBtn.style.display = "none";
			instructions.innerHTML =
				"Introduce tu número de ticket para agregarlo a la fila.<br><b>Solo el personal autorizado puede marcar los tickets como entregados o no entregados.</b>";
		}
	} else {
		inputBox.style.display = "flex";
		removeBtn.style.display = "none";
		instructions.innerHTML =
			"Puedes marcar los tickets como <b>Entregado</b> o <b>No entregado</b> usando los botones. El ticket se eliminará automáticamente después de 5 segundos.<br>Solo los parkeros pueden cambiar el estado.";
	}
}
function removeMyTicket() {
	const myTicket = getMyTicket();
	if (!myTicket) return;
	let queue = getQueue();
	queue = queue.filter(
		(q) => !(q.number === myTicket.number && q.timestamp === myTicket.timestamp)
	);
	setQueue(queue);
	setMyTicket(null);
	updateClienteUI();
	renderQueue();
}
function renderQueue() {
	const queueBox = document.getElementById("queueBox");
	queueBox.innerHTML = "";
	const queue = getQueue();
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
		// Estado
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
		// Acciones solo para parkero
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
				queue[idx].entregado = true;
				setQueue(queue);
				renderQueue();
				registrarEvento(queue[idx], "entregado");
				setTimeout(() => {
					const updatedQueue = getQueue();
					const i = updatedQueue.findIndex(
						(q) => q.number === item.number && q.timestamp === item.timestamp
					);
					if (i !== -1 && updatedQueue[i].entregado) {
						updatedQueue.splice(i, 1);
						setQueue(updatedQueue);
						renderQueue();
					}
				}, 5000);
			};
			actions.appendChild(btnEntregar);
			const btnNoEntregar = document.createElement("button");
			btnNoEntregar.className = "noentregar-btn";
			btnNoEntregar.textContent = "No entregado";
			btnNoEntregar.onclick = function (e) {
				e.stopPropagation();
				queue[idx].noentregado = true;
				setQueue(queue);
				renderQueue();
				registrarEvento(queue[idx], "noentregado");
				setTimeout(() => {
					const updatedQueue = getQueue();
					const i = updatedQueue.findIndex(
						(q) => q.number === item.number && q.timestamp === item.timestamp
					);
					if (i !== -1 && updatedQueue[i].noentregado) {
						updatedQueue.splice(i, 1);
						setQueue(updatedQueue);
						renderQueue();
						notifyCliente(
							"El tiempo de espera de tu vehículo ha expirado. Consulta con el personal."
						);
					}
				}, 5000);
			};
			actions.appendChild(btnNoEntregar);
			div.appendChild(actions);
		}
		// Si es cliente, verifica si su ticket sigue activo
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
		// Si el ticket fue entregado o no entregado, lo elimina del localStorage y actualiza UI
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
	// Si ya no está en la cola, limpia el ticket del cliente y actualiza UI
	if (currentRole === "cliente" && myTicket && !ticketStillActive) {
		setMyTicket(null);
		setTimeout(updateClienteUI, 100);
	}
}
function addToQueue() {
	if (currentRole === "cliente" && getMyTicket()) return;
	const input = document.getElementById("numberInput");
	const value = input.value.trim();
	if (!value) return;
	const queue = getQueue();
	const now = new Date();
	const ticket = {
		number: value,
		timestamp: now.toLocaleString(),
		entregado: false,
		noentregado: false,
	};
	queue.push(ticket);
	setQueue(queue);
	if (currentRole === "cliente") setMyTicket(ticket);
	renderQueue();
	updateClienteUI();
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
// --- Inicialización ---
showRole();
