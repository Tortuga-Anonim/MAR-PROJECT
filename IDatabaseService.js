import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	onSnapshot,
	updateDoc,
	getDocs,
	query,
	orderBy,
} from "firebase/firestore";
import { database } from "./firebaseconfig.js";

class DatabaseServices {
	async createData(collectionName, struct) {
		try {
			const docRef = await addDoc(collection(database, collectionName), struct);
			return docRef.id;
		} catch (error) {
			console.error("Error adding document: ", error);
			return "";
		}
	}

	consultData(collectionName, callback) {
		const unsubscribe = onSnapshot(
			collection(database, collectionName),
			(querySnapshot) => {
				const listData = [];
				querySnapshot.forEach((doc) => {
					const data = {
						...doc.data(),
						id: doc.id,
					};
					listData.push(data);
				});
				callback(listData);
			}
		);
		return unsubscribe;
	}

	async getHistoricalTickets() {
		try {
			const q = query(
				collection(database, "tickets"),
				orderBy("fecha", "desc")
			);

			const querySnapshot = await getDocs(q);
			const tickets = [];
			querySnapshot.forEach((doc) => {
				const data = doc.data();
				tickets.push({
					id: doc.id,
					number: data.number,
					status: data.status,
					fecha: data.fecha.toDate(),
				});
			});
			return tickets;
		} catch (error) {
			console.error("Error getting tickets:", error);
			return [];
		}
	}

	async editData(collectionName, id, updateData) {
		try {
			const docRef = doc(database, collectionName, id);
			await updateDoc(docRef, updateData);
		} catch (error) {
			console.error("Error updating document: ", error);
		}
	}

	async deleteData(collectionName, id) {
		try {
			const docRef = doc(database, collectionName, id);
			await deleteDoc(docRef);
		} catch (error) {
			console.error("Error deleting document: ", error);
		}
	}
}

export default DatabaseServices;
