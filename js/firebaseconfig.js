const firebaseConfig = {
	apiKey: "AIzaSyBuTdSd1YyBhy9xqhx7w2QEA4-Ef_z2WVE",
	authDomain: "valet-parking-754ee.firebaseapp.com",
	projectId: "valet-parking-754ee",
	storageBucket: "valet-parking-754ee.appspot.com",
	messagingSenderId: "524229283877",
	appId: "1:524229283877:web:8538ba282ad86237792fcc",
	measurementId: "G-J47VFZ5E94",
};

const app = firebase.initializeApp(firebaseConfig);
const database = firebase.firestore(app);
