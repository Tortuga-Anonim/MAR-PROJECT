const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8080 });

let queue = [];
let clients = [];

wss.on("connection", (ws) => {
	clients.push(ws);

	// Enviar estado actual al nuevo cliente
	ws.send(
		JSON.stringify({
			type: "INIT",
			queue: queue,
		})
	);

	ws.on("message", (message) => {
		try {
			const data = JSON.parse(message);

			switch (data.type) {
				case "ADD_TICKET":
					// Evitar duplicados
					const exists = queue.some(
						(t) =>
							t.number === data.ticket.number &&
							t.timestamp === data.ticket.timestamp
					);

					if (!exists) {
						queue.push(data.ticket);
						broadcastUpdate();
					}
					break;

				case "UPDATE_STATUS":
					const ticketIndex = queue.findIndex(
						(t) =>
							t.number === data.ticket.number &&
							t.timestamp === data.ticket.timestamp
					);

					if (ticketIndex !== -1) {
						queue[ticketIndex][data.status] = true;
						broadcastUpdate();

						// Notificación para "noentregado"
						if (data.status === "noentregado") {
							notifyClient(data.ticket, "Comuníquese con el personal");
						}

						// Eliminar después de 5 segundos
						setTimeout(() => {
							const idx = queue.findIndex(
								(t) =>
									t.number === data.ticket.number &&
									t.timestamp === data.ticket.timestamp
							);
							if (idx !== -1 && queue[idx][data.status]) {
								queue.splice(idx, 1);
								broadcastUpdate();
							}
						}, 5000);
					}
					break;

				case "REMOVE_TICKET":
					queue = queue.filter(
						(t) =>
							!(
								t.number === data.ticket.number &&
								t.timestamp === data.ticket.timestamp
							)
					);
					broadcastUpdate();
					break;
			}
		} catch (error) {
			console.error("Error procesando mensaje:", error);
		}
	});

	ws.on("close", () => {
		clients = clients.filter((client) => client !== ws);
	});
});

function broadcastUpdate() {
	const update = JSON.stringify({
		type: "UPDATE",
		queue: queue,
	});

	clients.forEach((client) => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(update);
		}
	});
}

function notifyClient(ticket, message) {
	const notification = JSON.stringify({
		type: "NOTIFICATION",
		ticket: ticket,
		message: message,
	});

	clients.forEach((client) => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(notification);
		}
	});
}
