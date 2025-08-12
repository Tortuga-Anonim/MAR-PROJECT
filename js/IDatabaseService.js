class DatabaseServices {
	async createData(collectionName, struct) {
		try {
			const docRef = await database.collection(collectionName).add(struct);
			return docRef.id;
		} catch (error) {
			console.error("Error adding document: ", error);
			return "";
		}
	}

	consultData(collectionName, callback) {
		return database.collection(collectionName).onSnapshot((querySnapshot) => {
			const listData = [];
			querySnapshot.forEach((doc) => {
				listData.push({
					id: doc.id,
					...doc.data(),
				});
			});
			callback(listData);
		});
	}

	async getHistoricalTickets() {
		try {
			const querySnapshot = await database
				.collection("tickets")
				.orderBy("fecha", "desc")
				.get();

			return querySnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
				fecha: doc.data().fecha.toDate(),
			}));
		} catch (error) {
			console.error("Error getting tickets:", error);
			return [];
		}
	}

	async editData(collectionName, id, updateData) {
		try {
			await database.collection(collectionName).doc(id).update(updateData);
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
