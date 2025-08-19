class DatabaseServices {
	async createData(collectionName, struct) {
		try {
			const now = new Date();
			const docRef = await database.collection(collectionName).add({
				...struct,
				fecha: firebase.firestore.FieldValue.serverTimestamp(),
				createdAt: now.getTime(),
				visibleEnCola: true,
				status: "pendiente",
				timestamp: now.toLocaleString(),
			});
			return docRef.id;
		} catch (error) {
			console.error("Error adding document: ", error);
			return "";
		}
	}

	consultData(collectionName, callback) {
		return database
			.collection(collectionName)
			.where("status", "==", "pendiente") // Solo mostrar pendientes
			.onSnapshot((querySnapshot) => {
				const listData = [];
				querySnapshot.forEach((doc) => {
					const data = doc.data();
					listData.push({
						id: doc.id,
						...data,
						fecha: data.fecha?.toDate(),
						timestamp: data.timestamp || data.fecha?.toDate().toLocaleString(),
					});
				});
				callback(listData);
			});
	}

	async getHistoricalTickets(limit = 100) {
		try {
			const querySnapshot = await database
				.collection("tickets")
				.orderBy("fecha", "desc")
				.limit(limit)
				.get();

			return querySnapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					id: doc.id,
					...data,
					fecha: data.fecha.toDate(),
					timestamp: data.timestamp || data.fecha.toDate().toLocaleString(),
				};
			});
		} catch (error) {
			console.error("Error getting tickets:", error);
			return [];
		}
	}

	async editData(collectionName, id, updateData) {
		try {
			await database
				.collection(collectionName)
				.doc(id)
				.update({
					...updateData,
					updatedAt: new Date().getTime(),
				});
		} catch (error) {
			console.error("Error updating document: ", error);
		}
	}

	async deleteData(collectionName, id) {
		try {
			await database.collection(collectionName).doc(id).delete();
		} catch (error) {
			console.error("Error deleting document: ", error);
		}
	}
}

const dbService = new DatabaseServices();
